# heredados-b · TANDA 11 — `world_turn`, y un acumulador que apaga el turno entero

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **102 → 101**.

> Verificada con `seed_gate.py`: 0 sembradas, 0 cambiadas.

Una sola fila, `MAINOUT.OVL:0x1a60`, pero densa: el bucle de turno del sobremundo.
**ACREDITADA.**

---

## 1. Hace cuatro cosas, y «mover monstruos» es sólo una

**(1) Gates de cadencia, sin tirada.** Con el hechizo de detener el tiempo devuelve cero de
inmediato. Con el de rapidez conmuta un flag y **salta turnos alternos**. Y si el transporte
es montura o alfombra, conmuta **otro** flag y salta turnos alternos también — o sea que
**el montado tiene su propia cadencia, con su propio conmutador**.

**(2) Spawn.** Una tirada de 1 a 30 contra el retorno de otra rutina, y sólo invoca al
spawner si ese retorno **supera** la tirada. ⚠ No establezco **qué** cuenta esa rutina —no la
he leído—, así que no digo si el sentido es «más monstruos, más spawn» o «más huecos, más
spawn». Es la clase de frase que se escribe sola si uno no se contiene.

**(3) El bucle de acción**, de la ranura 31 a la 1 — **la 0 no entra**, porque el bucle sale
al llegar a cero.

**(4) Una segunda pasada de despawn**: los actores cuyas coordenadas se salen del chunk se
borran con un registro de siete ceros. Los de dentro no se tocan.

---

## 2. ★★ El acumulador que apaga el turno de todos los demás

En el bucle de acción, cada actor llama a la rutina de ataque y **su retorno se SUMA a un
acumulador**. Lo que decide si ese actor se mueve **no es su propio retorno, sino el
acumulador**.

Consecuencia: **en cuanto un actor devuelve distinto de cero, ninguno de los siguientes se
mueve en ese turno**, porque el acumulador ya no vuelve a cero. Y ese mismo acumulador es el
**valor devuelto** de la rutina.

Un porte que lea «si el actor atacó, no se mueve» —que es la lectura natural— da a cada
actor una decisión independiente, y el original **apaga el movimiento del resto de la lista**
en cuanto uno actúa.

---

## 3. ★ Cuarta confirmación del eje, y una sinécdoque nueva

**El eje:** aquí el campo +2 se compara contra el origen X del chunk y el +3 contra el
origen Y. Van **cuatro subsistemas** distintos con la misma asignación — el hueco que la
tanda 7 del predecesor dejó abierto por prudencia lleva ya cuatro confirmaciones
independientes.

**Y una instancia nueva de la sinécdoque, esta vez entre notas.** `antim-freeze.md` llama a
esta rutina «mover todos los monstruos». Ese nombre describe el punto (3) y deja fuera los
gates, el spawn y el despawn. La variante que catalogué en la tanda 2 —el rol nombra una de
N ramas del propio cuerpo— **no es exclusiva del anexo: también aparece entre notas del
corpus**. Gana el nombre del ledger, por alcance.

---

## 4. Estado

**30 filas adjudicadas**; contador **128 → 101**.

**Cola:** `DUNGEON.OVL:0x1682` (260 B), `DUNGEON.OVL:0x134a` (274 B), `OUTSUBS.OVL:0x98`
(284 B).
