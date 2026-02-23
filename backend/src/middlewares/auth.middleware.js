import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

    export function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ ok: false, message: "No token" });

    try {
        req.user = jwt.verify(token, env.jwtSecret);
        next();
    } catch {
        return res.status(401).json({ ok: false, message: "Token inválido" });
    }
    }