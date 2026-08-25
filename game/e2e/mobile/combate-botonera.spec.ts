/**
 * #126b — LOS NUEVE BOTONES DE COMBATE TIENEN QUE PODER PULSARSE, no sólo existir.
 *
 * EL DEFECTO QUE ESTE FICHERO EXISTE PARA IMPEDIR (medido en navegador, 08-08). Cuando
 * main subió el deck de combate de 2 a 9 botones (f5f63f02), en un iPhone 13 VERTICAL tres
 * de los nueve —Use, Get, Klimb— se pintaban a 12 px de ancho y NO se podían pulsar:
 * `elementFromPoint` sobre su centro devolvía la cruceta. Causa: `.touch-wide
 * {grid-column: span 2}` de Attack/Pass pedía dos columnas a una rejilla `auto-fill` en la
 * que sólo cabía UNA pista de 112 px; la segunda nacía IMPLÍCITA y colapsaba a 12 px.
 *
 * 🔴 POR QUÉ EL PREDICADO NO ES «¿ESTÁN LOS NUEVE?». Porque esa pregunta YA RESPONDÍA QUE
 * SÍ con el defecto puesto. Los nueve estaban en el DOM, los nueve tenían `offsetParent`
 * no nulo, y un censo por `COMBAT_BUTTONS.length` daba 9/9 — verde, con tres botones
 * inservibles en pantalla. Lo que hay que preguntar es por la GEOMETRÍA VIVA: ancho real
 * y quién responde en el centro del botón. De ahí que esto sea e2e y no un test de
 * `tests/`: en jsdom todo rect mide 0 y no hay `elementFromPoint` que valga.
 *
 * SE MIDEN LOS NUEVE, NO LOS VISIBLES. El raíl es un scroller y varios caen bajo el
 * pliegue: eso es normal y no es el defecto (el deck del mundo lleva 25 así). Por eso cada
 * botón se ARRASTRA A LA VISTA antes de medirlo — si no, el aserto sólo cubriría los
 * primeros y justo los tapados se escaparían.
 *
 * 🔴 Y EL LAYOUT NO ES UN DETALLE: el defecto es DEL DECK `bloques`, no del móvil entero.
 * Censado en navegador con el fix puesto y anulado, sobre los tres arranques que sirve el
 * juego (iPhone 13 vertical, en combate):
 *   · sin bandera  → `bloques`, rejilla «112px 12px»  → DEFECTO (es lo que ve un móvil real)
 *   · reflow=cuadrado → `bloques`, «112px 12px»       → DEFECTO
 *   · reflow=0 (clásico) → sin deck-ancho, «76px 76px» → SANO, y el fix no lo mueve
 * La primera versión de este fichero arrancaba con `gotoMobile(…, "invariante")`, que en el
 * proyecto `iphone` resuelve a `reflow=0` — o sea que medía justo el layout SANO. El aserto
 * pasaba en verde sin guardar nada, y quien lo destapó fue el CONTROL de abajo, no el
 * aserto: por eso el control no es adorno. Se fija a `partido`, que sí sirve `bloques`.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoMobile, inCombat, soloEnLayout } from "./deck";

/** Suelo de diana táctil de iOS, el mismo que usa el resto del deck. */
const SUELO_PX = 44;

/** Los nueve de `COMBAT_BUTTONS` (ui/touch.ts). El cardinal es parte del aserto. */
const ESPERADOS = ["Attack", "Pass", "Cast", "Use", "Ready", "Get", "Open", "Klimb", "Ztats"];

/**
 * Claro de hierba a las 02:00: el gate de aparición nocturno dispara con p≈0,1 por turno y
 * `Search` tiquea el turno sin mover al grupo. Misma receta determinista que
 * `e2e/combat.spec.ts`; no se inyecta estado, se entra en combate por donde se entra.
 */
const CLARO = { loc: 0, x: 102, y: 43, hour: 2 };

async function entrarEnCombate(page: Page): Promise<void> {
  for (let i = 0; i < 250; i++) {
    if (await inCombat(page)) return;
    await page.keyboard.press("s");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(25);
  }
  throw new Error("no se entró en combate en 250 turnos de Search");
}

/** Ancho y alcanzabilidad REALES de cada botón del raíl, tras traerlo a la vista. */
async function auditarBotones(page: Page): Promise<
  { rotulo: string; w: number; h: number; propio: boolean }[]
> {
  const n = await page.locator(".touch-commands button").count();
  const filas = [];
  for (let i = 0; i < n; i++) {
    const b = page.locator(".touch-commands button").nth(i);
    await b.scrollIntoViewIfNeeded();
    filas.push(
      await b.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          rotulo: (el.textContent ?? "").trim(),
          w: Math.round(r.width),
          h: Math.round(r.height),
          // «propio» = el punto medio del botón me devuelve A MÍ (o a un hijo mío), no a
          // otro elemento encima. Es la diferencia entre «está» y «se puede pulsar».
          propio: hit != null && (el === hit || el.contains(hit)),
        };
      }),
    );
  }
  return filas;
}

test("los 9 botones de combate son pulsables en vertical (no sólo presentes)", async ({ page }) => {
  // Pinchada a `partido`: es uno de los dos arranques que sirven el deck `bloques`, donde
  // vive el defecto. En `clasico` la rejilla es otra y no hay nada que guardar.
  test.skip(soloEnLayout("partido"), "el defecto es del deck `bloques` (partido / sin bandera)");
  test.setTimeout(180_000);
  await gotoMobile(page, "partido", CLARO);
  await entrarEnCombate(page);
  await page.waitForTimeout(500);

  const filas = await auditarBotones(page);
  const rotulos = filas.map((f) => f.rotulo);

  // (a) El deck de combate ENTERO, por rótulo y cardinal: si alguien recorta la lista, o
  //     la sustituye por la del mundo, esto lo dice nombrando lo que falta.
  expect(rotulos).toEqual(ESPERADOS);

  // (b) Y el aserto que el censo por lista NO puede hacer: ninguno enano, ninguno tapado.
  const enanos = filas.filter((f) => f.w < SUELO_PX || f.h < SUELO_PX);
  const tapados = filas.filter((f) => !f.propio);
  expect(
    { enanos: enanos.map((f) => `${f.rotulo}=${f.w}x${f.h}`), tapados: tapados.map((f) => f.rotulo) },
  ).toEqual({ enanos: [], tapados: [] });
});

/**
 * CONTROL DE NO-VACUIDAD del aserto (b). Si algún día la rejilla dejara de producir la
 * columna implícita por otra razón, (b) seguiría verde sin estar guardando nada. Aquí se
 * RE-INTRODUCE el defecto exacto —el `span 2` sobre un raíl de una sola pista— y se exige
 * que el predicado lo VEA. Si esto pasa a verde, el guard de arriba se quedó sin dientes.
 */
test("control: re-introducir el span 2 vuelve a romper tres botones", async ({ page }) => {
  test.skip(soloEnLayout("partido"), "mismo layout que el aserto que controla");
  test.setTimeout(180_000);
  await gotoMobile(page, "partido", CLARO);
  await entrarEnCombate(page);
  await page.waitForTimeout(500);

  await page.addStyleTag({ content: `.touch-wide { grid-column: span 2 !important; }` });
  await page.waitForTimeout(300);

  const filas = await auditarBotones(page);
  const malos = filas.filter((f) => f.w < SUELO_PX || !f.propio).map((f) => f.rotulo);
  expect(malos.length).toBeGreaterThan(0);
});
