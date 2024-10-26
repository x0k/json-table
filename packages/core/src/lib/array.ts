export const array = <R>(
  count: number,
  factory: (index: number) => R
): R[] => Array.from(new Array(count), (_, i) => factory(i))
