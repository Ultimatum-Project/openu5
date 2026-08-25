/**
 * #137 · (B)oard lee la CAPA DE OBJETOS, no el terreno — CMDS.OVL 0x07F6.
 *
 * EL ORIGINAL (CMDS 0x0818-0x0832):
 * ```
 * 0818  push g_party_x / push g_party_y / push g_floor
 * 0826  call 0x770e            ; find_object_at_xy — CMDS.OVL near-call base 0xBF80
 *                              ; ⇒ kernel ULTIMA.EXE 0x368E (prólogo push bp/mov bp,sp ✓)
 * 0829  mov [bp-0xa], al       ; ★ AL = byte +0 del REGISTRO DE OBJETO, 0 si NO hay objeto
 * 082c  mov ax,[g_cmb_scratch_x] / mov [bp-4],ax   ; ...y el ÍNDICE del objeto
 * 0832  mov al,[bp-0xa] / and al,0xfe / cmp al,0x10 / jne …   ; ← se ramifica sobre ESE byte
 * ```
 * Y `find_object_at_xy` (kernel 0x368E) barre la tabla de objetos DS:0x5C5A con stride 8
 * (`si` de 0x5C62 a 0x5D5A ⇒ índices 1..31, el 0 es el vehículo activo), compara
 * `+2`/`+3`/`+4` con (x, y, piso) y devuelve `al = [si]` = el byte **+0**; si el barrido
 * termina sin acierto, `36f3: sub ax,ax` ⇒ **0**. El terreno no se consulta en ningún punto.
 *
 * ★ LOS DOS ESPACIOS DE TILE (la raíz del defecto). El byte +0 de un registro de objeto
 * —igual que `g_transport_tile`— es un índice del **banco alto** de sprites: tile real =
 * byte + 0x100. Verificado contra la tabla de tiles del propio port (`TileData.json`):
 *
 * | byte | tile real | nombre            || mismo byte como TERRENO |
 * |------|-----------|-------------------||-------------------------|
 * | 0x10 | 0x110     | HorseRight        || `Hut`                   |
 * | 0x11 | 0x111     | HorseLeft         || `Codex`                 |
 * | 0x1B | 0x11B     | Carpet2           || `Lighthouse`            |
 * | 0x24 | 0x124     | ShipNoSailsUp     || `Path5`                 |
 * | 0x28 | 0x128     | SkiffUp           || `Roof2`                 |
 *
 * El port comparaba el tile de TERRENO (espacio 0..511) contra esos bytes ⇒ **plantarse
 * sobre un camino y pulsar (B) embarcaba en una nave**. Población medida sobre los assets
 * de mapa del port, contando sólo tiles TRANSITABLES (donde el party puede estar):
 * overworld 84 celdas (4 `Hut`, 1 `Codex`, 4 `Lighthouse`, 75 `Path5/6/7`) + small maps 53
 * (`Path5/6/7`) = **137 celdas** de falso positivo en el juego navegable a pie.
 *
 * ⚠ LA EQUIVALENCIA DE CAPAS QUE USA EL PORT, declarada: el port tiene DOS canales para un
 * vehículo del mundo — `worldObjects` (nave atracada, F1.5) y el override de TERRENO de la
 * Clase C (caballo del establo/del pozo, montura dejada por (X)-it). Los dos guardan el
 * tile en el espacio COMPLETO (convención `p.type + 0x100` de `hydrateInteriorObjects`),
 * así que la frontera es `tile − 0x100` y «no hay objeto» ⇔ «el tile de la celda NO es del
 * banco alto». CONTROL que hace exacto ese discriminador: barridos los cinco ficheros de
 * mapa estático del port (overworld, underworld, smallmaps, combatmaps, dungeons), el tile
 * máximo es 0xFF y hay **cero** celdas ≥ 0x100.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const PX = 10, PY = 10;
/** Banco alto de sprites: el byte del registro de objeto se dibuja como `byte + 0x100`. */
const ACTOR_BANK = 0x100;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff, partyStatus: 0,
  };
}

/** Small map de brush con `under` bajo el party. */
function world(under = 5): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  tiles[PY]![PX] = under;
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[PAWS, paws]]) };
}

function makeState(): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 10, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: PAWS, floor: 0, x: PX, y: PY },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  } as unknown as GameState;
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(under = 5): Game {
  return new Game({} as ExtractedInitialState, world(under), gameData, makeState());
}

const msgs = (g: Game, ev = g.board()): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

const overrideAt = (g: Game, x: number, y: number): number | undefined =>
  g.state.mapOverrides?.[`${PAWS}:0:${x}:${y}`];

/** Los 12 tiles de TERRENO cuyo número coincide con un byte de vehículo. */
const COLISIONES: [number, string][] = [
  [0x10, "Hut"], [0x11, "Codex"], [0x14, "SmallCastle"], [0x1b, "Lighthouse"],
  [0x24, "Path5"], [0x25, "Path6"], [0x26, "Path7"], [0x27, "Roof1"],
  [0x28, "Roof2"], [0x29, "CrystalBall"], [0x2a, "LighthouseLight"], [0x2b, "DeadTree"],
];

describe("#137 · (B)oard se ramifica sobre la CAPA DE OBJETOS", () => {
  it("★ los 12 tiles de TERRENO que colisionan con un byte de vehículo dan «What?»", () => {
    // `find_object_at_xy` devuelve 0 cuando no hay objeto (0x36f3 `sub ax,ax`), y con
    // AL=0 el despacho cae al default 0x0954 → DS 0x42bf.
    for (const [tile, name] of COLISIONES) {
      const g = makeGame(tile);
      expect(msgs(g), `terreno 0x${tile.toString(16)} ${name}`).toEqual(["What?"]);
      expect(g.state.transportTile, `terreno 0x${tile.toString(16)} ${name}`).toBeUndefined();
    }
  });

  it("CONTROL POSITIVO del negativo de arriba: el MISMO arnés SÍ aborda por el banco alto", () => {
    // Sin este control, «los 12 dan What?» sería verde con un `board()` que no abordase
    // nunca (control degenerado). Aquí se ejerce cada byte de vehículo en su banco real.
    const casos: [number, string, number][] = [
      [0x10, "horse", 0x12], // HorseRight  → montado 0x12 (byte + 2, CMDS 0x0873)
      [0x11, "horse", 0x13], // HorseLeft   → montado 0x13
      [0x1b, "carpet", 0x14], // Carpet2    → 0x14 fijo (CMDS 0x0890)
      // ⚠ Estas dos filas decían 0x2a/0x2d «byte + 2 (CMDS 0x08b5 → 0x0875)» — la cita
      // probaba lo CONTRARIO de la cifra: el `jmp 0x0875` de 0x08B5 aterriza DESPUÉS del
      // `add al,2` de 0x0873 (exclusivo del caballo). El esquife se monta TAL CUAL, con
      // su facing; con el +2, 0x2b daba 0x2d = fuera de la clase esquife (#273 adyacente).
      [0x28, "skiff", 0x28], // SkiffUp → byte TAL CUAL (CMDS 0x08b2 + jmp 0x0875)
      [0x2b, "skiff", 0x2b],
    ];
    for (const [byte, texto, esperado] of casos) {
      const g = makeGame();
      g.setMapOverride(PX, PY, byte + ACTOR_BANK);
      expect(msgs(g), `objeto 0x${byte.toString(16)}`).toContain(texto);
      expect(g.state.transportTile, `objeto 0x${byte.toString(16)}`).toBe(esperado);
    }
  });

  it("la nave ATRACADA (worldObject) sigue abordándose y conserva casco/skiffs", () => {
    const g = makeGame();
    g.state.worldObjects = [
      { location: PAWS, floor: 0, x: PX, y: PY, tile: 0x25 + ACTOR_BANK, kind: "ship", hull: 40, skiffs: 1 },
    ];
    const texts = msgs(g);
    expect(texts).toContain("Ship");
    expect(texts).not.toContain("WARNING: NO SKIFFS ON BOARD!"); // skiffs=1 del OBJETO
    expect(g.state.transportTile).toBe(0x25);
    expect(g.state.shipHull).toBe(40);
  });

  it("★ abordar BORRA el vehículo del mundo — los DOS canales (kernel 0x3A74 con 6 ceros)", () => {
    // 0x093e-0x0949: `write_object_record(idx, 0,0,0,0,0,0)` pone a cero tile/x/y/piso/casco
    // del registro. No es una rama de la fragata: el caballo (0x0878) y la alfombra (0x0895)
    // saltan al MISMO epílogo 0x093e. ⇒ la casilla deja de ser abordable.
    const caballo = makeGame();
    caballo.setMapOverride(PX, PY, 0x10 + ACTOR_BANK);
    expect(msgs(caballo)).toContain("horse");
    expect(overrideAt(caballo, PX, PY), "el caballo abordado desaparece del mundo").toBeUndefined();

    const nave = makeGame();
    nave.state.worldObjects = [
      { location: PAWS, floor: 0, x: PX, y: PY, tile: 0x25 + ACTOR_BANK, kind: "ship", hull: 99, skiffs: 1 },
    ];
    expect(msgs(nave)).toContain("Ship");
    expect(nave.state.worldObjects).toHaveLength(0);
  });

  it("el borrado va gateado por «el override ES el tile leído», no por «hay override»", () => {
    // CONTROL DISCRIMINANTE del `delete`. Un override VECINO no discrimina nada (un borrado
    // ciego de la celda del party tampoco lo tocaría). La única geometría en que las dos
    // reglas difieren es que el vehículo se lea de una capa MÁS ALTA que `mapOverrides`:
    // `activeMap.tileAt` resuelve `volatileTerrain ?? mapOverrides ?? base` (#119), así que
    // aquí se aborda el caballo del búfer volátil mientras debajo hay un override persistido
    // de un (G)et. Un `delete` sin gate se llevaría la hierba y dejaría el caballo.
    const g = makeGame();
    g.setMapOverride(PX, PY, 0x04); // hierba persistida por un (G)et
    g.setVolatileTerrain(PX, PY, 0x10 + ACTOR_BANK); // y el caballo por encima
    expect(msgs(g)).toContain("horse");
    expect(overrideAt(g, PX, PY), "el override de debajo sobrevive").toBe(0x04);
  });
});
