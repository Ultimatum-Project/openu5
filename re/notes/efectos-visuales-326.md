# Ficha #326 — tres efectos visuales: faro, chispas del campo mágico, revelado de la poción blanca

Acta de derivación del carril `efectos-326`. Sujeto: el BINARIO (`ULTIMA.EXE`,
`DUNGEON.OVL`, `CAST.OVL`/`CAST2.OVL`) y, en cada apartado, qué hace el port hoy.

**Entrega: UNO de los tres cableado (las chispas). El corte y su razón, en §4.**

> **CIERRE (carril fix-326, 17-08, tras caer el bloqueo #256 en b5f98734):** los dos
> derivados restantes quedan CABLEADOS — el faro en §1-bis y la poción blanca en
> §3-bis, con una CORRECCIÓN de mecanismo a §3 (el «radio 0x20» era el argumento
> muerto; el radio real es -1 y esa rama NO floodea: copia el tile crudo).

---

## 0. Lo primero, porque cambia lo que hay que leer: DOS nombres del corpus describen un mecanismo que su cuerpo refuta

Los dos son de la misma familia y se corrigen aquí:

| dónde | dice | y el cuerpo hace |
|---|---|---|
| `lighthouse_light_pulse_anim` (ledger) | pulsa | **gira** (§1) |
| `magic_field_sparkle_drawer` (ledger §46.2/§46.3 de `asm100-censo-acta.md`) | color por PROFUNDIDAD, cuenta por `tile & 7` | **al revés** (§2) |

El encargo de esta ficha heredó el primero («pulso del FARO»), que es exactamente el
modo en que un nombre equivocado se propaga: nadie vuelve al cuerpo porque el nombre
ya contesta la pregunta.

---

## 1. FARO — `ULTIMA.EXE:0x70a6` `lighthouse_beam_rotate_anim`: es un haz que GIRA, y no consume RNG

> **Uso ya el nombre NUEVO.** El renombre lo aplica el lead en su lote (la entrada
> lleva `naming_verified`); hasta que aterrice, el ledger sigue diciendo
> `lighthouse_light_pulse_anim`.

Cuerpo ya sellado por `asm-kernel` tanda 17, que además propuso el renombre a
`lighthouse_beam_rotate_anim` y **no lo aplicó** porque la entrada lleva
`naming_verified` («lo toca el lead o nadie»). Lo re-propongo desde aquí; yo tampoco
lo toco.

Lo que he medido **yo**, no relayado:

- **Llamadas: 9, y las 9 al mismo destino** `0x7040` (el estampador de rayos).
  **Ninguna a `rand_range` (`0x2092`) ⇒ CERO RNG.**
- **Llamador único** `ULTIMA.EXE:0x5951`, dentro de `viewport_redraw`
  (`0x5910`..`0x5a27`) — resuelto con `callers_por_banda.py`, control positivo VERDE,
  y coincide con lo que ya decía el corpus.

Mecánica (de la tanda 17, que confirmo en lo que toqué): 16 rayos de brújula de hasta
15 celdas en la tabla DS `0x1f7e`, y por llamada se **apaga** el rayo de la fase `p` y
se **encienden** los de `p+1`, `p+2`, `p+3` — una cuña de tres rayos de ancho
constante que avanza un dieciseisavo de vuelta por redibujo. El `+3` sale de un `inc
[0x2186]` que está **aguas arriba** del `add ax, 2`; leído sin él da `+2`, que es lo
que decía la cita anterior. Puerta de salida: fase `= 0xff` si `g_light_level >= 0x32`
(día) o si no hay emisor. Los emisores los siembra `TOWN.OVL` barriendo el mapa 32×32
en busca del tile `0x2a` = `LighthouseLight`.

**Port hoy:** el tile 42 existe en `game/src/core/data/TileData.json` y **nadie lo
consume**: no hay emisor de faro en ninguna parte del port. AUSENTE, como decía #278.

🔴 **Por qué NO lo he cableado** (§4): la cuña se estampa en `0xAD14`, que con
`g_location < 0x80` es **la máscara de celdas iluminadas** — o sea que el faro no es
un sprite, es una **fuente de luz que barre**, y entra de lleno en el subsistema de
visibilidad del port. Ahí viven dos fichas ABIERTAS (#252 luz de antorchas, #256 el
puente de visibilidad donde el port es más permisivo que el binario). Cablearlo sin
que ésas se adjudiquen es meter un cuarto escritor en un campo en disputa.

## 1-bis. FARO — CABLEADO (carril fix-326, 17-08; #256 cerrada en b5f98734)

Piezas MEDIDAS por este carril, que faltaban en §1 (todas re-verificadas sobre el
árbol, asm por dispatch con los controles de siempre):

- **La cuña ACUMULA porque `0xAD14` persiste entre redibujos.** 0x5e4a lo wipea
  entero a 0xFF al entrar (`5e59-5e6b`, `repne stosb` 0x400 bytes) — pero su censo
  de llamadores POR BANDA (control positivo del par #158 en verde) da 8 sitios y
  **ninguno es el redibujo**: TOWN.OVL:0x050b (carga de pueblo), MAINOUT (carga de
  overworld), 0x6350/0x6376 (cambio de antorcha/luz), ULTIMA.EXE:0x47df (SOLO si
  una moongate CAMBIÓ el tile — el `[bp-6] != 0` de 0x47d9), CAST2:0x10f4 y SJOG.
  ⇒ el sellado incremental off/on del faro (apaga `p`, enciende `p+3`) es
  consistente, y el conjunto encendido es SIEMPRE `{p, p+1, p+2}` con `p` = fase
  actual — **simulado 48 pasos contra la semántica exacta del buffer: idéntico**
  (ningún rayo comparte celda con sus 3 sucesores; test en
  `game/tests/lighthouse-beam.test.ts`).
- **Emisor del OVERWORLD, que §1 no traía:** OUTSUBS.OVL 0x0267-0x02c2 busca el
  tile **0x1b** (Lighthouse, el edificio) en el chunk activo con un memchr sobre
  0x6608: `x = (idx & 0xf) + 16·bit8`, `y = ((idx & 0xf0) >> 4) + 16·bit9` — UN
  emisor. En pueblos son los DOS primeros 0x2a del barrido de TOWN.OVL (x fuera,
  y dentro), a [0x217e]/[0x2180] y [0x2182]/[0x2184]. En los datos del port: 4
  faros de pueblo (Fogsbane/Stormcrow/Greyhaven/Waveguide, z=2; Waveguide con DOS
  luces = el caso de dos ranuras) y 4 tiles 0x1b en el overworld.
- **Fase congelada por An Tym** (la llamada 0x5951 vive en el bloque que el latch
  [0x5891] se salta, 0x591d/5938) y **reset a 0xff al salir de combate**
  (COMBAT.OVL 0x0d22).
- **Cadencia:** 0x70a6 corre una vez por pasada de viewport_redraw, la MISMA
  pasada que llama a 0x4552 (0x5941/0x5951) — el port ya calibra esa pasada en
  110 ms (fiel/skin.ts, intérprete a mitad del tick base), y el haz la comparte
  (`BEAM_STEP_MS`), sin estrenar constante.

**Port:** `game/src/core/world/lighthouse.ts` (tabla 0x1f7e literal + careo byte a
byte contra DATA.OVL con control positivo; fase; unión de cuña) +
`computeVisibleWindow(…, beamLit)` (visibility.ts: OR en el mismo buffer que los
halos, como 0x7091) + `coreview.ts` (gating/activación en visField, paso por
temporizador `tickBeam`, envolvente ventana±BEAM_REACH con el argumento de
equivalencia de #252, tope de 2 emisores). Cuatro mutantes muertos: cuña de 2
rayos, ejes (dx,dy) invertidos, haz sin fusionar en coreview, y revelado-por-flood
(§3-bis). MIRADA en las dos pieles: el haz barre el mar desde el faro del
overworld (88,120) de noche, y desaparece cuando la cuña apunta a donde su cadena
no toca el disco de la party — la semántica del puente de #256, gratis.

---

## 2. CHISPAS DEL CAMPO MÁGICO — `DUNGEON.OVL:0x127e` (CABLEADO)

Cuerpo entero leído `0x127e`-`0x1346` (204 B = el `size` del ledger; corte validado:
`ret 4` en `0x1346`, relleno `nop`, prólogo nuevo en `0x134a`).

### 2.1 🔴 Los DOS argumentos van al revés de como los cita el corpus

`asm100-censo-acta.md` §46.2/§46.3 y la cita del ledger dicen «COLOR POR PROFUNDIDAD»
y «`bx = (tile & 7) * 2` y la CUENTA sale de la tabla». **Es al revés.** Y el motivo de
que engañe es que **los dos ejes son 0..3**: la profundidad va de 0 a 3 y los tipos de
campo útiles también, así que el `switch` de `0x1292` sobre `0,1,2,3` encaja con
cualquiera de las dos lecturas y la firma no desambigua sola.

**Lo decide el LLAMADOR**, `feature_overlay_drawer_by_nibble`:

```
19f0: cmp word ptr [bp - 2], 8        ; nibble alto == 8
19f6: push word ptr [bp + 4]          ; PRIMER push  = la PROFUNDIDAD
19f9: mov ax, word ptr [bp - 4]
19fc: and ax, 7
19ff: push ax                         ; SEGUNDO push = tile & 7
1a00: call 0x127e
```

Que `[bp+4]` del llamador es la profundidad **no lo pongo yo**: es su propia firma ya
sellada (`(x, y, profundidad)`), y el ledger la usa en el mismo cuerpo para el reloj de
la fuente (`0x1a71: cmp word ptr [bp+4], 0` — «solo con profundidad 0»). En el callee el
**último** empujado es `[bp+4]` ⇒ el `switch` conmuta sobre el **TIPO** y las tablas se
indexan por **PROFUNDIDAD**.

**DISCRIMINANTE INDEPENDIENTE**, que no pasa por el orden de los push y por sí solo ya
cierra la adjudicación: las cuatro tablas viven **contiguas con paso de 8 bytes = cuatro
words cada una** — no ocho, que es lo que pediría `tile & 7` — y sus valores son
**monótonos en la distancia**, que es justo lo que exige la perspectiva:

| tabla DS | qué es | prof 0 | 1 | 2 | 3 |
|---|---|--:|--:|--:|--:|
| `0x2e52` | nº de chispas | 300 | 100 | 50 | 15 |
| `0x2e42` | borde menor de la caja | 16 | 56 | 80 | 92 |
| `0x2e4a` | borde mayor de la caja | 167 | 135 | 111 | 99 |
| `0x2e5a` | longitud del trazo | 7 | 7 | 5 | 2 |

Leídas de `DATA.OVL` con el delta `+0x10`, **con control positivo delante**: la cadena
que el acta de rumor-320 verificó en crudo (DS `0x9548`) sale donde debe.

★★ La lección reutilizable: **cuando dos argumentos tienen el mismo rango, el cuerpo no
los desambigua — hay que ir al llamador, y conviene un segundo discriminante que no
dependa del orden de los push.** Aquí el segundo (extensión y monotonía de las tablas)
es más fuerte que el primero.

### 2.2 El bucle, y el color

```
12c8: cmp word ptr [bx + 0x2e52], 0 / jle  → si la cuenta es <= 0, NO dibuja
12fe: push [lo] ; push [hi - largo] ; call rand   → x
1309: push [lo] ; push [hi]         ; call rand   → y
1315: push si ; push ax ; push (largo + si) ; call draw_hline_clipped
1320: dec di ; jnz
```

Cada chispa es un **trazo horizontal** de `largo` píxeles (el `hline` es inclusivo ⇒
ancho `largo+1`) en una posición sorteada dentro de la caja de su profundidad.

COLOR = global `+8` (el `add ax, 8` de `0x12b7`), por TIPO de campo:
`[0x13b6]=2`, `[0x13b4]=1`, `[0x13ae]=2`, `[0x13b2]=1` ⇒ **10, 9, 10, 9**. Sólo hay dos
colores distintos: en 1988 las cuatro ranuras llevan `2,1,2,1`.
**Control de mi lectura:** `0x13ae` y `0x13b2` ya los había medido —y corroborado
contra vídeo— el careo del goteo (`dungeon-decor.ts`, `GLINT_COLOR` / `DRIP_COLOR`), y
salen los mismos valores. Los otros dos son lectura estática sin corroborar.

### 2.3 RNG: consume, pero NO ACOTADO y por el reloj de pared ⇒ sin ventana

**Dos tiradas de `rand_range` por chispa** — o sea **600 por dibujo** de un campo
adyacente. Y el dibujo se repite en CADA redibujo del pasillo, que en el original es
una vuelta del sondeo de tecla (`dng_getkey`; asm100 §48.1: «la fuente y el goteo se
animan porque el juego está esperando una tecla»). ⇒ el consumo por partida **depende
de cuánto tarde el jugador en pulsar**: no hay cifra que calcar, exactamente el
argumento de la NOTA-frontera de `core/game.ts`.

⇒ El azar del port es de **RENDER**, con la divergencia sancionada §12.11 que
`dungeon-decor.ts` ya declara para el goteo, y **no toca el stream del juego**. Sin
ventana de sellos. Encaja en la **sub-población (1)** de `re/deliberate-divergences.md`
(enmienda a8436cca, en main): consumo no acotado por sondeo de tecla ⇒ PRNG aparte, con
el precedente de #217.

### 2.4 Port: antes y después

`skin/fiel/dungeon.ts` pintaba un `strokeRect` — un rectángulo estático — con un
comentario que ya reconocía que `0x127e` no estaba calcado, y con los colores
`EGA[13,10,12,11]`. Acertaba el EJE (coloreaba por tipo) y fallaba los colores.
Ahora pinta las chispas con las tablas de arriba; sin estado de decorado (packless,
tests deterministas) cae a la primitiva anterior.

Sonda `game/tests/fiel-campo-chispas.test.ts`, 6 asertos. Los dos del EJE instancian la
diferencia **donde existe** (mismo tipo a cuatro profundidades ⇒ mismo color; misma
profundidad con tipo 0 contra tipo 1 ⇒ 10 vs 9), que es lo único que separa la lectura
buena de la invertida. Tres mutantes, los tres muertos: ejes invertidos (5 de 6 asertos
en rojo), ancho `largo` en vez de `largo+1`, y una sola tirada por chispa.

---

## 3. REVELADO DE LA POCIÓN BLANCA — `CAST2.OVL:0x046c`, COMPARTIDO con Wis An Ylem

El acta de rumor-320 (`re/notes/hechizos-inertes-319.md`, **ya en main** desde f398f599 — cuando
empecé esta ficha aún era «acta de rumor en rama ajena»; la atribución queda
actualizada a cita normal) dice que la poción blanca comparte animación con
Wis An Ylem. **Lo he careado con la herramienta, no heredado:** la rama blanca de
`CAST.OVL:0x151b` hace `call 0xffffc17a`, que `dispatch_table` resuelve al stub
`0x80FA` → `CAST2.OVL:0x046c`, que es exactamente la fila que el ledger llama
`white_potion_xray_reveal_anim` (`start` 1132 = `0x046c`) y a la que Wis An Ylem hace
TAIL. Dos controles positivos verdes al lado (`0xffffc16e`→`CAST2:0x0768` y
`0xffffc186`→`CAST2:0x0000`, los dos que el acta acredita por corpus ajeno).

**Diferencia MEDIDA entre los dos usos, que el acta no recoge:** Wis An Ylem hace
`push 6` al despachador de jingle ANTES de saltar; la poción llama **sin push previo**
⇒ **la poción es MUDA y el hechizo suena**. Un port «por analogía» pierde eso.

Cuerpo entero `0x046c`-`0x04c1` (86 B = el `size` del ledger; corte validado con el
`ret` y el prólogo nuevo de `0x04c2`):

```
0473..0495  push -1 ; push (party_x − chunk_origin_x) ; push (party_y − chunk_origin_y)
            push 0x20 ; call vis_buffer_build      ; 0x20 = 32 = el chunk ENTERO   ← ERRATA, ver 🔴
0498        [bp-2] = 0x14        ← local MUERTO (nunca se lee; el contador es si)
049d        si = 0x14            ← VEINTE fotogramas
04a0  bucle: if (g_time_spell != 0x54) call 0x4552   ; CONDICIONAL
04aa         call compose_world_view ; call viewport_compose_11x11
04b0         push 1 ; call delay_ticks_int1c          ; espera UN fotograma
04b7         dec si ; jne bucle
04ba        call viewport_redraw                      ; restaura
```

🔴 **CORRECCIÓN de mecanismo (carril fix-326, 17-08, leyendo 0x5d0a entero):** la
anotación `0x20 = el chunk ENTERO` estaba MAL — el `push 0x20` es el **4º argumento
MUERTO** del flood (el paso, que 0x5A28 lleva cableado con `shl 5`; ya estaba
declarado muerto en la cabecera de visibility.ts). Lo que hace visible el mapa es
**el `push -1`: el RADIO**. 0x5d0a lo gatea con SIGNO (`5d45 cmp [bp+0xa],0; jle`)
— radio ≤ 0 **SE SALTA EL FLOOD**, y la rama de radio negativo (`5d8f jge` →
`5d95-5df3`) recorre las 121 celdas de la ventana y **copia el TILE CRUDO del mapa**
(0x4402) al buffer. No hay LOS ni radio: es la ventana ENTERA, **salas selladas
incluidas** — por eso el ledger lo llama `xray`. Un port que «subiera la luz»
(computeVisibleWindow con radio ∞, que era lo que §3 sugería) se quedaría CORTO:
el flood no cruza muros y un recinto sellado seguiría a oscuras.

O sea: **copia el mapa crudo a la ventana (rayos X), repinta veinte
fotogramas, y restaura.** Los seis destinos son near-calls al kernel resueltos con la
base `0xe1e0` de `dispatch_table`, y coinciden uno a uno con la tabla del acta 319.

**RNG:** `0x4552` sí tira — verificado por mí, tres sitios (`0x4625`, `0x466d`,
`0x469f`) llamando a `0x2092`. **Pero** el censo de llamadores por banda de `0x4552` da
tres: este bucle (`CAST2:0x04a7`), `FONT.OVL:0x0304` y `ULTIMA.EXE:0x5941` — y `0x5941`
vive **dentro de `viewport_redraw`** (`0x5910`..`0x5a27`). ⇒ es el **mismo consumo
por-redibujo** que la NOTA-frontera de `core/game.ts` ya declara como no modelado por el
port. Cablear el revelado **no estrena una clase**: usa la que ya está declarada, y por
tanto tampoco pide ventana.

**Port hoy:** `core/usePotion.ts:82-87` devuelve `{ message: "", ok: true }` con la
Clase-C escrita al lado («animación de mapa no portada»). El gate `location < 0x21` es
fiel.

🔴 **RETIRO MI PROPIA RAZÓN DE CORTE, y la dejo escrita porque es del mismo género que
lo que corrige esta ficha.** Escribí primero que no lo cablaba porque «el efecto es una
vista modal que la fiel pinta desde un descriptor propio ⇒ clase #253, ABIERTA». **Es
FALSO, y lo refuta el árbol:** la censura por visibilidad **no la pinta ninguna piel**
— la hornea el CORE. `skin/coreview.ts:1106` llama a `computeVisibleWindow(light, …)`
**una sola vez** y las dos pieles reciben la ventana ya censurada (`skin/api.ts:685`:
«la piel … compone la censura ya horneada en `window`»). ⇒ el revelado se cablea
**subiendo el `light` de esa única llamada durante 20 fotogramas**, y las DOS pieles lo
enseñan sin tocar ninguna de ellas. La clase #253 **no aplica aquí**, y quien heredara
mi frase anterior habría dejado el efecto parado detrás de un bloqueo inexistente.

Lo que de verdad queda es **cableado**, no decisión: paceo de los 20 fotogramas (patrón
`RefugeScript` / el sueño paceado de #296) y la subida temporal del `light` con su
restauración. **No lo terminé por presupuesto de contexto de este carril, no porque
esté bloqueado** — y ésa es la razón honesta, no la que escribí antes.

🔴 Y al cablearlo: **la poción NO suena** (el `push 6` del jingle es del hechizo, no de
ella). Va con negativo, para que nadie le preste el cue de Wis An Ylem «por analogía».

## 3-bis. POCIÓN BLANCA — CABLEADA (carril fix-326, 17-08)

- **Mecanismo del port** (con la corrección de §3, y UNIFICADO en la confluencia
  con #319 el 17-08): la poción reusa `CoreViewImpl.revealViewport` — la primitiva
  que Wis An Ylem estrenó en main (766cd5f8) para la MISMA rutina 0x046c a la que
  el hechizo hace TAIL. Las dos ramas de la confluencia llegaron a la rama -1 de
  0x5d0a por careo INDEPENDIENTE con el mismo veredicto (su «DATO NUEVO» = mi
  corrección de §3). Mientras `revealUntil` no expira, `visField` devuelve null
  (sin censura — NO un flood con radio grande). Lo pacea `main.ts::runMapReveal`:
  `DEATH_VISION_FRAMES` (0x14, cast.ts, constante única EN CRUDO) ×
  `PAUSE_UNIT_MS` (55, world-fx.ts) y al expirar el siguiente horneado re-censura
  (el viewport_redraw de 0x04ba). El bucle del binario no lee teclado ⇒ flag
  modal `revealing` que traga input, como refuge/troll — SOLO en la poción: para
  el hechizo, la no-modalidad sigue DECLARADA como divergencia (a) de su acta
  (#319 §5); unificarla es follow-up de aquel carril.
- **MUDA**: ni cue ni jingle (negativo en la suite: onDirty 2, onSfx 0).
- **El testigo que separa las dos mecánicas** (y mata al mutante «flood con radio
  ∞»): una SALA SELLADA — inalcanzable para el flood con cualquier radio, visible
  con la copia cruda. `game/tests/lighthouse-reveal-cableado.test.ts`.
- Gate `location < 0x21` intacto (usePotion.ts); con `ok=false` no hay revelado.
  El haz del faro NO avanza durante el revelado (el bucle de 0x04a0-0x04b8 no
  pasa por 0x5910).
- MIRADA en las dos pieles: planta baja de Greyhaven a las 23h — antes, disco de
  radio 2; durante ~1,1 s, el mapa entero con NPCs y mobiliario; después, disco
  otra vez. (El 1/16 del reroll cayó en la primera captura: «Slept!» — el fiasco
  de la naranja, fiel él también.)

---

## 4. EL CORTE, y por qué

El encargo dice «3 completos mejor que 5 a medias» y manda declarar el corte. Entrego
**uno completo** (§2) y **dos derivados con diseño** (§1, §3). La razón no es de tiempo:
es que los dos que no cablé **desembocan cada uno en una ficha ABIERTA de otro carril**,
y el trabajo que falta en ambos es una decisión de subsistema, no una transcripción:

- **faro → visibilidad.** Estampa en el buffer de luz `0xAD14`. Fichas vivas #252 y
  #256. Lo que falta no es leer el binario (está leído): es dónde vive el campo de luz
  del port cuando esas dos se adjudiquen.
- **poción → clase #253.** Vista modal fiel-que-la-shader-no-conoce. Lo que falta es el
  remedio de clase que #253 pide.

Con las dos derivaciones de arriba, cualquiera de los dos se cablea sin volver al
desensamblado.

> **17-08:** hecho — los dos cableados por el carril fix-326 (§1-bis y §3-bis), con
> #256 ya cerrada. La predicción de este párrafo se cumplió a medias: el faro sí
> se cableó sin volver al desensamblado *de 0x70a6*, pero hubo que volver al de
> **0x5d0a** (la corrección de §3) y al censo de llamadores de **0x5e4a** (la
> persistencia de 0xAD14) — lo que faltaba no estaba en las rutinas leídas, sino
> en sus vecinas.

## 5. Cabos medidos y NO adjudicados

- Los cuatro globales de color del campo dan `2,1,2,1`, o sea **sólo dos colores para
  cuatro tipos**. Es lo que hay en `DATA.OVL`; no he censado si algún camino los
  reescribe en runtime (dos de los cuatro sí están corroborados contra vídeo por el
  careo del goteo, §2.2). Quien vea tres o cuatro colores distintos en una grabación
  real, que reabra esto.
- El `[bp-2] = 0x14` del revelado y los `[bp-6]`/`[bp-4]` de las chispas son **locales
  muertos** — el mismo patrón de compilador que `fountain_vector_drawer` (asm100 §47.3),
  donde el literal muerto resultó ser un oráculo útil. Aquí no aportan: el contador real
  es `si` en los dos.
