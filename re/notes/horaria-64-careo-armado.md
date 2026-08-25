# #64 — CAREO DEL ARMADO DEL SLOT `[0x65bf]`: el modelo asm que faltaba

> Carril `horaria-64`. Cierra el arco de #64: hipótesis → adjudicación
> (`horaria-64-adjudicacion.md`) → fix (`176b404f`) → **paridad**.
> Sujeto: la mecánica del BINARIO. El careo cruza dos modelos independientes.

---

## 1. EL HUECO QUE CIERRA

`re/tools/test_blackthorn_parity.py` daba 48/48 en verde **antes y después** del fix de
#64, sin cambiar una línea. No era que su modelo acertara: **no modelaba esta capa**. Su
caso `trigger` llamaba a `blackthornCaptureTriggers` (sólo el gate `TOWN.OVL 0x12ae,`:
location + party consciente) y su caso `guard` a `guardDemand` directo. Ninguno pasaba por
`palaceGuardAdjacent` ni por `armaElSlot` ⇒ **el armado del slot le era invisible**, y desde
#64 esa capa lleva mecánica horaria recién calcada.

Un careo que no puede ponerse rojo cuando la mecánica cambia no es cobertura: es silencio
con forma de verde.

## 2. QUÉ SE AÑADE

**Modelo asm en Python** (`re/tools/blackthorn_parity.py`), escrito desde el disasm y **no**
leyendo el TypeScript — que es lo único que hace que el cruce valga como careo:

- `schedule_index(times, hour)` — `NPC.OVL 0x12e0,`: `argmin` sobre
  `(hora - times[k]) & 0xff` con el remapeo 3→1 (`0x131e,` `mov dx, 1`) y empates al
  índice MENOR (`jbe`).
- `arms_slot(ai_type, dialog_number)` — `NPC.OVL 0x06e4,`: `0x0728,` `jle` (aiType > 3),
  `0x073d,`-`0x0744,` (los 4/5 exigen dlgNum != 0), 6/7 sin gate de diálogo.
- `guard_arms(spec)` — barrido `NPC.OVL 0x0db4,`: índices ascendentes, **el mayor PISA**
  (`0x074e,`), misma planta (`0x1259,`), manhattan == 1 (`0x0723,`), y el corte palaciego
  aguas abajo (`0x13a7,` `cmp byte[bx],0x70` + `TOWN.OVL 0x12ae,`).

**`kind` nuevo `guardArms`** en `game/src/core/__parity__/blackthorn-run.ts`. Entra por
`checkBlackthornCapture`, que es el camino REAL: pasa por `palaceGuards()` —donde el port
aplica `scheduleIndex`— y por `palaceGuardAdjacent`/`armaElSlot`. **No se reconstruye ahí el
mapeo hora→aiType a propósito**: hacerlo cruzaría el modelo contra una copia del cableado
en vez de contra el cableado.

**El contrato es `armedByHour`: 24 booleanos por escenario**, no uno. Una sola comparación
sería un careo flojo cuando el sujeto de la capa es justamente la hora.

⚠ Lo que el careo NO compara: el GANADOR del desempate. El port no lo expone, y meterlo
compararía el modelo contra un hueco. El desempate sí queda cubierto —por los escenarios
con absorbedor, donde pisar al guardia se ve como un `false`— pero por su EFECTO, no por su
identidad.

## 3. SENSIBILIDAD — seis mutantes, y uno SOBREVIVIÓ

Verde a la primera es sospechoso en un careo, así que el trabajo de verdad fue intentar
ponerlo rojo. Todos EN DOMINIO (respuesta válida pero equivocada), porque **un mutante que
mata por excepción no prueba discriminación**, sólo que el modelo revienta:

| mutante | lado | resultado |
|---|---|---|
| M1 — el guardia vuelve a armar SIEMPRE (el `if` de #59) | port | **5 rojos** |
| M2b — el quirk remapea a la ranura 2 en vez de la 1 | modelo | **4 rojos** |
| M3 — el desempate lo gana el índice MENOR | modelo | **2 rojos** |
| M4 — el gate pasa de `aiType <= 3` a `<= 2` | modelo | **SOBREVIVIÓ** ⚠ |
| M5 — la rama 4/5 ignora el dlgNum | modelo | **2 rojos** |
| M6 — los 6/7 exigen dlgNum (no deben) | modelo | **1 rojo** |

**M4 destapó un agujero real**: ningún escenario tenía un NPC con `aiType` 3, que es el
filo EXACTO del `jle` de `0x0728,`. El careo no podía ver la diferencia entre «no arma con
3» y «no arma con 2». Se cerró con tres escenarios de filo —`arms-aitype-3`,
`arms-aitype-5-mudo`, `arms-aitype-5-hablador`— y M4 pasó a matar.

★ El orden importa: los tres escenarios **los eligió un mutante superviviente, no una lista
a priori**. Una lista a priori habría cubierto lo que ya se tenía en la cabeza.

Población final: **14 escenarios**, con vectores que discriminan de verdad (0/24, 12/24,
14/24, 16/24, 24/24) — seis son controles negativos todo-a-falso y ocho llevan estructura
horaria. Verificado que no es vacuo: si los 24 booleanos fuesen siempre iguales, el careo
pasaría con cualquier cosa.

## 4. LA GUARDA `parity-coupled`

`blackthorn` **no cumplía** el criterio de `game/tests/parity-coupled.test.ts` antes de
esto: su runner sólo importaba de `world/blackthorn.ts` (motor puro). Al añadir `guardArms`
pasa a importar `checkBlackthornCapture` de `world/blackthorn-capture.ts` —código VIVO que
otros carriles tocan— así que **el acoplamiento es NUEVO y lo crea este trabajo**. Por eso
entra en la lista, y por eso se dice en el fichero en vez de dejarlo como una adición muda.

Coste MEDIDO, y la prosa de la guarda se actualizó para no mentir: **26 s → 60 s** en frío,
población `46 passed` → `108 passed`, suelo `MIN_PASSED` 40 → 100. El `blackthorn` añade
~34 s porque cada escenario `guardArms` levanta el runner 24 veces, una por hora.

## 5. Frente que queda nombrado

El careo cubre el ARMADO, no la ELECCIÓN DE VÍA. El binario tiene ranura FRESCA
(`0x125e,`) y RECORDADA (`0x1249,`), y el port siempre calcula la fresca
(`horaria-64-adjudicacion.md` §6.5): diferencia de un tick en el filo de la hora. Ningún
escenario de aquí la distingue, porque el `kind` pregunta por la hora en estado estable.
Sigue sin ser bloqueante y sigue sin tener ventana.
