# #59 — Los 4 marcadores por cuerpo, y el defecto del corpus del trinquete

Acta del carril `re/renombres-59`. Dos cosas: (1) la adjudicación de los marcadores
que quedaban de verdad, con la corrección del encargo; (2) un **defecto sistémico del
instrumento de #36** que encontré al pasar los gates y que NO he tocado, porque cambiar
el criterio mueve la línea base de todo el mundo y eso lo decide el lead.

---

## 1. El «18» estaba medido contra el artefacto equivocado

El encargo pedía renombrar «los 18 marcadores TIER-1 nuevos **del censo**». Los 18
salen de `re/notes/routine-census.json` (886 filas), que es la **ENTRADA** de
`frontier.py`. El **dueño** es `re/ledger/frontier.json`, donde la capa manual
(`frontier-manual.json`) ya pisa el nombre. Corriendo el trinquete sobre cada uno:

| artefacto | rutinas TIER-1 | nombres distintos |
|---|---|---|
| `re/notes/routine-census.json` (entrada) | 23 | 18 |
| `re/ledger/frontier.json` (dueño) | **4** | 4 |

Las otras 19 rutinas **ya estaban renombradas por cuerpo**: `ernel`→`combat_actor_take_damage`,
`ttack`→`dng_attack`, `xffff`→`beep_ticks`, `fn36`→`clock_driver_notify`, `paso`→`dng_move`,
`mismo`→`use_scroll`, `primitiva`→`gfx_blit_sel60`, `tabulado`→`cmd_combat_escape`,
`helpers`→`text_accum_char`, `cierre`→`big_planar_reveal_fn32`, `luego`→`read_order_header`,
`viento`→`randomizer`, `declarado`→`putchar`, `residente`→{`gfx_fill_rect`,
`gfx_fill_rect_sel3f`, `bytecode`}, `rutina`→{`jump_table_and_mask_tables`,
`outsubs_waterfall_fall`, `combat_absorb_shadow`, `draw_7_centered_rows`}. Renombrarlas
habría rehecho trabajo hecho y arriesgado **pisar nombres buenos**.

**Y el roster transcrito traía dos errores.** Incluía `celda` —que YA estaba en
`PLACEHOLDER_NAMES`, o sea que no era nueva— y omitía `declarado` (ULTIMA.EXE 0x16ba).
Deshecha la sustitución, el cardinal vuelve a dar 18 exacto: **la cifra era buena y la
lista no**. Es el género de «una lista que el instrumento calcula se VUELCA, no se
transcribe», esta vez con la ironía de que el intruso (`celda`) resultó ser justo el
nombre inestable de la §3.

## 2. Los 4, por lectura de cuerpo entero

Las citas instrucción-a-instrucción viven en `frontier-manual.json` (nota
`renombres-59-cuerpo`). Aquí sólo la conducta y lo que corrige. Los cuatro llamadores
corroboran de forma independiente, y ninguno se usó para *derivar* el nombre.

| rutina | era | es | llamador (corrobora) |
|---|---|---|---|
| ULTIMA.EXE 0x1068 | `dentro` | `fx_tile_fizzle_in` | `moongate_enter` 0x48a8 |
| ULTIMA.EXE 0x4a84 | `tira` | `draw_sky_strip` | `advance_clock` 0x4f7c |
| ULTIMA.EXE 0x5d0a | `allers` | `vis_buffer_build` | `viewport_redraw` 0x5910 |
| ULTIMA.EXE 0x68ae | `durmiente` | `combat_actor_sleep` | `apply_sleep_unless_poisoned` 0x6880 |

### 2.1 ★ 0x1068 — el nombre estaba colgado del hermano equivocado

El cuerpo es un bucle de 256 pasos que llama al selector 0x66 con `stc`. La tabla de
saltos `EGA.DRV` 0x66 (`e9 02 25`) lleva a 0x256b, y **en 0x256b hay `73 03` = JNC**
seguido de `e9 46 01`:

- **carry PUESTO** (este llamador, `stc`) → NO salta → entra en **0x26b6**;
- **carry limpio** (el hermano ULTIMA.EXE 0x0f46, que hace `clc`) → salta → **0x2570**.

**Son dos ramas distintas del mismo selector.** La rama STC guarda `di` como índice de
paso y avanza un LFSR de 8 bits (`shr dx,1 / jae / xor dx,0xb8`) cuyo nibble alto es la
fila y el bajo la columna: 16×16 = 256 celdas, que es exactamente el `cmp di,0x100` del
bucle; y `si<<7` = índice de tile × 128 B = un tile EGA 16×16 de 4 planos. **Revela UN
TILE, una celda por llamada.** La rama CLC es la que barre un **rectángulo arbitrario**
(calcula ancho×alto y elige el polinomio del LFSR en una tabla por número de bits).

Consecuencias para el corpus:

- `camp-apparition-scene.md:25` lo llama **`fx_screen_wipe`** y `wind-rand-decision.md:92`
  lo cita como «wipe de pantalla … cada transición de mapa». El paréntesis de
  camp-apparition («revelado LFSR de un tile en celda») **es correcto**; el nombre no.
  El barrido de pantalla es la OTRA rama, cuyo único llamador es **0x0f46 — hoy llamado
  `wrapper`, marcador TIER-2 sin adjudicar**. O sea: el nombre bueno está puesto en la
  rutina que no es, y la que sí lo merece sigue con nombre-basura.
- La afirmación «llama `0x5910` cada 8 de sus 256 pasos» es **CONDICIONAL**: sólo ocurre
  con `g_location != 0x42` (`0x10c0 jne`); con `g_location == 0x42` esos mismos 8 pasos
  sondean vía 0x81ba(1) y pueden **abortar** sin repintar. El cálculo de «~32 rands de
  viento por revelado» de `wind-rand-decision.md` hereda esa condición.

### 2.2 0x4a84 → `draw_sky_strip`

Monta 12 caracteres en pila (`mov ax,0x2020 / cx=6 / repne stosw`) y coloca tres cuerpos
cuya posición depende de la HORA: el **sol** (`'*'`, 0x2a) en `17-g_hour`, y otros dos en
`8-g_hour` y `2-g_hour` (con envoltura `+0x18`), cuyos glifos salen de una tabla de **2
bytes POR DÍA** en 0x1ED8 — las fases de las **dos lunas**. Pinta con `text_gotoxy(0,6)`
+ `putchar`, con color distinto para el `'*'`. Bajo tierra (`g_location==0x19` o
`g_floor>=0x80`) **no dibuja la tira**: tapa la banda con `gfx_fill_rect`+`gfx_draw_line`.

### 2.3 0x5d0a → `vis_buffer_build` — y un dato duro para #68

Rellena `g_vis_buffer` (0xAB02) a 0xFF en **11 filas de 11 bytes con paso 0x20**, y luego
o llama a `los_flood` 0x5a28 sobre la ventana 11×11 **centrada** (de ahí los `-5`), o —en
modo negativo— la rellena con el tile crudo vía `get_tile_ptr`, escribiendo 0xAB02 como
**desplazamiento negativo** (`[bx+si-0x54fe]`).

> **Para #68**: el cuerpo fija la geometría sin ambigüedad. Último byte **escrito** =
> `0xAB02 + 10*32 + 10`, luego la extensión ocupada es **331 bytes** (0xAB02–0xAC4C).
> No 121 (que cuenta sólo las celdas útiles e ignora el paso) **ni 352** (que serían 11
> pasos completos, pero el paso número 11 nunca se escribe). Las dos vías de escritura
> del cuerpo —el relleno 0xFF y la copia de tiles— coinciden en la misma rejilla.

### 2.4 0x68ae → `combat_actor_sleep`

Sobre `g_combat_actor_records` (0xBA14, registros de 8 B) bifurca en `test byte [bx+2],0x80`.
Con el bit puesto escribe `'S'` (0x53) en la columna de estado de `g_party_records` salvo
que ya sea `'D'` (0x44, muerto); con el bit limpio va por la rama no-PC. **En las dos
ramas escribe `g_cmb_result_flags = 4`**, y `globals.json` documenta ese campo, por vía
independiente de este cuerpo, como «1 killed, 2 vanished, **4 slept**…».

**No derivado y declarado**: el significado exacto de los inmediatos `0x1e` y `0xff` que
escribe en `g_char_anim_states` (plausiblemente duración y centinela) queda sin cerrar.

## 3. ★ DEFECTO DEL INSTRUMENTO: la prosa española del REPO desarma el criterio

Al pasar los gates, `test_genero` sale rojo, **y no por mis cambios**. Diagnóstico
completo, midiendo el MISMO censo (que nadie tocó) con dos corpus distintos:

| corpus de prosa/código | TIER-1 | TIER-2 |
|---|---|---|
| base de mi rama (1215a0c5) | **33** (tope 32 → ROJO) | 35 (tope 34 → ROJO) |
| main (3943fe00) | 32 (verde) | **36** (tope 34 → ROJO) |
| diferencia | — | `celda` pasa de TIER-1 a TIER-2 |

**Causa exacta**: hoy aterrizó en main un test cuyo nombre de función es
`test_la_celda_central_y_la_de_debajo_caen_en_el_buffer`
(`re/tools/test_globals_negdisp.py`). `genero.build_corpora` trocea los `def` de
`re/tools/*.py` por `_` y mete las piezas de ≥3 letras en el **corpus de CÓDIGO**; así
`celda` entró en `self.code`, y `r4b_prose_word_not_in_code` **exonera** por diseño todo
lo que el código usa como identificador. Resultado: la rutina `celda` (FONT.OVL 0x2a2)
dejó de dispararse en TIER-1.

Por qué importa, más allá de los dos topes:

- La premisa entera de TIER-1 es «palabra **castellana** de la prosa que el **port** NO
  usa como identificador». El corpus de código existe para aportar el vocabulario
  TÉCNICO que el diccionario inglés de 1934 no trae (`byte`, `pixel`, `opcode`) — lo dice
  el propio comentario de `_english_compound`. Un **nombre de test escrito en español**
  no es vocabulario técnico del port: es la misma prosa castellana, entrando por la
  puerta de atrás y **desarmando la regla precisamente para la palabra que la regla
  buscaba**.
- Es autoinfligido y silencioso: basta que alguien nombre en español un test o un helper
  en `re/tools/` para que el trinquete deje de ver ese género de marcador. Ningún gate
  avisa de la exoneración; lo único que se ve es un tope que baja.
- Hoy no contamina la métrica del ledger (FONT.OVL 0x2a2 ya está renombrada a
  `font_draw_viewport_cell`), así que el daño medido es al **criterio**, no al censo.

**NO LO HE ARREGLADO, a propósito.** El arreglo natural —excluir `re/tools/test_*.py`, o
mejor, quedarse sólo con los identificadores de `game/src` y `extractor/src`, que son el
port de verdad— **mueve las dos líneas base de #36** y hay que re-medir las garantías 1 y
2 del criterio. Eso es una recalibración del instrumento, con su propio prerregistro, no
un apaño de paso. Queda **para decisión del lead**, con los dos topes rojos tal cual, sin
silenciar.

## 4. El cableado (lo que #36 dejó diferido)

`frontier.is_placeholder_name` pasa a ser la **UNIÓN** de `PLACEHOLDER_NAMES` con
`genero.tier1`. Se **suman**, no se sustituyen: la allowlist conserva los ejemplares que
la forma no decide (`print`, `head`, `load`, `find`, `click`), que viven en TIER-2 y por
diseño no afirman. Construcción perezosa y cacheada (`Trinquete()` barre el corpus, ~0,7 s).

No se cableó en #36 porque entonces habría puesto `placeholder_names` de 0 a **4** y
`test_placeholder_names_do_not_grow` habría caído en **falsa alarma**. Con las 4 ya
renombradas, la cifra sigue en 0 y el trinquete pasa a ser criterio y no muestrario.

**Control positivo, no un cero sin firmar.** `placeholder_names: 0` valdría exactamente
igual con el trinquete desconectado, porque el ledger ya no tiene marcadores. Por eso
`test_placeholder_predicate_is_the_union_and_actually_fires` comprueba las dos vías por
separado: (a) TIER-1 fuera de la allowlist (`allers`, `ttack`, `xffff`, `fn36`,
`durmiente`, `tabulado`) tiene que cazar; (b) allowlist que TIER-1 **no** decide se tiene
que conservar; (c) control negativo que **incluye los 4 nombres nuevos**, porque un
renombre que dispare el propio trinquete sería un marcador disfrazado.

**Propiedad declarada del cableado**: TIER-1 se calcula contra la prosa del repo, así que
el gate de `frontier` puede caer por un cambio de **documentación**, sin que el ledger
cambie. Es el efecto buscado —cazar la semilla nueva en cuanto nace—; la §3 es la prueba
de que ya pasa. Cuando pase, la respuesta es leer el cuerpo y renombrar, nunca silenciar
la regla.

## 5. Cifras y gates

885 rutinas · `body_verified` 400 → **406** (mis 4 + las 2 que trajo el merge de main) ·
`placeholder_names` **0**, ahora por criterio · TIER-1 sobre el ledger 4 → **0**.

Verdes, exits leídos por separado y sin pipes: `test_frontier` 32 · `test_routine_census`
12 · `test_ledger` 3 · `test_dispatch` 39 · `test_globals_negdisp` 21 (llegó con el merge).

**Rojo declarado y ajeno**: `test_genero::test_trinquete_tier2_no_crece`, EXIT 1 —
**exactamente el mismo test y el mismo exit corriendo sobre el checkout de main sin
tocar nada**, o sea que no es mío (§3). No lo silencio.

Dos añadidos míos a `re/tools/` que **alimentan el corpus de código** del trinquete
(§3) y que por eso medí antes de commitear: `_body59.py` (ayudante de volcado de
cuerpos) y esta misma nota en `re/notes/`. Ambos **corpus-neutros**: con y sin ellos,
TIER-1 y TIER-2 dan la misma cifra y el mismo conjunto de nombres.

## 6bis. TRIAJE de las ya-renombradas (encargo posterior del lead)

**Población: 20, no 19.** De las 23 rutinas TIER-1-nuevas del censo crudo, las que seguían
siendo marcador en el ledger eran **3** (`allers`, `dentro`, `tira`); `durmiente` nunca
estuvo dentro de esas 23 porque el filtro la excluía por ser el durmiente ya declarado de
#36. 23 − 3 = **20**.

### Reparto 12 / 8

**PASAN por evidencia (12)** — derivaciones de cuerpo reales, con offsets, inmediatos y
direcciones de string, de `frontier-naming-sweep-20260725`, `frontier-verify-20260725`,
`frontera-26-chores` y `frontera-27-dungeon-resto`: `use_scroll`, `cmd_combat_escape`,
`dng_move`, `dng_attack`, `outsubs_waterfall_fall`, `combat_absorb_shadow`,
`gfx_fill_rect`, `gfx_fill_rect_sel3f`, `draw_7_centered_rows`, `gfx_blit_sel60`,
`putchar`, `beep_ticks`. No se releen.

**NO PASAN (8)** — y no es que la cita sea floja: **no hay derivación**. Las ocho llevan
una sola cita, de la etiqueta `census-name-rescue-20260727`, que dice que el carril del
rescate **copió** a la capa manual el nombre que ya traía el fichero del censo, porque
regenerar `routine_census.py` sobre el corpus de hoy lo destruye y devuelve la semilla-
marcador. Es honesta en no reclamar cuerpo, pero el respaldo que queda es «el fichero del
censo lo decía» = procedencia por **artefacto**. La nota `census-name-rescue-20260727`
**no existe** como fichero en `re/notes`: es una etiqueta sin nota. Dos de las ocho salen
con `verified: true` **heredado del barrido #39** (viene del censo crudo, no de la capa
manual) — la población que re-cotea #51.

> **Interacción con el cableado de §4**: el rescate **enmascara el trinquete**. Lo que el
> censo produce hoy para esas ocho es la semilla-marcador; la capa manual fija encima un
> nombre de buen aspecto, así que `is_placeholder_name` ve el nombre bueno y el criterio
> nunca dispara. Con nombre derivado eso es correcto; con nombre sólo-rescatado, el pin
> tapa que debajo no hay nada.

### Las 8, leídas: 4 confirmadas · 3 corregidas · 2 bloqueadas (una cuenta doble)

| rutina | pin del rescate | veredicto |
|---|---|---|
| ULTIMA.EXE 0x71aa | `clock_driver_notify` | **CONFIRMADO** |
| ULTIMA.EXE 0x4552 | `bytecode` | **CONFIRMADO** |
| EGA.DRV 0x1db6 | `read_order_header` | **CONFIRMADO** (con matiz) |
| ULTIMA.EXE 0x2a52 | `combat_actor_take_damage` | ★ → **`party_char_take_damage`** |
| ENDGAME.OVL 0x23a | `text_accum_char (word-wrap)` | ★ → **`text_accum_line`** |
| ULTIMA.EXE 0x2f62 | `randomizer` | → **`wind_maybe_change`** |
| EGA.DRV 0x0 | `jump_table_and_mask_tables` | **verify_blocked** (mitad confirmada) |
| EGA.DRV 0x1e68 | `big_planar_reveal_fn32` | **verify_blocked** (no leído) |

★ **0x2a52 estaba mal de DOMINIO.** No toca `g_combat_actor_records` (0xBA14, paso 8):
indexa `g_party_records` con paso 32, y la prueba decisiva es que compara el índice contra
`g_active_char`, que `globals.json` documenta como «personaje activo (0-5)». En este repo
«combat actor» tiene referente propio, así que el nombre viejo desorienta. **Y corrobora
mi 0x68ae**: son gemelas —misma columna `[+0x55b3]`, mismo despeje de `g_active_char`,
mismo `draw_status_panel`— escribiendo `'D'` donde la otra escribe `'S'`.

★ **0x23a llevaba un paréntesis FALSO**, igual que el `fx_screen_wipe` de §2.1: no hay
lógica de palabra por ningún lado (ni búsqueda de espacio, ni retroceso al último
separador). Hay un tope duro de 39 columnas y un volcado disparado sólo por `'\n'`.

**0x4552 `bytecode` sobrevive, y es la lección del triaje al revés**: a media lectura lo
di por nombre-basura (parecía un tick de animación). Leído entero, es literalmente una
máquina de bytecode — script de 16 B por clase en 0x1B18, PC persistido en el nibble alto
de `[+6]`, fetch `byte [PC + base]`, tabla de despacho de 8 entradas en 0x46C2 y opcodes
`> 7` como «espera op−0x80». **Leer en diagonal habría tumbado un nombre bueno**, que es
el mismo error que confiar uno malo.

**EGA.DRV 0x0**: la mitad de código sí queda cerrada (38 entradas `e9` en 0x0–0x71, y casa
con los selectores 0x66 = entrada 34 y 0x6f = entrada 37). La mitad de datos no: lo único
derivado es que `cs:[0x72]` se consume como **tabla de direcciones de scanline** (`mov di,
word ptr cs:[bx+0x72]`, bx = scanline·2) y que en el fichero está **a ceros** (se rellena
en runtime) — o sea que no es una tabla de máscaras, y «mask_tables» no tiene respaldo.

**EGA.DRV 0x1e68**: 1612 B, **no leído**, declarado en vez de firmado.

## 6. Cola que dejo apuntada (NO hecha)

1. **Recalibrar el corpus de código de `genero.py`** (§3) — decisión del lead.
2. **ULTIMA.EXE 0x0f46**, hoy `wrapper`: es el barrido de rectángulo de la rama CLC y le
   corresponde el nombre `fx_screen_wipe` que hoy lleva 0x1068. Es TIER-2, que se adjudica
   aparte, pero ya está medio derivado en §2.1.
3. **ULTIMA.EXE 0x1cca**, hoy `cursor` (TIER-2): en `draw_sky_strip` se usa como
   `push <color> / call 0x1cca` antes de cada `putchar`, o sea que fija color/atributo, no
   mueve el cursor (para eso está `text_gotoxy` 0x1bf2). El nombre huele a mal puesto.
4. **Auditar las 19 ya renombradas** (§1): que estén renombradas no dice que el nombre
   esté respaldado por cuerpo. No lo he hecho: es otro encargo.
