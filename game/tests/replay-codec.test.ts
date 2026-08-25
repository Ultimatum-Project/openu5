/**
 * CODEC del registro de teclas — REDONDEZ y TAMAÑO.
 *
 * El codec es el sitio donde un fallo se vería más lejos de donde está: una tecla mal
 * codificada no rompe nada al grabar, y al reproducir hace divergir la partida cientos
 * de teclas después. Por eso lo que se prueba no es «un caso» sino la propiedad:
 * `decode(encode(x)) === x` para todo x, incluidos los casos que el autor no eligió
 * (teclas fuera del alfabeto, saltos de turno grandes, modificadores).
 */
import { describe, it, expect } from "vitest";
import { encodeEvents, decodeEvents, utf8Bytes } from "../src/replay/codec.js";
import type { ReplayEvent } from "../src/replay/types.js";

function roundTrip(events: ReplayEvent[]): ReplayEvent[] {
  return decodeEvents(encodeEvents(events));
}

describe("codec del registro — redondez", () => {
  it("teclas del juego: comandos, flechas, dígitos y texto escrito", () => {
    const events: ReplayEvent[] = [
      { key: "ArrowUp", turn: 1 },
      { key: "ArrowDown", turn: 2 },
      { key: "t", turn: 2 },
      { key: "I", turn: 2 },
      { key: "o", turn: 2 },
      { key: "l", turn: 2 },
      { key: "o", turn: 2 },
      { key: "Enter", turn: 3 },
      { key: " ", turn: 4 },
      { key: "Escape", turn: 4 },
      { key: "7", turn: 4 },
    ];
    expect(roundTrip(events)).toEqual(events);
  });

  it("modificadores: ctrl / meta / alt / numpad viajan por el sidecar", () => {
    const events: ReplayEvent[] = [
      { key: "k", turn: 1, ctrl: true },
      { key: "a", turn: 2 },
      { key: "8", turn: 3, numpad: true },
      { key: "s", turn: 3, ctrl: true, meta: true, alt: true },
    ];
    expect(roundTrip(events)).toEqual(events);
  });

  it("saltos de turno grandes (acampar avanza muchos turnos de golpe)", () => {
    const events: ReplayEvent[] = [
      { key: "h", turn: 5 },
      { key: "y", turn: 5 },
      { key: "Enter", turn: 485 }, // una acampada entera
      { key: "ArrowUp", turn: 486 },
      { key: "ArrowUp", turn: 100_486 },
    ];
    expect(roundTrip(events)).toEqual(events);
  });

  it("el primer turno es ABSOLUTO: un ancla tomada a mitad de partida se conserva", () => {
    const events: ReplayEvent[] = [{ key: "ArrowUp", turn: 9_431 }];
    expect(roundTrip(events)).toEqual(events);
  });

  it("teclas FUERA del alfabeto (acentos, nombres exóticos) — el formato es total", () => {
    const events: ReplayEvent[] = [
      { key: "ñ", turn: 1 },
      { key: "Á", turn: 1 },
      { key: "€", turn: 1 },
      { key: "AudioVolumeUp", turn: 1 },
      { key: "Unidentified", turn: 2 },
      { key: "a", turn: 2 },
    ];
    expect(roundTrip(events)).toEqual(events);
  });

  it("registro vacío", () => {
    expect(roundTrip([])).toEqual([]);
    expect(encodeEvents([])).toEqual({ keys: "", turns: "", mods: "" });
  });

  it("un stream truncado NO se decodifica en silencio: lanza", () => {
    const good = encodeEvents([
      { key: "ArrowUp", turn: 1 },
      { key: "ArrowDown", turn: 2 },
    ]);
    expect(() => decodeEvents({ ...good, turns: good.turns.slice(0, 1) })).toThrow();
    expect(() => decodeEvents({ ...good, keys: good.keys.slice(0, 1) })).toThrow();
  });
});

describe("codec del registro — TAMAÑO", () => {
  /**
   * PRESUPUESTO. El diseño dice «una hora ≈ 10 KB». Una hora de juego real son del
   * orden de 3.000-5.000 teclas (el jugador pulsa 1-2 teclas/segundo en ráfaga y para
   * a leer). 10 KB / 4.000 teclas = 2,5 BYTES POR TECLA, y ése es el número que este
   * test ata — no el «10 KB», que depende de cuánto teclee el jugador.
   */
  it("cuesta ≤ 2,5 bytes por tecla en una mezcla realista", () => {
    const events: ReplayEvent[] = [];
    let turn = 0;
    const cmds = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "l", "o", "g", " "];
    for (let i = 0; i < 4000; i++) {
      // 1 de cada 8 teclas no cobra turno (comandos que abren un picker, direcciones
      // de apuntado, texto escrito); el resto avanza uno.
      if (i % 8 !== 3) turn += 1;
      events.push({ key: cmds[i % cmds.length]!, turn });
    }
    const enc = encodeEvents(events);
    const bytes = utf8Bytes(enc.keys) + utf8Bytes(enc.turns) + utf8Bytes(enc.mods);
    expect(decodeEvents(enc)).toEqual(events);
    expect(bytes / events.length).toBeLessThanOrEqual(2.5);
  });

  it("es MUCHO más pequeño que el JSON crudo equivalente (el motivo del codec)", () => {
    const events: ReplayEvent[] = Array.from({ length: 1000 }, (_, i) => ({
      key: "ArrowUp",
      turn: i + 1,
    }));
    const enc = encodeEvents(events);
    const compact = utf8Bytes(enc.keys) + utf8Bytes(enc.turns) + utf8Bytes(enc.mods);
    const raw = utf8Bytes(JSON.stringify(events));
    expect(compact * 8).toBeLessThan(raw);
  });
});
