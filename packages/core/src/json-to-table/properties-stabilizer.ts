import { type Node, type Tree, insert, traverse } from "../lib/binary-tree.js";

interface KeyNode<V> extends Node<number, KeyNode<V>> {
  key: string;
  val: V;
}

export function makeObjectPropertiesStabilizer<V>() {
  let index = 0;
  const order: Record<string, KeyNode<V>> = {};
  return (obj: Record<string, V>) => {
    const entries = Object.entries(obj);
    let tree: Tree<number, KeyNode<V>> = undefined;
    for (const [key, val] of entries) {
      const node = (order[key] ??= {
        key,
        val,
        value: index++,
      });
      node.val = val;
      node.left = undefined;
      node.right = undefined;
      tree = insert(tree, node);
    }
    const keys: string[] = [];
    const values: V[] = [];
    traverse(tree, (node) => {
      keys.push(node.key);
      values.push(node.val);
    });
    return [keys, values] as const;
  };
}
