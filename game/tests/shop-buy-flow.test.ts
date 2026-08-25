/**
 * Carril buy-herrero — flujo BUY del herrero calcado ENTERO (dispatcher SHOPPES
 * 0x12b2 rama 'B' @0x1306 + bucle 0x0b30 + buy_one_item 0x09ac).
 *
 * Derivación instrucción a instrucción en shoppe-greetings.ts § FLUJO BUY:
 *   'B' → eco DS 0x8046 `Buy\n\n"` + exclamación rand(0,3) (DS 0x3d4a) +
 *   presentación rand(0,3) (DS 0x3d52); lista `letra...Nombre` (largo 0x17f6 si
 *   <13, corto 0x1962 si no; SIN precio) + pregunta rand(0,3) (DS 0x3cb6) + `" `;
 *   letra → eco minúscula + pitch SHOPPE.DAT[tabla DS 0x3c48] (`%`=precio §0.1) +
 *   pregunta rand(0,3) (DS 0x3ca6) + Y/N en bucle; 'Y' → Sold!/a-tope-pausa/
 *   echado-sin-oro; epílogo `"Anything else,\n` + then?/sir?/milady? (género
 *   record+0x09 @0x55b1) y RE-LISTA (otro rand). Sin oro → sesión FUERA con
 *   despedida 0x0202 en silencio (arg=-1).
 *
 * Las plantillas REALES son asset de EA (shoppe.json) → pool SINTÉTICO indexado
 * (patrón shop-farewell.test.ts). Rand = cola determinista (stream vivo simulado).
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { BLACKSMITH_BUY_PITCH_INDEX } from "../src/core/shops/shoppe-greetings.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

/** Pool sintético: el registro i se reconoce por su texto `T<i>"`. */
const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);

interface Harness {
  console: ShopConsole;
  lines: string[];
  rands: number[];
  randCalls: Array<[number, number]>;
  closed: () => boolean;
  drains: () => number;
  state: {
    equipmentQuantities: number[];
    gold: number;
    characters: Array<{ gender: number }>;
  };
}

function makeHarness(over: {
  stock?: number[];
  basePrices?: number[];
  gold?: number;
  gender?: number;
  pool?: string[] | null;
} = {}): Harness {
  const lines: string[] = [];
  const rands: number[] = [];
  const randCalls: Array<[number, number]> = [];
  let closed = false;
  let drains = 0;
  const state = {
    time: { hour: 9, minute: 0 },
    position: { location: 2, floor: 0, x: 0, y: 0 }, // Britain → town 0 del herrero
    characters: [
      { intelligence: 15, name: "Avatar", status: "G", partyStatus: 0, gender: over.gender ?? 0x0b },
    ],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: over.gold ?? 100,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, hi: number): number => {
      randCalls.push([lo, hi]);
      return rands.length ? rands.shift()! : lo;
    },
    shopPostPurchaseDrain: () => {
      drains++;
    },
  } as unknown as Game;
  const info: ShoppeKeeperInfo = { keeperName: "Keeper", shopName: "Shoppe" } as ShoppeKeeperInfo;
  const deps: ShopConsoleDeps = {
    game,
    shopData: {
      equipmentBasePrices: over.basePrices ?? new Array(48).fill(10),
      // town 0 (Britain); 255 = terminador 0xFF del binario (blacksmithStock lo filtra)
      weaponsSoldByMerchants: [[...(over.stock ?? [16, 26]), 255]],
    } as unknown as ShopData,
    info,
    shoppeTexts: over.pool === undefined ? POOL : over.pool,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: () => {},
    close: () => {
      closed = true;
    },
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  return {
    console: new ShopConsole("Blacksmith", deps),
    lines,
    rands,
    randCalls,
    closed: () => closed,
    drains: () => drains,
    state,
  };
}

/** Arranca el herrero y entra al flujo BUY (pacing → menú → 'b'). */
function startBuy(over: Parameters<typeof makeHarness>[0] = {}): Harness {
  const h = makeHarness(over);
  h.console.start();
  h.console.key("x"); // pacing (getkey 0x83dc) → menú, consume rand(0,1)
  h.console.key("b");
  return h;
}

describe("entrada al flujo BUY — dispatcher 0x1306 + lista 0x0b30", () => {
  it("'b': eco Buy + exclamación y presentación 1-de-4 (rand(0,3) ×2, DS 0x3d4a/0x3d52)", () => {
    const h = makeHarness();
    h.console.start();
    h.console.key("x"); // → menú
    h.rands.push(1, 3); // Excellent! + We've got:
    h.console.key("b");
    const out = h.lines.join("\n");
    expect(out).toContain('Buy\n\n"Excellent!\nWe\'ve got:');
    // rands: saludo (0,1) + exclamación (0,3) + presentación (0,3) + pregunta de lista (0,3)
    expect(h.randCalls).toEqual([[0, 1], [0, 3], [0, 3], [0, 3]]);
  });

  it("lista fiel: `letra...Nombre` SIN precio + pregunta 1-de-4 + `\" ` (fase buy-list)", () => {
    // 16=Dagger (largo, <13) · 42=Ring of Invisibility (≥13 → corto «Inv. Ring»)
    const h = startBuy({ stock: [16, 42] });
    expect(h.console.snapshot().phase).toBe("buy-list");
    const out = h.lines.join("\n");
    expect(out).toContain("a...Dagger");
    expect(out).toContain("b...Inv. Ring"); // regla strlen<13 (0x0be7 cmp ax,0xd)
    expect(out).not.toContain("gp\n"); // el precio NO va en la fila (sólo en el pitch)
    expect(out).toContain('What may I show thee?" ');
    // snapshot del arnés: etiquetas largas CON precio (buyPrice(10,15)=15)
    expect(h.console.snapshot().options.map((o) => o.label)).toEqual([
      "Dagger — 15 gp",
      "Ring of Invisibility — 15 gp",
    ]);
  });

  it("tecla inválida en la lista: se RE-LEE en silencio (0x0c3c, sin re-listar ni rand)", () => {
    const h = startBuy();
    const randsBefore = h.randCalls.length;
    const linesBefore = h.lines.length;
    h.console.key("z"); // fuera de rango
    expect(h.console.snapshot().phase).toBe("buy-list");
    expect(h.randCalls.length).toBe(randsBefore);
    expect(h.lines.length).toBe(linesBefore);
  });
});

describe("pitch del ítem — buy_one_item 0x09ac", () => {
  it("letra: eco minúscula + `\\n\\n\"` + plantilla[0x3c48] con %=precio + pregunta rand(0,3) + `\" `", () => {
    const h = startBuy({ stock: [16] }); // Dagger → pitch idx 22
    const pool = POOL.slice();
    pool[22] = "The Daggers we sell cost only % gp each.";
    (h.console as unknown as { deps: { shoppeTexts: string[] } }).deps.shoppeTexts = pool;
    h.rands.push(1); // Wilt thou take it?
    h.console.key("a");
    expect(h.console.snapshot().phase).toBe("buy-deal");
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["y", "n"]);
    // buyPrice(10, 15) = 10 + ⌊10·55/100⌋ = 15
    expect(h.lines[h.lines.length - 1]).toBe(
      'a\n\n"The Daggers we sell cost only 15 gp each.\n\nWilt thou take it?" ',
    );
    // la MECÁNICA no se ha tocado aún (espera al Y/N)
    expect(h.state.gold).toBe(100);
    expect(h.state.equipmentQuantities[16]).toBe(0);
  });

  it("la tabla de pitchs cubre los 41 equipId con registro (8..48) y deja null los sin-stock", () => {
    const withPitch = BLACKSMITH_BUY_PITCH_INDEX.filter((v) => v != null);
    expect(BLACKSMITH_BUY_PITCH_INDEX).toHaveLength(48);
    expect(withPitch).toHaveLength(41);
    expect(withPitch[0]).toBe(8);
    expect(withPitch[withPitch.length - 1]).toBe(48);
    for (const id of [8, 15, 35, 39, 40, 41, 47]) {
      expect(BLACKSMITH_BUY_PITCH_INDEX[id]).toBeNull();
    }
  });

  it("el getkey del pitch RE-LEE lo que no sea Y/N (Space/ESC incluidos, 0x0a3a-0x0a54)", () => {
    const h = startBuy({ stock: [16] });
    h.console.key("a");
    h.console.key(" ");
    h.console.key("Escape");
    h.console.key("q");
    expect(h.console.snapshot().phase).toBe("buy-deal");
    expect(h.closed()).toBe(false);
  });

  it("'N': eco `No` + epílogo `\"Anything else,\\nthen?` (sin compra) y RE-LISTA con su rand", () => {
    const h = startBuy({ stock: [16] });
    h.console.key("a");
    const randsBefore = h.randCalls.length;
    h.console.key("n");
    expect(h.console.snapshot().phase).toBe("buy-list");
    const out = h.lines.join("\n");
    expect(out).toContain('No\n\n"Anything else,\nthen?');
    // re-lista = 1 rand de pregunta (0x0c49 → 0x0b40 → 0x0b73)
    expect(h.randCalls.length).toBe(randsBefore + 1);
    expect(h.state.gold).toBe(100);
  });
});

describe("'Y' al pitch — pago / a-tope / sin oro (0x0a57-0x0ae0)", () => {
  it("pago: gold−=precio, qty+1, merma 0x019a, `Yes\\nSold!` + epílogo con GÉNERO (varón → sir?)", () => {
    const h = startBuy({ stock: [16] });
    h.console.key("a");
    h.console.key("y");
    expect(h.state.gold).toBe(85); // 100 − 15
    expect(h.state.equipmentQuantities[16]).toBe(1);
    expect(h.drains()).toBe(1); // merma de la Falsedad (0x019a) tras el pago
    const out = h.lines.join("\n");
    expect(out).toContain('Yes\n\nSold!\n"Anything else,\nsir?');
    expect(h.console.snapshot().phase).toBe("buy-list"); // re-lista
  });

  it("negociador hembra (record+0x09 == 0x0c): la cola del epílogo es `milady?`", () => {
    const h = startBuy({ stock: [16], gender: 0x0c });
    h.console.key("a");
    h.console.key("y");
    expect(h.lines.join("\n")).toContain('"Anything else,\nmilady?');
  });

  it("munición (Arrows 0x1b): la compra deja la cantidad EN 99 (lote lleno, 0x0ac1), no +1", () => {
    const h = startBuy({ stock: [0x1b] });
    h.console.key("a");
    h.console.key("y");
    expect(h.state.equipmentQuantities[0x1b]).toBe(99);
    expect(h.state.gold).toBe(85);
  });

  it("a-tope (qty==99, 0x0a5e): aviso + `says $.` + PAUSA por tecla; la tecla re-lista con epílogo", () => {
    const h = startBuy({ stock: [16] });
    h.state.equipmentQuantities[16] = 99;
    h.console.key("a");
    h.console.key("y");
    expect(h.console.snapshot().phase).toBe("buy-full-pause");
    const out1 = h.lines.join("\n");
    expect(out1).toContain('Yes\n\n"Thou canst not carry any more!"\nsays Keeper.');
    expect(out1).not.toContain("Anything else"); // el epílogo espera al getkey (0x0a73)
    expect(h.state.gold).toBe(100); // sin cobro
    h.console.key(" "); // CUALQUIER tecla (se descarta)
    expect(h.console.snapshot().phase).toBe("buy-list");
    expect(h.lines.join("\n")).toContain('"Anything else,\nthen?');
  });

  it("sin oro (0x0a7b): insulto rand(0,3) + `yells $.` y SESIÓN FUERA con despedida en SILENCIO", () => {
    const h = startBuy({ stock: [16], gold: 3 });
    h.console.key("a");
    h.rands.push(2); // OUT, SLIME!
    h.console.key("y");
    expect(h.closed()).toBe(true);
    // el ÚLTIMO mensaje es el insulto: la despedida 0x0202 (arg=-1) no imprime NADA después
    expect(h.lines[h.lines.length - 1]).toContain('Yes\n\n"OUT, SLIME!"\nyells Keeper.');
    expect(h.state.gold).toBe(3);
    expect(h.state.equipmentQuantities[16]).toBe(0);
  });
});

describe("salida del flujo BUY — despedida 0x0202 por el flag acumulado", () => {
  it("Space sin comprar → despedida tabla A (regs 0-3, sin compra)", () => {
    const h = startBuy();
    h.rands.push(1); // variante 1 → registro 1
    h.console.key(" ");
    expect(h.closed()).toBe(true);
    expect(h.lines.join("\n")).toContain('"T1"');
  });

  it("Space tras comprar → despedida tabla B (regs 4-7, con compra)", () => {
    const h = startBuy({ stock: [16] });
    h.console.key("a");
    h.console.key("y"); // compra
    h.rands.push(0); // variante 0 → registro 4
    h.console.key(" ");
    expect(h.closed()).toBe(true);
    expect(h.lines.join("\n")).toContain('"T4"');
  });

  it("tras comprar, el epílogo de un 'N' posterior también es de-género (di acumulado, 0x0b01)", () => {
    const h = startBuy({ stock: [16, 26] });
    h.console.key("a");
    h.console.key("y"); // compra → boughtInBuy
    h.console.key("b"); // Bow
    h.console.key("n"); // declina
    // el binario decide la cola con el flag ACUMULADO de la sesión, no el del ítem
    const tail = h.lines.join("\n").split("Anything else,").pop()!;
    expect(tail).toContain("sir?");
  });
});

describe("degradación sin pool (asset ausente) — patrón emitGreeting/pickSell", () => {
  it("compra DIRECTA con el mensaje del core, sin pitch ni sus rands", () => {
    const h = startBuy({ stock: [16], pool: null });
    const randsBefore = h.randCalls.length;
    h.console.key("a");
    expect(h.state.equipmentQuantities[16]).toBe(1);
    expect(h.state.gold).toBe(85);
    // RE-SELLADO en #147 tanda 2: aquí decía «A pleasure doing business!», prosa del
    // port sin fuente en el juego. El pago del binario emite DS 0x7bb4 (CS 0x0ad9),
    // que es lo que el core devuelve ahora; la rama degradada lo pasa por el expansor.
    expect(h.lines.join("\n")).toContain("\nSold!\n");
    // re-lista sí consume su rand de pregunta; el del pitch (0x3ca6) NO existe
    expect(h.randCalls.length).toBe(randsBefore + 1);
  });
});
