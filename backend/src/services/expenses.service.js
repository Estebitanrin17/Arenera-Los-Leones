    import { expensesRepo } from "../repositories/expenses.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const expensesService = {
    // Categories
    async listCategories({ includeInactive }) {
        return expensesRepo.listCategories({ includeInactive });
    },

    async createCategory({ name }) {
        try {
        const id = await expensesRepo.createCategory({ name });
        return { id, name };
        } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") throw httpError(409, "La categoría ya existe");
        throw err;
        }
    },

    async updateCategory(id, { name }) {
        try {
        const affected = await expensesRepo.updateCategory(id, { name });
        if (!affected) throw httpError(404, "Categoría no encontrada");
        return expensesRepo.findCategoryById(id);
        } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") throw httpError(409, "La categoría ya existe");
        throw err;
        }
    },

    async deactivateCategory(id) {
        const affected = await expensesRepo.deactivateCategory(id);
        if (!affected) throw httpError(404, "Categoría no encontrada");
        return { ok: true };
    },

    async reactivateCategory(id) {
        const affected = await expensesRepo.reactivateCategory(id);
        if (!affected) throw httpError(404, "Categoría no encontrada");
        return { ok: true };
    },

    // Expenses
    async listExpenses(filters) {
        return expensesRepo.listExpenses(filters);
    },

    async getExpense(id) {
        const exp = await expensesRepo.getExpenseById(id);
        if (!exp) throw httpError(404, "Gasto no encontrado");
        return exp;
    },

    async createExpense(data) {
        // si mandan categoryId, validar que exista
        if (data.categoryId) {
        const cat = await expensesRepo.findCategoryById(data.categoryId);
        if (!cat || !cat.is_active) throw httpError(400, "categoryId inválido");
        }

        const id = await expensesRepo.createExpense(data);
        return expensesRepo.getExpenseById(id);
    },

    async updateExpense(id, data) {
        if (data.categoryId) {
        const cat = await expensesRepo.findCategoryById(data.categoryId);
        if (!cat || !cat.is_active) throw httpError(400, "categoryId inválido");
        }

        const affected = await expensesRepo.updateExpense(id, data);
        if (!affected) throw httpError(404, "Gasto no encontrado");
        return expensesRepo.getExpenseById(id);
    },

    async deactivateExpense(id) {
        const affected = await expensesRepo.deactivateExpense(id);
        if (!affected) throw httpError(404, "Gasto no encontrado");
        return { ok: true };
    },

    async reactivateExpense(id) {
        const affected = await expensesRepo.reactivateExpense(id);
        if (!affected) throw httpError(404, "Gasto no encontrado");
        return { ok: true };
    }
    };