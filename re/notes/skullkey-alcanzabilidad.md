# La Skull Key se gasta ANTES del gate de localización — alcanzabilidad MEDIDA y POSITIVA

**Sujeto: el binario de 1988.** El defecto se descubrió leyendo el cuerpo de
`CAST.OVL:0x1792 use_item_command_dispatch` (carril `cola-cast`, commit `e0cf4ad9`, en main
desde `e3b24056`), que lo dejó anotado como **candidato sin firmar** porque le faltaba
exactamente esta mitad. Esta nota la cierra.

---

## 1. El mecanismo, en cuatro instrucciones

`CAST.OVL`, handler del id `0x11` (Skull Key) del despachador de (U)se:

```
18c4: fe0eb157   dec byte ptr [g_skull_keys]        ← el COBRO
18c8: b8fe48     mov ax, 0x48fe ; print_string      ← "Skull Key\n"  (DS 0x48fe)
18cf: 803e935821 cmp byte ptr [g_location], 0x21    ← el GATE, DESPUÉS del cobro
18d4: 7207       jb  0x18dd                         ; < 0x21  → camino bueno
18d6: 803e93587f cmp byte ptr [g_location], 0x7f
18db: 7625       jbe 0x1902                         ; 0x21..0x7f → "Not here!" (DS 0x4909)
```

El orden es **cobrar → comprobar**. En la banda `0x21 <= g_location <= 0x7f` el jugador
pierde una llave y lo único que ve es «Not here!».

Detalle que agrava el silencio: en ese camino `[bp-0xa]` sigue valiendo **1**, así que la
cola común del despachador (`0x1b8a`, `cmp word [bp-0xa],0`) **ni siquiera emite el
«Failed!»** ni su tono. La única señal es un mensaje que dice que la acción no procedía —
mientras el inventario ya ha bajado.

---

## 2. Qué es la banda `0x21..0x7f`: las OCHO MAZMORRAS

Derivado del sitio que escribe el valor, no heredado de una cita.
`MAINOUT.OVL:0x0871-0x088c`, al entrar en una mazmorra:

```
0871: ax = 0x595a                    ; destino: el búfer de mapa de mazmorra
0875: push 0x200                     ; 512 bytes = 8 plantas de 8x8
0879: ax = [bp-2] << 9 ; ax -= 0x4000  ; offset dentro del fichero de datos
0884: call (lector de fichero)
0887: al = [bp-2] ; inc al
088c: mov byte ptr [g_location], al  ; g_location = [bp-2] + 1
```

El `- 0x4000` fija la base: para que el offset no sea negativo hace falta `[bp-2] >= 0x20`
(`0x20 << 9 = 0x4000`, offset 0). Con bloques de `0x200` B y ocho mazmorras en el juego,
`[bp-2] ∈ 0x20..0x27` ⇒ **`g_location = 0x21..0x28`**. Corrobora dos citas previas e
independientes: `aud-relojes-acta.md:142` («`g_location = si+1 = 0x21..0x28`») y
`board-137-acta.md:16` («`0x21..0x28 (mazmorra)`»).

El resto de la banda (`0x29..0x7f`) no se usa en juego normal — `antim-freeze.md:193` ya lo
declaraba («las localizaciones van 0..0x28»), y el censo de escrituras a `g_location` sobre
los 28 desensamblados lo respalda: los únicos literales dentro de `0x29..0x7f` son
`0x40`/`0x41`/`0x42`, y los escriben **`INTRO.OVL` y `FONT.OVL`** — secuencia de
presentación, sin bucle de órdenes. ⚠️ Ese censo es de escrituras con literal o `al`
inmediatas; **no rastrea el valor cuando llega por variable**, así que es cota inferior de
valores posibles, no prueba de que no exista otro.

---

## 3. La cadena de alcanzabilidad, eslabón a eslabón

La pregunta real no es «¿existe la banda?» sino **«¿se puede pulsar (U)se estando en
ella?»** — porque la mazmorra tiene su propio bucle de teclado. Sí se puede, y el camino
está medido entero:

| # | eslabón | evidencia |
|---|---|---|
| 1 | En mazmorra manda `DUNGEON.OVL:0x0e2e dng_main_loop` → `0x06c4 dng_dispatch_key` | ledger |
| 2 | `dng_dispatch_key` sólo trata `0x01..0x05`, `0x0b`, `0x0d`, `0x13`, `0x16`, `0x2e` y `0x30..0x39`. **Todo lo demás cae al DEFAULT `0x07a0`**, que hace `push [bp+4]; call 0xffffafa8` | cuerpo leído `[0x06c4,0x07e2)` |
| 3 | `0xffffafa8` con la base de DUNGEON (`0x81D0`) = **`ULTIMA.EXE:0x3178 kernel_cmd_dispatch`**. Control: en la misma rutina `0xffff9680`→`print_string` y `0xffffa49c`→`getkey_with_redraw` con esa misma base | resolución + control cruzado |
| 4 | `'U'` = `0x55` no está en la lista de (2) ⇒ llega al kernel. Traza: `0x3186 cmp 0x4d` (mayor) → `0x349e`; `0x34a6 jg 0x34de`; **`0x34e8: cmp ax,0x55 / jne / jmp 0x340c`** | cuerpo leído |
| 5 | `0x340c` imprime DS `0xa24c` = «Use item» y hace `call 0x7e42` — **sin gate de localización de ningún tipo** | cuerpo leído |
| 6 | El stub PLINK `0x7e42` aterriza en **`CAST.OVL:0x1792`** | `dispatch_table.stubs()` |
| 7 | Ni `find_next_owned` ni `item_picker_loop` filtran por localización: la llave aparece en la lista con `g_skull_keys >= 1` | cuerpo leído `[0x1792,0x1bb0)` |

**⇒ ALCANZABILIDAD POSITIVA.** No es un caso de borde: es «estar en una mazmorra con
llaves encima y pulsar U».

### 3-bis. Segundo canal, independiente: el propio clon

`game/src/core/game.ts:3173-3177` lleva el comentario del arreglo de la tarjeta **#123**:

> «`g_location` EFECTIVO (#123): con `position.location` la rama de mazmorra era MUERTA, y
> usar la Skull Key dentro de la mazmorra caía al camino de overworld — desmagificando una
> puerta del mapa de SUPERFICIE en las coordenadas de la entrada.»

Es decir: en el clon **se llegó de verdad a ese sitio** y produjo un efecto observable en el
mapa equivocado. Ese arreglo no habría existido si la rama fuese inalcanzable. Dos canales
—control de flujo del binario y un defecto vivo del port— coinciden.

---

## 4. Lo que cuesta, con las cifras que SÍ se pueden medir

- **Llaves en los saves de fábrica**: `INIT.GAM` byte `0x20b` = **0**; `SAVED.GAM` byte
  `0x20b` = **5**. O sea: la partida nueva empieza sin llaves y se encuentran jugando.
- **Puertas mágicamente selladas en los mapas pequeños de fábrica** (tiles `0x97` normal y
  `0x98` con cerrojo, los que `unmagicDoorTile` convierte a `0xB8`/`0xBA`):

  | fichero | plantas | `0x97` | `0x98` |
  |---|--:|--:|--:|
  | `TOWNE.DAT` | 16 | 4 | 0 |
  | `CASTLE.DAT` | 16 | 35 | 4 |
  | `KEEP.DAT` | 16 | 3 | 0 |
  | `DWELLING.DAT` | 16 | 0 | 0 |
  | | | **42** | **4** |

  Cuenta EXACTA para esos cuatro: son `16 × 1024` B y **cada byte es un tile**, así que no
  hay cabecera que inflar. `BRIT.DAT` (52.480 B, no múltiplo exacto de 1024) y `UNDER.DAT`
  dan cero en los dos tiles, así que su posible cola de datos no cambia el resultado.

⚠️ **Lo que estas cifras NO dicen, y no se debe deducir de ellas**: cuántas de esas 46
puertas hay que abrir con llave, ni cuántas llaves da el juego en total. No lo he medido —
hay al menos otra vía (el hechizo de apertura) y no he censado los repartos. La cifra vale
para dimensionar el objeto, no para afirmar que perder una llave bloquee nada.

---

## 4-bis. EL CONTROL está en el handler de al lado — y es lo que lo convierte en defecto

Aportado por el carril `bugs-original`, que midió esto en paralelo; **re-verificado aquí
sobre el mismo cuerpo que ya tenía leído**, no heredado.

La **alfombra** es el handler inmediatamente anterior del MISMO despachador, y es el mismo
tipo de consumible. Su orden es el inverso:

```
1869  cmp [g_location], 0x21 / jae  → "Not here!"   ← GUARDA
187f  cmp byte [bx], 0x0c    / je   → "Not here!"   ← GUARDA
188b  print "Boarded!"                               ← ÉXITO
18a1  dec byte [g_carpets]                           ← CONSUME AL FINAL
```

**Guarda-luego-consume, a 35 bytes de distancia, dentro de la misma rutina.** Eso retira la
defensa de «convención descuidada de la época»: el patrón correcto lo tenían escrito al
lado, en el handler contiguo, el mismo día.

**Y el mismo texto cuesta dos precios.** «Not here!\n» está DOS VECES en DATA.OVL:
`0x48f3` (rechazo de la alfombra, **gratis**) y `0x4909` (rechazo de la llave, **cuesta una
llave**). El jugador ve exactamente la misma línea y no puede distinguir el rechazo que
cobra del que no. Verificado volcando las dos cadenas de la imagen.

**Censo de guardas sobre los 28 desensamblados** (grep del nombre del global; conteo mío,
la cifra por fichero es la que sale de mi corrida):

```
g_skull_keys → 2 sitios
   CAST.OVL:0x18c4      dec          ← ÚNICO escritor de todo el binario, SIN guarda
   ZSTATS.OVL:0x09d5    lectura      ← pantalla de inventario

g_carpets → 10 sitios
   CMDS.OVL:0x0fd6      cmp [g_carpets], 0     ← guarda de cero
   MAINOUT.OVL:0x10e9   cmp [g_carpets], ah    ← segunda guarda
   SJOG.OVL:0x14a9/0x14b0  cmp 0x64 / mov 0x63 ← TOPE
   + 2 inc (CMDS 0x0910, SJOG 0x14a5) · 3 dec (CAST 0x18a1, CMDS 0x0fdd, MAINOUT 0x1106)
   + 1 lectura (ZSTATS 0x09cf)
```

⚠️ `bugs-original` citó «siete sitios» para `g_carpets`; mi grep da **diez líneas**. No sé
si contaron clases o si el grep fue distinto: **publico mi cifra con su desglose** para que
sea recontable, y la discrepancia queda anotada en vez de promediada. La conclusión no
cambia por eso: la alfombra tiene guarda de cero, tope y dos vías de reposición; la llave
tiene **un `dec` desnudo y ni un solo `cmp` en todo el binario**.

## 4-ter. ¿Se puede seleccionar una llave con contador 0? NO — cerrado leyendo el picker

`bugs-original` lo dejó abierto señalando, con razón, que **mi sello de
`use_item_command_dispatch` no acredita la SELECCIÓN**: si el picker dejara elegir un objeto
con contador 0, ese `dec` desnudo envolvería **0 → 255** y esto pasaría de «pierdes una
llave» a exploit de inventario. Es la pregunta correcta y decide la gravedad. **Leído y
cerrado en negativo:**

`ZSTATS.OVL:0x05a4 find_next_owned` (`ret 8`), cuerpo:

```
05af  inc si                              ; avanza al siguiente índice
05b0  cmp si, [bp+8] / jge 0x5d6          ; agotada la tabla → devuelve 0xFFFF
05b7  bx = [bp+6]                          ; base de la tabla extendida
05ba  cmp byte [bx+si], 0
05bd  jne 0x5ce                            ; ← ACEPTA sólo si el contador es DISTINTO DE 0
05bf  cmp di, 0xff / je 0x5af              ; si es 0 con filtro 0xff: SIGUE BUSCANDO
```

La entrada con contador **0 se salta**, y el hermano `find_prev_owned` (`0x056c`) es su
simétrico. El despachador llama a `find_next_owned` con el filtro `0xff` (`0x17a2`), que es
justo la rama que salta los ceros sin más comprobaciones. ⇒ **la Skull Key sólo es
seleccionable con `g_skull_keys >= 1`, así que el `dec` sin guarda NO PUEDE envolver.**

**Consecuencia para la gravedad, y hay que decirla en los dos sentidos:** el defecto es
real y alcanzable, pero su coste está ACOTADO en una llave por pulsación. **No** es un
exploit de inventario. El `dec` desnudo es seguro **por una propiedad de OTRA rutina**, no
por sí mismo — quien toque el picker puede desarmar esa seguridad sin enterarse.

## 5. Lo que NO es este defecto (dos confusiones que estuve a punto de publicar)

**(a) La rama del gem NO es el mismo bug.** El comando (V)iew a gem del kernel
(`ULTIMA.EXE:0x341a`) tiene la misma FORMA — `0x3428 dec g_gems` y sólo después
`0x342c cmp g_location,0x21` — y por eso lo di por hermano. **Lo es en forma y no en
fondo**: las dos ramas del gem HACEN algo. `0x3433` (loc `< 0x21`) llama al stub `0x7f0e` →
`LOOKOBJ.OVL:0x10fc`, y `0x3444` (loc `>= 0x21`) llama al stub `0x7f4a` →
`DNGLOOK.OVL:0x06a8`: son el visor de gema de superficie y el de mazmorra. Es un
DESPACHO A DOS BANDAS, no un rechazo. El gem se gasta y se usa.

**(b) La llave gastada al CANCELAR la dirección es otra cosa.** En el camino bueno
(`0x18dd`), si el jugador cancela el `getdir` la llave también se ha ido — pero eso ya está
fichado (tarea #22) y el clon lo modela con cita. Aquí el juego **ni siquiera pregunta**:
rechaza de plano y ya ha cobrado.

---

## 6. Estado del clon (verificado, con cita)

`game/src/core/game.ts:3170-3181` `useSkullKey()`: `this.state.skullKeys--` y **después**
`if (location >= 0x21 && location <= 0x7f) → "Not here!"`. **El clon reproduce el defecto,
y a propósito.** No es un descuido heredado: la tarjeta #123 tocó justo esa rama para que la
mazmorra dejara de caer en el camino de superficie.

**Sin RNG por ninguno de los dos lados.** El cuerpo `[0x1792,0x1bb0)` tiene UNA sola tirada
(`0x1899`, la moneda de orientación de la alfombra) y no está en este camino. Arreglar esto
**no mueve el stream**, así que por la regla del propio registro (§«La regla que decide»,
punto 2: no toca stream + descuido claro ⇒ se arregla) la fila va a **§1**, no a §2.
La decisión final es del lead: el port hoy lo calca, y moverlo a «arreglado» es cambiar
conducta observable.

---

## 7. Alcance declarado — lo que NO HE LEÍDO YO, con el estado del ledger al lado

🔴 **EL FILTRO VA PEGADO A CADA RESULTADO, NO EN EL TÍTULO DE LA SECCIÓN.** La primera
versión de este §7 decía, en un bullet suelto, «`CAST2.OVL:0x0768 magic_door_open_worker`
(el destino de la rama BUENA): **no leído**». Dentro de una sección titulada «lo que no he
abierto» eso es cierto y honesto — significa *no leído POR MÍ*. Pero **lo que se cita es el
bullet, no la cabecera**: el lead lo leyó como «nadie la ha leído» y enrutó la fila a otro
carril, que la abrió para descubrir que estaba **sellada desde antes** (`verified=true`, con
cita de cuerpo entero de `asm100-censo-acta`: «CUERPO ENTERO LEIDO 0x0768-0x07bd, 30 insn»).
Detectado por `bugs-original`, que es quien perdió el viaje. Y al comprobarlo salió que **no
era un bullet: era la sección entera** — de las ocho rutinas que había declarado sin leer,
**siete están selladas en el ledger**.

Es exactamente la trampa de *la vista filtrada por lo mío lee lo ajeno como inexistente*, y
esta nota **viaja al repo público**, así que la afirmación salía de casa sin su filtro.

| rutina | ¿la he leído YO? | estado en el ledger |
|---|---|---|
| `CAST2.OVL:0x0768` `magic_door_open_worker` | no | ✅ **`verified=true`** (`asm100-censo-acta`, cuerpo entero, 30 insn) |
| `CAST.OVL:0x11de` `use_scroll` | no | ✅ `verified=true` |
| `CAST.OVL:0x135a` `use_potion` | no | ✅ `verified=true` |
| `CAST.OVL:0x153c` `bury_moonstone` | no | ✅ `verified=true` |
| `CAST.OVL:0x15b4` `use_shard_at_flame` | no | ✅ `verified=true` |
| `COMSUBS.OVL:0x0000` `int_saving_throw_dispatch` | no | ✅ `verified=true` |
| `ULTIMA.EXE:0x47f4` `kernel_moongate_teleport` | no | ✅ `verified=true` |
| `ULTIMA.EXE:0x3178` `kernel_cmd_dispatch` | **parcialmente** — sólo el esqueleto de comparación y las ramas `0x340c` (U) y `0x341a` (V) | ⬜ `verified=false` — **la única de verdad sin sellar**, y no la sello yo |

**Y el cabo que la frase mal filtrada dejaba abierto, cerrado aquí**: que el camino que SÍ
funciona **aterrice** en el worker no es pregunta de cuerpo sino de LLAMADORES, y está
medido — `CAST.OVL:0x18dd call 0xffffc16e` → stub `0x80ee` → **`CAST2.OVL:0x0768`**. La rama
buena de la llave entra en `magic_door_open_worker`, cuyo cuerpo ya estaba sellado por otro
carril. Nada de lo que afirmo aquí depende de ese cuerpo: el defecto vive en el camino que
NO llega ahí.

🔴 **PERO EL WORKER TIENE DOS LLAMADORES, Y ÉSE ES UNO.** Escribir sólo el mío documentaba
el worker **como destino de la llave** — sin decir «único», pero leyéndose como completo — y
esta nota está en APROBADAS, dentro de un corpus que **publica en inglés** que In Ex Por
«does not touch doors». O sea: mi frase verdadera reforzaba el cuadro que resulta estar
invertido. Es la tercera forma en una noche del mismo defecto mío, y la cazó `bugs-original`.
Los dos llamadores, los dos vía el mismo stub `0x80ee`:

| llamador | qué es |
|---|---|
| `CAST.OVL:0x18dd` | rama buena de la Skull Key — **lo de esta nota** |
| `CAST.OVL:0x1026` | **brazo del hechizo 26 = In Ex Por** |

**La segunda la aportó `bugs-original` y la verifiqué yo, entera, antes de escribirla aquí**
(su petición explícita fue que la cadena la atacara otro): el despachador salta por
`0x0f1a jmp word cs:[bx-0x2f3a]` y **el cardinal lo fija la GUARDA** (`0x0f0f cmp ax,0x2f /
jbe`) ⇒ 48 entradas; la tabla cae en fileoff `0x1146` (`(-0x2f3a)&0xFFFF = 0xD0C6`, menos la
base `0xBF80`); descodificada de la IMAGEN da 48/48 dentro del fichero y **48 distintas**;
y sus dos controles, que valen por ser AJENOS, cuadran — entrada 24 → `0x101a call 0x7b4`
(invocador de In Bet Xen) y entrada 25 → `0x1020 call 0x846` (sello real de An Ex Por). La
**entrada 26 → `0x1026`, cuya PRIMERA instrucción es `call 0xffffc16e`**. Un grep habría
dado 0 de 2; salió con censo por banda.

⚠️ **Lo que esto NO cierra, y no lo cierro**: `cast_command_dispatch` sigue sin leer, así que
está medido que **el brazo 26 llama al worker** pero **no bajo qué condiciones se alcanza el
brazo**. Y la consecuencia sobre `combat-spells.md`, `content-audit.md`, `cast.ts` case 26 y
el `deliberate-divergences.md` publicado **no es de esta nota**: está en manos del lead.

**Y los dos llamadores leen el retorno con cegueras COMPLEMENTARIAS** (verificado en los dos
cuerpos). El worker devuelve `0xFFFF` (getdir cancelado), `0` (no era puerta) o `1` (abierta):

```
llave   0x18e3  or  ax,ax      / jne  ⇒ separa {0} de {1, 0xFFFF}  — confunde ABIERTA con CANCELADA
hechizo 0x102c  cmp ax,0xffff  / jne  ⇒ separa {0xFFFF} de {0, 1}  — confunde ABIERTA con NO-ERA-PUERTA
```

Ninguno es superconjunto del otro. Hallazgo de `bugs-original`; la verificación en ambos
cuerpos, mía.

> 🔎 **NOTA DEL LEAD (07-08): esto ya lo dice el bloque de arriba, escrito por el propio
> autor y más completo. Sólo quedan aquí las DOS cosas que ese bloque no podía tener,
> porque ocurrieron después.**
> 
> **1 · La alcanzabilidad SÍ está cerrada, y no por esta nota.** El bloque de arriba deja
> abierto «bajo qué condiciones se alcanza el brazo 26», y hace bien: no era suyo. Se cerró
> aparte — `cast_command_dispatch` no tiene una puerta de localización, tiene **cuatro tests
> contra una máscara por hechizo** (`DS:0x1c90`), y la de In Ex Por es **`0x05` = pueblo +
> combate**. La descodificación de los bits está validada contra **siete hechizos ajenos**
> cuyos «when» ya estaban publicados, y con un control estructural: **el hechizo que SELLA
> puertas tiene la MISMA máscara que el que las abre**. ⇒ el hechizo es lanzable justo donde
> hay puertas que abrir. **Tres carriles independientes**, uno de ellos midiendo a ciegas.
> 
> **2 · Cautela OBLIGATORIA para quien redacte la retirada.** En la celda de
> `deliberate-divergences.md` que hay que corregir, **la otra mitad es CORRECTA** (el guard
> de underflow del picker, `ZSTATS.OVL:0x05ba`, re-derivado por un segundo carril sin saber
> que ya estaba publicado). **Una retractación que tumba de paso una afirmación correcta
> vecina es un error NUEVO, no una corrección.**

- **Sin grado TESTIGO**: no he corrido el original bajo DOSBox para esta fila. Todo lo de
  arriba es MEDIDO sobre el desensamblado y los ficheros de datos, más el canal indirecto
  del propio clon (§3-bis).
