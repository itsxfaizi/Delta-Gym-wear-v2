/**
 * Contract B. Mutations never throw across the server boundary; they return
 * this. Kept out of `src/server/**` so a future client form can import the type
 * without pulling `server-only` into the browser bundle.
 */
export type Ok<T> = { ok: true; data: T };

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "SERVER";

export type Err = {
  ok: false;
  code: ErrorCode;
  /**
   * User-safe and non-disclosing. Never an exception message, stack, SQL
   * fragment or column name, and never a hint about whether a record exists,
   * who owns it, or which role would have sufficed.
   */
  message: string;
  /** VALIDATION only. */
  fieldErrors?: Record<string, string[]>;
};

export type Result<T> = Ok<T> | Err;
