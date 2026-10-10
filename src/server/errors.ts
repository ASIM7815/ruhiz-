import "server-only";

/** An error whose message is safe to show to the client. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "Please sign in to continue.", "UNAUTHORIZED");
export const forbidden = (msg = "You don't have permission to do that.") => new ApiError(403, msg, "FORBIDDEN");
export const notFound = (what = "Not found") => new ApiError(404, what, "NOT_FOUND");
export const badRequest = (msg: string) => new ApiError(400, msg, "BAD_REQUEST");
export const conflict = (msg: string) => new ApiError(409, msg, "CONFLICT");
