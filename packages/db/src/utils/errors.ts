export function isUniqueConstraintError(
  // biome-ignore lint/suspicious/noExplicitAny: _
  error: any,
  constraint: string,
): error is { code: string; constraint_name: string } {
  return error?.code === "23505" && error?.constraint_name === constraint;
}
