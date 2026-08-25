/**
 * CODIFICACIÓN COMPACTA del registro de teclas.
 *
 * El objetivo declarado del diseño es ~10 KB por HORA de juego. Un `JSON.stringify`
 * de `[{key:"ArrowUp",turn:12},…]` cuesta ~25 B por tecla — a 3.000-5.000 teclas/hora
 * son 75-125 KB. Así que las teclas van a UN CARÁCTER cada una:
 *
 *   · ASCII imprimible (0x20-0x7E) → el propio carácter (comandos, dígitos, y todo lo
 *     que el jugador ESCRIBE: nombres inventados, palabras de Yell).
 *   · teclas con nombre (flechas, Enter, Escape, F1-F12…) → un carácter de la tabla
 *     `NAMED`, en el bloque de control 0x01-0x19.
 *   · cualquier otra cosa (una tecla acentuada, un nombre exótico) → escape
 *     0x7F + el nombre literal + 0x00. No se pierde nada: el formato es TOTAL.
 *
 * Los turnos van en un stream PARALELO de la misma longitud, como DELTAS (el delta es
 * 0 o 1 en la abrumadora mayoría de teclas), un carácter cada uno, con el mismo escape
 * para los saltos grandes (acampar avanza muchos turnos de golpe).
 *
 * Los modificadores (ctrl/meta/alt/numpad) son RAROS, así que no pagan un carácter por
 * tecla: van en un sidecar `índice:flags` separado por comas.
 *
 * 🔴 El codec es TOTAL y REDONDO por construcción, y así lo comprueba su test: para
 * cualquier lista de eventos, `decode(encode(x)) === x`. Si no lo fuera, la repetición
 * divergiría en la tecla que el codec estropea y el fallo aparecería a kilómetros del
 * defecto.
 */
import type { ReplayEvent } from "./types.js";

/** Teclas con nombre → códigos 0x01..0x19. El ORDEN es el formato: no se reordena. */
const NAMED: readonly string[] = [
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Enter", "Escape", "Backspace", "Tab", "Delete",
  "Home", "End", "PageUp", "PageDown",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
];
const NAMED_INDEX = new Map(NAMED.map((n, i) => [n, i]));

/** Marca de escape y su terminador. Ninguna tecla real contiene un NUL. */
const ESC = "\x7f";
const END = "\x00";
/** Base del alfabeto de deltas: delta d ⇒ carácter 0x30+d, para d ≤ 76. */
const DELTA_BASE = 0x30;
const DELTA_MAX = 76; // 0x30+76 = 0x7C, justo por debajo del ESC

const F_CTRL = 1;
const F_META = 2;
const F_ALT = 4;
const F_NUMPAD = 8;

function encodeKey(key: string): string {
  const named = NAMED_INDEX.get(key);
  if (named !== undefined) return String.fromCharCode(named + 1);
  if (key.length === 1) {
    const c = key.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e) return key;
  }
  return ESC + key + END;
}

function encodeDelta(d: number): string {
  if (d >= 0 && d <= DELTA_MAX) return String.fromCharCode(DELTA_BASE + d);
  return ESC + d.toString(36) + END;
}

export interface EncodedStreams {
  keys: string;
  turns: string;
  mods: string;
}

/** Eventos → los tres streams del registro. */
export function encodeEvents(events: readonly ReplayEvent[]): EncodedStreams {
  let keys = "";
  let turns = "";
  const mods: string[] = [];
  let prevTurn = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    keys += encodeKey(e.key);
    // El delta se toma contra el turno de la tecla ANTERIOR (el primero, contra 0):
    // el ancla se guarda con su propio `turnsSinceStart` dentro del estado, así que
    // el primer delta es "cuántos turnos costó la primera tecla" sólo si el ancla
    // arranca en 0 — por eso el turno se guarda ABSOLUTO en el primer evento.
    turns += encodeDelta(i === 0 ? e.turn : e.turn - prevTurn);
    prevTurn = e.turn;
    let f = 0;
    if (e.ctrl) f |= F_CTRL;
    if (e.meta) f |= F_META;
    if (e.alt) f |= F_ALT;
    if (e.numpad) f |= F_NUMPAD;
    if (f) mods.push(`${i}:${f}`);
  }
  return { keys, turns, mods: mods.join(",") };
}

/** Lee un campo escapado (ESC ya consumido) y devuelve [valor, posición tras END]. */
function readEscaped(s: string, from: number): [string, number] {
  const end = s.indexOf(END, from);
  if (end < 0) throw new Error("replay/codec: escape sin terminador");
  return [s.slice(from, end), end + 1];
}

/** Los tres streams → eventos. Inversa exacta de `encodeEvents`. */
export function decodeEvents(streams: EncodedStreams): ReplayEvent[] {
  const modByIndex = new Map<number, number>();
  if (streams.mods) {
    for (const part of streams.mods.split(",")) {
      const [i, f] = part.split(":");
      modByIndex.set(Number(i), Number(f));
    }
  }
  const out: ReplayEvent[] = [];
  let ki = 0;
  let ti = 0;
  let turn = 0;
  while (ki < streams.keys.length) {
    let key: string;
    const c = streams.keys[ki]!;
    if (c === ESC) {
      [key, ki] = readEscaped(streams.keys, ki + 1);
    } else {
      const code = c.charCodeAt(0);
      key = code >= 1 && code <= NAMED.length ? NAMED[code - 1]! : c;
      ki += 1;
    }
    let delta: number;
    const t = streams.turns[ti];
    if (t === undefined) throw new Error("replay/codec: faltan turnos para las teclas");
    if (t === ESC) {
      let raw: string;
      [raw, ti] = readEscaped(streams.turns, ti + 1);
      delta = parseInt(raw, 36);
    } else {
      delta = t.charCodeAt(0) - DELTA_BASE;
      ti += 1;
    }
    const idx = out.length;
    turn = idx === 0 ? delta : turn + delta;
    const ev: ReplayEvent = { key, turn };
    const f = modByIndex.get(idx) ?? 0;
    if (f & F_CTRL) ev.ctrl = true;
    if (f & F_META) ev.meta = true;
    if (f & F_ALT) ev.alt = true;
    if (f & F_NUMPAD) ev.numpad = true;
    out.push(ev);
  }
  if (ti !== streams.turns.length) throw new Error("replay/codec: sobran turnos");
  return out;
}

/** Bytes UTF-8 de una cadena — la MEDIDA del tamaño, no una estimación por longitud. */
export function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}
