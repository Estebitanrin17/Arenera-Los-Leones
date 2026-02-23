    import { z } from "zod";
    import { productsService } from "../services/products.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const createSchema = z.object({
    name: z.string().min(2).max(120),
    gramaje: z.preprocess(toNumber, z.number().int().positive()),
    unit: z.string().min(1).max(20).optional().default("bulto"),
    price: z.preprocess(toNumber, z.number().min(0)).optional().default(0)
    });

    const updateSchema = createSchema;

    export const productsController = {
    async list(req, res, next) {
        try {
        const includeInactive = req.query.all === "1" || req.query.all === "true";
        const role = req.user.role;
        const rows = await productsService.list({ includeInactive, role });
        res.json({ ok: true, data: rows });
        } catch (e) {
        next(e);
        }
    },

    async getById(req, res, next) {
        try {
        const id = Number(req.params.id);
        const product = await productsService.getById(id, req.user.role);
        res.json({ ok: true, data: product });
        } catch (e) {
        next(e);
        }
    },

    async create(req, res, next) {
        try {
        const data = createSchema.parse(req.body);
        const product = await productsService.create(data);
        res.status(201).json({ ok: true, data: product });
        } catch (e) {
        next(e);
        }
    },

    async update(req, res, next) {
        try {
        const id = Number(req.params.id);
        const data = updateSchema.parse(req.body);
        const product = await productsService.update(id, data);
        res.json({ ok: true, data: product });
        } catch (e) {
        next(e);
        }
    },

    async remove(req, res, next) {
        try {
        const id = Number(req.params.id);
        const result = await productsService.remove(id);
        res.json(result);
        } catch (e) {
        next(e);
        }
    },

    async reactivate(req, res, next) {
        try {
        const id = Number(req.params.id);
        const result = await productsService.reactivate(id);
        res.json(result);
        } catch (e) {
        next(e);
        }
    }
    };