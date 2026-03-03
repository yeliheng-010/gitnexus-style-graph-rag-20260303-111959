import { ReactNode } from "react";
import { t } from "../i18n";
import { Button } from "./Button";

type DrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, subtitle, onClose, children }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3 className="card-title" style={{ marginBottom: 2 }}>
              {title}
            </h3>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("drawer.close")}
          </Button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

