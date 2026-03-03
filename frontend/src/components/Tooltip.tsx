import { ReactNode } from "react";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
};

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-content" role="tooltip">
        {label}
      </span>
    </span>
  );
}
