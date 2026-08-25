/**
 * El TRONO de Blackthorn y el nombre — repro E2E del bucle del 24-08 (capturas
 * bt-conv-1..3: «Who dares approach…» → teclear «Avatar» → «I think not, let's
 * try again!» PARA SIEMPRE) y su fix (fuente única `effectiveName`).
 *
 * `nointro` = `createNewGame(init)` SIN gitana = avatar sin bautizar (name ""),
 * EXACTAMENTE el estado del save del usuario — el panel muestra «Avatar» por el
 * fallback de display y, antes del fix, el comparador de AskName careaba contra
 * "" y nada casaba jamás. El guion (castle.json, NPC 10, label 4) y el comparador
 * (TALK.OVL 0x0e78) están derivados en blackthorn-trono-nombre.test.ts (vitest);
 * aquí se ejercita la CADENA VIVA: talk-console construye el contexto real.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, submitPrompt, consoleText, promptType } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U5Win = Window & { __u5test: any };

const PALACE = 18; // loc 0x12 — castillo de Blackthorn

/**
 * Localiza a Blackthorn (su script TLK se llama «Blackthorn») en cualquier planta
 * del Palacio, teleporta al party a una casilla ADYACENTE y devuelve la dirección
 * de la tecla de (T)alk. La hora NO se toca: se le busca donde esté.
 */
async function standByBlackthorn(page: Page): Promise<string> {
  return page.evaluate((loc: number) => {
    const g = (window as unknown as U5Win).__u5test.game;
    g.npcManager.enterMap(loc, g.state);
    for (const floor of [0, 1, 2, 3, -1]) {
      for (const npc of g.npcManager.npcsAt(loc, floor)) {
        const res = g.talkScriptFor(npc);
        const first = res?.script?.name?.[0];
        if (first?.kind === "text" && first.text.trim() === "Blackthorn") {
          // Adyacencia por el SUR (el trono se aborda desde abajo, como el usuario).
          g.state.position = { location: loc, floor, x: npc.x, y: npc.y + 1 };
          return "ArrowUp";
        }
      }
    }
    throw new Error("Blackthorn no encontrado en el Palacio");
  }, PALACE);
}

/**
 * Censo VIVO de la familia que `town_alarm_all_npcs` posee por tile (TOWN 0x097a
 * `cmp di,0xfc / 0xd8 / 0x70`), en TODAS las plantas del Palacio: aiTypes (3 bytes,
 * 0x08c2 `lea di,[bx+0x5d5e]` stosw+stosb) y horario (4 bytes, 0x0890
 * `lea di,[bx+0x5d6a]` repne stosw cx=2). Es la MISMA proyección antes y después,
 * para que la comparación instancie la diferencia donde existe.
 */
async function hostileFamily(
  page: Page,
): Promise<{ slot: number; ai: number[]; times: number[] }[]> {
  return page.evaluate((loc: number) => {
    const g = (window as unknown as U5Win).__u5test.game;
    const all = [0, 1, 2, 3, -1].flatMap((f: number) => g.npcManager.npcsAt(loc, f));
    return all
      .filter((n: { type: number }) => [0x70, 0xd8, 0xfc].includes(n.type & 0xff))
      .map((n: { slot: number; aiTypes: number[]; times: number[] }) => ({
        slot: n.slot,
        ai: [...n.aiTypes],
        times: [...n.times],
      }));
  }, PALACE);
}

test("avatar SIN bautizar: «Avatar» ya CASA — saludo del label 0, no el bucle", async ({
  page,
}) => {
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  const dir = await standByBlackthorn(page);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/Who dares approach the mighty Blackthorn\?/);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await submitPrompt(page, "Avatar"); // lo que el panel MUESTRA como nombre
  await expect.poll(() => consoleText(page)).toMatch(/A pleasure!/);
  await expect
    .poll(() => consoleText(page))
    .toMatch(/Greetings, {2}Avatar, what an unexpected pleasure!/);
  const txt = await consoleText(page);
  expect(txt).not.toMatch(/I think not/);
});

test("nombre DESCONOCIDO: el bucle FIEL de 1988 sigue — y del bucle se sale acertando", async ({
  page,
}) => {
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  const dir = await standByBlackthorn(page);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await submitPrompt(page, "Fulano");
  // «If you say so… I think not, let's try again!» + RE-pregunta (label 4 → label 4).
  await expect.poll(() => consoleText(page)).toMatch(/If you say so\.\.\./);
  await expect.poll(() => consoleText(page)).toMatch(/I think not, let's try again!/);
  await expect.poll(() => promptType(page)).toBe("text"); // el nombre se re-pregunta
  await submitPrompt(page, "Avatar");
  await expect
    .poll(() => consoleText(page))
    .toMatch(/Greetings, {2}Avatar, what an unexpected pleasure!/);
});

test("con nombre REAL en el save, el trono reconoce ESE nombre (y el panel lo muestra)", async ({
  page,
}) => {
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  // Save bautizado: el nombre vive en el registro 0 (como lo escribe la gitana).
  await page.evaluate(() => {
    const g = (window as unknown as U5Win).__u5test.game;
    g.state.characters[0].name = "Lupo";
  });
  const dir = await standByBlackthorn(page);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await submitPrompt(page, "Lupo");
  await expect
    .poll(() => consoleText(page))
    .toMatch(/Greetings, {2}Lupo, what an unexpected pleasure!/);
});

test("ESC en «What is thy name?» NO corta la charla: borra la línea y el trono te retiene (kernel 0x3b1c)", async ({
  page,
}) => {
  // 1988: el getstring del kernel (0x3b1c) sólo sale por CR (0x3b7f); ESC borra lo
  // tecleado (0x3b57-0x3b5b) o es no-op en vacío (0x3b53/55). El ESC-cancelaba del
  // port era una válvula divergente (reporte del usuario, 24-08).
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  const dir = await standByBlackthorn(page);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await page.keyboard.type("Ava"); // media palabra tecleada…
  await page.keyboard.press("Escape"); // …ESC: borra la línea, la charla SIGUE
  await expect.poll(() => promptType(page)).toBe("text"); // el getstring sigue armado
  await page.keyboard.press("Escape"); // ESC en vacío: no-op (0x3b53/0x3b55)
  await expect.poll(() => promptType(page)).toBe("text");
  // El «Ava» borrado NO contamina: se teclea el nombre entero y CR lo envía.
  await submitPrompt(page, "Avatar");
  await expect.poll(() => consoleText(page)).toMatch(/A pleasure!/);
  await expect
    .poll(() => consoleText(page))
    .toMatch(/Greetings, {2}Avatar, what an unexpected pleasure!/);
});

test("responder NO a la Opresión: CallGuards SUENA — hostiles de verdad y el Palacio se cobra la amenaza", async ({
  page,
}) => {
  // TALK.OVL 0x0ff8 → TOWN 0x0958 (town_alarm_all_npcs): la familia {0xfc,0xd8,0x70}
  // pasa a aiType 6/7 con el horario borrado; el desenlace llega cuando uno de ellos
  // te ALCANZA (npc_engine `13a7 cmp [bx],0x70`: guardia → 0x12ae captura, cualquier
  // otro → tail 0x13dc «Attacked!» + combate). Antes el efecto era mudo: la amenaza
  // «Guards! Seize this infidel!» y NADA (reporte del usuario, 25-08).
  //
  // MEDIDO al mirar la escena (25-08, censo en vivo del Palacio): el trono está en la
  // PLANTA 2 y ahí sólo viven los dos daemons (0xd8, slots 6/7, a distancia 3); los
  // seis guardias 0x70 están en la planta 0 y dos más en la −1. ⇒ desde el trono el
  // desenlace es SIEMPRE el combate contra DAEMONS en el turno 2, no la captura: ésta
  // exige un 0x70 adyacente y se cobra al bajar. Por eso el aserto es la DISYUNCIÓN
  // (las dos ramas del mismo tail), no «captura»: fijarlo a captura sería pedirle al
  // port algo que el binario tampoco hace en esta planta.
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  const dir = await standByBlackthorn(page);
  // Foto ANTES: sin ella, «quedan hostiles» pasaría igual con el bug si ya lo fueran.
  // Medido: guardias [0,4,0] con horario real, daemons [0,0,0]. Ninguno hostil.
  const antes = await hostileFamily(page);
  expect(antes.some((n) => n.ai[0] === 6 || n.ai[0] === 7)).toBe(false);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await submitPrompt(page, "Avatar");
  await expect.poll(() => consoleText(page)).toMatch(/Wilt thou be staying with us long\?/);
  await submitPrompt(page, "y");
  await expect.poll(() => consoleText(page)).toMatch(/Hast thou joined us in the Oppression\?/);
  await submitPrompt(page, "n"); // el NO del usuario
  await expect.poll(() => consoleText(page)).toMatch(/Guards! Seize this infidel!/);
  // (1) La alarma DETERMINISTA: todos los tiles de familia guardia/daemon del Palacio
  //     quedan hostiles (0x085e: tile>=0x2f → 7, si no 6) con el horario BORRADO.
  const alarma = await hostileFamily(page);
  expect(alarma.length).toBe(antes.length); // misma población antes y después
  expect(alarma.length).toBeGreaterThan(0); // población: hay guardias/daemons que alarmar
  for (const n of alarma) {
    expect([6, 7]).toContain(n.ai[0]); // 0x0868-0x0876
    expect(n.ai).toEqual([n.ai[0], n.ai[0], n.ai[0]]);
    expect(n.times).toEqual([0, 0, 0, 0]); // 0x0890-0x0896: hostilidad permanente
  }
  // (2) La consecuencia de 1988, acotada: pasar turnos hasta que un hostil te alcanza —
  //     combate (daemon/no-guardia) o captura/arresto (guardia). Lo que NO puede pasar
  //     es «nada» (el bug del usuario).
  let desenlace = "";
  for (let turno = 0; turno < 20 && !desenlace; turno++) {
    await page.keyboard.press(" ");
    await page.waitForTimeout(150);
    desenlace = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = (window as any).__u5test;
      if (t.game?.combat) return "combate";
      const pt = t.promptType?.() ?? null;
      if (pt === "text" || pt === "yesno" || pt === "yesno-esc") return "prendido";
      const p = t.game?.state?.position;
      if (p && p.floor === -1) return "celda";
      return "";
    });
  }
  expect(["combate", "prendido", "celda"]).toContain(desenlace); // «no pasó nada» = rojo
});

test("control: la contraseña IMPERA te deja el castillo LIBRE — sin alarma, sin caza", async ({
  page,
}) => {
  await gotoGame(page, { loc: PALACE, x: 15, y: 15, floor: 0 });
  const dir = await standByBlackthorn(page);
  // Foto de los horarios ANTES (misma proyección que el test de la alarma).
  const antes = await hostileFamily(page);
  await page.keyboard.press("t");
  await page.keyboard.press(dir);
  await expect.poll(() => consoleText(page)).toMatch(/What is thy name\?/);
  await submitPrompt(page, "Avatar");
  await submitPrompt(page, "y");
  await expect.poll(() => consoleText(page)).toMatch(/Hast thou joined us in the Oppression\?/);
  await submitPrompt(page, "y");
  await expect.poll(() => consoleText(page)).toMatch(/What is it\?/);
  await submitPrompt(page, "impera");
  await expect
    .poll(() => consoleText(page))
    .toMatch(/Please, feel free to roam my castle and grounds!/);
  const despues = await hostileFamily(page);
  expect(despues).toEqual(antes); // ni un aiType movido, ni un horario borrado
});
