export function objEnum<T extends string>({ enumValues }: { enumValues: readonly T[] }) {
  const enumObject = {} as { [K in T]: K };
  for (const enumValue of enumValues) {
    enumObject[enumValue] = enumValue;
  }
  return enumObject;
}
