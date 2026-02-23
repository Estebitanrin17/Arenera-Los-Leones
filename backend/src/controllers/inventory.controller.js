    import { z } from "zod";
    import { inventoryService } from "../services/inventory.service.js";

    const toNumber = (v) => (typeof v === "string" ? Number(v) : v);

    const movementSchema = z.object({
    warehouseId: z.preprocess(toNumber, z.number().int().positive()).default(1),
    productId: z.preprocess(toNumber, z.number().int().positive()),
    type: z.enum(["IN", "OUT", "ADJUST"]),
    quantity: z.preprocess(toNumber, z.number().int().positive()),
    note: z.string().max(255).optional()
    });

    export const inventoryController = {
    async stock(req, res, next) {
    try {
        const raw = req.query.warehouseId;
        const warehouseId = raw ? Number(raw) : 1;

        if (Number.isNaN(warehouseId) || warehouseId <= 0) {
        return res.status(400).json({ ok: false, message: "warehouseId inválido" });
        }

        const rows = await inventoryService.listStock({ warehouseId });
        res.json({ ok: true, data: rows });
    } catch (e) {
        next(e);
    }
    },

    async movement(req, res, next) {
        try {
        const data = movementSchema.parse(req.body);
        const result = await inventoryService.createMovement({
            ...data,
            createdBy: req.user.sub
        });
        res.status(201).json(result);
        } catch (e) {
        next(e);
        }
    }
    };