# Las partidas de «Ver una partida» (#158 · #222) — cifras con su régimen

Aquí viven las CIFRAS; el pie de cada vídeo lleva sólo la frase (decisión del lead,
11-08). El reparto no es estético: un «546 de 721 fotogramas difieren» puesto al pie,
sin su régimen al lado, se lee como defecto del port. Aquí se lee como lo que es.

**Frase única del pie de los vídeos:**
> Repetición exacta, comprobada paso a paso; sólo las animaciones pueden ir
> desacompasadas.

(Reescrita en la auditoría de contenidos de 08-2026, encargo del usuario: «verificado con
huellas de estado» y «variar en fase» eran jerga para el jugador. El GRADO no cambia:
«comprobada paso a paso» es literalmente el instrumento — la huella `liveSeed|JSON(state)`
se toma POR PASO, ver «Qué mide cada columna» abajo — y la reserva de la animación se
conserva.)

🔴 **EL RÓTULO DE ARRIBA YA NO LLEVA CARDINAL, y es un arreglo con causa (13-08).** Decía
«de los tres vídeos» y `partidas-build.mjs` lo buscaba LITERALMENTE, así que al pasar la
galería a seis quedaban dos salidas y ninguna buena: corregir este fichero ponía el build
ROJO, y no corregirlo cementaba un «tres» falso dentro del documento que la página cita
como su fuente. Una guarda que exige la frase literal convierte el número rancio en la
única opción que compila. El patrón ya acepta cualquier cosa entre «Frase única del pie»
y los dos puntos; lo que sigue exigiendo es el rótulo y su cita de bloque detrás.

## Qué mide cada columna, y por qué son DOS instrumentos y no uno
- **Huellas de estado** — `liveSeed|JSON(state)` por paso, el predicado de
  `game/e2e/replay-roundtrip.spec.ts`. Es la que DECIDE: si difiere, la partida no se
  reproduce y `partida-render.mjs --carear` falla con exit 1.
- **Hashes de fotograma** — sha256 del PNG capturado. Sólo INFORMA. La fase del reloj
  de animación es de RENDER, no de estado, así que dos corridas pueden pintar la
  antorcha en otro punto de su ciclo sin que la partida difiera en nada.
  🔴 Un hash de fotograma distinto NO distingue «la partida diverge» de «la antorcha
  parpadea en otra fase»: firmar el determinismo del JUEGO con este instrumento sería
  medir la presentación y hablar del motor.

## 🔴 LA UNIDAD, ANTES QUE NINGUNA CIFRA: vídeos ≠ tarjetas

La tanda de #222 (13-08) produjo **CINCO vídeos** y la galería creció **+3 tarjetas**. Las
dos frases son verdaderas y describen cosas distintas; confundirlas produjo dos cifras
equivocadas antes de que nadie contara una por una:

| magnitud | valor | qué cuenta |
|---|---:|---|
| vídeos producidos en la tanda 1 (13-08) | 5 | astaroth, nosfentor, corona, compania, underworld |
| tarjetas NUEVAS de la tanda 1 | 3 | astaroth, nosfentor, corona |
| re-renders (reemplazan fichero, NO añaden tarjeta) | 2 | compania, underworld |
| tarjetas que ya existían | 3 | compania, faulinei, underworld |
| tarjetas tras la tanda 1 | 6 | las 3 viejas + las 3 nuevas |
| vídeos producidos en la tanda 2 (14-08) | 1 | regreso |
| **tarjetas en la galería** | **7** | las 6 anteriores + regreso |

Las dos cifras equivocadas que circularon, con su error nombrado: **«8»** = sumar los
cinco vídeos a las tres tarjetas viejas (cuenta dos veces los re-renders); **«5»** =
llamar tarjetas a los vídeos. **Un re-render no es un alta**, y por eso la galería crece
+3 aunque se hayan grabado cinco.

El número que manda es el que el generador ENUMERA del directorio `game/partidas/`, no el
que nadie recuerde: seis `.json`, y su suelo está escrito en `partidas-build.mjs` con
fecha y razón.

## Las SIETE (superficie compuesta 1280×800 · 12 fps · webm VP9 · mp4 h264 High yuv420p)

Régimen de la medición: `ffprobe -count_frames` sobre los ficheros del 13-08 —
`.partidas-staging/` para los cinco de la tanda #222, `original/av-referencia/web-openu5/`
para `faulinei`, que ya está servido y se re-renderizó el 12-08 (#207). La fila de
`regreso` es del 14-08 (tanda 2) y se midió con el mismo `ffprobe` sobre su
`.partidas-staging/`, antes de promoverla.

| partida | momento | huellas de estado | fotogramas | alargados | duración | webm B | webm B/s | mp4 B |
|---|---|---|---:|---:|---:|---:|---:|---:|
| astaroth | 04 · Astaroth y la Llama del Amor | 121 de 121 IDÉNTICAS | 749 | 1 × 34 | 62,4 s | 516.898 | 8.281 | 570.339 |
| compania | 02 · La compañía al completo | 121 de 121 IDÉNTICAS | 721 | 0 | 60,1 s | 1.509.441 | 25.123 | 1.987.412 |
| corona | 07 · La Corona de Lord British | 121 de 121 IDÉNTICAS | 721 | 0 | 60,1 s | 717.444 | 11.941 | 1.054.718 |
| faulinei | 03 · Ante Faulinei | 121 de 121 IDÉNTICAS | 749 | 1 × 34 | 62,4 s | 813.696 | 13.037 | 1.053.510 |
| nosfentor | 05 · Nosfentor ante su Llama | 121 de 121 IDÉNTICAS | 749 | 1 × 34 | 62,4 s | 819.225 | 13.125 | 863.427 |
| regreso | 01 · El regreso a Britannia | 121 de 121 IDÉNTICAS | 721 | 0 | 60,1 s | 984.985 | 16.394 | 1.789.409 |
| underworld | 08 · La boca del Underworld | 121 de 121 IDÉNTICAS | 721 | 0 | 60,1 s | 927.787 | 15.442 | 1.151.417 |

Total servido: **6.289.476 B de webm + 8.470.232 B de mp4 = 14.759.708 B (14,1 MiB)** —
sumado sobre los ficheros de `original/av-referencia/web-openu5/`, no sobre esta tabla.

🔴 `regreso` es la fila con el mp4 MÁS PESADO de las siete (1.789.409 B) SIN ser la del webm
más pesado (ésa sigue siendo `compania`, 1.509.441 B). Es un dato medido y **su causa está
SIN SONDEAR**: lo cómodo sería decir «es follaje, mucho detalle», pero nadie ha medido la
entropía de estos fotogramas ni comparado los dos codecs sobre la misma entrada. Se deja
escrito como lo que es —una fila que rompe el orden de la otra columna— y no como una
explicación, para que quien la necesite la mida en vez de heredarla.

🔴 **LA COLUMNA «fotogramas que difieren» SE HA RETIRADO, no se ha perdido.** La versión
anterior de esta tabla la traía para las tres primeras (67, 127 y 546 de 721). Hoy no
está por dos razones y ninguna es que estorbe: (a) `compania` y `underworld` se
RE-RENDERIZARON el 13-08 y `faulinei` el 12-08, así que aquellas tres cifras describen
ficheros que ya no existen; (b) las tres nuevas nunca se midieron — el careo del carril
anterior fue de HUELLAS DE ESTADO, que es el instrumento que decide, y el de píxel no se
corrió. Publicar las viejas al lado de las nuevas habría mezclado dos poblaciones en la
misma columna. Vuelve cuando alguien re-corra `--carear` sobre los seis de hoy.

## Por qué 62,4 s y no 60,1 s: es UN PASO ALARGADO, no «pesan más»
Los siete vídeos tienen la MISMA longitud de guión: 120 pasos. El grabador captura
`SUBFOTOGRAMAS_MIN = 6` por paso (`game/tools/avance-fx.mjs:54`) más un fotograma inicial
antes del bucle, o sea **1 + 120 × 6 = 721 fotogramas = 60,083 s** cuando ningún paso se
alarga. Los tres que dan 749 llevan **un** paso estirado a 34 subfotogramas porque el
grabador espera a que muera la animación viva (#207): `721 + (34 − 6) = 749`, y
`28 / 12 fps = 2,333 s`, que es exactamente la diferencia. La duración es del RITMO del
grabador; no dice nada del peso.

🔴 Y el peso lo desmiente solo: **`astaroth` es a la vez el más LARGO (62,4 s) y el más
LIGERO (516.898 B)**. Quien lea «dura más» como «pesa más» tiene el contraejemplo en su
propia fila.

## Los alargados, adjudicados por CAUSA y con dos instrumentos que coinciden
La línea que emite `partida-render.mjs:326` dio `1 de 120 · máximo 34` para los rituales y
`0` para los demás. Un cero de alargados es SOSPECHA de junta muerta (#207), no un
resultado, así que los ceros se adjudicaron leyendo qué emite cada camino —`useSkullKey`
y ponerse la Corona emiten sólo `message`; el único `transient` de la piel es la puerta
lunar (`skin/fiel/skin.ts:3069`) y ningún guión cruza una; `combatFx` necesita un ataque y
estos guiones sólo teclean flechas—. **El control que separa esto de un instrumento roto:
los rituales SÍ dan 1 × 34 con el mismo grabador y en la misma tanda.**

Y el recuento de fotogramas lo CONFIRMA por segunda vía, independiente del emisor: 721 y
749 son exactamente los dos valores que la fórmula predice para 0 y 1 alargados. La
aritmética sola no bastaría (un +28 también lo darían dos pasos de 20), pero emisor y
recuento coinciden en el mismo par.

🔴 **Son TRES los alargados, no dos.** El encargo de esta tanda decía «astaroth/nosfentor
1 × 34; los otros 0», y es cierto DENTRO de la tanda — pero `faulinei` ya está en la
galería y sus 749 fotogramas dicen que también lleva el suyo. Los tres son el mismo gesto
(el ritual del fragmento) y los tres cero son escenas sin ninguno de los seis efectos.

## Los pósters: qué fotograma es cada uno, y por qué el criterio es frágil
`partida-posters.sh` fija `SEGUNDO=20`. A 12 fps eso es **el fotograma n = 240**
(0-based) — comprobado extrayendo `-ss 20` y careándolo contra los índices 238…242: sólo
el 240 da el mismo sha256, y los vecinos difieren, así que el control discrimina. Vale
para las siete: todas son de 12 fps.

Los cinco de la tanda 1 se han MIRADO uno a uno en ese fotograma y valen: los tres rituales
con el desenlace ya escrito en la banda de texto, `corona` con «Thou dost don the Crown of
Lord British…», `compania` en plena travesía por el bosque, `underworld` en el turno de
combate con la emboscada en cuadro. El de `regreso` (tanda 2) también se ha MIRADO: el
grupo dentro del campo de trigo de Iolo, con las rejas del cercado y el bosque alrededor.

🔴 Y ese póster es **la medida del arreglo de la tanda 2**, porque es exactamente el que
salía casi negro: el guion del 13-08 tenía a la party dentro del bosque en el segundo 20,
que es donde la ventana se queda en 9 celdas encendidas de 121. Ver §los-que-no-se-publican
para la causa completa.

🔴 **La fragilidad, declarada: el segundo 20 es un instante FIJO sobre un guión que puede
moverse.** Nadie ha comprobado que el paso 40 sea el interesante — se comprobó que el
fotograma resultante lo es, que es otra cosa. Cualquier re-render que cambie el ritmo
(un alargado nuevo antes del segundo 20 empuja todo lo posterior) mueve lo que n = 240
enseña, sin que falle nada: el póster sale, es válido, y es de otra escena.

🔴 Y el caso `astaroth` merece su línea porque **el póster cae DENTRO del temblor del
ritual, y eso fue suerte, no diseño.** Medido con `tblend=difference,signalstats` sobre el
vídeo: el paso alargado ocupa n = 217…250 y la pantalla tiembla de n = 217 a n = 248 (32
fotogramas de los 34 del paso). El póster, n = 240, está dentro — la vista va desplazada
~1 tile respecto al reposo (careado contra n = 255). No se ve mal: la escena está entera y
encima conserva el «Hatred…» que a los 255 ya se ha ido de la banda. Pero es un fotograma
de una vista en movimiento elegido por un reloj que no sabe nada del temblor.

## Coreografías: por qué cada una hace lo que hace
- **regreso** — el PRINCIPIO, y la única que abre una puerta. Arranca dentro de la cabaña
  de Iolo en (15,15); la bolsa a pie mide 27 celdas con UNA salida, la puerta normal
  (0xB8) de (15,19) —flood-fill del port, `verifica-momentos.mjs` §1-sexies—, así que la
  escena no puede ser un paseo: es `o`+abajo y salir. El itinerario de fuera está elegido
  por VISIBILIDAD, no por gusto (ver §los-que-no-se-publican): patio, campo de trigo y el
  camino del sur, todos por encima de 57 celdas visibles de 121.
- **faulinei** — el RITUAL. `defs.ts` define el momento con `shadowlordConvocado`, que
  `compone.ts:147` convierte en `state.shadowlordSummoned` + un objeto de mundo en
  (x, y−1): el momento queda «a un Use» del ritual. El guión lo ejecuta (`u` + 17
  abajo + Enter, índice MEDIDO sobre el inventario real) y el motor narra el desenlace.
- **astaroth** — el SEGUNDO ritual, el Shadowlord del Odio sobre la Llama del Amor. Misma
  forma que faulinei y misma firma en el grabador (1 × 34).
- **nosfentor** — el TERCER ritual, en Serpent's Hold. Ídem.
- **corona** — la CORONA. Ponerse la corona de Lord British en el castillo; emite sólo
  `message` (`endgame/use-tools.ts:341-349`), sin efecto transitorio.
- **compania** — el VIAJE. Rumbos medidos con sonda de 25 pasos desde (81,105):
  N 25/25 · E 16 · O 17 · S 1. La ruta se queda dentro de lo medido y arranca hacia el
  castillo que ya está en cuadro.
- **underworld** — el COMBATE. Bajada, `Slow progress! Poisoned!`, emboscada y turno de
  combate. Su `lastTurn` 30 con 120 teclas NO es «teclas contra una pared» (premisa que
  circuló y que el vídeo refutó): es el prompt de combate, que no avanza turno de mundo.
  La entrada en combate está MEDIDA (salto de 10.237 px en el fotograma 199, ~paso 33) y
  NO es una transición animada: el tablero se cambia de golpe, por eso 0 alargados.

## Los que se grabaron y NO se publican — hoy queda UNO
- **blackthorn** — la cámara del usurpador. El vídeo existe y no vale: la skull key se
  gasta (3 → 2), la puerta no se abre y la party se queda clavada con tres `Blocked!`.
  Es la ficha **#232**, con causa sin adjudicar. Su `keys` sigue en el árbol, en
  `game/partidas/guiones/`.

No tiene JSON en `game/partidas/` ni fila en `CONTEXTO`: las dos mitades del gesto viajan
juntas, o el generador aborta por fila huérfana (que es lo que pasó el 13-08 al retirar
sólo una de las dos).

### 🔴 `regreso` SALIÓ DE ESTA LISTA EL 14-08, y su diagnóstico corrige el que estaba aquí
Aquí ponía «el guión acaba en zona sin pintar y el póster sale casi negro». La segunda
mitad era cierta; **la primera es falsa y manda a buscar el defecto donde no está**: el
mapa de la cabaña de Iolo (loc 13, z0) está pintado entero — 1024 celdas, ninguna vacía.

Lo que pasaba, MEDIDO con el módulo que usa el propio juego (`computeVisibleWindow` de
`game/src/core/world/visibility.ts`, sobre `smallmaps.json` id 13): **Forest3 (0x09) es
opaco a la vista** —está en `ALWAYS_OPAQUE`, tabla `DATA.OVL 0x6A86`, Clase A— y **572 de
esas 1024 celdas son bosque**. El guión salía de la cabaña y tiraba al este, adentro de la
espesura; desde una celda de bosque cerrado la ventana 11×11 se queda en **9 celdas
encendidas de 121 (7,4 %)**, y eso es el negro. El port estaba haciendo lo correcto.

⚠️ Y NO era falta de luz: son las 8:35 y `lightLevel` (survival.ts:518) da 0x32 = 50, el
radio máximo. Quien buscara la causa en la hora o en la antorcha no la habría encontrado.

El guión nuevo se queda en el claro (patio, camino, campo de trigo). Careo del itinerario
con el mismo instrumento, sobre los 120 pasos de cada versión:

| guión | celdas visibles mín | media | pasos con < 40 | «Blocked!» |
|---|---:|---:|---:|---:|
| 13-08 (retirado) | 9 | 55,8 | 33 | 3 |
| 14-08 (servido) | 57 | 91,9 | 0 | 0 |

★★ La lección que deja para los guiones futuros: **en este juego la escena no la decide
por dónde se PUEDE andar, sino desde dónde se PUEDE VER.** El bosque es transitable y
opaco a la vez, así que una ruta perfectamente legal produce un minuto de pantalla negra
sin que falle nada — ni el grabador, ni el careo de huellas, ni el recuento de fotogramas.
Antes de grabar un guión nuevo, pásalo por la visibilidad del port.

### La herramienta que cumple esa orden EXISTE — `game/tools/guion-visibilidad.mjs` (#255)
La regla de arriba estuvo un día sin instrumento (el del carril que la escribió murió con
su scratchpad). Hoy se corre así, y no hace falta nada más que la extracción local:

```bash
node --import tsx game/tools/guion-visibilidad.mjs game/partidas/guiones/<id>.txt          # la simulación
node --import tsx game/tools/guion-visibilidad.mjs game/partidas/guiones/<id>.txt --mapa   # el mapa de claros
node --import tsx game/tools/guion-visibilidad.mjs --momento <id> --control-muro           # su autocontrol
```

Imprime por tecla `posición · tile · visibles/121 · BLOQUEADO` y al final las cuatro
magnitudes de esta tabla. Encadena las clases del port (`computeVisibleWindow`,
`resolveStep`, `DoorManager`, `TownHourTiles`): no reimplementa ninguna regla del juego. El
guión nuevo se le pasa con `--momento` mientras aún no tenga `game/partidas/<id>.json`.

**La media de esa fila publicó 93,9 hasta el 14-08 y ESE NÚMERO ESTÁ RETIRADO** (decisión
del lead, careo de #255): se midió con el régimen del PASO aplicado a la VISTA — el **paso**
usa la constante 5 (`movement.ts:99`, ficha #42), pero la **vista** usa `map.edgeFillTile` =
la celda (31,31) del propio mapa, que en la cabaña de Iolo es **Forest3 (0x09), OPACO**. Son
dos reglas distintas del binario y el instrumento viejo aplicó la equivocada; el 93,9 se
reproduce —93,99— sólo forzando hierba (`--relleno 5`). La cifra vigente es **91,9 por
tecla** (93,5 por paso), medida con esta herramienta sobre el relleno real; las otras tres
magnitudes salieron EXACTAS en ambos regímenes (mínimo 57 · 0 pasos bajo 40 · 0 «Blocked!»),
así que nada de lo que la tabla DECIDE se movió. La cabecera de `guiones/regreso.txt`
llevaba un TERCER valor (94,3, productor desconocido) — retirado igual y por lo mismo.
