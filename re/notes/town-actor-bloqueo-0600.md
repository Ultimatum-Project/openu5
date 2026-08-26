# El predicado de PASO en pueblo — `town_move` TOWN.OVL 0x0600: el ACTOR manda, y comparte cola con el muro

Adjudicado contra el binario el 2026-08-26 (carril `fase-bloqueo`). Es la mitad de
**PUEBLO** del bloque que la ficha #342 ya adjudicó para el **EXTERIOR**
(`apie-342-ocupacion.test.ts`, MAINOUT 0x01FE). Precedente vecino ya adjudicado y **no
re-derivado aquí**: `f8-objeto-vision-luz.md` §1, que mide que el paso mira objetos como
segundo predicado aparte y antes del terreno.

## 0. Cómo se resuelven los `call 0xffff….` de este fichero

Son near-calls cross-overlay: capstone desensambla el .OVL con base 0, y el destino real
es `(target + load_seg*16) & 0xFFFF` (modelo de `re/tools/seg2_resolve.py`). TOWN.OVL
carga en `load_seg = 0x081D` ⇒ **`+0x81D0`**.

**Control positivo del método**: `0xffffb4be + 0x81D0 = 0x1368E & 0xFFFF = 0x368E`, que
es el mismo destino (`find_object_at_xy`) que `f8-objeto-vision-luz.md` §1 ya cita por
otra vía. Con la misma regla: `0xffffaa7c → 0x2C4C` (passability de terreno),
`0xffff9680 → 0x1850` (print), `0xffffa0f0 → 0x22C0` (beep).

## 1. El orden: ACTOR primero, TERRENO después

```
0675: mov bx, word ptr [bp - 0xa]
0678: mov al, byte ptr [bx + si - 0x5459]   ; el TERRENO se BUSCA aquí…
067e: mov word ptr [bp - 0xe], ax           ;   …y se guarda SIN consultarlo
0669: mov word ptr [bp - 4], 1              ; «pasa» entra valiendo 1
068b: push ax                               ; X = g_party_x + dx
0695: push ax                               ; Y = g_party_y + dy
069b: push ax                               ; Z = g_floor
069c: call 0xffffb4be                       ; → kernel 0x368E find_object_at_xy
069f: mov word ptr [bp - 8], ax             ; TYPE del actor, o 0 si no hay
06a2: or ax, ax / 06a4: jne 0x6a9
06a6: jmp 0x776                             ; SIN actor → [bp-4] sigue 1
06a9: mov word ptr [bp - 4], 0              ; ★ HAY ACTOR ⇒ BLOQUEA por defecto
…
0776: cmp word ptr [bp - 4], 0
077a: jne 0x77f
077c: jmp 0x83a                             ; ★ bloqueado ⇒ cola de choque
077f: mov al, byte ptr [g_transport_tile]
0785: push word ptr [bp - 0xe]              ; …y AQUÍ, por fin, el terreno
0788: call 0xffffaa7c                       ; → kernel 0x2C4C
078b: or ax, ax / 078f: jmp 0x83a           ; terreno no pisable ⇒ MISMA cola
```

El veredicto del actor **manda**: con `[bp-4]=0` el test de terreno de 0x0788 ni se
llega a llamar. Avanzar exige **las dos cosas** — actor ausente-o-abordable **Y** terreno
pisable.

## 2. Qué tabla barre `find_object_at_xy` (0x368E) — y por qué es la de los PNJ

```
3696: mov dx, 1            ; índice de slot, arranca en 1  ⇒ el slot 0 NO se barre
3699: mov di, 0x5c64       ;  campo +2 (x) del slot 1
369c: [bp-4] = 0x5c65      ;  campo +3 (y)
36a1: [bp-6] = 0x5c66      ;  campo +4 (z)
36a6: mov si, 0x5c62       ;  campo +0 (TYPE)
36b1: cmp ax, [bp + 8]     ; X   (el llamador empujó X, Y, Z en ese orden)
36bb: cmp ax, [bp + 6]     ; Y
36c0: cmp cl, 0x7f / ja 0x36d4   ; g_location > 0x7f ⇒ NO se compara la planta
36cf: cmp ax, [bp + 4]     ; Z = g_floor
36d4: mov al, byte ptr [si] ; devuelve el TYPE del actor encontrado
36de: add … 8              ; paso de registro = 8 bytes
36ed: cmp si, 0x5d5a / jb 0x36ad   ; último si = 0x5d52 ⇒ slots 1..31
36f7: sub ax, ax           ; centinela «no hay actor» = 0
```

⇒ registro de **8 bytes** en `0x5C5A + 8·slot`, campos `+0 type · +2 x · +3 y · +4 z`,
**32 slots** de los que se barren **1..31** (el 0 es el vehículo del party).

**Que esa tabla es la de los PNJ vivos lo prueba su ESCRITOR**, no el parecido de las
direcciones: el commit del paso del PNJ en `NPC.OVL` escribe ahí la x y la y del que
acaba de caminar, con el índice de slot del propio PNJ:

```
NPC.OVL 090f: mov si, word ptr [bx + 0xc]   ; slot del NPC
        0912: mov cl, 3 / 0914: shl si, cl  ; ×8 = el paso de registro
        091c: mov byte ptr [si + 0x5c5c], al ; x   (0x5c5a + 2)
        0926: mov byte ptr [si + 0x5c5d], al ; y   (0x5c5a + 3)
```

⇒ **en el binario un PNJ en la casilla destino BLOQUEA el paso, y bloquea por PRESENCIA**:
no hay comprobación de `aiType`, de hostilidad, de horario ni de estado. Lo único que
libra a un actor es la lista blanca de §3.

## 3. La lista blanca de actores «abordables», por régimen de transporte

`t = g_transport_tile`, `a = [bp-8]` = TYPE del actor (= tile del port − 0x100).

```
06ae: cmp [g_transport_tile], 0x30 / jae 0x6bf     ; t ≥ 0x30  → rama A
06b5: cmp [g_transport_tile], 0x20 / jb  0x6bf     ; t < 0x20  → rama A
06bc: jmp 0x75e                                    ; 0x20 ≤ t < 0x30 → rama B
; ── rama A (a pie / montado / alfombra) ──────────────────────────────────
06bf: cmp [bp-8], 0x24 / jl 0x6ce
06c5: cmp [bp-8], 0x2c / jge 0x6ce / jmp 0x771     ; 0x24 ≤ a < 0x2c  fragata/esquife
06ce: cmp [bp-8], 0x1b / je → 0x771                ; a == 0x1b
06d7: mov al, [bp-8] / and al, 0xfe / cmp al, 0x10 ; (a & 0xFE) == 0x10
06e3: cmp [bp-8], 0x1e / je → 0x771                ; a == 0x1e
06ec: cmp [bp-8], 0x1f / je 0x6f5 / jmp 0x776      ; a == 0x1f  · resto: BLOQUEA
0771: mov word ptr [bp - 4], 1                     ; vuelve a «pasa»
; ── rama B (fragata / esquife) ───────────────────────────────────────────
075e: cmp [g_transport_tile], 0x28 / jb 0x776      ; FRAGATA: nada es abordable
0765: cmp [bp-8], 0x24 / jl 0x776
076b: cmp [bp-8], 0x28 / jge 0x776 / → 0x771       ; ESQUIFE: sólo la fragata
```

⇒ **la lista blanca de PUEBLO es la de MAINOUT (ya portada en
`world/transport.ts:410 isBoardableActorTile`, derivada de MAINOUT 0x0245-0x0283) MÁS
dos entradas propias: `a == 0x1e` y `a == 0x1f`.** En el espacio de tiles del port,
`0x11E DeadBody` y `0x11F Splat`: restos que se pisan.

Las demás, con su nombre en el port: `0x124-0x12B` fragatas y esquifes · `0x11B Carpet2`
· `0x110/0x111` HorseRight/HorseLeft. (⚠ el docblock de `transport.ts` rotula `0x1b`
como «caballo» y `0x10/0x11` como «alfombra»: los VALORES son los del binario y están
bien, los NOMBRES están cambiados entre sí. Cosmético, pero engaña al que lo cite.)

## 4. La cola es UNA: 0x083a

```
083a: mov ax, 0x26d6 / push / call 0xffff9680   ; print DS 0x26d6 = b'Blocked!\n'
0841: mov ax, 0xa5   / push
0845: mov ax, 0xc8   / push / call 0xffffa0f0   ; beep(0xa5, 0xc8)
084c: call 0xffff9946
084f: mov word ptr [bp - 6], 0                  ; «no se salió del mapa»
```

**El bloqueo por ACTOR y el bloqueo por TERRENO caen los dos aquí** (0x077c y 0x078f).
No hay salida muda en pueblo: andar contra un PNJ imprime y suena exactamente igual que
andar contra un muro. Es la diferencia con el exterior, donde el gate del remolino
(MAINOUT 0x0319) sí abre una salida muda — y aun así sólo por encima del umbral de
vehículo (#342).

## 5. Divergencias del port medidas contra §1-§4

### 5.1 ARREGLADA — el bloqueo por PNJ era MUDO

`Game.move` resolvía la ocupación de pueblo por una vía aparte (`npcAtTarget`) que
retornaba antes de la cola compartida: consumía el turno (bien: 1 min, TOWN 0x15D4) pero
**no emitía ni el mensaje ni el beep**. Dos observables perdidas por tener DOS colas
donde el binario tiene UNA.

Arreglo en `game/src/core/game.ts` (rama `blocker` de `move`): emite
`{message:"Blocked!"}` + `sfxEvent("move-blocked")` antes del turno, que es el mismo par
que ya emitía la cola de terreno. Guarda **roja antes**:
`game/tests/town-npc-bloqueo-mudo.test.ts` (7 casos; 4 rojos antes del arreglo, los 3
verdes son los dos controles y la no-regresión del turno).

🔴 **El daño no era sólo de fidelidad.** El arnés del careo visual clasifica «el port
bloqueó» leyendo la ÚLTIMA línea de su consola (`portFallo = /Blocked!|…/`). Con el
bloqueo por PNJ mudo, **ese predicado no podía ver justo el caso que existe para
corregir**: un paso comido en silencio desfasa la posición para siempre y el arnés no se
entera. Medido sobre el corpus del ch02 (841 compases de movimiento): **8 bloqueos
mudos**, y el PRIMERO es la primera divergencia de posición de todo el episodio.

### 5.2 FICHA ABIERTA — la lista blanca de §3 no está cableada en la vía de PUEBLO

`isBoardableActorTile` existe y está bien derivada, pero **sólo la consultan los
llamadores de EXTERIOR y NAVAL** (`world/movement.ts:392`, gateado a `map.wraps`;
`world/transport.ts:524`). En pueblo el predicado es `npcAtTarget` → `npcAt`, que
devuelve **cualquier** runtime de la lista, sin mirar el type ⇒ el port bloquea donde
0x06bf-0x06f5 deja pasar.

Población medida sobre `game/assets/npcs.json` con el filtro de `npc/manager.ts:533-539`
(slot ≠ 0, no vacío, y `npcSlotObjectKind` no lo saca a `worldObjects`): **23 slots de
`.NPC` caen en la lista blanca del binario**, de los cuales 2 (`0x1b` alfombra y `0x1e`
cadáver, los dos en la location 17) sí salen a `worldObjects` ⇒ **quedan 21 que el port
bloquea de más**: 20 de type `0x10/0x11` (locations 6, 13, 17, 18, 20, 22, 30) y 1 esquife
`0x28` (location 6, slot 10). **La location 2 (Britain) tiene CERO**, así que esta ficha
NO explica nada del careo del ch02.

⚠ Antes de cablearlo hay que resolver una colisión ya conocida: el port modela
`(type & 0xFE) == 0x10` como **guardias-actor** que caminan (`npcSlotObjectKind` no los
saca, `guardsOnFloor` los aísla para `guard_wander` TOWN 0x0C78), mientras que la lista
blanca de 0x06d7 los trata como **montura pisable**. Las dos lecturas del mismo byte no
pueden ser ciertas a la vez y la adjudicación no es de esta ficha.

### 5.3 FICHA ABIERTA — el «no response» del port no nombra al PNJ

Con `dialogNumber == 0` el binario tiene rama propia (`talk_converse_dispatch`
TALK 0x031E → 0x0357-0x0362) y el testigo del LP la muestra nombrando al personaje
(«The guard offer[s] no response!»), mientras el port emite el genérico
«Funny, no response!» del caso «no hay nadie ahí» (`main.ts:3451`). Son dos casos del
binario colapsados en uno. Medido: de 19 (T)alk del ch02, **1** cae en esta rama, y ahí
port y original **coinciden en el desenlace** y difieren sólo en el texto.
