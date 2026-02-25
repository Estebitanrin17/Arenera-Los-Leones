    import { useState } from "react";
    import { login } from "../services/auth";
    import { useNavigate } from "react-router-dom";

    export default function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState("dueno@empresa.com");
    const [password, setPassword] = useState("Admin123*");
    const [error, setError] = useState("");

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
        await login(email, password);
        nav("/dashboard");
        } catch (err) {
        setError(err?.response?.data?.message || "Error al iniciar sesión");
        }
    };

    return (
        <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "system-ui" }}>
        <h2>Iniciar sesión</h2>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label>
            Email
            <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
            </label>

            <label>
            Contraseña
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
            </label>

            {error && <div style={{ color: "crimson" }}>{error}</div>}

            <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
            Entrar
            </button>
        </form>
        </div>
    );
    }