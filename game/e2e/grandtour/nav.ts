/**
 * Grand Tour — NAVEGACIÓN reutilizable de small-maps (F3, ch02+).
 *
 * Provee las primitivas que un capítulo necesita para RECORRER una localización de
 * forma DETERMINISTA por los mecanismos REALES del juego (movimiento con flechas,
 * (O)pen de puertas, (L)ook/(S)earch/(T)alk direccionales, (K)limb). El posicionamiento
 * INTER-capítulo (llegar al tile de la localización en el overworld) es la ÚNICA
 * operación de arnés declarada — usa la costura cero-rand sancionada del menú debug
 * (`__u5debug.teleportOverworld`, escritura directa de posición, cero stream); TODO lo
 * demás de aquí pasa por el motor real (`game.enter()`, comandos de teclado).
 *
 * PATHFINDING. `walkTo` hace BFS sobre el mapa VIVO: transitable = tile walkable ∪
 * puertas REGULARES (184/186, sin llave/hechizo); las puertas cerradas se (O)pen al
 * cruzarlas. Los tiles ocupados por NPC se tratan como bloqueados y se re-leen antes de
 * cada destino (los NPC de interior son estacionarios —aiType 0— pero su horario puede
 * moverlos al cruzar una hora). La tabla de transitabilidad sale de la MISMA fuente que
 * el motor (`src/core/data/TileData.json` → `IsWalking_Passable`), sin duplicar la regla.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { readState } from "../helpers";
import { tecla, pacersVivos, rotulo } from "../tempo-video.mjs";
import { buildLocationGraph, planRoute, isLockedDoor } from "./nav-graph";
import {
  recordWalkStep,
  recordWaitTurn,
  recordDungeonStep,
  recordCombatRound,
  recordCombatEnd,
} from "./telemetry";
import { guardPromptAction, tributePaymentVerdict, guardChargeFor, LOC_MINOC, isGoalBump, OscillationDamper } from "./nav-tactics";
import { bootPlan, type TourSkin } from "./bootPlan";
import { planDungeonDescent, isCorridorAmbush, nextWalkAction, DN, type DCell, type DescentOpts, type AmbushMode } from "./descent-planner";

export type { TourSkin };

const HERE = dirname(fileURLToPath(import.meta.url));
const TILE_DATA = JSON.parse(
  readFileSync(join(HERE, "..", "..", "src", "core", "data", "TileData.json"), "utf8"),
) as Record<string, { IsWalking_Passable?: boolean }>;

/** Puertas REGULARES (se abren con (O)pen, sin llave ni hechizo). */
const REGULAR_DOORS = new Set([184, 186]);
/** ¿Se puede PISAR/atravesar el tile andando (o abriéndolo si es puerta regular)? */
const traversable = (tile: number): boolean =>
  Boolean(TILE_DATA[String(tile)]?.IsWalking_Passable) || REGULAR_DOORS.has(tile);
const isRegularDoor = (tile: number): boolean => REGULAR_DOORS.has(tile);

export interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

type Dir = "up" | "down" | "left" | "right";
const ARROW: Record<Dir, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const dirOf = (dx: number, dy: number): Dir =>
  dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";

export const getPos = (page: Page): Promise<Pos> => readState<Pos>(page, "position");

/**
 * Arranca el mundo del Grand Tour de forma INDEPENDIENTE DE PIEL (task #16). Antes cada
 * spec clavaba el boot de la piel DEV (click en `.title-new` + espera de `.hud-clock`),
 * DOM que SÓLO monta `DevSkin` — con `?skin=faithful` colgaba en la línea 1. Aquí:
 *   · dev: título DOM → click "Journey Onward" (`.title-new`).
 *   · faithful: `&nointro` monta el mundo directo (sin cinemática ni título DOM).
 * Ambas esperan la señal LÓGICA `__u5test.worldReady()` (no `.hud-clock`): ese hook se
 * cablea tras el título (dev, post-click) o el montaje directo (fiel), así que su
 * existencia marca el fin del boot en las dos pieles. La política piel→URL→click vive en
 * `bootPlan` (PURA, unit-testeada); aquí sólo el driver Playwright.
 *
 * El default es **`faithful`** (la piel 1988), no `dev`. La política vive en `bootPlan.ts`
 * — `bootPlan.ts:59`: `opts.skin ?? (envSkin === "dev" ? "dev" : "faithful")` — y la fija
 * su unit: `game/tests/grandtour-bootplan.test.ts:19-20` asierta `bootPlan().skin ===
 * "faithful"`. (Esta línea decía «el default es dev, fase 1»; era prosa de la fase 1 que
 * la fase 2 dejó atrás.)
 *
 * ⚠ Y `U5_TOUR_SKIN=dev` **YA NO SIRVE COMO CONTROL**: la piel dev está JUBILADA
 * (`docs/dev-retire-l3-mapa.md`, lotes L1-L4) — `game/src/skin/dev.ts` está borrado, no
 * queda entrada `"dev"` en el registro y `main.ts:418` hace caer cualquier preferencia
 * `"dev"` a la fiel. Peor que inerte para el tour: `bootPlan` sigue devolviendo
 * `clickTitle: true` para `dev`, y como ningún `.title-new` se pinta ya, el arranque se
 * queda esperando ese click hasta agotar el techo. Si algún día hace falta un A/B de
 * pieles, hay que arreglar antes esa rama; hoy TODAS las specs van por consola.
 */
export async function bootWorld(
  page: Page,
  opts?: { skin?: TourSkin; debug?: boolean; readyTimeout?: number },
): Promise<void> {
  _ambushMode = "legacy"; // baseline por capítulo; los sellos territory (ch35/ch37) re-optan tras bootWorld
  const plan = bootPlan(opts, process.env.U5_TOUR_SKIN, process.env.U5_TOUR_LANG);
  await page.addInitScript(() => localStorage.clear());
  // Bajo `U5_VIDEO_TEMPO=cine`: que el port NO apague sus seis pacers calibrados por
  // detectar automatización (ver tempo-video.mjs). Va ANTES del goto — `boot()` lee el
  // discriminante una sola vez. Sin la env no instala nada.
  await pacersVivos(page);
  if (rotulo().startsWith("tempo=CINE")) console.log(`  [grandtour] ${rotulo()}`);
  await page.goto(plan.url);
  if (plan.clickTitle) await page.locator(".title-new").click();
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: opts?.readyTimeout ?? 45_000 * HEADED_SCALE },
  );
}

/**
 * Últimas `n` líneas de la consola LÓGICA (task #16): `__u5test.consoleLines()` expone la
 * MISMA fuente (`view.snapshot().console`) que pinta el HUD de la piel dev y la consola de
 * la piel fiel. Sustituye la lectura del `.hud-log` DOM (sólo-DevSkin), haciendo
 * `faceCommand`/`readSign` independientes de piel. Los llamantes slicean el tail (2-4
 * líneas), presente byte-a-byte en ambas pieles.
 */
async function consoleTail(page: Page, n: number): Promise<string[]> {
  const lines = await page.evaluate(
    () =>
      (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines(),
  );
  return lines.slice(-n);
}

/**
 * ¿Esta PIEL conduce la conversación por CONSOLA (fiel/shader) en vez de por el panel DOM
 * (dev)? Refleja el gate de `startTalk` (`__u5test.dialogueConsole()` = skins.currentId !==
 * "dev"), estable durante toda la sesión. Los helpers de charla lo consultan para elegir cómo
 * TECLEAR la keyword (getstring por teclado vs `input.fill`) y de dónde LEER la respuesta
 * (`consoleLines()` vs `.dialogue-history`). Así el MISMO arnés conduce ambas presentaciones.
 */
export async function isConsoleTalk(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window as unknown as { __u5test: { dialogueConsole?: () => boolean } }).__u5test.dialogueConsole?.() ??
      false,
  );
}

/**
 * Texto de la conversación EN CURSO, sea cual sea la presentación: en piel fiel/shader la
 * consola lógica completa (`consoleLines()`, misma fuente que pinta la piel); en piel dev el
 * historial del panel DOM. Sustituye la lectura directa de `.dialogue-history` en los helpers
 * de charla para que funcionen en AMBAS pieles.
 */
export async function readDialogText(page: Page, dialog: ReturnType<Page["locator"]>): Promise<string> {
  if (await isConsoleTalk(page)) return (await consoleTail(page, 12)).join("\n");
  return (await dialog.locator(".dialogue-history").innerText().catch(() => "")) || "";
}

/**
 * Espera CONDICIONAL a que la conversación AVANCE respecto a `prevText` (aterrizó la respuesta
 * del NPC / el siguiente prompt), en vez de un sleep fijo. Mode-aware: en CONSOLA espera a que
 * el texto CAMBIE (no que crezca — el ring de 12 líneas puede desplazar sin alargar); en DOM el
 * historial sólo crece → longitud mayor. Techo generoso; si no avanza, el llamante lee lo que
 * haya (respuesta vacía).
 */
async function waitDialogGrew(page: Page, prevText: string): Promise<void> {
  if (await isConsoleTalk(page)) {
    await page
      .waitForFunction(
        (prev) =>
          ((window as unknown as { __u5test: { consoleLines?: () => string[] } }).__u5test.consoleLines?.() ?? [])
            .join("\n") !== prev,
        prevText,
        { timeout: DIALOG_CEIL_MS, polling: 50 },
      )
      .catch(() => {});
    return;
  }
  await page
    .waitForFunction(
      (n) => {
        const el =
          document.querySelector(".dialogue-panel .dialogue-history") ??
          document.querySelector(".dialogue-history");
        return (el?.textContent?.length ?? 0) > n;
      },
      prevText.length,
      { timeout: DIALOG_CEIL_MS, polling: 50 },
    )
    .catch(() => {});
}

/**
 * Contador de WORLD-TURNS lógico del arnés (task #8). `state.turnsSinceStart` se
 * incrementa EXACTAMENTE una vez por world-turn consumido — en `turn_housekeeping`
 * (survival.ts), que corre una sola vez por turno de pueblo/exterior consumido, y NO
 * en los world-turns EXTRA de terreno lento ni en las teclas que no consumen turno.
 * Cada paso en small map (éxito, bump de pared, NPC-bloqueado) lo sube +1 de forma
 * SÍNCRONA dentro del keydown. En memoria es monótono y sin techo (sólo el .GAM lo
 * satura a u8 al exportar; el estado vivo no se muta), así que sirve de reloj lógico
 * del arnés en toda la sesión. Es la señal DETERMINISTA que sustituye a las esperas de
 * reloj real: el arnés espera "world-turn N procesado", no "N ms".
 */
const getTurns = (page: Page): Promise<number> => readState<number>(page, "turnsSinceStart");

/**
 * Techos wall-clock GENEROSOS (task #8): salvaguarda anti-cuelgue, NUNCA el mecanismo
 * de sincronización. La sync la da la CONDICIÓN lógica (contador de turnos / estado del
 * panel); el techo sólo evita colgar la suite si algo se rompe de verdad. Amplios para
 * absorber picos de carga (la máquina corre sellados en paralelo) sin falsos negativos.
 */
/**
 * Factor de MODO VISIBLE (PWHEADED): el render headed rinde ~7× más lento que headless
 * (medido en los runs visibles del 2026-07-16: ch05/ch07 reventaron sus techos con la
 * MISMA lógica verde headless). Escala TODOS los techos wall-clock del arnés y los de
 * capítulo (via `chapterTimeout`) — la sync sigue siendo la condición lógica; sólo
 * evita falsos negativos por lentitud de pintado + carga concurrente.
 */
export const HEADED_SCALE = process.env.PWHEADED ? 4 : 1;
/** Techo de capítulo escalado al modo de render. Úsalo en los `test.setTimeout` de las specs. */
export const chapterTimeout = (ms: number): number => ms * HEADED_SCALE;

const TURN_CEIL_MS = 10_000 * HEADED_SCALE;
const DIALOG_CEIL_MS = 15_000 * HEADED_SCALE;
const PANEL_CEIL_MS = 15_000 * HEADED_SCALE;

/**
 * Espera DETERMINISTA a que AVANCE el world-turn lógico (`turnsSinceStart` > `before`).
 * Como el turno se procesa síncrono en el keydown, la condición ya es cierta en el
 * primer sondeo tras `press`: esto NO introduce latencia, sólo BARRERA de corrección
 * bajo carga. El techo es salvaguarda (una tecla que no consumió turno no lo dispara).
 */
async function waitTurnAdvanced(page: Page, before: number): Promise<void> {
  await page
    .waitForFunction(
      (b) =>
        (window as unknown as { __u5test: { state: () => { turnsSinceStart: number } } }).__u5test
          .state().turnsSinceStart > b,
      before,
      { timeout: TURN_CEIL_MS, polling: 16 },
    )
    .catch(() => {
      /* techo agotado: salvaguarda anti-cuelgue, el llamador sigue con el estado vivo */
    });
}

/**
 * ¿Prompt de GUARDIA pendiente? (tributo TALK 0x01e2 / arresto TOWN 0x12ae, F2-T4).
 * El TRIBUTO se resuelve PAGANDO ('y') — ruling del lead 2026-07-22: «el arnés se
 * adapta al mundo». Con oro suficiente el pago es determinista (oro −10·vivos) y el
 * guardia queda satisfecho (ret 0 del handler). Devuelve true si pagó (el turno del
 * bump YA corrió — el llamador re-snapshotea).
 *
 * ★ EL ARRESTO NO SE ACEPTA (task #51). `guard-arrest` sólo se arma cuando el pago
 * FALLÓ (`guardDemand` ret 1 = rehusar, o aceptar sin oro para el tributo de 10 gp por
 * miembro vivo), así que es la señal de que la PREMISA ECONÓMICA de la cadena se rompió.
 * Responder 'y' («come quietly») la ENTIERRA: el party despierta en la celda de Yew
 * (loc 4, 25/4, llaves confiscadas, reloj a las 8) y el capítulo sigue corriendo en el
 * pueblo equivocado hasta morir con un mensaje de otro subsistema. Medido en ch06-
 * moonglow: entra a Moonglow con 1 gp, el guardia pide 20 (2 vivos), el arnés aceptaba
 * la cárcel y el capítulo moría 6 pasos después con «climbLadder(up): sin escalera en la
 * planta 0» — cierto y ajeno, porque Yew tiene plantas −1 y 0. Ahora aborta AQUÍ, con la
 * causa. La decisión vive en `guardPromptAction` (nav-tactics, unit-testeada).
 */
async function payGuardIfPrompted(page: Page): Promise<boolean> {
  const tag = await page.evaluate(() => {
    const t = (window as unknown as { __u5test: { guardPromptOpen?: () => string | null } }).__u5test;
    return t.guardPromptOpen?.() ?? null;
  });
  const action = guardPromptAction(tag);
  if (action === "none") return false;
  const before = await readGuardEconomy(page);
  if (action === "arrested") throw new GuardArrestError(before);

  await press(page, "y");

  // ★ BEAT `guard-tribute-paid` CON ASERTO (task #52 / #46). No basta con MARCAR que se
  // pagó: sin aserto, un pago que cobrase de más, de menos o que dejase el prompt abierto
  // pasaría inadvertido y el capítulo seguiría «verde». Los dos hechos que definen el pago
  // son los que se comprueban:
  //   1. el oro baja EXACTAMENTE 10 × vivos (`guardDemand`, TALK 0x0230-0x0269: 0xa por
  //      miembro con status != 'D', `0x025a cmp byte[si],0x44`), y
  //   2. el prompt queda CERRADO (`ret 0` = el guardia queda satisfecho, sin texto).
  // Este es también el CONTROL DE NO-CÁRCEL del re-sello de ch08: si el arresto hubiera
  // ocurrido, el oro no bajaría en múltiplos exactos del tributo (o no bajaría en absoluto).
  const after = await readGuardEconomy(page);
  const tribute = guardChargeFor(before);
  const verdict = tributePaymentVerdict(before, after);
  if (verdict === "amount") {
    throw new Error(
      `guard-tribute-paid: el cobro NO es el modelado. Oro ${before.gold} → ${after.gold} ` +
        `(Δ ${after.gold - before.gold}), pero el cobro derivado es ${tribute} ` +
        `(${before.loc === LOC_MINOC ? `CARIDAD de Minoc: gold/2` : `TRIBUTO 10 gp × ${before.living} vivos`}` +
        `) en loc ${before.loc} (${before.x},${before.y}). O el importe no es el derivado, o el ` +
        `pago no ocurrió (¿arresto?), o hay un segundo consumidor de oro en el mismo turno.`,
    );
  }
  if (verdict === "prompt") {
    throw new Error(
      `guard-tribute-paid: el prompt del guardia sigue ABIERTO tras pagar (tag ` +
        `${JSON.stringify(after.tag)}). El pago con oro suficiente debe cerrar el prompt ` +
        `(ret 0, guardia satisfecho, sin texto) en loc ${before.loc} (${before.x},${before.y}).`,
    );
  }
  tributePayments.push({ ...before, tribute, goldAfter: after.gold });
  if (process.env.U5_ORO_CENSO === "1") {
    console.log(
      `[oro-52] TRIBUTO PAGADO #${tributePayments.length} loc ${before.loc} (${before.x},${before.y}) ` +
        `día ${before.day} ${String(before.hour).padStart(2, "0")}:${String(before.minute).padStart(2, "0")} ` +
        `oro ${before.gold}→${after.gold} tributo ${tribute} (${before.living} vivos)`,
    );
  }
  return true;
}

/** Lectura viva de lo que el tributo del guardia consume y de si su prompt sigue abierto. */
async function readGuardEconomy(page: Page): Promise<{
  gold: number;
  living: number;
  loc: number;
  x: number;
  y: number;
  day: number;
  hour: number;
  minute: number;
  tag: string | null;
}> {
  return await page.evaluate(() => {
    const t = (window as unknown as { __u5test: { game: any; guardPromptOpen?: () => string | null } }).__u5test;
    const g = t.game.state;
    const living = (g.characters ?? []).slice(0, g.partySize).filter((c: any) => c && c.status !== "D").length;
    return {
      gold: g.gold as number,
      living,
      loc: g.position.location as number,
      x: g.position.x as number,
      y: g.position.y as number,
      day: g.time.day as number,
      hour: g.time.hour as number,
      minute: g.time.minute as number,
      tag: t.guardPromptOpen?.() ?? null,
    };
  });
}

interface TributePayment {
  gold: number;
  goldAfter: number;
  living: number;
  tribute: number;
  loc: number;
  x: number;
  y: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Registro de los tributos PAGADOS en el capítulo en curso (task #52). Es el sujeto del
 * beat `guard-tribute-paid`: el capítulo donde el pago cae de verdad lo lee para asertarlo
 * y para DECLARARLO en su nota de cobertura, de forma que el detector estático pueda
 * contrastar la declaración contra el `.gam`, igual que hace con `LLAVES a→b`.
 */
const tributePayments: TributePayment[] = [];

export function getTributePayments(): readonly TributePayment[] {
  return tributePayments;
}

/** Vacía el registro. Lo llama el capítulo al ARRANCAR, para que su cuenta sea la suya. */
export function resetTributePayments(): void {
  tributePayments.length = 0;
}

/**
 * El guardia ARRESTA porque el tributo no se pudo pagar (task #51). IRRECUPERABLE por
 * navegación, igual que `KeysExhaustedError`: quemar turnos no fabrica oro, y el prompt
 * de arresto sigue abierto bloqueando toda acción. Los bucles de reintento deben
 * RE-LANZARLA (ver `rethrowIfFatal`) en vez de tragársela, o el capítulo muere docenas de
 * pasos después con un error de otro subsistema — que es exactamente lo que hacía.
 */
class GuardArrestError extends Error {
  constructor(s: { gold: number; living: number; loc: number; x: number; y: number }) {
    super(
      `guardia: ARRESTO en curso — el tributo NO se pudo pagar (oro ${s.gold}, tributo ` +
        `${s.living * 10} = 10 gp × ${s.living} vivos) en loc ${s.loc} (${s.x},${s.y}). El arnés ` +
        `NO acepta «come quietly»: aceptarlo encarcela al party en la celda de Yew (loc 4, 25/4, ` +
        `llaves confiscadas, reloj a las 8) y el capítulo seguiría corriendo en el pueblo ` +
        `equivocado. La cadena entra a este capítulo SIN ORO SUFICIENTE: es una premisa del ` +
        `capítulo, no un fallo de navegación (task #51).`,
    );
    this.name = "GuardArrestError";
  }
}

/**
 * Re-lanza los errores que NINGÚN bucle de reintento debe tragarse. Se llama al principio
 * de cada `catch` de reintento de este fichero. Hoy: `GuardArrestError` (task #51).
 */
function rethrowIfFatal(e: unknown): void {
  if (e instanceof GuardArrestError) throw e;
}

/** Pulsa una tecla que CONSUME turno y espera (determinista) a que el turno se registre. */
async function pressAwaitingTurn(page: Page, key: string): Promise<void> {
  const before = await getTurns(page);
  await press(page, key);
  await payGuardIfPrompted(page); // F2-T4: demanda de guardia → pagar (ruling)
  await waitTurnAdvanced(page, before);
}

/** Instantánea del mapa activo: rejilla de tile-ids + coords ocupadas por NPC. */
async function snapshot(page: Page): Promise<{ W: number; H: number; grid: number[][]; npc: Set<string> }> {
  const raw = await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const m = g.activeMap;
    const W: number = m.width,
      H: number = m.height;
    const grid: number[][] = [];
    for (let y = 0; y < H; y++) {
      const row: number[] = [];
      for (let x = 0; x < W; x++) row.push(m.tileAt(x, y));
      grid.push(row);
    }
    const p = g.state.position;
    const npc = (g.npcManager?.npcsAt(p.location, p.floor) ?? []).map((n: any) => `${n.x},${n.y}`);
    return { W, H, grid, npc };
  });
  return { W: raw.W, H: raw.H, grid: raw.grid, npc: new Set<string>(raw.npc) };
}

/**
 * BFS 4-conexo sobre transitables (menos las casillas de NPC). Devuelve la lista de
 * pasos (Dir) de `from` a `to`, o hasta una casilla ADYACENTE a `to` si `adjacent`.
 * `null` si no hay ruta.
 */
function bfsPath(
  snap: { W: number; H: number; grid: number[][]; npc: Set<string> },
  from: Pos,
  to: { x: number; y: number },
  adjacent: boolean,
): Dir[] | null {
  const { W, H, grid, npc } = snap;
  const key = (x: number, y: number): string => `${x},${y}`;
  const goal = (x: number, y: number): boolean =>
    adjacent ? Math.abs(x - to.x) + Math.abs(y - to.y) === 1 : x === to.x && y === to.y;
  const prev = new Map<string, { x: number; y: number; dir: Dir }>();
  const seen = new Set<string>([key(from.x, from.y)]);
  let queue: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];
  while (queue.length) {
    const next: Array<{ x: number; y: number }> = [];
    for (const cur of queue) {
      if (goal(cur.x, cur.y)) {
        // reconstruye
        const steps: Dir[] = [];
        let c = key(cur.x, cur.y);
        while (prev.has(c)) {
          const p = prev.get(c)!;
          steps.unshift(p.dir);
          c = key(p.x, p.y);
        }
        return steps;
      }
      for (const d of ["up", "down", "left", "right"] as Dir[]) {
        const [dx, dy] = DELTA[d];
        const nx = cur.x + dx,
          ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        // La casilla-objetivo (si no es 'adjacent') puede ser no-transitable (p.ej. un
        // Dresser que se registra): no se puede pisar, la maneja `goal` arriba.
        const isGoalCell = !adjacent && nx === to.x && ny === to.y;
        if (!isGoalCell) {
          if (!traversable(grid[ny]![nx]!)) continue;
          if (npc.has(k)) continue;
        }
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir: d });
        next.push({ x: nx, y: ny });
      }
    }
    queue = next;
  }
  return null;
}

/**
 * LA tecla del tour. En régimen test va tan rápido como el navegador acepte (cadencia 0,
 * la de siempre: estas specs son sellos deterministas y nadie las mira). Bajo
 * `U5_VIDEO_TEMPO=cine` espera la cadencia HUMANA medida (`tempo-video.mjs`), porque el
 * mismo arnés graba los vídeos que sí mira un humano. `tecla(0)` devuelve 0 exacto sin la
 * env ⇒ ni un milisegundo de coste para la batería.
 */
const press = async (page: Page, key: string): Promise<void> => {
  await page.locator("body").press(key);
  const ms = tecla(0);
  if (ms > 0) await page.waitForTimeout(ms);
};

/**
 * Turno "other" (enemigo o PJ POSEÍDO) en los resolvedores de combate — LA MITAD QUE
 * FALTABA de `main.ts:1759-1760` (§8.1 `re/notes/tempo-cinematico.md`).
 *
 * Régimen TEST (beat 0, webdriver): la tanda enemiga drena SÍNCRONA (`combat-pacer.ts`
 * rama beatMs===0) y el Space bombea la IA / pasa el turno del poseído — la conducta de
 * siempre, byte-idéntica (misma secuencia de teclas: los digests sellados no se mueven).
 *
 * Con PACERS VIVOS (cine + `U5_VIDEO_PACERS` ≠ 0 → beat 400 ms): la tanda avanza SOLA a
 * beat real y TODA tecla pulsada mientras `pacing` se ENCOLA y se RE-ENTREGA al volver el
 * await del PJ (main.ts:2623 `combatPacer.enqueue` + combat-pacer.ts:203 drenaje — el
 * buffer BIOS fiel del original). Un resolvedor que sondea estado y pulsa Space en cada
 * iteración del bucle mete DECENAS de Space en esa cola, y cada uno se re-entrega como
 * PASS del PJ ⇒ la party regala sus turnos y la sala no se gana nunca. Ésa es la causa
 * MEDIDA de los tres rojos de §8.1 (ch16b `headlessAlive=9`, ch18/ch19 «(U)se Cetro +
 * klimb-descend cerró el combate» = false): defecto del ARNÉS (asume drenado síncrono),
 * no doble conducta del port. Aquí: si el pacer está EN VUELO se espera por ESTADO a que
 * la tanda (o la pausa bloqueante de la fanfarria, que TIRA las teclas — 0x1b16) termine,
 * sin pulsar nada; sólo se bombea Space cuando el pacer está ocioso (arranque de combate,
 * o el régimen test de siempre). Techo 90 s = 128 beats × 400 ms + margen; si el hook no
 * existe (build no-DEV) degrada al comportamiento histórico.
 */
async function pumpOtherTurn(page: Page): Promise<void> {
  const pacing = await page.evaluate(() => {
    const t = (window as unknown as { __u5test?: { combatPacer?: () => { active: boolean } } }).__u5test;
    return !!t?.combatPacer?.().active;
  });
  if (!pacing) {
    await press(page, " ");
    return;
  }
  await page
    .waitForFunction(
      () => {
        const t = (window as unknown as {
          __u5test?: { combatPacer?: () => { active: boolean }; game?: { combat: unknown } };
        }).__u5test;
        return !t?.game?.combat || !t.combatPacer!().active;
      },
      undefined,
      { timeout: 90_000 },
    )
    .catch(() => {});
}

/**
 * ¿Quedó un cursor de Aim ABIERTO que este driver no abrió? — LA SEGUNDA MITAD de §8.1.
 *
 * Con PACERS VIVOS (beat>0) el port encadena las armas como el binario (COMSUBS
 * 0x0D96→0x0D3C, `chainNextWeaponAim` main.ts): tras resolver el golpe de un actor con
 * 2-3 ítems que atacan, el Aim del arma SIGUIENTE se abre SOLO, sin tecla. Un driver que
 * sondea estado no lo ve venir: sus flechas de "caminar" mueven el CURSOR (clampado a
 * `range` del arma) y el actor no anda — livelock medido en ch16b (62 rondas, actor
 * congelado en (3,9), 11 enemigos byte-quietos, noProgress→60). Bajo webdriver (beat 0)
 * la cadena NO se arma y esta sonda devuelve siempre false: cero teclas nuevas, digests
 * del régimen test intactos.
 *
 * Remedio cuando está abierto: ESC — `playerAttackCancel` CONSUME el golpe pendiente
 * (fiel: COMSUBS 0x0504 @0x06ea ret 0 → melé "Nothing!" / ranged en silencio) y, agotada
 * la cola, el turno avanza. El resolvedor re-snapshota y sigue con su modelo de un
 * ataque por turno.
 */
async function danglingAimOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const t = (window as unknown as {
      __u5test?: { combatAim?: () => { x: number; y: number } | null };
    }).__u5test;
    return !!t?.combatAim?.();
  });
}

const reached = (p: Pos, tx: number, ty: number, adjacent: boolean): boolean =>
  adjacent ? Math.abs(p.x - tx) + Math.abs(p.y - ty) === 1 : p.x === tx && p.y === ty;

/**
 * Camina la party hasta `(tx,ty)` (o una casilla adyacente si `adjacent`) abriendo
 * puertas regulares en el camino.
 *
 * ADAPTATIVO: los NPC de interior DEAMBULAN (cada paso consume un turno de pueblo y el
 * motor los mueve, deterministamente bajo seed-0). Un NPC que se cruza BLOQUEA el paso
 * (`npcAtTarget`), así que la ruta BFS de una sola pasada se queda obsoleta. Re-snapshotea
 * y re-calcula la ruta cada vez que un paso se bloquea; si TODAS las rutas están
 * momentáneamente bloqueadas, quema un turno (paso contra un muro) para que el NPC se
 * aparte. Determinista y acotado (evita bucles infinitos).
 */
export async function walkTo(
  page: Page,
  tx: number,
  ty: number,
  opts: { adjacent?: boolean } = {},
): Promise<void> {
  const adjacent = opts.adjacent ?? false;
  // F1a (carril tour-telemetry): walkTo EXACTO contra una casilla NO-transitable (lado de
  // cartel empotrado en muro, lápida, valla — bfsPath la admite como goal-cell). Antes:
  // el paso final bumpeaba, el re-ruteo reintentaba y el WAIT_CAP quemaba 16 turnos antes
  // del throw (~17 acciones/intento; ch10 acumuló ×614). Ahora: ruta a la ADYACENTE + UN
  // bump direccional (conserva el eco del (L)ook/registro que el llamador espera) + throw
  // INMEDIATO con el mismo contrato de error (todos los llamadores lo capturan).
  if (!adjacent) {
    const snap0 = await snapshot(page);
    const goalTile = snap0.grid[ty]?.[tx];
    if (isGoalBump(goalTile, adjacent, traversable)) {
      await walkTo(page, tx, ty, { adjacent: true });
      const p = await getPos(page);
      const d = dirOf(tx - p.x, ty - p.y);
      const turnsBefore = await getTurns(page);
      await press(page, ARROW[d]);
      const after = await settle(page, p, turnsBefore);
      await recordWalkStep(page, {
        key: ARROW[d],
        before: p,
        after,
        intended: { x: tx, y: ty },
        plannedTile: goalTile!,
        openedDoor: false,
        goal: { x: tx, y: ty },
      });
      throw new Error(
        `walkTo(${tx},${ty}): no llegó (objetivo no-transitable, tile ${goalTile} — ` +
          `bump único desde ${p.x},${p.y} y aborto inmediato, F1)`,
      );
    }
  }
  // ADAPTATIVO ante obstáculos MÓVILES (NPC deambulantes + guardias con guard_wander, que
  // vagan ~50%/turno). bfsPath ROdea las casillas ocupadas; si un guardia tapona el único
  // corredor, esperamos 1 turno (paso contra un muro, RNG determinista como un jugador que
  // espera a que el guardia se aparte) y re-snapshoteamos. `stall` cuenta esperas SIN
  // progreso neto hacia el objetivo; se resetea al acercarnos. Sube el cap ANTES que otra
  // vía: 3 guardias en un chokepoint estrecho pueden bloquear varios turnos seguidos, pero
  // como se mueven pseudo-aleatoriamente (rand(0,1)) el paso se despeja con paciencia. Un
  // objetivo ESTRUCTURALMENTE inalcanzable (muro/llave) no mejora `bestDist` y agota `stall`
  // rápido → error CLARO con posiciones de los actores para diagnóstico. Determinista bajo
  // seed (mismos movimientos de guardia → misma cuenta de esperas → sellado byte-idéntico).
  const WAIT_CAP = 16; // esperas consecutivas sin progreso antes de declararlo inalcanzable
  let bestDist = Infinity;
  let stall = 0;
  const damper = new OscillationDamper(); // F3: thrash A-B-A-B del re-ruteo
  for (let iter = 0; iter < 300; iter++) {
    const from = await getPos(page);
    if (reached(from, tx, ty, adjacent)) return;
    const dist = Math.abs(from.x - tx) + Math.abs(from.y - ty);
    if (dist < bestDist) {
      bestDist = dist;
      stall = 0; // hubo progreso neto → renueva la paciencia
    }
    // F3 (carril tour-telemetry): si las últimas posiciones oscilan A-B-A-B (dos planes
    // alternando alrededor de un actor móvil; ch12 llegó a ×30 ciclos), ESPERA un turno en
    // vez de volver a pisar la celda anterior — el deambulante se estabiliza y el siguiente
    // plan progresa. Cuenta como stall (paciencia acotada, mismo WAIT_CAP).
    if (damper.next(`${from.x},${from.y}`)) {
      if (++stall > WAIT_CAP) break;
      await burnTurn(page, "walkTo:oscillation-damped");
      continue;
    }
    const snap = await snapshot(page);
    const path = bfsPath(snap, from, { x: tx, y: ty }, adjacent);
    if (!path || path.length === 0) {
      // F1b (carril tour-telemetry): distingue bloqueo TRANSITORIO (un NPC tapa el paso:
      // la MISMA rejilla SIN actores sí tiene ruta → esperar es jugar, como siempre) de
      // INALCANZABILIDAD ESTRUCTURAL (ni sin actores hay ruta: muro/cerrojo/partición —
      // esperar JAMÁS la abre). Antes ambos quemaban los 16 turnos del WAIT_CAP; la
      // tormenta ch12 (×1020 acciones = 60 reintentos × 17) era este bucle dentro del
      // camino-feliz de goToCell. Ahora lo estructural aborta al instante (el llamador
      // — goToCell/approachAndTalk/readSign — ya captura y planifica por otra vía).
      const structural = bfsPath({ ...snap, npc: new Set<string>() }, from, { x: tx, y: ty }, adjacent);
      if (!structural || structural.length === 0) break; // inalcanzable estructural → throw abajo
      // Todas las rutas bloqueadas por un actor móvil (transitorio) → espera y reintenta.
      if (++stall > WAIT_CAP) break;
      await burnTurn(page, "walkTo:no-path");
      continue;
    }
    // Ejecuta la ruta hasta que un paso se bloquee (un actor se cruzó) o termine.
    let moved = false;
    for (const d of path) {
      const before = await getPos(page);
      const [dx, dy] = DELTA[d];
      const nx = before.x + dx,
        ny = before.y + dy;
      const doorAhead = isRegularDoor(snap.grid[ny]![nx]!);
      if (doorAhead) {
        await press(page, "o");
        await press(page, ARROW[d]);
      }
      // Ancla determinista: captura el contador de world-turns JUSTO antes del paso.
      const turnsBefore = await getTurns(page);
      await press(page, ARROW[d]);
      const after = await settle(page, before, turnsBefore);
      // TELEMETRÍA (opt-in U5_TOUR_TELEMETRY, no-op sin env): registra el paso con la
      // casilla PRETENDIDA + tile planificado; si se bloqueó, re-lee NPC/tile vivos del
      // destino (evidencia NPC-bloqueando vs desacuerdo-pasabilidad). Sólo OBSERVA.
      await recordWalkStep(page, {
        key: ARROW[d],
        before,
        after,
        intended: { x: nx, y: ny },
        plannedTile: snap.grid[ny]![nx]!,
        openedDoor: doorAhead,
        goal: { x: tx, y: ty },
      });
      if (after.x !== nx || after.y !== ny) break; // bloqueado → re-snapshot + re-path
      moved = true;
    }
    if (!moved) {
      // Ruta existía pero el PRIMER paso lo bloqueó un actor móvil (guardia oscilando): en vez
      // de re-rutear en bucle contra él (livelock), espera 1 turno para que se aparte.
      if (++stall > WAIT_CAP) break;
      await burnTurn(page, "walkTo:first-step-blocked");
    }
  }
  const end = await getPos(page);
  const blockers = [...(await snapshot(page)).npc].join(" ") || "ninguno";
  throw new Error(
    `walkTo(${tx},${ty}): no llegó (party en ${end.x},${end.y}; NPC/guardias en la planta: ${blockers})`,
  );
}

/**
 * Espera a que el paso se ASIENTE y devuelve la posición resultante (movida o bloqueada,
 * igual que el settle histórico, para que `walkTo` decida re-rutear). Sincronización
 * DETERMINISTA (task #8): el paso está procesado cuando el world-turn lógico avanzó
 * (`turnsSinceStart` > `turnsBefore`) o la posición cambió — ambas señales lógicas, no
 * de reloj. Como el turno se aplica síncrono en el keydown, la condición ya es cierta al
 * entrar: sustituye a la ventana fija de 90 ms sin cambiar QUÉ posición ve `walkTo` (un
 * paso bloqueado sigue devolviendo la casilla previa). El techo es sólo salvaguarda.
 */
async function settle(page: Page, before: Pos, turnsBefore: number): Promise<Pos> {
  await page
    .waitForFunction(
      ({ tb, bx, by }) => {
        const s = (
          window as unknown as {
            __u5test: { state: () => { turnsSinceStart: number; position: { x: number; y: number } } };
          }
        ).__u5test.state();
        return s.turnsSinceStart > tb || s.position.x !== bx || s.position.y !== by;
      },
      { tb: turnsBefore, bx: before.x, by: before.y },
      { timeout: TURN_CEIL_MS, polling: 16 },
    )
    .catch(() => {
      /* techo agotado (p.ej. tecla que no consumió turno): devuelve el estado vivo */
    });
  // F2-T4 (ruling): si el paso BUMPEÓ a un guardia extorsionador y la demanda quedó
  // pendiente, se paga aquí mismo — el prompt se comería las teclas siguientes.
  await payGuardIfPrompted(page);
  return getPos(page);
}

/**
 * Consume un turno de pueblo sin moverse: intenta un paso contra la pared más cercana.
 * Espera DETERMINISTA (task #8) a que el world-turn se registre (el pueblo cobra 1 min
 * al bump de pared → `turnsSinceStart`++), en vez de confiar en el timing: así el
 * llamador (re-ruteo de `walkTo`, persecución de NPC) re-snapshotea SÓLO tras el tick
 * lógico, robusto bajo carga. Misma conducta: un único `press`.
 */
async function burnTurn(page: Page, reason = "wait"): Promise<void> {
  const snap = await snapshot(page);
  const p = await getPos(page);
  // TELEMETRÍA (opt-in): las esperas encadenadas con la misma `reason` son la firma del
  // reintento-de-pather / NPC taponando; se registran ANTES del press (posición estable).
  await recordWaitTurn(page, reason, p);
  // ★ SIN cadencia cine (ficha «paredes» del gate-viewport, 2026-08-23). La espera NO es
  // metraje: la party no se mueve — el paso contra el muro existe SOLO para consumir un
  // world-turn (que el NPC deambule / el schedule circule). Con `U5_VIDEO_TEMPO=cine` la
  // cadencia de 300 ms por tecla convertía las rachas medidas de reintento (ch05: ×60
  // `approach:walkTo-failed` en Minoc f1 (7,26) + ciclos ×30 `pursue:wait-keeper` en
  // (13,5); análogos en ch10/ch12) en 18-22 s de «North / Blocked!» con viewport
  // congelado — a tempo test eran 0,8 s y nadie los veía. MISMAS teclas, MISMOS turnos,
  // mismo RNG ⇒ digests byte-idénticos en los dos regímenes; sólo cambia el reloj del
  // arnés, que es exactamente lo único que tempo-video.mjs tiene permiso de mover.
  const fastPress = async (k: string): Promise<void> => {
    const before = await getTurns(page);
    await page.locator("body").press(k);
    await payGuardIfPrompted(page); // F2-T4: demanda de guardia → pagar (ruling)
    await waitTurnAdvanced(page, before);
  };
  for (const d of ["up", "down", "left", "right"] as Dir[]) {
    const [dx, dy] = DELTA[d];
    const nx = p.x + dx,
      ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= snap.W || ny >= snap.H) continue;
    if (!traversable(snap.grid[ny]![nx]!)) {
      await fastPress(ARROW[d]); // "Blocked!" — 1 min, party no se mueve.
      return;
    }
  }
  await fastPress("ArrowUp"); // fallback
}

/**
 * Posiciona la party en el tile-overworld de la localización `id` (costura de arnés
 * cero-rand `teleportOverworld`) y ENTRA por el mecanismo REAL (`game.enter()`, la
 * tecla (E)). Asevera que la carga dejó a la party dentro de `id`.
 */
export async function enterLocation(page: Page, id: number): Promise<Pos> {
  await page.evaluate((locId) => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const dbg = (window as unknown as { __u5debug: any }).__u5debug;
    dbg.teleportOverworld(g.data.locationsX[locId - 1], g.data.locationsY[locId - 1]);
  }, id);
  await press(page, "e"); // (E)nter REAL
  const p = await getPos(page);
  expect(p.location, `enterLocation(${id}) debe cargar el small map`).toBe(id);
  return p;
}

/**
 * Ejecuta un comando DIRECCIONAL del juego ((L)ook/(S)earch/(T)alk/(O)pen) hacia la
 * casilla `(tx,ty)`, caminando antes a una casilla adyacente. Devuelve las últimas
 * líneas del log del HUD tras el comando.
 */
export async function faceCommand(
  page: Page,
  cmd: "l" | "s" | "t" | "o",
  tx: number,
  ty: number,
): Promise<string[]> {
  await walkTo(page, tx, ty, { adjacent: true });
  const p = await getPos(page);
  const d = dirOf(tx - p.x, ty - p.y);
  await press(page, cmd);
  await press(page, ARROW[d]);
  // (S)earch pide PJ con party>1 sin activo (kernel resolve_command_char 0x4988,
  // C6 carril cadenas-presentacion): «Player: » + select de roster. El guion no fija
  // miembro → confirma el cursor (Enter = miembro 0), como haría el jugador.
  if (cmd === "s") {
    const picking = await page
      .evaluate(() => (window as unknown as { __u5test: { partySelectOpen?: () => boolean } }).__u5test.partySelectOpen?.() ?? false)
      .catch(() => false);
    if (picking) await press(page, "Enter");
  }
  return consoleTail(page, 4);
}

/**
 * Lee una señal en `(sx,sy)`: las plaquetas van embutidas en muro y sólo se leen desde
 * el lado abierto, así que probamos cada casilla adyacente ALCANZABLE y (L)ook hacia la
 * señal hasta obtener "A sign reads:". Devuelve true si se leyó. Reutilizable.
 */
/**
 * ¿Contienen estas líneas de consola un CUERPO de cartel? (re-baseline 2026-07-20:
 * la prosa «A sign reads:» era fabricada y se purgó — los carteles imprimen su cuerpo
 * multilínea fiel). Cuerpo = línea que no es el ECO exacto del comando («Look»/dirección
 * a solas — un cartel puede CONTENER «NORTH BRITAIN», el filtro es de línea-eco, no de
 * substring) ni el fallback de terreno.
 */
export function signBodyIn(lines: string[]): boolean {
  return lines.some(
    (l) =>
      l.trim().length > 0 &&
      // Eco del comando (L)ook: "Look-North" (el despachador imprime el guión, getdir la
      // dirección — re-derivado del asm 0x3310/0x3332). El `[\s-]*` tolera el guión.
      !/^\s*(?:(?:north|south|east|west)[\s-]*)?look[\s-]*(?:north|south|east|west)?\s*$/i.test(l) &&
      !/^\s*(?:north|south|east|west)\s*$/i.test(l) &&
      !/thou dost see/i.test(l),
  );
}

export async function readSign(
  page: Page,
  sx: number,
  sy: number,
  expected?: string | RegExp,
): Promise<boolean> {
  // Re-baseline 2026-07-20: la prosa «A sign reads:» era FABRICADA y se purgó — el
  // letrero imprime ahora su CUERPO multilínea fiel (LOOKOBJ decode_sign_text 0x06F8).
  // La detección pasa a ser por CONTENIDO: `expected` (substring/regex del cuerpo) o,
  // por defecto, ≥2 líneas nuevas de cuerpo (los carteles son multilínea).
  for (const d of ["up", "down", "left", "right"] as Dir[]) {
    const [dx, dy] = DELTA[d];
    const ax = sx - dx,
      ay = sy - dy; // casilla adyacente desde la que se mira hacia (sx,sy) en dir d
    try {
      await walkTo(page, ax, ay);
    } catch (e) {
      rethrowIfFatal(e);
      continue; // lado inalcanzable
    }
    await press(page, "l");
    await press(page, ARROW[d]);
    // Las líneas FRESCAS del (L)ook son las de DETRÁS del último eco «Look-<Dir>» del ring.
    // El slice aritmético histórico (`tail.slice(min(before, len-1))`) quedó CIEGO tras #198:
    // la consola es un RING de 12 (coreview CONSOLE_LINES) — con el ring lleno `before==len`
    // y «fresh» se reducía a LA ÚLTIMA LÍNEA, que desde el decode byte-exacto de SIGNS.DAT
    // (#198: el cuerpo lleva filas de AIRE de cabecera/cola) es SIEMPRE una fila en blanco.
    // El eco lo imprime el despachador («Look» + guión + getdir, asm 0x3310/0x3332) y es la
    // frontera REAL entre lo viejo y la respuesta de este comando.
    const tail = await consoleTail(page, 12);
    let iLook = -1;
    for (let i = 0; i < tail.length; i++) {
      if (/^\s*look[\s-]*(?:north|south|east|west)?\s*$/i.test(tail[i] ?? "")) iLook = i;
    }
    // Si el eco ya NO está en el ring es que el cuerpo lo EMPUJÓ fuera (cartel largo, p. ej.
    // el de dos estrofas de Trinsic (15,28): 9 filas + aire > 12): entonces TODO el ring es
    // más fresco que el eco y se lee entero. slice(-1) aquí leería una fila de aire y cegaría
    // los carteles largos exactamente como el slice aritmético cegaba todos.
    const fresh = iLook >= 0 ? tail.slice(iLook + 1) : tail;
    const text = fresh.join(" ");
    if (expected != null) {
      const ok = typeof expected === "string" ? text.includes(expected) : expected.test(text);
      if (ok) return true;
    } else {
      if (signBodyIn(fresh)) return true;
    }
  }
  return false;
}

/** (K)limb: la party debe estar sobre una escalera/reja; cambia de planta. */
export async function klimb(page: Page): Promise<Pos> {
  await press(page, "k");
  return getPos(page);
}

/** Posición viva del NPC con ese `dialogNumber` en la planta actual (o null). */
async function findNpc(page: Page, dialogNumber: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate((dn) => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const p = g.state.position;
    const n = (g.npcManager?.npcsAt(p.location, p.floor) ?? []).find((npc: any) => npc.dialogNumber === dn);
    return n ? { x: n.x, y: n.y } : null;
  }, dialogNumber);
}

/**
 * Localiza al NPC en CUALQUIER planta de la localización actual (los NPC con horario se
 * mueven entre plantas al pasar las horas). Devuelve `{x,y,floor}` o null si no está.
 */
async function findNpcAnyFloor(
  page: Page,
  dialogNumber: number,
): Promise<{ x: number; y: number; floor: number } | null> {
  return page.evaluate((dn) => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const loc = g.state.position.location;
    for (const f of [-1, 0, 1, 2, 3]) {
      const n = (g.npcManager?.npcsAt(loc, f) ?? []).find((npc: any) => npc.dialogNumber === dn);
      if (n) return { x: n.x, y: n.y, floor: f };
    }
    return null;
  }, dialogNumber);
}

/**
 * Se acerca al NPC de `dialogNumber` (deambula) y ejecuta (T)alk en su dirección. Reintenta
 * si se mueve entre localizarlo y alcanzarlo. Compartido por `talkToNpc` y `buyFromShop`.
 */
async function approachAndTalk(
  page: Page,
  dialogNumber: number,
  opts: { recoverPartition?: boolean; allowLocked?: boolean } = {},
): Promise<void> {
  const recoverPartition = opts.recoverPartition ?? false;
  // NOTA F2 (carril tour-telemetry, FALSIFICADO en la pasada-1 del resello): la espera
  // AGRUPADA (5 turnos por fallo repetido, RetryThrottle) quemaba 5× tiempo de JUEGO por
  // reintento → deriva del reloj → ventanas de schedule perdidas (ch05: el herrero se
  // acuesta en un bolsillo inalcanzable de f1 y la venta muere a los 150 turnos). La
  // tormenta de ACCIONES que F2 quería matar (ch12 ×1020) ya la mata F1b (el fail-fast
  // estructural elimina los 16 burnTurns del WAIT_CAP por reintento, SIN turnos extra).
  // Se conserva la espera histórica de 1 turno por fallo; RetryThrottle queda en
  // nav-tactics como primitiva unit-testeada NO cableada.
  const waitAfterFailure = async (reason: string): Promise<void> => {
    await burnTurn(page, reason);
  };
  for (let iter = 0; iter < 60; iter++) {
    const target = await findNpcAnyFloor(page, dialogNumber);
    if (!target) throw new Error(`approachAndTalk(${dialogNumber}): NPC no está en la localización`);
    if (recoverPartition) {
      // OPT-IN: navegación COMPLETA por el grafo de componentes (goToCell): multi-nivel,
      // sanctums de CUALQUIER planta (incl. z0 vía z1), escaleras-de-pisar y puertas con
      // llave (allowLocked). Reemplaza el climb/walkTo/reenterFloorComponent de un nivel.
      // Si el NPC deambuló durante el viaje, goToCell puede fallar → quema turno y reintenta.
      // EXCEPCIÓN irrecuperable: si la ruta requería una puerta con cerrojo y no quedan llaves
      // (KeysExhaustedError), reintentar es fútil (8×60 nav en vano, ~7 min de thrash — lo
      // diagnosticó ch08). Aborta de inmediato con un error DESCRIPTIVO. Tarea #58.
      try {
        await goToCell(page, target.x, target.y, target.floor, { adjacent: true, allowLocked: opts.allowLocked });
      } catch (e) {
        rethrowIfFatal(e);
        if (e instanceof KeysExhaustedError) {
          throw new Error(
            `approachAndTalk(${dialogNumber}): llaves agotadas y la ruta requiere una puerta con ` +
              `cerrojo (${e.message}) — irrecuperable, no se reintenta (task #58)`,
          );
        }
        await waitAfterFailure("approach:goToCell-failed");
        continue;
      }
    } else {
      // Camino HISTÓRICO byte-idéntico (capítulos sellados que NO pasan el flag).
      const here0 = await getPos(page);
      if (target.floor !== here0.floor) {
        await climbLadder(page, target.floor > here0.floor ? "up" : "down");
        continue;
      }
      // El NPC-objetivo puede quedar momentáneamente tapado por OTRO NPC deambulante
      // (bloqueo TRANSITORIO): quema un turno para que se aparte y reintenta el bucle.
      try {
        await walkTo(page, target.x, target.y, { adjacent: true });
      } catch (e) {
        rethrowIfFatal(e);
        await waitAfterFailure("approach:walkTo-failed");
        continue;
      }
    }
    const here = await getPos(page);
    const now = await findNpc(page, dialogNumber);
    if (!now || Math.abs(now.x - here.x) + Math.abs(now.y - here.y) !== 1) continue; // se movió: reintenta
    const d = dirOf(now.x - here.x, now.y - here.y);
    await press(page, "t");
    await press(page, ARROW[d]);
    return;
  }
  throw new Error(`approachAndTalk(${dialogNumber}): no se pudo enganchar (NPC deambulante)`);
}

/**
 * (T)alk con el NPC conversable de `dialogNumber` por el mecanismo REAL: localiza su casilla
 * VIVA, se acerca, habla y cierra con "bye" (input vacío). Aseverar que el panel de diálogo
 * se abrió prueba el enganche real.
 */
export async function talkToNpc(
  page: Page,
  dialogNumber: number,
  opts: { recoverPartition?: boolean; allowLocked?: boolean } = {},
): Promise<void> {
  const dialog = page.locator(".dialogue-panel:visible");
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dialogNumber, opts);
    // El NPC pudo moverse justo antes del (T)alk → "Funny, no response!" (sin panel):
    // reintenta el acercamiento.
    if (!(await dialogOpened(page, dialog))) continue;
    await closeDialog(page, dialog, dialogNumber);
    return;
  }
  throw new Error(`talkToNpc(${dialogNumber}): no se pudo dialogar (NPC deambulante)`);
}

/**
 * Como `talkToNpc` PERO DEJA EL DIÁLOGO ABIERTO (no envía "bye" ni cierra). Para specs que
 * necesitan CONDUCIR el panel a mano (p.ej. reproducir la carrera del auto-cierre, #60).
 * Reutiliza `approachAndTalk`/`dialogOpened` → mismo enganche robusto ante deambulantes.
 * ADITIVO: no lo usan los capítulos sellados, así que no toca su determinismo byte-exacto.
 */
export async function openTalkNpc(
  page: Page,
  dialogNumber: number,
  opts: { recoverPartition?: boolean; allowLocked?: boolean } = {},
): Promise<void> {
  const dialog = page.locator(".dialogue-panel:visible");
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dialogNumber, opts);
    if (await dialogOpened(page, dialog)) return;
  }
  throw new Error(`openTalkNpc(${dialogNumber}): no se pudo abrir el diálogo (NPC deambulante)`);
}

/**
 * Envía UN token al input del diálogo (fill + Enter) con techo por acción. Si el panel
 * DESAPARECIÓ a mitad de secuencia (la carrera del auto-cierre, #60), el `press` no encuentra
 * `.dialogue-panel:visible >> input` y, sin techo, colgaría hasta el timeout de test (300 s);
 * con techo lanza un error DESCRIPTIVO que nombra la carrera — futuros diagnósticos lo
 * agradecerán. El timing entre inputs NO consume world-turns → cero efecto en bytes del sello.
 */
async function sendDialogToken(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  token: string,
  ctx: string,
): Promise<void> {
  // Piel fiel/shader: la keyword se TECLEA por el getstring de consola (main.ts handler
  // `text`) — teclas crudas + Enter. Token vacío = "bye" (Enter en buffer vacío, que el
  // intérprete trata como despedida). No hay panel DOM que consultar.
  if (await isConsoleTalk(page)) {
    // Guarda gemela de la del DOM (#60): si la charla ya cerró, teclear enviaría comandos al
    // MAPA (mover/actuar) en vez de la keyword → error descriptivo antes de corromper el estado.
    if (!(await dialogOpened(page, dialog))) {
      throw new Error(
        `${ctx}: la conversación de consola ya CERRÓ antes de enviar "${token}" ` +
          `(secuencia que terminó la charla antes de tiempo)`,
      );
    }
    if (token.length > 0) await page.keyboard.type(token);
    await page.keyboard.press("Enter");
    return;
  }
  const input = dialog.locator("input");
  try {
    await input.fill(token, { timeout: DIALOG_CEIL_MS });
    await input.press("Enter", { timeout: DIALOG_CEIL_MS });
  } catch (err) {
    if (!(await dialog.isVisible().catch(() => false))) {
      throw new Error(
        `${ctx}: el panel de diálogo se CERRÓ a mitad de secuencia al enviar "${token}" ` +
          `(carrera del auto-cierre de diálogo, task #60)`,
      );
    }
    throw err;
  }
}

/**
 * Como `talkToNpc`, pero antes de cerrar TECLEA una `keyword` (p.ej. "word", "job",
 * "name") y devuelve la RESPUESTA del NPC. Sirve para extraer/verificar contenido de
 * diálogo — Words of Power ("word" → "FALLAX !"), oficios, etc. — por el mecanismo real.
 * Reutilizable por cualquier capítulo (words of power, quests).
 */
export async function talkToNpcAsking(
  page: Page,
  dialogNumber: number,
  keyword: string,
  opts: { recoverPartition?: boolean; allowLocked?: boolean } = {},
): Promise<string> {
  const dialog = page.locator(".dialogue-panel:visible");
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dialogNumber, opts);
    if (!(await dialogOpened(page, dialog))) continue;
    // #180·D6: con NPC DESCONOCIDO la apertura puede traer la sección 0 CON OPS
    // (AskName): «What is thy name?» + "You respond-" con el getstring ya abierto —
    // el primer input pendiente es ESA pregunta, no la keyword. Contéstala (el nombre
    // da igual para el flujo: el script responde y cae al bucle de "Your interest?")
    // y deja la keyword para el prompt real. Aditivo: sin AskName de apertura no entra.
    const opening = await readDialogText(page, dialog);
    if (/What is thy name\?/.test(opening) && !opening.includes("Your interest?")) {
      await sendDialogToken(page, dialog, "Avatar", `askname(${dialogNumber})`);
      await waitDialogGrew(page, opening);
    }
    const prevText = await readDialogText(page, dialog);
    await sendDialogToken(page, dialog, keyword, `talkToNpcAsking(${dialogNumber}, ${keyword})`);
    // Espera CONDICIONAL a que la respuesta del NPC aterrice, en vez de un sleep fijo de 150 ms
    // (task #8). Mode-aware (consola/DOM). Techo generoso como salvaguarda: si no avanza
    // (respuesta vacía), lee lo que haya, igual que antes.
    await waitDialogGrew(page, prevText);
    const history = await readDialogText(page, dialog);
    await closeDialog(page, dialog, dialogNumber);
    return history;
  }
  throw new Error(`talkToNpcAsking(${dialogNumber}, ${keyword}): no se pudo dialogar`);
}

/**
 * Como `talkToNpcAsking`, pero TECLEA una SECUENCIA de inputs en orden (una keyword que salta
 * a una Label + la respuesta a un AskName, o varios "y" de una interacción con coste). Sirve
 * para testigos MULTI-PASO que un solo keyword no puede disparar (Fenelon: 'wond'→AskName→
 * nombre→KarmaPlusOne×5; Delwyn: 'y'→Gold=3→'y'→pista; Fiona: 'grea'→'anno'→nombre→'word'→WoP).
 * Devuelve el historial acumulado. ADITIVO, simétrico a talkToNpcAsking; reutiliza
 * approachAndTalk (con recoverPartition opt-in para NPCs de plantas particionadas, p.ej. Fiona).
 */
export async function talkToNpcSequence(
  page: Page,
  dialogNumber: number,
  inputs: string[],
  opts: { recoverPartition?: boolean; allowLocked?: boolean } = {},
): Promise<string> {
  const dialog = page.locator(".dialogue-panel:visible");
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dialogNumber, opts);
    if (!(await dialogOpened(page, dialog))) continue;
    // #180·D6 — GUARDA DE AskName DE APERTURA, calcada de `talkToNpcAsking` (:869-872).
    // Con NPC DESCONOCIDO la apertura puede traer la sección 0 CON OPS: «What is thy name?»
    // + "You respond-" con el getstring YA abierto. Sin la guarda, el PRIMER token de la
    // SECUENCIA se consume como el NOMBRE y la keyword nunca llega a su prompt. Medido
    // verbatim en el tour del 30-07 (`re/notes/tour-adjudicacion-3007.md` §5.1, Tetsuo
    // towne/44 en ch09): el log enseña `You respond- :virt` seguido de «If you say so...» y
    // sólo ENTONCES «Your interest?». Aditivo: sin AskName de apertura no entra.
    const opening = await readDialogText(page, dialog);
    if (/What is thy name\?/.test(opening) && !opening.includes("Your interest?")) {
      await sendDialogToken(page, dialog, "Avatar", `askname(${dialogNumber})`);
      await waitDialogGrew(page, opening);
    }
    // En DOM el historial del panel es ACUMULATIVO (una sola lectura al final basta). En
    // CONSOLA el ring de 12 líneas puede desplazar respuestas viejas, así que ACUMULAMOS el
    // texto tras cada token para que el retorno contenga toda la secuencia (los specs asertan
    // substrings de varios pasos vía `.toContain`; la posible duplicación es inocua).
    const consoleMode = await isConsoleTalk(page);
    let accumulated = consoleMode ? await readDialogText(page, dialog) : "";
    for (const token of inputs) {
      // Espera CONDICIONAL a que aterrice la respuesta / el siguiente prompt de CADA token,
      // en vez de un sleep fijo de 150ms (task #8). El timing entre inputs de diálogo NO
      // consume world-turns → cero efecto en bytes del sello (los efectos KarmaPlusOne/Gold
      // se aplican síncronos al Enter); sólo hace la lectura robusta bajo carga. Mode-aware.
      const prevText = await readDialogText(page, dialog);
      await sendDialogToken(page, dialog, token, `talkToNpcSequence(${dialogNumber}, [${inputs.join(",")}])`);
      await waitDialogGrew(page, prevText);
      if (consoleMode) accumulated += "\n" + (await readDialogText(page, dialog));
    }
    const history = consoleMode ? accumulated : await readDialogText(page, dialog);
    await closeDialog(page, dialog, dialogNumber);
    return history;
  }
  throw new Error(`talkToNpcSequence(${dialogNumber}, [${inputs.join(",")}]): no se pudo dialogar`);
}

/**
 * ¿Se abrió el panel de diálogo tras el (T)alk? Usa la señal LÓGICA `__u5test.dialogueOpen()`
 * (task #8), que refleja `dialoguePanel.visible` — marcado SÍNCRONO en el keydown del
 * (T)alk: un enganche exitoso lo deja abierto; un "Funny, no response!" (NPC que se movió)
 * lo deja cerrado. Independiente del render → sin techo de reloj ni falso negativo bajo
 * carga, y SIN penalizar la ruta de fallo legítima (retorna false al instante, no tras un
 * timeout). Fallback al sondeo del DOM con techo generoso si el hook no está.
 */
async function dialogOpened(page: Page, dialog: ReturnType<Page["locator"]>): Promise<boolean> {
  const logical = await page.evaluate(
    () =>
      (window as unknown as { __u5test: { dialogueOpen?: () => boolean } }).__u5test.dialogueOpen?.() ??
      null,
  );
  if (logical !== null) return logical;
  if (await dialog.isVisible().catch(() => false)) return true;
  return dialog
    .waitFor({ state: "visible", timeout: DIALOG_CEIL_MS })
    .then(() => true)
    .catch(() => false);
}

/**
 * Cierra el diálogo por el mecanismo REAL: "bye". Los NPC normales terminan (auto-hide
 * 600 ms, dialogue.ts:90). Los ESPECIALES (Gwenno y otros joinables) responden al "bye"
 * con una re-pregunta y NO cierran → Escape es la salida real (main.ts window-handler);
 * el root del panel corta la propagación del keydown, así que se hace blur del input ANTES.
 */
async function closeDialog(page: Page, dialog: ReturnType<Page["locator"]>, dialogNumber: number): Promise<void> {
  if (await isConsoleTalk(page)) {
    // Consola: "bye" por teclado cierra los NPC normales; los ESPECIALES (joinables) re-
    // preguntan → Escape (el handler `text` del getstring cancela y cierra la charla). La
    // señal de cierre es `dialogueOpen()` en falso (conversation == null), independiente de
    // piel. No hay panel DOM que ocultar.
    if (await dialogOpened(page, dialog)) {
      await page.keyboard.type("bye");
      await page.keyboard.press("Enter");
    }
    if (await dialogOpened(page, dialog)) await page.keyboard.press("Escape");
    await expect
      .poll(() => dialogOpened(page, dialog), { timeout: DIALOG_CEIL_MS })
      .toBe(false);
    return;
  }
  const input = dialog.locator("input");
  await input.fill("bye", { timeout: DIALOG_CEIL_MS });
  await input.press("Enter", { timeout: DIALOG_CEIL_MS });
  if (await dialog.isVisible().catch(() => false)) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Escape");
  }
  await expect(dialog, `(T)alk con dialog ${dialogNumber} debe cerrar`).toBeHidden({ timeout: DIALOG_CEIL_MS });
}

/**
 * PERSIGUE a un mercader DEAMBULANTE (aiType 1, dialog 0x81-0x88) y le (T)alk para abrir la
 * tienda. En vez de `walkTo` a una posición CAPTURADA —que un wanderer deja obsoleta cada
 * paso y por eso approachAndTalk lo pierde cuando el reloj de entrada cambia (herrero de
 * Britain/Minoc)—, da UN paso hacia su celda ACTUAL y re-evalúa cada turno, como un humano.
 * ACOTADO por `budget` turnos → throw honesto (nada de bucles sin techo, lección del sanctum).
 * Consume turnos REALES del juego (afecta reloj/economía del capítulo — declararlo en el spec).
 * Determinista bajo seed-0: el mismo baile del NPC produce la misma captura → sello ×2 estable.
 */
async function pursueAndTalk(page: Page, dialogNumber: number, budget = 300): Promise<void> {
  // NOTA F3 (carril tour-telemetry, lección de la pasada-1 del resello): aquí NO va el
  // OscillationDamper. Perseguir a un wanderer que oscila produce el baile espejo
  // A-B-A-B legítimo (es TRACKING, no thrash: el header documenta que el mismo baile
  // produce la misma captura); meter holds rompió la captura del herrero de ch05
  // (pursueAndTalk(129) agotó los 150 turnos). El damper se queda SOLO en walkTo
  // (objetivo estático, donde re-pisar A-B-A-B sí es desperdicio).
  // DES-ACAMPE de escalera (lección del resello, diagnóstico por sonda de Minoc f1): la
  // escalera del piso del mercader puede aterrizar en un chokepoint de 1 celda (13,5 f1:
  // tres muros + un solo vecino). Si la party ACAMPA ahí esperando path, (a) el vecino
  // taponado por otro NPC nunca se libera hacia ella y (b) la propia party BLOQUEA la
  // única bajada del mercader → interbloqueo. Un jugador real no acampa la trampilla:
  // baja, espera al tendero EN LA TIENDA y vuelve a subir si hace falta. `noPath` cuenta
  // esperas sin ruta; a las 10, si estamos sobre una escalera, klimb de vuelta y espera
  // ABAJO `WAIT_DOWNSTAIRS` turnos (el schedule/wander del NPC circula) antes de re-seguir.
  let noPath = 0;
  let waitDownstairs = 0;
  const NOPATH_UNCAMP = 10;
  const WAIT_DOWNSTAIRS = 30;
  for (let iter = 0; iter < budget; iter++) {
    const npc = await findNpcAnyFloor(page, dialogNumber);
    if (!npc) throw new Error(`pursueAndTalk(${dialogNumber}): NPC no está en la localización`);
    const here = await getPos(page);
    if (npc.floor !== here.floor) {
      if (waitDownstairs > 0) {
        waitDownstairs--;
        await burnTurn(page, "pursue:wait-keeper");
        continue;
      }
      await climbLadder(page, npc.floor > here.floor ? "up" : "down");
      continue;
    }
    waitDownstairs = 0; // mismo piso: el seguimiento normal manda
    if (Math.abs(npc.x - here.x) + Math.abs(npc.y - here.y) === 1) {
      await press(page, "t");
      await press(page, ARROW[dirOf(npc.x - here.x, npc.y - here.y)]);
      return;
    }
    // UN paso hacia su celda ACTUAL (primer tramo del BFS adyacente al wanderer).
    const snap = await snapshot(page);
    const path = bfsPath(snap, here, { x: npc.x, y: npc.y }, true);
    if (!path || path.length === 0) {
      noPath++;
      if (noPath >= NOPATH_UNCAMP) {
        const tile = await tileAtLive(page, here.x, here.y);
        if (tile === LADDER_UP || tile === LADDER_DOWN) {
          await klimb(page); // des-acampa el chokepoint (libera la trampilla al NPC)
          waitDownstairs = WAIT_DOWNSTAIRS;
          noPath = 0;
          continue;
        }
      }
      await burnTurn(page, "pursue:no-path"); // tapado momentáneamente → pasa un turno y re-evalúa
      continue;
    }
    noPath = 0;
    const d = path[0]!;
    const [dx, dy] = DELTA[d];
    const nx = here.x + dx;
    const ny = here.y + dy;
    if (isRegularDoor(snap.grid[ny]![nx]!)) {
      await press(page, "o");
      await press(page, ARROW[d]);
    }
    const turnsBefore = await getTurns(page);
    await press(page, ARROW[d]);
    const after = await settle(page, here, turnsBefore);
    // TELEMETRÍA (opt-in): el paso de persecución también cuenta (antes no se registraba).
    await recordWalkStep(page, {
      key: ARROW[d],
      before: here,
      after,
      intended: { x: nx, y: ny },
      plannedTile: snap.grid[ny]![nx]!,
      openedDoor: false,
      goal: { x: npc.x, y: npc.y },
    });
  }
  throw new Error(`pursueAndTalk(${dialogNumber}): no se alcanzó en ${budget} turnos (mercader deambulante)`);
}

/**
 * Compra `itemLabel` (p.ej. "Bow — 100 gp") en la tienda del mercader `dialogNumber`
 * (dialog 0x81-0x88): PERSIGUE al mercader (deambulante), habla para abrir el ShopPanel,
 * pulsa "Buy" en la fila del ítem y sale con "Leave". El coste byte-exacto del oro lo asevera
 * el capítulo alrededor de la llamada (lee `gold` antes/después). La PERSECUCIÓN consume
 * turnos reales (afecta el reloj del capítulo — declararlo en el spec).
 */
/** Instantánea de la tienda por consola (fiel/shader), o null en piel dev (panel DOM). */
async function readShopConsole(
  page: Page,
): Promise<{ type: string; phase: string; options: { key: string; label: string }[] } | null> {
  return page.evaluate(
    () =>
      (window as unknown as { __u5test: { shopConsole?: () => unknown } }).__u5test.shopConsole?.() as
        | { type: string; phase: string; options: { key: string; label: string }[] }
        | null ?? null,
  );
}

/** Espera a que haya (o no) una tienda abierta, en CUALQUIER presentación (DOM o consola). */
async function waitShopOpen(page: Page, open: boolean): Promise<void> {
  await page.waitForFunction(
    (o) =>
      ((window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false) === o,
    open,
    { timeout: PANEL_CEIL_MS },
  );
}

/**
 * Conduce la COMPRA en la tienda por CONSOLA (fiel/shader): lee el snapshot lógico
 * (`__u5test.shopConsole`), pulsa la tecla de "Buy" si el menú la ofrece (herrero),
 * localiza la opción cuyo label contiene `itemLabel`, pulsa su letra y sale con Space.
 * MISMO efecto de estado que la vía DOM (mismas funciones del core) → sello intacto.
 */
async function shopConsoleBuySell(
  page: Page,
  dialogNumber: number,
  itemLabel: string,
  verb: "Buy" | "Sell",
): Promise<void> {
  await waitShopOpen(page, true);
  let snap = await readShopConsole(page);
  if (!snap) throw new Error(`${verb.toLowerCase()}FromShop(${dialogNumber}): la tienda por consola no abrió`);
  // Herrero: PAUSA de pacing del saludo (getkey SHOPPES 0x83dc, carril i18n-restos):
  // cualquier tecla (descartada) imprime `$ says,` + la pregunta y arma el menú.
  if (snap.phase === "blacksmith-pause") {
    await press(page, "Enter");
    snap = await readShopConsole(page);
    if (!snap) throw new Error(`${verb.toLowerCase()}FromShop(${dialogNumber}): la pausa no continuó al menú`);
  }
  // Herrero: el menú ofrece Buy/Sell antes de la lista; otros mercaderes listan directo.
  const verbOpt = snap.options.find((o) => o.label === verb);
  if (verbOpt) {
    await press(page, verbOpt.key);
    snap = await readShopConsole(page);
    if (!snap) throw new Error(`${verb.toLowerCase()}FromShop(${dialogNumber}): la lista no se abrió`);
  }
  const itemIdx = snap.options.findIndex((o) => o.label.includes(itemLabel));
  if (itemIdx < 0) {
    throw new Error(
      `${verb.toLowerCase()}FromShop(${dialogNumber}): "${itemLabel}" no está en la lista de consola ` +
        `(${snap.options.map((o) => o.label).join(" | ")})`,
    );
  }
  if (verb === "Buy") {
    await press(page, snap.options[itemIdx]!.key);
    // HERRERO (carril buy-herrero): la letra ya NO compra directo — imprime el PITCH
    // del ítem (buy_one_item SHOPPES 0x09ac, plantilla con %=precio) y espera 'Y'/'N'
    // (fase buy-deal). La compra ejecuta con 'Y' y el conductor re-lista (0x0c49).
    // Otros mercaderes (reactivos/gremio/astillero) siguen comprando con la letra.
    if (snap.type === "Blacksmith") {
      await page.waitForFunction(
        () =>
          ((window as unknown as { __u5test: { shopConsole?: () => unknown } }).__u5test.shopConsole?.() as
            | { phase?: string }
            | null)?.phase === "buy-deal",
        undefined,
        { timeout: PANEL_CEIL_MS },
      );
      await press(page, "y");
    }
    await press(page, "Space"); // Leave (despedida)
    await waitShopOpen(page, false);
    return;
  }
  // SELL (T-004b): la lista vive en la ventana «Arms» del panel (`openArmsPicker`,
  // reductor shopArmsKey) — se navega con ↓ hasta la fila (mismo orden que el
  // snapshot) y se vende con Enter. FIX PREEXISTENTE (adjudicado contra BASE main
  // 67fb913f): este helper seguía pulsando la LETRA (flujo pre-T-004b) y el picker
  // la traga → la tienda nunca cerraba y ch05 llevaba roto desde el aterrizaje de
  // la ventana. Tras vender, el conductor re-abre la ventana con filas frescas:
  // Escape la cancela (→ menú Buy/Sell) o, si no quedaba nada vendible (sin
  // ventana), sale ya con la despedida; el Space final cierra desde el menú.
  for (let i = 0; i < itemIdx; i++) await press(page, "ArrowDown");
  await press(page, "Enter"); // elige la fila del cursor → OFERTA + Deal? Y/N (sell_one_item 0xe76)
  // Carril sell-offers: el Enter ya no vende directo — el tendero hace su oferta
  // (plantilla rand(0,7), %=precio &=nombre) y espera 'Y'/'N'; 'y' cierra el trato.
  await page.waitForFunction(
    () =>
      ((window as unknown as { __u5test: { shopConsole?: () => unknown } }).__u5test.shopConsole?.() as
        | { phase?: string }
        | null)?.phase === "sell-deal",
    undefined,
    { timeout: PANEL_CEIL_MS },
  );
  await press(page, "y"); // acepta la oferta → venta (Done!)
  await press(page, "Escape"); // cancela la ventana re-abierta (o despedida si no hay)
  if (await page.evaluate(() => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false)) {
    await press(page, "Space"); // Leave desde el menú (despedida)
  }
  await waitShopOpen(page, false);
}

export async function buyFromShop(page: Page, dialogNumber: number, itemLabel: string): Promise<void> {
  await pursueAndTalk(page, dialogNumber);
  if (await isConsoleTalk(page)) {
    await shopConsoleBuySell(page, dialogNumber, itemLabel, "Buy");
    return;
  }
  const panel = page.locator(".save-panel:visible").filter({ has: page.locator(".shop-leave") });
  await expect(panel, `(T)alk con el mercader ${dialogNumber} debe abrir la tienda`).toBeVisible({ timeout: PANEL_CEIL_MS });
  const row = panel.locator(".save-slot").filter({ hasText: itemLabel });
  await row.getByRole("button", { name: "Buy" }).click();
  await panel.locator(".shop-leave").click();
  await expect(panel).toBeHidden({ timeout: PANEL_CEIL_MS });
}

/**
 * Vende UNA unidad del equipo cuya fila contiene `itemLabel` (p.ej. "Flaming Oil") en la
 * tienda del herrero `dialogNumber`: abre el ShopPanel, pulsa "Sell" en esa fila y sale con
 * "Leave". SIMÉTRICO a buyFromShop (PERSIGUE al mercader deambulante — pursueAndTalk). El
 * ingreso byte-exacto lo asevera el capítulo (lee `gold` antes/después); la herrería compra
 * cualquier equipo con base>0 (shop.ts). Fuente sancionada de oro para capítulos con déficit
 * (VÍA A): vender un ítem PRESCINDIBLE ANTES de comprar.
 */
export async function sellFromShop(page: Page, dialogNumber: number, itemLabel: string): Promise<void> {
  await pursueAndTalk(page, dialogNumber);
  if (await isConsoleTalk(page)) {
    await shopConsoleBuySell(page, dialogNumber, itemLabel, "Sell");
    return;
  }
  const panel = page.locator(".save-panel:visible").filter({ has: page.locator(".shop-leave") });
  await expect(panel, `(T)alk con el mercader ${dialogNumber} debe abrir la tienda`).toBeVisible({ timeout: PANEL_CEIL_MS });
  const row = panel.locator(".save-slot").filter({ hasText: itemLabel });
  await row.getByRole("button", { name: "Sell" }).click();
  await panel.locator(".shop-leave").click();
  await expect(panel).toBeHidden({ timeout: PANEL_CEIL_MS });
}

/**
 * Tiles que el (K)limb de combate acepta. Son TRES, no dos: 200=sube (0xC8), 201=baja
 * (0xC9) y **134 Grate (0x86), que baja y SÓLO vale en combate de SALA** (`cmd_klimb_combat`
 * SJOG 0x1df4 + el `test [g_unk_58a1],0x80` de 0x1dfb). Este comentario decía «escaleras de
 * mano: 200 y 201» y se dejaba el tercero — el mismo recorte que tenían el motor
 * (`playerKlimbEscape`) y la nota de la que ambos se derivaron (`town-klimb.md` §32).
 */
const LADDER_UP = 200;
const LADDER_DOWN = 201;
const GRATE_TILE = 134;

/**
 * ¿Es `to` alcanzable ESTRUCTURALMENTE (o queda adyacente) en la planta ACTUAL? Read-only
 * (no consume turnos). Responde la pregunta de COMPONENTE (topología de muros), así que
 * IGNORA los NPC deambulantes: un NPC que tapa el paso es un bloqueo transitorio que
 * `walkTo` ya resuelve (burnTurn/re-ruteo), no una partición de planta.
 */
async function canReach(page: Page, to: { x: number; y: number }): Promise<boolean> {
  const from = await getPos(page);
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= 1) return true;
  const snap = await snapshot(page);
  const structural = { ...snap, npc: new Set<string>() };
  return bfsPath(structural, from, to, true) !== null;
}

/**
 * Lleva la party a la planta `targetFloor` subiendo/bajando escaleras (idempotente). Si se
 * pasa `reachTarget`, la ÚLTIMA transición es COMPONENT-AWARE: elige la escalera cuya sala
 * de destino contiene el target (plantas particionadas). Sin `reachTarget`, byte-idéntico.
 */
export async function goToFloor(
  page: Page,
  targetFloor: number,
  reachTarget?: { x: number; y: number },
): Promise<Pos> {
  let p = await getPos(page);
  for (let guard = 0; p.floor !== targetFloor && guard < 8; guard++) {
    const dir = targetFloor > p.floor ? "up" : "down";
    const finalStep = Math.abs(p.floor - targetFloor) === 1;
    p = await climbLadder(page, dir, finalStep ? reachTarget : undefined);
  }
  if (p.floor !== targetFloor) throw new Error(`goToFloor(${targetFloor}): quedó en la planta ${p.floor}`);
  return p;
}

/**
 * Navega a la celda `(x,y,floor)` de la localización ACTUAL cruzando la RUTA DE TRANSICIONES
 * que planifica el GRAFO DE COMPONENTES (nav-graph.ts): resuelve stair-gate (escaleras-de-pisar
 * 196-199) y partición MULTI-NIVEL (sanctums que exigen ≥2 transiciones) con un solo BFS —
 * lo que `reenterFloorComponent` (un nivel) no podía. Ejecuta cada arista por su mecanismo REAL:
 *   - `ladder`: walkTo(celda) + (K)limb.
 *   - `stair`:  walkTo(celda de aproximación) + UN paso en la dir que dispara `applyStairStep`.
 * Camino feliz (destino alcanzable en la planta actual) → walkTo directo sin tocar el grafo.
 *
 * ⚠ ESTE AVISO ESTABA RANCIO — corregido 30-07. Decía «EJECUCIÓN AÚN NO VALIDADA EN VIVO
 * (paso 2 de #13)» y «NO cablear aún en el camino sellado (rewiring de approachAndTalk +
 * re-sello de ch06)». Las dos mitades son falsas hoy, y medidas:
 *   · `approachAndTalk` YA está recableado — llama a `goToCell` bajo el opt-in
 *     `recoverPartition` (ver más abajo en este mismo fichero).
 *   · Lo usan ONCE capítulos sellados, no los cinco que decía la ficha: ch03, ch04, ch05,
 *     ch06, ch07, ch08, ch09, ch10, ch11, ch12 y ch13 — 30 ocurrencias, las 30 en `true`,
 *     ninguna desactivada. Y `ch04-trinsic.spec.ts` llama a `goToCell` DIRECTAMENTE.
 *   · La ejecución quedó validada en vivo por el resello-2 del 26-07 (`565c2412`,
 *     109/0/4), la misma corrida que cerró el nav-graph del Lycaeum.
 * Se deja escrito porque un aviso que prohíbe lo que ya se hace en once capítulos sellados
 * no es cautela: es una trampa para quien venga a «arreglarlo».
 * Acta: `re/notes/navgraph-lycaeum-cierre.md` §4.1.
 */
export async function goToCell(
  page: Page,
  x: number,
  y: number,
  floor: number,
  opts: { adjacent?: boolean; allowLocked?: boolean } = {},
): Promise<Pos> {
  const cur = await getPos(page);
  if (cur.floor === floor) {
    try {
      await walkTo(page, x, y, { adjacent: opts.adjacent });
      return await getPos(page);
    } catch (e) {
      rethrowIfFatal(e);
      /* particionado en la misma planta → planifica por el grafo (sanctum vía otra planta) */
    }
  }
  const route = planRoute(
    buildLocationGraph(cur.location),
    { x: cur.x, y: cur.y, floor: cur.floor },
    { x, y, floor },
    { allowLocked: opts.allowLocked },
  );
  if (route === null) {
    throw new Error(`goToCell(${x},${y},z${floor}): sin ruta en el grafo de la loc ${cur.location}`);
  }
  for (const edge of route) {
    if (edge.kind === "ladder") {
      await walkTo(page, edge.x, edge.y); // pisa la escala
      await klimb(page);
    } else if (edge.kind === "stair") {
      // stair: camina a la celda de aproximación y da UN paso SOBRE la escalera (applyStairStep
      // transiciona al caminar); consume un turno → pressAwaitingTurn.
      await walkTo(page, edge.approach!.x, edge.approach!.y);
      await pressAwaitingTurn(page, ARROW[edge.stepDir!]);
    } else {
      // locked: MISMA planta. Camina a la celda de aproximación y (J)immy la puerta hasta
      // abrirla (llave+turno; puede romper llave sin turno → reintenta acotado por llaves).
      // Al abrirse pasa a puerta regular (mapOverride 0xB8) y el walkTo posterior la cruza.
      await walkTo(page, edge.approach!.x, edge.approach!.y);
      const jd = dirOf(edge.x - edge.approach!.x, edge.y - edge.approach!.y);
      await jimmyDoor(page, edge.x, edge.y, jd);
    }
    if (edge.kind !== "locked") {
      const after = await getPos(page);
      if (after.floor !== edge.to.floor) {
        throw new Error(
          `goToCell: transición ${edge.kind}@(${edge.x},${edge.y}) no llevó a la planta ${edge.to.floor} (quedó en ${after.floor})`,
        );
      }
    }
  }
  await walkTo(page, x, y, { adjacent: opts.adjacent });
  return getPos(page);
}

/** Tile EFECTIVO (con mapOverride) en (x,y) de la planta actual. */
const tileAtLive = (page: Page, x: number, y: number): Promise<number> =>
  page.evaluate(
    ([tx, ty]) => (window as unknown as { __u5test: { game: any } }).__u5test.game.activeMap.tileAt(tx, ty),
    [x, y],
  );

/**
 * La ruta planificada exigía (J)immy una puerta con cerrojo pero la party se quedó sin
 * llaves. Es IRRECUPERABLE (quemar turnos no fabrica llaves), así que los bucles de
 * enganche deben abortar de inmediato en vez de reintentar en vano. Tarea #58.
 */
class KeysExhaustedError extends Error {
  constructor(dx: number, dy: number) {
    super(`jimmyDoor(${dx},${dy}): sin llaves`);
    this.name = "KeysExhaustedError";
  }
}

/**
 * (J)immy la puerta con llave en `(dx,dy)` (dir `d` desde la celda adyacente) hasta abrirla.
 * Jimmy gasta llave+turno al ÉXITO y rompe llave (sin turno) al FALLO (game.ts:jimmy, DEX del
 * activo, determinista bajo seed-0). Reintenta acotado por el nº de llaves; lanza si se agotan
 * (KeysExhaustedError, irrecuperable) o no abre. Al abrir, la puerta pasa a regular
 * (mapOverride) y el walkTo posterior la cruza. Si la puerta ya estaba abierta (mapOverride
 * previo) retorna SIN gastar llave ni turno → no lanza (flujo intacto de ch07/ch08).
 */
async function jimmyDoor(page: Page, dx: number, dy: number, d: Dir): Promise<void> {
  // Jugar LISTO: activa al miembro VIVO de MAYOR DEX antes de (J)immy (mejor ganzuador → menos
  // llaves rotas). setActivePlayer es turn-free en pueblo (game.ts:1082) → sin efecto en bytes.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const chars = g.state.characters;
    let best = -1;
    let bestDex = -1;
    for (let i = 0; i < g.state.partySize; i++) {
      const c = chars[i];
      if (!c || c.status === "D" || c.status === "S") continue;
      if (c.dexterity > bestDex) {
        bestDex = c.dexterity;
        best = i;
      }
    }
    if (best >= 0 && g.state.activeCharacter !== best) g.setActivePlayer(best + 1);
  });
  for (let tries = 0; tries < 12; tries++) {
    if (!isLockedDoor(await tileAtLive(page, dx, dy))) return; // ya abierta
    const keys = await readState<number>(page, "keys");
    if (keys <= 0) throw new KeysExhaustedError(dx, dy);
    await press(page, "j");
    await press(page, ARROW[d]);
  }
  if (isLockedDoor(await tileAtLive(page, dx, dy))) {
    throw new Error(`jimmyDoor(${dx},${dy}): no se pudo abrir la puerta`);
  }
}

/**
 * Sube/baja una planta por la escalera de mano REACHABLE más cercana ((K)limb sobre
 * ella). Camina hasta la escalera, klimba y asevera el cambio de planta. Devuelve la
 * nueva posición. Reutilizable para el recorrido multi-planta de cualquier capítulo.
 *
 * COMPONENT-AWARE (opcional): si se pasa `reachTarget`, tras klimbar comprueba que el
 * target sea alcanzable desde el COMPONENTE en el que se aterriza; si NO (planta partida
 * en salas aisladas, cada una servida por SU escalera — p.ej. los stalls de Trinsic/
 * Moonglow), baja de vuelta por la misma escalera (reciprocidad U5: misma celda x,y) y
 * prueba la SIGUIENTE. SIN `reachTarget` acepta el primer cambio de planta → comportamiento
 * histórico BYTE-IDÉNTICO (los llamadores que no pasan target no cambian de conducta).
 */
export async function climbLadder(
  page: Page,
  dir: "up" | "down",
  reachTarget?: { x: number; y: number },
): Promise<Pos> {
  const target = dir === "up" ? LADDER_UP : LADDER_DOWN;
  const snap = await snapshot(page);
  const before = await getPos(page);
  // Escaleras del tipo pedido, ordenadas por cercanía Manhattan a la party.
  const ladders: Array<[number, number]> = [];
  for (let y = 0; y < snap.H; y++)
    for (let x = 0; x < snap.W; x++) if (snap.grid[y]![x] === target) ladders.push([x, y]);
  ladders.sort(
    (a, b) => Math.abs(a[0] - before.x) + Math.abs(a[1] - before.y) - (Math.abs(b[0] - before.x) + Math.abs(b[1] - before.y)),
  );
  if (ladders.length === 0) throw new Error(`climbLadder(${dir}): sin escalera en la planta ${before.floor}`);
  let lastErr: unknown = null;
  for (const [lx, ly] of ladders) {
    try {
      await walkTo(page, lx, ly); // pisa la escalera
      await klimb(page);
      const after = await getPos(page);
      if (after.floor === before.floor) continue; // no cambió de planta: prueba otra
      if (!reachTarget || (await canReach(page, reachTarget))) return after;
      // Componente equivocado: baja de vuelta por la misma escalera y prueba la siguiente.
      await klimb(page);
      if ((await getPos(page)).floor !== before.floor) return after; // no pudo bajar: degrada
    } catch (e) {
      rethrowIfFatal(e);
      lastErr = e; // escalera inalcanzable → prueba la siguiente
    }
  }
  throw new Error(`climbLadder(${dir}): no se pudo alcanzar el destino (${String(lastErr)})`);
}

// ── Navegación 3D de MAZMORRA (ch14+) ────────────────────────────────────────
//
// Arnés de la vista 3D con FACING. A diferencia de los small-maps (movimiento por
// coordenada absoluta con flechas), la mazmorra mueve forward/back según la dirección de
// vista y GIRA con left/right (main.ts handleDungeonKey: ArrowUp=forward, ArrowDown=back,
// ArrowLeft/Right=girar, k=klimb, s=search, o=open, d=drink, c=cast). El estado 3D vive en
// `__u5test.game.dungeonState` (NO en state.position, que queda en location 0). El pather
// hace BFS 8×8 por planta con WRAP TOROIDAL (DUNGEON:0x057a) y EXCLUYE Room/Trap/campo
// (Entrega 1: sin combate ni hazard); las puertas secretas (0xD) se REVELAN con (S)earch
// al cruzarlas (requiere luz → In Lor primero). El descenso entre plantas lo secuencia el
// capítulo con `dungeonKlimb` sobre escaleras. Cero-rand salvo el housekeeping del turno
// (advanceTurn), determinista bajo reseed(0).

export type DFacing = "north" | "east" | "south" | "west";
export interface DPos {
  dungeon: number;
  floor: number;
  x: number;
  y: number;
  facing: DFacing;
}
// DCell/DN viven en descent-planner.ts (planificador puro, unit-testeado).
const DCW: DFacing[] = ["north", "east", "south", "west"]; // sentido horario (giro derecha)

/** Estado 3D vivo (`dungeonState.pos`) o null si no se está en mazmorra. */
export async function dungeonPos(page: Page): Promise<DPos | null> {
  return page.evaluate(() => {
    const ds = (window as unknown as { __u5test: { game: { dungeonState: { pos: DPos } | null } } }).__u5test.game.dungeonState;
    return ds ? { ...ds.pos } : null;
  });
}

/**
 * Entra a la mazmorra `id` por el mecanismo REAL: teleporta a su tile-entrada del
 * overworld (costura cero-rand sancionada, como `enterLocation`), ABRE el sello de la
 * Palabra de Poder (questFlag `word-spoken:<id>` — costura de arnés, precedente vivo del
 * fixture #47) y (E)nter → `game.enterDungeon(id)`. Deja la party en la escalera de subida
 * de la planta 0, facing sur.
 */
export async function enterDungeon(page: Page, id: number): Promise<DPos> {
  await page.evaluate((locId) => {
    const w = window as unknown as { __u5test: { game: { data: { locationsX: number[]; locationsY: number[] }; state: { questFlags: Record<string, boolean> } } }; __u5debug: { teleportOverworld: (x: number, y: number) => void } };
    const g = w.__u5test.game;
    w.__u5debug.teleportOverworld(g.data.locationsX[locId - 1]!, g.data.locationsY[locId - 1]!);
    g.state.questFlags[`word-spoken:${locId}`] = true; // sello abierto (arnés, cf #47)
  }, id);
  await press(page, "e"); // (E)nter REAL → enterDungeon
  const p = await dungeonPos(page);
  expect(p?.dungeon, `enterDungeon(${id}) debe cargar la mazmorra`).toBe(id);
  return p!;
}

/**
 * Entra a la mazmorra `id` por el FONDO desde el UNDERWORLD — la pasada de FONDO de la Fase 2b
 * (generaliza el ch16b hardcodeado a Deceit). Mecanismo REAL:
 *  1. Teletransporta al UNDERWORLD (floor 0xFF) SOBRE el tile-entrada del dungeon. Ese tile está a
 *     la MISMA (x,y) que la posición overworld del dungeon (`locationsX/locationsY`): los 8 tiles
 *     de entrada-mazmorra del Underworld (0x16/0x17/0x18) coinciden 8/8 con esa tabla — derivado en
 *     `docs/plan-fase2b-stubs.md` (underworld.json ∩ DungeonPositionsOverworld.csv). ⇒ NO hace falta
 *     tabla nueva: se reusa la MISMA fuente que `enterDungeon` (cima), sólo con `underworld=true`.
 *  2. (E) REAL: el despacho de (E) es POR TILE sin guarda de planta (MAINOUT cmd_enter 0x08de);
 *     con `pos.floor===0xFF` → `enterDungeon(id, 0xFF)` → entrada por el FONDO: floor 7, (7,7),
 *     facing OESTE (game.ts, rama `fromUnderworld`).
 *
 * EXCEPCIÓN Doom (id 40 = LAST_DUNGEON): SIEMPRE entra por la cima aunque venga del Underworld
 * (+ posible emboscada de Shadowlord) → este helper NO es para Doom (usa `enterDungeon`/single-descent).
 * Los otros 7 dungeons: aterriza en (7,7) — desde ahí `walkDungeonTo`(floor7) + `dungeonKlimb("up")`
 * alcanzan las salas FONDO (o se sella la inaccesibilidad como dead-end fiel, patrón #29/Deceit).
 */
export async function enterFromUnderworld(page: Page, id: number): Promise<DPos> {
  await page.evaluate((locId) => {
    const w = window as unknown as {
      __u5test: { game: { data: { locationsX: number[]; locationsY: number[] }; state: { questFlags: Record<string, boolean> } } };
      __u5debug: { teleportOverworld: (x: number, y: number, underworld?: boolean) => void };
    };
    const g = w.__u5test.game;
    // underworld=true → floor 0xFF sobre el tile-entrada (misma coord que la overworld).
    w.__u5debug.teleportOverworld(g.data.locationsX[locId - 1]!, g.data.locationsY[locId - 1]!, true);
    g.state.questFlags[`word-spoken:${locId}`] = true; // sello abierto (arnés, cf #47) — inocuo desde el fondo
  }, id);
  await press(page, "e"); // (E) REAL desde floor 0xFF → enterDungeon(id, 0xFF) → FONDO
  const p = await dungeonPos(page);
  expect(p?.dungeon, `enterFromUnderworld(${id}) debe cargar la mazmorra`).toBe(id);
  expect(p, `enterFromUnderworld(${id}) entra por el FONDO (floor 7, (7,7), oeste)`).toMatchObject({ floor: 7, x: 7, y: 7, facing: "west" });
  return p!;
}

/**
 * FUERA DE MAZMORRA — `game.dungeonState` es `null` SIEMPRE que la party no está dentro
 * de una mazmorra, y el repo ya lo trata como nullable donde toca (`ch21-salas-despise`
 * lo declara `{...} | null` y lo guarda; `roomClearedInTransit`, aquí abajo, también).
 *
 * Los lectores de rejilla de este fichero, en cambio, lo daban por no-nulo y hacían
 * `.cellAt` sobre `null`. Consecuencia real (ch22, pasada-vídeo 2026-07-25): el arnés
 * REVENTABA con un `TypeError: Cannot read properties of null (reading 'cellAt')` en 9
 * salas seguidas, y el digest lo truncaba a 40 caracteres («Cannot read pr») — o sea que
 * el arnés DESTRUÍA la evidencia justo cuando había algo que investigar: la party había
 * salido de la mazmorra a mitad de la pasada y ese era EL dato.
 *
 * Este error NOMBRA el hecho para que el capítulo lo reporte como RESULTADO. No enmascara
 * nada: sigue siendo un fallo, pero uno que se lee.
 */
function outOfDungeon(what: string): Error {
  return new Error(
    `FUERA-DE-MAZMORRA: game.dungeonState es null al leer ${what} — la party ya NO está ` +
      `dentro de la mazmorra (salida por escalera/foso, o party-wipe con su secuencia de refugio). ` +
      `No es un fallo del lector: es el estado del juego, y es el dato a investigar.`,
  );
}

/** Rejilla 8×8 {type,sub} de la planta `floor` VIVA (refleja overrides/reveals). */
async function readDungeonFloor(page: Page, floor: number): Promise<DCell[][]> {
  const out = await page.evaluate((f) => {
    const ds = (window as unknown as { __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => DCell } | null } } }).__u5test.game.dungeonState;
    if (!ds) return null; // FUERA DE MAZMORRA — lo nombra el llamante (outOfDungeon)
    const out: DCell[][] = [];
    for (let y = 0; y < 8; y++) {
      const row: DCell[] = [];
      for (let x = 0; x < 8; x++) {
        const c = ds.cellAt(f, x, y);
        row.push({ type: c.type, sub: c.sub });
      }
      out.push(row);
    }
    return out;
  }, floor);
  if (!out) throw outOfDungeon(`la rejilla de la planta ${floor}`);
  return out;
}

/**
 * ¿Transitable para el ROUTER (Entrega 1)? Bloquea muros (0xB/0xC), salas SIN conquistar
 * 0xF (combate), trampas 0x6 y campos mágicos 0x8 (hazard). Permite pasillo 0x0, escaleras
 * 0x1/0x2/0x3, cofre 0x4/0x7, fuente 0x5, marcador 0x9, puerta secreta 0xD (se revela al
 * cruzar) y **sala CONQUISTADA 0xA (RoomsBroke)**. Es la EVITACIÓN de combate/hazard
 * sancionada por el greenlight de la Entrega 1.
 *
 * 0xA transitable (fix del ESPEJO del planificador): `planDungeonDescent` ya trata 0xA como
 * paso normal, pero este router de EJECUCIÓN lo seguía bloqueando → conquistar una sala NO
 * abría paso a través de ella. Semántica FIEL citada en core: `onEnterCell` (dungeon.ts,
 * rama Room/RoomsBroke) — al pisar una sala YA despejada (0xA) el binario SÓLO imprime
 * "Entering room..." y COMBAT 0xB94 no coloca monstruos → sin combate. 0xF (sin conquistar)
 * SIGUE bloqueado (pisarla dispara combate).
 */
function dungeonRoutePassable(c: DCell): boolean {
  switch (c.type) {
    case 0xb: // Wall
    case 0xc: // SpecialWall
    case 0xf: // Room SIN conquistar (combate)
    case 0x6: // Trap (hazard)
    case 0x8: // MagicField (hazard)
      return false;
    default: // incluye 0xA RoomsBroke (sala conquistada = pasaje sin combate)
      return true;
  }
}

/** Facing (con wrap toroidal) para pasar de (x,y) a la casilla ADYACENTE (nx,ny). */
function facingToward(x: number, y: number, nx: number, ny: number): DFacing {
  let dx = nx - x,
    dy = ny - y;
  if (dx > 1) dx -= DN;
  if (dx < -1) dx += DN;
  if (dy > 1) dy -= DN;
  if (dy < -1) dy += DN;
  if (dy === -1) return "north";
  if (dy === 1) return "south";
  if (dx === -1) return "west";
  return "east";
}

/** BFS 4-vecinos con wrap toroidal. Devuelve la lista de casillas start→goal (sin start). */
function planDungeonRoute(
  grid: DCell[][],
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): Array<[number, number]> | null {
  const seen = new Set<string>([`${sx}:${sy}`]);
  const q: Array<{ x: number; y: number; path: Array<[number, number]> }> = [{ x: sx, y: sy, path: [] }];
  while (q.length) {
    const { x, y, path } = q.shift()!;
    if (x === gx && y === gy) return path;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = (x + dx + DN) % DN,
        ny = (y + dy + DN) % DN;
      const k = `${nx}:${ny}`;
      if (seen.has(k)) continue;
      const isGoal = nx === gx && ny === gy;
      if (!isGoal && !dungeonRoutePassable(grid[ny]![nx]!)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny, path: [...path, [nx, ny]] });
    }
  }
  return null;
}

/**
 * EMBOSCADA DE PASILLO (errante 3D, DUNGEON 0x0B7E — re/notes/dungeon-wanderer.md): si hay
 * combate abierto MIENTRAS se navega una mazmorra, el errante lo abrió a mitad de camino
 * (arena procedural mode-2 = una arena). Se RESUELVE aquí para que la navegación pueda seguir
 * (una emboscada abierta se comería los giros/pasos, que irían al handler de combate).
 * Política por defecto = GANAR (`resolveArenaCombat`: unpin por estado, targeting propio,
 * salida por el borde) — lo que haría un jugador del tour. `flee` (opt-in para specs que huyan
 * por diseño): ESC hasta cerrar (huida por borde, 58a0 1-4). TRAS resolver, el post-combate de
 * pasillo (58a0) pudo MOVER a la party: paso lateral (huida por borde 1-4) o ±planta (klimb en
 * la arena 5/6) → el LLAMADOR re-observa posición/planta y re-planifica. Devuelve true si hubo
 * emboscada resuelta.
 */
/** Superficie del combate ACTUAL para el arnés: ¿hay combate? y su TERRITORIO — identifica la
 *  arena: "dungeon-corridor" = EMBOSCADA de pasillo (procedural, wanderer.ts); "dungeon" = SALA
 *  (.CBT, la maneja conquerRoom); "britannia"… = overworld. `territory`=null si no hay combate. */
async function combatSurface(page: Page): Promise<{ inCombat: boolean; territory: string | null; inDungeon: boolean }> {
  return page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { combat: { map?: { territory?: string } } | null; dungeonState: unknown } } }).__u5test.game;
    const c = g.combat;
    return { inCombat: c !== null, territory: c ? (c.map?.territory ?? null) : null, inDungeon: g.dungeonState !== null };
  });
}

/**
 * ESTRATEGIA de detección de emboscada del run ACTUAL (OPT-IN por call-site). DEFAULT `"legacy"`
 * = pass-1 (isCorridorAmbush = inCombat&&inDungeon) bajo el que están sellados ch26 y la mayoría.
 * `"territory"` (isCorridorAmbush = territory==="dungeon-corridor" + enterRoomThroughAmbush) es el
 * OPT-IN de ch37-doom-cola y ch35 (sellaron con la máquina nueva). La fijan los ENTRY-POINTS
 * públicos (`conquerRoomAt`/`dungeonDescendTo` desde su `ambushMode`, o `setAmbushMode` directo);
 * `bootWorld` la RESETEA a legacy al empezar cada capítulo (un opt-in olvidado nunca filtra
 * territory a un capítulo legacy). Así un fix de un capítulo NO mueve el stream RNG de otros.
 */
let _ambushMode: AmbushMode = "legacy";
/** Opt-in explícito a la estrategia de emboscada (documenta la estrategia de nav del sello). */
export function setAmbushMode(mode: AmbushMode): void { _ambushMode = mode; }

async function resolveCorridorAmbush(page: Page, opts: { flee?: boolean } = {}): Promise<boolean> {
  const st = await combatSurface(page);
  if (!isCorridorAmbush(st, _ambushMode)) return false; // sólo EMBOSCADA (según _ambushMode); una SALA en modo territory NO se toca
  if (opts.flee) {
    for (let i = 0; i < 8 && (await inDungeonCombat(page)); i++) await press(page, "Escape");
  } else {
    await resolveArenaCombat(page, { maxRounds: 400 });
  }
  return true;
}

/**
 * ENTRA a una sala tolerando una EMBOSCADA de pasillo que INTERCEPTE la entrada. El paso/klimb
 * de entrada dispara dng_enter_room (combate de SALA, territory "dungeon"); pero si el errante
 * ambusca en ese mismo turno (territory "dungeon-corridor"), el combate que abre es la EMBOSCADA
 * — al ganarla, dng_enter_room NO se re-dispara (el post-combate 58a0 deja a la party colocada
 * sin el paso-fresco) → la sala nunca abre su veredicto (FAIL:no-combat-on-entry, r6/r9 doom).
 * FIEL: un jugador RE-PISARÍA la sala. `doEntry` re-ejecuta la entrada (re-teleport+acciones /
 * re-approach+paso); se reintenta acotado (otra emboscada en el reintento se resuelve igual).
 * Devuelve true si quedó en combate de SALA; false si no se pudo tras `tries` intentos.
 */
export async function enterRoomThroughAmbush(page: Page, doEntry: () => Promise<void>, tries = 3): Promise<boolean> {
  for (let t = 0; t < tries; t++) {
    await doEntry();
    // Resuelve una emboscada que la entrada dejara ABIERTA (p. ej. un paso crudo que no pasa por
    // los helpers ambush-aware); si era combate de SALA no la toca (territory != dungeon-corridor).
    await resolveCorridorAmbush(page);
    const s = await combatSurface(page);
    if (s.inCombat && s.territory !== "dungeon-corridor") return true; // combate de SALA abierto
    // No hay combate de SALA (la emboscada se comió el dng_enter_room) → re-pisa (reintenta).
  }
  return false;
}

/**
 * ¿El errante 3D está PARADO en la celda destino (tx,ty), bloqueando el paso? El core imprime
 * "Blocked!" (dng_move 0x067c-0x0691) SIN consumir turno → el errante NO se mueve → la party
 * NO avanza NUNCA (livelock: un paso bloqueado ni mueve a la party ni hace avanzar al errante).
 * FIEL (dungeon.ts:361 "hay que (A)tacarlo o rodearlo"): se ATACA la celda encarada — (A) abre
 * el combate de PASILLO (DUNGEON 0x1D4A, territory "dungeon-corridor") → se resuelve → el errante
 * RESPAWNEA en otra celda (rand, fuera de la fila/columna de la party) → la ruta se despeja.
 * Devuelve true si atacó (el llamador debe RE-PLANIFICAR — el respawn/58a0 pudo cambiar el mapa).
 */
async function clearBlockingWanderer(page: Page, from: DPos, tx: number, ty: number): Promise<boolean> {
  const blocks = await page.evaluate(({ x, y }) => {
    const ds = (window as unknown as { __u5test: { game: { dungeonState: { wandererAt: (x: number, y: number) => boolean } | null } } }).__u5test.game.dungeonState;
    return !!ds && ds.wandererAt(x, y);
  }, { x: tx, y: ty });
  if (!blocks) return false;
  await dungeonTurnTo(page, facingToward(from.x, from.y, tx, ty)); // encara al errante
  await press(page, "a"); // (A)ttack la celda ENCARADA → combate de pasillo
  await resolveCorridorAmbush(page); // gánalo → respawn del errante → despeja la ruta
  return true;
}

/** Gira (por el lado corto) hasta encarar `target`. */
async function dungeonTurnTo(page: Page, target: DFacing): Promise<void> {
  await resolveCorridorAmbush(page); // una emboscada abierta comería los giros → resuélvela antes
  for (let i = 0; i < 4; i++) {
    const p = await dungeonPos(page);
    if (!p) throw new Error("dungeonTurnTo: fuera de mazmorra");
    if (p.facing === target) return;
    const rightSteps = (DCW.indexOf(target) - DCW.indexOf(p.facing) + 4) % 4;
    await press(page, rightSteps <= 2 ? "ArrowRight" : "ArrowLeft");
  }
  throw new Error(`dungeonTurnTo(${target}): no encaró tras 4 giros`);
}

/** Encara (nx,ny) adyacente y avanza (forward). Asevera la llegada EXACTA salvo que una
 *  EMBOSCADA de pasillo interrumpa el paso (el post-combate 58a0 pudo mover a la party →
 *  el llamador re-observa/re-planifica). */
async function dungeonStepTo(page: Page, nx: number, ny: number): Promise<DPos> {
  await resolveCorridorAmbush(page); // emboscada pendiente antes de moverse (comería el paso)
  const cur = await dungeonPos(page);
  if (!cur) throw new Error("dungeonStepTo: fuera de mazmorra");
  await dungeonTurnTo(page, facingToward(cur.x, cur.y, nx, ny));
  await press(page, "ArrowUp"); // forward
  const ambushed = await resolveCorridorAmbush(page); // el paso (turno) pudo disparar emboscada
  const after = await dungeonPos(page);
  // TELEMETRÍA (opt-in, no-op sin env): el planner 3D esperaba (nx,ny); un `moved:false`
  // aquí (sin emboscada) es desacuerdo planner-vs-core.
  await recordDungeonStep(page, {
    before: { x: cur.x, y: cur.y, floor: cur.floor, facing: cur.facing },
    intended: { x: nx, y: ny },
    after: after ? { x: after.x, y: after.y, floor: after.floor } : null,
  });
  if (!after) throw new Error("dungeonStepTo: fuera de mazmorra tras el paso");
  // Sin emboscada: contrato histórico (llegada exacta). Con emboscada: el 58a0 pudo mover a
  // la party (paso lateral / ±planta) → NO se asevera (el llamador re-planifica desde ahí).
  if (!ambushed && (after.x !== nx || after.y !== ny))
    throw new Error(`dungeonStepTo: esperado (${nx},${ny}), llegó (${after.x},${after.y})`);
  return after;
}

/**
 * Navega en la planta ACTUAL hasta (gx,gy) por el pather (evita Room/Trap/campo). Revela
 * las puertas secretas del camino con (S)earch antes de cruzarlas (requiere luz). Lanza si
 * no hay ruta.
 */
export async function walkDungeonTo(page: Page, gx: number, gy: number): Promise<DPos> {
  const start = await dungeonPos(page);
  if (!start) throw new Error("walkDungeonTo: fuera de mazmorra");
  // Re-planifica UN paso a la vez RE-OBSERVANDO el estado: una EMBOSCADA de pasillo (errante
  // 3D) puede abrir combate y, al ganarlo, MOVER a la party (58a0: paso lateral / ±planta),
  // invalidando una ruta precomputada. `nextWalkAction` decide (resolver emboscada | llegó |
  // paso | sin-ruta); el presupuesto acota rutas patológicas.
  for (let guard = 0; guard < 256; guard++) {
    const st = await combatSurface(page);
    const cur = await dungeonPos(page);
    if (!cur) throw new Error("walkDungeonTo: fuera de mazmorra a mitad de ruta");
    // walkDungeonTo es MISMA-planta: si una emboscada klimbó (58a0 5/6) y cambió de planta, no
    // hay ruta a (gx,gy) aquí → deja re-planificar al descenso (dungeonDescendTo re-observa).
    if (!st.inCombat && cur.floor !== start.floor)
      throw new Error(`walkDungeonTo: emboscada cambió de planta ${start.floor}→${cur.floor} — re-planifica el descenso`);
    const grid = await readDungeonFloor(page, cur.floor);
    const action = nextWalkAction({ ...st, cur: { x: cur.x, y: cur.y }, goal: { x: gx, y: gy } }, (sx, sy, tx, ty) => planDungeonRoute(grid, sx, sy, tx, ty), _ambushMode);
    if (action.kind === "resolveAmbush") { await resolveCorridorAmbush(page); continue; }
    if (action.kind === "arrived") return cur;
    if (action.kind === "noRoute") throw new Error(`walkDungeonTo(${gx},${gy}): sin ruta en la planta ${cur.floor}`);
    const [nx, ny] = action.to;
    if (grid[ny]![nx]!.type === 0xd) {
      // Puerta secreta: encárala y (S)earch para revelarla antes de pisarla.
      await dungeonTurnTo(page, facingToward(cur.x, cur.y, nx, ny));
      await press(page, "s");
      await answerDungeonSearchChain(page);
    }
    await dungeonStepTo(page, nx, ny);
  }
  throw new Error(`walkDungeonTo(${gx},${gy}): presupuesto de pasos agotado`);
}

/**
 * (K)limb en mazmorra. Consulta `dungeonKlimbNeedsChoice`: si la celda tiene escalera
 * ARRIBA y ABAJO abre el prompt "Klimb-U/D-" y hay que resolver la vía (u/d); si es una
 * sola vía, la tecla (K) resuelve directo. Devuelve el `DPos` nuevo, o null si el klimb
 * SALIÓ de la mazmorra (planta 0 arriba → overworld).
 */
export async function dungeonKlimb(page: Page, dir: "up" | "down"): Promise<DPos | null> {
  await resolveCorridorAmbush(page); // una emboscada abierta comería la (K)limb
  const needsChoice = await page.evaluate(() =>
    (window as unknown as { __u5test: { game: { dungeonKlimbNeedsChoice: () => boolean } } }).__u5test.game.dungeonKlimbNeedsChoice(),
  );
  await press(page, "k");
  if (needsChoice) await press(page, dir === "up" ? "u" : "d");
  await resolveCorridorAmbush(page); // el klimb (turno) pudo disparar emboscada del errante
  return dungeonPos(page);
}


/** Contesta la cadena interactiva del (S)earch 3D post-F2-T7: selector de miembro si
 *  se abre («Player:» → Enter = cursor/activo) y prompt «Dir-» → ArrowUp = Ahead. */
async function answerDungeonSearchChain(page: Page): Promise<void> {
  const picking = await page
    .evaluate(() => (window as unknown as { __u5test: { partySelectOpen?: () => boolean } }).__u5test.partySelectOpen?.() ?? false)
    .catch(() => false);
  if (picking) await press(page, "Enter");
  await press(page, "ArrowUp"); // Dir-Ahead (main.ts pendingDungeonSearch)
}

/** (S)earch direccional (celda de delante). Devuelve el tail del log del HUD. */
export async function dungeonSearchAhead(page: Page): Promise<string[]> {
  await press(page, "s");
  await answerDungeonSearchChain(page);
  return consoleTail(page, 4);
}

/**
 * (D)rink sobre la fuente bajo la party. El original pregunta "Will you drink?"
 * (DS 0x7700, DNGLOOK 0x013b) con getkey Y/N crudo; respondemos 'y' ("Yes.
 * Gulp!" + efecto). El save resultante es idéntico al del drink directo (la
 * rama 'Y' llama a dungeonCommand("drink") una sola vez). Devuelve el tail del log.
 */
export async function dungeonDrink(page: Page): Promise<string[]> {
  await press(page, "d");
  await press(page, "y");
  return consoleTail(page, 6);
}

/**
 * (C)ast de In Lor (luz de la vista 3D) por el cableado REAL de la UI: (C) → miembro 1 →
 * "IN LOR" (iniciales "il") → Enter (main.ts doDungeonCast, cf fixture #47). Devuelve el
 * tail del log. El caster debe tener maná/nivel/quantities (se siembran como costura de
 * arnés en el capítulo, igual que #47).
 */
export async function dungeonCastInLor(page: Page): Promise<string[]> {
  await press(page, "c");
  await press(page, "1"); // miembro 1 (el Avatar)
  await press(page, "i");
  await press(page, "l");
  await press(page, "Enter");
  return consoleTail(page, 6);
}

// ── Descenso profundo + combate de sala (ch14b, Entrega 2) ───────────────────
//
// Deceit (y las mazmorras de U5 en general) es un LABERINTO DE BOLSAS conectadas
// verticalmente: por escaleras SÍ, pero también por TRAMPAS DE FOSO (pitfall, caes una
// planta) y por Des Por (descenso mágico). Verificado contra dungeons.json[loc33]: la
// bolsa de entrada (floor 0↔1, columna 1) es reversible, pero el cofre (floor 7) y las
// salas navegables (floor 5+) SÓLO se alcanzan cayendo por fosos + Des Por, y NO hay
// vuelta ARRIBA a Britannia (los fosos sólo bajan). El único borde de salida bajo la
// bolsa de entrada es hacia el UNDERWORLD (Des Por/Klimb-down en floor 7). Por eso un
// capítulo de cofre de Deceit SALE al Underworld (no a Britannia); es la forma "travesía"
// con el sello en el punto de emergencia del Underworld.

/** ¿La party está en modo COMBATE de sala? (`game.combat` ≠ null). */
export async function inDungeonCombat(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null,
  );
}

/**
 * (C)ast de un hechizo de cambio de planta por iniciales rúnicas (Des Por "dp" baja,
 * Uus Por "up" sube) — cableado REAL de la UI (C → miembro 1 → runas → Enter, cf #47).
 * El caster debe tener maná/nivel/quantities sembrados (costura de arnés).
 */
export async function dungeonCastLevelChange(page: Page, initials: "dp" | "up"): Promise<string[]> {
  await press(page, "c");
  await press(page, "1");
  for (const ch of initials) await press(page, ch);
  await press(page, "Enter");
  return consoleTail(page, 4);
}

/**
 * (O)pen + (G)et del cofre bajo la party — flujo FIEL O→G (residual-3, main a1f1f65c):
 * el (O)pen (open_dungeon 0x12D4) solo dispara trampa y deja el tile 0x70 con
 * "Chest opened"; el botín lo ACREDITA el (G)et posterior (get_dungeon 0x179E,
 * cabecera "contents of chest You find:" + una línea por pieza). El orden de rand
 * O→G es idéntico al del viejo open colapsado (trampa primero, botín después) —
 * los digests solo se mueven por el turno extra del (G)et. Tail ampliado para
 * cubrir eco Get + cabecera + hasta 7 piezas.
 */
export async function dungeonOpenChest(page: Page): Promise<string[]> {
  await press(page, "o"); // trampa (si tile&7) + "Chest opened" (0x8b96)
  await press(page, "g"); // vacía el 0x70 y acredita las piezas (0x1458)
  return consoleTail(page, 12);
}

/**
 * Flechas para llevar el cursor de Aim de `from` (arranque fiel: último objetivo
 * o el actor, COMSUBS 0x0504 tras el hotfix #4) hasta `to`, PASANDO por la celda
 * del actor — cada tramo monótono hacia/desde el actor mantiene
 * `combatDistance ≤ range` (el bound del cursor en main.ts), así ninguna
 * pulsación se pierde. Las flechas solo mueven el cursor (0 llamadas al core,
 * 0 RNG): el `playerAttack(celda)` final es el MISMO que disparaba el driver
 * cuando `aimGeometry` aún auto-apuntaba — digests intactos.
 */
function aimArrows(actor: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }): string[] {
  const out: string[] = [];
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }): void => {
    for (let x = a.x; x !== b.x; x += Math.sign(b.x - a.x)) out.push(b.x > a.x ? "ArrowRight" : "ArrowLeft");
    for (let y = a.y; y !== b.y; y += Math.sign(b.y - a.y)) out.push(b.y > a.y ? "ArrowDown" : "ArrowUp");
  };
  seg(from, actor);
  seg(actor, to);
  return out;
}

/** Pulsa la secuencia Attack-Aim: 'a' abre el cursor, flechas lo llevan al objetivo, Enter confirma. */
async function pressAimAttack(page: Page, s: { ax: number; ay: number; aimFrom: { x: number; y: number }; aimAt: { x: number; y: number } }): Promise<void> {
  await press(page, "a");
  for (const k of aimArrows({ x: s.ax, y: s.ay }, s.aimFrom, s.aimAt)) await press(page, k);
  await press(page, "Enter");
}

/** Lee `game.combat` (arena, combatientes, turno) para conducir el resolvedor.
 *  `aimAt` = rival del bando contrario más cercano EN ALCANCE — el cálculo que
 *  ANTES hacía `aimGeometry` y que el hotfix #4 retiró del core por infiel; el
 *  driver lo conserva como táctica PROPIA (elige la misma celda que antes).
 *  `aimFrom` = arranque DERIVADO del cursor (`aimGeometry().initial`): COMSUBS 0x0504
 *  @0x0511-0x0526 lee el último objetivo recordado del actor y, si valida
 *  (@0x0539-0x0560), el cursor arranca sobre él; si no, @0x0562 arranca sobre la celda
 *  del propio actor. Es la parte de `aimGeometry` que SÍ sale del binario — lo que el
 *  hotfix #4 retiró por infiel fue el barrido de «enemigo más cercano», que no existe
 *  en esa rutina (ver `core/combat/combat.ts:844-851`). */
async function combatSnapshot(page: Page): Promise<
  | null
  | { turn: "other" }
  | { turn: "player"; aimAt: { x: number; y: number } | null; aimFrom: { x: number; y: number }; ax: number; ay: number; tiles: number[][]; enemies: Array<{ x: number; y: number }>; occ: Array<{ x: number; y: number }>; chests: Array<{ x: number; y: number }> }
> {
  return page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
    if (!c) return null;
    const cur = c.currentUnit;
    if (!cur || cur.kind !== "player") return { turn: "other" as const };
    const nextWeapon = c.ensureAttackQueue(cur)[0];
    const range = Math.max(1, (nextWeapon && nextWeapon.range) || 1);
    const dist = (dx: number, dy: number): number => {
      const d2 = dx * dx + dy * dy;
      let si = 1, n = 0, rest = d2;
      while (rest >= si) { rest -= si; si += 2; n++; }
      return n;
    };
    let best: any = null;
    let bestD = Infinity;
    for (const u of c.combatants) {
      if (!c.isActive(u) || c.sideOf(u) === c.sideOf(cur)) continue;
      if (!c.canReach(cur, u, range, nextWeapon && nextWeapon.id)) continue;
      const d = dist(cur.x - u.x, cur.y - u.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    const geo = c.aimGeometry();
    const alive = (u: any) => u.status !== "dead" && u.status !== "fled";
    return {
      turn: "player" as const,
      aimAt: best ? { x: best.x as number, y: best.y as number } : null,
      aimFrom: geo ? (geo.initial as { x: number; y: number }) : { x: cur.x as number, y: cur.y as number },
      ax: cur.x,
      ay: cur.y,
      tiles: c.mapTiles as number[][],
      enemies: c.combatants.filter((u: any) => u.kind === "enemy" && alive(u)).map((e: any) => ({ x: e.x, y: e.y })),
      occ: c.combatants.filter(alive).map((u: any) => ({ x: u.x, y: u.y })),
      // ★ F-6 — COFRES DEL BOTÍN POR-MUERTE, que NO viven en `mapTiles`. El motor
      // evalúa la pasabilidad como `chestAt(x,y) ? 1 : tileAt(x,y)` (combat.ts:1204):
      // el cofre SUSTITUYE el tile por el 1 (agua) ⇒ impasable a pie. `mapTiles` sigue
      // diciendo hierba, así que un BFS que sólo mire la rejilla enruta a través de él
      // y cosecha «Blocked!» — que NO consume turno. Misma derivación que `arenaSnapshot`.
      chests: (() => {
        const out: Array<{ x: number; y: number }> = [];
        const G = (c.mapTiles as number[][]).length;
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (c.chestAt?.(x, y)) out.push({ x, y });
        return out;
      })(),
    };
  });
}

const CARDINAL_ARROW: Record<string, string> = {
  north: "ArrowUp",
  south: "ArrowDown",
  west: "ArrowLeft",
  east: "ArrowRight",
};

/**
 * Primer paso CARDINAL desde el actor hacia la celda adyacente al enemigo más cercano,
 * por BFS sobre la arena 11×11 (transitable = `TileData.IsWalking_Passable`, la MISMA
 * fuente que `tileInfo.walkable` del motor de combate — tiles.ts:65 — sin ocupantes). Se
 * mantiene DENTRO de la rejilla (un paso hacia fuera del borde = intento de huida, que
 * abandonaría el combate). `null` si no hay ruta a melé.
 */
function combatFirstStep(s: { ax: number; ay: number; tiles: number[][]; enemies: Array<{ x: number; y: number }>; occ: Array<{ x: number; y: number }>; chests?: Array<{ x: number; y: number }> }): string | null {
  const G = s.tiles.length;
  // Los cofres del botín por-muerte (COMBAT:0x1574) son IMPASABLES (combat-cmds): rodear.
  const occ = new Set([...s.occ, ...(s.chests ?? [])].map((o) => `${o.x}:${o.y}`));
  const enemyAdj = new Set<string>();
  for (const e of s.enemies) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) enemyAdj.add(`${e.x + dx}:${e.y + dy}`);
  const key = (x: number, y: number) => `${x}:${y}`;
  const prev = new Map<string, { x: number; y: number; dir: string }>();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  const DIRS: Array<[number, number, string]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (enemyAdj.has(key(cur.x, cur.y))) {
        let c = key(cur.x, cur.y);
        let firstDir: string | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; // dentro de rejilla (no huir por borde)
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (!traversable(s.tiles[ny]![nx]!)) continue;
        if (occ.has(k)) continue;
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir });
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

/**
 * ⚠ LEGACY — resolvedor melé state-driven de la Entrega 2. NO clasifica los turnos por BANDO:
 * trata a un PJ POSEÍDO (charmed) como jugable e intenta controlarlo. **Migra a
 * `resolveArenaCombat` en la FASE 2**, junto con el paquete de fidelidad `fiel/sword-chaos-2`
 * (over-by-bando + posesión IA). El canónico future-ready es `resolveArenaCombat`.
 *
 * ⚠ QUIÉN LO USA — CORREGIDO (carril `resolvedor-f6`, censo `git grep`): aquí ponía «lo usa
 * ch14b (`dungeonDescendTo`)… se conserva intacto para no tocar el sello de ch14b», y es
 * FALSO desde la migración de fase 2: ch14b importa y llama `resolveArenaCombat`
 * (ch14-deceitb.spec.ts:263) y ch37 va por `conquerRoomAt`. Los ÚNICOS llamadores vivos son
 * `espejo-tour/runner.ts:1480` y `espejo-tour/checkpoint.ts:117` — o sea el espejo, que es
 * comparación blanda sin digests. Ningún sello del grand tour depende de esta función, y
 * `combatSnapshot`/`dungeonResolveRoomCombatInner` son privados del módulo. Antes de creer
 * lo contrario, RE-CENSA: la premisa vieja sobrevivió a la migración que la invalidó.
 *
 * Conduce las teclas REALES del handler de combate (main.ts): en el turno de cada PJ, si hay
 * enemigo EN ALCANCE (aimGeometry) → (A)ttack-Aim + Enter sobre el más cercano; si no, PASO
 * cardinal hacia el enemigo (BFS de arena) o (Space) pasa si no hay ruta. Los turnos enemigos
 * los bombea el propio handler (pumpCombat). Determinista bajo seed-0. Devuelve true si el
 * combate terminó.
 *
 * ALCANCE: como `resolveArenaCombat`, dispara a distancia si el arma equipada tiene alcance
 * (`inRange` sale de `aimGeometry`, que respeta el alcance del arma). El «melé-only» de una
 * nota previa era FALSO: describía el caso de armas de alcance 1. Con un arco hostiga a los
 * enemigos ranged desde lejos (verificado en ch18).
 */
export async function dungeonResolveRoomCombat(page: Page, opts: { maxRounds?: number } = {}): Promise<boolean> {
  const t0 = Date.now();
  const ok = await dungeonResolveRoomCombatInner(page, opts);
  // TELEMETRÍA (opt-in, no-op sin env): cierre del resolvedor (resuelto + duración).
  await recordCombatEnd(page, { resolver: "room", resolved: ok, ms: Date.now() - t0 });
  return ok;
}

async function dungeonResolveRoomCombatInner(page: Page, opts: { maxRounds?: number } = {}): Promise<boolean> {
  const maxRounds = opts.maxRounds ?? 400;
  let stuck = 0;
  // ★ F-6 — MEMORIA DEL PASO RECHAZADO. Un `playerMove` a celda no pisable/ocupada
  // devuelve «Blocked!» y sale ANTES de `advanceTurn` (combat.ts:1755): el turno NO se
  // consume, así que el MISMO actor vuelve a ser interpelado, el BFS —determinista—
  // propone el MISMO paso, y el bucle se cierra. Medido en vivo en `ad23-g26`: 61 rondas
  // idénticas del PJ 3 en (4,5) empujando contra (4,4), donde un ORC recién muerto había
  // dejado su cofre. Aquí se anota la celda que el motor acaba de RECHAZAR y se replanifica
  // sin ella: el rechazo repetido ya no puede deadlockear el turno aunque el censo de
  // cofres no viera el obstáculo.
  //
  // NO SE OLVIDA durante el combate, y eso es DERIVABLE, no pereza: el rechazo nunca puede
  // ser de un compañero (tanto `combatFirstStep` como `escapeFirstStep` excluyen `occ`, y
  // entre la instantánea y la pulsación no se mueve nadie — el motor es por turnos), así
  // que sólo puede venir del terreno o de un cofre, y este resolvedor no abre cofres: una
  // celda rechazada lo sigue estando. Si algún día abre alguno, esta lista tendrá que
  // caducar con él.
  const rejected = new Set<string>();
  // Borde COMPROMETIDO para la salida post-victoria («All must use the same exit!»).
  let exitDir: "north" | "south" | "east" | "west" | null = null;
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return true;
    const s = await combatSnapshot(page);
    if (!s) return true;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    // TELEMETRÍA por RONDA de jugador (no por frame): celda del actor + enemigos + atasco.
    await recordCombatRound(page, { resolver: "room", round, ax: s.ax, ay: s.ay, enemies: s.enemies.length, enemyCells: s.enemies.map((e) => `${e.x},${e.y}`), stuck });
    // Aim abierto por la cadena de armas (pacers vivos): ESC antes de decidir (ver arena).
    if (await danglingAimOpen(page)) { await press(page, "Escape"); continue; }
    if (s.aimAt) { await pressAimAttack(page, { ax: s.ax, ay: s.ay, aimFrom: s.aimFrom, aimAt: s.aimAt }); stuck = 0; continue; }
    // Celdas a EVITAR al planificar: los cofres del botín MÁS las que el motor ya ha
    // rechazado desde esta misma celda. Rige en las DOS planificaciones —acercarse a melé
    // y salir por el borde tras la victoria—: el deadlock del turno no distingue fase.
    const evitar = [...s.chests, ...[...rejected].map((k) => { const [x, y] = k.split(":"); return { x: Number(x), y: Number(y) }; })];
    const sPlan = { ...s, chests: evitar };
    /** Pulsa un paso cardinal y puntúa el veredicto del MOTOR (que manda sobre el BFS). */
    const stepAndScore = async (d: string): Promise<void> => {
      const delta: Record<string, { dx: number; dy: number }> = {
        north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 }, west: { dx: -1, dy: 0 }, east: { dx: 1, dy: 0 },
      };
      const { dx, dy } = delta[d]!;
      await press(page, CARDINAL_ARROW[d]!);
      const s2 = await combatSnapshot(page);
      const blocked = !!s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay;
      if (blocked) rejected.add(`${s.ax + dx}:${s.ay + dy}`);
      stuck = blocked ? stuck + 1 : 0;
    };
    if (!s.enemies.length) {
      // ★ F-6 — VICTORIA QUE NO CIERRA. Limpiar el bando enemigo no termina el combate
      // (COMBAT:0x0cf6 fall-through): la party tiene que SALIR ANDANDO por el borde
      // (SJOG:0x1C56→0x1BB2, eco «Leave!»). Antes se pulsaba espacio sin tocar `stuck`
      // hasta agotar `maxRounds` y se devolvía `false` con el combate GANADO — medido en
      // vivo en `ad23-g27`: bando enemigo limpio en la ronda 4 y 296 rondas de «Pass».
      // Elección del borde POR ALCANZABILIDAD y COMPROMETIDA (no se rota: cambiar de
      // borde sólo cosecha rechazos de «same exit», #50).
      // El borde se re-elige si el comprometido deja de tener ruta (lo que en esta fase
      // sólo puede pasar porque el motor rechazó celdas que el BFS daba por buenas).
      if (!exitDir || !edgeReachable(sPlan, exitDir, s.ax, s.ay)) {
        const G = s.tiles.length;
        const cands = ([
          { dir: "west" as const, d: s.ax }, { dir: "east" as const, d: G - 1 - s.ax },
          { dir: "north" as const, d: s.ay }, { dir: "south" as const, d: G - 1 - s.ay },
        ]).filter((c) => edgeReachable(sPlan, c.dir, s.ax, s.ay));
        cands.sort((a, b) => a.d - b.d);
        if (!cands.length) { await press(page, " "); stuck++; if (stuck > 60) return false; continue; }
        exitDir = cands[0]!.dir;
      }
      const step = escapeFirstStep(sPlan, exitDir);
      if (step) await stepAndScore(step);
      else {
        await press(page, " "); // la ruta al borde la tapa un compañero: se aparta en su turno
        stuck++;
      }
      if (stuck > 60) return false;
      continue;
    }
    const dir = combatFirstStep(sPlan);
    if (dir) {
      await stepAndScore(dir);
    } else {
      await press(page, " "); // sin ruta a melé: pasa el turno (los enemigos se acercan)
      stuck++;
    }
    if (stuck > 60) return false; // estancado: la sala no es resoluble por este resolvedor
  }
  return !(await inDungeonCombat(page));
}

/**
 * `arenaSnapshot` — proyección del combate CONSCIENTE DE BANDO, para `resolveArenaCombat`.
 * Difiere de `combatSnapshot` (legacy) en un punto clave: el turno de un PJ **POSEÍDO
 * (charmed)** se clasifica como `"other"` (NO se controla) — requisito (a) del brief-ch15:
 * un poseído lo conduce la IA (fase 2, semántica sword-chaos-2) o simplemente pasa su turno
 * (main actual). El resolvedor juega con los miembros que QUEDEN (no poseídos).
 *
 * `enemies` = lo ATACABLE por el cursor de Aim = el BANDO MONSTRUO (`sideOf`): un
 * enemigo NO charmed o un PJ POSEÍDO (charmed). Espejo de `aimGeometry` side-aware
 * (combat.ts, FASE 2): el cursor apunta al bando contrario, así el resolvedor puede
 * targetear a un miembro poseído por la Sword of Chaos / possessCharm. En combate
 * normal (sin charmed) coincide exactamente con el antiguo `kind==="enemy"`.
 */
async function arenaSnapshot(page: Page): Promise<
  | null
  | { turn: "other" }
  | { turn: "player"; aimAt: { x: number; y: number } | null; aimFrom: { x: number; y: number }; ax: number; ay: number; tiles: number[][]; enemies: Array<{ x: number; y: number }>; occ: Array<{ x: number; y: number }>; chests: Array<{ x: number; y: number }>; plates: Array<{ x: number; y: number }>; committedBorder: "north" | "south" | "east" | "west" | null }
> {
  return page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
    if (!c) return null;
    const cur = c.currentUnit;
    // (a) No controlar a los poseídos: turno "other" si no es PJ O es un PJ charmed.
    if (!cur || cur.kind !== "player" || cur.charmed) return { turn: "other" as const };
    // aimAt = táctica del driver (el antiguo auto-target de aimGeometry, ver
    // combatSnapshot); aimFrom = arranque FIEL del cursor (hotfix #4).
    const nextWeapon = c.ensureAttackQueue(cur)[0];
    const range = Math.max(1, (nextWeapon && nextWeapon.range) || 1);
    const dist = (dx: number, dy: number): number => {
      const d2 = dx * dx + dy * dy;
      let si = 1, n = 0, rest = d2;
      while (rest >= si) { rest -= si; si += 2; n++; }
      return n;
    };
    let best: any = null;
    let bestD = Infinity;
    for (const u of c.combatants) {
      if (!c.isActive(u) || c.sideOf(u) === c.sideOf(cur)) continue;
      if (!c.canReach(cur, u, range, nextWeapon && nextWeapon.id)) continue;
      const d = dist(cur.x - u.x, cur.y - u.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    const geo = c.aimGeometry();
    const alive = (u: any) => u.status !== "dead" && u.status !== "fled";
    return {
      turn: "player" as const,
      aimAt: best ? { x: best.x as number, y: best.y as number } : null,
      aimFrom: geo ? (geo.initial as { x: number; y: number }) : { x: cur.x as number, y: cur.y as number },
      ax: cur.x,
      ay: cur.y,
      tiles: c.mapTiles as number[][],
      // PLACAS de sala (.CBT): posiciones `at` en rango (una ya disparada vale 0xFF > 10 y
      // cae fuera). El resolver con `plates:true` las PISA cuando se atasca para abrir muros.
      plates: (() => {
        const seen = new Set<string>();
        const out: Array<{ x: number; y: number }> = [];
        for (const t of (c.map?.triggers ?? []) as Array<{ at: { x: number; y: number } }>) {
          const k = `${t.at.x}:${t.at.y}`;
          if (t.at.x < 11 && t.at.y < 11 && !seen.has(k)) { seen.add(k); out.push({ x: t.at.x, y: t.at.y }); }
        }
        return out;
      })(),
      // Objetivos atacables por Aim = bando MONSTRUO (sideOf): enemigo no-charmed o PJ
      // poseído. Espejo de aimGeometry side-aware (ver JSDoc). `charmed` invierte el bando.
      enemies: c.combatants
        .filter((u: any) => alive(u) && (u.kind === "enemy" ? !u.charmed : u.charmed))
        .map((e: any) => ({ x: e.x, y: e.y })),
      occ: c.combatants.filter(alive).map((u: any) => ({ x: u.x, y: u.y })),
      // Borde ya COMPROMETIDO por el motor (`Combat.escapeBorder`, combat.ts:2694). En sala rige
      // «All must use the same exit!»: fijado ya, cambiar de borde sólo produce rechazos. El
      // conductor DEBE respetarlo en vez de rotar (residuo #50, medido DISPARANDO en ch22 r5).
      committedBorder: (c.lastEscapeBorder ?? null) as "north" | "south" | "east" | "west" | null,
      // Cofres del botín (IMPASABLES desde combat-cmds): el paso de escape debe rodearlos.
      chests: (() => {
        const out: Array<{ x: number; y: number }> = [];
        const G = (c.mapTiles as number[][]).length;
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (c.chestAt?.(x, y)) out.push({ x, y });
        return out;
      })(),
    };
  });
}


/**
 * Paso para DESATASCAR por cofre: si un cofre impasable bloquea la ruta (puertas
 * taponadas por el botín por-muerte), el jugador real lo ABRE desde una celda vecina
 * (Open direccional, combat-cmds) y el cofre se retira. Devuelve:
 *  · { open: dir }  si el actor ya está ADYACENTE a un cofre (dir hacia él), o
 *  · { walk: dir }  primer paso BFS hacia la celda libre vecina de cofre más cercana, o
 *  · null           si no hay cofres alcanzables.
 */
function chestUnblockStep(
  s: { ax: number; ay: number; tiles: number[][]; occ: Array<{ x: number; y: number }>; chests?: Array<{ x: number; y: number }> },
): { open?: string; walk?: string } | null {
  const chests = s.chests ?? [];
  if (!chests.length) return null;
  const G = s.tiles.length;
  const chestSet = new Set(chests.map((c) => `${c.x}:${c.y}`));
  const DIRS: Array<[number, number, string]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  for (const [dx, dy, dir] of DIRS) if (chestSet.has(`${s.ax + dx}:${s.ay + dy}`)) return { open: dir };
  const blocked = new Set([...s.occ, ...chests].map((o) => `${o.x}:${o.y}`));
  const key = (x: number, y: number) => `${x}:${y}`;
  const prev = new Map<string, { x: number; y: number; dir: string }>();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      const nextToChest = DIRS.some(([dx, dy]) => chestSet.has(key(cur.x + dx, cur.y + dy)));
      if (nextToChest && !(cur.x === s.ax && cur.y === s.ay)) {
        let c = key(cur.x, cur.y);
        let firstDir: string | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir ? { walk: firstDir } : null;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k) || blocked.has(k)) continue;
        if (!traversable(s.tiles[ny]![nx]!)) continue;
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir });
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

/**
 * ¿Es ALCANZABLE a pie el borde `dir` desde (sx,sy)? Cuenta terreno y cofres (impasables de
 * verdad) pero NO a los compañeros: son obstáculos TRANSITORIOS que se apartan en su turno.
 * Sirve para ELEGIR el borde; el paso concreto lo da `escapeFirstStep`, que sí los rodea.
 */
function edgeReachable(
  s: { tiles: number[][]; chests?: Array<{ x: number; y: number }> },
  dir: "north" | "south" | "east" | "west",
  sx: number,
  sy: number,
): boolean {
  const G = s.tiles.length;
  const onEdge = (x: number, y: number) =>
    dir === "west" ? x === 0 : dir === "east" ? x === G - 1 : dir === "north" ? y === 0 : y === G - 1;
  const blocked = new Set((s.chests ?? []).map((c) => `${c.x}:${c.y}`));
  const seen = new Set([`${sx}:${sy}`]);
  let q = [{ x: sx, y: sy }];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (onEdge(cur.x, cur.y)) return true;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as Array<[number, number]>) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = `${nx}:${ny}`;
        if (seen.has(k) || blocked.has(k)) continue;
        if (!traversable(s.tiles[ny]![nx]!)) continue;
        seen.add(k); nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return false;
}

/**
 * Primer paso cardinal hacia el borde `exitDir` (BFS de arena que RODEA cofres impasables,
 * compañeros y terreno no pisable). Si el actor ya está EN el borde objetivo, devuelve
 * `exitDir` (el paso siguiente lo saca del mapa = huida walk-off fiel). `null` = sin ruta.
 */
function escapeFirstStep(
  s: { ax: number; ay: number; tiles: number[][]; occ: Array<{ x: number; y: number }>; chests?: Array<{ x: number; y: number }> },
  exitDir: "north" | "south" | "east" | "west",
): string | null {
  const G = s.tiles.length;
  const onExitEdge = (x: number, y: number) =>
    exitDir === "west" ? x === 0 : exitDir === "east" ? x === G - 1 : exitDir === "north" ? y === 0 : y === G - 1;
  if (onExitEdge(s.ax, s.ay)) return exitDir;
  const blocked = new Set([...s.occ, ...(s.chests ?? [])].map((o) => `${o.x}:${o.y}`));
  const key = (x: number, y: number) => `${x}:${y}`;
  const prev = new Map<string, { x: number; y: number; dir: string }>();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  const DIRS: Array<[number, number, string]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (onExitEdge(cur.x, cur.y)) {
        let c = key(cur.x, cur.y);
        let firstDir: string | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k) || blocked.has(k)) continue;
        if (!traversable(s.tiles[ny]![nx]!)) continue;
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir });
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

/**
 * `resolveArenaCombat` — resolvedor de arena CANÓNICO (brief-ch15 Entrega A), future-ready
 * contra la semántica de fidelidad `fiel/sword-chaos-2`. Sustituye al melé `dungeonResolveRoomCombat`
 * (legacy; ch14b migra en fase 2). Conduce las teclas REALES del handler de combate:
 *   · turno "other" (enemigo o PJ POSEÍDO) → `Space`: bombea la IA (fase 2) o pasa el turno
 *     del poseído (main actual). NUNCA intenta controlar a un poseído — requisito (a).
 *   · turno de un PJ no-poseído: enemigo en alcance → (A)ttack-Aim+Enter; si no, PASO cardinal
 *     hacia el enemigo (BFS de arena, `combatFirstStep`, requisito (c) posicionamiento); sin
 *     ruta → `Space`.
 * CIERRE POR BANDO (requisito (b)): delega en `game.over`/`victory` — side-based en fase 2
 * (over-by-bando), kind-based en main actual; el resolvedor sólo espera el fin. El aserto de
 * ÉXITO (victory + cero bajas del bando PARTY) vive en el spec de validación.
 *
 * Determinista bajo seed-0 + party sembrada (misma lectura → misma secuencia de teclas).
 * Devuelve true si el combate terminó; false si se atascó (guard >60).
 *
 * RANGED: este resolvedor YA dispara a distancia sin código extra — `inRange` sale de
 * `aimGeometry`, que apunta al enemigo más cercano DENTRO del ALCANCE DEL ARMA EQUIPADA, y
 * `a`+`Enter` confirma sobre él (`playerAttack`). Con un arma de alcance (Magic Bow, alcance
 * 15) hostiga desde el turno 1 sin acercarse. El «melé-only» de una versión previa de este
 * JSDoc era FALSO: describía sólo el comportamiento con armas de alcance 1 (el sembrado de
 * ch90). Verificado en Doom (ch18): gana las salas #96/#99/#103 —Reapers y Dragons a distancia—
 * con el loadout ranged. Para DESCENDER por la escalera interior de una sala, ver
 * `resolveRoomDescend`.
 */
/**
 * Primer paso cardinal (BFS de arena) hacia la PLACA de sala sin pisar más cercana. La
 * placa es una celda ANDABLE que ES el goal: el paso que aterriza en ella la dispara
 * (COMBAT 0x111A) y muta la rejilla (abre muros). `stepped` recuerda las ya pisadas
 * (one-shot). Devuelve `{ dir }` (paso hacia ella) o `{ onPlate: true }` si el actor ya
 * está encima, o `null` si ninguna es alcanzable a pie. Es la capacidad NUEVA del arnés
 * conquerRoom para desellar salas como #29 (Deceit) pisando (5,5).
 */
function plateFirstStep(
  s: { ax: number; ay: number; tiles: number[][]; occ: Array<{ x: number; y: number }>; chests?: Array<{ x: number; y: number }>; plates: Array<{ x: number; y: number }> },
  stepped: Set<string>,
): { dir?: string; onPlate?: boolean } | null {
  const G = s.tiles.length;
  const goals = s.plates.filter((p) => !stepped.has(`${p.x}:${p.y}`) && traversable(s.tiles[p.y]?.[p.x] ?? -1));
  if (!goals.length) return null;
  if (goals.some((p) => p.x === s.ax && p.y === s.ay)) return { onPlate: true };
  const goalSet = new Set(goals.map((p) => `${p.x}:${p.y}`));
  const occ = new Set([...s.occ, ...(s.chests ?? [])].filter((o) => !(o.x === s.ax && o.y === s.ay)).map((o) => `${o.x}:${o.y}`));
  const key = (x: number, y: number) => `${x}:${y}`;
  const prev = new Map<string, { x: number; y: number; dir: string }>();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  const DIRS: Array<[number, number, string]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (goalSet.has(key(cur.x, cur.y)) && !(cur.x === s.ax && cur.y === s.ay)) {
        let c = key(cur.x, cur.y); let first: string | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; first = p.dir; c = key(p.x, p.y); }
        return first ? { dir: first } : null;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        const isGoal = goalSet.has(k);
        if (!isGoal && !traversable(s.tiles[ny]![nx]!)) continue;
        if (occ.has(k) && !isGoal) continue;
        seen.add(k); prev.set(k, { x: cur.x, y: cur.y, dir }); nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

/**
 * @param opts.plates OPT-IN (default OFF): habilita la capacidad "cuando atascado, ve a
 *   PISAR una placa alcanzable" para desellar salas por trigger (.CBT). Se deja APAGADO por
 *   defecto para NO alterar los capítulos que asertan un dead-end sin placa (p. ej. ch16b,
 *   cuyo veredicto depende de P0a). `conquerRoom` lo enciende.
 */
export async function resolveArenaCombat(page: Page, opts: { maxRounds?: number; plates?: boolean; sceptre?: boolean } = {}): Promise<boolean> {
  const t0 = Date.now();
  const ok = await resolveArenaCombatInner(page, opts);
  // TELEMETRÍA (opt-in, no-op sin env): cierre del resolvedor (resuelto + duración).
  await recordCombatEnd(page, { resolver: "arena", resolved: ok, ms: Date.now() - t0 });
  return ok;
}

async function resolveArenaCombatInner(page: Page, opts: { maxRounds?: number; plates?: boolean; sceptre?: boolean } = {}): Promise<boolean> {
  const steppedPlates = new Set<string>();
  // Discriminador de #125: ¿las bajas son ANTERIORES o POSTERIORES al (U)se Cetro?
  let sceptreUsed = false;
  const maxRounds = opts.maxRounds ?? 400;
  let stuck = 0;
  // Progreso enemigo (ruling A.1): el guard de atasco NO cuenta mientras haya PROGRESO
  // enemigo (posiciones de enemigos vivos cambiando entre rondas). Un móvil que se acerca
  // mantiene el combate VIVO (acabará en rango → Attack); sólo enemigos INMÓVILES e
  // inalcanzables (posiciones congeladas ≥60 rondas) son atasco REAL → DEADEND. Así los
  // winnable-por-móvil se ganan sin inflar los dead-ends legítimos.
  let enemyPrev: string | null = null;
  let noProgress = 0;
  // ★ #167 — SEGUNDA SEÑAL DE ATASCO, independiente del actor. El `noProgress` de arriba se
  // resetea en cuanto el ACTOR consigue moverse, y eso lo vuelve CIEGO al caso que midió #166:
  // party desarmada («bare hands») frente a enemigos congelados, con dos miembros alternando
  // turno y paseando entre dos celdas. Medido allí: 400 rondas, CERO bajas, enemigos quietos en
  // (2,4)/(3,7) de la ronda 0 a la 399, y `noProgress` en 0 TODO el rato ⇒ el combate corría
  // hasta el techo de presupuesto y salía como THROW (no-veredicto) en vez de como atasco.
  //
  // Esta señal mira SÓLO al bando enemigo: su CENSO y sus CELDAS. Se resetea si muere alguien
  // o si alguno se mueve — o sea, ante cualquier progreso real, venga de donde venga. Umbral
  // deliberadamente HOLGADO (150 rondas de jugador con el bando enemigo byte-idéntico) para no
  // cortar peleas lentas pero vivas: en el caso de #166 habría saltado a la 150 en vez de a la
  // 400, y en el estado sano de hoy no llega a dispararse (control corrido: cero cambios).
  // NO sustituye a `noProgress`: se suma, así sólo puede hacer que el resolvedor se rinda
  // ANTES en combates que hoy agotan el presupuesto, nunca en uno donde algo se mueve.
  let enemySig: string | null = null;
  let frozenEnemies = 0;
  const FROZEN_LIMIT = 150;
  // Salida tras la VICTORIA: el bando enemigo limpio NO cierra el combate (COMBAT:0x0cf6
  // fall-through). La party debe SALIR ANDANDO por el borde (SJOG:0x1C56→0x1BB2), todos
  // por la MISMA salida ("All must use the same exit!"). Se compromete UNA dirección la
  // primera vez que se llega a victoria y se camina a todos los miembros hacia ella.
  let exitDir: "north" | "south" | "east" | "west" | null = null;
  // DES-FIJAR el activo por ESTADO DIRECTO (NO por la tecla '0'): si una fase previa del
  // arnés fijó g_active_char (p. ej. jimmyDoor activa el mejor-DEX vía setActivePlayer, y el
  // byte 0x2d5 del checkpoint viene con activeCharacter=2 pinneado) queda != 0xFF al entrar a
  // la sala; SÓLO ese miembro sería interpelado cada ronda y los demás auto-pasarían
  // (`Combat.skipsForActiveChar`). La entrada FIEL a una sala fresca NO trae activo fijado
  // (0xFF = la iniciativa interpela a TODA la party). ANTES se pulsaba '0' («Set active =
  // None», COMBAT:0x063E) para des-fijarlo — PERO tras el hotfix careo-combate f2a1f18c un
  // dígito '0'-'6' en combate CEDE EL TURNO del actor en curso (playerYieldTurn, COMBAT
  // 0x0B79-0x0B83) → la party perdía UNA acción y desplazaba el resultado determinista
  // (regresión: ch91/#29 y salas de Wrong daban e1:d0 = 1 enemigo vivo / 0 bajas = DEADEND en
  // FALSO, y SÓLO en salas alcanzadas tras un pin → flip selectivo). Se des-fija por estado
  // (idéntico al 0xFF que el core escribe al morir el activo, combat.ts:1376): mismo
  // des-fije, CERO turno, CERO RNG, stream sembrado intacto. DENTRO de los guardas
  // inDungeonCombat/arenaSnapshot (no antes) para no tocar un game.state ausente/cerrado.
  let unpinned = false;
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return true;
    const s = await arenaSnapshot(page);
    if (!s) return true;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    if (!unpinned) {
      unpinned = true;
      const pinned = await page.evaluate(() => (window as unknown as { __u5test: { game: { state: { activeCharacter: number } } } }).__u5test.game.state.activeCharacter);
      if (pinned !== 0xff) {
        await page.evaluate(() => {
          (window as unknown as { __u5test: { game: { state: { activeCharacter: number } } } }).__u5test.game.state.activeCharacter = 0xff;
        });
        continue; // re-snapshota con 0xFF activo; NO cede turno (a diferencia del viejo press '0')
      }
    }
    // TELEMETRÍA por RONDA de jugador (no por frame): celda del actor + enemigos + el
    // contador de atasco más avanzado del resolvedor (stuck de salida / noProgress).
    await recordCombatRound(page, { resolver: "arena", round, ax: s.ax, ay: s.ay, enemies: s.enemies.length, enemyCells: s.enemies.map((e) => `${e.x},${e.y}`), sceptreUsed, stuck: Math.max(stuck, noProgress, frozenEnemies) });
    // ★ #167 — LA SEÑAL VA AQUÍ, ARRIBA DEL TODO, y la COLOCACIÓN es el hallazgo.
    // Primer intento: la puse abajo, junto a `enemyPrev`. NO SALTABA, y el control positivo lo
    // cazó: la rama `if (s.aimAt)` de la línea siguiente hace `stuck = 0; continue;`
    // **incondicionalmente** — ataca y da el turno por bueno SIN comprobar que el ataque haya
    // conseguido nada. Con la party a puñetazos (#166) esa rama se toma cada ronda, así que
    // reseteaba `stuck` y se saltaba cualquier contador puesto más abajo. Es el SEGUNDO punto
    // ciego del resolvedor, hermano del de `noProgress`, y explica por qué la telemetría de
    // #166 mostraba `stuck=0` durante las 400 rondas enteras.
    // Firma del bando enemigo = CENSO + CELDAS: cambia si muere alguien O si alguno se mueve;
    // idéntica sólo si en el bando contrario no ha pasado NADA. (El censo va aparte de las
    // celdas a propósito: una baja simultánea a un paso podría dejar el join igual.)
    const foeSig = `${s.enemies.length}#${s.enemies.map((e) => `${e.x},${e.y}`).sort().join("|")}`;
    frozenEnemies = foeSig === enemySig ? frozenEnemies + 1 : 0;
    enemySig = foeSig;
    if (frozenEnemies > FROZEN_LIMIT) return false;
    // Aim ABIERTO por la cadena de armas (pacers vivos, ver `danglingAimOpen`): ciérralo con
    // ESC (consume el golpe pendiente, fiel) ANTES de decidir — con él abierto, 'a' CONFIRMA
    // en el cursor y las flechas mueven el cursor, no al actor. En test (beat 0) nunca salta.
    if (await danglingAimOpen(page)) { await press(page, "Escape"); continue; }
    if (s.aimAt) { await pressAimAttack(page, { ax: s.ax, ay: s.ay, aimFrom: s.aimFrom, aimAt: s.aimAt }); stuck = 0; continue; }
    if (!s.enemies.length) {
      // Victoria: camina al miembro activo hacia el borde comprometido para salir.
      if (!exitDir) {
        // "VICTORY!" ya se imprimió al limpiar el bando enemigo (COMBAT:0x0cf6) y la consola
        // (scrollback 12) lo BORRA durante la salida — igual que el original. Se captura AQUÍ,
        // en el momento de la victoria, para que el spec pueda comprobar que se anunció.
        await page.evaluate(() => {
          const w = window as unknown as { __arenaVictoryLog?: string; __u5test: { consoleLines: () => string[] } };
          w.__arenaVictoryLog = w.__u5test.consoleLines().join("\n");
        });
        // RULING ch90-secundario (team-lead): post-victoria se sale ANDANDO por el borde en
        // AMBAS superficies y se ecoa «Leave!» por miembro. f19a2c0a T9 (SJOG 0x1bb2 = «Leave!»
        // post-victoria/0 enemigos; 0x1b6c = «Escape!» huida CON enemigos; CMDS 0x17ec): el eco
        // fiel tras limpiar el bando es «Leave!». ANTES en ARENA se pulsaba ESC para retirar a la
        // party, pero tras f19a2c0a eso ecoa «Escape!» (semántica de HUIDA — no hay de qué huir
        // post-victoria). Salir andando unifica el resolvedor y ecoa «Leave!» (lo que hace un
        // jugador tras ganar). El ESC-flee de esc-flee-verdict.md sigue siendo fiel para HUIDAS
        // reales — no se toca ahí. En overworld NO se pulsa (dungeonState===null) para no
        // disparar el «Escape!».
        // ⚠ CORRECCIÓN 2026-07-25 (re/notes/esc-sala-derivacion.md): aquí ponía que «en SALA el
        // ESC post-victoria es INOCUO (no cierra combate)». Eso describe el comportamiento
        // FIEL — CMDS.OVL 0x17ec pone el gate de SALA (0x1822, `test [g_unk_58a1],0x80`) ANTES
        // del de victoria (0x183a), así que en sala imprime «-Not here!» y NUNCA retira —, pero
        // NO el del motor de hoy: `playerEscapeQuick` mira primero si quedan enemigos, y con la
        // sala GANADA retira y cierra también en sala (divergencia declarada,
        // re/deliberate-divergences.md addendum T9). O sea: HOY estos 2 ESC SÍ cierran la sala y
        // la salida a pie de abajo es código MUERTO en salas. Cuando se aplique el gate fiel
        // (2 líneas en combat.ts) esta rama caerá a la salida a pie → RE-SELLO de la cadena de
        // salas obligatorio (ch35 r7, par emparedado, se midió THROW).
        const onDungeonSurface = await page.evaluate(() => (window as unknown as { __u5test: { game: { dungeonState: unknown } } }).__u5test.game.dungeonState !== null);
        if (onDungeonSurface) {
          for (let esc = 0; esc < 2; esc++) {
            await press(page, "Escape");
            if (!(await inDungeonCombat(page))) return true;
          }
        }
        // Salida a pie por el borde común (arena y salas): produce «Leave!» por miembro.
        const toLeft = s.ax, toRight = 10 - s.ax, toTop = s.ay, toBottom = 10 - s.ay;
        // ★ ELECCIÓN POR ALCANZABILIDAD, no por cercanía (#50, medido en ch22 r5 de Destard).
        // La versión anterior tomaba el borde MÁS CERCANO al actor activo y, si no había ruta,
        // ROTABA al siguiente en orden fijo. Eso falla de dos maneras: (1) en salas cuyo borde
        // cercano es muro macizo —r5 tiene la columna oeste y las filas norte y sur enteras de
        // muro, y el ÚNICO borde viable es el este— la elección nace muerta; y (2) rotar
        // contradice «All must use the same exit!» en cuanto el motor fija `escapeBorder`
        // (combat.ts:2694), porque los pasos por otro borde sólo cosechan rechazos.
        // Ahora: se filtra por bordes REALMENTE alcanzables (BFS que ignora a los compañeros,
        // que son obstáculos transitorios) y entre ésos se toma el más cercano.
        const cands: Array<{ dir: "north" | "south" | "east" | "west"; d: number }> = [
          { dir: "west", d: toLeft }, { dir: "east", d: toRight },
          { dir: "north", d: toTop }, { dir: "south", d: toBottom },
        ].filter((c) => edgeReachable(s, c.dir as "north" | "south" | "east" | "west", s.ax, s.ay)) as Array<{ dir: "north" | "south" | "east" | "west"; d: number }>;
        cands.sort((a, b) => a.d - b.d);
        // Sin NINGÚN borde alcanzable: quedan las OTRAS DOS puertas del original — KLIMB
        // (0xC8/0xC9/0x86ᴿ) y CETRO. Van AQUÍ y no antes: son último recurso a propósito
        // (ver `lastResortExitStep`). Si tampoco hay ninguna, ES un bolsillo emparedado de
        // verdad —DOS en todo el juego: Doom r6 (cm118) y r15 (cm127)— y no se fabrica salida.
        if (!cands.length) {
          const lr = await lastResortExitStep(page);
          if (lr === "acted") { stuck = 0; continue; }
          if (lr === "waited") { stuck++; continue; } // el techo de `stuck` sigue acotando el atasco real
          return false;
        }
        exitDir = cands[0]!.dir;
      }
      // ★ El motor MANDA sobre el conductor: si ya comprometió un borde, ése y no otro.
      if (s.committedBorder && s.committedBorder !== exitDir) exitDir = s.committedBorder;
      // BFS al borde comprometido RODEANDO cofres impasables/compañeros/terreno.
      const step = escapeFirstStep(s, exitDir);
      if (step) {
        await press(page, CARDINAL_ARROW[step]!);
        const s2 = await arenaSnapshot(page);
        stuck = s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay ? stuck + 1 : 0;
      } else if (edgeReachable(s, exitDir, s.ax, s.ay)) {
        // Hay ruta al borde comprometido pero AHORA MISMO la tapa un compañero: pasar el turno
        // deja que se aparte. NO se rota de borde (sería el rechazo de «same exit»).
        await press(page, " ");
        stuck++;
      } else {
        // Este miembro NO alcanza el borde comprometido ni ignorando compañeros. No se puede
        // cambiar de borde sin contradecir al motor ⇒ se pasa el turno y se deja constancia
        // por el contador; si es general, cae en el techo de abajo.
        await press(page, " ");
        stuck++;
      }
      if (stuck > 60) return false; // sin ruta de salida por ningún borde: estancado
      continue;
    }
    // ¿Se movió algún enemigo vivo desde nuestra ronda anterior? (progreso = combate vivo).
    const enemyKey = s.enemies.map((e) => `${e.x},${e.y}`).sort().join("|");
    const enemyMoved = enemyPrev !== null && enemyKey !== enemyPrev;
    enemyPrev = enemyKey;
    const dir = combatFirstStep(s);
    if (dir) {
      await press(page, CARDINAL_ARROW[dir]!);
      const s2 = await arenaSnapshot(page);
      const blocked = !!s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay;
      // Bloqueados PERO con enemigos moviéndose = progreso (esperamos al móvil); sólo cuenta
      // atasco si el paso se bloquea Y los enemigos están congelados.
      noProgress = blocked && !enemyMoved ? noProgress + 1 : 0;
    } else if (opts.sceptre && findBoundary(s.tiles)) {
      // CAPACIDAD DEL CETRO (cm120/testigo-4): sin ruta a pie al enemigo porque está SELLADO tras
      // una muralla ShadowlordBoundary (0x70-0x7f). El (U)se Cetro barre el 3×3 del combatiente
      // activo y disuelve la muralla a Grass (combat.ts sceptreDissolveFields, 0x1966) → abre el
      // paso. Si la muralla está adyacente, úsalo; si no, camina hacia la más cercana. Fiel: el
      // jugador rompe la caja con el Cetro y entonces alcanza a los Daemons.
      if (boundaryAdjacent(s.ax, s.ay, s.tiles)) {
        const used = await pickerUseSceptre(page);
        if (used) sceptreUsed = true;
        noProgress = used ? 0 : noProgress + 1;
      } else {
        const nb = findBoundary(s.tiles)!;
        const step = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: nb, occ: s.occ });
        if (step) {
          await press(page, CARDINAL_ARROW[step]!);
          const s2 = await arenaSnapshot(page);
          noProgress = s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay && !enemyMoved ? noProgress + 1 : 0;
        } else { await press(page, " "); noProgress = enemyMoved ? 0 : noProgress + 1; }
      }
    } else if (opts.plates && plateFirstStep(s, steppedPlates)) {
      // CAPACIDAD DE PLACA (conquerRoom): sin ruta a NINGÚN enemigo → quizá están sellados
      // tras un muro que una PLACA abre. Ve a pisar la placa alcanzable más cercana; el paso
      // que aterriza en ella dispara el trigger (COMBAT 0x111A) y muta la rejilla. Una placa
      // ya pisada (one-shot) se recuerda en `steppedPlates` para no re-visitarla.
      const ps = plateFirstStep(s, steppedPlates)!;
      if (ps.onPlate) {
        steppedPlates.add(`${s.ax}:${s.ay}`);
        await press(page, " "); // ya está encima (disparó al llegar); pasa el turno
        noProgress = 0;
      } else if (ps.dir) {
        await press(page, CARDINAL_ARROW[ps.dir]!);
        const s2 = await arenaSnapshot(page);
        if (s2 && s2.turn === "player") {
          if (s.plates.some((p) => p.x === s2.ax && p.y === s2.ay)) steppedPlates.add(`${s2.ax}:${s2.ay}`);
          noProgress = s2.ax === s.ax && s2.ay === s.ay && !enemyMoved ? noProgress + 1 : 0;
        }
      }
    } else {
      // Sin ruta al enemigo: probable TAPÓN de cofres por-muerte (impasables) en una
      // puerta. Juega como el jugador real: (O)pen direccional del cofre vecino lo
      // retira y despeja el paso; si no hay cofre adyacente, camina hacia el más cercano.
      const un = chestUnblockStep(s);
      if (un?.open) {
        await press(page, "o");
        await press(page, CARDINAL_ARROW[un.open]!);
        noProgress = 0;
      } else if (un?.walk) {
        await press(page, CARDINAL_ARROW[un.walk]!);
        noProgress = 0;
      } else {
        // Enemigo inalcanzable a pie y sin cofre que desatascar (p. ej. caminante en un
        // bolsillo tras un rastrillo): ESPERAR es jugar — su paseo aleatorio puede asomarlo
        // a una celda con línea de tiro (inRange dispara el Attack). Si el enemigo SE MUEVE
        // esto es progreso (combate vivo); si está CONGELADO, cuenta hacia el atasco real.
        await press(page, " ");
        noProgress = enemyMoved ? 0 : noProgress + 1;
      }
    }
    // Atasco REAL = enemigos inalcanzables Y congelados ≥60 rondas (ruling A.1). Un móvil que
    // se acerca resetea `noProgress` y mantiene el combate hasta maxRounds (o hasta ganarlo).
    if (noProgress > 60) return false;
    // ★ #167: y el atasco que el de arriba NO ve — bando enemigo byte-idéntico (mismo censo,
    // mismas celdas) durante FROZEN_LIMIT rondas de jugador. Ni una baja ni un paso enemigo.
    if (frozenEnemies > FROZEN_LIMIT) return false;
  }
  return !(await inDungeonCombat(page));
}

/**
 * ── CAPACIDAD AN GRAV del resolvedor (cierre de la ficha de arnés de
 * `re/notes/energia-readjudicacion-cm18-cm20-cm121.md` §4, carril combate-cabos) ──
 *
 * POLÍTICA (la disciplina que pedía la ficha): An Grav NO es primera opción — sólo se
 * intenta cuando el veredicto ya sería **DEADEND-STUCK** (resolvedor agotado + huida por
 * borde fallida) **y hay campos 0xEB en el tablero**. Así las salas que se ganan sin
 * gastar casts conservan sus sellos byte a byte (ninguna toca esta rama), y los
 * emparedados SIN campos (Doom r6/r15) siguen siendo DEADEND-STUCK fieles. Censo
 * 2026-08-24 sobre los 128 combatmaps: cm18 es el ÚNICO mapa del juego con 0xEB
 * (12 unidades, pilas 4+4+4 en (4,5)/(5,5)/(6,5)) — la población alcanzable de esta
 * rama es exactamente esa sala.
 *
 * El cableado jugable ya existía entero (castDispelField + cursor CAST2:0x306 en
 * main.ts, ejercitado por ch47); esto es sólo el REPERTORIO del arnés — misma familia
 * que `sceptre`/`sceptreClear` (#12) y `plates`. Juega como el jugador real: teclado
 * c → 'a','g' → cursor desde la celda propia → flechas → Enter (sin clamp de alcance,
 * fiel al asm), una capa por cast («Success!»; la pila de N pide N casts).
 */

/** Celdas DISTINTAS con al menos un 0xEB vivo (la familia entera es (tile&0xfc)==0xe8;
 *  sólo 0xEB bloquea — COMBAT:0x0000 @00a4). */
async function ebCellsOnBoard(page: Page): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: { lootTiles: () => Array<{ x: number; y: number; tile: number }> } | null } } }).__u5test.game.combat;
    if (!c) return [];
    const seen = new Set<string>();
    const out: Array<{ x: number; y: number }> = [];
    for (const l of c.lootTiles()) {
      if (l.tile !== 0xeb) continue;
      const k = `${l.x}:${l.y}`;
      if (!seen.has(k)) { seen.add(k); out.push({ x: l.x, y: l.y }); }
    }
    return out;
  });
}

/** ¿Hay ruta a pie hasta ADYACENTE de un enemigo contando los 0xEB como MURO? (El BFS de
 *  `combatFirstStep` no ve los campos — son objetos, no tiles — y por eso el resolvedor
 *  se atasca cosechando «Blocked!»; éste es el predicado que decide si la pila sigue
 *  cortando el paso.) */
function routeOpenToEnemy(
  s: { ax: number; ay: number; tiles: number[][]; enemies: Array<{ x: number; y: number }>; occ: Array<{ x: number; y: number }>; chests?: Array<{ x: number; y: number }> },
  eb: Array<{ x: number; y: number }>,
): boolean {
  const G = s.tiles.length;
  const blocked = new Set([...(s.chests ?? []), ...eb].map((o) => `${o.x}:${o.y}`));
  const enemyAdj = new Set<string>();
  for (const e of s.enemies) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) enemyAdj.add(`${e.x + dx}:${e.y + dy}`);
  const seen = new Set([`${s.ax}:${s.ay}`]);
  let q = [{ x: s.ax, y: s.ay }];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (enemyAdj.has(`${cur.x}:${cur.y}`)) return true;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = `${nx}:${ny}`;
        if (seen.has(k) || blocked.has(k) || !traversable(s.tiles[ny]![nx]!)) continue;
        // Los compañeros (occ) son obstáculo transitorio: se ignoran, como en edgeReachable.
        seen.add(k);
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return false;
}

/** ¿Puede castear An Grav quien tiene el turno? Stock mezclado (índice 18) y maná del
 *  lanzador (3er círculo = 3 MP). Sin stock el flujo de teclas no abre cursor y las
 *  flechas MOVERÍAN al PJ — por eso el pre-check va antes de tocar el teclado. */
async function anGravReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { combat: { currentUnit: { kind: string; charIdx?: number } | null } | null; state: { spellQuantities: number[]; characters: Array<{ currentMp: number }> } } } }).__u5test.game;
    if ((g.state.spellQuantities[18] ?? 0) < 1) return false;
    const cur = g.combat?.currentUnit;
    if (!cur || cur.kind !== "player" || cur.charIdx === undefined) return false;
    return (g.state.characters[cur.charIdx]?.currentMp ?? 0) >= 3;
  });
}

/** An Grav por TECLADO (la receta de ch47): c → 'a','g' → Enter cierra el getstring
 *  rúnico → cursor de Aim desde la celda del lanzador (CAST2:0x306, sin clamp) →
 *  flechas hasta (tx,ty) → Enter. Devuelve el eco del tail del Cast. */
async function castAnGravKeys(page: Page, ax: number, ay: number, tx: number, ty: number): Promise<string> {
  await press(page, "c");
  await page.waitForTimeout(150);
  await press(page, "a");
  await press(page, "g");
  await press(page, "Enter");
  await page.waitForTimeout(150);
  const dx = tx - ax, dy = ty - ay;
  for (let i = 0; i < Math.abs(dx); i++) await press(page, dx > 0 ? "ArrowRight" : "ArrowLeft");
  for (let i = 0; i < Math.abs(dy); i++) await press(page, dy > 0 ? "ArrowDown" : "ArrowUp");
  await press(page, "Enter");
  for (let i = 0; i < 100; i++) {
    const tail = (await consoleTail(page, 6)).join("\n");
    if (tail.includes("Success!")) return "Success!";
    if (tail.includes("Failed!")) return "Failed!";
    await page.waitForTimeout(50);
  }
  return "";
}

/** Pela con An Grav la(s) pila(s) 0xEB que cortan el paso hasta que exista ruta a un
 *  enemigo (o no queden 0xEB). Devuelve true si dejó el tablero con ruta abierta tras
 *  ≥1 cast; false = no aplica (sin 0xEB, sin stock/maná, cast fallido o tope). */
async function anGravUnseal(page: Page, maxRounds = 200): Promise<boolean> {
  let casts = 0;
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return casts > 0;
    const s = await arenaSnapshot(page);
    if (!s) return casts > 0;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    const eb = await ebCellsOnBoard(page);
    if (!eb.length) return casts > 0; // tablero limpio de 0xEB
    if (routeOpenToEnemy(s, eb)) return casts > 0; // los 0xEB que quedan ya no cortan
    // Pila objetivo: la que, despejada, más acerca — primero cercanía al enemigo más
    // próximo, luego al lanzador (en cm18 cualquiera de las tres del istmo abre).
    const md = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const target = [...eb].sort((a, b) => {
      const ea = Math.min(...s.enemies.map((e) => md(a, e)), 99);
      const eBest = Math.min(...s.enemies.map((e) => md(b, e)), 99);
      return ea - eBest || md(a, { x: s.ax, y: s.ay }) - md(b, { x: s.ax, y: s.ay });
    })[0]!;
    if (!(await anGravReady(page))) return false; // sin stock/maná: no se fabrica
    const res = await castAnGravKeys(page, s.ax, s.ay, target.x, target.y);
    if (res !== "Success!") return false;
    casts++;
    if (casts > 26) return false; // cota dura: la pila más honda del juego es 6 (cm121)
  }
  return false;
}

/** Veredicto de conquista de una sala (Fase 1). `DEADEND` = no se ganó pero la party
 *  SOBREVIVE (enemigos sellados inalcanzables aun con placa) — el caller decide si es
 *  DEAD-END FIEL con cita o `FAIL`. `FAIL` = la party fue DERROTADA (bug del arnés/port,
 *  jamás se banca sin cita). */
export interface ConquerVerdict {
  outcome: "VICTORY" | "VICTORY-STUCK" | "DEADEND" | "DEADEND-STUCK" | "FAIL";
  enemiesAlive: number;
  partyDeaths: number;
  digest: string;
  /**
   * ROSTER DE ENTRADA: censo `n×Nombre` de los enemigos que el .CBT montó, leído ANTES de
   * resolver el combate (después no existe: la victoria desmonta `game.combat` y la huida lo
   * cierra). Es DIAGNÓSTICO — ninguna aserción cuelga de él; existe porque desde la pieza 14
   * del lote (familia `0xEC` = grupo aleatorio de DS `0x385e`) el elenco de una sala ya no se
   * lee del `.CBT` a ojo: 4 tiradas `rand(0,7)` en el montaje deciden QUÉ especie ocupa cada
   * uno de los tiles 236-239, así que «con qué roster salió» sólo lo puede decir la corrida.
   * Es una LECTURA pura (`page.evaluate` sin pulsar tecla): no toca el stream RNG.
   */
  roster?: string;
}

/**
 * `conquerRoom` — arnés reutilizable de conquista de UNA sala de mazmorra (Fase 1). Asume
 * el combate de sala YA disparado (el caller navegó con el facing correcto y pisó la celda);
 * resuelve con `resolveArenaCombat` INCLUYENDO la capacidad de PLACA (`plates:true` — «cuando
 * atascado, ve a pisar la placa alcanzable», desella salas por trigger .CBT como #29) y
 * devuelve el veredicto {VICTORY|DEADEND|FAIL}. Para salas cuya salida es la escalera
 * INTERIOR (Doom N3→N4), pasa `descend` + `ladderTile` y usa el resolvedor klimb-descend.
 *
 * GOTCHA cableado en el motor: los triggers de placa SÓLO disparan en combate de SALA
 * (`roomCombat`=g_unk_58a1&0x82); `startDungeonRoomCombat` ya lo pone, así que aquí basta
 * con `plates:true`. Determinista bajo el seed sembrado por el caller (reseed(0)).
 */
/** Lectura pura del estado del combate para puntuar el veredicto (sin teclas, sin RNG). */
async function roomVerdictSnap(page: Page): Promise<{ inCombat: boolean; enemiesAlive: number; victory: boolean; partyDeaths: number; allDown: boolean }> {
  return page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { combat: any; state: any } } }).__u5test.game;
    const c = g.combat;
    const enemiesAlive = c ? c.combatants.filter((u: any) => u.kind === "enemy" && u.status !== "dead" && u.status !== "fled").length : 0;
    const victory = c ? !!c.victory : true; // combate cerrado tras victoria = sin `combat`
    const partyDeaths = g.state.characters.slice(0, g.state.partySize).filter((c2: any) => c2.status === "D").length;
    const allDown = g.state.characters.slice(0, g.state.partySize).every((c2: any) => c2.status === "D");
    return { inCombat: c !== null, enemiesAlive, victory, partyDeaths, allDown };
  });
}

export async function conquerRoom(
  page: Page,
  opts: { maxRounds?: number; descend?: boolean; descendDir?: "up" | "down"; sceptre?: boolean; sceptreClear?: boolean } = {},
): Promise<ConquerVerdict> {
  if (!(await inDungeonCombat(page))) {
    return { outcome: "FAIL", enemiesAlive: 0, partyDeaths: 0, digest: "FAIL:no-combat" };
  }
  // ROSTER DE ENTRADA (diagnóstico, ver ConquerVerdict.roster): lectura pura del elenco ANTES
  // de resolver — luego no existe. Sin esto, «con qué roster salió la sala» es incontestable
  // desde la pieza 14 del lote: los tiles 236-239 sacan su especie de 4 tiradas del montaje.
  const roster = await page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: { combatants: Array<{ kind: string; enemyDef?: { name?: string } }> } | null } } }).__u5test.game.combat;
    if (!c) return "";
    const tally: Record<string, number> = {};
    for (const u of c.combatants) {
      if (u.kind !== "enemy") continue;
      const n = u.enemyDef?.name ?? "?";
      tally[n] = (tally[n] ?? 0) + 1;
    }
    return Object.entries(tally).sort().map(([n, k]) => `${k}x${n}`).join("+") || "vacía";
  });
  if (opts.descend) {
    // `sceptre`: la escalera interior está SELLADA por una barrera ShadowlordBoundary (0x71) que
    // el (U)se Cetro disuelve — el descenso FIEL de la #99 de Doom bajo el spawn P0a (spawn-norte).
    if (opts.sceptre) await resolveRoomSceptreDescend(page, { dir: opts.descendDir ?? "down", maxRounds: opts.maxRounds });
    else await resolveRoomDescend(page, { dir: opts.descendDir ?? "down", maxRounds: opts.maxRounds });
  } else {
    // `sceptreClear`: los enemigos están SELLADOS tras murallas ShadowlordBoundary que el Cetro
    // disuelve (no un descenso — la sala se GANA rompiendo la caja y matando; cm120/testigo-4).
    await resolveArenaCombat(page, { maxRounds: opts.maxRounds, plates: true, sceptre: opts.sceptreClear });
  }
  let snap = await roomVerdictSnap(page);
  let outcome: ConquerVerdict["outcome"];
  if (!snap.inCombat || (snap.victory && snap.enemiesAlive === 0)) outcome = "VICTORY";
  else if (snap.allDown) outcome = "FAIL"; // party derrotada
  else outcome = "DEADEND"; // atascada con enemigos vivos pero viva → sellado (caller cita)
  // DESATASCO tras DEADEND: la party no puede ganar una sala sellada pero se RETIRA (como un
  // jugador real) — HUYE andando por un borde. Si el borde NO es alcanzable (BOLSILLO
  // EMPAREDADO, ruling A.2): NADA de fabricar una salida en el juego → se marca DEADEND-STUCK
  // (party viva, combate irresoluble, flee imposible) como HALLAZGO DE FIDELIDAD (¿softlock
  // real del original? — se investiga, no se tapa). El caller NO debe encadenar navegación
  // desde este estado (re-entrar fresco); el arnés no pretende que la party escapó.
  if (outcome === "DEADEND") {
    const fled = await fleeCombat(page);
    if (!fled) {
      outcome = "DEADEND-STUCK";
      // ── POLÍTICA AN GRAV (cabecera de la capacidad, más arriba): SÓLO en el punto en
      // que el veredicto ya sería DEADEND-STUCK y con 0xEB en el tablero — nunca antes,
      // para no mover los sellos de salas que se ganan (o se retiran) sin gastar casts.
      // `anGravUnseal` no aplica (false) sin 0xEB, sin stock/maná o con cast fallido:
      // los emparedados sin campos (Doom r6/r15) y los loadouts sin el hechizo (ch29)
      // conservan su DEADEND-STUCK byte a byte.
      if (await anGravUnseal(page)) {
        await resolveArenaCombat(page, { maxRounds: opts.maxRounds, plates: true, sceptre: opts.sceptreClear });
        snap = await roomVerdictSnap(page);
        if (!snap.inCombat || (snap.victory && snap.enemiesAlive === 0)) outcome = "VICTORY";
        else if (snap.allDown) outcome = "FAIL";
        else outcome = (await fleeCombat(page)) ? "DEADEND" : "DEADEND-STUCK";
      }
    }
  }
  // ★ SIMÉTRICO AL DESATASCO DE ARRIBA, y la razón de que un fallo se volviera CASCADA (#50).
  // Existía tratamiento para «no gané y no puedo huir» (DEADEND-STUCK) y NINGUNO para «gané y
  // no puedo salir»: la línea del veredicto puntúa VICTORY con `victory && enemiesAlive===0`
  // AUNQUE `inCombat` siga abierto, así que la sala se apuntaba ganada con la party dentro y
  // el caller encadenaba navegación desde un combate vivo. Medido en ch22 Destard: r5 quedaba
  // así y r6..r15 —nueve capítulos de sala— reventaban por arrastre; sólo r5 era el fallo real.
  // Aquí se intenta la salida a pie que falta y, si tampoco sale, se NOMBRA el estado en vez de
  // esconderlo bajo VICTORY. La doctrina la declaraba ya el comentario de DEADEND-STUCK: el
  // caller NO debe encadenar navegación desde aquí.
  if (outcome === "VICTORY" && snap.inCombat) {
    const left = await fleeCombat(page);
    if (!left) outcome = "VICTORY-STUCK";
  }
  return { outcome, enemiesAlive: snap.enemiesAlive, partyDeaths: snap.partyDeaths, digest: `${outcome}:e${snap.enemiesAlive}:d${snap.partyDeaths}`, roster };
}

/** Huye de un combate de sala ANDANDO por un borde común (desatasco tras DEADEND: la party
 *  no gana la sala sellada pero se retira, como el jugador real). Reusa el escape de arena. */
async function fleeCombat(page: Page, maxRounds = 200): Promise<boolean> {
  let exitDir: "north" | "south" | "east" | "west" | null = null;
  let stuck = 0;
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return true; // fuera del combate = huyó
    const s = await arenaSnapshot(page);
    if (!s) return true;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    // ⚠ Decía «inocuo en sala», y eso describe el gate FIEL, no el motor de hoy (corregido
    // 30-07). En el binario el gate de sala va ANTES del de victoria y el ESC responde
    // «-Not here!» SIEMPRE en sala; el port CONSERVA a propósito la retirada rápida
    // post-victoria también en sala (divergencia DECLARADA, careo-combate T9, ver
    // `combat/combat.ts` §playerEscapeQuick). Así que aquí el ESC es inocuo SÓLO mientras
    // queden monstruos vivos: ganada la sala, CIERRA la escena — y este arnés depende de
    // ese cierre (hay salas sin borde alcanzable, ch35, donde el gate fiel atasca el sello).
    await press(page, "Escape"); // salida rápida (arena); en sala, sólo con enemigos vivos
    if (!(await inDungeonCombat(page))) return true;
    if (!exitDir) {
      const toLeft = s.ax, toRight = 10 - s.ax, toTop = s.ay, toBottom = 10 - s.ay;
      const min = Math.min(toLeft, toRight, toTop, toBottom);
      exitDir = min === toLeft ? "west" : min === toRight ? "east" : min === toTop ? "north" : "south";
    }
    const step = escapeFirstStep(s, exitDir);
    if (step) {
      await press(page, CARDINAL_ARROW[step]!);
      const s2 = await arenaSnapshot(page);
      stuck = s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay ? stuck + 1 : 0;
    } else {
      const order = ["north", "south", "east", "west"] as const;
      exitDir = order[(order.indexOf(exitDir) + 1) % 4]!;
      stuck++;
    }
    if (stuck > 60) {
      // El borde no da: mismas DOS puertas de último recurso que la salida post-victoria
      // (KLIMB / CETRO). Aquí también son último recurso — sólo se llega tras agotar el
      // borde. Sin ellas, una sala con Grate o escalera se etiquetaba DEADEND-STUCK
      // teniendo salida (medido: shame-r4 con su 0xC9 a 6 pasos).
      const lr = await lastResortExitStep(page);
      if (lr === "acted") { stuck = 0; continue; }
      if (lr === "waited") {
        // Esperar con la salida TAPADA no reinicia el techo: se rebaja a 40 para volver a
        // intentarlo en ~20 rondas sin borrar el presupuesto de atasco. Es una CONCESIÓN,
        // no un diseño, y su límite está MEDIDO: `shame-r4` (16 enemigos vivos, su 0xC9 a
        // 6 pasos) sigue saliendo DEADEND-STUCK porque los enemigos tapan la ruta y las
        // 200 rondas de `fleeCombat` se agotan antes de que se despeje. Predije que pasaría
        // a DEADEND y NO pasó: queda declarado como predicción fallida, no tapado. El
        // arreglo de fondo —tratar «sin borde alcanzable» como estado y no como umbral,
        // igual que hace el resolvedor— es cambio propio y no entra en esta ventana.
        stuck = 40;
        continue;
      }
      return false; // BOLSILLO EMPAREDADO de verdad: ninguna de las tres puertas
    }
  }
  return !(await inDungeonCombat(page)); // agotó rondas: true sólo si acabó fuera
}

/** Delta cardinal (celda de mazmorra) por facing — para calcular la celda de aproximación. */
const DFACING_DELTA: Record<DFacing, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 }, east: { dx: 1, dy: 0 }, west: { dx: -1, dy: 0 },
};

/**
 * ¿La sala objetivo YA está conquistada? El pather puede ATERRIZAR SOBRE la sala durante el
 * descenso (foso encadenado / Des Por que cae en su columna) → la gana EN TRÁNSITO, y entonces
 * el paso explícito de `conquerRoomAt` no dispara combate. Antes eso se etiquetaba
 * `FAIL:no-combat-on-step`; es una VICTORIA. Fuente de verdad = **bit de sala-despejada**
 * (`dungeonRoomCleared`, DNGLOOK 0x0844) — cubre salas multi-celda donde la celda-objetivo
 * concreta no se degradó a RoomsBroke pero el bit del roomNo sí está puesto; + RoomsBroke (0xA)
 * directo. (Generaliza la «victoria en tránsito» que Destard r3 reclasificó a mano por posición.)
 */
async function roomClearedInTransit(page: Page, roomCell: { floor: number; x: number; y: number }): Promise<boolean> {
  return page.evaluate(({ f, x, y }) => {
    const g = (window as unknown as { __u5test: { game: { dungeonState: any; state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const ds = g.dungeonState;
    if (!ds) return false;
    const cell = ds.cellAt(f, x, y);
    if (cell.type === 0xa) return true; // RoomsBroke = conquistada
    const roomNo = cell.sub & 0xf;
    // Bit de sala-despejada: idx = loc−0x21 (colapsa Deceit/Despise); bit = (idx<<4)+roomNo, LSB-first.
    let idx = (ds.pos.dungeon as number) - 0x21;
    if (idx >= 1) idx -= 1;
    const bit = (idx << 4) + roomNo;
    const bits = g.state.dungeonRoomsCleared;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  }, { f: roomCell.floor, x: roomCell.x, y: roomCell.y });
}

/**
 * ENTRA (o RE-ENTRA) a una sala ejecutando `doEntry` (re-nav a approach/escalera + paso/klimb)
 * → dispara dng_enter_room (combate de SALA). En modo `territory` es TOLERANTE a una emboscada de
 * pasillo que intercepte el paso (enterRoomThroughAmbush RE-PISA); en `legacy` es directa (paso +
 * comprobar combate) = el stream pass-1. Devuelve true si quedó en combate de SALA.
 */
async function enterRoom(page: Page, doEntry: () => Promise<void>): Promise<boolean> {
  if (_ambushMode === "territory") return enterRoomThroughAmbush(page, doEntry);
  await doEntry();
  return inDungeonCombat(page);
}

/**
 * Conquista una sala GOAL con la REGLA LOST-retry (ruling team-lead r13):
 *  - Una sala GOAL cuya conquista termina en DERROTA DE COMBATE — LOST = la party quedó con BAJAS
 *    (partyDeaths>0) pero NO aniquilada → estaba PERDIENDO una pelea ganable — recibe UNA re-entrada
 *    fresca: `dng_enter_room` vuelve a montar el combate. FIEL por DUNGEON 0x00c7 (`or ax,ax; jne`:
 *    sólo la VICTORIA ejecuta el marcado) + 0x00de/0x00f5 (bit `g_dng_room_cleared` @save 0x33A y
 *    degrade 0xF→0xA) ⇒ una sala NO despejada no recibe el bit y re-pisarla la re-lanza
 *    (`re/notes/dungeon.md` §14). Es la persistencia del jugador que re-pisa una pelea perdida —
 *    NO fabricación; el determinismo se mantiene bajo reseed(0). (Matiz: lo que se re-rolla es el
 *    RNG de la pelea; el ELENCO lo fija el `.CBT`.)
 *  - Una sala GOAL que termina en ATASCO — STUCK = enemigos INALCANZABLES/congelados (guard del
 *    resolvedor, partyDeaths===0) o DEADEND-STUCK (bolsillo sin borde) — es estructural: NO retry
 *    (re-entrar sólo DESANGRA sin cambiar el veredicto). Discriminador: `partyDeaths>0` = LOST.
 * Retry ×1 (acotado). Si la re-entrada RE-PIERDE, se queda DEADEND (dead-end DE ESTE STREAM, medida
 * del port y no veredicto de fidelidad —
 * el careo por-sala del censo lo adjudica; JAMÁS re-rolleo sin fin). Sólo GOAL (el tránsito no
 * pasa por aquí). En la práctica sólo dispara en r13 (final del fixpoint) → sin desangrado compuesto.
 */
async function conquerGoalRoom(
  page: Page,
  doEntry: () => Promise<void>,
  opts: { maxRounds?: number; descend?: boolean; descendDir?: "up" | "down"; sceptre?: boolean; sceptreClear?: boolean },
): Promise<ConquerVerdict> {
  const v = await conquerRoom(page, opts);
  const lost = v.outcome === "DEADEND" && v.partyDeaths > 0; // bajas peleando = derrota de combate
  if (!lost) return v; // VICTORY / STUCK (d0 / DEADEND-STUCK) → sin retry
  if (process.env.U5_DIAG_RETRY) console.log(`[LOST-retry] GOAL LOST (${v.digest}) → re-entrada fresca ×1`); // eslint-disable-line no-console
  if (!(await enterRoom(page, doEntry))) return v; // no se pudo re-pisar → conserva el DEADEND
  const v2 = await conquerRoom(page, opts);
  if (process.env.U5_DIAG_RETRY) console.log(`[LOST-retry] re-entrada → ${v2.digest}`); // eslint-disable-line no-console
  return v2; // veredicto fresco autoritativo (VICTORY si ganó; DEADEND si re-perdió — no se re-rollea más)
}

/**
 * `conquerRoomAt` — NAVEGA a una sala de mazmorra y la CONQUISTA (Fase 1, capa de
 * navegación). Deep-link mecánico para montar un capítulo por-mazmorra (Fase 2):
 *  1. Calcula la celda de APROXIMACIÓN = `roomCell` − delta(`approachDir`) (la party entra
 *     MOVIÉNDOSE en `approachDir`, así que se para en la celda anterior mirando a la sala).
 *  2. Navega a esa celda con `dungeonDescendTo` (pather de plantas, resuelve combates de
 *     paso, revela puertas secretas, admite fosos). Asume la party YA DENTRO de la mazmorra
 *     (el capítulo la metió por (E)nter/moongate) en la MISMA planta o por encima.
 *  3. Encara la sala y da UN paso → dispara el combate de sala.
 *  4. `conquerRoom(plates)` → veredicto {VICTORY|DEADEND|FAIL}.
 *
 * `approachDir` hoy sólo fija POR DÓNDE se entra (navegación); el grupo de spawn lo decide
 * el port (hardcode "south" en main; con P0a pasará a opposite-of-facing). El caller ordena
 * las salas para que la ruta entre ellas no cruce salas sin conquistar.
 */
export async function conquerRoomAt(
  page: Page,
  spec: { roomCell: { floor: number; x: number; y: number }; approachDir?: DFacing; enterByLadder?: "down" | "up"; descend?: boolean; descendDir?: "up" | "down"; sceptre?: boolean; sceptreClear?: boolean; maxRounds?: number; noDespor?: boolean; maxIters?: number; ambushMode?: AmbushMode } & DescentOpts,
): Promise<ConquerVerdict> {
  const { roomCell } = spec;
  // OPT-IN de estrategia de emboscada por call-site: el capítulo que sella con la máquina nueva
  // (territory + enterRoomThroughAmbush) lo declara aquí; sin `ambushMode` se hereda el baseline
  // legacy (bootWorld) — el stream pass-1 bajo el que están sellados ch26 y la mayoría.
  if (spec.ambushMode) setAmbushMode(spec.ambushMode);
  // `noDespor`: descenso SÓLO físico (escaleras/fosos). Obligatorio en Doom (loc 0x28) —
  // Des Por es INERTE ahí (game.ts magicChangeLevel falla en silencio); sin esto el pather
  // planea un Des Por que no casta y el arnés se atasca. Deceit al revés (necesita Des Por).
  // `maxIters`: presupuesto del pather (por defecto 60). Rutas largas (p.ej. el compartimento de
  // Hythloth cruza f0→f4→f1) necesitan más.
  // Paquete opt-in fields/sceptreKey/crossRooms: ver descent-planner.ts (default OFF —
  // los capítulos sellados planean byte-idéntico).
  const nav = (goal: (f: number, x: number, y: number) => boolean) =>
    dungeonDescendTo(page, goal, { noDespor: spec.noDespor, maxIters: spec.maxIters, fields: spec.fields, sceptreKey: spec.sceptreKey, crossRooms: spec.crossRooms });
  // ENTRADA POR ESCALERA (0x1e79): algunas salas están rodeadas de muro y se ENTRAN
  // klimbando una escalera que ATERRIZA en su celda (la planta adyacente tiene LadderDown/Up
  // sobre la sala). El approach es esa celda de escalera; klimbar dispara el combate de sala.
  // OJO P0a: una entrada por klimb/caída no tiene facing cardinal → el grupo de spawn lo
  // decide el port (hardcode "south" en main; derivación pendiente con P0a).
  if (spec.enterByLadder) {
    const lf = spec.enterByLadder === "down" ? roomCell.floor - 1 : roomCell.floor + 1;
    // Entrada por escalera: re-nav a la celda de escalera (una emboscada pudo desplazar a la
    // party) + klimb → aterriza en la sala → combate de SALA. En modo `territory` es TOLERANTE a
    // emboscada (enterRoomThroughAmbush RE-PISA si el errante ambusca el klimb); en `legacy` es
    // directa (nav+klimb, comprueba combate) — el stream pass-1.
    let navFailed = false;
    const doEntry = async () => {
      if (!(await nav((f, px, py) => f === lf && px === roomCell.x && py === roomCell.y))) { navFailed = true; return; }
      await dungeonKlimb(page, spec.enterByLadder!); // klimba → aterriza en la sala → combate de SALA
    };
    const entered = await enterRoom(page, doEntry);
    if (navFailed) return { outcome: "FAIL", enemiesAlive: 0, partyDeaths: 0, digest: "FAIL:no-ladder-approach" };
    if (!entered) {
      if (await roomClearedInTransit(page, roomCell)) return { outcome: "VICTORY", enemiesAlive: 0, partyDeaths: 0, digest: "VICTORY:en-transito" };
      return { outcome: "FAIL", enemiesAlive: 0, partyDeaths: 0, digest: "FAIL:no-combat-on-klimb" };
    }
    return conquerGoalRoom(page, doEntry, { maxRounds: spec.maxRounds, descend: spec.descend, descendDir: spec.descendDir, sceptre: spec.sceptre, sceptreClear: spec.sceptreClear });
  }
  const approachDir = spec.approachDir!;
  const d = DFACING_DELTA[approachDir];
  // Celda de aproximación con WRAP TOROIDAL (el grid de mazmorra es 8×8 toroidal): sin el
  // %DN, una sala en el borde (p.ej. y=7 aproximada desde el norte) daría y=8 = celda
  // inexistente → el pather no encuentra plan. Bug medido en el 1er montaje de ch20.
  const approach = { f: roomCell.floor, x: (roomCell.x - d.dx + DN) % DN, y: (roomCell.y - d.dy + DN) % DN };
  // 1-3) re-nav a la celda de aproximación (una emboscada pudo desplazar a la party) + encara la
  // sala + UN paso → dispara dng_enter_room (combate de SALA). NO aserta llegada (el combate
  // interrumpe el paso). En modo `territory` es TOLERANTE a emboscada (enterRoomThroughAmbush
  // RE-PISA si el errante ambusca el paso); en `legacy` es directa (paso, comprueba combate) — el
  // stream pass-1 bajo el que están sellados ch26 y la mayoría.
  let navFailed = false;
  const doEntry = async () => {
    if (!(await nav((f, px, py) => f === approach.f && px === approach.x && py === approach.y))) { navFailed = true; return; }
    await dungeonTurnTo(page, approachDir);
    await press(page, "ArrowUp");
  };
  const entered = await enterRoom(page, doEntry);
  if (navFailed) return { outcome: "FAIL", enemiesAlive: 0, partyDeaths: 0, digest: "FAIL:no-approach" };
  if (!entered) {
    // VICTORIA EN TRÁNSITO: el descenso aterrizó sobre la sala y la ganó (bit de sala-despejada
    // puesto) → el paso no dispara combate porque ya está limpia. No es FAIL: es victoria.
    if (await roomClearedInTransit(page, roomCell)) return { outcome: "VICTORY", enemiesAlive: 0, partyDeaths: 0, digest: "VICTORY:en-transito" };
    return { outcome: "FAIL", enemiesAlive: 0, partyDeaths: 0, digest: "FAIL:no-combat-on-step" };
  }
  // 4) conquista con placas + veredicto (+ retry LOST ×1 si la conquista GOAL perdió por bajas).
  return conquerGoalRoom(page, doEntry, { maxRounds: spec.maxRounds, descend: spec.descend, descendDir: spec.descendDir, sceptre: spec.sceptre, sceptreClear: spec.sceptreClear });
}

/** Snapshot para el resolvedor klimb-descend: turno, actor, escalera objetivo, ocupantes. */
async function ladderSnapshot(page: Page, ladderTile: number): Promise<
  | null
  | { turn: "other" }
  | { turn: "player"; ax: number; ay: number; onLadder: boolean; tiles: number[][]; ladder: { x: number; y: number } | null; occ: Array<{ x: number; y: number }> }
> {
  return page.evaluate((lt) => {
    const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
    if (!c) return null;
    const cur = c.currentUnit;
    if (!cur || cur.kind !== "player" || cur.charmed) return { turn: "other" as const };
    const tiles = c.mapTiles as number[][];
    let ladder: { x: number; y: number } | null = null;
    for (let y = 0; y < tiles.length; y++) {
      const row = tiles[y]!;
      for (let x = 0; x < row.length; x++) if (row[x] === lt) ladder = { x, y };
    }
    const alive = (u: any) => u.status !== "dead" && u.status !== "fled";
    return {
      turn: "player" as const,
      ax: cur.x,
      ay: cur.y,
      onLadder: !!ladder && cur.x === ladder.x && cur.y === ladder.y,
      tiles,
      ladder,
      occ: c.combatants.filter(alive).map((u: any) => ({ x: u.x, y: u.y })),
    };
  }, ladderTile);
}

/**
 * ★ LAS OTRAS DOS PUERTAS DEL ORIGINAL — último recurso cuando NO hay borde alcanzable.
 *
 * El conductor modelaba «salir de una sala» como «andar hasta un borde». El original tiene
 * TRES puertas y las tres desembocan en la misma rutina (`call 0x1bb2`):
 *   · BORDE  — la de siempre (elección por alcanzabilidad real, #50).
 *   · KLIMB  — `cmd_klimb_combat` SJOG 0x1dd5-0x1e19, con TRES tiles: 0xC8 (código 5, sube),
 *              0xC9 (código 6, baja) y **0x86 Grate (código 6), GATEADO por combate de SALA**
 *              (`test [g_unk_58a1],0x80` en 0x1dfb). El motor ya lo calca.
 *   · CETRO  — `sceptreDissolveFields` (CAST 0x1966/0x19a5): barrido 3×3 del actor que
 *              disuelve `(tile & 0xf0) === 0x70` a Grass, o sea abre el anillo de barrera.
 *
 * ★★ POR QUÉ ÚLTIMO RECURSO Y NO «la vía más corta»: las dos nuevas tienen EFECTOS
 * LATERALES que el borde no tiene — el klimb CAMBIA DE PLANTA (`escapeFloorDelta`, y los
 * capítulos de descenso encadenado navegan desde donde queda la party) y el Cetro CONSUME
 * TURNO (sin RNG, pero desplaza el orden de acciones en salas con enemigos vivos).
 * Gatearlas tras «ningún borde alcanzable» acota el radio a las salas que HOY fallan y
 * convierte la invariancia del resto en predicción falsable. Censo: de 112 mapas de
 * mazmorra sólo 16 tienen el anillo entero impasable — 8 con escalera 0xC8/0xC9, 5 con
 * Grate 0x86 (cm32, cm33, cm102, cm114, cm122), 1 con barrera para el Cetro (cm112) y
 * **2 sin ninguna de las tres puertas**: Doom r6 (cm118) y Doom r15 (cm127), los únicos
 * bolsillos fieles del juego. (El «7 sin nada» del censo original contaba los 5 del Grate
 * como emparedados: lo corrige `salidas-11-errata-grate.md` §4.a.)
 *
 * Hace UNA acción por llamada y devuelve si actuó: el llamador la mete en su propio bucle,
 * así se conservan su presupuesto de rondas y su telemetría.
 */
const KLIMB_TILES_ANY: number[] = [LADDER_UP, LADDER_DOWN, GRATE_TILE];

async function klimbExitSnapshot(page: Page): Promise<
  | null
  | { turn: "other" }
  | { turn: "player"; ax: number; ay: number; tiles: number[][]; occ: Array<{ x: number; y: number }>; roomCombat: boolean }
> {
  return page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
    if (!c) return null;
    const cur = c.currentUnit;
    if (!cur || cur.kind !== "player" || cur.charmed) return { turn: "other" as const };
    const alive = (u: any) => u.status !== "dead" && u.status !== "fled";
    return {
      turn: "player" as const,
      ax: cur.x,
      ay: cur.y,
      tiles: c.mapTiles as number[][],
      occ: c.combatants.filter(alive).map((u: any) => ({ x: u.x, y: u.y })),
      roomCombat: !!c.opts?.roomCombat,
    };
  });
}

/** Celda con tile klimbable más cercana (BFS), o null. */
function nearestKlimbCell(tiles: number[][], acceptable: number[], sx: number, sy: number): { x: number; y: number } | null {
  const G = tiles.length;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (!acceptable.includes(tiles[y]![x]!)) continue;
      const d = Math.abs(x - sx) + Math.abs(y - sy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

/** Celda pisable desde la que el barrido 3×3 del Cetro abriría una celda de ANILLO con barrera. */
function nearestSceptreSpot(tiles: number[][], sx: number, sy: number): { x: number; y: number } | null {
  const G = tiles.length;
  const isBoundaryRing = (x: number, y: number) =>
    (x === 0 || y === 0 || x === G - 1 || y === G - 1) && (tiles[y]![x]! & 0xf0) === 0x70;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (!traversable(tiles[y]![x]!)) continue;
      let opens = false;
      for (let dy = -1; dy <= 1 && !opens; dy++) {
        for (let dx = -1; dx <= 1 && !opens; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < G && ny < G && isBoundaryRing(nx, ny)) opens = true;
        }
      }
      if (!opens) continue;
      const d = Math.abs(x - sx) + Math.abs(y - sy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

type LastResortResult = "acted" | "waited" | "none";

async function lastResortExitStep(page: Page): Promise<LastResortResult> {
  const s = await klimbExitSnapshot(page);
  if (!s || s.turn !== "player") return "none";
  // El GRATE sólo saca en SALA (gate del binario). El conductor respeta el mismo gate en vez
  // de gastar turnos pulsando (K) donde el motor va a contestar «Klimb-what?».
  const acceptable = s.roomCombat ? KLIMB_TILES_ANY : [LADDER_UP, LADDER_DOWN];
  if (acceptable.includes(s.tiles[s.ay]![s.ax]!)) { await press(page, "k"); return "acted"; }
  const goal = nearestKlimbCell(s.tiles, acceptable, s.ax, s.ay);
  if (goal) {
    const dir = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: goal, occ: s.occ });
    if (dir) { await press(page, CARDINAL_ARROW[dir]!); return "acted"; }
    // ★ HAY escalera pero AHORA MISMO no hay paso: `stepTowardLadder` no rutea a una celda
    // OCUPADA, y el primero que llega a la escalera la tapa para los demás. Se PASA EL
    // TURNO para que se aparte (klimbando, justamente) — NO se abandona. Es la misma
    // lección que el fix de #50 en la salida por borde: medido aquí, el conductor se
    // rendía con la escalera a dos pasos porque un compañero estaba encima.
    await press(page, " ");
    return "waited";
  }
  // CETRO: abre el anillo y deja que la salida por BORDE de siempre haga el resto.
  const spot = nearestSceptreSpot(s.tiles, s.ax, s.ay);
  if (spot) {
    if (spot.x === s.ax && spot.y === s.ay) return (await pickerUseSceptre(page)) ? "acted" : "none";
    const dir = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: spot, occ: s.occ });
    if (dir) { await press(page, CARDINAL_ARROW[dir]!); return "acted"; }
    await press(page, " ");
    return "waited";
  }
  return "none";
}

/** Primer paso cardinal (BFS de arena) del actor hacia la escalera `ladder`, rodeando ocupantes. */
function stepTowardLadder(
  s: { ax: number; ay: number; tiles: number[][]; ladder: { x: number; y: number }; occ: Array<{ x: number; y: number }> },
): string | null {
  const G = s.tiles.length;
  const goal = s.ladder;
  const occ = new Set(s.occ.filter((o) => !(o.x === s.ax && o.y === s.ay)).map((o) => `${o.x}:${o.y}`));
  const key = (x: number, y: number) => `${x}:${y}`;
  const prev = new Map<string, { x: number; y: number; dir: string }>();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  const DIRS: Array<[number, number, string]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (cur.x === goal.x && cur.y === goal.y) {
        let c = key(cur.x, cur.y);
        let firstDir: string | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        const isGoal = nx === goal.x && ny === goal.y;
        if (!isGoal && !traversable(s.tiles[ny]![nx]!)) continue;
        if (occ.has(k)) continue;
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir });
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

/**
 * `resolveRoomDescend` — resolvedor de sala de mazmorra que DESCIENDE por la escalera
 * INTERIOR del tablero (COMBAT.OVL playerKlimbEscape, main.ts:1415) en vez de salir por el
 * borde. Es la vía de descenso de las salas cuya planta NO tiene escalera/foso propio (Doom
 * N3 → la única bajada es la escalera interior de la sala #99): cada turno de un PJ no
 * poseído, si está SOBRE la escalera-abajo (tile 201) pulsa `k` (Klimb-escape); si no, da un
 * paso de arena hacia ella. Los enemigos se bombean con `Space`.
 *
 * FIDELIDAD del gate de piso (game.ts:5610 `escaped = !victory && escapeFloorDelta`): el
 * cambio de planta SÓLO se aplica si el party HUYÓ sin victoria — así que este resolvedor
 * DESCIENDE HUYENDO (no limpia la sala). Con el party invisible (Ring of Invisibility) los
 * enemigos casi no le pegan y los miembros se turnan sobre la escalera hasta que el último
 * klimba y `endCombat` baja la planta. Determinista bajo seed-0. `dir` elige la escalera
 * (down=201 baja, up=200 sube). Devuelve true si el combate cerró (party fuera del tablero).
 */
export async function resolveRoomDescend(
  page: Page,
  opts: { dir?: "up" | "down"; maxRounds?: number } = {},
): Promise<boolean> {
  const ladderTile = opts.dir === "up" ? LADDER_UP : LADDER_DOWN;
  const maxRounds = opts.maxRounds ?? 400;
  let stuck = 0;
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return true;
    const s = await ladderSnapshot(page, ladderTile);
    if (!s) return true;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    if (s.onLadder) { await press(page, "k"); stuck = 0; continue; } // Klimb-escape (huida por escalera)
    if (!s.ladder) return false; // sala sin escalera interior del tipo pedido
    const dir = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: s.ladder, occ: s.occ });
    if (dir) {
      await press(page, CARDINAL_ARROW[dir]!);
      const s2 = await ladderSnapshot(page, ladderTile);
      stuck = s2 && s2.turn === "player" && s2.ax === s.ax && s2.ay === s.ay ? stuck + 1 : 0;
    } else {
      // Escalera momentáneamente inalcanzable (otro miembro encima / enemigo en medio): pasa
      // el turno para que se despeje (el paseo enemigo y el klimb de los compañeros la liberan).
      await press(page, " ");
      stuck++;
    }
    if (stuck > 80) return false; // escalera inalcanzable de forma persistente
  }
  return !(await inDungeonCombat(page));
}

/** Primera celda del tablero con un tile ShadowlordBoundary (0x70-0x7F, no-transitable). */
function findBoundary(tiles: number[][]): { x: number; y: number } | null {
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y]!;
    for (let x = 0; x < row.length; x++) if ((row[x]! & 0xf0) === 0x70) return { x, y };
  }
  return null;
}

/** ¿Hay una muralla ShadowlordBoundary (0x70-0x7f) en el 3×3 alrededor de (ax,ay)? (el barrido
 *  del Cetro es 3×3 sobre el combatiente activo, combat.ts sceptreDissolveFields). */
function boundaryAdjacent(ax: number, ay: number, tiles: number[][]): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const row = tiles[ay + dy];
      if (row && (row[ax + dx]! & 0xf0) === 0x70) return true;
    }
  }
  return false;
}

/** Abre el picker (U)se de combate y USA el Cetro (mueve la barra hasta "Sceptre" + Enter). */
async function pickerUseSceptre(page: Page): Promise<boolean> {
  await press(page, "u");
  for (let i = 0; i < 40; i++) {
    const pk = await page.evaluate(() => (window as unknown as { __u5test: { readyPicker: () => { phase: string; rows: { name: string }[]; cursor: number } | null } }).__u5test.readyPicker());
    if (!pk || pk.phase !== "pick") return false; // no abrió (sin Cetro en la tabla)
    if (pk.rows[pk.cursor]?.name.includes("Sceptre")) { await press(page, "Enter"); return true; }
    await press(page, "ArrowDown");
  }
  return false;
}

/**
 * Como `resolveRoomDescend` pero CABLEA el (U)se Cetro contra una barrera ShadowlordBoundary
 * (0x70-0x7F, tile NO-transitable) que SELLA el bolsillo de spawn del de la escalera interior.
 * Es el descenso FIEL de la #99 de Doom bajo el spawn P0a (opposite-of-facing): entrar hacia el
 * sur → spawn grupo NORTE (bolsillo y≤2), y la fila y5 de cm115 es muro macizo salvo la barrera
 * 0x71 en (5,5) — el ÚNICO paso al bolsillo sur con la escalera-abajo (5,7). El Cetro
 * (Combat.sceptreDissolveFields, barrido 3×3 del combatiente activo) la disuelve a Grass →
 * se abre el paso → klimb-escape «cada uno». DERIVADO del tablero cm115 + dato humano (el usuario
 * confirmó: spawn arriba, atravesar CON CETRO, salir por la escalera al nivel inferior).
 *
 * Bucle por turno de jugador: (1) si hay camino libre a la escalera → paso/klimb (resolveRoomDescend);
 * (2) si la escalera está SELLADA y hay barrera → si el combatiente activo está adyacente (chebyshev
 * ≤1) a la barrera USA el Cetro; si no, camina a una celda transitable adyacente a la barrera.
 * Determinista bajo seed-0 (Ring invis minimiza el daño enemigo mientras se maniobra).
 */
export async function resolveRoomSceptreDescend(
  page: Page,
  opts: { dir?: "up" | "down"; maxRounds?: number } = {},
): Promise<boolean> {
  const ladderTile = opts.dir === "up" ? LADDER_UP : LADDER_DOWN;
  const maxRounds = opts.maxRounds ?? 600;
  let stuck = 0;
  const bump = async (prevX: number, prevY: number): Promise<void> => {
    const s2 = await ladderSnapshot(page, ladderTile);
    stuck = s2 && s2.turn === "player" && s2.ax === prevX && s2.ay === prevY ? stuck + 1 : 0;
  };
  for (let round = 0; round < maxRounds; round++) {
    if (!(await inDungeonCombat(page))) return true;
    const s = await ladderSnapshot(page, ladderTile);
    if (!s) return true;
    if (s.turn === "other") { await pumpOtherTurn(page); continue; }
    if (s.onLadder) { await press(page, "k"); stuck = 0; continue; } // Klimb-escape
    if (!s.ladder) return false;
    // (1) ¿camino libre a la escalera? (BFS transitable — evita la barrera no-transitable)
    const toLadder = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: s.ladder, occ: s.occ });
    if (toLadder) { await press(page, CARDINAL_ARROW[toLadder]!); await bump(s.ax, s.ay); if (stuck > 80) return false; continue; }
    // (2) escalera SELLADA → ¿barrera ShadowlordBoundary disoluble con el Cetro?
    const barrier = findBoundary(s.tiles);
    if (!barrier) { await press(page, " "); if (++stuck > 80) return false; continue; }
    if (Math.max(Math.abs(s.ax - barrier.x), Math.abs(s.ay - barrier.y)) <= 1) {
      const used = await pickerUseSceptre(page); // barrido 3×3 disuelve la barrera → Grass
      if (!used) { await press(page, " "); if (++stuck > 80) return false; }
      else stuck = 0;
      continue;
    }
    // navega a una celda transitable adyacente (ortogonal) a la barrera, del lado alcanzable
    const near = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const)
      .map(([dx, dy]) => ({ x: barrier.x + dx, y: barrier.y + dy }))
      .filter((c) => c.y >= 0 && c.y < s.tiles.length && c.x >= 0 && c.x < s.tiles[0]!.length && traversable(s.tiles[c.y]![c.x]!))
      .find((c) => stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: c, occ: s.occ }) !== null);
    if (!near) { await press(page, " "); if (++stuck > 80) return false; continue; }
    const stepDir = stepTowardLadder({ ax: s.ax, ay: s.ay, tiles: s.tiles, ladder: near, occ: s.occ });
    if (stepDir) { await press(page, CARDINAL_ARROW[stepDir]!); await bump(s.ax, s.ay); if (stuck > 80) return false; }
    else { await press(page, " "); if (++stuck > 80) return false; }
  }
  return !(await inDungeonCombat(page));
}

/**
 * Encara la casilla adyacente (nx,ny) (con wrap toroidal) y da UN paso adelante, SIN
 * aseverar la llegada — a diferencia de `dungeonStepTo`, porque un FOSO hace caer a otra
 * planta (la party no queda en (nx,ny)) y una SALA dispara combate. Revela una puerta
 * secreta (0xD) delante con (S)earch antes de cruzarla.
 */
/** Encara (nx,ny) y da UN paso forward (sin resolver combate: el llamador decide — un paso de
 *  PASILLO puro resuelve la emboscada; un `step-room` es una sala INTENCIONAL de conquerRoom). */
async function dungeonFaceStep(page: Page, cur: DPos, nx: number, ny: number): Promise<void> {
  const target = facingToward(cur.x, cur.y, nx, ny);
  await dungeonTurnTo(page, target);
  await press(page, "ArrowUp"); // forward
}

/** Rejilla {type,sub} de las 8 plantas de la mazmorra activa (base + overrides vivos). */
async function readAllDungeonFloors(page: Page): Promise<DCell[][][]> {
  const out = await page.evaluate(() => {
    const ds = (window as unknown as { __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => { type: number; sub: number } } | null } } }).__u5test.game.dungeonState;
    if (!ds) return null; // FUERA DE MAZMORRA — lo nombra el llamante (outOfDungeon)
    const out: Array<Array<Array<{ type: number; sub: number }>>> = [];
    for (let f = 0; f < 8; f++) {
      const fl: Array<Array<{ type: number; sub: number }>> = [];
      for (let y = 0; y < 8; y++) {
        const row: Array<{ type: number; sub: number }> = [];
        for (let x = 0; x < 8; x++) { const c = ds.cellAt(f, x, y); row.push({ type: c.type, sub: c.sub }); }
        fl.push(row);
      }
      out.push(fl);
    }
    return out;
  });
  if (!out) throw outOfDungeon("la rejilla de las 8 plantas");
  return out;
}

// El PLANIFICADOR de descenso (Dijkstra sobre (planta,x,y) con las transiciones reales +
// el paquete opt-in fields/sceptreKey/crossRooms) vive en descent-planner.ts (puro,
// unit-testeado en tests/descent-planner.test.ts). Documentación del paquete allí.

/**
 * DESCIENDE por la mazmorra hasta la celda que cumpla `goalFn` (p.ej. una sala concreta o
 * el cofre), por el mecanismo REAL: planifica con `planDungeonDescent`, ejecuta la PRIMERA
 * transición (caminando los pasos previos con `walkDungeonTo`), RE-OBSERVA la posición
 * (los fosos ENCADENAN varias plantas de golpe) y RE-PLANIFICA. Resuelve cualquier combate
 * de sala que dispare (dungeonResolveRoomCombat). Requiere luz (In Lor) y un caster con
 * Des Por sembrado. Determinista bajo seed-0. Lanza si se queda sin plan o el resolvedor
 * se atasca.
 */
export async function dungeonDescendTo(
  page: Page,
  goalFn: (f: number, x: number, y: number) => boolean,
  opts: { maxIters?: number; noDespor?: boolean; conquer?: boolean; ambushMode?: AmbushMode } & DescentOpts = {},
): Promise<DPos | null> {
  // OPT-IN de emboscada sólo si el llamador DIRECTO lo pasa; sin él se preserva el modo vigente
  // (fijado por conquerRoomAt o el baseline legacy de bootWorld) — así la nav interna de
  // conquerRoomAt (que llama sin ambushMode) NO pisa la estrategia que aquél declaró.
  if (opts.ambushMode) setAmbushMode(opts.ambushMode);
  const maxIters = opts.maxIters ?? 60;
  const grid = await readAllDungeonFloors(page);
  for (let iter = 0; iter < maxIters; iter++) {
    if (await inDungeonCombat(page)) {
      // `conquer`: las salas que se cruzan AL NAVEGAR se conquistan CON PLACAS (y se HUYE
      // de un dead-end), no con resolveArenaCombat sin placas. Necesario en mazmorras de
      // salas ENCADENADAS/DISPERSAS donde la ruta a una sala pasa POR otra: sin esto un
      // combate de paso plate-sellado atasca el descenso (cascada medida en Doom).
      // `crossRooms` comparte este manejador: la sala de paso se conquista con placas o
      // se HUYE de ella (FLEE-CROSS fiel — DEADEND NO lanza: la party quedó SOBRE la
      // celda-sala tras huir por el borde, game.ts:5689, y el bucle re-planifica desde
      // ahí). Sólo FAIL (party derrotada) es rojo.
      if (opts.conquer || opts.crossRooms) {
        const v = await conquerRoom(page, { maxRounds: 600 });
        if (v.outcome === "FAIL") throw new Error(`dungeonDescendTo: sala de paso no conquistable (${v.digest})`);
        continue;
      }
      // FASE 2: migrado al resolvedor CANÓNICO side-aware (over-by-bando + posesión IA +
      // targeting ranged por la reja). Sustituye a dungeonResolveRoomCombat (legacy melé).
      const won = await resolveArenaCombat(page);
      if (!won) throw new Error("dungeonDescendTo: el resolvedor de combate se atascó");
      continue;
    }
    const p = await dungeonPos(page);
    if (!p) return null; // salió de la mazmorra
    if (goalFn(p.floor, p.x, p.y)) return p;
    const path = planDungeonDescent(grid, p.floor, p.x, p.y, goalFn, { noDespor: opts.noDespor, fields: opts.fields, sceptreKey: opts.sceptreKey, crossRooms: opts.crossRooms });
    if (!path || !path.length) throw new Error(`dungeonDescendTo: sin plan desde (${p.floor},${p.x},${p.y})`);
    // Camina los pasos de la MISMA planta UNO A UNO por MI plan (que ADMITE hoyos simples
    // 0x60 pasables — a diferencia de walkDungeonTo, que excluye toda trampa), revelando
    // puertas secretas (0xD) con (S)earch antes de cruzarlas.
    let i = 0;
    while (i < path.length && path[i]!.how === "step") {
      const n = path[i]!;
      const cur = await dungeonPos(page);
      if (!cur) return null;
      if (grid[n.f]![n.y]![n.x]!.type === 0xd) {
        await dungeonTurnTo(page, facingToward(cur.x, cur.y, n.x, n.y));
        await press(page, "s"); // revela la puerta secreta
        await answerDungeonSearchChain(page);
      }
      await dungeonFaceStep(page, cur, n.x, n.y);
      // Un paso de PASILLO PURO pudo disparar una EMBOSCADA del errante (arena procedural).
      // Se resuelve aquí (NO en el outer loop, que en modo conquer/crossRooms usaría conquerRoom
      // — para SALAS, no emboscadas). Tras ganar, el 58a0 pudo mover a la party → RE-PLANIFICA.
      if (await resolveCorridorAmbush(page)) break;
      // ¿El paso quedó BLOQUEADO por el errante PARADO en el destino? (dng_move "Blocked!": no
      // consume turno → el errante no se mueve → LIVELOCK). FIEL: ATÁCALO → combate de pasillo →
      // respawn → despeja. Re-planifica tras atacar (el mapa/posición cambió). Un muro (planner
      // correcto) no llega aquí; si llegara, el break re-planifica y el WAIT-CAP del outer aborta.
      // NOTA (medido 2026-07-25): es LOAD-BEARING también en ch26/legacy — un errante aparca en
      // sus rutas y sin el ataque el resolvedor de arena se atasca (r1-5 THROW). NO gatear por modo.
      const after = await dungeonPos(page);
      if (after && after.floor === cur.floor && after.x === cur.x && after.y === cur.y) {
        await clearBlockingWanderer(page, cur, n.x, n.y);
        break;
      }
      i++;
    }
    const op = path[i];
    if (!op) continue; // el objetivo estaba en esta planta (los pasos ya llegaron)
    if (op.how === "klimbdown") await dungeonKlimb(page, "down"); // dungeonKlimb ya resuelve emboscada
    else if (op.how === "klimbup") await dungeonKlimb(page, "up");
    else if (op.how === "despor") { await dungeonCastLevelChange(page, "dp"); await resolveCorridorAmbush(page); } // el Des Por (turno) pudo disparar emboscada
    else if (op.how === "sceptre") {
      // Campo de energía 0x83 (rebota, DUNGEON:0x0470): encara, (U)se Cetro →
      // dissolveFacingField ("Field dissolved!") y pisa la celda ya disuelta. Si el grid
      // VIVO dice que ya no hay campo (disolución de una iteración previa — el grid del
      // plan es del inicio), pisa directo. Si el Cetro NO disuelve (sin Cetro en el
      // picker / sigue el campo) se LANZA: es un fallo de arnés/loadout, no un veredicto.
      const cur = await dungeonPos(page);
      if (!cur) return null;
      await dungeonTurnTo(page, facingToward(cur.x, cur.y, op.x, op.y));
      const liveCell = async (): Promise<DCell> => {
        const c = await page.evaluate(({ f, x, y }) => {
          const ds = (window as unknown as { __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => { type: number; sub: number } } | null } } }).__u5test.game.dungeonState;
          if (!ds) return null; // FUERA DE MAZMORRA — lo nombra el llamante (outOfDungeon)
          const cell = ds.cellAt(f, x, y);
          return { type: cell.type, sub: cell.sub };
        }, { f: op.f, x: op.x, y: op.y });
        if (!c) throw outOfDungeon(`la celda viva (${op.f},${op.x},${op.y}) del descenso`);
        return c;
      };
      if ((await liveCell()).type === 8) {
        const used = await pickerUseSceptre(page); // (U)se fuera de combate: mismo picker
        if (!used) throw new Error("dungeonDescendTo: transición sceptre sin Cetro usable en el picker");
        if ((await liveCell()).type === 8) throw new Error(`dungeonDescendTo: el Cetro no disolvió el campo en (${op.f},${op.x},${op.y})`);
      }
      await press(page, "ArrowUp"); // pisa la celda disuelta
      await resolveCorridorAmbush(page); // el paso (turno) pudo disparar emboscada del errante
    } else if (op.how === "pitfall") {
      // El FOSO hace caer (encadena plantas) — NO es sala. El paso/caída (turno) pudo disparar
      // emboscada del errante → resuélvela inline (no es una sala para el manejador de arriba).
      const cur = await dungeonPos(page);
      if (cur) { await dungeonFaceStep(page, cur, op.x, op.y); }
      await resolveCorridorAmbush(page);
    } else if (op.how === "step-room" || op.how === "step-room-cross") {
      // Sala de PASO INTENCIONAL: el paso dispara el combate de SALA que el manejador de arriba
      // conquista (placas / FLEE-CROSS con `crossRooms`; una ya-conquistada 0xA sólo se cruza).
      // NO se resuelve como emboscada aquí (sería resolveArenaCombat sin placas).
      const cur = await dungeonPos(page);
      if (cur) { await dungeonFaceStep(page, cur, op.x, op.y); }
    }
  }
  throw new Error("dungeonDescendTo: presupuesto agotado sin alcanzar el objetivo");
}
