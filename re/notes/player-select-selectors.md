# Selección de jugador: DOS rutinas distintas (reconciliación #78, 2026-07-17)

> Derivado por el carril ready-ui al reconciliar dos derivaciones del mismo día.
> Resuelto POR OFFSETS. Relevante para cualquier comando futuro que pida jugador
> (Use, Give, Talk-heal…): averiguar CUÁL de las dos llama, no asumir.

## Selector 1 — picker CRUDO `kernel 0x2d7a` (SIN gate del activo)
- Callers verificados: **Ready** (ZSTATS.OVL cmd_ready @0x1296 → @0x129f `call 0` →
  resolve_display_char ZSTATS @0x0000) y **Ztats** (cmd_zstats @0x0a3a → @0x0a44 →
  la misma resolve_display_char).
- resolve_display_char @0x0038 `call 0x4b9a` → kernel 0x2d7a (delta ZSTATS 0x1e20,
  anclado por print 0x3670→0x1850).
- kernel 0x2d7a: picker interactivo. `g_active_char` (bytes 7b58) en 0x2d7a–0x2e2a =
  **CERO referencias** (prueba negativa con base de banda correcta). Prompt "Player:"
  (ZSTATS DS 0x96b4) + banda "Select:" (0x5554 @0x2db2).
- ⇒ Ready y Ztats SIEMPRE preguntan; NO saltan con jugador activo.
- **CONFIRMADO EMPÍRICAMENTE por el usuario en DOSBox (2026-07-17 16:03)**: con Gorn
  activo (flecha →), R muestra ">Ready..." + banda ►Select:◄ + "Player:" — pregunta
  igualmente. Testigo: `original/av-referencia/active-player/
  ORIG_ready-pregunta-con-activo-CONFIRMACION.png`.

## Selector 2 — gate del activo `kernel 0x4988` (cuerpo 0x4995–0x49bc)
- Gate: @0x49b2 `cmp g_active_char,0xFF` / @0x49b9 usa el activo · @0x49dc cuenta
  elegibles por status 'G'/'P' (0x47/0x50) · @0x49fa **auto-único** (≤1 elegible no
  pregunta) · prompt "Player:" (DS 0xa3c4) → 0x2e8e→0x2d7a.
- Caller verificado: **Cast** (CAST.OVL entrada @0x0dc0, rama por g_location @0x0e1a
  — sirve overworld Y combate; @0x0dd5 `call 0x8a08` → kernel 0x4988, delta CAST
  0x4080 anclado por "Spell name:" = DATA.OVL 0x4603 byte a byte).
- **Give/otros: SIN verificar** (inferencia de la derivación de viewgem; trazar por
  offset antes de implementar).

## ~~Caveat declarado~~ — RESUELTO (22-08, carril fix-cast-selector)
> ~~El gate 0x4988 imprime "Player:" (0xa3c4) pero el testigo de Cast-overworld muestra
> "Cast & who?" — o es eco compuesto del dispatcher ANTES del gate, o hay matiz de
> entrada sin aislar. "Cast & who?" confirmado real por testigo (ORIG_cast_yell_log).~~

Resuelto **a favor del ASM**: el Cast-overworld imprime "Player: " (0xa3c4), como dice
esta nota; no hay eco compuesto ni matiz de entrada. El testigo que sostenía lo
contrario (`av-referencia/command-prompts/ORIG_cast_yell_log.png`) **ya no existe en
disco**, y el corpus OCR de 49 rutas de LPs da **70** filas «Cast... Player: \<nombre\>
Spell name:» (+2 «Cast... Player: None!») y **0** con «Cast & who?». Derivación completa
y volcados de DATA.OVL en `cast-input.md` §9. El port ya no fabrica la cadena:
`ui/pickers.ts::pickCaster` delega en `pickCommandChar` (0x4988 es una sola rutina).

## Estado en el port (d41842f)
Ready/Ztats → picker siempre (fiel). Cast → gate del activo + auto-único (fiel).
Ciclo de vida de g_active_char espejado (setActivePlayer + deselección por muerte
0x2a8c/0x2b14 + New Order 0x2b1b).
