import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { salesController } from "../controllers/sales.controller.js";

const router = Router();
router.use(requireAuth);

// listar/ver: OWNER y EMPLOYEE
router.get("/", salesController.list);
router.get("/:id", salesController.get);

// crear venta: OWNER y EMPLOYEE
router.post("/", salesController.create);

// pagos: OWNER y EMPLOYEE
router.post("/:id/payments", salesController.addPayment);

// reembolso: recomendado solo OWNER
router.post("/:id/refunds", requireRole("OWNER"), salesController.addRefund);

// cancelar: solo OWNER
router.post("/:id/cancel", requireRole("OWNER"), salesController.cancel);

export default router;