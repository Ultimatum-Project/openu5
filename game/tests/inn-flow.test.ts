/**
 * F2-T2 (espejo fase 2) — Posada: cadenas FIELES de REST y LEAVE (SHOPPES3.OVL
 * 0x0072 / 0x02ae), antes ejecutadas «en seco» por el motor sin presentación.
 *
 * Derivación instrucción a instrucción (ver SHOP_UI inn* en cmd-strings.ts y
 * INN_PITCH_INDEX en shoppe-greetings.ts):
 *  - REST: eco 'R' → aforo (helper 0x2c: llena → `"I am sorry,\n`+sir/milady+
 *    `…no room available."`) → `"` + pitch por-posada (tabla DS 0x4e6e →
 *    shoppe.json[186..190], % = rate·party con haggle) + `\nWilt thou take\nit?" `
 *    → Y/N: N → despedida; Y sin oro → `"Highwaymen!…OUT!" screams $.`; Y →
 *    `"Have a pleasant night, sir/milady!" says $.` → cama → `Zzzzzz....` →
 *    reloj a las 6:00 → `Morning!\n` (+ `<nombre> has passed away.` por
 *    envenenado) → paso fuera de la cama → despedida.
 *  - LEAVE: eco 'L' → aforo → party de 1 → shoppe.json[191] y fuera → bucle
 *    `$ asks,\n"Who will\nstay?" ` + select de roster (0x4cae): cancel →
 *    `Nobody`; Avatar → `Thy friend[s] will not leave thee!` y re-pregunta;
 *    muerto → shoppe.json[192] y fuera; vivo → `"The rate for\nour most
 *    comfortable room will be ` + `% gold per month, due at check-out.` +
 *    `Wilt thou take it?" ` → Y → motor + `"I thank thee." says $.` → epílogo.
 * Testigos: aulddragon P05 ~2440 (REST, King's Ransom Inn) / P19 ~350 (LEAVE,
 * Smugglers' Inn). Precios: SHOPPES3 0x95-0xd1 (rest) / 0x378-0x3a9 (leave).
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { GameState } from "../src/core/state.js";
import { innNightPass, type ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

/** Pool sintético; los registros de posada llevan % para ver la expansión. */
const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
POOL[186] = 'room for % gp"'; // pitch Britain (townIndex 0)
POOL[191] = 'not in my inn"'; // leave con party de 1
POOL[192] = 'get that corpse out"'; // leave de un muerto

interface Char {
  name: string;
  status: string;
  partyStatus: number;
  intelligence: number;
  gender?: number;
  class?: string;
  currentHp?: number;
  maxHp?: number;
  currentMp?: number;
  monthsAtInn?: number;
}

interface HarnessOver {
  gold?: number;
  /** Hora/minuto de arranque (el bucle nocturno depende de ambos: SHOPPES3 0x1b5-0x1f4). */
  hour?: number;
  minute?: number;
  /** Minutos de antorcha encendida (`g_torch_turns`): el bucle los consume. */
  torchTurns?: number;
  /** Localizaciones de los 3 Shadowlords: el cruce de medianoche las re-sortea. */
  shadowlordLocs?: number[];
}

function makeHarness(chars: Char[], over: HarnessOver = {}) {
  const lines: string[] = [];
  let closed = false;
  const picker: { calls: number; select?: (i: number) => void; cancel?: () => void } = {
    calls: 0,
  };
  const state = {
    time: {
      year: 139,
      month: 4,
      day: 7,
      hour: over.hour ?? 9,
      minute: over.minute ?? 0,
    },
    position: { location: 2, floor: 0, x: 3, y: 3 }, // Britain = posada townIndex 0
    characters: chars,
    partySize: chars.filter((c) => c.partyStatus === 0).length,
    equipmentQuantities: new Array(48).fill(0),
    gold: over.gold ?? 100,
    torchTurns: over.torchTurns ?? 0,
    shadowlordLocs: over.shadowlordLocs,
    reagentPatchFoundDay: [0, 0, 0],
    skullTreeFoundDay: 0,
  };
  /** Tiradas consumidas por la noche (para medir el movimiento del stream). */
  const rolls: number[] = [];
  let seq = 0;
  const rand = (lo: number, hi: number): number => {
    rolls.push(seq);
    const span = hi - lo + 1;
    return lo + (seq++ % span);
  };
  const hourTileCalls: number[] = [];
  /**
   * #158 — traza del SNAP de NPCs del despertar. Guarda el nº de líneas emitidas EN EL
   * MOMENTO de la llamada, que es lo que permite asertar el ORDEN contra «Morning!»
   * (el binario llama en SHOPPES3 0x01fd, la instrucción siguiente al print de 0x01fa).
   */
  const npcSnapAtLine: number[] = [];
  const game = {
    state,
    shopGreetingRand: () => 0,
    shopPostPurchaseDrain: () => {},
    wakeSnapNpcs: () => {
      npcSnapAtLine.push(lines.length);
    },
    /**
     * Espejo headless de `Game.innSleepUntilMorning` (game.ts): el conductor de
     * tienda delega el bucle nocturno en el Game porque necesita el stream VIVO y
     * el refresco de la capa horaria. Aquí se cablea a la MISMA función pura, con
     * un rand determinista, para que el test mida el bucle real y no un doble.
     */
    innSleepUntilMorning: () =>
      innNightPass(state as unknown as GameState, rand, () => {
        hourTileCalls.push(state.time.hour);
      }),
  } as unknown as Game;
  const info = { keeperName: "Ransack", shopName: "Inn" } as ShoppeKeeperInfo;
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
    pickMember: (onSelect, onCancel) => {
      picker.calls++;
      picker.select = onSelect;
      picker.cancel = onCancel;
    },
  };
  const console_ = new ShopConsole("InnKeeper", deps);
  // Saludo + gate 'Y' → menú R/L/P (SHOPPES3 0x8f8-0x922).
  console_.start();
  console_.key("y");
  lines.length = 0; // limpia saludo/menú: los asserts miran las cadenas nuevas
  return {
    console: console_,
    lines,
    state,
    picker,
    closed: () => closed,
    rolls,
    hourTileCalls,
    npcSnapAtLine,
  };
}

const avatar = (over: Partial<Char> = {}): Char => ({
  name: "Avatar",
  status: "G",
  partyStatus: 0,
  intelligence: 15,
  gender: 0x0b,
  class: "A",
  currentHp: 10,
  maxHp: 30,
  currentMp: 0,
  ...over,
});
const iolo = (over: Partial<Char> = {}): Char => ({
  name: "Iolo",
  status: "G",
  partyStatus: 0,
  intelligence: 12,
  gender: 0x0b,
  class: "B",
  currentHp: 5,
  maxHp: 20,
  currentMp: 0,
  ...over,
});

describe("F2-T2 — REST (SHOPPES3 0x0072)", () => {
  it("pitch por-posada con % = rate·party con haggle + «Wilt thou take it?»", () => {
    const h = makeHarness([avatar()]);
    h.console.key("r");
    const all = h.lines.join("|");
    expect(all).toContain("R"); // eco (putchar 0x52)
    // Britain rate 2 × party 1 = 2; haggle INT 15: 2 + trunc(2·55/100) = 3.
    expect(all).toContain('room for 3 gp"');
    expect(all).toContain('\nWilt thou take\nit?" ');
    expect(h.console.snapshot().phase).toBe("inn-rest-take");
  });

  it("posada LLENA (aforo 0x2c): disculpa con género + epílogo, sin pitch", () => {
    const guests = [avatar()].concat(
      Array.from({ length: 3 }, (_, i) => iolo({ name: `G${i}`, partyStatus: 2 })),
    );
    const h = makeHarness(guests); // capacidad Britain = 3, ya 3 huéspedes
    h.console.key("r");
    const all = h.lines.join("|");
    expect(all).toContain('"I am sorry,\n');
    expect(all).toContain("sir"); // género 0x0b
    expect(all).toContain(', but we\nhave no room\navailable."\n\n');
    expect(all).not.toContain("room for");
    expect(h.console.snapshot().phase).toBe("inn-again"); // ret -2 → epílogo 0x992
  });

  it("'Y' con oro: pleasant night + Zzz + reloj a las 6:00 + Morning! + cama y paso fuera", () => {
    const h = makeHarness([avatar({ gender: 0x0c })]);
    h.console.key("r");
    h.lines.length = 0;
    h.console.key("y");
    const all = h.lines.join("|");
    expect(all).toContain("Yes");
    expect(all).toContain('"Have a pleasant\nnight, ');
    expect(all).toContain("milady"); // género 0x0c (testigo P05)
    expect(all).toContain("Zzzzzz....\n\n");
    expect(all).toContain("Morning!\n");
    expect(h.state.gold).toBe(97); // 100 − 3
    expect(h.state.time.hour).toBe(6);
    // El minuto de despertar NO es 0: el bucle avanza de 9 en 9 y sale al PRIMER
    // aterrizaje dentro de la hora 6 (SHOPPES3 0x1d7 `advance_clock(9)` + 0x1ef
    // `cmp g_hour,6`). Desde las 9:00 → pre-bucle a las 10:00 → 134 pasos de 9 →
    // 6:06 del día siguiente.
    expect(h.state.time.minute).toBe(6);
    // Cama de Britain (INN_ROOM_X/Y[0]) + inc g_party_x al despertar (0x28b).
    expect(h.state.position.y).not.toBe(3);
    expect(h.closed()).toBe(true); // ret -1 → despedida y cierre
    // El descanso CURA (HP=max) — motor intacto.
    expect(h.state.characters[0]!.currentHp).toBe(30);
  });

  it("'Y' sin oro: «Highwaymen!…OUT!» screams $ y sesión fuera (0x108)", () => {
    const h = makeHarness([avatar()], { gold: 1 });
    h.console.key("r");
    h.lines.length = 0;
    h.console.key("y");
    const all = h.lines.join("|");
    expect(all).toContain('"Highwaymen!\nCheap, at that!\nOUT!" ');
    expect(all).toContain("screams\nRansack.\n"); // $ expandido
    expect(h.state.gold).toBe(1); // sin cobro
    expect(h.closed()).toBe(true);
  });

  it("envenenado MUERE durmiendo: '\\n'+nombre+' has passed away.' tras Morning!", () => {
    const h = makeHarness([avatar(), iolo({ status: "P" })]);
    h.console.key("r");
    h.console.key("y");
    const all = h.lines.join("|");
    expect(all).toContain("\nIolo has\npassed away.\n");
    expect(h.state.characters[1]!.status).toBe("D");
  });

  it("'N': eco No y sesión fuera con despedida (ret → 0x95f)", () => {
    const h = makeHarness([avatar()]);
    h.console.key("r");
    h.lines.length = 0;
    h.console.key("n");
    expect(h.lines.join("|")).toContain("No");
    expect(h.closed()).toBe(true);
  });
});

/**
 * AUD-A1 (#122) — la NOCHE de la posada corre el RELOJ DEL JUEGO, no aritmética de
 * calendario. Bucle SHOPPES3 0x01b5-0x01f4, derivado instrucción a instrucción:
 *
 *   01b5  [bp-8]=12 ; si=12
 *   01bd  bucle PRE:  advance_clock(5) ; dec si ; je 0x1ef      → 12×5 = 60 min
 *   01ca  bucle NOCHE: beep_ticks(1)                            (presentación, 0 rand)
 *   01d1               kernel_ring_regen  (kernel 0x400c)       → rand(0,7)/portador
 *   01d4               draw_status_panel  (kernel 0x2900)       (presentación)
 *   01d7               advance_clock(9)   (kernel 0x4f7c)       → 9 min
 *   01de               si g_hour==0x14 ó ==5 → 0x7a9a           (stub → TOWN 0x0170)
 *   01ef               mientras g_hour != 6 → 0x1ca
 *
 * Resolución de los dos `call 0xffff98xx`: SHOPPES3 está en la BANDA 4
 * (`near_call_base` 0xe1e0, overlay-load-layout.md §1), luego 0x98ba → CS 0x7a9a y
 * 0x98ae → CS 0x7a8e; ambos caen en la banda de stubs [0x7a16,0x81c6) y su
 * `ljmp` los lleva a TOWN.OVL 0x0170 (`town_time_tile_transform`, ya portado en
 * world/townHourTiles.ts) y TOWN.OVL 0x1694 (`npc_activate_all_town`).
 * Control de la base: 0x6d9c → CS 0x4f7c = `advance_clock`, la rutina que la
 * propia tarjeta nombra.
 */
describe("AUD-A1 — bucle nocturno de posada (SHOPPES3 0x01b5-0x01f4)", () => {
  it("consume la ANTORCHA en minutos: 60 del pre-bucle + 9 por paso", () => {
    // 21:00 → pre-bucle a 22:00 → 54 pasos de 9 → 6:06. Total 60+486 = 546 min.
    const h = makeHarness([avatar()], { hour: 21, torchTurns: 600 });
    h.console.key("r");
    h.console.key("y");
    expect(h.state.time.hour).toBe(6);
    expect(h.state.time.minute).toBe(6);
    expect(h.state.torchTurns).toBe(600 - 546);
  });

  it("una antorcha recién encendida (240 min) se APAGA durante la noche", () => {
    const h = makeHarness([avatar()], { hour: 21, torchTurns: 240 });
    h.console.key("r");
    h.console.key("y");
    expect(h.state.torchTurns).toBe(0); // clamp0 de advanceClock (0x4fb4)
  });

  it("el cruce de MEDIANOCHE re-sortea los Shadowlords y mueve el stream", () => {
    const h = makeHarness([avatar()], { hour: 21, shadowlordLocs: [1, 2, 3] });
    h.console.key("r");
    h.console.key("y");
    // 21:00 → la noche cruza las 00:00 exactamente una vez (0x4ff5).
    expect(h.state.shadowlordLocs).not.toEqual([1, 2, 3]);
    expect(h.rolls.length).toBeGreaterThan(0);
  });

  it("sin cruzar medianoche NO hay re-sorteo (control negativo)", () => {
    // 1:00 → pre-bucle a 2:00 → pasos de 9 hasta las 6:0x, sin pasar por 00:00.
    const h = makeHarness([avatar()], { hour: 1, shadowlordLocs: [1, 2, 3] });
    h.console.key("r");
    h.console.key("y");
    expect(h.state.time.hour).toBe(6);
    expect(h.state.shadowlordLocs).toEqual([1, 2, 3]);
    expect(h.rolls.length).toBe(0); // sin portador del anillo, el barrido no tira
  });

  it("el minuto de despertar depende del MINUTO de entrada (0-8), no es 0", () => {
    // 21:05 → 22:05 → 53 pasos de 9 = 477 min → 6:02.
    const h = makeHarness([avatar()], { hour: 21, minute: 5 });
    h.console.key("r");
    h.console.key("y");
    expect(h.state.time.hour).toBe(6);
    expect(h.state.time.minute).toBe(2);
  });

  it("el PRE-bucle corre ANTES del primer `cmp g_hour,6`: 5:30 → despierta a las 6:30", () => {
    // 0x1c5 `je 0x1ef` entra al check YA con la hora avanzada 60 min: a las 6:30 el
    // bucle de 9 no llega a ejecutarse ni una vez, y el minuto NO cae en [0,8].
    const h = makeHarness([avatar()], { hour: 5, minute: 30 });
    h.console.key("r");
    h.console.key("y");
    expect(h.state.time.hour).toBe(6);
    expect(h.state.time.minute).toBe(30);
  });

  it("ficha la capa horaria de reja/puente al pasar por las 20 y las 5 (0x7a9a → TOWN 0x0170)", () => {
    const h = makeHarness([avatar()], { hour: 19 });
    h.console.key("r");
    h.console.key("y");
    // El binario llama en CADA iteración cuya hora resultante sea 20 ó 5, no sólo
    // en la transición: ambas horas quedan fichadas.
    expect(h.hourTileCalls).toContain(20);
    expect(h.hourTileCalls).toContain(5);
    expect(h.hourTileCalls.every((x) => x === 20 || x === 5)).toBe(true);
  });
});

describe("#158 — SNAP de NPCs al despertar (SHOPPES3 0x01fd → stub 0x7a8e → TOWN 0x1694)", () => {
  it("el despertar LLAMA al snap, exactamente UNA vez", () => {
    const h = makeHarness([avatar()], { hour: 21 });
    h.console.key("r");
    h.console.key("y");
    expect(h.npcSnapAtLine).toHaveLength(1);
  });

  it("★ ORDEN: el snap va DESPUÉS de «Morning!», como 0x01fd tras el print de 0x01fa", () => {
    const h = makeHarness([avatar()], { hour: 21 });
    h.console.key("r");
    h.console.key("y");
    const morningIdx = h.lines.findIndex((l) => l.includes("Morning!"));
    expect(morningIdx).toBeGreaterThanOrEqual(0); // control: el mensaje se emitió
    // npcSnapAtLine[0] = nº de líneas ya emitidas cuando se llamó ⇒ si es > morningIdx,
    // «Morning!» ya estaba fuera. Un snap metido dentro de innSleepUntilMorning daría <=.
    expect(h.npcSnapAtLine[0]!).toBeGreaterThan(morningIdx);
  });

  it("CONTROL NEGATIVO: si NO se descansa (salir del menú) el snap NO se llama", () => {
    const h = makeHarness([avatar()], { hour: 21 });
    h.console.key("x"); // tecla que no es R/L/P
    expect(h.npcSnapAtLine).toHaveLength(0);
  });
});

describe("F2-T2 — LEAVE (SHOPPES3 0x02ae)", () => {
  it("party de 1: registro «not in my inn» (ptr 0x26e8) y sesión fuera", () => {
    const h = makeHarness([avatar()]);
    h.console.key("l");
    expect(h.lines.join("|")).toContain('not in my inn"');
    expect(h.closed()).toBe(true);
  });

  it("«Who will stay?» ($ expandido) + roster; cancel → Nobody + epílogo", () => {
    const h = makeHarness([avatar(), iolo()]);
    h.console.key("l");
    expect(h.lines.join("|")).toContain('Ransack asks,\n"Who will\nstay?" ');
    expect(h.picker.calls).toBe(1);
    h.lines.length = 0;
    h.picker.cancel!();
    expect(h.lines.join("|")).toContain("Nobody\n\n");
    expect(h.console.snapshot().phase).toBe("inn-again");
  });

  it("elegir al Avatar: «Thy friend will not leave thee!» y re-pregunta (0x486→0x301)", () => {
    const h = makeHarness([avatar(), iolo()]);
    h.console.key("l");
    h.lines.length = 0;
    h.picker.select!(0);
    expect(h.lines.join("|")).toContain("Thy friend will not leave thee!\n\n");
    expect(h.picker.calls).toBe(2); // re-pregunta
  });

  it("party>2 usa el plural «Thy friends…» (putchar 's' 0x343)", () => {
    const h = makeHarness([avatar(), iolo(), iolo({ name: "Shamino" })]);
    h.console.key("l");
    h.picker.select!(0);
    expect(h.lines.join("|")).toContain("Thy friends will not leave thee!\n\n");
  });

  it("elegir un muerto: registro «corpse» (ptr 0x2723) y sesión fuera", () => {
    const h = makeHarness([avatar(), iolo({ status: "D" })]);
    h.console.key("l");
    h.picker.select!(1);
    expect(h.lines.join("|")).toContain('get that corpse out"');
    expect(h.closed()).toBe(true);
  });

  it("tarifa mensual (rate·10 haggle) + confirm: Y → «I thank thee.» + epílogo + mutación", () => {
    const h = makeHarness([avatar(), iolo()]);
    h.console.key("l");
    h.lines.length = 0;
    h.picker.select!(1);
    const all = h.lines.join("|");
    // Britain rate 2 → mensual base 20; haggle INT 15: 20 + trunc(20·55/100) = 31.
    expect(all).toContain('"The rate for\nour most comfortable room will be ');
    expect(all).toContain("31 gold per month, due at check-out.");
    expect(all).toContain('\nWilt thou take\nit?" ');
    expect(h.console.snapshot().phase).toBe("inn-leave-take");
    h.lines.length = 0;
    h.console.key("y");
    const after = h.lines.join("|");
    expect(after).toContain("Yes");
    expect(after).toContain('"I thank thee."\nsays Ransack.\n\n');
    expect(h.console.snapshot().phase).toBe("inn-again"); // ret 1 → epílogo (testigo P19)
    expect(h.state.characters[1]!.partyStatus).toBe(2); // hospedado en Britain
    expect(h.state.partySize).toBe(1);
    expect(h.state.gold).toBe(100); // NO cobra ahora (se cobra al recoger)
  });

  it("confirm 'N': eco No + epílogo, sin mutación", () => {
    const h = makeHarness([avatar(), iolo()]);
    h.console.key("l");
    h.picker.select!(1);
    h.lines.length = 0;
    h.console.key("n");
    expect(h.lines.join("|")).toContain("No");
    expect(h.console.snapshot().phase).toBe("inn-again");
    expect(h.state.characters[1]!.partyStatus).toBe(0);
  });
});
