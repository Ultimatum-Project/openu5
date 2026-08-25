# El TENDERO sólo atiende en su tramo — gate derivado (#315), y la vía de proximidad (#304)

Sujeto: el BINARIO. Lecturas de primera mano sobre `re/disasm/TALK.OVL.asm`,
`re/disasm/NPC.OVL.asm` y `re/disasm/ULTIMA.EXE.asm`, con el cross-overlay resuelto por
instrumento (`re/tools/dispatch_table.py`), no por el destino impreso del desensamblador.

Nace del careo de #304/#265: al derivar qué hace la rama de TENDEROS de
`talk_converse_dispatch` apareció que **el port no la modela por NINGUNA de sus dos vías**
— ni por la que ya estaba cableada, (T)alk.

## §1 — La rama de tenderos de TALK 0x031E, leída entera

`dlgNum` reparte en 0x031E (tabla completa en `talk-031e-resolucion.md` §2). La familia
`0x80..0xFC` cae en 0x03e4 y atraviesa **dos** pruebas antes de la tienda:

```
03e4: mov bx, [bp-4]          ; rt = 0x5f5e + idx*16
03e7: test byte [bx+0xe], 1   ; (A) bit 0 del ÍNDICE DE TRAMO guardado en el registro vivo
03eb: je   0x406              ;     → rechazo
03ed: push [0xbcdc]           ; npcIdx
03f1: mov al, [g_hour]        ;
03f7: call 0xffffbbb6         ; (B) índice RECALCULADO desde el reloj → NPC.OVL:0x12E0
03fa: test al, 1              ;     bit 0 otra vez
03fc: je   0x406              ;     → rechazo
03fe: push [bp-2]             ; dlgNum
0401: call 0xe6               ; ← LA TIENDA
0406: ax=0x9196 ; print       ; rechazo, DOS cadenas:
040d: ax=0x91c4 ; print/ret 0 ;   «A merchant says:"Come see me at my shoppe, » + «when it's open!"»
```

★★ **El criterio no es un rango de horas: es la PARIDAD del índice de tramo.** Los `.NPC`
guardan 4 tiempos y 3 posiciones, y el puesto del tendero es el índice 1 — el único impar
de los tres. Por eso el binario no compara horas contra cotas: mira el bit 0. Quien lo
porte como «abre de X a Y» tiene que inventarse las cotas.

### §1.1 — El gate horario resuelto: NPC.OVL:0x12E0

El destino impreso `0xbbb6` es el stub kernel `0x7b36` = `lcall 0x72e,0x2ec` + dato
overlay **6** + `ljmp 0:0xb570`. Overlay 6 = `NPC.OVL`, `load_seg` 2601 ⇒ base
2601·16 = 0xA290 ⇒ **0xB570 − 0xA290 = NPC.OVL:0x12E0** (confirmado también por
`dispatch_table.stubs()[0x7b36]`).

Cuerpo (0x12e0-0x1327): resta la hora a los cuatro `times[]` **en byte sin signo** y se
queda con el mínimo = el periodo empezado más recientemente en aritmética circular. Y
🔴 **el índice 3 se devuelve como 1** (`0x131e: mov dx,1`, sin copiar `al`) — el quirk que
el port ya tenía portado byte a byte en `game/src/core/time.ts` (`scheduleIndex`).

### §1.2 — Lo que abre NO es un saludo: es la tienda ENTERA

`TALK 0x00e6` (leído): guarda del caballo (0x00ed, con la excepción HorseSeller 0x83 —
la ficha #170 del port), elección de personaje activo, `shoppeId = dlgNum − 0x81`, casado
de localización contra la tabla DS 0x23ca, y `jmp` por tabla de **8 tipos** a la rutina de
cada tienda. **Es el mismo punto de entrada que usa el comando (T)alk.**

★ **Corolario de ORDEN, y es derivado**: el gate horario está ANTES de `call 0xe6`, y la
guarda del caballo DENTRO. ⇒ a un tendero fuera de tramo se le oye «Come see me… when
it's open!», **no** el insulto del caballo, aunque llegues montado.

## §2 — Las dos pruebas COLAPSAN EN UNA en el port (declarado, no omitido)

(A) lee el índice **almacenado** en el registro vivo del NPC; (B) lo **recalcula**. En el
original pueden discrepar porque el almacenado sólo se refresca en la transición horaria
— el pestillo de la ficha #84, que el port NO modela. El clon recomputa el índice en cada
consulta, así que «almacenado» y «recalculado» son el mismo valor por construcción y la
conjunción se reduce a un test de paridad. **Si algún día se porta el pestillo de #84,
éste es uno de los sitios donde las dos vuelven a separarse.**

## §3 — El hueco del port, medido

`main.ts` (vía (T)alk) iba de `SHOP_TYPES[npc.dialogNumber]` a `startShopConsole` con la
sola guarda del caballo en medio: **cero condiciones de tramo**. La cadena de rechazo
existe extraída (`data.json` `stringPools[19].strings[148]` + `[150]`, pool
`textItemsWearUse`) y hasta **traducida** en `game/src/i18n/es.json` — y **ningún fichero
de `game/src` la emitía**. Control positivo del método de censo: «GET THAT HORSE OUT OF
HERE!» aparece en el i18n **y** en `core/game.ts`, o sea que un emisor se ve cuando existe.

### §3.1 — Población, y por qué el gate MUERDE

Censo sobre `game/assets/npcs.json`: **46 tenderos** (`0x80 ≤ dlgNum ≤ 0xFC`) en los 8
pueblos, de los cuales **14 tienen aiType 4/5** (los de #304, la vía de proximidad).
Barriendo las 24 horas con el gate: **ninguno abre las 24 h y ninguno cierra las 24 h**
(mínimo 3 h abiertas, máximo 19). Esa partición es lo que hace el gate observable: un
predicado constante —«siempre sí» o «siempre no»— pasaría un aserto sobre un tendero
elegido y no cambiaría nada en el juego; sobre la población entera, no.

## §4 — Lo que este gate NO guarda

🔴 El quirk 3→1 es **invisible** para el gate: 3 y 1 son ambos impares, así que un mutante
que devuelva 3 en vez de 1 deja verde toda la guarda de #315. El quirk es carga útil para
la COLOCACIÓN (elige la terna `x/y/aiTypes`; con 3 el índice se sale del array de 3), y
quien lo guarda es `game/tests/time.test.ts:33/40/41`, que asertan el VALOR. Se escribe
aquí y en el docblock del test para que nadie lea ese verde como cobertura del quirk.

## §5 — RNG

La rama de tenderos **no pasa** por `0x111c`, así que no consume la moneda de
autopresentación de #301 (`0x1153`, tras `test_npc_met`). Lo que **no** está censado
todavía es si los flujos de SHOPPES consumen tiradas propias: ese censo precede a cablear
la vía de proximidad de #304, y la ventana se pedirá entonces si el censo la pide. El gate
de esta entrega es una condición DELANTE de código existente: no estrena mecanismo de RNG
ni ocasiones de uno.
