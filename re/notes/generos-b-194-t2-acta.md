# #142 — GÉNERO «COMILLA LITERAL»: adjudicación de los sapos y lint transversal

Carril `generos-b-194` (parte 2 del encargo doble; la parte 1, #194 «docblock rancio»,
está en `generos-194-acta.md` y ya aterrizó en main como `f985dcbb`).
Rama `re/generos-194`, RETENIDA. Árbol base: `main@f557864a`.

**Titular**: el género existe y hay **cinco sapos vivos y emitidos**, pero el hallazgo
que transfiere es del instrumento — **la mitad de la puntuación de este binario no vive
en las cadenas, vive en `putchar`**. El lint cruza un corpus de CADENAS contra el port,
así que un candidato «el port se inventa comillas» puede ser exactamente lo contrario:
el port fiel y el corpus ciego. De los diez candidatos de la población, **cinco quedan
ABSUELTOS por esa vía** y sólo dos son sapos.

Segundo hallazgo, del mismo tamaño y no previsto: **dos de los diez cuelgan de un campo
`message:` que ningún consumidor lee**, con su hermano FIEL ya cableado al lado. El
extractor recoge literales con FORMA de mensaje, no emisiones — «candidato del lint» y
«divergencia que ve el jugador» son poblaciones distintas.

---

## 1. Rescate: de dónde sale este carril

El worktree traía **un fichero sin commitear**, `game/tests/comilla-literal.test.ts`
(144 líneas): el lint de esta parte 2, esencialmente terminado por el carril anterior,
que murió por límite de cuenta **entre escribir el test y escribir el acta** (el
docblock y el mensaje del trinquete remitían a un `generos-194-t2-acta.md` que no existe
ni en la rama ni en main). Se ADOPTA. Lo que aportaba y se conserva: los dos extractores
compartidos como fuentes, el criterio de «la diferencia incluye al menos una comilla»
con su cifra (10 contra 265), la congelación por TEXTO y no por `fichero:línea`, y los
dos controles.

Lo que traía MAL y se corrige aquí:

| defecto del borrador | qué era | cómo se detecta |
|---|---|---|
| clave `'"Anything else?'` | llevaba la comilla del BINARIO en una clave que se compara contra el texto del PORT | el trinquete salía ROJO: 1 alta (`Anything else?`) + 1 baja |
| cita `DS 0x7bd8` | el offset no corresponde a esa cadena | §2: la cadena está en DS 0x79a2, y así lo dice ya `cmd-strings.ts:357` |
| clase «(b) el port INVENTA comillas» (3 casos) | veredicto de infidelidad | §3.C: las comillas son `putchar(0x22)` — el port es FIEL |
| clase «(c) DESALINEADAS» (2 casos) | veredicto de infidelidad | §3.D: la apertura es una cadena propia impresa siempre |

Ninguna de las cuatro se habría visto sin bajar al ASM: el trinquete sólo cazó la
primera, que era la de forma.

---

## 2. La convención de cita, derivada antes de usarla

Este acta cita `DS 0xNNNN`. Esa no es la posición en el fichero: **DS = fileoff de
`DATA.OVL` − 0x10**. No se hereda, se deriva, y el control es que **seis citas previas
del repo, escritas por carriles distintos, caen todas exactamente sobre ese sesgo**:

| cadena | fileoff medido | DS que ya citaba el repo | fuente de la cita previa |
|---|---|---|---|
| `"Anything else?\n\n` | 0x79b2 | 0x79a2 | `cmd-strings.ts:357` |
| `Thy friend has died, by the way."\n` | 0x5015 | 0x5005 | tarjeta #142 |
| `\n\n"No one here is from thy party!"\nsays $.\n\n` | 0x4f8a | 0x4f7a | tarjeta #142 |
| `\n\n"What didst thou say?` | 0x9460 | 0x9450 | tarjeta #142 |
| `"\n\n"CAN'T PAY?\nBeat it!"\nyells ` | 0x9b06 / 0x9c30 | 0x9af6 / 0x9c20 | borrador de la parte 2 |
| `\nEnjoy!"\n\n` / `\nEnjoy!"` | 0x9b26 / 0x9c50 | 0x9b16 / 0x9c40 | tarjeta #142 (sapos-120b) |

Seis de seis. Todas las cadenas de este acta se han leído **de los bytes de
`original/u5/ultima5/DATA.OVL`**, no del corpus extraído: el asset es el volcado del
binario y citarlo para probar el binario sería circular (familia de
`exclusion-circular-corpus-del-catalogo`).

### 2.1 ⚠ DOS CEROS EN FALSO PROPIOS, declarados

Buscando el productor de `Come again!` mis dos primeros barridos dijeron **que la cadena
no existe en el original**. Las dos veces era el instrumento:

1. Un bucle sobre `original/u5/ultima5/*.OVL *.EXE *.DRV` — extensiones enumeradas a
   mano. La cadena vive en **`SHOPPE.DAT`**. Es literalmente el género de #208.
2. `grep -rl "Come again" original/u5/ultima5/` → **exit 1, salida vacía**. El grep de
   macOS **salta los ficheros binarios en recursivo** y no lo dice. Con `-a` aparece al
   primer intento:

   ```
   grep -rl → (vacío), exit 1
   grep -al → original/u5/ultima5/SHOPPE.DAT, exit 0
   ```

De haber firmado cualquiera de los dos habría escrito «el port se inventó `Come again!`»,
que es una fabricación. Lo que lo salvó no fue el olfato sino ir a los bytes: `SHOPPE.DAT`
lleva en el registro 6, **fileoff 0x0076**, los bytes ASCII sin comprimir
`Come again!"` con su comilla de cierre. Se apunta al catálogo de ceros en falso junto a
`grep -r` sobre symlinks y al de `git grep -E` ignorando la frontera `\b` (cero-en-falso).

★ Y la guarda de #114 mordió esta misma acta al escribirla: la frase de arriba, en su
primera redacción, era exactamente la forma prohibida y `test_frontier.py` la paró. Es el
control positivo del gate corriendo sobre material nuevo y untracked — el que #114 dejó
cableado con `--cached --others` justo para esto.

---

## 3. Los DIEZ candidatos del lint, adjudicados uno a uno

Población medida en `main@f557864a`: `bin.size` 5149 · `live.size` 867 · **candidatos 10**.

### 3.A SAPO VIVO Y EMITIDO (2) — ★ LOS DOS, ARREGLADOS EN §8 (carril `sapos-142`)

**`Thy friend has died, by the way.`** — `shops.ts:538` (`innPickup`), emitido en
`shop-console.ts:1919` (`this.deps.message(r.message)`).

| offset | instrucción | qué es |
|---|---|---|
| `SHOPPES3.OVL:0x085f` | `mov ax, 0x5005` | carga el ptr de la cadena |
| `SHOPPES3.OVL:0x0862` | `jmp 0x88b` | salta al `push`/`print` compartido |
| `SHOPPES3.OVL:0x088b` | `push ax` / `call 0x3670` | imprime |

DS 0x5005 = `Thy friend has died, by the way."\n` — **cierra comilla y el port la poda**.
La de APERTURA no falta: la trae el mensaje anterior, DS 0x4fe1
(`\n\n"That will be % gold, please."\n\n"`), que **termina** en `\n\n"`. Es el patrón de
la posada multi-mensaje ya fichado en #145/#155.

**`I thank thee!`** — `commands.ts:249` (`jimmyLock`, rama `freed`), emitido en
`game.ts:3639`.

| offset | instrucción | qué es |
|---|---|---|
| `SJOG.OVL:0x0eb5` | `mov byte ptr [si + 0x5d5e], 5` | libera al prisionero (los tres campos) |
| `SJOG.OVL:0x0ec4` | `mov ax, 0x8b36` / `call 0x58d0` | imprime `\n"I thank thee!"\n` |
| `SJOG.OVL:0x0ed3` | `call 0x7f70` | `add_capped(&g_karma, 2, 0x63)` |

DS 0x8b36 = `\n"I thank thee!"\n`, con **las dos comillas**. ★ Y el propio `game.ts:3639`
**cita `DS 0x8B36` en el comentario de la misma línea** que emite la forma podada: la
cita correcta al lado del valor equivocado, que es exactamente la firma de #133.

Ojo con el homónimo: hay una SEGUNDA cadena `I thank thee!` en el binario, DS 0x7988
`\n"I thank thee!"\nsays $.\n` (tienda, SHOPPES 0x063d). La que corresponde a `jimmyLock`
es la de SJOG, sin atribución — derivado por el cuerpo, no por el parecido.

### 3.B SOMBRA: literal que NADIE emite, con el hermano FIEL ya cableado (2)

| candidato | dónde | por qué NO es divergencia hoy |
|---|---|---|
| `Anything else?` | `shops.ts:712` (`buyProvisions`) y `:941` (`buyRations`) | `buyProvisions` **no tiene ningún consumidor en `game/src`** (sólo `game/tests/shops.test.ts`); de `buyRations` la UI lee `r.bought`/`r.full` y **nunca `r.message`**. La forma FIEL, `SHOP_UI.reagentAnythingElse` = DS 0x79a2 `"Anything else?\n\n` (emisor SHOPPES 0x0644), ya está cableada en `shop-console.ts:1751` |
| `Hrumph.` | `shops.ts:940` (`buyRations`) | mismo motivo; la FIEL `SHOP_UI.tavernHrumph` = DS 0x9c6a `\n\n"Hrumph."` (emisor SHOPPES2 0x0422) se emite en `shop-console.ts:2305` |

No se arreglan ni se dan por sapos: **nada llega al jugador**. Sí quedan apuntados,
porque son un campo con texto no fiel esperando a que alguien lo enchufe, y porque
ensucian el manifiesto por partida doble (`es.json` tiene traducidas **las dos** formas
de «Anything else?»: la fiel y la podada).

### 3.C ABSUELTO — las comillas son `putchar`, no bytes de la cadena (3)

Los tres emisores viven en `TALK.OVL` y tienen la misma forma: `putchar('"')`,
`print_string(cadena)`, `putchar('"')`. `call 0x573a` = putchar (kernel 0x16ba) y
`call 0x58d0` = print_string (kernel 0x1850); las dos identificaciones son del repo y de
tres notas independientes (`cmds.md:370`, `derivaciones-152-acta.md:235`, ledger).

**`"Pass, friend!"`** — `guard-encounters.ts:114`:

| offset | instrucción | qué es |
|---|---|---|
| `TALK.OVL:0x02f2` | `mov ax, 0xa` / `call 0x573a` | `putchar('\n')` |
| `TALK.OVL:0x02f9` | `mov ax, 0x22` / `call 0x573a` | **`putchar('"')` — apertura** |
| `TALK.OVL:0x0300` | `mov ax, 0x913a` / `call 0x58d0` | `Pass, friend!` (DS 0x913a, sin comillas) |
| `TALK.OVL:0x0307` | `mov ax, 0x22` / `call 0x573a` | **`putchar('"')` — cierre** |
| `TALK.OVL:0x030e` | `mov ax, 0xa` / `call 0x573a` | `putchar('\n')` |

**`"Don't hurt me!\nPlease go away!"`** — `game.ts:4384`:

| offset | instrucción | qué es |
|---|---|---|
| `TALK.OVL:0x03a6` | `cmp word ptr [bp - 2], 0xfd` | gate por `dialogNumber` 0xFD (el mismo de #130) |
| `TALK.OVL:0x03ad` | `mov ax, 0x22` / `call 0x573a` | `putchar('"')` |
| `TALK.OVL:0x03b4` | `mov ax, 0x9176` / `call 0x58d0` | DS 0x9176, sin comillas |
| `TALK.OVL:0x03bb` | `mov ax, 0x22` / `call 0x573a` | `putchar('"')` |
| `TALK.OVL:0x03c2` | `mov ax, 0xa` / `call 0x573a` | `putchar('\n')` |

**`"Thou hast not enough gold!"`** — `effects.ts:105`:

| offset | instrucción | qué es |
|---|---|---|
| `TALK.OVL:0x0657` | `mov ax, 0x22` / `call 0x573a` | `putchar('"')` |
| `TALK.OVL:0x065e` | `mov ax, 0x9328` / `call 0x58d0` | DS 0x9328, sin comillas |
| `TALK.OVL:0x0665` | `mov ax, 0x22` / `call 0x573a` | `putchar('"')` |
| `TALK.OVL:0x066c` | `mov ax, 0x9344` / `call 0x58d0` | DS 0x9344 = `\n\n`, espaciado (#108) |

★ **Y el port ya lo tenía escrito**: `effects.ts:102-104` dice literalmente «las comillas
son chars impresos (0x22 vía 0x573a), van en el literal». O sea que el borrador estaba
acusando de fabricación a una línea cuyo comentario, dos renglones más arriba, contenía
la refutación. Es el mismo error de #194 §3.2, ahora en la otra dirección: allí se
refutó un docblock leyendo el cuerpo equivocado, aquí se iba a condenar un literal sin
leer el comentario que lo justificaba.

### 3.D ABSUELTO — puntuación COMPUESTA de fragmentos (2)

El guardián del santuario imprime la apertura **siempre**, como cadena propia, antes de
ramificar:

| offset | instrucción | qué es |
|---|---|---|
| `MAINOUT.OVL:0x0ca6` | `mov ax, 0x2b6b` / `call 0xffff9680` | DS 0x2b6b = `\n"` — **la apertura, en las DOS ramas** |
| `MAINOUT.OVL:0x0cad` | `cmp byte ptr [g_shrine_quest_bitmap], 0` / `je 0xcbe` | el discriminador |
| `MAINOUT.OVL:0x0cb4` | `mov ax, 0x2b6e` / `call 0xffff9680` | `Pass, Seeker!"\n` |
| `MAINOUT.OVL:0x0cbe` | `mov ax, 0x2b7e` / `call 0xffff9680` | `Thou art not upon a Sacred Quest!\n` |
| `MAINOUT.OVL:0x0cc5` | `mov ax, 0x2ba1` / `call 0xffff9680` | `Passage denied!"\n` |
| `MAINOUT.OVL:0x0ccc` | `inc byte ptr [g_party_y]` | el empujón al sur |

`\n"Pass, Seeker!"\n` = 0x2b6b + 0x2b6e, exacto. Y `\n"Thou art not upon a Sacred Quest!\n`
= 0x2b6b + 0x2b7e, **y el cierre no falta**: el port emite `Passage denied!"\n` como
mensaje aparte en `shrine-ceremonies.ts:167`. Los dos FIELES.

★ Nota de método, porque estuve a punto de escribir lo contrario: al ver la comilla sin
pareja formulé la hipótesis de que el port se comía el fragmento 0x2ba1 y la iba a
anotar como hueco nuevo. Existe, y está emitido. **La comilla descuadrada era la pista
de una composición, no de una poda.** Este par lo derivé del ASM antes de mirar el port,
y al mirarlo resultó que su docblock (`shrine-ceremonies.ts:158-162`, crédito a F2-T9 del
espejo) ya decía lo mismo: es un control positivo de mi propia lectura.

### 3.E DEGRADACIÓN SOLO-PORT (1)

**`Come again!`** — `SHOP_UI.farewell`, emitido en `shop-console.ts:2404/2409`
**sólo cuando faltan el pool de assets o los nombres de tendero/tienda**. La vía normal
compone `farewellQuoteOpen` (`\n\n"`, DS 0x7854/0x7858) + la plantilla de `shoppe.json`,
que **trae su propia comilla de cierre** (`SHOPPE.DAT` registro 6, fileoff 0x0076). No
hay conducta del binario que calcar en esa rama porque el original no la tiene: el
literal es un `legacyHeader` declarado, no un sapo de fidelidad.

---

## 4. Los sapos NOMBRADOS en #142, y el estado de cada uno

La tarjeta titula «7 sapos» y su cuerpo enumera cinco. Se pueden nombrar siete, pero
**no afirmo que sean los siete que el autor tenía en la cabeza**: la cuenta cuadra y
cuadrar no es prueba (precedente `prediccion-numerica-cuadra-por-casualidad`). Lo que sí
está medido es el estado de cada uno hoy:

| # | sapo | dónde | DS | estado |
|---|---|---|---|---|
| 1 | `No one here is from thy party!` | `shops.ts:522` | 0x4f7a | **VIVO, EMITIDO** — faltan las 2 comillas y la atribución `\nsays $.\n\n` |
| 2 | `Thy friend has died, by the way.` | `shops.ts:538` | 0x5005 | ✅ **ARREGLADO** (§8) — faltaba la comilla de cierre |
| 3 | `What didst thou say?` | `conversation.ts:163` | 0x9450 | **VIVO, EMITIDO** (`textBuf`, :851) — falta `\n\n"` de apertura (el original NO cierra) |
| 4 | `CAN'T PAY? Beat it!` | `shops.ts:839` | 0x9af6 / 0x9c20 | **VIVO, EMITIDO** (`shop-console.ts:2238`) — faltan comillas, la atribución `\nyells ` y el `\n` INTERNO está APLANADO a espacio |
| 5 | `I thank thee!` | `commands.ts:249` | 0x8b36 | ✅ **ARREGLADO** (§8) — faltaban las 2 comillas (§3.A; lo aporta el lint, no estaba en la tarjeta) |
| 6 | `"Nay!"` | — | 0x425e | **YA ARREGLADO** en #130 (`21c92b7b`), patrón de referencia |
| 7 | `\nEnjoy!"` | `cmd-strings.ts:412/417` | 0x9c40 / 0x9b16 | **YA ARREGLADO en main** — las dos formas fieles existen y se consumen (`shop-console.ts:1885` y `:2238`). La tarjeta lo daba por «empezado, no concluido»; hoy está concluido |

★ El caso 4 es el más completo del género: reúne las **tres** patologías del título de la
tarjeta —puntuación, atribución y aplanado— en un solo literal. Y su propia función se
contradice: `buyTavernRound` devuelve `SHOP_UI.roundEnjoy` (la constante FIEL con su DS)
en la rama de éxito y una cadena a pelo en la de fallo, dos ramas del mismo `return` con
dos políticas distintas.

Las claves FIELES de 1, 3 y 4 **ya están en `es.json` traducidas** (`:134`, `:4644`,
`:4929`), exactamente como decía la tarjeta: son las huérfanas del detector #47/#86.

---

## 5. ⛔ POR QUÉ NO HE ARREGLADO NINGUNO

> ★ **VIGENCIA**: esta sección describe el carril `generos-b-194`, que efectivamente no
> arregló ninguno. Los DOS de §3.A sí están arreglados desde el carril `sapos-142`; ver
> §8. Los otros tres (§4 filas 1, 3 y 4) siguen vivos y sin dueño.

Los cinco vivos son **strings VIVOS del manifiesto en `game/src`**. La instrucción del
encargo es parar y reportar en ese caso, y eso es lo que se hace: **cero valores de
aserción tocados, cero literales de `game/src` tocados**. El diff de este carril es un
test nuevo y este acta.

Lo que hace falta para arreglarlos, por si el lead abre la ventana: cada uno es
literal-verbatim + `failing-first`, y **los cuatro de la tabla anterior con clave fiel ya
en `es.json` no necesitan alta de traducción**, sólo que el emisor pase a la forma
completa. El caso 4 además exige decidir dónde se pone `yells ` + el nombre del tendero
(hay expansor `$` en el binario y `tf()` en el port), así que no es sustitución ciega.

---

## 6. El LINT: `game/tests/comilla-literal.test.ts`

**Parametrización, no escáner paralelo.** Los dos lados son los extractores que ya
existen: `extractUserStrings()` (el del `string-manifest`) y `buildCorpusBySurface()` (el
del `data-strings-manifest`). Si alguien añade un sink al primero, este lint lo hereda el
mismo día sin tocarlo.

**Criterio**: literal del port que, recortando comillas y saltos de los dos bordes, casa
con una cadena del binario distinta de él **y la diferencia incluye al menos una
comilla**. Sin esa última condición el censo pasa de 10 a **265**, porque el `\n` final
lo pone el impresor y el port lo omite a propósito (#108): sería medir la política del
impresor, no este género.

**Los cuatro casos y qué prueba cada uno**:

1. CONTROL POSITIVO — el emparejador dispara sobre `Thy friend has died, by the way.`,
   con guarda previa `expect(bin.has(...)).toBe(true)` para que un corpus vacío no dé
   verde degenerado.
2. CONTROL NEGATIVO — `Blocked!` (difiere sólo en el `\n`) NO dispara, con la misma
   guarda de no-degeneración.
3. Cotas de no-vacío de los dos corpus.
4. TRINQUETE — la población es exactamente la adjudicada, por ALTAS y por BAJAS.

**El trinquete VISTO SUSPENDER, en las dos direcciones** (un control negativo no valida
un guarda; hay que verlo ponerse rojo):

| experimento | resultado |
|---|---|
| retirar `Hrumph.` de `ADJUDICADOS` | ROJO, y nombra el caso exacto: `core/shops/shops.ts:940 port="Hrumph." bin="\n\n\"Hrumph.\""` |
| añadir una entrada fantasma | ROJO por la otra rama: `BAJAS no anotadas: [ '__FANTASMA_B__' ]` |
| restaurado | VERDE, 4/4 |

**Lo que el lint NO ve, declarado en su propio docblock** (y medido, no supuesto):

- La puntuación emitida por `putchar` — §3.C. Es el límite estructural: el lado binario
  es un corpus de CADENAS.
- La composición de fragmentos — §3.D.
- La sub-familia de ATRIBUCIÓN: al comerse un trozo (`\nsays $.`, `\nyells `) el recorte
  de bordes ya no empareja ⇒ se le escapan los sapos 1 y 4.
- El HOMÓNIMO en otra superficie: el sapo 3 no sale porque `talk/castle.json#text` lleva
  `What didst thou say?` suelto como línea de un NPC, y el lado binario es un conjunto
  plano.
- Si el literal se EMITE o no — §3.B.

De los sapos nombrados, **ve uno de cinco**. Su valor no es el recall: es que la
población queda congelada y ningún alta puede colarse en silencio.

---

## 7. Cabos que este carril deja apuntados

1. **Los cinco sapos vivos, sin arreglar** (§4/§5), con dueño pendiente de ventana.
2. **Las dos sombras de §3.B**: campos `message:` con texto no fiel que nadie lee. Hoy
   inocuos; el día que alguien enchufe `buyProvisions` a la UI se convierten en
   divergencia sin que ningún gate se entere. Y hoy ya duplican entrada en `es.json`.
3. **`buyTavernRound` con dos políticas en el mismo `return`** (§4): una rama cita la
   constante fiel con su DS, la otra lleva la cadena a pelo.
4. ★ **El género hermano que este lint no puede ver y alguien debería**: puntuación
   emitida por `putchar` alrededor de un `print_string`. Es enumerable — `mov ax,0x22` /
   `call <putchar>` adyacente a un `call <print_string>` — y da la lista de literales del
   port que DEBEN llevar comillas aunque su cadena no las tenga. Sería el control
   positivo que le falta a la clase §3.C, que hoy se sostiene en tres lecturas a mano.
5. **`grep -rl` salta binarios en silencio** (§2.1). Vale para cualquier barrido futuro
   sobre `original/`: sin `-a`, un cero no es un cero.

---

## 8. CIERRE DE LOS DOS SAPOS DE §3.A — carril `sapos-142`, rama `fix/sapos-142`

Encargo: arreglar los dos sapos que §3.A dejó adjudicados. **Hechos los dos**, con la
forma VERBATIM del binario y siguiendo el patrón de tres capas de #130 (`21c92b7b`).

### 8.1 ⚠ El encargo nombraba mal el segundo, y se comprueba por CONTENIDO

El encargo decía que los dos sapos vivos eran `Thy friend has died…` y **los «Enjoy!"»**
(DS 0x9b26/0x9c50). Eso NO es lo que dice el acta: su §4 fila 7 da el `\nEnjoy!"` por
**ya arreglado en main**, y el segundo sapo de §3.A es `I thank thee!`. Verificado en
main@67696ac6 antes de tocar nada, por bytes y por código:

| forma | bytes de `DATA.OVL` | literal del port | veredicto |
|---|---|---|---|
| DS 0x9c40 (fileoff 0x9c50) | `\nEnjoy!"` | `cmd-strings.ts:412 wineEnjoy` = `'\nEnjoy!"'` | **YA FIEL** |
| DS 0x9b16 (fileoff 0x9b26) | `\nEnjoy!"\n\n` | `cmd-strings.ts:417 roundEnjoy` = `'\nEnjoy!"\n\n'` | **YA FIEL** |

Y los dos se consumen (`shops.ts:845/860/906` → `shop-console.ts:1885/2236`). Se arregla
por tanto lo que el ACTA adjudicó, no lo que el encargo enumeró.

### 8.2 Los dos fixes, con los bytes leídos del binario (no del corpus)

| # | literal ANTES | literal AHORA | cita |
|---|---|---|---|
| 1 | `"Thy friend has died, by the way."` | `'Thy friend has died, by the way."\n'` | DS 0x5005 = fileoff 0x5015 |
| 2 | `"I thank thee!"` | `'\n"I thank thee!"\n'` | DS 0x8b36 = fileoff 0x8b46 |

Señas del ASM re-verificadas una a una contra `re/disasm/` (no heredadas del acta):

- `SHOPPES3.OVL` `0x0850 cmp byte [bx+0xb],0x50` ('P') → `0x0856 mov byte [bx+0xb],0x44`
  ('D') → `0x085f mov ax,0x5005` → `0x0862 jmp 0x88b` → `0x088b push ax / call 0x3670`.
- `SJOG.OVL` `0x0eb5/0x0eba/0x0ebf`, los tres campos a 5 → `0x0ec4 mov ax,0x8b36 /
  call 0x58d0` → `0x0ed3 call 0x7f70` (karma +2 capado a 0x63).

### 8.3 Las tres capas (patrón #130)

- **TEXTO**: los dos literales, verbatim.
- **CORPUS**: en `approved-strings.json` las claves PODADAS salen y entran las FIELES con
  cita `[D]` de offset + emisor. En `es.json` se dan de baja las dos claves podadas
  (`"I thank thee!"` y `"Thy friend has died, by the way."`): **las fieles ya existían,
  traducidas y `reviewed: true`** (`\n"I thank thee!"\n` y `Thy friend has died, by the
  way."\n`), así que NO hay alta de traducción, sólo bajas. Sin la baja, el gate
  anti-fabricación de `i18n-manifest.test.ts` se pone rojo nombrando las dos: es él quien
  obliga a la simetría, no una decisión de estilo.
- **ARNÉS**: `jimmy-prisoner.test.ts` pasa a esperar la forma fiel en sus tres asertos
  (uno de ellos negativo). Ningún aserto se relajó: los tres comparan contra la cadena
  COMPLETA.

### 8.4 El lint, y su control positivo INTACTO

Las dos entradas salen de `ADJUDICADOS` en el mismo commit, como manda el protocolo del
propio fichero. **El bloque (A) queda vacío y eso NO desarma el test**: su control
positivo alimenta al emparejador con la forma podada SINTÉTICA (`new Map([[sapo, …]])`),
no con el literal del port, así que sigue disparando después del fix.

Trinquete VISTO SUSPENDER en las DOS direcciones, con la lista ya recortada:

| experimento | resultado |
|---|---|
| ADJUDICADOS recortado y fuente SIN arreglar (failing-first) | ROJO por ALTAS, nombrando los dos: `core/world/commands.ts:249 port="I thank thee!" bin="\n\"I thank thee!\"\n"` y `core/shops/shops.ts:538 …` |
| entrada fantasma `__FANTASMA_142__` | ROJO por BAJAS (EXIT 1) |
| estado final | VERDE 4/4 (EXIT 0) |

### 8.5 ★ DOS HALLAZGOS NUEVOS en la MISMA rutina, NO arreglados (son de #155)

Leyendo entera la rutina `SHOPPES3 0x0850-0x0893`, y no sólo la instrucción citada, aparecen dos
divergencias que el acta no recoge porque el lint no puede verlas (sub-familia de
ATRIBUCIÓN, §6):

1. **La atribución se pierde en las DOS ramas.** Las dos convergen en `0x088b`, y justo
   después `0x088f mov ax,0x5055 / push / call 0xffff9d8e` imprime DS 0x5055 = `says $.\n\n`
   con el expansor `$`. O sea que el original remata SIEMPRE con «says <tendero>.» y el
   port no emite nada de eso. Es el mismo problema de diseño del caso 4 (`yells `): pide
   decidir dónde vive el nombre del tendero, así que **no se toca aquí**.
2. **La rama NO envenenada emite una cadena que el port no tiene.** `0x0888 mov ax,0x5028`
   → DS 0x5028 (fileoff 0x5038) = `I hope thou hast found thy stay enjoyable,"\n`. El port
   devuelve `"Welcome back!"` (`shops.ts:541`), que no está en el binario. Su clave fiel
   **ya está en `es.json` traducida y revisada** («Espero que vuestra estancia haya sido
   grata,»), es decir: es una huérfana del detector #47/#86 esperando a su emisor. Esto no
   es poda de comilla, es **cadena distinta** ⇒ fuera del género y fuera de este encargo.

Los dos van a la posada multi-mensaje de **#155**, que ya está abierta justo para esto.

---

## 9. TANDA 2 — carril `sapos-142`, rama `fix/sapos-142b`

Encargo del lead: los DOS sapos de atribución «adjudicables» de §4 (filas 1 y 3), dejando
el `CAN'T PAY? Beat it!` (fila 4) en #155 por ser diseño. **Resultado: uno arreglado y el
otro DEVUELTO a #155**, porque medirlo mostró que es del mismo género que el excluido.

### 9.1 ★★ EL DISCRIMINADOR: el binario tiene DOS impresores, y la cadena elige

Al leer la rutina entera apareció un mecanismo que ninguna nota del repo recogía. En
`SHOPPES3.OVL`, dos emisiones VECINAS usan rutinas distintas:

| offset | cadena | llamada |
|---|---|---|
| `SHOPPES3.OVL:0x04fb` | DS 0x4f57 (party llena) | `call 0x3670` |
| `SHOPPES3.OVL:0x050c` | DS 0x4f7a (`No one here…`) | `call 0xffff9d8e` |

`0xffff9d8e` es el impresor CON SUSTITUCIÓN (`$` = nombre del tendero, `%` = número);
`0x3670` es el llano. **Derivado con sus dos controles**, censando el overlay entero:

| control | medida |
|---|---|
| POSITIVO — cadenas que van por `0xffff9d8e` | **9 de 9** llevan marcador (`$` o `%`) |
| NEGATIVO — cadenas que van por `0x3670` | **0 de 28** llevan marcador |

Discriminación perfecta en las dos direcciones. Y explica de paso el caso de la posada de
§8.5: allí el `says $.` va en cadena APARTE (DS 0x5055) porque su compañera DS 0x5005 no
lleva marcador y puede ir por el impresor llano; aquí la atribución va INLINE porque toda
la cadena pasa por el expansor. **Es la misma mecánica vista desde los dos lados.**

### 9.2 DEVUELTO a #155: `No one here is from thy party!` NO es adjudicable

DS 0x4f7a = fileoff 0x4f8a = `\n\n"No one here is from thy party!"\nsays $.\n\n` — UNA sola
cadena con la atribución dentro, impresa por el expansor. Para calcarla el port necesita
el nombre del tendero en el punto de emisión, y **ahí no está**:

- `innPickup(state, buyerIdx, memberIdx, location)` no lo recibe, y `innAt(location)` da
  tarifas, no mercader.
- Quien lo resuelve es `shoppeKeeperAt(...)`, que exige tres assets JSON (`ShoppeKeeperMap`,
  `storeNames`, `shoppeKeeperNames`) y vive en la capa de arriba.
- Sí está en el call-site (`shop-console.ts`, `this.info.keeperName`), pero llevarlo allí
  significa o cambiar la firma de `innPickup` o componer la atribución en la UI.

O sea: exactamente la decisión que el lead aparta para el caso 4. Escribir el literal con
`{}` sin cablear el sustituto sería PEOR que el sapo (le enseñaría `{}` al jugador), y
escribirlo sin `says $.` sería una fidelidad a medias sin declararlo. **No se fuerza.**

★ La lección de instrumento: el eje que separa «adjudicable» de «diseño» en esta familia
no es la puntuación ni la atribución — **es si la cadena pasa por el impresor con
expansor**. Eso es enumerable en el binario y hace de criterio para el resto del género.

### 9.3 ARREGLADO: `What didst thou say?` — `conversation.ts` PHRASES

DS 0x9450 = fileoff 0x9460 = `\n\n"What didst thou say?`: comilla de APERTURA en el
literal y sin cierre (el original NO cierra; el cierre lo pone el intérprete). Va por el
impresor LLANO, sin marcador ⇒ sustitución mecánica.

Emisor y flujo, leídos enteros en `TALK.OVL`:

| offset | qué es |
|---|---|
| `TALK.OVL:0x0c88` | imprime DS 0x9440 (`You respond-\n:`), el prompt |
| `TALK.OVL:0x0c8f` | `call 0xa2c`, lee la respuesta |
| `TALK.OVL:0x0c92` | `cmp byte ptr [0xbcf8], 0` / `jne`, ¿vino vacía? |
| `TALK.OVL:0x0c99` | si vacía, imprime DS 0x9450 con `call 0x58d0` |
| `TALK.OVL:0x0ca5` | `je 0xc7d`, vuelve al prompt mientras siga vacía |

Es el bucle que el propio port ya describía en `conversation.ts` («a partir del segundo
intento»): la derivación confirma el comentario, no lo contradice.

★ **CONTROL POSITIVO DENTRO DEL PROPIO OBJETO, y es el argumento fuerte**: `WHAT_YOU_SAY`
era la ÚNICA de su familia sin la comilla. Sus hermanas `IF_SAY_SO`, `PLEASURE`,
`CANNOT_HELP` y `PROFANITY` —dos de ellas a tres líneas de distancia— ya estaban verbatim
en main desde antes de este carril. El test las asierta juntas: si la convención fuese
invención mía, esas tres saldrían rojas. En la corrida failing-first salieron VERDES
mientras la mía salía roja, que es justo la forma que debe tener esta prueba.

### 9.4 Corpus: esta vez NO se toca `es.json`, y por una razón medida

En la tanda 1 la clave podada había que darla de baja porque era fabricación. **Aquí no**:
la forma podada `What didst thou say?` tiene respaldo REAL en el corpus — es una línea de
NPC en `game/assets/talk/castle.json`, comprobado por mí (`grep` sobre los assets, un solo
fichero) y no heredado del §6 de este acta. Retirarla habría roto una clave legítima.

Ni la forma podada ni la fiel están en `approved-strings.json`, y no hace falta: las
cadenas de TALK entran al canon por los assets extraídos, no por esa fixture — sus cuatro
hermanas tampoco están. Cero altas y cero bajas de corpus en esta tanda.

### 9.5 Lo que este arreglo NO toca

`PHRASES` pasa a estar exportado (era `const` de módulo) para que el test pueda sellarlo
sin instanciar el intérprete. Es el único cambio estructural, y no altera conducta.
