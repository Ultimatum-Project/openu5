/**
 * F2-T10 (espejo fase 2) — Taberna: menú REAL por subtipo + cadena de RACIONES
 * (SHOPPES2.OVL 0x066c / 0x0380), antes el genérico «Buy a Round, Wine,
 * Rations, or hear a Rumor?» (paráfrasis [C] retirada).
 *
 * Derivación (TAVERN_* en shoppe-greetings.ts, SHOP_UI tavern* en cmd-strings):
 *  - menú = `Yes\n\n"` (DS 0x9f92) + registro por SUBTIPO (bd16 = DS 0x4d4c[town];
 *    inicial DS 0x4d56 → shoppe.json 69..72, re-visita DS 0x4d5e → 73..76) + `" `;
 *    teclas por subtipo (DS 0x4c1e/24/2a/30): p.ej. subtipo 0 = M/A/R/C.
 *  - raciones (0x380): eco tecla + pitch 1-de-7 (rand(0,6) VIVO, 77..83, % =
 *    precio haggle) + «How many wouldst thou like?» (DS 0x9c4a) + cantidad;
 *    0 → «Hrumph.» (ret 2); sin oro total → echado (scraps si comida<3 / «Out!»);
 *    parcial → «Thou canst afford only N!»; ok → epílogo.
 *  - epílogo (0x78b): «Anything else for thee?» → Y = menú RE-VISITA / N =
 *    despedida; sirve → [0xbd18]=1 (desbloquea el Chat, 0x756).
 * Testigo: aulddragon P04 ~1740 (Tika, Wayfarer Tavern = Britain, subtipo 0).
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
POOL[69] = "What'll it be... Mutton, Ale, or Rations?";
POOL[73] = 'Shall I bring thee more Ale or roast Mutton, or just Chat?';
POOL[79] = '25 servings for % gold!';
POOL[90] = 'table scraps! Now go!"\norders $.\n';

function makeHarness(
  over: {
    gold?: number;
    food?: number;
    rands?: number[];
    location?: number;
    party?: number;
    karma?: number;
  } = {},
) {
  const lines: string[] = [];
  let closed = false;
  const texts: { prefix: string; resolve?: (t: string) => void }[] = [];
  const rands = over.rands ?? [0];
  const state = {
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
    // loc 2 = taberna townIndex 1 → subtipo 0 (Ale). loc 19 = townIndex 5 → subtipo 1,
    // la ÚNICA con carta de vinos (`DS 0x4c24[1] == 'W'`).
    position: { location: over.location ?? 2, floor: 0, x: 3, y: 3 },
    characters: Array.from({ length: over.party ?? 1 }, (_, i) => ({
      name: `P${i}`,
      status: "G",
      partyStatus: 0,
      intelligence: 15,
      gender: 0x0b,
    })),
    partySize: over.party ?? 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: over.gold ?? 500,
    food: over.food ?? 100,
    karma: over.karma ?? 50,
    drunkTurns: undefined as number | undefined,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, _hi: number) => (rands.length ? rands.shift()! : lo),
    shopPostPurchaseDrain: () => {},
  } as unknown as Game;
  const info = { keeperName: "Tika", shopName: "Wayfarer" } as ShoppeKeeperInfo;
  const deps: ShopConsoleDeps = {
    game,
    shopData: { equipmentBasePrices: [], weaponsSoldByMerchants: [] } as unknown as ShopData,
    info,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: (prefix, _max, resolve) => {
      texts.push({ prefix, resolve });
    },
    close: () => {
      closed = true;
    },
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  const console_ = new ShopConsole("Barkeeper", deps);
  console_.start();
  console_.key("y"); // gate → menú fiel
  return { console: console_, lines, state, texts, closed: () => closed };
}

describe("F2-T10 — menú por subtipo (SHOPPES2 0x6aa)", () => {
  it("gate 'Y': `Yes\\n\\n\"` + registro 69 (Britain subtipo 0) + `\" ` y teclas M/A/R/C", () => {
    const h = makeHarness();
    const all = h.lines.join("|");
    expect(all).toContain('Yes\n\n"' + "What'll it be... Mutton, Ale, or Rations?" + '" ');
    expect(h.console.snapshot().phase).toBe("tavern-menu");
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["m", "a", "r", "c"]);
  });

  it("el Chat está GATED a haber servido ([0xbd18] 0x756): antes se ignora", () => {
    const h = makeHarness();
    h.lines.length = 0;
    h.console.key("c"); // chat sin servir → ignorada
    expect(h.texts).toHaveLength(0); // no abre el getstring del rumor
    expect(h.console.snapshot().phase).toBe("tavern-menu");
  });
});

describe("F2-T10 — cadena de raciones (SHOPPES2 0x380, testigo P04)", () => {
  it("'R': eco + pitch con % (rand vivo) + «How many wouldst thou like?» + getstring", () => {
    const h = makeHarness({ rands: [0, 2] }); // [saludo, rand(0,6)=2 → registro 79]
    h.lines.length = 0;
    h.console.key("r");
    const all = h.lines.join("|");
    expect(all).toContain("R\n\n");
    // Britain raciones base 15; INT 15 → 15 + trunc(15·55/100) = 23.
    expect(all).toContain("25 servings for 23 gold!");
    expect(all).toContain('\n\nHow many wouldst\nthou like?" ');
    expect(h.texts).toHaveLength(1); // cantidad (getstring numérico)
  });

  it("cantidad 10 con oro: compra 10×(+25 comida) y epílogo «Anything else for thee?»", () => {
    const h = makeHarness({ rands: [0, 2] });
    h.console.key("r");
    h.lines.length = 0;
    h.texts[0]!.resolve!("10");
    expect(h.state.gold).toBe(500 - 23 * 10);
    expect(h.state.food).toBe(100 + 250);
    expect(h.lines.join("|")).toContain('"Anything else\nfor thee?" ');
    expect(h.console.snapshot().phase).toBe("tavern-again");
    // Y → menú de RE-VISITA (registro 73).
    h.lines.length = 0;
    h.console.key("y");
    expect(h.lines.join("|")).toContain("Shall I bring thee more Ale or roast Mutton");
    expect(h.console.snapshot().phase).toBe("tavern-menu");
    // …y ahora el Chat SÍ responde (servido).
    h.console.key("c");
    expect(h.texts).toHaveLength(2); // getstring del rumor abierto
  });

  it("cantidad 0: «Hrumph.» (ret 2) — epílogo SIN desbloquear el chat", () => {
    const h = makeHarness();
    h.console.key("r");
    h.lines.length = 0;
    h.texts[0]!.resolve!("0");
    expect(h.lines.join("|")).toContain('\n\n"Hrumph."');
    expect(h.console.snapshot().phase).toBe("tavern-again");
    h.console.key("y"); // re-visita
    h.console.key("c"); // chat sigue bloqueado
    expect(h.texts).toHaveLength(1);
  });

  it("parcial sin oro: «Thou canst afford only N!» y epílogo", () => {
    const h = makeHarness({ gold: 50 }); // 50/23 = 2 unidades
    h.console.key("r");
    h.lines.length = 0;
    h.texts[0]!.resolve!("10");
    const all = h.lines.join("|");
    expect(all).toContain('"Thou canst\nafford only 2!"\n\n');
    expect(h.state.gold).toBe(50 - 46);
    expect(h.console.snapshot().phase).toBe("tavern-again");
  });

  it("0 unidades y comida>=3: «neither gold nor need! Out!» yells Tika — echado sin despedida", () => {
    const h = makeHarness({ gold: 5, food: 100 });
    h.console.key("r");
    h.lines.length = 0;
    h.texts[0]!.resolve!("5");
    const all = h.lines.join("|");
    expect(all).toContain('"Thou hast\nneither gold nor\nneed! Out!"\n');
    expect(all).toContain("yells Tika.\n");
    expect(h.closed()).toBe(true);
    expect(all.split("|").filter((l) => l.startsWith("T"))).toEqual([]); // sin pool de despedida
  });

  it("0 unidades y comida<3: limosna rand(0,1)+1 + «table scraps! Now go!» orders $", () => {
    const h = makeHarness({ gold: 5, food: 1, rands: [0, 2, 1] }); // [saludo, pitch, limosna rand=1]
    h.console.key("r");
    h.lines.length = 0;
    h.texts[0]!.resolve!("5");
    const all = h.lines.join("|");
    expect(all).toContain('table scraps! Now go!"\norders Tika.\n');
    expect(h.state.food).toBe(1 + 2); // rand(0,1)=1 → +2 (0x493)
    expect(h.closed()).toBe(true);
  });
});

/**
 * #21 — LA OPCIÓN 2 NO ES «VINO»: ES LA BEBIDA, y su desenlace depende del SUBTIPO.
 *
 * Binario (SHOPPES2 0x01f4, cuerpo leído en este carril):
 *   0x0200 eco de la letra `DS 0x4c24[subtipo]` — la tabla es 'A' 'W' 'R' 'S'
 *   0x020a gate de borrachera `cmp [g_cups_served], 3` (ANTES del discriminante)
 *   0x026f `mov ax, 1` / `call 0`  → acumula a 1 pieza POR CABEZA
 *   0x027c `cmp byte ptr [bx + 0x4c24], 0x57` ('W') / `je 0x286`
 *          · 'W' → carta de SEIS vinos (0x286-0x2c8) + `Thy choice?`
 *          · otra → 0x0372 `mov [g_alive_a], 0` + `call 0xdc` = RONDA DE LA CASA
 * Y `g_alive_a = 0` hace que la cuenta (0x014a `je 0x1c4`) no dé comida ni plato y
 * cuente una copa — pero la frase sigue diciendo el nº de vivos porque lee `g_alive_b`.
 *
 * Denominador MEDIDO en DATA.OVL: la lista de tabernas `DS 0x23da` son NUEVE
 * (1 2 3 4 8 19 22 24 30) y la de subtipos `DS 0x4d4c` da 0,0,0,2,3,1,0,2,0 ⇒ el
 * subtipo 1 aparece UNA vez (ciudad 19). El clon abría la carta en las nueve.
 */
describe("#21 — carta de vinos SÓLO en el subtipo 'W'; en el resto, ronda de la casa", () => {
  it("subtipo 1 (ciudad 19): la tecla de bebida SÍ despliega la carta de vinos", () => {
    const h = makeHarness({ location: 19 });
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["c", "w", "t"]);
    h.console.key("w");
    expect(h.console.snapshot().phase).toBe("wine-list");
    expect(h.console.snapshot().options).toHaveLength(6); // seis vinos (0x28d-0x2c1)
  });

  it("subtipo 0 (Britain): la MISMA opción sirve una RONDA a 1 pieza por vivo, sin lista", () => {
    const h = makeHarness({ location: 2, party: 3, gold: 500 });
    const goldBefore = h.state.gold;
    const foodBefore = h.state.food;
    h.lines.length = 0;
    h.console.key("a"); // letra de la opción 2 del subtipo 0 ('A' de Ale)
    // NO hay carta: se sirve y se pasa al epílogo.
    expect(h.console.snapshot().phase).not.toBe("wine-list");
    expect(h.console.snapshot().phase).toBe("tavern-again");
    // 1 pieza POR CABEZA (0x026f), no el precio de la ronda de COMIDA de Britain (4).
    expect(goldBefore - h.state.gold).toBe(3);
    // `g_alive_a = 0` ⇒ ni comida ni plato (la rama de la comida queda al otro lado).
    expect(h.state.food).toBe(foodBefore);
    // …pero la frase dice el nº de vivos, que sale de `g_alive_b` (§36.1/§41).
    expect(h.lines.join("|")).toContain(" gold for the three of ye,");
  });

  it("la ronda de la casa CUENTA como copa (inc 0x01c4) — la 4ª dispara el gate de borrachera", () => {
    const h = makeHarness({ location: 2, party: 1, gold: 500 });
    for (let i = 0; i < 3; i++) {
      h.console.key("a");
      h.console.key("y"); // «Anything else?» → menú de re-visita
    }
    expect(h.state.karma).toBe(50); // tres rondas: aún sin castigo
    expect(h.state.drunkTurns).toBeUndefined();
    h.console.key("a"); // 4ª: served == 3 ⇒ gate
    // ★ #325 — el gate es INTERACTIVO y alcanza también a esta rama, porque vive en
    // `0x020a`, antes del discriminante `'W'` de `0x027c`. Antes se aplicaba solo,
    // en silencio y en el pago; ahora emite el aviso y ESPERA tecla, y el castigo
    // cuelga de la rama `'N'` (0x024c-0x0260). Contestar `'Y'` no castiga y no sirve.
    expect(h.state.drunkTurns).toBeUndefined(); // todavía no: falta responder
    expect(h.lines.join("|")).toContain("But haven't");
    h.console.key("n"); // «No!» → castigo y continúa a servir
    expect(h.state.drunkTurns).toBe(0x19); // timer 25 (0x0253 `mov [0x5957], 0x19`)
    expect(h.state.karma).toBe(49); // karma −1 con suelo 0 (byte_sub_saturating, 0x0260)
  });

  it("sin oro: el tabernero canta el precio IGUAL y luego echa, sin despedida", () => {
    const h = makeHarness({ location: 2, party: 2, gold: 1 });
    h.lines.length = 0;
    h.console.key("a");
    const out = h.lines.join("|");
    expect(out).toContain(" gold for the two of ye,"); // 0x00dc va ANTES del gate 0x0114
    expect(h.closed()).toBe(true);
    expect(out.split("|").filter((l) => l.startsWith("T"))).toEqual([]); // sin pool de despedida
  });
});
