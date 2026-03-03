import { ReactNode } from "react";
import { Button } from "./Button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

export function EmptyState({ title, description, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p className="muted-text" style={{ margin: 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
