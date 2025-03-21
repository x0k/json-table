import { noop } from "./function.js";

export interface Context {
  readonly signal: AbortSignal;
  onCancel(action: () => void): Disposable;
}

function createContextFromSignal(signal: AbortSignal): Context {
  return {
    signal,
    onCancel(action) {
      if (signal.aborted) {
        action();
        return { [Symbol.dispose]: noop };
      }
      const dispose = () => signal.removeEventListener("abort", handler);
      const handler = () => {
        dispose();
        action();
      };
      signal.addEventListener("abort", handler);
      return { [Symbol.dispose]: dispose };
    },
  };
}

export function createContext(): Context {
  const ctrl = new AbortController();
  return createContextFromSignal(ctrl.signal);
}

export function withCancel(ctx: Context): [Context, () => void] {
  const ctrl = new AbortController();
  const signal = AbortSignal.any([ctx.signal, ctrl.signal]);
  return [createContextFromSignal(signal), ctrl.abort.bind(ctrl)];
}

export function withTimeout(ctx: Context, timeoutInMs: number): Context {
  const signal = AbortSignal.any([
    ctx.signal,
    AbortSignal.timeout(timeoutInMs),
  ]);
  return createContextFromSignal(signal);
}

export class CanceledError extends Error {
  constructor() {
    super("Context is canceled");
  }
}

export function inContext<T>(ctx: Context, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) {
      reject(new CanceledError());
      return;
    }
    const cancel = () => {
      reject(new CanceledError());
    };
    ctx.signal.addEventListener("abort", cancel);
    promise.then(resolve, reject).finally(() => {
      ctx.signal.removeEventListener("abort", cancel);
    });
  });
}

export interface RecoverableContext extends Disposable {
  ref: Context;
  cancel: () => void;
}

export function createRecoverableContext(
  contextFactory: () => [Context, () => void]
): RecoverableContext {
  let [ref, cancel] = contextFactory();
  const disposable = ref.onCancel(function handleCancel() {
    [ref, cancel] = contextFactory();
    recoverable.ref = ref;
    recoverable.cancel = cancel;
    recoverable[Symbol.dispose] = ref.onCancel(handleCancel)[Symbol.dispose];
  });
  const recoverable: RecoverableContext = {
    ref,
    cancel,
    [Symbol.dispose]: disposable[Symbol.dispose],
  };
  return recoverable;
}
