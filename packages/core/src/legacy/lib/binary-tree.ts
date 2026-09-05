export interface Node<V, C extends Node<V, C>> {
  value: V
  left?: C
  right?: C
}

export type Tree<V, T extends Node<V, T>> = T | undefined

export function insert<V, N extends Node<V, N>>(tree: Tree<V, N>, node: N) {
  if (tree === undefined) {
    return node
  }
  if (node.value < tree.value) {
    tree.left = insert(tree.left, node)
  } else {
    tree.right = insert(tree.right, node)
  }
  return tree
}

export function traverse<V, N extends Node<V, N>>(tree: Tree<V, N>, cb: (node: N) => void) {
  if (tree !== undefined) {
    traverse(tree.left, cb)
    cb(tree)
    traverse(tree.right, cb)
  }
}
