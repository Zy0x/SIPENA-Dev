import { AppError } from "./app-error";
import { ERROR_CODES } from "./error-codes";

export function mapProviderError(error: unknown, fallback = "Provider request failed") {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(ERROR_CODES.UNKNOWN, error.message || fallback, error);
  return new AppError(ERROR_CODES.UNKNOWN, fallback, error);
}
