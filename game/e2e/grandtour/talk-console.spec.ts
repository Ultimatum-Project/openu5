/**
 * (T)alk por CONSOLA en la piel FIEL/SHADER — fidelidad de presentación de la conversación.
 *
 * El binario NUNCA abre ventana — **VIGENTE, MEDIDO en #327** (el mismo absoluto es FALSO para
 * TIENDA y allí se retiró; para TALK resiste el censo: CERO `set_text_window` (kernel 0x1c22) y
 * CERO glifos de marco en TALK.OVL, contra 2 y siete en SHOPPES/SHOPPES3). Acota el sujeto: no
 * abre ventana la CONVERSACIÓN; la rama de MERCADER sale a SHOPPES (ret 2) y ésa sí la abre.
 * La conversación entera ocurre en la CONSOLA del marco EGA
 * (TALK.OVL 0x041c → texto del NPC por print_string 0x1850; la keyword se TECLEA inline con
 * getstring, ecoada tras ':', prompts "Your interest?"/"You respond-" de DATA.OVL
 * PHRASES_CONVERSATION [0x0c]/[0x11]). El DialoguePanel DOM (chat con historial + chips) es QoL
 * EXCLUSIVO de la piel dev (patrón del fix de viewgem #76, DOM sólo dev). censo-ui-flujos §2.
 *
 * Este spec conduce la conversación DESDE LA TECLA en piel fiel:
 *   1. (T) a un NPC conversable → la charla arranca EN CONSOLA (sin panel DOM); se teclea una
 *      keyword y su respuesta aterriza en la consola; "bye" cierra.
 *      ⚠ #180·D6: la apertura con NPC DESCONOCIDO tiene TRES ramas (TALK 0x111c-0x117f) y
 *      puede traer AskName EN la apertura («What is thy name?»). El arnés (nav.ts
 *      talkToNpcAsking) contesta ese getstring y manda la keyword al prompt real.
 *   2. (T) a un MERCADER → abre la TIENDA por CONSOLA (menú por tecla), NO el chat de consola
 *      ni el panel DOM: ret 2 del dispatcher entra al carril Tiendas (§3, shops-console).
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
 * verde documentado: 2026-07-17, el día que nació (gates de b78cd604). Un rojo en la
 * primera ventana es deriva acumulada sin vigilancia, no regresión fresca — se adjudica,
 * no se silencia re-excluyéndolo.
 */
import { test, expect, type Page } from "@playwright/test";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, talkToNpcAsking, getPos } from "./nav";

const TRINSIC = 6;

const dialogueOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { dialogueOpen: () => boolean } }).__u5test.dialogueOpen());

const dialogueConsole = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { dialogueConsole: () => boolean } }).__u5test.dialogueConsole());

const consoleText = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().join("\n"),
  );

/** dialogNumber del primer NPC CONVERSABLE (script TLK: 1..0x7f) en la planta actual. */
const pickTalkable = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { position: { location: number; floor: number } }; npcManager?: { npcsAt: (l: number, f: number) => { dialogNumber: number }[] } } } }).__u5test.game;
    const p = g.state.position;
    for (const n of g.npcManager?.npcsAt(p.location, p.floor) ?? []) {
      if (n.dialogNumber >= 1 && n.dialogNumber < 0x81) return n.dialogNumber;
    }
    return -1;
  });

/** Celda ACTUAL de un MERCADER (dialogNumber 0x81..0x88) en la planta actual, o null. */
const pickMerchantCell = (page: Page): Promise<{ x: number; y: number } | null> =>
  page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { position: { location: number; floor: number } }; npcManager?: { npcsAt: (l: number, f: number) => { dialogNumber: number; x: number; y: number }[] } } } }).__u5test.game;
    const p = g.state.position;
    for (const n of g.npcManager?.npcsAt(p.location, p.floor) ?? []) {
      if (n.dialogNumber >= 0x81 && n.dialogNumber <= 0x88) return { x: n.x, y: n.y };
    }
    return null;
  });

/** ¿Hay una tienda abierta en CUALQUIER presentación (panel DOM dev o consola fiel)? */
const shopOpenHook = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false);

test.describe("(T)alk por consola — piel fiel", () => {
  test("T → conversación EN CONSOLA → keyword tecleada → respuesta → bye", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page); // piel FIEL por defecto (post-fase 2)
    await enterLocation(page, TRINSIC);

    // Esta piel conversa por CONSOLA (no hay panel DOM).
    expect(await dialogueConsole(page), "la piel fiel debe conversar por consola").toBe(true);

    const npc = await pickTalkable(page);
    expect(npc, "debe haber un NPC conversable en Trinsic").toBeGreaterThan(0);

    // Habla y pregunta "name" por el MECANISMO REAL (arnés console-aware: teclea la keyword por
    // el getstring de consola y lee la respuesta de `consoleLines()`). Devuelve la charla vista.
    const resp = await talkToNpcAsking(page, npc, "name");

    // El prompt de keyword FIEL ("Your interest?\n:") se imprimió, y el NPC declaró su nombre
    // ("My name is …", DATA.OVL PHRASES_CONVERSATION MY_NAME_IS).
    expect(
      resp,
      "la consola muestra el prompt de keyword — FIEL por TALK 0x0b14 (`mov ax,0x9408` dentro del " +
        "bucle 0x0b04) y DATA.OVL PHRASES_CONVERSATION[0x0c] (approved-strings.json)",
    ).toContain("Your interest?");
    expect(resp, "la respuesta a 'name' declara el nombre del NPC").toContain("My name is");

    // La charla se cerró con "bye" y NUNCA existió el panel DOM de diálogo (DOM sólo dev).
    expect(await dialogueOpen(page), "la conversación terminó tras 'bye'").toBe(false);
    expect(await page.locator(".dialogue-panel:visible").count(), "sin panel DOM en piel fiel").toBe(0);
  });

  test("T a un MERCADER abre la TIENDA por CONSOLA (no chat, no panel DOM)", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await enterLocation(page, TRINSIC);

    // Acércate a un mercader y (T)alk. Re-lee su celda cada intento (los mercaderes deambulan)
    // y reintenta el enganche; en cuanto abre la tienda, paramos.
    let opened = false;
    for (let attempt = 0; attempt < 8 && !opened; attempt++) {
      const cell = await pickMerchantCell(page);
      if (!cell) break;
      await faceCommand(page, "t", cell.x, cell.y);
      opened = await shopOpenHook(page);
    }

    expect(opened, "(T)alk a un mercader debe abrir la tienda").toBe(true);
    // En piel fiel la tienda va por CONSOLA (menú por tecla), NO por el panel DOM (sólo dev).
    expect(await page.locator(".save-panel:visible").filter({ has: page.locator(".shop-leave") }).count(),
      "sin panel DOM de tienda en piel fiel").toBe(0);
    // Y NO es una conversación de charla: el getstring de keyword nunca se abrió.
    expect(await dialogueOpen(page), "el mercader NO abre conversación de charla").toBe(false);
    expect(await consoleText(page), "el mercader no imprime el prompt de keyword de charla").not.toContain(
      "Your interest?",
    );
  });
});
