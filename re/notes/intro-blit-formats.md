# intro-blit-formats.md — resolución del blit/unpack de `.16`/`.BIT`/`.PCS`

Scout de resolución (carril S13c). Fecha 2026-07-15. Cierra el "far fantasma" que
`intro.md §3` dejó abierto (`call 0xffff8e84`, `0x8b8c`…, "no desensamblado > 0x8200")
y **deriva byte a byte los tres formatos** de imagen/fuente de la intro. Complementa
`intro.md`, `drivers-drv.md` (los `.DRV`) y `seg2_resolve.py` (task #15).

Herramienta nueva: `re/tools/intro_blit_resolve.py` (+ `test_intro_blit_resolve.py`).

---

## 0. TL;DR

1. **NO hay rutina de blit oculta.** Los `call 0xffffXXXX` de INTRO (`0x8e84`, `0x8b8c`,
   `0x8d86`, `0x8dae`…) son la **misma clase** que resolvió `seg2_resolve.py` (#15):
   near-calls al kernel que capstone muestra sin la base de carga. Sumando la base de
   INTRO y envolviendo mod 64K, **los 17 caen EXACTOS en entradas de funciones kernel ya
   censadas** (gfx-wrappers de selector de vídeo). Hipótesis 1 del scout = ganadora.
2. **La base de INTRO.OVL es `0x81C0`, NO `0x81D0`.** El `overlay_table` da `load_seg=0x81D`
   para INTRO (igual que TOWN/MAINOUT/DUNGEON), pero **INTRO carga un párrafo más abajo**:
   con `0x81D0` los 17 targets caen a `+0x10` (media función); con `0x81C0` caen en la
   entrada exacta. Es un **bug latente de `seg2_resolve.py`** para INTRO (§4).
3. **El blit real lo hace el `.DRV`.** Cada target es un wrapper kernel de 1 selector de
   vídeo (`gfx_blit_sel4e`=SEL 0x4e, `gfx_blit_sel66`=SEL 0x66, …) que hace
   `mov [g_snd_driver_fn], SEL; lcall [g_snd_driver_fn]` → la primitiva de píxel del
   driver (`drivers-drv.md §1`). El chrome de color sigue Clase C (paleta EGA + ink).
4. **Los tres formatos comparten el MISMO contenedor LZW** (`uint32 LE longitud + stream`,
   el `u6decode` de `lzw.ts`); difieren solo en el payload descomprimido (§2/§3).
   - `.16` → tabla `u32` + sub-imágenes **4bpp con FILAS ALINEADAS A 4 B** (`stride =
     ceil(w/8)·4`). ⚠️ **`pic16.ts` lee las filas CONTIGUAS (sin padding) → sólo acierta
     cuando `w%8==0`; con anchos no-múltiplos-de-8 desincroniza cada fila = "ruido"**. §3.1.
   - `.BIT` → tabla `u16` + sub-imágenes **1bpp máscara** (ya en `bit.ts`; **confirmado byte a byte**).
   - `.PCS` → tabla `u16` + glifos de **fuente proporcional 1bpp** (**NUEVO, sin parser aún**; §3.3).
5. **NO hay sub-formato RLE ni rama grande/pequeña.** La "variante de sprites pequeños"
   de CREATE.16 (img2-9 = ruido) es **el mismo 4bpp con el stride padded**: las imágenes
   que "casaban" (img0/1/6/10) son justo las de ancho múltiplo de 8. Verificado en 22
   sub-imágenes (CREATE/ULTIMA/STORY1/STARTSC): `span == ceil(w/8)·4 · h` SIEMPRE. §3.1.
6. **El blit `.BIT` (SEL 0x4e) pinta la máscara en BLANCO sólido (índice 15)**, transparente
   donde el bit es 0 — sin argumento de color, sin marmolado (EGA.DRV 0x190e). El render
   blanco del port ES fiel para la máscara; el "azul-cuadriculado" del vídeo es el FONDO
   detrás/alrededor o un asset de color aparte (ruta SEL 0x66, 4bpp). §3.2b.

---

## 1. Resolución del "far fantasma" de INTRO (dónde vive la rutina real)

`intro.md §3` describía el título así: "Blitea TITLE.BIT + BRITISH.BIT (0x8e84/0x8bb2/
0x8dae flip)". Esos `0x8eXX/0x8bXX` **están por encima del fin de la imagen de
ULTIMA.EXE (0x86F0)**, así que parecían apuntar a la nada — de ahí "no desensamblado".

Modelo real (idéntico a `seg2_resolve.py`): todo el código vive en un CS único de 64K =
base de carga; el destino real de un near-call en el file-offset `i` del overlay es
`real = (i + 3 + rel + base) & 0xFFFF`. Para INTRO **`base = 0x81C0`** (§4). Resueltos:

| call en INTRO (base-0 capstone) | real (0x81C0) | función kernel (ledger, ENTRY) | rol |
|---|---|---|---|
| `0x88b0` | `0x0a70` | `gfx_set_color` | fija la tinta actual (SEL 0x2d) |
| `0x88e6` | `0x0aa6` | `gfx_fill_rect` | relleno (SEL 0x3f) |
| `0x890e` | `0x0ace` | `gfx_line_styled` | línea (SEL varios) |
| `0x8950` | `0x0b10` | `gfx_draw_line` | línea |
| `0x8aa4` | `0x0c64` | `gfx_moveto` | posiciona cursor gráfico |
| `0x8b8c` | `0x0d4c` | `gfx_cmd_sel4b` | blit/copia (SEL 0x4b) |
| `0x8bb2` | `0x0d72` | `draw_centered_7rows` | fila de tiles de caja centrada |
| `0x8d86` | `0x0f46` | **`gfx_blit_sel66`** | **blit de imagen grande (SEL 0x66)** |
| `0x8dae` | `0x0f6e` | `gfx_cmd_sel1b` | SEL 0x1b |
| `0x8dee` | `0x0fae` | `resource_lookup_0fae` | localiza recurso/asset |
| `0x8e1c` | `0x0fdc` | `dos_free_seg_2` | libera segmento |
| `0x8e6e` | `0x102e` | `gfx_cmd_sel5a` | SEL 0x5a |
| `0x8e84` | `0x1044` | **`gfx_blit_sel4e`** | **blit de sub-imagen (SEL 0x4e)** |
| `0xa3ae` | `0x256e` | `kernel_load_dat_record` | **carga+descomprime el fichero** |
| `0xfb26` | `0x7ce6` | `kernel_overlay_stubs+0x2d0` | thunk far → renderer proporcional de FONT |

Verificación de que son entradas reales (prólogo `55 push bp`), no medias funciones:
```
0d4c: 55  push bp   ; gfx_cmd_sel4b   (ledger start=0x0d4c)
0d72: 55  push bp   ; draw_centered_7rows
256e: 55  push bp   ; kernel_load_dat_record
0878: 55  push bp   ; set_video_mode  (ledger start=0x0878; con 0x81D0 caería en 0x0888)
```

**El blit es un wrapper de 3 líneas.** `gfx_blit_sel66` (0x0f46; el desensamblado lineal
lo desincroniza en `0x0f45`, ver abajo):
```
0f46: 55 8b ec 56 57 1e   push bp; mov bp,sp; push si; push di; push ds
0f4c: 8b460a  mov ax,[bp+0xa]        ; 4 args del blit (x/y/w/h/subidx/ptr)
0f4f: 8b5e08  mov bx,[bp+8]
0f52: 8b4e06  mov cx,[bp+6]
0f55: 8b5604  mov dx,[bp+4]
0f58: e88bf9  call 0x8e6              ; marshalling a los globals de arg del driver
0f5b: f8      clc
0f5c: c706 5053 6600  mov word [g_snd_driver_fn], 0x66   ; SEL 0x66
0f62: ff1e 5053        lcall [g_snd_driver_fn]           ; → EGA/CGA/HER/T1K.DRV
```
El trabajo de píxel (desempaquetado planar, escritura a A000/B800/B000) está en el
`.DRV` correspondiente, **ya derivado en `drivers-drv.md §1-3`** (SEL 0x66 = "blit de
imagen bloque grande"; SEL 0x4e = "blit"; SEL 0x27 = barra flash; etc.). No hay
decodificación de formato en el driver: recibe un puntero a píxeles ya desempaquetados.

> Nota de desincronía del disasm lineal: en `ULTIMA.EXE.asm` la entrada `0x0f46` cae
> dentro de una instrucción mal alineada (`0f45: 00 55 8b add [di-0x75],dl`). El cuerpo
> real empieza en `0x0f46` con `55 8b ec …`. `gfx_blit_sel4e` (0x1044) igual. Son
> entradas alcanzadas SOLO por far/near-call, invisibles al barrido lineal — pero
> **censadas en el ledger** (los `start` 0x0f46/0x1044 existen).

---

## 2. El contenedor común: LZW (`uint32 LE` + stream)

Los `.16`, `.BIT` y `.PCS` son **el mismo contenedor comprimido**:
`[uint32 LE longitud_descomprimida][stream LZW de ancho variable 9→12 bits]`.
Es el LZW de Ultima V/VI (`extractor/src/parsers/lzw.ts`, port de `u6decode.cc`).

**El descompresor vive en el kernel de ULTIMA.EXE** (lo llama `kernel_load_dat_record`
0x256e al cargar el asset). Citado por sus constantes:
```
136c: c706 cc53 0201  mov word [0x53cc], 0x102   ; nextFreeCodeword inicial
1372: c706 d053 0002  mov word [0x53d0], 0x200   ; dictionarySize inicial
13fe: 3d 0101          cmp ax, 0x101              ; 0x101 = fin de stream
1411: 3d 0001          cmp ax, 0x100              ; 0x100 = reset de diccionario
141f: c706 d053 0002  mov word [0x53d0], 0x200   ; reset dictSize tras 0x100
```
Coincide 1:1 con `lzw.ts` (nextFree=0x102, dictSize=0x200, 0x100=reset, 0x101=fin, ancho
9→12). Verificado sobre los ficheros reales: TITLE.BIT 3323→5364, BRITISH.BIT 784→2116,
PROPORT.PCS 802→1276, ULTIMA.16 16039→38170 — todos con `outPos == expected`.

---

## 3. Los tres formatos (payload tras LZW)

### 3.1 `.16` — sub-imágenes 4bpp con FILAS alineadas a 4 B (offsets `u32`) — CORRIGE `pic16.ts`
```
[u16 count][count × u32 offset]
por sub-imagen: [u16 width][u16 height][píxeles 4bpp, 2 px/byte, nibble ALTO = px
                izquierdo, índice EGA 0..15;  CADA FILA ocupa stride = ceil(w/8)·4 B
                (= ancho redondeado ARRIBA a múltiplo de 8 px); los px de padding
                (x >= w) se DESCARTAN]
```
**El hallazgo clave del carril.** `pic16.ts` (`unpackImage`) lee `w·h` nibbles
**contiguos**, sin stride de fila. Eso sólo coincide con el fichero cuando `w` es
múltiplo de 8 (fila entera de bytes sin padding); con cualquier otro ancho cada fila
se desfasa por los `ceil(w/8)·8 − w` px de relleno → la imagen sale como "ruido".

Verificación exacta (`span == ceil(w/8)·4 · h` en **22/22** sub-imágenes de 4 ficheros):

| fichero | sub-imágenes con `w%8≠0` (rompen `pic16.ts`) | veredicto stride |
|---|---|---|
| CREATE.16 | img2 51×67, img3 43×67, img4 34×69, img5 55×58, img7 42×64, img8 50×65, img9 42×65 | 11/11 OK |
| ULTIMA.16 | **img0 319×61** (logo) | 5/5 OK |
| STORY1.16 | img2 45×34 | 3/3 OK |
| STARTSC.16 | — (todas w%8==0) | 3/3 OK |

img2 de CREATE.16 (símbolo de virtud) decodificado con `stride=28 B` renderiza limpio
(caras/sombreado con índices 1/2/4/5), no ruido. **NO hay RLE ni rama por tamaño**: es
4bpp uniforme; lo único que faltaba era el padding de fila. `decompressLzw` es correcto.

Corrección mínima de `unpackImage` en `pic16.ts` (row-stride):
```ts
const rowBytes = Math.ceil(width / 8) * 4;      // fila alineada a 4 B (8 px)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const byte = d[off + 4 + y * rowBytes + (x >> 1)]!;
    pixels[y * width + x] = (x & 1) ? (byte & 0x0f) : (byte >> 4) & 0x0f;
  }
}
```
Reconfirmado el resto: count=5 en ULTIMA.16, header=2+5·4=0x16 = 1er offset,
offsets `0x16/0x263a/0x41ce/0x5d62/0x78f6`.

### 3.1b Rutina .16 en el asm (cita)
La `.16` se blitea por escena vía `gfx_cmd_sel4b` (`0x8b8c`→kernel `0x0d4c`, SEL 0x4b →
EGA.DRV `0x12b4`) para las láminas de "The Summoning", y por `gfx_blit_sel66` (`0x8d86`→
`0x0f46`, SEL 0x66 = "blit de imagen grande") para las pantallas completas. El
secuenciador `play_introduction` (INTRO `0x01c7-0x0253`) llama `0x8b8c` con **firma
`(flags, Y, X, subImg, buffer)`** (5 args cdecl; corrige una versión previa de esta nota
que decía "x,y,tile/w,h"). Leído del handler EGA.DRV `0x12b4` (`intro-scene-tables.md`,
8635e81): **Y** indexa la tabla de scanlines (`cs:[Y*2 + 0x72]`, recibe `+height`) y **X
se divide entre 8** (columna de byte). Los args salen de las tablas de escena de DATA.OVL:
`Y=[bx+0x30da]`, `X=[bx+0x30c4]`, `subImg=[bx+0x3098]`, `flags=0` (p.ej. `0x0217`).
El desempaquetado 4bpp+stride lo hace el driver al leer el buffer (no hay un "unpack"
software separado en el kernel: `kernel_load_dat_record 0x256e` sólo carga+LZW-descomprime;
el stride es propiedad del FICHERO ya descomprimido, verificado arriba).

### 3.2 `.BIT` — sub-imágenes 1bpp máscara (offsets `u16`) — CONFIRMA `bit.ts` byte a byte
```
[u16 count][count × u16 offset]        (offset u16, NO u32 como .16)
por sub-imagen: [u16 width][u16 height][máscara 1bpp, ceil(w/8) B/fila,
                MSB = píxel izquierdo]  (1 = píxel de la forma)
```
Verificación exacta (`span == ceil(w/8)·h + 4` para **todas**):

| fichero | count | sub-imágenes (w×h) | veredicto |
|---|---:|---|---|
| TITLE.BIT | 10 | 24×3, 40×7, 72×11, 112×20, 152×32, 216×45, **280×61**, 104×33, 16×15, 112×33 | 10/10 span OK |
| BRITISH.BIT | 1 | 272×62 | 1/1 span OK (2116 = 4+4+2108) |

TITLE.BIT = el logo gótico "Ultima V" a **tamaños crecientes** (animación de zoom/build
del título); BRITISH.BIT = el wordmark/banner de 272×62. `extractor/src/parsers/bit.ts`
(commit 2e35951) coincide **exactamente** con esta derivación; el scout corrige su
comentario "0x8e84 no desensamblado > 0x8200" → es `gfx_blit_sel4e` (SEL 0x4e), §1.

### 3.2b El COLOR de la máscara `.BIT`: BLANCO sólido (no marmolado) — DERIVADO del driver
`gfx_blit_sel4e` (kernel `0x1044`) pasa `(x, y, subIdx, buf)` **sin color** (`ret 8`) y
emite SEL 0x4e → **EGA.DRV `0x190e-0x19d0`**. El cuerpo expande cada byte de máscara 1bpp
y, donde el bit está a 1, escribe **1 en los CUATRO planos EGA** (los offsets `es:[di]`,
`+0x1f40`, `+0x3e80`, `+0x5dc0` = los 4 planos del buffer offscreen, 0x1f40=8000 B/plano,
stride 0x28=40 B/fila):
```
195a: lodsb                         ; al = 8 px de máscara
1961: shr ax,cl                     ; alinea a x (cl = dl = sub-px)
1967: not ah; and es:[di+plano],ah  ; (×4 planos) limpia los px de la forma
197b: not ah; or  es:[di+plano],ah  ; (×4 planos) los pone a 1  ⇒ los 4 bits = índice 15
198f: inc di … 19bc: dec fila … 19ca: add di,0x28
```
Poner el bit en los 4 planos ⇒ **índice EGA 15 = BLANCO**; donde la máscara es 0, el
destino **no se toca** (transparente). **No hay argumento de color, ni LUT, ni patrón/
dither/marmolado.** ⇒ El render **blanco** del port para TITLE.BIT/BRITISH.BIT es **FIEL**.
El "azul-cuadriculado" que se ve en el vídeo E1 **no es el color de la máscara**: es el
**fondo** (el `gfx_fill_rect 0x88e6` que INTRO pinta detrás, `0x0b5d-0b6c`) o un asset de
color aparte por la ruta SEL 0x66 (imágenes 4bpp completas). Esto **saca de Clase C** el
color de la máscara en sí (es blanco fijo); lo que sigue Clase C es qué hay DETRÁS.

### 3.3 `.PCS` — fuente PROPORCIONAL 1bpp (offsets `u16`) — NUEVO (sin parser aún)
```
[u16 count][count × u16 offset]
por glifo (registro FIJO de 12 B): [u16 width][u16 height=8][8 × byte de fila,
                1bpp, MSB = píxel izquierdo]
```
- **PROPORT.PCS**: count=**91**, header=2+91·2=**0xB8** = 1er offset. Los 91 registros
  miden **12 B exactos** (deltas de offset todos = 12) → `4 (w,h) + 8 filas`.
- **height = 8 en los 91 glifos**; **width ∈ 0..8** (el byte proporcional; el renderer
  avanza `width` px, no 8). "Proporcional" = ancho variable, alto fijo.
- **Mapa de carácter**: glifo índice `i` → ASCII **`0x20 + i`**, `i=0..90` → **` ` (0x20)
  .. `z` (0x7a)**. Glifo 0 = espacio (w=0, filas a 0). Verificado renderizando: idx
  0x36→'V' (w=6), idx 0x21→'A', idx 0x20→'@' — bitmaps correctos.
- Ejemplo (glifo 'V', idx 54, w=6): filas `##..## ##..## ##..## ##..## ##..## .####. ..##.. ......`.

El renderer proporcional NO está en INTRO: `play_introduction` (0x14e) y el menú llaman
al thunk far **`0xfb26` → `kernel_overlay_stubs+0x2d0`** (FONT.OVL), que interpreta este
formato y justifica el texto. `story.ts` ya documenta `_` (0x5F) = guion discrecional del
justificador proporcional — consistente. **Insumo para task #34**: falta el decoder
`.PCS` en el extractor (un `proport.ts` análogo a `bit.ts`, con el mapa `char = 0x20+idx`).

---

## 4. El bug latente de `seg2_resolve.py`: INTRO carga en `0x81C0`, no `0x81D0`

`overlay_table` da `load_seg=0x81D` a INTRO.OVL (grupo TOWN/MAINOUT/DUNGEON). Pero la
resolución empírica de entrada-exacta dice:

| overlay | calls en ventana fantasma | ENTRY @0x81D0 | ENTRY @0x81C0 |
|---|---:|---:|---:|
| TOWN.OVL | 2 | **2** | 0 |
| MAINOUT.OVL | 1 | **1** | 0 |
| DUNGEON.OVL | 1 | **1** | 0 |
| **INTRO.OVL** | 2 | 0 | **2** |

TOWN/MAINOUT/DUNGEON resuelven en `0x81D0` (correcto); **INTRO solo en `0x81C0`** — un
párrafo (16 B) más abajo. Evidencia dura: los 2 targets de INTRO en la ventana de seg2
son `set_video_mode` (`start=0x0878`) y `gfx_clip_cluster` (`start=0x0892`); con `0x81D0`
caen en `0x0888`/`0x08a2` (media función; `08a2: or ax,ax`), con `0x81C0` en las entradas
exactas. El propio `emit_markdown` de seg2 ya escribía a mano "`0x0878` = SET VIDEO MODE"
mientras su tabla generada decía `0x0888` — la contradicción delataba el bug.

`invariant_ok()` de seg2 no lo cazó porque solo comprueba `kind=='code'` y rango, **no la
alineación a entrada**. Recomendación (para el mantenedor de `dispatch_table`, deliberada,
no la aplica el scout): **`INTRO.OVL.load_seg = 0x81C`** (no `0x81D`), y opcionalmente
subir `PHANTOM_HI` de `0x86F0` a `0x8F00` para censar los blits de título de INTRO
(`0x8b8c..0x8e84`), que hoy quedan fuera de la ventana. El tool nuevo
`intro_blit_resolve.py` hace esa resolución con la base correcta sin tocar el shared.

---

## 5. Acciones para task #34 + qué queda Clase C

**Fixes derivados (accionables, no los aplica el scout):**
- **`pic16.ts` — row stride** (`ceil(w/8)·4 B/fila`, descartar px `x>=w`): sin esto, toda
  sub-imagen de ancho no-múltiplo-de-8 sale como ruido (CREATE img2-9, ULTIMA.16 logo,
  STORY1 img2). Snippet en §3.1. **Es EL bug de los "sprites pequeños".**
- **Decoder `.PCS`**: implementar `proport.ts` (§3.3): 91 glifos, registro 12 B
  `[u16 w][u16 h=8][8 filas]`, `char = 0x20 + idx`, avance proporcional = `width`.
- **`.BIT` en blanco**: confirmado FIEL; el port ya acierta. No cambiar a "marmolado".

**Sigue Clase C (necesita witness DOSBox / píxel-diff):**
- **Fondo detrás del logo** (el azul-cuadriculado): color del `gfx_fill_rect` de INTRO
  (índice runtime) + posibles assets 4bpp de la portada por SEL 0x66. El color de la
  MÁSCARA ya NO es Clase C (es blanco fijo, §3.2b).
- **Cadencia** del zoom del título (ticks por sub-imagen de TITLE.BIT) = 🎥 catálogo AV.
- **`INTRO.OVL.load_seg`**: recomendado `0x81C` en `dispatch_table` (§4); decisión del
  mantenedor (afecta a `seg2_resolve`).

## Apéndice — reproducción
```
cd re/tools && python3 intro_blit_resolve.py           # resuelve los 17 calls @0x81C0
python3 -m pytest test_intro_blit_resolve.py -q        # test determinista
# formatos (requiere original/u5/ultima5/, gitignored):
python3 - <<'PY'
from lzw_min import decompress_lzw   # o el de extractor
import struct
for fn in ('TITLE.BIT','BRITISH.BIT','PROPORT.PCS'):
    d=open(f'../../original/u5/ultima5/{fn}','rb').read()
    out,exp=decompress_lzw(d); u16=lambda o:out[o]|(out[o+1]<<8)
    print(fn, 'count=', u16(0), 'header_end=', 2+u16(0)*(2))
PY
```
