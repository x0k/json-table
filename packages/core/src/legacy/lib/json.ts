export type JSONPrimitiveExceptNull = string | number | boolean;

export type JSONPrimitive = JSONPrimitiveExceptNull | null;

export type JSONPrimitiveExceptNullLiterals = "string" | "number" | "boolean";

export type JSONRecord = { [k: string]: JSONValue };

export type JSONArray = JSONValue[];

export type JSONObject = JSONRecord | JSONArray;

export type JSONValue = JSONPrimitive | JSONObject;

export const isJsonPrimitive = (
  value: JSONValue
): value is JSONPrimitive => value === null || typeof value !== "object";
