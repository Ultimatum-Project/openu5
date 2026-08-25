# Carteles (L)ook — `decode_sign_text` completo (LOOKOBJ.OVL:0x06F8)

Derivación entera del decodificador de carteles de SIGNS.DAT, incluida **la tabla de
macros `DS:0x37be`** que la ficha #198 daba por bloqueada tras una sonda de DOSBox: no
hace falta emulador. La tabla resuelve en `DATA.OVL` con la convención cross-validada
`fileoff = DS + 0x10`.

## 1. El bucle, tramo a tramo

`decode_sign_text(bp+4 = offset del registro)` — el búfer del cartel vive en `DS:0xB21E`
(el disasm lo imprime como `[si - 0x4de2]`).

| dirección | qué hace |
|---|---|
| `0x0724` | `add word [bp+4], 4` — salta la cabecera de 4 bytes (loc, planta, x, y) |
| `0x072e-0x0736` | **cabecera de relleno**: mientras `byte[si] == 0x0a`, `add si, 6` |
| `0x0744-0x0752` | **fuente**: `test [bp-4],0x80` → `set_font(0x7a0e)`. Bit alto PUESTO ⇒ font 0 = `IBM.CH`; bit alto CLARO ⇒ font 1 = `RUNES.CH` |
| `0x0755-0x0764` | `0x26` y `0x27` ⇒ emiten **`0x6c`** (arista horizontal). Es la línea divisoria de las leyes de Blackthorn |
| `0x0766-0x0798` | `0x29..0x31` ⇒ **MACRO**: fuerza font 1 y vuelca la cadena de `[bx + 0x37be]`, con `bx = byte * 2` |
| `0x079a-0x07ac` | `0x0d` ⇒ font 0 + `call 0x83dc` = `getkey_with_redraw`: **espera una tecla**. No imprime y no abre fila; es la pausa de página |
| `0x07ae-0x07b7` | por defecto: `and ax,0x7f` + `putchar (0x742a)` |

🔴 **La indexación de la tabla es por el BYTE ENTERO, no por `byte − 0x29`**
(`mov bl,[bp-4]; sub bh,bh; shl bx,1; mov si,[bx+0x37be]`). Las nueve entradas útiles
viven en `DS:0x3810..0x3820`, no al principio de la tabla.

🔴 **`0x0d` NO es un salto de línea.** Los saltos son `0x0a` y `0x8a`: el `and ax,0x7f`
del tramo por defecto los convierte en el mismo carácter, y el putchar del kernel lo
trata como fin de línea. Un port que lea `0x0d` como salto añade filas donde el original
espera una tecla.

## 2. La tabla de macros — `DS:0x37be`, nueve cadenas de 16 bytes

Punteros consecutivos con paso `0x12` (16 + NUL + 1 de relleno). **Todas miden
exactamente 16 bytes = una fila entera de la consola.**

| byte | puntero | contenido | qué es |
|---|---|---|---|
| `0x29` | `DS:0x7388` | `67 20×14 67` | fila de cuerpo vacía |
| `0x2a` | `DS:0x739a` | `6a 6c×7 6e 6c×6 6b` | marco inferior con púa |
| `0x2b` | `DS:0x73ac` | `38 6c×7 6d 6c×6 39` | marco superior con púa |
| `0x2c` | `DS:0x73be` | `6a 6c×14 6b` | marco inferior liso |
| `0x2d` | `DS:0x73d0` | `38 6c×14 39` | marco superior liso |
| `0x2e` | `DS:0x73e2` | `68 6c×4 6b 20×4 6a 6c×4 69` | hombros de lápida (arriba) |
| `0x2f` | `DS:0x73f4` | `6a 6c×4 69 20×4 68 6c×4 6b` | hombros de lápida (abajo) |
| `0x30` | `DS:0x7406` | `20×5 67 20×4 67 20×5` | pie de lápida |
| `0x31` | `DS:0x7418` | `20×5 68 6c×4 69 20×5` | cabecera redondeada |

**Control independiente de que la resolución cae donde debe**: el bloque acaba en
`0x7439` y el cartel de Serpent's Hold que el extractor ya leía por su cuenta empieza en
`DATA.OVL:0x743A`. Los dos bytes intermedios son el NUL y el relleno.

Son los glifos que dan a las lápidas su silueta. Sin expandirlas se pinta el byte crudo,
y `0x29` es un **glifo a ceros** en `RUNES.CH`: la fila desaparece.

## 3. El ancho NO es del cartel, es de la ventana

`decode_sign_text` no mide nada. Quien envuelve es `putchar`
(`0x742a` = `ULTIMA.EXE:0x16ba`) al llegar al borde del área de texto — 16 columnas
(`CONSOLE_RECT` 24..39). Por eso **todas** las filas horneadas de SIGNS.DAT miden
exactamente 16 bytes.

Y la envoltura es **inmediata, no diferida**: `0x1735` incrementa la columna nada más
pintar el glifo y, si `col + win.x0 > win.x1`, ya hace el `row++ / col=0` de `0x1742`. En
consecuencia **un salto de línea justo después de una fila llena suma otra fila, en
blanco**. No es un caso de laboratorio: el cartel de Serpent's Hold (el añadido a mano en
`DATA.OVL:0x743A`) mete `0x0a` tras cada fila llena y sale a doble espacio — y sin marco
inferior, que tampoco lo tiene.

Detalle vecino de `putchar`, para quien lo necesite: allí `0x0d` **sí** existe como
retorno de carro puro (`0x16da` → `0x1745`: `col=0` sin `row++`). Pero un `0x0d` de un
cartel nunca llega a `putchar`: `decode_sign_text` lo intercepta antes.

## 4. Censo del corpus (79 carteles de `signs.json`)

Bytes de control presentes, medidos sobre los 79 registros:

| byte | carteles que lo llevan |
|---|---|
| `0x8a` (salto) | 30 |
| `0x29` (macro fila vacía) | 15 |
| `0x26` / `0x27` (divisoria) | 13 |
| `0x0d` (pausa) | 7 |
| `0x2c` / `0x2d` | 7 |
| `0x2e`..`0x31` (lápidas) | 6 |
| `0x2a` / `0x2b` | 4 |
| `0x0a` pelado | 1 |
| `0x0a` **en cabecera** (el salto de 6 en 6) | **0** |

La regla de la cabecera queda por tanto **sin testigo en el corpus**: está transcrita del
binario e instanciada con un caso sintético en el test, no medida sobre datos reales.

Los siete `0x0d` caen todos en frontera de fila (posición 64 u 80), que es lo coherente
con una pausa de página: el original espera tecla justo al llenar la ventana. El clon no
tiene pausa por tecla en la consola ⇒ **Clase C declarada**: se consume sin emitir, y las
filas resultantes son idénticas con pausa o sin ella.

## 5. Qué hacía mal el port (ficha #198)

`bakedSignRows` deducía el ancho de envoltura buscando la esquina `0x39` en los bytes
(`raw.indexOf(0x39) + 1`). Falla en dos familias:

* los carteles con el **otro** juego de esquinas (`0x61` arriba-izquierda, `0x63`
  arriba-derecha, `0x64`/`0x66` abajo) — SIGNS.DAT usa dos estilos de marco;
* los que **empiezan por macro** (`2b 29`, `2d 29`, `31 2e`), donde el marco ni siquiera
  está en los bytes del cartel.

Sin `0x39` el ancho salía `Infinity` y **el cartel entero colapsaba en una sola fila**, de
la que sólo se veían las 16 primeras celdas: exactamente la línea superior del marco. Eso
es lo que fotografió el usuario — el glifo `0x61` de `RUNES.CH` tiene forma de **9**.

**Censo del daño: 49 de 79 carteles decodificaban distinto del binario, y 37 de ellos
colapsaban a una fila.** Los otros 12 perdían la divisoria, las siluetas de lápida o
partían las filas por el `0x0d`.

## 6. 🔴 Trampa de instrumento pagada por este carril

La primera corrida de la batería sobre este fix salió `EXIT=1` con UN rojo:
`test_banda_criterios.py::test_los_criterios_NO_son_independientes`.

**No era una regresión del port: la causé documentando.** El comentario de `sign-box.ts`
citaba los labels internos del cuerpo de `putchar` (`0x1735`, `0x1742`) unas líneas
después de nombrar `ULTIMA.EXE:0x16ba`. Por la pasada PEGAJOSA de `collect_cites` esos
offsets sueltos heredan el overlay de la línea anterior que lo nombra, y con
`sower_upper` encendido el par `ULTIMA.EXE:0x1742` pasó de «heredado» a **sostenido**:
entró en la banda por defecto (621 → 622) y dejó de ser el testigo exclusivo de
no-independencia que ese gate tiene clavado.

Dos cosas medidas al adjudicarlo:

* La propiedad de no-independencia **sobrevive**: con `kernel_selects` solo y no por
  defecto quedan **17 pares** (12 de ellos son las `BAJAS` ya fijadas del propio gate).
  O sea, el gate no cayó porque la propiedad desapareciera, sino porque su testigo
  concreto fue absorbido.
* Retirar los dos offsets internos del comentario devuelve la banda a **621** y el gate a
  verde, sin tocar el gate ni su acta.

**La regla que sale de aquí: un offset INTERNO del cuerpo de una rutina no es una fila
del ledger, y citarlo en el port le da un aval que no le corresponde.** En el port se
cita la RUTINA (`ULTIMA.EXE:0x16ba`); los labels de su cuerpo van en la nota. Hermana de
la trampa que el propio `test_banda_criterios` documenta en
`test_dar_AVAL_en_la_linea_de_la_cita_puede_BORRARLA`: allí el aval mal colocado BORRA la
atribución, aquí un offset sin aval propio HEREDA una que no le toca.

Nota sobre el alcance: este fichero (una nota de `re/notes/`) sigue citando `0x1742` sin
problema — la banda se deriva de las citas **del port**, no de las notas. Lo comprobado es
que con el comentario corregido y la nota intacta el gate pasa.
