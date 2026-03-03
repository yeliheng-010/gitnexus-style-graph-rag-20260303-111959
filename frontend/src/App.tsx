import { useEffect, useMemo, useRef, useState } from "react";
import { Citation, ingestRepo } from "./api";
import { Drawer } from "./components/Drawer";
import { Tabs, TabItem } from "./components/Tabs";
import { ToastItem, ToastStack } from "./components/Toast";
import { t } from "./i18n";
import { ChatPanel } from "./features/chat/ChatPanel";
import { CitationsTab } from "./features/citations/CitationsTab";
import { GuidePanel } from "./features/guide/GuidePanel";
import { RepositorySidebar, IngestStats } from "./features/ingest/RepositorySidebar";
import { HeaderBar } from "./features/layout/HeaderBar";
import { RightPanel } from "./features/layout/RightPanel";
import { CallPathTab } from "./features/path/CallPathTab";
import { TraceTab } from "./features/trace/TraceTab";

function makeSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

function toastId(): string {
  return `toast_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeCitations(current: Citation[], incoming: Citation[]): Citation[] {
  const map = new Map<string, Citation>();
  for (const citation of [...incoming, ...current]) {
    const key = `${citation.source}|${citation.lines}|${citation.symbol}|${citation.quote}`;
    if (!map.has(key)) {
      map.set(key, citation);
    }
  }
  return Array.from(map.values()).slice(0, 200);
}

const MOBILE_TABS: TabItem[] = [
  { id: "chat", label: t("app.mobileTabs.chat") },
  { id: "path", label: t("app.mobileTabs.path") },
  { id: "trace", label: t("app.mobileTabs.trace") },
  { id: "citations", label: t("app.mobileTabs.citations") },
  { id: "guide", label: t("app.mobileTabs.guide") }
];

export default function App() {
  const sessionId = useMemo(() => makeSessionId(), []);

  const [repoPath, setRepoPath] = useState("/app/sample_repo");
  const [repoId, setRepoId] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | undefined>(undefined);
  const [ingestStats, setIngestStats] = useState<IngestStats | undefined>(undefined);

  const [topK, setTopK] = useState(8);
  const [graphDepth, setGraphDepth] = useState(2);
  const [hybrid, setHybrid] = useState(true);
  const [maxHops, setMaxHops] = useState(10);

  const [trace, setTrace] = useState<Record<string, unknown>>({});
  const [citations, setCitations] = useState<Citation[]>([]);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [guideOpen, setGuideOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileTab, setMobileTab] = useState("chat");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pushToast = (kind: "success" | "error" | "info", title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: toastId(), kind, title, message }].slice(-4));
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const onRequestIngest = () => {
    setMobileTab("chat");
    sidebarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onIngest = async () => {
    if (!repoPath.trim()) {
      return;
    }

    setIngesting(true);
    setIngestError(undefined);

    const startedAt = performance.now();
    try {
      const result = await ingestRepo({
        repo_path: repoPath,
        include_globs: ["**/*.*"],
        exclude_globs: ["**/.git/**", "**/node_modules/**", "**/venv/**", "**/__pycache__/**"],
        languages: ["python", "typescript", "javascript"]
      });

      const durationMs = Math.round(performance.now() - startedAt);
      const lastIngestAt = new Date().toLocaleString();

      setRepoId(result.repo_id);
      setIngestStats({ ...result, durationMs, lastIngestAt });
      pushToast(
        "success",
        t("app.toast.ingestSuccessTitle"),
        t("app.toast.ingestSuccessMessage", { symbols: result.symbols, edges: result.edges })
      );
    } catch (error) {
      const message = t("app.toast.ingestFailedMessage", { error: String(error) });
      setIngestError(message);
      pushToast("error", t("app.toast.ingestFailedTitle"), message);
    } finally {
      setIngesting(false);
    }
  };

  const handleTrace = (next: Record<string, unknown>) => {
    setTrace(next);
  };

  const handleCitations = (next: Citation[]) => {
    if (!next.length) {
      return;
    }
    setCitations((prev) => mergeCitations(prev, next));
  };

  const indexed = Boolean(repoId);

  return (
    <div className="app-root">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="app-shell">
        <HeaderBar
          repoId={repoId}
          indexed={indexed}
          symbols={ingestStats?.symbols}
          edges={ingestStats?.edges}
          lastIngestAt={ingestStats?.lastIngestAt}
          onOpenGuide={() => setGuideOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        />

        {!isMobile ? (
          <section className="main-layout">
            <div ref={sidebarRef}>
              <RepositorySidebar
                repoPath={repoPath}
                onRepoPathChange={setRepoPath}
                onIngest={onIngest}
                ingesting={ingesting}
                indexed={indexed}
                repoId={repoId}
                stats={ingestStats}
                topK={topK}
                graphDepth={graphDepth}
                hybrid={hybrid}
                maxHops={maxHops}
                onTopKChange={setTopK}
                onGraphDepthChange={setGraphDepth}
                onHybridChange={setHybrid}
                onMaxHopsChange={setMaxHops}
                error={ingestError}
              />
            </div>

            <ChatPanel
              repoId={repoId}
              sessionId={sessionId}
              topK={topK}
              graphDepth={graphDepth}
              hybrid={hybrid}
              onTrace={handleTrace}
              onCitations={handleCitations}
              onToast={pushToast}
              onRequestIngest={onRequestIngest}
            />

            <RightPanel
              repoId={repoId}
              sessionId={sessionId}
              maxHops={maxHops}
              trace={trace}
              citations={citations}
              onTrace={handleTrace}
              onCitations={handleCitations}
              onToast={pushToast}
              onRequestIngest={onRequestIngest}
            />
          </section>
        ) : (
          <section className="panel-stack">
            <div ref={sidebarRef}>
              <RepositorySidebar
                repoPath={repoPath}
                onRepoPathChange={setRepoPath}
                onIngest={onIngest}
                ingesting={ingesting}
                indexed={indexed}
                repoId={repoId}
                stats={ingestStats}
                topK={topK}
                graphDepth={graphDepth}
                hybrid={hybrid}
                maxHops={maxHops}
                onTopKChange={setTopK}
                onGraphDepthChange={setGraphDepth}
                onHybridChange={setHybrid}
                onMaxHopsChange={setMaxHops}
                error={ingestError}
              />
            </div>

            <section className="surface-card">
              <div className="card-body">
                <Tabs items={MOBILE_TABS} active={mobileTab} onChange={setMobileTab}>
                  {mobileTab === "chat" && (
                    <ChatPanel
                      repoId={repoId}
                      sessionId={sessionId}
                      topK={topK}
                      graphDepth={graphDepth}
                      hybrid={hybrid}
                      onTrace={handleTrace}
                      onCitations={handleCitations}
                      onToast={pushToast}
                      onRequestIngest={onRequestIngest}
                    />
                  )}
                  {mobileTab === "path" && (
                    <CallPathTab
                      repoId={repoId}
                      sessionId={sessionId}
                      maxHops={maxHops}
                      onTrace={handleTrace}
                      onCitations={handleCitations}
                      onToast={pushToast}
                      onRequestIngest={onRequestIngest}
                    />
                  )}
                  {mobileTab === "trace" && <TraceTab trace={trace} />}
                  {mobileTab === "citations" && <CitationsTab citations={citations} />}
                  {mobileTab === "guide" && <GuidePanel />}
                </Tabs>
              </div>
            </section>
          </section>
        )}
      </div>

      <Drawer
        open={guideOpen}
        title={t("app.drawer.title")}
        subtitle={t("app.drawer.subtitle")}
        onClose={() => setGuideOpen(false)}
      >
        <GuidePanel />
      </Drawer>
    </div>
  );
}
