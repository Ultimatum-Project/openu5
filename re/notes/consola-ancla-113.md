# La ventana de consola: TRECE filas y el cursor pegado abajo (#113)

> Derivación del descriptor de la ventana de texto de la CONSOLA y del régimen de
> anclado con que se llena, contra la piel fiel del port. Nace de un reporte del
> USUARIO mirando el frame 16/16 del vídeo split-screen DOSBox‖port: «en el original
> la línea de entrada vive pegada al borde inferior; en el port flota con vacío
> debajo». Complementa `ui-text-layer.md` §3–§4, que derivó la ESTRUCTURA del
> descriptor y el algoritmo de `putchar`/`print_string` pero dejó los VALORES como
> chrome de S8b («viven en la tabla `0x535e` inicializada en runtime»).
>
> Autoridad: asm verbatim. Los frames de 1988 se usan de testigo, no de fuente.

---

## 1. Los valores SÍ están en el binario, y no en la tabla estática

`ui-text-layer.md` §3 los daba por no-derivables desde el disasm porque la tabla
`0x535e` se inicializa en runtime (el init `0x1184` deja los cuatro descriptores a
pantalla completa 40×25). Es cierto que la TABLA no los lleva; lo que sí los lleva es
el **configurador**, y su llamador vive en un overlay, no en el kernel.

`set_text_window` = **ULTIMA.EXE:0x1c22**. Firma leída del cuerpo (`0x1c28-0x1c51`):

| stack | registro | destino | campo |
|---|---|---|---|
| `[bp+0xc]` | `bx` | índice de ventana (`si = 0x535e + idx·8`) | — |
| `[bp+0xa]` | `al` | `[si+0]` | `leftCol` |
| `[bp+8]`  | `bl` | `[si+1]` | `topRow` |
| `[bp+6]`  | `cl` | `[si+2]` | `rightCol` |
| `[bp+4]`  | `dl` | `[si+3]` | `botRow` |

Los cuatro se acotan antes de escribirse (`0x1c5b-0x1c9d`: col a 0..0x27, fila a
0..0x18) y se ordenan por pares si vinieran cruzados. Los pushes van en orden
izquierda-a-derecha, así que el PRIMER `push` es el índice.

**El bloque que monta la pantalla de juego son tres llamadas seguidas, en
INTRO.OVL:**

```
0d00:  set_text_window(0, 0x00, 0x00, 0x27, 0x18)   ; pantalla entera, 40×25
0d17:  set_text_window(1, 0x18, 0x01, 0x27, 0x09)   ; PANEL  — cols 24..39, filas 1..9
0d2e:  set_text_window(2, 0x18, 0x0b, 0x27, 0x17)   ; CONSOLA — cols 24..39, filas 11..23
```

⇒ **la consola son 16 columnas × TRECE filas, 11..23.** La fila 10 que queda entre
panel y consola es la barra azul del marco.

★ **El orden de argumentos no se supone: lo ancla la ventana HERMANA.** La 1 sale
`cols 24..39 × filas 1..9`, que es exactamente el roster del panel derecho tal y como
se ve en cualquier captura. Con cualquier otra lectura del orden esa fila daría un
rectángulo que no existe en pantalla. (Y la 0 sale pantalla completa, el otro extremo
reconocible.) Es el control que hace que la lectura de la 2 no dependa de mi palabra.

🔴 **Un índice NO identifica una llamada.** El mismo overlay reconfigura la ventana 0
unas instrucciones antes (`0x0ce3`: `(0, 1, 0x10, 0x26, 0x17)`, una ventana de
trabajo). Quien busque «la llamada con índice 0» se queda con ésa y describe otra
pantalla. Lo que identifica al bloque es la TERNA CONSECUTIVA 0/1/2 al mismo destino.

## 2. El régimen de llenado: es un TERMINAL, el hueco queda ARRIBA

`putchar 0x16ba` (`ui-text-layer.md` §4) hace `abs row = topRow + curRow`; si
`abs > botRow`, el driver desplaza la ventana una línea y **`dec curRow`** deja el
cursor otra vez en la última fila (`0x1745-0x1767`). Consecuencia: la ventana sólo
tiene el cursor por encima de `botRow` mientras se llena la PRIMERA vez; de ahí en
adelante el cursor NO vuelve a subir, cada línea nueva empuja lo anterior hacia arriba
y la línea de entrada (`►` + cursor de ola) vive pegada a la fila 23.

## 3. Lo que hacía el port, y lo que costaba (medido sobre el vídeo)

`CONSOLE_RECT` (game/src/skin/fiel/skin.ts) tenía **`botRow: 22`** — doce filas — con
una cita al lado que nadie había careado contra el `.asm`. Y `layoutConsole`
(fiel/console.ts) **reconstruye la rejilla en cada frame** desde el último tramo del
log: cada render arranca con el cursor en (0,0), como si el juego acabara de empezar,
así que un tramo más corto que la ventana se pinta pegado ARRIBA con el hueco DEBAJO.
Dos defectos independientes, el mismo síntoma.

**Testigo A — frame 16/16** (`original/av-referencia/_split2/`, escena
`overworld_day_cuadrado`). Censo de filas con tinta en la columna de la consola:

| | filas ocupadas | prompt |
|---|---|---|
| original | 12..21 (blanco en 11 y 22) | **fila 23**, y=184..191 |
| port ANTES | 11..20 (blanco en 21) | fila 22, y=176..183 |

El contenido era el MISMO renglón a renglón — sólo desplazado una fila. El espaciado
entre entradas (el blanco de turno) ya era fiel: **ese eje NO divergía.**

**Testigo B — frame 0**, el que separa los dos defectos: el original enseña «►Pass» y
el prompt en las dos ÚLTIMAS filas con diez en blanco encima; el port los ponía en las
dos PRIMERAS. Ahí no hay corrimiento de una fila que valga: es el ancla.

## 4. Careo antes/después (mismo instrumento, misma escena)

`tools/splitscreen/carea_frames.py` sobre los 17 frames, región `console`
(`[192,88,318,191]`, `strict_ink` — abarca la fila 23, comprobado antes de citar la
cifra):

| | mín | media |
|---|---|---|
| antes | 0,000 | **0,034** |
| después | 0,269 | **0,806** |

Las cinco regiones JUZGADAS (viewport, viewport_light, sky_band, panel_roster,
panel_stats) no se mueven, y la posición de la party es idéntica en los 17 frames.

**Residuo declarado, y es de OTRA clase:** los frames 0-3 se quedan en 0,27-0,77
porque el port imprime un «Welcome to Britannia!» de arranque que el original no
tiene. Es divergencia de CONTENIDO del log, no de geometría — cabo aparte.

## 5. Lo que se calcó

- `CONSOLE_RECT.botRow` 22 → **23**, con el descriptor citado.
- `TextWindow.anchorBottom()` (fiel/textwindow.ts): desplaza la rejilla hasta que el
  cursor cae en la última fila, dejando el hueco arriba. Equivale a decir «antes de
  este tramo hubo N scrolls más», que es la verdad del terminal. `layoutConsole` lo
  llama al final. **No-op con la ventana llena** (el caso corriente tras unos turnos),
  así que el pintado de un log largo no cambia ni un píxel.
- El portrait (móvil) hereda la fila: `LOG_H` 12→13 filas. No es cosmético — con doce
  la columna del log recortaba justo la fila donde vive la línea de entrada. Arrastra
  `BAND_SRC_H` 104→112 y `PANEL_STRETCH_ROWS` 16→24, y en APAISADO el canvas pasa a ser
  ~2 % más estrecho (la banda apilada mide ya lo mismo que el bloque de mapa, 192, así
  que las dos columnas se limitan por la misma altura y el ancho sale `320·s` redondo).

**Cero RNG**: sonda `__u5rng` sobre la secuencia completa, `n=43 seed=61727` idéntico
antes y después. Es presentación.

## 6. Lo que esto deja escrito para el próximo

★★ **Una cita al lado de una cifra no es una comprobación de la cifra.** El `botRow: 22`
llevaba meses con su comentario derivado; lo que faltaba no era la cita, era algo que
la CAREARA. Hoy lo hace `re/tools/test_consola_rect.py`, que re-extrae los cinco
argumentos del disasm en cada corrida —no los copia del comentario— y los compara con
el literal del port.

🔴 **Y el recorte del instrumento heredó la cifra vieja.** `tests/log-scroll.test.ts`
definía el área de consola a mano (`24 / 11 / 22`); al mover `botRow` el filtro dejó
fuera la fila 23, justo donde el ancla pone la línea MÁS NUEVA, y los asertos «la
última línea se pinta» se cayeron sin que el pintado tuviera nada mal. Un recorte
escrito con las cifras del sujeto caduca cuando el sujeto se mueve: se deriva.

🔴 **Un testigo puede perder los dientes por un cambio de geometría ajeno al aserto.**
`apaisado-rail-sobrante.test.ts` vigilaba que el ancho del canvas se redondee con
`ceil` usando un hueco cuyo valor exacto era 559,64 — fraccionario, `ceil ≠ floor`. Con
la consola de 13 filas ese mismo hueco da 550,0 EXACTO, y sobre un entero los dos
redondeos coinciden: el aserto habría seguido VERDE con el redondeo roto. Se cambió el
testigo a un hueco que vuelve a dar fraccionario y se verificó matando el mutante
`ceil`→`floor`.
