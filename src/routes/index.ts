import { Router } from "express";
import tableRouter from './tableRoutes.js'
import menuRouter from './menuRoutes.js'
import authRouter from './authRoutes.js'
import orderRouter from './orderRoutes.js'

const router = Router();

router.use("/tables", tableRouter);
router.use("/menus", menuRouter);
router.use("/auth", authRouter)
router.use("/auth", authRouter)
router.use("/order", orderRouter)

export default router;
