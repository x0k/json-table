export type Nothing = null | undefined

export type Falsy = 0 | '' | false | Nothing

export function neverError(value: never, message: string) {
  return new Error(`${message}: ${value}`);
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export function isSomething<T>(value: T | Nothing): value is T {
  return value !== null && value !== undefined
}
