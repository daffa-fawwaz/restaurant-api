import { Router } from "express";
import { customerMenu, createCustomerOrder, } from "../controllers/customerController.js";
const router = Router();
router.get("/:qrToken", customerMenu);
router.post("/order", createCustomerOrder);
export default router;
