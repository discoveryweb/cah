import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const readTheme = (): Theme => document.documentElement.dataset.theme === "dark" ? "dark" : "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0a0a1e" : "#f8f7fc");
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "cahen-theme") return;
      const next = event.newValue === "dark" ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    const update = () => {
      applyTheme(next);
      try { localStorage.setItem("cahen-theme", next); } catch { /* still works for this visit */ }
      setTheme(next);
    };
    if (typeof document.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(update);
    } else update();
  };
  return (
    <button type="button" className="theme-switch bubble" onClick={toggle} aria-label={theme === "dark" ? "فعال کردن حالت روشن" : "فعال کردن حالت تیره"} title={theme === "dark" ? "حالت روشن" : "حالت تیره"}>
      <span className="theme-switch__icons" data-theme={theme} aria-hidden="true"><Sun className="theme-switch__sun" /><Moon className="theme-switch__moon" /></span>
    </button>
  );
}
