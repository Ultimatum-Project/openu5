/**
 * #282 — LA NAVE NO ENTRA EN LA CASILLA DEL REMOLINO.
 *
 * Derivación (MAINOUT, `re/notes/remolino-282-acta.md`): `ship_try_move` (0x01FE) es EL
 * resolvedor de destino de todo paso al aire libre — su único llamador, `outdoor_move`,
 * lo invoca INCONDICIONALMENTE (las cuatro ramas de dirección convergen en 0x050e y
 * llaman en 0x0514). Dentro, el binario lee el ACTOR del destino ANTES que el terreno
 * (`find_object_at_xy`, 0x0236) y, si no es abordable, fuerza `[bp-2]=0` (0x0240): el
 * paso falla aunque el terreno sea navegable. La cola de bloqueo (0x0312-0x0347) tiene UNA
 * salida muda, y es la del remolino: 0x0319-0x0320 salta al epílogo por delante del print
 * y del beep. Habla el remolino en SU turno (0x1248), no el intento de paso.
 *
 * El defecto que cierra esta ficha vivía en el LLAMADOR del port: `resolveNavalStep`
 * cortocircuitaba con `isPassable` y no llegaba a `shipTryMove`. Un remolino se posa
 * sobre agua profunda —navegable—, así que la nave le entraba en la casilla y el tick
 * siguiente la succionaba al Underworld: en 1988 eso NO se puede provocar andando contra
 * el remolino. Por eso el testigo de §2 mide el evento `moved` del JUEGO VIVO y no sólo
 * la función pura: probar únicamente `shipTryMove` habría pasado con el bug intacto.
 */
import { describe, expect, it } from "vitest";
import {
  shipTryMove,
  isBoardableActorTile,
  WHIRLPOOL_ACTOR_GROUP,
} from "../src/core/world/transport.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import type { OverworldEnemy } from "../src/core/world/enemies.js";

// --- fixture mínimo (mismo idioma que naval-live.test.ts) ---------------------
function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    ...over,
  } as GameState;
}
/** Sobremundo 256×256 de AGUA PROFUNDA (tile 1): navegable para la fragata. */
function waterWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(1));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationNames: [], locationsY: [] };
function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, waterWorld(), gameData, s, {});
}
/** Remolino: sprite 0x1EC (`EnemyDef.index` 43 → tile 0x1EC), agua, slot fijo. */
function whirlpoolAt(x: number, y: number): OverworldEnemy {
  return { defIndex: 43, tile: 0x1ec, water: true, x, y, slot: 1, phase: 0 } as OverworldEnemy;
}

describe("#282 §1 — isBoardableActorTile (MAINOUT 0x0245-0x0283)", () => {
  it("A PIE (t<0x20) aborda fragata, esquife, caballo y alfombra — y NADA más", () => {
    // Esperados EN CRUDO: los rangos son los del binario, no derivados del sujeto.
    expect(isBoardableActorTile(0x24, 0x1c)).toBe(true); // fragata (0x24 ≤ a < 0x2c)
    expect(isBoardableActorTile(0x2b, 0x1c)).toBe(true); // último de la ventana
    expect(isBoardableActorTile(0x2c, 0x1c)).toBe(false); // 0x2c YA fuera (nave pirata)
    expect(isBoardableActorTile(0x1b, 0x1c)).toBe(true); // caballo
    expect(isBoardableActorTile(0x10, 0x1c)).toBe(true); // alfombra (a & 0xFE == 0x10)
    expect(isBoardableActorTile(0x11, 0x1c)).toBe(true);
    expect(isBoardableActorTile(0xec, 0x1c)).toBe(false); // remolino: nunca abordable
  });

  it("desde FRAGATA (0x20 ≤ t < 0x28) NO se aborda nada — 0x0270 `jb 0x288`", () => {
    expect(isBoardableActorTile(0x24, 0x24)).toBe(false);
    expect(isBoardableActorTile(0x1b, 0x24)).toBe(false);
    expect(isBoardableActorTile(0x10, 0x20)).toBe(false);
  });

  it("desde ESQUIFE (0x28 ≤ t < 0x30) sólo se aborda la FRAGATA 0x24..0x27", () => {
    expect(isBoardableActorTile(0x24, 0x28)).toBe(true);
    expect(isBoardableActorTile(0x27, 0x28)).toBe(true);
    expect(isBoardableActorTile(0x28, 0x28)).toBe(false); // otro esquife, no
    expect(isBoardableActorTile(0x1b, 0x28)).toBe(false); // caballo, no
  });

  it("enmascara el tile de 9 bits del port (0x100 | sprite) a byte", () => {
    expect(isBoardableActorTile(0x124, 0x28)).toBe(true); // 0x124 → 0x24
    expect(isBoardableActorTile(0x1ec, 0x24)).toBe(false); // 0x1ec → 0xec
  });
});

describe("#282 §2 — shipTryMove con actor en el destino", () => {
  const noRand = () => {
    throw new Error("el camino MUDO del remolino no puede tirar RNG (MAINOUT 0x0319-0x0320)");
  };

  it("REMANDO contra un remolino: salida MUDA, sin mensajes, sin avanzar, sin daño", () => {
    const r = shipTryMove(1, 0x24, false, 99, noRand, 0x1ec);
    expect(r.outcome).toBe("blocked-silent");
    expect(r.messages).toEqual([]); // ni «Blocked!» (0x0322) ni beep (0x033c)
    expect(r.moves).toBe(false);
    expect(r.hullDamage).toBe(0);
    expect(r.sunk).toBe(false);
  });

  it("el grupo del remolino es &0xFC == 0xEC: 0x1ee también calla", () => {
    expect(WHIRLPOOL_ACTOR_GROUP).toBe(0xec);
    expect(shipTryMove(1, 0x24, false, 99, noRand, 0x1ee).outcome).toBe("blocked-silent");
  });

  it("otro actor NO abordable remando: «Blocked!» normal (no hereda el silencio)", () => {
    const r = shipTryMove(1, 0x24, false, 99, noRand, 0x12c); // nave pirata (0x2c)
    expect(r.outcome).toBe("blocked");
    expect(r.messages).toEqual(["Blocked!"]);
    expect(r.moves).toBe(false);
  });

  it("A PIE contra un remolino NO hay salida muda — el umbral de 0x0312 es t≥0x20", () => {
    const r = shipTryMove(1, 0x1c, false, 99, noRand, 0x1ec);
    expect(r.outcome).toBe("blocked");
    expect(r.messages).toEqual(["Blocked!"]);
  });

  it("NAVEGANDO contra un remolino: COLLISION! con daño de casco (0x02c0 → 0x02d8)", () => {
    const r = shipTryMove(1, 0x20, true, 99, () => 7, 0x1ec);
    expect(r.outcome).toBe("collision");
    expect(r.messages).toEqual(["COLLISION!"]);
    expect(r.hullDamage).toBe(7); // rand(1,30) de damage_ship 0x109E
  });

  it("un actor ABORDABLE no bloquea: el destino se resuelve por el TERRENO", () => {
    // Esquife hacia una fragata sobre agua profunda: no hay bloqueo por ocupación.
    const r = shipTryMove(1, 0x28, false, 99, noRand, 0x124);
    expect(r.outcome).toBe("blocked"); // agua profunda no es skiff-passable → cola normal
    expect(r.messages).toEqual(["Blocked!"]); // pero NO por el actor: es el terreno
  });

  it("sin actor (centinela 0) la conducta previa queda INTACTA", () => {
    expect(shipTryMove(0x47, 0x20, true, 99, noRand, 0).outcome).toBe("dock");
    expect(shipTryMove(0x2f, 0x24, false, 99, noRand, 0).messages).toEqual(["Blocked!", "OUCH!"]);
  });
});

describe("#282 §3 — el JUEGO VIVO: la nave ya no entra en la casilla", () => {
  it("empujar la fragata contra el remolino NO produce `moved` ni mueve la posición", () => {
    const st = makeState({ transport: "ship", transportTile: 0x24, sailDir: 0, shipHull: 99 });
    const g = makeGame(st);
    g.overworldEnemies.enemies.push(whirlpoolAt(100, 99)); // justo al NORTE

    const events = g.move("north");

    // El observable de la ficha: ANTES del fix el paso emitía `moved` y la party
    // aterrizaba en (100,99) — encima del remolino, que la succionaba en el tick.
    expect(events.some((e) => e.kind === "moved")).toBe(false);
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 100, y: 100 });
  });

  it("CONTROL POSITIVO: sin remolino delante, el MISMO paso sí avanza", () => {
    const st = makeState({ transport: "ship", transportTile: 0x24, sailDir: 0, shipHull: 99 });
    const g = makeGame(st); // sin enemigos

    const events = g.move("north");

    expect(events.some((e) => e.kind === "moved")).toBe(true);
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 100, y: 99 });
  });
});
