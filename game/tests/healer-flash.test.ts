/**
 * #299 — LOS TRES DESTELLOS XOR DE COLORES del servicio del curandero.
 *
 * Derivación (SHOPPES.OVL 0x13b0-0x1469 `healer_light_flash_fx`, cuerpo leído entero;
 * llamadores 0x1611/0x1684/0x16eb = Cure/Heal/Resurrect tras cobrar — los MISMOS tres
 * sitios donde el port ya emite el cue `shop-transaction`):
 *
 *   0x13b0  set_color([g_unk_13ae]) ; rect XOR (8,8,0xb7,0xb7)   ⇒ pantalla = p ^ 4
 *   0x13d8  tone_sweep(0x100e,1,0x57e4,0x1388, +1)  ┐ par 1 (subida/bajada)
 *   0x13ef  tone_sweep(0x100e,1,0x57e4,0x6b6c, −1)  ┘
 *   0x13f6  set_color([g_unk_13b0]) ; rect XOR                    ⇒ pantalla = p ^ 4 ^ 15 = p ^ 11
 *   0x1417  tone_sweep(0x11b2,1,0x9c40,1,      +1)  ┐ par 2
 *   0x142b  tone_sweep(0x11b2,1,0x9c40,0x9c40, −1)  ┘
 *   0x142e  rect XOR (sin set_color: sigue el color 15)           ⇒ pantalla = p ^ 4
 *   0x144f  tone_sweep(0x8fc,1,0x4650,1,      +2)   ┐ par 3
 *   0x1466  tone_sweep(0x8fc,1,0x4650,0x8ca0, −2)   ┘
 *   0x1469  ret — el residuo p^4 lo restaura el redibujo del bucle de menú (getkey)
 *
 * COLORES (#305, derivados en ESTÁTICO): g_unk_13ae y g_unk_13b0 tienen UN solo sitio de
 * escritura en todo el corpus disasm — INTRO.OVL 0x09f4/0x09fa (rama EGA/Tandy,
 * 52c8 ∉ {0,3}): 13ae = 4 (rojo) y 13b0 = 0xF (blanco). Corroboración viva en OTROS
 * tiempos: zodiac-derivation.md §Clase-C (g_13ae = rojo EGA 4 en la captura del catalejo,
 * #297) y el WELL DONE de #295 (g_13b0 = 15 careado color a color).
 *
 * RENDER: XOR de ÍNDICE EGA de verdad (paleta LUT), NO `difference` blanco — el veto de
 * #317 está MEDIDO en frame.ts: con máscara 4 divergen 6 de los 16 índices y con la 11,
 * cinco. El discriminante vive abajo (marrón 6 ^ 4 = verde 2; difference daría #55aaff).
 *
 * MUTANTES (corridos, cifras reales, árbol restaurado por git tras cada uno):
 *   · M1 `idx ^ m` → `idx ^ 0xf` en palette-xor.ts (la degradación a la aproximación
 *     difference) — MATA 4 de 21.
 *   · M2 `HEALER_FLASH_MASKS = [15,15,15]` (reusar la inversión blanca) — MATA 4.
 *   · M3 `healerFlashWindowsMs` con las tres ventanas fundidas en una — MATA 2.
 *   · M4 el shader pintando `invertRect` en vez de `paletteXorRect` — MATA 1 (el aserto
 *     «cero fillRect» del arnés §shader).
 * RESIDUO DECLARADO (mismo que time-spell-flash.test.ts): el CABLEADO de la fiel — la rama
 * `shop-transaction` de `onSfx` y la llamada a `paletteXorViewportInterior` en `present()`
 * — vive en métodos que exigen atlas/canvas reales y NO tiene aserto aquí; un aserto de
 * prosa sería guarda de texto (#251). Lo sella la verificación visual del carril.
 *
 * 🔴 Y una mordida de instrumento, declarada para el siguiente: la PRIMERA corrida de
 * mutantes se hizo con los ficheros AÚN SIN COMMIT — `git checkout --` no deshace la
 * siembra en un fichero untracked (M1 quedó vivo en el árbol) y en el tracked se llevó la
 * clase entera por delante (memoria `revertir-al-commit-no-deshace-mi-siembra`): el kill
 * de M2 salió contaminado. Se commiteó la base y se RE-CORRIERON los cuatro limpios; las
 * cifras de arriba son las de la segunda corrida.
 */
import { describe, it, expect } from "vitest";
import { SFX_CATALOG, healerFlashWindowsMs } from "../src/skin/fiel/speaker.js";
import { HealerLightFlash, HEALER_FLASH_MASKS } from "../src/skin/fiel/invert-flash.js";
import {
  egaIndexOfRgb,
  paletteXorRect,
  paletteXorViewportInterior,
} from "../src/skin/fiel/palette-xor.js";
import { VIEWPORT_INTERIOR } from "../src/skin/fiel/frame.js";
import { ShaderSkin } from "../src/skin/shader/skin.js";

describe("#299 — ventanas de los tres destellos (derivadas de los pares de sweeps)", () => {
  it("los tres anchos, EN CRUDO: 1743.75 / 3100 / 1395 ms (count·2·U/24, U=0.93)", () => {
    const w = healerFlashWindowsMs();
    expect(w).toHaveLength(3);
    expect(w[0]).toBeCloseTo(1743.75, 6); // 2 × 0x57e4 = 45000 muestras
    expect(w[1]).toBeCloseTo(3100, 6); // 2 × 0x9c40 = 80000 muestras
    expect(w[2]).toBeCloseTo(1395, 6); // 2 × 0x4650 = 36000 muestras
  });

  it("careo contra el catálogo: cada ventana = la suma de su par de sweeps del jingle", () => {
    const segs = SFX_CATALOG["shop-transaction"]!(0);
    expect(segs).toHaveLength(6);
    const w = healerFlashWindowsMs();
    for (let i = 0; i < 3; i++) {
      const a = segs[2 * i] as { ms: number };
      const b = segs[2 * i + 1] as { ms: number };
      expect(a.ms + b.ms, `par ${i + 1}`).toBeCloseTo(w[i]!, 6);
    }
  });

  it("el efecto entero dura ~6.24 s (suma en crudo: 6238.75 ms)", () => {
    const w = healerFlashWindowsMs();
    expect(w[0]! + w[1]! + w[2]!).toBeCloseTo(6238.75, 6);
  });
});

describe("#299/#305 — las máscaras de las tres ventanas", () => {
  it("EN CRUDO: [4, 11, 4] — los estados XOR acumulados de la pantalla", () => {
    expect(HEALER_FLASH_MASKS).toEqual([4, 11, 4]);
  });

  it("consistencia con la derivación: 11 = 4 ^ 15 (segundo rect con g_13b0=15 sobre p^4)", () => {
    expect(HEALER_FLASH_MASKS[1]).toBe(HEALER_FLASH_MASKS[0]! ^ 0xf);
    // y el tercer rect repite el 15 (XOR involutivo): vuelve a la máscara del primero
    expect(HEALER_FLASH_MASKS[2]).toBe(HEALER_FLASH_MASKS[1]! ^ 0xf);
  });
});

describe("HealerLightFlash (animador de la piel)", () => {
  it("recorre las tres máscaras en sus ventanas y expira sola", () => {
    const f = new HealerLightFlash();
    f.trigger(1000, [100, 200, 50]);
    expect(f.active).toBe(true);
    expect(f.maskAt(1000)).toBe(4); // primer rect (0x13c1): p^4
    expect(f.maskAt(1099)).toBe(4);
    expect(f.maskAt(1100)).toBe(11); // segundo rect (0x1403): p^11
    expect(f.maskAt(1299)).toBe(11);
    expect(f.maskAt(1300)).toBe(4); // tercer rect (0x1438): p^4 otra vez
    expect(f.maskAt(1349)).toBe(4);
    expect(f.maskAt(1350)).toBe(0); // ret 0x1469 + redibujo del menú: restaurada
    expect(f.active).toBe(false); // autodesactivada
  });

  it("masksAt es PURA (el lector shader no roba la caducidad)", () => {
    const f = new HealerLightFlash();
    f.trigger(0, [10, 10, 10]);
    expect(f.masksAt(100)).toBe(0); // fuera de ventana…
    expect(f.active).toBe(true); // …pero la vida no se la lleva el lector pasivo
    expect(f.maskAt(100)).toBe(0); // el pintor de la fiel sí caduca
    expect(f.active).toBe(false);
  });

  it("clear() corta el destello (cambio de piel / teardown)", () => {
    const f = new HealerLightFlash();
    f.trigger(0, [100, 100, 100]);
    expect(f.maskAt(10)).toBe(4);
    f.clear();
    expect(f.maskAt(20)).toBe(0);
    expect(f.active).toBe(false);
  });

  it("antes del trigger no hay máscara", () => {
    const f = new HealerLightFlash();
    expect(f.maskAt(0)).toBe(0);
    expect(f.active).toBe(false);
  });
});

describe("#317-modelo — XOR de índice EGA de verdad (paleta LUT)", () => {
  it("egaIndexOfRgb: coincidencia exacta de los 16, brown-fix incluido", () => {
    expect(egaIndexOfRgb(0x00, 0x00, 0x00)).toBe(0);
    expect(egaIndexOfRgb(0xaa, 0x00, 0x00)).toBe(4);
    expect(egaIndexOfRgb(0xaa, 0x55, 0x00)).toBe(6); // MARRÓN (no #AAAA00)
    expect(egaIndexOfRgb(0xff, 0xff, 0xff)).toBe(15);
  });

  it("no-EGA cae al índice MÁS CERCANO (determinista, sin agujeros)", () => {
    expect(egaIndexOfRgb(0x10, 0x10, 0x10)).toBe(0); // casi-negro → negro
    expect(egaIndexOfRgb(0xf0, 0xf0, 0xf0)).toBe(15); // casi-blanco → blanco
  });

  /** ctx de mentira con un búfer de píxeles de verdad (getImageData/putImageData). */
  function ctxPixeles(rgba: number[][]): {
    ctx: CanvasRenderingContext2D;
    data: Uint8ClampedArray;
    puts: { x: number; y: number }[];
    gets: { x: number; y: number; w: number; h: number }[];
  } {
    const data = new Uint8ClampedArray(rgba.flat());
    const puts: { x: number; y: number }[] = [];
    const gets: { x: number; y: number; w: number; h: number }[] = [];
    const img = { data, width: rgba.length, height: 1 };
    const fake = {
      getImageData(x: number, y: number, w: number, h: number) {
        gets.push({ x, y, w, h });
        return img;
      },
      putImageData(_img: unknown, x: number, y: number) {
        puts.push({ x, y });
      },
    };
    return { ctx: fake as unknown as CanvasRenderingContext2D, data, puts, gets };
  }

  it("paletteXorRect con máscara 4: negro→rojo EGA, blanco→cyan claro, EN CRUDO", () => {
    const e = ctxPixeles([
      [0x00, 0x00, 0x00, 255], // índice 0
      [0xff, 0xff, 0xff, 255], // índice 15
    ]);
    paletteXorRect(e.ctx, 3, 5, 2, 1, 4);
    expect(Array.from(e.data.slice(0, 4))).toEqual([0xaa, 0x00, 0x00, 255]); // EGA[0^4=4]
    expect(Array.from(e.data.slice(4, 8))).toEqual([0x55, 0xff, 0xff, 255]); // EGA[15^4=11]
    expect(e.gets).toEqual([{ x: 3, y: 5, w: 2, h: 1 }]);
    expect(e.puts).toEqual([{ x: 3, y: 5 }]);
  });

  it("EL DISCRIMINANTE del veto #317: marrón 6 ^ 4 = VERDE 2 (#00aa00) — difference daría #55aaff", () => {
    const e = ctxPixeles([[0xaa, 0x55, 0x00, 255]]);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 4);
    const out = Array.from(e.data.slice(0, 3));
    expect(out).toEqual([0x00, 0xaa, 0x00]); // EGA[2], el XOR de índice VERDADERO
    expect(out).not.toEqual([0x55, 0xaa, 0xff]); // lo que pintaría `difference` blanco
  });

  it("máscara 11 sobre blanco: 15^11 = 4 → rojo EGA (#aa0000), EN CRUDO", () => {
    const e = ctxPixeles([[0xff, 0xff, 0xff, 255]]);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 11);
    expect(Array.from(e.data.slice(0, 3))).toEqual([0xaa, 0x00, 0x00]);
  });

  it("involutivo: aplicar la MISMA máscara dos veces restaura el píxel (como en 1988)", () => {
    const e = ctxPixeles([[0xaa, 0x55, 0x00, 255]]);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 4);
    paletteXorRect(e.ctx, 0, 0, 1, 1, 4);
    expect(Array.from(e.data.slice(0, 3))).toEqual([0xaa, 0x55, 0x00]);
  });

  it("paletteXorViewportInterior opera EXACTAMENTE sobre (8,8,176,176)", () => {
    const e = ctxPixeles([[0, 0, 0, 255]]);
    paletteXorViewportInterior(e.ctx, 4);
    expect(e.gets).toEqual([
      {
        x: VIEWPORT_INTERIOR.x,
        y: VIEWPORT_INTERIOR.y,
        w: VIEWPORT_INTERIOR.w,
        h: VIEWPORT_INTERIOR.h,
      },
    ]);
    expect(e.gets[0]).toMatchObject({ x: 8, y: 8, w: 176, h: 176 }); // en crudo
  });
});

describe("#299 §shader — el compose repinta el destello por la vía de TERRENO", () => {
  /** Rect de DISPOSITIVO, deliberadamente distinto del EGA (8,8,176,176). */
  const WR = { x: 40, y: 24 };
  const SIZE = 352;

  /**
   * ctx doble: búfer de píxeles (para el XOR de paleta) + grabador de fillRect (para
   * afirmar que el destello NO usa la vía `difference`). El método es privado y el cast
   * borra la aridad ante tsc (misma advertencia que el arnés de time-spell-flash.test.ts):
   * lo único que caza una firma movida es CORRER esto.
   */
  function corre(mask: number, terrainOnly: boolean): {
    gets: { x: number; y: number; w: number; h: number }[];
    fills: number;
    data: Uint8ClampedArray;
  } {
    const skin = new ShaderSkin() as unknown as Record<string, unknown>;
    skin.faithful = {
      timeSpellInvertsAt: (): boolean => false,
      healerFlashMaskAt: (): number => mask,
      codexWindMaskAt: (): number => 0, // sin bracket del Códice: este arnés sella al curandero
    };
    const gets: { x: number; y: number; w: number; h: number }[] = [];
    let fills = 0;
    const data = new Uint8ClampedArray([0x00, 0x00, 0x00, 255]); // un píxel NEGRO (índice 0)
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

  it("★ máscara 4 por TERRENO: XOR de paleta sobre el rect de DISPOSITIVO (no el EGA)", () => {
    const r = corre(4, true);
    expect(r.gets).toEqual([{ x: 40, y: 24, w: 352, h: 352 }]);
    expect(Array.from(r.data.slice(0, 3))).toEqual([0xaa, 0x00, 0x00]); // negro → rojo EGA
    expect(r.fills, "y NO por `difference`: cero fillRect").toBe(0);
  });

  it("CONTROL NEGATIVO: máscara 0 no toca ni un píxel", () => {
    const r = corre(0, true);
    expect(r.gets).toHaveLength(0);
    expect(r.fills).toBe(0);
  });

  it("por RECORTE PLENO declina (el fondo ya viene con el destello de la fiel horneado)", () => {
    const r = corre(4, false);
    expect(r.gets).toHaveLength(0);
    expect(r.fills).toBe(0);
  });
});

describe("Catálogo de sfx — el jingle del curandero sigue intacto (control positivo)", () => {
  it("shop-transaction: 6 tonos, 3 pares espejo (mismo pitch y duración dentro del par)", () => {
    const segs = SFX_CATALOG["shop-transaction"]!(0);
    expect(segs).toHaveLength(6);
    for (let i = 0; i < 3; i++) {
      const a = segs[2 * i] as { kind: string; ms: number; f0: number };
      const b = segs[2 * i + 1] as { kind: string; ms: number; f0: number };
      expect(a.kind).toBe("tone");
      expect(b.kind).toBe("tone");
      expect(a.ms).toBeCloseTo(b.ms, 6);
      expect(a.f0).toBeCloseTo(b.f0, 6);
    }
  });

  it("pitches EN CRUDO: ~1618.4 / ~1783.8 / ~905.7 Hz (inc/65536 · SR)", () => {
    const segs = SFX_CATALOG["shop-transaction"]!(0) as { f0: number }[];
    expect(segs[0]!.f0).toBeCloseTo(1618.42, 1);
    expect(segs[2]!.f0).toBeCloseTo(1783.8, 1);
    expect(segs[4]!.f0).toBeCloseTo(905.68, 1);
  });
});
