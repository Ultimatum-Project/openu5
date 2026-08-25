# Tercer canal (desplazamiento negativo): censo, buckets y ADJUDICACIÓN — tarea #66

Instrumento: `re/tools/globals_negdisp.py` (+ `test_globals_negdisp.py`, cableado en
`test_globals.py`). Reproducible: `python3 re/tools/globals_negdisp.py`.
Diseño y requisitos: `re/notes/tarea-66-diseno.md`. Barrido origen (cifras
**SUPERADAS**, ver §1): `re/notes/globals-desplazamiento-negativo.md`.

---

## 1. El barrido origen contaba 20 direcciones que no son globales

El origen tomaba **todo** `[reg - 0xNNNN]` como acceso a DS y firmó «40 direcciones
invisibles al hex». La mitad son artefactos, en dos clases derivadas:

| bucket | de las 93 alcanzadas | de las 40 «invisibles» |
|---|---|---|
| `SEG_OVERRIDE` — `jmp word ptr cs:[...]`, tabla de saltos | 23 | 12 |
| `DATA_AS_CODE` — la «instrucción» cae en una zona de DATOS | 34 | 15 |
| `LIVE` — ≥1 acceso limpio (candidatas reales) | 36 | 13 |

Los buckets **particionan** (23+34+36 = 93) y el test lo trinqueta.

**SEG_OVERRIDE**: el desplazamiento es un offset de CÓDIGO del segmento del propio
overlay. Prueba aritmética 12/12: `addr − overlay_near_call_base(fichero)` cae dentro
del `.OVL`. SJOG `0x013b: jmp cs:[bx-0x3ed0]` ⇒ `0xC130 − 0xBF80 = file 0x01B0`, y las
palabras crudas de `SJOG.OVL@0x1B0` son `0xC0C0/0xC0CA/0xC0D0/…` = file
`0x140/0x14A/0x150/…`, los destinos del switch inmediatamente encima.

**DATA_AS_CODE**: el desensamblado lineal atraviesa datos y decodifica sus bytes como
instrucciones, así que el «desplazamiento» es la palabra LE de dos bytes de datos.
TOWN `0x1566` está rodeado de `1497 adc al, 0x97` en bucle — bytes `14 97` = `0x9714`,
la propia «dirección». El kernel decodifica `fmul qword ptr` y `(bad)`, y **U5 no tiene
una sola instrucción de FPU**. Las zonas se derivan, no se estiman:
- overlays → tablas de saltos delimitadas desde los `jmp cs:` del propio fichero
  (señal independiente de la dirección clasificada);
- kernel → `[0x7780,0x81D0)` tabla PLINK (`routine_census.PLINK_DATA_LO/KERNEL_TOP`) y
  `[0x8200,0x86F0)` el segmento de DATOS del `.EXE` (`exe_layout.segments`, delimitado
  por el `retf` del trampolín crt0). 5 de las 6 «invisibles» del kernel caían ahí.

De las 13 `LIVE`-invisibles, 2 tienen entrada en `globals.json`
(`g_combat_actor_records+1`, `g_virt_elim`) ⇒ **la cola de adjudicación es 11**, no 39
ni 32.

> **Lección**: el barrido origen TENÍA control positivo (`ad14`) y aun así firmó una
> cifra con la mitad de basura dentro. Un control de **sensibilidad** no es un control
> de **especificidad**. El instrumento nuevo lleva los dos, y los negativos se verifican
> INYECTANDO el caso al `scan_text` puro.

## 2. Las 3 direcciones que un censo de DOS canales da por CERO

`only_negative_addresses()`: sin hex de operando **ni** símbolo impreso.

| dirección | global | dónde |
|---|---|---|
| `0xBA15` | `g_combat_actor_records+1` | COMBAT `0x13d7`, `0x1c75` |
| `0xBD2A` | `g_virt_used` | FONT `0x09ab`, `0x09be`, `0x0cc2`, `0x0cef`, `0x0d1a` |
| `0xBD32` | `g_virt_elim` | FONT `0x09b2`, `0x0afe`, `0x0cbe` |

Si alguien censa por hex+símbolo y firma «0 refs» sobre una de éstas, **el cero es del
instrumento**. Es el género exacto del acta `censo-global-hex-y-simbolo`.

## 3. Adjudicación de las 11 (cada una dentro de una rutina YA identificada)

Se cruzó el REPO antes que el binario: las 11 caen dentro de rutinas de
`frontier.json`. Ninguna se bautiza; se describe la forma del acceso y se dice qué
queda sin derivar.

| dir | rutina dueña | forma del acceso | veredicto |
|---|---|---|---|
| `0xAAE2` | `world_tile_autotile_resolve` ULTIMA.EXE `0x51b8` | `mov byte [bx+si-0x551e], 0x9e` con `si = arg<<5` | escritura de la constante `0x9E` en array de stride 32. **Semántica no derivada** |
| `0xABA7` | `ship_try_move` MAINOUT `0x01fe`, `town_move` TOWN `0x0600` | `mov al, [bx+si-0x5459]`, `si = arg<<5`, `bx = arg` | ★ **DERIVADA** (medición de #68, ver §4b): es la CELDA CENTRAL del búfer basado en `0xAB02`, indexada por desplazamientos RELATIVOS con signo |
| `0xAC74` | `combat_absorb_shadow` SJOG `0x1ea4` | ver §4 | ★ §4 |
| `0xADB4` | `corridor_sprite_overlay` DNGLOOK `0x117e` | `mov al, [bx-0x524c]`; `or al,al` ⇒ 0 TERMINA el recorrido | array terminado en 0, recorrido por índice de bucle. **No derivada** |
| `0xADBF` | `build_first_person_11x11` DNGLOOK `0x0d3e` | `mov byte [di-0x5241], 0` con `di ∈ [0,16)`; luego `mov [bx-0x5241], al` | array de **16 bytes**, puesto a cero y luego escrito por índice de tabla. **No derivada** |
| `0xADD4` | `corridor_sprite_overlay` | `mov al, [bx-0x522c]`, `bx = [bp-0xa]` | par con `0xADF4` (32 bytes de separación) |
| `0xADF4` | `corridor_sprite_overlay` | `mov al, [bx-0x520c]`, `bx = [bp-0xc]` | **arrays PARALELOS de 32**: los dos valores se empujan junto con `g_floor` al thunk `call 0xffffc276` (DNGLOOK `0x1318`). Contenido no derivado |
| `0xB21F` `0xB220` `0xB221` | `read_sign_at_position` LOOKOBJ `0x07e4` | 3 `cmp byte [si-0x4de1/e0/df], al` contra `[bp+8]`, `[bp+6]`, `[bp+4]` | ★ **DERIVADO**, ver §5 |
| `0xBCE4` | `talk_flush_line` TALK `0x04e2`, `talk_emit_char` TALK `0x0574` | ver §6 | ★ **DERIVADO** |

## 4. ★ `0xAC74` (tarea #61): la REFORMULACIÓN queda REFUTADA — sí hay escritores

`d4dd1466` reformuló #61 así: «`0xAC74` está dentro de la región basada en `0xAC64`,
que se puebla con tres cargas de `MISCMAPS.DAT` ⇒ **probablemente no existe instrucción
escritora**». **Existen, y son cuatro** — todas en forma negativa, que es justo por lo
que el censo por hex no las vio:

```
ULTIMA.EXE 0x537d  mov byte ptr [bx + si - 0x539c], al   ; world_tile_autotile_resolve
ULTIMA.EXE 0x5534  mov byte ptr [bx - 0x539c], al        ; compose_world_view
ULTIMA.EXE 0x5571  mov byte ptr [bx - 0x539c], al        ; compose_world_view
ULTIMA.EXE 0x55b9  mov byte ptr [bx - 0x539c], al        ; compose_world_view
```
más dos lecturas del kernel (`viewport_compose_11x11` `0x56d4`/`0x56db`) y una de
`tile_terrain_class_lookup` (CMDS `0x07bc`). `(-0x539c) & 0xFFFF = 0xAC64`.

### La GEOMETRÍA sale derivada, con dos comprobaciones independientes

`compose_world_view` escribe **dos** búferes en el mismo punto con índices distintos:

```
5525: bx = [bp-0x1a]; al = [bx]         ; el tile de origen
552d: cl=4; shl bx,cl; add bx,[bp-0x28] ; índice = A*16 + B
5534: mov byte ptr [bx - 0x539c], al    ;   -> 0xAC64, stride 16
553b: cl=5; shl bx,cl; add bx,[bp-0x28] ; índice = A*32 + B
5542: mov byte ptr [bx - 0x54fe], ah    ;   -> 0xAB02 = g_vis_buffer, stride 32
```

Comprobación 1 — **las fronteras cuadran al byte**:
`0xAC64 − 0xAB02 = 354 = 11*32 + 2` y `0xAD14 − 0xAC64 = 0xB0 = 176 = 11*16`. Los tres
búferes son consecutivos y de 11 filas.

Comprobación 2 — **la carga de fichero mide exactamente lo mismo**: BLCKTHRN `0x070e`
empuja `0xB0` (176) como longitud a `0xAC64`. Y BLCKTHRN `0x073d-0x074b` copia
`repne movsw` con `cx=5` + `movsb` = **11 bytes por fila**, en un bucle de `[bp-6] = 0xB`
= **11 filas**, de `0xAC64` a `0xAD14`.

⇒ `0xAC64` es un búfer **11 filas × stride 16** que contiene una ventana de tiles
**11×11**, y `0xAC74 = 0xAC64 + 16` = **fila 1, columna 0**.

### Qué queda ABIERTO (y por qué no lo cierro)

`combat_absorb_shadow` hace, con `bh` puesto a cero en `0x1ed0`:

```
1ecd: mov bl, byte ptr [bx + 6]     ; campo +6 del registro de actor = X (layout del ledger)
1ed2: mov al, byte ptr [bx - 0x538c]; = [0xAC74 + X]
1ed6: and al, 0xfc
1ed8: cmp al, 0x3c                  ; familia de 4 tiles 0x3C..0x3F
```

Indexa **sólo por X**, sin Y — que no case con una ventana 2D es en sí mismo indicio de
que combate REPURPOSE la región, y no lo doy por resuelto. La familia `0x3C..0x3F` es,
en `game/src/core/data/TileData.json`, `CastleBritian3/4/Entrace/5`; esa tabla es del
port, **no del binario**, así que NO la uso como veredicto. El calificativo «shadow» del
nombre de la rutina sigue **sin derivar**, en línea con el veredicto que ya está en
`frontier-manual.json`.

**Lo que #61 gana**: deja de ser «un único acceso sin escritor» y pasa a ser «región de
la ventana de tiles del kernel, con tres dueños (composición de vista del kernel,
`MISCMAPS.DAT` por escena, y el uso de combate) y geometría derivada al byte».

## 4b. ★ `0xABA7` = la CELDA CENTRAL del búfer (retira el «no derivada» de §3)

Medido al instrumentar #68 (censo de globales alcanzadas por ÍNDICE ESCALADO). Con el
stride 32 ya derivado en §4:

```
0xABA7 − 0xAB02 = 165 = 5*32 + 5   ⇒  fila 5, columna 5 de una rejilla de 11 filas
```

es decir **el centro exacto de un 11×11** — la casilla de la party. Y `town_move`
confirma que los índices son **desplazamientos relativos CON SIGNO**, no coordenadas
absolutas:

```
061a: sub ax,ax; 8946f4/8946f6   ; los DOS índices locales arrancan en 0
0625: ax = [bp+4]                ; argumento de DIRECCIÓN (1..4)
0638: cmp ax,3 / je 0x648
0648: dec word ptr [bp - 0xc]    ; dirección 3 ⇒ fila = −1
0662: push 0x2676                ; DS 0x2676 = 'North\n'  ← confirma qué dirección es
066e: si = [bp-0xc] << 5         ; = −32
0678: mov al, byte ptr [bx + si - 0x5459]   ; = 0xABA7 − 32 = una fila ARRIBA del centro
```

⇒ las rutinas de movimiento preguntan «qué hay en la casilla a Δfila/Δcol de la party»
sobre el mismo búfer que `compose_world_view` rellena con coordenadas ABSOLUTAS
(`fila*32 + col` desde `0xAB02`). Dos rutinas independientes, dos formas de indexar, y
**coinciden en stride 32 y en rejilla de 11 filas** — corroboración cruzada del §4 por
una vía que no usa ninguna de sus dos comprobaciones.

Corolario que cae solo: `g_unk_abc7` (`0xABC7`) = `0xAB02 + 197` = **fila 6, columna 5**
= la casilla justo al SUR de la party. No es una global desconocida: es una celda
interior de este mismo búfer.

> ★ **CONFIRMACIÓN CRUZADA, y un fallo mío retirado.** Escribí aquí que `0xABC7` «no
> tiene ni una sola referencia en el corpus por ninguno de los tres canales». **FALSO, y
> del peor género**: miré el canal hex y el negativo, y NO el de símbolo — que tiene
> **cuatro** (CMDS `0x0b58`, CMDS `0x131a`, MAINOUT `0x05b2`, TOWN `0x0e3f`). Es
> exactamente el cero silencioso que este módulo existe para impedir, cometido por su
> autor el mismo día. Guarda permanente:
> `test_0xABC7_ES_EL_CONTRAEJEMPLO_DE_MIRAR_SOLO_DOS_CANALES`.
>
> Y lo que aparece al mirar bien es **mejor** que lo que creía: `re/notes/interactions-piano-fire-audit.md`
> YA había derivado, por una vía totalmente distinta (el gate del puzle del clavicémbalo,
> `TOWN 0x0e3f: cmp byte ptr [g_unk_abc7], 0x8d`), que `0xABC7` es **el tile
> inmediatamente al SUR de la party**. Mi geometría (fila 6, col 5, una fila bajo el
> centro) dice lo mismo desde el stride. Dos derivaciones independientes que coinciden —
> y el port ya depende de ella (`game/src/core/world/harpsichord.ts`).
>
> ⇒ **`g_unk_abc7` NO se puede absorber**: no es un marcador suelto, es una celda con
> semántica derivada y consumidores. Eso reformula #68 (ver abajo).

### ⚠ Hallazgo colateral para el ledger (NO tocado)

`globals.json` declara `g_vis_buffer @0xAB02 size=121` (11×11). Pero
`compose_world_view` lo indexa con **stride 32**, luego su extensión real es
`11*32 = 352` B hasta `0xAC62` — y encaja exactamente contra `0xAC64`. El `121` cuenta
celdas útiles, no extensión. **No lo he corregido**: cambiar un `size` del ledger mueve
los solapes de `globals_map.entries()` y es trabajo con dueño (tarea **#68**).

Medición hecha para #68 (censo de globales con índice escalado, 24 binarios), por si le
sirve a quien la coja:

- **16 globales** se alcanzan con índice escalado. De ellas, **una sola** tiene un `size`
  que contradice su stride: `g_vis_buffer`. Las demás son consistentes
  (`g_party_records` 512/32, `g_dng_map` 512 con strides 8 y 64, `g_npc_pathbuf`
  1024/32, `g_combat_actor_records` 256/8, …).
- Las otras 3 que saltan el filtro (`g_unk_25ea`, `g_unk_5146`, `g_unk_514c`) son
  `g_unk_*` con `size=1`, que es la CONVENCIÓN de marcador del ledger para «extensión
  desconocida», no una medición ⇒ no son el mismo defecto. **La respuesta a «¿puede
  haber más globals con stride?» es: sí, 16, pero el problema de semántica está
  confinado a una.**
- ⚠ **El arreglo no es una línea**: agrandar `g_vis_buffer` a 352 B mete a `g_unk_abc7`
  (`0xABC7`) DENTRO de su extensión (§4b: fila 6, col 5), y `entries()` lanza
  `ValueError` ante el solape. Y `g_unk_abc7` **no se puede borrar**: tiene 4 refs por
  el canal símbolo, semántica derivada (el tile al SUR de la party, gate del clavicémbalo)
  y consumidores en el port. ⇒ el modelo plano «sin solapes» del ledger no sabe expresar
  «celda CON NOMBRE dentro de un búfer», que es la situación real. Ver §7b.
- La `size` no es una convención a elegir: sus DOS consumidores en `globals_map` ya la
  tratan como BYTES (`prev_end = addr + size` en el validador de solapes, y
  `range(1, size)` al anotar los bytes interiores). Un `size` que cuenta celdas útiles no
  es «otra convención»: incumple el contrato que ya existe.

## 5. ★ `0xB21E` — tabla de `signs.dat` (DERIVADA entera)

`read_sign_at_position` (LOOKOBJ `0x07e4`):

```
0900: cx=0x7d0; di=0xb21e; al=0xff; rep stosb      ; 2000 B a 0xFF
0920: push 0x74f0 ('signs.dat'); push 0xb21e; push 0x7d0; push [bp-4]; call 0x82de
0940: cmp byte ptr [si - 0x4de1], al   ; +1 vs arg [bp+8]
0949: cmp byte ptr [si - 0x4de0], al   ; +2 vs arg [bp+6]
0952: cmp byte ptr [si - 0x4ddf], al   ; +3 vs arg [bp+4]
0960: add si, 4                        ; salta la cabecera de 4 B
0963: bx=si; inc si; cmp byte [bx-0x4de2],0; jne  ; recorre el texto NUL-terminado
096d: cmp byte ptr [si - 0x4de2], 0xff            ; 0xFF = fin de tabla
```

⇒ registro = **cabecera de 4 bytes** (`+0` + tres claves de emparejamiento en `+1/+2/+3`,
comparadas contra los tres argumentos) seguida de **texto NUL-terminado**; la tabla
acaba en `0xFF`, y por eso el búfer se pre-rellena de `0xFF`. La base `0xB21E` **sí** la
ve el canal hex (`mov ax, 0xb21e`); son los CAMPOS los que sólo ve el canal negativo —
el mismo patrón que `g_combat_actor_records`.

BLCKTHRN `0x071c` carga el mismo búfer con **1000** B (`0x3e8`) en vez de 2000.

## 6. ★ `0xBCE4` — búfer de línea de TALK (DERIVADO)

Con el contador en `DS:0x4AF1`:

```
talk_emit_char   TALK 0x0574:
  0577: cmp byte ptr [0x4af1], 0x10   ; lleno a los 16
  057e: bl = [0x4af1]; 0582: inc [0x4af1]
  058b: mov byte ptr [bx - 0x431c], al ; buf[n++] = c
talk_flush_line  TALK 0x04e2:
  0503: mov al, byte ptr [si - 0x431c]; and al, 0x7f
  0555: test byte ptr [si - 0x431c], 0x80
```

⇒ búfer de **16 bytes** en `0xBCE4` con longitud en `0x4AF1`; el **bit 7** de cada byte
es marca (se enmascara con `0x7F` al consumir y se testea con `0x80` al recorrer).

## 7b. Propuesta de diseño para #68 (PENDIENTE DE GO — toca un generador)

**La pregunta «¿`size` = celdas o bytes?» ya está contestada por el código**, no es una
convención abierta: los dos consumidores de `globals_map` la tratan como BYTES —
`prev_end = addr + size` (validador de solapes) y `range(1, size)` (anotación de bytes
interiores). Un `size` que cuente celdas útiles no propone otra convención: **incumple
la que ya rige**, y su efecto es doble — anota de menos y deja pasar solapes en falso.

Pero corregir `g_vis_buffer` 121→352 choca con un hecho igual de real: `0xABC7` es a la
vez **celda interior** del búfer y **global con nombre y semántica derivada** (el tile
al sur de la party). El modelo plano actual («entradas ordenadas, prohibido solapar»)
no sabe expresar eso, y por eso el conflicto parece irresoluble cuando no lo es.

**Propuesta (3 piezas, mínima y reversible):**

1. `size` queda DECLARADA como extensión en BYTES, en el propio `globals.json` y en el
   docstring de `globals_map`. No es un cambio de comportamiento: es escribir el
   contrato que el código ya aplica.
2. `entries()` pasa de «prohibido solapar» a **«prohibido solapar PARCIALMENTE»**: una
   entrada CONTENIDA por completo en otra es legal y se llama *anidada*. El solape
   parcial (bordes cruzados) sigue siendo error — que es el defecto real que la guarda
   quería cazar.
3. `_build_globals()` anota con el nombre MÁS ESPECÍFICO: si una dirección cae en una
   anidada, gana la anidada (`g_unk_abc7`), y si no, la contenedora
   (`g_vis_buffer+165`). Así `0xABA7` gana nombre gratis sin inventar una entrada, y
   `g_unk_abc7` conserva el suyo y sus 4 refs.

Efecto sobre el ledger: `g_vis_buffer.size` 121→352; `g_unk_abc7` intacta, ahora
declarada anidada. Campo opcional `stride` (32) para dejar la geometría escrita.
Generaliza a `g_party_records` y `g_combat_actor_records`, cuyos campos con nombre
podrán registrarse sin pelearse con el validador.

## 7. Lo que este barrido NO cubre (declarado)

- Los 4 `.DRV` se excluyen: tienen su propio DS, una dirección suya no es un global del
  kernel. Sale en el informe del CLI.
- El bucket `DATA_AS_CODE` de los overlays depende de la EXTENSIÓN explorada de cada
  tabla de saltos (`TABLE_CAP` 512 B, se para en la primera palabra que no sea puntero
  de código válido). Una tabla sobre-extendida podría enterrar un acceso real; el test
  `test_ninguna_zona_de_datos_se_come_el_acceso_del_ejemplar` es la guarda, y las 15
  clasificadas así se leyeron una a una.
- `hex_visible()` es el criterio CRUDO del origen (subcadena en todo el texto, bytes de
  máquina incluidos). Es deliberadamente generoso: se usa para reproducir la cifra 40,
  no para censar. El censo fino es `hex_refs()`, a nivel de operando.
