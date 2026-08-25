# Verificado: Bucles de contexto exterior/pueblo — TOWN + MAINOUT (Task 3.13)

Reglas re-derivadas del asm con citas (`re/notes/loops.md`) y portadas al clon
(`game/src/core/world/loops/{spawn,hazards,guards,turn}.ts` + integración en
`game/src/core/game.ts`). El arnés `re/tools/test_loops_parity.py` cruza dos
modelos INDEPENDIENTES: la predicción asm-derivada en Python (`loops_parity.py`:
`KernelRng` + el orden MAINOUT 0x0A84 / TOWN 0x141E) y la reproducción del core del
clon (`game/src/core/__parity__/loops-run.ts`, `OriginalRng` + world/loops/*.ts),
exigiendo que calquen la TRAZA DE RAND por turno (site/lo/hi/value) y la semilla
final. Misma filosofía que test_transport_parity / test_npc_parity.

## Estado de la verificación (2026-07-11)

VERDE:
- `re/tools/test_loops_parity.py` — 13 passed (puros; sin dosbox): `KernelRng`
  casa con la inversa VERIFICADA `parity.rng_unstep`; `spawn_threshold` byte-a-byte
  contra el asm; el orden viento→spawn; 9 escenarios cruzan clon↔modelo con traza
  y semilla final idénticas (outdoor limpio/pantano/underworld-noche, town limpio/
  doble-worldturn/post_turn, spawn_threshold, guard-wander, bridge-troll).
- `npm test -w game` — 484 passed (incluye `tests/loops.test.ts` 37 tests y  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  `tests/loops-integration.test.ts` 3 tests: spawn_threshold, gate de spawn,
  underworld hazard, bridge troll (STR del 1er consciente, inner tick 0x5910),
  troll_toll (99), swamp_poison exterior rand(1,30) vs townSwampPoison rand(0,29),
  whirlpool, guard_wander, outdoorTurn/townTurn order, veneno de pantano en Game).
- Suite RE requerida — sin regresiones (ledger/dispatch verdes; invariante
  202800 intacto).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas

- **spawn_threshold (MAINOUT 0x0D8C)**: underworld 3; agua [0x20,0x26] 0;
  pantano(4)/montaña[9,0xF] 2; else 1; +3 nocturno SÓLO 00:00-04:59 (el `cmp
  0x20` es rama muerta → atardecer sin bonus, quirk conservado). Cruzado byte-a-
  byte contra el listado de `re/disasm/MAINOUT.OVL.asm:1365-1410`.
- **Gate de spawn (world_turn 0x1A60 @0x1AA7)**: rand(1,30) SIEMPRE la primera
  rand; spawnea sólo si `threshold > roll`. Terreno normal de día no spawnea. El
  clon lo enruta por el stream compartido (defaultRand) — reemplaza el 1/16.
- **underworld_hazard (0x0A60)**: floor≠0 → rand(0,255)==0x69 (1/256, el 0x69 es
  el VALOR, no el tile) → party_random_damage. Consume 1 rand/turno en underworld.
- **bridge_troll_ambush (0x1BE8)**: rand(0,7) gate 1/8; sólo a pie; tick de viento
  KERNEL 0x5910 (NO el world_turn 0x1A60) ENTRE el gate y las tiradas; por miembro
  no-'D'/'S' rand(1,30) vs DEX, el primer fallo dispara el peaje y BREAK.
  `troll_toll` = **99**−3·STR (0x63) del **primer miembro consciente**, no del que falla.
- **swamp_poison EXTERIOR (OUTSUBS 0x5FC)**: rand(1,30)>DEX → 'P' por miembro no-'D'/'P'.
- **townSwampPoison PUEBLO (TOWN 0x108D)**: rand(0,29)>DEX — RANGO DISTINTO; función
  aparte, F.2 no debe reutilizar swampPoison.
- **post_turn de pueblo (0x0F02)**: despertar 'S' rand(0,15)==0xF (sólo si sigue
  dormido); tick de viento extra en tiles de daño; confusión rand(0,1)[+rand(0,3)].
- **Santuario AL PISAR (0x0C8A)**: guardián del Shrine of the Codex en (0xE9,0xEB)
  overworld — Pass/deny + empuje 1 al sur según shrineQuestBitmap. Sin RNG. Cableado.
- **guard_wander (TOWN 0x0C78)**: rand(0,1) actúa + rand(0,1) eje + rand(0,1)
  signo; 1 rand si no actúa/bloqueado, 3 si se mueve.
- **Orden del turno**: viento (getkey) → housekeeping → spawn (exterior); viento
  por-tecla → housekeeping (pueblo). Verificado por la traza del cruce modelo↔clon.

## Placement de spawn — `pick_spawn_coords` (MAINOUT 0x0F4E) [F.2 T2]

`spawn_monster` (0x0FD1) llama 1× a `pick_coords` (0x0F4E), que elige coords
tirando **2×rand(0,31) por intento** (x,y) y RE-ROLLEA SÓLO POR DISTANCIA a la
party. El clon lo porta en `world/loops/spawn.ts:pickSpawnCoords` y lo consume
desde el **stream vivo** (`game.ts:outdoorWorldTurn` → `overworldEnemies.trySpawn`):

- **CONDICIÓN de re-roll (derivada del asm 0x0F84-0x0FC0)**: `|x−party_x| ≤ 6` ó
  `|y−party_y| ≤ 6` (con guarda de wrap `≥ 250 = 256−6`) ⇒ re-roll. Es decir, la
  casilla aceptada dista **>6 en AMBOS ejes** de la party. **NO hay check de
  pasabilidad en el bucle ni tope** (0x0FC2 `ret`): la pasabilidad la decide
  DESPUÉS `spawn_monster` (lee el tile, elige monstruo; si no cuaja, no spawnea).
- **ANCLA offset** (aproximación pre-aceptada por el brief, NO byte-a-byte): el
  binario ancla en `chunk_origin`; asumiendo party ≈ chunk_origin+16, el offset
  firmado es `rand(0,31)−16 ∈ [-16,15]`. Con |offset|≤16 la guarda de wrap (≥250)
  nunca se alcanza, y el filtro se reduce a `|d| ≤ 6`. Si un oráculo mide
  `chunk_origin` real, cambiaría el ANCLA (−16), **no la CONDICIÓN de re-roll**
  (distancia >6), que sí está derivada del asm. El consumo por intento (2 rands)
  es exacto; el nº de intentos depende de la condición de distancia (ya derivada),
  no de la pasabilidad.
- **Guarda de ingeniería**: `PICK_COORDS_GUARD=1000` en vez del bucle infinito del
  binario; con p(aceptar)≈0.35/intento, agotarla es despreciable (seguro contra un
  rand degenerado, no una regla).
- Esto reemplaza el puente float (`liveRng.next(0,0x7fff)/0x8000`) y el `Rng`-hash
  `turn*2654435761` del picker de T1 — ya NO hay LCG separado ni `Math.random`. El
  picker (`pickEnemyForTile`) decide agua/tierra a posteriori y consume
  1×`rand(0,total-1)` del mismo stream (sin LCG propio).

## ⚠️ Anclado por asm + cruce (no runtime-verificado byte-a-byte)

- El **valor byte-a-byte del stream vivo completo** (viento+housekeeping+spawn en
  una única semilla g_rng_seed observada en DOSBox) NO se cierra aquí: el clon no
  unifica todavía el RNG vivo en un único OriginalRng ordenado (spawn/npc/combate
  usan fuentes separadas). Queda anclado por (a) la órbita del world-tick ya
  verificada EN VIVO (`re/verified/npc.md`, `test_npc_parity`,
  `test_wind_value_live` de transport) y (b) el cruce modelo↔clon de la traza de
  rand por turno de aquí. La unificación del stream vivo + el barrido runtime del
  bucle completo → **F.2**.

## Cableado en vivo cerrado / pendiente

CERRADO en `game.ts` (Task 3.13):
- Gate de spawn exacto por el stream compartido (tickTurn).
- Viento en pueblo (por turno consumido).
- Hazard del underworld por turno (floor≠0).
- Tiles especiales del exterior: pantano→veneno, puente→trolls (peaje 99−3·STR),
  santuario AL PISAR (0xE9,0xEB) Pass/deny + nudge.

CERRADO en `game.ts` (F.2 T1 — stream vivo unificado):
- Un único `OriginalRng` vivo (`liveRng`) para TODO el turno; orden
  viento→reloj→hazards→housekeeping→spawn delegado en `outdoorTurn`/`townTurn`.

CERRADO en `game.ts` (F.2 T2 — placement + world-turn exacto):
- **pick_spawn_coords exacto** (2×rand(0,31) con re-rolls, 0x0FC4) por el stream
  vivo; elimina el puente float y el `Rng`-hash del picker (`pickEnemyForTile`
  ahora toma un `RandFn`). Ver §"Placement de spawn".
- **Gates de spawn en los world-turns EXTRA de terreno lento** (0x448/0x468: 1-2 ×
  `call 0x1A60`): cada world_turn extra rueda su propio gate `rand(1,30)` (0x1AA7)
  — `outdoorWorldTurn` corre `speed+1` veces por paso, tras el viento (afterWind).
- **El viento precede a los world-turns extra**: `afterWind` inyecta los extras
  JUSTO tras el viento (0x5910) y antes del coste base — orden MAINOUT 0x3E0.
- **Paso BLOQUEADO exterior rueda el viento**: `move()` corre `runContextTurn` en
  blocked; `outdoorTurn(ctx.blocked)` tira SÓLO el viento (0xC30→0xD14: sin reloj
  ni world-turn, minutes=0). Pueblo bloqueado consume 1 min (TOWN 0x15D4).
- **2º world-turn del npc_engine** ([0x65BF], TOWN 0x1671): `npcEngineSecondTurn()`
  → hay NPCs activos en la planta (aprox. de `[0x65bf]≠0`); dispara el 2º viento.
- **Fases Quickness/montura del world_turn** (0x1A6D): flags BSS [0x2C55]/[0x2C57]
  toggleados por world_turn; con 'Q' o montado (horse/carpet) el world_turn corre
  en FASE ALTERNA (`outdoorWorldTurnRuns`).

CERRADO en `game.ts` (F1.3 T2 — peaje de trolls interactivo):
- **troll_toll con prompt Y/N** (MAINOUT 0x1B3E): `runContextTurn` ya NO auto-paga;
  pausa el turno a mitad (`pendingTroll` + evento `troll-toll-prompt`) y
  `resolveTrollToll(pay)` resuelve — pago (oro≥toll) reanuda la cola diferida EXACTA
  (`tickDoorsAndNpcs`+`outdoorWorldTurn`), oro<toll reembolsa, rechazo/no-puede-pagar
  → `spawnTrollCombat` (troll defIndex 41) que SUSTITUYE la cola. getkey crudo 0-RNG
  (parity 239 intacto); ESC ignorado (tipo `yesno`, ⚠ distinto de la salida de pueblo).
  Spawn de rechazo asumido 0-RNG (Clase C: cuerpos 0xb714/0xb8a4/0xdf80 fuera de los
  overlays desensamblados). Commit `e81c6e6`; detalle en `deliberate-divergences.md`.

PENDIENTE → **F.2** (asignación explícita):
- Viento de pueblo POR TECLA (incl. teclas inválidas; el clon lo aproxima por
  turno consumido).
- guard_wander en vivo (requiere la tabla de objetos-guardia de small maps).
- Re-roll de Shadowlords a medianoche (kernel 0x5004) — hook compartido con 3.10.
- `party_random_damage` del tile de daño de pueblo (0x10C4 → kernel 0x2AA8,
  rand(1,8)/miembro): el clon modela sólo el tick de viento extra del tile de daño;
  el daño aleatorio en sí (además del veneno del pantano) va con el cableado en vivo.
- Meditación de santuario (mantra) y pozo de deseos: flujos interactivos que entran
  por `enter_map_location` 0x0790 / LOOK, no por tile del bucle — cableado en
  `checkLocationEntry` / comando LOOK, no en `applyOutdoorSpecialTiles`.
