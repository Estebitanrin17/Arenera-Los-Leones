import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { reportsController } from "../controllers/reports.controller.js";

const router = Router();
router.use(requireAuth);

// Export solo OWNER (recomendado)
router.get("/sales.xlsx", requireRole("OWNER"), reportsController.salesExcel);
router.get("/sales/:id/pdf", requireRole("OWNER"), reportsController.salePdf);

// NUEVO: export gastos
router.get("/expenses.xlsx", requireRole("OWNER"), reportsController.expensesExcel);
router.get("/expenses.pdf", requireRole("OWNER"), reportsController.expensesPdf);

// NUEVO: export inventario
router.get("/inventory.xlsx", requireRole("OWNER"), reportsController.inventoryExcel);
router.get("/inventory.pdf", requireRole("OWNER"), reportsController.inventoryPdf);

export default router;