/**
 * F1.7-T5 · REACHABILITY del ciclo de Blackthorn — cobertura E2E de teclado.
 *
 * Cierra el bucle que las piezas A (captura), C (password) y el TRIGGER REAL de
 * T5 hacen JUGABLE de punta a punta:
 *   1. Acercarse a un guardia del Palacio (type 0x70) SIN el pase → captura
 *      (npc_engine TOWN 0x13a7: el ataque por adyacencia manhattan==1 dispara
 *      0x12ae → blackthorn_capture). Confisca las llaves y deposita en (10,7).
 *   2. Tras el depósito, el trigger YA NO es per-turno: caminar SIN un guardia
 *      pegado no re-captura (a diferencia del gate aproximado de T2).
 *   3. Hablar (T) con un guardia: SIN insignia NI PREGUNTA (#277: TALK 0x02a4 va
 *      ANTES del print del reto → jmp 0x216 = ret 1 silencioso); con la Black
 *      Badge PUESTA → reto de password → teclear "IMPE" (primeros 4 chars,
 *      TALK 0x02dc/0x02e0) → "Pass, friend!" concede el pase.
 *   4. Con el pase, estar pegado a un guardia ya NO captura → libre para salir.
 *
 * Determinista, 0 RNG (captura/interrogatorio/password son deterministas). Los
 * guardias se colocan por su horario real. Blackthorn = loc 0x12 (18); depósito (10,7).
 *
 * ★ LA HORA ES PARTE DE LA PRECONDICIÓN, no decoración (#64, derivación entera en
 * `re/notes/horaria-64-adjudicacion.md`). El slot `[0x65bf]` que habilita la captura sólo
 * lo ARMA un actor con `aiTypes[ranura] > 3` (`NPC.OVL 0x072c` `cmp .., 3` / `jle`), y la
 * RANURA sale del selector horario. Los guardias del Palacio valen `aiType 0` en su ranura
 * de NOCHE ⇒ **entre las 21:00 y las 04:59 NO captura ninguno**. Este fichero fijaba hora
 * 22 —elegida el 30-07 para que los guardias no se movieran— y #64 aterrizó el 31-07
 * convirtiendo justo esa hora en la ventana de CERO capturas: los dos tests llevaban desde
 * entonces esperando un prompt que por diseño derivado no puede aparecer. #64 migró los
 * fixtures de vitest a `aiTypes [4,4,4]` y no tocó estos specs porque la suite e2e de
 * escritorio no podía arrancar. Hora 11 MEDIDA como armante en el árbol vivo.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, consoleText, submitPrompt, promptType } from "./helpers";
import type { Page } from "@playwright/test";
// El byte 0x1d de g_time_spell se IMPORTA del core en vez de copiarse (ea51efc8).
import { TIME_SPELL_BADGE } from "../src/core/world/blackthorn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U5Win = Window & { __u5test: any };

/** Hora cuya ranura horaria ARMA el slot de captura (#64). Ver el docblock del fichero. */
const CAPTURE_HOUR = 11;

/**
 * Fija la hora a `CAPTURE_HOUR` (ranura con aiType > 3: los guardias ARMAN el slot
 * `[0x65bf]`, #64), recarga los NPC del Palacio y coloca al party ORTOGONALMENTE al
 * oeste del primer guardia (type 0x70) de la planta 0. Devuelve la posición del
 * guardia. El party queda en (gx-1, gy) mirando al guardia: un paso al este choca
 * con él (bloqueo de NPC = turno consumido).
 */
async function standWestOfGuard(page: Page): Promise<{ gx: number; gy: number }> {
  // La hora VIAJA como argumento: el cuerpo de `evaluate` corre en la página y no
  // cierra sobre el módulo — una constante «usada» sólo aquí quedaría muerta.
  return page.evaluate((hour: number) => {
    const g = (window as unknown as U5Win).__u5test.game;
    g.state.time.hour = hour;
    g.npcManager.enterMap(18, g.state);
    const guards = g.npcManager
      .npcsAt(18, 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((n: any) => (n.type & 0xff) === 0x70);
    if (guards.length === 0) throw new Error("no palace guards loaded");
    const gg = guards[0];
    g.state.position = { location: 18, floor: 0, x: gg.x - 1, y: gg.y };
    return { gx: gg.x, gy: gg.y };
  }, CAPTURE_HOUR);
}

test("acercarse a un guardia SIN pase → captura (depósito en (10,7), llaves confiscadas)", async ({
  page,
}) => {
  await gotoGame(page, { loc: 18, x: 0, y: 0, floor: 0 });
  await standWestOfGuard(page);
  const keysBefore = await readState<number>(page, "keys");
  expect(keysBefore).toBeGreaterThan(0);

  // Paso al este = choca con el guardia → turno de pueblo → captura → interrogatorio.
  await page.keyboard.press("ArrowRight");
  // El interrogatorio pregunta por el 1er santuario en pie (Honesty, mantra "Ahm").
  // Ceder el mantra cierra la escena (traición) y deposita.
  await submitPrompt(page, "Ahm"); // guarda Q5: espera el teardown del panel

  // Depósito EXACTO: (10,7) en loc 0x12, llaves a 0 (BLCKTHRN 0x08f6).
  expect(await readState<number>(page, "position.location")).toBe(18);
  expect(await readState<number>(page, "position.x")).toBe(10);
  expect(await readState<number>(page, "position.y")).toBe(7);
  expect(await readState<number>(page, "keys")).toBe(0);
});

/**
 * ⚠ PREPARADO por T-A/T-B (2026-07-30), PENDIENTE-VALIDACIÓN-VENTANA (re-sello por el lead
 * en la ventana consolidada, task #28).
 * El contrato cambió: ya no hay `blackthornPassGranted` (el binario no escribe pase
 * — TALK 0x01e2 sólo toca `g_gold`), y con la insignia puesta la INTERCEPCIÓN reta
 * el password en vez de capturar. Ver re/notes/tc-result-producer.md §7.
 */
test("ciclo de escape: captura → depósito → Talk IMPE → Pass, friend! → el guardia RE-RETA", async ({
  page,
}) => {
  await gotoGame(page, { loc: 18, x: 0, y: 0, floor: 0 });

  // (1) Captura al chocar con un guardia sin pase.
  await standWestOfGuard(page);
  await page.keyboard.press("ArrowRight");
  await submitPrompt(page, "Ahm"); // cede → traición → depósito (guarda Q5)
  expect(await readState<number>(page, "position.x")).toBe(10);
  expect(await readState<number>(page, "position.y")).toBe(7);

  // (2) Ya en el depósito (10,7): NINGÚN guardia adyacente. Un paso NO re-captura
  //     (el trigger dejó de ser per-turno). El party sigue libre y consciente.
  await page.keyboard.press("ArrowDown");
  // T-B: el flag desapareció del estado; el observable es la POSICIÓN, no un pase.
  expect(await readState<unknown>(page, "blackthornPassGranted")).toBeUndefined();
  // Sigue en el Palacio, no re-depositado por una 2ª captura (posición cambió por el paso).
  expect(await readState<number>(page, "position.location")).toBe(18);

  // (3a) SIN la insignia el guardia NI PREGUNTA (#277: TALK 0x02a4 `cmp
  //      g_time_spell,0x1d` corre ANTES del print del reto 0x2ae; sin badge
  //      `jmp 0x216` = ret 1 SILENCIOSO). El prompt de texto NO aparece.
  //      Control por condición separada: las MISMAS teclas con la insignia (3b)
  //      SÍ lo abren — la ausencia de aquí no es un fallo del arnés.
  await standWestOfGuard(page);
  await page.keyboard.press("t"); // (T)alk
  await page.keyboard.press("ArrowRight"); // dirección → guardia al este
  // Desde #268 el reto es un getstring de CONSOLA: la ausencia se mide sobre el prompt
  // vivo (`inputSinks().prompt`), no sobre un input del DOM que ya no existe.
  expect(await promptType(page)).not.toBe("text");

  // (3b) Black Badge PUESTA — la precondición del binario (el ÚNICO escritor de
  //      g_time_spell=0x1d es (U)se Badge, CAST.OVL 0x1b47 "Badge worn!"). Con ella:
  //      reto de password → "IMPE" → pase.
  // ★ Se siembra `timeSpell`, NO un `wornBadge` propio: el 30-07 (ea51efc8) los DOS
  //   flags se unificaron en g_time_spell porque en el binario son UN byte, y
  //   `guard-encounters.ts:114` gatea con `timeSpell !== TIME_SPELL_BADGE`. Sembrar
  //   `wornBadge` escribía un campo que el producto ya no lee: el reto no salía y el
  //   fallo se leía como «el guardia no reta», no como «el arnés siembra en el vacío».
  await page.evaluate((badge: string) => {
    (window as unknown as U5Win).__u5test.game.state.timeSpell = badge;
  }, TIME_SPELL_BADGE);
  await page.keyboard.press("t"); // (T)alk
  await page.keyboard.press("ArrowRight"); // dirección → guardia al este
  // El reto "Give now the password..." se imprime EN LA CONSOLA y la respuesta se teclea
  // en línea; `submitPrompt` espera a que el getstring esté vivo y a que se resuelva.
  await submitPrompt(page, "IMPE");
  await expect.poll(() => consoleText(page)).toMatch(/Pass, friend!/);
  // T-B: acertar NO escribe pase alguno.
  expect(await readState<unknown>(page, "blackthornPassGranted")).toBeUndefined();

  // (4) T-A + T-B — el turno siguiente, con la insignia puesta y el guardia todavía
  //     pegado, la INTERCEPCIÓN vuelve a retar el password (no captura, y tampoco
  //     deja pasar): el binario re-reta en cada intercepción.
  const xBefore = await readState<number>(page, "position.x");
  const yBefore = await readState<number>(page, "position.y");
  await page.keyboard.press("ArrowRight"); // choca con el guardia (bloqueo NPC), turno
  await expect.poll(() => promptType(page)).toBe("text"); // el reto, de nuevo
  await submitPrompt(page, "IMPE");
  expect(await readState<number>(page, "position.x")).toBe(xBefore);
  expect(await readState<number>(page, "position.y")).toBe(yBefore);
});
