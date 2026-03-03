import { ReactNode } from "react";
import { t } from "../i18n";

export type TabItem = {
  id: string;
  label: string;
};

type TabsProps = {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
  className?: string;
};

export function Tabs({ items, active, onChange, children, className = "" }: TabsProps) {
  return (
    <div className={`tabs-shell ${className}`.trim()}>
      <div className="tab-list" role="tablist" aria-label={t("tabs.ariaLabel")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className={`tab-btn ${active === item.id ? "active" : ""}`.trim()}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{children}</div>
    </div>
  );
}

