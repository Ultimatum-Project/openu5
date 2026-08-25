/**
 * EL TESTIGO DE LA VARIANTE — qué prompt de apertura sacó el herrero en esta corrida.
 *
 * ── POR QUÉ UNA PUERTA QUE SÓLO MIRA EL IMPORTE ENSEÑA A IGNORARLA ───────────────────────
 * `ad06-g34` no se rompió porque el port dejara de conducir la venta: se rompió porque **F-A3
 * movió a la party a otra celda, eso desplazó el stream vivo del `rand(0,3)` del herrero, salió
 * otra de sus CUATRO variantes de apertura, y las 151 teclas cableadas del guion sólo contestan
 * a una**. El ledger nunca llegó a armarse. (Derivación instrucción a instrucción del flujo Sell
 * en SHOPPES.OVL 0x0f64 → `rand(0,3)` @0x0f7d → tabla DS 0x3d2e; ver `shoppe-greetings.ts`.)
 *
 * 🔴 **ESA JUSTIFICACIÓN ESTÁ MEDIDA Y ES FALSA — el testigo se queda, su motivo cambia.**
 * (carril `loteria-sellos`, 2026-08-03, acta `re/notes/loteria-sellos-acta.md`.)
 * Aquí se decía que «una puerta que sólo compara el importe se pondrá roja el día que alguien
 * vuelva a desplazar el stream, cosa que hace CUALQUIER fix que mueva una posición». Se midió:
 * **100 brazos** de perturbación NEUTRA del generador sobre los cinco sellos, en dos puntos de
 * inyección, con 2–5 trayectorias realizadas distintas por sello ⇒ **CERO importes movidos**.
 * `part04-g03` llegó a cruzar las DOS variantes del despachador y TRES de las cuatro del prompt
 * de venta **y pagó `+36` las veinte veces**. El falso positivo que este párrafo temía **no
 * ocurre** con estos cinco sellos.
 *
 * ⇒ El testigo **NO se retira**: lo que aporta de verdad es la otra mitad de su propia tabla,
 * la que nadie había medido — **separar `VERDE-ROBUSTO` de `VERDE-POR-SUERTE`**. Ésa es la
 * distinción con la que se probó que `part04-g03` paga por el mecanismo y no por la tirada, y
 * es la razón por la que esto sigue existiendo. Lo que se retira es la profecía.
 *
 * El veredicto lleva TAMBIÉN qué variante salió:
 *
 *     importe ✓ + misma variante     VERDE ROBUSTO       el mecanismo está intacto de verdad
 *     importe ✓ + variante distinta  VERDE POR SUERTE    pagó, pero por otro camino: mírtalo
 *     importe ✗ + variante distinta  NO-DETERMINISTA     se movió el STREAM, no el ledger
 *     importe ✗ + MISMA variante     ROTO DE VERDAD      misma tirada y otro número ⇒ acusa
 *
 * El cuarto es el único que acusa al port, y es justo el que un gate de sólo-importe no sabe
 * distinguir de los otros dos rojos.
 *
 * ── POR QUÉ SE CALCULA OFFLINE Y NO EN EL ARNÉS ──────────────────────────────────────────
 * El testigo NO sale del `*.report.json`: los bloques `shop-greeting-rng` sólo llevan
 * `{ocrLn, class, verdict}`, y `shopGreetingRng` es un CONTADOR de bloques excluidos (=3 en los
 * dos brazos), no un índice de variante. Sale del **transcript** (`ESPEJO_DUMP=1` →
 * `<parte>.transcript.json`, `{segId: portLines[]}`), que ya se vuelca al mismo dir.
 *
 * Y eso es deliberado: sacarlo del report exigiría tocar `runner.ts`, que es ARNÉS — o sea que
 * **la puerta tendría que medirse a sí misma contra los cinco sellos para poder mirarlos**. Una
 * herramienta de verificación que modifica lo que verifica es un problema del que no se sale.
 * Aquí no se toca nada del arnés: se lee un fichero que el arnés ya escribía.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Las CUATRO variantes del prompt de apertura del flujo Sell (tabla DS 0x3d2e →
 * {0x7db4, 0x7dda, 0x7df8, 0x7e10}, verificadas byte a byte contra DATA.OVL).
 *
 * ⚠ DUPLICADAS a propósito desde `game/src/core/shops/shoppe-greetings.ts`: ese fichero es del
 * PORT y arrastra el árbol de imports de `game/src` entero, que no se puede pedir a una
 * herramienta de `re/tools` que corre con node pelado. Para que no puedan divergir en silencio,
 * `game/tests/sellos-puerta.test.ts` parsea el fuente del port y exige que digan lo mismo —
 * exactamente igual que con `SELLOS` y `VERDES`.
 */
export const VARIANTES_APERTURA = [
  "Which item wouldst thou like to sell?",
  "What dost thou wish to sell?",
  "Show me what ye got...",
  "What dost thou have for me to buy?",
];

/**
 * Normaliza para comparar contra OCR: minúsculas, fuera todo lo que no sea letra o dígito.
 * El OCR del espejo come puntuación, dobla espacios y parte líneas por el ancho de la ventana,
 * así que comparar texto crudo daría cero aciertos por razones que no son la variante.
 */
export function normaliza(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * ¿Qué variante salió en estas líneas del port?
 *
 * Las líneas se UNEN antes de buscar: el prompt se parte por el ancho de la ventana y buscar
 * línea a línea perdería la variante justo cuando el texto es largo (las variantes 0 y 3 son las
 * más largas, o sea que el sesgo iría contra los casos que más importan).
 *
 * Devuelve `{ indice, texto }`, o `null` si no aparece ninguna (el segmento no llegó a abrir la
 * tienda), o `{ indice: -1, ambiguas }` si aparece más de una — que NO se resuelve a la primera:
 * un testigo que elige por orden de tabla se inventa el dato en el único caso en que hay duda.
 */
export function testigoDeVariante(portLines) {
  const blob = normaliza((portLines ?? []).join(" "));
  const hit = [];
  for (const [i, v] of VARIANTES_APERTURA.entries()) {
    if (blob.includes(normaliza(v))) hit.push({ indice: i, texto: v });
  }
  if (!hit.length) return null;
  if (hit.length > 1) return { indice: -1, texto: null, ambiguas: hit.map((h) => h.indice) };
  return hit[0];
}

/**
 * ★★ EL OBSERVABLE QUE SÍ VIVE EN EL BRAZO ROJO: ¿SE LLEGÓ A ABRIR EL FLUJO SELL?
 *
 * 🔴 MEDIDO, no supuesto: en el estado roto de `ad06-g34` **NO EXISTE la variante**. El
 * transcript de main (35 segmentos, `ad06-g34` con 108 líneas) no contiene NINGUNA de las
 * cuatro, y lo que sí contiene dice por qué:
 *
 *     "Greetings, traveller! Wish ye to Buy, or hast thou wares to Sell?"   ← el DESPACHADOR
 *     "Be off with ye, then..."                                            ← y la salida
 *
 * Las cuatro variantes se imprimen en `0x0f7d`, que está DENTRO de `0xf64`, o sea DESPUÉS de
 * que el despachador tome la rama 'S'. En el brazo roto la sesión se cierra en el despachador,
 * así que la venta nunca se abre y no hay variante que leer.
 *
 * ⚠ Y eso NO es «falta la referencia»: es que **el observable no existe en ese brazo**. Son
 * cosas distintas y la segunda es información sobre el MECANISMO, no sobre la medición.
 *
 * Consecuencia para el diseño, y hay que decirla porque un estado que no puede darse debe
 * DECLARAR que no puede darse (si no, alguien contará su ausencia como evidencia):
 * **`NO-DETERMINISTA` (importe ✗ + variante distinta) es INALCANZABLE para `ad06-g34`** — para
 * leer la variante hay que haber entrado a la venta, y si se entró, el ledger arma.
 *
 * Por eso el discriminante del brazo rojo no es la variante sino ESTO: si la tienda abrió pero
 * la venta NO, la avería está en el flujo (stream desplazado); si la venta SÍ ocurrió y el
 * importe no cuadra, la avería es del ledger. Hoy las dos colapsan en el mismo `✗`.
 */
export function aperturaDelFlujo(portLines) {
  const blob = normaliza((portLines ?? []).join(" "));
  const venta = testigoDeVariante(portLines) != null;
  const tienda = blob.includes(normaliza(DESPACHADOR));
  if (venta) return { estado: "VENTA-ABIERTA", porque: "aparece un prompt de apertura del flujo Sell" };
  if (tienda) return { estado: "SOLO-TIENDA", porque:
    "el despachador Buy/Sell salió pero NINGÚN prompt de apertura: la tienda abrió y la VENTA NO — " +
    "la avería está en el flujo (stream desplazado), no en el importe del ledger" };
  return { estado: "SIN-TIENDA", porque: "no aparece ni el despachador: el segmento no llegó a la tienda" };
}

/**
 * El prompt del DESPACHADOR Buy/Sell (DS 0x7f70 + 0x8042). Duplicado desde
 * `game/src/core/world/cmd-strings.ts` (`blacksmithAsk2`) por la misma razón que las cuatro
 * variantes, y con el mismo test de no-divergencia contra el fuente del port.
 */
export const DESPACHADOR = 'Greetings, traveller! Wish ye to Buy, or hast thou wares to Sell?';

/** Lee el transcript de una parte, si la corrida lo volcó. `null` = no hay dump. */
export function transcriptDe(dir, parte) {
  const p = join(dir, `${parte}.transcript.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Adjudica un sello CON el testigo. `esperada` es la variante bajo la que se registró el estado
 * actual del sello — `null` cuando nadie la ha medido todavía.
 *
 * 🔴 Con `esperada === null` esto NO clasifica: devuelve `SIN-REFERENCIA`. Es a propósito.
 * Inventar una referencia (por ejemplo «la variante 0, que es la primera de la tabla») fabricaría
 * el veredicto que la puerta existe para dar, y un `VERDE ROBUSTO` que en realidad significa «no
 * lo sé» es peor que no tener testigo. La referencia se rellena midiéndola, no razonándola.
 */
export function clasificaConTestigo({ pagaImporte, variante, esperada }) {
  if (variante == null) return { clase: "SIN-TESTIGO", porque: "la corrida no volcó transcript (falta ESPEJO_DUMP=1) o el segmento no abrió la tienda" };
  if (variante.indice === -1) return { clase: "TESTIGO-AMBIGUO", porque: `aparecen varias variantes (${variante.ambiguas.join(", ")}): el segmento abrió la tienda más de una vez` };
  if (esperada == null) {
    return { clase: "SIN-REFERENCIA", porque:
      `variante ${variante.indice} («${variante.texto}»), pero NADIE ha medido bajo qué variante ` +
      `quedó registrado este sello: sin referencia el testigo INFORMA, no adjudica` };
  }
  const misma = variante.indice === esperada;
  if (pagaImporte) {
    return misma
      ? { clase: "VERDE-ROBUSTO", porque: `importe ✓ y misma variante (${esperada}): el mecanismo está intacto` }
      : { clase: "VERDE-POR-SUERTE", porque: `importe ✓ pero la variante cambió (${esperada} → ${variante.indice}): pagó por otro camino` };
  }
  return misma
    ? { clase: "ROTO-DE-VERDAD", porque: `importe ✗ con la MISMA variante (${esperada}): misma tirada y otro número ⇒ el port cambió` }
    : { clase: "NO-DETERMINISTA", porque: `importe ✗ y la variante cambió (${esperada} → ${variante.indice}): se desplazó el STREAM, que NO es «el sello roto»` };
}
