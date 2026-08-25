# COMSUBS — la cadena del ataque del jugador, leída cuerpo a cuerpo

Carril `asm-overlays-6`, tanda 1. Siete rutinas de COMSUBS.OVL leídas instrucción a
instrucción sobre `re/disasm/COMSUBS.OVL.asm`. Base de `call` near de la banda 4 (a la que
COMSUBS pertenece) = `0xe1e0`; toda resolución de llamada de esta nota usa esa base y va
anotada con su CS.

Esta nota **no reabre** lo ya derivado en `combat.md` §«Ataque del jugador» ni en
`careo-combate-fixes.md` §#4: los confirma leyendo el cuerpo, y añade lo que aquellas no
dicen. Donde coincidimos lo digo; donde amplío, lo marco.

---

## 0. Control de legibilidad (trampa de los prólogos decapitados)

Antes de leer nada comprobé el corte de **las 23 filas** del fichero contra el `.asm`: las
23 arrancan en un `55 push bp` y cada fila termina exactamente donde empieza la siguiente
(`start+size` encadenado sin hueco ni solape). **Cero decapitadas** en COMSUBS. El control
es del fichero entero, no de mi lote.

---

## 1. La cadena, con los argumentos resueltos por orden de `push`

Convención leída, no supuesta: todas usan `ret N` con el último `push` en `[bp+4]`.

| rutina | offset | `ret` | argumentos (del `push` del llamante) |
|---|---|---|---|
| `player_attack_all_slots` | 0x0d96 | 4 | `[bp+4]`=nº de armas que atacan · `[bp+6]`=actor |
| `attack_one_weapon_slot` | 0x0d3c | 4 | `[bp+4]`=nº de armas · `[bp+6]`=id de objeto |
| `attack_dispatch_by_reach` | 0x0c52 | 4 | `[bp+4]`=id de arma · `[bp+6]`=actor |
| `melee_strike_resolve` | 0x0bf8 | 6 | `[bp+4]`=arma · `[bp+6]`=objetivo · `[bp+8]`=actor |
| `adjacent_attacker_interferes` | 0x09fc | 2 | `[bp+4]`=actor que dispara |
| `sum_of_squared_deltas` | 0x0458 | 8 | `(ax,ay,bx,by)` empujados en ese orden |
| `print_miss_or_failed` | 0x00d2 | 2 | `[bp+4]`=objetivo |

El **llamante** cierra la convención: `COMBAT.OVL:0x08e0` empuja `g_cmb_actor` y luego su
`[bp-0xa]`, y salta al thunk que resuelve a `player_attack_all_slots`. Por eso `[bp+6]` es
el actor y `[bp+4]` el contador — no al revés.

### El contador de armas manda TRES cosas distintas

`[bp+4]` no es un modo: es **cuántas ranuras tienen valor de ataque**, y se consulta con
tres umbrales diferentes:

- `== 0` (0x0dab) → junto con el bit `0x80` del registro, manda a la vía de manos desnudas.
- `<= 1` (0x0dde) → salta el bloque de sonido/espera del preámbulo.
- `<= 1` (0x0d50, ya dentro de `attack_one_weapon_slot`) → **no imprime el nombre del arma**.
  Con dos o más armas sí lo imprime (`":\n"`, y el nombre sale de la tabla de punteros de
  equipo, DS `0x17f6`, indexada `<<1`).

Las tres ranuras se leen del registro de personaje con paso 0x20 en los desplazamientos
`+0x55c1`, `+0x55c3` y `+0x55c4` (0x0df8-0x0e1c) — casco y las dos manos, saltándose
`+0x55c2`. Coincide con `combat.md`.

---

## 2. 🔴 La normalización «alcance 1 ⇒ melé» existe SÓLO en la rama de los bichos — y da igual

`attack_dispatch_by_reach` bifurca por el bit `0x80` del byte +0 del registro de combate
(tabla de 32 registros de paso 8, base DS `0xba16`):

- **bit puesto** (0x0c9e, jugador): alcance = tabla de alcance por arma, DS `0x1664`,
  indexada por el id de objeto. **Sin normalizar.**
- **bit claro** (0x0c72, criatura): alcance = tabla de alcance por enemigo, DS `0x159c`, y
  acto seguido `cmp ax,1 / jne / mov word [bp-8],0` (0x0c81-0x0c8a): **el valor 1 se
  convierte en 0**, o sea en melé.

La asimetría es real en el código. **MEDIDO en `DATA.OVL`** (imagen de datos, `fileoff = DS
+ 0x10`; extensiones tomadas del catálogo `re/tools/dataovl_catalog.py`, no estimadas):

| tabla | DS | entradas | distribución de valores |
|---|---|---|---|
| alcance por arma | 0x1664 | 55 | `0`×37 · `2`×2 · `3`×1 · `4`×3 · `5`×1 · `7`×1 · `8`×1 · `15`×9 |
| alcance por enemigo | 0x159c | 48 | `1`×29 · `2`×1 · `3`×2 · `5`×4 · `7`×2 · `9`×9 · `15`×1 |

⇒ **la tabla de armas no contiene ni un solo 1**. La normalización que le falta a la rama
del jugador **no puede cambiar nada**: es inerte por los datos, no por el código. La misma
normalización en la rama de las criaturas sí carga peso — **29 de 48** tipos son melé
gracias a ella.

**Consecuencia práctica:** esto NO es una divergencia y no debe registrarse como tal. Quien
lea sólo el código verá una asimetría sospechosa y querrá «arreglarla» en el port; la
medición dice que el arreglo sería un no-op. Lo dejo escrito precisamente para que nadie
gaste la tanda dos veces.

---

## 3. 🔴 Manos desnudas leen un byte FUERA de su tabla — y es una cadena de texto

En la rama del jugador, el id `0xff` (manos desnudas) está especialmente tratado **para el
alcance** (0x0cb4 fuerza `[bp-8]=0`) pero **no para el segundo campo**: el flujo cae a
0x0cb9, que vuelve a cargar `bx` con el id y lee `byte [bx+0x169c]`.

Con id `0xff` eso es DS `0x179b`. La tabla que ahí se pretende indexar arranca en DS
`0x169d` y tiene **55 entradas** (medido en el catálogo), o sea acaba en DS `0x16d3`.
DS `0x179b` cae **199 bytes más allá**, dentro del pool de nombres de equipo (DS `0x174c`,
168 bytes). El byte leído es **`0x73` = `'s'`**, la `s` final de `"Quarrels"` — verificado
abriendo `DATA.OVL` en ese desplazamiento.

**Es inocuo, y esto también está medido, no supuesto:** el valor va a `[bp-2]`, y `[bp-2]`
sólo se consume en la vía a distancia (0x0d28-0x0d31). Manos desnudas tiene el alcance
forzado a 0, así que toma siempre la vía de melé (0x0ccb-0x0d26), donde `[bp-2]` no se
menciona. Lectura basura, valor muerto.

**Para el port:** no hay que reproducirlo, pero conviene saber que existe — un clon que
calcule ese campo *antes* de bifurcar, con una tabla de 55 entradas y un índice 255, se
sale del array. El original no se entera porque no mira el resultado.

---

## 4. 🔴 La interferencia del tirador tiene una puerta de An Tym que el port NO tiene

`adjacent_attacker_interferes` decide si el enemigo que te golpeó el último te estropea el
disparo. Cadena de guardas leída (todas devuelven 0 salvo la última):

| # | offset | guarda |
|---|---|---|
| 1 | 0x0a03 | último atacante = `byte [actor + 0x58a8]`; si vale `0xff` → 0 |
| 2 | 0x0a1e | su registro de combate (base DS `0xba16`, paso 8) con byte +0 a cero = ranura vacía → 0 |
| 3 | 0x0a23 | `call` a CS `0x5646`; si devuelve 0 → 0 |
| 4 | 0x0a2a | `test byte [si], 0x0c` — si **cualquiera** de los bits `0x04`/`0x08` está puesto → 0 |
| 5 | 0x0a2f | **`cmp byte [g_time_spell], 0x54` → si es An Tym, → 0** |
| 6 | 0x0a36 | distancia (rutina de distancia euclídea, 0x04d4) **exactamente 1**; si no → 0 |

Si las seis pasan: espera, imprime el nombre del interferidor y `" interferes!"`, y
devuelve 1.

**El port** (`game/src/core/combat/combat.ts:2017-2029`, `rangedInterference`) implementa
las guardas 1, 2/3 (`isActive`), 4 (como `sleeping`) y 6 (`combatDistance !== 1`), y su
docblock cita correctamente `COMSUBS:0x09FC`. **La guarda 5 no está.**

No es que el port ignore An Tym: lo modela en otros sitios y con la constante correcta —
`combat.ts:1372` y `combat.ts:3228` comparan `timeSpell === "T"`, con el valor 0x54 citado
en el comentario. Es **este** consumidor el que se quedó sin la puerta.

**Efecto, con su grado:**
- MEDIDO en el binario: bajo An Tym la interferencia no ocurre nunca; el disparo sigue.
- MEDIDO en el port por lectura: `rangedInterference` no consulta `timeSpell`, y el turno
  del jugador no está gateado por él (el `return []` de `combat.ts:3228` es del turno del
  ENEMIGO, según su propio comentario). Luego bajo An Tym el clon puede emitir
  `"X interferes!"` y **cancelar el disparo** donde el original lo deja volar.
- **Mueve stream**: la vía de interferencia retorna antes de gastar munición y antes de la
  tirada de acierto. Un disparo cancelado en el clon y no en el binario descuadra el
  consumo de RNG desde ese punto.
- NO MEDIDA la alcanzabilidad (con qué frecuencia se dispara un arma de proyectil, teniendo
  al último atacante adyacente, durante los turnos de An Tym). Es una cota que no he
  calculado; la divergencia es de mecanismo, y la dimensiono como desconocida.

### RESUELTA (#77) — y la acotación que a esta sección le faltaba

**Portada**: la guarda 5 está en `combat.ts::rangedInterference`
(`if (this.opts.state.timeSpell === "T") return false;`), entre G4 y G6 para que el mapeo
con el asm se lea de corrido; el orden es observacionalmente libre porque las seis guardas
son lecturas puras. Tests en `game/tests/antym-ranged-interference.test.ts` (5), con
control POSITIVO y sus dos mutantes.

★ **Y esta sección SOBRESTIMABA el alcance.** Enunciaba la divergencia sin acotarla, y el
propio clon la acota — censo de `lastAttacker` en `combat.ts`, leído:

| dónde | qué hace |
|---|---|
| dos ramas de melee de `enemyTurn` (charmed y genérica) | **las ÚNICAS que lo escriben** |
| `enemyTurn`, primera línea | `if (timeSpell === "T") return []` ⇒ **con el hechizo puesto NADIE lo escribe** |
| `advanceTurn` | lo **BORRA** (`currentActor.lastAttacker = null`) al cerrar el turno de ese actor |

⇒ **la guarda que faltaba sólo podía disparar para un miembro golpeado ANTES de que subiera
An Tym y que aún no hubiera cerrado su turno**; después es inerte mientras dure el hechizo.
El caso vivo es concreto: *el enemigo golpea a B → en la ronda siguiente A lanza An Tym → B
dispara con arco*. No anula la divergencia (existía y movía stream), pero la reduce de «todo
combate con An Tym» a **una ronda**. Grado: MEDIDO — el test (c) ejerce el borrado y
comprueba que con `lastAttacker === null` la guarda 1 corta antes.

**Cabo cerrado de paso:** `consumeAmmo` **no consume RNG** (aritmética de inventario con el
wrap `& 0xff` de #18) ⇒ la tirada que el clon se saltaba era la de `rollWeaponHit`, una, más
las de `strike` si acertaba.

---

## 5. El fallo se anuncia de dos maneras, y sólo una nombra a alguien

`print_miss_or_failed`, leída entera (34 B): si la bandera de «esto es un hechizo» no es
cero imprime **`"Failed!\n"`** (DS `0x99a0`) **y nada más**; si es cero imprime el nombre
del combatiente y luego **`" missed!\n"`** (DS `0x99aa`). Cadenas leídas de `DATA.OVL`.

El nombre que imprime es el del **objetivo**: `melee_strike_resolve` le pasa su `[bp+6]`
(0x0c48), que es el objetivo por el orden de `push` del §1. Esto **ya está declarado en el
port** con más detalle que el que yo iba a darle — `combat.ts:2048-2056` lo explica y hasta
razona el «Orc missed!». No hay divergencia; lo dejo anotado porque la lectura del cuerpo
lo confirma por un camino independiente.

---

## 6. Cabos que dejo ABIERTOS (no son hallazgos)

**(a) Las banderas de hechizo/magia se rearman sólo con dos o más armas.**
`attack_one_weapon_slot` pone a cero las dos banderas (0x0d58-0x0d5b) **dentro** del bloque
que exige contador ≥ 2. Con una sola arma no las toca, y `attack_dispatch_by_reach` sólo
sabe **poner** la de magia (0x0c5f, cuando el id del arma es ≥ 0x23): nunca la quita.

Censo de escritores y consumidores de las dos banderas (DS `0x588f` y `0x5890`) sobre los
28 `.asm`, por nombre vivo: **7 escrituras** (dos en CAST, tres en COMSUBS, cuatro en
COMBAT contando pares) y **13 lecturas** (siete en COMSUBS, seis en COMBAT, incluida la de
la tirada de acierto). Entre ellas, `COMBAT.OVL:0x0c53-0x0c5e` pone a cero ambas — pero
vive dentro de `combat_main_loop`, que **sigue pendiente de leer** y no es de mi fichero.

⇒ **No afirmo que haya bandera rancia.** Para cerrarlo hay que leer `combat_main_loop`
entero y ver si ese rearme domina todo ataque del jugador. Lo dejo como cabo con su
localización exacta, no como bug. (Regla que estoy aplicando a mí mismo: una condicional
sin medir no es una salvedad, es la medición que falta.)

**(b) Los bits `0x04`/`0x08` del byte +0 del registro de combate.**
`actor-flags-invisible-0x10.md` §final dice que esos bits «nadie los ha tocado». Esta
lectura aporta **un consumidor**: la guarda 4 del §4 los prueba **juntos** (`test ..., 0x0c`),
tratándolos como una sola condición de «este no interfiere». El port los mapea a `sleeping`.
No basta para bautizarlos —un consumidor no fija el significado él solo— pero es más de lo
que había. No toco esa nota.

---

## 7. Alcance de esta nota

Lo que **no** he hecho, para que no se herede como hecho:

- No he tocado el port. Lo del §4 y §5 es **lectura** de `combat.ts`, con línea citada.
- No he leído `combat_main_loop` (COMBAT.OVL) ni ninguna otra fila fuera de mi lote; las
  llamadas salientes están resueltas por dirección y usadas por su rol, no por su cuerpo.
- Las ocho rutinas restantes de COMSUBS (la vía a distancia, el proyectil y el cursor de
  puntería) quedan para las tandas siguientes.

---

# TANDA 2 — la vía a distancia: dispersión, munición y el aterrizaje del proyectil

Tres cuerpos más (824 B): `player_ranged_attack` 0x0a68, `projectile_resolve_landing`
0x0822 y `pick_random_adjacent_cell` 0x07d4.

## 8. La dispersión del fallo: DOS bucles anidados, ninguno acotado

`pick_random_adjacent_cell` (78 B) sortea una celda del anillo de 3×3 alrededor de un
centro. Cada intento consume **dos tiradas** (una por eje) y las suma al centro restando 2;
para que el resultado caiga en el anillo, cada tirada rinde **tres desenlaces
equiprobables** — lo digo por el desenlace y no por el par de argumentos, que es
precisamente donde la notación de esa rutina de azar se lee al revés con facilidad.

Sus únicos reintentos son **cuatro guardas de tablero** (0x0805-0x081a): rechaza si la x o
la y se salen de 0..10, y **vuelve a tirar LAS DOS**. Sin tope de intentos.

🔴 **Corrección de ATRIBUCIÓN, no de contenido.** `combat.md` §«A distancia» dice que el
proyectil «aterriza en una celda aleatoria adyacente al objetivo (0x07D4, **reintenta si es
la del tirador**)». El comportamiento es correcto, pero **ese reintento no está en 0x07d4**:
las guardas de esa rutina son sólo las de tablero. El rechazo de la celda del tirador vive
en el LLAMANTE, `projectile_resolve_landing` 0x0866-0x0870, que compara el resultado contra
las coordenadas del actor (campos +4 y +5 de su registro de combate) y **re-llama al
picker**. Son por tanto **dos bucles anidados sin tope**, y el de fuera vuelve a pagar dos
tiradas por vuelta.

**No sobrescribo `combat.md`** — dejo la discrepancia señalada para que la adjudique quien
la escribió. El **port acierta**: `combat.ts:2060-2066` cita `COMSUBS:0x0822 0852-0870` (el
llamante, no el picker) y reproduce la estructura anidada, con `randomAdjacentCell` en
`formulas.ts:260` implementando sólo las guardas de tablero. La prosa de la nota es lo
único desalineado.

## 9. Un fallo sin objetivo NO dispersa

En `player_ranged_attack`, tras buscar quién ocupa la celda apuntada:

| caso | qué se pasa como «acertó» al aterrizaje |
|---|---|
| hay objetivo vivo | el resultado de la tirada de acierto (0x0b51) |
| **no hay nadie** | **el literal 1** (0x0b77) |

⇒ disparar a una casilla vacía entra al aterrizaje por la rama de ACIERTO y **se salta la
dispersión entera** (0x0852 exige que la bandera sea cero para dispersar). El proyectil
vuela recto a donde apuntaste. Sólo se dispersa el fallo **contra alguien**.

## 10. 🔴 Dos armas leen una local SIN INICIALIZAR cuando fallan

`projectile_resolve_landing` reserva 14 bytes de locales sin limpiarlos. La local que decide
si hubo aterrizaje se escribe en **dos** sitios: el literal 1 de 0x089e y el retorno de la
animación de vuelo en 0x08b8. Pero la rama de las armas cuyo identificador es 0x19 o 0x22
(0x087e-0x088a) comprueba la bandera de acierto en 0x088c y, **si es cero**, salta directa a
0x08d6 — que es justo donde esa local se lee. **En ese camino no la ha escrito nadie**: se
decide con basura de la trama anterior.

Grado, honesto: **MEDIDO** que el camino existe y que ninguna de las dos escrituras lo
cubre (leídas las dos, y el `sub sp,0xe` no limpia). **NO MEDIDO** qué valor suele quedar
ahí — depende de la trama del llamante, y no lo he ejecutado. Tampoco he censado cuántas
armas reales llevan esos dos identificadores. No lo propongo como fila del registro de bugs
hasta que alguien cierre esas dos cosas; lo dejo localizado.

## 11. Los cuatro tiles de campo, decodificados

Al aterrizar, el arma decide qué tile se planta, con un `cmp` por caso (0x08eb-0x0907). Los
valores no son mágicos: son **cuatro consecutivos**, uno por familia de campo, y dos armas
comparten el mismo:

| identificador de arma | tile plantado |
|---|---|
| 0x33 | 0xe8 |
| 0x34 | 0xe9 |
| 0x13 (aceite ardiendo) **y** 0x35 | 0xea |
| 0x36 | 0xeb |

Que el aceite comparta tile con 0x35 y que los cuatro sean consecutivos es la lectura que
cierra el grupo: son las cuatro clases de campo del juego, y el aceite deja el mismo que la
primera de ellas.

## 12. Dos guardas independientes contra pegarse a uno mismo

El tirador está protegido **dos veces**, y por caminos distintos: (a) la celda de dispersión
no puede ser la suya (0x0866, §8), y (b) aunque lo fuera, el aterrizaje descarta a la
víctima si coincide con el actor activo (0x0936-0x093e). Dos guardas para un caso — quien
retire una por «redundante» deja la otra sosteniéndolo sola.

Además, un hechizo que FALLA no daña a nadie: 0x0923-0x092e sale antes de mirar quién ocupa
la celda si la bandera de hechizo está puesta y la de acierto no.

## 13. El aceite ardiendo tiene su propia reserva

Antes de gastar munición por la vía normal, 0x0ace-0x0af8 trata el identificador 0x13 aparte:
si el contador de una tabla de reservas indexada por arma (base DS `0x57c0`) no es cero, lo
**decrementa**; sólo si está a cero cae a la rutina que quita la unidad de las ranuras del
personaje. Es una reserva por arma, distinta del inventario compartido de flechas y virotes.

## 14. Lo que la tanda 2 NO toca

`aim_cursor_prompt` (0x0504), `projectile_draw_frame` (0x0f4a), `compute_line_cell_path`
(0x0e26), `print_attack_result` (0x0312) y `enemy_special_ability_turn` (0x00f4) siguen sin
leer. Las llamadas salientes de esta tanda hacia ellas están resueltas por dirección y
usadas por su rol.

---

# TANDA 3 — la traza de la línea y el parte de daños

Dos cuerpos más (618 B): `compute_line_cell_path` 0x0e26 y `print_attack_result` 0x0312.

## 15. La traza de la línea: geometría pura, CERO azar, y un presupuesto de 328 pasos

`compute_line_cell_path` (292 B, `ret 0xc` = seis argumentos) recorre la recta entre dos
celdas y **escribe la ruta en dos búferes de bytes** que el llamante le pasa por puntero
(`[bp+6]` para una coordenada, `[bp+4]` para la otra; los incrementa a medida que emite, y
al terminar planta un **centinela 0xFF en los dos**, 0x0f36-0x0f41).

Tres cosas que conviene tener medidas antes de portar nada que dependa de ella:

**(a) No consume azar.** Ni una llamada al generador en los 292 bytes. Para contabilidad de
paridad de stream, esta rutina es transparente: da igual cuántas veces se llame.

**(b) La pendiente es punto fijo ×100.** 0x0e45-0x0e59 multiplica la diferencia de un eje
por 100 (`imul cx` con cx = 100) y divide por la del otro. El caso de recta vertical se
resuelve aparte con el valor 0x4b00 — que **no es una constante mágica**: es 19200 = 192,00
en ese mismo punto fijo, o sea «pendiente enorme». Decodificado antes de teorizar, como
manda el carril.

**(c) 🔴 Hay un presupuesto de pasos, y es una constante con nombre propio.** La local que
se inicializa a 0x148 (= **328** pasos) se decrementa en **los dos** bucles internos
(0x0efa y 0x0f30) y es quien corta la marcha: el bucle exterior sigue mientras no llegue a
cero (0x0eff). No es un contador de la geometría — es un **tope duro** independiente de la
longitud real de la recta. Quien porte esto con un `while` guiado sólo por las diferencias
de coordenadas **no reproduce el corte**, y con datos raros el binario para donde el clon
seguiría.

**(d) La división SÍ está guardada, y el contraste importa.** El `idiv` de 0x0e57 divide por
la diferencia de un eje; el `je` de 0x0e43 desvía **antes** exactamente el caso en que esa
diferencia es cero. O sea: aquí el original **sí** protege su división. Vale la pena dejarlo
escrito junto al defecto hermano ya conocido —la rutina de azar compartida, que **no** tiene
guarda equivalente y cuelga duro—: no es que el binario ignore el problema en general, es
que lo resolvió en un sitio y no en el otro. Un carril que vea el segundo caso puede creer
que es el estilo de la casa; no lo es.

## 16. El parte de daños: un bitfield de desenlace y una escala que va AL REVÉS

`print_attack_result` (326 B, `ret 4`; `[bp+4]`=actor, `[bp+6]`=víctima) es el único
consumidor que he leído del bitfield de resultado (DS `0x58a2`). Cadena de prioridad, en
orden, con las cadenas leídas de `DATA.OVL`:

| orden | condición | sale |
|---|---|---|
| 0 | — | limpia el bit 0x01 de entrada |
| 1 | bit 0x20 del bitfield | nombre + `" grazed!"` + glide |
| 2 | bits 0x20 **o** 0x02 | **RETORNA YA**, limpiando 0x20 y 0x02 |
| 3 | bit 0x20 del **registro de la víctima** | nombre + `" killed!"`, y **enciende** el bit 0x01 |
| 4 | bit 0x04 del bitfield | nombre + `" slept!"` |
| 5 | bit 0x08 del bitfield | **silencio** (no imprime nada) |
| 6 | víctima con bit 0x80 (del party) | ver §17 |
| 7 | víctima criatura | escala de heridas, ver abajo |

Al salir limpia los bits 0x04 y 0x08 (0x0432), y si la víctima era del party fuerza dos
redibujados (0x042c-0x042f).

🔴 **La escala de heridas de las criaturas va AL REVÉS de como se lee.** Una rutina externa
devuelve 1..4 y el conmutador (0x040b-0x041d) mapea:

| devuelve | mensaje |
|---|---|
| 1 | `" critical!"` |
| 2 | `" heavily wounded!"` |
| 3 | `" lightly wounded!"` |
| 4 | `" barely wounded!"` |

**Número más BAJO = herida más GRAVE.** Quien ordene esa tabla «de menos a más» la invierte
entera y el juego miente en cada golpe. El port lo tiene bien: `combat.ts:78` declara la
lista con el índice 1 en `critical!` y el 4 en `barely wounded!`, en ese orden exacto.

## 17. 🔴 El literal 0x2d es el CORPSER, y la cadena lo demuestra sola

El caso de víctima del party (0x03a4-0x03f9) no imprime `" hit!"` sin más: primero comprueba
si el atacante es de un tipo concreto —el identificador de criatura **0x2d**, leído del byte
+1 de su registro de combate— y sólo entonces emite `" dragged under!"`.

No hace falta adivinar qué criatura es: **la propia cadena la nombra**. «Dragged under» es
el agarre del corpser, y el segundo testigo es independiente — existe una rutina hermana de
escape del agarre en el otro overlay de combate (`corpser_grip_escape`). Dos caminos, misma
criatura. El literal queda decodificado sin recurrir a ninguna tabla que pudiera ser la
equivocada.

Y el agarre **no es sólo un mensaje**: enciende el bit 0x04 en el registro de la víctima
(0x03e0) y pone a cero un byte del registro auxiliar indexado por su campo +2 (0x03ed),
además de un glide y una espera. Es decir, el estado «agarrado» se planta aquí, en la
rutina que parece de impresión. **Otro caso de la ficha de clase «dibujar/imprimir no es
sólo-lectura»** — el tercer subsistema donde aparece.

El port lo cubre y con la cita correcta (`combat.ts:1569` y `:1584` citan el gate y la
cadena). Confirmación por camino independiente, no hallazgo nuevo.

## 18. Lo que queda de COMSUBS

Tres filas: `aim_cursor_prompt` (580 B), `projectile_draw_frame` (916 B) y
`enemy_special_ability_turn` (542 B).

---

# TANDA 4 — las habilidades especiales del enemigo, contadas POR RAMA

`enemy_special_ability_turn` 0x00f4 (542 B, `ret 2`; `[bp+4]` = actor). Es la rutina más
cara en azar de todo el fichero, y su consumo **no se puede resumir en un número por
rutina**: hay que contarlo rama a rama.

## 19. La puerta de entrada: dos hechizos de tiempo y un bit

Antes de cualquier habilidad, 0x0112-0x0125 corta en tres:

| condición | resultado |
|---|---|
| el hechizo de tiempo vale 0x1c | devuelve 0, **cero tiradas** |
| el hechizo de tiempo vale 0x4e | devuelve 0, **cero tiradas** |
| el actor tiene el bit 0x80 (es del party) | devuelve 0, **cero tiradas** |
| resto (criatura, sin esos hechizos) | entra a las tres habilidades |

De los dos valores de hechizo, 0x4e es el que ya está identificado en el port como el de
anular magia (`combat.ts:407` lo compara y lo nombra). **El 0x1c no lo he identificado** y no
me lo invento: queda como constante medida sin bautizar.

## 20. Tres habilidades EN CASCADA, cada una con su tirada

Las tres se consultan en orden sobre la palabra de banderas por tipo de criatura (DS
`0x153c`, indexada `<<1`), y **si una no se dispara se cae a la siguiente**. Los tres bits
coinciden exactamente con los que `combat.md` §11 ya tenía tabulados — confirmación
independiente, no renombre.

| orden | bit | habilidad | cadena |
|---|---|---|---|
| 1 | 0x0040 | posesión | `" possessed!"` |
| 2 | 0x0800 | invisibilidad | `" disappears!"` / `" reappears!"` |
| 3 | 0x0400 | invoca daemon | `" gates in a daemon!"` |

### 🔴 CONTABILIDAD DE TIRADAS, rama a rama (que es como hay que darla)

| rama | tiradas | cuándo se pagan |
|---|---|---|
| puerta de entrada cerrada (§19) | **0** | — |
| bandera 0x0040 presente | **1** + las de la salvación | la tirada se paga **SIEMPRE**, incluso si la ranura sorteada está vacía |
| bandera 0x0800 presente | **1** | **SIEMPRE**, antes de decidir si acierta |
| bandera 0x0400 presente | **1** | **SIEMPRE**, antes de decidir si acierta |

⇒ una criatura con las tres banderas puede pagar **hasta 3 tiradas + la de la salvación en
un solo turno**, y una que no dispare ninguna habilidad **paga igual** las de las banderas
que tenga. El número no depende del desenlace visible: **es invisible en una traza que sólo
mire lo que pasa en pantalla**, que es justo la clase de consumo que descuadra la paridad
sin dejar rastro.

### La posesión sortea una RANURA, no busca una víctima

0x013b-0x0145 tira sobre el rango de las 32 ranuras de combate y usa el resultado **como
índice directo**. No hay barrido, no hay «el más cercano», no hay reintento: si la ranura
que sale no es del party (bit 0x80) o ya arrastra alguno de los estados del filtro (la
máscara 0x3d), la habilidad **simplemente no ocurre** y se cae a la siguiente — pero la
tirada ya está gastada. Si sí procede, se juega la salvación (la rutina del principio del
fichero) y sólo al fallarla se enciende el bit 0x01 en la víctima, se imprime, y **si la
víctima era el personaje activo se pone el activo a 0xff**.

Detalle que cierra el círculo con la §21: si la criatura poseedora es del tipo 0x26, la
posesión remata con una llamada extra pasando `-(actor)-1` — el mismo tipo 0x26 que la
tercera habilidad **invoca**. Es el daemon.

### La invisibilidad es un INTERRUPTOR, no un estado que se pone

0x01d7-0x023b: con probabilidad **32 entre 256 = 1/8** (medido: tira sobre 0..255 y exige
`< 0x20`), la criatura **conmuta**:

- si el byte +1 de su registro auxiliar está a cero → **reaparece**: limpia el bit 0x10 de
  su registro de combate y **restaura** ese byte desde el +0 del mismo registro auxiliar.
- si no → **desaparece**: enciende el bit 0x10 y **pone a cero** el byte +1.

El bit 0x10 es el de invisibilidad ya acreditado en `actor-flags-invisible-0x10.md`; lo que
esta lectura añade es **el par de bytes del registro auxiliar que hace de memoria del tile**
(+0 guarda, +1 es el vivo) y que el mecanismo es simétrico: la misma tirada sirve para
esconderse y para volver.

### La invocación del daemon: 1/8 y CUATRO guardas en cadena

0x024e-0x0306: la misma probabilidad de 1/8, y después **cuatro** condiciones que pueden
abortar (dos llamadas de comprobación, la colocación de la celda y el alta de la criatura,
que devuelve el centinela 0xffff si no cupo). Sólo si las cuatro pasan se imprime y se
invoca al tipo 0x26.

🔴 Y la invocación **pinta a través del registro auxiliar**: escribe el valor 0x16 en los
bytes +0 y +1 del auxiliar de la criatura nueva, lanza la animación, y **después** los
sobreescribe con 0xd8. O sea, la rutina de habilidades **muta estado de presentación como
parte del efecto** — cuarto caso de la ficha de clase «dibujar no es sólo-lectura», y aquí
además el valor intermedio es visible durante la animación.

## 21. Alcance de la tanda 4

Quedan **DOS** filas de COMSUBS: `aim_cursor_prompt` (580 B) y `projectile_draw_frame`
(916 B). No las he leído. Las llamadas salientes de esta tanda hacia el resto están
resueltas por dirección y usadas por su rol, no por su cuerpo.

---

# TANDA 5 — el cursor de puntería

`aim_cursor_prompt` 0x0504 (580 B, `ret 4`; `[bp+4]` = alcance, `[bp+6]` = actor).

## 22. El arranque: el último objetivo, con CINCO condiciones para conservarlo

`careo-combate-fixes.md` §#4 ya estableció que el cursor arranca en el último objetivo del
actor «si sigue vivo y a distancia ≤ alcance», y que si no, en la celda del propio actor.
**Lo confirmo leyendo el cuerpo, y añado las condiciones exactas.** El índice recordado sale
del registro auxiliar del actor (campo +7) y se conserva sólo si pasa **las cinco**
(0x0539-0x0560); si falla **cualquiera**, el cursor cae en la celda del actor (0x0562):

| # | offset | condición |
|---|---|---|
| 1 | 0x0539 | el índice recordado no puede pasar de 31 (descarta el centinela) |
| 2 | 0x053f | `test ..., 0x30` — ninguno de los bits 0x10 / 0x20 puesto |
| 3 | 0x0546 | su registro de combate no puede estar a cero (ranura vacía) |
| 4 | 0x054f | el primer byte de su registro auxiliar no puede ser cero |
| 5 | 0x055a | la distancia actor→recordado **no puede pasar del alcance** |

La 2 y la 4 no estaban escritas en ninguna parte. Y sigue siendo cierto lo esencial:
**no hay barrido de «el más cercano»** — o vale el recordado, o es la celda propia.

## 23. Las ocho direcciones y la doble acotación del cursor

El bucle lee tecla (0x063d) y despacha: cuatro códigos para las ortogonales y **cuatro más
(0xd3, 0xd4, 0xd5, 0xd6) para las diagonales**, cada uno fijando el par de incrementos. La
celda candidata se acepta sólo si pasa **dos** filtros independientes:

- **alcance**: la distancia del ACTOR a la celda candidata no puede pasar de `[bp+4]`
  (0x05f8). Ojo — se mide desde el actor, no desde la posición actual del cursor.
- **tablero**: las dos coordenadas han de estar en 0..10 (0x0600-0x0616).

Si cualquiera falla, el cursor **no se mueve** y el bucle sigue. No hay mensaje.

## 24. Confirmar, cancelar e ignorar — los tres desenlaces, y el que se ignora

| tecla | sobre la celda del ACTOR | sobre cualquier otra |
|---|---|---|
| ESC | cancela | cancela |
| Espacio | **cancela** | confirma |
| Intro / `A` | **se ignora** (sigue el bucle) | confirma |

Es exactamente lo que `careo-combate-fixes.md` §#4 declaraba; el cuerpo lo confirma por
lectura directa. Al cancelar devuelve 0 tras una espera; al confirmar devuelve la distancia
calculada.

**Literal decodificado:** al confirmar, si la bandera de hechizo no es cero, suena un tono
cuya frecuencia es `0x1f40 + bandera·0x640` (0x06c8-0x06de) — es decir **8000 + id·1600**:
cada hechizo tiene su propio tono, no es una constante.

## 25. Un vestigio inofensivo, y por qué NO es un hallazgo

0x05b9-0x05bc carga dos registros desde dos locales **que esta invocación todavía no ha
escrito** (sólo se escriben al salir, 0x0720) y el marco no se limpia. Parece la hermana de
la lectura sin inicializar de la §10 — **pero no lo es, y la diferencia se puede demostrar**:
desde ahí el flujo salta incondicionalmente a 0x0624, cuyos dos banderines **sí** acaban de
ponerse a cero (0x0582-0x0587), así que ambos `je` se toman y se llega **siempre** a 0x0636,
que es justo `sub di,di` / `mov si,di`. Los valores basura quedan **provablemente muertos en
todos los caminos**.

Lo anoto como vestigio (un diseño anterior en el que la dirección persistía entre llamadas)
y **no** como defecto. La §10 sí lo es porque allí el valor **se lee** después.

## 26. 🔴 Un nombre del ledger que no le cuadra al cuerpo — NO lo cambio, lo señalo

La rutina de 0x048a está en el ledger como `isqrt`, nombre que promete **un** argumento. Su
cuerpo termina en `ret 8`: **cuatro**. Y quien la llama la usa como distancia entre dos
PUNTOS, no como raíz de un número:

- `euclidean_distance` (0x04d4, `ret 4` = dos índices de actor) resuelve las coordenadas de
  los dos y le pasa **cuatro bytes** (0x04eb-0x04fb).
- el cursor (0x05e4-0x05f2) le pasa **cuatro** directamente: las dos del actor y las dos de
  la celda candidata.

⇒ la pila real es de tres capas: la suma de cuadrados (cuatro coordenadas) → **0x048a, que
es distancia-entre-puntos** → `euclidean_distance`, que es la capa de conveniencia por
índice de actor. El nombre `isqrt` describe como mucho lo que la rutina hace por dentro, no
lo que es ni cómo se la llama.

Esa fila está sellada por otro carril y **no la toco**: lo dejo señalado para que lo adjudique
quien la nombró. Dato duro para esa adjudicación: `ret 8`, y dos llamantes distintos pasando
cuatro argumentos.

## 27. Queda UNA fila

`projectile_draw_frame` (916 B) es lo único pendiente de COMSUBS.OVL.

---

# TANDA 6 — el dibujo del proyectil, y COMSUBS.OVL queda CERRADO

`projectile_draw_frame` 0x0f4a (916 B, `ret 0xc` = seis argumentos). Con ésta, **las 23
filas de COMSUBS.OVL tienen cuerpo leído**.

## 28. 🔴 Hay una TABLA DE SALTO dentro del código, y el disasm la enseña como instrucciones imposibles

0x0fad-0x0fb0 despacha por el tipo de proyectil con
`add ax,ax` / `xchg bx,ax` / `jmp word ptr cs:[bx - 0xc0c]`. **El destino del salto es una
tabla de 8 palabras que vive en el propio segmento de código**, y el desensamblador, que no
sabe que ahí hay datos, la imprime como una ristra de instrucciones sin sentido
(un `bnd jle`, un `hlt`, un `adc dh,bl`) en 0x1214-0x1223.

Quien lea este fichero de arriba abajo se topa con eso y puede concluir que el `.asm` está
roto o que la rutina está decapitada. **No lo está: son datos.** Verificado leyendo los 16
bytes crudos del `.OVL`, no del desensamblado:

`b8 f1 06 f2 7e f2 f4 f2 00 f3 06 f3 0c f3 12 f3`

El desplazamiento `-0xc0c` es `0xf3f4` en 16 bits sin signo, y `0xf3f4 − 0xe1e0 = 0x1214`:
**la tabla empieza exactamente donde el disasm se vuelve absurdo.** Y las ocho palabras
resuelven así:

| tipo | palabra | offset de fichero | ¿cae en un caso? |
|---|---|---|---|
| 0 | 0xf1b8 | 0x0fd8 | sí |
| 1 | 0xf206 | 0x1026 | sí |
| 2 | 0xf27e | 0x109e | sí |
| 3 | 0xf2f4 | 0x1114 | sí |
| 4 | 0xf300 | 0x1120 | sí |
| 5 | 0xf306 | 0x1126 | sí |
| 6 | 0xf30c | 0x112c | sí |
| 7 | 0xf312 | 0x1132 | sí |

**Las ocho caen sobre el inicio de un caso. Ninguna falla.**

⇒ **Confirmación INDEPENDIENTE de la base 0xe1e0 de la banda 4.** `overlay-load-layout.md` §2
la valida con tres anclas, todas obtenidas de `call`. Ésta es de otra naturaleza —una tabla
de datos— y da **ocho** aciertos exactos de golpe. Si la base estuviera mal, las ocho
caerían en mitad de una instrucción. Lo dejo escrito porque es la clase de control que sale
gratis y nadie tiene que volver a fabricar.

El índice está **acotado** antes de saltar (0x0fa5 exige que no pase de 7), así que la tabla
no se puede desbordar.

## 29. El consumidor de la ruta trazada — se cierra el círculo con la §15

El caso 0 (0x0fd8) recorre **los dos búferes de bytes que `compute_line_cell_path` rellena**,
arrancando 4 posiciones antes del puntero recibido, y para en el **centinela 0xFF** (0x0fef)
o al llegar a **9 celdas** (0x101d), lo que ocurra primero. Es decir: la traza de la línea
produce una ruta terminada en 0xFF y este caso la pinta **de 9 en 9**. Las dos rutinas de la
§15 y de aquí son las dos mitades del mismo mecanismo, y ninguna se entiende sola.

## 30. 🔴 UNA RUTINA DE DIBUJO QUE GASTA 192 TIRADAS DE AZAR

Los casos de los tipos **3, 4, 5 y 6** no dibujan nada por sí mismos: cada uno se limita a
cargar un global distinto en la variable de estallido (0x1114 / 0x1120 / 0x1126 / 0x112c) y
caer al remate común. Y ahí, si esa variable quedó puesta (0x1224), arranca el bucle de
0x122d-0x12cf:

- **0x30 = 48 iteraciones** (contador puesto en 0x1246, decrementado en 0x12c7).
- **CUATRO llamadas al generador por iteración** (0x125b, 0x1268, 0x1275, 0x1282): dos para
  desplazar sendos índices dentro de una tabla de la propia sobrecapa, y dos monedas que
  **invierten el signo** de los dos multiplicadores de dirección.

⇒ **48 × 4 = 192 tiradas por estallido**, y los dos signos **se arrastran de una iteración a
la siguiente** (se guardan al salir, 0x12cf-0x12d2), así que la secuencia no es 48 sorteos
independientes: es una caminata.

**Etiquetado del alcance, para no sobrevender:** MEDIDO que son 192 tiradas por invocación
que llegue al bucle, y MEDIDO qué cuatro tipos lo activan. **NO medido** con qué frecuencia
se dibujan proyectiles de esos cuatro tipos en una partida — eso es una cota que no he
calculado.

**Por qué importa más que las otras cifras de esta nota:** es una rutina cuyo nombre dice
*dibujar*, y es con diferencia el mayor consumidor de azar de todo el fichero — dos órdenes
de magnitud por encima de cualquier otra cosa que haya leído aquí. Cualquier medición de
paridad de stream que cruce un proyectil de tipo 3-6 y **no** modele este bucle se descuadra
por 192 de golpe, y el sitio donde buscar la causa será el último en el que a nadie se le
ocurra mirar. **Quinto y más caro caso de la ficha de clase «dibujar no es sólo-lectura»** —
y el único de los cinco que toca el generador.

## 31. Cierre del fichero

**COMSUBS.OVL: 23 de 23 filas con cuerpo leído.** El carril `asm-overlays-6` lo deja a cero.

---

# TANDA 7 — las dos mediciones que el lead pidió, y una corrección a mi propio informe

## 32. La local sin inicializar: las DOS armas son el Lucero del Alba y la Alabarda

**(a) Cuántas armas reales llevan esos identificadores.** Leído del catálogo de `DATA.OVL`
(tabla de punteros a nombres de equipo, DS `0x17f6`, 48 entradas, indexada `<<1`):

| id | nombre | valor de ataque | alcance |
|---|---|---|---|
| 0x19 | **Morning Star** | 15 | **2** |
| 0x22 | **Halberd** | 30 | **2** |

**Son exactamente dos, las dos reales y corrientes, y no son dos cualesquiera: son las
ÚNICAS DOS ARMAS DEL JUEGO CON ALCANCE 2.** La distribución de la tabla de alcance por arma
(medida en la §2) tiene `2`×2 — y son éstas. O sea el caso especial de `087e` es **el caso
de las astas**, no un rincón: son las dos armas que atacan a dos casillas sin lanzar nada.

Y como su alcance no es cero, entran por la vía a distancia, así que **cada fallo con
Lucero del Alba o Alabarda recorre el camino de la lectura sin inicializar.** No es
esporádico: es «fallar con un asta».

**(b) Qué escribe esa local por última vez** (acotado sin ejecutar, por aritmética de
marcos). Con `P` = marco de `player_ranged_attack` y `B` = marco de
`projectile_resolve_landing`: los cinco argumentos y la dirección de retorno ponen
`B = P−0x1e`, y la local en cuestión cae en **`P−0x2a`**.

- El sorteo de dispersión **no la escribe**: `pick_random_adjacent_cell` no reserva locales
  y su marco entero arranca en `P−0x38`, muy por debajo.
- Las locales propias de la tirada de acierto tampoco: `sub sp,8` las deja entre `P−0x1e`
  y `P−0x24`, y la ranura está **6 bytes más abajo**.

⇒ **el último escritor está dentro del subárbol de la tirada de acierto** (sus propios
callees), que es la última llamada antes de entrar. INFERIDO de ahí, y lo marco como tal:
el valor **no es ruido aleatorio, es un residuo de un sitio concreto**, así que el
comportamiento debería ser **reproducible** para un mismo camino y unos mismos datos. No he
identificado el byte exacto: eso pide recorrer el subárbol de la tirada, y no lo he hecho.

**Lo que decide** (esto sí medido): la local se lee en `08d6`. Distinta de cero ⇒ se busca
quién ocupa la celda y **se le resuelve el golpe**. Cero ⇒ se devuelve «sin víctima». La
rama de acierto de las astas sí la pone a 1 (`089e`); la de fallo no pone nada. La
intención se lee sola: querían saltarse la animación de vuelo —que para un asta no tiene
sentido— y **se dejaron la bandera sin escribir en uno de los dos lados**.

## 33. 🔴 CORRECCIÓN A MI PROPIO INFORME (y a lo que el lead adjudicó a partir de él)

Al medir (a) abrí `combat.md` y encontré que **ya decía dos de las cosas que yo presenté
como aportación mía**. Lo dejo escrito porque una adjudicación se tomó con mi versión:

1. **`combat.md` ya nombraba las dos armas**: «Morning star (0x19) y halberd (0x22) no
   vuelan (golpe directo por encima, 087e-08a3)». Mi medición (a) **confirma y cuantifica**
   (son las dos únicas de alcance 2), no descubre.
2. **Mi «corrección de atribución» era más leve de lo que la conté.** Dije que la prosa
   escondía la localización. En realidad **la misma frase ya cita `0852-0870`**, que es el
   rango bueno del llamante. Lo impreciso es sólo el paréntesis que le cuelga el reintento
   a `0x07D4`. Lo que sí falta de verdad —y es lo que justifica la enmienda— son **los dos
   bucles anidados sin tope y las dos tiradas por vuelta**.
3. **Lo que sigue siendo nuevo**: el camino de FALLO de las astas (la nota sólo documenta
   su acierto) y, por tanto, la lectura sin inicializar.

Y lo mismo con el renombre de la §34: **no era mío**.

## 34. El renombre de la rutina de distancia: ejecuto un TICKET AJENO, no un hallazgo

La fila `0x048a` pasa de `isqrt` a **`point_distance`**. Y hay que decir de dónde sale:
**el carril `heredados-168-tanda2` ya lo había derivado entero** y lo dejó escrito en su
propia cita — leyó el cuerpo, anotó `ret 8` = cuatro argumentos, describió la cadena de
tres capas, dijo «EL CONTRATO NO ES `isqrt(n)`» y **cerró con un TICKET DE RENOMBRE
proponiendo exactamente `point_distance`**. No lo ejecutó.

Yo llegué por otro camino (el cursor de puntería le pasa cuatro coordenadas) sin haber
leído esa cita, y lo reporté como si fuera nuevo. **Lo que aporto es la re-derivación
independiente y el aviso de que el ticket llevaba abierto con el nombre viejo circulando**
— no el hallazgo ni el nombre.

Acreditación del renombre, toda del cuerpo: `ret 8`, y los **dos** llamantes pasándole
cuatro coordenadas (`0x04eb-0x04fb` y `0x05e4-0x05f2`). Las tres capas: suma de cuadrados →
**distancia entre dos puntos** → conveniencia por índice de actor.

**Nota de convención, para que nadie lea una contradicción donde no la hay:** la cita
heredada llama a los bytes de coordenadas «+6/+7» (base `0xba14`) y esta nota los llama
«+4/+5» (base `0xba16`, la del direccionamiento del disasm). **Son los mismos dos bytes.**

**Veredicto sobre `euclidean_distance` (0x04d4), que el lead pidió sin renombrar:** leída
entera (48 B, `ret 4`). Toma **dos índices de actor**, saca de cada uno sus coordenadas y
llama a la de arriba. **El nombre le cuadra** —devuelve una distancia euclídea de verdad—
pero es **poco específico**: no dice que sus argumentos son índices y no coordenadas, que
es justo la diferencia con su callee. No propongo cambiarlo; si algún día se toca,
`actor_distance` diría más.

## 35. Alcanzabilidad de la divergencia de An Tym (ficha #77)

Lo que **acota** la divergencia, con lo medido de cada término:

| término | valor | cómo |
|---|---|---|
| armas que pueden ser interferidas | **5 de 55** (arco, ballesta, arco mágico, aceite, honda) | MEDIDO: los cinco `cmp` de `0x0a6f-0x0a8b`; el port tiene el mismo conjunto en `combat.ts:115` |
| duración de An Tym por lanzamiento | **10 turnos** (20 con pergamino) | de `antim-freeze.md` §1, no re-medido por mí |
| además exige | que tu **último atacante** siga vivo, no dormido y **a distancia exactamente 1** | MEDIDO: guardas 1-4 y 6 de la §4 |

⇒ la ventana es: **cada turno en que el jugador dispara una de esas cinco armas mientras An
Tym está activo y con el último atacante pegado**. Bajo An Tym los enemigos están
congelados, así que el «último atacante» necesariamente lo fue **antes** del hechizo y
sigue adyacente sin poder moverse — lo que **aumenta** la probabilidad de que la condición
6 se cumpla, no la reduce: el enemigo se queda clavado donde estaba.

**NO MEDIDO, y es lo que impide dar un porcentaje:** con qué frecuencia una partida real
combina An Tym con disparo a quemarropa. Eso no sale del binario; pide trazas de juego. Lo
que sí queda acotado es que **no es un caso imposible ni raro por construcción** — es la
intersección de dos cosas que el jugador hace a propósito, y la congelación **favorece** la
adyacencia.
