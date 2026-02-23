    import dotenv from "dotenv";
    dotenv.config();

    export const env = {
    port: process.env.PORT || 3000,
    db: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
    };
