/**
 * UX MÓVIL (encargo 2026-07-24, carril mobile-ux): scroll táctil de la zona de
 * comandos (ruling del ticket UX-2) + botón fullscreen ⛶.
 *
 * ESCRITO PARA LA PRÓXIMA VENTANA DE E2E (no corrido en el carril de implementación
 * por el hold del resello ×2) — misma disciplina que el resto de la suite: taps
 * reales, asserts por estado lógico (__u5test) y geometría del DOM vivo.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  consoleLen,
  deckRoot,
  gotoMobile,
  tapDpad,
  tapUtil,
  soloEnLayout,
  hayBarraDeModo,
} from "./deck";
import { menuFirstRow } from "../../src/skin/fiel/intro.js";

/** Alto de la pantalla lógica del original (320×200). */
const SCREEN_H = 200;
/** Fila de rejilla = 8 px lógicos. */
const ROW = 8;
/** Índice de «Create New Character» en el menú (JCTUAR → J=0, C=1). */
const CREATE_INDEX = 1;

/**
 * Toca el RENGLÓN de una opción del menú sobre el canvas (lo que hace un dedo). Copiado
 * en contrato —no en cifras— de `mobile-arranque.spec.ts`: la geometría sale de
 * `menuFirstRow`, que es la MISMA función que usa el render. La primera fila depende de
 * si el logo gótico está cargado (17 con logo, 9 sin) y no hay hook que lo diga, así que
 * se prueban las dos y falla sólo si NINGUNA acierta — que es justo «el menú no responde
 * al dedo».
 */
async function tapMenuRow(page: Page, index: number): Promise<void> {
  const box = await page.locator("canvas").first().boundingBox();
  expect(box, "el canvas de la portada tiene que existir").not.toBeNull();
  for (const logo of [true, false]) {
    const pyLogical = (menuFirstRow(logo) + index) * ROW + ROW / 2;
    await page.mouse.click(box!.x + box!.width / 2, box!.y + (pyLogical / SCREEN_H) * box!.height);
    await page.waitForTimeout(400);
    if ((await page.evaluate(
      () =>
        (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test?.introPhase?.() ??
        null,
    )) !== "menu") {
      return; // el tap disparó su comando
    }
  }
}

/**
 * Swipe táctil REAL vía CDP (page.touchscreen sólo tapea): serie touchStart →
 * touchMove (pasos interpolados) → touchEnd, en coords CSS del viewport.
 *
 * 🔴 CDP ES EL PROTOCOLO DE CHROMIUM: `newCDPSession` LANZA bajo WebKit («CDP session is
 * only available in Chromium»), y por eso el test que usa este helper se salta ahí (ficha
 * #192, 13-08). NO se reimplementó con `TouchEvent` sintéticos a propósito: los eventos no
 * confiables no producen scroll NATIVO del contenedor, así que la versión «cross-engine»
 * habría dado un verde que no mide la propiedad — el desplazamiento de la rejilla es
 * justamente lo que este test existe para ver. Playwright no expone un touch-move real
 * fuera de CDP (1.61.1); el día que lo haga, este helper y el skip se retiran juntos.
 */
async function touchSwipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from.x, from.y) });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Métricas de scroll de la rejilla de comandos del deck. */
async function cmdScroll(page: Page): Promise<{ top: number; client: number; total: number }> {
  return page.evaluate(() => {
    const el = document.querySelector(".touch-commands")!;
    return { top: el.scrollTop, client: el.clientHeight, total: el.scrollHeight };
  });
}

test("UX-2: drag vertical sobre los comandos SCROLLEA la rejilla y NO dispara ningún comando", async ({
  page,
  browserName,
}) => {
  // El VEHÍCULO del gesto es CDP y CDP no existe fuera de Chromium (ver `touchSwipe`).
  // Se salta nombrando el mecanismo, no la conclusión: la propiedad —el TapGate distingue
  // arrastre de toque— NO está medida bajo WebKit y eso es hueco declarado, no cobertura.
  test.skip(
    browserName !== "chromium",
    "el swipe táctil real se conduce por CDP (Chromium-only); sin él no hay scroll nativo que medir",
  );
  await gotoMobile(page, "invariante");
  const before = await cmdScroll(page);
  expect(before.total, "la rejilla de mundo desborda (si no, nada que scrollear)").toBeGreaterThan(
    before.client + 4,
  );
  const grid = page.locator(".touch-commands");
  const box = (await grid.boundingBox())!;
  const cx = box.x + box.width / 2;
  const lines = await consoleLen(page);

  // Drag hacia ARRIBA (contenido sube → scrollTop crece), empezando SOBRE un botón.
  await touchSwipe(page, { x: cx, y: box.y + box.height * 0.75 }, { x: cx, y: box.y + box.height * 0.2 });
  await expect
    .poll(() => cmdScroll(page).then((s) => s.top), { message: "el drag táctil scrollea" })
    .toBeGreaterThan(before.top + 8);
  // El comando bajo el dedo NO se disparó (TapGate): la consola no registró nada.
  await page.waitForTimeout(400);
  expect(await consoleLen(page), "el drag no dispara comandos").toBe(lines);

  // Y un TAP normal sigue funcionando tras el drag (pointerup con gate limpio).
  const btn = page.locator(".touch-commands .touch-cmd", { hasText: "Look" }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.tap();
  await expect.poll(() => consoleLen(page), { message: "el tap sigue disparando" }).toBeGreaterThan(lines);
});

test("UX-2: chevrons de scroll (▼ al tope, ▲ al fondo) y apaisado sin recorte superior", async ({
  page,
}) => {
  // ★ TERRENO EXPLÍCITO, no el arranque pelado (adjudicación #26, 31-07). Con
  // `gotoMobile(page, "invariante")` a secas el arranque es el de INIT.GAM: Iolo's Hut (loc 13),
  // casilla (15,15) — que es UNA SILLA, con LA MESA (tile 148) pegada al este. El
  // último aserto de este test da un paso a la DERECHA, y ahí el paso es imposible:
  // el port responde «Blocked!», que es la conducta correcta. Medido con control
  // positivo: el MISMO paso, en el MISMO apaisado, sobre overworld (60,60) mueve
  // 60→61. O sea que lo que el test quiere probar —que el re-flow de la rotación no
  // rompió la cruceta— es CIERTO; sólo se estaba midiendo desde una casilla sin
  // salida al este. Se pasa a la casilla de sus dos vecinos verdes (:148 y :183),
  // que es campo abierto. La precondición de los chevrons se conserva: en loc 0
  // vertical la rejilla desborda igual (494 px de contenido en 388 de hueco, 20
  // comandos) y el chevron ▼ nace encendido.
  await gotoMobile(page, "invariante", { loc: 0, x: 60, y: 60, hour: 10 });
  // Portrait: la rejilla nace en el tope con overflow → sólo el chevron de ABAJO.
  await expect(page.locator(".touch-scrollhint-down")).toHaveClass(/on/);
  await expect(page.locator(".touch-scrollhint-up")).not.toHaveClass(/on/);
  // Al fondo: se invierten.
  await page.evaluate(() => {
    const el = document.querySelector(".touch-commands")!;
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator(".touch-scrollhint-up")).toHaveClass(/on/, { timeout: 3_000 });
  await expect(page.locator(".touch-scrollhint-down")).not.toHaveClass(/on/);

  // APAISADO: la cadena flex deja modebar y cruceta SIEMPRE visibles (el recorte
  // superior de UX-2 muere) y el scroll queda DENTRO de la rejilla.
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.orient))
    .toBe("landscape");
  const vh = (await page.viewportSize())!.height;
  // La barra de modo entra en la lista SÓLO si el layout la monta (el partido la retira);
  // lo que se afirma de cada superficie —no recortada por arriba, dentro del viewport— vale
  // igual en los dos, y es lo que este test existe para cubrir.
  for (const [name, sel] of [
    ...(hayBarraDeModo() ? ([["barra de modo", ".touch-modebar"]] as const) : []),
    ["cruceta ▲", '.touch-dpad button[data-key="ArrowUp"]'],
    ["fila útil", ".touch-util"],
  ] as const) {
    const b = await page.locator(sel).boundingBox();
    expect(b, `${name} tiene caja`).not.toBeNull();
    expect(b!.y, `${name} no recortada por arriba`).toBeGreaterThanOrEqual(-1);
    expect(b!.y + b!.height, `${name} dentro del viewport`).toBeLessThanOrEqual(vh + 1);
  }
  // La rejilla scrollea internamente también en apaisado (overflow interno vivo).
  const s = await cmdScroll(page);
  expect(s.total, "overflow interno en apaisado").toBeGreaterThan(s.client + 4);
  await expect(page.locator(".touch-scrollhint-down, .touch-scrollhint-up").locator("visible=true").first())
    .toBeVisible();
  // Y la cruceta sigue moviendo (el re-flow no rompió el deck).
  const pos = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...(window as any).__u5test.state().position };
  });
  await tapDpad(page, "ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__u5test.state().position.x;
      }),
    )
    .toBe(pos.x + 1);
});

/**
 * ★★ EL SUJETO ES EL CONTRATO «botón ⟺ API», NO «el botón está» (ficha #192, 13-08).
 *
 * El título decía «visible con API (Chromium)» y el cuerpo afirmaba la visibilidad SIN
 * CONDICIÓN: bajo el proyecto `iphone-webkit` eso es un rojo garantizado, porque el
 * WebKit que conduce Playwright no expone NI `requestFullscreen` NI
 * `webkitRequestFullscreen` sobre `documentElement` (medido el 13-08 con la misma sonda
 * contra los dos motores) y `ui/fullscreen.ts:36` entonces devuelve `null` → el ⛶ no se
 * monta. Eso no es un defecto: es la degradación que el fichero de producto declara para
 * el Safari de iPhone, donde tampoco hay fullscreen de elemento.
 *
 * Lo que sí es afirmable en LOS DOS motores —y lo que este test pasa a afirmar— es la
 * BICONDICIONAL: el ⛶ se monta exactamente cuando la API existe. Así el rojo vuelve a
 * significar algo en ambos: en Chromium, «hay API y falta el botón»; en WebKit, «no hay
 * API y el botón está» (que sería fingir un control que no puede funcionar). El ciclo de
 * conmutación sólo se ejercita en el brazo que tiene API.
 */
test("⛶ fullscreen: se monta exactamente cuando hay API; con ella conmuta y sale; título por ts()", async ({
  page,
}) => {
  await gotoMobile(page, "invariante");
  const fsBtn = page.locator(".touch-fullscreen");
  const hayApi = await page.evaluate(
    () =>
      typeof document.documentElement.requestFullscreen === "function" ||
      typeof (document.documentElement as unknown as Record<string, unknown>)
        .webkitRequestFullscreen === "function",
  );
  if (!hayApi) {
    // Brazo SIN API (WebKit / Safari iPhone): el contrato es que el botón NO exista.
    await expect(
      fsBtn,
      "sin Fullscreen API de elemento el ⛶ NO se monta (degradación de ui/fullscreen.ts)",
    ).toHaveCount(0);
    return;
  }
  await expect(fsBtn, "⛶ montado al final de la barra de modo").toBeVisible();
  // ★ La clave del catálogo es "Fullscreen", NO "Full screen" (adjudicación #26). El
  // rótulo del ⛶ nació aquí como `ts("Full screen")` (ffddc704) inventando una SEGUNDA
  // grafía para un concepto que YA tenía entrada: `1b94baed` había puesto
  // `ts("Fullscreen")` en el drawer del shell y `"Fullscreen": "Pantalla completa"` en
  // i18n/shell.ts. O sea, el ⛶ del deck salía SIN TRADUCIR en español. `277551be`
  // (lote i18n-deck) lo unificó a la clave buena; este aserto se quedó pinchado en el
  // literal huérfano. Manda el catálogo, que además tiene sello propio en la suite dev
  // (game/tests/shell-i18n.test.ts:41/43, verde).
  expect(await fsBtn.getAttribute("title")).toBe("Fullscreen");

  const fsElement = (): Promise<boolean> =>
    page.evaluate(() => document.fullscreenElement != null);
  expect(await fsElement()).toBe(false);
  await fsBtn.tap(); // tap = gesto de usuario válido para la Fullscreen API
  await expect.poll(() => fsElement(), { timeout: 4_000, message: "entra en fullscreen" }).toBe(true);
  await expect(fsBtn).toHaveClass(/touch-mode-on/);
  expect(await fsBtn.getAttribute("title")).toBe("Exit full screen");
  await fsBtn.tap();
  await expect.poll(() => fsElement(), { timeout: 4_000, message: "sale de fullscreen" }).toBe(false);
  await expect(fsBtn).not.toHaveClass(/touch-mode-on/);
  // El deck sigue operativo tras el ciclo.
  await expect(deckRoot(page)).toBeVisible();
});

test("ruling apaisado: canvas a ALTO COMPLETO, deck acotado sin solape, útil+⇄ al borde", async ({
  page,
}) => {
  // ★ EXPECTATIVA DE COMPOSICIÓN (censo 02-08): este test fija un valor CONCRETO de la
  // composición, así que describe UN layout. Pinchado y saltado en la pasada del otro —
  // duplicarlo no daría cobertura, daría un rojo por medir otra cosa.
  test.skip(soloEnLayout("clasico"), "pinchado al layout clasico");
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await gotoMobile(page, "clasico", { loc: 0, x: 60, y: 60, hour: 10 });
  const vh = (await page.viewportSize())!.height;
  const canvas = await page.evaluate(() => {
    let best: DOMRect | null = null;
    for (const c of Array.from(document.querySelectorAll("#app canvas"))) {
      const b = c.getBoundingClientRect();
      if (b.width * b.height > (best ? best.width * best.height : 0)) best = b;
    }
    return best ? { y: best.y, h: best.height, x: best.x, w: best.width } : null;
  });
  expect(canvas).not.toBeNull();
  // El juego llena el ALTO (ruling #1; margen 8% por el aspect y redondeos).
  expect(canvas!.h).toBeGreaterThanOrEqual(vh * 0.92);
  // Deck acotado (~≤330px) y sin pisar el canvas (ruling #1/#8).
  const deck = (await deckRoot(page).boundingBox())!;
  expect(deck.width).toBeLessThanOrEqual(332);
  const overlapX = Math.min(canvas!.x + canvas!.w, deck.x + deck.width) - Math.max(canvas!.x, deck.x);
  expect(overlapX).toBeLessThanOrEqual(0);
  // Útil al borde inferior con el ⇄ DENTRO de la fila (ruling #2/#3).
  const util = (await page.locator(".touch-util").boundingBox())!;
  expect(util.y + util.height).toBeGreaterThanOrEqual(vh - 24);
  // (El ⇄ ya no vive en la fila — se retiró el 27-07; el swap va por el drawer SISTEMA,
  //  sección «Vídeo», desde la ficha #154 que jubiló el popover ☰ que lo alojaba antes.)
  // Ningún rótulo útil desborda su botón (ruling #4).
  for (const b of await page.locator(".touch-util .touch-util-btn").all()) {
    const over = await b.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over, `rótulo «${await b.textContent()}» sin desborde`).toBeLessThanOrEqual(1);
  }
});

test("ruling #5/#6: FABs ocultos en táctil (☰ los sustituye) y la rotación nace en tope", async ({
  page,
}) => {
  await gotoMobile(page, "invariante", { loc: 0, x: 60, y: 60, hour: 10 });
  // FABs fijos OCULTOS en juego táctil (en intro/escritorio siguen — fuera de este test).
  for (const sel of [".u5shell-gear", ".u5skinsw", ".u5langsw"]) {
    await expect(page.locator(sel)).toBeHidden();
  }
  // ☰ abre el drawer del shell (emite F10) y Esc lo cierra.
  // ⚠ ERAN TRES PASOS (ficha #154): ☰ → `.touch-shellmenu.on` → ítem «⚙ System». El popover
  // intermedio se retiró entero y el ☰ abre el drawer DIRECTAMENTE, así que los tres colapsan
  // en uno. Lo que este test afirma —que con los tres FAB ocultos el ☰ SIGUE siendo la vía
  // táctil al shell (ruling #5)— no cambia: cambia el número de toques que cuesta, que es
  // justo lo que la ficha quería reducir.
  await page.locator(".touch-shellbtn").tap();
  await expect(page.locator('[data-testid="u5-shell-drawer"]')).toHaveClass(/open/, {
    timeout: 6_000,
  });
  await tapUtil(page, "Escape");
  await expect(page.locator('[data-testid="u5-shell-drawer"]')).not.toHaveClass(/open/);

  // #6: scrollear al fondo y ROTAR → la rejilla nace en el TOPE (fila 1 íntegra, ▲ off).
  await page.evaluate(() => {
    const el = document.querySelector(".touch-commands")!;
    el.scrollTop = el.scrollHeight;
  });
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.orient))
    .toBe("landscape");
  await expect
    .poll(() => page.evaluate(() => document.querySelector(".touch-commands")!.scrollTop))
    .toBeLessThanOrEqual(1);
  await expect(page.locator(".touch-scrollhint-up")).not.toHaveClass(/on/);
  // La primera fila de comandos nace ÍNTEGRA dentro del wrap (no recortada arriba).
  const wrap = (await page.locator(".touch-cmdwrap").boundingBox())!;
  const first = (await page.locator(".touch-commands .touch-cmd").first().boundingBox())!;
  expect(first.y).toBeGreaterThanOrEqual(wrap.y - 1);
});

test("iOS name-input: visible en fase name, SIN auto-focus (el tap del usuario es el gesto)", async ({
  page,
}) => {
  // Regresión del bug iPhone: el focus() programático por-frame dejaba el input
  // enfocado SIN teclado y el tap del usuario ya no disparaba un focus fresco.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful");
  const phase = (): Promise<string | null> =>
    page.evaluate(() => {
      const t = (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test;
      return t?.introPhase ? t.introPhase() : null;
    });
  // ★ EL MENÚ NO ES DOM (adjudicación #26). Este test nació conduciendo un botón
  // `.intro-touch-btn` con el rótulo «Create», y ese botón dejó de existir en
  // `10d0a40d` (53 minutos DESPUÉS de que se escribiera esta spec, que nunca llegó a
  // correr): el popup de botones-clon se retiró por el principio «el overlay táctil no
  // duplica UI que el juego ya pinta» y el menú pasó a HIT-ZONES sobre el canvas
  // (`introTapHandler` → `menuRowHit` → la misma tabla JCTUAR del teclado). La
  // sustancia de este test —sin auto-focus, atributos iOS, el input por encima del
  // teclado— sigue siendo canon; lo rancio era el CONDUCTOR. Se adopta el patrón ya
  // verde de `mobile-arranque.spec.ts`: la geometría se IMPORTA del propio fuente
  // (`menuFirstRow`), no se copia, y se prueban las dos variantes (con logo gótico
  // cargado y sin él) porque no hay hook público que diga cuál está viva.
  const advance = page.locator(".intro-touch-advance");
  await expect(advance, "la portada ofrece «Tap to continue» en táctil").toBeVisible({
    timeout: 30_000,
  });
  for (let i = 0; i < 40 && (await phase()) !== "menu"; i++) {
    if (await advance.isVisible()) await advance.tap().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  expect(await phase(), "la portada tiene que desembocar en el menú").toBe("menu");
  await tapMenuRow(page, CREATE_INDEX);
  await expect.poll(() => phase(), { timeout: 15_000 }).toBe("name");

  const input = page.locator(".intro-name-entry input");
  await expect(input).toBeVisible({ timeout: 5_000 });
  // Sin auto-focus: tras 800ms de fase name, el input NO tiene el foco robado.
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => document.activeElement === document.querySelector(".intro-name-entry input")),
    "el render-loop no roba el foco (bug iPhone)",
  ).toBe(false);
  // Y está DENTRO del viewport y por ENCIMA de la mitad (el teclado no lo tapará).
  const box = (await input.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeLessThanOrEqual(vh * 0.66);
  // El tap del usuario enfoca (gesto → teclado nativo en dispositivo real).
  await input.tap();
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement === document.querySelector(".intro-name-entry input")),
    )
    .toBe(true);
  // Atributos iOS del patrón robusto.
  // ★ ESTE ASERTO CAZÓ UN DEFECTO DE PRODUCTO, y sólo pudo hacerlo bajo WebKit (fichas #192 y #219,
  // 13-08): pregunta por el ATRIBUTO DE CONTENIDO, no por la propiedad, y `faithful-intro.ts`
  // escribía `input.autocapitalize = "characters"` — que en WebKit no refleja (la propiedad
  // ni siquiera está en el prototipo: queda como campo suelto del elemento y `getAttribute`
  // da null). En Chromium reflejaba y el aserto pasaba, así que la única señal posible era
  // la del segundo motor. Si algún día se «simplifica» a la propiedad, esto vuelve a rojo
  // AHÍ y sólo ahí: no lo cambies sin releer el comentario del productor.
  expect(await input.getAttribute("enterkeyhint")).toBe("done");
  expect(await input.getAttribute("autocapitalize")).toBe("characters");
  expect(await input.getAttribute("autocorrect")).toBe("off");
});

/**
 * POLLING PERPETUO (auditoría UI/UX móvil 2026-07-25, TANDA C). El deck corría un
 * `setInterval(400 ms)` que hacía refresh + updateOrientation + syncReserve + chevrons,
 * con `querySelectorAll` y varios `getBoundingClientRect` dentro: ≈2,5 forzados de
 * layout por segundo, para siempre, en un juego POR TURNOS que en reposo no tiene nada
 * que recalcular. Ahora la geometría va por ResizeObserver + matchMedia + resize, y el
 * contexto por evento de tecla; el tick que queda no lee layout.
 *
 * La norma se mide CONTANDO lecturas de layout sobre nodos del deck: en reposo, casi
 * cero; y tras un cambio real (rotación), el deck DEBE seguir re-sincronizándose.
 */
test("reposo: el deck no fuerza layout en bucle (eventos, no polling) y sigue reaccionando", async ({
  page,
}) => {
  await gotoMobile(page, "invariante", { loc: 0, x: 60, y: 60, hour: 10 });

  // Instrumenta getBoundingClientRect SÓLO para nodos del deck (el resto de la página
  // —canvas, piel— tiene su propio ritmo y no es lo que se está midiendo).
  await page.evaluate(() => {
    const w = window as unknown as { __u5deckRects?: number };
    w.__u5deckRects = 0;
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.closest?.(".touch-controls")) w.__u5deckRects = (w.__u5deckRects ?? 0) + 1;
      return orig.call(this);
    };
  });

  // 2 s de REPOSO absoluto (ni taps ni resizes). Con el polling viejo esto eran ~5
  // ciclos × varios rects = decenas de lecturas.
  await page.waitForTimeout(2_000);
  const idle = await page.evaluate(
    () => (window as unknown as { __u5deckRects?: number }).__u5deckRects ?? 0,
  );
  expect(idle, `lecturas de layout del deck en 2 s de reposo (eran ~15+)`).toBeLessThan(6);

  // …y el deck NO se ha quedado sordo: rotar re-publica la reserva por el eje correcto.
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.orient), { timeout: 4_000 })
    .toBe("landscape");
  // 🔴 EL TESTIGO ES LA RESERVA DE `#app`, NO `--u5-touch-reserve-x`. La propiedad que este
  // test defiende —al rotar, el hueco del mapa pasa a reservarse en el eje X— es de LOS DOS
  // layouts; la VARIABLE, no: en el régimen de dos raíles la reserva la publica su propio CSS
  // (`deck-ancho.ts:1115`) en los paddings de `#app`, y `ui/touch.ts` deja la variable a 0 a
  // propósito (ver `railsOwnReserve`). Preguntando por la variable, el test medía el
  // MECANISMO de un layout y daba por sorda una rotación que sí se atendió. Medido al rotar:
  //   clásico  padding-left 260 · partido  padding-left 152 + right 110
  // Y el eje importa: si se reservara en Y, el deck habría publicado por el eje equivocado.
  const reservaDeApp = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("#app")!);
      const n = (v: string) => parseFloat(v) || 0;
      return {
        x: Math.round(n(cs.paddingLeft) + n(cs.paddingRight)),
        y: Math.round(n(cs.paddingBottom)),
      };
    });
  await expect
    .poll(async () => (await reservaDeApp()).x > 100, {
      timeout: 4_000,
      message: "la reserva del mapa pasa al eje X al rotar (sin polling)",
    })
    .toBe(true);
  const reserva = await reservaDeApp();
  expect(
    reserva.y,
    `tras rotar, el mapa se reserva por el eje X (${reserva.x} px) y NADA por el eje Y`,
  ).toBe(0);

  // Y conmutar de hoja (que cambia el ALTO del deck) re-mide por el ResizeObserver.
  const after = await page.evaluate(
    () => (window as unknown as { __u5deckRects?: number }).__u5deckRects ?? 0,
  );
  expect(after, "los eventos SÍ disparan medición (no se ha desconectado todo)").toBeGreaterThan(
    idle,
  );
});
