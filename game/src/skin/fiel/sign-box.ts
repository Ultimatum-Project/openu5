/**
 * CAJA GRÁFICA DE LETREROS — layout puro del marco fiel de los carteles (L)ook.
 *
 * Derivación (re/disasm/LOOKOBJ.OVL.asm + original/u5/play/SIGNS.DAT + RUNES.CH):
 *
 * El DOS NO imprime los carteles como texto plano ni en un overlay del viewport: los
 * dibuja EN EL FLUJO DE LA CONSOLA (panel derecho), como una fila más del log de texto.
 * `cmd_look` imprime "Thou dost see" y luego `read_sign` (LOOKOBJ 0x07E4) localiza el
 * registro de SIGNS.DAT por (dir,y,x); `decode_sign_text` (0x06F8) lo descomprime
 * carácter a carácter al área de texto (16 columnas de ancho — CONSOLE_RECT mide 24..39
 * = 16 cols, justo el ancho de la caja). El cartel va YA ENMARCADO en una caja de glifos
 * de borde de RUNES.CH y su CUERPO EN RUNAS (ligaduras TH=0x5b, EA=0x5e, ST=0x5f,
 * NG=0x5d, EE=0x5c, espacio=0x40); el extractor traduce las runas a latín legible y
 * ELIMINA los glifos de caja al generar signs.json. Este módulo REGENERA la caja
 * (marco + cuerpo, TODO en RUNES.CH) para imprimirla en la consola fiel — veredicto #25
 * del usuario: el cuerpo va en RUNAS «igual que en el juego». El texto latín se conserva
 * aparte en el `.text` de cada fila de consola (historial + detección e2e).
 *
 * Glifos de caja verificados byte a byte en RUNES.CH (8×8, 8 bytes/glifo). El primer
 * registro de SIGNS.DAT (loc0, x95 y148, "NORTH BRITAIN / EAST PAWS / SOUTH TRINSIC")
 * empieza en:
 *   38 6c 6c 6c 6c 6c 6d 6c 6c 6d 6c 6c 6c 6c 6c 39   ← fila superior
 *   67 <14 glifos de cuerpo>                      67   ← filas de contenido
 *   3a 6c 6c 6c 6c 6c 6e 6c 6c 6e 6c 6c 6c 6c 6c 3b   ← fila inferior
 *
 *   0x38 = esquina superior-izquierda    0x39 = esquina superior-derecha
 *   0x3a = esquina inferior-izquierda    0x3b = esquina inferior-derecha
 *   0x6c = arista horizontal (línea a media altura de la celda)
 *   0x6d = arista superior CON adorno (dos "púas" hacia arriba)
 *   0x6e = arista inferior CON adorno (dos "púas" hacia abajo)
 *   0x67 = arista vertical
 *
 * Las dos púas decorativas (0x6d arriba / 0x6e abajo) van simétricas alrededor del
 * centro: en un interior de 14 caen en los índices 5 y 8 (centro 6.5 ± 1.5). Regla
 * generalizada: `floor((w-1)/2)-1` y `ceil((w-1)/2)+1` (para w≥6; en cajas estrechas
 * se omiten).
 *
 * ANCHO — ojo, son DOS caminos con DOS reglas distintas y sólo uno sale del binario:
 *  · CALCO (`bakedSignRows`, inglés): el ancho NO es del cartel, es DE LA VENTANA. El
 *    original no mide nada: `decode_sign_text` emite carácter a carácter con el putchar
 *    del kernel (0x742a = ULTIMA.EXE:0x16ba) y es ÉSE quien envuelve al llegar al borde
 *    del área de texto — 16 columnas (CONSOLE_RECT 24..39). Por eso TODAS las filas
 *    horneadas de SIGNS.DAT miden exactamente 16 bytes. Ver `bakedSignRows`.
 *  · RE-ENMARCADO (`layoutSignBox`, sólo bajo traducción): con el cuerpo ya en español
 *    los bytes horneados no valen y la caja se reconstruye. Heurística DEL PORT, no del
 *    binario: interior = contenido runa + 1 aire por lado, topado a 14 (= 16 − 2
 *    aristas); `min(contenido+2, 14)`. Reproduce los tres casos ingleses que se usaron
 *    para calibrarla ("NORTH BRITAIN" 12 glifos → 14 · "PRIVATE ISLAND" 14 → 14 sin aire
 *    · "KNOW THAT YE" 11 → 13), y para el resto es una aproximación declarada.
 * El HUECO ENTRE PALABRAS es 0x40 (rombo de RUNES.CH), NO un blanco (`@` en los datos
 * crudos); el relleno de centrado sí es 0x20 blanco. La piel shader hereda por NEAREST.
 */

/** Códigos de glifo de caja en RUNES.CH (verificados byte a byte). */
export const SIGN_BOX = {
  TL: 0x38,
  TR: 0x39,
  BL: 0x3a,
  BR: 0x3b,
  H: 0x6c,
  H_TOP_DEC: 0x6d,
  H_BOT_DEC: 0x6e,
  V: 0x67,
} as const;

/** Una celda del layout: código de glifo + si va en la fuente RÚNICA (RUNES.CH) o IBM. */
export interface SignBoxCell {
  /** Código de carácter (glifo de caja rúnico, o code-point ASCII del cuerpo). */
  code: number;
  /** true → dibujar con RUNES.CH (glifo de caja); false → IBM.CH (cuerpo legible). */
  rune: boolean;
}

/** Rejilla del cartel enmarcado, lista para blit celda a celda. */
export interface SignBoxLayout {
  cols: number;
  rows: number;
  /** `rows*cols` celdas en orden fila-mayor. */
  cells: SignBoxCell[];
}

const SPACE = 0x20;
/**
 * Espacio ENTRE PALABRAS del cuerpo = 0x40 (`@`) en los datos horneados de SIGNS.DAT.
 * En RUNES.CH el 0x40 NO es un blanco: es un ROMBO pequeño (bytes 00 00 18 3c 18 00 00 00
 * — verificado en original/u5/play/RUNES.CH), el separador de palabras rúnico visible.
 * OJO: el relleno de centrado sí es 0x20 (blanco); sólo el hueco inter-palabra es 0x40.
 */
const RUNE_WORD_SEP = 0x40;

function boxCell(code: number): SignBoxCell {
  return { code, rune: true };
}

/**
 * Dígrafos comprimidos de RUNES.CH, inverso del expansor del extractor
 * (extractor/src/parsers/signs.ts `DIGRAPHS`): el DOS guarda TH/EA/ST/NG/EE como un
 * ÚNICO glifo runa; el extractor los abre a latín legible al generar signs.json. Para
 * el CUERPO rúnico (veredicto #25) re-colapsamos el latín a esos glifos. Espacio=0x40.
 * Greedy longest-match (2 letras) izq→der: reconstruye el mismo empaquetado del original.
 */
const RUNE_DIGRAPHS: readonly (readonly [string, number])[] = [
  ["TH", 0x5b],
  ["EA", 0x5e],
  ["ST", 0x5f],
  ["NG", 0x5d],
  ["EE", 0x5c],
];

/**
 * Convierte una línea de cuerpo LEGIBLE (latín) a celdas RÚNICAS (RUNES.CH), colapsando
 * los dígrafos. A-Z y los 5 dígrafos → glifo runa (`rune:true`); el espacio → 0x20
 * (`rune:false`, se salta en el blit); cualquier otro char (acento, dígito, signo — la
 * runa no lo cubre) cae a IBM (`rune:false`) para no perder texto. Devuelve las celdas
 * del cuerpo (sin las aristas verticales).
 */
function runicBodyCells(line: string): SignBoxCell[] {
  const s = line.toUpperCase();
  const out: SignBoxCell[] = [];
  for (let i = 0; i < s.length; ) {
    const two = s.slice(i, i + 2);
    const dg = two.length === 2 ? RUNE_DIGRAPHS.find(([k]) => k === two) : undefined;
    if (dg) {
      out.push({ code: dg[1], rune: true });
      i += 2;
      continue;
    }
    const ch = s[i]!;
    const code = ch.charCodeAt(0);
    if (ch >= "A" && ch <= "Z") out.push({ code, rune: true });
    else if (ch === " ") out.push({ code: RUNE_WORD_SEP, rune: true }); // hueco inter-palabra = rombo 0x40 (SIGNS.DAT `@`)
    else out.push({ code, rune: false }); // fuera del alfabeto rúnico → IBM legible
    i++;
  }
  return out;
}

/**
 * Construye el layout enmarcado a partir de las líneas de cuerpo del cartel (ya
 * traducidas/legibles; sin filas en blanco de cabecera/cola — el llamador las recorta
 * como hace game.ts). El cuerpo va RÚNICO por defecto (veredicto #25); `runicBody:false`
 * lo deja en latín/IBM (usado sólo por tests de la variante legible). El interior se
 * dimensiona al cuerpo YA COMPUESTO (celdas runa colapsadas o latín), + 1 aire por lado.
 */
export function layoutSignBox(
  bodyLines: readonly string[],
  opts?: { runicBody?: boolean; maxInterior?: number },
): SignBoxLayout {
  const runicBody = opts?.runicBody !== false; // rúnico por defecto
  const trimmed = bodyLines.map((l) => l.trim());
  // Compone primero el cuerpo de cada línea (runa colapsa dígrafos → más compacto que el
  // latín) y dimensiona el interior al CONTENIDO + 1 aire por lado, CAPADO a `maxInterior`
  // (el interior de la consola = 14). Regla derivada de SIGNS.DAT: los autores rellenan 1
  // espacio a cada lado PERO topan en el ancho del panel — "NORTH BRITAIN" (12 glifos runa)
  // → interior 14, y "PRIVATE ISLAND" (14 glifos) → interior 14 SIN aire (llena el panel).
  // El cap evita que un cuerpo ancho desborde el panel de 16 col (bug: antes 14+2=16 → 18).
  // Nunca por debajo del contenido (así el texto siempre cabe); mínimo 3 para no degenerar.
  const bodies = trimmed.map((line) =>
    runicBody ? runicBodyCells(line) : [...line].map((ch) => ({ code: ch.charCodeAt(0), rune: false })),
  );
  const maxLen = bodies.reduce((m, b) => Math.max(m, b.length), 0);
  const cap = opts?.maxInterior ?? Infinity;
  const interior = Math.min(Math.max(maxLen + 2, 3), Math.max(cap, maxLen));
  const cols = interior + 2; // + dos aristas verticales
  const rows = trimmed.length + 2; // + dos aristas horizontales

  // Índices de las púas decorativas (simétricas al centro); se omiten si no caben.
  const c = (interior - 1) / 2;
  const decLeft = Math.floor(c) - 1;
  const decRight = Math.ceil(c) + 1;
  const decorate = interior >= 6 && decLeft >= 0 && decRight < interior && decLeft !== decRight;

  const cells: SignBoxCell[] = [];

  // Fila superior: TL + (H | H_TOP_DEC) + TR
  cells.push(boxCell(SIGN_BOX.TL));
  for (let i = 0; i < interior; i++) {
    cells.push(boxCell(decorate && (i === decLeft || i === decRight) ? SIGN_BOX.H_TOP_DEC : SIGN_BOX.H));
  }
  cells.push(boxCell(SIGN_BOX.TR));

  // Filas de contenido: V + cuerpo centrado + V (TODO en RUNES.CH por defecto).
  for (const body of bodies) {
    cells.push(boxCell(SIGN_BOX.V));
    const pad = interior - body.length;
    const left = Math.floor(pad / 2);
    for (let i = 0; i < interior; i++) {
      const bi = i - left;
      cells.push(bi >= 0 && bi < body.length ? body[bi]! : { code: SPACE, rune: false });
    }
    cells.push(boxCell(SIGN_BOX.V));
  }

  // Fila inferior: BL + (H | H_BOT_DEC) + BR
  cells.push(boxCell(SIGN_BOX.BL));
  for (let i = 0; i < interior; i++) {
    cells.push(boxCell(decorate && (i === decLeft || i === decRight) ? SIGN_BOX.H_BOT_DEC : SIGN_BOX.H));
  }
  cells.push(boxCell(SIGN_BOX.BR));

  return { cols, rows, cells };
}

/** Dígrafos runa → latín, para reconstruir el texto legible de una fila horneada (log/e2e). */
const RUNE_TO_LATIN: Record<number, string> = {
  0x5b: "TH",
  0x5e: "EA",
  0x5f: "ST",
  0x5d: "NG",
  0x5c: "EE",
  0x40: " ", // rombo inter-palabra
};
/**
 * Códigos de glifo de MARCO (RUNES.CH) — no aportan texto legible.
 * 0x68/0x69/0x6a/0x6b son las esquinas REDONDEADAS que sólo aparecen dentro de las
 * cadenas de `SIGN_MACROS` (hombros y cabecera de lápida): sin ellas en este conjunto,
 * el texto latín de una lápida saldría sembrado de basura al expandir las macros.
 */
const FRAME_CODES = new Set<number>([
  0x38, 0x39, 0x3a, 0x3b, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e,
]);

/**
 * MACROS DE FILA de los carteles — tabla `DS:0x37be` (LOOKOBJ 0x0780
 * `mov si, word ptr [bx + 0x37be]`, con `bx = byte * 2`: se indexa por el BYTE ENTERO,
 * no por `byte − 0x29`). Nueve punteros útiles, los de 0x29..0x31, que resuelven en
 * `DATA.OVL` con la convención `fileoff = DS + 0x10` a nueve cadenas terminadas en NUL
 * de **exactamente 16 bytes cada una** = UNA FILA ENTERA de la consola:
 *
 *   0x29 → DS:0x7388  `67 20×14 67`                         fila de cuerpo VACÍA
 *   0x2a → DS:0x739a  `6a 6c×7 6e 6c×6 6b`                  marco inferior con púa
 *   0x2b → DS:0x73ac  `38 6c×7 6d 6c×6 39`                  marco superior con púa
 *   0x2c → DS:0x73be  `6a 6c×14 6b`                         marco inferior liso
 *   0x2d → DS:0x73d0  `38 6c×14 39`                         marco superior liso
 *   0x2e → DS:0x73e2  `68 6c×4 6b 20×4 6a 6c×4 69`          HOMBROS de lápida (arriba)
 *   0x2f → DS:0x73f4  `6a 6c×4 69 20×4 68 6c×4 6b`          hombros de lápida (abajo)
 *   0x30 → DS:0x7406  `20×5 67 20×4 67 20×5`                PIE de lápida
 *   0x31 → DS:0x7418  `20×5 68 6c×4 69 20×5`                CABECERA redondeada
 *
 * Los nueve punteros van consecutivos con paso 0x12 (16 + NUL + 1 de relleno) y el
 * bloque termina en 0x7439 — justo donde empieza el cartel de Serpent's Hold que el
 * extractor ya lee en DATA.OVL:0x743A (control independiente de que la resolución de
 * la tabla cae donde debe). Sin expandirlas, una lápida pinta el byte crudo: 0x29 es un
 * glifo A CEROS en RUNES.CH, así que la fila desaparece.
 */
export const SIGN_MACROS: Readonly<Record<number, readonly number[]>> = {
  0x29: [0x67, ...Array<number>(14).fill(0x20), 0x67],
  0x2a: [0x6a, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6e, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6b],
  0x2b: [0x38, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6d, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x39],
  0x2c: [0x6a, ...Array<number>(14).fill(0x6c), 0x6b],
  0x2d: [0x38, ...Array<number>(14).fill(0x6c), 0x39],
  0x2e: [0x68, 0x6c, 0x6c, 0x6c, 0x6c, 0x6b, 0x20, 0x20, 0x20, 0x20, 0x6a, 0x6c, 0x6c, 0x6c, 0x6c, 0x69],
  0x2f: [0x6a, 0x6c, 0x6c, 0x6c, 0x6c, 0x69, 0x20, 0x20, 0x20, 0x20, 0x68, 0x6c, 0x6c, 0x6c, 0x6c, 0x6b],
  0x30: [0x20, 0x20, 0x20, 0x20, 0x20, 0x67, 0x20, 0x20, 0x20, 0x20, 0x67, 0x20, 0x20, 0x20, 0x20, 0x20],
  0x31: [0x20, 0x20, 0x20, 0x20, 0x20, 0x68, 0x6c, 0x6c, 0x6c, 0x6c, 0x69, 0x20, 0x20, 0x20, 0x20, 0x20],
} as const;

/** Ancho del área de texto de la consola en columnas (CONSOLE_RECT 24..39). */
export const SIGN_WRAP_COLS = 16;

/**
 * CALCO BYTE-EXACTO: convierte los bytes CRUDOS de un cartel de SIGNS.DAT en filas de
 * celdas listas para blit, transcribiendo `decode_sign_text` (LOOKOBJ.OVL 0x06F8) opcode
 * a opcode. Los cuatro tramos del bucle, en el orden en que los prueba el binario:
 *
 *  1. CABECERA (0x072e-0x0736) — `cmp byte [si-0x4de2], 0xa / je (add si,6)`: mientras el
 *     byte apuntado sea 0x0a, el puntero avanza DE SEIS EN SEIS antes de empezar. Es un
 *     salto de relleno, no un salto de línea.
 *  2. FUENTE (0x0744-0x0752) — `test [bp-4],0x80` → `call 0x7a0e(ax)`: bit alto PUESTO ⇒
 *     font 0 = IBM.CH; bit alto CLARO ⇒ font 1 = RUNES.CH. El grueso del cartel es runa.
 *  3. Los tres casos especiales, en este orden:
 *     · 0x26 y 0x27 (0x0755-0x0764) → emiten **0x6c**, la arista horizontal: es la LÍNEA
 *       DIVISORIA que parten en dos los carteles de leyes de Blackthorn. Pintar el byte
 *       crudo da un glifo a ceros (0x26) alternando con una tilde (0x27).
 *     · 0x29..0x31 (0x0766-0x0798) → MACRO: `SIGN_MACROS`, 16 bytes, siempre en RUNES.CH
 *       (el tramo fuerza font 1 en 0x0772). Ver la tabla arriba.
 *     · 0x0d (0x079a-0x07ac) → font 0 y `call 0x83dc` = `getkey_with_redraw`: **espera
 *       una tecla**, NO imprime y NO abre fila. Es la pausa de página de los carteles
 *       largos, y en los siete que lo llevan cae justo en frontera de fila. El clon no
 *       tiene pausa por tecla en la consola: se consume sin emitir nada (Clase C
 *       declarada — las FILAS resultantes son idénticas con pausa o sin ella).
 *  4. DEFECTO (0x07ae-0x07b7) — `and ax,0x7f` + putchar. Con la máscara, 0x8a y 0x0a son
 *     EL MISMO carácter 0x0a, y el putchar del kernel lo trata como salto de línea.
 *
 * 🔴 NO HAY ANCHO POR CARTEL. `decode_sign_text` no mide nada: quien envuelve es el
 * putchar del kernel (0x742a = ULTIMA.EXE:0x16ba) al llegar al borde del área de texto,
 * `cols` columnas. Buscar la esquina 0x39 para deducir el ancho —lo que hacía este
 * código— falla en los 37 carteles que usan el OTRO juego de esquinas (0x61/0x63) o que
 * empiezan por macro: sin 0x39 el cartel entero colapsaba en UNA fila y de él sólo se
 * veía la primera línea del marco (ficha #198, reporte del usuario: «sale un 9» — 0x61,
 * el glifo de esquina superior izquierda de RUNES.CH, que se lee como un 9).
 *
 * Y la envoltura es INMEDIATA, no diferida: ese putchar incrementa la columna nada más
 * pintar el glifo y, si se pasa del borde derecho de la ventana, hace el salto de fila
 * ahí mismo. ⇒ un salto de línea justo DESPUÉS de una fila llena suma otra fila, en
 * blanco. No es un caso de laboratorio: el cartel de Serpent's Hold (el que el extractor
 * añade desde DATA.OVL:0x743A) sale a doble espacio por eso, y así hay que calcarlo.
 * (Los labels internos del cuerpo de putchar, con sus opcodes, van en
 * `re/notes/carteles-decode-sign-text.md` §3: un offset interno NO es una fila del
 * ledger, y citarlo aquí como si lo fuera le da un aval que no le toca — es lo que
 * tumbó a `test_banda_criterios` en la primera corrida de este carril.)
 *
 * `0x20` = blanco (RUNES.CH glifo a ceros); se conserva como celda (mantiene la rejilla).
 */
export function bakedSignRows(
  raw: readonly number[],
  cols: number = SIGN_WRAP_COLS,
): SignBoxCell[][] {
  const rows: SignBoxCell[][] = [];
  let row: SignBoxCell[] = [];
  const endRow = (): void => {
    rows.push(row);
    row = [];
  };
  const put = (cell: SignBoxCell): void => {
    row.push(cell);
    if (row.length >= cols) endRow();
  };

  let i = 0;
  while (i < raw.length && raw[i] === 0x0a) i += 6; // (1) cabecera de relleno

  for (; i < raw.length; i++) {
    const b = raw[i]!;
    if (b === 0x26 || b === 0x27) {
      put({ code: 0x6c, rune: true }); // (3a) divisoria
      continue;
    }
    if (b >= 0x29 && b <= 0x31) {
      // (3b) fila entera; el rango es el `jb 0x79a` / `ja 0x79a` del binario.
      for (const m of SIGN_MACROS[b]!) put({ code: m, rune: true });
      continue;
    }
    if (b === 0x0d) continue; // (3c) pausa por tecla: no imprime
    // (2)+(4): la máscara a 7 bits deja 0x8a y 0x0a en el mismo salto de línea.
    const ibm = (b & 0x80) !== 0;
    const code = b & 0x7f;
    if (code === 0x0a) {
      endRow();
      continue;
    }
    put({ code, rune: !ibm });
  }
  if (row.length > 0) endRow();
  return rows;
}

/**
 * Texto LATÍN legible de una fila horneada (para el log/e2e): letras + dígrafos, sin marco.
 * El 0x20 rúnico cuenta como ESPACIO: no todos los carteles separan palabras con el rombo
 * 0x40 — los de location 0 usan blancos («HERE LIES A»), y descartarlos daba «HERELIESA»
 * en el `.text` de la consola. Los blancos de relleno se van con el `trim()` final.
 */
export function bakedRowLatin(cells: readonly SignBoxCell[]): string {
  let s = "";
  for (const c of cells) {
    if (c.rune && RUNE_TO_LATIN[c.code] !== undefined) s += RUNE_TO_LATIN[c.code];
    else if (c.rune && FRAME_CODES.has(c.code)) continue; // glifo de marco → sin texto
    else if (c.code >= 0x41 && c.code <= 0x5a) s += String.fromCharCode(c.code); // A-Z
    else if (c.code === 0x20) s += " "; // blanco (rúnico o IBM): separador de palabra
    else if (c.code >= 0x20 && c.code <= 0x7e && !c.rune) s += String.fromCharCode(c.code); // IBM imprimible
  }
  return s.trim();
}

/** Una fila de consola de un cartel: celdas ya centradas (blit verbatim) + texto latín. */
export interface SignConsoleRow {
  /** Celdas de la fila, ya desplazadas al centro del ancho de consola; blit tal cual. */
  cells: SignBoxCell[];
  /** Texto LATÍN para el log/historial y la detección e2e ("" en las filas de marco). */
  text: string;
}

/**
 * Compone el cartel como FILAS DE CONSOLA (lo que hace el DOS: la caja va en el flujo de
 * texto, no en un overlay). Devuelve una fila por cada fila de la caja (marco superior,
 * cuerpos, marco inferior), con las celdas ya centradas dentro de `consoleCols` y el
 * texto latín de cada línea de cuerpo conservado aparte para el log. `bodyLines` son las
 * líneas legibles del cartel (ya traducidas por `t()`), sin filas en blanco de borde.
 */
export function signBoxConsoleRows(
  bodyLines: readonly string[],
  consoleCols: number,
  raw?: readonly number[],
): SignConsoleRow[] {
  // Camino CALCO (inglés/no traducido): pinta las filas HORNEADAS de SIGNS.DAT verbatim
  // (ancho, aire y sub-marcos exactos). El texto latín de cada fila se reconstruye para el
  // log/e2e. Bajo 'es' el llamador NO pasa `raw` (el cuerpo va traducido) → se re-enmarca.
  if (raw && raw.length > 0) {
    // El ancho de envoltura es el de LA VENTANA (quien envuelve es el putchar del kernel),
    // así que se pasa `consoleCols` — no se deduce de los bytes del cartel.
    const grid = bakedSignRows(raw, consoleCols);
    const maxW = grid.reduce((m, r) => Math.max(m, r.length), 0);
    const leftPad = Math.max(0, Math.floor((consoleCols - maxW) / 2));
    return grid.map((cells) => {
      const padded: SignBoxCell[] = [];
      for (let i = 0; i < leftPad; i++) padded.push({ code: SPACE, rune: false });
      padded.push(...cells);
      return { cells: padded, text: bakedRowLatin(cells) };
    });
  }
  const trimmed = bodyLines.map((l) => l.trim());
  // Cap del interior al ancho del panel (consoleCols − 2 aristas): la caja nunca desborda
  // la consola y su ancho reproduce el horneado de SIGNS.DAT (contenido+1 aire, topado).
  const layout = layoutSignBox(trimmed, { runicBody: true, maxInterior: consoleCols - 2 });
  const leftPad = Math.max(0, Math.floor((consoleCols - layout.cols) / 2));
  const out: SignConsoleRow[] = [];
  for (let r = 0; r < layout.rows; r++) {
    const rowCells = layout.cells.slice(r * layout.cols, (r + 1) * layout.cols);
    const cells: SignBoxCell[] = [];
    for (let i = 0; i < leftPad; i++) cells.push({ code: SPACE, rune: false });
    cells.push(...rowCells);
    const isBody = r > 0 && r < layout.rows - 1;
    out.push({ cells, text: isBody ? (trimmed[r - 1] ?? "") : "" });
  }
  return out;
}
