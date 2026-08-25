/**
 * TIENDAS por CONSOLA en la piel FIEL/SHADER — fidelidad del MECANISMO de comercio.
 *
 * ~~El binario NUNCA abre ventana~~ **ABSOLUTO FALSO, retirado #327**: SHOPPES.OVL abre DOS
 * ventanas (`set_text_window`, kernel 0x1c22) y emite los SIETE glifos de marco por `putChar`
 * (0x16ba) — mismo censo que SHOPPES3 (posada) y ZSTATS. Las dos portadas: «Arms» del sell
 * del herrero y el GUEST REGISTER de la posada (#283, 02b3a158). Lo cierto es lo ACOTADO a la
 * tienda ordinaria: el mercader es una CONVERSACIÓN dentro del marco EGA
 * (SHOPPES*.OVL, ret 2 del dispatcher de Talk) — saluda y ofrece un menú POR TECLA
 * impreso por print_string (0x1850); la selección de ítem va por letra en la misma
 * consola y el resultado sale como línea de consola. El `ShopPanel` DOM (botones/inputs)
 * es QoL EXCLUSIVO de la piel dev (patrón de talk-console y del fix de viewgem #76).
 * censo-ui-flujos §3.
 *
 * Este spec conduce la compra DESDE LA TECLA en piel fiel:
 *   (T) a un herrero → menú por tecla (Buy/Sell) → 'b' → lista por letra → letra del
 *   ítem → el oro baja EXACTO por el precio etiquetado y el resultado sale por consola →
 *   Space cierra con la despedida. Sin panel DOM en ninguna fase.
 *
 * ── DE QUIÉN ES ESTE SPEC (27-07, carril sellos) ────────────────────────────────────
 * De la SUITE DEV (`game/playwright.config.ts`, `npm run e2e`), NO del grand tour. Vive
 * en `e2e/grandtour/` sólo por los helpers de `nav.ts`: no es un capítulo — no encadena
 * checkpoints (ni `importCheckpoint` ni `exportCheckpoint`) y arranca fresco con
 * `bootWorld` + `enterLocation`. La config del tour sólo casa `/ch\d+[a-z]?-/`, así que
 * jamás lo recogió; y cuando `**\/grandtour\/**` entró al testIgnore de la suite dev
 * (d9e5e7b3, 07-25, por los capítulos y su re-sellado) se quedó SIN RUNNER NINGUNO —
 * escrito y muerto. El testIgnore ahora excluye `ch*.spec.ts`, no el directorio.
 *
 * ⚠ PENDIENTE-VALIDACIÓN-VENTANA: re-admitido SIN poder correrlo (HOLD de flota). Último
 * verde documentado: 2026-07-17, el día que nació (gates de a36b11e4). Un rojo en la
 * primera ventana es deriva acumulada sin vigilancia, no regresión fresca — se adjudica,
 * no se silencia re-excluyéndolo.
 */
import { test, expect, type Page } from "@playwright/test";
import { bootWorld, chapterTimeout, enterLocation } from "./nav";

const BRITAIN = 2; // el herrero (0x81) está en la planta 0 (Trinsic lo tiene en la 1)
const BLACKSMITH = 0x81;

interface ShopSnap {
  type: string;
  phase: string;
  options: { key: string; label: string }[];
}

const gold = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __u5test: { state: () => { gold: number } } }).__u5test.state().gold);

const shopSnap = (page: Page): Promise<ShopSnap | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __u5test: { shopConsole?: () => ShopSnap | null } }).__u5test.shopConsole?.() ?? null,
  );

const shopOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false);

const consoleText = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().join("\n"),
  );

const press = (page: Page, key: string): Promise<void> => page.locator("body").press(key);

/** Celda ACTUAL del mercader `dialogNumber` (deambula) en la planta actual, o null. */
const merchantCell = (page: Page, dn: number): Promise<{ x: number; y: number } | null> =>
  page.evaluate((d) => {
    const g = (
      window as unknown as {
        __u5test: {
          game: {
            state: { position: { location: number; floor: number } };
            npcManager?: { npcsAt: (l: number, f: number) => { dialogNumber: number; x: number; y: number }[] };
          };
        };
      }
    ).__u5test.game;
    const p = g.state.position;
    for (const n of g.npcManager?.npcsAt(p.location, p.floor) ?? []) {
      if (n.dialogNumber === d) return { x: n.x, y: n.y };
    }
    return null;
  }, dn);

/** Precio (gp) parseado de la etiqueta "Nombre — 53 gp". */
const priceOf = (label: string): number => {
  const m = label.match(/(\d+)\s*gp/);
  return m ? Number(m[1]) : NaN;
};

test.describe("Tiendas por consola — piel fiel", () => {
  test("T al herrero → menú por tecla → compra por letra → oro descontado en consola", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page); // piel FIEL por defecto (post-fase 2)
    await enterLocation(page, BRITAIN);

    // (T) al herrero (deambula): reintenta hasta que la tienda abre por CONSOLA.
    // ⚠ La party se COLOCA adyacente por estado (patrón shop.spec), no ANDANDO: desde
    // #304 (f4221678) plantarse junto a un tendero aiType 4 en tramo abierto abre la
    // tienda por PROXIMIDAD en ese mismo turno — llegar a pie consumía la intercepción
    // y la 't' posterior (getkey de pacing: CUALQUIER tecla) se comía la pausa que este
    // test asevera. El sujeto de este test es la vía (T)alk y su cadena de fases; la
    // vía de proximidad tiene su mecánica en el core (talk-shop). El teleport no
    // consume turno, así que no dispara la intercepción y la 't' llega la primera.
    let opened = false;
    for (let attempt = 0; attempt < 10 && !opened; attempt++) {
      const cell = await merchantCell(page, BLACKSMITH);
      if (!cell) break;
      await page.evaluate((c) => {
        const s = (window as unknown as { __u5test: { state: () => { position: { x: number; y: number } } } }).__u5test.state();
        s.position.x = c.x + 1;
        s.position.y = c.y;
      }, cell);
      await press(page, "t");
      await press(page, "ArrowLeft");
      opened = await shopOpen(page);
    }
    expect(opened, "(T) al herrero abre la tienda por consola").toBe(true);

    // Sin panel DOM en ninguna fase (DOM sólo dev).
    expect(
      await page.locator(".save-panel:visible").filter({ has: page.locator(".shop-leave") }).count(),
      "sin panel DOM de tienda en piel fiel",
    ).toBe(0);

    // PAUSA de pacing del saludo (getkey SHOPPES 0x12c3): cualquier tecla continúa
    // hacia la atribución `$ says,` + pregunta Buy/Sell (carril i18n-restos).
    let snap = await shopSnap(page);
    expect(snap?.type, "es el herrero").toBe("Blacksmith");
    expect(snap?.phase, "el welcome arma la pausa de pacing").toBe("blacksmith-pause");
    await press(page, "Enter");
    await expect.poll(async () => (await shopSnap(page))?.phase).toBe("menu");

    // El menú del herrero ofrece Buy/Sell POR TECLA.
    snap = await shopSnap(page);
    const buyKey = snap?.options.find((o) => o.label === "Buy")?.key;
    expect(buyKey, "el menú ofrece Buy por tecla").toBeTruthy();

    // 'b' → lista de compra por letra.
    await press(page, buyKey!);
    snap = await shopSnap(page);
    expect(snap?.phase, "'b' abre la lista de compra").toBe("buy-list");
    expect(snap?.options.length ?? 0, "el herrero tiene stock").toBeGreaterThan(0);

    // Elige el ítem ASEQUIBLE más barato para garantizar la compra.
    const goldBefore = await gold(page);
    const affordable = (snap?.options ?? [])
      .map((o) => ({ ...o, price: priceOf(o.label) }))
      .filter((o) => Number.isFinite(o.price) && o.price <= goldBefore)
      .sort((a, b) => a.price - b.price)[0];
    expect(affordable, `debe haber un ítem asequible con ${goldBefore} gp`).toBeTruthy();

    // Pulsa su letra → PITCH del ítem (buy_one_item 0x09ac, carril buy-herrero) + Y/N;
    // 'y' ejecuta la compra. El oro baja EXACTO y el `Sold!` sale por consola.
    await press(page, affordable!.key);
    await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-deal");
    await press(page, "y");
    await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list"); // re-lista
    const goldAfter = await gold(page);
    expect(goldBefore - goldAfter, "el oro bajó exactamente por el precio etiquetado").toBe(affordable!.price);
    // (El `Sold!` DS 0x7bb4 puede scrollear con la re-lista sincrónica: se asevera el
    // epílogo `"Anything else,` DS 0x7bbc, que queda visible.)
    expect(await consoleText(page), "el resultado de la compra sale por consola").toContain("Anything else,");

    // Space cierra con la despedida; la tienda se cierra (sin panel DOM jamás).
    await press(page, "Space");
    await page.waitForFunction(
      () => ((window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false) === false,
      undefined,
      { timeout: 15_000 },
    );
    expect(await shopOpen(page), "Space cierra la tienda").toBe(false);
    // Despedida fiel 1-de-4 (SHOPPES 0x0202; CON compra → tabla DS 0x3baa) + atribución
    // `says $.` (DS 0x785c). El registro es asset de EA → se asevera la atribución.
    expect(await consoleText(page), "la despedida sale por consola con su atribución").toContain("says Gwenneth.");
  });
});
