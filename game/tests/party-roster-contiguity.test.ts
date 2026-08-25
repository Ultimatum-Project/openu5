/**
 * AUD-A3 (#124) — CONTIGÜIDAD FÍSICA del roster.
 *
 * El roster son 16 records de 32 B (`saveNative`: CHAR_RECORD_COUNT=16,
 * CHAR_RECORD_SIZE=32; base DS 0x55a8). El binario mantiene el invariante «los
 * `g_party_size` primeros slots SON el party» MOVIENDO LOS RECORDS. Los bucles que
 * recorren el party iteran slots 0..N-1 y dependen de eso — `slice(0, partySize)`
 * del port ES fiel; lo que estaba roto era el invariante que asume.
 *
 * Los tres movimientos, con sus cuerpos leídos ENTEROS (cada `repne movsw` lleva
 * `cx=0x10` = 16 words = los 32 B del record COMPLETO, equipo +0x19..+0x1E incluido):
 *
 *  · (J)oin — TALK.OVL 0x08c8-0x0912: SWAP a tres bandas con el slot `party_size`.
 *      08cf record[idx].partyStatus = 0 ; 08d6 TEMP=record[idx] ;
 *      08f7 record[idx]=record[party_size] ; 0908 record[party_size]=TEMP ; 0912 inc
 *  · (L)eave — SHOPPES3 0x03dd-0x0472: COMPACTA el roster ENTERO y manda al
 *      hospedado al slot 15 (0x0465 escribe en 0x5788 = 0x55a8 + 15·32); antes
 *      re-indexa `g_active_char` (0x03dd-0x0400) y pone monthsAtInn=0 (+0x17).
 *  · (P)ickup — SHOPPES3 0x07be-0x083a: la INVERSA; desplaza ARRIBA y re-inserta en
 *      el slot `party_size` (0x0829), luego partyStatus=0 (0x084c).
 *
 * REPRO de la tarjeta: dejar a un compañero en la posada y comprobar que el prefijo
 * `slice(0, partySize)` —lo que consumen catarata (OUTSUBS 0x04b6), aparición
 * (0x07fb), hazards y el resto— contiene SÓLO a quien VIAJA.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { rosterJoinSwap, rosterLeaveCompact, rosterPickupInsert } from "../src/core/party.js";
import { innLeave, innPickup } from "../src/core/shops/shops.js";
import { createNewGame } from "../src/core/state.js";
import {
  exportNativeSave,
  importNativeSave,
  SAVED_GAM_SIZE,
  type SaveSidecar,
} from "../src/core/saveNative.js";
import { canonicalInit } from "./helpers/canonical-init.js";

/** Base de los 16 records de personaje en el .GAM (saveNative CHAR_RECORDS_OFFSET). */
const CHAR_BASE = 0x02;

/** Nombre (9 B, terminado en 0) del record del slot `i` leído del .GAM crudo. */
function nameAtSlot(gam: Uint8Array, i: number): string {
  const b = gam.slice(CHAR_BASE + i * 32, CHAR_BASE + i * 32 + 9);
  const end = b.indexOf(0);
  return new TextDecoder().decode(end === -1 ? b : b.slice(0, end));
}

function makeChar(name: string, over: Partial<CharacterState> = {}): CharacterState {
  return {
    name, gender: 0x0b, class: name === "Avatar" ? "A" : "F", status: "G",
    strength: 20, dexterity: 20, intelligence: 15, currentMp: 10, currentHp: 50,
    maxHp: 60, exp: 0, level: 2, monthsAtInn: 0, helmet: 0xff, armor: 0xff,
    weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff, partyStatus: 0xff,
    ...over,
  } as CharacterState;
}

/** Roster de 16 slots: Avatar + Shamino + Iolo viajando, resto sin unir. */
function makeState(): GameState {
  const names = ["Avatar", "Shamino", "Iolo"];
  const characters = Array.from({ length: 16 }, (_, i) =>
    makeChar(names[i] ?? `Extra${i}`, { partyStatus: i < 3 ? 0 : 0xff }),
  );
  return {
    characters,
    partySize: 3,
    activeCharacter: 0,
    gold: 1000,
    position: { location: 2, floor: 0, x: 3, y: 3 },
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
  } as unknown as GameState;
}

/** Lo que consumen catarata/aparición/hazards: el PREFIJO de `partySize` slots. */
function travellingPrefix(s: GameState): string[] {
  return s.characters.slice(0, s.partySize).map((c) => c.name);
}

describe("AUD-A3 — el roster se compacta FÍSICAMENTE (SHOPPES3 / TALK)", () => {
  it("REPRO: dejar a Shamino deja el prefijo del party SIN él (y con quien viaja)", () => {
    const s = makeState();
    expect(travellingPrefix(s)).toEqual(["Avatar", "Shamino", "Iolo"]);
    const shamino = s.characters[1]!;

    const r = innLeave(s, 1, 2); // (L)eave Shamino en la posada de Britain
    expect(r.ok).toBe(true);
    expect(s.partySize).toBe(2);
    // ★ El prefijo que golpean catarata/aparición ya NO contiene al hospedado.
    expect(travellingPrefix(s)).toEqual(["Avatar", "Iolo"]);
    expect(travellingPrefix(s)).not.toContain("Shamino");
    // …y Shamino está marcado en la posada Y movido al ÚLTIMO slot (0x0465).
    expect(shamino.partyStatus).toBe(2);
    expect(s.characters.indexOf(shamino)).toBe(15);
    expect(s.characters).toHaveLength(16);
  });

  it("el (L)eave RE-INDEXA el personaje activo (0x03dd-0x0400)", () => {
    // idx == activo → 0xFF
    const a = makeState();
    a.activeCharacter = 1;
    rosterLeaveCompact(a, 1, 2);
    expect(a.activeCharacter).toBe(0xff);

    // idx < activo → dec
    const b = makeState();
    b.activeCharacter = 2;
    rosterLeaveCompact(b, 1, 2);
    expect(b.activeCharacter).toBe(1);

    // idx > activo → intacto
    const c = makeState();
    c.activeCharacter = 0;
    rosterLeaveCompact(c, 2, 2);
    expect(c.activeCharacter).toBe(0);

    // activo == 0xFF → intacto (el `cmp al,0xff / je` de 0x03f8)
    const d = makeState();
    d.activeCharacter = 0xff;
    rosterLeaveCompact(d, 1, 2);
    expect(d.activeCharacter).toBe(0xff);
  });

  it("el (P)ickup restaura la contigüidad insertando en el slot `partySize`", () => {
    const s = makeState();
    const shamino = s.characters[1]!;
    innLeave(s, 1, 2);
    expect(s.characters.indexOf(shamino)).toBe(15);

    innPickup(s, 0, 15, 2);
    expect(s.partySize).toBe(3);
    expect(shamino.partyStatus).toBe(0);
    // Vuelve al slot que ocupaba `partySize` antes del pickup: el 2, no el 1.
    expect(s.characters.indexOf(shamino)).toBe(2);
    expect(travellingPrefix(s)).toEqual(["Avatar", "Iolo", "Shamino"]);
    expect(s.characters).toHaveLength(16);
  });

  it("★ ASIMETRÍA FIEL: el (P)ickup NO re-indexa el activo (no hay bloque 0x03dd)", () => {
    const s = makeState();
    innLeave(s, 1, 2); // activo 0, idx 1 → activo intacto
    s.activeCharacter = 1; // el jugador selecciona a Iolo (ahora en el slot 1)
    innPickup(s, 0, 15, 2); // inserta en el slot 2, desplazando… y NO toca el activo
    expect(s.activeCharacter).toBe(1); // bug-for-bug: el binario tampoco lo ajusta
  });

  it("(J)oin hace SWAP con el slot `partySize`, no un append (TALK 0x08c8)", () => {
    const s = makeState();
    s.partySize = 1; // sólo el Avatar viaja
    s.characters[1]!.partyStatus = 0xff;
    s.characters[2]!.partyStatus = 0xff;
    const iolo = s.characters[2]!;

    rosterJoinSwap(s, 2); // se une Iolo, que está en el slot 2
    expect(s.partySize).toBe(2);
    expect(iolo.partyStatus).toBe(0);
    // Iolo va al slot 1 (= partySize viejo) y el que estaba allí baja al 2.
    expect(s.characters.indexOf(iolo)).toBe(1);
    expect(s.characters[2]!.name).toBe("Shamino");
    expect(travellingPrefix(s)).toEqual(["Avatar", "Iolo"]);
  });

  it("con el roster YA contiguo el swap del (J)oin es un no-op sobre sí mismo", () => {
    // Es la razón por la que el defecto podía pasar desapercibido: idx == partySize.
    const s = makeState();
    s.partySize = 2;
    const iolo = s.characters[2]!;
    iolo.partyStatus = 0xff;
    rosterJoinSwap(s, 2);
    expect(s.characters.indexOf(iolo)).toBe(2);
    expect(travellingPrefix(s)).toEqual(["Avatar", "Shamino", "Iolo"]);
  });

  it("CARÉO DEL SAVE: la compactación viaja al .GAM y el roundtrip es byte-idéntico", () => {
    // El layout del party ES el save: 16 records × 32 B desde 0x02 (CHAR_RECORDS_OFFSET).
    // Mover records cambia bytes del .GAM — efecto PRETENDIDO. Lo que hay que sellar es
    // que el par exportar/importar sigue siendo fiel DESPUÉS de la compactación.
    const s = createNewGame(canonicalInit());
    s.characters[1]!.name = "Shamino";
    s.characters[1]!.partyStatus = 0;
    s.characters[2]!.name = "Iolo";
    s.characters[2]!.partyStatus = 0;
    s.partySize = 3;

    innLeave(s, 1, 2); // deja a Shamino → compacta y lo manda al slot 15

    const { gam, sidecar } = exportNativeSave(s, new Uint8Array(SAVED_GAM_SIZE));
    // El .GAM refleja la compactación: Iolo subió al slot 1, Shamino está en el 15.
    expect(nameAtSlot(gam, 1)).toBe("Iolo");
    expect(nameAtSlot(gam, 15)).toBe("Shamino");
    expect(gam[CHAR_BASE + 15 * 32 + 0x1f]).toBe(2); // partyStatus = location (0x040f)

    // Roundtrip: re-importar y re-exportar da los MISMOS bytes de la ventana del party.
    // El sidecar viaja como JSON en el save real → simula el ida y vuelta.
    const back = importNativeSave(gam, JSON.parse(JSON.stringify(sidecar)) as SaveSidecar);
    expect(back.characters.map((c) => c.name)[1]).toBe("Iolo");
    expect(back.characters.map((c) => c.name)[15]).toBe("Shamino");
    const again = exportNativeSave(back, gam.slice()).gam;
    const partyWindow = (d: Uint8Array): Uint8Array => d.slice(CHAR_BASE, CHAR_BASE + 16 * 32);
    expect(partyWindow(again)).toEqual(partyWindow(gam));
  });

  it("el EQUIPO viaja con el personaje (va dentro del record de 32 B, +0x19..+0x1E)", () => {
    const s = makeState();
    const shamino = s.characters[1]!;
    shamino.weapon = 0x2a;
    shamino.armor = 0x11;
    innLeave(s, 1, 2);
    const moved = s.characters[15]!;
    expect(moved.name).toBe("Shamino");
    expect(moved.weapon).toBe(0x2a);
    expect(moved.armor).toBe(0x11);
  });
});
