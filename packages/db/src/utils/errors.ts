export function isUniqueConstraintError(
  error: unknown,
  constraint: string,
): error is { code: string; constraint_name: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  )
}
