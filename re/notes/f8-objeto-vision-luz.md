# F8 — el objeto NO alimenta la visión ni la luz (y el canal donde SÍ lo hacía)

Ficha F8, tren #165. Adjudicada contra el binario y **medida** sobre este árbol el
2026-08-26 (carril `f8-vision-luz`).

## 1. Qué separa el binario y qué funde el port

El binario tiene **dos predicados separados** que el port funde en uno solo.

**Visión.** `viewport_build` lee **sólo el plano de tiles**:

```
ULTIMA.EXE.asm:9795   5bc3: call 0x4402
                      5bc8: mov al, byte ptr [bx]
```

Ese byte (`[bp-0x214]`) es el **único** tile que ve `0x5DFE` (¿corta la LOS?), consumido en
`:9808` y `:9867`. En mapa pequeño `0x4402` resuelve al plano `0x6608`
(`ULTIMA.EXE.asm:7519` — `44a8: add ax, 0x6608`).

**Luz.** El barrido de emisores `0x5E4A` usa **el mismo fetch** (`:10061`) y **nunca**
referencia la tabla de objetos `0x5C5A` ⇒ un objeto de esa tabla **no puede emitir luz
jamás**.

**Los objetos se componen AL PINTAR**, y encima *consultan* el resultado de la visión en
vez de alimentarlo: `0x5394` salta la celda oculta en
`ULTIMA.EXE.asm:9145` — `54d4: cmp byte ptr [bx-0x54fe], 0xff`.

**El paso sí mira objetos**, pero como **segundo predicado aparte** y **antes** del
terreno: `TOWN.OVL.asm:672` — `069c: call 0xffffb4be` → `0x368E find_object_at_xy`.

**El port** superpone el objeto sobre el tile base en `Game.activeMap.tileAt`
(`game/src/core/game.ts:1095`, `if (obj) return … obj.tile`) y `coreview.visField`
muestrea **exactamente eso** (`game/src/skin/coreview.ts`, `terrainAt` → `map.tileAt`)
⇒ por construcción un objeto **puede** tapar la vista y **puede** alumbrar, las dos
imposibles en el binario. Para el **paso** la superposición da la respuesta correcta —
por eso se escribió así.

## 2. ¿Es observable jugando? — el censo, con su denominador

La divergencia es **estructural**; la pregunta es si algún objeto **real** lleva un tile
que el muestreo interprete como opaco o emisor. El censo NO es una lista escrita a mano:
recorre `game/assets/npcs.json` (los datos de personajes del juego) con el
`Game.hydrateInteriorObjects` **real**, las **32 locations × las 24 horas** (la hora mueve
la planta por horario), y cruza los bytes bajos contra `ALWAYS_OPAQUE ∪ EMITTER_TILES`.

| magnitud | cifra |
|---|---|
| slots del .NPC (32 loc × 32 slots) | **1024** |
| slots no vacíos (`slot != 0`, no marcador vacío) | **327** |
| slots que el clasificador `npcSlotObjectKind` saca a `worldObjects` | **8** |
| filas objeto·hora del censo (8 × 24) | **192** |
| tiles distintos | 14, 181, 182, **257**, **283**, **286** |
| bytes bajos distintos | `01 · 0e · 1b · 1e · b5 · b6` |
| locations con objeto | 17 (cofres ×3 sótano, caja 0x0E y alfombra 0x11B planta 2, cadáver 0x11E sótano) · 18 (corona 0xB5) · 29 (cetro 0xB6) |

**Intersección con `ALWAYS_OPAQUE ∪ EMITTER_TILES` = VACÍA.**
⇒ la divergencia de §1 es **real pero NO observable jugando** con los datos de fábrica.
No se toca el muestreo; queda la guarda de §5 para que no se vuelva observable en
silencio.

**Control de alcance (el censo sin filtrar por lo que ya se creía saber).** Barriendo los
**327** slots no vacíos —sin pasar por el clasificador— aparece **un** type cuyo byte bajo
sí cae en `ALWAYS_OPAQUE`: **`type 0xB8`, 2 slots, location 18** (Blackthorn, planta 3,
`aiType 6`). **No es un objeto y no es una puerta**: en el espacio de ACTORES el sprite es
`type + 0x100 = 0x1B8 StoneGargoyle1`; `0xB8 RegularDoor` es el mismo número en el espacio
de TERRENO. Son dos gárgolas, van a `NpcManager` como personas y se pintan como
**entidad**, no vía `activeMap.tileAt` ⇒ no tocan el muestreo. Es la misma colisión de
espacios que ya documenta `board-137-acta.md` (y que en §4 sí muerde).

## 3. La cautela de la ficha, MEDIDA — y refutada

La ficha avisaba: *hacer que `visField` lea el terreno base puede apagar los interiores
cuyos apliques vivan en la capa de objetos* — regresión peor que el defecto. Es la
condición de entrada al arreglo, así que se midió antes de tocar nada:

- **441 celdas emisoras** (`EMITTER_TILES`) en el **plano de terreno** de los 32 mapas
  pequeños, repartidas en **30 de 32 locations**
  (`b0`:100 · `b1`:104 · `b2`:46 · `b3`:3 · `bc`:23 · `bd`:57 · `be`:41 · `bf`:63 · `de`:4).
- **CERO** slots del .NPC con un type emisor.
- **CERO** filas de `TileOverrides.json` (77) con tile emisor.

⇒ **todos** los apliques viven en el plano, igual que en el binario. El riesgo declarado
**no existe** en este árbol. (La guarda de §5 lo fija: si alguien migra un aplique a la
capa de objetos, se pone roja.)

## 4. El canal donde SÍ era observable: el HAZ DEL FARO

El censo de §2 sale vacío contra los dos conjuntos que la ficha nombraba, pero la luz
tiene un **tercer canal** que muestrea el mismo `terrainAt`: el emisor del haz
(`coreview.beamEmitters`, #326). Ahí el predicado enmascaraba a byte bajo
(`(terrainAt(...) & 0xff) !== src`) y **aliasaba los dos espacios de tile del port**
—la capa de objetos/vehículos guarda el banco alto `+0x100` (`board-137-acta.md`)—:

| objeto del port | tile | `& 0xff` | terreno homónimo | efecto (medido) |
|---|---|---|---|---|
| alfombra aparcada por (X)-it, **sobremundo** | `0x11B Carpet2` | `0x1B` | `0x1B Lighthouse` | proyectaba **haz de faro** de noche |
| esquife atracado mirando al sur, **pueblo** | `0x12A SkiffDown` | `0x2A` | `0x2A LighthouseLight` | proyectaba **haz de faro** de noche |

**Cuánto de «juego normal» es la vía del esquife, medido**: hay agua en **9 de los 32 mapas
pequeños** (la location 14 sola tiene 329 celdas). No es un caso de laboratorio que exija
una posición rebuscada — es atracar donde se atraca. (Cifra medida por el carril y anotada
por el lead al aterrizar: el árbol estaba congelado bajo su batería y no pudo escribirla él.)

Las dos vías son de juego normal: la alfombra la deja `exitVehicle` con
`setMapOverride(pos, 0x1B + ACTOR_TILE_BANK)` (`game.ts:4960`); el esquife es un
`worldObject kind "ship"` con el facing preservado.

**En el binario es imposible.** El barrido del emisor del sobremundo es un `memchr` sobre
el **búfer de terreno**, y la tabla de objetos no participa:

```
OUTSUBS.OVL.asm   0267: mov ax, 0x400      ; 1024 = 32×32
                  026b: mov ax, 0x1b       ; el byte buscado
                  026f: mov ax, 0x6608     ; EL BÚFER DE TERRENO
                  0273: call 0x6172        ; memchr
```

El de pueblo, igual: `TOWN.OVL 0x04ca cmp byte ptr [bx], 0x2a` sobre el 32×32.

**Arreglo** (`coreview.ts`, `beamEmitters`): comparar el **tile completo**, sin
`& 0xff`. Es la traducción fiel de «este BYTE **en el plano de terreno**»: medido sobre
este árbol, el plano estático del sobremundo tiene **0 celdas ≥ 0x100** y sus **4 faros**
valen `0x1B` pelado; los 5 `LighthouseLight` de mapa pequeño, `0x2A` pelado. Los dos
controles positivos (faro real de terreno) siguen encendiendo el haz.

## 5. Guarda

`game/tests/f8-objeto-vs-vision-y-luz.test.ts` (13 casos):

- **§1** re-deriva el censo de §2 desde `assets/npcs.json` con el hidratador real, con
  **guarda de cardinal** (192 filas / 8 objetos / 32 locations — si el cargador se rompe,
  el cruce no puede salir vacío «por no haber censado nada»), esperados **en crudo**, y
  **control positivo** (el mismo predicado marca brasero `0xBD`, muro `0x4F` y farolillo
  `0x2A` puestos en el banco alto).
- **§2** fija la geometría de los apliques (441 / 30 locations / 0 en la capa de objetos /
  0 celdas ≥ 0x100 en el plano) — la premisa que hace seguro el arreglo de §4.
- **§3** los dos casos del haz, cada uno con **control negativo** (sin nada, la celda del
  rayo está oculta) y **control positivo** (el faro real de terreno la enciende). Los dos
  estaban **rojos** antes del arreglo y verdes después.
