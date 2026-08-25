# #84 R3+R4 — MEDICIÓN del orden del sembrador, y el gate de siembra

Ejecuta `prerregistro-84-R3-orden.md`. **Titular: mi propio prerregistro se
equivocaba de criterio.** Aposté a que «lo LOCAL le gana a lo heredado» era el orden
correcto; medido contra una verdad independiente, la localidad casi no correlaciona
con acertar y **la FORMA del nombre sí**. El orden que se aterriza es el que dijeron
los datos, no el que escribí antes de mirar. Lo dejo escrito antes de dar ninguna
cifra buena.

Piezas: **R3** (orden determinista, `routine_census.py`) y **R4** (el gate,
`re/tools/seed_gate.py` + su test, consumiendo `seed_diff.py` de heredados-168).
**NO** se regenera `routine-census.json` (embargo de #81).

---

## 1. El defecto D2, en una línea

El sembrador aplicaba las propuestas en orden de `sorted(glob("*.md"))` con
`setdefault`: **el nombre de fichero de una nota decidía la identidad de una
rutina**, y crear una nota que ordenase antes le robaba la semilla a la que la
tenía. Ya estaba medido en el acta anterior: `render_item_list` perdía contra la
palabra `banda` sólo por el `glob`.

## 2. ★ Lo que refutó el prerregistro

El prerregistro proponía dos escalones —LOCAL (el token de fichero está en la línea
de la adyacencia) por delante de HEREDADA (viene del `ctx` pegajoso)— **suponiendo**
que la localidad es señal de calidad. Eso hay que medirlo contra algo que no salga
del propio sembrador, y lo hay: los **479 pines curados** de `frontier-manual.json`,
nombres puestos por lectura de cuerpo. De ellos, 192 caen sobre claves que la prosa
también reclama. Ésa es la población de contraste.

| orden de aplicación | aciertos contra pin (de 192) | semillas sin guion bajo |
|---|---|---|
| PRE-R3 (sólo `glob`) | 24 | 110 |
| LOCAL primero (lo que predije) | 27 | 107 |
| **FORMA (guion bajo) y luego local** | **43** | **79** |
| LOCAL y luego forma | 37 | 87 |
| sólo forma | 41 | 78 |

**La localidad aporta 3 aciertos de 192. La forma del nombre aporta 19.** Mi premisa
era falsa, y el contraejemplo es sangrante: en `ULTIMA.EXE` 0x6506, con el orden que
yo proponía, la palabra `semilla` —local— le ganaba a `kernel_spawn_actor`
—heredado—. Es decir que mi reparación, aplicada tal cual, **habría degradado dos
nombres curados** para arreglar el orden.

**Criterio adoptado**: prioridad `(sin guion bajo, no local)`, con el orden de
`glob` de desempate ESTABLE al final. Dos motivos para el guion bajo y no
`looks_like_identifier` (que además admite `>= 12` caracteres):

1. mide lo mismo (43 aciertos las dos) con **una** propuesta menos de diferencia;
2. es **el mismo predicado que ya usa R5** para decidir qué es prosa. Un solo
   criterio con dos instrumentos —filtro y desempate— en vez de dos criterios
   distintos que calibrar por separado.

Y una propiedad que importa por lo aprendido en este mismo carril: **tener guion
bajo y ser local son propiedades de la propuesta, no de la población**. El desempate
de R3 no hereda la no-estacionariedad del umbral de R5 (que se movió de 6 a 7 en
unas horas): no puede apagarse solo porque el corpus crezca.

## 3. Blast-radius, antes y después

Medido con el mismo código que se aterriza, cambiando sólo el interruptor
`r3_order` (`routine_census.resolve_name_proposals`), sobre la población POST-R5:

| | |
|---|---|
| semillas totales | 989 antes, 989 después |
| **claves añadidas o perdidas** | **0** (garantía G1: reordenar cuándo se aplica una propuesta no cambia qué propuestas hay) |
| semillas que cambian de VALOR | **59** |
| de ellas, sobre el `start` de una fila | 36 |
| absorbidas por pin manual o por desfase del artefacto | 34 |
| **nombres VIVOS que cambian** | **2** |
| dirección | **54 mejoran, 0 empeoran**, 5 neutras (prosa por prosa) |

**Los 2 nombres vivos**, los dos mejoras y ninguno `verified`:

| fichero | offset | nombre viejo | nombre nuevo |
|---|---|---|---|
| INTRO.OVL | 0x0010 | tiras | intro_screen_setup |
| ULTIMA.EXE | 0x6ff0 | radial | terrain_dither_lookup |

**CERO cambios no explicados**: los 59 se explican por la definición del orden, y el
test `test_R3_sobre_el_corpus_real_ninguna_propuesta_MEJOR_pierde` lo comprueba como
PROPIEDAD sobre el corpus entero, no como cifra.

⚠ **Estos 2 cambios NO están en el artefacto**: `routine-census.json` está
embargado (#81) y no se regenera aquí. Lo de arriba es lo que la regeneración
producirá cuando la ventana se abra — que el lead no se lo encuentre de sorpresa.

### 3.1 ★ La guarda de huérfanos SE PONE ROJA, y tiene razón

`test_no_orphan_names_only_the_stale_census_could_explain` compara el censo
commiteado contra lo que el generador escribiría HOY, y con R3 esos 2 nombres dejan
de estar explicados: sobreviven sólo porque el JSON en disco es viejo. **Es
exactamente el trabajo de esa guarda y no hay que ablandarla.** Su arreglo canónico
—el que dice su propio docstring— es fijar el nombre en la capa manual.

Lo que hay que fijar es el nombre **NUEVO**, no el viejo, y no es blanqueo de una
semilla: los dos nombres ya venían derivados en notas, con la extensión cuadrando
con la fila. R3 no los inventa — **quita la palabra de prosa que los estaba
bloqueando**:

| fila | tam de la fila | nota que lo deriva | qué dice |
|---|---|---|---|
| INTRO.OVL 0x0010 | 64 | `intro-ovl-map.md:113` | fileoff y tamaño **64** cuadran; describe el bucle si=0..3 y las 3 llamadas al kernel que pintan las filas del título |
| ULTIMA.EXE 0x6ff0 | 80 | `kernel-sweep-2.md:225` | rango `[0x6ff0, 0x703f)` y `ret 4`; args, tabla estática en DS, y la conclusión «dithering espacial determinista, NO RNG» |

**Precedente**: es la misma adjudicación que hizo R5 ayer con ULTIMA.EXE 0x22C0
(`beep` bloqueaba a `pcspeaker_beep`; se fijó el nuevo con una cita que dice
explícitamente «se adopta la mejora de semilla, no se acredita una derivación»).

★ **NO lo aplico yo**: `frontier-manual.json` es de heredados-b en este momento y el
encargo me lo prohíbe expresamente (y el checkout principal lo tiene además con un
merge sin resolver). Las dos entradas, listas para pegar:

```json
"INTRO.OVL:16":    { "name": "intro_screen_setup",    "verified": false }
"ULTIMA.EXE:28656":{ "name": "terrain_dither_lookup", "verified": false }
```

Con la cita correspondiente en cada una (nota + línea de la tabla de arriba) y
**sin** marcar `verified`: no he leído los cuerpos, adopto la derivación ajena.

Que esos 2 pines bastan **está comprobado, no supuesto**: reproduciendo la guarda
con las dos entradas añadidas EN MEMORIA (sin escribir el fichero ajeno) la lista
pasa de 2 a **0**.

⇒ **R3 no puede aterrizar sola antes que esos 2 pines.** Las dos vías, para que
decida el lead: (a) pines + R3 juntos; (b) retener R3 hasta la ventana de #81, donde
la regeneración deja el censo al día y la guarda pasa sin pines.

### 3.2 R5 filtra exactamente lo mismo — verificado, no supuesto

Era el requisito explícito del encargo. El conteo de reclamaciones de R5 se hace en
el **pase 1**, sobre la lista completa de propuestas, y R3 sólo reordena el pase 2:
la población que ve R5 es idéntica por construcción. Comprobado además como test
(`test_R3_no_mueve_el_CONJUNTO_de_claves_ni_lo_que_filtra_R5`) y con un control que
prueba que el orden **no** es una puerta trasera: una palabra por encima del umbral
se salta aunque tenga la máxima prioridad.

### 3.3 Lo que R3 NO arregla

- **Los empates siguen resolviéndose por `glob`**: dos propuestas de la misma
  prioridad para la misma clave. Es un conflicto humano real; la vía es hacerlo
  visible (R4 lo reporta como `pisa`), no arbitrarlo mejor.
- **La ATRIBUCIÓN sigue viniendo del `ctx` pegajoso** (D1/D3). R3 elige mejor entre
  las propuestas que hay; no arregla que una propuesta apunte al fichero
  equivocado. Ejemplo vivo entre los 59: `ULTIMA.EXE` 0x0000 pasa a llamarse
  `endgame_throne_scene`, que es una rutina de otro overlay — el nombre tiene mejor
  pinta y la atribución sigue mal. Eso es R2, y va en la ventana de #81.

## 4. R4 — el gate

`re/tools/seed_gate.py`: para cada nota **nueva o modificada** respecto a `main`
(commiteada o no, incluidas las sin trackear) exige `0` siembras y `0` pisadas,
salvo lo declarado con nombre y offset exactos en `re/ledger/seed-declarations.json`
(que nace **vacío**, que es el estado deseable). Consume `seed_diff.seed_impact`, no
lo reimplementa.

**Cableado al flujo estándar**: el flujo es `pytest re/tools`, que recolecta por
directorio ⇒ `test_seed_gate.py` entra solo, sin tocar ningún runner. También hay
CLI para correrlo antes de commitear un acta.

Por qué el permiso es incómodo a propósito: la vía para nombrar una rutina es la
**capa manual**, donde el nombre va con su cita. Sembrar desde la prosa es la vía
accidental — la que pisó el nombre curado de `ULTIMA.EXE` 0x4dea en la frase puesta
para documentar este mismo defecto — y por eso hay que firmarla. Una declaración que
ya no corresponde a ninguna siembra también es ROJO, para que el fichero no se llene
de permisos muertos.

**Lo que el gate NO hace**: sólo mira las notas que has tocado. Una nota vieja que ya
sembraba sigue sembrando. Impide que la deuda CREZCA; no la salda.

### 4.1 Controles

| control | qué prueba | resultado |
|---|---|---|
| precondición | el offset de la sonda está libre (si no, el control quedaría mudo) | verde |
| positivo | una nota sucia fabricada SALE, con la clave y el nombre exactos | verde |
| negativo | la misma información escrita con la convención NO sale | verde |
| declaración exacta | silencia; con otro nombre, o de otra nota, **no** silencia | verde |
| declaración muerta | es violación por sí sola | verde |
| **trinquete** | las notas tocadas en la rama, a 0 | verde |

Estímulos **inmunes por construcción**: identificadores inventados con guion bajo,
que `_is_prose_seed` no filtra a ninguna frecuencia, y asertos del valor exacto. Es
la regla que #84 adoptó tras medir que el umbral de R5 se movía solo.

Demostración en vivo del CLI (nota sucia fabricada y borrada acto seguido): salida
`[siembra] COMBAT.OVL:0x14d6`, EXIT 1.

## 5. El verde SUSPENDE al quitar el arreglo

Con `r3_order` puesto a `False` (o sea, quitando R3 y dejando el resto igual):

```
FAILED test_R3_una_propuesta_de_MAS_PRIORIDAD_gana_aunque_llegue_DESPUES
FAILED test_R3_entre_iguales_decide_la_LOCALIDAD_y_luego_el_orden_de_llegada
FAILED test_R3_sobre_el_corpus_real_ninguna_propuesta_MEJOR_pierde
FAILED test_fidelidad_la_replica_reproduce_el_generador
4 failed, 2 passed
```

Los 2 que siguen verdes son los que deben seguir verdes: el de G1/G2 y el de la
interacción con R5 son invariantes al orden **por diseño**, y si cayeran con esto
sería que miden otra cosa.

## 6. Arreglo colateral del INSTRUMENTO

La réplica de medición descartaba las propuestas cuya clave ya traía el
pre-sembrado **antes** de contar reclamaciones; el generador las cuenta. Le daba a
R5 una población distinta de la real: una divergencia latente del instrumento que
hoy no mordía —el test de fidelidad pasaba— pero que habría dado cifras con pinta de
dato el día que cruzase el umbral. Corregida, y la fidelidad sigue en verde.

## 7. Gates

| comando | EXIT | resultado |
|---|---|---|
| los 5 ficheros del encargo, ANTES de tocar nada (línea base) | **0** | 113 passed |
| los mismos + `test_seed_gate.py`, al cerrar | **1** | **124 passed, 1 failed** |
| el `seed_gate` sobre mis dos notas nuevas (CLI) | **0** | las dos limpias |

El único rojo es `test_no_orphan_names_only_the_stale_census_could_explain`, por lo
de §3.1: la guarda hace su trabajo y **se destraba con los 2 pines**, que no son
míos de aplicar. No hay ningún otro rojo: los otros 124 pasan, incluidos los 5 tests
nuevos de R3 y los 7 del gate.

## 8. Reproducir

- Blast-radius: `resolve_name_proposals(collect_name_proposals(), preseed_names(), r3_order=False)`
  contra el mismo con `True`, y cruce con `frontier.json` + `frontier-manual.json`.
- Calibración contra pines: mismo cruce, contando coincidencias exactas por clave.
- Las listas nominales son **calculadas, no transcritas**: copiarlas aquí las
  congelaría el día que el corpus cambie.
