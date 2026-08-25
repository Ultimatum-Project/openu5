# `size` en globals.json = BYTES, y entradas ANIDADAS — tarea #68

Instrumento y guardas: `re/tools/globals_map.py` (`validate`), tests de inyección en
`re/tools/test_globals.py`. Medición que acotó el problema:
`re/tools/globals_negdisp.py` (`scaled_index_refs` / `stride_size_conflicts`).
Origen del hallazgo: `re/notes/globals-negdisp-adjudicacion.md` §4 y §7b.

---

## 1. La pregunta no estaba abierta: la contestaba el código

El encargo se planteó como «decidir si `size` cuenta celdas o bytes». **No hay nada que
decidir**: los dos consumidores del campo ya lo tratan como BYTES desde siempre —

```python
prev_end = e["addr"] + e["size"]        # validador de solapes
for k in range(1, e["size"]):           # anotación de bytes interiores
```

⇒ un `size` que cuente «celdas útiles» no propone otra convención, **incumple la
vigente**, y hace daño doble: **anota de menos** (los bytes que quedan fuera no reciben
nombre) y **deja pasar solapes en falso** (el validador cree que la entrada acaba antes
de donde acaba). Lo que faltaba era escribirlo, no elegirlo. Queda escrito en el
docstring de `globals_map` y en el campo `meaning` de la entrada afectada.

## 2. Alcance: el defecto estaba CONFINADO a una entrada

Censo de globales alcanzadas por índice escalado (`shl` antes del acceso), trinquetado:

| | |
|---|---|
| globales del ledger con índice escalado | **16** |
| con `size` no múltiplo del stride | 4 |
| …de ellas, marcadores `g_unk_*(size=1)` | 3 |
| **conflicto REAL de semántica** | **1** (`g_vis_buffer`) |

Los tres `g_unk_*` con `size=1` **no son el mismo defecto**: el 1 es la convención del
ledger para «extensión desconocida», no una medición. Separarlos evita inflar el
titular de 1 a 4. Las demás cuadran: `g_party_records` 512/32, `g_dng_map` 512 con
strides 8 y 64 (planta y celda), `g_npc_pathbuf` 1024/32, `g_combat_actor_records`
256/8, `g_npc_sched` y `g_npc_rt` 512/16.

## 3. El conflicto real: `g_vis_buffer` 121 vs 352

`compose_world_view` (ULTIMA.EXE 0x5394) lo indexa con `mov cl,5; shl bx,cl` = **stride
32** (0x553b-0x5542), en paralelo con `0xAC64`, que usa `shl bx,4` = stride 16. Tres
comprobaciones independientes de la geometría:

1. **Las fronteras cuadran al byte**: `0xAC64 − 0xAB02 = 354 = 11*32 + 2` y
   `0xAD14 − 0xAC64 = 0xB0 = 11*16`.
2. **La carga de fichero mide lo mismo**: BLCKTHRN 0x070e empuja `0xB0` a `0xAC64`, y
   0x073d-0x074b copia `repne movsw` con `cx=5` + `movsb` = **11 bytes por fila** en un
   bucle de `[bp-6] = 0xB` = **11 filas**.
3. **El lector usa coordenadas relativas al centro**: `town_move` (TOWN 0x0600) pone los
   dos índices a 0 (0x061a-0x0622) y hace `dec [bp-0xc]` para la dirección 3 —
   identificada sin ambigüedad por su eco `DS 0x2676 = 'North\n'` — de modo que
   `si = −32` = una fila arriba del centro.

⇒ `size` 121 → **352**, `stride` **32**. El 121 eran las 11×11 celdas útiles; el resto
de cada fila es relleno.

### ⚠ EXTENSIÓN (352) ≠ OCUPADO (331) — las dos son ciertas, en campos distintos

Dato de `renombres-59` sobre el cuerpo de `vis_buffer_build` (ULTIMA.EXE 0x5d0a),
releído aquí: `0x5d17 mov si, 0xab02` (base), `0x5d1a mov di, 0xb` (**11 filas**),
`0x5d1d mov cx, 0xb` (**11 bytes por fila**), `repne stosb` de 0xFF, `0x5d2d add si,
0x20` (avanza una fila) y `dec di / jne` (11 vueltas).

⇒ el **último byte escrito** es `0xAB02 + 10*32 + 10 = 0xAC4C`, o sea **331 B
ocupados**; los **21 B de cola de cada fila** y el tramo final `0xAC4D..0xAC61` **no se
escriben nunca**.

`size` sigue siendo **352** porque es **extensión de DIRECCIONES con geometría de stride
declarada**, y la propia guarda `size % stride == 0` lo exige: 331 la violaría, y con
razón — **331 es una medición de escritura, 352 una declaración de geometría**. Poner
331 «porque es más preciso» rompería la geometría y haría ilegal la anidación.

La ficha registra las dos cifras (`meaning` y `evidence`) para que nadie herede un «352
escritos», y la distinción está fijada como test ejecutable:
`test_EXTENSION_352_vs_OCUPADO_331_no_son_lo_mismo`, que además comprueba que meter 331
como `size` salta.

Regalo del mismo cuerpo: `0x5d59 mov ax, 0x20` empuja el **32 como ARGUMENTO** junto a
`0x5d5d mov ax, 0xab02` con la base — tercera confirmación del stride, y ésta
**copiable** en vez de inferida.

## 4. Por qué NO bastaba con cambiar el número

`0xABC7` cae dentro de la extensión nueva, y **no se puede absorber**: tiene nombre
propio (`g_unk_abc7`), **4 referencias por el canal SÍMBOLO** (CMDS 0x0b58, CMDS 0x131a,
MAINOUT 0x05b2, TOWN 0x0e3f), semántica derivada por vía independiente —es el tile
inmediatamente al SUR de la party, gate del puzle del clavicémbalo,
`re/notes/interactions-piano-fire-audit.md`— y consumidores en el port
(`game/src/core/world/harpsichord.ts`).

> ⚠ Yo mismo declaré que esa dirección «no tenía ni una referencia por ninguno de los
> tres canales». Era **falso**: miré hex y negativo, no símbolo. Guarda permanente:
> `test_0xABC7_ES_EL_CONTRAEJEMPLO_DE_MIRAR_SOLO_DOS_CANALES`.

Las dos cosas son ciertas a la vez —celda interior **y** global con nombre— y el modelo
plano («entradas ordenadas, prohibido solapar») no sabía expresarlo. Por eso el
conflicto parecía irresoluble: no lo era, faltaba vocabulario.

## 5. La regla nueva: anidación JUSTIFICADA POR ESTRUCTURA DECLARADA

Variante conservadora (elegida por el lead entre las dos que propuse):

| caso | veredicto |
|---|---|
| solape PARCIAL (bordes cruzados) | **ROJO** — es el defecto que la guarda siempre quiso cazar |
| contenida por completo, contenedora **con** `stride` | **VERDE** — anidada |
| contenida por completo, contenedora **sin** `stride` | **ROJO** — sigue siendo el solape que era |
| dos anidadas que se pisan entre sí | **ROJO** |
| `size % stride != 0` | **ROJO** — declaración incoherente, mejor eso que geometría inventada |

Lo importante del criterio: **la anidación la habilita una estructura DECLARADA, no que
los tamaños encajen**. Un `size` inflado por error no puede tragarse entradas por
accidente, porque sin `stride` el contenimiento total sigue siendo rojo. La guarda queda
igual de apretada que antes salvo donde hay una declaración explícita que la justifica.

`_build_globals` anota con el **nombre más específico**, y sale gratis: `validate`
ordena por `(addr, -size)`, así que la contenedora se escribe antes y la anidada la
pisa. `0xABC7` → `g_unk_abc7`; `0xABA7` → `g_vis_buffer+165` sin inventar entrada.

La guarda se verifica **inyectándole** los casos (rama pura `validate(raw)`), no
mirándola verde sobre el ledger real, que por definición está verde.

## 6. Efecto medido, incluidos los trinquetes que se movieron

Tres trinquetes de #66 cambiaron, y los tres son movimiento correcto:

- «direcciones que SÓLO ve el canal negativo» 3 → **4**: entra `g_vis_buffer+165`.
  Al declarar la extensión real, `0xABA7` pasa a estar en el ledger y resulta ser otra
  dirección invisible a hex y a símbolo — que es justo por lo que no tenía entrada.
- Cola de adjudicación de #66: 11 → **10** (encoge por trabajo hecho).
- ★ `stride_size_conflicts` 4 → **3**, y los 3 son sólo los marcadores. El test se
  reescribió para afirmar `real == []`: si alguien reintroduce un conflicto de
  semántica, salta.

## 7. Lo que esto NO hace (declarado)

- **No renombra `g_unk_abc7`.** Su nombre sigue siendo un marcador aunque su semántica
  esté derivada; renombrar es trabajo de la cola de marcadores (#59), no de #68.
  > ★ HECHO EN #75 (2026-07-28): `g_unk_abc7` → **`g_vis_tile_south`**. Lo que bloqueaba
  > el renombre no era la cola de marcadores sino un acoplamiento: el `.asm` lleva el
  > nombre IMPRESO de cuando se generó, así que renombrar ponía sus 4 refs a cero por
  > los TRES canales. Se resolvió con el campo alias `old_names[]`
  > (`re/notes/old-names-75-diseno.md`). El resto de este apartado sigue vigente.
- **No añade entrada para `0xABA7`.** Gana nombre compuesto por anidación, que es más
  honesto: no hay una global ahí, hay una celda de un búfer.
- **No declara `stride` en las otras 15** globales con índice escalado. Sus `size` ya
  son coherentes; declararlo sería trabajo especulativo. La puerta queda abierta para
  cuando alguien quiera registrar campos con nombre dentro de `g_party_records` o
  `g_combat_actor_records`, que es lo que la anidación habilita.
- **No toca los 3 `g_unk_*(size=1)`.** Su `1` es «extensión desconocida»; convertirlos en
  extensión real exige medir cada uno, y eso es otra tarea.
