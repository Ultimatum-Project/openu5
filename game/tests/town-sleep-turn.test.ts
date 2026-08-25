/**
 * #185 — «Zzzzzz...»: con la party ENTERA DORMIDA el pueblo NO lee tecla (TOWN 0x1436-0x1452).
 *
 * Mecánica AUSENTE encontrada de paso por #181 (`defectos-d3d6d7-acta.md` §5.3) y no
 * arreglada entonces. La CABECERA del bucle de pueblo tiene una guarda sobre
 * `party_conscious_state` que ninguna seña mencionaba, **hermana** de la del CIERRE que
 * arregló D7 (`92ce4fd8`) y que NO es la misma:
 *
 * ```
 * 1431: mov word ptr [bp - 0xa], 1        ← ★ bandera «corre el cierre», puesta ANTES
 * 1436: call 0xffffb82c → CS 0x39fc party_conscious_state → [bp-8]
 * 143c: cmp ax, 1
 * 143f: jne 0x1456
 *         1441: push 0xa / 1445: call → putchar('\n')
 *         1448: call → draw_box_edge_left
 *         144b: mov ax, 0x288d / 144f: call → print_string      ← «Zzzzzz...\n»
 *         1452: jmp 0x15a6                                      ← ★ SIN leer tecla
 * 1456: cmp word ptr [bp - 8], -1 / 145a: jne 0x1468
 *         145c: call → BLCKTHRN.OVL:0x910 party_refuge          ← YA portado (checkRefuge)
 *         145f: mov word ptr [bp - 0xa], 0                      ← ★ el refuge APAGA la bandera
 *         1464: jmp 0x15a6
 * 1468: … (lee comando normal)
 * ```
 *
 * `party_conscious_state` (CS 0x39fc, cuerpo leído en #181): **0** si hay algún `'G'`/`'P'`,
 * **1** si no hay ninguno pero sí algún `'S'` dormido, **−1** si no hay ni lo uno ni lo otro.
 *
 * ★★ POR QUÉ EL CIERRE SÍ CORRE AQUÍ, con DOS mecanismos independientes:
 *  1. `0x15a6` **no es el cierre**: es una cadena de gates, y el segundo es
 *     `15b6: cmp word ptr [bp - 0xa], 0` / `15ba: jne 0x15bf` — o sea que el cierre sólo se
 *     salta con la bandera a CERO, y **sólo el refuge la apaga** (0x145f). La rama de
 *     «Zzzzzz» no la toca, así que llega al cierre.
 *  2. Y al llegar, el gate de D7 (`15bf`) vuelve a llamar a `party_conscious_state`, que
 *     devuelve 1 ⇒ `15c2 inc ax` = 2 ⇒ `15c3 jne 0x15c8` ⇒ el cierre corre.
 * Es exactamente el control por condición separada que #181 dejó verde («party ENTERA
 * DORMIDA ⇒ el cierre corre y el reloj avanza»), y este fichero lo re-mide desde el otro
 * extremo para que los dos caminos no puedan derivar por separado.
 *
 * > ⚠ MATIZ que sale de leer los dos tramos juntos y que NO reabre D7: si la bandera
 * > `[bp-0xa]` ya salta el cierre en el refuge (0x15b6), el gate de −1 de 0x15bf parece
 * > redundante… y no lo es: cubre el caso en que la party muere DURANTE el comando de este
 * > turno, entre 0x1436 y 0x15bf. D7 sigue correcto tal cual está; queda anotado, no tocado.
 *
 * Cadena byte-verificada contra DATA.OVL (fileoff = DS + 0x10): `DS 0x288d = b'Zzzzzz...\n'`.
 *
 * BARRIDO DE AUSENCIA (heredado de #181 y RE-MEDIDO aquí): `git grep Zzzzzz -- game/` sólo
 * picaba en `game/e2e/espejo-tour/routes-ad` (OCR del LP), y ahí el texto pertenece al flujo
 * de (H)ole up / camp, NO a éste.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const TOWN = 2;
const SMALL = 32;
const FLOOR = 68; // 0x44 BrickFloor

function makeChar(status: string): CharacterState {
  return {
    name: "T", gender: 0x0b, class: "A", status,
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}

function makeState(statuses: string[], loc = TOWN): GameState {
  return {
    version: 1,
    characters: statuses.map(makeChar),
    partySize: statuses.length,
    activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    prevHour: 12,
    turnsSinceStart: 0,
    position: { location: loc, floor: 0, x: 5, y: 5 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(48).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    // El arnés sólo puebla lo que la guarda de 0x143c mira (estados del roster) y lo que
    // el cierre necesita; el doble cast es deliberado y acotado a este fichero.
  } as unknown as GameState;
}

function world(loc = TOWN): WorldData {
  const tiles = Array.from({ length: SMALL }, () => Array.from({ length: SMALL }, () => FLOOR));
  const map: SmallMapLocation = { id: loc, name: `Loc${loc}`, floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => FLOOR));
  return { overworld, underworld: overworld, smallMaps: new Map([[loc, map]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, () => 250),
  locationsY: Array.from({ length: 41 }, () => 250),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
  searchObjects: [],
};

function makeGame(s: GameState, loc = TOWN): Game {
  return new Game({} as never, world(loc), gameData, s);
}

const texts = (evs: readonly { kind: string; text?: string }[]): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("#185 · «Zzzzzz...» en la cabecera del bucle de pueblo (TOWN 0x1436-0x1452)", () => {
  it("★ party ENTERA DORMIDA: emite «Zzzzzz...» y el turno se resuelve SIN leer comando", () => {
    const s = makeState(["S", "S"]);
    const g = makeGame(s);
    const evs = g.townAutoSleepTurn();
    expect(evs).not.toBeNull();
    expect(texts(evs!).join("")).toContain("Zzzzzz...");
  });

  it("★ y el CIERRE SÍ corre — el reloj avanza (bandera [bp-0xa] intacta + gate de D7 con ax=1)", () => {
    // Es el otro extremo del control que #181 dejó verde: con `1` el cierre NO se salta.
    const s = makeState(["S", "S"]);
    const g = makeGame(s);
    const minuteBefore = s.time.minute;
    g.townAutoSleepTurn();
    expect(s.time.minute).not.toBe(minuteBefore);
  });

  describe("controles — cada uno aísla UNA condición de 0x143c", () => {
    it("con un miembro DESPIERTO ('G') NO se dispara: se lee comando como siempre", () => {
      // party_conscious_state devuelve 0 en cuanto ve un 'G' ⇒ `cmp ax,1` no casa.
      expect(makeGame(makeState(["G", "S"])).townAutoSleepTurn()).toBeNull();
    });

    it("con un miembro ENVENENADO ('P') tampoco: 'P' cuenta como consciente", () => {
      expect(makeGame(makeState(["P", "S"])).townAutoSleepTurn()).toBeNull();
    });

    it("★ party ENTERA MUERTA tampoco: eso es −1, la rama del REFUGE (0x1456), no ésta", () => {
      // Discrimina 1 de −1: es el par que impide colapsar las dos guardas hermanas.
      const s = makeState(["D", "D"]);
      const g = makeGame(s);
      const evs = g.townAutoSleepTurn();
      expect(evs).toBeNull();
      expect(s.time.minute).toBe(0); // ni turno ni reloj: de esto se ocupa checkRefuge
    });

    it("en el EXTERIOR no aplica: el bucle de 0x1436 es el de PUEBLO", () => {
      expect(makeGame(makeState(["S", "S"], 0), 0).townAutoSleepTurn()).toBeNull();
    });

    it("en MAZMORRA tampoco (loc 0x21-0x28): otro bucle, otra cabecera", () => {
      expect(makeGame(makeState(["S", "S"], 0x21), 0x21).townAutoSleepTurn()).toBeNull();
    });
  });
});
