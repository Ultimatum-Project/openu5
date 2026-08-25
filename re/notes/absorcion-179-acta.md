# ACTA #179 (FASE 1) — la absorción del desenlace, mecanismo COMPLETO en el binario + censo del port

**Fecha:** 2026-08-19 · **Carril:** fix-179 · **Sujeto:** el BINARIO (más un §7 de censo del port).

Compone y cierra la derivación que #175 dejó a un pendiente de dato
(`endgame-absorb-refutacion.md` §6) y añade las dos piezas que ninguna nota tenía
derivadas: **quién puede ser absorbido** (el call-site, no el gate) y **el fin por
tablero vacío** (el retorno 0 del bucle de combate). Todo lo citado aquí está leído
en crudo en esta sesión; lo heredado de #175 se re-verificó instrucción a instrucción
(§3).

---

## 1 · El dato de la celda — el pendiente (a) de GAP 1, MEDIDO

`DUNGEON.CBT`, sala 15 de Doom (`dungIdx` 6 → offset `6*0x1600 + 15*0x160 = 0x98A0`),
= mapa global **cm127**. Los tres ejemplares del repo (`original/u5/ultima5/`,
`original/u5/play/`, `original/u5/ultima5/upgrade/`) son **md5-idénticos**
(`3756831a…`): el dato está prístino, no sucio de partida.

Tiles (11×11, fila a fila):

```
ff ff 4d 4d 4d 4d 4d 4d 4d ff ff
ff 4d 4d 44 44 9d 44 44 4d 4d ff      ← fila 1: ESPEJO 0x9d en columna 5
4d 4d b1 44 44 44 44 44 b0 4d 4d
4d 44 44 44 44 44 44 44 44 44 4d
4d 5c 5d 44 44 44 44 44 92 44 4d
4d 44 44 44 44 44 44 94 9a 96 4d
4d 5c 5d 44 44 44 44 44 90 44 4d
4d 44 44 44 44 44 44 44 44 44 4d
4d 4d b1 44 44 44 44 44 b0 4d 4d
ff 4d 4d 44 ab ac af 44 4d 4d ff
ff ff 4d 4d 4d 4d 4d 4d 4d ff ff
```

(0x4d muro de piedra · 0x44 cobble · 0x9d espejo · 0x5c/0x5d estanterías · 0x92/0x90
sillas · 0x94/0x9a/0x96 mesa con comida · 0xab/0xac cama · 0xaf footlocker ·
0xb0/0xb1 antorchas — nombres de `look2.json`.)

Unidades (fila 5/6/7 del registro, criterio sprite≠0):
**UNA sola: sprite `0x3c`, en (x=5, y=1)** — el alma atrapada, plantada SOBRE el
espejo. `look2[0x13c..0x13f] = "a trapped soul!"` (los objetos/actores se pintan
`|0x100`).

- **Censo de los 128 combatmaps** (BRIT.CBT + DUNGEON.CBT, fila-5 de cada registro):
  el sprite 0x3c aparece **exactamente UNA vez en todo el juego** — esta. La
  «fila 1 de almas» que la regla exigía es en realidad **un alma, columna 5**: la
  única celda absorbente del juego es **(5,2)**, el suelo bajo el espejo.
- Cierra el pendiente (a) de `endgame-derivation.md` §GAP 1 y la predicción de
  `endgame-absorb-refutacion.md` §6: el alma SÍ está en la fila 1 — medido, ya no
  predicción.
- Triggers de cm127: CERO (fila 0 aux todo ceros). PlayerStarts: los cuatro grupos
  idénticos, 6 posiciones centro-sur (X 5,6,4,5,7,3 · Y 6,7,7,8,8,8).
- La sala está **sellada**: borde completo de muro/oscuridad (ni una celda de borde
  pisable) y el Klimb sube a un foso de caída que te devuelve
  (`salas-selladas-mazmorra.md` §celda Doom 7 (5,7)). No hay salida por borde: del
  combate de esta celda sólo se sale por absorción total (o muerte).
- La siembra del alma **no consume RNG**: en el bucle de DNGLOOK (`0x131d-0x1381`)
  su `si` = sprite crudo = 60 ≥ 0x10 ⇒ rama decorado (`0x1360: cmp si,0x10 / jge`),
  sin tirada de cantidad.

## 2 · QUIÉN puede ser absorbido — el call-site, derivado hoy

`absorb` (SJOG 0x1ea4) tiene un solo stub (`ULTIMA.EXE 0x7e66`, verificado con
`re/tools/dispatch_table.py`) y un solo llamador: **COMBAT.OVL 0x0b8b**. Ese 0x0b8b
está en la cola de la rutina **0x063e-0x0b93 = el TURNO DE MIEMBRO DEL PARTY** (la
del getkey `call 0x83dc` @0x0838 y el despachador de teclas 'A'..'Z' @0x084a-0x0b52).
La rutina del turno ENEMIGO (0x03f4, la otra rama del bucle @0x0c87-0x0c90) **no
llama a absorb**.

```
0b79: cmp byte [bp-6],0x30 ; jb 0xb85
0b7f: cmp byte [bp-6],0x36 ; jbe 0xb8e     ; tecla en [0x30,0x36] SALTA el gancho
0b85: call 0xffffda86  → SJOG 0x2012
0b88: call 0xffffb680  → residente 0x5910 (tick)
0b8b: call 0xffffdbd6  → SJOG 0x1ea4 (absorb)
```

`[bp-6]` es **la tecla del turno** (escrita en 0x083b desde el getkey). ⇒ el gancho
(y con él absorb) corre al FINAL de cada turno de miembro, salvo que la tecla fuera
'0'..'6'.

**Refina el aviso de #175:** el gate de absorb no comprueba el bando — cierto — pero
el llamador sí discrimina *de facto*: **sólo un miembro del party puede ser
absorbido**, porque el turno enemigo nunca evalúa el gate. El aviso de portado se
mantiene (portar el gate sin sus dos condiciones de posición sigue disparando el
final), pero un enemigo sobre (5,2) no se absorbe jamás.

## 3 · El gate y el efecto, re-verificados in situ — y DOS llamadas que el acta #175 omitió

Cuerpo 0x1ea4-0x1f25 releído instrucción a instrucción: los cinco términos del gate
y el orden de efectos de `endgame-absorb-refutacion.md` §1 AGUANTAN. Dos llamadas no
estaban en aquella transcripción:

```
1f0b: mov byte [g_active_char],0xff
1f10: call 0x6980                    ; ← OMITIDA: draw_status_panel (repinta el panel
                                     ;   de party; rotulada en calcados-lote-acta.md)
1f13: al = g_cmb_actor ; neg ; dec
1f1b: push ax ; call 0xffffbe02      ; remove_from_board (COMBAT 0x1236)
1f1f: call 0x9990                    ; ← OMITIDA: viewport_redraw (plaga-323-acta.md)
1f22: ret
```

Orden COMPLETO del efecto (para quien lo pacee en la piel): centinela 0x4d → ~~tono
corto (0x573a, arg 0xa)~~ **putchar('\n') — REFUTADO como tono en §10** (0x573a →
kernel 0x16BA, el '\n' inicial del mensaje) → nombre del actor (COMSUBS 0x0094 vía stub 0x7d9a) →
`" is absorbed!\n"` (DS 0x8f02) → tono de absorción (0x842e: 0x28,1,0x7d0,0x4b0) →
`g_active_char=0xff` → repintado de panel → retirada del tablero → repintado de
viewport. **Ninguna de las nueve consume RNG.** (Sonidos: UNO — ver §10.)

`remove_from_board` (COMBAT.OVL 0x1236, resuelto con dispatch_table; control
positivo: el mismo censo resuelve 0x7e66→SJOG 0x1ea4): con índice negado
`-(actor+1)` **borra el registro de actor entero** (bytes +0,+1,+2,+4,+5,+6,+7 a
cero, 0x1266-0x127b) y además su entrada de pantalla en 0x5c5a (0x1287-0x12a4). El
«reversible» de #175 significa: el ROSTER no se toca; en el tablero el actor deja de
existir del todo.

## 4 · El FIN POR TABLERO VACÍO — derivado hoy (la pieza que faltaba)

El bucle de combate es **COMBAT.OVL 0x0b94** (el mismo del barrido de iniciativa ya
citado por el port). Sus piezas relevantes:

- **Recuento por bandos** = `call 0xffffdbfa` → **SJOG 0x1b6c**: recorre los 32
  registros de 0xba14; salta `[rec+2]==0` (ranura vacía/BARRIDA) y `[rec+2]&0x20`
  (caído); clasifica con residente 0x96c6 → `g_cmb_scratch_x` (enemigos) /
  `g_cmb_scratch_y` (party). **El absorbido no cuenta: su registro está barrido.**
- **Entrada (0x0bb2-0x0bc0):** si `x==0` ⇒ `g_cmb_victory_flag=1` LATCHEADO ya en el
  arranque. En cm127 no hay enemigos ⇒ el flag nace a 1 y el mensaje «Victory!»
  (rama 0x0cf6, que exige flag==0) **no se imprime nunca** en la celda.
- **El retorno 0 (0x0ca9-0x0cc7):** tras cada turno se recuenta; **sólo cuando
  `y==0` Y `x==0`** se toma 0x0cb7: `[bp-2]=0` y sale devolviendo 0. Es
  literalmente «el tablero se quedó vacío» — y en la celda ocurre en el instante en
  que el ÚLTIMO miembro es absorbido (o muere: la vía es la misma).
- **El desvío (DUNGEON.OVL 0x00c7-0x00d2):** `dng_enter_room` llama al bucle
  (`call 0x7c32` → COMBAT 0x0b94); con retorno 0 comprueba
  `cmp [g_unk_58a0],0x4d` y, si casa, `call 0x7c4a` = stub ÚNICO del overlay 13 →
  `endgame_main` — **que no retorna** (bucle infinito en ambas ramas,
  `endgame.md`). El marcado de sala-despejada de 0x00de queda aguas abajo: en la
  vía del desenlace no corre jamás.
- **Matiz fiel:** el centinela se arma en el PRIMER absorb y sólo lo limpian el
  arranque de combate (0x0ba1) y los resets censados en #175 §4. ⇒ un miembro
  absorbido + el resto muertos en la celda TAMBIÉN desemboca en el endgame: la
  condición es «hubo al menos un absorb en este combate ∧ el tablero quedó vacío»,
  no «todos absorbidos».

## 5 · RNG — la ventana declarada

- La siembra del alma: 0 rands (§1). El absorb: 0 rands (§3). El desenlace en sí no
  añade tiradas.
- Lo que MUEVE el stream es el CAMBIO DE RÉGIMEN respecto del port actual: hoy
  `checkDoomRescue` dispara el rescate al PISAR la planta 7, sin entrar en la celda
  ni jugar el combate. Con la conducta fiel, entre «pisar la planta 7» y «endgame»
  hay: el paseo hasta (5,7), la entrada a la sala (tirada de expiración de anillos
  del port — condicionada a llevar anillo 42/44), y N turnos de combate. Todo save
  o tour que hoy alcance el endgame por la vía de la planta 7 cambia su consumo.
- El combate de la celda en sí es de RNG mínimo: sin enemigos no hay IA que tire;
  las tiradas son las del arnés de turno que ya existan en el port.

## 6 · El cabo que esta acta NO cierra — declarado con su nombre

El testigo-1 (`endgame-witness-20260721.md` t=0-27) describe «~5 SILUETAS-SOMBRA»
que «avanzan» y «LB SENTADO en el trono» durante el combate. **Ninguna de las dos
cosas existe en el dato ni en el código de siembra**: cm127 tiene UNA unidad (el
alma) y cero triggers; el sembrador de sala (DNGLOOK 0x117e, leído entero de
0x117e a 0x13a1) sólo coloca lo que hay en el .CBT; `dng_enter_room` no añade
actores; y el turno enemigo ni siquiera evalúa absorb. Con el vídeo fuera de esta
máquina (está en el MacBook, `original/av-referencia/endgame/`) y el oráculo
dosbox del mini roto, la adjudicación queda ABIERTA con dos hipótesis nombradas:

- (a) interpretación del testigo sobre frames a 1 fps (los 6 miembros cruzando la
  sala hacia el espejo, leídos como «sombras que avanzan»; el alma animada en 4
  frames como «silueta»), o
- (b) un mecanismo de población no hallado (p. ej. monstruos del pasillo entrando
  con el party) — **no encontrado en DUNGEON/DNGLOOK/COMBAT en esta pasada**.

La MECÁNICA del desenlace no depende de esa adjudicación: con cero enemigos el
bucle corre igual (victory latcheado, sin mensaje) y el final llega por vaciado
del tablero — consistente con lo que el vídeo sí muestra sin ambigüedad (miembros
desapareciendo uno a uno con «is absorbed!» y la cutscene a ~27 s).

## 7 · Censo del port (hueco EXACTO)

| pieza | estado en el port |
|---|---|
| siembra del alma en cm127 | ✅ YA FIEL — `combat.ts seedArenaObject`: sprite 0x3c → `lootLayer` decorado, 0 rands. ⚠ el comentario lo rotula «espejo 0x3c»: es el ALMA (`look2[0x13c]`), el espejo es el TILE 0x9d de la fila 1 |
| gate + efecto absorb | ❌ NADA (`grep -rn absorb game/src/core/combat/` → sólo la absorción de MAGIA, otra mecánica) |
| centinela / desvío del fin de sala | ❌ NADA |
| fin por tablero vacío | parcial — el port modela salida por borde y victoria, pero cm127 es sellada: sin absorb, entrar hoy en la sala sería un softlock (no se llega: ver fila siguiente) |
| trigger del endgame | ❌ INFIEL — `checkDoomRescue` (`game.ts:5955`): `floor==7 ∧ endgameReady ∧ !game-won`, disparado desde `dungeon-cmds.ts:388/422` al LLEGAR a la planta. El binario exige: entrar en (5,7), ser absorbido (fila 2 bajo el alma), tablero vacío |
| guión/escena del endgame | ✅ existe (`buildEndgameScript`, evento `endgame`, `endgameScene.ts`) — sólo hay que RE-COLGARLO de la vía fiel |

**Aviso de diseño para FASE 2/3:** el equivalente fiel de la lectura
`[0xAC74 + columna]` (vis-window fila 1) en el port es «lo PINTADO en (columna, 1)
del tablero»: actor si lo hay, si no objeto/decorado, si no terreno — con
`(tile & 0xfc) == 0x3c` sobre el byte bajo. En cm127 eso es el alma del lootLayer
en (5,1); si un actor se plantara encima, el gate dejaría de casar para los demás —
conducta del binario que hay que calcar, no corregir.

---

## 8 · FASE 2 — diseño del port (careo binario→pieza, ANTES de escribir código)

| binario | pieza del port |
|---|---|
| registro barrido por `remove_from_board(−idx−1)` | status nuevo `"absorbed"` en `CombatantStatus`; `isActive` lo excluye ⇒ recuentos, iniciativa, `over` y latch siguen solos (el recuento 0x1b6c salta registros barridos) |
| latch silencioso de entrada (0x0bb2-0x0bc0: x==0 ⇒ flag=1 SIN print) | latch en el CONSTRUCTOR de `Combat` cuando el bando monstruos nace vacío, sin mensaje (hoy el port lo latchea en el primer `advanceTurn` CON «VICTORY!» — infiel para sala vacía; el testigo no muestra VICTORY! en la celda). `onVictoryLatch` se sigue llamando (semántica #13 intacta) |
| gancho al final del turno de MIEMBRO (0x0b79-0x0b8b, en 0x063e; el turno enemigo 0x03f4 no lo llama) | `maybeAbsorb()` en `advanceTurn`, sólo si el actor que cierra es `kind==="player"`. Divergencia declarada (Clase C): el skip de teclas '0'..'6' ([0x30,0x36]) no se reproduce — en el port esas teclas no consumen turno, así que no alcanzan `advanceTurn` |
| gate: activo ∧ no caído ∧ fila==2 ∧ `vis(fila1,col)&0xfc==0x3c` | `isActive(actor) && actor.y===2 && (pintadoEn(actor.x,1)&0xfc)===0x3c` con `pintadoEn` = actor activo en la celda → si no `lootLayer` → si no terreno (proyección fiel de la vis-window; censo §FASE 2: CERO falsos positivos en los 128 mapas — tiles 0x3c-0x3f de terreno no existen y la única unidad familia-0x3c es la de cm127) |
| efecto (9 pasos, §3) | centinela (`absorbedAny=true`) → ~~sfx tono corto (0x573a arg 0xa)~~ (putchar '\n', §10) → mensaje `{} is absorbed!` → sfx glide(0x4b0→0x7d0, paso 1, dur 0x28 — 0x842e=pcspeaker_glide kernel 0x43AE) → `status="absorbed"` (la piel deja de pintarlo: el filtro de coreview sólo pinta active/sleeping; el panel lo sigue mostrando en el roster — fiel, el roster no se toca) |
| desvío del teardown (DUNGEON 0x00cb / SJOG 0x2046: centinela ANTES de restaurar nada) | `endCombat()`: si `combat.absorptionSentinel` → NO sync de HP/status al roster, NO «BATTLE IS LOST!», NO escape/refuge: `combat=null` + `combat-ended` + los eventos del endgame (game-won + guión), reusando el cuerpo ok de `rescueLordBritish` SIN el gate `endgameReady` (el binario no comprueba regalías en esta cadena — llegar ya las exigió) |
| `checkDoomRescue` | pierde el disparo por `floor==7`; conserva el marcado `in-doom`. La vía fiel: pisar (5,7) → `combat-room` cm127 → absorción → tablero vacío → endgame |

Decisiones con nombre:
- **La marca de sala-despejada de cm127**: el binario no la escribe jamás en la vía
  del desenlace (endgame_main no retorna). El port la escribe en el latch (#13, a la
  entrada). Se deja como está: terminal en ambos casos, y tocar #13 es otra ficha.
- **El sync de HP al roster** se salta entero en la vía del desenlace (calco: ni
  SJOG 0x203e restaura slots ni nada vuelve). Los absorbidos conservan su registro
  de roster intacto — que es lo que la cutscene re-usa.
- ~~**Los dos tonos** entran como cues nuevos del catálogo sfx con sus parámetros
  derivados; si el catálogo no tiene primitiva corta equivalente al 0x573a(0xa), se
  declara el cabo (patrón «passes out», sfx-catalog).~~ **Era UN tono, no dos** (§10):
  el cue único es `combat-absorbed` y el «0x573a(0xa)» era putchar.

## 9 · FASE 2 — la ventana RNG, CENSADA (antes de mover nada)

Hecho medible: **ni la siembra del alma ni el gate ni el efecto consumen UNA SOLA
tirada** (§1, §3), y el gancho en combates ajenos a cm127 es un predicado puro (0
rands). ⇒ fuera de la celda de LB el stream es BYTE-IDÉNTICO.

Quien SÍ se mueve: todo camino que hoy dispare `checkDoomRescue` en la planta 7.
Censo de consumidores (grep sobre e2e/tests/tours/saves):

| consumidor | cómo llega hoy | efecto del cambio |
|---|---|---|
| `game/e2e/endgame.spec.ts` | siembra floor 7 + llama `g.checkDoomRescue()` directo | MIGRAR: la costura pasa a ejercer la cadena real (sala cm127 + absorción) |
| `game/e2e/grandtour/ch17-doom.spec.ts` (broche) | ídem (línea 302) | ídem |
| `game/e2e/shader-escenas-351.spec.ts` #367 | ídem (receta de endgame.spec) | ídem |
| `game/e2e/grandtour/ch18-doom-descent.spec.ts` | se DETIENE en floor 6 a propósito | intacto (su comentario sobre «dispararía en floor7» queda rancio → actualizar prosa) |
| tours espejo / samestate / grandtour resto | ninguno pisa Doom floor 7 | intactos |
| `game/tests/*` (endgame.test, quest.test, endgame-frame.test) | funciones puras / rescueLordBritish directo | intactos (la función persiste) |

Ningún save del corpus (espejo, samestate, checkpoints ch*) representa posición 3D
dentro de Doom (el .GAM nativo no la guarda — sello de ch18), así que **ningún save
queda invalidado**. La ventana efectiva son las TRES costuras e2e enumeradas.

## 10 · Los «dos tonos» eran UNO — careo del cabo sfx (carril fix-absorb-cues, 20-08)

El cabo que este acta dejó declarado («los DOS tonos del absorb como cues sfx») se
cierra REFUTANDO la mitad: el cuerpo 0x1ea4-0x1f25 tiene **una sola llamada de
speaker**. Resolución con `dispatch_table.overlay_near_call_base(SJOG.OVL)` = 0xBF80
(load_seg 0xbf8, reloc_hdr 0) y CINCO controles coherentes con destinos acreditados:

| call en el cuerpo | resuelve a | control |
|---|---|---|
| `0x1ee5 call 0x573a` (push 0xa) | ULTIMA.EXE **0x16BA = putchar** | el MISMO call+arg del funnel 0x1f4b, adjudicado por #161 («putchar('\n') — NO es una pausa», sfx.ts combat-reject); cuerpo leído: gate `dl≤0x7f` + ramas 0x0a/0x0d + glifo por driver |
| `0x1f08 call 0x842e` (push 0x4b0,0x7d0,1,0x28) | ULTIMA.EXE **0x43AE = pcspeaker_glide** | mismo destino que waterfall (OUTSUBS 0x0492) y torch-borrowed (SJOG 0x1a21, #52); orden de push start/end/step/total del testigo OUTSUBS 0x0482-0x0491 |
| `0x766c` (control+) | 0x35EC prompt_direction | acreditado (citas-sesgo-overlay.md) |
| `0x6340` (control+) | 0x22C0 beep | acreditado (#161) |
| stubs `0xbe1a`/`0xbe02`/y el propio `0x7e66` | COMSUBS 0x0094 · COMBAT 0x1236 · SJOG 0x1EA4 | `dispatch_table.stubs()` — los tres coinciden con §2/§3 |

⇒ **El «tono corto (0x573a, arg 0xa)» de §3/§8 era el '\n' INICIAL del mensaje**
(«\n<nombre> is absorbed!\n»), texto y no sonido — la misma trampa de rotular como
sonido una llamada no resuelta que #161 ya desactivó en el funnel de esta banda. Las
menciones de §3/§8 quedan tachado-documentadas apuntando aquí.

**El único tono**: `pcspeaker_glide(start 0x4b0=1200 → end 0x7d0=2000, paso 1,
total 0x28=40)`, byte-idéntico a la tupla de la huida (SJOG 0x1c37, `combat-escape`)
y del anillo (ZSTATS 0xe42, `ring-vanishes`) — que absorber y huir suenen igual es
del binario. Inc real = trunc(800/40) = 20 ⇒ escalera 1200, 1220 … **1980 Hz** (la
nominal 2000 nunca se escribe — ficha #137). Duración del port: ~37 ms.

**Port (cableado en este mismo tren)**: id `combat-absorbed` en `core/sfx.ts`
(derivado del message «… is absorbed!» en `sfxForCombatEvent` — el glide va DETRÁS
del print, 0x1ef5→0x1f08 contiguos, así que la posición por defecto de
`routeCombatSfx` es la fiel y NO hace falta `sfxLeadMs` #208) + catálogo
`skin/fiel/speaker.ts` `glide(1200,2000,1,40)` (ni bloqueante ni encadenado, familia
combat-escape). Tests `game/tests/absorcion-cue-sfx.test.ts` (flujo real cm127 +
predicado + catálogo en crudo + fase), estrenados en rojo; mutantes M1 (sin rama:
2 rojos) y M2 (tupla de torch: 1 rojo) muertos y restaurado 4/4. El putchar('\n')
no necesita pieza nueva: en el modelo por-filas del port el message ya nace en su
propia línea.
