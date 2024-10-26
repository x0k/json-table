import {
  type Request,
  AbstractRemoteActor,
  type ActorMessage,
  AbstractActor,
  type IRemoteActorLogic,
  type RequestMessage,
  type RequestMessageId,
  isResponseMessage,
  MessageType,
} from "./actor";

export class WorkerActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
  > extends AbstractActor<I, R, E, MessageEventSource> {
  // Passed as a callback without `bind` so check `handleMessageEvent`
  // before using `this` in this function
  protected broadcast (msg: ActorMessage<I, R, E>) {
    postMessage(msg);
  }

  private handleMessageEvent = <T extends I["type"]>(
    event: MessageEvent<ActorMessage<Extract<I, Request<T>>, R, E>>
  ) => {
    this.handleActorMessage(
      event.data,
      event.source as MessageEventSource,
      this.broadcast
    );
  };

  protected listen() {
    addEventListener("message", this.handleMessageEvent);
  }

  stop(): void {
    removeEventListener("message", this.handleMessageEvent);
  }
}

export class RemoteWorkerActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
> extends AbstractRemoteActor<I, R, E> {
  private requests = new Set<RequestMessageId>();

  protected sendRequest<T extends I["type"]>(
    req: RequestMessage<Extract<I, Request<T>>>
  ): void {
    this.requests.add(req.id);
    this.worker.postMessage(req);
  }

  private handleMessageEvent = ({
    data,
  }: MessageEvent<ActorMessage<I, R, E>>) => {
    if (isResponseMessage(data)) {
      this.requests.delete(data.requestId);
    }
    this.handleMessage(data);
  };

  private handleErrorEvent = (event: ErrorEvent) => {
    for (const reqId of this.requests) {
      this.handleMessage({
        requestId: reqId,
        type: MessageType.Error,
        error: this.logic.castError(event),
      });
    }
    this.requests.clear();
  };

  constructor(logic: IRemoteActorLogic<E>, private readonly worker: Worker) {
    super(logic);
  }

  start(): void {
    this.worker.addEventListener("message", this.handleMessageEvent);
    this.worker.addEventListener("error", this.handleErrorEvent);
  }
  stop(): void {
    this.worker.removeEventListener("error", this.handleErrorEvent);
    this.worker.removeEventListener("message", this.handleMessageEvent);
  }
}
