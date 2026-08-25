# Verificado: Z-stats + Ready/equipar (Task 3.12)

Reglas re-derivadas del asm con citas (`re/notes/zstats.md`) y portadas al clon
(`game/src/core/equip.ts` reescrito, `game/src/core/party.ts` clases). El modelo de
equipar es DETERMINISTA salvo 1 `rand(0,15)` (ring-vanish 1/16) → la verificación es
por valor + cruce estático contra las tablas de DATA.OVL, no por stream de RNG.

## Convención de fidelidad

- ✅✅ **RUNTIME-VERIFICADO** en DOSBox (valor byte-a-byte en vivo).
- ✅ **asm-directo** (regla leída de las instrucciones, con cita) y/o tabla volcada de
  DATA.OVL.
- ⚠️ pendiente / no cableado al bucle del juego.

## Estado de la verificación (2026-07-11)

VERDE:
- `npm test -w game` — **484 passed** (incluye `tests/equip.test.ts`, 21 tests) — sin  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  regresiones (era 407+).
- `tsc --noEmit` en `game/` — limpio.
- Ledger: **ZSTATS.OVL 100% cubierto** (18 segmentos, 4880 B, 0 gaps) vía
  `re/tools/zstats_catalog.py`.

## ✅ asm-directo (leído del disasm, con cita en re/notes/zstats.md)

- **ENCUMBRANCE** (try_equip_or_unequip 0x0d36–0x0d8e): `Σ peso[6 slots] + peso[nuevo]
  > Str(record+0x0c)` → rechazo. Peso = `byte[DS 0x1aae + item]` (tabla volcada de
  DATA.OVL). El reqStrength por-item (0x1abe) **NO se referencia** — era la misma tabla
  0x1aae leída con offset +16.
- **Slot por TIPO** (0x0d91): `byte[DS 0x1a7e + item]` → 0x80 helmet / 0x40 armor /
  0x20 una-mano / 0x30 dos-manos / 0x02 ring / 0x04 amulet / **0x00 no-equipable**.
- **hand_state** (0x0c0a): 2/0/1/0xff; una-mano prefiere la mano de arma (+0x1b) y
  cae a la de escudo (+0x1c) si aquella está ocupada; dos-manos exige el 2.
- **Rechazo de munición** (0x0c82): Arrows(0x1b)/Quarrels(0x1d) → return 0 silencioso.
- **Ammo-gate** (0x0d0c): Bow/MagicBow → Arrows>0; Crossbow → Quarrels>0; si no 0x981c.
- **Ring-vanish** (0x0e01): items 0x2a/0x2c → `rand(0,15)==0` (1/16) → "Ring vanishes!"
  + limpia el slot de anillo; item consumido igualmente.
- **Toggle-off** (0x0cbf): item ya puesto → unequip + qty++ (cap 99).
- **9 clases** "AMBFDTPRS" (DS 0x9812): Avatar/Mage/Bard/Fighter/Druid/Tinker/Paladin/
  Ranger/Shepherd.
- **Strings de error** volcadas exactas (0x9846/0x9866/0x9892/0x98ba/0x98f0/0x9916/
  0x9942/0x981c/0x97e2/0x995e).

## ⚠️ Pendiente / no cableado (declarado, no oculto)

- **"Readied." es invención**: en éxito el binario NO imprime nada (sólo redibuja el
  panel). El clon devuelve "Readied." como mensaje de conveniencia de UI.
- **RNG del Ready no cableado a la UI**: `main.ts:631` llama a `equipItem` SIN pasar
  `randRange`, así que el ring-vanish 1/16 usa roll fijo=1 (nunca desvanece); el
  toggle/ammo/encumbrance sólo se ejercitan en los tests. Cableado del stream real de
  RNG a la UI → Task 3.13/F.
- **Bloqueo de armadura en combate de mazmorra** (0x0c94) y **restauración de
  visibilidad del Ring of Invisibility** (0x1ade): la lógica está portada como
  `EquipOpts.inDungeonCombat` + test, pero el cableado a los flags reales de combate/
  mazmorra (`g_cmb_victory_flag`, tile del actor) es de Task 3.2/3.13.
- **Display de Z-stats** (paginación, ♂/♀, marcos, las 4 listas scroll): es UI; el core
  verificado aquí es el de equipar. Paridad de layout → Task F.
- **RNG en vivo del ring-vanish**: el clon acepta un `randRange` inyectable idéntico a
  la firma del kernel `rand_range(lo,hi)`; el cruce contra el stream real de DOSBox se
  hará en la suite de regresión de Task F.2.

## Notas de método

- Las tablas TYPE/WEIGHT se leen de DATA.OVL (`fileoff = DS + 0x10`, anclado por el
  roster DS 0x55A6 = fileoff 0x55B6); se embeben en `equip.ts` con cita, no se re-derivan
  a mano.
- Los 17 prólogos + 1 nop se verificaron en `re/disasm/ZSTATS.OVL.asm`; la partición del
  ledger no deja huecos ni solapes (assert en `zstats_catalog.build_segments`).
