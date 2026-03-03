import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Citation, ChatResult, SuggestCandidate, chat, chatStream } from "../../api";
import { Accordion } from "../../components/Accordion";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CodeBlock } from "../../components/CodeBlock";
import { EmptyState } from "../../components/EmptyState";
import { Textarea } from "../../components/Input";
import { Skeleton } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import { t } from "../../i18n";

function messageId(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}`;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  trace?: Record<string, unknown>;
  isStreaming?: boolean;
  createdAt: string;
};

type PendingChoice = {
  question: string;
  candidates: SuggestCandidate[];
};

type ChatPanelProps = {
  repoId: string;
  sessionId: string;
  topK: number;
  graphDepth: number;
  hybrid: boolean;
  onTrace: (trace: Record<string, unknown>) => void;
  onCitations: (citations: Citation[]) => void;
  onToast: (kind: "success" | "error" | "info", title: string, message?: string) => void;
  onRequestIngest: () => void;
};

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  repoId,
  sessionId,
  topK,
  graphDepth,
  hybrid,
  onTrace,
  onCitations,
  onToast,
  onRequestIngest
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, sending]);

  const canSend = useMemo(() => Boolean(repoId) && !sending, [repoId, sending]);

  const patchMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const appendAssistantResult = (assistantId: string, result: ChatResult, originalQuestion: string) => {
    patchMessage(assistantId, {
      content: result.answer,
      citations: result.citations,
      trace: result.trace,
      isStreaming: false
    });
    onTrace(result.trace);
    onCitations(result.citations);

    if (result.disambiguation?.needs_user_choice) {
      const candidates = result.disambiguation.candidates ?? [];
      if (candidates.length > 0) {
        setPendingChoice({ question: originalQuestion, candidates });
        return;
      }
    }
    setPendingChoice(null);
  };

  const sendMessage = async (question: string, selectedSymbol?: string, appendUser = true) => {
    const normalized = question.trim();
    if (!repoId || !normalized) {
      if (!repoId) {
        onToast("info", t("app.toast.ingestRequiredTitle"));
      }
      return;
    }

    setLocalError(null);
    setSending(true);

    if (appendUser) {
      setMessages((prev) => [
        ...prev,
        {
          id: messageId(),
          role: "user",
          content: normalized,
          createdAt: nowTime()
        }
      ]);
    }

    const assistantId = messageId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        citations: [],
        createdAt: nowTime()
      }
    ]);

    const payload = {
      session_id: sessionId,
      repo_id: repoId,
      message: normalized,
      top_k: topK,
      graph_depth: graphDepth,
      hybrid,
      selected_symbol: selectedSymbol
    };

    try {
      try {
        let streamedText = "";
        const streamResult = await chatStream(payload, {
          onToken: (token) => {
            streamedText += token;
            patchMessage(assistantId, { content: `${streamedText}▌`, isStreaming: true });
          },
          onTraceUpdate: (trace) => {
            patchMessage(assistantId, { trace });
            onTrace(trace);
          },
          onCitationsUpdate: (citations) => {
            patchMessage(assistantId, { citations });
            onCitations(citations);
          }
        });

        appendAssistantResult(assistantId, streamResult, normalized);
        return;
      } catch {
        // fallback below
      }

      try {
        const fallback = await chat(payload);
        appendAssistantResult(assistantId, fallback, normalized);
      } catch (error) {
        const message = t("app.toast.chatFailedMessage", { error: String(error) });
        patchMessage(assistantId, { content: message, isStreaming: false });
        setLocalError(message);
        onToast("error", t("app.toast.chatFailedTitle"), message);
      }
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || !canSend) {
      return;
    }
    setInput("");
    await sendMessage(value, undefined, true);
  };

  const onSelectCandidate = async (candidate: SuggestCandidate) => {
    if (!pendingChoice) {
      return;
    }
    onToast("info", t("app.toast.candidateSelectedTitle"), candidate.qualified_name);
    await sendMessage(pendingChoice.question, candidate.qualified_name, false);
    setPendingChoice(null);
  };

  return (
    <Card
      className="chat-shell"
      bodyClassName="chat-body"
      title={t("chat.title")}
      subtitle={t("chat.subtitle")}
      actions={repoId ? <Badge kind="online">{t("chat.ready")}</Badge> : <Badge kind="offline">{t("chat.ingestRequired")}</Badge>}
    >
      {!repoId ? (
        <EmptyState
          title={t("chat.emptyTitle")}
          description={t("chat.emptyDescription")}
          actionLabel={t("chat.goIngest")}
          onAction={onRequestIngest}
        />
      ) : (
        <>
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="muted-text" style={{ padding: "8px 4px" }}>
                {t("chat.introExamples")}
              </div>
            )}

            {messages.map((message) => (
              <article key={message.id} className={`chat-msg ${message.role}`}>
                {message.role === "assistant" && <span className="avatar">{t("chat.avatarAssistant")}</span>}
                <div className={`bubble ${message.role === "user" ? "user" : ""}`.trim()}>
                  <div className="bubble-meta">
                    <span>{message.role === "user" ? t("chat.roleUser") : t("chat.roleAssistant")}</span>
                    <span className="mono">{message.createdAt}</span>
                  </div>

                  <div className="bubble-content">
                    {message.content || (message.isStreaming ? t("chat.generating") : "")}
                    {message.isStreaming && (
                      <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Spinner size="sm" />
                        <span className="muted-text">{t("chat.sending")}</span>
                      </span>
                    )}
                  </div>

                  {!!message.citations?.length && (
                    <>
                      <div className="inline-citations">
                        {message.citations.slice(0, 4).map((citation, index) => (
                          <span key={`${citation.symbol}-${index}`} className="citation-chip mono">
                            {citation.symbol} @ {citation.lines}
                          </span>
                        ))}
                      </div>

                      <Accordion title={t("chat.citationsTitle", { count: message.citations.length })}>
                        {message.citations.map((citation, index) => (
                          <div key={`${citation.symbol}-${index}`} className="panel-stack">
                            <div className="muted-text mono">
                              {citation.source}:{citation.lines}
                            </div>
                            <CodeBlock title={citation.symbol} code={citation.quote} collapsible />
                          </div>
                        ))}
                      </Accordion>
                    </>
                  )}
                </div>
                {message.role === "user" && <span className="avatar">{t("chat.avatarUser")}</span>}
              </article>
            ))}

            {sending && messages.length === 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <Skeleton height={14} />
                <Skeleton height={14} />
                <Skeleton height={14} />
              </div>
            )}
          </div>

          {pendingChoice && pendingChoice.candidates.length > 0 && (
            <div className="chat-input-wrap" style={{ borderTop: "1px dashed var(--border)" }}>
              <div className="muted-text">{t("chat.disambiguationPrompt")}</div>
              <div className="candidate-card-row">
                {pendingChoice.candidates.map((candidate, index) => (
                  <Button
                    key={`${candidate.qualified_name}-${index}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectCandidate(candidate)}
                    disabled={sending}
                  >
                    <span className="mono">{candidate.qualified_name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <form className="chat-input-wrap" onSubmit={onSubmit}>
            {localError && <div className="error-banner">{localError}</div>}
            <div className="chat-form-row">
              <Textarea
                placeholder={t("chat.inputPlaceholder")}
                value={input}
                disabled={!canSend}
                onChange={(event) => setInput(event.target.value)}
              />
              <Button type="submit" disabled={!canSend || !input.trim()} loading={sending}>
                {sending ? t("chat.sending") : t("chat.send")}
              </Button>
            </div>
          </form>
        </>
      )}
    </Card>
  );
}

