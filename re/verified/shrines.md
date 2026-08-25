# Verificado: Santuarios, mantras, pozo de deseos y moongates (Task 3.8)

Reglas re-derivadas del asm con citas (`re/notes/shrines.md`) y portadas al clon
(`game/src/core/world/shrines.ts`, `world/wishingwell.ts`, `world/moongates.ts`;
edge de teleport en `core/game.ts`). El arnés `re/tools/test_shrines_parity.py`
cruza dos modelos INDEPENDIENTES: la predicción asm-derivada en Python
(`shrines_parity.py`) y la reproducción del core del clon
(`game/src/core/__parity__/shrines-run.ts`). **Las 4 mecánicas son deterministas
(0 `call rand_range`)**, así que la paridad es de VALOR, no de stream. Misma
filosofía que test_transport_parity / test_npc_parity.

## Convención de fidelidad

- ✅✅ **RUNTIME-VERIFICADO** en DOSBox (valor byte-a-byte en vivo).
- ✅ **asm-directo** (regla leída de las instrucciones, con cita) y/o cruce
  modelo↔clon verde.
- ⚠️ pendiente / no cableado al bucle del juego.

## Estado de la verificación (2026-07-11)

VERDE:
- `re/tools/test_shrines_parity.py` — 46 passed (unidades del modelo + 37 escenarios
  cruzados clon↔modelo) + 2 live opt-in (`U5RE_LIVE=1`; el de fases lunares ejecutado y verde).
- `npm test -w game` — 484 passed (incluye `tests/shrines.test.ts` 23 tests y  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  `tests/moongates.test.ts` 16 tests: máquina de estados santuario→Codex→santuario,
  donación+n==0, quest+atributo, restauración con virtud+mantra+coord, pozo de caballos,
  edge de medianoche).
- Suite RE requerida — sin regresiones (test_globals, test_ledger, test_dataovl_catalog
  verdes; ledger con las 4 funciones de moongate renombradas + CMDS/LOOKOBJ marcadas).

## ✅✅ RUNTIME-VERIFICADO en DOSBox (ejecutado 2026-07-11, opt-in U5RE_LIVE=1)

- **Feed de fases lunares — EJECUTADO Y VERDE** (`test_lunar_phase_feed_live`,
  kernel_time_refresh 0x4a84): siembra g_day (0x587E), fuerza un cambio de hora pasando
  turnos y comprueba que g_felucca_phase (0x5885) y g_trammel_phase (0x5886) quedan
  EXACTAMENTE en los bytes crudos de MOON_PHASES (DATA.OVL 0x1EEA). Corrida en vivo
  (108 s): `(day, fexp, fobs, texp, tobs)` = `[(1,48,48,48,48),(8,52,52,54,54),
  (15,48,48,52,52),(22,52,52,50,50)]` — byte-idénticos. Es el feed que selecciona el
  destino de la moongate → **ancla runtime del subsistema**. Confirma que
  `moonPhasesForDay((day-1)*2, 0x1EEA)` del clon no tiene off-by-2.

## Runtime definido, pendiente de anclaje (best-effort)

- **Teleport de moongate** (`test_moongate_teleport_live`): siembra el party junto a la
  moonstone de Moonglow de noche y pisa la puerta. **Ejecutado 2026-07-11 → SKIP**: al
  sembrar g_party_x/y con write_mem el chunk del mapa no se recarga, así que la puerta no
  se renderiza ni dispara. Queda definido; anclarlo requiere caminar el party hasta la
  moonstone (muchos turnos) o forzar la recarga de chunk. La paridad del teleport se cubre
  por cruce modelo↔clon (los 7 escenarios `moongate-*` llaman a las funciones reales del
  clon activeGatePhase/moongateDestination/isMidnightGateEdge).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas

Citas en `re/notes/shrines.md`:
- **Moongate teleport** (§1.1, kernel 0x47f4, VERIFICADO leyendo el asm): los 4 arrays
  0x5830/0x5838/0x5840/0x5848 son X/Y/**LOCATION**/**FLOOR** de destino; 0x483d copia
  0x5840 a g_location y 0x4852 copia 0x5848 a g_floor. 0xFF en loc = sin puerta. Globals
  renombrados a g_moonstone_loc/g_moonstone_floor (antes "buried"/"z" de Redux).
- **Edge de medianoche** (§1.4, kernel 0x494d): 00:00-00:09 cierra sin teleportar.
  Portado (`isMidnightGateEdge` + guarda en `checkMoongate`). Escenario
  `moongate-midnight-edge` vs `moongate-past-edge`.
- **Selección de fase** (§1.4): Felucca si hour<12, Trammel si hour>=12; equivalente a
  hour<=4 / hour>=20 porque la puerta solo existe de noche. Cruzado en 4 escenarios.
- **Donación de santuario** (§2.2, CAST2 0x0b47-0x0b91): 100·n oro por +n karma, clamp
  99, no cobra si falta oro. **VERIFICADA contra el binario** — cierra el ⚠️ de FIDELITY
  que provenía de Redux. Escenarios donate-valid/insufficient/clamp/zero.
- **Completar quest** (§2.2, CAST2 0x0c18): +3 karma (+3 extra Humility), sube 1 el
  atributo del Avatar según banderas DATA.OVL 0x4B8E/0x4B96/0x4B9E (cap 30). Volcado de
  las 3 tablas verificado contra el binario. Escenarios quest-honesty/sacrifice/
  spirituality/humility/attr-cap/karma-clamp.
- **Restaurar santuario destruido** (§3, CMDS 0x1202): virtud + mantra×3 + coord exacta
  → g_shrine_destroyed[v] &= 0x7F + tile 0x19. Un solo fallo → sin efecto. Escenarios
  restore-ok/wrong-virtue/wrong-mantra/wrong-coord.
- **Pozo de deseos** (§4, LOOKOBJ 0x0042): 1 oro; substring-match case-sensitive de
  {Corvette,Ferrari,Lamborghini,Lotus,Porsche,Horse}; solo en Paws (0x16)/Empath (0x1F)
  spawnea caballo; fuera de sitio "No effect" con la moneda gastada. Escenarios
  wish-paws-horse/empath-ferrari/wrong-loc/invalid-word/empty/no-gold.
  ✅ **Cadenas byte-exactas** leídas de DATA.OVL (Corvette 0x7252, Ferrari 0x725c,
  Lamborghini 0x7264, Lotus 0x7270, Porsche 0x7276, Horse 0x727e). ✅ **Tile del objeto
  = 0x10 (caballo)**: LOOKOBJ 0x0132 `mov ax,0x10` → kernel_spawn_object 0x97e4; coincide
  con transport.ts TILE_HORSE. (Verificación asm completa en
  `.superpowers/sdd/task-3.8-asm-verification.md`: los 7 puntos CONFIRMADO.)

## ⚠️ Pendiente / no cableado

- **Disparo al pisar la casilla**: shrine_visit (santuario vivo) y shrine_restore se
  invocan desde el bucle de contexto exterior (TOWN/MAINOUT); el cableado de esos
  triggers es de **Task 3.13**. Aquí quedan como primitivas verificadas.
- **Textos de quest / respuesta del santuario** (DATA 0x4b5e/0x4b6e word ptrs, base
  0xb21e) y el **spawn físico del caballo** del pozo (objeto de mundo) NO están portados.
- **`gurgling_fountain`** (LOOKOBJ 0x0162) está marcada en el ledger y documentada pero
  no portada (es curación de miembro; adyacente a LookObj de Task 3.12).
- **g_moongate_anim** (0x5887, animación 0..16): cosmética; el clon no la modela (no
  afecta reglas ni tiempo de juego).
