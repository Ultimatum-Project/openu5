# globals-98 · ACTA — las globales de la cola de heredados, con ficha en el ledger

Carril `globals-98` · 2026-07-28 · rama `re/globals-98`.
Tarjeta #98. `re/ledger/globals.json`: **172 → 193** entradas (21 altas) + **2 anchuras corregidas**.

> Verificada con `re/tools/seed_diff.py`: 0 sembradas, 0 cambiadas.

---

## 1. La cola eran VEINTIUNA, no diecisiete ni veinte

La tarjeta dice 17 y el encargo del lead dice ~20. Las dos cifras salen de un
**error de arrastre** en el recuento, y conviene dejarlo escrito porque el número
es lo único que se hereda cuando nadie relee las actas:

| acta | añade | acumulado real | acumulado que declaró el acta |
|---|---|---|---|
| heredados-168 tanda 3 | 9 | 9 | «nueve» ✓ |
| heredados-168 tanda 4 | 1 (`0xBB17`) | 10 | — (no lo sumó) |
| heredados-168 tanda 6 | 8 | 18 | «con las nueve anteriores van diecisiete» ✗ |
| heredados-b tanda 1 | 3 | **21** | «con las diecisiete van veinte» ✗ |

La tanda 6 sumó *«las nueve de las tandas anteriores»* — que era el total de la
tanda 3, no el de la tanda 4. `0xBB17` (el latch de carga de gráficos de mazmorra)
se cayó del contador ahí y ya no volvió. **Está dado de alta igual.**

---

## 2. Las 21, con censo de los CUATRO canales

Canales del instrumento unificado `re/tools/globals_negdisp.py`:
**C1** hex de operando · **C2** símbolo · **C3** complemento a dos (desplazamiento
negativo) · **C4** base indexada (`covered_by_base`). Un cero de un canal no es
evidencia: `0xBCE4` es el ejemplar — **C1 = 0 y C2 = 0**, y tiene tres accesos
reales que sólo ve C3.

R1 (discriminador de puntero de texto de `routine_census.resolve_string`) devuelve
`None` para las 21: **ninguna es un puntero al pool de cadenas**, que es el falso
positivo clásico de un censo de direcciones DS citadas.

| DS | nombre | size | qué es | cuerpo que la identifica | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|---|---|---|
| `0x15FC` | `g_attack_values` | 55 | daño base por id de equipo; valor 0 = puerta | COMBAT `0x05c5`, `0x12f1` | 3 | 0 | 0 | 2 |
| `0x17F6` | `g_equip_name_ptrs` | 96 (paso 2) | 48 punteros a nombre de equipo | COMBAT `0x0600` | 8 | 0 | 0 | 2 |
| `0x1D1A` | `g_gem_tile_category` | 256 | tile → categoría de gem (17) | LOOKOBJ `0x0f88` | 1 | 0 | 0 | 1 |
| `0x3822` | `g_gem_coast_pattern` | 16 | trama de ribera por nibble bajo | LOOKOBJ `0x0d1b` | 1 | 0 | 0 | 3 |
| `0x3832` | `g_gem_path_mask` | 7 | máscara de camino, tiles `0x20`-`0x26` | LOOKOBJ `0x0ea9` | **0** | **0** | **0** | 3 |
| `0x4AF1` | `g_talk_word_len` | **2** | contador del acumulador de palabra | TALK `0x0577`, `0x0582` | 8 | 0 | 0 | 1 |
| `0x4AF3` | `g_talk_column` | 1 | columna de impresión, ajusta a 15 | TALK `0x051a` | 3 | 0 | 0 | 1 |
| `0x58E0` | `g_dng_level_bits` | 16 | 1 bit por (mazmorra, nivel) | DNGLOOK `0x08c9` | 2 | 0 | 0 | 1 |
| `0x6DA0` | `g_str_comma_space` | 3 | la cadena `", "` | COMBAT `0x05d2` | 1 | 0 | 0 | 0 |
| `0xAD14` | `g_cbt_room_record` | 352 (paso 32) | el registro `.CBT` entero | COMBAT `0x11a2` | 13 | 0 | 20 | 2 |
| `0xAD1F` | `g_cbt_trigger_tile` | 8 | tile a estampar | COMBAT `0x113e` | 1 | 0 | 0 | 3 |
| `0xAE1F` | `g_cbt_trigger_x` | 8 | X del disparador (arg 1) | COMBAT `0x1138` | 1 | 0 | 1 | 2 |
| `0xAE27` | `g_cbt_trigger_y` | 8 | Y del disparador (arg 2) | COMBAT `0x113b` | 1 | 0 | 1 | 2 |
| `0xAE3F` | `g_cbt_trigger_pos1_x` | 8 | destino A, índice menor | COMBAT `0x1143` | 1 | 0 | 0 | 2 |
| `0xAE47` | `g_cbt_trigger_pos1_y` | 8 | destino A, índice ×32 | COMBAT `0x1148` | 1 | 0 | 0 | 2 |
| `0xAE5F` | `g_cbt_trigger_pos2_x` | 8 | destino B, índice menor | COMBAT `0x114d` | 1 | 0 | 0 | 2 |
| `0xAE67` | `g_cbt_trigger_pos2_y` | 8 | destino B, índice ×32 | COMBAT `0x1152` | 1 | 0 | 0 | 1 |
| `0xB21E` | `g_text_scratch` | 1 ⚠ | búfer de texto COMPARTIDO | COMBAT `0x05d5` + TALK `0x075e` | 53 | 0 | 26 | 0 |
| `0xBB17` | `g_dng_gfx_latch` | 1 | banderas de carga de gráficos | DNGLOOK `0x10ab` | 11 | 0 | 0 | 7 |
| `0xBCDE` | `g_talk_script_ip` | 2 | puntero de instrucción del script TLK | TALK `0x0788` | 27 | 0 | 0 | 0 |
| `0xBCE4` | `g_talk_word_buf` | 16 | búfer de 16 B del acumulador | TALK `0x058b` | **0** | **0** | **3** | 0 |

---

## 3. ★ El hallazgo estructural: las ocho de la tanda 6 no son ocho globales

Los siete arrays de disparador y su base **no son objetos independientes**: son
campos interiores de UN registro, el mapa de combate `.CBT` cargado plano en
`DS:0xAD14`. Y viven, literalmente, en el **relleno del paso**.

El registro son 352 B = 11 filas × 32. La rejilla de tiles ocupa las columnas
0..10 de cada fila; **las columnas ≥ 11 sobran**, y ahí es donde el formato mete
sus metadatos. Los siete offsets caen exactamente en las columnas 11 y 19 de las
filas 0, 8, 9 y 10:

| DS | offset | fila | col |
|---|---|---|---|
| `0xAD1F` | +11 | 0 | 11 |
| `0xAE1F` | +267 | 8 | 11 |
| `0xAE27` | +275 | 8 | 19 |
| `0xAE3F` | +299 | 9 | 11 |
| `0xAE47` | +307 | 9 | 19 |
| `0xAE5F` | +331 | 10 | 11 |
| `0xAE67` | +339 | 10 | 19 |

**Tres señales independientes** lo sostienen, y ninguna es el propio ASM
citándose a sí mismo:

1. **La aritmética del escritor.** COMBAT `0x119b`-`0x11a2`: `mov cl,5` / `shl bx,cl`
   / `add bx,cx` / `mov byte ptr [bx - 0x52ec], al`, con `(-0x52ec)&0xFFFF = 0xAD14`.
   Paso 32, confirmado.
2. **Los bytes del fichero.** `original/u5/ultima5/BRIT.CBT` son 5632 B = 16 × 352,
   y en el registro 0 las columnas 0..10 son tiles y las ≥ 11 metadatos. Comprobado
   volcando el registro, no supuesto.
3. **El extractor del port.** `extractor/src/parsers/combatmap.ts:72-85` declara
   `MAP_BYTES=352, ROW_BYTES=32, GRID=11` y `at(row,col)=data[base+row*32+col]`;
   `:142-148` nombra `sprite / at / pos1 / pos2` en esas mismas casillas.

Y hay una **cuarta corroboración gratis, por aritmética pura**: los tres pares
`(x, y)` están separados exactamente 8 B (`+267/+275`, `+299/+307`, `+331/+339`).
El tope de ocho disparadores sale del `mov dx,8` de `0x115c`, pero el
**espaciado lo confirma sin leer el bucle**.

⇒ Por eso `0xAD14` entra con `size=352, stride=32` y los siete como entradas
**ANIDADAS**, que es la forma que fijó la tarea #68 (`g_vis_buffer @0xAB02`,
mismo paso 32). `g_unk_adb9` (+165 = fila 5, col 5, una celda de la rejilla)
queda anidada también. **Cero solapes parciales** en todo el fichero: comprobado.

### 3.1. Sobre el eje X/Y — lo que fija este cuerpo y lo que no

El cuerpo fija **la posición del argumento** (`0xAE1F` contra `[bp+6]`, `0xAE27`
contra `[bp+4]`) y **cuál índice escala**: `0xAE47` y `0xAE67` van por `shl 5`
(el paso), `0xAE3F` y `0xAE5F` se suman sin escalar. **No fija los nombres
«x» e «y».** Ésos vienen del extractor y de
`re/notes/trigger-sala-impacto-distancia.md:49-62`, y este cuerpo los
**corrobora** (la Y es la que escala por el paso, o sea la fila). Lo escribo así
a propósito: el proyecto ya se comió una transposición (#70) por rellenar ese
hueco con una suposición razonable.

---

## 4. ★ `0x3812` NO EXISTE: era una BASE SESGADA

La cola de heredados-b tanda 1 pedía dar de alta `DS 0x3812`, «máscara de conexión
de camino, indexada por el tile ENTERO». **No hay ninguna tabla en `0x3812`, y
darla de alta habría creado un objeto fantasma.**

La instrucción es LOOKOBJ `0x0ea9` `mov al, byte ptr [bx + 0x3812]` con `bx` = el
tile **sin enmascarar**. Pero el dominio de `bx` no es 0..255: a esa rutina sólo
se llega por la rama de **categoría `0x10`** del despachador del gem
(LOOKOBJ `0x10e7`-`0x10ea` `cmp ax,0x10` / `je 0x1096`), y en los bytes de
`DATA.OVL` la categoría `0x10` son **exactamente los tiles `0x20`..`0x26`**.

⇒ direcciones efectivas `0x3812+0x20` .. `0x3812+0x26` = **`0x3832`..`0x3838`**,
7 bytes. `0x3812` **nunca se lee**: es `0x3832 - 0x20`, el sesgo del primer tile.

Dos comprobaciones más, por si el argumento del dominio no convenciera:

- Los 16 bytes que **sí** hay en `0x3812` son ocho **words** de paso uniforme
  `0x12` (`0x739a, 0x73ac, … 0x7418`). Eso no es una tabla de máscaras de un byte.
- Los 16 siguientes (`0x3822`) son ya `g_gem_coast_pattern`. Es decir: haber
  entrado `0x3812` con la extensión que sugería su descripción («indexada por el
  tile entero» ⇒ 256 B) **se habría tragado entera la tabla de ribera vecina**.

`0x3822`, en cambio, **sí es exacta**: `and bx, 0xf` en `0x0d17` acota el índice
a 0..15, así que sus 16 B son derivados, no estimados. Los 19 tiles de categoría
`0x0A` dan 14 nibbles distintos, todos dentro de `0x3822`..`0x3831`.

**Y un aviso para el instrumento:** censada en su dirección real, `g_gem_path_mask`
da **CERO por los tres canales directos** (C1 hex 0, C2 símbolo 0, C3 negativo 0) —
porque su única lectura la nombra por la base sesgada, 32 bytes más abajo. Es un
caso que ninguno de los cuatro canales encuentra por sí solo: hizo falta acotar el
**dominio del índice**. Si alguien barre direcciones y firma «0 refs» sobre ésta,
el cero vuelve a ser del método.

**La regla que deja esto:** una constante en un operando `[reg + K]` es un
**desplazamiento**, no una dirección de objeto. Para que `K` sea el origen de un
array hace falta que el índice llegue a valer 0, y eso se demuestra acotando el
DOMINIO del índice, no leyendo la instrucción.

---

## 5. Tres etiquetas heredadas que los cuerpos NO sostienen

Ninguna de las tres se ha «corregido en silencio»: van escritas en el `meaning`
de su entrada, con la etiqueta vieja citada al lado.

1. **`0xB21E` no es «el búfer del mensaje de COMBATE»** (tanda 3). Es el búfer de
   texto compartido del kernel: COMBAT compone ahí el mensaje de arma, **TALK
   guarda ahí el script TLK** — `0x075e` `mov word ptr [0xbcde], 0xb21e`, o sea
   que `g_talk_script_ip` arranca apuntando a él — y **FONT lo lee para pintarlo**
   (seis accesos negativos `[bx|si - 0x4de2]`). Tres subsistemas, un búfer.

2. **`0x58E0` no es un «bitmap de celdas visitadas»** (tanda 3). El índice de bit
   es `(idxMazmorra << 4) | [bp+4]`: **16 ranuras por mazmorra**, que no dan para
   celdas. Lo que indexa es el par (mazmorra, nivel). Qué *significa* el bit
   —visitado, mapeado— este cuerpo no lo fija, y así queda escrito.

3. **`0x6DA0` no es «la cadena de prefijo»** (tanda 3). Sus bytes son
   `2c 20 00` = `", "`, y el strcat que la usa está bajo la guarda de COMBAT
   `0x05cc`, o sea `cmp word ptr [bp+4],0` / `je`: sólo se emite **entre** armas de una
   lista. El `", armed with "` que da nombre al mensaje es la cadena **vecina**,
   en `0x6DA4`.

---

## 6. La familia #68: `g_cmb_scratch_x` / `_y` eran `size=1` y se escriben a word

Corregidas a `size=2`, sin tocar `name` ni `old_names`.

LOOKOBJ `0x0aa9`, con bytes `a37658`, es `mov word ptr [g_cmb_scratch_x], ax`; y
`0x0ab6`, con bytes `a37858`, es el de `_y` — opcode `A3` = `MOV moffs16, AX`,
escribe 2 B. También BLCKTHRN `0x00ac`/`0x00b2` `inc`/`dec word ptr`. Están
separadas justo 2 B, así que la separación ya lo insinuaba y la instrucción lo
prueba. Criterio de la tarea #68: **`size` es la EXTENSIÓN ESCRITA**, no la
anchura semántica del uso — `re/notes/lookobj.md:66` las llama «un BYTE de scratch
de combate» y para su uso en combate es cierto; lo que falla es la anchura del slot.

**Y sale una tercera de la misma familia, que no estaba en ninguna cola:**
`0x4AF1` (`g_talk_word_len`) se lee y se resetea como **byte** en cuatro sitios,
pero se incrementa en TALK `0x0582`, cuyos bytes `ff06f14a` son `inc word ptr` — `FF /0` es
`INC r/m16`, **2 B escritos**. Entra con `size=2`, y eso **explica por qué
`g_talk_column` está en `0x4AF3` y no en `0x4AF2`**: el byte de en medio absorbe
el acarreo. La cifra encaja con el layout, que es la clase de confirmación que no
se puede fabricar.

---

## 7. GATES — 6 ROJOS, todos de TRINQUETE, y NO los he tocado

```
python3 -m pytest re/tools/test_globals.py re/tools/test_globals_negdisp.py -q
EXIT = 1     (43 pasan, 6 fallan)
```

Los seis fallaban **porque el trabajo estaba hecho**: eran trinquetes que fijaban
«estas direcciones NO están en el ledger», y #98 las mete. Ninguno señalaba un
defecto de las altas — de hecho **cuatro de los seis eran el instrumento
confirmando las derivaciones por su cuenta**: el censo redescubre solo que
`0xBCE4` es sólo-negativa y que el registro `.CBT` tiene celdas interiores que
únicamente ve C3.

`re/tools/*.py` estaba **EMBARGADO** hasta #84/#81. El lead **levantó el embargo de
forma acotada** el 2026-07-28, sólo para estos seis trinquetes y el comentario del
cuarto canal. Recalibrados en el **segundo commit** de la rama, cada uno **con la
razón dentro** (regla vigente: un trinquete sólo se recalibra con su porqué escrito
al lado):

| test | de | a |
|---|---|---|
| `test_globals.py::test_hay_globales_del_ledger_que_SOLO_ve_el_tercer_canal` | conjunto de 4 | 9: + `g_talk_word_buf`, `g_cbt_room_record+160/+171/+192/+224` |
| `…negdisp::test_tres_direcciones_que_un_censo_de_DOS_canales_da_por_CERO` | ídem (4) | el mismo conjunto de 9 |
| `…negdisp::test_el_canal_negativo_toca_cuatro_globales_del_ledger` | conjunto de 4 | 9: + `g_text_scratch`, `g_cbt_room_record`, `g_cbt_trigger_x`, `g_cbt_trigger_y`, `g_talk_word_buf` |
| `…negdisp::test_trinquete_de_conteos` | `named == 3`, cola 10 | `named == 8`, cola 5 (`invisible_live` sigue en 13, `ptr` en 0) |
| `…negdisp::test_trinquete_del_censo_de_stride` | `== 16` | `== 18` (entran `0x17F6` paso 2 y `0xAD14` paso 32) |
| `…negdisp::test_cuarto_canal_…_y_YA_esta_en_el_ledger` | `CBT_BASE not in declaradas` | `in declaradas` **+ un aserto nuevo**: que `scaled_index_refs` la ve |

Dos apuntes sobre cómo se han recalibrado:

- **El sexto estaba escrito previendo este día.** Su aserto decía literalmente
  *«0xAD14 ya está declarada: actualizar el comentario del cuarto canal, porque el
  argumento de por qué `scaled_index_refs` no la veía cambia»*. No lo he dejado en
  un booleano invertido: ahora afirma el **cierre** —la base es visible por las dos
  vías, indexada Y declarada— y protege lo mismo que antes, que nadie borre la
  entrada del registro `.CBT` y deje huérfano el argumento del canal.
- **El comentario del cuarto canal** en `globals_negdisp.py` decía «0xAD14, que ni
  siquiera tiene entrada en globals.json». Reescrito dejando explícito que el
  diseño «bases MEDIDAS, no declaradas» **sigue siendo el correcto** —el canal
  existió justamente porque el ledger iba por detrás del binario, y volver a
  apoyarlo en el ledger reintroduciría el defecto— y que el caso testigo (filas 2,
  3, 4 y 8) se mantiene intacto.

### 7.1. El verde NO se ha dado por bueno: control negativo

Un trinquete recién recalibrado a verde no vale nada hasta **verlo suspender**.
Quité del ledger, una por una y restaurando después, tres de las altas y volví a
correr la batería:

| global retirada | resultado |
|---|---|
| `g_cbt_room_record` (`0xAD14`) | **EXIT=1**, falla |
| `g_talk_word_buf` (`0xBCE4`) | **EXIT=1**, falla |
| `g_equip_name_ptrs` (`0x17F6`) | **EXIT=1**, falla |

Restaurado el fichero: **49/49, EXIT=0**. Los trinquetes siguen mordiendo; no son
decorativos.

### 7.2. Lo que NO he tocado, y que queda apuntado

Dos **nombres de función** quedaron obsoletos y los he dejado como estaban, porque
renombrarlos excede el permiso acotado (y un rename puede romper selectores):
`test_el_canal_negativo_toca_cuatro_globales_del_ledger` afirma ahora un conjunto
de **nueve**, y `test_tres_direcciones_que_un_censo_de_DOS_canales_da_por_CERO`
también nueve — éste ya mentía antes de #98, porque asertaba cuatro. Es deriva
prosa-contra-hecho de la misma familia que caza el carril prosa-autofiel, y quien
tenga #84/#81 abierto puede arreglarla en dos líneas.

---

## 8. Cola que dejo apuntada

1. **`g_text_scratch` (`0xB21E`) sin extensión.** Entra con `size=1` de marcador y
   así declarado. Es un búfer de cadena de longitud dinámica; la cota superior es
   2038 B hasta `g_combat_actor_records`. Consecuencia medida: `0xB21F`, `0xB220`
   y `0xB221` siguen en la cola de invisibles-sin-nombre y son casi con seguridad
   bytes suyos. Derivar la extensión los absorbería los tres.
2. **Qué significa el bit de `g_dng_level_bits`** — visitado, mapeado, o vista de
   la gema. El par que indexa está derivado; el predicado no.
3. **El otro camino de `0x58E0`.** La rutina `0x0844` tiene una rama previa que
   busca en la tabla `DS:0x383A` (hasta `[0x3840]` entradas) con la clave
   `(g_location & 0xF) << 4 | nivel`. Es la del guarda de la tarea #33 y **no está
   derivada**: no sé qué hace la tabla `0x383A` ni por qué hay dos vías.
4. **`0x3840` y `0x383A`** no tienen entrada en `globals.json`. Salen de este mismo
   cuerpo y no las he dado de alta porque no las he leído: sería exactamente el
   defecto que denuncia el §4.
5. **`0x6DA4`** (`", armed with "`) tampoco tiene entrada. Vecina de `0x6DA0`, misma
   familia, sin lector leído por mí.
