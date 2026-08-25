/**
 * AUDITORÍA UI/UX MÓVIL — matriz de CAPTURAS + MÉTRICAS (encargo 2026-07-25).
 *
 * No es una suite de aserciones: es un CAPTURADOR. Recorre 7 clases de dispositivo
 * (× portrait/landscape, rotación EN CALIENTE con setViewportSize como el resto de la
 * suite móvil) y por cada combinación fotografía 6 estados del juego (mundo, deck
 * desplegado, popover ☰, Z-stats, combate, intro-nombre) midiendo a la vez la
 * geometría viva: rect de cada target táctil visible, % de pantalla del canvas /
 * deck / fila útil / cromo restante, y todo overflow o recorte de rótulo.
 *
 * OPT-IN: sólo corre con `U5_MOBILE_AUDIT=1` (si no, todo el fichero se salta) — así
 * puede vivir en el repo sin alargar los gates.
 *
 *   cd game
 *   U5_MOBILE_AUDIT=1 U5_E2E_PORT=5288 \
 *     npx playwright test -c playwright.mobile.config.ts --project=iphone \
 *     e2e/mobile/mobile-audit.spec.ts
 *
 * (el `--project` sólo aporta el navegador: cada dispositivo de la matriz se emula en
 *  su propio contexto con viewport/DPR/UA propios y `isMobile+hasTouch`).
 *
 * Salida (dir gitignored, material del juego): `U5_MOBILE_AUDIT_OUT` o
 * `original/av-referencia/mobile-audit-20260725/` — `<id>-<orient>-<estado>.png`,
 * `metricas.json` y `index.html` (contact sheet autocontenido, sin CDN).
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  cmdLabels,
  gotoMobile,
  inCombat,
  setSheet,
  tapCmd,
  tapDigits,
  tapMapCell,
  tapUtil,
  SHELL_DRAWER, // ficha #154: el ☰ abre el drawer SISTEMA, ya no un popover propio
} from "./deck";
import { SUELO_TACTIL } from "./suelo-tactil";

const AUDIT_ON = process.env.U5_MOBILE_AUDIT === "1" || process.env.U5_MOBILE_AUDIT === "true";
const OUT_DIR =
  process.env.U5_MOBILE_AUDIT_OUT ??
  "<repo>/original/av-referencia/mobile-audit-20260725";

const UA_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
  dpr: number;
  ua: string;
}

/** Matriz del encargo (px CSS en PORTRAIT; el landscape es el swap). */
const DEVICES: readonly Device[] = [
  { id: "se", label: "iPhone SE (375×667)", w: 375, h: 667, dpr: 2, ua: UA_IOS },
  { id: "ip15", label: "iPhone 15 (393×852)", w: 393, h: 852, dpr: 3, ua: UA_IOS },
  { id: "ipmax", label: "iPhone 15 Pro Max (430×932)", w: 430, h: 932, dpr: 3, ua: UA_IOS },
  { id: "pixel", label: "Pixel 7 (412×915)", w: 412, h: 915, dpr: 2.625, ua: UA_ANDROID },
  { id: "s8", label: "Galaxy S8 estrecho (360×740)", w: 360, h: 740, dpr: 3, ua: UA_ANDROID },
  { id: "ipadmini", label: "iPad mini (744×1133)", w: 744, h: 1133, dpr: 2, ua: UA_IPAD },
  { id: "ipad", label: "iPad Pro (1024×1366)", w: 1024, h: 1366, dpr: 2, ua: UA_IPAD },
];

const STATES = ["mundo", "deck", "popover", "ztats", "combate", "intro-nombre"] as const;

// ── Medición (todo se lee del DOM vivo, en px CSS) ───────────────────────────────

interface Metrics {
  device: string;
  orient: string;
  state: string;
  viewport: { w: number; h: number; dpr: number };
  regions: Record<string, RegionMetric | null>;
  chromeRestPct: number;
  buttons: ButtonMetric[];
  smallTargets: number;
  clippedLabels: string[];
  outsideViewport: string[];
  belowFold: string[];
  overflow: { hDoc: boolean; vDoc: boolean; scrollW: number; clientW: number };
  cmdScroll: { top: number; client: number; total: number } | null;
  activeSheet: string | null;
  notes: string[];
}

interface RegionMetric {
  x: number;
  y: number;
  w: number;
  h: number;
  areaPct: number;
  wPct: number;
  hPct: number;
}

interface ButtonMetric {
  label: string;
  cls: string;
  x: number;
  y: number;
  w: number;
  h: number;
  small: boolean;
  clipped: boolean;
  outside: boolean;
  belowFold: boolean;
}

async function measure(page: Page): Promise<Omit<Metrics, "device" | "orient" | "state" | "notes">> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const round = (n: number): number => Math.round(n * 10) / 10;
    const visible = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (Number(cs.opacity || "1") < 0.05) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
    };
    const region = (r: DOMRect | null): RegionMetricLite | null =>
      r
        ? {
            x: round(r.x),
            y: round(r.y),
            w: round(r.width),
            h: round(r.height),
            areaPct: round(((r.width * r.height) / (vw * vh)) * 100),
            wPct: round((r.width / vw) * 100),
            hPct: round((r.height / vh) * 100),
          }
        : null;
    interface RegionMetricLite {
      x: number;
      y: number;
      w: number;
      h: number;
      areaPct: number;
      wPct: number;
      hPct: number;
    }

    // Canvas de juego = el canvas VISIBLE de mayor área (fiel / salida shader; el
    // chrome monta canvases auxiliares 0×0 y la piel shader dos canvases).
    let canvasRect: DOMRect | null = null;
    for (const c of Array.from(document.querySelectorAll("canvas"))) {
      const b = c.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (!canvasRect || b.width * b.height > canvasRect.width * canvasRect.height) canvasRect = b;
    }
    const rectOrNull = (sel: string): DOMRect | null => {
      const el = document.querySelector(sel);
      return el && visible(el) ? el.getBoundingClientRect() : null;
    };
    const regions: Record<string, RegionMetricLite | null> = {
      canvas: region(canvasRect),
      deck: region(rectOrNull(".touch-controls")),
      util: region(rectOrNull(".touch-util")),
      modebar: region(rectOrNull(".touch-modebar")),
      commands: region(rectOrNull(".touch-cmdwrap")),
      dpad: region(rectOrNull(".touch-dpad")),
      sheets: region(rectOrNull(".touch-sheets")),
      introTouch: region(rectOrNull(".intro-touch")),
      nameInput: region(rectOrNull(".intro-name-entry")),
    };
    // Cromo restante = viewport − canvas − deck (área no solapada del deck).
    const overlap = (a: DOMRect | null, b: DOMRect | null): number => {
      if (!a || !b) return 0;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const deckRect = document.querySelector(".touch-controls")?.getBoundingClientRect() ?? null;
    const used =
      (canvasRect ? canvasRect.width * canvasRect.height : 0) +
      (deckRect ? deckRect.width * deckRect.height : 0) -
      overlap(canvasRect, deckRect);
    const chromeRestPct = round(Math.max(0, 100 - (used / (vw * vh)) * 100));

    const SEL = [
      "button",
      "[role='button']",
      ".touch-cmd",
      ".touch-mode",
      ".touch-kb",
      ".touch-num",
      ".touch-util-btn",
      // (`.touch-shellitem` retirado: el popover ☰ que lo servía se jubiló, ficha #154.)
      ".touch-yn",
      ".intro-touch-btn",
      "input",
      "select",
    ].join(", ");
    const cmdWrap = document.querySelector(".touch-cmdwrap")?.getBoundingClientRect() ?? null;
    const buttons: ButtonMetricLite[] = [];
    interface ButtonMetricLite {
      label: string;
      cls: string;
      x: number;
      y: number;
      w: number;
      h: number;
      small: boolean;
      clipped: boolean;
      outside: boolean;
      belowFold: boolean;
    }
    const seen = new Set<Element>();
    for (const el of Array.from(document.querySelectorAll(SEL))) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const he = el as HTMLElement;
      const raw =
        (he.textContent ?? "").trim() ||
        he.getAttribute("title") ||
        he.getAttribute("aria-label") ||
        he.getAttribute("placeholder") ||
        (he.tagName === "INPUT" ? "«input»" : "") ||
        "?";
      const inGrid = !!el.closest(".touch-commands");
      buttons.push({
        label: raw.replace(/\s+/g, " ").slice(0, 28),
        cls: (he.className || "").split(/\s+/).filter((c) => c && c !== "touch-btn").join(" "),
        x: round(r.x),
        y: round(r.y),
        w: round(r.width),
        h: round(r.height),
        small: r.width < 44 || r.height < 44,
        clipped: he.scrollWidth > he.clientWidth + 1 || he.scrollHeight > he.clientHeight + 1,
        outside: r.x < -0.5 || r.y < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5,
        // Bajo el pliegue del scroller de comandos (no alcanzable sin scrollear).
        belowFold:
          inGrid && !!cmdWrap && (r.top > cmdWrap.bottom - 4 || r.bottom < cmdWrap.top + 4),
      });
    }

    const cmdEl = document.querySelector(".touch-commands");
    const cmdScroll = cmdEl
      ? { top: cmdEl.scrollTop, client: cmdEl.clientHeight, total: cmdEl.scrollHeight }
      : null;

    let sheet: string | null = null;
    for (const m of ["move", "az", "num", "yesno"]) {
      if (document.querySelector(`.touch-sheet-${m}`)?.classList.contains("touch-sheet-on")) sheet = m;
    }

    return {
      viewport: { w: vw, h: vh, dpr: window.devicePixelRatio },
      regions,
      chromeRestPct,
      buttons,
      smallTargets: buttons.filter((b) => b.small).length,
      clippedLabels: buttons.filter((b) => b.clipped).map((b) => `${b.label} (${b.cls})`),
      outsideViewport: buttons
        .filter((b) => b.outside)
        .map((b) => `${b.label} @${b.x},${b.y} ${b.w}×${b.h}`),
      belowFold: buttons.filter((b) => b.belowFold).map((b) => b.label),
      overflow: {
        hDoc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        vDoc: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      },
      cmdScroll,
      activeSheet: sheet,
    } as unknown as Omit<Metrics, "device" | "orient" | "state" | "notes">;
  });
}

// ── Captura ─────────────────────────────────────────────────────────────────────

const collected: Metrics[] = [];
/** Estados que no se pudieron capturar (se listan en el contact sheet, no rompen la matriz). */
const failures: string[] = [];

async function shoot(
  page: Page,
  dev: Device,
  orient: "portrait" | "landscape",
  state: string,
  notes: string[] = [],
): Promise<void> {
  const name = `${dev.id}-${orient}-${state}`;
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
  const m = await measure(page);
  collected.push({ device: dev.id, orient, state, notes, ...m });
}

/** Rect del canvas VISIBLE de mayor área (fiel / salida shader / canvas de la intro). */
async function canvasRectOf(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const r = await page.evaluate(() => {
    let best: DOMRect | null = null;
    for (const c of Array.from(document.querySelectorAll("canvas"))) {
      const b = c.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (!best || b.width * b.height > best.width * best.height) best = b;
    }
    return best ? { x: best.x, y: best.y, w: best.width, h: best.height } : null;
  });
  if (!r) throw new Error("sin canvas visible");
  return r;
}

/** Espera a que el rect del canvas asiente (tras boot o rotación en caliente). */
async function settle(page: Page): Promise<void> {
  let prev = "";
  for (let i = 0; i < 12; i++) {
    const cur = await canvasRectOf(page)
      .then((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`)
      .catch(() => "none");
    if (cur !== "none" && cur === prev) return;
    prev = cur;
    await page.waitForTimeout(180);
  }
}

async function rotate(page: Page): Promise<void> {
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await settle(page);
  await page.waitForTimeout(300);
}

/** Envuelve un estado: si falla, se anota y la matriz sigue (esto captura, no asevera). */
async function step(what: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    failures.push(`${what} — ${String(e).split("\n")[0]!.slice(0, 180)}`);
  }
}

/** Los 4 estados «limpios» (no destructivos) de una orientación. */
async function captureCleanStates(
  page: Page,
  dev: Device,
  orient: "portrait" | "landscape",
): Promise<void> {
  const tag = `${dev.id}/${orient}`;

  // 1. mundo (deck en su estado por defecto: hoja move + comandos de MUNDO)
  await step(`${tag}/mundo`, async () => {
    await shoot(page, dev, orient, "mundo", [`comandos contextuales: ${(await cmdLabels(page)).length}`]);
  });

  // 2. deck desplegado = hoja A–Z (la más densa; el peor caso de reparto de espacio)
  await step(`${tag}/deck`, async () => {
    await setSheet(page, "az");
    await shoot(page, dev, orient, "deck", ["hoja A–Z (QWERTY) alzada"]);
    await setSheet(page, "move");
  });

  // 3. drawer SISTEMA. ⚠ ERA EL «popover ☰» (ficha #154): el ☰ abría un menú intermedio de
  //    cinco ítems y la captura retrataba ESE menú. El popover se jubiló entero — el ☰ emite
  //    F10 y abre el drawer de un toque — así que la matriz retrata AHORA lo que el primer
  //    toque enseña de verdad. El cierre vuelve a ser un tap normal sobre el ☰: el apaño de
  //    `dispatchEvent("pointerdown")` existía porque en apaisado el popover se superponía al
  //    propio botón y el tap real ya no lo alcanzaba (hallazgo UX del informe) — el drawer no
  //    se le pone encima, así que ese hallazgo queda SUPERADO, no olvidado.
  await step(`${tag}/drawer`, async () => {
    await page.locator(".touch-shellbtn").tap();
    await expect(page.locator(SHELL_DRAWER)).toHaveClass(/open/, { timeout: 6_000 });
    await shoot(page, dev, orient, "drawer");
    await page.locator(".touch-shellbtn").tap();
    await expect(page.locator(SHELL_DRAWER)).not.toHaveClass(/open/, { timeout: 4_000 });
  });

  // 4. ztats — lista larga en el panel superior (miembro 1)
  await step(`${tag}/ztats`, async () => {
    await tapCmd(page, "Ztats");
    await tapDigits(page, "1");
    await page.waitForTimeout(400);
    await setSheet(page, "move");
    await shoot(page, dev, orient, "ztats");
    await tapUtil(page, "Space");
    await page.waitForTimeout(300);
  });
}

async function auditDevice(browser: Browser, dev: Device): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: dev.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: dev.ua,
  });
  try {
    // ── Página 1: mundo/deck/popover/ztats en PORTRAIT, rotación en caliente,
    //    los mismos en LANDSCAPE, y el combate en ambas (rotado en caliente).
    const page = await ctx.newPage();
    // Sin esto las acciones NO tienen timeout (default de Playwright = 0): un tap
    // sobre un target tapado se cuelga hasta el timeout del TEST (medido: 12 min
    // muertos en el primer intento de esta matriz).
    page.setDefaultTimeout(15_000);
    await gotoMobile(page, "invariante", { loc: 0, x: 60, y: 60, hour: 10, seed: 7 });
    await settle(page);
    await captureCleanStates(page, dev, "portrait");

    await rotate(page);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.orient))
      .toBe("landscape");
    await captureCleanStates(page, dev, "landscape");

    // 5. combate: goblin determinista al este + tap-al-enemigo (entrada móvil).
    //    No-fatal: si la entrada falla, se anota y el resto de la matriz sobrevive.
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__u5test.game.overworldEnemies.enemies.push({
          defIndex: 0,
          tile: 0x94,
          water: false,
          x: 61,
          y: 60,
        });
      });
      await tapMapCell(page, 61, 60);
      await expect.poll(() => inCombat(page), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(600);
      await shoot(page, dev, "landscape", "combate");
      await rotate(page); // vuelta a portrait EN COMBATE
      await shoot(page, dev, "portrait", "combate");
    } catch (e) {
      failures.push(`${dev.id}: combate no capturado — ${String(e).slice(0, 200)}`);
    }
    await page.close();

    // ── Página 2: intro táctil hasta el prompt de NOMBRE (el caso del teclado).
    const intro = await ctx.newPage();
    try {
      intro.setDefaultTimeout(15_000);
      await intro.addInitScript(() => localStorage.clear());
      await intro.goto("/?skin=faithful");
      const phase = (): Promise<string | null> =>
        intro.evaluate(() => {
          const t = (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test;
          return t?.introPhase ? t.introPhase() : null;
        });
      // logo/title/attract: el overlay táctil tiene un único botón «Tap to continue».
      await expect(intro.locator(".intro-touch")).toBeVisible({ timeout: 40_000 });
      for (let i = 0; i < 60 && (await phase()) !== "menu"; i++) {
        const adv = intro.locator(".intro-touch-btn").first();
        if (await adv.isVisible()) await adv.tap({ timeout: 4_000 }).catch(() => {});
        await intro.waitForTimeout(250);
      }
      // En la fase MENÚ el overlay se OCULTA a propósito (faithful-intro.ts
      // syncIntroTouch: el menú pintado en el canvas ES el control) → «Create New
      // Character» se toca en SU RENGLÓN del canvas: fila menuFirstRow(logo)=17 + 1
      // (índice de C en "JCTUAR"), rejilla de 8 px sobre la pantalla lógica 320×200.
      for (let i = 0; i < 4 && (await phase()) === "menu"; i++) {
        const r = await canvasRectOf(intro);
        await intro.touchscreen.tap(r.x + r.w / 2, r.y + (((17 + 1) * 8 + 4) / 200) * r.h);
        await intro.waitForTimeout(600);
      }
      await expect.poll(() => phase(), { timeout: 20_000 }).toBe("name");
      await expect(intro.locator(".intro-name-entry input")).toBeVisible({ timeout: 8_000 });
      await intro.locator(".intro-name-entry input").tap();
      await intro.waitForTimeout(400);
      await shoot(intro, dev, "portrait", "intro-nombre", ["input del nombre enfocado por tap"]);
      await rotate(intro);
      await shoot(intro, dev, "landscape", "intro-nombre", ["input del nombre enfocado por tap"]);
    } catch (e) {
      failures.push(`${dev.id}: intro-nombre no capturada — ${String(e).slice(0, 200)}`);
    }
    await intro.close();
  } finally {
    await ctx.close();
  }
}

// ── Tests (uno por dispositivo + agregado final; workers=1 ⇒ orden de declaración) ─

test.describe(AUDIT_ON ? "auditoría móvil" : "auditoría móvil (OFF: falta U5_MOBILE_AUDIT=1)", () => {
  test.skip(!AUDIT_ON, "opt-in: U5_MOBILE_AUDIT=1");
  // Sin `mode:"serial"` a propósito: un dispositivo caído NO debe saltarse los demás
  // (el orden lo garantiza `workers: 1` de la config + el orden de declaración).

  for (const dev of DEVICES) {
    test(`captura ${dev.id} — ${dev.label}`, async ({ browser }) => {
      test.setTimeout(420_000);
      mkdirSync(OUT_DIR, { recursive: true });
      try {
        await auditDevice(browser, dev);
      } finally {
        // El frag se escribe SIEMPRE: un dispositivo caído no se lleva sus capturas.
        writeFileSync(
          join(OUT_DIR, `_frag-${dev.id}.json`),
          JSON.stringify(collected.filter((m) => m.device === dev.id), null, 1),
        );
        writeFileSync(join(OUT_DIR, "_fallos.json"), JSON.stringify(failures, null, 1));
      }
    });
  }

  test("agregado: metricas.json + index.html", async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const all: Metrics[] = [];
    for (const f of readdirSync(OUT_DIR).filter((f) => f.startsWith("_frag-"))) {
      all.push(...(JSON.parse(readFileSync(join(OUT_DIR, f), "utf8")) as Metrics[]));
    }
    all.sort(
      (a, b) =>
        DEVICES.findIndex((d) => d.id === a.device) - DEVICES.findIndex((d) => d.id === b.device) ||
        a.orient.localeCompare(b.orient) ||
        STATES.indexOf(a.state as (typeof STATES)[number]) -
          STATES.indexOf(b.state as (typeof STATES)[number]),
    );
    let fallos: string[] = [];
    try {
      fallos = JSON.parse(readFileSync(join(OUT_DIR, "_fallos.json"), "utf8")) as string[];
    } catch {
      /* sin fallos registrados */
    }
    writeFileSync(
      join(OUT_DIR, "metricas.json"),
      JSON.stringify(
        {
          generado: new Date().toISOString(),
          umbralTarget: SUELO_TACTIL,
          devices: DEVICES,
          estados: STATES,
          estadosNoCapturados: fallos,
          capturas: all,
        },
        null,
        1,
      ),
    );
    writeFileSync(join(OUT_DIR, "index.html"), contactSheet(all, fallos));
    expect(all.length).toBeGreaterThan(0);
  });
});

// ── Contact sheet ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function contactSheet(all: Metrics[], fallos: string[] = []): string {
  const byDev = new Map<string, Metrics[]>();
  for (const m of all) {
    if (!byDev.has(m.device)) byDev.set(m.device, []);
    byDev.get(m.device)!.push(m);
  }
  const card = (m: Metrics): string => {
    const r = m.regions;
    const worst = [...m.buttons].filter((b) => b.small).sort((a, b) => a.w * a.h - b.w * b.h).slice(0, 4);
    const flag = (cond: boolean, txt: string): string =>
      cond ? `<li class="bad">${esc(txt)}</li>` : "";
    return `<figure>
  <img src="${m.device}-${m.orient}-${m.state}.png" alt="${esc(m.device + " " + m.orient + " " + m.state)}" loading="lazy">
  <figcaption>
    <b>${esc(m.state)}</b> · ${m.viewport.w}×${m.viewport.h} @${m.viewport.dpr}x · ${esc(m.orient)}
    <ul>
      <li>canvas: ${r.canvas ? `${r.canvas.w}×${r.canvas.h} — ${r.canvas.areaPct}% área (${r.canvas.wPct}% ancho / ${r.canvas.hPct}% alto)` : "—"}</li>
      <li>deck: ${r.deck ? `${r.deck.w}×${r.deck.h} — ${r.deck.areaPct}%` : "—"} · útil: ${r.util ? `${r.util.h}px (${r.util.areaPct}%)` : "—"}</li>
      <li>cromo restante: ${m.chromeRestPct}%</li>
      <li>targets: ${m.buttons.length} · &lt;44px: <b class="${m.smallTargets ? "bad" : "ok"}">${m.smallTargets}</b>${worst.length ? " — " + esc(worst.map((b) => `${b.label} ${b.w}×${b.h}`).join(", ")) : ""}</li>
      ${m.cmdScroll ? `<li>comandos scroll: ${m.cmdScroll.client}/${m.cmdScroll.total}px${m.belowFold.length ? ` · ${m.belowFold.length} bajo el pliegue` : ""}</li>` : ""}
      ${flag(m.overflow.hDoc, `OVERFLOW-H del documento: ${m.overflow.scrollW} > ${m.overflow.clientW}`)}
      ${flag(m.clippedLabels.length > 0, `rótulos recortados: ${m.clippedLabels.join(" | ")}`)}
      ${flag(m.outsideViewport.length > 0, `fuera del viewport: ${m.outsideViewport.slice(0, 4).join(" | ")}`)}
      ${m.notes.map((n) => `<li class="note">${esc(n)}</li>`).join("")}
    </ul>
  </figcaption>
</figure>`;
  };
  const sections = DEVICES.filter((d) => byDev.has(d.id))
    .map((d) => {
      const ms = byDev.get(d.id)!;
      const block = (orient: string): string =>
        `<h3>${esc(orient)}</h3><div class="grid">${ms
          .filter((m) => m.orient === orient)
          .sort(
            (a, b) =>
              STATES.indexOf(a.state as (typeof STATES)[number]) -
              STATES.indexOf(b.state as (typeof STATES)[number]),
          )
          .map(card)
          .join("\n")}</div>`;
      return `<section><h2>${esc(d.label)} <code>${esc(d.id)}</code> · DPR ${d.dpr}</h2>${block("portrait")}${block("landscape")}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Auditoría UI/UX móvil — OpenU5 (2026-07-25)</title>
<meta name="robots" content="noindex">
<style>
 :root { color-scheme: dark; }
 body { margin:0; padding:24px; background:#14161a; color:#e6e6e6; font:13px/1.45 -apple-system,system-ui,sans-serif; }
 h1 { font-size:20px; } h2 { font-size:16px; margin:32px 0 4px; border-bottom:1px solid #333; padding-bottom:6px; }
 h3 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:#9aa; margin:18px 0 8px; }
 code { background:#222; padding:1px 5px; border-radius:3px; color:#9cf; }
 .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }
 figure { margin:0; background:#1c1f24; border:1px solid #2c3037; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; }
 img { width:100%; height:auto; display:block; background:#000; border-bottom:1px solid #2c3037; }
 figcaption { padding:8px 10px; font-size:11.5px; }
 ul { margin:6px 0 0; padding-left:16px; }
 li { margin:2px 0; }
 .bad { color:#ff8f7a; } .ok { color:#8ede9a; } .note { color:#9aa; }
 .legend { background:#1c1f24; border:1px solid #2c3037; border-radius:8px; padding:12px 16px; max-width:70ch; }
</style></head><body>
<h1>Auditoría UI/UX móvil — OpenU5 · 2026-07-25</h1>
<div class="legend">
 <p>Matriz de 7 dispositivos × 2 orientaciones × 6 estados. Rotación <b>en caliente</b>
 (<code>setViewportSize</code>), contextos con <code>isMobile+hasTouch</code> y DPR real.
 Umbral de target táctil = <b>${SUELO_TACTIL}×${SUELO_TACTIL} px CSS</b>. Métricas completas en
 <code>metricas.json</code>.</p>
 <p>Estados: <b>mundo</b> (overworld jugable) · <b>deck</b> (hoja A–Z alzada) ·
 <b>drawer</b> (menú SISTEMA, lo que abre el ☰) · <b>ztats</b> (lista larga) ·
 <b>combate</b> (tablero) · <b>intro-nombre</b> (creación, caso del teclado).</p>
 ${fallos.length ? `<p class="bad">No capturados: ${esc(fallos.join(" · "))}</p>` : ""}
</div>
${sections}
</body></html>`;
}
