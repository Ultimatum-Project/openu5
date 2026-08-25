# demo-scene-data.md — Stage 3: LOS DATOS del demo del attract (registro + opcodes + secuencia)

Cierra el residuo Clase-C de `intro-demo-scene.md`: el MECANISMO estaba citado
(0xfb1a → FONT.OVL `font_scene_init` 0x04a4), faltaban **los datos**. Aquí quedan
derivados byte-a-byte y CONFIRMADOS: el fichero, el offset, el formato del script, la
tabla de 16 opcodes, las tablas de dirección y la secuencia completa de las 4 escenas.

Citas sobre `re/disasm/FONT.OVL.asm` y `re/disasm/ULTIMA.EXE.asm` + los ficheros
`original/u5/ultima5/{MISCMAPS.DAT,DATA.OVL}`. Todo REPRODUCIBLE (apéndice).

---

## 1. El REGISTRO del mapa — RESUELTO

`kernel_load_dat_record` (kernel runtime 0x256e) NO es un loader de "registros": es
**open + LSEEK + READ** (disasm 0x7234, el cuerpo real):

```
7234: open(fname, mode=2)            ; int21 AH=3D
7254: if param0!=0: LSEEK(param0)    ; int21 AH=42, desde el inicio (offset = param0)
7265: READ(param1 bytes) -> dest     ; int21 AH=3F
7278: close
```

Firma (cdecl, orden de args en pila): `load(param0=seek, param1=len, dest, fname)`.

`font_scene_init` para el DEMO (`g_location=0x40`) llama (FONT 0x04f7):
```
push 0xa044   ; fname → DGROUP 0xa044 = DATA.OVL fo 0xa054 = "MISCMAPS.DAT"  (CONFIRMADO)
push 0xb21e   ; dest  = buffer de escena
push 0x7d0    ; len   = 2000
push 0x2c0    ; seek  = 704
```

⇒ **El demo hace `LSEEK(704)` en `MISCMAPS.DAT` y lee 2000 bytes** (el fichero mide
1871, así que lee los 1167 disponibles) al buffer `0xb21e`. **Este es el hallazgo que
faltaba:** las pasadas previas (#19/#22) parsearon MISCMAPS.DAT desde el offset 0 y por
eso "no cuadraba". Los datos del demo empiezan en el **byte 704**.

### Layout del buffer 0xb21e (= MISCMAPS.DAT[704:])
| buffer off | MISCMAPS off | contenido |
|---|---|---|
| 0x000–0x1ff | 704–1215 | **4 tile-maps** de 128 B (escenas 0..3), `load_scene` los lee en `scene*128` |
| 0x200–0x28e | 1216–1870 | **SCRIPT** (bytecode del intérprete 0x04a4), PC inicial `[bp-0xc]=0x200` |

El script **termina EXACTO en el último byte del fichero**: `RESTART` (opcode 9) está en
buffer 0x48e = MISCMAPS.DAT[1870] = EOF. Confirmación fuerte de que el formato es correcto
y el fichero contiene un solo script cerrado con bucle infinito.

---

## 2. La TABLA DE OPCODES (16) — cracked

Dispatch en FONT 0x0974: `if opcode>15 skip; jmp word cs:[opcode*2 - 0x14d6]`. La tabla
(base −0x14d6 = 0xeb2a; FONT base 0xe1e0 ⇒ **FONT fileoff 0x94a**, 16 words) resuelve a:

| op | handler | nombre | operandos | efecto |
|---:|---|---|---|---|
| 0 | 0x530 | **PLACE** | slot,tile,col,row | crea/coloca actor en tabla `0x5c5a` (stride 8: +0/+1=tile, +2=col, +3=row) |
| 1 | 0x578 | **ERASE** | slot | borra actor y restaura el fondo (`0x6708`→`0x6608`) en su celda |
| 2 | 0x5b8 | **MOVE** | slot,dir | mueve 1 celda SIN tick (restaura fondo + suma delta) |
| 3 | 0x60c | **TICK** | n | `scene_tick(n)` — anima n "frames" (cortina/moongate) + poll de tecla |
| 4 | 0x61c | **MGRISE** | col,row | **moongate SUBE**: 15 frames (`0x2f32`), planta tile `0xdc`, `scene_tick(2)`=TRUENO |
| 5 | 0x694 | **MGFALL** | — | **moongate BAJA** (usa el col,row del último MGRISE), deja tile 5, `scene_tick(2)`=trueno |
| 6 | 0x6e0 | **SCENE** | idx | `load_scene(idx)` — carga el tile-map de la escena idx y su rótulo |
| 7 | 0x6f4 | **ANIM7** | slot | flashea el actor a tile `0x16` y anima (`0x2e88`) — destello |
| 8 | 0x74a | **ANIM8** | slot | como ANIM7 pero desde su celda de fondo — destello de desaparición |
| 9 | 0x7a0 | **RESTART** | — | `PC=0x1ff` ⇒ reinicia el script en 0x200 (**bucle del attract**) |
| 10 | 0x7a8 | **SETTILE** | tile,col,row | escribe tile en fondo+display (mobiliario/parches de suelo) |
| 11 | 0x7e4 | **SUMMON** | (skip),slot | efecto de invocación: 5 frames de `region` (`0x2930`) + sonido (`0x405c` f≈4000) + `scene_tick(3)` |
| 12 | 0x898 | **CLEAR** | — | limpia toda la tabla de actores `0x5c5a..0x5d60` |
| 13 | 0x8c8 | **WALK** | slot,dir | mueve 1 celda **+ `scene_tick(7)`** (paso VISIBLE animado) |
| 14 | 0x926 | **LOOP** | n | inicia bucle: contador=n, guarda PC de retorno |
| 15 | 0x93c | **NEXT** | — | fin de bucle: decrementa; si ≠0 salta al cuerpo (bucle de 1 solo nivel) |

`scene_tick(0x02fc)` termina el playback si detecta tecla (retorna ≠0) → el intérprete
sale por 0x992; INTRO redibuja el menú (`jmp 0xcd0`). Sin tecla, el script llega a
`RESTART` y **cicla para siempre** = el attract.

### Los ACTORES se dibujan del BANCO DE MÓVILES (tile byte + 0x100)

El blit de celda `0x02a2` (FONT.OVL) distingue MAPA vs ACTOR por celda:
```
02b3: al=[bx+si+0x6608]        ; tile de la capa MAPA
02ba: if al!=0: bl=al; al=[bx-0x4ee2]  ; MAPA → tabla de traducción 0xb11e[tile] (≈identidad para terreno)
02ce: else: al=[bx+si+0x6688]  ; tile de la capa ACTOR (0x6688)
02df:   if al==0x16: skip       ; el tile de FLASH 0x16 NO se dibuja (parpadeo del actor)
02e3:   sub ah,ah; add ah,1      ; **ax = tile_actor | 0x0100** ← al banco de móviles
02f1:   call 0x2f00 (blit sprite)
```
⇒ **el byte de actor del guion se blitea como `byte + 0x100`**: `0x4c`→`0x14c` (Avatar con
escudo), `0x50`→`0x150` (Avatar del estudio), `0xfc`→`0x1fc` (**Shadowlord azul**),
`0x31/0x32`→`0x131/0x132` (personas sentadas), `0x1a/0x1e`→`0x11a/0x11e` (personas en cama),
`0x0b`→`0x10b` (caballo). Sin este +0x100 los actores salen como TILES DE TERRENO
(0x4c=rocas, 0x50=muro, 0xfc=amarillo) — bug encontrado al depurar el render. Los tiles de
MAPA/mobiliario/moongate (capa 0x6608/0x6708, incluido `0xdc`) van directos (0-255). El port
lo aplica en `demo-scene.ts` `composite()`.

### Tablas de dirección (usadas por MOVE/WALK)
`dcol` = DS 0x24d6 (DATA.OVL fo 0x24e6), `drow` = DS 0x24de (fo 0x24ee), stride 2 (dir<<1):

| dir | dcol | drow | sentido |
|---:|---:|---:|---|
| 0 | 0 | −1 | **N** (arriba) |
| 1 | +1 | 0 | **E** (derecha) |
| 2 | 0 | +1 | **S** (abajo) |
| 3 | −1 | 0 | **W** (izquierda) |

(Orden canónico U5 N/E/S/W.)

---

## 3. Las 4 ESCENAS (tile-maps) — decodificadas

`load_scene(idx)` copia una banda de **4 filas × 19 columnas** desde `buffer[idx*128 +
row*32 + col]` al grid de pantalla (`0x6608` display / `0x6708` fondo). Los 4 mapas
(MISCMAPS.DAT desde 704) salen limpios y coherentes:

- **Escena 0 = EL ESTUDIO DEL AVATAR** (el cuarto del witness, AHORA exacto): borde
  `0x4f` StoneBrickWall, suelo `0x44`, **espejo `0x9d`**, **cama `0xab/0xac`**, **planta
  `0x5b`**, arco/puerta `0xb8`, cómoda/estanterías (`0x5c/0x5d/0xad/0xae/0x93/0xaf`),
  `0x4b`. ⇒ el calco actual (`summoning-room.ts`) "no es igual" porque es aproximado;
  ESTE es el mapa byte-exacto que lo sustituye.
- **Escena 1 = EXTERIOR / campo** (`0x05` hierba, `0x06/0x08` sendero/arbustos, `0x21/0x24`
  camino, `0x2e` árbol, `0x4c` marca) — donde SUBE el moongate.
- **Escena 2 = EXTERIOR con agua/montaña** (`0x09` agua, `0x61-0x69` costa/montaña, `0x1d`).
- **Escena 3 = SALA de roca (dwelling tipo Iolo)**: muros `0x4d` LargeRockWall, suelo
  `0x44`, cocina `0xbf`, mesa `0x91-0x96`, jarra `0xa9`, cama `0xab/ac`, `0x92/0xa1/0xfa/0xb1`.
  (Resuelve el viejo dilema "estudio vs choza de Iolo" de `brief-intro-demo-kernel §C`:
  **están LAS DOS**, en escenas distintas del mismo demo.)

Los mapas crudos están en el apéndice.

---

## 4. La SECUENCIA COMPLETA (lo que el usuario recordaba)

NO es "un avatar moviéndose sin ton ni son": es un cine-guion coreografiado de **4
escenas**, actores por slot, pasos direccionales, moongates con trueno y un efecto de
invocación, en bucle. Resumen por escena (disasm íntegro en el apéndice / script_annot):

- **Escena 0 (estudio):** destello inicial (slot9 tile0x16 ANIM7/ANIM8), aparece el
  AVATAR (slot0, tile `0x50`) y **camina al este** (LOOP×5 + WALKs); frente al **espejo**
  hace la animación `SETTILE 0x9e→0x9d` (0x9e/0x9d = espejo apagado/encendido); sigue
  hasta la puerta (`SETTILE 0xb8`), cambia de sprite (`0x4c`) y vuelve. Destellos
  puntuales (slots 6/7).
- **Escena 1 (exterior):** el avatar (tile `0x4c`) camina; **MGRISE en (13,1)** (moongate
  sube + trueno), el avatar entra (WALK+ERASE), **MGFALL** (baja + trueno).
- **Escena 2 (exterior agua):** un actor (slot1) recorre el mapa; **MGRISE en (9,1)**,
  aparece el avatar (slot0 `0x4c`), varios WALK, **MGFALL**; luego **3 actores** (slots
  3/4/5, tile `0xfc`) aparecen con ANIM7 y convergen → **SUMMON (slot3)** = el efecto de
  invocación (5 frames + sonido) → aparece slot0x0b (tile `0x1e`). Actores desaparecen con
  ANIM8. Es la escena de "The Summoning" propiamente dicha.
- **Escena 3 (sala de roca):** actores (slots 2/0/1/0x0c/0x0d, tiles `0x50/0x4c/0x44/0x31/
  0x32`) entran, caminan y salen coreografiados; termina y **RESTART** (bucle).

Los sprites de figura (`0x50`, `0x4c`) y todo el mobiliario se renderizan por índice
directamente del atlas del port (que ya tiene el tileset completo del juego).

### SFX que dicta el script (para el perfil fiel)
- **Trueno** en cada MGRISE y MGFALL (`scene_tick(2)` → `noise_burst`, `sfx-catalog §4.10`).
- **Chime del moongate** en `scene_tick` modo-3 (frames 0 y 4).
- **Sonido de invocación** en SUMMON (`0x405c`, f≈4000). Pasos MUDOS.
Validar contra la captura-con-audio del usuario; no fabricar cadencias.

---

## 5. Implementación (Stage 3) — plan

Módulo nuevo `game/src/skin/fiel/demo-scene.ts` que **sustituye** `summoning-room.ts` +
`attract-figures.ts` en el hueco del menú (swap ya preparado, `intro-demo-scene.md §F`):

1. **Datos** (build-time, del extractor): extraer de MISCMAPS.DAT[704:] los 4 mapas
   (4×19) y el script (655 B) a un JSON (`demo-scene.json`) — NADA de bytes de EA en
   ficheros tracked salvo el JSON derivado (igual criterio que el resto de assets).
2. **Intérprete** de los 16 opcodes (tabla §2) + `scene_tick` (cortina de revelado +
   moongate 8-frames + trueno) + tablas de dirección §2. Determinista por diseño.
3. **Render** sobre el grid 4×19 con el atlas de tiles existente; moongate = tile `0xdc`
   animado; SUMMON = efecto + SFX.
4. **Tests:** (a) parser de mapas+script contra bytes reales (golden), (b) determinismo
   del playback (misma secuencia de celdas/tiles), (c) el script decodifica los 16 opcodes
   sin caer en `db` y termina en RESTART @ EOF.

## 6. Convergencia con #20 (endgame)

Es LITERALMENTE el mismo motor: `g_location=0x42` (endgame) corre el MISMO intérprete
0x04a4 con los MISMOS opcodes; sólo cambia el registro cargado (otro `seek`/`fname`) y que
no hace el save/restore de pantalla ni el bucle de attract. El intérprete + `scene_tick` +
tablas de dirección de esta nota son **reutilizables tal cual** por #20; sólo hay que
derivar el/los registros del endgame ("The Summoning/Journey/Arrival/Welcoming", cluster
DATA.OVL 0xa010) con la misma técnica (seek+len de sus loads).

---

## 7. CAPA DE VIDA (efectos + tiles animados) — diagnóstico para el pulido

Sobre el playback base (mapas+actores+moongate+trueno) faltan 2 capas que el usuario
notó ("faltan chimenea/catarata/reloj/estufa/antorchas animados, dissolve de los
Shadowlords, flecha…"). Diagnóstico byte-derivado:

- **Espejo "baile" — YA reproducido por SETTILE.** La celda del espejo (9,1) alterna
  **`0x9e` = espejo CON el reflejo del Avatar (MirrorAvatar)** ↔ **`0x9d` = espejo vacío**
  dos veces (guion 0x22b/0x234 y 0x28a/0x290) según el Avatar pasa. Es el "se ve en el
  espejo cambiar". El intérprete lo hace via el opcode SETTILE — sin trabajo extra.

- **Tiles animados (CAPA 1) — REGLA: cada familia de tiles tiene SU mecanismo (TRES
  distintos, no uno).** No basta con un solo "reloj de animación"; el port los tiene
  separados y el render del demo debe aplicar LOS TRES a los tiles de MAPA (t<0x100; los
  sprites de actor 0x1xx NO):
  1. **Reloj de FRAMES `0x44b8`** (muta `DS:0x4ee2`; `tile-anim-census.md` / `render/
     tileanim.ts animatedFrame`): waterfall `0xd4-d7`, fountain `0xd8-db`, reloj `0xfa`.
  2. **Ruido de LLAMA `fn32` @0x23ba** (`render/firenoise.ts`): el FUEGO no cicla frames,
     REGENERA su bitmap con ruido (`base ^ ruido&máscara`): chimenea/brasero `0xbc`,
     antorchas `0xb0-b3`, estufa `0xbc-bf`, BlueFlame `0xde` (FIRE_MASKS) — ~55 ms/18 Hz.
  3. **AGUA `fn32` @0x1fe6-0x23b7** (`render/waterfn32.ts`): SCROLL vertical del agua base
     (`0x01-03/0x8f`) + COMPOSITE del agua scrolleada en el canal de ríos/costa/esquinas
     (`0x60-6f/0x34-37/0xe4-e7`) — la cascada/río de The Arrival (`0x61-0x69`).
  ⚠ Lección (2 regresiones): al integrar "tiles animados" es fácil aplicar sólo (1) y
  olvidar (2)/(3) — el fuego y luego el agua salieron estáticos por eso. Regla: espejar
  las TRES capas de `skin.ts` (tick a 55ms) en el render del demo. (El agua `0x09` no está
  en ninguna → estática en juego Y demo = fiel.)

- **Moongate `0xdc` — VEREDICTO (derivado, cita ASM):** NO lo anima el reloj maestro
  `0x44b8` (el bucle de la fuente `44dc-44f4` recorre `si=0xd8..0xdb`, `44f0: cmp si,0xdc;
  jl` para en 0xdb — NUNCA toca 0xdc) ni el fuego (`0xdc` = MOONGATE, no hoguera; censo
  §4 corrige el mislabel: la llama azul es `0xde`). Su animación en la VISTA DE JUEGO es
  un carril propio (`0x1112` blit parcial + contador `[0x5887]`, port `fiel/moongate.ts`)
  = la APERTURA/cierre, no un ciclo del tile en reposo. En el DEMO el moongate lo maneja
  el SCENE-ENGINE: op4 MGRISE lo ABRE creciendo (0x2f32, 15 pasos), op5 MGFALL lo cierra,
  y en reposo `scene_tick` modo-3 sólo TAÑE el chime — NO cicla el tile. ⇒ **el moongate
  EN REPOSO estático es FIEL**; lo animado es la apertura/cierre (implementado, fx 'moongate'
  grow 0..1). NO hay que extender el censo de tileanim del port (0xdc no está en 0x44b8).

- **Dissolve aparición/desaparición (CAPA 2).** `ANIM7`(op7 0x6f4)=APARECER, `ANIM8`(op8
  0x74a)=DESAPARECER: ambos llaman al dissolve `0x2e88`, op7 con el **sprite propio del
  actor** (`origtile|0x100`), op8 con el **tile de FONDO** (`[col+row<<5+0x6708]`). Los 3
  Shadowlords aparecen (ANIM7 slots 3/4/5 @0x343/34c/355) y se van (ANIM8 slots 5/4/3
  @0x38d/393/399); el círculo de invocación (slot9) igual (ANIM7/8 @0x20f/0x213). ⇒ es un
  dissolve pixelado, no un pop. (El cuerpo exacto de `0x2e88` = kernel; nº de pasos por
  derivar al implementar.)

- **Beam/"flecha" del SUMMON (CAPA 2).** `SUMMON`(op11 0x7e4) NO es ANIM: dibuja un
  BEAM/proyectil de **5 pasos** — bucle 5× con `scene_tick(1)` + 2 llamadas a la región
  `0x2930` por paso, con `di+=9`(x) y `si+=3`(y) → una cuña/rayo que crece desde ~(128,152)
  hacia (164,164) en coords de pantalla — más el sonido `0x405c` (noise_burst 1,1200,4000)
  y `scene_tick(3)` modo-moongate. Es el "disparo" que el usuario vio en The Arrival.

Los 3 fixes son RENDER-level (renderDemoScene). Reutilizables por #20 (endgame = mismo
motor de efectos).

**ESTADO (implementado, pack de render 3 lotes):** espejo ✅ (ya salía por SETTILE);
tiles animados ✅ (`animatedFrame` sobre tiles de mapa a 55ms); dissolve ANIM7/8 ✅
(canal `fx` + umbral Bayer 16×16); beam del SUMMON ✅ (fx `beam`, segmento diagonal de
5 pasos). Verificado headless en `original/av-referencia/video-demo/port-frames/`
(anim-waterfall-4fases / anim-dissolve-shadowlord / anim-summon-beam / anim-espejo-baile).
Fleco fino declarado: el ancla exacta del beam y la geometría `0x2930` (kernel) — refinable.

## Apéndice — reproducción
```bash
# loader = open+lseek+read
sed -n '/^7234:/,/^7293:/p' re/disasm/ULTIMA.EXE.asm

# tabla de 16 opcodes (FONT fileoff 0x94a, base 0xe1e0)
python3 -c "d=open('original/u5/ultima5/FONT.OVL','rb').read()
[print('op%2d FONT 0x%04x'%(i,(d[0x94a+2*i]|d[0x94a+2*i+1]<<8)-0xe1e0&0xffff)) for i in range(16)]"

# el script y los 4 mapas viven en MISCMAPS.DAT[704:]; script en [1216:1871]
# (decoder completo en scratchpad script_annot.txt / o re-derivar con la tabla §2)
python3 -c "d=open('original/u5/ultima5/DATA.OVL','rb').read(); print(d[0xa054:0xa060])"  # MISCMAPS.DAT
```

---

## Apéndice B — desensamblado íntegro del script (cita permanente)

Los 241 pasos del ciclo, decodificados de MISCMAPS.DAT[1216:] con la tabla §2
(offset = buffer 0xb21e; dir = N/E/S/W). Regenerable con el script del Apéndice A.

```
0200 SCENE    #0
0202 CLEAR    
0203 PLACE    slot10 tile=0x1a (3,3)
0208 TICK     80 frames
020a PLACE    slot9 tile=0x16 (4,2)
020f ANIM7    slot9
0211 TICK     30 frames
0213 ANIM8    slot9
0215 ERASE    slot9
0217 TICK     8 frames
0219 ERASE    slot10
021b PLACE    slot0 tile=0x50 (3,2)
0220 TICK     30 frames
0222 LOOP     x5
0224 WALK     slot0 E
0227 NEXT     
0228 MOVE     slot0 E
022b SETTILE  tile=0x9e (9,1)
022f TICK     6 frames
0231 MOVE     slot0 E
0234 SETTILE  tile=0x9d (9,1)
0238 TICK     6 frames
023a WALK     slot0 E
023d WALK     slot0 E
0240 TICK     10 frames
0242 SETTILE  tile=0x44 (13,2)
0246 TICK     10 frames
0248 WALK     slot0 E
024b WALK     slot0 E
024e WALK     slot0 E
0251 TICK     15 frames
0253 PLACE    slot6 tile=0x05 (15,1)
0258 TICK     15 frames
025a ERASE    slot6
025c TICK     15 frames
025e PLACE    slot7 tile=0x06 (15,1)
0263 TICK     15 frames
0265 ERASE    slot7
0267 ERASE    slot0
0269 PLACE    slot0 tile=0x4c (15,2)
026e TICK     30 frames
0270 WALK     slot0 W
0273 WALK     slot0 W
0276 WALK     slot0 W
0279 TICK     10 frames
027b SETTILE  tile=0xb8 (13,2)
027f TICK     10 frames
0281 WALK     slot0 W
0284 WALK     slot0 W
0287 MOVE     slot0 W
028a SETTILE  tile=0x9e (9,1)
028e TICK     30 frames
0290 SETTILE  tile=0x9d (9,1)
0294 WALK     slot0 W
0297 WALK     slot0 W
029a WALK     slot0 N
029d TICK     15 frames
029f SETTILE  tile=0x44 (7,0)
02a3 TICK     15 frames
02a5 WALK     slot0 N
02a8 ERASE    slot0
02aa TICK     5 frames
02ac SETTILE  tile=0xb8 (7,0)
02b0 TICK     40 frames
02b2 SCENE    #1
02b4 CLEAR    
02b5 TICK     50 frames
02b7 PLACE    slot0 tile=0x4c (0,0)
02bc TICK     15 frames
02be WALK     slot0 E
02c1 WALK     slot0 S
02c4 LOOP     x7
02c6 WALK     slot0 E
02c9 NEXT     
02ca WALK     slot0 S
02cd WALK     slot0 E
02d0 WALK     slot0 E
02d3 TICK     35 frames
02d5 WALK     slot0 E
02d8 WALK     slot0 E
02db TICK     3 frames
02dd WALK     slot0 E
02e0 TICK     60 frames
02e2 MGRISE   at (13,1)
02e5 TICK     20 frames
02e7 WALK     slot0 N
02ea ERASE    slot0
02ec TICK     25 frames
02ee MGFALL   
02ef TICK     40 frames
02f1 SCENE    #2
02f3 CLEAR    
02f4 TICK     70 frames
02f6 PLACE    slot1 tile=0x44 (4,0)
02fb TICK     15 frames
02fd WALK     slot1 W
0300 WALK     slot1 S
0303 WALK     slot1 S
0306 LOOP     x5
0308 WALK     slot1 E
030b NEXT     
030c WALK     slot1 S
030f WALK     slot1 E
0312 WALK     slot1 E
0315 WALK     slot1 E
0318 TICK     70 frames
031a MGRISE   at (9,1)
031d TICK     25 frames
031f PLACE    slot0 tile=0x4c (9,1)
0324 TICK     6 frames
0326 WALK     slot0 S
0329 MGFALL   
032a WALK     slot1 N
032d WALK     slot1 W
0330 TICK     50 frames
0332 WALK     slot0 S
0335 WALK     slot0 E
0338 MOVE     slot0 E
033b WALK     slot1 E
033e PLACE    slot3 tile=0xfc (6,1)
0343 ANIM7    slot3
0345 TICK     6 frames
0347 PLACE    slot4 tile=0xfc (5,2)
034c ANIM7    slot4
034e TICK     6 frames
0350 PLACE    slot5 tile=0xfc (7,0)
0355 ANIM7    slot5
0357 TICK     15 frames
0359 WALK     slot3 E
035c TICK     6 frames
035e WALK     slot4 E
0361 TICK     6 frames
0363 WALK     slot5 E
0366 TICK     6 frames
0368 WALK     slot1 W
036b TICK     30 frames
036d SUMMON   slot1
0370 ERASE    slot1
0372 PLACE    slot11 tile=0x1e (10,2)
0377 TICK     20 frames
0379 WALK     slot0 W
037c WALK     slot0 W
037f WALK     slot0 N
0382 TICK     15 frames
0384 WALK     slot5 W
0387 WALK     slot4 W
038a WALK     slot3 W
038d ANIM8    slot5
038f ERASE    slot5
0391 TICK     1 frames
0393 ANIM8    slot4
0395 ERASE    slot4
0397 TICK     1 frames
0399 ANIM8    slot3
039b ERASE    slot3
039d TICK     6 frames
039f WALK     slot0 S
03a2 WALK     slot0 E
03a5 TICK     35 frames
03a7 ERASE    slot11
03a9 PLACE    slot1 tile=0x44 (10,2)
03ae TICK     35 frames
03b0 WALK     slot0 E
03b3 WALK     slot0 N
03b6 TICK     12 frames
03b8 LOOP     x6
03ba MOVE     slot0 E
03bd WALK     slot1 E
03c0 NEXT     
03c1 MOVE     slot0 N
03c4 WALK     slot1 E
03c7 MOVE     slot0 E
03ca WALK     slot1 N
03cd MOVE     slot0 N
03d0 WALK     slot1 E
03d3 ERASE    slot0
03d5 TICK     8 frames
03d7 WALK     slot1 N
03da ERASE    slot1
03dc TICK     50 frames
03de SCENE    #3
03e0 CLEAR    
03e1 PLACE    slot2 tile=0x50 (2,2)
03e6 TICK     70 frames
03e8 WALK     slot2 E
03eb WALK     slot2 S
03ee WALK     slot2 E
03f1 ERASE    slot2
03f3 TICK     40 frames
03f5 PLACE    slot2 tile=0x50 (8,3)
03fa TICK     18 frames
03fc WALK     slot2 N
03ff WALK     slot2 N
0402 WALK     slot2 E
0405 TICK     25 frames
0407 WALK     slot2 E
040a WALK     slot2 N
040d TICK     30 frames
040f WALK     slot2 S
0412 WALK     slot2 E
0415 ERASE    slot2
0417 PLACE    slot12 tile=0x32 (11,1)
041c TICK     40 frames
041e PLACE    slot0 tile=0x4c (8,3)
0423 TICK     20 frames
0425 MOVE     slot0 N
0428 PLACE    slot1 tile=0x44 (8,3)
042d TICK     10 frames
042f ERASE    slot12
0431 PLACE    slot2 tile=0x50 (11,1)
0436 TICK     10 frames
0438 WALK     slot2 W
043b WALK     slot2 W
043e WALK     slot2 W
0441 TICK     15 frames
0443 WALK     slot1 W
0446 WALK     slot1 N
0449 MOVE     slot1 W
044c WALK     slot0 W
044f MOVE     slot1 N
0452 WALK     slot0 W
0455 ERASE    slot1
0457 PLACE    slot10 tile=0x1a (6,1)
045c TICK     10 frames
045e WALK     slot2 S
0461 WALK     slot2 W
0464 TICK     50 frames
0466 MOVE     slot2 E
0469 WALK     slot0 E
046c MOVE     slot2 N
046f WALK     slot0 E
0472 MOVE     slot2 E
0475 WALK     slot0 E
0478 WALK     slot2 E
047b ERASE    slot0
047d PLACE    slot13 tile=0x31 (9,2)
0482 WALK     slot2 E
0485 ERASE    slot2
0487 PLACE    slot12 tile=0x32 (11,1)
048c TICK     140 frames
048e RESTART  
```
