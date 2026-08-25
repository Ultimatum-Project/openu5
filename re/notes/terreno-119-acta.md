# ACTA #119 — las CINCO tandas: 13 call-sites de terreno al canal VOLÁTIL (y el caballo, NO)

**TANDAS 1-3 de la tarjeta.** La tanda 1 movió un solo call-site —`use-tools.ts:281`, la hierba del
barrido del Cetro de Lord British— de `mapOverrides` (capa PERSISTIDA, viaja en el save)
al canal de terreno volátil; las TANDAS 2 y 3 van al final del acta, desbloqueadas por
la sonda de #121, que CONFIRMÓ el modelo en vivo. Las tandas 4 y 5 cierran el encargo — la 5 con un NO derivado.

El modelo NO se re-derivó: viene de #113 (ventana del save) y del censo de #119 (el canal
por puntero). Lo que sí se hizo aquí, por no heredar una clasificación de oídas, fue
**verificar la cadena de ESTE call-site instrucción a instrucción** — porque el
discriminador terreno-vs-objeto no es el nombre de la mecánica, es el puntero que se
escribe, y ese punto ya produjo 2 escrituras en falso en el censo por desplazamiento
literal (hallazgo de instrumento de la tarjeta).

---

## 1. La cadena de la escritura, verificada en este carril

`re/disasm/CAST.OVL.asm`, barrido 3×3 del Cetro — CAST 0x19a5-0x19f9:

```
19c1  call 0x8482          ; → tile_addr(y,x); devuelve PUNTERO en DI
19c4  mov di, ax
19c6  mov al, byte [di]    ; lee el tile POR EL PUNTERO
19c8  and al, 0xf0
19ca  cmp al, 0x70         ; ¿ShadowlordBoundary 0x70-0x7F?
19cc  jne 0x19e6
19ce  mov byte [di], 5     ; ★ ESCRIBE hierba POR EL MISMO PUNTERO
```

`0x8482` resuelto con `re/tools/routine_census.resolve_near_call` (base de near-call de
CAST.OVL = `0xbf80`, leída del propio `code_files()`, no a ojo) → **ULTIMA.EXE 0x4402**,
que es el `tile_addr(y,x)` del censo de #119 (17410 decimal = 0x4402). Los otros dos
calls del bloque resuelven a ULTIMA.EXE **0x5910** (0x9990) y **0x223C** (0x62bc) — el
repintado y el SFX por celda que el comentario del port ya les atribuye; **no
re-adjudicados en este carril**, sólo resueltos para dejar claro cuál de los tres es el
que escribe.

⇒ el destino es el **búfer de terreno vivo** (small map `DS:0x6608 + (y<<5) + x`;
overworld, la caché de 4 chunks de 16×16), **no** la tabla de objetos `DS:0x5c5a`.
Con eso, las dos propiedades de #113 aplican tal cual:

| propiedad | por qué | consecuencia |
|---|---|---|
| no viaja en el save | `0x6608` cae FUERA de `[0x55A6, 0x6606)` — 0x1060 B, escrita entera por INTRO 0x1dfd, leída entera por INTRO 0x0eb4 | la hierba no debe estar en `mapOverrides` |
| muere en la carga de mapa | el cargador TOWN 0x0408 vuelve a leer del `.DAT` un bloque de 1 KiB sobre DS 0x6608 en cada entrada y cada cambio de planta | la barrera vuelve al re-entrar |

**Nota de cita**: el encargo del lead nombraba este call-site como «ULTIMA.EXE 0x4937».
`0x4937` no es código sino la zona de STRINGS del (U)se (0x4930 `"Crown"`, 0x4938 `"Thou
dost don the Crown…"`, 0x4950 `"Sceptre"`). La cita de código correcta es **CAST.OVL
0x19ce** (escritura) vía **ULTIMA.EXE 0x4402** (el helper). No cambia nada del veredicto
—el call-site es el mismo y es terreno—, pero queda apuntado para que nadie propague el
offset de string como si fuera el de la escritura.

## 2. El canal nuevo en el port

`volatileTerrain` en `game.ts` — `Record<"loc:floor:x:y", tile>`, campo de INSTANCIA (no
de `GameState`, así que no se serializa), hermano de `volatileTerrainWipe` de #113 y de
`harpsichordPassageOpen`. Mismo búfer, misma volatilidad; la única diferencia es la
granularidad (una celda en vez de los 0x400 bytes de golpe).

**Orden de lectura** (en `activeMap.tileAt` y en `mapTileWithOverrides`, los dos):
`wipe` → `volatileTerrain` → `mapOverrides` → base/hora. El volátil va POR ENCIMA de la
capa persistida a propósito: las dos modelan escrituras al MISMO búfer del original, así
que manda la última. Al revés habría un fallo real y silencioso — si la barrera 0x70 que
el barrido detecta viniera de un `mapOverride` previo, escribir por debajo dejaría la
barrera visible después de haberla disuelto.

**Dónde muere** — `clearVolatileTerrain()`, en los DOS puntos que el port ya marca como
carga de mapa (los mismos que resetean el tracker de puertas):
- `loadSmallMap` (entrada y cambio de planta), junto al `volatileTerrainWipe = null`;
- `exitToOverworld` (volver al exterior).

Se limpia el mapa ENTERO, no sólo las entradas de la location que se abandona, y eso es
derivado, no comodidad: el búfer es **UNO SOLO** — `tile_addr` apunta a `0x6608` tanto en
small map como en overworld —, así que entrar a un pueblo PISA los chunks del exterior y
salir los vuelve a leer.

## 3. Lo que este canal NO modela (declarado, no escondido)

- **Muerte por SCROLL en el overworld.** El censo de #119 dice que el terreno exterior
  vive en una caché de 4 chunks de 16×16 y muere al hacer scroll fuera de ellos. Aquí una
  escritura de overworld sobrevive mientras no haya carga de mapa, aunque el party se
  aleje. Modelarlo pide la geometría de la caché (qué chunk se desaloja y cuándo), que no
  está derivada. **Hueco abierto**, y de alcance corto: el barrido del Cetro sólo afecta a
  tiles 0x70-0x7F, que hoy no aparecen en ningún mapa no-combate alcanzable del port.
- **Entrada/salida de COMBATE.** NO limpia. También derivado: en combate (loc ≥ 0x80) el
  helper apunta a `0xAD14`, un búfer distinto, así que el de terreno no se pisa. Si algún
  día se mide que tras el combate se relee el mapa, ése será el sitio.
- **Los otros 17 call-sites de `setMapOverride`** siguen donde estaban. Esta tanda es UNA.

## 4. Failing-first, y control positivo dentro del propio detector

Los dos detectores nuevos se escribieron ANTES del fix y se vieron **ROJOS**, con los 7
tests previos del fichero en VERDE (la rojez era dirigida, no un fichero roto):

```
✗ la hierba NO entra en mapOverrides   → expected [] to equal ["0:0:101:100"]
✗ la barrera VUELVE tras carga de mapa → la barrera 0x71 está de vuelta: expected 5 to be 113
```

Los dos rojos son exactamente las dos propiedades de la tabla de §1, una cada uno.

**Control positivo, dentro del test de persistencia**: además de exigir que
`mapOverrides` quede vacío, exige que la disolución **SE VEA** por `activeMap.tileAt`
durante la residencia. Sin eso, «no persiste» pasaría igual de verde con un port que no
disolviera nada — el verde que no vale.

**Doble aserción tras la recarga** (patrón de #113): barrera 0x71 de vuelta en su celda Y
hierba donde había hierba en la de al lado. Con un clear a medias cae la primera; con uno
demasiado ancho, la segunda.

La vía es PÚBLICA: `useSceptre()` → pisar la entrada del keep → `enter()` → `loadSmallMap`.

## 5. Re-sello de los 2 tests que asumían persistencia

`sceptre-use.test.ts` tenía dos asertos que leían `s.mapOverrides` directamente. No eran
sellos de fidelidad en prosa —ninguno decía «fiel»—, pero afirmaban el ALMACÉN, y el
almacén era el equivocado. Re-sellados sobre el observable (`activeMap.tileAt`), con el
motivo escrito en el sitio, y **sin re-baselinear citando al port**: el canal correcto lo
sostiene §1, no el expect.

| test | antes | ahora |
|---|---|---|
| «barrera 0x71 adyacente → Grass en silencio» | `s.mapOverrides["0:0:101:100"] === 5` | `g.activeMap.tileAt(101,100) === 5` |
| «disuelve TODO el 3×3 y nada más» | contaba claves de `s.mapOverrides` con valor 5 | cuenta las 9 celdas por `tileAt`, exige la de fuera del alcance intacta (0x7F) **y** `mapOverrides` vacío |

El segundo queda ESTRICTAMENTE más fuerte que antes: comprueba el observable, el límite
del barrido y el canal, tres cosas donde antes había una.

## 6. Gates

Exits leídos **sin pipe** (el `cmd | tail` devuelve el exit de `tail`).

| gate | resultado |
|---|---|
| `vitest run` (suite de unidad ENTERA de `game/`) | **282 ficheros · 3624 passed, 1 skipped** · EXIT 0 |
| `tsc --noEmit` | EXIT 0 |
| failing-first | 2 detectores ROJOS antes del fix, 7 previos verdes |
| `seed_diff.py` sobre este acta | **0 sembradas, 0 cambiadas** (a la primera sembraba DOS: hubo que anteponer un token en mayúsculas al rango del barrido en §1 y sacar el tamaño del bloque de la tabla de §1 — y la nota que lo explicaba volvió a sembrarlas por REPRODUCIR los literales, así que aquí van descritos, no citados) |
| `pytest re/tools/test_frontier.py` | **41 passed** · EXIT 0 |
| e2e | **CERO** — mutex del tour ocupado por printstr-108 |

⚠ **Trampa del gate de notas en worktrees, para el siguiente**: `test_frontier` arrancó con
**6 rojos** que NO eran míos ni de main — al worktree le faltaban los `re/disasm/*.asm`
(gitignored ⇒ no viajan). Control hecho antes de tocar nada: apartar el acta y re-correr
dio los MISMOS 6 rojos, así que no eran del acta. Tres de ellos gritan (`SystemExit` con
la instrucción de symlinkear); los otros tres fallan como **`assert 0 == 1`**, es decir
CEROS SILENCIOSOS de la familia #114 — el gate parecía medir y no medía. Arreglo:
`for f in <checkout-principal>/re/disasm/*.asm; do ln -sfn "$f" re/disasm/; done`.

## 7. Ficheros tocados

- `game/src/core/game.ts` — campo `volatileTerrain` + `setVolatileTerrain()` +
  `clearVolatileTerrain()`, sus 2 puntos de lectura (`activeMap.tileAt`,
  `mapTileWithOverrides`) y sus 2 de limpieza (`loadSmallMap`, `exitToOverworld`), más el
  cableado del ctx del (U)se.
- `game/src/core/endgame/use-tools.ts` — `UseToolsCtx` gana `setVolatileTerrain`; el
  call-site del barrido lo usa, con la cita de la escritura por puntero.
- `game/tests/sceptre-use.test.ts` — bloque `#119` (2 detectores) + los 2 re-sellos de §5.

Ningún valor de mecánica movido: el barrido sigue siendo 3×3, sigue incluyendo la celda
central, sigue disolviendo sólo `(tile & 0xf0) == 0x70` y sigue siendo mudo si disolvió ≥1.

---

# TANDA 2 — las PUERTAS (4 call-sites)

Desbloqueada por la sonda de #121, que **confirmó en vivo** el modelo (ver
`re/notes/terreno-121-acta.md`) e incluso midió esta misma mecánica: en el oráculo,
`(O)pen` sobre una `RegularDoor 0xB8` cambia la celda **del búfer de terreno** a `0x44`
BrickFloor, y tras una recarga la puerta vuelve a `0xB8`. No es una consecuencia deducida
del modelo: se observó.

## T2.1 — Los cuatro, verificados POR EL PUNTERO (no por el nombre)

| mecánica | call-site del port | cadena en el binario |
|---|---|---|
| (S)earch, puerta secreta | `game.ts` `search()` | SJOG 0x0b4d `call 0x8482` → 0x0b52 `mov byte [bx],0xB9`; con `g_floor>=0x80`, 0x0b5e/0x0b63 → `0xB8` |
| (J)immy | `game.ts` `jimmy()` | SJOG 0x0e04 `call 0x8482` → 0x0e07 `mov bx,ax` → 0x0e0e `mov byte [bx],al` |
| (U)se Skull Key | `game.ts` `useSkullKey()` | CAST2 0x0768 — en 0x0782, `call 0x6222` → kernel 0x4402 → 0x07a0 `mov byte [bx],0xB8` / 0x07b2 `…,0xBA` |
| An Ex Por (sella) | `game.ts` `applyDoorSpell()` | CAST 0x0867 `call 0x8482` → 0x0872 `mov bx,ax` → 0x088e `mov byte [bx],0x97` / 0x08a3 `…,0x98` |

Los cuatro piden el puntero al MISMO helper `tile_addr` (ULTIMA.EXE 0x4402) y escriben a
través de él ⇒ búfer de terreno, no tabla de objetos. La del Skull Key ya estaba leída
byte a byte en el comentario del port; las otras tres se leyeron en este carril.

## T2.2 — Failing-first y re-sellos

4 detectores nuevos en `doors.test.ts`, **ROJOS** antes del fix con los **16 previos del
fichero VERDES**. Cada uno: control positivo (la mutación SE VE durante la residencia) +
`mapOverrides` vacío + recarga por la vía pública (`enter()` → `loadSmallMap`) + doble
aserción (la puerta vuelve a su tile original **y** el suelo de al lado sigue siendo suelo).
`(J)immy` se hace determinista con DEX 30, porque el éxito es `dex > rand(0,29)`.

Re-sellos, **7 asertos en 2 ficheros**:

- **3 POSITIVOS** en `doors.test.ts` afirmaban el ALMACÉN (`mapOverrides[...] === X`) y el
  almacén era el equivocado → pasan al observable `activeMap.tileAt` **más** `mapOverrides`
  vacío.
- **3 NEGATIVOS** («…SIN cambiar el mapa») miraban sólo `mapOverrides`: tras mover el canal
  se habrían quedado **CIEGOS al volátil** y seguirían verdes ante una escritura indebida.
  Pasan a comprobar el observable. ★ Este es el re-sello que no salta a la vista: un aserto
  de AUSENCIA sobre la capa equivocada no falla — deja de medir.
- **1 PREMISA OBSOLETA** en `game.test.ts`: el test decía cubrir «una puerta que sólo existe
  en `mapOverrides` (**revelada+jimmy'd**)» — y esa vía ya NO produce ese estado. Se corrige
  la prosa y se AÑADE el caso del canal volátil, que es lo que Search+Jimmy producen hoy.

## T2.3 — Hallazgo colateral, NO tocado (para tarjeta propia)

`revealSecretDoor(tile, inDungeon)` del port elige `0xB9` (mundo) vs `0xB8` (mazmorra), y
los dos valores cuadran con el asm. Pero **el discriminador del binario no es «mazmorra»**:
SJOG 0x0b40 es `cmp byte [g_floor],0x80 ; jae` — o sea **planta ≥ 0x80** (sótano/
Underworld). El call-site del port pasa `false` siempre. Puede que el observable coincida
por dónde hay puertas secretas, pero el criterio no es el mismo. **No lo toco**: es valor
de mecánica, no de canal, y esta tanda es de canal.

## T2.4 — Gates de la tanda 2

| gate | resultado |
|---|---|
| `vitest run` (suite ENTERA de `game/`) | **282 ficheros · 3629 passed, 1 skipped** · EXIT 0 |
| `tsc --noEmit` | EXIT 0 |
| failing-first | 4 detectores ROJOS antes del fix, 16 previos verdes |
| e2e | **CERO** (mutex del tour) |

---

# TANDA 3 — cosecha, antorcha de pared y comida de mesa (3 call-sites)

## T3.1 — Los tres, por el mismo puntero

Las tres ramas del (G)et piden el puntero a `tile_addr` (ULTIMA.EXE 0x4402) y escriben
por él ⇒ búfer de terreno:

| mecánica | cadena en SJOG |
|---|---|
| antorcha de pared | 0x19ee `call 0x8482` → 0x19f3 `mov byte [bx],0x44` |
| cosecha de trigo | 0x1a30 `call 0x8482` → 0x1a35 `mov byte [bx],0x2c` |
| comida de mesa | 0x1a76 y 0x1a9e `call 0x8482` → `mov byte [bx],0x95`; las mitades en 0x1ae8 (`0x9B`) y 0x1afc (`0x9A`) |

Consecuencia de jugabilidad, ahora sostenida por el testigo de #121 y no por deducción:
**la antorcha reaparece y el trigo rebrota al reentrar.**

## T3.2 — ⚠ Esta tanda NO tuvo failing-first (y se dice, no se disimula)

Al mover los tres call-sites la suite siguió **VERDE**: **ningún test cubría dónde caía la
escritura**. O sea, el hueco no era «faltaba un detector», era que la capa de destino no
estaba medida por nadie — exactamente lo que estas tandas existen para arreglar.

Como el rojo-antes-del-fix ya no era posible, se hizo el control que sí queda: **mutación
dirigida**. Revertidos los tres a `setMapOverride`, se pusieron en rojo **exactamente los
3 detectores nuevos** y siguieron verdes **los otros 3629**. Mutación revertida después.

```
FAIL  ★ la antorcha de pared REAPARECE tras recargar el mapa
FAIL  ★ el trigo cosechado REBROTA tras recargar el mapa
FAIL  ★ el plato comido VUELVE A ESTAR SERVIDO tras recargar el mapa
Tests  3 failed | 3629 passed | 1 skipped
```

Cada detector lleva su control positivo (la mutación SE VE durante la residencia: la
sconce desaparece, el trigo da +1 comida, el plato queda a medias), `mapOverrides` vacío
y doble aserción tras la recarga.

## T3.3 — Trampa de medición encontrada de paso

Una corrida intermedia dio 2 rojos en `sidecar-qol-normalizado.test.ts` que **no eran del
cambio**: ese test lee `e2e/grandtour/saves` por ruta **RELATIVA AL CWD**, y yo había
lanzado `npx vitest run --root game` desde la raíz del worktree en vez de desde `game/`.
Con el cwd equivocado no encuentra sidecars y falla por «0 ficheros que auditar». Mismo
binario, misma rama, resultado distinto **por cómo se invoca el medidor**. Corriendo desde
`game/` (como todas las demás corridas de este carril): 282 ficheros verdes.

## T3.4 — Gates de la tanda 3

| gate | resultado |
|---|---|
| `vitest run` (suite ENTERA, desde `game/`) | **282 ficheros · 3632 passed, 1 skipped** · EXIT 0 |
| `tsc --noEmit` | EXIT 0 |
| control de mutación | 3 rojos dirigidos / 3629 verdes |
| e2e | **CERO** (mutex del tour) |

## T3.5 — Estado de la tarjeta al cerrar este carril

HECHAS: tanda 1 (hierba del Cetro), tanda 2 (4 puertas), tanda 3 (3 del (G)et) = **8
call-sites** movidos al canal volátil.
PENDIENTES: **tanda 4** (push/cañón — las dos celdas del Push y el escombro) y **tanda 5**
(caballo/establo). Ojo con las dos: el Push mueve un OBJETO sobre suelo (las dos celdas
pueden ser de canales distintos) y el caballo soltado es OBJETO, que en el original **sí
persiste** — no se mueven en bloque sin mirar el puntero de cada una.

---

# TANDA 4 — Push (dos celdas) y escombro de cañón · TANDA 5 — el caballo: NO SE MUEVE

## T4.1 — Las cinco escrituras, por el puntero

| mecánica | cadena en CMDS |
|---|---|
| escombro del cañón | 0x0d29 `call 0x8482` → 0x0d2e `mov byte [bx],0x44` |
| Push, deslizar (rutina 0x1548) | 0x155b `call 0x8482` → 0x1563 `mov byte [bx],al`; 0x156b → 0x1573 |
| Push, tirar (rutina 0x15b0) | 0x15c3 → 0x15cb `mov byte [bx],al`; 0x15d3 → 0x15db |

★ **Las DOS celdas del Push salen del MISMO canal, y eso había que mirarlo.** El encargo
avisaba de que podían ser distintas, porque el Push «mueve un objeto». Leído el binario:
el objeto empujado (mueble/cañón) es un **TILE del búfer de terreno**, no una entrada de
la tabla `DS:0x5c5a`; las cuatro escrituras piden el puntero al mismo `tile_addr`. Así que
las dos celdas son terreno y las dos se mueven. La advertencia era correcta como criterio
—hay que comprobarlo— y resultó negativa en este caso.

**Failing-first**: 2 detectores nuevos ROJOS con los 15 previos del fichero VERDES.
**Re-sello**: el helper `ovr()` de `cannon.test.ts` (3 usos) leía `state.mapOverrides`;
pasa a `tileAt()` sobre `activeMap`. El tercero era otro **aserto de AUSENCIA**
(`toBeUndefined()`, «intacto») que tras el cambio habría dejado de medir sin ponerse rojo:
ahora exige que el muro **siga siendo `WALL`**.

## T5 — ★ El caballo NO se mueve, y ése es el resultado

`stableHorse` (caballo comprado) y el vehículo dejado en `board()` **se quedan en
`mapOverrides`**, a propósito:

### ★ LEÍDO EN EL BINARIO (y no, no basta con que el port lo diga)

Al cerrar la tanda la justificación era: «el propio port ya lo tenía escrito» —
`use-merchants.md §Horse`, «*el binario coloca un OBJETO del mundo (obj+0/1=0x10) …
⚠ Clase C*». **Eso es citar al port, no derivar**, que es justo el género que este
repositorio persigue. Así que se leyó el binario, y ahora la clasificación se sostiene
sola. `re/disasm/SHOPPES.OVL.asm`, compra del caballo:

```
08c1  mov ax, [bp-0xe]        ; índice de slot libre
08c4  mov cl, 3
08c6  shl ax, cl              ; slot * 8  (la entrada de objeto mide 8 bytes)
08c8  add ax, 0x5c5a          ; ★ base de la TABLA DE OBJETOS
08cb  mov [bp-0x16], ax       ; puntero al slot

0954  mov di, [bp-0x16]
0959  mov [di+5], al  · 095c  mov [di+7], al  · 095f  mov [di+6], al   ; campos a 0
0962  mov al, 0x10
0964  mov [di+1], al  · 0967  mov [di], al    ; ★ obj+0 y obj+1 = 0x10 (el caballo)
096c  mov [di+2], al  ; X          096f-0972  mov [di+3], al  ; Y
0975  mov al, [g_floor] · 0978  mov [di+4], al               ; planta
```

⇒ la escritura **NO pasa por `tile_addr`**: calcula un puntero DENTRO de `DS:0x5c5a` y
rellena los campos del slot. Es el OTRO canal. Cotejo cruzado: el escaneo de hueco de
establo — en SHOPPES 0x07c8, `mov si,0x5c5a` … 0x084e `cmp si,0x5d5a`, paso 8) recorre esa MISMA tabla
— 32 entradas × 8 B —, así que las dos mitades del flujo hablan del mismo sitio.

Y el modelo de #113 dice qué le pasa a un objeto: `0x5c5a` cae **DENTRO** de la ventana
del save (`0x6B4 < 0x1060`) ⇒ **persiste**. Un caballo dejado en el establo sigue ahí al
volver, y eso es lo fiel.

Moverlo «por coherencia con las otras tandas» habría sido exactamente el error que este
carril existe para evitar: **clasificar por el nombre de la mecánica en vez de por el
canal**. La tanda 5 se cierra con un NO, derivado.

Queda apuntado, y NO es de este carril: la Clase C de fondo (el port pinta el caballo como
tile-override en vez de como objeto del mundo) ya tiene tarjeta propia — el (B)oard de
caballos y su `worldTile`.

## T4/T5.2 — Lo que este carril NO ha censado

Fuera de las cinco tandas del encargo quedan `setMapOverride` en: `applyFieldSpell`
(campos mágicos), el spawn del deseo (Wish) y el repintado del santuario en
`shrine-ceremonies`. **No se han clasificado**: no estaban en el encargo y cada una pide
su lectura de puntero. No se tocan.

## T4.3 — Gates

| gate | resultado |
|---|---|
| `vitest run` (suite ENTERA, desde `game/`) | **282 ficheros · 3634 passed, 1 skipped** · EXIT 0 |
| `tsc --noEmit` | EXIT 0 |
| failing-first | 2 detectores ROJOS antes del fix, 15 previos verdes |
| e2e | **CERO** (mutex del tour) |
