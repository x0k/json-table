import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

export function makeURIComponentCompressor() {
  return {
    decompress: decompressFromEncodedURIComponent,
    compress: compressToEncodedURIComponent,
  };
}
