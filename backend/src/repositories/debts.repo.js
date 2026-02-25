    import { pool } from "../db/pool.js";

    export const debtsRepo = {
    async list({ employeeId, status }) {
        const where = [];
        const params = {};

        if (employeeId) { where.push("d.employee_id = :employeeId"); params.employeeId = employeeId; }
        if (status) { where.push("d.status = :status"); params.status = status; }

        const [rows] = await pool.query(
        `
        SELECT d.*, e.full_name AS employee_name
        FROM debts d
        JOIN employees e ON e.id = d.employee_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY d.id DESC
        `,
        params
        );
        return rows;
    },

    async getById(id) {
        const [rows] = await pool.query(
        `SELECT d.*, e.full_name AS employee_name
        FROM debts d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.id = :id LIMIT 1`,
        { id }
        );
        const debt = rows[0];
        if (!debt) return null;

        const [payments] = await pool.query(
        `SELECT * FROM debt_payments WHERE debt_id = :id ORDER BY id ASC`,
        { id }
        );

        return { ...debt, payments };
    }
    };