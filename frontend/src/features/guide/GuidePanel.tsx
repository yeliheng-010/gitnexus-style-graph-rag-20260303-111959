import { Button } from "../../components/Button";
import { CodeBlock } from "../../components/CodeBlock";
import { t } from "../../i18n";
import { GUIDE_SECTIONS } from "./guideData";

type GuidePanelProps = {
  compact?: boolean;
};

export function GuidePanel({ compact = false }: GuidePanelProps) {
  return (
    <div className="panel-stack">
      {GUIDE_SECTIONS.map((section) => (
        <section key={section.id} className="guide-section">
          <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <h4>{section.title}</h4>
            {!compact && (
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(section.title)}>
                {t("guide.copyTitle")}
              </Button>
            )}
          </header>

          {section.description && (
            <p className="muted-text" style={{ margin: 0 }}>
              {section.description}
            </p>
          )}

          {section.steps && section.steps.length > 0 && (
            <ol className="guide-list">
              {section.steps.map((step, index) => (
                <li key={`${section.id}-step-${index}`}>{step}</li>
              ))}
            </ol>
          )}

          {section.commands?.map((command) => (
            <CodeBlock key={`${section.id}-${command.label}`} title={command.label} code={command.value} />
          ))}

          {section.notes && section.notes.length > 0 && (
            <ul className="guide-list">
              {section.notes.map((note, index) => (
                <li key={`${section.id}-note-${index}`}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

