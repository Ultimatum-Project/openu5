/**
 * Tests de reglas de party contra el estado inicial REAL (initial-state.json,
 * extraído de INIT.GAM): Avatar+Shamino+Iolo en la party (partyStatus 0), el
 * resto de reclutables con 0xFF.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { partyMembers, joinByName, avatarName, MAX_PARTY } from "../src/core/party.js";

function freshState(): GameState {
  const path = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  const init = JSON.parse(readFileSync(path, "utf8")) as ExtractedInitialState;
  return createNewGame(init);
}

describe("partyMembers", () => {
  it("devuelve los 3 miembros iniciales en orden de registro", () => {
    const state = freshState();
    const members = partyMembers(state);
    expect(members.map((c) => c.class)).toEqual(["A", "F", "B"]); // Avatar, Shamino, Iolo
    expect(members).toHaveLength(3);
    expect(members.every((c) => c.partyStatus === 0)).toBe(true);
  });
});

describe("avatarName", () => {
  it("cae a 'Avatar' cuando el record aún no tiene nombre", () => {
    const state = freshState();
    expect(avatarName(state)).toBe("Avatar");
  });

  it("usa el nombre del record de clase A si existe", () => {
    const state = freshState();
    state.characters[0]!.name = "Britannicus";
    expect(avatarName(state)).toBe("Britannicus");
  });
});

describe("joinByName", () => {
  // ── docs/bugs-del-original.md §2.7 (hermano) ──────────────────────────────
  // Las CADENAS y las SALIDAS son las de `join_party` (TALK.OVL:0x080a). El binario
  // sólo tiene TRES salidas, y dos se distinguen por su EFECTO SOBRE EL FLUJO:
  //   · grupo lleno (0x081d) → DS 0x9348 + DS 0x9372 y `ret 0` ⇒ la conversación SIGUE
  //   · sin coincidencia (0x08a4) → DS 0x93A8 y `ret 1`       ⇒ TERMINA
  //   · alistado (0x08c8) → SIN texto propio y `ret 1`        ⇒ TERMINA
  //
  // ★ ANTES estos asertos exigían CUATRO frases que NO EXISTEN en el juego original:
  // «already», «Mariah joins thee!», «Thy party is full.» y «{}? I know of no such
  // person.» — barrido binario sobre los 125 ficheros de original/u5/ultima5/: CERO
  // ocurrencias de las cuatro; la del binario (`no room for me`) sí aparece. El test
  // pinaba texto fabricado.
  //
  // 🔴 MUTANTE: devolver `ended`/outcome "full" como terminante, o volver a
  // concatenar las dos cadenas en una, pone ROJO alguno de estos asertos.
  const PARTY_FULL_1 = '"Thou hast no room for me in thy party! ';
  const PARTY_FULL_2 = "Seek me again if one of thy members doth leave\nthee.";
  const NO_MATCH = "\nSystem Error -\nNo Match!";

  // ★ RE-ADJUDICADA (bug 1, carril talk-celda-paginacion): «ya en la party» NO es la vía
  // no-match del binario. El barrido de join_party (0x086d-0x08a2, ranuras 15..1) no
  // filtra por partyStatus, así que a un miembro alistado LO ENCUENTRA y toma la vía
  // found (0x08c8): `ret 1` SIN texto propio + despawn del NPC del mapa (0x0916/0x091d).
  // La versión anterior de este test fijaba la salida por no-match (DS 0x93A8 «System
  // Error - No Match!») — texto que el binario no imprime jamás en esta vía, y que
  // aflorό en vivo (captura carcel-talk-error.jpeg: Gorn reclutado, celda de Blackthorn).
  // La corrupción del swap del binario (Clase C) sigue SIN calcarse: roster intacto.
  it("ya en la party: sale por 'already' — SIN texto (ni el System Error) y SIN tocar el roster", () => {
    const state = freshState();
    const before = state.partySize;
    const res = joinByName(state, "Iolo");
    expect(res.ok).toBe(false);
    expect(res.outcome).toBe("already");
    expect(res.messages).toEqual([]);
    expect(state.partySize).toBe(before);
  });

  it("une a un reclutable no-en-party (Mariah), sube partySize y NO imprime nada propio", () => {
    const state = freshState();
    expect(partyMembers(state)).toHaveLength(3);
    const res = joinByName(state, "Mariah");
    expect(res.ok).toBe(true);
    expect(res.outcome).toBe("joined");
    // TALK 0x08c8-0x0930: el handler no imprime; el texto lo pone el guion del .TLK.
    expect(res.messages).toEqual([]);
    expect(state.partySize).toBe(4);
    const mariah = state.characters.find((c) => c.name === "Mariah");
    expect(mariah?.partyStatus).toBe(0);
    expect(partyMembers(state).map((c) => c.name)).toContain("Mariah");
  });

  it("es case-insensitive en la búsqueda del nombre", () => {
    const state = freshState();
    const res = joinByName(state, "mArIaH");
    expect(res.ok).toBe(true);
    expect(res.outcome).toBe("joined");
  });

  it("★ grupo lleno: las DOS cadenas del binario, SEPARADAS, y la conversación SIGUE", () => {
    const state = freshState();
    for (const name of ["Mariah", "Geoffrey", "Jaana"]) {
      expect(joinByName(state, name).ok).toBe(true);
    }
    expect(partyMembers(state)).toHaveLength(MAX_PARTY);
    const res = joinByName(state, "Julia");
    expect(res.ok).toBe(false);
    // "full" es la ÚNICA salida que no corta la conversación (0x081d `ret 0`).
    expect(res.outcome).toBe("full");
    // SEPARADAS: son dos claves distintas del corpus de traducción; concatenarlas
    // dejaría el compuesto sin casar el choke t() (trampa del composite-choke).
    expect(res.messages).toEqual([PARTY_FULL_1, PARTY_FULL_2]);
    expect(state.characters.find((c) => c.name === "Julia")?.partyStatus).toBe(255);
  });

  it("devuelve ok:false sin mutar si el nombre no existe", () => {
    const state = freshState();
    const before = state.partySize;
    const res = joinByName(state, "Batlin");
    expect(res.ok).toBe(false);
    expect(state.partySize).toBe(before);
  });
});
