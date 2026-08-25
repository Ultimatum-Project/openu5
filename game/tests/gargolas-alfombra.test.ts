/**
 * ¿Las gárgolas del Palacio saltan de la pared con la ALFOMBRA VOLADORA?
 *
 * Pregunta del usuario, jugando; testigo del walkthrough de Lord Fenton (cap. 23,
 * ~4:04-4:12): la party CRUZA la azotea del Palacio montada en la alfombra y las dos
 * gárgolas no se mueven de su hornacina. Este fichero clava la respuesta DERIVADA del
 * crudo, que tiene DOS piezas y una trampa:
 *
 * 1. **El gate de persecución NO lee el transporte.** `NPC.OVL:0x0d76-0x0d8f` empuja
 *    `g_party_x`/`g_party_y` y `[bx+2]/[bx+4]` (posición VIVA del NPC) a la Manhattan
 *    `0x6a0` y compara con 4. Censo: `g_transport_tile` aparece 0 veces en TODO
 *    `NPC.OVL` — simbolizado y por patrón de bytes `7c58` (control positivo: 23/23 en
 *    `TOWN.OVL` por las dos vías, y el propio `g_party_x` del handler resuelve). Lo
 *    mismo en `npc_engine` (TOWN 0x1352-0x1420, 0 refs) y en `town_attack_engine_commit`
 *    (TOWN 0x09BC, 17 instrucciones sin rama). ⇒ montado NO hay inmunidad: la gárgola
 *    despierta, persigue y TRABA COMBATE igual.
 * 2. **Lo que SÍ cambia es la CADENCIA.** `TOWN 0x161F-0x1640`: con
 *    `0x12 <= g_transport_tile < 0x16` (caballo montado 0x12/0x13 **y alfombra**
 *    0x14/0x15) y tecla ≠ 0x20, el toggle `[bp-4]` salta a 0x1686 uno de cada dos
 *    turnos, saltándose `npc_tick_all` (0x166E) y `npc_engine` (0x1683). Montado, la
 *    party va al DOBLE de velocidad que los NPC. Ya portado en `townNpcTailRuns`.
 * 3. 🔴 **LA TRAMPA — el fotograma del vídeo no instancia la diferencia.** En el
 *    fotograma de Fenton la party está en (15,18) z=3, o sea entre las dos gárgolas de
 *    (13,18)/(17,18), a Manhattan 2 de cada una. Ahí NO se mueven ni montado NI A PIE:
 *    el paso de `0x0884` es ESTRICTAMENTE mejorante (`0x088a cmp [bx],ax / 0x088c jge
 *    skip`, y `0x08f1 cmp [bp-0x18],-1 / jle` = sin candidata NO se mueve), y desde
 *    (13,18) la única vecina libre es (13,19) — que sube la distancia de 2 a 3, porque
 *    (12,18)=0x52 y (14,18)=0x54 son MURO. El testigo elegido pasa con las dos hipótesis:
 *    por eso el control A PIE en el MISMO sitio es obligatorio.
 *
 * Esperados EN CRUDO (no derivados del sujeto):
 *  - gárgolas = ranuras 17 y 18 de `npcs.json` loc 18: tipo 0xB8, aiTypes [6,6,6],
 *    puesto (13,18) y (17,18), z=3 en las tres franjas horarias.
 *  - fila 18 del mapa de Blackthorn z=3, x=12..18: 52 57 54 44 55 57 53 (muro, gárgola,
 *    muro, ladrillo, muro, gárgola, muro); fila 19 x=13..17: 44 44 44 44 44.
 *  - tile de la alfombra montada = 0x14 (transport.ts TILE_CARPET, MAINOUT 0x013d).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import { townTurn, type TownNpcPhases } from "../src/core/world/loops/turn.js";
import type { GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const LOC = 18; // Palacio de Blackthorn
const Z = 3; // azotea
const TILE_FOOT = 0x1c;
const TILE_CARPET = 0x14;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const smallMaps = load<SmallMapLocation[]>("../assets/maps/smallmaps.json");
const palace = smallMaps.find((m) => m.id === LOC)!;
const roof = palace.floors.find((f) => f.z === Z)!;

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[LOC, palace]]),
  } as unknown as WorldData;
}

function mkState(px: number, py: number, transportTile: number): GameState {
  return {
    position: { location: LOC, floor: Z, x: px, y: py },
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    characters: [],
    partySize: 1,
    transport: transportTile === TILE_CARPET ? "carpet" : "foot",
    transportTile,
    turnsSinceStart: 0,
  } as unknown as GameState;
}

/** Las dos gárgolas de fábrica (ranuras 17/18 de npcs.json loc 18), en su puesto. */
function gargolas(): NpcRuntime[] {
  return [
    [17, 13, 18],
    [18, 17, 18],
  ].map(
    ([slot, x, y]) =>
      ({
        slot,
        location: LOC,
        type: 0xb8,
        dialogNumber: 0,
        aiTypes: [6, 6, 6],
        schedX: [x, x, x],
        schedY: [y, y, y],
        schedZ: [Z, Z, Z],
        times: [0, 0, 0, 0],
        x,
        y,
        z: Z,
        state: 1,
        servedSlot: 0,
        pathBuf: new Array(32).fill(0),
        pathIdx: -1,
        stuck: 0,
      }) as unknown as NpcRuntime,
  );
}

/**
 * N turnos de pueblo REALES (`townTurn`, TOWN 0x141E) con el tick del NpcManager
 * inyectado donde el binario lo llama (`afterHousekeeping` = 0x166E, DENTRO de la
 * puerta de cadencia 0x161F). Devuelve las posiciones de las gárgolas turno a turno.
 */
function correr(opts: {
  party: [number, number];
  transportTile: number;
  turnos: number;
  /** Movimiento del party ANTES de cada turno (el vídeo entra volando al norte). */
  paso?: [number, number];
  passCommand?: boolean;
}): Array<Array<[number, number]>> {
  const w = world();
  const state = mkState(opts.party[0], opts.party[1], opts.transportTile);
  const mgr = new NpcManager({});
  const list = gargolas();
  (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, list]]);
  const doors = new DoorManager();
  const phases: TownNpcPhases = { mount: 0, quickness: 0 };
  const rand = (a: number, b: number) => a + ((b - a) >> 1); // determinista, sin RNG vivo
  const out: Array<Array<[number, number]>> = [];
  for (let i = 0; i < opts.turnos; i++) {
    if (opts.paso) {
      state.position.x += opts.paso[0];
      state.position.y += opts.paso[1];
    }
    townTurn(state, rand, {
      consumesTurn: true,
      npcPhases: phases,
      passCommand: opts.passCommand ?? false,
      afterHousekeeping: () => mgr.tick(state, w, doors),
    });
    out.push(list.map((n) => [n.x, n.y] as [number, number]));
  }
  return out;
}

describe("gárgolas del Palacio con la ALFOMBRA — TOWN 0x161F vs NPC.OVL 0x0d76", () => {
  it("PREMISA — el mapa y los puestos son los del crudo (fila 18 y 19 de la azotea)", () => {
    // Si esta fila cambia, los tres casos de abajo dejan de medir lo que dicen medir.
    expect(roof.tiles[18]!.slice(12, 19)).toEqual([0x52, 0x57, 0x54, 0x44, 0x55, 0x57, 0x53]);
    expect(roof.tiles[19]!.slice(13, 18)).toEqual([0x44, 0x44, 0x44, 0x44, 0x44]);
    const npcs = load<Record<string, Array<Record<string, unknown>>>>("../assets/npcs.json")[
      String(LOC)
    ]!;
    const g = npcs.filter((n) => n.slot === 17 || n.slot === 18);
    expect(g.map((n) => [n.type, n.aiTypes, n.x, n.y, n.z])).toEqual([
      [0xb8, [6, 6, 6], [13, 13, 13], [18, 18, 18], [3, 3, 3]],
      [0xb8, [6, 6, 6], [17, 17, 17], [18, 18, 18], [3, 3, 3]],
    ]);
  });

  it("A PIE, subiendo del sur: SALTAN de la hornacina y cierran TODOS los turnos", () => {
    // Cuatro pasos al norte desde (15,21): los beats son (15,20), (15,19), (15,18), (15,17).
    const t = correr({ party: [15, 21], transportTile: TILE_FOOT, turnos: 4, paso: [0, -1] });
    expect(t[0], "party (15,20): dist 4, la puerta 0x0d8f pide < 4").toEqual([
      [13, 18],
      [17, 18],
    ]);
    expect(t[1], "party (15,19): dist 3 ⇒ bajan de la almena").toEqual([
      [13, 19],
      [17, 19],
    ]);
    expect(t[2], "party (15,18): cierran a la diagonal").toEqual([
      [14, 19],
      [16, 19],
    ]);
    // La 17 alcanza (15,19) —bajo la party— y la 18 se queda porque la celda ya está
    // ocupada (la guarda de ocupación del paso, no la puerta de distancia).
    expect(t[3], "party (15,17): siguen encima").toEqual([
      [15, 19],
      [16, 19],
    ]);
  });

  it("EN ALFOMBRA, la MISMA subida: se mueven UNO DE CADA DOS turnos (TOWN 0x161F)", () => {
    const t = correr({ party: [15, 21], transportTile: TILE_CARPET, turnos: 4, paso: [0, -1] });
    // Toggle [bp-4] arranca en 0 ⇒ el PRIMER turno montado ya salta (0x163e jne 0x1686).
    expect(t[0], "turno impar: la cola de NPC no corre").toEqual([
      [13, 18],
      [17, 18],
    ]);
    expect(t[1], "turno par: la cola SÍ corre y con dist 3 bajan").toEqual([
      [13, 19],
      [17, 19],
    ]);
    // 🔴 Aquí está la diferencia con el caso a pie: con la party ya en (15,18) y las
    // gárgolas a dist 3 (que a pie da (14,19)/(16,19)), el turno impar se lo come el
    // toggle y NO cierran.
    expect(t[2], "turno impar: se quedan donde estaban").toEqual([
      [13, 19],
      [17, 19],
    ]);
    // Y en el turno par siguiente la party YA se ha ido a (15,17): dist 4 ⇒ la puerta
    // 0x0d8f las apaga. La alfombra no las inmuniza: las DEJA ATRÁS.
    expect(t[3], "party (15,17): dist 4, fuera de puerta").toEqual([
      [13, 19],
      [17, 19],
    ]);
  });

  it("CONTROL DE LA TRAMPA — en (15,18) no se mueven NI montado NI a pie (geometría)", () => {
    // El fotograma de Fenton. La única vecina libre de (13,18) es (13,19), que SUBE la
    // distancia de 2 a 3 ⇒ el `jge` de 0x088c la descarta y 0x08f1 sale sin mover.
    // Sin este control, el caso de la alfombra se leería como «la alfombra las congela».
    for (const tile of [TILE_FOOT, TILE_CARPET]) {
      const t = correr({ party: [15, 18], transportTile: tile, turnos: 4 });
      for (const beat of t) {
        expect(beat, `tile 0x${tile.toString(16)}`).toEqual([
          [13, 18],
          [17, 18],
        ]);
      }
    }
  });

  it("PASAR (espacio) anula el privilegio: montado, la cola corre TODOS los turnos", () => {
    // TOWN 0x162D `cmp [bp-6],0x20 / je 0x1642`: la tecla ESPACIO se salta el toggle.
    const t = correr({
      party: [15, 19],
      transportTile: TILE_CARPET,
      turnos: 2,
      passCommand: true,
    });
    expect(t[0]).toEqual([
      [13, 19],
      [17, 19],
    ]);
    expect(t[1]).toEqual([
      [14, 19],
      [16, 19],
    ]); // sin toggle: cierran turno a turno, igual que a pie
  });
});
