/**
 * GRABADOR — el protocolo note/drop/commit.
 *
 * Lo que se prueba aquí es la ASIMETRÍA que hace correcta la captura: una tecla que el
 * juego IGNORA no se graba. No es una optimización de tamaño — es la condición para
 * que la repetición funcione, porque el motivo por el que el juego ignora teclas es a
 * reloj de pared (acampada, refuge, cruce de moongate) y al reproducir a otra
 * velocidad ese motivo YA NO SE DA: la tecla se ejecutaría y la partida divergiría.
 */
import { describe, it, expect } from "vitest";
import { KeyRecorder, measureLog } from "../src/replay/recorder.js";
import { decodeEvents } from "../src/replay/codec.js";

const ANCHOR = { state: '{"turnsSinceStart":0}', seed: 1234 };

function eventsOf(rec: KeyRecorder, label = "x"): ReturnType<typeof decodeEvents> {
  const log = rec.stop(label)!;
  return decodeEvents({ keys: log.keys, turns: log.turns, mods: log.mods });
}

describe("KeyRecorder", () => {
  it("sin grabación abierta, note/commit no acumulan nada", () => {
    const rec = new KeyRecorder();
    rec.note({ key: "a" });
    rec.commit(1);
    expect(rec.recording).toBe(false);
    expect(rec.length).toBe(0);
    expect(rec.stop("x")).toBeNull();
  });

  it("note + commit graba la tecla con el turno RESULTANTE", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "ArrowUp" });
    rec.commit(1);
    rec.note({ key: "ArrowUp" });
    rec.commit(2);
    expect(eventsOf(rec)).toEqual([
      { key: "ArrowUp", turn: 1 },
      { key: "ArrowUp", turn: 2 },
    ]);
  });

  it("🔴 drop() la borra: la tecla que el juego IGNORÓ no entra en el registro", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "ArrowUp" });
    rec.commit(1);
    rec.note({ key: "F10" }); // el usuario abre el menú SISTEMA a mitad de partida
    rec.drop();
    rec.commit(1); // el commit de cola llega igual: debe ser un no-op
    rec.note({ key: "ArrowDown" });
    rec.commit(2);
    expect(eventsOf(rec)).toEqual([
      { key: "ArrowUp", turn: 1 },
      { key: "ArrowDown", turn: 2 },
    ]);
  });

  it("una tecla sin turno propio (abre un picker) se graba con el turno de antes", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "r" }); // Ready: abre el picker, no cobra turno
    rec.commit(7);
    rec.note({ key: "Enter" }); // equipa: ahora sí
    rec.commit(8);
    expect(eventsOf(rec)).toEqual([
      { key: "r", turn: 7 },
      { key: "Enter", turn: 8 },
    ]);
  });

  it("captura los modificadores que el reductor mira (ctrl/meta/alt/numpad)", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "k", ctrlKey: true });
    rec.commit(1);
    rec.note({ key: "8", code: "Numpad8" });
    rec.commit(2);
    rec.note({ key: "8", code: "Digit8" });
    rec.commit(2);
    expect(eventsOf(rec)).toEqual([
      { key: "k", turn: 1, ctrl: true },
      { key: "8", turn: 2, numpad: true },
      { key: "8", turn: 2 },
    ]);
  });

  it("el registro guarda el ancla ENTERA (estado + semilla del RNG)", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "a" });
    rec.commit(1);
    const log = rec.stop("mi partida")!;
    expect(log.anchor).toEqual(ANCHOR);
    expect(log.label).toBe("mi partida");
    expect(log.count).toBe(1);
    expect(log.lastTurn).toBe(1);
    expect(log.v).toBe(1);
  });

  it("stop() cierra: una segunda llamada no devuelve un registro fantasma", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "a" });
    rec.commit(1);
    expect(rec.stop("x")).not.toBeNull();
    expect(rec.recording).toBe(false);
    expect(rec.stop("x")).toBeNull();
  });

  it("start() sobre una grabación abierta descarta la anterior", () => {
    const rec = new KeyRecorder();
    rec.start(ANCHOR);
    rec.note({ key: "a" });
    rec.commit(1);
    rec.start({ state: "{}", seed: 9 });
    expect(rec.length).toBe(0);
    expect(rec.stop("x")!.anchor.seed).toBe(9);
  });

  it("measureLog separa el ancla (coste ÚNICO) del stream de teclas (el que crece)", () => {
    const rec = new KeyRecorder();
    rec.start({ state: "x".repeat(18_000), seed: 1 });
    for (let i = 1; i <= 500; i++) {
      rec.note({ key: "ArrowUp" });
      rec.commit(i);
    }
    const m = measureLog(rec.stop("x")!);
    expect(m.anchorBytes).toBeGreaterThan(17_000);
    expect(m.keysBytes).toBe(1000); // 500 teclas × (1 char tecla + 1 char turno)
    expect(m.bytesPerKey).toBe(2);
  });
});
