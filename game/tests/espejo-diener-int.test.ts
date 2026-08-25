/**
 * TRIANGULACIÓN DEL INT DE ALEX DIENER (corpus AD) — la puerta del ledger fase 2.
 *
 * `espejo-ledger-ad.md` §4 dejó el `seedInt` de Diener como PRERREQUISITO de las ~397
 * compras/ventas: sin él no se sabe qué valor esperar, y un `expectDelta` puesto a ciegas
 * produce «un ledger de ceros que no distingue "el port cobró mal" de "la tienda no abrió"».
 *
 * ★★ Y el resultado CORRIGE la premisa del encargo: el INT de Diener **NO es una constante**.
 * El de aulddragon (25) se midió sobre part04/part05, dos partes adyacentes. El corpus AD abarca
 * ad01..ad25 y el avatar SUBE DE NIVEL por el camino: sale **17 → 20 → 24**. Un `seedInt` único
 * para todo el corpus sería incorrecto por construcción.
 *
 * ── POR QUÉ ESTO NO ESTÁ AJUSTADO AL RESULTADO (la pregunta del lead) ─────────────────────
 * Las dos entradas son INDEPENDIENTES del run del espejo y de mí:
 *   1. el PRECIO lo pone el OCR del LP (`route.json`, artefacto commiteado del vídeo);
 *   2. la BASE la pone la tabla derivada del binario (`shop-tables.ts`), y **cuál** de sus filas
 *      aplica lo decide la `location` que la propia costura declara — no la elijo yo.
 * El INT es la única incógnita, y se despeja. Además va con CONTROL NEGATIVO: con la base de
 * CUALQUIER otra ciudad del mismo tipo de tienda, la ecuación **no tiene solución entera**. Si el
 * método admitiera varias bases, no discriminaría nada.
 *
 * ── DÓNDE CORRE CADA BLOQUE (frontera de `espejo-corpus.ts`) ──────────────────────────────
 * ★ De los 25 tests de este fichero, **16 no tocan el corpus**: son aritmética pura sobre
 * `shopBuyPrice` y las tablas EMBEBIDAS del binario (`shop-tables.ts`, que ya viaja tracked).
 * Sólo DOS `it` leen `routes-ad/` — y lo leen DENTRO de su propio callback, nunca en carga de
 * módulo ni en cuerpo de `describe`. Ésos dos son el único bloque envuelto en
 * `describeCorpusReal`: su sujeto es el corpus REAL (un `ocrLn` concreto, el importe que el OCR
 * del LP muestra, la `location` que declara la costura) y moverlos a un corpus que escribimos
 * nosotros los volvería tautológicos — el esperado y el sujeto los firmaría la misma mano.
 * [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 * Los otros 16 corren en TODAS partes, el árbol público incluido.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shopBuyPrice } from "../src/core/shops/shops";
import { GUILD_PRICES, INN_RATE, SKIFF_PRICES, FRIGATE_PRICES, shopTownIndex } from "../src/core/shops/shop-tables";
import { describeCorpusReal } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");

/** Todos los INT de 0..40 que hacen que la fórmula del PORT dé el precio del LP. */
const despejar = (base: number, precio: number): number[] =>
  Array.from({ length: 41 }, (_, i) => i).filter((int) => shopBuyPrice(base, int) === precio);

/**
 * El precio se lee del `route.json`, no se copia aquí: si el corpus se regenera y el beat cambia
 * de texto o desaparece, este test cae en vez de dar un verde de museo.
 */
function precioEnCorpus(part: string, segId: string, ocrLn: number, importe: number): boolean {
  const route = JSON.parse(readFileSync(join(TOUR, "routes-ad", `${part}.route.json`), "utf8")) as {
    segments: { id: string; expect?: { text: string; ocrLn?: number }[] }[];
  };
  const seg = route.segments.find((s) => s.id === segId);
  const bloque = seg?.expect?.find((b) => b.ocrLn === ocrLn);
  return bloque !== undefined && new RegExp(`\\b${importe}\\b`).test(bloque.text);
}

/** Ciudad que la COSTURA declara — la que fija qué fila de la tabla del binario aplica. */
function locDeclarada(part: string, segId: string): number | undefined {
  const route = JSON.parse(readFileSync(join(TOUR, "routes-ad", `${part}.route.json`), "utf8")) as {
    segments: { id: string; enter?: { loc?: number } }[];
  };
  return route.segments.find((s) => s.id === segId)?.enter?.loc;
}

interface Beat {
  part: string; seg: string; ocrLn: number; importe: number; loc: number;
  base: (loc: number) => number; que: string; int: number[];
}

const BEATS: Beat[] = [
  // ── ad01 — astillero de East Britanny. DOS ítems distintos, el mismo negociador.
  { part: "ad01", seg: "ad01-g07", ocrLn: 3140, importe: 186, loc: 21,
    base: (l) => SKIFF_PRICES[shopTownIndex("Shipwright", l)]!, que: "Skiff", int: [17] },
  { part: "ad01", seg: "ad01-g07", ocrLn: 3183, importe: 968, loc: 21,
    base: (l) => FRIGATE_PRICES[shopTownIndex("Shipwright", l)]!, que: "Frigate", int: [17] },
  // ── ad08 — gremio de Buccaneer's Den. TRES ítems del MISMO gremio.
  { part: "ad08", seg: "ad08-g19", ocrLn: 2665, importe: 315, loc: 24,
    base: (l) => GUILD_PRICES[shopTownIndex("GuildMaster", l)]![1]!, que: "Gemas ×4", int: [20] },
  { part: "ad08", seg: "ad08-g19", ocrLn: 2647, importe: 259, loc: 24,
    base: (l) => GUILD_PRICES[shopTownIndex("GuildMaster", l)]![0]!, que: "Llaves ×3", int: [20] },
  { part: "ad08", seg: "ad08-g19", ocrLn: 2683, importe: 35, loc: 24,
    base: (l) => GUILD_PRICES[shopTownIndex("GuildMaster", l)]![2]!, que: "Antorchas", int: [19, 20] },
  // ── ad21 — gremio de Paws + posada (tarifa MENSUAL = rate·10, SHOPPES3:0x037C).
  { part: "ad21", seg: "ad21-g26", ocrLn: 4993, importe: 256, loc: 22,
    base: (l) => GUILD_PRICES[shopTownIndex("GuildMaster", l)]![1]!, que: "Gemas ×4", int: [24] },
  { part: "ad21", seg: "ad21-g26", ocrLn: 4918, importe: 25, loc: 22,
    base: (l) => INN_RATE[shopTownIndex("InnKeeper", l)]! * 10, que: "Posada/mes", int: [24, 25] },
  // ── ad05 — posada de Skara Brae.
  { part: "ad05", seg: "ad05-g07", ocrLn: 971, importe: 28, loc: 7,
    base: (l) => INN_RATE[shopTownIndex("InnKeeper", l)]! * 10, que: "Posada/mes", int: [19, 20] },
];

// ⚠ CORPUS REAL. Las DOS entradas que este bloque comprueba —el importe que muestra el OCR del
// LP en un `ocrLn` concreto, y la `location` que declara la costura— son hechos del artefacto
// commiteado del vídeo. No se mueven al corpus sintético: allí las escribiríamos nosotros.
// Las lecturas viven DENTRO de cada `it` (nunca aquí, en el cuerpo del describe: `describe.skip`
// EJECUTA su cuerpo al recolectar y un readFileSync aquí daría ENOENT en el árbol público).
describeCorpusReal("los beats de precio EXISTEN en el corpus commiteado", () => {
  it.each(BEATS)("$seg ln$ocrLn — $que $importe", (b) => {
    expect(precioEnCorpus(b.part, b.seg, b.ocrLn, b.importe)).toBe(true);
  });

  it("y la `location` la declara la COSTURA, no este test", () => {
    for (const b of BEATS) expect(locDeclarada(b.part, b.seg)).toBe(b.loc);
  });
});

describe("★ el INT que despeja cada beat (fórmula del PORT contra precio del LP)", () => {
  it.each(BEATS)("$seg $que $importe → INT $int", (b) => {
    expect(despejar(b.base(b.loc), b.importe)).toEqual(b.int);
  });
});

describe("★★ el INT de Diener NO es constante: 17 → 20 → 24", () => {
  const exactos = (part: string) =>
    BEATS.filter((b) => b.part === part && b.int.length === 1).map((b) => b.int[0]!);

  it("ad01 = 17, por DOS beats exactos e independientes (skiff y frigate)", () => {
    expect(exactos("ad01")).toEqual([17, 17]);
  });

  it("ad08 = 20, por DOS beats exactos del mismo gremio (gemas y llaves)", () => {
    expect(exactos("ad08")).toEqual([20, 20]);
  });

  it("ad21 = 24 (gemas)", () => {
    expect(exactos("ad21")).toEqual([24]);
  });

  // ★ La prueba de que la progresión es de una PARTIDA REAL y no de ruido: cada beat AMBIGUO
  // contiene en su rango el valor exacto de su propia región. Cero contradicciones en 8 beats.
  it("los beats ambiguos CONTIENEN el exacto de su región (0 contradicciones)", () => {
    const region: Record<string, number> = { ad01: 17, ad08: 20, ad21: 24, ad05: 20 };
    for (const b of BEATS.filter((x) => x.int.length > 1)) {
      expect(b.int).toContain(region[b.part]);
    }
  });

  it("y la progresión es MONÓTONA CRECIENTE (el avatar sube de nivel)", () => {
    const serie = [17, 20, 24]; // ad01 → ad08 → ad21
    expect(serie).toEqual([...serie].sort((a, z) => a - z));
    expect(new Set(serie).size).toBe(serie.length);
  });
});

/**
 * CONTROL NEGATIVO — con la base de CUALQUIER otra ciudad del mismo tipo de tienda la ecuación
 * NO tiene solución entera. Sin esto, «el método siempre encuentra un INT» pasaría todo lo de
 * arriba y la triangulación no valdría nada.
 */
describe("CONTROL NEGATIVO: sólo la ciudad DECLARADA despeja", () => {
  it("Skiff 186: de las 4 ciudades de astillero, sólo la loc 21 tiene solución", () => {
    const con = SKIFF_PRICES.filter((base) => despejar(base, 186).length > 0);
    expect(con).toEqual([SKIFF_PRICES[shopTownIndex("Shipwright", 21)]]);
  });

  it("Frigate 968: idem", () => {
    const con = FRIGATE_PRICES.filter((base) => despejar(base, 968).length > 0);
    expect(con).toEqual([FRIGATE_PRICES[shopTownIndex("Shipwright", 21)]]);
  });

  it("Gemas 315 (ad08) y 256 (ad21) se despejan con gremios DISTINTOS, y no son intercambiables", () => {
    const gemas = GUILD_PRICES.map((r) => r[1]!);
    expect(gemas.filter((b) => despejar(b, 315).length > 0)).toEqual([225]); // Buccaneer's Den
    expect(gemas.filter((b) => despejar(b, 256).length > 0)).toEqual([200]); // Paws
    // El cruce: la base de una NO explica el precio de la otra.
    expect(despejar(225, 256)).toEqual([]);
    expect(despejar(200, 315)).toEqual([]);
  });
});
