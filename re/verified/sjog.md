# Verificado: SJOG head/tail + FONT (Task 3.12)

Reglas re-derivadas del asm (`re/notes/sjog.md`, `re/notes/font.md`). SJOG y FONT
son overlays COMPARTIDOS: el ledger de ambos está al 100% con reparto explícito por
task (reconciliación en `.superpowers/sdd/task-3.13-sjog-font-reconciliation.md`).

## Convención de fidelidad

- ✅✅ RUNTIME-VERIFICADO en DOSBox.
- ✅ asm-directo (cita) y/o cruce con tests verdes.
- ⚠️ pendiente / no cableado.

## Estado (2026-07-11)

VERDE:
- `npm test -w game` — incluye `tests/traps.test.ts` (8 tests: umbral + tabla de
  mensajes de detección de trampa).
- `tsc --noEmit` limpio.
- Ledger: **SJOG.OVL 100%** (36 segmentos, 35 funcs + pad) y **FONT.OVL 100%**
  (11 segmentos, 10 funcs + pad) vía `sjog_catalog.py` / `font_catalog.py`.

## ✅ asm-directo

- **Trap-detection** (SJOG 0x02ea): `roll=rand(1,30) >= threshold`, con
  `threshold = trapped ? ((diff&0x7f)−stat+30)>>1 : (30−stat)>>1`. Stat = **Int**
  (record+0x0e; cita: draw_stat_page imprime 'Int='@0x96e8 desde [bx+0x0e]). Tabla de
  mensajes (con '\n' final): `success!=trapped`→"no trap!"; `success&&trapped`→
  simple(diff<0xa)/complex(diff>0x14)/"a trap!"; `!success&&!trapped`→siempre "a
  trap!". Portado como función pura `world/traps.ts` + `tests/traps.test.ts`.
- **search_fixed_hidden_items** (SJOG 0x0514): tabla de 113 (loc/floor/x/y) + bitmap
  once-only 0x585c. **Ya presente en el clon** (`searchObjects`/`searchAt`).
- **Grid de combate 11×11** con edge-flee (SJOG tail 0x1c56/0x20d8/0x2148): **ya en el
  clon** (`combat/combat.ts` GRID=11, bounds, flee de borde) — trabajo de Task 3.2.
- **FONT justificación** (0x0000): reparto `remainder/N` front-loaded entre espacios,
  9px de pitch, clip en penY≥0xc0. Documentado (motor de presentación).

## ⚠️ Pendiente / no cableado

- **Cableado** de `trapCheck` al open/jimmy del clon: es una función pura + hook;
  su llamada desde el flujo de abrir/forzar cofres es de Task 3.9/3.13.
- **3 entradas re-findables** de Search (keys cache / diario / equip-gated, si
  0x0d/0x0e/0x0f): el clon usa questFlags once-only; los gates especiales quedan ⚠️.
- **FONT**: el render pixel-exacto (anchos DS 0x50ca, animador de escena, tonos
  data-driven) es de presentación → Task F/UI. El TEXTO del endgame sí es exacto.
- **spawn_trap_effect / search_timed_spawn / search_dungeon_hidden**: derivadas y
  documentadas; su cableado al bucle de Search es de Task 3.9/3.13.
