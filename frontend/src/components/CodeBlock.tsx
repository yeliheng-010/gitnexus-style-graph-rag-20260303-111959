import { useState } from "react";
import { t } from "../i18n";
import { Button } from "./Button";

type CodeBlockProps = {
  title?: string;
  code: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function CodeBlock({ title = t("codeBlock.defaultTitle"), code, collapsible = false, defaultOpen = true }: CodeBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
  };

  return (
    <section className="code-block">
      <div className="code-head">
        <strong className="mono" style={{ fontSize: 12 }}>
          {title}
        </strong>
        <div style={{ display: "inline-flex", gap: 6 }}>
          {collapsible && (
            <Button variant="ghost" size="sm" onClick={() => setOpen((prev) => !prev)}>
              {open ? t("codeBlock.collapse") : t("codeBlock.expand")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={copy}>
            {t("codeBlock.copy")}
          </Button>
        </div>
      </div>
      {open && <pre className="code-body mono">{code}</pre>}
    </section>
  );
}

