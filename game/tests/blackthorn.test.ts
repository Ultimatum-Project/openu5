/**
 * Tests de GUARDIAS / CÁRCEL / BLACKTHORN (Task 3.10). Reglas exactas de
 * BLCKTHRN.OVL + kernel/TOWN/TALK; ver re/notes/blackthorn.md y
 * re/verified/blackthorn.md. La paridad completa modelo↔clon vive en
 * re/tools/test_blackthorn_parity.py.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import {
  BLACKTHORN_PASSWORD,
  REFUGE_KARMA_FLOOR,
  blackthornCapture,
  blackthornCaptureTriggers,
  blackthornGuardCaptureTriggers,
  countLiving,
  palaceGuardAdjacent,
  guardDemand,
  mantraMatches,
  partyConsciousState,
  partyRefuge,
  pickInterrogationShrine,
  postPurchaseGoldDrain,
  runInterrogation,
  sacrificeFirstCompanion,
  shadowlordPresentIndex,
  TIME_SPELL_BADGE,
} from "../src/core/world/blackthorn.js";

function char(status: string, name = ""): CharacterState {
  return {
    name,
    gender: 0x0b,
    class: "A",
    status,
    strength: 15,
    dexterity: 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: status === "D" ? 0 : 30,
    maxHp: 30,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
  };
}

function stub(fields: Partial<GameState>): GameState {
  return {
    version: 1,
    gold: 0,
    keys: 0,
    karma: 0,
    food: 0,
    partySize: (fields.characters ?? []).length,
    characters: [],
    position: { location: 0, floor: 0, x: 0, y: 0 },
    transport: "foot",
    time: { year: 139, month: 1, day: 1, hour: 12, minute: 30 },
    ...fields,
  } as GameState;
}

const MANTRAS = ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"];

describe("party_conscious_state (kernel 0x39fc)", () => {
  it("0 si hay consciente, 1 si sólo dormidos, -1 si todos muertos", () => {
    expect(partyConsciousState(stub({ characters: [char("G"), char("D")] }))).toBe(0);
    expect(partyConsciousState(stub({ characters: [char("P"), char("D")] }))).toBe(0);
    expect(partyConsciousState(stub({ characters: [char("S"), char("D")] }))).toBe(1);
    expect(partyConsciousState(stub({ characters: [char("D"), char("D")] }))).toBe(-1);
  });
});

describe("disparo de la captura (TOWN 0x12ae)", () => {
  it("sólo en el Palacio (0x12) con el party no del todo muerto", () => {
    const alive = stub({ characters: [char("G")], position: { location: 0x12, floor: 0, x: 0, y: 0 } });
    expect(blackthornCaptureTriggers(alive)).toBe(true);
    const dead = stub({ characters: [char("D")], position: { location: 0x12, floor: 0, x: 0, y: 0 } });
    expect(blackthornCaptureTriggers(dead)).toBe(false);
    const elsewhere = stub({ characters: [char("G")], position: { location: 6, floor: 0, x: 0, y: 0 } });
    expect(blackthornCaptureTriggers(elsewhere)).toBe(false);
  });
});

describe("trigger real de captura por guardia (npc_engine TOWN 0x1352 → 0x12ae)", () => {
  // #64: `aiType` EXPLÍCITO. `armaElSlot` ya no da por armado al guardia del Palacio
  // (el gate `0x072c,` corre para todos) y su defecto es 0 = NO arma. Estos casos
  // estudian la GEOMETRÍA, así que declaran el aiType armado en vez de heredarlo.
  const G = (x: number, y: number, type = 0x70, floor = 0) =>
    ({ x, y, type, floor, aiType: 4, dialogNumber: 0xff });

  it("palaceGuardAdjacent: sólo con un guardia (0x70) a manhattan==1 en la misma planta", () => {
    // Adyacente ortogonal (fast-path 0x0723 cmp ax,1).
    expect(palaceGuardAdjacent(10, 10, 0, [G(11, 10)])).toBe(true);
    expect(palaceGuardAdjacent(10, 10, 0, [G(10, 9)])).toBe(true);
    // Diagonal = manhattan 2 → NO (el fast-path exige ==1).
    expect(palaceGuardAdjacent(10, 10, 0, [G(11, 11)])).toBe(false);
    // A 2 casillas → NO (persecución = loop 0x083d, Clase C, no dispara).
    expect(palaceGuardAdjacent(10, 10, 0, [G(12, 10)])).toBe(false);
    // Encima del party (manhattan 0) → NO.
    expect(palaceGuardAdjacent(10, 10, 0, [G(10, 10)])).toBe(false);
    // Otra planta → NO (gate de planta NPC.OVL 0x1259).
    expect(palaceGuardAdjacent(10, 10, 0, [G(11, 10, 0x70, 1)])).toBe(false);
    // No es guardia (type != 0x70) → NO (0x13a7 cmp byte[bx],0x70).
    expect(palaceGuardAdjacent(10, 10, 0, [G(11, 10, 0x71)])).toBe(false);
  });

  it("★ el ÍNDICE MAYOR PISA el slot: un absorbedor no-guardia adyacente SUPRIME la captura", () => {
    // [0x65bf] guarda UN índice y el bucle NPC.OVL 0x0db4 lo recorre ASCENDENTE
    // (0x1267 `cmp` con 0x20 = 31 índices), limpiando en el prólogo (0x0dc1/0x0dc6):
    // cada candidato PISA al anterior, así que gana el de índice MAYOR. Si el ganador
    // no es guardia, su despacho corre SU handler y la demanda del guardia se suprime.
    // En el Palacio hay TRES absorbedores no-guardia con índice superior a los OCHO
    // guardias (slots 8..15): el 16 (type 0x48, aiType 4, dlg 11) y los hostiles
    // 17 y 18 (type 0xb8, aiType 6).
    const guardia = { x: 11, y: 10, type: 0x70, floor: 0, slot: 15, aiType: 4, dialogNumber: 0xff };
    const hostil = { x: 10, y: 9, type: 0xb8, floor: 0, slot: 17, aiType: 6, dialogNumber: 0 };

    // El guardia SOLO dispara.
    expect(palaceGuardAdjacent(10, 10, 0, [guardia])).toBe(true);
    // Con el hostil de índice MAYOR también adyacente, el slot es SUYO ⇒ NO dispara.
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, hostil])).toBe(false);
    // …y el orden del array no manda: manda el ÍNDICE.
    expect(palaceGuardAdjacent(10, 10, 0, [hostil, guardia])).toBe(false);

    // CONTROL 1 — índice MENOR no pisa: el guardia sigue ganando.
    const hostilMenor = { ...hostil, slot: 3 };
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, hostilMenor])).toBe(true);

    // CONTROL 2 — un NPC normal (aiType <= 3) NO arma el slot aunque su índice sea
    // mayor: sale por 0x072c `cmp word ptr [bp - 2], 3` / `jle` al bucle de movimiento.
    // Sin este control, el fix pasaría con un predicado que bloquea con CUALQUIER NPC.
    const normal = { ...hostil, slot: 30, aiType: 2 };
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, normal])).toBe(true);

    // CONTROL 3 — aiType 4/5 exige dlgNum != 0 (0x0740 `cmp word ptr [bx + 0xa], 0` / je).
    const mudo = { ...hostil, slot: 30, aiType: 4, dialogNumber: 0 };
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, mudo])).toBe(true);
    const hablador = { ...mudo, dialogNumber: 11 };
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, hablador])).toBe(false);

    // CONTROL 4 — el absorbedor tiene que estar ADYACENTE de verdad (manhattan 1) y en
    // la MISMA planta: si no, no entra en el barrido y el guardia conserva el slot.
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, { ...hostil, x: 13, y: 10 }])).toBe(true);
    expect(palaceGuardAdjacent(10, 10, 0, [guardia, { ...hostil, floor: 1 }])).toBe(true);
  });

  it("blackthornGuardCaptureTriggers: loc 0x12 + consciente + guardia adyacente", () => {
    const at = (loc: number, status: string, guards: ReturnType<typeof G>[]) =>
      blackthornGuardCaptureTriggers(
        stub({ characters: [char(status)], position: { location: loc, floor: 0, x: 10, y: 10 } }),
        guards,
      );
    // En el Palacio, vivo, con guardia adyacente → captura.
    expect(at(0x12, "G", [G(11, 10)])).toBe(true);
    // En el Palacio, vivo, SIN guardia adyacente → NO (ya no es per-turno).
    expect(at(0x12, "G", [G(15, 15)])).toBe(false);
    // Guardia adyacente pero fuera del Palacio → NO (gate 0x12ae loc 0x12).
    expect(at(6, "G", [G(11, 10)])).toBe(false);
    // Guardia adyacente pero party del todo muerto → NO (refuge se encarga, 0x12c5).
    expect(at(0x12, "D", [G(11, 10)])).toBe(false);
  });
});

describe("selección de santuario (BLCKTHRN 0x0659)", () => {
  it("el primer santuario con byte 0", () => {
    expect(pickInterrogationShrine(stub({ shrineDestroyed: new Array(8).fill(0) }))).toBe(0);
    expect(pickInterrogationShrine(stub({ shrineDestroyed: [0xff, 0, 0, 0, 0, 0, 0, 0] }))).toBe(1);
    expect(pickInterrogationShrine(stub({ shrineDestroyed: new Array(8).fill(0xff) }))).toBeNull();
  });
});

describe("matcher de mantra (BLCKTHRN 0x02ea)", () => {
  it("substring toupper", () => {
    expect(mantraMatches("AHM", "Ahm")).toBe(true);
    expect(mantraMatches("the ahm shrine", "Ahm")).toBe(true);
    expect(mantraMatches("mu", "Ahm")).toBe(false);
  });
});

describe("sacrifice_member (BLCKTHRN 0x03ae)", () => {
  it("quita el 2º vivo, nunca el Avatar — y lo APARCA en el slot 15 con 0x7f", () => {
    const st = stub({ characters: [char("G", "Avatar"), char("D", "Ghost"), char("G", "Iolo")] });
    const victim = sacrificeFirstCompanion(st);
    expect(victim).toBe("Iolo"); // el 2º VIVO, saltando el muerto
    expect(st.partySize).toBe(2);
    expect(st.characters[0]!.name).toBe("Avatar");
    expect(st.characters[1]!.name).toBe("Ghost");
    // aparcamiento 0x04c2-0x04cf: record ENTERO en g_party_records[15] (DS:0x5788)
    // y byte final [0x57A7]=0x7f (offset 0x1F = partyStatus) — no un scratch efímero.
    expect(st.characters[15]!.name).toBe("Iolo");
    expect(st.characters[15]!.partyStatus).toBe(0x7f);
  });
});

describe("interrogatorio (BLCKTHRN 0x054a)", () => {
  it("mantra correcto con party>1 = traición: karma -5, santuario caído, sacrificio", () => {
    const st = stub({ characters: [char("G"), char("G"), char("G")], karma: 50, shrineDestroyed: new Array(8).fill(0) });
    const r = runInterrogation(st, 3, 0, "Ahm", ["AHM"]);
    expect(r.outcome).toBe("betrayal");
    expect(st.karma).toBe(45);
    expect(st.shrineDestroyed?.[0]).toBe(0xff);
    expect(r.sacrificed).toBe(1);
    expect(st.partySize).toBe(2);
  });

  it("Avatar solo acertando = perdón, sin sacrificio", () => {
    const st = stub({ characters: [char("G")], karma: 3, shrineDestroyed: new Array(8).fill(0) });
    const r = runInterrogation(st, 1, 2, "Ra", ["ra"]);
    expect(r.outcome).toBe("betrayal");
    expect(r.rewardedWithLife).toBe(true);
    expect(r.sacrificed).toBe(0);
    expect(st.karma).toBe(0); // 3-5 suelo 0
  });

  it("negarse con party>1 = péndulo en la 4ª ronda, sin tocar karma", () => {
    const st = stub({ characters: [char("G"), char("G"), char("G")], karma: 50, shrineDestroyed: new Array(8).fill(0) });
    const r = runInterrogation(st, 3, 0, "Ahm", ["x", "x", "x", "x"]);
    expect(r.outcome).toBe("pendulum");
    expect(r.sacrificed).toBe(1);
    expect(r.clockMinutes).toBe(6);
    expect(st.karma).toBe(50);
  });

  it("Avatar solo negándose = a la cárcel, sin sacrificio", () => {
    const st = stub({ characters: [char("G")], karma: 50, shrineDestroyed: new Array(8).fill(0) });
    const r = runInterrogation(st, 1, 0, "Ahm", ["no"]);
    expect(r.outcome).toBe("dungeon");
    expect(r.sacrificed).toBe(0);
  });
});

describe("captura completa (BLCKTHRN 0x060e)", () => {
  it("deposita en (10,7) planta -1 (sótano, g_floor=0xff) loc 0x12, keys=0, a pie", () => {
    const st = stub({
      characters: [char("G"), char("G")],
      keys: 9,
      karma: 50,
      shrineDestroyed: new Array(8).fill(0),
    });
    const r = blackthornCapture(st, ["no", "no", "no", "no"], MANTRAS);
    expect(r.shrine).toBe(0);
    // floor: BLCKTHRN 0x08e7 `mov [g_floor],0xff` = sótano (z=-1 del asset; el
    // mismo 0xff que deja el `dec [g_floor]` de KLIMB TOWN 0x0566 desde planta 0).
    expect(st.position).toMatchObject({ location: 0x12, x: 10, y: 7, floor: -1 });
    expect(st.keys).toBe(0);
    expect(st.transport).toBe("foot");
  });

  it("con los 8 santuarios caídos no interroga, sólo deposita", () => {
    const st = stub({ characters: [char("G"), char("G")], keys: 3, shrineDestroyed: new Array(8).fill(0xff) });
    const r = blackthornCapture(st, [], MANTRAS);
    expect(r.shrine).toBeNull();
    expect(r.interrogation).toBeNull();
    expect(st.partySize).toBe(2); // sin sacrificio
    expect(st.keys).toBe(0);
  });
});

describe("refuge / party-wipe (BLCKTHRN 0x0910)", () => {
  it("despierta en el castillo de LB (0x11,1,10,10), karma a suelo 75, revive, comida", () => {
    const st = stub({
      characters: [char("D"), char("D"), char("D")],
      karma: 20,
      food: 0,
      position: { location: 6, floor: 0, x: 5, y: 5 },
    });
    const r = partyRefuge(st);
    expect(st.karma).toBe(REFUGE_KARMA_FLOOR);
    expect(st.position).toMatchObject({ location: 0x11, floor: 1, x: 10, y: 10 });
    expect(st.time.hour).toBe(6);
    expect(r.revived).toBe(3);
    expect(st.characters.every((c) => c.status !== "D")).toBe(true);
    expect(st.food).toBe(0x3f);
  });

  it("no baja el karma ya alto ni rellena la comida existente", () => {
    const st = stub({ characters: [char("D"), char("D")], karma: 90, food: 50, position: { location: 6, floor: 0, x: 0, y: 0 } });
    partyRefuge(st);
    expect(st.karma).toBe(90);
    expect(st.food).toBe(50);
  });
});

describe("merma de la Falsedad (SHOPPES 0x019a)", () => {
  it("sólo con Falsehood (Shadowlord 0) presente en la ciudad", () => {
    const here = stub({ gold: 100, shadowlordLocs: [6, 3, 7], position: { location: 6, floor: 0, x: 0, y: 0 } });
    expect(postPurchaseGoldDrain(here, 40)).toBe(40);
    expect(here.gold).toBe(60);
    const otherLord = stub({ gold: 100, shadowlordLocs: [2, 6, 7], position: { location: 6, floor: 0, x: 0, y: 0 } });
    expect(postPurchaseGoldDrain(otherLord, 40)).toBe(0);
    expect(shadowlordPresentIndex(otherLord)).toBe(1);
  });
  it("suelo 0 si el oro no alcanza", () => {
    const st = stub({ gold: 30, shadowlordLocs: [6, 3, 7], position: { location: 6, floor: 0, x: 0, y: 0 } });
    postPurchaseGoldDrain(st, 40);
    expect(st.gold).toBe(0);
  });
});

describe("guardias TALK 0xFF (peaje/password)", () => {
  it("password del Palacio (ret 0 correcto, ret 1 escalada)", () => {
    // #277: gate g_time_spell==0x1d (TALK 0x02a4) = Black Badge PUESTA.
    const st = stub({ position: { location: 0x12, floor: 0, x: 0, y: 0 }, gold: 100, characters: [char("G")], timeSpell: TIME_SPELL_BADGE });
    expect(guardDemand(st, BLACKTHORN_PASSWORD, false).ret).toBe(0);
    expect(guardDemand(st, "nope", false).ret).toBe(1);
    // …y SIN la insignia ni el password correcto abre (rama 0x216 del binario).
    const sinBadge = stub({ position: { location: 0x12, floor: 0, x: 0, y: 0 }, gold: 100, characters: [char("G")] });
    expect(guardDemand(sinBadge, BLACKTHORN_PASSWORD, false).ret).toBe(1);
  });
  it("Minoc: pagas al ACEPTAR ('Y') medio oro; rehusar deja el oro intacto", () => {
    const pay = stub({ position: { location: 5, floor: 0, x: 0, y: 0 }, gold: 101, characters: [char("G"), char("G")] });
    const r = guardDemand(pay, "", true);
    expect(r.kind).toBe("charity");
    expect(r.ret).toBe(0);
    expect(pay.gold).toBe(50);
    const refuse = stub({ position: { location: 5, floor: 0, x: 0, y: 0 }, gold: 101, characters: [char("G")] });
    expect(guardDemand(refuse, "", false).ret).toBe(1);
    expect(refuse.gold).toBe(101);
  });
  it("tributo de 10 gp por miembro vivo al ACEPTAR", () => {
    const st = stub({ position: { location: 2, floor: 0, x: 0, y: 0 }, gold: 100, characters: [char("G"), char("G"), char("G")] });
    const r = guardDemand(st, "", true);
    expect(countLiving(st)).toBe(3); // 3 miembros vivos → 3·10 gp
    expect(r.goldTaken).toBe(30);
    expect(st.gold).toBe(70);
    // No puede pagar → ret 1, sin cobro.
    const broke = stub({ position: { location: 2, floor: 0, x: 0, y: 0 }, gold: 20, characters: [char("G"), char("G"), char("G")] });
    const r2 = guardDemand(broke, "", true);
    expect(r2.ret).toBe(1);
    expect(broke.gold).toBe(20);
  });
});
