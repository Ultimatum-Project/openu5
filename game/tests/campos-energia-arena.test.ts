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
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";

/**
 * CAMPOS DE ENERGÍA de la arena (familia `0xE8-0xEB`) — cierre de la ficha de
 * `re/notes/cargador-ticket-amplio-0xb4-0xe8-0x70.md` §6 (los 26 campos que el binario
 * siembra y el port no sembraba).
 *
 * Derivación (toda careada contra los .asm en el carril campos-energia):
 *   · SIEMBRA: DNGLOOK 0x12bf-0x12c3 clasifica la familia como tipo 2 → fase 2 de
 *     ULTIMA.EXE 0x6506 (0x66a6-0x66b8) escribe sprite CRUDO + X/Y en la tabla de
 *     objetos 0x5C5A; el post-proceso 0x1360 (`cmp si,0x10 / jge`) la manda por la
 *     rama de decorado ⇒ **0 rands**.
 *   · OCUPACIÓN: COMBAT 0x0000 @00a4 `cmp dx,0xeb` → retorno 0 = **0xEB bloquea**;
 *     @00b6 `and al,0xfc / cmp al,0xe8 / je` → **0xE8/E9/EA transparentes**.
 *   · EFECTO POR TURNO: COMBAT 0x1b1e (fase 1 terreno 0x8F/0xBC/0x04; fase 2 objetos
 *     0xE8→veneno, 0xEA→daño rand(0..10), 0xE9→sueño; 0xEB sin efecto), llamado por
 *     el bucle de iniciativa @0x0ca3 al cerrar el turno de CADA actor.
 *   · AN GRAV: CAST2 0x07bc rama combate (0x866-0x8db) — borra UNA ranura por cast.
 *
 * ★ ESPERADOS EN CRUDO. Las posiciones/sprites salen del volcado de DUNGEON.CBT
 * (combatmaps.json, careado byte a byte contra los .CBT crudos en el acta §3:
 * cm18 = Deceit r2 12×0xEB · cm20 = Deceit r4 8×0xE8 · cm121 = Doom r9 6×0xE8) y las
 * semillas/daños de una réplica INDEPENDIENTE en Python de la ley del RNG
 * (re/notes/rng.md: add 0x9248 / ror3 / xor 0x9248 / add 0x11; retorno
 * lo + ((seed & 0x7fff) % span)) — CONTROL POSITIVO: la réplica reproduce el ancla
 * 0xcbbc de siembra-objetos-cbt-353.test.ts (18 pasos desde 0x1234). Ningún esperado
 * se calcula llamando al port.
 */
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}
function room(map: CombatMapData, seed: number, state = freshState()): Combat {
  return new Combat({
    map,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true,
    dungeonFloor: 3,
  });
}
/** Avanza los turnos enemigos hasta que le toque a un PJ (patrón de #353). */
function toPlayerTurn(c: Combat): import("../src/core/combat/combat.js").Combatant {
  for (let guard = 0; c.currentUnit?.kind === "enemy" && guard < 200; guard++) c.tickEnemyTurns();
  const cur = c.currentUnit!;
  expect(cur.kind).toBe("player");
  return cur;
}
function fieldsAt(c: Combat, x: number, y: number): number[] {
  return c
    .lootTiles()
    .filter((l) => l.x === x && l.y === y && (l.tile & 0xfc) === 0xe8)
    .map((l) => l.tile);
}
function fieldCount(c: Combat): number {
  return c.lootTiles().filter((l) => (l.tile & 0xfc) === 0xe8).length;
}
function texts(events: import("../src/core/combat/combat.js").CombatEvent[]): string[] {
  return events
    .filter((e) => e.kind === "message" || e.kind === "attacked")
    .map((e) => (e as { text?: string }).text ?? "");
}
/** Mapa sintético: rejilla 11×11 de hierba (tile 5), arranques de cm20, sin triggers. */
function syntheticMap(units: Array<{ sprite: number; x: number; y: number }>, tileAt55 = 5): CombatMapData {
  const base = combatMaps[20]!;
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 5));
  tiles[5]![5] = tileAt55;
  return { ...base, tiles, units, triggers: [] };
}

const SEED = 0x1234;

describe("campos-energia (a): SIEMBRA cruda de los 26 (cm18/cm20/cm121, filas 5/6/7 del .CBT)", () => {
  it("cm18 (Deceit r2): 12×0xEB apilados 4+4+4 en (4,5)/(5,5)/(6,5)", () => {
    const c = room(combatMaps[18]!, SEED);
    expect(fieldsAt(c, 4, 5)).toEqual([0xeb, 0xeb, 0xeb, 0xeb]);
    expect(fieldsAt(c, 5, 5)).toEqual([0xeb, 0xeb, 0xeb, 0xeb]);
    expect(fieldsAt(c, 6, 5)).toEqual([0xeb, 0xeb, 0xeb, 0xeb]);
    expect(fieldCount(c)).toBe(12);
  });

  it("cm20 (Deceit r4): 8×0xE8 apilados 4+4 en (7,3)/(7,7) — y cm121 (Doom r9): 6×0xE8 en (3,5)", () => {
    const c20 = room(combatMaps[20]!, SEED);
    expect(fieldsAt(c20, 7, 3)).toEqual([0xe8, 0xe8, 0xe8, 0xe8]);
    expect(fieldsAt(c20, 7, 7)).toEqual([0xe8, 0xe8, 0xe8, 0xe8]);
    expect(fieldCount(c20)).toBe(8);
    const c121 = room(combatMaps[121]!, SEED);
    expect(fieldsAt(c121, 3, 5)).toEqual([0xe8, 0xe8, 0xe8, 0xe8, 0xe8, 0xe8]);
    expect(fieldCount(c121)).toBe(6);
  });

  it("TESTIGO sala SIN campo: cm19 (registro vecino de Deceit) siembra CERO campos", () => {
    expect(fieldCount(room(combatMaps[19]!, SEED))).toBe(0);
  });

  it("la siembra consume 0 rands: seed final de cm18 = 0x2623 (4 pool + 4 velocidades), cm121 = 0x3bcc (4 + 10)", () => {
    // Réplica Python independiente (control positivo: 18 pasos desde 0x1234 → 0xcbbc,
    // el ancla de #353). cm18: 4 rand(0,7) del pool 0xEC + 4 velocidades de los 216
    // — los 12 campos NO mueven el stream. cm121: 4 + 10 velocidades (9×240 + 172).
    expect(room(combatMaps[18]!, SEED).rng.rng.getSeed()).toBe(0x2623);
    expect(room(combatMaps[121]!, SEED).rng.rng.getSeed()).toBe(0x3bcc);
  });

  it("el roster NO cambia: cm18 = 4 esqueletos (índice 38) y ni un combatiente-campo", () => {
    const c = room(combatMaps[18]!, SEED);
    const idx = c.combatants.filter((k) => k.kind === "enemy").map((e) => e.enemyDef!.index);
    expect(idx).toEqual([38, 38, 38, 38]); // (216−64)/4, crudo del volcado
  });
});

describe("campos-energia (b): OCUPACIÓN — 0xEB bloquea, 0xE8 transparente (COMBAT:0x0000)", () => {
  it("cm18: pisar el 0xEB de (4,5) desde (4,6) → 'Blocked!' y el PJ no se mueve", () => {
    const c = room(combatMaps[18]!, SEED);
    const cur = toPlayerTurn(c);
    cur.x = 4;
    cur.y = 6;
    const ev = c.playerMove("north");
    expect(texts(ev)).toContain("Blocked!");
    expect([cur.x, cur.y]).toEqual([4, 6]);
  });

  it("CONTROL: cm20 — el MISMO tile de suelo (0x44) bajo un 0xE8 en (7,3) SÍ se pisa", () => {
    // cm18 (4,5) y cm20 (7,3) llevan idéntico terreno 0x44: la diferencia de conducta
    // sólo puede venir del TIPO de campo.
    const c = room(combatMaps[20]!, SEED);
    const cur = toPlayerTurn(c);
    cur.x = 7;
    cur.y = 2;
    const ev = c.playerMove("south");
    expect(texts(ev)).not.toContain("Blocked!");
    expect([cur.x, cur.y]).toEqual([7, 3]);
  });
});

describe("campos-energia (c): EFECTO POR TURNO (COMBAT:0x1b1e vía el cierre de turno 0x0ca3)", () => {
  it("0xE8 (veneno): PJ 'G' sobre el campo → '… poisoned!' y roster 'P', SIN rand (0x18ba rama G)", () => {
    const state = freshState();
    const c = room(syntheticMap([{ sprite: 0xe8, x: 5, y: 5 }]), SEED, state);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    const seedBefore = c.rng.rng.getSeed();
    const ev = c.playerPass();
    expect(texts(ev).some((t) => t.includes("poisoned!"))).toBe(true);
    expect(state.characters[cur.charIdx!]!.status).toBe("P");
    expect(c.rng.rng.getSeed()).toBe(seedBefore); // la rama 'G' no tira (18c9-1902)
  });

  it("0xEA (daño): rand(0..10) de la réplica = 8 con seed 0x1234 → hp −8 y seed final 0xd5d7", () => {
    // Construcción del mapa sintético = 4 rands (pool 0xEC) → seed 0xaa2a; la tirada
    // de daño es el 5º paso: (0xd5d7 & 0x7fff) % 11 = 8. Réplica independiente.
    const c = room(syntheticMap([{ sprite: 0xea, x: 5, y: 5 }]), SEED);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    cur.hp = 30; // el 1º del roster trae 5 hp: 8 de daño lo mataría (0x1574 lethal)
    c.playerPass();
    expect(cur.hp).toBe(22);
    expect(c.rng.rng.getSeed()).toBe(0xd5d7);
  });

  it("0xE9 (sueño): el PJ cae dormido (durmiente 0x68ae), sin RNG — seed intacta 0xaa2a", () => {
    const state = freshState();
    const c = room(syntheticMap([{ sprite: 0xe9, x: 5, y: 5 }]), SEED, state);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    c.playerPass();
    expect(cur.sleeping).toBe(true);
    expect(state.characters[cur.charIdx!]!.status).toBe("S");
    expect(c.rng.rng.getSeed()).toBe(0xaa2a);
  });

  it("0xEB: SIN efecto por turno (la asimetría real de 0x1b1e) — adyacente, nada pasa", () => {
    const state = freshState();
    const c = room(syntheticMap([{ sprite: 0xeb, x: 5, y: 4 }]), SEED, state);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    const hp0 = cur.hp;
    c.playerPass();
    expect(cur.hp).toBe(hp0);
    expect(cur.sleeping).toBe(false);
    expect(state.characters[cur.charIdx!]!.status).toBe("G");
    expect(c.rng.rng.getSeed()).toBe(0xaa2a); // 4 rands del pool y NADA más
  });

  it("FASE 1 terreno: pantano (0x04) envenena — la equivalencia terreno↔objeto del despachador", () => {
    const state = freshState();
    const c = room(syntheticMap([], 0x04), SEED, state);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    c.playerPass();
    expect(state.characters[cur.charIdx!]!.status).toBe("P");
  });

  it("FASE 1 terreno: lava (0x8F) daña con la MISMA tirada que 0xEA — hp −8, seed 0xd5d7", () => {
    const c = room(syntheticMap([], 0x8f), SEED);
    const cur = toPlayerTurn(c);
    cur.x = 5;
    cur.y = 5;
    cur.hp = 30; // ver el caso 0xEA
    c.playerPass();
    expect(cur.hp).toBe(22);
    expect(c.rng.rng.getSeed()).toBe(0xd5d7);
  });
});

describe("campos-energia (d): AN GRAV en combate (CAST2:0x07bc, 0x866-0x8db) — UNA ranura por cast", () => {
  it("cm20 (7,3): 4 casts 'Success!' pelan la pila 4→0; el 5º → 'Failed!'", () => {
    const c = room(combatMaps[20]!, SEED);
    for (let n = 4; n >= 1; n--) {
      const cur = toPlayerTurn(c);
      expect(fieldsAt(c, 7, 3).length).toBe(n);
      const ev = c.playerCast({ kind: "dispelField" }, { x: 7, y: 3 });
      expect(texts(ev)).toContain("Success!");
      expect(fieldsAt(c, 7, 3).length).toBe(n - 1);
      void cur;
    }
    toPlayerTurn(c);
    const ev = c.playerCast({ kind: "dispelField" }, { x: 7, y: 3 });
    expect(texts(ev)).toContain("Failed!");
    // La OTRA pila (7,7) sigue entera: el barrido casa (x,y), no vacía la arena.
    expect(fieldsAt(c, 7, 7).length).toBe(4);
  });

  it("celda sin campo → 'Failed!' (res=0 al tail 0x11a6)", () => {
    const c = room(combatMaps[20]!, SEED);
    toPlayerTurn(c);
    const ev = c.playerCast({ kind: "dispelField" }, { x: 2, y: 2 });
    expect(texts(ev)).toContain("Failed!");
  });
});

describe("campos-energia (e): NO recogibles — cmd_get (SJOG 0x196a-0x197d) no casa la familia 0xe8", () => {
  it("(G)et hacia el 0xE8 de cm20 (7,3) → 'Nothing to get!' y el campo SIGUE", () => {
    const c = room(combatMaps[20]!, SEED);
    const cur = toPlayerTurn(c);
    cur.x = 6;
    cur.y = 3;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Nothing to get!");
    expect(fieldsAt(c, 7, 3).length).toBe(4);
  });
});

/**
 * (f) GATE DEL VENENO POR KIND — COMBAT 0x1c46 `cmp [idx*8+0x5c5a],0x80 / jae` (añadido
 * en la re-adjudicación jugada de cm18/cm20/cm121, carril energia-adjudicacion): la rama
 * 0x32 (veneno) del despacho de 0x1b1e sólo corre con el BYTE DE KIND del actor < 0x80.
 * Enemigo = sprite normalizado (índice<<2)+0x40 == su sprite crudo del .CBT ⇒ el corte
 * exacto está entre el índice 15 (kind 0x7c, ENVENENABLE) y el 16 (kind 0x80, INMUNE).
 * Los monstruos PROPIOS de las salas con campos son 208/176 (cm20) y 240 (cm121), todos
 * ≥ 0x80 ⇒ inmunes al veneno de su propia sala. En enemigos `poison_attack` NO pone
 * status: cae a la rama de DAÑO rand(0..20) / grazed (18c9-190e) — el testigo es el
 * evento AUTO-infligido (actorId == targetId == enemigo), no un status.
 *
 * Mapa CAJA: todo muro 0x4f salvo la celda del campo (5,5) y los 6 arranques "south" de
 * cm20 — el enemigo NO puede salir del campo, así que CIERRA cada turno encima (0x0ca3).
 */
function boxedMap(units: Array<{ sprite: number; x: number; y: number }>): CombatMapData {
  const base = combatMaps[20]!;
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 0x4f));
  const open: Array<[number, number]> = [[5, 5], [3, 5], [2, 6], [2, 4], [1, 5], [0, 6], [0, 4]];
  for (const [x, y] of open) tiles[y]![x] = 0x44;
  return { ...base, tiles, units, triggers: [] };
}
/** Corre `rounds` activaciones (enemigo con su IA real / PJ pasa) y devuelve los eventos. */
function churnRounds(c: Combat, rounds: number): import("../src/core/combat/combat.js").CombatEvent[] {
  const out: import("../src/core/combat/combat.js").CombatEvent[] = [];
  for (let i = 0; i < rounds && !c.over; i++) {
    if (c.currentUnit?.kind === "enemy") out.push(...c.tickEnemyTurns());
    else out.push(...c.playerPass());
  }
  return out;
}
/** Eventos AUTO-infligidos por el enemigo `id` (la firma del veneno de campo en enemigos). */
function selfInflicted(
  ev: import("../src/core/combat/combat.js").CombatEvent[],
  id: number,
): import("../src/core/combat/combat.js").CombatEvent[] {
  return ev.filter(
    (e) =>
      (e.kind === "attacked" || e.kind === "message") &&
      (e as { actorId?: number }).actorId === id &&
      (e as { targetId?: number }).targetId === id,
  );
}

describe("campos-energia (f): gate del veneno por KIND (COMBAT 0x1c46) — los monstruos de sala ≥ 0x80 son INMUNES", () => {
  it("INMUNES: sprites crudos 208 (cm20) y 240 (cm121) encajonados sobre 0xE8 — ni evento ni daño en 12 turnos", () => {
    for (const sprite of [208, 240]) {
      const c = room(boxedMap([{ sprite: 0xe8, x: 5, y: 5 }, { sprite, x: 5, y: 5 }]), SEED);
      const enemy = c.combatants.find((k) => k.kind === "enemy")!;
      expect(enemy.enemyDef!.index).toBe((sprite - 0x40) / 4); // 36 / 44, crudo del .CBT
      const hp0 = enemy.hp;
      const ev = churnRounds(c, 12);
      expect(selfInflicted(ev, enemy.id)).toEqual([]);
      expect(enemy.hp).toBe(hp0);
    }
  });

  it("FRONTERA del jae: kind 0x7c (sprite 124, índice 15) SÍ recibe poison_attack; kind 0x80 (sprite 128, índice 16) NO", () => {
    // Envenenable (< 0x80): en enemigos poison_attack = daño rand(0..20)/grazed AUTO-infligido.
    const cPois = room(boxedMap([{ sprite: 0xe8, x: 5, y: 5 }, { sprite: 124, x: 5, y: 5 }]), SEED);
    const vict = cPois.combatants.find((k) => k.kind === "enemy")!;
    expect(vict.enemyDef!.index).toBe(15);
    const evPois = churnRounds(cPois, 12);
    expect(selfInflicted(evPois, vict.id).length).toBeGreaterThan(0);

    // Primer inmune (== 0x80): mismo tablero, un índice más — nada.
    const cImm = room(boxedMap([{ sprite: 0xe8, x: 5, y: 5 }, { sprite: 128, x: 5, y: 5 }]), SEED);
    const imm = cImm.combatants.find((k) => k.kind === "enemy")!;
    expect(imm.enemyDef!.index).toBe(16);
    const hp0 = imm.hp;
    const evImm = churnRounds(cImm, 12);
    expect(selfInflicted(evImm, imm.id)).toEqual([]);
    expect(imm.hp).toBe(hp0);
  });
});

/**
 * (g) EL TAIL 0x0ca3 ES INCONDICIONAL: el actor que MUERE en su propio turno cierra
 * igual con 0x1b1e sobre su cadáver (cierre de la Clase C de cargador-ticket-amplio §7,
 * carril combate-cabos). Derivado del bucle COMBAT:0x0B94 — entre el call de turno
 * (0x0c84-0x0c90) y `push g_cmb_actor / call 0x1b1e` (0x0c93-0x0ca3) no hay re-check;
 * la muerte (0x1574) NO barre el registro (x,y y [rec+4] quedan; PJ: `or [rec+2],0x20`
 * @0x15e0, corpse 0x1E en la ranura ⇒ kind < 0x80 pasa el gate del veneno 0x1c46).
 * La HUIDA y el ABSORB en cambio SÍ barren (sweep 0x1236: registro a CEROS) y su
 * 0x1b1e es no-op estructural — el censo-guarda de la esquina (0,0) de abajo es el
 * control que mantiene viva esa refutación.
 *
 * VECTOR alcanzable: trampa ACID de un cofre de la arena (open_chest_world 0x112C;
 * su cola 0x122c-0x1296 mata al que abre marcando el bit 0x20 — el port lo calca en
 * resyncPartyHpFromRoster → killByRosterDeath).
 *
 * ★ ESPERADOS EN CRUDO (réplica Python independiente de la ley del RNG, re/notes/rng.md
 * — control positivo: reproduce los anclajes 0xaa2a/0xd5d7 de (c)): SEED 0x1dba →
 * 4 rands de construcción → trap type rand(0,1)=0 (ACID) → rand(0,60)=1 ⇒ daño 1 →
 * chestLoot(0): 1×rand(0,47) (guardas > 0, sin botín) ⇒ seed tras abrir = 0x51da.
 * El tick del cadáver consume UNA tirada más (veneno rand(0,20)=8 / daño rand(0,10)=4;
 * el avance de seed no depende del span) ⇒ seed final = 0xcedd. Sueño (0xE9): 0x68ae
 * exento por 'D' (0x68d9) ⇒ CERO tiradas, seed final = 0x51da.
 */
const G_SEED = 0x1dba;
function trapKillOnField(fieldSprite: number | null): {
  c: Combat;
  cur: import("../src/core/combat/combat.js").Combatant;
  state: GameState;
  ev: import("../src/core/combat/combat.js").CombatEvent[];
} {
  const state = freshState();
  const units = fieldSprite !== null ? [{ sprite: fieldSprite, x: 5, y: 5 }] : [];
  const c = room(syntheticMap(units), G_SEED, state);
  const cur = toPlayerTurn(c);
  cur.x = 5;
  cur.y = 5;
  cur.hp = 1;
  state.characters[cur.charIdx!]!.currentHp = 1;
  // Cofre CON TRAMPA en (5,4), contenido 0 (chestLoot(0) = 1 rand, sin botín) — la capa
  // es la misma que usan los restos de matar (white-box de siembra, flujo de apertura
  // 100 % público).
  (c as unknown as { lootLayer: Map<string, number> }).lootLayer.set("5:4", 0x81);
  const ev = c.playerOpen("north");
  return { c, cur, state, ev };
}

describe("campos-energia (g): el actor que MUERE en su propio turno cierra con 0x1b1e sobre el cadáver (tail 0x0ca3 incondicional)", () => {
  it("VECTOR: la trampa ACID mata al que abre (hp 1) — 'Trapped!' + 'ACID!' y roster 'D'", () => {
    const { cur, state, ev } = trapKillOnField(null);
    expect(texts(ev)).toContain("Trapped!");
    expect(texts(ev)).toContain("ACID!");
    expect(state.characters[cur.charIdx!]!.status).toBe("D");
    expect(cur.status).toBe("dead");
  });

  it("0xE8 bajo el cadáver: UNA tirada rand(0,20) más (0x18ba rama no-'G') — seed 0xcedd y evento sobre el muerto", () => {
    const { c, cur, ev } = trapKillOnField(0xe8);
    expect(cur.status).toBe("dead");
    expect(c.rng.rng.getSeed()).toBe(0xcedd); // 0x51da + la tirada del tick (réplica)
    // El tick es OBSERVABLE sobre el cadáver: rand=8 ⇒ applyDamage letal (hp 0 ≤ 8) ⇒
    // attacked + died idempotentes con target = el muerto (la realimentación del port
    // donde el binario emite el cue 0x92d4 no derivado).
    const onCorpse = ev.filter(
      (e) => (e.kind === "attacked" || e.kind === "died") && (e as { targetId?: number }).targetId === cur.id,
    );
    expect(onCorpse.length).toBeGreaterThan(0);
    // Y el status del roster no se resucita ni se muta: sigue 'D'.
  });

  it("CONTROL (gemelo sin campo): cadáver sobre hierba — CERO tiradas extra, seed 0x51da", () => {
    const { c, cur } = trapKillOnField(null);
    expect(cur.status).toBe("dead");
    expect(c.rng.rng.getSeed()).toBe(0x51da); // sólo construcción + trampa + botín
  });

  it("0xEA bajo el cadáver: rand(0,10) + 0x1574 idempotente — seed 0xcedd (mismo avance, otro span)", () => {
    const { c, cur } = trapKillOnField(0xea);
    expect(cur.status).toBe("dead");
    expect(c.rng.rng.getSeed()).toBe(0xcedd);
  });

  it("0xE9 bajo el cadáver: durmiente 0x68ae EXENTO por 'D' (0x68d9) — sin rand (0x51da), sin flag de sueño", () => {
    const { c, cur, state } = trapKillOnField(0xe9);
    expect(cur.status).toBe("dead");
    expect(c.rng.rng.getSeed()).toBe(0x51da);
    expect(cur.sleeping).toBe(false);
    expect(state.characters[cur.charIdx!]!.status).toBe("D"); // no pasa a 'S'
  });

  it("CENSO-GUARDA de la refutación (huida/absorb): la celda (0,0) de los 128 combatmaps nunca es dañina ni lleva campo", () => {
    // El registro barrido por 0x1236 deja x=y=0 ⇒ el 0x1b1e del huido lee la esquina
    // (0,0). Este censo es lo que hace NO-OP esa lectura — si algún mapa cambiara,
    // el gate de `advanceTurn` sobre "fled"/"absorbed" dejaría de ser equivalente.
    const daniny = combatMaps.filter((m) => [0x04, 0x8f, 0xbc].includes(m.tiles[0]![0]!));
    const campo00 = combatMaps.filter((m) =>
      (m.units ?? []).some((u) => (u.sprite & 0xfc) === 0xe8 && u.x === 0 && u.y === 0),
    );
    expect(daniny.length).toBe(0);
    expect(campo00.length).toBe(0);
    expect(combatMaps.length).toBe(128); // población completa, no una vista
  });
});
