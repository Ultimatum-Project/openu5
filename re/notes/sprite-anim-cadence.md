# Cadencia de animación de los SPRITES DE ACTOR (personas/criaturas) — derivación

Testigo del usuario (2026-07-18): «las personas tienen animaciones de sus sprites muy
aceleradas respecto al original, pero otros sprites no-personas están bien (fuente,
antorchas de pared, reloj)». Este documento deriva por qué y fija el fix.

## 1. El original NO anima los sprites de actor con el reloj de tiles

- El **reloj maestro de tiles `advance_tile_anim_frames 0x44b8`** sólo muta la tabla de
  remapeo `DS:0x4ee2`, que indexa el compositor como `remap[tile]` y **sólo cubre el
  banco de TERRENO** (0xd4–0xf0: agua, fuente, rótulo de serpiente, toggles tortura/reloj).
  Los sprites de actor viven en el **banco alto `0x100..0x1ff`** (0x134..0x1ff en
  `TileData`: SitChairEat, personas Wizard..LordBritish, criaturas Rat..ShadowLord) y
  **NO están en `0x4ee2`** → el reloj de tiles no los toca. (`re/notes/tile-anim-census.md §1`.)
- El **intérprete de bytecode `anim_script_tick 0x4552`** anima decoración/terreno, no el
  banco alto: su frame de salida es `base + op − 1` con `base = [reg+0] & 0xfc ≤ 0xfc`
  ⇒ **el valor mostrado nunca llega a `0x100`**. Confirmado leyendo `0x4552`/`0x4658`.
  (Además `tile-anim-census.md §4` cerró que ninguna decoración se anima por bytecode en
  el juego real; el «actor bytecode» medido antes era artefacto de sembrado.)

⇒ En el original, el frame de un sprite de persona/criatura lo fija la lógica de mundo por
TURNO (`npc_tick_all` NPC.OVL:0x0DB4 corre por turno con `hour`; el líder por su pose),
**no un reloj de render libre**. Un actor quieto no cambia de frame.

## 2. Medición AV (video-C del DOSBox del usuario) — método 🎥 canónico para cadencias

Dos ventanas con el jugador EN REPOSO (sin pasar turnos), frames reales (VFR ~19 fps):

- **t≈89–102 s (13 s, jimmy en pueblo, sólo el Avatar visible):** el sprite del Avatar
  (banco alto) cambia **1 vez en 299 frames (~13 s)**. Prácticamente CONGELADO en reposo.
- **t≈152–162 s (talk a un merchant):** el merchant (figura blanca) sí anima un gesto de
  saludo (brazo arriba↔abajo = frames 0x154↔0x155/6/7) pero **lento e IRREGULAR (~1 cambio/s)**,
  nunca el ciclo estable de ~110 ms; el Avatar contiguo queda estático.

Contraste con el PORT (antes del fix): TODO grupo de banco alto ciclaba `animatedFrame`
a `divisor 2` = **110 ms/frame en el reloj de render libre** (ciclo de 4 = 440 ms),
CONTINUO aunque el jugador estuviera quieto ⇒ ~9 fps de parpadeo = el «muy acelerado».
El banco de terreno (fuente/antorchas/reloj) sí va en ese reloj y a esa cadencia ES
correcto — de ahí que el usuario los vea bien.

## 3. Fix (render layer, ambas pieles)

`render/tileanim.ts`: los grupos con `base >= 0x100` (`SPRITE_BANK`) se marcan
`AnimGroup.perTurn`; `animatedFrame(tile, phase, groups, turn)` usa **`turn`** (contador
de turnos del mundo) para esos, y `phase` (reloj de render) para el terreno.

- **Fiel** (`skin/fiel/skin.ts`): `personTurnCount` se incrementa SÓLO en `onTurn`
  (turno atómico del core); los repintados del reloj (onDirty/onConsole/rAF) no lo tocan
  ⇒ actor quieto = congelado; anda 1 frame/paso. Se pasa por `paintFaithful` →
  `paintViewportTiles`.
- **Shader** (`skin/shader/skin.ts`): `paintActors` avanza el frame del actor con
  `faithful.personTurn` (misma cadencia), sin el cross-dissolve de reloj libre (`now/period`)
  que era el mismo defecto en la capa de motion.

Cadencia derivada: **1 frame por turno del mundo**. Reproduce lo medido: congelado en
reposo (Avatar 13 s) y avance al andar/actuar. En `phase 0 / turn 0` el output es idéntico
al previo ⇒ goldens/parity a turn 0 invariantes.

## 4. Residual DEFERIDO (no fabricado)

El idle FINO de algunos NPC (el saludo esporádico del merchant) es el bytecode `0x4552`
gateado por RNG (50 %/llamada + delays + opcodes 5/6), corriendo en el reloj de anim, NO
por turno. Portarlo con fidelidad exige la **secuencia real de tile-ids por familia de
NPC**, que `tile-anim-census.md §2` deja pendiente de oráculo en vivo (BP). El fix por-turno
elimina la aceleración (el defecto reportado) sin inventar programas; el idle fino queda
como mejora futura si el usuario lo pide (gesto lento sobre el frame por-turno).
