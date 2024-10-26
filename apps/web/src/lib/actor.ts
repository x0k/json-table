import { neverError } from './error';

export type ActorId = string;

export enum MessageType {
  Loaded = "loaded",
  Request = "request",
  Success = "success",
  Error = "error",
}

export interface AbstractMessage<T extends MessageType> {
  type: T;
}

export interface LoadedMessage extends AbstractMessage<MessageType.Loaded> {
  id: ActorId;
}

export interface Request<T extends string> {
  type: T;
}

export type RequestMessageId = string;

export interface RequestMessage<I extends Request<string>>
  extends AbstractMessage<MessageType.Request> {
  id: string;
  handlerId: ActorId;
  request: I;
}

export interface AbstractResponseMessage<T extends MessageType>
  extends AbstractMessage<T> {
  requestId: RequestMessageId;
}

export interface SuccessMessage<
  I extends Request<string>,
  R extends Record<I["type"], unknown>
> extends AbstractResponseMessage<MessageType.Success> {
  result: R[I["type"]];
}

export interface ErrorMessage<E>
  extends AbstractResponseMessage<MessageType.Error> {
  error: E;
}

export type ResponseMessage<
  I extends Request<string>,
  R extends Record<string, unknown>,
  E
> = SuccessMessage<I, R> | ErrorMessage<E>;

export type InfoMessage = LoadedMessage;

export type ActorMessage<
  I extends Request<string>,
  R extends Record<string, unknown>,
  E
> = InfoMessage | RequestMessage<I> | ResponseMessage<I, R, E>;

export interface IActorLogic<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E,
  S
> {
  handleRequest<T extends I["type"]>(
    msg: Extract<I, Request<T>>
  ): Promise<R[T]>;
  handleInfo(msg: InfoMessage, sender: S): void;
  castError(error: unknown): E;
}

export interface IActor {
  start(): void;
  stop(): void;
}

export interface IRemoteActorLogic<E> {
  castError(error: unknown): E;
}

export interface IRemoteActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>
> extends IActor {
  call<T extends I["type"]>(
    msg: RequestMessage<Extract<I, Request<T>>>
  ): Promise<R[T]>;
}

export function isResponseMessage<
  I extends Request<string>,
  R extends Record<string, unknown>,
  E
>(msg: ActorMessage<I, R, E>): msg is ResponseMessage<I, R, E> {
  return msg.type === MessageType.Error || msg.type === MessageType.Success;
}

export function makeActorLogic<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E,
  S
>(
  handlers: {
    [K in I["type"]]: (msg: Extract<I, Request<K>>) => R[K] | Promise<R[K]>;
  },
  handleInfo: (msg: InfoMessage, sender: S) => void,
  castError: (e: unknown) => E
): IActorLogic<I, R, E, S> {
  return {
    handleRequest(msg) {
      return Promise.resolve(handlers[msg.type](msg));
    },
    handleInfo,
    castError,
  };
}

export function makeRemoteActorLogic<E>(
  castError: (e: unknown) => E
): IRemoteActorLogic<E> {
  return {
    castError,
  };
}

type RequestResolver<
  I extends Request<string>,
  R extends Record<I["type"], unknown>
> = (value: R[I["type"]] | PromiseLike<R[I["type"]]>) => void;

export abstract class AbstractActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E,
  S
> implements IActor
{
  protected abstract listen(): void;
  protected abstract broadcast(msg: LoadedMessage): void;

  protected async handleActorMessage<T extends I["type"]>(
    msg: ActorMessage<Extract<I, Request<T>>, R, E>,
    sender: S,
    reply: <T extends I["type"]>(
      response: ResponseMessage<Extract<I, Request<T>>, R, E>
    ) => void
  ) {
    switch (msg.type) {
      case MessageType.Error:
      case MessageType.Success:
        break;
      case MessageType.Request: {
        if (msg.handlerId !== this.id) {
          return;
        }
        try {
          const result = await this.logic.handleRequest(msg.request);
          if (result !== undefined) {
            reply({
              requestId: msg.id,
              type: MessageType.Success,
              result,
            });
          }
        } catch (e) {
          reply({
            requestId: msg.id,
            type: MessageType.Error,
            error: this.logic.castError(e),
          });
        }
        break;
      }
      case MessageType.Loaded:
        this.logic.handleInfo(msg, sender);
        break;
      default:
        throw neverError(msg, `Unknown message type: ${msg}`);
    }
  }

  constructor(
    protected readonly id: ActorId,
    protected readonly logic: IActorLogic<I, R, E, S>
  ) {}

  start() {
    this.listen();
    this.broadcast({ type: MessageType.Loaded, id: this.id });
  }

  abstract stop(): void;
}

export abstract class AbstractRemoteActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
> implements IRemoteActor<I, R>
{
  protected abstract sendRequest<T extends I["type"]>(
    req: RequestMessage<Extract<I, Request<T>>>
  ): void;

  private readonly callbacks = new Map<
    RequestMessageId,
    {
      resolve: RequestResolver<I, R>;
      reject: (reason: E) => void;
    }
  >();

  protected handleMessage(data: ActorMessage<I, R, E>) {
    if (!isResponseMessage(data)) {
      return;
    }
    const resolvers = this.callbacks.get(data.requestId);
    if (!resolvers) {
      return;
    }
    this.callbacks.delete(data.requestId);
    switch (data.type) {
      case MessageType.Success:
        return resolvers.resolve(data.result);
      case MessageType.Error:
        return resolvers.reject(data.error);
    }
  }

  constructor(protected readonly logic: IRemoteActorLogic<E>) {}

  async call<T extends I["type"]>(
    msg: RequestMessage<Extract<I, Request<T>>>
  ): Promise<R[T]> {
    const promise = new Promise<R[T]>((resolve, reject) => {
      if (this.callbacks.has(msg.id)) {
        reject(this.logic.castError(new Error("Duplicate request id")));
        return;
      }
      this.callbacks.set(msg.id, {
        resolve: resolve as RequestResolver<I, R>,
        reject,
      });
    });
    this.sendRequest(msg);
    return promise;
  }

  abstract start(): void;
  abstract stop(): void;
}
