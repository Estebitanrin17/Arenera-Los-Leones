    import { pool } from "../db/pool.js";

    export const authRepo = {
    async findUserByEmail(email) {
        const [rows] = await pool.query(
        `SELECT id, full_name, email, password_hash, role, is_active
        FROM users
        WHERE email = :email
        LIMIT 1`,
        { email }
        );
        return rows[0] || null;
    },

    async createResetCode({ userId, codeHash, expiresAt }) {
        await pool.query(
        `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
        VALUES (:userId, :codeHash, :expiresAt)`,
        { userId, codeHash, expiresAt }
        );
    },

    async getLatestResetCode(userId) {
        const [rows] = await pool.query(
        `SELECT id, code_hash, expires_at, used_at
        FROM password_reset_codes
        WHERE user_id = :userId
        ORDER BY id DESC
        LIMIT 1`,
        { userId }
        );
        return rows[0] || null;
    },

    async markResetUsed(id) {
        await pool.query(
        `UPDATE password_reset_codes SET used_at = NOW() WHERE id = :id`,
        { id }
        );
    },

    async updatePassword(userId, newHash) {
        await pool.query(
        `UPDATE users SET password_hash = :newHash WHERE id = :userId`,
        { newHash, userId }
        );
    }
    };
