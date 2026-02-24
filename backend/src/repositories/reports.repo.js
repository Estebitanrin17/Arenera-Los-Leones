    // ... tus imports y exports existentes
    import { pool } from "../db/pool.js";

    export const reportsRepo = {
    // ====== YA TENÍAS ESTO (ventas) ======
    async salesSummary({ from, to, status }) {
        const where = ["s.created_at >= :from", "s.created_at <= :to"];
        const params = { from, to };

        if (status) {
        where.push("s.status = :status");
        params.status = status;
        }

        const [rows] = await pool.query(
        `
        SELECT
            s.id,
            s.status,
            s.warehouse_id,
            s.customer_name,
            s.customer_phone,
            s.subtotal,
            s.discount,
            s.total,
            s.created_by,
            s.created_at,
            (SELECT COALESCE(SUM(amount),0) FROM sale_payments sp WHERE sp.sale_id = s.id) AS paid,
            (SELECT COALESCE(SUM(amount),0) FROM sale_refunds sr WHERE sr.sale_id = s.id) AS refunded
        FROM sales s
        WHERE ${where.join(" AND ")}
        ORDER BY s.id DESC
        `,
        params
        );

        return rows;
    },

    async salesItems({ from, to, status }) {
        const where = ["s.created_at >= :from", "s.created_at <= :to"];
        const params = { from, to };

        if (status) {
        where.push("s.status = :status");
        params.status = status;
        }

        const [rows] = await pool.query(
        `
        SELECT
            s.id AS sale_id,
            s.created_at,
            s.status,
            si.product_id,
            si.product_name,
            si.gramaje,
            si.unit,
            si.unit_price,
            si.quantity,
            si.line_total
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE ${where.join(" AND ")}
        ORDER BY s.id DESC, si.id ASC
        `,
        params
        );

        return rows;
    },

    // ====== NUEVO: GASTOS ======

    async expensesRows({ from, to, categoryId, includeInactive = false }) {
        const where = ["e.expense_date >= :from", "e.expense_date <= :to"];
        const params = { from, to };

        if (!includeInactive) where.push("e.is_active = 1");
        if (categoryId) {
        where.push("e.category_id = :categoryId");
        params.categoryId = categoryId;
        }

        const [rows] = await pool.query(
        `
        SELECT
            e.id,
            e.expense_date,
            e.title,
            e.vendor,
            e.payment_method,
            e.amount,
            e.note,
            e.category_id,
            c.name AS category_name,
            e.is_active,
            e.created_by,
            e.created_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE ${where.join(" AND ")}
        ORDER BY e.expense_date DESC, e.id DESC
        `,
        params
        );

        return rows;
    },


        async inventoryStockRows({ warehouseId }) {
    const [rows] = await pool.query(
        `
        SELECT
        p.id AS product_id,
        p.name,
        p.gramaje,
        p.unit,
        p.price,
        COALESCE(s.quantity, 0) AS quantity
        FROM products p
        LEFT JOIN stock s
        ON s.product_id = p.id AND s.warehouse_id = :warehouseId
        WHERE p.is_active = 1
        ORDER BY p.name ASC, p.gramaje ASC
        `,
        { warehouseId }
    );
    return rows;
    },

    async inventoryTotals({ warehouseId }) {
    const [rows] = await pool.query(
        `
        SELECT
        COALESCE(SUM(COALESCE(s.quantity,0)),0) AS total_units,
        COUNT(*) AS total_products
        FROM products p
        LEFT JOIN stock s
        ON s.product_id = p.id AND s.warehouse_id = :warehouseId
        WHERE p.is_active = 1
        `,
        { warehouseId }
    );
    return rows[0];
    },
    

    async expensesSummaryByCategory({ from, to, includeInactive = false }) {
        const where = ["e.expense_date >= :from", "e.expense_date <= :to"];
        const params = { from, to };

        if (!includeInactive) where.push("e.is_active = 1");

        const [rows] = await pool.query(
        `
        SELECT
            COALESCE(c.name, 'Sin categoría') AS category_name,
            COUNT(*) AS count_expenses,
            COALESCE(SUM(e.amount),0) AS total_amount
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE ${where.join(" AND ")}
        GROUP BY category_name
        ORDER BY total_amount DESC
        `,
        params
        );

        return rows;
    }
    };


