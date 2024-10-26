export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function isRecord<T = unknown>(
  value: unknown
): value is Record<string, T> {
  return isObject(value) && !Array.isArray(value);
}
