/**
 * Validates an author name
 * @param name - The author name to validate
 * @returns Error message if invalid, null if valid
 */
export function validateAuthorName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null; // Empty is allowed (will clear custom name)
  }
  if (trimmed.length < 1) {
    return "Author name must be at least 1 character";
  }
  if (trimmed.length > 100) {
    return "Author name must be at most 100 characters";
  }
  return null;
}
