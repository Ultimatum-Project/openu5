/**
 * Grand Tour — TELEMETRÍA POR-ACCIÓN del arnés (carril tour-telemetry).
 *
 * OBJETIVO. El vídeo del tour muestra tramos de «intentos seguidos de movimientos
 * blocked» y paradas largas en la misma casilla. Este módulo registra CADA acción de
 * conducción del arnés (paso de walkTo, espera de burnTurn, paso de mazmorra, ronda de
 * combate) en un JSONL para que `game/tools/tour-telemetry-analyze.py` detecte y
 * CLASIFIQUE esos patrones:
 *   (i)  NPC-bloqueando          → FIEL, esperar es jugar;
 *   (ii) reintento-de-pather     → ineficiencia de ARNÉS (arreglable aquí);
 *   (iii) DESACUERDO-PASABILIDAD → el planner (BFS sobre TileData.IsWalking_Passable)
 *         tenía la casilla como pisable y el runtime bloqueó SIN NPC delante = candidato
 *         a bug de fidelidad del port (clase get-torch). Para adjudicarlo, cada paso
 *         bloqueado registra el tile PLANIFICADO, el tile VIVO re-leído y si hay NPC
 *         vivo en la casilla pretendida en el momento del bloqueo.
 *
 * FLUJO (documentado también en el header del analizador):
 *   1. Pasada normal del tour con la env apuntando a un JSONL:
 *        U5_TOUR_TELEMETRY=/tmp/tour.jsonl npm run tour:spec -- "ch0[1-9]|ch1[0-8]"
 *   2. El arnés apendiza una línea JSON por acción (multi-worker safe: appendFileSync
 *      O_APPEND + una línea por write; cada entrada lleva chapter + worker).
 *   3. python3 game/tools/tour-telemetry-analyze.py /tmp/tour.jsonl → informe por
 *      capítulo (rachas, stuck-spots, oscilaciones, clasificación, top-10).
 *
 * CERO IMPACTO SIN LA ENV. Sin `U5_TOUR_TELEMETRY` TODAS las funciones retornan
 * inmediatamente: ni page.evaluate, ni disco, ni timers — el tour queda byte-idéntico
 * (guardado por game/tests/tour-telemetry.test.ts, que pasa una page ENVENENADA cuyo
 * evaluate lanza y verifica que sin env no se toca). Con la env, la telemetría OBSERVA
 * (lecturas de estado + append a disco) y JAMÁS conduce: cero press, cero mutación —
 * puede alterar timing wall-clock (irrelevante: la sync del arnés es lógica, task #8)
 * pero nunca el stream de RNG ni los bytes del sello. Aun así, la pasada de telemetría
 * es una pasada DEDICADA (no re-sella): misma clase que la pasada-vídeo.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, basename } from "node:path";
import { test, type Page } from "@playwright/test";
import type { Pos } from "./nav";

/** Ruta del JSONL destino, o null si la telemetría está APAGADA (default). */
export function telemetryPath(): string | null {
  const p = process.env.U5_TOUR_TELEMETRY?.trim();
  return p ? p : null;
}

/** ¿Telemetría activa? (recomputa por llamada: barato y testeable sin re-import). */
export const telemetryEnabled = (): boolean => telemetryPath() !== null;

/** Contexto de juego en el momento de la acción. */
export type TourContext = "overworld" | "town" | "dungeon" | "combat" | "unknown";

interface BaseEntry {
  /** Versión del esquema (para que el analizador rechace mezclas incompatibles). */
  v: 1;
  /** Reloj wall-clock absoluto (ms epoch); el analizador deriva duraciones. */
  t_ms: number;
  /** Capítulo = basename del spec en curso (test.info()), o "?" fuera de un test. */
  chapter: string;
  /** Worker de Playwright (multi-worker → desentrelazar streams). */
  worker: string;
  kind: string;
}

const dirsMade = new Set<string>();

/** Apendiza una entrada como línea JSONL. Sólo se llama con telemetría activa. */
function append(entry: Record<string, unknown>): void {
  const path = telemetryPath();
  if (!path) return;
  const dir = dirname(path);
  if (!dirsMade.has(dir)) {
    mkdirSync(dir, { recursive: true });
    dirsMade.add(dir);
  }
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

/** Capítulo en curso: basename del fichero de spec. `test.info()` LANZA fuera de un
 *  test de Playwright (p. ej. bajo vitest) → "?" (el unit lo cubre). */
function currentChapter(): string {
  try {
    return basename(test.info().file).replace(/\.spec\.ts$/, "");
  } catch {
    return "?";
  }
}

function base(kind: string): BaseEntry {
  return {
    v: 1,
    t_ms: Date.now(),
    chapter: currentChapter(),
    worker: process.env.TEST_WORKER_INDEX ?? "0",
    kind,
  };
}

/**
 * Sonda de estado VIVO para enriquecer una entrada: contexto + última línea de consola
 * (+ opcionalmente NPC/tile vivos en la casilla pretendida de un paso bloqueado — la
 * evidencia que separa NPC-bloqueando de desacuerdo-pasabilidad). UNA sola evaluate.
 * Nunca lanza: una page rota degrada a contexto "unknown" (la telemetría jamás debe
 * tumbar un capítulo).
 */
async function probe(
  page: Page,
  intended?: { x: number; y: number },
): Promise<{ ctx: TourContext; echo: string; npcAtIntended?: boolean; liveTile?: number | null }> {
  try {
    return await page.evaluate(
      (i: { x: number; y: number } | null) => {
        const t = (
          window as unknown as {
            __u5test: {
              consoleLines?: () => string[];
              game: {
                combat: unknown;
                dungeonState: unknown;
                state: { position: { location: number; floor: number } };
                npcManager?: { npcsAt: (loc: number, floor: number) => Array<{ x: number; y: number }> };
                activeMap?: { tileAt: (x: number, y: number) => number };
              };
            };
          }
        ).__u5test;
        const g = t.game;
        const lines = t.consoleLines?.() ?? [];
        const ctx: "overworld" | "town" | "dungeon" | "combat" =
          g.combat != null
            ? "combat"
            : g.dungeonState != null
              ? "dungeon"
              : g.state.position.location === 0
                ? "overworld"
                : "town";
        const out: {
          ctx: "overworld" | "town" | "dungeon" | "combat";
          echo: string;
          npcAtIntended?: boolean;
          liveTile?: number | null;
        } = { ctx, echo: lines[lines.length - 1] ?? "" };
        if (i) {
          const p = g.state.position;
          out.npcAtIntended = (g.npcManager?.npcsAt(p.location, p.floor) ?? []).some(
            (n) => n.x === i.x && n.y === i.y,
          );
          try {
            out.liveTile = g.activeMap ? g.activeMap.tileAt(i.x, i.y) : null;
          } catch {
            out.liveTile = null;
          }
        }
        return out;
      },
      intended ?? null,
    );
  } catch {
    return { ctx: "unknown", echo: "" };
  }
}

/**
 * Un PASO de `walkTo` (small map / overworld): tecla, posiciones antes/después, si
 * avanzó, la casilla PRETENDIDA por el planner y el tile que el planner creía pisable.
 * En pasos BLOQUEADOS añade la evidencia viva (NPC en destino / tile re-leído).
 */
export async function recordWalkStep(
  page: Page,
  d: {
    key: string;
    before: Pos;
    after: Pos;
    intended: { x: number; y: number };
    plannedTile: number;
    openedDoor: boolean;
    goal: { x: number; y: number };
  },
): Promise<void> {
  if (!telemetryEnabled()) return;
  const moved = d.after.x === d.intended.x && d.after.y === d.intended.y;
  // La sonda viva sólo re-lee NPC/tile del destino cuando el paso NO avanzó (es la
  // evidencia del clasificador); en pasos buenos basta contexto + eco.
  const p = await probe(page, moved ? undefined : d.intended);
  append({
    ...base("walk-step"),
    ctx: p.ctx,
    key: d.key,
    before: { loc: d.before.location, floor: d.before.floor, x: d.before.x, y: d.before.y },
    after: { loc: d.after.location, floor: d.after.floor, x: d.after.x, y: d.after.y },
    moved,
    intended: d.intended,
    plannedTile: d.plannedTile,
    openedDoor: d.openedDoor,
    goal: d.goal,
    echo: p.echo,
    ...(moved ? {} : { npcAtIntended: p.npcAtIntended ?? null, liveTile: p.liveTile ?? null }),
  });
}

/**
 * Una ESPERA deliberada del arnés (`burnTurn`): paso contra un muro para consumir un
 * turno. `reason` la aporta el llamador (no-path / first-step-blocked / wait) — es la
 * firma del reintento-de-pather cuando se encadenan.
 */
export async function recordWaitTurn(page: Page, reason: string, pos: Pos): Promise<void> {
  if (!telemetryEnabled()) return;
  const p = await probe(page);
  append({
    ...base("wait-turn"),
    ctx: p.ctx,
    reason,
    pos: { loc: pos.location, floor: pos.floor, x: pos.x, y: pos.y },
    echo: p.echo,
  });
}

/** Un paso 3D de mazmorra (`dungeonStepTo`): celda pretendida vs alcanzada. */
export async function recordDungeonStep(
  page: Page,
  d: {
    before: { x: number; y: number; floor: number; facing: string };
    intended: { x: number; y: number };
    after: { x: number; y: number; floor: number } | null;
  },
): Promise<void> {
  if (!telemetryEnabled()) return;
  const p = await probe(page);
  append({
    ...base("dungeon-step"),
    ctx: p.ctx,
    before: d.before,
    intended: d.intended,
    after: d.after,
    moved: d.after !== null && d.after.x === d.intended.x && d.after.y === d.intended.y,
    echo: p.echo,
  });
}

/**
 * Una RONDA de jugador de un resolvedor de combate (no por frame): posición del actor,
 * enemigos vivos y contadores de atasco del resolvedor. El analizador detecta rondas
 * estancadas (misma celda + stuck creciente) sin inflar el JSONL con turnos "other".
 */
export async function recordCombatRound(
  page: Page,
  d: {
    resolver: "room" | "arena";
    round: number;
    ax: number;
    ay: number;
    enemies: number;
    stuck: number;
    /**
     * CELDAS de los enemigos vivos («x,y»), no sólo el conteo. Añadido 2026-07-25 para los
     * DISCRIMINADORES de #103/#65/#125 (re/notes/discriminadores-resello.md): con el conteo
     * solo se sabe QUE cayó alguien; con las celdas se sabe CUÁL y, cruzando con el mapa,
     * qué tiles había en la línea de tiro. Sin esto el resello no puede contestar si una
     * baja vino por un disparo a través de 0x42 / 0xd0-0xd3 / 0xff.
     */
    enemyCells?: string[];
    /** ¿se ha usado ya el (U)se Cetro en este combate? Discriminador de #125 (coartada). */
    sceptreUsed?: boolean;
  },
): Promise<void> {
  if (!telemetryEnabled()) return;
  const p = await probe(page);
  append({ ...base("combat-round"), ctx: p.ctx, ...d, echo: p.echo });
}

/** Cierre de un resolvedor de combate: resuelto o no + duración wall-clock. */
export async function recordCombatEnd(
  page: Page,
  d: { resolver: "room" | "arena"; resolved: boolean; ms: number },
): Promise<void> {
  if (!telemetryEnabled()) return;
  append({ ...base("combat-end"), ...d });
}
