/**
 * #350-resplandor — EL RESPLANDOR A DISTANCIA, careado contra la RAM del original.
 *
 * QUÉ ES. El acta #350 (re/notes/visibilidad-350-testigo.md §4-§6) midió que el
 * original SOBRE-revela respecto del modelo de #256: con el halo de una antorcha
 * SIN tocar el disco de la party, el original enseña ADEMÁS un subconjunto de las
 * celdas iluminadas (34 celdas en 726 celdas-posición, cota estricta: todas en
 * 0xAD14, jamás sub-revelado) — y dejó el mecanismo ABIERTO («el encolador de
 * (21,27) sin nombre»). La derivación que lo cierra está en
 * re/notes/resplandor-350-derivacion.md y encarnada en
 * re/tools/visibility_resplandor_v3_sim.py: la polaridad de 0x5DFE estaba
 * invertida en la lectura de #256/#350-§3 (0x402 es memchr: devuelve ≠0 al
 * HALLAR; 0x5DFE mapea hallado→0 = bloquea, no-hallado→1 = pasa), con lo que
 * 5c52.. es la vía TRANSPARENTE fuera del radio (visible ⟺ la PROPIA en 0xAD14,
 * SIN padre) y 5c05.. la OPACA (padre≠0 Y padre lit Y propia lit). Y el
 * encolador: la transparente-no-iluminada (5c74) escribe 0 en el buffer pero NO
 * toca [bp-0x214], que conserva el TILE — el push (5cb9) decide sobre ese tile y
 * ENCOLA LA CELDA OCULTA. El flood recorre toda la región transparente
 * alcanzable del encuadre, a oscuras incluida, y cada celda transparente
 * iluminada que toca se enciende POR SÍ SOLA. Validación: el sim V3 reproduce
 * las 726 celdas-posición con CERO mismatches y las aristas del trace en su
 * orden exacto de anillo.
 *
 * LOS ESPERADOS VAN EN CRUDO (regla del esperado no-derivado-del-sujeto): son la
 * RAM de DOSBox de las corridas de #350 —g_vis_buffer 0xAB02 reducido a bit
 * visible/oculta y máscara 0xAD14 reducida a coordenadas iluminadas de la
 * ventana— transcritos aquí VERBATIM desde los volcados (vis350-testigo-v4 /
 * vis350-solo-{19,20,21,22,25}, dosbox-x 2026.07.02, pausas validadas; los JSON
 * completos no se commitean porque llevan rejillas de tiles — material EA, misma
 * razón que smallmaps.json gitignored, ficha #307. Se regeneran con
 * re/tools/visibility_bridge_probe.py). Ningún esperado se calcula desde el port
 * ni desde el modelo: si el port y el modelo cambian, estas cadenas NO cambian.
 *
 * ESCENA: sótano de Lord British (smallmaps.json id 17, z=−1), party en la fila
 * y=26, luz 2. px=17/19/20 = régimen a DISTANCIA (aquí vive el resplandor:
 * 2/10/22 celdas que el modelo de #256 no enseñaba); px=21/22/25 = régimen de
 * CONTACTO (idéntico bajo las dos lecturas — el control de que la corrección no
 * mueve lo ya acreditado).
 *
 * ESTRENO EN ROJO (20-08): antes del calco, la mitad del port de este fichero
 * daba 3 rojos (px=17/19/20, las 34 celdas exactas) y la del modelo otros 3;
 * los tres de contacto ya estaban verdes. Tras el calco: 6/6 verdes sin tocar
 * una sola cadena esperada.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WINDOW, computeVisibleWindow } from "../src/core/world/visibility.js";
import {
  CENTER,
  type Mapa,
  bloquea,
  buildLightBuffer,
  originalWindow,
  radialOff,
  win,
} from "./visibility-original-referencia.model.js";

const LIGHT = 2; // piso 0xFF ⇒ lightLevel() = 2 (0x50BA), como en las corridas

/**
 * LA RAM, EN CRUDO. `ram` = 121 chars row-major (índice r*11+c), '1' = byte de
 * g_vis_buffer ≠ 0xFF en la pausa validada de 0x598A; `lit` = celdas de MAPA de
 * la ventana con byte ≠ 0 en 0xAD14 ("x,y" global del chunk 32×32).
 */
const CORRIDAS: { px: number; py: number; ram: string; lit: string[] }[] = [
  { px: 17, py: 26,
    ram: "0000000000000000000000000000000000000000000000001110000000011100000000111000100000000001000000000000000000000000000000000",
    lit: ["20,21", "21,21", "22,21", "21,22", "22,22", "22,27", "22,28"] },
  { px: 19, py: 26,
    ram: "0000000000000000000000000000000000000000000100001110001000011100110000111011100000000111000000000000000000000000000000000",
    lit: ["20,21", "21,21", "22,21", "23,21", "24,21", "21,22", "22,22", "23,22", "24,23", "24,24", "24,25", "23,26", "24,26", "22,27", "23,27", "24,27", "22,28", "23,28", "24,28", "24,29", "24,30"] },
  { px: 20, py: 26,
    ram: "0000000001000000000001000000000110000000001100001110011000011101110000111111100000001111000000000110000000001100000000000",
    lit: ["20,21", "21,21", "22,21", "23,21", "24,21", "21,22", "22,22", "23,22", "25,22", "24,23", "25,23", "24,24", "25,24", "24,25", "25,25", "23,26", "24,26", "25,26", "22,27", "23,27", "24,27", "25,27", "22,28", "23,28", "24,28", "25,28", "24,29", "25,29", "24,30", "25,30"] },
  { px: 21, py: 26,
    ram: "0000000010100000000011000000001110000000011100001110111000011111110000111111100000011111000000001110000000011100000000000",
    lit: ["20,21", "21,21", "22,21", "23,21", "24,21", "26,21", "21,22", "22,22", "23,22", "25,22", "26,22", "24,23", "25,23", "26,23", "24,24", "25,24", "26,24", "24,25", "25,25", "26,25", "23,26", "24,26", "25,26", "26,26", "22,27", "23,27", "24,27", "25,27", "26,27", "22,28", "23,28", "24,28", "25,28", "26,28", "24,29", "25,29", "26,29", "24,30", "25,30", "26,30"] },
  { px: 22, py: 26,
    ram: "0000000101100000000111000000011110000000111100001111111000011111110000111111100000111111000000011110000000111100000000000",
    lit: ["20,21", "21,21", "22,21", "23,21", "24,21", "26,21", "27,21", "21,22", "22,22", "23,22", "25,22", "26,22", "27,22", "24,23", "25,23", "26,23", "27,23", "24,24", "25,24", "26,24", "27,24", "24,25", "25,25", "26,25", "27,25", "23,26", "24,26", "25,26", "26,26", "27,26", "22,27", "23,27", "24,27", "25,27", "26,27", "27,27", "22,28", "23,28", "24,28", "25,28", "26,28", "27,28", "24,29", "25,29", "26,29", "27,29", "24,30", "25,30", "26,30", "27,30"] },
  { px: 25, py: 26,
    ram: "0000101110000000111100000011111000000111111100001111111000111111100011111110000111111100000011111000000111100000000000000",
    lit: ["20,21", "21,21", "22,21", "23,21", "24,21", "26,21", "27,21", "28,21", "21,22", "22,22", "23,22", "25,22", "26,22", "27,22", "28,22", "24,23", "25,23", "26,23", "27,23", "28,23", "24,24", "25,24", "26,24", "27,24", "28,24", "29,24", "30,24", "24,25", "25,25", "26,25", "27,25", "28,25", "29,25", "30,25", "23,26", "24,26", "25,26", "26,26", "27,26", "28,26", "29,26", "22,27", "23,27", "24,27", "25,27", "26,27", "27,27", "28,27", "22,28", "23,28", "24,28", "25,28", "26,28", "27,28", "28,28", "24,29", "25,29", "26,29", "27,29", "28,29", "24,30", "25,30", "26,30", "27,30"] },
];

/**
 * El SOBRE-revelado medido por #350, por posición (§4 del acta): las celdas que
 * el modelo de #256 dejaba a oscuras y el original enseña. 2+10+22 = 34, y en
 * contacto (px≥21) CERO — la coincidencia celda a celda que acreditó a #256.
 */
const RESPLANDOR_MEDIDO: Record<number, number> = { 17: 2, 19: 10, 20: 22, 21: 0, 22: 0, 25: 0 };

const smallmaps = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../assets/maps/smallmaps.json", import.meta.url)),
    "utf8",
  ),
) as { id: number; floors: { z: number; tiles: number[][] }[] }[];
const tiles = smallmaps.find((s) => s.id === 17)!.floors.find((f) => f.z === -1)!.tiles;
const mapa: Mapa = (x, y) =>
  y >= 0 && y < 32 && x >= 0 && x < 32 ? tiles[y]![x]! & 0xff : 0x05;

const bits = (w: Uint8Array): string => Array.from(w, (v) => (v ? "1" : "0")).join("");

describe("#350-resplandor resplandor a distancia — la RAM del original como esperado EN CRUDO", () => {
  it("CONTROL del instrumento: la máscara de luces modelada ES la RAM de 0xAD14, en la ventana, 6/6", () => {
    // Precondición de todo lo demás: si el barrido de emisores del modelo no
    // reprodujera 0xAD14 en la ventana, los careos de abajo medirían el barrido
    // y no el pase de la party. Set equality contra las coordenadas EN CRUDO.
    for (const { px, py, lit } of CORRIDAS) {
      const buffer = buildLightBuffer(mapa, px, py, 16);
      const enVentana = new Set<string>();
      for (let r = 0; r < WINDOW; r++)
        for (let c = 0; c < WINDOW; c++) {
          const k = `${px - CENTER + c},${py - CENTER + r}`;
          if (buffer.has(k)) enVentana.add(k);
        }
      expect({ px, lit: [...enVentana].sort() }).toEqual({ px, lit: [...lit].sort() });
    }
  });

  it("el MODELO reproduce la RAM celda a celda con la máscara EN CRUDO — las 726, resplandor incluido", () => {
    for (const { px, py, ram, lit } of CORRIDAS) {
      const o = originalWindow(LIGHT, mapa, px, py, new Set(lit));
      expect({ px, w: bits(o) }).toEqual({ px, w: ram });
    }
  });

  it("el PORT reproduce la RAM celda a celda, de punta a punta (emisores propios), 6/6", () => {
    for (const { px, py, ram } of CORRIDAS) {
      const p = computeVisibleWindow(LIGHT, win(mapa, px, py));
      expect({ px, w: bits(p) }).toEqual({ px, w: ram });
    }
  });

  // El resplandor tiene DOS piezas load-bearing, y el estreno de este fichero lo
  // MIDIÓ (20-08): el primer borrador traía un solo mutante (sin encolado de
  // ocultas) esperando que perdiera las 34, y en px=20 perdió CERO — porque ahí
  // el halo toca el disco por ADYACENCIA y lo que revela no es el encolado sino
  // la regla transparente-sin-padre (la otra mitad de la corrección). Dos
  // mutantes, uno por pieza; entre los dos cubren las 34 celdas y cada uno deja
  // al otro como control de que su pieza no basta sola.

  it("★ MUTANTE A (sin encolado de ocultas): pierde el resplandor TRAS HUECO A OSCURAS — 2/10/0/0/0/0, todo iluminado", () => {
    // La pieza del ENCOLADOR (5c74 no toca [bp-0x214] ⇒ el push encola la celda
    // oculta): sin ella el flood muere en el borde de lo visible y sólo se
    // pierden las celdas iluminadas separadas del disco por oscuridad (el islote
    // de px=17 y la sala de px=19). En px=20 pierde CERO: ahí no hay hueco.
    const ESPERADO: Record<number, number> = { 17: 2, 19: 10, 20: 0, 21: 0, 22: 0, 25: 0 };
    for (const { px, py, ram, lit } of CORRIDAS) {
      const litSet = new Set(lit);
      const w = bits(ventanaMutante(LIGHT, mapa, px, py, litSet, { encolaOcultas: false }));
      expect({ px, ...perdidasEInventadas(w, ram, px, py, litSet) }).toEqual({
        px, perdidas: ESPERADO[px]!, inventadas: 0,
      });
    }
  });

  it("★ MUTANTE B (la regla de #256: puente-con-padre en la transparente): pierde EXACTAMENTE las 34 medidas — 2/10/22/0/0/0", () => {
    // La lectura REFUTADA entera (ramas intercambiadas: transparente exige
    // padre-visible+padre-lit, opaca va con propia-sola): reproduce el careo del
    // acta #350 §4 — pierde las 34 celdas del sobre-revelado medido y ni una
    // más, y en contacto (px≥21) coincide celda a celda (por eso #256 quedó
    // acreditado ahí y la inversión sólo la delató la distancia).
    for (const { px, py, ram, lit } of CORRIDAS) {
      const litSet = new Set(lit);
      const w = bits(ventanaMutante(LIGHT, mapa, px, py, litSet, { reglaVieja256: true }));
      expect({ px, ...perdidasEInventadas(w, ram, px, py, litSet) }).toEqual({
        px, perdidas: RESPLANDOR_MEDIDO[px]!, inventadas: 0,
      });
    }
  });
});

/**
 * Careo mutante-vs-RAM: cuenta las celdas que el mutante PIERDE (RAM visible,
 * mutante oculta — cada una asertada ⊆ lit, la cota estricta de #350 §4) y las
 * que INVENTA (mutante visible, RAM oculta — debe ser siempre 0: los mutantes
 * sólo quitan mecanismo).
 */
function perdidasEInventadas(
  w: string,
  ram: string,
  px: number,
  py: number,
  litSet: Set<string>,
): { perdidas: number; inventadas: number } {
  let perdidas = 0, inventadas = 0;
  for (let i = 0; i < WINDOW * WINDOW; i++) {
    if (ram[i] === "1" && w[i] === "0") {
      perdidas++;
      const c = i % WINDOW;
      const r = (i - c) / WINDOW;
      expect(litSet.has(`${px - CENTER + c},${py - CENTER + r}`)).toBe(true);
    }
    if (w[i] === "1" && ram[i] === "0") inventadas++;
  }
  return { perdidas, inventadas };
}

/**
 * LOS MUTANTES, uno por pieza del mecanismo. Base = la semántica derivada
 * completa (idéntica a `originalWindow`); cada opción QUITA una pieza:
 *   · encolaOcultas:false — la vía 5c74 deja de empujar (sólo empujan las
 *     visibles, como el modelo de #256): muere el cruce de huecos a oscuras.
 *   · reglaVieja256:true — la lectura refutada ENTERA de #256/#350-§3 (ramas
 *     intercambiadas): transparente = puente con padre-visible+padre-lit;
 *     opaca = propia sola. Es lo que el modelo y el port hacían hasta #350.
 * Viven aquí y no en el `.model.ts` por la regla de siempre: el modelo
 * transcribe el binario y no lleva interruptores para conductas que el binario
 * no tiene.
 */
function ventanaMutante(
  light: number,
  at: Mapa,
  px: number,
  py: number,
  lit: Set<string>,
  opts: { encolaOcultas?: boolean; reglaVieja256?: boolean },
): Uint8Array {
  const encolaOcultas = opts.encolaOcultas ?? true;
  const reglaVieja = opts.reglaVieja256 ?? false;
  const UND = 0, HID = 1, VIS = 2;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  const st = new Uint8Array(WINDOW * WINDOW).fill(UND);
  const idx = (c: number, r: number): number => r * WINDOW + c;
  st[idx(CENTER, CENTER)] = VIS;
  const q: [number, number][] = [[CENTER, CENTER]];
  for (let h = 0; h < q.length; h++) {
    const [pc, pr] = q[h]!;
    const padreVisible = st[idx(pc, pr)] === VIS;
    const padreEnBuffer = lit.has(`${px - CENTER + pc},${py - CENTER + pr}`);
    for (const [ox, oy] of N8) {
      const c = pc + ox, r = pr + oy;
      if (c < 0 || r < 0 || c >= WINDOW || r >= WINDOW) continue;
      if (st[idx(c, r)] !== UND) continue;
      const rad = radialOff(Math.abs(c - CENTER), Math.abs(r - CENTER));
      const tile = at(px - CENTER + c, py - CENTER + r);
      const propiaEnBuffer = lit.has(`${px - CENTER + c},${py - CENTER + r}`);
      if (rad <= light) {
        st[idx(c, r)] = VIS;
        if (!bloquea(tile, rad)) q.push([c, r]);
        continue;
      }
      if (reglaVieja) {
        if (bloquea(tile, rad)) {
          st[idx(c, r)] = propiaEnBuffer ? VIS : HID;
        } else if (padreEnBuffer && propiaEnBuffer) {
          st[idx(c, r)] = VIS;
          q.push([c, r]);
        }
        continue;
      }
      if (!bloquea(tile, rad)) {
        st[idx(c, r)] = propiaEnBuffer ? VIS : HID;
        if (st[idx(c, r)] === VIS || encolaOcultas) q.push([c, r]);
        continue;
      }
      if (padreVisible && padreEnBuffer && propiaEnBuffer) st[idx(c, r)] = VIS;
    }
  }
  return st.map((v) => (v === VIS ? 1 : 0));
}
