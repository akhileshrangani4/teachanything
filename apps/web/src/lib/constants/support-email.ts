export const DEFAULT_SUPPORT_EMAIL = "admin@teachanything.ai";

export function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}
