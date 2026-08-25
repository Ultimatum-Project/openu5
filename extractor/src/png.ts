/** Escritura de PNG RGBA usando pngjs (dependencia ya instalada). */

import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

/**
 * Escribe un buffer RGBA (width·height·4 bytes, 8 bits/canal) como PNG.
 */
export function writePng(
  path: string,
  rgba: Uint8Array,
  width: number,
  height: number,
): void {
  if (rgba.length !== width * height * 4) {
    throw new Error(
      `writePng: buffer de ${rgba.length} bytes no coincide con ${width}×${height}×4`,
    );
  }
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const buffer = PNG.sync.write(png);
  writeFileSync(path, buffer);
}
