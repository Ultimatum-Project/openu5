/**
 * fix-codice (19-08) — EL BRACKET XOR DE LA CEREMONIA FINAL DEL CÓDICE.
 *
 * Derivación (CAST2.OVL 0x0dac-0x0dee, bytes leídos en crudo; gate 0x0da2
 * `cmp [g_shrine_visited_bitmap],0xff`):
 *
 *   0x0dac  push [g_unk_13ae] ; call 0x2890 (set_color(4))   ┐
 *   0x0db3  push 8,8,0xb7,0xb7 ; call 0x29a6 (rect XOR)      │ pantalla = p ^ 4
 *   0x0dc0  call 0x4e92 → kernel 0x3072 (ráfaga 1)           ┘
 *   0x0dc3  push [g_unk_13b0] ; call 0x2890 (set_color(15))  ┐
 *   0x0dca  rect XOR                                         │ pantalla = p ^ 4 ^ 15 = p ^ 11
 *   0x0dd7  call 0x4e92 (ráfaga 2)                           ┘
 *   0x0dda  push [g_unk_13ae] ; call 0x2890 (set_color(4))   ┐
 *   0x0de1  rect XOR                                         │ pantalla = p ^ 11 ^ 4 = p ^ 15
 *   0x0dee  call 0x4e92 (ráfaga 3)                           ┘
 *   0x0df1  print 0xb773 «A STRANGE WIND…» ; 0x0df8 call 0x448c (getkey_with_redraw
 *           0x266c) — su redibujo 0x5910 corre (location overworld ∉ 0x21..0x7f) y
 *           RESTAURA el residuo p^15. No hay kernel_flash ni cuarto rect en el handler.
 *
 * Resolución de banda: 0x2890→0x0A70 set_color / 0x29a6→0x0B86 rect con `stc` (= XOR,
 * EGA.DRV fn21) / 0x4e92→0x3072 sacudida — tabla careada de
 * re/notes/shrine-rito-cadencia-negativo.md §0 (dos hits de control contra el corpus).
 * COLORES (#305, estático): g_unk_13ae=4 / g_unk_13b0=15, único escritor INTRO.OVL
 * 0x09f4/0x09fa. ⇒ máscaras ACUMULADAS por ventana: [4, 11, 15] — el TERCER rect empuja
 * el 4 (no el 15 del curandero): la ceremonia TERMINA en inversión plena (p^15), que en
 * 1988 restaura el primer redibujo del keywait 0x0df8 y aquí la caducidad de la ventana 3.
 *
 * RENDER: XOR de índice EGA de verdad (palette-xor.ts), NO `difference` blanco — veto
 * MEDIDO de #317 (frame.ts): con máscara 4 divergen 6/16 índices, con la 11 cinco, y con
 * la 15 los índices 6 y 9 (el brown-fix EGA[6]=#AA5500). El discriminante vive abajo.
 *
 * TIMING, partido como manda la memoria compartir-la-primitiva:
 *   · DERIVADO (asm): 3 ventanas, cada una = UNA invocación de 0x3072 (entre rect y rect
 *     no corre nada más — bytes arriba), contiguas.
 *   · CALIBRADO (Clase C, dueño quake.ts): QUAKE_PULSES=8 (testigo) × QUAKE_PERIOD_MS=117.
 *     No es constante prestada de otro subsistema: la ventana bracketa LA MISMA QuakeShake
 *     que la piel corre (planTurnPhase funde las 3 ráfagas en 3·QUAKE_PULSES contiguos),
 *     así que coinciden POR CONSTRUCCIÓN y se recalibran juntas.
 *
 * MUTANTES (corridos sobre la base commiteada, cifras reales; árbol restaurado tras cada uno):
 *   · M1 `CODEX_WIND_MASKS` tercer elemento → 4 (heredar el patrón del curandero) — MATA 3.
 *   · M2 emitir los quake de la ceremonia SIN `xorBracket` — MATA 2 (el aserto del emisor
 *     en shrine-trigger.test.ts y el careo de planTurnPhase de aquí).
 *   · M3 `planTurnPhase` marcando xorBracket con CUALQUIER trío de quakes — MATA 1 (el
 *     control negativo del endgame, que emite 3 quakes SIN bracket — use-tools.ts:106).
 *   · M4 el shader pintando `invertRect` en vez de `paletteXorRect` — MATA 1 (cero fillRect).
 * RESIDUO DECLARADO (mismo que healer-flash.test.ts): el CABLEADO de la fiel — la llamada
 * a `paletteXorViewportInterior` en `present()` y el `trigger` de `applyTurnFx` — vive en
 * métodos que exigen atlas/canvas reales y no tiene aserto aquí; lo sella la verificación
 * visual del carril.
 */
import { describe, it, expect } from "vitest";
import {
  CodexWindFlash,
  CODEX_WIND_MASKS,
  codexWindWindowsMs,
  HEALER_FLASH_MASKS,
} from "../src/skin/fiel/invert-flash.js";
import { QUAKE_PULSES, QUAKE_PERIOD_MS } from "../src/skin/fiel/quake.js";
import { paletteXorRect } from "../src/skin/fiel/palette-xor.js";
import { planTurnPhase } from "../src/skin/turn-phase.js";
import { ShaderSkin } from "../src/skin/shader/skin.js";
import type { GameEvent } from "../src/core/game.js";

describe("fix-codice — máscaras del bracket de la ceremonia", () => {
  it("EN CRUDO: [4, 11, 15] — los estados XOR acumulados de la pantalla", () => {
    expect(CODEX_WIND_MASKS).toEqual([4, 11, 15]);
  });

  it("consistencia con la derivación: 11 = 4^15 (0x0dca con g_13b0) y 15 = 11^4 (0x0de1 con g_13ae)", () => {
    expect(CODEX_WIND_MASKS[1]).toBe(CODEX_WIND_MASKS[0]! ^ 0xf);
    expect(CODEX_WIND_MASKS[2]).toBe(CODEX_WIND_MASKS[1]! ^ 4);
  });

  it("el DISCRIMINANTE contra el curandero: el tercer rect empuja el 4, no el 15 (termina en p^15, no en p^4)", () => {
    // SHOPPES 0x1438 repite el 15 (⇒ [4,11,4]); CAST2 0x0dda vuelve al 4 (⇒ [4,11,15]).
    expect(HEALER_FLASH_MASKS[2]).toBe(4);
    expect(CODEX_WIND_MASKS[2]).toBe(15);
  });
});

describe("fix-codice — ventanas del bracket (una por ráfaga de 0x3072)", () => {
  it("EN CRUDO: tres ventanas de 936 ms (8 pulsos × 117 ms), total 2808 ms", () => {
    const w = codexWindWindowsMs();
    expect(w).toEqual([936, 936, 936]);
    expect(w[0]! + w[1]! + w[2]!).toBe(2808);
  });

  it("careo contra el dueño de la calibración (quake.ts): ventana = QUAKE_PULSES · QUAKE_PERIOD_MS", () => {
    // Es la duración de la ráfaga que la piel CORRE (planTurnPhase funde las tres en
    // 3·QUAKE_PULSES contiguos): si quake.ts recalibra, la ventana se mueve con él.
    const w = codexWindWindowsMs();
    for (const x of w) expect(x).toBe(QUAKE_PULSES * QUAKE_PERIOD_MS);
  });
});

describe("CodexWindFlash (animador de la piel)", () => {
  it("recorre 4 → 11 → 15 en sus ventanas y expira sola (= el redibujo del keywait 0x0df8)", () => {
    const f = new CodexWindFlash();
    f.trigger(1000, [100, 200, 50]);
    expect(f.active).toBe(true);
    expect(f.maskAt(1000)).toBe(4); // rect 0x0db3: p^4
    expect(f.maskAt(1099)).toBe(4);
    expect(f.maskAt(1100)).toBe(11); // rect 0x0dca: p^11
    expect(f.maskAt(1299)).toBe(11);
    expect(f.maskAt(1300)).toBe(15); // rect 0x0de1: p^15 — inversión PLENA
    expect(f.maskAt(1349)).toBe(15);
    expect(f.maskAt(1350)).toBe(0); // keywait 0x0df8: redibujo restaura
    expect(f.active).toBe(false);
  });

  it("masksAt es PURA (el lector shader no roba la caducidad)", () => {
    const f = new CodexWindFlash();
    f.trigger(0, [10, 10, 10]);
    expect(f.masksAt(100)).toBe(0);
    expect(f.active).toBe(true);
    expect(f.maskAt(100)).toBe(0);
    expect(f.active).toBe(false);
  });

  it("con t0 FUTURO no hay máscara hasta que arranca (quakeStartMs > 0)", () => {
    const f = new CodexWindFlash();
    f.trigger(500, [100, 100, 100]);
    expect(f.masksAt(499)).toBe(0);
    expect(f.masksAt(500)).toBe(4);
  });
});

describe("fix-codice — el veto de #317 en la ventana 3 (máscara 15, la que `difference` aproximaba)", () => {
  /** ctx de mentira con un búfer de píxeles de verdad (patrón healer-flash.test.ts). */
  function ctxPixeles(rgba: number[][]): { ctx: CanvasRenderingContext2D; data: Uint8ClampedArray } {
    const data = new Uint8ClampedArray(rgba.flat());
    const img = { data, width: rgba.length, height: 1 };
    const fake = {
      getImageData: () => img,
      putImageData: () => undefined,
    };
    return { ctx: fake as unknown as CanvasRenderingContext2D, data };
  }

  it("EL DISCRIMINANTE: marrón 6 ^ 15 = azul claro 9 (#5555ff) — difference blanco daría #55aaff", () => {
    const e = ctxPixeles([[0xaa, 0x55, 0x00, 255]]);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 15);
    const out = Array.from(e.data.slice(0, 3));
    expect(out).toEqual([0x55, 0x55, 0xff]); // EGA[9], el XOR de índice VERDADERO
    expect(out).not.toEqual([0x55, 0xaa, 0xff]); // 255−canal (la aproximación vetada)
  });

  it("y su espejo: azul claro 9 ^ 15 = marrón 6 (#aa5500) — difference daría #aaaa00 (el amarillo sin brown-fix)", () => {
    const e = ctxPixeles([[0x55, 0x55, 0xff, 255]]);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 15);
    const out = Array.from(e.data.slice(0, 3));
    expect(out).toEqual([0xaa, 0x55, 0x00]);
    expect(out).not.toEqual([0xaa, 0xaa, 0x00]);
  });
});

describe("fix-codice — planTurnPhase reconoce el bracket por el MARCADOR, no por el conteo", () => {
  const quakeB = (): GameEvent => ({ kind: "quake", xorBracket: true });
  const quake = (): GameEvent => ({ kind: "quake" });

  it("tres quakes CON xorBracket (la ceremonia) → plan.xorBracket true", () => {
    const plan = planTurnPhase([quakeB(), quakeB(), quakeB()]);
    expect(plan.quakes).toBe(3);
    expect(plan.xorBracket).toBe(true);
    expect(plan.quakeStartMs).toBe(0);
  });

  it("CONTROL NEGATIVO (anti-conteo): tres quakes SIN marcador (el endgame, use-tools.ts:106) → false", () => {
    const plan = planTurnPhase([quake(), quake(), quake()]);
    expect(plan.quakes).toBe(3);
    expect(plan.xorBracket).toBe(false);
  });

  it("un quake suelto sin marcador (clavicémbalo / sismo) → false", () => {
    const plan = planTurnPhase([quake()]);
    expect(plan.xorBracket).toBe(false);
  });
});

describe("fix-codice §shader — el compose repinta el bracket por la vía de TERRENO", () => {
  const WR = { x: 40, y: 24 };
  const SIZE = 352;

  /** Arnés del compose (patrón healer-flash.test.ts §shader; misma advertencia del cast). */
  function corre(mask: number, terrainOnly: boolean): {
    gets: { x: number; y: number; w: number; h: number }[];
    fills: number;
    data: Uint8ClampedArray;
  } {
    const skin = new ShaderSkin() as unknown as Record<string, unknown>;
    skin.faithful = {
      timeSpellInvertsAt: (): boolean => false,
      healerFlashMaskAt: (): number => 0,
      codexWindMaskAt: (): number => mask,
    };
    const gets: { x: number; y: number; w: number; h: number }[] = [];
    let fills = 0;
    const data = new Uint8ClampedArray([0xaa, 0x55, 0x00, 255]); // un píxel MARRÓN (índice 6)
    const ctx = {
      save(): void {},
      restore(): void {},
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect(): void {
        fills++;
      },
      getImageData(x: number, y: number, w: number, h: number) {
        gets.push({ x, y, w, h });
        return { data, width: 1, height: 1 };
      },
      putImageData(): void {},
    };
    const paint = skin.paintViewportInversions as (...a: unknown[]) => void;
    paint.call(skin, ctx, WR, SIZE, undefined, 1234, terrainOnly);
    return { gets, fills, data };
  }

  it("★ máscara 15 por TERRENO: XOR de paleta sobre el rect de DISPOSITIVO, marrón→azul claro", () => {
    const r = corre(15, true);
    expect(r.gets).toEqual([{ x: 40, y: 24, w: 352, h: 352 }]);
    expect(Array.from(r.data.slice(0, 3))).toEqual([0x55, 0x55, 0xff]); // EGA[6^15=9]
    expect(r.fills, "y NO por `difference`: cero fillRect").toBe(0);
  });

  it("CONTROL NEGATIVO: máscara 0 no toca ni un píxel", () => {
    const r = corre(0, true);
    expect(r.gets).toHaveLength(0);
    expect(r.fills).toBe(0);
  });

  it("por RECORTE PLENO declina (el fondo ya viene con el bracket de la fiel horneado)", () => {
    const r = corre(15, false);
    expect(r.gets).toHaveLength(0);
    expect(r.fills).toBe(0);
  });
});
