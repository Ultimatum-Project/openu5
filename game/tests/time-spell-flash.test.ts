/**
 * INVERSIÓN de pantalla del pergamino de hechizo-de-tiempo (carril fx-combate).
 *
 * Derivación (ver invert-flash.ts): tail del lector (CAST.OVL 0x125c) → stub
 * 0x80b2 → CAST2.OVL 0x08f8 → CAST2 0x0000 = NB de entrada + rect XOR del
 * viewport (residente 0x0b86 = STC + EGA.DRV fn21 en función XOR) + dos sweeps
 * espejo (0x2192, tablas DS 0x4af6-0x4b2c) + rect XOR de vuelta. Testigo:
 * doom-n6-combate-20260721.mov — ventanas de ~3 s por (U)se de An Tym, chrome
 * y paneles intactos, colores = XOR 15 exacto (suelo negro→blanco).
 */
import { describe, it, expect } from "vitest";
import {
  SFX_CATALOG,
  timeSpellFlashWindowMs,
  SPEAKER_SAMPLE_RATE_HZ,
  pitHz,
} from "../src/skin/fiel/speaker.js";
import { TimeSpellFlash } from "../src/skin/fiel/invert-flash.js";

describe("Ventana del flash (derivada de los params del jingle)", () => {
  it("dur = 2 sweeps de count 0x2710+0xfa0·idx; delay = el noise_burst de entrada", () => {
    for (const idx of [2, 3, 7]) {
      const { delay, dur } = timeSpellFlashWindowMs(idx);
      const count = 0x2710 + 0xfa0 * idx;
      expect(dur).toBeCloseTo((2 * count * 1000) / SPEAKER_SAMPLE_RATE_HZ, 6);
      expect(delay).toBeGreaterThan(0);
    }
  });

  it("An Tym (idx 7) invierte ~2.9 s — la ventana de 3-4 frames a 1 fps del testigo", () => {
    const { dur } = timeSpellFlashWindowMs(7);
    expect(dur).toBeGreaterThan(2500);
    expect(dur).toBeLessThan(3500);
  });

  it("In Sanct (2) e In An (3) son más cortos que An Tym (7) — count crece con idx", () => {
    const d2 = timeSpellFlashWindowMs(2).dur;
    const d3 = timeSpellFlashWindowMs(3).dur;
    const d7 = timeSpellFlashWindowMs(7).dur;
    expect(d2).toBeLessThan(d3);
    expect(d3).toBeLessThan(d7);
  });
});

describe("TimeSpellFlash (animador de la piel)", () => {
  it("no invierte durante el NB de entrada, invierte en la ventana y expira sola", () => {
    const f = new TimeSpellFlash();
    f.trigger(1000, { delay: 500, dur: 2000 });
    expect(f.active).toBe(true);
    expect(f.invertAt(1000)).toBe(false); // NB de entrada: aún sin invertir
    expect(f.invertAt(1499)).toBe(false);
    expect(f.invertAt(1500)).toBe(true); // primer XOR (0x0027)
    expect(f.invertAt(2500)).toBe(true); // en mitad de los sweeps
    expect(f.invertAt(3499)).toBe(true);
    expect(f.invertAt(3500)).toBe(false); // segundo XOR (0x0070): des-invertida
    expect(f.active).toBe(false); // autodesactivada
  });

  it("clear() corta el flash", () => {
    const f = new TimeSpellFlash();
    f.trigger(0, { delay: 0, dur: 1000 });
    expect(f.invertAt(10)).toBe(true);
    f.clear();
    expect(f.invertAt(20)).toBe(false);
    expect(f.active).toBe(false);
  });
});

describe("Catálogo de sfx", () => {
  it("time-spell: NB de entrada + sweep de subida + sweep de bajada (espejo)", () => {
    const segs = SFX_CATALOG["time-spell"]!(7);
    expect(segs).toHaveLength(3);
    expect(segs[0]!.kind).toBe("noise");
    expect(segs[1]!.kind).toBe("tone");
    expect(segs[2]!.kind).toBe("tone");
    // Sweeps espejo: mismo inc (= mismo pitch PWM) y misma duración.
    const s1 = segs[1] as { ms: number; f0: number };
    const s2 = segs[2] as { ms: number; f0: number };
    expect(s1.ms).toBeCloseTo(s2.ms, 6);
    expect(s1.f0).toBeCloseTo(s2.f0, 6); // pitch = inc/65536·SR, no depende de bx
  });

  it("line-spray: NB de entrada (dur por modo) + crackle en banda [100,10000]", () => {
    const segs = SFX_CATALOG["line-spray"]!(4);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.kind).toBe("noise");
    expect(segs[1]!.kind).toBe("noise");
    const crackle = segs[1] as { freqs: number[] };
    // Techo = `pitHz(10000)`: la cuantizacion del PIT (#254) roza la banda por arriba.
    expect(Math.max(...crackle.freqs)).toBeLessThanOrEqual(pitHz(10000));
    expect(Math.min(...crackle.freqs)).toBeGreaterThanOrEqual(100);
    // dur del NB de entrada por modo: 1→0x3e80 < 2→0x4b00 < 3/4→0x5140.
    const nb1 = SFX_CATALOG["line-spray"]!(1)[0] as { ms: number };
    const nb2 = SFX_CATALOG["line-spray"]!(2)[0] as { ms: number };
    const nb4 = segs[0] as { ms: number };
    expect(nb1.ms).toBeLessThan(nb2.ms);
    expect(nb2.ms).toBeLessThan(nb4.ms);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
// #295 — LA INVERSIÓN DEL PERGAMINO TAMBIÉN EN LA PIEL SHADER (la de FÁBRICA)
//
// Lo que sella este bloque es el eslabón que faltaba: el rect XOR PAREADO estaba portado
// desde hacía meses, pero SÓLO en la piel fiel. El paso (2) del compose del shader
// recompone el viewport por su cuenta y PISA lo que la fiel hornea en su canvas oculto —la
// misma razón por la que existen sus pasos (2f) terremoto y (2g) apagón—, así que en la piel
// por defecto la inversión no se veía. Régimen medido, no supuesto: `motionScroll` (ON salvo
// localStorage="0") y `transparencyMode`="all" hacen que la vía que recompone se tome en
// MUNDO-con-scroll y en COMBATE, y combate es donde el testigo del docblock la documentó.
//
// MUTANTES CORRIDOS (los cinco, con su cifra REAL sobre los 17 de este fichero):
//   · M1 — `paintViewportInversions` sin la línea del pergamino (= el estado ANTERIOR al fix,
//     exactamente el defecto que este bloque existe para impedir) → **MATA 4**.
//   · M2 — `invertsAt` mutando `dur` como hace `invertAt` (deja de ser lectura pasiva y le
//     roba la ventana al pintor de la fiel) → **MATA 3**.
//   · M3 — `invertsAt` con `<=` en el filo derecho (la ventana se pasa un instante) → **MATA 2**.
//   · M4 — `paintViewportInversions` pintando el rect EGA (8,8,176,176) en vez del de
//     DISPOSITIVO (= la restricción 1 de la ficha, el error de llamar a la primitiva a
//     ciegas desde el compose) → **MATA 1**.
//   · M5 — `else if` entre las dos inversiones (las coincidentes dejarían de cancelarse, y en
//     1988 el XOR es involutivo) → **MATA 1**.
//
// 🔴 LO QUE **NO** GUARDA, dicho para que nadie lo suponga guardado: que `present()` siga
// LLAMANDO a `paintViewportInversions`, y que la llamada siga ANTES de la cortina de (2g).
// Las dos viven dentro de un método de 500 líneas que exige atlas, upscaler y canvas reales;
// un aserto sobre el TEXTO del fichero sería una guarda de prosa, no de la propiedad (#251).
// Es el mismo residuo declarado que tiene `paintAnchoredFogSlide`.
//
// 🔴 Y TAMPOCO HAY CAPTURA DE ESTE EFECTO, dicho sin adornos: el régimen del repo pide mirar
// la captura en las dos pieles, y para el pergamino haría falta conducir una partida hasta
// usar un scroll de tiempo. Lo que SÍ está mirado es el PINTADO, que es el mismo `invertRect`
// ya careado contra la captura del usuario en el commit del WELL DONE (1836b81c): lo que este
// cableado estrena no es cómo se pinta, es CUÁNDO se dispara — y eso es justo lo que sellan
// los asertos de arriba. Queda declarado para que nadie lo lea como «verificado en pantalla».
import { ShaderSkin } from "../src/skin/shader/skin.js";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import type { ViewSnapshot } from "../src/skin/api.js";

/** Rect del viewport en píxeles de DISPOSITIVO — deliberadamente distinto del EGA (8,8,176,176). */
const WR = { x: 40, y: 24 };
const SIZE = 352;

/** Registra los `fillRect` que recibe, con el modo de composición vigente en cada uno. */
class RecorderCtx {
  readonly rects: { x: number; y: number; w: number; h: number; op: string; fill: string }[] = [];
  globalCompositeOperation = "source-over";
  fillStyle = "";
  private readonly stack: string[] = [];
  save(): void {
    this.stack.push(this.globalCompositeOperation);
  }
  restore(): void {
    this.globalCompositeOperation = this.stack.pop() ?? "source-over";
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ x, y, w, h, op: this.globalCompositeOperation, fill: this.fillStyle });
  }
}

/**
 * Corre el paso REAL (2f-bis/2f-ter) con las dos banderas Y LA VÍA puestas a mano.
 *
 * 🔴 `terrainOnly` ES OBLIGATORIO A PROPÓSITO, y no tiene default. #345 lo añadió a la firma
 * del método y este arnés se quedó llamando con CINCO argumentos: el sexto llegaba `undefined`
 * —falsy— que es justo la vía de RECORTE PLENO, así que el early-return se tragaba las dos
 * inversiones y los cinco asertos de abajo pasaron a rojo. Un default aquí volvería a esconder
 * la vía: cada llamada dice por cuál de las dos entra, porque la vía ES el sujeto de #345.
 *
 * 🔴 Y tsc NO puede avisar de esto: `paint` se castea a `(...a: unknown[]) => void` para
 * alcanzar un método privado, y ese cast BORRA LA ARIDAD. Añadir un parámetro al método bajo
 * prueba es invisible al comprobador de tipos y cambia la conducta en silencio — `npx tsc
 * --noEmit -p game/tsconfig.json` salía rc=0 con este fichero en rojo. Lo único que lo caza es
 * CORRER el fichero.
 */
function inversiones(ritualInvert: boolean, timeSpell: boolean, terrainOnly: boolean): RecorderCtx {
  const skin = new ShaderSkin() as unknown as Record<string, unknown>;
  // `healerFlashMaskAt` en 0 = sin destello del curandero (#299): este arnés sella los DOS
  // regímenes de #295/#345; el del curandero tiene su arnés en healer-flash.test.ts.
  skin.faithful = {
    timeSpellInvertsAt: (): boolean => timeSpell,
    healerFlashMaskAt: (): number => 0,
    codexWindMaskAt: (): number => 0, // sin bracket del Códice (fix-codice): ídem
  };
  const ctx = new RecorderCtx();
  const paint = skin.paintViewportInversions as (...a: unknown[]) => void;
  paint.call(skin, ctx, WR, SIZE, { ritualInvert } as unknown as ViewSnapshot, 1234, terrainOnly);
  return ctx;
}

describe("#295 §shader — por la vía de TERRENO el paso (2f-bis) invierte por los DOS regímenes", () => {
  it("CONTROL NEGATIVO: sin ninguna bandera no pinta nada", () => {
    expect(inversiones(false, false, true).rects).toHaveLength(0);
  });

  it("★ el PERGAMINO solo (estado en la fiel, no en el snapshot) SÍ invierte — el eslabón que faltaba", () => {
    expect(inversiones(false, true, true).rects).toHaveLength(1);
  });

  it("el RITO solo (snap.ritualInvert) invierte — lo que ya cableó el commit anterior", () => {
    expect(inversiones(true, false, true).rects).toHaveLength(1);
  });

  it("★ coincidiendo se aplican las DOS y se cancelan — el XOR es involutivo, como en 1988", () => {
    expect(inversiones(true, true, true).rects).toHaveLength(2);
  });

  it("★ el rect es el de DISPOSITIVO, no el EGA (8,8,176,176) — restricción 1 de la ficha", () => {
    const [r] = inversiones(false, true, true).rects;
    // Esperado EN CRUDO (no derivado de WR/SIZE): con el helper equivocado saldría 8,8,176,176.
    expect(r).toMatchObject({ x: 40, y: 24, w: 352, h: 352 });
  });

  it("pinta en `difference` con BLANCO y restaura el modo — el XOR de la primitiva, sin color propio", () => {
    const ctx = inversiones(false, true, true);
    expect(ctx.rects[0]).toMatchObject({ op: "difference", fill: "#ffffff" });
    expect(ctx.globalCompositeOperation).toBe("source-over");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
// #345 — EL DUEÑO DE LA INVERSIÓN SE DECIDE POR CAMINO, NO POR PIEL
//
// El usuario reportó el 16-08 que el WELL DONE no se veía en negativo en openu5.org. No
// faltaba el paso: sobraba. El paso (2) del compose tiene DOS vías y sólo una deja el
// viewport SIN el efecto:
//   · `terrainOnly === true`  — el fondo lo pintó `paintWorldInto` desde el snapshot (terreno
//     CRUDO): la fiel no ha horneado nada, y el XOR lo pone este paso. Es lo que sellan los
//     seis asertos de arriba.
//   · `terrainOnly === false` — el fondo es el RECORTE PLENO del canvas de la fiel, que YA
//     lleva dentro su `invertViewportInterior`. Aplicar aquí lo CANCELA (el XOR es involutivo)
//     y el jugador ve colores normales. La escena del santuario cae por esta vía.
//
// 🔴 CADA ASERTO LLEVA SU CONTROL POSITIVO PEGADO, con las MISMAS banderas: «0 rects» a secas
// pasaría también con el método entero roto (o borrado), que es el modo de fallo que un
// aserto de ausencia no distingue. Lo que discrimina es el PAR — misma escena, distinta vía,
// distinto desenlace.
// ══════════════════════════════════════════════════════════════════════════════════════
describe("#345 §shader — por RECORTE PLENO el paso DECLINA (el fondo ya venía invertido)", () => {
  it("★ el RITO por recorte pleno NO invierte — y por terreno SÍ (el par que discrimina)", () => {
    expect(inversiones(true, false, true).rects, "control positivo: la vía de terreno invierte")
      .toHaveLength(1);
    expect(inversiones(true, false, false).rects).toHaveLength(0);
  });

  it("★ el PERGAMINO por recorte pleno tampoco — la declinación es del PASO, no de un régimen", () => {
    expect(inversiones(false, true, true).rects, "control positivo").toHaveLength(1);
    expect(inversiones(false, true, false).rects).toHaveLength(0);
  });

  it("con los DOS regímenes a la vez tampoco pinta nada por recorte pleno", () => {
    expect(inversiones(true, true, true).rects, "control positivo").toHaveLength(2);
    expect(inversiones(true, true, false).rects).toHaveLength(0);
  });
});

describe("#295 §puente — la fiel PRESTA su ventana sin gastarla", () => {
  it("★ `invertsAt` es PURA: leerla mil veces no caduca la ventana que `invertAt` sí caduca", () => {
    const f = new TimeSpellFlash();
    f.trigger(0, { delay: 0, dur: 100 });
    for (let i = 0; i < 1000; i++) expect(f.invertsAt(50)).toBe(true);
    expect(f.active).toBe(true); // el lector pasivo NO robó la caducidad
    expect(f.invertAt(50)).toBe(true); // …y el pintor de la fiel sigue viéndola
  });

  it("las dos lecturas COINCIDEN en los tres filos de la ventana [delay, delay+dur)", () => {
    for (const t of [0, 9, 10, 50, 99, 100, 101]) {
      const a = new TimeSpellFlash();
      const b = new TimeSpellFlash();
      a.trigger(0, { delay: 10, dur: 90 });
      b.trigger(0, { delay: 10, dur: 90 });
      expect(a.invertsAt(t)).toBe(b.invertAt(t));
    }
  });

  it("filos EN CRUDO: fuera a t=9, dentro a t=10 y t=99, fuera a t=100", () => {
    const f = new TimeSpellFlash();
    f.trigger(0, { delay: 10, dur: 90 });
    expect([f.invertsAt(9), f.invertsAt(10), f.invertsAt(99), f.invertsAt(100)]).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it("★ `FaithfulSkin.timeSpellInvertsAt` DELEGA en la ventana viva (el puente que lee el shader)", () => {
    const flash = new TimeSpellFlash();
    flash.trigger(0, { delay: 0, dur: 100 });
    const leer = FaithfulSkin.prototype.timeSpellInvertsAt as (this: unknown, n: number) => boolean;
    expect(leer.call({ timeFlash: flash }, 50)).toBe(true);
    expect(leer.call({ timeFlash: flash }, 150)).toBe(false);
  });
});
