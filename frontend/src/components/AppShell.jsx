    import { NavLink, Outlet, useNavigate } from "react-router-dom";
    import { getUser, logout } from "../services/auth";

    export default function AppShell() {
    const user = getUser();
    const nav = useNavigate();

    const linkStyle = ({ isActive }) => ({
        display: "block",
        padding: "10px 12px",
        textDecoration: "none",
        color: isActive ? "white" : "black",
        background: isActive ? "black" : "transparent",
        borderRadius: 6,
        marginBottom: 6
    });

    const onLogout = () => {
        logout();
        nav("/login");
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui" }}>
        {/* Sidebar */}
        <aside style={{ width: 220, borderRight: "1px solid #ddd", padding: 12 }}>
            <div style={{ marginBottom: 12 }}>
            <b>Arena System</b>
            <div style={{ fontSize: 12, marginTop: 6 }}>
                {user?.fullName} — {user?.role}
            </div>
            </div>

            <nav>
            <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
            <NavLink to="/products" style={linkStyle}>Productos</NavLink>
            <NavLink to="/inventory" style={linkStyle}>Inventario</NavLink>
            <NavLink to="/sales" style={linkStyle}>Ventas</NavLink>
            <NavLink to="/expenses" style={linkStyle}>Gastos</NavLink>
            <NavLink to="/employees" style={linkStyle}>Empleados</NavLink>
            <NavLink to="/debts" style={linkStyle}>Deudas</NavLink>
            <NavLink to="/payroll" style={linkStyle}>Nómina</NavLink>
            <NavLink to="/reports" style={linkStyle}>Reportes</NavLink>
            </nav>

            <button onClick={onLogout} style={{ marginTop: 12, padding: 10, width: "100%", cursor: "pointer" }}>
            Cerrar sesión
            </button>
        </aside>

        {/* Contenido */}
        <main style={{ flex: 1, padding: 16 }}>
            <Outlet />
        </main>
        </div>
    );
    }