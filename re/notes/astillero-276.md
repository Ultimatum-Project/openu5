# #276 — PASO 1 RESUELTO: cuándo entrega el original la nave comprada

Estado previo de la tarjeta: «⚠ PASO 1 MEDIDO Y NO RESUELTO — *cuándo entrega el original*
no se resuelve por las vías baratas». Queda resuelto, y por una vía que las tres anteriores
no cubrían.

## 1. La respuesta

**El original entrega la compra pendiente AL ENTRAR AL EXTERIOR, antes de correr nada del
exterior.** No en la tienda, no al cabo de N turnos, no por un evento.

La cadena, entera y verificada:

```
kernel 0x0000   main()                       ; lee argv, parsea C/H/T/E de vídeo
...
0x00b8:  mov word ptr [bp-2], 0              ; ← destino del backedge de 0x0174
0x00bd:  cmp byte ptr [g_location], 0
0x00c2:  jne 0xd1                            ; ¿no estamos en el exterior? se lo salta
0x00c4:  call 0x7a3a                         ; ★ ÚNICO call a este stub en TODO el corpus
0x00c7:  mov word ptr [bp-2], 1
```

```
kernel 0x7a3a   (thunk PLINK)
7a3a: lcall 0x72e, 0x2ec                     ; cargador de overlay
7a3f: 02 00                                  ; ★ dato en línea: overlay nº 2
7a41: ljmp 0:0x8ef2                          ; 0x8ef2 menos la base 0x81d0 da el OFFSET CS 0x0d22
```

El nº de overlay **2 es MAINOUT.OVL** (tabla de overlays: 1 TOWN · 2 MAINOUT · 3 DUNGEON ·
4 INTRO, los cuatro con el mismo segmento de carga, 0x081d, porque comparten ranura). Eso desambigua
el `ljmp`, que por sí solo no distingue entre los tres inquilinos de esa ranura.

```
MAINOUT 0x0d22
0d29: call 0                                 ; (entrada de overlay)
0d2c: cmp byte ptr [0x6605], 0x40
0d31: jb 0xd84                               ; buzón vacío ⇒ SE SALTA la entrega
0d33..0d7b:  materializa el objeto — flags = [0x6605] AND 0x3F en obj+7, (x,y) de
             [0x5953]/[0x5954], casco 0x63 = 99, tile 0x25/0x29 según el umbral 0x7F
0d7f: mov byte ptr [0x6605], 0               ; ★ vacía el buzón
0d84: call 0xa84                             ; ← la cola: el DRIVER del exterior
0d8b: ret
```

## 2. ★ La rutina NO es «spawn_purchased_ship» — eso es sólo su PRÓLOGO

El nombre del ledger describe los primeros 90 bytes. El cuerpo real de la rutina es
**`call 0xa84` + `ret`**: 0x0d22 es la **ENTRADA AL EXTERIOR**, y la entrega es lo que hace
*antes* de arrancarlo.

Esto importa porque el nombre me costó varios minutos de contradicción aparente: con
«spawn_purchased_ship» en la cabeza, el call-site del MAIN, el de 0x00c4, es absurdo — pone
`[bp-2]=1` justo después, y ese flag hace SALIR del bucle de `main` hacia `call 0x878; ret`,
o sea terminar el programa. Un «spawn de nave» que apaga el juego no tiene sentido; una
«sesión de exterior que ha vuelto» sí. **El sinsentido estaba en el nombre, no en el
binario** — familia de la regla «el sentido lo pone el PRODUCTOR».

⚠ CABO DECLARADO, no lo des por resuelto: si `0xa84` es UN turno de exterior o la SESIÓN
entera no lo he acotado. La lectura que encaja con `[bp-2]=1 ⇒ salir de main` es «sesión
entera, vuelve al salir del juego», pero eso es inferencia mía sobre el flujo de `main`, no
lectura del cuerpo de 0xa84. **Para el port da igual**: en las dos lecturas la entrega ocurre
en el mismo sitio —al entrar al exterior, antes de su primer turno— y el gate `jb 0xd84` la
hace inocua cuando el buzón está vacío.

## 3. Por qué las tres vías anteriores dieron cero (y cuál faltaba)

La tarjeta dejó medido que (a) `call 0xd22` da cero, (b) resolver near-calls de cada overlay
contra el destino impreso 0x8EF2 da cero — y no podía dar otra cosa: 0x8EF2 NO es CS del
residente (tope 0x81d0); como far-target de la línea 28, menos la base, es CS 0x0d22, la
misma resolución de arriba — y (c) el stub 0x7A3A existe pero «sus callers no aparecen».
Las tres son ciertas. Y añado una cuarta medición mía:

- (d) `near_calls_to_kernel(ovl, 0x7A3A)` sobre **los 24 overlays**: cero también.

⇒ Las cuatro son correctas *porque el llamador no está en ningún overlay*. **Está en el
kernel**, y ahí la llamada se ve tal cual: `grep 'call 0x7a3a'` sobre `ULTIMA.EXE.asm`
devuelve **una línea, la 64**. El barrido anterior buscó al llamador del stub por todas las
vías de overlay y ninguna por la vía del propio kernel, que era la barata.

**Regla que se lleva**: cuando un stub de overlay no tiene llamadores en ningún overlay, el
siguiente sitio a mirar no es un instrumento más fino — es el kernel, con un grep literal.

Y la trampa que la tarjeta ya avisaba se confirma: los 10 hits de `0x7a3a` en DNGLOOK **no
son llamadores** (con la base de DNGLOOK ese `call` resuelve a kernel 0x1CCA). Coincidencia
de número, como en #283.

## 4. Lo que esto desbloquea de #276

El PLAN de la tarjeta decía «(1) resolver el caller de 0x0d22 por tabla de punteros
(pendiente)». Ya no hace falta la tabla de punteros: el punto de enganche del port queda
fijado por lectura directa.

- **Dónde entrega el port**: en la transición a exterior, antes del primer turno de exterior
  — no en `spawnDockShip` dentro de la compra.
- **Qué se conserva**: el buzón es un BYTE (0x82 fragata+2 esquifes · 0x40 primer esquife ·
  `inc` ⇒ 0x83 segundo esquife sobre fragata pendiente), y la entrega escribe
  `flags AND 0x3F`, casco 99 y el tile por el umbral 0x7F.
- **Sigue pendiente** todo lo demás del plan (2)-(5): `state.pendingShipDelivery`, las 3
  ramas con sus textos, los tests, y el comentario de `shop-console.ts:1051`.
