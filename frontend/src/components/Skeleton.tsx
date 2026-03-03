import { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  height?: number;
};

export function Skeleton({ height = 14, className = "", style, ...props }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={{ height, ...style }} {...props} />;
}
