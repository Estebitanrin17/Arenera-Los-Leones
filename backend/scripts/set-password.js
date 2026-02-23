    import bcrypt from "bcrypt";
    import { pool } from "../src/db/pool.js";

    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
    console.log('Uso: node scripts/set-password.js "correo" "nuevaClave"');
    process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);

    const [result] = await pool.query(
    "UPDATE users SET password_hash = :hash WHERE email = :email",
    { hash, email }
    );

    console.log({ updatedRows: result.affectedRows });
    process.exit(0);