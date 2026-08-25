# Kernel sweep — BARRIDO lote 2 (task #16)

> Lectura instrucción-a-instrucción del segundo lote de nivel A del kernel
> (`re/coverage-depth.md` §3/§4 + los foundational far de `ULTIMA.EXE.seg2.md`).
> Convención (idéntica al lote 1): offsets `0xNNNN` = offset de imagen del kernel en
> `re/disasm/ULTIMA.EXE.asm` (CS-relativo). `[0xNNNN]` = global **DS = DATA.OVL**
> (`fileoff = DS_off + 0x10`). No re-deriva lo ya hecho: enlaza. Scout: lote 2.

## 0. TL;DR — hallazgos que cambian el mapa

1. **`0x6bc2` = SEGUNDO consumidor de RNG en la ruta de render** (tras `0x6936` del
   lote 1). Es el **renderer de tile animado**: por cada tile con varios frames rola
   **`rand_range(1,count)` (`0x2092`)** para elegir el frame de arranque, y si
   `[0x5959]!=0` **rola OTRA vez** (doble tirada). Además baraja 16 elementos con un
   **Fisher-Yates que también consume `rand_range(0,0xf)`** cuando el flag `[bp+6]&4`.
   → nueva fila en `deliberate-divergences.md` (RNG-en-render #2). Ver §6.

2. **`0x2192` NO es "conversión reloj/scroll"** (coverage-depth §3 #12). Es el
   **generador de tono del PC-speaker** (`out 0x42` PIT ch2 + `out 0x61` gate,
   con delays software calibrados por `0x1158`). Barre la frecuencia. Insumo directo
   de la **fidelidad sensorial SFX (task #3)**. Ver §5.

3. **`0x1eac` NO es "update de tile"** (parentético del lote 1, `kernel-render-sweep.md
   §6`). Es **selección/verificación de unidad de disco DOS** (`int 21h AH=0E/19`) que
   dispara el hook far `[0x5394]` en error (= el prompt de cambio-de-disco). Ver §5.

4. **`0x0000` es literalmente `main()`** + el arranque del runtime C (crt0), no sólo el
   parser de argv. Contiene el **bucle principal del juego** que despacha overlays por
   `g_location`. `0x1158` es el **init de runtime + el cargador de overlays PLINK86**
   (DOS open/read/alloc/free). Ambos son clusters, no funciones sueltas. Ver §1.

5. **La geometría de la piel fiel ya es legible.** `0x637e` pinta el **marco/chrome de
   pantalla con coordenadas EGA literales** (320×200); `0x56ac` es el **compositor del
   viewport 11×11**; `0x2884` dibuja la línea de estado (gold justificado). Las tres
   son el contrato visual que tasks #1/#11 deben calcar. Ver §2/§3/§4.

---

## 1. Los dos clusters de arranque — `0x0000` (main+crt0) y `0x1158` (init+loader)

### `0x0000` — `main_game_loop` (entry + bucle principal)  `[0x0000, 0x02f4)`
- `0000-0060`: parsea los switches de vídeo de argv (`toupper` vía `0x2032`, compara
  `'C'/'H'/'T'/'E'` → flags `[0x52ba]/[0x52f3]/[0x52f1]/[0x52ef]`). Confirma la nota
  previa del ledger.
- `0061-00ac`: inicializa estado de juego: `[0x5394]=0x2322` (vector far por defecto =
  `anim_hook_2322` del lote 1), `g_unk_a9bd/be=0`, lee un char de config (`0x16a6`),
  `g_kbd_buffer_on=1`.
- `00ad-0176`: **BUCLE PRINCIPAL** (`0xb8`↺). Despacha por `g_location`:
  - `==0` (exterior): `0x7a3a`/`0x7a46`/`0x7a52` (overlays MAINOUT/OUTSUBS).
  - `1..0x20` (pueblos): `0x7a16`.
  - `>=0x21` (mazmorra): `0x25d8` (cursor) + `0x7a22`.
  Carga cada overlay con **`0x1674`** (el dispatcher de carga de overlay, ret=0 hasta
  éxito) y lee su registro `.DAT` con `0x256e`. Refresca con `0x2900` (status redraw).
- `0177`: `0x0878` (set video mode) y `ret`.
- `017e-02f3`: **crt0** (arranque C): `int 21h AH=30` (ver. DOS), monta `ss:sp`
  (`ss=0x0f64`, `add sp,0xbd3e`), llama `0x0586`/`0x055d` (init C), sale con `int 21h
  AX=4Cff`. Es el _startup_ de Borland, no lógica de juego.

**Clasificación:** entry-point real del juego. El bucle exterior→pueblo→mazmorra por
`g_location` es la **máquina de estados de localización** de alto nivel (complementa
`command-dispatch.md`). Boilerplate el crt0; NO boilerplate el bucle.

### `0x1158` — `runtime_init_and_overlay_loader`  `[0x1158, 0x1674)` (cluster)
Prólogo real del init en `0x1158-0x1183`; el resto son subrutinas/ISR inlined.
- **Init (`0x1158-0x1183`)**: instala `INT 0x24` (error crítico → ISR `0x1233`) e
  `INT 0x23` (Ctrl-C → ISR `0x1247`) con `int 21h AH=25`. Llama a 3 helpers:
  - `0x1184`: monta la **tabla de 4 window-rects** en `[0x535e]` (8 B/rect =
    `{l=0,t=0,r=0x27,b=0x18, 0,0,0xf,0}` → **ventana de texto 39×24**), `[0x539a]`=ptr,
    `[0x5386]=0`.
  - `0x1226`: cero a `[0x53a4/53a6/53a8]`.
  - `0x11b4`: **calibración de velocidad de CPU** — engancha `INT 0x1C` (tick de timer
    → ISR `0x1214` que hace `inc [0x535a]`), cuenta ticks contra un bucle, calcula
    `[0x5356]=(ticks*0x12)/0x2ee`, y `int 0x12` (tamaño de RAM) → `[0x5358]`. Éste es
    el valor que cronometra los delays software del sonido (`0x2192`) y anim.
- **ISRs inlined**: `0x1214` (tick timer, `inc [DS=0x0f64:0x535a]`), `0x1232` (`retf` =
  valor por defecto de `[0x5394]`, confirma `command-dispatch.md §4`), `0x1233` (error
  crítico: `[0x535c]=1`), `0x1247` (Ctrl-C: `clc; iret`).
- **Cargador de overlays (`0x124a-0x1673`)**: `int 10h mode 3` + `int 21h AH=9` (msg de
  error) + `int 21h AX=4C01` (salida fatal); rutinas de `int 21h AH=3D` (open r/w),
  `AH=3F` (read), alloc/free (`0x15c6`/`AH=49`), `AH=3E` (close). Es la maquinaria
  PLINK86 que trae los `.OVL` de disco al CS único de 64K.

**Clasificación:** foundational/boilerplate demostrado (ISRs + DOS I/O), pero con dos
datos vivos: la **geometría 39×24 de la ventana de texto** y la **calibración de CPU**
que gobierna la cadencia de los delays. No hay mecánica de juego oculta.

---

## 2. `0x637e` — `paint_screen_frame` (chrome/marco EGA con coords literales)  `[0x637e, 0x6505)`

Pinta el **marco completo de la pantalla de juego** con coordenadas horneadas, usando
las primitivas del lote 1 (`0x0a70` set-color, `0x0aa6` fill-rect, `0x0b10` line,
`0x0f90` pixel/short, `0x16ba` glyph, `0x1bf2`/`0x1cca` cursor):
- `6384-6398`: `set_color(0)` + `fill_rect(0,0xc7,0x13f,0)` = **limpia 320×200 a negro**.
- `6399-6413`: barras y paneles con `[g_unk_13b2]` (color de marco): top `y=6`, panel
  lateral en `x=0xb9/0xbf`, área de texto en `x=0x138`, franjas `y=0x57`.
- `6414-644a`: glifos de esquina `0x7b/0x7c/0x7d` (runas de marco) posicionados con
  `0x1bf2`.
- `644b-6504`: líneas y bordes del **viewport** (`x∈[7,0xb8]`, `y∈[0x3f,0xbf]`) con
  `0x0b10`/`0x0f90`.

**Insumo piel fiel:** éste es el **layout maestro EGA** — las coordenadas literales
(viewport `~0xb8×0xb8` px arriba-izq, panel derecho desde `x=0xc0`, línea de estado en
`x=0x138`) son el chrome que la piel fiel debe reproducir al píxel. Las coords listadas
arriba salen directas del binario.

---

## 3. `0x56ac` — `viewport_compose` (compositor de tiles 11×11)  `[0x56ac, 0x5920?)`

Doble bucle **11×11** (`di=y 0..0xb` externo, `si=x 0..0xb` interno) que compone la
ventana visible en pantalla. Por celda:
- buffer de mapa visible `[si+base-0x54fe]` (=`0xab02`, stride 32) y capa de actores
  `[si+base-0x539c]` (=`0xac64`, stride 16).
- si la celda de mapa `==0` (vacía) y la capa de actor `!=0x16` → dibuja el sprite de
  actor (`0x10e0`).
- si tile `==0xdc` (hoguera) y `[0x5887]∈1..0xf` → tile de fuego **animado** (`0x1112`).
- en otro caso → mapea el tile por la **tabla de remap `[tile-0x4ee2]`** y lo dibuja
  (`0x10e0`).

**Clasificación:** núcleo del render del mundo — el que vuelca las 121 casillas
visibles a pantalla (complementa `paint_world_layer_A`/`0x5394` del lote 1, que prepara
el buffer; éste lo pinta). `0x10e0` y `0x1112` son sus dos blitters leaf (quedan A;
lote 3). Sin RNG.

---

## 4. `0x2884` — `status_draw_gold` (línea de estado: oro justificado)  `[0x2884, 0x2900)`

Trozo de la línea de estado que precede a `kernel_status_redraw` (`0x2900`):
- `0x1b94(1)` + `0x1bf2(8,7)` = posiciona cursor col 8 fila 7.
- rellena con espacios (`0x16ba(0x20)`) según `g_gold < 1000 / 100 / 10` →
  **justificación a la derecha** del número.
- imprime la etiqueta `[0x54b6]` (`0x1850`) y el valor `g_gold` (`0x1a3e`,
  `ui_value_to_bar` del lote 1, aquí en su modo imprimir-número).

**Insumo piel fiel:** confirma que el oro va en col 8 / fila 7 del panel, justificado a
la derecha a 4 dígitos. `0x2884` es el `printer de nº justificado` que `seg2.md` marcó.

---

## 5. Primitivas de I/O y sonido

### `0x2192` → `pcspeaker_tone_sweep` (tono del PC-speaker)  `[0x2192, 0x223c)`  **⚠ corrige coverage-depth #12**
`ret 0xa` = 5 args `(step=[bp+4], start=[bp+6], count=[bp+8], delay=[bp+0xa], inc=[bp+0xc])`.
- `2198-21a8`: `[0x5454] = [0x5356] < 0x64 ? 0 : [0x5356]/0x18` (duración de semiciclo
  derivada del reloj calibrado por `0x1158`).
- `21ac-21b3`: programa **PIT canal 2** (`out 0x42` con divisor `0x003c`).
- bucle `cx=count`: `out 0x61` alternando bits 0-1 (**gate del speaker**: `and 0xfc`=
  off / `or 3`=on) con delay software anidado (`[0x5450]/[0x5452]`), avanzando la
  frecuencia por `[bp+4]`/`[bp+0xc]` → **barrido de tono**. `g_unk_a9ce` = flag de
  sonido on.
- La función vecina `0x223c` (nivel A, len 132) es de la misma familia (más `out 0x61`).

**Clasificación:** SFX del PC-speaker (usado por la anim del cetro en `avatar_render_update`
§7 del lote 1, moongate, etc.). Insumo directo de task #3 (fidelidad sensorial). El
`[0x5350]` de las primitivas de dibujo es aparte (driver de vídeo, lote 1 §1).

### `0x1b38` → `poll_key_blink_cursor` (getch con cursor parpadeante)  `[0x1b38, 0x1b94)`
- salva `[0x538e]`, lo pone 0; dibuja el glifo del cursor en su fase de parpadeo
  (`[0x5390]+[0x540c]`, `0x16ba`), `inc [0x540c]`; envuelve el contador en `[0x5392]`
  (periodo de blink).
- poll de tecla con `0x1d5e` → `[bp-4]`. Si hubo tecla: borra el cursor con espacio
  (`0x16ba(0x20)`); si no: `0x20fa(1)` (idle). Devuelve la tecla.
Es la bomba de teclado de bajo nivel bajo `getkey_with_redraw` (`0x266c`, lote 1).

### `0x2032` → `to_upper`  `[0x2032, 0x2056)`
`[bp+4]∈'a'..'z' → -0x20`, si no devuelve igual. Trivial; usado por el parser de argv de
`main`.

### `0x0878` → `set_video_mode`  `[0x0878, 0x0892)`
Si `[0x5304]!=-1` → `int 0x10 AH=0 AL=[0x5304]` (set modo BIOS). Confirma `seg2.md`
(far in-degree 3: DUNGEON/MAINOUT/TOWN). `[0x5304]` = modo de vídeo guardado.

### `0x1eac` → `dos_select_drive`  `[0x1eac, 0x1f12)`  **⚠ corrige el parentético del lote 1 §6**
- `[0x535c]=0`; `0x1ef7` normaliza la letra de unidad ([bp+4]); `[0x541e]=dl` (nº de
  unidad); `int 21h AH=0E` (select disk) + `int 21h AH=19` (get disk) y **verifica** que
  la unidad seleccionada coincide.
- en error: `[0x535c]=1` y **`lcall [0x5394]`** (el hook far mutable → por defecto el
  prompt de cambio-de-disco `0x1232`). Devuelve 1 (ok) / 0 (fallo).
Es I/O de disco (parte del cargador de overlays), **no** un update de tile.

---

## 6. `0x6bc2` — `render_animated_tile` (frame aleatorio + shuffle)  `[0x6bc2, 0x6d82)`  **⚠ RNG en render #2**

Renderiza un tile/criatura con múltiples frames de animación. `[bp+4]`=tile,
`[bp+6]`=flags.
- `6bca-6be3`: si tile `>=0x100` normaliza (`-0x100`, flag `[bp-6]=0`).
- `6be8-6bef`: si `!([bp+6]&4)` → `call 0x6936` (`party_anim_build`, que ya consume RNG
  por el flash de status — lote 1 §2).
- `6bf1-6c48`: llena un array local de 16 (0..0xf) y, **si `[bp+6]&4`**, lo **baraja
  Fisher-Yates** con `0x2092 = rand_range(0,0xf)` (swap `[si]↔[rand]`, 16 iter).
- `6c56-6cce`: imprime etiqueta (`0x1850`), calcula el nº de frames del tile desde la
  tabla `[tile<<3 + 0x13c2]` (`[bp-4]`). **Si el nº de frames ∉ {1,8,0x10}**:
  `[bp-4] = rand_range(1, frames)` (`0x2092`); y **si `[0x5959]!=0` vuelve a rolar**
  `rand_range(1, frames)` (segunda tirada). Tras `0x5910` (tick) clampa a 0x1a.
- `6ccf-…`: coloca el sprite (`0x6506`=`kernel_spawn_actor`) con las tablas de frame
  `[idx+0x1704]`/`[idx+0x1714]` (las que rellena `load_gfx_record` `0x60ec`, §7) y
  dibuja los frames en bucle (`0x3aae`).

**Mecánica no catalogada:** cada tile animado que se pinta consume **1-2 `rand_range`**
del stream del juego (frame de arranque + posible doble tirada por `[0x5959]`), más
hasta 16 `rand_range(0,0xf)` del shuffle. Es un **segundo consumidor de RNG en la ruta
de render** (el primero, `0x6936`, era condicional a status; éste dispara por **cada
tile animado del viewport**, mucho más frecuente). → fila en `deliberate-divergences.md`.

---

## 7. Helpers de render y tablas de sprite

### `0x60ec` → `load_gfx_record` (carga registro gráfico + desempaqueta frames)  `[0x60ec, 0x6150)`
- `push 0xa3f0, 0xad14, 0x160, (0x160*[bp+4])`; `call 0x256e` (`kernel_load_dat_record`)
  → carga un registro de `0x160`(=352) B en el buffer `0xad14`.
- desempaqueta con `repne movsw` a las **tablas de frame de sprite**: 3 words
  `[0xad7f]→[0x1724]`, 3 `[0xad85]→[0x172c]`, 8 `[0xaddf]→[0x1704]`, 8 `[0xadff]→[0x1714]`.
Éstas son exactamente las tablas `0x1704/0x1714/0x1724/0x172c` que lee
`render_animated_tile` (§6). Sin RNG.

### `0x6360` → `refresh_view_and_light` (wrapper de refresco)  `[0x6360, 0x637e)`
`0x60ec(0)` (recarga gfx) + `0x5f86(4,[bp+6],[bp+4])` (setup vista) + **`0x5e4a`**
(`emitter_collect_and_flood`, lote 1 §1). Es el refresco compacto de viewport+luz
(hermano del tail de `avatar_render_update`).

### `0x6ff0` → `terrain_dither_lookup` (fold espacial a tabla estática)  `[0x6ff0, 0x703f)`  ret 4
La `0x6ff0(x,y)` que `paint_world_layer_A` usa (lote 1 §5). Args `(y=[bp+4], x=[bp+6])`.
Si `x|y >= 0xb` → 0. Pliega cada coord a un cuadrante (espejo en 5: `>5 → 0xa-v`) e
indexa **`DS:[x + y*6 + 0x6aa8]`** (tabla estática contigua a la de emisores `0x6a9a`).
**Confirma: dithering espacial determinista, NO RNG.**

### `0x7040` → `stamp_shape_mask` (estampa patrón de 16 celdas en un buffer)  `[0x7040, 0x70a6)`  ret 8
`(base_hi=[bp+4], buf=[bp+6], set=[bp+8], shape=[bp+0xa])`. `idiv 0x10` → `shape%16`
indexa la **tabla de formas `DS:0x1f7e`** (stride 0x20 = 16 pares `(dx,dy)`). Bucle de
16: `cell = (dy+[bp+4])*32 + dx`; escribe el byte de relleno (`0` normal / `0xff` si
`[bp+8]==1`) en `[cell + buf - 0x52ec]`. Con `buf=0` la base `-0x52ec` = **`0xad14`**
(el buffer de luz). Es el **estampador de una silueta de 16 celdas** en la rejilla de
luz/efecto (ind=9; usado por el trazador de luz `0x70a6+`). Sin RNG.

---

## 8. `0x51b8` — `tile_interact` (dispatcher de interacción por tipo de tile)  `[0x51b8, 0x5394)` — parcial

Dispatcher grande sobre `[bp+4]`=tipo de tile con coords `[bp+6..0xc]`:
- clasifica rangos (`0x1c`, `0x12-0x16`, `0x28-0x40`, `0x2c`…) → ramas `0x5370`/`0x51e9`.
- `0x4402` (tile-fetch) lee el tile en `([bp+6],[bp+8])`; casos: `0xec`/`0xa` → salida;
  `0x57` → **transforma la celda visible a `0x38`** (`[si<<5 + [bp+0xc] - 0x54fe]`);
  `0x6a`/`0x6b` (terreno especial) → chequea nibble alto (`0x80` / `0x28`).
Escribe estado en el buffer visible (transforma tiles), luego despacha efecto por tipo.
Es el **manejador de "qué pasa al pisar/interactuar con un tile"** (bloqueo/transformación
/efecto de terreno). **Derivación parcial**: la cabeza del switch y las transformaciones
están claras; el cuerpo largo de las ramas `0x538d+`/`0x5370` queda para una relectura
dedicada. Sin RNG observado en la cabeza. Marcado C con esta salvedad.

---

## 9. `0x5a28` — flood-fill de LOS/luz (ya derivado en E1-S2)

`[0x5a28, 0x5d0a)`, 7 args `(buf, stride, x, y, x, y, radio)`, pila local de 0x218 B
(cola de celdas). **NO re-derivado aquí** por mandato: su semántica gruesa quedó en
E1-S2 (PASS) y `emitter_collect_and_flood` (lote 1 §1) lo invoca como flood radio-10 por
emisor. Ver `.superpowers/sdd/port-e1s12-review.md`. Subo a **C** referenciando ese
review; su lectura interna byte-a-byte (algoritmo exacto de propagación) sigue pendiente
de un lote dedicado.
