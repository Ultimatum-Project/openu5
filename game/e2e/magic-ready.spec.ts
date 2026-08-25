/**
 * Task E2E-10 — Journey de magia (Mix/Cast) y equipamiento (Ready) en el browser
 * real. Verifica el CABLEADO del SelectorPanel (main.ts doMix/doCast/doReady)
 * contra las reglas EXACTAS ya portadas y testeadas en unit:
 *   - Mix (core/magic/mix.ts): consume 1 de cada reagente del hechizo e
 *     incrementa su cantidad mezclada.
 *   - Cast (core/magic/cast.ts): consume el hechizo mezclado ANTES del check de
 *     maná y el coste de maná = CÍRCULO del hechizo (CAST:0x0ec8/0x0ef8).
 *   - Ready (core/equip.ts): toggle equipar/desequipar y el gate de ENCUMBRANCE
 *     (Σ pesos ≤ Fuerza) y de manos (arma de dos manos exige ambas libres),
 *     ZSTATS try_equip_or_unequip @0x0c5c.
 *
 * INTERACCIÓN FIEL (no popup DOM): el picker de MIEMBRO es el roster fiel
 * `select_party_member` (#17: '1'..'N' eligen directo). El nombre de HECHIZO
 * (Cast/Mix) se TECLEA por iniciales rúnicas (CAST2.OVL 0x00de: "i"→"IN", "l"→"LOR";
 * #26). El ÍTEM de Ready es un OVERLAY DE PERGAMINO sobre el panel (task #78,
 * `item_page_controller` @0x0f2e): barra de selección que se mueve con ↓, Enter
 * equipa/desequipa in situ, ESC cierra ("Item: Done"). Los flujos:
 *   'm' → teclea "il" → "For what spell? IN LOR"        (nombre TECLEADO)
 *   'c' → picker miembro ('1') → teclea "il" → "Spell name: IN LOR"
 *   'r' → "Player: " (roster ►Select:◄) → '1' → "Item: " + overlay del picker
 *
 * ESTADO INIT del Avatar "Mago" tras la gitana all-A (verificado en la pasada):
 * class A, level 2, STR 20, INT 22, MP 22; weapon=30, armor=13, helmet=1,
 * shield=255(libre). Posición = loc 13 (pueblo). Reagentes Ash=4, Ginseng=6,
 * Garlic=7, Silk=6, Pearl=3. spellQuantities: In Lor(0)=6, An Nox(3)=10…
 *
 * Hechizo elegido: In Lor (índice 0, CÍRCULO 1). Motivos: (a) mezclable con el
 * INIT (usa 1 reagente, Ash=SulfurAsh idx 0, hay 4); (b) su ventana temporal
 * TIME_PERMITTED_BITS[0]=0x0e incluye el bit de pueblo (0x04), así que es
 * lanzable en loc 13; (c) su efecto es GLOBAL (luz) sin picker de objetivo → el
 * casteo se resuelve determinista y podemos afirmar el coste de maná = círculo
 * = 1 sin ramas extra. Level 2 ≥ círculo 1, así que no hay gate silencioso de
 * nivel.
 */
import { test, expect, type Page } from "@playwright/test";
import { createCharacter, readState, hudLog } from "./helpers";

/** Elige el miembro `n` (1-based) en el picker de roster fiel (select_party_member). */
async function pickMemberNum(page: Page, n: number): Promise<void> {
  await page.locator("body").press(String(n));
}

/**
 * Teclea un nombre de hechizo por sus INICIALES rúnicas (Cast/Mix, getstring
 * CAST2.OVL 0x00de) y lo envía con Enter. `initials` p.ej. "il" → ecoa "IN LOR"
 * → In Lor. Réplica de la entrada TECLEADA fiel (no scroller).
 */
async function typeSpell(page: Page, initials: string): Promise<void> {
  for (const ch of initials) await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
}

/** Teclea la cantidad de Mix ("How much?" DS 0x8f72) y la envía (Enter). */
async function typeQuantity(page: Page, n: number): Promise<void> {
  for (const ch of String(n)) await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
}

/**
 * Conduce el SELECTOR de reagentes de Mix (CMDS 0x18be, reutiliza el overlay de Ready):
 * mueve el cursor con ↓ hasta cada reagente de `names`, lo MARCA con Enter, y pulsa 'M'
 * para mezclar. Lee la vista real (`__u5test.readyPicker`), robusto al orden de la lista.
 * Con `names` vacío pulsa 'M' sin marcar nada (selección vacía → "Nothing to mix!").
 */
async function mixSelectReagents(page: Page, names: string[]): Promise<void> {
  for (const name of names) {
    let done = false;
    for (let i = 0; i < 12 && !done; i++) {
      const pk = await readyPicker(page);
      if (!pk || pk.phase !== "pick") throw new Error("el selector de reagentes no está abierto");
      const cur = pk.rows[pk.cursor];
      if (cur && cur.name.includes(name)) {
        await page.locator("body").press("Enter"); // marca
        done = true;
      } else {
        await page.locator("body").press("ArrowDown");
      }
    }
    if (!done) throw new Error(`no encontré el reagente "${name}" en el selector`);
  }
  await page.locator("body").press("m"); // 'M' → mezclar
}

/** Estado del picker de Ready (task #78) expuesto por __u5test para el e2e. */
interface ReadyPickerProbe {
  phase: "select" | "pick";
  rows: { name: string; qty: number; equipped: boolean }[];
  cursor: number;
  scroll: number;
}
async function readyPicker(page: Page): Promise<ReadyPickerProbe | null> {
  return page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__u5test.readyPicker() as ReadyPickerProbe | null,
  );
}

/**
 * Conduce el OVERLAY del picker de Ready (`item_page_controller` @0x0f2e): con el
 * picker ya abierto (fase `pick`), mueve la barra de selección con ↓ hasta el ítem
 * cuyo nombre contiene `label` y lo EQUIPA con Enter (el picker sigue abierto). Lee la
 * vista real (`__u5test.readyPicker`), así que es robusto al orden/scroll de la lista.
 */
async function pickerEquip(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const pk = await readyPicker(page);
    if (!pk || pk.phase !== "pick") throw new Error("pickerEquip: el picker no está abierto");
    const cur = pk.rows[pk.cursor];
    if (cur && cur.name.includes(label)) {
      await page.locator("body").press("Enter");
      return;
    }
    await page.locator("body").press("ArrowDown");
  }
  throw new Error(`pickerEquip: no encontré "${label}" en el picker`);
}

/** Cierra el picker de Ready (ESC → "Item: Done", vuelve al roster). */
async function pickerClose(page: Page): Promise<void> {
  await page.locator("body").press("Escape");
}

const ALL_A = ["A", "A", "A", "A", "A", "A", "A"] as const;

// Índices en spellQuantities / reagentQuantities.
const IN_LOR = 0; // hechizo In Lor (círculo 1)
const REAGENT_ASH = 0; // SulfurAsh — único reagente de In Lor
const IN_LOR_CIRCLE = 1; // coste de maná = círculo (regla exacta CAST:0x0ef8)

// Equipment ids del inventario INIT (verificados en la pasada).
const DAGGER = 16; // arma de una mano (peso 1)
const SMALL_SHIELD = 4; // escudo de una mano (peso 2)
const FLAMING_OIL = 19; // "arma" de DOS manos (peso 2)

/** ¿Alguna línea del log del HUD contiene `text`? (robusto a prefijos/espacios). */
async function logHas(page: Page, text: string): Promise<boolean> {
  return (await hudLog(page)).some((l) => l.includes(text));
}

test("Mix + Cast de In Lor: Mix consume el reagente correcto; Cast cuesta maná = círculo", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);

  // Baseline exacto del INIT (deriva de la plantilla; se afirma para regresión).
  const reagentsBefore = await readState<number[]>(page, "reagentQuantities");
  const spellsBefore = await readState<number[]>(page, "spellQuantities");
  expect(reagentsBefore[REAGENT_ASH]).toBe(4);
  expect(spellsBefore[IN_LOR]).toBe(6);

  // --- MIX ---------------------------------------------------------------
  await page.keyboard.press("m");
  await typeSpell(page, "il"); // TECLEADO "For what spell? IN LOR" (iniciales I,L)
  await mixSelectReagents(page, ["Sulfur Ash"]); // marca el reagente CORRECTO de In Lor
  await typeQuantity(page, 1); // "How much? 1" (DS 0x8f72) → mezcla 1

  const reagentsAfterMix = await readState<number[]>(page, "reagentQuantities");
  const spellsAfterMix = await readState<number[]>(page, "spellQuantities");
  // In Lor gasta 1 Ash (SulfurAsh) y NADA más; su cuenta mezclada sube en 1.
  expect(reagentsAfterMix[REAGENT_ASH]).toBe(3); // 4 → 3
  expect(spellsAfterMix[IN_LOR]).toBe(7); // 6 → 7
  // Ningún otro reagente ni hechizo cambia (consumo del reagente CORRECTO).
  reagentsBefore.forEach((v, i) => {
    if (i !== REAGENT_ASH) expect(reagentsAfterMix[i]).toBe(v);
  });
  spellsBefore.forEach((v, i) => {
    if (i !== IN_LOR) expect(spellsAfterMix[i]).toBe(v);
  });
  // Mensajes fieles del comando Mix: "Mixing..." (DS 0x8ff0) y luego "Done!" (DS 0x8ffc).
  expect(await logHas(page, "Mixing...")).toBe(true);
  expect(await logHas(page, "Done!")).toBe(true);

  // --- CAST --------------------------------------------------------------
  const mpBefore = await readState<number>(page, "characters[0].currentMp");
  expect(mpBefore).toBe(22); // MP = INT tras la gitana all-A
  const mixedBeforeCast = await readState<number>(page, `spellQuantities[${IN_LOR}]`);
  expect(mixedBeforeCast).toBe(7);

  await page.keyboard.press("c");
  await pickMemberNum(page, 1); // el Avatar (Mago) es el caster
  await typeSpell(page, "il"); // TECLEADO "Spell name: IN LOR" (iniciales I,L)

  // REGLA DE ORO: el coste de maná al lanzar = CÍRCULO del hechizo (=1 para In Lor).
  const mpAfter = await readState<number>(page, "characters[0].currentMp");
  expect(mpAfter).toBe(mpBefore - IN_LOR_CIRCLE); // 22 − 1 = 21
  // El hechizo mezclado se consume (−1) al lanzar.
  expect(await readState<number>(page, `spellQuantities[${IN_LOR}]`)).toBe(mixedBeforeCast - 1); // 7 → 6
  // Efecto real de In Lor: enciende luz (lightSpellMins = 100, CAST2:0x08ea).
  expect(await readState<number>(page, "lightSpellMins")).toBe(100);
  // Éxito SILENCIOSO (In Lor es global, CAST 0x11a6 → sin string): ni "In Lor!" ni
  // "A light surrounds thee!" (ambos flavor FABRICADO, purgados en el lote cast-echo).
  // lightSpellMins=100 (arriba) prueba el efecto; el eco rúnico "IN LOR" es la única traza.
  expect(await logHas(page, "IN LOR")).toBe(true);
  expect(await logHas(page, "In Lor!")).toBe(false);
  expect(await logHas(page, "A light surrounds thee!")).toBe(false);
});

// Discriminantes de la entrada TECLEADA de Cast (CAST2.OVL 0x00de): expansión de
// iniciales, ESC (retorno -1 "None!"), nombre no válido (retorno -2 "No effect!"),
// backspace, y hechizo válido pero NO mezclado ("None mixed!"). Reproduce el reporte
// del usuario (#26): el original TECLEA, no scrollea una lista fija de "In Lor".
test("Cast tecleado: ESC=None!, nombre inválido=No effect!, backspace, no-mezclado=None mixed!", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  const MP0 = await readState<number>(page, "characters[0].currentMp"); // 22
  expect(await readState<number>(page, `spellQuantities[${IN_LOR}]`)).toBe(6);

  // (A) ESC tras teclear una inicial → "None!" (ret -1). No castea: MP intacto.
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await page.locator("body").press("i"); // ecoa "IN"
  await page.locator("body").press("Escape");
  expect(await logHas(page, "None!")).toBe(true);
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(MP0);

  // (B) Nombre que NO es hechizo ("In Kal" = I,K) → "No effect!" (ret -2). MP intacto.
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "ik");
  expect(await logHas(page, "No effect!")).toBe(true);
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(MP0);

  // (C) BACKSPACE: teclea I,Z ("IN ZU"), borra la última sílaba (→ "IN"), teclea L
  // (→ "IN LOR") y envía. Castea In Lor (no An Zu): −1 maná, −1 mezclado.
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await page.locator("body").press("i");
  await page.locator("body").press("z"); // "IN ZU"
  await page.locator("body").press("Backspace"); // borra ZU → "IN"
  await page.locator("body").press("l"); // "IN LOR"
  await page.locator("body").press("Enter");
  // In Lor global → éxito silencioso: sin "In Lor!" (fabricado). El eco rúnico final tras
  // el backspace es "IN LOR"; el maná/mezclado (abajo) prueban que casteó In Lor (no An Zu).
  expect(await logHas(page, "IN LOR")).toBe(true);
  expect(await logHas(page, "In Lor!")).toBe(false);
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(MP0 - IN_LOR_CIRCLE); // 22 → 21
  expect(await readState<number>(page, `spellQuantities[${IN_LOR}]`)).toBe(5); // 6 → 5

  // (D) Hechizo VÁLIDO pero NO mezclado → "None mixed!" (CAST 0x0ebb). El original
  // deja teclear cualquier hechizo (sin pre-filtro); el gate lo aplica el cast.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().spellQuantities[0] = 0; // vacía In Lor
  });
  const mpBeforeD = await readState<number>(page, "characters[0].currentMp"); // 21
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "il");
  expect(await logHas(page, "None mixed!")).toBe(true);
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(mpBeforeD); // sin coste
});

test("Ready: equipar un arma la mueve al slot y re-elegirla la desequipa (toggle)", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);

  // SETUP (vía __u5test, permitido para preparar el escenario): el Avatar INIT
  // ya está al límite de encumbrance (Σ pesos 20 = STR 20), así que NINGÚN item
  // cabe sin liberar peso. Vaciamos la mano de arma (weapon 30 → Nothing) para
  // que quede holgura y un slot destino libre. El ASSERT sigue siendo sobre el
  // efecto REAL de la tecla 'r' / el panel.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().characters[0].weapon = 0xff;
  });

  const daggerQtyBefore = await readState<number>(page, `equipmentQuantities[${DAGGER}]`);
  expect(daggerQtyBefore).toBe(6);
  expect(await readState<number>(page, "characters[0].weapon")).toBe(0xff);

  // --- EQUIPAR -----------------------------------------------------------
  // 'r' → fase select (banner ►Select:◄ + "Player: "); '1' elige al Avatar y abre el
  // OVERLAY de pergamino ("Item: "). El picker se conduce con ↓/Enter (no scroller).
  await page.keyboard.press("r");
  await pickMemberNum(page, 1); // "Player: <nombre>" + abre el picker
  expect(await logHas(page, "Player: ")).toBe(true);
  const pk = await readyPicker(page);
  expect(pk?.phase).toBe("pick"); // el overlay está abierto (no un scroller de consola)
  await pickerEquip(page, "Dagger"); // barra de selección → Dagger → Enter (equipa in situ)

  // El Dagger pasa del inventario (−1) al slot de arma del Avatar. El equipado con
  // éxito NO imprime nada (F1.9): el binario calla al equipar. El efecto REAL (el ítem
  // en el slot + el inventario decrementado) es la aserción; el picker sigue abierto.
  expect(await readState<number>(page, `equipmentQuantities[${DAGGER}]`)).toBe(daggerQtyBefore - 1); // 6 → 5
  expect(await readState<number>(page, "characters[0].weapon")).toBe(DAGGER);
  // ESC cierra el picker → "Item: Done" (DS 0x9970).
  await pickerClose(page);
  expect(await logHas(page, "Item: Done")).toBe(true);

  // --- TOGGLE OFF (re-elegir el mismo item lo desequipa) -----------------
  await page.keyboard.press("r");
  await pickMemberNum(page, 1);
  await pickerEquip(page, "Dagger"); // re-selecciona el Dagger equipado → toggle-off
  await pickerClose(page);

  // Vuelve al inventario (+1) y el slot de arma queda libre.
  expect(await readState<number>(page, `equipmentQuantities[${DAGGER}]`)).toBe(daggerQtyBefore); // 5 → 6
  expect(await readState<number>(page, "characters[0].weapon")).toBe(0xff);
});

test("Ready: gates de encumbrance y de manos rechazan sin mutar el estado", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  // Estado natural: Σ pesos = 20 = STR 20 (sin holgura) y la mano de arma
  // ocupada por weapon=30. Ambos gates son alcanzables sin ningún setup.

  // (a) ENCUMBRANCE (regla exacta 3.12): equipar Small Shield (peso 2) sobrepasa
  // la Fuerza (20+2 > 20) → "Thou art not strong enough!"; nada cambia.
  const shieldQtyBefore = await readState<number>(page, `equipmentQuantities[${SMALL_SHIELD}]`);
  expect(shieldQtyBefore).toBe(1);
  await page.keyboard.press("r");
  await pickMemberNum(page, 1);
  await pickerEquip(page, "Sm. Shield");
  expect(await logHas(page, "Thou art not strong enough!")).toBe(true);
  await pickerClose(page);
  expect(await readState<number>(page, `equipmentQuantities[${SMALL_SHIELD}]`)).toBe(shieldQtyBefore); // sin cambio
  expect(await readState<number>(page, "characters[0].shield")).toBe(0xff); // sigue libre

  // (b) MANOS (arma de DOS manos con la mano de arma ocupada): Flaming Oil
  // exige ambas manos libres → "Both hands must be free…"; nada cambia.
  const oilQtyBefore = await readState<number>(page, `equipmentQuantities[${FLAMING_OIL}]`);
  expect(oilQtyBefore).toBe(3);
  await page.keyboard.press("r");
  await pickMemberNum(page, 1);
  await pickerEquip(page, "Flame Oil");
  expect(await logHas(page, "Both hands must be free before thou canst wield that!")).toBe(true);
  await pickerClose(page);
  expect(await readState<number>(page, `equipmentQuantities[${FLAMING_OIL}]`)).toBe(oilQtyBefore); // sin cambio
  expect(await readState<number>(page, "characters[0].weapon")).toBe(30); // arma original intacta
});

// Cantidad de Mix "How much?" (DS 0x8f72; CMDS.OVL 0x1a70): tras el nombre del
// hechizo el original lee un número TECLEADO (getnum 0x7c1e) y mezcla N de golpe
// consumiendo N× cada reagente. Pedir más de lo disponible → "Insufficient
// reagents!" (DS 0x8f7e) y RE-PREGUNTA (bucle 0x1ac6), sin gastar nada. Mix NO
// toca RNG (consumo determinista).
test("Mix cantidad N: mezcla N× consume N reagentes; N > reagentes = Insufficient + re-pregunta", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);

  const reagentsBefore = await readState<number[]>(page, "reagentQuantities");
  const spellsBefore = await readState<number[]>(page, "spellQuantities");
  expect(reagentsBefore[REAGENT_ASH]).toBe(4); // 4 Ash de arranque
  expect(spellsBefore[IN_LOR]).toBe(6);

  // (A) INSUFICIENTE: pedir 9 de In Lor (sólo 4 Ash) → "Insufficient reagents!" y
  // re-pregunta; NADA se gasta todavía. Luego, en el MISMO prompt re-armado, teclear
  // 3 (disponible) mezcla de golpe: Ash 4→1, In Lor 6→9.
  await page.keyboard.press("m");
  await typeSpell(page, "il");
  await mixSelectReagents(page, ["Sulfur Ash"]); // marca Ash (correcto de In Lor)
  await typeQuantity(page, 9); // > 4 Ash → rechazado, re-pregunta
  expect(await logHas(page, "Insufficient reagents!")).toBe(true);
  // Nada consumido tras el rechazo.
  const rAfterReject = await readState<number[]>(page, "reagentQuantities");
  const sAfterReject = await readState<number[]>(page, "spellQuantities");
  expect(rAfterReject[REAGENT_ASH]).toBe(4);
  expect(sAfterReject[IN_LOR]).toBe(6);

  // El prompt sigue vivo (re-pregunta): teclear 3 ahora sí mezcla.
  await typeQuantity(page, 3);
  const rAfterMix = await readState<number[]>(page, "reagentQuantities");
  const sAfterMix = await readState<number[]>(page, "spellQuantities");
  expect(rAfterMix[REAGENT_ASH]).toBe(1); // 4 − 3
  expect(sAfterMix[IN_LOR]).toBe(9); // 6 + 3
  // Ningún otro reagente/hechizo cambia.
  reagentsBefore.forEach((v, i) => {
    if (i !== REAGENT_ASH) expect(rAfterMix[i]).toBe(v);
  });
  spellsBefore.forEach((v, i) => {
    if (i !== IN_LOR) expect(sAfterMix[i]).toBe(v);
  });

  // (B) N=0 (sólo Enter): aborta EN SILENCIO (0x1b71 jle) sin gastar nada.
  await page.keyboard.press("m");
  await typeSpell(page, "il");
  await mixSelectReagents(page, ["Sulfur Ash"]);
  await typeQuantity(page, 0); // "How much?" vacío/0 → aborta
  const rAfterZero = await readState<number[]>(page, "reagentQuantities");
  const sAfterZero = await readState<number[]>(page, "spellQuantities");
  expect(rAfterZero[REAGENT_ASH]).toBe(1); // sin cambio respecto a (A)
  expect(sAfterZero[IN_LOR]).toBe(9);
});

// Precheck de Mix "No reagents owned!" (DS 0x8f98; CMDS.OVL 0x1ae0-0x1af8): si la
// suma de TODOS los reagentes es 0, el original aborta ANTES de preguntar el hechizo.
test("Mix sin reagentes: 'No reagents owned!' aborta antes de abrir el prompt del nombre", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  // Vaciar TODOS los reagentes (estado vivo del port vía __u5test).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().reagentQuantities.fill(0);
  });
  const spellsBefore = await readState<number[]>(page, "spellQuantities");

  await page.keyboard.press("m");
  expect(await logHas(page, "No reagents owned!")).toBe(true);
  // El prompt del nombre NO se abrió (abortó antes): no hay eco "For what spell?".
  expect(await logHas(page, "For what spell?")).toBe(false);
  // Nada mezclado.
  const spellsAfter = await readState<number[]>(page, "spellQuantities");
  expect(spellsAfter).toEqual(spellsBefore);
});

// Selector de reagentes con flechas (CMDS 0x18be): la mezcla con reagentes INCORRECTOS
// GASTA los marcados pero NO acredita el hechizo (0x1bf6); la selección VACÍA →
// "Nothing to mix!" (DS 0x9004, 0x1b78). El reagente correcto de In Lor es Sulfur Ash.
const REAGENT_GINSENG = 1;
test("Mix selector: reagentes incorrectos se desperdician sin carga; selección vacía = Nothing to mix!", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  const rBefore = await readState<number[]>(page, "reagentQuantities");
  const sBefore = await readState<number[]>(page, "spellQuantities");
  expect(rBefore[REAGENT_GINSENG]).toBe(6); // Ginseng de arranque (all-A)

  // (A) INCORRECTO: In Lor pide Sulfur Ash, pero marcamos GINSENG. Se gasta el Ginseng
  //     (×2) y NO sube In Lor (máscara no casa). Ash intacto.
  await page.keyboard.press("m");
  await typeSpell(page, "il");
  await mixSelectReagents(page, ["Ginseng"]); // reagente equivocado
  await typeQuantity(page, 2);
  const rAfterWrong = await readState<number[]>(page, "reagentQuantities");
  const sAfterWrong = await readState<number[]>(page, "spellQuantities");
  expect(rAfterWrong[REAGENT_GINSENG]).toBe(4); // 6 − 2: gastado igual
  expect(rAfterWrong[REAGENT_ASH]).toBe(rBefore[REAGENT_ASH]); // Ash intacto
  expect(sAfterWrong[IN_LOR]).toBe(sBefore[IN_LOR]); // In Lor SIN carga
  expect(await logHas(page, "Mixing...")).toBe(true);
  expect(await logHas(page, "Done!")).toBe(false); // no acierta → sin "Done!"

  // (B) VACÍA: abrir el selector y pulsar 'M' sin marcar nada → "Nothing to mix!";
  //     tras la cantidad (que se pregunta igual), NADA se gasta.
  const rBeforeEmpty = await readState<number[]>(page, "reagentQuantities");
  await page.keyboard.press("m");
  await typeSpell(page, "il");
  await mixSelectReagents(page, []); // sólo 'M', nada marcado
  await typeQuantity(page, 1);
  expect(await logHas(page, "Nothing to mix!")).toBe(true);
  expect(await readState<number[]>(page, "reagentQuantities")).toEqual(rBeforeEmpty);
});
