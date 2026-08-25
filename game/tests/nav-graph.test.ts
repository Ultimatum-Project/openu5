/**
 * Unit del GRAFO DE COMPONENTES multi-nivel (task #13, paso 1). PURO: alimenta el mapa
 * ESTÁTICO (smallmaps.json) al builder y asevera componentes/aristas + que `planRoute`
 * encuentra ruta a los casos que la nav de UN nivel NO resolvía:
 *   - Moonglow (loc 1): sanctums de planta 0 (Zachariah/Donn Piatt, diferidos de ch06) +
 *     sala aislada de planta 1 (Lord Stuart) → partición MULTI-NIVEL.
 *   - Jhelom (loc 3): torre NW de Goeth, STAIR-gated (tiles 196-199, no escalas Klimb).
 * NO usa Playwright: es la validación determinista de la infra antes del A/B e2e.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildLocationGraph,
  planRoute,
  componentAt,
  isStair,
  _resetGraphCache,
} from "../e2e/grandtour/nav-graph";

const MOONGLOW = 1;
const JHELOM = 3;

describe("nav-graph — builder de componentes", () => {
  beforeEach(() => _resetGraphCache());

  it("Moonglow (loc 1): 2 plantas, con escalas y celdas de NPC mapeadas", () => {
    const g = buildLocationGraph(MOONGLOW);
    expect(g.floors).toEqual([0, 1]);
    expect(g.edges.length).toBeGreaterThan(0);
    // Las 3 celdas objetivo de ch06 resuelven a un componente (transitables o adyacentes).
    for (const [x, y, f] of [
      [13, 17, 0], // Zachariah
      [15, 25, 0], // Donn Piatt
      [19, 24, 1], // Lord Stuart
    ] as const) {
      expect(componentAt(g, x, y, f), `celda (${x},${y},z${f}) sin componente`).not.toBeNull();
    }
  });

  it("Moonglow: planRoute recupera los sanctums de planta 0 y la sala z1 (lo que ch06 difirió)", () => {
    const g = buildLocationGraph(MOONGLOW);
    const entry = { x: 15, y: 30, floor: 0 }; // SMALL_MAP_ENTRY (game.ts) — entrada real
    // Waypoints AISLADOS (no directamente andables desde la entrada; el probe los vio así):
    const targets = {
      zachariah: { x: 13, y: 17, floor: 0 }, // sanctum z0 (seg0)
      lordStuart: { x: 19, y: 24, floor: 1 }, // sala z1 (seg0)
      donnPiattZ1: { x: 9, y: 24, floor: 1 }, // sanctum z1 de Donn Piatt (seg0)
    };
    for (const [name, t] of Object.entries(targets)) {
      const route = planRoute(g, entry, t);
      expect(route, `sin ruta a ${name} (${t.x},${t.y},z${t.floor})`).not.toBeNull();
      expect(route!.length, `${name} debería exigir ≥1 transición`).toBeGreaterThan(0);
    }
  });

  it("Jhelom (loc 3): el builder modela escaleras-de-pisar (stair edges) sobre las plantas dadas", () => {
    const g = buildLocationGraph(JHELOM);
    // Jhelom ES stair-gated: el builder produce aristas `stair` (no sólo Klimb). Prueba de
    // que el modelo de escaleras-de-pisar (196-199) funciona.
    expect(g.edges.some((e) => e.kind === "stair"), "Jhelom sin aristas stair").toBe(true);
    // Goeth (dn 15, esquina NW (1,1)/(2,2)/(3,2)) resuelve a un componente en las plantas dadas.
    expect(componentAt(g, 2, 2, 1), "Goeth (2,2,z1) sin componente").not.toBeNull();
  });

  it("Jhelom Goeth: alcanzable SÓLO con allowLocked (patio↔torres = puertas con llave 185/187)", () => {
    // DICTAMEN #18 (confirmado en frío): la extracción es CORRECTA (2 plantas, verificado
    // byte-a-byte vs TOWNE.DAT). El patio conecta con las torres de Goeth por PUERTAS CON
    // LLAVE (185 LockedDoor / 187 LockedDoorView) — aristas CONDICIONALES (Jimmy+llave) que
    // la regla base no cruza. Prueba: con allowLocked la entrada real (15,30,z0) SÍ llega a
    // Goeth; sin él, NO (sólo puertas regulares). No era piso ausente ni bug del solver.
    const g = buildLocationGraph(JHELOM);
    expect(g.floors).toEqual([0, 1]);
    expect(g.edges.some((e) => e.kind === "locked"), "Jhelom sin aristas locked").toBe(true);
    const entry = { x: 15, y: 30, floor: 0 };
    const goeth = { x: 2, y: 2, floor: 1 };
    // SIN allowLocked: inalcanzable (las locked no se cruzan).
    expect(planRoute(g, entry, goeth), "Goeth sin llave no debe ser alcanzable").toBeNull();
    // CON allowLocked: alcanzable, y la ruta CRUZA al menos una puerta con llave.
    const route = planRoute(g, entry, goeth, { allowLocked: true });
    expect(route, "Goeth con allowLocked debe ser alcanzable").not.toBeNull();
    expect(route!.some((e) => e.kind === "locked"), "la ruta a Goeth debe cruzar una locked door").toBe(true);
  });

  it("aristas descartadas se registran, no crashean (R-B: escalera a planta inexistente)", () => {
    const g = buildLocationGraph(JHELOM);
    // `discarded` es una lista (posiblemente vacía) de hallazgos honestos; nunca undefined.
    expect(Array.isArray(g.discarded)).toBe(true);
  });

  /**
   * BANCO «nav-graph Lycaeum» (carril bancos-residuales, 2026-07-25).
   *
   * Lycaeum (loc 30) tiene StairsN (196) en (14,11) y (16,11) TANTO en z0 como en z1 — el par
   * canónico z0↔z1. Pero el builder trataba TODA escalera como candidata a subir a `z+1`, así
   * que las de z1 generaban además un par de aristas z1↔z2. La de BAJADA (z2→z1) es FANTASMA:
   * `applyStairStep` (game.ts, TOWN 0x052E) lee el tile de la planta DONDE ESTÁ la party — y en
   * z2 (14,11) hay suelo llano (68), no una escalera ⇒ el paso NO transiciona, la party camina
   * sobre la casilla y se queda en z2. Un BFS que eligiera esa arista dejaba al ejecutor
   * creyéndose en z1 estando en z2.
   *
   * El defecto era del GRAFO, no del mapa ni del motor: el motor es FIEL (el binario no
   * comprueba la planta destino; confía en la geometría de muros — y en efecto la aproximación
   * de SUBIDA de esas dos, z1 (14,12)/(16,12), es muro 79). El mapa vivo tampoco diverge: el
   * motor carga el MISMO `assets/maps/smallmaps.json` (main.ts:201) y los únicos overrides de
   * runtime son reja/puente por hora (townHourTiles: 0x44↔0x99 y 0x48/0x49→0x03), que jamás
   * tocan tiles de escalera.
   */
  it("Lycaeum (loc 30): NO existe arista de bajada z2→z1 por las escaleras de (14,11)/(16,11)", () => {
    const g = buildLocationGraph(30);
    expect(g.floors).toEqual([0, 1, 2]);
    for (const x of [14, 16]) {
      const fantasma = g.edges.filter(
        (e) => e.kind === "stair" && e.x === x && e.y === 11 && e.from.floor === 2 && e.to.floor === 1,
      );
      expect(fantasma, `arista FANTASMA z2→z1 en (${x},11) sigue en el grafo`).toHaveLength(0);
      // El par canónico z0↔z1 de esa MISMA columna sigue intacto (no se ha barrido de más).
      expect(
        g.edges.some((e) => e.kind === "stair" && e.x === x && e.y === 11 && e.from.floor === 1 && e.to.floor === 0),
        `se perdió la bajada REAL z1→z0 en (${x},11)`,
      ).toBe(true);
      expect(
        g.edges.some((e) => e.kind === "stair" && e.x === x && e.y === 11 && e.from.floor === 0 && e.to.floor === 1),
        `se perdió la subida REAL z0→z1 en (${x},11)`,
      ).toBe(true);
    }
    // Y queda registrado como hallazgo honesto, no borrado en silencio.
    expect(g.discarded.some((d) => d.includes("BAJADA FANTASMA"))).toBe(true);
  });

  it("Lycaeum: las 3 plantas siguen conectadas (el barrido no aisló z2)", () => {
    const g = buildLocationGraph(30);
    const entry = { x: 15, y: 30, floor: 0 };
    // Las escalas Klimb (9,14)/(21,14) son la vía REAL a z2 y deben seguir dando ruta.
    for (const t of [
      { x: 9, y: 14, floor: 2 },
      { x: 21, y: 14, floor: 2 },
    ]) {
      expect(planRoute(g, entry, t), `sin ruta a z2 (${t.x},${t.y})`).not.toBeNull();
    }
  });

  it("la subida cuya aproximación es MURO no genera arista (geometría de muros del original)", () => {
    const g = buildLocationGraph(30);
    // z1 (14,11): para subir habría que pisar desde (14,12), que es muro (79) → inejecutable.
    expect(
      g.edges.some((e) => e.kind === "stair" && e.x === 14 && e.y === 11 && e.from.floor === 1 && e.to.floor === 2),
    ).toBe(false);
    expect(g.discarded.some((d) => d.includes("aproximación de SUBIDA"))).toBe(true);
  });

  it("semántica de tiles: 196-199 son stairs; el builder cachea por location", () => {
    expect([196, 197, 198, 199].every(isStair)).toBe(true);
    expect(isStair(200)).toBe(false);
    const a = buildLocationGraph(MOONGLOW);
    const b = buildLocationGraph(MOONGLOW);
    expect(a).toBe(b); // misma instancia = caché
  });
});
