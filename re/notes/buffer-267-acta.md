# Acta — lote #268 (los 2 AMBIGUOS de DUNGEON) + #267 (el búfer de 176 B y la errata)

Carril `buffer-267`, rama `re/buffer-267`, worktree propio desde main b4eb5efd
(ledger 214 entradas; verificado que 00996663 es ancestro, o sea el lote #253/#257
está dentro de esta base).

Convención de este acta, igual que en el anterior: los nombres de rutina y de global
van en tabla o en backticks aislados y nunca pegados a un desplazamiento; los
desplazamientos van en la forma `FICHERO.OVL:0x…`, que el sembrador de identidades no
puede leer como propuesta de nombre.

---

## 0. MEDICIÓN PRE-REGISTRADA (antes de tocar nada)

**Bucket AMBIGUO en la base de partida: 2.** Son exactamente los dos de la tarjeta
#268, con el control positivo del instrumento en GENUINO y la partición sumando al
bruto. Ésta es la cifra contra la que se mide el delta al cerrar, y se anota ANTES de
leer para que no la pueda ajustar después.

---

## 1. PREDICCIONES PRE-REGISTRADAS (escritas ANTES de abrir un solo `.asm`)

Cada una con su CONDICIÓN DE FRACASO escrita, y con la vía degenerada declarada por
adelantado para poder auto-absolverme si me la encuentro.

### P1 — #268, los dos accesos de DUNGEON

**Predigo** que los dos son BASE LEGÍTIMA de tablas hermanas sin fichar que
embaldosan hacia abajo desde la base que fichó el racimo, y no bases ajustadas.

**CONDICIÓN DE FRACASO**: si el dominio del índice permite que el acceso alcance la
base fichada de arriba, la predicción está REFUTADA y el veredicto correcto es «base
ajustada, el acceso pertenece a la global de arriba».

**AUTO-ABSOLUCIÓN si**: la doy por confirmada apoyándome en que en el lote anterior
salió así. **El precedente del bloque de DNGLOOK NO es evidencia sobre DUNGEON.** Es
justo la clase de premisa que viaja de acta a acta ganando autoridad sin volver al
binario, y el que la escribió (yo) es el que más fácil se la cree. El dominio se
deriva de ESTE código o el veredicto es NO-DERIVADO.

⚠ **Dificultad declarada por adelantado**: estos dos llevan DOS registros de índice,
así que el dominio no es el recorrido de un contador sino la SUMA de dos recorridos.
Si no consigo acotar los dos sumandos, el resultado honesto es una COTA declarada, no
un veredicto — y así irá.

### P2 — #267, la errata de los dos documentos

La tarjeta afirma que un documento anota un desplazamiento negativo con una dirección
que la aritmética no da, y que un segundo documento hereda el error.

**Predigo** que la aritmética confirma la lectura de la tarjeta y que la anotación del
documento es un error de transcripción.

**CONDICIÓN DE FRACASO**: si al re-hacer yo la aritmética sale la cifra que el
documento anota, entonces **la premisa central de la tarjeta es falsa** y lo que hay
que corregir es la tarjeta, no los documentos. Sería el hallazgo más valioso del lote
y va al informe como titular, no como nota al pie.

**TERCER RESULTADO POSIBLE, y por eso lo escribo ahora**: que el documento no se
equivoque ni acierte, sino que esté hablando de OTRA COSA (otra base, otro segmento,
otro registro). En ese caso «errata» es la etiqueta equivocada y corregir el número
sería empeorar el documento. Por eso leo el CONTEXTO de los dos documentos antes de
tocar un byte, que es además lo que la propia tarjeta pone como reserva.

**AUTO-ABSOLUCIÓN si**: doy la errata por buena porque la tarjeta lo dice y la
aritmética «se parece». La cadena de custodia de una etiqueta no sustituye a su
derivación: la tarjeta la heredó de un acta, y esa acta de una lectura.

### P3 — #267, la extensión del búfer

**Predigo** que la geometría que la tarjeta propone como hipótesis (once filas a paso
dieciséis) se deriva del bucle que lo recorre.

**CONDICIÓN DE FRACASO**: si el paso o el número de filas no salen del código, la
extensión queda como COTA POR VECINDAD declarada como tal — y entonces el alta, si
procede, lleva la cota escrita en la ficha en vez de una cardinalidad falsamente
derivada. La tarjeta ya avisa de que la geometría es hipótesis acotada por dos
accesos, no derivación completa; mi trabajo es cerrar esa diferencia o declararla.

**AUTO-ABSOLUCIÓN si**: uso el hecho de que el búfer «termina exacto» donde empieza la
global siguiente como si fuera la derivación de su tamaño. Eso es corroboración de
conjunto —vale, y en el lote anterior valió— pero NO es lo mismo que derivar la
cardinalidad de un gate, y confundirlos es exactamente lo que el estándar de altas
pide separar.

### P4 — #267, qué le pasa a la ficha de #61

**Predigo** que la adjudicación de #61 queda AMPLIADA y no desmentida: que su «único
acceso en el corpus» era correcto para el canal con que se midió, y que lo que cambia
es el marco (ese acceso es una celda de un búfer mayor).

**CONDICIÓN DE FRACASO**: si al censar por los siete canales aparecen más accesos a
esa misma dirección, entonces el «único» de #61 era un CERO EN FALSO por canal y la
ficha no se amplía: se corrige. Es una distinción con consecuencias —ampliar añade,
corregir retracta— y no la voy a difuminar.

---

## 2. #268 — DERIVADO, y NO sale lo que la tarjeta esperaba

Los dos accesos están derivados hasta el final por el lado del código. **P1 queda
REFUTADA en su parte importante**: no son dos hermanas que embaldosan limpiamente
hacia abajo, y uno de los dos PISA la tabla que fichó el racimo.

### 2.1 Los dos dominios, derivados

Los dos sitios tienen la MISMA forma —`[bx + di + base]` con `bx` un valor
enmascarado a 3 bits y `di` cinco veces un argumento— y los dos cuelgan del mismo
bucle llamador, cuyo contador va de 0 a 3 (`cmp si,4` + `jge`). Lo que los separa es
el GATE de cada rutina, que recorta ese 0..3 de forma distinta:

| sitio | base | gate de la rutina sobre el argumento | argumento | `di` = 5×arg | `bx` | alcance real |
|---|---|---|---|---|---|---|
| `DUNGEON.OVL:0x1596` | 0x2E8B | exige que valga 1 o 2 (0x155f-0x1569) | {1,2} | {5,10} | 0..7 | 0x2E90-0x2E9C |
| `DUNGEON.OVL:0x1724` | 0x2E9A | exige que sea menor que 2 (0x16d7) | {0,1} | {0,5} | 0..7 | 0x2E9A-0x2EA6 |

`bx` sale en los dos de enmascarar con 7 un código de casilla que el camino hasta el
acceso obliga a estar en el rango de nibble alto 0xC (`cmp` contra 0xC0 en 0x1577 y en
0x16a9), así que los ocho valores 0..7 son alcanzables: no hay recorte adicional.

### 2.2 ★ EL HALLAZGO: el segundo acceso SE METE en la ventana ya fichada

`0x2E9A + 7 + 5 = 0x2EA6`, y la entrada del ledger que el racimo de #262 dio de alta
empieza en **0x2EA4**. O sea el segundo acceso alcanza **tres bytes (0x2EA4, 0x2EA5 y
0x2EA6) que hoy pertenecen, según el catálogo, a otra global**.

Esto NO lo resuelvo yo por mi cuenta, y digo por qué: hay tres salidas y las tres
tocan trabajo ajeno ya aterrizado.

1. **Las dos cosas conviven** y son tablas que comparten bytes —posible, porque la
   propia forma «filas de 5 leídas con 8 columnas» ya se solapa consigo misma.
2. **La base fichada en 0x2EA4 empieza antes de donde se fichó** y estos accesos son
   suyos.
3. **La cardinalidad de 0x2EA4 (48) o su base vienen de una derivación que habría que
   re-mirar** a la luz de estos dos consumidores, que el lote de #262 no leyó.

Lo que sí queda establecido es que **ninguna de las tres se puede elegir sin volver a
leer la derivación de 0x2EA4**, y ésa es de otro carril y ya está en main. Proponer un
alta mía encima sería fichar sobre una ventana ocupada.

### 2.3 Veredicto por sitio, con su alcance

- `DUNGEON.OVL:0x1596` — **BASE LEGÍTIMA**, sin conflicto: su alcance muere en 0x2E9C,
  ocho bytes por debajo de la ventana ajena. Pero ⚠ su base 0x2E8B **no es alcanzable**
  (el mínimo real es 0x2E90, porque el argumento nunca vale 0): es una base ajustada
  **a su PROPIA tabla**, no a la vecina.
- `DUNGEON.OVL:0x1724` — **CONFLICTO CON VENTANA FICHADA**, no adjudicable en este
  carril sin re-abrir la derivación de otro. Su base 0x2E9A sí es alcanzable.

## 3. #267 — la errata: CONFIRMADA, y el TERCER RESULTADO que pre-registré SÍ se dio

La tarjeta llegó re-encuadrada: la derivación del búfer ya existe por triplicado y lo
que quedaba era corregir la errata en dos documentos y decidir la entrada. Aun así
re-hice la aritmética yo, que era mi P2, y menos mal.

### 3.1 La aritmética, re-derivada de cero

`(-0x539C) & 0xFFFF = 0xAC64`. Control: `0x539C + 0xAC64 = 0x10000` exacto. Y la
instrucción que la tarjeta cita está donde dice (`ULTIMA.EXE:0x56d4`, comparando
contra 0x16). **La cifra correcta es 0xAC64 y la anotada era falsa: P2 CUMPLIDA.**

### 3.2 ★★ Pero el TERCER RESULTADO se dio, y cambia CÓMO hay que corregir

Yo había escrito por adelantado que existía la posibilidad de que el documento no se
equivocara ni acertara, sino que hablase de otra cosa. No es exactamente eso, pero es
su primo peligroso: **la cifra equivocada NO es un número inventado, es una dirección
VIVA de este binario.**

| comprobación | resultado |
|---|---|
| accesos reales a 0x5C64 en el desensamblado | **16**, en cinco ficheros |
| documentos donde 0x5C64 aparece y es CORRECTO | 4 (censo, dos barridos y un acta de geometría) |
| qué es | el campo X del registro que empieza en 0x5C5A |
| de dónde salió la contaminación | la fila INMEDIATAMENTE ANTERIOR del mismo documento habla de ese registro; el número se arrastró una línea hacia abajo |

**Consecuencia operativa, y es la que salva el arreglo**: una sustitución global de
`0x5C64` en el repositorio habría **corrompido cuatro documentos donde la cifra es
correcta**. La corrección tiene que ser quirúrgica a las dos líneas concretas, y por eso
la reserva de la tarjeta («leer el contexto antes de corregir») no era formalismo.

### 3.3 Lo corregido, y lo que NO se retracta

Las dos líneas llevan ahora la cifra correcta **con la aritmética al lado**, para que la
próxima lectura no tenga que fiarse: si alguien duda, la resta está escrita.

Lo que **no** toco: la etiqueta «capa de personajes» del segundo documento. Se escribió
pegada a la dirección equivocada, así que su procedencia es sospechosa, pero se sostiene
por separado en lo que hace la rutina que escribe ahí. Retractarla sin derivarla sería
cambiar un error por otro; queda ANOTADA como no-re-derivada, que es lo honesto.

### 3.4 La entrada en el catálogo — RECOMENDACIÓN, no ejecutada

Medido: el hueco real del catálogo es **0xAC62..0xAD13 (178 B)**, entre el final de
`g_vis_buffer` (0xAC61) y `g_cbt_room_record` (0xAD14); el búfer que los tres documentos
describen es **0xAC64..0xAD13 (176 B)**, o sea deja dos bytes sueltos por debajo.

**Recomiendo darlo de alta**, y la razón es doctrinal más que estética: mientras no esté
en el catálogo, **todo censo que recorra el catálogo es ciego a él por construcción** —
es exactamente el defecto que cerró la tarjeta del vuelco. Que su derivación viva en
tres documentos no lo arregla: los instrumentos no leen documentos, leen el catálogo.

**No la ejecuto en esta entrega**, y lo digo en vez de dejarlo a medias en silencio: un
alta arrastra pines y re-medición del bucket, y en el lote anterior un tercer trinquete
saltó sin que nadie lo previera. Prefiero no meter un cambio de catálogo con el depósito
de contexto que me queda; va como cabo con todo medido, y quien la tome tiene la cifra,
el hueco y las dos fronteras al byte.

---

### 2.4 ★★ Una CLASE que la partición no tiene

Los dos sitios exhiben algo que el instrumento no sabe nombrar: **base ajustada a la
PROPIA tabla**. El bucket de base-ajustada del partidor asume que el ajuste apunta a
la global SIGUIENTE (el caso 1-based clásico); aquí el ajuste es INTERNO — el
compilador emite `base − 5·k_min` porque el índice de fila arranca en 1 y el paso es
5, y el resultado es un desplazamiento que no es la dirección de nada.

Consecuencia práctica, y es la que importa para el catálogo: **el desplazamiento que
aparece en la instrucción no sirve como base de ficha.** Si alguien fichara 0x2E8B
tal cual, estaría dando de alta una dirección que el programa no lee nunca. La ficha
correcta empieza en 0x2E90. Es primo del defecto de #245 pero con el ajuste mirando
hacia dentro en vez de hacia el vecino, y no está en la partición.

---
