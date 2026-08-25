# Arena entry-direction + triggers — NOTA DE RELEVO (carril doom-descent, 2026-07-21)

> 📜 **NOTA HISTÓRICA (2026-07-24, lote audit-fixes).** Esta nota de relevo describe un
> estado YA SUPERADO: los TRIGGERS de sala .CBT están **IMPLEMENTADOS Y EN MAIN**
> (`Combat.fireTriggers`, combat.ts — handler fiel SJOG 0x1d42 tras move-con-éxito,
> gate roomCombat, ambos bandos, one-shot 0xFF; carril fiel/room-triggers, y COMBAT
> 0x111A step-only en `re/notes/trigger-handler-combat-0x111a.md`), y el **P0a de
> spawn/entry-direction aterrizó en main 0ab4b008** (spawn arena = opposite-of-facing,
> auditoría de supuestos 7/7 con cita ASM — ver memoria del carril P0a y
> `combat/roomEntry.ts`). Las «dos hipótesis vivas» del mapping y el «NADA aterrizado»
> de abajo son historia de proceso, no estado vigente. Se conserva por las derivaciones
> intermedias (census 72/72, contradicción del testigo humano, etc.).

Sesión larga → esta nota captura TODO lo derivado para que un carril fresco retome sin re-derivar.
Rama `fiel/arena-entry` (desde main 359c83f1). Commits: a22149df (andamiaje), 753c9404 (cableado).
**NADA aterrizado** (main intacto). Fundido P0a→P0b confirmado por el lead: nada aterriza hasta que
ch18 esté verde con conocimiento completo.

## LAS 3 PIEZAS Y SU ESTADO

1. **P0a — entryDirection de sala** (COMMITEADO, gate unit verde, PERO incompleto de conocimiento):
   - Fix: `startDungeonRoomCombat` pasa de hardcode "south" a `roomEntryDirectionFor(map.playerStarts, facing)`
     con `OPPOSITE_EDGE` (combat/roomEntry.ts + tests/room-entry.test.ts, 5 tests verdes).
   - Gate: tsc + unit 2515/2515 + ch14b/ch17/ch90 verdes. **ROMPE ch18** (ver §CONFLICTO #99).
2. **P0b — trigger handler** (PIEZA 1, la más valiosa; EN DERIVACIÓN): el port NO implementa triggers
   (combat.ts:13 «pendientes»). Derivar la ACTIVACIÓN real + implementar en core (gate serio de combate).
3. **P0c / ch18-redescenso** (PIEZA 3, tras (b) + mapping): re-derivar Doom N3→N4 fiel + veredictos de
   los 13 candidatos [21,22,27,28,29,42,55,57,58,70,74,114,122] con triggers vivos.

## MAPPING facing→grupo — 72/72 PERO INCOMPLETO (dos hipótesis VIVAS, no casarse)

**Datos firmes (byte-exactos):**
- El .CBT define 4 grupos de player-starts (filas 1-4 = **east,west,south,north**), 6 pos/grupo.
  En AGREGADO (128 mapas): grupo X ≈ borde X del arena (north≈y1.9, south≈y5.9, west≈x0.8, east≈x4.4).
- Census «salas-de-una-entrada» (un solo vecino andable + un solo grupo real): **72/72 en las 8
  mazmorras, 0 contraejemplos**: grupo real = borde del que VIENES = **OPUESTO del facing** (en coords
  de MUNDO). Ese es el fix cableado.

**PERO — CONTRADICCIÓN con dato HUMANO (decisiva):** el usuario JUGÓ anoche el descenso de Doom en el
DOSBox ORIGINAL siguiendo la guía: paso 24 en (5,0) → paso 25 entra a la sala #99 (Doom floor2 (5,1))
moviéndose al SUR → paso 26 escalera interior → N4, y llegó hasta N6 (capturas). Es decir: en el
ORIGINAL, entrando a #99 hacia el sur, la party ALCANZA la escalera interior. Mi opposite-of-facing
predice para #99 el bolsillo NORTE (sellado del ladder) → **CONTRADICE el playthrough real.**

**Reconciliaciones POSIBLES (mantener las DOS vivas):**
- (ii) **ROTACIÓN DE ARENA con el facing** (mundo≠arena): las mazmorras son facing-relativas en la
  vista 3D; quizá la ARENA también rota, de modo que los grupos e/w/s/n son RELATIVOS al facing, no al
  mundo. Si así, el 72/72 se re-lee igual de limpio con OTRA asignación (p.ej. grupo = borde por el que
  entras EN COORDS DE ARENA = "south" siempre relativo, o similar). **TEST BARATO SIN ORÁCULO:** re-censar
  las 72 salas con la lente rotada; si cierra igual de limpio Y explica que #99 (entrada sur) use el
  grupo south (ladder), la hipótesis (ii) gana y el FIX se re-formula en coords de arena → probablemente
  ch18 vuelve a verde SIN re-derivar el descenso. **← HACER ESTO PRIMERO tras la nota.**
- (iii) **grupo-south-de-#99 = llegada por escalera desde abajo** (subir N4→N3), y la BAJADA usa otro
  grupo/vía. Plausible pero NO derivada; choca con el dato humano (el usuario BAJÓ, no subió). Menos
  probable que (ii) a la luz del playthrough, pero no descartar.
- El census de una-entrada NO distingue (i mundo)/(ii arena) porque en esas salas ambas coinciden.

~~**PENDIENTE del usuario (puede cerrar sin oráculo):** el lead le preguntó «¿bajaste N3→N4 por la
escalera de la sala o por otro camino?». Su respuesta al despertar es un oráculo humano.~~
[HISTÓRICO 2026-07-25: superado por la derivación posterior — P0a en main 0ab4b008 selló
opposite-of-facing ESTÁTICO (72/72 + auditoría ASM 7/7; confirmado también por el setup DNGLOOK vía
thunk 0x7C3E, carril monster-3d) y #99 se resolvió FIEL como spawn-norte + Cetro-descend (5dd70987,
ch27 verde ×2): la respuesta del usuario ya no era necesaria para adjudicar.]

## CONFLICTO #99 / combatmap 115 (Doom floor2 (5,1) = roomIdx(40,3)=115)

- Escalera-abajo interior en combat-tile (5,7) (SUR). Bolsillo de spawn NORTE (y0-4) SELLADO por muro
  (fila y5 = todo muro) del bolsillo SUR (y6-8, donde está la escalera). Sólo el grupo SOUTH alcanza la
  escalera; el grupo NORTH no (BFS: 0/6 alcanzan).
- (5,1) sólo se entra A PIE desde (5,0) [norte], moviéndose al SUR (los otros vecinos son muro). Sin
  triggers en map115.
- ch18 klimb-descend funcionaba SÓLO por el spawn-sur del hardcode infiel. Con opposite-of-facing (grupo
  north) la party queda sellada → ch18 rojo. La hipótesis (ii) rotación probablemente lo RESUELVE
  (entrada-sur → grupo south relativo → spawn sur → alcanza la escalera, casando con el humano).

## TRIGGERS — layout .CBT + hallazgo #29 (ch16b LANDEADO en DUDA)

- Layout .CBT (extractor combatmap.ts): **fila 0** = sprites de 8 triggers (bytes 11..18); **fila 8** =
  posiciones `at` (X 11..18, Y 19..26); **fila 9** = newPos1; **fila 10** = newPos2. sprite 0 = vacío.
  Semántica: activar el `at` MUTA los tiles en pos1/pos2 (abre pasajes/muros).
- **61/128 combatmaps tienen triggers.** El port los PARSEA pero NO los ejecuta (combat.ts:13).
- **BOMBA #29** (mi «dead-end fiel» de ch16b, EN MAIN 359c83f1): map29 tiene 8 triggers, todos con placa
  `at(5,5)`, que ABREN los tiles (3,4),(3,5),(3,6) = tile 0x4f (StoneBrickWall) = EXACTAMENTE el muro que
  sella los 9 Headless (+ (1-2,4-6) del bolsillo). => activado el trigger, el muro se abre y #29 pasa a
  GANABLE. **Mi ch16b asevera INGANABLE = probable ARTEFACTO de triggers-no-implementados.** La placa
  `at(5,5)` está en celda NO pisable (cofre) → anomalía P0b: activación ≠ pisar (¿atacar/abrir?).
  RECONCILIAR con quien «confirmó #29 dead-end» (memoria) — ¿consideró el trigger?
- La anomalía general: **35/128 mapas tienen la placa `at` en celda no pisable** → activación ≠ pisar.

## DISASM — estado

- **dng_enter_room** (DUNGEON.OVL 0x0000, LEÍDO): 0x000f-0x0019 fija g_dng_facing desde g_dng_anim_dir
  (tabla 0x2c76); 0x0043-0x007b calcula offset .CBT (dungeon*0x1600 + sala*0x160) y copia 0x160 B a la
  buffer 0xad14; 0x00b1-0x00b9 push(sala), push **3**, call 0xfa6e = SETUP; 0x00bc call 0xd740 (viewport,
  kernel 0x5910, confirmado por bias +0x81d0); 0x00bf g_unk_58a1=0x82 (same-exit); 0x00c4 call 0xfa62
  (corre combate). El «3» NO es la dirección (contradice el census + el (0,0)); es TIPO/modo de combate.
- **thunk 0x7c3e** (setup 0xfa6e resuelto por bias +0x81d0): `lcall 0x72e:0x2ec` (loader PLINK86) +
  datos de overlay. **OPACO EN FRÍO** (lcall reubicado; lección mainout-ffff-call-bias). El placement de
  la party (grupo por facing) vive AHÍ. Resolverlo EN VIVO (BP) lo desopaca para siempre — vale también
  para P0b (el trigger handler está en el mismo setup). **VENTANA DE ORÁCULO PRE-CONCEDIDA** por el lead
  (pgrep dosbox-x primero; el usuario duerme, su dosbox puede seguir vivo → si lo está, NO lanzar).
- COMBAT.OVL 0x0000 = helper de tile (x,y→addr), NO el placement. COMBAT.OVL no lee g_dng_facing (0366).

## ORDEN (lead) tras esta nota
1. (ii) re-censo arena-rotación (barato, sin oráculo) — puede cerrar el mapping + resolver #99/ch18.
2. Triggers-core (PIEZA 1): derivar activación real (estático; si el thunk tapa → oráculo pre-concedido,
   pgrep) + implementar handler en core con gate serio.
3. ch18-redescenso + veredictos 13 + re-verificar #29/ch16b con triggers vivos.

## Test de aceptación de CUALQUIER derivación
Debe explicar el playthrough humano: entrar a #99 moviéndose al SUR → alcanzar la escalera interior →
bajar a N4 (usuario llegó a N6 anoche en el DOSBox original, sin Des Por).
