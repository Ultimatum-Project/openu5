/**
 * Conversor XMI (Miles Sound System, formato IFF) → Standard MIDI File tipo 0.
 *
 * Formato XMI:
 * - Contenedor IFF: FORM XDIR { INFO(u16 LE = nº canciones) } CAT XMID { FORM XMID { TIMB?, RBRN?, EVNT } ... }
 * - Chunks IFF: fourcc + uint32 BE longitud + datos (padding a par).
 * - EVNT: bytes < 0x80 = acumulación de delay (se SUMAN, no VLQ);
 *   Note On (0x9n) lleva nota, velocidad y DURACIÓN en VLQ (hay que emitir el Note Off);
 *   el resto de eventos MIDI son estándar. Meta FF xx len data.
 * - Timing: los ticks XMI van a 120 Hz fijos. En el MIDI de salida usamos
 *   division=60 ticks/negra con tempo fijo 500000 µs/negra (= 120 ticks/s) e
 *   IGNORAMOS los meta-tempo del XMI (así lo hacen xmi2mid/wildmidi).
 */

function fourcc(data: Uint8Array, off: number): string {
  return String.fromCharCode(
    data[off]!,
    data[off + 1]!,
    data[off + 2]!,
    data[off + 3]!,
  );
}

function u32be(data: Uint8Array, off: number): number {
  return (
    ((data[off]! << 24) |
      (data[off + 1]! << 16) |
      (data[off + 2]! << 8) |
      data[off + 3]!) >>>
    0
  );
}

/** Localiza todos los chunks EVNT (una canción por EVNT). */
function findEvntChunks(data: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  const walk = (start: number, end: number): void => {
    let pos = start;
    while (pos + 8 <= end) {
      const id = fourcc(data, pos);
      const len = u32be(data, pos + 4);
      const body = pos + 8;
      if (id === "FORM" || id === "CAT ") {
        // el body empieza con un subtipo de 4 chars y contiene chunks anidados
        walk(body + 4, body + len);
      } else if (id === "EVNT") {
        out.push(data.subarray(body, body + len));
      }
      pos = body + len + (len & 1); // padding a par
    }
  };
  walk(0, data.length);
  return out;
}

interface MidiEvent {
  tick: number;
  bytes: number[];
  order: number; // desempate estable
}

function writeVlq(value: number, out: number[]): void {
  const stack: number[] = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    stack.push((v & 0x7f) | 0x80);
    v >>= 7;
  }
  while (stack.length) out.push(stack.pop()!);
}

/** Convierte un chunk EVNT de XMI a un SMF tipo 0. */
function evntToMidi(evnt: Uint8Array): Uint8Array {
  const events: MidiEvent[] = [];
  let tick = 0;
  let pos = 0;
  let order = 0;

  const readVlq = (): number => {
    let v = 0;
    for (;;) {
      const b = evnt[pos++]!;
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
  };

  while (pos < evnt.length) {
    const b = evnt[pos]!;
    if (b < 0x80) {
      // acumulación de delay: bytes < 0x80 se suman
      tick += b;
      pos++;
      continue;
    }
    pos++;
    if (b === 0xff) {
      const type = evnt[pos++]!;
      const len = readVlq();
      const payload = Array.from(evnt.subarray(pos, pos + len));
      pos += len;
      if (type === 0x2f) {
        events.push({ tick, bytes: [0xff, 0x2f, 0x00], order: order++ });
        break;
      }
      if (type === 0x51) continue; // ignorar tempo del XMI (timing fijo 120 Hz)
      events.push({ tick, bytes: [0xff, type, len, ...payload], order: order++ });
      continue;
    }
    const status = b & 0xf0;
    const channel = b & 0x0f;
    if (status === 0x90) {
      const note = evnt[pos++]!;
      const vel = evnt[pos++]!;
      const duration = readVlq();
      events.push({ tick, bytes: [0x90 | channel, note, vel], order: order++ });
      // Note Off al final de la duración (vel 0 sobre status 0x90)
      events.push({
        tick: tick + duration,
        bytes: [0x90 | channel, note, 0],
        order: order++,
      });
    } else if (status === 0xc0 || status === 0xd0) {
      events.push({ tick, bytes: [b, evnt[pos++]!], order: order++ });
    } else if (
      status === 0x80 ||
      status === 0xa0 ||
      status === 0xb0 ||
      status === 0xe0
    ) {
      const d1 = evnt[pos++]!;
      const d2 = evnt[pos++]!;
      events.push({ tick, bytes: [b, d1, d2], order: order++ });
    } else {
      throw new Error(`XMI: status desconocido 0x${b.toString(16)} en ${pos}`);
    }
  }

  events.sort((a, b2) => a.tick - b2.tick || a.order - b2.order);

  // Track: tempo fijo 500000 µs/negra; division 60 → 120 ticks/segundo
  const track: number[] = [0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20];
  let lastTick = 0;
  let hasEot = false;
  for (const ev of events) {
    writeVlq(ev.tick - lastTick, track);
    track.push(...ev.bytes);
    lastTick = ev.tick;
    if (ev.bytes[0] === 0xff && ev.bytes[1] === 0x2f) hasEot = true;
  }
  if (!hasEot) track.push(0, 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 60, // MThd, formato 0, 1 track, division 60
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >>> 24) & 0xff,
    (track.length >>> 16) & 0xff,
    (track.length >>> 8) & 0xff,
    track.length & 0xff,
  ];
  return new Uint8Array([...header, ...track]);
}

/** Convierte un fichero .XMI completo; devuelve un MIDI por canción contenida. */
export function xmiToMidi(xmi: Uint8Array): Uint8Array[] {
  const evnts = findEvntChunks(xmi);
  if (evnts.length === 0) throw new Error("XMI: sin chunks EVNT");
  return evnts.map(evntToMidi);
}
