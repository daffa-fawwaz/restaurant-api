import { Router } from "express";
import {
  createMenus,
  updateMenu,
  deleteMenu,
  getAllMenu,
  updateAvailable,
} from "../controllers/menuController.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", getAllMenu);
router.post("/", authMiddleware, upload.single("image"), createMenus);
router.put("/:id", authMiddleware, updateMenu);
router.delete("/:id", authMiddleware, deleteMenu);
router.patch("/is-avail/:id", authMiddleware, updateAvailable)

export default router;
