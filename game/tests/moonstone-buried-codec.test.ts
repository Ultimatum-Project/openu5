/**
 * Ficha #143(a) — el byte 0x29a+i del .GAM es la LOCALIZACIÓN de la piedra lunar, con
 * 0xFF = «en la mochila». Guarda del predicado del códec, en las dos direcciones.
 *
 * Derivación (re/notes/moonstone-loc-y-pozo-doom.md §1): 0x29a+i es DS 0x5840+i, porque
 * DS 0x55A6 es la imagen del .GAM (0x6606 − 0x55A6 = 0x1060 = 4192 B = el fichero entero) y
 * 0x5840 − 0x55A6 = 0x29A. Escritores: `bury_moonstone` CAST.OVL:0x1596-0x1599 copia
 * `g_location`; el (G)et de SJOG.OVL:0x1496 planta 0xFF. Lectores: ULTIMA.EXE:0x47fd
 * (`cmp …,0xff` — sin piedra enterrada no hay teleport), ULTIMA.EXE:0x4713
 * (`cmp …,g_location` — la puerta sólo se dibuja en SU localización) y ZSTATS.OVL:0x09b4
 * («la llevas» ⇔ == 0xFF).
 *
 * ⚠ EL TESTIGO TIENE QUE SER UNA LOCALIZACIÓN DE PUEBLO. Los predicados `=== 0` (el viejo)
 * y `!== 0xff` (el del binario) dan LO MISMO en 0 y en 0xFF, y los 70 .gam del corpus llevan
 * los ocho bytes a 0 — un caso sembrado con 0 o con 0xFF pasa con el código roto.
 */
import { describe, expect, it } from "vitest";
import { createNewGame } from "../src/core/state.js";
import { exportNativeSave, parseSaveWindow, SAVED_GAM_SIZE } from "../src/core/saveNative.js";
import { buryMoonstone } from "../src/core/world/moongates.js";
import { canonicalInit } from "./helpers/canonical-init.js";

/** Ventana .GAM en blanco con la localización `loc` en la piedra `i`. */
const windowWithLoc = (i: number, loc: number): Uint8Array => {
  const gam = new Uint8Array(SAVED_GAM_SIZE);
  gam[0x29a + i] = loc;
  return gam;
};

const MINOC = 0x0e; // una localización de pueblo cualquiera: ni 0 ni 0xFF
const DOOM = 0x28; // 40, la localización más alta de la tabla

describe("#143(a) moonstone.buried ⇔ localización != 0xFF", () => {
  it("0xFF es «en la mochila» — la única lectura que NO está enterrada", () => {
    expect(parseSaveWindow(windowWithLoc(3, 0xff)).moonstones[3]!.buried).toBe(false);
  });

  it("0 es «enterrada en el sobremundo de Britannia», no «sin enterrar»", () => {
    // Mata al mutante `!== 0`: con él esta piedra saldría en la mochila.
    expect(parseSaveWindow(windowWithLoc(3, 0)).moonstones[3]!.buried).toBe(true);
  });

  it("🔴 una localización de PUEBLO está enterrada (el caso que separa los predicados)", () => {
    // Mata al mutante `=== 0` (el defecto real de #143a): con él, buried = false y el (U)se
    // te ofrecería una piedra que en realidad sigue bajo tierra en Minoc.
    for (const loc of [1, MINOC, 0x20, DOOM, 0xfe]) {
      expect(parseSaveWindow(windowWithLoc(5, loc)).moonstones[5]!.buried).toBe(true);
    }
  });

  it("al re-exportar sin tocar el estado, la localización SOBREVIVE intacta", () => {
    // Mata a los mutantes del escritor: tanto revertir su predicado a `=== 0` como quitarle
    // la guarda escriben 0 aquí y borran el pueblo donde estaba enterrada.
    const template = windowWithLoc(5, MINOC);
    const state = createNewGame(parseSaveWindow(template));
    const { gam } = exportNativeSave(state, template);
    expect(gam[0x29a + 5]).toBe(MINOC);
  });

  it("desenterrarla SÍ escribe el centinela 0xFF", () => {
    // Mata al mutante que invierte el par escrito (`m.buried ? 0xff : 0`).
    const template = windowWithLoc(5, MINOC);
    const state = createNewGame(parseSaveWindow(template));
    state.moonstones[5]!.buried = false;
    const { gam } = exportNativeSave(state, template);
    expect(gam[0x29a + 5]).toBe(0xff);
  });

  it("🔴 enterrar en un PUEBLO y exportar conserva el pueblo, no lo aplasta a 0", () => {
    // El caso que la ficha #143a midió como alcanzable HOY: la puerta del (U)se sólo rechaza
    // `location >= 0x21` (use-tools.ts:373, calco de CAST.OVL:0x155f), y 3 de los 24 saves de
    // pueblo del corpus tienen a la party sobre un tile enterrable (part07 Minoc, part01
    // Iolos_Hut, ch09 New_Magincia — los tres tile 0x05).
    // Mata al mutante que pierde la LOCALIZACIÓN aunque el predicado de buriedness sea
    // correcto: un escritor que ponga `m.buried ? 0 : 0xff` pasa todos los casos de arriba y
    // falla éste.
    const template = new Uint8Array(SAVED_GAM_SIZE); // las ocho piedras en el sobremundo
    const state = createNewGame(parseSaveWindow(template));
    buryMoonstone(state, 2, 22, 17, 0, MINOC); // (U)se dentro de Minoc, como part07.gam
    const { gam } = exportNativeSave(state, template);
    expect(gam[0x29a + 2]).toBe(MINOC);
    const releida = parseSaveWindow(gam).moonstones[2]!;
    expect(releida).toMatchObject({ x: 22, y: 17, buried: true, location: MINOC });
  });

  it("el corpus de saves REALES no distingue los predicados — control del testigo", () => {
    // La razón de que el defecto viviera meses sin verse: con los ocho bytes a 0 los dos
    // predicados coinciden. Este control existe para que nadie «simplifique» el testigo
    // de arriba a loc = 0 creyendo que da igual.
    const gam = new Uint8Array(SAVED_GAM_SIZE); // los 8 bytes a 0, como init.gam
    for (const m of parseSaveWindow(gam).moonstones) expect(m.buried).toBe(true);
  });
});
