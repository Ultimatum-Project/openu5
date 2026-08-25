import { describe, expect, it } from "vitest";
import {
  MIRROR_AVATAR_TILE,
  MIRROR_TILE,
  REFLECTING_SPRITE_BANDS,
  paintsMirrorAvatar,
  reflectsInMirror,
} from "../src/render/mirror-reflection.js";
import { TILE_INFO } from "../src/core/tiles.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describeSiViaja } from "./assets-opcionales.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { VIEW_HALF, VIEW_WINDOW } from "../src/skin/api.js";

/**
 * GUARDA DEL REFLEJO (#199). El defecto que cierra era MUDO en toda instrumentación: el
 * port no tenía ni un consumidor de `MirrorAvatar`, así que ningún test podía ponerse rojo
 * — el usuario lo vio jugando. Esta guarda re-deriva los dos tiles por NOMBRE en cada
 * corrida y instancia las tres condiciones del binario POR SEPARADO, cada una con el
 * mutante que la mataría.
 */
describe("reflejo en el espejo — el par de tiles y la puerta de sprites", () => {
  it("los dos tiles se re-derivan por NOMBRE y son el par contiguo 0x9d/0x9e", () => {
    expect(MIRROR_TILE).toBe(0x9d);
    expect(MIRROR_AVATAR_TILE).toBe(0x9e);
    expect(TILE_INFO[MIRROR_TILE]!.name).toBe("Mirror");
    expect(TILE_INFO[MIRROR_AVATAR_TILE]!.name).toBe("MirrorAvatar");
    // El espejo NO es caminable: nadie puede plantarse EN la celda del reflejo y taparlo.
    // Es lo que permite pintar sobre `window` (capa única) sin perder el reflejo.
    expect(TILE_INFO[MIRROR_TILE]!.walkable).toBe(false);
  });

  it("la puerta de 0x51bf: refleja LA FIGURA ERGUIDA, no el vehículo ni la pose", () => {
    // Pasan (transcritos de los `cmp` uno a uno).
    for (const s of [0x11c, 0x112, 0x115, 0x128, 0x12b, 0x140, 0x17c, 0x1ff]) {
      expect(reflectsInMirror(s)).toBe(true);
    }
    // No pasan: objetos, caballo SIN jinete, barcos, piratas, y las poses de sentado
    // y tumbado — sentarse en la silla de delante del espejo APAGA el reflejo.
    for (const s of [0x101, 0x10f, 0x110, 0x111, 0x11a, 0x11d, 0x120, 0x127, 0x12c, 0x12f]) {
      expect(reflectsInMirror(s)).toBe(false);
    }
    for (let s = 0x130; s <= 0x13f; s++) expect(reflectsInMirror(s)).toBe(false);
  });

  it("🔴 NEGATIVO MEDIDO: el Shadowlord SÍ se refleja — no hay excepción de trama", () => {
    // La ficha #199 daba por hecha una excepción («los Shadowlords no se reflejan»). Los
    // cuatro sprites del Shadowlord tienen byte bajo 0xfc-0xff y caen en el `jge 0x40` que
    // PASA. Si alguien «arregla» el port añadiendo la excepción, esto se pone rojo.
    for (let s = 0x1fc; s <= 0x1ff; s++) {
      expect(TILE_INFO[s]!.name).toMatch(/^ShadowLord/);
      expect(reflectsInMirror(s)).toBe(true);
    }
    // Lo que sí queda fuera es la APARICIÓN, por caer en la banda rechazada 0x116-0x127.
    expect(TILE_INFO[0x11d]!.name).toBe("Apparition");
    expect(reflectsInMirror(0x11d)).toBe(false);
  });

  it("los tiles de TERRENO (banco bajo) nunca pasan: la puerta es de SPRITES", () => {
    for (const t of [-1, 0, 0x1c, 0x40, 0x9d, 0x9e, 0xff, 0x200, 999]) {
      expect(reflectsInMirror(t)).toBe(false);
    }
  });
});

describe("reflejo en el espejo — las TRES condiciones, una a una", () => {
  const AVATAR = 0x11c;

  it("caso del reporte: Avatar en la fila de DEBAJO del espejo ⇒ pinta", () => {
    expect(paintsMirrorAvatar(AVATAR, 5, MIRROR_TILE)).toBe(true);
  });

  it("MUTANTE 1 — sin el test del vecino: cualquier terreno al norte dispararía", () => {
    // `5339: cmp byte ptr [bx], 0x9d`. Se instancia con un vecino que NO es espejo: si
    // alguien borra esa condición, este aserto pasa de false a true.
    expect(paintsMirrorAvatar(AVATAR, 5, 68 /* BrickFloor */)).toBe(false);
    expect(paintsMirrorAvatar(AVATAR, 5, MIRROR_AVATAR_TILE)).toBe(false); // ya reflejado
    expect(paintsMirrorAvatar(AVATAR, 5, 0x9f /* MirrorBroken */)).toBe(false);
  });

  it("MUTANTE 2 — sin la guarda de fila 0 se escribiría FUERA de la ventana", () => {
    // `533e: cmp word ptr [bp+0xa], 0 / je`. Con el actor en la fila 0 no hay fila al
    // norte: el índice `(row-1)*11+col` saldría negativo.
    expect(paintsMirrorAvatar(AVATAR, 0, MIRROR_TILE)).toBe(false);
    expect(paintsMirrorAvatar(AVATAR, 1, MIRROR_TILE)).toBe(true); // la fila 1 SÍ vale
  });

  it("MUTANTE 3 — sin la puerta de sprites, un barco amarrado reflejaría figura", () => {
    // `51bf`. Mismo sitio, misma vecindad, sólo cambia el sprite.
    expect(paintsMirrorAvatar(0x120 /* ShipSailsUp */, 5, MIRROR_TILE)).toBe(false);
    expect(paintsMirrorAvatar(0x130 /* SitChairUp */, 5, MIRROR_TILE)).toBe(false);
    expect(paintsMirrorAvatar(AVATAR, 5, MIRROR_TILE)).toBe(true);
  });

  it("las bandas declaradas son CUATRO y ninguna está vacía ni solapa a la siguiente", () => {
    expect(REFLECTING_SPRITE_BANDS.length).toBe(4);
    let prevHi = -1;
    for (const [lo, hi] of REFLECTING_SPRITE_BANDS) {
      expect(lo).toBeLessThanOrEqual(hi);
      expect(lo).toBeGreaterThan(prevHi); // ordenadas y disjuntas
      prevHi = hi;
    }
    expect(prevHi).toBe(0xff);
  });
});

/**
 * 🔴 GUARDA DEL CABLEADO. Las de arriba son del PREDICADO: si alguien borra las llamadas a
 * `reflectInMirror` de `coreview.bakeMapWindow`, el predicado sigue perfecto y verde y el
 * espejo vuelve a estar muerto — exactamente el estado que reportó el usuario. Esta sección
 * mira el SNAPSHOT que consumen las pieles (clase #133: tener test ≠ estar vigilado).
 */
describe("reflejo en el espejo — CABLEADO en el snapshot que ven las pieles", () => {
  const LOC = 0x16; // Paws
  const PX = 10;
  const PY = 10;

  /** Pueblo 32×32 de suelo de ladrillo con el tile `north` justo encima del party. */
  function world(north: number, dosAlNorte = 68): WorldData {
    const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 68));
    tiles[PY - 1]![PX] = north;
    tiles[PY - 2]![PX] = dosAlNorte;
    const town: SmallMapLocation = { id: LOC, name: "Paws", floors: [{ z: 0, tiles }] };
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    return { overworld, underworld: overworld, smallMaps: new Map([[LOC, town]]) };
  }

  function makeGame(north: number, dosAlNorte = 68): Game {
    const char: CharacterState = {
      name: "Avatar", gender: 0x0b, class: "A", status: "G",
      strength: 20, dexterity: 20, intelligence: 20,
      currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
      helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
      partyStatus: 0,
    };
    const state = {
      characters: [char], partySize: 1, activeCharacter: 0,
      food: 100, gold: 10, karma: 50,
      time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
      turnsSinceStart: 0,
      position: { location: LOC, floor: 0, x: PX, y: PY },
      transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
    } as unknown as GameState;
    const gameData: GameData = {
      locationsX: Array.from({ length: 32 }, () => 250),
      locationsY: Array.from({ length: 32 }, () => 250),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    };
    return new Game({} as ExtractedInitialState, world(north, dosAlNorte), gameData, state);
  }

  /** Índice de la celda del NORTE del party dentro de la ventana 11×11. */
  const NORTE = (VIEW_HALF - 1) * VIEW_WINDOW + VIEW_HALF;

  it("Avatar bajo un espejo ⇒ la celda del espejo llega como MirrorAvatar a las DOS capas", () => {
    const snap = new CoreViewImpl(makeGame(MIRROR_TILE)).snapshot();
    expect(snap.window[NORTE]).toBe(MIRROR_AVATAR_TILE); // piel fiel
    expect(snap.terrainWindow?.[NORTE]).toBe(MIRROR_AVATAR_TILE); // base del shader
  });

  it("CONTROL: sin espejo al norte la celda llega INTACTA (el fix no pinta de más)", () => {
    const snap = new CoreViewImpl(makeGame(68 /* BrickFloor */)).snapshot();
    expect(snap.window[NORTE]).toBe(68);
    expect(snap.terrainWindow?.[NORTE]).toBe(68);
  });

  it("CONTROL: un espejo que NO toca al party se queda vacío (el disparo es la VECINDAD)", () => {
    // El mismo mapa, pero el espejo dos filas más arriba: nadie está justo debajo.
    const snap = new CoreViewImpl(makeGame(68, MIRROR_TILE)).snapshot();
    expect(snap.window[(VIEW_HALF - 2) * VIEW_WINDOW + VIEW_HALF]).toBe(MIRROR_TILE);
  });
});

// 🔴 `game/assets/` NO viaja al repositorio público (son datos EXTRAÍDOS del binario de
// EA). Un `import smallmaps from "../assets/maps/smallmaps.json"` ESTÁTICO —que es lo que
// había aquí— rompe `npx tsc --noEmit` allí con un TS2307, y con él el job typecheck del
// CI público: era el ÚNICO fichero del árbol que lo hacía (misma clase que el arreglo de
// `save-native-enemies.test.ts:30`). Lectura en RUNTIME + el bloque acotado con
// `describeSiViaja`, así que los otros 12 tests de este fichero —que no leen nada de
// `assets/`— siguen dentro de `test:pure` y corren en el repo público.
describeSiViaja(["game/assets/maps/smallmaps.json"], "reflejo en el espejo — alcanzabilidad en los DATOS del port", () => {
  it("los 14 espejos de pueblo tienen suelo CAMINABLE justo al sur (100% alcanzables)", () => {
    // La regla no es teórica: se dispara en todos los espejos que existen. Si un
    // re-extraído moviera un espejo contra una pared, esta cuenta lo diría.
    const maps = JSON.parse(
      readFileSync(fileURLToPath(new URL("../assets/maps/smallmaps.json", import.meta.url)), "utf8"),
    ) as { name: string; floors: { tiles: number[][] }[] }[];
    let total = 0;
    let conSueloAlSur = 0;
    for (const m of maps) {
      for (const fl of m.floors) {
        for (let y = 0; y < fl.tiles.length; y++) {
          for (let x = 0; x < fl.tiles[y]!.length; x++) {
            if (fl.tiles[y]![x] !== MIRROR_TILE) continue;
            total++;
            const sur = fl.tiles[y + 1]?.[x];
            if (sur !== undefined && TILE_INFO[sur]?.walkable) conSueloAlSur++;
          }
        }
      }
    }
    expect(total).toBe(14);
    expect(conSueloAlSur).toBe(14);
  });
});
