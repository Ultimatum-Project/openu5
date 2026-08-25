/**
 * aiType 5 y 7 — la MISMA etiqueta falsa que el 6, más la cola que MUEVE EL STREAM (#78).
 *
 * `NPC.OVL:0x0D91` entra en `0x06e4` sin el `cmp ax,4` que el 3 y el 6 traen de `0x0D76`,
 * y dentro cae en la rama `0x0884` = ACERCARSE. El clon los llamaba `AI_FLEE`/`AI_FLEE_2`
 * y los mandaba a `fleeStep`: HUÍAN, y encima sin gastar una sola tirada donde el binario
 * gasta de 1 a 4. Derivación completa en re/notes/npc-aitype57-hostil.md.
 *
 * Los casos van con RNG DETERMINISTA (secuencia fija) porque el sujeto de la mitad de
 * ellos es el CONSUMO, y un contador sobre un generador real no distingue «no tiró» de
 * «tiró y el valor no cambió nada».
 */
import { describe, it, expect } from "vitest";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { OriginalRng } from "../src/core/rng-original.js";
import type { GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

const LOC = 7;

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

function mkState(px: number, py: number): GameState {
  return {
    position: { location: LOC, floor: 0, x: px, y: py },
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    characters: [],
    partySize: 1,
  } as unknown as GameState;
}

function mkNpc(slot: number, aiType: number, nx: number, ny: number): NpcRuntime {
  return {
    slot,
    location: LOC,
    type: 148, // el tipo que llevan los cinco aiType 6 de Skara Brae; aquí sólo es relleno
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

/**
 * Corre UN tick con un generador de guion. `valores` se consume en orden; agotarlo es un
 * error del test, no del código, así que revienta en vez de reciclar en silencio.
 */
function tick(
  npcs: NpcRuntime[],
  partyXY: [number, number],
  valores: number[],
): { tiradas: number; pedidos: Array<[number, number]> } {
  const world = grassSmall(LOC);
  const state = mkState(partyXY[0], partyXY[1]);
  const mgr = new NpcManager({});
  const pedidos: Array<[number, number]> = [];
  let i = 0;
  const guion = {
    next(lo: number, hi: number): number {
      pedidos.push([lo, hi]);
      if (i >= valores.length) {
        throw new Error(`el guion de RNG se quedó corto: pedida la tirada nº ${i + 1}`);
      }
      return valores[i++]!;
    },
  };
  mgr.setRng(guion as unknown as OriginalRng);
  (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, npcs]]);
  mgr.tick(state, world, new DoorManager());
  return { tiradas: i, pedidos };
}

/** Valor que hace FALLAR el 25% (0x3f = 63 ≥ 0x10) — la cola de erratismo no entra. */
const FALLA = 0x3f;
/** Valor que hace PASAR el 25% (0 < 0x10). */
const PASA = 0x00;

describe("aiType 7 (y su gemelo 5) — hostil, no huye, y consume", () => {
  it("🔴 se ACERCA: con el party a Manhattan 3 acorta a 2 (el clon viejo alejaba a 4)", () => {
    const npc = mkNpc(1, 7, 13, 10);
    tick([npc], [10, 10], [FALLA]);
    // W=(12,10) es la única de las cuatro que mejora sobre la distancia actual (3).
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 12, y: 10 });
  });

  it("el 5 hace lo MISMO que el 7 (mismo destino de la tabla de salto)", () => {
    const npc = mkNpc(1, 5, 13, 10);
    tick([npc], [10, 10], [FALLA]);
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 12, y: 10 });
  });

  it("SIN gate de distancia — a Manhattan 6 el 7 actúa y el 6 se queda quieto", () => {
    const siete = mkNpc(1, 7, 16, 10);
    tick([siete], [10, 10], [FALLA]);
    expect({ x: siete.x, y: siete.y }).toEqual({ x: 15, y: 10 });

    // El 6 comparte la rama de dirección pero NO el handler: su gate `0x0d8c` lo frena.
    const seis = mkNpc(1, 6, 16, 10);
    tick([seis], [10, 10], []); // guion VACÍO: si tirase, el test revienta
    expect({ x: seis.x, y: seis.y }).toEqual({ x: 16, y: 10 });
  });

  it("ADYACENTE (Manhattan 1) — ni paso ni tirada", () => {
    const npc = mkNpc(1, 7, 11, 10);
    const { tiradas } = tick([npc], [10, 10], []); // guion vacío = cero tiradas permitidas
    expect(tiradas).toBe(0);
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 11, y: 10 });
  });

  it("CONSUMO — la tirada del 25% se paga SIEMPRE: exactamente 1 cuando falla", () => {
    const npc = mkNpc(1, 7, 13, 10);
    const { tiradas, pedidos } = tick([npc], [10, 10], [FALLA]);
    expect(tiradas).toBe(1);
    expect(pedidos[0]).toEqual([0, 0x3f]); // rango del binario, no uno cualquiera
    expect(npc.x).toBe(12); // y sí corrió: el 1 no es de un camino abortado
  });

  it("CONSUMO — si el 25% pasa, la 1ª alternativa es GRATIS y las demás tiran: 3 en total", () => {
    const npc = mkNpc(1, 7, 13, 10);
    // 1ª: pasa el 25% · 2ª y 3ª: adopción de la 2ª y 3ª alternativas viables.
    const { tiradas } = tick([npc], [10, 10], [PASA, PASA, PASA]);
    expect(tiradas).toBe(3);
    // Elegida W=(12,10); la cola recorre N,S,E: N gratis, S y E con tirada y las dos
    // adoptan ⇒ gana E. El erratismo lo ALEJA, que es justo su papel.
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 14, y: 10 });
  });

  /**
   * 🔴 PREMISA DE LA EQUIVALENCIA QUE HACE SOBREVIVIR AL MUTANTE M6 — NO BORRAR.
   *
   * El binario adopta la PRIMERA dirección que mejora y **sale del bucle**
   * (`NPC.OVL:0x088e mov di,si` + `NPC.OVL:0x0890 jmp 0x84b`). El clon —tanto aquí como en
   * `chaseStep`— recorre las cuatro y se queda con el MÍNIMO. Son criterios distintos y aun
   * así eligen del mismo conjunto, pero **sólo mientras se cumplan estas dos premisas**:
   *
   *   1. **Vecindad de CUATRO** (el vector de direcciones del clon tiene 4 entradas).
   *   2. **Métrica de MANHATTAN.**
   *
   * Con las dos, todo paso que mejora, mejora **exactamente en 1**, así que «la primera que
   * mejora» y «la mejor» son la misma casilla. Si alguien mete diagonales o cambia la métrica,
   * aparecerían mejoras de 2 y los dos criterios se separarían **sin que nada más lo note**.
   *
   * El arnés de mutantes predice que M6 (mínimo en vez de primera-mejora) **SOBREVIVE**, y esa
   * supervivencia es el control de esta equivalencia, no un hueco del testigo. Este caso es su
   * otra mitad: fija la premisa en forma observable. **Si se pone rojo, la equivalencia ha
   * dejado de valer y M6 pasa a ser un mutante que debe morir.**
   */
  it("PREMISA de M6 — con vecindad 4 y Manhattan, toda mejora vale exactamente 1", () => {
    // Party en diagonal ⇒ DOS direcciones mejoran, y las dos por el mismo margen.
    const npc = mkNpc(1, 7, 12, 12); // distancia actual 4
    tick([npc], [10, 10], [FALLA]);
    // Gana la primera en orden de barrido, y la distancia baja de 4 a 3: −1, no −2.
    // Con diagonales, (11,11) mejoraría en 2 y el criterio del mínimo elegiría OTRA casilla.
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 12, y: 11 });
    expect(Math.abs(npc.x - 10) + Math.abs(npc.y - 10)).toBe(3);
  });

  it("la cola MUEVE aunque ninguna dirección mejore, y cobra igual", () => {
    // Bloqueamos la única casilla que mejora con otro NPC (aiType 0: quieto y sin tiradas).
    const npc = mkNpc(1, 7, 13, 10);
    const tapon = mkNpc(2, 0, 12, 10);
    const { tiradas } = tick([npc, tapon], [10, 10], [PASA, PASA, PASA]);
    expect(tiradas).toBe(3);
    expect({ x: npc.x, y: npc.y }).toEqual({ x: 14, y: 10 });
    expect({ x: tapon.x, y: tapon.y }).toEqual({ x: 12, y: 10 });
  });
});
