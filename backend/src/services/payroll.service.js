    import { pool } from "../db/pool.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const payrollService = {
    // Crea una liquidación de periodo.
    // Si no mandas employees[], liquida a TODOS los activos usando base_salary.
    async runPayroll({ periodFrom, periodTo, note, employees, createdBy }) {
        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();

        const [runRes] = await conn.query(
            `INSERT INTO payroll_runs (period_from, period_to, note, created_by)
            VALUES (:from, :to, :note, :createdBy)`,
            { from: periodFrom, to: periodTo, note: note ?? null, createdBy: createdBy ?? null }
        );
        const runId = runRes.insertId;

        // empleados objetivo
        let target = employees;
        if (!target || target.length === 0) {
            const [rows] = await conn.query(
            `SELECT id AS employeeId, base_salary AS grossAmount
            FROM employees
            WHERE is_active = 1
            ORDER BY full_name`
            );
            target = rows.map(r => ({ employeeId: r.employeeId, grossAmount: Number(r.grossAmount) }));
        }

        for (const t of target) {
            const employeeId = Number(t.employeeId);
            let gross = Number(t.grossAmount ?? 0);
            if (!employeeId || employeeId <= 0) throw httpError(400, "employeeId inválido");
            if (Number.isNaN(gross) || gross < 0) throw httpError(400, "grossAmount inválido");

            // bloquea empleado (opcional) y valida activo
            const [eRows] = await conn.query(
            `SELECT id, is_active FROM employees WHERE id = :id FOR UPDATE`,
            { id: employeeId }
            );
            const emp = eRows[0];
            if (!emp || !emp.is_active) throw httpError(400, `Empleado inválido o inactivo: ${employeeId}`);

            // crea item de nómina inicialmente sin deducciones
            const [itemRes] = await conn.query(
            `INSERT INTO payroll_items (payroll_run_id, employee_id, gross_amount, total_deductions, net_amount, note)
            VALUES (:runId, :employeeId, :gross, 0, :net, NULL)`,
            { runId, employeeId, gross, net: gross }
            );
            const itemId = itemRes.insertId;

            // aplica deudas en orden (OPEN, más antiguas primero)
            let remaining = gross;
            let deductions = 0;

            const [debts] = await conn.query(
            `SELECT id, balance
            FROM debts
            WHERE employee_id = :employeeId AND status = 'OPEN' AND balance > 0
            ORDER BY created_at ASC, id ASC
            FOR UPDATE`,
            { employeeId }
            );

            for (const d of debts) {
            if (remaining <= 0) break;

            const debtId = d.id;
            const balance = Number(d.balance);
            if (balance <= 0) continue;

            const pay = Math.min(balance, remaining);
            if (pay <= 0) continue;

            // registra deducción nómina
            await conn.query(
                `INSERT INTO payroll_deductions (payroll_item_id, debt_id, amount, note)
                VALUES (:itemId, :debtId, :amount, :note)`,
                { itemId, debtId, amount: pay, note: `Descuento nómina run#${runId}` }
            );

            // registra pago de deuda (PAYROLL)
            await conn.query(
                `INSERT INTO debt_payments (debt_id, amount, method, note, created_by)
                VALUES (:debtId, :amount, 'PAYROLL', :note, :createdBy)`,
                { debtId, amount: pay, note: `Nómina run#${runId}`, createdBy: createdBy ?? null }
            );

            const newBalance = balance - pay;
            const newStatus = newBalance <= 0 ? "CLOSED" : "OPEN";

            await conn.query(
                `UPDATE debts SET balance = :balance, status = :status WHERE id = :debtId`,
                { balance: newBalance, status: newStatus, debtId }
            );

            remaining -= pay;
            deductions += pay;
            }

            const net = Math.max(0, gross - deductions);

            await conn.query(
            `UPDATE payroll_items
            SET total_deductions = :deductions, net_amount = :net
            WHERE id = :itemId`,
            { deductions, net, itemId }
            );
        }

        await conn.commit();

        // devuelve el run con items y deducciones
        const [runRows] = await pool.query(`SELECT * FROM payroll_runs WHERE id = :id`, { id: runId });
        const [itemsRows] = await pool.query(`SELECT * FROM payroll_items WHERE payroll_run_id = :id`, { id: runId });
        const [dedRows] = await pool.query(
            `SELECT d.* FROM payroll_deductions d
            JOIN payroll_items i ON i.id = d.payroll_item_id
            WHERE i.payroll_run_id = :id
            ORDER BY d.id ASC`,
            { id: runId }
        );

        return { ...runRows[0], items: itemsRows, deductions: dedRows };
        } catch (e) {
        await conn.rollback();
        throw e;
        } finally {
        conn.release();
        }
    }
    };