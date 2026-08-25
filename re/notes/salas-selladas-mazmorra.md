# Salas de mazmorra SIN SALIDA — geometría de DUNGEON.DAT y retorno de `dng_enter_room`

Derivado el 2026-08-16 por el carril `doomroom-347` a partir del reporte de un jugador
(ficha #347): en Doom, bajando del nivel 2 al 3 por la escalera U/D, la party entra en una
sala con ratas y wisps y al acabar el combate **queda encerrada, sin poder avanzar en
ninguna dirección**. Este acta mide qué hace el BINARIO en ese punto. Cierra además la
ficha #181 (mapeo sala → `combatmaps`), cuya premisa era falsa.

---

## 1. El índice de mapa de sala — #181 REFUTADA

`combatmaps.json` tiene 128 entradas y su campo `index` va 0..15 (britannia) y 0..111
(dungeon), o sea es **por territorio**. #181 lo leyó como índice global y de ahí concluyó
«16 repetidos y el bloque de Doom no existe». No hay duplicado: lo que se repite son los
16 valores del bloque britannia dentro del bloque dungeon.

El índice que usa el port es la **POSICIÓN DE ARRAY** (`res.combatMaps[combatMapIndex]`,
`game/src/core/game.ts`), y el array es britannia (16) seguido de dungeon (112) — lo emite
así `extractor/src/parsers/combatmap.ts`. Por tanto:

```
posición = 16 + dungIdx*16 + roomNumber        (roomCombatMapIndex, dungeon.ts)
```

cubre 16..127 exactamente, y Doom (`dungIdx` 6) ocupa **112..127** = salas 96..111 de
DUNGEON.CBT. **El bloque de Doom existe y el `16 +` es correcto.**

Cardinales careados contra los ficheros del juego:

| fichero | bytes | = mapas × 352 |
|---|---|---|
| `BRIT.CBT` | 5 632 | 16 |
| `DUNGEON.CBT` | 39 424 | 112 |

112 = 7 mazmorras × 16. La que no tiene salas es **Despise** (0 celdas de tipo `0xF` en
DUNGEON.DAT; el resto: Deceit 16 · Destard 16 · Wrong 36 · Covetous 82 · Shame 16 ·
Hythloth 16 · Doom 16 — los repartos >16 son la misma sala referenciada desde varias
celdas).

Dos corroboraciones independientes de que el mapeo es por posición:

- La posición 127 (Doom sala 15) es el mapa del **desenlace**, y Doom sala 15 vive en la
  planta 7, que es donde está Lord British. #181 dejaba ese mapa «sin dueño adjudicado»:
  es de Doom, no de Hythloth.
- `game/tests/sala-sin-enemigos.test.ts` ya rotula `cm49`/`cm50` como Wrong salas 1 y 2 y
  `cm68`/`cm69` como Covetous 4 y 5, que es exactamente `16 + dungIdx*16 + room` con
  Wrong=2 y Covetous=3.

⇒ **La extracción no se toca**, y con ella no hay puerta de versión de assets que abrir.

### 1.1 El `dungIdx` deja de estar «SIN derivar» para las salas que existen

El binario reduce la mazmorra con `dungIdx = g_location − 0x21; if (dungIdx ≥ 1) dungIdx--`
(DUNGEON.OVL 0x003a-0x0048), que **colapsa Deceit≡Despise**. El port usa
`dungeonOrderSkippingDespise`, que colapsa Despise≡Destard. Las dos variantes coinciden en
las 7 mazmorras que tienen salas y divergen sólo en Despise, que no tiene ninguna. Para
Doom las dos dan 6.

---

## 2. Al terminar la sala, el binario DEVUELVE A LA PARTY A LA CELDA DE ENTRADA

`dng_enter_room` (DUNGEON.OVL 0x0000) guarda las coordenadas al entrar y las **restaura al
salir**, por las dos ramas del retorno:

```
0084: mov al,[g_party_x] ; 0089: mov [bp-4],ax     ; x guardada
008c: mov al,[g_party_y] ; 008f: mov [bp-6],ax     ; y guardada
...
00c4: call <combate>     ; 00c7: or ax,ax ; 00c9: jne 0xfa   ← rama sin marcar
00de: call <mark_cleared(room)>
00f5: and byte ptr [bx+si+0x595a], 0xaf              ; degrada 0xFn → 0xAn
00fa: mov al,[bp-6] ; 00fd: mov [g_party_y],al       ; ★ y RESTAURADA
0100: mov al,[bp-4] ; 0103: mov [g_party_x],al       ; ★ x RESTAURADA
```

Nada entre 0x0092 y 0x00fa escribe `[bp-4]`/`[bp-6]` (los dos bloques de `movsw` escriben
`[bp-0x10]..[bp-0x09]` y `[bp-0x18]..[bp-0x11]`).

⇒ **El borde por el que sales del tablero de combate NO mueve a la party en la mazmorra.**
El «All must use the same exit!» (`g_unk_58a1 = 0x82`, 0x00bf) rige DENTRO del tablero.
El port hace lo mismo (`endCombat` sólo reposiciona en combate de PASILLO), así que aquí
es fiel; la afirmación «cada borde lleva a una sala/pasillo distinto» que llevaba el
docblock del port está **retirada por este cuerpo**.

---

## 3. Las 14 salas SIN SALIDA — censo sobre DUNGEON.DAT

Predicado: celda de tipo `0xF` cuyos cuatro vecinos (con envolvimiento `&7`, DUNGEON:0x057a)
son muro `0xB` o muro especial `0xC`, sin ninguna puerta secreta `0xD` que revelar con
Search. Medido sobre los bytes crudos de `DUNGEON.DAT` (8 mazmorras × 8 plantas × 64 B).

De **198** celdas de sala del juego, **14 están selladas**:

| mazmorra | planta | (x,y) | sala | tile encima | tile debajo |
|---|---|---|---|---|---|
| Deceit | 1 | (5,3) | 0 | 0x20 | 0xB0 |
| Deceit | 2 | (1,1) | 2 | 0x20 | 0x30 |
| Destard | 0 | (3,1) | 0 | — | 0x18 |
| Destard | 0 | (7,7) | 1 | — | 0x18 |
| Covetous | 5 | (0,0) | 14 | 0xB0 | 0x10 |
| Shame | 5 | (1,0) | 5 | 0x00 | 0x10 |
| Shame | 5 | (5,2) | 4 | 0x00 | 0x10 |
| Shame | 6 | (7,6) | 15 | 0x30 | 0xFE |
| Hythloth | 4 | (5,0) | 6 | 0x00 | 0x10 |
| Hythloth | 7 | (1,1) | 12 | 0x30 | — |
| **Doom** | 1 | (1,1) | 2 | 0xF0 | 0x18 |
| **Doom** | 2 | (5,5) | 6 | **0x30** | 0x61 |
| Doom | 6 | (1,3) | 10 | 0x00 | 0x10 |
| Doom | 7 | (5,7) | 15 | 0x61 | — |

Otras 5 salen sólo por **puerta secreta**, y ésas sí se resuelven con (S)earch: Deceit 6
(7,5) y Wrong 5 (0,1)/(2,1)/(4,1)/(6,1).

El patrón que se repite en la columna de tiles: la celda de sala ocupa el sitio donde
estaría el rellano de una escalera, y la escalera pareja SÍ existe en la planta contigua
(0x10 = escalera arriba, 0x20 = abajo, 0x30 = ambas). El nibble alto de la sala (`0xF`,
`0xA` tras despejarla) **no lleva la escalera**, así que el rellano deja de ser rellano.

### 3.1 La celda del reporte

La del jugador es **Doom, planta 2 (su «nivel 3»), (5,5), sala 6**. Se llega por la
escalera U/D de la planta 1 en (5,5) (tile `0x30`). Discriminada por la POBLACIÓN, que casa
con lo que describió: `combatmaps` posición 118 = sala 102 de DUNGEON.CBT lleva 5 unidades
de sprite 144 (índice 20 = **GIANT RATS**) y 3 de sprite 212 (índice 37 = **WISPS**). Las
otras dos salas de esa planta (3 y 4) llevan DAEMONS + WISPS.

Bytes crudos de la fila 5 de Doom planta 2 en `DUNGEON.DAT`:
`00 F4 B0 00 B0 F6 B0 00` — la sala en x=5 y muro `0xB0` a izquierda y derecha; y la
columna 5 da `B0` en y=4 y en y=6.

La «sala sin paredes» que describe el jugador **es fiel**: el tablero de la sala 102 es un
claro de hierba (tile 5) con anillo de árboles (tiles 76/77) sobre relleno `255`, y sus
121 tiles son **byte-idénticos** a `DUNGEON.CBT` en el offset `102 × 352`. No es un mapa
equivocado: en 1988 esa sala de Doom es un bosquecillo.

### 3.2 De las 14, el GARFIO de 1988 saca a cuatro — y no por diseño

El gate de Klimb-arriba (0x1e52) lee el bit `0x08` del tile **crudo** y no mira el nibble
alto: `mov al,[bx+si+0x595a] ; and ax,8`. En una celda de sala el nibble bajo es el
**NÚMERO DE SALA**, así que ese bit `0x08` es el bit 3 del número. Consecuencia no
buscada: toda sala con número ≥ 8 se lee «iluminada» y con el Grapple el original permite
subir por el techo. Cinco de las catorce lo cumplen — y sólo cuatro escapan de verdad:

| celda | sala | con garfio |
|---|---|---|
| Covetous 5 (0,0) | 14 | planta 5 → 4 |
| Shame 6 (7,6) | 15 | planta 6 → 5 |
| Hythloth 7 (1,1) | 12 | planta 7 → 6 |
| Doom 6 (1,3) | 10 | planta 6 → 5 |
| **Doom 7 (5,7)** | **15** | **planta 7 → 7** (sube y cae) |

La quinta es la del desenlace: el tile de encima es `0x61` = foso de CAÍDA, y `on_enter`
(0x0C76, llamado desde el bucle de turno en 0x0f84) la dispara nada más aterrizar, así que
el viaje es de ida y vuelta. El landing no lo impide porque `dng_landing_ok` con `mode=0`
no mira el tile (§4).

⇒ **el cepo duro de 1988 son DIEZ celdas, no catorce**, y las otras cuatro dependen de
llevar un objeto opcional. La del reporte del usuario (sala 6, bit 3 = 0) está entre las
diez. Ejercido en `salas-selladas-mazmorra.test.ts` (no inferido del bit: la tabla de
arriba sale de correr el Klimb en las cinco).

---

## 4. Por qué el encierro NO tiene salida tampoco en 1988

Estando sobre la celda ya despejada (`0xF6 & 0xAF = 0xA6`):

- **Movimiento** — `hi ∈ {0xB,0xC,0xD}` da "Blocked!" (DUNGEON:0x05FF). Los cuatro vecinos
  son `0xB0`.
- **Klimb arriba** — exige `hi ∈ {0x10,0x30}`, o el bit `0x08` del tile **con** garfio
  (0x1e5e-0x1e72). `0xA6`: `hi` = `0xA0` y `6 & 8 = 0` ⇒ no.
- **Klimb abajo** — exige `hi ∈ {0x20,0x30,0x60}` (0x1e79-0x1e89) ⇒ no.
- **Uus Por / Des Por** — los dos abren con
  `cmp byte ptr [g_location], 0x28 ; jmp <fallo>` (CAST.OVL 0x0fd2 y 0x0ffc).
  `0x28` = 40 = **Doom**: los hechizos de planta están vetados en esa mazmorra por el
  propio binario, así que en la celda del reporte tampoco sirven.

Y el aterrizaje que te metió ahí no puede rechazarte: `dng_landing_ok` (0x1c0c) con
`mode == 0` retorna 1 sin mirar el tile (`1c3c: cmp word ptr [bp+4],0 ; je 0x1c5f`), y el
Klimb pasa `mode = 0` (`1f26: sub ax,ax ; push ax`).

⇒ Es un **cierre duro del juego de 1988**, no una divergencia del port. Las celdas de Doom
son las peores: en las otras seis mazmorras Uus/Des Por sí están disponibles y levantan el
encierro siempre que la planta destino tenga pasadizo vacío (`hi == 0`) bajo la party —
condición que `dng_landing_ok` exige con `mode ≠ 0` (0x1c42, corrección del barrido #39:
el `or ax,ax ; jne` precede a los cuatro `cmp`, así que bloquea ante CUALQUIER nibble alto
≠ 0). De las cuatro de Doom, la de planta 6 tiene la puerta del garfio (§3.2); las otras
tres —incluida la del reporte— no tienen ninguna.

---

## 5. El remedio (A), y qué queda abierto

El remedio **no es calcado y se declara como tal**: es la opción (A) autorizada por el
lead — una condición nueva en el gate de Klimb (`parejaDeEscaleraBajoSala`, con su
docblock de divergencia deliberada). Sobre sala YA despejada (`0xA`), si la celda de la
planta contigua es la escalera cuya pareja ocupaba este rellano, se klimba por ahí. La
relación ya vive en los datos de 1988; lo que se restituye es la salida por donde entraste.

Dos propiedades MEDIDAS que acotan la intervención:

1. **Intervención mínima.** La condición sólo se consulta cuando el binario no ofrece
   NINGUNA salida. Sin esa guarda, en Covetous 5 (0,0) y Doom 6 (1,3) —las dos que el
   garfio ya abre hacia arriba y que además tienen escalera-arriba debajo— la pareja
   añadía un ABAJO inexistente en 1988, y con las dos direcciones vivas el mando pasaba a
   pedir el prompt "Klimb-U/D-" donde el original no preguntaba. Con la guarda, (A) sólo
   puede convertir un callejón en salida; nunca alterar un desenlace que el binario daba.
2. **Coste de RNG del gate: CERO** (medido con contador sobre el RNG vivo, las 14 celdas:
   `gate=0`). Lo que sí cambia es aguas abajo: donde antes el Klimb se rechazaba (0 tiradas)
   ahora hay cambio de planta, y ese camino —**pre-existente**, `respawnWanderer` +
   `on_enter` del destino— consume de 4 a 16 tiradas según la celda. No se añade ningún
   punto de consumo nuevo; se alcanza uno que ya existía. Y sólo se alcanza desde un estado
   en el que 1988 dejaba la partida sin continuación legal, así que ningún prefijo
   previamente correcto se desalinea.

Cobertura: **13 de 14**. La que queda es Doom 7 (5,7), la sala del DESENLACE, y debe
quedarse sellada; tampoco se pierde nada, porque §3.2 muestra que el garfio de 1988 la
klimba y el foso de encima la devuelve.

**Qué queda abierto**: la ALCANZABILIDAD real de las 14 en una partida (haría falta
recorrer la conectividad planta a planta contando escaleras y fosos). Lo medido aquí es la
GEOMETRÍA y las REGLAS, no la frecuencia. Y las 5 salas que salen sólo por puerta secreta
(§3) quedan intactas: el port ya las revela con (S)earch.
