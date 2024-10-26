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

export function isTruly<T>(value: T | Falsy): value is T {
  return Boolean(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value)
}

export function isRecord<T = unknown>(
  value: unknown
): value is Record<string, T> {
  return isObject(value) && !isArray(value)
}

export function isFunction<T extends Function>(value: unknown): value is T {
  return typeof value === 'function'
}

export function makeIsArrayOf<I, T extends I>(guard: (value: I) => value is T) {
  return (value: unknown): value is Array<T> =>
    isArray<I>(value) && value.every(guard)
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date
}
