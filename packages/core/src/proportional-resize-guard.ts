export type ProportionalResizeGuard = (
  lcmValue: number,
  maxValue: number
) => boolean;

export function makeProportionalResizeGuard(
  threshold: number
): ProportionalResizeGuard {
  return (lcmValue: number, maxValue: number) =>
    (lcmValue - maxValue) / maxValue <= threshold;
}
