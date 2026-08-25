/**
 * «INT loc 2» — LA TARJETA NOMBRA LA INCÓGNITA EQUIVOCADA.
 *
 * La ficha de la cola post-goal dice que «INT loc 2» *desbloquea los 8 closes de `ad21-g14` +
 * `ad09-g04`». Sale que:
 *
 *  1. `ad09-g04` **NO es loc 2**: su costura declara `overworld`, y la tienda es la de
 *     **Bordermarch (loc 26)** — identificada por la FILA DE STOCK DEL BINARIO, que casa
 *     verbatim con el menú `a...g` del OCR. Son DOS mediciones, no una.
 *  2. Para `ad21-g14` **no faltaba ningún INT**: es la parte `ad21`, cuyo INT ya lo midió
 *     `espejo-diener-int.md` en **24** (gemas de `ad21-g26`). Lo que faltaba era aplicar la
 *     fórmula de **VENTA** (SHOPPES 0x0e76 §0.2), que nadie había usado para triangular. Aquí
 *     se re-confirma el 24 por SEIS vías nuevas e independientes de aquélla.
 *  3. `ad09` (Bordermarch) sí es un ancla NUEVA: **INT 21**, cinco exactos. Encaja monótona
 *     entre el 20 de `ad08` y el 24 de `ad21`.
 *  4. ★★ Y medir el INT **no desbloquea ni un cierre**: los 8 de `ad21-g14` y el 1 de
 *     `ad09-g04` son beats `todo` — el guion NO lleva las teclas de la transacción. Es el mismo
 *     modo de fallo que `espejo-final-f3b-acta.md` §4.1 nombró cuatro veces (cero VACÍO).
 *     El último `describe` lo hace MECÁNICO para que no se vuelva a afirmar de palabra.
 *     ⚠ CADUCADO A MEDIAS por `re/notes/teclas-ad09-acta.md`: `ad09-g04` YA lleva sus 14 teclas
 *     (cableadas por overlay) y el §4 de aquí cambió de polaridad para ese segmento. `ad21-g14`
 *     sigue exactamente como estaba. Y cablearlas destapó que el INT tampoco era el segundo
 *     cuello de botella de `ad09-g04`: lo es la COSTURA `overworld` (ver el acta).
 *
 * ── POR QUÉ NO ESTÁ AJUSTADO AL RESULTADO ────────────────────────────────────────────────
 * Igual que en `espejo-diener-int.test.ts`: el PRECIO lo pone el OCR del LP en el `route.json`
 * commiteado, la BASE la pone la tabla del binario (`equipmentBasePrices` DS 0x3a82 /
 * `RATION_BASE` DS 0x4C54), y el nombre del ítem lo pone la tabla de nombres del propio flujo
 * de venta (`sellOfferNames.json`, DS 0x3cce). El INT es la única incógnita y se DESPEJA
 * llamando a la fórmula DEL PORT — careo, no tautología sobre una copia mía.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shopBuyPrice, shopSellPrice } from "../src/core/shops/shops";
import { RATION_BASE, shopTownIndex } from "../src/core/shops/shop-tables";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOUR = join(GAME, "e2e", "espejo-tour");
const readJson = <T>(...p: string[]): T => JSON.parse(readFileSync(join(...p), "utf8").replace(/^﻿/, "")) as T;

const BASES = readJson<{ equipmentBasePrices: number[]; weaponsSoldByMerchants: number[][] }>(
  GAME, "assets", "data.json",
);
const SELL_NAMES = readJson<{ names: string[] }>(GAME, "src", "core", "data", "sellOfferNames.json").names;
const LONG_NAMES = readJson<{ names: string[] }>(GAME, "src", "core", "data", "longEquipNames.json").names;

/** equipId por su nombre en la tabla de OFERTA DE VENTA del binario (la que imprime 0x0eda). */
const idPorNombreDeOferta = (n: string): number => SELL_NAMES.indexOf(n);
const base = (equipId: number): number => BASES.equipmentBasePrices[equipId]!;

interface Segmento {
  id: string;
  enter?: { loc?: number; overworld?: boolean };
  expect?: { text: string; ocrLn?: number }[];
  script?: Record<string, unknown>[];
}
const seg = (part: string, id: string): Segmento =>
  readJson<{ segments: Segmento[] }>(TOUR, "routes-ad", `${part}.route.json`).segments.find((s) => s.id === id)!;

/** El bloque de OCR en esa línea, tal cual está commiteado. */
const bloque = (s: Segmento, ocrLn: number): string => s.expect!.find((b) => b.ocrLn === ocrLn)!.text;

/** Todos los INT de 0..40 que hacen que la fórmula DEL PORT dé el precio del LP. */
const despejar = (f: (b: number, i: number) => number, b: number, precio: number): number[] =>
  Array.from({ length: 41 }, (_, i) => i).filter((int) => f(b, int) === precio);

const AD21 = seg("ad21", "ad21-g14");
const AD09 = seg("ad09", "ad09-g04");

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §0 — LA CORRECCIÓN DE LA FICHA: dos segmentos, dos ciudades, dos INT
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe("§0 — la ficha dice «INT loc 2» para los DOS, y son ciudades distintas", () => {
  it("`ad21-g14` sí declara loc 2 (Britain) en su costura", () => {
    expect(AD21.enter?.loc).toBe(2);
  });

  it("★ `ad09-g04` NO declara loc 2: su costura es `overworld`, sin location ninguna", () => {
    expect(AD09.enter?.overworld).toBe(true);
    expect(AD09.enter?.loc).toBeUndefined();
  });

  /**
   * ★★ El ancla que SÍ fija la ciudad de `ad09-g04` no es la costura: es el BINARIO. La fila de
   * stock del herrero de Bordermarch (loc 26) es, en ORDEN, el menú `a...g` que el OCR
   * transcribe. Ninguna otra fila de las 9 del herrero lo es.
   */
  it("★★ la tienda de `ad09-g04` es la de loc 26 (Bordermarch): la FILA DE STOCK del binario casa el menú a...g", () => {
    const fila = BASES.weaponsSoldByMerchants[shopTownIndex("Blacksmith", 26)]!
      .filter((id) => id !== 0xff)
      .map((id) => LONG_NAMES[id]!);
    expect(fila).toEqual([
      "Magic Shield", "2H Axe", "Magic Bow", "Arrows", "2H Hammer",
      "Ring of Regeneration", "Amulet/Turning",
    ]);
    // …y el OCR del LP lista exactamente esos siete, en ese orden (226 + 232).
    const menu = bloque(AD09, 226) + " " + bloque(AD09, 232);
    for (const t of ["Magic Shiel", "2H'Axe", "Magic Bow", "d...Arrows", "2H Hammer", "Regen Ring", "Am/Turning"])
      expect(menu).toContain(t);
    // El propio guion entra al torreón por su nombre.
    expect(AD09.expect!.find((b) => b.ocrLn === 164)!.text).toMatch(/RDERMARCH/);
  });

  it("y loc 2 es un herrero DISTINTO — el de arcos, que es lo que el OCR llama «Iolo's Bows»", () => {
    const fila = BASES.weaponsSoldByMerchants[shopTownIndex("Blacksmith", 2)]!
      .filter((id) => id !== 0xff)
      .map((id) => LONG_NAMES[id]!);
    expect(fila).toEqual(["Dagger", "Sling", "Bow", "Arrows", "Crossbow", "Quarrels", "Magic Bow"]);
    expect(bloque(AD21, 3952)).toContain("Iolo's Bows");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §1 — ad21-g14 (loc 2): el INT sale 24 por el lado de VENTA — SEIS vías
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * `venta = ⌊3·INT·base/100⌋ + 1` — SHOPPES.OVL 0x0eac-0x0ed6 (`mul [si+0x3a82]` con
 * `[bx+0x55b6]`=INT, ×3 por `shl/adc`, `__ldiv` 0x6110 /100, `inc ax`). El adjetivo
 * («obsolete», «battle-worn»…) sale de un `rand(0,7)` que ocurre en 0x0eec, **después** de
 * que el precio ya está en `g_shop_accum` (0x0ed7): no puede tocarlo. Y el corpus lo enseña:
 * el mismo Leather Helm se vende CUATRO veces a 11 con cuatro adjetivos distintos.
 */
const VENTAS: { ocrLn: number; item: string; precio: number; int: number[] }[] = [
  { ocrLn: 3990, item: "Magic Bow", precio: 577, int: [24] },
  { ocrLn: 4008, item: "Invisibility Ring", precio: 325, int: [24] }, // oferta RECHAZADA — triangula igual
  { ocrLn: 4015, item: "Spiked Collar", precio: 173, int: [24] },
  { ocrLn: 4033, item: "Two-Handed Axe", precio: 109, int: [24] },
  { ocrLn: 4364, item: "Chain Coif", precio: 37, int: [24] },
  { ocrLn: 4046, item: "Leather Helm", precio: 11, int: [23, 24] },
];

describe("§1 — ad21-g14: el INT que despeja cada VENTA (fórmula del PORT contra precio del LP)", () => {
  it.each(VENTAS)("ln$ocrLn — $item a $precio existe en el corpus commiteado", (b) => {
    expect(bloque(AD21, b.ocrLn)).toMatch(new RegExp(`\\b${b.precio}\\b`));
  });

  it.each(VENTAS)("ln$ocrLn — $item $precio → INT $int", (b) => {
    const id = idPorNombreDeOferta(b.item);
    expect(id).toBeGreaterThanOrEqual(0); // el nombre lo pone el BINARIO, no yo
    expect(despejar(shopSellPrice, base(id), b.precio)).toEqual(b.int);
  });

  it("★ CINCO exactos, todos 24, y el ambiguo lo CONTIENE — cero contradicciones", () => {
    const exactos = VENTAS.filter((b) => b.int.length === 1).map((b) => b.int[0]!);
    expect(exactos).toEqual([24, 24, 24, 24, 24]);
    for (const b of VENTAS.filter((x) => x.int.length > 1)) expect(b.int).toContain(24);
  });

  /**
   * ★ SEXTA vía, y de OTRA tabla del binario: la taberna del mismo segmento. Tika cotiza las
   * raciones a 19, y `RATION_BASE` (DS 0x4C54) para Britain vale 15 — con el regateo de COMPRA.
   * Sola da un rango; con las ventas, 24.
   */
  it("★ la taberna del MISMO segmento corrobora por otra tabla: raciones a 19 con RATION_BASE[Britain]=15", () => {
    expect(bloque(AD21, 4212)).toMatch(/\b19 gold pieces\b/);
    const b = RATION_BASE[shopTownIndex("Barkeeper", 2)]!;
    expect(b).toBe(15);
    expect(despejar(shopBuyPrice, b, 19)).toEqual([23, 24]);
  });

  /**
   * ★★ El adjetivo es DECORADO: cuatro Leather Helms, cuatro plantillas distintas, el MISMO 11.
   * Es la comprobación empírica de que el `rand(0,7)` de 0x0eec no toca el precio de 0x0ed7.
   */
  it("★★ el mismo Leather Helm se vende CUATRO veces a 11 con adjetivos distintos (el rand no toca el precio)", () => {
    // La plantilla y su precio pueden caer en DOS bloques de OCR consecutivos («…I can offer» /
    // «thee 11 for…»), así que cada adjetivo se lee con su bloque siguiente.
    const conPrecio = (ln: number) => bloque(AD21, ln) + " " + AD21.expect!.find((b) => b.ocrLn! > ln)!.text;
    const adjetivos = [4046, 4052, 4070].map(conPrecio);
    for (const t of adjetivos) expect(t).toMatch(/\b11\b/);
    expect(adjetivos[0]).toMatch(/admittedly inferior/);
    expect(adjetivos[1]).toMatch(/we have several/);
    expect(adjetivos[2]).toMatch(/battle-worn/);
    expect(new Set(adjetivos).size).toBe(3); // plantillas distintas, precio idéntico
  });

  /** El 24 NO es nuevo: es el de `espejo-diener-int.md` para la MISMA parte, medido en Paws
   *  (loc 22) y por la fórmula de COMPRA. Aquí sale en Britain (loc 2) y por la de VENTA. */
  it("★★ y coincide con el 24 que `ad21-g26` ya midió — otra ciudad y la OTRA fórmula", () => {
    const g26 = seg("ad21", "ad21-g26");
    expect(g26.enter?.loc).toBe(22);
    expect(bloque(g26, 4993)).toMatch(/\b256\b/);
    expect(despejar(shopBuyPrice, 200, 256)).toEqual([24]); // GUILD_PRICES[Paws] gemas
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §2 — ad09-g04 (loc 26, Bordermarch): ancla NUEVA, INT 21, cinco exactos
// ═══════════════════════════════════════════════════════════════════════════════════════════
const COMPRAS: { ocrLn: number; item: string; precio: number }[] = [
  { ocrLn: 250, item: "Magic Shield", precio: 2740 },
  { ocrLn: 292, item: "Magic Bow", precio: 1096 },
  { ocrLn: 322, item: "Two-Handed Hammer", precio: 116 },
  { ocrLn: 352, item: "Regeneration Ring", precio: 274 },
  { ocrLn: 394, item: "Turning Amulet", precio: 1233 },
];

describe("§2 — ad09-g04: INT 21, y los CINCO beats son exactos", () => {
  it.each(COMPRAS)("ln$ocrLn — $item a $precio existe en el corpus commiteado", (b) => {
    expect(bloque(AD09, b.ocrLn)).toMatch(new RegExp(`\\b${b.precio}\\b`));
  });

  it.each(COMPRAS)("ln$ocrLn — $item $precio → INT [21]", (b) => {
    expect(despejar(shopBuyPrice, base(idPorNombreDeOferta(b.item)), b.precio)).toEqual([21]);
  });

  it("★ los cinco caen en el MISMO entero y ninguno admite otro: 21", () => {
    const todos = COMPRAS.map((b) => despejar(shopBuyPrice, base(idPorNombreDeOferta(b.item)), b.precio));
    expect(todos).toEqual([[21], [21], [21], [21], [21]]);
  });

  /**
   * ★ CORROBORACIÓN, no evidencia: el sexto precio del segmento salió del OCR como `2V5`, que
   * no es un número. Con INT 21 el port cotiza el 2H Axe de Bordermarch a **205** — a un
   * carácter (`0`→`V`) del garabato. No se usa para despejar nada; se anota porque es el único
   * beat del segmento que el despeje no puede leer, y así queda dicho POR QUÉ.
   */
  it("★ el garabato `2V5` del 2H Axe se explica: a INT 21 el port cotiza 205 (corroboración, no evidencia)", () => {
    expect(bloque(AD09, 274)).toContain("2V5");
    expect(shopBuyPrice(base(idPorNombreDeOferta("Two-Handed Axe")), 21)).toBe(205);
    expect(despejar(shopBuyPrice, base(idPorNombreDeOferta("Two-Handed Axe")), 275)).toEqual([]);
  });

  it("★ y encaja MONÓTONA en la serie ya medida: 17 (ad01) → 20 (ad08) → **21 (ad09)** → 24 (ad21)", () => {
    const serie = [17, 20, 21, 24];
    expect(serie).toEqual([...serie].sort((a, z) => a - z));
    expect(new Set(serie).size).toBe(serie.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §3 — CONTROLES NEGATIVOS
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe("§3 — CONTROL NEGATIVO: el método discrimina, y se declara DÓNDE discrimina poco", () => {
  /** El cruce entre partes es el control fuerte: ni un solo precio se explica con el INT del otro. */
  it("★★ CRUCE: el 21 de ad09 no explica NINGÚN precio de ad21-g14, ni el 24 de ad21 ninguno de ad09-g04", () => {
    for (const b of VENTAS) expect(shopSellPrice(base(idPorNombreDeOferta(b.item)), 21)).not.toBe(b.precio);
    for (const b of COMPRAS) expect(shopBuyPrice(base(idPorNombreDeOferta(b.item)), 24)).not.toBe(b.precio);
    // …y tampoco el 20 de ad08 ni el 17 de ad01.
    for (const b of COMPRAS)
      for (const int of [17, 20]) expect(shopBuyPrice(base(idPorNombreDeOferta(b.item)), int)).not.toBe(b.precio);
  });

  /**
   * ★ El poder discriminante NO es uniforme, y contarlo entero sería vender humo: sobre las 48
   * bases del binario, los precios CAROS aíslan una sola base; los baratos admiten muchas. Lo
   * que ata el ítem es el NOMBRE que imprime el binario, no el precio. Se mide y se declara.
   */
  it("★ los beats CAROS aíslan UNA sola base de las 48; los baratos NO (y por eso no los llamo exactos por sí solos)", () => {
    const conSolucion = (f: (b: number, i: number) => number, precio: number) =>
      BASES.equipmentBasePrices.filter((b) => b > 0 && despejar(f, b, precio).length > 0).length;
    expect(conSolucion(shopSellPrice, 577)).toBe(1); // Magic Bow
    expect(conSolucion(shopBuyPrice, 2740)).toBe(1); // Magic Shield
    expect(conSolucion(shopBuyPrice, 1096)).toBe(1); // Magic Bow
    expect(conSolucion(shopBuyPrice, 1233)).toBe(1); // Amulet/Turning
    expect(conSolucion(shopSellPrice, 11)).toBeGreaterThan(10); // Leather Helm: NO discrimina sola
  });

  it("★ y las raciones: de las 9 filas de RATION_BASE sólo tres pueden dar 19, y la de Britain es una", () => {
    const filas = [...new Set(RATION_BASE)].filter((b) => despejar(shopBuyPrice, b, 19).length > 0);
    expect(filas.sort((a, z) => a - z)).toEqual([10, 15, 20]);
    expect(RATION_BASE[shopTownIndex("Barkeeper", 2)]).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// §4 — ★★ LA GUARDA: medir el INT NO desbloquea ni un cierre. Los beats son `todo`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * La ficha promete que esto «desbloquea los 8 closes». Para `ad21-g14` NO los desbloquea, y ese
 * medio bloque sigue INTACTO: el guion no lleva las teclas, así que el port no puede vender nada
 * ahí y poblar un `expectDelta` daría un CERO VACÍO (`espejo-final-f3b-acta.md` §4.1).
 *
 * ★★ EL OTRO MEDIO CAMBIÓ DE POLARIDAD, y la forma en que estaba escrito es el hallazgo del
 * carril `teclas-ad09`. La versión anterior censaba las teclas de `ad09-g04` en la ventana
 * `ocrLn ∈ [214, 410]` y afirmaba `["t", "ArrowUp", "n"]`. El carril cableó las 14 teclas de la
 * compra por el vehículo sancionado (`apply-ledger-overlay.mjs`) **y la guarda siguió VERDE**:
 * el aplicador estampa `ocrLn = afterOcrLn` en TODAS las ops del bloque, y la colocación correcta
 * —el armado del ledger va ANTES de la transacción, como manda el JSDoc de `ledgerCite`— es 213,
 * UNA LÍNEA fuera de la ventana. El mutante que «validó» la guarda cableó una `y` suelta en
 * ocrLn 370, una forma que el vehículo de producción NO EMITE NUNCA.
 * [[control-positivo-no-cubre-la-forma]] · [[gate-falso-por-construccion-testigo-equivocado]]
 *
 * Así que el censo de abajo ya no lleva ventana de `ocrLn`: mira el GUION ENTERO y separa por
 * procedencia (`src: "overlay"`). Una ventana literal no puede volver a dejarlo ciego.
 */
const CIERRES_AD21 = [3977, 3996, 4021, 4040, 4058, 4076, 4094, 4364];

describe("§4 — ★★ GUARDA: los cierres son beats `todo`; el INT no era el cuello de botella", () => {
  const CLOSE = /Sold!|"Done!"\s*says/;

  it("los 8 cierres de ad21-g14 son exactamente esas 8 líneas (criterio SELLADO de f3b §2)", () => {
    const conCierre = AD21.expect!.filter((b) => CLOSE.test(b.text)).map((b) => b.ocrLn!);
    expect(conCierre).toEqual(CIERRES_AD21);
  });

  it("★★ y NINGUNO tiene tecla: los ocho son `todo` — el port no puede cerrar esas ventas", () => {
    const conTecla = AD21.script!.filter((o) => "key" in o && CIERRES_AD21.includes(o.ocrLn as number));
    expect(conTecla).toEqual([]);
    const todos = AD21.script!.filter((o) => "todo" in o && CIERRES_AD21.includes(o.ocrLn as number));
    expect(todos).toHaveLength(CIERRES_AD21.length);
  });

  it("★ de hecho la PRIMERA visita a Iolo's Bows (7 de los 8 cierres) no tiene ni la tecla de Talk", () => {
    const teclas = AD21.script!.filter(
      (o) => "key" in o && (o.ocrLn as number) >= 3942 && (o.ocrLn as number) <= 4130,
    );
    expect(teclas).toEqual([]);
    // El único ancla de NPC del segmento está en la SEGUNDA visita (4352), la del Chain Coif.
    const anclas = AD21.script!.filter((o) => "anchor" in o).map((o) => o.ocrLn);
    expect(anclas).toEqual([4352]);
  });

  it("★★ ad09-g04 sigue teniendo UN solo cierre en el OCR (Regen Ring, 274, ocrLn 370)", () => {
    const cierre = AD09.expect!.filter((b) => CLOSE.test(b.text)).map((b) => b.ocrLn!);
    expect(cierre).toEqual([370]);
    // El beat del cierre sigue siendo un `todo`: el eco NO se convierte en tecla, porque la
    // transacción entera la conduce el bloque del overlay. El artefacto no se reescribe.
    expect(AD09.script!.some((o) => "todo" in o && o.ocrLn === 370)).toBe(true);
  });

  it("★★ POLARIDAD INVERTIDA: las 14 teclas de la compra SÍ están, y son las derivadas del OCR", () => {
    // Censo SIN ventana de ocrLn — el guion entero, separado por procedencia.
    const overlay = AD09.script!.filter((o) => o.src === "overlay" && "key" in o).map((o) => o.key);
    expect(overlay).toEqual([
      "b", // Buy (ocrLn 226 imprime literalmente «Buy»)
      "a", "n", // Magic Shield 2740 → No (250)
      "b", "n", // 2H Axe 205 → No (274)
      "c", "n", // Magic Bow 1096 → No (298)
      "e", "n", // 2H Hammer 116 → No (334)
      "f", "y", // ★ Regen Ring 274 → SÍ (370) — el único cierre
      "g", "n", // Am/Turning 1233 → No (394)
      "Escape", // «Come again» (406)
    ]);
    // Y el guion ORIGINAL del tramo de tienda sigue con sus 3 teclas propias, sin tocar
    // (aquí la ventana [214,410] SÍ vale: acota el material del SEGMENTADOR, que sí lleva su
    // `ocrLn` real. Lo que no puede acotar son las ops del overlay — de eso va el test de abajo).
    const propias = AD09.script!.filter(
      (o) => o.src !== "overlay" && "key" in o && (o.ocrLn as number) >= 214 && (o.ocrLn as number) <= 410,
    ).map((o) => o.key);
    expect(propias).toEqual(["t", "ArrowUp", "n"]);
  });

  it("★★ y la ventana LITERAL que dejó ciega a la guarda anterior: el bloque de TIENDA vive en ocrLn 213", () => {
    // Se pina la CAUSA, no sólo el síntoma: si mañana alguien vuelve a censar por
    // `ocrLn ∈ [214, 410]` creyendo que ahí están las teclas, este aserto le dice que no.
    //
    // ★ RE-CALIBRADO CON MOTIVO (carril `costura-interna`): las líneas de overlay del segmento
    // pasan de {213} a {164, 213}, y son DOS BLOQUES con dos propósitos distintos:
    //   · 164 — la COSTURA INTERNA (`{enterLoc: 26}`), colocada en el beat del «Enter keep
    //     B0RDERMARCH» del LP. Es la que mete a la party dentro del torreón; sin ella el ancla
    //     de NPC se abstiene (`skip (overworld…)`) y este §4 medía un delta 0 estructural.
    //   · 213 — el bloque de TIENDA (seeds + ancla + las 14 teclas), que sigue EXACTAMENTE donde
    //     estaba: el `ledgerCite` exige que el armado vaya ANTES de la transacción.
    // Lo que el aserto de abajo defiende no se mueve: la ventana histórica [214,410] no ve NI UNA
    // de las ops del overlay — ahora por partida doble.
    const lineas = new Set(AD09.script!.filter((o) => o.src === "overlay").map((o) => o.ocrLn));
    expect([...lineas].sort((a, b) => (a as number) - (b as number))).toEqual([164, 213]);
    expect(
      AD09.script!.filter((o) => o.src === "overlay" && o.enterLoc != null).map((o) => o.ocrLn),
      "la costura interna va en el beat del Enter del LP, no en la línea de colocación del bloque de tienda",
    ).toEqual([164]);
    const enLaVentana = AD09.script!.filter(
      (o) => o.src === "overlay" && (o.ocrLn as number) >= 214 && (o.ocrLn as number) <= 410,
    );
    expect(enLaVentana, "la ventana histórica NO ve ni una de las 30 ops del bloque").toEqual([]);
  });

  /** El otro término que impediría poblar `ad21-g14` aunque las teclas estuvieran: la taberna
   *  compra raciones en el MISMO segmento, y el runner arma UNA transacción por segmento. Las
   *  cantidades salen del OCR como garabatos, así que el agregado no es derivable. */
  it("★ y aunque se cablearan: ad21-g14 compra raciones en el mismo segmento, con cantidades ILEGIBLES", () => {
    const cantidades = [4181, 4225, 4280, 4298, 4334].map((ln) => bloque(AD21, ln));
    for (const t of cantidades) expect(t).toMatch(/thou like\?/);
    // Ninguna de las cinco da un entero limpio: «30d», «992», «50d», «5d», «2d».
    expect(cantidades.filter((t) => /thou like\?"?\s*\d+\s*$/.test(t))).toEqual([]);
  });
});
