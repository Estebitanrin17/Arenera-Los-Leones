import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { inventoryController } from "../controllers/inventory.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/stock", inventoryController.stock);
router.post("/movements", inventoryController.movement);

export default router;