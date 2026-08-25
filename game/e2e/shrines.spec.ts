/**
 * F1.4 · Santuarios interactivos + pozo de deseos — cobertura E2E de teclado.
 *
 * Santuario VIVO (CAST2 0x0e76): pisar el ankh (tile 0x19) CORRE la ceremonia AL PISAR
 * (sin prompt "Meditate?" — el dispatch 0x0e76 va directo a shrine_visit 0x0966, sin getkey).
 * T-003: la ceremonia es un INTERROGATORIO — kneel (MISCMSG 0x718) → virtud tecleada →
 * Mantra ×3 (bucle 0x0a0c) — y SOLO tras el match ramifica: Codex NO aprendido → ORDAINED
 * (quest-bit + sacred Quest); Codex + quest → quest-complete (+attr); Codex + sin quest →
 * donación (dígito). El Codex se simula por hook (__u5test), como declaró el scout. Santuario DESTRUIDO (CMDS 0x1202, tile 0x1a): teclear virtud +
 * mantra×3 lo restaura; cancelar a mitad lo deja roto. Pozo (LOOKOBJ 0x0042): mirar el
 * pozo → "Drop a coin?" → deseo → caballo en Paws, MONTABLE por (B)oard. 0 RNG.
 *
 * Los CUATRO getstrings de cada rito son de CONSOLA desde #268 (antes, un modal DOM): se
 * teclean sobre `window` y se sincronizan por `submitPrompt`/`promptType`, no por locator.
 *
 * Coords reales (escaneadas de assets): Honesty overworld (233,66); pozo de Paws (3,21) en
 * loc 0x16 floor 0 (party al S en (3,22)); el caballo del deseo aparece al E en (4,22).
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, inCombat, consoleText, submitPrompt, promptType } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U5Win = Window & { __u5test: any };

// Fija shrineQuestBitmap/shrineVisitedBitmap en el estado vivo (simula el peregrinaje al Codex).
async function setShrineBits(page: import("@playwright/test").Page, quest: number, visited: number) {
  await page.evaluate(
    ([q, v]) => {
      const s = (window as unknown as U5Win).__u5test.state();
      s.shrineQuestBitmap = q;
      s.shrineVisitedBitmap = v;
    },
    [quest, visited],
  );
}

// Teclea la cadena de 4 getstrings del interrogatorio (virtud + mantra×3). Desde #268 los
// cuatro son prompts de CONSOLA, así que los cuatro pasan por `submitPrompt`: cada uno
// espera a que el prompt esté vivo y a que se resuelva, que es lo que encadena las vueltas
// (el handler re-arma el siguiente dentro del mismo keydown del Enter anterior).
async function typeMeditation(page: import("@playwright/test").Page, virtue: string, mantra: string) {
  await submitPrompt(page, virtue);
  for (let i = 0; i < 3; i++) await submitPrompt(page, mantra);
}

test("Santuario · ordained: pisar Honesty + interrogatorio correcto fija la quest", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  await page.keyboard.press("ArrowRight"); // (232,66) → (233,66) = Shrine 0x19
  await page.keyboard.press("e"); // F2-T6: la ceremonia cuelga del (E)nter (cmd_enter 0x936)
  await expect.poll(() => consoleText(page)).toMatch(/kneel before the Altar/);
  await typeMeditation(page, "Honesty", "Ahm");
  await expect.poll(() => consoleText(page)).toMatch(/a Quest is ordained!/);
  await expect.poll(() => consoleText(page)).toMatch(/Return again when thy Quest is done!/);
  // La quest de Honesty (bit 0) quedó fijada por la rama ordained (0x0a81).
  expect(await readState<number>(page, "shrineQuestBitmap")).toBe(1);
});

test("Santuario · unfocused: mantra erróneo NO fija la quest", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e"); // F2-T6: ceremonia por (E)nter
  await expect.poll(() => consoleText(page)).toMatch(/kneel before the Altar/);
  await typeMeditation(page, "Honesty", "Zzz");
  await expect.poll(() => consoleText(page)).toMatch(/Thine thoughts are unfocused\./);
  // El bitmap arranca sin inicializar (undefined) y el fallo NO debe haberlo tocado.
  expect(Boolean(await readState<number>(page, "shrineQuestBitmap"))).toBe(false);
});

test("Santuario · quest-complete: con Codex (hook) + quest, meditar sube un atributo", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  await setShrineBits(page, 1, 1); // quest de Honesty + Codex aprendido → quest-complete
  const intBefore = await readState<number>(page, "characters[0].intelligence");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e"); // F2-T6: ceremonia por (E)nter
  await expect.poll(() => consoleText(page)).toMatch(/kneel before the Altar/);
  await typeMeditation(page, "Honesty", "Ahm"); // match → rama quest-complete
  await expect.poll(() => consoleText(page)).toMatch(/Intelligence \+1/);
  expect(await readState<number>(page, "characters[0].intelligence")).toBe(intBefore + 1);
  expect(await readState<number>(page, "shrineQuestBitmap")).toBe(0); // consumida
});

test("Santuario · donación: con Codex (hook) y sin quest, meditar abre el prompt de dígito", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  await setShrineBits(page, 0, 1); // Codex aprendido, sin quest → donación
  const goldBefore = await readState<number>(page, "gold");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e"); // F2-T6: ceremonia por (E)nter
  await expect.poll(() => consoleText(page)).toMatch(/kneel before the Altar/);
  await typeMeditation(page, "Honesty", "Ahm"); // match → rama donación → shrine-donate-prompt
  // Espera a que el prompt de dígito esté ARMADO (el "1" antes de tiempo se pierde en el selector).
  await expect.poll(() => consoleText(page)).toMatch(/Offer how many hundredweights gold\?/);
  await page.keyboard.press("1"); // dona 1 ciclo = 100 oro

  // ★ #136 — POLL, no lectura seca. Todos los pasos de arriba esperan por consola, pero este
  // aserto leía `gold` INMEDIATAMENTE después de la tecla, sin esperar a que el efecto
  // aterrizara. Bajo CONTENCIÓN de máquina el viaje tecla→estado no ha terminado y sale
  // `Expected 50, Received 150` (el oro sin descontar). Reproducido: 6 quemadores de CPU en
  // paralelo lo tumban; sin carga pasa siempre. No es la mecánica —el oro SÍ se descuenta—,
  // es el test leyendo antes de tiempo.
  await expect.poll(() => readState<number>(page, "gold")).toBe(goldBefore - 100);
});

test("Santuario · restaurar: teclear virtud + mantra×3 repinta el santuario (0x1a→0x19)", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  // Simula la destrucción por un Shadowlord: bit alto en shrineDestroyed[0]. Con eso BASTA
  // (#212): el mapa estático guarda 0x19 y la ruina 0x1a la pinta el compose por frame
  // desde el bitmap (OUTSUBS.OVL 0x0178-0x019a, game.ts tileAt). El setMapOverride(0x1a)
  // que había aquí era el modelo VIEJO (override persistente): tras #212 nadie lo
  // sobreescribe y además CORTOCIRCUITA el compose (que sólo aplica sobre tile==0x19).
  await page.evaluate(() => {
    const t = (window as unknown as U5Win).__u5test;
    t.state().shrineDestroyed = [0x80, 0, 0, 0, 0, 0, 0, 0];
  });
  // Control positivo del arnés: la ruina SE VE — el compose la pinta desde el bitmap,
  // sin ningún override de por medio.
  expect(
    await page.evaluate(() => (window as unknown as U5Win).__u5test.game.activeMap.tileAt(233, 66)),
  ).toBe(0x1a);

  await page.keyboard.press("ArrowRight"); // (233,66) = santuario destruido → shrine-restore-prompt
  // Cadena de 4 getstrings de consola: virtud, luego mantra ×3.
  await typeMeditation(page, "Honesty", "Ahm");

  await expect.poll(() => consoleText(page)).toMatch(/restored/i);
  expect(await readState<number>(page, "shrineDestroyed[0]")).toBe(0); // bit alto limpiado
  // El tile del mundo se ve repintado a SHRINE_TILE 0x19: con el bit limpio el compose
  // deja pasar el 0x19 estático (#212 — no hay escritura persistente que lo haga).
  const tile = await page.evaluate(
    () => (window as unknown as U5Win).__u5test.game.activeMap.tileAt(233, 66),
  );
  expect(tile).toBe(0x19);
  // #212: restaurar NO deja rastro en mapOverrides — la persistencia REAL es el bitmap
  // g_shrine_destroyed (roster+0x332, viaja en el .GAM).
  expect(
    await page.evaluate(
      () => (window as unknown as U5Win).__u5test.state().mapOverrides?.["0:0:233:66"],
    ),
  ).toBeUndefined();
});

test("Santuario · restaurar CANCELADO a mitad de la cadena deja el santuario roto", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 });
  // Mismo arnés que el test de arriba (#212): SOLO el bitmap — la ruina la pinta el
  // compose por frame; un override 0x1a aquí sería el modelo viejo y taparía el compose.
  await page.evaluate(() => {
    const t = (window as unknown as U5Win).__u5test;
    t.state().shrineDestroyed = [0x80, 0, 0, 0, 0, 0, 0, 0];
  });

  await page.keyboard.press("ArrowRight"); // → shrine-restore-prompt
  await submitPrompt(page, "Honesty"); // virtud aceptada → 1er "Mantra:"
  await submitPrompt(page, "Ahm"); //     1er mantra → 2º "Mantra:"

  // Cancelar la cadena con ESCAPE. Desde #268 no hay botón Cancel que pulsar: el getstring
  // vive en la consola y ESC lo resuelve VACÍO, que es la salida del rito en el binario
  // (CAST2 0x0a1e / CMDS: entrada vacía rompe el bucle de mantras). Una sola pulsación
  // cierra la cadena entera — no hace falta agotar los tres.
  await page.keyboard.press("Escape");
  await expect.poll(() => promptType(page)).toBeNull();

  // Sin submitShrineRestore: el santuario sigue destruido — el bit sigue puesto y el
  // compose sigue pintando la ruina 0x1a desde el bitmap.
  expect(await readState<number>(page, "shrineDestroyed[0]")).toBe(0x80);
  const tile = await page.evaluate(
    () => (window as unknown as U5Win).__u5test.game.activeMap.tileAt(233, 66),
  );
  expect(tile).toBe(0x1a);
});

test("Pozo · deseo 'Horse' en Paws genera un caballo montable ('Poof!' + Board)", async ({ page }) => {
  // Paws = loc 0x16 = 22. Pozo en (3,21) floor 0; party 1 al S en (3,22). seed fijo como los 5
  // tests de santuario: los pasos en pueblo NO rulan encuentros ("sin spawn de monstruos en
  // pueblo/mazmorra", game.ts), pero el seed blinda cualquier ruta gated por liveRng y da paridad
  // determinista con el resto del spec.
  await gotoGame(page, { loc: 22, x: 3, y: 22, seed: 1 });
  // Guard anti-flake: confirma que el deep-link cargó Paws (loc 22) ANTES de mover. Si el
  // deep-link no aplicara (party en el overworld), un paso rularía encuentro → combate; este
  // assert lo detecta de inmediato en vez de fallar de forma confusa en el board.
  expect(await readState<number>(page, "position.location")).toBe(22);

  await page.keyboard.press("l"); // (L)ook
  await page.keyboard.press("ArrowUp"); // mira (3,21) = pozo
  await expect.poll(() => consoleText(page)).toMatch(/Drop a coin\?/i);

  await page.keyboard.press("y"); // echa la moneda → "Thy wish?"
  // El deseo se teclea en el selector de texto (misma clase que la Word of Power).
  // submitPrompt espera el TEARDOWN del panel antes de seguir (guarda Q5): el
  // ArrowRight de abajo es una tecla cruda — con el foco retenido en el panel
  // oculto se la tragaba el stopPropagation del root (rojo intermitente del tour).
  await submitPrompt(page, "Horse");
  await expect.poll(() => consoleText(page)).toMatch(/Poof!/);

  // El caballo aparece en la 1ª adyacente transitable (N=pozo no; E=(4,22) hierba sí). El único
  // NPC cercano al pozo a esta hora (08:35) es slot 7 en (4,23) con AI_FIXED (quieto) → nunca
  // invade (4,22); además NINGÚN tick de NPC precede a este único paso (look/drop/wish no
  // consumen turno), así que (4,22) está libre de forma determinista.
  await page.keyboard.press("ArrowRight"); // pisa (4,22) = caballo
  await expect.poll(() => readState<number>(page, "position.x")).toBe(4); // el paso aterrizó
  expect(await inCombat(page)).toBe(false);

  await page.keyboard.press("b"); // (B)oard → montar
  await expect.poll(() => consoleText(page)).toMatch(/horse/i);
  expect(await readState<string>(page, "transport")).toBe("horse");
});
