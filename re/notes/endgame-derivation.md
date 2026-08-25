# Derivación del ENDGAME (carril endgame-visual, fase disasm) — contra los 2 testigos de vídeo

**Fuentes:** `re/notes/endgame-witness-20260721.md` (censo frame-a-frame + GAP-LIST de 10, victoria-con-caja
2:34 + varado-sin-caja 1:16); disasm `re/disasm/ENDGAME.OVL.asm`; catálogo `re/tools/endgame_catalog.py`;
nota previa `re/notes/endgame.md` (Task 3.12: throne_scene, datestamp, playtime, pergamino ya derivados).

**Patrón de implementación (todas las piezas):** RefugeScript de la secuencia de muerte
(`game/src/core/…` emite un SCRIPT de pasos; la PIEL los pacea con modal + tecla; mutación de estado
diferida). El endgame es un script MÁS LARGO pero de la misma clase — NO lógica en la piel.

---

## Mapa del `endgame_main` (ENDGAME.OVL 0x0648-0x0aee) — LA ESPINA (derivada)

`endgame_main` NO es la escena de combate; es la CUTSCENE post-victoria (tras el combate de sombras).
Flujo derivado:

- **0x0655** `call 0xffff8670` (kernel) — init de escena/pantalla.
- **0x065f-0x0681** `call 0x82de` ×2 con args `(str 0x8480/0x848e, x, y, …)` — coloca los sprites del
  party + LB (el compositor de texto/sprite posicional; memoria «helper 0x82de con args numéricos»).
- **0x06f9-0x070a** bucle `call 0x510` (`move_sprite_toward`) + `jne` — ANIMA los sprites un tile/iter
  hacia su objetivo (los miembros reapareciendo / caminando). `0x510` devuelve 0 al llegar.
- **0x06f6/0xffff9856** — TONO/DELAY del PC-speaker (arg = duración; ver §8 sonidos).
- **Diálogo** = secuencia `push <DS-offset>; call 0x75c0` (kernel_print_ds, imprime la cadena en el
  panel) intercalada con **`call 0x83dc` = PACING por tecla** (espera input entre páginas). Cada
  string vive en DATA.OVL (`fileoff = DS + 0x10 + offset`).
- **FORK (0x08b9/0x08c2):** `cmp [bp-2],0x59` (answer=='Y') `&& cmp [g_wooden_box = DS 0x57BF],0` →
  rama BUENA (0x08cc); si no → rama ALTERNA. Coincide con el core actual (`ending` por `woodenBox`).
  - 🔴 **`g_wooden_box` es `DS 0x57BF`**, no `0xbf57`. Esta línea llevaba los dos bytes del `disp16`
    en orden de fichero (`80 3e bf 57 00`) leídos como si fueran la dirección. Canónica en
    `re/ledger/globals.json` y `content-audit.md`. Mismo error en `endgame.md:47`. (2026-08-07)
  - 🔴 **«La respuesta Y/N es AUTOMÁTICA … sin prompt» LA CONTRADICE EL CUERPO** (leído entero
    2026-08-07). `[bp-2]` no lo fija el inventario: sale de `call 0x83dc` = `getkey_with_redraw`
    (kernel 0x266c), o sea **una tecla real**, dentro de un bucle que **re-pide** mientras no sea
    `'Y'` (0x59) ni `'N'` (0x4e) — `0x0852…0x0874 jmp 0x852` para la 1ª pregunta y
    `0x088b…0x08ad jmp 0x88b` para la 2ª. Lo que sí encaja con el testigo: `«Yes»`/`«No»`
    (DS 0x84b4 / 0x84ba) se imprimen **como ECO de la tecla**, justo después de leerla — de ahí que
    en la traza parezca que el juego responde solo. ⚠️ Lo MEDIDO es el cuerpo; por qué el testigo no
    registró la espera de tecla es cosa de la traza y no lo adjudico.
  - 🔴 **Y la 2ª pregunta NO es incondicional**: `0x087f cmp si,'N'; jne 0x8b9` ⇒ sólo se hace si la
    1ª respuesta fue **'N'**, y su respuesta **sobrescribe** `[bp-2]` (0x08b6). Es decir `'N'` y luego
    `'Y'` entra en la MISMA rama de sacrificio que un `'Y'` directo.

---

## Las 10 piezas de la GAP-LIST — derivación + plan

### GAP 1 — Combate final (Sombras + «is absorbed!») — ✅ MECÁNICA `absorb` DERIVADA (SJOG 0x1ea4)
- **Observable:** la celda de LB en Doom N8 (floor7, (4,7)) → «Entering room…» → arena (trono/cama/mesa/
  espejo), LB SENTADO, ~5 SILUETAS-SOMBRA; contacto sombra→miembro: «NOMBRE is absorbed!» y el miembro
  DESAPARECE del tablero (sigue en el roster, NO muere).
- **MECÁNICA `absorb` DERIVADA — SJOG.OVL rutina 0x1ea4** (corre tras el move de un combatiente, como
  fireTriggers del §#1):
  - **0x1eaa-0x1eb6:** `ptr = 0xba14 + g_cmb_actor·8` (struct del combatiente que se movió).
  - ~~**GATE de SOMBRA (0x1ebb-0x1eda):** `[ptr+2]≠0` (activo) `&& !([ptr+2]&0x20)` (es ENEMIGO, no
    player-side) `&& [ptr+7]==2` (AI/estado==2) `&& (tile_attr[sprite]&0xfc)==0x3c` — el sprite del
    actor pertenece a la clase 0x3c = la SOMBRA (`al=[bx-0x538c]` indexa la tabla de atributos de
    tile por el sprite `[ptr+6]`). Sólo entonces absorbe.~~
    🔴 **REFUTADO 2026-08-11 — tres de los cuatro términos leídos al revés.** Derivación entera, con
    tres anclas por campo, en **`endgame-absorb-refutacion.md`**; resumen: `!([rec+2]&0x20)` es **no
    CAÍDO** (el bit de bando es el 0x80) ⇒ **el gate no filtra por bando**; `[rec+7]==2` es **la FILA
    es 2** (el ledger ya daba «+6 X, +7 Y»; lo confirman los literales North/South de
    `move_combat_actor` y el `[si+7]<<5 + [si+6]` de COMBAT.OVL 0x0c26 sobre `g_cbt_room_record`,
    stride 32); y `[bx-0x538c]` es **`g_vis_tile_window + 16`, o sea (FILA 1, MI COLUMNA)** — no hay
    tabla de atributos de tile en esa dirección. El 0x3c sí es la sombra, pero por otra vía:
    `look2[0x13c..0x13f]` = «a trapped soul!» (los actores se pintan `| 0x100`).
  - **GATE REAL:** activo ∧ no caído ∧ **fila == 2** ∧ **alma atrapada en (fila 1, misma columna)**.
    Y el absorbido es **el actor que acaba de moverse**, no su víctima: el mismo `g_cmb_actor` pasa el
    gate, da nombre al mensaje (0x1ee8) y se retira del tablero (0x1f13). Sujeto y víctima coinciden.
  - **Efecto (0x1edc-0x1f1c):** `g_unk_58a0=0x4d` (flag) → tono (`call 0x573a`, arg 0xa) → nombre del
    objetivo (`call 0xffffbe1a`) → **`push 0x8f02; call 0x58d0` = imprime «<name> is absorbed!»** (DS
    0x8f02) → TONO de absorción (`push 0x4b0,0x7d0,1,0x28; call 0x842e`) → `g_active_char=0xff` →
    **`ax = −g_cmb_actor−1; call 0xffffbe02` = RETIRA al miembro del tablero** (índice NEGADO = borrado
    reversible, NO status 'D' — el miembro sigue en el roster; se re-añade en la cutscene, GAP 2).
- **Derivado:** enemigo SOMBRA = clase-de-sprite 0x3c; el ataque `absorb` = retirar-del-tablero (no
  matar) + eco «is absorbed!» + tonos. Es un ataque de contacto del enemigo (corre en su move).
- **PENDIENTE (traza aparte):** (a) el **cm de la celda de LB** (dungeons.json floor7 (4,7) →
  roomCombatMapIndex; ⚠️ verificar cm real — el layout/trono viene de MISCMAPS.DAT, pero el combat-map
  de enemigos podría ser un cm de Doom); (b) la **condición de FIN** (¿todos absorbidos → arranca la
  cutscene? — ✅ **RESUELTO**, ver (3) abajo); (c) el **empalme combate→ENDGAME.OVL** — ✅ **CERRADO
  2026-08-04**: el stub es `ULTIMA.EXE 0x7c4a` (overlay 13 + `ljmp` a endgame_main 0x0648), único de
  overlay 13 entre los 164 stubs PLINK; dos llamadores (DUNGEON 0x00cb, SJOG 0x2046) con el mismo gate
  `cmp [g_unk_58a0],0x4d`. Detalle en `endgame.md` §Trigger; (d) `checkDoomRescue` del
  port hoy dispara por `floor==7` a secas → FIX DE FIDELIDAD: debe gatear por la CELDA de LB + su
  combate de sombras — **y ahora se sabe que el gate fiel no es la celda sino el CENTINELA que pone
  `absorb`**; (e) **¿QUÉ HACE la absorción exclusiva de la celda de LB?** — SIGUE ABIERTO, pero acotado:
  la absorción (SJOG 0x1ea4) es CONTEXTUAL a la celda de LB — testigo-3 (Doom N1 sin caja) muestra sombras
  de PASILLO que pelean como monstruos NORMALES y **NO absorben**, con el MISMO sprite clase 0x3c.
  Se buscaba un «gate ADICIONAL» en código: **no lo hay.** Censo 2026-08-04 — `0x1ea4` tiene stub propio
  (`ULTIMA.EXE 0x7e66`, overlay 14) con **UN SOLO llamador, `COMBAT.OVL 0x0b8b`**, gancho post-movimiento
  cuyo gate local (`[bp-6]` fuera de [0x30,0x36]) es genérico y no menciona sombras.
  🔴 **A PARTIR DE AQUÍ EL RAZONAMIENTO ERA FALSO, CERRADO 2026-08-11.** Concluía «⇒ por eliminación el
  discriminador vive en los DATOS del encuentro, no en código», y esa eliminación se apoyaba en la premisa
  «el gate de 0x1ea4 está leído entero». **No lo estaba: estaba leído mal** (arriba). El discriminador
  buscado **sí es código** — las dos condiciones de posición del gate real (fila 2 ∧ alma atrapada al
  norte en la misma columna). Las sombras de pasillo no absorben porque **en un pasillo no se da esa
  geometría**. ⚠ La rancidez alcanza a la PREMISA de este bullet, no sólo a su conclusión: se conserva el
  texto de arriba porque explica por qué se buscó durante días una pieza que no faltaba.
  **Lo que queda abierto, estrecho:** que las almas estén en la fila 1 del mapa de la celda de LB está
  EXIGIDO por la regla y encaja con el testigo, pero **sin medir** — lo cierra el **cm real de la celda**
  (pendiente (a)) o un oráculo. Y el aviso de portado sigue en pie por otra razón: el gate **no comprueba
  el bando** y su efecto arma el centinela del final ⇒ un `absorb` portado sin las dos condiciones de
  posición dispara EL FINAL DEL JUEGO en cualquier combate con un alma atrapada.
  Ver [[endgame-absorb-refutacion]] y [[trigger-handler-combat-0x111a]].
- **Plan de implementación:** (1) enemigo `Shadow` (clase 0x3c) con ataque `absorb` = nuevo status
  `absorbed` (fuera-del-tablero, reversible, distinto de dead); (2) el cm de la sala de LB con N sombras;
  (3) fin-de-combate por «todos absorbidos» → emite el script del endgame (que re-añade a los absorbidos
  en el re-tinte, GAP 2); (4) mover el gate de `checkDoomRescue` de `floor==7` a la celda/sala de LB.

### GAP 2 — Re-tinte VERDE de la sala + LB de pie + reaparición + arco sur — [endgame_throne_scene 0x0000]
- **Observable:** ladrillo rojo→VERDE, antorchas→llama verde, mesa→tapete verde; absorbidos REAPARECEN;
  LB trono→DE PIE; ARCO amarillo/azul en el borde SUR.
- **Dónde vive:** `endgame_throne_scene` (0x0000). **La sala/trono se carga de `MISCMAPS.DAT`** (DS 0x8480,
  `original/u5/play/MISCMAPS.DAT`) — el layout de la celda de LB (trono/cama/mesa/espejo) es un mapa de ese fichero. El re-tinte es un **remapeo de tiles/paleta** de la sala (rojo→verde) — derivar si es (a)
  swap de paleta EGA o (b) re-dibujo con set de tiles verdes. La reaparición de los absorbidos = re-add
  de los miembros al tablero (revierte el status `absorbed`). LB-de-pie = swap de sprite (trono→rey
  andante). El arco sur = un tile/sprite de portal (precursor del moongate).
- ~~**DERIVADO (endgame_throne_scene 0x0000):** … El verde sale de la DATA de
  tiles (0x3da6-0x3dca + la sala de MISCMAPS.DAT), NO de un `out` a puerto de paleta.~~
  **⚠ SUPERADO (adenda endgame-polish, abajo): AMBAS mitades de este claim eran erróneas.**
  (a) La rutina 0x0000 NO es la escena verde: es el COMPOSITOR DE LAS PANTALLAS DE HISTORIA
  (GAP 6) — su bucle de «6 filas» = las 6 PANTALLAS de END.DAT (la tabla 0x3dca = offsets
  de página en END.DAT, verificada contra los `{` del fichero; DS 0x81fe = "END.DAT").
  (b) El VERDE no sale de esas tablas: sale del **RECOLOR DEL TILESET en EGA.DRV fn36(ax=4)**
  — ver §ADENDA. El re-add de absorbidos/LB-de-pie tampoco vive aquí (los sprites de 0x0000
  son las FIGURAS de las pantallas de historia: Avatar/LB por página, tablas 0x3df4/0x3dee/
  0x3dfa/0x3e00/0x3e06).
- **Plan:** script `endgame:greenScene` — la piel RE-PINTA la sala con el mapa/tiles verde (extraer de
  MISCMAPS.DAT + las tablas, NO inventar el verde), RE-AÑADE la party (re-coloca los sprites absorbidos),
  pone el sprite LB-de-pie, y dibuja el ARCO sur. **PENDIENTE menor: identificar el tile del ARCO sur**
  (¿moongate-en-formación? ¿espejo? — está en la data de la escena verde; extraerlo del mapa de MISCMAPS.DAT
  y carear con el frame). El mecanismo (redibujo por tiles + re-add por sprites) queda DERIVADO.

### GAP 3 — Diálogo de LB + fork Yes/No de la caja — ✅ RESUELTO (strings EXTRAÍDAS de ENDMSG.DAT)
- **HALLAZGO CLAVE:** el diálogo del endgame NO está inline en DATA.OVL — vive en un fichero aparte
  **`ENDMSG.DAT`** (786 B, `original/u5/play/ENDMSG.DAT`), cargado por endgame_main vía la string
  DS 0x848e = `"ENDMSG.DAT"`. Los DS-offsets 0xb000+ (0xb2c9…0xb469) son el BUFFER donde se carga
  ENDMSG.DAT; `call 0x75c0` imprime cada tramo y `call 0x83dc` pacea por tecla. (La sala/trono se
  carga de **`MISCMAPS.DAT`**, DS 0x8480 — ver GAP 2.)
- **SCRIPT COMPLETO (byte-exacto de ENDMSG.DAT — cita: fichero ENDMSG.DAT, secuencial):**
  1. `\nLord British says:\n\n"Well met,` <nombre> `!"`
  2. `"Didst thou bring my box?"\n\nYou reply: ` + **auto** `Yes`/`No` (por `g_wooden_box`).
  3. *(sólo si No)* `"The sandalwood box, from the secret passage in my chamber!"\n\n"Didst thou bring it?"\n\nYou reply: ` + **auto** `No`.
  4. *(rama Yes)* `Lord British carefully opens the box...` →
     - `«"An artifact of astral …» (82 B, sha1 18f9f70e — recortado; verifica contra tu copia)`
     - `«"From the world that …» (60 B, sha1 3a5bb5b9 — recortado; verifica contra tu copia)`
     - `«"Often did I return …» (95 B, sha1 77915b39 — recortado; verifica contra tu copia)`
     - `"Older even than Mondain's evil are the forces which bind us here..."`
     - `"But older still is the power of the Orb of the Moons!"`
     - `«"FOLLOW!" cries Lord British, …» (120 B, sha1 0b2b63b4 — recortado; verifica contra tu copia)`  (→ GAP 4)
  5. *(rama No, tras 2 negativas)* `\n"Well then, pull up a chair."\n\n"We shall be here a while."`  (→ GAP 3b)
  - Otros tramos: DS 0x84cc `\n\nHe says:\n\n`, DS 0x84da `"I see...`, DS 0x9c40 `\nEnjoy!"`.
- **Plan:** el port CARGA ENDMSG.DAT (como carga otros .DAT) o embebe estas strings en el manifiesto
  con cita `ENDMSG.DAT`. Script `endgame:dialogue` = las páginas de arriba + fork por `woodenBox` (el
  core ya ramifica `ending`). Ya NO hay pendiente de strings de diálogo — están todas aquí, byte-exactas.

### GAP 3b — Fork SIN caja (2ª oportunidad + «pull up a chair») — [rama alterna 0x08c2-alt]
- **Observable:** «You reply: No»→LB revela «The sandalwood box, from the secret passage, in my chamber!»
  →re-pregunta→«No»→«I see… Well then, pull up a chair.»/«We shall be here a while.»→**LB SE SIENTA**
  (sprite sentado, trono vacío); SIN moongate/disolución/historia/pergamino; **sala verde JUGABLE sin salida**.
- **Dónde vive:** la rama `jne` de 0x08c2 (g_wooden_box==0) — la «secuencia alterna corta» (endgame.md
  §rama, ~0x0a76). Imprime sus strings (2ª pregunta + pull-up-a-chair) y **NO** llama a orb/moongate/
  throne-green-exit/datestamp → retorna al bucle de mazmorra con LB-sentado. El «encierro» = la sala
  no tiene salida y el juego SIGUE aceptando movimiento (no freeze).
- **Texto:** ✅ EXTRAÍDO de ENDMSG.DAT (ver GAP 3, items 3 y 5): 2ª pregunta con pista del passage secreto
  + «Well then, pull up a chair.» / «We shall be here a while.». **Plan:** script `endgame:stranded` = esas
  páginas + LB-sentado (swap de sprite) + devolver control en la sala verde sin salida. Falta sólo el
  sprite LB-sentado + el retorno-al-bucle (leer 0x0a76-0x0aee).

### GAP 4 — Orb rojo + MOONGATE ROJO + salida uno-a-uno — ✅ DERIVADO byte-a-byte (endgame_main rama buena 0x0961-0x0a73)

**Observable:** «FOLLOW! …extracts a small, red sphere… casts it to the floor. Our worlds await!» →
partícula ROJA en el suelo → MOONGATE ROJO grande en el centro → party+LB entran UNO A UNO y desaparecen
→ el gate se cierra → disolución a pantalla completa.

**`move_sprite_toward` (0x510) — firma derivada** (leída 0x0510-0x0582): `move(idx, x, y)`. `[bp+8]=idx`
→ `idx·8 + 0x5c5a` = puntero al registro del sprite (8 bytes/registro: byte0=activo, byte2=x, byte3=y).
Si `byte0==0` (inactivo) o ya está en (x,y) → devuelve **0**; si no, avanza UN paso hacia (x,y) por el eje
de mayor delta (abs vía cdq/xor/sub) y devuelve **1**. ⇒ el patrón `push idx; push x; push y; call 0x510;
or ax,ax; jne …` = «anda hasta llegar». **Registros:** #0-5 = party (base 0x5c5a, stride 8), #6 (offset+48)
= el ORB, **#0x1f (offset+248, 0x5c5a+0xf8)** = **Lord British**. Destino de la salida = **(x=5, y=4)** = la
celda del moongate.

**Traza exacta (0x0961-0x0a73):**
1. **0x0961:** `push 0xb469; call 0x75c0` = imprime la página «FOLLOW!…» (beat 10, kernel_print_ds; DS 0xb469
   = buffer cargado de ENDMSG @0x24b).
2. **Orb al suelo (0x0968-0x098f):** `mov al,8; [0x5c8a]=[0x5c8b]=8` activa el sprite **#6 = el orb** (registro
   0x5c5a+48). Luego `push 0x1450,1,0xc350(=50000),0x2710(=10000),1; call 0x7f02` = barrido de sonido del
   lanzamiento (whoosh del orb; 0x7f02 se resuelve fuera del overlay). `sub al,al; [0x5c8a]=[0x5c8b]=0`
   retira el orb (la partícula parpadea y desaparece).
3. **APARECE el moongate (0x0992-0x09ac):** `mov byte [0xad99],0xdc` = fija el **marcador global del moongate
   = tile 0xdc (gate ROJO)** (0xad99 se escribe UNA vez aquí; lo consume el kernel de dibujo FUERA del
   overlay). Luego `[0x5887]=1`; bucle `push 1; call 0xffff9856; inc [0x5887]; cmp 0x10; jb` = **15 tonos
   ASCENDENTES** = el sonido de apertura/crecimiento del gate.
4. **LB entra el primero (0x09ae-0x09d0):** `push 4; call 0xffff9856` (tono); bucle `push 0x1f; push 5; push 4;
   call 0x510; or ax,ax; jne` = **LB (sprite #0x1f) anda hasta (5,4)**; al llegar `[0x5d52]=[0x5d53]=0`
   (0x5c5a+248/249) lo BORRA (desaparece en el gate) + `call 0xffff9856(1)` = ping de «entró».
5. **La party UNO A UNO (0x09d7-0x0a24):** `i=0`; si `g_party_size==0` salta; `di=0x5c5a`; por cada miembro
   `si=0..party_size-1`: bucle `push si; push 5; push 4; call 0x510; jne` (anda el miembro `si` hasta (5,4)),
   al llegar `[di]=[di+1]=0` lo BORRA, `call 0xffff9856(1)` ping, `di+=8`, `inc si`. ⇒ **cada miembro camina
   al gate y desaparece, en orden, con su ping** — clava el testigo «entran uno a uno».
6. **El gate se cierra (0x0a27-0x0a37):** `[0x5887]=0xf`; bucle `push 1; call 0xffff9856; dec [0x5887]; jne`
   = **15 tonos DESCENDENTES** (espejo del abrir) = sonido de cierre.
7. **Empalme a GAP 6/7 (0x0a39-0x0a73):** una tanda de llamadas RESIDENTES de teardown/housekeeping
   (`call 0x6e50` con (0x44,5,4); `call 0x6992/0x67e0/0x6d9e`; `push 0,0,0x13f,0xc7; call 0x6816`) → `call 0`
   (LOCAL 0x0000, throne_scene/loader de pantalla-arte) + **`call 0x326` = el PERGAMINO (endgame_datestamp,
   GAP 7, LOCAL)**; `jmp 0xae8` (retorno). ⚠️ **CORRECCIÓN (era over-claim): `call 0x6816` NO es la disolución.**
   Por la regla de `overlay-load-layout.md`, un near-call POSITIVO con target <0x81D0 resuelve a RESIDENTE
   ULTIMA.EXE al mismo offset: 0x6816 = una rutina de ENTIDAD/sprite (`test [bx+2],flags` → escribe las tablas
   0x5c5a/0x55b3/0x5c60 de registros), NO un fill-rect. Y 0x67e0/0x6d9e caen a MEDIA instrucción en
   ULTIMA.EXE.asm → la resolución de estos near-calls positivos NO es limpia y su identidad queda SIN fijar
   (los (0,0,319,199) son args de 0x6816 pero la rutina indexa registros por [bx], no pinta pantalla). La
   disolución de píxeles a pantalla completa del testigo ocurre en esta transición pero su rutina exacta NO
   está identificada — ver GAP 5. *(La rama alterna
   0x0a76-0x0ae7, saltada por el `jmp`, es el «pull up a chair» stranded de GAP 3b: imprime DS 0x84da/0xb4f3,
   `call 0x4fe`, y bucle de idle con 4×`call 0x5a2` — LB sentado para siempre.)*

**Plan de port:** el core emite un `RefugeScript`-style `endgameSequence` con pasos ORDENADOS:
`showOrb` → `moongateAppear(tile=0xdc, sound=15 asc)` → `walkToGate(LB)` → `walkToGate(member i)` ×party
→ `moongateClose(15 desc)` → (encadena GAP 5 dissolve → GAP 6 arts → GAP 7 pergamino). La piel pace cada
`walkToGate` con el driver de sprites existente hacia la celda (5,4) + ping por miembro. El tile 0xdc del
moongate y el sprite del orb (registro #6) se EXTRAEN del binario (no se redibujan). **Cerrado salvo extraer
los 2 sprites (orb + gate rojo).**

### GAP 5 — Disolución de píxeles a pantalla completa — ⚠️ PARCIAL (orden derivado; rutina motora SIN identificar)
- **Observable:** TODO el frame (mapa + paneles + chrome) se deshace en píxeles dispersos, en la transición
  moongate→pantallas-de-historia.
- **CORRECCIÓN:** la versión anterior daba `call 0x6816` como «kernel de disolución» — ERROR (over-claim).
  0x6816 resuelve a una rutina RESIDENTE de ENTIDAD/sprite (ver GAP 4 punto 7), NO a un fill/disolución;
  los near-calls positivos vecinos (0x67e0/0x6d9e) ni siquiera caen a instrucción → sin resolución limpia.
- **LO QUE SÍ ES SÓLIDO — el ORDEN de píxeles:** la disolución EGA de U5 usa el revoltijo determinista de
  **EGA.DRV fn32 (sel 0x60)**, YA derivado byte-exacto en `game/src/core/transition/visualLfsr.ts`
  (`next = ((ror16(state+0x9248,3) ^ 0x9248) + 0x11) & 0xffff`; EGA.DRV.asm 0x1fa8-0x1fbb). Ese es el orden
  de barrido; el port ya lo tiene (lote-C).
- **PENDIENTE (real, no menor):** identificar la RUTINA RESIDENTE que hace la disolución a pantalla completa
  en esta transición — candidatos: alguna de las residentes del empalme (0x6e50/0x6992/0x67e0/0x6d9e, aún sin
  resolver rigurosamente vía overlay-load-layout) o dentro del loader `call 0`. Resolver los near-calls
  positivos del tail con la regla canónica (near_call_base + citar ULTIMA.EXE) antes de afirmar cuál pinta.
- **Plan:** una vez identificada, reusar/extender `visualLfsr.ts` al frame COMPLETO (mapa+paneles+chrome),
  disparado en el paso `dissolve` del `endgameSequence`. El ORDEN ya está; falta el DÓNDE exacto del disasm.

### GAP 6 — Pantallas de historia (casa del Avatar + «The Dream») — ✅ LOCALIZADO (arts + texto identificados; EXTRAER con pic16)
- **Observable:** pantalla-1 interior de casa (Avatar a contraluz, espada+escudo) + texto; pantalla-2
  «The Dream» (trono de Blackthorn rojo/negro) + texto largo.
- **ARTS — ficheros EGA `.16` a pantalla completa (`original/u5/play/`):** **END1.16** (7792 B, casa del
  Avatar) y **END2.16** (8542 B, «The Dream» / trono de Blackthorn); + **ENDSC.16** (1392 B, fondo del
  pergamino/scroll del cierre) y las variantes CGA `.4` (END1.4/END2.4/ENDSC.4, no usadas por el port EGA).
  Formato = el MISMO `.16` que ya decodifica **`extractor/src/parsers/pic16.ts`** (`[u16 width][u16 height]
  [4bpp, nibble alto = píxel izq., paleta EGA U5]`). ⇒ **se EXTRAEN con pic16, NO se redibujan** (misma
  clase que DNG*.16/ITEMS.16 del compositor 3D y que STORYn.16 de la intro).
- **TEXTO — `original/u5/play/END.DAT`** (3698 B, byte-exacto contra el testigo): páginas delimitadas por
  `{`, con `_` = guión-blando/word-break. Secuencia: (1) sendero/círculo de piedras → casa; (2) «Much time
  has passed…» (INTERIOR de la casa = pantalla-1, careo ✓); (3) «That night you lie safe…» (dormir → sueño);
  (4+) «The Dream» = sala del trono de Blackthorn, LB con «a serpentine amulet, a golden sceptre, and a
  regally bejewelled crown», el Orb, la puerta roja, Blackthorn cruza el gate; luego el discurso de LB
  («Thy deeds were black…» / «I offer thee a choice… return to Castle Britannia… Or…»). ⇒ END.DAT es el
  CORPUS COMPLETO de las pantallas de historia + la narrativa del sueño; al manifiesto con cita `END.DAT`.
- **ARQUITECTURA — es el ESPEJO de la intro (`extractor/src/parsers/intro-scenes.ts`):** The Summoning
  compone STORYn.16 (fondo) + texto paceado; el endgame compone END1.16/END2.16 (fondo) + páginas de
  END.DAT. El port ya tiene el renderizador de escena-de-historia de la intro → **reusarlo** para el cierre
  (fondo `.16` extraído + overlay de texto por página, paceado por tecla; patrón RefugeScript).
- **Plan:** (a) añadir END1.16/END2.16/ENDSC.16 al extractor vía pic16 → PNG (gitignored/aditivo, como
  dungeon-feat.png); (b) las páginas de END.DAT → manifiesto con cita; (c) el core emite el paso
  `storyScreens` del `endgameSequence`; la piel reusa el compositor de intro-scenes. **PENDIENTE menor:**
  confirmar la sub-imagen/offset exactos de cada END*.16 (¿una imagen por fichero o atlas?) corriendo
  pic16 sobre ellos + carear con los frames del testigo (105-128 s).

### GAP 7 — Pergamino final — [endgame_datestamp 0x0326 — YA DERIVADO]
- **Estado:** DERIVADO (endgame.md §Playtime + §Pergamino): strings + playtime (año139/mes4/día5,
  calendario 13×28) + las 2 líneas rúnicas + «Report now… in N days… Origin Systems!». El core ya lo
  tiene (`endgamePlaytime`/`formatQuestReport`/`questScroll`).
- **Plan:** VERIFICAR byte-exacto vs los frames del testigo (129-153s), incl. las runas y la fanfarria (§8).
  Sólo verificación, sin nueva derivación.

### GAP 8 — Censo de sonidos (PC-speaker) — ✅ CENSO COMPLETO (beeps `0xffff9856`) + ⚠️ fanfarria SIN identificar
- **Observable (testigo):** bloque de combate 5-24s; ping transición-verde ~27s; pings de página ~110/114/128s;
  fanfarria del pergamino 142-149s.
- **RUTINA DE TONO — VERIFICADA (leída, no inferida):** `call 0xffff9856` resuelve por overlay-load-layout
  (`near_call_base(ENDGAME)=0xa290 + 0x9856 & 0xffff = 0x3ae6`, <0x81D0 → RESIDENTE) a **ULTIMA.EXE 0x3ae6**:
  `cmp [g_unk_58a4],0; je` (gate sonido-ON) → lee `[bp+4]` = **DURACIÓN** y hace un bucle de espera. ⇒ es un
  **BEEP de duración variable, NO una nota de pitch**. (Distinto de 0x7f02, el barrido del orb, que sí toma
  freqs 50000/10000.)
- **CENSO de los 15 `call 0xffff9856` de ENDGAME.OVL (offset → arg-duración → evento):**

  | región | offset | dur | evento |
  |---|---|---|---|
  | throne_scene 0x0000 | 0x0502 / 0x050c | 2, 3 | **re-tinte VERDE** (2 beeps tras el redibujo) — testigo ~27s |
  | datestamp 0x0326 | 0x063d | 1 | beep tras un bucle de MOVIMIENTO de sprite (8 pasos, `call 0x7e02` dir-picker) — NO es la fanfarria |
  | endgame_main | 0x06f6 / 0x0830 / 0x0922 | 0x28 (40) | **beeps de PÁGINA de diálogo** (0x0922 va justo tras `call 0x75c0` print) — testigo ~110/114/128s |
  | endgame_main | 0x07cb | 1 | beep de estado (tras `[bx+6]=0`) |
  | endgame_main | 0x08d0 / 0x08f8 | 8, 4 | beeps del combate/absorción de sombras (rama cerca del fork 0x08cc) |
  | endgame_main | 0x09a0 ×15 | 1 | **moongate ABRE** (GAP 4) |
  | endgame_main | 0x09b2 / 0x09d4 | 4, 1 | **LB al gate** + ping |
  | endgame_main | 0x0a0d | 1 | **ping POR miembro** (bucle uno-a-uno) |
  | endgame_main | 0x0a30 ×15 | 1 | **moongate CIERRA** (GAP 4) |
  | endgame_main | 0x0a81 | 0x28 | rama stranded 3b («pull up a chair») |

- **Combate de sombras (5-24s):** NO son beeps de endgame_main — es el SFX de combate normal (combat.ts,
  ya existente); la absorción añade los tonos de SJOG 0x1ea4 (`call 0x573a`/`0x842e`, GAP 1).
- **🔴 RETRACTADO 30-07 (auditoría ronda 2) — el bullet de abajo quedó REFUTADO por la
  adenda `fanfarria-endgame-espectral.md` §3/§5/§6 (carril fanfarria-re, 2026-07-22):
  la «fanfarria» NO EXISTE en el binario DOS. El audio 139-153 s del testigo es
  POST-FREEZE (fuera del juego): artefacto del host, no del original. Y `0xffff9856` →
  ULTIMA.EXE 0x3ae6 NO es un beep: es RUN-N-FRAMES (bucle de espera MUDO). El port hace
  lo correcto implementando cola MUDA — no hay rutina que buscar.
  ⚠ La rancidez alcanza a la PREMISA de este GAP 8, no solo a este bullet: todo el
  razonamiento «debe salir de OTRA rutina» parte de un sonido que no era del juego.
  Se conserva el texto original DEBAJO como testimonio de la lectura equivocada (es lo
  que explica por qué se buscó una rutina inexistente durante días).**

- ~~**⚠️ FANFARRIA del pergamino (142-149s) — SIN IDENTIFICAR:**~~ NINGÚN `0xffff9856` produce una serie de
  NOTAS (0x3ae6 es duración, no pitch); el único tono del datestamp, en CS 0x063d, es un beep aislado tras una
  animación de movimiento. La fanfarria multi-nota debe salir de OTRA rutina (¿tabla de notas + player de
  pitch en el kernel, o un jingle residente?) — PENDIENTE de resolver (no fabricar). Remate Clase-B, igual
  que la rutina-pintora de GAP 5.
- **Plan de port:** el core emite un `sfxEvent` por evento con la DURACIÓN del beep (green×2, page-beep(40),
  moongate-open×15, LB, member-ping, moongate-close×15, stranded); el bloque de combate reusa el SFX de
  combate. ~~La fanfarria queda pendiente de su rutina real.~~ (RETRACTADO: ver el banner del GAP 8 — no hay rutina, el sonido era del host.)

### GAP 9 — Estado terminal (victoria) — [bucle infinito 0x04f9, YA DERIVADO]
- **Estado:** DERIVADO (endgame.md): tras el pergamino, `endgame_datestamp` cae a un **bucle infinito
  (0x04f9)** = «The End», sin input (el original no vuelve al juego). El port debe clavar el freeze terminal.
- **Plan:** el core emite un `game-won` terminal; la piel bloquea input tras el pergamino. Verificación.

### GAP 10 — (incluido en 3b) fork sin-caja completo. Ver GAP 3b.

---

## Orden de ataque sugerido (para el resto del carril)
1. **Extracción de strings** ✅ HECHO: el diálogo vive en **ENDMSG.DAT** (786 B) — transcrito byte-exacto
   en GAP 3. La sala en MISCMAPS.DAT. Al manifiesto con cita `ENDMSG.DAT`. (Ya NO es pendiente.)
2. **Combate de sombras (GAP 1):** traza COMBAT — enemigo Shadow + ataque `absorb` + cm de la celda de LB.
3. **Cutscene visual (GAP 2/4/5):** green-tint (throne_scene 0x0000), orb/moongate (rama buena 0x0961+),
   disolución (kernel LFSR). Reusan drivers existentes (sprites, visualLfsr).
4. **Art de historia (GAP 6):** localizar+extraer los PICs (casa + The Dream) — NO redibujar.
5. **Sonidos (GAP 8) + verificación pergamino/terminal (GAP 7/9):** censo de `0xffff9856` + careo frame.

**Todo el guion se pacea en la piel con el patrón RefugeScript; el core emite el SCRIPT (páginas,
forks, mutaciones) y la piel lo reproduce. Cero lógica de presentación en el core.**

---

## GUION DE STRINGS DEL ENDGAME — extracción byte-exacta + careo contra el testigo (para el manifiesto)

**Fuente autoritativa:** `original/u5/play/ENDMSG.DAT` (786 B / 0x312). Es el fichero que endgame_main
carga (DS 0x848e) e imprime tramo a tramo con `kernel_print_ds` (0x75c0), paceado por tecla (0x83dc).
Los DS-offsets 0xb2c9…0xb469 vistos en el disasm son el BUFFER de carga, NO el texto — el texto está
en ENDMSG.DAT en las posiciones de abajo. Las auto-respuestas «Yes»/«No» son labels de DATA.OVL.
Cada beat va al string-manifest con cita `ENDMSG.DAT@<off>` (o `DATA.OVL DS <off>`), byte-exacto.

| beat | rama | fuente | string (byte-exacto; ¶=\n) | careo testigo |
|------|------|--------|----------------------------|---------------|
| 1 | ambas | ENDMSG @0x00 | `¶Lord British says:¶¶"Well met,`<nombre>`!"` | ✓ (LB saluda) |
| 2 | ambas | ENDMSG @0x21 | `"Didst thou bring my box?"¶¶You reply: ` | ✓ cita exacta |
| 2b | auto | DATA.OVL DS 0x84b4 / 0x84ba | `Yes` / `No` (por `g_wooden_box`) | ✓ «You reply: Yes/No» sin prompt |
| 3 | No | ENDMSG @0x49 | `«"The sandalwood box, from …» (97 B, sha1 9cfcfd50 — recortado; verifica contra tu copia)` | ✓ (testigo añade una coma «passage, in» al transcribir el vídeo; el byte-exacto NO la lleva → manda ENDMSG.DAT) → auto `No` |
| 4 | Yes | ENDMSG @0xab | `Lord British carefully opens the box...` | ✓ cita exacta |
| 5 | Yes | ENDMSG @0xd3 | `«"An artifact of astral …» (82 B, sha1 18f9f70e — recortado; verifica contra tu copia)` | ✓ |
| 6 | Yes | ENDMSG @0x128 | `«"From the world that …» (60 B, sha1 3a5bb5b9 — recortado; verifica contra tu copia)` | ✓ cita exacta |
| 7 | Yes | ENDMSG @0x167 | `«"Often did I return …» (95 B, sha1 77915b39 — recortado; verifica contra tu copia)` | ✓ cita exacta |
| 8 | Yes | ENDMSG @0x1c9 | `"Older even than Mondain's evil are the forces which bind us here..."` | ✓ |
| 9 | Yes | ENDMSG @0x211 | `"But older still is the power of the Orb of the Moons!"` | ✓ «…the Orb of the Moons!» |
| 10 | Yes | ENDMSG @0x24b | `«"FOLLOW!" cries Lord British, …» (136 B, sha1 7e38bbb8 — recortado; verifica contra tu copia)` | ✓ cita EXACTA (→ GAP 4: orb/moongate) |
| 11 | No (terminal) | ENDMSG @0x2d5 | `¶"Well then, pull up a chair."¶¶"We shall be here a while."` | ✓ cita EXACTA (→ GAP 3b: LB-sentado, sala-prisión) |

**Careo global: 11/11 beats casan con el testigo.** Ningún offset mal derivado. La única discrepancia
(coma en «passage, in» del testigo) es una transcripción humana del vídeo; el byte-exacto de ENDMSG.DAT
es la fuente. Labels estáticos adicionales de DATA.OVL (no-diálogo, para el frame): DS 0x84cc
`¶¶He says:¶¶`, DS 0x849a ` lives!¶`, DS 0x9c40 `¶Enjoy!"`.

**Estructura del guion (para el script `endgame:dialogue` — patrón RefugeScript):**
- beats 1-2 SIEMPRE. Fork por `woodenBox` (auto Yes/No, beat 2b).
- rama Yes: beats 4→5→6→7→8→9→10 (cada uno una página paceada por tecla) → GAP 4 (orb/moongate).
- rama No: beat 3 (2ª pregunta + pista del passage) → si sigue No → beat 11 → GAP 3b (stranded, LB-sentado).
- El core ya ramifica `ending` por `woodenBox`; sólo falta enganchar esta lista de páginas + el paceo.

#### GAP 1 — traza adicional (las 4 preguntas del combate)
- **(2) def + estado `absorbed` — ✅ DERIVADO** (arriba, SJOG 0x1ea4): sombra = sprite-clase 0x3c;
  absorb = retirar-del-tablero reversible (`0xffffbe02` índice negado), 1 miembro por CONTACTO (la
  rutina retorna tras retirar uno, 0x1f22). NO es status 'D'.
- **(1) trigger real — ✅ CERRADO 2026-08-04 (carril endgame-cierre; detalle byte a byte en
  `endgame.md` §Trigger).** El «stub de kernel» sí se resuelve: `ULTIMA.EXE` CS **0x7c4a** =
  `lcall 0x72e:0x2ec` + word inline **13** (=ENDGAME.OVL) + `ljmp` a 0xa8d8 = **endgame_main 0x0648**;
  es el **único** stub de overlay 13 entre los 164 stubs PLINK del EXE. Lo llaman **dos** sitios y los
  dos con el MISMO gate: `DUNGEON 0x00cb` y `SJOG 0x2046`, ambos `cmp [g_unk_58a0],0x4d`. Y **0x4d lo
  escribe un solo sitio en todo el binario: SJOG 0x1edc, dentro de `absorb` 0x1ea4** (el resto de
  escrituras a 0x58a0 son ceros o el índice de borde de huida 0x1be2). ⇒ **el gatillo del endgame ES la
  absorción**, no la posición ni las regalías. (Los `cmp 5`/`cmp 6` de DUNGEON 0x1db8/0x1dec son otro
  uso del mismo byte multiplexado — no son fases del endgame; la pista de la versión anterior era una
  lectura de más.)
- **(3) todos absorbidos → ✅ RESUELTO por (1), sin oráculo.** No hace falta contador de absorbidos ni
  `cmp party_size,0`: el combate acaba por su vía NORMAL (el tablero se queda sin actores del bando
  jugador, porque `absorb` los retira con índice negado) y el centinela 0x4d DESVÍA esa salida al
  endgame en vez de devolver al bucle de mazmorra. El testigo (toda la party absorbida antes del
  re-tinte) queda EXPLICADO, no sólo correlacionado.
- **(4) empalme restaurador combate→cutscene — donde `endgame_throne_scene` (0x0000) re-añade:** los
  absorbidos se retiraron con índice negado (reversibles); la cutscene los RE-AÑADE al re-pintar la sala
  verde (GAP 2). El re-add exacto vive en throne_scene 0x0000 (sprites del party 0x5c5a) — leer esa
  rutina para el mecanismo de restauración. **PENDIENTE con GAP 2.**

⇒ RESUMEN GAP 1 (actualizado 2026-08-04): la MECÁNICA `absorb`, el **TRIGGER**, la **condición de fin**
y la **carga de ENDGAME.OVL** están los cuatro derivados byte a byte — el «stub de kernel opaco» resultó
ser el stub PLINK `ULTIMA.EXE 0x7c4a` y se resolvió con la regla canónica de `overlay-load-layout.md`
(ningún oráculo hizo falta). **Lo que sigue abierto es UNO solo: (e)**, qué hace la absorción exclusiva
de la celda de LB — y ya está acotado a los DATOS del encuentro, no al código. El re-add (4) se cierra
con GAP 2. ⚠️ El port no implementa NADA de esta cadena (`checkDoomRescue` = `floor==7`, ver (d)).

---

## ADENDA (carril endgame-polish, 2026-07-22) — GAP 2 y GAP 6 CERRADOS por derivación nueva; GAP 4 sprites extraídos; GAP 5 mecanismo acotado

### A. GAP 2 — la ESCENA VERDE es un RECOLOR DEL TILESET EN RAM (EGA.DRV fn36, ax=4) — ✅ CALCO

**Hipótesis previa FALSADA:** las tablas 0x3da6-0x3dca NO son la data de la escena verde (son el
layout de las pantallas de historia, ver §C). El mecanismo real, byte-derivado:

1. **ENDGAME.OVL 0x0658:** `push 1; call 0xffffcd0e` → (near_call_base 0xa290 + 0xcd0e) & 0xFFFF =
   **residente ULTIMA.EXE 0x6f9e**. (⚠ una lectura previa del carril calculó mal esta suma — 0x679e —
   y descartó la pista; la aritmética correcta es 0x16F9E & 0xFFFF = 0x6F9E.)
2. **Residente 0x6f9e:** `ax = arg + 3` → driver selector **0x6c = fn36** → con arg=1 ⇒ **fn36(ax=4)**.
   (0x6fbf = wrapper sin +3 para fn36(0/1) save/restore; 0x71aa = fn36(2) manecillas del reloj;
   fn36(3) = los byte-swaps de animación de tiles.)
3. **EGA.DRV fn36 ax=4 (entry 0x2c4e):** convierte el buffer de tiles ([cs:0x206]) planar→4bpp
   empaquetado (bucle 0x2c5f-0x2cac, bx=0x4000 grupos = 64 KB = 512 tiles), y pasa el RECOLOR
   `call 0x2d5d` (cx=0x80, in-place, LUT por nibble: tabla BAJA **0x2d4d**, tabla ALTA <<4 **0x2d3d**)
   por una LISTA HARDCODED de 22 tiles (0x2cb0-0x2d33, `mov si,OFF` con tile = OFF/0x80); después
   0x17be re-empaqueta. **T1K.DRV 0x1dfc = la misma LUT** (CGA aparte).
4. **LUT (EGA.DRV 0x2d4d, byte-exacta):** `00 05 04 04 02 01 02 07 08 0c 0c 0c 0a 09 0e 0f` ⇒
   azul→magenta, verde→rojo, cyan→rojo, rojo→verde, magenta→azul, marrón→verde, azul-claro/
   verde-claro/cyan-claro→rojo-claro, rojo-claro→verde-claro, magenta-claro→azul-claro;
   negro/grises/amarillo/blanco fijos.
5. **Lista de tiles (0x2cb0-0x2d33, orden del binario):** 0x44 0x5c 0x5d 0x90 0x92 0x94 0x96 0x9b
   0xab 0xac 0xaf 0xb0 0xb1 0xbf **0xdc** **0x108** 0x10e 0x11a 0x138 0x139 0x13a 0x13b.
6. **La sala:** endgame_main 0x065f-0x066f lee `MISCMAPS.DAT[0x210, 0xb0]` (=[528:704], la MISMA
   sala que ya usa el port) al buffer 0xac64 y la copia 11×11 al buffer de mapa vivo 0xad14
   (stride 0x20) — **0xad99 = 0xad14 + 4·0x20 + 5 = la celda (col5,row4)**: el «marcador del
   moongate» de GAP 4 es un POKE de tile en el mapa vivo, coherencia total.

**Careo (frames del testigo 2:34 @20s vs @32s, muestreo por celda):** ladrillo 0x44 rojo/marrón→verde ✓;
antorchas 0xb0/0xb1→llama verde ✓; mesa/sillas 0x94/0x9b/0x96 → verde con amarillo INTACTO (14→14) ✓;
cama 0xab/0xac azul→magenta (1→5) y azul-claro→rojo-claro (9→12) = la «manta ROJA» del testigo ✓
(la divergencia «manta azul» del port RESUELTA); estanterías 0x5c/0x5d casi neutras ✓; espejo-arco
**0x9d NO está en la lista** → conserva azul/amarillo (el «arco sur» del testigo) ✓; muros 0x4d fuera ✓;
**LB de pie = tile 0x17c** (registro 0x5d52 tile 0x7c | 0x100), tampoco en la lista → magenta NATIVO ✓.

**Port:** `ENDGAME_RECOLOR_LUT` + `ENDGAME_RECOLOR_TILES` + `buildEndgameAtlas` en
`game/src/skin/fiel/endgame-frame.ts`; la piel pinta TODAS las fases de sala (y el fondo de la
disolución) del atlas recoloreado con capa de fuego propia (las antorchas titilan VERDES: el fn32
del original opera sobre el tileset ya mutado). El re-tinte procedural Clase-B queda RETIRADO.

### B. GAP 4 — sprites del orb y del gate: EXTRAÍDOS (sin redibujar)

- **ORB = tile 0x108:** el registro #6 se activa con tile 8 (0x0968 `mov al,8`); los actores de la
  cutscene dibujan `tile | 0x100` ⇒ atlas 0x108 = estallido AZUL 16×16, que la lista fn36 recolorea
  a ROJO (9→12, 11→12, 3→4). Careo testigo 84-88 s (estallido rojo en la celda del gate) ✓.
- **GATE = tile 0xdc del atlas recoloreado** (0xdc ∈ lista fn36) = el «rectángulo rojo macizo»
  (cuerpo 0x9→0xc). El virado por luminancia del port queda RETIRADO.

### C. GAP 6 — LAYOUT de las pantallas de historia BYTE-DERIVADO (la rutina 0x0000 ES esto)

`endgame_throne_scene 0x0000` = compositor de las 6 PANTALLAS de historia. Por página i (0..5),
tablas en DATA.OVL (fileoff = DS+0x10):

| tabla DS | contenido | valores i=0..5 |
|---|---|---|
| 0x3df4 | fichero de arte (índice en handles 0x261a: 0=END1.16, 1=END2.16) | 0 0 0 1 1 1 |
| 0x3dee | sub-lámina del fichero | 0 1 2 0 1 2 |
| 0x3dfa / 0x3e00 | x / y del blit del arte (`call 0x6abc(h, sub, x, y, 0)`) | x: 0 64 0 0 0 160 · y: 0 0 52 0 92 0 |
| 0x3e06 | gate de TITULARES (draws con el handle TEXT.16 de 0x260c) | 1 0 0 1 0 0 |
| 0x3dca | offset de la página en END.DAT (careado contra los `{` del fichero) | 0x0 0x1a8 0x3bc 0x5fa 0x8e8 0xb74 |
| 0x3da6/0x3da7 (bytes, stride 2) → g5146/g5148 | x0 de banda A / banda B de TEXTO | A: 172 0 0 179 0 0 · B: 0 0 196 0 161 0 |
| 0x3db2/0x3db4 (words, stride 4) → g514c/g514e | x1 de banda A / banda B | A: 320×5, 154 · B: 320×6 |
| 0x3dd6 → g5150 | y del CORTE banda A→B | 126 126 42 100 82 112 |
| 0x3ddc → g5152 | y1 de banda B | 200 200 148 200 200 200 |
| 0x3de8 → g5158 | y0 de banda A | 66 92 9 38 9 0 |

Titulares (inmediatos en código): página 0 (0x00d6-0x0110) = The(sub 0) en (216,0) + Homecoming(sub 4)
en (152,28) APILADOS; página 3 (0x01c4-0x01e2) = Dream(sub 5) en (224,0) + The(sub 0) en (176,0) EN
LÍNEA. Mismos índices 0/4/5 que text16:* del atlas de la intro (careo cruzado ✓).

**Semántica de bandas** (g5146-g5158 = DOS rects encadenados del kernel de texto justificado
`call 0xffffda56` → stub 0x7CE6): INFERIDA por consistencia con las 6 páginas (x0 de banda A =
ancho del arte + 4..6 px exactos donde el arte va a la izquierda; corte = borde inferior del arte;
banda izquierda 0..154 en la página 5 con arte a la derecha) + careo del frame del testigo (p0:
texto junto al arte desde y66 bajo los titulares apilados ✓). Los VALORES son volcado byte-exacto.
El port sustituye el STORY_LAYOUT Clase-C por estas tablas (`STORY_LAYOUT` + `drawWrappedBands`).

Los beeps 0x0502/0x050c del censo GAP 8 quedan por tanto en el compositor de HISTORIA (no en un
«re-tinte»); el careo temporal del censo (~27 s) debe revisarse contra la transición de pantallas.
NOTA de catálogo: `endgame_catalog.py` llama a 0x0000 «throne_scene» — el nombre es histórico;
la función es el compositor de pantallas de historia.

### D. GAP 5 — mecanismo de la disolución ACOTADO (sitio del disparo aún abierto)

- **Regla de near-calls corregida:** los `call` POSITIVOS de un overlay también resuelven con
  `(near_call_base + target) & 0xFFFF` — la nota previa («positivo <0x81D0 = residente al mismo
  offset») es FALSA y produjo los targets «a media instrucción». Con la regla buena, el tail del
  empalme (0x0a39-0x0a6d) resuelve limpio: `0x6e50`→0x10E0 = driver SEL 0x51 (dibuja tile 0x44 en
  (5,4): restaura el suelo del gate); `0x6992(1/0)`→0x0C22 = SEL 0x0f fn5 = SELECT de render-target
  (pantalla/backbuffer, flag [handle+0x1e]); `0x67e0(0)`→0x0A70 = SEL 0x2d (color [0x52da]=0);
  `0x6d9e`→0x102E = SEL 0x5a fn30 = **int 21h/49h: LIBERA el segmento del tileset**; `0x6816(0,0,
  0x13f,0xc7)`→0x0AA6 = SEL 0x3f fn21 = op de rect por filas (con target=backbuffer: CLEAR a negro
  de (0,0)-(319,199)). ⇒ el tail es TEARDOWN (backbuffer negro + free del tileset), NO la disolución.
- **fn32 (SEL 0x60) no es solo el generador LFSR: es el PRESENT.** Dos wrappers residentes:
  **0x1113** (STC + rect/args; la primitiva 0x1112 del port = revelado parcial del moongate) y
  **0x6fd6** (CLC + `ax=[0x539c]` = MODO de present). La disolución a pantalla completa = present
  del backbuffer (negro) con el modo-disolución (orden LFSR ya derivado en visualLfsr.ts).
  0x6fd6 lo llama p. ej. el compositor de sprites de cutscene residente 0x4552 (bucle de la tabla
  0x5c5a, 32 slots) al final de cada pasada.
- **ABIERTO (banco honesto):** el sitio exacto que arma `[0x539c]` = modo-disolución en la
  transición del endgame (¿init del compositor de historia via 0xffff828e(2)? — ese thunk aún
  resuelve sucio). El ORDEN y el efecto observable ya están calcados en el port; lo pendiente es
  SOLO la cita del disparo.

### E. Careo visual adicional (frames nuevos del testigo)

- @99-102 s: disolución píxel-a-píxel del frame COMPLETO (chrome incluido) a negro, ~2 s ✓ (modelo
  «present del backbuffer negro en orden LFSR» consistente).
- @102 s: página 0 de historia = arte en (0,0), The/Homecoming apilados arriba-derecha, texto
  justificado junto al arte desde ~y66 y a todo el ancho bajo y126 — CLAVA el layout derivado §C ✓.

### F. GAP 5 — RUTINA PINTORA DERIVADA COMPLETA (carril dissolve-re, cold-disasm) — ✅ CERRADO

**Veredicto: CALCO-IMPLEMENTABLE.** La disolución del endgame NO es fn32: es **EGA.DRV fn34
(SEL 0x66), camino CLC @0x2570** — el fizzle-fade que el port YA tiene calcado en
`game/src/core/transition/fizzle.ts` — y su disparo es **ENDGAME.OVL 0x004b** (compositor de
historia fn 0x0000). Detalle y correcciones:

#### F.1 Corrección del modelo §D (dos errores)

- **`[0x539c]` NO es un «modo de present»**: es la TABLA de 4 words de SEGMENTOS de recursos
  cargados, indexada por handle (0..3). Único write en todo el EXE: el loader **0x1d02**
  (`0x1d41: mov [si+0x539c], bx` con si=handle×2, bx=segmento alloc'd por 0x15c6+0x160e).
  Slot 0 = el tileset. El wrapper 0x6fd6 pasa ese segmento en ax… y **fn32-CLC lo IGNORA**
  (clobber inmediato en 0x1fa8).
- **fn32 (SEL 0x60) NO es el present ni la disolución.** Entrada real 0x1f98 = `jnb 0x1f9d /
  jmp 0x24d6` (despacho por carry; el disasm lineal desincroniza justo ahí):
  - **CLC @0x1f9d = pasada de ANIMACIÓN DE TILESET in-place** (`ds = cs:[0x206]` = segmento
    del tileset): llamas de antorcha por bytes del generador ROR-0x9248 sobre los tiles en
    0xf400+ (0x1fa8-0x1fe4), agua por ROTACIÓN de filas de los tiles 0x80/0x100/0x180/0x4780
    (bloques rep-movsw 0x1fe6-0x20b0), y composición AND/OR de tiles animados (0x20b2+).
    Esto explica «las antorchas titilan» — es la pasada por-frame del compositor de cutscene
    (0x4552), no un present.
  - **STC @0x24d6 = revelado parcial del moongate** (compone media-tile en el slot 0x116 y
    lo dibuja vía 0x1637 = SEL 0x51), como ya decía la nota para el wrapper 0x1112.
- Consecuencia: **`visualLfsr.ts` (ROR-0x9248) queda derivado pero RE-ASIGNADO de rol**: sus
  consumidores reales son (a) el flicker de llamas (fn32-CLC), (b) la FRECUENCIA del ruido
  del fizzle (0x27bc-0x27cd), (c) el gating de ráfagas de fn35 (0x2a03-0x2a16). NO es el
  orden de píxeles de ninguna disolución.

#### F.2 La rutina pintora: EGA.DRV fn34 (SEL 0x66), entrada 0x256b

`0066: jmp 0x256b`; entrada = `0x256b: jnb 0x2570 / jmp 0x26b6` (despacho por carry).

**CLC @0x2570 — fizzle de RECT (la disolución del endgame).** Args ax,bx,cx,dx = x0,y0,x1,y1
en píxeles (el wrapper residente 0x0f46 los clippea a 0..0x13f/0..0xc7 vía 0x8e6):
1. w=x1-x0+1, h=y1-y0+1; di = tabla-de-filas `cs:[y0·2+0x72]` + x0/8; es=0xA000,
   ds=`cs:[0x202]` = BACKBUFFER (4 planos consecutivos de 8000 B; avance de plano por
   `ds += 0x1F4` párrafos en el plot).
2. n = w·h; ancho de LFSR = nº de bits de (n−1) (0x2599-0x25a3); taps = word
   `cs:[(bits−2)·2 + 0x254d]`. **La tabla 0x254d tiene 15 entradas, ancho 2..16**:
   03,06,0C,14,30,60,B8,110,240,500,CA0,1B00,3500,6000,**B400**. Full-screen 320×200 →
   n=64000 → bits(63999)=16 → **taps 0xB400** (LFSR de Galois de 16 bits maximal).
3. Bucle (state inicial = 1, 0x25af): pos=state; `div w` → y=pos/w, x=pos%w (0x25b6-0x25be);
   si y≥h se SALTA (estado fuera de rango); si no, **plot 0x263a**: un píxel copiado
   backbuffer→VRAM (GC bit-mask = 0x80>>(x&7) tabla 0x2545; por plano SEQ map-mask 1,2,4,8;
   read latch + write, offset di+y·40+x/8). Avance: `state >>= 1; if(carry) state ^= taps`
   (0x25ec-0x25f7); fin cuando state==1 de nuevo → **plot final (0,0)** (0x2600-0x2604), el
   único punto que el LFSR no visita. Total: CADA píxel del rect exactamente una vez.
4. **Sonido/delay/abort — gate `cs:[0x253d]`**: si ≠0, cada 2º píxel (toggle 0x253f) llama
   al tick **0x27af** = speaker ON + tono PIT aleatorio en [100, [0x27a7]/2] Hz (frecuencia
   del generador ROR-0x9248 en [0x27a5]; [0x27a7] se incrementa por tick → BARRIDO creciente)
   + delay calibrado ([0x1c1e]) + poll int16 (tecla ⇒ STC ⇒ aborta el resto, 0x25c6→0x2607).
   **[0x253d] nace =1 y lo pone a 0 el PRIMER draw de tile (SEL 0x5d @0x19d2, side-effect;
   nada lo repone)** ⇒ el crackle+abort sólo existe en el fizzle del TÍTULO; las disoluciones
   in-game y la del ENDGAME son SILENCIOSAS, sin delay y sin abort — cadencia = velocidad de
   I/O del hardware. Consistente con el testigo (99-102 s ≈ 2-3 s para 64000 px, sin ruido).

**STC @0x26b6 — fizzle de UN TILE, un paso por llamada** (si=tile·0x80 vía shl 7; di=nº de
paso: 0=reset+píxel(0,0), 1=state:=1; cada llamada avanza el LFSR de 8 bits taps 0xB8 UNA
posición y pinta 1 píxel del tile 16×16). Wrapper residente **0x1068**: bucle di=0..0x100
con DOS llamadas por paso (2 tiles) + beep cada 8 pasos — la aparición píxel-a-píxel del
moongate en juego normal.

#### F.3 El DISPARO (el «sitio que arma el modo» — resuelto)

Los llamadores del wrapper residente **0x0f46** (entrada `55 8b ec` @0x0f46; args (x0,y0,x1,y1);
CLC + SEL 0x66) no están en residentes sino en OVERLAYS vía near-call sesgado (por eso el
análisis previo dio «0 callers»). Censo completo (regla `(near_call_base + printed) & 0xFFFF`):

| sitio | args (x0,y0)-(x1,y1) | qué es |
|---|---|---|
| **ENDGAME.OVL 0x004b** (`call 0x6cb6`, base 0xa290) | **(0,0)-(0x13f,0xc7)** = 320×200 | **LA DISOLUCIÓN DEL ENDGAME** |
| BLCKTHRN.OVL 0x098c y 0x0bfa | (8,8)-(0xb7,0xb7) = viewport 176×176 | secuencia Blackthorn/muerte |
| SJOG.OVL 0x08af | (8,8)-(0xb7,0xb7) | transición de viewport |
| INTRO.OVL 0x037e | rect parcial (…,0x56,0x4b,0x78) | título |
| INTRO.OVL 0x060c | (0,0)-(0x13f,0x64) = media pantalla | título |

El de ENDGAME está al ARRANQUE del **compositor de pantallas de historia (fn 0x0000)**:
`0x0008 push 2; call 0xffff828e` (thunk aún sucio → 0x2b1e cae a media instrucción; NO
bloquea nada) → carga de 3 recursos vía [0x25ea]/[0x260c]/[0x261a] con retry (0x000f-0x003c,
los arts de historia se cargan ANTES para que la disolución tape la latencia) → **0x003f-0x004b:
push (0,0,0x13f,0xc7); call 0x6cb6 → 0x0f46 → fn34-CLC** → después `push 1; call 0x6992`
(target=backbuffer) y compone la página 0. Como el tail del empalme (§D) dejó el backbuffer
NEGRO (0x6816 clear) — **el fizzle presenta backbuffer negro sobre el frame vivo = «el frame
se deshace en píxeles dispersos a negro»**. Modelo §D confirmado en el efecto, corregido en
el mecanismo (fn34, no fn32).

Nota: fn35 (SEL 0x69; STC @0x28c6 = materialización full-screen desde negro con present por
bandas de 49 filas y ráfagas de ruido; CLC @0x2832 = present de una banda) lo usa SOLO
INTRO.OVL (0x209e/0x20b8) para las story screens del Summoning — el endgame NO lo llama.

#### F.4 Espec de calco para el port (sustituir la aproximación)

- **`endgameDissolveOrder` (endgameDissolve.ts) está usando el generador EQUIVOCADO** (el
  revoltijo fn32 + índice lineal). Sustituir por el orden de `fizzle.ts` (que ya es el calco
  correcto de fn34): poly **0xB400**, seed 1, `pos=state`, `x=pos%320`, `y=pos÷320`, descartar
  y≥200, y **anexar el píxel (0,0) AL FINAL** (no al principio).
- **Bugs de `fizzle.ts` a corregir**: (1) a `FIZZLE_POLY` le FALTA la entrada 16 → 0xB400 —
  justo el caso del endgame; hoy cae al fallback 15-bit 0x6000, que sólo cubre 32767
  posiciones (<64000). (2) `fizzlePolyForSize` usa `bitWidth(size)`; el driver usa
  `bitWidth(size−1)` (off-by-one en potencias de 2). (3) el header «0 callers / cola
  oráculo» queda OBSOLETO: caller estático = ENDGAME.OVL 0x004b (+ tabla F.3).
- **Granularidad**: 1 píxel por paso (16 colores reales: los 4 planos por píxel). Orden único
  determinista, sin semilla variable.
- **Cadencia**: en el endgame NO hay delay del driver ([0x253d]=0 desde el primer tile) —
  el original va a velocidad de I/O; la verdad de cadencia es el TESTIGO: ~2-3 s los 64000 px
  (≈25k px/s) — Clase-C acotada por vídeo, pacear uniforme a esa duración. SIN sonido y SIN
  abort por tecla en el endgame (el crackle del fizzle sólo aplica al título, si algún día se
  calca la intro).
- Reusar el MISMO camino para BLCKTHRN/SJOG (viewport (8,8)-(183,183), poly 15-bit 0x6000)
  cuando toque — mismos árboles, otro rect.

Side-notes fuera de alcance: (a) la cabecera de `dissolve.ts` atribuye el wipe por filas a
«fn37 sel 0x6f» — FALSO: SEL 0x6f = `jmp 0x1de8` = ESCRITURA de la constante de velocidad
[0x1c1e] (el wrapper EXE 0x1143 le pasa la calibración [0x5356]); el wipe 0x1b23-0x1e8c
cuelga de otro selector — revisar en su carril. (b) el wrapper 0x1068 (moongate píxel-a-píxel
+ beep cada 8) es material para el carril de animación del moongate.
