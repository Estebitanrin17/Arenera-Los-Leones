    import { z } from "zod";
    import { salesService } from "../services/sales.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const createSaleSchema = z.object({
    warehouseId: z.preprocess(toNumber, z.number().int().positive()).default(1),
    customerId: z.preprocess(toNumber, z.number().int().positive()).optional(),
    customerName: z.string().max(120).optional(),
    customerPhone: z.string().max(30).optional(),
    discount: z.preprocess(toNumber, z.number().min(0)).optional().default(0),
    note: z.string().max(255).optional(),
    items: z.array(z.object({
        productId: z.preprocess(toNumber, z.number().int().positive()),
        quantity: z.preprocess(toNumber, z.number().int().positive()),
        unitPrice: z.preprocess(toNumber, z.number().min(0)).optional()
    })).min(1)
    });

    const paymentSchema = z.object({
    amount: z.preprocess(toNumber, z.number().min(0.01)),
    method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).default("CASH"),
    note: z.string().max(255).optional()
    });

    const refundSchema = z.object({
    amount: z.preprocess(toNumber, z.number().min(0.01)),
    method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).default("CASH"),
    note: z.string().max(255).optional()
    });

    export const salesController = {
    async list(req, res, next) {
        try {
        const status = req.query.status;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;
        const rows = await salesService.list({ status, dateFrom, dateTo });
        res.json({ ok: true, data: rows });
        } catch (e) { next(e); }
    },

    async get(req, res, next) {
        try {
        const id = Number(req.params.id);
        const sale = await salesService.get(id);
        res.json({ ok: true, data: sale });
        } catch (e) { next(e); }
    },

    async create(req, res, next) {
        try {
        const data = createSaleSchema.parse(req.body);
        const sale = await salesService.createSale({ ...data, createdBy: req.user.sub });
        res.status(201).json({ ok: true, data: sale });
        } catch (e) { next(e); }
    },

    async addPayment(req, res, next) {
        try {
        const saleId = Number(req.params.id);
        const data = paymentSchema.parse(req.body);
        const sale = await salesService.addPayment({ saleId, ...data, createdBy: req.user.sub });
        res.json({ ok: true, data: sale });
        } catch (e) { next(e); }
    },

    async addRefund(req, res, next) {
        try {
        const saleId = Number(req.params.id);
        const data = refundSchema.parse(req.body);
        const sale = await salesService.addRefund({ saleId, ...data, createdBy: req.user.sub });
        res.json({ ok: true, data: sale });
        } catch (e) { next(e); }
    },

    async cancel(req, res, next) {
        try {
        const saleId = Number(req.params.id);
        const sale = await salesService.cancelSale({ saleId, createdBy: req.user.sub });
        res.json({ ok: true, data: sale });
        } catch (e) { next(e); }
    }
    };