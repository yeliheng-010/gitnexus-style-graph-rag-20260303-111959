import { useMemo, useState } from "react";
import { Citation, PathResult, SuggestCandidate, callPath } from "../../api";
import { Accordion } from "../../components/Accordion";
import { AutocompleteInput } from "../../components/AutocompleteInput";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CodeBlock } from "../../components/CodeBlock";
import { EmptyState } from "../../components/EmptyState";
import { t } from "../../i18n";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asCandidates(value: unknown): SuggestCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is SuggestCandidate => {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const row = item as Record<string, unknown>;
    return (
      typeof row.qualified_name === "string" &&
      typeof row.type === "string" &&
      typeof row.source === "string" &&
      typeof row.lines === "string" &&
      typeof row.score === "number"
    );
  });
}

type CallPathTabProps = {
  repoId: string;
  sessionId: string;
  maxHops: number;
  onTrace: (trace: Record<string, unknown>) => void;
  onCitations: (citations: Citation[]) => void;
  onToast: (kind: "success" | "error" | "info", title: string, message?: string) => void;
  onRequestIngest: () => void;
};

export function CallPathTab({
  repoId,
  sessionId,
  maxHops,
  onTrace,
  onCitations,
  onToast,
  onRequestIngest
}: CallPathTabProps) {
  const [fromSymbol, setFromSymbol] = useState("");
  const [toSymbol, setToSymbol] = useState("");
  const [localMaxHops, setLocalMaxHops] = useState(maxHops);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PathResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disambiguation = useMemo(() => {
    const trace = asObject(result?.trace);
    const raw = asObject(trace.disambiguation);
    return {
      needsChoice: Boolean(raw.needs_user_choice),
      fromCandidates: asCandidates(asObject(raw.from).candidates),
      toCandidates: asCandidates(asObject(raw.to).candidates)
    };
  }, [result]);

  const runSearch = async () => {
    if (!repoId || !fromSymbol.trim() || !toSymbol.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await callPath({
        repo_id: repoId,
        from_symbol: fromSymbol.trim(),
        to_symbol: toSymbol.trim(),
        max_hops: localMaxHops,
        session_id: sessionId
      });
      setResult(response);
      onTrace(response.trace ?? {});
      onCitations(response.citations);
      if (response.found) {
        onToast("success", t("app.toast.pathSuccessTitle"), t("app.toast.pathSuccessMessage", { steps: response.path.length }));
      } else {
        onToast("info", t("app.toast.pathNotFoundTitle"), response.explain);
      }
    } catch (err) {
      const message = t("app.toast.pathFailedMessage", { error: String(err) });
      setError(message);
      onToast("error", t("app.toast.pathFailedTitle"), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={t("path.title")}
      subtitle={t("path.subtitle")}
      actions={repoId ? <Badge kind="online">{t("path.ready")}</Badge> : <Badge kind="offline">{t("path.ingestRequired")}</Badge>}
    >
      {!repoId ? (
        <EmptyState
          title={t("path.emptyTitle")}
          description={t("path.emptyDescription")}
          actionLabel={t("chat.goIngest")}
          onAction={onRequestIngest}
        />
      ) : (
        <div className="panel-stack">
          {error && <div className="error-banner">{error}</div>}

          <AutocompleteInput
            label={t("path.fromSymbol")}
            value={fromSymbol}
            placeholder={t("path.fromPlaceholder")}
            repoId={repoId}
            sessionId={sessionId}
            onChange={setFromSymbol}
            onSelect={(candidate) => setFromSymbol(candidate.qualified_name)}
          />
          <AutocompleteInput
            label={t("path.toSymbol")}
            value={toSymbol}
            placeholder={t("path.toPlaceholder")}
            repoId={repoId}
            sessionId={sessionId}
            onChange={setToSymbol}
            onSelect={(candidate) => setToSymbol(candidate.qualified_name)}
          />

          <label className="field">
            <span className="field-label">{t("path.maxHops")}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={20}
              value={localMaxHops}
              onChange={(event) => setLocalMaxHops(Math.max(1, Number(event.target.value) || 10))}
            />
          </label>

          <Button onClick={runSearch} disabled={loading || !fromSymbol.trim() || !toSymbol.trim()} loading={loading}>
            {loading ? t("path.searching") : t("path.findPath")}
          </Button>

          {disambiguation.needsChoice && (
            <section className="panel-stack">
              <div className="muted-text">{t("path.disambiguationHint")}</div>
              {disambiguation.fromCandidates.length > 0 && (
                <div className="panel-stack">
                  <strong className="muted-text">{t("path.fromCandidates")}</strong>
                  <div className="candidate-card-row">
                    {disambiguation.fromCandidates.map((candidate, index) => (
                      <Button
                        key={`${candidate.qualified_name}-${index}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => setFromSymbol(candidate.qualified_name)}
                      >
                        <span className="mono">{candidate.qualified_name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {disambiguation.toCandidates.length > 0 && (
                <div className="panel-stack">
                  <strong className="muted-text">{t("path.toCandidates")}</strong>
                  <div className="candidate-card-row">
                    {disambiguation.toCandidates.map((candidate, index) => (
                      <Button
                        key={`${candidate.qualified_name}-${index}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => setToSymbol(candidate.qualified_name)}
                      >
                        <span className="mono">{candidate.qualified_name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {result && (
            <div className="panel-stack">
              <div className={result.found ? "success-banner" : "error-banner"}>{result.explain}</div>
              {result.path.length > 0 && (
                <div className="path-list">
                  {result.path.map((step, index) => (
                    <article key={`${step.symbol}-${index}`} className="path-step">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <strong className="mono">{step.symbol}</strong>
                        {step.edge ? <Badge kind="type">{step.edge}</Badge> : <span />}
                      </div>
                      <div className="muted-text mono">
                        {step.source}:{step.lines}
                      </div>
                      <Accordion title={t("path.viewSnippet")}>
                        <CodeBlock
                          title={t("path.step", { index: index + 1 })}
                          code={step.snippet || t("path.emptySnippet")}
                        />
                      </Accordion>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

