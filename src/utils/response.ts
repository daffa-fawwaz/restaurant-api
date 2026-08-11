import type { Response } from "express";

export interface Meta {
  page?: number;
  perPage?: number;
  total?: number;
}

export interface FieldError {
  field: string;
  message?: string;
  messages?: string[];
}

export const success = (
  res: Response,
  status: number,
  message: string,
  data?: unknown,
  meta?: Meta,
) => {
  return res.status(status).json({
    success: true,
    status,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
  });
};

export const error = (
  res: Response,
  status: number,
  message: string,
  errType: string,
  errors?: FieldError[],
) => {
  return res.status(status).json({
    success: false,
    status,
    message,
    error: errType,
    errors,
    timestamp: new Date().toISOString(),
  });
};
