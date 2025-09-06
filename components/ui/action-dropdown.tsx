// Simple button component instead of complex dropdown for now
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive" | "success";
  className?: string;
}

interface ActionDropdownProps {
  primaryAction?: ActionItem;
  actions: ActionItem[];
  trigger?: "button" | "dots";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function ActionDropdown({
  primaryAction,
  actions,
  size = "sm",
  className
}: ActionDropdownProps) {
  // For now, just show the primary action as a button
  if (primaryAction) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
        className={cn(
          "flex items-center gap-2",
          primaryAction.variant === "destructive" && "text-red-600 hover:text-red-700",
          primaryAction.variant === "success" && "text-green-600 hover:text-green-700",
          primaryAction.className,
          className
        )}
      >
        {primaryAction.icon}
        {primaryAction.label}
      </Button>
    );
  }

  // If no primary action, show the first action
  const firstAction = actions[0];
  if (firstAction) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={firstAction.onClick}
        disabled={firstAction.disabled}
        className={cn(
          "flex items-center gap-2",
          firstAction.variant === "destructive" && "text-red-600 hover:text-red-700",
          firstAction.variant === "success" && "text-green-600 hover:text-green-700",
          firstAction.className,
          className
        )}
      >
        {firstAction.icon}
        {firstAction.label}
      </Button>
    );
  }

  return null;
}
