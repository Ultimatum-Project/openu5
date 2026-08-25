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
  DungeonState,
  CellType,
  roomCombatMapIndex,
  type DungeonData,
} from "../src/core/dungeon/dungeon.js";

/**
 * SALAS DE MAZMORRA SIN SALIDA — geometría de `DUNGEON.DAT` y retorno de sala.
 * Derivación completa en `re/notes/salas-selladas-mazmorra.md` (ficha #347, que cierra
 * también #181). Nace del reporte de un jugador: en Doom bajó del nivel 2 al 3 por la
 * escalera U/D, peleó una sala con ratas y wisps y quedó ENCERRADO.
 *
 * Lo que este fichero fija es lo MEDIDO, que son dos cosas distintas:
 *
 *  1. El índice de mapa de sala es una POSICIÓN DE ARRAY, no el campo `index` (que en
 *     `combatmaps.json` es por territorio). `roomCombatMapIndex` cubre 16..127 y Doom
 *     ocupa 112..127 — el bloque EXISTE y el `16 +` es correcto. #181 lo daba por
 *     ausente leyendo `index` como global.
 *  2. Catorce celdas de sala del juego tienen los CUATRO vecinos a muro, sin puerta
 *     secreta, y con la sala encima del rellano de una escalera cuya pareja vive en la
 *     planta contigua. Sobre esa celda el binario no deja andar (DUNGEON:0x05FF),
 *     no deja klimbar (0x1e5e-0x1e89) y en Doom veta además Uus/Des Por
 *     (CAST 0x0fd2/0x0ffc, `cmp [g_location],0x28`). Es cierre duro DEL ORIGINAL: el
 *     port coincide y estas guardas existen para que nadie lo «arregle» sin decidirlo.
 *
 * ★ ESPERADOS EN CRUDO. La rejilla de la sala 102 y la fila de `DUNGEON.DAT` van escritas
 * como literales leídos de los ficheros del juego, NO recalculadas desde el extractor:
 * un extractor que cambiara de convención tiene que enrojecer aquí, no acompañarse.
 *
 * ⚠ Este fichero lee `game/assets`, que es un symlink gitignored (misma clase que
 * `sala-sin-enemigos.test.ts` y compañía, ficha #307): su rojo puede no ser propiedad del
 * commit si el árbol de assets no está enlazado.
 */
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const dungeons = load<DungeonData[]>("../assets/maps/dungeons.json");

const DOOM = 40;
/** Doom planta 2 (el «nivel 3» del jugador), celda de la sala 6. */
const CELDA = { floor: 2, x: 5, y: 5 } as const;
/** `16 + dungeonOrderSkippingDespise(40)*16 + 6` = 16 + 96 + 6. */
const POS_SALA6 = 118;

/**
 * `DUNGEON.CBT` offset 102×352, bytes 0..10 de cada una de las 11 filas. Un claro de
 * hierba (5) con anillo de árboles (76/77) sobre relleno 255: la «sala sin paredes» del
 * reporte es lo que trae 1988.
 */
const TILES_SALA_102: number[][] = [
  [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
  [255, 255, 255, 77, 77, 77, 77, 77, 255, 255, 255],
  [255, 255, 77, 77, 76, 76, 76, 77, 77, 255, 255],
  [255, 77, 77, 76, 5, 5, 5, 76, 77, 77, 255],
  [255, 77, 76, 5, 5, 5, 5, 5, 76, 77, 255],
  [255, 77, 76, 5, 5, 5, 5, 5, 76, 77, 255],
  [255, 77, 76, 5, 5, 5, 5, 5, 76, 77, 255],
  [255, 77, 77, 76, 5, 5, 5, 76, 77, 77, 255],
  [255, 255, 77, 77, 76, 76, 76, 77, 77, 255, 255],
  [255, 255, 255, 77, 77, 77, 77, 77, 255, 255, 255],
  [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
];

/** `DUNGEON.DAT` Doom (mazmorra 7), planta 2, fila y=5 — los 8 bytes verbatim. */
const DOOM_F2_FILA5 = [0x00, 0xf4, 0xb0, 0x00, 0xb0, 0xf6, 0xb0, 0x00];

/**
 * Las 14 celdas de sala con los cuatro vecinos a muro y ninguna puerta secreta, censadas
 * sobre `DUNGEON.DAT`. Formato `location:floor:x:y = sala`.
 */
const SELLADAS_ESPERADAS = [
  "33:1:5:3=0",
  "33:2:1:1=2",
  "35:0:3:1=0",
  "35:0:7:7=1",
  "37:5:0:0=14",
  "38:5:1:0=5",
  "38:5:5:2=4",
  "38:6:7:6=15",
  "39:4:5:0=6",
  "39:7:1:1=12",
  "40:1:1:1=2",
  "40:2:5:5=6",
  "40:6:1:3=10",
  "40:7:5:7=15",
];

const DELTAS: Array<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function estado(dungeon: number, floor: number, x: number, y: number): DungeonState {
  return new DungeonState(dungeons, { dungeon, floor, x, y, facing: "north" });
}

/** Vecinos por los que la party PUEDE salir (con envolvimiento &7, DUNGEON:0x057a). */
function salidas(ds: DungeonState, floor: number, x: number, y: number): number {
  return DELTAS.filter(([dx, dy]) => {
    const nx = (x + dx) & 7;
    const ny = (y + dy) & 7;
    return ds.isPassable(ds.cellAt(floor, nx, ny), floor, nx, ny);
  }).length;
}

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}

describe("#181: el índice de mapa de sala es POSICIÓN DE ARRAY, y el bloque de Doom existe", () => {
  it("roomCombatMapIndex cubre 16..127 sin hueco ni solape sobre las 7 mazmorras con salas", () => {
    const vistos = new Set<number>();
    // Despise (34) queda fuera: 0 celdas de sala en los datos (ver acta §1).
    for (const loc of [33, 35, 36, 37, 38, 39, 40]) {
      for (let room = 0; room < 16; room++) vistos.add(roomCombatMapIndex(loc, room));
    }
    expect(vistos.size, "7 mazmorras × 16 salas, sin colisión").toBe(112);
    expect(Math.min(...vistos), "arranca justo tras los 16 mapas de BRIT.CBT").toBe(16);
    expect(Math.max(...vistos), "termina en la última entrada del array").toBe(127);
  });

  it("Doom ocupa 112..127 y la sala 6 cae en la posición 118", () => {
    expect(roomCombatMapIndex(DOOM, 0)).toBe(112);
    expect(roomCombatMapIndex(DOOM, 6)).toBe(POS_SALA6);
    expect(roomCombatMapIndex(DOOM, 15), "la sala 15 de Doom = el mapa del desenlace").toBe(127);
  });

  it("el array tiene las 128 posiciones y el bloque dungeon empieza en la 16", () => {
    expect(combatMaps.length, "16 de BRIT.CBT + 112 de DUNGEON.CBT").toBe(128);
    for (let i = 0; i < 16; i++) expect(combatMaps[i]!.territory).toBe("britannia");
    for (let i = 16; i < 128; i++) expect(combatMaps[i]!.territory).toBe("dungeon");
  });

  it("la posición 118 trae los tiles CRUDOS de la sala 102 de DUNGEON.CBT", () => {
    expect(combatMaps[POS_SALA6]!.tiles).toEqual(TILES_SALA_102);
  });
});

describe("#347: la sala del reporte y su encierro", () => {
  it("la sala 118 pone GIANT RATS y WISPS — el discriminante del reporte del jugador", () => {
    const state = freshState();
    const combat = new Combat({
      map: combatMaps[POS_SALA6]!,
      entryDirection: "south",
      party: party(state),
      enemies: { fixedFromMap: true, defs: enemyDefs },
      seed: 0,
      state,
      defenseValues: data.defenseValues,
      spellAttackRange: data.spellAttackRange,
      enemyDefs,
      roomCombat: true,
    });
    const indices = combat.combatants
      .filter((c) => c.kind === "enemy")
      .map((c) => c.enemyDef!.index)
      .sort((a, b) => a - b);
    // 20 = GIANT RATS · 37 = WISPS (monsterNamesUpper de DATA.OVL).
    expect(indices).toEqual([20, 20, 20, 20, 20, 37, 37, 37]);
  });

  it("Doom planta 2 fila 5 son los bytes crudos de DUNGEON.DAT", () => {
    const ds = estado(DOOM, CELDA.floor, 0, 5);
    const fila = Array.from({ length: 8 }, (_, x) => {
      const c = ds.cellAt(CELDA.floor, x, 5);
      return (c.type << 4) | c.sub;
    });
    expect(fila).toEqual(DOOM_F2_FILA5);
  });

  it("la celda (5,5) es la sala 6 y tiene CERO salidas", () => {
    const ds = estado(DOOM, CELDA.floor, CELDA.x, CELDA.y);
    const cell = ds.cellAt(CELDA.floor, CELDA.x, CELDA.y);
    expect(cell.type).toBe(CellType.Room);
    expect(cell.sub & 0xf).toBe(6);
    expect(salidas(ds, CELDA.floor, CELDA.x, CELDA.y), "los cuatro vecinos son muro").toBe(0);
  });

  it("y Klimb no la levanta: la sala no es escalera ni celda iluminada", () => {
    const ds = estado(DOOM, CELDA.floor, CELDA.x, CELDA.y);
    const state = freshState();
    state.grapple = false;
    // DUNGEON 0x1e5e-0x1e89: arriba exige hi ∈ {0x10,0x30}, abajo hi ∈ {0x20,0x30,0x60}.
    expect(ds.klimb(state)[0]).toEqual({ kind: "message", text: "Klimb-what?" });
    // Y con garfio tampoco: el bit 0x08 del tile 0xF6 está a cero (0x1e52 `raw & 8`).
    state.grapple = true;
    expect(ds.klimb(state)[0]).toEqual({ kind: "message", text: "Klimb-what?" });
  });

  it("y Klimb SÍ la levanta una vez DESPEJADA, por la pareja de escalera", () => {
    // El remedio de #347: sobre sala YA despejada (0xA), la dirección cuya celda pareja de
    // la planta contigua ES la escalera correspondiente. Doom (5,5) tiene escalera-arriba-y-
    // abajo (0x30) encima ⇒ se sube por donde se entró.
    const ds = estado(DOOM, CELDA.floor, CELDA.x, CELDA.y);
    const state = freshState();
    state.grapple = false;
    ds.markRoomClearedAt(state, CELDA.floor, CELDA.x, CELDA.y);
    expect(ds.cellAt(CELDA.floor, CELDA.x, CELDA.y).type, "despejada = 0xA").toBe(
      CellType.RoomsBroke,
    );
    expect(ds.klimb(state, "up")[0]).toEqual({ kind: "message", text: "Up!\n" });
    expect(ds.pos.floor, "sube a la planta de la escalera pareja").toBe(CELDA.floor - 1);
  });

  it("la sala del DESENLACE: ni la pareja la abre ni el garfio de 1988 la saca — sube y cae", () => {
    // Doom planta 7 (5,7) = sala 15 = combatmaps 127 = la sala de Lord British. Encima hay
    // FOSO (0x6_, no escalera) y no hay planta 8 ⇒ la regla de pareja no la toca.
    //
    // ★ El garfio SÍ la klimba, y aun así no se sale. Su nº de sala es 15, y el gate del
    // garfio lee el bit 0x08 del tile CRUDO sin mirar el nibble alto (`1e52: and ax,8`): en
    // una sala ese bit es el bit 3 del NÚMERO DE SALA, así que toda sala ≥8 se lee
    // «iluminada». Pero el techo es un foso de CAÍDA y `on_enter` te devuelve. El landing no
    // lo impide: `dng_landing_ok` (0x1C0C) sólo mira el tile con mode≠0 y Klimb pasa mode=0.
    const ds = estado(DOOM, 7, 5, 7);
    const state = freshState();
    expect(ds.cellAt(6, 5, 7).type, "encima hay un foso, no una escalera").toBe(CellType.Trap);
    ds.markRoomClearedAt(state, 7, 5, 7);

    state.grapple = false;
    expect(ds.klimb(state)[0], "sin garfio: el mensaje de celda-iluminada-sin-garfio").toEqual({
      kind: "message",
      text: "Klimb-\nWith What?",
    });
    expect(ds.pos.floor, "y no se ha movido").toBe(7);

    state.grapple = true;
    const ev = ds.klimb(state, "up");
    expect(ev[0], "el garfio de 1988 sí acepta: el klimb ocurre").toEqual({
      kind: "message",
      text: "Up!\n",
    });
    expect(
      ev.some((e) => e.kind === "message" && e.text === "Pit Trap!"),
      "y el foso de encima dispara",
    ).toBe(true);
    expect(ds.pos.floor, "viaje de ida y vuelta: acaba donde empezó").toBe(7);
  });

  it("en 1988 son DIEZ cepos duros: de las cinco «iluminadas» el garfio saca a CUATRO", () => {
    // El gate del garfio lee el bit 0x08 del tile CRUDO sin mirar el nibble alto
    // (`1e52 … and ax,8`), y en una sala ese bit es el bit 3 del NÚMERO DE SALA ⇒ toda sala
    // ≥8 se lee «iluminada» y el garfio sube. Conflación DEL BINARIO, calcada por el port.
    const conBitLit = SELLADAS_ESPERADAS.filter((c) => (Number(c.split("=")[1]) & 8) !== 0);
    expect(conBitLit, "las cinco selladas cuyo nº de sala trae el bit 0x08").toEqual([
      "37:5:0:0=14",
      "38:6:7:6=15",
      "39:7:1:1=12",
      "40:6:1:3=10",
      "40:7:5:7=15",
    ]);
    expect(SELLADAS_ESPERADAS.length - conBitLit.length, "las que ni con garfio").toBe(9);

    // Y la CONDUCTA de las cinco, EJERCIDA (el bit no es el veredicto: la última sube y cae).
    const salida = conBitLit.map((clave) => {
      const [loc, f, x, y] = clave.split("=")[0]!.split(":").map(Number);
      const ds = estado(loc!, f!, x!, y!);
      const state = freshState();
      state.grapple = true;
      ds.markRoomClearedAt(state, f!, x!, y!);
      ds.klimb(state, "up");
      return `${clave} ${f}->${ds.pos.floor}`;
    });
    expect(salida, "cuatro cambian de planta; la del desenlace vuelve a la suya").toEqual([
      "37:5:0:0=14 5->4",
      "38:6:7:6=15 6->5",
      "39:7:1:1=12 7->6",
      "40:6:1:3=10 6->5",
      "40:7:5:7=15 7->7",
    ]);
    // ⇒ en 1988: 9 + 1 = DIEZ encerronas, y las otras 4 piden un objeto opcional.
  });

  it("la guarda de intervención mínima: donde 1988 daba salida, (A) ni se consulta", () => {
    // Covetous p5 (0,0) y Doom p6 (1,3) son el par que la destapa: salas ≥8 (el garfio abre
    // ARRIBA) que además tienen escalera-arriba DEBAJO (la pareja abriría ABAJO). Sin la
    // guarda, las dos direcciones quedan vivas y el mando pasa a pedir el prompt "Klimb-U/D-"
    // en una celda donde el original no preguntaba: (A) alterando un desenlace que el binario
    // ya daba. Con la guarda, el garfio manda y la pareja no se mira.
    for (const [loc, f, x, y] of [
      [37, 5, 0, 0],
      [40, 6, 1, 3],
    ] as Array<[number, number, number, number]>) {
      const ds = estado(loc, f, x, y);
      const state = freshState();
      expect(
        ds.cellAt(f + 1, x, y).type,
        `${loc} p${f}: debajo hay escalera-arriba (la pareja que la guarda ignora)`,
      ).toBe(CellType.LadderUp);
      ds.markRoomClearedAt(state, f, x, y);

      state.grapple = true;
      expect(ds.klimbNeedsChoice(state), "con garfio: una sola dirección, como en 1988").toBe(
        false,
      );
      ds.klimb(state, "up");
      expect(ds.pos.floor, "y la que ofrece 1988 es ARRIBA").toBe(f - 1);

      // Control NEGATIVO: sin garfio el binario no ofrece nada, así que (A) sí entra — y por
      // abajo. Sin esta mitad, la de arriba pasaría igual con la regla entera desactivada.
      const ds2 = estado(loc, f, x, y);
      const st2 = freshState();
      st2.grapple = false;
      ds2.markRoomClearedAt(st2, f, x, y);
      ds2.klimb(st2, "up");
      expect(ds2.pos.floor, "sin garfio (A) la des-sella por la pareja de abajo").toBe(f + 1);
    }
  });

  it("la pareja NO abre una sala SIN despejar: primero se pelea", () => {
    const ds = estado(DOOM, CELDA.floor, CELDA.x, CELDA.y);
    const state = freshState();
    state.grapple = false;
    expect(ds.cellAt(CELDA.floor, CELDA.x, CELDA.y).type).toBe(CellType.Room); // 0xF, sin pelear
    expect(ds.klimb(state)[0]).toEqual({ kind: "message", text: "Klimb-what?" });
  });

  it("la regla des-sella 13 de las 14, y la 14ª es la del desenlace", () => {
    // 🔴 ESTE TEST EJERCE EL GATE, NO REPLICA SU PREDICADO. Nació replicando la condición
    // sobre los datos (leer el tile de encima y el de debajo y contar) y así SOBREVIVÍA al
    // mutante «pareja nunca»: medía la GEOMETRÍA —cuántas celdas tienen escalera pareja—,
    // que es cierta con el gate desconectado. Lo que hay que contar es la CONDUCTA: sin
    // garfio, sobre sala despejada, ¿cambia de planta el Klimb?
    const desSelladas: string[] = [];
    const siguenSelladas: string[] = [];
    for (const clave of SELLADAS_ESPERADAS) {
      const [loc, f, x, y] = clave.split("=")[0]!.split(":").map(Number) as number[];
      const ds = estado(loc!, f!, x!, y!);
      const state = freshState();
      state.grapple = false; // sin el garfio: aquí sólo puede actuar (A)
      ds.markRoomClearedAt(state, f!, x!, y!);
      ds.klimb(state, "up");
      (ds.pos.floor !== f! ? desSelladas : siguenSelladas).push(clave);
    }
    expect(desSelladas.length, "13 encerronas reales des-selladas").toBe(13);
    expect(siguenSelladas, "la única que queda sellada es la sala del desenlace").toEqual([
      "40:7:5:7=15",
    ]);
  });

  it("son EXACTAMENTE 14 salas selladas en todo el juego, y son éstas", () => {
    const encontradas: string[] = [];
    for (const dg of dungeons) {
      // Un estado por MAZMORRA: el constructor clona los datos, y uno por celda son 4.096
      // clonados (el test tardaba 6,8 s y se comía el timeout de 5 s). `cellAt`/`isPassable`
      // toman floor/x/y explícitos, así que la posición del estado da igual.
      const ds = estado(dg.location, 0, 0, 0);
      for (let f = 0; f < dg.floors.length; f++) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const cell = ds.cellAt(f, x, y);
            if (cell.type !== CellType.Room) continue;
            const secretas = DELTAS.filter(
              ([dx, dy]) => ds.cellAt(f, (x + dx) & 7, (y + dy) & 7).type === CellType.SecretDoor,
            ).length;
            if (salidas(ds, f, x, y) > 0 || secretas > 0) continue;
            encontradas.push(`${dg.location}:${f}:${x}:${y}=${cell.sub & 0xf}`);
          }
        }
      }
    }
    expect(encontradas.sort()).toEqual([...SELLADAS_ESPERADAS].sort());
  });
});
