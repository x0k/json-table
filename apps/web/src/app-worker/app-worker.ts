import { makeActorLogic } from "@/lib/actor";
import { noop } from "@/lib/function";
import { WorkerActor } from "@/lib/worker-actor";

import { APP_WORKER_ID } from "./core";
import { type WorkerAction, type WorkerActionResult, WorkerActionType } from "./action";
import { createTable } from "./create-table";

const logic = makeActorLogic<WorkerAction, WorkerActionResult, string, unknown>(
  {
    [WorkerActionType.CreateTable]: ({ data, transformConfig }) =>
      createTable(data, transformConfig),
  },
  noop,
  String
);
const actor = new WorkerActor(APP_WORKER_ID, logic);
actor.start();
