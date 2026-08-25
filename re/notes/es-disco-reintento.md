# La E/S del binario reintenta sin tope — y su «error handler» te pide el disquete por su nombre

Carril `asm-kernel` · sujeto: **el binario** (`ULTIMA.EXE`, kernel) · todas las citas son de
lectura directa del desensamblado. Sonda de alcance: `re/tools/censo_es_disco.py`.

Ultima V se distribuía en disquetes y el juego pedía datos de disco constantemente. La forma
en que el binario trata «el fichero no está» no es una comprobación de error: **es un bucle
sin salida apoyado en un handler que va cambiando de unidad**. Es mecánica de 1988 que un
port moderno no sabría que existe, porque hoy no hay nada equivalente que portar.

---

## 1. El bucle, leído en el cuerpo (no heredado del nombre)

`read_file_block_with_disk_retry` (`ULTIMA.EXE:0x256e`, `ret 8` = cuatro argumentos) termina
en cinco instrucciones que son toda la política:

```
25ac:  push [bp+0xa] / push [bp+8] / push [bp+6] / push di
25b6:  call 0x7234              ; dos_read_file_block — la lectura de verdad
25b9:  mov si, ax
25bb:  or si, si
25bd:  je 0x25ac                ; devolvió 0 → vuelve a intentarlo
```

**Sin contador. Sin temporizador. Sin salida por error.** Si el fichero no aparece, el juego
se queda ahí girando. Su hermana de escritura, `write_whole_file_with_disk_retry`
(`0x25d8`, `ret 6`), hace lo mismo y va más lejos: además del bucle interno de espera
(`2614-261a`), si la escritura falla vuelve a entrar **al bucle entero** desde `0x2646`.

Importa decir que esto está **leído**, no deducido del nombre: los dos nombres del ledger ya
llevaban «`with_disk_retry`» dentro, y un nombre no es una medición.

## 2. No son dos rutinas raras: es la capa de ficheros entera

Debajo hay tres primitivas de DOS, y las tres se identifican por el **número de servicio de
`int 21h`**, que es la evidencia más dura que da un desensamblado:

| rutina | servicios `int 21h` | qué es |
|---|---|---|
| `dos_file_exists` `0x1674` | `3Dh` abrir · `3Eh` cerrar | abre y cierra: ¿existe? |
| `dos_read_file_block` `0x7234` | `3Dh` · `42h` seek · `3Fh` leer · `3Eh` | leer un bloque |
| `dos_write_whole_file` `0x7296` | `3Ch` crear · `40h` escribir · `3Eh` | volcar un fichero |

Y **las tres terminan igual al fallar** — el mismo epílogo copiado tres veces:

```
      mov [0x535c], ax         ; guarda el código de error de DOS
      lcall [0x5394]           ; llama al HOOK
      xor ax, ax               ; y devuelve 0
```

Ese `[0x5394]` es un **puntero far mutable, y es el hook de error de la capa de ficheros**.
Su valor se fija en el arranque del programa, en `ULTIMA.EXE:0x0061`, y vale **`0x2322`**.

## 3. Qué hace el hook: DOS caminos, y el segundo te habla

> ⚠ **CORRECCIÓN (misma tanda, tras leer los 346 B que faltaban de la fila).** La primera
> versión de esta sección y de la §4 decían que el hook «no informa de nada» y que **no existe
> ningún mensaje de "inserta el disco"**. **Las dos afirmaciones eran falsas**, y lo eran por
> haber sellado sobre un tercio de la rutina: leí `0x2322-0x23c4` y el prompt vive de `0x23c4`
> en adelante. Lo que sigue es la lectura completa. La causa de la equivocación queda escrita
> aquí a propósito: **una ausencia («no existe un prompt») afirmada sobre una lectura parcial
> no es una medición, es una extrapolación** — y ninguna de las dos secciones lo declaraba.

El hook mira la tabla de unidades indexada por el identificador de disco vivo, y **bifurca
según el centinela**:

**(a) Si la entrada NO es `0xFF`** —ya sabemos en qué unidad va ese disco— trabaja en
silencio: compara contra la unidad actual de DOS y, si no coinciden, **`xor byte [si], 3`**,
que sobre una letra de unidad alterna `'A'`↔`'B'` (`0x41 xor 3 = 0x42`), pero **sólo si la
máquina declara más de una disquetera**. Si la letra es `>= 'C'` la fuerza a `'A'`.

**(b) Si la entrada ES `0xFF`** —no sabemos dónde está ese disco— **pregunta al jugador**.
Y lo hace en condiciones: si el modo de pantalla lo pide, dibuja un recuadro; compone el
mensaje con cinco cadenas encadenadas y espera una tecla.

## 3-bis. El prompt, montado de cinco trozos

**El mensaje existe, y se compone en tiempo de ejecución encadenando cinco cadenas** — por eso
no aparece entero si buscas la frase completa en el binario:

| DS | contenido | cuándo |
|---|---|---|
| `0x5460` | `Please insert the Ultima ` | siempre |
| `0x547a` | `V ` | siempre |
| `0x547d` / `0x5485` / `0x548f` | `Program` / `Britannia` / `Player` | según el identificador de disco |
| `0x5496` | ` Disk` | siempre |
| `0x549c` | ` and press drive letter: ` | si aún no hay unidad asignada |

Es decir, en pantalla: **`Please insert the Ultima V Britannia Disk and press drive letter:`**.

Y no se queda ahí: **espera una tecla, la usa como letra de unidad y la recuerda.** Tras el
`poll_key_timed` llama a `dos_select_drive` con lo tecleado y, si la selección falla, **vuelve
a preguntar** (bucle a `0x2473`, otra vez sin tope). Si acierta, escribe la letra en la tabla
para ese disco, de modo que **la siguiente vez ya no pregunta: usa la rama silenciosa**.

**★ Y deduce la máquina de tu respuesta**: si la tecla fue `'B'` (`cmp byte [bp-2], 0x42`),
escribe un `2` en el contador de disqueteras. O sea que **el `xor 3` de la rama (a) sólo se
activa porque en algún momento el jugador contestó `B` a este prompt.** Las dos ramas están
acopladas: la muda depende de lo que aprendió la que habla.

Juntando §1 y §3, **la mecánica completa**:

> El juego pide un fichero. DOS dice que no está y llama al hook. **Si ya sabe en qué unidad
> vive ese disco**, cambia de disquetera en silencio y el bucle reintenta — y en una máquina
> de una sola unidad ni siquiera alterna: gira en seco. **Si no lo sabe**, dibuja un recuadro,
> te pide por su nombre el disco que falta, se queda esperando la letra de unidad, y apunta la
> respuesta para no volver a preguntar.

## 4. Los DOS mensajes del subsistema

**Leer no es mudo** —como decía la primera versión de esta nota—: usa el hook por defecto, que
es justamente el que puede preguntar por el disco (§3-bis). Lo que sí es cierto es que **el
lector no instala ningún handler propio**: se queda con el de serie.

**Escribir instala uno distinto.** `write_whole_file_with_disk_retry` cambia temporalmente el
vector alrededor de la escritura (`261c`) y lo restaura después (`2636`). Ese handler es
`print_string(DS 0xa0e0)` + `poll_key_timed`, y la cadena dice:

> `Your disk may be write-protected. Try again.`

**La sustitución tiene consecuencia, y es el matiz que sobrevive de la versión anterior**:
mientras dura una escritura, el camino que pregunta por el disco **está desconectado**. Si lo
que falla al escribir es que el disquete no está puesto, el juego culpa a la protección contra
escritura —que es sólo una de las causas posibles— y **no ofrece la vía de meter el disco
correcto** hasta que la escritura termine o se abandone.

## 5. El selector de volumen (`0x251e`) y su efecto de borde

La rutina que precede a las cargas y guardados (`ret 2`, un argumento) hace de puente:
desarma el hook al entrar (`2521` → `0x2320`), **normaliza el identificador** —los discos
`2` y `5` pasan a valer `1`, o sea que tres identificadores lógicos viven en el mismo
disquete físico—, lo guarda en `g_unk_a9bd`, y si la entrada de la tabla no es `0xFF`
selecciona esa unidad. Re-arma el hook a `0x2322` al salir.

**★ Efecto de borde medido**: con la entrada a `0xFF` salta a `0x255d` y sale **sin
seleccionar nada y sin invalidar la caché de unidad `[0x545e]` — pero habiendo escrito ya
`g_unk_a9bd` en `0x2541`**. El estado se actualiza aunque la selección no ocurra.

**Un detalle de lectura que cuesta caro**: el desensamblado imprime esta tabla de dos maneras
distintas, `byte ptr [bx - 0x5638]` y `byte ptr [si]` con `si = 0xa9c8 + idx`. Parecen dos
tablas y son **una**: `-0x5638 mod 0x10000 = 0xa9c8`. Una resta antes de teorizar.

## 6. Alcance: dos unidades, porque se confunden

Medido con `re/tools/censo_es_disco.py`, que resuelve los destinos **por banda** (un near-call
al mismo sitio se codifica distinto en cada overlay) y corre el control positivo obligatorio
de `callers_por_banda` en cada pasada.

| destino | sitios de llamada | rutinas llamantes | ficheros | lo que vería un `grep` |
|---|--:|--:|--:|--:|
| `read_file_block_with_disk_retry` | 47 | 30 | 14 | 3 |
| `write_whole_file_with_disk_retry` | 17 | 10 | 6 | 2 |
| selector de volumen `0x251e` | 26 | 15 | 8 | 5 |
| `dos_select_drive` `0x1eac` | 9 | 5 | 2 | 8 |
| **capa de reintento (unión de las dos primeras)** | **64** | **32** | **14** | — |

Dos lecturas de la tabla:

- **Es infraestructura, no un subsistema.** 32 rutinas de 14 ficheros de código distintos
  (13 overlays más el propio kernel) heredan el reintento sin tope. Nadie eligió esta
  política: se hereda por llamar a la capa de ficheros.
- **La columna `grep` es una advertencia de método.** Un censo de llamadores hecho con
  búsqueda de texto sobre el desensamblado habría dicho que al lector lo llaman **3** sitios.
  Son 47. Los ceros y los «único llamador» de un `grep` inter-overlay son artefactos de la
  codificación, no hechos del binario.

Y **las dos columnas no son versiones del mismo número**: una rutina que llama tres veces al
mismo destino son 3 sitios y 1 llamante. El factor entre ellas va aquí de 1,3× a 1,8×, así
que una cifra publicada sin su unidad se lee como la otra y no hay forma de convertirla.

## 7. Qué significa para quien porte esto

Lo digo como pregunta abierta: **el lado del clon no está medido en esta nota.**

Un port que traduzca el bucle literalmente **cuelga**, porque en un navegador no hay nadie
que meta un disquete. Uno que lo omita cambia el comportamiento observable en el único caso
en que el original se detenía a esperar a una persona. Y uno que lo acote con un contador
inventa un modo de fallo —«no se pudo cargar»— que el original **no tiene**: aquí no existe
el camino de error, sólo el de reintentar.

La decisión (calcarlo, acotarlo o declararlo) no sale de esta nota; la derivación sí.

## 8. Lo que esta lectura REFUTA

`re/notes/kernel-render-sweep.md` §218-231 describe estas mismas rutinas como **«el clúster
del cursor de selección»**: `0x251e` → `cursor_highlight_set`, `0x25d8` →
`cursor_select_loop`, `0x1674` → «espera tecla», el `xor 3` → «avance de frame», `[0x5394]` →
«hook de blink». Lee el mismo código y le adjudica otro sujeto.

**Queda refutado por los números de servicio de `int 21h`** (§2): `0x1674` abre y cierra un
fichero, no espera teclas; el `xor 3` cae sobre una letra de unidad. Y el cimiento de aquella
lectura ya había sido corregido a medias: `kernel-sweep-2.md` §175 rectificó
`0x1eac → dos_select_drive` («⚠ corrige el parentético del lote 1 §6»), que era la pieza de
la que colgaba todo el relato del cursor — pero **nadie volvió a re-adjudicar el clúster que
descansaba en ella**. Corregir la premisa no propaga solo a las conclusiones que ya se
sacaron de ella.

## 9. Lo que NO adjudico

- **No he mirado el port.** Todo el §7 es una consecuencia lógica sobre el binario, no una
  medición del clon.
- **El manejador `int 24h`** que vive detrás del vector no-op (fija `[0x535c]=1` y devuelve
  «ignorar» por `iret`, suprimiendo el *Abort/Retry/Fail* de DOS) **lo leí por encima y no lo
  sello**: encaja y no lo he verificado instrucción a instrucción.
- **🔴 LA CORRECCIÓN DE ESTA NOTA NACIÓ DE UNA ENTRADA DE ESTA MISMA LISTA.** La primera
  versión decía aquí «leído hasta `0x23c4`, la cola no la sello» — y en las secciones de
  arriba afirmaba, sin acotar, que **no existía ningún prompt**. Las dos cosas a la vez son
  incoherentes: **una ausencia afirmada sobre una lectura parcial no es una medición, es una
  extrapolación**, y el prompt estaba justo en la cola declarada como no leída. La lección
  para quien use esta nota: cuando una sección declare «no leí X», ninguna otra sección puede
  afirmar que en X no hay nada.
- **`[0x535c]` guarda el código de error de DOS y nadie de este camino lo consulta** para
  decidir nada — el bucle sólo mira el 0/1 del retorno. Quién lo lee, si alguien, no lo he
  censado.
- El vector far que instala el selector **apunta dos bytes antes de la fila siguiente**, o
  sea dentro de la cola de la anterior, que además es una de las filas con entrada absorbida
  ya censadas. O es un punto de entrada propio sin cortar, o el corte entre esas dos filas
  está mal puesto. **Lo señalo y no lo adjudico.**
