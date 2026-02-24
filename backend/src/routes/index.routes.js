import { Router } from "express";
import authRoutes from "./auth.routes.js";
import productsRoutes from "./products.routes.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import inventoryRoutes from "./inventory.routes.js";
import salesRoutes from "./sales.routes.js";
import reportsRoutes from "./reports.routes.js";
import expensesRoutes from "./expenses.routes.js";

const router = Router();

router.use("/auth", authRoutes);

router.get("/me", requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user });
});

router.use("/products", productsRoutes);


router.use("/inventory", inventoryRoutes);

router.use("/sales", salesRoutes);

router.use("/reports", reportsRoutes);

router.use("/expenses", expensesRoutes);

export default router;