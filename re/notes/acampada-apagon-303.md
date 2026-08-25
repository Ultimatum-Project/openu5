# #303 — ¿La ACAMPADA apaga el viewport? NO (derivado, nivel 1) — y la ficha apuntaba a otra rutina

Fecha: 2026-08-14. Carril: espejo-camp-2. Sujeto: BINARIO.
Control separado de #296 (la cama SÍ apaga). Veredicto: **NO**, con el alcance y el
límite que se declaran abajo.

## 1. 🔴 La ficha mandaba leer la rutina EQUIVOCADA

`#303` dice: «leer CMDS 0x0000 entera (~0x550 instrucciones)» como *la rutina de
ACAMPADA*. El ledger (`re/ledger/coverage.json`, segmentos de CMDS.OVL) la llama
**`camp_heal_hour`**, y la acampada de verdad **no vive en CMDS.OVL**.

Los tres beats del campamento salen de UNA sola rutina del KERNEL,
**`ULTIMA.EXE:0x3c9a-0x3eef`** (acotada por los prólogos `push bp` de `0x3c9a` y
`0x3ef0`):

| dir | cadena | DS → DATA.OVL |
|---|---|---|
| `3da6` | `"For how many hours? (1-9) "` | DS 0xa32c → 0xa33c |
| `3e32` | `"\nWilt thou set a watch? "` | DS 0xa348 → 0xa358 |
| `3ea5` | `"Who will stand guard? "` | DS 0xa36e → 0xa37e |

🔴 Y hay **DOS cadenas «For how many hours?» distintas**: la de la acampada lleva el
sufijo `(1-9)` (DS 0xa32c) y la del hole-up no (DS 0x4209). Quien busque la mecánica
por el texto puede caer en la otra rutina sin notarlo.

## 2. Lo MEDIDO: no hay apagón en el span de la acampada

El apagón de #296 es el par `set_color(0)` + `fill_rect(8,8,0xb7,0xb7)`. Su huella
inconfundible es el inmediato `0xb7`.

* Censo de `mov ax, 0xb7` en **todo ULTIMA.EXE**: 4 sitios — `0x309d`, `0x30d5`,
  `0x3102`, `0x3139`. **Los cuatro fuera de 0x3c9a-0x3eef.**
* CONTROL POSITIVO del predicado: el mismo censo sobre CMDS.OVL encuentra **1** sitio,
  `0x061f`, que es exactamente el apagón de la cama. El predicado ve un apagón cuando
  lo hay.

⇒ **La rutina de acampada no apaga el viewport en su propio cuerpo.**

## 3. 🔴 LÍMITE DECLARADO: la profundidad 2 NO está cerrada

Intenté cerrarla preguntando «¿algún callee del span llama a `gfx_set_color` 0x0a70 o
`gfx_fill_rect` 0x0b86?». Da NO sobre los 17 destinos del span — **pero su control
positivo FALLÓ**: el span `0x3072-0x3178`, que CONTIENE un apagón real (el `0xb7` de
0x3139), tampoco los llama; esas rutinas del kernel llegan al par por otra vía. Un
predicado que no encuentra el positivo conocido no puede acreditar un negativo, así
que **ese NO se retira** y la profundidad 2 queda abierta.

Lo que aguanta es el nivel 1, y con eso la ficha se cierra en el sentido que ya
apuntaba («evidencia débil hacia NO») pero ahora **con la rutina identificada, su span
acotado, sus tres beats localizados dentro y un control positivo que pasa**.

## 4. Corrección de vocabulario para #296

`CMDS.OVL:0x0552` —el que SÍ apaga— se llama **`cmd_camp_holeup`** en el ledger, no
«la rutina de cama». Su cuerpo: `"For how many hours? "` (DS 0x4209) → bucle de 16
ticks con repintado → pone a dormir a los miembros con estado `G`(0x47)→`S`(0x53) →
`"Zzzzzzz...\n"` (DS 0x421e) → `set_color(0)` @0x0617 → `fill_rect(8,8,0xb7,0xb7)`
@0x0624. El EFECTO que #296 portó es correcto; lo que engañaba era el nombre.

## 5. Qué NO se toca

No se porta ningún apagón a la acampada (era justo lo que la ficha prohibía hasta
adjudicar). El port queda como está.
