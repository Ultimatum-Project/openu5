/**
 * #129 — GUARDA DE CABECERA «Stay with ship!» de combat_exit_off_edge (SJOG.OVL 0x1bb2).
 *
 * DERIVACIÓN (disasm literal, primera instrucción tras el prólogo):
 *
 *   1bb2: 55            push bp
 *   1bb3: 8bec          mov bp, sp
 *   1bb5: a07c58        mov al, byte ptr [g_transport_tile]   ; DS:0x587C
 *   1bb8: 24f8          and al, 0xf8
 *   1bba: 3c20          cmp al, 0x20
 *   1bbc: 750c          jne 0x1bca                            ; NO fragata → flujo normal
 *   1bbe: b8768e        mov ax, 0x8e76                        ; DS 0x8e76 = file 0x8e86
 *   1bc1: 50            push ax                               ;   b'\nStay with ship!\n'
 *   1bc2: e80b3d        call 0x58d0                           ; print_string
 *   1bc5: 2bc0          sub ax, ax                            ; RETORNA 0 = DENEGADA
 *   1bc7: e98800        jmp 0x1c52
 *
 * DOMINIO EXACTO. `and 0xf8 / cmp 0x20` ⇒ 0x20-0x27 = **fragata y sólo fragata**
 * (0x20-0x23 velas izadas, 0x24-0x27 arriadas). El ESQUIFE NO entra: es 0x28-0x2B,
 * fijado por CMDS.OVL CS:0x0917 `and al,0xfc / cmp al,0x28` (contador de esquifes
 * estibados al desembarcar). Caballo 0x12-0x13, alfombra 0x14-0x15, a pie 0x1C.
 *
 * TURNO. El 0 vuelve intacto a move_combat_actor (SJOG CS:0x1cd6 `call 0x1bb2` →
 * `jmp 0x1d61` = su epílogo), donde 0 = «no se movió» — igual que la rama "Blocked!"
 * (0x1d4a). El rechazo NO consume turno.
 *
 * ORDEN. Está ANTES del gate de salida única (0x1c04): a bordo el original dice
 * "Stay with ship!", nunca "All must use the same exit!".
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
import {
  TILE_FOOT,
  TILE_HORSE,
  TILE_CARPET,
  TILE_SKIFF,
  TILE_FRIGATE_SAILS_UP,
  TILE_FRIGATE_SAILS_DOWN,
} from "../src/core/world/transport.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const campFire = (): CombatMapData => combatMaps[0]!;

function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
/** Combate de CAMPO con la party a bordo de `transportTile` (`undefined` = campo sin fijar). */
function makeCombat(transportTile: number | undefined, roomCombat = false): Combat {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  state.transportTile = transportTile;
  return new Combat({
    map: campFire(),
    entryDirection: "south",
    party: party(state),
    enemies: [{ def: defs()[0]!, count: 1 }],
    seed: 1,
    state,
    defenseValues: data.defenseValues,
    roomCombat,
  });
}
function forceEnemiesGone(combat: Combat): void {
  for (const c of combat.combatants) if (c.kind === "enemy") c.status = "dead";
}
function msgs(ev: { kind: string; text?: string }[]): string[] {
  return ev.filter((e) => e.kind === "message" && e.text).map((e) => e.text!);
}

describe("#129 guarda «Stay with ship!» a la cabeza de playerEscape (SJOG 0x1bb5)", () => {
  // POSITIVOS: los DOS estados de vela de la fragata caen dentro de `and 0xf8 == 0x20`.
  for (const [name, tile] of [
    ["fragata velas IZADAS (0x20)", TILE_FRIGATE_SAILS_UP],
    ["fragata velas ARRIADAS (0x24)", TILE_FRIGATE_SAILS_DOWN],
    ["fragata con rumbo (0x23, base+3)", TILE_FRIGATE_SAILS_UP + 3],
    ["fragata arriada con rumbo (0x27, base+3)", TILE_FRIGATE_SAILS_DOWN + 3],
  ] as const) {
    it(`${name}: la salida por el borde se DENIEGA con "Stay with ship!" y SIN consumir turno`, () => {
      const combat = makeCombat(tile);
      forceEnemiesGone(combat);
      const before = combat.currentUnit!;
      expect(before.kind).toBe("player");

      const ev = combat.playerEscape("west");
      expect(msgs(ev)).toContain("Stay with ship!");
      // No huye: ni "Leave!" (0x1bf4) ni "Escape!" (0x1c20) — el `sub ax,ax` de 0x1bc5
      // corta ANTES de llegar a la rama de salida (0x1be5).
      expect(msgs(ev)).not.toContain("Leave!");
      expect(msgs(ev)).not.toContain("Escape!");
      // Turno intacto: el actor sigue vivo, sigue siendo el actor en curso y NO está "fled".
      expect(before.status).not.toBe("fled");
      expect(combat.currentUnit?.id).toBe(before.id);
    });
  }

  // NEGATIVOS (controles): todo lo que NO es 0x20-0x27 pasa el gate y huye.
  for (const [name, tile] of [
    ["a pie (0x1C)", TILE_FOOT],
    ["a caballo (0x12)", TILE_HORSE],
    ["en alfombra (0x14)", TILE_CARPET],
    ["★ en ESQUIFE (0x28) — FUERA de la máscara 0xf8/0x20", TILE_SKIFF],
    ["esquife con rumbo (0x2B)", TILE_SKIFF + 3],
  ] as const) {
    it(`${name}: la salida por el borde SE PERMITE (sin "Stay with ship!")`, () => {
      const combat = makeCombat(tile);
      forceEnemiesGone(combat);
      const ev = combat.playerEscape("west");
      expect(msgs(ev)).not.toContain("Stay with ship!");
      expect(msgs(ev)).toContain("Leave!"); // post-victoria (0x1bf4 DS 0x8ea6)
    });
  }

  it("sin transportTile en el estado (undefined) el gate NO dispara — el default es a pie (0x1C)", () => {
    const combat = makeCombat(undefined);
    forceEnemiesGone(combat);
    const ev = combat.playerEscape("west");
    expect(msgs(ev)).not.toContain("Stay with ship!");
    expect(msgs(ev)).toContain("Leave!");
  });

  it("PRECEDENCIA: la guarda va ANTES del gate de salida única (0x1bb5 < 0x1c04)", () => {
    // Sala de mazmorra + fragata: aunque se cumplieran las DOS condiciones, el original
    // corta en 0x1bbc y nunca alcanza el `test [g_unk_58a1],0x80` de 0x1c04.
    const combat = makeCombat(TILE_FRIGATE_SAILS_UP, true);
    forceEnemiesGone(combat);
    const a = combat.playerEscape("west"); // ni siquiera llega a fijar escapeBorder
    expect(msgs(a)).toContain("Stay with ship!");
    const b = combat.playerEscape("east"); // borde DISTINTO
    expect(msgs(b)).toContain("Stay with ship!");
    expect(msgs(b)).not.toContain("All must use the same exit!");
  });
});
