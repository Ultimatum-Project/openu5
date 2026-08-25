/**
 * Tarea #36 — «Thou hast not the gold!» NO EXISTE en el binario, y sobrevivía en
 * los siete `TxResult` de `shops.ts`. Este fichero sella la adjudicación por
 * tienda: qué emite CADA sin-oro del original, y por dónde sale en el port.
 *
 * DERIVACIÓN (leída en esta ventana, no heredada). Los cinco sin-oro del grupo
 * SHOPPES/SHOPPES2/SHOPPES3 caen en DOS familias, y ninguna la puede componer el
 * núcleo puro — todas necesitan el `$` (nombre del tendero), que vive en la capa
 * de consola (misma lección que `inn-145-acta.md` §4):
 *
 *   (a) LITERALES DE DATA.OVL con rand — ARMERÍA, `buy_one_item` 0x0a7b:
 *       `cmp [g_gold],ax / jge 0xaaa`; sin oro → DS 0x7ba4 `\n"` (impresor llano
 *       0x75c0) + rand(0,3) sobre la tabla DS 0x3cae (0x0a8b push 3 / 0x0a8f call
 *       0x7e02 / 0x0a96 `push [bx+0x3cae]`) + DS 0x7ba8 `"\nyells $.\n` (expansor
 *       0x26), y `0x0aa4 mov di,0xffff` ⇒ ret −1 ⇒ despedida 0x0202 SILENCIOSA.
 *       ★ Esta familia NO depende de SHOPPE.DAT: se puede emitir SIN pool.
 *
 *   (b) REGISTROS DE SHOPPE.DAT — el resto, todos con ret −1 salvo el sanador:
 *       · reactivos `buy_one_reagent` 0x060a → 0x0610 `mov ax,0xb6e2` + call 0x26
 *         (chunk precargado en 0xb21e desde fileoff 0x1a67 ⇒ rebase −0x97b7 ⇒
 *         fileoff 0x1f2b) = registro 147; `0x0617 mov si,0xffff`.
 *       · gremio `buy_one_guild` 0x0361 → 0x0367 `mov ax,0x21e6` + call 0x17a
 *         (print_shoppe con fileoff CRUDO) = registro 163; `0x036e mov si,0xffff`.
 *       · sanador 0x14bc → caridad si `precio ≤ 0x64` Y `[g_location]==7`
 *         (0x14c2/0x14c7); si no, 0x14ce `mov ax,0x23ab` + call 0x17a = registro
 *         173, `[bp-4]=1` (declinado) y SIGUE el epílogo — NO echa.
 *       · posada 193 (`inn-145-acta.md`) y astillero 122 (`SHIP_CHEAT_INDEX`).
 *
 * CONTROL del mapeo fileoff→registro (barrido de SHOPPE.DAT por registros
 * terminados en NUL: 195, los mismos que `shoppe.json`): reproduce los tres ya
 * curados — 104 → 0x1643, 173 → 0x23AB y 193. 3/3.
 *
 * ⇒ El núcleo devuelve `reason: "gold"` con mensaje VACÍO y la consola emite lo
 * que toca. Vacío NO es «no se dijo nada»: es «este texto no es del núcleo».
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShopType, ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import {
  buyEquipment,
  buyGuildItem,
  buyReagent,
  buyShip,
  healerHeal,
  innPickup,
} from "../src/core/shops/shops.js";
import { BLACKSMITH_BUY_BROKE } from "../src/core/shops/shoppe-greetings.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const FABRICADA = "Thou hast not the gold!";

// ── Arnés de consola (patrón shop-buy-flow.test.ts), parametrizado por tipo ──

interface Harness {
  console: ShopConsole;
  lines: string[];
  rands: number[];
  closed: () => boolean;
  state: Record<string, unknown> & { gold: number };
}

function makeHarness(
  type: ShopType,
  over: {
    location?: number;
    gold?: number;
    pool?: string[] | null;
    characters?: Array<Record<string, unknown>>;
  } = {},
): Harness {
  const lines: string[] = [];
  const rands: number[] = [];
  let closed = false;
  const state = {
    time: { hour: 9, minute: 0 },
    position: { location: over.location ?? 2, floor: 0, x: 0, y: 0 },
    characters: over.characters ?? [
      { intelligence: 15, name: "Avatar", status: "G", partyStatus: 0, gender: 0x0b, currentHp: 10, maxHp: 30 },
    ],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    reagentQuantities: new Array(8).fill(0),
    keys: 0,
    gems: 0,
    torches: 0,
    gold: over.gold ?? 0,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, hi: number): number => (rands.length ? rands.shift()! : lo),
    shopPostPurchaseDrain: () => {},
    spawnDockShip: () => {},
  } as unknown as Game;
  const info: ShoppeKeeperInfo = { keeperName: "Keeper", shopName: "Shoppe" } as ShoppeKeeperInfo;
  const deps: ShopConsoleDeps = {
    game,
    shopData: {
      equipmentBasePrices: new Array(48).fill(10),
      weaponsSoldByMerchants: [[16, 26, 255]],
      // reactivos: town·8+slot; precio no-cero en el slot 0 para que la lista lo liste
      reagentBasePrices: new Array(64).fill(10),
      reagentQuantities: new Array(64).fill(3),
      healPrices: new Array(7).fill(50),
      curePrices: new Array(7).fill(50),
      resurrectPrices: new Array(7).fill(50),
    } as unknown as ShopData,
    info,
    shoppeTexts: over.pool === undefined ? null : over.pool,
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
    console: new ShopConsole(type, deps),
    lines,
    rands,
    closed: () => closed,
    state,
  };
}

// ── 1. El NÚCLEO: la fabricación no vuelve por ninguno de los siete ─────────

describe("núcleo — los SIETE sin-oro devuelven reason 'gold' y mensaje VACÍO", () => {
  const cero = { gold: 0 };

  it("buyEquipment (armería, 0x0a7b)", () => {
    const s = { ...cero, equipmentQuantities: new Array(48).fill(0) } as never;
    const r = buyEquipment(s, 16, 50);
    expect(r).toEqual({ ok: false, reason: "gold", message: "" });
  });

  it("buyReagent (reactivos, 0x060a)", () => {
    const s = { ...cero, reagentQuantities: new Array(8).fill(0) } as never;
    const r = buyReagent(s, 0, 3, 50);
    expect(r).toEqual({ ok: false, reason: "gold", message: "" });
  });

  it("buyGuildItem (gremio, 0x0361)", () => {
    const s = { ...cero, keys: 0, gems: 0, torches: 0 } as never;
    const r = buyGuildItem(s, 0, 0, 15);
    expect(r).toEqual({ ok: false, reason: "gold", message: "" });
  });

  it("healerHeal (sanador, 0x14bc)", () => {
    const s = { ...cero, characters: [{ status: "G", currentHp: 1, maxHp: 30 }] } as never;
    const r = healerHeal(s, 0, "heal", 50);
    expect(r).toEqual({ ok: false, reason: "gold", message: "" });
  });

  it("buyShip (astillero, helper 0x7e2)", () => {
    const r = buyShip({ ...cero } as never, 0, "frigate", 15);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("gold");
    expect(r.message).toBe("");
  });

  it("innPickup (posada, 0x0799)", () => {
    const s = {
      ...cero,
      position: { location: 2 },
      partySize: 1,
      characters: [{ status: "G", partyStatus: 0, intelligence: 15 }, { status: "G", partyStatus: 2, intelligence: 15 }],
    } as never;
    const r = innPickup(s, 0, 1, 2);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("gold");
    expect(r.message).toBe("");
  });
});

// ── 2. La CONSOLA: la vía de degradación (sin pool) ya no fabrica ───────────

describe("armería sin pool (a) — el sin-oro es de DATA.OVL y SÍ se emite entero", () => {
  /**
   * Entra al flujo BUY sin pool. OJO: el saludo del herrero NO es del pool (es el
   * literal DS 0x8018), así que `start()` sí saluda y deja la PAUSA de pacing
   * (0x12c3); hay que gastar una tecla antes del menú.
   */
  function startBuy(over: Parameters<typeof makeHarness>[1] = {}): Harness {
    const h = makeHarness("Blacksmith", { location: 2, ...over });
    h.console.start();
    h.console.key("x"); // pacing (getkey 0x83dc) → menú
    h.console.key("b"); // → lista de compra
    return h;
  }

  it("emite `\\n\"` + insulto rand(0,3) (DS 0x3cae) + `\"\\nyells $.` con el $ expandido", () => {
    const h = startBuy({ gold: 0 });
    h.rands.push(2); // → BLACKSMITH_BUY_BROKE[2] = "OUT, SLIME!"
    h.console.key("a");
    const out = h.lines.join("\n");
    expect(out).toContain(`\n"${BLACKSMITH_BUY_BROKE[2]}"\nyells Keeper.\n`);
    expect(out).not.toContain(FABRICADA);
  });

  it("★ el insulto sale de la TABLA, no de una constante: otro rand ⇒ otro texto", () => {
    // Control discriminante: sin él, un port que emitiera SIEMPRE el mismo
    // insulto pasaría el caso de arriba.
    const h = startBuy({ gold: 0 });
    h.rands.push(0);
    h.console.key("a");
    expect(h.lines.join("\n")).toContain(BLACKSMITH_BUY_BROKE[0]);
    expect(h.lines.join("\n")).not.toContain(BLACKSMITH_BUY_BROKE[2]);
  });

  it("ret −1 (0x0aa4): la SESIÓN termina — no se vuelve a la lista", () => {
    const h = startBuy({ gold: 0 });
    h.console.key("a");
    expect(h.closed()).toBe(true);
  });

  it("control POSITIVO: con oro NO sale insulto y la sesión sigue", () => {
    const h = startBuy({ gold: 9999 });
    h.console.key("a");
    expect(h.lines.join("\n")).not.toContain("yells");
    expect(h.closed()).toBe(false);
  });
});

describe("reactivos y gremio sin pool (b) — el registro NO está, así que no se dice nada", () => {
  it("reactivos: ni fabricación ni texto inventado, y la sesión termina (0x0617)", () => {
    const h = makeHarness("MagicSeller", { location: 1, gold: 0 });
    h.console.start(); // sin pool → renderMenu → renderReagentList
    h.console.key("a");
    expect(h.lines.join("\n")).not.toContain(FABRICADA);
    expect(h.closed()).toBe(true);
  });

  it("gremio: ídem (0x036e)", () => {
    const h = makeHarness("GuildMaster", { location: 8, gold: 0 });
    h.console.start();
    h.console.key("a");
    expect(h.lines.join("\n")).not.toContain(FABRICADA);
    expect(h.closed()).toBe(true);
  });

  it("★ con pool SÍ se emite el registro derivado (147 / 163) — la vía no está muerta", () => {
    const pool = Array.from({ length: 200 }, (_, i) => `REG${i}`);
    const hr = makeHarness("MagicSeller", { location: 1, gold: 0, pool });
    hr.console.start();
    hr.console.key("y"); // gate del saludo
    hr.console.key("a");
    hr.console.key("y"); // «Is this thy need?»
    expect(hr.lines.join("\n")).toContain("REG147");
  });
});

describe("sanador sin pool — caridad de Skara Brae y registro 173", () => {
  // FÁBRICA, no constante: el arnés MUTA el personaje, y una fixture compartida
  // haría que el caso de caridad dejase curado al herido de los otros dos.
  const herido = () => [
    { intelligence: 15, name: "Avatar", status: "G", partyStatus: 0, gender: 0x0b, currentHp: 1, maxHp: 30 },
  ];

  it("sin oro y FUERA de Skara Brae: sin fabricación, y NADA se cura (0x14ce ⇒ declinado)", () => {
    const h = makeHarness("Healer", { location: 5, gold: 0, characters: herido() });
    h.console.start();
    h.console.key("h");
    h.console.key("a");
    expect(h.lines.join("\n")).not.toContain(FABRICADA);
    expect(h.state.characters as unknown as ReturnType<typeof herido>).toEqual([
      expect.objectContaining({ currentHp: 1 }),
    ]);
  });

  it("★ CARIDAD (0x14c2/0x14c7): en Skara Brae (7) y precio ≤ 100 el servicio se hace GRATIS", () => {
    const h = makeHarness("Healer", { location: 7, gold: 0, characters: herido() });
    h.console.start();
    h.console.key("h");
    h.console.key("a");
    expect((h.state.characters as unknown as ReturnType<typeof herido>)[0]!.currentHp).toBe(30);
    expect(h.state.gold).toBe(0); // caridad: sin pago NI merma
  });

  it("control discriminante: MISMO precio, otra ciudad ⇒ NO hay caridad", () => {
    const h = makeHarness("Healer", { location: 5, gold: 0, characters: herido() });
    h.console.start();
    h.console.key("h");
    h.console.key("a");
    expect((h.state.characters as unknown as ReturnType<typeof herido>)[0]!.currentHp).toBe(1);
  });
});
