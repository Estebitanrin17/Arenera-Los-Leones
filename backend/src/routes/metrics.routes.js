import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { metricsController } from "../controllers/metrics.controller.js";

const router = Router();
router.use(requireAuth, requireRole("OWNER"));

router.get("/overview", metricsController.overview);
router.get("/trends", metricsController.trends); // ✅ NUEVO

export default router;