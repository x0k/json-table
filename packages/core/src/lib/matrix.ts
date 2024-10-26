import { array } from './array.js'

export type Matrix<T> = T[][]

export function matrix<R> (
  height: number,
  width: number,
  factory: (rowIndex: number) => R
) {
  return array(height, () => array(width, factory))
}

export function transpose<T>(matrix: Matrix<T>): Matrix<T> {
  return matrix[0]!.map((_, i) => matrix.map((x) => x[i]!))
}

export function horizontalMirror<T>(matrix: Matrix<T>): Matrix<T> {
  return matrix.map((row) => row.slice().reverse())
}

export function verticalMirror<T>(matrix: Matrix<T>): Matrix<T> {
  return matrix.slice().reverse()
}

export type TransformCell<T, R> = (
  value: T,
  index: number,
  rowIndex: number
) => R

export function mapCell<T, R>(transform: TransformCell<T, R>) {
  return (matrix: Matrix<T>): Matrix<R> =>
    matrix.map((row, i) => row.map((cell, j) => transform(cell, j, i)))
}
