import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

type ThemeToggleProps = {
  className?: string;
  size?: "icon-xs" | "icon-sm";
};

export function ThemeToggle({ className, size = "icon-sm" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={() => setTheme(nextTheme)}
      size={size}
      title={label}
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon aria-hidden="true" icon={theme === "dark" ? Sun01Icon : Moon02Icon} strokeWidth={2} />
    </Button>
  );
}
