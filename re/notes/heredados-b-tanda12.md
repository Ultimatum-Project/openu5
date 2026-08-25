# heredados-b · TANDA 12 — el contraejemplo: aquí falla el SUSTANTIVO

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **101 → 100**.

> Verificada con `seed_gate.py`: 0 sembradas, 0 cambiadas.

Una sola fila: `DUNGEON.OVL:0x1682`. **Sello concedido, `naming_verified` no** — y por el
motivo contrario al de las tandas 8 a 10.

Defiero a propósito las otras dos que tenía en cola. Son 274 y 284 bytes de composición 3D
y prefiero una lectura entera que tres a medias.

---

## 1. Qué hace

Pide el tile de una celda y, con su **nibble alto**, elige un **desplazamiento de pieza**
que suma a la profundidad: por debajo de `0xA0` suma dieciséis; `0xA0`, `0xE0` y `0xF0`
suman cuatro; `0xC0` suma veinte; y `0xB0`/`0xD0` no suman nada. Con esa pieza llama al blit.

La rama de `0xC0` hace más, y **sólo** en profundidad menor que dos y con la variante de
muro activa: calcula una X base y, si el argumento de lado no es cero, **la espeja** con la
misma constante de simetría que el barrido gfx ya documentó para el chorro de la fuente.
Después indexa una tabla por `profundidad*5 + (tile & 7)`.

**★★ Y entonces escribe en el mapa.** Machaca **los tres bits bajos** de la celda
correspondiente de `g_dng_map`. Una rutina del camino de dibujado con **efecto persistente**
sobre el búfer de mapa — y el acervo ya tiene fichado que ese búfer es **uno solo** y que la
salida de mazmorra **no lo limpia**.

**⚠ No asigno x/y a los dos argumentos de coordenada.** El índice literal es
`(uno & 7)*8 + (otro & 7)`, y cuál es cuál depende de una rutina que no he leído. Con el
historial de transposiciones de este proyecto, prefiero dejar la fórmula y no la etiqueta.

---

## 2. ★★★ El contraejemplo, anotado igual de fuerte que los casos a favor

La hipótesis de la tanda 9 decía: *el cuerpo sostiene el sustantivo y el entorno aporta el
calificativo*. **Aquí pasa justo lo contrario.**

No hay **«raytrace»** —no hay avance de rayo por celdas: es **una** celda— ni **«column»**
—no hay bucle: la iteración por profundidad la pone el llamador—. Lo único que el cuerpo
**sí** fija es **«side»**: el argumento que da nombre al calificativo es exactamente el que
decide el espejado.

⇒ **Falla el sustantivo y aguanta el calificativo.**

**Lo que esto le hace a la política.** No la rompe, la acota. El caso se explica bien con la
clase ya re-encuadrada: **nombre por rama vs nombre por alcance** (alias antiguo: «rol del
anexo vs nombre del ledger»). Esta es de **alcance** — sólo que el alcance que nombra **no
es el suyo, es el del llamador**. Y cuando un nombre describe el papel de la rutina dentro
del bucle de quien la llama, **lo que se importa del entorno es el sustantivo**, no el
calificativo.

Así que la regla útil no es «desconfía del calificativo», sino:

> **Averigua primero si el nombre describe lo que la rutina HACE o el PAPEL que juega para
> quien la llama.** En el segundo caso, el término importado puede ser cualquiera de los
> dos, y hay que leer al llamador de todos modos.

Casos del patrón: **cinco**, de los cuales **cuatro** con el calificativo importado
(`road`, `present_reward`, `frame`, la cola del interrogatorio) y **uno invertido** (éste).
Y de los cuatro, uno resultó **falso** al leer al llamador, no meramente abierto.

---

## 3. Estado

**31 filas adjudicadas**; contador **128 → 100**. Se cruza la barrera de las cien.

**Cola:** `DUNGEON.OVL:0x134a` (274 B, el blit al que ésta llama — diez call-sites desde el
compositor) y `OUTSUBS.OVL:0x98` (284 B).
