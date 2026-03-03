import { HTMLAttributes } from "react";

type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  size?: "sm" | "md";
};

export function Spinner({ size = "md", className = "", ...props }: SpinnerProps) {
  return <span className={`spinner ${size === "sm" ? "spinner-sm" : ""} ${className}`.trim()} aria-hidden="true" {...props} />;
}
