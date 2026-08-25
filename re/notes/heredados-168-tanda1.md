# heredados-168 · TANDA 1 — 17 filas `verified_heredado` adjudicadas

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`. Releva a `cotejo-51`.
Contador `summary.verified_inherited_without_cite`: **168 → 151**.

La derivación completa de cada fila vive en `re/ledger/frontier-manual.json`
(`note: heredados-168-tanda1`). Aquí va sólo el veredicto y **lo que no cabe en una cita
por fila**: los dos defectos de instrumento y la regresión de merge.

---

## 1. Las 17, una a una

Cuerpo leído **entero** en Python sobre `re/disasm/*.asm` (jamás `grep -r`), near-calls
resueltos con `dispatch_table.overlay_near_call_base` (leída del binario, no a ojo).

> **Formato de la tabla, a propósito:** el offset y el nombre van en **celdas separadas**
> (igual que `cotejo-51-verified-heredado.md` §2). No es estética — ver §2.3: ponerlos
> pegados en la misma celda hace que esta nota SEMBRE nombres en el censo y trunque los
> curados. Me pasó al escribirla.

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `CAST2.OVL:0x8ea` | `light_spell_set` | ACREDITADA (+ es SET, no acumulador; byte) |
| 2 | `FLAMES.OVL:0x0` | `plink_link_thunk (inert)` | ACREDITADA — «inert» probado por ausencia |
| 3 | `ULTIMA.EXE:0x3f54` | `sub_word_clamped_floor0 (saturating sub)` | ACREDITADA — pareja de `0x3ef0`, que es la variante byte/techo |
| 4 | `TALK.OVL:0x788` | `talk_run_until_stop` | ACREDITADA (+ 2 huecos, §3) |
| 5 | `SHOPPES.OVL:0x0` | `strcpy_append (helper)` | ACREDITADA — ★ args INVERTIDOS vs strcpy de C |
| 6 | `COMBAT.OVL:0x120e` | `random_board_cell` | ACREDITADA — ★ muestreo por RECHAZO, 2 tiradas/intento |
| 7 | `DUNGEON.OVL:0x1be0` | `dng_redraw (corridor+indicator+anim)` | ACREDITADA; paréntesis **2 de 3** |
| 8 | `SHOPPES3.OVL:0x0` | `count_guests_here` | ACREDITADA — la derivación ya existía en `shops.md` |
| 9 | `BLCKTHRN.OVL:0x0` | `beep_delay` | ACREDITADA — el «delay» redibuja el viewport |
| 10 | `ULTIMA.EXE:0x39cc` | `set_map_tile (town/keep override)` | ACREDITADA — ★ 2 puertas no escritas |
| 11 | `NPC.OVL:0x1a0` | `npc_seek (seek-to-stairs)` | ACREDITADA la base; ⚠ **«to-stairs» NO derivado** |
| 12 | `ULTIMA.EXE:0x3a74` | `set_actor_record (sprite slot 0x5C5A)` | ACREDITADA + layout del registro |
| 13 | `COMSUBS.OVL:0x56` | `field_dissipation_per_round` | ACREDITADA — 1/16 corroborado a ciegas vs #51 |
| 14 | `COMSUBS.OVL:0x94` | `print_combatant_name` | ACREDITADA + layout de `g_combat_actor_records` |
| 15 | `ZSTATS.OVL:0x5a4` | `find_next_owned` | ACREDITADA — ★ el predicado es una DISYUNCIÓN |
| 16 | `COMSUBS.OVL:0x0` | `int_saving_throw_dispatch` | ACREDITADA la parte `int_saving_throw`; ⚠ «_dispatch» sin respaldo |
| 17 | `ULTIMA.EXE:0x4dea` | `draw_char_boxed (Ztats render)` | ACREDITADA la parte `draw_char_boxed`; **«(Ztats render)» RETIRADO** |

**0 degradadas a no-verificado, 1 nombre recortado** (17: se retira un calificativo sin
respaldo). Retirada ≠ refutación en los tres casos marcados (11, 16, 17).

### 1.1. Lo que el cuerpo dio y el ledger no tenía

- **`rand30` (CS `0x3abe`, SIN NOMBRE en el censo) no es uniforme.** Es
  `rand_range(0x3c)` → `/2` con signo → y **el cero se convierte en uno**: rango real
  **1..30** con `P(1)=3/61`, `P(2..29)=2/61`, `P(30)=1/61`. Sostiene el saving-throw de
  `COMSUBS:0x0`. **Control positivo ejecutado antes de gritar «defecto»: el port lo tiene
  BIEN** (`game/src/core/combat/formulas.ts:58-62`, `max(1, rand0(0x3C) >> 1)`, citando
  0x3ABE). No hay defecto; hay una primitiva load-bearing sin nombre.
- **`rand_range` (CS `0x3aae`) es de UN argumento** — `rand_range(n)` = uniforme `[0,n]`
  inclusive; el motor de 2 args es CS `0x2092` (`[bp+6]`=MIN, `[bp+4]`=MAX, o sea el
  primer push es el MIN, coherente con el acervo).
- **`COMBAT.OVL:0x120e`, que consume 2 tiradas por intento y acierta 121/256 (~47,3%)**: no
  reintenta, el bucle lo pone el llamador. Load-bearing para paridad de RNG.
- **`ULTIMA.EXE:0x39cc` no puede escribir un tile a 0** (`[bp+8]==0` → sale) y su ventana
  (`g_location` ∈ [1,0x20]) es **más estrecha** que la rama town de `get_tile_ptr`
  (1..0x7f): fuera de ella la escritura se pierde en silencio.
- **`g_char_anim_states` (DS 0x5C5A) es un array de 32×8 B** con el TILE en +0 — dos
  consumidores independientes de esta misma tanda lo confirman (`COMSUBS:0x56` barre
  campos `tile&0xfc==0xe8`; el panel de estado CS `0x2900` lee `+5` y lo imprime con el
  barco).

---

## 2. ★ DOS DEFECTOS DEL TRIAJE, medidos (no opinados)

`triage_heredados.py` ahorra la búsqueda, no la lectura — ya lo decía. Esta tanda le pone
cifras a **hasta dónde** no la ahorra.

### 2.1. Las filas en offset `0x0` son ciegas por construcción

5 de las 168 arrancan en `0x0` (`BLCKTHRN`, `COMSUBS`, `FLAMES`, `SHOPPES`, `SHOPPES3`) y
**las 5 cayeron en el bucket CANDIDATO FUERTE**, porque el patrón de offset para `0` casa
con cualquier `0x0` del corpus. Abiertos los hits uno a uno: **2 genuinos**
(`COMSUBS:0x0` → `combat-spells.md:170`, `FLAMES:0x0` → `asm-frontier-lote-b.md:146`) y
**3 ruido al 100%** (`0:0xeaca` de una tabla de stubs, una fila de banners de
`espejo-fase2.md`). O sea ~9% del bucket «fuerte» lo es por artefacto.

Y el caso caro es el inverso: **`SHOPPES3:0x0` sí tenía derivación**, en `shops.md:105`
(`+0x1F`=0x55C7 tag de posada) / `:110` / `:121` — y el triaje **no puede verla**, porque
`shops.md` cita la **dirección DS**, nunca el offset de rutina. Un barrido que sólo indexa
offsets no ve el corpus que indexa direcciones.

### 2.2. ★★ `game/src` es una fuente de PISTAS que el triaje no mira — y cubre el 52%

`triage_heredados.py` sólo escanea `re/notes/*.md`. Medido sobre las 168, buscando su
offset en `game/src/**/*.ts` con el overlay nombrado a ±3 líneas:

| | filas |
|---|---:|
| con su offset citado en `game/src` | **87 de 168 (52%)** |
| …que el triaje daba por FUERTE | 40 |
| …que el triaje daba por **DÉBIL** | **43** |
| …que el triaje daba por **SIN RASTRO** | **4** |

Es decir: **47 filas que el triaje manda al final de la cola están de hecho bien cubiertas
por los comentarios del propio port**, y «SIN RASTRO» no significa «nadie lo derivó nunca».

**PERO — y esto no es negociable:** una cita en `game/src` es **el port hablando de sí
mismo** y NO acredita nada (`specs-detector-vs-veredicto`: jamás re-baselinear el port
citando al port). Sirve como **PISTA**: dice qué leer y qué esperar, y por tanto da una
**predicción que el binario puede falsar**. El caso `rand30` de §1.1 es exactamente el
patrón correcto: el comentario del port dijo dónde mirar, la confirmación vino del cuerpo,
y la conclusión («no hay defecto») es del binario, no del port.

**Recomendación al lead:** añadir el canal `game/src` a `triage_heredados.py` como columna
**separada y etiquetada `PISTA (no evidencia)`**, nunca fundida con la señal del corpus.

### 2.3. ★★ Escribir la nota de una tanda RE-SIEMBRA el censo (me pasó, tres veces)

El defecto de §4 no es de `main`: es de cualquiera que escriba una nota. `build_name_seeds`
recoge nombres de **prosa** con dos patrones — `` `0xNNNN` `` seguido de un identificador, e
identificador seguido de `` `0xNNNN` `` — y los mete con `setdefault`, así que **gana la
primera nota por orden alfabético**. `heredados-168-tanda1.md` ordena pronto, o sea que gana
casi siempre.

Al escribir esta nota la sembré tres veces, y el gate lo cazó:

| construcción que escribí | lo que sembraba |
|---|---|
| tabla con offset y nombre en la MISMA celda | 5 nombres curados TRUNCADOS (se pierde el paréntesis: el patrón sólo captura el identificador) |
| offset entrecomillado, y pegada detrás la palabra «consume» | `ULTIMA.EXE:0x120e` → `'consume'` (fichero equivocado por el `ctx` pegajoso, y nombre basura) |
| «`` `NPC:0x1a0` `` → quitar…» | `DUNGEON.OVL:0x1a0` → `'quitar'` |
| «que no menciona `` `0x4dea` ``…» | ★ `ULTIMA.EXE:0x4dea` → `'menciona'`, **pisando el nombre curado**: la frase escrita para DOCUMENTAR el defecto lo reproducía |

Reglas que salen de esto, para quien escriba la siguiente tanda:

1. En tablas, **offset y nombre en celdas separadas** (como `cotejo-51`). Pegados truncan.
2. En prosa, no dejes una palabra en minúsculas pegada a un offset entrecomillado: mete una
   coma, o antepón un token en mayúsculas (`CS `, `DS `).
3. **Verifícalo, no lo razones.** El comprobador que usé (compara `build_name_seeds()` con y
   sin la nota, y exige `SEMBRADAS 0 / CAMBIADAS 0`) son 20 líneas. Esta nota sale a 0/0.
   Sin ejecutarlo yo habría jurado que ya estaba limpia después del primer arreglo, y aún
   quedaban dos.

---

## 3. Cola que dejo apuntada (con dueño = nadie)

1. **`TALK.OVL:0x0f32`** — el intérprete de opcodes del script de diálogo, con
   nombre-MARCADOR «padres» (prosa, no nombre).
2. **DS `0xBCDE`** — puntero de instrucción del script de diálogo, **sin entrada en
   `globals.json`** (la anterior es `g_unk_bb16`, a 456 B).
3. **CS `0x3abe`** — `rand30`, sin nombre pese a ser primitiva de RNG load-bearing.
   Igual `CS 0x2092`, el LCG; `CS 0x1850`, el impresor con ajuste de línea; y `CS 0x2900`,
   (panel de estado), los tres con el nombre-marcador `call`.
4. **`DUNGEON.OVL:0x1d2`** sin nombre (es el indicador de nivel+rumbo) y
   **`DUNGEON.OVL:0x1020` MAL nombrado** («turn»: es un tic de sonido que decae).
5. **Renombres con el cuerpo ya leído** (la parte cara ya está hecha):
   `COMSUBS:0x0` → `resist` / `int_saving_throw` (el corpus ya lo llama `resist()`);
   `NPC.OVL:0x1a0`, o quitarle «to-stairs» o respaldarlo con el llamador.

---

## 4. ⚠ REGRESIÓN DE MERGE heredada de main (arreglada aquí, pero hay que saberlo)

Al traer `main`, un cambio de **un solo párrafo** en `re/notes/kernel-sweep-3.md` (§`0x6794`,
que ni siquiera cita CS `0x4dea`) puso **ROJO**
`test_no_orphan_names_only_the_stale_census_could_explain` — verificado con un run de
CONTROL: restaurando las 3 notas del merge a su versión previa el test pasa, y bisecándolas
el culpable es `kernel-sweep-3.md`.

**Mecanismo:** `routine_census.build_name_seeds` arrastra un **contexto de fichero PEGAJOSO**
(`ctx`) a lo largo de toda la nota, así que editar un párrafo re-atribuye los offsets de los
párrafos siguientes. Medido comparando `build_name_seeds()` pre y post:

```
NUEVAS   7   ULTIMA.EXE 0x03a0 udivmod32 · 0x1dda poll_key_timed · 0x1e38 input_string_raw
             0x4d76 strchr_index · 0x4daa 'fundido' · 0x4dea draw_char_boxed · 0x4e20 'painter'
PERDIDAS 2   CMDS.OVL 0x03a0 · CMDS.OVL 0x1b38
CAMBIADAS 0
```

La re-atribución es **correcta en el fondo** (son rutinas del kernel que colgaban de
`CMDS.OVL`); el daño es colateral: al existir ya semilla, la PRIORIDAD del censo
(`routine_census.py:537` semilla > `:652` rol) deja de aplicar el rol y una regeneración
escribiría `draw_char_boxed` a secas. Arreglado como prescribe el propio test: fijando el
nombre en la capa manual — y fijando la forma **derivable**, no la del rol.

Daños colaterales revisados uno a uno y **nulos**: `0x4daa` y `0x4e20`, que reciben semillas de
prosa pero ya tienen nombre curado que las pisa; `CMDS.OVL:0x03a0`/`0x1b38` no son inicios
de rutina.

**Lo que NO arreglo aquí (decisión del lead):** el `ctx` pegajoso sigue vivo. Cualquier
edición futura de una nota puede re-atribuir en silencio nombres de párrafos que no tocó.
El síntoma es visible sólo si el nombre resultante difiere del curado; si coincide, pasa
inadvertido.

> 🔴 **CORRECCIÓN 2026-08-06 (carril bugs-original, #66).** La cifra `P(1)=3/61` de esta acta es **FALSA**: son **4/61**. `rand_range` es inclusivo por los dos extremos, así que `rand0(0x3c)` da `r ∈ 0..60` (61 valores) y al **1** le caen CUATRO (`r∈{0,1}` elevados por el `inc` de `0x3adc`, más `r∈{2,3}`). Se delata con una suma: `3 + 28·2 + 1 = 60`, que no es el denominador. `asm-kernel-l4-tanda1` ya lo tenía bien (§ del `rand30`) y el comentario del propio `rng-original.ts` también. Se anota aquí, sin reescribir el cuerpo, porque de esta acta salió la propagación hasta el registro público.
