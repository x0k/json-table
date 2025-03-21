import {
  Actor,
  startRemote,
  WorkerConnection,
  type IncomingMessage,
  type OutgoingMessage,
} from "@/lib/actor";
import { CanceledError, type Context } from "@/lib/context";
import { stringifyError } from "@/lib/error";

import type { TransformConfig } from "./model";
import { createTable } from "./create-table";

interface CreateTableOptions {
  data: string;
  config: TransformConfig;
}

interface Handlers {
  createTable(options: CreateTableOptions): Promise<string>;
}

type Outgoing = OutgoingMessage<Handlers, string>;

type Incoming = IncomingMessage<Handlers>;

export function startTablesFactoryWorker(ctx: Context) {
  const connection = new WorkerConnection<Incoming, Outgoing>(
    self as unknown as Worker
  );
  connection.start(ctx);
  const actor = new Actor<Handlers, string>(
    connection,
    {
      createTable({ data, config: transformConfig }) {
        return createTable(data, transformConfig);
      },
    },
    stringifyError
  );
  actor.start(ctx);
}

interface WorkerConstructor {
  new (): Worker;
}

export function createRemoteTablesFactory(
  ctx: Context,
  Worker: WorkerConstructor
) {
  const worker = new Worker();
  ctx.onCancel(() => {
    worker.terminate();
  });
  const connection = new WorkerConnection<Outgoing, Incoming>(worker);
  connection.start(ctx);
  return startRemote<Handlers, string, never>(ctx, console, connection, {
    error(err) {
      console.log(err instanceof CanceledError ? err.message : err);
    },
  });
}

