    import { productsRepo } from "../repositories/products.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const productsService = {
    async list({ includeInactive, role }) {
        if (includeInactive && role !== "OWNER") {
        throw httpError(403, "Sin permisos");
        }
        return productsRepo.list({ includeInactive });
    },

    async getById(id, role) {
        const product = await productsRepo.findById(id);
        if (!product) throw httpError(404, "Producto no encontrado");

        // Si está inactivo, solo OWNER lo puede ver
        if (!product.is_active && role !== "OWNER") {
        throw httpError(404, "Producto no encontrado");
        }

        return product;
    },

    async create(data) {
        try {
        const id = await productsRepo.create(data);
        return await productsRepo.findById(id);
        } catch (err) {
        // Duplicado por UNIQUE(name,gramaje)
        if (err?.code === "ER_DUP_ENTRY") throw httpError(409, "Ya existe un producto con ese nombre y gramaje");
        throw err;
        }
    },

    async update(id, data) {
        try {
        const affected = await productsRepo.update(id, data);
        if (!affected) throw httpError(404, "Producto no encontrado");
        return await productsRepo.findById(id);
        } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") throw httpError(409, "Ya existe un producto con ese nombre y gramaje");
        throw err;
        }
    },

    async remove(id) {
        const affected = await productsRepo.deactivate(id);
        if (!affected) throw httpError(404, "Producto no encontrado");
        return { ok: true };
    },

    async reactivate(id) {
        const affected = await productsRepo.reactivate(id);
        if (!affected) throw httpError(404, "Producto no encontrado");
        return { ok: true };
    }
    };