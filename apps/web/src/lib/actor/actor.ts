import type { Context } from '../context.js';
import { err, ok, type Result } from "../result.js";
import { neverError } from "../error.js";

import {
  MessageType,
  type Connection,
  type EventMessage,
  type Handlers,
  type IncomingMessage,
  type OutgoingMessage,
  type RequestMessage,
  type ResponseMessage,
} from "./model.js";

export interface ActorConfig<H extends Handlers<H>, E> {
  connection: Connection<IncomingMessage<H>, OutgoingMessage<H, E>>;
  handlers: H;
  caseError: (error: any) => E;
}

export class Actor<H extends Handlers<H>, E> {
  constructor(
    protected readonly connection: Connection<
      IncomingMessage<H>,
      OutgoingMessage<H, E>
    >,
    protected readonly handlers: H,
    protected readonly caseError: (error: any) => E
  ) {}

  start(ctx: Context) {
    this.connection.onMessage(ctx, this.handleMessage.bind(this));
  }

  private async handleMessage(msg: IncomingMessage<H>) {
    switch (msg.type) {
      case MessageType.Request: {
        const result = await this.handleRequest(msg);
        this.connection.send(result);
        return;
      }
      case MessageType.Event: {
        await this.handleEvent(msg);
        return;
      }
      default:
        throw neverError(msg, "Unknown message type");
    }
  }

  private async handleEvent<K extends keyof H>(
    event: EventMessage<K, Parameters<H[K]>[0]>
  ) {
    try {
      await this.handlers[event.event]!(event.payload);
    } catch (error) {
      this.connection.send({
        type: MessageType.Event,
        event: "error",
        payload: this.caseError(error),
      });
    }
  }

  private async handleRequest<K extends keyof H>(
    request: RequestMessage<K, Parameters<H[K]>[0]>
  ): Promise<ResponseMessage<Result<ReturnType<H[K]>, E>>> {
    try {
      const result = await this.handlers[request.request]!(request.payload);
      return {
        type: MessageType.Response,
        id: request.id,
        result: ok(result),
      };
    } catch (error) {
      return {
        type: MessageType.Response,
        id: request.id,
        result: err(this.caseError(error)),
      };
    }
  }
}
