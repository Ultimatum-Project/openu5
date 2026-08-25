/**
 * Overlay de PERGAMINO del comando READY (piel fiel) — MODELO PURO de rejilla.
 *
 * Calca lo que pinta `cmd_ready` (@0x1296) + `item_page_controller` (@0x0f2e, modo
 * 'R'): sobre el panel derecho, el banner ►name◄ (lo pinta skin.ts, igual que Ztats),
 * un marco de pergamino (`draw_list_frame(8)` = 7 filas de contenido) con los ítems
 * equipables poseídos/equipados del PJ, una barra de selección que se mueve con las
 * flechas, y un indicador de flechas de scroll en el borde inferior. El formato de
 * fila es `[cuenta 2 díg. | "--"][glifo/espacio][nombre]`, con el glifo de clase del
 * ítem equipado pintado desde la fuente RÚNICA (testigo "--♥Chain": ese corazón es
 * `RUNES.CH[0x03]`, no `IBM.CH[0x03]`, que es un triángulo — ver la cabecera de
 * `drawReadyPicker` en skin.ts). Ver `core/readyPicker.ts` y re/notes/zstats.md §Ready.
 *
 * Este módulo sirve a CUATRO superficies, y sólo DOS son la misma rutina del binario:
 *   · `"ready"` y `"use"` son el MISMO `print_list_row` @0x05e2 (el `call 0x5e2` de
 *     `item_page_controller` @0x0f9e, con el modo decidiendo los argumentos), así que
 *     las dos delegan en `listRowCells` — ver re/notes/ready-picker-panel.md y
 *     re/notes/use-picker-panel.md.
 *   · `"mix"` (CMDS.OVL 0x18be) y `"shop"` (SHOPPES.OVL 0x0c80) son rutinas PROPIAS del
 *     binario, con layout propio aquí. Y (M)ix, además, NO lleva marco de pergamino.
 *
 * Reutiliza la maquinaria de listas de Ztats (`drawListFrame` = `draw_list_frame`
 * @0x045e): el picker de Ready y las 4 listas de Ztats comparten `render_item_list`.
 */
import type { ReadyPickerRowView, ReadyPickerView } from "../api.js";
import { BLANK, TextWindow, type WindowRect } from "./textwindow.js";
import { drawListFrame, listRowCells } from "./ztats.js";
import { t, getLang, BASE_LANG } from "../../i18n/index.js";

/**
 * OVERRIDE ES ESPECÍFICO DEL PICKER (ruling del lead 2026-07-19). 6 ítems cuyo nombre
 * CORTO fiel (tabla 0x1962) COINCIDE con su nombre largo de InventoryDetails, así que
 * comparten la MISMA key es.json con las tiendas/Ztats — y su traducción es >10 celdas
 * (p.ej. "Chain Coif"→"Cofia de Malla" = 14). En las superficies anchas (tienda ≈ancho
 * libre, Ztats ≈14 celdas) esa ES cabe y se conserva; pero el picker de (R)eady tiene un
 * campo de nombre de SÓLO 10 celdas y el original NUNCA trunca, así que aquí usamos una
 * ES corta propia. No puede vivir en es.json (la key es la misma que la de tienda; una
 * key sintética rompería la guarda anti-fab que exige key ∈ corpus), así que es un
 * override de la CAPA DE DISPLAY del picker, keyed por el nombre inglés corto. reviewed
 * por el lead en el diff. Sólo aplica bajo lang≠'en' y sólo en la variante 'ready'.
 */
const PICKER_SHORT_ES: Readonly<Record<string, string>> = {
  "Chain Coif": "Cofia Mall",
  "Iron Helm": "Ylm Hierro",
  "Long Sword": "Esp Larga",
  "Magic Bow": "Arco Mág",
  "Magic Axe": "Hacha Mág",
  "Ring Mail": "Anillas",
};

/** Nombre display del picker: override ES corto (6 ítems) si aplica, si no el choke t(). */
function pickerDisplayName(name: string): string {
  if (getLang() !== BASE_LANG) {
    const override = PICKER_SHORT_ES[name];
    if (override !== undefined) return override;
  }
  return t(name);
}

/**
 * Filas de contenido visibles a la vez = 7 (`draw_list_frame(8)` @0x12ee). Copia
 * LOCAL de la piel (la guarda core↔piel prohíbe importar runtime del core; el valor
 * canónico vive en `core/readyPicker.READY_VISIBLE_ROWS`, mismo 7).
 */
const READY_VISIBLE_ROWS = 7;

/**
 * Filas de contenido visibles de la variante «shop» (ventana «Arms» de venta del
 * herrero) = **4** (CORRECCIÓN carril buy-herrero, 2026-07-22; antes 5): en
 * `list_wares` (SHOPPES.OVL 0x0c80) el cursor arranca en la fila REL 1
 * (`set_cursor(1,1)` @0x0d43) y el bucle CORTA al llegar la fila a 5 (@0x0d9d
 * `cmp ax,5`) ⇒ contenido rel 1..4; el `cmp si,5` @0x0dd6 es el RELLENO de esas
 * mismas filas (pad de 13 espacios DS 0x7c50) — la lectura "5 filas, 4 pobladas +
 * 1 blanca" era un error. Careo por rejilla de 8 px sobre el testigo clip #31
 * (`av-referencia/yt/clips/weapon-shop/frames/arms_sell_list.png`): borde sup fila
 * 1 · contenido filas 2-5 (4 ítems, la 4ª con la barra) · borde inf fila 6 · banda
 * ↕ fila 7 (sobre la barra azul divisoria del chrome) · caja F/G filas 8-9 intacta.
 * Espejo del canónico `SHOP_ARMS_VISIBLE_ROWS` (core/shops/shopArmsPicker.ts) — la
 * guarda core↔piel prohíbe importar runtime.
 */
const SHOP_VISIBLE_ROWS = 4;

/**
 * Filas de contenido de la variante «mix» (selector de reagentes de (M)ix) = **8**, o
 * sea SIN ventana: el original lista TODOS los reagentes poseídos, y son 8 como mucho.
 * DERIVADO de `mix_reagent_select` (CMDS.OVL 0x18be), que primero CUENTA los poseídos
 * y luego usa esa cuenta —no una constante— como tope del bucle de pintado
 * (`re/disasm/CMDS.OVL.asm`, verbatim):
 *
 *     18c6: 2bc9        sub cx, cx                       ; cx = poseídos
 *     18c8: 2bf6        sub si, si
 *     18ca: 80bc505800  cmp byte ptr [si + 0x5850], 0    ; ¿tiene el reagente si?
 *     18cf: 7408        je 0x18d9
 *     18d5: 8843f0      mov byte ptr [bp + di - 0x10], al ; apunta su ID
 *     18d8: 41          inc cx
 *     18da: 83fe08      cmp si, 8                        ; los 8 reagentes
 *     18dd: 7ceb        jl 0x18ca
 *     18e2: 894eec      mov word ptr [bp - 0x14], cx     ; ★ el tope del pintado
 *     …
 *     1969: 46          inc si
 *     196a: 3b76ec      cmp si, word ptr [bp - 0x14]     ; ★ hasta los poseídos
 *     196d: 75c3        jne 0x1932
 *
 * El array local de IDs vive en `[bp-0x10]` con `sub sp,0x18` de marco: 8 bytes justos
 * para los 8 IDs, otra pata de que el máximo es 8. Y el cuerpo del bucle no posiciona
 * filas: emite un FLUJO (`putchar 0x0a` + espacio + cuenta + espacio + nombre), así que
 * no hay rejilla que recortar. **No hay corte en 7 ni ventana de scroll** — heredarle a
 * Mix el 7 de Ready escondía el 8º reagente (#106).
 *
 * ~~⚠ LÍMITE declarado: … Si con 8 poseídos la ventana de texto del original hace
 * scroll por sí misma … NO lo he derivado.~~ **CERRADO** por el carril
 * `ready-picker-fidelidad`, y la respuesta es NO — con el margen justo. El scroll del
 * emisor sólo dispara si la fila REBASA el `bot` del descriptor:
 *
 *     1742: fe4405    inc byte ptr [si + 5]        ; baja de fila
 *     1749: 8a4405    mov al, byte ptr [si + 5]
 *     174c: 024401    add al, byte ptr [si + 1]    ; + top
 *     174f: 3a4403    cmp al, byte ptr [si + 3]    ; vs bot
 *     1752: 7e13      jle 0x1767                   ; ≤ bot ⇒ NO hay scroll
 *
 * El bucle emite el `\n` ANTES de cada fila, así que los reagentes caen en las filas
 * REL 1..8; con `top=1` y `bot=9` el octavo da `8+1 = 9 ≤ 9` y no desborda. Los 8 caben
 * EXACTOS. Lo que hacía imposible que cupieran era el otro error, ya corregido: el port
 * le pintaba a Mix un PERGAMINO que el binario no dibuja (ver `layoutReadyPicker`), y
 * con marco sólo quedan 7 huecos — que es justo el síntoma «el panel corta el 8º
 * reagente» que el acta de Mix dejó anotado sin causa. La cota y el marco eran el mismo
 * bug visto por dos sitios.
 */
const MIX_VISIBLE_ROWS = 8;

/** Filas de contenido por página según la variante (7 ready/use, 8 mix, 4 shop). */
export function pickerVisibleRows(variant: PickerVariant): number {
  if (variant === "shop") return SHOP_VISIBLE_ROWS;
  if (variant === "mix") return MIX_VISIBLE_ROWS;
  return READY_VISIBLE_ROWS; // "ready" y "use": el MISMO draw_list_frame(8)
}

/** Variantes de fila del pergamino (ver `ReadyPickerView.variant`). */
type PickerVariant = "ready" | "mix" | "shop" | "use";

/**
 * Separador cantidad↔nombre del picker de (U)se: **0x20**, el que empuja
 * `item_page_controller` @0x0f9a en la rama del modo 'U'. Copia LOCAL de la piel (la
 * guarda core↔piel prohíbe importar runtime del core; el canónico es
 * `core/usePicker.USE_ROW_SEP`, mismo valor). NO es el `0x2d` del visor de Ztats
 * (`render_item_list` @0x0765), que es otro llamador de la misma rutina de fila.
 */
const USE_ROW_SEP = 0x20;

/**
 * Marco del picker en el panel derecho: 15 celdas de ancho (cols 24..38) × 9 de alto
 * (filas 1..9). `drawListFrame(win, 7)` pinta el borde superior en la fila rel 0
 * (= fila 1 del panel, bajo el banner), las 7 barras/filas de contenido en rel 1..7
 * (filas 2..8) y el borde inferior en rel 8 (fila 9). El banner ►name◄ va en la fila
 * 0 del panel (borde superior del chrome), lo blitea skin.ts.
 */
export const READY_PICKER_RECT: WindowRect = {
  leftCol: 24,
  topRow: 1,
  rightCol: 38,
  botRow: 9,
};

/**
 * Ventana del SELECTOR DE REAGENTES de (M)ix. El binario la fija con DOS llamadas a
 * `set_text_window` (CMDS.OVL 0x18be → kernel 0x1c22, `0x5ca2`): (24,1,38,9) y luego
 * (24,1,39,9). La SEGUNDA (col 39) es la efectiva → 1 columna de contenido MÁS que
 * Ready (rightCol 38), la que le da sitio a los nombres de 10 chars ("Blk. Pearl",
 * "Sulfur Ash") tras el espacio inicial del formato " NN NAME". Ver el reporte de
 * derivación (0x5ca2 = set_text_window, no un box painter).
 */
export const MIX_REAGENT_RECT: WindowRect = {
  leftCol: 24,
  topRow: 1,
  rightCol: 39,
  botRow: 9,
};

/** Relleno "--" cuando la cuenta del pack es 0 (DS 0x9778); el ítem sigue equipado. */
const QTY_ZERO_FILL = "--";

/**
 * Cuenta a 2 díg. con `print_number` (0x385e = 0x5abe, la MISMA rutina).
 *
 * ★ El RELLENO no es una propiedad del impresor: es el **3er argumento**, y lo elige
 * CADA CALL-SITE. Censo del corpus: 57 sitios empujan ESPACIO (0x20) y 6 empujan CERO
 * (0x30). Por eso el `pad` va parametrizado con el espacio por defecto —el de Ready y
 * ZStats— y sólo quien empuja 0x30 en el binario lo pide explícito. #200.
 */
function qty2(v: number, pad = " "): string {
  return String(Math.min(99, v)).padStart(2, pad).slice(-2);
}

/** Escribe `text` desde (row, col) en la ventana (glifos crudos, sin wrap). */
function writeAt(win: TextWindow, row: number, col: number, text: string): void {
  if (row < 0 || row >= win.rows) return;
  for (let i = 0; i < text.length && col + i < win.cols; i++) {
    const c = col + i;
    if (c >= 0) win.cells[row * win.cols + c] = text.charCodeAt(i);
  }
}

/**
 * Layout de UNA fila del picker en `innerWidth` celdas (área entre las barras │).
 *
 * Las variantes `"ready"` y `"use"` NO tienen layout propio: las DOS delegan en
 * `listRowCells` (= `print_list_row` @0x05e2), porque en el binario son literalmente el
 * mismo `call 0x5e2` de `item_page_controller` @0x0f9e con distintos ARGUMENTOS —
 * name-table, tabla de cuentas y separador. `"mix"` y `"shop"` sí llevan layout propio:
 * son OTRAS rutinas del binario (`mix_reagent_select` CMDS.OVL 0x18be y `list_wares`
 * SHOPPES.OVL 0x0c80), no llamadores de `print_list_row`.
 *
 * Devuelve los glifos + qué columnas salen de la fuente RÚNICA. El campo se sigue
 * llamando `highlightCols` por historia; lo que hace su consumidor (skin.ts @0x0995) es
 * elegir el BANCO de fuente, que es lo que hace el binario (`set_font` @0x3abe = kernel
 * 0x1c9e; el rótulo `set_highlight` quedó refutado en #149).
 */
export function readyRowCells(
  item: ReadyPickerRowView,
  innerWidth: number,
  variant: PickerVariant = "ready",
): { cells: number[]; highlightCols: number[]; inverseCols?: number[] } {
  if (variant === "use") {
    // Fila del picker de (U)se. NO se re-implementa: el `print_list_row` @0x05e2 del
    // modo 'U' es EXACTAMENTE el que ya calca `listRowCells` para la lista 0xf de
    // Ztats (misma name-table 0x1916, misma tabla de cuentas 0xB9EE, mismas ramas de
    // sigilo `*`/`!`/`(`, mismo ocultar-columna con qty 0xff). La ÚNICA diferencia
    // derivada es el separador que empuja el llamador: 0x20 aquí (@0x0f9a), 0x2d en
    // `render_item_list` (@0x0765) — por eso va como argumento y no como constante de
    // la rutina. Duplicar el layout aquí es lo que dejó divergir los dos durante meses.
    const { cells: c, runeCols } = listRowCells(
      { idx: 0, name: item.name, qty: item.qty },
      innerWidth,
      USE_ROW_SEP,
    );
    // `runeCols` = las celdas que van en RUNES.CH (set_font @0x3abe; ver `RowLayout`).
    // El canal de salida de este módulo se llama `highlightCols` por historia, pero su
    // consumidor —`skin.ts` @0x0995— ya hace exactamente eso: pintarlas con la fuente
    // rúnica. Es el MISMO mecanismo que el glifo de clase de (R)eady.
    return { cells: c, highlightCols: runeCols };
  }
  const cells = new Array<number>(innerWidth).fill(BLANK);
  const highlightCols: number[] = [];
  /** Columnas en VÍDEO INVERSO (`putchar(0xfd)` = toggle, kernel @0x17a5/@0x1845). */
  const inverseCols: number[] = [];
  let col = 0;
  const put = (code: number, highlighted = false): void => {
    if (col < innerWidth) {
      cells[col] = code;
      if (highlighted) highlightCols.push(col);
      col++;
    }
  };
  if (variant === "mix") {
    // Fila del SELECTOR DE REAGENTES de Mix (CMDS.OVL 0x18be). La impresión BASE
    // (0x1932) es " NN NAME": LF, ESPACIO (0x1939), cuenta 2 díg. (0x5abe @cols 1-2),
    // ESPACIO (0x1957 @col 3), nombre (@col 4+). La MARCA de selección se pinta ENCIMA
    // con gotoxy a la COL 3 (0x5c72 @0x1a02) como "0xfd [0xf|espacio] 0xfd" (0x19ee-
    // 0x1a2c) — es decir, SOBREESCRIBE la col 3 (el espacio) y las cols 4-5 (las 2
    // primeras letras del nombre); NO desplaza el nombre. Aquí replicamos ese OVERLAY:
    // base " NN NAME", y si el reagente está marcado, cols 3-5 = 0xfd/0xf/0xfd encima.
    // ★ CERO-pad, a diferencia de Ready/ZStats: el 3er arg de `0x1954 call 0x5abe` es
    // `0x1950 mov ax,0x30 / push ax`, no 0x20 ⇒ «01».. «09», no « 1».. « 9». #200.
    const q = qty2(item.qty, "0"); // cuenta 2 díg. (CERO-pad, 0x1950)
    put(0x20); // col 0: espacio inicial (0x1939)
    put(q.charCodeAt(0)); // col 1
    put(q.charCodeAt(1)); // col 2
    put(0x20); // col 3: espacio base (0x1957)
    // i18n: el nombre display pasa por t() (mismo choke que Ztats/tiendas). En 'en' es
    // identidad byte-exacta (calco intacto); en 'es' con hit se recorta al ancho como el
    // binario. El OVERLAY de marca (col 3) va después y no depende del texto.
    for (const ch of t(item.name)) put(ch.charCodeAt(0)); // col 4+: nombre
    if (item.equipped) {
      // 🔴 CORREGIDO (carril ready-picker-fidelidad): ~~cols 3-5 = 0xfd/0x0f/0xfd~~.
      // `0xfd` NO es un glifo: es un CÓDIGO DE CONTROL de `putchar` (kernel 0x16ba)
      // que conmuta el VÍDEO INVERSO y **no pinta celda ni avanza el cursor**:
      //   16cd: 80fa7f  cmp dl, 0x7f
      //   16d0: 7603    jbe 0x16d5
      //   16d2: e99900  jmp 0x176e            ; >0x7f ⇒ ruta de CONTROL
      //   1778: 80fafd  cmp dl, 0xfd
      //   177b: 7428    je 0x17a5
      //   17a5: 8336a85301  xor word ptr [0x53a8], 1
      //   17aa: 80740704    xor byte ptr [si + 7], 4
      //   17ae: ebb7        jmp 0x1767        ; → pop/ret: NI pinta NI avanza
      // y `[0x53a8]` es literalmente el inversor del bitmap del glifo (@0x182f):
      //   182f: 833ea85300  cmp word ptr [0x53a8], 0
      //   1834: 7419        je 0x184f
      //   1845: 26f715      not word ptr es:[di]      ; ← vídeo inverso
      // ⇒ la secuencia @0x19ee-0x1a2c (inverso ON · putchar(0x0f|0x20) · inverso OFF)
      // ocupa **UNA sola celda, la col 3**; las cols 4-5 —las dos primeras letras del
      // nombre— el original NO las toca. Pintar los tres bytes como glifos se comía
      // «Bl» de «Blk. Pearl». Ver `re/notes/ready-picker-panel.md` §6.
      cells[3] = 0x0f; // ☼ marcado (0x1a19); sin marcar queda el espacio base
      inverseCols.push(3); // en VÍDEO INVERSO (los dos 0xfd que lo envuelven)
    }
    return { cells, highlightCols, inverseCols };
  }
  if (variant === "shop") {
    // Fila de la ventana «Arms» de venta del herrero (`list_wares` SHOPPES.OVL 0x0c80):
    // `<cuenta>-<abreviatura>` — cuenta del inventario (equipmentQuantities) impresa en
    // un campo de 2 celdas con pad de ESPACIO (rutina de formato 0xffffdd0e), guión, y
    // el nombre CORTO de la tabla DATA.OVL 0x1972 (= shortEquipNames.json, campo de 10).
    // SIN precio en la fila (el original no lo imprime ahí). El resto de la fila queda
    // limpio con el pad de 13 espacios (DS 0x7c50 → DATA.OVL 0x7c60 = el ancho interior
    // completo: 2+1+10=13). Careo por medición del testigo clip #31: celda EN BLANCO en
    // la col interior 0 para cuentas de 1 dígito y nombre A RAS del borde derecho
    // (` 1-Main Gauch` / ` 4-Sht. Sword` = 13 celdas justas; barra inversa cols 25..37,
    // texto cols 26..37) ⇒ cuenta alineada a la DERECHA del campo de 2, no a la
    // izquierda. El nombre pasa por t() como las otras variantes ('en' = identidad).
    const qs = qty2(item.qty);
    put(qs.charCodeAt(0));
    put(qs.charCodeAt(1));
    put(0x2d); // '-'
    for (const ch of t(item.name)) put(ch.charCodeAt(0));
    while (col < innerWidth) put(0x20); // pad de 13 espacios (limpia el resto)
    return { cells, highlightCols };
  }
  // Fila del picker de (R)eady. Como la de (U)se, NO se re-implementa: el binario la
  // pinta con EL MISMO `print_list_row` @0x05e2 (item_page_controller la llama desde
  // @0x0f9e para los dos modos), y lo único que cambia el llamador son sus argumentos:
  //   · name-table 0x1962 (equipo, 48 entradas) en vez de 0x1916 (@0x0f87 vs @0x0f96),
  //   · tabla de cuentas 0x57c0 (@0x0f46) en vez de 0xB9EE (@0x0f54),
  //   · y el SEPARADOR, que es el único que se decide POR FILA (@0x104b-0x1070):
  //       104b: 837e0452  cmp word ptr [bp + 4], 0x52     ; ¿modo 'R'?
  //       1054: ff7606    push word ptr [bp + 6]          ; charIdx
  //       1057: ff76f0    push word ptr [bp - 0x10]       ; itemIdx
  //       105a: e8bbf4    call 0x518                      ; is_item_equipped
  //       105f: 7503      jne 0x1064
  //       1061: e918ff    jmp 0xf7c                       ; NO equipado → sep = 0x20
  //       1064: 8b5ef0    mov bx, word ptr [bp - 0x10]
  //       1067: 8a87e81a  mov al, byte ptr [bx + 0x1ae8]  ; ★ EQUIPADO → sep = glifo
  //       106d: 8946f6    mov word ptr [bp - 0xa], ax
  //   y ese glifo es <0x20 SIEMPRE (los 48 bytes de 0x1ae8 están en 0x01..0x1e), así
  //   que la fuente rúnica se la pone la rama @0x0615 de `print_list_row` — NO una regla
  //   propia de (R)eady. Ver `re/notes/ready-picker-panel.md` §3.
  // La duplicación que había aquí es exactamente la que dejó divergir (U)se durante
  // meses (#149): dos superficies del MISMO `print_list_row` escritas dos veces.
  const sep = item.equipped && item.glyph > 0 ? item.glyph : 0x20;
  const { cells: c, runeCols } = listRowCells(
    // Los 48 nombres de la tabla 0x1962 NO llevan sigilo `*`/`!`/`(` (censo del volcado
    // de DATA.OVL, 0 de 48), así que las tres ramas de sigilo no se ejercen en (R)eady;
    // y `qty` viene de 0x57c0, que sus tres escritores TOPAN en 0x63=99 (SJOG @0x1697,
    // SHOPPES @0x0a5e, ZSTATS @0x0ccd) ⇒ nunca 0xff ⇒ la columna NUNCA se oculta aquí.
    { idx: 0, name: item.name, qty: item.qty },
    innerWidth,
    sep,
    pickerDisplayName, // override ES corto del picker (campo de 10 celdas)
  );
  return { cells: c, highlightCols: runeCols };
}

/** Resultado del layout del picker: rejilla + fila del cursor + realces + flechas. */
export interface ReadyPickerLayout {
  /** Ventana con el marco y las filas visibles de la página (7 ready, 8 mix, 4 shop). */
  win: TextWindow;
  /** Fila RELATIVA (0..rows-1) bajo la barra de selección, o `null` si fuera de vista. */
  cursorRow: number | null;
  /** Columnas en RUNES.CH por fila relativa (el marcador de equipado de (R)eady). */
  highlightCols: Map<number, number[]>;
  /**
   * Columnas en VÍDEO INVERSO por fila relativa (`putchar(0xfd)`, kernel @0x17a5 →
   * `not word ptr es:[di]` @0x1845). Hoy sólo la marca de (M)ix. Es un canal APARTE de
   * `highlightCols`: aquél elige el BANCO de fuente, éste invierte el bitmap — dos
   * mecanismos distintos del kernel que el port tenía colapsados en uno.
   */
  inverseCols: Map<number, number[]>;
  /**
   * ¿La variante lleva marco de pergamino? `false` sólo en (M)ix, que emite un FLUJO
   * de texto en la ventana recién borrada sin dibujar caja (ver `layoutReadyPicker`).
   */
  framed: boolean;
}

/**
 * Compone la rejilla del picker desde el estado (`ReadyPickerView`, fase `pick`):
 * marco de pergamino + las filas visibles de la página (`pickerVisibleRows`: 7 ready,
 * 8 mix, 4 shop) a partir de `scroll`. La barra de
 * selección (fila del `cursor`) la pinta skin.ts en vídeo inverso; aquí sólo se marca
 * su fila relativa. Las columnas realzadas (glifos de equipados) se devuelven aparte.
 */
export function layoutReadyPicker(
  rect: WindowRect,
  view: ReadyPickerView,
): ReadyPickerLayout {
  const win = new TextWindow(rect);
  const variant = view.variant ?? "ready";
  // Página por variante: 7 filas (ready, draw_list_frame(8) @0x12ee), 8 (mix, el bucle
  // @0x1932-0x196d emite los 8 reagentes sin corte ni scroll — ver MIX_VISIBLE_ROWS y
  // ficha #106: heredarle el 7 de Ready escondía el 8º) o 4 (shop,
  // list_wares contenido rel 1..4 — ver SHOP_VISIBLE_ROWS; marco más corto DENTRO del
  // mismo rect del panel; las filas del rect bajo el borde inferior quedan en blanco).
  const visRows = pickerVisibleRows(variant);
  // 🔴 Mix NO lleva pergamino. Esta llamada era INCONDICIONAL y le pintaba a Mix un
  // marco que el original no dibuja — contradiciendo el comentario de `readyRowCells`
  // dos pantallas más arriba, que ya decía que Mix «no es llamador de print_list_row».
  // NEGATIVA FUERTE, con la ventana cubriendo el fenómeno entero: en las 189
  // instrucciones del cuerpo de `mix_reagent_select` (CMDS.OVL 0x18be..0x1a6f, del
  // `push bp` al `ret`) NO hay un solo `putchar` de glifo de caja (0x10..0x17) — los
  // únicos inmediatos de esa banda son las COORDENADAS de los dos `set_text_window`
  // (0x18 y 0x26/0x27 @0x18f0/0x18f8/0x190e/0x1916) — y su ÚNICO llamador (`cmd_mix`
  // @0x1b5d) tampoco pinta marco antes de entrar: sus putchar de 0x18/0x19/0x1a/0x1b
  // @0x1b41-0x1b53 son las CUATRO FLECHAS del pie de instrucciones, cada una seguida
  // de una coma (0x2c). Lo que Mix pinta es: `putchar(0xff)` = borrar-ventana+home
  // (@0x1903), el puente del panel (@0x1921 → kernel 0x4efc) y el banner ►Reagents:◄
  // (@0x1924 → kernel 0x4e50), y luego un FLUJO de texto.
  // ★ Y la aritmética lo confirma sola, que es el control que cierra el cabo (b) del
  // acta de Mix: la ventana es (24,1)-(39,9) = 9 filas; el bucle emite `\n` ANTES de
  // cada fila, así que los reagentes caen en las filas rel 1..8 y el 8º aterriza en la
  // 9ª fila sin desbordar (el scroll del putchar sólo dispara con `fila+top > bottom`,
  // @0x174f `cmp al,[si+3] / jle`). Los 8 caben EXACTOS — sin marco. Con marco sólo
  // caben 7, que es justo el síntoma que el acta dejó anotado sin causa.
  const framed = variant !== "mix";
  if (framed) drawListFrame(win, visRows);
  // Con marco, el contenido va entre las barras │ (cols 1..cols-2). Sin marco, la
  // fila arranca en la col 0 de la VENTANA (el `putchar(0x20)` @0x1939 es el primer
  // carácter del flujo, no un margen del marco).
  const colOffset = framed ? 1 : 0;
  const inner = win.cols - 2 * colOffset;
  const start = Math.max(0, view.scroll);
  const visible = view.rows.slice(start, start + visRows);
  const highlightCols = new Map<number, number[]>();
  const inverseCols = new Map<number, number[]>();
  for (let r = 0; r < visible.length; r++) {
    const rel = r + 1; // filas de contenido en rel 1..visRows (rel 0 = borde o el LF)
    const {
      cells,
      highlightCols: hcols,
      inverseCols: icols,
    } = readyRowCells(visible[r]!, inner, variant);
    for (let c = 0; c < inner; c++) win.cells[rel * win.cols + (c + colOffset)] = cells[c]!;
    if (hcols.length > 0) highlightCols.set(rel, hcols.map((c) => c + colOffset));
    if (icols && icols.length > 0) inverseCols.set(rel, icols.map((c) => c + colOffset));
  }
  const cursorRel = view.cursor - start + 1;
  const cursorRow = cursorRel >= 1 && cursorRel <= visible.length ? cursorRel : null;
  return { win, cursorRow, highlightCols, inverseCols, framed };
}

/**
 * Glifo de flecha de scroll para el estado del picker (CP437): ▲(0x18) hay ítems
 * arriba, ▼(0x19) hay abajo, ↕(0x12) ambos, o `null` sin overflow. Calca la elección
 * de `item_page_controller` @0x0806/0x0810/0x0816. ÚNICA implementación viva del
 * indicador (la copia `readyScrollArrows` del core era zombi y se retiró — D6).
 */
export function readyArrowGlyph(view: ReadyPickerView): number | null {
  // Página por variante (7 ready, 8 mix, 4 shop). En la variante shop calca el flag de
  // banda de `list_wares` @0x0dde-0x0e1d: +2 si hay ítems ANTES de la página (▲),
  // +1 si hay DESPUÉS (▼), ambos → ↕ — misma tabla de glifos que Ready/Ztats.
  const vis = pickerVisibleRows(view.variant ?? "ready");
  const up = view.scroll > 0;
  const down = view.scroll + vis < view.rows.length;
  if (up && down) return 0x12;
  if (up) return 0x18;
  if (down) return 0x19;
  return null;
}
