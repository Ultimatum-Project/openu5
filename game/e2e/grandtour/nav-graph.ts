/**
 * Grand Tour — GRAFO DE COMPONENTES para navegación MULTI-NIVEL (task #13). Módulo PURO
 * (sin Playwright): modela la topología de transiciones de planta de una localización desde
 * el mapa ESTÁTICO `assets/maps/smallmaps.json` — el MISMO fichero que el motor carga como
 * `activeMap` (R-A: fichero y runtime no divergen en el mapa base; los overrides de runtime
 * —puertas, mapOverride— sólo AÑADEN conectividad y los cubre la misma regla `traversable`).
 *
 * NODO  = componente conexo (por transitabilidad de andar) de UNA planta de la localización.
 * ARISTA (dirigida) = una transición de planta con su MECANISMO:
 *   - `ladder` (tiles 200/201, LadderUp/Down): pisar la celda + (K)limb.
 *   - `stair`  (tiles 196-199, StairsN/E/S/W): CAMINAR sobre la celda en la dir que la
 *     orientación exige (`applyStairStep`, game.ts): sube si dir==orient, baja si dir==orient^2.
 *
 * Un BFS sobre este grafo da la RUTA de transiciones para `goToCell(x,y,floor)` — el MISMO
 * grafo resuelve stair-gate (1 arista) y partición multi-nivel (N aristas encadenadas).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TILE_DATA = JSON.parse(
  readFileSync(join(HERE, "..", "..", "src", "core", "data", "TileData.json"), "utf8"),
) as Record<string, { IsWalking_Passable?: boolean }>;
type SmallMap = { id: number; name: string; floors: Array<{ z: number; tiles: number[][] }> };
/**
 * ⚠ LECTURA PEREZOSA, y no es un capricho de estilo. `assets/` es material extraído de EA: NO
 * viaja al árbol público (`genesis-publico.sh`: `copy game --exclude assets/`). Mientras esta
 * lectura vivía en CARGA DE MÓDULO, *importar* este fichero —o cualquiera que lo arrastre, y
 * `e2e/grandtour/nav.ts` → `e2e/espejo-tour/runner.ts` lo arrastran— reventaba por ENOENT en el
 * público aunque el test no tocase un solo mapa. Esa cadena es la que mantenía a 14 ficheros de
 * `tests/` fuera del CI público vía la lista `exclude` de `vitest.pure.config.ts`.
 * Diferida al primer `buildLocationGraph`, el fichero se lee EXACTAMENTE IGUAL de eficaz (una
 * sola vez: se memoiza aquí, y el grafo por localización sigue cacheado en `graphCache`).
 * `TileData.json` se queda EAGER a propósito: vive en `src/core/data/`, que sí viaja.
 */
let smallmapsCache: SmallMap[] | null = null;
function smallmaps(): SmallMap[] {
  return (smallmapsCache ??= JSON.parse(
    readFileSync(join(HERE, "..", "..", "assets", "maps", "smallmaps.json"), "utf8"),
  ) as SmallMap[]);
}

/** Puertas REGULARES (se abren con (O)pen, sin llave ni hechizo). Misma regla que nav.ts/motor. */
export const REGULAR_DOORS = new Set([184, 186]);
/** ¿Se puede PISAR/atravesar el tile andando (o abriéndolo si es puerta regular)? */
export const traversable = (tile: number): boolean =>
  Boolean(TILE_DATA[String(tile)]?.IsWalking_Passable) || REGULAR_DOORS.has(tile);
export const isRegularDoor = (tile: number): boolean => REGULAR_DOORS.has(tile);

/** Tiles de escala de mano (Klimb): 200=sube (0xC8), 201=baja (0xC9). */
export const LADDER_UP = 200;
export const LADDER_DOWN = 201;
/** Escaleras-de-pisar: 0xC4-0xC7 (196-199) N/E/S/W; orient = tile-196. Transición al CAMINAR. */
export const STAIRS_BASE = 196;
/**
 * Puertas CON LLAVE (0xB9 LockedDoor, 0xBB LockedDoorView): NO transitables por la regla
 * base, pero abribles con (J)immy consumiendo llave+turno (game.ts:jimmy; DEX del activo
 * decide, puede romper llave). Son ARISTAS CONDICIONALES (misma planta): sólo se usan si el
 * capítulo declara `allowLocked`. Las cerraduras MÁGICAS (0x97/0x98) exigen HECHIZO, no
 * jimmy — fuera de este modelo por ahora.
 */
export const LOCKED_DOORS = new Set([185, 187]);
export const isLadder = (t: number): boolean => t === LADDER_UP || t === LADDER_DOWN;
export const isStair = (t: number): boolean => t >= STAIRS_BASE && t <= STAIRS_BASE + 3;
export const isLockedDoor = (t: number): boolean => LOCKED_DOORS.has(t);

export type NavDir = "up" | "down" | "left" | "right";
/** orient (0=N,1=E,2=S,3=W) → delta (dx,dy) y tecla de nav. Alineado con el motor. */
const ORIENT_DELTA: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const ORIENT_NAV: ReadonlyArray<NavDir> = ["up", "right", "down", "left"];

export interface CompId {
  floor: number;
  comp: number;
}
export type EdgeKind = "ladder" | "stair" | "locked";
export interface GraphEdge {
  kind: EdgeKind;
  from: CompId;
  to: CompId;
  /** Celda de la escala/escalera/puerta (destino de la transición). */
  x: number;
  y: number;
  /**
   * `ladder`: el ejecutor hace walkTo(x,y) + (K)limb.
   * `stair`:  walkTo(approach) + un paso en `stepDir` (dispara applyStairStep).
   * `locked`: walkTo(approach) + (J)immy hacia la puerta (llave+turno, DEX; reintenta si
   *           rompe llave) → la puerta pasa a regular y se cruza. MISMA planta.
   * `approach` es la celda ADYACENTE (en el componente `from`) desde la que se opera.
   */
  approach?: { x: number; y: number };
  stepDir?: NavDir;
}
export interface LocationGraph {
  location: number;
  floors: number[];
  /** "floor:comp" → conjunto de celdas "x,y" transitables del componente. */
  comps: Map<string, Set<string>>;
  /** "floor:x:y" → componente (sólo celdas transitables). */
  cellComp: Map<string, CompId>;
  edges: GraphEdge[];
  /** floor → rejilla de tiles (32×32). */
  grids: Map<number, number[][]>;
  /** Aristas descartadas (arista a planta inexistente, etc.) — hallazgo honesto (R-B). */
  discarded: string[];
}

const ck = (floor: number, x: number, y: number): string => `${floor}:${x}:${y}`;
const compKey = (id: CompId): string => `${id.floor}:${id.comp}`;

/** Flood-fill 4-conexo de los componentes transitables de una planta. */
function labelComponents(grid: number[][]): { label: number[][]; count: number } {
  const H = grid.length;
  const W = grid[0]!.length;
  const label: number[][] = Array.from({ length: H }, () => new Array<number>(W).fill(-1));
  let count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (label[y]![x] !== -1 || !traversable(grid[y]![x]!)) continue;
      // nuevo componente: BFS
      const id = count++;
      const stack: Array<[number, number]> = [[x, y]];
      label[y]![x] = id;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of ORIENT_DELTA) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (label[ny]![nx] !== -1 || !traversable(grid[ny]![nx]!)) continue;
          label[ny]![nx] = id;
          stack.push([nx, ny]);
        }
      }
    }
  }
  return { label, count };
}

const graphCache = new Map<number, LocationGraph>();

/**
 * Construye (o recupera de caché) el grafo de componentes de la localización `location`
 * desde `smallmaps.json`. La topología es ESTÁTICA por localización → cacheable.
 */
export function buildLocationGraph(location: number): LocationGraph {
  const cached = graphCache.get(location);
  if (cached) return cached;

  const map = smallmaps().find((m) => m.id === location);
  if (!map) throw new Error(`buildLocationGraph: sin smallmap para location ${location}`);

  const floors = map.floors.map((f) => f.z).sort((a, b) => a - b);
  const grids = new Map<number, number[][]>();
  const labels = new Map<number, number[][]>();
  const comps = new Map<string, Set<string>>();
  const cellComp = new Map<string, CompId>();

  for (const f of map.floors) {
    grids.set(f.z, f.tiles);
    const { label } = labelComponents(f.tiles);
    labels.set(f.z, label);
    for (let y = 0; y < f.tiles.length; y++) {
      for (let x = 0; x < f.tiles[0]!.length; x++) {
        const c = label[y]![x]!;
        if (c === -1) continue;
        const id: CompId = { floor: f.z, comp: c };
        cellComp.set(ck(f.z, x, y), id);
        const key = compKey(id);
        (comps.get(key) ?? comps.set(key, new Set()).get(key)!).add(`${x},${y}`);
      }
    }
  }

  const edges: GraphEdge[] = [];
  const discarded: string[] = [];
  const floorSet = new Set(floors);

  /** Tile de (f,x,y), o −1 fuera de rejilla/planta (para sondear aproximaciones sin romper). */
  const tileOr = (f: number, x: number, y: number): number => grids.get(f)?.[y]?.[x] ?? -1;

  const addBidirLadder = (fFrom: number, x: number, y: number): void => {
    const fTo = fFrom + 1;
    if (!floorSet.has(fTo)) {
      discarded.push(`ladder ${x},${y} floor ${fFrom}→${fTo}: planta destino inexistente`);
      return;
    }
    const upTile = grids.get(fTo)![y]![x]!;
    if (!traversable(upTile)) {
      discarded.push(`ladder ${x},${y} floor ${fFrom}→${fTo}: aterrizaje no transitable (${upTile})`);
      return;
    }
    const from = cellComp.get(ck(fFrom, x, y));
    const to = cellComp.get(ck(fTo, x, y));
    if (!from || !to) return;
    edges.push({ kind: "ladder", from, to, x, y });
    edges.push({ kind: "ladder", from: to, to: from, x, y });
  };

  const addStair = (fFrom: number, x: number, y: number, orient: number): void => {
    const fTo = fFrom + 1;
    if (!floorSet.has(fTo)) {
      // Sin planta superior: en el binario, pisar la escalera hacia arriba no hace nada.
      // No es un error — sólo no genera arista de subida desde esta planta.
      return;
    }
    const tileFrom = STAIRS_BASE + orient; // la escalera de fFrom (0xC4-0xC7)
    const landTile = grids.get(fTo)![y]![x]!;
    if (!traversable(landTile)) {
      discarded.push(`stair ${x},${y} floor ${fFrom}→${fTo}: aterrizaje no transitable (${landTile})`);
      return;
    }
    const from = cellComp.get(ck(fFrom, x, y));
    const to = cellComp.get(ck(fTo, x, y));
    if (!from || !to) return;
    const [ox, oy] = ORIENT_DELTA[orient]!;
    // SUBIR (fFrom→fTo): aproximar desde detrás (−orient) y pisar en +orient. La ÚNICA
    // celda desde la que un paso aterriza en (x,y) moviéndose en `orient` es (x−ox,y−oy):
    // si es MURO, la subida no se puede ejecutar jamás. No es un defecto de datos — es la
    // «geometría de muros» con la que el original impide aproximaciones sin salida (ver
    // game.ts applyStairStep, TOWN 0x052E: el binario NO comprueba la planta destino).
    if (traversable(tileOr(fFrom, x - ox, y - oy))) {
      edges.push({
        kind: "stair",
        from,
        to,
        x,
        y,
        approach: { x: x - ox, y: y - oy },
        stepDir: ORIENT_NAV[orient]!,
      });
    } else {
      discarded.push(`stair ${x},${y} floor ${fFrom}→${fTo}: aproximación de SUBIDA (${x - ox},${y - oy}) es muro`);
    }
    // BAJAR (fTo→fFrom): se ejecuta pisando (x,y) EN LA PLANTA fTo moviéndose en orient^2.
    // `applyStairStep` lee el tile de la planta DONDE ESTÁ la party (fTo) — así que la
    // bajada sólo dispara si fTo tiene TAMBIÉN una escalera en (x,y) con la MISMA
    // orientación (el par canónico). Si arriba hay suelo llano, el paso no transiciona:
    // la party camina sobre la casilla y se queda en fTo ⇒ ARISTA FANTASMA. Se descarta.
    const opp = orient ^ 2;
    const [px, py] = ORIENT_DELTA[opp]!;
    if (landTile !== tileFrom) {
      discarded.push(
        `stair ${x},${y} floor ${fTo}→${fFrom}: BAJADA FANTASMA — la planta ${fTo} no tiene la misma escalera (tile ${landTile}, se esperaba ${tileFrom}); pisarla no transiciona`,
      );
      return;
    }
    if (!traversable(tileOr(fTo, x - px, y - py))) {
      discarded.push(`stair ${x},${y} floor ${fTo}→${fFrom}: aproximación de BAJADA (${x - px},${y - py}) es muro`);
      return;
    }
    edges.push({
      kind: "stair",
      from: to,
      to: from,
      x,
      y,
      approach: { x: x - px, y: y - py },
      stepDir: ORIENT_NAV[opp]!,
    });
  };

  // Puerta con llave: arista CONDICIONAL (misma planta) entre los componentes que separa.
  const addLocked = (z: number, x: number, y: number): void => {
    const sides: Array<{ comp: CompId; cell: { x: number; y: number } }> = [];
    for (const [dx, dy] of ORIENT_DELTA) {
      const c = cellComp.get(ck(z, x + dx, y + dy));
      if (c) sides.push({ comp: c, cell: { x: x + dx, y: y + dy } });
    }
    for (let i = 0; i < sides.length; i++) {
      for (let j = i + 1; j < sides.length; j++) {
        if (compKey(sides[i]!.comp) === compKey(sides[j]!.comp)) continue;
        edges.push({ kind: "locked", from: sides[i]!.comp, to: sides[j]!.comp, x, y, approach: sides[i]!.cell });
        edges.push({ kind: "locked", from: sides[j]!.comp, to: sides[i]!.comp, x, y, approach: sides[j]!.cell });
      }
    }
  };

  for (const f of map.floors) {
    for (let y = 0; y < f.tiles.length; y++) {
      for (let x = 0; x < f.tiles[0]!.length; x++) {
        const t = f.tiles[y]![x]!;
        if (t === LADDER_UP) addBidirLadder(f.z, x, y);
        else if (isStair(t)) addStair(f.z, x, y, t - STAIRS_BASE);
        else if (isLockedDoor(t)) addLocked(f.z, x, y);
      }
    }
  }

  const graph: LocationGraph = { location, floors, comps, cellComp, edges, grids, discarded };
  graphCache.set(location, graph);
  return graph;
}

/** Componente que contiene la celda `(x,y,floor)`, o el de un vecino transitable (celda-objetivo no pisable). */
export function componentAt(graph: LocationGraph, x: number, y: number, floor: number): CompId | null {
  const direct = graph.cellComp.get(ck(floor, x, y));
  if (direct) return direct;
  for (const [dx, dy] of ORIENT_DELTA) {
    const n = graph.cellComp.get(ck(floor, x + dx, y + dy));
    if (n) return n;
  }
  return null;
}

/**
 * BFS sobre el grafo de componentes: ruta de aristas para llegar del componente que contiene
 * `from` al que contiene `to`. `null` si no hay ruta (destino en componente inalcanzable).
 * Camino feliz (mismo componente) → `[]`.
 */
export function planRoute(
  graph: LocationGraph,
  from: { x: number; y: number; floor: number },
  to: { x: number; y: number; floor: number },
  opts: { allowLocked?: boolean } = {},
): GraphEdge[] | null {
  const src = componentAt(graph, from.x, from.y, from.floor);
  const dst = componentAt(graph, to.x, to.y, to.floor);
  if (!src || !dst) return null;
  if (compKey(src) === compKey(dst)) return [];

  const adj = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    // Las puertas con llave son aristas CONDICIONALES: sólo si el capítulo las declara.
    if (e.kind === "locked" && !opts.allowLocked) continue;
    const k = compKey(e.from);
    (adj.get(k) ?? adj.set(k, []).get(k)!).push(e);
  }

  const prev = new Map<string, GraphEdge>();
  const seen = new Set<string>([compKey(src)]);
  let frontier: CompId[] = [src];
  while (frontier.length) {
    const next: CompId[] = [];
    for (const cur of frontier) {
      for (const e of adj.get(compKey(cur)) ?? []) {
        const tk = compKey(e.to);
        if (seen.has(tk)) continue;
        seen.add(tk);
        prev.set(tk, e);
        if (tk === compKey(dst)) {
          // reconstruye
          const route: GraphEdge[] = [];
          let k = tk;
          while (prev.has(k)) {
            const pe = prev.get(k)!;
            route.unshift(pe);
            k = compKey(pe.from);
          }
          return route;
        }
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return null;
}

/** Sólo para tests: vacía la caché de grafos entre casos. */
export function _resetGraphCache(): void {
  graphCache.clear();
}
