export function isUniqueConstraintError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
  constraint: string,
): error is { code: string; constraint_name: string } {
  return error?.code === "23505" && error?.constraint_name === constraint;
}
