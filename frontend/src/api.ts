export type Citation = {
  source: string;
  lines: string;
  symbol: string;
  quote: string;
};

export type SuggestCandidate = {
  qualified_name: string;
  type: string;
  source: string;
  lines: string;
  score: number;
};

export type IngestPayload = {
  repo_path: string;
  include_globs: string[];
  exclude_globs: string[];
  languages: Array<"python" | "typescript" | "javascript">;
};

export type IngestResult = {
  repo_id: string;
  symbols: number;
  edges: number;
  kuzu_path: string;
  chroma_path: string;
};

export type ChatPayload = {
  session_id: string;
  repo_id: string;
  message: string;
  top_k: number;
  graph_depth: number;
  hybrid: boolean;
  selected_symbol?: string;
};

export type ChatDisambiguation = {
  needs_user_choice?: boolean;
  candidates?: SuggestCandidate[];
  resolved?: string;
  [key: string]: unknown;
};

export type ChatResult = {
  answer: string;
  citations: Citation[];
  used_retrieval: boolean;
  used_graph: boolean;
  used_path: boolean;
  trace: Record<string, unknown>;
  disambiguation?: ChatDisambiguation;
};

export type PathPayload = {
  repo_id: string;
  from_symbol: string;
  to_symbol: string;
  max_hops: number;
  session_id?: string;
};

export type PathResult = {
  found: boolean;
  path: Array<{
    symbol: string;
    source: string;
    lines: string;
    snippet: string;
    edge?: string | null;
  }>;
  citations: Citation[];
  explain: string;
  trace?: Record<string, unknown>;
};

export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function getRequestId(res: Response): string | undefined {
  return res.headers.get("x-request-id") ?? undefined;
}

async function parseError(res: Response): Promise<ApiError> {
  const requestId = getRequestId(res);
  const text = await res.text();
  let message = text || `请求失败（HTTP ${res.status}）`;
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (parsed?.detail) {
      message = parsed.detail;
    }
  } catch {
    // keep text as-is
  }
  return new ApiError(message, res.status, requestId);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as T;
}

export async function ingestRepo(payload: IngestPayload): Promise<IngestResult> {
  return request<IngestResult>("/ingest", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function suggestSymbols(
  repoId: string,
  q: string,
  mode: "prefix" | "fuzzy",
  topN = 10,
  sessionId?: string
): Promise<SuggestCandidate[]> {
  const params = new URLSearchParams({
    repo_id: repoId,
    q,
    mode,
    top_n: String(topN)
  });
  if (sessionId) {
    params.set("session_id", sessionId);
  }
  const resp = await request<{ candidates: SuggestCandidate[] }>(`/symbols/suggest?${params.toString()}`);
  return resp.candidates ?? [];
}

export async function chat(payload: ChatPayload): Promise<ChatResult> {
  return request<ChatResult>("/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export type StreamCallbacks = {
  onToken?: (token: string) => void;
  onTraceUpdate?: (trace: Record<string, unknown>) => void;
  onCitationsUpdate?: (citations: Citation[]) => void;
};

type SseChunk = {
  event: string;
  data: unknown;
};

function parseSseChunk(raw: string): SseChunk {
  const lines = raw.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const dataText = dataLines.join("\n");
  if (!dataText) {
    return { event, data: null };
  }

  try {
    return { event, data: JSON.parse(dataText) as unknown };
  } catch {
    return { event, data: dataText };
  }
}

function asObject(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function asCitations(data: unknown): Citation[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((item): item is Citation => {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const row = item as Record<string, unknown>;
    return (
      typeof row.source === "string" &&
      typeof row.lines === "string" &&
      typeof row.symbol === "string" &&
      typeof row.quote === "string"
    );
  });
}

export async function chatStream(payload: ChatPayload, callbacks: StreamCallbacks = {}): Promise<ChatResult> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw await parseError(res);
  }
  if (!res.body) {
    throw new Error("流式通道不可用：响应体为空");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResult: ChatResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) {
        break;
      }

      const rawChunk = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!rawChunk) {
        continue;
      }

      const parsed = parseSseChunk(rawChunk);
      const dataObj = asObject(parsed.data);

      if (parsed.event === "token") {
        const token = typeof dataObj.token === "string" ? dataObj.token : "";
        if (token && callbacks.onToken) {
          callbacks.onToken(token);
        }
        continue;
      }

      if (parsed.event === "trace_update") {
        const trace = asObject(dataObj.trace);
        callbacks.onTraceUpdate?.(trace);
        continue;
      }

      if (parsed.event === "citations_update") {
        const citations = asCitations(dataObj.citations);
        callbacks.onCitationsUpdate?.(citations);
        continue;
      }

      if (parsed.event === "done") {
        const data = asObject(parsed.data);
        finalResult = {
          answer: typeof data.answer === "string" ? data.answer : "",
          citations: asCitations(data.citations),
          used_retrieval: Boolean(data.used_retrieval),
          used_graph: Boolean(data.used_graph),
          used_path: Boolean(data.used_path),
          trace: asObject(data.trace),
          disambiguation: asObject(data.disambiguation) as ChatDisambiguation
        };
        continue;
      }

      if (parsed.event === "error") {
        const message = typeof dataObj.message === "string" ? dataObj.message : "流式输出失败";
        throw new Error(message);
      }
    }
  }

  if (!finalResult) {
    throw new Error("流式输出提前结束，未收到完成事件");
  }
  return finalResult;
}

export async function callPath(payload: PathPayload): Promise<PathResult> {
  return request<PathResult>("/path", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
