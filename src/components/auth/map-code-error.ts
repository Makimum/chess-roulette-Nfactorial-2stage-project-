import { AuthError } from "@/lib/auth";
import type { TFunction } from "i18next";

/**
 * Maps an email-code flow error to a user-facing message.
 * Returns { message, expired, fieldErrors } where:
 *  - expired = true when the backend says the code expired or attempts exhausted
 *  - fieldErrors maps a known field name (email, username, currentPassword) to msg
 */
export function mapCodeError(
  err: unknown,
  t: TFunction,
): { message: string; expired: boolean; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  if (err instanceof AuthError) {
    if (err.status === 0) return { message: t("auth.backendUnavailable"), expired: false, fieldErrors };
    if (err.status === 503) return { message: t("auth.code.serviceUnavailable"), expired: false, fieldErrors };
    if (err.status === 429) return { message: t("auth.code.cooldown"), expired: false, fieldErrors };
    if (err.status === 409) {
      const msg = err.message.toLowerCase();
      if (msg.includes("username")) {
        fieldErrors.username = t("auth.usernameTaken");
        return { message: t("auth.usernameTaken"), expired: false, fieldErrors };
      }
      fieldErrors.email = t("auth.emailExists");
      fieldErrors.newEmail = t("auth.emailExists");
      return { message: t("auth.emailExists"), expired: false, fieldErrors };
    }
    if (err.status === 403) {
      fieldErrors.currentPassword = t("auth.changeEmail.wrongPassword");
      return { message: t("auth.changeEmail.wrongPassword"), expired: false, fieldErrors };
    }
    if (err.status === 400) {
      const msg = err.message.toLowerCase();
      if (msg.includes("expired")) {
        return { message: t("auth.code.expired"), expired: true, fieldErrors };
      }
      if (msg.includes("too many")) {
        return { message: t("auth.code.tooMany"), expired: true, fieldErrors };
      }
      if (msg.includes("verification") || msg.includes("invalid")) {
        return { message: t("auth.code.invalid"), expired: false, fieldErrors };
      }
      return { message: err.message, expired: false, fieldErrors };
    }
    if (err.status === 401) return { message: t("auth.invalidCreds"), expired: false, fieldErrors };
    if (err.status === 422) {
      Object.assign(fieldErrors, err.fieldErrors);
      return { message: err.message, expired: false, fieldErrors };
    }
    return { message: err.message, expired: false, fieldErrors };
  }
  return { message: t("auth.somethingWrong"), expired: false, fieldErrors };
}
