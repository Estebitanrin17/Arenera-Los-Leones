    import { z } from "zod";
    import { expensesService } from "../services/expenses.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const categoryCreateSchema = z.object({
    name: z.string().min(2).max(120)
    });

    const expenseSchema = z.object({
    categoryId: z.preprocess(toNumber, z.number().int().positive()).optional(),
    title: z.string().min(2).max(160),
    amount: z.preprocess(toNumber, z.number().min(0.01)),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expenseDate debe ser YYYY-MM-DD"),
    vendor: z.string().max(120).optional(),
    note: z.string().max(255).optional(),
    paymentMethod: z.enum(["CASH","TRANSFER","CARD","OTHER"]).default("CASH")
    });

    export const expensesController = {
    // Categories
    async listCategories(req, res, next) {
        try {
        const includeInactive = req.query.all === "1" || req.query.all === "true";
        const rows = await expensesService.listCategories({ includeInactive });
        res.json({ ok: true, data: rows });
        } catch (e) { next(e); }
    },

    async createCategory(req, res, next) {
        try {
        const data = categoryCreateSchema.parse(req.body);
        const out = await expensesService.createCategory(data);
        res.status(201).json({ ok: true, data: out });
        } catch (e) { next(e); }
    },

    async updateCategory(req, res, next) {
        try {
        const id = Number(req.params.id);
        const data = categoryCreateSchema.parse(req.body);
        const out = await expensesService.updateCategory(id, data);
        res.json({ ok: true, data: out });
        } catch (e) { next(e); }
    },

    async deactivateCategory(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await expensesService.deactivateCategory(id);
        res.json(out);
        } catch (e) { next(e); }
    },

    async reactivateCategory(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await expensesService.reactivateCategory(id);
        res.json(out);
        } catch (e) { next(e); }
    },

    // Expenses
    async listExpenses(req, res, next) {
        try {
        const from = req.query.from; // YYYY-MM-DD
        const to = req.query.to;     // YYYY-MM-DD
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
        const includeInactive = req.query.all === "1" || req.query.all === "true";

        const rows = await expensesService.listExpenses({ from, to, categoryId, includeInactive });
        res.json({ ok: true, data: rows });
        } catch (e) { next(e); }
    },

    async getExpense(req, res, next) {
        try {
        const id = Number(req.params.id);
        const exp = await expensesService.getExpense(id);
        res.json({ ok: true, data: exp });
        } catch (e) { next(e); }
    },

    async createExpense(req, res, next) {
        try {
        const data = expenseSchema.parse(req.body);
        const exp = await expensesService.createExpense({ ...data, createdBy: req.user.sub });
        res.status(201).json({ ok: true, data: exp });
        } catch (e) { next(e); }
    },

    async updateExpense(req, res, next) {
        try {
        const id = Number(req.params.id);
        const data = expenseSchema.parse(req.body);
        const exp = await expensesService.updateExpense(id, data);
        res.json({ ok: true, data: exp });
        } catch (e) { next(e); }
    },

    async deactivateExpense(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await expensesService.deactivateExpense(id);
        res.json(out);
        } catch (e) { next(e); }
    },

    async reactivateExpense(req, res, next) {
        try {
        const id = Number(req.params.id);
        const out = await expensesService.reactivateExpense(id);
        res.json(out);
        } catch (e) { next(e); }
    }
    };