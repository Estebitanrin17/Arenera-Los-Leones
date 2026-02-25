import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { debtsController } from "../controllers/debts.controller.js";

const router = Router();
router.use(requireAuth, requireRole("OWNER"));

router.get("/", debtsController.list);
router.get("/:id", debtsController.get);
router.post("/", debtsController.create);
router.post("/:id/payments", debtsController.addPayment);

export default router;