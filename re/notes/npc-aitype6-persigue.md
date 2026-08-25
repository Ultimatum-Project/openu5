# El aiType 6 PERSIGUE — y la nota que lo decía ya se contradecía a sí misma

Carril `re/npc6` · 2026-08-06 · sobre main `cf080a4c`.

Convención de redacción, igual que las actas hermanas: los nombres de rutina y de global
van en tabla o en backticks aislados y nunca pegados a un desplazamiento; los
desplazamientos van en la forma `FICHERO.OVL:0x…`, que el sembrador de identidades no
puede leer como propuesta de nombre.

**Veredicto en una línea:** el aiType 6 comparte HANDLER con el 3 pero **no comportamiento**
— el handler común sólo aporta el gate de distancia, y dentro la rama de huida está
reservada al 3. El clon hacía HUIR a ratas, murciélagos, un espectro y un guardia armado.
Arreglado en esta rama; **no mueve stream**.

---

## 1. Grado de lectura

| tramo | estado |
|---|---|
| `NPC.OVL:0x06e4-0x0934` (persecución-o-huida) | **LEÍDO ENTERO** (596 B) |
| `NPC.OVL:0x0d76-0x0d9a` (el handler compartido) | **LEÍDO ENTERO** |
| despachador `NPC.OVL:0x0d00`-`0x0d35`, y su tabla de `0x0d9c` a `0x0dab` | **LEÍDO Y DECODIFICADO** |
| `NPC.OVL:0x0c50` (el paseo) | **LEÍDO** en tanda anterior |
| el resto del despachador | **LOCALIZADO**, no leído |

## 2. La tabla de salto, con la base RESUELTA antes de leer entradas

`NPC.OVL:0x0d30` hace `jmp word ptr cs:[bx-0x4fd4]` con `bx = aiType*2`. El desplazamiento
es **negativo**, así que la base no es donde parece y hay que resolver la dirección
efectiva primero — si no, se cuenta la tabla equivocada y **el catálogo malo devuelve un
destino plausible**.

Base del overlay: **0xA290**, acreditada por dos vías. (a) La cita del ledger de la llamada
al envoltorio de `rand0` la nombra. (b) Control de consistencia: con `bx = 0` la dirección
efectiva es CS `0xB02C`, que con esa base es el desplazamiento **0x0d9c** dentro del fichero — y ahí
es **exactamente** donde empiezan los 16 bytes de la tabla, que el desensamblador
imprime como código basura durante otros 16. La entrada 0 cae donde la tabla empieza: eso
cierra la base sin depender de la cita.

| aiType | CS | desplazamiento | handler |
|---:|---|---|---|
| 0 | 0xb03c | `0x0dac` | quieto |
| 1 | 0xaff0 | `0x0d60` | paseo radio 3 |
| 2 | 0xafc8 | `0x0d38` | paseo sin radio |
| 3 | 0xb006 | `0x0d76` | gate de distancia → `0x06e4` |
| 4 | 0xafd0 | `0x0d40` | mercader |
| 5 | 0xb021 | `0x0d91` | llama a la de `0x06e4`, sin gate |
| **6** | 0xb006 | **`0x0d76`** | **el MISMO del 3** |
| 7 | 0xb021 | `0x0d91` | ídem que el 5 |

Los ocho destinos coinciden con los que el clon ya tenía anotados: **la tabla de despacho
del clon era correcta**. El error no estaba en el despacho.

## 3. Dónde se separan el 3 y el 6

El handler `0x0d76` es **un solo cuerpo** para los dos, y lo único que aporta es el gate:
`0x0d8c cmp ax,4 / jge` ⇒ actuar sólo si la distancia Manhattan al party es **< 4**. Luego, en
`NPC.OVL:0x0d91`, se empujan los mismos argumentos y se llama a la rutina de
`NPC.OVL:0x06e4` **con el aiType intacto**.

Dentro, el aiType llega crudo: `NPC.OVL:0x0703` lee `[bx+si+0x5d5e]` con `si = ranura*16` y
`bx` = el índice de ranura de horario, y lo guarda en el local que gobierna las tres
bifurcaciones. Es literalmente el campo del fichero de NPC.

Y la bifurcación es ésta:

```
0824: cmp  [bp-2], 3
0828: jne  0x884          ← TODO lo que no sea 3 se va a la rama de abajo
082a-0844: (rama del 3)  adopta si la puntuación es MAYOR  → ALEJARSE
0884-0890: (rama del resto)
  088a: cmp  [bx], ax
  088c: jge  skip
  088e: mov  di, si       ← adopta si la puntuación es MENOR → ACERCARSE
```

⇒ **el 6 persigue.** Y la rama de persecución **no tiene moneda**: las tres tiradas de la
rutina están tras gates de aiType 3, 5 y 7 (`0x0824`, `0x0892`, `0x0898`) y ninguna alcanza
al 6.

## 4. 🔴 La contradicción DENTRO de la nota que el clon copió — NO la arreglo aquí

`re/notes/npc.md` dice las dos cosas, en dos secciones distintas del mismo fichero:

| línea | qué dice |
|---|---|
| §4.0, fila del aiType 6 | «run-away … = 3» |
| §de la posesión del Shadowlord | «aiType 6/7 **HOSTIL**» y «aiType 3 **HUIDA**» |

El clon copió la primera. La segunda es la que cuadra con el ASM — y llega por otro camino
entero: la mecánica de posesión del Shadowlord, cuyas dos rutinas se llaman, literalmente,
la del odio y la del miedo.

**No toco `re/notes/npc.md`**: es una contradicción interna de una nota ajena y su
adjudicación es del lead. Queda nombrada aquí con las dos citas.

## 5. Tercera vía: los DATOS dicen lo mismo

Qué criaturas llevan cada aiType, contado sobre el fichero de NPC del juego (ranuras de
horario de los NPC vivos, recortes del atlas para identificar el sprite):

| aiType | tipos que lo llevan | cuántos |
|---:|---|---|
| **6** | rata gigante · murciélago · un espectro · un guardia con alabarda | 6 · 5 · 2 · 1 |
| **3** | dos aldeanos | 1 · 1 |

Criaturas hostiles con el 6; aldeanos con el 3. **Perseguir es lo coherente para las
primeras y huir para los segundos**, y es lo que dice el ASM. Si el 6 huyera, las ratas y
los murciélagos de los pueblos escaparían del Avatar — que es justo lo que hacía el clon.

Tres vías independientes (el ASM, los datos, y la sección de posesión de la nota ajena)
dicen lo mismo. La única que decía lo contrario es la fila que el clon copió.

## 6. Magnitud

**40 ranuras de horario · 14 NPC distintos de 338 · 5 localizaciones de 32** (loc 4→3,
7→5, 13→3, 18→2, 19→1). Para contraste, el aiType 3 —la huida de verdad— lo llevan **2**
NPC en todo el juego.

## 7. El arreglo

El clon pasa a distinguirlos: mismo gate de distancia, criterio invertido. **No consume
RNG** (§3), así que no mueve el stream y no necesita ventana de sellos.

Testigo: `game/tests/npc-aitype6-persigue.test.ts`, 4 casos — el acercamiento, el
contraste con el 3 alejándose en el mismo escenario, el gate compartido a distancia 4, y
un **control de consumo de RNG** que cuenta las tiradas del tick y exige **cero**
comprobando además que el NPC sí se movió (para que el cero no sea por no haber corrido).
Validado con **tres mutantes**: volver a huir · invertir el criterio dentro del paso ·
quitar el gate. Los tres tumban su aserto.

## 8. Lo que esta ficha NO hace

- **No arregla `re/notes/npc.md`** (§4): contradicción ajena, adjudicación del lead.
- **No toca las otras dos divergencias de la misma ficha #52**: el paseo es fiel, y la
  huida del clon consume cero donde el binario tira — eso sigue declarado y sin arreglar,
  porque su arreglo sí movería stream.
- **No lee el despachador entero** ni la rutina que resuelve la ranura de horario.
- **No mide en vivo.** Todo es lectura de ASM, del fichero de NPC y del clon.

---

# ANEXO — el resto de la tanda #52, en la misma ficha

Lo de arriba es la divergencia de comportamiento. Estas cuatro piezas salieron de la misma
lectura y se guardan aquí para que no viajen sueltas.

## 9. 🔴 NUEVE citas del corpus escriben el par al revés — pero la notación NO es `(max, min)`

> 🔴 **ENMENDADA POR ALCANCE (06-08, el lead, censando el corpus entero).** El título de esta
> sección decía *«la notación del ledger para el generador es `(max, min)`»*. **Falso como
> regla general, y peligroso**: aplicado a todo el corpus invierte la mayoría, que está bien.
>
> **Censo de las 143 citas numéricas de dos argumentos** (re/notes + docs + capa manual):
>
> | forma | cuántas | |
> |---|---|---|
> | `(min, max)` — la del binario | **130** | 91 % |
> | `(max, min)` — invertidas | **9** | 6 % |
> | `(1, 0)` — ambiguas | 4 | ¿cuelgue real de #23, o moneda `0..1` al revés? |
>
> ⇒ **Lo cierto es que hay NUEVE citas mal escritas, no que la notación sea ésa.** Una regla
> sacada del 6 % y enunciada como universal es peor que no tener regla:
> [[cifra-sin-su-regimen-se-lee-como-universal]] aplicado a una convención.

Las nueve invertidas (enumeradas para que se auditen una a una, no por parecido):
`re/notes/npc.md:435` · esta nota (§ de abajo, ya corregida) ·
`frontier-manual.json` líneas 2943 `(0x1e,1)`, 3587 `(0x3f,0)`, 3635 `(0xff,0)`,
5690 `(0xff,0)`, 5744 `(3,0)`, 5774 `(15,0)` y `(29,0)`.

**Verificadas contra el ASM, tres de ellas, y las tres son transcripciones al revés** — el
binario empuja el MÍNIMO primero en todas:

| sitio | 1er push | 2º push | rango real | cómo estaba escrito |
|---|---|---|---|---|
| `ULTIMA.EXE:0x2acf` | `1` | `8` | 1..8 | — (control positivo) |
| `ULTIMA.EXE:0x2f70` | `0` | `0x3f` | 0..63 | — (control positivo) |
| `TOWN.OVL:0x0992` | `0` | `0xff` | 0..255 | `(0xff, 0)` 🔴 |
| `TOWN.OVL:0x0f02` | `0` | `0xf` | 0..15 | `(15, 0)` 🔴 |

**El testigo que no depende de ninguna notación ni del orden de los push está en el cuerpo**
(`ULTIMA.EXE:0x2092`):

```
20b0: mov bx, [bp+6]
20b3: mov cx, [bp+4]
20b6: sub cx, bx        ; tamaño = [bp+4] − [bp+6]
20b8: inc cx            ;          + 1
20bb: div cx            ; dx = resto ∈ [0, tamaño−1]
20bd: add dx, bx        ; ★ se le suma bx ⇒ [bp+6] ES EL MÍNIMO
```

**Lo que se suma al resto es el mínimo.** De ahí sale todo lo demás sin memorizar convenios:
`[bp+6]` = mínimo = **primer** push · `[bp+4]` = máximo = **último** push. Con eso, el
envoltorio de un argumento (`ULTIMA.EXE:0x3aae`, que empuja `0` y luego su argumento) es
`rand(0, arg)`, y la moneda del §3 —que empuja `0` y luego `1`— es `rand(0,1)`: **una moneda,
no la puerta al cuelgue**. Y el defecto del cofre de mazmorra encaja igual: con mínimo 1 y
máximo 0 el tamaño sale `0 − 1 + 1 = 0`, y la división por cero es el cuelgue duro.

> 🔴 **PREMISA CORREGIDA (07-08-2026, carril `cola-entrada`): en ESTE binario una excepción de división NO es un cuelgue.** El arranque instala su propio manejador de **INT 00h** (`0x0244-0x024c` → `CS:0x0212`), el de la **C-runtime de Microsoft**: escribe por STDERR `run-time error R6003 - integer divide by 0` y llama a `exit(255)`, con salida ordenada. Identificado por vía independiente: la tabla `DS:0xa452` decodifica a `R6000…R6009`, códigos MSC. **La frase de arriba se conserva tal cual** —no se reescribe la historia— pero su conclusión «cuelgue duro» queda **retirada**: el modo de fallo es *terminación del proceso con pérdida del progreso no guardado*. Lo demás de esa frase (que la división sin guarda es un defecto real) **sigue en pie**. Ficha completa en `docs/bugs-del-original.md` §rand_range.

⇒ **Regla: no leas el convenio de la notación ni del orden de los push. Léelo del `add`.**

## 10. Cuántas tiradas consume el camino de persecución-o-huida, por rama

Tres llamadas al generador en 596 B, cada una con su gate:

| dónde | gate | cuántas |
|---|---|---|
| `NPC.OVL:0x083d` | sólo aiType 3, y sólo si ya había candidato elegido | hasta **3** |
| `NPC.OVL:0x08a5` | sólo aiType 5 o 7; siempre que se llega | **1** |
| `NPC.OVL:0x08d4` | bucle de candidatas, sólo si el 25% pasó | **0..2** |

⇒ aiType 3 → **0..3** · aiType 7 → **1..3** · **el resto, incluido el 6 → 0**.

🔴 **El `je` que se cuenta mal.** En el bucle de `0x08d4` hay TRES saltos, y el tercero
(`0x08cb`) hace que **la primera candidata viable se adopte SIN tirar**; sólo las siguientes
cuestan tirada. Contarlo como «hasta 3» —que es lo que publiqué primero— sobrestima en uno.

🔴 **Y no es un «desempate».** El `0x082f jle` exige que el candidato sea **estrictamente
mejor**: la moneda decide si se **ADOPTA** la mejora, no quién gana una igualdad. Cambia la
frecuencia esperada, no sólo el nombre. *(Leído del tramo que va de `NPC.OVL:0x0824` a `NPC.OVL:0x0846`; la identidad
del local que guarda «el mejor hasta ahora» no se ha derivado del init del bucle.)*

## 11. El consumo depende del TERRENO, no sólo del aiType

El bucle de candidatas salta las direcciones cuya puntuación es `0x63`, que es el valor que
el barrido pone a las **impasables**. ⇒ **cuántas tiradas gasta un NPC depende de cuántos
vecinos transitables tenga**, o sea de dónde esté parado. Ésa es la segunda vía por la que el
consumo «depende del mapa»; la primera es el aiType, que sale del fichero de NPC de ese mapa.

## 12. El aiType 5 es INALCANZABLE con los datos de FÁBRICA

Censo sobre el fichero de NPC del juego: **cero** ocurrencias del 5 en las ranuras de horario
de los NPC vivos (el 7, su gemelo en el despacho, tiene 36). ⇒ la mitad `cmp 5` del gate de
`NPC.OVL:0x0892` no se alcanza en una partida normal, y quien porte esto no necesita
modelarla.

**Con esa coletilla y no otra**: es inalcanzable *con los datos de fábrica*. Un editor de
mapas que ponga un 5 la despierta, y entonces el gate del 25% sí dispara por esa mitad.
