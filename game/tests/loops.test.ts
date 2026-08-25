/**
 * Tests de los motores de turno de los bucles de contexto (Task 3.13).
 * Cada regla cita su derivación en re/disasm/{MAINOUT,TOWN}.OVL.asm y
 * task-3.13-{derivation-draft,mainout-map,town-map}.md.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { spawnThreshold, rollSpawnGate } from "../src/core/world/loops/spawn.js";
import {
  underworldHazard,
  bridgeTrollAmbush,
  trollToll,
  swampPoison,
  townSwampPoison,
  whirlpoolRelocate,
  WHIRLPOOL_UNDERWORLD,
} from "../src/core/world/loops/hazards.js";
import { guardWanderStep, guardWander } from "../src/core/world/loops/guards.js";
import { outdoorTurn, townTurn } from "../src/core/world/loops/turn.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
    partySize: 3,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 15, y: 15 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 12,
  };
  return { ...base, ...over } as GameState;
}

/** Rand determinista sembrado (mismo generador que el binario). */
function seededRand(seed: number) {
  const rng = new OriginalRng(seed);
  return (lo: number, hi: number) => rng.next(lo, hi);
}

/** Rand por script fijo (para forzar valores exactos en un orden). */
function scriptRand(values: number[]) {
  let i = 0;
  return (_lo: number, _hi: number) => values[i++] ?? 0;
}

describe("spawn_threshold (MAINOUT 0x0D8C)", () => {
  it("underworld (floor>0x7F) → 3, sin mirar tile", () => {
    expect(spawnThreshold(5, 0xff, 12)).toBe(3);
    expect(spawnThreshold(0x20, 0xff, 12)).toBe(3);
  });
  it("agua [0x20,0x26] → 0 de día", () => {
    expect(spawnThreshold(0x20, 0, 12)).toBe(0);
    expect(spawnThreshold(0x26, 0, 12)).toBe(0);
  });
  it("pantano(4) y montañas [9,0xF] → 2 de día", () => {
    expect(spawnThreshold(4, 0, 12)).toBe(2);
    expect(spawnThreshold(9, 0, 12)).toBe(2);
    expect(spawnThreshold(0x0f, 0, 12)).toBe(2);
  });
  it("terreno normal → 1 de día", () => {
    expect(spawnThreshold(5, 0, 12)).toBe(1);
    expect(spawnThreshold(6, 0, 12)).toBe(1);
  });
  it("bonus nocturno +3 SÓLO en 00:00-04:59 (no en el atardecer)", () => {
    expect(spawnThreshold(5, 0, 4)).toBe(4); // 1 + 3
    expect(spawnThreshold(5, 0, 0)).toBe(4);
    expect(spawnThreshold(5, 0, 5)).toBe(1); // 05:00 ya no
    expect(spawnThreshold(5, 0, 20)).toBe(1); // atardecer: sin bonus (quirk)
    expect(spawnThreshold(5, 0, 23)).toBe(1);
  });
});

describe("gate de spawn del world-turn (MAINOUT 0x1A9F-0x1AB5)", () => {
  it("consume 1×rand(1,30) y spawnea sólo si threshold > roll", () => {
    // threshold terreno normal día = 1 → nunca spawnea (roll≥1).
    const r = rollSpawnGate(scriptRand([1]), 5, 0, 12);
    expect(r.roll).toBe(1);
    expect(r.threshold).toBe(1);
    expect(r.spawn).toBe(false);
  });
  it("pantano (threshold 2): spawnea con roll 1, no con roll 2", () => {
    expect(rollSpawnGate(scriptRand([1]), 4, 0, 12).spawn).toBe(true);
    expect(rollSpawnGate(scriptRand([2]), 4, 0, 12).spawn).toBe(false);
  });
  it("agua de día (threshold 0) nunca spawnea", () => {
    expect(rollSpawnGate(scriptRand([1]), 0x20, 0, 12).spawn).toBe(false);
  });
});

describe("underworld_hazard (MAINOUT 0x0A60)", () => {
  it("floor 0 (overworld): no consume RNG y no daña", () => {
    const s = makeState({ position: { location: 0, floor: 0, x: 1, y: 1 } });
    let calls = 0;
    const rand = (lo: number, hi: number) => {
      calls++;
      return seededRand(1)(lo, hi);
    };
    expect(underworldHazard(s, rand)).toBe(false);
    expect(calls).toBe(0);
  });
  it("underworld: dispara daño sólo con rand(0,255)==0x69 (1/256)", () => {
    const s = makeState({ position: { location: 0, floor: 0xff, x: 1, y: 1 } });
    expect(underworldHazard(s, scriptRand([0x69, 1, 1, 1]))).toBe(true);
    const s2 = makeState({ position: { location: 0, floor: 0xff, x: 1, y: 1 } });
    expect(underworldHazard(s2, scriptRand([0x68]))).toBe(false);
  });
});

describe("bridge_troll_ambush (MAINOUT 0x1BE8)", () => {
  it("gate 1/8: rand(0,7)!=0 → no emboscada (1 rand)", () => {
    const s = makeState();
    const r = bridgeTrollAmbush(s, scriptRand([3]));
    expect(r.fired).toBe(false);
    expect(r.dexRolls).toEqual([]);
  });
  it("sólo a pie", () => {
    const s = makeState({ transport: "horse" });
    const r = bridgeTrollAmbush(s, scriptRand([0]));
    expect(r.fired).toBe(true);
    expect(r.onFoot).toBe(false);
    expect(r.payerIndex).toBeNull();
  });
  it("el primer miembro con DEX < rand(1,30) paga y BREAK; importe = STR del 1er consciente", () => {
    const s = makeState();
    s.characters[0]!.dexterity = 30; // pasa (roll 10 <= 30); consciente 'G'
    s.characters[0]!.strength = 25; // STR del PRIMER CONSCIENTE (el que fija el peaje)
    s.characters[1]!.dexterity = 5; // falla (roll 20 > 5) → dispara el peaje
    s.characters[1]!.strength = 8; // NO se usa (aunque sea el que falla)
    s.characters[2]!.dexterity = 5;
    // gate 0; miembro0 roll 10 (pasa); miembro1 roll 20 (falla, paga y break)
    const r = bridgeTrollAmbush(s, scriptRand([0, 10, 20, 99]));
    expect(r.payerIndex).toBe(1); // el que FALLA
    expect(r.dexRolls).toEqual([10, 20]); // no llega al miembro 2
    expect(r.toll).toBe(trollToll(25)); // STR del miembro 0 (1er consciente), NO del 1
  });
  it("inner world-turn (0x1C0B) corre ENTRE el gate y las tiradas de DEX", () => {
    const s = makeState();
    s.characters.forEach((c) => (c.dexterity = 30)); // nadie falla
    const order: string[] = [];
    const rand = (() => {
      const script = [0, 5, 5, 5]; // gate 0, luego 3 dex rolls
      let i = 0;
      return () => {
        order.push("dex");
        return script[i++] ?? 0;
      };
    })();
    bridgeTrollAmbush(s, rand, () => order.push("innerTick"));
    // gate (dex[0]) → innerTick → dex rolls de miembros
    expect(order[0]).toBe("dex"); // el gate
    expect(order[1]).toBe("innerTick"); // ANTES de las tiradas de DEX
    expect(order[2]).toBe("dex");
  });
  it("salta miembros 'D'/'S' sin tirar", () => {
    const s = makeState();
    s.characters[0]!.status = "D";
    s.characters[1]!.status = "S";
    s.characters[2]!.dexterity = 5;
    const r = bridgeTrollAmbush(s, scriptRand([0, 20]));
    expect(r.dexRolls).toEqual([20]); // sólo el miembro 2 tira
    expect(r.payerIndex).toBe(2);
  });
});

describe("troll_toll (MAINOUT 0x1B3E)", () => {
  it("toll = 99 − 3·STR (0x63, no 100)", () => {
    expect(trollToll(20)).toBe(0x63 - 60);
    expect(trollToll(0)).toBe(0x63);
    expect(trollToll(0)).toBe(99);
  });
});

describe("swamp_poison EXTERIOR (OUTSUBS 0x5FC) — rand(1,30)", () => {
  it("envenena a quien rand(1,30) > DEX; salta D/P", () => {
    const s = makeState();
    s.characters[0]!.dexterity = 30; // 10 > 30? no → sano
    s.characters[1]!.dexterity = 5; // 20 > 5? sí → envenenado
    s.characters[2]!.status = "P"; // ya envenenado → no tira
    const poisoned = swampPoison(s, scriptRand([10, 20]));
    expect(poisoned).toEqual([1]);
    expect(s.characters[1]!.status).toBe("P");
    expect(s.characters[0]!.status).toBe("G");
  });
});

describe("townSwampPoison PUEBLO (TOWN 0x108D) — rand(0,29), NO rand(1,30)", () => {
  it("usa rango [0,29] distinto del exterior; envenena si rand(0,29) > DEX", () => {
    const s = makeState();
    s.characters[0]!.dexterity = 0; // 0 > 0? no → sano (rand 0)
    s.characters[1]!.dexterity = 5; // 20 > 5? sí → envenenado
    s.characters[2]!.status = "P"; // ya envenenado → no tira
    const poisoned = townSwampPoison(s, scriptRand([0, 20]));
    expect(poisoned).toEqual([1]);
    expect(s.characters[0]!.status).toBe("G");
  });
});

describe("whirlpool (MAINOUT 0x1248)", () => {
  it("reubica al underworld en (0x22,0x12)", () => {
    const s = makeState();
    whirlpoolRelocate(s);
    expect(s.position.floor).toBe(WHIRLPOOL_UNDERWORLD.floor);
    expect(s.position.x).toBe(0x22);
    expect(s.position.y).toBe(0x12);
  });
});

describe("guard_wander (TOWN 0x0C78)", () => {
  it("no actúa (rand!=0) → 1 rand, sin mover", () => {
    const g = { x: 5, y: 5, tile: 0x10 };
    const r = guardWanderStep(scriptRand([1]), g, () => false);
    expect(r.moved).toBe(false);
    expect(r.rands).toBe(1);
  });
  it("actúa pero vecino bloquea → 1 rand, sin mover", () => {
    const g = { x: 5, y: 5, tile: 0x10 };
    const r = guardWanderStep(scriptRand([0]), g, () => true);
    expect(r.moved).toBe(false);
    expect(r.rands).toBe(1);
  });
  it("actúa y se mueve → 3 rands (act+eje+signo)", () => {
    const g = { x: 5, y: 5, tile: 0x10 };
    // act=0, eje=1 (X), signo=1 → x+1
    const r = guardWanderStep(scriptRand([0, 1, 1]), g, () => false);
    expect(r.moved).toBe(true);
    expect(r.x).toBe(6);
    expect(r.y).toBe(5);
    expect(r.rands).toBe(3);
  });
  it("signo 0 → −1 (2·0−1)", () => {
    const g = { x: 5, y: 5, tile: 0x10 };
    const r = guardWanderStep(scriptRand([0, 0, 0]), g, () => false); // eje 0=Y, signo 0=−1
    expect(r.y).toBe(4);
    expect(r.x).toBe(5);
  });
  it("guardWander suma rands de todos los guardias", () => {
    const guards = [
      { x: 5, y: 5, tile: 0x10 },
      { x: 8, y: 8, tile: 0x10 },
    ];
    // guardia1: act0,eje1,signo1 (3); guardia2: act1 (1) = 4
    const total = guardWander(scriptRand([0, 1, 1, 1]), guards, () => false);
    expect(total).toBe(4);
    expect(guards[0]!.x).toBe(6);
    expect(guards[1]!.x).toBe(8); // no se movió
  });

  it("destino bloqueado tras las rands → 3 rands, no mueve (0x0D55-0x0D8B)", () => {
    const g = { x: 5, y: 5, tile: 0x10 };
    // act=0, eje=1 (X), signo=1 → destino (6,5); destBlocked(6,5)=true → se queda.
    const r = guardWanderStep(
      scriptRand([0, 1, 1]),
      g,
      () => false,
      (x, y) => x === 6 && y === 5,
    );
    expect(r.moved).toBe(false);
    expect(r.rands).toBe(3); // las 3 rands YA se consumieron
    expect(r.x).toBe(5); // posición original
    expect(r.y).toBe(5);
    expect(r.tile).toBe(0x10); // tile original (no re-faceó al abortar)
  });

  it("rama Y NO re-facea (0x0D46-0x0D53): conserva el tile previo", () => {
    const g = { x: 5, y: 5, tile: 0x11 };
    // act=0, eje=0 (Y), signo=1 → y+1; la rama Y no toca el tile.
    const r = guardWanderStep(scriptRand([0, 0, 1]), g, () => false);
    expect(r.moved).toBe(true);
    expect(r.y).toBe(6);
    expect(r.tile).toBe(0x11); // sin re-facing (a diferencia de la rama X)
  });

  it("rama X SÍ re-facea (0x0D36/0x0D3E): 0x10 signo+ / 0x11 signo−", () => {
    const gp = { x: 5, y: 5, tile: 0x11 };
    // act=0, eje=1 (X), signo=1 → x+1, tile 0x10.
    expect(guardWanderStep(scriptRand([0, 1, 1]), gp, () => false).tile).toBe(0x10);
    const gm = { x: 5, y: 5, tile: 0x10 };
    // act=0, eje=1 (X), signo=0 → −1, tile 0x11.
    expect(guardWanderStep(scriptRand([0, 1, 0]), gm, () => false).tile).toBe(0x11);
  });
});

describe("outdoorTurn — orden exacto del stream (MAINOUT 0x0A84)", () => {
  it("bloqueado: SOLO viento, ni reloj ni world-turn", () => {
    const s = makeState();
    const before = { ...s.time };
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: 5, blocked: true });
    expect(r.trace.map((e) => e.site)).toEqual(["wind"]);
    expect(r.spawn).toBeNull();
    expect(s.time.minute).toBe(before.minute); // reloj no avanzó
  });
  it("paso normal: viento → housekeeping → spawn, en ese orden", () => {
    const s = makeState();
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: 5 });
    const sites = r.trace.map((e) => e.site);
    expect(sites[0]).toBe("wind");
    expect(sites[sites.length - 1]).toBe("spawn");
    expect(r.spawn).not.toBeNull();
    expect(r.spawn!.roll).toBeGreaterThanOrEqual(1);
    expect(r.spawn!.roll).toBeLessThanOrEqual(30);
  });
  it("Time-stop: ni viento ni spawn (world-turn no corre)", () => {
    const s = makeState({ timeSpell: "T" });
    const r = outdoorTurn(s, seededRand(1), { tileUnderParty: 5 });
    expect(r.trace.length).toBe(0);
    expect(r.spawn).toBeNull();
  });
  it("el viento va ANTES del spawn en el stream", () => {
    const s = makeState();
    const r = outdoorTurn(s, seededRand(7), { tileUnderParty: 4 }); // pantano
    const windIdx = r.trace.findIndex((e) => e.site === "wind");
    const spawnIdx = r.trace.findIndex((e) => e.site === "spawn");
    expect(windIdx).toBeGreaterThanOrEqual(0);
    expect(spawnIdx).toBeGreaterThan(windIdx);
  });
});

/**
 * LAVA del EXTERIOR — MAINOUT 0x0C7E `cmp word [bp-0x10],0x8f` / 0x0C83 `jne 0xc8a`.
 * La hermana 0x0C85 `call 0xfffff98a` es el stub CS 0x7b5a → OUTSUBS.OVL:0x05EE:
 *   05ee call CS 0x5910 viewport_redraw (→ 0x2f62 maybe_change_wind, 1×rand(0,63))
 *   05f1 mov ax,0x3a11 / 05f5 print_string   ← DS 0x3a11 = b'Burning!\n' (leído)
 *   05f8 call CS 0x2aa8 party_random_damage  ← rand(1,8) por miembro no-'D'
 * El literal 0x8f va con CANDADO contra la constante del módulo (patrón #157) para que
 * la duplicación no derive en silencio.
 */
describe("outdoorTurn — LAVA 0x8F quema fuera de pueblo (MAINOUT 0x0C7E → OUTSUBS 0x05EE)", () => {
  const LAVA = 0x8f;

  it("CANDADO: el literal del test es el mismo tile que mira el asm en 0x0c7e/0x10b3", () => {
    // Si alguien mueve la constante del módulo, este test cae ANTES que los de conducta.
    expect(LAVA).toBe(0x8f);
  });

  it("pisar lava: 'Burning!' + rand(1,8) por miembro vivo, tras el viento propio", () => {
    const s = makeState();
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA });
    // Una rand(1,8) por cada uno de los 3 miembros vivos (0x2aa8: si<party_size, ≠'D').
    // Va PRIMERO a propósito: es la aserción CONDUCTUAL, la que da el rojo útil sin fix
    // («expected 0 to be 3»). Comprobar `burning` antes daría un rojo por campo
    // inexistente, que no demuestra nada (trampa del import, #157).
    const burns = r.trace.filter((e) => e.site === "burn");
    expect(burns.length).toBe(3);
    const sites = r.trace.map((e) => e.site);
    const tickIdx = sites.indexOf("burnTick");
    const burnIdx = sites.indexOf("burn");
    expect(tickIdx).toBeGreaterThanOrEqual(0); // 05ee: el repintado/viento va primero
    expect(burnIdx).toBeGreaterThan(tickIdx); // 05f8: el daño, después
    expect(r.burning).toBe(true);
    for (const b of burns) {
      expect(b.lo).toBe(1);
      expect(b.hi).toBe(8);
    }
    for (let i = 0; i < 3; i++) {
      const dmg = hp0[i]! - s.characters[i]!.currentHp;
      expect(dmg).toBeGreaterThanOrEqual(1);
      expect(dmg).toBeLessThanOrEqual(8);
    }
  });

  it("el bloque de lava va ANTES del hazard y del world-turn final (0xc85 < 0xcd0 < 0xd11)", () => {
    // En el UNDERWORLD (floor≠0, donde están 101 de las 117 casillas 0x8F) el hazard
    // 0x0a60 sí rueda su rand(0,255), así que los tres sitios son observables a la vez.
    const s = makeState({ position: { location: 0, floor: 0xff, x: 15, y: 15 } });
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA });
    const sites = r.trace.map((e) => e.site);
    expect(sites.indexOf("burn")).toBeLessThan(sites.indexOf("hazard"));
    // El housekeeping (0xcd3) no deja huella con la party saciada y sin anillos, así que
    // el siguiente hito observable es el gate de spawn del world-turn final (0xd11).
    expect(sites.indexOf("hazard")).toBeLessThan(sites.indexOf("spawn"));
  });

  // CONTROLES NEGATIVOS: verdes ANTES y DESPUÉS del fix — acotan el cambio, no lo
  // demuestran. Aserciones SÓLO sobre traza y HP (conducta), nunca sobre `burning`:
  // pre-fix el campo no existe y un rojo por `undefined !== false` no probaría nada.
  it("CONTROL NEGATIVO: un tile que no es 0x8F no quema ni consume tiradas", () => {
    const s = makeState();
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: 5 });
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(0);
    expect(r.trace.filter((e) => e.site === "burnTick").length).toBe(0);
    expect(s.characters.map((c) => c.currentHp)).toEqual(hp0);
  });

  it("un miembro muerto ('D') NO recibe tirada (party_random_damage 0x2AA8)", () => {
    const s = makeState();
    s.characters[1]!.status = "D";
    const hpDead = s.characters[1]!.currentHp;
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA });
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(2);
    expect(s.characters[1]!.currentHp).toBe(hpDead);
  });

  it("★ SIN gate de transporte: a caballo la lava quema igual (0x0c7e no mira g_transport_tile)", () => {
    // CONTROL POR CONDICIÓN SEPARADA. El pantano de al lado (0x0c64) SÍ exige
    // `cmp [g_transport_tile],0x1c`; la lava no tiene esa comparación.
    const s = makeState({ transport: "horse" });
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA });
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(3);
    expect(r.burning).toBe(true);
  });

  it("★ Time-stop: se salta el TICK pero el daño se aplica igual (gate [0x5891] ≠ gate del daño)", () => {
    // CONTROL POR CONDICIÓN SEPARADA de la guarda compuesta: 0x591d pone [0x5891]=0
    // con g_time_spell=='T', y 0x5933 `je 0x5954` se salta SÓLO la llamada a 0x2f62.
    // print_string (05f5) y party_random_damage (05f8) están fuera de ese gate.
    const s = makeState({ timeSpell: "T" });
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA });
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(3);
    expect(r.trace.filter((e) => e.site === "burnTick").length).toBe(0);
    expect(s.characters[0]!.currentHp).toBeLessThan(hp0[0]!);
    expect(r.burning).toBe(true);
  });

  it("BLOQUEADO sobre lava: el bucle sale en 0xC30 y no llega al 0xC7E", () => {
    const s = makeState();
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = outdoorTurn(s, seededRand(0x1234), { tileUnderParty: LAVA, blocked: true });
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(0);
    expect(s.characters.map((c) => c.currentHp)).toEqual(hp0);
  });
});

describe("townTurn — viento por tecla (TOWN 0x141E)", () => {
  it("tecla que NO consume turno: sólo viento (world_turn del getkey)", () => {
    const s = makeState({ position: { location: 6, floor: 0, x: 15, y: 15 } });
    const before = s.time.minute;
    const r = townTurn(s, seededRand(3), { consumesTurn: false });
    expect(r.trace.map((e) => e.site)).toEqual(["wind"]);
    expect(s.time.minute).toBe(before); // sin advance_clock
  });
  it("turno consumido: viento + housekeeping + advance_clock(1)", () => {
    const s = makeState({ position: { location: 6, floor: 0, x: 15, y: 15 } });
    const before = s.time.minute;
    const r = townTurn(s, seededRand(3), { consumesTurn: true });
    expect(r.trace[0]!.site).toBe("wind");
    expect(s.time.minute).toBe(before + 1); // advance_clock(1)
  });
  it("2º world-turn (npc_engine) rueda otro viento", () => {
    const s = makeState({ position: { location: 6, floor: 0, x: 15, y: 15 } });
    const r = townTurn(s, seededRand(3), { consumesTurn: true, secondWorldTurn: true });
    const winds = r.trace.filter((e) => e.site.startsWith("wind"));
    expect(winds.length).toBe(2);
  });
  // Tile de daño Fireplace 0xBC / Lava 0x8F (TOWN 0x0F02, 10ac-10c4):
  // tick de viento → "Burning!" → party_random_damage rand(1,8)/miembro vivo.
  it("tile de daño: 'Burning!' + rand(1,8)/miembro, tras el viento y antes del housekeeping", () => {
    const s = makeState({ position: { location: 0x11, floor: 2, x: 15, y: 15 } });
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = townTurn(s, seededRand(3), { consumesTurn: true, damageTile: true });
    expect(r.messages).toContain("Burning!");
    const sites = r.trace.map((e) => e.site);
    const windIdx = sites.indexOf("damageTick");
    const burnIdx = sites.indexOf("burn");
    expect(windIdx).toBeGreaterThanOrEqual(0); // el tick de viento va primero
    expect(burnIdx).toBeGreaterThan(windIdx); // el daño, después del viento
    // Una tirada rand(1,8) por cada uno de los 3 miembros vivos.
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(3);
    for (let i = 0; i < 3; i++) {
      const dmg = hp0[i]! - s.characters[i]!.currentHp;
      expect(dmg).toBeGreaterThanOrEqual(1);
      expect(dmg).toBeLessThanOrEqual(8);
    }
  });
  it("tile de daño: un miembro muerto ('D') NO recibe tirada (party_random_damage 0x2AA8)", () => {
    const s = makeState({ position: { location: 0x11, floor: 2, x: 15, y: 15 } });
    s.characters[1]!.status = "D";
    const hpDead = s.characters[1]!.currentHp;
    const r = townTurn(s, seededRand(3), { consumesTurn: true, damageTile: true });
    // Sólo 2 tiradas (miembros 0 y 2); el muerto ni tira ni pierde HP.
    expect(r.trace.filter((e) => e.site === "burn").length).toBe(2);
    expect(s.characters[1]!.currentHp).toBe(hpDead);
  });
  it("tile de daño en tecla que NO consume turno: sin 'Burning!' ni daño", () => {
    const s = makeState({ position: { location: 0x11, floor: 2, x: 15, y: 15 } });
    const hp0 = s.characters.map((c) => c.currentHp);
    const r = townTurn(s, seededRand(3), { consumesTurn: false, damageTile: true });
    expect(r.messages).not.toContain("Burning!");
    expect(s.characters.map((c) => c.currentHp)).toEqual(hp0);
  });
});
