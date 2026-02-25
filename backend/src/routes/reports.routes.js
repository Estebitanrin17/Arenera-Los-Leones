import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { reportsController } from "../controllers/reports.controller.js";

const router = Router();
router.use(requireAuth);

// Export solo OWNER
router.get("/sales.xlsx", requireRole("OWNER"), reportsController.salesExcel);
router.get("/sales/:id/pdf", requireRole("OWNER"), reportsController.salePdf);

router.get("/expenses.xlsx", requireRole("OWNER"), reportsController.expensesExcel);
router.get("/expenses.pdf", requireRole("OWNER"), reportsController.expensesPdf);

router.get("/inventory.xlsx", requireRole("OWNER"), reportsController.inventoryExcel);
router.get("/inventory.pdf", requireRole("OWNER"), reportsController.inventoryPdf);

router.get("/payroll/:id.xlsx", requireRole("OWNER"), reportsController.payrollExcel);
router.get("/payroll/:id/pdf", requireRole("OWNER"), reportsController.payrollPdf);

router.get("/debts.xlsx", requireRole("OWNER"), reportsController.debtsExcel);
router.get("/debts.pdf", requireRole("OWNER"), reportsController.debtsPdf);

router.get("/kardex.xlsx", requireRole("OWNER"), reportsController.kardexExcel);
router.get("/kardex.pdf", requireRole("OWNER"), reportsController.kardexPdf);

export default router;