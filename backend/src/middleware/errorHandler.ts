import { Request, Response, NextFunction } from 'express';

/**
 * Application-level error with HTTP status code.
 * Used by services/controllers to signal specific error conditions.
 */
export class AppError extends Error {
  public code: string;

  constructor(
    public statusCode: number,
    message: string,
    code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    if (code) {
      this.code = code;
    } else {
      switch (statusCode) {
        case 400:
          this.code = 'BAD_REQUEST';
          break;
        case 404:
          this.code = 'NOT_FOUND';
          break;
        case 409:
          this.code = 'CONFLICT';
          break;
        case 500:
          this.code = 'INTERNAL_ERROR';
          break;
        default:
          this.code = 'ERROR';
      }
    }
  }
}

/**
 * Centralized error handler middleware.
 * Catches AppError for known errors and returns structured JSON { error: { code, message } }.
 * Unknown errors return 500 with a generic message and safe error code.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[Error] ${err.message}`, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
