/**
 * EL CLÍMAX DEL RITUAL DEL SHARD TIENE QUE CABER EN EL CLIP — carril `fx-ritual-shard` (22-08).
 *
 * ── QUÉ DEFECTO CIERRA, Y POR QUÉ NO ERA EL QUE PARECÍA ──────────────────────────────
 * El índice de la colección de vídeos fichó «el ritual del Shard no tiene FX portado» y
 * «`fxActive` se queda arriba ~12 s sin pintar nada», citando `core/quest/ritual.ts:170-183`.
 * Las DOS son falsas, y la medición que las sostenía era correcta:
 *
 *   · Los FX SÍ se emiten — `core/endgame/use-tools.ts` empuja 3 `{kind:"quake"}` y un
 *     `cell-explosion` con `bursts:7` — y los pintan LAS DOS pieles (`skin/world-fx.ts` y
 *     los pasos (2f)/(2e-bis) de `skin/shader/skin.ts`, pareados por #243).
 *     `ritual.ts:170-183` es el docblock de la máquina de estados PURA, que en efecto no
 *     pinta: la coreografía vive en el MANEJADOR, no en el reductor. Citar el docblock del
 *     reductor para negar el manejador es lo que sostuvo la ficha durante dos tandas.
 *   · Los ~12 s de `fxActive` son el `leadMs` de #208: el `shard-sweep` de CAST 0x15dd-0x162a
 *     dura 7130 ms y en el binario BLOQUEA antes de que ocurra nada visual (la pausa
 *     `0x1674 push 7; call 0x7b66` va DESPUÉS del barrido). El flag está arriba porque la
 *     coreografía está AGENDADA y pendiente, y al soltarla pinta.
 *
 * ⇒ El defecto real era del ARNÉS: `eventos.mjs` grababa con `drenajeMaxMs: 1500` y el clip
 * terminaba 6,3 s ANTES de que el clímax empezara. El grabador lo avisaba en cada corrida
 * («fxActive no drenó en 1500 ms — corte con FX vivo») y ese aviso se leyó como confirmación
 * de la ausencia. Medido A/B (misma rama, mismo servidor, `crop=760:800:0:0`): ANTES cero
 * fotogramas con diff>5 tras el doom (máx 0,236); DESPUÉS 46 en fiel de doom+7,14 a doom+9,78
 * con máximo 38,2 ⇒ discriminante ×162, y el arranque a +10 ms del derivado.
 *
 * ── LO QUE ESTE FICHERO VIGILA ───────────────────────────────────────────────────────
 * La ventana de grabación tiene que CUBRIR la coreografía. Es un acoplamiento entre una
 * constante del arnés (`drenajeMaxMs`) y el plan del port (`planTurnPhase`), y sin guarda
 * nadie los carea: bajar el drenaje vuelve a producir un vídeo que corta el clímax SIN
 * que nada se ponga rojo — que es exactamente lo que pasó.
 *
 * 🔴 LOS ESPERADOS VAN EN CRUDO (7130 · 9938 · 10523). Recalcularlos desde `QUAKE_PULSES`,
 * `QUAKE_PERIOD_MS` y el catálogo —las mismas fuentes que el sujeto— sería tautológico:
 * el aserto pasaría con la coreografía cambiada. Son los mismos tres números que
 * `fase-audio-208.test.ts` fija por el otro lado (el audio), y por eso mover uno enrojece
 * en dos sitios.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameEvent } from "../src/core/game.js";
import type { GameState } from "../src/core/state.js";
import { useShard, type UseToolsCtx } from "../src/core/endgame/use-tools.js";
import { FLAME_X, FLAME_Y, FLAME_LOCATION, FLAME_FLOOR, SHADOWLORD_TILE } from "../src/core/quest/ritual.js";
import { planTurnPhase } from "../src/skin/turn-phase.js";
import { QUAKE_PULSES, QUAKE_PERIOD_MS } from "../src/skin/fiel/quake.js";
import { PAUSE_UNIT_MS, EXPLOSION_BURST_MS } from "../src/skin/world-fx.js";
// @ts-expect-error — herramienta de autoría en JS puro, sin .d.ts
import { EVENTOS } from "../tools/videocap/eventos.mjs";
import {
  adjudica,
  resuelveExp,
  OK,
  FALLO,
  // @ts-expect-error — herramienta de autoría en JS puro, sin .d.ts
} from "../tools/videocap/gate-core.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const EXPS = JSON.parse(readFileSync(join(RAIZ, "tools/videocap/expectativas.json"), "utf8"));

/** Los ids de `eventos.mjs` que graban el ritual. */
const EVENTOS_RITUAL = [
  "shadowlord-shard-faulinei",
  "shadowlord-shard-astaroth",
  "shadowlord-shard-nosfentor",
] as const;
/** Los .webm que produce (piel incluida) — la población del gate. */
const VIDEOS_RITUAL = [
  "shadowlord-shard-faulinei-faithful",
  "shadowlord-shard-faulinei-shader",
  "shadowlord-shard-astaroth-shader",
  "shadowlord-shard-nosfentor-shader",
] as const;

/**
 * 🔴 EL LOTE SE PIDE A `useShard`, NO SE COPIA A MANO — y esto es una corrección MEDIDA,
 * no una preferencia de estilo. La primera versión de este fichero construía el array
 * literal («3 quake + cell-explosion bursts:7 + los sfx»), y con esa fuente los mutantes
 * del CORE **sobrevivían los dos**: bajar la coreografía a 2 sacudidas (`k < 2`) y quitar
 * el `underTile` dejaban los 6 asertos VERDES, porque el sujeto que medían era mi copia,
 * no el emisor. Instanciar la diferencia donde EXISTE = conducir la función real.
 *
 * El `ctx` mínimo es el de `shard-ritual-av.test.ts` (mismo patrón, misma razón: el aserto
 * mira LOS EVENTOS y nada más), con la party EN la Llama y el Shadowlord convocado al
 * norte, que es la rama `destroyed`.
 */
const IDX = 0; // falsehood / Faulinei — Lycaeum
function ctxEnLaLlama(): UseToolsCtx {
  const x = FLAME_X[IDX]!;
  const y = FLAME_Y[IDX]!;
  const location = FLAME_LOCATION[IDX]!;
  const floor = FLAME_FLOOR[IDX]!;
  const state = {
    position: { x, y, location, floor },
    questFlags: {},
    shards: { falsehood: true, hatred: true, cowardice: true },
    shadowlordLocs: [0, 0, 0],
    shadowlordDoomBits: 0,
    shadowlordSummoned: IDX,
    npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
    worldObjects: [{ tile: SHADOWLORD_TILE, location, floor, x, y: y - 1 }],
  } as unknown as GameState;
  return {
    state,
    dungeonState: null,
    rand: () => 0,
    mapTileWithOverrides: () => 0,
    setMapOverride: () => {},
    setVolatileTerrain: () => {},
    syncTransportFromTile: () => {},
  } as unknown as UseToolsCtx;
}
function loteDelRitual(): GameEvent[] {
  const evs = useShard(ctxEnLaLlama(), "falsehood") as unknown as GameEvent[];
  // Control positivo del arnés: si el escenario dejara de alcanzar la rama de destrucción,
  // el lote saldría corto y los asertos de abajo medirían otra cosa sin avisar.
  if (!evs.some((e) => e.kind === "cell-explosion")) {
    throw new Error("el arnés NO alcanzó la rama de destrucción: el lote no trae cell-explosion");
  }
  return evs;
}

/** Instante (ms tras el lote) del ÚLTIMO píxel que mueve el ritual. */
function finVisualMs(): number {
  const p = planTurnPhase(loteDelRitual());
  const ex = p.explosions[0]!;
  return ex.leadMs + ex.cellFx.preDelayUnits * PAUSE_UNIT_MS + ex.cellFx.bursts * EXPLOSION_BURST_MS;
}

describe("la coreografía del ritual del Shard, y su ventana", () => {
  it("el plan del ritual es 3 sacudidas tras el barrido + 7 ráfagas: 7130 → 9938 → 10523 ms EN CRUDO", () => {
    const p = planTurnPhase(loteDelRitual());
    expect(p.quakes).toBe(3); // CAST 0x169d/0x16a0/0x16a3 — tres `call 0x70f2`, cero args
    expect(Math.round(p.quakeStartMs)).toBe(7130); // el barrido CAST 0x15dd-0x162a bloquea antes
    expect(Math.round(p.quakeStartMs + p.quakes * QUAKE_PULSES * QUAKE_PERIOD_MS)).toBe(9938);
    expect(p.explosions).toHaveLength(1);
    expect(p.explosions[0]!.cellFx.bursts).toBe(7); // CAST 0x16e1 `mov [bp-2],7`
    expect(Math.round(finVisualMs())).toBe(10523);
  });

  it("el sprite del Shadowlord viaja bajo la ráfaga (underTile 0xFC CRUDO, sin banco)", () => {
    // El orden del binario: los escritos de estado (0x1708) van DESPUÉS de las siete
    // explosiones (0x16e1-0x16fa). Se reproduce por presentación (#243) — y el byte va
    // CRUDO porque el banco alto lo suma la PIEL (Regla A de skin-import-guard).
    const p = planTurnPhase(loteDelRitual());
    expect(p.explosions[0]!.cellFx.underTile).toBe(SHADOWLORD_TILE);
    expect(SHADOWLORD_TILE).toBe(0xfc); // EN CRUDO: CAST 0x16c1 `cmp ax,0xfc`
  });

  it("★ EL ACOPLAMIENTO: el drenaje de cada evento CUBRE los 10523 ms de coreografía", () => {
    const fin = finVisualMs();
    for (const id of EVENTOS_RITUAL) {
      const ev = EVENTOS[id] as { drenajeMaxMs?: number };
      expect(ev, `evento ${id} no existe en eventos.mjs`).toBeTruthy();
      expect(
        ev.drenajeMaxMs ?? 30000,
        `${id}: el drenaje (${ev.drenajeMaxMs}) corta ANTES del fin de la coreografía (${Math.round(fin)} ms) — ` +
          `el clip volvería a acabar sin las 3 sacudidas ni la explosión, que es el defecto de la tanda del 22-08`,
      ).toBeGreaterThan(fin);
    }
  });

  // 🔴 AQUÍ HUBO UN QUINTO ASERTO Y SE RETIRA, con su razón: «el fichero no vuelve a decir
  // “el ritual del shard NO tiene FX portado”». Se puso, se corrió y salió ROJO — contra el
  // propio tachado-documentado de `eventos.mjs`, que CITA la frase retirada para explicar por
  // qué era falsa. Un predicado de texto no distingue la AFIRMACIÓN de su CITA, así que ese
  // aserto sólo podía cumplirse borrando la corrección: premiaba justo la conducta que costó
  // dos tandas (retirar una frase sin dejar dicho que era falsa). Lo que sí es un predicado
  // de CONDUCTA es el acoplamiento de arriba, y ése no se puede satisfacer con prosa.
});

describe("el clímax MUDO del ritual no se lee como cola muerta", () => {
  /**
   * Sidecar de fixture con la GEOMETRÍA MEDIDA de `shadowlord-shard-faulinei-faithful`
   * tras el arreglo: última fila (el doom) en t=9,98 s y metraje de 22,18 s. Los dos
   * números van en crudo, de la medición, no recalculados.
   */
  const sidecarMedido = {
    lines: [
      { t: 7.44, text: "Use item" },
      { t: 9.98, text: "Item: Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood..." },
      { t: 9.98, text: "...and cast it into the Flame of Truth!" },
      { t: 9.98, text: "The doom of the Shadowlord Faulinei is wrought!" },
    ],
    keys: [],
    states: [],
    fin: { t: 22.18 },
    sinks: null,
  };
  /** Los tramos de consola congelada que `freezedetect` da sobre ese metraje: el clímax. */
  const tramosMedidos = [{ start: 9.88, end: 22.18 }];
  const probe = { bytes: 1_688_014, durS: 22.18, errores: [] };

  /**
   * SONDA DE VIEWPORT MEDIDA sobre el mismo `.webm` (carril `gate-viewport`, 22-08, con los
   * keyframes del códec ya descontados): la imagen pinta los tres quakes y la explosión y no
   * se queda quieta hasta **t=20,4 de 22,2** ⇒ 1,8 s de cola realmente muerta, 8 %. La
   * ocupación (16 %) está muy por debajo del 50 % de saturación, así que la sonda informa.
   */
  const viewportMedido = {
    n: 554,
    ocupacion: 0.16,
    tUltimoMov: 20.4,
    quietos: [
      { start: 0, end: 7.44 },
      { start: 7.44, end: 9.88 },
      { start: 20.4, end: 22.18 },
    ],
    max: 38.2,
    umbral: 0.35,
  };

  function veredicto(exp: Record<string, unknown>, viewport: unknown = viewportMedido) {
    const ev = {
      id: "shadowlord-shard-faulinei-faithful",
      exp,
      sidecar: sidecarMedido,
      probe,
      tramos: tramosMedidos,
      report: null,
      party: null,
      viewport,
    };
    const r = adjudica(ev) as { checks: { id: string; estado: string; detalle: string }[] };
    return new Map(r.checks.map((c) => [c.id, c]));
  }

  it("VERDE — y desde el carril `gate-viewport` lo pone la IMAGEN, no un umbral a mano", () => {
    // 🔴 ESTE TESTIGO CAMBIÓ DE MECANISMO SIN CAMBIAR DE PROPIEDAD. Nació guardando que
    // `_climaxMudo` declarase `colaMaxPct: 60` / `paradaMaxS: 14` para estos cuatro vídeos.
    // Esos umbrales están RETIRADOS: la cola se mide ahora sobre el VIEWPORT y la realmente
    // muerta aquí es de 1,8 s (8 %), no del 55 % que la consola reprocha. La propiedad que
    // este bloque protege —«el clímax mudo del ritual no se lee como cola muerta»— sigue
    // siendo la misma y sigue guardada; lo que ya no se guarda es el PARCHE que la sostenía.
    const fila = EXPS.videos["shadowlord-shard-faulinei-faithful"] as Record<string, unknown>;
    expect(fila.colaMaxPct, "el umbral por caso debía estar retirado de SU FILA").toBeUndefined();
    expect(fila.paradaMaxS, "el umbral por caso debía estar retirado de SU FILA").toBeUndefined();
    const exp = resuelveExp(EXPS, "shadowlord-shard-faulinei-faithful") as Record<string, unknown>;
    // y resuelve a los defaults del fichero, que es lo que le toca a un vídeo sin fila propia
    expect(exp.colaMaxPct).toBe(EXPS.defaults.colaMaxPct);
    expect(exp.paradaMaxS).toBe(EXPS.defaults.paradaMaxS);
    const c = veredicto(exp);
    expect(c.get("COLA")!.estado, c.get("COLA")!.detalle).toBe(OK);
    expect(c.get("COLA-VIS")!.estado, c.get("COLA-VIS")!.detalle).toBe(OK);
    expect(c.get("PARADA-VIS")!.estado, c.get("PARADA-VIS")!.detalle).toBe(OK);
    expect(c.get("COLA-VP")!.estado, c.get("COLA-VP")!.detalle).toBe(OK);
    // y que el verde lo pone la imagen se AFIRMA, no se supone: el detalle lo nombra
    expect(c.get("COLA")!.detalle).toContain("el VIEWPORT pinta hasta");
  });

  it("★ SEGUNDO GEMELO ROJO: con la imagen TAMBIÉN muerta, el mismo metraje vuelve a FALLO", () => {
    // El control que impide que el relevo del viewport sea un indulto general para esta
    // familia. Único cambio respecto al verde de arriba: la imagen se para con la consola.
    const exp = resuelveExp(EXPS, "shadowlord-shard-faulinei-faithful") as Record<string, unknown>;
    const c = veredicto(exp, { ...viewportMedido, tUltimoMov: 9.98, quietos: [{ start: 9.98, end: 22.18 }] });
    expect(c.get("COLA")!.estado).toBe(FALLO);
    expect(c.get("COLA-VP")!.estado).toBe(FALLO);
  });

  it("★ GEMELO ROJO: con los umbrales por defecto el MISMO metraje es FALLO", () => {
    // Sin este par, el verde de arriba no mide nada: un predicado que no puede enrojecer
    // pasaría igual con la expectativa borrada. Los 55 % de cola son reales — lo que la
    // expectativa declara es que son el EVENTO, no relleno.
    // Mismos defaults que el gate aplica a cualquier vídeo sin fila propia, y SIN sonda de
    // viewport: es el régimen anterior a `gate-viewport`, donde la única voz era la consola.
    const c = veredicto({ ...EXPS.defaults, debe: [] }, null);
    expect(c.get("COLA")!.estado).toBe(FALLO);
    expect(c.get("COLA-VIS")!.estado).toBe(FALLO);
    expect(c.get("PARADA-VIS")!.estado).toBe(FALLO);
  });

  it("los CUATRO vídeos del ritual: NINGUNO necesita ya umbral por caso, y los cuatro lo dicen", () => {
    // 🔴 ESTE TESTIGO SE INVIRTIÓ, y a propósito. Exigía que los cuatro DECLARASEN
    // `colaMaxPct >= 55` y `paradaMaxS >= 13`; hoy exige lo contrario, porque el parche que
    // guardaba desapareció con su causa. Lo que NO cambia es la exigencia de fondo: que la
    // decisión esté ESCRITA. Cada uno lleva su `_umbralRetirado` con la cifra medida que la
    // justifica, igual que antes llevaba su `colaMaxPctPorque`.
    for (const id of VIDEOS_RITUAL) {
      // Se mira la FILA CRUDA y no `resuelveExp`, que mezcla los defaults: preguntarle a la
      // resuelta si lleva umbral daría siempre 30 y el aserto no mediría nada.
      const fila = (EXPS.videos as Record<string, Record<string, unknown>>)[id]!;
      expect(fila.colaMaxPct, `${id} vuelve a llevar colaMaxPct a mano`).toBeUndefined();
      expect(fila.paradaMaxS, `${id} vuelve a llevar paradaMaxS a mano`).toBeUndefined();
      expect(fila._umbralRetirado, `${id} retira el umbral sin decir con qué cifra`).toBeTruthy();
      expect(String(fila._umbralRetirado), `${id} no cita la cola realmente muerta`).toMatch(/realmente muerta/);
    }
  });
});
