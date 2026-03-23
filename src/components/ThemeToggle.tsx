import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const ThemeToggle = () => {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default ThemeToggle;
