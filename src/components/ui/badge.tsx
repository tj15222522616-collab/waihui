import { cn } from "../../utils/cn";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}

export const Badge = ({ children, tone = "neutral", className }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
      tone === "neutral" && "border-border bg-muted text-foreground",
      tone === "success" && "border-success/30 bg-success/10 text-success",
      tone === "warning" && "border-warning/30 bg-warning/15 text-warning",
      tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
      className
    )}
  >
    {children}
  </span>
);
