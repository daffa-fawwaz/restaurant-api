import { Router } from "express";

import {
  createMidtransPayment,
  midtransNotification,
  finishMidtransPayment,
  cancelPendingPayment,
} from "../controllers/paymentController.js";

const router = Router();

router.post("/midtrans", createMidtransPayment);
router.post("/midtrans/finish", finishMidtransPayment);
router.post("/midtrans/cancel", cancelPendingPayment);
router.post("/midtrans/notification", midtransNotification);

export default router;
