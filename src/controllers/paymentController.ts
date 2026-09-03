import type { Request, Response } from "express";
import prisma from "../models/prisma.js";
import { snap } from "../config/midtrans.js";
import { success, error } from "../utils/response.js";

export const createMidtransPayment = async (req: Request, res: Response) => {
  try {
    const { tableId, nameCustomer, phoneNumber, items } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!tableId || !nameCustomer || !phoneNumber) {
      return error(
        res,
        400,
        "Data customer dan meja wajib diisi",
        "VALIDATION_ERROR",
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 400, "Minimal ada satu menu", "VALIDATION_ERROR");
    }

    // ==========================================
    // CHECK TABLE
    // ==========================================

    const table = await prisma.table.findUnique({
      where: {
        id: Number(tableId),
      },
    });

    if (!table) {
      return error(res, 404, "Meja tidak ditemukan", "TABLE_NOT_FOUND");
    }

    // ==========================================
    // CHECK TABLE AVAILABILITY
    // ==========================================

    if (!table.isAvailable) {
      // Periksa apakah meja sedang ditandai tidak tersedia karena pesanan PENDING (belum bayar)
      const pendingOrder = await prisma.order.findFirst({
        where: {
          tableId: Number(tableId),
          status: "PENDING",
          payment: {
            method: "MIDTRANS",
            status: "PENDING",
          },
        },
      });

      if (pendingOrder) {
        // Batalkan order pending lama agar pelanggan bisa membuat order baru
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
      } else {
        return error(res, 409, "Meja sedang digunakan", "TABLE_NOT_AVAILABLE");
      }
    }

    // ==========================================
    // GET MENU
    // ==========================================

    const menuIds = items.map((item: any) => Number(item.menuId));

    const menus = await prisma.menu.findMany({
      where: {
        id: {
          in: menuIds,
        },
        isAvailable: true,
      },
    });

    if (menus.length !== menuIds.length) {
      return error(
        res,
        400,
        "Ada menu yang tidak tersedia",
        "MENU_NOT_AVAILABLE",
      );
    }

    // ==========================================
    // CALCULATE ORDER
    // ==========================================

    let subtotal = 0;

    const orderItems = items.map((item: any) => {
      const menu = menus.find((menu) => menu.id === Number(item.menuId));

      if (!menu) {
        throw new Error(`Menu ${item.menuId} tidak ditemukan`);
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Quantity ${menu.name} tidak valid`);
      }

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

    // ==========================================
    // MIDTRANS ORDER ID
    // ==========================================

    const midtransOrderId = `WARUNGKU-${Date.now()}`;

    // ==========================================
    // CREATE ORDER + PAYMENT + LOCK TABLE
    // ==========================================

    const result = await prisma.$transaction(async (tx) => {
      // ======================================
      // LOCK / CHECK TABLE
      // ======================================

      const updatedTable = await tx.table.updateMany({
        where: {
          id: Number(tableId),
          isAvailable: true,
        },
        data: {
          isAvailable: false,
        },
      });

      // Jika count = 0 berarti meja sudah digunakan
      if (updatedTable.count === 0) {
        throw new Error("TABLE_NOT_AVAILABLE");
      }

      // ======================================
      // CREATE ORDER
      // ======================================

      const order = await tx.order.create({
        data: {
          tableId: Number(tableId),

          source: "CUSTOMER",

          status: "PENDING",

          nameCustomer,

          phone: phoneNumber,

          subtotal,

          serviceCharge,

          total,

          items: {
            create: orderItems,
          },
        },
      });

      // ======================================
      // CREATE PAYMENT
      // ======================================

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,

          midtransOrderId,

          method: "MIDTRANS",

          status: "PENDING",

          amount: total,
        },
      });

      return {
        order,
        payment,
      };
    });

    // ==========================================
    // CREATE MIDTRANS TRANSACTION
    // ==========================================

    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: midtransOrderId,

        gross_amount: total,
      },

      customer_details: {
        first_name: nameCustomer,

        phone: phoneNumber,
      },

      item_details: [
        ...orderItems.map((item) => {
          const menu = menus.find((menu) => menu.id === item.menuId);

          return {
            id: String(item.menuId),

            price: item.price,

            quantity: item.quantity,

            name: menu?.name ?? "Menu",
          };
        }),

        {
          id: "SERVICE",

          price: serviceCharge,

          quantity: 1,

          name: "Service Charge",
        },
      ],
    });

    return success(res, 201, "Payment berhasil dibuat", {
      orderId: result.order.id,

      paymentId: result.payment.id,

      midtransOrderId,

      snapToken: transaction.token,

      total,
    });
  } catch (err) {
    console.error("Create Midtrans payment error:", err);

    if (err instanceof Error && err.message === "TABLE_NOT_AVAILABLE") {
      return error(res, 409, "Meja sedang digunakan", "TABLE_NOT_AVAILABLE");
    }

    return error(
      res,
      500,
      "Gagal membuat pembayaran",
      err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR",
    );
  }
};

export const midtransNotification = async (req: Request, res: Response) => {
  try {
    console.log("========== MIDTRANS NOTIFICATION ==========");
    console.log("BODY:", req.body);
    console.log("===========================================");

    const notification = await snap.transaction.notification(req.body);

    console.log("PARSED NOTIFICATION:", notification);

    const { order_id, transaction_status, fraud_status, transaction_id } =
      notification;

    console.log("Midtrans notification:", notification);

    // ==========================================
    // FIND PAYMENT
    // ==========================================

    const payment = await prisma.payment.findUnique({
      where: {
        midtransOrderId: order_id,
      },
    });

    if (!payment) {
      return error(res, 404, "Payment tidak ditemukan", "PAYMENT_NOT_FOUND");
    }

    // ==========================================
    // SUCCESS
    // ==========================================

    const isSuccess =
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept");

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: {
            id: payment.id,
          },

          data: {
            status: "PAID",

            transactionId: transaction_id,

            paidAt: new Date(),
          },
        });

        // Order status menjadi IN_PROGRESS agar diproses dapur di admin dashboard
        await tx.order.update({
          where: {
            id: payment.orderId,
          },

          data: {
            status: "IN_PROGRESS",
          },
        });
      });

      return success(res, 200, "Payment berhasil", {
        paymentId: payment.id,

        orderId: payment.orderId,

        status: "PAID",
      });
    }

    // ==========================================
    // PENDING
    // ==========================================

    if (transaction_status === "pending") {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },

        data: {
          status: "PENDING",

          transactionId: transaction_id,
        },
      });

      return success(res, 200, "Payment masih pending", {
        paymentId: payment.id,

        orderId: payment.orderId,

        status: "PENDING",
      });
    }

    // ==========================================
    // FAILED
    // ==========================================

    if (transaction_status === "deny" || transaction_status === "cancel") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: {
            id: payment.id,
          },

          data: {
            status: "FAILED",

            transactionId: transaction_id,
          },
        });

        const updatedOrder = await tx.order.update({
          where: {
            id: payment.orderId,
          },

          data: {
            status: "CANCELLED",
          },
        });

        await tx.table.update({
          where: {
            id: updatedOrder.tableId,
          },

          data: {
            isAvailable: true,
          },
        });
      });

      return success(res, 200, "Payment gagal", {
        paymentId: payment.id,

        orderId: payment.orderId,

        status: "FAILED",
      });
    }

    // ==========================================
    // EXPIRED
    // ==========================================

    if (transaction_status === "expire") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: {
            id: payment.id,
          },

          data: {
            status: "EXPIRED",

            transactionId: transaction_id,
          },
        });

        const updatedOrder = await tx.order.update({
          where: {
            id: payment.orderId,
          },

          data: {
            status: "CANCELLED",
          },
        });

        await tx.table.update({
          where: {
            id: updatedOrder.tableId,
          },

          data: {
            isAvailable: true,
          },
        });
      });

      return success(res, 200, "Payment expired", {
        paymentId: payment.id,

        orderId: payment.orderId,

        status: "EXPIRED",
      });
    }

    // ==========================================
    // OTHER STATUS
    // ==========================================

    return success(res, 200, "Notification diterima", {
      transactionStatus: transaction_status,

      paymentId: payment.id,

      orderId: payment.orderId,
    });
  } catch (err) {
    console.error("Midtrans notification error:", err);

    return error(
      res,
      500,
      "Gagal memproses notification",
      err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR",
    );
  }
};

export const finishMidtransPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, transactionId } = req.body;

    if (!orderId) {
      return error(res, 400, "Order ID is required", "VALIDATION_ERROR");
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { payment: true, table: true },
    });

    if (!order) {
      return error(res, 404, "Order not found", "ORDER_NOT_FOUND");
    }

    if (order.status === "PAID" && order.payment?.status === "PAID") {
      return success(res, 200, "Payment already verified", order);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: "PAID",
            transactionId: transactionId || order.payment.transactionId,
            paidAt: new Date(),
          },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "IN_PROGRESS",
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

    return success(res, 200, "Payment finished successfully", updated);
  } catch (err) {
    console.error("Finish Midtrans payment error:", err);
    return error(
      res,
      500,
      "Gagal menyelesaikan pembayaran",
      err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR",
    );
  }
};

export const cancelPendingPayment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return error(res, 400, "Order ID is required", "VALIDATION_ERROR");
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { payment: true },
    });

    if (!order) {
      return error(res, 404, "Order not found", "ORDER_NOT_FOUND");
    }

    if (order.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        if (order.payment && order.payment.status === "PENDING") {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: "FAILED" },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });

        await tx.table.update({
          where: { id: order.tableId },
          data: { isAvailable: true },
        });
      });
    }

    return success(res, 200, "Pending order cancelled successfully");
  } catch (err) {
    console.error("Cancel pending payment error:", err);
    return error(
      res,
      500,
      "Gagal membatalkan pembayaran pending",
      err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR",
    );
  }
};
