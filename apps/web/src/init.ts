import { makeURIComponentCompressor } from "@/lib/string-compressor";

import { RemoteAppWorker } from './app-worker';

export const compressor = makeURIComponentCompressor();

export const appWorker = new RemoteAppWorker();
appWorker.start()
