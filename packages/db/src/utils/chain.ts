export const conditionalChain = <T, B extends boolean, R>(
  base: T,
  condition: B,
  { true: trueChain, false: falseChain }: { true: (db: T) => R; false: (db: T) => T },
): R | T => {
  return condition ? trueChain(base) : falseChain(base);
};
