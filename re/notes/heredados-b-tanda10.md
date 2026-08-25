# heredados-b · TANDA 10 — el calificativo no estaba abierto: estaba MAL

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **103 → 102**.

> Verificada con `seed_gate.py`: 0 sembradas, 0 cambiadas.

Una fila —`BLCKTHRN.OVL:0x54a`, `interrogate`— y el cierre de un cabo que dejé abierto dos
tandas atrás. El lead lo planteó bien: esto daba a la hipótesis su cuarto caso o su primer
contraejemplo. **Ha dado algo mejor que cualquiera de los dos.**

---

## 1. `interrogate` — ACREDITADA

Bucle de **cuatro** preguntas. Por vuelta imprime la pregunta y consulta la respuesta:

- **Si cede**: marca el santuario del sujeto, toca el karma, y entonces — con más de un
  miembro vivo **sacrifica a uno**, y con uno solo imprime el mensaje de clemencia.
- **Si no cede**: con menos de dos vivos imprime otro mensaje (reutilizando el `push` y el
  `call` de la rama anterior, un ahorro de tres bytes); con dos o más, **la primera negativa
  sólo dispara la amenaza**, y el castigo entra a partir de la segunda.

**★★ Y el castigo escribe códigos de campo de arena en una celda fija.** Las preguntas 0, 1
y 2 escriben `0xEA`, `0xEB` y `0xE8` en una dirección que está a `0x125` de la base del
búfer de composición — o sea **fila 9, columna 5** con el paso 32 ya conocido. Los tres son
de la familia que el predicado de disipación barre con `(tile & 0xfc) == 0xe8`.

**★★★ Y entre ellos está `0xEB`** — el que la tanda 7 de `heredados-168` dejó anotado como
«existe, ocupa slot y se disipa, pero **no** produce efecto de fin de turno». Aquí aparece un
sitio que **lo escribe**.

No cierro que la maquinaria de campos corra en esta escena: lo establecido es que este
cuerpo escribe los tres códigos en una celda fija del búfer compartido, y que el del sueño
(`0xE9`) **no** está entre ellos.

---

## 2. ★★ El cabo de la tanda 8: `present_reward` no estaba abierto, estaba MAL

En la tanda 8 dejé el calificativo de esa fila, `BLCKTHRN.OVL:0x510`, marcado como **no
fijado por el cuerpo**, y apunté que su único llamador podría cerrarlo. Lo cierra — **y en
contra**.

La llamada es la **cola común de tres caminos**: se llega tras **sacrificar a un
compañero**, tras el mensaje de clemencia, y también desde la rama de no-ceder con pocos
supervivientes, que salta a reutilizar el mismo `push`/`call`. **Corre igual cuando no hay
recompensa ninguna.**

Así que `present_reward` **no es un término sin respaldo: es falso**. Lo que el cuerpo y su
llamador sostienen es «la cutscene con que termina el interrogatorio, gane lo que gane el
jugador». Propongo **`interrogation_outcome_cutscene`** y dejo `naming_verified` en falso
hasta que haya decisión — no me lo auto-concedo.

---

## 3. Lo que esto le hace a la hipótesis

La hipótesis de la tanda 9 era: *el cuerpo sostiene el sustantivo y el entorno aporta el
calificativo*. Este caso **no la refuta — la agrava**, y por eso vale más que un cuarto caso
de confirmación:

> El calificativo venía del entorno, sí. Pero **no era simplemente indemostrado: era
> incorrecto.** Y el cuerpo por sí solo **no podía distinguir las dos cosas** — hizo falta
> leer al llamador.

**Consecuencia para la política candidata.** «Declarar el reparto por fila» era barato
porque suponía que un calificativo abierto es inofensivo mientras nadie lo use. Este caso
dice que **abierto ≠ inofensivo**: un calificativo puede estar declarado como no-verificado
y ser, además, mentira. La política sigue siendo mejor que renombrar a ciegas, pero necesita
una segunda mitad:

> **Cuando una fila tenga UN SOLO llamador, leerlo antes de declarar el calificativo
> abierto.** Es barato —aquí fueron veinte líneas— y es la diferencia entre «no lo sé» y «es
> falso», que no son el mismo estado.

Con las filas de muchos llamadores no aplica, y ahí declarar sigue siendo lo correcto.

---

## 4. Estado

**29 filas adjudicadas**; contador **128 → 102**.

Casos del patrón sustantivo/calificativo: **cuatro** (`road`, `present_reward`, `frame`,
y este). De ellos, **uno resultó falso al leer al llamador** — el resto siguen abiertos.

**Cola**, los fuertes por tamaño:

| rutina | tamaño | nombre en el ledger |
|---|---:|---|
| `MAINOUT.OVL:0x1a60` | 222 B | `world_turn` |
| `DUNGEON.OVL:0x1682` | 260 B | `side_raytrace_column` |
| `DUNGEON.OVL:0x134a` | 274 B | `wall_segment_blit` |
| `OUTSUBS.OVL:0x98` | 284 B | `viewport_compose_16x16` |
