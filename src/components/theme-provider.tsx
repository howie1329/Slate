import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  const storedTheme = window.localStorage.getItem(storageKey);

  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : defaultTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "slate-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState(() => getStoredTheme(storageKey, defaultTheme));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(storageKey, theme);
  }, [storageKey, theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme: setThemeState }}>
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
