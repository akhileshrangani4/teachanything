/**
 * Helper function to get user initials from name and email
 */
export function getUserInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
    }
    return name[0]?.toUpperCase() || email[0]?.toUpperCase() || "?";
  }
  return email[0]?.toUpperCase() || "?";
}
