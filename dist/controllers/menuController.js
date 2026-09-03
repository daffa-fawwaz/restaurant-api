import { error, success } from "../utils/response.js";
import { StorageService } from "../services/storageService.js";
import prisma from "../models/prisma.js";
export const getAllMenu = async (req, res) => {
    try {
        const dataMenu = await prisma.menu.findMany();
        return success(res, 200, "Succes fetch data menu", dataMenu);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal error", message);
    }
};
export const createMenus = async (req, res) => {
    try {
        const { name, description, price, category } = req.body;
        let imageUrl = null;
        if (req.file) {
            imageUrl = await StorageService.uploadMenuImage(req.file);
        }
        const newMenu = await prisma.menu.create({
            data: {
                name,
                description,
                category,
                price: Number(price),
                image: imageUrl,
            },
        });
        return success(res, 200, "Create menu succesfully", newMenu);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal error", message);
    }
};
export const updateMenu = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description, price, image, isAvailable } = req.body;
        const menu = await prisma.menu.findUnique({
            where: {
                id,
            },
        });
        if (!menu) {
            return error(res, 404, "Menu not found", "MENU_NOT_FOUND");
        }
        const updatedMenu = await prisma.menu.update({
            where: {
                id,
            },
            data: {
                name,
                description,
                price,
                image,
                isAvailable,
            },
        });
        return success(res, 200, "Menu updated successfully", updatedMenu);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal server error", message);
    }
};
export const deleteMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteData = await prisma.menu.delete({
            where: {
                id: Number(id),
            },
        });
        if (!deleteData) {
            return error(res, 400, "Menu not found!", "MENU_NOT_FOUND");
        }
        return success(res, 200, "Succes delete menu");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal server error", message);
    }
};
export const updateAvailable = async (req, res) => {
    try {
        const { id } = req.params;
        const findMenu = await prisma.menu.findUnique({
            where: {
                id: Number(id),
            },
        });
        if (!findMenu) {
            return error(res, 400, "Menu not found", "MENU_NOT_FOUND");
        }
        const updateAvailable = await prisma.menu.update({
            where: {
                id: Number(id),
            },
            data: {
                isAvailable: !findMenu.isAvailable,
            },
        });
        return success(res, 200, "Succes update available", updateAvailable);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal server error", message);
    }
};
