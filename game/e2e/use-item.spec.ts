/**
 * E2E — comando (U)se item con la PIEL FIEL: el picker es el OVERLAY DE PERGAMINO
 * (`item_page_controller` @0x0f2e, modo 'U'), NO el popup DOM. Conduce el comando
 * DESDE EL TECLADO y verifica, vía los hooks lógicos `__u5test` (mismos que pintan la
 * piel fiel), que:
 *   - 'u' abre el overlay (fase `pick`) con los ítems usables POSEÍDOS en el ORDEN de
 *     la tabla extendida 0xB9EE (skull key → artefactos LB → shards → herramientas).
 *   - ENTER sobre un ítem lo USA y CIERRA el picker (mode 'U' @0x1230, no equipa in situ).
 *   - ESC cierra imprimiendo "None!" (@0x1244) → "Item: None!".
 *   - Sin usables → "No usable items!" (DS 0x489f) sin abrir el picker.
 * El overlay reusa la maquinaria de Ready (#78, canal `setReadyPicker`). (Jubilada la piel
 * dev, el overlay de pergamino es el ÚNICO camino de (U)se — ya no hay popup DOM.)
 *
 * `__u5test` vive sea cual sea la piel (como en viewgem-overworld.spec.ts), así que
 * sembramos ítems y leemos la consola lógica + el picker sin depender de píxeles.
 */
import { test, expect, type Page } from "@playwright/test";
// El byte 0x1d de g_time_spell se IMPORTA del core en vez de copiarse: el literal
// duplicado es justo lo que deja rancio a un spec cuando el modelo se mueve (ea51efc8).
import { TIME_SPELL_BADGE } from "../src/core/world/blackthorn";

const CANVAS = ".faithful-skin canvas";

interface UsePickerProbe {
  phase: "select" | "pick";
  rows: { name: string; qty: number; equipped: boolean }[];
  cursor: number;
  scroll: number;
}
/** Vista del picker (reusa el hook de Ready; el overlay de Use viaja por el mismo canal). */
async function picker(page: Page): Promise<UsePickerProbe | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__u5test.readyPicker() as UsePickerProbe | null);
}
/** Consola lógica (misma fuente en dev y fiel). */
async function console_(page: Page): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__u5test.consoleLines() as string[]);
}
async function logHas(page: Page, text: string): Promise<boolean> {
  return (await console_(page)).some((l) => l.includes(text));
}
/** Mueve la barra hasta el ítem cuyo nombre contiene `label` y pulsa Enter (lo USA). */
async function pickerUse(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const pk = await picker(page);
    if (!pk || pk.phase !== "pick") throw new Error("pickerUse: el picker no está abierto");
    if (pk.rows[pk.cursor]?.name.includes(label)) {
      await page.locator("body").press("Enter");
      return;
    }
    await page.locator("body").press("ArrowDown");
  }
  throw new Error(`pickerUse: no encontré "${label}" en el picker`);
}

/** Piel fiel montada directa en overworld fresco, con __u5test listo. */
async function bootFaithful(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&loc=0&x=82&y=108");
  await expect(page.locator(CANVAS)).toBeVisible({ timeout: 30_000 });
}

/** Vacía TODO usable (la plantilla INIT puede traer alguno) y siembra los indicados. */
async function seedUsables(
  page: Page,
  over: {
    skullKeys?: number;
    crown?: boolean;
    falsehood?: boolean;
    spyglass?: boolean;
    sextant?: boolean;
    blackBadge?: boolean;
    woodenBox?: boolean;
    /** Nº de moonstones LLEVADAS (buried=false) desde la fase 0; el resto enterradas. */
    moonstonesCarried?: number;
  },
): Promise<void> {
  await page.evaluate((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    // La plantilla INIT trae scrolls/pociones (carril #7), que el picker de (U)se lista
    // ANTES de los ítems de esta tabla (usePicker.ts). Se limpian para que el picker
    // contenga SÓLO lo sembrado aquí y las aserciones de orden/vacío casen.
    if (Array.isArray(s.scrollQuantities)) s.scrollQuantities.fill(0);
    if (Array.isArray(s.potionQuantities)) s.potionQuantities.fill(0);
    s.skullKeys = o.skullKeys ?? 0;
    s.shards = { falsehood: !!o.falsehood, hatred: false, cowardice: false };
    s.lbArtifacts = { amulet: false, crown: !!o.crown, sceptre: false };
    s.specialItems = {
      spyglass: !!o.spyglass,
      hmsCape: false,
      sextant: !!o.sextant,
      pocketWatch: false,
      blackBadge: !!o.blackBadge,
      woodenBox: !!o.woodenBox,
    };
    // Moonstones: por defecto todas enterradas; las N primeras fases pasan a LLEVADAS.
    if (Array.isArray(s.moonstones)) {
      const carried = o.moonstonesCarried ?? 0;
      s.moonstones.forEach((m: { buried: boolean }, i: number) => { m.buried = i >= carried; });
    }
  }, over);
}

test("(U)se fiel: abre el overlay con los usables en orden de tabla; ENTER usa y cierra", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFaithful(page);
  await seedUsables(page, { skullKeys: 2, crown: true, falsehood: true, spyglass: true, blackBadge: true, woodenBox: true });

  // 'u' abre el OVERLAY (fase pick), no un popup DOM.
  await page.keyboard.press("u");
  const pk = await picker(page);
  expect(pk?.phase).toBe("pick");
  await expect(page.locator(".save-panel").filter({ hasText: "Item:" })).toHaveCount(0); // el DOM NO se usa en fiel
  expect(await logHas(page, "Item: ")).toBe(true); // "Item: " (DS 0x48b1)

  // Orden de la tabla extendida 0xB9EE: skull key → crown → shard → spyglass → badge → box.
  // Nombres = name-table DS 0x1916 VERBATIM (carril usepicker-fidelidad): el picker
  // pinta las abreviaturas del binario, no los nombres largos del (U)se DOM previo.
  expect(pk!.rows.map((r) => r.name)).toEqual([
    "Skull Keys",
    "Crown",
    "Shard/Falsehd",
    "Spyglass",
    "Black Badge",
    "Wooden Box",
  ]);
  // La skull key muestra su cuenta (2); los flags valen 0xff y NO llevan columna.
  expect(pk!.rows[0]).toMatchObject({ name: "Skull Keys", qty: 2, equipped: false });
  expect(pk!.rows[4]).toMatchObject({ name: "Black Badge", qty: 0xff });

  // ENTER sobre "Badge" → toggle de g_time_spell + "Badge worn!" y el picker CIERRA.
  // ★ El observable es `timeSpell`, NO un `wornBadge` propio: el 30-07 (ea51efc8) se
  // unificaron `wornBadge`/`wornAmulet`/`timeSpell` porque en el binario son UN byte
  // (DS 0x587a, 9 escrituras / 33 lecturas), y (U)se Badge escribe 0x1d ahí mismo
  // (CAST.OVL 0x1b47). `state.wornBadge` dejó de existir ese día: este aserto leía un
  // campo ausente y `undefined` no es `true`.
  expect(await page.evaluate(() => (window as any).__u5test.state().timeSpell)).not.toBe(
    TIME_SPELL_BADGE,
  );
  await pickerUse(page, "Black Badge");
  expect(await page.evaluate(() => (window as any).__u5test.state().timeSpell)).toBe(
    TIME_SPELL_BADGE,
  );
  expect(await logHas(page, "Badge worn!")).toBe(true);
  expect(await picker(page)).toBeNull(); // cerrado tras usar (mode 'U' @0x1230)

  // ECO FIEL (mode 'U' @0x1230 NO ecoa el nombre; la cabecera "Badge" CONTINÚA "Item: "):
  // la consola muestra "Item: Badge" y NO una fila "Badge" suelta (el doble eco corregido).
  const log = await console_(page);
  expect(log).toContain("Item: Badge");
  expect(log.filter((l) => l === "Badge")).toEqual([]);

  expect(errors).toEqual([]);
});

test("(U)se fiel: el eco NO repite el nombre del ítem — 'Item: Scroll', no 'Item: Vas Lor'", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFaithful(page);
  await seedUsables(page, {});
  // Siembra 1 pergamino Vas Lor (idx 0) tras el vaciado de seedUsables.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().scrollQuantities[0] = 1;
  });

  await page.keyboard.press("u");
  expect((await picker(page))?.rows.map((r) => r.name)).toEqual(["Vas Lor"]);
  await pickerUse(page, "Vas Lor"); // idx 0 = Light! (aplica luz)

  const log = await console_(page);
  // Fiel: el handler imprime "Scroll" (DS 0x466a), que continúa "Item: " → "Item: Scroll".
  expect(log).toContain("Item: Scroll");
  // El NOMBRE del pergamino NO se ecoa (el original no lo hace): nada de "Item: Vas Lor".
  expect(log.some((l) => l.includes("Vas Lor"))).toBe(false);
  expect(await logHas(page, "Light!")).toBe(true);

  expect(errors).toEqual([]);
});

test("(U)se fiel: las moonstones LLEVADAS se listan tras la regalia y (U)se las entierra", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFaithful(page);
  // Crown (regalia 0x13) + 2 moonstones llevadas (0x15-0x1c) + shard (0x1d): la moonstone
  // va ENTRE la regalia y el shard en la tabla extendida 0xB9EE.
  await seedUsables(page, { crown: true, falsehood: true, moonstonesCarried: 2 });
  // Fuerza tile enterrable (grass 0x05) bajo el party para un entierro determinista.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const p = g.state.position;
    g.setMapOverride(p.x, p.y, 0x05);
  });

  await page.keyboard.press("u");
  const pk = await picker(page);
  expect(pk?.phase).toBe("pick");
  // Orden: Crown → gema fase 0 → gema fase 1 → Shard/Falsehd.
  // Las gemas lunares viajan con su entrada CODIFICADA `(N` (sigilo '(' de la
  // name-table → "Moonstone " DS 0x9788 + el dígito de la fase, print_list_row @0x068e).
  expect(pk!.rows.map((r) => r.name)).toEqual([
    "Crown",
    "(0",
    "(1",
    "Shard/Falsehd",
  ]);
  // Flags: 0xff ⇒ sin columna de cantidad.
  expect(pk!.rows[1]).toMatchObject({ name: "(0", qty: 0xff });

  // ENTER sobre la primera "Moonstone" → la entierra (CAST.OVL 0x153c) + "buried!" y cierra.
  await pickerUse(page, "(0");
  expect(await logHas(page, "Moonstone")).toBe(true); // cabecera DS 0x4768
  expect(await logHas(page, "buried!")).toBe(true); // éxito DS 0x4773
  expect(await picker(page)).toBeNull();
  // La fase 0 quedó enterrada en la posición del party (plantó su moongate personal).
  const buried0 = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    return s.moonstones[0].buried === true;
  });
  expect(buried0).toBe(true);

  expect(errors).toEqual([]);
});

test("(U)se fiel: sin usables → 'No usable items!' y NO abre el picker", async ({ page }) => {
  await bootFaithful(page);
  await seedUsables(page, {}); // todo vacío
  await page.keyboard.press("u");
  expect(await picker(page)).toBeNull(); // no se abrió el overlay
  await expect(page.locator(".save-panel").filter({ hasText: "Item:" })).toHaveCount(0);
  expect(await logHas(page, "No usable items!")).toBe(true); // DS 0x489f
});

test("(U)se fiel: ESC cierra el picker con 'None!' → 'Item: None!'", async ({ page }) => {
  await bootFaithful(page);
  await seedUsables(page, { spyglass: true, woodenBox: true });
  await page.keyboard.press("u");
  expect((await picker(page))?.phase).toBe("pick");
  await page.locator("body").press("Escape");
  expect(await picker(page)).toBeNull(); // cerrado
  // "Item: " + "None!" en la misma fila (@0x1244, DS 0x9976).
  expect(await logHas(page, "Item: None!")).toBe(true);
  // No mutó nada (no se usó ningún ítem): spyglass sigue poseído.
  expect(await page.evaluate(() => (window as any).__u5test.state().specialItems.spyglass)).toBe(true);
});

// El caso "(U)se DEV: la piel dev SÍ usa el popup DOM" se retiró al jubilar la piel dev
// (fase 2): ya no hay popup DOM de (U)se — el ÚNICO camino es el overlay de pergamino de
// la piel fiel (cubierto por los tests de arriba). No queda un A/B dev-vs-fiel que probar.
