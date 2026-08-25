# La localización de la piedra lunar, y el estado fuera de banda del pozo

Derivación sobre el binario de 1988. Ficha #143, los dos cabos que dejó abiertos la entrega
Doom-2 (`reciclado-ranuras-y-boca-de-doom.md`, merge `5dc54f4d`).

Sujeto = BINARIO. Relevo de `triaje-47`.

**Qué es de quién.** El punto de partida de (a) —el censo de escritores de `buried` en
`game/src`, y la hipótesis de que `moongates.ts` y `saveNative.ts` hablaban de DOS artefactos
distintos— es de `triaje-47` y entró aquí como hipótesis, no como medición. Todo lo que sigue
lo he medido yo, y la hipótesis heredada queda **REFUTADA** por aritmética (§1.1).

---

## 1. (a) No hay dos artefactos: `DS 0x5840` y el offset `0x29a` son LOS MISMOS OCHO BYTES

### 1.1 La aritmética que cierra la hipótesis heredada

`DS 0x55A6` es la imagen en RAM del fichero `.GAM`. Dos sitios independientes calculan la
longitud del bloque como `0x6606 − 0x55A6`: `INTRO.OVL:0x0079` y `CAST2.OVL:0x118d`, ambos
seguidos de `push 0x55a6` como puntero de buffer. Esa longitud es **`0x1060` = 4192 bytes**, y
4192 es el tamaño exacto de `INIT.GAM` y de `SAVED.GAM` (medido: los dos ficheros, 4192 B).

Con esa base, los cuatro arrays paralelos de piedras lunares caen en su offset de fichero sin
resto:

| array | DS | −`0x55A6` | offset `.GAM` | contenido |
|---|---|---|---|---|
| x | `0x5830`, | | `0x28a`, | columna |
| y | `0x5838`, | | `0x292`, | fila |
| **loc** | **`0x5840`**, | | **`0x29a`**, | **localización, `0xFF` = en la mochila** |
| floor | `0x5848`, | | `0x2a2`, | planta |

Control independiente, y de otra fuente: `0x5C5A − 0x55A6 = 0x6B4`, que es exactamente
`OBJECT_TABLE_OFFSET` en `game/src/core/saveNative.ts:98`, acreditado por
`re/notes/witness-o1-0x6b4.md`. Dos anclas distintas, el mismo delta.

⇒ el docstring de `moongates.ts:22` («`buried` ⇔ location != 0xFF») y el lector de
`saveNative.ts` **hablaban del mismo artefacto**. La hipótesis de los dos artefactos con
codificaciones distintas es falsa, y por tanto **sí había bug de código**.

### 1.2 Qué codifica el byte, con sus cinco sitios

**Escritores (2).**

- `bury_moonstone`, `CAST.OVL:0x1596`-`0x1599`: `mov al, byte [g_location]` seguido de
  `mov byte [bx + 0x5840], al`. Guarda la localización ACTUAL, sea la que sea. En el mismo
  bloque, `0x1588`-`0x15a0` copia x, y y `g_floor` a los otros tres arrays.
- El (G)et, `SJOG.OVL:0x1496`: `mov byte [bx + 0x5840], 0xff`. Recogerla planta el centinela.

**Lectores (3), y los tres leen el MISMO convenio.**

- `kernel_moongate_teleport`, `ULTIMA.EXE:0x47fd`: `cmp byte [bx + 0x5840], 0xff` — si es el
  centinela, no hay teleport.
- El gate de dibujo, `ULTIMA.EXE:0x4713`: `mov al, byte [g_location]` y
  `cmp byte [bx + 0x5840], al`. Compara contra una **localización completa**, no contra un
  centinela; y en `0x4722` comprueba `g_location == 0` por separado, para decidir si aplica
  además la ventana de chunk del sobremundo. Es la prueba directa de que **0 es un valor
  legítimo y con significado** (Britannia en superficie), no «sin enterrar».
- El panel de ztats, `ZSTATS.OVL:0x09b4`-`0x09c2`: `cmp byte [si + 0x5840], 0xff`; si casa
  escribe `0xff` en el buffer del panel y si no escribe 0. O sea, «la llevas» ⇔ `== 0xFF`,
  con el mismo `0xff`-como-verdadero que usa `g_crown` dos líneas más abajo (`0x09e1`).

Y un sexto sitio que corrobora: `search_moonstone`, `SJOG.OVL:0x03e0`, exige
`[bx + 0x5840] == g_location` para que el (S)earch encuentre la piedra.

**Codificación: el byte es la localización donde está enterrada (0 = sobremundo de Britannia,
1..0x28 = pueblo o mazmorra), y `0xFF` significa «en la mochila».**

### 1.3 El defecto del port, y por qué nadie lo había visto

`game/src/core/saveNative.ts:303` leía `buried: gam[0x29a + i]! === 0`.

`=== 0` y `!== 0xff` dan **el mismo resultado en 0 y en 0xFF**, y difieren en todo el rango
`1..0xFE`. Censo del corpus: **los 70 `.gam` del árbol** (`game/assets/init.gam`, `dist`, 51 de
`e2e/espejo-tour/saves`, 18 de `e2e/grandtour/saves`) llevan los ocho bytes a **0**. Ahí los dos
predicados coinciden, y por eso el defecto vivía sin enrojecer nada.

Muerde con una piedra enterrada fuera del sobremundo. Con el predicado viejo, dos conductas
erróneas: al importar un save con una piedra enterrada en un pueblo el port la lee como NO
enterrada, así que `usePicker.ts:177` te la ofrece en el (U)se y ztats te la cuenta —**te regala
una piedra que sigue bajo tierra**—; y si la «entierras» otra vez, el escritor aplasta el byte y
**borra el pueblo** donde estaba.

### 1.4 Alcanzabilidad: OBSERVABLE HOY, no latente — y con evidencia de juego real

Las dos puertas del (U)se, `game/src/core/endgame/use-tools.ts:373` y `:379` (lectura de
`triaje-47`, verificada aquí línea a línea):

1. `location >= 0x21` → «cannot be buried here!», calco de `CAST.OVL:0x155f`. **Los pueblos son
   1..0x20 y el corte está en `>= 0x21`: PASAN.**
2. tile enterrable ⇔ `0x2c`, `0x2d`, o `0x04..0x0a`, calco de `CAST.OVL:0x1566`-`0x157c`.

Los nueve tiles enterrables son **andables** según el mapa de bits del binario (`DS 0x54d4`), y
las **32** localizaciones de `game/assets/maps/smallmaps.json` tienen celdas enterrables — 29 662
en total contando plantas.

🔴 **Y no hace falta reconstruir dónde aparece la party: el corpus ya lo enseña.** De los 70
`.gam` del árbol, **24 están dentro de un pueblo**, y en **3 de ellos la party está AHORA MISMO
sobre una celda enterrable**, los tres sobre tile `0x05`:

| save | localización | celda |
|---|---|---|
| `part01.gam` | 13 Iolo's Hut | 29,6 |
| `part07.gam` | 5 Minoc | 22,17 |
| `ch09.gam` | 8 New Magincia | 15,28 |

Son posiciones de juego grabado, no una inundación reconstruida: cargar `part07.gam` y pulsar
(U)se → Moonstone entierra. ⇒ **divergencia observable hoy**, y por tanto el arreglo es de
MODELO, no sólo de predicado.

🔴 **Instrumento, y un cero que casi me engaña:** el primer intento de esta medición inundó cada
pueblo desde las tablas `DATA.OVL` fileoff `0x1e9a`/`0x1ec2` creyéndolas la entrada al mapa
pequeño. Son las coordenadas de la localización **en el SOBREMUNDO** (el Castillo de Lord British
sale en 86,107 — exactamente la ranura 0 de `BRIT.OOL`), así que las 32 caían fuera del 32×32 y el
censo dio **0 de 32 con una tabla entera de «FUERA DE RANGO»**. Un cero limpio de un predicado
roto se lee igual que «no hay»; lo delató imprimir las coordenadas junto al veredicto.

### 1.5 Fix: el campo `location` en el modelo y en el códec

El byte es la localización, así que el modelo la guarda:

- `state.ts` — `Moonstone` gana `location: number` (y el `ExtractedInitialState` estructural).
- `saveNative.ts` — el lector añade `location: gam[0x29a + i]!` junto al `buried` corregido, y el
  escritor pasa a `gam[0x29a + i] = m.buried ? m.location & 0xff : 0xff`, que es literalmente lo
  que hacen `CAST.OVL:0x1599` y `SJOG.OVL:0x1496`.
  La guarda de preservación anterior («no escribas si la buriedness ya concuerda») **se retira**:
  existía sólo para no perder un campo que el modelo no sabía representar, y con `location`
  dentro sería peor que inútil — taparía los cambios reales de localización.
- `buryMoonstone(state, phase, x, y, z, location)` guarda el cuarto campo; `useMoonstone` le pasa
  el `effectiveLocation(ctx)` que ya calculaba para su propia puerta.

**El invariante y su trampa.** `buried` y `location` son dos caras del MISMO byte, así que pueden
contradecirse en memoria. Los tres sitios que apagan `buried` ponen ahora también el centinela:
`digUpMoonstone`, el (G)et del (S)earch en `world/search.ts:144` —cuyo comentario ya citaba «el
0xFF de `[bx+0x5840]` en 0x1496» sin escribirlo— y `setMoonstoneField` del debug API, que además
normaliza al enterrar. Sin eso el round-trip no cierra, y de hecho **no cerró**: el deep-equal de
`save-native.test.ts` se puso rojo con las piedras en la mochila hasta normalizar el par.

**Guarda:** `game/tests/moonstone-buried-codec.test.ts`, 7 casos. El testigo discriminante usa
localizaciones de PUEBLO (1, `0x0e`, `0x20`, `0x28`, `0xFE`) porque un caso sembrado con 0 o con
`0xFF` **pasa con el código roto**, y hay un caso de control explícito que fija esa razón por
escrito. **Seis mutantes, todos muertos:** lector→`=== 0` (3 rojos), lector→`!== 0` (3),
lector con `location` fijada a 0 (2), escritor que pierde la localización con el predicado
correcto (2), escritor con el par invertido (3), y `buryMoonstone` sin guardar la localización (1).
Los dos últimos son los que sólo mueren por el caso de pérdida-de-localización.

### 1.5-bis 🔴 El MISMO defecto vivía en un SEGUNDO artefacto, y arreglar sólo uno los hacía divergir

El encargo apuntaba a `game/src`, y el censo de escritores heredado se hizo ahí. Grepear `0x29a`
por el CONCEPTO y sobre el árbol ENTERO encuentra un segundo códec del `.GAM` con las dos mitades
del mismo defecto: `extractor/src/parsers/savegame.ts:302` (`buried: bytes[0x29a+i]! === 0`) y
`:265` (la misma guarda de preservación).

Y no es sólo «el mismo bug en otro sitio». Los dos serializadores están careados **byte a byte**:
el fixture canónico de `game/tests/save-native.test.ts` lo dice por escrito («si editas este
fixture, edita EL MISMO en la otra suite o el sha divergirá»). Arreglar sólo el lado del juego
los habría hecho **DIVERGIR** para una piedra enterrada en un pueblo — y como el fixture
compartido lleva las ocho localizaciones a 0, que es justo donde los dos predicados coinciden, la
divergencia habría quedado **latente y verde**. Un verde vacuo introducido por el propio fix.

Arreglado en paralelo y calcado: mismo campo, mismo lector, mismo escritor, misma retirada de la
guarda. El fixture MUTADO del extractor (`tests/savegame.test.ts:155`) ponía `buried = false`
dejando `location` a 0 — estado no representable, porque es UN byte — y se normaliza a `0xFF`
con la razón escrita al lado, igual que en la suite del juego.

★★ La lección de alcance: el defecto es de una CODIFICACIÓN, y una codificación la implementa
todo el que toque esos bytes. El censo tiene que ser del OFFSET sobre el árbol entero, no del
directorio que nombra el encargo.

### 1.6 El docstring: NO estaba equivocado, y se actualiza por otra razón

La ficha pedía corregir `moongates.ts:22` «porque describe `DS 0x5840` junto a código que lee
`0x29a`». Esa premisa viene de la hipótesis de los dos artefactos y **§1.1 la refuta**: son los
mismos bytes, así que citar `0x5840` ahí era correcto, y su «`buried` ⇔ location != 0xFF» era la
semántica BUENA — la que el código no cumplía. Corregirlo como si mintiera habría movido el
defecto al sitio equivocado.

Lo que sí se hace: (a) dejar escrita la identidad `0x5840` = `0x29a` con su aritmética, para que
nadie vuelva a abrir la pregunta; (b) actualizar la descripción del modelo, que este commit
cambia a `{x, y, buried, z, location}`; y (c) declarar el cabo que queda.

🔴 **Cabo que queda, medido y NO arreglado:** el gate de dibujo `ULTIMA.EXE:0x4713` exige
`[0x5840] == g_location` — la puerta sólo se ve donde enterraste la piedra. `moongateAt` sigue
comparando sólo (x, y, z), así que una piedra enterrada en un pueblo dibujaría su puerta en el
sobremundo en esas coordenadas. Es anterior a esta ficha y no empeora con ella; ahora que el
campo existe el arreglo es de una línea, pero es cambio de CONDUCTA y va aparte.

---

## 2. (b) `g_location = 0` con `g_floor = 8`: nadie lo sanea, y NO es la entrada a Doom

El cabo de `reciclado-ranuras-y-boca-de-doom.md §6.3` señalaba el bucle principal del sobremundo
como el único sitio sin leer donde podría vivir un saneado. Leído entero.

### 2.1 El bucle no sanea nada: `g_location == 0` es su única pregunta

`outdoor_main_loop`, `MAINOUT.OVL:0x0a84`, 670 B. Sus tres lecturas de localización:

- `0x0b0a`: `cmp byte [g_location], 0` / `je 0xb14`; si NO es cero, `jmp 0xd1d` = **`ret`**. Es
  el «¿sigo en el sobremundo?» de la cabecera del bucle.
- `0x0c20`: la misma comparación tras despachar la tecla; si no es cero, marca el flag de salida
  y termina.
- `0x0c9f`: dentro de la guarda de un evento guionizado en la celda (0xE9,0xEB) — el «Pass,
  Seeker!» / «Passage denied!» de `DS 0x2b6e`/`0x2ba1`.

Y **su única lectura de `g_floor` en 670 bytes** es `0x0c98`, parte de esa misma guarda de cuatro
condiciones: un `g_floor != 0` se limita a saltarse el evento.

⇒ el bucle **acepta `g_location == 0` como «estoy fuera» y nunca mira `g_floor`**. No hay
saneado, ni aquí ni en `dng_pit_fall` ni en su llamador (ya medido por la entrega anterior).

### 2.2 Y el estado ES alcanzable, con la cadena entera en código

- `mainout_enter_location`, `MAINOUT.OVL:0x088f`-`0x089a`: al entrar a una mazmorra, si
  `g_floor != 0` (o sea, viniendo del Underworld) y la localización **no** es `0x28` (Doom),
  hace `mov byte [g_floor], 7`. Si no, `0x08b4` pone `g_floor` a 0.
  🔴 **Régimen de la cifra:** el BYTE vale **7** y **0**. La entrega anterior escribió «planta
  8» y «planta 1» para estos dos mismos saltos: es la convención 1-based de la pantalla, no el
  byte. Quien copie «8» al port y lo escriba en `g_floor` mete un off-by-one.
- `dng_pit_fall`, `DUNGEON.OVL:0x0a6e`, sólo dispara con `g_floor < 8` e incrementa. Desde el
  byte 7, un pozo lleva a 8; entonces `0x0af0` (`cmp byte [g_floor], 8`) casa y `0x0af7` escribe
  `g_location = 0`. Acto seguido `0x0afc` comprueba `g_location == 0` y **retorna**, saltándose
  el resto de la rutina.
- `dng_main_loop`, `DUNGEON.OVL:0x0f47` y `0x0f87`: `cmp byte [g_location], 0x21` / `jae`; por
  debajo de `0x21` limpia el flag de continuación (`[bp-0xc]`), y `0x0f93` rompe el bucle. Las
  mazmorras son las localizaciones `0x21`-`0x28`, así que el `0` del pozo **expulsa del bucle de
  mazmorra** en la iteración siguiente.

Cadena completa: Underworld → entrar a una mazmorra que no sea Doom → arrancas en el byte de
planta 7 → un pozo → planta 8 y `g_location = 0` → el bucle de mazmorra sale → el bucle del
sobremundo corre con `g_floor = 8`. **Alcanzabilidad en DATOS sin medir:** hace falta que exista
un pozo en esa planta; no he censado los pozos por planta.

### 2.3 Qué mapa te toca — y el veredicto: NO es la entrada a Doom

`get_tile_ptr`, `ULTIMA.EXE:0x4402`, 182 B, es el selector de mapa y **no lee `g_floor` ni una
vez**. Sólo mira `g_location`: `> 0x7f` → buffer de mazmorra en `DS 0xad14`; `== 0` → ventana de
chunk del mapa grande en `DS 0x6608`, restando `g_chunk_origin_x/y` y enmascarando con `0x1f`;
en otro caso → mapa pequeño 32×32, con fuera-de-rango a `DS 0x6a07`.

Y `outdoor_mode_init`, `MAINOUT.OVL:0x0000`-`0x0079`, recalcula los orígenes de chunk **sólo**
desde `g_party_x`/`g_party_y` (con la regla «nibble bajo < 8 ⇒ resta 0x10»), tampoco lee
`g_floor`.

⇒ con `g_location = 0` la party camina el **mapa grande**, y las coordenadas que lleva son las de
celda de mazmorra (0..7), o sea la esquina del mundo. No se escribe 128,128, no se carga
`UNDER.DAT` (su único sitio de carga sigue siendo `OUTSUBS.OVL:0x0542`, que pone `g_floor = 0xff`
explícitamente) y ningún lector puede seleccionar el Underworld a partir de un 8.
**El par no es el mecanismo de entrada a Doom.** La pregunta de la ficha #120 sigue abierta.

### 2.4 🔴 Lo que sí produce: DOS selectores de `g_floor` que discrepan justo ahí

En el mismo overlay, dos rutinas eligen fichero a partir de `g_floor` con **predicados
distintos** (cadenas resueltas con `dispatch_table._resolve_string`):

| rutina | comparación | verdadero | falso |
|---|---|---|---|
| `outdoor_viewport_chunk_load`, `OUTSUBS.OVL:0x01e1`, | `cmp g_floor, 0x7f` / `jbe` | ≤ 0x7f → `BRIT.DAT` | > 0x7f → `UNDER.DAT` |
| `outsubs_world_filename`, `OUTSUBS.OVL:0x036e`, | `cmp g_floor, 0` / `jne` | == 0 → `BRIT.OOL` | != 0 → `UNDER.OOL` |

Coinciden en los dos valores legítimos (0 y `0xFF`) y **discrepan en todo `1..0x7F`** — que es
justo donde cae el 8 del pozo. Con `g_floor = 8` el terreno es el de Britannia y el fichero de
actores del exterior es el del Underworld.

Los dos llamadores de `outsubs_world_filename` que hay (censo con
`dispatch_table.near_calls_to_kernel`, stub `0x7a22`) son ESCRITURAS, las dos con la misma forma
—`write_whole_file_with_disk_retry(0x100, DS 0x5c5a, nombre)`, o sea 256 B desde la tabla de
actores—: `MAINOUT.OVL:0x0857` en `mainout_enter_location` y `MAINOUT.OVL:0x0ae1` en
`outdoor_main_loop`. ⇒ la consecuencia medible es que **los actores del exterior de Britannia se
guardan encima de `UNDER.OOL`**. **No he leído el sitio de LECTURA de los `.OOL`**, así que no
afirmo qué pasa al recargar.

### 2.5 🔴 Corrección a la entrega anterior: `UNDER.OOL` SÍ es una lista de actores

`reciclado-ranuras-y-boca-de-doom.md §6.1` afirma que «el Underworld **no tiene lista de objetos
propia**» y que `UNDER.OOL` «es la tabla de indirección de chunks, la de la ficha #34, no un
inventario». Las dos mitades son falsas, y se ven con dos instrumentos:

- el binario **escribe ahí la tabla de actores** (§2.4: 256 B desde `DS 0x5c5a`, que son las 32
  ranuras de 8 B);
- y el fichero **decodifica limpio** con ese formato. `original/u5/ultima5/UNDER.OOL`, 256 B,
  cinco ranuras ocupadas:

| ranura | tile | nombre (`TileData.json`) | celda |
|---|---|---|---|
| 23 | `0x29`, | SkiffRight | 14,242 |
| 24 | `0x1e`, | DeadBody | 103,226 |
| 25 | `0x1e`, | DeadBody | 105,227 |
| 26 | `0x1e`, | DeadBody | 107,227 |
| 27 | `0x1e`, | DeadBody | 108,225 |

Un esquife y cuatro cadáveres, los cuatro pegados a la celda del Amuleto (105,225). `INIT.OOL`
lleva las mismas cinco filas; `BRIT.OOL` lleva otra cosa (ranura 0, tile `0x1c` BasicAvatar, en
86,107).

**La CONCLUSIÓN de §6.1 sobrevive, sobre evidencia nueva.** Inundación propia desde la celda
128,128 sobre `game/assets/maps/underworld.json` con el mapa de bits de andabilidad del binario
(`DS 0x54d4`, máscara `0x80 >> (t&7)`, bit a cero = pasable): reproduce **259** celdas a pie y
**675** con (K)limb, los dos cardinales de la entrega anterior, y los cuatro tiles de control
salen como debe (agua `0x01`, `0x0c` y `0x0d` bloqueados; boca `0x16` pasable; `0xff` pasable).
**Ninguna de las cinco ranuras cae dentro de la bolsa**, en ninguno de los dos regímenes. Así que
sigue sin haber objetos sembrados en la bolsa de Doom — pero ya no por la razón que decía §6.1.

---

## 3. Qué NO se porta

Nada de §2. El estado fuera de banda y la discrepancia de los dos selectores se declaran como
hallazgo del binario; portarlos pediría ficha aparte y decisión del lead. Los únicos cambios de
código de esta entrega son los de §1.5, más el docstring de §1.6.

Y tampoco se porta el gate de dibujo por localización (`ULTIMA.EXE:0x4713`), que ahora sería de
una línea: cambia CONDUCTA visible y merece su propia ficha con su propio testigo.

---

## 3-bis. (#149) El gate de DIBUJO por localización — y el asset derivado que casi lo convierte en regresión

Ficha #149, autorizada por el lead tras #143 con el argumento correcto: **no es invención, es
calco**, así que entra como paridad aunque cambie conducta visible.

### 3-bis.1 Son DOS gates distintos, y sólo uno lleva la localización

| rutina | guarda | qué exige |
|---|---|---|
| visibilidad/dibujo, `ULTIMA.EXE:0x4702` | `0x4713` `cmp byte [bx+0x5840], al` con `al = g_location`, y `0x471c` lo mismo con `g_floor` | la piedra tiene que estar enterrada **AQUÍ** |
| teleport, `ULTIMA.EXE:0x47f4` | `0x47fd` `cmp byte [bx+0x5840], 0xff` | sólo «no está en la mochila» |

El teleport **no** compara contra `g_location`: en `0x4841` lo **ESCRIBE** desde la piedra, que
es justamente cómo la puerta te lleva a otra localización. ⇒ `moongateDestination` **no** recibe
esta comprobación; dársela rompería el viaje entre localizaciones. El fix toca `moongateAt` y
nada más.

`z` ya cubría la segunda igualdad (`0x5848`). `location` era la primera, y faltaba.

### 3-bis.2 🔴 El asset DERIVADO venía sin el campo, y el fix solo habría dejado el juego SIN PUERTAS

`game/assets/initial-state.json` —el que `main.ts` carga para una partida nueva, generado por
`extractor/src/pipeline.ts`— traía las ocho piedras **sin `location`**. Con el gate puesto,
`undefined === 0` es falso: **una partida nueva se quedaba sin ninguna puerta lunar.**

Dos cosas que hacen a esta clase peligrosa:
1. **`tsc` no la ve.** El asset entra por `JSON.parse(...) as T` — un cast que *afirma* la forma
   en vez de comprobarla. El tipo estaba bien y el dato no.
2. Es la clase de #80 (`main` no es el punto fijo de su propio generador): un **derivado
   commiteado** que se quedó atrás respecto del generador que lo produce. El generador ya emitía
   `location` desde #143a-bis; el fichero en el árbol, no.

Lo cazó el testigo de la propia ficha, no una revisión.

**Arreglo, y es derivación y no conjetura:** los ocho `location` del asset se toman del propio
`game/assets/init.gam`, bytes `0x29a..0x2a1` = **todos 0**. Control antes de escribir: las `x`/`y`
del asset coinciden con `0x28a`/`0x292` del `.GAM` en las ocho.

🔴 **Y el arreglo del asset NO VIAJA EN EL COMMIT, por diseño.** `game/assets` está en
`.gitignore:7` y tiene **0 ficheros tracked** (es material derivado de EA — REGLA 4). Además es
un symlink compartido por todos los worktrees, así que tocarlo desde uno toca el de todos. Lo que
sí viaja, y es lo que de verdad cierra la clase, ya está en `main`: el parser del extractor emite
el campo desde #143a-bis, y `extractor/src/pipeline.ts:351` escribe `parseSaveGame(INIT.GAM)` tal
cual como `initial-state.json`. **Comprobado ejecutándolo**, no razonándolo: una regeneración
produce `{"x":224,"y":133,"buried":true,"location":0,"z":0}` y `location` en las ocho — byte a
byte lo mismo que el parche a mano. El parche sólo pone al día el asset YA generado de esta
máquina sin re-correr la extracción entera.

⇒ el estado correcto tras el merge es: código y guarda en el árbol, y **el asset se regenera**.
Quien clone y regenere obtiene el campo; quien arrastre un asset viejo se lo encuentra en ROJO
por la guarda de la batería, que es justo para lo que está.

### 3-bis.3 Testigo y mutantes

`game/tests/moongates.test.ts`, tres casos nuevos que forman un bicondicional (el testigo entierra
en **Minoc `0x0e`**, no en 0 — con localización 0 los dos predicados coinciden y el aserto pasaría
con el código roto):

- enterrada en Minoc → **NO** pinta en el sobremundo;
- control: la MISMA celda con la piedra del sobremundo → **SÍ** pinta (separa «rechaza por la
  localización» de «rechaza siempre» — sin él, un `return false` pelado pasaría el primero);
- control: esa misma piedra vista DESDE Minoc → **SÍ** pinta (el gate no es «sólo el sobremundo»,
  es «SU sitio»).

**Cuatro mutantes, cuatro muertos:** quitar el predicado (1 rojo) · invertirlo a `!==` (5) ·
cablearlo a `0` en vez de al parámetro (1) · **y quitar `location` del ASSET (1)** — el último es
la única red que vigila el derivado.

### 3-bis.4 Cabo que queda, medido y NO tocado

El port sólo dibuja moongates en el sobremundo: `game.ts` `checkMoongate` y `activeMoongates`
salen antes si `pos.location !== 0`. El binario, en cambio, llama a `0x4702` con la localización
que toque, así que una piedra enterrada dentro de un pueblo **sí** pintaría su puerta dentro de
ese pueblo. Eso es ENSANCHAR (el lead lo excluyó del encargo) y va a ficha aparte; el parámetro
`location` ya está enhebrado para cuando se haga.

---

## 4. Autoría

- La hipótesis de los dos artefactos y el censo inicial de escritores de `buried` en `game/src`
  son de **`triaje-47`**, y entraron como hipótesis. §1.1 la refuta con aritmética.
- La lectura de las dos puertas del (U)se es de **`triaje-47`** (segundo parcial); aquí se
  verificó línea a línea contra `use-tools.ts:373`/`:379` antes de construir encima.
- Todo lo demás —la identidad `0x5840` = `0x29a` y sus dos anclas, el censo de los seis sitios
  del binario, la alcanzabilidad con los tres saves del corpus, el fix de modelo, los seis
  mutantes, y todo el §2— es medición de este carril (`doom-143`).
