# Convención de argumentos de las primitivas gráficas del kernel — FUENTE ÚNICA

> **Cita esto, no lo re-derives.** Este fichero existe porque `0x0C9C` se leyó al revés
> en DOS fuentes independientes (ledger + kernel-sweep-3, cada una mal a su manera) y el
> resultado fue el zodíaco del catalejo transpuesto entero durante semanas (#70).
> Si vas a documentar, portar o revisar cualquier dibujo vectorial del original,
> **empieza aquí**. Derivación completa y censo de consumidores en
> [`barrido-gfx-consumidores.md`](barrido-gfx-consumidores.md); instrumento
> re-ejecutable en `re/tools/gfx_consumers.py`.

## ⚠️ EL AVISO, primero

```
hline 0x0C9C  =  (x0, y, x1)
                      ↑
                 la Y VA EN MEDIO
```

**`hline` es la única de las ocho primitivas que intercala el eje.** Sus tres
argumentos son X, Y, X — no X, X, Y como sugiere el nombre, ni Y, X, X como se
transcribió mal. Ése, y no otro, fue el origen del defecto del zodíaco: la primitiva
rara. Las ocho conviven con **tres órdenes distintos** (más el estado implícito de
`line_to`), así que el nombre nunca basta.

## Las ocho firmas

| primitiva | offset | `ret` | firma | orden |
|---|---|---|---|---|
| `plot` | `0x0C64` | 4 | `plot(x, y)` | — |
| **`hline`** | **`0x0C9C`** | 6 | **`hline(x0, y, x1)`** | **X, Y, X ⚠️** |
| `vline` | `0x0CF2` | 6 | `vline(x, y0, y1)` | X, Y, Y |
| `line` | `0x0B10` | 8 | `line(x0, y0, x1, y1)` | intercalada |
| `fill_rect` | `0x0B86` | 8 | `fill_rect(x0, y0, x1, y1)` | intercalada |
| `line_to` | `0x0F90` | 4 | `line_to(x, y)` | **⚠ con ESTADO** |
| `fill_rect2` | `0x0AA6` | 8 | `fill_rect2(x0, y0, x1, y1)` | intercalada |
| `fill_rect_op` | `0x0ACE` | 0xC | `fill_rect_op(op0, op1, x0, y0, x1, y1)` | intercalada |

**⚠️ `line_to 0x0F90` no recibe origen: lo toma del CURSOR.** `0x0F96` lee `[0x52CC]`
como x0 y `0x0F99` lee `[0x52CE]` como y0, y sólo recibe el destino. Su origen es
**donde lo dejó la primitiva anterior**, así que encadenar `line` + `line_to` dibuja una
polilínea y **reordenar dos llamadas cambia el dibujo**. Es la única de las ocho con
estado implícito. ⇒ al carear una polilínea contra el port hay que comparar
**SECUENCIAS**, no conjuntos de tramos.

**En las ocho, la X va primero.** `ret N` = limpieza por el callee = **PASCAL** ⇒ los
argumentos se apilan de izquierda a derecha ⇒ **el primer `push` es el desplazamiento
`[bp+…]` MÁS ALTO**. Al leer un call-site, el primer `push` que encuentres hacia atrás
desde el `call` es el ÚLTIMO argumento.

## Por qué (los tres discriminadores, del cuerpo — no del dibujo)

- **`0x0CCD`** (recorte de `hline`): ordena `ax≤cx` y compara **AX y CX** contra
  `0x13F`=319 y contra el par de ventana `[0x52D0]`/`[0x52D2]`. **BX no se toca en
  absoluto** ⇒ AX (`[bp+8]`) y CX (`[bp+4]`) son las X; BX (`[bp+6]`) es la Y.
- **`0x0D2B`** (recorte de `vline`): compara **BX y DX** contra `0x00C7`=199 y contra el
  par `[0x52D4]`/`[0x52D6]` ⇒ son las Y. Además `0x0D01 mov cx,ax` (`x1=x0`) es lo que
  define una vertical.
- **`0x08CA`** (recorte de `plot`) acota **AX** contra el par de las X de `hline` y
  **BX** contra el par de las Y de `vline`. **`0x08E6`** (recorte de `line`/`fill_rect`)
  acota AX y CX contra 319 y BX y DX contra 199.
- Confirmación extra para `line 0x0B10`: `0x0B2D` escribe `[0x52CC]`=CX y `[0x52CE]`=DX
  y **despacha al driver `0x39` — el MISMO de `hline` — cuando BX==DX**, a `0x3C` (el de
  `vline`) cuando AX==CX y a `0x30` (el de `plot`) cuando ambos.

Los dos registros de cursor son la clave transversal: **`[0x52CC]` es X y `[0x52CE]` es
Y**. Las siete primitivas con coordenadas propias escriben ahí su coordenada final, y
`line_to` las LEE — por eso el cursor es a la vez el discriminador de eje y el canal de
estado entre llamadas.

**Dos entradas al MISMO relleno.** `fill_rect 0x0B86` y `fill_rect2 0x0AA6` tienen firma
idéntica, el mismo recortador `0x08E6` y la misma entrada de driver `0x3F`; se
diferencian sólo en `stc` vs `clc`. La gema usa `0x0AA6`; el chrome de combate usa
`0x0B86`. Citar «el fill» sin el offset es ambiguo.

**No son de la familia (aunque compartan driver):** `0x0BAE` (`ret 2`) fija ESTADO y no
toma coordenadas; `0x16BA` (`ret 2`, 380 llamadas) es el IMPRESOR DE FONT y dibuja en el
cursor. Ninguna de las dos cuenta como superficie vectorial.

## Cómo comprobarte en 10 segundos (control con datos reales)

La pantalla es **320×200**, luego **un inmediato > 199 NO PUEDE ser una Y**.

```bash
python3 re/tools/gfx_consumers.py --bounds
```

Recorre los argumentos que son inmediatos literales de los 179 call-sites del corpus: **0 violaciones** con estas firmas, **19** con las firmas transpuestas (el
control negativo corre en la misma invocación y el comando devuelve exit 1 si dejara de
discriminar). Muerde porque hay constantes grandes reales — `0x107`=263, `0x137`=311,
`0x138`=312 en el chrome del panel derecho — que bajo el convenio invertido caerían en
posición-Y. **Es una confirmación que no depende de haber leído bien los recortadores.**

## Errores concretos ya cometidos (para reconocerlos)

1. **Zodíaco transpuesto (#70).** `hline` leída con la Y primera ⇒ constelación
   reflejada en la diagonal, antenas de la estrella giradas 90°, conector al revés. La
   nota se delataba sola: usaba como x la tabla que ella misma etiquetaba «row», y
   transcribía un recorte que acota el argumento que sale de la tabla de COLUMNA.
2. **`draw_zodiac_lines` documentada como 8 `hline`** cuando `0x6A62` resuelve a
   `vline 0x0CF2`. Los inmediatos eran correctos; lo que cambiaba era qué eje avanzaba.
3. **Primitiva invisible para el barrido lineal.** El `.asm` commiteado NO muestra el
   prólogo de `line_to 0x0F90`: hay un byte de relleno `00` en `0x0F8F` que capstone se
   traga como `add byte ptr [di-0x75], dl` (bytes `00 55 8b`), devorando el `55 8b` del
   prólogo real. Los call-sites sí decodifican bien, pero quien busque rutinas por
   `push bp; mov bp,sp` **no la encuentra**. Si una primitiva «no existe» en el `.asm`,
   sospecha del alineamiento antes que de su ausencia.
4. **Rótulo que señala un bloque, no una rutina.** «chrome `0x4daa`/`0x4efc`»: esas dos
   direcciones son el `push [color]` que abre cada bloque de dibujo, no entradas de
   rutina (las rutinas son `0x4d76` y `0x4e50`). Al reutilizar una cita así, di si
   apuntas a la rutina o al bloque.

## Reglas de higiene al citar

- Copia la firma **con su `ret N`**. El `ret` es lo que fija el número de argumentos y la
  convención; sin él la firma no es verificable.
- Si afirmas una conducta de dibujo, cita **el call-site** (`módulo @offset`) y **el
  recortador** que sostiene el eje, no sólo la primitiva.
- Los `.asm` de overlay llevan direcciones **file-relativas** y sus etiquetas de
  near-call **mienten**: `kernel = (target + base) & 0xFFFF`, con `base` de
  `dispatch_table.overlay_near_call_base` (fuente única). Un `call 0x69d4` en LOOKOBJ es
  `plot 0x0C64`, no una rutina local.
- Antes de aprobar una cita nueva de estas primitivas, corre `--bounds`. Es gratis.

## ★ T10 (#82) — la premisa VERIFICADA a mano, y una trampa de lectura

**La premisa de #82 se confirma leyendo `gfx_line_to` (ULTIMA.EXE `0x0f90`, `IDENT` en
frontier.json).** Su cabeza es:

```
0f90: 55                push bp
0f91: 8bec              mov bp, sp
...
0f96: a1cc52            mov ax, word ptr [0x52cc]     ; ← X del cursor
0f99: 8b1ece52          mov bx, word ptr [0x52ce]     ; ← Y del cursor
```

⇒ arranca del cursor que dejó **la primitiva anterior**, no de un origen propio. Los
escritores de ese cursor son `0x0b2d/0x0b31`, `0x0c70/0x0c73`, `0x0cab` y `0x0d03` (8 accesos
en total al par 0x52cc/0x52ce). **Por tanto el ORDEN de llamadas es semántica**: reordenar
dos `line_to` cambia el dibujo aunque el CONJUNTO de tramos sea idéntico, y ningún test que
compare conjuntos lo detectaría.

⚠ **Trampa al leer esta región**: el barrido lineal del disasm entra desalineado —`0f8f:
00558b add byte ptr [di - 0x75], dl` se come los dos primeros bytes del prólogo, y la línea
siguiente sale como `0f92: in al, dx`—. El prólogo `55 8b ec` está ahí; lo que falla es el
encuadre, por un byte de relleno en 0x0f8f. Quien lea `0x0f8f-0x0f92` en crudo verá basura y
puede concluir que la rutina no existe. **No es un prólogo oculto sin fichar** (la familia de
#80): `gfx_line_to` YA está en el frontier como IDENT — es sólo el encuadre del volcado.

**Lo que queda de #82** es el lado del PORT: verificar que los consumidores portados que
calcan secuencias encadenadas preservan la SECUENCIA y no sólo el conjunto. La premisa ya no
hay que creérsela.

### T10 — el lado del PORT: VEREDICTO NEGATIVO (el riesgo no aplica), y por qué

El port **no arrastra el peligro de reordenación**, y no por suerte: `skin/fiel/frame.ts`
declara la polilínea y acto seguido la **APLANA a segmentos absolutos**. Su propia línea 67
lo dice — «polilínea y `point` la continúa. Aquí, **aplanados a segmentos explícitos**» — y
cada `Segment {x0,y0,x1,y1}` lleva anotado el offset del `point` que lo produjo.

Con eso, reordenar dos entradas de `FRAME_SEGMENTS` **no cambia el dibujo**: cada segmento
lleva sus dos extremos. El riesgo que T10 buscaba (un refactor que agrupe por color o por
primitiva y rompa el trazo sin fallar un test de conjunto) **no existe en esta
representación**. Y el censo lo confirma por el otro lado: `point(` no tiene NINGÚN
consumidor fuera de `frame.ts` (los `ctx.lineTo` de `debug/teleportPicker.ts` son la API de
Canvas, no un calco del kernel).

★ Pero eso mueve la pregunta en vez de borrarla: si el port aplana, **el aplanado tiene que
ser correcto**, y un error ahí sí produce un trazo malo. Comprobada a mano la cadena de la
caja del viewport (`ULTIMA.EXE 0x6455-0x6477`), que es `line` + tres `point`:

| ASM | extremo que fija | segmento del port | encadena |
|---|---|---|---|
| `0x6464 point` | (0xb8, 0xb8) | (0x07,0xb8)→(0xb8,0xb8) | ✓ arranca donde acabó el `line` previo |
| `0x646f point` | (0xb8, 0x07) | (0xb8,0xb8)→(0xb8,0x07) | ✓ |
| `0x6477 point` | (0x07, 0x07) | (0xb8,0x07)→(0x07,0x07) | ✓ |

Los tres encadenan: el inicio de cada segmento es el final del anterior, y los extremos
coinciden con los inmediatos empujados (`mov ax,0xb8`/`mov ax,7`). **El aplanado es correcto
en la cadena comprobada.** No se han verificado a mano las 22 cadenas del censo — lo que sí
queda es que la ANOTACIÓN por offset hace la comprobación posible una a una para quien
quiera cerrar el resto.
