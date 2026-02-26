    import { useEffect, useState } from "react";
    import { Moon, Sun } from "lucide-react";

    export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    useEffect(() => {
        const root = document.documentElement; // <html>
        if (theme === "light") root.setAttribute("data-theme", "light");
        else root.removeAttribute("data-theme");
        localStorage.setItem("theme", theme);
    }, [theme]);

    return (
        <button
        className="btn-ghost"
        type="button"
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
        >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Claro" : "Oscuro"}
        </button>
    );
    }