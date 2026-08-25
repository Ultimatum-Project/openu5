# Verificado: magia — CAST.OVL + CAST2.OVL (Task 3.3)

Reglas re-derivadas del asm con citas (re/notes/magic.md) y portadas al
clon (`game/src/core/magic/{cast,tables}.ts`) con tests. El arnés de
paridad `re/tools/magic_parity.py` compara los GLOBALES observables tras un
cast (g_light_spell_mins, g_time_spell/turns, g_wind, food, registro del PJ)
entre el binario y el clon; escenarios en `re/parity/magic/`.

## ✅(asm, spot-check disasm) Dispatcher CAST:0x0dba

Orden EXACTO verificado instrucción a instrucción en re/disasm/CAST.OVL.asm
(0e0a-0f1a) — cierra tres divergencias del clon:

- **Ventana temporal table-driven** (tabla DS:0x1C90 de 4 bits/hechizo), no
  strings del JSON.
- **Consumo del hechizo mezclado ANTES del check de maná** (0ec8 vs 0ed3):
  un intento sin maná gasta igualmente la carga mezclada.
- **Coste de maná = círculo**; **gate de nivel** (nivel≥círculo o falla habiendo
  gastado maná y hechizo). El gate NO imprime en su sitio, PERO fija result=0 y cae
  al TAIL común (0x11a6) → **"Failed!"** (DS 0x4660). NO es silencioso a nivel de
  juego (corregido 2026-07-18, hilo cast-gate; ver magic.md §0 "TAIL común").

## ✅(asm, spot-check disasm) Fórmulas numéricas corregidas

Estas eran aproximaciones en el clon y ahora son exactas (tests unitarios
en game/tests/magic.test.ts + escenarios de clon en re/parity/magic):

- **Daño de ataque table-driven** (attackValues[weaponId], confirmado en
  data.json): Grav Por 0x30→rand(1,16), Vas Flam 0x31→rand(1,30), Xen Corp
  0x32→99 (muerte). NO círculo·6; pasa por el motor de combate.
- **Mani** = rand30() (1..30) cap maxHP (no 25 fijo); **Vas Mani** = maxHP
  (no 50); ninguno cura a un 'D'.
- **Luz** In Lor 100 / Vas Lor 255 **minutos** (no turnos).
- **Estados temporales** en un ÚNICO global: In Sanct 'P'/20, Rel Tym 'Q'/30,
  Quas An Wis 'C'/20, In An 'N'/10, An Tym 'T'/10.
- **Resurrección** (CAST2:0x05e0, spot-check disasm 05fd-06be): 'D'→'G', HP=1,
  MP por clase (A/M=INT, B=INT/2), exp·karma/100 si karma<98, nivel =
  bitlength(exp/100)+1, maxHP=30·nivel. ⚠ La prosa del draft
  ("floor(log2)+1") era off-by-one; el bucle asm da +1 más (portado tal cual).

## ✅ Efectos antes "unsupported" ahora con fórmula

33 hechizos que el clon marcaba `unsupported` tienen ahora descriptor de
efecto con parámetros EXACTOS del binario (viento, comida, invocaciones,
campos, blink, charm, polymorph, invisibilidad, death vision, gate travel,
mazmorra ±nivel, líneas AoE, terremoto, repeler/miedo, peer). Los que tocan
el mapa/combate se devuelven como descriptor para que la integración de
mundo/combate los aplique (helpers de tirada expuestos y testeados:
`kalXenSummonType`, earthquake rand(1,20), daemon contest rand30()<INT).

## Estado de la verificación runtime

- **Clon (siempre verde)**: `test_magic_parity.py::test_clone_matches_expected`
  — 10 escenarios (luz, estados P/Q/C/N/T, viento, comida, gate de nivel)
  producen en el clon el global asm-derivado exacto. 12 tests puros verdes.
- **Offsets de los globales de magia VERIFICADOS EN VIVO** (sonda 2026-07-10):
  con el oráculo, `read_magic_state` leyó del save inicial in_lor_qty=6 e
  iolo_mp=8 EXACTOS (roster+0x24A y roster+0x02+2·0x20+0x0F), confirmando el
  mapeo roster+offset de light_mins/time_spell/turns/wind/food. El comparador
  clon↔RAM es, por tanto, byte-fiel.
- **Live DOSBox (opt-in U5RE_LIVE=1)**: `test_in_lor_light_live` está
  SCAFFOLDED pero el protocolo de inyección de teclas del comando Cast
  (C → PJ → sílabas → Enter) aún no dispara el cast en la sonda (in_lor_qty
  no decrementó): U5 corre en modo gráfico EGA sin lectura de pantalla de
  texto, así que afinar la secuencia exacta requiere más RE del picker
  (CAST:0x8a08) y del parser de sílabas (CAST2:0x00de). Queda ⚠ pendiente,
  igual que el movimiento de IA quedó fuera de la paridad de combate (3.2).

## ⚠️→formulado (asm-derivado, paridad runtime pendiente)

PORTADO al clon con tests unitarios pero SIN paridad runtime todavía (o sólo
verificado en el clon, no contra el binario en vivo):

- Ataques de combate (Grav Por/Vas Flam/Xen Corp) — el daño lo resuelve el
  motor de combate (Task 3.2); la integración cast→combate se cierra cuando
  el motor consuma el descriptor `combatAttack`.
- Campos (In *Grav), líneas AoE (In Zu / In Nox Hur / In Flam Hur / In Vas
  Grav Corp), invocaciones (Kal Xen, In Bet Xen, Kal Xen Corp daemon),
  terremoto, blink, charm, polymorph, repeler/miedo, revelar invisibles,
  death vision (buffer DS:0xAB02), gate travel, mazmorra ±nivel: descriptor
  exacto; su aplicación pertenece a la integración de combate/mundo/mazmorra.
- Mani/comida con RNG: el clon casa el valor con semilla fija; la paridad
  contra el binario requiere capturar la semilla en el momento del roll
  (patrón de combat_parity, pendiente de correr en vivo).

## ⚠️ Preguntas abiertas (draft §9) — estado

- **Gate de nivel — RESUELTO 2026-07-18 (hilo cast-gate, NO silencioso).** El gate
  (0f01-0f0a) no imprime en su sitio, pero fija result=0 y cae al TAIL común (0x11a6)
  que con result=0 imprime **"Failed!"** (DS 0x4660). El maná-bajo (0ede) imprime
  además "M.P. too low!" (DS 0x4647) antes del "Failed!" del tail. Strings verificados
  directos en DATA.OVL (fileoff=DS+0x10). El "silencioso" previo era ERROR de resumen.
- **Estados P/C/N vs por-PJ**: el asm (CAST2:0x08f8) escribe el global único
  g_time_spell; portado así. Falta verificar en vivo el comportamiento de
  'P'rotección/'C'onfusión en combate (semántica de consumo en Task 3.2/3.x).
- **Redondeo exp·karma/100** en resurrección: portado como floor (idiv 32-bit).
  Falta paridad en vivo.
- **An Tym — precondición 0xFC NO modelada** (CAST:0x0d60-0d9b): si algún
  objeto de la tabla 0x5C5A tiene tile 0xFC → "Magic absorbed!" y falla (maná y
  hechizo gastados). ⚠ Qué objeto es 0xFC (candidato moongate/campo) queda como
  pregunta abierta; pendiente de modelar en la integración de mapa/combate.
- **In Quas Xen / In Quas Wis**: efecto exacto sin confirmar (descriptor
  `illusion` / `castAnimOnly`; ⚠ confianza baja del scout).
- **Death vision (0x56ac/0x5910)**: si además revela sprites de monstruos.
- **CAST2:0x0000 (flourish)**: si consume rand del stream (para paridad).
