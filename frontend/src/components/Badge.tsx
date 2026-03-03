import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  kind?: "default" | "online" | "offline" | "type";
};

export function Badge({ children, kind = "default" }: BadgeProps) {
  const cls = [
    "badge",
    kind === "online" ? "badge-status-online" : "",
    kind === "offline" ? "badge-status-offline" : "",
    kind === "type" ? "badge-type" : ""
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}
