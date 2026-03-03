import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", loading = false, icon, children, className = "", ...props }: ButtonProps) {
  const classes = [
    "btn",
    variant === "secondary" ? "btn-secondary" : "",
    variant === "ghost" ? "btn-ghost" : "",
    size === "sm" ? "btn-small" : "",
    size === "icon" ? "btn-icon" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {loading ? <span aria-hidden="true">…</span> : icon}
      {children}
    </button>
  );
}
