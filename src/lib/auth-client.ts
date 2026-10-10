"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/** Browser auth client. Talks only to our own /api/auth proxy; holds no secrets. */
export const authClient = createAuthClient();

/** Maps Neon Auth / Better Auth error codes to plain-language messages. */
export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!err) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email first.";
    case "PASSWORD_TOO_SHORT":
      return "Your password must be at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long.";
    case "INVALID_OTP":
      return "That code isn't right. Check the email and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many attempts. Request a new code.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
  }
  if (err.status === 429) return "Too many attempts. Please wait a minute and try again.";
  return err.message || "Something went wrong. Please try again.";
}
