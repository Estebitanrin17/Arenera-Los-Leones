    import { pool } from "../db/pool.js";

    export const inventoryRepo = {
    async getStock(warehouseId) {
        const [rows] = await pool.query(
        `SELECT s.product_id, p.name, p.gramaje, p.unit, s.quantity
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.warehouse_id = :warehouseId
        ORDER BY p.name, p.gramaje`,
        { warehouseId }
        );
        return rows;
    }
    };