import { describe, expect, it } from "vitest";
import {
  TILE_DEAD_TREE,
  TILE_PLOWED_FIELD,
  TILE_TREE,
  TILE_WHEAT_IN_FIELD,
  witherTownVegetation,
} from "../src/core/world/shadowlord-wither.js";

/**
 * #195 — la MARCHITACIÓN del pueblo ocupado por un Shadowlord (TOWN.OVL 0x0212).
 *
 * Derivación byte a byte en `re/notes/shadowlord-urbano-acta.md §1`; el tramo:
 *
 *   021a  cmp byte [g_shadowlord_here_idx, DS 0x5958], 0xff / 0221 jmp 0x2a8  ; sin SL ⇒ NO toca nada
 *   0224  mov al,[g_day, DS 0x587e] / 0229 push ax / 022a call CS 0x207e      ; srand(g_day) DETERMINISTA
 *   0232  [bp-0xc]=0 … 0291 [bp-0xc]+=0x20 … 0295 cmp [bp-0xc],0x400          ; 32 filas
 *   0237  sub si,si … 026b inc si / 026c cmp si,0x20                          ; 32 columnas
 *   0245  mov al,[bx+si+0x6608]                                               ; tile del búfer vivo
 *   024b  cmp ax,0x2d / 024e je 0x274      ⇒ 0286 [.]=0x2c                    ; WheatInField ⇒ PlowedField
 *   0250  cmp ax,0x2e / 0253 jne 0x26b     ⇒ 0266 [.]=0x2b                    ; Tree ⇒ DeadTree
 *   0255  push 0 / push 7 / 025c call CS 0x2092  (idem 027b)                  ; rand(0,7) por tile elegible
 *   025f  or ax,ax / 0261 je 0x26b         (idem 027e/0280)                   ; r==0 (1/8) NO convierte
 *
 * El eje del barrido está DERIVADO, no heredado: `tile_addr` (ULTIMA.EXE 0x4402) resuelve
 * en 0x449e-0x44a8 `addr = ([bp+4] << 5) + [bp+6] + 0x6608`, y el call-site MAINOUT 0x06FE
 * (`push g_party_x` / 0x0704 `push g_party_y` / 0x0708 call) fija que [bp+4] es la **y**
 * — el último push es el que cae en bp+4. ⇒ el índice externo (que avanza de 0x20 en 0x20)
 * es la FILA y el interno la COLUMNA: se barre `for y: for x:`.
 */

/** Mapa 32×32 vacío (todo hierba 0x05) sobre el que sembrar tiles elegibles a mano. */
function blankMap(): number[][] {
  return Array.from({ length: 32 }, () => new Array<number>(32).fill(0x05));
}

function readerOf(m: number[][]): (x: number, y: number) => number {
  return (x, y) => m[y]![x]!;
}

/** New Magincia piso 0, medido sobre `game/assets/maps/smallmaps.json`: 2 árboles + 45 trigos. */
const MAGINCIA_N = 47;
/** Skara Brae piso 0, medido: 29 árboles, 0 trigo. */
const SKARA_N = 29;

describe("marchitación del Shadowlord (TOWN 0x0212)", () => {
  it("★ CONTROL POSITIVO: con tiles elegibles MUEREN tiles (no es un cero degenerado)", () => {
    // Precondición explícita (#187): el dato que el emisor consulta NO está vacío. Sin
    // esto, un mapa sin árboles ni trigo daría 0 conversiones y el test pasaría en falso
    // — que es justo lo que le pasa a quien sondea Moonglow o Yew (N=0, §1.3 del acta).
    const m = blankMap();
    for (let i = 0; i < MAGINCIA_N; i++) m[3]![i % 32] = TILE_TREE;
    const eligibles = m.flat().filter((t) => t === TILE_TREE || t === TILE_WHEAT_IN_FIELD).length;
    expect(eligibles, "precondición: el mapa TIENE vegetación marchitable").toBeGreaterThan(0);

    const out = witherTownVegetation(7, readerOf(m));
    expect(out.length, "a 7/8 por tile, con N=32 elegibles no puede salir 0").toBeGreaterThan(0);
    expect(out.every((w) => w.tile === TILE_DEAD_TREE)).toBe(true);
  });

  it("★ DETERMINISTA por día: la misma semilla da EXACTAMENTE los mismos tiles muertos", () => {
    const m = blankMap();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) m[y]![x] = TILE_WHEAT_IN_FIELD;
    const a = witherTownVegetation(11, readerOf(m));
    const b = witherTownVegetation(11, readerOf(m));
    expect(b).toEqual(a);
    // …y días distintos dan patrones distintos (si no, `srand(g_day)` no estaría cableado).
    const c = witherTownVegetation(12, readerOf(m));
    expect(c).not.toEqual(a);
  });

  it("el barrido es POR FILAS (y externa, x interna) — el orden fija QUÉ tile muere", () => {
    // Dos tiles elegibles en (0,1) y (1,0). Con `for y: for x:` se visita ANTES (1,0)
    // [fila 0] que (0,1) [fila 1]; con los ejes transpuestos sería al revés. Se compara
    // contra el orden de emisión, que es el orden de consumo del rand.
    const m = blankMap();
    m[1]![0] = TILE_TREE; // (x=0, y=1)
    m[0]![1] = TILE_TREE; // (x=1, y=0)
    const out = witherTownVegetation(3, readerOf(m));
    expect(out.length, "control: con 2 elegibles y 7/8 deben caer los dos con d=3").toBe(2);
    expect(out[0]).toEqual({ x: 1, y: 0, tile: TILE_DEAD_TREE });
    expect(out[1]).toEqual({ x: 0, y: 1, tile: TILE_DEAD_TREE });
  });

  it("cada tile elegible consume EXACTAMENTE 1 rand — los NO elegibles, ninguno", () => {
    // El discriminador: dos mapas con el MISMO número de elegibles pero distinta cantidad
    // de relleno inerte producen la misma secuencia de decisiones. Si el relleno gastara
    // stream, los patrones divergirían.
    const sparse = blankMap();
    const dense = blankMap();
    for (let i = 0; i < 10; i++) {
      sparse[0]![i] = TILE_TREE;
      dense[0]![i] = TILE_TREE;
    }
    for (let i = 10; i < 32; i++) dense[5]![i] = 0x0a; // relleno NO elegible
    expect(witherTownVegetation(5, readerOf(dense)).map((w) => `${w.x},${w.y}`)).toEqual(
      witherTownVegetation(5, readerOf(sparse)).map((w) => `${w.x},${w.y}`),
    );
  });

  it("mapea cada origen a su destino y NUNCA toca otra cosa", () => {
    const m = blankMap();
    m[0]![0] = TILE_TREE;
    m[0]![1] = TILE_WHEAT_IN_FIELD;
    m[0]![2] = TILE_DEAD_TREE; // ya muerto: NO es origen, no se re-convierte
    m[0]![3] = TILE_PLOWED_FIELD; // ya arado: idem
    const out = witherTownVegetation(9, readerOf(m));
    expect(out.every((w) => w.x <= 1)).toBe(true);
    for (const w of out) {
      expect(w.tile).toBe(w.x === 0 ? TILE_DEAD_TREE : TILE_PLOWED_FIELD);
    }
  });

  it("caso DEGENERADO declarado: sin vegetación no muere nada (Moonglow/Yew, N=0)", () => {
    expect(witherTownVegetation(4, readerOf(blankMap()))).toEqual([]);
  });

  it("★ la tasa medida sobre los N reales cae donde la pone 7/8, no en 0 ni en N", () => {
    // 7/8 por tile: sobre N=47 (New Magincia) la esperanza es 41,1 y sobre N=29 (Skara
    // Brae) 25,4. Se recorre el mes entero (g_day 1..28) y se exige que la media caiga en
    // una banda amplia alrededor de la esperanza — un detector de la PROBABILIDAD, no un
    // sello del valor exacto de ningún día.
    for (const n of [MAGINCIA_N, SKARA_N]) {
      const m = blankMap();
      for (let i = 0; i < n; i++) m[Math.floor(i / 32)]![i % 32] = TILE_TREE;
      let total = 0;
      for (let day = 1; day <= 28; day++) total += witherTownVegetation(day, readerOf(m)).length;
      const media = total / 28;
      expect(media, `N=${n}: media ${media} fuera de la banda de 7/8`).toBeGreaterThan(n * 0.75);
      expect(media).toBeLessThan(n);
    }
  });
});
