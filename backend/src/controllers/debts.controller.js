    import { z } from "zod";
    import { debtsService } from "../services/debts.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const createDebtSchema = z.object({
    employeeId: z.preprocess(toNumber, z.number().int().positive()),
    type: z.enum(["ADVANCE","LOAN","OTHER"]).default("ADVANCE"),
    amount: z.preprocess(toNumber, z.number().min(0.01)),
    note: z.string().max(255).optional()
    });

    const paymentSchema = z.object({
    amount: z.preprocess(toNumber, z.number().min(0.01)),
    method: z.enum(["CASH","TRANSFER","PAYROLL","OTHER"]).default("PAYROLL"),
    note: z.string().max(255).optional()
    });

    export const debtsController = {
    async list(req, res, next) {
        try {
        const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
        const status = req.query.status;
        const rows = await debtsService.list({ employeeId, status });
        res.json({ ok: true, data: rows });
        } catch (e) { next(e); }
    },

    async get(req, res, next) {
        try {
        const id = Number(req.params.id);
        const d = await debtsService.get(id);
        res.json({ ok: true, data: d });
        } catch (e) { next(e); }
    },

    async create(req, res, next) {
        try {
        const data = createDebtSchema.parse(req.body);
        const d = await debtsService.createDebt({ ...data, createdBy: req.user.sub });
        res.status(201).json({ ok: true, data: d });
        } catch (e) { next(e); }
    },

    async addPayment(req, res, next) {
        try {
        const debtId = Number(req.params.id);
        const data = paymentSchema.parse(req.body);
        const d = await debtsService.addPayment({ debtId, ...data, createdBy: req.user.sub });
        res.json({ ok: true, data: d });
        } catch (e) { next(e); }
    }
    };