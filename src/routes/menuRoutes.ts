import { Router } from "express";
import {
  createMenus,
  updateMenu,
  deleteMenu,
  getAllMenu,
} from "../controllers/menuController";
import { upload } from "../middlewares/uploadMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", getAllMenu);
router.post("/", authMiddleware, upload.single("image"), createMenus);
router.put("/", authMiddleware, updateMenu);
router.delete("/:id", authMiddleware, deleteMenu);

export default router;
