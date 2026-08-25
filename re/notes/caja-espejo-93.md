# #93 (T13) — La «fila de diferencia» del pasillo 3D: NO existe. Comparaba dos CONVENCIONES

Fecha: 2026-07-30. Estado: **CERRADA con veredicto de EQUIVALENCIA**, y con el defecto
en mi propia nota, no en el port.

## 1. Lo que decía el ticket

`barrido-gfx-consumidores.md` §A11.1 dejó abierto que el ASM opera sobre `y∈[14,178]` =
**165 px** mientras `dungeon.ts` declara «altura nativa **164** desde Y=14» ⇒ `14..177`, y
lo etiquetó «discrepancia de UNA fila, sin resolver».

## 2. La esquina del ASM es INCLUSIVA (derivado, con corroborante independiente)

La primitiva de relleno del driver EGA —ya fichada en el ledger, `EGA.DRV` 0x1180— monta
su contador de filas así:

```
119a: sub dx, bx            ; contador = y2 - y1
119c: mov cs:[0x222], dx
11bc: pop si                ; si = y1  (venía del `push bx` de 11a1)
11cd: call 0x4f6            ; pinta UNA fila
11d0: inc si
11d1: dec cs:[0x222]
11d6: cmp cs:[0x222], 0
11dc: jge 0x11cd            ; sigue mientras >= 0
```

Es un do-while que decrementa DESPUÉS de pintar y continúa con `>= 0` ⇒ pinta
`(y2-y1)+1` filas, y `si` arranca en `y1`, así que la última pintada es exactamente `y2`.
**Las dos esquinas entran.**

★ Corroborante que no depende de mi lectura del bucle: el primer `fill_rect2` del pasillo es
`(8, 8, 183, 183)`. Con esquina inclusiva son **176×176**, que es justo el viewport de U5
—y el mismo número que el port calcula por otra vía (`VIEWPORT = {x:8, y:8, tile:16,
tiles:11}` ⇒ `16*11 = 176`)—. Con esquina exclusiva saldría 175 y no cuadraría con nada.

⇒ El ASM sí opera sobre **165 filas** (14..178). Esa mitad del ticket era correcta.

## 3. Pero el «164» del port NO es la misma magnitud

Medido, no leído de la prosa: en `game/assets/dungeon-persp.json`, las **3 variantes de muro
tienen 26 rects cada una y TODAS miden `h = 164` exacto** (anchos 8/16/24/32/56/80). Y ese
asset lo produjo nuestro extractor a partir de los `DNG*.16` de EA ⇒ **164 es la altura del
ARTE ORIGINAL**, no una elección del port.

Y el `164` de `dungeon.ts:537` (`bot = SLICE_Y + 164`) es una **coordenada de canvas**, donde
el borde inferior es una ARISTA: los consumidores usan `bot - top` como altura
(`fillRect(l, top, r-l, bot-top)`) ⇒ cubre `14..177`, **164 filas**. Coincide con el arte,
no lo contradice.

⇒ **«165» y «164» miden cosas distintas**: 165 es la extensión de las operaciones RÁSTER
(limpiar la mitad derecha + espejar), 164 es la altura del ARTE en los dos lados. Que la
caja ráster sea una fila más alta que el arte es del original, no del port.

## 4. Y la fila 178 sale NEGRA en los dos

- **Original**: `fill_rect2(8,8,183,183)` la deja negra; el arte de la mitad izquierda acaba
  en la 177, así que la 178 izquierda sigue negra; el `fill_rect_op` espeja esa fila negra
  sobre la derecha ⇒ negro sobre negro.
- **Port**: `ctx.fillRect(ox, oy, 176, 176)` pinta de negro las filas 8..183 **antes** de
  cualquier rodaja, y ninguna rodaja llega a la 178 ⇒ negra.

**No hay fila que falte.** T13 cierra por EQUIVALENCIA y el port no se toca — su prosa
(«altura nativa = 164») es además CORRECTA y está ahora respaldada por la medición del asset.

## 5. ★ La trampa, que sí es generalizable

El ticket nació de comparar una **caja de esquina inclusiva** (DOS/`fill_rect`) contra una
**coordenada de arista** (canvas). Con esa mezcla, *cualquier* careo geométrico del anexo
sale desviado en 1 px sistemáticamente y siempre en el mismo sentido — y el desvío tiene
pinta de hallazgo. Antes de escribir «discrepancia de una fila» en cualquier otro ticket del
barrido gfx hay que fijar la convención de los dos lados; aquí la fijan el bucle de §2 y el
`bot-top` de §3, no la intuición.

Nota de método: la cifra del port la saqué primero de un docblock. **El docblock decía la
verdad, pero yo no lo sabía hasta medir el asset** — y la magnitud que el docblock nombra
(altura del arte) no era la que el ticket estaba comparando (extensión del ráster). Leer la
prosa y creerla habría dado el veredicto correcto por el motivo equivocado.
