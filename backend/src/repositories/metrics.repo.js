    import { pool } from "../db/pool.js";

    export const metricsRepo = {
    async overview({ warehouseId }) {
        const [salesTodayRows] = await pool.query(
        `
        SELECT COUNT(*) AS count_sales, COALESCE(SUM(s.total),0) AS total_sales
        FROM sales s
        WHERE DATE(s.created_at) = CURDATE()
            AND s.status <> 'CANCELLED'
        `
        );

        const [salesTodayPaid] = await pool.query(
        `
        SELECT
            COALESCE(SUM(sp.amount),0) AS paid,
            COALESCE(SUM(sr.amount),0) AS refunded
        FROM sales s
        LEFT JOIN sale_payments sp ON sp.sale_id = s.id
        LEFT JOIN sale_refunds sr ON sr.sale_id = s.id
        WHERE DATE(s.created_at) = CURDATE()
            AND s.status <> 'CANCELLED'
        `
        );

        const [salesMonthRows] = await pool.query(
        `
        SELECT COUNT(*) AS count_sales, COALESCE(SUM(s.total),0) AS total_sales
        FROM sales s
        WHERE s.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND s.status <> 'CANCELLED'
        `
        );

        const [salesMonthPaid] = await pool.query(
        `
        SELECT
            COALESCE(SUM(sp.amount),0) AS paid,
            COALESCE(SUM(sr.amount),0) AS refunded
        FROM sales s
        LEFT JOIN sale_payments sp ON sp.sale_id = s.id
        LEFT JOIN sale_refunds sr ON sr.sale_id = s.id
        WHERE s.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND s.status <> 'CANCELLED'
        `
        );

        const [openReceivableRows] = await pool.query(
        `
        SELECT
            COALESCE(SUM(s.total),0) AS open_total,
            COALESCE(SUM(paid.paid),0) AS paid,
            COALESCE(SUM(ref.refunded),0) AS refunded
        FROM sales s
        LEFT JOIN (
            SELECT sale_id, COALESCE(SUM(amount),0) AS paid
            FROM sale_payments
            GROUP BY sale_id
        ) paid ON paid.sale_id = s.id
        LEFT JOIN (
            SELECT sale_id, COALESCE(SUM(amount),0) AS refunded
            FROM sale_refunds
            GROUP BY sale_id
        ) ref ON ref.sale_id = s.id
        WHERE s.status = 'OPEN'
        `
        );

        const [expensesMonthRows] = await pool.query(
        `
        SELECT COUNT(*) AS count_expenses, COALESCE(SUM(e.amount),0) AS total_expenses
        FROM expenses e
        WHERE e.expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND e.is_active = 1
        `
        );

        const [debtsOpenRows] = await pool.query(
        `
        SELECT COUNT(*) AS count_debts, COALESCE(SUM(balance),0) AS total_balance
        FROM debts
        WHERE status = 'OPEN'
        `
        );

        const [invTotalsRows] = await pool.query(
        `
        SELECT
            COALESCE(SUM(s.quantity),0) AS total_units,
            COALESCE(SUM(s.quantity * p.price),0) AS total_value
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.warehouse_id = :warehouseId
            AND p.is_active = 1
        `,
        { warehouseId }
        );

        const [lowStockRows] = await pool.query(
        `
        SELECT
            p.id AS product_id,
            p.name,
            p.gramaje,
            p.unit,
            COALESCE(s.quantity,0) AS quantity
        FROM products p
        LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = :warehouseId
        WHERE p.is_active = 1
        ORDER BY COALESCE(s.quantity,0) ASC, p.name ASC
        LIMIT 10
        `,
        { warehouseId }
        );

        const [recentSalesRows] = await pool.query(
        `
        SELECT id, status, customer_name, total, created_at
        FROM sales
        ORDER BY id DESC
        LIMIT 10
        `
        );

        return {
        salesToday: {
            count: Number(salesTodayRows[0].count_sales),
            total: Number(salesTodayRows[0].total_sales),
            paid: Number(salesTodayPaid[0].paid),
            refunded: Number(salesTodayPaid[0].refunded)
        },
        salesMonth: {
            count: Number(salesMonthRows[0].count_sales),
            total: Number(salesMonthRows[0].total_sales),
            paid: Number(salesMonthPaid[0].paid),
            refunded: Number(salesMonthPaid[0].refunded)
        },
        openReceivable: {
            openTotal: Number(openReceivableRows[0].open_total),
            paid: Number(openReceivableRows[0].paid),
            refunded: Number(openReceivableRows[0].refunded)
        },
        expensesMonth: {
            count: Number(expensesMonthRows[0].count_expenses),
            total: Number(expensesMonthRows[0].total_expenses)
        },
        debtsOpen: {
            count: Number(debtsOpenRows[0].count_debts),
            balance: Number(debtsOpenRows[0].total_balance)
        },
        inventory: {
            warehouseId: Number(warehouseId),
            totalUnits: Number(invTotalsRows[0].total_units),
            totalValue: Number(invTotalsRows[0].total_value),
            lowStock: lowStockRows
        },
        recentSales: recentSalesRows
        };
    },

    // ✅ NUEVO: series de tiempo ventas/gastos + top categorías
    async trends({ startDate }) {
        const [salesDaily] = await pool.query(
        `
        SELECT
            DATE(s.created_at) AS day,
            COUNT(*) AS count_sales,
            COALESCE(SUM(s.total),0) AS total_sales
        FROM sales s
        WHERE s.created_at >= :startDate
            AND s.status <> 'CANCELLED'
        GROUP BY DATE(s.created_at)
        ORDER BY day ASC
        `,
        { startDate }
        );

        const [expensesDaily] = await pool.query(
        `
        SELECT
            e.expense_date AS day,
            COUNT(*) AS count_expenses,
            COALESCE(SUM(e.amount),0) AS total_expenses
        FROM expenses e
        WHERE e.expense_date >= :startDate
            AND e.is_active = 1
        GROUP BY e.expense_date
        ORDER BY day ASC
        `,
        { startDate }
        );

        const [expensesByCategory] = await pool.query(
        `
        SELECT
            COALESCE(c.name, 'Sin categoría') AS category_name,
            COALESCE(SUM(e.amount),0) AS total_amount
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE e.expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND e.is_active = 1
        GROUP BY category_name
        ORDER BY total_amount DESC
        LIMIT 8
        `
        );

        return { salesDaily, expensesDaily, expensesByCategory };
    }
    };