# #205 — cabo (1) CERRADO: la salida silenciosa de MAINOUT 0x031e es el REMOLINO, y bloquea MUDO

De los cuatro cabos de la ficha, éste queda derivado entero. Los otros tres siguen abiertos.

## 1. Qué devuelve `0xffffb4be`

Con la base de MAINOUT (0x81d0), el destino resuelve a **ULTIMA.EXE 0x368E =
`find_object_at_xy`**. No hace falta inferir qué devuelve: el propio ledger lo tiene fichado
por otro camino —la nota de `look2_print_obj_desc` dice que `cmd_look` pasa a su callee «el
retorno de `find_object_at_xy` … o sea un ÍNDICE DE OBJETO, no de tile»—. En
`ship_try_move` ese retorno es justo lo que se guarda en `[bp-4]`, el operando de la salida
silenciosa.

⇒ Los dos medios cabos de la ficha eran **el mismo**: el valor del `cmp` de 0x031e es el tipo
de objeto que devolvió esa llamada.

## 2. La salida silenciosa, leída

```
0312: cmp byte ptr [g_transport_tile], 0x20
0317: jb 0x322              ; a pie o montado (< 0x20) ⇒ cola NORMAL
0319: mov al, byte ptr [bp - 4]   ; tipo de objeto
031c: and al, 0xfc               ; ⇒ CLASE
031e: cmp al, 0xec
0320: je 0x34a                   ; ★ salta al EPÍLOGO
0322: … «Blocked!» … cactus/«OUCH!» … beep(0xa5,0xc8) …
034a: mov ax, word ptr [bp - 2]  ; devuelve el FLAG
0351: ret 4
```

⇒ **Yendo EMBARCADO (transporte ≥ 0x20), si la clase del objeto de la casilla es 0xEC, la
rutina sale por el epílogo sin imprimir NADA y sin sonar NADA** — y devolviendo el flag de
bloqueo tal cual, o sea **bloquea, pero mudo**. Con `and 0xfc` el discriminante es la CLASE
0xEC completa (0xEC-0xEF), no el byte exacto.

La clase 0xEC es el **remolino** (fichado así en la evidencia de `overworld_actor_contact`,
que en su rama 0xEC imprime «WHIRLPOOL!» y traga la nave hasta el Underworld). Tiene sentido:
el choque no se anuncia porque el remolino no es un obstáculo, es un **evento** que resuelve
otra rutina; anunciar «Blocked!» y pitar sería anunciar dos veces cosas distintas.

## 3. Por qué `shipTryMove` del port no puede expresarlo (confirmado)

Lo que #178 apuntó se sostiene: la firma del port devuelve un `outcome` con `messages`, y aquí
hace falta la combinación **bloqueado + cero mensajes + cero sfx**, que no es ninguno de sus
casos actuales (`blocked` emite «Blocked!» y el beep de #224). No es un mensaje que falte: es
un **caso de salida** que falta.

★ Y engancha con #223: los dos usan `[bp-4]`, el tipo devuelto por `find_object_at_xy`. Vale
para los dos el mismo aviso: **el port hoy sólo sabe si HAY objeto, no de qué clase es**, así
que ninguno de los dos se puede cablear hasta que exista el buscador por tipo y esté careada
la correspondencia de códigos.

## 4. Los otros tres cabos, sin tocar

- (2) el CUARTO argumento del spawn de `ULTIMA.EXE 0x6b85` (`mov ax,1` sin desglosar).
- (3) `[bp-4]` de `CMDS.OVL 0x1ac6`.
- (4) el flag de `FONT.OVL 0x03aa` (`[bp+4]`) — adjudicado el offset como discriminador, NO la
  etiqueta «noche» del brazo.

---

## 5. Cabo (3) CERRADO: `[bp-4]` de CMDS 0x1ac6 es el flag de REINTENTO del prompt de cantidad

La rutina es **CMDS.OVL 0x1a70** (`ret 2`, un solo argumento). Leída entera:

```
1a78: mov word ptr [bp-4], 1        ; ★ flag «alcanzable», arranca en 1   ← DESTINO del je
1a7d: push 0x8f72 / call            ; imprime el prompt
1a84: push 2 / call 0x7c1e          ; pide un NÚMERO
1a8b: mov [bp-2], ax                ; la cantidad pedida
1a8e: or ax,ax / je 0x1ac6          ; cantidad 0 ⇒ al final, con el flag intacto
1a92: mov di, 0x80 / sub si, si     ; máscara de bit y contador de reactivo
1a97: test word ptr [bp+4], di      ; ¿reactivo si SELECCIONADO?
1a9c: mov al, byte ptr [si+0x5850]  ; cantidad POSEÍDA de ese reactivo
1aa2: cmp ax, [bp-2] / jae          ; ¿poseída ≥ pedida? sí ⇒ siguiente
1aa7: push 0x8f7e / call            ; NO ⇒ imprime el aviso
1aae: mov word ptr [bp-4], 0        ; ★ flag a 0
1abc: sar di,1 / inc si / cmp si,8  ; ocho reactivos
1ac6: cmp word ptr [bp-4], 0
1aca: je 0x1a78                     ; ★ flag 0 ⇒ VUELVE AL PROMPT
1acc: mov ax, [bp-2] / ret 2        ; devuelve la CANTIDAD aceptada
```

⇒ **`[bp-4]` es el flag «la cantidad pedida es alcanzable con lo que llevas encima»**, y su
único consumidor lo usa para **reiniciar la rutina**: el original no acepta la cifra hasta que
todos los reactivos seleccionados tengan al menos esa cantidad. Es un **bucle de reintento**,
no una salida de error. El argumento `[bp+4]` es la máscara de selección de reactivos, con el
bit 0x80 = reactivo 0 (la máscara baja con `sar`), y `0x5850` es la base del array de
cantidades poseídas.

Encaja con el racimo de Mix ya trabajado (#106 el picker, #200 el relleno de la cuenta).

## 6. Cabo (2), PARCIAL: el `mov ax,1` de 0x6b85 NO es un argumento muerto

Lo primero: **0x6b85 no es la cabeza de una rutina**, es un CALL-SITE. Empuja cinco valores
—1, 2, 5, 5 y `g_floor`— y llama a **0x6506**, que cierra con `ret 0xa` = cinco argumentos, lo
que cuadra. Con eso el mapeo es directo: `[bp+4]`=floor · `[bp+6]`=5 · `[bp+8]`=5 ·
`[bp+0xa]`=2 · **`[bp+0xc]`=1**, que es el `mov ax,1` que la ficha señalaba.

Y lo que devuelve se usa como ÍNDICE DE RANURA: `shl bx,3` (stride 8) y escritura en
`[bx+0x5c5f]` —el campo +5 del registro— con el valor `3*floor + 7`.

★ **Sospecha levantada y REFUTADA por la propia lectura**: al entrar, 0x6506 hace
`cmp word ptr [bp+0xa], 2` y, si son iguales, salta a 0x6625 **antes** de que `[bp+0xc]` se lea
por primera vez (su primera lectura del tronco está en 0x653f). Como este llamador pasa
justo un 2, parecía un argumento muerto de la familia «argumento muerto por discrepancia de
llamadores». **No lo es**: la rama 0x6625 lee `[bp+0xc]` en TRES sitios (0x663e, 0x66ae,
0x66f5), junto a `[bp+8]`, `[bp+6]` y `[bp+4]` (0x66be/0x66c6/0x66ce, con pinta de escritura de
campos del registro).

⇒ Queda **medido el marco** (cinco argumentos, mapeo exacto, rama tomada, y el argumento
vivo); queda **sin adjudicar el SIGNIFICADO** del 1, que exige leer esos tres sitios. Seña
puesta para quien lo retome: 0x663e · 0x66ae · 0x66f5.

## 7. Cabo (4) CERRADO: el flag de FONT 0x03aa gatea un RETARDO, no la noche

```
03aa: cmp word ptr [bp + 4], 0
03ae: je 0x3b7                  ; flag 0 ⇒ se lo salta
03b0: mov ax, 1 / push
03b4: call …                    ; → kernel 0x20FA delay_ticks_int1c
03b7: (sigue el cuerpo)
```

Resuelto con el instrumento, no a mano: la base de FONT es 0xE1E0 y
`near_calls_to_kernel('FONT.OVL', 0x20FA)` devuelve **exactamente `['0x3b4']`** — un único
call-site en todo el overlay, el de este brazo.

⇒ **`[bp+4]` es un flag de PACING**: cuando vale distinto de cero, la rutina mete un tick de
retardo antes de seguir. No tiene nada que ver con la hora ni con la noche.

La ficha ya avisaba de que la etiqueta «noche» del brazo estaba sin adjudicar; queda
**refutada**, y con la misma rutina que hoy ha aparecido otras dos veces —el bucle del sueño
de #249 y el bucle de espera de la profanidad de #202—. Tercera vez en un día que
`delay_ticks_int1c` estaba etiquetado como otra cosa: **un retardo es lo que más se confunde
con mecánica**, porque aparece justo donde el jugador percibe que «pasa algo».

⇒ **#205 queda cerrada al 4/4** salvo el significado del inmediato 1 del cabo (2), que sigue
apuntado con sus tres direcciones.

## 8. Censo de `delay_ticks_int1c`, y un grep que NO discrimina

Con tres etiquetas falsas en un día, la pregunta obvia es cuántas más hay. Primer paso, la
población, medida con `near_calls_to_kernel` sobre los 24 overlays:

| overlay | sitios | | overlay | sitios |
|---|---|---|---|---|
| BLCKTHRN | 10 | | CMDS | 3 |
| INTRO | 6 | | DUNGEON · TALK | 2 · 2 |
| CAST2 · FONT | 1 · 1 | | ULTIMA.EXE (kernel) | 3 |

**28 call-sites en total** (25 en overlays + 3 en el kernel). Los tres que hoy tenían etiqueta
falsa son CMDS 0x638 (#249), TALK 0x0af0 (#202) y FONT 0x03b4 (#205) ⇒ **3 de 28 leídos, los
tres mal**. Eso NO es una tasa: es la muestra que ha caído, y está sesgada porque los tres
llegaron por fichas que ya sospechaban algo.

⚠ **Y el segundo paso lo intenté mal.** Para ver cuáles de los 25 restantes aparecen
etiquetados en las notas, hice un grep del offset pelado. Devolvió **los mismos tres o cuatro
ficheros para TODOS los offsets consultados** — que es la firma del ruido por subcadena
(un offset corto entra dentro de otro más largo) y de los ficheros-índice grandes. Un resultado UNIFORME no
es un hallazgo; aquí no discrimina nada y no se puede usar.

Lo que haría falta es cruce por **co-ocurrencia overlay+offset** en la misma cita, no la
dirección suelta. Queda apuntado como tarjeta propia, con la población ya medida.

## 9. #288, primer pase: el cruce por co-ocurrencia SÍ discrimina — y su control positivo lo suspende en 1 de 4

Rehecho el cruce como pedía §8: **co-ocurrencia en la MISMA LÍNEA** del nombre del overlay y
el offset, con frontera hexadecimal para que un offset corto no entre dentro de otro más
largo. Resultado sobre los 22 call-sites consultados: **CERO menciones**.

A diferencia del grep pelado, **este resultado sí discrimina** — no devuelve lo mismo para
todo. Pero antes de escribir «nadie las ha nombrado», el control:

| control | esperado | obtenido |
|---|---|---|
| CMDS 0x638 (#249) | documentado hoy | ✅ 1 |
| FONT 0x3b4 (#205) | documentado hoy | ✅ 1 |
| MAINOUT 0x031e (#205) | documentado hoy | ✅ 5 |
| **TALK 0x0af0 (#202)** | **documentado hoy** | ❌ **0** |

★ **El control lo suspende en uno de cuatro, y sé exactamente por qué**: en el acta de #202
escribí ese sitio como un **RANGO** —«TALK 0x0a88-0x0af9»— y la dirección concreta del `call`
no aparece nunca literal. **Las citas por rango son invisibles a este instrumento.**

⇒ El «0 de 22» es una **COTA, no un cero**: cualquiera de los 22 puede estar documentado
dentro de un rango que el cruce no ve. Con una tasa de fallo medida de **1 de 4** en el
control, la cifra no sostiene la conclusión «nadie los ha nombrado».

Lo que hace falta para cerrarlo: que el cruce entienda rangos `0xAAAA-0xBBBB` y compruebe
pertenencia, no igualdad. Apuntado en #288.

## 10. #288 con PERTENENCIA a rango: el control pasa 4/4 y el cero era FALSO — son 3 de 22

Cableada la pertenencia que pedía §9: además de la mención exacta, la línea vale si cita un
**rango** (`0xAAAA` a `0xBBBB`, con tope de 0x400 de ancho para no tragar rangos absurdos) y el
call-site cae dentro.

**Control positivo, ahora 4 de 4** — y el que fallaba entra justo por donde se dijo:

| control | vía |
|---|---|
| CMDS 0x638 | exacta |
| FONT 0x3b4 | exacta |
| MAINOUT 0x031e | exacta **y** RANGO 0x0312-0x0347 |
| **TALK 0x0af0** | **RANGO 0x0a60-0x0b7c** ✅ (antes daba cero) |

**Y el resultado cambia: 3 de 22, no 0 de 22 — y los TRES entran SÓLO por rango**, o sea que
son exactamente la clase que la versión anterior no veía. El «0» de §9 era un cero falso, tal
como el control anticipaba.

Los tres candidatos, con su documento:

- **INTRO 0x0ba2** → `intro-attract-loop.md` (RANGO 0x0aa1-0x0c97)
- **CMDS 0x1b93** → `rand-218-acta.md` (RANGO 0x1ad8-0x1c20) y `liston-207-t2-acta.md`
  (RANGO 0x1b60-0x1c1f)
- **TALK 0x0faa** → `liston-c-207-t2-acta.md` (RANGO 0x0f48-0x10cd)

⚠ Que estén MENCIONADOS no es que estén MAL etiquetados: falta leer los tres y ver si la prosa
del documento atribuye a ese tramo algo que un retardo no puede hacer. Ése es el paso que
queda, y son tres lecturas, no veintidós.

★ Nota sobre el método: hicieron falta TRES versiones del instrumento —grep pelado (no
discrimina), co-ocurrencia exacta (falso negativo en rango), co-ocurrencia con pertenencia
(pasa el control)— y a las dos primeras las tumbó el mismo minuto de comprobación. La
diferencia entre publicar «nadie los ha nombrado» y «son tres, aquí están» fue enteramente el
control positivo.

## 11. Leídos los tres — y uno era FALSO POSITIVO MÍO (cuarto defecto del instrumento)

- **TALK 0x0faa → FALSO POSITIVO.** La línea que casó cita DOS overlays: `TALK.OVL:0x1180` y
  `TOWN.OVL:0x0f48-0x10cd`. Mi comprobación exigía el nombre del overlay **en la línea** y
  luego miraba la pertenencia contra CUALQUIER tramo de esa línea — así que ató un offset de
  TALK a un tramo de TOWN. **Co-ocurrir en la línea no es emparejar**: el tramo hay que
  ligarlo al overlay que lo precede, no a cualquiera que aparezca cerca. Cuarto defecto de
  esta misma pregunta, y de la familia de la regla «emparejar por LÍNEA no es emparejar».
- **INTRO 0x0ba2 → mención sin etiqueta.** El documento es una tabla por offset del bucle de
  attract y **0x0ba2 no figura en ella**: cae dentro del tramo del título pero nadie lo nombró.
  No hay etiqueta que corregir; es hueco de cobertura.
- **CMDS 0x1b93 → el único candidato VIVO.** Cae en `CMDS.OVL:0x1b60-0x1c1f`, que un acta
  declara «la cola de Mix, **leída entera**» y mapea a `askMixQuantity`; otra lo mete en el
  tramo del handler de Mix del defecto «0 rand». Que un tramo declarado leído entero contenga
  un retardo sin mencionar es justo lo que hay que comprobar — y encaja con lo derivado hoy en
  el cabo (3), que es el prompt de cantidad de ese mismo flujo.

⇒ **De los 3, uno es mío, uno es cobertura y UNO queda por leer.** La cifra publicable es
«1 candidato vivo», no 3.

★ Cuarta versión del instrumento pedida por su propio resultado: ligar el tramo al overlay que
lo precede. Cuenta corrida de esta pregunta: **cuatro defectos, cuatro cazados antes de
publicar la conclusión** — y ninguno se veía desde la lista de resultados.

## 12. #288 CERRADA: el candidato vivo ERA un hueco real — pausa de 10 ticks tras «Mixing...», GATEADA por localización

Leído el tramo, y el acta que lo declaraba «leída entera» **salta justo por encima**: su tabla
por offset va de `CMDS.OVL:0x1b81` a `CMDS.OVL:0x1b9f` sin nombrar lo que hay en medio.

```
1b81: mov ax, 0x8ff0 / push / call   ; imprime «Mixing...»
1b88: cmp byte ptr [g_location], 0x20
1b8d: jbe 0x1b98                     ; ★ localización ≤ 0x20 ⇒ SE SALTA lo de abajo
1b8f: mov ax, 0xa / push
1b93: call …                         ; delay_ticks_int1c(10)  = DIEZ ticks
1b96: jmp 0x1b9f
```

**Dos cosas, ninguna documentada:**

1. Tras imprimir «Mixing...», el original **hace una pausa de diez ticks** antes de seguir. Es
   un compás dramático, no un adorno del emulador.
2. Y la pausa **está gateada por la localización**: sólo ocurre con `g_location > 0x20`. En
   pueblo o ciudad normal el `jbe` se la salta y el mensaje encadena directo con el resultado.

⇒ El «leída entera» del acta no lo era: el hueco contenía un gate Y un efecto. Y con esto la
cadena de la ficha cierra sobre sí misma — el cabo (3) de #205 derivó el **prompt de cantidad**
de este mismo flujo de Mix, y el retardo que faltaba está a unas pocas instrucciones.

★ **Resultado final de #288**: de 28 call-sites, 25 sin adjudicar al empezar; el cruce dejó 1
candidato vivo tras descartar 2 (uno mío, uno de cobertura); y ese 1 **era hueco real**. La
pregunta se cierra con hallazgo, después de cuatro instrumentos y cuatro correcciones.

⚠ CABO para el port: comprobar si el clon mete ese compás y con ese gate. No lo he tocado —
cambia el flujo de eventos de Mix y entra en la lista de re-sello de #222.
