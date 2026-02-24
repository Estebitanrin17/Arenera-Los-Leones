    import { pool } from "../db/pool.js";

    export const expensesRepo = {
    // Categories
    async listCategories({ includeInactive = false }) {
        const [rows] = await pool.query(
        `SELECT id, name, is_active, created_at, updated_at
        FROM expense_categories
        ${includeInactive ? "" : "WHERE is_active = 1"}
        ORDER BY name ASC`
        );
        return rows;
    },

    async createCategory({ name }) {
        const [res] = await pool.query(
        `INSERT INTO expense_categories (name) VALUES (:name)`,
        { name }
        );
        return res.insertId;
    },

    async updateCategory(id, { name }) {
        const [res] = await pool.query(
        `UPDATE expense_categories SET name = :name WHERE id = :id`,
        { id, name }
        );
        return res.affectedRows;
    },

    async deactivateCategory(id) {
        const [res] = await pool.query(
        `UPDATE expense_categories SET is_active = 0 WHERE id = :id`,
        { id }
        );
        return res.affectedRows;
    },

    async reactivateCategory(id) {
        const [res] = await pool.query(
        `UPDATE expense_categories SET is_active = 1 WHERE id = :id`,
        { id }
        );
        return res.affectedRows;
    },

    async findCategoryById(id) {
        const [rows] = await pool.query(
        `SELECT id, name, is_active FROM expense_categories WHERE id = :id LIMIT 1`,
        { id }
        );
        return rows[0] || null;
    },

    // Expenses
    async listExpenses({ from, to, categoryId, includeInactive = false }) {
        const where = [];
        const params = {};

        if (!includeInactive) where.push("e.is_active = 1");
        if (from) { where.push("e.expense_date >= :from"); params.from = from; }
        if (to) { where.push("e.expense_date <= :to"); params.to = to; }
        if (categoryId) { where.push("e.category_id = :categoryId"); params.categoryId = categoryId; }

        const [rows] = await pool.query(
        `
        SELECT
            e.id, e.title, e.amount, e.expense_date, e.vendor, e.note, e.payment_method,
            e.category_id, c.name AS category_name,
            e.is_active, e.created_by, e.created_at, e.updated_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY e.expense_date DESC, e.id DESC
        LIMIT 500
        `,
        params
        );

        return rows;
    },

    async getExpenseById(id) {
        const [rows] = await pool.query(
        `
        SELECT
            e.id, e.title, e.amount, e.expense_date, e.vendor, e.note, e.payment_method,
            e.category_id, c.name AS category_name,
            e.is_active, e.created_by, e.created_at, e.updated_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE e.id = :id
        LIMIT 1
        `,
        { id }
        );
        return rows[0] || null;
    },

    async createExpense(data) {
        const [res] = await pool.query(
        `
        INSERT INTO expenses (category_id, title, amount, expense_date, vendor, note, payment_method, created_by)
        VALUES (:categoryId, :title, :amount, :expenseDate, :vendor, :note, :paymentMethod, :createdBy)
        `,
        {
            categoryId: data.categoryId ?? null,
            title: data.title,
            amount: data.amount,
            expenseDate: data.expenseDate,
            vendor: data.vendor ?? null,
            note: data.note ?? null,
            paymentMethod: data.paymentMethod,
            createdBy: data.createdBy ?? null
        }
        );
        return res.insertId;
    },

    async updateExpense(id, data) {
        const [res] = await pool.query(
        `
        UPDATE expenses
        SET category_id = :categoryId,
            title = :title,
            amount = :amount,
            expense_date = :expenseDate,
            vendor = :vendor,
            note = :note,
            payment_method = :paymentMethod
        WHERE id = :id
        `,
        {
            id,
            categoryId: data.categoryId ?? null,
            title: data.title,
            amount: data.amount,
            expenseDate: data.expenseDate,
            vendor: data.vendor ?? null,
            note: data.note ?? null,
            paymentMethod: data.paymentMethod
        }
        );
        return res.affectedRows;
    },

    async deactivateExpense(id) {
        const [res] = await pool.query(
        `UPDATE expenses SET is_active = 0 WHERE id = :id`,
        { id }
        );
        return res.affectedRows;
    },

    async reactivateExpense(id) {
        const [res] = await pool.query(
        `UPDATE expenses SET is_active = 1 WHERE id = :id`,
        { id }
        );
        return res.affectedRows;
    }
    };