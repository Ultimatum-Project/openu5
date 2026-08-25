# #51 — Re-cotejo de las 9 `verified` HEREDADAS del barrido #39

Carril `cotejo-51` · 2026-07-28 · rama `re/frontera-verified-26`.
Cierra la contradicción que el backfill de `pin_only` dejó medida y acotada
(`pin-only-prerregistro.md` §R3): **9 rutinas eran a la vez `verified` y `pin_only`**.
El `verified` no lo puso la capa manual — venía HEREDADO del barrido #39. Las dos cosas
no podían ser ciertas con el mismo rigor: *o quien leyó el cuerpo no dejó la cita, o el
`verified` heredado no vale lo que dice.*

**Veredicto: gana la PRIMERA hipótesis. 9 ACREDITADAS, 0 degradadas, 0 renombradas.**
Los nueve nombres resistieron el cuerpo entero. Lo que faltaba era la **cita**, no la
lectura. Cada una lleva ya su derivación en `frontier-manual.json` y ninguna sigue
siendo `pin_only`.

---

## 1. ★ El hallazgo estructural: la contradicción era UNA fuente contada DOS veces

Esto no estaba en la tarjeta y es lo que explica el género entero.

`routine_census.py::load_verified_labels` (líneas 511-528) lee los anexos
`re/notes/inferible-sweep-f{1,2,3}-verified.json`. Cada fila es exactamente esto:

```json
{"file": "COMSUBS.OVL", "off": 1864, "role": "find_live_target_at_cell",
 "inference": "CONFIRMED", "coverage": "CUBIERTA"}
```

Sin cita. Sin offsets. Sin una línea de cuerpo. Y en `census()` (líneas 681-686) esa
**misma fila** hace las dos cosas a la vez:

```python
r.verified = True                                  # (a) el sello
if not r.name and info["role"]:
    r.name = info["role"]                          # (b) el nombre
```

⇒ El `role` del anexo **es** el nombre que luego se pinó **y** es lo que el `verified`
dice haber verificado. No eran dos afirmaciones independientes que se contradecían: era
**una sola fila sin respaldo, contada dos veces**. Por eso la contradicción sólo podía
resolverse leyendo los cuerpos — no había ninguna otra evidencia en el ledger que
consultar.

Y el `.md` consolidado de cada fase tampoco la tiene: las nueve aparecen ahí como **una
línea de resumen por fichero**, no como una lectura. Literalmente:

- `f1.md:140` — «`0x0748` occupantAt … — CONFIRMED — **CUBIERTA**»
- `f3.md:71` — «`0x3ef0` add_byte_clamped_ceiling — suma saturada con techo»

Eso es un rótulo, no una derivación. El #39 dice en su cabecera que hubo «6 subagentes en
paralelo, consolidado aquí»: la lectura probablemente existió en la salida de cada
subagente y **se perdió al consolidar**. El ledger se quedó con el veredicto y sin la
prueba.

### 1.1. Segunda cosa incómoda, declarada: `refuted: 0` en las tres fases

f1 75/75, f2 81/81, f3 26/26 — **182 CONFIRMED, 0 REFUTED**. Una tasa base de refutación
cero es, en general, señal de un instrumento sin poder discriminante.

**No lo uso como acusación, y digo por qué:** mi propio re-cotejo también salió 9/9. Pero
eso **no absuelve al barrido**, por dos razones que hay que dejar escritas: (a) mis 9 no
son una muestra aleatoria — son justo las `pin_only`, y (b) lo que yo acredito es
distinto de lo que él afirmaba: yo dejo la cita. Un 9/9 con cita y un 182/182 sin cita no
son el mismo hecho. **El resto del #39 (173 rutinas) sigue sin cotejar y sigue apoyado en
filas sin cita.** Queda como cola, no como problema resuelto por analogía.

---

## 2. Las nueve, una a una

Cuerpo leído **entero** en Python sobre `re/disasm/*.asm` (jamás `grep -r`). La cita
completa de cada una vive en `frontier-manual.json` (`note: cotejo-51-verified-heredado`);
aquí va el veredicto y lo que el cuerpo añadió.

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `ULTIMA.EXE:0x2c2e` | `tile_classifier_water` | ACREDITADA |
| 2 | `ULTIMA.EXE:0x2c4c` | `tile_property_query_dispatch (11-case jump table)` | ACREDITADA + ⚠ nombre |
| 3 | `ULTIMA.EXE:0x2e96` | `set_wind + draw_wind_status` | ACREDITADA |
| 4 | `ULTIMA.EXE:0x3ef0` | `add_byte_clamped_ceiling` | ACREDITADA |
| 5 | `CAST2.OVL:0x8f8` | `time_spell_state_writer` | ACREDITADA |
| 6 | `SJOG.OVL:0x2012` | `combat_turn_upkeep` | ACREDITADA + ★ omisión |
| 7 | `COMSUBS.OVL:0x748` | `find_live_target_at_cell` | ACREDITADA |
| 8 | `MAINOUT.OVL:0x1168` | `npc_ship_attacks_party` | ACREDITADA |
| 9 | `CAST.OVL:0x1c36` | `line_spell_worker` | ACREDITADA |

### Lo que el atajo del lead ahorró (cruzar el repo ANTES que el binario)

Cuatro de las nueve ya tenían derivación en el corpus, **ninguna referenciada desde el
anexo del #39**. Las leí igual (el encargo es cuerpo entero), y sirvieron de corroboración
independiente:

- `0x2c2e` y `0x2c4c` → `carpet-b2.md:13-35` (predicado de agua + clase 2 de la alfombra)
  y `mapeo-enemigo-mover.md:50` (el mover = 1er parámetro, por el `ret 4`).
- `0x2e96` → `transport.md:202-205`, que llegó a lo mismo por otra vía: rastreando quién
  escribe `g_wind` desde `0x2F62`.
- `0x1c36` → `fx-lineaoe-negate-derivation.md §1` y `cast-line-area-spell-derivation.md`.
  **Lo leí entero ANTES de encontrarlas** y coinciden punto por punto (los 21 words de
  `0x1cf0`, el `sub word [bx],0xa` de `0x1e7d`, el `si=±1` partido en `cmp [bp-0x5a],0xa`)
  ⇒ corroboración ciega, no copia.

### 2.1. ★ Hallazgos NUEVOS que el cuerpo dio y el ledger no tenía

Esto es el valor real del re-cotejo, más allá de confirmar rótulos:

1. **`0x2c4c` — las 11 casillas, decodificadas y no contadas de oídas.** El disasm imprime
   la tabla como instrucciones basura (`push 0x2c`, `jbe 0x2d90`…) porque **son datos**.
   Decodificados los words de `0x2d60`: `0x2c6a, 0x2c76, 0x2c80, 0x2cae, 0x2cca, 0x2cdc,
   0x2d34, 0x2d42, 0x2d4e, 0x2d54, 0x2d5a` = **once exactos**. El «(11-case)» del nombre
   queda verificado por conteo. Todos los handlers convergen en `0x2d3d` (ax=1) o `0x2ca9`
   (ax=0) ⇒ **el retorno es BOOLEANO**.

2. **`0x2e96` — el nombre describe una de sus DOS entradas.** `cmp word [bp+4],-1` en
   `0x2e99`: con `-1` **no toca `g_wind`** y sólo redibuja. Además hay **dos gates de
   localización** que suprimen el dibujo entero (`g_location >= 0x21`, `g_location == 0x19`)
   y, con `g_floor >= 0x80`, una **rama de dibujo completamente distinta** (`0x2f2a-0x2f5b`)
   que no imprime texto sino dos **bandas de color**. El indicador de viento tiene dos
   presentaciones y eso no estaba escrito en ninguna parte.

3. **`SJOG:0x2012` — el nombre sabe nombrar DOS de sus TRES acciones.** El countdown lo
   deriva su propio cuerpo; la disipación de campos la **delega**, y en vez de fiarme del
   nombre del callee leí también ese cuerpo: `0x201b` → base SJOG `0xBF80`
   (`dispatch_table.overlay_near_call_base`, no a ojo) → `0x8022`, que **no es código sino
   una entrada de la stub table** `0x7a16-0x81c6` → `COMSUBS.OVL:0x0056`, y ése sí barre los
   32 slots y retira cada campo `(tile & 0xfc) == 0xe8` con probabilidad **1/16 por campo y
   ronda**. Pero hay una **tercera** llamada antes, `0x2018` → kernel `0x6794` con
   `g_cmb_actor`, y `0x6794` sigue siendo **`kernel_fn_6794`**, un nombre-marcador sin
   verificar. **Cola apuntada, no cerrada.**

4. **`CAST:0x1c36` corrobora #68 por accidente.** Su dedupe indexa `[bx-0x54fe]` = DS
   `0xAB02` = `g_vis_buffer` con `shl bx,5` = **paso 32** — exactamente la extensión real
   (stride 32) que #68 dedujo contra el `size=121` declarado en `globals.json`. Aquí
   aparece un **consumidor** usándolo con ese paso.

5. **`0x2c2e` — matiz que el nombre no cubre.** El `cmp word [bp+4],4` de `0x2c31` es
   **con signo** (`jl`) y sobre la word entera: un argumento negativo daría «agua». Los
   llamadores pasan el tile cero-extendido, así que no se alcanza — pero el nombre describe
   la intención, no la única conducta posible del cuerpo.

### 2.2. ⚠ Divergencia de nombre en `0x2c4c`, declarada y NO resuelta aquí

El ledger lo llama `tile_property_query_dispatch`. **El corpus lo llama
`kernel_tile_passable` en cinco notas o más** (`transport.md:39`,
`passability-18flags.md:27`, `combat.md:497`, `mapeo-enemigo-mover.md`,
`interactions-piano-fire-audit.md:164`).

El cuerpo respalda al corpus: no consulta una «propiedad» genérica, **devuelve
PASABLE/BLOQUEADO**. No lo renombro en este carril por una razón de método: **no se toca
el nombre y el `verified` en el mismo acto**, o el sello acaba acreditando un nombre que
nadie revisó. Queda como **ticket de renombre** con el cuerpo ya leído, que es la parte
cara.

---

## 3. Trinquetes: BAJAN por adjudicación, y con control positivo ejecutado

| cifra | antes | ahora | por qué |
|---|---:|---:|---|
| contradicción `verified`-heredado × `pin_only` | 9 | **0** | las 9 adjudicadas |
| `pinned_names_without_derivation` | 18 | **9** | las 9 ganan cita ⇒ dejan de ser pin |
| población ENMASCARADA | 6 | **3** | 3 de las 9 lo estaban |

El test de la contradicción deja de ser un cupo (`<= 9`) y pasa a ser una **guarda**
(`not hered`): si reaparece, es una contradicción nueva y se adjudica, no se amplía el
número.

**Control positivo EJECUTADO, no razonado** (la lección de los dos prerregistros
anteriores): re-pinando una sola de las nueve (`ULTIMA.EXE:0x2c2e`, retirándole el
`verified` manual) caen **3 tests** — la guarda de la contradicción, el trinquete de
crecimiento y la frescura del ledger. Restaurado desde copia, los 37 vuelven a verde.

El control positivo del **enmascaramiento** sigue vivo con las 3 que quedan
(`EGA.DRV:0x1e68`, `ULTIMA.EXE:0x1f12`, `ULTIMA.EXE:0x6506`): el fenómeno existe y el
instrumento lo ve.

---

## 4. Cola que dejo apuntada (con dueño = nadie todavía)

1. **Las otras 173 del #39.** Este carril cotejó 9. El resto sigue apoyado en filas de
   anexo sin cita. Si se quiere cerrar el género, el barrido es por **fila de anexo**, no
   por rutina suelta.
2. **Renombre `0x2c4c` → `kernel_tile_passable`** (cuerpo ya leído, §2.2).
3. **`kernel_fn_6794`**, nombre-marcador, tercer callee de `SJOG:0x2012` (§2.1.3).
4. **`load_verified_labels` no exige cita.** Mientras el anexo pueda sellar `verified`
   con una fila de tres campos, el género se puede repetir entero. El arreglo natural es
   pedirle a cada fila un campo de cita (nota + offsets) y que el censo caiga sin él —
   pero eso invalidaría las 182 filas actuales de golpe, así que **es decisión del lead**,
   no de este carril.
