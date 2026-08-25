# Acta #137 — `board()` leía el TERRENO: no era un matiz de capas, era una COLISIÓN DE ESPACIOS DE TILE

Carril `deriva-3`, primer tramo. Rama `re/deriva-3` sobre `main` @`91779a93`.

**Veredicto: la ficha era CIERTA y se quedaba CORTA.** Decía «`board()` lee el tile del
TERRENO en vez de la capa de objetos» y la trataba como una divergencia de modelado
gateada por #152. Medido: es un **defecto VIVO y alcanzable a pie** — plantarse sobre un
camino de pueblo y pulsar `(B)` embarcaba en una **nave**. 137 celdas transitables del
juego navegable. Arreglado, con failing-first y tres mutantes.

---

## 1. Lo que hace el binario (CMDS.OVL 0x07F6)

```
07fc  cmp [g_location],0x20 / jbe 0x818      ; 0x21..0x28 (mazmorra) → DS 0x4252 "Not here!"
0803  cmp [g_location],0x29 / jae 0x818
0818  push [g_party_x] / push [g_party_y] / push [g_floor]
0826  call 0x770e                            ; ★ find_object_at_xy
0829  mov byte ptr [bp - 0xa], al            ; ★ AL = byte +0 del REGISTRO DE OBJETO
082c  mov ax,[g_cmb_scratch_x] / mov [bp-4],ax ; ...y su ÍNDICE
0832  mov al,[bp-0xa] / and al,0xfe / cmp al,0x10 / jne 0x87c   ; ← se ramifica sobre ESE byte
087c  cmp byte ptr [bp-0xa],0x1b / jne 0x898                     ; alfombra
0898  mov al,[bp-0xa] / and al,0xfc / cmp al,0x28 / jne 0x8b8    ; skiff
08b8  mov al,[bp-0xa] / and al,0xfc / cmp al,0x24 / jne 0x954    ; fragata
0954  mov ax,0x42bf / call 0x58d0 / sub ax,ax / ret              ; default "What?"
```

`0x770e` **no está en CMDS.OVL** (el overlay acaba en 0x1d0e): es un near-call al kernel.
Resuelto con el instrumento del repo, no a ojo — `dispatch_table.overlay_near_call_base`
da base `0xBF80` para CMDS.OVL (grupo `load_seg 0xBF8`, con SJOG/CAST/TALK), luego
`0x770e + 0xBF80 = 0x1_368E → 0x368E`. **Control de no-circularidad**: el destino es un
PRÓLOGO (`368e: push bp / 368f: mov bp,sp`), como manda
[[near-call-overlay-resolve]]. Coincide con lo que ya declaraba `cama-241-acta.md:32`.

### `find_object_at_xy` — ULTIMA.EXE 0x368E, leído entero

```
3696  mov dx,1                       ; índice de objeto, arranca en 1 (el 0 es el vehículo ACTIVO)
3699  di = 0x5c64 ; [bp-4] = 0x5c65 ; [bp-6] = 0x5c66 ; si = 0x5c62
                                     ; ⇒ registro i en 0x5C5A + i*8: +0 tile, +2 x, +3 y, +4 piso
36ad  al=[di]      / cmp ax,[bp+8]  / jne next     ; x
36b6  al=[[bp-4]]  / cmp ax,[bp+6]  / jne next     ; y
36c0  cmp cl,0x7f / ja 0x36d4                      ; g_location > 0x7F ⇒ SALTA el test de piso
36c5  cmp cl,0x80 / jae next
36ca  al=[[bp-6]]  / cmp ax,[bp+4]  / jne next     ; piso
36d4  al = [si]                                    ; ★ DEVUELVE EL BYTE +0 DEL OBJETO
36d8  [g_cmb_scratch_x] = dx                       ; ★ y deja el índice
36de  di+=8 / [bp-4]+=8 / [bp-6]+=8 / si+=8 / inc dx
36ed  cmp si,0x5d5a / jb 0x36ad                    ; 31 registros (0x5C62..0x5D5A)
36f3  [g_cmb_scratch_x]=dx / sub ax,ax             ; ★ SIN ACIERTO ⇒ DEVUELVE 0
36fe  ret 6
```

El terreno **no se consulta en ningún punto** del comando. «No hay objeto» ⇒ `AL = 0` ⇒ el
despacho cae al default `"What?"`, siempre.

## 2. ★★ La raíz: DOS espacios de tile, y el port los mezclaba en la frontera

El byte `+0` de un registro de objeto —igual que `g_transport_tile` (0x587C)— es un índice
del **banco alto** de sprites: el tile real es `byte + 0x100`. Verificado contra la tabla de
tiles del propio port (`game/src/core/data/TileData.json`), que es además su fuente de
pasabilidad:

| byte del binario | tile real | nombre en TileData | **el MISMO número como TERRENO** |
|---|---|---|---|
| `0x10` / `0x11` | 0x110 / 0x111 | `HorseRight` / `HorseLeft` | `Hut` / `Codex` |
| `0x12` / `0x13` | 0x112 / 0x113 | `RidingHorseRight`, `RidingHorseLeft` | `Keep` / `Village` |
| `0x14` / `0x15` | 0x114 / 0x115 | `RidingMagicCarpetRight/Left` | `SmallCastle` / `LargeCastle` |
| `0x1B` | 0x11B | `Carpet2` (alfombra en el suelo) | `Lighthouse` |
| `0x1C` | 0x11C | `BasicAvatar` (a pie) | `Oasis` |
| `0x20`-`0x23` | 0x120-0x123 | `ShipSails*` | `Path1`-`Path4` |
| `0x24`-`0x27` | 0x124-0x127 | `ShipNoSails*` | `Path5`-`Path7`, `Roof1` |
| `0x28`-`0x2B` | 0x128-0x12B | `Skiff*` | `Roof2`, `CrystalBall`, `LighthouseLight`, `DeadTree` |

La correspondencia es **exacta en las 8 familias** (incluido el `+2` de montar: el
`add al,2` de CS 0x0873 lleva el 0x110 de `HorseRight` al 0x112 de `RidingHorseRight`). No es una hipótesis: es la
misma convención que el port ya usaba en `hydrateInteriorObjects` (`p.type + 0x100`) y en el
botín-suelo (`loot.id + 0x100`).

`Game.board()` hacía `const worldTile = this.activeMap.tileAt(pos.x, pos.y)` —espacio de
TERRENO, 0..511— y se lo pasaba a `transport.ts::board`, que compara contra los bytes del
binario. **Cruce de espacios.**

### 2b. Población MEDIDA del falso positivo

Sonda sobre el motor real (los 12 tiles de terreno colisionantes bajo el party, a pie,
`(B)`), y censo sobre los cinco ficheros de mapa del port:

| tile de terreno | qué es | qué hacía `(B)` | transitable | overworld+under | small maps |
|---|---|---|---|---|---|
| `0x10` `Hut` | choza | **"horse"**, `transportTile=0x12` | **sí** | 4 | 0 |
| `0x11` `Codex` | Códice | **"horse"**, `0x13` | **sí** | 1 | 0 |
| `0x1B` `Lighthouse` | faro | **"carpet"**, `0x14` | **sí** | 4 | 0 |
| `0x24` `Path5` | **camino** | **"Ship"** + `WARNING: NO SKIFFS ON BOARD!` | **sí** | 46 | 22 |
| `0x25` `Path6` | **camino** | **"Ship"** + WARNING | **sí** | 22 | 9 |
| `0x26` `Path7` | **camino** | **"Ship"** + WARNING | **sí** | 7 | 22 |
| `0x27` `Roof1` | tejado | "Ship" | no | 0 | 1066 |
| `0x28` `Roof2` | tejado | "skiff" | no | 0 | 1017 |
| `0x29` `CrystalBall` | bola de cristal | "skiff" | no | 0 | 8 |
| `0x2A` `LighthouseLight` | linterna del faro | "skiff" | no | 0 | 5 |
| `0x2B` `DeadTree` | árbol seco | "skiff" | no | 0 | 37 |
| `0x14` `SmallCastle` | castillo | "What?" — **0x14 no es puerta de `board`** | sí | 8 | 0 |
| `0x04` `Grass` | **control negativo** | "What?" | sí | — | — |

**Alcanzable a pie = 84 (overworld) + 53 (small maps) = 137 celdas**, y la domina el **camino
de pueblo** (75 + 53). Los tejados y compañía suman muchísimo más pero **no son
transitables**: el party no puede plantarse encima, así que la cifra que cuenta es la de
`IsWalking_Passable`. Las dos filas del final son controles del propio censo: `SmallCastle`
es transitable y colisiona numéricamente con la alfombra MONTADA (0x14), pero `board()` no
tiene puerta para ese byte —la puerta de la alfombra es 0x1B, la del suelo— así que decía
"What?" ya antes del arreglo y no entra en la población; `Grass` es el negativo.

## 3. El segundo hallazgo del mismo comando: abordar NO borraba el vehículo

```
093e  sub ax,ax / push ax ×6 / push [bp-4] / call 0x7af4   ; = kernel 0x3A74 (base 0xBF80)
094c  or byte ptr [g_unk_24e6],2                           ; marca de repintado
0951  jmp 0x811                                            ; ax=1 (turno consumido)
```

`0x3A74` es `write_object_record(idx, f5..f0)`: `si = idx*8` y escribe seis bytes en
`[si+0x5C5A .. si+0x5C5F]` = tile, +1, x, y, piso, casco. Con seis ceros ⇒ **vacía el
registro**. Y **no es una rama de la fragata**: el caballo (`0878 jmp 0x93e`) y la alfombra
(`0895 jmp 0x93e`) caen al MISMO epílogo. El port sólo hacía `removeWorldObject` para
`kind === "ship"`; el caballo del establo / del pozo se quedaba pintado bajo el party y se
podía volver a abordar → **vehículos duplicables**.

## 4. El arreglo

Todo en `game/src/core/game.ts`, en la frontera entre `transport.ts` (que trabaja —bien— en
espacio de BYTE, porque modela `g_transport_tile`) y las capas de mundo del port.

1. **`board()` lee la capa de objetos**: `cellTile >= 0x100 ? cellTile - 0x100 : 0`.
   El port tiene DOS canales para un vehículo del mundo —`worldObjects` (nave atracada,
   F1.5) y el override de terreno de la Clase C (caballo del establo/del pozo, montura
   dejada por `(X)-it`)— y la regla del banco los cubre a los dos con una sola línea.
   **CONTROL que hace exacto el discriminador**: barridos los cinco mapas estáticos del port
   (`overworld`, `underworld`, `smallmaps`, `combatmaps`, `dungeons`), el tile máximo es
   `0xFF` y hay **cero** celdas ≥ 0x100 ⇒ «≥ 0x100» ⇔ «capa de actores», sin solape.
2. **Los cinco productores escriben en el banco alto**: `spawnDockShip`, `stableHorse`,
   `spawnWishHorse`, y las dos ramas de `exitVehicle` (`dropTile` y `parkedShipTile`).
   Efecto secundario que también era un defecto: la nave comprada se pintaba como `Path6` y
   el caballo del pozo como `Hut`.
3. **Borrado al abordar** (`clearBoardedVehicleCell` + `removeWorldObject` para todos los
   `kind`), gateado por «el override ES el tile que acabo de leer».

★ Constante nueva `ACTOR_TILE_BANK` (exportada) con la tabla y el control documentados, para
que la próxima frontera no repita la mezcla.

## 5. Verificación

**Failing-first**: `game/tests/board-object-layer.test.ts`, **5 rojos antes** del arreglo
por el motivo esperado (`['Ship']` donde debía decir `['What?']`, y `['What?']` donde debía
decir `['horse']`).

**Control del negativo**: el censo de los 12 «What?» iría verde con un `board()` que no
abordase nunca. Va acompañado de un control positivo con **el mismo arnés** que ejerce los
5 bytes de vehículo en su banco real (0x10/0x11 caballo, 0x1B alfombra, 0x28/0x2B skiff) y
comprueba el `transportTile` resultante.

**MUTACIÓN — los tres mutantes con el rojo esperado** (aplicados y revertidos; 0 residuos
`MUTANTE` tras restaurar):

| mutante | rojos |
|---|---|
| M1 — devolver `worldTile = cellTile` (la lectura de terreno vieja) | **5/5** |
| M2 — quitar el borrado y dejar sólo `kind === "ship"` | 1 (el del borrado) |
| M3 — `delete` sin gate (`!== undefined` en vez de `=== tile`) | 1 (el del gate) |

★ El control del gate de M3 **hubo que rehacerlo**: la primera versión ponía el override
ajeno en la casilla VECINA, y un borrado ciego de la casilla del party tampoco la habría
tocado — control degenerado, verde con las dos reglas. La única geometría que discrimina es
leer el vehículo de una capa MÁS ALTA que `mapOverrides`: `activeMap.tileAt` resuelve
`volatileTerrain ?? mapOverrides ?? base` (#119), así que el caso bueno es caballo en el
búfer volátil sobre un override persistido de un `(G)et`. Familia
[[control-positivo-caso-degenerado]].

**Suite**: `tsc --noEmit` limpio; suite completa desde `game/` **318 ficheros / 4037 tests
verdes** (base `main`: 317 / 4032). Trece asertos de cinco ficheros existentes
(`board-nay`, `naval-live`, `ship-object`, `use-tools`, `wishing-well`) codificaban los
valores del banco BAJO y se han corregido nombrando el porqué; ninguno perdió cobertura —
`board-nay` estaba *apoyado* en la colisión (su fixture ponía `0x10` de terreno para que el
`(B)` picara).

## 6. Prosa rancia corregida (y una cadena que se acorta)

- `game.ts::spawnWishHorse` declaraba «retirar la guarda está gated tras #152/F1.5, **que a
  su vez espera a #137**». **La cadena era falsa en su segundo eslabón** y se corrige: lo que
  sostiene la guarda es la capa en que se ESCRIBE (`setMapOverride` tapa el muro), no la capa
  en que se LEE. Cerrar #137 **no** desbloquea #227; sigue gateada por #152 a secas.
- `game.ts::stableHorse`: «el port fija un map-override 0x10 … board() lee el tile del mapa».
- `board-nay.test.ts`, §«lo que estos tests NO afirman»: el motivo (A) ya no es «`board()`
  lee terreno» sino «los caballos-NPC del port se dibujan como ENTIDADES y no están en
  ninguna de las dos capas de mundo que `board()` consulta».

Las actas `cama-241-acta.md:241` y `ausencia-151-acta.md:170` citan la cadena vieja. **No se
tocan**: son registros fechados de un estado pasado, y esta acta es su corrección.

## 7. Residuos DECLARADOS (no cableados aquí)

1. **★ El sprite del party montado también cruza los dos espacios, y sigue cruzado.**
   `skin/coreview.ts::avatarTile()` hace `if (!onFoot) return tt;` — devuelve
   `state.transportTile` CRUDO (un byte: 0x12 a caballo, 0x24 en fragata) como índice de
   sprite del espacio 0..511, mientras la rama a pie sí usa el banco alto
   (`AVATAR_TILE = 284 = 0x11C`). ⇒ a caballo el party se pinta con el tile `0x12` = **`Keep`**
   y navegando con `0x24` = **`Path5`**. MISMA raíz que #137, pero vive en
   `skin/coreview.ts`, fichero muy disputado (cuatro carriles con worktree abierto sobre él) y
   sin poder verificarlo por navegador en esta ventana (playwright bajo mutex). **Tarjeta
   propia**, con el diagnóstico ya hecho: el arreglo es `return tt + ACTOR_TILE_BANK`, y el
   sello barato es que `poseSpriteForTile` ya demuestra la convención (mapea 0x90-0x93 de
   terreno a 0x130-0x133 de sprite).
2. **Saves antiguos**: los `mapOverrides` de un save previo guardan el byte bajo (0x10) y tras
   este cambio ya no son abordables. No hay migración; el port no versiona el save de
   desarrollo.
3. **El `volatileTerrain` no tiene productor de vehículos** hoy (los cinco productores usan
   `setMapOverride`), así que el gate de §4.3 protege un canal que sólo se ejerce desde el
   test. Declarado como guarda, no como conducta observada.
4. **`worldObjectAt` devuelve el PRIMER objeto del array**; el binario devuelve el de índice
   más bajo (el barrido de `CS 0x36de` va de 1 a 31). Coincide mientras el array respete el orden de colocación;
   no se toca aquí porque es la convención ya vigente para cofres.
