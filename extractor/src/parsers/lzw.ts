/**
 * Descompresor LZW de Ultima V/VI — port fiel de u6decode.cc
 * (reference/Ultima5Redux/U6Decode/u6decode.cc, el descompresor que el autor
 * de Ultima5Redux usó realmente para los .16/.4 de Ultima V).
 *
 * Formato de fichero: uint32 LE (longitud descomprimida) + stream LZW.
 * - Códigos de ancho VARIABLE 9→12 bits, orden LSB-first.
 * - 0x000-0x0FF: literales.
 * - 0x100: reinicio de diccionario (también es el primer código del fichero).
 * - 0x101: fin de stream.
 * - Códigos nuevos desde 0x102; el ancho crece (9→10→11→12) cuando
 *   nextFreeCodeword alcanza el tamaño del diccionario (0x200→0x400→0x800).
 *
 * Spec: docs/formats/tiles-lzw.md §1.
 */

const MAX_CODEWORD_LENGTH = 12;

class LsbBitReader {
  private bitsRead = 0;

  constructor(private data: Uint8Array) {}

  readCode(width: number): number {
    const byteIdx = this.bitsRead >> 3;
    const b0 = this.data[byteIdx] ?? 0;
    const b1 = this.data[byteIdx + 1] ?? 0;
    const b2 = this.data[byteIdx + 2] ?? 0;
    const word = (b2 << 16) | (b1 << 8) | b0;
    const code = (word >> (this.bitsRead & 7)) & ((1 << width) - 1);
    this.bitsRead += width;
    return code;
  }

  get atEnd(): boolean {
    return this.bitsRead >> 3 >= this.data.length;
  }
}

/** Descomprime el stream LZW crudo (sin el header uint32) a exactamente `expectedLength` bytes. */
export function decompressLzwStream(
  stream: Uint8Array,
  expectedLength: number,
): Uint8Array {
  const out = new Uint8Array(expectedLength);
  let outPos = 0;
  const write = (b: number) => {
    if (outPos >= expectedLength) {
      throw new Error(`LZW: salida excede la longitud esperada ${expectedLength}`);
    }
    out[outPos++] = b;
  };

  // Diccionario: entrada i (>=0x102) = { prefixCode, rootChar }
  const dictSizeMax = 1 << MAX_CODEWORD_LENGTH;
  const prefix = new Int32Array(dictSizeMax);
  const root = new Uint8Array(dictSizeMax);

  let codewordSize = 9;
  let nextFree = 0x102;
  let dictionarySize = 0x200;

  const reader = new LsbBitReader(stream);
  const stack: number[] = [];

  /** Apila la cadena del código (raíz al final del recorrido queda arriba). */
  const buildString = (code: number): void => {
    stack.length = 0;
    let current = code;
    while (current > 0xff) {
      stack.push(root[current]!);
      current = prefix[current]!;
    }
    stack.push(current & 0xff);
  };

  let pW = -1;

  for (;;) {
    if (reader.atEnd) throw new Error("LZW: fin de datos sin marcador 0x101");
    const cW = reader.readCode(codewordSize);

    if (cW === 0x101) break; // fin

    if (cW === 0x100) {
      // Reinicio de diccionario; el siguiente código es un literal que se emite directo
      codewordSize = 9;
      nextFree = 0x102;
      dictionarySize = 0x200;
      const first = reader.readCode(codewordSize);
      write(first & 0xff);
      pW = first;
      continue;
    }

    let c: number;
    if (cW < nextFree) {
      // código ya en diccionario
      buildString(cW);
      c = stack[stack.length - 1]!; // primer char de la cadena
      for (let i = stack.length - 1; i >= 0; i--) write(stack[i]!);
      prefix[nextFree] = pW;
      root[nextFree] = c;
    } else {
      // caso KwKwK: código aún no definido
      buildString(pW);
      c = stack[stack.length - 1]!;
      for (let i = stack.length - 1; i >= 0; i--) write(stack[i]!);
      write(c);
      if (cW !== nextFree) throw new Error("LZW: stream corrupto (cW != nextFree)");
      prefix[nextFree] = pW;
      root[nextFree] = c;
    }
    nextFree++;
    if (nextFree >= dictionarySize && codewordSize < MAX_CODEWORD_LENGTH) {
      codewordSize++;
      dictionarySize *= 2;
    }
    pW = cW;
  }

  if (outPos !== expectedLength) {
    throw new Error(`LZW: longitud descomprimida ${outPos} != esperada ${expectedLength}`);
  }
  return out;
}

/**
 * Descomprime un fichero LZW de Ultima V completo:
 * uint32 LE de longitud descomprimida en offset 0, stream desde offset 4.
 */
export function decompressLzw(file: Uint8Array): Uint8Array {
  if (file.length < 6) throw new Error("LZW: fichero demasiado corto");
  const expected =
    (file[0]! | (file[1]! << 8) | (file[2]! << 16) | (file[3]! << 24)) >>> 0;
  return decompressLzwStream(file.subarray(4), expected);
}
