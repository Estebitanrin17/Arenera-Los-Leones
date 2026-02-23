    import { z } from "zod";
    import { authService } from "../services/auth.service.js";

    const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
    });

    const forgotSchema = z.object({
    email: z.string().email()
    });

    const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().min(4).max(10)
    });

    const resetSchema = z.object({
    email: z.string().email(),
    code: z.string().min(4).max(10),
    newPassword: z.string().min(6)
    });

    export const authController = {
    async login(req, res, next) {
        try {
        const data = loginSchema.parse(req.body);
        const result = await authService.login(data);
        res.json({ ok: true, ...result });
        } catch (e) {
        next(e);
        }
    },

    async forgot(req, res, next) {
        try {
        const data = forgotSchema.parse(req.body);
        const result = await authService.forgot(data);
        res.json(result);
        } catch (e) {
        next(e);
        }
    },

    async verifyCode(req, res, next) {
        try {
        const data = verifySchema.parse(req.body);
        const result = await authService.verifyCode(data);
        res.json(result);
        } catch (e) {
        next(e);
        }
    },

    async reset(req, res, next) {
        try {
        const data = resetSchema.parse(req.body);
        const result = await authService.reset(data);
        res.json(result);
        } catch (e) {
        next(e);
        }
    }
    };
