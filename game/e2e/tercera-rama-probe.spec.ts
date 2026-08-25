/**
 * EXPERIMENTO de la ventana `tercera-rama` — la ficha AH-1 de `ancla-herrero-acta.md` §4:
 * `ad04-g34` `shop:MagicSeller` (Moonglow, loc 1). La sonda de aquel carril declaró
 * `npcAt → slot 2 dlg 0x85` (el mercader, tipo VÁLIDO) **SOLO en su celda** (9,19), party en
 * la celda correcta (8,19), dirección correcta, on foot — y `shopOpen` falso en los DOS
 * intentos, idéntico en dos réplicas. Aquel acta acorraló el caso en «algo se traga la `t`».
 *
 * LA HIPÓTESIS QUE MIDIÓ ESTA SONDA era de INSTANTE, no de modo: la sonda de
 * `ancla-herrero` lee `npcAt` en el instante ANTERIOR al primer `t`, y el mercader de
 * Moonglow tiene **`aiTypes[1] = 4 = AI_MERCHANT`** en su tramo de horario de las 11:00-21:00
 * (`assets/npcs.json` loc 1 slot 2: times [17,11,21,23] · x [10,9,17] · y [21,19,14]).
 *
 * 🔴 **LA HIPÓTESIS ESTÁ REFUTADA, y por el propio modelo que la sostenía.** Este docblock
 * decía que `AI_MERCHANT` **HUYE** con la party a Manhattan < 4 de su PUESTO ⇒ que se MUEVE
 * cada turno en las dos ramas. Eso era el modelo VIEJO del clon: el 2026-08-06 (#82,
 * derivación en `re/notes/npc-aitype4-persigue.md`) se midió que el aiType 4 **PERSIGUE** —
 * `NPC.OVL 0x0824 cmp [bp-2],3 / jne 0x884` deja la rama de HUIDA **sólo para el 3**; el 4
 * cae en `0x0884`, cuyo `0x088c cmp [bx],ax / jge skip` exige candidata MENOR = ACERCARSE.
 * Con la party YA adyacente no hay celda más cercana a la que ir ⇒ el mercader **se queda
 * clavado en su puesto**, que es lo CONTRARIO de lo que este fichero daba por hecho.
 * MEDIDO en el árbol vivo (5 turnos de Pass con la party en (8,19), puesto (9,19)): 5 de 5
 * quieto. CONTROL con la party a Manhattan 7: SÍ se mueve (wander radio 3, 1 de 4 turnos).
 * ⇒ el mecanismo que este fichero proponía para AH-1 («el Talk cae sobre una celda que el
 * mercader acaba de dejar») NO puede ser la causa en el caso adyacente: adyacente es
 * justo el régimen en el que el mercader no se va. **La causa de AH-1 vuelve a estar
 * abierta** — sin adjudicar por este carril, que sólo re-basó la sonda a lo medido.
 *
 * Los tests son, en orden: el CONTROL POSITIVO (misma secuencia con un mercader FIJO ⇒ la
 * sonda sabe abrir tiendas por esta vía), el HECHO re-basado (con la party al lado el
 * AI_MERCHANT lo DEJA en su puesto) y la MEDICIÓN del caso (dónde está el mercader en cada
 * instante de la secuencia del resync). Sin el positivo, un «no engancha» no probaría nada.
 *
 * Se corre a mano (puerto propio, jamás 5199/5197):
 *   U5_E2E_PORT=5257 npx playwright test e2e/tercera-rama-probe.spec.ts --reporter=line
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame } from "./helpers";

/** Moonglow = location 1. MagicSeller = dialogNumber 0x85 (133), slot 2.
 *  Horario (assets/npcs.json): times [17,11,21,23] · x [10,9,17] · y [21,19,14] · z [1,0,1]
 *  · ai [0,4,1]. A las 12:00 el índice es 1 ⇒ puesto (9,19) planta 0 y **aiType 4**. */
const MOONGLOW = 1;
const MAGIC_DLG = 0x85;
const PUESTO = { x: 9, y: 19 };
/** La celda en la que el resync del espejo planta a la party (adyacente al puesto). */
const PARTY = { x: 8, y: 19 };

/** Minoc = location 5, Healer 0x87: el control positivo de `ancla-herrero-acta.md` §1. */
const MINOC = 5;
const HEALER_DLG = 0x87;
const HEALER_PUESTO = { x: 6, y: 26 };

type NpcPos = { slot: number; x: number; y: number; dialogNumber: number };

const npcs = (page: Page, loc: number, floor = 0): Promise<NpcPos[]> =>
  page.evaluate(
    ({ l, f }) =>
      (
        (
          window as unknown as {
            __u5test: { game: { npcManager?: { npcsAt: (l: number, f: number) => NpcPos[] } } };
          }
        ).__u5test.game.npcManager?.npcsAt(l, f) ?? []
      ).map((n) => ({ slot: n.slot, x: n.x, y: n.y, dialogNumber: n.dialogNumber })),
    { l: loc, f: floor },
  );

const buscar = (list: NpcPos[], dlg: number): NpcPos | undefined => list.find((n) => n.dialogNumber === dlg);

/** La MISMA llamada que hace `startTalk` (`src/main.ts:2406`), no una reimplementación. */
const npcAt = (page: Page, loc: number, floor: number, x: number, y: number): Promise<{ slot: number; dlg: number } | null> =>
  page.evaluate(
    ({ l, f, x, y }) => {
      const hit = (
        window as unknown as {
          __u5test: {
            game: {
              npcManager?: {
                npcAt: (l: number, f: number, x: number, y: number) => { slot: number; dialogNumber: number } | null;
              };
            };
          };
        }
      ).__u5test.game.npcManager?.npcAt(l, f, x, y);
      return hit ? { slot: hit.slot, dlg: hit.dialogNumber } : null;
    },
    { l: loc, f: floor, x, y },
  );

const teleport = (page: Page, loc: number, x: number, y: number): Promise<void> =>
  page.evaluate(
    ({ l, x, y }) =>
      (
        window as unknown as { __u5debug: { teleportSmallMap: (l: number, f: number, x: number, y: number) => void } }
      ).__u5debug.teleportSmallMap(l, 0, x, y),
    { l: loc, x, y },
  );

const shopOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean((window as unknown as { __u5test?: { shopOpen?: () => boolean } }).__u5test?.shopOpen?.()));

/** MISMA secuencia de teclas que el resync del espejo (`runner.ts:2452-2470`): Escape ×2 de
 *  limpieza, (T)alk, flecha de dirección, settle de 400 ms. */
async function talkHacia(page: Page, flecha: string): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("t");
  await page.waitForTimeout(120);
  await page.keyboard.press(flecha);
  await page.waitForTimeout(400);
}

test.describe("tercera-rama — el mercader de Moonglow que la sonda ve y el Talk no encuentra", () => {
  test("CONTROL POSITIVO: mismo camino de teclas con el Healer de Minoc → la tienda ABRE", async ({ page }) => {
    await gotoGame(page, { loc: MINOC, floor: 0, x: 10, y: 26, hour: 9 });
    await teleport(page, MINOC, HEALER_PUESTO.x, HEALER_PUESTO.y - 1);
    await page.waitForTimeout(150);
    const antes = buscar(await npcs(page, MINOC), HEALER_DLG);
    test.skip(antes?.x !== HEALER_PUESTO.x || antes?.y !== HEALER_PUESTO.y, "el healer no está en su puesto");
    await talkHacia(page, "ArrowDown");
    expect(await shopOpen(page), "la secuencia del resync SÍ sabe abrir tiendas").toBe(true);
  });

  test("EL HECHO (#82): con la party adyacente, el AI_MERCHANT DEJA al mercader en su puesto", async ({ page }) => {
    await gotoGame(page, { loc: MOONGLOW, floor: 0, x: PARTY.x, y: PARTY.y, hour: 12 });
    await teleport(page, MOONGLOW, PARTY.x, PARTY.y);
    await page.waitForTimeout(150);

    const tras = buscar(await npcs(page, MOONGLOW), MAGIC_DLG)!;
    expect({ x: tras.x, y: tras.y }, "el enterMap del teleport lo deja en su PUESTO").toEqual(PUESTO);

    // TRES turnos de juego (Space = Pass, TOWN 0x162D). Con el aiType 4 PERSIGUIENDO (#82) y
    // la party ya adyacente, `chaseMove` no tiene celda más cercana: el mercader no se mueve
    // NI UN turno. Se piden tres —no uno— porque el aserto ahora es de PERMANENCIA, y una
    // permanencia medida en un solo turno la pasaría también un NPC que se mueve cada dos.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(" ");
      await page.waitForTimeout(250);
      const paso = buscar(await npcs(page, MOONGLOW), MAGIC_DLG)!;
      expect(
        { x: paso.x, y: paso.y },
        `turno ${i + 1} con la party al lado: el aiType 4 persigue y ya no puede acercarse ⇒ sigue en su puesto`,
      ).toEqual(PUESTO);
    }
  });

  test("LA MEDICIÓN: dónde está el mercader en CADA instante de la secuencia del resync", async ({ page }) => {
    await gotoGame(page, { loc: MOONGLOW, floor: 0, x: PARTY.x, y: PARTY.y, hour: 12 });
    await teleport(page, MOONGLOW, PARTY.x, PARTY.y);
    await page.waitForTimeout(150);

    const traza: string[] = [];
    const marca = async (etiqueta: string): Promise<void> => {
      const m = buscar(await npcs(page, MOONGLOW), MAGIC_DLG);
      const hit = await npcAt(page, MOONGLOW, 0, PUESTO.x, PUESTO.y);
      traza.push(
        `${etiqueta}: mercader ${m ? `${m.x},${m.y}` : "AUSENTE"} · npcAt(${PUESTO.x},${PUESTO.y}) → ${hit ? `slot ${hit.slot} dlg 0x${hit.dlg.toString(16)}` : "NULL"}`,
      );
    };

    await marca("tras el teleport del resync");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await marca("tras los Escape x2 (aquí mide la sonda de ancla-herrero)");
    await page.keyboard.press("t");
    await page.waitForTimeout(120);
    await marca("tras la 't'");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    await marca("tras la flecha (startTalk ya decidió)");
    traza.push(`shopOpen = ${await shopOpen(page)}`);

    console.log("\n" + traza.join("\n") + "\n");
    // El test no asevera el veredicto: IMPRIME la traza que lo adjudica. El aserto sólo fija
    // que la medición se hizo entera.
    expect(traza).toHaveLength(5);
  });

  /**
   * ★★ SUFICIENCIA DEL MECANISMO. Un prompt `yesno` de Flow 2 (`prompt-manager.ts:210-213`:
   * `ESC` sólo resuelve el tipo `yesno-esc`; en `yesno` **el ESC se IGNORA** y CUALQUIER otra
   * tecla se CONSUME devolviendo true) sobrevive al `Escape ×2` con el que el resync limpia
   * («LIMPIEZA PRE-TALK», `runner.ts:2452-2453`, y el `purgeLiveModes` de costura, :1468).
   * Vivo ese prompt, la `t` y la flecha se las traga `prompts.handleKey` ANTES de llegar al
   * despachador de mapa — y `npcAt`, que la sonda de `ancla-herrero` lee por `page.evaluate`
   * (no por tecla), sigue enseñando al mercader SOLO en su celda. Esa es, exactamente, la
   * firma de la ficha AH-1.
   *
   * El prompt se levanta aquí con (Q)uit&Save (`main.ts:854`, getYN 0x448c «SÓLO Y/N, re-lee
   * cualquier otra»), que es un `yesno` de verdad del port y se alcanza con UNA tecla. Los
   * que puede levantar el mundo en un pueblo de la ley de Blackthorn son el TRIBUTO de
   * guardia (`main.ts:1537`, tag `guard-tribute`) y el ARRESTO (`main.ts:1551`), de la MISMA
   * clase — y el runner del espejo no los resuelve: sólo los clasifica como ticket
   * F2-T4 (`runner.ts:481`).
   */
  test("SUFICIENCIA: un yesno de Flow 2 vivo se traga el Escape x2, la 't' y la flecha", async ({ page }) => {
    await gotoGame(page, { loc: MOONGLOW, floor: 0, x: PARTY.x, y: PARTY.y, hour: 12 });
    await teleport(page, MOONGLOW, PARTY.x, PARTY.y);
    await page.waitForTimeout(150);

    await page.keyboard.press("q"); // (Q)uit & Save → prompt `yesno` (ESC ignorado)
    await page.waitForTimeout(200);
    const tipo = (): Promise<string | null> =>
      page.evaluate(() => (window as unknown as { __u5test?: { promptType?: () => string | null } }).__u5test?.promptType?.() ?? null);
    expect(await tipo(), "el prompt yesno quedó vivo").toBe("yesno");

    await talkHacia(page, "ArrowRight"); // la MISMA secuencia del resync: Escape x2 + t + flecha

    expect(await tipo(), "el Escape x2 del resync NO lo cierra: sigue vivo").toBe("yesno");
    expect(await shopOpen(page), "la tienda NO abre — y el mercader sigue SOLO en su celda").toBe(false);
    const mercader = buscar(await npcs(page, MOONGLOW), MAGIC_DLG)!;
    expect({ x: mercader.x, y: mercader.y }, "npcAt seguiría enseñándolo ahí: la sonda de ancla-herrero no lo vería").toEqual(PUESTO);

    // Y con 'n' el prompt se resuelve y la MISMA secuencia engancha: el mecanismo es el
    // prompt, no la celda ni el mercader.
    await page.keyboard.press("n");
    await page.waitForTimeout(200);
    expect(await tipo(), "resuelto con 'n'").toBeNull();
    await talkHacia(page, "ArrowRight");
    expect(await shopOpen(page), "misma celda, mismo mercader, misma secuencia: ahora SÍ abre").toBe(true);
  });
});
