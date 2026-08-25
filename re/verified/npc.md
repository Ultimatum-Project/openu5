# Verificado: NPC + diálogo — NPC.OVL + TALK.OVL (Task 3.5)

Reglas re-derivadas del asm con citas (`re/notes/npc.md`) y portadas al clon
(`game/src/core/npc/manager.ts`, `game/src/core/time.ts`, `dialogue/*`). El arnés
de paridad `re/tools/test_npc_parity.py` cruza dos modelos INDEPENDIENTES del
mismo movimiento — la predicción asm-derivada en Python (`KernelRng` + reglas de
NPC.OVL) y la reproducción del core del clon (`game/src/core/__parity__/npc-run.ts`,
`OriginalRng`) — exigiendo que calquen TRAYECTORIA, spawn (schedule_index) y
semilla final. Misma filosofía que test_dungeon_parity / test_rng_parity.

## Estado de la verificación (2026-07-10)

VERDE:
- `re/tools/test_npc_parity.py` — 14 passed (puros; sin dosbox) + 1 live
  (`test_world_tick_rng_orbit_live`, opt-in `U5RE_LIVE=1`, PASA en 131 s).
  KernelRng casa con la inversa VERIFICADA `parity.rng_unstep` (6 semillas);
  schedule_index reproduce los casos del listado 0x1308-0x1321; los 11 escenarios
  cruzan trayectoria + spawn + semilla clon↔modelo (5 wander + 6 schedule_index).
  El wander usa la dirección con span 65 (`rand(0,64)`) y el gate de planta 0x1251.
- `npm test -w game` — 484 passed (npc.test.ts + time.test.ts a las mecánicas  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  exactas: radio Manhattan 3, schedule_index byte-sub; + dialogue-effects.test.ts
  con karma cap/floor, gold-demand con fondos y JoinParty máx 6).
- Suite RE requerida — sin regresiones (`pytest re/tools -k "not live"`, verde).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas

Con paridad de stream (KernelRng↔OriginalRng) o listado asm reproducido. Citas en
`re/notes/npc.md`:
- **schedule_index** (§0.3, 0x12E0): argmin de `(hour - times[k]) & 0xFF`;
  empates al índice menor; **índice 3 remapea a la posición 1** (quirk). Portado
  byte a byte; reproduce todos los casos del asm y los tests del clon.
- **Distancia = MANHATTAN** (§3.1, 0x06A0): `|dx|+|dy|` (el clon usaba Chebyshev).
- **Wander** (§4.1, 0x0C50): consumo de RNG EXACTO — `rand(0,255)&8` (skip ~50%,
  1 rand) y, si se mueve, `rand(0,64)&3 + 1` (span 65, dirección BLINDA, 2 rands). Radio
  Manhattan; **big-wander pasa maxdist=0 = SIN LÍMITE** (verificado por la
  decodificación de 0x0D38→0xd66 y la jump-table).
- **Jump-table de aiType 0..7** (§4.0, 0x0D00): decodificada byte a byte
  (0=fixed, 1=wander(3), 2=big-wander(∞), 3/6=run-away `dist<4`, 4=merchant,
  5/7=flee). El clon dispatchea los 8 tipos (antes 4/6/7 = wander).
- **Gate de planta** (§1, 0x1251-0x1259): `npc_ai_step` (wander + su RNG) sólo
  corre para NPC en la planta del jugador (`cmp [bx+6],g_floor; jne skip`);
  portado en `manager.ts` y en el modelo/escenarios de paridad.

## ⚠️→formulado (asm-derivado + cruce modelo↔clon; paridad runtime pendiente)

Reglas con cita asm y/o cruce modelo↔clon, pero SIN verificación runtime contra
DOSBox (convención de 3.2/3.3/3.4; los reviewers lo comprueban con lupa). El
oráculo no se corrió en esta sesión para evitar contención con otros agentes; el
canal de paridad runtime (teleportar NPCs por write_mem y leer los arrays
0x5F5E… turno a turno mientras se aísla el stream de rand compartido con el resto
del mundo) requiere un arnés dedicado, como el live de mazmorra.
- **Wander / schedule_index / Manhattan / jump-table**: la paridad es
  modelo↔clon (Python asm-derivado ↔ core del clon), no runtime DOSBox. Anclada
  además por el listado asm citado. Cierra ✅ de fidelidad de mecánica, pero el
  ⚠️ de paridad runtime queda abierto hasta correr el oráculo.
- **Consumo de RNG multi-NPC por turno** (§1): el stream compartido lo consume el
  wander de cada NPC en orden de slot; la paridad prueba UN NPC por escenario. El
  ordenamiento exacto del bucle npc_tick_all (interacción con el estado 1-7, el
  escáner de ruta y el contador stuck) NO está reproducido — divergencia de
  alcance como el idle de kernel-survival y el movimiento de IA de combate 3.2.
- **Pathfinding** (§4.2): binario = escáner voraz `npc_scan` (0x032C) con buffer
  pre-computado; el clon aproxima con A* (`findPath`) → trayectorias y desempates
  distintos al acercarse al puesto.
- **Cambio de planta** (§2/§4.4): binario camina a una escalera (states 6/7) y
  kernel 0xD89A re-coloca; el clon TELETRANSPORTA. No portado (riesgo alto para
  la suite verde; la máquina de estados 6/7 + escáner + re-colocación es un
  subsistema propio).
- **Flee / run-away / merchant** (§4.0/§5): los UMBRALES Manhattan (`<4`) están
  portados exactos; la rutina de huida `npc_target_for_attack` (0x06E4) —
  selección de objetivo, `rand(0,0x3F)` umbral 0x10 de persecución types 5/7,
  marcas de proyectil — está ligada a la HOSTILIDAD (Task 3.9/3.10) y se aproxima
  con un paso greedy que aleja del party.
- **TALK.OVL — intérprete de bytes** (§9): el diálogo del clon sigue siendo el
  port de Redux (produce la misma conversación observable). El ORDEN exacto de
  efectos y el consumo de bytes del intérprete 0x0F32 NO están cotejados byte a
  byte. Los EFECTOS observables sí se aplican con las reglas exactas de TALK.OVL
  en `dialogue/effects.ts` (testeado, `tests/dialogue-effects.test.ts`): **karma
  ±1 con cap 99 / floor 0** (opcodes 0x89/0x8A), **JoinParty máx 6** ("no room",
  0x080A), **gold-demand con chequeo de fondos** ("Thou hast not enough!" si
  `gold<n`, 0x05B5). ⚠️ La CANTIDAD del gold-demand aún viene del extractor de
  Redux, no del encoding de 3 bytes tras el opcode.
- **NPC hardcode 0xFD/FE/FF** (§7/§8): Lord British, guardias, contraseña de
  Blackthorn — hooks claros, semántica en **Task 3.10**.
- **NPCs y puertas** (§13.12): el clon las trata transitables sin abrirlas
  visualmente; el binario las abre/cierra a su paso.

## Verificación runtime DOSBox (2026-07-10)

### ✅ RNG del world-tick — órbita EXACTA (test live que PASA)

`test_npc_parity.py::test_world_tick_rng_orbit_live` (opt-in `U5RE_LIVE=1`) —
**1 passed** (131 s). Boot del oráculo, 6 turnos de mundo (RIGHT +
`wait_gameseg_change` sobre el minuto), leyendo `g_rng_seed` (0x5420) tras cada
turno. Resultado literal:
```
world-tick seeds: ['0x83a9','0xb107','0x7a32','0xd3d8','0x9e9d','0x2aae','0x45e7']
```
Cada semilla es un paso-forward `_raw16` EXACTO de la anterior (1-2 rand/turno):
el stream de rand del bucle de mundo cae en la ÓRBITA del rand del kernel — el
MISMO generador que consume el wander. Es boot-independiente (la semilla absoluta
la siembra la hora DOS; la relación órbita→sucesor no). **Alcance exacto**: esto
ancla en vivo el RNG del kernel en el world-tick **con 0 NPCs activos** (los
arrays estaban a cero, ver abajo), es decir el generador y su órbita — NO el
consumo específico de `npc_tick_all` con NPCs vivos (que requeriría los arrays
poblados). La regla de consumo del wander (1 skip / 2 con movimiento) queda
anclada por asm + cruce modelo↔clon.

### ⚠️ BLOQUEADO (con evidencia): observación directa de los arrays de NPC

La verificación runtime de schedule/wander LEYENDO los arrays runtime
(`g_npc_type_tbl@0x659E`, `g_npc_rt@0x5F5E`, `g_npc_sched@0x5D5E`) NO fue posible
headless. Evidencia (probes en `$CLAUDE_JOB_DIR/tmp`):
1. El boot cae en `g_location=13` (un dwelling con 4 NPCs en `assets/npcs.json`,
   tipos [144,144,144,17]) a las 8:00, party (15,15).
2. Los 3 arrays de NPC están a CERO al boot y siguen a cero tras 6 turnos de
   mundo (el world-tick corre — el minuto y la semilla avanzan — pero no puebla).
3. Un scan del game segment completo (`read_mem_gameseg(0, 0xC000)`) NO encuentra
   la firma [144,144,144,17] ni siquiera [144,144,144] en NINGÚN offset: el .NPC
   no está residente.
4. Causa: los arrays son BSS de trabajo que **sólo** puebla `npc_load_map_data`
   (0x0000) en un evento de ENTRADA al mapa; cargar SAVED.GAM headless no lo
   re-ejecuta y escribir `g_location` no recarga los .NPC. Disparar una entrada
   real (salir al overworld y re-entrar, o navegar a un pueblo) exige inyección
   de teclas de navegación a ciegas — fuera del alcance de este canal.

⇒ Las reglas de schedule/wander quedan ancladas por el asm citado + el cruce
modelo↔clon (14 escenarios de paridad) + la órbita del RNG verificada en vivo. La
lectura directa de los arrays queda ⚠️→formulado, como el live de
`re/verified/dungeon.md` (allí es un skip; aquí además hay un live del RNG que
PASA). Vía para cerrarlo en el futuro (ruta para **F.2 / paridad runtime
completa**, detallada en `re/notes/npc.md §14`): sembrar los tres arrays
(type_tbl+sched+runtime) de un NPC con `write_mem_gameseg` en la planta del
jugador y barrer `g_hour` leyendo la posición que el binario recompute vía su
propio `schedule_index`/`check_schedule` — arnés dedicado pendiente.
