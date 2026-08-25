/**
 * F2-T3 (espejo fase 2) — Astillero: cadena de venta FIEL (SHOPPES2.OVL 0x08a8),
 * antes una lista cruda con compra instantánea.
 *
 * Derivación (ver SHIP_*_INDEX en shoppe-greetings.ts y SHOP_UI ship* en
 * cmd-strings.ts): menú = registro 119 «We sell ocean-going Frigates…Which would
 * ye like to see?» (ptr 0x18eb @0x8c5; tecla desconocida RE-IMPRIME, 0xaa9→0x8c5);
 * F/S → eco `F`/`S` + pitch (117 stout-hearted / 118 shallow-waters, % = precio
 * por-ciudad con haggle DS 0x4d66/0x4d6e) + «Wilt thou take it?» (126) → Y/N;
 * pago (helper 0x7e2): sin oro → «What? Cheat me, will ye? OUT!» (122) + `yells
 * $.` (DS 0x9fc2) y salida SIN despedida ([0xbd22] @0xb07); con oro → «Sold!
 * Thou canst take delivery at the docks outside the city!» (123) + nave al
 * muelle (helper 0x80e, DS 0x4d76/0x4d7a) + «Will there be anything else,
 * sir/milady?» (124 + DS 0x9fcc-0x9fd8) → Y = menú de nuevo / N = despedida.
 * Testigo: Alex Diener Ep01 ~3120 (The Oaken Oar, East Britanny; 186/968 gp =
 * INT 17, fórmula validada por el espejo S3).
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
POOL[119] = 'which would ye like to see?"';
POOL[117] = 'frigate pitch % gold"';
POOL[118] = 'skiff pitch % gp each"';
POOL[126] = '\n\nWilt thou\ntake it?" ';
POOL[122] = 'cheat me, will ye? OUT!"';
POOL[123] = 'Sold! take delivery at the docks"';
POOL[124] = '\n\nWill there be anything else, ';

function makeHarness(over: { gold?: number } = {}) {
  const lines: string[] = [];
  let closed = false;
  const docks: number[][] = [];
  const state = {
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
    position: { location: 3, floor: 0, x: 3, y: 3 }, // Jhelom = astillero townIndex 0
    characters: [
      { name: "Avatar", status: "G", partyStatus: 0, intelligence: 15, gender: 0x0b },
    ],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    worldObjects: [],
    gold: over.gold ?? 2000,
  };
  const game = {
    state,
    shopGreetingRand: () => 0,
    shopPostPurchaseDrain: () => {},
    spawnDockShip: (x: number, y: number, flags: number, loc: number) => {
      docks.push([x, y, flags, loc]);
    },
  } as unknown as Game;
  const info = { keeperName: "Hawkins", shopName: "Oaken Oar" } as ShoppeKeeperInfo;
  const deps: ShopConsoleDeps = {
    game,
    shopData: { equipmentBasePrices: [], weaponsSoldByMerchants: [] } as unknown as ShopData,
    info,
    shoppeTexts: POOL,
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
  const console_ = new ShopConsole("Shipwright", deps);
  console_.start();
  console_.key("y"); // gate del saludo → menú
  return { console: console_, lines, state, docks, closed: () => closed };
}

describe("F2-T3 — astillero: menú y pitch (SHOPPES2 0x8c5/0x8f0/0x9d4)", () => {
  it("gate 'Y' imprime el registro-menú 119 y arma ship-menu", () => {
    const h = makeHarness();
    expect(h.lines.join("|")).toContain('which would ye like to see?"');
    expect(h.console.snapshot().phase).toBe("ship-menu");
  });

  it("tecla desconocida RE-IMPRIME el menú (0xaa9 → 0x8c5)", () => {
    const h = makeHarness();
    h.lines.length = 0;
    h.console.key("x");
    expect(h.lines.join("|")).toContain('which would ye like to see?"');
    expect(h.console.snapshot().phase).toBe("ship-menu");
  });

  it("'F': eco F + pitch 117 con % = precio haggle + «Wilt thou take it?»", () => {
    const h = makeHarness();
    h.lines.length = 0;
    h.console.key("f");
    const all = h.lines.join("|");
    expect(all).toContain("F\n\n");
    // Jhelom frigate base 600; INT 15 → 600 + trunc(600·55/100) = 930.
    expect(all).toContain('frigate pitch 930 gold"');
    expect(all).toContain('\n\nWilt thou\ntake it?" ');
    expect(h.console.snapshot().phase).toBe("ship-take");
  });

  it("'S': eco S + pitch 118 (skiff 200 → 310)", () => {
    const h = makeHarness();
    h.lines.length = 0;
    h.console.key("s");
    const all = h.lines.join("|");
    expect(all).toContain("S\n\n");
    expect(all).toContain('skiff pitch 310 gp each"');
    expect(h.console.snapshot().phase).toBe("ship-take");
  });
});

describe("F2-T3 — pago y entrega (helpers 0x7e2/0x80e)", () => {
  it("'Y' con oro: Sold + nave al muelle + «anything else, sir» → Y re-menú / N despedida", () => {
    const h = makeHarness();
    h.console.key("f");
    h.lines.length = 0;
    h.console.key("y");
    const all = h.lines.join("|");
    expect(all).toContain("Yes\n\n"); // eco (DS 0x9ff0)
    expect(all).toContain('Sold! take delivery at the docks"');
    expect(all).toContain("\n\nWill there be anything else, ");
    expect(all).toContain("sir"); // género 0x0b
    expect(all).toContain('?" ');
    expect(h.state.gold).toBe(2000 - 930);
    expect(h.docks).toEqual([[39, 221, 0x82, 0]]); // SHIP_DOCK_X/Y[0] + flags fragata
    expect(h.console.snapshot().phase).toBe("ship-else");
    // Y → menú de nuevo (0x8c5).
    h.lines.length = 0;
    h.console.key("y");
    expect(h.lines.join("|")).toContain('which would ye like to see?"');
    expect(h.console.snapshot().phase).toBe("ship-menu");
  });

  it("'Y' sin oro: «Cheat me, will ye? OUT!» yells $ y salida SIN despedida ([0xbd22])", () => {
    const h = makeHarness({ gold: 10 });
    h.console.key("s");
    h.lines.length = 0;
    h.console.key("y");
    const all = h.lines.join("|");
    expect(all).toContain('cheat me, will ye? OUT!"');
    expect(all).toContain("yells Hawkins.\n"); // $ expandido
    expect(h.state.gold).toBe(10); // sin cobro
    expect(h.closed()).toBe(true);
    // Sin despedida del pool (thrownOut): ninguna línea posterior al insulto.
    expect(all.split("|").filter((l) => l.includes("T1"))).toEqual([]);
  });

  it("'N' en el take: eco No y salida con despedida", () => {
    const h = makeHarness();
    h.console.key("f");
    h.lines.length = 0;
    h.console.key("n");
    expect(h.lines.join("|")).toContain("No");
    expect(h.closed()).toBe(true);
  });

  it("'N' en el anything-else: despedida (pool con compra)", () => {
    const h = makeHarness();
    h.console.key("f");
    h.console.key("y");
    h.console.key("n");
    expect(h.closed()).toBe(true);
  });
});
