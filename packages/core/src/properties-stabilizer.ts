/** binary insertion sort by stable first-seen position:
 * optimal for near-sorted inputs, which arrays of objects almost always are */
export interface StabilizedEntry<V> {
  key: string;
  value: V;
}

export interface Stabilization<V> {
  entries: StabilizedEntry<V>[];
  /** false when the object's own key order already matches the stable
   * first-seen order, so the original object can be reused as is */
  reordered: boolean;
}

export function makePropertiesStabilizer<V>() {
  const positions = new Map<string, number>();
  const order: string[] = [];

  const positionOf = (key: string): number => {
    let p = positions.get(key);
    if (p === undefined) {
      p = order.length;
      positions.set(key, p);
      order.push(key);
    }
    return p;
  };

  return (obj: Record<string, V>): Stabilization<V> => {
    const pairs: StabilizedEntry<V>[] = [];
    let reordered = false;
    for (const entry of Object.entries(obj)) {
      const key = entry[0];
      const p = positionOf(key);
      // binary insertion: minimal shifts for near-sorted sequences
      let lo = 0;
      let hi = pairs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (positions.get(pairs[mid]!.key)! < p) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      const pair = { key, value: entry[1] as V };
      if (lo === pairs.length) {
        pairs.push(pair);
      } else {
        reordered = true;
        pairs.splice(lo, 0, pair);
      }
    }
    return { entries: pairs, reordered };
  };
}
