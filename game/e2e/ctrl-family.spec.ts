/**
 * Journey E2E — FAMILIA Ctrl (códigos < 0x20) en los bucles que `dungeon-dispatch.spec`
 * NO cubre: el del MUNDO EXTERIOR y el de COMBATE.
 *
 * Derivación completa (tabla de los cuatro bucles, base de carga de overlays 0x81D0 /
 * 0xA290, formato exacto del karma y testigo de vídeo): `re/notes/teclas-control-karma-
 * derivacion.md`.
 *
 * Lo que se ejercita, y por qué NO estaba cubierto:
 *
 *  1. **Exterior** — `handleCtrlKey` se llama desde `handleGameKey` (MAINOUT jump table
 *     0x0bbe / TOWN 0x1552), pero el único test de la familia entraba a Deceit y sólo
 *     probaba la rama de MAZMORRA. Aquí se prueba la del mapa: Ctrl-K imprime el karma
 *     como **decimal PELADO** (kernel `print_number_padded` 0x1a3e con pad=' ' y
 *     width=1 ⇒ cero relleno, y `sub ah,ah` ⇒ nunca signo) + '\n', y **sin turno**
 *     (0x0b45 → 0x0b75 → 0x0b7c `jmp 0xaf8`, que pone [bp-8]=0 y re-lee tecla).
 *
 *  2. **Combate** — el bucle de COMBAT.OVL (0x063e, getkey @0x0838) NO tenía guard de
 *     Ctrl ninguno, y como llamaba a `preventDefault()` incondicionalmente, cada
 *     Ctrl+letra disparaba el comando de esa letra. De la familia sólo existe **Ctrl-S**
 *     (cadena 0x084a-0x0886: `cmp ax,0x13` → 0x08b6); `g_karma` (DS 0x5888) tiene CERO
 *     referencias en todo COMBAT.OVL, así que Ctrl-K aquí no imprime karma.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, hudLog, inCombat } from "./helpers";

const CLEARING = { x: 102, y: 43, hour: 2 };

/** Fija el karma a un valor CRUDO (el esperado de los asertos no se deriva del sujeto). */
async function setKarma(page: Page, value: number): Promise<void> {
  await page.evaluate((v) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.karma = v;
  }, value);
}

const minuteOf = (page: Page): Promise<number> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(() => (window as any).__u5test.game.state.time.minute as number);

/** Siembra esqueletos al ESTE y entra por (A)ttack — receta determinista de combat-beat. */
async function enterCombat(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.game.state.characters.forEach((c: any) => {
      if (c && c.name) {
        c.currentHp = 255;
        c.maxHp = 255;
      }
    });
    t.game.overworldEnemies.enemies.push({ defIndex: 33, tile: 452, water: false, x: 103, y: 43 });
  });
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight");
  expect(await inCombat(page), "el (A)ttack sobre el grupo sembrado no abrió combate").toBe(true);
}

// ── 1. MUNDO EXTERIOR ────────────────────────────────────────────────────────────────

test("exterior: Ctrl-K imprime el karma como DECIMAL PELADO y no consume turno (MAINOUT 0x0b34)", async ({
  page,
}) => {
  await gotoGame(page, CLEARING);
  // 92 es el valor que el jugador del let's play lee en voz alta en el episodio 17
  // (25:19); el log del original enseña la fila `>92` — el `>` es el prompt del bucle.
  await setKarma(page, 92);
  const before = await minuteOf(page);

  await page.keyboard.press("Control+k");

  const log = await hudLog(page, 3);
  // NO `toContain(String(karma))`: el esperado va en CRUDO y además se exige la FORMA
  // derivada — la fila es el número SOLO. Un handler que imprimiera "Karma: 92", "  92"
  // o "92 karma" pasaría un `toContain` y muere aquí.
  expect(log.map((l) => l.trim())).toContain("92");
  expect(await minuteOf(page), "Ctrl-K no cobra turno (0x0b7c jmp 0xaf8)").toBe(before);
});

test("exterior: el karma se imprime SIN relleno también con un dígito (width=1 ⇒ pad ≤ 0)", async ({
  page,
}) => {
  await gotoGame(page, CLEARING);
  // Control de la aritmética de 0x1a3e: `width - ndígitos` con width=1 es 0 para un
  // dígito y NEGATIVO para dos ⇒ jamás rellena. Con width=2 (mutante plausible) esta
  // fila saldría " 7" y el aserto de igualdad exacta la caza.
  await setKarma(page, 7);
  await page.keyboard.press("Control+k");
  expect((await hudLog(page, 3)).map((l) => l.trim())).toContain("7");
});

test("exterior: Ctrl-V imprime la versión 1.16 y Ctrl-S el toggle de sonido (0x0b6e / 0x0b80)", async ({
  page,
}) => {
  await gotoGame(page, CLEARING);
  await page.keyboard.press("Control+v");
  expect((await hudLog(page, 3)).join("\n")).toContain("1.16");
  await page.keyboard.press("Control+s");
  // "Sound " (DS 0x2b54) + el estado NUEVO tras conmutar (0x0b9b-0x0ba4).
  expect((await hudLog(page, 3)).join("\n")).toMatch(/Sound (On|Off)/);
});

test("exterior: Ctrl+letra que NO es de la familia no dispara el comando de esa letra", async ({
  page,
}) => {
  await gotoGame(page, CLEARING);
  const before = (await hudLog(page, 6)).join("\n");
  // Ctrl+Y: la (Y)ell del mapa abre un getstring con eco "Yell ". Con el guard, nada.
  await page.keyboard.press("Control+y");
  expect((await hudLog(page, 6)).join("\n")).toBe(before);
});

// ── 2. COMBATE ───────────────────────────────────────────────────────────────────────

test("combate: Ctrl-S conmuta el sonido y NO arma la (S)earch (COMBAT 0x0881 → 0x08b6)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoGame(page, CLEARING);
  await enterCombat(page);

  await page.keyboard.press("Control+s");
  const log = (await hudLog(page, 3)).join("\n");
  // (a) hace lo suyo…
  expect(log, "Ctrl-S en combate debe conmutar el sonido").toMatch(/Sound (On|Off)/);
  // (b) …y NO lo de la letra pelada. Antes del guard, Ctrl+S caía en la rama
  // `key.toLowerCase() === "s"`, que ecoa "Search" y arma `pendingCombatDir`.
  expect(log, "Ctrl-S no debe ecoar el comando (S)earch").not.toMatch(/Search|Buscar/i);
  // Y no debe quedar un getdir armado: si lo estuviera, la flecha siguiente resolvería
  // la búsqueda en esa celda en vez de mover/apuntar. Se observa por la CONDUCTA (una
  // flecha después), no por un campo interno — `pendingCombatDir` no está expuesto.
  await page.keyboard.press("ArrowRight");
  expect(
    (await hudLog(page, 4)).join("\n"),
    "la flecha posterior no debe caer en un getdir de (S)earch",
  ).not.toMatch(/Search|Buscar/i);
});

test("combate: Ctrl-K NO imprime karma (g_karma: 0 refs en COMBAT.OVL) ni dispara Klimb", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoGame(page, CLEARING);
  await setKarma(page, 92);
  await enterCombat(page);

  const before = (await hudLog(page, 6)).join("\n");
  await page.keyboard.press("Control+k");
  const after = (await hudLog(page, 6)).join("\n");
  // Ni la fila del karma del exterior…
  expect(after.split("\n").map((l) => l.trim())).not.toContain("92");
  // …ni el (K)limb de la letra pelada: el log no se mueve.
  expect(after, "Ctrl-K en combate no es un comando de este bucle").toBe(before);
});

test("combate: Ctrl+A no lanza el (A)ttack (doce ramas de letra estaban secuestradas)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoGame(page, CLEARING);
  await enterCombat(page);

  const before = (await hudLog(page, 6)).join("\n");
  await page.keyboard.press("Control+a");
  expect((await hudLog(page, 6)).join("\n"), "Ctrl+A no debe ecoar Attack").toBe(before);
});
