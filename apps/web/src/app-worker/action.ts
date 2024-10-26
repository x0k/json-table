import type { Request } from "@/lib/actor";

import type { TransformConfig } from './core';

export enum WorkerActionType {
  CreateTable = "create-table",
}

export interface AbstractWorkerAction<T extends WorkerActionType>
  extends Request<T> {}

export interface CreateTableWorkerAction
  extends AbstractWorkerAction<WorkerActionType.CreateTable> {
  data: string;
  transformConfig: TransformConfig;
}

export type WorkerAction = CreateTableWorkerAction;

export interface WorkerActionResult {
  [WorkerActionType.CreateTable]: string;
}