# SJOG.OVL — head (Search sub-lógica) + tail (grid de combate) (Task 3.12)

Overlay #20, 8800 B (0x2260), load_seg 0x0bf8. 35 funciones (prólogos verificados)
+ 10 bytes de ceros; catálogo completo `re/tools/sjog_catalog.py` (ledger 100%, 36
segmentos). Reparto (`.superpowers/sdd/task-3.13-sjog-font-reconciliation.md`):
**Task 3.9** = 14 funcs (bloque contiguo 0x0646–0x18CE: search/jimmy/open/get + loot),
**Task 3.12** = 21 funcs (head 0x0000–0x0514 + tail 0x1B34–0x21CE).

## Head — utilidades compartidas + sub-lógica de Search (3.12)

| off | nombre | qué hace |
|---|---|---|
| 0x0000 | find_free_actor_slot | primer slot vacío del array de actores 0x5c5a (stride 8) |
| 0x002a | set_scratch_from_dir | dir 0→y−,1→x+,2→y+,3→x− en g_cmb_scratch_x/y |
| 0x006c | prompt_direction | "Which direction?" + eco North/South/East/West |
| 0x012a | print_object_name | jump-table (31 entradas) → nombre de item 0x850e… |
| 0x01f2 | spawn_trap_effect | spawn RNG-gated: rand(0,7)/rand(0,0x1f)==0x13→"A trap!" |
| 0x02ea | **search_trap_check** | detección de trampa — §Trap |
| 0x03a8 | search_dungeon_hidden | 8 slots especiales; probe 0x770e==0x19; "Thou dost find!" |
| 0x045a | search_timed_spawn | tabla 0x3e66; g_hour==0 + día cambiado; rand(2,15) de recurso |
| 0x0514 | search_fixed_hidden_items | tabla de 113 items ocultos (loc/floor/x/y); bitmap 0x585c |

### Trap-detection (search_trap_check @0x02ea) — asm-directo

```
D = byte[actor*8 + 0x5c5f]           ; bit 0x80 = atrapado, bits0..6 = magnitud
stat = byte[member*32 + 0x55b6]      ; record+0x0e = INTELIGENCIA
threshold = trapped ? ((D&0x7f) - stat + 30) >> 1 : (30 - stat) >> 1
roll = rand(1, 30)                   ; SJOG wrapper 0x6112
success = roll >= threshold
```

`stat` es **Int**: prueba definitiva en ZSTATS draw_stat_page, que imprime 'Int='
(DS 0x96e8) desde [bx+0x0e] y 'Dex=' (DS 0x96f4) desde [bx+0x0d].

Mensajes (0x0351–0x039d, strings 0x864a… con '\n' final):
- `success != trapped` → **"no trap!"** (0x864a).
- `success && trapped` (0x036e/0x0388): diff<0xa **"a simple trap!"** (0x8654);
  diff>0x14 **"a complex trap!"** (0x8664); en medio **"a trap!"** (0x8676).
- `!success && !trapped` (0x0388 `je 0x39a`): SIEMPRE **"a trap!"** (0x8676).

(La versión previa tenía las celdas simple/normal invertidas; corregido tras review.)

### search_fixed_hidden_items (0x0514)

**113 entradas** (bucle `si = 0..0x70`, `cmp si, 0x71` @0x062b) de tablas paralelas
`[0x3f5c]`=loc, `[0x3fce]`=floor, `[0x4040]`=x, `[0x40b2]`=y; item `[0x3e78]`. Bitmap
de "encontrado una vez" en 0x585c (bit `1<<(si&7)` en `[0x585c + si>>3]`), salvo si
0x0d (keys cache, gate g_keys==0), si 0x0e (diario, gate g_day != [0x57b2]) y si 0x0f
(equip-gated, [0x57e7]==0). **El clon ya tiene esta tabla** vía `searchObjects`
(data.json) + `searchAt`. **Conteo reconciliado**: el binario itera 113 (índices
0..112); la entrada 113 (índice 0x71) de la tabla es un **centinela de ceros**
(loc/floor/x/y=0) que el extractor expone como 114ª — `searchAt` ahora capa a 113
(`SEARCH_ENTRY_COUNT`) para no revelar un falso objeto en (loc 0, planta 0, 0, 0).
~~Las 3 entradas re-findables especiales (si 0x0d/0x0e/0x0f) quedan ⚠ (questFlags
once-only en el clon).~~ **[ACTUALIZADO t#58]** — ya NO es cierto: el careo de
`search.ts` encuentra las tres con su gate y su cita, y `markFound` respeta la
asimetría de persistencia:

| si | gate del port (`isFindable`) | cita | persistencia (`markFound`) |
|---|---|---|---|
| 0x0d | `state.keys === 0` | SJOG 0x055d | nada: el gate es de inventario y se auto-cierra |
| 0x0e | `time.day !== state.skullTreeFoundDay` | SJOG 0x0574-0x0580 | sella el día (espejo de `[0x57b2]`, escritura exclusiva de si==0x0e en 0x05b1-0x05b4) |
| 0x0f | `equipmentQuantities[39] === 0` (Glass Sword) | SJOG 0x0587 | nada, igual que 0x0d |

RESIDUAL que SIGUE abierto (no lo tapa esta actualización): 0x0d y 0x0f llevan
además `call 0x770e` (chequeo de casilla, 0x056d/0x059a) cuya semántica NO está
derivada ⇒ el clon es MÁS PERMISIVO. Declarado en `deliberate-divergences.md §3.5`.

> Por qué se tacha en vez de borrarse: la línea vieja circuló como premisa de
> encargo y mandaba a re-implementar algo hecho. Mismo género que el barrido de
> citas de t#56 — prosa que describe un estado que ya cambió.

## Tail — grid de combate 11×11 (3.12 doc; propiedad semántica 3.2)

| off | nombre | qué hace |
|---|---|---|
| 0x1b34 | count_party_ready ⚠ | cuenta miembros con `0xaee0(member,item)!=0` — pero `0xaee0` **no es kernel**: es el destino crudo desde SJOG (banda 3, base 0xbf80) ⇒ `(0xbf80+0xaee0)&0xFFFF = 0x6E60` = **`unequip_item`** (ULTIMA.EXE). Es decir NO sólo cuenta: **DESEQUIPA** el item de cada miembro (pone el slot a 0xff) y cuenta a cuántos se lo quitó. El nombre engaña; sin consumidor en el port (`count_party_ready` no aparece en `game/src/core/`), así que no hay divergencia — pero la semántica es «retirar de todos», no «contar listos». |
| 0x1b6c | sum_flee_edges | acumula dirección de escape del array de monstruos 0xba16 |
| 0x1bb2 | flee_off_edge | actor sale del combate por el borde; "escaped!" |
| 0x1c56 | move_combat_actor | movimiento en grid 11×11 (bounds 0..10); off-edge→flee |
| 0x1d6a | combat_reach_action | acción de alcance; secret-door probe 0x7782 |
| 0x1ea4 | combat_actor_death_check | muerte del actor; "X slain" |
| 0x1f26 | print_dir_tone | imprime str + dirección + 2 tonos |
| 0x1f7a | list_active_monsters | "The following:" enumera monstruos bit-0x80 |
| 0x203e | end_combat_cleanup | restaura array; victoria→corpses en cofres; g_location |
| 0x20d8 | combat_cell_blocked | bounds 0..10 + passability kernel 0xbdf6 [= CS 0x7d76 → COMBAT.OVL:0x0000 dng_enter_room]; 1=bloqueado |
| 0x2148 | combat_actor_surrounded | 1 si las 4 dirs están bloqueadas (atrapado) |
| 0x21ce | guard_summon_alarm | alarma de refuerzos: NPCs bit0&bit0x80 → "summons" |

**Grid 11×11 con edge-flee ya está en el clon** (`combat/combat.ts`: `GRID=11`,
bounds `x>=GRID`, flee de borde @886) — trabajo de Task 3.2, reconciliado, sin cambio.

## Aportación al clon (Task 3.12)

- `game/src/core/world/traps.ts`: `trapThreshold` + `trapCheck` (función pura + test
  `tests/traps.test.ts`). Hook para el open/jimmy de Task 3.9/3.13.
- La tabla de 113 items y el grid de combate ya existían en el clon — documentados,
  no duplicados.
