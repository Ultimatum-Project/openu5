/**
 * aiType 4 — el binario PERSIGUE, el clon HUÍA (#82). Cuarto y último de la familia.
 *
 * `NPC.OVL:0x0d40` es el ÚNICO handler propio de la tabla de salto (base de banda
 * 0xA290): los otros siete comparten destino de dos en dos. Su puerta es
 * `0x0d5b cmp ax,4 / 0x0d5e jl 0xd91` ⇒ con Manhattan < 4 al PUESTO entra en `0x06e4`;
 * si no, `npc_wander(3)`. Dentro de `0x06e4`, `0x0824 cmp [bp-2],3 / jne 0x884` reserva
 * la rama de HUIDA para el 3 —su `0x082f jle` exige candidata MAYOR— y manda al 4 a
 * `0x0884`, cuyo `0x088c jge skip` exige candidata MENOR = ACERCARSE.
 *
 * Denominador de la familia (censo sobre game/assets/npcs.json, 981 ranuras): el único
 * aiType que huye de verdad, el 3, aparece en 4; los tres que el clon mandaba a `fleeStep`
 * suman 118 (4:42 · 6:40 · 7:36). El error era la regla y lo correcto la excepción.
 *
 * Derivación completa en re/notes/npc-aitype4-persigue.md.
 *
 * ARNÉS DE MUTANTES — medido el 06-08 sobre ESTE fichero, no heredado:
 *  · M1 `chaseMove` → `fleeStep` en el case ................ MUERE (caso 1: 3 en vez de 1)
 *  · M2 borrar la puerta (`near || true`) .................. MUERE (caso 3: (15,10) vs (16,10))
 *  · M3 `chaseMove` → `chaseStep` en el case ............... 🔴 **SOBREVIVE**
 *
 * M3 sobrevive **por una razón medida, no por un hueco del testigo**: `chaseStep` lleva
 * dentro la puerta `0x0d8c` del aiType 3/6, que mide al NPC VIVO, mientras la del 4
 * (`0x0d5e`) mide a su PUESTO. Hoy coinciden porque el `switch` de `tick` sólo se alcanza
 * con el NPC ya en su puesto (`manager.ts`, guarda `dist > 0 && !isWanderer`), así que las
 * dos puertas dan lo mismo y el mutante es indistinguible. Es la ficha #84 en forma
 * ejecutable: **el día que alguien toque esa guarda, M3 empieza a discriminar y el aiType 4
 * dejará de perseguir en los casos en que se haya alejado de su puesto.** Por eso el fix
 * llama a `chaseMove` y no a `chaseStep`, aunque hoy los dos pasen el testigo.
 */
import { describe, it, expect } from "vitest";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

/** Mapa pequeño 32×32 todo hierba (tile 5, transitable a pie). */
function grassSmall(location: number): WorldData {
  const floor = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [location, { id: location, name: "T", floors: [{ z: 0, tiles: floor }] }],
    ]),
  } as unknown as WorldData;
}

const LOC = 4;

function mkState(px: number, py: number): GameState {
  return {
    position: { location: LOC, floor: 0, x: px, y: py },
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    characters: [],
    partySize: 1,
  } as unknown as GameState;
}

/** Un NPC en (nx,ny) —que es a la vez su PUESTO— con el aiType dado en las tres ranuras. */
function mkNpc(aiType: number, nx: number, ny: number): NpcRuntime {
  return {
    slot: 1,
    location: LOC,
    type: 1,
    dialogNumber: 0,
    aiTypes: [aiType, aiType, aiType],
    schedX: [nx, nx, nx],
    schedY: [ny, ny, ny],
    schedZ: [0, 0, 0],
    times: [0, 0, 0, 0],
    x: nx,
    y: ny,
    z: 0,
    // #84: el pestillo horario vive en el runtime — el fixture lo trae CERRADO
    // (estado 1, ranura 0 servida) para que el tick caiga en la IA, que es lo
    // que estos tests miden. times=[0,0,0,0] + hora 12 ⇒ check_schedule devuelve
    // 0 (ninguna ranura arranca a las 12) y la IA corre como antes de #84.
    state: 1,
    servedSlot: 0,
    pathBuf: new Array(32).fill(0),
    pathIdx: -1,
    stuck: 0,
  } as NpcRuntime;
}

function tickOnce(aiType: number, npcXY: [number, number], partyXY: [number, number]) {
  const world = grassSmall(LOC);
  const state = mkState(partyXY[0], partyXY[1]);
  const mgr = new NpcManager({});
  const npc = mkNpc(aiType, npcXY[0], npcXY[1]);
  (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, [npc]]]);
  mgr.tick(state, world, new DoorManager());
  return { x: npc.x, y: npc.y };
}

const dist = (a: { x: number; y: number }, b: [number, number]): number =>
  Math.abs(a.x - b[0]) + Math.abs(a.y - b[1]);

describe("aiType 4 PERSIGUE (NPC.OVL:0x0884), no huye", () => {
  it("con el party a Manhattan 2, el NPC se ACERCA", () => {
    const party: [number, number] = [10, 10];
    const antes: [number, number] = [12, 10]; // dist 2 (< 4 ⇒ la puerta de 0x0d5e deja pasar)
    const después = tickOnce(4, antes, party);
    // M1 — restaurar `fleeStep` en el case AI_MERCHANT pone ESTA línea en rojo: con el
    // mutante la distancia sube a 3 en vez de bajar a 1. Es la aserción que acredita el fix.
    expect(dist(después, party), "debe acercarse, no alejarse").toBeLessThan(2);
  });

  it("CONTROL DE DIRECCIÓN — el aiType 3, en el mismo montaje, se ALEJA", () => {
    const party: [number, number] = [10, 10];
    const antes: [number, number] = [12, 10];
    const después = tickOnce(3, antes, party);
    // Sin este control, un fix que mandara TODO a chaseStep pasaría el caso anterior.
    // El 3 es el único que de verdad huye (0x082f `jle`), y debe seguir haciéndolo.
    expect(dist(después, party), "el 3 sigue huyendo").toBeGreaterThan(2);
  });

  it("la PUERTA de distancia existe: a Manhattan 6 no persigue", () => {
    const party: [number, number] = [10, 10];
    const antes: [number, number] = [16, 10]; // dist 6 (>= 4 ⇒ 0x0d5e salta a wander)
    const después = tickOnce(4, antes, party);
    // 🔴 Este aserto EMPEZÓ como `toBeGreaterThanOrEqual(5)` y M2 lo SOBREVIVÍA: desde
    // dist 6 la persecución da 5, que el umbral aceptaba. Umbral flojo = mutante vivo.
    // Se sustituye por el valor MEDIDO: con la semilla determinista del manager (0) el
    // wander no mueve a este NPC, así que queda en su sitio y la distancia sigue en 6.
    // M2 — borrar la condición `near` (perseguir siempre) da (15,10), dist 5 ⇒ ROJO.
    expect([después.x, después.y], "fuera de la puerta no da el paso de persecución").toEqual([
      16, 10,
    ]);
    expect(dist(después, party)).toBe(6);
  });
});
