# Combate táctico y mazmorras — derivado de Ultima5Redux

Fuente: `reference/Ultima5Redux/Ultima5Redux/`. Todas las rutas de este documento son
relativas a esa carpeta salvo indicación contraria. Las fórmulas de hit/daño y estados
de herida están además confirmadas contra el motor xu4 (Ultima IV open-source), cuyo
código C++ Redux copia como comentarios; se citan donde aplica.

Convención: **GAP — verificar contra DOSBox** marca comportamiento que Redux NO implementa
o implementa a medias, y que tendremos que re-derivar del ejecutable original.

Resumen de estado de Redux:
- **Combate táctico en mapa 11×11**: implementado y completo (turnos por dexterity, movimiento
  A*, melee/ranged, huida por bordes, división, loot). Buena base para copiar.
- **Magia en combate**: NO implementada (`SelectionAction.Magic` es un no-op). GAP.
- **Mazmorras 3D**: NO implementadas como vista 3D. Redux carga el piso 8×8 de la mazmorra
  como un "small map" cenital y no procesa celdas 3D, trampas, fuentes, salas→combate ni giros.
  Todo el modelo de datos (tipos de celda y subtipos) SÍ está parseado. GAP grande.
- **XP / subida de nivel**: NO implementada. Se acumula `AdditionalExperience` en combate pero
  nunca se aplica al personaje ni hay lógica de nivel. GAP.

---

## 1. Combate táctico

### 1.1 Entrada a combate y selección del mapa .CBT

Cada tile del overworld/small-map lleva asignado un índice de mapa de combate en su
definición (`TileReference.CombatMapIndex`, tipo `BritanniaCombatMaps`), en
`References/Maps/TileReference.cs:131`. Es decir, **el terreno del tile atacado decide el .CBT**.

Enum de mapas Britannia (`References/Maps/SingleCombatMapReference.cs:15`):

```
None=-2, BoatCalc=-1, CampFire=0, Swamp=1, Glade=2, Treed=3, Desert=4, CleanTree=5,
Mountains=6, BigBridge=7, Brick=8, Basement=9, Psychedelic=10, BoatOcean=11,
BoatNorth=12, BoatSouth=13, BoatBoat=14, Bay=15
```

Selección (`Maps/RegularMap.cs:605` `GetCombatMapReferenceForAvatarAttacking`):
1. Se lee `attackToTileReference.CombatMapIndex`. Si es `None` → no hay combate posible.
2. Caso normal a pie: se usa directamente ese índice →
   `CombatMapRefs.GetSingleCombatMapReference(CombatMapIndex, Britannia)`.
3. Enemigos de agua sobre tile "de tierra" (p.ej. puentes) → se fuerza `Bay`.
   Si el tile es `Bay` pero el enemigo NO es acuático → no se puede atacar (`return null`).
4. Casos de barco/carpet/skiff (`BoatCalc` = tile de agua que requiere cálculo especial):
   generan `BoatOcean`, `BoatNorth`, `BoatSouth`, `BoatBoat` según quién está en barco y dónde
   (`Maps/LargeMap.cs:462-510`). Piratas usan `BoatNorth`/`BoatBoat`.

Los 16 mapas overworld y 112 de mazmorra viven en `BRIT.CBT` y `DUNGEON.CBT`
(`References/Maps/CombatMapReferences.cs:19-23`, `TOTAL_OVERWORLD_MAPS=16`,
`TOTAL_DUNGEON_MAPS=112`, `N_ROOMS_PER_DUNGEON = 112/7 = 16`).

**Formato de un mapa .CBT** (`SingleCombatMapReference.InitializeMap`, línea 189):
- `MAP_BYTE_COUNT = 0x160` bytes por mapa; filas de `0x20` bytes; mapa jugable 11×11.
- Fila 0, cols 11..18: sprites de las 8 trigger tiles.
- Filas 1..4 (una por dirección de entrada E/W/N/S), cols 11..16 = X de los 6 PJs,
  cols 17..22 = Y de los 6 PJs. Así cada dirección de entrada tiene sus 6 posiciones de salida.
- Fila 5, cols 11..26: sprite de las 16 map-units (enemigos/objetos). Fila 6 = X, fila 7 = Y.
- Fila 8 cols 11..18 / 11+8..: posición (X,Y) de cada trigger. Filas 9 y 10 = los dos tiles
  destino que cambia cada trigger.
- Un sprite de map-unit se interpreta con +0x100 (`GetAdjustedEnemySprite`, línea 313):
  `StarPattern`→nada; ≤`ItemFood`→objeto (cofre); DeadBody/BloodSpatter→objeto; los cuatro
  campos (Poison/Magic/Fire/Electric)→campo; Whirlpool_KeyIndex..+4→remolino;
  `Guard_KeyIndex`→según territorio: en mazmorra `AutoSelected` (enemigo fijo del mapa), en
  Britannia `EncounterBased` (usa el enemigo del encuentro). Resto → `AutoSelected`.

Constantes: `XTILES=YTILES=11`, `NUM_MAP_UNITS=16`, `NUM_PLAYERS=6`, `NUM_ENTRY_DIRECTIONS=4`.

### 1.2 Cuántos enemigos y cuáles

`Maps/CombatMap.cs:216` `CreateEnemies`:
- **Mazmorra**: ignora el encuentro; instancia los 16 slots fijos del propio mapa .CBT
  (`AutoSelected`), incluidos campos/cofres.
- **Guardias en overworld** (`KeyTileReference.Index` 368..371): se fuerzan **4-5 guardias**
  (`Utils.GetNumberFromAndTo(4,5)`).
- **1 enemigo primario y 0 secundarios** (p.ej. pelea contra un NPC): posición fija índice 0.
- **Encuentro normal**: se barajan los slots (`Utils.CreateRandomizedIntegerQueue(16)`) y se
  colocan `nPrimaryEnemies` del tipo primario + `nSecondaryEnemies` del secundario.

Quién es el secundario: `Maps/VirtualMap.cs:445` `LoadCombatMapWithCalculation` usa
`nPrimaryEnemies=1`, `nSecondaryEnemies=1` y el secundario es el "amigo" del primario
(`EnemyRefs.GetFriendReference` → `ENEMY_FRIENDS[monsterIndex]`, ver 1.8). Si el enemigo es NPC,
`nSecondaryEnemies=0`.

### 1.3 Orden de turnos (iniciativa por dexterity)

`Maps/InitiativeQueue.cs`. Es un sistema de iniciativa acumulativa por dexterity, no un simple
orden fijo.

- Al iniciar (`InitializeInitiativeQueue`, línea 226): se recorren todas las combat-units activas,
  se ignora a los enemigos `!ActivelyAttacks` (campos de veneno, etc., dex 0) y a las non-attacking
  units. Se calcula `_nLowestDexterity` (mín, arranca en 50) y el máx. Cada unidad entra con tally 0.
- Por ronda (`CalculateNextInitiativeQueue`, línea 92) para cada unidad:
  ```
  nInitiative = dexterity + tallyAcumulado
  si nInitiative > lowestDexterity:
      tally = nInitiative mod lowestDexterity     # se resetea el excedente
      encolar_en(nInitiative - lowestDexterity)   # turno EXTRA esta ronda
  si no:
      tally = nInitiative
  encolar_en(nInitiative)                          # turno normal, prioridad = nInitiative
  ```
  Las unidades se ordenan por `nInitiative` descendente (mayor dex ataca antes) y se vuelcan a una
  cola FIFO. Se garantiza un mínimo de `MIN_TURNS_IN_QUEUE = 6` turnos en cola (se recalculan rondas
  hasta llenar). **Efecto**: dexterity alta → antes en la cola y ocasionalmente turnos dobles.
- `Round` incrementa al vaciar una sub-cola; `Turn` incrementa por cada unidad procesada.
- `GetTopNCombatMapUnits(n)` permite previsualizar el orden (para UI).

`ActivePlayerCharacterRecord` permite al jugador fijar un PJ concreto; si es null, se procesan
todos los PJs disponibles en orden de la cola.

### 1.4 Turno del jugador

`Maps/CombatMap.cs:1409` `ProcessCombatPlayerTurn(selectedAction, actionPosition)`:
- `SelectionAction.None` / `SelectionAction.Magic` → **return sin hacer nada** (GAP: la magia en
  combate no está implementada; el enum existe pero no hay lógica).
- `SelectionAction.Attack`:
  1. Objetivo = `GetCombatUnit(actionPosition)` (top-most visible en esa celda).
  2. Si te apuntas a ti mismo → salta turno.
  3. Si no hay combat-unit en la celda → `HandleCombatPlayerAttackingNoOpponent` (puede disparar un
     trigger, o marcar "atacas la nada"; si es ranged comprueba bloqueo por muro).
  4. Si hay: se saca el arma de `_currentCombatItemQueue.Dequeue()` (ver dual-wield 1.5), y si el
     arma es ranged (`Range>1`) se comprueba `IsRangedPathBlocked` por raycast (`Raytrace` +
     `RangeWeapon_Passable`); si bloquea → falla por bloqueo.
  5. `combatPlayer.Attack(...)` (fórmulas en 1.6).
  6. Si el ataque ranged FALLA, `HandleRangedMissed`: elige una celda aleatoria adyacente al objetivo
     (`GetRandomSurroundingPointThatIsnt`) y puede impactar accidentalmente a otra unidad
     ("But they accidentally hit another!").
  7. `PerformAdditionalHitProcessing`: división de enemigos, muerte de NPCs.
  8. `AdvanceIfSafe`: si aún quedan armas en la cola (dual-wield) NO avanza de turno; procesa veneno
     del PJ (`ProcessPlayerTurn`) y avanza al siguiente en la iniciativa.

Movimiento del PJ por combate: `MoveActiveCombatMapUnit(xy)` (línea 1326) mueve la unidad activa a
una celda libre, dispara efectos de tile y triggers al pisar. El jugador también puede "advance on
enemy" (`MoveToClosestAttackableEnemy`) que hace pathfinding A* hacia el enemigo más cercano.

### 1.5 Dual-wield / ataques múltiples por turno

`MapUnits/CombatMapUnits/CombatPlayer.cs:99` `GetAttackWeapons()` construye la lista de armas con
`AttackStat > 0` en este orden: **Helmet, LeftHand, RightHand**. Si ni izquierda ni derecha tienen
arma → "bare hands" (índice especial, attack=3, ver 1.7). La lista puede tener 1..3 entradas.

`RefreshCurrentCombatPlayer` (`CombatMap.cs:1122`) mete esa lista en `_currentCombatItemQueue`. En
cada input de ataque se hace **un** `Dequeue`; mientras queden armas, `AdvanceIfSafe` no pasa turno
→ **un PJ con dos armas ataca dos veces** (y con casco ofensivo, tres). Un yelmo con ataque cuenta
como arma extra. Armas a dos manos (`IsTwoHanded`) desequipan la mano derecha (escudo) al equiparse
(`PlayerCharacterRecord.cs:274`).

### 1.6 Fórmulas de acierto y daño

`MapUnits/CombatMapUnits/CombatMapUnit.cs`. Núcleo compartido por PJ y enemigo.

**Acierto** (`IsHit`, línea 199):
```
randomNum = random(0..254)                     # _random.Next(255)
hit = (defensor.Dexterity + 128) >= randomNum
```
xu4 original (comentado en el mismo fichero): `isHit(hit_offset) = (hit_offset+128) >= rand(0x100)`.
**Ojo**: Redux usa la *dexterity del DEFENSOR* como offset. Con dex 0 la prob. de acierto es
`129/255 ≈ 50.6%`; con dex 50 → `178/255 ≈ 70%`. Es decir, **más dexterity del objetivo = MÁS fácil
acertarle** en Redux, lo cual es contraintuitivo. En xu4/U4 el offset es la dex del ATACANTE.
**GAP — verificar contra DOSBox** si en U5 el offset es atacante o defensor.
`bForceHit` fuerza acierto (usado en el impacto accidental de ranged). Armas con `alwaysHits` o
dex≥40 → siempre aciertan (comentario xu4; no reimplementado tal cual en Redux).

**Daño** (`GetAttackDamage`, línea 185):
```
nMax  = armaAttackStat + atacante.Strength - defensor.Defense
daño  = (nMax <= 0) ? 0 : random() % nMax      # 0..nMax-1
daño  = min(daño, 99)                          # techo duro 99
```
- `Defense` del PJ = suma de defensa de todo el equipo (`GetCharacterTotalDefense`); del enemigo =
  `ENEMY_STATS.Armour`.
- `armaAttackStat` = `ATTACK_VALUES[equip]` (DATA.OVL, ver 1.7); del enemigo = `ENEMY_STATS.Damage`.
- Si `daño == 0` pero acertó → estado **Grazed** (roce, 0 daño).

**Estados de herida** (`CurrentHitState`, línea 40; idéntico a xu4 `Creature::getState`):
```
crit  = MaxHp / 4      (>>2)
heavy = MaxHp / 2      (>>1)
light = crit + heavy   (= 3/4 MaxHp)
hp<=0            -> Dead
hp<24            -> Fleeing         # umbral fijo 24 (nFleeingThreshold)
hp<crit          -> CriticallyWounded
hp<heavy         -> HeavilyWounded
hp<light         -> LightlyWounded
else             -> BarelyWounded
```
Cuando un **enemigo** entra en `Fleeing` se marca `IsFleeing=true` (intentará huir, ver 1.9). El
umbral 24 es absoluto: enemigos con MaxHp bajo pueden entrar en fleeing tras un golpe.

Efecto del golpe (`Attack`, línea 211): resta HP, acumula `TotalDamageGiven/Taken`, y si mata a un
**Enemy** (no a un PJ) suma XP y tira loot (1.10).

### 1.7 Valores de armas en DATA.OVL

`References/PlayerCharacters/Inventory/CombatItemReference.cs`:
- `AttackStat = ATTACK_VALUES[equip]`; bare hands (índice especial) = **3**.
- `DefendStat = DEFENSE_VALUES[equip]`; bare hands = 0.
- `Range = ATTACK_RANGE_VALUES[equip]` (0→se normaliza a 1). Range>1 ⇒ arma a distancia.
- `RequiredStrength = REQ_STRENGTH_EQUIP[equip]` (fuerza mínima para equipar; si no llegas → TooHeavy).
- `MissileType` (`GetMissileType`): Sling→Rock, FlamingOil→Red, ThrowingAxe/MagicAxe→Axe, resto con
  range>0 → Arrow; range 0 → None.

Offsets en DATA.OVL (`References/DataOvlReference.cs:2223-2253`):

| Chunk | Offset | Tamaño | Contenido |
|---|---|---|---|
| ENEMY_STATS | 0x13CC | 0x30×8 | 48 enemigos × 8 bytes (ver 1.8) |
| ENEMY_FLAGS | 0x154C | 0x30×2 | 48 × 2 bytes bitmap de habilidades |
| ENEMY_ATTACK_RANGE | 0x15AC | 0x30 | rango de ataque 1..9 por enemigo |
| ENEMY_RANGE_THING | 0x15DC | 0x30 | tipo de proyectil por enemigo |
| ENEMY_FRIENDS | 0x16E4 | 0x30 | índice del enemigo "amigo"/secundario |
| ENEMY_THING | 0x1714 | 0x30 | (leído pero sin uso claro) |
| ATTACK_VALUES | 0x160C | 0x37 | daño base por equipo |
| DEFENSE_VALUES | 0x1644 | 0x2F | defensa por equipo |
| ATTACK_RANGE_VALUES | 0x1674 | 0x37 | rango por equipo |
| SPELL_ATTACK_RANGE | 0x16AD | 0x37 | rango de hechizos |
| REQ_STRENGTH_EQUIP | 0x1ABE | 0x2F | fuerza requerida por equipo |

### 1.8 ENEMY_STATS: 8 bytes por enemigo (48 enemigos)

`References/MapUnits/NonPlayerCharacters/EnemyReference.cs:12` y `GetStat` (línea 179):
`byte = ENEMY_STATS[monsterIndex*8 + campo]`.

| Byte | Campo | Uso |
|---|---|---|
| 0 | Strength | sumado al daño del enemigo al atacar |
| 1 | Dexterity | iniciativa + probabilidad de que le acierten (defensa en `IsHit`) |
| 2 | Intelligence | almacenado; no usado en combate en Redux |
| 3 | Armour | `Defense` del enemigo (resta al daño recibido) |
| 4 | Damage | `AttackStat` del enemigo (base de su daño) |
| 5 | Hitpoints | HP máx e inicial |
| 6 | MaxPerMap | máximo de esa criatura por mapa |
| 7 | Treasure | número/tipo de tesoro que suelta (`TreasureNumber`) |

Al instanciar (`Enemy.cs:78`): Level=1, dex/int/str/HP desde stats, CurrentHp=MaxHp, XP y MP a 0.
Rango de ataque = `ENEMY_ATTACK_RANGE[i]`; si es 1 → melee sin proyectil, si >1 → `MissileType` =
`ENEMY_RANGE_THING[i]`. `Experience` que otorga al morir viene de `AdditionalEnemyFlags` (JSON), no
de este bloque (ver 1.11).

### 1.9 ENEMY_FLAGS: 16 bits de habilidades

`ENEMY_FLAGS` = 2 bytes por enemigo, leídos big-endian bit a bit MSB-first
(`Data/DataChunk.cs:287` `GetAsBitmapBoolList`: bit 0 = 0x80 del byte 0 … bit 15 = 0x01 del byte 1).

Mapa de máscara→habilidad **autoritativo** (comentario en `EnemyReference.cs:25-40`, coincide con
el U5 original):

| Máscara (16-bit) | Habilidad | Efecto |
|---|---|---|
| 0x8000 | Bludgeons | ataque contundente |
| 0x4000 | PossessCharm | puede embrujar/poseer (Charm) |
| 0x2000 | Undead | no-muerto (afectable por repel undead) |
| 0x1000 | DivideOnHit | se divide al ser golpeado (slimes) |
| 0x0800 | Immortal | inmortal |
| 0x0400 | PoisonAtRange | envenena a distancia |
| 0x0200 | StealsFood | roba comida |
| 0x0100 | NoCorpse | no deja cadáver/loot |
| 0x0080 | RangedMagic | dispara rayo mágico a distancia |
| 0x0040 | (ranged attacks) | ataques a distancia |
| 0x0020 | Teleport | se teletransporta |
| 0x0010 | DisappearsOnDeath | desaparece al morir (sin loot) |
| 0x0008 | Invisibility | invisible |
| 0x0004 | GatesInDaemon | invoca daemons |
| 0x0002 | Poison | envenena en melee |
| 0x0001 | InfectWithPlague | infecta con plaga |

**GAP — verificar contra DOSBox (bug de Redux)**: el `enum EnemyAbility` tiene solo **15** entradas
(0..14) pero hay 16 bits, y omite una habilidad separada para 0x0040 ("ranged attacks"). El bucle
lee `enemyFlags[(int)ability]` para 0..14, así que a partir del bit 9 el enum queda **desplazado un
bit** respecto a la tabla de máscaras: `Teleport` lee 0x0040, `DisappearsOnDeath` lee 0x0020,
`Invisibility` lee 0x0010, `GatesInDaemon` lee 0x0008, `Poison` lee 0x0004, `InfectWithPlague` lee
0x0002, y el bit 0x0001 no se lee nunca. **Para nuestro clon usar la tabla de máscaras de arriba,
no el orden del enum de Redux.**

Uso de flags en runtime:
- `CanPassThroughWalls`, `CanFlyOverWater`, `IsWaterEnemy`, `IsSandEnemy` → determinan tiles
  transitables (`Enemy.CanMoveToDumb`, `CombatMap.GetWalkableTypeByEnemy`).
- `DivideOnHit` → `PerformAdditionalHitProcessing`: si es golpeado (no muerto) y `OneInXOdds(2)`,
  `DivideEnemy` crea una copia en una celda adyacente libre y la añade a la iniciativa.
- `StealsFood` → en el ataque, si `DidEnemyStealFood()` (1 de 4), roba `DEFAULT_FOOD_STOLEN=5`.
- `NoCorpse` / `DisappearsOnDeath` / water enemy → sin loot (1.10).
- `RangedMagic`/ranged → usan `AttackRange` y `MissileType` para atacar sin acercarse.

Nota: varias de estas (Charm, Undead, Teleport, GatesInDaemon, Immortal) se **leen pero no tienen
efecto de combate** implementado en Redux → GAP si las queremos activas.

### 1.10 Muerte de enemigos y loot

Al matar un `Enemy` (no un PJ) en `CombatMapUnit.Attack` (línea 329):
- `TotalKills++`, `AdditionalExperience += enemy.Experience`.
- `OddsAndLogic.GetIsDropAfterKillingEnemy` (`OddsAndLogic.cs:198`): si el enemigo es
  NoCorpse / acuático / DisappearsOnDeath → nada. Si no, tira de una lista ponderada:
  **Chest peso 3, BloodSpatter peso 6** (`GenericDropAfterKillingEnemy`). (El comentario indica que
  el reparto real por tipo de enemigo está pendiente → GAP, drop genérico por ahora.)
- El drop se materializa como `NonAttackingUnit` en la celda del muerto.

Contenido de cofres/cadáveres y **trampas** (`OddsAndLogic.cs`):
- Cofre nuevo bloqueado: `ODDS_CHEST_LOCKED = 0.2`. Trampa: `ODDS_SIMPLE_TRAP_ON_CHEST=0.2`,
  y si no, `ODDS_COMPLEX_TRAP_ON_CHEST=0.2`.
- Tipo de trampa de cofre (ponderado): **Acid 9, Sleep 3, Poison 3, Bomb 1**, y "None" con peso =
  suma de las anteriores (= 16). Coincide con el reparto clásico C64/U4 del comentario al pie del
  fichero (Acid 9/16, Sleep 3/16, Poison 3/16, Bomb 1/16).
- ¿Explota al abrir? `DoesChestTrapTrigger` (línea 145):
  `prob = max(BASE - dexterity*0.01, 0)` con `BASE`= 0.2 (simple) / 0.4 (compleja). Más dexterity →
  menos probable disparar la trampa.
- Daños de trampa (`CharacterStats.ProcessTurn*`): Acid `3..10`, Bomb `3..10`, Electric `3..10`,
  Poison `1..1` por turno mientras envenenado. Sleep → estado Asleep.
- Cadáver/blood spatter: tesoro con `0.2`; trampa de veneno (con `AGGRESSIVE_TRAP_MODIFIER=100` que
  la hace casi segura si `AGGRESSIVE_TRAPS=true`).
- Jimmy (ganzúa): `IsJimmySuccessful` → falla 1 de 5 (`ONE_IN_OF_BROKEN_KEY=5`).

### 1.11 Fin de combate, XP y quién la gana

- `AreEnemiesLeft` / `NumberOfEnemies` controlan si el combate sigue.
- La XP se acumula en `CombatStats.AdditionalExperience` **del PJ que da el golpe mortal**
  (`CombatMap`/`CombatMapUnit.Attack`). El valor por enemigo = `AdditionalEnemyFlags.Experience`
  (JSON `AdditionalEnemyFlags`, no el bloque de 8 bytes). Ejemplos del CSV
  (`DataFiles/AdditionalEnemyFlags.csv`): Wizard 3, Bard 4, Fighter 6, Villager/Merchant/Jester 3.
- **GAP — verificar contra DOSBox**: `AdditionalExperience` nunca se vuelca a
  `PlayerCharacterRecord.Stats.ExperiencePoints`, y **no existe lógica de subida de nivel** en Redux
  (ver 3). En U5 la XP se otorga al party y el nivel sube visitando a Lord British.

### 1.12 Huida (bordes del mapa)

Del jugador (`TryToMakePlayerEscape`, línea 1735): al intentar salir se fija el `EscapeType` (North/
South/East/West/EscapeKey/KlimbDown/KlimbUp). **Todos los PJ deben usar la misma salida**: si un PJ
ya escapó por el norte, el resto debe salir por el norte o se rechaza ("All must use the same
exit!"). `NextCharacterEscape` marca `HasEscaped` al siguiente PJ.

Del enemigo (`ProcessEnemyTurn`, línea 1528, rama fleeing):
- Un enemigo huye si `IsFleeing` (HP<24) o si no ve a ningún PJ, **salvo** que sea `DoesNotMove`
  (p.ej. Reaper: nunca huye, siempre ataca).
- Si está en un tile de borde (x==0 || x==max || y==0 || y==max) → sale del mapa:
  `CurrentHp = 0` + "escaped!" (se le trata como fuera de combate).
- Si no, calcula `GetEscapeRoute` (A* al borde más cercano transitable) y avanza un paso por turno.
  Si no hay ruta, cae a atacar como último recurso.

### 1.13 IA de enemigo (resumen `ProcessEnemyTurn`)

1. Charmed → lo controla el jugador (pide input). Sleeping → salta turno.
2. Fleeing / no ve PJs → intenta huir (1.12).
3. Objetivo: reutiliza `PreviousAttackTarget` si sigue vivo y en rango (melee: `CanReachForMeleeAttack`
   con `AttackRange`; ranged: `!IsRangedPathBlocked`); si no, `GetClosestCombatPlayerInRange`.
   Ignora objetivos invisibles/charmed/muertos.
4. Si hay objetivo en rango → ataca (melee o ranged; ranged fallado puede impactar a otro con
   `HandleRangedMissed`). Si roba comida y toca, la roba.
5. Si no hay objetivo en rango y no es `DoesNotMove` → `MoveToClosestAttackableCombatPlayer` (A*).

Melee direccional: el "rango" melee es Chebyshev (`CanReachForMeleeAttack`,
`CombatMapUnit.cs:367`): `|dx| <= range && |dy| <= range`, así que **con range 1 las 8 celdas
adyacentes (incluidas diagonales) son alcanzables**. Ranged usa distancia + raycast
(`IsRangedPathBlocked` con `Raytrace`) y `RangeWeapon_Passable` de cada tile intermedio.

### 1.14 Spawning de encuentros en overworld

`Maps/LargeMap.cs:122` `GenerateAndCleanupEnemies(oneInXOddsOfNewMonster, nTurn)` + `World.cs:514`:
- Se llama cada avance de tiempo en large map. Primero `ClearEnemiesIfFarAway` borra enemigos a más
  de ~22 tiles (con wrap-around) del Avatar; si ya hay `MAX_MAP_CHARACTERS` en el mapa, no genera.
- Probabilidad de generar un nuevo monstruo: **plana, 1 de 16** (`VirtualMap.OneInXOddsOfNewMonster
  = 16`, `Utils.OneInXOdds(16)`). **GAP — verificar contra DOSBox**: Redux **no** varía la
  probabilidad por terreno ni por hora del día; el original sí tenía tablas de generación por
  terreno/tiempo. Aquí el terreno solo filtra *qué* enemigo, no *cuántas veces*.
- Colocación (`CreateRandomMonster`, línea 207, "borrowed from xu4"): hasta 10 intentos; a
  `nDistanceAway=7` tiles del Avatar con signo y ejes aleatorios (`OneInXOdds(2)` para negar X, negar
  Y y hacer swap). Si el tile está libre, se elige el enemigo con
  `GetRandomEnemyReferenceByEraAndTile(nTurn, tile)`.

**Sistema de eras** (`OddsAndLogic.cs:37,175` + `EnemyReference.GetEraWeightByTurn`):
`BeginningOfEras = {0, 10000, 30000}` (en turnos). `GetEraByTurn`: turno <10000 → era 0, <30000 →
era 1, resto → era 2. Cada enemigo tiene `Era1Weight/Era2Weight/Era3Weight` (JSON
`AdditionalEnemyFlags`); solo entran al pool los de peso >0 en la era actual, y de ellos los que
`CanGoOnTile(tile)` (agua/arena/tierra + `IsMonsterSpawnable` + `CombatMapIndex` compatible). El
enemigo final se elige uniformemente entre los candidatos. Es decir: **a más turnos jugados, enemigos
más duros** (progresión temporal, no por hora del reloj).

---

## 2. Mazmorras

Estado en Redux: `Maps/DungeonMap.cs` renderiza el piso 8×8 como small map cenital
(`GetDefaultDungeonMap` mapea cada tipo de celda a un sprite) y **no** implementa la vista 3D, el
avance por celdas, giros de 90°, trampas, fuentes, campos, puertas secretas, escaleras interactivas
ni salas→combate. `GetNonCombatMapAggressiveMapUnitInfo` devuelve `null` ("not yet implemented").
Por tanto: **casi todo el comportamiento de mazmorra es GAP — verificar contra DOSBox**. Lo que SÍ
tenemos es el **modelo de datos completo** para re-implementarlo.

### 2.1 Formato del piso de mazmorra

`Maps/SingleDungeonMapFloorReference.cs`: cada mazmorra = 8 pisos; cada piso = 8×8 = 64 bytes
(`N_DUNGEON_ROWS_PER_MAP=8`, `N_DUNGEON_COLS_PER_ROW=8`, `N_BYTES_PER_FLOOR=64`). Una mazmorra
completa = `64 × 8 = 512` bytes (`DungeonMapReference.N_BYTES_PER_DUNGEON`). 8 mazmorras
(`N_DUNGEONS=8`) en `DUNGEON.DAT`.

Cada byte de celda se parte en dos nibbles (`SingleDungeonMapFloorReference` línea 41):
`tileType = (byte >> 4) & 0xF`, `subType = byte & 0xF`.

### 2.2 Tipos de celda (`DungeonTile.cs:46`)

| Valor | TileType | Subtipo (nibble bajo) |
|---|---|---|
| 0x0 | Nothing | si subType==0x8 → en realidad LadderUp |
| 0x1 | LadderUp | LadderTrap: 0=NoTrap, 8=IsTrapped |
| 0x2 | LadderDown | idem |
| 0x3 | LadderUpDown | idem |
| 0x4 | Chest | ChestType |
| 0x5 | Fountain | FountainType |
| 0x6 | Trap | TrapType |
| 0x7 | OpenChest | ChestType |
| 0x8 | MagicField | MagicFieldType |
| 0xA | RoomsBroke | — |
| 0xB | Wall | — |
| 0xC | SecondaryWall | muro "con esqueletos" |
| 0xD | SecretDoor | puerta secreta |
| 0xE | NormalDoor | — |
| 0xF | Room | subType = **RoomNumber** (índice de sala de combate) |

Subtipos:
- **ChestType**: Normal=0, Trapped_1=1, Trapped_2=2, Poisoned=4.
- **FountainType** (`char fountStr[3][7]`): CurePoison=0, Heal=1, PoisonFountain=2, BadTasteDamage=3.
- **TrapType**: LowerTrapVisible=0, BombTrap=1, InvisibleTrap=2, UpperTrapVisible=3.
- **MagicFieldType** (`char fieldStr[4][10]`): Poison=0, Sleep=1, Fire=2, Energy=3.
- **LadderTrap**: NoTrap=0, IsTrapped=8.

Mensajes de muro (`WallText`, línea 98): ciertos subtipos de wall llevan texto ("THE MAZE OF LOST
SOULS", "THE PRISON WRONG", "THE CRYPT", "MOTHER LODE MAZE", etc.) indexados por
`_messageStarts = {0,1,-1,2,3,7,10,-1}`.

### 2.3 Comportamiento esperado por celda (a re-derivar del original)

Todo lo siguiente es **GAP — verificar contra DOSBox**; el modelo de datos de 2.2 es la guía:
- **Movimiento**: avanzar/retroceder en la dirección de vista, girar 90° izq/der. Vista 3D por
  raycast de celdas (Wall/SecondaryWall bloquean; NormalDoor/SecretDoor son atravesables al abrirse).
- **Trampas (Trap 0x6)**: daño al pisar según `TrapType`. Escaleras con `LadderTrap.IsTrapped` (0x8)
  dañan al usarlas.
- **Fuentes (Fountain 0x5)**: efecto por `FountainType` — CurePoison, Heal, PoisonFountain (envenena),
  BadTasteDamage (daño).
- **Cofres (Chest 0x4 / OpenChest 0x7)**: loot + trampa según `ChestType` (usar lógica de 1.10).
- **Campos mágicos (MagicField 0x8)**: Poison/Sleep/Fire/Energy — daño o estado al atravesar
  (mismos efectos que los campos de combate).
- **Puertas secretas (SecretDoor 0xD)**: se revelan buscando (Search) o con hechizo; hasta entonces
  se ven como muro. **Cómo se revelan exactamente → verificar contra DOSBox.**
- **Escaleras (LadderUp 0x1 / LadderDown 0x2 / UpDown 0x3)**: cambian de piso. Klimb up en piso 0 →
  salir al overworld (a la posición de la mazmorra en `DungeonPositionsOverworld.csv`).
- **Salas (Room 0xF)**: al entrar, `RoomNumber` (subType) → índice de mapa en `DUNGEON.CBT`.

### 2.4 Salas de combate en mazmorra (Room → DUNGEON.CBT)

- Hay 112 mapas de combate de mazmorra = **16 salas × 7 mazmorras** (`N_ROOMS_PER_DUNGEON=16`;
  Despise no tiene salas, por eso 7 y no 8). `SingleCombatMapReference.GetDungeonMapReference`
  (`SingleCombatMapReference.cs:352`) calcula la mazmorra:
  `location = Deceit + CombatMapNum / 16`, saltando Despise.
- El `RoomNumber` de la celda `Room 0xF` indexa el mapa de combate dentro de `DUNGEON.CBT`. En ese
  .CBT los 16 slots de map-unit son enemigos/campos **fijos** (`AutoSelected`, no encuentro), y las
  8 trigger tiles definen los triggers de la sala (ver 2.5).
- El combate en sala usa el mismo motor de la sección 1 con `Territory.Dungeon`.

CSVs de apoyo (en `DataFiles/`, **exports de referencia del autor, NO cargados por el runtime** — no
hay código que los lea; nos sirven de tabla de verdad para nuestra implementación):
- `DungeonRooms.csv` — columnas `Dungeon, X, Y, Floor, RoomNumber`: 198 filas; ubica cada tile
  disparador de sala (posición X,Y en un piso concreto) y su número de sala. Recuento por mazmorra:
  Deceit/Destard/Doom/Hythloth/Shame 16, Wrong 36, Covetous 82 (varias entradas por sala).
- `DungeonRoomAccess.csv` — `Dungeon, RoomNum, X, Y, Floor, Direction, Comment, Instruction`: cómo se
  entra a cada sala. `Direction` = borde por el que entra el party (North/South/East/West);
  `Instruction` = acción que la dispara: **Forward** (avanzar, mayoría), **KlimbDown**, **KlimbUp**.
  Determina la `EntryDirection` del mapa de combate (posiciones de salida de los 6 PJs).
- `DungeonCombatMapReferences.csv` / `DungeonCombatMapDetails.csv` — metadatos de los 112 mapas de
  combate de mazmorra (direcciones válidas, escaleras up/down, triggers, puerta con cerradura/mágica,
  `SpecialEnemyComputation`, `IsBroke`, notas del autor sobre datos dudosos).

### 2.5 Triggers de sala

Definidos en cada mapa .CBT (sección 1.1): 8 trigger tiles, cada uno con sprite, posición y dos
tiles destino que cambia al activarse. En combate (`CombatMap.HandleTrigger`, línea 855): al pisar/
atacar la posición del trigger se sustituyen los tiles destino (`SetOverridingTileReference`), p.ej.
subir un rastrillo (Portcullis) o abrir un paso. `TriggerTileData.Triggered` evita re-disparo.

### 2.6 Luz, monstruos errantes, salida

**GAP — verificar contra DOSBox** (Redux fuerza todo visible en mazmorra,
`DungeonMap.RecalculateVisibleTiles` pone todo a `true`):
- **Antorchas/luz**: radio de visión limitado que consume antorchas; sin luz, visión mínima.
- **Monstruos errantes**: aparición de criaturas moviéndose por los pasillos entre celdas.
- **Salida**: `Klimb` up en el piso 0 (nivel más alto de la mazmorra) → overworld, en la posición de
  la entrada de la mazmorra (`DungeonPositionsOverworld.csv`).

---

## 3. XP y subida de nivel

**GAP — verificar contra DOSBox: NO implementado en Redux.** No existe fórmula de XP-por-nivel ni
código que suba nivel, HP o stats. Lo confirmado en el código:

- `CharacterStats` (`PlayerCharacters/CharacterStats.cs`): campos `ExperiencePoints`, `Level`,
  `MaximumHp`, `Strength/Dexterity/Intelligence` (rango 1..50 por el layout del save), pero ningún
  método los incrementa por combate.
- Layout del save (`PlayerCharacterRecord.cs:403`): exp points `0x14` (uint16, 0..9999), level `0x16`
  (byte, **1..8**). Nivel máximo = **8**.
- `MaximumMp` por clase (`CharacterStats.GetMaximumMp`): Avatar/Mage = Intelligence, Bard =
  Intelligence/2, Fighter = 0.
- La XP ganada en combate queda en `CombatStats.AdditionalExperience` y se pierde al no volcarse.

**Fórmula del U5 original (a implementar y verificar en DOSBox)**: en Ultima V la XP se otorga al
party entero; los personajes suben de nivel visitando a **Lord British** en Britannia, no
automáticamente. El nivel N típicamente requiere `100 × N` puntos de experiencia (nivel máx 8, es
decir ~800 XP), y al subir se incrementan HP máximos (y stats vía entrenamiento). **Confirmar
umbrales exactos, ganancia de HP por nivel y si LB sube de uno en uno contra el ejecutable.**

---

## Apéndice — ficheros clave

| Tema | Fichero:línea |
|---|---|
| Odds/probabilidades del motor | `Ultima5Redux/OddsAndLogic.cs` |
| Bucle de combate, turnos, IA | `Maps/CombatMap.cs` |
| Iniciativa por dexterity | `Maps/InitiativeQueue.cs` |
| Hit/daño/estados de herida | `MapUnits/CombatMapUnits/CombatMapUnit.cs:40,185,199,211` |
| Armas del PJ / dual-wield | `MapUnits/CombatMapUnits/CombatPlayer.cs:99` |
| Enemigo (instancia, movimiento) | `MapUnits/CombatMapUnits/Enemy.cs` |
| Enemy reference (stats/flags 8B/16b) | `References/MapUnits/NonPlayerCharacters/EnemyReference.cs` |
| Flags adicionales (era, XP) | `References/MapUnits/NonPlayerCharacters/EnemyReferences.cs` + `DataFiles/AdditionalEnemyFlags.csv` |
| Valores de armas (ATTACK/DEFENSE) | `References/PlayerCharacters/Inventory/CombatItemReference.cs` |
| Offsets DATA.OVL | `References/DataOvlReference.cs:2223-2253` |
| Selección de .CBT por terreno | `Maps/RegularMap.cs:605`, `Maps/LargeMap.cs:400-510` |
| Formato .CBT | `References/Maps/SingleCombatMapReference.cs:189` |
| Spawn overworld (1 de 16) | `Maps/LargeMap.cs:122,207` + `Maps/VirtualMap.cs:21` |
| Modelo de datos de mazmorra | `References/Maps/DungeonTile.cs`, `Maps/SingleDungeonMapFloorReference.cs` |
| Mazmorra runtime (incompleta) | `Maps/DungeonMap.cs` |
| CSVs de salas de mazmorra | `DataFiles/DungeonRooms.csv`, `DungeonRoomAccess.csv`, `DungeonCombatMap*.csv` |
