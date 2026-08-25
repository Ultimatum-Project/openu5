/**
 * #350 — PREDICCIÓN ANCLADA del testigo de oráculo del PUENTE de visibilidad (#256).
 *
 * Genera, ANTES de correr el testigo DOSBox (`re/tools/visibility_bridge_probe.py`),
 * la ventana 11×11 que el MODELO TRANSCRITO del binario
 * (`visibility-original-referencia.model.ts`) predice para cada posición del paseo
 * del experimento. El testigo compara estas predicciones contra la RAM del original
 * corriendo (g_vis_buffer 0xAB02 / máscara de luces 0xAD14) — si coinciden, el modelo
 * queda acreditado EMPÍRICAMENTE y la pregunta de #350 («¿el halo de una antorcha
 * sólo extiende la visión si TOCA el disco de la party?») queda contestada con el
 * juego corriendo, no solo con el ASM leído (acta #256 §5).
 *
 * ESCENA: sótano de Lord British (smallmaps.json id 17, z=−1), party andando por la
 * fila y=26 desde x=17 hasta x=25, luz 2 (piso 0xFF ⇒ lightLevel=2 sin depender de
 * la hora). El sconce 0xB0 en (27,24) es el emisor cuyo halo se cruza en el camino.
 *
 * NO es un test de vitest a propósito (sin sufijo .test): es el generador del
 * fixture de predicción. Uso:
 *   cd game && npx tsx tests/visibility-bridge-350.oracle-expected.ts \
 *     > ../re/tools/visibility_bridge_expected.json
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CENTER,
  type Mapa,
  WINDOW,
  bloquea,
  buildLightBuffer,
  originalWindow,
  radialOff,
} from "./visibility-original-referencia.model.js";

const LIGHT = 2; // piso 0xFF ⇒ lightLevel() = 2 (survival.ts, 0x50BA `cmp [g_floor],0x7f; ja`)
const ROW_Y = 26;
const X_FROM = 17;
const X_TO = 25;
const SWEEP = 16; // margen de barrido de emisores del modelo (el original barre el chunk entero)
const PAD_TILE = 5; // fuera del 32×32 el chunk rellena con hierba (5), como en smallmaps.json

const smallmaps = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../assets/maps/smallmaps.json", import.meta.url)),
    "utf8",
  ),
) as { id: number; name: string; floors: { z: number; tiles: number[][] }[] }[];

const lb = smallmaps.find((s) => s.id === 17);
if (!lb) throw new Error("smallmaps.json sin id 17 (castillo de LB)");
const floor = lb.floors.find((f) => f.z === -1);
if (!floor) throw new Error("castillo de LB sin z=-1");
const tiles = floor.tiles;

const mapa: Mapa = (x, y) =>
  y >= 0 && y < 32 && x >= 0 && x < 32 ? tiles[y]![x]! & 0xff : PAD_TILE;

interface Prediccion {
  px: number;
  py: number;
  /** 121 chars, index r*11+c: '1' visible, '0' oculta. */
  window: string;
  /** celdas del MAPA iluminadas (0xAD14) que caen dentro de la ventana. */
  litInWindow: string[];
  /**
   * celdas iluminadas + TRANSPARENTES + fuera del radio: el sujeto del PUENTE
   * (5c05-5c45). visible=true solo puede venir de una cadena que arranca en el disco.
   */
  bridgeCells: { x: number; y: number; visible: boolean }[];
  /**
   * celdas iluminadas + OPACAS + fuera del radio: la ASIMETRÍA (5c52-5c91) — un muro
   * se ve con solo estar él en 0xAD14, SIN mirar al padre (acta #256 §1).
   */
  opaqueLitCells: { x: number; y: number; visible: boolean }[];
  visibleCount: number;
}

const out: {
  ficha: string;
  scene: { location: number; floorByte: number; light: number };
  emitter: { x: number; y: number; tile: number };
  walk: { y: number; from: number; to: number };
  positions: Prediccion[];
  transition: { firstBridgingPx: number | null };
} = {
  ficha: "#350",
  scene: { location: 0x11, floorByte: 0xff, light: LIGHT },
  emitter: { x: 27, y: 24, tile: tiles[24]![27]! & 0xff },
  walk: { y: ROW_Y, from: X_FROM, to: X_TO },
  positions: [],
  transition: { firstBridgingPx: null },
};

for (let px = X_FROM; px <= X_TO; px++) {
  const lit = buildLightBuffer(mapa, px, ROW_Y, SWEEP);
  const w = originalWindow(LIGHT, mapa, px, ROW_Y, lit);
  const litInWindow: string[] = [];
  const bridgeCells: { x: number; y: number; visible: boolean }[] = [];
  const opaqueLitCells: { x: number; y: number; visible: boolean }[] = [];
  let visibleCount = 0;
  for (let r = 0; r < WINDOW; r++) {
    for (let c = 0; c < WINDOW; c++) {
      const mx = px - CENTER + c;
      const my = ROW_Y - CENTER + r;
      const vis = w[r * WINDOW + c] === 1;
      if (vis) visibleCount++;
      if (lit.has(`${mx},${my}`)) {
        litInWindow.push(`${mx},${my}`);
        const rad = radialOff(Math.abs(c - CENTER), Math.abs(r - CENTER));
        if (rad > LIGHT) {
          (bloquea(mapa(mx, my), rad) ? opaqueLitCells : bridgeCells).push({
            x: mx,
            y: my,
            visible: vis,
          });
        }
      }
    }
  }
  const bridging = bridgeCells.some((b) => b.visible);
  if (bridging && out.transition.firstBridgingPx === null)
    out.transition.firstBridgingPx = px;
  out.positions.push({
    px,
    py: ROW_Y,
    window: Array.from(w, (v) => (v ? "1" : "0")).join(""),
    litInWindow,
    bridgeCells,
    opaqueLitCells,
    visibleCount,
  });
}

process.stdout.write(JSON.stringify(out, null, 1) + "\n");
