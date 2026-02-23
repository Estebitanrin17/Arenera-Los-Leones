import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", authController.login);
router.post("/forgot", authController.forgot);
router.post("/verify-code", authController.verifyCode);
router.post("/reset", authController.reset);

export default router;
