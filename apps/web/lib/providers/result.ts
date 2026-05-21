import type { ProviderErrorCode, Result } from "./types";

export function ok<T>(value: T): Result<T> {
  return {
    ok: true,
    value,
  };
}

export function err<T>(code: ProviderErrorCode, message: string, cause?: unknown): Result<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      cause,
    },
  };
}
