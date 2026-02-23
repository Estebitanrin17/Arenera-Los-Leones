    import { pool } from "../db/pool.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const inventoryService = {
    async listStock({ warehouseId }) {
        const [rows] = await pool.query(
        `SELECT s.product_id, p.name, p.gramaje, p.unit, s.quantity
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.warehouse_id = :warehouseId
        ORDER BY p.name, p.gramaje`,
        { warehouseId }
        );
        return rows;
    },

    async createMovement({ warehouseId, productId, type, quantity, note, createdBy }) {
        if (quantity <= 0) throw httpError(400, "quantity debe ser > 0");

        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();

        // Bloquea la fila de stock para evitar carreras
        const [stockRows] = await conn.query(
            `SELECT quantity
            FROM stock
            WHERE warehouse_id = :warehouseId AND product_id = :productId
            FOR UPDATE`,
            { warehouseId, productId }
        );

        const currentQty = stockRows[0]?.quantity ?? 0;

        let newQty = currentQty;
        if (type === "IN") newQty = currentQty + quantity;
        if (type === "OUT") newQty = currentQty - quantity;
        if (type === "ADJUST") newQty = quantity; // ajuste = set cantidad exacta

        if (newQty < 0) throw httpError(409, "Stock insuficiente");

        // Upsert stock
        await conn.query(
            `INSERT INTO stock (warehouse_id, product_id, quantity)
            VALUES (:warehouseId, :productId, :newQty)
            ON DUPLICATE KEY UPDATE quantity = :newQty`,
            { warehouseId, productId, newQty }
        );

        // Insert movimiento
        await conn.query(
            `INSERT INTO stock_movements (warehouse_id, product_id, type, quantity, note, created_by)
            VALUES (:warehouseId, :productId, :type, :quantity, :note, :createdBy)`,
            { warehouseId, productId, type, quantity, note: note ?? null, createdBy: createdBy ?? null }
        );

        await conn.commit();
        return { ok: true, previousQty: currentQty, newQty };
        } catch (err) {
        await conn.rollback();
        throw err;
        } finally {
        conn.release();
        }
    }
    };