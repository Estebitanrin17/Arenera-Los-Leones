    import { pool } from "../db/pool.js";

    export const salesRepo = {
    async list({ status, dateFrom, dateTo }) {
        const where = [];
        const params = {};

        if (status) {
        where.push("s.status = :status");
        params.status = status;
        }
        if (dateFrom) {
        where.push("s.created_at >= :dateFrom");
        params.dateFrom = dateFrom;
        }
        if (dateTo) {
        where.push("s.created_at <= :dateTo");
        params.dateTo = dateTo;
        }

        const sql = `
        SELECT s.id, s.status, s.subtotal, s.discount, s.total, s.customer_name, s.created_at
        FROM sales s
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY s.id DESC
        LIMIT 200
        `;

        const [rows] = await pool.query(sql, params);
        return rows;
    },

    async getById(id) {
        const [salesRows] = await pool.query(
        `SELECT * FROM sales WHERE id = :id LIMIT 1`,
        { id }
        );

        const sale = salesRows[0];
        if (!sale) return null;

        const [items] = await pool.query(
        `SELECT * FROM sale_items WHERE sale_id = :id ORDER BY id ASC`,
        { id }
        );

        const [payments] = await pool.query(
        `SELECT * FROM sale_payments WHERE sale_id = :id ORDER BY id ASC`,
        { id }
        );

        const [refunds] = await pool.query(
        `SELECT * FROM sale_refunds WHERE sale_id = :id ORDER BY id ASC`,
        { id }
        );

        return { ...sale, items, payments, refunds };
    }
    };