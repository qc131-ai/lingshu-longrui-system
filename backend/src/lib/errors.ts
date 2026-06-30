export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(resource = "Resource") {
  return new AppError(404, "NOT_FOUND", `${resource} not found`);
}

export function badRequest(message: string) {
  return new AppError(400, "BAD_REQUEST", message);
}

export function conflict(message: string, details?: unknown) {
  return new AppError(409, "CONFLICT", message, details);
}
