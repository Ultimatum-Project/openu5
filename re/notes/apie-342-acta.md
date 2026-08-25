# La party A PIE tampoco entra en la casilla de un actor — el mismo bloque de MAINOUT

Ficha #342, cabo de #282. Sujeto: **el binario** (MAINOUT `ship_try_move` 0x01FE y su
llamador `outdoor_move` 0x0490, más el kernel `find_object_at_xy` 0x368E). Cuerpos leídos
enteros para esta ficha — **no heredados** del acta de #282, que es lo que el encargo
pedía comprobar antes de calcar.

## 1. La vía A PIE comparte el bloque — tres pruebas independientes

`ship_try_move` no es «el resolvedor naval»: es EL resolvedor de destino de todo paso al
aire libre.

1. **Censo de llamadores**: `grep -c 'call 0x1fe$' MAINOUT.OVL.asm` → **1**, en 0x0514
   (control positivo: 262 `call 0x…` en el fichero, así que el patrón sí casa).
2. **El llamador no gatea por transporte.** En `outdoor_move` (0x0490) lo único que
   discrimina antes de llamar es contabilidad de vela (0x0496-0x04b3, guardado por
   `t&0xFC==0x20`) y la animación de 0x04b8; las **cuatro** ramas de dirección
   (0x04f0/0x0542/0x055c/0x0576) convergen en 0x050e, que empuja las dos coordenadas, y
   0x0514 llama incondicionalmente.
3. **Dentro hay dos ramas que sólo tienen sentido A PIE**, y estarían muertas si la vía a
   pie no entrase: el régimen de abordaje `t < 0x20` (0x0245 `cmp 0x30 / jae 0x253`,
   0x024c `cmp 0x20 / jae 0x270`, caída a 0x0253) y el discriminante de la cola de
   bloqueo 0x0312 `cmp byte ptr [g_transport_tile],0x20 / jb 0x322`.

## 2. El ACTOR manda sobre el TERRENO (0x0236-0x0283), y las dos condiciones se COMPONEN

```
0215: c746fe0100   mov word ptr [bp-2], 1      ; DEFAULT: «se mueve»
0236: e885b2       call 0xffffb4be              ; find_object_at_xy(x,y,floor)
0239: 8946fc       mov word ptr [bp-4], ax      ; TILE del actor (0 = no hay)
023e: 7448         je 0x288                     ; centinela 0 → directo al terreno
0240: c746fe0000   mov word ptr [bp-2], 0       ; HAY actor: el paso falla POR DEFECTO
0245..0283        (ventana de ABORDAJE; 0x0283 devuelve [bp-2]=1)
0288: 8a80a7ab     mov al, byte ptr [bx+si-0x5459] ; TERRENO → [bp-6]  (SIEMPRE se lee)
029b: 837efe00     cmp word ptr [bp-2], 0
029f: 7413         je 0x2b4                     ; con actor no abordable, el test de
02a8: e8d1a7       call 0xffffaa7c              ;   passability NI SE LLAMA
```

Dos consecuencias que el calco tiene que respetar y que es fácil equivocar:

- **Actor no abordable ⇒ bloqueo sea cual sea el terreno** (el `je` de 0x029f salta por
  delante del `call` de 0x02a8).
- **Actor abordable NO salta el test de terreno**: 0x0283 sólo restaura `[bp-2]=1` y el
  flujo cae igualmente en 0x02a1-0x02a8. Se avanza sólo si se cumplen **LAS DOS**
  (actor abordable-o-ausente **Y** terreno pisable).

La ventana de abordaje por modo (`t = g_transport_tile`) es la ya transcrita en
`remolino-282-acta.md` §2, re-leída y confirmada aquí. Para la rama de pie
(`t ≥ 0x30` **o** `t < 0x20`): `0x24 ≤ a < 0x2c` · `a == 0x1b` · `(a & 0xFE) == 0x10`.
**0x2c queda fuera por un byte** (0x0259 `cmp 0x2c / jl 0x283`) = la nave pirata.

## 3. A PIE **no hay salida muda**

La salida silenciosa del remolino (0x0319-0x0320, que salta al epílogo por delante del
print de «Blocked!» y del beep) vive **detrás** del umbral de vehículo de 0x0312
(`jb 0x322`). Con `t < 0x20` el flujo entra por 0x0322 y **imprime**. O sea: empujar a
pie contra un remolino da «Blocked!» + beep como contra una pared, y el silencio es
exclusivo de los vehículos. Calcar aquí una rama muda sería divergencia por exceso.

## 4. Qué se midió del PORT y qué se cambió

- `resolveStep` (world/movement.ts) resolvía el paso **sólo por terreno**. La ocupación
  del exterior no se consultaba en ningún punto de la vía a pie: `npcAtTarget`
  (game.ts) —la única consulta de ocupación que había— **retorna `null` cuando
  `position.location === 0`**, es decir justo en el sobremundo. Consecuencia jugable: la
  party a pie atravesaba la casilla de cualquier actor del exterior.
- Fix: `actorTile` como 4º parámetro de `resolveStep` + `blockedByActor` calculado
  **delante** del atajo de `isPassable`, con la MISMA primitiva del calco naval
  (`isBoardableActorTile`, aterrizada en #282). El llamador resuelve el tile con
  `Game.overworldActorTileAt(x,y)`, helper nuevo que ahora usan **las dos** vías (la
  naval pasó a consumirlo, sustituyendo su búsqueda inline).

## 5. Alcance — lo que este fix NO hace

- **Sólo EXTERIOR** (`map.wraps`). La cola gemela de pueblo es `town_move` TOWN.OVL
  0x0600 (bloqueo en TOWN 0x083a-0x084c: print DS 0x26d6 + beep, sin el `cmp …,0x2f` del
  cactus ni la salida 0xEC), y la ocupación de pueblo ya la resuelve `npcAtTarget`. El
  gate vive en el PRODUCTOR, no en el llamador — lección de #224.
- **Población parcial, y declarada**: `find_object_at_xy` barre los slots 1..31 de UNA
  tabla (DS:0x5C62-0x5D5A). El port tiene DOS estructuras donde el binario tiene una
  (#103): `overworldEnemies` y `state.worldObjects`. Este calco consulta la primera —
  exactamente la misma cobertura que el calco naval de #282, ni más ni menos. Los objetos
  aparcados (fragata/caballo/alfombra amarrados, botín en el suelo) quedan fuera mientras
  #103 siga abierta. **No se ensanchó a propósito**: hacerlo sin derivar qué byte+0
  guarda cada clase de objeto metería bloqueos inventados (el botín del suelo también
  vive en esa tabla).
- No toca el turno del remolino (ya portado, #282 §4) ni el combate.

## 6. Stream

El fix **no añade ni quita tiradas de RNG** en el propio intento de paso: el camino que
cambia es `[bp-2]` (avanza / no avanza) y las salidas que toca (0x0322 print + 0x033c
beep) no consumen el stream.

Pero **cambia si la party avanza o no**, y el sorteo de aparición del sobremundo depende
de la POSICIÓN (#31: `pick_spawn_coords` mide distancia al grupo y **reintenta sin tope**,
2 tiradas por intento). Una party que deja de atravesar actores queda en otra casilla
⇒ el sorteo puede consumir un número distinto de tiradas a partir de ahí.

⇒ **MUEVE STREAM por vía indirecta.** Se entrega con ventana de sellos declarada, igual
que #282 (misma causa, misma cadena: posición → #31).

### 6-bis. Censo de veredictos que CADUCAN (patrón de #353 §6)

El discriminante acota la clase: como el fix **no añade ni quita tiradas**, un escenario
sólo diverge si en algún paso la party A PIE, en el SOBREMUNDO, **empuja contra una
casilla ocupada por un actor no abordable de `overworldEnemies`**. Todo veredicto cuyo
escenario nunca pisa ese caso produce el MISMO stream que antes, byte a byte.

Consumidores del stream del sobremundo en el árbol, censados (grep `overworldEnemies|
seed|rng` sobre `game/tests/` + lectura de los que caminan):

- `overworld-reseed-o1.test.ts` — **no da ningún paso** (`grep 'move('` = 0): fuera de la
  clase.
- `walkthrough-saves.test.ts` — sin `move()` a pie en location 0: fuera de la clase.
- `live-stream.test.ts` — SÍ camina (20/40 pasos a pie desde (100,100)), pero sus asertos
  son de DETERMINISMO (dos corridas con la misma semilla se comparan entre sí: el fix
  afecta a las dos por igual) y delega la secuencia byte-exacta en el arnés de paridad
  (`loops-run.ts` ↔ `loops_parity.py`), que corre en la batería.
- El resto de la población (arnés de paridad incluido) la adjudica la **batería completa
  sobre el SHA de esta entrega**: si sale verde, ningún test del árbol aserta una
  secuencia RNG que atraviese el caso afectado — misma vara que la adjudicación de
  #353 §6 (allí 35 ficheros / 339 tests del gate de combate).

Veredictos EXTERNOS al árbol (sellos de corridas, digests de capítulos): los que se
midieron ANTES de esta entrega sobre una caminata a pie que atravesaba actores del
exterior caducan — pero esa caminata era el BUG (atravesar), así que cualquier corrida
grabada que dependiera de ella documentaba conducta no-fiel y estaba ya condenada a
re-grabarse. La ventana se declara en el sujeto del merge, igual que en #282 y #340.
