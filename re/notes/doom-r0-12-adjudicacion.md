# ADJUDICACIÓN (#12) — Doom r0 / `DUNGEON.CBT[96]`: la ranura SÍ está vacía, y la salida del original es **el CETRO**

Tarjeta #12, nacida del frente ch27 de `salas-50-acta.md`. Pre-registro con predicciones
en `doom-r0-12-prerregistro.md` (escrito antes de leer un byte). Derivación offline: cero
corridas e2e, cero DOSBox.

## Veredicto en una línea

Ni ranura fantasma ni softlock del original: **`DUNGEON.CBT[96]` está genuinamente vacía,
la sala es real, el binario entra sin guarda — y se sale usando el CETRO contra el anillo
de `ShadowlordBoundary` que rodea la arena.** El motor del port ya calca ese barrido. Lo
que no sabe usarlo es **el arnés**, cuyo repertorio de salidas es más estrecho que el del
original.

## 1. El dato crudo — el extractor está EXONERADO (control primero)

El heredado decía «`units: []` en `combatmaps.json`», pero ese JSON es un **artefacto
derivado**: si el extractor se comiera las unidades, toda la adjudicación de ch27 sería
circular. Lectura directa de `original/u5/ultima5/DUNGEON.CBT` (39.424 B = 112 × 352),
ranura `96` en `base = 96×352 = 33792`:

| ranura | = combatmap | fila 5 (sprites de las 16 unidades) | fila 0 (sprites de los 8 triggers) |
|---|---|---|---|
| 95 | 111 | `216,216,1,1,216,1,212,212,212,212,0…` | todo 0 |
| **96** | **112** | **todo 0** | **todo 0** |
| 97 | 113 | `136,136,136,136,136,136,136,0…` | `29,29,0…` |

Las ranuras 95 y 97 son el **control positivo**: el mismo lector las saca pobladas. ⇒ la
ranura 96 está vacía **en el fichero de EA**, no en nuestra tubería. **P1 cumplida.**

## 2. La sala es REAL — también contra el dato crudo

`original/u5/ultima5/DUNGEON.DAT` (4.096 B = 8 mazmorras × 8 plantas × 64 celdas, 1 byte:
nibble alto = tipo, bajo = sub). Doom = índice 7:

```
Doom f0(1,1) = 0xF0  →  tipo 0xF (Room), sub 0  →  roomNo 0
```

Y el censo de las 16 salas de Doom por planta sale EXACTAMENTE como la tabla del spec de
ch27 (f0 r0 · f1 r2 · f2 r3/r4/r6 · f3 r1 · f4 r5 · f5 r7/r8 · f6 r9/r10/r13/r14 ·
f7 r11/r12/r15). ⇒ el port no se inventa la sala: la lee. **P2 cumplida.**

## 3. El binario ENTRA sin preguntar si el mapa tiene unidades

La rutina de entrada a sala vive en `DUNGEON.OVL`, offset CS 0x0000. Leída instrucción a
instrucción:

```
0022  and ax, 0xf                 ; bp+4 → roomNo               → [bp-0x1a]
003a  mov al, [g_location]
003d  sub ax, 0x21                ; loc 0x21 (Deceit) → 0
0043  cmp ax,1 / 0048 dec [bp-0x1c]  ; ★ SALTA DESPISE — el «dungeonOrderSkippingDespise»
004b  mov ax, 0x1600 / imul [bp-0x1c] ; orden × 5632  (= 16 × 352)
0053  mov ax, 0x0160 / imul [bp-0x1a] ; roomNo × 352
0059  add cx, ax → [bp-8]         ; ★ OFFSET EN DUNGEON.CBT
005e  mov cx,0x160 / di=0xad14 / repne stosb   ; cero el búfer de 352 B
007b  call 0xffffa39e             ; ← CARGA el registro del .CBT en 0xad14
00a8  mov [g_location], 0xff      ; marca «en combate»
00b9  call 0xfffffa6e (arg, 3)    ; montaje del tablero
00bf  mov [g_unk_58a1], 0x82      ; ★ flag de combate de SALA
00c4  call 0xfffffa62             ; ★★ EL BUCLE DE COMBATE
00c7  or ax, ax
00c9  jne 0xfa                    ; ax≠0 → NO despeja
00f5  and byte [bx+si+0x595a], 0xaf   ; ★ ax==0 → degrada la celda: 0xF0 & 0xAF = 0xA0 = RoomsBroke
```

Dos cosas quedan probadas de una vez: **(a)** la fórmula del índice del port
(`16 + ordenSinDespise×16 + roomNo`) es la del binario, instrucción a instrucción; y
**(b)** entre la carga del `.CBT` en CS 0x007b y la llamada al bucle de combate en
CS 0x00c4 **no hay una sola comprobación de «¿tiene unidades este mapa?»**. El original entra igual. **P3 cumplida** —
y con ella cae la rama (2) del encargo: no hay failing-first de «no disparar en ranura
vacía», porque el original SÍ dispara.

## 4. ★★ Entonces, ¿cómo se sale? El anillo NO es roca: es BARRERA DE SHADOWLORD

Aquí estaba el error de encuadre heredado —mío incluido—: «perímetro entero de muro». Los
tiles del anillo de cm112 no son muro:

```
 0  255,115,116,115,113,116,255,255,115,113,116
 1  115,117,114,117,  5,114,113,116,112,  5,112
 2  112,  5,  5,  5,  5,  5,  5,114,117,  5,112
 …
```

`112-117` = `0x70-0x75` = **ShadowlordBoundary1..6**. `255` = BlackSquare. Composición del
anillo (40 celdas): **28 de barrera + 12 BlackSquare**.

Y la barrera tiene disolvente en el original — el mismo que el propio spec de ch27 ya usa
para r3: **(U)se Cetro**. El motor del port lo calca en
`Combat.sceptreDissolveFields()` (combat.ts:532), derivado de **CAST.OVL**, CS 0x1966, cuyo
barrido vive en CS 0x19a5. Recorre el **3×3 del combatiente ACTIVO** y disuelve a Grass
(el tile 5) todo tile cuyo valor cumpla `(tile & 0xf0) === 0x70`; la escritura del 5 la
hace CS 0x19ce. Es el mismo predicado byte-exacto que el barrido de overworld, en
CS 0x19c8, que enmascara con 0xf0 y compara contra 0x70. Sin RNG.

**La geometría cierra el argumento** (BFS desde la celda medida de la party, (5,6)):

- celdas alcanzables a pie: **56**
- celdas alcanzables **desde las que el barrido 3×3 abre una celda de ANILLO**: **10**

```
party en (4,1) → disuelve anillo [(3,0),(4,0),(5,0)]
party en (1,2) → disuelve anillo [(0,1),(0,2),(0,3)]
party en (9,1) → disuelve anillo [(8,0),(9,0),(10,0),(10,1),(10,2)]
party en (4,9) → disuelve anillo [(3,10),(4,10),(5,10)]        … y 6 más
```

⇒ **la salida existe, es fiel, y está a un (U)se de distancia.** El jugador del original
entra a una sala vacía, ve que está sellada, usa el Cetro —que lleva obligatoriamente, es
requisito del descenso de Doom— y sale andando por el borde recién abierto. Entonces el
bucle retorna 0 y la celda se degrada a RoomsBroke en CS 0x00f5: **VICTORY**, exactamente el
baseline sellado (`#112 (r0) = VICTORY` en `CENSO-COMBATMAPS.md`).

## 5. Dónde está el defecto: el ARNÉS otra vez, y es la TERCERA de la misma familia

`nav.ts` **sí** sabe usar el Cetro… en otro sitio. La rama `opts.sceptre &&
findBoundary(s.tiles)` (nav.ts:2629) vive en la cadena de «no alcanzo a ningún ENEMIGO» y
es opt-in (`sceptreClear`); `resolveRoomSceptreDescend` (3163) lo usa para destapar una
escalera. **La rama de SALIDA —post-victoria y `fleeCombat`— no tiene Cetro.** Y en r0 no
hay enemigos, así que el flujo entra por la rama de salida, que sólo sabe una cosa: buscar
un borde ya pasable.

Puesto junto a lo anterior, el patrón es uno solo y ya va por tres:

| # | salida del original | ¿la tiene el MOTOR? | ¿la usa la rama de SALIDA del arnés? |
|---|---|---|---|
| #50 (aterrizado) | borde alcanzable de verdad | — | ✅ tras el fix |
| **#11** | (K)limb en escalera (tiles 200/201) | ✅ `playerKlimbEscape` | ❌ |
| **#12** | (U)se Cetro contra la barrera (tiles 112-117) | ✅ `sceptreDissolveFields` | ❌ |

**El arnés modela «salir de una sala» como «andar hasta un borde», y el original tiene al
menos tres vías.** Las dos que faltan ya están implementadas y derivadas en el motor: es
cableado del conductor, no mecánica nueva.

> ⚠ **ENMIENDA datada (2026-08-01, auditoría final — tras `salidas-11-errata-grate.md`):**
> el «al menos tres vías» acertó al hedgear, y la tabla de arriba **está incompleta en su
> fila #11**. La vía KLIMB no son dos tiles sino **TRES**: `cmd_klimb_combat`
> (SJOG 0x1dd5-0x1e19) acepta `0xC8` (200, sube), `0xC9` (201, baja) y **`0x86` = 134, el
> GRATE**, este último *gateado por combate de sala* (`test [g_unk_58a1],0x80` en 0x1dfb).
> La fila decía «(K)limb en escalera (tiles 200/201)» y el `0x86` no estaba — el mismo tile
> que se le pasó al censo de §6, abajo. El repertorio COMPLETO queda cerrado en tres puertas
> (BORDE · KLIMB×3 tiles · CETRO), no «al menos tres».

## 6. Control negativo — esto NO reabre ch29

Comprobado antes de escribirlo, porque habría invalidado mi propio veredicto de #50: de las
6 salas de ch29, **ninguna** tiene una sola celda de barrera en su anillo.

| cm | sala | barrera en el anillo | resto del anillo |
|---|---|---|---|
| **112** | **doom-r0** | **28 de 40** | BlackSquare 12 |
| 102 | hythloth-r6 | **0** | BlackSquare 40 |
| 18 | deceit-r2 | 0 | BlackSquare 30 + StoneBrickWall 10 |
| 84 / 85 / 95 / 108 | shame-r4/r5/r15, hythloth-r12 | 0 | BlackSquare + LargeRockWall |

⇒ ~~`hythloth-r6` sigue siendo **BOLSILLO FIEL** (roca de verdad y sin escalera)~~ y las
otras cuatro siguen saliendo por ESCALERA. cm112 es un caso **distinto y único**: es la
única sala de mazmorra del juego cuyo anillo es barrera disoluble.

> ⚠ **ENMIENDA datada (2026-08-01, auditoría final) — `hythloth-r6` NO es un bolsillo fiel.
> REFUTADO por `salidas-11-errata-grate.md` §4.a, que cita ESTA sección por su nombre.**
>
> El control negativo de arriba buscó tres cosas —anillo pasable, escalera `0xC8`/`0xC9` y
> barrera de Shadowlord— y **no buscó el Grate**. `cm102` tiene un `0x86` en **(5,3)**
> (contado sobre `combatmaps.json` al escribir esta enmienda: `0x86`=1, `0xC8`=0, `0xC9`=0).
> Donde este §6 concluye «bolsillo fiel» debe leerse **`hythloth-r6` sale por GRATE y pasa a
> `VICTORY`** (eco `Klimb-Down!`; predicción P7 de la errata).
>
> Los bolsillos fieles del juego son **DOS**, no los siete del pre-registro ni el de aquí:
> **Doom r6 (cm118) y Doom r15 (cm127)**, los únicos sin ninguna de las tres puertas.
> Los cinco mapas con Grate son cm32, cm33, **cm102**, cm114 y cm122.
>
> **Lo que NO cambia:** el veredicto de esta acta sobre `cm112`/doom-r0 —anillo de barrera
> disoluble, salida por el CETRO, único del juego— no se ve afectado; cm112 no tiene `0x86`
> (verificado: `0x86`=0, `0xC8`=0, `0xC9`=0). Lo que cae es el CONTROL NEGATIVO, no la
> adjudicación.
>
> La lección quedó escrita en la propia errata y vale para esta sección igual que para el
> pre-registro: *un control negativo enumera lo que se le ocurrió al autor y se reporta como
> si enumerara el espacio.* Aquí el espacio tenía una puerta más.

## 7. El defecto separable, medido en su tamaño real

Con `units: []` el arnés se rinde antes de que avance un turno, así que
`maybeLatchVictory` (combat.ts:1064) nunca corre y `victory` se queda `false` ⇒
`conquerRoom` etiqueta **DEADEND** una sala sin enemigos. **Pero eso NO es un defecto del
motor**: la condición del latch (`!anyActiveOnSide("monsters") && anyAliveOnSide("party")`)
ya se cumple con cero unidades — sólo necesita que corra UN `advanceTurn`. En cuanto el
conductor use el Cetro y camine, latchea y `onVictoryLatch` marca la celda (game.ts:6407).
⇒ **P5 REFUTADA como defecto de motor**; es un artefacto del arnés que muere con el fix
de §5. Queda dicho para que nadie lo persiga como sapo del port.

## 8. Qué hacer — y por qué NO es una tarjeta aparte

La rama (3) del encargo («si el original SÍ dispara: calcar lo que hace») se resuelve
enseñando a la rama de salida a usar el Cetro. Eso es **exactamente el mismo cableado, en
el mismo sitio, con el mismo coste de re-sello** que la tarjeta **#11** del (K)limb.
Recomendación: **plegar #12 dentro de la ventana de #11** — una sola ventana, un solo
re-sello de la cadena de salas, un solo byte-check de ch14b. Partirlas obliga a pagar la
ventana dos veces por dos líneas en la misma función.

Criterio de aceptación heredable para esa ventana:
1. `ch27` r0 pasa de `DEADEND-STUCK` a **VICTORY** (y con ello caen los 5 THROW de cascada,
   que nunca fueron 5 fallos).
2. `ch29`: las 4 con escalera pasan a VICTORY; **`hythloth-r6` sigue `VICTORY-STUCK`** — si
   también cambiara, el sospechoso es el instrumento, no el fix.
3. La rejilla medida NO cambia en ninguna de las 6 (`reach=[]` sigue siendo `[]`): lo que
   cambia es el VEREDICTO, no la geometría.

## 9. Marcador de predicciones de esta tarjeta

| # | predicción | resultado |
|---|---|---|
| P1 | el extractor es fiel; la ranura está vacía en el .CBT crudo | ✅ **cumplida** (con control positivo) |
| P2 | la celda es una sala real en DUNGEON.DAT | ✅ **cumplida** (contra el dato crudo) |
| P3 | el binario no consulta el .CBT antes de entrar | ✅ **cumplida** (de CS 0x007b a CS 0x00c4; NINGUNA guarda) |
| P4 | hay una salida que el port/arnés no reproduce | ✅ el MARCO, pero ❌ **el mecanismo**: aposté por F3 (chequeo temprano de bando vacío) y en segundo lugar F1; la respuesta —el CETRO— **no estaba en mi lista de tres** |
| P5 | el mal etiquetado sobrevive como defecto separable del port | ❌ **REFUTADA**: es artefacto del arnés, el latch del motor está bien |

3 limpias de 5. **La que más enseña es P4**: escribí «perímetro entero de muro» heredando
la palabra del acta anterior, y esa palabra —«muro»— cerró el espacio de hipótesis antes de
mirar. Los tiles estaban delante desde el primer volcado de la sonda: `112,115,116…`. No
hizo falta ningún dato nuevo para verlo, sólo **dejar de creerme mi propio resumen y
preguntarle a la tabla de tiles cómo se llamaban**. Es la misma lección que P2.b/P2.c de
#50, dos veces en el mismo carril: **el resumen de la capa anterior propaga sus premisas, y
el que lo hereda las paga**.
