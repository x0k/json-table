import { CanceledError, type Context } from "../context.js";
import type { Logger } from "../logger.js";
import { neverError } from "../error.js";
import { isOk } from "../result.js";

import {
  MessageType,
  type Connection,
  type ErrorEventMessage,
  type EventMessage,
  type Handlers,
  type IncomingMessage,
  type OutgoingMessage,
  type RequestId,
} from "./model.js";

interface DeferredPromise<T, E> {
  resolve: (value: T) => void;
  reject: (error: E) => void;
}

export function startRemote<
  H extends Handlers<H>,
  E,
  Event extends EventMessage<string, any>
>(
  ctx: Context,
  log: Logger,
  connection: Connection<OutgoingMessage<H, E> | Event, IncomingMessage<H>>,
  eventHandlers: {
    [K in Event["event"]]: (
      e: Extract<Event, EventMessage<K, any>>["payload"]
    ) => void;
  } & {
    [K in ErrorEventMessage<E | CanceledError>["event"]]: (
      e: ErrorEventMessage<E | CanceledError>["payload"]
    ) => void;
  }
) {
  let lastId = 0;
  const promises = new Map<
    RequestId,
    DeferredPromise<
      { [K in keyof H]: ReturnType<H[K]> }[keyof H],
      E | CanceledError
    >
  >();
  ctx.onCancel(() => {
    for (const [, p] of promises) {
      p.reject(new CanceledError());
    }
    promises.clear();
  });
  connection.onMessage(ctx, (msg) => {
    switch (msg.type) {
      case MessageType.Response: {
        const { id, result } = msg;
        const deferred = promises.get(id);
        if (!deferred) {
          log.error(`Received response for unknown request ${id}`);
          return;
        }
        promises.delete(id);
        if (isOk(result)) {
          deferred.resolve(result.value);
        } else {
          deferred.reject(result.error);
        }
        return;
      }
      case MessageType.Event: {
        // @ts-expect-error ts problem
        const handler = eventHandlers[msg.event];
        if (!handler) {
          log.error(`Received unknown event ${msg.event}`);
          return;
        }
        handler(msg.payload);
        return;
      }
      default:
        throw neverError(msg, "Unknown message type");
    }
  });
  return new Proxy(
    {},
    {
      get(_, prop) {
        const request = prop as keyof H;
        return (arg: Parameters<H[typeof request]>[0]) => {
          const id = lastId++ as RequestId;
          const promise = new Promise<ReturnType<H[typeof request]>>(
            (resolve, reject) => {
              promises.set(id, { resolve, reject });
            }
          );
          connection.send({
            id: id,
            request,
            type: MessageType.Request,
            payload: arg,
          });
          return promise;
        };
      },
    }
  ) as H extends Handlers<H>
    ? {
        [K in keyof H]: Parameters<H[K]>["length"] extends 0
          ? () => Promise<Awaited<ReturnType<H[K]>>>
          : (arg: Parameters<H[K]>[0]) => Promise<Awaited<ReturnType<H[K]>>>;
      }
    : never;
}