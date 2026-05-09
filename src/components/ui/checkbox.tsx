import * as React from "react";
import { cn } from "../../utils/cn";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn("h-4 w-4 rounded border-border accent-[hsl(var(--primary))]", className)}
    {...props}
  />
));

Checkbox.displayName = "Checkbox";
