/**
 * FICHA #315 — el gate de TRAMO del tendero (TALK 0x03e7/0x03fa → NPC.OVL:0x12E0).
 *
 * Derivación entera en `re/notes/tienda-gate-horario-315.md`; el predicado vive en
 * `core/world/shop-hours.ts` y lo consumen las DOS vías (hoy (T)alk; la intercepción
 * por proximidad de los 14 tenderos de #304 entrará por el MISMO objeto, no por una
 * copia).
 *
 * 🔴 **Lo que este fichero NO puede guardar, y conviene que se sepa**: el quirk 3→1 de
 * `scheduleIndex` (NPC.OVL:0x131e) es INVISIBLE para el gate, porque el gate mira la
 * PARIDAD y 3 y 1 son ambos impares — un mutante que devuelva 3 en vez de 1 deja este
 * fichero entero en verde. El quirk es carga útil para la COLOCACIÓN (elige la terna
 * `x/y/aiTypes`, y con 3 el índice se sale del array de 3), y quien lo guarda es
 * `time.test.ts:33/40/41`, que asertan el VALOR. Se dice aquí para que nadie lea el
 * verde de este fichero como cobertura del quirk. [[el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto]]
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SHOP_CLOSED_MESSAGE, shopIsOpen } from "../src/core/world/shop-hours.js";
import { scheduleIndex } from "../src/core/time.js";

/** El MagicSeller de Moonglow (loc 1 slot 2) — el del careo de AH-1: aiTypes [0,4,1]. */
const MAGIC_SELLER = { times: [17, 11, 21, 23] };

const NPCS_JSON = new URL("../assets/npcs.json", import.meta.url);
const DATA_JSON = new URL("../assets/data.json", import.meta.url);
/**
 * `game/assets/` es salida del extractor, gitignored y SYMLINKEADA (clase #307): su
 * ausencia NO es propiedad del commit. Los bloques que la leen se saltan con razón
 * nombrada en vez de sumar una cuarta mudez a esa ficha.
 */
const hayExtraccion = ((): boolean => {
  try {
    readFileSync(NPCS_JSON);
    readFileSync(DATA_JSON);
    return true;
  } catch {
    return false;
  }
})();

describe("#315 — el tendero sólo atiende en su TRAMO (paridad del índice)", () => {
  it("tramo 1 (el del puesto): ABRE — 12:05 en Moonglow, el momento del careo de #265", () => {
    expect(scheduleIndex(MAGIC_SELLER.times, 12)).toBe(1);
    expect(shopIsOpen(MAGIC_SELLER, 12)).toBe(true);
  });

  it("tramo 0: RECHAZA (18 h) — `test byte [bx+0xe],1 / je 0x406`", () => {
    expect(scheduleIndex(MAGIC_SELLER.times, 18)).toBe(0);
    expect(shopIsOpen(MAGIC_SELLER, 18)).toBe(false);
  });

  it("tramo 2: RECHAZA (22 h) — el otro índice PAR, y el gate no distingue cuál es", () => {
    expect(scheduleIndex(MAGIC_SELLER.times, 22)).toBe(2);
    expect(shopIsOpen(MAGIC_SELLER, 22)).toBe(false);
  });

  it("tramo 3 (madrugada): el quirk lo manda al 1 y por tanto ABRE a las 4", () => {
    // El VALOR es 1 (no 3) por NPC.OVL:0x131e. Aserto sobre el valor Y sobre el gate:
    // el primero sí muere si alguien quita el remapeo; el segundo NO (paridad igual).
    expect(scheduleIndex(MAGIC_SELLER.times, 4)).toBe(1);
    expect(shopIsOpen(MAGIC_SELLER, 4)).toBe(true);
  });

  it("sin `times` no revienta: cuatro ceros → índice 0 → cerrado (el gate es default-DENY)", () => {
    expect(shopIsOpen({}, 13)).toBe(false);
  });
});

describe("#315 — el CALL-SITE, no sólo el predicado", () => {
  /**
   * «Tiene test» ≠ «está vigilado» (#133): los asertos de arriba conducen `shopIsOpen`
   * directamente y seguirían verdes si `main.ts` dejara de llamarlo. La vía de (T)alk vive
   * dentro de `boot()` (5.376 líneas, #237) y no es instanciable desde vitest, así que la
   * guarda posible hoy es de FUENTE: que la rama de tienda consulte el gate ANTES de abrir
   * la consola. Es un predicado sobre TEXTO y por tanto frágil (familia #251) — se declara
   * como lo que es. La guarda robusta llegará cuando la rama sea una función de core.
   */
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

  it("la rama de tienda de startTalk consulta el gate antes de abrir la consola", () => {
    const desde = main.indexOf("const shopType = npc ? SHOP_TYPES[npc.dialogNumber]");
    const hasta = main.indexOf("startShopConsole(shopType", desde);
    expect(desde).toBeGreaterThan(0); // el ancla existe: si el refactor la mueve, ROJO
    expect(hasta).toBeGreaterThan(desde);
    expect(main.slice(desde, hasta)).toContain("shopIsOpen(npc");
  });

  it("y el rechazo emite la cadena del pool, no un texto propio", () => {
    expect(main).toContain("SHOP_CLOSED_MESSAGE");
  });
});

describe.skipIf(!hayExtraccion)("#315 — población y copy, careados contra la extracción", () => {
  interface NpcDato {
    slot: number;
    aiTypes: number[];
    times: number[];
    dialogNumber: number;
  }

  const porPueblo = JSON.parse(readFileSync(NPCS_JSON, "utf8")) as Record<string, NpcDato[]>;
  const tenderos = Object.values(porPueblo)
    .flat()
    .filter((n) => n && n.dialogNumber >= 0x80 && n.dialogNumber <= 0xfc);

  it("censo: 46 tenderos en los 8 pueblos, 14 de ellos con aiType 4/5 (los de #304)", () => {
    expect(tenderos.length).toBe(46);
    const conAi45 = tenderos.filter((n) => n.aiTypes.some((a) => a === 4 || a === 5));
    expect(conAi45.length).toBe(14);
  });

  it("★ el gate es OBSERVABLE en los 46: ninguno abre las 24 h ni cierra las 24 h", () => {
    // Sin esto, un gate que dijera «siempre sí» (o «siempre no») pasaría los asertos de
    // arriba sobre UN tendero elegido y no cambiaría nada en el juego real. La población
    // es la que dice que el gate MUERDE: cada uno de los 46 tiene horas de las dos clases.
    const abiertas = (n: NpcDato): number =>
      Array.from({ length: 24 }, (_, h) => h).filter((h) => shopIsOpen(n, h)).length;
    const horas = tenderos.map(abiertas);
    expect(horas.filter((h) => h === 24)).toHaveLength(0);
    expect(horas.filter((h) => h === 0)).toHaveLength(0);
    expect(Math.min(...horas)).toBe(3); // el más restrictivo del juego
    expect(Math.max(...horas)).toBe(19);
  });

  it("la frase de rechazo es la del POOL, no re-tecleada (DS 0x9196 + 0x91c4)", () => {
    const data = JSON.parse(readFileSync(DATA_JSON, "utf8")) as {
      stringPools: { name: string; strings: string[] }[];
    };
    const pool = data.stringPools[19]!;
    expect(pool.name).toBe("textItemsWearUse");
    expect(SHOP_CLOSED_MESSAGE).toBe(pool.strings[148]! + pool.strings[150]!);
  });
});
