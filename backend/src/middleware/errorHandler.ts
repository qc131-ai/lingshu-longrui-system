import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

function formatZodError(err: ZodError) {
  const flattened = err.flatten();
  const fieldMessages = err.issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field} ${issue.message}` : issue.message;
  });
  return {
    message: fieldMessages.length > 0 ? fieldMessages.join("；") : "Request validation failed",
    details: flattened,
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const validationError = formatZodError(err);
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validationError.message,
        details: validationError.details,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: { code: "CONFLICT", message: "Unique constraint failed" },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
  });
};
