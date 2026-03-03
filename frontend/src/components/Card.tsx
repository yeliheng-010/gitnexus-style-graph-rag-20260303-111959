import { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Card({ title, subtitle, actions, children, className = "", bodyClassName = "" }: CardProps) {
  return (
    <section className={`surface-card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <header className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
