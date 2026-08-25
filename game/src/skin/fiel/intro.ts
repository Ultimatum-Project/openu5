/**
 * CINEMÁTICAS FIELES (E1-S13) — RENDERIZADORES PUROS de las pantallas de arranque
 * de Ultima V en el estilo 1988: pantalla de TÍTULO + menú de portada, "The
 * Summoning"/"The Story" (páginas de texto), y la creación de personaje (gitana:
 * nombre / sexo / preguntas de virtud).
 *
 * Derivación:
 *   - Menú de portada + tabla "JCTUAR" + navegación → `re/notes/intro.md §2`
 *     (`intro_main_controller` 0x0986; flechas 1/3=dec 2/4=inc, Enter/Space mapea
 *     la selección a su letra vía la tabla `0x3270`="JCTUAR", hotkeys directas).
 *   - Textos EXACTOS del binario: el menú y "Copyright 1988 Lord British" salen de
 *     DATA.OVL (pool `introMenuU4Transfer` 0x30f2); las páginas de la Summoning de
 *     STORY.DAT (`story.json`, extractor); los prompts de creación de DATA.OVL
 *     (pool `textCreateCharCmdsCrt` 0xa020). El llamador (ui/faithful-intro.ts) los
 *     inyecta como DATOS — este módulo es PURO (no importa el core ni assets;
 *     respeta el guard de imports de la piel).
 *
 * Todo devuelve un `CharGrid` (rejilla de 40×25 celdas de glifo IBM.CH, la
 * pantalla lógica 320×200 / 8) que una capa de blit fina pinta con la fuente.
 * Testeable sin canvas. Lo NO derivable al píxel (logo gótico TITLE.BIT, llamas,
 * retratos de gitana/Iolo, fuente proporcional PROPORT.PCS, cadencias del
 * attract) = Clase C — aquí se calca la ESTRUCTURA y el TEXTO, no el arte.
 */
import { FaithfulFont } from "./font.js";
import { SCREEN_H, SCREEN_W } from "./frame.js";
import { BLANK, TextWindow } from "./textwindow.js";

/** Celdas de carácter de la pantalla lógica (320/8 × 200/8). */
export const GRID_COLS = SCREEN_W / 8; // 40
export const GRID_ROWS = SCREEN_H / 8; // 25

/**
 * Rejilla de glifos de pantalla completa + una fila opcional a RESALTAR (la
 * opción de menú seleccionada; el color de realce lo pone la capa de blit —
 * reverse-video exacto = Clase C).
 */
export interface CharGrid {
  cols: number;
  rows: number;
  cells: Uint8Array;
  /** Fila (0..rows-1) a pintar con fondo de realce, o -1 = ninguna. */
  highlightRow: number;
}

/**
 * Tabla de comandos del menú (`re/notes/intro.md §2`, DATA.OVL `0x3270`="JCTUAR"):
 * índice de opción 0..5 → letra de comando. La selección resaltada se traduce a
 * su letra al pulsar Enter/Space; las teclas J/C/T/U/A/R son hotkeys directas.
 */
export const MENU_COMMANDS = "JCTUAR";
export type MenuCommand = "J" | "C" | "T" | "U" | "A" | "R";

/** Modelo de la pantalla de título + menú (textos EXACTOS inyectados por el caller). */
export interface TitleMenuModel {
  /** Logo (TITLE.BIT es Clase C; fallback textual "Ultima V"). */
  title: string;
  /** Subtítulo ("Warriors of Destiny"; las llamas son Clase C). */
  subtitle: string;
  /** Las 6 etiquetas del menú, en orden (DATA.OVL 0x310c..). */
  options: readonly string[];
  /** Opción resaltada (0..options.length-1). */
  selected: number;
  /** Prompt "Select: " (DATA.OVL 0x31dd). */
  selectPrompt: string;
  /** "Copyright 1988 Lord British" (DATA.OVL 0x31c1). [CORREGIDO t#57: la cita
   *  decía 0x31c9, que cae DENTRO y parte la palabra — ahí empieza "t 1988 Lord
   *  British" y el byte anterior es la 'h' de "Copyrigh". El inicio real es
   *  0x31c1, precedido del NUL que cierra la cadena anterior.] */
  copyright: string;
  /** El controlador va a blitear el logo gótico ULTIMA.16 arriba → omite el texto. */
  logo?: boolean;
  /**
   * Aviso transitorio que SUSTITUYE al bloque de opciones (Journey Onward sin
   * partida: INTRO.OVL 0x0ed0-0x0f22 imprime DS 0x31f0/0x3203/0x321e y vuelve al
   * menú tras tecla). El TEXTO es byte-exacto de DATA.OVL 0x3200-0x324D; la
   * COLOCACIÓN (panel de opciones, word-wrap) es aproximación sin testigo.
   */
  notice?: string;
}

function blankGrid(): CharGrid {
  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    cells: new Uint8Array(GRID_COLS * GRID_ROWS).fill(BLANK),
    highlightRow: -1,
  };
}

/** Escribe `text` en (col,row), recortando a los bordes de la rejilla. */
function putText(grid: CharGrid, col: number, row: number, text: string): void {
  if (row < 0 || row >= grid.rows) return;
  for (let i = 0; i < text.length; i++) {
    const c = col + i;
    if (c < 0 || c >= grid.cols) continue;
    grid.cells[row * grid.cols + c] = text.charCodeAt(i) & 0xff;
  }
}

/** Escribe `text` centrado horizontalmente en `row`. */
function centerText(grid: CharGrid, row: number, text: string): void {
  const col = Math.max(0, Math.floor((grid.cols - text.length) / 2));
  putText(grid, col, row, text);
}

/**
 * Copia las celdas de una TextWindow (word-wrap ya aplicado) en la rejilla, a
 * partir de (leftCol, topRow). No pinta las celdas en blanco.
 */
function blitWindow(grid: CharGrid, win: TextWindow, leftCol: number, topRow: number): void {
  for (let r = 0; r < win.rows; r++) {
    for (let c = 0; c < win.cols; c++) {
      const code = win.cells[r * win.cols + c]!;
      if (code === BLANK) continue;
      const gc = leftCol + c;
      const gr = topRow + r;
      if (gc < 0 || gc >= grid.cols || gr < 0 || gr >= grid.rows) continue;
      grid.cells[gr * grid.cols + gc] = code;
    }
  }
}

/**
 * Pantalla de TÍTULO + menú de portada. Estructura derivada de INTRO.OVL
 * (`re/notes/intro.md` §2): las 6 opciones las pinta `draw_main_menu` 0x06BC vía
 * `print_menu_line` 0x0676 (resalta si idx==sel), y el prompt "Select: " es el string
 * DATA.OVL 0x31dd impreso con el resalte 0xca6a/0xcb0e. Logo/subtítulo arriba, las 6
 * opciones centradas con la seleccionada resaltada (y marcada con el chevron 0x10),
 * el prompt "Select:" y el copyright abajo.
 */
export function renderTitleMenu(model: TitleMenuModel): CharGrid {
  const grid = blankGrid();
  // Con el logo gótico ULTIMA.16 (lo blitea el controlador en las filas 0-7), NO
  // se pinta el título/subtítulo de texto; sin él, fallback textual.
  if (!model.logo) {
    centerText(grid, 2, model.title);
    centerText(grid, 4, model.subtitle);
  }

  // Bloque de menú: 6 filas. Cada opción va CENTRADA horizontalmente (witness
  // video-P f094–f098), SIN bullet/flecha delante (el original no lo lleva). La
  // seleccionada se marca SÓLO con highlightRow → VÍDEO INVERSO (fondo blanco,
  // texto oscuro) que pinta la capa de blit; nada de chevron. Con el logo gótico
  // presente, el controlador blitea además el subtítulo de FUEGO (ultima:1-4) en
  // la banda ~filas 9-14 (Task #73): el menú baja a la fila 16 para dejarle sitio.
  // Con logo, las opciones arrancan en la fila 17 (y136): DEBAJO del borde superior
  // GRUESO del panel (azul ~6 px + blanco, y121-127) y del prompt Select. Medido en
  // f095 (opciones a y140-180, Select a ~y131).
  const firstRow = menuFirstRow(!!model.logo);
  // Aviso "No active game…" (J sin partida): ocupa el panel de opciones y una
  // tecla lo despeja (el controlador limpia model.notice). Wrap fiel del printer
  // (TextWindow) centrado en la banda de las opciones.
  if (model.notice) {
    const rect = { leftCol: 0, topRow: 0, rightCol: 33, botRow: 5 };
    const win = new TextWindow(rect);
    win.printString(model.notice);
    blitWindow(grid, win, 3, firstRow + 1);
    centerText(grid, grid.rows - (model.logo ? 1 : 2), model.copyright);
    return grid;
  }
  // "Select:" NO va en la rejilla: el controlador lo dibuja en la fila 15 (set_cursor
  // (15,15) en INTRO.OVL 0x0d4d) = SOBRE el borde superior azul, cortándolo con el
  // remate en cuña del wrapper de color (0x4c2a/0x4cce) — es una BANDA de borde, no
  // texto flotante en el interior. Lo pinta `FaithfulIntro.paintTitleBand` tras el marco.
  for (let i = 0; i < model.options.length; i++) {
    const row = firstRow + i;
    const opt = model.options[i]!;
    // Columna EXACTA de `print_menu_line` (INTRO.OVL 0x0676): la etiqueta arranca en
    // (col del espacio-guía)+1 = (39-len)>>1 + 1 = (41-len)>>1. Es el centrado del
    // bloque " etiqueta " con REDONDEO HACIA ARRIBA en longitudes impares — difiere
    // del centrado por defecto (floor) en "Transfer from Ultima IV" (23) y
    // "Ultima V Introduction" (21), que el original desplaza 1 col a la derecha.
    putText(grid, (41 - opt.length) >> 1, row, opt);
    if (i === model.selected) grid.highlightRow = row;
  }
  // Copyright al pie (borde inferior del panel).
  centerText(grid, grid.rows - (model.logo ? 1 : 2), model.copyright);
  return grid;
}

/**
 * Cartón de TÍTULO para el attract (demo autónomo, vídeo E2): logo + subtítulo +
 * pie "Press a key". SIN menú (el menú aparece al pulsar tecla, como el original
 * E2→E3). Las figuras andantes (BRITISH.PTH) las blitea el controlador ENCIMA.
 */
export function renderTitleCard(title: string, subtitle: string, logo = false, hint = true): CharGrid {
  const grid = blankGrid();
  if (!logo) {
    centerText(grid, 2, title);
    centerText(grid, 4, subtitle);
  }
  // El demo "The Summoning" (attract) ocupa el panel → sin "Press a key"; sólo el
  // cartón de título estático (sin logo/demo) lo muestra.
  if (hint) centerText(grid, grid.rows - 2, "Press a key to begin");
  return grid;
}

/**
 * Una PÁGINA de "The Summoning"/"The Story": título del capítulo arriba, el
 * texto (word-wrap del printer del kernel, `print_string` 0x1850 — derivación en
 * `re/notes/ui-text-layer.md` §5 — vía TextWindow) en el cuerpo, y un
 * pie "Press any key" + indicador de página. `chapterTitle` puede ir vacío.
 */
export function renderStoryPage(
  text: string,
  pageIdx: number,
  total: number,
  chapterTitle = "",
): CharGrid {
  const grid = blankGrid();
  if (chapterTitle) centerText(grid, 1, chapterTitle);

  // Cuerpo de texto: ventana de word-wrap centrada (cols 3..36, filas 3..20).
  const rect = { leftCol: 0, topRow: 0, rightCol: 33, botRow: 17 };
  const win = new TextWindow(rect);
  win.printString(text);
  blitWindow(grid, win, 3, 3);

  centerText(grid, grid.rows - 2, `Press a key    (${pageIdx + 1} of ${total})`);
  return grid;
}

/**
 * Prompt de nombre (creación). Narración de la gitana + "By what name shalt thou
 * be known?" (DATA.OVL 0xa06a) + lo tecleado con cursor.
 */
export function renderNamePrompt(narration: string, prompt: string, typed: string): CharGrid {
  const grid = blankGrid();
  centerText(grid, 1, "The Summoning");
  // Narración en la MITAD SUPERIOR (filas 3-10): el retrato de la gitana lo blitea
  // el controlador en la mitad inferior (create:0, 168×96 desde y=104).
  if (narration) {
    const win = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 33, botRow: 7 });
    win.printString(narration);
    blitWindow(grid, win, 3, 3);
  }
  putText(grid, 3, 11, prompt);
  putText(grid, 3, 12, `: ${typed}_`);
  return grid;
}

/** Prompt de sexo: "Art thou Male or Female?" (DATA.OVL) + opciones M/F. */
export function renderSexPrompt(prompt: string): CharGrid {
  const grid = blankGrid();
  centerText(grid, 1, "The Summoning");
  centerText(grid, 10, prompt.trim());
  centerText(grid, 13, "(M)ale     (F)emale");
  return grid;
}

/**
 * Una pregunta de virtud (torneo de la gitana). Cabecera "The Summoning (n/7)",
 * el dilema (texto EXACTO de QUESTION.DAT, ya con "A)"/"B)") en word-wrap.
 */
export function renderQuestion(questionText: string, num: number, total: number): CharGrid {
  const grid = blankGrid();
  centerText(grid, 1, `The Summoning  (${num} of ${total})`);
  // El dilema arranca en la fila ~11 (banda de texto 5150=0x5a=90 px del original,
  // FONT 0x0d37): DEBAJO de los dos pebeteros de virtud (que el controlador blitea
  // arriba, filas 0-9), para no solaparse con ellos.
  const win = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 33, botRow: 10 });
  win.printString(questionText);
  blitWindow(grid, win, 3, 11);
  putText(grid, 3, grid.rows - 2, "Press  A  or  B");
  return grid;
}

/**
 * Fila de rejilla de la PRIMERA opción del menú de portada — fuente única
 * compartida por `renderTitleMenu` (pintado) y `menuRowHit` (hit-test táctil):
 * con el logo gótico presente las opciones arrancan en la fila 17 (y136, medido
 * en f095: opciones a y140-180); sin logo, en la 9 (fallback textual).
 */
export function menuFirstRow(logo: boolean): number {
  return logo ? 17 : 9;
}

/**
 * HIT-TEST táctil del menú de portada (carril intro-touch): índice de la opción
 * cuyo RENGLÓN renderizado contiene el punto lógico `pyLogical` (px 0..199 de la
 * pantalla 320×200), o `null` fuera del bloque de opciones. La zona de cada
 * opción es su fila de rejilla COMPLETA (8 px de alto, todo el ancho): las filas
 * son contiguas, así que el bloque entero del menú es tappable sin huecos — el
 * tap sustituye al popup de botones-clon (principio: el overlay táctil no
 * duplica UI que el juego ya pinta; el menú del canvas ES el control). PURO.
 */
export function menuRowHit(
  pyLogical: number,
  optionCount: number,
  logo: boolean,
): number | null {
  const first = menuFirstRow(logo);
  const i = Math.floor(pyLogical / 8) - first;
  return i >= 0 && i < optionCount ? i : null;
}

/**
 * Una tecla de la BOTONERA DE LA INTRO en móvil (ficha #33): rótulo visible, la
 * tecla del DOM que sintetiza (`KeyboardEvent.key`) y su nombre accesible.
 *
 * `aria` va en INGLÉS: es la clave de la capa de idioma del SHELL (`i18n/shell.ts`
 * `ts()`), no del calco del binario — este cromo no existe en el original y por eso
 * NO puede vivir en `es.json` (la guarda anti-fabricación `i18n-manifest.test.ts §A`
 * exige que toda key de esa tabla exista en el corpus inglés del juego).
 */
export interface IntroPadKey {
  readonly label: string;
  readonly key: string;
  readonly aria: string;
}

/**
 * LAS CUATRO TECLAS de la botonera (encargo del usuario: «up down y enter y esc»).
 *
 * Rótulos y `key` alineados con los del deck del juego (`ui/touch.ts`: la cruceta
 * rotula ▲/▼ y la fila útil «⏎ Enter» / «Esc») para que el mismo gesto se llame
 * igual en las dos superficies. Los `aria` NO reutilizan los del deck: allí son
 * RUMBOS («Move north») porque mueven al Avatar por el mapa; aquí mueven un CURSOR
 * de selección por una lista, y anunciar «mover al norte» sobre el menú de portada
 * sería mentirle al lector de pantalla.
 *
 * 🔴 «Enter» a secas NO puede ser un `aria`: `i18n/shell.ts` ya traduce la clave
 * "Enter" como «Entrar» (el comando ENTRAR del juego, entrar en una ciudad). Un
 * botón de confirmación que en español se anuncia «Entrar» nombra otro comando.
 */
export const INTRO_PAD_KEYS: readonly IntroPadKey[] = [
  { label: "▲", key: "ArrowUp", aria: "Previous option" },
  { label: "▼", key: "ArrowDown", aria: "Next option" },
  { label: "⏎ Enter", key: "Enter", aria: "Confirm selection" },
  { label: "Esc", key: "Escape", aria: "Go back" },
];

/** Índice por `key` para componer las botoneras por fase sin repetir literales. */
const PAD = new Map(INTRO_PAD_KEYS.map((k) => [k.key, k]));

/**
 * BOTONERA QUE CORRESPONDE A UNA FASE de la intro — y sólo las teclas que esa fase
 * ATIENDE de verdad (un botón que no hace nada en la primera pantalla del embudo es
 * peor que no tener botón).
 *
 *   · `menu`  → ▲ ▼ ⏎. Es LA fase del encargo: a 390 px el renglón de una opción
 *     mide 8 px CSS (canvas a escala 1) contra el suelo táctil de 44 px, y las seis
 *     filas son contiguas. Las tres teclas son las del original: 1/3 y 2/4 mueven la
 *     selección con wrap (INTRO.OVL 0x0da8-0x0dbe → 0x0dc4/0x0dd8) y 0x0d/0x20 la
 *     traducen a su letra vía la tabla "JCTUAR" (0x0da1 → 0x0de2).
 *   · `story` → Esc. Salida de The Summoning, que son 21 escenas; con el dedo, hoy
 *     la única vía es tocar 21 veces «Tap to continue».
 *   · `sex`   → Esc. Vuelve al prompt del nombre (junto a los botones M/F).
 *   · el resto → nada. `logo`/`title`/`attract`/`cast`/`epilogue`/`credits` avanzan
 *     con CUALQUIER tecla (ya tienen su «Tap to continue»), `quiz` sólo acepta A/B
 *     (FONT 0x0ab4) y `name` es del `<input>` invisible + el teclado del sistema
 *     (donde además un Enter con el nombre VACÍO ya aborta al menú, FONT 0x0bcf).
 *
 * SIN Esc EN EL MENÚ, y no por gusto: el traductor de teclas del menú del original
 * enumera lo que acepta (0x0e16-0x0e42) y manda TODO lo demás a 0x0e27
 * (`mov byte [bp-0xe],0` = ignorar y seguir el bucle). 0x1b no está en esa lista —
 * en INTRO.OVL el ESC sólo aborta el Transfer-from-U4 (0x33b8 / 0x13f5). PURO.
 */
export function introPadKeys(phase: string): readonly IntroPadKey[] {
  if (phase === "menu") {
    return ["ArrowUp", "ArrowDown", "Enter"].map((k) => PAD.get(k)!);
  }
  if (phase === "story" || phase === "sex") return [PAD.get("Escape")!];
  return [];
}

/** Estado del menú de portada (sólo la opción seleccionada). */
export interface MenuState {
  selected: number;
}

/**
 * Reductor de teclado del menú de portada, calcado de INTRO.OVL.
 * Rutina `intro_main_controller` 0x0d75. Las
 * flechas 1/3 (o ArrowUp) decrementan, 2/4 (o ArrowDown) incrementan con wrap
 * 0..count-1; Enter/Space traduce la selección a su letra vía "JCTUAR"; las
 * hotkeys J/C/T/U/A/R saltan directas. Devuelve el nuevo estado y, si procede, el
 * comando disparado.
 */
export function menuKeyReducer(
  state: MenuState,
  key: string,
  count = MENU_COMMANDS.length,
): { state: MenuState; command: MenuCommand | null } {
  const k = key.length === 1 ? key.toUpperCase() : key;
  // Hotkeys directas (letra de comando).
  const hot = MENU_COMMANDS.indexOf(k);
  if (k.length === 1 && hot >= 0) {
    return { state: { selected: hot }, command: MENU_COMMANDS[hot] as MenuCommand };
  }
  if (key === "ArrowUp" || key === "1" || key === "3") {
    return { state: { selected: (state.selected + count - 1) % count }, command: null };
  }
  if (key === "ArrowDown" || key === "2" || key === "4") {
    return { state: { selected: (state.selected + 1) % count }, command: null };
  }
  if (key === "Enter" || key === " " || key === "Spacebar") {
    return { state, command: MENU_COMMANDS[state.selected] as MenuCommand };
  }
  return { state, command: null };
}

/**
 * Acción que el dispatch del menú de portada ejecuta para un comando
 * (`intro_main_controller`, dispatch final INTRO.OVL 0x0e47).
 */
export type MenuAction =
  /** Arranca el juego cargando la partida (J con personaje; sale del controller vía `jmp 0x1010`). */
  | "journey"
  /** J SIN personaje: imprime "No active game…" y vuelve al menú (0x0ed0-0x0f22). */
  | "noActiveGame"
  /** C → creación por la gitana (`lcall 0xfb0e`, FONT.OVL). */
  | "create"
  /** U → The Summoning (`call 0x14e play_introduction`). */
  | "story"
  /** A → Acknowledgements (`call 0x72e`). */
  | "credits"
  /** R → relanza el DEMO del attract («the View») y vuelve al bucle del menú. */
  | "view"
  /** T en el clon (no importa U4): vuelve al menú sin efecto. */
  | "stay";

/**
 * Decisión PURA del dispatch del menú de portada — calco del dispatch final de
 * `intro_main_controller` (INTRO.OVL 0x0e47: 'A'→0xff4, 'C'→0xfa8, 'J'→0xe7c,
 * 'R'→0x100a, 'T'→0xf9c, 'U'→0xfe8). `hasParty` = el análogo del gate de
 * personaje del original (0x0ec9 `cmp byte[g_party_records],0` = 1er byte del
 * nombre del registro 0 de SAVED.GAM): en el port web, ¿hay save en localStorage?
 *
 * Los DOS únicos caminos que ARRANCAN el juego desde el menú son J-con-personaje
 * (sale del controller vía `jmp 0x1010`) y la creación completa (C → gitana).
 * En particular 'R' ("Return to the View", INTRO.OVL 0x100a) es
 * `call 0xfb1a` (relanza el demo del attract — «the View») + `jmp 0xcd0`
 * (vuelve al bucle del menú): JAMÁS entra al juego, con o sin personaje.
 * También es el default del timeout del menú ocioso (0x0dec inyecta 'R'),
 * lo que confirma que no puede ser una vía de arranque. El port hacía
 * finish("journey") aquí → entraba al mundo con la party demo SIN personaje
 * creado (bug reportado en iPhone, donde el overlay táctil ofrece un botón
 * por opción); corregido a "view".
 */
export function menuDispatch(cmd: MenuCommand, hasParty: boolean): MenuAction {
  switch (cmd) {
    case "J":
      return hasParty ? "journey" : "noActiveGame"; // gate INTRO.OVL 0x0ec9
    case "C":
      return "create";
    case "U":
      return "story";
    case "A":
      return "credits";
    case "R":
      return "view"; // INTRO.OVL 0x100a: call 0xfb1a + jmp 0xcd0 — nunca arranca
    case "T":
      return "stay";
  }
}

export interface IntroColors {
  background: string;
  text: string;
  /** Fondo de realce de la fila seleccionada del menu (reverse-video). */
  highlight: string;
  highlightText: string;
}

/**
 * Defaults EGA (índices exactos = Clase C, píxel-diff): texto blanco sobre negro.
 * La fila SELECCIONADA del menú de portada va en VÍDEO INVERSO — fondo BLANCO,
 * texto NEGRO (witness video-P f094–f098; atributo reverse-video 0xFE del kernel,
 * `ui-text-layer.md`), NO el azul EGA (ese es el realce de otras listas in-game).
 */
export const DEFAULT_INTRO_COLORS: IntroColors = {
  background: "#000000",
  text: "#ffffff",
  highlight: "#ffffff", // vídeo inverso: fondo blanco
  highlightText: "#000000", // texto negro sobre el blanco
};

/**
 * Caja de borde AZUL que enmarca el PANEL INFERIOR de la portada (el demo del
 * attract y, luego, el menú). Geometría LITERAL de `draw_menu_border`
 * (INTRO.OVL 0x04E0): la caja se dibuja con TILES de caja de char (glifos
 * 0x7b..0x7f) que abarcan las filas de char 15..24 (y=120..199) y las columnas
 * 0..39 (x=0..319) — a RAS de pantalla, no insertada. El interior lleva el mapa
 * top-down del demo o el menú. Bordes inclusivos, coords lógicas 320×200.
 */
export const INTRO_PANEL = { x0: 0, y0: 120, x1: 319, y1: 199 } as const;

/** Azul EGA idx1 del borde del panel de portada (= `frame.ts` DEFAULT_FRAME_COLORS.frame). */
export const INTRO_PANEL_COLOR = "#0000aa";
/** Línea BLANCA interior del borde del panel (EGA 15) — chrome estándar de U5. */
export const INTRO_PANEL_INNER = "#ffffff";
/**
 * Grosor (px) de la banda AZUL: una celda de char completa (8 px de tile 0x7f),
 * con la LÍNEA BLANCA interior a 7 px del borde (`draw_menu_border` traza el
 * rectángulo blanco en (7,127)-(312,192): 7 px dentro del flanco). Sirve de inset
 * del área interior del demo (INTRO_PANEL.x0+BORDER_W = 7 = flanco del blanco).
 */
export const INTRO_PANEL_BORDER_W = 7;

/** Rectángulo blanco interior de `draw_menu_border` (0x056f-0x05a0): (7,127)-(312,192). */
const INTRO_PANEL_WHITE = { x0: 7, y0: 127, x1: 312, y1: 192 } as const;

/**
 * Tiles de caja de la fuente IBM.CH (0x7b..0x7f) — las MISMAS runas de borde que el
 * chrome del juego (`frame.ts` FRAME_GLYPHS): 4 esquinas REDONDEADAS (bisel diagonal
 * del vértice exterior — escalera EGA 5,3,2,1 px medida en ATTRACT_FULL_ORIGINAL a
 * escala entera 4×) + arista sólida 0x7f. `draw_menu_border` las emite en el color de
 * MARCO (azul). La sonda previa sobre MENU_ORIGINAL (escala 3.58× no entera) emborronó
 * la escalera de 1-2 px y la dio por cuadrada — FALSO: son redondeadas.
 */
const BOX_TL = 0x7b;
const BOX_TR = 0x7c;
const BOX_BL = 0x7d;
const BOX_BR = 0x7e;
const BOX_EDGE = 0x7f;

/**
 * Layout de las escenas de la GITANA / creación (item F). El original composita
 * ARTE (atlas de creación create:*) + texto PROPORCIONAL, SIN rejilla
 * monoespaciada ni cabecera "The Summoning (n)" (witness `orig_F_gypsy`,
 * `orig_F_virtue_question`). El port tenía el arte extraído pero NO lo bliteaba:
 * `create:1` (brasero 120×148, cuenco al pie + columna de humo azul) y `create:10`
 * (mesa roja 152×100). Posiciones MEDIDAS de los frames con PIL (cuencos a
 * y≈135-153). Geometría fina = Clase C (calibración visual = fase 2).
 */
export const GYPSY_SCENE = {
  // Braseros de la escena de preguntas (create:1). Centrados bajo cada símbolo: el
  // cuenco está a x≈50 dentro del sprite, y el witness (ORIG_05) los sitúa a centro
  // nativo ≈66 / 250 → X = centro − 50.
  brazierY: 5, // create:1: top del humo; el cuenco cae al pie del sprite (y≈130-147)
  brazierLeftX: 16, // cuenco izq a centro nativo ≈66 (16 + 50)
  brazierRightX: 200, // cuenco der a centro nativo ≈250 (200 + 50)
  // Dilema del quiz: proporcional full-width AL PIE, bajo los cuencos (witness ORIG_05:
  // primera línea a y≈152).
  questionTop: 152,
  // Escena de NARRACIÓN (ORIG_04): tableau create:0 (168×96) abajo-izquierda.
  portraitX: 8,
  portraitY: 100,
  // Escena FINAL (ORIG_12): Codex create:10 (152×100) abajo-DERECHA (152+168=320 →
  // pegado al borde derecho; el texto de cierre fluye a su izquierda).
  codexX: 168,
  codexY: 100,
} as const;

/**
 * Pinta el borde del panel de portada calcando `draw_menu_border` (INTRO.OVL 0x04E0)
 * — la HIPÓTESIS del usuario confirmada de punta a punta: el binario NO usa rects
 * ad-hoc, sino que monta la caja con los MISMOS tiles de caja del chrome del juego
 * (glifos 0x7b..0x7f = FRAME_GLYPHS), esquinas REDONDEADAS incluidas. Las emite en el
 * color de MARCO (azul) sobre las filas de char 15..24 / cols 0..39, y traza el
 * RECTÁNGULO BLANCO interior (7,127)-(312,192) con líneas de 1 px. Las esquinas rinden
 * la escalera EGA 5,3,2,1 px del bisel 0x7b — verificado en ATTRACT_FULL_ORIGINAL (4×).
 */
export function paintIntroPanelBorder(
  ctx: CanvasRenderingContext2D,
  font: FaithfulFont,
  color: string = INTRO_PANEL_COLOR,
): void {
  const R0 = INTRO_PANEL.y0 >> 3; // 15
  const R1 = INTRO_PANEL.y1 >> 3; // 24
  const C0 = INTRO_PANEL.x0 >> 3; // 0
  const C1 = (INTRO_PANEL.x1 + 1) / 8 - 1; // 39
  const tile = (code: number, c: number, r: number): void =>
    font.drawGlyph(ctx, code, c * 8, r * 8, 1, color);
  // Fila superior: esquina biselada TL + aristas 0x7f + esquina TR.
  tile(BOX_TL, C0, R0);
  for (let c = C0 + 1; c < C1; c++) tile(BOX_EDGE, c, R0);
  tile(BOX_TR, C1, R0);
  // Flancos verticales (filas 16..23): arista sólida 0x7f en col 0 y col 39.
  for (let r = R0 + 1; r < R1; r++) {
    tile(BOX_EDGE, C0, r);
    tile(BOX_EDGE, C1, r);
  }
  // Fila inferior: esquina BL + aristas + esquina BR.
  tile(BOX_BL, C0, R1);
  for (let c = C0 + 1; c < C1; c++) tile(BOX_EDGE, c, R1);
  tile(BOX_BR, C1, R1);
  // Rectángulo BLANCO interior (líneas de 1 px, esquinas rectas) — 0x056f-0x05a0.
  const w = INTRO_PANEL_WHITE;
  ctx.fillStyle = INTRO_PANEL_INNER;
  ctx.fillRect(w.x0, w.y0, w.x1 - w.x0 + 1, 1); // superior (y=127)
  ctx.fillRect(w.x0, w.y1, w.x1 - w.x0 + 1, 1); // inferior (y=192)
  ctx.fillRect(w.x0, w.y0, 1, w.y1 - w.y0 + 1); // izquierda (x=7)
  ctx.fillRect(w.x1, w.y0, 1, w.y1 - w.y0 + 1); // derecha (x=312)
}

/**
 * PINTADO PURO de un `CharGrid` con la fuente IBM.CH sobre el contexto 320×200.
 * Limpia a negro, pinta el realce de la fila seleccionada y luego los glifos. Sin
 * lifecycle → testeable con un contexto espía (como `paintFaithful`).
 */
export function paintIntroGrid(
  ctx: CanvasRenderingContext2D,
  font: FaithfulFont,
  grid: CharGrid,
  colors: IntroColors = DEFAULT_INTRO_COLORS,
): void {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // Fila seleccionada en VÍDEO INVERSO: el binario dibuja `" etiqueta "` CON un espacio
  // guía y otro final EN vídeo inverso (print_menu_line 0x0676: put_glyph(0x20)+string+
  // put_glyph(0x20), todo bajo el reverse-video 0xfd), así que la barra blanca SOBRESALE
  // 1 celda a cada lado del texto (witness zoom SELECT_ITEM_ESPACIOS) → realce = len+2
  // celdas, desde col−1. (La verificación previa "realce=solo texto" fue de una captura a
  // escala NO-entera que emborronó los bordes; el mismo modo de fallo que las esquinas.)
  let hlStart = -1;
  let hlEnd = -1;
  if (grid.highlightRow >= 0) {
    const r = grid.highlightRow;
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[r * grid.cols + col]! !== BLANK) {
        if (hlStart < 0) hlStart = col;
        hlEnd = col;
      }
    }
    if (hlStart >= 0) {
      const padStart = Math.max(0, hlStart - 1); // espacio guía en vídeo inverso
      const padEnd = Math.min(grid.cols - 1, hlEnd + 1); // espacio final
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(padStart * 8, r * 8, (padEnd - padStart + 1) * 8, 8);
    }
  }
  for (let row = 0; row < grid.rows; row++) {
    const inHighlight = row === grid.highlightRow;
    for (let col = 0; col < grid.cols; col++) {
      const code = grid.cells[row * grid.cols + col]!;
      if (code === BLANK) continue;
      font.drawGlyph(ctx, code, col * 8, row * 8, 1, inHighlight ? colors.highlightText : undefined);
    }
  }
}
