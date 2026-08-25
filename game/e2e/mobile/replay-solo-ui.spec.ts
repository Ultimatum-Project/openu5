/**
 * REPRODUCIR UNA REPETICIÓN EN UN MÓVIL ENSEÑA LA UI DE 1988 Y NADA MÁS.
 *
 * EL DEFECTO QUE ESTE FICHERO EXISTE PARA IMPEDIR (reporte del usuario, 09-08, sobre el
 * popover ya desplegado): «replays sigue mostrando todo el ui con botonera port. tiene que
 * ser solo el ui original del juego». Censado en un iPhone 13 emulado antes del arreglo, en
 * la caja REAL del popover (`.replay-modal__juego`, 374×234): con la repetición corriendo se
 * veían el deck táctil entero —cruceta, rejilla de comandos, fila de utilidades, ☰ y ⛶— y el
 * envoltorio portrait, que además re-compone la pantalla de 1988 en dos bloques. En un
 * viewport de móvil a pantalla completa el deck se comía 270 px de 844 (32 %).
 *
 * 🔴 POR QUÉ EL ARREGLO PARECÍA HECHO Y NO LO ESTABA. `?embed=1` ya suprimía cromo desde el
 * carril export-replay… pero SÓLO los tres FAB del shell (`u5shell-fab-suppressed`). El deck
 * (`ui/touch.ts`) y el envoltorio (`skin/portrait/`) son otras dos capas, de otros dos dueños,
 * que se montan por `(pointer: coarse)` sin mirar si hay repetición. Un censo que preguntara
 * «¿están suprimidos los FAB?» daba VERDE con la botonera puesta.
 *
 * 🔴 EL PREDICADO PRINCIPAL ES POR EXTENSIÓN, NO UNA LISTA DE CAPAS. El requisito del usuario
 * es «sólo la UI original», o sea que cualquier capa FUTURA del port es también defecto — y
 * una lista de selectores nace incompleta el día que alguien monte la siguiente. Por eso el
 * aserto que manda es DEFAULT-DENY: cero controles pulsables en todo el documento. La lista
 * nombrada va detrás y sólo sirve para que el rojo diga QUIÉN volvió.
 *
 * 🔴 Y EL CONTROL DE NO-VACUIDAD NO ES ADORNO: sin él, este fichero pasaría verde en un
 * arnés donde el deck no se monta por otra razón (bajo `playwright.config.ts`, que es
 * `pointer: fine`, NO se monta — y ahí el sujeto no puede fallar aunque el arreglo se
 * revierta entero). El control carga LA MISMA URL SIN `replay` y exige ver la botonera; si
 * no la ve, el fichero falla nombrando al instrumento en vez de dar un verde vacío.
 *
 * POR QUÉ VIVE EN e2e/mobile Y NO EN LA BATERÍA DE ATERRIZAJE. La batería es pytest y su
 * fichero más caro (`test_companion_ea`) ya es sensible a CARGA por lanzar chromium bajo
 * `timeout`; añadirle otro navegador multiplica esa sensibilidad. Mismo reparto y misma razón
 * declarada que `combate-botonera.spec.ts` (#126b, a74d639c). Además el defecto SÓLO existe
 * bajo emulación de dispositivo (`hasTouch` ⇒ `pointer: coarse`), que es lo que declara
 * `playwright.mobile.config.ts` y no declara ninguna otra config.
 */
import { test, expect, type Page } from "@playwright/test";

const ID = "rep-solo-ui";
/** La URL EXACTA que construye el popover de /byo (demo-byo/src/popover-replay.ts:120). */
const URL_POPOVER = `/?embed=1&nointro&replay=${ID}`;
/** El mismo arranque SIN la repetición: el control de no-vacuidad. */
const URL_CONTROL = `/?embed=1&nointro`;

const CAPAS_DEL_PORT: Record<string, string> = {
  "deck táctil": ".touch-controls",
  cruceta: ".touch-dpad",
  "rejilla de comandos": ".touch-commands",
  "fila de utilidades": ".touch-util",
  "menú ☰ del deck": ".touch-shellbtn",
  "botón ▤ de layout": ".u5layout-btn",
  "botón ⛶ de pantalla completa": ".touch-fullscreen",
  "FAB ⚙ de sistema": ".u5shell-gear",
  "FAB ◧ de piel": ".u5skinsw",
  "FAB 🌐 de idioma": ".u5langsw",
  "envoltorio portrait": ".portrait-skin",
};

/** Elementos con los que se puede INTERACTUAR. El default-deny se mide sobre esto. */
const PULSABLES = 'button, [role="button"], input, select, textarea, a[href]';

interface Censo {
  pulsables: string[];
  capas: string[];
  reserva: string;
}

/** Qué se ve AHORA mismo, medido con geometría y estilo calculado (no con `toBeVisible`). */
async function censar(page: Page): Promise<Censo> {
  return page.evaluate(
    ({ PULSABLES, CAPAS_DEL_PORT }) => {
      const visible = (el: Element): boolean => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        if (Number(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        // 🔴 Y TIENE QUE CAER DENTRO DEL VIEWPORT. Sin esta línea el censo daba DOS falsos
        // positivos (medido el 09-08): el ✕ y el buscador del drawer SISTEMA, que cuando
        // está cerrado no se esconde — se APARCA a la derecha con `translateX(358.8px)`,
        // así que su caja mide 359×844 en x=390 de un viewport de 390 px, con
        // `display:flex`, `visibility:visible` y `opacity:1`. Los tres controles de estilo
        // dicen «visible» de algo que no está en pantalla.
        if (r.right <= 0 || r.bottom <= 0) return false;
        if (r.left >= window.innerWidth || r.top >= window.innerHeight) return false;
        // Un ancestro apartado (la barra de transporte `--limpia`) apaga a sus hijos.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const pcs = getComputedStyle(p);
          if (pcs.display === "none" || pcs.visibility === "hidden") return false;
          if (Number(pcs.opacity) === 0) return false;
        }
        return true;
      };
      /** Cómo NOMBRAR lo que se encontró, para que el rojo sea accionable. */
      const mote = (el: Element): string => {
        const cls = typeof el.className === "string" ? el.className : "";
        const txt = (el.textContent ?? "").trim().slice(0, 24);
        return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ""}>${txt}`;
      };
      return {
        pulsables: Array.from(document.querySelectorAll(PULSABLES)).filter(visible).map(mote),
        capas: Object.entries(CAPAS_DEL_PORT)
          .filter(([, sel]) => Array.from(document.querySelectorAll(sel)).some(visible))
          .map(([nombre]) => nombre),
        // El deck marca `html.u5-touch` y con ella RESERVA la banda inferior. Aunque se
        // escondieran sus botones, la reserva seguiría recortando la pantalla de 1988.
        reserva: document.documentElement.className,
      };
    },
    { PULSABLES, CAPAS_DEL_PORT },
  );
}

async function esperarMundo(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 30_000 },
  );
}

/**
 * Graba una repetición DE VERDAD (por los mismos hooks que usa `replay-ui.spec.ts`) y la
 * deja en IndexedDB, que es donde el arranque con `?replay=<id>` la busca. Se graba en vez
 * de sintetizarse porque el sujeto es el arranque real: un log inventado que `getLog` no
 * pudiera cargar dejaría el reproductor en `idle` y el test mediría una partida normal.
 */
async function sembrarRepeticion(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&loc=0&x=82&y=108&seed=4242");
  await esperarMundo(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__u5test.replay.startRec());
  for (let i = 0; i < 24; i++) {
    await page.locator("body").press(i % 2 ? "ArrowRight" : "ArrowDown");
    await page.waitForTimeout(20);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = await page.evaluate(() => (window as any).__u5test.replay.stopRec("solo-ui"));
  await page.evaluate(
    async ([l, id]) => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open("u5-replay", 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("logs")) {
            r.result
              .createObjectStore("logs", { keyPath: "id" })
              .createIndex("createdAt", "createdAt");
          }
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise<void>((res, rej) => {
        const tx = db.transaction("logs", "readwrite");
        tx.objectStore("logs").put({ ...(l as object), id });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    [log, ID] as [unknown, string],
  );
}

test("una repetición en móvil enseña SÓLO la UI de 1988 (y el control ve la botonera)", async ({
  page,
}) => {
  await sembrarRepeticion(page);

  // ── SUJETO ──────────────────────────────────────────────────────────────────
  await page.goto(URL_POPOVER);
  await esperarMundo(page);

  // 🔴 NO-VACUIDAD DEL SUJETO, ANTES DE MIRAR NADA. Si la repetición no llegó a cargarse
  // (id perdido, IndexedDB vacía, `getLog` en error) el juego arranca como una partida
  // normal SIN repetición — y entonces «no hay cromo» sería una afirmación sobre otra
  // pantalla. El estado del reproductor es lo que hace que este test hable del replay.
  await expect
    .poll(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => page.evaluate(() => (window as any).__u5test.replay.status().index as number),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const enReplay = await censar(page);

  // (A) EL ASERTO QUE MANDA — por extensión: ni un solo control pulsable.
  expect(
    enReplay.pulsables,
    "en una repetición no puede quedar NINGÚN control del port pulsable",
  ).toEqual([]);

  // (B) Las capas censadas el 09-08, para que el rojo diga cuál volvió.
  expect(enReplay.capas, "capas del port visibles durante la repetición").toEqual([]);

  // (C) Y tampoco la RESERVA del deck, que recorta la pantalla aunque no se vea un botón.
  expect(enReplay.reserva, "`html.u5-touch` reserva la banda del deck").not.toContain("u5-touch");

  // ── CONTROL DE NO-VACUIDAD, en la MISMA corrida ─────────────────────────────
  // Misma URL sin `replay`, mismo viewport, mismo navegador: aquí la botonera TIENE que
  // aparecer. Un verde de arriba sin este control no distingue «el arreglo funciona» de
  // «este arnés no monta deck».
  await page.goto(URL_CONTROL);
  await esperarMundo(page);
  const sinReplay = await censar(page);

  expect(
    sinReplay.capas,
    "CONTROL SIN DIENTES: sin `replay` la botonera debería estar — este arnés no la monta, " +
      "así que el verde de arriba no mide el arreglo",
  ).toContain("deck táctil");
  expect(sinReplay.pulsables.length, "CONTROL SIN DIENTES: cero pulsables sin `replay`").toBeGreaterThan(0);
});
