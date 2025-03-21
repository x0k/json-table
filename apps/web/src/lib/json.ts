export function stringify(obj: any, spaces?: number | string) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    },
    spaces
  );
}
