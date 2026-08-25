# Verificado: Endgame + Flames (Task 3.12)

Reglas re-derivadas del asm con citas (`re/notes/endgame.md`) y portadas al clon
(`game/src/core/quest/endgame.ts`, enganchadas en `quest/lordbritish.ts`). El
playtime es DETERMINISTA (aritmética de fechas, 0 RNG) → verificación por valor.

## Convención de fidelidad

- ✅✅ **RUNTIME-VERIFICADO** en DOSBox.
- ✅ **asm-directo** (cita en re/notes/endgame.md) y/o cruce con tests verdes.
- ⚠️ pendiente / no cableado.

## Estado (2026-07-11)

VERDE:
- `npm test -w game` — incluye `tests/endgame.test.ts` (11 tests: playtime con
  préstamo simple/doble, informe con plural/separador, rescueLordBritish con
  pergamino y rama de la caja).
- `tsc --noEmit` limpio.
- Ledger: **ENDGAME.OVL 100%** (9 segmentos) + **FLAMES.OVL 100%** (2 segmentos,
  thunk PLINK + padding) vía `endgame_catalog.py` / `flames_catalog.py`.

## ✅ asm-directo

- **Playtime** (0x0407): `years=g_year-139, months=g_month-4, days=g_day-5` con
  préstamo `days<0 → +28, months--` y `months<0 → +13, years--`. Fecha de inicio
  139/4/5, calendario 13×28. Portado exacto en `endgamePlaytime`.
- **Informe** (0x0444–0x04ef): plural "s" si valor>1; ", " antes de la siguiente
  unidad no nula; unidades nulas omitidas. Portado exacto en `formatQuestReport`
  (strings " year"/" month"/" day"/", "/"s" volcadas de DATA.OVL 0x8438…).
- **Rama de la caja** (0x08b9): la rama "buena" (escena del trono + pergamino)
  exige Y ∧ `g_wooden_box`; modelada con `state.specialItems.woodenBox`.
- **FLAMES.OVL** = sólo thunk PLINK, sin lógica (32 B); code-no-op para el port.
- **Trigger del ENDGAME** (cerrado 2026-08-04, era ⚠️ pendiente): stub PLINK
  `ULTIMA.EXE 0x7c4a` = overlay **13** (ENDGAME.OVL) + `ljmp` a `endgame_main`
  0x0648 — **único** stub de overlay 13 entre los 164 del EXE. Dos llamadores,
  ambos con el mismo gate `cmp [g_unk_58a0],0x4d`: DUNGEON 0x00cb y SJOG 0x2046.
  **0x4d lo escribe un solo sitio del binario: SJOG 0x1edc, dentro de `absorb`
  0x1ea4.** ⇒ el endgame lo dispara la ABSORCIÓN de un miembro por una sombra,
  no la planta ni las regalías. Detalle en `re/notes/endgame.md` §Trigger.
  ⚠️ **El clon NO lo implementa**: `checkDoomRescue` (game.ts:5177) dispara con
  `floor===7 && endgameReady && !game-won`. Hueco de fidelidad NOMBRADO y abierto
  (no portar `absorb` sin cerrar antes el pendiente (e) de `endgame-derivation.md`).

## ⚠️ Pendiente / no cableado

- **Deletreo de la fecha**: el original usa spell_ordinal/spell_cardinal ("the
  Fifth Day … One Hundred Thirty Nine"); el clon numeriza (`ordinal(5)="5th"`,
  año literal). Las tablas de palabras (DS 0x3e0a/0x3e40) están localizadas; el
  deletreo completo es cosmético (declarado, no oculto).
- **Prompt Y/N y narrativa de la caja**: el texto exacto necesita traza en vivo
  (oráculo); el control-flow (Y ∧ box → final completo) es asm-directo.
- ~~**Trigger de ENDGAME**: qué sitio del kernel carga el overlay al ganar — no
  resoluble dentro del overlay (Task F).~~ ✅ **CERRADO 2026-08-04** — sube a
  §asm-directo (stub 0x7c4a; el gatillo es la absorción). Lo que queda abierto es
  otra cosa: qué hace la absorción exclusiva de la celda de LB (pendiente (e)).
- **Cutscene/RNG cosmético** (wander_sprite): animación; no afecta al estado del
  save. La suite de regresión de Task F.2 correrá la ruta gitana→endgame.
