# heredados-b · TANDA 4 — la instantánea con fecha, y dos filas que ya estaban leídas

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **112 → 110**.

> Verificada con `re/tools/seed_diff.py` bajo R5: 0 sembradas, 0 cambiadas.

---

## 1. La micro-pieza: correr el triaje ya no destruye el documento congelado

El aviso que di en la tanda 2 queda arreglado, tal como lo aprobó el lead.
`triage-heredados-76.json` son las 168 filas del #76 y es lo que referencian las actas de
heredados-168 — y hasta hoy el script lo **reescribía en cada ejecución**, de modo que el
gesto que el protocolo exige al empezar cada tanda —re-medir, *porque los buckets
derivan*— destruía justo la instantánea que documenta esa deriva.

Ahora: **por defecto no se escribe nada**, y `--write` crea un fichero **nuevo y fechado**
(`triage-heredados-AAAAMMDD-HHMM.json`). El documento del #76 no se toca desde aquí jamás.

Dos controles nuevos en `test_triage_heredados.py`: uno comprueba que el nombre generado
nunca coincide con el del histórico, y otro **ejecuta el script de verdad como subproceso y
verifica por `mtime`** que el fichero congelado no se ha tocado y que no ha aparecido
ninguna instantánea. Verificado además a mano que `--write` sí deja el fichero fechado y
sigue sin tocar el histórico.

---

## 2. Las dos filas de DNGLOOK — y gana el ledger, otra vez

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `DNGLOOK.OVL:0x97e` | `dnglook_side_edge_11_solid` | ACREDITADA — gana el ledger |
| 2 | `DNGLOOK.OVL:0xa48` | `dnglook_side_edge_5` | ACREDITADA — gana el ledger |

Son dos de las cinco de la clase «sellada por una fila que la llamaba otra cosa». El anexo
del #39 las llama `floor_wedge_A (corridor opening)` y `floor_wedge_B (corridor closure)`.

**Gana el ledger, y el motivo es distinto del de la tanda 2.** Los tres términos de
`dnglook_side_edge_11_solid` los fija el cuerpo: pinta una **arista lateral**, de **once**
celdas, con el valor **sólido** `0xFF`. Lo que hace el nombre del anexo es nombrar **el
papel que le da su llamador** — `dnglook-raster-spec.md:127-136` documenta que el
despachador elige entre las tres cuñas según el nibble alto del tile de delante. Es un
nivel por encima del cuerpo.

En la tanda 2 el rol del anexo era una **sinécdoque** (nombraba una de tres ramas del
propio cuerpo). Aquí es otra variante: **nombra la función que le atribuye quien lo
llama**. Dos formas distintas de que un rol no sea un nombre.

**★ Lo que sí añado, y es una advertencia de porte: las dos hermanas NO son simétricas**, y
el par `_A`/`_B` del anexo sugiere que lo son. Una escribe una global y la otra el literal
`0xFF`; una recorre **cinco** celdas y la otra **once**; una toma **un** argumento y la otra
**dos**; y sólo una tiene el caso especial del tile `0xE0`. Quien las porte como dos mitades
del mismo objeto hereda una simetría que el binario no tiene.

---

## 3. ⚠ Un casi-error mío, y es exactamente el género que este carril persigue

Mi primer borrador de estas dos citas iba a publicar **como hallazgo nuevo** la cola del
tile `0xE0` —los dos pares de celdas de esquina— y a describir el barrido con **fila y
columna intercambiadas**.

Las dos cosas estaban ya resueltas **en la propia fila que venía a adjudicar**: la cita de
`frontier-verify-20260725` traía el caso del `0xE0` completo y el reparto por rumbo exacto
(rumbo 0 → columna 0, 1 → fila 10, 2 → columna 10, 3 → fila 0). Lo vi porque leí la cita
**entera** antes de escribir, en vez de fiarme del resumen truncado que había mirado
primero.

Las dos moralejas, y la segunda es nueva:

1. La regla de **cruzar el corpus antes de leer el cuerpo** vale también para **las citas de
   la propia fila**. Yo la venía aplicando a `re/notes` y a `game/src`, y no al ledger.
2. En un proyecto que ya se comió una transposición de ejes, **describir un barrido en prosa
   es un sitio caro para ser impreciso**. La cita vieja era más exacta que mi borrador; la
   adopté en vez de competir con ella.

Con esto, el género «la lectura existía y nadie la cruzó» suma una variante nueva —
*la lectura existía en la fila misma*— y va por **veintitrés**.

---

## 4. Estado

**21 filas adjudicadas** en cuatro tandas; contador **128 → 110**.

Queda **una** de la clase anexo-contra-ledger: `DNGLOOK.OVL:0x117e`, la mayor de las cinco
(562 B) y con nota propia (`dnglook-117e-body.md`), que se lleva su tanda entera.

**Cola de la tanda 5:** esa, más `DNGLOOK.OVL:0x6a8` —el gem de mazmorra, hermano de la
familia de la tanda 1, confirmado por el lead—, y luego los fuertes por tamaño.

**El reparto no lo cito aquí a propósito**: lo mediría ahora y esta acta lo movería al
commitearla. Se mide al empezar la tanda 5, y con su hora.
