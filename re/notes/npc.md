# NPC + diálogo exactos: NPC.OVL + TALK.OVL (Task 3.5)

Re-derivación EXACTA del movimiento de NPCs de small map y del intérprete de
conversación desde el desensamblado. Ambos son overlays de nivel 2 con
`load_seg*16 = 0xA290` (NPC) / segmento propio (TALK). Direcciones = offset de
fichero dentro del .OVL. Resolución de targets near: `true = (listing + 0xA290)
& 0xFFFF`. Convención pascal: el PRIMER push es el arg de la izquierda.
`rand(lo,hi)` = kernel 0x2092, ambos inclusive (`re/notes/rng.md`).

Port: `game/src/core/npc/manager.ts` (movimiento) + `game/src/core/time.ts`
(`scheduleIndex`) + `game/src/core/dialogue/*` (conversación, port de Redux).
Paridad modelo↔clon: `re/parity/npc/` + `re/tools/test_npc_parity.py`
(`npc-run.ts` ↔ `npc_parity.py`).

## 0. Modelo de datos NPC

### 0.1 Carga de .NPC — NPC.OVL:0x0000 `npc_load_map_data()`
```
0008: dec g_location                       ; 1-based → 0-based
0013: shr ax,3 → file_group = (location-1)>>3   ; grupo de 8 locations
0018..2c: switch file_group → nombre de fichero (DS:0x6d46/50/5e/6a)
003b: within = g_location & 7
004c: offset = within * 0x240              ; 576 B por location
0055: read(file, dst=0x5d5e, len=0x200, off=offset)       ; SCHEDULES (512 B)
0066: read(file, dst=0x659e, len=0x20,  off=offset+0x200)  ; TIPOS (32 B)
007b: read(file, dst=[bp-0x24], len=0x20, off=offset+0x220); DIALOG NUM (32 B)
0090: for di=0..0x1F: [0x5f68 + di*0x10] = dialogNum[di]
00cb: inc g_location
```
- **4 ficheros .NPC** por grupo de 8 locations = `(location-1)>>3`: 0=TOWNE
  (1-8), 1=DWELLING (9-16), 2=CASTLE (17-24), 3=KEEP (25-32). Cuadra con
  `registry.ts:masterForLocation`.
- **576 B/location** en offset `((location-1)&7)*0x240`: 512 B horarios (32 NPC ×
  16 B) + 32 B tipos + 32 B dialog numbers.

### 0.2 Registro de horario — 16 B en `g_npc_sched @ DS:0x5D5E + n*0x10`
`+0x00` aiType[0..2] · `+0x03` x[0..2] · `+0x06` y[0..2] · `+0x09` z[0..2]
(planta; 0xFF = sótano, el clon normaliza a −1) · `+0x0C` times[0..3]. **3
posiciones, 4 tiempos**. Es el `NpcSlot` del clon.

### 0.3 `schedule_index(npcIdx, hour)` — NPC.OVL:0x12E0 → 0/1/2 [VERIFICADO asm]
Listado exacto 0x12F6-0x1327:
```
12f6: al=ah=bl=bh = hour
12fd: sub al,[si]    ; al = (hour - times[0]) & 0xFF   (si = record+0xC)
12ff: sub ah,[si+1]  ; ah = (hour - times[1]) & 0xFF
1302: sub bl,[si+2]  ; bl = (hour - times[2]) & 0xFF
1305: sub bh,[si+3]  ; bh = (hour - times[3]) & 0xFF
1308: xor dx,dx
130a: cmp al,ah; jbe 1311 → else al=ah; inc dx           ; dx=1
1311: cmp al,bl; jbe 131a → else al=bl; mov dx,2          ; dx=2
131a: cmp al,bh; jbe 1321 → else            mov dx,1      ; dx=1 (¡NO 3!)
1321: return dx
```
**Regla exacta**: elige el `times[k]` que MINIMIZA `(hour - times[k]) & 0xFF` (el
periodo empezado más recientemente en aritmética circular de byte). Los `jbe`
(salta/mantiene si `al <= candidato`) hacen que sólo sustituya con estrictamente
menor → **los empates los gana el índice MENOR**. Hay 4 tiempos pero 3
posiciones: **el índice 3 remapea a la posición 1** (quirk, 0x131e). El caso
`times=[0,0,0,0]` da todos los diffs iguales → empate → índice 0. Portado exacto
en `time.ts:scheduleIndex` (reproduce todos los casos del asm y los tests).

### 0.4 Struct runtime — 16 B en `g_npc_rt @ DS:0x5F5E + n*0x10`
Init `npc_activate_all` 0x00D6 (loop di=1..0x1F, salta slot 0):
`+0x00` state · `+0x02` x · `+0x04` y · `+0x06` z · `+0x08` type (=0x659e[n]) ·
`+0x0A` dialogNum · `+0x0C` objIdx · `+0x0E` schedIdx. Arrays paralelos:
> **Corrección (barrido #39, TOWN 0x1726 `npc_place`):** `+0x0C` NO es un
> "contador" — es el **objIdx**, el enlace al slot de sprite visible en la tabla
> de objetos `0x5C5A` (npc_place libera/asigna ese slot al cambiar de planta y lo
> guarda aquí). Ver [[inferible-sweep-f2]].
`g_npc_path @ 0x655E` (word/NPC, 0xFFFF=sin ruta), `g_npc_pathbuf @ 0x615E`
(0x20 B/NPC, hasta 16 pares (x,y)), `g_npc_stuck @ 0x65C2` (word/NPC),
`g_npc_type_tbl @ 0x659E` (byte/NPC, 0=slot vacío; sprite = type+0x100).

## 1. Bucle de mundo — NPC.OVL:0x0DB4 `npc_tick_all(hour)` [asm]
Loop `n = 0..0x1F` (0x1264-0x12D8):
```
1270: if g_npc_type_tbl[n]==0 → skip (slot vacío, sin RNG)
127b: schedIdx = schedule_index(n, hour)
1290: if state[n] <= 1: call npc_check_schedule(n,hour) (0x938);
        si devuelve 0 → siguiente n (NPC quieto en su puesto)
12a2: dispatch por state[n]:
        <= 3  → 0x0F94 npc_follow_path
        4/5   → recomputa ruta (0xdd4/0xdd9 → npc_seek 0x1a0 / npc_scan 0x32c)
        6/7   → 0x0EA6 npc_change_floor
```
El wander (jump-table de aiType, §4.0) se invoca al final del procesado de cada
NPC (0x1261 `call npc_ai_step`), pero **gated por planta**:
```
1251: al = g_floor
1256: cmp [bx+6], ax     ; bx = struct runtime; [bx+6] = npc.z (planta)
1259: jne 0x1264         ; si npc.z != g_floor → NO llama npc_ai_step
125b/1261: call npc_ai_step
```
⇒ el binario **solo ejecuta la IA (y consume RNG) para los NPC en la planta del
jugador**; los de otra planta se quedan quietos y no tocan el stream de rand.
Estados de `+0x00`: 1=idle, 2=mover directo, 3=seguir ruta, 4/5=recomputar/wander,
6=subir planta, 7=bajar planta.

## 2. Cambio de puesto por horario — NPC.OVL:0x0938 `npc_check_schedule` [asm]
Transición exactamente en la hora `times[k]` (0x0961 `for cx=0..3: if
times[cx]==hour`). Si el nuevo puesto está en otra planta → state 6/7 y el NPC
**camina hasta una escalera** (§4.4). Misma planta → state 2 (directo) o 3 (ruta).
El clon TELETRANSPORTA (divergencia, §13.10).

## 3. Primitivas geométricas

### 3.1 `dist(x1,y1,x2,y2)` = MANHATTAN — NPC.OVL:0x06A0 [asm]
```
06a6: [bp-2]=|y2-y1|   06af: [bp-4]=|x2-x1|   06d7: [bp-2]+=[bp-4]   return
```
Es `|dx|+|dy|`, NO Chebyshev. Portado en `manager.ts:manhattan` (el clon usaba
Chebyshev; corregido).

### 3.2 `step_dir(dir)` — NPC.OVL:0x0632 [asm]
Sobre g_cmb_scratch_x/y (0x5876/0x5878), clamp 0..0x20: `1→x++` (este, 0x64e),
`2→y--` (norte, 0x662), `3→x--` (oeste, 0x676), `4→y++` (sur, 0x68a). Portado en
`manager.ts:stepDir`.

### 3.3 `npc_tile_ok` — NPC.OVL:0x0ADC · 3.4 `npc_can_move` — 0x0B9E [asm]
Transitabilidad por bitmap DS:0x367E (`bit = 0x80 >> (tile&7)`), bounds 0..0x1F,
tipo 3 (montura) pasa 0xC8/0xC9. `npc_can_move` = passable ∧ no-ocupado (kernel
0x9472): un NPC no pisa la casilla del party ni de otro NPC. Devuelve 2 si (x,y)
== destino ("ha llegado"). El clon aproxima con `isPassable` + `isOccupied`.

## 4. Movimiento e IA

### 4.0 Jump-table de aiType — NPC.OVL:0x0D00 `npc_ai_step` [VERIFICADO asm]
`aiType = sched[schedIdx]` (0..7). `jmp cs:[bx-0x4fd4]` con bx=aiType*2; tabla de
8 words en fileoff 0x0D9C, rebasada `−0xA290`:
| aiType | word | handler | comportamiento |
|--------|------|---------|----------------|
| 0 | 0xb03c→0x0DAC | ret | **FIXED** — quieto |
| 1 | 0xaff0→0x0D60 | wander(3) | **WANDER** radio Manhattan 3 |
| 2 | 0xafc8→0x0D38 | wander(0) | **BIG_WANDER** — maxdist=0 = SIN LÍMITE |
| 3 | 0xb006→0x0D76 | run-away | huye si `dist(party,npc) < 4` |
| 4 | 0xafd0→0x0D40 | merchant | 🔴 si `dist(party,puesto) < 4` entra en `0x06E4` y **PERSIGUE** (rama `0x0884`), si no wander(3) — **NO** «huye» |
| 5 | 0xb021→0x0D91 | hostil | 🔴 **PERSIGUE SIN gate de distancia** + cola de erratismo — **NO** «flee» |
| 6 | 0xb006→0x0D76 | mismo handler que 3 | 🔴 **PERSIGUE** si `dist(party,npc) < 4` — **NO** «= 3» |
| 7 | 0xb021→0x0D91 | mismo handler que 5 | 🔴 **PERSIGUE SIN gate** + erratismo — **NO** «flee» |
Decodificación de la tabla verificada byte a byte (bytes 0d9c: 3c b0 f0 af c8 af
06 b0 d0 af 21 b0 06 b0 21 b0). El clon mapeaba 0/1/2/3 y trataba 4/6/7 como
wander; ahora dispatch 0..7 exacto.

🔴 **CORRECCIÓN 2026-08-06 (carril `re/npc6`, adjudicada por el lead) — la fila del 6
decía «= 3» y era FALSO a nivel de comportamiento.** Compartir handler no es compartir
conducta: `0x0D76` sólo aporta el gate de distancia y llama a `0x06E4` con el aiType
intacto; allí `0x0824 cmp [bp-2],3 / 0x0828 jne 0x884` **reserva la rama de huida al 3**, y
todo lo demás cae en `0x0884`, cuyo `cmp [bx],ax / jge` adopta la puntuación **menor** =
acercarse. **Este fichero ya lo decía en su §de la posesión del Shadowlord** («aiType 6/7
HOSTIL» · «aiType 3 HUIDA»): la contradicción era interna y el clon copió esta fila, lo que
hacía HUIR a ratas y murciélagos. Tercera vía: de los datos, el 6 lo llevan criaturas
hostiles y el 3 dos aldeanos. Derivación completa en `npc-aitype6-persigue.md`.

🔴 **AMPLIACIÓN 2026-08-06 (mismo carril, #78) — el defecto NO era de una fila: era DE LA
TABLA.** Todo lo que no es 3 cae en `0x0884`, así que las etiquetas del **4, 5, 6 y 7**
estaban invertidas y sólo el 3 huye de verdad. Las filas 5 y 7 quedan corregidas arriba y
**arregladas en el clon** en la misma tanda que el 6; la 4 se corrige **en el texto pero NO
en el clon**, a propósito y con razón medida (abajo).

Lo que distingue a cada una, y es lo que hay que leer antes de tocarlas:
| aiType | gate | consumo del generador | cita del consumo | estado del clon |
|---|---|---|---|---|
| 3 | `dist < 4` | 0..3 — una moneda por mejora salvo la primera | `NPC.OVL:0x083d` | huye ✔, **sin las monedas** |
| 4 | `dist(party,puesto) < 4` | **0** | — | ✘ huye — **sin arreglar**, ver abajo |
| 5 | ninguno | **1..4** — una fija más las de la cola | `NPC.OVL:0x08a5` · `NPC.OVL:0x08d4` | ✔ arreglado en #78 |
| 6 | `dist < 4` | **0** | — | ✔ arreglado en #52 |
| 7 | ninguno | **1..4** | ídem que el 5 | ✔ arreglado en #78 |

**Por qué la 4 se queda fuera y no es pereza:** la llevan **33 NPC en 42 ranuras**, presentes
en **todas** las localizaciones que visitan las cinco escenas de sellos. Arreglarla en la misma
tanda haría **ilegible la ventana** — cualquier movimiento de sello dejaría de poder atribuirse.
Ficha aparte, con su propia ventana. Derivación de las tres filas en `npc-aitype57-hostil.md`.
*(El 5 tiene **cero** ocurrencias en los datos de fábrica; el 7, 36 ranuras sobre 12 NPC.)*

### 4.1 `npc_wander(rec, maxdist, ...)` — NPC.OVL:0x0C50 [VERIFICADO asm]
```
0c57: rand(0,255) (call 0x7e02); test al,8; jne 0xc68 → si bit3=0 NO se mueve   (~50%)
0c68: rand0(0x40)=rand(0,64) inclusive (span 65; push 0x40; call kernel 0x3AAE); and 3; inc → dir 1..4
0c79: scratch = (rec.x, rec.y); step_dir(dir)
0c9a: if maxdist!=0 and Manhattan(destino, puesto) > maxdist → aborta (0xcf8)
0cc0: if npc_can_move(destino) → mueve rec.x/y = destino; or [g_unk_24e6],2
```
**Reglas EXACTAS** (portadas en `manager.ts:wanderStep`, cruzadas en la paridad):
1. **~50% de los turnos el NPC no se mueve** — `rand(0,255)&8`; ese turno consume
   1 rand.
2. Dirección = `rand(0,64)&3 + 1` (span 65; `(raw%65)&3 ≠ raw&3`), **BLINDA**: si esa dirección
   concreta está bloqueada o fuera de radio, el NPC se queda quieto (no reintenta).
   Turno con movimiento intentado = consume 2 rands (255 y 64).
3. Radio en **Manhattan** desde el puesto; **big-wander pasa maxdist=0 → sin
   comprobación de radio** (0x0D38 salta a 0xd66 empujando `ax=0`; verificado).

### 4.2-4.4 Pathfinding / cambio de planta [asm, port ⚠️→formulado]
`npc_scan` (0x032C) = escáner voraz sobre el buffer 32×32, rellena
`g_npc_pathbuf` (hasta 16 pasos), consumido en state 3 (0x0F94). `g_npc_stuck`
(0x65C2) resetea la ruta al pasar 0xC8/0xCC. Cambio de planta (0x0EA6, states
6/7): el NPC camina a una escalera y kernel 0xD89A [= CS 0x7b2a → TOWN.OVL:0x1726 npc_place] lo re-coloca. El clon usa A*
(`findPath`) para acercarse al puesto y **teletransporta** el cambio de planta —
divergencias de trayectoria documentadas (§13.9/§13.10), no portadas.

## 5. Objetivo hostil — NPC.OVL:0x06E4 `npc_target_for_attack` [asm parcial]
Recorre `g_npc_rt` con `dist` (Manhattan); para type∈{5,7} tira `rand(0,0x3F)`
con umbral 0x10 (0x08a1) para decidir persecución; marca `g_unk_65be=0x74/0x61`
(proyectil) y `[0x65bf]=npcIdx`. La CONDICIÓN de hostilidad (atacar guardia, robo
visto, CallGuards) vive en CMDS/kernel → Task 3.9/3.10. No portado (flee del clon
= paso greedy que aleja, ⚠️→formulado).

---

# TALK.OVL — intérprete de conversación

## 6. Entrada y targeting — TALK.OVL:0x041C `talk_command` [asm]
Handler del comando 'T'. Puedes hablar a un NPC **a 2 casillas** si la
intermedia es transparente (mostrador, 0x0458-0x0472). Tiles 0x9D/0xAB → respuestas
especiales. `npcIdx = kernel 0xBB9E [= CS 0x7b1e → TOWN.OVL:0x011e find_npc_by_objIdx](target)`; `converse(npcIdx)` (0x031E).
`is_talkable_tile` (0x0054): tile ∈ {0x29,0x94..0x9C,0xA5,0xAE,0xBA..0xBB,0xBE,
0xCA..0xCB}.

## 7. Despacho por dialogNum — TALK.OVL:0x031E `converse` [asm]
```
0348: si aiType(sched[schedIdx])==4 → sched[idx]=1  (despierta/normaliza)
0357: dlgNum = rec.dialogNum; si 0 → "no responde"
0396: 1..0x7F → load_talk(dlgNum) (.TLK)
03a6: 0xFD → texto jocoso · 03cc: 0xFE → kernel 0xBB02 [= CS 0x7a82 → TOWN.OVL:0x10da town_possessed_npc_attack] · 03d8: 0xFF → 0x01E2 (§8)
```
`dialogNum==0` mudo; `1..0x7F` script .TLK; **0xFD/FE/FF = NPC hardcodeado**
(guardias, Lord British, contraseñas). El clon (`registry.get`) sólo cubre
1..0x7F; los 0xFD/FE/FF faltan → hooks para Task 3.10.

## 8. NPC especiales gated por location — TALK.OVL:0x01E2 [asm parcial]
`g_location==0x12` (castillo) → Lord British/Blackthorn (menú, contraseña strcmp
contra 0x4A9A). `g_location==5` → guardias: `g_gold /= 2`. else → tributo por
miembro. Semántica fina → **Task 3.10 (BLCKTHRN)** + oráculo.

## 9. Intérprete de opcodes TLK — TALK.OVL:0x0F32 `talk_process_byte` [asm]
Opcodes = `opcode_Redux | 0x80`. Texto <0x80 se imprime. Efectos observables:
| byte | efecto | cita |
|------|--------|------|
| 0x89 KarmaPlusOne | `karma = min(karma+1, 99)` (kernel 0x7F70 &karma,1,0x63) | 0x0FD8 |
| 0x8A KarmaMinusOne | `karma -= 1` (kernel 0x7FB6 &karma,1) | 0x0FEA |
| 0x8B CallGuards | kernel 0xBB56 [= CS 0x7ad6 → TOWN.OVL:0x0958 town_alarm_all_npcs] ⚠ **NO es «sólo hostil»** — ver §9.bis | 0x0FF8 |
| 0x8C gold-demand | acumula operando; `talk_demand_gold` (§9.1) | 0x1016 |
| 0x8F Pause/KeyWait | kernel 0x66EC | 0x1010 |
| 0x91-0x9F Question | el NPC pregunta (sub-keywords) | 0x1020 |
| 0xFF Prompt | flush + lee respuesta | 0x1006 |
Handlers 0x81-0x88 (jump-table 0x0F81): JoinParty (§9.2), grant-item (§9.3),
EndConversation, NewSection/goto. El mapeo fino opcode↔Redux queda ⚠️→formulado.

### 9.1 Extorsión — TALK.OVL:0x05B5 `talk_demand_gold` [asm]
```
05bc: n = bce0*100 + bce1*10 + bce2 - 0x14D0    ; cantidad concreta
05f1: si g_gold >= n → g_gold -= n; else → 0x0652: '"' (char 0x22) + DS 0x9328
      (DATA.OVL fileoff 0x9338 = "Thou hast not enough gold!") + '"' + DS 0x9344
      "\n\n" (no cobra) — [la versión previa de esta nota truncaba el string]
0603: (SÓLO tras cobrar) rama post-pago:
      bx = obj_tile(g_npc_rt[npcIdx].objIdx) [0x5C5A]; if (tile & 0xFC) == 0x6C
      (montura) AND g_turn_count >= 0x64:
        g_turn_count = 0; karma = min(karma+1, 99)  (kernel 0x7F70)
        if g_gold == 0 (el pago te dejó a cero): karma = min(karma+2, 99)  (adicional)
```
Portado en `dialogue/effects.ts:applyDialogueEffect` (cobra sólo si `gold >= n`,
si no `'"Thou hast not enough gold!"'` byte-exacto — fix auditoría
`str-talk-not-enough-gold`); la CANTIDAD `n` aún viene del extractor de Redux,
no del encoding de 3 bytes tras el opcode (⚠️ pendiente, §13.4). ⚠️ **La rama
post-pago (0x0603-0x064E) NO está portada**: el bonus de karma del mercader de
monturas (tile `&0xFC==0x6C`, `turn_count>=100`, +1 y +2 si te deja sin oro)
requiere el sprite del NPC + turn_count en el punto de aplicación del efecto;
quirk obscuro declarado como divergencia, no cableado.

### 9.2 Unirse al party — TALK.OVL:0x080A `join_party` [asm]
```
081d: if g_party_size == 6 → "Thou hast no room!" return 0   ; MÁX 6
08d4: copia el record de 0x20 B a g_party (0x55A8 + size*0x20); inc g_party_size
```
El clon acepta el JoinParty en `conversation.ts` y el caller (`party.ts:joinByName`,
`MAX_PARTY=6`) rechaza emitiendo las DOS cadenas del binario por separado —
`"Thou hast no room for me in thy party! ` (DS 0x9348) y `Seek me again if one of thy
members doth leave\nthee.` (DS 0x9372)— y **no corta la conversación** (`return 0`).
🔴 Hasta el 08-08 esta línea decía que el clon rechazaba con "Thy party is full.":
cadena FABRICADA que `58413c38` retiró de `party.ts`. Quien la leyera creería que el
port emite un texto que no emite.

### 9.3 Dar objeto — TALK.OVL:0x0682 `grant_item` [asm] — TABLA COMPLETA (2026-07-18)
El código es el byte crudo del opcode `Change` del TLK. DOS lanes; NO imprime mensaje
(la prosa "thou dost receive" va en el TEXTO del NPC):
- **`code<0x40`** (0x068b): `equipmentQuantities[0x57C0+code]+=1`, cap 99 (kernel 0x7F70).
  NPCs: Thrud (data=8, data=28).
- **`code≥0x41`** (0x06a2): índice `code−0x41`, jump table 11 entradas (file 0x070e):

| code | idx | ítem / offset DS | .gam | asm | NPCs (data=NN) |
|---|---|---|---|---|---|
| A | 0 | food 0x57A8 (word, cap 9999) | 0x202 | 0x06b8 | Cory,Dupre,Margaret,Justin,Terrance,Fiona,Jeremy(1) — 65 |
| B | 1 | gold 0x57AA (word) | 0x204 | 0x06cc | — (ningún NPC; el oro va por el op `Gold`) |
| C | 2 | keys 0x57AC (byte, cap 99) | 0x206 | 0x06d2 | Jeremy — 67 (**10 ramas**, +1 c/u) |
| D | 3 | gems 0x57AD | 0x207 | 0x06d8 | — |
| E | 4 | torches 0x57AE | 0x208 | 0x06de | — |
| F | 5 | grapple 0x57AF | 0x209 | 0x06e4 | Lord Michael (Empath Abbey loc 31, keep.json[15]) — 70 |
| G | 6 | carpet 0x57B0 (byte, cap 99) | 0x20a | 0x06ea | — (cableado magicCarpets++; ver nota) |
| H | 7 | sextant flag 0x57BC=FF | 0x216 | 0x06f0 | David — 72 |
| I | 8 | spyglass flag 0x57BA=FF | 0x214 | 0x06f8 | Lord Seggallion — 73 |
| J | 9 | black badge flag 0x57BE=FF | 0x218 | 0x0700 | Elistaria — 74 |
| K | 10 | skull keys 0x57B1 (byte) | 0x20b | 0x0708 | Kristi — 75 (5 ramas) |

**MISLABEL CORREGIDO** (era "crown/scepter 0x57A8/AA"): 0x57A8=**food**, 0x57AA=**gold**
(word, cap 9999; kernel 0x7f94) por `re/ledger/globals.json`; crown/sceptre son 0x57B4/B5
(otra lane, no ésta). **Cantidad = +1 por op** (asm 0x0694 push 1); el "5 llaves" folklórico
de Jeremy = varias ramas Change (tiene 10), alcanzables de una en una, no un +5.

**Cableado en el clon (2026-07-18, `dialogue/effects.ts` `applyGiveItem`):** TODOS (A..K
salvo el inexistente); ninguno queda sin cablear.
- **F (garfio)**: `state.grapple=true` — lo da Lord Michael en Empath Abbey (loc 31, NO
  un capítulo del tour → no toca sellos). Reasignado del carril ch16 (que no lo necesita).
- **G (alfombra)**: `state.magicCarpets++` (cap 99). **CORRECCIÓN**: el port SÍ tiene
  contador (`state.magicCarpets` + save 0x20a) — la nota previa "sin campo" era falsa.
  Dead-in-data (0 NPCs emiten G), pero mapeado por completitud. La ALFOMBRA como
  TRANSPORTE quedó auditada (carril `fiel/carpet`): capa de vuelo/board/exit/sink/count YA
  fiel; se cableó el DESPLIEGUE por (U)se item 0x10 (`game.useMagicCarpet`, CAST 0x1862).
  **Hueco CERRADO (2026-07-18)**: OBTENER la alfombra — NO era un searchObject sino el
  slot-objeto Carpet2 del .NPC (loc 17, slot 22, (15,18) z2, único en los datos). El (G)et
  despacha por object-tile 0x1b en el switch secundario (SJOG 0x1756 → rama 0x149e:
  print DS 0x8C5C "A magic carpet!\n" + inc g_carpets clamp 99 + borrado de slot kernel
  0xBB92(0x16) gateado a loc 0x11 — 0x16=22=el slot, la constante cuadra). Cableado como
  kind "plot" sin flag de tomado (re-nace por entrada, fiel). Derivación del oráculo-relevo
  (lote-D-witnesses-relevo.md); tests magic-carpet-get.test.ts.
El clon emitía `{kind:"giveItem", item}` pero `effects.ts` lo dejaba NO-OP → todo regalo por
Talk estaba muerto; ahora cableado. Sellos: 0 capítulos del tour disparan un `Change` A..K.

## 10. Matching de keywords — TALK.OVL:0x0000 `kw_match` [asm]
Compara byte a byte con máscara `& 0x7F` y normalización case-insensitive (0x60B2);
coincidencia por PREFIJO (para al llegar a `\0` en la keyword). ✅ El clon
(`getQuestionKey` = `startsWith` en minúsculas) es equivalente.

## 11. Carga del .TLK — TALK.OVL:0x127E `load_talk` [asm]
4 ficheros .TLK (mismos grupos que .NPC), índice de 0x200 B (word offsets por
NPC) + blobs; cada script ≤ 0x400 B en `g_talk_buf @ 0xB21E`. Cuadra con
`extractor/`.

---

## 12. Mapa de funciones (ledger)

### NPC.OVL
| off | nombre | qué hace |
|-----|--------|----------|
| 0x0000 | npc_load_map_data | carga .NPC (§0.1) |
| 0x00D6 | npc_activate_all | init de las 32 structs runtime (§0.4) |
| 0x01A0 | npc_seek | wrapper de pathfinding → npc_scan |
| 0x032C | npc_scan | escáner voraz de ruta (§4.2) |
| 0x0632 | step_dir | paso 1..4 (§3.2) |
| 0x06A0 | dist_manhattan | \|dx\|+\|dy\| (§3.1) |
| 0x06E4 | npc_target_for_attack | selección de objetivo hostil (§5) |
| 0x0938 | npc_check_schedule | transición de puesto por hora (§2) |
| 0x0ADC | npc_tile_ok | transitabilidad + bitmap 0x367E (§3.3) |
| 0x0B9E | npc_can_move | passable ∧ no-ocupado (§3.4) |
| 0x0C50 | npc_wander | wander + skip 50% + radio Manhattan (§4.1) |
| 0x0D00 | npc_ai_step | jump-table aiType 0..7 (§4.0) |
| 0x0DB4 | npc_tick_all | bucle por turno (§1) |
| 0x0EA6 | npc_change_floor | camina a escalera y cambia planta (§4.4) |
| 0x0F94 | npc_follow_path | consume g_npc_pathbuf (§4.3) |
| 0x12E0 | schedule_index | hora → 0/1/2, quirk 3→1 (§0.3) |

### TALK.OVL
| off | nombre | qué hace |
|-----|--------|----------|
| 0x0000 | kw_match | keywords, prefijo/case-insens (§10) |
| 0x0054 | is_talkable_tile | ¿tile hablable? (§6) |
| 0x01E2 | talk_special_npc | LB/guardias/password gated por location (§8) |
| 0x031E | converse | despacho por dialogNum (§7) |
| 0x041C | talk_command | comando 'T' + targeting (§6) |
| 0x05B5 | talk_demand_gold | extorsión con chequeo de fondos (§9.1) |
| 0x0682 | grant_item | dar ítem por código (§9.3) |
| 0x080A | join_party | unir NPC (máx 6) (§9.2) |
| 0x0B04 | talk_ask_interest | prompt "interest" + match (§10) |
| 0x0F32 | talk_process_byte | intérprete de opcodes TLK (§9) |
| 0x127E | load_talk | carga el script .TLK (§11) |

## 13. Divergencias clon ↔ binario (estado)
1. **Diálogo = port de Redux**, no del intérprete de bytes 0x0F32 (coincide en lo
   grande; orden de efectos exacto ⚠️→formulado).
2. Karma: `+1` cap 99 VERIFICADO (0x7F70=`min(x+1,0x63)`); `−1` (0x7FB6, thunk far)
   floor 0 PENDIENTE. El clon clampa [0,99] en `effects.ts`.
3. JoinParty máx 6: el clon rechaza en el caller ("full"). Equivalente. ✅
4. Gold-demand: ✅ chequeo de fondos portado (`effects.ts`, "not enough" si
   `gold<n`); ⚠️ la cantidad `n` aún viene de Redux, no del encoding de 3 bytes.
5. NPC hardcode 0xFD/FE/FF: faltan en el clon → Task 3.10.
6. **schedule_index**: ✅ portado exacto (byte-sub, quirk 3→1). VERIFICADO asm +
   paridad modelo↔clon.
7. **Distancia = Manhattan**: ✅ corregido (era Chebyshev).
8. **Wander**: ✅ skip 50% + dir rand(0,64)&3+1 (span 65) + radio Manhattan + big-wander sin
   límite. VERIFICADO asm + paridad modelo↔clon.
9. Pathfinding: binario = escáner voraz; clon = A*. ⚠️→formulado.
10. Cambio de planta: binario camina a escalera; clon teletransporta. ⚠️→formulado.
11. **AI types 0..7**: ✅ dispatch exacto (era 4/6/7 como wander).
12. NPCs y puertas: el clon las trata transitables sin abrirlas visualmente. ⚠️.
13. **Pestillo horario (#84, 2026-08-17)**: ✅ `npc_check_schedule` (0x0938) portada
    exacta + presupuesto de 1 escaneo/tick + hora inerte + quirk 0x120e. El disparador
    por distancia del clon DESAPARECIÓ. Quedan en #108: buffer/atasco/moneda en el save,
    escáner voraz y `npc_change_floor`. Acta: `pestillo-84-acta.md`.

## 14. Verificación runtime DOSBox y ruta de cierre (Task 3.5 / F.2)

Verificado en vivo (2026-07-10, `test_npc_parity.py::test_world_tick_rng_orbit_live`,
opt-in `U5RE_LIVE=1`, **PASA**): el stream de rand del bucle de mundo (que incluye
`npc_tick_all`) cae en la ÓRBITA EXACTA del rand del kernel — cada semilla de
`g_rng_seed` tras un turno es un paso-forward `_raw16` de la anterior. Es el mismo
generador que consume el wander. Detalle y seeds literales en `re/verified/npc.md`.

**Bloqueo de la observación DIRECTA de los arrays de NPC** (evidencia): los arrays
`g_npc_type_tbl@0x659E`, `g_npc_rt@0x5F5E`, `g_npc_sched@0x5D5E` son **BSS de
trabajo** que sólo puebla `npc_load_map_data` (0x0000) en un evento de ENTRADA al
mapa. Al bootear SAVED.GAM headless están a cero y siguen a cero tras turnos de
mundo; un scan del game segment (0..0xC000) no halla la firma de tipos del .NPC en
ningún offset; escribir `g_location` no recarga los .NPC. Disparar una entrada real
(salir al overworld y re-entrar) exige navegación a ciegas por teclas.

**Ruta de cierre (para F.2 / paridad runtime completa)**: en lugar de esperar la
carga natural, SEMBRAR con `write_mem_gameseg` los tres arrays de un NPC —
`g_npc_type_tbl[n]` (tipo ≠ 0), `g_npc_sched + n*0x10` (aiType/x/y/z/times) y
`g_npc_rt + n*0x10` (state=1, x/y/z, schedIdx)— con el NPC en la planta del jugador
(`g_floor`), y barrer `g_hour` (0x587F) pasando turnos: el binario recompone la
posición vía su propio `schedule_index` (0x12E0) / `npc_check_schedule` (0x0938),
que se lee de vuelta en `g_npc_rt+2/+4`. Cruzar esa posición y (para el wander) el
`g_rng_seed` contra el modelo/clon cierra el ⚠️ runtime de schedule y wander. Es un
arnés dedicado (seeding consistente + barrido de horas), no justificado por su coste
en 3.5; queda anclado por asm + cruce modelo↔clon (14 escenarios) + la órbita RNG
verificada en vivo.


---

## §9.bis — `town_alarm_all_npcs` leída entera (barrido de citas B, 2026-07-25)

Cadena verificada extremo a extremo: `talk_process_byte` **TALK.OVL:0x0ff8** llama a `0xffffbb56` [= CS 0x7ad6 → stub → TOWN.OVL:0x0958], resuelto por la banda 3 (`near_call_base` 0xbf80). Otros dos llamantes del MISMO stub, cada uno con su crudo por banda:
`CMDS.OVL:0x0c08` (`cmd_fire`, raw `0xbb56`) y `SHOPPES3.OVL:0x07a0` (rama «no puedes
pagar» del `inn_pick_up_companion`, raw `0x98f6`).

Cuerpo (0x0958-0x09ba), bucle sobre los 32 slots de NPC:

```
096d: if [0x5f5e + i*0x10] == 0 → siguiente        ; slot inactivo
0972: tipo = g_npc_type_tbl[i]
097a: if tipo ∈ {0xfc, 0xd8, 0x70} → town_possess_hate(i)   ; 0x85e, aiType 6/7 HOSTIL
0992: else  r = rand_range(0, 0xff)                          ; 0xffff9ec2 = CS 0x2092
099c:       if r < 0x80 → town_possess_fear(i)               ; 0x8d4, aiType 3 HUIDA
```

> 🔴 **Corregido el 06-08**: esta línea decía `rand_range(0xff, 0)`, con el par al revés. El
> sitio (`TOWN.OVL:0x0992`) hace `sub ax,ax / push ax` y **después** `mov ax,0xff / push ax`
> ⇒ **primer push = 0 = el mínimo**, o sea `rand_range(0, 0xff)` = una tirada 0..255,
> coherente con el `if r < 0x80` de la línea siguiente. Es una de las **9 citas invertidas
> de 143** que localizó el censo del corpus; las otras siete están enumeradas en
> `npc-aitype6-persigue.md §9`. La regla que no depende de ninguna notación: en el cuerpo
> del generador **lo que se SUMA al resto es el mínimo** (`20bd: add dx,bx` con
> `bx = [bp+6]`).

**Qué sobrevive y qué no del ruling del 2026-07-22** (cita textual: «0x8B = solo flag, kernel 0xBB56 [= CS 0x7ad6]
sin print»):

- ✅ **«SIN print» — CONFIRMADO.** No hay una sola llamada de impresión en los 99 bytes.
  Retirar el «The guards have been called!» fabricado fue correcto.
- ⛔ **«SÓLO flag de hostilidad» — REFUTADO.** La rama hostil es la MINORITARIA (sólo los
  tipos 0xfc/0xd8/0x70). Para todo NPC normal activo la rutina tira `rand(0,255)` y con
  **probabilidad 1/2** le pone aiType **3 = HUIDA** (`town_possess_fear`, que además
  escribe `dialogNumber = 0xFD`, el que dispara «Don't hurt me! Please go away!»).
- ⚠ **CONSUME RNG**: **una tirada `rand(0,255)` por cada NPC activo no-especial** (hasta
  32). El port (`dialogue/effects.ts` `case "callGuards"` → `return {messages: [], ended:
  false}`) no aplica efecto ninguno **ni gasta tiradas** ⇒ además del estado de los NPC,
  **el stream de RNG diverge** tras un CallGuards en pueblo.

> ~~No lo arreglo aquí: es carril de gameplay (y toca paridad de stream). Queda declarado.~~
> ✅ **CERRADO el 2026-08-25** (carril `blackthorn-callguards`, tras el reporte del usuario:
> respondió «no» a la Opresión en el trono, Blackthorn amenazó **y no pasó nada**). El op
> señala ahora `alarm` y `talk-console` lo materializa en `Game.talkCallGuards` →
> `NpcManager.arrestAlarm` — la MISMA rutina 0x0958 ya portada, así que el estado de los
> NPC **y** las tiradas del stream son las del binario. Los dos párrafos de arriba
> describen el port ANTERIOR y se dejan como acta de lo que se midió.
>
> **Censo de llamantes de 0x0958** (re-derivado en crudo el 25-08 — un primer borrador de
> este carril los contó mal mezclando los dos conjuntos, y así quedó): NEAR dentro de
> TOWN.OVL = `0x0b05` ((A)ttack de 0x09e6, portado), `0x0e07` (rama del `g_drunk_timer`
> con `rand(0,1)`, NO portada), `0x1343` (rama 'N' del arresto 0x12ae, portada). FAR por
> el stub CS 0x7ad6 = `TALK 0x0ff8` (CallGuards, ESTE), `CMDS 0x0c08` (`cmd_fire`, NO
> portada) y `SHOPPES3 0x07a0` (rama «no puedes pagar» del `inn_pick_up_companion`, NO
> portada). CallGuards es la TERCERA vía **cableada en el port**, no «la tercera del stub».
>
> **Lo que se ve al pisar la escena** (e2e `blackthorn-trono-nombre.spec.ts`, mirado con
> captura): el trono está en la planta 2 del Palacio y ahí sólo viven los dos daemons
> (0xd8, slots 6/7); los seis guardias 0x70 están en la planta 0 y dos en la −1. Los diez
> pasan de `[0,4,0]`/`[0,0,0]` con horario real a `[7,7,7]` con horario `[0,0,0,0]`, y en
> **2 turnos** un daemon alcanza al party ⇒ `npc_engine 13a7` con tile≠0x70 → tail 0x13dc
> «Attacked! / DAEMONS / *** CONFLICT ***». La captura de Blackthorn (0x12ae) exige un
> **0x70 adyacente** y por eso NO es el desenlace desde el trono: se cobra al bajar.
> Control del instrumento: con el `alarm` retirado, los mismos 20 turnos dan «Pass» y
> **nada** — el bug del usuario, reproducido a voluntad.
