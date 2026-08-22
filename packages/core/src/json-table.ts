export interface Height {
  height: number;
}

export interface Width {
  width: number;
}

export interface Sized extends Height, Width {}

/** protocol symbol: an object may expose a function under this key that
 * returns its prebuilt `Tree` representation, bypassing default parsing */
export const TO_TABLE = Symbol("TO_TABLE");
