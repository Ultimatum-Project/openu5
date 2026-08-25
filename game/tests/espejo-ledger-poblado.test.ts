/**
 * F3b — SONDA DEL POBLADO DEL LEDGER VIVO.
 *
 * ## Qué defiende, y contra qué
 *
 * El pre-registro del frente 3 puso una condición: **el valor esperado de un `expectDelta` sale
 * de una fuente INDEPENDIENTE del run, con cita**. Este fichero la hace ejecutable.
 *
 * ★★ Y hubo que corregir el contrato heredado antes de poblar nada. El pre-registro padre
 * mandaba poblar «el importe del OCR» para el astillero de `ad01` y el gremio de `ad08`.
 * **El LP RECHAZÓ esos beats**: preguntó el precio y dijo que no. Poblar −186/−968/−259/−315/−35
 * habría FABRICADO cinco transacciones que nunca ocurrieron — el modo de fallo que
 * `espejo-ledger-ad.md` §2 nombró para los peajes, cometido en la población que el frente
 * llamaba «la vía real». Por eso la mayoría de los deltas de este corpus son **0**, y el 0 aquí
 * es una ASERCIÓN («la transacción no movió el contador»), no una abstención.
 *
 * La triangulación no se cae: el mercader canta el precio ANTES de que el cliente decida, así
 * que un beat rechazado triangula el INT igual de bien que uno aceptado (`espejo-diener-int.md`).
 *
 * ## Por qué lee los artefactos en vez de copiarlos
 *
 * Todo se comprueba contra el `route.json` COMMITEADO y contra las tablas del binario. Si el
 * corpus se regenera y un beat cambia o desaparece, esto cae en vez de dar un verde de museo
 * ([[cifra-sin-sonda-commiteada]]). Y los deltas se pinan **POR IDENTIDAD** (segmento → valor),
 * no por cardinal: un conteo cuadra por casualidad, una lista no.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shopBuyPrice, shopSellPrice } from "../src/core/shops/shops";
import { initShopArmsPicker, shopArmsKey } from "../src/core/shops/shopArmsPicker";
import { GUILD_PRICES, GUILD_GRANT, shopTownIndex } from "../src/core/shops/shop-tables";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
const AD = join(TOUR, "routes-ad");
const LP1 = join(TOUR, "routes");

interface Op { expectDelta?: number; expectKeysDelta?: number; expectGemsDelta?: number; ledgerCite?: string; anchor?: { expectDelta?: number }; seedInt?: number; seedStr?: number; seedEquip?: { id: number; qty: number }; key?: string; src?: string }
interface Seg { id: string; script?: Op[]; expect?: { ocrLn: number; text: string }[] }
interface Route { segments: Seg[] }

const routeFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".route.json")).map((f) => join(dir, f));
const readJson = <T>(...p: string[]): T => JSON.parse(readFileSync(join(...p), "utf8").replace(/^﻿/, "")) as T;
const load = (p: string): Route => JSON.parse(readFileSync(p, "utf8")) as Route;
const allRoutes = () => [...routeFiles(AD), ...routeFiles(LP1)].map(load);
const seg = (dir: string, part: string, id: string): Seg => {
  const s = load(join(dir, `${part}.route.json`)).segments.find((x) => x.id === id);
  if (!s) throw new Error(`segmento ${id} no existe en ${part} — el corpus se ha regenerado`);
  return s;
};
/** Texto del OCR del segmento entre dos `ocrLn`, concatenado. Es el artefacto del vídeo. */
const ocrText = (s: Seg, lo: number, hi: number) =>
  (s.expect ?? []).filter((b) => b.ocrLn >= lo && b.ocrLn <= hi).map((b) => b.text).join(" ");
/** Deltas que un op declara (el del ancla cuenta: es la forma que usan los dos verdes de LP1). */
const armsOf = (o: Op) => ({
  gold: o.expectDelta ?? o.anchor?.expectDelta,
  keys: o.expectKeysDelta,
  gems: o.expectGemsDelta,
});
const armsAny = (o: Op) => Object.values(armsOf(o)).some((v) => v != null);

// ── EL PIN POR IDENTIDAD: segmento → (oro, llaves, gemas) ──────────────────────────────────
// Un cardinal («hay 7 deltas») cuadra por casualidad; esta lista no. Si el pipeline vuelve a
// generar las rutas y se come una inserción, el nombre del segmento sale en el rojo.
const POBLADO: Record<string, { part: string; gold: number; keys?: number; gems?: number }> = {
  "ad01-g04": { part: "ad01", gold: 0 },
  "ad01-g07": { part: "ad01", gold: 0 },
  "ad04-g10": { part: "ad04", gold: 0 },
  "ad04-g17": { part: "ad04", gold: 0 },
  "ad05-g03": { part: "ad05", gold: 0 },
  "ad08-g19": { part: "ad08", gold: 0, keys: 0, gems: 0 },
  "ad09-g04": { part: "ad09", gold: -274 },
  "ad21-g26": { part: "ad21", gold: -1024, gems: 16 },
  // ── carril `poblar-deltas`: las TRES ventas `smallmap`, los primeros deltas POSITIVOS de AD.
  "ad03-g11": { part: "ad03", gold: 3 },
  "ad04-g08": { part: "ad04", gold: 58 },
  "ad06-g34": { part: "ad06", gold: 220 },
};

describe("F3b — el poblado del ledger vivo está en las rutas, con su cita", () => {
  it("los 11 segmentos poblados declaran EXACTAMENTE los deltas pre-registrados (pin por identidad)", () => {
    for (const [id, exp] of Object.entries(POBLADO)) {
      const armed = (seg(AD, exp.part, id).script ?? []).filter(armsAny);
      expect(armed, `${id}: ningún op arma el ledger — la inserción se ha perdido`).toHaveLength(1);
      const got = armsOf(armed[0]!);
      expect(got.gold, `${id}: delta de ORO`).toBe(exp.gold);
      expect(got.keys ?? null, `${id}: delta de LLAVES`).toBe(exp.keys ?? null);
      expect(got.gems ?? null, `${id}: delta de GEMAS`).toBe(exp.gems ?? null);
    }
  });

  it("cada delta poblado lleva su `ledgerCite` con la ocrLn que lo justifica", () => {
    for (const [id, exp] of Object.entries(POBLADO)) {
      const armed = (seg(AD, exp.part, id).script ?? []).find(armsAny)!;
      expect(armed.ledgerCite, `${id}: delta SIN cita — la guarda del pre-registro`).toBeTruthy();
      expect(armed.ledgerCite, `${id}: la cita no nombra ninguna ocrLn`).toMatch(/ocrLn \d+|\d{3,}/);
    }
  });

  // GUARDA DE FUTURO, y la más importante del fichero: cualquier delta que alguien añada mañana
  // en CUALQUIERA de los dos corpus tiene que traer cita. Los dos verdes de LP1 son anteriores a
  // la guarda y se nombran uno a uno — una excepción NOMBRADA no se extiende sola.
  const LP1_HEREDADOS = new Set(["part04-g03", "part05-g05"]);
  it("NINGÚN delta del proyecto queda sin cita (salvo los dos verdes heredados de LP1)", () => {
    const sinCita: string[] = [];
    for (const r of allRoutes())
      for (const s of r.segments)
        for (const o of s.script ?? [])
          if (armsAny(o) && !o.ledgerCite && !LP1_HEREDADOS.has(s.id)) sinCita.push(s.id);
    expect(sinCita, "deltas sin ledgerCite").toEqual([]);
  });
});

describe("F3b — los CEROS están justificados por el OCR: el LP rechazó", () => {
  // El aserto que separa «cero medido» de «cero por olvido»: el bloque del OCR que la cita
  // nombra tiene que contener, EN EL ARTEFACTO, la negativa del LP.
  it.each([
    ["ad01", "ad01-g04", 2308, 2316, /Dost thou pay\?\s*N/i, "peaje rechazado"],
    ["ad04", "ad04-g10", 1490, 1500, /Dost thou pay\?\s*N/i, "peaje rechazado"],
    ["ad04", "ad04-g17", 2746, 2756, /Dost thou pay\?\s*N/i, "peaje rechazado"],
    ["ad05", "ad05-g03", 245, 255, /Dost thou pay\?\s*N/i, "peaje rechazado"],
    ["ad01", "ad01-g07", 3146, 3195, /take it\?"?\s*No/i, "astillero rechazado"],
    ["ad08", "ad08-g19", 2647, 2695, /Interested\?"?\s*No/i, "gremio rechazado"],
  ])("%s/%s: el OCR %d..%d contiene la NEGATIVA (%s)", (part, id, lo, hi, re) => {
    expect(ocrText(seg(AD, part as string, id as string), lo as number, hi as number)).toMatch(re as RegExp);
  });

  it("ad08-g19: los TRES ítems del gremio se rechazan, y el mercader lo confirma al despedir", () => {
    const t = ocrText(seg(AD, "ad08", "ad08-g19"), 2640, 2700);
    expect((t.match(/Interested\?"?\s*No/gi) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(t).toMatch(/wastin' me time/i); // la frase del gremio cuando el cliente NO compra
  });

  it("ad01-g07: son TRES rechazos, no dos — la resurrección de 237 también", () => {
    const t = ocrText(seg(AD, "ad01", "ad01-g07"), 3080, 3195);
    expect(t).toMatch(/237 gold[\s\S]*Wilt thou pay\?"?\s*No/i);
  });
});

describe("F3b — ad21-g26: el PRIMER delta CON SIGNO del corpus AD, derivado del OCR y careado con el binario", () => {
  const s = () => seg(AD, "ad21", "ad21-g26");

  it("el OCR trae CUATRO cierres de compra a 256 gold", () => {
    const t = ocrText(s(), 4985, 5065);
    expect((t.match(/Sold!/g) ?? []).length).toBe(4);
    expect((t.match(/256 gold/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("el precio 256 lo REPRODUCE la fórmula del PORT con la base del binario e INT 24", () => {
    // Careo, no tautología: `shopBuyPrice` es la del port y `GUILD_PRICES` la tabla derivada
    // del binario. Paws = town1; gemas = ítem 1.
    expect(shopBuyPrice(GUILD_PRICES[1]![1]!, 24)).toBe(256);
    expect(GUILD_PRICES[1]![1]).toBe(200);
  });

  it("−1024 y +16 son 4 × (precio, concesión) — ninguna de las dos cifras es libre", () => {
    const precio = shopBuyPrice(GUILD_PRICES[1]![1]!, 24);
    expect(4 * precio).toBe(1024);
    expect(4 * GUILD_GRANT[1]).toBe(16);
    const armed = (s().script ?? []).find(armsAny)!;
    expect(armsOf(armed).gold).toBe(-4 * precio);
    expect(armsOf(armed).gems).toBe(4 * GUILD_GRANT[1]);
  });

  it("CONTROL NEGATIVO: la base de OTRO gremio no explica el 256", () => {
    // Si cualquier fila diera 256 a algún INT entero, el careo no discriminaría nada.
    const otras = GUILD_PRICES.map((r) => r[1]!).filter((b) => b !== 200);
    for (const base of otras)
      for (let int = 0; int <= 30; int++) expect(shopBuyPrice(base, int)).not.toBe(256);
  });

  it("la posada de 4918 NO entra en el delta: el OCR dice `due at check-out`", () => {
    expect(ocrText(s(), 4912, 4926)).toMatch(/due at check-out/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ad09-g04 — el SEGUNDO delta con signo: −274, herrero de Bordermarch (carril `teclas-ad09`)
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ⚠ ALCANCE, DECLARADO ARRIBA DEL TODO: este bloque prueba que el ESPERADO está bien derivado —
 * no que el runner lo mida. La corrida en vivo del carril salió con el delta a **0**, y la causa
 * NO son las teclas (están, y son éstas): es la COSTURA. `ad09-g04` es `ctx: overworld`, y
 * `resyncToNpcAnchor` (`runner.ts:2193`) aborta con `skip` cuando `pos.location === 0`. Ver
 * `re/notes/teclas-ad09-acta.md`. El delta se puebla igual porque el esperado es CORRECTO y
 * porque el día que exista el arnés de costura interna, este segmento cierra sin tocar nada más.
 */
describe("F3b — ad09-g04: −274 (Regen Ring del herrero de Bordermarch), derivado del BINARIO", () => {
  const s = () => seg(AD, "ad09", "ad09-g04");
  /** La fila de stock del herrero de Bordermarch, del binario, por la función de PRODUCCIÓN. */
  const FILA = readJson<{ weaponsSoldByMerchants: number[][]; equipmentBasePrices: number[] }>(
    TOUR, "..", "..", "assets", "data.json",
  );
  const filaBordermarch = () => FILA.weaponsSoldByMerchants[shopTownIndex("Blacksmith", 26)]!;

  it("el OCR trae UN solo cierre en todo el segmento, en ocrLn 370", () => {
    const cierres = (s().expect ?? []).filter((b) => /Sold!/.test(b.text)).map((b) => b.ocrLn);
    expect(cierres).toEqual([370]);
    expect(ocrText(s(), 352, 372)).toMatch(/274 gold[\s\S]*Yes\s*Sold!/);
  });

  it("★★ la letra `f` la fija el BINARIO, no el OCR: el Regen Ring es el 6º de la fila de stock", () => {
    const fila = filaBordermarch();
    expect(fila.filter((id) => id !== 0xff)).toEqual([7, 32, 36, 27, 31, 44, 45]);
    // índice 5 (0-based) ⇒ 6ª letra del menú `a...g` ⇒ `f`. Y el menú del OCR lo confirma.
    expect(fila.indexOf(44)).toBe(5);
    expect(String.fromCharCode(97 + 5)).toBe("f");
    expect(ocrText(s(), 226, 240)).toMatch(/f\.\.\.Regen Ring/);
  });

  it("el precio 274 lo REPRODUCE la fórmula del PORT con la base del binario e INT 21", () => {
    // Careo, no tautología: `shopBuyPrice` es la del port y `equipmentBasePrices` la del binario.
    expect(FILA.equipmentBasePrices[44]).toBe(200);
    expect(shopBuyPrice(200, 21)).toBe(274);
    const armed = (s().script ?? []).find(armsAny)!;
    expect(armsOf(armed).gold).toBe(-shopBuyPrice(FILA.equipmentBasePrices[44]!, 21));
  });

  it("★ la fila ENTERA a INT 21 reproduce los CINCO precios que el OCR canta — el 274 no viaja solo", () => {
    const esperados: Record<number, number> = { 7: 2740, 32: 205, 36: 1096, 31: 116, 44: 274, 45: 1233 };
    for (const [id, precio] of Object.entries(esperados))
      expect(shopBuyPrice(FILA.equipmentBasePrices[Number(id)]!, 21), `id ${id}`).toBe(precio);
    const t = ocrText(s(), 240, 400);
    for (const p of [2740, 1096, 116, 274, 1233]) expect(t, `precio ${p}`).toContain(String(p));
  });

  it("★★ los OTROS ítems se RECHAZAN: por eso el agregado del segmento es −274 y no más", () => {
    const t = ocrText(s(), 240, 400);
    // UN solo cierre en todo el tramo: el resto son negativas. El OCR rinde DOS de ellas como
    // `No` limpio (334, 400) y una TERCERA como `Nv` (298, la del Magic Bow) — el mismo
    // o→v del vídeo que da `Vpened!`/`murdvrvuS`. La cuarta (250, Magic Shield) no es texto:
    // es la tecla `n` que el propio guion ya traía. Se cuenta lo que el artefacto rinde, sin
    // normalizarlo a la conclusión.
    expect((t.match(/\bNo\b/g) ?? []).length).toBe(2);
    expect((t.match(/\bNv\b/g) ?? []).length).toBe(1);
    expect((t.match(/Sold!/g) ?? []).length).toBe(1);
  });

  it("CONTROL NEGATIVO: ninguna OTRA base de la fila explica el 274 a ningún INT entero", () => {
    const otras = filaBordermarch().filter((id) => id !== 0xff && id !== 44).map((id) => FILA.equipmentBasePrices[id]!);
    for (const base of otras)
      for (let int = 0; int <= 40; int++) expect(shopBuyPrice(base, int), `base ${base} @INT ${int}`).not.toBe(274);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ad03-g11 · ad04-g08 · ad06-g34 — las TRES VENTAS `smallmap` (carril `poblar-deltas`)
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ★★ LO QUE ESTE BLOQUE HACE Y LO QUE NO. El agregado de una venta no se «lee del OCR»: se
 * SIMULA el flujo entero con las piezas de PRODUCCIÓN —el reductor real de la ventana «Arms»
 * (`shopArmsKey`), la fórmula real (`shopSellPrice`), las bases del binario y el INVENTARIO REAL
 * del checkpoint `.gam` que el runner importa— conduciendo las teclas que están en el
 * `route.json` COMMITEADO. Si alguien cambia una `ArrowDown`, cambia un `seedEquip` o el
 * checkpoint deriva, el ítem vendido cambia y esto se pone rojo NOMBRÁNDOLO, offline y en
 * milisegundos, sin esperar a una corrida de 40 minutos.
 *
 * ⚠ ALCANCE HONESTO: para los importes que el OCR rinde ILEGIBLES (el Club de `ad03`, el primer
 * Short Sword y el Mace de `ad06`) esto NO es un careo independiente del precio —usa la misma
 * fórmula que el port—; sí lo es de todo lo demás (qué ítem se elige, cuántas veces, y que el
 * agregado sume). La parte del agregado confirmada por el artefacto se declara abajo, cifra a
 * cifra, en `OCR_CONFIRMADO`. [[test-contra-constante-es-circular]]
 */
describe("poblar-deltas — las TRES ventas smallmap: +3 (Trinsic) · +58 y +220 (Minoc)", () => {
  const DATA = readJson<{ equipmentBasePrices: number[] }>(TOUR, "..", "..", "assets", "data.json");
  const base = (id: number) => DATA.equipmentBasePrices[id]!;

  /** Equipo poseído del checkpoint que el runner IMPORTA como entrada de la parte (saveNative.ts:319). */
  const inventarioDelCheckpoint = (part: string): number[] => {
    const entry = (JSON.parse(readFileSync(join(AD, `${part}.route.json`), "utf8")) as
      { entry: { checkpoint?: string } }).entry;
    const gam = readFileSync(join(TOUR, "saves", `${entry.checkpoint}.gam`));
    return Array.from(gam.subarray(0x21a, 0x21a + 48));
  };

  /**
   * Conduce las teclas del bloque de overlay por el flujo SELL, con las piezas del PORT.
   * Calca `shop-console.ts`: `sellableIds` = ids con qty>0 en orden ASCENDENTE (0x0c61 es el
   * único filtro), `afterDeal` RE-ABRE la ventana ⇒ el cursor vuelve a 0 tras CADA deal
   * (`openArmsPicker` hace `initShopArmsPicker()`), y `Escape` cierra el flujo.
   *
   * ★★ Y arranca en `blacksmith-pause`, NO en `menu`. El binario hace un `getkey` que
   * DESCARTA la tecla tras el welcome (SHOPPES 0x12c3, `shop-console.ts:362`), así que la
   * PRIMERA tecla que llega tras el `t` del ancla se pierde SIEMPRE. Modelarlo no es un
   * adorno: la primera versión de estos tres bloques no traía la tecla de sacrificio, el
   * `s` se lo comió la pausa, y la corrida en vivo salió con el `Escape` final cerrando una
   * tienda en la que no se había vendido nada. El `" "` que `part04-g03` llevaba delante y
   * que parecía herencia era exactamente esto. Con la pausa modelada, esa omisión sale ROJA
   * aquí en milisegundos en vez de a los 40 minutos. [[control-positivo-no-cubre-la-forma]]
   */
  const simular = (part: string, id: string) => {
    const s = seg(AD, part, id);
    const bloque = (s.script ?? []).filter((o) => o.src === "overlay");
    const qty = inventarioDelCheckpoint(part);
    // seedEquip ASIGNA — y se aplica EN ORDEN dentro del walk (abajo), no en pre-pasada:
    // el runner conduce los ops secuencialmente (runner.ts:3524), y desde el arnés contenido
    // de ad06-g34 el bloque lleva retirada de atrezo POST-Escape (16:0/18:0) que una
    // pre-pasada aplicaría ANTES de las teclas, vaciando las filas que las flechas cuentan.
    const intel = bloque.find((o) => o.seedInt != null)!.seedInt!;
    const filas = () => qty.map((q, i) => ({ q, i })).filter((r) => r.q > 0).map((r) => r.i);

    let fase: "pausa" | "menu" | "lista" | "deal" | "fuera" = "pausa";
    let model = initShopArmsPicker();
    let pend: { equipId: number; price: number } | null = null;
    const vendidos: number[] = [];
    const ofertados: number[] = [];
    let oro = 0;
    const reListar = (): void => { model = initShopArmsPicker(); fase = filas().length === 0 ? "fuera" : "lista"; };

    for (const o of bloque) {
      if (o.seedEquip) { qty[o.seedEquip.id] = o.seedEquip.qty; continue; } // en orden, como el runner
      if (o.key == null) continue;
      // SHOPPES 0x12c3: el getkey tras el welcome DESCARTA la tecla (Space/ESC incluidos).
      if (fase === "pausa") { fase = "menu"; continue; }
      if (fase === "menu") { if (o.key === "s") reListar(); continue; }
      if (fase === "fuera") continue;
      if (fase === "deal") {
        if (o.key === "y") { oro += pend!.price; qty[pend!.equipId]! -= 1; vendidos.push(pend!.equipId); }
        pend = null;
        reListar();
        continue;
      }
      const rows = filas();
      const act = shopArmsKey(model, o.key, rows.length);
      if (act.kind === "move") model = act.model;
      else if (act.kind === "close") fase = "fuera";
      else if (act.kind === "pick") {
        const equipId = rows[act.index]!;
        ofertados.push(equipId);
        if (base(equipId) <= 0) reListar(); // 0x0ea2: ni oferta ni Deal?, se re-lista
        else { pend = { equipId, price: shopSellPrice(base(equipId), intel) }; fase = "deal"; }
      }
    }
    const armed = (s.script ?? []).find(armsAny)!;
    return { oro, vendidos, ofertados, esperado: armsOf(armed).gold, filasFinales: filas(), fase, intel };
  };

  // Lo que el vídeo rinde LEGIBLE por segmento. La diferencia con el esperado es, exactamente,
  // la parte que sale sólo de la fórmula — y está declarada, no escondida.
  const OCR_CONFIRMADO: Record<string, number> = { "ad03-g11": 0, "ad04-g08": 58, "ad06-g34": 189 };

  it.each([
    ["ad03", "ad03-g11", 3, [18]],
    ["ad04", "ad04-g08", 58, [0, 4, 18, 23]],
    ["ad06", "ad06-g34", 220, [4, 9, 20, 23, 23, 24, 28]],
  ])("%s/%s: conducir las teclas COMMITEADAS por el flujo del port vende exactamente lo previsto y suma %d", (part, id, delta, ids) => {
    const r = simular(part as string, id as string);
    expect(r.vendidos, `${id}: los equipId vendidos (orden de venta)`).toEqual(ids);
    expect(r.oro, `${id}: agregado simulado`).toBe(delta);
    expect(r.esperado, `${id}: el expectDelta de la ruta`).toBe(delta);
  });

  it("★ el rechazo de ad06 es del Throwing Axe (22): se OFERTA y no se vende — el `n` está cableado", () => {
    const r = simular("ad06", "ad06-g34");
    expect(r.ofertados).toContain(22);
    expect(r.vendidos).not.toContain(22);
    // Y su importe NO entra en el agregado: a INT 20 el port lo cotizaría a 2.
    expect(shopSellPrice(base(22), 20)).toBe(2);
    expect(r.oro).toBe(220);
  });

  it("★ en los TRES queda lista no vacía al final: el `Escape` del guion es lo que cierra, no `afterDeal`", () => {
    for (const [p, id] of [["ad03", "ad03-g11"], ["ad04", "ad04-g08"], ["ad06", "ad06-g34"]] as const) {
      const r = simular(p, id);
      expect(r.filasFinales.length, `${id}: si llegara a 0, sellExit cerraría solo y el Escape caería al MAPA`).toBeGreaterThan(0);
      expect(r.fase, `${id}: el Escape del guion cerró el flujo`).toBe("fuera");
    }
  });

  // ── Los importes, contra el OCR del artefacto ────────────────────────────────────────────
  it.each([
    ["ad04", "ad04-g08", 962, 1045, 19, [[0, 9], [4, 23], [18, 3], [23, 23]]],
    ["ad06", "ad06-g34", 5101, 5222, 20, [[4, 25], [9, 13], [20, 10], [23, 25], [28, 91]]],
  ])("%s/%s: la fórmula del PORT reproduce los importes que el OCR CANTA", (_p, id, lo, hi, intel, pares) => {
    const t = ocrText(seg(AD, id === "ad04-g08" ? "ad04" : "ad06", id as string), lo as number, hi as number);
    for (const [equipId, precio] of pares as number[][]) {
      expect(shopSellPrice(base(equipId!), intel as number), `id ${equipId}`).toBe(precio);
      expect(t, `el OCR canta ${precio}`).toContain(String(precio));
    }
  });

  it("★★ ad03-g11: el importe es ILEGIBLE pero el +3 es INSENSIBLE al INT en toda la banda medida", () => {
    // shopSellPrice(5, INT) = ⌊0,15·INT⌋+1. El despeje de ad03 descansa sobre UN solo beat
    // (int-resto §2.1) — y el delta no depende de él: vale 3 para todo INT ∈ [14,19], que cubre
    // ad01=17 y ad04=19, los INT medidos de las partes vecinas.
    for (let int = 14; int <= 19; int++) expect(shopSellPrice(5, int), `INT ${int}`).toBe(3);
    expect(shopSellPrice(5, 13)).toBe(2);
    expect(shopSellPrice(5, 20)).toBe(4);
    // Y hay un justificante EXTERNO con el importe LEGIBLE: ad04-g08 vende un Club por 3.
    expect(ocrText(seg(AD, "ad04", "ad04-g08"), 1010, 1022)).toMatch(/3 gold for it/);
  });

  it("★★ ad03-g11: el Halberd de 357 el LP lo RECHAZA — no entra en el agregado", () => {
    // El beat con el que int-resto despejó el INT es una COMPRA declinada, no el cierre.
    expect(ocrText(seg(AD, "ad03", "ad03-g11"), 2290, 2308)).toMatch(/357 gold[\s\S]*it\?"?\s*No/i);
    expect(armsOf((seg(AD, "ad03", "ad03-g11").script ?? []).find(armsAny)!).gold).toBe(3);
  });

  it("★★ ad06-g34: el par CONTROLADO interno ata el Short Sword ilegible — mismo ítem, misma visita", () => {
    const t = ocrText(seg(AD, "ad06", "ad06-g34"), 5167, 5195);
    expect((t.match(/Short Sword/g) ?? []).length).toBeGreaterThanOrEqual(2); // se venden DOS
    expect(t).toMatch(/25 gold for it/); // y el segundo SÍ se lee
    expect(shopSellPrice(base(23), 20)).toBe(25);
  });

  it("★★ el ALCANCE se declara: qué parte del agregado confirma el OCR y qué parte sólo la fórmula", () => {
    // No es decorativo: si alguien sube `OCR_CONFIRMADO` sin traer un beat legible nuevo, el
    // aserto de abajo lo delata. Y el que queda a 0 (ad03) es el que más vigilancia necesita.
    for (const [id, ocr] of Object.entries(OCR_CONFIRMADO)) {
      const part = id.slice(0, 4);
      const total = armsOf((seg(AD, part, id).script ?? []).find(armsAny)!).gold!;
      expect(ocr, `${id}: lo confirmado por el OCR no puede pasarse del total`).toBeLessThanOrEqual(total);
    }
    expect(OCR_CONFIRMADO["ad04-g08"]).toBe(58); // el ÚNICO con el agregado 100 % en el artefacto
    expect(220 - OCR_CONFIRMADO["ad06-g34"]!).toBe(31); // el Mace, único importe sin par ni lectura
    expect(shopSellPrice(base(24), 20)).toBe(31);
  });

  it("🔴 CENSO: el criterio SELLADO de cierre es un DETECTOR, no un censo — ve 1/1/5 y las ventas son 1/4/7", () => {
    // `espejo-final-f3b` §2 selló `Sold!` · `"Done!" says`, contado POR BLOQUE del OCR (así es
    // como lo cuenta el censo de este mismo fichero, más abajo). Es reproducible y vale como
    // COTA INFERIOR — pero el panel del vídeo hace SCROLL y el `says <mercader>` se le cae al
    // bloque siguiente. Usarlo como POBLACIÓN habría dejado 5 ventas del corpus sin poblar.
    const CLOSE = /Sold!|"Done!"\s*says/g;
    const porBloque = (part: string, id: string) =>
      (seg(AD, part, id).expect ?? []).reduce((n, b) => n + (b.text.match(CLOSE) ?? []).length, 0);
    expect(porBloque("ad03", "ad03-g11")).toBe(1);
    expect(porBloque("ad04", "ad04-g08")).toBe(1);
    expect(porBloque("ad06", "ad06-g34")).toBe(5);
    // Y lo que el guion vende de verdad — la lista, no un cardinal: la SIMULACIÓN de arriba.
    expect(simular("ad03", "ad03-g11").vendidos).toHaveLength(1);
    expect(simular("ad04", "ad04-g08").vendidos).toHaveLength(4);
    expect(simular("ad06", "ad06-g34").vendidos).toHaveLength(7);
  });

  it("🔴 …y se EXHIBE el mecanismo: hay bloques con `\"Done!\"` cuyo `says` vive en el bloque siguiente", () => {
    // No se acusa al criterio con otro regex «mejor» (eso sería cambiar un bucket por otro):
    // se enseña el bloque concreto que se le escapa, en el artefacto.
    const bloques = (part: string, id: string) => seg(AD, part, id).expect ?? [];
    const huerfano = (part: string, id: string) =>
      bloques(part, id).filter((b) => /"Done!"/.test(b.text) && !/"Done!"\s*says/.test(b.text));
    // 5 bloques con `"Done!"` para 4 ventas: el del Small Shield sale DOS veces (992 con su
    // `says`, 1004 sin él) porque el panel re-captura el beat al hacer scroll.
    expect(huerfano("ad04", "ad04-g08").map((b) => b.ocrLn)).toEqual([968, 1004, 1022, 1040]);
    expect(huerfano("ad06", "ad06-g34").map((b) => b.ocrLn)).toEqual([5125]);
    // El bloque 1004 de ad04 cierra con `"Done!"` a secas y el 1010 abre con `says Shenstone.`
    expect(bloques("ad04", "ad04-g08").find((b) => b.ocrLn === 1004)!.text).toMatch(/"Done!"\s*$/);
    expect(bloques("ad04", "ad04-g08").find((b) => b.ocrLn === 1010)!.text).toMatch(/says Shenstone/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// GUARDA GENERAL — un delta ≠ 0 sin teclas en su segmento es un CERO VACÍO esperando a ocurrir
// ═══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ★★ Esta guarda existe porque la que había NO SIRVIÓ. `espejo-int-loc2.test.ts` §4 censaba las
 * teclas de `ad09-g04` en la ventana `ocrLn ∈ [214, 410]`; el vehículo real
 * (`apply-ledger-overlay.mjs`) estampa `ocrLn = afterOcrLn` en TODAS las ops del bloque, y la
 * colocación correcta es 213 — una línea fuera. Se cablearon las 14 teclas y la guarda siguió
 * verde. Aquí no hay ventana: se mira el guion ENTERO del segmento que arma el delta.
 * [[control-positivo-no-cubre-la-forma]]
 */
describe("F3b — GUARDA: todo delta ≠ 0 tiene teclas de transacción en SU segmento", () => {
  it("los 6 deltas con signo del proyecto conducen teclas; ninguno es un cero vacío por guion", () => {
    const sinTeclas: string[] = [];
    const conTeclas: string[] = [];
    for (const r of allRoutes())
      for (const s of r.segments) {
        const armed = (s.script ?? []).find((o) => armsAny(o) && (armsOf(o).gold ?? 0) !== 0);
        if (!armed) continue;
        ((s.script ?? []).some((o) => o.key != null) ? conTeclas : sinTeclas).push(s.id);
      }
    expect(sinTeclas, "deltas ≠ 0 SIN ninguna tecla en el segmento (cero vacío garantizado)").toEqual([]);
    expect(conTeclas.sort()).toEqual(
      ["ad03-g11", "ad04-g08", "ad06-g34", "ad09-g04", "ad21-g26", "part04-g03", "part05-g05"].sort(),
    );
  });
});

describe("F3b — CENSO: «~397 compras» cuenta menciones, no transacciones", () => {
  const OFFER = /Interested\?|Wilt thou take it\?|Deal\?|Wouldst thou bu|May I get one for thee\?/g;
  // ⚠ El cierre exige ATRIBUCIÓN. Con `Done!` a secas, `ad18-g05` daba 11 cierres con 0 ofertas:
  // son el menú de MEZCLA DE REACTIVOS (`Type M to mix:` … `Done!`), no ventas. El bucket ancho
  // es exactamente la enfermedad que este censo diagnostica, así que se declara en vez de tragarse.
  const CLOSE = /Sold!|"Done!"\s*says/g;
  const censo = () => {
    let ofertas = 0, cierres = 0;
    const conCierre = new Set<string>();
    for (const r of allRoutes())
      for (const s of r.segments) {
        for (const b of s.expect ?? []) {
          ofertas += (b.text.match(OFFER) ?? []).length;
          const c = (b.text.match(CLOSE) ?? []).length;
          cierres += c;
          if (c) conCierre.add(s.id);
        }
      }
    return { ofertas, cierres, conCierre };
  };

  it("en los DOS corpus juntos hay 9 segmentos con al menos una transacción CERRADA", () => {
    const c = censo();
    expect(c.conCierre.size).toBe(9);
    expect(c.cierres).toBe(33);
    expect(c.ofertas).toBe(77);
  });

  it("el bucket ANCHO (`Done!` sin atribución) mete el menú de mezcla: ad18-g05 NO es una venta", () => {
    const s = seg(AD, "ad18", "ad18-g05");
    const t = (s.expect ?? []).map((b) => b.text).join(" ");
    expect(t).toMatch(/Done!/); // el criterio ancho lo contaría…
    expect(t).toMatch(/to mix/i); // …y es el menú de reactivos
    expect(t.match(/"Done!"\s*says/g) ?? []).toHaveLength(0); // el estrecho no
  });
});
