    import { pool } from "../db/pool.js";
    import { salesRepo } from "../repositories/sales.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const salesService = {
    async list(filters) {
        return salesRepo.list(filters);
    },

    async get(id) {
        const sale = await salesRepo.getById(id);
        if (!sale) throw httpError(404, "Venta no encontrada");
        return sale;
    },

    async createSale({ warehouseId, customerId, customerName, customerPhone, discount, note, items, createdBy }) {
        if (!items?.length) throw httpError(400, "La venta debe tener items");

        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();

        // 1) Crear venta en OPEN con totales 0 (los actualizamos al final)
        const [saleRes] = await conn.query(
            `INSERT INTO sales (warehouse_id, customer_id, customer_name, customer_phone, discount, note, created_by)
            VALUES (:warehouseId, :customerId, :customerName, :customerPhone, :discount, :note, :createdBy)`,
            {
            warehouseId,
            customerId: customerId ?? null,
            customerName: customerName ?? null,
            customerPhone: customerPhone ?? null,
            discount: discount ?? 0,
            note: note ?? null,
            createdBy: createdBy ?? null
            }
        );
        const saleId = saleRes.insertId;

        // 2) Para cada item: validar producto, bloquear stock, descontar, registrar movimiento, insertar item
        let subtotal = 0;

        for (const it of items) {
            const productId = Number(it.productId);
            const qty = Number(it.quantity);
            if (!productId || qty <= 0) throw httpError(400, "Item inválido");

            // Producto (snapshot)
            const [pRows] = await conn.query(
            `SELECT id, name, gramaje, unit, price, is_active
            FROM products
            WHERE id = :productId
            LIMIT 1`,
            { productId }
            );
            const p = pRows[0];
            if (!p || !p.is_active) throw httpError(400, `Producto inválido: ${productId}`);

            const unitPrice = it.unitPrice != null ? Number(it.unitPrice) : Number(p.price);
            if (Number.isNaN(unitPrice) || unitPrice < 0) throw httpError(400, "unitPrice inválido");

            // Bloquear stock fila
            const [sRows] = await conn.query(
            `SELECT quantity
            FROM stock
            WHERE warehouse_id = :warehouseId AND product_id = :productId
            FOR UPDATE`,
            { warehouseId, productId }
            );
            const currentQty = sRows[0]?.quantity ?? 0;
            const newQty = currentQty - qty;
            if (newQty < 0) throw httpError(409, `Stock insuficiente para ${p.name} ${p.gramaje}`);

            // Update stock (upsert)
            await conn.query(
            `INSERT INTO stock (warehouse_id, product_id, quantity)
            VALUES (:warehouseId, :productId, :newQty)
            ON DUPLICATE KEY UPDATE quantity = :newQty`,
            { warehouseId, productId, newQty }
            );

            // Movimiento OUT
            await conn.query(
            `INSERT INTO stock_movements (warehouse_id, product_id, type, quantity, note, created_by)
            VALUES (:warehouseId, :productId, 'OUT', :qty, :note, :createdBy)`,
            {
                warehouseId,
                productId,
                qty,
                note: `Venta #${saleId}`,
                createdBy: createdBy ?? null
            }
            );

            // Item
            const lineTotal = unitPrice * qty;
            subtotal += lineTotal;

            await conn.query(
            `INSERT INTO sale_items (sale_id, product_id, product_name, gramaje, unit, unit_price, quantity, line_total)
            VALUES (:saleId, :productId, :productName, :gramaje, :unit, :unitPrice, :qty, :lineTotal)`,
            {
                saleId,
                productId,
                productName: p.name,
                gramaje: p.gramaje,
                unit: p.unit,
                unitPrice,
                qty,
                lineTotal
            }
            );
        }

        const disc = Number(discount ?? 0);
        const total = Math.max(0, subtotal - disc);

        // 3) Actualizar totales
        await conn.query(
            `UPDATE sales SET subtotal = :subtotal, total = :total WHERE id = :saleId`,
            { subtotal, total, saleId }
        );

        await conn.commit();
        return await salesRepo.getById(saleId);
        } catch (err) {
        await conn.rollback();
        throw err;
        } finally {
        conn.release();
        }
    },

    async addPayment({ saleId, amount, method, note, createdBy }) {
        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();

        const [sRows] = await conn.query(`SELECT id, status, total FROM sales WHERE id = :saleId FOR UPDATE`, { saleId });
        const sale = sRows[0];
        if (!sale) throw httpError(404, "Venta no encontrada");
        if (sale.status === "CANCELLED") throw httpError(409, "La venta está cancelada");

        const amt = Number(amount);
        if (Number.isNaN(amt) || amt <= 0) throw httpError(400, "amount inválido");

        await conn.query(
            `INSERT INTO sale_payments (sale_id, amount, method, note, created_by)
            VALUES (:saleId, :amount, :method, :note, :createdBy)`,
            { saleId, amount: amt, method, note: note ?? null, createdBy: createdBy ?? null }
        );

        const [pRows] = await conn.query(
            `SELECT COALESCE(SUM(amount),0) AS paid FROM sale_payments WHERE sale_id = :saleId`,
            { saleId }
        );
        const paid = Number(pRows[0].paid);
        const newStatus = paid >= Number(sale.total) ? "PAID" : "OPEN";

        await conn.query(`UPDATE sales SET status = :status WHERE id = :saleId`, { status: newStatus, saleId });

        await conn.commit();
        return await salesRepo.getById(saleId);
        } catch (err) {
        await conn.rollback();
        throw err;
        } finally {
        conn.release();
        }
    },

    async cancelSale({ saleId, createdBy }) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [sRows] = await conn.query(
        `SELECT id, status, warehouse_id FROM sales WHERE id = :saleId FOR UPDATE`,
        { saleId }
        );
        const sale = sRows[0];
        if (!sale) throw httpError(404, "Venta no encontrada");
        if (sale.status === "CANCELLED") throw httpError(409, "Ya está cancelada");

        // ✅ NO permitir cancelar si hay pagos
        const [pRows] = await conn.query(
        `SELECT COALESCE(SUM(amount),0) AS paid
        FROM sale_payments
        WHERE sale_id = :saleId`,
        { saleId }
        );
        const paid = Number(pRows[0].paid);
        if (paid > 0) {
        throw httpError(409, "No se puede cancelar: la venta tiene pagos. Registra un reembolso/anulación de pago primero.");
        }

        const [items] = await conn.query(
        `SELECT product_id, quantity FROM sale_items WHERE sale_id = :saleId`,
        { saleId }
        );

        // ... (tu lógica de devolver stock IN y set status CANCELLED)

        await conn.commit();
        return await salesRepo.getById(saleId);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    }
    };