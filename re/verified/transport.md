# Verificado: Transporte y navegación — MAINOUT + CMDS + kernel (Task 3.7)

Reglas re-derivadas del asm con citas (`re/notes/transport.md`) y portadas al clon
(`game/src/core/world/wind.ts`, `game/src/core/world/transport.ts`, integración en
`game/src/core/game.ts`). El arnés `re/tools/test_transport_parity.py` cruza dos
modelos INDEPENDIENTES: la predicción asm-derivada en Python (`KernelRng` + reglas
MAINOUT/kernel) y la reproducción del core del clon
(`game/src/core/__parity__/transport-run.ts`, `OriginalRng`), exigiendo que calquen
el STREAM DE VIENTO y su semilla final (el único RNG del TICK DE VIENTO; el
broadside y la reparación consumen su propio rand aparte), la cadencia de
deriva, el daño del broadside y la reparación de casco. Misma filosofía que
test_npc_parity / test_dungeon_parity.

## Estado de la verificación (2026-07-11)

VERDE:
- `re/tools/test_transport_parity.py` — 17 passed (puros; sin dosbox) + **2 live**
  (opt-in `U5RE_LIVE=1`): `test_wind_world_tick_orbit_live` (órbita del stream) y
  **`test_wind_value_live` (VALOR byte-a-byte, PASA en 187 s)**. KernelRng casa con
  la inversa VERIFICADA `parity.rng_unstep`; 12 escenarios cruzan clon↔modelo.
- `npm test -w game` — 484 passed (incluye `tests/transport-exact.test.ts`, 51  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  tests: viento, cambio de viento con RNG, deriva, girar/becalmado, Board (gates a
  pie, DANGER/WARNING independientes, alfombra 0x14/0x15), X-it (skiff exige tierra),
  Yell, broadside, reparación, HMS Cape (fase), naves NPC, compra con skiffs).
- Suite RE requerida — sin regresiones (ledger/globals verdes; MAINOUT +6 segmentos,
  invariante 202800 intacto).

## ✅✅ RUNTIME-VERIFICADO en DOSBox (asm + valor byte-a-byte)

- **Cambio de viento — VALOR por turno** (kernel 0x2F62): `test_wind_value_live`
  arma un breakpoint en la ENTRADA de maybe_change_wind, FUERZA g_rng_seed (0x5420)
  a semillas elegidas y comprueba que g_wind (0x5892) del turno siguiente es EXACTO
  el que predice el modelo. Cadena observada en vivo (target, pred, obs):
  `[(1,1,1),(2,2,2),(3,3,3),(4,4,4),(0,0,0),(3,3,3),(1,1,1),(4,4,4),(2,2,2)]` —
  Norte/Sur/Este/Oeste y Calm, todos byte-idénticos contra el binario. Además la
  órbita del stream (semilla→sucesor) cae en el rand del kernel cada world-turn.
  ⇒ La lógica del tick de viento (rand(0,63) + rand(0,4) + sesgo Calm) y el encoding
  0=Calm/1=N/2=S/3=E/4=O quedan CERRADOS con runtime real (primer cierre desde 3.2).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas

Con paridad de stream (KernelRng↔OriginalRng) o listado asm reproducido. Citas en
`re/notes/transport.md`:
- **Cambio de viento** (§4, kernel 0x2F62): 1×rand(0,63)/world-turn SIEMPRE; hit
  1/64 → rand(0,4); si propone Calm, rand(0,255)≥192 la acepta, si no re-tira
  (sesgo anti-calma). Consumo de RNG byte-idéntico verificado por el cruce
  (semilla final clon↔modelo tras 200-512 ticks) y por la inversa `rng_unstep`.
- **set_wind** (§4, kernel 0x2E96): escribe g_wind 0x5892 + resetea g_wind_drift_ctr
  0x5883; único escritor de g_wind. Rel Hur reusa esta semántica (drift ctr reset).
- **Tablas de empuje** (§3, DATA.OVL 0x29F5/0x29F9): el viento empuja opuesto a su
  nombre (N→(0,+1)…). Bytes exactos portados.
- **Deriva del barco** (§3, MAINOUT 0x0619): `di = 1 + mismatches; umbral = di%3;
  ctr>=umbral → deriva y reset`. Cadencia a favor/perpendicular/en contra. Sin RNG;
  cruzada clon↔modelo (secuencia de avances).
- **Girar / becalmado** (§2, MAINOUT 0x00DA/0x01DC): girar cuesta turno; velas
  izadas sin viento = becalmada; velas arriadas/skiff reman siempre.
- **Broadside** (§7C, CMDS 0x0962): solo perpendicular a la quilla; 1×rand(1,20) por
  impacto; underflow del casco → hundido. Daño y semilla cruzados clon↔modelo.
- **Reparación de casco** (§8, kernel 0x3C9A): 25 min; rand(1,3) cap 99, bucle
  mientras hull<10 (barco sano = 1 tirada). Casco y nº de tiradas cruzados.
- **HMS Cape** (§5, MAINOUT 0x0670): con Cape 1 min/tramo y world-turn alterno; sin
  Cape 2 min cada tramo. Gate `>0x7F` (bit alto).
- **Board / X-it / Yell** (§7A/B/D, CMDS): estados de g_transport_tile, estiba de
  skiff/alfombra, prioridades de desembarque, Hoist/Furl. Reproducidos por
  `transport-exact.test.ts` contra el listado.
- **Naves NPC de vela** (§3b, MAINOUT 0x198C): tabla 0x2BF6 (facing×viento), frenado
  por acumulador, determinista sin RNG.
- **Nave comprada** (§6, MAINOUT 0x0D22): spawnea en muelle con casco 99.

## ⚠️→formulado (asm-derivado; paridad runtime pendiente)

Cruce modelo↔clon verde; el VALOR del viento además cerrado con runtime (arriba).
El resto queda a nivel de cruce asm↔clon (nivel npc/dungeon):
- **Deriva / coste naval / naves NPC**: no observables en overworld sin navegar con
  una fragata sembrada (estado no repoblable headless sin evento de compra/board);
  formulado por asm + cruce clon↔modelo.

## Preguntas abiertas (§10 de las notas)

Semántica exacta de la deriva (rumbo vs empuje); identidad de los objetos 0x2C;
valor real de g_hms_cape tras conseguir los planos. Anotadas para el oráculo; el
formulado sigue el asm y no bloquea la paridad del stream. (RESUELTO en review: el
predicado 0x73E tiene la MISMA polaridad en los 3 callers —notas §7B—; el gate
[0x5891] se re-arma en 0x5910 y rueda también en pueblos —notas §4, ⚠ Task 3.13—.)
