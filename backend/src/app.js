    import express from "express";
    import cors from "cors";
    import helmet from "helmet";
    import morgan from "morgan";
    import rateLimit from "express-rate-limit";
    import { ZodError } from "zod";

    import routes from "./routes/index.routes.js";
    import { env } from "./config/env.js";
    import { pool } from "./db/pool.js";

    const app = express();

    // 1) Parsers (ANTES de rutas)
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: true }));

    // 2) Seguridad / logs
    app.use(helmet());
    app.use(cors({ origin: env.corsOrigin, credentials: true }));
    app.use(morgan("dev"));
    app.use(rateLimit({ windowMs: 60 * 1000, limit: 120 }));

    // 3) Endpoints base (útiles para pruebas)
    app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "backend", time: new Date().toISOString() });
    });

    app.get("/api/health-db", async (_req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS ping");
        res.json({ ok: true, db: rows[0] });
    } catch (err) {
        next(err);
    }
    });

    // 4) Rutas principales
    app.use("/api", routes);

    // 5) Middleware de errores (SIEMPRE al final)
    app.use((err, _req, res, _next) => {
    console.error("ERROR:", err);

    if (err instanceof ZodError) {
        return res.status(400).json({
        ok: false,
        message: "Datos inválidos",
        issues: err.issues
        });
    }

    const status = err.statusCode || err.status || 500;
    return res.status(status).json({
        ok: false,
        message: err.message || "Error interno"
    });
    });

    export default app;
