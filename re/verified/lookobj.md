# Verificado: Look + View-a-gem (Task 3.12)

Reglas re-derivadas del asm (`re/notes/lookobj.md`) y portadas al clon
(`game/src/core/game.ts`: `look()` + `lookSpecialDescription`). Los casos derivados
son DETERMINISTAS (sin RNG salvo esfera/cielo, no portados) → verificación por valor.

## Convención de fidelidad

- ✅✅ RUNTIME-VERIFICADO en DOSBox.
- ✅ asm-directo (cita en re/notes/lookobj.md) y/o strings volcadas de DATA.OVL.
- ⚠️ pendiente / no cableado.

## Estado (2026-07-11)

VERDE:
- `npm test -w game` — incluye `tests/look.test.ts` (10 tests: cielo día/noche, reloj
  AM/PM, Flame por location, mazmorra por banda X, tile normal → null).
- `tsc --noEmit` limpio.
- Ledger: **LOOKOBJ.OVL 100%** (17 segmentos) vía `lookobj_catalog.py`.

## ✅ asm-directo (con cita)

- **Carteles = 5 caras reales** {0x89,0x8A,0xA0,0xA4,0xF8} (cmd_look). Se retiraron los
  falsos del clon (0xE0-0xE3 postes, 0xEC-0xF9 flavor) y se añadieron 0x89/0x8A.
- **Reloj** (0x0596): `H=g_hour%12` (0→12), MM=g_minute 2-díg, AM si g_hour≤0x0b else
  PM. Strings " AM.\n"/" PM.\n" volcadas.
- **Flame** (0x05f6): location 0x1e/0x1f/0x20 → Truth/Love/Courage.
- **Entrada de mazmorra** (0x0626): banda X → Shame/Destard/Despise/Wrong/Doom/
  Covetous/Hythloth/Deceit (tabla exacta de saltos 0x0630–0x068a).
- **Cielo** (0x0366): día 6≤h<18 → el sol; noche → estrellas.

## ⚠️ Pendiente / no cableado

- **Mirar al sol DAÑA** (look_sky día, 0x0383–0x03a4): tras "the sun!" resuelve
  g_active_char y llama a la rutina de daño con (active_char, 1) + redraw 0x8670. NO
  portado: el `look()` del clon es read-only y no tiene "quién mira"; declarado con
  cita, cableado en Task 3.13/F.
- **"the stars." es APROXIMACIÓN**: la rama de noche del original pinta un campo de 80
  estrellas `rand(9,182)+rand(9,172)` + zodíaco, no una frase. El clon da texto.
- **Poste 0xE0-E2** (canonicalización a ancla): no portado; esos tiles caen al look
  genérico en el clon → pendiente.
- **Esfera de cristal (0x29)**: roll `rand(1,30)` vs roster+0x0e (Int) → Death/Strange
  vision + gem_view. NO portado (necesita el "quién mira" + gem_view gráfico).
- **View-a-gem (gem_view)**: renderer gráfico 32×32; sin equivalente en el clon de
  texto; el consumo de gema vive en el caller (CMDS) — coordinar con 3.9/Task F.
- **look_generic**: diff LOOK2.DAT ↔ TileData.json byte-a-byte → Task F.
