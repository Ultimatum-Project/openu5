/**
 * BOTONERA DE TECLAS DE LA INTRO EN MÓVIL (carril intro-teclas, ficha #33).
 *
 * PETICIÓN DEL USUARIO (probando en su iPhone): «en movil en intro hay que poner
 * teclado de up down y enter y esc por que es muy dificil hacer tap en los items
 * del menu de intro».
 *
 * LA CIFRA QUE CONVIERTE «es difícil» EN PÍXELES (medida, no supuesta — Chromium
 * 390×844 @3x, `hasTouch`, contra el árbol de este carril):
 *   · `integerScale(390, 844)` = min(⌊390/320⌋, ⌊844/200⌋) = min(1, 4) = **1**.
 *     El canvas de la portada se sirve a 320×200 CSS px CLAVADOS (medido:
 *     `getBoundingClientRect()` = 320×200 en el iPhone del usuario).
 *   · Una opción del menú ocupa UNA fila de rejilla = 8 px lógicos ⇒ **8,00 px CSS
 *     de alto**. Las 6 opciones caben en 48 px de alto TOTAL (filas 17..22).
 *   · El suelo táctil de la casa (`e2e/mobile/suelo-tactil.ts`, iOS HIG) es 44 px.
 *     8 px son el **18 %** de ese suelo, y las filas son CONTIGUAS: un dedo que
 *     yerre 8 px no falla el tap — dispara la opción de al lado. Por eso «Return to
 *     the View» (que relanza el demo) o «Journey Onward» (que da «No active game»)
 *     salen cuando se quería «Create New Character».
 *
 * QUÉ ES LA BOTONERA. Un TECLADO, no un menú: cada botón sintetiza la MISMA tecla
 * que un teclado físico y la máquina de fases decide qué hacer con ella (cero
 * lógica duplicada — el mismo principio que el deck del juego, `ui/touch.ts:press`).
 * El menú tappable por renglón (`menuRowHit`) SE QUEDA: la botonera es la vía
 * gruesa, el renglón la vía directa.
 *
 * POR QUÉ NO HAY «Esc» EN EL MENÚ — y por qué eso NO es una omisión. El menú del
 * original enumera EXHAUSTIVAMENTE los códigos que acepta (INTRO.OVL, traductor
 * 0x0e16-0x0e42): 0x0d Enter (0x0da1), 0x00 timeout→'R' (0x0dec), 1/2/3/4 flechas
 * (0x0da8-0x0dbe → dec/inc di en 0x0dc4/0x0dd8), 0x20 Space, y las hotkeys 0x41 'A',
 * 0x43 'C', 0x4a 'J', 0x52 'R', 0x54 'T', 0x55 'U'. **Todo lo demás cae en 0x0e27**
 * (`mov byte [bp-0xe], 0`) = se ignora y se vuelve al bucle. 0x1b (ESC) NO está: en
 * INTRO.OVL el ESC sólo vive en el flujo Transfer-from-U4 («or press <Esc> to abort
 * transfer», 0x33b8 / 0x13f5, `re/notes/intro.md:176-177`). Un botón Esc en el menú
 * sería un botón MUERTO en la primera pantalla del embudo. El Esc aparece donde SÍ
 * hace algo (story/sex), y el test lo ata a esa razón en vez de a un gusto.
 */
import { describe, expect, it } from "vitest";
import {
  INTRO_PAD_KEYS,
  introPadKeys,
  menuFirstRow,
  menuKeyReducer,
  MENU_COMMANDS,
  type MenuState,
} from "../src/skin/fiel/intro.js";

/** Escala entera del canvas de la intro a 390 px de ancho (medida arriba). */
const S_390 = 1;
/** Alto de una fila de rejilla en px lógicos. */
const ROW = 8;
/** Suelo táctil de la casa (iOS HIG). Ver e2e/mobile/suelo-tactil.ts. */
const SUELO = 44;

describe("la cifra: el renglón del menú a 390 px es 8 px CSS, el 18 % del suelo táctil", () => {
  it("una opción del menú mide 8 px CSS de alto en el iPhone del usuario", () => {
    expect(ROW * S_390).toBe(8);
    expect(ROW * S_390).toBeLessThan(SUELO);
  });

  it("las 6 opciones enteras caben en 48 px — menos que UN objetivo táctil legal", () => {
    const bloque = MENU_COMMANDS.length * ROW * S_390;
    expect(bloque).toBe(48);
    expect(bloque).toBeLessThan(SUELO + ROW); // el bloque entero no llega a un botón y pico
    // Y arranca en la fila 17 con logo (fuente única con el pintado).
    expect(menuFirstRow(true)).toBe(17);
  });
});

describe("introPadKeys — la botonera POR FASE", () => {
  it("en el menú ofrece EXACTAMENTE ↑ ↓ ⏎ (las tres teclas de navegación del original)", () => {
    expect(introPadKeys("menu").map((k) => k.key)).toEqual(["ArrowUp", "ArrowDown", "Enter"]);
  });

  it("CADA tecla que la botonera del menú emite es una tecla que menuKeyReducer ATIENDE", () => {
    // Anti-typo estructural: si un rótulo emitiera "Up" en vez de "ArrowUp", el
    // reducer lo ignoraría y el botón sería decorativo. Se comprueba contra el
    // reducer REAL (la fuente de verdad del teclado), no contra una copia.
    const base: MenuState = { selected: 2 };
    for (const k of introPadKeys("menu")) {
      const r = menuKeyReducer(base, k.key, MENU_COMMANDS.length);
      const mueve = r.state.selected !== base.selected;
      const dispara = r.command !== null;
      expect(mueve || dispara, `la tecla ${JSON.stringify(k.key)} del botón «${k.label}» no hace nada en el menú`).toBe(true);
    }
  });

  it("↑ y ↓ mueven en sentidos OPUESTOS y con wrap (calco de 0x0dc4/0x0dd8)", () => {
    const n = MENU_COMMANDS.length;
    const up = introPadKeys("menu").find((k) => k.key === "ArrowUp")!;
    const down = introPadKeys("menu").find((k) => k.key === "ArrowDown")!;
    expect(menuKeyReducer({ selected: 0 }, up.key, n).state.selected).toBe(n - 1);
    expect(menuKeyReducer({ selected: n - 1 }, down.key, n).state.selected).toBe(0);
    expect(menuKeyReducer({ selected: 3 }, up.key, n).state.selected).toBe(2);
    expect(menuKeyReducer({ selected: 3 }, down.key, n).state.selected).toBe(4);
  });

  it("⏎ traduce la selección viva a su letra JCTUAR (indirección 0x0de2)", () => {
    const enter = introPadKeys("menu").find((k) => k.key === "Enter")!;
    for (let i = 0; i < MENU_COMMANDS.length; i++) {
      const r = menuKeyReducer({ selected: i }, enter.key, MENU_COMMANDS.length);
      expect(r.command).toBe(MENU_COMMANDS[i]);
    }
  });

  it("NO hay Esc en el menú — y la razón es que el menú del original lo IGNORA (0x0e27)", () => {
    // Control ATADO al binario: la ausencia no es estética. Si algún día el reducer
    // aprendiera un Escape con efecto, este test se pone rojo y obliga a re-adjudicar.
    expect(introPadKeys("menu").some((k) => k.key === "Escape")).toBe(false);
    const r = menuKeyReducer({ selected: 3 }, "Escape", MENU_COMMANDS.length);
    expect(r.command).toBeNull();
    expect(r.state.selected).toBe(3);
  });

  it("Esc SÍ está en las fases donde vuelve atrás: story (Summoning) y sex", () => {
    for (const fase of ["story", "sex"]) {
      expect(
        introPadKeys(fase).map((k) => k.key),
        `la fase «${fase}» debe ofrecer Escape`,
      ).toContain("Escape");
    }
  });

  it("las fases sin tecla propia no montan botonera (logo/title/attract/cast/quiz/…)", () => {
    for (const fase of ["logo", "title", "attract", "cast", "quiz", "epilogue", "credits", "name"]) {
      expect(introPadKeys(fase), `«${fase}» no debe montar botonera`).toEqual([]);
    }
  });
});

describe("contrato de los botones (rótulo, tecla, nombre accesible)", () => {
  it("las cuatro teclas del encargo existen en la tabla y emiten el `key` del DOM", () => {
    const porKey = new Map(INTRO_PAD_KEYS.map((k) => [k.key, k]));
    expect([...porKey.keys()].sort()).toEqual(["ArrowDown", "ArrowUp", "Enter", "Escape"]);
  });

  it("TODA tecla lleva nombre accesible NO vacío y distinto del glifo (gate a11y móvil)", () => {
    // El gate `mobile-a11y.spec.ts` rechaza un glifo suelto (▲ ⏎ …) como nombre
    // accesible: VoiceOver leería «triángulo apuntando hacia arriba».
    for (const k of INTRO_PAD_KEYS) {
      expect(k.aria.trim().length, `«${k.label}» sin nombre accesible`).toBeGreaterThan(2);
      expect(k.aria.trim()).not.toBe(k.label.trim());
    }
  });

  it("ningún rótulo colisiona con la clave «Enter» del shell (que en ES dice «Entrar»)", () => {
    // Trampa real: `i18n/shell.ts` ya tiene "Enter": "Entrar" (el comando ENTRAR del
    // juego). Si el aria de esta botonera fuera la cadena "Enter", en español se
    // anunciaría «Entrar» — el comando equivocado.
    for (const k of INTRO_PAD_KEYS) expect(k.aria).not.toBe("Enter");
  });
});
