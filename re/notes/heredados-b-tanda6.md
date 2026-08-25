# heredados-b · TANDA 6 — el gem de mazmorra, la nota caduca, y una deuda saldada de paso

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **109 → 108**.

> Verificada con `re/tools/seed_diff.py` y `seed_gate.py`: 0 sembradas, 0 cambiadas.

Tanda de tres piezas: la fila de `DNGLOOK.OVL:0x6a8`, la corrección en sitio que el lead
aprobó, y la re-descripción de la clase que abrí en la tanda 2.

---

## 1. `DNGLOOK.OVL:0x6a8` — ACREDITADA, con una reserva declarada

El gem **dentro** de mazmorra, hermano del de sobremundo de la tanda 1: abre y cierra con
la misma placa negra, y al salir **la borra**.

**No es un barrido: es un relleno por inundación en anchura.** Llena el búfer de la
rejilla con `0xFF`, pone a cero **la celda central** —el desplazamiento 363, que es fila 11
columna 11— como semilla, y trabaja con **dos colas paralelas** de 256 entradas cada una,
**circulares**: cuando el puntero de escritura llega al tope vuelve a la base. Saca una
celda, prueba las **ocho** vecinas, dibuja cada una llamando al pintor icónico, y sólo
encola la vecina si ese pintor devuelve distinto de cero. Termina cuando el puntero de
lectura alcanza al de escritura, espera tecla y borra la placa.

**La tabla de ocho direcciones, decodificada y verificada por programa** (criterio de
heredados-168-tanda4): el desplazamiento sin signo menos la base da el offset de fichero
`0x0770` —por eso el disasm imprime basura ahí—, las ocho words caen en etiquetas reales, y
los destinos son ocho micro-stubs contiguos que hacen `inc`/`dec` sobre los dos registros de
coordenada.

**⚠ La reserva, y es para quien porte.** Lo que **este** cuerpo fija es una rejilla de
**22×22** (centro en 11,11; búfer de 23 filas de paso 32). El **`8x8` del nombre no lo fija
este cuerpo**: sale del mapa de planta, cuyo indexado con `& 7` vive en el pintor por celda,
que es **otra rutina**. El nombre es defendible leído como «mapa icónico de la planta 8×8» y
engañoso leído como «recorre 8×8». Lo **declaro** en la cita en vez de renombrar, porque las
dos lecturas son ciertas a distinto nivel — y la que un porte necesita es la de 22×22.

### 1.1 ★★ Y refuta una frase del corpus en el offset que ella misma cita

`dnglook-raster-spec.md:254` afirma que `g_unk_52C8` es «(0..3) = nivel/tinte de luz usado
por el gem-view», y como respaldo cita un punto concreto, `DNGLOOK 0x0730`.

En ese offset exacto el cuerpo hace una comparación contra **el valor único 3**, y lo que
guarda es **una llamada de más al fijador de atributo**, no un tinte graduado. No hay rango,
no hay rampa.

La lectura que sí sostiene el binario es la de **modo de vídeo**, y la dejé derivada en la
tanda 1 por otra vía: el bloque que inicializa la paleta está **guardado** y no corre cuando
esa global vale 0 o 3, y el fijador de color enmascara con `&0xf` o `&0x3` según ella
(`kernel-render-sweep.md:116`). Cuatro registros de color con estáticos en {1,2,3} completan
el cuadro.

Es el género **«cita equivocada»**: la nota apunta al offset correcto y el offset dice otra
cosa. No toco `dnglook-raster-spec.md` —una corrección en sitio ahí es una tanda propia, y
esa nota es de otro carril—; queda la refutación en la cita de la fila.

---

## 2. La nota caduca, corregida en sitio — y su deuda de siembra, saldada

`ring-expiry-derivation.md` §4 decía que «los dos sitios llaman con argumento ≠ 1, así que
ambos tiran». **Son cuatro, y el que faltaba es justo el que no tira.** Lo verifiqué por mi
cuenta en vez de copiar el censo: parseando los `.asm` y leyendo el push del primer
argumento en cada call-site del stub. Los dos ya enumerados pasan 3 y 2; los dos que
faltaban están en la escena de campamento y pasan **0** y **1**. Y la propia nota documenta
que un argumento igual a 1 **salta el montaje**, así que ese cuarto camino nunca llega a la
llamada. Corrección fechada, sin borrar: lo que seguía en pie sigue escrito.

**★ Y de paso salió una deuda que no era mía.** Al tocar la nota saltó el gate de siembra.
Antes de darme por culpable medí el fichero **sin** mi edición: ya sembraba **4 nombres y
pisaba 2 curados**, en `main`. Con mi edición, exactamente lo mismo — las dos salidas
**idénticas**, o sea que mi corrección era **seed-neutra**.

Pero el gate mira «notas tocadas», no «siembras añadidas». Podía firmar declaraciones de
siembras ajenas como si fueran intencionadas —que es lo que el fichero de declaraciones
pide, y habría sido falso— o arreglarlas. Arreglé las seis: son reescrituras **mecánicas**
que rompen la adyacencia palabra↔offset **sin tocar ninguna afirmación técnica** (mismos
offsets, mismos nombres, mismas cifras; sólo puntuación y orden de palabras). La nota pasa
de 4 siembras y 2 pisadas a **0/0**.

**⚠ Hueco de diseño del gate, medido con este caso.** Su propio docstring dice que impide
que la deuda **crezca** y que **no la salda** — pero no distingue «has añadido siembras» de
«has tocado un fichero que ya sembraba». Una edición demostrablemente seed-neutra sale
**roja**, y el camino de menor resistencia que ofrece es firmar declaraciones falsas.
Arreglo sugerido, que no aplico porque el instrumento no es mío: comparar contra **la línea
base del propio fichero en `main`**, no contra cero.

---

## 3. La clase de la tanda 2, re-descrita

Queda como el lead aprobó:

> **«Sellada por una fila que la llamaba otra cosa» — 5 filas, y no son lo mismo.**
> **Cuatro son desacuerdos vivos** entre dos fuentes. **Una es un desfase temporal**:
> `DNGLOOK.OVL:0x117e`, donde el nombre del anexo era el nombre **viejo** del ledger, ya
> corregido por renombre. El anexo es una instantánea congelada de antes de la corrección.
>
> **Regla que sale de ahí:** con filas que arrastran historia, **fechar las dos cadenas
> antes de tratar la diferencia como conflicto**. Es la versión de filas-con-historia del
> `git log -S` que el proyecto ya usa para los rojos heredados.

Y dentro de los cuatro vivos hay **dos variantes** ya distinguidas: el rol como
**sinécdoque** —nombra una de N ramas del propio cuerpo— y el rol como **papel del
llamador** —nombra la decisión del despachador, un nivel por encima.

---

## 4. Estado

**23 filas adjudicadas** en seis tandas; contador **128 → 108**.

**Reparto medido el 2026-07-28 a las 09:34 UTC**, antes de esta tanda y sobre 110 filas:
**18 FUERTE · 74 DÉBIL · 18 SIN RASTRO**, cinco de los fuertes por el canal de rangos.

**Cola:** los fuertes por tamaño. De la clase anexo-contra-ledger no queda ninguna, y de la
familia gem tampoco — las dos vistas, la de sobremundo y la de mazmorra, quedan cerradas.
