/**
 * Carril cadenas-presentacion — lote de CADENAS DE PRESENTACIÓN doble-testificadas
 * (espejo P08 C1-C13 + diff-ocr-masivo huecos 1-3). Cubre las derivaciones nuevas:
 *
 *  · C2/diff-1 · compra de reactivo (buy_one_reagent SHOPPES 0x502): pitch por-slot
 *    (shoppe.json[139+slot], `%`=precio `^`=cantidad) + `Is this thy need?" ` Y/N,
 *    a-tope 0x549, sin-oro shoppe[147] → despedida SILENCIOSA (ret -1).
 *  · Gremio (0x4a2/0x3f6/0x2ba): gate + filas fijas + pitch + Interested?" + Sold!.
 *  · Establo (0x7be): escaneo ANTES del saludo, gate, pitch shoppe[104], Deal?".
 *  · C3 curandero (0x14f8/0x137c/0x146a): gate + nature-of-need + Who needs my aid?"
 *    + cotización `Wilt thou pay?" ` + caridad location 7 + gratis location 5 + epílogo.
 *  · C4 gates Y/N de saludo en los 7 tipos no-herrero.
 *  · C5 hazards.bridgeTrollAmbush expone rolledIndices para el preámbulo.
 *  · C7/C8 conversación: comillas del intérprete (TALK 0x4da) + What is thy name?".
 *
 * Pool sintético (las plantillas reales son asset de EA): registro i = `P<i>%^&$#@`-free
 * con marcadores para verificar la expansión.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShopType, ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import {
  GUILD_BROKE_INDEX,
  GUILD_EASTEREGG_INDEX,
  GUILD_PITCH_INDEX,
  HEALER_SORRY_INDEX,
  HORSE_PITCH_INDEX,
  MAGIC_SELLER_BROKE_INDEX,
  MAGIC_SELLER_PITCH_INDEX,
} from "../src/core/shops/shoppe-greetings.js";
import { bridgeTrollAmbush } from "../src/core/world/loops/hazards.js";
import type { GameState } from "../src/core/state.js";
import { furnitureSearchProse } from "../src/core/world/search.js";
import { Conversation, type TalkScript } from "../src/core/dialogue/conversation.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

/** Pool sintético: el registro i se reconoce por `P<i>` e incluye %/^/$ para la expansión. */
const POOL: string[] = Array.from({ length: 200 }, (_, i) => `P${i} price=% qty=^ by $`);

interface Harness {
  console: ShopConsole;
  lines: string[];
  closed: () => boolean;
  state: Record<string, unknown> & {
    gold: number;
    reagentQuantities: number[];
    keys: number;
    position: { location: number; floor: number; x: number; y: number };
    characters: Array<Record<string, unknown>>;
  };
  picker: { opens: number; select?: (i: number) => void; cancel?: () => void };
  stable: { free: boolean; horseCalls: number };
}

function makeHarness(type: ShopType, over: { location?: number; gold?: number; partySize?: number } = {}): Harness {
  const lines: string[] = [];
  let closed = false;
  const picker: Harness["picker"] = { opens: 0 };
  const stable = { free: true, horseCalls: 0 };
  const state = {
    time: { hour: 9, minute: 0 },
    position: { location: over.location ?? 2, floor: 0, x: 0, y: 0 },
    characters: [
      { intelligence: 15, name: "Avatar", status: "G", partyStatus: 0, gender: 0x0b, currentHp: 20, maxHp: 30 },
      { intelligence: 10, name: "Iolo", status: "G", partyStatus: 0, gender: 0x0b, currentHp: 10, maxHp: 25 },
    ],
    partySize: over.partySize ?? 1,
    equipmentQuantities: new Array(48).fill(0),
    reagentQuantities: new Array(8).fill(0),
    keys: 0,
    gems: 0,
    torches: 0,
    gold: over.gold ?? 500,
  };
  const game = {
    state,
    shopGreetingRand: () => 0,
    shopPostPurchaseDrain: () => {},
    stableSpotFree: () => stable.free,
    stableHorse: () => {
      stable.horseCalls++;
      state.gold -= 100; // simula el pago del core (buyHorse); el precio real no importa aquí
      return [];
    },
  } as unknown as Game;
  const info: ShoppeKeeperInfo = { keeperName: "Keeper", shopName: "Shoppe" } as ShoppeKeeperInfo;
  const shopData = {
    equipmentBasePrices: [],
    weaponsSoldByMerchants: [],
    reagentBasePrices: new Array(40).fill(10), // 5 towns × 8 slots (tabla plana town·8+slot)
    reagentQuantities: new Array(40).fill(4),
    healPrices: [35, 40, 45, 50, 55, 60, 65],
    curePrices: [20, 25, 30, 35, 40, 15, 10],
    resurrectPrices: [200, 215, 225, 237, 247, 249, 262],
  } as unknown as ShopData;
  const deps: ShopConsoleDeps = {
    game,
    shopData,
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
      picker.opens++;
      picker.select = onSelect;
      picker.cancel = onCancel;
    },
  };
  return { console: new ShopConsole(type, deps), lines, closed: () => closed, state: state as never, picker, stable };
}

const text = (h: Harness): string => h.lines.join("\n");

describe("C2/diff-1 — cadena de compra del reactivo (buy_one_reagent SHOPPES 0x502)", () => {
  it("letra → pitch del slot (%=precio, ^=cantidad) + `Is this thy need?\" ` y fase reagent-deal", () => {
    const h = makeHarness("MagicSeller", { location: 7 });
    h.console.start();
    expect(h.console.snapshot().phase).toBe("greet-yn");
    h.console.key("y");
    expect(h.console.snapshot().phase).toBe("reagent-list");
    const firstKey = h.console.snapshot().options[0]!.key;
    h.console.key(firstKey);
    expect(h.console.snapshot().phase).toBe("reagent-deal");
    const out = text(h);
    // pitch del slot 0 con la expansión completa: % = precio §0.1 (base 10, INT 15 →
    // 10+⌊10·55/100⌋ = 15), ^ = cantidad (4), $ = tendero.
    expect(out).toContain(`P${MAGIC_SELLER_PITCH_INDEX[0]} price=15 qty=4 by Keeper`);
    expect(out).toContain(' Is this thy need?" ');
  });

  it("'N' re-lista con `\"What else?`; 'Y' cobra, agradece y re-lista (SIN rands: pitch por slot)", () => {
    const h = makeHarness("MagicSeller", { location: 7 });
    h.console.start();
    h.console.key("y");
    const firstKey = h.console.snapshot().options[0]!.key;
    h.console.key(firstKey);
    const goldBefore = h.state.gold;
    h.console.key("n"); // 0x5f5
    expect(text(h)).toContain('No\n\n"What else?');
    expect(h.console.snapshot().phase).toBe("reagent-list");
    expect(h.state.gold).toBe(goldBefore);
    h.console.key(firstKey);
    h.console.key("y"); // 0x600: cobra + thanks + anything else
    expect(h.state.gold).toBeLessThan(goldBefore);
    expect(h.state.reagentQuantities.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(text(h)).toContain('\n"I thank thee!"\nsays Keeper.\n'); // DS 0x7988 con $ expandido
    expect(text(h)).toContain('"Anything else?');
    expect(h.console.snapshot().phase).toBe("reagent-list");
  });

  it("sin oro: `Yes` + registro shoppe[147] y la sesión TERMINA con despedida SILENCIOSA (ret -1)", () => {
    const h = makeHarness("MagicSeller", { location: 7, gold: 0 });
    h.console.start();
    h.console.key("y");
    const firstKey = h.console.snapshot().options[0]!.key;
    h.console.key(firstKey);
    const before = h.lines.length;
    h.console.key("y");
    expect(h.closed()).toBe(true);
    const tail = h.lines.slice(before).join("\n");
    expect(tail).toContain(`P${MAGIC_SELLER_BROKE_INDEX}`);
    // Despedida 0x202 arg=-1: NINGÚN registro de las tablas de despedida (61-68 taberna
    // aparte — aquí MagicSeller 131-138) tras el broke.
    expect(tail).not.toMatch(/P13[1-8] /);
  });

  it("a tope (qty 99): aviso 0x792c + getkey de PAUSA que descarta la tecla y re-lista", () => {
    const h = makeHarness("MagicSeller", { location: 7 });
    h.state.reagentQuantities.fill(99);
    h.console.start();
    h.console.key("y");
    const firstKey = h.console.snapshot().options[0]!.key;
    h.console.key(firstKey);
    expect(h.console.snapshot().phase).toBe("reagent-full-pause");
    expect(text(h)).toContain('"Thou canst not carry any more!"');
    h.console.key("q"); // cualquier tecla re-lista
    expect(h.console.snapshot().phase).toBe("reagent-list");
  });
});

describe("Gremio — gate + lista fija + pitch + Interested?\" (SHOPPES 0x4a2/0x3f6/0x2ba)", () => {
  const open = (over: Parameters<typeof makeHarness>[1] = {}) => {
    const h = makeHarness("GuildMaster", { location: 24, ...over }); // Buccaneer's Den
    h.console.start();
    expect(h.console.snapshot().phase).toBe("greet-yn");
    h.console.key("y");
    return h;
  };
  it("'Y' del gate: `We sell:` + filas a/b/c fijas + `Thy concern?\" `", () => {
    const h = open();
    expect(h.console.snapshot().phase).toBe("guild-list");
    const out = text(h);
    expect(out).toContain('"We sell:');
    expect(out).toContain("a.........Keys");
    expect(out).toContain("b.........Gems");
    expect(out).toContain("c......Torches");
    expect(out).toContain('Thy concern?" ');
  });
  it("letra → eco + pitch shoppe[160+item] + `Interested?\" `; 'Y' compra (+3 keys) + `Sold!`", () => {
    const h = open();
    h.console.key("a");
    expect(h.console.snapshot().phase).toBe("guild-deal");
    expect(text(h)).toContain(`P${GUILD_PITCH_INDEX[0]}`);
    expect(text(h)).toContain('\n\nInterested?" ');
    const goldBefore = h.state.gold;
    h.console.key("y");
    expect(h.state.keys).toBe(3);
    expect(h.state.gold).toBeLessThan(goldBefore);
    expect(text(h)).toContain('"Sold!"');
    expect(h.console.snapshot().phase).toBe("guild-list");
  });
  it("'d' → easter-egg shoppe[164] y re-lista; sin oro → shoppe[163] y despedida silenciosa", () => {
    const h = open();
    h.console.key("d");
    expect(text(h)).toContain(`P${GUILD_EASTEREGG_INDEX}`);
    expect(h.console.snapshot().phase).toBe("guild-list");
    const h2 = open({ gold: 0 });
    h2.console.key("a");
    h2.console.key("y");
    expect(text(h2)).toContain(`P${GUILD_BROKE_INDEX}`);
    expect(h2.closed()).toBe(true);
  });
});

describe("Establo — escaneo pre-saludo + gate + pitch + Deal?\" (SHOPPES 0x7be)", () => {
  it("sin hueco: `The stables are closed.` y SALE sin saludo ni despedida", () => {
    const h = makeHarness("HorseSeller", { location: 6 });
    h.stable.free = false;
    h.console.start();
    expect(h.closed()).toBe(true);
    expect(text(h)).toContain("The stables are closed.");
    expect(text(h)).not.toMatch(/P9[2-9] /); // ni saludo (92-95) ni despedida (96-103)
  });
  it("gate 'Y' → pitch shoppe[104] con precio + `Deal?\" `; 'Y' paga y coloca; sin oro → echado en silencio", () => {
    const h = makeHarness("HorseSeller", { location: 6 });
    h.console.start();
    expect(h.console.snapshot().phase).toBe("greet-yn");
    h.console.key("y");
    expect(h.console.snapshot().phase).toBe("horse-deal");
    expect(text(h)).toContain(`P${HORSE_PITCH_INDEX}`);
    expect(text(h)).toContain('\n\nDeal?" ');
    h.console.key("y");
    expect(text(h)).toContain("Yes!");
    expect(h.stable.horseCalls).toBe(1);
    expect(h.closed()).toBe(true);

    const h2 = makeHarness("HorseSeller", { location: 6, gold: 0 });
    h2.console.start();
    h2.console.key("y");
    h2.console.key("y");
    expect(text(h2)).toContain("Thou couldst not afford to feed it!");
    expect(h2.stable.horseCalls).toBe(0);
    expect(h2.closed()).toBe(true);
  });
});

describe("C3 — cadena del curandero (SHOPPES 0x14f8/0x137c/0x146a)", () => {
  const open = (over: Parameters<typeof makeHarness>[1] = {}) => {
    const h = makeHarness("Healer", { location: 6, ...over }); // Trinsic (idx 1)
    h.console.start();
    expect(h.console.snapshot().phase).toBe("greet-yn");
    h.console.key("y");
    return h;
  };
  it("'Y' del gate → services + nature-of-need; Space en el gate RE-LEE (0x1510)", () => {
    const h = makeHarness("Healer", { location: 6 });
    h.console.start();
    h.console.key(" ");
    expect(h.console.snapshot().phase).toBe("greet-yn"); // el curandero re-lee Space
    h.console.key("y");
    const out = text(h);
    expect(out).toContain('"We have powers to Cure, Heal, or Resurrect."');
    expect(out).toContain('"What is the nature of thy need?" ');
    expect(h.console.snapshot().phase).toBe("healer-need");
  });
  it("Space/CR en nature-of-need → `Nothing` y despedida (0x170e)", () => {
    const h = open();
    h.console.key(" ");
    expect(text(h)).toContain("Nothing");
    expect(h.closed()).toBe(true);
  });
  it("party de 1 → miembro 0 SIN prompt; heal procede → pitch + `Wilt thou pay?\" `; 'Y' cobra y cura + epílogo", () => {
    const h = open();
    h.console.key("h");
    expect(h.picker.opens).toBe(0); // 0x1382: party de 1 no pregunta
    expect(h.console.snapshot().phase).toBe("healer-pay");
    const out = text(h);
    expect(out).toContain("I can heal thee ");
    expect(out).toContain("for 40 gold."); // healPrices[1] = 40, % expandido
    const goldBefore = h.state.gold;
    h.console.key("y");
    expect(h.state.gold).toBe(goldBefore - 40);
    expect((h.state.characters[0] as { currentHp: number }).currentHp).toBe(30);
    expect(text(h)).toContain("Is there any other way");
    expect(h.console.snapshot().phase).toBe("healer-again");
    // Epílogo → gate: 'N' despide.
    h.console.key("n");
    expect(h.closed()).toBe(true);
  });
  it("party > 1 → `\"Who needs my aid?\" ` + picker; cancel → `No one` + epílogo", () => {
    const h = open({ partySize: 2 });
    h.console.key("c");
    expect(text(h)).toContain('"Who needs my aid?" ');
    expect(h.picker.opens).toBe(1);
    h.picker.cancel!();
    expect(text(h)).toContain("No one");
    expect(h.console.snapshot().phase).toBe("healer-again");
  });
  it("servicio que no procede → `Thou hast no need of this art!` y epílogo (0x15d4)", () => {
    const h = open();
    h.console.key("c"); // cure sin 'P'
    expect(text(h)).toContain("Thou hast no need of this art!");
    expect(h.console.snapshot().phase).toBe("healer-again");
  });
  it("sin oro: caridad SOLO con precio ≤100 y location 7; si no, shoppe[173] sin ejecutar (0x14c2)", () => {
    // Trinsic (location 6): sin oro → sorry, sin curar.
    const h = open({ gold: 0 });
    h.console.key("h");
    h.console.key("y");
    expect(text(h)).toContain(`P${HEALER_SORRY_INDEX}`);
    expect((h.state.characters[0] as { currentHp: number }).currentHp).toBe(20);
    expect(h.console.snapshot().phase).toBe("healer-again");
    // Skara Brae (location 7, heal 45 ≤ 100): caridad — cura GRATIS.
    const h2 = makeHarness("Healer", { location: 7, gold: 0 });
    h2.console.start();
    h2.console.key("y");
    h2.console.key("h");
    h2.console.key("y");
    expect((h2.state.characters[0] as { currentHp: number }).currentHp).toBe(30);
    expect(h2.state.gold).toBe(0);
  });
  it("location 5 (Minoc): cure/heal GRATIS con `Receive now the Light!` (0x15e5/0x1655)", () => {
    const h = makeHarness("Healer", { location: 5, gold: 0 });
    h.console.start();
    h.console.key("y");
    h.console.key("h");
    expect(text(h)).toContain('Receive now the Light!"');
    expect((h.state.characters[0] as { currentHp: number }).currentHp).toBe(30);
    expect(h.console.snapshot().phase).toBe("healer-again");
  });
});

describe("C4 — gates Y/N de saludo restantes (taberna/astillero/posada)", () => {
  it.each(["Barkeeper", "Shipwright", "InnKeeper"] as ShopType[])("%s: greet-yn; 'n' ecoa No y despide", (type) => {
    const loc = type === "Shipwright" ? 24 : 2;
    const h = makeHarness(type, { location: loc });
    h.console.start();
    expect(h.console.snapshot().phase).toBe("greet-yn");
    h.console.key("n");
    expect(h.closed()).toBe(true);
    expect(text(h)).toContain("No");
  });
  it("posada: 'Y' → `$ asks,` + menú R/L/P fiel (SHOPPES3 0x917)", () => {
    const h = makeHarness("InnKeeper", { location: 2 });
    h.console.start();
    h.console.key("y");
    const out = text(h);
    expect(out).toContain("Keeper asks,");
    expect(out).toContain('"Art thou here');
    expect(h.console.snapshot().options.map((o) => o.key)).toEqual(["r", "l", "p"]);
  });
});

describe("C5 — bridgeTrollAmbush expone los miembros que tiran (preámbulo sneaks)", () => {
  it("rolledIndices alinea con dexRolls y salta 'D'/'S'", () => {
    const state = {
      transport: "foot",
      partySize: 3,
      characters: [
        { status: "G", dexterity: 30, strength: 10 },
        { status: "S", dexterity: 30, strength: 10 },
        { status: "G", dexterity: 1, strength: 10 },
      ],
    } as unknown as GameState;
    const rolls = [0, 5, 20]; // gate 0 (dispara) + dos rand(1,30)
    const rand = () => rolls.shift() ?? 0;
    const r = bridgeTrollAmbush(state, rand);
    expect(r.fired).toBe(true);
    expect(r.rolledIndices).toEqual([0, 2]); // el 'S' no tira
    expect(r.dexRolls).toEqual([5, 20]);
    expect(r.payerIndex).toBe(2); // dex 1 < 20
  });
});

describe("C6 — prosa del (S)earch por mueble (SJOG 0x0a6a-0x0ae8)", () => {
  it("tiles derivados → frase del mueble; default → `Thou dost find`", () => {
    expect(furnitureSearchProse(0xaf)).toBe("\nIn the trunk\nthou dost find\n");
    expect(furnitureSearchProse(0x2b)).toBe("\nIn the stump\nthou dost find\n");
    expect(furnitureSearchProse(0xac)).toBe("\nUnder the bed\nthou dost find\n");
    expect(furnitureSearchProse(0x63)).toBe("\nThou dost find\n"); // sin mueble
  });
});

describe("C7/C8 — comillas del intérprete de conversación (TALK 0x4da) + AskName", () => {
  const script: TalkScript = {
    npcIndex: 1,
    name: [{ kind: "text", text: "Stuart " }],
    description: [{ kind: "text", text: "a hungry lord." }],
    greeting: [{ kind: "text", text: "Hail, traveler!" }],
    job: [{ kind: "text", text: "I eat." }],
    bye: [{ kind: "text", text: "Farewell." }],
    qa: [],
    labels: [],
  };
  // `npcKnowsAvatar: true` NO es decorativo: tras D6 la SECCIÓN 2 (greeting) sólo se
  // emite en la rama de NPC ya conocido (TALK 0x1143 `jne 0x1166`); al desconocido se le
  // suelta `"I am called ` + sección 0. Estos casos miden la COMPOSICIÓN DE COMILLAS del
  // saludo, así que se colocan en la rama donde el saludo existe. Las tres ramas de la
  // apertura tienen sus propios casos en dialogue.test.ts.
  const mk = () => new Conversation(structuredClone(script), { avatarName: "Avatar", npcKnowsAvatar: true });

  it("la descripción va SIN comillas y el saludo ENTRE comillas (0x111c/0x1166)", () => {
    const out = mk().start();
    const texts = out.filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(texts[0]).toBe("You see a hungry lord.");
    expect(texts[1]).toBe('"Hail, traveler!"');
  });

  it("respuesta de keyword entre comillas; `name` = `\"My name is <nombre>\"` (0xaa8); no-match cierra la comilla del literal", () => {
    const c = mk();
    c.start();
    const job = c.input("job").filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(job[0]).toBe('"I eat."');
    const name = c.input("name").filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(name[0]).toBe('"My name is Stuart "'); // el nombre del TLK conserva su espacio final
    const nom = c.input("zzz").filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(nom[0]).toBe('"I cannot help thee with that."');
  });

  it("AskName emite `\"What is thy name?\"` antes del prompt (C7, TALK 0xe78)", () => {
    // El AskName va en la SECCIÓN 0 (name), que es la que corre en la apertura con NPC
    // desconocido (TALK 0x1161 `sub ax,ax` → `push 0`), igual que en Treanna. En la
    // sección 2 no valdría: processSection se salta AskName si el NPC ya te conoce, y
    // la sección 2 sólo corre justamente en ese caso ⇒ sería un control degenerado.
    const withAsk: TalkScript = {
      ...structuredClone(script),
      name: [
        { kind: "text", text: "Well met." },
        { kind: "op", op: "AskName" },
      ],
    };
    const c = new Conversation(withAsk, { avatarName: "Avatar", npcKnowsAvatar: false });
    const out = c.start();
    const texts = out.filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(texts).toContain('"What is thy name?"\n');
    expect(out.some((o) => o.kind === "prompt" && (o as { question: boolean }).question)).toBe(true);
    // Respuesta correcta → `\n\n"A pleasure!` (DS 0x94a0, sin cierre).
    const after = c.input("Avatar").filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(after[0]).toBe('\n\n"A pleasure!');
  });

  it("las comillas se componen TRAS tr() (trampa-del-entrecomillado): la key .TLK sigue casando", () => {
    const table: Record<string, string> = { "Hail, traveler!": "¡Salve, viajero!", "I eat.": "Yo como." };
    const c = new Conversation(structuredClone(script), {
      avatarName: "Avatar",
      npcKnowsAvatar: true, // rama del saludo (sección 2): es la cadena que se traduce aquí
      tr: (s) => table[s] ?? s,
    });
    const out = c.start();
    const texts = out.filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(texts[1]).toBe('"¡Salve, viajero!"'); // traducida Y entrecomillada
    const job = c.input("job").filter((o) => o.kind === "line").map((o) => (o as { text: string }).text);
    expect(job[0]).toBe('"Yo como."');
  });
});
