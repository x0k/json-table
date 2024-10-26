import type { JSONPrimitive } from "./lib/json.js";

export interface Height {
  height: number;
}

export interface Width {
  width: number;
}

export interface Sized extends Height, Width {}

export enum CellType {
  Header = "header",
  Index = "index",
  Value = "value",
  Corner = "corner",
}

export interface Cell<V = JSONPrimitive> extends Sized {
  value: V;
  type: CellType;
}

export interface Cells<V = JSONPrimitive> {
  cells: Cell<V>[];
  /** Absolute position in row for each cell */
  columns: number[];
}

export interface Rows<V = JSONPrimitive> {
  rows: Cells<V>[];
  /** Absolute position in column for each row */
  indexes: number[];
}

export interface Block<V = JSONPrimitive> extends Sized {
  data: Rows<V>;
}

export interface Table<V = JSONPrimitive> {
  head: Block<V> | null;
  indexes: Block<V> | null;
  body: Block<V>;
}

export type ProportionalResizeGuard = (
  lcmValue: number,
  maxValue: number
) => boolean;

export type RowsScaler<V> = (
  rows: Rows<V>,
  multiplier: number,
) => void;

export type BlockTransformInPlace<V> = (block: Block<V>) => void;

export type BlockTransform<V> = (block: Block<V>) => Block<V>;

export type BlockCompositor<V> = (blocks: Block<V>[]) => Block<V>;

export interface ComposedTable<V = JSONPrimitive> extends Table<V> {
  baked: Block<V>[];
}

export type TableCompositor<V> = (tables: Table<V>[]) => ComposedTable<V>;

export type TableComponent = "head" | "indexes";
export type BlockSizeAspect = "height" | "width";

export const BLOCK_SIZE_ASPECT_OPPOSITES: Record<
  BlockSizeAspect,
  BlockSizeAspect
> = {
  height: "width",
  width: "height",
};

export const TABLE_COMPONENT_SIZE_ASPECTS: Record<
  TableComponent,
  BlockSizeAspect
> = {
  head: "height",
  indexes: "width",
};

export const TABLE_COMPONENT_OPPOSITES: Record<TableComponent, TableComponent> =
  {
    head: "indexes",
    indexes: "head",
  };
