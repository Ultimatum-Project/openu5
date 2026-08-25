# Dispatcher de comandos y enlace kernel↔overlay (Task 1.4)

Herramienta: `re/tools/dispatch_table.py` (extracción programática; el CLI
imprime este mapa desde el binario). Tests: `re/tools/test_dispatch.py`.
Catálogo del kernel en el ledger: `re/tools/kernel_catalog.py`.

Todas las direcciones "pool" son offsets sobre los 34544 B de imagen
post-cabecera de ULTIMA.EXE (offset de fichero = pool + 0x800), igual que
en `re/notes/rng.md`.

## TL;DR

- El overlay manager **NO es el VROOMM de Borland** (0 stubs `int 3F`):
  es el **PLINK86 de Phoenix Software Associates** (su copyright vive en
  pool 0x745F). Registros de overlay en pool 0x7780, cargador en el
  segmento de imagen 0x72E.
- **Todo el código comparte UN universo CS de 64K** (CS = base de carga):
  los overlays cargan por debajo de linear 0x10000 y llaman al kernel con
  `call` **near** directo — por eso los .OVL no llevan reubicaciones. El
  kernel llama a los overlays vía **164 stubs de 12 bytes** (pool
  0x7A16–0x81C6) que cargan el overlay bajo demanda y saltan a su entry.
- El **dispatcher de comandos** es la función del kernel
  `kernel_cmd_dispatch(key)` en **pool 0x3178**: un switch de Borland C
  (árbol de `cmp` + una jump table inline de 7 entradas en 0x3490 para
  'F'..'L') con **28 teclas**: A–Z, Espacio y 0xFC. Lo llaman (una vez
  cada uno) los tres bucles de contexto: TOWN.OVL, MAINOUT.OVL y
  DUNGEON.OVL. Las flechas NO pasan por él: los bucles las tratan como
  códigos 1–4 antes de llamar.
- **DS = base + 0xF64 = el segmento donde carga DATA.OVL**: los globals
  DS:0xNNNN son bytes DENTRO de la imagen de DATA.OVL en RAM
  (`fileoff = DS_off + 0x10`; los 16 primeros bytes del fichero son su
  cabecera de reubicaciones y no se cargan). Verificado por una docena de
  strings de comando y por `game_ds = 0x1788 = 0x824 (base) + 0xF64` de
  Task 1.2.

## 1. Cadena de arranque

```
DOS → entry MZ 081D:0000 (pool 0x81D0, "kernel_crt0")
    fija SS:SP provisionales y hace retf a…
  → PLINK init 0x72E:0x322 (pool 0x7602)
    cambia a la pila del manager, calcula la base de carga
    (cs − [0x778:0]), precarga los overlays con flag 0x4000 (DATA.OVL),
    restaura registros y…
  → ljmp 0:0x17E — startup C del segmento raíz → main (la función con
    prólogo en pool 0x0000 parsea argv: switches de vídeo C/H/T/E).
```

El crt0 vive en pool 0x81D0, **dentro de la zona que pisan los overlays
de nivel 1**: tras el arranque, TOWN/MAINOUT/DUNGEON/INTRO lo
sobrescriben.

## 2. El gestor de overlays PLINK86

### Registros (pool 0x7780, segmento de imagen 0x778)

Un registro de **16 bytes por overlay** (nº 1..24), terminados por
flags = 0xFFFF. El cargador lee los campos con stride 16 desde
`di = (n−1)*16`; tres campos "desbordan" textualmente sobre el registro
siguiente (verificado en el asm del cargador, pool 0x74A1–0x7571):

| Campo | Significado |
|-------|-------------|
| +6  | flags: 0x8000 = cargado, 0x4000 = preload (DATA.OVL), bits bajos = overlay padre (árbol) |
| +8  | nº de reubicaciones en la cabecera del `.OVL` (0 salvo INTRO=2 y DATA=3) |
| +A  | segmento de carga (relativo a la base) |
| +C  | segmento límite |
| +E  | offset del nombre (relativo al seg 0x778; pool de nombres en 0x7908) |
| +10/+12 | offset del código en el fichero (párrafos, tras la cabecera reloc) |
| +14 | tamaño a leer (párrafos) |

Los bytes +0/+2/+4 del primer registro se reutilizan como cabecera del
manager: `[0x778:0]` = 0x72E (para calcular la base en el init; después
guarda la base misma) y `[0x778:4]` = segmento de pila.

### Mapa de memoria de overlays (segmentos relativos a la base)

```
0000–081D  kernel raíz (código C + PLINK + stubs)
081D–0A29  nivel 1: TOWN | MAINOUT | DUNGEON | INTRO      (excluyentes)
0A29–0BF8  nivel 2: FLAMES|NPC|COMBAT|BLCKTHRN|LOOKOBJ|DNGLOOK|OUTSUBS|SHOPPES|ENDGAME
0BF8–0E1E  nivel 3: SJOG | CMDS | CAST | TALK
0E1E–0F64  nivel 4: CAST2 | ZSTATS | COMSUBS | SHOPPES2 | SHOPPES3 | FONT
0F64–1BB8  DATA.OVL (preload; ¡es el DGROUP! ver §4)
1BB8–…     pila + BSS/heap (minalloc)
```

`(end_seg − load_seg)*16` y `read_paras*16` cuadran exactamente con los
tamaños de fichero de `binfiles` (test
`test_overlay_sizes_match_disk_files`).

### Rutinas clave (segmento 0x72E, pool 0x72E0+)

| Entry | Pool | Qué hace |
|-------|------|----------|
| 0x72E:0x292 | 0x7572 | **carga de overlay**: CX = nº de overlay; evicción de solapados (limpia bit 0x8000 de los que pisa), open/seek/read del `.OVL`, aplica su cabecera de reubicaciones y repite con el overlay padre (bits bajos de flags) |
| 0x72E:0x2EC | 0x75CC | **thunk de carga**: llamado con `lcall`; lee el word inline que sigue al call site (nº de overlay), lo carga y retorna saltándolo |
| 0x72E:0x7B  | 0x735B | cierra el handle cacheado del fichero de overlay |
| 0x72E:0x322 | 0x7602 | init (destino del crt0) |

~~Si el `.OVL` no abre, imprime "Error … Call OSI" y sale (INT 21h AH=4C).~~
🔴 **CORREGIDO (carril careo-fanfarria, 22-08; lo acredita `asm-boot-tanda2.md` §8 y lo
he re-careado contra `re/disasm/ULTIMA.EXE.asm`): si el `.OVL` no abre, cierra y sale
EN SILENCIO** — los fallos de carga llaman directamente a `overlay_loader_fatal_abort`
(ULTIMA.EXE:0x76b4: `lcall 0x72e:0x7b` cierra el handle + `mov al,0xff / mov ah,0x4c /
int 21h`, errorlevel 0xFF, sin imprimir nada). El mensaje "Error … Call OSI" existe en
UN solo sitio, el init (0x7642-0x7648: `mov ah,9 / mov dx,0x9f / int 21h`), y esa rama
es **inalcanzable en esta compilación**: 0x7628 llama a 0x76a1, que escribe `0xff` en
`[0x76c:0]` INCONDICIONALMENTE (`mov byte [0],0xff / mov byte [1],0 / ret`), las seis
instrucciones intermedias (0x762b-0x7637) solo tocan ES=0x778 (lineal 0x7780 ≠ 0x76c0),
y 0x763b `cmp byte [0],0xff` + 0x7640 `je 0x764e` salta SIEMPRE por encima del print.
Durante la carga puede invocar un hook del juego vía `lcall ss:[0x5394]`
(far ptr a kernel 0x1232, una de las 3 reubicaciones de DATA.OVL —
prompt de cambio de disco).

## 3. Enlace kernel→overlay: los 164 stubs

Pool **[0x7A16, 0x81C6)**: 164 stubs contiguos de 12 bytes:

```
9A EC 02 2E 07   lcall 0x72E:0x2EC    ; asegura overlay N cargado
NN NN            dw N                 ; nº de overlay (inline)
EA LL HH 00 00   ljmp 0:linear       ; salto far al entry (offset lineal)
```

El word de segmento del `ljmp` es 0x0000 en fichero y lo parchea el
cargador MZ (es una de las 409 reubicaciones): en runtime es la base de
carga. Como todo el código vive en el mismo CS de 64K, el offset lineal
del `ljmp` identifica el entry: `entry_file_off = linear − load_seg*16`
(+16 si el .OVL lleva cabecera de reubicaciones). Los llamadores (kernel
u otros overlays) hacen `call` **near** al stub; el `ret` near del
overlay vuelve directo al llamador original.

Cuentas que cierran la aritmética de Task 1.1: 164 `lcall 0x72E:0x2EC` +
164 words de segmento de `ljmp 0:…` ≈ las 337 reubicaciones "de código"
del histograma por contexto de opcode.

**Extracción**: `dispatch_table.stubs()` → los 164, cada uno con overlay
y offset de entry en el fichero. Los 23 overlays de código reciben ≥1
stub; DATA.OVL (24) ninguno. Sin entries duplicados.

## 4. DS = segmento de DATA.OVL (hallazgo)

Los strings que imprime el dispatcher son offsets DS-relativos que caen
uno a uno sobre DATA.OVL con `fileoff = DS_off + 0x10` ("Pass\n",
"Cast...\n", "D-What?\n", "View a gem!\n", …, una docena verificada en
`test_command_strings_resolve_from_data_ovl`). Cross-check independiente:
`game_ds = 0x1788` (Task 1.2, oráculo) = base 0x824 + **0xF64** = el
segmento de carga de DATA.OVL.

Consecuencia: el "DGROUP" del juego ES la imagen de DATA.OVL en RAM
(48448 B cargados) y los globals de Task 1.2 (DS:0x5xxx) son posiciones
dentro de ella, mutables en runtime (p.ej. `g_rng_seed` DS:0x5420 =
fileoff 0x5430, que en fichero es 00 00). El BSS de minalloc empieza tras
DATA.OVL (DS:0xBD40+) — la ventana donde se copia SAVED.GAM (roster en
DS:0x55A6) también cae dentro de la imagen de DATA.OVL. Esto refina la
nota de Task 1.1 ("los globals viven en el BSS más allá de la imagen"):
viven más allá de la imagen **de ULTIMA.EXE**, dentro del overlay de
datos precargado.

Las 3 reubicaciones de la cabecera de DATA.OVL parchean 3 words de
segmento de punteros far dentro del propio DATA.OVL:

| DS | Contenido tras el parche | Uso |
|----|--------------------------|-----|
| 0x5212 | far ptr base+0:0x030B (offset en 0x5212, seg en 0x5216) | `call word ptr [0x5212]` en el kernel; 0x5216 es además "el valor de DS/segbase" disponible como dato |
| 0x52A8 | far ptr (base+0xF64):0x52AC | tabla/vector interno de DATA |
| 0x5394 | far ptr base+0:0x1232 | hook de carga de overlay del PLINK (ver §2) |

INTRO.OVL lleva 2 reubicaciones análogas (words de segmento en sus
offsets de fichero 0x13E3 y 0x1419): INTRO hace un par de llamadas far
directas que ningún otro overlay necesita.

### `lcall [0x5350]` NO es el enlace overlay→kernel

Aclaración a la especulación de `re/notes/rng.md`: `[0x5350]` es el
vector del **driver de sonido** (`T1K.DRV`/`HER.DRV`, nombres en
DS:0x5340): el kernel escribe en `[0x5350]` el offset de entrada
(múltiplos de 3: tabla de `jmp` al inicio del .DRV) y `[0x5352]` guarda
el segmento del driver cargado (0 = sin driver). El enlace
overlay→kernel real es el `call` near directo del §3 (mismo CS).

## 5. Lectura de teclado y bucles de contexto

### `kernel_getkey` (pool 0x1D5E)

- INT 16h AH=1 (peek): sin tecla → devuelve 0.
- INT 21h AH=6 (raw): si el primer byte es 0 (tecla extendida) lee el
  scancode:
  - F1..F10 (0x3B..0x44) → `al += 0x8E` → **0xC9..0xD2**;
  - búsqueda en la tabla de 8 scancodes `g_kbd_xlat_scancodes`
    (DS:0x540E) → traducción 1:1 con `g_kbd_xlat_chars` (DS:0x5416):
    **← → ↑ ↓ = 0x01 0x02 0x03 0x04**, Home/End/PgUp/PgDn = 0xD3..0xD6;
    además marca `g_key_shifted` (DS:0x538A).
  - dígitos '1'..'9' con Shift/Ctrl (INT 16h AH=2 & 0x23) también marcan
    `g_key_shifted`.

### Bucles de contexto (uno por overlay de nivel 1)

Cada bucle lee la tecla y la despacha así (mismo patrón en los tres;
leído en MAINOUT.OVL fileoff 0xB14–0xC12; [t#57: es offset de MAINOUT, NO de DATA.OVL —
el censo de citas de string no distingue de qué fichero habla una cita y lo ficha igual]):

| Tecla | Tratamiento |
|-------|-------------|
| < 0x20 (códigos de control) | jump table local del overlay: **1–4 = movimiento** (O/E/N/S); 0x05 = prompt de salida a DOS; 0x0B, 0x13 (toggle), 0x16 (versión) — teclas Ctrl; resto → "What?\n" |

> ⚠ **SUPERADO en dos puntos por `re/notes/teclas-control-karma-derivacion.md`** (carril
> `tecla-karma`, 2026-08-25), que resuelve esas jump tables enteras:
> · **`0x0B` es el KARMA** — esta fila lo dejaba sin nombrar. `MAINOUT 0x0b34` /
>   `TOWN 0x14b8` / `DUNGEON 0x06f2` leen `g_karma` (DS 0x5888) y lo imprimen con
>   `print_number_padded(pad=' ', width=1, …)` ⇒ decimal PELADO + `'\n'`, sin turno.
>   Las tablas: MAINOUT `0x0BBE` (23 entradas, 0x00–0x16) y TOWN `0x1552` (22, 1–0x16),
>   ambas con la base de carga de overlay **`0x81D0`**, derivada por candidato único.
> · **«uno por overlay de nivel 1» deja fuera un cuarto bucle que también lee teclas**:
>   el de COMBATE (`COMBAT.OVL 0x063e`, getkey `0x0838`, base de carga `0xA290`), que
>   despacha los <0x20 con cadena de `cmp` y de la familia **sólo tiene `Ctrl-S`**
>   (`0x0881`→`0x08b6`) — `g_karma` tiene CERO refs en todo `COMBAT.OVL`.
| '0'..'9' | rutina near del kernel (selección de personaje/estadística) |
| resto (≥ 0x20) | **`push key; call kernel_cmd_dispatch (0x3178)`** |

Call sites near al dispatcher (`near_calls_to_kernel()`): TOWN.OVL
fileoff 0x158F, MAINOUT.OVL 0xC00, DUNGEON.OVL 0x7A3 — exactamente uno
por bucle, cero en los overlays de comandos.

## 6. `kernel_cmd_dispatch(key)` — pool 0x3178

Función C (prólogo 55 8B EC, `ret 2`), rango [0x3178, 0x3522). Mecanismo
**híbrido**: árbol de `cmp ax,imm` + jcc (pivotes 'M' y 'E') con **una
jump table inline** de 7 words en **0x3490** para 'F'..'L'
(`sub ax,0x46; cmp ax,6; ja default; jmp cs:[bx+0x3490]`). Devuelve en
AX: 1 = comando consumió turno (por defecto), 0 = inválido/sin turno,
2 = caso especial de Talk (entrar en tienda), o el retorno del overlay.

Contexto por `g_location` (DS:0x5893): 0 = exterior (Britannia),
0x01–0x20 = poblaciones, 0x21–0x28 = mazmorras.

### La tabla maestra (extraída por `dispatch_table.command_table()`)

Overlay:offset = fichero .OVL donde empieza la rutina del comando (la
columna que ordena las fases 3.x). "kernel:…" = rutina near del kernel.

| Tecla | Comando | Handler | String (DATA.OVL) | Rutina → overlay:fileoff (stub) |
|-------|---------|---------|--------------------|---------------------------------|
| Space | Pass (pasar turno) | 0x31F4 | "Pass\n"; "Sheets in irons!" si navegando sin viento | solo kernel |
| A | Attack | 0x3216 | (imprime el overlay) | exterior → MAINOUT:0x06EC (0x7BAE); pueblo → TOWN:0x09E6 (0x7AEE); mazmorra → DUNGEON:0x1D4A (0x7CAA) |
| B | Board | 0x3236 | "Board " | CMDS:0x07F6 (0x803A) |
| C | Cast | 0x3242 | "Cast...\n" | CAST:0x0DBA (0x7E5A) |
| D | — inválido | 0x324E | "D-What?\n" | solo print |
| E | Enter | 0x3254 | "Enter what?\n" si no exterior | exterior → MAINOUT:0x08DE (0x7B66) |
| F | Fire | 0x3266 | "Fire-" | CMDS:0x0AEA (0x8046) |
| G | Get | 0x3274 | "Get-" (chest) | SJOG:0x18CE (0x7E06) |
| H | Hole up & camp | 0x3288 | "Hole up-" | kernel 0x3C9A (exterior/mazmorra) o, **en pueblo (loc 0x01-0x20) sobre una CAMA — tile 0xAB = LeftBed** (via kernel 0x4402; 0x32b9 `cmp 0xab; je`) → dormir CMDS:0x0552 (0x802E); resto del pueblo → "Only in bed!" 0xa17a |
| I | Ignite torch | 0x32CC | "Ignite torch!" | CMDS:0x0D98 (0x8052) |
| J | Jimmy | 0x32DA | "Jimmy-" | SJOG:0x0D4A (0x7E12) |
| K | Klimb | 0x32E8 | "Klimb-" | exterior → CMDS:0x1C20 (0x809A); pueblo → TOWN:0x0B82 (0x7ACA); mazmorra → DUNGEON:0x1E10 (0x7C86) |
| L | Look | 0x3310 | "Look" | mazmorra → DNGLOOK:0x0000 (0x7F32); resto → LOOKOBJ:0x099C (0x7F26) tras kernel 0x16BA(0x2D) |
| M | Mix reagents | 0x3340 | "Mix Reagents" | CMDS:0x1AD8 (0x8082) |
| N | New order | 0x334E | "New Order" | CMDS:0x0DDC (0x805E) |
| O | Open | 0x335C | "Open-" | SJOG:0x1374 (0x7E1E) |
| P | Push | 0x336A | "Push-" ("Push\nNot here!\n" en mazmorra) | CMDS:0x161A (0x7D0A) |
| Q | Quit & save | 0x338C | "Quit:" | CAST2:0x10FE (0x81AE) |
| R | Ready | 0x339A | "Ready..." | ZSTATS:0x1296 (0x7E4E) |
| S | Search | 0x33A8 | "Search-" | SJOG:0x095C (0x7E2A) |
| T | Talk | 0x33C2 | "Talk-" (variantes) | pueblo → TALK:0x041C (0x8196), ret 2 = tienda; exterior → kernel 0x35EC; mazmorra → error |
| U | Use item | 0x340C | "Use item" | CAST:0x1792 (0x7E42) |
| V | View (gema) | 0x341A | "View a gem!\n" | consume g_gems (DS:0x57AD); mazmorra → DNGLOOK:0x06A8 (0x7F4A); resto → LOOKOBJ:0x10FC (0x7F0E) |
| W | — inválido | 0x3450 | "W-What?\n" | solo print |
| X | X-it | 0x3456 | "X-it" | CMDS:0x0EB4 (0x806A) |
| Y | Yell | 0x3464 | "Yell " | CMDS:0x1418 (0x7D6A) |
| Z | Ztats | 0x3472 | "Z-stats...\n" | ZSTATS:0x0A3A (0x7E36) |
| 0xFC | Buffer On/Off | 0x31C6 | "Buffer O" + "n"/"ff" | togglea g_kbd_buffer_on (DS:0x538C) |
| otra | default | 0x34D8 | "What?\n" | ret 0 |

Notas de la tabla:

- Los strings se resuelven con `fileoff = DS_off + 0x10` sobre DATA.OVL
  (§4); los overlays imprimen los suyos propios (p.ej. "Attack-").
- 'D' (Descend) y 'W' (Wear) **no existen como comandos del kernel** en
  esta versión: imprimen "D-What?"/"W-What?" (descender se hace con
  Klimb en mazmorra; equipar armadura con Ready).
- La extracción del switch es **ejecución concreta del árbol de
  comparaciones** para cada tecla 0x00–0xFF (whitelist de instrucciones
  de dispatch); del handler se recorre el CFG acotado recogiendo strings
  y llamadas. Nada copiado a mano: `python3 dispatch_table.py`.

### 6-bis. Lo que la tabla NO ve (lectura del cuerpo entero, carril kernel-3178)

La tabla de arriba la extrae `dispatch_table.py` y es **correcta**: la
lectura instrucción-a-instrucción de los 938 B la confirmó tecla a tecla
(28/28, mismos handlers). Lo que un extractor de *strings y llamadas* no
puede ver es el **valor de retorno**, y ahí está la mecánica:

**Hay dos colas de impresión con retorno distinto.** Salida única en
0x351C; el retorno se carga en 0x31EE (`mov ax,[bp-2]`, inicializado a 1).

| Cola | Qué hace | Retorno |
|------|----------|---------|
| 0x31E5 | `print(ax)` → 0x31E9 `[bp-2]=0` → 0x31EE | **0** |
| 0x33EA | `print(ax)` → 0x31EE, sin tocar `[bp-2]` | **1** |

- **Retornan 0 (NO gastan turno):** 0xFC, 'D', 'W', 'P' en mazmorra,
  la tecla desconocida ("What?"), y **'Q'** (salta a 0x31E9 tras el stub).
- **Retornan 1 (SÍ gastan turno) aunque sean rechazos:** Espacio ("Pass"),
  'E' fuera del exterior ("Enter what?"), 'H' en población fuera de la cama
  ("Only in bed!"), 'T' en exterior y en mazmorra ("Funny, no response!"),
  'V' sin gemas ("You have none!").
- **Retorna 2:** sólo 'T' en población con el stub TALK devolviendo ≠ 0.

⚠️ **Port-check.** El retorno es el `[bp-8]` que abre el tick de mundo en
el bucle llamador. En el original, (V) sin gemas o (E) dentro de un pueblo
**gastan el turno**; (D), (W), (Q) y una tecla desconocida no. Un clon que
trate todos los mensajes de error igual diverge en una de las dos
direcciones. *(No medido: el coste exacto del tick en TOWN y en DUNGEON.)*

**Sólo 6 teclas propagan el retorno del overlay** (`[bp-2]=ax` en 0x3231):
'A', 'B', 'C', 'E' en exterior, 'K' en población/mazmorra e 'Y'. Las otras
22 lo **descartan**. El caso visible es **(K)limb, que se comporta de las
dos maneras**: en exterior (0x32EF) imprime el verbo desde el kernel, llama
al stub 0x809A y **consume turno siempre**; en población y mazmorra defiere
al overlay y no imprime nada.

**Correcciones a la columna «String» de la tabla:**

- **'H'** — el kernel imprime `"Hole up- "` (0xA170) **sólo en población**, y
  **después** de leer el tile (0x32A6 `get_tile_ptr` → `[bp-4]`, 0x32B2
  `print`). En exterior y mazmorra salta a `camp_command` 0x3C9A **sin
  imprimir nada**: el verbo lo pone el callee.
- **'S'** — tiene **dos** strings: `"Search-"` (0xA1FC) si `g_location` < 0x21
  y `"Search...\n"` (0xA204) si ≥ 0x21.
- **'L'** — `"Look"` (0xA1A8) y luego `"...\n"` (0xA1AE) en mazmorra, o
  `putchar('-')` fuera.
- **'T'** en exterior — la polaridad de `prompt_direction` (0x35EC) va **al
  revés** de lo que sugiere el nombre: `ax == 0` retorna 1 **en silencio**;
  es `ax != 0` lo que imprime `"Funny, no response!"`.

🔴 **`g_kbd_buffer_on` (DS:0x538C) tiene el nombre con la polaridad
invertida** — adjudicado por el **consumidor**, no por el nombre. El único
lector está en 0x1D77 (`cmp [g_kbd_buffer_on],0 / je / call 0x1B24`) y
**0x1B24 escribe 0x1E en 0040:001A y 0040:001C = vacía la cola de teclado
de la BIOS**. Luego valor 1 = se descarta el type-ahead = "Buffer Off";
valor 0 = se conserva = "Buffer On". **El mensaje del 0xFC es correcto; el
que miente es el nombre del global** (sería `g_kbd_flush` /
`g_kbd_typeahead_off`). El arranque la pone a 1 (0x00A7): el juego arranca
con el type-ahead descartado y el primer 0xFC anuncia "Buffer On".
*El símbolo no se ha renombrado: lo consume el listado entero y otros
carriles — queda adjudicado, pendiente de decisión del orquestador.*

**Tabla de saltos.** Los 7 destinos de 0x3490 se descodifican **de la
imagen** (`fileoff = pool + 0x800`), no del listado: éste desincroniza en la
tabla y **re-sincroniza solo** en 0x34A8, con el código real reanudando en
0x349E. Las 7 entradas caen dentro del cuerpo **sin restar ranura de
carga** — en ULTIMA.EXE la dirección de pool ya es el offset CS.

**RNG.** El despachador **no consume ni una tirada propia** (0 llamadas a
`rand_range` 0x2092 y a `srand` 0x207E; ninguno de los 22 call-sites de
`rand_range` del kernel cae en [0x3178, 0x3522)). Pero **la tecla 'H' en
exterior o mazmorra sí mueve stream**: `camp_command` 0x3C9A tiene un
`rand_range` en 0x3D13 y llama a `advance_clock` 0x4F7C. Los 30 stubs de
overlay **no se han descendido**: el coste de cada comando es de su fila.

## 7. Efecto en el ledger (Task 1.4 Step 5)

`kernel_catalog.py` particiona los 34544 B de ULTIMA.EXE al **100%**
(`gaps() == []`, 198 segmentos): 181 funciones por prólogo `55 8B EC`
(178 `kernel_fn_<addr>` provisionales + el trío RNG de Task 1.3 +
dispatcher/getkey/print con nombre), las estructuras PLINK (código del
manager, copyright, scratch, registros, nombres), los 164 stubs, crt0,
y el DGROUP inicializado (blob de protección XOR 0xDC + ISR de
temporizador + colas de datos), con padding/basura como `inert`.
Honestidad: los límites de las `kernel_fn_*` son la partición por
prólogos (pueden incluir tablas de salto inline y padding); el claro del
blob de protección no se ha revertido estáticamente — ambos anotados en
las notas de los segmentos.

## 8. El mapa `start` → `fileoff` es MEDIBLE, y su fallo detecta los prólogos comidos

Adenda del 06-08 (lead). La cabecera de esta nota declara desde julio, para ULTIMA.EXE, que
`fileoff = pool + 0x800`. Dos cosas que no estaban dichas ahí y que
desbloquean trabajo parado:

**(a) El `start` del ledger ES el «pool» de esta nota, y la identidad está
medida, no supuesta.** Contra la imagen real de 36.592 B, la primera
instrucción de **195 de las 229 filas** de ULTIMA.EXE casa byte a byte en
`start + 0x800`. Controles negativos corridos a la vez: con desplazamiento
0 casan 0 de 7, y con 0x810 casan 0 de 7. ⇒ toda comprobación a nivel de
BYTE contra el binario es válida para este fichero desde ya.

**(b) Las 34 filas que NO casan son exactamente las 34 decapitadas**, y el
predicado es exacto en vez de heurístico: **una fila está decapitada si y
sólo si el `.asm` no tiene NINGUNA línea en su dirección de inicio**. El
cardinal coincide con el 34 que ya se había medido por la firma `00 55 8b`,
por un camino independiente. Todas están selladas: entre ellas el trío RNG,
`putchar`, `blit_tile`, `memchr`, `ulong_div` y los envoltorios de driver.
⇒ el prólogo comido se recupera **leyendo la imagen**, sin re-ensamblar y
sin coordinar tandas entre carriles.

**(c) El mapa completo, medido para los 28 ficheros** (búsqueda del
desplazamiento que maximiza las coincidencias, con tope de 8 KiB en pasos
de 16 bytes, sobre hasta 60 filas por fichero). No se extrapoló desde el EXE: se midió
uno a uno, y el resultado es más simple de lo que sugería el registro
PLINK86:

| Fichero | Desplazamiento | Filas que casan |
|---------|----------------|-----------------|
| ULTIMA.EXE | `+0x800` | 60/60 muestreadas (195/229 en total) |
| los 22 `.OVL` y los 4 `.DRV` | **identidad, `+0`** | **100 % en los 26** |

⇒ para los overlays y los drivers, la dirección del `.asm` **es** el offset
de fichero. Toda comprobación byte a byte contra la imagen es válida en
**todo el corpus**, no sólo en el kernel.

### Censo exacto de la decapitación (sustituye a la firma como detector)

Con el mapa, el predicado deja de ser heurístico. Sobre las **885** filas
del ledger:

- **36 decapitadas** (4 %): **34** en ULTIMA.EXE y **2** en INTRO.OVL. El 34
  coincide con lo que la firma `00 55 8b` había dado por un camino
  independiente; las 2 de INTRO.OVL **no estaban censadas**.
- **33 de las 36 ya están SELLADAS** — se leyeron por otra vía o se sellaron
  sin el prólogo. Es deuda de re-verificación, no de lectura.
- **Sólo 3 están PENDIENTES**, y son las únicas que bloquean el goal por
  esta causa: `INTRO.OVL:0x0010` (64 B), `ULTIMA.EXE:0x22c0` (34 B) y
  `ULTIMA.EXE:0x6ff0` (80 B). Las tres se leen ya desde la imagen.

**Aviso de instrumento, hermano de la decapitación.** La jump table inline
de §6 es DATO dentro del cuerpo: el listado se desincroniza justo detrás de
ella y devuelve basura durante 14 bytes, hasta realinearse en el `cmp ax`
de la tecla 'T'. Es un segundo modo por el que el `.asm` miente **a mitad
de rutina**, y le pasa a cualquier función con tabla inline, no sólo a las
de prólogo comido. Quien lea un cuerpo y encuentre instrucciones absurdas
seguidas de código sano: sospecha de una tabla, no de tu lectura.

## 9. El grafo de llamadas ENTRE FICHEROS sí se puede construir

Adenda del 06-08 (lead), y **corrige un error mío publicado unas horas
antes en esta misma nota y en un mensaje a la flota**. Yo escribí que «el
desensamblado no representa las llamadas entre ficheros: no existe sintaxis
`call far seg:off` en ninguno de los 28». **Las dos mitades son falsas.**

**(a) La sintaxis existe y es densa.** Censo de `lcall`/`ljmp` sobre los 28
ficheros: ULTIMA.EXE **314**, y de ellos **138** son la misma llamada far
al thunk de carga del gestor de overlays descrito en §3) ·
CGA/HER/T1K.DRV 5 cada uno · EGA.DRV 4 · INTRO.OVL 2 · CAST.OVL 1 ·
COMBAT.OVL 1. *(Medido por el carril de INTRO; yo había buscado una forma
`seg:off` que el desensamblador no usa, y leí su ausencia como ausencia del
mecanismo — el error de siempre: confundir mi patrón con el fenómeno.)*

**(b) Y las llamadas overlay→kernel son NEAR y perfectamente legibles**, sólo
que cada overlay tiene su propio desplazamiento hacia el espacio del kernel.
Se derivan midiendo, no suponiendo: para cada overlay se busca el
desplazamiento que maximiza los destinos de `call` que caen **exactamente en
el `start`** de una fila del ledger de ULTIMA.EXE. Resultado sobre los 22
`.OVL`: **cinco desplazamientos distintos, y ni uno más.**

| desplazamiento | overlays | corresponde a |
|---|---|---|
| `0x81c0` | INTRO | nivel 1 |
| `0x81d0` | TOWN · MAINOUT · DUNGEON | nivel 1 |
| `0xa290` | NPC · COMBAT · BLCKTHRN · LOOKOBJ · DNGLOOK · OUTSUBS · SHOPPES · ENDGAME | nivel 2 |
| `0xbf80` | CAST · CMDS · SJOG · TALK | nivel 3 |
| `0xe1e0` | CAST2 · COMSUBS · FONT · SHOPPES2 · SHOPPES3 · ZSTATS | nivel 4 |

★ **Son los segmentos de carga del mapa de memoria de §2, multiplicados por
16** — `0x081D`·16 = `0x81D0`, `0x0A29`·16 = `0xA290`, `0x0BF8`·16 = `0xBF80`.
El mapa de §2 se midió en julio leyendo los registros PLINK86; estos
desplazamientos salen de que los destinos de `call` aterricen en inicios de
fila. **Dos métodos sin nada en común, el mismo resultado.**

★★ **Y la tabla sobra: hay FÓRMULA, sin parámetros libres.** El único
desplazamiento que no encajaba en el patrón —INTRO, un párrafo por debajo de
sus tres hermanos de nivel 1— deja de ser excepción al cruzarlo con el campo
`+8` de §2: **INTRO es el único overlay de CÓDIGO con cabecera de
reubicaciones** (2 entradas; los demás llevan 0 y sólo DATA lleva 3), y ese
párrafo **no se carga**.

```
delta = load_seg × 16  −  (16 si el .OVL lleva cabecera de reubicaciones)
```

Las cinco filas salen de ahí sin ajustar nada: **un ajuste empírico de cinco
valores se convierte en una derivación de una línea.**

**Y las 2 entradas de esa cabecera están leídas**: son los dos punteros far a
la ranura de hook de §2. En `INTRO.OVL` el offset 0 lleva
`d9 95 00 00 · a3 95 00 00` más relleno; restando el desplazamiento dan
`0x1419` y `0x13E3`, que caen **exactamente en el word de segmento inmediato**
de los dos `mov word ptr [0x5396], 0` del cuerpo. Están a cero en el fichero y
**el cargador los parchea con la base**: para eso existe la cabecera. El mismo
mecanismo explica el `fileoff = DS + 0x10` de DATA.OVL de §4 — **el párrafo es
fijo, el número de entradas no** (DATA 3×4 B + 4 de relleno; INTRO 2×4 + 8).

⚠️ **Sin comprobar**: no se ha leído el cuerpo del cargador (§2) para confirmar
que aplica las entradas como offset lineal de 32 bits. Se infiere de que las
dos restas den los dos inmediatos exactos — una coincidencia de 32 bits por
duplicado, que es fuerte pero no es la lectura.

🔎 Y un dato que no mueve ningún veredicto pero pesa: **una de las dos
reubicaciones cae DENTRO del bloque de 75 B inalcanzable** de esa rutina. El
cargador parchea, en cada carga del overlay, el segmento de una instrucción
que no se ejecuta jamás ⇒ **el enlazador registró esa reubicación porque en su
momento ese código contaba**: el bloque estaba vivo al enlazar, y lo mató un
salto posterior.

### Censo de llamadores, que era lo que estaba sin resolver

Yo había publicado que «sin llamador near» no discriminaba nada porque lo
cumplían 66 de las 229 filas, **45 de ellas ya selladas**. Eso sigue siendo
cierto y sigue siendo la razón de no usarlo para priorizar. Lo que era falso
es que la pregunta no tuviera respuesta. Traduciendo cada overlay por su
desplazamiento, de las **21 filas pendientes sin llamador near**, **19
quedan resueltas**:

- `kernel_cmd_dispatch` ← DUNGEON · MAINOUT · TOWN. **Es exactamente lo que
  §TL;DR de esta nota afirmaba desde julio** («lo llaman los tres bucles de
  contexto»), ahora por medición independiente.
- `world_turn_dispatch` ← MAINOUT · TOWN. Dato para la ficha de su nombre.
- `turn_housekeeping` ← CMDS · DUNGEON · MAINOUT · TOWN (los cuatro).
- `find_object_at_xy` ← CAST · CMDS · LOOKOBJ · MAINOUT y más.
- `chest_trap_trigger` ← CMDS · SJOG · `alloc_actor_slot`, `input_string`,
  `strchr_index`, `moongate_enter`, `draw_framed_panel`, `load_font_slot`,
  `paint_screen_frame`, `input_string_raw`, `draw_7_centered_rows`, y las
  `gfx_*` — todas con overlay llamador identificado.

**Quedan DOS sin resolver**, y se declaran: `crt0_exit_process`, que es la
salida del proceso y no se llama, se alcanza · y `find_object_near_party`.

### La cola del fichero NO es un hueco del censo — retirada en el sitio

Al escribir esto anoté que el ledger termina donde la imagen todavía sigue,
y declaré esa diferencia como «~3.952 B sin censar». **Se retira: eso ya
está explicado en esta misma nota.** La §7 dice qué hay ahí —código del
manager PLINK, copyright, scratch, registros y pool de nombres, **los 164
stubs de la §3**, y el crt0— y `kernel_catalog.py` particiona los 34.544 B
**al 100 %** con `gaps() == []`. Es infraestructura del enlazador, **fuera de
un censo de rutinas de JUEGO por criterio, no por olvido.**

Y los 138 destinos far idénticos del censo de (a) **son esos 164 stubs**, no
un hallazgo nuevo: la §3 ya da su patrón byte a byte y hasta su extractor
(`dispatch_table.stubs()`).

⚠️ Esta retirada y la de (a) tienen **la misma causa, y es la misma que la de
#81**: se grepeó por la DIRECCIÓN que uno traía en vez de por el CONCEPTO
(stub, thunk, hook). ⇒ **regla adoptada: antes de publicar un mecanismo del
binario, grep del corpus por el NOMBRE DEL MECANISMO. La dirección es tuya;
el concepto es del corpus.**
