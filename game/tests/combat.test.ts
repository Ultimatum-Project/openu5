/**
 * Tests del motor de combate (Fase 5) con datos REALES: data.json (ENEMY_STATS/
 * FLAGS), AdditionalEnemyFlags.json (XP/eras), combatmaps.json (mapa CampFire) y
 * la party inicial de initial-state.json (Avatar+Shamino+Iolo).
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
import { tileInfo } from "../src/core/tiles.js";
import { RING_INVIS } from "../src/core/equip.js";
import { Rng } from "../src/core/combat/rng.js";
import type { RandFn } from "../src/core/world/survival.js";
import {
  shouldSpawnEnemy,
  pickSpawnEnemy,
  tileToMonsterId,
  weightedPick,
  SPAWN_TABLES,
  combatMapForTile,
  CombatMapIndex,
} from "../src/core/combat/encounters.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
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

/** Party de combate a partir del estado inicial, con un arma melee simple. */
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({
      charIdx: i,
      record,
      weapons: [{ attack: 10, range: 1 }],
    }));
}

const campFire = (): CombatMapData => combatMaps[0]!;

// --------------------------------------------------------------- enemies ---

describe("buildEnemyDefs", () => {
  it("construye las 48 definiciones", () => {
    expect(defs()).toHaveLength(48);
  });

  it("stats reales del primer enemigo (Mage, índice 0)", () => {
    const mage = defs()[0]!;
    expect(mage.name).toBe("Mage");
    expect(mage.str).toBe(10);
    expect(mage.dex).toBe(15);
    expect(mage.int).toBe(20);
    expect(mage.armour).toBe(0);
    expect(mage.damage).toBe(15);
    expect(mage.hp).toBe(10);
    expect(mage.maxPerMap).toBe(3);
    expect(mage.treasure).toBe(20);
    expect(mage.attackRange).toBe(7);
    expect(mage.experience).toBe(3);
    expect(mage.tile).toBe(320); // 320 + 0*4
    expect(mage.abilities.rangedMagic).toBe(true); // máscara 0x0080
  });

  it("máscara de habilidades: Skeleton es no-muerto (Undead 0x2000)", () => {
    const skel = byName("Skeleton");
    expect(skel.abilities.undead).toBe(true);
    expect(skel.abilities.divideOnHit).toBe(false);
    expect(skel.experience).toBe(6);
  });

  it("máscara de habilidades: Slime se divide (DivideOnHit 0x1000)", () => {
    const slime = byName("Slime");
    expect(slime.abilities.divideOnHit).toBe(true);
  });

  it("el mapping tile→sprite sigue 320 + i*4 (Skeleton idx33 → 452)", () => {
    expect(byName("Skeleton").tile).toBe(320 + 33 * 4);
    expect(byName("Dragon").tile).toBe(320 + 39 * 4);
  });

  it("stats reales de un Dragón", () => {
    const dragon = byName("Dragon");
    expect(dragon.str).toBe(30);
    expect(dragon.armour).toBe(10);
    expect(dragon.damage).toBe(30);
    expect(dragon.hp).toBe(99);
    expect(dragon.attackRange).toBe(9);
    expect(dragon.experience).toBe(25);
  });
});

// ---------------------------------------------------------------- combat ---

describe("Combat — pelea sintética determinista", () => {
  it("la party vence a una araña débil en CampFire sin excepciones", () => {
    const state = freshState();
    const expBefore = state.characters.map((c) => c.exp);
    const spider = byName("Giant Spider"); // dex10, hp10, melee
    const combat = new Combat({
      map: campFire(),
      entryDirection: "east",
      party: party(state),
      enemies: [{ def: spider, count: 1 }],
      seed: 12345,
      state,
      defenseValues: data.defenseValues,
    });

    // La iniciativa ordena por dex descendente: los 3 primeros turnos son los 3
    // PJs por dex (Shamino22, Iolo21, Avatar15) antes de que la araña (dex10) o
    // los turnos extra por dex alta reaparezcan más abajo en la cola.
    const dexes = combat.turnOrderPreview(3).map((c) => c.dex);
    expect(dexes).toEqual([22, 21, 15]);

    const events: CombatEvent[] = [];
    let ticks = 0;
    // La VICTORIA (bando enemigo limpio) NO cierra el combate: se combate hasta victoria,
    // luego la party quedaría en el tablero para recoger botín y salir andando (linger).
    while (!combat.victory && !combat.over && ticks < 200) {
      ticks++;
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "enemy") {
        events.push(...combat.tickEnemyTurns());
        continue;
      }
      // PJ: si hay un enemigo adyacente, atacarlo; si no, esperar a que la araña
      // (que no huye) se acerque. Evita bloqueos de pathing naïf en el test.
      const foe = combat.combatants.find(
        (c) => c.kind === "enemy" && c.status === "active",
      );
      const dist = foe
        ? Math.max(Math.abs(cur.x - foe.x), Math.abs(cur.y - foe.y))
        : Infinity;
      if (foe && dist <= 1) events.push(...combat.playerAttack(foe.x, foe.y));
      else events.push(...combat.playerPass());
    }

    expect(combat.victory).toBe(true);
    expect(combat.over).toBe(false); // linger: sigues en el tablero tras la victoria
    expect(ticks).toBeLessThan(200);

    // El daño nunca supera el techo de 99.
    for (const e of events) {
      if (e.kind === "attacked" && e.damage !== undefined) {
        expect(e.damage).toBeLessThanOrEqual(99);
      }
    }

    // XP SOLO al que da el golpe mortal, aplicada al roster en el momento
    // del golpe (COMBAT:0x1574 167a + 0x194A 1a2e-1a51): maxHP/4+1 = 3.
    const spoils = combat.collectSpoils();
    expect(spoils.xpByChar.size).toBe(1);
    const [killerIdx, xp] = [...spoils.xpByChar.entries()][0]!;
    expect(xp).toBe((spider.hp >> 2) + 1);
    state.characters.forEach((c, i) => {
      const expected = i === killerIdx ? expBefore[i]! + xp : expBefore[i]!;
      expect(c.exp).toBe(expected);
    });
    // Se registró un evento de muerte del enemigo.
    expect(events.some((e) => e.kind === "died")).toBe(true);

    // §4: el enemigo muerto en TIERRA deja un objeto VISIBLE en su celda — cofre
    // (tile 1) o charco de sangre (0x1F). Antes el drop se rolaba pero no se
    // pintaba (botín invisible en la arena); ahora sale por `lootTiles()`.
    const loot = combat.lootTiles();
    expect(loot.length).toBe(1);
    expect([0x1f, 0x01]).toContain(loot[0]!.tile);
  });

  it("glass sword (0x27) contra un no-muerto: 99 SIN mitad (g_5890)", () => {
    // COMSUBS:0x0C52 0c59-0c5f: arma id >= 0x23 activa g_5890 y anula la
    // mitad de daño de los no-muertos (COMBAT:0x1574 161a-1631).
    const state = freshState();
    const skeleton = byName("Skeleton"); // undead (flag LE 0x20)
    const combat = new Combat({
      map: campFire(),
      entryDirection: "east",
      party: [
        {
          charIdx: 0,
          record: state.characters[0]!,
          weapons: [{ id: 0x27, attack: 99, range: 1 }],
        },
      ],
      enemies: [{ def: skeleton, count: 1 }],
      seed: 42,
      state,
      defenseValues: data.defenseValues,
    });
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    player.x = 5;
    player.y = 5;
    enemy.x = 6;
    enemy.y = 5;
    // Fuerza la iniciativa: el PJ actúa primero.
    player.counter = 1;
    enemy.counter = 200;
    expect(combat.currentUnit).toBe(player);
    const events = combat.playerAttack(enemy.x, enemy.y);
    // Auto-hit + 99 fijo ignorando armadura Y la mitad de no-muerto.
    const hit = events.find((e) => e.kind === "attacked");
    expect(hit?.damage).toBe(99);
    expect(enemy.status).toBe("dead");
    expect(events.some((e) => e.text === "Thy sword hath shattered!")).toBe(true);
  });
});

const bay = (): CombatMapData => combatMaps.find((m) => m.name === "Bay")!;
const mountains = (): CombatMapData =>
  combatMaps.find((m) => m.name === "Mountains")!;

describe("Combat — ataque a distancia (arco) y targeting por dirección", () => {
  // Escenario EXACTO del soak: enemigo acuático en el Bay (mapa 15), inalcanzable
  // a pie porque el party no pisa agua (tilePassableFor player = walkable). El
  // motor ya modela alcance/raycast; estos tests cubren `playerAttackDir` (el
  // teclado A+flecha reenganchado) y cierran el combate antes inmatable.
  function bayFight(weapon: { id?: number; attack: number; range: number }) {
    const state = freshState();
    const serpent = byName("Sea Serpent"); // isWater = true
    const combat = new Combat({
      map: bay(),
      entryDirection: "east",
      party: [{ charIdx: 0, record: state.characters[0]!, weapons: [weapon] }],
      enemies: [{ def: serpent, count: 1 }],
      seed: 7,
      state,
      defenseValues: data.defenseValues,
    });
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    // Party en tierra (4,7); serpiente en AGUA (6,7), a 2 casillas en línea Este.
    // (Bay: fila 7 = LLLLLLwwwLL → x0-5 tierra, x6-8 agua.)
    player.x = 4;
    player.y = 7;
    player.speed = 99; // DEX alta → hitThreshold negativo → acierto garantizado
    enemy.x = 6;
    enemy.y = 7;
    enemy.hp = 1;
    enemy.maxHp = 1;
    // El PJ actúa primero (fuerza iniciativa, como el test del glass sword).
    player.counter = 1;
    enemy.counter = 200;
    return { combat, player, enemy };
  }

  it("aimGeometry: cursor arranca sobre el PROPIO actor; el último objetivo recordado lo captura (COMSUBS 0x0504)", () => {
    // RE-BASELINE hotfix #4: el «enemigo más cercano» era fabricado — 0x0504
    // @0x0511-0x0568 usa el ÚLTIMO OBJETIVO (scratch 0x5C61, `lastTargetId`) si
    // sigue vivo y en alcance, y si no la celda del actor (@0x0562).
    const { combat, player, enemy } = bayFight({ id: 0x1a, attack: 99, range: 3 });
    expect(combat.currentUnit).toBe(player); // resuelve el turno del PJ (como la UI)
    const geo = combat.aimGeometry()!;
    expect(geo).not.toBeNull();
    expect(geo.actor).toEqual({ x: player.x, y: player.y });
    expect(geo.range).toBe(3);
    expect(geo.initial).toEqual({ x: player.x, y: player.y }); // sin memoria → actor
    player.lastTargetId = enemy.id; // con memoria y en alcance → el recordado
    expect(combat.aimGeometry()!.initial).toEqual({ x: enemy.x, y: enemy.y });
    // Sigue siendo el turno del PJ: aimGeometry no lo avanza.
    expect(combat.currentUnit).toBe(player);
  });

  it("aimGeometry: objetivo recordado FUERA de alcance → cursor sobre el actor", () => {
    // Melé (range 1): la serpiente a 2 casillas queda FUERA de alcance → aunque
    // esté recordada, el cursor cae a la propia celda del actor (@0x0562).
    const { combat, player, enemy } = bayFight({ attack: 99, range: 1 });
    expect(combat.currentUnit).toBe(player);
    player.lastTargetId = enemy.id;
    const geo = combat.aimGeometry()!;
    expect(geo.range).toBe(1);
    expect(geo.initial).toEqual({ x: player.x, y: player.y });
  });

  it("A+dirección con arco mata al enemigo acuático a 2 casillas (playerAttackDir)", () => {
    const { combat, player, enemy } = bayFight({ id: 0x1a, attack: 99, range: 3 });
    // La celda del enemigo es agua: a pie no hay melé posible; sólo el arco llega.
    expect(combat.currentUnit).toBe(player);
    const events = combat.playerAttackDir(1, 0); // Este: escanea (5,7) vacía → (6,7)
    const hit = events.find((e) => e.kind === "attacked" && e.hit);
    expect(hit).toBeTruthy();
    expect(hit!.targetId).toBe(enemy.id);
    expect(enemy.status).toBe("dead");
    expect(combat.victory).toBe(true); // bando enemigo limpio → victoria latcheada
    expect(combat.over).toBe(false); // pero el combate NO cierra: linger + salida por borde
  });

  it("melé apuntando a la casilla del acuático (dist 2) → 'Out of range.'", () => {
    const { combat, enemy } = bayFight({ attack: 99, range: 1 });
    const events = combat.playerAttack(enemy.x, enemy.y);
    expect(
      events.some((e) => e.kind === "message" && e.text === "Out of range."),
    ).toBe(true);
    expect(enemy.status).toBe("active");
  });

  it("melé con A+dirección hacia el acuático (dist 2) → celda adyacente vacía = 'Nothing!'", () => {
    const { combat, enemy } = bayFight({ attack: 99, range: 1 });
    // range 1 → escanea sólo (5,7), vacía → apunta ahí → "Nothing!" (no llega).
    const events = combat.playerAttackDir(1, 0);
    expect(
      events.some((e) => e.kind === "message" && e.text === "Nothing!"),
    ).toBe(true);
    expect(enemy.status).toBe("active");
  });

  it("el proyectil vuela hasta el muro opaco y se DESPERDICIA (sin texto fabricado)", () => {
    // Mountains (mapa 6), fila 7 = LXXLLLLLXXL: montañas en x1,x2 (no rangepass).
    const state = freshState();
    const skeleton = byName("Skeleton"); // land enemy
    const combat = new Combat({
      map: mountains(),
      entryDirection: "east",
      party: [
        {
          charIdx: 0,
          record: state.characters[0]!,
          weapons: [{ id: 0x1a, attack: 99, range: 3 }],
        },
      ],
      enemies: [{ def: skeleton, count: 1 }],
      seed: 7,
      state,
      defenseValues: data.defenseValues,
    });
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    player.x = 3;
    player.y = 7;
    player.speed = 99;
    enemy.x = 0; // a 3 casillas al Oeste, tras las montañas x1/x2
    enemy.y = 7;
    player.counter = 1;
    enemy.counter = 200;
    state.equipmentQuantities[0x1b] = 10; // 10 flechas antes del disparo
    // A+Oeste: escanea (2,7)/(1,7) vacías → apunta al esqueleto en (0,7); el proyectil
    // vuela y se DETIENE en la montaña opaca (2,7) → tiro DESPERDICIADO: SIN «Blocked by
    // wall!» (era fabricado), sin golpe, gasta munición + turno y anima el vuelo.
    const events = combat.playerAttackDir(-1, 0);
    expect(events.some((e) => e.kind === "message" && e.text === "Blocked by wall!")).toBe(false);
    expect(events.some((e) => e.kind === "attacked")).toBe(false); // no golpea a nadie
    expect(events.some((e) => e.kind === "projectile")).toBe(true); // vuela hasta el muro
    expect(enemy.status).toBe("active"); // el esqueleto sale ileso
    expect(state.equipmentQuantities[0x1b]).toBe(9); // la flecha se gastó (per-shot)
  });

  it("melé con A+dirección sigue golpeando al enemigo adyacente (sin regresión)", () => {
    const state = freshState();
    const skeleton = byName("Skeleton");
    const combat = new Combat({
      map: campFire(),
      entryDirection: "east",
      party: [
        {
          charIdx: 0,
          record: state.characters[0]!,
          weapons: [{ attack: 99, range: 1 }],
        },
      ],
      enemies: [{ def: skeleton, count: 1 }],
      seed: 7,
      state,
      defenseValues: data.defenseValues,
    });
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    player.x = 5;
    player.y = 5;
    player.speed = 99;
    enemy.x = 6;
    enemy.y = 5;
    enemy.hp = 1;
    enemy.maxHp = 1;
    player.counter = 1;
    enemy.counter = 200;
    const events = combat.playerAttackDir(1, 0); // Este: enemigo adyacente
    const hit = events.find((e) => e.kind === "attacked" && e.hit);
    expect(hit?.targetId).toBe(enemy.id);
    expect(enemy.status).toBe("dead");
  });
});

describe("Combat — consumo de munición (fix #51, COMSUBS:0x097C)", () => {
  const ARROWS = 0x1b;
  const QUARRELS = 0x1d;
  const BOW = 0x1a;
  const CROSSBOW = 0x1c;
  const DAGGER = 0x10; // arma de arrojar (range 3)
  const NOTHING = 0xff;

  /** Fight en el Bay con el arma `weapon` equipada en la mano del Avatar y el
   *  enemigo acuático a `dist` casillas al Este en línea despejada. */
  function ammoFight(
    weapon: { id: number; attack: number; range: number },
    opts: {
      arrows?: number;
      quarrels?: number;
      spares?: number;
      dist?: number;
      enemyHp?: number;
      seed?: number;
      /** Arma equipada al SEGUNDO miembro (Shamino, charIdx 1) — para el barrido de #36. */
      companionWeapon?: number;
    } = {},
  ) {
    const state = freshState();
    const serpent = byName("Sea Serpent");
    // Equipa el arma en la mano (para que el desequipado la encuentre) y fija
    // el inventario compartido de munición.
    state.characters[0]!.weapon = weapon.id;
    if (opts.arrows !== undefined) state.equipmentQuantities[ARROWS] = opts.arrows;
    if (opts.quarrels !== undefined) state.equipmentQuantities[QUARRELS] = opts.quarrels;
    if (opts.spares !== undefined) state.equipmentQuantities[weapon.id] = opts.spares;
    const party: PartyCombatant[] = [
      { charIdx: 0, record: state.characters[0]!, weapons: [weapon] },
    ];
    if (opts.companionWeapon !== undefined) {
      state.characters[1]!.weapon = opts.companionWeapon;
      party.push({
        charIdx: 1,
        record: state.characters[1]!,
        weapons: [{ id: opts.companionWeapon, attack: 20, range: 3 }],
      });
    }
    const combat = new Combat({
      map: bay(),
      entryDirection: "east",
      party,
      enemies: [{ def: serpent, count: 1 }],
      seed: opts.seed ?? 7,
      state,
      defenseValues: data.defenseValues,
    });
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    const dist = opts.dist ?? 2;
    player.x = 4;
    player.y = 7;
    player.speed = 99; // acierto garantizado
    enemy.x = 4 + dist;
    enemy.y = 7;
    enemy.hp = opts.enemyHp ?? 99; // no muere en 1 disparo salvo que se pida
    enemy.maxHp = enemy.hp;
    player.counter = 1;
    enemy.counter = 200;
    // El acompañante no debe robarle el turno al Avatar (el disparo que se mide es el suyo).
    for (const c of combat.combatants) if (c !== player && c.kind === "player") c.counter = 200;
    return { combat, player, enemy, state };
  }

  it("bow decrementa Arrows en 1 por disparo", () => {
    const { combat, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 5 });
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[ARROWS]).toBe(4);
  });

  it("crossbow decrementa Quarrels por disparo", () => {
    const { combat, state } = ammoFight({ id: CROSSBOW, attack: 20, range: 3 }, { quarrels: 3 });
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[QUARRELS]).toBe(2);
  });

  it("al agotar Arrows (0), desequipa el arco y lo devuelve al pack — SIN aviso (COMSUBS 09a2-09ab)", () => {
    const { combat, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 1 });
    const bowBefore = state.equipmentQuantities[BOW] ?? 0;
    const events = combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[ARROWS]).toBe(0);
    // Desequipado de la mano del Avatar…
    expect(state.characters[0]!.weapon).toBe(NOTHING);
    // …y devuelto al inventario compartido (COMSUBS 09a2-09ab).
    expect(state.equipmentQuantities[BOW]).toBe(bowBefore + 1);
    // El binario NO imprime en el desequipado por munición agotada: cae del `dec`/`jne`
    // al `call` de desequipado y RETorna (0x09af) sin string. El "out of ammunition!" era
    // FABRICADO (la única cadena de munición, DS 0x981c, es del (R)eady en ZSTATS).
    expect(events.some((e) => e.kind === "message" && /ammunition/i.test(e.text ?? ""))).toBe(false);
  });

  // ── #36: el alcance del desequipado por munición agotada ────────────────────────────
  // COMSUBS 0x09a2-0x09ab llama a SJOG.OVL:0x1b34 (barrido `si < g_party_size` sobre
  // ULTIMA.EXE:0x6e60) y hace `add byte[arma+0x57c0], al` con AL = el CONTEO devuelto.
  // Hasta #36 el clon desarmaba sólo al tirador y sumaba 1 con un tope 99 que el `add`
  // de byte no tiene. Los tres tests de abajo separan las tres mitades del defecto.

  it("#36 munición a 0: el desequipado barre al PARTY ENTERO y devuelve N (SJOG 0x1b34 + 0x09ab)", () => {
    const { combat, state } = ammoFight(
      { id: BOW, attack: 20, range: 3 },
      { arrows: 1, companionWeapon: BOW },
    );
    // La POBLACIÓN del barrido es explícita: el bucle del binario va a g_party_size.
    expect(state.partySize).toBeGreaterThanOrEqual(2);
    const bowBefore = state.equipmentQuantities[BOW] ?? 0;
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[ARROWS]).toBe(0);
    expect(state.characters[0]!.weapon).toBe(NOTHING); // el tirador
    expect(state.characters[1]!.weapon).toBe(NOTHING); // …y el acompañante, que no disparó
    expect(state.equipmentQuantities[BOW]).toBe(bowBefore + 2); // N = 2, no 1
  });

  it("#36 el barrido es por ID DE ARMA: el Magic Bow sobrevive al agotarse las flechas del Bow", () => {
    // Es la vía por la que #18 (underflow a 255) SIGUE siendo alcanzable: Bow 0x1a y
    // Magic Bow 0x24 comparten el pool de Arrows pero son ids distintos, así que el
    // barrido de uno no toca al otro y el segundo tirador dispara sobre 0.
    const MAGIC_BOW = 0x24;
    const { combat, state } = ammoFight(
      { id: BOW, attack: 20, range: 3 },
      { arrows: 1, companionWeapon: MAGIC_BOW },
    );
    const magicBefore = state.equipmentQuantities[MAGIC_BOW] ?? 0;
    combat.playerAttackDir(1, 0);
    expect(state.characters[0]!.weapon).toBe(NOTHING);
    expect(state.characters[1]!.weapon).toBe(MAGIC_BOW); // intacto
    expect(state.equipmentQuantities[MAGIC_BOW]).toBe(magicBefore); // no se devuelve nada suyo
  });

  it("#36 la devolución al pack NO lleva tope: `add byte` pelado (el 99 es del (R)eady, ZSTATS 0x0ccd)", () => {
    const { combat, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 1 });
    state.equipmentQuantities[BOW] = 99; // justo en el tope que el helper viejo imponía
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[BOW]).toBe(100);
  });

  it("#36 CONTROL: la rama de arrojadizas sigue siendo SÓLO del actor (0x09e2, un solo sujeto)", () => {
    // El contraste es el dato: mismo callee del kernel (0x6e60), invocado con el party
    // entero en la munición y con UN sujeto en la arrojadiza. Si el fix del barrido se
    // hubiera colado en esta rama, el puñal del acompañante también desaparecería.
    const { combat, state } = ammoFight(
      { id: DAGGER, attack: 20, range: 3 },
      { spares: 0, dist: 2, companionWeapon: DAGGER },
    );
    combat.playerAttackDir(1, 0);
    expect(state.characters[0]!.weapon).toBe(NOTHING); // el que lo lanzó
    expect(state.characters[1]!.weapon).toBe(DAGGER); // el acompañante conserva el suyo
    expect(state.equipmentQuantities[DAGGER]).toBe(0); // y no vuelve nada al pack
  });

  it("arma de arrojar a dist>1 con reservas: gasta 1 reserva y sigue equipada", () => {
    const { combat, state } = ammoFight({ id: DAGGER, attack: 20, range: 3 }, { spares: 2, dist: 2 });
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[DAGGER]).toBe(1); // 2 → 1
    expect(state.characters[0]!.weapon).toBe(DAGGER); // sigue en la mano
  });

  it("arma de arrojar a dist>1 sin reservas: lanza la última y se PIERDE (no vuelve al pack)", () => {
    const { combat, state } = ammoFight({ id: DAGGER, attack: 20, range: 3 }, { spares: 0, dist: 2 });
    combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[DAGGER]).toBe(0); // no se devuelve
    expect(state.characters[0]!.weapon).toBe(NOTHING); // desequipada (09ce)
  });

  it("arma de arrojar a dist 1 (melé adyacente) NO consume", () => {
    const { combat, state } = ammoFight({ id: DAGGER, attack: 20, range: 3 }, { spares: 2, dist: 1 });
    combat.playerAttackDir(1, 0); // enemigo adyacente al Este
    expect(state.equipmentQuantities[DAGGER]).toBe(2); // intacto
    expect(state.characters[0]!.weapon).toBe(DAGGER);
  });

  it("un enemigo disparando a distancia NO gasta la munición del party", () => {
    // La IA usa strike directo (nunca attackWith), así que su disparo no toca
    // equipmentQuantities. Seguro para la paridad.
    const { combat, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 5 });
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    // Turno del enemigo (Sea Serpent range 9, dispara a distancia).
    enemy.counter = 1;
    combat.combatants.filter((c) => c.kind === "player").forEach((p) => (p.counter = 200));
    combat.tickEnemyTurns();
    expect(state.equipmentQuantities[ARROWS]).toBe(5); // sin cambios
  });

  it("2º disparo con la reserva a 0 hace UNDERFLOW a 255 (bug-for-bug, COMSUBS:0x099c dec+jne): arma sigue equipada", () => {
    // Bug PORTADO por contrato (docs/FIDELITY-CONTRACT.md, política bug-for-bug). El
    // binario hace `dec` sobre 0 → 255 (0x099c) y el `jne` que sigue NO cae al desequipado
    // (ZF=0 con 255): el arco queda equipado y el party gana 255 flechas gratis (#18).
    const { combat, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 0 });
    const events = combat.playerAttackDir(1, 0);
    expect(state.equipmentQuantities[ARROWS]).toBe(255); // dec sobre 0 → 255 (NO clamp a 0)
    expect(state.characters[0]!.weapon).toBe(BOW); // el arco NO se desequipa (jne no cae al desequipado)
    expect(
      events.some((e) => e.kind === "message" && /ammunition/i.test(e.text ?? "")),
    ).toBe(false);
  });

  it("un disparo que FALLA gasta munición igual (per-shot, no por hit)", () => {
    // La afirmación estrella: el cobro es en 0x0B3D, ANTES del hit de 0x0B51.
    // seed 0: la dispersión del proyectil fallado (COMSUBS:0x0822, celda aleatoria
    // adyacente al objetivo) cae en vacío → evento "missed!" limpio (hit=false).
    const { combat, player, enemy, state } = ammoFight({ id: BOW, attack: 20, range: 3 }, { arrows: 5, seed: 0 });
    // Fuerza el FALLO de la TIRADA: atacante DEX 1 vs defensor "defensa" 40 →
    // hitThreshold = (40 − 1 + 30) >> 1 = 34 > 30 (máx de rand30) → SIEMPRE falla.
    player.speed = 1;
    enemy.speed = 40;
    const events = combat.playerAttackDir(1, 0);
    const shot = events.find((e) => e.kind === "attacked");
    expect(shot?.hit).toBe(false); // el disparo falló…
    expect(state.equipmentQuantities[ARROWS]).toBe(4); // …pero gastó la flecha igual
  });
});

describe("Combat — huida de enemigos", () => {
  it("un enemigo en estado critical huye hacia el borde y desaparece", () => {
    const state = freshState();
    const spider = byName("Giant Spider");
    const combat = new Combat({
      map: campFire(),
      entryDirection: "east",
      party: [party(state)[0]!], // un solo PJ
      enemies: [{ def: spider, count: 1 }],
      seed: 999,
      state,
      defenseValues: data.defenseValues,
    });

    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    const player = combat.combatants.find((c) => c.kind === "player")!;
    // Colocamos al enemigo en el centro, al PJ en una esquina lejana, y lo
    // dejamos "critical" (hp < maxHP/4): la clasificación exacta de heridas
    // (COMBAT:0x1A5C) es la que mantiene el flag de huida turno a turno.
    enemy.x = 5;
    enemy.y = 5;
    enemy.hp = 1;
    enemy.maxHp = 99; // umbral critical = 24: la curación 1/4 por turno no lo saca de la huida
    enemy.isFleeing = true;
    player.x = 0;
    player.y = 0;

    const border = (c: { x: number; y: number }) =>
      Math.min(c.x, 10 - c.x, c.y, 10 - c.y);
    const startDist = border(enemy);

    let ticks = 0;
    while (!combat.over && ticks < 100) {
      ticks++;
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "enemy") combat.tickEnemyTurns();
      else combat.playerPass();
    }

    expect(enemy.status).toBe("fled");
    expect(combat.victory).toBe(true);
    expect(startDist).toBeGreaterThan(0);
  });

  it("playerEscape rechaza salir por un borde distinto al primero EN SALA DE MAZMORRA", () => {
    // La restricción "All must use the same exit!" es CONTEXTUAL (SJOG 0x1c04, gate
    // `test [g_unk_58a1],0x80`): SÓLO en combate de SALA (g_unk_58a1=0x82, DUNGEON.OVL
    // 0x00bf), no en campo. Aquí se prueba la SALA (roomCombat:true). Ver combat-exit-gating.
    const state = freshState();
    const spider = byName("Giant Spider");
    const combat = new Combat({
      map: campFire(),
      entryDirection: "east",
      party: party(state),
      enemies: [{ def: spider, count: 1 }],
      seed: 7,
      state,
      defenseValues: data.defenseValues,
      roomCombat: true,
    });

    // Primer PJ (Shamino, dex más alta) huye por el norte: se acepta.
    const first = combat.currentUnit!;
    expect(first.kind).toBe("player");
    const ev1 = combat.playerEscape("north");
    expect(ev1.some((e) => e.text === "Escape!")).toBe(true);
    expect(first.status).toBe("fled");

    // Siguiente PJ intenta huir por el sur: se rechaza ("misma salida", sólo en sala).
    const second = combat.currentUnit!;
    expect(second.kind).toBe("player");
    const ev2 = combat.playerEscape("south");
    expect(ev2.some((e) => e.text?.includes("same exit"))).toBe(true);
    expect(second.status).toBe("active");

    // Por el norte sí puede salir.
    const ev3 = combat.playerEscape("north");
    expect(ev3.some((e) => e.text === "Escape!")).toBe(true);
    expect(second.status).toBe("fled");
  });
});

// ------------------------------------------------- Klimb-escape de sala (E3c) ---

/**
 * Sala de combate real (campFire) con una escalera plantada en (5,5), para probar
 * el Klimb-escape sin depender de la caminabilidad de un mapa sintético (placeEnemies
 * necesita celdas válidas). El test coloca al PJ activo en (5,5) a mano.
 */
function ladderRoom(ladderTile: number): CombatMapData {
  const base = combatMaps[0]!;
  const tiles = base.tiles.map((r) => [...r]);
  tiles[5]![5] = ladderTile;
  return { ...base, index: 99, tiles };
}

describe("Klimb-escape de sala de mazmorra (E3c)", () => {
  function roomCombat(ladderTile: number): { combat: Combat; state: GameState } {
    const state = freshState();
    const combat = new Combat({
      map: ladderRoom(ladderTile),
      entryDirection: "south",
      party: party(state),
      enemies: [{ def: byName("Giant Spider"), count: 1 }],
      seed: 7,
      state,
      defenseValues: data.defenseValues,
    });
    return { combat, state };
  }

  it("sobre escalera↑ (0xC8): 'Klimb-Up!' + 'Escape!', delta −1, PJ huye", () => {
    const { combat } = roomCombat(0xc8);
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    cur.x = 5;
    cur.y = 5; // sobre la escalera
    const ev = combat.playerKlimbEscape();
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["Klimb-Up!", "Escape!"]);
    expect(combat.escapeFloorDelta).toBe(-1);
    expect(cur.status).toBe("fled");
  });

  it("sobre escalera↓ (0xC9): 'Klimb-Down!', delta +1", () => {
    const { combat } = roomCombat(0xc9);
    const cur = combat.currentUnit!;
    cur.x = 5;
    cur.y = 5;
    const ev = combat.playerKlimbEscape();
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["Klimb-Down!", "Escape!"]);
    expect(combat.escapeFloorDelta).toBe(1);
  });

  it("sin escalera bajo el PJ: 'Klimb-what?', sin delta ni huida", () => {
    const { combat } = roomCombat(0xc8);
    const cur = combat.currentUnit!;
    // El start (3,5) es suelo, no escalera.
    const ev = combat.playerKlimbEscape();
    expect(ev.map((e) => e.text)).toEqual(["Klimb-what?"]);
    expect(combat.escapeFloorDelta).toBeNull();
    expect(cur.status).toBe("active");
  });

  it("el Klimb-escape NO consume rand (seed invariante) — condición (c)", () => {
    const { combat } = roomCombat(0xc8);
    const cur = combat.currentUnit!;
    cur.x = 5;
    cur.y = 5;
    const seedBefore = combat.finalSeed;
    combat.playerKlimbEscape();
    expect(combat.finalSeed).toBe(seedBefore);
  });
});

// ------------------------------------------------------------- encounters ---

describe("encounters", () => {
  it("shouldSpawnEnemy es ~1/16", () => {
    const rng = new Rng(42);
    let hits = 0;
    const N = 16000;
    for (let i = 0; i < N; i++) if (shouldSpawnEnemy(rng)) hits++;
    expect(hits / N).toBeGreaterThan(0.045);
    expect(hits / N).toBeLessThan(0.08);
  });

  it("combatMapForTile lee el CombatMapIndex real de TileData", () => {
    expect(combatMapForTile(5)).toBe(CombatMapIndex.Glade); // Grass
    expect(combatMapForTile(4)).toBe(CombatMapIndex.Swamp); // Swamp
    expect(combatMapForTile(7)).toBe(CombatMapIndex.Desert); // Desert1
    expect(combatMapForTile(1)).toBe(CombatMapIndex.BoatCalc); // Water1
  });

  // ---- Fix B (task #19): spawner fiel — weighted_pick 0x0E04 + tile_to_monster ----

  // rand controlable: sirve una cola de valores y registra los rangos (lo,hi)
  // pedidos, para asertar el ORDEN EXACTO de draws del stream.
  function seqRand(values: number[]): { rand: RandFn; ranges: [number, number][] } {
    const ranges: [number, number][] = [];
    let i = 0;
    const rand: RandFn = (lo, hi) => {
      ranges.push([lo, hi]);
      const v = values[i++] ?? 0;
      return Math.max(lo, Math.min(hi, v));
    };
    return { rand, ranges };
  }

  it("SPAWN_TABLES (literal citado) == data.json.spawnTables (bloqueo de deriva)", () => {
    // Fuente única = DATA.OVL → data.json (extractor). Este bloqueo impide que el
    // literal de encounters.ts y el extraído deriven sin que un test lo pare.
    const fromJson = (data as unknown as { spawnTables: unknown }).spawnTables;
    expect(fromJson).toEqual(SPAWN_TABLES);
  });

  it("weighted_pick: cada tabla suma 256 y el roll mapea al índice correcto (0x0E04)", () => {
    for (const tab of Object.values(SPAWN_TABLES)) {
      expect(tab.weights.reduce((a: number, b: number) => a + b, 0)).toBe(256);
    }
    const w = SPAWN_TABLES.landSurface.weights; // [60,50,40,30,20,15,15,10,10,3,2,1]
    expect(weightedPick(w, seqRand([0]).rand)).toBe(0); // roll 0 → 1ª entrada
    expect(weightedPick(w, seqRand([59]).rand)).toBe(0); // 59<60
    expect(weightedPick(w, seqRand([60]).rand)).toBe(1); // 60→resta 60, 0<50
    expect(weightedPick(w, seqRand([255]).rand)).toBe(w.length - 1); // roll máx → última
  });

  it("agua (tile<4): gate rand(0,64) → weighted_pick rand(0,255); sólo acuáticos", () => {
    const enemyDefs = defs();
    // gate=0 (pasa), pick roll=0 → primera entrada waterSurface (id 0x8c = Shark).
    const { rand, ranges } = seqRand([0, 0]);
    const picked = pickSpawnEnemy(enemyDefs, 2 /* Water3 */, 0, rand);
    expect(ranges).toEqual([[0, 0x40], [0, 0xff]]); // 2 draws, en ese orden
    expect(picked?.name).toBe("Shark");
    expect(picked?.isWater).toBe(true);
  });

  it("agua: gate >=16 → sin monstruo consumiendo SÓLO 1 rand (16/65)", () => {
    const { rand, ranges } = seqRand([16]);
    const picked = pickSpawnEnemy(defs(), 2, 0, rand);
    expect(picked).toBeNull();
    expect(ranges).toEqual([[0, 0x40]]); // el pick NO rueda si el gate falla
  });

  it("tierra (tile 5, sin gate): 1 draw weighted_pick; el Dragón SÍ es alcanzable", () => {
    const enemyDefs = defs();
    // roll 254 sobre landSurface (suma 256): cae en la penúltima/última entrada.
    const { rand, ranges } = seqRand([254]);
    const picked = pickSpawnEnemy(enemyDefs, 5 /* Grass */, 0, rand);
    expect(ranges).toEqual([[0, 0xff]]); // 1 solo draw, SIN gate rand(0,64)
    // 60+50+40+30+20+15+15+10+10+3 = 253 → roll 254 resta hasta idx 10 (Dragon, peso 2).
    expect(picked?.name).toBe("Dragon");
  });

  it("tile 1 (agua): gate → rand(0,7)==7 → Whirlpool (id 0xEC), sin pick", () => {
    const { rand, ranges } = seqRand([0 /*gate pasa*/, 7 /*==7*/]);
    const picked = pickSpawnEnemy(defs(), 1 /* Water1 */, 0, rand);
    expect(picked?.name).toBe("Whirpool");
    expect(ranges).toEqual([[0, 0x40], [0, 7]]); // NO hay weighted_pick tras el 7
  });

  it("tile 7 (desierto): rand(0,3)==0 → Sand Trap; !=0 → nada (sin pick)", () => {
    const hit = pickSpawnEnemy(defs(), 7, 0, seqRand([0]).rand);
    expect(hit?.name).toBe("Sand Trap");
    const miss = seqRand([1]);
    expect(pickSpawnEnemy(defs(), 7, 0, miss.rand)).toBeNull();
    expect(miss.ranges).toEqual([[0, 3]]); // 1 draw, sin pick
  });

  it("tile 4 en floor 0xFF (underworld) → Rot Worm SIN consumir rand", () => {
    const { rand, ranges } = seqRand([]);
    const picked = pickSpawnEnemy(defs(), 4, 0xff, rand);
    expect(picked?.name).toBe("Rot Worm");
    expect(ranges).toEqual([]); // ruta fija: 0 draws
  });

  it("underworld tierra usa landUnderworld (Bat, Corpser...), no landSurface", () => {
    // floor 0xFF, tile 5 (tierra): pick sobre landUnderworld. roll 0 → id 0x94 (Bat).
    const picked = pickSpawnEnemy(defs(), 5, 0xff, seqRand([0]).rand);
    expect(picked?.name).toBe("Bat");
  });

  it("id→def por def.tile = id+0x100 (la nave pirata: id 0x2C → tile 300)", () => {
    const enemyDefs = defs();
    // waterSurface última entrada (peso 34) es id 0x2C = Pirates. roll 255 → idx 4.
    const picked = pickSpawnEnemy(enemyDefs, 2, 0, seqRand([0, 255]).rand);
    expect(picked?.tile).toBe(0x2c + 0x100);
    expect(picked?.name).toBe("Pirates");
  });

  it("tiles inertes de tierra (0xC/0xD) → sin monstruo, 0 draws", () => {
    for (const t of [0xc, 0xd]) {
      const { rand, ranges } = seqRand([]);
      expect(pickSpawnEnemy(defs(), t, 0, rand)).toBeNull();
      expect(ranges).toEqual([]);
    }
  });

  it("tile de agua: TODO pick que cuaje es acuático (barrido de rolls)", () => {
    const enemyDefs = defs();
    let cuajaron = 0;
    for (let roll = 0; roll <= 255; roll++) {
      const picked = pickSpawnEnemy(enemyDefs, 3 /* Water */, 0, seqRand([0, roll]).rand);
      if (picked) {
        cuajaron++;
        expect(picked.isWater).toBe(true);
      }
    }
    // ⚠ TESTIGO DE EXISTENCIA (auditoría 30-07): sin él, este universal pasaba verde
    // con CERO asertos ejecutados — si pickSpawnEnemy devolviera null en los 256 rolls
    // (como hace legítimamente en los tiles inertes 0xC/0xD de arriba), el test seguiría
    // en verde sin haber medido nada. La aserción interesante es «todo pick es acuático»
    // Y «hay picks».
    expect(cuajaron).toBeGreaterThan(0);
  });
});

// ------------------------------------------- passability de IA por tipo (#43) ---

describe("Combat — passability de movimiento por clase de enemigo (fix #43)", () => {
  const bayMap = (): CombatMapData => combatMaps[15]!; // Bay: 16 slots sobre agua

  it("un enemigo ACUÁTICO nada por el agua del Bay y alcanza la costa (no queda congelado)", () => {
    // Repro del stall del soak (Tramo 4): un enemigo isWater spawnea sobre agua
    // profunda (tile 2, walkable=0 pero waterEnemyPassable=1). Con el bug
    // —isWalkable usaba sólo `walkable`— todos sus vecinos eran "no pisables" y
    // quedaba CONGELADO: ni se movía ni atacaba, y el combate no terminaba nunca.
    const state = freshState();
    const shark = byName("Shark"); // isWater, melee reach 1 → DEBE acercarse
    expect(shark.isWater).toBe(true);
    const combat = new Combat({
      map: bayMap(),
      entryDirection: "east",
      party: party(state).slice(0, 1),
      enemies: [{ def: shark, count: 1 }],
      seed: 777,
      state,
      defenseValues: data.defenseValues,
    });
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    const player = combat.combatants.find((c) => c.kind === "player")!;
    // Escenario determinista: jugador en la costa (tile 52, walkable) y shark en
    // agua lejana. HP inflada en ambos para AISLAR el movimiento (nadie muere).
    player.x = 6;
    player.y = 3;
    enemy.x = 1;
    enemy.y = 1;
    enemy.hp = enemy.maxHp = 999;
    player.hp = player.maxHp = 999;
    const startX = enemy.x;
    const startY = enemy.y;

    let moves = 0;
    let minDist = Infinity;
    for (let i = 0; i < 400 && !combat.over; i++) {
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "enemy") {
        const before = `${enemy.x},${enemy.y}`;
        combat.tickEnemyTurns();
        if (`${enemy.x},${enemy.y}` !== before) moves++;
      } else {
        combat.playerPass();
      }
      minDist = Math.min(
        minDist,
        Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y)),
      );
    }

    // El shark NADÓ (se movió al menos una vez) y llegó a una celda de agua
    // adyacente al jugador de la costa (Chebyshev ≤ 1 = melé, §10).
    expect(moves).toBeGreaterThan(0);
    expect(minDist).toBeLessThanOrEqual(1);
    expect(enemy.x !== startX || enemy.y !== startY).toBe(true);
  });

  it("un enemigo TERRESTRE nunca pisa una casilla que su clase no pisa (lava)", () => {
    // Mapa sintético: mitad oeste tierra (grass, landEnemyPassable=1), mitad este
    // LAVA (0x8f=143: walkable=1 —se puede pisar a pie, quema— PERO landEnemyPassable=0,
    // los terrestres la evitan). Un tile walkable-pero-no-landPassable mantiene el
    // failing-first: con el bug (isWalkable=walkable) el terrestre SÍ la cruzaría; con
    // el fix por clase, no.
    // NOTA (wire-5, carril LOS/pasabilidad): el fixture ANTERIOR era WaterStream
    // (0x6c=108) con walkable=1 — pero eso ERA el bug de "agua andable a pie" que este
    // mismo carril corrige (0x6c es agua → walkable=0; cita kernel 0x54d4/0x2bd4). Con
    // 0x6c ya no discrimina (walkable=0 Y landEnemyPassable=0). La lava sí, y es byte-fiel
    // (no está entre las 29 divergencias de pasabilidad: 0x54d4 también la deja pisable).
    const LAVA = 143; // 0x8f
    expect(tileInfo(LAVA).walkable).toBe(true);
    expect(tileInfo(LAVA).landEnemyPassable).toBe(false);
    const tiles: number[][] = [];
    for (let y = 0; y < 11; y++) {
      const row: number[] = [];
      for (let x = 0; x < 11; x++) row.push(x >= 6 ? LAVA : 5);
      tiles.push(row);
    }
    const landWaterMap: CombatMapData = {
      index: 999,
      territory: "britannia",
      name: "SyntheticLandLava",
      tiles,
      playerStarts: {
        east: [{ x: 9, y: 5 }],
        west: [{ x: 9, y: 5 }],
        south: [{ x: 9, y: 5 }],
        north: [{ x: 9, y: 5 }],
      },
      units: [{ sprite: 0, x: 2, y: 5 }],
      triggers: [],
    };
    const state = freshState();
    const spider = byName("Giant Spider"); // isWater=false, isSand=false → terrestre
    expect(spider.isWater).toBe(false);
    const combat = new Combat({
      map: landWaterMap,
      entryDirection: "east",
      party: party(state).slice(0, 1),
      enemies: [{ def: spider, count: 1 }],
      seed: 4242,
      state,
      defenseValues: data.defenseValues,
    });
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    const player = combat.combatants.find((c) => c.kind === "player")!;
    player.x = 9; // en la lava: sólo sirve de cebo (los PJ se colocan sin check)
    player.y = 5;
    enemy.x = 2;
    enemy.y = 5;
    enemy.hp = enemy.maxHp = 999;
    player.hp = player.maxHp = 999;

    for (let i = 0; i < 300 && !combat.over; i++) {
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "enemy") combat.tickEnemyTurns();
      else combat.playerPass();
      // INVARIANTE: el terrestre jamás ocupa una casilla que su clase no pisa.
      expect(tileInfo(tiles[enemy.y]![enemy.x]!).landEnemyPassable).toBe(true);
      expect(enemy.x).toBeLessThanOrEqual(5); // nunca cruza a la lava (x ≥ 6)
    }
  });
});

// Ring of Invisibility (0x2A=42) — el status-pass 0x6794→0x67BF marca invisible
// (flag 0x10) al portador. Corre al montar (placer 0x6936 @0x6b68) Y al cerrar cada
// turno (COMBAT:0x0b85 → perTurnStatusPass; suite invisibilidad-pase-turno.test.ts).
// El MISMO flag que Sanct Lor (hechizo) y que respeta el targeting enemigo.
describe("Combat — Ring of Invisibility (0x2A)", () => {
  const spawn = (state: GameState) =>
    new Combat({
      map: combatMaps[0]!,
      entryDirection: "east",
      party: party(state),
      enemies: [{ def: byName("Giant Spider"), count: 1 }],
      seed: 12345,
      state,
      defenseValues: data.defenseValues,
    });

  it("el miembro con el anillo (42) nace INVISIBLE en la arena; el resto NO", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS; // Avatar porta el anillo
    const combat = spawn(state);
    const players = combat.combatants.filter((c) => c.kind === "player");
    expect(players.find((c) => c.charIdx === 0)!.invisible).toBe(true);
    expect(players.filter((c) => c.charIdx !== 0).every((c) => !c.invisible)).toBe(true);
  });

  it("sin el anillo, ningún miembro es invisible", () => {
    const state = freshState();
    const combat = spawn(state);
    expect(combat.combatants.filter((c) => c.kind === "player").some((c) => c.invisible)).toBe(false);
  });

  it("otro anillo (regen 44) NO da invisibilidad", () => {
    const state = freshState();
    state.characters[0]!.ring = 44; // Ring of Regeneration, no invisibilidad
    const combat = spawn(state);
    expect(combat.combatants.find((c) => c.kind === "player" && c.charIdx === 0)!.invisible).toBe(false);
  });
});

describe("sceptreDissolveFields — (U)se Cetro en arena (CAST 0x1966 → barrido 0x19a5)", () => {
  const spider = byName("Giant Spider");
  const mk = (): Combat => {
    const state = freshState();
    return new Combat({
      map: campFire(), entryDirection: "east", party: party(state),
      enemies: [{ def: spider, count: 1 }], seed: 12345, state,
      defenseValues: data.defenseValues,
    });
  };

  it("disuelve un campo (tile&0xf0==0x70) adyacente al combatiente activo → Grass(5)", () => {
    const combat = mk();
    const cur = combat.currentUnit!;
    expect(cur).toBeTruthy();
    const tiles = combat.mapTiles;
    const GRID = tiles.length;
    // Vecino ortogonal in-bounds del actor: siémbralo como campo 0x7a (0x70-0x7f).
    const dirs: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const nb = dirs
      .map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy }))
      .find((p) => p.x >= 0 && p.x < GRID && p.y >= 0 && p.y < GRID)!;
    tiles[nb.y]![nb.x] = 0x7a;
    const dissolved = combat.sceptreDissolveFields();
    expect(dissolved).toBeGreaterThanOrEqual(1);
    expect(tiles[nb.y]![nb.x]).toBe(5); // 0x19ce: campo → Grass
  });

  it("sin campos 0x70-0x7f en el 3×3 → 0 disueltos (el llamador imprime 'No effect!')", () => {
    const combat = mk();
    // campFire no coloca tiles de campo → el barrido no encuentra nada.
    expect(combat.sceptreDissolveFields()).toBe(0);
  });
});
