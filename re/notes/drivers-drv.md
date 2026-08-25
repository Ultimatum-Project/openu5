# Drivers de vídeo `.DRV` — BARRIDO lote 6, EL FINAL (task #16)

> Lectura de los 4 drivers de vídeo cargables de Ultima V (`EGA/CGA/HER/T1K.DRV`,
> `original/u5/ultima5/`). Con este lote el mandato #16 ("nada de los binarios sin
> leer") queda **COMPLETO**. Disasm generado por `re/tools/drv_disasm.py` →
> `re/disasm/{EGA,CGA,HER,T1K}.DRV.asm`. Offsets `0xNNNN` = offset de imagen del
> `.DRV` (base 0, es un binario plano sin cabecera MZ, cargado en un párrafo propio).
> `cs:[0xNNNN]` = variable interna del driver (mismo segmento que su código).
> Convención §0 de reconciliación de nombres respetada: el ledger no cataloga los
> `.DRV` (no están en las 629 funciones; son código fuera de `ULTIMA.EXE`), así que
> no hay nombre previo que contrastar — se nombra por conducta derivada del asm.

## 0. TL;DR — hallazgos que cambian el mapa

1. **ABI uniforme de 38 selectores.** Los 4 drivers son intercambiables: cada uno
   abre con una **jump-table idéntica de 38 entradas `E9 rel16`** (114 bytes). El
   kernel despacha por `lcall [0x5350]` fijando el offset = **selector = 3·índice**
   (`command-dispatch.md §4`). Misma tabla, cuerpos distintos por hardware. El
   kernel emite **24 selectores distintos** (todos ∈ {0x03..0x6f}, múltiplos de 3);
   los 14 restantes son stubs `retf` o entradas de otra plataforma. Ver §1.

2. **EL PREMIO (chrome EGA), resuelto A MEDIAS — mecanismo derivado, valores no.**
   `set_color` (selector **0x2d**, fn15) de EGA.DRV es **trivial**: `mov cs:[0x312], al;
   retf` — guarda el índice de color crudo (el kernel ya lo enmascaró a `&0xf` en
   `0x0a70`) en una variable interna. **NO hay LUT índice→color dentro del driver.**
   Al plotear (fn16+), ese byte se escribe **directo como valor de plano EGA** vía el
   Sequencer Map-Mask (`out 0x3c4,2; out 0x3c5, color`) — el índice ES el valor de
   4 bits del plano (0..15). El paso índice-de-plano→RGB es la **paleta del Attribute
   Controller**, que NO programa el driver por puerto (`0x3c0` no aparece): la carga
   el **BIOS** en el mode-set (`int 10h AH=10h AL=2`) desde una **tabla de 17 bytes que
   le pasa el KERNEL** (`ES:DX = DS:[bx+0x24]`, §2). ⇒ Los índices `13b0/13b2/13b8/13ba`
   son **índices EGA estándar 0..15** (sin remapeo de driver); su RGB literal depende
   de (a) el valor runtime que el kernel escribe en esos globals y (b) esa tabla de
   paleta de 17 bytes — **ambos kernel-side, no en el `.DRV`**. **Siguen Clase C** hasta
   dumpear la tabla del kernel o un witness DOSBox. El driver descarta la hipótesis
   "LUT oculto de color en el `.DRV`". Ver §2.

3. **Chequeo simétrico del censo (item 2 del lote): SIN HUÉRFANOS.** Los 24 selectores
   de vídeo que el kernel emite caen **todos** en cuerpos reales del driver (ninguno en
   el stub `0x0860 retf`). Los far-vectors de `seg2.md` (18 filas) ya estaban
   verificados cayendo en kernel-root censado. El dispatcher de comandos `0x3178` y la
   JCTUAR de INTRO son intra-kernel/intra-INTRO (ya 100% C). **Todo target invocado
   tiene cuerpo censado.** Ver §4.

4. **Cero mecánica de gameplay.** Los `.DRV` son primitivas de píxel por hardware
   (set-mode, set-color, línea, fill, blit de tile 16×16, blit de imagen, texto).
   **Ningún consumo de `g_rng`, ningún estado de mundo.** La piel fiel no los
   reproduce (compone en buffer de tile-ids, `ui-render-map §11.1`). Su único valor
   es cadencia/paleta exactas → 🎥 catálogo AV (task #4). Confirma el pre-veredicto de
   `intro-ovl-map.md §1.2` ("bajo valor de RE").

---

## 1. Estructura común: la jump-table de 38 selectores

Cada `.DRV` abre con 38 × `E9 rel16` (JMP near). El selector es el offset de byte de
la entrada; como cada entrada mide 3 bytes, **selector = 3·índice_de_función**. El
kernel escribe el selector en `[0x5350]` (offset) y llama `lcall [0x5350]` con el
segmento del driver en `[0x5352]`.

**Selectores emitidos por el kernel** (`grep 'mov word [g_snd_driver_fn], IMM'` en
`ULTIMA.EXE.asm`, 24 distintos):
`0x03 0x06 0x0f 0x18 0x1b 0x27 0x2d 0x30 0x33 0x39 0x3c 0x3f 0x42 0x48 0x4b 0x4e
0x51 0x5a 0x5d 0x60 0x63 0x66 0x6c 0x6f`.

**Mapa de selectores** (derivado del wrapper del kernel que lo emite + cuerpo del
driver EGA):

| SEL | fn | operación |
|---:|---:|---|
| 0x00 | 0 | query de capacidades: `mov ax,0xc8; retf` (devuelve 200 = alto de pantalla) |
| 0x03 | 1 | **set video mode + paleta** (`int 10h`; EGA=modo 0Dh) — §2 |
| 0x06 | 2 | select/clear del buffer offscreen (A800 en EGA) |
| 0x0f | 5 | (emitido; helper de página/buffer) |
| 0x18 | 8 | blit/rect extendido (6 args) — kernel `0x0ad0` |
| 0x1b | 9 | (emitido) |
| 0x27 | 13 | barrido de barra (`fx_flash_border`) — kernel `0x71ca/0x7200` |
| **0x2d** | **15** | **set color** → `cs:[0x312]` (EGA: índice de plano crudo) — §2 |
| 0x30 | 16 | plot pixel / línea degenerada |
| 0x33 | 17 | línea diagonal |
| 0x39 | 19 | línea horizontal |
| 0x3c | 20 | línea vertical |
| 0x3f | 21 | **fill rect** |
| 0x42 | 22 | (emitido) |
| 0x48 | 24 | (emitido) |
| 0x4b | 25 | (emitido) |
| 0x4e | 26 | (emitido) |
| 0x51 | 27 | **blit de tile 16×16** (comprueba `si==0x10 && di==0x10`) |
| 0x5a | 30 | (emitido) |
| 0x5d | 31 | (emitido) |
| 0x60 | 32 | blit/copia extendida |
| 0x63 | 33 | (emitido) |
| 0x66 | 34 | blit de imagen (bloque grande) |
| 0x6c | 36 | copia desde buffer de segmento (`cs:[0x206]`) |
| 0x6f | 37 | (emitido) |

Selectores **NO emitidos** por este build (0x09,0x0c,0x12,0x15,0x1e,0x21,0x24,0x2a,
0x36,0x45,0x54,0x57,0x69) → entradas stub (`0x0860 retf` en EGA, 8 de ellas) o de
otra plataforma/modo. Ninguno es alcanzado ⇒ irrelevantes para paridad.

---

## 2. EGA.DRV — el mecanismo de color (item 1, EL PREMIO)

### 2.1 set_color (selector 0x2d, fn15 @0x0e66)
```
0e66: mov byte ptr cs:[0x312], al   ; guarda el índice de color (AL) — SIN traducir
0e6a: retf
```
El kernel (`0x0a70`, `command-dispatch/kernel-render-sweep §3`) ya enmascaró AL a
`&0xf` (16 colores) o `&0x3` (4 colores, según `g_unk_52c8`) y filtró `0xffff` =
transparente. El driver **solo lo almacena**. `cs:[0x312]` es la "tinta actual".

### 2.2 El plot usa el color como valor de plano directo (fn16 @0x0e6c, helper 0xeee)
La ruta de píxel a pantalla (`es = 0xA000`):
```
0f2f: mov ah, cs:[0x312]        ; ah = color
0f34: mov al, 2; out 0x3c4,al   ; Sequencer index 2 = Map Mask
0f3b: out 0x3c5, ah             ; habilita los planos = bits del color  ⇒ color = valor 4-bit
0f41: mov al, 0xff; mov es:[bx], al  ; escribe con el bit-mask (0x3ce idx 8) ya puesto
```
La ruta al buffer offscreen (`0xf49`, 4 planos empaquetados, stride 0x1f4) desglosa
el color bit a bit con las máscaras de plano `cs:[0x24e]` (1,2,4,8) — otra vez el
índice **usado como valor de 4 bits**. **No hay indirección de color en ningún caso.**

### 2.3 La paleta la carga el BIOS desde una tabla del kernel (fn1 @0x0868)
```
0871: mov ah,0; mov al,0xd; int 0x10   ; set mode 0Dh (EGA 320×200 16 colores)
0879: add dx, 0x24                      ; dx = bx + 0x24  (bx = arg del selector)
087e: mov al,2; mov ah,0x10; int 0x10   ; AH=10h AL=2: cargar los 16 registros de
                                        ; paleta + overscan desde ES:DX (17 bytes)
0884: mov ah,5; xor al,al; int 0x10     ; página activa 0
```
El driver **no toca el puerto 0x3c0** (Attribute Controller) directamente; delega en
el BIOS. La tabla de 17 bytes (16 paleta + overscan) vive en **`DS:[bx+0x24]` del lado
del kernel** — es quien decide el RGB de cada índice 0..15. Fuera del `.DRV`.

### 2.4 Veredicto para `13b0/13b2/13b8/13ba` (Clase C)
El driver prueba que esos globals contienen **índices EGA estándar 0..15** sin remapeo
de hardware oculto. Para el RGB literal falta, y NO está en el driver:
- el **valor runtime** escrito en cada global (kernel/UI, sin init estático —
  `ui-text-layer.md §197`), y
- la **tabla de paleta de 17 bytes** que el kernel pasa en el mode-set.

Recomendación: dumpear esa tabla (buscar el arg `bx` del `lcall [0x5350]` con
selector 0x03 en el boot `0x0878`/`detect_video_adapter 0xde0`) o capturar los 4
índices en DOSBox. **Sigue siendo insumo Clase C / catálogo AV**, pero el eslabón
"¿hay LUT en el driver?" queda **cerrado en NO**.

### 2.5 LA TABLA DE PALETA VOLCADA (remate lote 6) — mapeo índice→RGB RESUELTO

> ⚠️ **SUPERSEDED (idx6) — ver `re/notes/palette-idx6-verdict.md`.** La conclusión
> de esta sección de que **idx6 = `#AAAA00` oliva** (U5 "sin brown-fix") quedó
> REFUTADA por witness runtime: los frames REALES de DOSBox-X pintan **idx6 =
> `#AA5500` MARRÓN** (par-iolohut-original.png: 16160 px marrón, 0 oliva). La
> lectura y el decode de la tabla @0x52ee son correctos, pero su **escritura al
> ATC nunca se witnessó**: "tabla leída ≠ paleta aplicada" — el mode-set usa el
> default BIOS con brown-fix (o esa tabla tiene otro propósito). Los 15 índices
> restantes siguen válidos; **solo idx6 cambia a marrón** (task #25 revertido).
> El resto de la sección se conserva como registro de la derivación estática.

Seguido el `bx` del caller del mode-set en el kernel:
```
ULTIMA.EXE 0x08b8: mov bx, 0x52ba          ; bx = puntero al video-config struct (DS)
ULTIMA.EXE 0x08bb: mov word [0x5350], 3    ; selector 0x03 = set mode + paleta
ULTIMA.EXE 0x08c1: lcall [0x5350]
```
El driver lee la paleta en `DS:[bx+0x24]` = **`DS:0x52de`** = **fichero DATA.OVL
`0x52ee`** (`fileoff = DS_off + 0x10`, `dataovl-tables.md`). Son **17 bytes estáticos**
en la imagen de DATA.OVL (16 registros de paleta EGA de 6 bits + overscan):

```
DATA.OVL @0x52ee:  00 01 02 03 04 05 06 07 38 39 3a 3b 3c 3d 3e 3f  + overscan 00
```

**Decodificado a RGB de 24 bits** (EGA 6-bit `rgbRGB`, niveles {0,55,AA,FF}):

| idx | reg EGA | RGB | color |
|---:|:---:|:---:|---|
| 0 | 0x00 | `#000000` | negro |
| 1 | 0x01 | `#0000AA` | azul |
| 2 | 0x02 | `#00AA00` | verde |
| 3 | 0x03 | `#00AAAA` | cian |
| 4 | 0x04 | `#AA0000` | rojo |
| 5 | 0x05 | `#AA00AA` | magenta |
| **6** | **0x06** | **`#AAAA00`** ⚠️ | **REFUTADO por runtime → marrón `#AA5500`; ver banner §2.5** |
| 7 | 0x07 | `#AAAAAA` | gris claro |
| 8 | 0x38 | `#555555` | gris oscuro |
| 9 | 0x39 | `#5555FF` | azul claro |
| 10 | 0x3a | `#55FF55` | verde claro |
| 11 | 0x3b | `#55FFFF` | cian claro |
| 12 | 0x3c | `#FF5555` | rojo claro |
| 13 | 0x3d | `#FF55FF` | magenta claro |
| 14 | 0x3e | `#FFFF55` | amarillo |
| 15 | 0x3f | `#FFFFFF` | blanco |

**HALLAZGO (estático) — REFUTADO POR RUNTIME.** La derivación estática concluía que
U5 cargaba `reg 6 = 0x06 = #AAAA00` (oliva), SIN el brown-fix del default BIOS
(`reg 6 = 0x14 = #AA5500`, marrón). El witness runtime lo desmiente: el original en
DOSBox-X pinta **idx6 marrón `#AA5500`** (ver banner arriba y
`re/notes/palette-idx6-verdict.md`). La tabla @0x52ee se leyó/decodificó bien pero
su escritura al ATC nunca se witnessó. Los otros 15 índices sí son el IRGB estándar
exacto y siguen válidos con **certeza estática**; **solo idx6 = marrón, no oliva.**

**Alcance del cierre:** con esto el mapeo **índice→RGB** del chrome queda RESUELTO
estáticamente. Los índices runtime `13b0/13b2/13b8/13ba` (qué número 0..15 escribe el
kernel en cada global) **siguen Clase C** —falta un witness—, pero ya no hay incógnita
en el color de cada índice: cualquier witness futuro se traduce a RGB con esta tabla.
EGA y T1K comparten esta misma tabla (mismo caller del kernel `bx=0x52ba`); CGA (paleta
CGA de 4 colores fija) y HER (mono) no la usan. **Nota:** INTRO puede reprogramar la
paleta para fundidos (fuera de scope aquí); esta es la del juego principal en mode-set.

---

## 3. Estructura de los otros 3 drivers (clasificación, 1-2 líneas)

- **CGA.DRV** (8.135 B, 38 sel): `int 10h` **modo 4** (320×200 4 colores CGA) + `AH=0Bh`
  (select de paleta CGA: `BL=1/BH`). `set_color` (fn15 @0x07f8) es más elaborado que
  EGA: indexa una tabla interna en `cs:[0x24e]` (mapea el índice a patrón de 2 bits /
  máscara CGA). Plot = escritura empaquetada 2bpp en B800. Color de 2 bits (la paleta
  es fija por hardware CGA, no kernel-supplied).
- **HER.DRV** (9.087 B, 38 sel): **Hercules monocromo**, sin BIOS (Hercules no tiene
  modo BIOS): programa directo los registros del HGC (`out 0x3bf` config, `0x3b8`,
  `0x3b4/5` CRTC). `set_color` (fn15 @0x09e4) mapea el índice a un **patrón de dither**
  (tabla `cs:[0x318]`) — simula 16 tonos con tramas 1bpp. Blit a B000.
- **T1K.DRV** (7.733 B, 38 sel): **Tandy 1000**, `int 10h` **modo 9** (320×200 16 colores
  Tandy) + **misma carga de paleta que EGA** (`AH=10h AL=2`, tabla de 17 bytes en
  `DS:[bx+0x24]`). Es el gemelo de EGA con distinto modo/mapa de memoria (buffer Tandy).
  `set_color` fn15 @0x06c2 idéntico patrón (índice → variable interna). ⇒ **EGA y T1K
  comparten la misma tabla de paleta del kernel**; CGA y HER no (hardware fijo/mono).

---

## 4. Chequeo simétrico del censo (item 2) — SIN HUÉRFANOS

Recorrido de las jump-tables/dispatches conocidos; ¿todo target invocado cae en código
censado?

| dispatch | ¿cerrado? |
|---|---|
| **Driver de vídeo `[0x5350]`** (24 selectores emitidos) | ✅ los 24 caen en cuerpos reales de los 4 `.DRV` (ninguno en stub `retf`). Ahora disasm+censados. |
| **Far-vectors `seg2.md`** (18 filas) | ✅ ya verificado: todos caen en kernel-root `[0, 0x81D0)` censado. Invariante `seg2_resolve.py` = OK. |
| **Dispatcher de comandos `0x3178`** | ✅ intra-kernel; kernel 100% C (lotes 1-4). Jump-table `cs:[0x26fe]` de teclas-dígito resuelta (`seg2.md §47`). |
| **JCTUAR / tabla de escenas de INTRO** | ✅ intra-INTRO; task #13 dejó INTRO 100% (`intro.md`, `intro-ovl-map.md`). |
| **Vector far mutable `[0x5394]` (DS)** | ✅ handlers `0x2320/0x2322/0x25ca/0x251e/0x25d8` derivados (`kernel-render-sweep §6`). |

**Resultado: 0 huérfanos.** Todo lo que se invoca por tabla o vector tiene cuerpo en
código censado. El mandato #16 cubre el 100% del código alcanzable.

---

## 5. Herramienta

`re/tools/drv_disasm.py` — parsea la jump-table (`E9 rel16`, punto fijo hasta el
destino más bajo), desensambla lineal con capstone `CS_MODE_16`, resincroniza con
`(bad)` (1 byte) como `disasm.py`, y marca cada entry-point con `; === SEL 0xNN -> fnN`.
`python3 drv_disasm.py --all` regenera los 4 `.asm`.
