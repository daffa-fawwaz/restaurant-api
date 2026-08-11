import { Router } from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  changeStatusOrder,
  createOrder,
  getAllOrder,
  payOrder
} from "../controllers/orderController.js";

const router = Router();

router.post("/", authMiddleware, createOrder);
router.get("/", authMiddleware, getAllOrder);
router.patch("/:id", authMiddleware, changeStatusOrder);
router.patch("/:id/payment", payOrder);

export default router;
