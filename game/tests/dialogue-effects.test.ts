/**
 * Tests del aplicador de efectos de conversación (reglas exactas de TALK.OVL,
 * re/notes/npc.md §9): karma cap 99 / floor 0, gold-demand con chequeo de fondos,
 * JoinParty máx 6, callGuards.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { applyDialogueEffect } from "../src/core/dialogue/effects.js";
import { partyMembers } from "../src/core/party.js";

function freshState(): GameState {
  const path = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  const init = JSON.parse(readFileSync(path, "utf8")) as ExtractedInitialState;
  return createNewGame(init);
}

describe("applyDialogueEffect — karma (opcodes 0x89/0x8A)", () => {
  it("KarmaPlusOne desde 99 se mantiene en 99 (cap kernel 0x7F70)", () => {
    const s = freshState();
    s.karma = 99;
    applyDialogueEffect(s, { kind: "karma", delta: 1 }, "");
    expect(s.karma).toBe(99);
  });

  it("KarmaMinusOne desde 0 se mantiene en 0 (floor)", () => {
    const s = freshState();
    s.karma = 0;
    applyDialogueEffect(s, { kind: "karma", delta: -1 }, "");
    expect(s.karma).toBe(0);
  });

  it("±1 en el rango medio suma/resta uno", () => {
    const s = freshState();
    s.karma = 50;
    applyDialogueEffect(s, { kind: "karma", delta: 1 }, "");
    expect(s.karma).toBe(51);
    applyDialogueEffect(s, { kind: "karma", delta: -1 }, "");
    expect(s.karma).toBe(50);
  });
});

describe("applyDialogueEffect — gold-demand (TALK.OVL:0x05B5)", () => {
  it("con fondos suficientes cobra la cantidad exacta", () => {
    const s = freshState();
    s.gold = 100;
    const r = applyDialogueEffect(s, { kind: "gold", amount: 30 }, "");
    expect(s.gold).toBe(70);
    expect(r.messages).toEqual([]);
  });

  it("sin fondos NO cobra y responde '\"Thou hast not enough gold!\"'", () => {
    const s = freshState();
    s.gold = 10;
    const r = applyDialogueEffect(s, { kind: "gold", amount: 30 }, "");
    expect(s.gold).toBe(10);
    // String EXACTA de la rama sin-oro (TALK 0x0652: char 0x22 + DS 0x9328 → DATA.OVL
    // fileoff 0x9338 'Thou hast not enough gold!' + char 0x22; el «Thou hast not
    // enough!» anterior era FABRICADO — fix auditoría str-talk-not-enough-gold).
    expect(r.messages).toEqual(['"Thou hast not enough gold!"']);
  });

  it("cantidad igual a los fondos cobra y deja 0", () => {
    const s = freshState();
    s.gold = 30;
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "");
    expect(s.gold).toBe(0);
  });
});

describe("applyDialogueEffect — JoinParty (TALK.OVL:0x080A, máx 6)", () => {
  it("con hueco, un reclutable se une (ended=true) y sube el tamaño", () => {
    const s = freshState();
    // Un reclutable descansando (partyStatus 0xFF) que podamos unir por nombre.
    const recruit = s.characters.find((c) => c.partyStatus !== 0);
    expect(recruit).toBeDefined();
    recruit!.partyStatus = 0xff;
    const before = partyMembers(s).length;
    const r = applyDialogueEffect(s, { kind: "joinParty" }, recruit!.name);
    expect(r.ended).toBe(true);
    expect(partyMembers(s).length).toBe(before + 1);
  });

  it("con la party llena (6) rechaza y no se une", () => {
    const s = freshState();
    // Rellenar hasta 6 miembros activos.
    let i = 0;
    for (const c of s.characters) {
      if (partyMembers(s).length >= 6) break;
      if (c.partyStatus !== 0) {
        c.partyStatus = 0;
        i++;
      }
    }
    expect(partyMembers(s).length).toBe(6);
    const outsider = s.characters.find((c) => c.partyStatus !== 0);
    const r = applyDialogueEffect(s, { kind: "joinParty" }, outsider?.name ?? "Nadie");
    expect(r.ended).toBe(false);
    expect(partyMembers(s).length).toBe(6);
    expect(i).toBeGreaterThanOrEqual(0);
  });
});

describe("applyDialogueEffect — giveItem (TALK.OVL grant_item 0x0682)", () => {
  const give = (s: GameState, code: number) => applyDialogueEffect(s, { kind: "giveItem", item: code }, "");

  it("A (0x41) → +1 comida (word, cap 9999); sin mensaje", () => {
    const s = freshState();
    s.food = 40;
    const r = give(s, 0x41);
    expect(s.food).toBe(41);
    expect(r.messages).toEqual([]); // grant_item no imprime; la prosa va en el TLK
  });

  it("C (0x43) → +1 llave; D/E → +1 gema/antorcha (byte, cap 99)", () => {
    const s = freshState();
    s.keys = 1; s.gems = 2; s.torches = 3;
    give(s, 0x43); give(s, 0x44); give(s, 0x45);
    expect([s.keys, s.gems, s.torches]).toEqual([2, 3, 4]);
  });

  it("K (0x4b) → +1 skull key", () => {
    const s = freshState();
    s.skullKeys = 0;
    give(s, 0x4b);
    expect(s.skullKeys).toBe(1);
  });

  it("H/I/J → flags sextante/catalejo/insignia (0xFF)", () => {
    const s = freshState();
    s.specialItems.sextant = false;
    s.specialItems.spyglass = false;
    s.specialItems.blackBadge = false;
    give(s, 0x48); give(s, 0x49); give(s, 0x4a);
    expect(s.specialItems.sextant).toBe(true);
    expect(s.specialItems.spyglass).toBe(true);
    expect(s.specialItems.blackBadge).toBe(true);
  });

  it("code < 0x40 → +1 al slot de equipo (cap 99)", () => {
    const s = freshState();
    s.equipmentQuantities[8] = 0;
    s.equipmentQuantities[28] = 5;
    give(s, 8); give(s, 28); // Thrud (data=8/28)
    expect(s.equipmentQuantities[8]).toBe(1);
    expect(s.equipmentQuantities[28]).toBe(6);
  });

  it("F (garfio, 0x46) → state.grapple = true (Lord Michael, Empath Abbey)", () => {
    const s = freshState();
    s.grapple = false;
    give(s, 0x46);
    expect(s.grapple).toBe(true);
  });

  it("caps: comida satura en 9999, llaves en 99", () => {
    const s = freshState();
    s.food = 9999; s.keys = 99;
    give(s, 0x41); give(s, 0x43);
    expect(s.food).toBe(9999);
    expect(s.keys).toBe(99);
  });

  it("código fuera de rango (>K) es no-op", () => {
    const s = freshState();
    const before = JSON.stringify({ f: s.food, k: s.keys, g: s.gems });
    give(s, 0x4c); // 'L' — más allá de la tabla
    expect(JSON.stringify({ f: s.food, k: s.keys, g: s.gems })).toBe(before);
  });
});

describe("applyDialogueEffect — callGuards / end", () => {
  it("callGuards es SILENCIOSO, no termina, y SEÑALA la alarma (TALK 0x0ff8 → TOWN 0x0958; §9.bis refutó el «solo flag»)", () => {
    const s = freshState();
    const r = applyDialogueEffect(s, { kind: "callGuards" }, "");
    expect(r.ended).toBe(false); // 0x0ffb jmp 0xf5e: la charla sigue
    expect(r.messages.length).toBe(0); // el «guards have been called» era QoL fabricado, retirado
    expect(r.alarm).toBe(true); // town_alarm_all_npcs — materializa Game.talkCallGuards
  });

  it("end marca ended", () => {
    const s = freshState();
    expect(applyDialogueEffect(s, { kind: "end" }, "").ended).toBe(true);
  });
});

/**
 * D10 — LIMOSNA AL MENDIGO (TALK.OVL 0x0603-0x064e, la hermana de `05f7: jg 0x652`).
 * Tras cobrar, el karma pasa por TRES guardas encadenadas:
 *   0619 `and al,0xfc / cmp al,0x6c`  → sprite de MENDIGO (0x6c..0x6f)
 *   061d `cmp [g_turn_count],0x64 / jb` → COOLDOWN de 100 turnos  ← la seña la omitía
 *   0624 resetea el contador; 0635 karma += 1 (techo 99);
 *   0638 `cmp [g_gold],0` → 064b karma += 2 MÁS si el oro quedó exactamente a 0.
 */
describe("D10 — karma de la limosna al mendigo (TALK 0x0603-0x064e)", () => {
  const BEGGAR = 0x6c;

  it("CANDADO: el literal del test es el sprite que compara 0x0619", () => {
    expect(BEGGAR).toBe(0x6c);
  });

  it("mendigo + cooldown cumplido: karma +1 y el contador se REINICIA (0x0624)", () => {
    const s = freshState();
    s.gold = 100;
    s.karma = 50;
    s.turnsSinceStart = 150; // ≥ 0x64
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "", BEGGAR);
    expect(s.karma).toBe(51);
    expect(s.turnsSinceStart).toBe(0);
    expect(s.gold).toBe(70); // el cobro es previo y no cambia
  });

  it("★ el oro que queda EXACTAMENTE a 0 da +2 MÁS (0x0638/0x064b): 50 → 53", () => {
    const s = freshState();
    s.gold = 30;
    s.karma = 50;
    s.turnsSinceStart = 150;
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "", BEGGAR);
    expect(s.gold).toBe(0);
    expect(s.karma).toBe(53); // +1 (0x0635) +2 (0x064b)
  });

  it("★ CONDICIÓN SEPARADA — COOLDOWN: mismo mendigo con turnsSinceStart < 100 ⇒ SIN karma", () => {
    // La guarda que la seña heredada se dejaba. Sin ella la limosna se farmea.
    const s = freshState();
    s.gold = 100;
    s.karma = 50;
    s.turnsSinceStart = 99; // justo por debajo de 0x64
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "", BEGGAR);
    expect(s.karma).toBe(50);
    expect(s.turnsSinceStart).toBe(99); // tampoco se reinicia: 0x0624 va DESPUÉS del jb
  });

  it("★ CONDICIÓN SEPARADA — SPRITE: un NPC que no es mendigo NO da karma aunque cobre", () => {
    const s = freshState();
    s.gold = 100;
    s.karma = 50;
    s.turnsSinceStart = 150;
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "", 0x70); // 0x70 & 0xfc ≠ 0x6c
    expect(s.karma).toBe(50);
    expect(s.gold).toBe(70); // pero el cobro SÍ ocurre (0x05fc va antes del gate)
  });

  it("CONTROL: sin fondos no cobra NI da karma (la rama 0x652 no llega al bloque)", () => {
    const s = freshState();
    s.gold = 10;
    s.karma = 50;
    s.turnsSinceStart = 150;
    applyDialogueEffect(s, { kind: "gold", amount: 30 }, "", BEGGAR);
    expect(s.gold).toBe(10);
    expect(s.karma).toBe(50);
  });
});

// ── docs/bugs-del-original.md §2.7 (hermano): las TRES salidas de join_party ──
// TALK.OVL:0x080a. Lo que estos asertos fijan NO es el texto sino EL EFECTO SOBRE EL
// FLUJO, que es lo que el clon no distinguía: el binario devuelve 0 con el grupo lleno
// (0x081d) ⇒ LA CONVERSACIÓN SIGUE, y devuelve 1 en las otras dos ⇒ TERMINA.
//
// 🔴 MUTANTE, con la medición exacta: volver a `ended: result.ok` en effects.ts pone
// ROJO **el caso «sin coincidencia»** (1 failed | 26 passed, 2026-08-06). ⚠ Y NO pone
// rojo el de «grupo lleno», aunque el intuitivo sea ése: con `ended: result.ok` el lleno
// da ok=false ⇒ ended=false, que es CASUALMENTE lo correcto. Escrito así porque la
// primera versión de este comentario decía «pone rojo el caso lleno» y era falso — un
// mutante acredita al test que SÍ se pone rojo, no al que uno esperaba.
describe("applyDialogueEffect — joinParty: las salidas y SU efecto sobre el flujo (3 del binario + already, bug 1)", () => {
  it("★ grupo lleno: emite las DOS cadenas SEPARADAS y NO termina la conversación", () => {
    const s = freshState();
    for (const n of ["Mariah", "Geoffrey", "Jaana"]) {
      applyDialogueEffect(s, { kind: "joinParty" }, n);
    }
    expect(partyMembers(s)).toHaveLength(6);
    const r = applyDialogueEffect(s, { kind: "joinParty" }, "Julia");
    expect(r.ended).toBe(false); // 0x081d `ret 0` — la única salida que no corta
    expect(r.messages).toEqual([
      '"Thou hast no room for me in thy party! ', // DS 0x9348
      "Seek me again if one of thy members doth leave\nthee.", // DS 0x9372
    ]);
  });

  it("sin coincidencia en el roster: DS 0x93A8, TERMINA y SIN despawn", () => {
    const s = freshState();
    const r = applyDialogueEffect(s, { kind: "joinParty" }, "Batlin");
    expect(r.ended).toBe(true); // 0x08a4 `ret 1`
    expect(r.messages).toEqual(["\nSystem Error -\nNo Match!"]);
    // La vía no-match salta a 0x0933 SIN pasar por 0x0916/0x091d: el NPC del mapa queda.
    expect(r.despawnNpc ?? false).toBe(false);
  });

  it("alistado: TERMINA, el handler NO imprime nada propio y SEÑALA el despawn", () => {
    const s = freshState();
    const r = applyDialogueEffect(s, { kind: "joinParty" }, "Mariah");
    expect(r.ended).toBe(true); // 0x08c8 `ret 1`
    expect(r.messages).toEqual([]);
    expect(partyMembers(s).map((c) => c.name)).toContain("Mariah");
    // TALK 0x0916 npc_dead_bit_set + 0x091d npc_clear_slot: así desaparece del pueblo
    // el compañero reclutado (bug 1 talk-celda-paginacion; lo materializa talk-console).
    expect(r.despawnNpc).toBe(true);
  });

  // Bug 1 (talk-celda-paginacion), la vía de la CAPTURA carcel-talk-error.jpeg: el NPC
  // hablado YA está en la party (el port no lo despawneó al reclutarlo — Gorn seguía en
  // su celda de Blackthorn). En el binario esta vía cae en found (0x08c8): silencio,
  // `ret 1` y despawn — NUNCA el DS 0x93A8. El aserto NIEGA el error (nada de «System
  // Error») Y AFIRMA el rasgo (termina + despawn), con el roster intacto (la corrupción
  // del swap es Clase C y no se calca).
  it("★ ya en la party (Gorn re-hablado): TERMINA en silencio, SEÑALA despawn y NO imprime System Error", () => {
    const s = freshState();
    const before = partyMembers(s).map((c) => c.name);
    const r = applyDialogueEffect(s, { kind: "joinParty" }, "Iolo");
    expect(r.ended).toBe(true);
    expect(r.messages).toEqual([]); // ni DS 0x93A8 ni texto inventado
    expect(r.despawnNpc).toBe(true); // 0x0916/0x091d corren también en la vía found
    expect(partyMembers(s).map((c) => c.name)).toEqual(before); // roster intacto
  });
});
