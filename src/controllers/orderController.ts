import type { Request, Response } from "express";
import prisma from "../models/prisma.js";
import { error, success } from "../utils/response.js";
import type { OrderStatus } from "@prisma/client";
import { getIO } from "../socket/socket.js";

const SERVICE_CHARGE_RATE = 0.1;

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { tableId, source, items, nameCustomer, phone } = req.body;

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
          nameCustomer,
          status: "IN_PROGRESS",
          subtotal,
          phone,
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

    try {
      getIO().emit("new_order", order);
    } catch (e) {
      console.error("Socket emit new_order error:", e);
    }

    return success(res, 201, "Order created successfully", order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal server error", message);
  }
};

const formatOrderResponse = (order: any) => {
  if (!order) return null;
  return {
    ...order,
    isPaid:
      order.status === "PAID" ||
      order.status === "COMPLETED" ||
      order.payment?.status === "PAID",
    amountReceived: order.payment?.amountReceived ?? null,
    changeAmount: order.payment?.changeAmount ?? null,
    paidAt: order.payment?.paidAt ?? null,
  };
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

        // Sembunyikan order CANCELLED serta order "bayar sekarang" yang masih PENDING / belum lunas
        NOT: [
          { status: "CANCELLED" },
          {
            AND: [
              { status: "PENDING" },
              {
                payment: {
                  method: "MIDTRANS",
                  status: { not: "PAID" },
                },
              },
            ],
          },
        ],
      },
      include: {
        table: true,
        items: {
          include: {
            menu: true,
          },
        },
        payment: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedOrders = getOrder.map(formatOrderResponse);

    return success(res, 200, "Orders fetched successfully", formattedOrders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal server error", message);
  }
};

export const changeStatusOrder = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const orderId = Number(id);

    const findOrder = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!findOrder) {
      return error(
        res,
        400,
        "Order not found",
        "ORDER_NOT_FOUND"
      );
    }

    const updatedOrder = await prisma.$transaction(
      async (tx) => {
        const updateOrderStatus = await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            status: status,
          },
        });

        // Jika status menjadi COMPLETED, PAID, atau CANCELLED,
        // meja langsung tersedia
        if (
          status === "COMPLETED" ||
          status === "PAID" ||
          status === "CANCELLED"
        ) {
          await tx.table.update({
            where: {
              id: findOrder.tableId,
            },
            data: {
              isAvailable: true,
            },
          });
        }

        // Jika status menjadi aktif,
        // meja kembali terisi
        else if (
          status === "IN_PROGRESS" ||
          status === "SERVED" ||
          status === "PENDING"
        ) {
          await tx.table.update({
            where: {
              id: findOrder.tableId,
            },
            data: {
              isAvailable: false,
            },
          });
        }

        return updateOrderStatus;
      }
    );

    // ==========================================
    // SOCKET.IO
    // ==========================================

    try {
      getIO()
        .to(`order:${updatedOrder.id}`)
        .emit("order_status_updated", updatedOrder);

      getIO().emit("order_updated", updatedOrder);
    } catch (e) {
      console.error("Socket emit order_status_updated error:", e);
    }

    // ==========================================
    // RESPONSE API
    // ==========================================

    return success(
      res,
      200,
      "Update status success",
      updatedOrder
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";

    return error(
      res,
      500,
      "Internal server error",
      message
    );
  }
};

export const payOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amountReceived } = req.body;

    const orderId = Number(id);
    const receive = Number(amountReceived);

    if (Number.isNaN(orderId)) {
      return error(res, 400, "Invalid order ID", "INVALID_ORDER_ID");
    }

    if (Number.isNaN(receive) || receive <= 0) {
      return error(
        res,
        400,
        "Amount received must be greater than 0",
        "MUST_GREATER_THEN_0",
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order) {
      return error(res, 404, "Order not found", "ORDER_NOT_FOUND");
    }

    if (order.status !== "SERVED") {
      return error(
        res,
        400,
        "Order can only be paid when status is SERVED",
        "ORDER_NOT_SERVED",
      );
    }

    const total = Number(order.total);

    if (receive < total) {
      return error(
        res,
        400,
        `Insufficient payment. Total payment is ${total}`,
        "UANG_KURANG",
      );
    }

    const changeAmount = receive - total;

    const paidOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: "PAID",
        },
      });

      await tx.payment.upsert({
        where: {
          orderId,
        },
        create: {
          orderId,
          method: "CASH",
          status: "PAID",
          amount: total,
          amountReceived: receive,
          changeAmount: changeAmount,
          paidAt: new Date(),
        },
        update: {
          method: "CASH",
          status: "PAID",
          amount: total,
          amountReceived: receive,
          changeAmount: changeAmount,
          paidAt: new Date(),
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

      return tx.order.findUnique({
        where: {
          id: updatedOrder.id,
        },
        include: {
          table: true,
          items: {
            include: {
              menu: true,
            },
          },
          payment: true,
        },
      });
    });

    const formattedPaidOrder = formatOrderResponse(paidOrder);

    try {
      getIO()
        .to(`order:${orderId}`)
        .emit("order_status_updated", formattedPaidOrder);

      getIO().emit("order_updated", formattedPaidOrder);
    } catch (e) {
      console.error("Socket emit on payOrder error:", e);
    }

    return success(res, 200, "Order paid successfully", formattedPaidOrder);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return error(res, 500, "Internal server error", message);
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return error(res, 404, "Order not found", "ORDER_NOT_FOUND");
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
        payment: true,
      },
    });

    if (!order) {
      return error(res, 404, "Order not found", "ORDER_NOT_FOUND");
    }

    return success(
      res,
      200,
      "Success get order",
      formatOrderResponse(order)
    );
  } catch (err) {
    console.error("Failed to get order:", err);

    const message =
      err instanceof Error ? err.message : "Unknown server error";

    return res.status(500).json({
      success: false,
      status: 500,
      message: "Internal server error",
      error: message,
    });
  }
};
