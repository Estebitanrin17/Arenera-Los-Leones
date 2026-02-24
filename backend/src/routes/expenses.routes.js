import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { expensesController } from "../controllers/expenses.controller.js";

const router = Router();

// Todo gastos solo OWNER
router.use(requireAuth, requireRole("OWNER"));

// Categories
router.get("/categories", expensesController.listCategories);
router.post("/categories", expensesController.createCategory);
router.put("/categories/:id", expensesController.updateCategory);
router.delete("/categories/:id", expensesController.deactivateCategory);
router.patch("/categories/:id/reactivate", expensesController.reactivateCategory);

// Expenses
router.get("/", expensesController.listExpenses);
router.get("/:id", expensesController.getExpense);
router.post("/", expensesController.createExpense);
router.put("/:id", expensesController.updateExpense);
router.delete("/:id", expensesController.deactivateExpense);
router.patch("/:id/reactivate", expensesController.reactivateExpense);

export default router;