/**
 * F-6 — el resolvedor `auto` del espejo (`dungeonResolveRoomCombat`) SE ATASCA en el
 * encuentro de ORCS de `ad23-g26`. Ficha en `re/notes/fichas-f1f2-acta.md` §3.3/§4;
 * caracterización y adjudicación en `re/notes/resolvedor-f6-acta.md`.
 *
 * QUÉ SE CONDUCE. La función REAL del arnés contra un MUNDO DE MENTIRA: una mini-arena
 * que reproduce las tres reglas del motor que el atasco pone en juego, y sólo esas —
 *   (1) `playerMove` a celda no pisable/ocupada imprime «Blocked!» y **NO consume el
 *       turno** (combat.ts:1755, `advanceTurn` está DESPUÉS del early-return);
 *   (2) el cofre de botín por-muerte SUSTITUYE la pasabilidad de su celda (tile 1 = agua
 *       ⇒ impasable a pie, combat.ts:1204 `chestAt(x,y) ? 1 : tileAt(x,y)`) pero **NO
 *       aparece en `mapTiles`**, que sigue diciendo hierba;
 *   (3) limpiar el bando enemigo NO cierra el combate (COMBAT:0x0cf6 fall-through): la
 *       party sale ANDANDO por el borde.
 *
 * La geometría NO es inventada: tiles 11×11, celdas de los 8 combatientes y celda del
 * cofre salen del volcado EN VIVO de la ronda 25 de `ad23-g26` (corrida F6-diag sobre
 * main `9e19c56e`, sonda del acta §2). Por eso el rojo-primero es el atasco REAL y no
 * uno parecido.
 */
import { describe, it, expect } from "vitest";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dungeonResolveRoomCombat } from "../e2e/grandtour/nav";

const TILE_DATA = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/core/data/TileData.json", import.meta.url)), "utf8"),
) as Record<string, { IsWalking_Passable?: boolean }>;
const pisable = (t: number): boolean => Boolean(TILE_DATA[String(t)]?.IsWalking_Passable);

/** Rejilla VIVA de `ad23-g26` (volcado F6-diag, ronda 25). 5 = hierba; 12/13 = montañas
 *  (no pisables); 14/15 = colinas (pisables). */
const TILES_AD23_G26: number[][] = [
  [12, 13, 15, 14, 15, 5, 5, 5, 14, 12, 13],
  [12, 15, 5, 5, 5, 5, 5, 5, 5, 14, 12],
  [15, 5, 5, 5, 5, 5, 5, 14, 15, 5, 14],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 14, 15, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 14, 15, 5, 5, 5, 14, 15, 5, 5],
  [5, 14, 12, 12, 15, 5, 14, 12, 12, 15, 5],
  [14, 12, 12, 15, 5, 5, 5, 14, 12, 13, 15],
  [12, 13, 15, 5, 5, 5, 5, 5, 14, 12, 12],
  [12, 15, 5, 5, 5, 5, 5, 5, 5, 14, 13],
  [13, 12, 15, 5, 5, 5, 5, 5, 14, 12, 12],
];

interface Unidad {
  id: number;
  kind: "player" | "enemy";
  x: number;
  y: number;
  status: "active" | "dead";
}

interface CfgArena {
  tiles: number[][];
  unidades: Unidad[];
  /** Celdas con cofre de botín (impasables, INVISIBLES en `mapTiles`). */
  cofres: string[];
  /** Alcance del arma del PJ (1 = melé). */
  alcance?: number;
  /** Celdas que el motor RECHAZA aunque `mapTiles` las dé por pisables y no haya cofre —
   *  cualquier otro desacuerdo de pasabilidad (control del cinturón, ver el 3er test). */
  rechazadas?: string[];
}

/**
 * Mini-arena: mundo de mentira con las reglas (1)(2)(3) del motor. Devuelve la `page`
 * falsa que el resolvedor conduce y el `mundo` para inspeccionarlo tras la corrida.
 */
function arenaFalsa(cfg: CfgArena) {
  const G = cfg.tiles.length;
  const alcance = cfg.alcance ?? 1;
  const cofres = new Set(cfg.cofres);
  const rechazadas = new Set(cfg.rechazadas ?? []);
  const mundo = {
    combate: true as boolean,
    unidades: cfg.unidades.map((u) => ({ ...u })),
    turno: 0,
    teclas: [] as string[],
    ecos: [] as string[],
    /** Miembros que ya han salido por el borde (post-victoria). */
    salidos: [] as number[],
    pasos: 0,
    bloqueos: 0,
    /** Teclas emitidas HASTA el instante en que cae el último enemigo (el tramo
     *  «acercarse y atacar»). Es lo que el pin de no-regresión congela. */
    teclasAlGanar: null as string[] | null,
  };
  const vivos = () => mundo.unidades.filter((u) => u.status === "active");
  const actual = () => vivos()[mundo.turno % Math.max(1, vivos().length)];
  const ocupante = (x: number, y: number) => vivos().find((u) => u.x === x && u.y === y) ?? null;
  const libre = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= G || y >= G) return false;
    if (cofres.has(`${x}:${y}`)) return false; // (2) cofre = tile 1 = agua
    if (rechazadas.has(`${x}:${y}`)) return false;
    return pisable(cfg.tiles[y]![x]!) && !ocupante(x, y);
  };
  const avanza = (): void => {
    mundo.turno++;
    // Turnos enemigos: el enemigo de este fixture NO se mueve (congelado, como el ORC
    // de (8,4) en el volcado: 60 rondas en la misma celda).
  };
  const cursor = { activo: false, x: 0, y: 0 };
  const pendienteOpen = { activo: false };

  const DELTA: Record<string, [number, number]> = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  };

  const pulsa = (k: string): void => {
    mundo.teclas.push(k);
    if (!mundo.combate) return;
    const cur = actual();
    if (!cur) return;
    if (pendienteOpen.activo && DELTA[k]) {
      const [dx, dy] = DELTA[k]!;
      pendienteOpen.activo = false;
      const key = `${cur.x + dx}:${cur.y + dy}`;
      if (cofres.delete(key)) mundo.ecos.push("Chest opened");
      else mundo.ecos.push("Nothing to open!");
      avanza(); // (O)pen en la arena SIEMPRE consume el turno
      return;
    }
    if (k === "o") { pendienteOpen.activo = true; return; }
    if (k === "a") { cursor.activo = true; cursor.x = cur.x; cursor.y = cur.y; return; }
    if (cursor.activo && DELTA[k]) {
      const [dx, dy] = DELTA[k]!;
      cursor.x += dx; cursor.y += dy;
      return;
    }
    if (cursor.activo && k === "Enter") {
      cursor.activo = false;
      const objetivo = vivos().find((u) => u.kind === "enemy" && u.x === cursor.x && u.y === cursor.y);
      if (objetivo) {
        objetivo.status = "dead";
        cofres.add(`${objetivo.x}:${objetivo.y}`); // botín por-muerte (regla 2)
        mundo.ecos.push("Killed!");
        if (!vivos().some((u) => u.kind === "enemy") && !mundo.teclasAlGanar) {
          mundo.teclasAlGanar = [...mundo.teclas];
        }
      }
      avanza();
      return;
    }
    if (k === " ") { avanza(); return; }
    if (DELTA[k]) {
      const [dx, dy] = DELTA[k]!;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= G || ny >= G) {
        // (3) borde: salir andando. Con enemigos vivos sería huida; aquí modela el
        // «Leave!» post-victoria — el miembro abandona la arena.
        mundo.ecos.push(vivos().some((u) => u.kind === "enemy") ? "Escape!" : "Leave!");
        cur.status = "dead"; // fuera del tablero (no es baja: sale de `combatants` vivos)
        mundo.salidos.push(cur.id);
        if (!vivos().some((u) => u.kind === "player")) mundo.combate = false;
        mundo.turno = 0;
        return;
      }
      if (!libre(nx, ny)) {
        mundo.ecos.push("Blocked!");
        mundo.bloqueos++;
        return; // (1) ¡NO avanza el turno!
      }
      cur.x = nx; cur.y = ny;
      mundo.pasos++;
      avanza();
      return;
    }
  };

  const ventana = {
    __u5test: {
      game: {
        get combat() {
          if (!mundo.combate) return null;
          const cur = actual();
          return {
            currentUnit: cur ? { ...cur } : null,
            combatants: vivos().map((u) => ({ ...u, charmed: false })),
            mapTiles: cfg.tiles,
            ensureAttackQueue: () => [{ id: 1, range: alcance }],
            isActive: (u: Unidad) => u.status === "active",
            sideOf: (u: Unidad) => (u.kind === "enemy" ? 1 : 0),
            canReach: (a: Unidad, b: Unidad, range: number) =>
              Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= range,
            aimGeometry: () => (cur ? { initial: { x: cur.x, y: cur.y } } : null),
            chestAt: (x: number, y: number) => cofres.has(`${x}:${y}`),
            map: { triggers: [] },
          };
        },
        state: { activeCharacter: 0xff },
        dungeonState: null,
      },
      consoleLines: () => mundo.ecos.slice(-12),
    },
  };

  const page = {
    locator: () => ({ press: async (k: string) => pulsa(k) }),
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
      const g = globalThis as unknown as { window?: unknown };
      const previo = g.window;
      g.window = ventana;
      try {
        return fn(arg);
      } finally {
        g.window = previo;
      }
    },
    keyboard: { press: async (k: string) => pulsa(k) },
    waitForTimeout: async () => {},
  } as unknown as Page;
  return { page, mundo, cofres };
}

/** Estado VIVO de la ronda 25 de `ad23-g26` (volcado F6-diag): el ORC de (4,4) acaba de
 *  morir y ha dejado su cofre; el actor interpelado es el PJ id 3 en (4,5); queda un ORC
 *  vivo en (8,4). `mapTiles[4][4]` sigue diciendo 5 (hierba). */
function escenaAd23G26() {
  return arenaFalsa({
    tiles: TILES_AD23_G26,
    cofres: ["4:4"],
    unidades: [
      { id: 3, kind: "player", x: 4, y: 5, status: "active" }, // el que se atasca
      { id: 1, kind: "player", x: 5, y: 5, status: "active" },
      { id: 2, kind: "player", x: 6, y: 4, status: "active" },
      { id: 4, kind: "player", x: 5, y: 7, status: "active" },
      { id: 7, kind: "enemy", x: 8, y: 4, status: "active" },
    ],
  });
}

/** Escena SIN cofres y SIN desacuerdos: aproximación larga por la fila 3 (toda hierba)
 *  hasta el enemigo de (9,3). Es el caso que el resolvedor YA conduce bien hoy — el
 *  sujeto del pin de no-regresión. */
function escenaLimpia() {
  return arenaFalsa({
    tiles: TILES_AD23_G26,
    cofres: [],
    unidades: [
      { id: 1, kind: "player", x: 3, y: 3, status: "active" },
      { id: 2, kind: "player", x: 3, y: 2, status: "active" },
      { id: 7, kind: "enemy", x: 9, y: 3, status: "active" },
    ],
  });
}

/**
 * PIN DE NO-REGRESIÓN — sacado de la rama ANTES del fix (main `9e19c56e`) y congelado
 * aquí. Es el tramo «acercarse y atacar» de un combate que el resolvedor YA resuelve:
 * el fix no puede tocar NI UNA tecla de él. (Lo que el fix sí cambia es lo que pasa
 * DESPUÉS de limpiar el bando enemigo, y eso lo cubre el test de la victoria.)
 */
const PIN_TECLAS_PRE_FIX: string[] = [
  "ArrowRight", "ArrowRight", " ", "ArrowRight", "ArrowRight", " ",
  "ArrowRight", "ArrowRight", " ", "ArrowRight", "ArrowRight", " ",
  "ArrowRight", "ArrowRight", " ", "a", "ArrowRight", "Enter",
];

describe("F-6 — el resolvedor `auto` y el cofre de botín que NO está en `mapTiles`", () => {
  it("PIN: en una arena SIN cofres ni desacuerdos el fix es un NO-OP tecla a tecla", async () => {
    const { page, mundo } = escenaLimpia();
    await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    expect(mundo.teclasAlGanar).toEqual(PIN_TECLAS_PRE_FIX);
  });

  it("★★ ROJO-PRIMERO: el cofre por-muerte de (4,4) deadlockea el turno — el paso rechazado NO consume turno y el resolvedor lo repite hasta rendirse", async () => {
    const { page, mundo } = escenaAd23G26();

    const resuelto = await dungeonResolveRoomCombat(page, { maxRounds: 300 });

    // Lo que se mide NO es «tarda»: es que el combate se ABANDONA con el enemigo vivo.
    expect(resuelto).toBe(true);
    expect(mundo.unidades.find((u) => u.id === 7)!.status).toBe("dead");
  });

  it("★ el atasco es del TURNO, no del pathing: sin el fix el mismo actor repite el MISMO paso rechazado", async () => {
    const { page, mundo } = escenaAd23G26();
    await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    // Con el cofre en el censo del snapshot, el BFS lo rodea desde el PRIMER paso: CERO
    // topetazos. (Sin el fix este contador se va a 61 — un «Blocked!» por ronda hasta
    // rendirse; con la memoria del rechazo pero SIN el censo, se gastarían turnos
    // aprendiendo a topetazos lo que el motor ya sabía.)
    expect(mundo.bloqueos).toBe(0);
  });

  it("★★ VICTORIA que no cierra: limpiar el bando enemigo NO termina el combate — hay que SALIR ANDANDO por el borde", async () => {
    const { page, mundo } = arenaFalsa({
      tiles: TILES_AD23_G26,
      cofres: [],
      unidades: [
        { id: 1, kind: "player", x: 5, y: 3, status: "active" },
        { id: 2, kind: "player", x: 6, y: 3, status: "active" },
      ],
    });
    // Sin enemigos desde la ronda 0: el legacy pulsa espacio hasta agotar `maxRounds`.
    const resuelto = await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    expect(resuelto).toBe(true);
    expect(mundo.combate).toBe(false);
    expect(mundo.ecos).toContain("Leave!");
  });

  it("★ el borde de salida se elige por ALCANZABILIDAD, no por cercanía (#50): con el borde cercano emparedado, la party sale por el LEJANO", async () => {
    // Arena SINTÉTICA (no sale del volcado: es el control de la regla, réplica de la
    // geometría de ch22 r5): pasillo horizontal en la fila 5, todo lo demás montaña. Desde
    // (2,5) el borde MÁS CERCANO es el oeste (d=2) y es muro macizo; el único viable es el
    // este (d=8). Elegir por cercanía deja la salida NACIDA MUERTA.
    const pasillo = Array.from({ length: 11 }, (_, y) =>
      Array.from({ length: 11 }, (_, x) => (y === 5 && x >= 2 ? 5 : 12)),
    );
    const { page, mundo } = arenaFalsa({
      tiles: pasillo,
      cofres: [],
      unidades: [{ id: 1, kind: "player", x: 2, y: 5, status: "active" }],
    });
    const resuelto = await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    expect(resuelto).toBe(true);
    expect(mundo.ecos).toContain("Leave!");
  });

  it("★★ CINTURÓN (desacuerdo de pasabilidad que NO es cofre): un rechazo repetido tampoco puede deadlockear el turno", async () => {
    // Misma escena, pero la celda (4,4) la rechaza el motor SIN cofre: ningún censo de
    // cofres la ve. El resolvedor no debe repetir el paso rechazado indefinidamente.
    const { page, mundo } = arenaFalsa({
      tiles: TILES_AD23_G26,
      cofres: [],
      rechazadas: ["4:4"],
      unidades: [
        { id: 3, kind: "player", x: 4, y: 5, status: "active" },
        { id: 1, kind: "player", x: 5, y: 5, status: "active" },
        { id: 2, kind: "player", x: 6, y: 4, status: "active" },
        { id: 4, kind: "player", x: 5, y: 7, status: "active" },
        { id: 7, kind: "enemy", x: 8, y: 4, status: "active" },
      ],
    });
    const resuelto = await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    expect(resuelto).toBe(true);
    expect(mundo.unidades.find((u) => u.id === 7)!.status).toBe("dead");
  });
});
