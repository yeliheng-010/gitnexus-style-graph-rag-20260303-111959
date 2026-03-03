import { Accordion } from "../../components/Accordion";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { CodeBlock } from "../../components/CodeBlock";
import { EmptyState } from "../../components/EmptyState";
import { t } from "../../i18n";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

type TraceTabProps = {
  trace: Record<string, unknown>;
};

export function TraceTab({ trace }: TraceTabProps) {
  const route = typeof trace.route === "string" ? trace.route : "-";
  const retrievalMode = typeof trace.retrieval_mode === "string" ? trace.retrieval_mode : "-";
  const attempts = typeof trace.attempts === "number" ? trace.attempts : "-";
  const nodes = asNodes(trace.nodes);
  const disambiguation = asObject(trace.disambiguation);

  return (
    <Card title={t("trace.title")} subtitle={t("trace.subtitle")} actions={<Badge kind="type">{route}</Badge>}>
      {Object.keys(trace).length === 0 ? (
        <EmptyState title={t("trace.emptyTitle")} description={t("trace.emptyDescription")} />
      ) : (
        <div className="panel-stack">
          <div className="kv-grid">
            <div className="kv-item">
              <div className="kv-key">{t("trace.route")}</div>
              <div className="kv-value mono">{route}</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("trace.attempts")}</div>
              <div className="kv-value mono">{String(attempts)}</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("trace.retrievalMode")}</div>
              <div className="kv-value mono">{retrievalMode}</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("trace.disambiguation")}</div>
              <div className="kv-value mono">
                {disambiguation.needs_user_choice ? t("trace.disambiguationNeedsChoice") : t("trace.disambiguationResolved")}
              </div>
            </div>
          </div>

          <section className="panel-stack">
            <strong className="muted-text">{t("trace.executedNodes")}</strong>
            {nodes.length > 0 ? (
              <ol className="trace-node-list">
                {nodes.map((node, index) => (
                  <li key={`${node}-${index}`} className="trace-node-item">
                    <span className="mono">{node}</span>
                    <span className="muted-text">#{index + 1}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-text" style={{ margin: 0 }}>
                {t("trace.nodesEmpty")}
              </p>
            )}
          </section>

          <Accordion title={t("trace.rawJson")} defaultOpen={false}>
            <CodeBlock title={t("trace.rawJsonFile")} code={JSON.stringify(trace, null, 2)} />
          </Accordion>
        </div>
      )}
    </Card>
  );
}
