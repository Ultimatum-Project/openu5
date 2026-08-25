# Acta #240 — el canal INDEXADO, arreglado con delta CERO + triage de los censos cerrados

Carril `re/idxrefs-240` (worktree `.claude/worktrees/idxrefs-240`), rama desde `main` @`2956df82`.
Defecto descubierto en #230 (`re/notes/eslabon-230-acta.md` §3).

**TANDA 1 de 2.** Hecho: el fix (1) y el trinquete (3), más una **triage medida** que acota el
paso (2). **NO hecha: la re-auditoría de los censos** — con el mapa ya puesto para quien la haga.

---

## 1. El fix: campo SEPARADO, y por eso el delta es CERO

`disasm._ABS_RE` es `\[0x([0-9a-f]+)\]`: sólo el operando **desnudo**. Añado
**`_IDX_RE = \[(?:[a-z]{2}\s*\+\s*)+0x([0-9a-f]+)\]`** y un campo nuevo **`Insn.idx_refs`**.

**La decisión de diseño que importa: campo SEPARADO, no mezclado en `abs_refs`.** `abs_refs` lo
consumen `routine_census`, `callers_por_banda`, `globals_map` y los `cita_*`; mezclarlo les
movería las cifras **en silencio**. Con el canal aparte, cada censo ELIGE — y la propiedad de
seguridad es **demostrable**, no prometida:

| control | resultado |
|---|---|
| **DELTA de `abs_refs`** vs la regex antigua, **77.674 instrucciones** del corpus entero | **0** |
| refs nuevas que expone `idx_refs` en todo el corpus | 1.531 |
| **POSITIVO** — pin `NPC.OVL 0x091c` | `idx_refs={0x5c5c}`, `abs_refs=∅` ✓ |
| **NEGATIVO** — 93 instrucciones `[reg − 0x…]` en CAST2 | **0** capturadas ✓ |

El negativo no es decorativo: el **desplazamiento NEGATIVO es el TERCER canal** y ya tiene
instrumento propio (`globals_negdisp.py`) con su partición de basura declarada (overrides `cs:`,
datos desensamblados como código). Si `idx_refs` se lo comiera, **duplicaría población** y
rompería esa adjudicación. Por eso `_IDX_RE` exige el `+` explícito.

## 2. El trinquete (paso 3): los tres controles, congelados

En `re/tools/test_disasm.py` — su hogar natural, donde mira quien toca `disasm.py`. Tres tests
que son exactamente los tres controles de arriba: el **pin literal** `NPC.OVL 0x091c`, la
**no-regresión** de `abs_refs` (recalculada con la regex antigua en tres overlays), y el
**negativo** con `assert vistos > 0` para que no pueda quedarse degenerado.

⚠ **`test_disasm.py` NO está en la tanda de gates estándar** (`test_frontier` + `test_genero` +
`test_cita_segmento`). Lo corrí aparte y pasa **4/4**, pero para que el trinquete GUARDE de
verdad hay que **añadirlo al comando de gates** — decisión del lead, no la tomo yo.

## 3. ★★ Triage del paso 2: medido, y una celda es MUCHO peor de lo que suponía #230

En vez de re-auditar siete censos a ciegas, medí **qué rangos tienen canal indexado no vacío**:

| rango (tarjeta) | desnudo | INDEXADO | qué significa |
|---|---:|---:|---|
| `g_vis_buffer` 0xAB02 (#68/#189/#220/#225) | 13 | **0** | este defecto NO le aplica |
| 0xAD14 (#219) | 24 | **0** | este defecto NO le aplica |
| `g_unk_24e6` (#228) | 58 | **0** | este defecto NO le aplica |
| 0x5840 «array por SLOT» (#63) | 793 | **24** | ★ RE-AUDITAR |
| **`g_dng_map` 0x595A (#134)** | **0** | **48** | ★★ **CEGUERA TOTAL** |
| `g_world_objects` 0x5C5A (#230, referencia) | 142 | 172 | ★ ya re-medido |

> **⚠ ADENDA #245 (2026-07-30).** Las cifras de la columna INDEXADO de esta tabla son
> **BRUTAS**: se escribieron antes de que el canal tuviera partición de basura. Las tres
> que se publicaron fuera de aquí están **re-medidas** con la partición en §8; y el nombre
> `g_world_objects` que usa esta fila **no existe en el ledger** — 0x5C5A está fichada
> como `g_char_anim_states` (256 B). Ver §8.4.

**La celda que hay que leer dos veces: `g_dng_map` da 0 desnudos y 48 indexados.** El instrumento
estándar no ve **ninguno** de sus 48 accesos — no es el 55 % de #230, es el **100 %**. Un censo de
`g_dng_map` con `abs_refs` concluye «**nadie lo toca**», que es un cero-en-falso perfecto. Y #134
es justamente «una rutina de RENDER **escribe** en g_dng_map»: su población vivía entera en el
canal ciego.

⚠ **Y la columna «NO le aplica» NO significa «el censo estaba completo».** Sólo dice que *este*
defecto no lo afecta. Existe al menos un **QUINTO canal** que ninguno de los dos ve: cargar la
dirección en un registro (`mov bx, 0xAB02` / `mov al, [bx]`) — ahí la dirección es un **inmediato**
y el acceso no lleva dirección alguna. Que 0xAB02 y 0xAD14 sean **búferes** con 13 y 24 accesos
desnudos y **cero** indexados es, de hecho, la firma esperable de ese patrón por puntero. **No
firmo que esos censos estén completos**; firmo que no fallan por ESTA causa.

## 4. Alcance de esta tanda

- **HECHO:** el canal `idx_refs` (delta 0 probado) · el trinquete con 3 controles · la triage de
  6 rangos que dice a quién re-auditar.
- **NO HECHO, declarado:** la **re-auditoría** de #63 y #134 (los dos ★), que es leer sus
  poblaciones nuevas y ver si mueven veredicto. Son tarjetas ajenas y trabajo de lectura, no de
  instrumento.
- **NO TOCADO:** ningún consumidor de `abs_refs`. Nadie pasa a usar `idx_refs` en este commit —
  el canal queda **disponible**, no cableado. Un censo que hoy está a la mitad **sigue a la
  mitad** hasta que su carril lo una; el fix habilita, no repara.
- **Cabo nuevo:** el QUINTO canal (dirección como inmediato en registro) está **medido de refilón
  y sin censar**. Merece tarjeta propia si alguien depende de un censo de búfer.

## 5. Gates

Desde la raíz, POST-`add`, sin pipes, EXIT por separado: `seed_gate` **0** · `pytest`
`test_frontier`+`test_genero`+`test_cita_segmento` **0** (97 passed) · **`pytest test_disasm.py`
0 (4 passed, los 3 nuevos)** · `pytest test_routine_census.py` **0** (consumidor directo de
`abs_refs`: control de no-regresión) · `genero.py` **0** · `cita_pegajosa_forma` **0** ·
`cita_pegajosa_atribucion` **0** · `globals_map.py` **0**.

---

## 6. ADENDA (encargo del lead): los tres entregables, cerrados

### 6.1 Control negativo de ESCALAR — añadido

El trinquete tenía como negativo el desplazamiento negativo; faltaba el que pediste: **un escalar
conocido con `idx_refs` vacío**. Añadido con `g_cmb_scratch_x/y` (DS 0x5876/0x5878) como pin, con
`assert desnudos > 0` para que no quede degenerado. **5/5 passed.** Es el test que acota el DAÑO
del defecto a su dominio: si se pone rojo, «el defecto sólo muerde en TABLAS» deja de valer.

### 6.2 ★ CONTROL DE NO-MOVIMIENTO — ejecutado, y es más fuerte que el delta de datos

§1 probaba delta 0 **a nivel de dato** (`abs_refs` instrucción a instrucción). Tu encargo pedía
algo mejor: **correr los consumidores y comparar su SALIDA**. Hecho, con el `disasm.py` de `main`
y con el mío sobre el MISMO árbol, restaurando siempre:

| consumidor | antes vs después |
|---|---|
| `globals_map.py` | **IDÉNTICO** ✓ |
| `cita_pegajosa_forma.py` | **IDÉNTICO** ✓ |
| `cita_pegajosa_atribucion.py` (118 líneas) | **IDÉNTICO** ✓ |

Nada se movió ⇒ **no hace falta ventana**. Es la partición-idéntica de esta familia: el delta de
dato dice que el campo no cambió; el diff de salida dice que **ningún consumidor lo notó**.

### 6.3 Re-auditoría #1 — #228 (`g_unk_24e6`): el asterisco NO lo resuelve mi canal

| | |
|---|---:|
| accesos totales | **58** |
| canal desnudo | **58** |
| **canal INDEXADO** | **0** |
| escrituras | 57 · **lecturas 1** |

Formas de escritura: **33 `or ,2`** · **21 `mov ,1`** · 2 `mov al` · 1 `mov ,0`.
Lector único: **`ULTIMA.EXE:0x595e cmp byte ptr [0x24e6], 0`**.

**Primero, un control de acuerdo:** mi medición **reproduce exactamente** las cifras publicadas en
#228 (58 accesos, 33 `or ,2`, 21 `mov ,1`). Instrumento nuevo y censo viejo coinciden en el canal
que ambos ven — que es la precondición para creerse la parte nueva.

**ADJUDICACIÓN DEL ASTERISCO: NEGATIVA, y es un resultado útil.** #228 sospechaba «falta el lector
por PUNTERO». **Mi canal no lo encuentra: 0 accesos indexados.** El «un solo lector» de #228
**aguanta bajo los dos canales**. ⇒ si ese lector existe, **no entra por indexación**: tendría que
venir por el **QUINTO canal** (dirección en registro, #242), que sigue **sin censar**.

Anotado así en #228: el canal indexado **descarta una hipótesis**, no confirma otra. Eso es lo que
puede decir esta medición y no más — y vale, porque estrecha el sitio donde buscar.

### 6.4 Lo que sigue SIN hacer

El resto de la lista de re-auditoría (**#68/#219, #63, ★★#134, #189/#220/#225, #119**) queda para
tandas siguientes, como pediste. De ésos, **#134 es el urgente**: es el único con **ceguera del
100 %** (0 desnudos / 48 indexados). Y los **~95 escritores indexados** de 0x5C5A siguen siendo
población nueva **sin adjudicar** — #228 no me llevó a ellos.

---

## 7. TANDA 2 — #63 y #134 re-auditadas, con DOS errores míos y DOS clases de basura del canal

### 7.1 ⚠ CORRECCIÓN a mi propia triage (§3): la ventana de #63 estaba MAL

En §3 publiqué «0x5840 (#63): **793 desnudos / 24 indexados**». **Es falso.** Usé una ventana de
**64 B inventada por mí**; el ledger dice que `g_moonstone_loc` mide **8 B** (0x5840..0x5847). Con
la extensión REAL:

| ventana | desnudo | indexado |
|---|---:|---:|
| **0x5840..0x5847 (la REAL, 8 B del ledger)** | **0** | **7** |
| 0x5840..0x587F (los 64 B que usé por error) | 789 | 24 |

Los 793/24 barrían **ocho globales vecinas**. Regla que me salté y que ya estaba escrita en el
canon: **el catálogo primero** — la extensión de una global se lee del ledger, no se estima.

### 7.2 #63 — es un SEGUNDO caso de ceguera del 100 %, y los 7 son justo su pregunta

`g_moonstone_loc`: **0 accesos desnudos, 7 indexados**, los siete legítimos (DS, sin override):

```
ULTIMA.EXE:0x4713  cmp byte ptr [bx + 0x5840], al
ULTIMA.EXE:0x47fd  cmp byte ptr [bx + 0x5840], 0xff
ULTIMA.EXE:0x483d  mov al,  byte ptr [bx + 0x5840]     ← el teleport de moongate que cita el ledger
CAST.OVL:0x1599    mov byte ptr [bx + 0x5840], al      ← ESCRIBE
SJOG.OVL:0x03e0    cmp byte ptr [bx + 0x5840], al
SJOG.OVL:0x1496    mov byte ptr [bx + 0x5840], 0xff    ← ESCRIBE
ZSTATS.OVL:0x09b4  cmp byte ptr [si + 0x5840], 0xff
```

**Todos indexados por SLOT** — que es literalmente lo que el título de #63 pregunta («¿array por
SLOT compartido?»). Un censo por `abs_refs` sobre esta global devuelve **cero** y sostiene
«nadie la toca». **Ceguera del 100 %, la segunda de la noche.**

### 7.3 ★★ #134 — 48 en bruto, pero **43** tras quitar DOS clases de basura DE MI CANAL

Y aquí el canal nuevo enseña sus propios límites, que **no estaban declarados** y ahora lo están:

| clase | n | qué es |
|---|---:|---|
| **(a) OVERRIDE DE SEGMENTO** | **1** | `ULTIMA.EXE:0x5af8 jmp word ptr cs:[bx + 0x5b16]` — tabla de saltos en **CS**, no dato DS. `_IDX_RE` **no mira el prefijo de segmento** ⇒ mi canal es **CIEGO AL SEGMENTO**, misma familia que #188. |
| **(b) BASE AJUSTADA AL ORIGEN DEL ÍNDICE** | **4** | `TOWN.OVL 0x001f/0x0023/0x00a1/0x00a5` con desplazamientos 0x5B56/0x5B58. Caen dentro de g_dng_map, pero son `[bx + (base−4)]` con índice 1-based sobre **`g_npc_dead_bitmap` (0x5B5A)**: el ledger lo confirma y la nota de #148 lo cita como `[0x5B56 + g_location*4]`. **Pertenecen a la global SIGUIENTE.** |
| **GENUINOS de g_dng_map** | **43** | de ellos **13 ESCRITURAS** |

Las 13 escrituras genuinas son exactamente el material de #134: `and ...,0xaf` (DUNGEON 0x00f5),
`and ...,8` (DUNGEON 0x09da/0x0df3, SJOG 0x07fa), `and ...,0xf8` (DUNGEON 0x0a9f), `or ...,8`
(SJOG 0x07be) y seis `mov` (CAST 0x00e6, DUNGEON 0x0adc, SJOG 0x07b0/0x089a/0x0d21/0x1351,
SJOG 0x181a). **Los 3 bits bajos que #134 investiga están aquí, y el censo por `abs_refs` no veía
ninguno.**

**⇒ el veredicto de #134 NO se re-litiga aquí**, pero su base de evidencia cambia de **0 accesos
visibles a 43**: quien la retome tiene por primera vez la población entera. Anotado en #134 sin
tocar su conclusión.

### 7.4 La lección que dejan las dos clases de basura

Mis cifras de §3 eran **COTAS SUPERIORES, no poblaciones**. El control positivo probó que el canal
**no es ciego**; no probó que **lo que ve sea lo que digo** — que es exactamente la lección
`sensibilidad ≠ especificidad` ya escrita en el canon, aplicada ahora a mi propio instrumento.

⇒ **`idx_refs` necesita su partición declarada**, como la tiene `globals_negdisp`: al menos
(a) override de segmento y (b) base ajustada al origen del índice. **No la implemento aquí**
(tocar el instrumento otra vez pide su propia medición de delta); queda como encargo con las dos
clases ya nombradas y con ejemplares concretos para el trinquete.

### 7.5 Lo que sigue sin hacer

#68/#219, #189/#220/#225 y #119. Y **el canal indexado sigue sin partición**: hasta que la tenga,
toda cifra suya se lee como cota.

> **⚠ ADENDA #245: esta última frase ya NO vale.** La partición existe desde
> `re/tools/idx_particion.py` (rama `re/particion-245b`) y las tres cifras publicadas están
> re-medidas mecánicamente en §8. Lo que sí sigue vivo es la lista de re-auditorías.

---

## 8. ADENDA #245 — las tres cifras RE-MEDIDAS con la partición

Escrito por el carril `re/particion-245b`. **Nada de lo de arriba se borra**: las cifras
viejas eran BRUTAS y siguen siendo el bruto correcto; lo que se añade es cuánto de ese
bruto era basura. Partición y ejemplares: `re/tools/idx_particion.py`. Trinquete:
`re/tools/test_disasm.py`.

### 8.1 Las tres cifras: vieja (bruta) vs nueva (genuina)

| global (ventana del LEDGER) | §  | vieja = BRUTO | **nueva = GENUINO** | basura |
|---|---|---:|---:|---|
| 0x5C5A `g_char_anim_states` (0x5C5A..0x5D59) | §3 | 172 | **172** | **0** |
| `g_dng_map` 0x595A (0x595A..0x5B59) | §7.3 | 48 | **43** | 1 (a) + 4 (b) |
| `g_moonstone_loc` 0x5840 (0x5840..0x5847) | §7.2 | 7 | **7** | **0** |

El **43** es el control de ACUERDO: §7.3 lo leyó accediendo caso por caso, y la partición
lo reproduce **mecánicamente y con los mismos cinco ejemplares**. Reproducirlo es lo que
permite creerse los otros dos, que nadie había leído contra las clases.

⇒ **§7.2 y §7.3 quedan CONFIRMADAS tal como están.** La única lectura que cambia es la de
§7.4: «mis cifras eran cotas superiores» era cierto como advertencia, pero medido resulta
que **dos de las tres eran ya la población exacta**. La basura no estaba repartida: estaba
concentrada en `g_dng_map`, y por una razón geométrica (es la vecina de abajo de
`g_npc_dead_bitmap`, que se indexa 1-based).

### 8.2 La partición del corpus entero — y una CLASE que #245 no había nombrado

| bucket | n | % |
|---|---:|---:|
| `SEG_OVERRIDE` (clase (a)) | 21 | 1,4 % |
| ★ **`FUERA_VENTANA_DS`** (clase NUEVA) | **442** | **28,9 %** |
| `DATO_COMO_CODIGO` | 7 | 0,5 % |
| `BASE_AJUSTADA` (clase (b)) | 12 | 0,8 % |
| `GENUINO` | 1.049 | 68,5 % |
| **SUMA** | **1.531** | = el bruto de §1 |

La clase nueva es la más grande: `_IDX_RE` no tiene cota inferior, así que casaba
`[bp + 0x6]` (local de pila) y `[bx + 0x4]` (campo de struct) igual que `[si + 0x5c5c]`.
**No toca ninguna de las tres cifras** —las tres se miden por ventana y las tres ventanas
están muy por encima de 0x100— pero sí invalida cualquier lectura del **1.531** como
«refs nuevas»: las refs nuevas a DS son 1.049 + 12, no 1.531.

Los 7 de `DATO_COMO_CODIGO` son la firma ya descrita en `globals_negdisp` (seis `fsubr` /
`fmul` de FPU en ULTIMA.EXE 0x82xx-0x83xx: U5 no tiene una sola instrucción de FPU).

### 8.3 ★ La clase (b) también SUMA, y ahí hay un cero-en-falso NUEVO

§7.3 leyó la clase (b) sólo como resta. Es la mitad: un acceso base-ajustado **le
pertenece a la global SIGUIENTE**, así que a esa hay que dárselo. Medido:

- `g_npc_dead_bitmap` (0x5B5A): **0 genuinos por ventana, +4 atribuidos** (los cuatro de
  TOWN.OVL que §7.3 restó de g_dng_map).
- ★ `g_npc_met_bitmap` (0x5BDA): **0 accesos indexados por ventana** —o sea «nadie la
  toca»— y sin embargo **TALK.OVL la escribe/lee cuatro veces** por
  `[0x5BD6 + g_location*4]` (TALK 0x0d6c/0x0d70/0x0d9e/0x0da2), el gemelo EXACTO del
  ejemplar de TOWN. Es un cero-en-falso del mismo género que los de §7.2 y §7.3, y estaba
  **fuera** del radar de #240.

### 8.4 ⚠ El nombre `g_world_objects` no está en el ledger

#230 y esta acta llaman `g_world_objects` a 0x5C5A. `globals.json` la ficha como
**`g_char_anim_states`, 256 B** («animation states de los characters del entorno actual»),
y 0x5C5A **no tiene `old_names`**. La VENTANA que usó #240 (0x5C5A..0x5D59) es la del
ledger y es correcta —el 172 no se mueve por esto—, pero el NOMBRE citado no existe. Con
#230 leyendo ahí campos de NPC (+2 = X) y el ledger diciendo «animation states», o el
ledger va corto o el nombre de las actas es inventado. **No se adjudica aquí**: queda como
cabo, porque tocar una entrada del ledger no es trabajo de esta tarjeta.

### 8.5 Controles corridos (los de esta adenda, no los de #240)

- **NO-MOVIMIENTO del instrumento compartido**, con el `disasm.py` de `main` y el nuevo
  sobre el MISMO árbol: SHA-256 del volcado de las **62.701** instrucciones del corpus
  (addr + bytes + mnemónico + op_str + `abs_refs` + `call_targets`) **IDÉNTICO**, y el de
  `idx_refs` **también IDÉNTICO** ⇒ delta 0 en los dos canales. Salida de `globals_map`,
  `cita_pegajosa_forma` y `cita_pegajosa_atribucion` (118 líneas): **IDÉNTICA** las tres.
- **SENSIBILIDAD del trinquete** (verlo SUSPENDER, no sólo verlo verde): re-cegar al
  segmento ⇒ 1 rojo · desactivar la clase (b) ⇒ 2 rojos · sobre-filtrar mandando todo a
  basura ⇒ 2 rojos (uno de ellos el de no-sobre-filtrado). Restaurado ⇒ 11 verdes.
