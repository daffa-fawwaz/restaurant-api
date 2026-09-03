import { error, success } from "../utils/response.js";
import prisma from "../models/prisma.js";
export const customerMenu = async (req, res) => {
    try {
        const { qrToken } = req.params;
        if (!qrToken || Array.isArray(qrToken)) {
            return error(res, 400, "QR token is required", "QR_TOKEN_REQUIRED");
        }
        const findTable = await prisma.table.findUnique({
            where: {
                qrToken,
            },
        });
        const findMenus = await prisma.menu.findMany({
            where: {
                isAvailable: true,
            },
        });
        return success(res, 200, "Succes get customer", {
            table: {
                id: findTable?.id,
                number: findTable?.number,
                capacity: findTable?.capacity,
            },
            menus: findMenus,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return error(res, 500, "Internal server error", message);
    }
};
export const createCustomerOrder = async (req, res) => {
    try {
        const { tableId, nameCustomer, phoneNumber, items } = req.body;
        if (!tableId || !nameCustomer || !phoneNumber) {
            return error(res, 400, "Data customer dan meja wajib diisi", "VALIDATION_ERROR");
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return error(res, 400, "Minimal ada satu menu", "VALIDATION_ERROR");
        }
        const table = await prisma.table.findUnique({
            where: {
                id: Number(tableId),
            },
        });
        if (!table) {
            return error(res, 404, "Meja tidak ditemukan", "TABLE_NOT_FOUND");
        }
        if (!table.isAvailable) {
            const pendingOrder = await prisma.order.findFirst({
                where: {
                    tableId: Number(tableId),
                    status: "PENDING",
                },
            });
            if (pendingOrder) {
                await prisma.$transaction(async (tx) => {
                    await tx.payment.updateMany({
                        where: { orderId: pendingOrder.id },
                        data: { status: "FAILED" },
                    });
                    await tx.order.update({
                        where: { id: pendingOrder.id },
                        data: { status: "CANCELLED" },
                    });
                    await tx.table.update({
                        where: { id: Number(tableId) },
                        data: { isAvailable: true },
                    });
                });
            }
            else {
                return error(res, 409, "Meja sedang digunakan", "TABLE_NOT_AVAILABLE");
            }
        }
        const menuIds = items.map((item) => Number(item.menuId));
        const menus = await prisma.menu.findMany({
            where: {
                id: { in: menuIds },
                isAvailable: true,
            },
        });
        if (menus.length !== menuIds.length) {
            return error(res, 400, "Ada menu yang tidak tersedia", "MENU_NOT_AVAILABLE");
        }
        let subtotal = 0;
        const orderItems = items.map((item) => {
            const menu = menus.find((m) => m.id === Number(item.menuId));
            if (!menu)
                throw new Error("Menu tidak ditemukan");
            const quantity = Number(item.quantity);
            const price = Math.round(Number(menu.price));
            subtotal += price * quantity;
            return {
                menuId: menu.id,
                quantity,
                price,
                note: item.note ?? null,
            };
        });
        const serviceCharge = Math.round(subtotal * 0.1);
        const total = subtotal + serviceCharge;
        const result = await prisma.$transaction(async (tx) => {
            await tx.table.update({
                where: { id: Number(tableId) },
                data: { isAvailable: false },
            });
            const order = await tx.order.create({
                data: {
                    tableId: Number(tableId),
                    source: "CUSTOMER",
                    status: "IN_PROGRESS",
                    nameCustomer,
                    phone: phoneNumber,
                    subtotal,
                    serviceCharge,
                    total,
                    items: {
                        create: orderItems,
                    },
                },
                include: {
                    table: true,
                    items: {
                        include: {
                            menu: true,
                        },
                    },
                },
            });
            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    method: "CASH",
                    status: "UNPAID",
                    amount: total,
                },
            });
            return {
                ...order,
                payment,
            };
        });
        return success(res, 201, "Pesanan berhasil dibuat. Silakan bayar di kasir.", result);
    }
    catch (err) {
        console.error("Create customer cash order error:", err);
        return error(res, 500, "Gagal membuat pesanan", err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR");
    }
};
