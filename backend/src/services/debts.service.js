    import { pool } from "../db/pool.js";
    import { debtsRepo } from "../repositories/debts.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const debtsService = {
    async list(filters) {
        return debtsRepo.list(filters);
    },

    async get(id) {
        const d = await debtsRepo.getById(id);
        if (!d) throw httpError(404, "Deuda no encontrada");
        return d;
    },

    async createDebt({ employeeId, type, amount, note, createdBy }) {
        const amt = Number(amount);
        if (Number.isNaN(amt) || amt <= 0) throw httpError(400, "amount inválido");

        const [res] = await pool.query(
        `INSERT INTO debts (employee_id, type, original_amount, balance, status, note, created_by)
        VALUES (:employeeId, :type, :original, :balance, 'OPEN', :note, :createdBy)`,
        {
            employeeId,
            type,
            original: amt,
            balance: amt,
            note: note ?? null,
            createdBy: createdBy ?? null
        }
        );

        return debtsRepo.getById(res.insertId);
    },

    async addPayment({ debtId, amount, method, note, createdBy }) {
        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();

        const [dRows] = await conn.query(
            `SELECT id, balance, status FROM debts WHERE id = :debtId FOR UPDATE`,
            { debtId }
        );
        const debt = dRows[0];
        if (!debt) throw httpError(404, "Deuda no encontrada");
        if (debt.status === "CLOSED") throw httpError(409, "La deuda ya está cerrada");

        const amt = Number(amount);
        if (Number.isNaN(amt) || amt <= 0) throw httpError(400, "amount inválido");
        if (amt > Number(debt.balance)) throw httpError(409, `El abono excede el saldo. Saldo: ${debt.balance}`);

        await conn.query(
            `INSERT INTO debt_payments (debt_id, amount, method, note, created_by)
            VALUES (:debtId, :amount, :method, :note, :createdBy)`,
            { debtId, amount: amt, method, note: note ?? null, createdBy: createdBy ?? null }
        );

        const newBalance = Number(debt.balance) - amt;
        const newStatus = newBalance <= 0 ? "CLOSED" : "OPEN";

        await conn.query(
            `UPDATE debts SET balance = :balance, status = :status WHERE id = :debtId`,
            { balance: newBalance, status: newStatus, debtId }
        );

        await conn.commit();
        return debtsRepo.getById(debtId);
        } catch (e) {
        await conn.rollback();
        throw e;
        } finally {
        conn.release();
        }
    }
    };