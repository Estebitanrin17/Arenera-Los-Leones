    import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
    import { useEffect, useMemo, useState } from "react";
    import { getUser, logout } from "../services/auth";
    import "./appShell.css";

    import {
    LayoutDashboard,
    Package,
    Boxes,
    ShoppingCart,
    Receipt,
    Users,
    HandCoins,
    Wallet,
    FileText,
    LogOut,
    Search,
    PanelLeftClose,
    PanelLeftOpen,
    Menu,
    X,
    } from "lucide-react";

    const NAV_ITEMS = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/inventory", label: "Inventario", icon: Boxes },
    { to: "/products", label: "Productos", icon: Package },
    { to: "/sales", label: "Ventas", icon: ShoppingCart },
    { to: "/expenses", label: "Gastos", icon: Receipt },
    { to: "/employees", label: "Empleados", icon: Users },
    { to: "/debts", label: "Deudas", icon: HandCoins },
    { to: "/payroll", label: "Nómina", icon: Wallet },
    { to: "/reports", label: "Reportes", icon: FileText },
    ];

    function initials(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
    }

    export default function AppShell() {
    const user = getUser();
    const nav = useNavigate();
    const location = useLocation();

    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem("sidebar_collapsed") === "1";
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [q, setQ] = useState("");

    useEffect(() => {
        localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
    }, [collapsed]);

    // Cierra drawer al cambiar de ruta
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const onLogout = () => {
        logout();
        nav("/login");
    };

    const filteredItems = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return NAV_ITEMS;
        return NAV_ITEMS.filter((it) => it.label.toLowerCase().includes(s));
    }, [q]);

    const linkClass = ({ isActive }) =>
        `sb-link ${isActive ? "sb-link--active" : ""}`;

    return (
        <div className="app-shell">
        {/* Overlay (mobile drawer) */}
        <div
            className={`sb-overlay ${mobileOpen ? "sb-overlay--open" : ""}`}
            onClick={() => setMobileOpen(false)}
        />

        {/* Sidebar */}
        <aside
            className={[
            "sidebar",
            collapsed ? "sidebar--collapsed" : "",
            mobileOpen ? "sidebar--open" : "",
            ].join(" ")}
        >
            <div className="sb-top">
            <div className="sb-brand">
                <div className="sb-avatar" aria-hidden="true">
                {initials(user?.fullName)}
                <span className="sb-status" title="Activo" />
                </div>

                {!collapsed && (
                <div className="sb-brand__text">
                    <div className="sb-title">Arena System</div>
                    <div className="sb-subtitle">
                    {user?.fullName || "Usuario"} ·{" "}
                    <span className="sb-role">{user?.role || "Rol"}</span>
                    </div>
                </div>
                )}
            </div>

            <div className="sb-top__actions">
                <button
                className="icon-btn mobile-only"
                onClick={() => setMobileOpen(false)}
                title="Cerrar"
                aria-label="Cerrar menú"
                type="button"
                >
                <X size={18} />
                </button>

                <button
                className="icon-btn"
                onClick={() => setCollapsed((v) => !v)}
                title={collapsed ? "Expandir" : "Colapsar"}
                aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                type="button"
                >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>
            </div>

            {/* Search */}
            <div className="sb-search">
            <Search size={16} className="sb-search__icon" />
            <input
                className="sb-search__input"
                placeholder={collapsed ? "Buscar" : "Buscar módulo..."}
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />
            </div>

            {/* Nav */}
            <nav className="sb-nav">
            {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={linkClass}
                    data-tooltip={item.label}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                >
                    <span className="sb-link__left">
                    <span className="sb-ico">
                        <Icon size={18} />
                    </span>
                    <span className="sb-label">{item.label}</span>
                    </span>
                    <span className="sb-dot" />
                </NavLink>
                );
            })}

            {!filteredItems.length && (
                <div className="sb-empty">Sin resultados</div>
            )}
            </nav>

            {/* Footer */}
            <div className="sb-footer">
            <button className="sb-logout" onClick={onLogout} type="button">
                <LogOut size={18} />
                <span className="sb-label">Cerrar sesión</span>
            </button>

            {!collapsed && (
                <div className="sb-footnote">
                <span className="sb-footnote__pill">v1.0</span>
                <span className="sb-footnote__muted">Arenera Los Leones</span>
                </div>
            )}
            </div>
        </aside>

        {/* Main */}
        <main className="app-main">
            <header className="topbar">
            <button
                className="icon-btn mobile-only"
                onClick={() => setMobileOpen(true)}
                title="Menú"
                aria-label="Abrir menú"
                type="button"
            >
                <Menu size={18} />
            </button>

            <div className="topbar__title">Panel</div>

            <div className="topbar__right">
                <span className="topbar__user">
                {user?.fullName || "Usuario"}
                </span>
            </div>
            </header>

            <Outlet />
        </main>
        </div>
    );
    }