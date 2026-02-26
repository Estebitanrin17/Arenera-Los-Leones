    import { useState } from "react";
    import { login } from "../services/auth";
    import { useNavigate } from "react-router-dom";
    import "./login.css";

    export default function Login() {
    const nav = useNavigate();

    // ⚠️ en producción deja esto vacío
    const [email, setEmail] = useState("dueno@empresa.com");
    const [password, setPassword] = useState("Admin123*");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
        await login(email, password);
        nav("/dashboard");
        } catch (err) {
        setError(err?.response?.data?.message || "Error al iniciar sesión");
        } finally {
        setLoading(false);
        }
    };

    return (
        <div className="login-page">
        {/* Fondo animado */}
        <div className="login-bg" aria-hidden="true">
            <span className="blob b1" />
            <span className="blob b2" />
            <span className="blob b3" />
            <span className="grid" />
        </div>

        <div className="login-wrap">
            <div className="login-card">
            <div className="login-brand">
                <div className="logo">AS</div>
                <div>
                <div className="title">Arena System</div>
                <div className="subtitle">Inicia sesión para continuar</div>
                </div>
            </div>

            <form onSubmit={onSubmit} className="form">
                <label className="field">
                <span>Email</span>
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="correo@empresa.com"
                />
                </label>

                <label className="field">
                <span>Contraseña</span>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    autoComplete="current-password"
                    placeholder="••••••••"
                />
                </label>

                {error && <div className="alert alert--error">{error}</div>}

                <button className="btn" type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
                </button>

                <div className="foot">
                <span className="muted">© {new Date().getFullYear()} Arenera Los Leones</span>
                </div>
            </form>
            </div>

            {/* mini texto lateral tipo “facebook” */}
            <div className="login-side">
            <h1>Arena System</h1>
            <p>
                Controla inventario, ventas, gastos y reportes de forma clara y rápida.
            </p>
            </div>
        </div>
        </div>
    );
    }