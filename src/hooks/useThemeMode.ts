import { useEffect, useState } from "react";
import { getInitialTheme } from "../components/ThemeSelector";

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "linguacheck.darkMode";

export function useThemeMode() {
  const [darkMode, setDarkMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return getInitialTheme();
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    if (
      darkMode === "dark" ||
      (darkMode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
    localStorage.setItem(THEME_KEY, darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (darkMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [darkMode]);

  return { darkMode, setDarkMode };
}
