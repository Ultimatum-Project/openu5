/**
 * #296 — EL APAGÓN DEL SUEÑO EN CAMA, y sus TRES capas.
 *
 * El original, tras dormir el roster e imprimir «Zzzzzzz...», apaga el interior de la
 * ventana de juego y lo deja apagado toda la noche:
 * ```
 *   0611  call print("Zzzzzzz...")                              ; DS 0x421e
 *   0614  sub ax,ax / push ax / call 0x4af0                     ; ★ set_color(0)
 *   061a  push 8 / push 8 / push 0xb7 / push 0xb7 / call 0x4b26 ; ★ fill_rect INTERIOR
 *   0634… bucle: delay(1 tick) → advance_clock(10) → snap → gate                (no repinta)
 * ```
 * (CMDS.OVL, verbatim del disasm; la lectura completa del bucle está en
 * `re/notes/cama-241-acta.md` §1 y `re/notes/sueno-cama-249.md` §10.)
 *
 * 🔴 LO QUE ESTE FICHERO EXISTE PARA IMPEDIR, y es la razón de que el fix no fuese sólo
 * pintar un rectángulo: en el port `bedSleep` era ATÓMICO (main.ts resolvía las N horas
 * en UN frame), así que una cortina montada y desmontada dentro de ese frame NO LA VE
 * NADIE — y un test que sólo comprobase «se llamó a setBedBlackout(true) y luego a
 * setBedBlackout(false)» habría pasado en VERDE sobre un efecto invisible. Por eso los
 * bloques §2 miden PASOS INTERCALADOS, no llamadas sueltas.
 *
 * Las tres capas, y qué sella cada bloque:
 *   §1 CORE  — partir `bedSleep` en begin/step/end no cambia NADA (eventos, estado, RNG).
 *   §2 UI    — el conductor da 6 pasos por hora con la cortina montada ENTRE medias.
 *   §3 PIEL  — `paintWorldInto` DECLINA con la cortina puesta (la trampa de la #253: sin
 *              esto la piel shader compone el mundo encima de su propio recorte negro).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { BED_STEPS_PER_HOUR, BED_STEP_MINUTES } from "../src/core/world/camp.js";
import { BedSleep, BED_STEP_MS } from "../src/ui/bed-sleep.js";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import { TILE_OFFMAP, VIEW_WINDOW, type ViewSnapshot } from "../src/skin/api.js";

// El conductor usa window.setInterval (browser); en node = globalThis. Igual que camp-sleep.
(globalThis as Record<string, unknown>).window ??= globalThis;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

const THROWN = "Thrown out of bed!\n"; // DS 0x422a
const LOC = 2;
const BX = 5,
  BY = 5;
const FAR: [number, number] = [10, 10];

function world(): WorldData {
  const mk = (): number[][] => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 4));
  const floors: SmallMapFloor[] = [
    { z: 0, tiles: mk() },
    { z: 1, tiles: mk() },
  ];
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(LOC, { id: LOC, name: "Test", floors });
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 4));
  return { overworld: ow, underworld: ow, smallMaps };
}
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

/** Party en la cama de (BX,BY), planta 0. `hour` por defecto 6:00. */
function arnes(slots: NpcSlot[] = [], hour = 6): { game: Game; state: GameState } {
  const state = createNewGame(initial);
  state.position = { location: LOC, floor: 0, x: BX, y: BY };
  state.time.hour = hour;
  state.time.minute = 0;
  const npcManager = new NpcManager(slots.length > 0 ? { [LOC]: slots } : {});
  const game = new Game(initial, world(), gameData, state, { npcManager });
  return { game, state };
}

/** El NPC de la ventana de UNA hora sobre la cama (misma fixture que #241). */
function slotVentana(): NpcSlot {
  return {
    slot: 1,
    aiTypes: [0, 0, 0],
    x: [FAR[0], BX, FAR[0]],
    y: [FAR[1], BY, FAR[1]],
    z: [0, 0, 0],
    times: [0, 8, 9, 9],
    type: 0x12,
    dialogNumber: 0,
  };
}

type Events = ReturnType<Game["bedSleep"]>;
const textos = (evs: Events): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");
/**
 * 🔴 La secuencia de KINDS, no sólo los textos. El mutante M4 —`bedSleep` que LLAMA a
 * `bedSleepEnd` pero no empuja sus eventos— sobrevivía a comparar textos + estado: el
 * `party-changed` perdido no tiene texto y no cambia el estado, sólo deja al HUD sin
 * refrescar. Un evento que se pierde en silencio es justo lo que un aserto de mensajes
 * no puede ver.
 */
const kinds = (evs: Events): string[] => evs.map((e) => e.kind);
/** Foto del estado que el sueño toca: reloj, casilla y estados del roster. */
const foto = (s: GameState): string =>
  JSON.stringify({
    h: s.time.hour,
    m: s.time.minute,
    d: s.time.day,
    x: s.position.x,
    y: s.position.y,
    st: s.characters.slice(0, s.partySize).map((c) => c.status),
  });

describe("#296 §1 — CORE: la versión atómica es la COMPOSICIÓN de las tres piezas", () => {
  it("★ bedSleep(5) == begin + 5·6 steps + end, en EVENTOS y en ESTADO", () => {
    const horas = 5;
    const a = arnes();
    const b = arnes();
    const atomico = a.game.bedSleep(horas);

    const paceado: Events = [...b.game.bedSleepBegin()];
    for (let i = 0; i < horas * BED_STEPS_PER_HOUR; i++) {
      const s = b.game.bedSleepStep();
      paceado.push(...s.events);
      if (s.thrownOut) break;
    }
    paceado.push(...b.game.bedSleepEnd());

    expect(textos(paceado)).toEqual(textos(atomico));
    expect(kinds(paceado), "y la MISMA secuencia de eventos, no sólo los de texto").toEqual(
      kinds(atomico),
    );
    expect(foto(b.state), "misma hora, misma casilla, mismos estados").toBe(foto(a.state));
  });

  it("CONTROL POSITIVO: con UN paso de menos las dos fotos DIFIEREN", () => {
    // Sin este control, la comparación de arriba pasaría igual con un `foto()` ciego a
    // todo lo que el sueño mueve — que es el modo en que un aserto de igualdad miente.
    const horas = 5;
    const a = arnes();
    const b = arnes();
    a.game.bedSleep(horas);
    b.game.bedSleepBegin();
    for (let i = 0; i < horas * BED_STEPS_PER_HOUR - 1; i++) b.game.bedSleepStep();
    b.game.bedSleepEnd();
    expect(foto(b.state)).not.toBe(foto(a.state));
  });

  it("cada paso avanza DIEZ minutos (0x0647 advance_clock(10)), ni 5 ni 60", () => {
    const { game, state } = arnes();
    const antes = state.time.hour * 60 + state.time.minute;
    game.bedSleepBegin();
    game.bedSleepStep();
    const delta = state.time.hour * 60 + state.time.minute - antes;
    expect(delta).toBe(BED_STEP_MINUTES);
  });

  it("«Thrown out of bed!» sale del PASO y lo marca — el bucle no puede seguir a ciegas", () => {
    // El gate del binario (0x0688) termina el sueño: 0x068f NO vuelve a 0x0634. El paso
    // tiene que DECIRLO, porque quien conduce ya no es el bucle del core.
    const { game } = arnes([slotVentana()], 7); // a las 8 el NPC cae sobre la cama
    game.bedSleepBegin();
    let golpe = -1;
    for (let i = 0; i < 9 * BED_STEPS_PER_HOUR; i++) {
      const s = game.bedSleepStep();
      if (s.thrownOut) {
        expect(textos(s.events)).toContain(THROWN);
        golpe = i;
        break;
      }
      expect(textos(s.events), "un paso normal no imprime nada").toEqual([]);
    }
    expect(golpe, "la fixture DEBE echar al party (si no, el bloque no prueba nada)").toBeGreaterThanOrEqual(0);
  });
});

// ── §2 UI: el conductor ───────────────────────────────────────────────────────────────
interface Traza {
  /** Secuencia ORDENADA de lo que hace el conductor: "cortina:on|off" y "paso". */
  eventos: string[];
  aplicados: number;
}

function conductor(opts?: { thrownOutAt?: number }): { ctl: BedSleep; t: Traza } {
  const t: Traza = { eventos: [], aplicados: 0 };
  let paso = 0;
  const game = {
    bedSleepBegin: () => {
      t.eventos.push("begin");
      return [] as never as Events;
    },
    bedSleepStep: () => {
      const thrown = opts?.thrownOutAt === paso;
      paso++;
      t.eventos.push("paso");
      return { events: [] as never as Events, thrownOut: thrown };
    },
    bedSleepEnd: () => {
      t.eventos.push("end");
      return [] as never as Events;
    },
  } as unknown as Game;
  const ctl = new BedSleep({
    game,
    view: { setBedBlackout: (on) => t.eventos.push(on ? "cortina:on" : "cortina:off") },
    hud: { message: () => {} },
    applyEvents: () => {
      t.aplicados++;
    },
    refreshAwaiting: () => {},
    cancelAutoWalk: () => {},
    sceneMs: (ms) => ms,
  });
  return { ctl, t };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("#296 §2 — UI: el sueño se PACEA y la cortina vive ENTRE los pasos", () => {
  it("★ 2 horas = 12 pasos, y la cortina se monta ANTES del primero y se retira DESPUÉS del último", () => {
    const { ctl, t } = conductor();
    ctl.run(2);
    // Antes de que corra ningún tick: la cortina ya está puesta (0x061a va ANTES del bucle).
    expect(t.eventos).toEqual(["begin", "cortina:on"]);
    expect(ctl.sleeping).toBe(true);
    // 12 pasos + UN tick más: el binario entra al bucle POR EL TEST (`0631 jmp 0x63b`) y
    // vuelve a él tras el retardo, así que la salida cuesta una espera de más — el
    // conductor la calca comprobando `done >= steps` al principio del tick siguiente.
    vi.advanceTimersByTime(BED_STEP_MS * (2 * BED_STEPS_PER_HOUR + 1));
    expect(t.eventos.filter((e) => e === "paso")).toHaveLength(2 * BED_STEPS_PER_HOUR);
    // 🔴 EL ASERTO QUE HACE FALSABLE TODO ESTO: la cortina sigue puesta con pasos DENTRO.
    // Un fix que montara y desmontara la cortina en el mismo frame pasaría un
    // «se llamó on y luego off» y fallaría aquí, que es donde vive el efecto.
    const on = t.eventos.indexOf("cortina:on");
    const off = t.eventos.indexOf("cortina:off");
    expect(off).toBeGreaterThan(on);
    const pasosDentro = t.eventos.slice(on, off).filter((e) => e === "paso").length;
    expect(pasosDentro).toBe(2 * BED_STEPS_PER_HOUR);
    expect(ctl.sleeping).toBe(false);
    expect(t.eventos.at(-1)).toBe("end"); // el epílogo va DESPUÉS de retirar la cortina
  });

  it("un paso no ha corrido todavía en el instante 0 (el intervalo, no una ráfaga)", () => {
    const { ctl, t } = conductor();
    ctl.run(1);
    vi.advanceTimersByTime(BED_STEP_MS - 1);
    expect(t.eventos.filter((e) => e === "paso")).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(t.eventos.filter((e) => e === "paso")).toHaveLength(1);
  });

  it("«Thrown out of bed!» corta el sueño: no hay más pasos y la cortina se retira", () => {
    const { ctl, t } = conductor({ thrownOutAt: 2 }); // el 3er paso echa al party
    ctl.run(9); // 54 pasos si nadie lo cortara
    vi.advanceTimersByTime(BED_STEP_MS * 60);
    expect(t.eventos.filter((e) => e === "paso")).toHaveLength(3);
    expect(t.eventos).toContain("cortina:off");
    expect(ctl.sleeping).toBe(false);
  });

  it("reset() a mitad del sueño DESMONTA la cortina y no deja pasos diferidos", () => {
    // La clase de la auditoría R3: cargar partida dentro de la ventana de sueño dejaba
    // el viewport en negro para siempre si el teardown no tocaba la vista.
    const { ctl, t } = conductor();
    ctl.run(9);
    vi.advanceTimersByTime(BED_STEP_MS * 3);
    const pasosAntes = t.eventos.filter((e) => e === "paso").length;
    ctl.reset();
    expect(t.eventos.at(-1)).toBe("cortina:off");
    expect(ctl.sleeping).toBe(false);
    vi.advanceTimersByTime(BED_STEP_MS * 60);
    expect(t.eventos.filter((e) => e === "paso")).toHaveLength(pasosAntes);
  });
});

// ── §3 PIEL: precedencia sobre la capa de mundo del shader ────────────────────────────
describe("#296 §3 — PIEL: paintWorldInto DECLINA con la cortina puesta (trampa #253)", () => {
  /**
   * `this` mínimo de `FaithfulSkin.paintWorldInto`: sólo hace falta que `atlas` sea
   * truthy (la primera guarda) — el bucle de `paintViewportTiles` no toca el ctx porque
   * la ventana va entera a `TILE_OFFMAP` (-1, `if (tile < 0) continue`), así que el
   * CONTROL POSITIVO corre de verdad sin necesitar un canvas.
   */
  const conAtlas = {
    atlas: {} as CanvasImageSource,
    phase: 0,
    anim: [],
    moongateStage: 0,
    personTurnCount: 0,
  };
  const ctx = {} as CanvasRenderingContext2D;
  const snap = (bedBlackout: boolean): ViewSnapshot =>
    ({
      terrainWindow: new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(TILE_OFFMAP),
      zodiacView: null,
      gemView: null,
      dungeon: null,
      bedBlackout,
    }) as unknown as ViewSnapshot;

  const llama = (bedBlackout: boolean): boolean =>
    (FaithfulSkin.prototype.paintWorldInto as (
      this: unknown,
      c: CanvasRenderingContext2D,
      s: ViewSnapshot,
    ) => boolean).call(conAtlas, ctx, snap(bedBlackout));

  it("CONTROL POSITIVO: sin cortina SÍ sirve la capa de terreno", () => {
    expect(llama(false)).toBe(true);
  });

  it("★ con la cortina puesta DECLINA — el shader cae al recorte pleno (ya negro)", () => {
    expect(llama(true)).toBe(false);
  });
});
