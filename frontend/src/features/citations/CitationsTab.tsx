import { Citation } from "../../api";
import { Accordion } from "../../components/Accordion";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { CodeBlock } from "../../components/CodeBlock";
import { EmptyState } from "../../components/EmptyState";
import { t } from "../../i18n";

type CitationsTabProps = {
  citations: Citation[];
};

export function CitationsTab({ citations }: CitationsTabProps) {
  return (
    <Card title={t("citations.title")} subtitle={t("citations.subtitle")} actions={<Badge>{citations.length}</Badge>}>
      {citations.length === 0 ? (
        <EmptyState title={t("citations.emptyTitle")} description={t("citations.emptyDescription")} />
      ) : (
        <div className="panel-stack">
          {citations.map((citation, index) => (
            <Accordion
              key={`${citation.symbol}-${index}`}
              title={
                <span className="mono" style={{ fontSize: 12 }}>
                  {citation.symbol}
                </span>
              }
              right={
                <span className="muted-text mono" style={{ fontSize: 11 }}>
                  {citation.source}:{citation.lines}
                </span>
              }
            >
              <CodeBlock title={`${citation.source}:${citation.lines}`} code={citation.quote} />
            </Accordion>
          ))}
        </div>
      )}
    </Card>
  );
}

