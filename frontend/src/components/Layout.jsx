    import { NavLink, Outlet, useNavigate } from "react-router-dom";
    import { getUser, logout } from "../services/auth";

    export default function Layout() {
    const nav = useNavigate();
    const user = getUser();

    const linkStyle = ({ isActive }) => ({
        padding: "8px 12px",
        borderRadius: 8,
        textDecoration: "none",
        color: isActive ? "white" : "black",
        background: isActive ? "black" : "transparent"
    });

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <header
            style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 14,
            borderBottom: "1px solid #ddd"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <b>Arena System</b>

            <nav style={{ display: "flex", gap: 8 }}>
                <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
                <NavLink to="/products" style={linkStyle}>Productos</NavLink>
            </nav>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13 }}>
                {user?.fullName} — {user?.role}
            </span>
            <button
                onClick={() => {
                logout();
                nav("/login");
                }}
                style={{ padding: "8px 12px", cursor: "pointer" }}
            >
                Cerrar sesión
            </button>
            </div>
        </header>

        <main style={{ padding: 16 }}>
            <Outlet />
        </main>
        </div>
    );
    }