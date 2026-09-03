import { Router } from "express";
import tableRouter from "./tableRoutes.js";
import menuRouter from "./menuRoutes.js";
import authRouter from "./authRoutes.js";
import orderRouter from "./orderRoutes.js";
import customerRouter from "./customerRoutes.js";
import paymentRouter from "./paymentRoutes.js";

const router = Router();

router.use("/tables", tableRouter);
router.use("/menus", menuRouter);
router.use("/auth", authRouter);
router.use("/auth", authRouter);
router.use("/order", orderRouter);
router.use("/customer", customerRouter);
router.use("/payment", paymentRouter);

export default router;
