export type ApiResponse<T> = {
  data: T | null;
  error: { message: string; code: string } | null;
};

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function apiError(
  message: string,
  code:
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INTERNAL_ERROR"
    | "LIMIT_REACHED"
): ApiResponse<never> {
  return { data: null, error: { message, code } };
}
