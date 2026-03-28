'use client';
import { createContext, useContext, useState, ReactNode } from "react";

export type Theme = "radix-light" | "radix-dark" | "oro-light" | "oro-dark" | "radix-original-light" | "radix-original-dark";

const THEMES: Theme[] = ["radix-light", "radix-dark", "oro-light", "oro-dark", "radix-original-light", "radix-original-dark"];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getHtmlTheme(): Theme {
  if (typeof document === 'undefined') return 'radix-light';
  const cl = document.documentElement.classList;
  for (const t of THEMES) {
    if (cl.contains(t)) return t;
  }
  return 'radix-light';
}

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window !== 'undefined' ? getHtmlTheme() : (initialTheme ?? 'radix-light')
  );

  const setTheme = (t: Theme) => {
    // Freeze all transitions for exactly one paint cycle.
    // Without this, the ~70 elements that carry Tailwind transition-colors /
    // transition-all classes animate from the old theme's colours to the new
    // ones, producing a visible "flash" during the swap.
    //
    // Technique: inject a <style> that overrides every transition to `none`,
    // swap the theme class, then remove the <style> after two rAF calls —
    // the double-rAF guarantees the browser has committed and painted the new
    // colours before transitions are re-enabled, so users see an instant,
    // flash-free change instead of an animated one.
    const freeze = document.createElement('style');
    freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(freeze);

    // Swap theme class immediately while transitions are frozen
    const html = document.documentElement;
    for (const theme of THEMES) html.classList.remove(theme);
    html.classList.add(t);

    // Remove freeze after the browser has painted the new colours
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.head.removeChild(freeze);
      });
    });

    document.cookie = `theme=${t}; path=/; max-age=31536000; SameSite=Lax`; // eslint-disable-line react-compiler/react-compiler
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
