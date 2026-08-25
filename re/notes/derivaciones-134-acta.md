# ACTA #134 — la rutina de RENDER que escribe `g_dng_map`: qué escribe, cuándo, y por qué NO es la productora de la contaminación

Pieza 2 del encargo de derivación. Rama `re/derivaciones-152`, base `994d4fc2`; `main` al
abrir la pieza: `f4951017`. Cero ficheros de `game/src` tocados.

**Titular**: los tres bits bajos que la rutina machaca son una **FASE DE ANIMACIÓN de la
estalactita que gotea**, con avance por sorteo desde el reposo y avance forzado una vez
arrancada. Es un efecto de render con **estado PERSISTIDO** y **consumo de RNG por
fotograma**, y eso es un hallazgo de verdad. Pero **no puede producir** la contaminación
entre mazmorras: no crea celdas, no las mueve y no sale del bloque de la planta actual.
La hipótesis de la tarjeta queda **REFUTADA por mecanismo**, y el testigo del 27-07 sigue
en cuarentena — lo que este acta hace es **quitar un candidato** y estrechar la búsqueda
a la vía de CARGA.

---

## 1. La rutina, entera

`re/disasm/DUNGEON.OVL.asm` 0x1682, `ret 8` = cuatro argumentos word.

| offset | instrucción | lectura |
|---|---|---|
| 1682 | `push bp` … `sub sp, 8` | prólogo |
| 168a | `push word ptr [bp + 0xa]` / `push word ptr [bp + 8]` | |
| 1690 | `call 0x10dc` | trae el código de celda de esas coordenadas |
| 1696 | `cmp ax, 0xa0` / `jge` | por debajo de 0xa0: dibuja y sale, sin escribir |
| 169e | `and ax, 0xf0` | conmuta por nibble ALTO |
| 16a9 | `cmp ax, 0xc0` / `je 0x16c4` | ★ la única rama que escribe |
| 16c4 | `mov ax, word ptr [bp + 4]` / `add ax, 0x14` … `call 0x134a` | dibuja el muro |
| 16d7 | `cmp word ptr [bp + 4], 2` / `jl` | ★ GATE 1: sólo los dos escalones más cercanos |
| 16e0 | `cmp byte ptr [g_dng_wall_variant], 1` / `je` | ★ GATE 2: sólo la variante 1 |
| 16ea | `mov ax, word ptr [bp - 6]` / `and ax, 7` | ★ los TRES BITS BAJOS de la celda |
| 16f3 | `cmp word ptr [bp + 4], 0` … `mov ax, 0x43` / `mov ax, 0x21` | X de pantalla según el escalón |
| 1704 | `cmp word ptr [bp + 6], 0` / `mov ax, 0xbe` / `sub ax, [bp - 4]` | ★ espeja la X: [bp+6] es el LADO |
| 1721 | `mov bx, word ptr [bp - 8]` | los tres bits bajos, como índice |
| 1724 | `mov al, byte ptr [bx + di + 0x2e9a]` | tabla, índice = escalón x5 + bits bajos |
| 1732 | `call 0x145c` | ★ dibuja la gota Y DEVUELVE la fase nueva |
| 1735 | `mov word ptr [bp - 8], ax` | |
| 1738 | `mov al, byte ptr [g_floor]` … `shl si, cl` con `cl = 6` | planta x 64 |
| 1743 | `mov ax, word ptr [bp + 8]` / `and ax, 7` / `shl ax, cl` con `cl = 3` | el argumento que va por ocho |
| 174d | `mov cx, word ptr [bp + 0xa]` / `and cx, 7` | el argumento que va crudo |
| 1756 | `add si, ax` | |
| 1758 | `add si, 0x595a` | ★ el puntero a la celda de `g_dng_map` |
| 175c | `and byte ptr [si], 0xf8` | ★★ BORRA los tres bits bajos |
| 175f | `mov al, byte ptr [bp - 8]` | |
| 1762 | `add byte ptr [si], al` | ★★ ESCRIBE la fase nueva |
| 1783 | `ret 8` | |

`and 0xf8` conserva el nibble alto (el TIPO de celda) y el bit 3. Ese bit 3 es el de
**iluminado**: el propio corpus lo fija en 0x0abd (§3), y el diccionario de celdas ya lo
tenía para los campos mágicos. Así que la rutina toca **exclusivamente el subtipo**, y
sólo el de las celdas de tipo 0xC.

## 2. Qué es el valor escrito: una FASE, con su regla de avance

El productor es `DUNGEON.OVL` 0x145c, `ret 8`, cuyo segundo argumento es la fase actual
y cuyo valor de retorno es la fase nueva:

| offset | instrucción | lectura |
|---|---|---|
| 145f | `cmp word ptr [bp + 6], 5` / `jne` | fase 5 = la última |
| 1465 | `mov word ptr [bp + 6], 0` | ★ envuelve a reposo |
| 146a-1483 | pushes + `call 0xffffc1de` | dibuja el fotograma de cierre |
| 1486 | `jmp 0x1502` | devuelve 0 |
| 148a-14ce | ramas de dibujo por fase (4, y el resto) | la gota bajando |
| 14ea | `cmp word ptr [bp + 6], 0` | |
| 14ee | `jne 0x14ff` | ★ si YA está en marcha, avanza sin sortear |
| 14f0 | `sub ax, ax` / `push ax` | mínimo del sorteo |
| 14f3 | `mov ax, 0x40` / `push ax` | máximo del sorteo |
| 14f7 | `call 0xffff9ec2` | ★ tirada de RNG |
| 14fa | `cmp ax, 4` / `jge 0x1502` | ★ si sale 4 o más, NO arranca |
| 14ff | `inc word ptr [bp + 6]` | avanza una fase |
| 1502 | `mov ax, word ptr [bp + 6]` / `ret 8` | devuelve la fase |

⇒ la fase vive en 0 (reposo); desde 0 arranca sólo si la tirada cae por debajo de 4;
una vez en marcha avanza **una fase por fotograma renderizado**, sin sorteo, hasta la 5,
que devuelve a 0. Los dos gates de §1 la acotan a la **variante 1 de muro**, que el
propio corpus documenta como *«a dripping stalactite»*, y a los dos escalones de
profundidad más cercanos. Todo cuadra: **es la animación del goteo**.

**Consecuencia que sí importa**: cada fotograma con una estalactita en reposo a la vista
**consume una tirada del generador**, y la fase resultante **se guarda en la partida**
(el búfer está dentro de la ventana de SAVED.GAM). Mirar una pared ensucia el save.

## 3. Los ejes, etiquetados POR LECTURA (que es lo que la tarjeta exigía)

La tarjeta advertía de no etiquetar `(a&7)*8 + (b&7)` sin leer, por el historial de
transposiciones. No se etiqueta por herencia: se lee de un sitio del mismo búfer donde
los operandos son las globales YA NOMBRADAS, `DUNGEON.OVL` 0x0ac9-0x0adc:

| offset | instrucción |
|---|---|
| 0ac9 | `mov al, byte ptr [g_party_y]` |
| 0acc | `mov cl, 3` |
| 0ace | `shl ax, cl` |
| 0ad0 | `add bx, ax` |
| 0ad2 | `mov al, byte ptr [g_party_x]` |
| 0ad7 | `add bx, ax` |
| 0adc | `mov byte ptr [bx + 0x595a], al` |

**La coordenada que se multiplica por ocho es la Y; la que se suma cruda es la X.**
Trasladado a 0x1682: el argumento en `[bp + 8]` es el de rol **Y** y el de `[bp + 0xa]`
es el de rol **X**. (Ese mismo tramo, en 0x0abd `or byte ptr [bp + 4], 8`, es el que
enciende el bit de iluminado sobre la celda de la party — de ahí que §1 pueda afirmar
qué es el bit 3 sin heredarlo.)

Los dos llamadores, 0x1b55 y 0x1b7d, están dentro de un bucle con contador 0..3
(`inc si` / `cmp si, 4` / `jge`), y empujan: el contador como escalón, un 0 o un 1 como
lado, y las dos coordenadas como el punto de la party más o menos los deltas por rumbo
de dos tablas de cuatro bytes indexadas por `g_dng_facing`. Con eso, el gate
`[bp + 4] < 2` significa **los dos escalones más cercanos del pasillo**, y el par de
llamadores es el par **lado izquierdo / lado derecho**.

## 4. ★ No es UNA rutina: son DOS, y el censo por literal no las ve

`DUNGEON.OVL` 0x150a tiene el MISMO par de instrucciones sobre el mismo búfer:

| offset | instrucción |
|---|---|
| 15a4 | `call 0x145c` |
| 15c8 | `add si, ax` |
| 15ca | `add si, 0x595a` |
| 15ce | `and byte ptr [si], 0xf8` |
| 15d4 | `add byte ptr [si], al` |

Misma fase, mismo productor, mismo búfer, otro tramo del pasillo. **El productor de la
tarjeta es un PAR**, no una rutina suelta.

★ **Punto de instrumento, declarado**: el censo de escrituras hecho buscando el literal
como destino (`mov byte ptr [... 0x595a],`) devuelve **6** líneas y **no ve ninguna de
las dos**, porque las dos construyen el puntero antes (`add si, 0x595a`) y escriben por
él. Es exactamente el fallo que #119 ya pagó en el búfer de terreno, repitiéndose en
otro búfer. El censo honesto de escritores de `g_dng_map` necesita las tres formas:

| forma | qué la delata | líneas |
|---|---|---|
| escritura directa por literal | `mov byte ptr [... 0x595a],` | 6 |
| lectura-modificación por literal | `and byte ptr [... 0x595a],` | 4 |
| escritura por puntero construido | `add/mov <reg>, 0x595a` seguido de escritura por el registro | 9 sitios de construcción, de los que 2 escriben |

Total de referencias al búfer en el corpus: **51**, repartidas en 7 ficheros
(DUNGEON 23, SJOG 10, DNGLOOK 9, CAST 4, CAST2 2, CMDS 2, MAINOUT 1).

## 5. ★ Enganche con la pieza 1: los «tiles de campo 0x80-0x83» son CELDAS DE MAZMORRA

La pieza 1 de este encargo (acta #152) dejó que `CAST.OVL` 0x004c escribe en este mismo
búfer haciendo `and al, 8` (conservar iluminado) y `or` con la tabla de cuatro bytes de
tipo de campo. Con el diccionario de celdas ya en la mano, esos cuatro valores se leen
solos: **nibble alto 8 = campo mágico, bits bajos = el tipo de campo**. Y el orden que
sale de la tabla del binario —In Zu con bits bajos 0, In Nox con 1, In Flam con 2,
In Sanct con 3— es **byte a byte el orden de campos por nibble bajo que el corpus ya
tenía documentado de forma independiente**.

⇒ tercera confirmación, y de una vía distinta a las dos de la pieza 1: esos cuatro
valores **no son tiles de mapa de exterior**, son códigos de celda de mazmorra. El
`and al, 8` del hechizo y el `and [si], 0xf8` del render son la misma convención de
campo de bits sobre el mismo búfer, cada uno respetando lo que no le toca.

## 6. Careo con el port

| pregunta de la tarjeta | respuesta |
|---|---|
| ¿el render del port escribe el mapa? | **NO.** Todas las escrituras de celda del port salen de rutas de JUEGO (buscar, trepar, cofre, trampa); ninguna del dibujo. La fase de goteo **no está modelada en absoluto**. |
| ¿arrastra el save del port? | El port serializa el búfer y conserva el campo de subtipo, con el bit de iluminado ya modelado como tal. Como nadie escribe la fase, sale y entra en cero. |
| ¿es hueco de fidelidad? | Sí, de dos clases distintas: falta la **animación** (presentación) y falta el **consumo de RNG por fotograma** (paridad de flujo). La segunda es la que puede morder. |

★ **Y hay una convergencia que vale como control**: el port ya nombra el bit 3 del
subtipo como el de iluminado y lo preserva con máscaras en más de diez sitios. Que la
máscara del binario sea justo `0xf8` —la complementaria— dice que el port acertó el
reparto de bits sin haber leído estas dos rutinas.

## 7. La pregunta de la tarjeta: ¿es la productora de la contaminación? **NO**

Tres razones, cada una suficiente por sí sola:

1. **No crea contenido.** El único camino que escribe está detrás de
   `and ax, 0xf0` / `cmp ax, 0xc0` / `je`: la celda **ya tenía** el tipo 0xC antes. La
   rutina no puede convertir una celda de una mazmorra en una celda de otra.
2. **No escribe fuera del subtipo.** `and [si], 0xf8` conserva el nibble de tipo y el bit
   de iluminado; lo escrito está acotado a 0..5 por la máquina de fases de §2.
3. **No sale del bloque de la planta actual.** El puntero es
   `(g_floor << 6) + ((Y & 7) << 3) + (X & 7) + base`: 64 bytes, la planta en la que está
   la party, con envoltura. No alcanza el bloque de ninguna otra planta ni de otra
   mazmorra.

Una partida con el mapa de otra mazmorra dentro exige **contenido entero equivocado**, y
eso sólo lo puede poner quien rellena el búfer al entrar (o quien no lo rellena). Esta
rutina llega DESPUÉS y encima de lo que ya hubiera: es aguas abajo del defecto, no su
origen. Con la contaminación ya presente, además, **la ensucia más** —le mete fases de
goteo a las paredes del mapa equivocado— y por eso puede haber parecido implicada.

**El testigo del 27-07 NO se saca de cuarentena**: este acta no lo explica ni lo
exonera, sólo retira un candidato. La búsqueda queda estrechada a la vía de CARGA
(quién rellena el búfer al entrar y qué pasa al salir), que es donde el acervo ya
apuntaba y donde este carril no ha entrado.

## 8. Lo que este carril NO ha hecho

- No se ha leído `0x10dc` (el que trae el código de celda) ni las tablas de deltas por
  rumbo: no hacían falta para el veredicto de capa y de mecanismo.
- No se han contado las tiradas de RNG por fotograma en una escena concreta; §2 da la
  regla, no un presupuesto.
- No se ha tocado la vía de carga, que es donde queda la tarjeta viva.
