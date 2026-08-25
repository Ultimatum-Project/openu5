/**
 * ★ #176 — LATCH DE FASES LUNARES: pasar medianoche BAJO TIERRA congela las fases de ayer.
 *
 * El original no recalcula las fases por día en cada consulta: las LATCHEA en dos globales
 * del estado guardado (`g_felucca_phase` DS:0x5885 → save +0x2DF, `g_trammel_phase`
 * DS:0x5886 → +0x2E0) y sólo las reescribe en la cola de `advance_clock`, bajo tres
 * guardas (`re/disasm/ULTIMA.EXE.asm`, verbatim):
 *
 *     514a: a08058      mov al, byte ptr [g_prev_hour]
 *     514d: 38067f58    cmp byte ptr [g_hour], al
 *     5151: 7433        je 0x5186              ; (1) sólo si CAMBIÓ la hora
 *     5153: 803e935821  cmp byte ptr [g_location], 0x21
 *     5158: 730a        jae 0x5164             ; (2) mazmorra → NO refresca
 *     515a: 803e955880  cmp byte ptr [g_floor], 0x80
 *     515f: 7303        jae 0x5164             ; (3) bajo tierra → NO refresca
 *     5161: e820f9      call 0x4a84            ; draw_sky_strip latchea las DOS fases
 *
 * Mientras tanto `g_day` sube SIN ninguna de las tres (`0x5051 inc [g_day]`). ⇒ cruzar
 * medianoche en mazmorra o en el Underworld deja las fases de AYER hasta la siguiente
 * frontera de hora en superficie — y fase distinta ⇒ moonstone distinta ⇒ **la moongate
 * te manda a otro sitio**. Ésa es la mecánica que este fichero fija.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { advanceClock, type SkyRefreshCtx } from "../src/core/world/survival.js";
import {
  activeGatePhase,
  latchedMoonPhases,
  moonPhasesForDay,
  moongateDestination,
} from "../src/core/world/moongates.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  exportNativeSave,
  importNativeSave,
  SAVED_GAM_SIZE,
  type SaveSidecar,
} from "../src/core/saveNative.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

let moonPhases: number[];
let init: ExtractedInitialState;

beforeAll(() => {
  moonPhases = readJson<{ moonPhases: number[] }>("data.json").moonPhases;
  init = readJson("initial-state.json");
});

/** Location de una mazmorra cualquiera (0x21..0x28) para la guarda 2. */
const DUNGEON_LOCATION = 0x22;

/**
 * Día de partida del experimento. Se elige DERIVADO, no a ojo: hace falta que la fase de
 * Felucca de `DAY` y la de `DAY+1` DIFIERAN, o el test pasaría con y sin latch. El
 * `expect` de abajo lo comprueba antes de medir nada.
 */
const DAY = 1;

/**
 * Estado a las 23:50 del día `DAY`, en la posición/piso que se pida.
 *
 * ⚠ El latch de partida NO se siembra a mano: se ADQUIERE por el camino real —una
 * frontera de hora en SUPERFICIE, que es el único escritor— antes de mover al jugador
 * adonde toque. Sembrarlo a mano haría que los casos «no refresca» pasaran también con
 * el refresco desconectado, y el fichero mediría las guardas en vez de la mecánica.
 */
function stateAt(opts: { floor?: number } = {}): GameState {
  const st = createNewGame(init);
  st.time.day = DAY;
  st.time.hour = 22;
  st.time.minute = 50;
  st.position.location = 0;
  st.position.floor = 0;
  advanceClock(st, 20, undefined, sky(0)); // 23:10 en superficie → latchea el día DAY
  st.time.minute = 50;
  st.position.floor = opts.floor ?? 0;
  return st;
}

/** Contexto del refresco tal y como lo produce `Game.skyRefreshCtx`. */
const sky = (location: number): SkyRefreshCtx => ({ moonPhasesRaw: moonPhases, location });

/** Cruza la medianoche: 23:50 → 00:10 del día siguiente (fuera del edge de 0x494d). */
function crossMidnight(st: GameState, ctx: SkyRefreshCtx | undefined): void {
  advanceClock(st, 20, undefined, ctx);
}

describe("#176 · latch de fases lunares (advance_clock cola 0x514a-0x5161)", () => {
  it("PRECONDICIÓN del experimento: la fase de Felucca CAMBIA de DAY a DAY+1", () => {
    // Sin esto, los dos casos de abajo darían el mismo número y el test no mediría nada.
    expect(moonPhasesForDay(moonPhases, DAY).felucca).not.toBe(
      moonPhasesForDay(moonPhases, DAY + 1).felucca,
    );
  });

  it("★ CONTROL POSITIVO — en SUPERFICIE, cruzar medianoche SÍ refresca el latch", () => {
    const st = stateAt();
    crossMidnight(st, sky(0));
    expect(st.time.day).toBe(DAY + 1);
    // Se comprueban los BYTES CRUDOS, no sólo el par leído: `latchedMoonPhases` cae al
    // cálculo por día cuando el latch está vacío, así que sin esta aserción el control
    // pasaría también con el refresco desconectado — verde EN FALSO.
    expect(st.feluccaPhase).toBe(moonPhases[DAY * 2]);
    expect(st.trammelPhase).toBe(moonPhases[DAY * 2 + 1]);
    expect(latchedMoonPhases(st, moonPhases, st.time.day)).toEqual(
      moonPhasesForDay(moonPhases, DAY + 1),
    );
  });

  it("★ #184 · advanceClock(0) NO retorna en seco: corre la COLA sin tocar el reloj", () => {
    // `4f84 cmp word ptr [bp+4],0 / 4f88 jne 0x4f8d` y, con cero, `4f8a jmp 0x50a1` —
    // que NO es el ret, es la cola de la propia rutina. Se salta el reloj Y el snapshot
    // de 0x4fa0 (`g_prev_hour = g_hour`), así que el flanco de la cola se evalúa contra
    // el prevHour de la llamada ANTERIOR. Inalcanzable por los call-sites de hoy (los 14
    // pasan constantes positivas); el test llama a advanceClock DIRECTAMENTE, que es la
    // única vía de medirlo, y existe para que dejar de ser inalcanzable no diverja.
    const st = stateAt();
    // El latch conserva las fases de DAY —índice (day-1)*2, ver moonPhasesForDay— y el
    // día ya es DAY+1, cuyas fases están en moonPhases[DAY*2].
    st.time.day = DAY + 1;
    st.feluccaPhase = moonPhases[(DAY - 1) * 2]!;
    st.trammelPhase = moonPhases[(DAY - 1) * 2 + 1]!;
    st.prevHour = (st.time.hour + 1) % 24; // FLANCO abierto: hour !== prevHour

    // PRECONDICIÓN ASERTADA: sin flanco y sin fase distinta el caso no mediría nada.
    // (La primera versión de este test usaba la indexación equivocada y fue ESTA línea
    //  la que lo cazó: sin ella el caso habría pasado sin medir el refresco.)
    expect(st.time.hour).not.toBe(st.prevHour);
    expect(moonPhases[(DAY - 1) * 2]).not.toBe(moonPhases[DAY * 2]);

    const relojAntes = { ...st.time };
    const prevAntes = st.prevHour;
    advanceClock(st, 0, undefined, sky(0));

    // (a) el reloj NO se movió y el snapshot NO se tomó (0x4fa0 queda saltado)
    expect(st.time).toEqual(relojAntes);
    expect(st.prevHour).toBe(prevAntes);
    // (b) y AUN ASÍ la cola corrió: el latch se reescribió a las fases de DAY+1
    expect(st.feluccaPhase).toBe(moonPhases[DAY * 2]);
    expect(st.trammelPhase).toBe(moonPhases[DAY * 2 + 1]);
  });

  it("★ EN MAZMORRA, cruzar medianoche NO refresca: quedan las fases de AYER", () => {
    const st = stateAt();
    crossMidnight(st, sky(DUNGEON_LOCATION));
    expect(st.time.day).toBe(DAY + 1); // el día SÍ sube (0x5051, sin guardas)
    expect(latchedMoonPhases(st, moonPhases, st.time.day)).toEqual(
      moonPhasesForDay(moonPhases, DAY),
    );
  });

  it("★ y por eso la MOONGATE lleva a otro sitio que el recálculo por día", () => {
    // El síntoma que hace que esto sea mecánica y no cosmética.
    const st = stateAt();
    crossMidnight(st, sky(DUNGEON_LOCATION));
    st.position.location = 0; // ya fuera de la mazmorra, aún sin frontera de hora

    const conLatch = moongateDestination(st, st.time, moonPhases);
    const porDia = st.moonstones[moonPhasesForDay(moonPhases, st.time.day).felucca]!;
    expect(conLatch).not.toBeNull();
    expect([conLatch!.x, conLatch!.y]).not.toEqual([porDia.x, porDia.y]);

    // Y es exactamente la piedra de la fase de AYER.
    const ayer = st.moonstones[moonPhasesForDay(moonPhases, DAY).felucca]!;
    expect([conLatch!.x, conLatch!.y]).toEqual([ayer.x, ayer.y]);
  });

  it("bajo tierra (Underworld 0xFF) tampoco refresca — guarda 3", () => {
    const st = stateAt({ floor: 0xff });
    crossMidnight(st, sky(0));
    expect(latchedMoonPhases(st, moonPhases, st.time.day)).toEqual(
      moonPhasesForDay(moonPhases, DAY),
    );
  });

  it("en SÓTANO (z = −1) tampoco refresca — la guarda es por BYTE (#171)", () => {
    // `cmp byte ptr [g_floor],0x80 / jae` compara SIN SIGNO; en el clon el sótano es −1,
    // que como byte es 0xFF. Sin enmascarar, `-1 >= 0x80` sería false y el sótano se
    // colaría. `isBelowGround` ya hace la cuenta; esto la fija para este consumidor.
    const st = stateAt({ floor: -1 });
    crossMidnight(st, sky(0));
    expect(latchedMoonPhases(st, moonPhases, st.time.day)).toEqual(
      moonPhasesForDay(moonPhases, DAY),
    );
  });

  it("sin CAMBIO DE HORA no se re-latchea — guarda 1 (0x5151 je)", () => {
    // Control negativo del control positivo: si el refresco corriera en cada llamada,
    // este caso también latchearía y el test de mazmorra pasaría por el motivo equivocado.
    const st = stateAt();
    st.time.hour = 12;
    st.time.minute = 0;
    st.time.day = DAY + 1; // día nuevo pero SIN frontera de hora en este avance
    advanceClock(st, 5, undefined, sky(0));
    expect(st.time.hour).toBe(12);
    expect(latchedMoonPhases(st, moonPhases, st.time.day)).toEqual(
      moonPhasesForDay(moonPhases, DAY),
    );
  });

  it("sin contexto de cielo el latch NO se toca (arneses puros)", () => {
    const st = stateAt();
    const antes = [st.feluccaPhase, st.trammelPhase];
    crossMidnight(st, undefined);
    expect([st.feluccaPhase, st.trammelPhase]).toEqual(antes);
  });

  it("`activeGatePhase` SIN estado sigue calculando por día (compatibilidad)", () => {
    const st = stateAt();
    crossMidnight(st, sky(DUNGEON_LOCATION));
    expect(activeGatePhase(st.time, moonPhases)).toBe(
      moonPhasesForDay(moonPhases, st.time.day).felucca,
    );
    expect(activeGatePhase(st.time, moonPhases, st)).toBe(
      moonPhasesForDay(moonPhases, DAY).felucca,
    );
  });
});

/**
 * El latch PERSISTE: `docs/formats/tlk-npc-dataovl-gam.md:172` declara DS:0x55A6 como la
 * imagen en RAM de SAVED.GAM (0x1060 B), luego `addr − 0x55A6` es el offset de fichero:
 * g_felucca_phase 0x5885 → **+0x2DF** y g_trammel_phase 0x5886 → **+0x2E0**, ENTRE los dos
 * anclas ya verificados con sonda (g_hour 0x587F→+0x2D9, g_karma 0x5888→+0x2E2).
 */
describe("#176 · persistencia del latch en SAVED.GAM (+0x2DF / +0x2E0)", () => {
  const FELUCCA_OFF = 0x2df;
  const TRAMMEL_OFF = 0x2e0;

  it("★ exportar escribe los dos bytes CRUDOS en sus offsets", () => {
    const st = stateAt();
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(gam[FELUCCA_OFF]).toBe(moonPhases[(DAY - 1) * 2]);
    expect(gam[TRAMMEL_OFF]).toBe(moonPhases[(DAY - 1) * 2 + 1]);
    // Y no invaden a sus vecinos verificados con sonda.
    expect(gam[0x2d9]).toBe(st.time.hour);
    expect(gam[0x2e2]).toBe(st.karma & 0xff);
  });

  it("★ el roundtrip es BYTE-IDÉNTICO en los dos offsets (como #124)", () => {
    const st = stateAt();
    const { gam, sidecar } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    const back = importNativeSave(gam, JSON.parse(JSON.stringify(sidecar)) as SaveSidecar);
    expect(back.feluccaPhase).toBe(st.feluccaPhase);
    expect(back.trammelPhase).toBe(st.trammelPhase);
    const again = exportNativeSave(back, gam.slice()).gam;
    expect(again.slice(FELUCCA_OFF, TRAMMEL_OFF + 1)).toEqual(
      gam.slice(FELUCCA_OFF, TRAMMEL_OFF + 1),
    );
  });

  it("un save SIN latchear (bytes a 0, como init.gam) NO se adopta como latch", () => {
    // Medido: `game/assets/init.gam` trae 0x00 en los dos offsets. Adoptarlos daría
    // `0 − 0x30` = índice negativo de moonstone. Ver `isLatchedPhaseByte`.
    const st = stateAt();
    const { gam, sidecar } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    gam[FELUCCA_OFF] = 0;
    gam[TRAMMEL_OFF] = 0;
    const back = importNativeSave(gam, JSON.parse(JSON.stringify(sidecar)) as SaveSidecar);
    expect(back.feluccaPhase).toBeUndefined();
    expect(back.trammelPhase).toBeUndefined();
    // Y con el latch vacío se cae al cálculo por día: la conducta previa a esta tarjeta.
    expect(latchedMoonPhases(back, moonPhases, 7)).toEqual(moonPhasesForDay(moonPhases, 7));
  });

  it("CANDADO: los offsets literales de este test siguen siendo los de saveNative.ts", () => {
    // Sin esto, mover las constantes del módulo dejaría el test midiendo dos bytes que ya
    // no son el latch, y pasando por casualidad si ambos valen lo mismo.
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/core/saveNative.ts"),
      "utf8",
    );
    expect(/FELUCCA_PHASE_OFFSET = (0x[0-9a-f]+)/.exec(src)?.[1]).toBe("0x2df");
    expect(/TRAMMEL_PHASE_OFFSET = (0x[0-9a-f]+)/.exec(src)?.[1]).toBe("0x2e0");
  });
});
