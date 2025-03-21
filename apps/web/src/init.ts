import { createContext } from '@/lib/context';
import { makeURIComponentCompressor } from "@/lib/string-compressor";

import { createRemoteTablesFactory } from './core';

import TablesWorker from './tables-worker?worker'

export const compressor = makeURIComponentCompressor();

export const appWorker = createRemoteTablesFactory(createContext(), TablesWorker)
