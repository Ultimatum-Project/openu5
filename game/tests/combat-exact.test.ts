/**
 * Fórmulas EXACTAS del combate (Task 3.2) — vectores derivados del asm de
 * COMBAT.OVL/COMSUBS.OVL (citas por offset en re/notes/combat.md).
 */
import { describe, it, expect } from "vitest";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  CombatRng,
  WEAPON_GENERIC,
  adjustEnemyDamage,
  applyDefense,
  chestRoll,
  combatDistance,
  enemySpawnSpeed,
  hitThreshold,
  initiativeReset,
  randomAdjacentCell,
  rollHit,
  sar1RoundToZero,
  weaponBaseDamage,
  weaponIsMagic,
  weaponUsesStrength,
  woundClassify,
  xpForKill,
} from "../src/core/combat/formulas.js";

function rng(seed = 0x1234): CombatRng {
  return new CombatRng(new OriginalRng(seed));
}

describe("CombatRng — helpers del kernel", () => {
  it("rand30 (kernel 0x3ABE) devuelve 1..30 y nunca 0", () => {
    const r = rng(1);
    for (let i = 0; i < 2000; i++) {
      const v = r.rand30();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(30);
    }
  });

  it("rand30 = max(1, rand0(0x3C) >> 1) — misma órbita que el modelo directo", () => {
    const a = rng(0xbeef);
    const b = new OriginalRng(0xbeef);
    for (let i = 0; i < 100; i++) {
      const raw = b.next(0, 0x3c);
      const expected = raw >> 1 === 0 ? 1 : raw >> 1;
      expect(a.rand30()).toBe(expected);
    }
  });

  it("rand0(n) es rand_range(0, n) ambos inclusive (kernel 0x3AAE)", () => {
    const a = rng(7);
    const b = new OriginalRng(7);
    for (let i = 0; i < 50; i++) expect(a.rand0(255)).toBe(b.next(0, 255));
  });
});

describe("iniciativa (COMBAT:0x0B94 + kernel 0x6506)", () => {
  it("recarga = 36 − velocidad en aritmética de byte", () => {
    expect(initiativeReset(15)).toBe(21); // Avatar dex 15
    expect(initiativeReset(30)).toBe(6);
    expect(initiativeReset(36)).toBe(0); // countdown 0 → 256 pasadas (byte)
    expect(initiativeReset(40)).toBe(0xfc); // wrap negativo exacto
  });

  it("velocidad del enemigo = dex + rand0(7) − 4, con fallback si > 30", () => {
    // Con dex 25 el rango legal es 21..28: nunca cae al fallback.
    for (let seed = 0; seed < 40; seed++) {
      const v = enemySpawnSpeed(25, rng(seed));
      expect(v).toBeGreaterThanOrEqual(21);
      expect(v).toBeLessThanOrEqual(28);
    }
    // Con dex 30, +2/+3 excede 30 → usa la dex sin modificar (65e8-65ee).
    for (let seed = 0; seed < 40; seed++) {
      const v = enemySpawnSpeed(30, rng(seed));
      expect(v === 30 || (v >= 26 && v <= 30)).toBe(true);
    }
    // Con dex 3, el roll −4 underflowea el byte → fallback a 3.
    for (let seed = 0; seed < 40; seed++) {
      const v = enemySpawnSpeed(3, rng(seed));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(6);
      expect(v === 0xff).toBe(false);
    }
  });
});

describe("acierto (COMBAT:0x14D6)", () => {
  it("umbral = (defStat − atkStat + 30)/2 redondeado hacia 0", () => {
    expect(hitThreshold(15, 15)).toBe(15); // stats iguales
    expect(hitThreshold(30, 10)).toBe(25); // defensor ágil
    expect(hitThreshold(1, 25)).toBe(3); // defensor dormido (dex 1)
    expect(hitThreshold(10, 45)).toBe(-2); // atacante muy superior
    expect(sar1RoundToZero(-5)).toBe(-2); // idiom cdq/sub/sar exacto
  });

  it("acierta si rand30 >= umbral: umbral ≤ 1 acierta SIEMPRE", () => {
    for (let seed = 0; seed < 64; seed++) {
      expect(rollHit(1, 30, rng(seed))).toBe(true); // umbral (1−30+30)/2 = 0
    }
  });

  it("umbral > 30 falla SIEMPRE (rand30 máx = 30)", () => {
    for (let seed = 0; seed < 64; seed++) {
      expect(rollHit(99, 5, rng(seed))).toBe(false); // umbral (99−5+30)/2 = 62
    }
  });

  it("con stats iguales la tasa de acierto ronda el 53 % (r ≥ 15 de 1..30)", () => {
    const r = rng(0x42);
    let hits = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) if (rollHit(20, 20, r)) hits++;
    expect(hits / N).toBeGreaterThan(0.48);
    expect(hits / N).toBeLessThan(0.58);
  });

  it("armas contundentes usan STR: spellAttackRange[arma−1] == 8", () => {
    // Tabla real: ids 0x03,0x06,0x12,0x18,0x1F llevan el 8 (mace = 0x18).
    const table = new Array(55).fill(0);
    table[0x18 - 1] = 8;
    expect(weaponUsesStrength(0x18, table)).toBe(true);
    expect(weaponUsesStrength(0x1e, table)).toBe(false);
    expect(weaponUsesStrength(0, table)).toBe(false); // sel 0 = enemigo
  });
});

describe("daño (COMBAT:0x12B0)", () => {
  it("glass sword (0x27): 99 fijo + shatter, ignora armadura", () => {
    const roll = weaponBaseDamage(0x27, 99, rng());
    expect(roll).toEqual({ base: 99, shattered: true });
    expect(applyDefense(99, 50, rng())).toBe(99); // 1323-132e
  });

  it("jeweled sword (0x28) → 0; manos desnudas (0xFF) → 1", () => {
    expect(weaponBaseDamage(0x28, 1, rng()).base).toBe(0);
    expect(weaponBaseDamage(0xff, 0, rng()).base).toBe(1);
  });

  it("arma normal: rand(1, ATTACK_VALUE); atk 1 no rola", () => {
    const r = rng(0x77);
    for (let i = 0; i < 200; i++) {
      const d = weaponBaseDamage(0x1e, 15, r).base; // long sword atk 15
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(15);
    }
    expect(weaponBaseDamage(0x1b, 1, rng()).base).toBe(1); // arrows atk 1: fijo
  });

  it("defensa: dmg −= rand(1, def); puede quedar negativo (grazed)", () => {
    const r = rng(3);
    for (let i = 0; i < 200; i++) {
      const d = applyDefense(2, 10, r);
      expect(d).toBeGreaterThanOrEqual(2 - 10);
      expect(d).toBeLessThanOrEqual(1);
    }
    expect(applyDefense(5, 0, rng())).toBe(5); // sin defensa no consume rand
  });

  it("g_5890 (COMSUBS:0x0C52): mágico si arma >= 0x23; incluye manos 0xFF", () => {
    expect(weaponIsMagic(0x23)).toBe(true); // chaos sword: el umbral exacto
    expect(weaponIsMagic(0x27)).toBe(true); // glass sword
    expect(weaponIsMagic(0x22)).toBe(false); // halberd: última no mágica
    expect(weaponIsMagic(0xff)).toBe(true); // quirk: 0x00FF >= 0x23 (word con signo)
    expect(weaponIsMagic(WEAPON_GENERIC)).toBe(false); // id sintético del clon
  });

  it("no-muerto (0x1574 161a-1631): mitad truncada SALVO con g_5890", () => {
    const undead = { undead: true, immortal: false };
    expect(adjustEnemyDamage(10, { ...undead, magicAttack: false })).toBe(5);
    expect(adjustEnemyDamage(9, { ...undead, magicAttack: false })).toBe(4);
    // glass sword (0x27) es mágica: el 99 NO se divide.
    expect(adjustEnemyDamage(99, { ...undead, magicAttack: weaponIsMagic(0x27) })).toBe(99);
    expect(adjustEnemyDamage(99, { ...undead, magicAttack: false })).toBe(49);
  });
});

describe("XP y botín (COMBAT:0x1574)", () => {
  it("XP por matar = maxHP/4 + 1", () => {
    expect(xpForKill(99)).toBe(25); // Dragon
    expect(xpForKill(15)).toBe(4); // Troll
    expect(xpForKill(10)).toBe(3); // Giant Spider
    expect(xpForKill(5)).toBe(2); // Bat
  });

  it("cofre si rand30 <= treasure; trampa si rand30 < treasure", () => {
    // treasure 30: SIEMPRE cofre (rand30 ≤ 30 es cierto).
    for (let seed = 0; seed < 32; seed++) {
      expect(chestRoll(30, rng(seed)).chest).toBe(true);
    }
    // treasure 0: nunca (rand30 mínimo es 1).
    for (let seed = 0; seed < 32; seed++) {
      expect(chestRoll(0, rng(seed)).chest).toBe(false);
    }
  });
});

describe("heridas y huida (COMBAT:0x1A5C)", () => {
  it("umbrales base/2·base/3·base con base = maxHP>>2", () => {
    // maxHP 20 → base 5.
    expect(woundClassify(4, 20, rng())).toEqual({ level: 1, fleeing: true });
    // 9 < 10 → nivel 2 SIEMPRE ("heavily wounded!"): la escalada rand0(0x100)
    // > 0xFB solo activa la huida (1ad0 salta a 1aa9, tras el mov [bp-4],1).
    const l2 = woundClassify(9, 20, rng(1));
    expect(l2.level).toBe(2);
    expect(woundClassify(14, 20, rng()).level).toBe(3);
    expect(woundClassify(20, 20, rng()).level).toBe(4);
    expect(woundClassify(20, 20, rng()).fleeing).toBe(false);
  });

  it("la escalada (~2 %) mantiene el nivel 2 y solo activa la huida", () => {
    // Busca una semilla cuyo primer rand0(0x100) sea > 0xFB y otra que no.
    let fleeingSeen = false;
    let calmSeen = false;
    for (let seed = 1; seed < 4000 && !(fleeingSeen && calmSeen); seed++) {
      const w = woundClassify(9, 20, rng(seed));
      expect(w.level).toBe(2); // el nivel NUNCA escala a 1
      if (w.fleeing) fleeingSeen = true;
      else calmSeen = true;
    }
    expect(fleeingSeen).toBe(true);
    expect(calmSeen).toBe(true);
  });
});

describe("geometría (COMSUBS:0x0458/0x048A/0x07D4)", () => {
  it("distancia = floor(sqrt(dx²+dy²)): la diagonal adyacente es 1", () => {
    expect(combatDistance(1, 1)).toBe(1); // sqrt(2) → 1
    expect(combatDistance(2, 0)).toBe(2);
    expect(combatDistance(3, 4)).toBe(5);
    expect(combatDistance(2, 2)).toBe(2); // sqrt(8) → 2
    expect(combatDistance(0, 0)).toBe(0);
  });

  it("celda aleatoria adyacente cae en ±1 y dentro del tablero", () => {
    const r = rng(9);
    for (let i = 0; i < 200; i++) {
      const c = randomAdjacentCell(0, 10, r);
      expect(Math.abs(c.x - 0)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - 10)).toBeLessThanOrEqual(1);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(10);
    }
  });
});
