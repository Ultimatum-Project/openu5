# In *Grav (muro de campo overworld) — implementación del port

> 🔴🔴 **DOCUMENTO SUPERADO EL 2026-08-08. NO LO USES COMO ESPECIFICACIÓN.** Lo que describe
> —la vía de SOBREMUNDO, el sello de 5 celdas, `fieldSpell.ts`, `Game.applyFieldSpell`,
> `pendingCastField` y sus dos tests— **está RETIRADO del port**, y el modelo que da es falso
> en su pieza central: **el binario no tiene rama de sobremundo**. `CAST.OVL cast_field_wall`
> 0x004c parte en `0054 cmp byte [g_location],0x80` / `jb` = **mazmorra vs combate**, y la
> máscara por hechizo `DS:0x1C90` vale `0x03` (mazmorra+combate) para los cuatro índices
> 14/15/16/20 — así que en exterior y en pueblo el hechizo **ni siquiera se lanza**: sale
> «Not here!».
>
> Medido por DOS canales del binario más un cast VIVO que no consume ni hechizo ni maná en
> ninguna de las dos bandas, con control positivo (In Lor) consumiendo en las dos:
> **`field-grav-gate-testigo-20260808.md`**. Ese testigo CONTRADICE al del 18-07 que esta
> nota cita como spec, y los dos quedan fechados y en pie.
>
> Lo VIGENTE: `Dungeon.applyFieldWall` — UNA celda (la de enfrente por la orientación, con
> `and 7` en los dos ejes), guarda `00b8 test …,0xf7` (sólo suelo vacío) y **conservación del
> bit 3** (`00c6 & 8` + `00ce or`), en la rejilla 8×8 de mazmorra. Tests:
> `game/tests/field-wall-dungeon.test.ts`.
>
> Se conserva el texto de abajo SIN tocar porque documenta de dónde salió el error (la
> atribución de las escrituras de `DS:0xb19e` y del compositor `0xab02` al campo), que es
> justo lo que queda por re-atribuir. **Leerlo como spec vuelve a sembrarlo.**
>
> ✅ **RE-ATRIBUCIÓN HECHA EL 2026-08-20 (ficha #138, `remap-anim-b11e-castillo-138.md`):**
> `0xb19e` = entradas 0x80-0x83 de la tabla-remap de animación de tiles (DS:0xB11E, init
> identidad INTRO.OVL 0x0993, reloj ULTIMA.EXE 0x44b8 — sin condición de hechizo); las
> celdas `0x3a-0x3f` de `0xab02` = el Castillo de Britannia en el mapa crudo, con la
> entrada 0x3e en el (86,107) exacto donde estaba el party del testigo. Nada era el campo.

Cierra el fleco «feature In*Grav» del carril los-audit. Spec/witness del oráculo:
`field-duration-witness.md` (relevo-2). Este documento registra el CABLEADO en el port.

## Modelo (derivado, no objetos)

El campo NO es un objeto de mundo (los 2 slots de `g_world_objects` 0x5C5A que vio el
volcado eran SPAWNS coincidentes del turno). Es **map-tiles de campo escritos en celdas**:

- **Tile lógico:** `FIELD_WALL_TILE = [0x82,0x81,0x80,0x83]` (fuego/veneno/sueño/energía),
  ya en `tables.ts:59` (DS:0x4596). In Flam Grav = arg 0 → 0x82. VALIDADO contra el binario
  (siembra 0x80-0x83 en el registro DS:0xb19e).
- **Geometría (SETTLED):** **5 celdas** en la dirección apuntada — fila FRONTAL (delante-1,
  3 celdas: `3a 3b 3c` en el display) + fila del PARTY (delante-0, 2 celdas FLANQUEANDO al
  avatar: `3d _ 3f`; la central es la casilla del party y no se siembra). Es el 3×2 del
  composite MENOS la celda del avatar. Witness settled (probe_field_anim, settle 12 ticks):
  ncells estable = 5 durante 9 turnos en ambos frames. `fieldSpell.ts::fieldStampCells`.
  NO es la curva radial de 21 celdas del esqueleto `areaSpell.ts` (esa es la vía APUNTADA
  /lineAoe, incógnita aparte).
- **Persistencia:** `mapOverrides` (capa Clase-A PERSISTIDA, `state.ts:282`), compone vía la
  lectura base+override de `game.ts` sin mutar el tile base (precedente `doors.ts`). El
  witness confirmó PERSISTS (leave/return: el campo sobrevive al scroll) → capa de save, no
  overlay efímero de display.
- **Pasabilidad:** 0x80-0x83 son `walkable=false` (canónico DATA.OVL @0x54e4 + port) → el
  campo BLOQUEA el paso a pie. In Sanct Grav «cannot be entered» sale gratis.
- **Animación:** 0x80-0x83 = `IsPartOfAnimation` (2 frames); el renderer YA los cicla
  (`tileanim.ts`/`tileprog.ts`). No hace falta cablear el toggle por turno.
- **Silencio:** el cast global es SILENCIOSO (post cast-echo, `castSpell` devuelve
  `message:""`); el getdir no imprime prompt (cursor de dirección); la siembra no imprime.

## Cableado

- `game/src/core/magic/fieldSpell.ts` — `fieldStampCells(x,y,dir)`: las 5 celdas.
- `game/src/core/game.ts` — `Game.applyFieldSpell(effect,dir)`: siembra las 5 en
  `mapOverrides` + emite `map-changed`. SILENCIOSO. Espejo de `applyDoorSpell`.
- `game/src/main.ts` — `pendingCastField` (espejo de `pendingCastDoor`): el cast overworld
  del efecto `fieldWall` hace getdir; la dirección dispara `applyFieldSpell`.
- Tests: `field-spell.test.ts` (geometría 4 dirs) + `field-spell-apply.test.ts` (siembra/
  silencio/persistencia round-trip).

## Clase-C / flecos abiertos

1. **Decay 3/6 — RESUELTO (relevo-2, SETTLED):** el «6→3» de la sonda leave/return fue
   **artefacto de lectura** (viewport mid-composite, lecturas sin settle), NO decay. El
   shape estable real es de 5 celdas (ver Geometría). Cableado **persistente-completo**
   (las 5 quedan); sin contador por celda.
2. **Combate:** vía SEPARADA e INTACTA (no-op en `combat.ts`). Campos de combate = arma-
   hechizo 0x33-0x36 (`FIELD_WALL_COMBAT_WEAPON`), single-cell, buffer arena DS:0x595a
   (COMSUBS 0x0C52) — espacio distinto del overworld. Su siembra + decay (probablemente
   finito) se derivan aparte antes de tocar su no-op.
   → **El lado del CONSUMO ya está derivado: ver §6.**
3. **Prompt de dirección:** el string del getdir del campo no está derivado → NO se fabrica
   (sin prompt; se guía por el cursor). Si el original imprime algo, se añade con cita.
4. **Obstáculos:** ~~¿el campo arde sobre árbol/montaña o para antes? (PENDIENTES 4d)~~
   [HISTÓRICO 2026-07-25: superado por `witness-flamgrav-obstacle-v2.md` (main 9044ceed) —
   VEREDICTO BURN: el handler overworld 0x1c36 no tiene gate de terreno activo (BP 0x3f6e
   = 0 hits) y el eje opacity-stop de #4d se RETIRA; el gate STOP de CAST.OVL:0x004c NO es
   la vía overworld]. Hoy siembra las 5 celdas sin bounds/obstacle-check — comportamiento
   FIEL según el witness (caveat: BURN sostenido por implicación, no medición directa).
5. **Registro 0xb19e:** es el «frame de animación actual por TIPO» (4 bytes, toggle de pares
   por turno), NO el almacén de celdas — no se modela (el renderer del port ya anima).


---

## §6 — Qué HACEN los campos en la arena, turno a turno (derivado 2026-07-25)

Cierra la mitad de «consumo» del fleco #2 (la siembra/decay siguen aparte). Fuente:
**`COMBAT.OVL:0x1b1e end_of_turn_terrain_field_damage`** (328 B), leída entera.
Encontrada persiguiendo el `tile & 0xfc == 0xE8` de `an_grav_dispel_field`
(CAST2.OVL:0x07bc), que es quien los DISUELVE.

La rutina resuelve una **magnitud** en dos fases y luego despacha por ella:

**Fase 1 — terreno de la arena** (0x1b41-0x1b6a). Lee el tile en `[bx + si - 0x52ec]`
(la rejilla compuesta, stride 32 — **NO** `0x595a`, que es la planta de mazmorra):

| tile de arena | magnitud |
|---|---|
| `0x8F`, `0xBC` | `0x64` (100) |
| `0x04`         | `0x32` (50) |

**Fase 2 — objetos de mundo**, sólo si la fase 1 no dio nada (0x1b75-0x1c0a). Recorre los
32 slots de `g_world_objects` (0x5C5A, stride 8) buscando uno cuya (x,y) coincida con la
del combatiente (`[bx+6]`/`[bx+7]`):

| objeto | magnitud |
|---|---|
| `0xE8` | `0x32` (50) |
| `0xEA` | `0x64` (100) |
| `0xE9` | `0x96` (150) |

**Fase 3 — despacho por magnitud** (0x1bdd):

| magnitud | efecto |
|---|---|
| `0x32` (50) | **VENENO**: si el tile del propio actor (`[idx*8 + 0x5c5a]`) es `< 0x80`, `poison_attack(actor, -1)` (COMBAT 0x18ba) + `0x92d4` |
| `0x64` (100) | **DAÑO**: `0x92d4`, luego `apply_damage_death_loot(actor, rand_range(0..10))` y `print_attack_result(actor, 0xff)` (COMSUBS:0x0312); marca redibujo |
| `0x96` (150) | **SUEÑO**: `durmiente` (ULTIMA.EXE:0x68ae) |

### Lo que esto fija

- **La magnitud NO es daño**: es un CÓDIGO DE TIPO. El daño real del tipo-100 sale de
  `rand_range(0..10)` **dentro** de la rama, no de la constante.
- **Equivalencia terreno↔objeto**: el veneno del objeto `0xE8` es exactamente el mismo
  camino que el del tile `0x04` (pantano), y el daño del objeto `0xEA` el mismo que el de
  los tiles `0x8F`/`0xBC`. Un campo casteado y un terreno peligroso se resuelven por el
  MISMO despachador.
- ⚠ **`0xEB` NO aparece aquí.** La disolución (`an_grav_dispel_field`, `and al,0xfc; cmp
  al,0xe8`) cubre los CUATRO valores `0xE8-0xEB`, pero el daño por turno sólo trata tres.
  Asimetría real, no olvido de lectura: son dos máscaras distintas en dos rutinas
  distintas. ~~Cuál de los cuatro tipos de In\*Grav queda sin efecto por turno (¿el de
  energía?) **no lo cierro aquí** — haría falta ver la siembra, que es el otro medio
  fleco.~~ [CERRADO 2026-08-23, carril campos-energia: es el de ENERGÍA `0xEB`, y la
  asimetría es coherente — `combat_cell_occupancy_test` (COMBAT:0x0000 @00a4) hace que
  `0xEB` BLOQUEE la celda (0xE8/E9/EA transparentes): nadie puede estar encima, así que
  un efecto por turno sería inalcanzable. Ver
  `re/notes/cargador-ticket-amplio-0xb4-0xe8-0x70.md` §6-§7.]
- ~~El port lo tiene declarado como no-op en `combat.ts:15` («Campos (0xE8-0xEB) y su daño
  de terreno: pendientes de integrar con los tiles») y `combat.ts:2045`. Sigue siendo
  carril de gameplay: **aquí sólo se deriva**.~~ [SUPERADO 2026-08-23, carril
  campos-energia: 0x1b1e está CABLEADO entero — fases 1+2+despacho — en
  `combat.ts::endOfTurnFieldDamage`, con la siembra de los 26 campos (`fieldSlots`), la
  ocupación de 0x0000 y la rama de combate de An Grav (`castDispelField`). Guardas:
  `game/tests/campos-energia-arena.test.ts`.]
