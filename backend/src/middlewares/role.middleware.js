    export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user?.role) {
        return res.status(401).json({ ok: false, message: "No autenticado" });
        }
        if (!roles.includes(req.user.role)) {
        return res.status(403).json({ ok: false, message: "Sin permisos" });
        }
        next();
    };
    }