import type { ProportionalResizeGuard } from '../json-table.js';

export function makeProportionalResizeGuard(
  threshold: number
): ProportionalResizeGuard {
  return (lcmValue: number, maxValue: number) =>
    (lcmValue - maxValue) / maxValue <= threshold;
}
