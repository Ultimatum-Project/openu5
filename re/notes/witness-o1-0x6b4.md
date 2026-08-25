# Witness O1 — tabla de objetos 0x6B4 (DS:0x5C5A) al guardar (task #57)

Cierra los 3 huecos de #57 sobre la persistencia nativa de la tabla de objetos
(`g_char_anim_states`/`g_world_objects` = DS:0x5C5A ≡ file-offset 0x6B4, 32 slots × 8 B).

**Método.** Mezcla de (1) lectura VIVA de la tabla desde el `SAVED.GAM` de referencia
(`original/u5/ultima5/`, un save en **town** loc 0x11) con el oráculo headless, comparada
byte a byte contra el mismo fichero en disco; y (2) derivación del ASM
(`re/disasm/ULTIMA.EXE.asm`, `MAINOUT.OVL.asm`, `COMBAT.OVL.asm`, `TOWN.OVL.asm`) para los
escenarios (overworld / barco) que el save de referencia no contiene. Los escenarios (a
interior / b barco) NO se capturaron en vivo (el save de arranque es un town; navegar a un
barco en el oráculo lento es caro y frágil) → se DERIVAN del ASM + `re/notes/transport.md`,
que ya ancló obj0+5/+7 al hull/skiffs. Se declara la limitación.

---

## 1. Layout observado EN VIVO (town save, loc 0x11) — evidencia cruda

`roster_off` = DS 0x55A6 (file byte 0); tabla = `roster_off + 0x6B4`; `game_ds` observado
en el boot. Dump completo en el scratchpad (`objtable_town.json`). Comparación
**disco (D)** vs **RAM viva unas vueltas tras cargar (L)**:

| slot | +0 | +1 (D→L) | +2 X | +3 Y | +4 | +5 | +6 (D→L) | +7 | qué es |
|---|---|---|---|---|---|---|---|---|---|
| 00 | 1C | 1C→1C | 0F | 1A | FF | 00 | 00→00 | 00 | **avatar a pie** (obj0) |
| 01 | 48 | 4B→4A | 0D | 0B | FF | 00 | 30→20 | 00 | NPC town |
| 05 | 50 | 51→50 | 09 | 17 | FF | 00 | 10→34 | 00 | NPC town |
| 06 | 1E | 1E→1E | 09 | 09 | FF | 00 | 00→00 | 00 | NPC town |
| 07 | 54 | 55→56 | 10 | 13 | FF | 00 | 10→20 | 00 | NPC town |
| 08,09 | 00 | 00 | 00 | 00 | 00 | 00 | **60** | 00 | slot libre con +6 rancio |
| 10,16,17 | 00 | 00 | 00 | 00 | 00 | 00 | **20/30/30** | 00 | ídem |
| 11,12 | 00 | 00 | 00 | 00 | 00 | 00 | **10/30** | 00 | ídem |

Lecturas load-bearing:
- **+0 (tile base) es ESTABLE** disco↔vivo por actor (0x48, 0x50, 0x54, 0x1E, avatar 0x1C).
- **+1 es la TILE ANIMADA VIVA, no un espejo estático**: 0x4B→0x4A, 0x51→0x50, 0x55→0x56.
  Es el frame actual (ciclo de andar). place_actor la inicializa = +0 (por eso en un slot
  recién colocado +0==+1), pero el mover la avanza cada turno. **Corrige la etiqueta
  "espejo" de native-persist-enemies.md**: +1 es el frame vivo, coincide con +0 sólo al
  colocar.
- **+4 = 0xFF** para todos (marca de town/interior; el overworld usa 0x00, ver §3).
- **+5 = 0x00** para NPCs (hull sólo lo pisa el vehículo/pirata).
- **+6 NO es scratch intacto: es un campo VIVO y SE PERSISTE.** El disco trae +6 no-nulo
  (0x30/0x10 en NPCs, 0x60/0x20/0x10/0x30 rancios en slots libres) y cambia turno a turno
  (slot05 0x10→0x34). Los slots libres con +6 rancio = NPCs de horario que ahora no se
  muestran (tile→0) pero conservan su estado de movimiento.
- **+7 = 0x00** para NPCs (es skiffs, sólo relevante en fragata; ver §4).

---

## 2. place_actor y el escritor de la tabla (ASM)

`place_actor` = **ULTIMA.EXE.asm 0x3A74** (confirmado byte a byte):
```
3a74 push bp; mov bp,sp; push si
3a78 mov si,[bp+4]; shl si,3            ; si = slot*8
3a82 mov [si+0x5c5a], [bp+0x10]         ; +0 tile
3a89 mov [si+0x5c5b], [bp+0xe]          ; +1 tile (mismo arg al colocar)
3a90 mov [si+0x5c5c], [bp+0xc]          ; +2 X
3a97 mov [si+0x5c5d], [bp+0xa]          ; +3 Y
3a9e mov [si+0x5c5e], [bp+8]            ; +4 floor
3aa5 mov [si+0x5c5f], [bp+6]            ; +5 (0 / hull)
3aab ret 0xe                            ; 7 args; +6 y +7 NO se tocan
```
place_actor deja +6/+7 como estén. Pero **el juego SÍ escribe +6 y +7 en otras rutas**
(no son scratch permanente):
- **+6 (0x5C60):** kernel 0x6869 `=0`, 0x6927 `=0xFF`; COMBAT.OVL 0x0304/0x0327 `=0x20`,
  0x047A `=0`; TOWN.OVL 0x17FF `=0`. → estado por-actor dependiente de contexto
  (movimiento/animación fuera de combate, otro rol en combate). No hallé lector directo
  simple; el valor lo consumen los movers/anim, y **el save writer lo persiste verbatim**
  (evidencia: el disco lo trae no-nulo, §1).
- **+7 (0x5C61):** kernel 0x677A/0x6A87 `=0xFF`; en fragata = skiffs a bordo (§4).

El **save writer** vuelca el bloque DS del save (que incluye 0x5C5A) al fichero tal cual:
prueba directa = el `SAVED.GAM` de disco reproduce la tabla viva (NPCs en 1/5/6/7, +6
no-nulo, libres con +6 rancio), con +1/+6 ligeramente distintos de mi lectura viva sólo
porque ésta ocurrió unas vueltas después de cargar (anim/mover avanzaron). Es decir: **el
fichero = snapshot crudo de DS:0x5C5A en el instante del guardado** (copia directa, sin
reseed ni normalización).

---

## 3. HUECO 1 — ¿interior RESEED o PERSIST de los enemigos overworld al guardar?

**Veredicto: un save de INTERIOR no persiste NI reseed-ea enemigos overworld — la pool ya
fue DESTRUIDA al entrar al interior; el reseed ocurre al RE-ENTRAR al overworld.**

Cadena de evidencia:
1. **Entrar a un interior hace `memset` de toda la tabla** — `MAINOUT.OVL.asm 0x0857–0x0863`:
   ```
   0857 call 0xfffff852          ; -> byte de relleno
   085a push ax
   085b mov ax,0x5c5a; push ax   ; dst = tabla de objetos
   085f mov ax,0x100;  push ax   ; len = 0x100 = 32 slots * 8
   0863 call 0xffffa408          ; memset(tabla, 0x100, relleno)
   ...  0x088c mov [g_location],al ; fija la localización de destino
   ```
   Se limpia la tabla de 0x100 bytes justo antes de fijar `g_location` y cargar los NPCs de
   la localización. Los enemigos errantes del overworld quedan borrados.
2. **Confirmado en vivo:** el town save tiene NPCs (tiles 0x48/0x50/0x54/0x1E) en los slots
   1/5/6/7, NO monstruos. La pool 1..23 quedó repurposeada a NPCs.
3. **En el overworld la tabla se PRESERVA y se rellena (top-up), no se limpia:** la rutina de
   entrada al overworld (`MAINOUT.OVL.asm 0x0000+`) fija `g_chunk_origin_x/y` desde la pos de
   la party y NO hace `memset` de 0x5C5A; el spawner (`spawn_monster`, MAINOUT ~0x0FC4, escribe
   +5=0x64 al pirata en 0x1050) añade monstruos cerca de la party turno a turno. Como la tabla
   es parte del bloque de 4192 B de SAVED.GAM, **un save HECHO EN EL OVERWORLD persiste las
   posiciones de los monstruos** (viajan en el .gam) y sobreviven al load; el spawner sólo las
   completa.

Consecuencia para el port (VALIDACIÓN del diseño actual): el gate
`writeNativeOverworldEnemies(... ) if location===0` de `saveNative.ts:441` es **FIEL**:
- overworld (loc 0) → escribir slots 1..23 = PERSIST, igual que el binario.
- interior (loc≠0) → no tocar 1..23 (son NPCs) = igual que el binario.

**Divergencia a vigilar (para el lead, NO la cablees):** el SIDECAR lleva `overworldEnemies`
SIEMPRE (independiente de location). Si el runtime del port conserva `state.overworldEnemies`
mientras estás en un town y los RESTAURA al volver al overworld, divergiría del binario, que
en ese viaje los DESTRUYE (memset de entrada al interior) y RESEED-ea frescos al re-pisar el
overworld. Verificar que el port limpia/reseed-ea `overworldEnemies` al entrar/salir de un
interior. (El .gam en sí es fiel por el gate; el riesgo es sólo el estado del sidecar.)

---

## 4. HUECO 2 — ¿qué escribe el slot 0 cuando el avatar va EN BARCO?

**Veredicto (derivado de ASM + transport.md; NO capturado en vivo):**
obj0 en barco = `[ tile tile X Y floor HULL +6 SKIFFS ]`, es decir:

| byte | a pie (observado) | en fragata (derivado) | fuente |
|---|---|---|---|
| +0/+1 | 1C / 1C | **tile de la fragata** (grupo `&0xFC` + facing en 2 bits bajos) | g_transport_tile |
| +2/+3 | X / Y | X / Y | pos de la party |
| +4 | FF (town) | **floor** (0x00 overworld) | g_floor |
| +5 | 00 | **HULL** (0..99) | g_hull = 0x5C5F = obj0+5 (transport.md:32) |
| +6 | 00 | estado de mov. (scratch vivo) | §2 |
| +7 | 00 | **SKIFFS a bordo** | g_skiffs = 0x5C61 = obj0+7 (transport.md:33,241) |

- **obj0+0 == g_transport_tile.** Verificado en el town save: obj0+0 = 0x1C = g_transport_tile
  (file 0x2D6 ≡ DS 0x587C). El tile de vehículo se codifica `(&0xFC)=tipo + (2 bits)=facing`:
  a pie 0x1C/0x1D; grupos de barco 0x10–0x17 (MAINOUT 0x00E5+ fija 0x12/0x13/0x14/0x15 por
  dirección al virar); fragata con velas arriadas / skiff = 0x24–0x2B (transport.md §2).
- **obj0+5 = hull, obj0+7 = skiffs** vienen anclados por transport.md (g_hull/g_skiffs son
  alias del registro del objeto activo, obj 0). El shipwright nace la fragata con
  `obj+7 = flags&0x3F` (0x0D45; fragata 0x82 → 2 skiffs).

**Implicación para el port (obj0 incompleto en saves de barco):** `exportNativeSave` sólo
escribe obj0 **+2/+3 (X/Y)** (`saveNative.ts:436-437`) y PRESERVA +0/+1/+4/+5/+7 de la
plantilla. Si la plantilla es un SAVED.GAM guardado a pie (o INIT.GAM), un save hecho EN
BARCO deja obj0+0/+1 = 0x1C (avatar a pie) y +5/+7 rancios → una herramienta DOS / el espejo
del Grand Tour leería el .gam con el avatar a pie y hull/skiffs equivocados. El estado real
del barco SÍ está en el sidecar (`transport`, `shipHull`, `shipSkiffs`), así que el
round-trip del PROPIO port es correcto; el fallo es sólo de **fidelidad byte del .gam**.

---

## 5. HUECO 3 — byte +6 (O2)

**Veredicto: +6 NO es scratch permanente. Es un campo por-actor VIVO, escrito por los
movers/animadores según contexto, y SE PERSISTE verbatim en SAVED.GAM.**
- place_actor NO lo toca (0x3A74, §2) — de ahí la impresión de "scratch" al colocar.
- Pero se escribe: fuera de combate 0/0xFF (kernel 0x6869/0x6927), en combate 0x20
  (COMBAT 0x0304/0x0327), 0 al limpiar (TOWN 0x17FF). Para NPCs de town toma 0x10/0x20/0x30/0x34
  vivos (§1) → estado de movimiento/horario por-NPC (no descifré el bitfield exacto; queda
  como "sub-estado de mover", no load-bearing para reglas).
- **Persistencia: SÍ.** El disco trae +6 no-nulo. El writer copia el bloque entero (§2).

**Efecto de que el port escriba +6=0 (`saveNative.ts:328`):** en el overworld el mover del
DOS re-escribe +6 en el primer turno del monstruo tras cargar, así que **+6=0 es
conductualmente inocuo** (no cambia reglas ni comportamiento). Sólo rompe la comparación
byte-exacta contra un save DOS. Recomendación: mantener +6=0 salvo que se exija paridad byte
del .gam de overworld; en ese caso añadir un campo opcional a `OverworldEnemy` que
round-trip-ee +6 (coste no justificado hoy).

---

## 6. Cableo (ADJUDICADO por el lead — IMPLEMENTADO en esta rama)

**Estado: (a)+(b)+(c) CABLEADOS. Gate verde: tsc + typecheck:e2e + 2180 unit (172 files).**
- (a) `exportNativeSave` sincroniza obj0 ENTERO desde el transporte (obj0+0/+1=transportTile,
  +4=floor, +5=shipHull, +7=shipSkiffs; +6 preservado). Gateado a `transportTile!==undefined`
  → la guarda anti-drift del sha canónico se mantiene (fixture con transportTile undefined).
  Test byte a byte en barco/a pie/undefined (`tests/save-native.test.ts`).
- (b) +6 se queda a 0 (inocuo); comentarios de `saveNative.ts` corregidos + `re/notes/
  native-persist-enemies.md` parcheada (+1 = frame animado vivo, no espejo; +6 = campo de mover
  persistido, no scratch).
- (c) `OverworldEnemies.clear()` nuevo; llamado en `game.ts` `loadSmallMap` (pueblos/keeps/
  dwellings) y `enterDungeon` (mazmorras) — NO en el camino de combate (arena aparte). Espeja el
  memset de entrada a interior del binario (MAINOUT 0x0857). Test de integración
  (`tests/overworld-reseed-o1.test.ts`): (E)nter a un pueblo vacía la pool.

**⚠ CONSECUENCIA PARA EL LEAD — RE-SELLAR EL GRAND TOUR (no lo hago yo; carril/mutex tuyo):**
(a) cambia los bytes de obj0 en TODO save. Los 16+ sellos `e2e/grandtour/saves/*.gam` codifican
el obj0 ANTIGUO (infiel): todos tienen `obj0+0/+1 = 00 00` (heredado de INIT.GAM en blanco),
**incluido ch16 que está EN FRAGATA** (transp=0x25, obj0=`00 00 22 12 00 00 00 00` → con el fix
sería `25 25 22 12 FF HULL 00 SKIFFS`). Al re-generar el tour, esos .gam cambiarán en obj0
(+0/+1/+4/+5/+7). Los SIDECARS de los sellos NO cambian por (c): todos traen ya
`overworldEnemies: []` (verificado los 16). Hay que **regenerar los sellos** (`npm run tour`) y
re-sellar como parte del aterrizaje.

### Propuesta original (para referencia)

1. **obj0 en barco (fidelidad byte del .gam, HUECO 2).** Sincronizar obj0 completo desde el
   estado de transporte al serializar, no sólo X/Y:
   - `gam[0x6B4]=gam[0x6B5]=state.transportTile` (obj0+0/+1 = tile de vehículo; ya se escribe
     el mismo valor en 0x2D6, así que es coherente).
   - `gam[0x6B8]=state.position.floor` (obj0+4).
   - En barco: `gam[0x6B9]=state.shipHull` (obj0+5 = hull), `gam[0x6BB]=state.shipSkiffs`
     (obj0+7 = skiffs). A pie/otros: preservar/0 como hoy.
   Con esto el .gam del port es legible por herramientas DOS también en barco.
2. **+6 (HUECO 3):** dejar `=0` (inocuo, el mover DOS lo re-escribe). Documentar en el
   comentario de `writeNativeOverworldEnemies` que +6 es estado-de-mover vivo, no scratch, y
   que la fidelidad byte lo omite a propósito. (Actualizar el comentario de la línea 328 y la
   tabla de native-persist-enemies.md, donde +1="espejo" y +6="sin derivar" son imprecisos:
   +1 = frame animado vivo; +6 = sub-estado de mover, persistido.)
3. **HUECO 1:** el gate `location===0` es correcto — **sin cambios**. Abrir con el lead si el
   runtime conserva `overworldEnemies` a través de una visita a interior (posible divergencia
   de reseed; ver §3).

## Limitaciones de este witness
- Escenarios (a interior) y (b barco) NO capturados en vivo: derivados de ASM + transport.md
  + el town save de referencia. Un dump vivo en barco/overworld (navegando el oráculo o con
  un SAVED.GAM sembrado en esos estados) confirmaría §3/§4 empíricamente; el ASM (memset de
  entrada a interior; alias g_hull/g_skiffs = obj0+5/+7) es concluyente para el veredicto.
