import type { Request, Response } from "express";
import prisma from "../models/prisma.js";
import { error, success } from "../utils/response.js";
import type { OrderStatus } from "@prisma/client";

const SERVICE_CHARGE_RATE = 0.1;

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { tableId, source, items } = req.body;

    if (!tableId) {
      return error(res, 400, "Table is required", "VALIDATION_ERROR");
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 400, "Order items are required", "VALIDATION_ERROR");
    }

    if (source && !["CUSTOMER", "ADMIN"].includes(source)) {
      return error(res, 400, "Invalid order source", "VALIDATION_ERROR");
    }

    const table = await prisma.table.findUnique({
      where: {
        id: Number(tableId),
      },
    });

    if (!table) {
      return error(res, 404, "Table not found", "TABLE_NOT_FOUND");
    }

    if (table.isAvailable == false) {
      return error(res, 409, "Table is currently occupied", "TABLE_OCCUPIED");
    }

    const menuIds = items.map((item) => Number(item.menuId));

    const menus = await prisma.menu.findMany({
      where: {
        id: {
          in: menuIds,
        },
      },
    });

    if (menus.length !== menuIds.length) {
      return error(res, 404, "One or more menus not found", "MENU_NOT_FOUND");
    }

    const unavailableMenu = menus.find((menu) => !menu.isAvailable);

    if (unavailableMenu) {
      return error(
        res,
        409,
        `Menu "${unavailableMenu.name}" is unavailable`,
        "MENU_UNAVAILABLE",
      );
    }

    let subtotal = 0;

    const orderItems = items.map((item) => {
      const menu = menus.find((menu) => menu.id === Number(item.menuId));

      if (!menu) {
        throw new Error("Menu not found");
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for menu ${menu.name}`);
      }

      const price = Number(menu.price);

      subtotal += price * quantity;

      return {
        menuId: menu.id,
        quantity,
        price: menu.price,
        note: item.note || null,
      };
    });

    const serviceCharge = subtotal * SERVICE_CHARGE_RATE;
    const total = subtotal + serviceCharge;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tableId: Number(tableId),
          source: source || "CUSTOMER",
          status: "IN_PROGRESS",
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

      await tx.table.update({
        where: {
          id: Number(tableId),
        },
        data: {
          isAvailable: false,
        },
      });

      return newOrder;
    });

    return success(res, 201, "Order created successfully", order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal server error", message);
  }
};

export const getAllOrder = async (req: Request, res: Response) => {
  try {
    const { status, tableId } = req.query;

    const getOrder = await prisma.order.findMany({
      where: {
        ...(status && {
          status: status as OrderStatus,
        }),

        ...(tableId && {
          tableId: Number(tableId),
        }),
      },
      include: {
        table: true,
        items: {
          include: {
            menu: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return success(res, 200, "Orders fetched successfully", getOrder);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal server error", message);
  }
};

export const changeStatusOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const findOrder = await prisma.order.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!findOrder) {
      return error(res, 400, "Order not found", "ORDER_NOT_FOUND");
    }

    const updateOrderStatus = await prisma.order.update({
      where: {
        id: Number(id),
      },
      data: {
        status: status,
      },
    });

    return success(res, 200, "Update status succes", updateOrderStatus);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal server error", message);
  }
};


export const payOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { amountReceived } = req.body;

    if (!Number.isFinite(id)) {
      return error(
        res,
        400,
        "Invalid order ID",
        "VALIDATION_ERROR"
      );
    }

    const received = Number(amountReceived);

    if (!Number.isFinite(received) || received <= 0) {
      return error(
        res,
        400,
        "Amount received must be greater than 0",
        "VALIDATION_ERROR"
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id,
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

    if (!order) {
      return error(
        res,
        404,
        "Order not found",
        "ORDER_NOT_FOUND"
      );
    }

    if (order.isPaid) {
      return error(
        res,
        409,
        "Order has already been paid",
        "ORDER_ALREADY_PAID"
      );
    }

    if (order.status !== "SERVED") {
      return error(
        res,
        409,
        "Order must be served before payment",
        "ORDER_NOT_SERVED"
      );
    }

    const total = Number(order.total);

    if (received < total) {
      return error(
        res,
        400,
        "Amount received is less than total",
        "INSUFFICIENT_PAYMENT"
      );
    }

    const change = received - total;

    const paidOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: {
          id,
        },
        data: {
          isPaid: true,
          amountReceived: received,
          changeAmount: change,
          paidAt: new Date(),
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

      await tx.table.update({
        where: {
          id: order.tableId,
        },
        data: {
          isAvailable: true,
        },
      });

      return updatedOrder;
    });

    return success(
      res,
      200,
      "Payment successful",
      {
        order: paidOrder,
        payment: {
          total,
          amountReceived: received,
          change,
        },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return error(
      res,
      500,
      "Internal server error",
      message
    );
  }
};
