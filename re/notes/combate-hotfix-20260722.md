# HOTFIX combate 2026-07-22 — 4 reportes en vivo + ritmo del log + R1

**Carril:** combate-hotfix (fiel/combate-hotfix) · post-aterrizaje T1-T11 (d1869eb5).
**Testigo del usuario:** `original/av-referencia/port-bugs/combate-bugs-20260722.mov`
(22 s, piel fiel :5199, beat vivo 400 ms). Frames del log original: n6log_* (scratchpad
del careo) + clip huida-por-borde (aulddragon P02, frames 5 fps re-verificados aquí).
Offsets: DS = fileoff DATA.OVL − 0x10; COMBAT/SJOG/COMSUBS = offsets de fichero .OVL;
kernel = ULTIMA.EXE fileoff − 0x800. Thunks resueltos con `re/tools/dispatch_table.py`
(COMBAT load 0xA290, SJOG 0xBF80, COMSUBS 0xE1E0).

## #1 CRÍTICO — «los enemigos no actúan» = REGRESIÓN del paceo T11 (+ hueco de arranque)

Dos causas apiladas, ambas reproducidas con `?combeat=400`:

1. **El pacer T11 nunca se armaba.** `Combat.tickEnemyTurns()` drena la tanda ENTERA
   (while con guard 512, combat.ts); `stepCombatPump` (main.ts) asumía «una acción por
   llamada», así que tras la primera llamada el actor ya era un PJ y la condición de
   re-agendado jamás se cumplía → la tanda entera salía SÍNCRONA en el mismo keypress
   (invisible: repaint único). El e2e no lo cazó porque bajo webdriver beat=0 ES el
   drain síncrono (byte-idéntico por diseño) — hueco de cobertura.
2. **Arranque con iniciativa enemiga CONGELADO.** El main-loop del original conduce los
   turnos de IA SOLO: COMBAT 0x0B94 @0x0c84 `call 0xffffb3b6` (¿actor de IA?) →
   @0x0c8b `call 0x3f4` (combat_ai_turn) SIN esperar tecla; el port solo bombeaba la
   tanda al recibir input (enterCombatMode no bombeaba salvo charmed). Con «Attacked!»
   (encuentro enemy-init) el primer actor es un enemigo → arena congelada con el
   recuadro sobre el orco (testigo t≈2-8 s) hasta la primera tecla del usuario.

**Fix:** core `tickEnemyTurnStep()` = UNA acción de IA (una iteración exacta del while
de `tickEnemyTurns` — paridad probada en unit: encadenar pasos ≡ drain, eventos y RNG
idénticos). La piel, con beat>0, agenda un beat de 400 ms ANTES de cada acción
(incluida la primera: la cadencia del main-loop también espacia la apertura — cura el
«salto» #2) y bombea sola en `combat-started` si el primer actor es IA. Con beat=0
(webdriver) TODO queda como antes (drain síncrono al keypress; los drivers e2e/tour
cuentan con esa semántica de teclas — divergencia declarada T11, sin drift de digests).
Cobertura nueva: `e2e/combat-beat.spec.ts` (?combeat=400: observa turnos de IA EN VUELO
y ≥2 estados intermedios de posiciones — imposible pre-fix).

## #2 — «salto del monstruo al empezar»

Mismo root que #1: con iniciativa enemiga la tanda de apertura quedaba congelada y la
primera tecla la resolvía EN RÁFAGA → el enemigo aparecía en el spawn y «saltaba» de
golpe (testigo t≈6-10 s: los 2 orcos se materializan junto a la party). Con el beat
pre-acción de 400 ms el enemigo es visible en su spawn y camina 1 celda/acción, como la
serie n6 (380-430 ms entre acciones). Sin cambio de core adicional (la IA ya movía 1
celda/turno).

## #3 — Set Active Plr (1-6/0) en combate: SEMÁNTICA DERIVADA (la previa estaba INVERTIDA)

Cadena real: COMBAT dispatch @0x0aa2 ('0'→0x09ec) / @0x0aaa-0x0ab4 ('1'-'6'→0x09fe
`call 0xffffdab6` = stub 0x7d46 → **SJOG.OVL 0x1F7A**).

- SJOG 0x1F7A imprime **"Set active plr:\n"** (DS 0x8f3a) SIEMPRE; barre los 32 slots
  de arena buscando party (flags&0x80) con ese charIdx (@0x1f9a-0x1fb9); flags&0x2c
  (dormido/ido) ⇒ inválido (@0x1fbd). VÁLIDO: `g_active_char=idx`, imprime el NOMBRE
  (COMSUBS 0x0094), ret **1**. INVÁLIDO: imprime **"Invalid!\n"** (DS 0x8f4c), ret 0.
- Caller COMBAT @0x0a07-0x0a11: ret≠0 (válido) → cae al tail @0x0b56 con [bp-2]=0 →
  @0x0b79-0x0b83 la tecla ∈ '0'..'6' SALTA el housekeeping (SJOG 0x2012 = decay de
  `g_time_spell_turns` + repintados) y la función de turno RETORNA ⇒ **el actor en
  curso CEDE su turno sin acción**. ret==0 (inválido) → @0x0a41 [bp-2]=1 → salto a
  0x06F1 = **re-imprime banner + prompt del MISMO actor, sin gastar turno**.
- '0' @0x09ec: `g_active_char=0xFF`, imprime "Set active plr:\nNone!\n" (DS 0x6e66),
  cae al MISMO tail ⇒ también cede el turno.
- '7'-'9' (default @0x0ab7): "What?\n" (DS 0x6ee6) y re-prompt sin banner ([bp-4]=0
  @0x08ad), sin turno.

⇒ La derivación del paquete anterior («válido = re-prompt sin turno; inválido = pierde
el turno») era EXACTAMENTE la inversa (leyó el ret de dab6 al revés). El usuario tenía
razón: elegir con 1-6 **cede el turno ya** (y desde esa ronda los demás auto-pasan por
el gate @0x0666-0x067f, `skipsForActiveChar` — eso ya estaba bien). Port:
`Game.combatActivePlayer` → `{echo, yieldTurn, reprompt}` + `Combat.playerYieldTurn()`
(advanceTurn puro, 0 rands, SIN el decay del housekeeping — fiel al skip @0x0b79).
Validez contra la ARENA (slot activo y no dormido), fallback a roster sin combate.

## #4 — (A)ttack: el AUTO-TARGET del cursor era FABRICADO; melé NO es getdir

Cadena real: COMBAT 'A' @0x08e0 `call 0xffffdb6a` → **COMSUBS 0x0D96** (triple golpe):
por cada ítem con ATTACK_VALUES≠0 (casco/izq/dcha) → 0x0D3C (con ≥2 armas: '\n' +
NOMBRE del arma + ":\n" @0x0d56-0x0d75) → imprime **"Attack-"** (DS 0x9a98; manos
desnudas DS 0x9aa0) → **0x0C52**(arma, actor):

- range del arma ([id+0x1664]); **range==0 (melé): imprime "Aim! " (DS 0x9a84) y llama
  al MISMO cursor 0x0504 con range=1** — NO hay getdir: el melé es el cursor acotado al
  anillo adyacente. range>0 (ranged): 0x0A68 imprime "Aim! " (DS 0x9a7e) y 0x0504 con
  el alcance real.
- **Cursor 0x0504: arranque = ÚLTIMO OBJETIVO del actor** (scratch 0x5C5A+idx*8 +7 =
  DS 0x5c61; lo escriben el confirm melé @0x0d04-0x0d16 y el disparo @0x0b12/0x0b34)
  **si sigue vivo y a distancia ≤ alcance (@0x0539-0x0560, distancia pura 0x04D4, sin
  LOS); si no, la CELDA DEL PROPIO ACTOR (@0x0562).** No existe ningún barrido de «más
  cercano» — el auto-target del port era invento (la cita 0x0539-0x0568 describía la
  validación del recordado, no un scan).
- Confirm = Enter/'A'/Space (@0x0640-0x0664/0x06f2); sobre la PROPIA celda Enter/'A' se
  ignoran (@0x06a3 loop) y Space CANCELA (@0x068a). **ESC (@0x06ea) ret 0 ⇒ el golpe SE
  CONSUME**: melé imprime "Nothing!\n" (DS 0x9a8a, @0x0cfa) — igual que confirmar celda
  vacía —; ranged sale en silencio sin gastar munición (@0x0ab8); el turno cae al agotar
  la cola ([bp-4]=1 del dispatch). El «ESC no gasta turno» del port citaba 0x06ea sin
  seguir el retorno.

**Port:** `aimGeometry` reescrito (lastTargetId-o-actor); `Combatant.lastTargetId` con
las escrituras fieles; ESC/Space-en-actor → `playerAttackCancel()` (consume el golpe);
Enter/'a' en la propia celda ignorados; **cadena de armas**: tras resolver/cancelar un
arma con cola pendiente se re-abre el Aim del siguiente (echo "Attack-Aim! ") — SOLO
con beat>0 (mismo gating que T11: bajo webdriver los drivers re-abren con 'a';
divergencia declarada). Drivers del tour/soak re-coreografiados: calculan su objetivo
(el antiguo scan, ahora táctica del bot) y LLEVAN el cursor con flechas vía la celda
del actor (0 llamadas al core) → mismos `playerAttack(celda)` ⇒ **ch35 control
byte-idéntico ×2**: `7:VICTORY|0:VICTORY|2:VICTORY|1:DEADEND` (=baseline
docs/plan-tour-salas.md).

## ADD-ON — ritmo del log (frames n6log_* + clip aulddragon P02)

- **Línea en blanco ante cada banner de turno**: combat_player_turn abre con
  putchar('\n') — @0x06f1 `push 0xa; call 0x742a` (kernel 0x16ba) — antes del nombre
  (COMSUBS 0x0094 vía @0x06fe) + ", armed with " (DS 0x6da4 @0x0717) + ":" (DS 0x6dbe).
  El port lo emite salvo que la fila anterior ya sea vacía (el "\n" final de
  "*** CONFLICT ***\n" ya produce la suya — una sola fila en blanco, como los frames).
- **"►Pass"**: "Pass\n" (DS 0x6e60, @0x09e2) se imprime sobre la fila del prompt ► →
  evento `echo` (antes `message` llano).
- **"►Set active plr:" + resultado debajo**: el "\n" de la cadena DS baja de fila; en
  la consola del port se emite echo (sin el \n literal) + message (nombre/None!/
  Invalid!/— "What?" solo, sin prefijo, para 7-9).
- Prompt loop @0x07c3: putchar('\n') + kernel 0x4c2a por iteración (la fila nueva del
  ► en cada re-prompt) — ya cubierto por el modelo de filas del port.

## R1 (auditoría) — autoWalk vivo durante combate

El interval de autoWalk (140 ms) solo se cancelaba en map-changed/Blocked!; un combate
iniciado a mitad de auto-marcha dejaba a la party derivando por el mapa subyacente
(walk-echos espurios + reloj/hazards). `enterCombatMode` ahora cancela el autoWalk.

## Pendientes declarados (fuera del timebox)

- **Línea de NOMBRE DE ARMA por golpe con ≥2 armas** ("\nMain Gauche:\n" @0x0d56): el
  port encadena los "Attack-Aim! " sin la línea del nombre. Cosmético, Clase B.
- **Recuadro del activo sobre ENEMIGOS durante la tanda**: el pintor del port usa
  `activeActor` sin filtrar kind; la estructura del asm sugiere que el recuadro vive en
  el await del PJ (combat_player_turn/getkey), no en el turno de IA — falta testigo
  limpio del original con tanda visible (los n6log son crops del log). Clase B/C.
- **Decay de `g_time_spell_turns` por acción de PJ en combate** (SJOG 0x2012, llamado
  @0x0b85 en toda acción no-dígito): el port no lo modela en combate (gap pre-existente
  visible al derivar el tail; anotado, no tocado en el hotfix).
- ESC de un CAST apuntado: se mantiene el cierre sin turno (flujo CAST, fuera de
  alcance; el maná ya se perdió).

## Gates

tsc 0 · unit 2701/2701 (207→212 files; re-baseline citado: aim «más cercano»
falsificado, active-player invertido, Pass=echo) · e2e combat-beat (NUEVO) + combat +
combat-ranged + attack + active-player + dungeon-room-escape verdes · ch35 control ×2
byte-idéntico · verificación en vivo (1 navegador, ?combeat=400): tanda paceada
autónoma (17 muestras en vuelo, 7 estados), Set Active cede turno + ecos fieles, aim
arranca en el actor, ESC consume con "Nothing!" y encadena el arma 2, blancos del log
= frames originales.
