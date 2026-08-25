/**
 * WALKTHROUGH-ESPEJO — checkpoints PROPIOS de la cadena del espejo.
 *
 * La party del LP evoluciona DISTINTO de la del grandtour (joins/loot/oro propios), así
 * que el espejo encadena por SUS saves (`e2e/espejo-tour/saves/partNN.{gam,sidecar.json}`),
 * generados por el PROPIO replay — NUNCA por los checkpoints del grandtour.
 *
 * Export por el CAMINO REAL del jugador (botón "Export .GAM" del SavePanel, 3 descargas:
 * .GAM + sidecar + SAVED.OOL) — mismo mecanismo que el grandtour (fixture.ts), pero:
 *   · SIEMPRE reescribe (los saves del espejo son ARTEFACTO REGENERABLE del replay, no
 *     sellos byte-firmados; la regresión la detecta el DIFF de conformidad, no el hash).
 *   · `U5_ESPEJO_FROM=partNN` permite re-arrancar la cadena desde el checkpoint de una
 *     parte concreta (bisección de derivas sin rejugar todo).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Download, type Page } from "@playwright/test";
import { SAVED_GAM_SIZE } from "../grandtour/offsets";
import { resuelveSavesDir } from "./saves-dir";
import { dungeonResolveRoomCombat } from "../grandtour/nav";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * DIRECTORIO DE SEMILLAS — redirigible con `U5_ESPEJO_SAVES_DIR` (carril `espejo-cadena-limpia`).
 * El porqué, y por qué redirige lectura Y escritura a la vez, en la cabecera de `saves-dir.ts`.
 *
 * Se siembra a mano copiando SÓLO el checkpoint de entrada del primer eslabón (p. ej.
 * `part06.{gam,sidecar.json}` para arrancar en part07): así el directorio no puede contener
 * ninguna semilla rancia con la que confundirse.
 */
export const SAVES_DIR = resuelveSavesDir(process.env.U5_ESPEJO_SAVES_DIR, join(HERE, "saves"));

export function hasCheckpoint(part: string): boolean {
  return existsSync(join(SAVES_DIR, `${part}.gam`)) && existsSync(join(SAVES_DIR, `${part}.sidecar.json`));
}

/** Sumideros de entrada VIVOS (hook read-only `__u5test.inputSinks`, sólo DEV). `{}` si el
 *  build no lo trae (no se adivina: se reporta vacío y el diag lo dice). */
export async function inputSinks(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const t = (window as unknown as { __u5test?: { inputSinks?: () => Record<string, unknown> } })
      .__u5test;
    return t?.inputSinks?.() ?? {};
  });
}

/** Pacers a RELOJ DE PARED que se tragan TODO el teclado (main.ts handleGameKey, ramas
 *  camping/refuging/trollSneak/moongate/endgame): NINGUNA ráfaga de teclas los despeja —
 *  hay que ESPERARLOS. Ver waitOutPacers. */
const WALL_CLOCK_PACERS = ["camping", "refuging", "trollSneak", "moongate", "endgame"] as const;

/** Los pacers vivos ahora mismo (nombres de WALL_CLOCK_PACERS). */
export function livePacers(sinks: Record<string, unknown>): string[] {
  return WALL_CLOCK_PACERS.filter((k) => sinks[k] === true);
}

/**
 * ESPERA A QUE LOS PACERS TERMINEN antes de pulsar una tecla de shell.
 *
 * ROTURA MEDIDA (relevo-3b, cadena AD): ad21 acabó DENTRO de la escena PACEADA de
 * party-wipe+resurrección (`refuging`; testigo: `ad21.export-fail.png` — «Strange words are
 * intoned. / Vertigo...» con Jaana/Gwenno a 0D). `handleGameKey` hace `preventDefault()+return`
 * mientras `refuging` es true, así que el F5 NO llega NUNCA: el bucle de ráfagas+reintentos
 * (≈15 s de presupuesto) expiró y la cadena se rompió (ad22-25 corrieron sobre el checkpoint
 * del estreno). El diag de entonces culpó a `drawerAny:true`, que era un FALSO CULPABLE: el
 * elemento `.u5dbg-drawer` existe SIEMPRE en dev. Con `inputSinks` el bloqueador se MIDE.
 */
export async function waitOutPacers(page: Page, part: string, budgetMs = 90_000): Promise<string[]> {
  const seen = new Set<string>();
  const t0 = Date.now();
  for (;;) {
    const live = livePacers(await inputSinks(page));
    if (live.length === 0) break;
    for (const p of live) seen.add(p);
    if (Date.now() - t0 > budgetMs) {
      console.log(`[${part}] export: pacer(s) ${live.join("+")} SIGUEN vivos tras ${budgetMs} ms`);
      break;
    }
    await page.waitForTimeout(500);
  }
  if (seen.size > 0) {
    console.log(
      `[${part}] export: esperados los pacers ${[...seen].join("+")} (${Date.now() - t0} ms) antes del F5`,
    );
  }
  return [...seen];
}

/** PURGA DE DRAWERS del shell (SISTEMA ⚙ + Debug QA) + saca el FOCO de su root.
 *  `DebugPanel` hace `stopPropagation` de TODO keydown originado dentro de su root
 *  (debug/panel.ts) — así que el foco dentro de un drawer, INCLUSO CERRADO, se come el F5.
 *  Cerrar no basta: hay que devolver el foco al documento. */
async function purgeDrawers(page: Page): Promise<void> {
  // DOS localizadores porque hay DOS formas de la misma salida: el `esc` de la esquina
  // (drawer QA de debug) y la fila «Close menu» del menú SISTEMA, que lo sustituyó en #263.
  // Un solo selector por clase dejaría el drawer del shell abierto y sin decir por qué.
  const closers = page.locator(
    '.u5dbg-drawer.open .u5dbg-close, .u5dbg-drawer.open [data-testid="u5-shell-drawer-close"]',
  );
  const n = await closers.count();
  for (let i = 0; i < n; i++) await closers.nth(i).click().catch(() => undefined);
  if (n > 0) await page.waitForTimeout(150);
  await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body) a.blur();
    // Foco explícito al canvas del juego (si lo hay): así el keydown nace FUERA de
    // cualquier `.u5dbg-drawer` y llega a window.
    const c = document.querySelector("canvas");
    if (c instanceof HTMLElement) c.focus?.();
  });
}

export async function exportCheckpoint(page: Page, part: string): Promise<void> {
  mkdirSync(SAVES_DIR, { recursive: true });
  // PACERS A RELOJ DE PARED (refuge/camp/troll/moongate/endgame): esperarlos ANTES de
  // cualquier ráfaga — con uno vivo el F5 no llega ni al 100º intento (ver waitOutPacers).
  await waitOutPacers(page, part);
  // El replay puede dejar un modal/prompt/menú abierto (getstring, combate, DEBUG QA) que
  // se come el F5 → el save-panel no abre (fallo real de part04). Despeja al mapa primero:
  // Escape ×3 + blur, luego F5 (robustez de la cadena, no altera estado del juego).
  // GATE DEL F5 (main.ts keydown): `game.combat` y `game.dungeonState` capturan el teclado
  // ANTES de la rama F5 → con combate/mazmorra vivos el save-panel JAMÁS abre (rotura medida
  // de la cadena AD en ad04: finales de parte con combate atascado). Instrumento de cadena:
  // resuelve el combate con el resolvedor REAL; si sigue vivo, ciérralo por la costura
  // `game.endCombat()` (el diff del segmento ya está capturado; la parte siguiente resynca).
  const inCombat = await page.evaluate(
    () => Boolean((window as unknown as { __u5test?: { game?: { combat?: unknown } } }).__u5test?.game?.combat),
  );
  if (inCombat) {
    await dungeonResolveRoomCombat(page, { maxRounds: 300 });
    const still = await page.evaluate(
      () => Boolean((window as unknown as { __u5test?: { game?: { combat?: unknown } } }).__u5test?.game?.combat),
    );
    if (still) {
      await page.evaluate(() => {
        const g = (window as unknown as { __u5test: { game: { endCombat?: () => unknown } } }).__u5test.game;
        g.endCombat?.();
      });
      await page.waitForTimeout(200);
    }
  }
  // Mazmorra viva: mismo gate (handleDungeonKey se traga el F5). Costura sancionada mínima:
  // anula dungeonState (la entrada de la parte siguiente resynca posición por su costura).
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { dungeonState?: unknown } } }).__u5test.game;
    if (g.dungeonState) g.dungeonState = null;
  });
  // DESPEJE DE PROMPTS (main.ts keydown: `prompts.handleKey` consume TODO antes del F5 — un
  // getstring/yesno/picker vivo dejado por el replay bajo deriva se traga el F5 en silencio;
  // 3ª causa medida de ad04). Ráfaga de teclas de cancelación (Enter cierra getstring vacío,
  // 'n' responde yesno, Escape cancela pickers/paneles) + drawer DEBUG QA + reintento de F5.
  // Bloqueador medido nº4 (ad04, screenshot): la parte acaba DENTRO DE UN SHRINE en plena
  // secuencia PACEADA («Strange words are intoned. Vertigo...») — el pacer pide una tecla por
  // página y las que queden se tragan el F5. Space ×N pagina hasta agotarlo (en mapa limpio
  // Space = "Pass", un turno inocuo para un checkpoint que la parte siguiente resynca).
  const panel = page.locator(".save-panel:visible");
  let opened = false;
  for (let attempt = 0; attempt < 4 && !opened; attempt++) {
    const burst =
      attempt === 0
        ? ["Escape", "Escape", "Escape"]
        : ["Space", "Space", "Space", "Space", "Space", "Space", "Enter", "Escape", "n", "Escape"];
    for (const k of burst) {
      await page.keyboard.press(k);
      await page.waitForTimeout(110);
    }
    // Drawers del shell (SISTEMA + Debug QA): cerrar Y sacar el foco de su root — el
    // stopPropagation de DebugPanel se come el F5 aunque el drawer esté cerrado.
    await purgeDrawers(page);
    // Una tecla de la ráfaga pudo arrancar un pacer (Space en mapa = Pass → emboscada →
    // combate/refuge): re-espera antes de gastar el intento.
    await waitOutPacers(page, part, 30_000);
    await page.keyboard.press("F5");
    opened = await panel
      .waitFor({ state: "visible", timeout: 2500 })
      .then(() => true)
      .catch(() => false);
  }
  try {
    await expect(panel, `${part}: save-panel no abrió tras F5 (¿modal/prompt sin despejar?)`).toBeVisible();
  } catch (e) {
    // DIAGNÓSTICO: qué está bloqueando el F5 (evidencia en el propio error, no adivinar).
    // `sinks` = la escalera COMPLETA de early-returns de handleGameKey medida por hook
    // (`inputSinks`): sin ella el diag culpaba a `drawerAny` (que en dev es SIEMPRE true).
    const sinks = await inputSinks(page);
    const diag = await page.evaluate(() => {
      const w = window as unknown as {
        __u5test?: { game?: { combat?: unknown; dungeonState?: unknown; state?: { position?: unknown } }; shopOpen?: () => boolean };
      };
      const g = w.__u5test?.game;
      return JSON.stringify({
        combat: Boolean(g?.combat),
        dungeon: Boolean(g?.dungeonState),
        shopOpen: Boolean(w.__u5test?.shopOpen?.()),
        drawerOpen: Boolean(document.querySelector(".u5dbg-drawer.open")),
        drawerAny: Boolean(document.querySelector(".u5dbg-drawer")),
        active: (document.activeElement as HTMLElement | null)?.className ?? null,
        pos: g?.state?.position ?? null,
      });
    });
    const shot = join(process.env.ESPEJO_OUT ?? SAVES_DIR, `${part}.export-fail.png`);
    await page.screenshot({ path: shot }).catch(() => undefined);
    throw new Error(
      `${part}: save-panel no abrió tras F5 — diag=${diag} sinks=${JSON.stringify(sinks)} (screenshot: ${shot})`,
      { cause: e },
    );
  }
  const downloads: Download[] = [];
  const collect = (d: Download): void => {
    downloads.push(d);
  };
  page.on("download", collect);
  try {
    await panel.locator(".save-btn-export-gam").click();
    await expect
      .poll(() => downloads.length, { message: "Export .GAM: 3 descargas", timeout: 15_000 })
      .toBe(3);
  } finally {
    page.off("download", collect);
  }
  const gamDl = downloads.find((d) => d.suggestedFilename() === "SAVED.GAM");
  const sidecarDl = downloads.find((d) => d.suggestedFilename().endsWith(".sidecar.json"));
  if (!gamDl || !sidecarDl) throw new Error(`Export .GAM: descargas inesperadas`);
  const gam = new Uint8Array(readFileSync(await gamDl.path()));
  if (gam.length !== SAVED_GAM_SIZE) throw new Error(`SAVED.GAM tamaño ${gam.length} ≠ ${SAVED_GAM_SIZE}`);
  const sidecar = JSON.stringify(JSON.parse(readFileSync(await sidecarDl.path(), "utf8")), null, 2) + "\n";
  writeFileSync(join(SAVES_DIR, `${part}.gam`), gam);
  writeFileSync(join(SAVES_DIR, `${part}.sidecar.json`), sidecar);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
}

export async function importCheckpoint(
  page: Page,
  part: string,
  entryClock: { hour: number; minute: number } = { hour: 10, minute: 0 },
): Promise<void> {
  const gam = new Uint8Array(readFileSync(join(SAVES_DIR, `${part}.gam`)));
  const sidecar: unknown = JSON.parse(readFileSync(join(SAVES_DIR, `${part}.sidecar.json`), "utf8"));
  await page.evaluate(
    ([bytes, side]) => {
      (
        window as unknown as { __u5test: { loadNativeSave: (b: number[], sidecar?: unknown) => void } }
      ).__u5test.loadNativeSave(bytes as number[], side);
    },
    [Array.from(gam), sidecar] as [number[], unknown],
  );
  // Reloj canónico de arnés (misma clase sancionada que el grandtour, task #8).
  await page.evaluate((c) => {
    const g = (
      window as unknown as { __u5test: { game: { state: { time: { hour: number; minute: number } } } } }
    ).__u5test.game;
    g.state.time.hour = c.hour;
    g.state.time.minute = c.minute;
  }, entryClock);
}

/** Normaliza el nombre del líder al del LP ("Min") — arnés de alineación de logs
 *  (part01 fresh-boot). Cero efecto de mecánica: el nombre es presentación del log. */
export async function normalizeAvatarName(page: Page, name: string): Promise<void> {
  await page.evaluate((n) => {
    const g = (
      window as unknown as { __u5test: { game: { state: { characters: Array<{ name: string }> } } } }
    ).__u5test.game;
    if (g.state.characters[0]) g.state.characters[0].name = n;
  }, name);
}
