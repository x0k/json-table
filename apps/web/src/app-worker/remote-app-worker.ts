import { RemoteWorkerActor } from "@/lib/worker-actor";
import { MessageType, makeRemoteActorLogic } from "@/lib/actor";

import { APP_WORKER_ID, type TransformConfig } from "./core";
import { type WorkerAction, type WorkerActionResult, WorkerActionType } from "./action";
import AppWorker from "./app-worker?worker";

export class RemoteAppWorker extends RemoteWorkerActor<
  WorkerAction,
  WorkerActionResult,
  string
> {
  constructor() {
    super(makeRemoteActorLogic(String), new AppWorker());
  }

  createTable(data: string, transformConfig: TransformConfig) {
    return this.call({
      id: Date.now().toString(16),
      type: MessageType.Request,
      handlerId: APP_WORKER_ID,
      request: {
        type: WorkerActionType.CreateTable,
        data,
        transformConfig,
      },
    });
  }
}
