/**
 * Grand Tour — FIXTURE de encadenado por saves NATIVOS (spec §2 puntos 1/5 + §4).
 *
 * Cada capítulo del tour ARRANCA del `SAVED.GAM` + sidecar exportados por el anterior
 * (`importCheckpoint`), JUEGA su tramo determinista, y al cerrar EXPORTA su propio
 * checkpoint nativo (`exportCheckpoint`) a `saves/<chapter>.{gam,sidecar.json}`. Ese
 * fichero es a la vez la ENTRADA del siguiente capítulo Y la entrada del ESPEJO por
 * estado (`re/tools/mirror_runner.py`, §3). ch01 no importa (arranca de la creación);
 * es el PATRÓN para los 18 capítulos siguientes.
 *
 * El export usa el CAMINO REAL del jugador: el botón "Export .GAM" del SavePanel
 * (`downloadNativeSave` → `exportNativeSave`, #27), no un atajo de test. Descarga DOS
 * ficheros (SAVED.GAM binario de 4192 B + sidecar JSON); los capturamos y los
 * persistimos con nombre canónico del capítulo.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, type Download, type Page } from "@playwright/test";
import { SAVED_GAM_SIZE, anonymizeRosterNames } from "./offsets";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SAVES_DIR = join(HERE, "saves");

/**
 * MODO DE SELLADO del arnés (task tour-parallel). Derivado de `U5_TOUR_WORKERS` — la
 * MISMA palanca que fija los workers en playwright.grandtour.config.ts, para que sean
 * un solo signo:
 *
 *  · workers === 1 (default)  →  RE-SELLADO EN CASCADA: `exportCheckpoint` REESCRIBE
 *    `saves/<ch>` como siempre. El siguiente capítulo (corriendo después, serial) lee el
 *    sello FRESCO. Comportamiento byte-idéntico al histórico.
 *
 *  · workers > 1              →  VERIFY: los capítulos corren en PARALELO y cada uno lee
 *    el sello COMMITEADO (inmutable) de su predecesor. Reescribir `saves/<ch>` aquí
 *    crearía una CARRERA lectura-durante-escritura (writeFileSync no es atómico) con la
 *    importCheckpoint del sucesor en otro worker. Así que en VERIFY NO se reescribe:
 *    se ASERTA byte-identidad contra el sello commiteado (conserva la detección de
 *    regresión que hoy daba `git diff saves/`, sin la carrera) y se deja `saves/` prístino.
 *
 * Re-sellar tras un cambio legítimo del port ⇒ correr serial: U5_TOUR_WORKERS=1.
 *
 * MODO IDIOMA (task tour-ES). `U5_TOUR_LANG=es` FUERZA VERIFY sea cual sea el nº de workers:
 * el modo español NUNCA re-sella. Su razón de ser es PROBAR que la capa i18n es sólo
 * presentación → el .GAM jugado en español debe ser BYTE-IDÉNTICO al sello INGLÉS commiteado;
 * si el modo es reescribiera `saves/`, sobrescribiría los sellos-suelo (en inglés) con un
 * artefacto de una corrida es y destruiría justo la referencia que valida la tesis. Por eso
 * `exportCheckpoint` en es SIEMPRE asevera byte-identidad contra el sello (la INVARIANTE
 * ESTRELLA) y jamás toca disco. Re-sellar es exclusivamente cosa del modo inglés serial.
 */
const IS_ES = process.env.U5_TOUR_LANG?.toLowerCase() === "es";
const RESEAL = Number(process.env.U5_TOUR_WORKERS ?? "1") <= 1 && !IS_ES;

/**
 * Consejo de diagnóstico para un byte-diff en VERIFY, según el modo:
 *  · es   → el diff PRUEBA que la capa i18n FILTRÓ a estado de juego (debía ser sólo
 *           presentación): es un BUG de la tesis, no un re-sello. No se re-sella en es.
 *  · en   → el port produce un save distinto: re-sella serial (U5_TOUR_WORKERS=1).
 */
const verifyHint = (): string =>
  IS_ES
    ? "Modo es (U5_TOUR_LANG=es): un diff aquí significa que la capa de idioma FILTRÓ a estado " +
      "de juego (debe ser SÓLO presentación) — es un bug de la tesis i18n, NO un re-sello. El " +
      "modo es nunca re-sella (compara contra el sello INGLÉS)."
    : "El re-sellado sólo es seguro serial: corre con U5_TOUR_WORKERS=1 para regenerar los sellos.";

/**
 * Compara dos buffers y devuelve una descripción del PRIMER byte distinto (offset +
 * valores hex) para adjudicar drifts del sello rápido — o `null` si son byte-idénticos.
 * Reporta también un desajuste de longitud (no debería pasar: el .GAM es de tamaño fijo).
 */
function firstByteDiff(committed: Uint8Array, exported: Uint8Array): string | null {
  const n = Math.min(committed.length, exported.length);
  const hex = (v: number): string => `0x${v.toString(16).padStart(2, "0")}`;
  for (let i = 0; i < n; i++) {
    const cb = committed[i]!;
    const eb = exported[i]!;
    if (cb !== eb) {
      return `primer byte distinto en offset ${i} (0x${i.toString(16)}): sello=${hex(cb)} exportado=${hex(eb)}`;
    }
  }
  if (committed.length !== exported.length) {
    return `longitudes distintas: sello=${committed.length} exportado=${exported.length}`;
  }
  return null;
}

export interface Checkpoint {
  gam: Uint8Array;
  sidecar: unknown;
  gamPath: string;
  sidecarPath: string;
}

/** Abre el SavePanel (F5) y devuelve su locator (el único `.save-panel` visible). */
async function openSavePanel(page: Page) {
  await page.keyboard.press("F5");
  const panel = page.locator(".save-panel:visible");
  await expect(panel).toBeVisible();
  // Chrome «ventana 1988» (veredicto #23, batch 15): el marco original oculta el
  // `.save-title` nativo y repinta «Journeys» en su banda ►título◄. Se aserta la
  // presencia del título en DOM (attached) + el marco montado, no su visibilidad.
  await expect(panel.locator(".save-title", { hasText: "Journeys" })).toBeAttached();
  await expect(panel.locator("[data-testid=u5-original-frame]")).toBeAttached();
  return panel;
}

/**
 * Exporta el checkpoint nativo del capítulo actual (estado vivo del port) a
 * `saves/<chapter>.gam` + `saves/<chapter>.sidecar.json` vía el botón real
 * "Export .GAM". Devuelve los bytes/JSON leídos de vuelta para asertar en la spec.
 */
export async function exportCheckpoint(page: Page, chapter: string): Promise<Checkpoint> {
  mkdirSync(SAVES_DIR, { recursive: true });
  const panel = await openSavePanel(page);

  // El export nativo dispara TRES descargas desde un solo click (gam + sidecar +
  // SAVED.OOL — el .ool nativo lo añadió el carril cobertura-medias, ítem
  // saved-ool-no-generado: buildNativeOol + descarga junto al .GAM).
  const downloads: Download[] = [];
  const collect = (d: Download): void => {
    downloads.push(d);
  };
  page.on("download", collect);
  try {
    await panel.locator(".save-btn-export-gam").click();
    await expect
      .poll(() => downloads.length, {
        message: "Export .GAM debe descargar SAVED.GAM + sidecar + SAVED.OOL (3 ficheros)",
        // Techo GENEROSO (task #8): la descarga puede tardar bajo carga; la sync la da
        // la CONDICIÓN (downloads==3), el techo sólo evita colgar la suite.
        timeout: 15_000,
      })
      .toBe(3);
  } finally {
    page.off("download", collect);
  }

  // Desambigua por nombre sugerido: "SAVED.GAM" vs "SAVED-<stamp>.sidecar.json".
  const gamDl = downloads.find((d) => d.suggestedFilename() === "SAVED.GAM");
  const sidecarDl = downloads.find((d) => d.suggestedFilename().endsWith(".sidecar.json"));
  if (!gamDl || !sidecarDl) {
    throw new Error(
      `Export .GAM: descargas inesperadas ${JSON.stringify(downloads.map((d) => d.suggestedFilename()))}`,
    );
  }

  const gamTmp = await gamDl.path();
  const sidecarTmp = await sidecarDl.path();
  const gam = new Uint8Array(readFileSync(gamTmp));
  const sidecarText = readFileSync(sidecarTmp, "utf8");
  if (gam.length !== SAVED_GAM_SIZE) {
    throw new Error(`SAVED.GAM exportado con tamaño ${gam.length} ≠ ${SAVED_GAM_SIZE}`);
  }

  // #228: los sellos commiteados NO llevan el roster de EA en claro. Se sobrescriben los
  // nombres de los slots 1..15 (INIT.GAM) con el roster sintético ANTES de comparar
  // (VERIFY) o escribir (RESEAL) — transform puro e idempotente, ver offsets.ts. Para
  // ch02+ es un no-op de facto (su estado ya vino de un sello anonimizado); para ch01
  // (boot desde la creación, roster de assets) es donde el nombre real muere en el borde.
  anonymizeRosterNames(gam);

  const gamPath = join(SAVES_DIR, `${chapter}.gam`);
  const sidecarPath = join(SAVES_DIR, `${chapter}.sidecar.json`);
  // Reserializa con indentación estable → diff legible del artefacto commiteado.
  const sidecarNorm = JSON.stringify(JSON.parse(sidecarText), null, 2) + "\n";
  if (RESEAL) {
    // Cascada serial: reescribe el sello (comportamiento histórico).
    writeFileSync(gamPath, gam);
    writeFileSync(sidecarPath, sidecarNorm);
  } else {
    // Paralelo (VERIFY): NO reescribe (evita la carrera con la importCheckpoint del
    // sucesor). Aserta que lo exportado es byte-idéntico al sello commiteado. Un fallo
    // aquí = el port produce un save distinto → re-sella serial (U5_TOUR_WORKERS=1).
    const committedGam = new Uint8Array(readFileSync(gamPath));
    const diff = firstByteDiff(committedGam, gam);
    if (diff !== null) {
      throw new Error(
        `exportCheckpoint("${chapter}"): el .GAM exportado difiere del sello commiteado ` +
          `saves/${chapter}.gam (VERIFY). ${diff}. ${verifyHint()}`,
      );
    }
    const committedSidecar = readFileSync(sidecarPath, "utf8");
    if (committedSidecar !== sidecarNorm) {
      // Diagnóstico: primera línea divergente + copia del export para post-mortem
      // (los fallos de sidecar bajo carga paralela son invisibles sin esto).
      const a = committedSidecar.split("\n");
      const b = sidecarNorm.split("\n");
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      const divergentPath = join(SAVES_DIR, `${chapter}.sidecar.DIVERGENT.json`);
      writeFileSync(divergentPath, sidecarNorm);
      throw new Error(
        `exportCheckpoint("${chapter}"): el sidecar exportado difiere del sello commiteado ` +
          `saves/${chapter}.sidecar.json (VERIFY). Primera divergencia en línea ${i + 1}: ` +
          `sello=${JSON.stringify(a[i] ?? "<EOF>")} vs export=${JSON.stringify(b[i] ?? "<EOF>")}. ` +
          `Export guardado en ${divergentPath}. ${verifyHint()}`,
      );
    }
  }

  // Cierra el panel (blur + Escape; el root del panel hace stopPropagation, quirk
  // pre-existente de SavePanel documentado en saves.spec.ts).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");

  return { gam, sidecar: JSON.parse(sidecarText), gamPath, sidecarPath };
}

/**
 * Carga el checkpoint nativo `saves/<chapter>.gam` en el estado vivo del port (hook
 * DEV `__u5test.loadNativeSave`). ENTRADA de los capítulos ch02+.
 *
 * El hook de main.ts acepta el sidecar como 2º argumento (F3-T3): `importCheckpoint`
 * lo PASA para que el estado de juego sin hueco en el .GAM (transporte, questFlags,
 * naval, Shadowlords, hechizos temporales) se hidrate al encadenar. Para ch01→ch02 es
 * inocuo (creación = a pie, sin estado runtime), pero los capítulos con estado naval /
 * Shadowlord ya lo reciben sin cambiar la infraestructura. `sidecar` también se
 * devuelve para que la spec del capítulo pueda asertarlo por separado.
 */
export function readCheckpointFiles(chapter: string): { gam: Uint8Array; sidecar: unknown } {
  const gam = new Uint8Array(readFileSync(join(SAVES_DIR, `${chapter}.gam`)));
  const sidecar = JSON.parse(readFileSync(join(SAVES_DIR, `${chapter}.sidecar.json`), "utf8"));
  return { gam, sidecar };
}

/** Hora de ENTRADA canónica por defecto (diurna): mercaderes en el mostrador, NPC en sus
 *  posiciones de día — restaura las asunciones de los sellos existentes. */
export const DEFAULT_ENTRY_CLOCK = { hour: 10, minute: 0 } as const;

/**
 * Oro de ENTRADA canónico de los capítulos PINEADOS (task #52). **200 gp NO es una cifra
 * derivada del binario: es un MARGEN declarado.** Cubre 10 demandas de tributo al party
 * actual (2 vivos ⇒ 20 gp por demanda) o 3 al techo estructural de 6 vivos. El número de
 * demandas REAL por capítulo se MIDE (no se deriva del censo: el censo midió una
 * trayectoria ATASCADA por el prompt de arresto, así que sus conteos son turnos de atasco,
 * no de paso).
 */
export const DEFAULT_ENTRY_GOLD = 200;

export interface ImportOpts {
  /** Hora de ENTRADA canónica DECLARADA por el capítulo (default 10:00). Un capítulo que
   *  NECESITE otra franja (p.ej. una ventana de tienda o de NPC concreta) declara la suya. */
  entryClock?: { hour: number; minute: number };
  /** Oro de ENTRADA canónico DECLARADO por el capítulo (task #52). A diferencia de
   *  `entryClock`, NO tiene default implícito: sólo se aplica si el capítulo lo declara.
   *
   *  DÓNDE EMPIEZA EL PIN, y por qué NO en ch05. Los pineados son **ch06..ch17**:
   *  · ch01..ch04 llevan oro que la partida GANÓ JUGANDO (150/150/50/50): pinearlo lo
   *    destruiría sin ninguna necesidad (no hay guardia en su ruta).
   *  · **ch05 (Minoc) se dejó SIN pinear a propósito**, contra el plan inicial de #52, y por
   *    dos razones MEDIDAS. (a) Su economía es una propiedad VIVA y deliberada: entra con
   *    50, el Short Sword cuesta 53, y el déficit de 3 se cubre GANANDO el oro dentro del
   *    capítulo (venta real de un Flaming Oil) — la «VÍA A» sancionada por el lead. Con 200
   *    gp ese déficit desaparece y la propiedad muere; su tripwire `expect(goldStart)
   *    .toBe(50)` lo detectó al primer intento, que es exactamente para lo que estaba.
   *    (b) ch05 NO lo necesita: Minoc es **CARIDAD**, no tributo (`guardDemand`,
   *    `0x01f3 cmp [g_location],5`) — aceptar es `gold/2` y devuelve SIEMPRE `ret 0`, sin
   *    gate de oro, así que Minoc NO PUEDE arrestar por pobre que vaya el party. ch05 está
   *    a salvo POR MECANISMO, no por suerte, y es el único capítulo de la cadena del que
   *    eso se puede afirmar. */
  entryGold?: number;
}

export async function importCheckpoint(page: Page, chapter: string, opts: ImportOpts = {}): Promise<unknown> {
  const { gam, sidecar } = readCheckpointFiles(chapter);
  await page.evaluate(
    ([bytes, side]) => {
      const t = (
        window as unknown as {
          __u5test: { loadNativeSave: (b: number[], sidecar?: unknown) => void };
        }
      ).__u5test;
      t.loadNativeSave(bytes as number[], side);
    },
    [Array.from(gam), sidecar] as [number[], unknown],
  );
  // RELOJ CANÓNICO DE ARNÉS (task #8): tras hidratar el checkpoint, fija la hora de ENTRADA a un
  // valor DECLARADO por el capítulo (default 10:00 diurno). Esto DESACOPLA la hora de entrada de
  // la de SALIDA del predecesor — la deriva acumulada dejaba de valer los sellos aguas abajo
  // (mercaderes que se subían a sus dormitorios de noche, NPC en particiones nocturnas). Es una
  // normalización de ARNÉS (misma clase sancionada que teleportOverworld: escritura directa de
  // estado test-only, cero efecto fuera del tour); el CORE del juego NO se toca. Regla nueva: la
  // hora de SALIDA de un capítulo ya no hipoteca al siguiente — solo importan sus ventanas INTERNAS.
  // Se aplica a `hour`+`minute` (los NPC-schedule leen la HORA; el minuto se canoniza a 0). El
  // `.gam` exportado sigue siendo nativo; la hora canónica usada se documenta en el sello.
  const clock = opts.entryClock ?? DEFAULT_ENTRY_CLOCK;
  await page.evaluate(
    (c) => {
      const g = (window as unknown as { __u5test: { game: { state: { time: { hour: number; minute: number } } } } }).__u5test.game;
      g.state.time.hour = c.hour;
      g.state.time.minute = c.minute;
    },
    clock,
  );
  // ORO CANÓNICO DE ARNÉS (task #52): HERMANO EXACTO de `entryClock` sobre el otro eje. El
  // reloj se pineó porque la deriva HORARIA del predecesor invalidaba los sellos aguas
  // abajo; la deriva ECONÓMICA hace lo mismo y ya rompió DOS capítulos: la cadena baja a
  // 1 gp en ch05 y ahí se queda hasta ch17, mientras el tributo del guardia son 10 gp por
  // miembro VIVO (TALK 0x0230-0x0269) — 20 gp con el party actual. ch06 y ch08 entran
  // pegados a un guardia, no pueden pagar, y el arresto los encarcela en Yew.
  //
  // Misma clase sancionada que `teleportOverworld` y `entryClock`: escritura directa de
  // estado test-only, cero efecto fuera del tour; el CORE del juego NO se toca.
  //
  // ⚠ NO ES GRATIS EN FIDELIDAD, y se dice: 200 gp es un estado que la partida NO ganó
  // jugando. Es la misma licencia que el reloj canónico y se declara igual (aquí, en el
  // docblock de DEFAULT_ENTRY_GOLD y en el sello de cada capítulo pineado).
  //
  // COSTE RELOCALIZADO (no escondido): pinear el oro RENUNCIA a «la economía sobrevive la
  // cadena» como propiedad emergente. Pero esa propiedad ya estaba MUERTA DE FACTO — 1 gp
  // desde ch05 hasta ch17 no es una economía sobreviviendo, es una economía muerta que
  // nadie miraba. Lo que sigue vivo y medido es la economía INTRA-capítulo (las notas de
  // cobertura emiten `oro a→b` y el detector estático las compara contra el `.gam`), y la
  // acumulación cross-capítulo tiene su instrumento natural en el ledger del espejo.
  if (opts.entryGold !== undefined) {
    await page.evaluate(
      (gold) => {
        const g = (window as unknown as { __u5test: { game: { state: { gold: number } } } }).__u5test.game;
        g.state.gold = gold;
      },
      opts.entryGold,
    );
  }
  return sidecar;
}
