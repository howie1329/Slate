import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={() => setTheme(nextTheme)}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon02Icon} strokeWidth={2} />
      <span className="sr-only">Switch to {nextTheme} mode</span>
    </Button>
  );
}
