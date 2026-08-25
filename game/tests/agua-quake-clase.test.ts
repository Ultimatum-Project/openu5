/**
 * CANDIDATAS 1+2 DE transit-fx-b, MEDIDAS EN VIVO (carril fix-agua-quake) — las dos
 * hermanas del shader que el commit 5962ad37 declaró «derivadas del código, sin medir»:
 *
 * 1. DOBLE SACUDIDA en la vía de RECORTE PLENO **SIN** transit — CONFIRMADA. Medición
 *    (medicion-quake.mjs, server propio 5288, correlación de traslación vertical contra el
 *    reposo con ruido base 0):
 *      · shader + motion OFF (recorte pleno): frames de la ráfaga a dy=16 px de dispositivo
 *        (= 2·2 px EGA a escala 4 — el DOBLE), ninguno a 8;
 *      · shader + motion ON (vía terreno): dy=8 (una suma) — control;
 *      · fiel: dy=2 px lógicos (una suma) — control del instrumento.
 *    CAUSA: la fiel hornea su `paintQuakeShift` en TODA vía de su render visible
 *    (fiel/skin.ts, camino normal Y rama transit), así que el recorte pleno del paso (2)
 *    HEREDA el shift — y (2f) con el gate `!transiting` de 5962ad37 sólo declinaba en el
 *    cruce: en motion OFF / mazmorra / combate transp=off volvía a desplazar (2·qoff).
 *    REMEDIO (lección #345, la misma que ya aplicaba `paintViewportInversions`): el
 *    discriminante es LA VÍA, no el transit — (2f) re-aplica sólo cuando el paso (2)
 *    RECOMPUSO el viewport (`terrainOnly`); quien hereda el recorte pleno no re-aplica.
 *    `transiting` fuerza `useMotion=false` ⇒ el gate nuevo SUBSUME al de 5962ad37.
 *
 * 2. El paso (2b) (agua xBRZ) repinta olas ENCIMA del recorte pleno DURANTE EL TRANSIT —
 *    CONFIRMADA y PEOR de lo declarado. `waterCommitted` sólo se repuebla en
 *    `paintFaithful` (`waterSink.begin`), y la rama transit de la fiel NO pasa por ahí ⇒
 *    durante el cruce (2b) pinta las celdas de agua del viewport de ORIGEN (party una fila
 *    al sur) sobre el frame congelado (que centra al party YA SOBRE LA PUERTA,
 *    `beginTransit`): FRANJA DE AGUA FANTASMA corrida una fila, que además TAPA lo que la
 *    fiel hornea en esas celdas. Medido con captura (caps-inv-antes, server 5288): durante
 *    el flash del pergamino en pleno cruce, el viewport entero invertido (blanco) con la
 *    franja de olas SIN INVERTIR encima; la fiel, intacta (control).
 *
 * 2-bis. La MISMA pieza fuera del transit: en recorte pleno (motion OFF) la INVERSIÓN
 *    heredada del canvas fiel queda TAPADA por (2b) en las celdas de agua. Medido
 *    (medicion-inv-motionoff.mjs, party junto al mar, delta por celda contra la referencia
 *    pre-flash): agua mediana 122 (≈ sólo fase de ola) con tierra 677 (invertida) en motion
 *    OFF; controles: motion ON agua 606, fiel agua 571 (invertida). El censo de fuentes es
 *    EL MISMO que `paintViewportInversions` (ritualInvert / timeSpell / healer / codexWind)
 *    — no una lista paralela que pueda divergir.
 *
 * 2-ter. Y la esquina geométrica de la misma pieza: en recorte pleno el fondo heredado va
 *    desplazado `qoff` durante la sacudida — las olas de (2b) deben ir CON él (en la vía
 *    terreno no: allí el shift lo aplica (2f) al composite entero DESPUÉS de las olas).
 *
 * NO cubierto (declarado, no medido — candidato para el lead): combatFx (hitFlash) sobre
 * celda de agua en arenas con agua y transp=off — misma clase que 2-bis, emisor distinto.
 *
 * Arnés: el de time-spell-flash.test.ts §shader — clase real en node, privados por índice,
 * ctx registrador, faithful mock; esperados EN CRUDO derivados a mano en cada aserto.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ShaderSkin } from "../src/skin/shader/skin.js";
import type { ViewSnapshot } from "../src/skin/api.js";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

/** Registra los drawImage que recibe la capa mundo (todos los args, en orden). */
class WctxRecorder {
  readonly draws: unknown[][] = [];
  imageSmoothingEnabled = false;
  drawImage(...args: unknown[]): void {
    this.draws.push(args);
  }
}

/** Marcador de identidad del atlas de agua (naturalWidth>0 = «cargado»). */
const ATLAS_AGUA = { marca: "water-atlas", naturalWidth: 96 };

/**
 * Ejercita el paso (2b) REAL (`paintWaterOverlay`) con la vía y los flashes puestos a mano.
 * `size=352` ⇒ celda de 32 px de dispositivo (deliberadamente ≠ 176 lógico y ≠ 96 del atlas).
 * Committed sembrado con DOS celdas: tile 0x01 (mar, fila 0 del atlas) en (3,6) y tile 0x8f
 * (fila 23 = 3 scroll [0x01,0x02,0x03] + 4 costa [0x34-0x37] + 16 ríos [0x60-0x6f] delante)
 * en (4,6); fase committed = 2 ⇒ sx = 2·96 = 192.
 */
function olas(opts: {
  transiting?: boolean;
  terrainOnly?: boolean;
  ritualInvert?: boolean;
  timeSpell?: boolean;
  healerMask?: number;
  codexMask?: number;
  qoffDev?: number;
}): WctxRecorder {
  const skin = new ShaderSkin() as unknown as Record<string, unknown>;
  skin.waterAtlas = ATLAS_AGUA;
  skin.waterCommitted = [
    { col: 3, row: 6, tile: 0x01 },
    { col: 4, row: 6, tile: 0x8f },
  ];
  skin.waterCommittedPhase = 2;
  skin.faithful = {
    timeSpellInvertsAt: (): boolean => opts.timeSpell ?? false,
    healerFlashMaskAt: (): number => opts.healerMask ?? 0,
    codexWindMaskAt: (): number => opts.codexMask ?? 0,
  };
  const wctx = new WctxRecorder();
  const paint = skin.paintWaterOverlay as (...a: unknown[]) => void;
  paint.call(
    skin,
    wctx,
    352,
    opts.transiting ?? false,
    opts.terrainOnly ?? false,
    { ritualInvert: opts.ritualInvert ?? false } as unknown as ViewSnapshot,
    123_456,
    opts.qoffDev ?? 0,
  );
  return wctx;
}

describe("candidata 2 — el paso (2b) del shader y el recorte pleno", () => {
  it("★ control positivo: por la vía TERRENO pinta las olas del committed, EN CRUDO", () => {
    const wctx = olas({ terrainOnly: true });
    // (atlas, sx=192, fila·96, 96, 96, col·32, row·32, 32, 32) — derivado a mano arriba.
    expect(wctx.draws).toEqual([
      [ATLAS_AGUA, 192, 0, 96, 96, 96, 192, 32, 32],
      [ATLAS_AGUA, 192, 2208, 96, 96, 128, 192, 32, 32],
    ]);
  });

  it("★ control positivo: en RECORTE PLENO sin transit y sin flashes, las olas normales NO se rompen", () => {
    expect(olas({ terrainOnly: false }).draws).toHaveLength(2);
  });

  it("durante el CRUCE DE MOONGATE declina — el committed es del viewport de ORIGEN (franja fantasma medida)", () => {
    expect(olas({ transiting: true, terrainOnly: false }).draws).toHaveLength(0);
  });

  it("en recorte pleno con la INVERSIÓN DEL PERGAMINO heredada declina (agua 122 vs tierra 677, medido)", () => {
    expect(olas({ timeSpell: true }).draws).toHaveLength(0);
  });

  it("ídem con el RITO (snap.ritualInvert), el CURANDERO y el CÓDICE — el censo de paintViewportInversions", () => {
    expect(olas({ ritualInvert: true }).draws).toHaveLength(0);
    expect(olas({ healerMask: 4 }).draws).toHaveLength(0);
    expect(olas({ codexMask: 11 }).draws).toHaveLength(0);
  });

  it("★ y por la vía TERRENO los flashes NO declinan: allí la inversión la pinta (2f-ter) ENCIMA de las olas", () => {
    expect(olas({ terrainOnly: true, timeSpell: true }).draws).toHaveLength(2);
    expect(olas({ terrainOnly: true, ritualInvert: true }).draws).toHaveLength(2);
  });

  it("en recorte pleno con SACUDIDA las olas viajan CON el fondo horneado (+qoffDev en y)", () => {
    const wctx = olas({ qoffDev: 8 });
    expect(wctx.draws).toEqual([
      [ATLAS_AGUA, 192, 0, 96, 96, 96, 200, 32, 32],
      [ATLAS_AGUA, 192, 2208, 96, 96, 128, 200, 32, 32],
    ]);
  });

  it("…y por la vía TERRENO no: el shift lo aplica (2f) al composite entero, DESPUÉS de las olas", () => {
    const wctx = olas({ terrainOnly: true, qoffDev: 8 });
    expect(wctx.draws[0]![6]).toBe(192); // row·32, sin qoff
  });
});

describe("candidata 1 — (2f) re-aplica sólo cuando el paso (2) RECOMPUSO el viewport", () => {
  it("el gate de (2f) es la VÍA (terrainOnly), no el transit — dy=16 medido en recorte pleno sin cruce", () => {
    // Estructural, mismo residuo declarado que el aserto de 5962ad37 al que sustituye
    // (present() exige atlas/upscaler/canvas reales): el gate nuevo SUBSUME al viejo
    // (`transiting` ⇒ `!useMotion` ⇒ `!terrainOnly`), así que el cruce sigue cubierto.
    const src = leer("src/skin/shader/skin.ts");
    const i = src.indexOf("if (qoff > 0 && terrainOnly) this.paintQuakeShift(ctx, wr, qoff * s)");
    expect(i, "el paso (2f) debe declinar en TODA vía de recorte pleno (doble sacudida medida a dy=16)").toBeGreaterThan(0);
  });

  it("present() sigue LLAMANDO a paintWaterOverlay con la vía y el shift del frame", () => {
    // Estructural a sabiendas (mutante M5: quitar la llamada dejaba los 10 asertos de
    // conducta verdes — entran por el método, no por present). Es el mismo residuo
    // declarado que documenta time-spell-flash.test.ts para paintViewportInversions:
    // present() exige atlas/upscaler/canvas reales y un aserto de conducta ahí sería un
    // arnés de 500 líneas; la CONDUCTA del paso la sellan los asertos de arriba y la
    // sonda viva (sonda-2b-motionoff.mjs: delta waterOn/off > 0 en las dos vías).
    const src = leer("src/skin/shader/skin.ts");
    expect(src).toContain(
      "this.paintWaterOverlay(wctx, size, transiting, terrainOnly, snap, now, qoff * s)",
    );
  });

  it("CANDADO: los literales de estos asertos siguen casando con las constantes del sujeto", () => {
    const src = leer("src/skin/shader/skin.ts");
    expect(src).toContain("const SHADER_FACTOR = 6");
    expect(src).toContain("const WATER_CELL_PX = 16 * SHADER_FACTOR");
    const water = leer("src/render/waterfn32.ts");
    expect(water).toContain(
      "export const WATER_SCROLL_TILES: readonly number[] = [0x01, 0x02, 0x03, 0x8f]",
    );
  });
});
