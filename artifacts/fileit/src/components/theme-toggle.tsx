import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") {
        return stored;
      }
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <button
      id="theme-mode-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`relative flex items-center justify-between p-1 w-14 h-8 rounded-full border transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none cursor-pointer ${
        isDark
          ? "bg-slate-800 border-slate-700 hover:bg-slate-700/80"
          : "bg-slate-100 border-slate-200 hover:bg-slate-200/80"
      } ${className}`}
    >
      {/* Background ambient icons */}
      <span className="flex items-center justify-center w-5 h-5 text-amber-500 ml-0.5 pointer-events-none">
        <Sun className="w-3.5 h-3.5" strokeWidth={2.5} />
      </span>
      <span className="flex items-center justify-center w-5 h-5 text-indigo-300 mr-0.5 pointer-events-none">
        <Moon className="w-3.5 h-3.5" strokeWidth={2.5} />
      </span>

      {/* Animated sliding knob */}
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className={`absolute top-1 bottom-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
          isDark
            ? "left-7 bg-indigo-600 text-white shadow-indigo-900/40"
            : "left-1 bg-amber-400 text-slate-900 shadow-amber-500/30"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, scale: 0.2, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <Moon className="w-3.5 h-3.5 fill-current" strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, scale: 0.2, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <Sun className="w-3.5 h-3.5 fill-current" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
