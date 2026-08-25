# Triggers de sala de mazmorra (.CBT) — mecánica FIEL + censo + P0c

Derivación estática (sin oráculo) del subsistema de triggers de arena de mazmorra,
implementado en `game/src/core/combat/combat.ts` (`Combat.fireTriggers`). Complementa
`re/notes/combat.md §10`.

## Mecánica (COMBAT.OVL 0x111A + SJOG.OVL 0x1d42)
- **Efecto (0x111A):** al colocar un combatiente en (x,y), si == el `at` de un trigger,
  escribe el tile `sprite` del trigger en newPos1 y newPos2 (cada uno SÓLO si sus coords
  < 0xB; el binario `cmp 0xb / jae skip`) sobre la rejilla de combate 0xAD14, y consume
  el trigger ONE-SHOT escribiendo **0xFF en at.x/at.y** (116f-1173 `mov al,0xff` — calco
  del dato, no un flag). Abre muros (0x4F StoneBrickWall → 0x44 BrickFloor) o siembra
  lava (0x8F) según el `.CBT`. Sólo redibuja (call 0xffffb680), sin mensaje.
- **Llamadores (3):** SJOG:0x1d42 = tras un MOVE CON ÉXITO de CUALQUIER combatiente
  (party O enemigo; 0x1d11 `or ax,ax; je` = sólo si el move cuajó), gate
  `test [g_unk_58a1],0x82` (= combate de SALA; el de campo omite el flag → sin triggers).
  SJOG:0x1e8c = move especial sobre tile 0x4c. CMDS:0x1699 = vía comando pero gate
  `cmp g_location,0x7f; jbe skip` ⇒ **NO dispara en mazmorra** (loc 0x21-0x28 ≤ 0x7f).
- **Corolario — anomalía "at en celda no andable" (35/128) RESUELTA:** en combate de sala
  la placa sólo se dispara por move-con-éxito; si su `at` es un tile impasable en combate
  (Brazier 0xB2, Portcullis 0x99, StoneHeadstone 0x8A, Fountain 0xD8, Sconce 0xB0/B1,
  RockWall 0x4C/4D…), NINGÚN combatiente lo ocupa → NUNCA se dispara. El port lo reproduce
  FIEL (el move se rechaza por `tilePassableFor` = walkable/landEnemyPassable). No es
  "activar por Open/Get": es "no dispara".

## Implementación en el port
Rejilla de tiles VIVA (copia mutable de `map.tiles`) que `tileAt`/`mapTiles` leen → los
triggers mutan pasabilidad/LOS/render/daño-de-terreno sin tocar el mapa compartido.
`fireTriggers(x,y)` en los 4 sitios de commit de movimiento (playerMove, enemyMove normal
+ teleport, castBlink), gate `opts.roomCombat`. Tests: `game/tests/room-triggers.test.ts`.

## GOTCHA de indexado (crítico)
combatmap N del port = **POSICIÓN de array** N = `DUNGEON.CBT[N−16]` (el array es
[BRIT 0..15][DUNGEON 0..111]), NO el campo `index` (que el extractor pone 0..111,
duplicando los de BRIT). Keyear por `index` engaña. `roomCombatMapIndex` devuelve la
POSICIÓN. Verifica siempre contra el .CBT crudo por posición (`base=(N−16)*352`).

## #29 (la sala de ch16b) — re-derivada
combatmap 29 (POSICIÓN de array; su campo `index`=13 = DUNGEON.CBT[13]) = **2 Dragon +
9 Headless** (ch16b lo asevera CORRECTAMENTE; ⚠ OJO al resolver nombres: la tabla del
port es `enemyDefs` con el "index-hack" de Redux —huecos en 8/9/42/43, i>8 resta 2, i>41
resta 2— NO `monsterNamesMixed[idx]` directo). tile (5,5) = BrickFloor ANDABLE; los 8
triggers en at(5,5) escriben 0x44 sobre el muro 0x4F de x1-3/y4-6 → DESELLAN el bolsillo
de los 9 Headless → melé. Los 2 Dragon están en un bolsillo DryStone (0x46) que ningún
trigger abre, PERO son alcanzables por RANGED con LOS (ch16b los mata). ⇒ #29 SÍ es
ganable si el resolver PISA la placa (9 Headless a melé) + tira a los 2 Dragon.

**Por qué ch16b sigue VERDE con triggers vivos:** el resolver ranged actual NO pisa (5,5)
→ el muro no se abre → los 9 Headless siguen sellados → la aserción "inganable" se
mantiene. El "dead-end" de ch16b es entonces un artefacto del RESOLVER (no pisa placas),
no un dead-end fiel del binario (un jugador real SÍ pisaría la placa). La reescritura
espera a que el arnés conquerRoom (P1) aprenda a explotar placas; su SENTIDO depende
además de si el ASCENSO de Deceit existe (P0a).

## P0c — primer pase de los 13 candidatos (COTA INFERIOR: BFS melé; ranged-LOS NO modelado)
Nombres CORREGIDOS con el index-hack de `enemyDefs` (mi primer pase los sacó de
`monsterNamesMixed[idx]` directo = MAL, desplazados 2). Las CUENTAS y la geometría
(alcanzabilidad melé antes→después) son correctas; sólo cambiaban los nombres.

| # | composición | at-dispara | melé antes→desp | triaje |
|---|-------------|-----------|-----------------|--------|
| 22 | 14 Insect Swarm | sí | 0→14 | GANABLE melé |
| 42 | 8 Bat | sí | 0→8  | GANABLE melé |
| 70 | 4 Giant Rat + 9 (idx43) | sí | 4→13 | GANABLE melé |
| 114| 6 Bat + 6 Mongbat + 4 Dragon | sí | 3→16 | GANABLE melé |
| 27 | 2 Dragon + 3 Headless + 4 Bat | sí | 0→7  | los 2 "sellados" = Dragon → RANGED-alcanzables → GANABLE |
| 28 | 2 Dragon + 12 Gremlin | sí | 0→12 | 2 Dragon sellados → RANGED → GANABLE |
| 29 | 2 Dragon + 9 Headless | sí | 0→9  | 2 Dragon (DryStone) RANGED + 9 Headless por placa → GANABLE con placa |
| 58 | 5 Insect Swarm + 4 Reaper + 6 Bat | sí | 10→10| PARCIAL 5 Insect Swarm (1,1) — Reaper no se mueve |
| 122| 4 Dragon + 8 Mongbat | sí | 2→2  | PARCIAL (placa abre otro sitio) |
| 57 | 15 Bat | sí | 0→0  | PARCIAL (placa abre otro sitio) |
| 21 | 6 Orc + 6 Bat + 1 Troll | NO | 0→0  | PARCIAL (at impasable) |
| 55 | 15 Bat | NO | 0→0  | PARCIAL (at impasable) |
| 74 | 2 Ghost + 1 Skeleton + 5 (idx43) | NO | 0→0  | PARCIAL (at impasable; idx43 = material ch17) |

Veredicto AUTORITATIVO = arnés `conquerRoom` (Fase 1) jugando cada sala con el motor real
(ranged-LOS + movimiento enemigo). El BFS melé subestima: muchos "sellados" son Dragon/Bat
alcanzables a distancia, y algunas placas útiles piden que el resolver PISE la placa.

## Oráculo (nota operativa para el carril de placement, P0a)
El oráculo NO fue necesario para los triggers (todo estático). Para P0a (placement #99):
la sonda de navegación EN VIVO es INVIABLE — el save de referencia
(`original/u5/ultima5/SAVED.GAM`) tiene la party en el Castillo de LB
(`g_location=17, g_floor=0xFF, g_party_x=15, g_party_y=26`; leídos con read_mem_gameseg
0x5893/0x5895/0x5896/0x5897), no cerca de mazmorra → llegar a una sala a pie por el buffer
BIOS (~1s/tecla + nav 3D) no es factible. Alternativa: SEMBRAR memoria
(write_mem_gameseg de location/floor/x/y/facing + disparar el enter) o llamada directa a
la rutina de setup 0xfa6e.
