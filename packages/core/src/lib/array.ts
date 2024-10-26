export interface NonEmptyArray<T> extends Array<T> {
  0: T
}

export const array = <R>(
  count: number,
  factory: (index: number) => R
): R[] => Array.from(new Array(count), (_, i) => factory(i))

export function isItemsEqual<T>(compare: (a: T, b: T) => boolean) {
  return (items: T[]): boolean => {
    let i = 1
    while (i < items.length) {
      if (compare(items[i - 1]!, items[i]!)) {
        i++
      } else {
        return false
      }
    }
    return true
  }
}

export type Predicate<T> = (value: T, index: number, arr: T[]) => boolean

export type GuardPredicate<T, R extends T> = (
  value: T,
  index: number,
  arr: T[]
) => value is R

export function filter<T, R extends T>(predicate: GuardPredicate<T, R>) {
  return (items: T[]): R[] => items.filter(predicate)
}

export type Transform<T, R> = (value: T, index: number) => R

export function map<T, R>(action: Transform<T, R>) {
  return (items: T[]): R[] => items.map(action)
}

export function every<T>(predicate: Predicate<T>) {
  return (items: T[]) => items.every(predicate)
}

export function some<T>(predicate: Predicate<T>) {
  return (items: T[]) => items.some(predicate)
}

export function first<T>(array: T[]) {
  return array[0]
}

export function last<T>(array: T[]) {
  return array[array.length - 1]
}
