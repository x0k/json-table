import { stringify } from './json';

export function neverError(value: never, message: string) {
  return new Error(`${message}: ${value}`);
}

export function stringifyError(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === "object") {
    if ("toString" in err && typeof err.toString === "function") {
      const str = err.toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
    return stringify(err);
  }
  return String(err);
}
