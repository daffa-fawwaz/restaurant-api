import type { Request, Response } from "express";
import { error, success } from "../utils/response.js";
import prisma from "../models/prisma.js";

export const createTable = async (req: Request, res: Response) => {
  try {
    const { number, capacity, status } = req.body;

    if (!number || !capacity) {
      return error(res, 400, "All field is required!", "FIELD_REQUIRED");
    }

    const existTable = await prisma.table.findFirst({
      where: {
        number,
      },
    });

    if (existTable) {
      return error(
        res,
        400,
        "Table number already exists",
        "TABLE_ALREADY_EXISTS",
      );
    }

    const newTable = await prisma.table.create({
      data: {
        number: Number(number),
        capacity: Number(capacity),
        status,
      },
    });

    return success(res, 200, "Succes create table", newTable);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal error", message);
  }
};

export const getAllTable = async (req: Request, res: Response) => {
  try {
    const number = req.query.number ? Number(req.query.number) : undefined;

    const isAvailable =
      req.query.isAvailable !== undefined
        ? req.query.isAvailable === "true"
        : undefined;

    const dataTable = await prisma.table.findMany({
      where: {
        ...(isAvailable !== undefined && { isAvailable }),
        ...(number !== undefined && { number }),
      },
      orderBy: {
        number: "asc",
      },
    });

    return success(res, 200, "Success fetch data", dataTable);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal error", message);
  }
};

export const toogleTableStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const findTable = await prisma.table.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!findTable) {
      return error(res, 400, "Table is not found", "TABLE_NOT_FOUND");
    }

    const updatedTable = await prisma.table.update({
      where: {
        id: Number(id),
      },
      data: {
        isAvailable: !findTable.isAvailable,
      },
    });

    return success(res, 200, "Succes change status", updatedTable);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal error", message);
  }
};


export const updateTable = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { number, capacity } = req.body;

    const table = await prisma.table.findUnique({
      where: {
        id,
      },
    });

    if (!table) {
      return error(
        res,
        404,
        "Table not found",
        "TABLE_NOT_FOUND"
      );
    }

    const existNumber = await prisma.table.findFirst({
      where: {
        number,
        NOT: {
          id,
        },
      },
    });

    if (existNumber) {
      return error(
        res,
        409,
        "Table number already exists",
        "TABLE_NUMBER_ALREADY_EXISTS"
      );
    }

    const updatedTable = await prisma.table.update({
      where: {
        id,
      },
      data: {
        number,
        capacity,
      },
    });

    return success(
      res,
      200,
      "Table updated successfully",
      updatedTable
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return error(
      res,
      500,
      "Internal server error",
      message
    );
  }
}; 

export const deleteTable = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleteTable = await prisma.table.delete({
      where: {
        id: Number(id),
      },
    });

    if (!deleteTable) {
      return error(res, 400, "Table is not found", "TABLE_NOT_FOUND");
    }

    return success(res, 200, "Delete table succesfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(res, 500, "Internal error", message);
  }
};
