# Sonda 0xEC — EXPERIMENTO DE ENTRADA (tarjeta REVISADA 27-07 tarde, tras el testigo YT)

> **★ [27-07 NOCHE — MECANISMO DERIVADO, la candidata (a) CAE]**: ver
> `re/notes/dungeon-map-buffers.md` (referencia canónica). **Hay UN SOLO búfer de mapa**
> (`g_dng_map` @ DS:0x595A, 512 B = las 8 plantas): la gema (`DNGLOOK 0x0340` @0x03C1) y el
> movimiento (`DUNGEON 0x0502` @0x05D0) leen los MISMOS bytes con el MISMO indexado y el
> MISMO wrap. Censo exhaustivo de la E/S del juego: **64 sitios de carga/escritura por
> bloque y exactamente UNO nombra `DUNGEON.DAT`** (MAINOUT 0x0884), colgando por cadena
> única de la tecla `(E)nter`. ⇒ **(a) «la gema lee la copia del save y el movimiento
> relee el disco» REFUTADA** (no existe la recarga). **(c) es la única asimetría real**:
> entrar andando SOBRESCRIBE el búfer; cargar partida dentro NO (`INTRO 0x0EB4` restaura
> la ventana entera y `ULTIMA.EXE 0x00DB`→`DUNGEON 0x0E2E` no carga nada). Y `dng_exit`
> (0x1D08) **no limpia el búfer** — ése es el origen exacto del mapa arrastrado.
> Confirma y amplía la derivación de frontera-25 (bloque «RESUELTO EL MECANISMO» de más
> abajo), y **concuerda con la re-adjudicación final de las 19:20** (la sesión jugó cm64
> sobre la geografía de Doom): con `(E)nter` como único cargador y el testigo diciendo
> «todo seguido desde la carga, sin salir ni re-entrar», el búfer NO pudo cambiar durante
> la sesión ⇒ **la quimera es la única lectura posible del mecanismo**.
> **Discriminador barato para el futuro**: pulsar `V`iew a gem ANTES de mover — la gema
> pinta muros/salas/escaleras incondicionalmente (sólo los pasillos dependen del bit 0x08)
> ⇒ Doom planta 0 tiene **1** sala, Covetous planta 0 tiene **8** + 2 fuentes.

> **⛔ [27-07 NOCHE — EXPERIMENTOS EN PAUSA: CONFOUND DEL SAVE CONFIRMADO POR BYTES]**
> Los 4 escenarios u5save arrastran dentro **el mapa de DOOM** (la base era un save del
> descenso de Doom y el parcheo de posición no tocó la copia de mapa; solo 3 bytes los
> separan de Doom-limpio). Y la gema del usuario demuestra que **el original USA la copia
> del save al cargar, no relee el disco** ⇒ la sesión del testigo en vivo caminó sobre
> el mapa de Doom etiquetado como Covetous. **HIPÓTESIS v3 (dominante): la «sala vacía»
> era el confound del save, no un mecanismo del wrap.** La sesión del 27-07 queda **NO
> CONCLUIDA** (anotado también en su acta). Los brazos B/W/S/C se re-lanzarán con los
> saves PARCHEADOS (mapa auténtico escrito en el bloque del .GAM) — discriminador de 20 s
> pendiente: al norte de (0,2), Covetous=roca (Blocked!) vs Doom=pasillo (avanzas).
>
> **[v3-CONCRETA REFUTADA POR BYTES, mismo 27-07 noche]**: la ventana file 0x3B4 del save
> muestra que el mapa arrastrado NO tiene sala-despejada donde entró el testigo — es más,
> bajo ese mapa (0,2)→oeste cae en PASILLO LISO (ninguna sala), y el testigo ENTRÓ a una
> sala que solo existe en el Covetous auténtico ⇒ **el MOVIMIENTO de ayer obedeció al mapa
> REAL mientras la gema de hoy pinta el de DOOM — dos búferes**. Candidatas sin favorita:
> (a) la gema lee la copia-del-save y el movimiento un búfer recargado del disco (⇒ el
> testigo de ayer sería VÁLIDO y v2/wrap revive; solo las vistas de gema estarían
> envenenadas); (b) la ruta de ayer no fue la del acta; (c) difiere cargar-dentro vs
> entrar-andando. **El propio paso del brazo W es el discriminador** (Blocked! = el mapa
> arrastrado gobierna el movimiento; sala = gobierna el real). Tabla completa de los 4
> brazos bajo ambos mapas en el carril guia-dosbox. PAUSA se mantiene hasta ese paso.
>
> **[RESUELTO EL MECANISMO, 27-07 noche, derivación frontera-25]**: (a) REFUTADA POR
> CENSO — las 51 referencias a 0x595a son EL MISMO búfer (gema incluida); DUNGEON.DAT
> tiene UNA sola lectura en todo el corpus (enter_dungeon, MAINOUT 0x0790→0x086d) y la
> ventana del save [0x55a6,0x6606) INCLUYE el mapa (0x3B4 = resta de dos inmediatos).
> **(c) CONFIRMADA: entrar ANDANDO pisa el búfer con el mapa auténtico; CARGAR no** ⇒
> el mismo búfer contiene Doom o el auténtico EN MOMENTOS DISTINTOS de la sesión.
> Pregunta al testigo: ¿salió a la superficie y re-entró andando durante la sesión del
> 27-07? (eso validaría sus observaciones). El parche del bloque 0x3B4 es SUFICIENTE
> (instalado en los 5 escenarios) y hay control gratis: salir+re-entrar a pie reescribe
> el mapa bueno aunque el save esté envenenado.

**REVISIÓN**: la v1 de esta tarjeta partía de la hipótesis «banco playerStarts degenerado».
El testigo archivado (aulddragon Part 20, acta `sonda-0xec-testigo-yt.md`) la DISUELVE:
cm64/cm65 son pareja espejo con UN banco poblado cada uno, y la etiqueta de dirección es
el BORDE DONDE APARECES (semántica confirmada 4/4 en vídeo). La entrada del testigo en
vivo (andando al oeste ⇒ borde este de cm65) usaba un banco POBLADO — y aun así la sala
salió SIN combate y SIN botín. La anomalía sigue viva con hipótesis nueva:

**HIPÓTESIS v2**: la entrada por **WRAP TOROIDAL** del grid 8×8 (cruzar el borde del
mapa, como hizo el testigo en vivo desde (0,2)→(7,2) de la planta 0) **se salta la
inicialización de la sala**. Las 4 entradas CON combate del vídeo fueron por pasillo
normal.

## Canon pre-registrado (confirmado ya por el testigo YT en cm64)

Espirales del mapa Schiraldi = «Random enemy groups» REALES (237→6 Giant Rats,
236→4 Bats en una instancia; el roll es aleatorio). Cuartito: espada+2 bolsas+2 escudos.

## Los brazos (escenarios u5save instalados — METAs CORREGIDOS 27-07 tarde)

**CORRECCIÓN v3** (súper-análisis, acta `covetous-wiki-mapping.md`): con la regla
borde-opuesto (confirmada 4/4 en vídeo), TODA marcha al oeste usa el banco cm65.east
**POBLADO** — mis etiquetas v2 de «degenerado/real» estaban INVERTIDAS. Consecuencia
buena: **B y W comparten banco ⇒ el banco queda CONTROLADO y la única variable entre
ellos es wrap-vs-normal.** Y `cadena-este` es el ÚNICO acceso genuinamente degenerado
((0,0)×6) a la sala 1 en toda Covetous.

- **BRAZO B — entrada NORMAL, banco poblado**: `covetous-r1-planta2`. Planta idx 1,
  (7,1): gira al OESTE, 1 paso → sala 1 en (6,1), pasillo normal SIN wrap.
  Predicción v2: **COMBATE + botín**.
- **BRAZO W — WRAP, mismo banco poblado**: `covetous-r1-wrap`. Planta idx 0, (0,4):
  gira al OESTE, 1 paso → wrap → sala 1 en (7,4). Predicción v2: **VACÍA**.
- **BRAZO C — banco DEGENERADO, ahora PREDICCIÓN FALSABLE (27-07 noche)**:
  `covetous-r1-cadena-este`. Planta idx 5, (2,4): gira al ESTE → salas 12→13→**1
  entrando al este** = banco (0,0)×6. **DERIVADO (#44, DNGLOOK 0x117E)**: el selector
  copia los pares VERBATIM sin comprobar degeneración ⇒ predicción: **la party entera
  aparece en la casilla (0,0) de la arena** (roca sólida en cm65). Si aparece en otro
  sitio, la lectura del ASM está mal y se vuelve. (Save base reparado; la «colocación
  de respaldo» del acta del testigo queda RETIRADA como interpretación.)

Subproducto del súper-análisis para futuros brazos: **7 celdas de Covetous** tienen
entrada por un lado SIN banco poblado (lista en `covetous-wiki-mapping.md`) — los sitios
donde la guarda anti-(0,0) puede dispararse en juego normal.

Qué apuntar en cada sala: ① ¿combate? ② ¿dónde aparece la party? ③ ¿enemigos, cuántos,
en qué casillas? ④ ¿el cuartito se abre (lápida/impacto) y qué contiene? ⑤ Search/Get.

## Matriz de adjudicación v2 (pre-registrada)

| B (normal) | W (wrap) | veredicto |
|---|---|---|
| combate | vacía | **HIPÓTESIS v2 CONFIRMADA**: el wrap se salta la init — hallazgo de primera sobre el original |
| combate | combate | la anomalía del 27-07 NO reproduce ⇒ sospechar del ESTADO del save de aquella sesión (re-derivar confound) |
| vacía | vacía | ni banco ni wrap: la init depende de otra cosa (¿planta? ¿estado?) — re-derivar |
| vacía | combate | patrón invertido: instrumento o comprensión rotos — parar y re-derivar |

## BRAZO S (añadido 27-07 noche — cierra #44): sala→sala con banco vacío

LEY derivada (231/231 sin excepción en todo el juego): un banco vacío SOLO es alcanzable
saliendo de una sala DIRECTAMENTE a otra sala (jamás desde pasillo). El mecanismo de
salida está confirmado en vídeo (salir te deja en la celda adyacente). Sonda de 30 s:
`u5save` → **`wrong-brazo-s`** (Wrong planta 0, celda (3,3)): al NORTE entras a cm49
normal y sales por el ESTE a la MISMA cm49 con banco `west` VACÍO — apunta dónde aparece
la party y si monta combate. CONTROL en la misma celda: al SUR (cm50→cm50 con banco
POBLADO). La comparación de ambas transiciones contesta también la Q2 del port (su
fallback determinista south→north→east→west sigue declarado PENDIENTE-DE-ORÁCULO).

## Pregunta nueva del testigo YT (independiente de los brazos)

El cuartito del vídeo se abrió por **impacto a distancia** en la casilla de la lápida
(nadie la empujó ni pisó). Al jugar los brazos, si hay combate: prueba a dispararle a la
lápida desde lejos ANTES de tocarla — ¿se abre? (adjudica el disparador del trigger;
consumidor: Combat.fireTriggers, COMBAT 0x111A).

> **[DISCRIMINADOR JUGADO, 27-07 ~19:02 — testigo con capturas]**: en la ventana vieja
> (covetous-r1-remolinos contaminado, posición (0,2)): la gema inicial pinta al usuario
> SOBRE UN MURO con la geografía molinete de 4 escaleras = DOOM planta 1 (la copia
> arrastrada, confirmada en pantalla); el paso al NORTE **AVANZA** (log literal: View a
> gem! · Turn left ×3 · Turn right · Advance — sin Blocked!) ⇒ **EL MOVIMIENTO OBEDECE
> AL MAPA ARRASTRADO**, no solo la gema — coherente con la derivación (un búfer, cargar
> no relee). CONSECUENCIA: la entrada-a-sala del testigo de AYER solo pudo ocurrir si
> el búfer contenía el mapa auténtico en ese momento ⇒ la pregunta de MEMORIA (¿salió y
> re-entró andando?) pasa a ser LA decisiva; si la respuesta es «todo seguido desde la
> carga», la ruta del acta de ayer necesita re-examen (candidata b). Capturas del
> usuario archivadas en su Desktop/screenshots (19.01-19.02).
> **[+observación del mismo testigo]**: en la casilla inicial (roca 0xB0 bajo el mapa
> arrastrado, party DENTRO del muro), con (I)gnite torch la vista 3D mostraba **PUERTAS
> EN LAS CUATRO DIRECCIONES** — comportamiento del renderizador del original con la
> party dentro de sólido (estado imposible-por-diseño). Referencia útil para el brazo C
> (party en (0,0) de la arena) y para cualquier calco de estados degenerados del 3D.
> **[★ CIERRE DE LA QUIMERA, 27-07 ~19:20 — adjudicado POR BYTES tras la respuesta de
> memoria del testigo («no salí ni re-entré: todo seguido desde la carga»)]**: la sesión
> de ayer transcurrió ENTERA sobre el mapa arrastrado de Doom, y la sala que jugó fue una
> **QUIMERA: geografía de Doom + contenido de Covetous**. Derivación completa:
> 1. El mapa arrastrado (backup pre-parche, ventana 0x3B4) difiere de Doom-limpio en
>    exactamente 3 bytes y los 3 son CICATRICES del descenso base: planta0 (1,1)
>    0xF0→0xA0 y planta2 (5,1) 0xF3→0xA3 (= salas r0/r3 DESPEJADAS — cruza 2/2 con el
>    bitmap 0x33A del save, que marca Doom r0 y r3) + planta2 (3,4) 0xD0→0xE0 (cambio
>    de estado de celda, tipo sin adjudicar aquí). ⇒ **codificación confirmada por
>    datos: celda 0xF|roomNo = sala viva, 0xA|roomNo = sala despejada; el estado de
>    despejadez viaja TAMBIÉN en la propia celda del mapa del save.**
> 2. En la planta 0 arrastrada hay UNA sala: (1,1) = 0xA0, roomNo 0 — a dos pasos de la
>    posición inicial (0,2): norte (0,1) y ESTE a (1,1) (la ruta «oeste con wrap» del
>    acta era reconstrucción errónea; al oeste el wrap cae en pasillo y a 2 celdas hay
>    roca — candidata b CONFIRMADA).
> 3. QUIMERA: roomNo 0 de la celda de Doom + loc=Covetous del save ⇒ combatmap
>    64+0 = **cm64** (no cm65, que era la asunción del escenario).
> 4. TRIPLE CANDADO en cm64: (a) la party apareció en la COLUMNA IZQUIERDA y el banco
>    OESTE de cm64 es el poblado (x∈{0,1,2}) — entrada marchando al ESTE ⇒ borde oeste
>    por P0a, colocación NORMAL ⇒ **el «mecanismo de colocación de respaldo no
>    derivado» del acta queda RETIRADO: nunca existió**; (b) el SIN-COMBATE es la celda
>    0xA0 (sala despejada como estado de trabajo; el bitmap de Covetous a cero era el
>    registro equivocado que mirar); (c) roomNo de la celda casa con la quimera.
> 5. Las 237 se pintaron como FUENTES incluso en sala despejada ⇒ refuerza la lectura
>    mobiliario-decorativo (sigue SIN cerrar el valor de ecFamilyEnemyIndex).
> 6. La afirmación del acta «posiciones EXACTAS con el .CBT» se hizo bajo la asunción
>    cm65; cm64/cm65 difieren (cm64: 6×237 en (8,1)(7,2)(4,1)/(8,8)(7,9)(4,9), 4×236;
>    cm65: 6×236 en bloque x2-3,y4-6) — re-verificable contra las capturas del 27-07 si
>    hiciera falta, pero el triple candado no depende de ello.
> CONSECUENCIA: la anomalía «sala vacía» queda EXPLICADA DEL TODO sin mecanismo nuevo;
> la HIPÓTESIS v2 (wrap se salta la init) pierde su única evidencia ⇒ brazos B/W pasan
> a CONFIRMACIÓN (no adjudicación); S y C conservan su valor original ((0,0) y
> sala→sala). El acta del testigo visual se re-adjudica en su fichero.

## ★ BRAZOS S Y C: RETIRADOS POR DATOS (27-07 ~22:25) — y la pregunta que perseguían, CERRADA

El usuario JUGÓ el brazo S y observó que cm49 **no tiene salida al este** (entró a la
sala norte de Wrong f0 (3,3); muro; para ver la sala vecina tuvo que volver al pasillo
y entrar por su puerta — misma sala, otra tirada de monstruos). Los bytes le dan la
razón y generalizan:

1. **cm49**: único banco poblado = sur, único borde con suelo = sur. El diseño del
   brazo asumió que la adyacencia de CELDAS del mapa implicaba salida jugable, sin
   mirar el INTERIOR del .CBT. Error de diseño del experimento, no del jugador.
2. **La cadena del brazo C también es injugable**: cm76 y cm77 solo tienen salida
   OESTE — la marcha 12→13→1 hacia el este muere en la primera sala.
3. **CENSO COMPLETO (dos listones)**: de las 92 adyacencias sala→sala de las 7
   mazmorras (con wrap, incluyendo celdas 0xA despejadas), las transiciones con
   salida jugable hacia un banco receptor VACÍO son **CERO** — tanto con listón
   conservador de suelo ({0x44,0x45,0x46,0x05} en el borde) como liberal (todo lo
   que no sea muro/vacío {0x4f,0x4d,0xff,0xfe}). El cero aguanta por horquilla.

**CONSECUENCIA**: el caso banco-(0,0) es **INALCANZABLE EN JUEGO NORMAL** con los
mapas de fábrica — los interiores .CBT nunca dejan salir hacia un vecino cuyo banco
receptor esté vacío (y las salas no pueden aparecer en runtime: los escritores de
celda meten COFRES 0x40/0x70, no salas). La copia-verbatim de DNGLOOK 0x117E es
código defensivo muerto en la práctica, y la Q2 del port (fallback determinista,
pendiente-de-oráculo) queda **MOOT en juego normal**: no existe vía legítima que la
ejercite. Se documenta como divergencia inerte, no se caza más con oráculo.

**Subproducto del brazo S jugado**: dos celdas adyacentes de la MISMA cm49 entradas
por el pasillo dan la misma sala con TIRADA DISTINTA de monstruos — coherente con
«random enemy groups» por entrada.

Quedan VIVOS: brazo W (confirmación wrap) y brazo B (control), ambos de un paso desde
pasillo, sin cadenas interiores. La guía del usuario (GUIA-DOSBOX.md) se actualiza.

## BRAZO B JUGADO (27-07 ~23:20, testigo con captura) — CONFIRMA, y regala una corroboración

`covetous-r1-planta2` (planta idx 1, (7,1) → oeste 1 paso → sala 1 = cm65 fresca):
① **COMBATE NORMAL** — «batalla normal, llena de ratas dentro y fuera de la sala
oculta, con ghost». Predicción de B cumplida: la sala FRESCA de Covetous auténtico
monta combate. La anomalía histórica queda doblemente muerta (quimera + este control).
② Party aparece en el LADO DERECHO (captura) = borde ESTE, banco poblado de cm65 —
colocación P0a normal, tercera confirmación en vivo.
③ Elenco de la tirada: ratas (múltiples, arriba y abajo) + ghost — coherente con
«random enemy groups» (el roll del testigo YT en cm64 dio 6 Giant Rats + 4 Bats).
④ **Trigger de lápida funciona también en sala FRESCA** y el cuartito contenía RATAS
(no botín como en el vídeo) — el contenido del cuartito también varía con la tirada.
⑤ ★ «SOLO UNA SALIDA, la misma por la que entré» — **corroboración EN VIVO del censo
de interiores** (cm65: única abertura = ESTE), la misma verdad que retiró los brazos
S y C. Bytes y testigo jugado coinciden.
⑥ Las 2 fuentes (arriba/abajo centro) casan con los TILES 0xD8 del propio .CBT de
cm65 ((4,0)/(4,10)) — mobiliario del mapa, no unidades.

QUEDA: brazo W (wrap, `u5save` → 6) como último control — esperado combate igual;
si sale vacía, hallazgo (wrap-salta-init reviviría contra todo pronóstico).

> **[+testigo del brazo B, captura 2/2]**: el log completo muestra «Entering room...»
> seguido de **«A ring has vanished!»** — string DATA.OVL fileoff **0xa432** (DS
> **0xa422**; `A ring has vanished!\n` empieza en 0xa432 precedido de NUL). [CORREGIDO
> ×2, mismo arreglo por dos manos: la primera versión escribió 0xa434/0xa424 midiendo
> desde la 'r' de un substring — desviado 2 bytes en LAS DOS convenciones porque la
> conversión DS↔fileoff estaba bien y el número BASE mal; lo cazó el censo de strcites
> (delta=2) y lo corrigieron en paralelo el orquestador y t#65. CONFIRMA el DS 0xa422
> que camp-scene.md ya tenía: la «discrepancia» era del orquestador],
> emisor ya derivado en kernel-render-sweep.md:96 (check ==0xb ⇒ print 0xa422 + tono
> 0x43ae) pero SIN contexto de disparo hasta hoy: el testigo lo fija pegado a la
> entrada de sala. Careo port pendiente (tarjeta nueva #67): la expiración POR
> DURACIÓN de anillos parece hueco (el port solo tiene el 1/16 al equipar).

## ★★ BRAZO W JUGADO (27-07 ~23:27) — COMBATE. CAPÍTULO 0xEC CERRADO AL 100%

`covetous-r1-wrap` (planta 0, (0,4) → oeste 1 paso, entrada por WRAP a sala 1 = cm65):
**COMBATE NORMAL** — murciélagos (otra tirada del random-group: B dio ratas, W da
bats) + espectros; party en el borde ESTE (P0a en vivo ×4). Matriz pre-registrada,
fila «B combate + W combate»: la anomalía histórica NO reproduce ⇒ el problema era el
ESTADO del save = LA QUIMERA, ya demostrada por bytes. **HIPÓTESIS v2 (wrap salta
init) MUERTA con matriz cumplida.** Los 4 brazos quedan resueltos: B✓combate,
W✓combate, S/C retirados-por-datos (banco vacío inalcanzable en juego normal).

Subproductos del testigo:
- **«A ring has vanished!» SEGUNDA ocurrencia independiente**, misma posición del log
  (pegada a «Entering room...») en carga fresca ⇒ la tarjeta #67 gana un **REPRO
  DETERMINISTA**: cargar escenario → entrar a sala → anillo desaparece.
- **Superficie coherente**: salió por escalera y Look-East da «the collapsed entrance
  to the dungeon Covetous» — la geografía exterior del save es Covetous auténtico, con
  la entrada DERRUMBADA (palabra de poder sin pronunciar en esta partida) ⇒ no se
  puede re-entrar andando desde fuera, coherente con el estado de quest del save.
