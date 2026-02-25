    import { api } from "./api";

    export async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    // backend devuelve { ok, token, user }
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
    }

    export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    }

    export function getUser() {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
    }

    export function isLoggedIn() {
    return !!localStorage.getItem("token");
    }