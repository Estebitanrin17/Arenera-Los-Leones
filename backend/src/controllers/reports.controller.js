    import { z } from "zod";
    import { reportsService } from "../services/reports.service.js";

    // ============ Schemas ============

    const salesExportSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from debe ser YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to debe ser YYYY-MM-DD"),
    status: z.enum(["OPEN", "PAID", "CANCELLED"]).optional()
    });

    const expensesExportSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from debe ser YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to debe ser YYYY-MM-DD"),
    categoryId: z.string().optional(),
    all: z.string().optional() // "1" o "true" para incluir inactivos
    });

    const inventorySchema = z.object({
    warehouseId: z.string().optional()
    });

    // ============ Controller ============

    export const reportsController = {
    // ------- Ventas -------
    async salesExcel(req, res, next) {
        try {
        const data = salesExportSchema.parse(req.query);

        const buffer = await reportsService.buildSalesExcel(data);
        const filename = `ventas_${data.from}_a_${data.to}.xlsx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer));
        } catch (e) {
        next(e);
        }
    },

    async salePdf(req, res, next) {
        try {
        const saleId = Number(req.params.id);
        if (!saleId || Number.isNaN(saleId)) {
            return res.status(400).json({ ok: false, message: "id inválido" });
        }
        await reportsService.streamSalePdf({ saleId, res });
        } catch (e) {
        next(e);
        }
    },

    // ------- Gastos -------
    async expensesExcel(req, res, next) {
        try {
        const q = expensesExportSchema.parse(req.query);
        const includeInactive = q.all === "1" || q.all === "true";
        const categoryId = q.categoryId ? Number(q.categoryId) : undefined;

        if (q.categoryId && (Number.isNaN(categoryId) || categoryId <= 0)) {
            return res.status(400).json({ ok: false, message: "categoryId inválido" });
        }

        const buffer = await reportsService.buildExpensesExcel({
            from: q.from,
            to: q.to,
            categoryId,
            includeInactive
        });

        const filename = `gastos_${q.from}_a_${q.to}.xlsx`;
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer));
        } catch (e) {
        next(e);
        }
    },

    async expensesPdf(req, res, next) {
        try {
        const q = expensesExportSchema.parse(req.query);
        const includeInactive = q.all === "1" || q.all === "true";
        const categoryId = q.categoryId ? Number(q.categoryId) : undefined;

        if (q.categoryId && (Number.isNaN(categoryId) || categoryId <= 0)) {
            return res.status(400).json({ ok: false, message: "categoryId inválido" });
        }

        await reportsService.streamExpensesPdf({
            from: q.from,
            to: q.to,
            categoryId,
            includeInactive,
            res
        });
        } catch (e) {
        next(e);
        }
    },

    // ------- Inventario -------
    async inventoryExcel(req, res, next) {
        try {
        const q = inventorySchema.parse(req.query);
        const warehouseId = q.warehouseId ? Number(q.warehouseId) : 1;

        if (!warehouseId || Number.isNaN(warehouseId) || warehouseId <= 0) {
            return res.status(400).json({ ok: false, message: "warehouseId inválido" });
        }

        const buffer = await reportsService.buildInventoryExcel({ warehouseId });
        const filename = `inventario_bodega-${warehouseId}.xlsx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer));
        } catch (e) {
        next(e);
        }
    },

    async inventoryPdf(req, res, next) {
        try {
        const q = inventorySchema.parse(req.query);
        const warehouseId = q.warehouseId ? Number(q.warehouseId) : 1;

        if (!warehouseId || Number.isNaN(warehouseId) || warehouseId <= 0) {
            return res.status(400).json({ ok: false, message: "warehouseId inválido" });
        }

        await reportsService.streamInventoryPdf({ warehouseId, res });
        } catch (e) {
        next(e);
        }
    }
    };