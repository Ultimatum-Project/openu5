/**
 * Fase 1.5 · Cofre-objeto: open() sobre un objeto de worldObjects de kind "chest" (SJOG
 * open_chest_world 0x112C). Secuencia EXACTA del binario (asm 0x11e4-0x12cc): marca turno →
 * KARMA robo en pueblo (1≤loc≤0x20: karma>2 ? -2 : =0, 0x11e9-0x120b) → trampa si
 * contents&0x80 ("Trapped!" + chestTrap ya puro, con la MÁSCARA 0x7f aplicada al contenido
 * antes del botín, 0x1214) → botín chestLoot ya puro aplicado a los contadores → "Chest
 * empty!" si nada (0x12c5) → elimina el objeto. El RNG corre por el stream vivo (this.rand),
 * como todo turno desde F.2. Reglas del motor (world/commands.ts) NO se reimplementan — sólo
 * se invocan y se aplican al estado.
 *
 * Inyección Clase D: trapCheck (traps.ts, SJOG search_trap_check 0x02ea) — DETECCIÓN de
 * trampa. El único caller del binario es 0x0a20, DENTRO del scan de slots del comando
 * (S)earch (clase-objeto 1 = cofre, 0x0a03), NO open_chest_world → se cablea en search(),
 * no en open(): examina y AVISA (contest INT vs rand(1,30), 0x55b6=INT) sin disparar la
 * trampa ni abrir/eliminar el cofre. Corrige el scout-claseD (decía "al abrir").
 *
 * Citas: .superpowers/sdd/scout-objects.md, re/notes/cmds.md §7-9, re/notes/sjog.md §Trap,
 * re/disasm/SJOG.OVL.asm 0x112C / 0x02ea / 0x0a20.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { lootOpenLine } from "../src/core/world/commands.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const CHEST_TILE = 0x40;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: PAWS, floor: 0, x: 3, y: 22 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function pawsWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[PAWS, paws]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData, s);
}

const chestAt = (over: Partial<WorldObject> = {}): WorldObject => ({
  location: PAWS, floor: 0, x: 3, y: 21, tile: CHEST_TILE, kind: "chest", contents: 0x20, trapped: false, ...over,
});

describe("F1.5 · abrir cofre-objeto (open_chest_world 0x112C)", () => {
  it("open() retira el cofre y NO acredita el botín (queda al suelo) #13", () => {
    // #13: el cofre desaparece; el botín se COLOCA como objetos-suelo en su celda (3,21)
    // en vez de acreditarse a los contadores. Divergencia resuelta del colapso open+credit.
    const chest = chestAt();
    const game = makeGame(makeState({
      worldObjects: [chest], gold: 0, keys: 0, gems: 0, food: 0, torches: 0,
    }), pawsWorld()); // party (3,22), cofre al N (3,21)
    game.reseed(0x1234);
    const events = game.open("north");
    const objs = game.state.worldObjects ?? [];
    expect(objs.every((o) => o.kind !== "chest")).toBe(true);   // cofre retirado
    for (const o of objs) {
      expect(o.kind).toBe("loot");                              // sólo botín-suelo
      expect({ x: o.x, y: o.y }).toEqual({ x: 3, y: 21 });      // apilado en la celda del cofre
    }
    // NADA acreditado al abrir (el Get lo hace pieza a pieza).
    expect(game.state.gold + game.state.keys + game.state.gems + game.state.food + game.state.torches).toBe(0);
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("cofre trampeado (contents&0x80) → 'Trapped!' y daña al que abre", () => {
    const chest = chestAt({ contents: 0xa0, trapped: true });
    const game = makeGame(makeState({ worldObjects: [chest] }), pawsWorld());
    game.reseed(0x0001);
    const before = game.state.characters[0]!.currentHp;
    const events = game.open("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts.some((t) => t?.includes("Trapped"))).toBe(true);
    // la trampa aplica daño/estado (ACID daña al opener); el HP no sube.
    expect(game.state.characters[0]!.currentHp).toBeLessThanOrEqual(before);
    // el cofre se retira tras trampa+botín (el botín queda al suelo como kind "loot", #13).
    expect((game.state.worldObjects ?? []).every((o) => o.kind !== "chest")).toBe(true);
  });

  it("robar un cofre en pueblo baja karma (>2 ? -2 : =0)", () => {
    const chest = chestAt();
    const game = makeGame(makeState({ worldObjects: [chest], karma: 50 }), pawsWorld());
    game.reseed(7);
    game.open("north");
    expect(game.state.karma).toBe(48); // -2 (asm 0x11fe)
  });

  it("karma<=2 al robar cae a 0, no negativo", () => {
    const chest = chestAt();
    const game = makeGame(makeState({ worldObjects: [chest], karma: 1 }), pawsWorld());
    game.reseed(7);
    game.open("north");
    expect(game.state.karma).toBe(0); // asm 0x1206
  });

  it("abrir un cofre FUERA de pueblo NO cambia el karma (overworld loc 0)", () => {
    // Karma-robo sólo en `1 ≤ loc ≤ 0x20` (asm 0x11e9-0x11f0). En el exterior (loc 0) el
    // gate `jb` @0x11ee salta el descuento → karma intacto. Cofre de campo.
    const chest = chestAt({ location: 0 });
    const game = makeGame(makeState({
      worldObjects: [chest], karma: 50,
      position: { location: 0, floor: 0, x: 3, y: 22 },
    }), pawsWorld());
    game.reseed(7);
    game.open("north");
    expect(game.state.karma).toBe(50); // sin robo fuera de pueblo
    expect((game.state.worldObjects ?? []).every((o) => o.kind !== "chest")).toBe(true); // cofre abierto y retirado
  });

  it("abrir un cofre FUERA de pueblo NO cambia el karma (mazmorra loc 0x21)", () => {
    // Mazmorra (loc ≥ 0x21): `ja` @0x11f5 salta el descuento (loc > 0x20) → karma intacto.
    const world = pawsWorld();
    const dtiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
    world.smallMaps.set(0x21, { id: 0x21, name: "Dungeon", floors: [{ z: 0, tiles: dtiles }] });
    const chest = chestAt({ location: 0x21 });
    const game = makeGame(makeState({
      worldObjects: [chest], karma: 50,
      position: { location: 0x21, floor: 0, x: 3, y: 22 },
    }), world);
    game.reseed(7);
    game.open("north");
    expect(game.state.karma).toBe(50); // sin robo en mazmorra
    expect((game.state.worldObjects ?? []).every((o) => o.kind !== "chest")).toBe(true);
  });

  it("un cofre vacío (contents 0) reporta 'Chest empty!' y se elimina", () => {
    const chest = chestAt({ contents: 0 });
    const game = makeGame(makeState({ worldObjects: [chest] }), pawsWorld());
    game.reseed(9);
    const events = game.open("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts.some((t) => t?.includes("Chest empty"))).toBe(true);
    expect(game.state.worldObjects).toEqual([]);
  });

  it("cofre rico → 'Found:' + N piezas apiladas; el Get las recoge una a una con contador #13", () => {
    // Cofre rico (contents 0x63): Open coloca ≥1 objeto-suelo en la celda del cofre (3,21) y
    // emite "Found:"; NADA se acredita aún. Luego Get×N (party (3,22), cofre al N) recoge una
    // pieza por Get, con su nombre, y acredita el contador simple (gold/keys/gems/food/torches).
    const chest = chestAt({ contents: 0x63 });
    const game = makeGame(makeState({
      worldObjects: [chest], gold: 0, keys: 0, gems: 0, food: 0, torches: 0,
    }), pawsWorld());
    game.reseed(0x4242);
    const openEvents = game.open("north");
    const openTexts = openEvents.filter((e) => e.kind === "message").map((e) => e.text);
    const loot = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot");
    expect(loot.length).toBeGreaterThan(0);            // botín colocado
    expect(openTexts).toContain("Found:");             // str 0x8b5c en la 1ª pieza
    // Contadores intactos tras abrir (aún no se acredita).
    const sumBefore = game.state.gold + game.state.keys + game.state.gems + game.state.food + game.state.torches;
    expect(sumBefore).toBe(0);

    // Recoge todas las piezas una a una; cada Get emite un mensaje-nombre y retira UNA pieza.
    let picks = 0;
    while ((game.state.worldObjects ?? []).some((o) => o.kind === "loot") && picks < 40) {
      const remainingBefore = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot").length;
      const ev = game.get("north");
      const msgs = ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
      expect(msgs.some((t) => t.length > 0)).toBe(true); // nombre del item
      const remainingAfter = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot").length;
      expect(remainingAfter).toBe(remainingBefore - 1); // recoge exactamente UNA
      picks++;
    }
    expect(picks).toBe(loot.length);
    // Tras recoger todo, algún contador simple creció (gold/keys/gems/food/torches EXACTOS).
    const grew = game.state.gold > 0 || game.state.keys > 0 || game.state.gems > 0 ||
      game.state.food > 0 || game.state.torches > 0;
    expect(grew).toBe(true);
  });

  it("Open imprime 'Found:' + una línea por pieza colocada (dispatcher 0x12A) #13", () => {
    // loot_place llama a 0x12A por cada objeto → una línea de texto por pieza tras "Found:",
    // en orden de colocación, con los strings verbatim de DATA.OVL (lootOpenLine).
    const chest = chestAt({ contents: 0x63 });
    const game = makeGame(makeState({ worldObjects: [chest] }), pawsWorld());
    game.reseed(0x4242);
    const events = game.open("north");
    const msgs = events.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    const loot = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot");
    expect(loot.length).toBeGreaterThan(0);
    const foundIdx = msgs.indexOf("Found:");
    expect(foundIdx).toBeGreaterThanOrEqual(0);
    // Justo tras "Found:", exactamente una línea por pieza en orden de colocación.
    const lines = msgs.slice(foundIdx + 1, foundIdx + 1 + loot.length);
    expect(lines).toEqual(loot.map((o) => lootOpenLine(o.loot!.id)));
    // Y son las líneas del dispatcher, NO el nombre-cantidad del Get (p.ej. "a sack of gold!").
    expect(lootOpenLine(2)).toBe("a sack of gold!");
    expect(lootOpenLine(8)).toBe("a gem!");
    expect(lootOpenLine(99)).toBe("Nothing of note."); // default (id sin handler)
  });

  it("Get sobre botín-suelo apilado devuelve la ÚLTIMA colocada primero (LIFO por slot) #13", () => {
    // Siembra dos piezas manualmente: gems(id8, qty2) luego gold(id2, qty50). El barrido de
    // slots del binario (coloca 31↓, Get lee 1↑) recoge la ÚLTIMA colocada primero → gold.
    const game = makeGame(makeState({ gold: 0, gems: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 8, kind: "loot", loot: { id: 8, category: "gems", qty: 2 } },
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 2, kind: "loot", loot: { id: 2, category: "gold", qty: 50 } },
    ] }), pawsWorld());
    const ev1 = game.get("north");
    expect(ev1.filter((e) => e.kind === "message").map((e) => e.text)).toContain("50 gold!");
    expect(game.state.gold).toBe(50);
    const ev2 = game.get("north");
    expect(ev2.filter((e) => e.kind === "message").map((e) => e.text)).toContain("2 gems!");
    expect(game.state.gems).toBe(2);
    expect((game.state.worldObjects ?? []).filter((o) => o.kind === "loot")).toHaveLength(0);
  });

  it("botín-suelo de interior desaparece al salir al overworld (no persiste, fiel) #13", () => {
    const game = makeGame(makeState({ worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 2, kind: "loot", loot: { id: 2, category: "gold", qty: 30 } },
      { location: 0, floor: 0, x: 79, y: 109, tile: 0x25, kind: "ship", hull: 99, skiffs: 2 }, // overworld: persiste
    ] }), pawsWorld());
    // salir del pueblo descarta los objetos de interior de esa location (incluye "loot");
    // discardInteriorObjects es el mismo paso que ejercita exitToOverworld (game.ts:2325).
    (game as unknown as { discardInteriorObjects(loc: number): void }).discardInteriorObjects(PAWS);
    expect((game.state.worldObjects ?? []).some((o) => o.kind === "loot")).toBe(false);
    expect((game.state.worldObjects ?? []).some((o) => o.kind === "ship")).toBe(true); // overworld intacto
  });

  it("sin cofre-objeto, open() conserva el comportamiento actual ('Nothing to open!')", () => {
    const game = makeGame(makeState(), pawsWorld()); // sin worldObjects, sin doors
    const events = game.open("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Nothing to open!"); // cero regresión
  });
});

describe("#21 · botín-suelo VISIBLE (tile = id+0x100) + cofre anidado (id1)", () => {
  // Tabla id→tile DERIVADA del dataflow de loot_place (SJOG 0x0F88): slot+0 = slot+1 =
  // [si+0x4124] = id de categoría (byte bajo 1..15); el blit lo dibuja del banco alto del
  // atlas (0x100..0x1FF) → tile mostrado = id + 0x100. Cotejo 1:1 con los 7 sprites del
  // vídeo forense (2026-07-13). Tabla FIJA DATA.OVL 0x4124 = 01 02 03 04 07 08 0d 0f 19.
  const VIDEO_SPRITES = [
    { id: 5, tile: 0x105, name: "ItemWeapon (espada)" },
    { id: 10, tile: 0x10a, name: "ItemRing (anillo)" },
    { id: 11, tile: 0x10b, name: "ItemArmour (gris)" },
    { id: 2, tile: 0x102, name: "ItemMoney (saco $)" },
    { id: 8, tile: 0x108, name: "ItemGem (destello)" },
    { id: 13, tile: 0x10d, name: "ItemTorch (antorcha)" },
    { id: 15, tile: 0x10f, name: "ItemFood (vianda)" },
  ];
  for (const v of VIDEO_SPRITES) {
    it(`id ${v.id} (${v.name}) → sprite 0x${v.tile.toString(16)} = id+0x100`, () => {
      const game = makeGame(makeState({ worldObjects: [
        { location: PAWS, floor: 0, x: 3, y: 21, tile: v.id, kind: "loot", loot: { id: v.id, category: "x", qty: 1 } },
      ] }), pawsWorld());
      expect(game.lootRenderTiles()).toEqual([{ x: 3, y: 21, tile: v.tile }]);
    });
  }

  it("pila: se pinta el TOPE (última colocada, LIFO); cada Get revela el siguiente y limpia la celda", () => {
    // gems(id8) al fondo, weapon(id5) al tope → render = weapon (0x105). Get retira el tope y
    // revela gems (0x108). Get retira gems → celda sin render tile. Mismo orden que Get recoge.
    const game = makeGame(makeState({ gold: 0, gems: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 8, kind: "loot", loot: { id: 8, category: "gems", qty: 2 } },
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 5, kind: "loot", loot: { id: 5, category: "equipment", qty: 1 } },
    ] }), pawsWorld());
    expect(game.lootRenderTiles()).toEqual([{ x: 3, y: 21, tile: 0x105 }]); // tope = weapon
    game.get("north"); // recoge el tope (weapon)
    expect(game.lootRenderTiles()).toEqual([{ x: 3, y: 21, tile: 0x108 }]); // revela gems
    game.get("north"); // recoge gems
    expect(game.lootRenderTiles()).toEqual([]); // celda limpia
  });

  it("cofre anidado (id1) renderiza como cofre (0x101)", () => {
    const game = makeGame(makeState({ worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 1, kind: "loot", contents: 0x10, loot: { id: 1, category: "chest", qty: 0x10 } },
    ] }), pawsWorld());
    expect(game.lootRenderTiles()).toEqual([{ x: 3, y: 21, tile: 0x101 }]); // ItemChest
  });

  it("cofre anidado (id1): (G)et lo RECHAZA con 'Open it first!' sin retirar ni acreditar (0x1482)", () => {
    // apply_item_grant caso id1 (0x1482): imprime 0x8c3e y jmp 0x1798 = return sin borrar el
    // slot (0x178b) ni acreditar (0x177a). Get de cofre anidado NO recoge; hay que Abrirlo.
    const game = makeGame(makeState({ gold: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 1, kind: "loot", contents: 0x10, loot: { id: 1, category: "chest", qty: 0x10 } },
    ] }), pawsWorld());
    const ev = game.get("north");
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Open it first!"); // str 0x8c3e
    expect((game.state.worldObjects ?? []).filter((o) => o.kind === "loot")).toHaveLength(1); // NO retirado
    expect(game.state.gold).toBe(0); // NO acreditado
  });

  it("cofre anidado ENTERRADO bajo el botín: (O)pen recorre la pila y lo abre (0x1153) — fix review", () => {
    // El bug del fix-round: open_chest_world (0x112C) barre TODA la pila saltando ids≠1/0x0e; el
    // id1 (fila FIJA si=0) casi nunca queda al TOPE porque el botín ALEATORIO se apila encima.
    // Semilla REAL del reviewer: contents=0x63, seed=7 → pila de 26, id1 enterrado (idx 4), tope
    // = weapon(id5). El 2º Open debe HALLAR y abrir el cofre enterrado; con lootAt (tope) fallaría.
    const chest = chestAt({ x: 3, y: 21, tile: 0x40, kind: "chest", contents: 0x63, trapped: false });
    const game = makeGame(makeState({ gold: 0, gems: 0, food: 0, torches: 0, keys: 0, worldObjects: [chest] }), pawsWorld());
    game.reseed(7);
    game.open("north"); // 1er Open: esparce la pila (incluye el id1 enterrado)
    const pile1 = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot");
    const buriedIdx = pile1.findIndex((o) => o.loot?.id === 1);
    expect(buriedIdx).toBeGreaterThanOrEqual(0);           // hay un cofre anidado…
    expect(buriedIdx).toBeLessThan(pile1.length - 1);      // …y NO está al tope (enterrado)
    expect(pile1[pile1.length - 1]!.loot!.id).not.toBe(1); // el tope es otro botín (no el cofre)

    const ev2 = game.open("north"); // 2º Open: DEBE hallar el id1 enterrado y abrirlo
    const pile2 = (game.state.worldObjects ?? []).filter((o) => o.kind === "loot");
    expect(pile2.some((o) => o.loot?.id === 1)).toBe(false); // el cofre enterrado se abrió/retiró
    const texts2 = ev2.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts2.includes("Found:") || texts2.includes("Chest empty!")).toBe(true); // esparció o vacío
    // Scatter ENCIMA (point 3): el contenido del anidado va a los slots más altos del render
    // (find_free_actor_slot 31→1 → índices bajos = tope; en el clon = empujado al final del array),
    // así que el TOPE tras abrir es una pieza NUEVA (o la pila menguó si quedó vacío). El cofre
    // enterrado ya no está y el resto del botín sigue en la misma celda.
    for (const o of pile2) if (o.loot) expect({ x: o.x, y: o.y }).toEqual({ x: 3, y: 21 });
  });

  it("(O)pen SALTA el botín no-cofre del tope y abre el cofre de debajo; (G)et sí toma el tope", () => {
    // Pila hecha a mano: cofre anidado(id1) al fondo, weapon(id5) al tope. (O)pen salta el weapon
    // (0x119e) y abre el cofre (0x1181). En cambio (G)et actúa sobre el TOPE → toma el weapon,
    // no dice "Open it first!" (Get sólo rechaza si el cofre está EN el tope).
    const mk = () => makeGame(makeState({ gold: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 1, kind: "loot", contents: 0x10, loot: { id: 1, category: "chest", qty: 0x10 } },
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 5, kind: "loot", loot: { id: 5, category: "equipment", qty: 1 } },
    ] }), pawsWorld());

    const gOpen = mk(); gOpen.reseed(0x99);
    gOpen.open("north"); // salta el weapon, abre el cofre enterrado
    expect((gOpen.state.worldObjects ?? []).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(false);

    const gGet = mk();
    const ev = gGet.get("north"); // Get toma el TOPE = weapon, no rechaza
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).not.toContain("Open it first!");
    expect((gGet.state.worldObjects ?? []).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(true); // cofre intacto (bajo)
  });

  it("caja de sándalo (id14 = 0x0e) al tope de la pila: (O)pen corta con 'Can't!' (0x1192)", () => {
    // El barrido de open_chest_world trata id14 como abrible-que-rechaza: imprime "Can't!" (0x8b64)
    // y NO abre nada. El clon no coloca id14 en botín de cofre, pero respeta el barrido si un
    // creador lo deja en la pila. Declarado (⚠ turno no cobrado, como "Nothing to open!").
    const game = makeGame(makeState({ worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 14, kind: "loot", loot: { id: 14, category: "sandalwood", qty: 1 } },
    ] }), pawsWorld());
    const ev = game.open("north");
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Can't!"); // str 0x8b64
    expect((game.state.worldObjects ?? []).some((o) => o.loot?.id === 14)).toBe(true); // no se retira
  });

  it("cofre anidado (id1): (O)pen lo abre — lo retira y esparce su contenido en la MISMA celda", () => {
    // open_chest_world (0x112C) barre la capa de objetos ASCENDENTE (tope de la pila), abre el
    // cofre-objeto del tope (slot+0==1), lo borra (write_object_slot ceros) y esparce su
    // contenido (slot+5) en la misma celda vía loot_place. Recursión de contenedores.
    const game = makeGame(makeState({ gold: 0, gems: 0, food: 0, torches: 0, keys: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 1, kind: "loot", contents: 0x40, loot: { id: 1, category: "chest", qty: 0x40 } },
    ] }), pawsWorld());
    game.reseed(0x1234);
    const ev = game.open("north");
    const objs = game.state.worldObjects ?? [];
    expect(objs.some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(false); // el cofre anidado se abrió/retiró
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.includes("Found:") || texts.includes("Chest empty!")).toBe(true); // esparce o queda vacío
    for (const o of objs) if (o.kind === "loot") expect({ x: o.x, y: o.y }).toEqual({ x: 3, y: 21 }); // en la celda
  });
});

describe("F1.5 · (S)earch sobre cofre-objeto detecta la trampa (search_trap_check 0x02ea)", () => {
  it("INT alta percibe correctamente la trampa (contest ganado)", () => {
    // Cofre trampeado diff 3 (contents 0x83): threshold = ((3 − INT + 30)&0xffff)>>1.
    // Con INT=30 (máximo LEGÍTIMO, ATTR_MAX de shrines) el threshold es 1 →
    // roll(1,30) SIEMPRE >= 1 → detecta. diff<0x0a ("a simple trap!", sjog.md §Trap).
    // Determinista, independiente del seed. [Re-baseline auditoría byte-wrap: el
    // INT=99 anterior asumía umbral negativo, pero el binario parte con `shr` SIN
    // SIGNO (SJOG 0x0330) → con INT editada >30 el umbral WRAPEA y la percepción
    // falla SIEMPRE — ver audit-byte-wrap.test.ts y re/notes/audit-byte-wrap.md.]
    const chest = chestAt({ contents: 0x83, trapped: true });
    const game = makeGame(makeState({ worldObjects: [chest], characters: [makeChar({ intelligence: 30 })] }), pawsWorld());
    game.reseed(0x0001);
    const events = game.search("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("trap") && !t.includes("no trap"))).toBe(true);
    // detección NO dispara ni elimina: el cofre sigue ahí, HP intacto.
    expect(game.state.worldObjects).toHaveLength(1);
    expect(game.state.characters[0]!.currentHp).toBe(50);
  });

  it("INT baja falla la percepción de una trampa dura ('no trap!' falso negativo)", () => {
    // Cofre muy trampeado diff 0x40 (contents 0xc0): threshold = (0x40 - INT + 30)>>1. Con
    // INT=5 → (64-5+30)>>1 = 44 > 30 → roll(1,30) SIEMPRE < threshold → falla. success!=trapped
    // → "no trap!" (sjog.md §Trap 0x864a). Determinista, independiente del seed.
    const chest = chestAt({ contents: 0xc0, trapped: true });
    const game = makeGame(makeState({ worldObjects: [chest], characters: [makeChar({ intelligence: 5 })] }), pawsWorld());
    game.reseed(0x0001);
    const events = game.search("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("no trap"))).toBe(true);
    expect(game.state.worldObjects).toHaveLength(1); // sin disparar/eliminar
  });
});

describe("residual-2 · turno en early-exits del (G)et/(O)pen overworld (0x24e6 solo en éxito)", () => {
  // Derivación (main 3b42d918): cmd_get 0x18CE fall-through "Nothing to get!" (0x1b28,
  // str 0x8e64) y el rechazo "Open it first!" del cofre id1 (get_item_switch 0x1482 →
  // jmp 0x1798) salen SIN tocar [g_unk_24e6] — solo el ÉXITO marca (0x178e y las ramas
  // de tile 0x19f6/0x1a38/0x1a7e/0x1aa6/0x1b04). "Nothing to open!" (0x112C 0x118c→
  // 0x12c8→ret) tampoco (el marcador del open es 0x11e4, post-hallazgo). Observable del
  // clon: runContextTurn NO corre → el reloj (state.time) queda quieto.
  const MIN0 = 35; // makeState arranca en 8:35

  it("(G)et a celda vacía → 'Nothing to get!' SIN turno (el reloj no avanza)", () => {
    const game = makeGame(makeState({ worldObjects: [] }), pawsWorld());
    const ev = game.get("north");
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to get!")).toBe(true);
    expect(game.state.time.minute).toBe(MIN0); // sin 0x24e6 → sin turno
    expect(game.state.turnsSinceStart).toBe(0);
  });

  it("(G)et sobre cofre anidado (id1) → 'Open it first!' SIN turno (0x1482 salta 0x178e)", () => {
    const game = makeGame(makeState({ worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 1, kind: "loot", contents: 0x10, loot: { id: 1, category: "chest", qty: 0x10 } },
    ] }), pawsWorld());
    const ev = game.get("north");
    expect(ev.some((e) => e.kind === "message" && e.text === "Open it first!")).toBe(true);
    expect(game.state.time.minute).toBe(MIN0);
    expect(game.state.turnsSinceStart).toBe(0);
  });

  it("(O)pen sin nada delante → 'Nothing to open!' SIN turno (0x118c nunca alcanza 0x11e4)", () => {
    const game = makeGame(makeState({ worldObjects: [] }), pawsWorld());
    const ev = game.open("north");
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to open!")).toBe(true);
    expect(game.state.time.minute).toBe(MIN0);
    expect(game.state.turnsSinceStart).toBe(0);
  });

  it("CONTROL: el (G)et con ÉXITO (pieza de botín) SÍ cobra el turno (0x178e)", () => {
    const game = makeGame(makeState({ gold: 0, worldObjects: [
      { location: PAWS, floor: 0, x: 3, y: 21, tile: 5, kind: "loot", contents: 4, loot: { id: 2, category: "gold", qty: 4 } },
    ] }), pawsWorld());
    const ev = game.get("north");
    expect(ev.some((e) => e.kind === "message")).toBe(true);
    expect(game.state.gold).toBe(4); // acreditado
    expect(game.state.time.minute).toBeGreaterThan(MIN0); // turno cobrado → reloj avanza
  });
});
