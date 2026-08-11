import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../models/prisma.js";
import { generateToken } from "../utils/jwt.js";
import { success, error } from "../utils/response.js";


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return error(
        res,
        401,
        "Invalid email or password",
        "UNAUTHORIZED"
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return error(
        res,
        401,
        "Invalid email or password",
        "UNAUTHORIZED"
      );
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
    });

    return success(res, 200, "Login successfully", {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return error(res, 500, "Internal server error", message);
  }
};