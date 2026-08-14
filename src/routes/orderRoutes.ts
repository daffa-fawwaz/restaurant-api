import { Router } from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  changeStatusOrder,
  createOrder,
  getAllOrder,
  payOrder,
  getOrderById,
} from "../controllers/orderController.js";

const router = Router();

router.post("/", authMiddleware, createOrder);
router.get("/", authMiddleware, getAllOrder);
router.patch("/:id", authMiddleware, changeStatusOrder);
router.get("/:id", getOrderById);
router.patch("/:id/payment", payOrder);

export default router;
