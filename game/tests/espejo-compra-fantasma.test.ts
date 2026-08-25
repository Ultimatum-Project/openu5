/**
 * ★★ LA COMPRA FANTASMA — las KEYWORDS DE CONVERSACIÓN del LP compraban un escudo.
 *
 * Testigo del corpus: `ad03-g11` (Trinsic). Con la consola del herrero viva, el runner
 * conducía los `typed` del LP con `keyboard.type(palabra)` porque `typedSinkClass`
 * clasificaba `shopOpen()` como sumidero **`word`**. La consola de tienda NO es un
 * acumulador de texto: es el prompt `{type:"shop"}` de `main.ts:armShopKey`, que despacha
 * **tecla a tecla por fase**. Así que la palabra se pulveriza en COMANDOS DE TIENDA — el
 * caso 2 de la guarda de sumidero, pero con el ledger de por medio:
 *
 *   · la **B** de `JVB`      (op[199], ocrLn 2414 — el `JOB` del LP hablando con el preso
 *                             Jerone, leído `JVB` por el OCR)  → `b` = **Buy**, abre la lista
 *   · la **E** de `PRISONER` (op[213], ocrLn 2437)             → `e` = **Large Shield**
 *   · la **Y** de `HERESY`   (op[219], ocrLn 2446)             → `y` = **Deal? Yes**
 *
 * Medido en vivo (acta `compra-fantasma-acta.md` §2): oro 153 → 53, `equipmentQuantities[5]`
 * = 1, `ledgerDelta {expected: 3, got: −97}`. El LP nunca compró nada: su propio OCR dice que
 * RECHAZÓ el Halberd (`Wilt thou take it?" No`, ocrLn 2296-2302) y se fue.
 *
 * ⚠ ALCANCE DECLARADO. Este fichero prueba el **ENCAMINAMIENTO DE TECLAS** y la
 * clasificación del sumidero, no el importe: la fila de stock y los precios de Trinsic viven
 * en `assets/data.json`, y leerlo aquí metería este fichero en la lista de exclusiones del
 * CI público (el patrón que ya ha mordido seis veces — ver `vitest.pure.config.ts`). El
 * IMPORTE es una medición en vivo y vive en el acta con su transcript. Lo que sí sale del
 * corpus TRACKED, sin asset ninguno, es que la letra `e` del herrero de Trinsic es el Large
 * Shield: lo dice el propio OCR del segmento (§ «la letra la nombra el corpus»).
 *
 * ⚠ QUÉ BLOQUE TIENE DIENTES CONTRA EL ARREGLO, dicho para que nadie lea verde de más: el
 * único que se pone ROJO si se revierte la clasificación es **«LA RAÍZ»** (3 rojos, medidos).
 * «EL DEFECTO» y «EL ARREGLO» conducen la ShopConsole DIRECTAMENTE y son verdes en los dos
 * estados a propósito: son el TESTIGO del encaminamiento (qué palabra del LP aporta cada
 * tecla y qué pasa con y sin ellas), no el guarda del fix.
 *
 * ⚠ DÓNDE CORRE CADA BLOQUE (frontera de `espejo-corpus.ts`). Los OCHO tests de «LA RAÍZ» y
 * «CONTROLES» conducen `conductTypedOp` contra un `Page` de mentira y **no leen corpus ninguno**;
 * estaban fuera del CI público sólo porque el `readJson` de `ad03.route.json` vivía en carga de
 * módulo y mataba el fichero entero antes de recolectar. Hoy la lectura es perezosa y esos ocho
 * corren en TODAS partes — incluidos los tres que son el único guarda del fix. Los seis que sí
 * necesitan el guion del LP van en `describeCorpusReal`. Ninguno se ha borrado.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";
import { conductTypedOp } from "../e2e/espejo-tour/runner";
import { describeCorpusReal } from "./espejo-corpus";

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/^﻿/, "")) as T;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// El GUION del testigo, leído del corpus COMMITEADO (nunca copiado a mano)
// ───────────────────────────────────────────────────────────────────────────────────────
interface Op {
  key?: string;
  typed?: string;
  type?: string;
  nav?: Array<{ m: string; n: number }>;
  todo?: string;
  ocrLn?: number;
  src?: string;
  anchor?: { kind?: string; cmd?: string; match?: string; expectDelta?: number };
}
interface Ruta {
  segments: Array<{ id: string; script: Op[]; expect?: Array<{ text: string; ocrLn: number }> }>;
}
/**
 * 🔴 PEREZOSO Y MEMOIZADO, y ésa es la diferencia que saca ocho tests al árbol público.
 * Hasta hoy esto era `const AD03 = readJson(...)` + `const SEG = …` + un IIFE, TODO en carga de
 * módulo. `routes-ad/` no viaja desde #376, así que el fichero entero moría de ENOENT antes de
 * recolectar — y se llevaba por delante los OCHO tests que no tocan corpus, entre ellos el
 * bloque «LA RAÍZ», que según la cabecera de arriba es el ÚNICO con dientes contra el fix.
 * Ahora nada de esto corre hasta que un `it` lo pide.
 */
let _seg: Ruta["segments"][number] | null = null;
function seg(): Ruta["segments"][number] {
  if (!_seg) {
    const ad03 = readJson<Ruta>("../e2e/espejo-tour/routes-ad/ad03.route.json");
    const s = ad03.segments.find((x) => x.id === "ad03-g11");
    expect(s, "ad03-g11 ha desaparecido del corpus").toBeDefined();
    _seg = s!;
  }
  return _seg;
}

const ARROW: Record<string, string> = { north: "ArrowUp", south: "ArrowDown", east: "ArrowRight", west: "ArrowLeft" };

/**
 * Índice del ÚLTIMO op que re-abre la tienda del herrero en el segmento: el `t` del ancla de
 * SALUDO + su flecha. Todo lo que viene DESPUÉS es guion de mapa y de conversación con otro
 * NPC — y es lo que caía dentro de la consola. Se localiza, no se cablea con un número.
 */
function desde(): number {
  let ultimo = -1;
  seg().script.forEach((op, i) => {
    if (op.anchor?.kind === "npc" && op.anchor.match === "shop:Blacksmith" && op.key === "t") ultimo = i;
  });
  return ultimo + 2; // el `t` del ancla y la flecha que lo remata
}

/** Teclas CRUDAS que el runner emite por cada op, con su procedencia (op + palabra del LP). */
interface Tecla {
  k: string;
  op: number;
  fuente: "nav" | "key" | "typed";
  palabra?: string;
  ocrLn?: number;
}
function teclasDelGuion(opts: { conTyped: boolean }): Tecla[] {
  const out: Tecla[] = [];
  const DESDE = desde();
  seg().script.forEach((op, i) => {
    if (i < DESDE) return;
    if (op.nav) {
      for (const r of op.nav) for (let n = 0; n < r.n; n++) out.push({ k: ARROW[r.m]!, op: i, fuente: "nav" });
    } else if (op.key) {
      out.push({ k: op.key, op: i, fuente: "key", ocrLn: op.ocrLn });
    } else if (op.typed !== undefined || op.type !== undefined) {
      if (!opts.conTyped) return; // lo que produce el ARREGLO: el `typed` no se teclea
      const w = (op.typed ?? op.type)!.replace(/[`]/g, "");
      for (const ch of w) out.push({ k: ch, op: i, fuente: "typed", palabra: w, ocrLn: op.ocrLn });
      out.push({ k: "Enter", op: i, fuente: "typed", palabra: w, ocrLn: op.ocrLn });
    }
  });
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// La CONSOLA REAL del herrero (piezas de producción; precios SINTÉTICOS — ver ALCANCE)
// ───────────────────────────────────────────────────────────────────────────────────────
/** 7 ítems, como la fila de Trinsic que el OCR del propio segmento lista (a…g). */
const STOCK = [32, 33, 34, 2, 5, 12, 14];
const LETRA_ESCUDO = 4; // 0-based: `e`
/**
 * Precio base SINTÉTICO (el real vive en `assets/data.json` — ver ALCANCE). Se elige para
 * reproducir el RÉGIMEN DE SOLVENCIA de la corrida en vivo, que es lo que da forma al
 * episodio: con oro 153 cabe UNA compra y la siguiente termina en `"OUT, SLIME!"`.
 * `buyPrice(66, 19) = 66 + ⌊66·51/100⌋ = 99`.
 */
const PRECIO_BASE = 66;

interface Arnes {
  consola: ShopConsole;
  estado: { gold: number; equipmentQuantities: number[] };
  cerrada: () => boolean;
}
function herrero(oroInicial = 153): Arnes {
  const state = {
    time: { hour: 14, minute: 0 },
    position: { location: 6, floor: 0, x: 25, y: 11 }, // Trinsic
    characters: [{ intelligence: 19, name: "Barnabas", status: "G", partyStatus: 0, gender: 0x0b }],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0) as number[],
    gold: oroInicial,
  };
  let cerrada = false;
  const game = {
    state,
    shopGreetingRand: (lo: number) => lo,
    shopPostPurchaseDrain: () => {},
  } as unknown as Game;
  const deps: ShopConsoleDeps = {
    game,
    shopData: {
      equipmentBasePrices: new Array(48).fill(PRECIO_BASE),
      weaponsSoldByMerchants: [[...STOCK, 255]],
    } as unknown as ShopData,
    info: { keeperName: "Paul", shopName: "The Paladin's Protectorate" } as ShoppeKeeperInfo,
    shoppeTexts: Array.from({ length: 260 }, (_, i) => `T${i} cuesta % gp."`),
    message: () => {},
    refreshGold: () => {},
    armKey: () => {},
    armText: () => {},
    close: () => {
      cerrada = true;
    },
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  // La fila de stock se indexa por la POSICIÓN de la ciudad; con una sola fila, town 0.
  (state.position as { location: number }).location = 2;
  const consola = new ShopConsole("Blacksmith", deps);
  consola.start();
  consola.key("x"); // pausa de pacing del herrero (getkey 0x83dc) → menú Buy/Sell
  return { consola, estado: state, cerrada: () => cerrada };
}

/** Conduce las teclas contra la consola; para en cuanto la tienda se cierra (el resto cae al mapa). */
function conduce(a: Arnes, teclas: Tecla[]): { compras: Tecla[]; oroFinal: number } {
  const compras: Tecla[] = [];
  let oro = a.estado.gold;
  for (const t of teclas) {
    if (a.cerrada()) break;
    a.consola.key(t.k); // la consola normaliza y guarda el `raw` ella misma (shop-console.ts:1250)
    if (a.estado.gold !== oro) {
      compras.push(t);
      oro = a.estado.gold;
    }
  }
  return { compras, oroFinal: a.estado.gold };
}

// ⚠ CORPUS REAL. Este bloque y el siguiente conducen la ShopConsole con el GUION del LP —el
// `script` de `ad03-g11`— y uno de ellos casa prosa OCR de EA verbatim. Se quedan aquí y no se
// instancian en sintético: fabricar un segmento de tienda con la secuencia b/e/y contra la
// máquina de fases viva es lo más delicado del expediente, y su valor añadido sobre los tres
// unitarios de «LA RAÍZ» (que sí corren en público) es bajo. Ver el reporte del carril.
describeCorpusReal("compra fantasma — EL DEFECTO, sobre la consola de tienda DE PRODUCCIÓN", () => {
  it("★★ las keywords del LP COMPRAN: la consola gasta oro y mete un ítem en el inventario", () => {
    const a = herrero();
    const r = conduce(a, teclasDelGuion({ conTyped: true }));

    expect(r.oroFinal, "el oro TIENE que haberse movido: eso es la compra fantasma").toBeLessThan(153);
    expect(a.estado.equipmentQuantities[STOCK[LETRA_ESCUDO]!], "el ítem de la letra `e` entra en el inventario").toBe(1);
    expect(r.compras, "una sola compra se consuma antes de que el mercader eche al cliente").toHaveLength(1);
  });

  it("★★ la tecla que la consuma sale de un `typed`, y se NOMBRA: la Y de HERESY (ocrLn 2446)", () => {
    const a = herrero();
    const r = conduce(a, teclasDelGuion({ conTyped: true }));
    const compra = r.compras[0]!;
    expect(compra.fuente).toBe("typed");
    expect(compra.k).toBe("Y");
    expect(compra.palabra).toBe("HERESY");
    expect(compra.ocrLn).toBe(2446);
  });

  it("★★ ADJUDICA EL CANAL: entre las teclas de MAPA del guion no hay ni una `b` ni una `y`", () => {
    // Si las hubiera, el defecto podría ser de las teclas del LP (hipótesis (b) del encargo) y
    // no del sumidero. No las hay: la compra SÓLO puede venir de los `typed`.
    const mapa = teclasDelGuion({ conTyped: false });
    expect(mapa.length, "el tramo de mapa no está vacío (si no, el control no mide nada)").toBeGreaterThan(40);
    expect(mapa.filter((t) => t.k.toLowerCase() === "b").map((t) => t.op)).toEqual([]);
    expect(mapa.filter((t) => t.k.toLowerCase() === "y").map((t) => t.op)).toEqual([]);
  });

  it("la letra la nombra el CORPUS, no yo: el propio OCR del segmento lista `e...Large Shiel`", () => {
    const ocr = seg().script.filter((o) => o.todo).map((o) => o.todo!).join(" ");
    expect(ocr).toMatch(/e\.\.\.Large Shiel/);
    expect(LETRA_ESCUDO).toBe("e".charCodeAt(0) - "a".charCodeAt(0));
  });
});

describeCorpusReal("compra fantasma — EL ARREGLO: sin teclear los `typed`, la tienda no gasta un gp", () => {
  it("★★ el MISMO tramo con los `typed` descartados deja el oro y el inventario INTACTOS", () => {
    const a = herrero();
    const r = conduce(a, teclasDelGuion({ conTyped: false }));
    expect(r.oroFinal).toBe(153);
    expect(r.compras).toEqual([]);
    expect(a.estado.equipmentQuantities.some((q) => q > 0)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────
// La CLASIFICACIÓN del sumidero, conducida por `conductTypedOp` con una Page de mentira
// ───────────────────────────────────────────────────────────────────────────────────────
interface MundoSink {
  promptType: string | null;
  shopOpen: boolean;
  dialogueOpen: boolean;
  readyPicker: boolean;
  fase: string;
  /** teclas que `conductTypedOp` mandó al juego (purga incluida) */
  teclas: string[];
  /** texto que llegó a teclearse de verdad */
  tecleado: string | null;
}
function pageSink(over: Partial<MundoSink>): { page: Page; mundo: MundoSink } {
  const mundo: MundoSink = {
    promptType: null,
    shopOpen: false,
    dialogueOpen: false,
    readyPicker: false,
    fase: "menu",
    teclas: [],
    tecleado: null,
    ...over,
  };
  const ventana = {
    __u5test: {
      promptType: () => mundo.promptType,
      shopOpen: () => mundo.shopOpen,
      dialogueOpen: () => mundo.dialogueOpen,
      readyPicker: () => (mundo.readyPicker ? {} : null),
      partySelectOpen: () => false,
      shopConsole: () => (mundo.shopOpen ? { phase: mundo.fase } : null),
    },
  };
  const page = {
    locator: () => ({ count: async () => 0 }),
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
      const g = globalThis as unknown as { window?: unknown };
      const previo = g.window;
      g.window = ventana;
      try {
        return fn(arg);
      } finally {
        g.window = previo;
      }
    },
    keyboard: {
      press: async (k: string) => {
        mundo.teclas.push(k);
        // gate global de `leave()`: Space/Escape cierran en menús y listas. Al cerrar,
        // `endShopConsole` (main.ts:2309) pone `prompts.current = null` — el fake lo calca,
        // porque si no el prompt `shop` sobreviviría a su tienda y falsearía la clase.
        if (mundo.shopOpen && (k === " " || k === "Escape")) {
          mundo.shopOpen = false;
          mundo.promptType = null;
        }
      },
      type: async (t: string) => {
        mundo.tecleado = (mundo.tecleado ?? "") + t;
      },
    },
    waitForTimeout: async () => {},
  } as unknown as Page;
  return { page, mundo };
}

describe("compra fantasma — LA RAÍZ: la consola de tienda NO es un sumidero de PALABRA", () => {
  it("★★ ROJO-PRIMERO: con la tienda viva, el `typed` NO se teclea (antes se tecleaba entero)", async () => {
    const { page, mundo } = pageSink({ shopOpen: true, promptType: "shop" });
    const log: string[] = [];
    const out = await conductTypedOp(page, "HERESY", log);

    expect(out.skipped, "la palabra no tiene sumidero legítimo aquí").toBe(true);
    expect(out.typed, "y sobre todo: NO llega ni una letra a la consola del mercader").toBeNull();
    expect(mundo.tecleado).toBeNull();
    expect(log.join(" ")).toContain("CONSOLA DE TIENDA");
  });

  it("★★ la purga usa la TABLA POR FASE de cierre-dialogo, no el Escape a ciegas", async () => {
    // `buy-deal` es una de las fases cuyo getkey RE-LEE el Escape: cerrarla a ciegas la deja
    // abierta y el siguiente `typed` vuelve a comprar. La tabla manda una `n`.
    const { page, mundo } = pageSink({ shopOpen: true, promptType: "shop", fase: "buy-deal" });
    await conductTypedOp(page, "HERESY", []);
    expect(mundo.teclas[0], "fase buy-deal → 'n' (SHOP_EXIT_KEY), no 'Escape'").toBe("n");
  });

  it("la tienda cerrada tras la purga deja de consumir teclas: el `typed` siguiente sale por `none`", async () => {
    const { page, mundo } = pageSink({ shopOpen: true, promptType: "shop", fase: "menu" });
    await conductTypedOp(page, "HERESY", []);
    expect(mundo.shopOpen, "la fase `menu` sí cierra con el gate global").toBe(false);
    const teclasTrasPrimera = mundo.teclas.length;
    const out2 = await conductTypedOp(page, "BYE", []);
    expect(out2.skipped).toBe(true);
    expect(mundo.teclas.length, "sin tienda viva no se pulsa NADA").toBe(teclasTrasPrimera);
  });
});

describe("compra fantasma — CONTROLES: lo que el arreglo NO se puede llevar por delante", () => {
  it("★★ el getstring que vive DENTRO de una tienda (rumor de taberna) SIGUE tecleándose", async () => {
    // `deps.armText` (shop-console.ts:2514, `Ask about-`) arma un prompt `type:"text"`, y esa
    // rama va ANTES que la de la tienda. Si el arreglo la hubiera perdido, el rumor moriría.
    const { page } = pageSink({ shopOpen: true, promptType: "text" });
    const out = await conductTypedOp(page, "MANTRA", []);
    expect(out.skipped).toBe(false);
    expect(out.typed).toBe("MANTRA");
  });

  it("la cantidad de raciones (`type:\"number\"`) con la tienda viva también sigue entrando", async () => {
    const { page } = pageSink({ shopOpen: true, promptType: "number" });
    expect((await conductTypedOp(page, "12", [])).typed).toBe("12");
  });

  it("la CONVERSACIÓN con un NPC sigue siendo sumidero de palabra (es el 99% del corpus)", async () => {
    const { page } = pageSink({ dialogueOpen: true });
    expect((await conductTypedOp(page, "HERESY", [])).typed).toBe("HERESY");
  });

  it("el prompt RÚNICO sigue invirtiéndose a sus iniciales (carril rune-echo intacto)", async () => {
    const { page } = pageSink({ promptType: "rune" });
    const out = await conductTypedOp(page, "DES POR", []);
    expect(out.runeTranslated).toBe(true);
    expect(out.typed).toBe("DP");
  });

  it("el picker de UN CARÁCTER sigue purgándose con Escape ×2 (no se le cambia la purga)", async () => {
    const { page, mundo } = pageSink({ readyPicker: true });
    const log: string[] = [];
    expect((await conductTypedOp(page, "COMPASSION", log)).skipped).toBe(true);
    expect(mundo.teclas).toEqual(["Escape", "Escape"]);
    expect(log.join(" ")).toContain("picker de UN CARÁCTER");
  });
});

// ⚠ CORPUS REAL. La cota 3400 está CALIBRADA sobre la población real (3 435 tras
// `fix-tecleos-parciales`) y lo que este censo protege son los deltas del ledger REAL. Sobre el
// corpus sintético no diría nada de ellos: el denominador lo escribiríamos nosotros.
describeCorpusReal("compra fantasma — POR QUÉ el arreglo no puede tocar NINGÚN delta del ledger", () => {
  it("★★ CENSO: ni uno solo de los `typed` del corpus pertenece a un bloque de transacción", async () => {
    // Los bloques de compra/venta que arman el ledger se cablean con ops `key` marcadas
    // `src:"overlay"`. Si algún `typed` fuera de overlay, el arreglo podría poner un delta a 0.
    const { readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raiz = fileURLToPath(new URL("../e2e/espejo-tour/", import.meta.url));
    let total = 0;
    const deOverlay: string[] = [];
    for (const dir of ["routes-ad", "routes"]) {
      for (const f of readdirSync(join(raiz, dir)).filter((n) => n.endsWith(".json"))) {
        const r = JSON.parse(readFileSync(join(raiz, dir, f), "utf8")) as Ruta;
        for (const s of r.segments ?? []) {
          for (const op of s.script ?? []) {
            if (op.typed === undefined && op.type === undefined) continue;
            total++;
            if (op.src === "overlay") deOverlay.push(`${f}:${s.id}`);
          }
        }
      }
    }
    // cota 4000→3400 tras el re-colapso de tecleos parciales (fix-tecleos-parciales:
    // −900 typed fantasma en los dos corpus; censo medido tras instalar: 3 435)
    expect(total, "la población no puede ser cero (si no, el censo no prueba nada)").toBeGreaterThan(3400);
    expect(deOverlay).toEqual([]);
  });
});
