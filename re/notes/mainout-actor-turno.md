# MAINOUT — el turno del actor del sobremundo (tanda 1)

Carril `asm-overlays-6`, primer lote de MAINOUT.OVL. Tres cuerpos leídos instrucción a
instrucción sobre `re/disasm/MAINOUT.OVL.asm`: `actor_can_enter_tile` 0x1482 (70 B),
`tile_is_just_vacated` 0x14c8 (34 B) y `actor_random_wander_step` 0x16fc (216 B).

**Deslinde explícito:** este lote **no toca** las fichas abiertas #31 y #32. Las rutinas de
esas fichas —el sorteo de aparición, el activador por proximidad y las de aparición de
criatura y de barco— están **todas fuera** de estas tres, y ninguna se cita aquí para
adjudicar nada. La discrepancia de #32 sigue sin adjudicar y este lote no la mueve.

---

## 0. Control de legibilidad — y una CORRECCIÓN DE MI PROPIO INSTRUMENTO

Al aplicar mi control de corte a MAINOUT me dio **«3 de 35 filas malas»**. Iba a fichar
tres filas como sospechosas. **Las tres están sanas y el fallo era del predicado.**

Yo probaba **«¿la fila empieza en `55 push bp`?»**. Eso confunde dos cosas distintas:
*decapitada* y *sin marco de pila*. En el fichero anterior no se notó porque las 23 filas
tenían marco; en MAINOUT hay tres frameless y mi test las acusó.

Medido contra la firma real (`55 8b ec` en `start−2`), leyendo bytes crudos del `.OVL`:

| fila | primer byte | ¿firma en start−2? | qué la precede |
|---|---|---|---|
| 0x0000 | `e8` (un `call`) | **NO** | nada — es el offset 0 del fichero |
| 0x0a60 | `80 3e` (un `cmp`) | **NO** | `5d c2 02 00`: la anterior cierra limpio |
| 0x0f4e | `2b c0` (`sub ax,ax`) | **NO** | `5d c2 02 00`: ídem |

Y el **encadenado `start+size` se cumple en las 35**. La tercera además ya está verificada
por otro carril, o sea leída sin problema — testigo independiente de que no está cortada.

⇒ **El predicado bueno del control de corte es el ENCADENADO más la firma `55 8b ec`, no
«empieza en 55».** Un prólogo ausente es una propiedad legítima de una rutina sin marco.
Lo dejo escrito porque el control es compartido y este falso positivo lo va a repetir
cualquiera que lo rehaga de memoria.

---

## 1. `actor_can_enter_tile` — DOS guardas, y el tile del actor viaja como argumento

`ret 6`; por orden de `push` del llamante: `[bp+8]` = actor, `[bp+6]` = X, `[bp+4]` = Y.

1. Toma **el tile del propio actor** del byte +0 de su registro auxiliar (0x148c) y lo pasa
   como tercer argumento al resolvedor de celda del kernel (0x1499) — o sea la consulta de
   mapa **depende de quién pregunta**, no sólo de dónde.
2. Con el byte de terreno que sale de ahí, llama al predicado de paso del kernel (0x14a3).
   Si dice que no ⇒ **devuelve 0**.
3. Si dice que sí, hay una **segunda** guarda (0x14ba) con la planta y las dos coordenadas;
   si devuelve algo distinto de cero ⇒ **también devuelve 0**.
4. Sólo si pasa las dos ⇒ devuelve 1.

No consume azar. No escribe nada.

## 2. `tile_is_just_vacated` — un predicado de dos globales sin ficha

`ret 4`; `[bp+6]` y `[bp+4]` son las dos coordenadas. Compara contra **dos globales de un
solo byte** y devuelve **0 si las dos coinciden**, 1 en cualquier otro caso. Es decir: el
valor «malo» (0) es el de la celda recordada, y el nombre lo lee bien.

Los dos globales **no tienen nombre en el disasm** (salen en crudo) y no les he encontrado
ficha. No los bautizo: hace falta ver quién los ESCRIBE, y eso está fuera de este lote.
Los dejo señalados como cabo, en decimal para no sembrar nada: 42278 y 42279.

## 3. 🔴 `actor_random_wander_step` — UNA tirada por paso, y un reintento que NO PUEDE EJECUTARSE

`ret 2`; `[bp+4]` = actor. Precalcula las cuatro celdas vecinas (x±1, y±1) a partir de los
bytes +2 y +3 del registro auxiliar del actor, y entra en el bucle.

**El sorteo.** Una sola llamada al generador por vuelta (0x1748). La derivación acreditada
de esa rutina —`(semilla & 0x7fff) % ([bp+4] − [bp+6] + 1) + [bp+6]`, **inclusiva por los
dos extremos**, primer `push` = `[bp+6]`— con los argumentos de aquí (primer `push` 0,
segundo 3) da **exactamente 0, 1, 2 o 3**: cuatro desenlaces equiprobables.

**Las cuatro salidas son las cuatro ORTOGONALES**, y cada una comprueba la celda que le
corresponde antes de moverse — leído caso a caso y con los desplazamientos casados:

| sorteo | celda que comprueba | movimiento |
|---|---|---|
| 0 | (x, y−1) | (0, −1) |
| 1 | (x+1, y) | (+1, 0) |
| 2 | (x, y+1) | (0, +1) |
| 3 | (x−1, y) | (−1, 0) |

**No hay diagonales** en el paseo del sobremundo.

### 🔴 El reintento es CÓDIGO MUERTO, y se demuestra con el rango

Tras los cuatro `cmp` hay un `jmp` a un tramo (0x17c0) que incrementa un contador, lo
compara con 3 y **vuelve al sorteo** — un reintento de hasta tres vueltas. Ese tramo **sólo
es alcanzable por el caso por defecto del conmutador**, y el conmutador **cubre los cuatro
valores que el generador puede devolver**. ⇒ **el reintento nunca se ejecuta.**

Esto **no** es «probablemente inalcanzable»: el rango sale de la fórmula acreditada del
generador, no de una suposición sobre el orden de los argumentos —que en esa rutina es
justo lo que se lee al revés con facilidad—. El contador que el epílogo guarda (0x17c9)
vale por tanto **siempre 0**.

### La contabilidad de tiradas, que es lo que importa para paridad

- **Exactamente UNA tirada por actor que pasea, por turno. Siempre.**
- **Si la dirección sorteada está bloqueada, el actor NO se mueve y NO vuelve a tirar**:
  la comprobación de la celda salta directamente al epílogo (0x176c, 0x1788, 0x179c,
  0x17b4). Bloqueado ⇒ turno perdido, una tirada gastada.
- El reintento que *parecería* dar más tiradas está muerto (arriba).

⇒ el consumo de esta rutina **está acotado y es constante**, al contrario que los dos
sorteos con reintento que ya tiene fichados el proyecto. Eso la hace **fácil de calcar y
fácil de romper**: un port que re-sortee al encontrar la celda bloqueada gasta más de una
tirada por actor y descuadra el stream desde el primer obstáculo.

---

## 4. Lo que NO he hecho

- **No he mirado el port** en esta tanda: es lectura de binario. El cotejo del paseo del
  sobremundo contra el clon queda para la siguiente.
- **No he adjudicado #31 ni #32**, ni he tocado sus rutinas.
- **No he bautizado** los dos globales del §2.
- Las llamadas salientes al kernel están resueltas por dirección y usadas por su rol, no
  por su cuerpo.

---

# TANDA 2 — la persecución, el filtro radial, y un DATO para #32 que NO adjudico

Dos cuerpos más: `actor_radial_viewport_gate` 0x14ea (142 B) y `actor_seek_party_step`
0x17d4 (440 B).

## 5. 🔴 DATO PARA #32 — un TERCER y un CUARTO sitio que miden la misma magnitud, y los dos ENVUELVEN

La ficha #32 tiene sin adjudicar una discrepancia entre **dos** sitios que miden la
distancia actor→grupo: el sorteo de aparición la mide en el toro de 8 bits (#31) y el
activador por proximidad la mide con `|Δ|` pelado, **sin la mitad del envolvimiento**.

Estas dos rutidas aportan **dos mediciones más de la misma magnitud, y las dos envuelven**:

| sitio | cómo mide | ¿envuelve? |
|---|---|---|
| sorteo de aparición (#31) | toro de 8 bits, en dos mitades | **sí** |
| activador por proximidad (#32) | `|Δ|` pelado | **no** |
| **filtro radial** 0x14ea (aquí) | `|Δ|` y luego `0x100 − |Δ|` si pasa de 0x7f | **sí** |
| **persecución** 0x17d4 (aquí) | `Δ − 0x100` si pasa de 0x7f (forma CON SIGNO) | **sí** |

Las dos formas de aquí son la misma regla con distinto propósito: el filtro necesita una
**magnitud** (por eso toma el valor absoluto primero) y la persecución necesita una
**dirección** (por eso convierte a delta con signo y se queda el signo). Ambas tratan las
coordenadas como un espacio que **envuelve en 256**.

⇒ **el reparto pasa de «uno contra uno» a «uno contra tres»**, y el sitio raro sigue siendo
el mismo que ya señalaba #32.

🔴 **NO ADJUDICO NADA.** No he leído el contexto de coordenadas del activador por
proximidad ni el de sus llamadores, que es exactamente lo que #32 dice que hace falta para
decidir. Aporto el dato y la cuenta; la adjudicación es del lead. Y anoto la trampa que
tiene esta forma de razonar: **tres a uno no demuestra que el uno esté mal** — puede ser el
único que opera en un espacio que de verdad no envuelve.

## 6. El filtro radial: una tabla de 11 de ancho leída por su cuadrante

Con las dos distancias ya envueltas, exige **las dos menores que 6** (0x1547-0x1551); si
alguna llega a 6 devuelve 0 sin mirar nada más. Si pasan, indexa una tabla de datos con
`fila·11 + columna` (el `si` se construye con desplazamientos y sumas: ×2, ×2, +1, ×2, +1
= **11**) y devuelve el byte.

Detalle que conviene tener escrito: **el ancho es 11 pero los índices sólo llegan a 5**,
porque las dos entradas vienen ya en valor absoluto. O sea la tabla está pensada para
`−5..+5` en las dos direcciones y el código **sólo consulta su cuadrante positivo**,
apoyándose en que es simétrica. Quien la extraiga como una tabla de 6×6 se deja fuera más
de la mitad del dato.

## 7. 🔴 La persecución: UNA moneda siempre, y una SEGUNDA tirada si se queda sin salida

`ret 4`; `[bp+6]` = actor, y **`[bp+4]` es un parámetro de SALIDA**: la rutina le escribe
la orientación (0 o 1) por el camino, como efecto lateral del cálculo del paso.

Calcula el paso en cada eje (−1, 0 o +1) a partir del signo de las dos distancias
envueltas, y entonces:

**La moneda (0x18b5).** Una llamada al generador con los argumentos que, por la fórmula
acreditada, dan **0 o 1**. Y decide **cuál de los dos ejes se intenta primero**:
- moneda = 1 → intenta **X** y, si no puede, **Y**.
- moneda = 0 → intenta **Y** y, si no puede, **X**.

Cada intento pasa por **las dos guardas** de las §1 y §2 (poder entrar en la celda **y** que
no sea la recién liberada). Si la primera opción falla se prueba la otra; si esa también
falla:

**🔴 0x197d: la persecución CAE AL PASEO ALEATORIO** — llama a la rutina de la §3, que
consume **su propia tirada**.

### Contabilidad, por rama

| caso | tiradas |
|---|---|
| avanza por el primer eje que prueba | **1** (la moneda) |
| avanza por el segundo | **1** |
| bloqueado en los dos ⇒ cae al paseo | **2** (moneda + la del paseo) |

⇒ **1 o 2 tiradas por actor perseguidor y turno, y cuál de las dos depende del TERRENO.**
Es el mismo patrón que ya fichó el proyecto en otros sitios: el consumo no se lee del
código de la rutina, se lee de si el mundo la deja avanzar. Un port que resuelva la
persecución sin la moneda —o que no encadene el paseo al quedarse sin salida— descuadra el
stream **y** cambia el reparto de direcciones cuando hay un obstáculo.

## 8. Sobre la tabla de comportamientos del sobremundo (lo que el lead preguntó)

Pregunta: si el sobremundo tiene **su propia** tabla de comportamientos, hermana de la que
`invisible-12` midió en pueblo y encontró mal etiquetada.

**Lo que puedo responder con lo leído:** `actor_seek_party_step` **no consulta ninguna
tabla de comportamiento**. Es geometría pura (signo de las dos distancias) más la moneda.
La única tabla que aparece en estas dos rutinas es la del §6, y **no es un despachador de
comportamiento**: es un filtro radial que devuelve un byte a partir de la distancia.

**Lo que NO puedo responder:** dónde se decide que un actor concreto *persiga* en vez de
*pasear*. Esa bifurcación vive en un llamador que **no he leído** (el bucle principal del
sobremundo o su despachador). ⇒ **no afirmo ni que exista una tabla propia ni que sea la
misma que la de pueblo.** Es el sitio a mirar, y avisa: es justo el caso en que un catálogo
parecido devuelve una respuesta plausible y equivocada.

---

# TANDA 3 — el contacto: torbellino, daño de barco o combate

`actor_contact_whirlpool_or_combat` 0x1248 (210 B, `ret 2`; `[bp+4]` = actor). Cierra la
cadena por su otro extremo: qué pasa cuando el actor **alcanza** al grupo.

## 9. Tres desenlaces, decididos por FAMILIAS DE TILE de cuatro

El tile del actor (byte +0 de su registro auxiliar) se enmascara con `0xfc` y se compara.
**Enmascarar con `0xfc` agrupa de cuatro en cuatro**, que es el idiom de tile animado de
este binario — las cuatro entradas consecutivas son los cuatro fotogramas del mismo tile:

| máscara y valor | familia | desenlace |
|---|---|---|
| `& 0xfc == 0xec` | 4 fotogramas del **torbellino** | §10 |
| `& 0xfc == 0xe0` | 4 fotogramas de otra familia | daño de barco y salir |
| ninguna | — | «Attacked!» y §11 |

⇒ quien porte esto comparando el tile **exacto** en vez de la familia acierta sólo en uno
de cada cuatro fotogramas, y el fallo se ve como intermitencia inexplicable.

## 10. 🔴 El torbellino TELETRANSPORTA a una posición FIJA, y el destino está en el código

Si el actor es un torbellino, hay dos caminos y **el transporte del grupo decide cuál**:

- Con el transporte concreto `0x1c` (0x1260): sólo **daño de barco**, y sale.
- **Si no** (0x126e): el torbellino se lleva al grupo. En orden leído:
  1. **Borra al actor**: pone a cero los bytes +0 y +1 de su registro auxiliar.
  2. Imprime `"\nWHIRLPOOL!\n"` (DS `0x6b04`).
  3. **Sustituye temporalmente el tile de transporte por el del torbellino**, redibuja y
     hace sonar un glide — y **lo restaura después** (0x128e-0x12ac). Es una animación que
     pasa por una variable de estado global, no por un búfer de dibujo.
  4. Daño de barco.
  5. 🔴 **Teletransporte a coordenadas FIJAS, escritas como literales**: la planta pasa a
     `0xff` y la posición del grupo a **(34, 18)** en decimal. No es una tabla ni un
     sorteo: son tres `mov` con constantes.
  6. Re-inicializa el modo sobremundo.

**Cero azar en todo el camino.** El destino del torbellino es determinista y siempre el
mismo — dato que conviene tener escrito antes de que alguien lo modele como aleatorio
porque «un torbellino te deja en cualquier sitio».

## 11. El desenlace por defecto: agua bajo los pies decide entre daño y combate

Sin familia de tile que case (0x12d7): redibuja, imprime `"\nAttacked!\n"` (DS `0x6b12`) y
**consulta el terreno bajo el GRUPO** (no bajo el actor) con el resolvedor de celda. Si ese
terreno es **menor que 4** —los índices bajos del catálogo de terreno, o sea agua— aún
puede desviarse a daño de barco, pero sólo si el transporte pertenece a una de otras dos
familias (`& 0xfe == 0x14`, dos fotogramas; `& 0xfc == 0x28`, cuatro). En cualquier otro
caso, entra en combate con ese actor.

Nótese la asimetría, que es fácil de perder al portar: **la familia se mira en el ACTOR,
pero el terreno se mira bajo el GRUPO.**

## 12. Estado de la cadena y lo que queda

De las siete rutinas del lote quedan **una** sin leer: `actor_pre_move_attack` (360 B), que
es la que decide *si* el actor ataca antes de moverse — o sea la que enlaza la §11 con las
tandas 1 y 2. **No la he leído y no infiero nada sobre ella.**

Sigue en pie lo dicho en la §8: **dónde se decide que un actor persiga en vez de pasear no
está en ninguna de las seis leídas**, y ése es el sitio a mirar para responder si el
sobremundo tiene tabla de comportamientos propia.

---

# TANDA 4 — la puerta de ataque, y la CADENA QUEDA CERRADA

`actor_pre_move_attack` 0x131a (360 B, `ret 2`; `[bp+4]` = actor). Devuelve **1 si el actor
ya ha actuado** (y por tanto no le toca moverse) y **0 si no**. Es la pieza que enlaza las
tandas 1-3: se consulta **antes** del paso.

## 13. Tres puertas, en orden, y sólo una tira

Calcula las dos distancias al grupo **con el envolvimiento de 8 bits en forma de magnitud**
(0x1345-0x1350 y 0x1370-0x137b) — **quinto sitio** que aplica la regla del §5.

### Puerta 1 — contacto, y es ORTOGONAL PURO
`(|Δx| == 1 && |Δy| == 0) || (|Δx| == 0 && |Δy| == 1)` (0x137e-0x1394) ⇒ llama a la rutina
de contacto de la §9 y devuelve 1.

🔴 **Una criatura en DIAGONAL no hace contacto.** `|Δx|=1, |Δy|=1` no casa con ninguna de
las dos mitades. Cuadra con que el paseo (§3) sea también ortogonal puro — el sobremundo
trata la adyacencia como las cuatro caras, no como las ocho vecinas. **Sin azar.**

### Puerta 2 — el atacante a distancia: 1 de cada 8
Sólo para dos tiles concretos del actor (0x88 y 0xdc, comparados **exactos**, no por
familia — al contrario que la §9). Exige `|Δx| ≤ 3` **y** `|Δy| ≤ 3`, y entonces:

🔴 **una tirada del generador que sólo continúa si sale 0** — por la fórmula acreditada el
rango es 0..7, así que es **1 posibilidad entre 8**. Si no sale 0, devuelve 0 **con la
tirada ya gastada**.

Si sale 0: redibuja, glide, y construye `(actorX − partyX) + 5` y `(actorY − partyY) + 5`
**como bytes**. Ese `+5` es la confirmación independiente de la §6: **la geometría de
vecindad de este subsistema es una rejilla de 11×11 centrada en 5**, y aquí se ve montada
explícitamente en vez de deducida del ancho de una tabla. Con esos dos índices llama a una
rutina de línea; si devuelve 0, el actor ha actuado; si no, marca la posición del grupo y
aplica daño de barco.

### Puerta 3 — la explosión, en línea recta y sin azar
`tile & 0xfc == 0x2c` (una familia de cuatro, como en la §9) **y** la posición relativa en
cruz: `(Δx == 0 && Δy < 4) || (Δy == 0 && Δx < 4)`. Imprime `"* BOOOM! *"` (DS `0x6b1e`) y
resuelve. **Sin azar.**

Nótese que la puerta 2 compara el tile **exacto** y la 3 **por familia de cuatro**. Es la
misma rutina usando **dos convenciones distintas de tile a ocho instrucciones de
distancia**; quien unifique «para limpiar» rompe una de las dos.

## 14. Contabilidad de tiradas del TURNO COMPLETO de un actor del sobremundo

Con la cadena entera leída (§1, §2, §3, §6, §7, §9 y §13), el turno de un actor cuesta:

| fase | tiradas |
|---|---|
| puerta de ataque, contacto o explosión | **0** |
| puerta de ataque, atacante a distancia en rango | **1** (la de 1 entre 8), gastada acierte o no |
| si no actuó y **pasea** | **1** |
| si no actuó y **persigue**, avanza | **1** (la moneda) |
| si no actuó y **persigue**, bloqueado en los dos ejes | **2** (moneda + paseo) |

⇒ **entre 0 y 3 tiradas por actor y turno**, y el número depende del **tile del actor**, de
su **distancia al grupo** y del **terreno**. Ninguna de esas tres cosas está en el código de
las rutinas: están en el mundo. Es la forma más difícil de consumo que hay para un port,
porque **no se puede acertar leyendo sólo el algoritmo**.

## 15. Cierre del lote y lo que sigue abierto

**Las siete rutinas del turno de actor del sobremundo están leídas.** Lo que sigue sin
responder, y sigue siendo el mismo hueco desde la §8: **dónde se decide que un actor
persiga en vez de pasear.** No está en ninguna de las siete. Vive en el bucle principal del
sobremundo o en su despachador, y es el único sitio donde puede haber —o no— una tabla de
comportamientos propia del sobremundo, hermana de la de pueblo. **Sigo sin afirmar que
exista.**

---

# TANDA 5 — PARCIAL. `outdoor_main_loop` NO está leída; esto es un hallazgo suelto

⚠️ **Aviso de alcance, para que nadie lo lea como una tanda cerrada:** empecé
`outdoor_main_loop` 0x0a84 (670 B) buscando la respuesta de la §8 y **no he terminado de
leer su cuerpo**. La fila sigue **pendiente en el ledger** y **no la he marcado verificada**.
Lo que sigue es una sola cosa, comprobable por sí misma, que encontré por el camino.

## 16. 🔴 SEGUNDA tabla de salto embebida — y confirma la base de la BANDA 1

En 0x0b2b-0x0b2e el bucle despacha con `add ax,ax` / `xchg bx,ax` /
`jmp word ptr cs:[bx - 0x7272]`, con el índice **acotado a 0x16** justo antes (0x0b23).
O sea **23 entradas**, y otra vez **la tabla vive dentro del segmento de código**.

Verificado con el mismo método que la del otro fichero, y con el mismo resultado:

- El desplazamiento `-0x7272` es `0x8d8e` sin signo; con la base de la banda 1 (`0x81d0`)
  da **file 0x0bbe** — que cae **dentro del propio cuerpo de la rutina** (0x0a84-0x0d21).
  Es decir: **46 bytes que el desensamblador va a imprimir como instrucciones absurdas en
  mitad de la rutina.**
- Las **23 entradas caen las 23 sobre el inicio de una instrucción real**, y todas dentro
  del rango de la rutina (0x0af8 .. 0x0bb8). Ninguna falla.

⇒ **Confirmación independiente de la base `0x81d0` de la banda 1**, por la misma vía de
datos que ya acreditó la de la banda 4 y con 23 aciertos simultáneos. Las anclas que había
para esta banda eran de `call`; ésta no.

**Y la consecuencia práctica es la de siempre, ahora en un segundo fichero:** antes de
fichar una fila de MAINOUT como decapitada porque el disasm da basura en medio, **hay que
descartar que ese tramo sea una tabla**. Ya van dos ficheros y dos tablas.

Detalle menor: las entradas 1, 2, 3 y 4 apuntan **todas al mismo destino** — un caso por
defecto compartido. Quien reconstruya el conmutador desde la tabla no debe leer eso como
cuatro comportamientos distintos.

## 17. Lo que sigue SIN respuesta

Sigo **sin poder decir** si el sobremundo tiene tabla de comportamientos propia. La tabla
del §16 es **de despacho de COMANDO** (23 entradas, indexada por lo que devuelve la lectura
de entrada del bucle), **no de comportamiento de actor**. La pregunta de la §8 sigue
exactamente igual de abierta que antes de esta tanda.
