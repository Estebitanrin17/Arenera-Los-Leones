import { Router } from "express";
import authRoutes from "./auth.routes.js";
import productsRoutes from "./products.routes.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import inventoryRoutes from "./inventory.routes.js";
import salesRoutes from "./sales.routes.js";
import reportsRoutes from "./reports.routes.js";
import expensesRoutes from "./expenses.routes.js";
import employeesRoutes from "./employees.routes.js";
import debtsRoutes from "./debts.routes.js";
import payrollRoutes from "./payroll.routes.js";
import metricsRoutes from "./metrics.routes.js";

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

router.use("/employees", employeesRoutes);

router.use("/debts", debtsRoutes);

router.use("/payroll", payrollRoutes);

router.use("/metrics", metricsRoutes);

export default router;