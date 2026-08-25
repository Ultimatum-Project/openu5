# ACTA #143 — La mecánica del CORPSER: un ciclo de estado, no dos mensajes

Rama `fix/trama-143` desde main `fa479796`. Gates leídos por separado: `tsc --noEmit`
EXIT 0 y `vitest run` completo desde `game/` EXIT 0 (3702 passed, 1 skip).

## 1. El hallazgo: son TRES sitios y sólo tres

La tarjeta ya decía que « dragged under!» y «ARGH!» eran un solo mecanismo unido por el
bit 4. Confirmado y **acotado por censo mecánico**: de los **52 accesos** a
`g_combat_actor_records+2` (base 0xBA14, stride 8; displacement `-0x45ea`) en los 25
binarios, el bit 4 lo tocan **exactamente tres instrucciones**, y son un ciclo cerrado:

| papel | sitio | instrucción |
|---|---|---|
| SET | COMSUBS 0x03E0 | `or byte ptr [si - 0x45ea], 4` |
| TEST | COMBAT 0x07D7 | `test byte ptr [bx - 0x45ea], 4` |
| CLEAR | COMBAT 0x1CC9 | `and byte ptr [si - 0x45ea], 0xfb` |

El reparto del resto de máscaras (23× `test 0x80` = «es del party», 5× `or 1` = charmed,
3× `or 0x10` = invisible, 3× `test 8` = dormido…) encaja con los flags que el port ya
modelaba, así que el mapa del byte queda cerrado: **bit0 charmed · bit2 (=4) DRAGGED ·
bit3 (=8) sleeping · bit4 (0x10) invisible · bit7 (0x80) miembro del party**.

## 2. Los tres cuerpos, leídos enteros

**(1) SET — COMSUBS 0x0312**, dentro de la rama de golpe **no letal** a un miembro del
party. Cadena de gates: `0x03A4 test [bp-2],0x80` (víctima del party) → `0x03AA` descarta
atacante 0xFF → **`0x03B8 cmp byte ptr [bx - 0x45e9], 0x2d`** (el ATACANTE, campo +3).
Si cuadra: DS 0x9A10 « dragged under!\n» + sonido + `or [rec+2],4` + se pone a 0 el byte
de animación del actor (0x03ED, sobre `g_char_anim_states` 0x5C5A). Si no cuadra:
DS 0x9A22 « hit!\n» — que es lo ÚNICO que el port emitía.

★ **El gotcha, pagado y verificado**: 0x2D es índice de `monsterNamesUpper[45]` =
`"CORPSERS"` (comprobado contra `assets/data.json` en el test), **no** `TileData[0x2d]`
(=WheatInField).

★ **El orden importa y sale gratis**: los chequeos de muerte (0x035F/0x0365 → « killed!»)
van ANTES de 0x03A4, así que **un golpe letal no arrastra**. Hay test.

**(2) TEST — COMBAT 0x07D7**, a la cabeza del turno del actor. Con el bit puesto:
DS 0x6DC0 «ARGH!\n» + sonido + `call 0x1c66` + **el turno se consume** (0x0830 `[bp-4]=1`
→ jmp 0x7ba). Estar arrastrado = perder el turno.
★ Y va **antes** del bit 8 (sueño, 0x080A): con ambos flags puestos gana el ARGH. Portado
en ese orden, con test.

**(3) CLEAR — COMBAT 0x1C66**, la tirada de escape que invoca el propio ARGH:

```
1c72: call 0x982e             → kernel 0x3ABE = max(1, rand0(0x3C) >> 1) ∈ [1,30]
1c75: cl = [si - 0x45eb]      → rec+1 = la VELOCIDAD de iniciativa
1c7b: cmp cx, ax / jbe 0x1ce0, o sea: VELOCIDAD <= tirada ⇒ FALLA EN SILENCIO
1cac: DS 0x6F5E ' regurgitated!\n' precedido del NOMBRE + sonido
1cc9: and [rec+2], 0xfb       → LIBRE
1cd8: restaura el byte de animación que el SET había puesto a 0
```

★ **DOS controles positivos independientes del cuerpo**, ninguno buscado:
- `call 0x982e` resuelve (banda 2, base 0xA290) a **ULTIMA.EXE 0x3ABE**, que el port **ya
  tenía portado y derivado** como `CombatRng.rand30()` — el mismo helper que el daño de
  ÁCIDO de las trampas de cofre. No hice helper nuevo.
- `rec+1` es el campo que el port **ya documentaba** como `Combatant.speed`
  («Velocidad de iniciativa (rec+1)»). La tirada de escape se juega contra la iniciativa.

## 3. Lo portado

- `Combatant.draggedUnder` (flag 4) + `CORPSER_TYPE = 0x2d` exportado con su derivación.
- La rama del SET dentro del golpe no letal: sustituye « hit!» por « dragged under!» y
  enciende el flag **sólo** si el atacante es Corpser y la víctima es PJ.
- `playerDraggedTurn()`: ARGH + `rand30()` contra `speed` + « regurgitated!» y `clear` al
  cruzar; turno consumido en ambos casos. Cableado en los **7** call-sites de acción del
  PJ, siempre **antes** de la guarda de sueño.
- 3 cadenas nuevas en `approved-strings.json` (clase [D] + cita) y en `es.json`.

**IMPACTO DE STREAM DECLARADO**: `rand0(0x3C)` — **una** tirada por turno perdido. Antes
de este carril el ciclo entero no existía y estos turnos consumían **cero**. Hay test del
consumo y **control negativo** (un turno normal con `playerPass` no consume nada).

## 4. Lo que NO porté, y por qué

- **La escritura del byte de animación** (0x03ED / 0x1CD8, sobre `g_char_anim_states`):
  es presentación del sprite y el port no tiene esa capa por-actor en combate. Sin efecto
  mecánico observable — el estado real lo lleva el flag.
- **Los dos sonidos** (0x03D6 y 0x1CBF): la capa de audio del port va por cues propios;
  no hay `sfxEvent` derivado para estos y no me invento uno.
- **El caso de un ENEMIGO arrastrado**: no existe. El SET exige víctima con bit 0x80
  (party), así que sólo los PJ pueden quedar presos; el TEST de 0x07D7 corre sobre
  `g_cmb_actor` pero nunca encontrará el bit en un enemigo.

## 5. GATE ROJO, con baseline medida — no editado

`test_ningun_hueco_VIVO_puede_estar_fuera_del_censo` falla en esta rama con **3 entradas**,
y son EXACTAMENTE las tres que este carril acaba de cablear: `' dragged under!\n'`,
`'ARGH!\n'` y `' regurgitated!\n'`. **La baseline de main es CERO** (el lead dejó el gate
verde en `fa479796`, 27 passed), así que el delta es limpio: 0 → 3.

A diferencia del carril anterior **aquí no hay matices**: las tres son alcanzables de
verdad (el ciclo entero está vivo y con test), así que las tres son `estado: RESUELTO`
puro. No edito `orphan-strings.json` porque `resuelto_por` pide el hash del merge, que no
existe hasta que la rama aterrice.

## 6. Cabo para el lead

`re/ledger/globals.json` tiene `g_combat_actor_records @0xBA14 size 256`, pero **no hay
ficha del layout de campos** pese a que ya está derivado por varios carriles: +1 speed,
+2 flags (mapa completo en §1), +3 tipo/índice de PJ, +4 índice en `g_char_anim_states`.
Vale una entrada, porque el `+2` es el que reparte cinco mecánicas distintas.
