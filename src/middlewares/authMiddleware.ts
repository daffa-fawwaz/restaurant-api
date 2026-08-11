import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { error } from "../utils/response.js";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const bearer = req.headers.authorization;

  if (!bearer || !bearer.startsWith("Bearer ")) {
    return error(
      res,
      401,
      "Unauthorized",
      "UNAUTHORIZED"
    );
  }

  const token = bearer.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    (req as any).user = decoded;

    next();
  } catch {
    return error(
      res,
      401,
      "Invalid token",
      "UNAUTHORIZED"
    );
  }
};