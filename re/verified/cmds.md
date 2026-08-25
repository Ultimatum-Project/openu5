# Verificado: comandos sueltos — CMDS.OVL + SJOG.OVL (Task 3.9)

Reglas re-derivadas del asm con citas (`re/notes/cmds.md`) y portadas al clon
(`game/src/core/world/commands.ts` + wiring en `game/src/core/game.ts`). El arnés
`re/tools/cmds_parity.py` cruza dos modelos INDEPENDIENTES del mismo evento — la
predicción asm-derivada en Python (`KernelRng` + reglas) y la reproducción del
core del clon (`game/src/core/__parity__/cmds-run.ts`, `OriginalRng`) — exigiendo
que calquen ESTADO final Y semilla (misma filosofía que test_rng_parity).
Escenarios en `re/parity/cmds/` (17).

## Estado de la verificación (2026-07-11, tras review)

VERDE:
- `re/tools/test_cmds_parity.py` — 24 passed, 1 skipped (live opt-in). Los 17
  escenarios (Klimb, Jimmy ×5 tipos incl. prisionero pueblo/mazmorra, trampa
  pueblo/mazmorra, botín cofre/mazmorra, Ignite ×3) coinciden en estado final Y
  semilla entre el modelo asm y el clon.
- Las tablas de loot/trampa se LEEN de DATA.OVL (`_load_data_ovl_tables`); el test
  `test_tables_match_data_ovl` ancla las constantes a los bytes reales del binario
  (rompe la circularidad de un volcado a mano — CRITICAL-1 del review).
- `game/tests/commands.test.ts` — reglas puras (Klimb, New Order, Push predicate
  exacto, Jimmy incl. prisionero, trampa, botín, Camp HP+MP).
- Suite del clon `npm test -w game`: **484 passed**.  <!-- F.1 2026-07-11: total de la suite completa (484) -->
- Suite RE base: verde (`pytest re/tools -k "not live"`, exit 0).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas

Con paridad de stream (KernelRng↔OriginalRng). Citas asm en `re/notes/cmds.md`:

- **Ignite** (CMDS 0x0D98): 240 fijo (SET) fuera de mazmorra; `112+rand(0,15)`
  (saturating-add cap 0xFF, kernel 0x3EF0) dentro; 1 rand SÓLO en mazmorra.
  Resuelta la pregunta abierta del draft (set vs add): es add-con-cap; el clon ya
  era exacto.
- **Klimb-con-garfio** (CMDS 0x1C20, MECÁNICA NUEVA): requiere Grapple + ir a pie
  + montaña 0x0C; por miembro VIVO `rand(1,30)` vs DEX (≥ escala), fallo → "Fell!"
  + `rand(1,5)`; los muertos NO tiran. Antes el clon respondía "What?" en el
  exterior.
  ⚠ Este "Klimb ✅" cubre SÓLO garfio (aquí) + mazmorra (DUNGEON 0x1E10). El (K)limb
  de **pueblo** (TOWN 0x0B82) y las **escaleras de pueblo automáticas** (TOWN 0x052E)
  son otra rutina — DERIVADA y portada aparte en `re/notes/town-klimb.md` (fix #46).
- **New Order** (CMDS 0x0DDC): swap de 2 miembros, **Avatar anclado en pos 1**
  (" must lead!"), sin RNG, sin turno.
- **Jimmy** (SJOG 0x0D4A, MECÁNICA NUEVA): puertas `rand(0,29)` (DEX>roll);
  cofres `rand(1,30)` vs threshold `((tile&0x7F)−DEX+0x1E)>>1` (objeto) o
  `(floor·2−DEX+0x1E)>>1` (mazmorra); cepo/prisionero 0x84/0x85 `rand(0,29)` vs
  DEX (pueblo → libera NPC + **karma+2 cap 99**; mazmorra → tile 0x44 sin rand);
  **llave se gasta SÓLO al fallar; cerradura mágica siempre rompe SIN tirar**.
  Las **puertas 0xB9/0xBB están CABLEADAS** en `game.jimmy(dir)` (tiles de mapa +
  `state.keys`; no aplica el bloqueo BSS). Cepo/cofre-objeto → 3.13.
- **Trampa de cofre** (kernel 0x2FD0): tabla de tipos DS:0x559e (ACID 3/8, POISON
  2/8, BOMB 2/8, GAS 1/8; mazmorra sólo ACID/POISON); ACID `max(1,rand(0,60)>>1)`
  al que abre, POISON envenena, BOMB `rand(1,8)` a cada vivo, GAS envenena a los 6.
- **Botín de cofre** (SJOG 0x1040/0x10B8/0x179E): orden EXACTO de rand con el
  corte `guard>contents` antes de tirar; `loot_place` (0x0F88) deriva la cantidad
  del ID (1→rand(1,c), 2→rand(1,3c), 3/4→base−1, else→base); tablas volcadas byte
  a byte. Verificado por stream (semilla final idéntica).
- **Search puerta secreta** (SJOG 0x095C): tile 0x4E → 0xB9 (mundo), determinista.

## Reconciliación cerrada (diferida de 3.4)

- **Muro secreto de mazmorra** (`re/verified/dungeon.md §8`): el corredor 8×8
  (`g_dng_map`) usa nibble hi **0xD** como paso secreto revelable por Search — se
  mantiene (representación NIBBLE, preserva la conectividad); el reveal
  `0x4E→0xB9/0xB8` es de **mapa completo** (0xB9 mundo, 0xB8 sala de mazmorra). El
  nibble **0xC** NO es cosmético: `search_dungeon` (0x0646), con variant∉{1,2}, lo
  MUTA a `0xB0|(cell&8)` ("It crumbles away", 0868-089a) — 0xC SÍ es atravesable por
  Search, por crumble→0xB0. Ese branch de crumble está **sin portar** (parte del
  `search_dungeon` ⚠️→formulado); la conclusión de conectividad se mantiene.

## ⚠️→formulado (asm-derivado, port parcial o paridad seed-exacta no aplicable)

- **Push** (CMDS 0x161A): el predicado de tiles empujables (0x5B; 0x90-0x93;
  0xA5-0xA6; 0xA8-0xA9; 0xAD-0xAF; 0xB4-0xB7) y el **gating exacto de tile**
  (deslizar sii `destTile==fill`; pull sii `partyTile==fill`; relleno 0x45 cañón /
  0x44) están portados en `game.push`. DIVERGENCIAS por el modelo del clon: (a) sin
  capa de objetos → no evalúa `0x770e`; (b) **no rota el facing** de cañón/mueble
  (clases 0x90/0xB4, `dir_vector_to_facing`); (c) sin la rama de combate
  `g_cmb_actor`. Sin RNG → sin paridad de stream; se re-etiqueta ✅→⚠️.
- **search_dungeon** (SJOG 0x0646): el Search en corredor de mazmorra (detección de
  trampa `rand(1,30)` vs threshold, alijo 0x62, 0x61→0x60, crumble 0xC→`0xB0|(cell&8)`)
  NO está portado — la mazmorra del clon usa `DungeonState`. Reglas citadas en
  `re/notes/cmds.md §11`; queda para el cableado del bucle de mazmorra.
- **Camp/Hole-up** (CMDS 0x0552 + helper 0x0400): heal `rand(1,63)`/miembro
  elegible/hora (clamp maxHP, sin gate de HP-lleno) + restauración de MP por clase
  (A/M=INT, B=INT/2, 0 rand) + `rand(0,99)<25` de emboscada por hora. El gate de
  elegibilidad depende del cooldown `g_unk_588c` (recarga 0x0E, decrementa 1/hora
  del reloj) y de la exclusión del miembro de guardia — estado horario que el
  núcleo puro no reproduce headless. Modelo portado (`campHoleUp`) + test
  conductual; EXCLUIDO del set seed-exacto (divergencia de alcance, como el
  render de mazmorra 3.4 §3).
- **Open sobre cofres-objeto** y **Get de items de cofre / antorcha de pared**:
  las reglas de karma/trampa/botín/switch están portadas como funciones puras y
  verificadas por stream, pero su WIRING requiere la tabla de objetos de 8 B
  cargada (bloqueo BSS); se cablean con el bucle de contexto de Task 3.13. Get de
  cosecha/mesa (overworld, 0 rand) sí está cableado.

## Divergencia de alcance del canal de captura (paridad live)

`test_cmds_state_parity_live` (opt-in `U5RE_LIVE=1`) queda como skip documentado:
cofres/objetos son registros de 8 B que no se cargan headless (bloqueo BSS), así
que no se pueden sembrar en el emulador. Las reglas están ancladas por asm + el
cruce modelo↔clon, que prueba la paridad del stream de rand. Precedente: la
exclusión del render en `re/verified/dungeon.md`.
