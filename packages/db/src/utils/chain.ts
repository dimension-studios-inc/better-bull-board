export const conditionalChain = <T, R>(
  base: T,
  condition: boolean,
  { true: trueChain, false: falseChain }: { true: (db: T) => R; false: (db: T) => T },
): R | T => {
  return condition ? trueChain(base) : falseChain(base)
}
