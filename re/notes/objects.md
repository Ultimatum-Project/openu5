# Capa de objetos del mundo — g_world_objects (0x5C5A) — catálogo (F1.5)

Fuentes: `.superpowers/sdd/scout-objects.md`, `re/notes/transport.md §6/§7`,
`re/notes/cmds.md §6-9`, `re/disasm/SJOG.OVL.asm` (0x112C open_chest_world,
0x1458 get_special_item), MAINOUT 0x0D22 (compra de nave). Verificación:
`re/verified/cmds.md`, `re/verified/transport.md`.

## Estructura (del binario)

- Base DS:0x5C5A, **32 slots × 8 B** (0x100). **Slot 0 =
  vehículo activo del jugador** (`g_hull`=slot0+5 @0x5C5F, `g_skiffs`=slot0+7
  @0x5C61). `open_chest` barre slots **1..31**.
- **Sentinel de slot libre — dos formatos (aclaración #13):** en la tabla VIVA
  0x5C5A libre ⇔ **tile (+0) == 0** (`find_free_actor_slot` SJOG 0x0000 barre 31→1
  buscando tile==0; los 3 borrados de Get/trampa/cofre escriben tile 0). El **0xFC**
  es el sentinel del formato **on-disk** SAVED.GAM (0x6B4, ⚠O1), no de la tabla viva.
  El clon usa "ausencia del array vivo" ≡ tile 0 y NO cruza el borde 0xFC para el
  botín (interior no persiste; overworld usa la lista viva) → mapeo 0↔0xFC resuelto
  por construcción. Cierre byte-a-byte pendiente = BP DOSBox leyendo 0x5C5A antes/
  después de abrir un cofre (ver port-f13-report §5).
- Layout por slot: `+0` tile/clase · `+1` tile2/frame (⚠O2) · `+2` X · `+3` Y ·
  `+4` floor/location · `+5` hull/contenido (bit `0x80`=trampa en cofres; `0x64`
  pirata) · `+6` sin nombre (⚠O2) · `+7` skiffs/acumulador de deriva.
- **Monstruos, NPCs, transportes, cofres y antorchas viven TODOS en esta tabla.**
  El binario la **rehidrata por-entorno** al cargar mapa. ⚠ CORRECCIÓN 2026-07-13
  (scout-regen Re-análisis 2 + claims-audit): la fuente para INTERIORES es el **.NPC
  estático** (NPC.OVL 0x0000, bloque `0x240×(loc&7)`, `call 0x82de`) → los objetos de
  pueblo se RE-SIEMBRAN frescos en cada entrada; SAVED.GAM 0x6B4 guarda solo el
  ENTORNO ACTUAL (el match de tamaños 0x100/0x200 ↔ 0x6B4/0x9B8 era inferencia de
  raíz única, ⚠O1 sigue abierto para el byte-a-byte). Solo el overworld persiste
  como overlay (SAVED.OOL).

## Modelo del clon (F1.5)

`state.worldObjects: WorldObject[]` en `GameState` (persiste en el save, patrón #49):
`{location, floor, x, y, tile, kind:"chest"|"torch"|"ship"|"prop", hull?, skiffs?,
contents?, trapped?}`. `kind` queda **abierto** para añadir `"actor"` en una fase
futura sin romper el shape. `"prop"` (task #3) = objeto-tile de interior INERTE
(cadáver/alfombra/caja) hidratado del .NPC: sólo render + passability + (L)ook, sin
interacción. Los objetos de INTERIOR (`"chest"`/`"prop"`) se **rehidratan por-entrada**
(`Game.hydrateInteriorObjects`) y se descartan al salir; las naves/antorchas del
overworld persisten (ver O6). El `tileAt` compuesto de `activeMap` overlaya el objeto
**POR ENCIMA de `mapOverrides`** → render + bloqueo de paso gratis. Helpers
`worldObjectAt(x,y)`/`removeWorldObject(obj)` en `game.ts`.

**Alcance F1.5 = SÓLO objetos ESTACIONARIOS** (cofres / antorchas de pared / naves
atracadas). Los actores móviles (`overworldEnemies`, NPCs) NO se migran aquí.

## Cableado (Clase B — mecanismo derivado, datos parciales)

- **Cofre-objeto** — `game.open()` sobre `kind:"chest"` → `openChestObject`
  (SJOG open_chest_world 0x112C): (1) turno; (2) karma-robo en pueblo
  `1≤loc≤0x20` → `karma>2 ? −2 : =0`; (3) trampa si `contents&0x80` → "Trapped!" +
  `chestTrap` (puro, ya testeado); (4) botín `chestLoot` sobre `contents&0x7f` →
  `applyLootGrant`; "Chest empty!" si nada; (5) elimina el objeto. **RNG por el
  stream vivo** (`this.rand`) → paridad de valor Y de stream.
- **Antorcha de pared** — `game.get()` sobre `kind:"torch"` (rama sconce 0x148c de
  get_special_item 0x1458): `torches = min(0x63, torches+1)` + elimina el objeto.
  0 RNG.
- **Nave orgánica** — `buyShip` (Shipwright vivo, `shop.ts` rama 0x84) →
  `game.spawnDockShip(dockX, dockY, flags, 0)` empuja un `kind:"ship"` en el muelle
  del OVERWORLD (loc 0, `SHIP_DOCK_X/Y`) con `hull=99`, `skiffs=flags&0x3f`
  (fragata 0x82 → 2 skiffs), tile `(flags>0x7F)?0x25:0x29`. `board()` vuelca
  hull/skiffs del objeto a slot0 y lo retira (transport.md §7A); `exitVehicle()` en
  tierra re-atraca el objeto con hull/skiffs vivos (§7B). Persistente (O6).

## Carga desde un SAVED.GAM AJENO (#106)

Un `.GAM` del DOS no trae sidecar, así que la única fuente de esta capa son los bytes de
0x6B4. Hasta el 09-08 el clon **leía esa tabla y tiraba lo que no fuera enemigo**:
`readNativeOverworldEnemies` (saveNative.ts) barre los slots mirándolos con
`enemyTileToDefIndex`, y una fragata (+0 = 0x24 → tile 0x124 = 292, base de enemigo 320)
devuelve `null` → `continue`. `worldObjects` no tenía lector nativo ninguno. Síntoma: la
fragata que los quince `original/av-saves/SAVED.GAM.*` llevan en el **slot 1**
(`24 24 14 82 00 63 20 02` = (20,130), casco 99, 2 esquifes) no se pintaba — el arnés
píxel-diff carga justo esos bytes sin sidecar.

Hoy `readNativeWorldObjects` reconstruye las **naves atracadas** (0x20-0x27 fragata,
0x28-0x2B esquife) barriendo **1..31** — no 1..23 como el pool de errantes, porque la compra
usa `find_free_actor_slot` (SJOG 0x0000), que barre 31→1 y aterriza en los slots altos.
Precedencia: sidecar > tabla nativa, y sólo en overworld (en interior manda la re-siembra
del .NPC, O6). **0x2C-0x2F queda fuera a propósito**: es la fragata pirata, que es ACTOR y
pertenece al lector de errantes.

**El CABALLO también viaja desde #131**, y la duda que lo tenía fuera no era el filtro sino
el MODELO: el caballo del port era un `mapOverride` (ver Migraciones, abajo). La decisión
—`WorldObject kind:"horse"`, hermano de la nave— está **derivada del binario**, no adoptada
por simetría con las naves:

- `find_object_at_xy` (ULTIMA.EXE 0x368E) barre **la misma tabla y los mismos slots 1..31**
  y devuelve el byte +0 sin mirar de qué clase es (`board-137-acta.md §1`).
- `board` (CMDS.OVL 0x07F6) despacha caballo y fragata en ramas **hermanas** sobre ese byte
  —0x0832 `and al,0xfe / cmp al,0x10` · 0x08B8 `and al,0xfc / cmp al,0x24`— y las dos caen
  al **mismo epílogo 0x093E**, que vacía el registro.
- El establo **planta el caballo en un slot de esa tabla**: `SHOPPES.OVL 0x0954-0x0978`
  (`horse_seller_buy_and_place`) toma `di = 0x5C5A + idx*8` y escribe `[di] = [di+1] = 0x10`,
  `+2` = X, `+3` = Y, `+4` = `g_floor`.

Rango: **0x10-0x11 y sólo ése** (la máscara `0xfe` del gate). Los dos son alcanzables sobre
el mapa: 0x10 es el que planta el establo y 0x11 el que deja un desmontaje mirando al OESTE
(`(X)-it` hace `transport − 2`, y 0x13 − 2 = 0x11) — por eso el save lleva 0x11. **0x12/0x13
queda fuera a propósito**: es el party MONTADO, que vive en `g_transport_tile` y en el slot 0.

🔴 Y lo que NO se copia de la nave es `hull`/`skiffs`: el colocador los pone a CERO
(0x0957-0x0961 `sub al,al` → `[di+5] = [di+7] = [di+6] = 0`). Los quince saves traen sin
embargo `+6 = 0x20` y `+7 = 0x05` en el slot del caballo, y eso es **residuo del motor, no
propiedad del caballo**: los slots LIBRES de esos mismos saves también los traen no-nulos
(slot 3 `+7 = 0x05`, slot 4 `+6 = 0x30`), porque el escritor genérico de seis campos
(kernel 0x3A74) sólo toca +0..+5 y +6/+7 sobreviven a los borrados. Copiarlos daría un
caballo con «5 esquifes».

Lo que sigue sin viajar son los cofres/antorchas/botín de INTERIOR, que se re-siembran
por-entrada (O6).

### La mitad de ESCRITURA (#136)

Hasta el 09-08 esto era sólo un LECTOR, y la asimetría tenía coste: `writeEnemyTable`
limpiaba los slots 1..23 al exportar, justo donde viven la fragata (slot 1) y el caballo
(slot 2), así que importar un `.GAM` ajeno y volver a exportarlo los borraba de la tabla
nativa. Sobrevivían en el sidecar, de modo que el round-trip del PROPIO port no lo notaba:
el daño era de fidelidad del `.gam`, visible sólo desde fuera.

El contrato del arreglo NO es «escribir también los objetos»: es **componer**. El binario
no tiene writer de esta tabla — vuelca la ventana viva entera con un solo `AH=0x40`
(`re/notes/save-window-writer.md`), o sea PRESERVA, y la limpieza del port es una invención
que sólo existe porque el port reconstruye el pool desde listas tipadas en vez de tener la
tabla (#103). Mientras esa asimetría siga, la regla es que **ningún aportante borra lo
ajeno**: `writeNativeWorldObjects` corre PRIMERO y devuelve las ranuras que ocupa;
`writeNativeOverworldEnemies` las recibe como reservadas y ni las limpia ni las reasigna.

Y la RANURA pasa a viajar en el `WorldObject` (`slot`), porque en el binario es la
identidad: el pool se recicla por hueco, no por orden de lista. Sin ese campo el objeto
volvía a OTRA ranura y el `.gam` dejaba de ser el mismo fichero. Un objeto nacido en el
port (compra, desembarco) no la trae, y entonces el escritor la elige con el barrido
**31→1** de `find_free_actor_slot`, el mismo criterio que hace que una nave comprada
aterrice en los slots altos.

## Migraciones anotadas (SIGUEN fuera de la capa; puntero a esta capa)

- **Caballo del pozo de deseos** (F1.4, tile 0x10 vía `mapOverride`, `spawnWishHorse`) y
  **caballo del establo** (`stableHorse`): siguen escribiendo `mapOverride` — #131 sólo
  añadió el LECTOR nativo (`kind:"horse"` desde 0x6B4), no migró los dos productores. Los
  dos canales conviven sin conflicto porque `board()` lee el `tileAt` COMPUESTO, que pone
  `worldObjects` por encima de `mapOverrides` (#137), y el borrado al abordar cubre los dos.
  Migrar los productores es trabajo aparte (la razón que lo sostiene es #152, no #137 —
  `board-137-acta.md §6`).
- **Tesoro real** (`tryLootTreasury`, `mapOverride`): ✅ **RETIRADO en task #3** —
  el sistema inventado TREASURY_CHESTS (8 coords a mano, respawn diario, "muro roto"
  #F13-1) se sustituyó por los cofres-objeto reales del .NPC (slots 23/24/25, tile 257)
  rehidratados por-entrada en `worldObjects` (`kind:"chest"`), abribles por la rama F1.5.
- **`overworldEnemies`** (fix #49, con hull de naves NPC / piratas `PIRATE_SHIP_HULL`
  0x64): su absorción a `worldObjects.kind="actor"` es trabajo futuro (NO F1.5); su
  persistencia cross-entorno es la fila 0x5C5A de `deliberate-divergences §3`.
- **`searchObjects` de trama**: añadido propio del clon, ajeno a esta tabla (F1.10).

## Preguntas de oráculo (refinadas post-F1.5)

| Id | Estado | Qué falta |
|---|---|---|
| **O1** | ABIERTA | mapeo byte-a-byte SAVED.GAM 0x6B4 (0x100)/0x9B8 (0x200) ↔ 0x5C5A (loader opaco). |
| **O2** | ABIERTA | semántica de slot+6 (sin nombre) y slot+1 (tile2/frame). |
| **O3** | **DERIVADA (jump-table resuelta, task #13)** | La jump-table `cs:[bx-0x2962]` (ids 1..8) se resolvió leyendo los 8 words en SJOG file-off 0x171E con la base de carga del overlay 0xBF80 (`case_real − 0xBF80` = etiqueta SJOG-local). Dispatch por id: `>0xc → 0x172E`; `9..0xc → 0x1670`; `1..8 → jump-table`. Casos del botín de cofre confirmados con sus strings/contadores DATA.OVL: **id2 gold** (0x1620 " gold!" → 0x57aa) · **id3 potion** (0x163C "A ⟨color⟩ potion!" → array 0x5828, nombre 0x419C ⚠) · **id4 scroll** (0x15C6 "A scroll: ⟨name⟩" → array 0x5820, nombre 0x41AC ⚠) · **id5/6/9-12 equipo** (0x1670, nombres 0x17F6 ⚠) · **id7 keys/skull** (0x1568/0x158E " key(s)!"/" odd key" → 0x57ac/0x57b1) · **id8 gems** (0x153C " gem(s)!" → 0x57ad) · **id13 torches** (0x1504 " torch(es)!" → 0x57ae) · **id14 sandalwood box** (0x14F0 → g_wooden_box) · **id15 food** (0x14CA " food!" → 0x57a8) · **id1 cofre anidado** (0x1482 "Open it first!"). Fuera del botín: id0x19 moonstone (0x148C), id0x1b carpet (0x149E), id0xb4-b7 crown/sceptre/amulet, id0xff HMS Cape. **Cableado en el clon (#13):** el (G)et de botín-suelo nombra vía `lootItemName` (commands.ts, gold/keys/gems/torches/food/sandalwood/nested EXACTOS; los nombres-de-array, que aquí eran ⚠C, quedaron derivados después: potion 0x419C = POTION_COLORS, scroll 0x41AC = SCROLL_CODES, equipo 0x17F6 = longEquipNames.json — ver commands.ts) y acredita vía `applyLootGrant`. El grant de EQUIPO por la vía SEARCH (applySearchGrant, misma rama 0x1670) quedó portado por #287. |
| **O4** | CUMPLIDA (observable) | array de flags de antorcha @0x5840: el clon cumple la semántica eliminando el `worldObject`; el flag exacto sin leer. |
| **O5** | ABIERTA | origen del contenido inicial (byte +5) de los cofres de pueblo. Task #3 ya los siembra EN JUEGO al entrar (rehidratación por-entrada) con `INTERIOR_CHEST_CONTENTS=8` (Clase C documentado); falta el byte +5 REAL por BP DOSBox de los slots 23/24/25 de loc 17. |
| **O6** | **MECANISMO IMPLEMENTADO (task #3) — cierre byte-a-byte ABIERTO** | los objetos de INTERIOR (pueblo/castillo/mazmorra) se **REGENERAN al re-entrar** al mapa (el clon ya lo modela: `hydrateInteriorObjects` en la entrada, `discardInteriorObjects` en la salida, load sin rehidratar = matiz 0x6B4; overworld persiste vía SAVED.OOL): no existe SAVED.NPC (el estado de pueblo no se escribe a disco); entrar re-lee el bloque `0x240×(loc&7)` del .NPC estático (NPC.OVL 0x0000, `call 0x82de`); `open_chest_world` 0x112C solo borra el slot EN MEMORIA; SAVED.GAM guarda solo la tabla del ENTORNO ACTUAL (0x6B4) + bitmaps npcDead 0x5B4/npcMet 0x634/search-found 0x2B6; solo el OVERWORLD persiste como overlay (SAVED.OOL). Confirmado por Redux (`SmallMap.InitializeFromLegacy`: "otherwise we assume it's fresh and new") y por conducta conocida (farmeo de cofres del sótano de LB). Matiz: el mapa donde GUARDAS sí restaura del save (0x6B4). ⇒ la persistencia global de `worldObjects` del clon (F1.5) es **INFIEL para interiores**; corregir en task #3 (distinción interior-rehidrata vs overworld-persiste). Fuente: `scout-regen.md` Re-análisis 2; auditoría `re/claims-audit.md` (la anterior "RESUELTA por diseño" era inferencia-por-tamaños de raíz única). BPs de cierre: C-O6a/b/c en claims-audit.md |
| **O-loot** | **CERRADA (carril cobertura-medias)** | mapeo id→índice DERIVADO del asm de apply_item_grant: el ÍNDICE es el VALUE del objeto (rec[5]) — potion id3 (SJOG 0x1656) `inc [value+0x5828]` (color 0..7 SIN máscara, cap 0x63) · scroll id4 (0x15ed/0x160a) `inc [(value&7)+0x5820]` (value 0xFF = planos HMS Cape, pre-colocado) · equipo id5/6/9-12 (0x1670) value = CÓDIGO 0..47 → `inc [code+0x57c0]`, munición 0x1B/0x1D en LOTES de 5 (`call 0x7f70(ptr,5,0x63)`) · sandalwood id14 (0x14F0) `g_wooden_box=0xFF`. NOMBRES también cerrados: scrolls DS 0x41AC (fileoff 0x41BC) = iniciales rúnicas VL/RH/IS/IA/IQW/KXC/IMC/AT (strings 0x8C2E-0x8C4D); equipo DS 0x17F6 = la tabla ya volcada en `longEquipNames.json`; formato equipo = nombre pelado + «!» (0x16a3-0x16b2, sin artículo). Cableado: `applyLootGrant` + `lootItemName` (commands.ts) + tests commands.test.ts. |
| **O-render** | **RESUELTA (task #21; vídeo A + dataflow A)** | sprite del objeto-suelo de botín = **id + 0x100**. `loot_place` (SJOG 0x0F88) escribe slot+0 = slot+1 = `[si+0x4124]` = el **id de categoría** (byte bajo 1..15; ambos pushes salen del MISMO `[bp+0x10]`, verificado); el compositor de objetos del mundo lo dibuja del **banco alto** de sprites (0x100..0x1FF), el mismo `type+0x100` de cofres/props/NPCs. Cotejo 1:1 con los **7 sprites del vídeo forense** (2026-07-13): id5→ItemWeapon 0x105, id10→ItemRing 0x10A, id11→ItemArmour 0x10B, id2→ItemMoney 0x102, id8→ItemGem 0x108, id13→ItemTorch 0x10D, id15→ItemFood 0x10F (+ id1→Chest 0x101, id14→ItemSandalwoodBox 0x10E, id3/4/6/7/9/12→ItemPotion/Scroll/Shield/Key/Helm/Ankh 0x103/4/6/7/9/C). El clon pinta el botín como **entidad render-only** (`Game.lootRenderTiles` → `main.ts` entityProvider): TOPE de la pila por celda (LIFO), transitable, sin tocar passability (los tiles 0x101-0x10F son `walkable:false`, así que meterlos en el `tileAt` compuesto bloquearía). El strange rock (id 0x19) usa el mismo creador pero es reveal de mazmorra (vista 3D), fuera de esta capa 2D. Cita: `SJOG.OVL.asm 0x0F88` (dataflow slot+0/+1), tabla FIJA `DATA.OVL 0x4124` = `01 02 03 04 07 08 0d 0f 19`, `TileData.json` 0x101-0x10F, `.superpowers/sdd/port-f21-report.md`. |
| **drop-coord X-it** | Clase C (valor) | celda del party vs. adyacente — offset del write no desensamblado; el clon deja la nave en la celda del party. |
| **location del muelle** | Clase C (valor) | overworld (loc 0) vs pueblo — inferido del rango 0-255 de `SHIP_DOCK_X/Y`, sin verificar obj+4 byte-a-byte. |

## Tests

- Unit/integración: `game/tests/world-objects.test.ts` (overlay + persistencia),
  `chest-object.test.ts`, `torch-object.test.ts`, `ship-object.test.ts`.
- E2E: `game/e2e/objects.spec.ts` (cofre / antorcha / compra viva + ciclo naval /
  persistencia) y `game/e2e/naval.spec.ts` (abordaje orgánico del objeto-nave).
- Paridad (sin tocar): `cmds_parity.py` (cofres) y `transport`/`master` (naval) —
  F1.5 no altera el orden de `rand`, sólo el destino de los grants.
