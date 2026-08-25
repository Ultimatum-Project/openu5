# Shadowlords urbanos — presencia en pueblos (F1.10-T6)

Derivación byte a byte del sistema de **presencia de un Shadowlord en un pueblo**:
detección, sprite físico, anuncio de entrada y efectos sobre los NPCs. Todo vive
en **TOWN.OVL** (+ consumidores en TALK.OVL). Strings de DATA.OVL anclados por XREF
del consumidor con `fileoff = DS_off + 0x10` (dataovl-strings.md), volcados sobre
`original/u5/ultima5/DATA.OVL`. Complementa `shadowlord-ritual.md` (T5, convocatoria
+ ritual) — este cierra el §T6.

## 0. Los tres Shadowlords y su índice canónico

Igual que en el ritual (posicional, sin indirección): idx 0=Faulinei/Falsehood,
1=Astaroth/Hatred, 2=Nosfentor/Cowardice. `g_shadowlord_locs @ DS:0x58C8` (3 bytes):
valor = g_location del pueblo donde está el SL, o `>= 0x80` (0xFF) = destruido/ausente.

**Los SL vagan por las 8 ciudades de la virtud** (g_location 1..8 = Moonglow,
Britain, Jhelom, Yew, Minoc, Trinsic, Skara Brae, New Magincia). El re-sorteo de
medianoche (`relocateShadowlordsAtMidnight`, kernel 0x5004) tira `rand(1,8)` → sólo
estas 8. **Stonegate** (g_location 29 = 0x1d) es su guarida (caso especial, §4).
(smallmaps.json es lista 0-based: índice = g_location − 1.)

## 1. Detección + spawn físico — TOWN.OVL:0x02AE `town_place_shadowlord`

Llamada desde la carga de pueblo (0x11F0 en 0x1239) y desde 0x09DF. Escribe
**`g_shadowlord_here_idx` (`g_unk_5958` @ DS:0x5958)** — el índice del SL presente,
0xFF si ninguno — que ya consumían la merma de tiendas (SHOPPES 0x019A, F1.7-E) y
TALK 0x1187 (§3).

```
02b6: mov [g_5958], 0xff
02bb: cmp [g_party_y], 4 ; je 0x2dd     ; party_y==4 (fila de entrada recién puesta) → NO detecta
02c2-0306: for si=0..2:                  ; PRIMER match manda
02cc:   if [si+0x58c8] == g_location → [g_5958] = si
02dd: if [g_5958]==0xff → ret            ; ningún SL aquí
02e7: call 0x212                          ; ★ MARCHITACION del pueblo + RE-SIEMBRA del RNG (§8)
02ef-030c: scan g_world_objects 0x5C5A (stride 8, 32 slots): si algún tile==0xFC → ret
           (el SL ya está colocado, no duplicar)
0314: call 0xffffb714 → ax = SLOT LIBRE de objeto (scan lineal, SIN RNG)   [ver §6]
0324-0343: busca slot de NPC libre (si=0x1f..0, [si+0x659e]==0)
0346-03fc: materializa el SL como ACTOR/NPC:
   [slot+0x5f5e]=1 (activo) · [slot+0x5f6a]=objslot · type=0xFC (0x659e[slot]=0xFC,
   sprite 0x1FC) · aiType 6 (g_npc_sched +0x5d5e = 6/0xf/...) · schedule +0x5d6a zeroed
```

⇒ El SL aparece **físicamente** como un actor de tile **0xFC** (sprite ShadowLord),
colocado por el asignador de slot libre. Camina por IA (aiType 6). Su posición
inicial la fija `0xffffb714` (slot de objeto libre) — **no consume RNG** (scan
lineal; mismo helper que usan MAINOUT spawn 0x07FD/0x0D33/0x1021/0x1BBD y el cofre
TOWN 0x1785). El clon lo coloca como objeto `kind:"shadowlord"` (tile 0xFC ya
reconocido por cast.ts en An Tym).

**Gate `party_y==4`**: si el jugador acaba de aparecer en la fila 4 (la fila de
entrada estándar de pueblo, `SMALL_MAP_ENTRY.y`), la detección se **salta** (0x2bb)
— quirk del binario; en la práctica la detección se re-ejecuta en el siguiente
paso/tick. (Bug-for-bug: registrado; el clon calca el gate.)

## 2. Anuncio de entrada — TOWN.OVL:0x11B8 `announce_shadowlord(idx)`

```
11b8: print DS:0x27b8  = "\nAn air of\n"
11c2: bx=[bp+4] (idx); bx*=2; print word[bx+0x27dc]  = tabla de 3 punteros →
        idx 0 "falsehood" (0x279d) · 1 "hatred" (0x27a7) · 2 "cowardice" (0x27ae)
11ce: print DS:0x27c4  = " doth surround thee...\n"
11d5: call 0xffff9fc2(1, 0xea60, 0x7d0, 1)  ; TONO PC-speaker (freq/dur) — AV/Clase C
11ed: ret 2
```

⇒ **Mensaje exacto** (concatenado): `An air of <falsehood|hatred|cowardice> doth
surround thee...` + un pitido. **[V]** byte-exacto de DATA.OVL. Verificado por dump:

```
0x27b8 "\nAn air of\n"      0x27c4 " doth surround thee...\n"
0x279d "falsehood"  0x27a7 "hatred"  0x27ae "cowardice"   (tabla ptrs @ 0x27dc)
```

## 3. Efectos sobre el pueblo (por cada Shadowlord)

### 3.0 Orquestación — TOWN.OVL:0x11F0 `town_setup` (carga/refresco de pueblo)

Función de entrada al pueblo (map-load 0x408, spawn SL 0x2ae, NPC init). El
anuncio/efecto van al FINAL:

```
1275: if g_location == 0x1d (Stonegate):     ; §4
        for si=2,1,0: if [si+0x58c8] < 0x80 (vivo) → announce(si)   ; SIN efecto
      else:
1294:   if g_5958 != 0xff:
12a1:     announce(g_5958)      ; 0x11b8
12a4:     apply_effect()        ; 0x1156
```

**Se dispara UNA vez por entrada/refresco de pueblo** (0x1156 y 0x11b8 sólo se
llaman desde aquí). Re-entrar re-anuncia y re-posee con rand fresco (no acumulativo:
`enterMap` recarga los NPCs). Punto de enganche en el clon = `checkLocationEntry`
(hermano de checkMoongate/checkShrineEntry), justo tras `npcManager.enterMap`.

### 3.1 Faulinei / Falsehood (idx 0)

- **Merma de oro** en tiendas (`postPurchaseGoldDrain`, SHOPPES 0x019A) — ✅ portada
  en F1.7-E (gate `shadowlordPresentIndex==0`).
- **"Something was stolen!"** — TALK.OVL:0x1180, llamado **incondicionalmente al
  FINAL de cada conversación de pueblo** (0x1305, tras resolver el diálogo):
  `if [g_5958]==0 → print DS:0x94dc "\nSomething was stolen!\n" + tono`. Bajo Faulinei,
  cada charla termina con la acusación de robo (paranoia). **[V]** byte-exacto.
  ⚠ **Y no es sólo la acusación: se lleva una pieza de verdad.** Tras el mensaje va la
  CASCADA del botín (llaves/gemas/antorchas con re-tirada · equipo · pociones ·
  pergaminos · oro `rand(1,15)` al fondo). ✅ **PORTADA en #196** —
  `game/src/core/world/faulinei-theft.ts` + `Game.faulineiTheftOnTalkEnd` +
  `TalkConsole.end()` como embudo del 0x1305. Derivación en
  `shadowlord-urbano-acta.md §2`.
- **0x1156 NO toca NPCs para idx 0** (jmp 0x11b1): Falsehood no posee, sólo miente/roba.

### 3.2 Astaroth / Hatred (idx 1) — TOWN.OVL:0x1156 rama 0x1170

Para cada NPC si=0..0x1F: si `predicate(si)` [§3.4] → `call 0x85e(si)` + marca
`dialogNumber (word[si*0x10 + 0x5f68]) = 0xFE`.

`0x85e town_possess_hate(si)`: pone aiType hostil (`g_npc_sched[si*0x10+0x5d5e] = 6`
si type<0x2f, si no **7**; los person-tiles ≥0x40 → siempre 7) y **zeroea el
schedule** (`+0x5d6a`, 4 B). Efecto observable: el NPC deja su ruta y se vuelve
**hostil**.

**Consumidores de dialogNumber 0xFE:**
- TALK.OVL:0x03cc: hablar a un poseído-0xFE → `call 0xffffbb02` ~~(inicia ATAQUE, sin
  palabras) — kernel opaco, Clase C.~~ [RESUELTO 23-08 gargolas-residuales: = CS 0x7a82
  far-stub → TOWN 0x10da (imprime DS 0x278a; la degradación 0x8d4 recibe un argumento
  SIN INICIALIZAR — el NPC hablado no se degrada). `gargolas-hostiles-palacio.md` §8.2.]
- TOWN.OVL:0x138a (npc_engine, marcador de ataque 0x61): el NPC 0xFE ataca —
  imprime "\"Begone,\nvermin!\"\n" (DS:0x278a) y procesa el golpe. **Detalle 0x10da**:
  ese golpe llama `0x10da` (`al=[0x65bf]`=el propio NPC activo) → imprime DS:0x278a +
  `call 0x8d4(self)`, es decir el poseído-Astaroth **se convierte en poseído-Nosfentor
  (0xFD)** tras atacar (0x8d4 sobreescribe 0xFE→0xFD, rama 0x0917 je). ~~Efecto de
  combate/IA de pueblo — cae en la **Clase C** de IA/combate ya declarada; no se modela
  (el clon no dispara el ataque de pueblo desde el talk).~~
  [⚠ 23-08, carril gargolas-hostiles: la Clase C quedó SUPERADA por la vía de la
  INTERCEPCIÓN — la rama 0xFE de npc_engine (0x138a→0x1392) está cableada en
  `guard-encounters.ts::checkGuardTribute` («Begone, vermin!» + degradación a
  0xFD/[3,3,3]); ~~la vía del (T)alk (TALK 0x03cc → kernel 0xbb02 = CS 0x7a82 → este
  mismo TOWN.OVL:0x10da)
  sigue sin cablear.~~ Ver `gargolas-hostiles-palacio.md` §5.]
  [✅ 23-08 gargolas-residuales: la vía (T)alk CERRADA — emite DS 0x278a byte-exacto
  (`tryTalkPossessed`), y la degradación por ESA vía NO existe en el binario: TALK
  0x03d3 llama SIN push y 0x10da consume [bp+4] = el si salvado del prólogo de 0x031e
  (argumento sin inicializar, bug de 1988) — el NPC hablado sigue 0xFE. Derivación
  entera: `gargolas-hostiles-palacio.md` §8.2.]

### 3.3 Nosfentor / Cowardice (idx 2) — TOWN.OVL:0x1156 rama 0x1190

Para cada NPC si=0..0x1F: si `predicate(si)` → `call 0x8d4(si)` + marca
`dialogNumber = 0xFD`.

`0x8d4 town_possess_fear(si)`: re-verifica present + tile∈[0x40,0x74), pone
`dialogNumber word[+0x5f68] = 0xFD` y aiType **3** (huida) en `g_npc_sched +0x5d5e`
(3 B). Efecto observable: el NPC **huye**.

**Consumidor de dialogNumber 0xFD:** TALK.OVL:0x03a6: hablar a un poseído-0xFD →
imprime `"` + DS:0x9176 + `"` + `\n` = **`"Don't hurt me!\nPlease go away!"`**. **[V]**
byte-exacto.

### 3.4 El predicado de posesión — TOWN.OVL:0x10F2 `town_possess_gate(si)` [RNG]

```
10f2: mov [bp-2],dx (=0)
      si=[bp+4]; shl si,4                                             ; si = slot*16 (destruye el slot en si)
1105: for cx=0..3:  if g_npc_sched[cx + si + 0x5d6a] != 0 → dx=1      ; NPC presente (per-slot, usa si)
1119: [bp-2]=dx
111c: [bp-4]=cx (=4)
111f: mov bx,cx                                                        ; ← bx = 4 (contador AGOTADO), NO el slot
1121: al = g_npc_type_tbl[bx] = [0x659e + 4]                           ; 🐛 tipo del SLOT #4, CONSTANTE
112a: if al<0x40 || al>=0x74 → [bp-2]=0                                ; gate de tipo sobre el slot #4
1139: r = rand(0,1)   (kernel 0xffff9ec2)      ; SIEMPRE se consume 1 rand
1145: if r != 0 → [bp-2]=0     ; 50%: NO posee
114c: return [bp-2]            ; presente(si) ∧ slot4-persona ∧ 50%
```

🐛 **BUG-FOR-BUG (0x111f-0x1121).** El chequeo de "person-tile" **NO** lee el tipo
del slot evaluado sino `g_npc_type_tbl[4]` — el tipo del **slot #4** del pueblo,
CONSTANTE para los 32. `bx=cx` con `cx` = el contador del bucle interno **agotado**
(=4); el slot original (`si`) se destruyó en 0x1103 al hacer `shl si,4`. Es un bug real,
no la intención: **0x85e (Astaroth) y 0x8d4 (Nosfentor) SÍ recargan `[bp+4]`** para su
propio chequeo de tipo (0x0865, 0x0902); sólo 0x10f2 usa el contador. Consecuencia:
- si el slot #4 del pueblo es persona → el gate de tipo pasa para TODOS los slots;
- si no → falla para TODOS (nadie elegible).

**Efecto observable (contraste 0x85e/0x8d4):**
- **Astaroth (0x85e, SIN re-chequeo interno)**: posee lo que apruebe 0x10f2 → si el slot
  #4 es persona, puede poseer NPCs **no-persona** (daemons, etc.) presentes.
- **Nosfentor (0x8d4, CON re-chequeo interno correcto 0x0905/0x090c)**: se auto-filtra a
  person-tiles reales; PERO si el slot #4 NO es persona, 0x10f2 devuelve 0 para todos →
  **no posee a NADIE** aunque haya person-NPCs elegibles.

**En juego canónico el bug queda DORMIDO**: las 8 ciudades de la virtud tienen todas el
slot #4 = persona (types 0x50-0x70) y sus NPCs cargados son todos person-tiles → el gate
de tipo pasa y el conjunto poseído coincide con el "per-slot ingenuo". El bug sólo diverge
con slot #4 no-persona o NPCs no-persona presentes (datos no-canónicos / SL fuera de 1..8).

**RNG (CRÍTICO):** `apply_effect` (0x1156) llama `town_possess_gate` para **los 32
slots** cuando el SL presente es Astaroth (1) o Nosfentor (2) ⇒ **exactamente 32
`rand(0,1)`** consumidos del stream vivo, UNA vez, al entrar/refrescar el pueblo. El bug
del slot #4 **NO cambia el conteo** (el rand se tira igual, 0x1139 antes del return) —
sólo cambia QUIÉN acaba poseído; la paridad de stream queda intacta. Con Faulinei (0) o
ninguno → **0 rands** (la rama 0x11b1 no entra al bucle). En Stonegate (§4) → **0 rands**.

## 4. Stonegate (g_location 0x1d = 29) — la guarida

TOWN 0x1275: al entrar a Stonegate, `for si=2,1,0: if g_shadowlord_locs[si] < 0x80 →
announce(si)`. Anuncia **los TRES SL vivos** (orden 2→1→0), **sin posesión ni merma**
(no pasa por 0x1156, y g_5958 no se usa aquí). Lore: se sienten los tres a la vez.
(Mismo g_location 0x1d gatea la retirada del Cetro, 0x1253 — F1.10 corona/cetro.)

## 5. Veredicto del aliasing del doom-bit (0x5BCA ↔ Windemere) — pregunta de T5

El OR de destrucción `or word[0x5bca], (0x02|0x04|0x08)` (CAST 0x171d) cae en el campo
`g_npc_dead_bitmap[location 28 = Windemere]` (base 0x5B5A + 28×4 = 0x5BCA). Orden de
bit **MSB-first** (convención del corpus, `bit = 0x80 >> slot`; npc.md:117), luego:
- 0x02 (Faulinei) → slot 6 · 0x04 (Astaroth) → slot 5 · 0x08 (Nosfentor) → slot 4.

**Windemere (npcs.json loc 28) slots 4/5/6 son DAEMONS** (type 144 = tile 400
"Daemon1", aiType [7,7,7], **dialogNumber 0**, posición fija). NO son NPCs con diálogo.

**VEREDICTO: aliasing INERTE observacionalmente, no se porta conducta nueva.**

⚠️ **Corrección de honestidad (fix review):** mi 1er pase afirmó "nadie LEE
0x5B5A..0x5BDA" — **FALSO**. Ese rango de bytes SÍ se toca: TALK.OVL **0x0d42** (escribe
`or [bx+0x5bd6],ax` / `[bx+0x5bd8],dx`) y **0x0d7a** (lee, con `and` + test) manejan un
bitmap por-(location, NPC) — el flujo de **compañero reclutado/hablado** — indexado por
`bx = g_location << 2` sobre base **0x5bd6/0x5bd8**. La máscara de bit por NPC la produce
`0x44f6` a partir del slot del NPC con quien hablas.

La cadena REAL de la inercia (no "nadie lee", sino "no se lee ESE bit por ESA vía"):
1. El bitmap se consulta **por el NPC con quien interactúas** (0x0d7a lee el campo de la
   location y lo enmascara con el bit del NPC concreto) — sólo se "activa" para un NPC
   alcanzable por (T)alk/recluta.
2. Los slots que toca el doom-OR (Windemere 4/5/6) son **daemons `dialogNumber=0`**
   (type 144, tile 400): **intalkeables** → su bit nunca se consulta por esa vía.
3. Además, el doom-OR escribe en la sub-array **npc_dead** (base 0x5B5A → 0x5BCA para
   Windemere), 12 bytes por debajo de la sub-array de recluta (base 0x5BD6); no localicé
   en NPC.OVL/TOWN.OVL una lectura de ese campo de "muerto" que gatee el spawn de Windemere.

⇒ Ningún camino observable convierte el doom-OR en conducta: los slots afectados son
daemons sin diálogo. El clon modela el write como `state.shadowlordDoomBits` aparte
(efecto preservado, no leído) — **fiel**. Se cierra la pregunta de T5 §Aliasing: **NO hay
bug-for-bug de "matar un SL corrompe NPCs conversables de Windemere"**. (Lo que NO afirmo
con certeza total es que el spawn de los 3 daemons NO se suprima al morir el SL —no
localicé el lector de npc_dead[Windemere]—; de ocurrir sería despawn de daemons mudos,
sin impacto en diálogo/recluta y sin regresión respecto al clon.)

## 6. Identidades de kernel/arrays usadas

- `g_npc_rt @ 0x5F5E` (16 B/NPC): +0x00 state · +0x02 x · +0x04 y · +0x06 z ·
  +0x08 type · **+0x0A dialogNumber (= 0x5F68)** · +0x0C link · +0x0E schedIdx (npc.md §0.4).
- `g_npc_sched @ 0x5D5E` (16 B/NPC; +0x0C = 0x5D6A). `g_npc_type_tbl @ 0x659E` (byte/NPC).
- `0xffffb714` = **asignar slot de objeto libre** (scan lineal, sin RNG).
- `0xffff9ec2` = kernel `rand_range`. `0xffff9fc2` = tono PC-speaker (AV/Clase C).
- `0xffffbb02` = ~~inicia ataque de NPC (talk 0xFE) — kernel opaco, Clase C~~ CS 0x7a82
  far-stub → TOWN 0x10da `town_possessed_npc_attack` (coincide con
  `overlay-load-layout.md`; resolución y argumento en `gargolas-hostiles-palacio.md` §8.2).

## 7. Strings byte-exactos (DATA.OVL, fileoff = DS+0x10) — [V]

```
0x27b8 "\nAn air of\n"                 0x27c4 " doth surround thee...\n"
0x279d "falsehood"  0x27a7 "hatred"    0x27ae "cowardice"
0x9176 "Don't hurt me!\nPlease go away!"   (Nosfentor 0xFD talk)
0x278a "\"Begone,\nvermin!\"\n"            (Astaroth 0xFE npc_engine attack)
0x94dc "\nSomething was stolen!\n"         (Faulinei talk-end theft)
```

## 8. Resumen de RNG del subsistema

| Evento | Condición | Rands |
|---|---|---|
| Marchitación `0x212` (desde 0x2ae) | SL en el pueblo (CUALQUIERA) | **N × rand(0,7)** + 2 `srand` (§8, nota #186) — en el port sale de un generador PROPIO sembrado con `g_day`, no del stream vivo (#195) |
| Detección + spawn físico (0x2ae), resto | SL en el pueblo | 0 (slot libre = scan) |
| Anuncio (0x11b8) | SL presente / Stonegate | 0 |
| Posesión (0x1156 → 0x10f2 ×32) | Astaroth **o** Nosfentor presente | **32× rand(0,1)** |
| Faulinei presente | — | 0 (no posee) |
| Stonegate | — | 0 (sólo anuncia) |

> ⚠ **CORREGIDO por #186** (`rng-186-acta.md §3`). Esta tabla decía «Detección + spawn
> físico (0x2ae) → **0** rands» y remataba con «el único consumo es la posesión: 32 rands
> del stream vivo». Las dos cosas son falsas:
>
> 1. `0x2ae` llama en 0x02E7 a **`TOWN 0x0212`**, que NO es «redibujo/aux»: es la
>    **marchitación de la vegetación del pueblo** — `srand(g_day)` (0x022A, determinista),
>    barrido de los 1024 tiles del mapa `DS 0x6608` convirtiendo `Tree 0x2E → DeadTree 0x2B`
>    y `WheatInField 0x2D → PlowedField 0x2C` con probabilidad **7/8** (`rand(0,7) != 0`,
>    **1 tirada por tile elegible**), y cierra con `srand(rng_time_hash())` (0x02A1/0x02A5).
>    N medido por ciudad (piso 0): Moonglow **0** · Britain 22 · Jhelom 3 · Yew **0** ·
>    Minoc 4 · Trinsic 3 · Skara Brae 29 · New Magincia **47**. Moonglow y Yew son el caso
>    DEGENERADO: 0 tiradas y aun así 2 re-siembras.
> 2. Los **32 rand(0,1) de posesión** (0x12A4) se tiran DESPUÉS de esa re-siembra
>    (0x1239 `call 0x2ae` precede a 0x12A4) ⇒ **no salen de «el stream vivo»** en ningún
>    sentido reproducible: la semilla la acaba de poner `int 21h AH=2Ch`.
>
> ⇒ **La marchitación era una MECÁNICA AUSENTE del port** (`git grep DeadTree|PlowedField`
> en `game/src` → sólo el catálogo `TileData.json`, cero escritores). Tarjeta T2 del acta.
>
> ✅ **PORTADA en #195** — `game/src/core/world/shadowlord-wither.ts` (motor puro) +
> `game.ts:witherTown` (cableado, con `shadowlordHereIndex >= 0` como gate y la capa
> VOLÁTIL como destino). La mitad determinista (`srand(g_day)` + barrido) reproduce el
> conjunto EXACTO de tiles muertos; la cola `srand(reloj)` se declara en el registro único
> `rng.md §Techos de paridad`. ⚠ Y la fórmula de `tile_addr` que citaba `rng-186-acta.md`
> estaba TRANSPUESTA: el barrido es `for y: for x:`, no al revés — ver
> `shadowlord-urbano-acta.md §1.2` y `rng-186-acta.md §12.1`.

El consumo de la posesión son 32 rands al entrar a un pueblo con Astaroth/Nosfentor —
aguas abajo de la re-siembra de 0x0212. Paridad: modelo Python
`shadowlord_urban_parity.py` + run del clon.
