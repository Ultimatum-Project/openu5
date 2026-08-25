/**
 * «INT resto» — LOS CUATRO SEGMENTOS QUE `int-loc2` DEJÓ CENSADOS SIN TOCAR.
 *
 * `re/notes/int-loc2-acta.md` §6.4 nombró cuatro segmentos con cierres y sin INT medido:
 * `ad03-g11` (Trinsic), `ad04-g08` y `ad06-g34` (Minoc), `ad12-g15` (overworld, 7 cierres).
 * Este carril los triangula con la MISMA maquinaria (`shopSellPrice` / `shopBuyPrice`, careadas
 * contra SHOPPES 0x0e76 / 0x02d8) y sale:
 *
 *   ad03-g11 → **19** (una sola vía: el Halberd de compra; el beat de venta no lleva precio)
 *   ad04-g08 → **19** (dos exactos, dos rangos que lo contienen)
 *   ad06-g34 → **20** (tres exactos, dos rangos)
 *   ad12-g15 → **22** (tres exactos, un rango) — con UNA discrepancia declarada (§4.1)
 *
 * ── ★★ LO QUE HACE FUERTE A ESTA TANDA: DOS PARES CONTROLADOS ────────────────────────────
 * El corpus regala aquí algo que `int-loc2` no tenía: la MISMA tienda vendiendo los MISMOS
 * ítems en DOS momentos distintos del run (§5). Darkwatch Armoury cotiza el Small Shield y el
 * Short Sword a **23** en `ad04` y a **25** en `ad06`; Iolo's Bows cotiza Chain Coif / 2H Axe /
 * Spiked Collar a **34·100·159** en `ad12` y a **37·109·173** en `ad21`. Tienda constante, ítem
 * constante, precio distinto: la única variable de la fórmula que puede moverse es el INT. Eso
 * cierra la vía de escape «la diferencia la pone la tienda o el ítem».
 *
 * ── POR QUÉ NO ESTÁ AJUSTADO AL RESULTADO ────────────────────────────────────────────────
 * Igual que `espejo-int-loc2.test.ts`: el PRECIO lo pone el OCR del LP en el `route.json`
 * commiteado (se LEE de ahí, no se copia), la BASE la pone la tabla del binario
 * (`equipmentBasePrices` DS 0x3a82) y el NOMBRE del ítem lo pone la tabla del propio flujo
 * (`sellOfferNames.json`, DS 0x3cce). El INT es la única incógnita y se despeja llamando a la
 * fórmula DEL PORT — careo, no tautología sobre una copia mía.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shopBuyPrice, shopSellPrice } from "../src/core/shops/shops";
import { shopTownIndex } from "../src/core/shops/shop-tables";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOUR = join(GAME, "e2e", "espejo-tour");
const readJson = <T>(...p: string[]): T => JSON.parse(readFileSync(join(...p), "utf8").replace(/^﻿/, "")) as T;

const BASES = readJson<{ equipmentBasePrices: number[]; weaponsSoldByMerchants: number[][] }>(
  GAME, "assets", "data.json",
);
const SELL_NAMES = readJson<{ names: string[] }>(GAME, "src", "core", "data", "sellOfferNames.json").names;
const LONG_NAMES = readJson<{ names: string[] }>(GAME, "src", "core", "data", "longEquipNames.json").names;

/** equipId por su nombre en la tabla que imprime el flujo de oferta del binario. */
const idPorNombreDeOferta = (n: string): number => SELL_NAMES.indexOf(n);
const base = (equipId: number): number => BASES.equipmentBasePrices[equipId]!;

interface Segmento {
  id: string;
  enter?: { loc?: number; overworld?: boolean; banner?: string };
  expect?: { text: string; ocrLn?: number }[];
  script?: Record<string, unknown>[];
}
const seg = (part: string, id: string): Segmento =>
  readJson<{ segments: Segmento[] }>(TOUR, "routes-ad", `${part}.route.json`).segments.find((s) => s.id === id)!;

/** El OCR NO respeta los límites de frase: el nombre del ítem y su precio caen con frecuencia en
 *  bloques distintos. Se lee el TRAMO commiteado [a..b] tal cual, unido por espacios. */
const tramo = (s: Segmento, a: number, b: number): string =>
  s.expect!.filter((x) => x.ocrLn! >= a && x.ocrLn! <= b).map((x) => x.text).join(" ");

/** Todos los INT de 0..40 que hacen que la fórmula DEL PORT dé el precio del LP. */
const despejar = (f: (b: number, i: number) => number, b: number, precio: number): number[] =>
  Array.from({ length: 41 }, (_, i) => i).filter((int) => f(b, int) === precio);

/** Cuántas de las 48 bases del binario admiten ALGÚN INT que dé ese precio (poder discriminante). */
const basesConSolucion = (f: (b: number, i: number) => number, precio: number): number =>
  BASES.equipmentBasePrices.filter((b) => b > 0 && despejar(f, b, precio).length > 0).length;

const AD03 = seg("ad03", "ad03-g11");
const AD04 = seg("ad04", "ad04-g08");
const AD06 = seg("ad06", "ad06-g34");
const AD12 = seg("ad12", "ad12-g15");
const AD21 = seg("ad21", "ad21-g14"); // el ancla ya medida (INT 24), usada como par controlado y control negativo

/** Una fila del despeje: el tramo del OCR donde vive, el nombre que imprime el binario, el precio
 *  y el INT que la fórmula del PORT admite. `bases` = poder discriminante declarado. */
interface Fila {
  a: number; b: number; item: string; precio: number; int: number[]; bases: number;
}
const filaOk = (s: Segmento, f: (b: number, i: number) => number) => (r: Fila): void => {
  const t = tramo(s, r.a, r.b);
  // el NOMBRE lo pone el binario; que el OCR lo traiga es lo que ata el ítem
  expect(idPorNombreDeOferta(r.item)).toBeGreaterThanOrEqual(0);
  expect(t).toContain(r.item); // la plantilla puede pluralizarlo («Clubs», «Two-Handed Axes»)
  expect(t).toMatch(new RegExp(`\\b${r.precio}\\b`)); // el PRECIO se LEE del route.json
  expect(despejar(f, base(idPorNombreDeOferta(r.item)), r.precio)).toEqual(r.int);
  expect(basesConSolucion(f, r.precio)).toBe(r.bases);
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §0 — LAS CUATRO TIENDAS: cómo se identifica cada una, y qué NO depende de eso
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe("§0 — identificación de la tienda de cada segmento", () => {
  it("ad03-g11: la costura declara TRINSIC (loc 6), y el ancla del guion dice Blacksmith", () => {
    expect(AD03.enter).toMatchObject({ loc: 6, banner: "TRINSIC" });
    const anclas = AD03.script!.filter((o) => "anchor" in o).map((o) => (o.anchor as { match: string }).match);
    expect(anclas).toContain("shop:Blacksmith");
    expect(tramo(AD03, 2226, 2232)).toContain("The Paladin's Protectorate");
  });

  /**
   * ★ Y el BINARIO lo corrobora sin depender de la costura: la fila de stock del herrero de
   * loc 6 es, EN ORDEN, el menú `a...g` que el OCR transcribe. (Método de Bordermarch,
   * `int-loc2-acta.md` §3.3.)
   */
  it("★ ad03-g11: la FILA DE STOCK del binario para loc 6 casa verbatim el menú a...g del OCR", () => {
    const fila = BASES.weaponsSoldByMerchants[shopTownIndex("Blacksmith", 6)]!
      .filter((id) => id !== 0xff).map((id) => LONG_NAMES[id]!);
    expect(fila).toEqual(["2H Axe", "2H Sword", "Halberd", "Iron Helm", "Large Shield", "Scale Mail", "Plate Mail"]);
    const menu = tramo(AD03, 2266, 2272);
    for (const t of ["a...2H Axe", "b...2H Sword", "c...Halberd", "d...Iron Helm",
                     "e...Large Shiel", "f...Scale Mail", "g...Plate Mail"]) expect(menu).toContain(t);
  });

  it("ad04-g08 y ad06-g34 son la MISMA tienda: Darkwatch Armoury (Shenstone), MINOC loc 5", () => {
    expect(AD04.enter).toMatchObject({ loc: 5, banner: "MINOC" });
    expect(AD06.enter).toMatchObject({ loc: 5, banner: "MINOC" });
    expect(tramo(AD04, 950, 956)).toContain("Darkwatch Armoury");
    expect(tramo(AD06, 5089, 5095)).toContain("Darkwatch Armoury");
    for (const s of [AD04, AD06])
      expect(s.script!.filter((o) => "anchor" in o).map((o) => (o.anchor as { match: string }).match))
        .toContain("shop:Blacksmith");
  });

  it("ad12-g15 NO declara ciudad (overworld), pero el OCR imprime la tienda y el NPC: Iolo's Bows / Gwenneth", () => {
    expect(AD12.enter?.overworld).toBe(true);
    expect(AD12.enter?.loc).toBeUndefined();
    expect(tramo(AD12, 1609, 1621)).toContain("Iolo's Bows");
    expect(tramo(AD12, 1609, 1621)).toContain("Gwenneth");
    // …la misma tienda y el mismo NPC que `ad21-g14`, que sí declara loc 2 (Britain).
    expect(AD21.enter?.loc).toBe(2);
    expect(tramo(AD21, 3952, 3958)).toContain("Iolo's Bows");
  });

  /**
   * ★★ Y SE DECLARA EL ALCANCE: ninguna de las dos fórmulas de regateo mira la ciudad.
   * `shopSellPrice`/`shopBuyPrice` toman (base, INT) y nada más — la base sale de
   * `equipmentBasePrices`, que es GLOBAL, no por-ciudad. Así que identificar la tienda es
   * corroboración de que el LP está en ese flujo, NO un eslabón del despeje: aunque la ciudad
   * de `ad12-g15` fuese otra, su INT no cambiaría. (Lo que sí es eslabón es el NOMBRE del ítem.)
   */
  it("★★ el despeje NO depende de la ciudad: las fórmulas sólo miran (base, INT)", () => {
    expect(shopSellPrice.length).toBe(2);
    expect(shopBuyPrice.length).toBe(2);
    // misma base + mismo INT ⇒ mismo precio, se mire la ciudad que se mire
    expect(shopSellPrice(240, 22)).toBe(shopSellPrice(240, 22));
    expect(shopSellPrice(base(idPorNombreDeOferta("Spiked Collar")), 22)).toBe(159);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §1 — ad03-g11 (Trinsic): INT 19, pero por UNA SOLA VÍA — y se dice por qué
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * `compra = base + ⌊base·(100 − 3·INT)/100⌋` (SHOPPES 0x02d8). El único beat con precio legible
 * del segmento es el Halberd de la oferta de COMPRA. El de VENTA (un Club) sale del OCR SIN
 * número: no participa.
 */
describe("§1 — ad03-g11 (Trinsic, loc 6): el Halberd de compra despeja INT 19", () => {
  const HALBERD: Fila = { a: 2290, b: 2296, item: "Halberd", precio: 357, int: [19], bases: 4 };

  it("ln2290-2296 — Halberd a 357 existe en el corpus commiteado y despeja [19]", () => {
    filaOk(AD03, shopBuyPrice)(HALBERD);
  });

  /**
   * ★ El poder discriminante bruto es 4/48 — pero de esas cuatro bases sólo UNA está en la fila
   * de stock de loc 6, y además dos de las cuatro (Halberd y Silver Sword, ambas base 250) dan el
   * MISMO INT: el despeje es robusto incluso a confundirlas.
   */
  it("★ de las 4 bases que admiten 357, sólo el Halberd está en la fila de loc 6 — y dos de ellas dan el mismo 19", () => {
    const fila6 = BASES.weaponsSoldByMerchants[shopTownIndex("Blacksmith", 6)]!.filter((i) => i !== 0xff);
    const candidatas = BASES.equipmentBasePrices
      .map((b, i) => ({ i, b, int: despejar(shopBuyPrice, b, 357) }))
      .filter((r) => r.b > 0 && r.int.length > 0);
    expect(candidatas).toHaveLength(4);
    expect(candidatas.filter((r) => fila6.includes(r.i)).map((r) => LONG_NAMES[r.i])).toEqual(["Halberd"]);
    // Halberd (250) y Silver Sword (250) comparten base ⇒ comparten despeje.
    expect(candidatas.filter((r) => r.b === 250).map((r) => r.int)).toEqual([[19], [19]]);
  });

  /**
   * 🔴 EL LÍMITE, DECLARADO: el otro beat del segmento (la venta de un Club) NO tiene precio en
   * el OCR — la frase llega literalmente como «I can offer ye ___ gold for it». Un solo beat
   * significa que `ad03` NO tiene cruce INTERNO: nada dentro del segmento lo confirma.
   */
  it("🔴 el beat de VENTA del segmento no lleva precio: «I can offer ye gold for it» (por eso ad03 va con UNA sola vía)", () => {
    const t = tramo(AD03, 2232, 2238);
    expect(t).toContain("Clubs");
    expect(t).toContain("I can offer ye gold for it");   // sin número entre «ye» y «gold»
    expect(t).not.toMatch(/offer ye \d+ gold/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §2 — ad04-g08 (Minoc, Darkwatch Armoury): INT 19, dos exactos
// ═══════════════════════════════════════════════════════════════════════════════════════════
/** `venta = ⌊3·INT·base/100⌋ + 1` (SHOPPES 0x0e76). */
const VENTAS_AD04: Fila[] = [
  { a:  962, b:  968, item: "Leather Helm", precio:  9, int: [18, 19], bases: 11 },
  { a:  974, b:  986, item: "Small Shield", precio: 23, int: [19], bases: 14 },
  { a: 1010, b: 1016, item: "Club", precio: 3, int: [14, 15, 16, 17, 18, 19], bases: 16 },
  { a: 1028, b: 1034, item: "Short Sword", precio: 23, int: [19], bases: 14 },
];

describe("§2 — ad04-g08: INT 19", () => {
  it.each(VENTAS_AD04)("ln$a-$b — $item a $precio → INT $int (bases/48 = $bases)", (r) => {
    filaOk(AD04, shopSellPrice)(r);
  });

  it("★ DOS exactos, los dos 19, y los dos rangos lo CONTIENEN — cero contradicciones", () => {
    const exactos = VENTAS_AD04.filter((r) => r.int.length === 1).map((r) => r.int[0]!);
    expect(exactos).toEqual([19, 19]);
    for (const r of VENTAS_AD04.filter((x) => x.int.length > 1)) expect(r.int).toContain(19);
  });

  /** ★ El Club es el caso extremo de lo que `int-loc2-acta.md` §5 declaró: un precio de 3 admite
   *  SEIS INT distintos y 16 bases. No se llama exacto ni se usa para nada más que no contradecir. */
  it("★ y se declara: el Club (3 gp) admite SEIS INT — un beat barato no ancla nada por sí solo", () => {
    expect(VENTAS_AD04.find((r) => r.item === "Club")!.int).toHaveLength(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §3 — ad06-g34 (Minoc, LA MISMA tienda, más tarde): INT 20, tres exactos
// ═══════════════════════════════════════════════════════════════════════════════════════════
const VENTAS_AD06: Fila[] = [
  { a: 5101, b: 5107, item: "Small Shield", precio: 25, int: [20], bases: 11 },
  { a: 5113, b: 5119, item: "Cloth suit", precio: 13, int: [20, 21], bases: 18 },
  { a: 5131, b: 5137, item: "Main Gauche", precio: 10, int: [20, 21, 22], bases: 19 },
  { a: 5179, b: 5185, item: "Short Sword", precio: 25, int: [20], bases: 11 },
  { a: 5204, b: 5210, item: "Crossbow", precio: 91, int: [20], bases: 15 },
];

describe("§3 — ad06-g34: INT 20", () => {
  it.each(VENTAS_AD06)("ln$a-$b — $item a $precio → INT $int (bases/48 = $bases)", (r) => {
    filaOk(AD06, shopSellPrice)(r);
  });

  it("★ TRES exactos, los tres 20, y los dos rangos lo CONTIENEN", () => {
    const exactos = VENTAS_AD06.filter((r) => r.int.length === 1).map((r) => r.int[0]!);
    expect(exactos).toEqual([20, 20, 20]);
    for (const r of VENTAS_AD06.filter((x) => x.int.length > 1)) expect(r.int).toContain(20);
  });

  /**
   * ★ CORROBORACIÓN, no evidencia: dos beats más del segmento salieron ilegibles (el Throwing Axe
   * y la Mace: «can give thee ___», «will pay thee ___»). A INT 20 el port los cotiza a 2 y 31.
   * No participan en el despeje; se anotan para que quede dicho POR QUÉ no participan.
   */
  it("★ los dos beats ILEGIBLES del segmento no participan (a INT 20 el port cotizaría 2 y 31)", () => {
    expect(tramo(AD06, 5149, 5161)).toContain("Throwing Axe");
    expect(tramo(AD06, 5149, 5161)).not.toMatch(/give thee \d+/);
    expect(tramo(AD06, 5197, 5204)).toContain("Mace");
    expect(tramo(AD06, 5197, 5204)).not.toMatch(/pay thee \d+/);
    expect(shopSellPrice(base(idPorNombreDeOferta("Throwing Axe")), 20)).toBe(2);
    expect(shopSellPrice(base(idPorNombreDeOferta("Mace")), 20)).toBe(31);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §4 — ad12-g15 (Iolo's Bows): INT 22, tres exactos — y UNA discrepancia
// ═══════════════════════════════════════════════════════════════════════════════════════════
const VENTAS_AD12: Fila[] = [
  { a: 1633, b: 1639, item: "Leather Helm", precio: 10, int: [20, 21, 22], bases: 19 },
  { a: 1669, b: 1675, item: "Chain Coif", precio: 34, int: [22], bases: 10 },
  { a: 1729, b: 1735, item: "Two-Handed Axe", precio: 100, int: [22], bases: 7 },
  { a: 1783, b: 1789, item: "Spiked Collar", precio: 159, int: [22], bases: 1 },
];

describe("§4 — ad12-g15: INT 22", () => {
  it.each(VENTAS_AD12)("ln$a-$b — $item a $precio → INT $int (bases/48 = $bases)", (r) => {
    filaOk(AD12, shopSellPrice)(r);
  });

  it("★ TRES exactos, los tres 22, y el rango lo CONTIENE", () => {
    const exactos = VENTAS_AD12.filter((r) => r.int.length === 1).map((r) => r.int[0]!);
    expect(exactos).toEqual([22, 22, 22]);
    for (const r of VENTAS_AD12.filter((x) => x.int.length > 1)) expect(r.int).toContain(22);
  });

  /** ★ El Spiked Collar a 159 es el beat MÁS fuerte de las cuatro segmentos: aísla UNA sola base
   *  de las 48. Es el contrapunto del Club de §2 y mide el rango real del método. */
  it("★ el Spiked Collar (159) aísla UNA sola base de las 48 — el beat más discriminante de la tanda", () => {
    expect(basesConSolucion(shopSellPrice, 159)).toBe(1);
    expect(basesConSolucion(shopSellPrice, 3)).toBe(16); // …y el Club de ad04, dieciséis
  });

  /**
   * 🔴🔴 §4.1 — LA DISCREPANCIA, DECLARADA Y NO RE-ETIQUETADA.
   *
   * El quinto beat del segmento —«ye more than 16 gp for that battle-worn Silver Sword»— NO
   * encaja: leído al pie de la letra exige **INT 2**, que contradice los tres exactos del MISMO
   * segmento, la MISMA tienda y la MISMA visita. A INT 22 el port cotiza el Silver Sword a
   * **166**, que es el `16` del OCR con un dígito más.
   *
   * ★★ Y es MÁS peligroso que un garabato, no menos: `2V5` (el caso de `int-loc2` §3.3) se
   * delata solo porque no es un número; `16` se lee como un entero perfectamente válido y se
   * colaría en cualquier despeje automático. Por eso el beat NO participa: queda EXCLUIDO con su
   * motivo, y no se re-etiqueta como «166» para que cuadre. Lo que se afirma es lo medido: el
   * segmento ancla en 22 por otras tres vías, y esta fila no la explica ningún INT compatible.
   */
  it("🔴🔴 DISCREPANCIA: el Silver Sword «16» exige INT 2 — no participa, y se dice por qué", () => {
    const t = tramo(AD12, 1753, 1759);
    expect(t).toContain("Silver Sword");
    expect(t).toMatch(/ye more than 16 gp/);
    // leído tal cual: un solo INT, y es absurdo
    expect(despejar(shopSellPrice, base(idPorNombreDeOferta("Silver Sword")), 16)).toEqual([2]);
    // …y ese 2 contradice los tres exactos del propio segmento
    for (const r of VENTAS_AD12.filter((x) => x.int.length === 1))
      expect(shopSellPrice(base(idPorNombreDeOferta(r.item)), 2)).not.toBe(r.precio);
    // a INT 22 el port cotiza 166 — el `16` con un dígito más. Se ANOTA; no se sustituye.
    expect(shopSellPrice(base(idPorNombreDeOferta("Silver Sword")), 22)).toBe(166);
    // ★★ y por qué es peligroso: `16` NO se delata (16 bases lo admiten), a diferencia de un garabato
    expect(basesConSolucion(shopSellPrice, 16)).toBeGreaterThan(10);
  });

  /** ★ El sexto beat sí es un garabato clásico (`q7`), y a INT 22 el 2H Hammer vale 57.
   *  Corroboración, no evidencia — el mismo trato que `2V5` en `int-loc2-acta.md` §3.3. */
  it("★ el garabato `q7` del 2H Hammer se explica: a INT 22 el port cotiza 57 (corroboración)", () => {
    const t = tramo(AD12, 1705, 1711);
    expect(t).toContain("Two-Handed Hammer");
    expect(t).toContain('q7');
    expect(shopSellPrice(base(idPorNombreDeOferta("Two-Handed Hammer")), 22)).toBe(57);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §5 — ★★ LOS DOS PARES CONTROLADOS: misma tienda, mismo ítem, dos visitas
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * Esto es lo que `int-loc2` no podía hacer y aquí sale gratis del corpus. En un despeje normal
 * la objeción viva es «el precio cambia porque cambia la tienda o el ítem». Aquí la tienda y el
 * ítem están FIJOS y el precio cambia igual: la única variable que queda en la fórmula es el INT.
 */
describe("§5 — ★★ PARES CONTROLADOS: la tienda y el ítem son constantes; el precio no", () => {
  it("★★ Darkwatch Armoury (Minoc): Small Shield y Short Sword pasan de 23 (ad04) a 25 (ad06) — INT 19 → 20", () => {
    for (const item of ["Small Shield", "Short Sword"]) {
      const b = base(idPorNombreDeOferta(item));
      expect(shopSellPrice(b, 19)).toBe(23);
      expect(shopSellPrice(b, 20)).toBe(25);
    }
    // …y los precios los pone el corpus, no yo:
    expect(tramo(AD04, 974, 986)).toMatch(/\b23\b/);
    expect(tramo(AD04, 1028, 1034)).toMatch(/\b23\b/);
    expect(tramo(AD06, 5101, 5107)).toMatch(/\b25\b/);
    expect(tramo(AD06, 5179, 5185)).toMatch(/\b25\b/);
  });

  /**
   * ★★ El segundo par es aún más fuerte: TRES ítems a la vez, en la misma tienda (Iolo's Bows,
   * Gwenneth), contra el ancla ya medida de `ad21-g14` (INT 24, `int-loc2-acta.md` §3.2).
   */
  it("★★ Iolo's Bows: Chain Coif / 2H Axe / Spiked Collar pasan de 34·100·159 (ad12) a 37·109·173 (ad21) — INT 22 → 24", () => {
    const esperado: [string, number, number][] = [
      ["Chain Coif", 34, 37], ["Two-Handed Axe", 100, 109], ["Spiked Collar", 159, 173],
    ];
    for (const [item, enAd12, enAd21] of esperado) {
      const b = base(idPorNombreDeOferta(item));
      expect(shopSellPrice(b, 22)).toBe(enAd12);
      expect(shopSellPrice(b, 24)).toBe(enAd21);
    }
    // los seis precios salen del corpus commiteado, de dos partes distintas
    for (const [a, b, p] of [[1669, 1675, 34], [1729, 1735, 100], [1783, 1789, 159]] as [number, number, number][])
      expect(tramo(AD12, a, b)).toMatch(new RegExp(`\\b${p}\\b`));
    for (const [ln, p] of [[4364, 37], [4033, 109], [4015, 173]] as [number, number][])
      expect(AD21.expect!.find((x) => x.ocrLn === ln)!.text).toMatch(new RegExp(`\\b${p}\\b`));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §6 — CONTROLES NEGATIVOS
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe("§6 — CONTROL NEGATIVO: ningún INT vecino explica los precios de otro segmento", () => {
  const TODOS: { seg: string; int: number; filas: Fila[] }[] = [
    { seg: "ad04-g08", int: 19, filas: VENTAS_AD04 },
    { seg: "ad06-g34", int: 20, filas: VENTAS_AD06 },
    { seg: "ad12-g15", int: 22, filas: VENTAS_AD12 },
  ];

  /** El control fuerte: sobre las filas EXACTAS (las que aíslan un solo INT), ningún otro INT
   *  medido del corpus —17, 19, 20, 21, 22, 24— reproduce el precio. */
  it.each(TODOS)("★★ $seg: ningún INT vecino (17/19/20/21/22/24) explica sus filas exactas salvo el suyo", (g) => {
    for (const r of g.filas.filter((x) => x.int.length === 1)) {
      const b = base(idPorNombreDeOferta(r.item));
      for (const int of [17, 19, 20, 21, 22, 24])
        if (int !== g.int) expect(shopSellPrice(b, int)).not.toBe(r.precio);
      expect(shopSellPrice(b, g.int)).toBe(r.precio);
    }
  });

  it("★★ y el Halberd de ad03 (COMPRA) tampoco lo explica ningún vecino: sólo 19", () => {
    const b = base(idPorNombreDeOferta("Halberd"));
    for (const int of [17, 20, 21, 22, 24]) expect(shopBuyPrice(b, int)).not.toBe(357);
    expect(shopBuyPrice(b, 19)).toBe(357);
  });

  /**
   * ★ El poder discriminante NO es uniforme y contarlo entero sería vender humo. Se mide la
   * distribución completa de la tanda: va de 1/48 (Spiked Collar 159) a 19/48 (Main Gauche 10).
   * Lo que ata el ítem barato no es su precio: es el NOMBRE que imprime el binario.
   */
  it("★ la distribución del poder discriminante de la tanda, medida: de 1/48 a 19/48", () => {
    const todas = [...VENTAS_AD04, ...VENTAS_AD06, ...VENTAS_AD12];
    const medido = todas.map((r) => basesConSolucion(shopSellPrice, r.precio));
    expect(Math.min(...medido)).toBe(1);
    expect(Math.max(...medido)).toBe(19);
    // …y las filas EXACTAS no son las más discriminantes por definición: se comprueba que hay
    // exactas con poder bajo (Crossbow 91 → 15/48), o sea que «exacto» ≠ «aísla la base».
    expect(basesConSolucion(shopSellPrice, 91)).toBe(15);
    expect(despejar(shopSellPrice, base(idPorNombreDeOferta("Crossbow")), 91)).toEqual([20]);
  });

  /** ★★ Control con la OTRA tabla del binario: `sellOfferNames` trae formas que NO existen en
   *  `longEquipNames` («Two-Handed Axe» vs «2H Axe»). Que el OCR traiga ESA forma es prueba de
   *  que el LP está en el flujo de oferta y de que el ítem está bien identificado. */
  it("★★ los nombres son los del flujo de OFERTA, no los del menú: «Two-Handed Axe» no existe en longEquipNames", () => {
    expect(SELL_NAMES).toContain("Two-Handed Axe");
    expect(LONG_NAMES).not.toContain("Two-Handed Axe");
    expect(LONG_NAMES).toContain("2H Axe");
    expect(tramo(AD12, 1729, 1735)).toContain("Two-Handed Axes"); // el plural lo pone la plantilla
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §7 — LA SERIE RESULTANTE: ocho puntos, NO DECRECIENTE (ya no estrictamente creciente)
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe("§7 — la serie de INT por parte, con los cuatro puntos nuevos", () => {
  const SERIE: [string, number][] = [
    ["ad01", 17], ["ad03", 19], ["ad04", 19], ["ad06", 20],
    ["ad08", 20], ["ad09", 21], ["ad12", 22], ["ad21", 24],
  ];

  it("★ sigue siendo MONÓTONA: ningún punto nuevo baja respecto al anterior", () => {
    const v = SERIE.map(([, i]) => i);
    expect(v).toEqual([...v].sort((a, z) => a - z));
  });

  /**
   * ★★ PERO SE REFINA EL ENUNCIADO, y esto es un hallazgo: `int-loc2-acta.md` §3.3 la llamó
   * «monótona CRECIENTE» sobre cuatro puntos, donde todos los saltos eran estrictos. Con ocho
   * puntos ya NO lo es: `ad03`=`ad04`=19 y `ad06`=`ad08`=20 son EMPATES. Quien hubiera fijado
   * «estrictamente creciente» como invariante estaría hoy en rojo — y con razón, porque el INT
   * no sube en cada parte. [[no-fijes-una-coincidencia-como-invariante]]
   */
  it("★★ y ya NO es estrictamente creciente: hay DOS empates (ad03=ad04=19, ad06=ad08=20)", () => {
    const v = SERIE.map(([, i]) => i);
    const empates = v.map((x, i) => (i > 0 && x === v[i - 1] ? SERIE[i]![0] : null)).filter(Boolean);
    expect(empates).toEqual(["ad04", "ad08"]);
    expect(new Set(v).size).toBeLessThan(v.length); // no todos distintos: la afirmación fuerte era falsa
  });

  /** ★ `ad06`=20 es una CONFIRMACIÓN independiente del 20 de `ad08`: otra parte, otra ciudad
   *  (Minoc vs la de `espejo-diener-int.md`) y la fórmula de VENTA en vez de la de compra. */
  it("★ ad06=20 confirma el 20 de ad08 por otra parte, otra ciudad y la OTRA fórmula", () => {
    expect(shopSellPrice(base(idPorNombreDeOferta("Crossbow")), 20)).toBe(91);
    expect(tramo(AD06, 5204, 5210)).toMatch(/\b91\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §8 — ★★ LA GUARDA: los CATORCE cierres son beats `todo`. Medir el INT no desbloquea nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * Exactamente el mismo modo de fallo que `int-loc2-acta.md` §4: el guion no lleva las teclas de
 * la transacción, así que el port no puede comprar ni vender nada ahí. Poblar hoy un
 * `expectDelta` en cualquiera de los cuatro daría un CERO VACÍO.
 *
 * ⚠ Si este bloque se pone ROJO es BUENA noticia: significa que alguien cableó las teclas. Lee
 * `re/notes/int-resto-acta.md` §6, actualiza el conteo y ENTONCES puebla el delta.
 */
describe("§8 — ★★ GUARDA: los 14 cierres de los cuatro segmentos son `todo`, sin una sola tecla", () => {
  const CLOSE = /Sold!|"Done!"\s*says/;
  const CASOS: [string, Segmento, number[]][] = [
    ["ad03-g11", AD03, [2244]],
    ["ad04-g08", AD04, [992]],
    ["ad06-g34", AD06, [5113, 5143, 5173, 5191, 5216]],
    ["ad12-g15", AD12, [1627, 1645, 1663, 1687, 1711, 1735, 1753]],
  ];

  it.each(CASOS)("%s — los cierres son exactamente esas líneas (criterio SELLADO de f3b §2)", (_n, s, lns) => {
    expect(s.expect!.filter((b) => CLOSE.test(b.text)).map((b) => b.ocrLn!)).toEqual(lns);
  });

  it.each(CASOS)("%s — ★★ ninguno tiene tecla: todos son `todo`", (_n, s, lns) => {
    expect(s.script!.filter((o) => "key" in o && lns.includes(o.ocrLn as number))).toEqual([]);
    expect(s.script!.filter((o) => "todo" in o && lns.includes(o.ocrLn as number))).toHaveLength(lns.length);
  });

  it("★ y los 14 juntos: catorce cierres, cero teclas", () => {
    expect(CASOS.reduce((n, [, , lns]) => n + lns.length, 0)).toBe(14);
  });

  /**
   * ★★ `ad12-g15` es el caso extremo: en TODO el tramo de tienda (1609-1795) el guion no tiene
   * ni una tecla ni un ancla — el port ni siquiera habla con Gwenneth. Los 7 cierres, la mayor
   * concentración después de `ad21-g14`, están fuera de alcance por completo.
   */
  it("★★ ad12-g15 ni siquiera abre la tienda: cero teclas y cero anclas en todo el tramo 1609-1795", () => {
    const enTramo = (o: Record<string, unknown>) => (o.ocrLn as number) >= 1609 && (o.ocrLn as number) <= 1795;
    expect(AD12.script!.filter((o) => "key" in o && enTramo(o))).toEqual([]);
    expect(AD12.script!.filter((o) => "anchor" in o)).toEqual([]);
    expect(AD12.script!.filter((o) => "todo" in o && enTramo(o)).length).toBeGreaterThan(30);
  });

  /** ★ En los otros tres el guion sí abre la tienda (Talk + dirección), pero ahí se acaba: no hay
   *  ni una tecla de transacción (`y`/`n`/letra de ítem) en ninguno de los tres tramos. */
  it("★ en ad03/ad04/ad06 las únicas teclas del tramo de tienda son las de Talk", () => {
    const soloTalk: [Segmento, number, number, string[]][] = [
      [AD03, 2226, 2330, ["t", "ArrowUp", "t", "ArrowUp"]],
      [AD04, 950, 1050, ["t", "ArrowUp"]],
      [AD06, 5089, 5225, ["t", "ArrowRight"]],
    ];
    for (const [s, a, b, esperado] of soloTalk)
      expect(s.script!.filter((o) => "key" in o && (o.ocrLn as number) >= a && (o.ocrLn as number) <= b)
        .map((o) => o.key)).toEqual(esperado);
  });
});
