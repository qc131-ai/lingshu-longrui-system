export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(resource = "Resource") {
  return new AppError(404, "NOT_FOUND", `${resource} not found`);
}

export function badRequest(message: string) {
  return new AppError(400, "BAD_REQUEST", message);
}
