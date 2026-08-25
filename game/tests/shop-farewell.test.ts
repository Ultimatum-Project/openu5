/**
 * Carril i18n-restos — DESPEDIDA fiel de tienda (emisor SHOPPES 0x0202) + PAUSA de
 * pacing del saludo del herrero (getkey 0x83dc).
 *
 * Derivación (verificada en este carril contra DATA.OVL fileoff 0x3b7a/0x3bba y
 * SHOPPE.DAT, método offset→registro del carril saludos-shoppe):
 *   - 0x0202: arg 0 (sin compra) → tabla DS 0x3b6a; arg 1 (con compra) → DS 0x3baa;
 *     rand(0,3) del stream VIVO; prefijo `\n\n"` (DS 0x7854/0x7858) y cola `says $.`
 *     (DS 0x785c). arg fuera de {0,1} (herrero tras VENDER, si=0xffff @0x135d) → NADA.
 *   - 0x12c3: getkey de pacing tras el welcome del herrero; la tecla se DESCARTA y
 *     el rand(0,1) de la pregunta Buy/Sell se consume DESPUÉS (0x12d4).
 *
 * Las plantillas REALES son asset de EA (shoppe.json) → aquí pool SINTÉTICO indexado.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShopType, ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import {
  SHOPPE_FAREWELL_NO_PURCHASE,
  SHOPPE_FAREWELL_PURCHASE,
} from "../src/core/shops/shoppe-greetings.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

/** Pool sintético: el registro i se reconoce por su texto `T<i>"`. */
const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);

interface Harness {
  console: ShopConsole;
  lines: string[];
  rands: number[]; // cola de valores a devolver por shopGreetingRand (se consume)
  randCalls: Array<[number, number]>;
  closed: () => boolean;
  /** Estado mutable del juego sintético (para sembrar equipo vendible). */
  state: { equipmentQuantities: number[]; gold: number };
  /** Captura de la ventana «Arms» (openArmsPicker): aperturas + callbacks vivos. */
  picker: {
    opens: number;
    pick?: (index: number) => void;
    cancel?: () => void;
    /** Filas de la ÚLTIMA apertura. El arnés las tiraba, y sin ellas no se puede
     *  asertar la POBLACIÓN de la lista — que es justo lo que 0x0c58/0x0c61 fija. */
    rows: readonly { readonly name: string }[];
  };
  /** Cues de sonido emitidos por la consola (dep `sfx`, carril audio-costuras). */
  sfx: string[];
}

function makeHarness(type: ShopType, over: { hour?: number; basePrices?: number[] } = {}): Harness {
  const lines: string[] = [];
  const rands: number[] = [];
  const randCalls: Array<[number, number]> = [];
  const sfx: string[] = [];
  let closed = false;
  const picker: Harness["picker"] = { opens: 0, rows: [] };
  const state = {
    time: { hour: over.hour ?? 9, minute: 0 },
    position: { location: 2, floor: 0, x: 0, y: 0 },
    characters: [{ intelligence: 15, name: "Avatar", status: "G", partyStatus: 0 }],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: 100,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, hi: number): number => {
      randCalls.push([lo, hi]);
      return rands.length ? rands.shift()! : lo;
    },
    shopPostPurchaseDrain: () => {},
  } as unknown as Game;
  const info: ShoppeKeeperInfo = { keeperName: "Keeper", shopName: "Shoppe" } as ShoppeKeeperInfo;
  const deps: ShopConsoleDeps = {
    game,
    shopData: {
      equipmentBasePrices: over.basePrices ?? [],
      weaponsSoldByMerchants: [],
      // Tablas del curandero (indexadas por HEALING_TOWNES) — para el flujo C/H/R.
      healPrices: [10, 10, 10, 10, 10, 10, 10],
      curePrices: [10, 10, 10, 10, 10, 10, 10],
      resurrectPrices: [50, 50, 50, 50, 50, 50, 50],
    } as unknown as ShopData,
    info,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: () => {},
    close: () => {
      closed = true;
    },
    sfx: (id) => sfx.push(id),
    openArmsPicker: (rows, onPick, onCancel) => {
      picker.opens++;
      picker.rows = rows;
      picker.pick = onPick;
      picker.cancel = onCancel;
    },
    pickMember: () => {},
  };
  return { console: new ShopConsole(type, deps), lines, rands, randCalls, closed: () => closed, state, picker, sfx };
}

describe("tablas de despedida — DS 0x3b6a / 0x3baa (DATA.OVL 0x3b7a/0x3bba)", () => {
  it("8 tipos × 4 variantes en AMBAS tablas (el herrero SÍ tiene fila, regs 0-7)", () => {
    for (const tbl of [SHOPPE_FAREWELL_NO_PURCHASE, SHOPPE_FAREWELL_PURCHASE]) {
      expect(Object.keys(tbl)).toHaveLength(8);
      for (const row of Object.values(tbl)) expect(row).toHaveLength(4);
    }
    expect(SHOPPE_FAREWELL_NO_PURCHASE.Blacksmith).toEqual([0, 1, 2, 3]);
    expect(SHOPPE_FAREWELL_PURCHASE.Blacksmith).toEqual([4, 5, 6, 7]);
  });
  // #19: la identidad de esta fila es lo que hace INOBSERVABLE el `push 1` constante
  // del curandero (0x171e). Los punteros, leídos en DATA.OVL (fileoff 0x3b7a tabla A /
  // 0x3bba tabla B, fila `shoppe_id2 = 6` ⇒ +0x30), son `0x231e 0x233c 0x235e 0x2381`
  // en LAS DOS — único tipo de los ocho con la fila repetida. Por eso `emitFarewell`
  // NO excepciona al curandero: la rama que eligiera no cambiaría un byte de salida.
  // El aserto guarda contra «regularizar» la fila B a 173-176 por simetría con los otros.
  it("la fila del CURANDERO es idéntica en ambas — y los otros SIETE difieren", () => {
    expect(SHOPPE_FAREWELL_PURCHASE.Healer).toEqual(SHOPPE_FAREWELL_NO_PURCHASE.Healer);
    for (const type of Object.keys(SHOPPE_FAREWELL_PURCHASE) as (keyof typeof SHOPPE_FAREWELL_PURCHASE)[]) {
      if (type === "Healer") continue;
      expect(SHOPPE_FAREWELL_PURCHASE[type], `${type}: las dos tablas no pueden coincidir`)
        .not.toEqual(SHOPPE_FAREWELL_NO_PURCHASE[type]);
    }
  });
});

describe("pausa de pacing del herrero (getkey 0x83dc, SHOPPES 0x12c3)", () => {
  it("start() imprime SOLO el welcome y arma la fase blacksmith-pause; la tecla continúa", () => {
    const h = makeHarness("Blacksmith");
    h.console.start();
    expect(h.console.snapshot().phase).toBe("blacksmith-pause");
    // welcome impreso; la atribución `$ says,` aún NO.
    expect(h.lines.join("\n")).toContain("welcome to Shoppe");
    expect(h.lines.join("\n")).not.toContain("says,");
    // el rand(0,1) de la pregunta NO se ha consumido todavía (orden fiel del stream).
    expect(h.randCalls).toHaveLength(0);
    // CUALQUIER tecla (Space incluido: el getkey la descarta) → atribución + pregunta + menú.
    h.console.key(" ");
    expect(h.console.snapshot().phase).toBe("menu");
    expect(h.randCalls).toEqual([[0, 1]]);
    expect(h.lines.join("\n")).toContain("Keeper says,");
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["b", "s"]);
  });
});

describe("despedida 0x0202 — rand(0,3) del stream vivo sobre la tabla según compra", () => {
  it("salir SIN compra → tabla A (0x3b6a) con prefijo `\\n\\n\"` y cola `says $.`", () => {
    const h = makeHarness("Barkeeper");
    h.console.start();
    h.rands.push(2); // variante 2
    h.console.key(" "); // Space = salir
    expect(h.closed()).toBe(true);
    expect(h.randCalls).toContainEqual([0, 3]);
    const out = h.lines.join("\n");
    expect(out).toContain(`\n\n"T${SHOPPE_FAREWELL_NO_PURCHASE.Barkeeper[2]}"`);
    expect(out).toContain("says Keeper.");
  });

  it("salir CON compra → tabla B (0x3baa)", () => {
    const h = makeHarness("Barkeeper");
    h.console.start();
    // Gate Y/N del saludo (C4, SHOPPES2 0x688): 'Y' entra al menú de la taberna.
    h.console.key("y");
    // compra con éxito simulada por el flag interno (markPurchase vía ronda) — se fuerza
    // por la vía pública: una ronda de taberna requiere core; aquí basta el flag privado.
    (h.console as unknown as { purchased: boolean }).purchased = true;
    h.rands.push(0);
    h.console.key("Escape");
    const out = h.lines.join("\n");
    expect(out).toContain(`"T${SHOPPE_FAREWELL_PURCHASE.Barkeeper[0]}"`);
  });

  it("herrero tras VENDER → despedida GENERAL en silencio (arg=-1, si=0xffff @0x135d): ni registro ni su rand", () => {
    // Con equipo vendible: 's' abre la ventana «Arms» (consume el rand(0,3) del prompt
    // de apertura); cancelar emite el Good-bye PROPIO del flujo (0x3d36) y cierra —
    // la despedida general 0x0202 NO imprime registro T<i> del pool.
    const h = makeHarness("Blacksmith", { basePrices: new Array(48).fill(10) });
    h.state.equipmentQuantities[5] = 2;
    h.console.start();
    h.console.key("x"); // pacing → menú (consume el rand(0,1))
    h.console.key("s"); // entra al flujo de venta → ventana Arms (rand(0,3) del prompt)
    expect(h.picker.opens).toBe(1);
    h.picker.cancel!(); // ESC/Space en la ventana → sellExit
    expect(h.closed()).toBe(true);
    const out = h.lines.join("\n");
    expect(out).not.toMatch(/T\d+"/); // ningún registro del pool (0x0202 silencioso)
    // rands: saludo (0,1) + prompt apertura (0,3) + Good-bye (0,3) — NINGUNO de 0x0202.
    expect(h.randCalls).toEqual([[0, 1], [0, 3], [0, 3]]);
  });

  it("sin pool (asset ausente) degrada a la fija sin consumir rand", () => {
    const h = makeHarness("InnKeeper");
    (h.console as unknown as { deps: { shoppeTexts: null } }).deps.shoppeTexts = null;
    h.console.start();
    h.console.key(" ");
    expect(h.lines.join("\n")).toContain("Come again!");
    expect(h.randCalls.filter(([, hi]) => hi === 3)).toHaveLength(0);
  });
});

// ── Charla del sell-flow del herrero (carril sell-chatter; SHOPPES 0x0f64) ─────────────
// Derivación completa en shoppe-greetings.ts (tablas DS 0x3d2e/0x3d3e/0x3d36 + piezas
// DS 0x804e/0x7ef0/0x7f06/0x7f0a/0x7f0e/0x7f12/0x7f16/0x7f20). Testigo: goodbye.png.

/** Arranca un herrero con equipo vendible y deja el flujo SELL abierto (ventana Arms). */
function startSell(over: { qty?: Array<[number, number]>; basePrices?: number[] } = {}): Harness {
  const h = makeHarness("Blacksmith", { basePrices: over.basePrices ?? new Array(48).fill(10) });
  for (const [id, q] of over.qty ?? [[5, 2]]) h.state.equipmentQuantities[id] = q;
  h.console.start();
  h.console.key("x"); // pacing → menú
  h.console.key("s"); // Sell → sellStart
  return h;
}

describe("sell-flow del herrero — charla fiel (tablas DS 0x3d2e/0x3d3e/0x3d36)", () => {
  it("sin nada que vender: eco + growls DS 0x7f20 y sesión CERRADA, SIN rand (0xc58 va antes)", () => {
    const h = makeHarness("Blacksmith");
    h.console.start();
    h.console.key("x"); // pacing → menú (rand(0,1))
    h.console.key("s");
    expect(h.closed()).toBe(true);
    expect(h.picker.opens).toBe(0);
    const out = h.lines.join("\n");
    expect(out).toContain('Sell\n\n"Thou hast nothing to sell!"\ngrowls Keeper.');
    expect(h.randCalls).toEqual([[0, 1]]); // sólo el del saludo: el growls no tira rand
  });

  it("entrada: eco `Sell` (DS 0x804e) + prompt 1-de-4 (0x3d2e, rand(0,3)) + `\" ` y ventana Arms", () => {
    const h = startSell();
    expect(h.picker.opens).toBe(1);
    expect(h.lines.join("\n")).toContain('Sell\n\n"Which item wouldst thou like to sell?" ');
    expect(h.randCalls).toEqual([[0, 1], [0, 3]]);
  });

  it("tras vender CON restos ('Y' al Deal): re-abre la ventana + `\\n\\n\"What else…\" ` (0x3d3e, rand(0,3))", () => {
    const h = startSell({ qty: [[5, 2]] }); // 2 unidades: tras vender 1 queda resto
    h.rands.push(4); // variante 4 de la oferta (0x3cbe → pool[53])
    h.picker.pick!(0); // → OFERTA + Deal? (sell_one_item 0x0e76), aún SIN vender
    expect(h.console.snapshot().phase).toBe("sell-deal");
    h.rands.push(3); // variante 3 de 0x3d3e (What else…)
    h.console.key("y");
    expect(h.closed()).toBe(false);
    expect(h.picker.opens).toBe(2); // 0xc80 re-lista antes de la charla
    const out = h.lines.join("\n");
    expect(out).toContain('Yes\n\n"Done!"\nsays Keeper.'); // eco DS 0x7d76 ('Y' @0x0f2a)
    expect(out).toContain('\n\n"What other arms wilt thou sell?" ');
  });

  it("vender el ÚLTIMO ítem: Good-bye (0x3d36) SIN atribución `says` (0xc58==0 @0x1295) y cierre", () => {
    const h = startSell({ qty: [[5, 1]] });
    h.rands.push(0); // variante 0 de la oferta
    h.picker.pick!(0);
    h.rands.push(0); // variante 0 del Good-bye
    h.console.key("y");
    expect(h.closed()).toBe(true);
    // El eco del 'Y' (DS 0x7d76) SÍ lleva `says $.`; la atribución que se suprime es
    // la del GOOD-BYE (0xc58==0 @0x1295) → se asevera sobre el último mensaje.
    const last = h.lines[h.lines.length - 1]!;
    expect(last).toContain('\n\n"Good-bye..."\n');
    expect(last).not.toContain("says Keeper.");
  });

  it("cancelar CON restos: Good-bye + `says $.` (DS 0x7f16; testigo goodbye.png) y cierre", () => {
    const h = startSell();
    h.rands.push(2); // variante 2 del Good-bye
    h.picker.cancel!();
    expect(h.closed()).toBe(true);
    const out = h.lines.join("\n");
    expect(out).toContain('\n\n"Godspeed..."\n');
    expect(out).toContain("says Keeper.");
  });
});

// ── Ofertas de venta + Deal? Y/N (carril sell-offers; sell_one_item SHOPPES 0x0e76) ────
// Derivación completa en shoppe-greetings.ts § BLACKSMITH_SELL_OFFER_INDEX: `\n\n"`
// (DS 0x7d64) + plantilla rand(0,7) de la tabla DS 0x3cbe → shoppe.json[49..56] con
// `%`=precio (itoa g_shop_accum, expansor 0x00fc) y `&`=nombre (0x3cce||0x17f6) +
// `\n\nDeal?" ` (DS 0x7d68); getkey en bucle hasta Y/N (0x0f0c-0x0f18).

describe("oferta de venta del herrero — sell_one_item 0x0e76 (rand(0,7) + Deal? Y/N)", () => {
  it("elegir un ítem emite `\\n\\n\"` + plantilla[49+r] + `\\n\\nDeal?\" ` y arma la fase sell-deal SIN vender", () => {
    const h = startSell({ qty: [[5, 2]] }); // equipId 5 (Large Shield), base 10, INT 15 → precio 5
    h.rands.push(2); // variante 2 → pool[51]
    h.picker.pick!(0);
    expect(h.console.snapshot().phase).toBe("sell-deal");
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["y", "n"]);
    expect(h.lines[h.lines.length - 1]).toBe('\n\n"T51"\n\nDeal?" ');
    // la MECÁNICA no se ha tocado aún (la venta espera al 'Y').
    expect(h.state.equipmentQuantities[5]).toBe(2);
    expect(h.state.gold).toBe(100);
    expect(h.randCalls).toEqual([[0, 1], [0, 3], [0, 7]]); // saludo · prompt · OFERTA
  });

  it("la plantilla interpola `%`=precio (§0.2: ⌊3·INT·base/100⌋+1) y `&`=nombre (tabla 0x3cce||0x17f6)", () => {
    const h = startSell({ qty: [[5, 1]] });
    // pool con placeholders reales en el registro 49 (rand=0)
    const pool = POOL.slice();
    pool[49] = 'I can offer ye % gold for that battle-worn &.';
    (h.console as unknown as { deps: { shoppeTexts: string[] } }).deps.shoppeTexts = pool;
    h.rands.push(0);
    h.picker.pick!(0);
    // INT 15 × base 10 × 3 / 100 = 4 (trunc) + 1 = 5 · equipId 5 → «Large Shield»
    expect(h.lines[h.lines.length - 1]).toBe(
      '\n\n"I can offer ye 5 gold for that battle-worn Large Shield.\n\nDeal?" ',
    );
  });

  it("'N' al Deal: eco `No` (DS 0x7d72), NO vende, y sigue el MISMO epílogo (What-else + re-lista)", () => {
    const h = startSell({ qty: [[5, 2]] });
    h.rands.push(0); // oferta
    h.picker.pick!(0);
    h.rands.push(0); // What else (0x3d3e[0])
    h.console.key("n");
    expect(h.closed()).toBe(false);
    expect(h.picker.opens).toBe(2); // re-lista también tras 'N' (ret 0 @0x11f6)
    expect(h.state.equipmentQuantities[5]).toBe(2); // sin venta
    expect(h.state.gold).toBe(100);
    const out = h.lines.join("\n");
    expect(out).toContain("No");
    expect(out).toContain('\n\n"What else can ye offer me?" ');
    expect(out).not.toContain("Done!");
  });

  it("el getkey del Deal RE-LEE lo que no sea Y/N (Space/ESC incluidos, 0x0f12-0x0f18)", () => {
    const h = startSell({ qty: [[5, 2]] });
    h.rands.push(0);
    h.picker.pick!(0);
    h.console.key(" ");
    h.console.key("Escape");
    h.console.key("x");
    expect(h.console.snapshot().phase).toBe("sell-deal"); // sigue esperando
    expect(h.closed()).toBe(false);
  });

  it("'Y' al Deal: eco DS 0x7d76 + gold += precio y qty −= 1 (mecánica sellEquipment intacta)", () => {
    const h = startSell({ qty: [[5, 2]] });
    h.rands.push(0); // oferta
    h.picker.pick!(0);
    h.rands.push(0); // What else
    h.console.key("y");
    expect(h.state.equipmentQuantities[5]).toBe(1);
    expect(h.state.gold).toBe(105); // +⌊3·15·10/100⌋+1 = +5
    expect(h.lines.join("\n")).toContain('Yes\n\n"Done!"\nsays Keeper.');
  });

  it("munición usada (Arrows 0x1b): growls DS 0x7d32 y CIERRE en silencio, SIN rand de oferta (gate 0x0e7d)", () => {
    const h = startSell({ qty: [[27, 3]] }); // sólo Arrows vendibles (base 10 en el harness)
    h.picker.pick!(0);
    expect(h.closed()).toBe(true);
    const out = h.lines.join("\n");
    expect(out).toContain('\n\n"We don\'t deal in used ammunition!"\ngrowls Keeper.');
    expect(out).not.toContain("Deal?");
    expect(out).not.toMatch(/T\d+"/); // ni oferta ni Good-bye ni despedida general (ret 1 @0x126c)
    expect(h.state.equipmentQuantities[27]).toBe(3);
    // rands: saludo (0,1) + prompt apertura (0,3) — NINGUNO de oferta ni Good-bye.
    expect(h.randCalls).toEqual([[0, 1], [0, 3]]);
  });

  it("precio base 0 (Glass Sword 0x27): la fila SE LISTA y el herrero contesta DS 0x7d8c SIN cerrar (0x0ea2 → ret 0)", () => {
    // DIVERGENCIA VIVA adjudicada en bolsa-40-acta.md §2.3-2.4 y ratificada por el lead:
    // el listador del binario (0x0c58 → 0x0c61 `cmp byte ptr [si + 0x57c0], 0`) filtra SÓLO
    // POR CANTIDAD, sin mirar precio; la fila de un ítem con base 0 SE MUESTRA, y quien lo
    // rechaza es `sell_one_item` en 0x0ea2 (`cmp word ptr [si + 0x3a82], 0`) con ret 0 —
    // o sea SIN cerrar la sesión, a diferencia de la munición (ret 1). Hay 7 ítems con base
    // 0 en la tabla real (fileoff 0x3a92): 0x08 0x0f 0x23 0x27 0x28 0x29 0x2f.
    const basePrices = new Array(48).fill(10);
    basePrices[0x27] = 0; // Glass Sword
    const h = startSell({ qty: [[0x27, 1], [5, 2]], basePrices });

    // (1) LA LISTA. Es el aserto que fallaba antes del arreglo: `sellableIds()` escondía
    //     la fila de base 0 y aquí llegaba UNA sola.
    expect(h.picker.rows.map((r) => r.name)).toHaveLength(2);

    const antesGold = h.state.gold;
    h.rands.push(2); // What else (0x3d3e[2]) — el ret 0 RE-LISTA, igual que la 'N'
    h.picker.pick!(h.picker.rows.findIndex((r) => /Glass/i.test(r.name)));

    const out = h.lines.join("\n");
    // (2) la frase del binario, con su comilla de apertura DS 0x7d64 delante (0x0e96
    //     imprime ANTES de la guarda) y el `$` expandido por 0x26 en 0x0f58.
    expect(out).toContain('\n\n"That, I cannot buy from thee."\nsays Keeper.');
    // (3) la guarda va ANTES del precio (0x0eac) y del prompt (0x0f05): ni oferta ni Deal?
    expect(out).not.toContain("Deal?");
    // (4) ret 0 ⇒ la sesión SIGUE y la ventana se RE-ABRE (contraste con la munición,
    //     ret 1, que cierra). Éste es el control que distingue las dos ramas de rechazo.
    expect(h.closed()).toBe(false);
    expect(h.picker.opens).toBe(2);
    // (5) sin mover estado: no hay `add_word_capped` ni `sub_byte` en este camino.
    expect(h.state.gold).toBe(antesGold);
    expect(h.state.equipmentQuantities[0x27]).toBe(1);
    // (6) rands: saludo (0,1) + prompt de apertura (0,3) + What-else (0,3) del re-listado.
    //     NINGUNO de oferta (0,7): la guarda 0x0ea2 va antes del rand de 0x0eec.
    expect(h.randCalls).toEqual([[0, 1], [0, 3], [0, 3]]);
  });

  it("sin pool (asset ausente) degrada a venta DIRECTA sin consumir el rand de la oferta", () => {
    const h = startSell({ qty: [[5, 2]] });
    (h.console as unknown as { deps: { shoppeTexts: null } }).deps.shoppeTexts = null;
    h.rands.push(1); // What else (0x3d3e[1]) — el ÚNICO rand tras el pick
    h.picker.pick!(0);
    expect(h.state.equipmentQuantities[5]).toBe(1); // vendido directo
    expect(h.state.gold).toBe(105);
    // RE-SELLADO en #147 tanda 2: aquí decía «I thank thee!» (prosa del port; la frase
    // real de ese punto es DS 0x7d76, CS 0x0f2a, con el eco de la tecla HORNEADO en el
    // literal y el `$` expandido por el call-site).
    expect(h.lines.join("\n")).toContain('"Done!"'); // mensaje del core (degradación)
    expect(h.randCalls).toEqual([[0, 1], [0, 3], [0, 3]]); // sin [0,7]
  });
});

// ── Jingle del servicio del CURANDERO (carril audio-costuras) ────────────────
// SHOPPES rutina 0x13b0 (6 tone_sweep LINEALES, ret 0x1469): únicos callers =
// ramas C/H/R 0x1611/0x1684/0x16eb, tras ejecutarse el servicio (pago con éxito
// vía 0x146a ret 0, gratis en location 5, caridad en Skara Brae). El resto de
// flujos de tienda del binario NO llama al speaker (SHOPPES2/3 = cero call-sites).
describe("curandero — jingle shop-transaction (SHOPPES 0x13b0)", () => {
  function startHealer(location: number, gold = 100): Harness {
    const h = makeHarness("Healer");
    (h.state as unknown as { position: { location: number } }).position.location = location;
    h.state.gold = gold;
    const ch = (h.state as unknown as { characters: Array<{ currentHp: number; maxHp: number; status: string }> }).characters[0]!;
    ch.currentHp = 10;
    ch.maxHp = 20;
    h.rands.push(0); // saludo (0,3)
    h.console.start();
    h.console.key("y"); // gate Y/N del saludo → services + nature-of-need
    return h;
  }

  it("Heal PAGADO (Trinsic, loc 6): el jingle suena tras el pago con éxito", () => {
    const h = startHealer(6);
    h.console.key("h"); // Healing → party de 1 → pitch + Wilt thou pay?
    expect(h.sfx).toEqual([]); // el pitch NO suena
    h.console.key("y"); // pago
    expect(h.sfx).toEqual(["shop-transaction"]); // 0x146a ret 0 → 0x1684 → 0x13b0
    expect(h.state.gold).toBe(90);
  });

  it("sin oro y SIN caridad (Trinsic): sorry del registro y NO suena", () => {
    const h = startHealer(6, 5);
    h.console.key("h");
    h.console.key("y"); // no puede pagar (loc ≠ 7) → shoppe[173], sin jingle
    expect(h.sfx).toEqual([]);
  });

  it("GRATIS en Minoc (loc 5): «Receive now the Light!» también suena (0x15f3 jmp 0x1611)", () => {
    const h = startHealer(5);
    h.console.key("h"); // rama gratis: sin Y/N de pago
    expect(h.sfx).toEqual(["shop-transaction"]);
    expect(h.state.gold).toBe(100); // sin cobro
  });

  it("CARIDAD en Skara Brae (loc 7, sin oro, precio ≤100): el servicio corre y suena", () => {
    const h = startHealer(7, 5);
    h.console.key("h");
    h.console.key("y"); // sin oro → caridad (0x14c2-0x14cc ⇒ ret 0 ⇒ jingle)
    expect(h.sfx).toEqual(["shop-transaction"]);
    expect(h.state.gold).toBe(5); // gratis
  });
});
