import type { Context } from "../context.js";

import type { Connection } from "./model.js";

export class WorkerConnection<Incoming, Outgoing>
  implements Connection<Incoming, Outgoing>
{
  private handlers = new Set<(message: Incoming) => void>();

  constructor(private readonly worker: Worker) {}

  start(ctx: Context) {
    this.worker.addEventListener(
      "message",
      (e) => {
        for (const handler of this.handlers) {
          handler(e.data);
        }
      },
      ctx
    );
  }

  send(message: Outgoing) {
    this.worker.postMessage(message);
  }

  onMessage(ctx: Context, handler: (message: Incoming) => void) {
    this.handlers.add(handler);
    ctx.onCancel(() => {
      this.handlers.delete(handler);
    });
  }
}
