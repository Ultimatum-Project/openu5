# heredados-b · TANDA 2 — el regalo del relevo y las dos filas en disputa

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **116 → 113**.

> Offset y nombre en celdas separadas (heredados-168-tanda1 §2.3).
> Verificada con `re/tools/seed_diff.py` bajo R5: 0 sembradas, 0 cambiadas.

---

## 1. Las 3

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `ULTIMA.EXE:0x72fa` | `install_int_handler (getvect+setvect)` | ACREDITADA — el regalo del relevo, releído |
| 2 | `MAINOUT.OVL:0x198c` | `move_one_actor` | ACREDITADA — ★ gana el ledger; el anexo nombraba 1 de 3 ramas |
| 3 | `MAINOUT.OVL:0x1578` | `move_actor` | ACREDITADA — ★★ y REFUTA al censo de RNG en su propia materia |

---

## 2. ★★ El hallazgo: `overworld-ai-rng.md` se equivoca justo en lo que mide

`overworld-ai-rng.md` existe para una sola cosa: contar cuántas tiradas consume cada
actor por turno. Su línea 75 abre un epígrafe titulado literalmente **«Helpers (sin
rand)»** y mete ahí a la rutina 3 de esta tanda, «ejecutor del movimiento».

**No es sin rand.** Tras descartar la familia de barco y cuatro tiles de actor, el cuerpo
hace `ax = tile_destino - 4` / `cmp ax,0x1b` / `ja`, y para los destinos `0x04`..`0x1F`
entra en una tabla de **28 entradas**. Decodificada y verificada por programa —las 28 caen
en etiquetas reales del propio cuerpo—, tiene **tres** destinos:

| destino | qué hace | tiles | probabilidad de pasar |
|---|---|---|---|
| `0x1656` | `rand_range(0,1)`, mueve si sale ≠ 0 | `0x04` `0x06` `0x07` `0x08` `0x1e` `0x1f` | 1/2 |
| `0x1668` | `rand_range(0,2)`, mueve si sale 2 | `0x09`..`0x0f` | 1/3 |
| `0x16b2` | mueve sin tirar | `0x05`, `0x10`..`0x1d` | 1 |

⇒ **Trece de los 28 tiles consumen una tirada que el censo no cuenta.** Y no es sólo
contabilidad: cuando la tirada falla, **el actor no se mueve pero la tirada ya se gastó**.
Cualquier reproducción del flujo de RNG que siga ese censo se desincroniza en cuanto un
actor pisa pantano, colina o bosque.

Es terreno que **frena probabilísticamente**, la mecánica clásica de la serie, y estaba
dentro de una rutina catalogada como simple ejecutor.

**Lo que NO afirmo:** no he re-contado el presupuesto por turno entero ni he tocado ese
fichero. Digo que su clasificación de esta rutina está refutada por el cuerpo, y dejo la
corrección del presupuesto como tarea con dueño.

---

## 3. ★ Dos disputas de nombre, y las dos las decide el cuerpo

Al cruzar el triaje encontré algo que no estaba censado: hay filas donde **el rol que les
da el anexo del #39 y el nombre que lleva el ledger no coinciden**. Son cinco de las 116:

| rutina | rol del anexo #39 | nombre del ledger |
|---|---|---|
| `DNGLOOK.OVL:0x117e` | `corridor_sprite_overlay` | `cbt_scene_populate` |
| `DNGLOOK.OVL:0x97e` | `floor_wedge_A (corridor opening)` | `dnglook_side_edge_11_solid` |
| `DNGLOOK.OVL:0xa48` | `floor_wedge_B (corridor closure)` | `dnglook_side_edge_5` |
| `MAINOUT.OVL:0x1578` | `move_world_object (tile-class)` | `move_actor` |
| `MAINOUT.OVL:0x198c` | `npc_ship_wind_drift` | `move_one_actor` |

Esto afila el problema del carril. No es sólo «sellada sin cita»: es **sellada por una fila
que la llamaba otra cosa**. El `verified` viene del anexo; el nombre, de otro sitio.

Las dos de MAINOUT quedan adjudicadas aquí:

**La rutina 2 — gana el ledger, y el del anexo es una sinécdoque.** El cuerpo despacha por
familia de tile del actor, en tres ramas: los `0xEC`-`0xEF` alternan un bit del campo +5 y
sólo actúan en la mitad de los turnos, y entonces una tirada elige entre deriva y
persecución; el `0xFC` lleva un contador en el campo +5 que **nadie reinicia aquí** y que
cambia de modo al llegar a 20; y los `0x2C`-`0x2F`, los barcos, son los que derivan con el
viento. `npc_ship_wind_drift` describe **la tercera**, y callaría las otras dos.

**La rutina 3 — ninguno de los dos nombres está mal.** `move_actor` es correcto y el del
anexo aporta el matiz útil de que el gate va por clase de tile. Acredito el del ledger sin
retirar nada.

---

## 4. Lo que el cuerpo dio de propina

**(a) ★ Cierro un hueco que la tanda 7 de heredados-168 dejó abierto a propósito.**
Aquella fijó que los campos +2 y +3 del registro de animación son las coordenadas, y se
**negó** a etiquetarlas x/y porque su cuerpo no lo sostenía: «el proyecto ya se comió una
transposición de ejes por rellenar ese hueco con una suposición razonable». Aquí sí hay con
qué: el campo +2 se suma al segundo argumento y +3 al tercero, y el par entra en
`get_tile_ptr` con +2 en la posición de la X —posición que la tanda 1 fijó por su lado
leyendo el gem—. **+2 es la X y +3 la Y, derivado.**
No lo canto como novedad: `overworld-ai-rng.md:75` ya los llamaba x,y. Lo que faltaba, y es
lo que aporto, era la derivación.

**(b) La deriva por viento ya estaba en el corpus.** `transport.md:155` tiene la misma
tabla y hasta la nota de que el umbral 4 significa «nunca frena». Van **veintiuna**
apariciones del género «la lectura existía y nadie la cruzó».

**(c) ⚠ Alcanzabilidad ABIERTA, con el mismo criterio que las dos de heredados-168.** En la
rutina 3, si el delta no casa con ninguna de las cuatro ortogonales, el rumbo se lee de una
variable local **nunca escrita** (el marco se reserva y no se inicializa) ⇒ rumbo de basura.
Depende de si algún llamador pasa un delta diagonal o nulo; este cuerpo no lo cierra, así
que no lo vendo como bug.

**(d) El regalo, releído en vez de copiado.** La rutina 1 llegaba con dos citas y el cuerpo
ya leído, sin sello. La confirmé por lectura propia —son tres instrucciones— y le añadí una
precisión que las citas no traían: **no tiene marco de pila ni `ret n`**, así que los
argumentos viajan en registros y el vector viejo vuelve en `ES:BX`. Es de la familia de
rutinas sin marco de la tarjeta #90, y por eso no hay prólogo que atribuirle.

---

## 5. Estado y método

**16 filas adjudicadas** en dos tandas; contador **128 → 113**.

**Reparto del triaje, MEDIDO el 2026-07-28 a las 08:51 UTC:** 19 FUERTE · 79 DÉBIL · 18 SIN
RASTRO, sobre 116. Va con hora a propósito: mi antecesor midió tres repartos distintos el
mismo día sobre el mismo total, porque el triaje clasifica contra el corpus y **cada acta
que alguien añade mueve filas de bucket**. El reparto de una fila no es una propiedad suya,
es una foto del corpus. Mi propia acta de la tanda 1 lo demuestra: movió
`LOOKOBJ.OVL:0xe7a` de DÉBIL a FUERTE por el mero hecho de citarla.
⚠ Y por eso el §7 de mi tanda 1 cita un reparto **sin fecha**: queda corregido aquí.

**⚠ AVISO DE INSTRUMENTO, para quien releve.** Ejecutar `triage_heredados.py` **reescribe
un fichero tracked**: el volcado `triage-heredados-76.json` pasa de las 168 filas
históricas a las que queden vivas. Ese volcado es el que referencian las actas de
heredados-168, así que sobreescribirlo destruye la instantánea que documenta la deriva. Lo
he revertido y he tomado la medida en memoria. **Quien lo corra, que restaure el fichero** —
o que el volcado pase a llevar la fecha en el nombre.
