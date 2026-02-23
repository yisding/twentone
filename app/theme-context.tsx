"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [isThemeHydrated, setIsThemeHydrated] = useState(false);

  // Load theme from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const resolvedTheme: Theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    const timer = window.setTimeout(() => {
      setTheme(resolvedTheme);
      setIsThemeHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Keep the .dark class on <html> in sync
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (!isThemeHydrated) return;
    localStorage.setItem("theme", theme);
  }, [theme, isThemeHydrated]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
