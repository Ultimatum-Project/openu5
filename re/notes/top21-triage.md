# Triaje del TOP-21 — frontera SIN IDENTIFICAR del censo (task #34)

Deriva de #33 (`re/notes/routine-census.md`, main `5cbf143`): de 846 rutinas del
binario, 21 de **código de juego** quedaron SIN IDENTIFICAR = la frontera honesta de
features posiblemente no portadas. Aquí cada una se triaja: **qué hace** (derivado del
ASM) + **¿la cubre el port?** + veredicto. Método: derivación estática sobre
`re/disasm/*.asm` con la regla de resolución de `overlay-load-layout.md`; comprobación
de cobertura por lectura/grep de `game/src`. Sin tocar :5199/dosbox.

## Veredicto global

**Ninguna de las 21 es una feature de gameplay ausente por sorpresa.** El desglose:

| # rutinas | veredicto | qué son |
|---:|---|---|
| 11 | COVERED / HELPER | glue mecánico o helpers de features ya portadas y (varias) ya citadas |
| 4 | COVERED (arquitectura distinta) | internals del intérprete TLK — el port los cubre vía extracción offline + VM de opcodes |
| 2 | glue no-feature | PIC get-IP (FLAMES 0x000e), DOS get-vector (ULTIMA 0x72f5) |
| 1 | COVERED-estructural | composición del viewport 16×16 (OUTSUBS 0x0098) — capa de render del port |
| **3** | **GAP / PARTIAL real** | ver abajo — 1 nuevo, 2 ya rastreados en otras tareas |

Los **3 con divergencia real** son:

1. **GAP nuevo — Movimiento de actores de overworld por CLASE DE TILE** (clúster MAINOUT).
   El port mueve TODOS los enemigos errantes con una única persecución codiciosa
   (`world/enemies.ts tick`), pero el binario despacha por clase de tile en
   **MAINOUT 0x198c** (`move_one_actor`): remolinos a la deriva diagonal aleatoria,
   naves pirata con cadencia gobernada por el VIENTO, y una rama multi-paso. Detalle
   abajo (§A). **Es el único hallazgo nuevo del triaje.** Requiere paridad de RNG →
   candidato a sub-tarea con testigo del oráculo, NO parche a ciegas.

2. **GAP ya rastreado — bitmap de sala consumida de mazmorra** (DNGLOOK 0x08d4, DS:0x58E0).
   El port trata `Room`(0xF) y `RoomsBroke`(0xA) idénticos → las salas de mazmorra ya
   limpiadas **re-disparan** combate; falta la transformación de vista `0xFn→0xAn`.
   Solapa con el pendiente conocido de mazmorras (`dungeon-rooms-audit.md §E3c`).

3. **PARTIAL ya rastreado — guard_wander no cableado en vivo** (TOWN 0x0c4a).
   La lógica está portada y es RNG-exacta (`world/loops/guards.ts`) pero no se tickea
   en small maps: el clon aún no rastrea objetos-guardia (owner-flag F.2, `turn.ts:229`).

---

## §A. Clúster MAINOUT de AI de overworld (el hallazgo nuevo)

`MAINOUT 0x198c = move_one_actor(idx)` — despacho por la base de sprite del actor
`[idx<<3 + 0x5c5a]` (tabla de 32 actores × 8 B; x en +0x5c5c, y en +0x5c5d):

- **base&0xfc == 0xec (REMOLINO)** → `0x16fc`: elige 1 de 4 diagonales por
  `rand→[0..3]` (kernel 0x9ec2 [= CS 0x2092 → ULTIMA.EXE:0x2092 (entrada interior)] con arg 3) y deriva a esa casilla. **Deriva diagonal
  ALEATORIA**, con un bit de fase en +0x5c5f (mueve un turno sí/otro no).
- **base&0xfc == 0x2c (NAVE PIRATA)** → cadencia por VIENTO: si `g_wind==0` no mueve;
  si no, `tabla 0x2bf6[(base-0x2c)<<3 + wind<<1]` gobierna cada cuántos turnos avanza
  (contador +0x5c61); el avance en sí es `0x17d4` (persecución). Valor 4 = siempre.
- **base == 0xfc** → `0x14ea`: gate de RANGO (|dx|,|dy| con wrap 256; actúa según
  cercanía ≤6) + contador +0x5c5f con tope 0x14 (20).
- **else (monstruo genérico)** → `0x17d4`: persecución codiciosa hacia el party
  (Δ con wrap 256, eje mayor primero).

Helpers del clúster: **0x1482** = `can_move_to(idx,x,y)` (get_tile_ptr→pasabilidad
0xaa7c→ocupación 0xb532); **0x14c8** = guarda de casilla reservada ([0xa526]/[0xa527]).

### Cobertura del port
- Persecución genérica `0x17d4` → **COVERED**: `game/src/core/world/enemies.ts:122-143`
  (paso codicioso, eje mayor primero, wrap).
- Pasabilidad/ocupación `0x1482` → **COVERED**: `enemies.ts:151-157` `canEnter`.
- Spawn de remolinos y naves pirata → **existen**: `combat/encounters.ts:159` (whirlpool
  id 0xec, `rand(0,7)==7`) y `:241` (nave pirata id 0x2c → tile 0x12c).
- **PERO** el movimiento en `enemies.ts tick` es UNIFORME: mueve remolinos y naves como
  perseguidores codiciosos. **Faltan**: (a) deriva diagonal aleatoria del remolino
  (`0x16fc`), (b) cadencia por viento de la nave pirata (`0x2c`/tabla 0x2bf6), (c) el
  gate de rango 0xfc (`0x14ea`). `world/wind.ts` gobierna la vela del JUGADOR
  (`g_sail_dir`), no el AI de las naves NPC.

### Impacto y riesgo del fix
Visible para el jugador: el remolino te persigue en línea (debería derivar), los piratas
te alcanzan igual con viento en contra (debería frenarlos). PERO el fix es **core y
sensible a RNG**: el binario CONSUME rand en `0x16fc` (deriva) que el port hoy NO rueda,
así que el stream de RNG del turno YA diverge cuando hay remolinos/actores especiales.
Un fix fiel debe replicar el ORDEN exacto de consumo de RNG de `0x198c` → requiere
**testigo del oráculo** (no parche a ciegas). Recomendación: sub-tarea con paridad, no
edición autónoma. Especificación de arriba lista para implementar en cuanto se apruebe.

---

## §B. Tabla completa de las 21

| # | rutina | qué es (derivado) | veredicto | evidencia port / nota |
|---:|---|---|---|---|
| 1 | MAINOUT 0x17d4 | persecución genérica hacia party (Δ wrap) | COVERED | enemies.ts:122 |
| 2 | MAINOUT 0x16fc | **remolino: deriva diagonal aleatoria** | **GAP** | falta en enemies.ts tick (§A) |
| 3 | MAINOUT 0x14ea | gate de rango del actor 0xfc | **GAP/PARTIAL** | no hay rama por clase (§A) |
| 4 | MAINOUT 0x1482 | can_move_to (pasabilidad+ocupación) | COVERED | enemies.ts:151 canEnter |
| 5 | MAINOUT 0x14c8 | guarda de casilla reservada | COVERED | subsumido en canEnter/ocupación |
| 6 | MAINOUT 0x0d8c | umbral de spawn de encuentro overworld | COVERED | world/loops/spawn.ts:37 (wired game.ts:1342) |
| 7 | DNGLOOK 0x08d4 | test bitmap sala-consumida (DS:0x58E0) | **GAP** | dungeon.ts trata Room=RoomsBroke igual → re-trigger; solapa E3c |
| 8 | TOWN 0x0c4a | predicado vecino de guard_wander | PARTIAL | guards.ts portado, no live-wired (F.2) |
| 9 | TALK 0x0728 | tokenizer: scan hasta delimitador | COVERED | extractor offline (tlk.ts) |
| 10 | TALK 0x099a | seek a la N-ésima sección de keyword | COVERED | conversation.ts:247-333 (Map QA) |
| 11 | TALK 0x07be | handler de opcode TLK (Gold 0x85, inferido) | COVERED | conversation.ts:413 (Gold) |
| 12 | TALK 0x07e4 | opcode 0x81 AvatarsName (imprime 0x55a8) | COVERED | conversation.ts:399 |
| 13 | COMSUBS 0x0e26 | rasterizador Bresenham de proyectil | COVERED (helper) | skin/fiel/combat.ts:230 (interpola lineal — cosmético) |
| 14 | COMSUBS 0x0458 | distancia euclídea al cuadrado | COVERED | core/combat/formulas.ts:221 (ya citado) |
| 15 | DNGLOOK 0x0b9e | drawer por dirección de la vista 3D | COVERED | render/dungeon3d.ts |
| 16 | CMDS 0x0788 | lookup de matriz de tile-property (X-it) | COVERED (helper) | world/transport.ts:376 (X-it) |
| 17 | ULTIMA 0x2bd4 | predicado de flag por tile (bitmap 0x54d4) | COVERED (helper) | world/movement.ts:76 isPassable |
| 18 | ULTIMA 0x2c2e | clasificador de tile (agua/0x6x) | COVERED (helper) | TileData / movement.ts |
| 19 | OUTSUBS 0x004a | predicado de clase de tile (tabla 0x386e) | COVERED (helper) | de 0x0098 (viewport) |
| 20 | OUTSUBS 0x0098 | composición del viewport 16×16 (DS:0x6608) | COVERED-estructural | render/renderer.ts (render propio) |
| 21 | FLAMES 0x000e | get-IP (PIC self-locate) | no-feature | glue |
| — | ULTIMA 0x72f5 | INT 21h AH=35h get-vector (CRT) | no-feature | glue |

(20 filas + 2 glue kernel = las 21 de juego; FLAMES/ULTIMA glue son 2 de esas 21.)

### Divergencias menores anotadas (no gaps)
- Join-party: **YA NO HAY DIVERGENCIA** (corregido 08-08, ficha #109). Esta fila decía
  «string del port "Thy party is full." ≠ original "Thou hast no room for me in thy
  party!" — divergencia deliberada ya documentada (`dialogue/effects.ts:10`)», y las DOS
  mitades eran falsas: la del port desde `58413c38` (que retiró las cuatro cadenas
  FABRICADAS del alistamiento y calcó las tres salidas reales de `join_party`), y la cita
  desde siempre — `dialogue/effects.ts:10` habla de `KarmaMinusOne`, no del join. Hoy
  `core/party.ts` emite DS 0x9348 + DS 0x9372 por separado, como el binario.
- Opcode TLK Pause (0x83): el port colapsa la animación de retratos durante la pausa —
  cosmético.
- Proyectil (COMSUBS 0x0e26): el port interpola lineal por celda en vez del path
  Bresenham por píxel — cosmético.
- OUTSUBS 0x0098: sustitución de tiles de display 0x16-0x18→0xdf, 0x19→0x1a — detalle
  de la capa de render; el renderer del port compone el viewport por su cuenta.

---

## Recomendación de acción

1. **Movimiento de actores por clase de tile (§A)** — único gap nuevo de gameplay.
   Abrir sub-tarea con **testigo del oráculo** para derivar el orden exacto de RNG de
   `MAINOUT 0x198c/0x16fc/0x14ea` e implementar la rama por clase en `enemies.ts` con
   gate de paridad. Prioridad media (visible pero acotado a remolinos/piratas).
2. **Bitmap de sala consumida (#7)** — plegar en el pendiente de mazmorras E3c
   (`dungeon-rooms-audit.md`); no duplicar.
3. **guard_wander live-wire (#8)** — ya es F.2; sin acción nueva.
4. El resto (17/21): cerrado como COVERED/HELPER/glue — sin trabajo.
