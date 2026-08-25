/**
 * ALCANCE de la merma de la Falsedad — guarda de CONSUMIDOR.
 *
 * `shop_falsehood_gold_theft` (SHOPPES.OVL 0x019a) roba `rand(1,64)` en silencio cuando
 * Faulinei está en el pueblo. La mecánica ya estaba portada; lo que estaba mal era el
 * ALCANCE: el port la llamaba en 9 sitios y el binario la llama en 11, porque
 * `use-merchants.md:132` afirmaba que la taberna (SHOPPES2) no pasa por esa rutina.
 * **Sí pasa**: `(near_call_base(SHOPPES2)=0xe1e0 + 0x9dfa) & 0xFFFF = 0x7FDA` = stub
 * kernel→overlay → SHOPPES.OVL `0x019A`. Derivación: `re/notes/falsedad-merma-tiendas.md`.
 *
 * Estos tests NO comprueban la mecánica (ya la cubre `shops.test.ts`): comprueban **QUÉ
 * FLUJOS la invocan**, que es lo que estaba mal y lo que un refactor puede volver a romper.
 * Es la misma clase de guarda que la del LOS de proyectil: fijar el dato no basta si nada
 * fija el consumidor.
 *
 * ★ El caso que importa es el NEGATIVO: el rumor del tabernero (SHOPPES2 `0x0508`) hace
 * `sub [g_gold]` y **NO** llama a la merma, mientras su gemelo estructural `0x0846` sí. El
 * binario distingue pagar por CHISME de pagar por CONSUMICIÓN; un flag «merma en todo pago
 * de taberna» fabricaría un robo que el original no hace.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
POOL[69] = "What'll it be... Mutton, Ale, or Rations?";
POOL[73] = "Shall I bring thee more Ale or roast Mutton, or just Chat?";
POOL[79] = "25 servings for % gold!";

/** Harness de taberna que CUENTA las llamadas a la merma (el harness normal la stubea). */
function harness(over: { gold?: number; rands?: number[] } = {}) {
  const lines: string[] = [];
  const texts: { prefix: string; resolve?: (t: string) => void }[] = [];
  const rands = over.rands ?? [0];
  let drains = 0;
  const state = {
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
    position: { location: 2, floor: 0, x: 3, y: 3 }, // Britain
    characters: [{ name: "Avatar", status: "G", partyStatus: 0, intelligence: 15, gender: 0x0b }],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: over.gold ?? 5000,
    food: 100,
    shadowlordLocs: [2, 0xff, 0xff], // Faulinei (idx 0) EN Britain → el gate abre
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, _hi: number) => (rands.length ? rands.shift()! : lo),
    shopPostPurchaseDrain: () => { drains += 1; return 0; },
  } as unknown as Game;
  const deps: ShopConsoleDeps = {
    game,
    shopData: { equipmentBasePrices: [], weaponsSoldByMerchants: [] } as unknown as ShopData,
    info: { keeperName: "Tika", shopName: "Wayfarer" } as ShoppeKeeperInfo,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: (prefix, _max, resolve) => { texts.push({ prefix, resolve }); },
    close: () => {},
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  const c = new ShopConsole("Barkeeper", deps);
  c.start();
  c.key("y"); // gate → menú fiel
  return { c, lines, texts, state, drains: () => drains };
}

describe("alcance de la merma de la Falsedad — la TABERNA sí merma (SHOPPES2 vía stub 0x7FDA)", () => {
  it("la RONDA merma una vez (SHOPPES2 0x0147, tras el `sub [g_gold]` de 0x0143)", () => {
    const h = harness();
    expect(h.drains()).toBe(0);
    h.c.key("m"); // Mutton = la ronda del subtipo 0
    expect(h.drains()).toBe(1);
  });

  it("las RACIONES compradas del todo merman una vez (SHOPPES2 0x04fb, rama 0x4f4)", () => {
    const h = harness({ rands: [0, 2] });
    h.c.key("r");
    expect(h.texts).toHaveLength(1); // getstring de cantidad
    h.texts[0]!.resolve!("1");
    expect(h.drains()).toBe(1);
  });

  it("★ el RUMOR del tabernero NO merma (SHOPPES2 0x0611 hace `sub` y NO llama a 0x19a)", () => {
    const h = harness();
    h.c.key("m"); // servir primero: el Chat está gated a [0xbd18] (0x756)
    h.c.key("y"); // epílogo «Anything else for thee?» → vuelve al menú de RE-VISITA
    const antes = h.drains();
    expect(h.c.snapshot().phase).toBe("tavern-menu");
    h.c.key("c"); // abre el getstring del rumor
    expect(h.texts.length).toBeGreaterThan(0);
    h.texts[h.texts.length - 1]!.resolve!("britannia");
    expect(h.drains(), "el chisme NO debe mermar — el binario lo distingue de la consumición").toBe(antes);
  });
});
