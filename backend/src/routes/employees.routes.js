import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { employeesController } from "../controllers/employees.controller.js";

const router = Router();
router.use(requireAuth, requireRole("OWNER"));

router.get("/", employeesController.list);
router.get("/:id", employeesController.get);
router.post("/", employeesController.create);
router.put("/:id", employeesController.update);
router.delete("/:id", employeesController.deactivate);
router.patch("/:id/reactivate", employeesController.reactivate);

export default router;