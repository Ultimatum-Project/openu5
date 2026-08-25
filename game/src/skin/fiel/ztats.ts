/**
 * Páginas de Ztats FIELES (E1-S11 · calco ronda 2) — reproducen la presentación
 * REAL del comando Z de ZSTATS.OVL, re-derivada instrucción a instrucción y con
 * las cadenas EXTRAÍDAS del binario (DATA.OVL DGROUP, `fileoff = DS + 0x10`):
 *
 *   · `select_player` 0x0000 → SELECCIÓN de jugador PRIMERO (roster en modo
 *     `►Select:◄`, flecha en el candidato); sólo tras elegir se abre la ficha.
 *   · `draw_stat_page` 0x0082 → ficha de STATS: banner `►name◄`, línea
 *     `♂ Lv-N Clase` (indent por clase, tabla 0x1a58), estado de salud centrado
 *     (tabla 0x1a6a: "Good Health"…), y DOS COLUMNAS —`Str=`/`HP:`, `Int=`/`HM:`,
 *     `Dex=`/`Ex:`— más `Magic:` centrado. (Corrige la lista plana anterior.)
 *   · `draw_arms_page` 0x02a8 → banner `►name◄` + título `Arms` (subrayado,
 *     centrado) + los ítems EQUIPADOS por nombre (slots +0x19..+0x1e; se saltan
 *     los vacíos; "(None ready)" si todo vacío). NO hay hechizario aquí (la nota
 *     previa lo inventó: el asm 0x02a8 sólo pinta los 6 slots).
 *   · `draw_provisions` 0x039c → banner `►Equipment◄` + Food/Gold (con ": ") y
 *     Keys/Gems/Torches (con puntos de relleno "......."), gancho sólo si se posee.
 *   · `render_item_list` 0x06e8 → las 4 LISTAS con marco de PERGAMINO
 *     (`draw_list_frame` 0x045e) DENTRO del panel: Reagents/Spells/Items/Armaments;
 *     lista vacía → "(None owned!)".
 *
 * El BANNER (`►texto◄`) lo pinta 0x6c70 sobre el borde del panel; aquí lo expone
 * `ztatsBannerText` y lo blitea la piel (skin.ts). Modelo PURO (rejilla de glifos),
 * sin canvas. Derivación completa y offsets: re/notes/ztats-layout.md.
 */
import { BLANK, TextWindow, type WindowRect } from "./textwindow.js";
import { t, getLang, BASE_LANG } from "../../i18n/index.js";
import type {
  InventoryListItem,
  InventoryMemberEquip,
  InventoryProvisions,
  InventoryView,
  ViewSnapshot,
  ZtatsMemberView,
} from "../api.js";

/**
 * Panel derecho (descriptor index 1). El asm usa cols 0x18..0x27 (24..39); el
 * contenido visible ("Str=20  HP:  49" = 15 celdas) cabe en 24..38 y ALINEA con el
 * roster (leftCol=24, refinado por el arnés mismo-estado #26). Filas 1..10 (banner
 * en la fila 0 = borde del panel).
 */
const ZTATS_PANEL_RECT: WindowRect = {
  leftCol: 24,
  topRow: 1,
  rightCol: 38,
  botRow: 10,
};
/**
 * Marco de PERGAMINO de lista: 15 celdas de ancho (cols 24..38, §4) × 10 alto
 * (filas 1..10). Arranca en la col 24 (borde izq. del panel) para las dos barras
 * verticales del marco.
 */
export const ZTATS_LIST_RECT: WindowRect = {
  leftCol: 24,
  topRow: 1,
  rightCol: 38,
  botRow: 10,
};

// ── Cadenas EXACTAS del binario (DATA.OVL DGROUP, fileoff = DS + 0x10) ──────────
// Extraídas verbatim (re/tools; ver ztats-layout.md §1-2). Se citan sin los saltos
// de línea/indent de control (el layout por filas se fija aquí explícitamente).

/** Clases por LETRA del record (+0xA). Tabla de punteros 0x1a44 → cadenas 0x08ba+. */
const CLASS_NAMES: Record<string, string> = {
  A: "Avatar",
  M: "Mage",
  B: "Bard",
  F: "Fighter",
  D: "Druid",
  T: "Tinker",
  P: "Paladin",
  R: "Ranger",
  S: "Shepherd",
};
/**
 * Indent (nº de espacios) de la línea `♂ Lv-N Clase` por clase — tabla 0x1a58
 * (centra el prefijo `♂ Lv-N ` + nombre según su longitud). Valores verbatim del
 * binario, indexados por el orden de clase (Avatar..Shepherd).
 */
const CLASS_INDENT: Record<string, number> = {
  A: 1, // Avatar
  M: 2, // Mage
  B: 2, // Bard
  F: 1, // Fighter
  D: 1, // Druid
  T: 1, // Tinker
  P: 1, // Paladin
  R: 1, // Ranger
  S: 0, // Shepherd
};
/** Estados de salud por LETRA del record (+0xB). Tabla de punteros 0x1a6a. */
const STATUS_NAMES: Record<string, string> = {
  G: "Good Health",
  P: "Poisoned",
  D: "Dead",
  S: "Asleep",
  C: "Charmed",
};
/** Glifo de género (record +9): CP437 ♂ (0x0b) / ♀ (0x0c). */
const GENDER_GLYPH: Record<string, number> = { M: 0x0b, F: 0x0c };

/** Etiquetas de la ficha de stats (0x96d6/0x96dc/0x96e2/0x96e8/0x96ee/0x96f4/0x96fa/0x9700). */
const LV_PREFIX = " Lv-"; // 0x96d6 (" Lv-")
const L_STR = "Str="; // 0x96dc
const L_HP = "  HP:"; // 0x96e2 ("  HP:")
const L_INT = "Int="; // 0x96e8 ("\nInt=")
const L_HM = "  HM:"; // 0x96ee
const L_DEX = "Dex="; // 0x96f4
const L_EX = "  Ex:"; // 0x96fa
const MAGIC_INDENT = "    "; // 0x9700 ("\n\n    Magic:")
const L_MAGIC = "Magic:";

/** Provisiones (0x039c): Food/Gold con ": ", Keys/Gems/Torches con puntos de relleno. */
const PROV_FOOD = " Food: "; // 0x972e ("\n Food: ")
const PROV_GOLD = " Gold: "; // 0x9738 ("\n Gold: ")
const PROV_KEYS = " Keys......."; // 0x9742 ("\n\n Keys.......")
const PROV_GEMS = " Gems......."; // 0x9752 ("\n Gems.......")
const PROV_TORCHES = " Torches...."; // 0x9760 ("\n Torches....")
const PROV_GRAPPLE = " Grapple"; // 0x976e ("\n Grapple")
/** Cabecera del panel de provisiones (0x9724) — es la banner ►Equipment◄. */
const PROV_HEADER = "Equipment";

/** Título de la página de armas (0x970e, "Arms\n\n") y su fallback vacío (0x9716). */
const ARMS_TITLE = "Arms";
const ARMS_EMPTY = "(None ready)"; // 0x9716

/** Títulos de las 4 listas (banners): 0x97ac/0x97b6/0x97be/0x97c4. */
const LIST_TITLES: Record<number, string> = {
  0xd: "Reagents", // 0x97ac
  0xe: "Spells", //   0x97b6  (¡Spells, no "Items"!)
  0xf: "Items", //    0x97be  (ítems de quest)
  0x10: "Armaments", // 0x97c4
};
/** Lista vacía (0x9794). Corrige el "Nothing!" inventado anterior. */
const LIST_EMPTY = "(None owned!)";

// ── Formateo de números (print_number 0x385e) ──────────────────────────────────
/** 2 díg., pad '0' (0x30) — atributos Str/Int/Dex. */
const d2z = (v: number): string => String(v).padStart(2, "0");
/** 4 díg., pad espacio (0x20) — words HP/maxHP/Exp, Food/Gold. */
const d4s = (v: number): string => String(v).padStart(4, " ");
/** 2 díg., pad espacio (0x20) — MP, Keys/Gems/Torches. */
const d2s = (v: number): string => String(v).padStart(2, " ");

// ── Volcado a rejilla ──────────────────────────────────────────────────────────

/** Escribe `text` en (row, col) de la ventana (glifos crudos, sin wrap ni centrado). */
function writeAt(win: TextWindow, row: number, col: number, text: string): void {
  if (row < 0 || row >= win.rows) return;
  for (let i = 0; i < text.length && col + i < win.cols; i++) {
    const c = col + i;
    if (c < 0) continue;
    win.cells[row * win.cols + c] = text.charCodeAt(i);
  }
}
/** Escribe `text` CENTRADO en la fila `row` (control 0xfc del kernel). */
function writeCentered(win: TextWindow, row: number, text: string): void {
  const start = Math.max(0, Math.floor((win.cols - text.length) / 2));
  writeAt(win, row, start, text);
}

// ── §1 · Página de STATS (draw_stat_page 0x0082) ───────────────────────────────

/**
 * Ficha de STATS del miembro en el panel (calco de `draw_stat_page` 0x0082). Filas
 * (relativas a la ventana; el banner va en la fila 0 = borde, lo pinta la piel):
 *   0: `♂ Lv-N Clase` (indent por clase, tabla 0x1a58)
 *   1: estado de salud, CENTRADO (0xfc; tabla 0x1a6a)
 *   3: `Str=NN  HP:  NNNN`   (Str +0x0c pad'0' · HP +0x10 word)
 *   4: `Int=NN  HM:  NNNN`   (Int +0x0e · maxHP +0x12 word — ¡visible!)
 *   5: `Dex=NN  Ex:  NNNN`   (Dex +0x0d · Exp +0x14 word)
 *   7: `    Magic: NN`       (currentMP +0x0f, pad ESPACIO; indent 4 del string)
 */
export function renderStatPage(rect: WindowRect, m: ZtatsMemberView): TextWindow {
  const win = new TextWindow(rect);
  // i18n: clase/estado/etiquetas por su string inglés (corpus). Las etiquetas de stat
  // (Str=/Dex=/HP:/HM:/Magic:/Lv-) se traducen CONSERVANDO EL ANCHO (Fue=/Des=/PV:/VM:/
  // Magia:/Nv-), así las columnas de números siguen alineadas (Int=/Ex: se quedan por
  // identidad). En 'en' `t()` es identidad → byte-idéntico.
  const cls = t(CLASS_NAMES[m.charClass] ?? m.charClass);
  const gender = String.fromCharCode(GENDER_GLYPH[m.gender] ?? 0x0b);
  const status = t(STATUS_NAMES[m.status] ?? m.status);
  // Fila 0: género + " Lv-N " + clase. El indent del original (tabla 0x1a58) casi es
  // floor((cols-len)/2) salvo la excepción Druid → en 'en' usamos la tabla (byte-exacto);
  // en i18n centramos por la longitud REAL del rótulo traducido (que cambia de ancho).
  const line0 = `${gender}${t(LV_PREFIX)}${m.level} ${cls}`;
  const indent =
    getLang() === BASE_LANG
      ? (CLASS_INDENT[m.charClass] ?? 1)
      : Math.max(0, Math.floor((win.cols - line0.length) / 2));
  writeAt(win, 0, indent, line0);
  // Fila 1: estado de salud centrado.
  writeCentered(win, 1, status);
  // Bloque de stats (fila 3): dos columnas (etiquetas de ancho conservado → alineado).
  writeAt(win, 3, 0, `${t(L_STR)}${d2z(m.str)}${t(L_HP)}${d4s(m.hp)}`);
  writeAt(win, 4, 0, `${t(L_INT)}${d2z(m.int)}${t(L_HM)}${d4s(m.maxHp)}`);
  writeAt(win, 5, 0, `${t(L_DEX)}${d2z(m.dex)}${t(L_EX)}${d4s(m.exp)}`);
  // Fila 7: Magic (currentMP), indentado 4.
  writeAt(win, 7, 0, `${MAGIC_INDENT}${t(L_MAGIC)}${d2s(m.mp)}`);
  return win;
}

// ── §2 · Provisiones (0x039c) y Armas (0x02a8) ─────────────────────────────────

/**
 * Página de PROVISIONES (`0x039c`, banner ►Equipment◄). Filas:
 *   1: ` Food:  NNNN`   2: ` Gold:  NNNN`   (4 díg., pad espacio)
 *   4: ` Keys.......NN` 5: ` Gems.......NN` 6: ` Torches....NN` (2 díg., pad espacio)
 *   7: ` Grapple` sólo si `g_grapple≠0`.
 */
export function renderProvisionsPage(
  rect: WindowRect,
  p: InventoryProvisions,
): TextWindow {
  const win = new TextWindow(rect);
  writeAt(win, 1, 0, `${t(PROV_FOOD)}${d4s(p.food)}`);
  writeAt(win, 2, 0, `${t(PROV_GOLD)}${d4s(p.gold)}`);
  writeAt(win, 4, 0, `${t(PROV_KEYS)}${d2s(p.keys)}`);
  writeAt(win, 5, 0, `${t(PROV_GEMS)}${d2s(p.gems)}`);
  writeAt(win, 6, 0, `${t(PROV_TORCHES)}${d2s(p.torches)}`);
  if (p.grapple) writeAt(win, 7, 0, t(PROV_GRAPPLE));
  return win;
}

/**
 * Página de ARMAS del miembro (`draw_arms_page` 0x02a8, banner ►name◄). Título
 * `Arms` centrado (fila 0) y luego los ítems EQUIPADOS por nombre, uno por fila
 * con un espacio de sangría (slots +0x19..+0x1e: helm/armor/manoA/manoB/anillo/
 * amuleto; se saltan los vacíos). Si TODOS están vacíos → "(None ready)" centrado.
 * NOTA de fidelidad: el asm 0x02a8 NO pinta hechizario aquí (la nota previa lo
 * inventó); esta página es SÓLO armas. `e.spells` queda sin usar a propósito.
 */
export function renderArmsPage(
  rect: WindowRect,
  e: InventoryMemberEquip,
): TextWindow {
  const win = new TextWindow(rect);
  writeCentered(win, 0, t(ARMS_TITLE)); // "Arms" (subrayado en el original)
  const slots = [e.helmet, e.armor, e.weapon, e.shield, e.ring, e.amulet];
  const owned = slots.filter((s): s is string => s != null);
  if (owned.length === 0) {
    writeCentered(win, 4, t(ARMS_EMPTY)); // "(None ready)" (asm set_cursor(0,4))
    return win;
  }
  // Los ítems arrancan en la fila 2 (tras "Arms\n\n"), con un espacio de sangría.
  let row = 2;
  for (const name of owned) {
    if (row >= win.rows) break;
    writeAt(win, row, 0, ` ${armsEquipDisplayName(name)}`);
    row++;
  }
  return win;
}

// ── §3-5 · Visor de listas: marco de pergamino + filas + paginación ────────────

/** Glifos de caja de IBM.CH (ztats-layout.md §4; el horizontal sup≠inf). */
const BOX_TL = 0x10; // ┌ esquina sup-izq
const BOX_HTOP = 0x11; // ─ horizontal SUPERIOR
const BOX_TR = 0x13; // ┐ esquina sup-der
const BOX_VBAR = 0x17; // │ vertical
const BOX_BL = 0x14; // └ esquina inf-izq
const BOX_HBOT = 0x15; // ─ horizontal INFERIOR
const BOX_BR = 0x16; // ┘ esquina inf-der
/** Separador cantidad↔nombre (`print_list_row` sep=0x2d, §5.2). */
const SEP = 0x2d;
/** Cantidad centinela: el ítem no lleva columna de cantidad (§5.1). */
const QTY_HIDDEN = 0xff;
/** Relleno cuando qty==0 (0x9778 = "--"); las filas visibles filtran qty>0. */
const QTY_ZERO_FILL = "--";
/** Decoraciones de prefijo (0x977c/0x9782/0x9788): glifo 0x1c/0x1d + " + " y "Moonstone ". */
const DECO_STAR = String.fromCharCode(0x1c) + " + "; // 0x977c (prefijo '*')
const DECO_BANG = String.fromCharCode(0x1d) + " + "; // 0x9782 (prefijo '!')
const DECO_MOONSTONE = "Moonstone "; // 0x9788 (prefijo '(')
/**
 * Filas de contenido por página de lista = **7**. `draw_list_frame(8)` pinta las
 * barras en si=1..7 y el borde inferior en la fila 8; el render corta en fila 8
 * y PgUp/PgDn fija LITERALMENTE 7 (`mov [bp-2],7`).
 */
export const ZTATS_LIST_ROWS = 7;

/**
 * Marco de PERGAMINO (`draw_list_frame` 0x045e, §4) en una `TextWindow`: fila 0 =
 * borde superior, filas 1..contentRows = barras verticales, fila contentRows+1 =
 * borde inferior. Requiere `win.rows ≥ contentRows+2`.
 */
export function drawListFrame(win: TextWindow, contentRows: number): void {
  const w = win.cols;
  const last = w - 1;
  const set = (row: number, col: number, code: number): void => {
    win.cells[row * w + col] = code;
  };
  set(0, 0, BOX_TL);
  for (let c = 1; c < last; c++) set(0, c, BOX_HTOP);
  set(0, last, BOX_TR);
  for (let r = 1; r <= contentRows; r++) {
    set(r, 0, BOX_VBAR);
    set(r, last, BOX_VBAR);
  }
  const br = contentRows + 1;
  set(br, 0, BOX_BL);
  for (let c = 1; c < last; c++) set(br, c, BOX_HBOT);
  set(br, last, BOX_BR);
}

/** Resultado del layout de una fila: los glifos del área de contenido + los rúnicos. */
export interface RowLayout {
  cells: number[];
  /**
   * Columnas (índices dentro de `cells`) que se pintan con **RUNES.CH** y no con
   * IBM.CH.
   *
   * ★★ HALLAZGO (carril usepicker-fidelidad, careo side-by-side): el thunk `0x3abe`
   * NO es un «realce» — es `set_font`. Lo cierra la evidencia de los dos lados:
   *   · BYTES: la decoración del pergamino es DS 0x977c = `1c 20 2b 20` y la de la
   *     poción DS 0x9782 = `1d 20 2b 20`; ese `2b` es un `'+'`.
   *   · PÍXELES: en el fotograma t=48 del careo esa celda NO es un `'+'` (no tiene
   *     el trazo vertical) sino una barra horizontal, y las siglas del pergamino no
   *     son latinas. Reconstruidas las celdas de 8×8 del DOSBox y careadas glifo a
   *     glifo contra los ficheros de fuente del juego, casan EXACTAMENTE con
   *     RUNES.CH: `0x1c` (sigilo de pergamino), `0x2b` (que en la rúnica es una
   *     barra, no una cruz), `'I'` y `'S'` de `*IS`. En IBM.CH ninguno casa.
   * ⇒ lo que hace `0x3abe(1)` es conmutar a la fuente rúnica, y el ALCANCE lo fija
   * cada rama (ver abajo): en `*` cubre decoración Y sigla; en `!` sólo la
   * decoración (el color sale latino, como se ve en «Yellow»); en `(` sólo el dígito
   * («Moonstone » sale latino porque se imprime ANTES del conmutador, @0x0693).
   * La piel ya sabía pintar con la rúnica —lo hacía para el glifo de clase de
   * (R)eady—; lo que faltaba era decirle QUÉ celdas.
   */
  runeCols: number[];
}

/**
 * Abreviaturas ES de DISPLAY de la lista de ítems (patrón `PICKER_SHORT_ES` de
 * `ready.ts`): override de la capa de display keyed por el nombre INGLÉS que emite
 * `coreview.buildQuestList` (name-table 0x1916), SÓLO bajo `lang≠'en'`. NO toca es.json
 * ni el corpus (la guarda anti-fab exige key inglesa canónica; estos son rótulos de
 * pantalla, no traducción de corpus). Ruling del lead 2026-07-19. Cada valor se ajusta
 * al ancho REAL de la columna del pergamino (contable→10 celdas con la cuenta delante;
 * oculto→13; poción/scroll decorado→6 tras el ícono `+ `). Reviewed por el lead en el diff.
 */
const ZTATS_ITEM_SHORT_ES: Readonly<Record<string, string>> = {
  // Contables (≤10 con "NN-" delante).
  "Magic Crpt": "Alfombra",
  "Skull Keys": "Ll. Calav.",
  Spyglass: "Catalejo",
  Sextant: "Sextante",
  "Black Badge": "Insignia",
  "Wooden Box": "Caja Sánd.", // «Caja Madera» ajustado a 10 celdas (con la cuenta delante)
  // Ocultos sin número (≤13).
  Amulet: "Amuleto",
  Crown: "Corona",
  Sceptre: "Cetro",
  "Shard/Falsehd": "Esq. Falsedad",
  "Shard/Hatred": "Esq. Odio",
  "Shard/Cowrdce": "Esq. Cobardía",
  "HMS Cape Plan": "Planos HMS",
  "Pocket Watch": "Reloj",
  // Colores de poción (femenino de poción): forma plena vía t() si cabe tras el ícono
  // `+ ` (6 celdas): Blue/Red/Green/Black/White → Azul/Roja/Verde/Negra/Blanca. Los que
  // rebasan se recortan CON PUNTO (ruling del lead, nada de recorte a ciegas).
  Yellow: "Amar.", //  Amarillo (8) > 6
  Orange: "Naran.", // Naranja (7) > 6
  Purple: "Púrp.", //  Púrpura (7) > 6
};

/**
 * Nombre de display de un ítem de la lista de Ztats: bajo `lang≠'en'` aplica la
 * abreviatura corta de `ZTATS_ITEM_SHORT_ES` si existe; si no, el choke `t()`. En 'en'
 * es identidad (`t()` byte-exacto). Los códigos de scroll rúnicos (VL/RH/…) no llevan
 * override: son neutros de idioma y ya caben.
 */
function ztatsItemDisplayName(name: string): string {
  if (getLang() !== BASE_LANG) {
    const short = ZTATS_ITEM_SHORT_ES[name];
    if (short !== undefined) return short;
  }
  return t(name);
}

/**
 * Override ES de DISPLAY de los nombres de equipo en la PÁGINA DE ARMAS (patrón
 * `PICKER_SHORT_ES`/`ZTATS_ITEM_SHORT_ES`): 2 ítems cuyo nombre corto fiel COINCIDE con
 * su nombre largo de tienda (colisión de key, ver `PICKER_SHORT_ES`), así que su ES de
 * es.json es la forma PLENA de tienda («Yelmo de Hierro» 15 / «Cota de Anillas» 15) y
 * rebasa el campo de la ficha de armas (14 celdas con la sangría) → se truncaría a media
 * palabra. Ruling del lead 2026-07-20 (reconciliación EN-fiel↔ES-legible): en EN el
 * truncado a innerWidth se QUEDA (fidelidad estricta, «99-Spider Sil»); en ES la capa de
 * display abrevia de forma NATURAL para que quepa sin cortar. NO toca es.json ni corpus
 * (la tienda conserva la forma plena). Sólo bajo `lang≠'en'`. */
const ZTATS_EQUIP_SHORT_ES: Readonly<Record<string, string>> = {
  "Iron Helm": "Yelmo Hierro", // 12 ≤ 14 (es.json 'Yelmo de Hierro' 15 → truncaba)
  "Ring Mail": "Cota Anillas", // 12 ≤ 14 (es.json 'Cota de Anillas' 15 → truncaba)
};

/** Nombre de display de un ítem de equipo en la página de armas: override ES corto si
 * aplica, si no el choke `t()`. En 'en' = identidad (pixeldiff intacto). */
function armsEquipDisplayName(name: string): string {
  if (getLang() !== BASE_LANG) {
    const short = ZTATS_EQUIP_SHORT_ES[name];
    if (short !== undefined) return short;
  }
  return t(name);
}

/**
 * Layout de UNA fila de lista (`print_list_row` 0x05e2, §5) en `innerWidth` celdas:
 *   [cantidad 2 díg. pad espacio][sep '-'][nombre]
 * La columna de cantidad se OCULTA si qty==0xff; si qty==0 se rellena con "--"
 * (0x9778). El nombre ramifica por su PRIMER byte (sigilo de formato, §5.3), con
 * las decoraciones EXACTAS del binario:
 *   `*` (0x0638) → realce + `0x977c`(0x1c" + ") + nombre sin el sigilo.
 *   `!` (0x0664) → realce + `0x9782`(0x1d" + ") + cadena-lado `[fila*2+0x19B2]`
 *                  = COLORES de poción DS 0x19C2 para las filas 8-15 (derivado;
 *                  0x19B2 a secas es la cola de la tabla de equipo 0x1962, NO
 *                  colores). Aquí, el adaptador ya emite el color en el nombre.
 *   `(` (0x068e) → `0x9788`("Moonstone ") + realce + un glifo `name[1]`.
 * (El adaptador del port emite nombres SIN sigilo; las ramas son maquinaria fiel.)
 *
 * ★★ El SEPARADOR tiene su propia rama de fuente, y sólo UN llamador la ejerce
 * (@0x0615, verbatim):
 *
 *     0615: 837e0420   cmp word ptr [bp + 4], 0x20
 *     0619: 7307       jae 0x622                  ; ≥0x20 → tal cual, en IBM.CH
 *     061b: b80100     mov ax, 1
 *     061e: 50         push ax
 *     061f: e89c34     call 0x3abe                ; set_font(RUNES.CH)
 *     0622: ff7604     push word ptr [bp + 4]
 *     0625: e8b22e     call 0x34da                ; putchar(sep)
 *     0628: 2bc0       sub ax, ax
 *     062a: 50         push ax
 *     062b: e89034     call 0x3abe                ; set_font(IBM.CH)
 *
 * Es decir: **un separador de CONTROL (<0x20) se pinta en la fuente RÚNICA**. Los dos
 * llamadores conocidos hasta #149 empujan separadores imprimibles —0x2d en
 * `render_item_list` @0x0765, 0x20 en el picker de (U)se @0x0f9a— y por eso la rama
 * estaba LATENTE y este calco no la tenía. El TERCER llamador es el picker de (R)eady
 * (@0x1064): cuando el ítem está equipado empuja `byte[0x1ae8 + id]` como separador, y
 * los 48 bytes de esa tabla están en 0x01..0x1e ⇒ **el marcador de equipado de (R)eady
 * sale de RUNES.CH SIEMPRE, y sale por ESTA rama, no por una regla propia de (R)eady**.
 * (Ver `re/notes/ready-picker-panel.md` §3.)
 *
 * `displayName` es el choke i18n del NOMBRE, que cada superficie elige: la lista de
 * Ztats usa `ztatsItemDisplayName` (default) y el picker de (R)eady su override corto
 * de 10 celdas (`pickerDisplayName`). Es una capa de DISPLAY: en 'en' las dos son la
 * identidad, así que el calco es byte-exacto por las dos vías.
 */
export function listRowCells(
  item: InventoryListItem,
  innerWidth: number,
  sep = SEP,
  displayName: (name: string) => string = ztatsItemDisplayName,
): RowLayout {
  const cells = new Array<number>(innerWidth).fill(BLANK);
  let col = 0;
  const put = (code: number): void => {
    if (col < innerWidth) cells[col++] = code;
  };
  const putStr = (s: string): void => {
    for (const ch of s) put(ch.charCodeAt(0));
  };
  const runeCols: number[] = [];
  /** Marca como rúnicas las columnas que escriba `emit`. */
  const inRunes = (emit: () => void): void => {
    const from = col;
    emit();
    for (let c = from; c < col; c++) runeCols.push(c);
  };
  if (item.qty !== QTY_HIDDEN) {
    const q = item.qty === 0 ? QTY_ZERO_FILL : d2s(item.qty).slice(-2);
    put(q.charCodeAt(0));
    put(q.charCodeAt(1));
    // El separador y su rama de fuente (@0x0615): <0x20 ⇒ RUNES.CH. Ver la cabecera.
    if (sep < 0x20) inRunes(() => put(sep));
    else put(sep);
  }
  let name = item.name;
  const sig = name.charCodeAt(0);
  let nameInRunes = false;
  if (sig === 0x2a) {
    // '*' (@0x0638): set_font(1) → decoración 0x977c → **el nombre TAMBIÉN** → set_font(0)
    // @0x0652. El conmutador se apaga DESPUÉS de imprimir `name+1`, así que la sigla
    // rúnica del pergamino (`IS`, `VL`…) sale en RUNES.CH — verificado glifo a glifo.
    inRunes(() => putStr(DECO_STAR));
    name = name.slice(1);
    nameInRunes = true;
  } else if (sig === 0x21) {
    // '!' (@0x0664): set_font(1) → decoración 0x9782 → set_font(0) @0x0677 → y SÓLO
    // ENTONCES la cadena-lado (el color). El apagado va ANTES del color: por eso
    // «Yellow» sale en latinas y la decoración no.
    inRunes(() => putStr(DECO_BANG));
    name = name.slice(1);
  } else if (sig === 0x28) {
    // '(' (@0x068e): "Moonstone " en la fuente NORMAL (se imprime antes, @0x0693) y
    // luego set_font(1) + UN glifo = el dígito de la fase.
    putStr(DECO_MOONSTONE);
    name = name.length > 1 ? name[1]! : "";
    nameInRunes = true;
  }
  // i18n: el nombre display (ya sin sigilo) pasa por el override corto ES → t(). 'en' =
  // identidad (pixeldiff intacto); 'es' usa la abreviatura de columna (o t() si no hay).
  // Las siglas rúnicas y el dígito de fase NO pasan por t(): no son prosa (y en la
  // rúnica una traducción no significaría nada).
  if (nameInRunes) inRunes(() => putStr(name));
  else putStr(displayName(name));
  return { cells, runeCols };
}

/**
 * Página de lista completa (`render_item_list` 0x06e8, §3): marco de pergamino +
 * hasta 7 filas de la ventana de scroll. Lista vacía → "(None owned!)" centrado
 * DENTRO del marco (§3 paso 2). El TÍTULO no va en el marco: es el banner del panel
 * (0x6c70), que blitea la piel. `scroll` = índice del primer ítem visible.
 */
export function renderItemListPage(
  rect: WindowRect,
  items: readonly InventoryListItem[],
  scroll = 0,
): TextWindow {
  const win = new TextWindow(rect);
  drawListFrame(win, ZTATS_LIST_ROWS);
  if (items.length === 0) {
    writeCentered(win, 1 + Math.floor(ZTATS_LIST_ROWS / 2), t(LIST_EMPTY));
    return win;
  }
  const inner = win.cols - 2;
  const start = Math.max(
    0,
    Math.min(scroll, Math.max(0, items.length - ZTATS_LIST_ROWS)),
  );
  const visible = items.slice(start, start + ZTATS_LIST_ROWS);
  for (let r = 0; r < visible.length; r++) {
    const { cells, runeCols } = listRowCells(visible[r]!, inner);
    for (let c = 0; c < inner; c++)
      win.cells[(r + 1) * win.cols + (c + 1)] = cells[c]!;
    // Plano RÚNICO de la fila (set_font @0x3abe): la capa de blit escoge RUNES.CH
    // para estas celdas. Antes se perdía —`listRowCells` devolvía un booleano de fila
    // y este bucle lo descartaba—, así que las decoraciones salían en IBM.CH.
    for (const c of runeCols) win.cellRune[(r + 1) * win.cols + (c + 1)] = 1;
  }
  return win;
}

/**
 * Glifo del indicador de scroll de una lista de Ztats (Spells/Reagents/Items/
 * Armaments), CP437: ▲(0x18) hay ítems por ARRIBA, ▼(0x19) los hay por ABAJO,
 * ↕(0x12) por ambos lados, o `null` sin overflow (cabe entera). Calca la elección
 * de `render_item_list` @0x077f-0x0819 (ZSTATS.OVL): flag UP=+2 si
 * `find_prev_owned≠0xffff` (hay poseído antes del tope visible), flag DOWN=+1 si
 * `find_next_owned≠0xffff` (hay poseído tras la página); 1→▼(0x19), 2→▲(0x18),
 * 3→↕(0x12), 0→nada. MISMA lógica que `readyArrowGlyph` (item_page_controller
 * @0x10a6): ambos pintan la banda por el MISMO kernel `0x6c0a` (=ULTIMA.EXE 0x4dea,
 * banda FIJA fila 10, ►col30/glifo31/◄col32). `total` = nº de ítems poseídos.
 */
export function ztatsListArrowGlyph(scroll: number, total: number): number | null {
  const up = scroll > 0;
  const down = scroll + ZTATS_LIST_ROWS < total;
  if (up && down) return 0x12;
  if (up) return 0x18;
  if (down) return 0x19;
  return null;
}

// ── El EJE DE PÁGINAS (§2) y el reductor de teclas (§1b) ────────────────────────

/** Página de provisiones en el eje `[bp-2]` (§2). */
export const ZTATS_PAGE_PROVISIONS = 0xc;
/** Primera/última página de LISTA del eje (§2). */
const ZTATS_PAGE_LIST_FIRST = 0xd;
const ZTATS_PAGE_LIST_LAST = 0x10;

/** ¿La página del eje es una de las 4 listas (0xd-0x10, con pergamino)? */
export function isListPage(page: number): boolean {
  return page >= ZTATS_PAGE_LIST_FIRST && page <= ZTATS_PAGE_LIST_LAST;
}

/** ¿La página del eje es la de ARMAS de un miembro (impar 1,3,…,11)? `draw_arms_page` 0x02a8. */
export function isArmsPage(page: number): boolean {
  return page < ZTATS_PAGE_PROVISIONS && (page & 1) === 1;
}

/**
 * Geometría (en CELDAS, relativa a la ventana del panel) del SUBRAYADO del título
 * `Arms` (attr `0xfe` de `draw_arms_page` 0x02a8, `"Arms\n\n"`=0x970e). El modelo de
 * rejilla de glifos no tiene canal de atributo, así que la piel lo pinta como línea
 * bajo la fila 0; aquí se deriva su tramo con el MISMO centrado que `writeCentered`
 * (control 0xfc). Depende del idioma: en 'es' el título es `Armas` (5) y el subrayado
 * lo sigue. `cols` = ancho de la ventana del panel (15).
 */
export function armsTitleUnderline(cols: number): {
  row: number;
  startCol: number;
  len: number;
} {
  const title = t(ARMS_TITLE);
  const startCol = Math.max(0, Math.floor((cols - title.length) / 2));
  return { row: 0, startCol, len: title.length };
}

/** Título + ítems de la lista para una página del eje (§2). */
export function listForPage(
  inv: InventoryView,
  page: number,
): { title: string; items: readonly InventoryListItem[] } {
  const title = LIST_TITLES[page] ?? "";
  switch (page) {
    case 0xd:
      return { title, items: inv.reagents };
    case 0xe:
      return { title, items: inv.items };
    case 0xf:
      return { title, items: inv.quest };
    case 0x10:
      return { title, items: inv.equipment };
    default:
      return { title: "", items: [] };
  }
}

/** Siguiente página del eje (flecha next 2/4, ring circular §2, gates de wrap). */
function axisNext(page: number, party: number): number {
  if (page === party * 2 - 1) return ZTATS_PAGE_PROVISIONS; // fin de miembros → provisiones
  if (page === ZTATS_PAGE_LIST_LAST) return 0; //               última lista → wrap a 0
  return page + 1;
}

/** Página anterior del eje (flecha prev 1/3, ring circular §2, gates de wrap). */
function axisPrev(page: number, party: number): number {
  if (page === 0) return ZTATS_PAGE_LIST_LAST; //               0 → última lista (wrap)
  if (page === ZTATS_PAGE_PROVISIONS) return party * 2 - 1; //  provisiones → último miembro
  return page - 1;
}

/** Modo del modal: SELECCIÓN de jugador (roster ►Select:◄) o PÁGINA de la ficha. */
export type ZtatsMode = "select" | "page";

/** Estado del modal de Ztats. */
export interface ZtatsState {
  /** `select` = eligiendo jugador (roster + flecha); `page` = viendo la ficha. */
  mode: ZtatsMode;
  /** Índice del eje de páginas (0x00..0x10, §2) — sólo en modo `page`. */
  page: number;
  /** Offset del primer ítem visible en una lista (0 fuera de listas). */
  scroll: number;
  /** Miembro candidato en modo `select` (y último elegido). */
  cursor: number;
}

/** Contexto del reductor: tamaño de party + nº de ítems de la lista actual (clamp). */
export interface ZtatsCtx {
  /** Miembros de la party (g_party_size) — acota el ring y la selección. */
  partySize: number;
  /** Nº de ítems poseídos en la lista actual (para clamp de scroll). */
  ownedCount?: number;
}

export interface ZtatsKeyResult {
  /** Nuevo estado del modal (null = Ztats cerrado). */
  state: ZtatsState | null;
  /** ¿El bucle consumió la tecla? (el modal la traga; el juego no la ve). */
  handled: boolean;
}

/** Abre en modo selección con el candidato en `cursor` (calca `select_player` 0x0000). */
function openSelect(cursor = 0): ZtatsState {
  return { mode: "select", page: 0, scroll: 0, cursor };
}
/** Abre la ficha de un miembro (página de stats = member*2). */
function openMember(member: number): ZtatsState {
  return { mode: "page", page: member * 2, scroll: 0, cursor: member };
}

/**
 * Reductor PURO del comando Z — calca `cmd_zstats` (0x0a3a) con la SELECCIÓN de
 * jugador primero (`select_player` 0x0000):
 *   · CERRADO: sólo 'Z' abre → modo SELECT (candidato = miembro 0). 'Z' no se lee
 *     dentro del bucle.
 *   · SELECT: ↑/← y ↓/→ mueven el candidato (circular en la party); '1'-'6' eligen
 *     directo; Enter/Space confirman el candidato → abren su ficha de stats; ESC
 *     cierra. (La matriz de select es conducta observada —ground truth del usuario,
 *     ref 01/07—; el asm de 0x4b9a vive en el kernel, fuera de este OVL.)
 *   · PAGE: SPACE/ESC cierran (0x0a78/0x0a81); flechas ciclan el eje CIRCULAR sin
 *     cerrar (ring §2, gates de wrap); '1'-'6' saltan a la ficha del miembro
 *     (0x0b12); '0' salta a provisiones (0x0b37). En una LISTA, ↑/↓ SCROLLEAN
 *     (sólo si hay overflow) y ←/→ cambian de página; Home/End saltan a los bordes.
 * F9 (hot-swap) NO se consume.
 */
export function ztatsKeyReducer(
  state: ZtatsState | null,
  key: string,
  ctx: ZtatsCtx,
): ZtatsKeyResult {
  const party = ctx.partySize;
  if (state === null) {
    if (key.toLowerCase() === "z" && party > 0)
      return { state: openSelect(0), handled: true };
    return { state: null, handled: false };
  }
  if (key === "F9") return { state, handled: false };

  // ── Modo SELECCIÓN de jugador (roster ►Select:◄) ──
  // MISMO picker que Camp/Cast: `select_party_member` (0x2d7a, banner "►Select:◄",
  // kernel 0x4989→0x2e8e→0x2d7a). El modelo de teclas ESPEJA `core/selectPartyMember.ts`
  // `selectPartyMemberKey` (la guarda CI skin↔core prohíbe importar runtime del core; el
  // reducer canónico vive en el core y aquí se replica byte-a-byte). El CURSOR se pinta en
  // VÍDEO INVERSO con la flecha → FIJA en el activo (skin.ts), como el Camp — NO moviendo
  // la flecha (bug previo, #17b). El eje de páginas (abajo) no cambia.
  if (state.mode === "select") {
    if (key === "ArrowUp" || key === "ArrowLeft" || key === "Up" || key === "Left")
      return { state: { ...state, cursor: (state.cursor + party - 1) % party }, handled: true };
    if (key === "ArrowDown" || key === "ArrowRight" || key === "Down" || key === "Right")
      return { state: { ...state, cursor: (state.cursor + 1) % party }, handled: true };
    if (/^[1-9]$/.test(key)) {
      const m = Number(key) - 1; // '1'..'N' → 0..N-1
      return m < party ? { state: openMember(m), handled: true } : { state, handled: true };
    }
    // Enter / Space / '0' confirman el cursor (0x2d7a: 0xd/0x20/0x30). '0' antes se tragaba.
    if (key === "Enter" || key === " " || key === "Spacebar" || key === "0")
      return { state: openMember(state.cursor), handled: true };
    if (key === "Escape") return { state: null, handled: true };
    return { state, handled: true }; // modal: traga la tecla
  }

  // ── Modo PÁGINA (eje de cmd_zstats) ──
  if (key === " " || key === "Escape") return { state: null, handled: true };
  // Sub-bucle de lista (`render_item_list` §3): DENTRO de una lista con OVERFLOW,
  // ↑/↓ hacen SCROLL (no cambian de página); ←/→ SALEN a cambiar página del eje.
  // Home/End saltan a los bordes. Si NO hay overflow, ↑/↓ NO hacen nada (caen al
  // ciclo del eje como fuera de una lista). Códigos get_extended_key (kernel
  // 0x266c): 1=Izq,2=Dcha,3=Arriba,4=Abajo; 0xd3=Home,0xd4=End,0xd5/6=PgUp/Dn.
  if (isListPage(state.page)) {
    const maxScroll = Math.max(0, (ctx.ownedCount ?? 0) - ZTATS_LIST_ROWS);
    if (maxScroll > 0) {
      if (key === "Home")
        return { state: { ...state, scroll: 0 }, handled: true };
      if (key === "End")
        return { state: { ...state, scroll: maxScroll }, handled: true };
      const step =
        key === "ArrowUp" || key === "ArrowDown"
          ? 1
          : key === "PageUp" || key === "PageDown"
            ? ZTATS_LIST_ROWS
            : 0;
      if (step > 0) {
        const down = key === "ArrowDown" || key === "PageDown";
        const next = down
          ? Math.min(state.scroll + step, maxScroll)
          : Math.max(state.scroll - step, 0);
        return { state: { ...state, scroll: next }, handled: true };
      }
    } else if (key === "Home" || key === "End") {
      // Lista sin overflow: los saltos de borde se tragan sin efecto.
      return { state, handled: true };
    }
  }
  if (key === "ArrowLeft" || key === "ArrowUp")
    return {
      state: { ...state, page: axisPrev(state.page, party), scroll: 0 },
      handled: true,
    };
  if (key === "ArrowRight" || key === "ArrowDown")
    return {
      state: { ...state, page: axisNext(state.page, party), scroll: 0 },
      handled: true,
    };
  if (key >= "1" && key <= "6") {
    const m = key.charCodeAt(0) - 0x31;
    return m < party
      ? { state: openMember(m), handled: true }
      : { state, handled: true };
  }
  if (key === "0")
    return {
      state: { ...state, page: ZTATS_PAGE_PROVISIONS, scroll: 0 },
      handled: true,
    };
  return { state, handled: true }; // otra tecla: el bucle la ignora (sigue abierto)
}

/**
 * SCROLL QoL de una lista de Ztats (carril panel-scroll): mueve la ventana de la
 * lista `lines` líneas — positivo = hacia ARRIBA/atrás (misma convención que el
 * scrollback del log: rueda arriba / «tirar del papel» hacia abajo) — con
 * EXACTAMENTE el clamp del reductor fiel (↑/↓: `[0, owned-ZTATS_LIST_ROWS]`).
 *
 * Es un ALIAS DE ENTRADA de las flechas, no un modo nuevo: el estado resultante es
 * siempre alcanzable por teclas y el render fiel no cambia (misma
 * `renderItemListPage` + indicador ▲▼↕ de `ztatsListArrowGlyph`) — con rueda quieta
 * el pintado es byte-idéntico por construcción. Devuelve el estado nuevo o `null`
 * si NO aplica (fuera de una lista / sin overflow / sin cambio): el caller no
 * repinta ni captura el gesto. A DIFERENCIA de ↑/↓ del reductor (que sin overflow
 * caen al ciclo del eje), esto JAMÁS cambia de página: la rueda desplaza, no navega.
 */
export function listScrollBy(
  state: ZtatsState,
  lines: number,
  ownedCount: number,
): ZtatsState | null {
  if (state.mode !== "page" || !isListPage(state.page)) return null;
  const delta = Math.trunc(lines);
  if (delta === 0) return null;
  const maxScroll = Math.max(0, ownedCount - ZTATS_LIST_ROWS);
  if (maxScroll === 0) return null;
  const next = Math.min(maxScroll, Math.max(0, state.scroll - delta));
  return next === state.scroll ? null : { ...state, scroll: next };
}

// ── Banner y despacho de página ────────────────────────────────────────────────

/** Slot de equipo vacío (páginas de armas sin miembro resuelto — defensivo). */
const EMPTY_EQUIP: InventoryMemberEquip = {
  helmet: null,
  armor: null,
  weapon: null,
  shield: null,
  ring: null,
  amulet: null,
  spells: [],
};

/**
 * Texto del BANNER (`►texto◄`, lo pinta 0x6c70 sobre el borde del panel) para el
 * estado actual: en SELECT → "Select:"; en PAGE → nombre del miembro (stats/armas),
 * "Equipment" (provisiones) o el título de la lista. La piel lo blitea con los
 * chevrones azules (0x02/0x01) centrado en la fila 0 del panel. `null` = sin banner.
 */
export function ztatsBannerText(
  state: ZtatsState,
  snap: ViewSnapshot,
): string | null {
  if (state.mode === "select") return t("Select:");
  const page = state.page;
  if (isListPage(page)) return t(listForPage(snap.inventory, page).title);
  if (page === ZTATS_PAGE_PROVISIONS) return t(PROV_HEADER);
  const member = page >> 1;
  return snap.ztats[member]?.name ?? null;
}

/**
 * Compone la `TextWindow` de la página de Ztats ACTIVA (modo `page`) desde el eje y
 * el snapshot: despacha por tipo (stats / armas / provisiones / lista). El banner lo
 * pinta la piel aparte (`ztatsBannerText`). Equivale al despacho de `cmd_zstats`
 * (0x0ad2-0x0bcf, §2).
 */
export function layoutZtatsPage(
  state: ZtatsState,
  snap: ViewSnapshot,
): TextWindow {
  const page = state.page;
  if (isListPage(page)) {
    const { items } = listForPage(snap.inventory, page);
    return renderItemListPage(ZTATS_LIST_RECT, items, state.scroll);
  }
  if (page === ZTATS_PAGE_PROVISIONS)
    return renderProvisionsPage(ZTATS_PANEL_RECT, snap.inventory.provisions);
  const member = page >> 1;
  if ((page & 1) === 1) {
    const equip = snap.inventory.members[member] ?? EMPTY_EQUIP;
    return renderArmsPage(ZTATS_PANEL_RECT, equip);
  }
  const m = snap.ztats[member];
  if (!m) return new TextWindow(ZTATS_PANEL_RECT);
  return renderStatPage(ZTATS_PANEL_RECT, m);
}

/** Nº de ítems de la lista de la página actual (para el clamp de paginación del reductor). */
export function currentListLength(
  snap: ViewSnapshot,
  state: ZtatsState | null,
): number {
  if (!state || state.mode !== "page" || !isListPage(state.page)) return 0;
  return listForPage(snap.inventory, state.page).items.length;
}
