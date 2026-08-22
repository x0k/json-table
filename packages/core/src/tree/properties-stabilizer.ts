/** binary insertion sort by stable first-seen position:
 * optimal for near-sorted inputs, which arrays of objects almost always are */
export interface StabilizedEntry<V> {
  key: string;
  value: V;
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

  return (obj: Record<string, V>): StabilizedEntry<V>[] => {
    const pairs: StabilizedEntry<V>[] = [];
    for (const entry of Object.entries(obj)) {
      const p = positionOf(entry[0]);
      // binary insertion: minimal shifts for near-sorted sequences
      let lo = 0;
      let hi = pairs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const midKey = pairs[mid]!.key;
        if (positionOf(midKey) < p) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      pairs.splice(lo, 0, { key: entry[0], value: entry[1] as V });
    }
    return pairs;
  };
}
