# Capa de texto del original — fuente IBM.CH + printer del kernel (E1-S8a)

> Derivación de la rutina de impresión de texto del kernel de ULTIMA.EXE para
> alimentar la CAPA DE TEXTO de la piel fiel (consola + chrome). Complementa
> `re/notes/ui-render-map.md §2` (localización) con la **semántica completa**:
> formato de fuente, estructura del descriptor de ventana, wrap, scroll y
> códigos de control. Autoridad: asm verbatim > capturas (spec #11).
>
> Offsets = imagen del kernel en `re/disasm/ULTIMA.EXE.asm` (convención de
> `ui-render-map.md`). Rutinas: `print_string 0x1850`, `putchar 0x16ba`,
> `get_col 0x1f12`, `set_color 0x1f26`, `scroll_n 0x1f4e`, `window_bounds 0x1f77`.

---

## 1. Formato de IBM.CH (fuente de juego) — ✅ verificado byte a byte

- **1024 B = 128 glifos × 8 bytes.** 8×8 px, 1 bpp mono, **1 byte por fila**,
  **MSB primero** (bit 7 = píxel más a la IZQUIERDA, bit 0 = derecha).
- El kernel indexa el glifo como `code << 3` (`0x16df: mov cl,3; shl di,cl` →
  offset = code·8). Confirma 8 bytes/glifo.
- El blit copia **4 words = 8 bytes** por glifo (`0x1728: rep movsw`, `cx=4`) →
  confirma 8×8 a 1 byte/fila.
- **Rango 128**: los códigos 0x80–0xFA se enmascaran a `code & 0x7F`
  (`0x1787: and dl,0x7f`) antes de blitear; 0xFB–0xFF son **códigos de control
  de atributo** (§4), NO glifos. Por eso la tabla es de 128, no 256.
- Contraste de validación (extractor, `extractor/tests/font.test.ts`):
  `'A'`(0x41)@0x208 = `1E 36 66 7E 66 66 C6 00`; `'B'`(0x42)@0x210 =
  `FC 66 66 7C 66 66 FC 00`; espacio (0x20) y glifo 0 = 8 bytes a cero.
- **Rama modo 24-byte** (`0x16e3: cmp [0x52c8],3; jne … di=di*3`, blit `cx=0xc`):
  cuando el adaptador es tipo 3 (CGA/Tandy, `[0x52c8]`), el stride es 24 B/glifo.
  **Fuera de alcance**: la piel fiel es SOLO EGA (spec §0.2), stride 8.

## 2. IBM.CH ≠ FONT.OVL (dos sistemas de texto)

Confirmado en `ui-render-map §2`: la **consola y el chrome del juego** usan
IBM.CH **mono 8×8** (este printer). Las **cinemáticas** (intro/endgame/gitana)
usan FONT.OVL con **anchos proporcionales** (`render_justified_text`,
`re/notes/font.md`). La capa de texto fiel de S8a implementa la de IBM.CH; la
cinemática es otra ruta (S13).

---

## 3. Descriptor de ventana de texto — 8 bytes, tabla `0x535e`

`print_string` selecciona la ventana activa por índice y calcula su descriptor
(`0x1872–0x187c`):

```
ax = [0x5386]          ; índice de ventana activa
ax <<= 3               ; × 8 (stride del descriptor)
ax += 0x535e           ; base de la tabla de descriptores
```

El mismo cálculo aparece en `0x1fc2–0x1fc9`. El **puntero a la ventana activa**
queda cacheado en `[0x539a]` (lo lee `putchar` en `0x16c9`, `get_col` en
`0x1f18`, etc.). **Layout de los 8 bytes** (`putchar`/`window_bounds` los leen
por campo):

| Off | Campo | Evidencia | Unidad |
|-----|-------|-----------|--------|
| +0 | `leftCol` (x origen) | `0x1f7f: mov al,[si]`; width = `[bx+2]-[bx]` (`0x188c-0x1897`) | celda de carácter (×8 px) |
| +1 | `topRow` (y origen) | `0x1f81: mov bl,[si+1]` | celda |
| +2 | `rightCol` (x máx, **inclusive**) | `0x1f84: mov cl,[si+2]`; cmp de wrap `0x173d` | celda |
| +3 | `botRow` (y máx, **inclusive**) | `0x1f87: mov dl,[si+3]`; cmp de scroll `0x174f` | celda |
| +4 | `curCol` (cursor, **offset desde left**) | `0x1735: inc [si+4]`; abs col = `[si+4]+[si+0]` (`0x1738`) | celda |
| +5 | `curRow` (cursor, offset desde top) | `0x1742: inc [si+5]`; abs row = `[si+5]+[si+1]` (`0x1749`) | celda |
| +6 | `attr` (nibble alto = color fg) | `set_color 0x1f26`: `(arg&0xf)<<4` → `[si+6]` hi | — |
| +7 | `flags` (bit0/1/2) | §4 (`0x179f/0x17aa/0x17b5`) | — |

**Coordenadas en celdas de 8 px.** `window_bounds 0x1f77` traduce el descriptor a
píxeles: `al=[si]<<3`, `bl=[si+1]<<3`, `di=[si+2]<<3 + 7`, `dx=[si+3]<<3 + 7`
(`0x1f8c–0x1f99`). El `+7` confirma bordes **inclusivos** y celda de **8 px**.

- **Ancho de escritura** (columnas) = `rightCol - leftCol` (`print_string`
  `0x1897`). El cursor `curCol` corre `0 .. (rightCol-leftCol)`; el límite duro
  lo impone `putchar` (§4, wrap cuando `leftCol+curCol > rightCol`).
- `[0x538e]` = **flag de auto-avance del cursor**: si ≠0, `putchar` avanza
  `curCol` tras cada glifo (`0x172e: cmp [0x538e],0; je …`). `print_string` lo
  pone a 0 temporalmente en su ruta justificada (`0x1fcf`) y lo restaura.

> **VALORES de los descriptores (px de cada ventana: consola, panel, cabecera):**
> `🎥` S8b — viven en la tabla `0x535e` inicializada en runtime / medibles por
> píxel-diff. Esta task deriva la **estructura y el algoritmo**, no las
> coordenadas concretas (que son el chrome de S8b).

---

## 4. `putchar 0x16ba` — emisor de un carácter (cursor + wrap + scroll)

Firma: `putchar(char c)` (`ret 2`, arg en `[bp+4]`, sólo byte bajo: `di = c &
0xff`, `0x16c0-0x16c3`). Despacho por `dl = c` (`si = [0x539a]` = descriptor
activo):

1. **`c > 0x7F`** (`0x16cd: cmp dl,0x7f; jbe`) → handler de control `0x176e`:
   - `0xFF` (`0x17bb`): **reset de ventana** — `curCol=0, curRow=0`, repinta el
     marco/borde (driver fns `0x2d/0x3f/0x2d`, `0x17cc-0x17f1`). Es el "clear +
     redraw border" de la ventana.
   - `0xFE` (`0x17b0`): toggle **reverse video** → `flags ^= 1` + `[0x53a4]^=1`.
   - `0xFD` (`0x17a5`): toggle **invert/xor** → `flags ^= 4` + `[0x53a8]^=1`.
   - `0xFC` (`0x1799`): **centrado ON** → `flags |= 2` + `[0x53a6]=1`.
   - `0xFB` (`0x178d`): **centrado OFF** → `flags &= ~2` + `[0x53a6]=0`.
   - 0x80–0xFA: `and dl,0x7f` (`0x1787`) y re-despacha como glifo.
2. **`c == 0x0A` (LF)** (`0x16d5: je 0x1742`) → `0x1742: inc curRow`, luego cae a
   `0x1745` (CR) → `curCol=0` + chequeo de scroll. **LF = CRLF** (baja línea Y
   vuelve a la columna 0).
3. **`c == 0x0D` (CR)** (`0x16da: je 0x1745`) → `curCol=0` + chequeo de scroll.
   **CR = sólo retorno de carro** (no baja línea).
4. **Glifo imprimible** (`0x16df+`): calcula offset `code<<3`, teje el bitmap al
   buffer de trabajo `0x53ea` aplicando reverse/invert según flags
   (`prep_glyph 0x17f4`: `[0x53a4]`→invertir, `[0x53a8]`→`not`), llama al driver
   de vídeo (fn `0x5d`, `0x170e-0x1714`) para posicionar en `abs col/row`, y
   blitea 4 words a VRAM. Después, si `[0x538e]≠0` (auto-avance):
   - `inc curCol`; `abs = leftCol+curCol`; si `abs > rightCol` → **wrap**: cae a
     `0x1742` (comportamiento LF: `curRow++, curCol=0`, scroll si toca).

**Chequeo de scroll** (`0x1745-0x1767`): `abs row = topRow+curRow`; si
`abs > botRow` → `scroll_n 0x1f77`… en realidad `call 0x1f77` calcula bounds y el
driver hace el desplazamiento (fn `0x27`, `0x175d-0x1763`), luego `dec curRow`
(el cursor se queda en la última fila). = **scroll de una línea hacia arriba al
rebasar la fila inferior**.

## 5. `print_string 0x1850` — printer con word-wrap

Firma: `print_string(char* s)` (`ret 2`, arg `[bp+4]`). Imprime una cadena a la
ventana activa con **ajuste de línea por palabra**. Buffer local de línea de
**64 bytes** (`[bp-0x40]`). Algoritmo por línea:

1. `remaining = width - curCol` (`width = rightCol-leftCol`, `curCol` vía
   `get_col 0x1f12`) → columnas libres en la línea actual (`0x18b4-0x18bf`).
2. Copia caracteres al buffer parando en **CR(0x0d) / NUL(0) / LF(0x0a)** o cuando
   excedería `remaining` (`0x18ca-0x18f2`; el bucle externo delimita en LF).
3. **Backtrack a palabra**: retrocede hasta el último espacio `0x20`
   (`0x193e-0x1966`) para no partir palabra. Si no hay espacio (`0x196e`),
   restaura la longitud completa y **corta duro**, emitiendo LF si `[desc+4]≠0`
   (`0x1981-0x198e`, marca `[bp-4]=1`).
4. Recorta espacios finales (`0x1996-0x19ae`).
5. **Centrado** si `flags & 2` (`0x19d5`): pad izquierdo `(width-len)/2`
   (`0x19ea-0x19fa` vía `0x1cee`/`0x1bf2`).
6. Emite el run carácter a carácter con `putchar 0x16ba` (`0x1a14-0x1a2a`).
7. Entre líneas emite un **LF de separación** (`0x189a-0x18a4`, salvo la primera)
   y vuelve al paso 1 (`0x1a33 → 0x189a`) hasta agotar la cadena.

## 6. Helpers

| Rutina | Qué hace | Evidencia |
|--------|----------|-----------|
| `get_col 0x1f12` | devuelve `curCol` (`[si+4]`) | `0x1f1c: mov al,[si+4]` |
| `set_color 0x1f26` | color fg: `(arg&0xf)` → `[0x53ab]` y nibble alto de `attr` `[si+6]` | `0x1f30-0x1f44` |
| `scroll_n 0x1f4e` | scroll de n líneas (driver fn `0x27`, `-n·8` px) | `0x1f5b-0x1f6c` |
| `window_bounds 0x1f77` | bounds en px del descriptor (`×8`, `+7` incl.) | §3 |

---

## 7. Qué implementa la piel fiel (S8a) y qué queda para S8b

- **✅ S8a (esta task):** el MODELO derivado — descriptor de ventana (§3),
  semántica de `putChar` (LF=CRLF, CR=retorno, wrap por `rightCol`, scroll por
  `botRow`, §4) y word-wrap de `print_string` (§5). Primer uso: la **consola**
  (renderiza `snapshot.console` con IBM.CH). Ver `game/src/skin/fiel/`.
- **🎥 / S8b:** los **valores** del descriptor de cada ventana (px de consola,
  panel derecho, cabecera) — chrome/marco EGA, calco por píxel-diff (tabla
  `0x535e` en runtime). Los **glifos de caja** (`0x10/0x11/0x13-0x16` de IBM.CH)
  para `draw_list_frame` (`re/notes/zstats.md`). Atributos reverse/centrado del
  panel. El **parpadeo del cursor** de consola (cadencia) = catálogo AV (task #4).
- **Fuera de alcance (fiel = EGA lógico):** el driver de vídeo (fns `0x5d/0x27/
  0x2d/0x3f`), el back-buffer VRAM y la rama 24-byte del modo CGA/Tandy `[0x52c8]`.

---

## 8. Chrome EGA — `paint_screen_frame 0x637e` (E1-S8b, coords LITERALES)

Pinta el marco 320×200 con coordenadas horneadas. Primitivas (arg order
verificado leyendo cada una):
- `set_color(c) 0x0a70` — color de dibujo (1 arg).
- `fill_rect(x0,y0,x1,y1) 0x0aa6` — `ax=[bp+0xa]=x0, bx=[bp+8]=y0, cx=[bp+6]=x1,
  dx=[bp+4]=y1` (bordes INCLUSIVOS). Verificado: el clear = `(0,0,0x13f,0xc7)` =
  320×200; barra superior = `(0,0,0x13f,6)`.
- `line(x0,y0,x1,y1) 0x0b10` — mismo orden; guarda el último extremo en
  `[0x52cc]/[0x52ce]`.
- `point(x,y) 0x0f90` — **continúa la polilínea** desde el último extremo (los
  bordes son cajas dibujadas como `line` + N×`point`).
- `set_cursor(col,row) 0x1bf2` (`ax=[bp+6]=col, bx=[bp+4]=row`) + `glyph 0x16ba`.

**Secuencia (offset · op):**
- `6384/6396`: `set_color(0)` + `fill_rect(0,0,0x13f,0xc7)` = **clear negro 320×200**.
- `6399-6411`: `set_color([13b2])` + 7 barras/paneles (ver `FRAME_FILLS` en
  `game/src/skin/fiel/frame.ts`): superior `y0..6`, inferior `y0xb9..0xbf`,
  izquierda `x0..6`, **separador viewport|panel `x0xb9..0xbf`**, franja derecha,
  2 barras de panel.
- `6414-644a`: glifos de esquina `0x7b/0x7c/0x7d` en celdas `(0,0)/(0x27,0)/
  (0,0x17)`.
- `644b-6504`: `set_color([13b0])` + **caja del viewport** (polilínea
  `(7,7)→(7,0xb8)→(0xb8,0xb8)→(0xb8,7)→(7,7)` = `(7,7)-(184,184)`, 11×16) + L y 2
  sub-cajas del panel (`FRAME_SEGMENTS`).

**Derivado (literal):** toda la geometría → `frame.ts` (cada op con su offset).
**Clase C (píxel-diff / catálogo AV):** los índices de color `g_unk_13b2`
(marco) y `g_unk_13b0` (borde) son globals de runtime **sin init estático** (solo
lecturas `ff36…` en el corpus) → confirmar por captura. Los **rects del descriptor
de texto** (consola/panel/status en la tabla `0x535e`) los fija el runtime por
overlay (el init `0x1184` deja los 4 a full-screen 40×25); acotados por la
geometría del marco (viewport 7..184, panel x≥0xc0, texto). `set_text_window
0x1c22` es el configurador (callers `0x23e4/0x24ff` son modo-específicos).

---

## 9. Banda celeste — sol/lunas `0x4adb` (E1-S8b)

Rutina que compone un buffer de 12 celdas (`[bp-0x10..bp-5]`) y lo imprime sobre
la barra superior (cursor `set_cursor(6,0)` @`0x4b53`). **Gate real** (dos
niveles): la rutina NO corre en MAZMORRA (`0x4a8c: cmp [g_location],0x21; jb` →
`location < 0x21`, así que overworld **Y pueblos/castillos** SÍ tienen banda); y
el DIBUJO se salta en el underworld (`0x4b5d: cmp [g_floor],0x80; jae`) y en la
location `0x19` (Ararat), donde pinta **cajas** en vez de sol/lunas (`0x4ba2` —
Clase C, no modelado). El `0x4b5d` NO apaga pueblos (era mi lectura errónea).

- **Sol** (glifo `0x2A`, ráfaga en IBM.CH): `si = 17 - g_hour` (`0x4ac8: sub
  0x11; neg`), colocado si `0 ≤ si < 0xc` (`0x4ad0`). Visible hora 6..17.
- **Felucca** (`0x4adf-0x4b19`): fase = `[0x1ed8 + g_day*2]` (`g_felucca_phase`,
  byte `0x30..0x37`, cruza `re/notes/shrines.md §fases`); celda `8 - g_hour`
  (`0x4af1`), `+24 si < -12` (`0x4afb`), si `0..11`.
- **Trammel** (`0x4b19-0x4b53`): fase = `[0x1ed9 + g_day*2]`; celda `2 - g_hour`
  (`0x4b28`), mismo wrap.
- **Glifo de luna = el propio byte de fase** = dígito `'0'..'7'` de IBM.CH
  (`0x16ba` lo imprime tal cual). Colores: sol `[g_unk_13b8]`, lunas
  `[g_unk_13ba]` (Clase C, como `13b0/13b2`).

**Derivado:** posiciones (fórmulas) + glifos → `sky.ts`. Las **fases** las provee
el core en `snapshot.sky` (`moonPhasesForDay`, ya derivado en moongates.ts). El
**origen exacto** de la banda en la barra (col de cursor 6 + origen de la ventana
de status runtime) y los **índices de color** = Clase C, píxel-diff.

---

## CORRECCIÓN §9 (#169, medida en el árbol de `7c4aa56c`) — la «banda celeste» es la ÚNICA PRODUCTORA de las fases lunares

§9 describe `0x4a84` como una rutina que «compone un buffer de 12 celdas y lo imprime»,
y cierra su único residuo como «Clase C, no modelado» (las cajas de Ararat). Eso archiva
en la capa de PRESENTACIÓN una rutina que **escribe estado del mundo**:

```
0x4aeb  mov [0x5885], al     ; ← g_felucca_phase,  de [bx+0x1ed8] con bx = g_day*2
0x4b25  mov [0x5886], al     ; ← g_trammel_phase,  de [bx+0x1ed9]
```

Ambas globales están dadas de alta en `re/ledger/globals.json:665` y `:672`. Censo de
accesos sobre `re/disasm/*.asm`: **6 en total**, todos en ULTIMA.EXE — las 2 escrituras de
arriba, 2 relecturas internas (`0x4b13`, `0x4b4d`, para pintar el glifo) y **2 lecturas
EXTERNAS, `0x4969` y `0x496e`, dentro de `moongate_enter` 0x48a8**, que con `sub ax,0x30`
y `call 0x47f4` acaba escribiendo cuatro globales de posición: en CS 0x4841 la de
localización, en CS 0x4848 y CS 0x484f las dos coordenadas de la party, y en CS 0x4856 la
de piso.

⇒ **la rutina llamada `draw_*` es la única productora del estado que decide adónde te
manda una moongate.** No es un caso de #144 (la mecánica está portada:
`game/src/core/world/moongates.ts:59` `moonPhasesForDay` y `:88` `activeGatePhase`, misma
tabla `DATA.OVL fo 0x1EEA` y mismo `-0x30`, cruzada en `re/notes/shrines.md:91-101`); es
la NOTA la que archiva mal.

Dos precisiones más del mismo cuerpo:

- **La rama del underworld está MUERTA.** §9 describe el salto `0x4b64: cmp g_floor,0x80;
  jae 0x4ba2` como una rama viva. El llamador único (`0x5161`, verificado:
  `grep -c "call 0x4a84"` = 1) ya filtra `g_floor>=0x80` en `0x515a`, así que ese brazo es
  inalcanzable por construcción. Sólo vive el de Ararat (`0x4b5d: cmp g_location,0x19`).
- **El call-site tiene TRES guardas** que §9 no recoge (`re/disasm/ULTIMA.EXE.asm:8781-8789`):
  `0x5151 je` (sólo si cambió la HORA, contra `g_prev_hour`), `0x5153 cmp g_location,0x21;
  jae` y `0x515a cmp g_floor,0x80; jae`.

★ **RESIDUO SIN PORTAR (tarjeta propia, NO se porta aquí): el LATCH.** El original
*latchea* las dos fases y sólo las refresca en frontera de hora **y** con `g_location<0x21`
**y** `g_floor<0x80`; en cambio `g_day` se incrementa en `0x5051 inc [g_day]` sin ninguna
de esas guardas. Consecuencia: **si la medianoche pasa en mazmorra o bajo tierra, las
fases se quedan CONGELADAS en las de ayer** hasta la siguiente frontera de hora en
superficie. El port no latchea: recalcula `moonPhasesForDay(raw, time.day)` en cada
llamada (`moongates.ts:93`, `game/src/skin/coreview.ts:1600`) y no tiene
`feluccaPhase`/`trammelPhase` en el estado (censado: 0 ocurrencias en `game/src`). Fase
distinta ⇒ `state.moonstones[phase]` distinta ⇒ **destino de teleport distinto**. Alcance:
pisar una moongate tras salir de mazmorra/Underworld antes del siguiente tic de hora en
superficie.

⚠ Declarado con su nivel de confianza: que el latch SOBREVIVA a save/load es **inferencia
aritmética**, no verificación byte a byte (por los dos anclas de `globals.json`, `g_hour`
0x587F→save +0x2D9 y `g_karma` 0x5888→+0x2E2, delta 9 en ambos lados, 0x5885/0x5886
caerían en +0x2DF/+0x2E0). No está sellado.

### PRECONDICIÓN DE #176: SELLADA (y mi propia cautela de #169 era demasiado floja)

La corrección de #169 dejaba el latch de fases con esta reserva: «que el latch SOBREVIVA a
save/load es **inferencia aritmética**, no verificación byte a byte; no está sellado». La
reserva era correcta como cautela pero **el razonamiento que la sostenía era el flojo**: yo
lo había planteado como interpolar entre dos anclas que casualmente distan 9. No es eso.

**Es estructural, y por tanto queda SELLADO.** `docs/formats/tlk-npc-dataovl-gam.md:172`
declara que **DS:0x55A6 ES la copia en RAM de SAVED.GAM** (`savedGamWindow`, fileoff
0x55B6, **0x1060 B**). O sea que no hay «mapeo» que interpolar: el bloque DS *es* la imagen
del save, y el offset de fichero de cualquier global de esa ventana es exactamente
`addr − 0x55A6`. El port usa la misma cota (`SAVED_GAM_SIZE = 0x1060`,
`game/src/core/saveNative.ts:37`).

Comprobado sobre las dos globales cuyo offset de save está verificado con sonda DOSBox
en `re/ledger/globals.json` — y las nuestras caen ENTRE ellas, no fuera:

| global | DS | save | dentro de la ventana |
|---|---|---|---|
| `g_hour` | 0x587F | +0x2D9 ✔ (documentado) | sí |
| **fase de Felucca** | **0x5885** | **+0x2DF** | **sí** |
| **fase de Trammel** | **0x5886** | **+0x2E0** | **sí** |
| `g_karma` | 0x5888 | +0x2E2 ✔ (documentado) | sí |

⇒ **las dos fases PERSISTEN en el save.** El modelo correcto para el port es un par
latcheado en el ESTADO GUARDADO, no de sesión. (Los dos bytes caen además en el hueco
0x2DC-0x2E1 que §4 del doc no documenta, lo que explica que nadie los modelara.)

★ **Y un hallazgo que cambia DÓNDE va el cableado**, encontrado al buscar el sitio del
refresco: las tres guardas **NO están en `advance_clock`**, están en el CALL-SITE del
dibujo de la banda (CS 0x5161): `0x5151 je` (sólo si CAMBIÓ la hora, contra `g_prev_hour`),
`0x5153 cmp g_location,0x21 / jae` y `0x515a cmp g_floor,0x80 / jae`. `advance_clock` sí
mantiene `g_prev_hour` (el port ya lo replica en `state.prevHour`,
`core/world/survival.ts`), pero quien decide refrescar es el consumidor. Portarlo dentro de
`advanceClock` daría un latch que se refresca también en mazmorra — justo el defecto que la
tarjeta persigue.

**Radio del cableado, MEDIDO:** `activeGatePhase` tiene 2 consumidores fuera de su módulo
(`skin/coreview.ts:1338` y `core/__parity__/shrines-run.ts:83`), `moonPhasesForDay` 1
(`coreview.ts:1600`), más `tests/moongates.test.ts`. Cuatro sitios.

**NO PORTADO en este carril** (alcance declarado, no fabricado): queda el cableado —
2 campos de estado, lectura/escritura en `saveNative` a +0x2DF/+0x2E0, `activeGatePhase`
leyendo el latch, y el refresco bajo las TRES guardas en el punto equivalente al call-site.

### PORTADO (#176, rama `fix/cielo-176`) — y ★ el «call-site» ERA `advance_clock`

El apartado de arriba insiste en que las tres guardas «**NO están en `advance_clock`**,
están en el CALL-SITE del dibujo de la banda (CS 0x5161)», y avisa de que portarlas dentro
de `advanceClock` daría un latch que se refresca también en mazmorra. **Las dos mitades de
esa frase son falsas, y la segunda es exactamente al revés.** Medido sobre
`re/disasm/ULTIMA.EXE.asm`:

```
4f7b: c3          ret                 ; fin de la rutina ANTERIOR
4f7c: 55          push bp             ; ← ÚNICO prólogo de toda la banda 0x4f7c-0x519c
4f7d: 8bec        mov bp, sp
4f7f: 83ec0a      sub sp, 0xa
…
5161: e820f9      call 0x4a84         ; el «call-site» de la banda celeste
…
519b: 5d          pop bp
519c: c20200      ret 2               ; ← ÚNICA salida
```

En `0x4f7c-0x519c` hay **un solo `push bp` y un solo `ret`** ⇒ es UNA rutina, la que el
port llama `advanceClock` (sus propias citas la anclan: `0x4F8D` Quickness, `0x4FA0`
g_prev_hour, `0x4FA6` time-stop, `0x4FB4/0x4FBE` antorcha y luz, `0x4FC8-0x509A`
rollovers). El `0x5161` no es un consumidor externo: es **la cola de la misma rutina**.

Lo que había pasado es que el PORT la tenía partida en tres piezas y nadie había vuelto a
mirar los límites:

| tramo del binario | qué hace | dónde vive en el port |
|---|---|---|
| `0x4f8d-0x509e` | Quickness, prev_hour, minutos, antorcha, rollovers | `advanceClock` (survival.ts) |
| `0x50a1-0x5145` | recálculo del nivel de luz + flag de repintado | `lightLevel` — función PURA y on-demand (cita `0x50BA`) |
| **`0x514a-0x5161`** | **las tres guardas + el latch de fases** | **no existía** ← esta tarjeta |
| `0x5164-0x5183` | hora en formato 12 h para la barra | la piel |

Y el aviso estaba invertido: **las tres guardas viven ahí y son justo lo que impide que se
refresque en mazmorra.** Ponerlo en `advanceClock` no reproduce el defecto — lo cierra.

★ Además hay una razón por la que el refresco **no puede** ir en ningún otro sitio: el
flanco de hora se compara contra `g_prev_hour`, que **escribe la propia rutina en 0x4fa3**
justo antes de avanzar, así que `0x514d` pregunta «¿cambió la hora en ESTA llamada?». Fuera
de ella el flanco ya no está: el housekeeping lo CONSUME (`0x2b9c mov [g_prev_hour],al`,
portado en `turnHousekeeping`, `survival.ts`). Un refresco a final de turno se lo comería.

**Cableado que aterriza:** `state.feluccaPhase`/`state.trammelPhase` (bytes crudos),
`saveNative` a +0x2DF/+0x2E0 con roundtrip byte-idéntico, `refreshMoonPhaseLatch` en la cola
de `advanceClock` con las tres guardas, `activeGatePhase`/`latchedMoonPhases` leyendo el
latch, y la banda del cielo (`skin/coreview.ts`) dibujando el par latcheado. El contexto
(tabla + `g_location` **efectivo**, #123) lo produce `Game.skyRefreshCtx` y se enhebra por
los caminos que mueven el reloj. Detalle y cifras en `re/notes/cielo-176-acta.md`.
