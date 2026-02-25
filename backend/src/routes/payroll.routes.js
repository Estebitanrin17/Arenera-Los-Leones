import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { payrollController } from "../controllers/payroll.controller.js";

const router = Router();
router.use(requireAuth, requireRole("OWNER"));

router.post("/run", payrollController.run);

export default router;