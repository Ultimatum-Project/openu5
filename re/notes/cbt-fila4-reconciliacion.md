# #73 (i) — Los tiles `0x98`/`0xbb` y la fila 4 del `.CBT`, reconciliados

Encargo: «¿son fuentes los TILES `0x98`/`0xbb` de cm64 (fila 4)? — semántica de tile por
derivar». **La premisa hay que corregirla en dos puntos antes de responder**, y al hacerlo el
registro entero queda legible.

**VEREDICTO CORTO**: `0x98` y `0xbb` **no aparecen en cm64** (0 veces, ninguno). Y en todo el
`.CBT` **no son la misma clase de cosa**: `0x98` es un **sprite de unidad** y `0xbb` es un
**tile de terreno**. La fila 4 tampoco es una fila de tiles: es la de **playerStarts del lado
SUR**.

---

## 1. El registro `.CBT`, legible entero

352 B = 11 filas × 32. El volcado de cm64 (registro 48 = Covetous dungIdx 3 × 16 + sala 0)
enseña la estructura de un vistazo:

- **columnas 0-10 × 11 filas = la ARENA 11×11** (terreno). En cm64: `ff 4f 44 d0 d1 d2 d3 d8
  b1 8a`.
- **columnas 11+ = DATOS**: playerStarts (filas 1-4) y las 16 map-units (filas 5-7, y más
  columnas en 8-10).

```
        col:  0  1  2  3  4  5  6  7  8  9 10 | 11 12 13 14 15 16 17 18 19 20 21 22 …
 fila  1:    ff 4f 4f b1 44 44 44 44 44 4f ff | 00 00 00 00 00 00 00 00 00 00 00 00   OESTE
 fila  2:    4f 4f 44 44 44 44 44 44 44 4f ff | 02 01 01 00 00 00 05 06 04 05 07 03   ESTE
 fila  3:    44 44 44 44 44 44 4f 4f 4f 4f ff | 00 00 00 00 00 00 00 00 00 00 00 00   NORTE
 fila  4:    44 44 44 44 44 44 4f ff ff ff ff | 00 00 00 00 00 00 00 00 00 00 00 00   SUR
 fila  5:    44 44 44 44 44 44 8a ff ff ff ff | 1e 02 02 05 06 ec ec ec ec ed ed ed …  SPRITE
 fila  6:    44 44 44 44 44 44 4f ff ff ff ff | 09 09 09 08 08 08 07 07 07 08 07 04 …  X
 fila  7:    44 44 44 44 44 44 4f 4f 4f 4f ff | 05 04 06 04 06 05 04 06 05 01 02 01 …  Y
```

### 1.1 El mapeo fila→lado queda CONFIRMADO por los datos

De la cabeza de `DNGLOOK 0x117E` derivé: `facing 3 (O) → fila 1` · `facing 1 (E) → fila 2` ·
`facing 0 (N) o 5 → fila 3` · resto (`facing 2` = S, y 4) → fila 4. Las columnas 11-16 son X y
17-22 son Y de los 6 slots del party.

En cm64, **sólo la fila 2 tiene coordenadas reales** (`02 01 01 00 00 00` / `05 06 04 05 07
03`); las filas 1, 3 y 4 son **ceros**. Eso casa exactamente con el hecho ya conocido del
proyecto —«playerStarts del `.CBT`: sólo ESTE tiene coordenadas reales; N/S/O son (0,0)×6»— y
por tanto **confirma el mapeo por una vía independiente del ASM**.

⇒ **La fila 4 no contiene tiles.** Contiene los playerStarts (degenerados) del lado SUR.

## 2. `0x98` y `0xbb` no son la misma clase de cosa

Censo sobre los **112 registros** completos:

| valor | apariciones | dónde | lectura |
|-------|-------------|-------|---------|
| `0x98` | 24, en 7 registros | **22 de 24 en la FILA 5**, columnas 11-22 | **sprite de map-unit** |
| `0xbb` | 11, en 9 registros | **todas en columnas 3, 5, 6, 7** (zona 0-10) | **tile de terreno** |

Control de que la partición columna≤10 / columna≥11 es real: los bytes más comunes en la zona
de terreno son `ff, 05, 4d, 44, 4f, 45, 40, 4c` (familia de tiles), y en la zona de datos son
`00, 05, 04, 06, 01, 08, 02, 03` (coordenadas y contadores pequeños). Son dos poblaciones
distintas.

⇒ Emparejar `0x98` con `0xbb` mezcla un sprite con un tile. `0x98` **sí** pasaría por el gate
(lo coloca el bloque B); `0xbb` **no** (es terreno, y el terreno no lo coloca el bloque B).

## 3. ★ Corrección al inventario del acta del testigo

La fila 5 de cm64, columnas 11-26, es:

```
1e 02 02 05 06 | ec ec ec ec | ed ed ed ed ed ed | 9c
```

- **4 × `0xEC` (236)** — no 6, como dice el acta del testigo visual.
- **6 × `0xED` (237)** ✔.
- **1 × `0x9C` (156)** = el Ghost ✔.
- Y cinco unidades más antes: `0x1E`, `0x02`, `0x02`, `0x05`, `0x06`.

## 4. ★★ CERRADO — el testigo vio TERRENO, y la contradicción se disuelve entera

> Con el diccionario del port (`game/src/core/data/TileData.json`, aportado por el lead):
> **`0xD8` = 216 = `Fountain1`** (IsPartOfAnimation, 4 frames) y **`0xD0`-`0xD3` = 208-211 =
> `CornerStructure1-4`». Es diccionario de **NOMBRES** —datos de EA—, suficiente para
> identificar qué se VE; no es derivación del binario ni veredicto de mecánica.

Reconciliación de POSICIONES en cm64:

| candidato | dónde está | vecindad |
|---|---|---|
| **(a) terreno `0xD8`** | **exactamente DOS**: `(col 6, fila 0)` y `(col 6, fila 10)` = **arriba-centro y abajo-centro** | **flanqueada 2 de 2**: `d0 [d8] d1` arriba, `d3 [d8] d2` abajo |
| (b) map-units `0xED` | seis: `(8,1) (7,2) (4,1) (8,8) (7,9) (4,9)` — X = 4, 7, 8, dispersas | sobre terreno llano `44`/`4f`/`b1`; **1 sola** adyacencia a CornerStructure en las seis |

★ **Y lo decide el propio acta del testigo**, que describe las fuentes como «arriba-centro,
abajo-centro» **y «flanqueadas por triángulos decorativos NO transitables (mosaico, no
salidas)»**. Eso es, literalmente y celda a celda, el patrón `d0 [d8] d1` / `d3 [d8] d2` del
**terreno**: una `Fountain1` con una `CornerStructure` a cada lado. Las `0xED` no están
arriba-centro ni abajo-centro, y no están flanqueadas por nada decorativo.

⇒ **El testigo vio las fuentes del TERRENO de la arena, no los sprites 237.** El acta acertó
en «posiciones exactas del `.CBT`» — pero de la zona equivocada del `.CBT`: columnas 0-10
(terreno), no la fila 5 (map-units).

### 4.1 La contradicción se disuelve ENTERA

El terreno de la arena (columnas 0-10) **no lo coloca el bloque B**: lo consume el renderizador
de combate desde la base `0xAD14`. Sólo las 16 map-units pasan por el gate. Por tanto, con la
sala despejada (`0xA0` en el mapa arrastrado ⇒ gate cerrado):

| lo que observó el testigo | explicación |
|---|---|
| fuentes visibles arriba-centro y abajo-centro, flanqueadas | **terreno**, ajeno al gate ✔ |
| sin combate, nunca | gate cerrado ⇒ 0 map-units ⇒ 0 enemigos ✔ |
| las 236 «no se manifiestan como nada» | tampoco se colocaron ✔ |
| el Ghost (`0x9C`) ausente | ídem ✔ |
| cuartito vacío pese a los 3 objetos del dato | ídem ✔ |
| el trigger de la lápida SÍ funciona | los triggers no son map-units ✔ |

**Cero anomalías restantes.** Un solo mecanismo explica todas las observaciones, y confirma de
paso toda la cadena: gate = no-repoblar sala despejada · complemento del `&0xAF` · quimera
(geografía de Doom + contenido de Covetous).

## 5. Lo que sigue abierto

Nada de esta saga. La pregunta que dejé afilada en la versión anterior de esta nota («¿qué son
`0xD0`-`0xD3` y `0xD8` en el tileset de la arena?») quedó contestada por el diccionario del
port y cerró §4.

## 6. ⚠ Instrumento: un censo POR FILA sub-cuenta

Las filas 2, 3, 4 y 8 dan **cero accesos** si se censa por su dirección propia
(`0xAD14 + fila*32`) en los tres canales. Y sin embargo las filas 1-4 **se leen
demostrablemente** en el bloque A de `0x117E`, vía `bx = ([bp-2] << 5) + columna` sobre la
**base** `0xAD14` (`[bx - 0x52ec]`).

**Regla**: cuando un búfer se indexa con desplazamiento calculado, censar por la dirección de
cada fila da ceros falsos. Hay que censar **la base** (aquí: 33 accesos a `0xAD14`, repartidos
por BLCKTHRN, CAST2, COMBAT, DNGLOOK, DUNGEON, ENDGAME y ULTIMA.EXE) y mirar qué índices puede
tomar. Es el cuarto agujero del mismo instrumento en tres días.

## 7. Procedencia

`DUNGEON.CBT` (39 424 B, 112 registros de 0x160) leído en bruto. Cuerpo de `DNGLOOK 0x117E`
en `re/disasm/DNGLOOK.OVL.asm`. Censos con parseo en Python por los tres canales (hex, símbolo,
complemento a dos). Sin tocar `game/src`.
