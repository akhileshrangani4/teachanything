/**
 * Pure helpers for checkbox-selection state stored as a Set of ids.
 * All functions are immutable: they return a new Set and never mutate input.
 */

export function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * Adds every value when at least one is missing, otherwise removes them all.
 * Unrelated entries in the set are preserved. An empty value list returns a
 * copy of the input.
 */
export function toggleAllInSet<T>(
  set: ReadonlySet<T>,
  values: readonly T[],
): Set<T> {
  const next = new Set(set);
  const allSelected =
    values.length > 0 && values.every((value) => set.has(value));
  if (allSelected) {
    for (const value of values) next.delete(value);
  } else {
    for (const value of values) next.add(value);
  }
  return next;
}
