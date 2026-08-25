/**
 * #224 — las DOS colas de bloqueo, y que NO son la misma.
 *
 * DERIVACIÓN (acta completa en `re/notes/colas-224-acta.md`).
 *
 * EXTERIOR — `ship_try_move` MAINOUT.OVL 0x01fe, cola 0x0312-0x0347:
 *   0322  print DS 0x29ae = b'Blocked!\n'      ← SIEMPRE
 *   0329  cmp word ptr [bp-6], 0x2f            ← ¿TILE DESTINO cactus?
 *   032f    sí → print DS 0x29b8 = b'OUCH!\n' + call 0xffffa8d8 (rand(1,8)/miembro)
 *   033c    no → call 0xffffa0f0 = beep(0xa5, 0xc8)
 *
 * PUEBLO — `town_move` TOWN.OVL 0x0600, cola 0x083a-0x084c, ENTERA:
 *   083a  print DS 0x26d6 = b'Blocked!\n'
 *   0841  push 0xa5 / push 0xc8
 *   0849  call 0xffffa0f0 = beep(0xa5, 0xc8)   ← SIEMPRE, cactus o no
 *   084c  call 0xffff9946                      ← la misma cola común que MAINOUT
 *
 * ⇒ **En pueblo NO hay `cmp …,0x2f`**, ni la salida silenciosa 0xEC de MAINOUT 0x0317.
 * El port comparte `resolveStep` entre las dos capas, así que tras #157 disparaba
 * «OUCH!» + `partyRandomDamage` también en pueblo: divergencia por EXCESO. El gate va
 * en el PRODUCTOR (`resolveStep` devuelve `onCactus: false` en la rama de pueblo).
 *
 * Cadenas verificadas byte a byte en DATA.OVL (`fileoff = DS + 0x10`):
 *   DS 0x29ae → b'Blocked!\n'  ·  DS 0x29b8 → b'OUCH!\n'  ·  DS 0x26d6 → b'Blocked!\n'
 *
 * ALCANCE MEDIDO (por qué esto no es un arreglo a algo indisparable): el tile 0x2f sale
 * 16 veces en los 32 small maps y las 16 en SinVraal's Hut (id 15 = posición 14 de
 * `game/assets/maps/smallmaps.json`); un BFS de pisables desde la entrada estándar
 * (15,30) alcanza vecino ortogonal de LAS 16. El test `alcance real` de abajo lo vuelve
 * a medir contra el ASSET, no contra una fixture inventada.
 *
 * NAVAL: el beep del `else` 0x033c lo emite ahora también `resolveNavalStep` (outcome
 * "blocked"), que antes era MUDO. Lo que sigue sin cablear es el `noise_burst` del brazo
 * de VELA (MAINOUT 0x02f4), que es otra primitiva y no tiene cue en el catálogo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import { isPassable } from "../src/core/world/movement.js";
import { TILE_CACTUS, shipTryMove } from "../src/core/world/transport.js";

/**
 * LITERALES a propósito (misma cautela que `cactus-ouch.test.ts`): si el test dependiera
 * sólo de la constante importada, un código sin el fix podría fallar por `undefined` en
 * vez de por la aserción. `0x2f` sale del binario (`cmp word ptr [bp-6],0x2f`, MAINOUT
 * 0x0329); el candado de abajo impide que la duplicación derive en silencio.
 */
const CACTUS = 0x2f;
const GRASS = 5;
const MOUNTAIN = 0x0c; // intransitable NO-cactus: el control del `else` del beep
const TOWN_LOC = 15; // SinVraal's Hut — la ÚNICA location con cactus (censo del acta §3)
const PX = 15;
const PY = 30; // SMALL_MAP_ENTRY

function makeChar(name: string): CharacterState {
  return {
    name, gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  } as CharacterState;
}

/** Pueblo 32×32 de hierba con `blocker` al ESTE de la party. */
function makeTownWorld(blocker: number): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => GRASS));
  tiles[PY]![PX + 1] = blocker;
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => GRASS),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [TOWN_LOC, { id: TOWN_LOC, name: "SinVraals_Hut", floors: [{ z: 0, tiles }] }],
    ]),
  } as WorldData;
}

/** Overworld (wrap) de hierba con `blocker` al ESTE — la capa que SÍ tiene el test. */
function makeOutdoorWorld(blocker: number): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => GRASS),
  );
  overworld[PY]![PX + 1] = blocker;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, () => 250),
  locationsY: Array.from({ length: 41 }, () => 250),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
};

function makeState(location: number): GameState {
  return {
    characters: [makeChar("Avatar"), makeChar("Iolo")],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location, floor: 0, x: PX, y: PY },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 12,
  } as GameState;
}

function makeTownGame(blocker: number): Game {
  return new Game({} as never, makeTownWorld(blocker), gameData, makeState(TOWN_LOC));
}
function makeOutdoorGame(blocker: number): Game {
  return new Game({} as never, makeOutdoorWorld(blocker), gameData, makeState(0));
}

type Ev = { kind: string; text?: string; sfx?: { id: string } };
const texts = (ev: readonly Ev[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
const sfxIds = (ev: readonly Ev[]): string[] =>
  ev.filter((e) => e.kind === "sfx").map((e) => e.sfx?.id ?? "");

describe("#224 — cola de PUEBLO (TOWN 0x083a): «Blocked!» + beep, SIN test de cactus", () => {
  it("candado: la constante exportada ES el 0x2f del binario", () => {
    expect(TILE_CACTUS).toBe(CACTUS);
  });

  it("PRECONDICIÓN: la fixture NO es degenerada — party en small map y cactus REAL al este", () => {
    const game = makeTownGame(CACTUS);
    // Si esto se rompe, los asertos de abajo pasarían por el motivo equivocado.
    expect(game.activeMap.kind).toBe("small");
    expect(game.activeMap.wraps).toBe(false);
    expect(game.activeMap.tileAt(PX + 1, PY)).toBe(CACTUS);
  });

  it("★ el cactus en PUEBLO NO imprime OUCH! (TOWN 0x083a no tiene `cmp …,0x2f`)", () => {
    const game = makeTownGame(CACTUS);
    const msgs = texts(game.move("east") as Ev[]);
    expect(msgs).toContain("Blocked!");
    expect(msgs).not.toContain("OUCH!");
  });

  it("★ el cactus en PUEBLO SÍ beepea (TOWN 0x0849 es incondicional)", () => {
    const game = makeTownGame(CACTUS);
    expect(sfxIds(game.move("east") as Ev[])).toContain("move-blocked");
  });

  it("★ el cactus en PUEBLO NO pincha al party (no hay call a 0xffffa8d8 en TOWN)", () => {
    const game = makeTownGame(CACTUS);
    const before = game.state.characters.slice(0, 2).map((c) => c.currentHp);
    game.move("east");
    const after = game.state.characters.slice(0, 2).map((c) => c.currentHp);
    expect(after).toEqual(before);
  });

  it("la party NO se mueve: el cactus sigue siendo intransitable en pueblo", () => {
    const game = makeTownGame(CACTUS);
    game.move("east");
    expect(game.state.position.x).toBe(PX);
  });

  it("CONTROL de UNIFORMIDAD: contra MONTAÑA el pueblo hace exactamente lo mismo", () => {
    const cactus = makeTownGame(CACTUS).move("east") as Ev[];
    const montana = makeTownGame(MOUNTAIN).move("east") as Ev[];
    // La cola de pueblo es ciega al tipo de obstáculo: mismos mensajes y mismos cues.
    expect(texts(cactus)).toEqual(texts(montana));
    expect(sfxIds(cactus)).toEqual(sfxIds(montana));
  });
});

describe("#224 — la cola de EXTERIOR conserva la bifurcación de #157 (no-regresión)", () => {
  it("CONTROL de CAPA: el MISMO cactus en overworld SÍ da OUCH! y NO beepea", () => {
    const game = makeOutdoorGame(CACTUS);
    const ev = game.move("east") as Ev[];
    // Mismo tile, misma dirección, misma party: lo único que cambia es la CAPA.
    expect(texts(ev)).toContain("Blocked!");
    expect(texts(ev)).toContain("OUCH!");
    expect(sfxIds(ev)).not.toContain("move-blocked");
  });

  it("CONTROL: y sigue pinchando al party en exterior (rand(1,8) por miembro vivo)", () => {
    const game = makeOutdoorGame(CACTUS);
    const before = game.state.characters[0]!.currentHp;
    game.move("east");
    const lost = before - game.state.characters[0]!.currentHp;
    expect(lost).toBeGreaterThanOrEqual(1);
    expect(lost).toBeLessThanOrEqual(8);
  });

  it("CONTROL: montaña en exterior = Blocked! + beep, sin OUCH ni daño", () => {
    const game = makeOutdoorGame(MOUNTAIN);
    const before = game.state.characters[0]!.currentHp;
    const ev = game.move("east") as Ev[];
    expect(texts(ev)).toContain("Blocked!");
    expect(texts(ev)).not.toContain("OUCH!");
    expect(sfxIds(ev)).toContain("move-blocked");
    expect(game.state.characters[0]!.currentHp).toBe(before);
  });
});

describe("#224 — el BEEP naval del `else` MAINOUT 0x033c", () => {
  /**
   * Fragata ARRIADA **mirando al ESTE** = `(0x24 & 0xfc) + TURN_ARG.east` = **0x25**
   * (MAINOUT 0x015C/0x0163 `nuevo = (tile&0xFC) + turn_arg`, con la tabla de MAINOUT
   * 0x04D3: N→0, **E→1**, S→2, O→3).
   * ⚠ NO confundir `TURN_ARG` con su vecina `SAIL_DIR` (g_sail_dir del kernel:
   * 1=O, 2=E, 3=N, 4=S) — son DOS tablas adyacentes con la misma pinta y distinto
   * orden, y leer la segunda da 0x26, que mira al SUR. Este test lo cazó en vivo:
   * con 0x26 el primer pulsado se lo comía el VIRAJE (`outdoor_move` aborta el paso
   * con «Head East») y el test medía el giro en vez del bloqueo — fixture degenerada.
   * Con 0x25 el paso se intenta de verdad y la cola 0x0312 es alcanzable.
   */
  const FURLED = 0x25;

  it("shipTryMove devuelve outcome 'blocked' contra un obstáculo NO-cactus", () => {
    // Precondición del test de abajo: sin este outcome, el cue no tendría de qué colgar.
    expect(shipTryMove(MOUNTAIN, FURLED, false).outcome).toBe("blocked");
    expect(shipTryMove(CACTUS, FURLED, false).outcome).toBe("cactus");
  });

  it("★ el bloqueo naval EMITE el beep (antes era mudo: `resolveNavalStep` sin cue)", () => {
    const world = makeOutdoorWorld(MOUNTAIN);
    const st = makeState(0);
    st.transport = "ship";
    st.transportTile = FURLED;
    st.sailDir = 0;
    const game = new Game({} as never, world, gameData, st);
    const ev = game.move("east") as Ev[];
    expect(texts(ev)).toContain("Blocked!");
    expect(sfxIds(ev)).toContain("move-blocked");
  });

  it("★ y el cactus naval SIGUE sin beepear: son ramas EXCLUYENTES (0x0329 vs 0x033c)", () => {
    const world = makeOutdoorWorld(CACTUS);
    const st = makeState(0);
    st.transport = "ship";
    st.transportTile = FURLED;
    st.sailDir = 0;
    const game = new Game({} as never, world, gameData, st);
    const ev = game.move("east") as Ev[];
    expect(texts(ev)).toContain("OUCH!");
    expect(sfxIds(ev)).not.toContain("move-blocked");
  });
});

describe("#224 — ALCANCE, medido contra el ASSET (no contra una fixture inventada)", () => {
  const smallmaps = JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/maps/smallmaps.json", import.meta.url)), "utf8"),
  ) as { id: number; name: string; floors: { z: number; tiles: number[][] }[] }[];

  it("el cactus vive SÓLO en SinVraal's Hut, y son 16", () => {
    const porMapa = smallmaps.map((m) => ({
      id: m.id,
      name: m.name,
      n: m.floors.reduce(
        (a, f) => a + f.tiles.reduce((b, row) => b + row.filter((t) => t === CACTUS).length, 0),
        0,
      ),
    }));
    expect(porMapa.filter((m) => m.n > 0)).toEqual([
      { id: 15, name: "SinVraals_Hut", n: 16 },
    ]);
  });

  it("★ y las 16 son ALCANZABLES: BFS de pisables desde la entrada estándar (15,30)", () => {
    const mapa = smallmaps.find((m) => m.id === TOWN_LOC)!;
    const g = mapa.floors[0]!.tiles;
    // El instrumento NO re-implementa la pasabilidad: usa `isPassable`, el MISMO
    // predicado que `resolveStep` consulta en cada paso del juego.
    const pisable = (x: number, y: number): boolean =>
      x >= 0 && x < 32 && y >= 0 && y < 32 && isPassable(g[y]![x]!, "foot");
    const vecinos = (x: number, y: number): [number, number][] =>
      [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]] as [number, number][];

    const visto = new Set<string>([`${PX},${PY}`]);
    const cola: [number, number][] = [[PX, PY]];
    while (cola.length) {
      const [x, y] = cola.shift()!;
      for (const [nx, ny] of vecinos(x, y)) {
        const k = `${nx},${ny}`;
        if (visto.has(k) || !pisable(nx, ny)) continue;
        visto.add(k);
        cola.push([nx, ny]);
      }
    }

    const cactus: [number, number][] = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) if (g[y]![x] === CACTUS) cactus.push([x, y]);
    }
    expect(cactus).toHaveLength(16);
    const conVecinoAlcanzable = cactus.filter(([cx, cy]) =>
      vecinos(cx, cy).some(([nx, ny]) => visto.has(`${nx},${ny}`)),
    );
    expect(conVecinoAlcanzable).toHaveLength(16);

    // CONTROL DE SENSIBILIDAD del BFS: tiene que saber decir «no alcanzable». Una casilla
    // fuera del mapa nunca entra en `visto`, y el flood no cubre el mapa entero (hay
    // pisables tapiados), así que el conjunto NO es «todo».
    expect(visto.has("-1,-1")).toBe(false);
    expect(visto.size).toBeLessThan(32 * 32);
  });

  it("SinVraal's Hut NO tiene un solo tile navegable ⇒ naval×cactus×pueblo es INALCANZABLE", () => {
    // Por eso el fix naval NO lleva gate de capa: la combinación no existe en los datos.
    const g = smallmaps.find((m) => m.id === TOWN_LOC)!.floors[0]!.tiles;
    let navegables = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (isPassable(g[y]![x]!, "ship") || isPassable(g[y]![x]!, "skiff")) navegables++;
      }
    }
    expect(navegables).toBe(0);
    // CONTROL DE SENSIBILIDAD del predicado: `isPassable(_, "ship")` NO devuelve
    // siempre false — el agua profunda (0x00) sí es navegable. Sin esto, el cero de
    // arriba podría venir de un predicado muerto en vez de del mapa.
    expect(isPassable(0x00, "ship")).toBe(true);
  });
});
