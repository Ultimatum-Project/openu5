/**
 * FIDELIDAD «la victoria NO cierra el combate» (COMBAT.OVL 0x0B94 tail, verificado
 * en el disasm): al morir el último enemigo el binario imprime "VICTORY!" (0x0cf6,
 * DATA 0x6f00) y el bucle SIGUE (fall-through a 0x0d08). La party permanece en el
 * tablero, recoge el botín con (G)et/(O)pen y SALE andando por el borde
 * (SJOG:0x1C56→0x1BB2). El combate sólo termina cuando el BANDO party queda vacío:
 * muerte total (0x0cb7) o toda la party fuera del tablero (0x0cbc). re/notes/combat.md §2/§86.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function byName(name: string): EnemyDef {
  const d = defs().find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
const campFire = (): CombatMapData => combatMaps[0]!;

function makeCombat(seed = 12345, state: GameState = freshState()): Combat {
  const spider = byName("Giant Spider"); // débil, melee, no huye
  return new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: spider, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
}

/** Idéntico a `makeCombat` salvo `roomCombat:true` (g_unk_58a1 bit 0x80 = sala .CBT). */
function makeRoomCombat(seed = 12345, state: GameState = freshState()): Combat {
  const spider = byName("Giant Spider");
  return new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: spider, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
    roomCombat: true,
  });
}

/** Ataca (sin salir del tablero) hasta que el bando enemigo quede limpio. */
function fightToVictory(combat: Combat): string[] {
  const msgs: string[] = [];
  let ticks = 0;
  while (!combat.victory && ticks++ < 300) {
    const cur = combat.currentUnit;
    if (!cur) break;
    let ev: CombatEvent[];
    if (cur.kind === "enemy" || cur.charmed) {
      ev = combat.tickEnemyTurns();
    } else {
      const foe = combat.combatants.find((c) => c.kind === "enemy" && c.status === "active");
      const dist = foe ? Math.max(Math.abs(cur.x - foe.x), Math.abs(cur.y - foe.y)) : Infinity;
      ev = foe && dist <= 1 ? combat.playerAttack(foe.x, foe.y) : combat.playerPass();
    }
    for (const e of ev) if (e.kind === "message" && e.text) msgs.push(e.text);
  }
  return msgs;
}

describe("victoria no cierra el combate (permanencia + salida por borde)", () => {
  it("al limpiar el bando enemigo: victory=true PERO over=false (linger)", () => {
    const combat = makeCombat();
    fightToVictory(combat);
    expect(combat.victory).toBe(true);
    expect(combat.over).toBe(false); // sigues en el tablero para recoger botín
  });

  it("VICTORY! se anuncia UNA sola vez, al limpiar el bando enemigo", () => {
    const combat = makeCombat();
    const msgs = fightToVictory(combat);
    expect(msgs.filter((t) => t === "VICTORY!").length).toBe(1);
  });

  it("caminar toda la party fuera del borde cierra el combate; la victoria persiste", () => {
    const combat = makeCombat();
    fightToVictory(combat);
    let guard = 0;
    while (!combat.over && guard++ < 80) {
      const cur = combat.currentUnit;
      if (cur?.kind === "player" && !cur.charmed) combat.playerEscape("east");
      else combat.tickEnemyTurns();
    }
    expect(combat.over).toBe(true);
    expect(combat.victory).toBe(true); // g_cmb_victory_flag persiste al salir
  });

  it("(Esc) POST-VICTORIA: un solo Esc retira a TODO el party de golpe y cierra el combate", () => {
    // Veredicto esc-flee-verdict.md §3 (esc_victory probe: playersBefore=3 → playersAfter=0,
    // allLeftAtOnce=true, combatClosed=true; testigo del usuario).
    const combat = makeCombat();
    fightToVictory(combat);
    const partyBefore = combat.combatants.filter(
      (c) => c.kind === "player" && c.status !== "dead" && c.status !== "fled",
    ).length;
    expect(partyBefore).toBeGreaterThan(1); // varios miembros en pie tras la victoria

    const ev = combat.playerEscapeQuick();
    // Eco fiel "Escape!" — CMDS.OVL 0x17ec: "Escape" (DS 0x4574) + '!' (putchar 0x21
    // @0x1853) sobre la fila del prompt → kind "echo" (careo-combate T9), una sola
    // vez, y el combate queda cerrado.
    expect(ev.some((e) => e.kind === "echo" && e.text === "Escape!")).toBe(true);
    expect(combat.over).toBe(true); // TODOS fuera de un golpe (no uno a uno)
    expect(combat.victory).toBe(true); // g_cmb_victory_flag persiste al salir

    const partyAfter = combat.combatants.filter(
      (c) => c.kind === "player" && c.status !== "dead" && c.status !== "fled",
    ).length;
    expect(partyAfter).toBe(0);
  });

  it("(Esc) MEDIA PELEA (enemigos vivos): eco 'Escape-Not yet!' y NADA más — ni huye, ni mueve, NI consume turno", () => {
    // Veredicto esc-flee-verdict.md §1 (esc_border2/3: fled=false, turnConsumed=false,
    // keyDrained=true) — los probes midieron ESTADO, no consola. RE-BASELINE
    // careo-combate T9: CMDS.OVL 0x17ec imprime SIEMPRE "Escape" (DS 0x4574,
    // 0x17f4 incondicional) y con victory_flag==0 el sufijo "-Not yet!" (DS
    // 0x4587, 0x1841) — print sin efecto de juego ni turno.
    const combat = makeCombat();
    // Lleva el turno a un PJ sin tocar aún a los enemigos (siguen vivos).
    let guard = 0;
    while (guard++ < 60) {
      const cur = combat.currentUnit;
      if (cur?.kind === "player" && !cur.charmed) break;
      combat.tickEnemyTurns();
    }
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    const posBefore = { x: cur.x, y: cur.y, status: cur.status };
    const enemiesAlive = combat.combatants.some((c) => c.kind === "enemy" && c.status === "active");
    expect(enemiesAlive).toBe(true);

    const ev = combat.playerEscapeQuick();
    // Solo el ECO (T9): ningún evento de juego — ni turno, ni huida.
    expect(ev).toEqual([{ kind: "echo", text: "Escape-Not yet!" }]);
    expect(combat.currentUnit).toBe(cur); // MISMO turno: no lo consumió
    expect({ x: cur.x, y: cur.y, status: cur.status }).toEqual(posBefore); // no movió ni huyó
    expect(combat.over).toBe(false);
  });
});

// ── ESC EN SALA (.CBT): el gate de SALA va ANTES del de victoria ────────────────────
// re/notes/esc-sala-derivacion.md §2: CMDS.OVL 0x17ec pone `test byte [g_unk_58a1],0x80`
// en 0x1822 y sólo cae al gate de victoria (0x183a) si el bit está LIMPIO. En una sala,
// por tanto, el ESC imprime "Escape"+"-Not here!" (DS 0x4574 + DS 0x457b) y NUNCA llega
// al teardown de 0x1853 — ni con la sala GANADA. La única salida de una sala es vaciar el
// bando party del tablero ANDANDO (COMBAT.OVL 0x0ca6-0x0cc7). El port lo tenía invertido
// (miraba enemigos primero) y era divergencia declarada; aquí se calca.
describe("ESC en SALA de mazmorra — gate 0x1822 ANTES del de victoria (0x183a)", () => {
  it("SALA + VICTORIA: eco 'Escape-Not here!', NO retira a nadie y NO cierra el combate", () => {
    const combat = makeRoomCombat();
    fightToVictory(combat);
    expect(combat.victory).toBe(true);
    const activos = () =>
      combat.combatants.filter((c) => c.kind === "player" && c.status !== "dead" && c.status !== "fled").length;
    const partyBefore = activos();
    expect(partyBefore).toBeGreaterThan(1);
    const turnoBefore = combat.currentUnit;

    const ev = combat.playerEscapeQuick();

    expect(ev).toEqual([{ kind: "echo", text: "Escape-Not here!" }]);
    expect(activos()).toBe(partyBefore); // NO retira: el teardown 0x1853 es inalcanzable
    expect(combat.over).toBe(false); // NO cierra la escena
    expect(combat.currentUnit).toBe(turnoBefore); // el rechazo no consume turno
  });

  it("SALA + enemigos vivos: 'Escape-Not here!' (misma rama — el gate no mira la victoria)", () => {
    const combat = makeRoomCombat();
    let guard = 0;
    while (guard++ < 60) {
      const cur = combat.currentUnit;
      if (cur?.kind === "player" && !cur.charmed) break;
      combat.tickEnemyTurns();
    }
    expect(combat.combatants.some((c) => c.kind === "enemy" && c.status === "active")).toBe(true);
    expect(combat.playerEscapeQuick()).toEqual([{ kind: "echo", text: "Escape-Not here!" }]);
    expect(combat.over).toBe(false);
  });

  it("CONTROL POSITIVO (campo + victoria): el MISMO ESC sí retira y cierra — el gate discrimina por SALA", () => {
    // Mismo estado y misma secuencia; la ÚNICA diferencia con el primer caso es
    // `roomCombat`. Sin esto, un "no retira" podría venir de que el teardown esté roto.
    const combat = makeCombat();
    fightToVictory(combat);
    const ev = combat.playerEscapeQuick();
    expect(ev.some((e) => e.kind === "echo" && e.text === "Escape!")).toBe(true);
    expect(combat.over).toBe(true);
    expect(
      combat.combatants.filter((c) => c.kind === "player" && c.status !== "dead" && c.status !== "fled").length,
    ).toBe(0);
  });

  it("la salida REAL de una sala ganada es ANDANDO por el borde (0x0ca6-0x0cc7) y ecoa 'Leave!'", () => {
    const combat = makeRoomCombat();
    fightToVictory(combat);
    const ecos: string[] = [];
    let guard = 0;
    while (!combat.over && guard++ < 80) {
      const cur = combat.currentUnit;
      if (cur?.kind === "player" && !cur.charmed) {
        for (const e of combat.playerEscape("east")) if (e.kind === "message" && e.text) ecos.push(e.text);
      } else combat.tickEnemyTurns();
    }
    expect(combat.over).toBe(true);
    expect(combat.victory).toBe(true);
    expect(ecos).toContain("Leave!");
  });
});

describe("(G)et/(O)pen del botín en la arena — DIRECCIONAL, adyacente (SJOG 0x18ce/0x1374)", () => {
  // El (G)/(O) de combate llaman a las MISMAS rutinas del overworld (dispatch_table.py:
  // Get→SJOG:0x18ce, Open→SJOG:0x1374), ambas con getdir 0x766c → celda actor_activo+dir.
  // El cofre (tile 1) es IMPASABLE: se abre desde AL LADO, no pisándolo. Eco = overworld
  // ("Found:" + línea por pieza / "Chest empty!"). re/notes/combat-commands.md.

  // Localiza una semilla con cofre y devuelve el combate + la celda del cofre.
  function combatWithChest(): { c: Combat; chest: { x: number; y: number } } {
    for (let seed = 1; seed <= 400; seed++) {
      const c = makeCombat(seed);
      fightToVictory(c);
      const t = c.lootTiles().find((l) => l.tile === 0x01); // TILE_CHEST
      if (t) return { c, chest: { x: t.x, y: t.y } };
    }
    throw new Error("ninguna semilla dejó cofre");
  }

  it("apuntar a una celda vecina SIN cofre → 'Nothing to get!'", () => {
    const combat = makeCombat();
    fightToVictory(combat);
    // celda propia (null): sin cofre debajo → Nothing to get!
    const ev = combat.playerGet(null);
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to get!")).toBe(true);
  });

  // Recoloca al PJ activo al OESTE de la celda objetivo (para apuntar "east").
  function placeCurrentWestOf(c: Combat, cell: { x: number; y: number }): void {
    const cur = c.currentUnit!;
    expect(cur.kind).toBe("player");
    cur.x = cell.x - 1;
    cur.y = cell.y;
  }
  function texts(ev: CombatEvent[]): string[] {
    return ev.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);
  }

  it("(G)et sobre el cofre CERRADO NO lo abre: 'Open it first!' (0x1482/0x8C3E) y el cofre SIGUE", () => {
    const { c, chest } = combatWithChest();
    const goldBefore = (c as unknown as { opts: { state: GameState } }).opts.state.gold;
    placeCurrentWestOf(c, chest);
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Open it first!");
    // El cofre no se retira ni se acredita nada (cmd_get 0x18CE → get_item_switch id1).
    expect(c.chestAt(chest.x, chest.y)).toBe(true);
    expect((c as unknown as { opts: { state: GameState } }).opts.state.gold).toBe(goldBefore);
  });

  it("(O)pen derrama el botín AL SUELO ('Found:' + línea por pieza, SIN acreditar) y el (G)et lo recoge UNA pieza por turno (0x18CE→0x1458)", () => {
    const { c, chest } = combatWithChest();
    const state = (c as unknown as { opts: { state: GameState } }).opts.state;
    const goldBefore = state.gold;
    placeCurrentWestOf(c, chest);
    const ev = c.playerOpen("east");
    // El cofre desaparece; eco fiel del overworld: "Found:" + una línea por pieza
    // (dispatcher 0x12A: "a sack of gold!"…) o "Chest empty!" (0x8b88).
    expect(c.chestAt(chest.x, chest.y)).toBe(false);
    const opened = texts(ev);
    expect(opened.includes("Found:") || opened.includes("Chest empty!")).toBe(true);
    expect(opened.some((t) => t.startsWith("Thou dost find"))).toBe(false);
    if (opened.includes("Chest empty!")) return; // semilla sin piezas: nada más que probar
    // Nº de piezas anunciadas tras "Found:" (línea por pieza).
    const pieces = opened.length - 1 - opened.indexOf("Found:");
    expect(pieces).toBeGreaterThan(0);
    // NADA acreditado al abrir: el botín está al suelo (lootTiles muestra el tope de la pila).
    expect(state.gold).toBe(goldBefore);
    expect(c.lootTiles().some((l) => l.x === chest.x && l.y === chest.y)).toBe(true);
    // (G)et recoge UNA pieza por turno (LIFO), nombrándola (lootItemName ≠ línea del Open).
    for (let i = 0; i < pieces; i++) {
      placeCurrentWestOf(c, chest);
      // El eco del Get va PRIMERO (resolveBoardGet antes de advanceTurn, que puede
      // añadir mensajes propios de la ronda — p.ej. veneno de la trampa).
      const got = texts(c.playerGet("east"));
      expect(got[0]).not.toBe("Nothing to get!");
      expect(got[0]).not.toBe("Found:");
    }
    // Pila agotada: el siguiente (G)et ya no encuentra nada.
    placeCurrentWestOf(c, chest);
    expect(texts(c.playerGet("east"))).toContain("Nothing to get!");
    expect(c.lootTiles().some((l) => l.x === chest.x && l.y === chest.y)).toBe(false);
  });

  it("(O)pen sobre una celda sin cofre → 'Nothing to open!' (0x8b6c); tras abrir, re-(O)pen sobre la pila tampoco (el botín no es cofre)", () => {
    const { c, chest } = combatWithChest();
    placeCurrentWestOf(c, chest);
    const ev = c.playerOpen("east");
    if (!texts(ev).includes("Found:")) return; // cofre vacío: la celda queda limpia igual
    // La pila de botín NO es un cofre: open_chest_world no encuentra id1 → "Nothing to open!"
    // (salvo cofre anidado, improbable con ratings bajos de araña).
    placeCurrentWestOf(c, chest);
    const again = texts(c.playerOpen("east"));
    expect(again.includes("Nothing to open!") || again.includes("Found:")).toBe(true);
  });

  it("el cofre es IMPASABLE: no se puede mover un miembro encima", () => {
    const { c, chest } = combatWithChest();
    const cur = c.currentUnit!;
    // Coloca al PJ al oeste del cofre e intenta caminar al ESTE (sobre el cofre).
    cur.x = chest.x - 1;
    cur.y = chest.y;
    c.playerMove("east" as never);
    // No se movió a la celda del cofre (sigue al oeste); el cofre sigue ahí.
    const self = c.combatants.find((k) => k.id === cur.id)!;
    expect(self.x === chest.x && self.y === chest.y).toBe(false);
    expect(c.chestAt(chest.x, chest.y)).toBe(true);
  });
});

describe("residual-2 · la ARENA sí consume la acción en los fallos de (G)et/(O)pen", () => {
  // Derivación (COMBAT.OVL, doc en combat.ts): el bucle de turno marca fin-de-acción por
  // DEFECTO tras leer la tecla (`mov [bp-4],1` @0x083e) y el funnel combat_cmd 0x0544
  // DESCARTA el resultado de la rutina SJOG (`sub ax,ax` @0x05b0 → devuelve 0; solo el
  // gate "Can't!" devuelve 1 y re-prompta vía 0x0b56→0x06f1) ⇒ "Nothing to get!/open!"
  // gasta la acción del combatiente. Observable del clon: playerGet/playerOpen SIEMPRE
  // encadenan advanceTurn → el evento `turn` del siguiente actor viene en el retorno
  // (0x24e6 es el reloj del OVERWORLD; la arena no lo usa — ver chest-object.test.ts).

  function toPlayerTurn(c: Combat): void {
    for (let i = 0; i < 40 && c.currentUnit && c.currentUnit.kind !== "player"; i++) {
      c.tickEnemyTurns();
    }
    expect(c.currentUnit?.kind).toBe("player");
  }

  it("(G)et sin cofre → 'Nothing to get!' Y la acción se gasta (advanceTurn emite `turn`)", () => {
    const c = makeCombat();
    toPlayerTurn(c);
    const ev = c.playerGet(null);
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to get!")).toBe(true);
    expect(ev.some((e) => e.kind === "turn")).toBe(true); // funnel 0x5b0 → [bp-4]=1 → siguiente actor
  });

  it("(O)pen sin cofre → 'Nothing to open!' Y la acción se gasta igual", () => {
    const c = makeCombat();
    toPlayerTurn(c);
    const ev = c.playerOpen(null);
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to open!")).toBe(true);
    expect(ev.some((e) => e.kind === "turn")).toBe(true);
  });
});
