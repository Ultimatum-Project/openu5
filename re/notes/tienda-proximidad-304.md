# El TENDERO abre tienda porque te plantas a su lado — y el despacho te desarma (#304)

Sujeto: el BINARIO. Lecturas de primera mano sobre `re/disasm/TALK.OVL.asm`,
`re/disasm/NPC.OVL.asm` y `re/disasm/TOWN.OVL.asm`; los cross-overlay resueltos con
`re/tools/dispatch_table.py`, no con el destino impreso del desensamblador.

Es la parte (b) de #315 y la hermana de #301: el MISMO fast-path de proximidad, pero con
un `dlgNum` de la familia de tenderos. El despachador es UNO y reparte por `dlgNum`
DESPUÉS de que lo llame quien sea, así que la rama de tienda es alcanzable sin (T)alk.

## §1 — El camino, y su ÚNICO llamador

`NPC.OVL 0x06e4` (fast-path, §1 de `npc-interpela-por-adyacencia-301.md`): manhattan==1
∧ aiType ∈ {4,5} ∧ dlgNum ≠ 0 ⇒ `[0x65be]=0x74`, `[0x65bf]=idx`. `TOWN 0x1671` despacha a
`npc_engine 0x1352`, y su `0x13ce` llama a **`TALK 0x031E talk_converse_dispatch`**.

★★ **`0x031E` tiene UN solo llamador en los 28 overlays.** Censo por instrumento
(`near_calls_to_kernel(ov, 0x7AE2)` sobre los 28, con control positivo exigiendo que
TOWN.OVL aparezca): `[('TOWN.OVL', ['0x13cf'])]`. ⇒ **el comando (T)alk NO entra aquí**;
todo lo de esta acta es propiedad de la vía de PROXIMIDAD.

## §2 — La rama de tenderos (0x03e4), y el ORDEN

`dlgNum` reparte en 0x0396 (`cmp [bp-2],0x80 / jge`) y 0x03a6/0x03cc/0x03d8 apartan
0xFD/0xFE/0xFF. Lo que sobra —**0x80..0xFC**— cae en 0x03e4:

```
03e7: test byte [bx+0xe], 1   ; (A) paridad del índice de tramo ALMACENADO
03eb: je   0x406              ;     → rechazo
03f7: call 0xffffbbb6         ; (B) índice RECALCULADO (NPC.OVL:0x12E0)
03fa: test al, 1              ;     paridad otra vez
03fc: je   0x406              ;     → rechazo
0401: call 0xe6               ; ← LA TIENDA
0406: 0x9196 + 040d: 0x91c4   ; rechazo: «Come see me at my shoppe… when it's open!»
```

Y dentro de `0xe6` (leído, 0x00e6-0x0185): **0x00ed** la guarda del caballo
(`and al,0xfe / cmp al,0x12`) con la excepción HorseSeller (**0x00f6** `cmp [bp+4],0x83`),
luego `shoppeId = dlgNum − 0x81` (0x011f) y **0x017a** `cmp ax,7 / ja 0x1da` = sólo ocho
tipos abren algo.

★ **Corolario de ORDEN, DERIVADO**: el gate horario está ANTES de `call 0xe6` y la guarda
del caballo DENTRO ⇒ a un tendero fuera de tramo se le oye «Come see me…», **no** el
insulto del caballo, aunque llegues montado. (Es el mutante M3 del test.)

★ El rango 0x80..0xFC es **más ancho** que los ocho que abren tienda, y lo es también en
el binario: 0x80 y 0x89..0xFC atraviesan gate y guarda y no abren nada. En los datos de
hoy no existe ninguno (los 46 tenderos son 0x81-0x88).

## §3 — 🔴 EL PRÓLOGO QUE NADIE HABÍA LEÍDO: el despacho DESARMA al NPC

Antes de mirar el `dlgNum`, `0x031E` hace esto (0x0348-0x0354):

```
0340: mov ax, si ; 0342: add ax, 0x5d5e   ; base de aiTypes del NPC (idx*16)
0348: mov bx, [bp-4]                      ; rt = 0x5f5e + idx*16
034b: mov si, [bx+0xe]                    ; índice de tramo ALMACENADO
034e: add si, ax                          ; si = &aiTypes[tramo]
0350: cmp byte ptr [si], cl               ; cl = 4 (vivo desde 0x0334)
0352: jne 0x36a
0354: mov byte ptr [si], 1                ; ← el 4 pasa a 1, EN LA TABLA VIVA
```

Y el 4 es **exactamente** lo que arma el fast-path (`0x0728 cmp [bp-2],3 / jle`).
⇒ **un NPC de aiType 4 te aborda UNA vez y deja de armar el disparador.**

Sin esto, la mecánica de #304 no es una mecánica sino un **cepo**: medido en el árbol
antes del fix, `npc-initiates-shop` salía en el turno 1 **y** en el turno 2 con la party
quieta — la consola de la tienda reabriéndose cada turno mientras no te alejes.

### §3.1 — Las tres cotas del alcance, todas derivadas

- **Sólo el 4.** `cmp` con `cl`=4 es IGUALDAD: el aiType 5 no se normaliza. En los datos
  de hoy es una distinción sin diferencia (los 14 tenderos con 4/5 y los 13 guardias de
  tributo son **todos aiType 4**; cero 5), pero la guarda se escribe por el binario.
- **Sólo por esta vía**, por §1: el comando (T)alk no pasa por `0x031E`.
- **Para TODO `dlgNum`**, no sólo tenderos: el prólogo corre antes del reparto. El guardia
  del tributo (0xFF) y el NPC guionizado de #301 también quedan degradados tras su primera
  intercepción. La rama del marcador `0x61` (hostil, aiType ≥ 6) **no** pasa por aquí
  (`npc_engine` 0x13a4 no llama a `0x031E`) y por tanto no normaliza.
- **Dura lo que dura la VISITA.** La tabla `0x5d5e` es estado vivo con más escritores
  —`CMDS 0x116c` y `TOWN 0x03d8` ponen 6, `SJOG 0x0eb5` pone 5, `TOWN 0x0105` escribe
  calculado— y **ninguno vuelve a escribir un 4**: sólo la recarga del `.NPC` al entrar al
  mapa lo restaura, que es lo que hace `NpcManager.enterMap` (`aiTypes: [...s.aiTypes]`).
  ⇒ **una apertura/demanda por NPC y por ENTRADA AL PUEBLO.**

### §3.2 — 🔴 Esto REFUTA a `tc-result-producer.md` §2.2/§5, y el modo importa

Aquella acta concluye «**no hay limitador de tasa, en ninguna capa**… la condición del
fast-path se re-evalúa entera, **desde cero**, en cada pasada». Lo primero es cierto (no
existe ningún flag dedicado) y lo segundo también — **pero sobre un dato que el despacho
anterior mutó**. Re-evaluar desde cero no es re-evaluar al mismo resultado si uno de los
conjuntos de la condición es estado vivo que la propia rutina escribe.

El acta **no leyó el prólogo de la rutina que nombra**: censo con control positivo sobre
`tc-result-producer.md` = **cero** menciones de `0x034x`/`0x035x`, con el mismo patrón
encontrando otras tres direcciones `0x03xx` en el fichero. Quien sí lo leyó es
`talk-031e-resolucion.md:24` («si el byte de aiType == 4 → lo normaliza a 1»), que leyó
`0x031E` entera. Dos actas del corpus en contradicción; se cae la que no abrió la rutina.

⚠ Consecuencia incómoda que conviene decir entera: el modelo que el port tenía ANTES
(`npc.tributeDemanded`, «1 por entrada de pueblo») describía bien la conducta observable
y fue retirado por conservador. El resultado vuelve a ser ése — pero ahora **derivado**,
con su mecanismo y su alcance, no adoptado por prudencia.

## §4 — Población

Sobre `game/assets/npcs.json`: **46 tenderos** (0x80..0xFC), **14** con aiType 4/5 (todos
4, quince ranuras). Los 14 arman en horas reales (167 horas-NPC; ninguno las 24 ni cero).

🔴 **El RECHAZO por proximidad es HOY INALCANZABLE en los 14**, y se declara en vez de
taparse: el MISMO `scheduleIndex` elige el aiType del fast-path Y la paridad del gate, así
que un tendero cuyo 4 vive sólo en tramos impares arma exactamente cuando su tienda está
abierta. Barrido 14 × 24 h = cero horas con fast-path armado y tienda cerrada (con control
positivo sintético que SÍ lo encuentra cuando existe). Se cablea igual porque es la
conducta derivada, y porque el pestillo de #84 la haría alcanzable en la transición.

## §5 — RNG

Cero tiradas, **medido con sonda propia** (contador en el `rand` del arnés) sobre el TURNO
ENTERO de la intercepción, tanto en la apertura como en el rechazo — no heredado del censo
de #316, cuya población era la de la consola de (T)alk. La consola de la tienda queda
fuera del alcance de esta sonda (vive en `boot()`); para esa mitad el dato sigue siendo
#316.

⚠ **PERO la normalización MUEVE STREAM**, y es su única consecuencia sobre el RNG: el
aiType elige rama en `npcManager.tick` —el 4 persigue-o-vagabundea según distancia al
puesto, el 1 vagabundea siempre— y las dos consumen `rand` distinto. La divergencia
empieza en el turno SIGUIENTE a la primera intercepción de cada NPC de aiType 4, y afecta
a los 33 NPC con 4/5 de la extracción, no sólo a los tenderos.

🔴 **Y por tanto el careo del TOUR DEL ESPEJO queda caducado POR SEGUNDA VEZ.** #312 ya
estaba esperando re-careo tras #301 (que tocó la misma vía de proximidad); esta entrega lo
vuelve a mover, y por un mecanismo distinto —no el disparo de la conversación sino el
DESARME del NPC tras ella—. La foto anterior a #301 no vale, y la que se tomara entre #301
y esto tampoco. No es trabajo de esta ficha: se declara para que #312 sepa que su
denominador cambió dos veces y contra qué SHA re-fotografiar.

## §6 — Herencia del carril anterior, y la clase de avería que trajo

Tres de los dieciséis asertos del fichero heredado estaban ROJOS y **ninguno se había
corrido nunca**. Dos eran de alcance (usaban la terna real a una hora en que el fast-path
no arma — la misma inalcanzabilidad que el propio fichero documenta dos bloques más
abajo). El tercero merece nombre propio:

★★ **GUARDA VACUA POR TESTIGO NULO.** El aserto de identidad careaba el NPC del evento
contra `game.talkTarget("east")?.npc`, y `talkScriptFor` devuelve `null` para todo
`dlgNum >= 0x80` **por diseño** (es el gate de #315). Para un TENDERO el testigo vale
`undefined` siempre ⇒ el aserto comparaba `undefined` con `undefined`: un verde que **no
depende del sujeto** y que habría seguido verde con el evento entero suprimido. El
discriminante barato es preguntar si el testigo PUEDE tomar un valor no-nulo para la
población del test; aquí no podía, y el gate que lo impedía estaba escrito en el propio
repo. Hermana de la familia «el testigo elegido hace pasar al aserto con el código roto».

🔴 Y una avería que **nació con este fix**, no heredada: `aiTypes`/`times` se pasaban al
arnés POR REFERENCIA desde constantes de módulo. En cuanto el port empezó a MUTAR el
aiType, el primer test que abordaba al tendero dejaba la terna compartida en `[1,4,4]` y
los siguientes corrían sobre un fixture ya sucio — tres rojos con pinta de defecto del
código. La copia (`[...spec.aiTypes]`) es la que hace `NpcManager.enterMap`; el arnés la
replica. Clase: **un fixture inmutable deja de serlo el día que el sujeto escribe donde
antes sólo leía.**
