    import { pool } from "../db/pool.js";

    export const employeesRepo = {
    async list({ includeInactive = false }) {
        const [rows] = await pool.query(
        `SELECT id, full_name, document_id, phone, base_salary, pay_frequency, is_active, created_at, updated_at
        FROM employees
        ${includeInactive ? "" : "WHERE is_active = 1"}
        ORDER BY full_name ASC`
        );
        return rows;
    },

    async findById(id) {
        const [rows] = await pool.query(
        `SELECT id, full_name, document_id, phone, base_salary, pay_frequency, is_active, created_at, updated_at
        FROM employees WHERE id = :id LIMIT 1`,
        { id }
        );
        return rows[0] || null;
    },

    async create(data) {
        const [res] = await pool.query(
        `INSERT INTO employees (full_name, document_id, phone, base_salary, pay_frequency)
        VALUES (:full_name, :document_id, :phone, :base_salary, :pay_frequency)`,
        data
        );
        return res.insertId;
    },

    async update(id, data) {
        const [res] = await pool.query(
        `UPDATE employees
        SET full_name = :full_name,
            document_id = :document_id,
            phone = :phone,
            base_salary = :base_salary,
            pay_frequency = :pay_frequency
        WHERE id = :id`,
        { id, ...data }
        );
        return res.affectedRows;
    },

    async deactivate(id) {
        const [res] = await pool.query(`UPDATE employees SET is_active = 0 WHERE id = :id`, { id });
        return res.affectedRows;
    },

    async reactivate(id) {
        const [res] = await pool.query(`UPDATE employees SET is_active = 1 WHERE id = :id`, { id });
        return res.affectedRows;
    }
    };