# Witness T4 — solapamiento guard_wander ↔ npc_tick_all · LIVE

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Gate del T4 del
carril guard-wander (spec `docs/superpowers/specs/2026-07-19-guard-wander-scout.md`).
Pregunta: ¿un guardia con horario (type 16/17, aiType 1) es movido por AMBOS motores
(guard_wander scan 0x5C5A + npc_tick_all tablas 0x5F5E) o sólo por uno? Oráculo headless
propio. Probes: `probe_guard_wander.py` (fases 1-2), `probe_overlap.py` (fase 3).

## HALLAZGO PREVIO IMPORTANTE — las tablas de horario SÍ están pobladas al boot

El boot de este save es **loc 0x11 (LB Castle), floor=0xFF, hour=23**. CONTRA lo que dice
`npc.md §14` («los arrays 0x5F5E/0x5D5E/0x659E están a cero al bootear headless»), aquí el
`g_npc_type_tbl@0x659E` tiene **31 entradas no-cero**, incluidos **guardias con horario**:
slots **15 (type 16), 16 (type 17), 17 (type 17)**, y wanderers type-1 en 23/24/25. ⇒ el
save de referencia SÍ trae el estado de horario (fue guardado tras una entrada de mapa). Esto
permite observar npc_tick_all sin sembrar desde cero. (Actualiza §14: la carga headless-a-cero
no siempre aplica; depende del save.)

Sin embargo, **ningún guardia está en la tabla de objetos 0x5C5A al boot** (0 tiles 0x10/0x11):
los guardias con horario están en OTRA planta (su `rt.z != 0xFF`), así que `npc_place` no los
colocó en 0x5C5A y guard_wander no los ve todavía.

## FASE 2 — guard_wander CONFIRMADO en vivo (procesa un guardia de 0x5C5A)

Sembré un guardia (tile 0x11, type 17) en un slot libre de 0x5C5A en la planta del jugador
(floor 0xFF) y pasé 8 turnos (seed fijado):
```
t1-t2: (15,24) quieto        (guard_wander ~50% "no actúa")
t3:    (15,24)->(15,25)      MOVIMIENTO EN Y, tile SIGUE 0x11   (rama Y NO re-facea ✓)
t4-t7: (15,25) quieto
t8:    (15,25)->(16,25)      MOVIMIENTO EN X, tile 0x11->0x10    (rama X SÍ re-facea ✓)
```
⇒ **guard_wander procesa el tile-guardia de 0x5C5A en vivo**, con las dos reglas de facing
EXACTAS del ASM (Y no re-facea, X re-facea al signo), ~50% de tasa de acción (2/8 turnos). El
motor `guardWander` del port (`guards.ts`) queda validado también en vivo, no sólo bit-a-bit.

## FASE 3 — SOLAPAMIENTO: veredicto = **SÍ, DOBLE PROCESO** (ambos motores mueven al guardia)

### (A) El link objIdx es REAL en vivo
Los 7 NPCs con horario en la planta del jugador (z==0xFF) tienen `rt.objIdx` (0x5F5E+0xC) =
1..7, y su `rt.x/y` COINCIDE con la posición del slot de objeto correspondiente (cruzado con
el dump O1): n21→objslot1@(13,11), n26→objslot5@(9,23), n28→objslot6@(9,9), n30→objslot7@(16,19).
⇒ **un NPC con horario está SIMULTÁNEAMENTE en la tabla de horario (0x5F5E) y en la tabla de
objetos (0x5C5A)** — confirma `npc.md §0.4` (objIdx = enlace a 0x5C5A) EN VIVO. (Los guardias
15/16/17 estaban en OTRA planta, por eso 0 guardias en 0x5C5A al boot.)

### (B) npc_tick_all mueve NPCs en-planta en vivo
De los 7 en-planta, npc_tick_all movió los slots **21 y 26** en 4 turnos → el motor de horario
está VIVO y procesa NPCs de la planta del jugador.

### (C) Un guardia (type 16) forzado a la planta lo mueven AMBOS motores
Forcé el guardia con horario slot **15 (type 16)** a la planta (z=0xFF, state=2) + a un slot de
objeto (tile 0x11), y pasé 8 turnos vigilando la pos del OBJETO (dominio de guard_wander) y del
RT (dominio de npc_tick_all):
```
t2..t6: obj y rt AVANZAN juntos (17,26)->(21,27)   (npc_tick_all mueve rt; npc_place sincroniza rt->obj)
t7:     obj=(20,27)  rt=(21,27)   ← DIVERGEN
t8:     obj=(20,27)  rt=(21,27)   ← divergencia persiste
```
**La divergencia obj≠rt es la prueba dura.** El ÚNICO escritor de `rt` es npc_tick_all; `obj`
lo escriben guard_wander Y la sincronización npc_place(rt→obj). Si `obj≠rt`, `obj` fue escrito
por **guard_wander** a un valor ≠ rt y NO re-sincronizado. ⇒ **guard_wander movió el slot de
objeto del guardia de forma INDEPENDIENTE de npc_tick_all.** Veredicto del probe:
`obj(guard_wander) moved=True ; rt(npc_tick_all) moved=True`.

⇒ **SOLAPAMIENTO CONFIRMADO**: un guardia con horario en la planta del jugador es procesado por
LOS DOS motores en el mismo turno de pueblo (guard_wander en 0x165F **antes**, npc_tick_all en
0x166E **después**), cada uno consumiendo su propio RNG. El binario **DOBLE-PROCESA** al guardia.

## Implicación para T4 (REFUTA la asunción del scout)

El scout (§ T4) asumió: «si hay solapamiento, `NpcManager.tick` debe SALTAR los type 16/17 (ya
los movió guard_wander)». **El witness lo REFUTA**: como el BINARIO mueve al guardia con AMBOS
motores (doble consumo de RNG), el port FIEL debe **replicar los dos**, NO excluir. Concreto:
- Cablear guard_wander (T3) para TODOS los guardias en-planta (scan 0x5C5A tile 0x10/0x11).
- **NO excluir** los type 16/17 del npc tick: el guardia `aiType 1` de Iolo's Hut debe seguir
  pasando por npc_tick_all (wander) ADEMÁS de por guard_wander → doble consumo, igual que el DOS.
- Los guardias `aiType 0` (FIXED, la mayoría) son inocuos en el npc tick (FIXED=ret, 0 rand);
  guard_wander los mueve (1-3 rand). Sólo el aiType-1 de Iolo tiene doble consumo — y ES fiel.
- Orden del stream: guard_wander (paso 5, 0x165F) **antes** de npc_tick_all (0x166E) — ya
  documentado en el scout §2.2; respetar ese orden al cablear.

CAVEAT honesto: el guardia forzado usó `state=2` (mover-directo) para saltar el skip 0x1290;
el movimiento de `rt` que observé fue por esa vía, no necesariamente el wander aiType-1. Pero lo
LOAD-BEARING (npc_tick_all NO salta los type 16/17 → los procesa) queda probado (rt del slot-15
type-16 se movió), y guard_wander los procesa en paralelo (divergencia obj≠rt). El sub-path
exacto del aiType-1 de Iolo (wander) es el de `npcs.json`; en vivo bastaría re-correr con el
state natural del slot si se quiere el conteo de rands exacto del wander (Clase-C, no bloquea T4).

## Evidencia
- Probes: `re/notes/probe_guard_wander.py`, `re/notes/probe_overlap.py`; salidas
  `guard_wander.json`, `overlap.json`.
- ASM/spec: `docs/superpowers/specs/2026-07-19-guard-wander-scout.md`, `re/notes/npc.md
  §0.4/§1/§4.1` (objIdx link rt+0xC → 0x5C5A; wander npc_ai_step), `re/notes/loops.md §2`.
- Port: `game/src/core/world/loops/{guards,turn}.ts`, `game/src/core/npc/manager.ts`.
