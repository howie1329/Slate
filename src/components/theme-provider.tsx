import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePlannerState, useUpdateSettings } from "@/lib/planner-query";
import type { Theme } from "@/lib/planner";

type ThemeProviderProps = { children: ReactNode };

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const planner = usePlannerState();
  const updateSettings = useUpdateSettings();
  const theme = planner.data?.settings.theme ?? "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function setTheme(nextTheme: Theme) {
    if (!planner.data) {
      return;
    }

    updateSettings.mutate({ ...planner.data.settings, theme: nextTheme });
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
