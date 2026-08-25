/**
 * GRAND TOUR — CAPÍTULO 4: Trinsic (loc 6).
 *
 * Town amurallado y CORPUS-RELEVANTE: Sindar enseña la Word of Power INFAMA (dungeon
 * SHAME) — este capítulo la extrae por DIÁLOGO real (keyword "word" → "INFAMA !"),
 * verificando el hecho de corpus `wop-shame`. Cadena: importa el checkpoint REAL de ch03
 * (Avatar tras Britain: 50 oro, INT 22) → posicionamiento de arnés → (E)nter REAL de
 * Trinsic → recorrido determinista por mecanismos REALES (nav.ts + helpers locales):
 *   · (T)alk con los 4 vecinos towne (Woolfe/Sindar/Jimmy/Gruman) — dialogNumber==npcIndex.
 *   · Sindar: interacción de keyword LOCAL (askNpcWord) → cubre npc-towne-32 Y word-infama.
 *   · (L)ook de la señal, (S)earch del objeto oculto, (K)limb multi-planta.
 *   · VISITA real de los 3 shoppes (talk→ShopPanel→Leave): Blacksmith 129, Healer 135,
 *     HorseSeller 131 → shop-4/34/18. La COMPRA byte-exacta ya se ejerce en ch03 (Britain);
 *     con 50 oro post-Britain ningún ítem del herrero de Trinsic es asequible (el más
 *     barato, Large Shield, 93 gp @INT22), así que los shoppes se cubren por VISITA.
 *   · Comandos ejercitados de verdad → command-e/t/l/s/k (ruling C tour-wide).
 *
 * TOPOLOGÍA (hallazgo): la PLANTA 1 de Trinsic está PARTICIONADA en componentes aislados,
 * cada uno alcanzable SÓLO por su escalera desde planta 0. El HorseSeller vive en un stall
 * aislado (componente de 20 tiles) al que sólo se llega por la escalera (6,6); el resto de
 * la planta 1 (search 24,6 + vecinos) es el componente grande, alcanzable por (22,6) y
 * otras. `goToFloor` elige la escalera MÁS CERCANA y por tanto es AMBIGUO aquí; se navega
 * cada sala por su escalera EXPLÍCITA (climbVia). Reportado al owner como hueco de infra
 * (afecta a cualquier town con planta partida, p.ej. ch05).
 *
 * Cobertura: se asevera DETERMINISTA (byte-idéntica ×3), no un número fijo (ruling A).
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, goToFloor, goToCell, klimb, readSign, talkToNpc, walkTo, getPos, isConsoleTalk, readDialogText, type Pos } from "./nav";
import { tecla } from "../tempo-video.mjs";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const TRINSIC = 6;
// Mercaderes de Trinsic (SHOP_TYPES en main.ts: 0x81/0x83/0x87) → shoppes del manifiesto.
const BLACKSMITH = 129; // 0x81 → shop-4  The Paladin's Protectorate (planta 0)
const HORSE = 131; //      0x83 → shop-18 Horse & Rider      (stall aislado planta 1, escalera 6,6)
const HEALER = 135; //     0x87 → shop-34 Wounds of Honour   (planta 0)

type Dir = "up" | "down" | "left" | "right";
const ARROW: Record<Dir, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const dirOf = (dx: number, dy: number): Dir => (dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right");
/** Copia local de la tecla del tour (ver nav.ts): cadencia 0 en test, humana en cine. */
const press = async (page: Page, key: string): Promise<void> => {
  await page.locator("body").press(key);
  const ms = tecla(0);
  if (ms > 0) await page.waitForTimeout(ms);
};

/** Posición viva de un NPC/mercader por dialogNumber, en CUALQUIER planta de la loc actual. */
function locateNpc(page: Page, dn: number): Promise<{ x: number; y: number; floor: number } | null> {
  return page.evaluate((d) => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const loc = g.state.position.location;
    for (const f of [0, 1, -1, 2, 3]) {
      const n = (g.npcManager?.npcsAt(loc, f) ?? []).find((npc: any) => npc.dialogNumber === d);
      if (n) return { x: n.x, y: n.y, floor: f };
    }
    return null;
  }, dn);
}

/**
 * Entra a la sala de PLANTA 1 servida por la escalera EXACTA en (lx,ly). Necesario porque
 * la planta 1 de Trinsic está PARTIDA en componentes y `goToFloor` (escalera más cercana)
 * es ambiguo. Normaliza a planta 0 ANTES de subir (un mercader/NPC deambulante pudo dejar
 * a la party arriba, en el componente equivocado), luego pisa la escalera-up y (K)limba.
 */
async function enterFloor1Room(page: Page, lx: number, ly: number): Promise<Pos> {
  await goToFloor(page, 0); // baja a planta 0 (base común de todas las escaleras-up)
  await walkTo(page, lx, ly); // pisa la escalera-up de ESA sala
  await klimb(page);
  const after = await getPos(page);
  expect(after.floor, `(K)limb en (${lx},${ly}) debe subir a la planta 1`).toBe(1);
  return after;
}

/**
 * Aproxima al NPC/mercader `dn` (si está en OTRA planta, sube/baja a ella) y emite (T)alk
 * en su dirección, dejando el panel (diálogo o tienda) abierto. Primitiva local que
 * comparten askNpcWord y visitShop. NO toca nav.ts (compone walkTo/goToFloor/getPos).
 * OJO: asume que el NPC está en el componente de planta ALCANZABLE desde la party (el
 * llamador coloca a la party en el componente correcto vía climbVia).
 */
async function approachAndTalk(page: Page, dn: number): Promise<void> {
  for (let it = 0; it < 10; it++) {
    const t = await locateNpc(page, dn);
    if (!t) throw new Error(`approachAndTalk(${dn}): no está en la localización`);
    // COMPONENT-AWARE (robustez permanente, alineada con ch05/06): goToCell cruza escaleras y
    // particiones a la celda VIVA del NPC en CUALQUIER planta. Con la hora canónica DIURNA (arnés
    // B') los mercaderes están en el mostrador de z0 y esto es byte-neutral vs el goToFloor+walkTo
    // plano; pero blinda el capítulo si un NPC está en z1 (higiene, no depende del reloj). Si el
    // NPC deambuló durante el viaje, goToCell puede fallar → re-localiza y reintenta (acotado).
    try {
      await goToCell(page, t.x, t.y, t.floor, { adjacent: true });
    } catch {
      continue;
    }
    const h = await getPos(page);
    const now = await locateNpc(page, dn);
    if (!now || Math.abs(now.x - h.x) + Math.abs(now.y - h.y) !== 1) continue; // se movió: reintenta
    await press(page, "t");
    await press(page, ARROW[dirOf(now.x - h.x, now.y - h.y)]);
    return;
  }
  throw new Error(`approachAndTalk(${dn}): no se pudo enganchar (deambulante)`);
}

/**
 * Techo wall-clock GENEROSO de estos helpers inline (task #8): salvaguarda anti-cuelgue,
 * NO mecanismo de sync — la sync la da la CONDICIÓN (panel visible/oculto, respuesta
 * presente). Amplio para absorber picos de carga sin falso negativo (que dispararía el
 * retry `continue` y podría quemar turnos → deriva). Alinea estos duplicados inline con
 * los techos de nav.ts. Conducta idéntica: mismas teclas, mismos reintentos.
 */
const CEIL_MS = 15_000;

/**
 * Pregunta un keyword a un NPC conversable y asevera que su respuesta contiene `wordRe`
 * (Sindar + "word" → "INFAMA !"). Cierra el diálogo por el mecanismo real ("bye", con
 * fallback Escape/blur para teachers). LOCAL hasta que aterrice `talkToNpcAsking` compartido.
 */
async function askNpcWord(page: Page, dn: number, keyword: string, wordRe: RegExp): Promise<void> {
  const dialog = page.locator(".dialogue-panel:visible");
  // Señal LÓGICA de charla abierta, INDEPENDIENTE DE PIEL (task #8): en DEV el panel DOM se
  // marca visible; en FIEL/SHADER la conversación va por CONSOLA (sin panel) y `dialogueOpen()`
  // refleja `conversation != null`, armado SÍNCRONO en el keydown del (T)alk. Este helper LOCAL
  // conducía SÓLO el panel DOM (roto en la piel fiel por defecto, donde Talk es consola —
  // censo-ui-flujos §2); ahora conduce AMBAS presentaciones, como los helpers de nav.ts.
  const talkOpen = (): Promise<boolean> =>
    page.evaluate(() => (window as unknown as { __u5test: { dialogueOpen: () => boolean } }).__u5test.dialogueOpen());
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dn);
    if (!(await talkOpen())) continue; // el NPC se movió antes del (T)alk → reintenta (re-approach)
    if (await isConsoleTalk(page)) {
      // Piel fiel/shader: la keyword se TECLEA por el getstring de consola (main.ts handler
      // `text`); la respuesta y el prompt salen por la consola. La conversación es TURN-NEUTRAL
      // (verificado byte a byte: seed/NPCs/turnos idénticos al panel DOM) → cero deriva del sello.
      await page.keyboard.type(keyword);
      await page.keyboard.press("Enter");
      await expect.poll(() => readDialogText(page, dialog), { timeout: CEIL_MS }).toMatch(wordRe);
      await page.keyboard.type("bye");
      await page.keyboard.press("Enter");
      if (await talkOpen()) await page.keyboard.press("Escape"); // NPC especial que re-pregunta al "bye"
      await expect.poll(() => talkOpen(), { timeout: CEIL_MS }).toBe(false);
      return;
    }
    // Piel dev: panel DOM (chat con input libre).
    const input = dialog.locator("input");
    await input.fill(keyword);
    await input.press("Enter");
    await expect(dialog, `${dn} debe responder ${wordRe} a "${keyword}"`).toContainText(wordRe, { timeout: CEIL_MS });
    await input.fill("bye");
    await input.press("Enter");
    if (await dialog.isVisible().catch(() => false)) {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("Escape");
    }
    await expect(dialog).toBeHidden({ timeout: CEIL_MS });
    return;
  }
  throw new Error(`askNpcWord(${dn}): no se pudo dialogar (deambulante)`);
}

/** VISITA real un shoppe: habla al mercader `dn` (abre la tienda) y sale sin comprar.
 *  Cubre el ítem shop-* por interacción REAL. Mode-aware: en piel dev cierra el ShopPanel
 *  DOM con "Leave"; en fiel/shader la tienda va por CONSOLA (menú por tecla) y se sale con
 *  Space (despedida). LOCAL a ch04. */
async function visitShop(page: Page, dn: number): Promise<void> {
  const shopOpen = (): Promise<boolean> =>
    page.evaluate(() => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false);
  const consoleShop = await isConsoleTalk(page);
  const panel = page.locator(".save-panel:visible").filter({ has: page.locator(".shop-leave") });
  for (let attempt = 0; attempt < 8; attempt++) {
    await approachAndTalk(page, dn);
    if (consoleShop) {
      if (!(await shopOpen())) continue; // el mercader deambuló: reintenta el enganche
      // Salida por tipo (carril cadenas-presentacion): los tipos no-herrero arman el
      // GATE Y/N del saludo (C4) — 'n' despide; el gate del CURANDERO además RE-LEE
      // Space (SHOPPES 0x1510), así que Space solo no cerraba. El HERRERO arma la
      // PAUSA de pacing (getkey 0x83dc): la 'n' se DESCARTA (continúa al menú
      // Buy/Sell) y el Space posterior despide. Bucle corto: n+Space hasta cerrar.
      for (let sp = 0; sp < 3 && (await shopOpen()); sp++) {
        await page.keyboard.press("n");
        await page.waitForTimeout(120);
        if (!(await shopOpen())) break;
        await page.keyboard.press("Space");
        await page.waitForTimeout(200);
      }
      await page.waitForFunction(
        () => ((window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false) === false,
        undefined,
        { timeout: CEIL_MS },
      );
      return;
    }
    if (!(await panel.isVisible().catch(() => false))) {
      if (!(await panel.waitFor({ state: "visible", timeout: CEIL_MS }).then(() => true).catch(() => false))) continue;
    }
    await panel.locator(".shop-leave").click();
    await expect(panel).toBeHidden({ timeout: CEIL_MS });
    return;
  }
  throw new Error(`visitShop(${dn}): no abrió la tienda`);
}

test.describe.serial("GT ch04 — Trinsic (loc 6)", () => {
  test("recorre Trinsic por mecanismos reales (NPCs, señal, search, 3 shoppes, INFAMA) y exporta", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch03 (Avatar tras Britain: 50 oro, INT 22). HORA CANÓNICA
    //     DECLARADA (arnés B'): 18:15 = hora NATIVA DIURNA de este capítulo (mercaderes de Trinsic
    //     en su mostrador de z0 — el herrero sube a z1 a las 19:00). El pin ANULA la deriva del
    //     predecesor (mi B+C de ch03 sale a las 22:59, que metía a Trinsic en la noche y subía a
    //     los mercaderes a z1); con 18:15 el estado importado (oro/karma/llaves) es idéntico al
    //     sello original salvo el reloj, que aquí se fija → re-sella byte-idéntico a 318cf0de.
    await importCheckpoint(page, "ch03", { entryClock: { hour: 18, minute: 15 } });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const gold0 = await page.evaluate(() => (window as unknown as { __u5test: { state: () => { gold: number } } }).__u5test.state().gold);
    expect(gold0).toBe(50); // el estado de ch03 viajó por la cadena

    const cov = new Coverage("ch04");

    // (2) Posicionamiento de arnés + (E)nter REAL. Trinsic recibe en (15,30) z0.
    const entry = await enterLocation(page, TRINSIC);
    expect(entry).toMatchObject({ location: 6, floor: 0, x: 15, y: 30 });
    cov.mark("location-6-trinsic").mark("floor-6-z0").mark("command-e");

    // (2b) SEÑAL (15,28) — LEÍDA DE DÍA, JUSTO TRAS LA ENTRADA (18:15). La señal está a 2
    //      casillas al norte de la entrada (15,30), en z0, con la reja ABIERTA. Se lee AQUÍ (y
    //      no tras los shoppes/NPCs como antes) porque #48 (reja/puente de poblado por HORA,
    //      TOWN 0x0170, commit 66f69d7) convierte a las 20:00 el vecino SUR del arco 0x87 en
    //      (16,27) → 0x99 Portcullis intransitable en (16,28), SELLANDO el acceso a la señal de
    //      noche. El recorrido llegaba al readSign a las ~20:14 (reja ya cerrada) → señal
    //      inalcanzable. La reja es FIEL (#48 no toca el RNG); el capítulo se adapta leyendo la
    //      señal mientras la reja está abierta. El mundo es fiel por ambos lados. (Re-sello 2beae0b↓)
    expect(await readSign(page, 15, 28, "LAW OF HONOR"), "la señal (15,28) debe leerse de día").toBe(true);
    cov.mark("sign-6-15-28").mark("command-l");

    // (3) HorseSeller PRIMERO: vive en un stall aislado de planta 1 alcanzable SÓLO por la
    //     escalera (6,6); al entrar está en planta 1 (diag). Sube por ESA escalera, visita,
    //     y baja. (Hacerlo primero garantiza que 131 sigue en el stall, cero deriva de horario.)
    const up1 = await enterFloor1Room(page, 6, 6);
    expect(up1.floor).toBe(1);
    cov.mark("floor-6-z1").mark("command-k");
    await visitShop(page, HORSE);
    cov.mark("shop-18-horse-rider");
    await goToFloor(page, 0); // baja de vuelta a planta 0 para el resto del recorrido

    // (4) Planta baja: Jimmy(33), Sindar(32)+INFAMA, señal, Blacksmith, Healer. Con la hora
    //     canónica DIURNA (arnés B') los mercaderes están en su mostrador de z0; el {recoverPartition}
    //     es robustez de regalo (byte-neutral de día, blinda si un NPC estuviera en z1).
    await talkToNpc(page, 33, { recoverPartition: true }); // Jimmy
    cov.mark(npcManifestId("towne", 33)).mark("command-t");
    await askNpcWord(page, 32, "word", /INFAMA/); // Sindar → npc + word-infama
    cov.mark(npcManifestId("towne", 32)).mark("word-infama");
    // (b) NORMALIZA la planta antes de los shoppes (regla estructural del tour — ver README): un
    //     (T)alk previo puede haber ARRASTRADO a la party a otra planta (un NPC que estaba en z1).
    //     La señal ya se leyó de día en (2b); aquí sólo se garantiza z0 para el resto del guion.
    await goToFloor(page, 0);
    await visitShop(page, BLACKSMITH);
    cov.mark("shop-4-the-paladin-s-protectorate");
    await visitShop(page, HEALER);
    cov.mark("shop-34-wounds-of-honour");

    // (5) Componente GRANDE de planta 1 (search + vecinos), por su escalera (22,6). El (S)earch
    //     (posición FIJA) DECLARA su planta con enterFloor1Room(22,6) — nunca asume la planta del
    //     paso anterior — y va PRIMERO con la party garantizada en ese componente; luego los
    //     vecinos towne 31/34 (floor-aware: el motor los localiza donde deambulen).
    await enterFloor1Room(page, 22, 6);
    const searchLog = await faceCommand(page, "s", 24, 6);
    expect(searchLog.join(" ").length, "(S)earch (24,6) debe reportar algo").toBeGreaterThan(0);
    cov.mark("search-54-loc6-24-6").mark("command-s");
    await talkToNpc(page, 31, { recoverPartition: true }); // Woolfe
    cov.mark(npcManifestId("towne", 31));
    await talkToNpc(page, 34, { recoverPartition: true }); // Gruman
    cov.mark(npcManifestId("towne", 34));

    // (6) Cobertura declarada (18 ítems reales) + nota del techo. Se asevera el conteo
    //     DETERMINISTA (byte-idéntico ×3), no un número fijo (ruling A).
    cov.note(
      "Trinsic (loc 6): pueblo amurallado pequeño con poco contenido enumerable. Cubre 18 " +
        "ítems REALES: location-6 + floor z0/z1 + npc-towne 31/32/33/34 + sign-6-15-28 + " +
        "search-54 + shop-4/18/34 (VISITA real; la compra byte-exacta se ejerce en ch03, y " +
        "Trinsic con 50 oro post-Britain no tiene ítem asequible) + word-infama (Sindar, " +
        "keyword 'word'→INFAMA, corpus wop-shame) + comandos e/t/l/s/k. NOTA topología: la " +
        "planta 1 está partida en componentes por escalera; el HorseSeller es un stall aislado " +
        "(escalera 6,6). Reportado al owner como hueco de infra (goToFloor ambiguo en plantas partidas).",
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBe(18); // conteo determinista (ruling A)

    // (7) Checkpoint nativo por el camino real (botón "Export .GAM").
    const { gam } = await exportCheckpoint(page, "ch04");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(6); // el checkpoint refleja Trinsic
  });

  test("el ch04.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)

    const { gam, sidecar } = readCheckpointFiles("ch04");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );

    expect(await getPos(page)).toMatchObject({ location: 6 });
  });
});
