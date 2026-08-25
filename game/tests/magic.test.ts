/**
 * Tests del sistema de magia contra los assets REALES (MagicDefinitions.json,
 * data.json) y el estado inicial (initial-state.json): construcción de hechizos,
 * mezcla (consumo de reagentes) y lanzamiento (efectos, maná, ventana temporal).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildSpellDefs,
  findSpellBySyllables,
  matchSpellByInitials,
  runeSyllableForInitial,
  type MagicDefsJson,
  type SpellsDataJson,
  type SpellDef,
} from "../src/core/magic/spells.js";
import { mixSpell, mixSelected } from "../src/core/magic/mix.js";
import {
  castSpell,
  applyMani,
  applyVasMani,
  applyCure,
  applyAwaken,
  applyResurrect,
} from "../src/core/magic/cast.js";
import {
  TIME_PERMITTED_BITS,
  requiredTimeBit,
  resurrectionLevel,
  kalXenSummonType,
} from "../src/core/magic/tables.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

function rng(seed = 0x1234): CombatRng {
  return new CombatRng(new OriginalRng(seed));
}

/** RNG con cola scriptada (misma forma que el de commands.test.ts). */
function scripted(values: number[]): (lo: number, hi: number) => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("rand agotado");
    return values[i++]!;
  };
}
/** RNG que CUENTA llamadas — para probar que una rama consume 0 tiradas. */
function counting(): { fn: (lo: number, hi: number) => number; calls: () => number } {
  let n = 0;
  return { fn: (lo) => { n++; return lo; }, calls: () => n };
}
/**
 * RNG que EXPLOTA si lo llaman. Los tests de mezcla que no van por la rama de la
 * trampa no deben tocar el stream; si alguno lo toca, quiero un rojo que lo diga,
 * no un valor plausible que lo tape.
 */
function noRand(): (lo: number, hi: number) => number {
  return () => {
    throw new Error("rand llamado en una rama que no debe tirar");
  };
}
const OUTDOOR = { location: 0, inCombat: false };
const COMBAT = { location: 0x81, inCombat: true };

function readJson<T>(url: string): T {
  const path = fileURLToPath(new URL(url, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

const magicDefs = readJson<MagicDefsJson>("../src/core/data/MagicDefinitions.json");
const data = readJson<SpellsDataJson>("../assets/data.json");
const init = readJson<ExtractedInitialState>("../assets/initial-state.json");

const defs = buildSpellDefs(magicDefs, data);
function freshGame(): GameState {
  return createNewGame(init);
}
function spell(key: string): SpellDef {
  const d = defs.find((x) => x.key === key);
  if (!d) throw new Error(`no such spell ${key}`);
  return d;
}

describe("buildSpellDefs", () => {
  it("construye 49 hechizos en orden SpellWords (In_Lor índice 0)", () => {
    expect(defs.length).toBe(49);
    expect(defs.length).toBeGreaterThanOrEqual(48);
    expect(defs[0]?.key).toBe("In_Lor");
    expect(defs[0]?.index).toBe(0);
  });

  it("In_Lor: círculo 1, sólo ceniza de azufre (reagente 0), sílabas In/Lor", () => {
    const s = spell("In_Lor");
    expect(s.circle).toBe(1);
    expect(s.reagents).toEqual([0]);
    expect(s.syllables).toEqual(["In", "Lor"]);
    expect(s.mpCost).toBe(1);
  });

  it("Vas_Flam: círculo 3 y reagentes ash+pearl según el JSON real", () => {
    // NOTA: el brief citaba "círculo 2"; el JSON real dice Circle 3 (ash + pearl).
    const s = spell("Vas_Flam");
    expect(s.circle).toBe(3);
    expect(s.reagents).toEqual([0, 5]); // SulfurAsh, BlackPearl
    expect(s.type).toBe("attack");
  });

  it("An_Tym: círculo 8", () => {
    expect(spell("An_Tym").circle).toBe(8);
  });
});

describe("findSpellBySyllables", () => {
  it("encuentra In_Lor por sílabas (case-insensitive) y devuelve null si no existe", () => {
    expect(findSpellBySyllables(defs, ["In", "Lor"])?.key).toBe("In_Lor");
    expect(findSpellBySyllables(defs, ["in", "lor"])?.key).toBe("In_Lor");
    expect(findSpellBySyllables(defs, ["Xyz", "Abc"])).toBeNull();
  });
});

// Entrada TECLEADA del nombre de hechizo (CAST2.OVL 0x00de vía thunk CS 0x808e):
// tabla DS:0x1b7a (runas por inicial) + matcher DS:0x1c30 (order-independent).
describe("runeSyllableForInitial (tabla DS:0x1b7a)", () => {
  it("mapea la inicial a su palabra rúnica en MAYÚSCULAS", () => {
    expect(runeSyllableForInitial("I")).toBe("IN");
    expect(runeSyllableForInitial("i")).toBe("IN"); // se normaliza a mayúscula
    expect(runeSyllableForInitial("L")).toBe("LOR");
    expect(runeSyllableForInitial("S")).toBe("SANCT");
    expect(runeSyllableForInitial("Z")).toBe("ZU");
  });
  it("'J' y 'O' NO tienen runa (puntero NULL en la tabla) → null", () => {
    expect(runeSyllableForInitial("J")).toBeNull();
    expect(runeSyllableForInitial("O")).toBeNull();
  });
  it("no-letras → null", () => {
    expect(runeSyllableForInitial("1")).toBeNull();
    expect(runeSyllableForInitial(" ")).toBeNull();
  });
});

describe("matchSpellByInitials (matcher DS:0x1c30)", () => {
  it("empareja In Lor por sus iniciales 'IL'", () => {
    expect(matchSpellByInitials(defs, "IL")).toBe(0);
  });
  it("es INDEPENDIENTE DEL ORDEN (ordena las iniciales antes de comparar)", () => {
    // 'LI' y 'IL' emparejan el mismo hechizo (el binario ordena 0x1e2-0x22d).
    expect(matchSpellByInitials(defs, "LI")).toBe(0);
    // An Xen Corp = índice 7, iniciales A/X/C → tabla 'ACX'; cualquier permutación.
    expect(matchSpellByInitials(defs, "AXC")).toBe(7);
    expect(matchSpellByInitials(defs, "CXA")).toBe(7);
  });
  it("un nombre que NO es hechizo → -1 (retorno -2 del binario, 'No effect!')", () => {
    expect(matchSpellByInitials(defs, "IK")).toBe(-1); // In Kal: no existe
    expect(matchSpellByInitials(defs, "Z")).toBe(-1); // Zu solo: no es hechizo
  });
  it("cadena vacía → -1 (el caller la trata como 'None!')", () => {
    expect(matchSpellByInitials(defs, "")).toBe(-1);
  });
  it("Nox (índice 48) es INCASTABLE: no está en la tabla 0x1c30", () => {
    // Nox = una sola sílaba 'N'; no debe emparejar (index 48 > 47).
    expect(matchSpellByInitials(defs, "N")).toBe(-1);
  });
  it("emparejamiento redondo: cada hechizo 0..47 se recupera por sus iniciales ordenadas", () => {
    for (const d of defs) {
      if (d.index > 47) continue; // Nox fuera de tabla
      const initials = d.syllables.map((s) => s[0]!.toUpperCase()).join("");
      const matched = matchSpellByInitials(defs, initials);
      // Debe recuperar un hechizo con el MISMO conjunto de iniciales (puede haber
      // un índice menor si dos hechizos comparten iniciales; el binario devuelve el
      // primero). Verificamos que el conjunto ordenado coincide.
      const got = defs[matched]!;
      const sortKey = (x: SpellDef): string =>
        x.syllables.map((s) => s[0]!.toUpperCase()).sort().join("");
      expect(sortKey(got)).toBe(sortKey(d));
    }
  });
});

describe("mixSpell", () => {
  it("mezcla In_Lor consumiendo ceniza de azufre real del estado inicial", () => {
    const g = freshGame();
    // Estado inicial real: reagentQuantities = [4,6,7,6,0,3,0,0]
    expect(g.reagentQuantities[0]).toBe(4);
    const before = g.spellQuantities[0] ?? 0;
    const r = mixSpell(g, spell("In_Lor"), 2);
    expect(r.ok).toBe(true);
    expect(r.message).toBe("Done!"); // DS 0x8ffc (antes "Mixed!", no era el string original)
    expect(g.reagentQuantities[0]).toBe(2); // 4 - 2
    expect(g.spellQuantities[0]).toBe(before + 2);
  });

  it("rechaza sin mutar cuando falta un reagente (Vas_Lor requiere mandrágora, hay 0)", () => {
    const g = freshGame();
    expect(g.reagentQuantities[7]).toBe(0); // MandrakeRoot
    const ash = g.reagentQuantities[0];
    const before = g.spellQuantities[12] ?? 0; // Vas_Lor index 12
    const r = mixSpell(g, spell("Vas_Lor"), 1);
    expect(r.ok).toBe(false);
    // "Insufficient reagents!" (DS 0x8f7e) — el fallo REAL de Mix; "None mixed!"
    // (0x463a) es el gate de (C)ast, no de Mix (misatribución corregida).
    expect(r.message).toBe("Insufficient reagents!");
    expect(g.reagentQuantities[0]).toBe(ash); // sin consumir
    expect(g.spellQuantities[12] ?? 0).toBe(before);
  });

  it("la carga mezclada satura en 99 pero se gastan los reagentes completos (cap 0x1be7)", () => {
    const g = freshGame();
    // Prepara In_Lor cerca del tope y muchos Ash para poder pedir N grande.
    g.spellQuantities[0] = 98;
    g.reagentQuantities[0] = 20; // Ash de sobra
    const r = mixSpell(g, spell("In_Lor"), 5);
    expect(r.ok).toBe(true);
    expect(g.spellQuantities[0]).toBe(99); // 98 + 5 = 103 → tope 99 (CMDS 0x1be7)
    expect(g.reagentQuantities[0]).toBe(15); // 20 − 5: se gastan los 5 aunque sature
  });
});

describe("mixSelected (reagentes marcados a mano, CMDS 0x18be → 0x1bc2)", () => {
  it("reagentes CORRECTOS: consume los marcados y añade la carga", () => {
    const g = freshGame();
    expect(g.reagentQuantities[0]).toBe(4); // Ash
    const before = g.spellQuantities[0] ?? 0;
    // In_Lor requiere SÓLO Ash (idx 0). Marcamos [0] → máscara casa.
    const r = mixSelected(g, spell("In_Lor"), [0], 2, noRand()); // acierta → no debe tirar
    expect(r.correct).toBe(true);
    expect(g.reagentQuantities[0]).toBe(2); // 4 − 2
    expect(g.spellQuantities[0]).toBe(before + 2);
  });

  it("reagentes INCORRECTOS: se GASTAN igual pero NO hay carga (0x1bf6)", () => {
    const g = freshGame();
    const ginsengBefore = g.reagentQuantities[1]!; // Ginseng (no lo pide In_Lor)
    const ashBefore = g.reagentQuantities[0]!;
    const spellBefore = g.spellQuantities[0] ?? 0;
    // In_Lor requiere Ash [0]; marcamos Ginseng [1] → máscara NO casa.
    // Desde #105 esa rama dispara la trampa: rand(0,7)=3 → POISON, que no tira más
    // (aquí sólo se mira la CONTABILIDAD de reagentes; la trampa tiene su describe).
    const r = mixSelected(g, spell("In_Lor"), [1], 3, scripted([3]));
    expect(r.correct).toBe(false);
    expect(g.reagentQuantities[1]).toBe(ginsengBefore - 3); // Ginseng gastado
    expect(g.reagentQuantities[0]).toBe(ashBefore); // Ash intacto (no marcado)
    expect(g.spellQuantities[0] ?? 0).toBe(spellBefore); // sin carga
  });

  it("SUBCONJUNTO/superconjunto de la máscara requerida = incorrecto (compara la máscara entera)", () => {
    const g = freshGame();
    // In_Lor requiere sólo [0]; marcar [0,1] es un SUPERCONJUNTO → no casa, ambos se gastan.
    // ⚠ Los dos asertos de abajo eran TAUTOLOGÍAS —`expect(X).toBe(X)`— hasta la
    // auditoría de 30-07: comparaban el valor POST-mutación consigo mismo, así que no
    // podían fallar y sus comentarios («sin carga añadida», «consumido también»)
    // afirmaban cosas que el test NO probaba. Ahora van contra valores CAPTURADOS.
    const spellBefore = g.spellQuantities[0] ?? 0;
    const ginsengBefore = g.reagentQuantities[1]!; // 6 en el estado fresco
    const r = mixSelected(g, spell("In_Lor"), [0, 1], 1, scripted([3])); // POISON: 0 tiradas extra
    expect(r.correct).toBe(false);
    expect(g.spellQuantities[0] ?? 0).toBe(spellBefore); // sin carga añadida
    expect(g.reagentQuantities[0]).toBe(3); // 4 − 1
    expect(g.reagentQuantities[1]).toBe(ginsengBefore - 1); // consumido también
  });

  it("hechizo de 2 reagentes (An_Xen_Corp = Ash+Garlic, idx7): la máscara exacta acierta", () => {
    const g = freshGame();
    const s = spell("An_Xen_Corp"); // reagentes [0,2] → máscara 0xa0
    expect(new Set(s.reagents)).toEqual(new Set([0, 2]));
    const before = g.spellQuantities[s.index] ?? 0;
    const r = mixSelected(g, s, [2, 0], 1, noRand()); // orden distinto, misma máscara
    expect(r.correct).toBe(true);
    expect(g.spellQuantities[s.index]).toBe(before + 1);
  });
});

/**
 * #105 — LA TRAMPA DE MIX. Mezclar con la máscara equivocada NO es un no-op: el
 * original salta a 0x1bf6 y dispara `chest_trap_trigger` (0x1c04 `call 0x7050` =
 * kernel 0x2fd0) sobre el primer miembro consciente (0x1bfd = kernel 0x39fc).
 * Derivación completa: re/notes/mix-trap-105-acta.md §1 y §3.
 *
 * El estado fresco tiene `location = 13` (≤ 0x7f) ⇒ TABLA COMPLETA de tipos
 * (DS 0x559e = [0,0,0,1,1,2,2,3]), así que la 1ª tirada es `rand(0,7)`.
 */
describe("mixSelected → trampa con reagentes equivocados (CMDS 0x1bf6-0x1c04, #105)", () => {
  it("reagentes INCORRECTOS: dispara la trampa y hiere al que la come", () => {
    const g = freshGame();
    const hpBefore = g.characters[0]!.currentHp;
    // Stream: rand(0,7)=0 → TRAP_TYPE_TABLE[0] = 0 = ACID; rand(0,60)=40 → daño 40>>1 = 20.
    const r = mixSelected(g, spell("In_Lor"), [1], 1, scripted([0, 40]));
    expect(r.correct).toBe(false);
    expect(r.trap).not.toBeNull();
    expect(r.trap!.result.type).toBe("ACID");
    expect(g.characters[0]!.currentHp).toBe(hpBefore - 20);
  });

  it("reagentes CORRECTOS: NO hay trampa y NO se consume NI UNA tirada (0x1bd6)", () => {
    const g = freshGame();
    const rand = counting();
    const r = mixSelected(g, spell("In_Lor"), [0], 1, rand.fn);
    expect(r.correct).toBe(true);
    expect(r.trap).toBeNull();
    expect(rand.calls()).toBe(0); // la rama buena de 0x1bd6 no toca el RNG
  });

  it("la come el PRIMER miembro 'G'/'P' del party (kernel 0x39fc), no el slot 0", () => {
    const g = freshGame();
    g.characters[0]!.status = "D"; // muerto  → 0x39fc lo salta
    g.characters[1]!.status = "S"; // dormido → 0x39fc lo salta
    g.characters[2]!.status = "G"; // ← el primero consciente
    // rand(0,7)=3 → TRAP_TYPE_TABLE[3] = 1 = POISON: envenena al que abre, sin más tiradas.
    const r = mixSelected(g, spell("In_Lor"), [1], 1, scripted([3]));
    expect(r.trap!.result.type).toBe("POISON");
    expect(r.trap!.opener).toBe(2);
    expect(g.characters[2]!.status).toBe("P");
  });

  /**
   * 🔴 Este test existe porque un MUTANTE SOBREVIVIÓ: quitar `s === "P"` de
   * `firstConsciousIndex` dejaba la batería ENTERA en verde (5387 pasaban). Ningún
   * test del repo cubría que un ENVENENADO sigue contando como consciente — y el
   * binario es explícito (0x39fc acepta 'G' 0x47 **y** 'P' 0x50). El mutante no
   * validó el fix: acusó al test que faltaba.
   */
  it("un miembro ENVENENADO ('P') SÍ cuenta como consciente (0x39fc acepta 'G' y 'P')", () => {
    const g = freshGame();
    g.characters[0]!.status = "D"; // muerto → saltado
    g.characters[1]!.status = "P"; // envenenado pero EN PIE → éste la come
    g.characters[2]!.status = "G";
    // HP puesto A MANO: el slot 1 del estado inicial trae 5 PV, y con 20 de daño el
    // clamp a 0 de `damageMember` taparía la resta. El sujeto aquí es QUIÉN la come.
    g.characters[1]!.currentHp = 50;
    // rand(0,7)=0 → ACID; rand(0,60)=40 → daño 20 al que abre.
    const r = mixSelected(g, spell("In_Lor"), [1], 1, scripted([0, 40]));
    expect(r.trap!.opener).toBe(1);
    expect(g.characters[1]!.currentHp).toBe(30);
    expect(g.characters[2]!.currentHp).toBe(90); // el 'G' de detrás, intacto
  });
});

describe("tablas exactas", () => {
  it("TIME_PERMITTED_BITS: 48 entradas, In Lor 0x0e, Grav Por 0x01 (combat), Rel Hur 0x08 (exterior)", () => {
    expect(TIME_PERMITTED_BITS.length).toBe(48);
    expect(TIME_PERMITTED_BITS[0]).toBe(0x0e); // In Lor: exterior+pueblo+mazmorra
    expect(TIME_PERMITTED_BITS[1]).toBe(0x01); // Grav Por: sólo combate
    expect(TIME_PERMITTED_BITS[8]).toBe(0x08); // Rel Hur: sólo exterior
    expect(TIME_PERMITTED_BITS[47]).toBe(0x0f); // An Tym: en todas partes
  });

  it("requiredTimeBit mapea location→bit (0 exterior, pueblo, mazmorra, combate)", () => {
    expect(requiredTimeBit(0, false)).toBe(0x08); // exterior
    expect(requiredTimeBit(1, false)).toBe(0x04); // pueblo
    expect(requiredTimeBit(0x20, false)).toBe(0x04);
    expect(requiredTimeBit(0x21, false)).toBe(0x02); // mazmorra
    expect(requiredTimeBit(0x7f, false)).toBe(0x02);
    expect(requiredTimeBit(0x81, false)).toBe(0x01); // combate por location
    expect(requiredTimeBit(0, true)).toBe(0x01); // combate forzado por flag
  });

  it("resurrectionLevel = bitlength(exp/100)+1 (bucle CAST2:0x0680)", () => {
    expect(resurrectionLevel(0)).toBe(1); // exp/100=0 → nivel 1
    expect(resurrectionLevel(150)).toBe(2); // exp/100=1 → nivel 2
    expect(resurrectionLevel(399)).toBe(3); // exp/100=3 → nivel 3
    expect(resurrectionLevel(500)).toBe(4); // exp/100=5 → nivel 4
    expect(resurrectionLevel(3000)).toBe(6); // exp/100=30 → nivel 6
  });

  it("kalXenSummonType: rangos de rand(0,15) → 0x14/0x16/0x15/0x22", () => {
    expect([0, 5].map(kalXenSummonType)).toEqual([0x14, 0x14]);
    expect([6, 10].map(kalXenSummonType)).toEqual([0x16, 0x16]);
    expect([11, 13].map(kalXenSummonType)).toEqual([0x15, 0x15]);
    expect([14, 15].map(kalXenSummonType)).toEqual([0x22, 0x22]);
  });
});

describe("castSpell — dispatcher exacto", () => {
  it("In_Lor exterior: luz 100 MINUTOS (no turnos), consumo de hechizo + maná", () => {
    const g = freshGame();
    const iolo = g.characters[2]!; // Iolo, Bard, MP 8, lvl 3
    const beforeSpell = g.spellQuantities[0] ?? 0;
    const r = castSpell(g, iolo, spell("In_Lor"), OUTDOOR, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "light", mins: 100 });
    expect(g.lightSpellMins).toBe(100); // escribe (no suma)
    expect(g.spellQuantities[0]).toBe(beforeSpell - 1);
    expect(iolo.currentMp).toBe(8 - 1);
  });

  it("Vas_Lor: luz 255 minutos", () => {
    const g = freshGame();
    g.spellQuantities[12] = 2;
    const mariah = g.characters[3]!; // Mage lvl 3, mp 22
    const r = castSpell(g, mariah, spell("Vas_Lor"), OUTDOOR, rng());
    expect(r.effect).toEqual({ kind: "light", mins: 255 });
    expect(g.lightSpellMins).toBe(255);
  });

  it("Uus_Por en mazmorra → descriptor dungeonAscend (consume hechizo + maná)", () => {
    const g = freshGame();
    const caster = g.characters[3]!; // Mage
    caster.level = 8;
    caster.currentMp = 30;
    g.spellQuantities[21] = 1;
    const r = castSpell(g, caster, spell("Uus_Por"), { location: 0x21, inCombat: false }, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "dungeonAscend" });
    expect(g.spellQuantities[21]).toBe(0);
  });

  it("Des_Por en mazmorra → descriptor dungeonDescend", () => {
    const g = freshGame();
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    g.spellQuantities[22] = 1;
    const r = castSpell(g, caster, spell("Des_Por"), { location: 0x21, inCombat: false }, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "dungeonDescend" });
  });

  /**
   * ★ TESTIGO DEL CORPUS `ad24-g03` (walkthrough AD, Shame, ocrLn 242-245): dentro de una
   * SALA de mazmorra el jugador pulsa `c` y teclea Des Por, y el original responde
   * **«Not here!»** — no baja de planta. La razón es la ventana temporal: en el mapa de
   * combate el binario pone `g_location >= 0x80`, así que el bit exigido es el de COMBATE
   * (0x01) y `TIME_PERMITTED_BITS[22] = 0x02` (sólo mazmorra) no lo tiene. El casteo ni
   * siquiera llega a `magicChangeLevel`.
   *
   * Estaba cubierto por MECANISMO (la tabla) pero no por TESTIGO: el gate de Des Por sólo
   * se probaba en exterior, que es otra rama de `requiredTimeBit` (`location === 0`).
   */
  it("★ testigo ad24-g03: Des_Por en SALA de mazmorra (mapa de combate) → 'Not here!' sin consumir", () => {
    const g = freshGame();
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    g.spellQuantities[22] = 1;
    const r = castSpell(g, caster, spell("Des_Por"), COMBAT, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Not here!");
    expect(r.effect).toBeNull();
    expect(g.spellQuantities[22]).toBe(1); // el gate corta ANTES del consumo
  });

  it("Uus_Por en exterior → 'Not here!' (ventana temporal: sólo mazmorra, bit 0x02)", () => {
    const g = freshGame();
    const caster = g.characters[3]!;
    g.spellQuantities[21] = 1;
    const r = castSpell(g, caster, spell("Uus_Por"), OUTDOOR, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Not here!");
    expect(g.spellQuantities[21]).toBe(1); // no consume (gate antes del consumo)
  });

  it("Grav_Por fuera de combate → 'Not here!' sin consumir (bit combate ausente)", () => {
    const g = freshGame();
    const iolo = g.characters[2]!;
    const before = g.spellQuantities[1] ?? 0;
    const r = castSpell(g, iolo, spell("Grav_Por"), OUTDOOR, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Not here!");
    expect(g.spellQuantities[1] ?? 0).toBe(before); // ventana temporal: antes del consumo
  });

  it("Grav_Por en combate → combatAttack table-driven (weapon 0x30, NO círculo·6)", () => {
    const g = freshGame();
    const iolo = g.characters[2]!;
    const r = castSpell(g, iolo, spell("Grav_Por"), COMBAT, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "combatAttack", weaponId: 0x30 });
  });

  it("Xen_Corp en combate → weapon 0x32 (muerte instantánea)", () => {
    const g = freshGame();
    g.spellQuantities[37] = 1;
    const mariah = g.characters[3]!; // lvl 3 < circle 7 → gate de nivel
    // subimos el nivel para pasar el gate y comprobar el efecto
    mariah.level = 7;
    mariah.currentMp = 20;
    const r = castSpell(g, mariah, spell("Xen_Corp"), COMBAT, rng());
    expect(r.effect).toEqual({ kind: "combatAttack", weaponId: 0x32 });
  });

  it("sin maná: 'M.P. too low!' + tail Failed! (consumed) y el hechizo SÍ se consume (divergencia #6)", () => {
    const g = freshGame();
    const shamino = g.characters[1]!; // Fighter, MP 0, lvl 2
    const before = g.spellQuantities[0] ?? 0;
    const r = castSpell(g, shamino, spell("In_Lor"), OUTDOOR, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toBe("M.P. too low!"); // línea propia (CAST 0x0ede, DS 0x4647)
    expect(r.consumed).toBe(true); // ⇒ el llamador añade "Failed!" (tail 0x11a6, result=0)
    expect(g.spellQuantities[0]).toBe(before - 1); // consumido pese al fallo
    expect(shamino.currentMp).toBe(0); // maná no baja de 0
  });

  it("gate de NIVEL: nivel < círculo → mensaje propio VACÍO pero consumed (tail imprime Failed!)", () => {
    // El gate 0f01 NO imprime en su sitio; pone result=0 y cae al tail común (0x11a6),
    // que con result=0 imprime "Failed!" (DS 0x4660). El core devuelve message:"" y
    // consumed:true; el "Failed!" lo emite el llamador con `!ok && consumed` (hilo cast-echo
    // hallazgo-2; magic.md §0 tail). NO es silencioso a nivel de juego.
    const g = freshGame();
    g.spellQuantities[47] = 1; // An Tym, círculo 8
    const iolo = g.characters[2]!; // lvl 3 < 8; mp 8 >= 8
    const r = castSpell(g, iolo, spell("An_Tym"), OUTDOOR, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toBe(""); // el gate no imprime su propia línea
    expect(r.consumed).toBe(true); // ⇒ señal del tail → "Failed!"
    expect(g.spellQuantities[47]).toBe(0); // consumido
    expect(iolo.currentMp).toBe(0); // 8 - 8
    expect(g.timeSpell).toBeUndefined(); // sin efecto
  });

  it("señal del tail 0x11a6: SÓLO los gates que consumen (maná/nivel) piden 'Failed!'", () => {
    // Contrato que consume el llamador (main.ts): `!ok && consumed` ⟺ el cast cayó al tail
    // con result=0 → "Failed!". Los fallos PRE-consumo (Not here!/None mixed!) NO consumen ⇒
    // NO piden Failed! (sólo su propia línea). Cierra el hilo cast-echo hallazgo-2.
    const g = freshGame();
    // (a) fuera de sitio: Grav Por (bits 0x01, sólo combate) en exterior → "Not here!" (gate de
    //     ubicación 0e1a, ANTES del consumo), sin consumir
    g.spellQuantities[1] = 1;
    const notHere = castSpell(g, g.characters[0]!, spell("Grav_Por"), OUTDOOR, rng());
    expect(notHere.ok).toBe(false);
    expect(notHere.message).toBe("Not here!");
    expect(notHere.consumed).toBe(false); // NO cae al tail-Failed
    expect(g.spellQuantities[1]).toBe(1); // no consumido

    // (b) no mezclado: None mixed!, sin consumir
    g.spellQuantities[0] = 0;
    const noneMixed = castSpell(g, g.characters[0]!, spell("In_Lor"), OUTDOOR, rng());
    expect(noneMixed.ok).toBe(false);
    expect(noneMixed.message).toBe("None mixed!");
    expect(noneMixed.consumed).toBe(false); // NO cae al tail-Failed
  });

  it("An_Tym con nivel suficiente → estado temporal 'T'/10 en el global único", () => {
    const g = freshGame();
    g.spellQuantities[47] = 1;
    const iolo = g.characters[2]!;
    iolo.level = 8;
    const r = castSpell(g, iolo, spell("An_Tym"), OUTDOOR, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "timeStatus", status: "T", turns: 10 });
    expect(g.timeSpell).toBe("T");
    expect(g.timeSpellTurns).toBe(10);
  });

  it("estados temporales comparten el ÚNICO global (Rel_Tym 'Q'/30 pisa a In_Sanct 'P'/20)", () => {
    const g = freshGame();
    g.spellQuantities[19] = 1; // In Sanct
    g.spellQuantities[29] = 1; // Rel Tym
    const mariah = g.characters[3]!;
    mariah.level = 5;
    mariah.currentMp = 20;
    castSpell(g, mariah, spell("In_Sanct"), OUTDOOR, rng());
    expect(g.timeSpell).toBe("P");
    expect(g.timeSpellTurns).toBe(20);
    castSpell(g, mariah, spell("Rel_Tym"), OUTDOOR, rng());
    expect(g.timeSpell).toBe("Q"); // pisa
    expect(g.timeSpellTurns).toBe(30);
  });

  it("In_Wis (antes 'unsupported') ahora es un efecto peer válido", () => {
    const g = freshGame();
    const idx = spell("In_Wis").index;
    g.spellQuantities[idx] = 3;
    const mariah = g.characters[3]!; // Mage, mp 22, lvl 3 >= circle 2
    const r = castSpell(g, mariah, spell("In_Wis"), OUTDOOR, rng());
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "peer" });
  });

  it("In_Xen_Mani crea comida rand(1,3) capada a 9999", () => {
    const g = freshGame();
    g.spellQuantities[11] = 1;
    g.food = 100;
    const mariah = g.characters[3]!;
    const r = castSpell(g, mariah, spell("In_Xen_Mani"), OUTDOOR, rng(0x1234));
    expect(r.effect?.kind).toBe("food");
    if (r.effect?.kind === "food") {
      expect(r.effect.amount).toBeGreaterThanOrEqual(1);
      expect(r.effect.amount).toBeLessThanOrEqual(3);
      expect(g.food).toBe(100 + r.effect.amount);
    }
  });

  it("Rel_Hur exterior: fija el viento con el remap flecha→viento (N flecha=3 → viento 1)", () => {
    const g = freshGame();
    g.spellQuantities[8] = 1;
    const mariah = g.characters[3]!;
    const r = castSpell(g, mariah, spell("Rel_Hur"), { location: 0, inCombat: false, windArrow: 3 }, rng());
    expect(r.effect).toEqual({ kind: "wind", windCode: 1 }); // flecha Norte(3)→viento 1
    expect(g.wind).toBe(1);
  });
});

describe("helpers de aplicación con objetivo", () => {
  it("applyMani: HP = min(HP+rand30, maxHP); no cura muertos", () => {
    const g = freshGame();
    const mariah = g.characters[3]!; // hp 2/90
    const r = rng(0x1234);
    const healed = applyMani(mariah, r);
    expect(healed).toBeGreaterThanOrEqual(1);
    expect(healed).toBeLessThanOrEqual(30);
    expect(mariah.currentHp).toBe(2 + healed);
    // muerto → sin efecto
    mariah.status = "D";
    const before = mariah.currentHp;
    expect(applyMani(mariah, r)).toBe(0);
    expect(mariah.currentHp).toBe(before);
  });

  it("applyMani capa a maxHP", () => {
    const g = freshGame();
    const m = g.characters[3]!;
    m.currentHp = m.maxHp - 1; // 89/90
    applyMani(m, rng(0x1));
    expect(m.currentHp).toBe(m.maxHp);
  });

  it("applyVasMani: HP=maxHP (curación total); no revive muertos", () => {
    const g = freshGame();
    const mariah = g.characters[3]!;
    expect(applyVasMani(mariah)).toBe(true);
    expect(mariah.currentHp).toBe(mariah.maxHp);
    mariah.status = "D";
    mariah.currentHp = 0;
    expect(applyVasMani(mariah)).toBe(false);
    expect(mariah.currentHp).toBe(0);
  });

  it("applyCure/applyAwaken sólo actúan sobre el estado correcto", () => {
    const g = freshGame();
    const m = g.characters[0]!;
    m.status = "P";
    expect(applyCure(m)).toBe(true);
    expect(m.status).toBe("G");
    expect(applyCure(m)).toBe(false); // ya sano
    m.status = "S";
    expect(applyAwaken(m)).toBe(true);
    expect(m.status).toBe("G");
    expect(applyAwaken(m)).toBe(false);
  });

  it("applyResurrect: 'D'→'G', HP=1, nivel/maxHP recalculados, exp·karma/100 si karma<98", () => {
    const g = freshGame();
    const m = g.characters[3]!; // Mage, int 22
    m.status = "D";
    m.exp = 500;
    m.currentMp = 0;
    const ok = applyResurrect(m, 75); // karma 75 < 98
    expect(ok).toBe(true);
    expect(m.status).toBe("G");
    expect(m.currentHp).toBe(1);
    expect(m.currentMp).toBe(22); // Mage: MP = INT
    expect(m.exp).toBe(Math.floor((500 * 75) / 100)); // 375
    expect(m.level).toBe(resurrectionLevel(375)); // exp/100=3 → 3
    expect(m.maxHp).toBe(30 * m.level);
  });

  it("applyResurrect no revive a los vivos", () => {
    const g = freshGame();
    const m = g.characters[0]!;
    expect(applyResurrect(m, 75)).toBe(false);
  });

  it("applyResurrect con karma>=98 no penaliza la experiencia; Bard MP=INT/2", () => {
    const g = freshGame();
    const m = g.characters[2]!; // Iolo, Bard 'B', int 17
    m.status = "D";
    m.exp = 500;
    applyResurrect(m, 98);
    expect(m.exp).toBe(500); // sin penalización
    expect(m.currentMp).toBe(17 >> 1); // Bard: INT/2 = 8
  });
});
