    import { pool } from "../db/pool.js";

    export const productsRepo = {
    async list({ includeInactive = false }) {
        const [rows] = await pool.query(
        `SELECT id, name, gramaje, unit, price, is_active, created_at, updated_at
        FROM products
        ${includeInactive ? "" : "WHERE is_active = 1"}
        ORDER BY name ASC, gramaje ASC`
        );
        return rows;
    },

    async findById(id) {
        const [rows] = await pool.query(
        `SELECT id, name, gramaje, unit, price, is_active, created_at, updated_at
        FROM products
        WHERE id = :id
        LIMIT 1`,
        { id }
        );
        return rows[0] || null;
    },

    async create({ name, gramaje, unit, price }) {
        const [result] = await pool.query(
        `INSERT INTO products (name, gramaje, unit, price)
        VALUES (:name, :gramaje, :unit, :price)`,
        { name, gramaje, unit, price }
        );
        return result.insertId;
    },

    async update(id, { name, gramaje, unit, price }) {
        const [result] = await pool.query(
        `UPDATE products
        SET name = :name, gramaje = :gramaje, unit = :unit, price = :price
        WHERE id = :id`,
        { id, name, gramaje, unit, price }
        );
        return result.affectedRows;
    },

    async deactivate(id) {
        const [result] = await pool.query(
        `UPDATE products SET is_active = 0 WHERE id = :id`,
        { id }
        );
        return result.affectedRows;
    },

    async reactivate(id) {
        const [result] = await pool.query(
        `UPDATE products SET is_active = 1 WHERE id = :id`,
        { id }
        );
        return result.affectedRows;
    }
    };