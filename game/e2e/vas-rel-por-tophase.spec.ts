/**
 * Careo #341 — el prompt «To phase:» de Vas Rel Por contra el ÚNICO testigo de vídeo
 * que existe en los tres corpus de walkthroughs (censo de fenton-curacion §6: 0 rutas
 * en LP1, 0 en AD, 3 en Lord Fenton). Lecturas a ojo de los fotogramas (ffmpeg):
 *
 *   lf29 t≈1658 s  «To phase: 2»   lf30 t≈374 s «To phase: 4»
 *   lf30 t≈518 s   «To phase: 5»   lf30 t≈535 s «To phase: 6»   lf31 t≈1256 s «To phase: 2»
 *
 * Los CINCO casts muestran la misma secuencia, y es la que este spec fija:
 *
 *   >Cast...            ← eco del comando: bullet ►
 *   Player: Fenton      ← (lf31; con jugador activo no aparece — lf30)
 *   Spell name:         ← print_string DS 0x4603: fila PLANA, sin ► y sin blanco delante
 *   :VAS REL POR        ← fila del cursor del getstring
 *   To phase: 4         ← print_string DS 0x45e7 + eco de la tecla DETRÁS (0x0d13)
 *                       ← putchar('\n') 0x0d16 y NADA MÁS: el éxito es MUDO (la cola
 *                         0x11a6 sólo habla con res 1/"Success!" ó 0/"Failed!", y Vas
 *                         Rel Por devuelve -1 al acertar — derivación §3)
 *   >West               ← siguiente comando del jugador
 *
 * La metadata de fila (`kind`/`cont`) la expone el hook read-only `consoleMeta`:
 * `cont: true` = eco sin bullet que NO abre grupo (console.ts:115) — el seam único que
 * gobierna las dos divergencias que este careo encontró (bullet ► y línea en blanco de
 * grupo delante de «Spell name:»/«To phase:», que el vídeo no tiene).
 *
 * Derivación del binario: re/notes/vas-rel-por-341-derivacion.md (CAST.OVL 0x0cf0-0x0d4b).
 * Mecánica del teleport: game/tests/vas-rel-por-341.test.ts (13 asertos con literales).
 */
import { test, expect } from "@playwright/test";
import { gotoGame } from "./helpers";

type Meta = { text: string; kind: string; cont: boolean };

const consoleMeta = (page: import("@playwright/test").Page): Promise<Meta[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __u5test: { consoleMeta: () => Meta[] } }).__u5test.consoleMeta(),
  );

test("«To phase:» calca el testigo: filas planas, eco detrás, éxito MUDO y viaje a la piedra", async ({
  page,
}) => {
  await gotoGame(page, { x: 84, y: 108 }); // sobremundo, a pie (el gate del barco no aplica)
  // Siembra: Vas Rel Por mezclado + maná y nivel ≥ círculo (los gates de castSpell son
  // de otra ficha; aquí se ejercita la secuencia del prompt).
  await page.evaluate(() => {
    const st = (
      window as unknown as {
        __u5test: {
          state: () => {
            spellQuantities: number[];
            characters: { currentMp: number; level: number }[];
            moonstones: { x: number; y: number; location: number }[];
            position: { x: number; y: number; location: number };
          };
        };
      }
    ).__u5test.state();
    st.spellQuantities[46] = 5;
    st.characters[0]!.currentMp = 99;
    st.characters[0]!.level = 8;
  });

  await page.locator("body").press("c");
  // Caster-select (party fresca de 3, sin activo): "Player: " → Enter elige al Avatar.
  await expect
    .poll(async () => (await consoleMeta(page)).map((l) => l.text).join("\n"))
    .toContain("Player:");
  // Cursor de la fila viva CON el picker abierto (cabo #341 §7.2): el testigo lf31@1253
  // muestra «Player: ▓» parpadeando — la espera del picker es el mismo getkey 0x266c
  // (kernel 0x2dca dentro de select_party_member). Guarda de CABLEADO de refreshAwaiting.
  expect(
    await page.evaluate(
      () => (window as unknown as { __u5test: { promptCursor: () => boolean } }).__u5test.promptCursor(),
    ),
    "«Player: » lleva el cursor de la fila viva (testigo lf31)",
  ).toBe(true);
  await page.locator("body").press("Enter");
  for (const k of ["v", "r", "p"]) await page.locator("body").press(k);
  await page.locator("body").press("Enter");
  await expect
    .poll(async () => (await consoleMeta(page)).map((l) => l.text).join("\n"))
    .toContain("To phase: ");
  // Y con el getkey pelado abierto: el testigo lf30@374 muestra «To phase: ▓» (cursor
  // ANIMADO del bucle 0x266c → 0x1b38, animación verificada por diff de fotogramas).
  expect(
    await page.evaluate(
      () => (window as unknown as { __u5test: { promptCursor: () => boolean } }).__u5test.promptCursor(),
    ),
    "«To phase: » lleva el cursor de la fila viva (testigo lf30)",
  ).toBe(true);

  // ── La secuencia del testigo, con su metadata de presentación ──
  const rows = await consoleMeta(page);
  const texts = rows.map((r) => r.text);
  const iCast = texts.lastIndexOf("Cast...");
  expect(iCast, "eco del comando presente").toBeGreaterThanOrEqual(0);
  const cast = rows[iCast]!;
  expect(cast.kind, "«Cast...» es eco de comando (► fiel)").toBe("echo");
  expect(cast.cont, "«Cast...» abre grupo, como el >Cast... del vídeo").toBe(false);

  const iName = texts.indexOf("Spell name:", iCast);
  expect(iName, "«Spell name:» tras el eco").toBeGreaterThan(iCast);
  expect(rows[iName], "«Spell name:» fila PLANA (testigo: sin ► y sin blanco)").toEqual({
    text: "Spell name:",
    kind: "echo",
    cont: true,
  });
  expect(texts[iName + 1], "la fila del cursor con lo tecleado").toBe(":VAS REL POR");

  const iPhase = texts.indexOf("To phase: ", iName);
  expect(iPhase, "el prompt de fase, fila propia").toBeGreaterThan(iName);
  expect(rows[iPhase], "«To phase: » fila PLANA (testigo: sin ► y sin blanco)").toEqual({
    text: "To phase: ",
    kind: "echo",
    cont: true,
  });

  // ── La tecla: eco DETRÁS del prompt, y el destino es LA PIEDRA de esa fase ──
  const stone = await page.evaluate(
    () =>
      (window as unknown as { __u5test: { state: () => { moonstones: { x: number; y: number }[] } } })
        .__u5test.state().moonstones[4]!, // tecla '5' → fase 0-based 4 (0x0d29 sub 0x31)
  );
  await page.locator("body").press("5");
  await expect
    .poll(async () => (await consoleMeta(page)).map((l) => l.text).join("\n"))
    .toContain("To phase: 5"); // eco 0x0d13: en la MISMA fila, detrás del prompt

  const after = await consoleMeta(page);
  const tail = after.map((l) => l.text).slice(after.map((l) => l.text).indexOf("To phase: 5"));
  // Éxito MUDO (derivación §3 + los 5 casts del vídeo: jamás un "Success!").
  expect(tail.join("\n")).not.toContain("Success!");
  expect(tail.join("\n")).not.toContain("Failed!");

  const pos = await page.evaluate(
    () =>
      (window as unknown as { __u5test: { state: () => { position: { x: number; y: number; location: number } } } })
        .__u5test.state().position,
  );
  expect({ x: pos.x, y: pos.y, location: pos.location }).toEqual({
    x: stone.x,
    y: stone.y,
    location: 0,
  });
});
