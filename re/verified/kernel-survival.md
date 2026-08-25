# Verificado: kernel — reloj, turnos, hambre, luz y movimiento (Task 3.1)

Ítems de fidelidad CERRADOS: regla exacta re-derivada del asm de
ULTIMA.EXE/overlays (citas en re/notes/kernel-survival.md) y verificada
en vivo contra el binario real en DOSBox (escenarios de
re/parity/kernel/*.json ejecutados por re/tools/parity.py, sesión del
2026-07-09). El clon reproduce cada escenario campo a campo.

## ✅ Movimiento bloqueado y coste del turno

- **Pueblo**: un movimiento bloqueado ("Blocked!") consume 1 minuto, igual
  que un paso válido. Asm: TOWN.OVL 0x600 (handler) devuelve DISTINTO de 0
  también al bloquear, y el bucle 0x142C cobra `advance_clock(1)` en 0x15D4
  cuando el retorno es no-cero (jne en TOWN 0x15B6).
  Paridad: `02-town-blocked-move` (posición intacta, minuto +1) y
  `03-town-move` (paso válido, +1/paso).
- **Exterior**: un movimiento bloqueado NO consume tiempo ni turno del
  mundo. Asm: MAINOUT.OVL 0xC30-0xC36 (si el handler devuelve 0 se salta
  advance_clock, housekeeping y el turno de los monstruos).
  Paridad: implícito en `07-overworld-exit-and-slow-terrain` (la suma de
  minutos de los pasos válidos cuadra exacta; no queda hueco para costes
  fantasma).

## ✅ Terreno lento ("Slow progress!" / "Very slow!")

NO es probabilístico: es un coste FIJO de minutos + turnos extra del
mundo. Asm: MAINOUT.OVL 0x3E0 —

- clase 0 (normal): coste base 2 min (bucle 0xC39);
- clase 1 (tiles 4, 6, 7, 8, 0x1E, 0x1F): +2 min y 1 turno extra de
  monstruos → 4 min/paso, mensaje "Slow progress!" (DS 0x29BF);
- clase 2 (tiles 9..0xF): +4 min y 2 turnos extra → 6 min/paso,
  mensaje "Very slow!" (DS 0x29CF).

Paridad: `07-overworld-exit-and-slow-terrain` — pasos sobre el bosque
profundo (tiles 9/10) alrededor de Iolo's Hut a 6 min/paso, reloj
byte-idéntico. Clon: `terrainSpeedClass` en world/movement.ts.

Nota de alcance: el runtime DOSBox ejercita la clase 2 ("Very slow!");
la clase 1 ("Slow progress!", +2 min) es el MISMO código asm con otras
constantes (MAINOUT 0x448 vs 0x468: idéntico patrón advance_clock +
turnos extra) y queda cubierta por los tests del clon (survival.test.ts).

## ✅ Reloj: minutos por acción y rollovers

- Pueblo 1 min/acción (TOWN 0x15D4), exterior 2 min/acción (MAINOUT
  0xC39); Pass (Space) cuesta lo estándar del contexto (kernel 0x31F4
  devuelve 1). Paridad: `clock-3-pass-turns` (Task 0.4, sigue verde con
  1 min/turno en pueblo), `03-town-move`, `07-…` (2+4 min exteriores).
- Salir de un pueblo por el borde no consume minuto (TOWN 0x600 retorna
  0 al salir y el bucle solo cobra con retorno no-cero — jne TOWN
  0x15B6). Paridad: `07-…` (delta de minutos exacto).
- Rollovers 60 min → hora / 24 h → día / 28 días → mes / 13 meses → año
  (kernel_advance_clock 0x4FC8-0x509A). Paridad del cruce de hora:
  `05-meal-6am-food` y `06-starving-damage` (59→0 con hora +1).

## ✅ Comida y hambre ("Starving!")

- Comidas: al CAMBIAR la hora a 6, 12 o 18 → `food -= comensales`
  (miembros con status ≠ 'D' y ≠ 'S'; los envenenados comen). Asm:
  kernel_turn_housekeeping 0x2B5D-0x2B99 (detección por g_prev_hour
  0x5880). Paridad: `05-meal-6am-food` (un solo descuento en el turno
  del cruce, food byte-idéntico).
- Hambre: con `food == 0`, CADA cambio de hora imprime "Starving!"
  (DS 0x54C8) y daña `rand_range(1,8)` a cada miembro vivo
  (kernel_party_random_damage 0x2AA8). Paridad: `06-starving-damage` con
  `capture_seed`: breakpoints de código capturan g_rng_seed (DS:0x5420)
  en vivo — en la entrada de kernel_party_random_damage o en la de
  rand_range 0x2092 con retorno ∈ [0x2AA8,0x2AE8) (deshaciendo k
  transiciones con rng_unstep si se observó el roll k) — y siembran el
  clon con ESA semilla; los HP resultantes de TODO el party coinciden
  byte a byte entre binario y clon — verifica a la vez la fórmula del
  daño, el orden de los rolls y el RNG portado. (Hallazgos de los runs:
  sembrar g_rng_seed por write_mem NO basta — el binario consume RNG en
  cantidades no modeladas antes del roll, p.ej. idle/animaciones — y un
  único breakpoint one-shot es frágil porque el canal pty puede perder
  pausas.)

## ✅ Antorchas en MINUTOS

- Ignite (CMDS.OVL 0x0D98): consume 1 antorcha; fuera de mazmorra fija
  g_torch_mins = 240; en mazmorra suma 112+rand(0,15) con tope 255.
- La antorcha se consume en MINUTOS de juego, no en turnos:
  kernel_advance_clock 0x4FB4 la decrementa en n por acción (en pueblo
  240 turnos, en exterior 120).
- Paridad: `04-torch-ignite-town` (torches −1; el minuto del propio
  Ignite ya consume: 240 → 239, y tras 2 turnos más de 1 min → 237,
  byte-idéntico binario/clon).

## Verificado por asm + tests del clon (runtime DOSBox pendiente)

- **Wrap del overworld 256×256**: MAINOUT.OVL 0x354 hace
  `add byte ptr [g_party_x], al` / `add byte ptr [g_party_y], al` —
  aritmética de 8 bits que wrapa de forma natural en ambos ejes; la
  gestión de la ventana de chunks usa las mismas máscaras. Test del clon:
  tests/survival.test.ts ("wrap 256×256"). Caminar hasta el borde del
  mapa en DOSBox es impracticable con el arnés actual y teleportar por
  memoria dejaría la caché de chunks inconsistente, así que el ítem
  permanece ⚠️ en FIDELITY con la evidencia asm anotada.

## Reglas nuevas re-derivadas (sin ítem previo en FIDELITY)

Documentadas en re/notes/kernel-survival.md y portadas al clon con tests:

- Luz 2..50 con rampa de amanecer/atardecer (DS 0x6A80) y mínimos por
  antorcha (10) y hechizo de luz (18) — kernel 0x50A1.
- Veneno: 1 HP por turno por miembro 'P' (housekeeping 0x2B36).
- Anillo de regeneración (equipo 44): 1/8 de +1 HP por turno (0x400C).
- monthsAtInn++ (tope 25) en cada cambio de mes (0x5072).
- Quickness/Time-stop ('Q'/'T' en DS 0x587A): minutos/2 y reloj congelado.
