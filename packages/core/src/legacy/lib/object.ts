export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

const objProto = Object.prototype;

export function isRecordProto<T>(
  value: object,
): value is Record<PropertyKey, T> {
  const p: unknown = Object.getPrototypeOf(value);
  return p === objProto || p === null;
}

export function isPlainObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return isObject(value) && isRecordProto(value);
}

/** @deprecated use `isPlainObject` */
export const isRecord = isPlainObject as <T = unknown>(
  value: unknown,
) => value is Record<string, T>;
