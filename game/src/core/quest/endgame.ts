/**
 * Endgame de Ultima V — secuencia final EXACTA (ENDGAME.OVL, Task 3.12).
 *
 * Reglas re-derivadas del asm (`re/notes/endgame.md`):
 * - `endgame_datestamp` @0x0326: el pergamino de victoria + el informe de tiempo
 *   de juego transcurrido.
 * - Fórmula de playtime @0x0407 (VERIFICADA byte-a-byte):
 *     years  = g_year  - 139   (0x8b)
 *     months = g_month - 4
 *     days   = g_day   - 5
 *     if days   < 0: days   += 28 (0x1c); months--   ← mes de 28 días
 *     if months < 0: months += 13 (0x0d); years--    ← año de 13 meses
 *   Fecha de inicio fija = Año 139, Mes 4, Día 5 (calendario britanniano 13×28).
 * - `endgame_main` @0x0648: pregunta Y/N gateada por `g_wooden_box`; sólo Y ∧ caja
 *   → la escena del trono + el pergamino (rama "buena"); si no, final alternativo.
 */
import type { GameState } from "../state.js";
import { avatarName } from "../party.js";
import { t, tf, getLang, BASE_LANG } from "../../i18n/index.js";

/** Fecha de inicio de la partida (ENDGAME 0x0407). */
const START_YEAR = 139;
const START_MONTH = 4;
const START_DAY = 5;
/** Calendario britanniano. */
const MONTH_DAYS = 28; // 0x1c
const YEAR_MONTHS = 13; // 0x0d

export interface Playtime {
  years: number;
  months: number;
  days: number;
}

/**
 * Tiempo de juego transcurrido = (g_year/g_month/g_day) − (139/4/5) con
 * normalización de préstamo en calendario 13×28. Exacto de ENDGAME 0x0407.
 */
export function endgamePlaytime(state: GameState): Playtime {
  let years = state.time.year - START_YEAR;
  let months = state.time.month - START_MONTH;
  let days = state.time.day - START_DAY;
  if (days < 0) {
    days += MONTH_DAYS;
    months -= 1;
  }
  if (months < 0) {
    months += YEAR_MONTHS;
    years -= 1;
  }
  return { years, months, days };
}

/**
 * Línea "Report now, thy Quest compleat in …" con la lógica EXACTA de plural y
 * separador de ENDGAME 0x0444–0x04ef: cada unidad se imprime sólo si ≠0, con "s"
 * cuando es >1 y ", " antes de la siguiente unidad no nula.
 */
export function formatQuestReport(state: GameState): string {
  const { years, months, days } = endgamePlaytime(state);
  // Cada unidad por su plantilla `tf()` (plural CORRECTO en ES: año/años, mes/MESES,
  // día/días — el «+s» inglés no vale para «mes»). En 'en' `tf` es identidad y el
  // resultado es byte-idéntico al bucle previo.
  const parts: string[] = [];
  if (years !== 0) parts.push(tf(years > 1 ? "{} years" : "{} year", years));
  if (months !== 0) parts.push(tf(months > 1 ? "{} months" : "{} month", months));
  if (days !== 0) parts.push(tf(days > 1 ? "{} days" : "{} day", days));
  // Header (corpus vía asset) por `t()` pelado; footer (no en corpus) como `const lines`
  // para que la guarda anti-fab lo VEA (var MSG_VAR). Los `\n` de borde no son wrap.
  const lines = ["\nto Lord British at Origin Systems!"];
  return t("Report now, thy Quest compleat in\n") + joinUnits(parts) + t(lines[0]!);
}

/**
 * Une las unidades del tiempo de juego. En 'en': coma SIEMPRE (byte-idéntico al
 * original `", "`). En i18n: español correcto con «y» antes de la última («2 años,
 * 3 meses y 5 días») — doctrina «donde no hay original que calcar, gana el español».
 */
function joinUnits(parts: readonly string[]): string {
  if (getLang() === BASE_LANG || parts.length < 2) return parts.join(", ");
  return parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1];
}

/**
 * Palabras-número del pergamino — punteros de DATA.OVL volcados byte a byte
 * (fileoff = DS + 0x10). Las consumen `spell_cardinal` (ENDGAME 0x028c) y
 * `spell_ordinal` (0x02d6).
 *
 * `CARDINAL_UNITS` = tabla **DS 0x3e0a**, indexada por n para n<21. El índice 0 es un
 * puntero NULO en el binario (el original no imprime nada) → cadena vacía aquí.
 * `CARDINAL_TENS` = tabla **DS 0x3e2e**, indexada por n/10 (sólo se usan 2..9; la tabla
 * SOLAPA con la de unidades — `tens[2]` y `units[20]` son el MISMO puntero, "Twenty").
 * `ORDINAL_WORDS` = tabla **DS 0x3e40**, indexada por n para n<13 (índice 0 nunca se usa:
 * días y meses empiezan en 1; en el binario esa ranura la comparte con "Ninety").
 */
const CARDINAL_UNITS = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen", "Twenty",
] as const;
const CARDINAL_TENS: Readonly<Record<number, string>> = {
  2: "Twenty", 3: "Thirty", 4: "Forty", 5: "Fifty",
  6: "Sixty", 7: "Seventy", 8: "Eighty", 9: "Ninety",
};
const ORDINAL_WORDS = [
  "", "First", "Second", "Third", "Fourth", "Fifth", "Sixth",
  "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth",
] as const;

/**
 * `spell_cardinal` — ENDGAME.OVL 0x028c, calco byte a byte:
 *   0x0290 `cmp [bp+4],0x15; jge` → n < 21 ⇒ `units[n]` directo (0x02c8).
 *   n ≥ 21 ⇒ `idiv 10` → `tens[n/10]` (0x02a9); luego el resto `si = n%10` y, **sólo si
 *   si ≠ 0** (0x02bd `or si,si; je`), imprime `-` (DS 0x82c6) + `units[si]`.
 */
export function spellCardinal(n: number): string {
  if (n < 21) return CARDINAL_UNITS[n] ?? "";
  const tens = CARDINAL_TENS[Math.floor(n / 10)] ?? "";
  const unit = n % 10;
  return unit === 0 ? tens : `${tens}-${CARDINAL_UNITS[unit]}`;
}

/**
 * `spell_ordinal` — ENDGAME.OVL 0x02d6, calco byte a byte (cuatro ramas):
 *   n < 13   (0x02d9) ⇒ `ordinals[n]`: First…Twelfth.
 *   n < 20   (0x02ea) ⇒ `spell_cardinal(n)` + `th` (DS 0x831e): Thirteenth…Nineteenth.
 *   n == 20  (0x0303) ⇒ `Twent` (DS 0x8322) + `ieth` (DS 0x8328) = "Twentieth".
 *   n ≥ 21   (0x030e) ⇒ `Twent` + `y-` (DS 0x832e) + tabla `[n·2 + 0x3e18]`, que es la
 *            MISMA tabla de ordinales desplazada 20 (0x3e18 = 0x3e40 − 2·20) ⇒
 *            `ordinals[n−20]`: "Twenty-First"…"Twenty-Eighth".
 * El "Twenty-" está CABLEADO en el binario ⇒ la rutina sólo es correcta hasta 29; el
 * dominio real lo garantiza (día 1..28, mes 1..13 por el calendario 13×28).
 */
export function spellOrdinal(n: number): string {
  if (n < 13) return ORDINAL_WORDS[n] ?? "";
  if (n < 20) return `${spellCardinal(n)}th`;
  if (n === 20) return "Twentieth";
  return `Twenty-${ORDINAL_WORDS[n - 20] ?? ""}`;
}

/**
 * El AÑO del pergamino — ENDGAME 0x0385-0x03a5: `spell_cardinal(year/100)` +
 * ` Hundred` (DS 0x8374) + `spell_cardinal(year%100)`. Para 139 ⇒ "One Hundred
 * Thirty-Nine". (Con `year%100 == 0` el original empuja el puntero NULO de `units[0]`
 * y no imprime nada; aquí sale la cadena vacía y el `trim` deja "Two Hundred".)
 */
function spellYear(year: number): string {
  return `${spellCardinal(Math.floor(year / 100))} Hundred ${spellCardinal(year % 100)}`.trim();
}

/**
 * Ordinal de la fecha del pergamino. En 'en' es el DELETREO byte-exacto del original
 * (`spell_ordinal`); en otro idioma se mantiene el ordinal compacto «Nº» — veredicto
 * previo del lead (default seguro para el ancho del pergamino), que este cambio NO toca:
 * deletrear en español exigiría su propia tabla revisada.
 */
function ordinal(n: number): string {
  if (getLang() !== BASE_LANG) return `${n}º`;
  return spellOrdinal(n);
}

/** Año de la fecha: deletreado en 'en' (fiel); cifra en el resto (misma doctrina). */
function yearWord(year: number): string {
  return getLang() === BASE_LANG ? spellYear(year) : `${year}`;
}

/**
 * Pergamino de cierre EXACTO (strings fijas de ENDGAME_datestamp 0x0326, volcadas
 * de DATA.OVL 0x8332…0x845c).
 *
 * FECHA: ya **DELETREADA** como el original (`spellOrdinal`/`spellCardinal`, calco de
 * ENDGAME 0x02d6/0x028c) — la numerización «5th / 140,» quedó retirada. Secuencia
 * byte-exacta del binario, para careo: `Be it known that on\n`(0x8332) `the `(0x8348)
 * <ord(día)> ` Day of\n`(0x834e) `the `(0x8358) <ord(mes)> ` Month\n`(0x835e)
 * `of the Year\n`(0x8366) <card(año/100)> ` Hundred\n`(0x8374) <card(año%100)>
 * `\n\n`(0x837e) <nombre> ` the Avatar\n\n`(0x8382) …
 *
 * ⚠️ DIVERGENCIAS QUE SIGUEN ABIERTAS aquí (nombradas, no cerradas por este cambio):
 *  1. **Corte de líneas**: el original mete `\n` tras `on`, tras `Day of`, tras `Month`
 *     y tras `Hundred`, y deja que el acumulador de 39 columnas (0x023a) reparta el
 *     resto; el clon agrupa la fecha en DOS líneas. Se ve distinto aunque el texto sea
 *     el mismo.
 *  2. **Línea rúnica**: el binario imprime los bytes crudos `[E@QUE_@OF@[E@AVATAR` /
 *     `IS@FOREVER` (DS 0x83ee/0x8404) en la fuente CINEMÁTICA; el clon pinta la
 *     transcripción latina «THE QUEST OF THE AVATAR IS FOREVER».
 */
export function questScroll(state: GameState): string[] {
  const { year, month, day } = state.time;
  // showEndgameScroll pinta `lines.join("\n")` SIN `t()` → la traducción va AQUÍ. Prosa
  // FIJA como `const lines` (la guarda la ve; se traduce con `t()`); fecha compuesta por
  // `tf()` (plantilla + ordinales ya en la forma del idioma). En 'en' todo es identidad.
  // «saved the life…» SIN el prefijo «the Avatar»: ese fragmento va en la línea del
  // NOMBRE («NOMBRE the Avatar», testigo w140) — mantenerlo aquí lo duplicaba. Los
  // fragmentos derivados del datestamp (DS 0x8332-0x845c) separan «the Avatar» de
  // «saved the life…» (re/notes/endgame.md §Pergamino).
  const lines = [
    "saved the life of our sovereign Lord British, thereby",
    "saving our people and our land.",
    "THE QUEST OF THE AVATAR IS FOREVER",
  ];
  const [saved, land, forever] = lines.map((s) => t(s));
  // El NOMBRE del avatar va en LÍNEA PROPIA «NOMBRE the Avatar» entre la fecha y el
  // cuerpo — testigo 2:34 (129-153 s, frame w140: «Elwood the Avatar» centrado y aislado)
  // + fragmento derivado «the Avatar» del datestamp (DS 0x8332-0x845c, re/notes/
  // endgame.md §Pergamino). Composición runtime; el literal fijo del cuerpo no cambia.
  const name = avatarName(state);
  return [
    tf("Be it known that on the {} Day of the {} Month", ordinal(day), ordinal(month)),
    // Sin coma: el original encadena `of the Year\n` (DS 0x8366) + cardinal + ` Hundred\n`
    // (DS 0x8374) + cardinal + `\n\n` (DS 0x837e). No hay coma en ninguna de las tres —
    // la del clon era fabricada.
    tf("of the Year {}", yearWord(year)),
    "",
    tf("{} the Avatar", name),
    "",
    saved!,
    land!,
    "",
    forever!,
    "",
    formatQuestReport(state),
  ];
}
