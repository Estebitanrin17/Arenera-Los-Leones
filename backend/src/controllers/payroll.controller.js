    import { z } from "zod";
    import { payrollService } from "../services/payroll.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const runSchema = z.object({
    periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(255).optional(),
    employees: z.array(z.object({
        employeeId: z.preprocess(toNumber, z.number().int().positive()),
        grossAmount: z.preprocess(toNumber, z.number().min(0))
    })).optional()
    });

    export const payrollController = {
    async run(req, res, next) {
        try {
        const data = runSchema.parse(req.body);
        const out = await payrollService.runPayroll({ ...data, createdBy: req.user.sub });
        res.status(201).json({ ok: true, data: out });
        } catch (e) { next(e); }
    }
    };