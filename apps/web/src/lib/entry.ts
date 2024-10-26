export type Entry<V> = [string, V]

export function transformValue<V, R>(map: (value: V) => R) {
  return ([key, value]: Entry<V>): Entry<R> => [key, map(value)]
}
