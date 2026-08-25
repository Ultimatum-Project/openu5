/**
 * FICHA F4 — REFUTADA: «el port pinta HIERBA donde el original pinta NEGRO al sembrar un
 * cofre fuera de la choza de Iolo». No es una divergencia del port: es la SIEMBRA.
 *
 * El arnés `game/tools/careo-visual/captura-port.pw.ts` siembra el cofre con
 * desplazamiento (-3,-3) desde el Avatar. En la choza de Iolo (location 13) el Avatar
 * arranca en (15,15), así que ese desplazamiento cae en (12,12) — y (12,12) NO es
 * «fuera del recinto»: es una casilla del PROPIO MURO de la choza.
 *
 * Y la capa de objetos del mundo TAPA el tile base (`Game.activeMap.tileAt`, la misma
 * composición que alimenta la passability y el muestreador de LOS de `coreview.visField`),
 * así que sembrar ahí no añade un cofre junto al muro: BORRA EL MURO y lo sustituye por un
 * tile transparente. Con el agujero abierto, el flood de 0x5A28 sale al exterior; y de día
 * (`lightLevel` = 0x32 = 50) el radio cubre TODA la ventana (el máximo de la tabla radial
 * DATA.OVL 0x6AB8 es 50), de modo que las 52 casillas negras se encienden de golpe.
 *
 * MEDIDA (2026-08-25, arnés de repro con vite propio en 52xx, canvas lógico 320x200 de la
 * piel fiel, un pase de turno; celdas del VIEWPORT = origen (8,8), 16 px, 11x11):
 *   · base vs base2   → 0 celdas ⇒ determinista, la diferencia es de la siembra
 *   · base            → anillo exterior NEGRO (idéntico al original, que también lo pinta negro)
 *   · cofre en (+2,0) →  6 celdas: el sprite del cofre + los 5 apliques 0xb0/0xb1/0xbf, que
 *                        son tiles ANIMADOS; el anillo negro NO se mueve
 *   · cofre en (-3,-3)→ 58 celdas y NINGUNA negra en las 11x11
 * Aritmética cerrada: 58 = 52 (las que dejan de ser negras) + 1 (el cofre) + 5 (apliques).
 * Las «53 tiles de diferencia» del informe son justo 52 + el sprite del cofre.
 *
 * Este fichero fija la mecánica SIN navegador: la ventana 11x11 de abajo está MEDIDA en vivo
 * (`activeMap.tileAt` alrededor de (15,15) de la location 13) y los esperados van EN CRUDO.
 */
import { describe, it, expect } from "vitest";
import {
  WINDOW,
  computeVisibleWindow,
  isSightBlocking,
  ALWAYS_OPAQUE,
} from "../src/core/world/visibility.js";

/** Ventana 11x11 de la choza de Iolo (loc 13) centrada en el Avatar (15,15), MEDIDA. */
const CHOZA: readonly (readonly number[])[] = [
  [0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05],
  [0x05, 0x05, 0x05, 0x4d, 0x4d, 0x4d, 0x4d, 0x4d, 0x05, 0x05, 0x05],
  [0x05, 0x05, 0x4d, 0x4d, 0xa6, 0x44, 0xbf, 0x4d, 0x4d, 0x05, 0x05],
  [0x05, 0x4d, 0x4d, 0xb1, 0x44, 0x44, 0x44, 0xb0, 0x4d, 0x4d, 0x05],
  [0x05, 0x4d, 0xab, 0xac, 0x44, 0x44, 0x44, 0x92, 0x44, 0x4d, 0x05],
  [0x05, 0x4d, 0x44, 0x44, 0x44, 0x91, 0x94, 0x95, 0x96, 0x4d, 0x05],
  [0x05, 0x4d, 0xa9, 0x44, 0x44, 0x44, 0x44, 0x44, 0x44, 0x4d, 0x05],
  [0x05, 0x4d, 0x4d, 0xb1, 0x44, 0x44, 0x44, 0xb0, 0x4d, 0x4d, 0x05],
  [0x05, 0x05, 0x4d, 0x4d, 0x44, 0x44, 0x44, 0x4d, 0x4d, 0x05, 0x05],
  [0x05, 0x05, 0x05, 0x4d, 0x4d, 0xb8, 0x4d, 0x4d, 0x05, 0x05, 0x09],
  [0x05, 0x32, 0x32, 0x32, 0x33, 0x05, 0x05, 0x33, 0x05, 0x09, 0x09],
];

/** Celda de ventana donde cae la siembra (-3,-3) del arnés: (col,row) = (2,2). */
const SIEMBRA_COL = 2;
const SIEMBRA_ROW = 2;
/** Tile del cofre que siembra el arnés (`tile: 0x40, kind: "chest"`). */
const COFRE = 0x40;
/** Luz ambiental de DÍA (survival.ts `lightLevel`, rama diurna). */
const LUZ_DIA = 0x32;

function sampler(win: readonly (readonly number[])[]) {
  // Fuera de la ventana: hierba 0x05, que es lo que rodea a la choza en el mapa real.
  return (c: number, r: number): number =>
    c < 0 || r < 0 || c >= WINDOW || r >= WINDOW ? 0x05 : win[r]![c]!;
}

function dibuja(field: Uint8Array): string[] {
  const out: string[] = [];
  for (let r = 0; r < WINDOW; r++) {
    let s = "";
    for (let c = 0; c < WINDOW; c++) s += field[r * WINDOW + c] === 1 ? "." : "#";
    out.push(s);
  }
  return out;
}

/**
 * Anillo negro que pinta el port SIN sembrar nada — y que es EL MISMO que pinta el
 * original. Transcrito de los píxeles de `base.png` (celdas 16x16 completamente
 * negras del viewport de la piel fiel, origen (8,8)), no calculado desde el sujeto.
 */
const ANILLO_NEGRO_CRUDO = [
  "###########",
  "###.....###",
  "##.......##",
  "#.........#",
  "#.........#",
  "#.........#",
  "#.........#",
  "#.........#",
  "##.......##",
  "###.....###",
  "###########",
];

describe("ficha F4 — el cofre «fuera de la choza» cae SOBRE EL MURO", () => {
  it("la celda que siembra el arnés es MURO, no exterior", () => {
    expect(CHOZA[SIEMBRA_ROW]![SIEMBRA_COL]).toBe(0x4d);
    expect(ALWAYS_OPAQUE.has(0x4d)).toBe(true);
    // radial de (2,2) respecto al centro (5,5) = 18 según DATA.OVL 0x6AB8; a esa distancia
    // el muro corta y el cofre no (no está ni en ALWAYS_OPAQUE ni en los tiles con visor).
    expect(isSightBlocking(0x4d, 18)).toBe(true);
    expect(isSightBlocking(COFRE, 18)).toBe(false);
  });

  it("sin sembrar, el exterior es NEGRO: 52 casillas ocultas, con la forma medida", () => {
    const field = computeVisibleWindow(LUZ_DIA, sampler(CHOZA));
    expect(dibuja(field)).toEqual(ANILLO_NEGRO_CRUDO);
    expect(field.reduce((n, v) => n + (v === 1 ? 0 : 1), 0)).toBe(52);
  });

  it("el cofre SOBRE EL MURO abre un agujero y de día enciende la ventana ENTERA", () => {
    const conCofre = CHOZA.map((f) => [...f]);
    conCofre[SIEMBRA_ROW]![SIEMBRA_COL] = COFRE;
    const field = computeVisibleWindow(LUZ_DIA, sampler(conCofre));
    expect(field.reduce((n, v) => n + (v === 1 ? 0 : 1), 0)).toBe(0);
  });

  /**
   * 🔴 EL ASERTO DE ARRIBA ESTÁ SATURADO, y por sí solo da confianza gratis: de día la luz
   * es 0x32 = 50 = el máximo de la tabla radial, así que «0 ocultas» es el suelo al que cae
   * CUALQUIER ventana sin muros. Medido: el mutante que saca 0x4d de ALWAYS_OPAQUE mata los
   * otros tres asertos de este fichero y a ése lo deja VERDE — pasa porque la choza se queda
   * sin muros, no porque el cofre abra nada.
   *
   * Este es su testigo NO saturado: con la luz mínima (radio 2) el agujero se nota en la
   * FORMA, no en el suelo — 52 ocultas sin cofre, 43 con él. Ahí la cifra depende de las dos
   * mitades de la mecánica a la vez (que el muro tape y que el cofre no), que es justo lo
   * que la ficha F4 afirma. Mutantes que lo matan, ambos comprobados: sacar 0x4d de
   * ALWAYS_OPAQUE (da 0) y METER 0x40 en ALWAYS_OPAQUE (da 52, sin agujero).
   */
  it("testigo NO saturado: con luz mínima el agujero cambia la FORMA (52 → 43)", () => {
    const LUZ_MINIMA = 2;
    const sinCofre = computeVisibleWindow(LUZ_MINIMA, sampler(CHOZA));
    expect(sinCofre.reduce((n, v) => n + (v === 1 ? 0 : 1), 0)).toBe(52);

    const conCofre = CHOZA.map((f) => [...f]);
    conCofre[SIEMBRA_ROW]![SIEMBRA_COL] = COFRE;
    const field = computeVisibleWindow(LUZ_MINIMA, sampler(conCofre));
    expect(field.reduce((n, v) => n + (v === 1 ? 0 : 1), 0)).toBe(43);
    // Y la cuña que se abre sale por la esquina del cofre, no por cualquier sitio.
    expect(dibuja(field)).toEqual([
      "##...######",
      "#.......###",
      ".........##",
      "..........#",
      "..........#",
      "#.........#",
      "#.........#",
      "#.........#",
      "##.......##",
      "###.....###",
      "###########",
    ]);
  });

  it("el cofre sobre un tile TRANSPARENTE (control `cofre-dentro`, +2,0) no mueve el anillo", () => {
    // (+2,0) desde el centro = (col,row) = (7,5). En la ventana medida hay mobiliario 0x95,
    // que NO corta la vista: taparlo con el cofre (tampoco opaco) deja la máscara intacta.
    expect(CHOZA[5]![7]).toBe(0x95);
    expect(isSightBlocking(0x95, 4)).toBe(false);
    const conCofre = CHOZA.map((f) => [...f]);
    conCofre[5]![7] = COFRE;
    const field = computeVisibleWindow(LUZ_DIA, sampler(conCofre));
    expect(dibuja(field)).toEqual(ANILLO_NEGRO_CRUDO);
  });
});
