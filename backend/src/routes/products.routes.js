import { Router } from "express";
import { productsController } from "../controllers/products.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", productsController.list);
router.get("/:id", productsController.getById);

// Solo OWNER modifica
router.post("/", requireRole("OWNER"), productsController.create);
router.put("/:id", requireRole("OWNER"), productsController.update);
router.delete("/:id", requireRole("OWNER"), productsController.remove);
router.patch("/:id/reactivate", requireRole("OWNER"), productsController.reactivate);

export default router;