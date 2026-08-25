# ACTA #248 — de las dos rutinas de `DNGLOOK` sobre `0xAD14`, sólo UNA es dueño nuevo

> El título de partida («DNGLOOK como tercer dueño, con dos rutinas») era el de la
> tarjeta, heredado de mi #244, y esta acta lo corrige en §2 y §3. Se deja dicho aquí
> arriba para que la cabecera no contradiga al cuerpo.

> Rama `re/lectura-244` (misma que #244, commit encima, como pidió el lead).
> Base main `7dc4f360`; #244 aterrizado en main `b1db4f86` (picado — blob del acta
> idéntico, `dd1e4e44`; **no** ancestro, y eso es lo esperado de un pick).
> `re/ledger/globals.json` verificado SIN DERIVA entre mi base y main (`6f74e7e2` en
> los dos), así que una edición mía no choca al picar.
> RETENIDA: aterriza el lead.

---

## 0. QUÉ TRAE ESTA TARJETA Y CUÁL ES LA REGLA

#244 dejó escrito que `0xAD14` tiene un **tercer overlay dueño** que ni el acta de #219 ni
la ficha del ledger nombran (y ese encuadre es MÍO y sale corregido en §3): `DNGLOOK.OVL`, con dos rutinas —`0x06a8` y `0x0d3e`— y una
**tercera extensión**, 736 (`0x2e0`), en `DNGLOOK.OVL:0x06dd`.

**La regla que el lead subrayó y que gobierna esta acta**: la hipótesis obvia —que
`DNGLOOK` sintetiza en `0xAD14` la ventana de tiles que el renderer estándar espera,
porque en mazmorra `g_location` ≥ `0x80` y `tile_addr` lee de ahí— **es HIPÓTESIS, no
derivación**. No se escribe en el ledger sin leer **las dos rutinas enteras**. Si tras
leerlas la semántica no queda derivada, **la ficha se queda como está y esta acta lo dice**.

Tamaño del material, medido antes de leer nada: la rutina `0x06a8` son **169** instrucciones
(`0x06a8`-`0x0842`); `0x0d3e` son **324** (`0x0d3e`-`0x109d`). 493 en total, las dos
enteras.

---

## 1. ★ PREDICCIÓN PRE-REGISTRADA (escrita ANTES de abrir las rutinas)

Lo que ya sabía al escribir esto, y que no cuenta como predicción: los fragmentos que #244
citó de paso (en `0x06dd`, una limpieza de 736 a `0xFF`; en `0x0d4b`, la siembra de 11 filas × 11 B a paso 32
cerrando por `cmp si, 0xae74`; y en `0x0705`, la escritura de `0` en `0xae7f`). Todo lo demás está sin
leer.

**P1 — El 736 NO es arbitrario: la rutina escribe POR ENCIMA de los 352 del registro
`.CBT`.** Si `0x06a8` sólo tocara `[0xAD14, 0xAE74)`, limpiar 736 sobraría.
*Ancla ya vista*: el `0x0705`, que escribe en `0xAE7F` = `+0x16b` = **363 > 352**. Predigo
que **no es el único** y que aparecen más escrituras en `[0xAE74, 0xAFF4)`.
**FRACASA si** `0xAE7F` resulta ser la única escritura por encima de 352.

**P2 — Las dos rutinas viven en la fase `g_location` ≥ `0x80`**, coherente con que
`tile_addr` (`ULTIMA.EXE:0x4402`) lea el terreno de `0xAD14` en esa fase.
**FRACASA si** alguna corre demostrablemente con `g_location` < `0x80`.

**P3 — La geometría de `0x0d3e` es la MISMA rejilla 11×11 a paso 32 de #68**, y sus
escrituras a columnas ≥ 11 caen en el relleno del paso, igual que los metadatos del `.CBT`.
**FRACASA si** aparece una segunda geometría incompatible (otro paso, u otro ancho).

**P4 — el que de verdad arriesga: encontraré un CONSUMIDOR del contenido** —alguien que
LEA `0xAD14` después de que estas rutinas lo escriban— y podré nombrarlo con cita.
**FRACASA si** tras leer las dos enteras no hay lector identificable dentro del corpus.

**P5 — DECISIÓN SOBRE EL LEDGER, pre-registrada para no racionalizarla después**: doy
**~60 %** a que la semántica quede derivada lo bastante para una frase con cita, y **~40 %**
a que NO y la ficha se quede intacta. Dejo dicho por delante que **el 40 % es un resultado
legítimo, no un fracaso del carril**: la tentación de esta tarjeta es escribir la
hipótesis bonita porque «encaja».

---

## 2. VEREDICTO, primero

**Las dos rutinas NO hacen lo mismo, y sólo UNA es un dueño nuevo.**

| rutina | qué es `0xAD14` para ella | ¿dueño nuevo? |
|---|---|---|
| `DNGLOOK.OVL:0x06a8` + su cuerpo por celda `0x0340` | **búfer de VISITADOS** del flood-fill del View Gem de mazmorra: rejilla de DISPLAY 22×22 al mismo paso 32, `0xFF` = sin visitar, `0` = ya dibujada | **SÍ — tercer uso, y no se parece a ninguno de los dos de #219** |
| `DNGLOOK.OVL:0x0d3e` | **el MISMO registro `.CBT`** que el ledger ya ficha — pero **sintetizado en memoria** en vez de cargado de disco | **NO — es un segundo PRODUCTOR del dueño que ya existe** |

★ **Y la hipótesis bonita que la tarjeta puso sobre la mesa está REFUTADA.** «DNGLOOK
sintetiza en `0xAD14` la ventana de tiles que el renderer espera porque `tile_addr` lee de
ahí» es falsa para las dos rutinas: la del gem **no pasa por `tile_addr`** en absoluto (es
un mapa de visitados, no de terreno), y la de `0x0d3e` sí produce el registro pero **para
la vía de campamento/emboscada**, no para alimentar al renderer de ventana. La derivación
real es más específica y más útil que la hipótesis.

---

## 3. ★ CORRECCIÓN DE MI PROPIO #244 (ya aterrizado en main `b1db4f86`)

Antes de nada, porque afecta a texto que el lead ya picó. #244 escribió: «hay un **tercer
overlay dueño**, ausente del acta de #219 y de la ficha del ledger: `DNGLOOK`, con dos
rutinas —`0x06a8` y `0x0d3e`—». Eso tiene **dos defectos**, los dos míos:

**(a) CONFLACIÓN.** Metí las dos rutinas en el mismo saco. `0x06a8` sí es un dueño nuevo;
`0x0d3e` **no lo es**: produce la estructura que la ficha ya describe. Decir «dos rutinas
del tercer dueño» era incorrecto.

**(b) ★★ EL DEFECTO SERIO — «ausente de la ficha» lo leyó cualquiera como «nadie lo
sabía», y eso es FALSO.** El repo ya lo tiene, en dos sitios, y yo no crucé el repo antes
de elevarlo:

- `docs/verdicts/gem-flood/README.md` documenta el flood del gem **entero y bien**:
  driver es `0x06a8`, con colas X `0xa528` / Y `0xa628`, «buffer de visitados de 22×32 en
  `0xad14` inicializado a `0xFF`», centro pre-marcado en `0x0705`, `0x0340` con su gate
  `0..0x15` y su tabla de saltos. **Mi lectura de hoy coincide con la suya punto por
  punto** — que dos lecturas independientes converjan es valioso, pero el hallazgo **no
  es mío**.
- `re/notes/cbt-unidades-0-0-y-cruce-movil.md` ya identifica el `0x0d3e`, como «el
  **constructor de arena SINTÉTICA** de campamento/emboscada (`test [g_unk_58a1], 4`)».

⇒ **Lo correcto es: la ficha del ledger y el acta de #219 no cruzaban con dos documentos
que ya lo tenían.** El defecto es de **cruce entre documentos**, no de conocimiento
ausente. Es exactamente la lección que ya tengo escrita —*cruza el repo antes de
elevar*— y me la he vuelto a saltar, esta vez con el coste de un titular exagerado en un
acta aterrizada. **Pido al lead que este §3 viaje pegado a la corrección de la ficha.**

---

## 4. USO NUEVO: el búfer de VISITADOS del View Gem (derivado, no heredado)

Leído en `0x0340` (339 instrucciones, entera). Lo que lo fija, con cita:

| offset | instrucción | qué prueba |
|---|---|---|
| `0x034d`-`0x0363` | `cmp word ptr [bp + 6], 0` / `jl` · `cmp word ptr [bp + 6], 0x15` / `jg` · ídem con `[bp + 4]` | **límites 0..21 en los DOS ejes ⇒ 22×22** |
| `0x036a`-`0x0374` | `mov si, word ptr [bp + 4]` / `mov cl, 5` / `shl si, cl` / `add si, word ptr [bp + 6]` / `add si, 0xad14` | **índice = (fila<<5) + col + base ⇒ paso 32** |
| `0x0378` | `cmp byte ptr [si], 0` / `jne` | **lee**: si ya vale 0, sale sin dibujar |
| `0x0385` | `mov byte ptr [si], 0` | **escribe**: marca visitada |
| `0x0388`-`0x03ab` | `add ax, [g_party_x]` / `sub ax, 0xb` / `and ax, 7` (ídem con `g_party_y`) | ventana **centrada en la party** y **wrap toroidal** a la planta 8×8 |
| `0x03c1` | `mov al, byte ptr [bx + di + 0x595a]` con `bx = g_floor << 6` | el TERRENO se lee de **`g_dng_map`**, no de `0xAD14` |

**Aritmética de la extensión, medida:** el byte más alto que el gate permite es
`(21 << 5) + 21 = 693`. La limpieza de `0x06dd` es `0x2e0` = **736** = 23 filas × 32. Las
22 filas del display son 704. ⇒ **736 es la extensión ESCRITA y 704 la lógica**; el
binario limpia **una fila de más**. El verdict del gem dice «22×32», que es la lógica; la
cifra que la ficha debe llevar es la escrita, con las dos declaradas.

★ **`0xFF` no es «relleno»: es el estado SIN VISITAR**, y las celdas que nunca se alcanzan
se quedan así y no se dibujan (de ahí el negro del gem). El `0` no es «vacío»: es
**visitada**. Polaridad opuesta a la del pase de luces de #219, sobre la misma dirección.

---

## 5. `0x0d3e`: NO es dueño nuevo — es el registro `.CBT` SINTETIZADO (y consume RNG)

Leída entera (`0x0d3e`-`0x0fd8`). Construye en `0xAD14` la misma estructura que la ficha
ya describe, campo por campo:

| offset | escribe | dónde cae |
|---|---|---|
| `0x0d4b`-`0x0d65` | rejilla 11×11 con un tile de fondo, `add si, 0x20`, cierre `cmp si, 0xae74` | cols 0-10 de 11 filas = **352 B exactos** |
| `0x0d7d`/`0x0d81` | `0xFF` ×8 en `[si - 0x51d9]` y `[si - 0x51e1]` | `0xAE1F` = fila 8 col 11 · `0xAE27` = fila 8 col 19 — **y `COMBAT.OVL:0x1138`/`0x113b` los LEE** |
| `0x0d8e`-`0x0e4b` | bloques desde tablas propias (`0x2452`…`0x2470`) | filas 1-4, cols 11-16 = **posiciones de entrada** |
| `0x0e53`-`0x0ead` | según `g_dng_facing` | filas 6-7, cols 11-26 = **posiciones de las unidades** |
| `0x0f04`-`0x0f3a` | **Fisher-Yates de 16** y `mov byte ptr [di - 0x5241], 0` | `0xADBF` = **fila 5 col 11** = el plantel |
| `0x0fc8` | `mov byte ptr [bx - 0x5241], al` con `al = (i<<2) + 0x40` | mismo array, códigos de unidad |

**Consumo de RNG, derivado**: `call 0x7e02` = thunk del kernel `0x2092` `rand_range(min,
max)` —convención ya fijada en el repo por ≥8 notas independientes—, con **16 tiradas
`rand(0,15)`** en el barajado (`0x0f04`-`0x0f3a`), más `rand(0,7)` (`0x0f49`) y
`rand(1,N)` (`0x0f6a`). Mecánicamente relevante: **mueve el stream**.

### 5.1 ★ Aportación real a un cabo ajeno: el escritor de la FILA 5 existe

`re/notes/cbt-unidades-0-0-y-cruce-movil.md` anota, en su tabla de «dónde NO está»:
«`0xADBF` (fila 5 resuelta) — **sin coincidencias en ningún `.asm`**». **Es un cero en
falso**, y por el mismo mecanismo que esa misma nota documenta dos párrafos más abajo (el
compilador pliega `base + fila*32` en una constante por fila). La nota lista **tres**
bases plegadas, todas de LECTURA: `-0x524c`, `-0x522c`, `-0x520c`. Falta la **cuarta, de
ESCRITURA**: `[reg - 0x5241]`, y `(-0x5241) & 0xFFFF = 0xADBF`.

⚠ **Lo que esto NO cierra, dicho por delante**: esa nota busca el **consumidor** de la vía
de **SALA de mazmorra**, y `0x0d3e` es la vía de **campamento/emboscada**. Aporto un
**escritor** y una **cuarta forma plegada** que invalida un cero concreto; **no** cierro
el sapo de las unidades de sala, que sigue FUNDADO-NO-CONFIRMADO y cuyo siguiente paso
sigue siendo el que la nota ya dejó apuntado (`DNGLOOK.OVL 0x117E`).

---

## 6. Las predicciones, adjudicadas una a una

| | resultado |
|---|---|
| **P1** — el 736 no es arbitrario; hay escrituras por encima de 352 | ✅ **ACIERTA, y por goleada**: el gate llega a **693**, no sólo el `0xAE7F` que ya tenía visto |
| **P2** — fase ≥`0x80` coherente con `tile_addr` leyendo de `0xAD14` | ❌ **El RAZONAMIENTO está REFUTADO.** El uso del gem no pasa por `tile_addr` ni toca terreno: lee `g_dng_map`. La premisa era mía y era falsa |
| **P3** — misma rejilla 11×11 a paso 32 de #68 | ⚠️ **MEDIA**: el **paso 32 acierta**; el **extento no** — el gem es 22×22, no 11×11. Dos geometrías distintas al mismo paso conviviendo en la misma dirección |
| **P4** — encontraré un consumidor y lo nombraré | ✅ **ACIERTA**: `0x0378` (el propio gem se autoconsume) y `COMBAT.OVL:0x1138`/`0x113b` para la fila 8 del registro sintético |
| **P5** — ~60 % ficha editable / ~40 % intacta | ✅ **sale el 60 %**, con la reserva grande de §3: la semántica era derivable **y ya estaba derivada en el repo**; lo que faltaba era el cruce |

**Balance honesto del predictor**: 2 aciertos limpios, 1 medio, 1 refutación de mi propio
razonamiento. Es una tasa **mucho** más informativa que el 14/14 de #244 — porque aquí el
espacio de resultados no era degenerado.

---

## 7. ★ DEFECTO DE MI PROPIO INSTRUMENTO (cazado leyendo)

El volcador de rutinas que escribí para esta tarjeta corta «en el `ret` anterior al
siguiente prólogo (`push bp` + `mov bp, sp`)». Con eso **fusionó `0x0d3e` con la rutina
siguiente**: dio 324 instrucciones y se estiró a `0x109d`, cuando la rutina acaba en `0x0fd8`.
`0x0fda` es una rutina **SIN MARCO DE PILA** —el despachador de movimiento de mazmorra,
`g_unk_58a0` 1..6, que envuelve `g_party_x/y` a 0..7, mueve `g_floor` y pone
`g_location = 0` al salir— y por eso el heurístico no la vio empezar.

Es **la familia de #90** (42 llamadas invisibles a la atribución por prólogo), reapareciendo
en un instrumento nuevo escrito hoy. Lo cacé porque leí la salida entera en vez de fiarme
del corte. **Regla para quien reutilice el volcador: su límite superior es una COTA, no el
final de la rutina.**

---

## 8. LO QUE SE HA TOCADO EN EL LEDGER (y cómo)

`re/ledger/globals.json`, entrada `g_cbt_room_record` @`0xAD14`, **dos campos**, por
**sustitución de cadena** (jamás round-trip de JSON — impondría su formato). El `--stat`
lo delata: **`2 insertions(+), 2 deletions(-)`**, exactamente las dos líneas mías, sin
reformateo del resto. JSON revalidado tras la edición (194 globales, `size` 352 y
`stride` 32 intactos).

- `meaning` ← se **conserva** todo lo anterior y se añaden **dos bloques `||`** (convención
  de `g_cmb_scratch_x/y`): el tercer uso (gem, 22×22@32, 693 tope, 736 escritos) y el
  segundo productor (`0x0d3e` sintético + RNG).
- `evidence` ← se conserva y se añaden las citas del driver/cuerpo del gem y el escritor
  de la fila 5 con su cuarta base plegada.

**`size` y `stride` NO se tocan.** El `size: 352` sigue siendo el del registro que da
nombre a la entrada; las otras extensiones (736 escritos por el gem, 1024 direccionables
del pase de luces) van declaradas en el texto, que es lo que #219 ya decidió y esta
tarjeta no revoca.

## 9. Lo que este carril NO ha hecho

- **No he tocado `re/notes/deriv-219-acta.md`** ni el acta de #244 ya aterrizada: la
  corrección de §3 se declara aquí y la aplica el lead si quiere.
- **No he cerrado el sapo de las unidades de sala** (§5.1).
- **No he derivado el llamador de `0x06a8`** ni en qué fase corre; el verdict del gem dice
  que no hay caller dentro de `DNGLOOK` y que lo invoca el despachador externo.
- **No he tocado `re/tools`, `game/src` ni `main.ts`.** Nada de e2e.

## 10. Cabos

1. **Cruce ficha↔verdicts**: ¿cuántas entradas más del ledger tienen un `docs/verdicts/`
   que las contradice o las amplía y que nadie cruzó? Este caso salió por casualidad.
2. **La cuarta base plegada** (§5.1): re-barrer `0xAD14` por **todas** las formas plegadas
   `base + fila*32`, no sólo las tres que la nota lista.
3. **El volcador de rutinas ciego a las frameless** (§7): si se cablea a `re/tools`, con
   el gate de #90 delante.

## 11. Overlays nombrados aquí (sección FINAL a propósito)

`DNGLOOK.OVL`, `DUNGEON.OVL`, `COMBAT.OVL`, `ULTIMA.EXE`.
