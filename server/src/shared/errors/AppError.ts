import { ErrorCode, ERROR_CODES } from './errorCodes';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }

  static internal(message = 'Error interno del servidor') {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, message, 500);
  }
}

