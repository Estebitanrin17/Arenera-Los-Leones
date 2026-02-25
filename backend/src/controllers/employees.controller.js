    import { z } from "zod";
    import { employeesService } from "../services/employees.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const employeeSchema = z.object({
    full_name: z.string().min(2).max(120),
    document_id: z.string().max(30).optional(),
    phone: z.string().max(30).optional(),
    base_salary: z.preprocess(toNumber, z.number().min(0)).default(0),
    pay_frequency: z.enum(["DAILY","WEEKLY","BIWEEKLY","MONTHLY"]).default("MONTHLY")
    });

    export const employeesController = {
    async list(req, res, next) {
        try {
        const includeInactive = req.query.all === "1" || req.query.all === "true";
        const rows = await employeesService.list({ includeInactive });
        res.json({ ok: true, data: rows });
        } catch (e) { next(e); }
    },

    async get(req, res, next) {
        try {
        const id = Number(req.params.id);
        const emp = await employeesService.get(id);
        res.json({ ok: true, data: emp });
        } catch (e) { next(e); }
    },

    async create(req, res, next) {
        try {
        const data = employeeSchema.parse(req.body);
        const emp = await employeesService.create(data);
        res.status(201).json({ ok: true, data: emp });
        } catch (e) { next(e); }
    },

    async update(req, res, next) {
        try {
        const id = Number(req.params.id);
        const data = employeeSchema.parse(req.body);
        const emp = await employeesService.update(id, data);
        res.json({ ok: true, data: emp });
        } catch (e) { next(e); }
    },

    async deactivate(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await employeesService.deactivate(id);
        res.json(out);
        } catch (e) { next(e); }
    },

    async reactivate(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await employeesService.reactivate(id);
        res.json(out);
        } catch (e) { next(e); }
    }
    };