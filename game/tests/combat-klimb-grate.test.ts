/**
 * FIDELIDAD — el (K)limb de combate acepta TRES tiles, y el GRATE va GATEADO POR SALA.
 *
 * DERIVACIÓN (disasm, `re/notes/salidas-11-errata-grate.md`): `cmd_klimb_combat`,
 * SJOG.OVL CS 0x1dd5-0x1e19.
 *
 *   1dd5  cmp word [bp-2], 0xc8         ; LadderUp
 *   1de9  mov ax, 5                     ; código de salida 5 = UP
 *   1ded  call 0x1bb2                   ; ← el MISMO desagüe que la salida por borde
 *   1df4  cmp word [bp-2], 0x86         ; ★ GRATE
 *   1df9  jne 0x1e02                    ;   no → probar 0xc9
 *   1dfb  test byte [g_unk_58a1], 0x80  ; ★★ ¿COMBATE DE SALA? (el bit de DUNGEON.OVL 0x00bf)
 *   1e00  jne 0x1e09                    ;   sí → SALE
 *                                       ;   si NO es sala cae a 0x1e02, falla el cmp 0xc9
 *                                       ;   y termina en el getdir de encaramarse a 0x4c
 *   1e02  cmp word [bp-2], 0xc9         ; LadderDown
 *   1e16  mov ax, 6                     ; código de salida 6 = DOWN
 *
 * Ecos VERIFICADOS en el fichero (no citados de memoria): DATA.OVL con la convención
 * DS→fichero `+0x10` que el propio port documenta — DS 0x8eec = fileoff 0x8efc = `"Up!\n"`
 * y DS 0x8ef2 = fileoff 0x8f02 = `"Down!\n"`; con el prefijo «Klimb-» que el binario
 * imprime siempre, los ecos son `Klimb-Up!` / `Klimb-Down!`.
 *
 * QUÉ FALLABA: `playerKlimbEscape` se derivó de `re/notes/town-klimb.md` —que lista los
 * TRES tiles, línea 32— e implementó DOS. El `0x86` no estaba, y con él se quedaban
 * emparedadas 5 salas que el original resuelve andando un paso (Destard r0/r1,
 * Hythloth r6, Doom r2/r10).
 *
 * ★ EL TEST QUE IMPORTA ES EL NEGATIVO. Aceptar `0x86` a secas pasaría en verde con un
 * atajo que ignora el gate, y el gate es justo lo que el binario se molestó en escribir.
 * Un mutante que borre la condición de sala DEBE matar «el GRATE fuera de sala NO saca».
 * Y los dos controles de escalera prueban lo contrario: `0xC8`/`0xC9` NO están gateados,
 * así que una implementación que gatee TODO el klimb por sala también sale roja.
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
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);

const GRATE = 0x86;
const LADDER_UP = 0xc8;
const LADDER_DOWN = 0xc9;

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}

/**
 * Combate con `tile` sembrado BAJO EL ACTOR QUE TIENE EL TURNO, no bajo `playerStarts[0]`.
 *
 * ⚠ La primera versión sembraba en la celda de spawn sur del primer miembro y los DOS
 * controles de escalera salieron rojos con `Klimb-what?`: quien abre turno lo decide la
 * INICIATIVA, no el orden del party, así que el tile caía bajo otro. El instrumento estaba
 * mal y lo cazaron los controles — que es para lo que están. Sembrar contra `mapTiles`
 * (la rejilla VIVA que `tileAt` lee) elimina esa suposición entera.
 */
function makeCombat(tileUnderPlayer: number, roomCombat: boolean): { combat: Combat; cur: NonNullable<Combat["currentUnit"]> } {
  const state = freshState();
  const combat = new Combat({
    map: combatMaps[0]!,
    entryDirection: "south",
    party: party(state),
    enemies: [{ def: defs()[0]!, count: 1 }],
    seed: 1,
    state,
    defenseValues: data.defenseValues,
    roomCombat,
  });
  const cur = combat.currentUnit!;
  combat.mapTiles[cur.y]![cur.x] = tileUnderPlayer;
  return { combat, cur };
}
function msgs(ev: { kind: string; text?: string }[]): string[] {
  return ev.filter((e) => e.kind === "message" && e.text).map((e) => e.text!);
}

describe("(K)limb de combate — los TRES tiles y el gate de SALA del Grate", () => {
  it("★ POSITIVO — GRATE en combate de SALA: sale, delta +1 (abajo), eco Klimb-Down!", () => {
    const { combat, cur } = makeCombat(GRATE, true);
    expect(cur.kind).toBe("player");
    const ev = combat.playerKlimbEscape();
    expect(msgs(ev)).toContain("Klimb-Down!");
    expect(msgs(ev)).toContain("Escape!");
    expect(cur.status).toBe("fled");
    expect(combat.escapeFloorDelta).toBe(1); // código 6 = Down (SJOG 0x1e16)
  });

  it("★★ NEGATIVO — GRATE FUERA de sala: NO sale, Klimb-what?, sin turno ni delta", () => {
    // Éste es el que mide el gate. Si alguien acepta 0x86 sin mirar `roomCombat`,
    // este test cae — que es exactamente lo que debe pasar.
    const { combat, cur } = makeCombat(GRATE, false);
    expect(cur.kind).toBe("player");
    const ev = combat.playerKlimbEscape();
    expect(msgs(ev)).toContain("Klimb-what?");
    expect(msgs(ev)).not.toContain("Klimb-Down!");
    expect(cur.status).not.toBe("fled");
    expect(combat.escapeFloorDelta).toBeNull();
    // Y el turno NO se consume: sigue tocándole al mismo (el binario no llama a advanceTurn
    // en esta rama, igual que el Klimb de mazmorra sin escalera).
    expect(combat.currentUnit?.id).toBe(cur.id);
  });

  it("CONTROL — LadderDown (0xC9) NO está gateada: sale también FUERA de sala", () => {
    // Guarda contra el over-fix: gatear TODO el klimb por `roomCombat` sería tan infiel
    // como no gatear nada. El binario sólo condiciona el Grate.
    for (const roomCombat of [true, false]) {
      const { combat, cur } = makeCombat(LADDER_DOWN, roomCombat);
      const ev = combat.playerKlimbEscape();
      expect(msgs(ev), `roomCombat=${roomCombat}`).toContain("Klimb-Down!");
      expect(cur.status, `roomCombat=${roomCombat}`).toBe("fled");
      expect(combat.escapeFloorDelta, `roomCombat=${roomCombat}`).toBe(1);
    }
  });

  it("CONTROL — LadderUp (0xC8) NO está gateada y sube: delta −1 en ambos contextos", () => {
    for (const roomCombat of [true, false]) {
      const { combat, cur } = makeCombat(LADDER_UP, roomCombat);
      const ev = combat.playerKlimbEscape();
      expect(msgs(ev), `roomCombat=${roomCombat}`).toContain("Klimb-Up!");
      expect(cur.status, `roomCombat=${roomCombat}`).toBe("fled");
      expect(combat.escapeFloorDelta, `roomCombat=${roomCombat}`).toBe(-1); // código 5 = Up
    }
  });

  it("CONTROL NEGATIVO del instrumento — un tile CUALQUIERA no saca en ningún contexto", () => {
    // Sin esto, los tests de arriba pasarían con una implementación que sacara SIEMPRE.
    for (const roomCombat of [true, false]) {
      const { combat, cur } = makeCombat(0x05 /* Grass */, roomCombat);
      const ev = combat.playerKlimbEscape();
      expect(msgs(ev), `roomCombat=${roomCombat}`).toContain("Klimb-what?");
      expect(cur.status, `roomCombat=${roomCombat}`).not.toBe("fled");
    }
  });
});
