# Acta — lote #253 (los AMBIGUOS de la clase (b)) + #257 (tres nombres vivos en SJOG)

Carril `ambiguos-253`, rama `re/ambiguos-253`, worktree propio, re-basado sobre
main f6979e86 (200 entradas de ledger) tras el corte de sesión.

Convención de este acta: los nombres de rutina y de global van en tabla o en
backticks aislados y nunca pegados a un desplazamiento — el sembrador de
identidades lee la adyacencia y una frase descuidada re-atribuye una rutina en
silencio (defecto #84). Los desplazamientos van en la forma `FICHERO.OVL:0x…`,
que el sembrador no puede leer como propuesta de nombre.

---

## 0. PREDICCIONES PRE-REGISTRADAS (escritas ANTES de abrir un solo `.asm`)

Regla de la casa: cada predicción lleva su CONDICIÓN DE FRACASO escrita, y si se
cumple por vía degenerada se declara AUTO-ABSOLUCIÓN en vez de acierto.

### P1 — #253, el par de DNGLOOK (los dos de la familia de 16 bytes)

**Predigo** que los dos accesos indexados de `DNGLOOK.OVL:0x0e6d` y
`DNGLOOK.OVL:0x0e76` son BASES LEGÍTIMAS de dos tablas que el ledger no tiene
fichadas, NO bases ajustadas a un índice 1-based de la global vecina, y que las
tres bases (0x24B6 · 0x24C6 · 0x24D6) son miembros consecutivos de una familia de
tablas de 16 bytes leídas con el MISMO índice.

**Cómo se verifica**: derivando del código el DOMINIO del índice que va en `si`
en ese tramo. Si el dominio es 0..15, el acceso con base 0x24C6 no puede alcanzar
0x24D6 y la base es legítima.

**CONDICIÓN DE FRACASO (escrita por adelantado)**: si el paseo hacia atrás
muestra que el índice es 1-based, o que su dominio llega a 16 (con lo que el
acceso SÍ alcanzaría la global vecina), la predicción está REFUTADA y el veredicto
correcto es «base ajustada, el acceso pertenece a la global siguiente».

**AUTO-ABSOLUCIÓN si**: la doy por confirmada apoyándome únicamente en que las
tres bases distan 16 bytes entre sí. Eso es la PREMISA de la hipótesis del lead,
no evidencia: la aritmética de los desplazamientos es exactamente igual de
compatible con el caso 1-based. Sin dominio derivado del código, el veredicto que
me está permitido escribir es NO-DERIVADO, no CONFIRMADO.

### P2 — #253, el par de 0x58D0 (el desplazamiento con trampa de conteo)

**Predigo** que 0x58D0 es la base legítima de un bitmap de sello por mazmorra de
8 bytes (dato traído de #231: se indexa con `si` en 0..7), que ocupa el hueco
inmediatamente anterior a la global vecina fichada en 0x58D8, y que por tanto
NINGUNO de los dos accesos es base ajustada.

**CONDICIÓN DE FRACASO**: si el dominio del índice alcanza 8 —con lo que el
acceso pisaría 0x58D8—, o si el paseo muestra que el índice viene de un contador
1-based de santuarios, la predicción está REFUTADA.

**AUTO-ABSOLUCIÓN si**: la doy por confirmada citando el dato de #231 sin
re-derivar el dominio EN ESTOS DOS SITIOS. Un dato heredado sobre cómo se consume
una global en otro sitio no es evidencia sobre el dominio del índice AQUÍ.

**Precaución medida y heredada del encargo**: ese desplazamiento aparece ~250
veces en el corpus y casi todas son la instrucción de llamada a esa dirección, no
un acceso a dato. Cualquier cifra mía separa llamada de acceso indexado ANTES de
contar.

### P3 — #257, la rutina de `SJOG.OVL:0x1458`

**Predigo** que los tres nombres vivos describen ASPECTOS QUE CONVIVEN y no
compiten: que el cuerpo es un despacho por identificador de objeto que además
ESCRIBE el efecto, con lo que ni el nombre del ledger ni los dos huérfanos son
falsos, y que la salida correcta es la costura declarada en la ficha, sin ganador.

**CONDICIÓN DE FRACASO**: si el cuerpo resulta ser una consulta pura sin
escrituras, el nombre que habla de conceder queda REFUTADO por el cuerpo; y si
resulta ser una concesión lineal sin despacho, el que habla de conmutación queda
REFUTADO. Cualquiera de las dos sería hallazgo sustantivo y va al informe como
tal, no como matiz.

**AUTO-ABSOLUCIÓN si**: concluyo «conviven» sin señalar en el cuerpo la
instrucción concreta que sostiene cada aspecto. «Conviven» es la respuesta cómoda
y es la que sale sola si no se lee; para contar como derivada tiene que venir con
la línea que la respalda.

**Precaución del encargo**: ese desplazamiento existe en DOS overlays. Todo
conteo se filtra por overlay antes de contar.

---

## 1. MÉTODO, INSTRUMENTOS Y SUS CONTROLES

Los `.asm` se leen en Python, nunca con `grep -r` (en worktree son symlinks y
`grep -r` los salta en silencio). El canal hex siempre con prefijo.

**Control positivo del separador llamada/dato, y un error mío que cazó.** El
encargo avisaba de que ese desplazamiento tiene ~250 ocurrencias que son casi
todas código. Mi primer separador devolvió **0 llamadas y 0 accesos**, o sea un
cero doble que habría «confirmado» lo que yo quisiera. Era un fallo mío: leía un
atributo inexistente de la instrucción. Lo cazó el control positivo, no el ojo —
yo sabía por lectura directa que `CMDS.OVL:0x12f6` y `CMDS.OVL:0x140c` son
llamadas a esa dirección, exigí que salieran, y no salían. Con el instrumento
arreglado los dos aparecen con el destino de llamada resuelto, y el acceso a dato
de `CMDS.OVL:0x13bd`, en cambio, sale por el canal indexado. La separación es
LIMPIA POR CONSTRUCCIÓN: son dos campos distintos de la instrucción, no un
heurístico de texto.

**Control positivo del mapeo a los bytes de datos, y un control DEGENERADO.**
Para leer el contenido de las tablas hay que mapear desplazamiento a posición de
fichero. El control que probé primero fue una global documentada cuyo valor
resultó ser **todo ceros**: indistinguible de leer en el sitio equivocado, o sea
un control DEGENERADO que no valida nada. Los controles que sí valen, y por los
que doy el mapeo por bueno, son dos y no triviales: (a) los 8 bytes de la tabla
de deltas por rumbo leen exactamente las cuatro palabras que su propia ficha
declaraba desde antes de esta lectura; (b) los 8 punteros de la tabla de palabras
de poder caen todos sobre cadenas ASCII válidas y consecutivas.

---

## 2. #253 — LOS CUATRO, ADJUDICADOS

**Los cuatro son BASE LEGÍTIMA. Ninguno es base ajustada.** En los cuatro el
dominio del índice sale del cierre del bucle que lo incrementa, no de la
aritmética con la global vecina.

| sitio | desplazamiento | cierre del bucle | dominio | barre | ¿alcanza al vecino? |
|---|---|---|---|---|---|
| `CMDS.OVL:0x13bd` | 0x58D0 | `cmp si,8` en 0x13f9 | 0..7 | 0x58D0-0x58D7 | NO (vecino en 0x58D8) |
| `OUTSUBS.OVL:0x0025` | 0x58D0 | `cmp si,8` en 0x0039 | 0..7 | 0x58D0-0x58D7 | NO |
| `DNGLOOK.OVL:0x0e76` | 0x24B6 | `cmp si,0x10` en 0x0eaa | 0..15 | 0x24B6-0x24C5 | NO (vecino en 0x24C6) |
| `DNGLOOK.OVL:0x0e6d` | 0x24C6 | `cmp si,0x10` en 0x0eaa | 0..15 | 0x24C6-0x24D5 | NO (vecino en 0x24D6) |

El caso de 0x24C6 es el más justo de los cuatro y por eso el más instructivo: su
último byte queda UNO por debajo de la global siguiente. La geometría sola no lo
podía decidir — hacía falta el cierre del bucle.

### 2.1 Qué es 0x58D0, derivado entero

La rutina que lo escribe (`CMDS.OVL:0x12c8`) es el flujo de gritar la Palabra de
Poder. Recorre 8 entradas comparando la palabra tecleada contra una tabla de 8
punteros y la posición del jugador contra dos tablas de coordenadas. Los datos lo
confirman sin margen: los 8 punteros apuntan a **FALLAX, VILIS, INOPIA, MALUM,
AVIDUS, INFAMA, IGNAVUS, VERAMOCOR** — las ocho Palabras de Poder, en el orden
canónico de las ocho mazmorras. Al casar, el mismo sitio conmuta el bit 7 del
byte de sello, conmuta el tile de la entrada y cobra el turno.

**Corrección de vocabulario sobre el dato heredado de #231**: no es un *bitmap*
de 8 bits, es un ARRAY de 8 BYTES con el sello en el bit 7. El lector lo compara
contra 1 y devuelve verdadero solo si el byte es cero, lo que es coherente con un
byte por mazmorra y no con bits empaquetados. La predicción P2 acertó el tamaño y
el dominio, y falló en la palabra.

### 2.2 La TRAMPA de conteo, medida exacta

| forma en que aparece ese desplazamiento | cuántas | dónde |
|---|---|---|
| destino de llamada (CÓDIGO, en el segmento de código) | **258** | SJOG 90 · CAST 68 · CMDS 67 · TALK 33 |
| acceso a dato por canal indexado | **2** | los dos de la tabla de arriba |
| acceso a dato por canal absoluto | 0 | — |

Es un HOMÓNIMO ENTRE SEGMENTOS: el mismo número es una rutina en un segmento y un
array en el otro. Un censo por texto de ese valor es **99,2 % código**. La cifra
del encargo («~250, casi todas llamadas») queda medida en 258/2.

---

## 3. EL BLOQUE DE TABLAS DE DNGLOOK — 13 altas, y por qué no valía fichar solo 2

Al fichar las dos tablas de la tarjeta aparecieron **nueve AMBIGUOS nuevos** en el
mismo overlay. No era un fallo: es el mecanismo descrito en §4. La lectura
completa del tramo muestra que las dos de la tarjeta son las últimas de un BLOQUE
CONTIGUO que se consume entero desde una sola rutina y que **embaldosa sin un solo
hueco**, muriendo exactamente donde empieza la tabla de deltas por rumbo:

| tramo | cuántas | tamaño | consumidor | cierre que da el tamaño |
|---|---|---|---|---|
| 0x244A | 1 | 8 B | cabecera en `DNGLOOK.OVL:0x0d02` | nibble acotado a 0..7 por su gate |
| 0x2452-0x2475 | 6 | 6 B | dos bucles cortos | `cmp si,6` |
| 0x2476-0x24D5 | 6 | 16 B | un bucle largo | `cmp si,0x10` |

Aritmética de cierre: 0x244A + 8 + 6×6 + 6×16 = 0x24D6, que es la base de la
global ya fichada. El censo por los dos canales de dato sobre 0x244A-0x24D5 da
**21 accesos, todos de un solo overlay y de una sola rutina**, con **trece bases
distintas y ninguna interior** — que es lo que sostiene que son trece tablas y no
una grande.

Estructura del consumo, que es lo que da el ROL de cada una: en los tres bucles
hay cuatro tablas que se reparten entre cuatro destinos según el rumbo, con el
reparto PERMUTADO entre bucles (firma de rotación o espejo), más una o dos tablas
ESPECIALES que un flag selecciona y que van a todos los destinos a la vez.

**Lo que NO está derivado y queda dicho**: qué SIGNIFICAN los valores. Hay una
regularidad fuerte y anotada en las fichas —dos pares de tablas cumplen que sus
valores suman 10 índice a índice, y otras dos son idénticas salvo dos posiciones
permutadas—, lo que sugiere coordenadas sobre un eje de 11 posiciones con
reflexión. Es HIPÓTESIS, va como tal, y necesita leer el consumidor de aguas
abajo. Cabo propuesto en §8.

---

## 4. ★ HALLAZGO TRANSVERSAL: el bucket AMBIGUO es función del LEDGER, no del binario

El bucket AMBIGUO **no es un residuo fijo que se vacía leyendo**. Crece cada vez
que alguien ficha una global cerca de una tabla sin fichar, porque el criterio
compara el hueco hasta la entrada SIGUIENTE contra una cota conservadora cuando no
consigue derivar el paso: cualquier hueco por debajo de esa cota entra como
candidato. Fichar una global mete a sus vecinas sin fichar en el bucket.

Está medido dos veces en este carril, y una de ellas NO es mía:

| momento | AMBIGUOS | por qué |
|---|---|---|
| tarjeta #253 escrita (ledger de 194) | 4 | los cuatro del encargo |
| main f6979e86 al retomar (ledger de 200) | **6** | el aterrizaje de #262/#265 añadió 2 |
| tras fichar solo mis 2 de DNGLOOK | 9 | mis propias vecinas |
| entrega final (ledger de 214) | **2** | quedan los 2 de #262/#265 |

Los dos que quedan son `DUNGEON.OVL:0x1596` y `DUNGEON.OVL:0x1724`, ambos con dos
registros de índice (por eso el paseo no deriva el paso) y ambos justo por debajo
de una base fichada por el otro carril. **No me los auto-asigno**: son del racimo
de DUNGEON y van como tarjeta propuesta en §8.

Consecuencia de método, que es lo que hay que llevarse: *«quedan N ambiguos» es una
FOTO del catálogo del día, no una propiedad del binario* — la misma firma que la
cifra-de-censo-sin-SHA. Y un lote que ficha globales tiene que **re-medir el bucket
después de fichar**, o entrega una mejora local con una regresión al lado.

---

## 5. #257 — LA COSTURA DE LOS TRES NOMBRES

Censo de los 18 sitios NO repetido: está hecho en el acta de docblock-194b. Sí
aplicada la precaución del encargo — el mismo desplazamiento existe en otro
overlay, donde es el prompt del Yell y no esta rutina.

Leí el cuerpo entero de forma independiente y DESPUÉS lo comparé con la evidencia
que el ledger ya tenía. Coinciden en todo lo cotejado, incluido un detalle fino
que vale como control de reproducibilidad: la nota previa avisa de que el
desensamblado **pierde el sincronismo un byte** al salir de la tabla de saltos, y
mi volcado reprodujo exactamente ese artefacto (leí instrucciones imposibles justo
ahí). Dos lectores, dos derivaciones, mismo resultado.

**Adjudicación: los tres nombres son verdaderos y describen aspectos distintos,
pero NO tienen el mismo alcance.** Con la instrucción que sostiene cada uno:

| nombre | universo | a qué es fiel | evidencia en el cuerpo |
|---|---|---|---|
| `get_item_switch` | el LEDGER (4 sitios) | la ESTRUCTURA | despacho real: tabla de saltos de 8 entradas en 0x147d + dos cadenas de comparaciones para lo que cae fuera |
| `apply_item_grant` | el PORT (8 sitios) | el EFECTO | ni una rama solo consulta: contadores con techo, banderas a 0xFF, sumas con tope, y el borrado del objeto en la cola |
| `get_special_item` | notas y #140 (6 sitios) | un SUBCONJUNTO | acierta en las ramas de trama, pero la mayoría de brazos conceden consumibles ordinarios |

O sea: dos nombres describen la rutina ENTERA por dos ejes distintos y **no se
elige ganador entre ellos**; el tercero describe una PARTE y queda dicho su
alcance real para que nadie lo lea como sinónimo de los otros dos.

**Ninguno va a la lista de nombres viejos.** La regla de #251 es que esa lista
tapa lo que el canal de símbolo del DESENSAMBLADO necesita resolver, y el
desensamblado nunca ha impreso ninguno de los dos huérfanos: son nombres del port
y de las notas, no nombres viejos del disasm. La costura va en la ficha, que es
donde la puede encontrar quien busque por cualquiera de los tres.

**No se renombra nada**, según el encargo: son 14 sitios en 6 ficheros que mueven
semillas y banda pegajosa, y el género de renombres tiene dueño.

---

## 6. PREDICCIONES ADJUDICADAS

| | veredicto | nota |
|---|---|---|
| **P1** | **CUMPLIDA, no degenerada** | El dominio salió del cierre del bucle, no de la distancia entre bases. La auto-absolución que me había escrito NO aplica: hay instrucción citada. Y la predicción se quedó CORTA — dijo «familia de tablas de 16 B» y el bloque real es de trece tablas en tres tamaños. |
| **P2** | **CUMPLIDA en tamaño y dominio, FALLADA en la palabra** | Dominio 0..7 y 8 bytes, re-derivado en los dos sitios y no heredado de #231. Pero dije «bitmap» y es un ARRAY DE BYTES con el sello en el bit 7. Corregido en §2.1. |
| **P3** | **CUMPLIDA, no degenerada** | «Conviven» va con la instrucción concreta de cada aspecto, que era la condición que me puse. Y aparece algo que la predicción no preveía: los tres nombres NO son equi-alcance, uno cubre solo un subconjunto de ramas. |

Ninguna condición de fracaso se disparó. La predicción que más rindió es la que
se quedó corta (P1): buscar el dominio del índice destapó el bloque entero.

---

## 7. LO QUE TOCA LA ENTREGA, Y LOS GATES

- 14 altas en el catálogo de globales (13 del bloque de DNGLOOK + el array de
  sellos), todas con extensión DERIVADA de un cierre de bucle o de un gate, nunca
  del hueco hasta la vecina. El fichero se edita por sustitución de cadena, no por
  round-trip: el diff son 98 líneas y CERO borrados.
- 1 cita nueva en la capa manual del ledger de frontera, con la costura de #257, y
  el fichero generado regenerado con su propia herramienta (no editado a mano):
  4 líneas, y el nombre de la rutina intacto.
- **Tres cifras re-pinadas** en los trinquetes que anclan el catálogo, todas con su
  linaje escrito al lado: el conteo de entradas (en sus dos sitios), la partición
  del canal del inmediato (195 → 197 y su complemento 484 → 482) y el conteo de
  globales que solo se ven por interiores (8 → 9). Otras cuatro cifras dependientes
  se re-verificaron y NO se movieron, y quedan dichas como tales.

⚠ La tercera NO la había previsto: la encontró el trinquete al correrlo, no yo al
razonarlo. Es el argumento entero a favor de que estas cifras vivan clavadas en un
test y no en la cabeza de nadie.

GATES, desde la raíz del worktree, POST-`git add`, sin tuberías y con el código de
salida leído por separado: seed_gate **0** · la tanda de cinco de pytest **0**
(165 pasan) · genero **0** · las dos de cita pegajosa **0** y **0** · globals_map
**0**. El primer intento de seed_gate salió en ROJO por una frase mía en la que una
palabra en minúsculas quedaba pegada a un desplazamiento entrecomillado; reescrita
la frase, verde. Nada de e2e (hay HOLD).

**Tanda AÑADIDA por el estándar de altas al catálogo** (porque esta entrega toca el
catálogo, no solo lo lee): las tres suites de catálogo, **0**, 43 pasan.

**Validación estructural del catálogo, exigida por el mismo estándar.** El fichero se
revalidó contra el de partida y no solo contra sí mismo, que es la diferencia entre
comprobar y creerse:

| comprobación | resultado |
|---|---|
| direcciones duplicadas | NINGUNA |
| solapes NUEVOS introducidos por esta entrega | **NINGUNO** |
| solapes preexistentes | 4, conjunto IDÉNTICO al de la rama de partida |
| las 14 altas presentes con su tamaño | sí (8 · 6×6 · 6×16 · 8) |
| diff del catálogo | 98 líneas = 14 × 7, y **CERO borrados** |

⚠ Los 4 solapes preexistentes (dos pares cortos y dos anidados con paso declarado)
NO son míos y no los toco: mi primer validador los sacó y el reflejo fácil era
leerlos como daño propio. Se descartan por COMPARACIÓN con el árbol de partida, no
por inspección — un validador que solo mira el resultado final no puede distinguir
lo que traías de lo que traía el fichero.

---

## 8. CABOS — propuestos, NO auto-asignados

1. **Los 2 AMBIGUOS de DUNGEON** (`DUNGEON.OVL:0x1596` y `DUNGEON.OVL:0x1724`).
   Nacidos del aterrizaje de #262/#265, mismo racimo, casi seguro tablas hermanas
   justo por debajo de la base que aquel lote fichó. Se cierran con la misma
   receta de este carril: leer el cierre del bucle que define el índice.
2. **Qué significan los valores del bloque de DNGLOOK.** Trece tablas fichadas con
   extensión derivada y semántica pendiente. La vía es leer el consumidor de aguas
   abajo del búfer al que se escriben, no seguir mirando los números.
3. **Re-medir el bucket como parte del cierre de todo lote que fiche globales.**
   Es la generalización de §4 y hoy no lo hace nadie. Podría ser una línea en el
   propio informe del instrumento en vez de una regla que haya que recordar.
4. **Corrección menor de prosa**: la cabecera de uno de los dos trinquetes que he
   tenido que re-pinar decía «con 197 entradas» donde la aserción de debajo decía
   200. Es un desliz heredado; no lo he tocado para no mezclarlo con mi cambio.
