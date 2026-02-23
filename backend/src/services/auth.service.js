    import bcrypt from "bcrypt";
    import jwt from "jsonwebtoken";
    import { env } from "../config/env.js";
    import { authRepo } from "../repositories/auth.repo.js";

    function genOtp6() {
    return String(Math.floor(100000 + Math.random() * 900000));
    }

    export const authService = {
    async login({ email, password }) {
        const e = new Error("Credenciales inválidas");
            e.statusCode = 401;
            throw e;


        if (!user || !user.is_active) {
        const e = new Error("Credenciales inválidas");
        e.statusCode = 401;
        throw e;
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
        const e = new Error("Credenciales inválidas");
        e.statusCode = 401;
        throw e;
        }


        return {
        token,
        user: {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role
        }
        };
    },

    // DEV: devuelve el código en la respuesta (luego lo mandarás por correo/whatsapp)
    async forgot({ email }) {
        const user = await authRepo.findUserByEmail(email);
        if (!user) return { ok: true };

        const code = genOtp6();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await authRepo.createResetCode({ userId: user.id, codeHash, expiresAt });
        return { ok: true, devCode: code };
    },

    async verifyCode({ email, code }) {
        const user = await authRepo.findUserByEmail(email);
        if (!user) return { ok: false };

        const row = await authRepo.getLatestResetCode(user.id);
        if (!row) return { ok: false };
        if (row.used_at) return { ok: false };
        if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false };

        const ok = await bcrypt.compare(code, row.code_hash);
        return { ok };
    },

    async reset({ email, code, newPassword }) {
        const user = await authRepo.findUserByEmail(email);
        if (!user) throw new Error("No permitido");

        const row = await authRepo.getLatestResetCode(user.id);
        if (!row) throw new Error("Código inválido");
        if (row.used_at) throw new Error("Código usado");
        if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Código expirado");

        const ok = await bcrypt.compare(code, row.code_hash);
        if (!ok) throw new Error("Código inválido");

        const newHash = await bcrypt.hash(newPassword, 10);
        await authRepo.updatePassword(user.id, newHash);
        await authRepo.markResetUsed(row.id);

        return { ok: true };
    }
    };
