# Camp (H)ole up & camp — brief de KERNEL con citas (anti-descubrir-bugs-de-a-poco)

Revisión ASM instrucción-a-instrucción de TODO lo relativo a la escena de acampada,
para dejar de parchear por reportes sueltos. Supersede la sección de FORMACIÓN de
`camp-scene.md` (que leía la tabla estática DATA.OVL 0x1734 — resultó ser el default
de un buffer sobreescrito en runtime). Cross-ref: `camp-ambush-spec.md`,
`oracle-camp-event.md`.

## MÉTODO (advertencia para toda la ola)

**Cita = `re/disasm/ULTIMA.EXE.asm` (completo, ~560 KB, incluye OUTSUBS/CMDS inlined) +
offset. Los `*.segments.md` son RESÚMENES y sólo orientan.** Derivar estructura de los
resúmenes ha producido fixes que contradicen el ASM: la formación de acampada se
"corrigió" dos veces (filas 7-9 estáticas → vecinos del fuego) antes de leer el ASM
completo y ver que la tabla se CARGA en runtime. Un testigo (vídeo del usuario) sirve
para saber QUE algo existe; la ESTRUCTURA exacta sale del ASM. Regla anti-fabricación:
sin cita ASM (o testigo A/V explícito) no se implementa estructura.

## 1. Comando camp — `0x3c9a` (kernel)

Prólogo (validación de sitio, horas, watch): `0x3c9a`–`0x3e58`. Rama por localización en
`0x3e5e` (`cmp g_location, 0x20`):
- `g_location > 0x20` (overworld a pie) → `0x3e65`: `g_unk_58a1 = 6`; setup arena y
  `0x3e7c call 0x5f86` (entra en la arena). **Esta es la escena de party.**
- `g_location <= 0x20` (mazmorra/interior) → `0x3edc call 0x6360` (vía de arena de
  terreno; no modelada en el port de escena).

### Selección del vigía — NO hay check de clase (⇒ no hay bardo en este kernel)
`0x3e9e`–`0x3ecb`:
```
3ea9: call 0x1850            ; imprime "Who will stand guard?"
3eac: call 0x2e8e            ; select_party_member → ax = idx elegido
3eaf: mov  [bp-6], ax
3eb9: cmp  [bp-6], -1        ; ESC → cancela
3ebf: mov  bx, [bp-6]
3ec4: shl  bx, 5             ; idx * 0x20 (stride del registro de char)
3ec6: cmp  byte [bx+0x55b3], 'G' (0x47)   ; ← ÚNICO check: ESTADO 'G' (Good)
3ecb: je   0x3e5e            ; válido → sigue. SI NO: NO repite y NO dice «can't guard» —
                             ; cae a 0x3ecd, fuerza [bp-6]=-1 e imprime «None posted!\n\n»
                             ; (DS 0xa386, el MISMO texto que la cancelación por ESC), y
                             ; salta igual a 0x3e5e. Elegir a un miembro que no esté en «G»
                             ; y cancelar son INDISTINGUIBLES en pantalla.
                             ; [ENMENDADO por asm-shoppes-5 tanda 22, leyendo el tramo CS 0x3ec6-0x3ed9:
                             ;  la cadena «can't guard» NO EXISTE en el binario.]
```
El bucle de conteo previo (`0x3e11`) tallaba miembros con estado `'G'`/`'P'`
(Good/Poisoned) — confirma que `[idx+0x55b3]` es el byte de ESTADO, no de clase. **No
hay lectura de clase, ni música, ni reloj congelado en todo `0x3c9a`.**

⚠️ **ADENDA 2026-08-05 — la conclusión que seguía a eso era DEMASIADO ANCHA.** De «no
está en `0x3c9a`» se saltaba a «no tiene base en el binario». El easter egg SÍ está: en
la rutina de SUEÑO que `0x3c9a` llama después — **`CMDS.OVL` offset 0x0000**, prólogo
0x0113-0x012d (`cmp byte [bx],0x42` = clase 'B' · y ser el vigía · y `g_unk_a9ce`≠0 =
sonido ON) + 0x017c-0x018c (escribe el byte **0x5F** en los DOS campos de anim, siembra
el cursor de melodía `[0x6a08]=1` y corre `0x3AE6(52)` = 52 redibujos ANTES de
«Zzzzzz…» ⇒ **reloj congelado, ASM-confirmado**). El sprite es 0x15**F**, no 0x15C, y
**SE ANIMA** (`0x4552`, base 0x5C, sin gate). Derivación: `camp-bard-anim.md`. El hook
`bard` de `campScene.ts` ya NO es sin-cita.

## 2. Formación — se CARGA en runtime, no está horneada

Colocación inicial: `party_anim_build 0x6936`. Lee la celda de cada miembro por índice:
```
6a4f: mov bx, [bp-4]                 ; idx de miembro
6a52: mov al, byte [bx+0x1724]       ; X de formación  (tabla de 8 bytes en 0x1724)
6a59: mov al, byte [bx+0x172c]       ; Y de formación  (tabla de 8 bytes en 0x172c)
6a73: call 0x6506                    ; (X,Y) → celda de arena
```
Pero esas tablas 0x1724/0x172c se RELLENAN en runtime, en `0x60ec`:
```
60f4: push 0xa3f0 / push 0xad14 / push 0x160 / imul [bp+4] / push
6104: call 0x256e                    ; carga registro de 0x160 B de la arena → 0xad14
610f: mov di,0x1724 / mov si,0xad7f / rep movsw (×3)   ; X ← 0xad7f
611c: mov di,0x172c / mov si,0xad85 / rep movsw (×3)   ; Y ← 0xad85
```
`0x256e`→`0x7234` es el cargador de registros de datos. `0xad7f`/`0xad85` viven DENTRO
del registro recién cargado (`0xad14 + 0x6b/0x71`). ⇒ **la tabla de formación = los
`playerStarts` de la arena**. La lectura estática vieja `DATA.OVL fo 0x1734 =
[7,8,8,9,9,9]` era el DEFAULT del buffer DESTINO (`0x1724`), sobreescrito antes de leerse.

### Medición (CAMP.mov, arena CampFire idx 0, fuego en (5,5))
Rejilla alineada a las rocas fijas de la arena (molinete de tiles 76/77). Party de 3:
| miembro | celda medida | = playerStarts["south"][i] |
|---|---|---|
| 0 (durmiente) | (6,6) | south[0] = (6,6) ✓ |
| 1 (durmiente) | (4,4) | south[1] = (4,4) ✓ |
| 2 (guardia)   | (6,4) | south[2] = (6,4) ✓ |

3/3 exacto. El port lee `playerStarts["south"]` de `combatmaps.json` idx 0 (el único
juego de starts que rodea la hoguera central; east/west/north son entradas por borde).

### Muertos y durmientes
- `0x69e1`: `cmp byte [bx+0x55b3], 'D' (0x44)` → si muerto, SALTA el slot (hueco vacío).
- Durmiente (finalize `0x68ae`): `0x68ea: mov byte [bx+0x5c5b], 0x1e` → tile **0x11e**
  del banco alto (DeadBody, figura tumbada). Un único tile para todos, no por clase.

## 3. Ronda del guardia — NO hay rutina `0x6980`

No existe rutina de "re-dibujo horario" en `0x6980` (ese offset sólo aparece como operando
de un far-jump ajeno). Los durmientes NO derivan; sólo el guardia se mueve.

Medido en CAMP.mov (guardia en slot (6,4)=NE): oscila **(6,4)↔(6,5)** — su puesto y el
vecino HORARIO del anillo (hacia el flanco E del fuego), ~1.5–2 s por celda en real-time.
No circula el fuego (pisaría a los durmientes). El port lo modela en `campGuardPatrolCell`
(par=puesto, impar=vecino horario i+1). La cadencia real-time (aquí atada a la hora de
sueño) es Clase C; el par de celdas y el sentido (horario) están medidos.

## 4. Aparición — figura ESTÁTICA en (5,5)

`OUTSUBS.OVL.asm` camp_results `0x0658`, en `0x06b9`: `push 0x174; push 5; push 5; call
0x6dd8` → dibuja la figura de aparición (tile 0x174) UNA vez en (5,5), fija. No se pasea
por los miembros. (Confirma el commit de aparición estática.) Los N pulsos de inversión
de paleta = nº de miembros vivos (curación), cadencia Clase C.

**AMPLIADO (carril aparición): esta sección era INCOMPLETA** — la figura es estática,
pero el bucle por-miembro 0x07fb DESPIERTA a los vivos UNO A UNO (tile de pie por tabla
0x1ade, campanilla 0x0896 + flash XOR 0x08aa + acorde 0x08c1 POR miembro), recalcula MP
por clase (0x079c) y cierra con el discurso de KARMA (0x090e, recs 0-3 o rec5 con
karma≥80) + «vanishes…» + dissolve a la hoguera (0x097e). Derivación completa
instrucción-a-instrucción: `re/notes/camp-apparition-scene.md`.

## 5. Iolo bard — DOS FASES (era witness-derived; **DERIVADO del ASM el 2026-08-05**)

> ⚠️ El «ASM negativo» de esta sección quedó DEROGADO: buscaba `push 0x15c`, y el asm no
> empuja el TILE — escribe el BYTE `0x5f` (el banco 0x100 lo suma el compositor en
> `0x56e1 add ah,1`). Lo MEDIDO en el vídeo sigue valiendo y ahora tiene respaldo
> estático. Cita completa: `camp-bard-anim.md`.

El usuario reportó, y luego entregó testigo con AUDIO (`original/av-referencia/video-camp/
CAMP_IOLO_MUSICA.mov`, 45 s, AAC real), que al acampar con Iolo (bardo) como vigía éste
TOCA una canción ANTES de velar. Analizado frame a frame + audio:

- **FASE 1 (canción)**: audio fuerte 6.5–14 s (~7.5 s, melodía sostenida, no beep). Iolo
  quieto en su puesto (south[1]=(4,4)) con un tile DISTINTO: figura de pie con laúd dorado.
  El SOL de la tira de cielo NO se mueve 8–13 s → **reloj CONGELADO**. Los otros duermen.
- **FASE 2 (vigilia)**: acabada la canción, Iolo pasa a su sprite de clase normal y PASEA;
  el sol se va y las lunas se desplazan (16→24 s) → **reloj CORRIENDO**.
- Etiqueta de la arena en el testigo: "**South Winds**" → confirma por vía independiente el
  entry SOUTH de la formación (§2).

**Búsqueda ASM (negativa, exhaustiva y citada — regla anti-fabricación):**
- `push 0x15c` (tile BardPlaying1) **no aparece en NINGÚN `.asm`**. El id 0x15c sale del
  NOMBRE "BardPlaying1" en `TileData.json` (cita de game-data, no de ASM).
- Ninguna llamada a driver de música gateada por clase Bard alcanzable desde el init de
  camp/arena. Los 3 `cmp 0x42` ('B') del binario son ajenos: `COMBAT.OVL 0x0abe` (tabla de
  salto de comando), kernel `0x31aa` (menú de letras), `0x24ad` (flag de dispositivo).
- camp cmd `0x3c9a` (§1) sólo valida al vigía por estado 'G' (`0x3ec6`); sin clase/música/
  reloj congelado. `0xad7f`/`0xad85` (fuente de la formación) sólo se leen en `0x60ec`;
  ningún routine las computa. ⇒ **el easter egg NO está en este ULTIMA.EXE** (otra versión/
  overlay, o dibujo data-driven no-literal). Con el testigo A/V + el grep negativo citado,
  es WITNESS-DERIVED — no fabricación.

**Canal de audio (CORREGIDO por el usuario)**: el usuario NUNCA oye música de fondo en su
DOSBox (PC estándar) y aun así la canción SUENA → el original la emite por **PC-SPEAKER/SFX**,
NO por el driver de música. Eso explica los greps negativos de `play_song`. La vía fiel es la
primitiva de tono de speaker (misma familia que la aparición: OUTSUBS 0x067b materialize,
0x0686 arpegio-desde-tabla-[0x3a26]; y el instrument-note del clavicémbalo, tabla [0x2746]).
El port toca la canción por el CANAL SFX (`emitSfx("bard-song")`, voz instrument-note), SIN
tocar la música ambiente (nada de crossfade a stones.ogg — el intento previo era erróneo, lo
refutó el usuario). La SECUENCIA de notas es hoy witness-derived (contorno del testigo, Sol
central); **el nivel-2 del binario debe dar la tabla exacta** (ver §6). La comparación DSP vs
stones.ogg salió no concluyente y ya no es relevante: la identidad la zanja la tabla del binario.

## 6. Búsqueda nivel-2 del trigger/tabla de la canción (EN CURSO — orden del usuario)

"Tiene que salir en el binario, sí o sí" (el vídeo se grabó con estos bytes). Estado:
- **Primitiva de tono = thunk de overlay**: `call 0x7f02` (desde OUTSUBS camp_results) es un
  THUNK PLINK86 (`lcall 0x72e:0x2ec` + id de overlay + `ljmp` al destino real) — por eso los
  greps de literales no lo ven. La técnica de resolución de thunks está en intro-demo-scene.md.
- **Tablas de notas ya derivadas**: arpegio [0x3a26] (aparición) e instrument-note [0x2746]
  (clavicémbalo). La canción del bardo será una tabla análoga, más larga.
### Vías estáticas RECORRIDAS (nivel-2, a fondo — CITAS)

1. **Primitiva de tono = thunk PLINK86 `0x7f02`** (`lcall 0x72e:0x2ec` + sel 0x12 + `ljmp
   0:0xeaca`). Resuelta con la técnica de command-dispatch.md §2 + `re/tools/seg2_resolve.py`
   (`dispatch_table.overlay_table()` = fuente de verdad de load_seg).
2. **TODOS los callers de `0x7f02`** (grep global): BLCKTHRN×5, COMBAT×1 (=spell-zap tono
   0x2648), ENDGAME×2, SHOPPES×6 (transacciones), OUTSUBS×4 (=camp_results WAKE). **Ninguno es
   la canción.** Callers de tono del KERNEL (0x22e2/0x2192/0x22c0/0x43ae): sólo 0x6a3c (glide)
   en el flujo camp, evento RNG por-miembro, no la canción.
3. **Thunks de ENTRADA del camp** (kernel 0x3c9a): 0x7c02→sel 0x0a@0xb3c0, 0x7c0e→sel
   0x0a@0xb32e, 0x7c26→sel 0x0a@0xafce, 0x7c7a→sel 0x03@0x8304. Resueltos con near_call_base
   (nivel-2 base 0xA290): 0xb3c0→file 0x1130, 0xb32e→0x109e, 0xafce→0x0d3e (AMBIGUO entre los
   overlays de nivel-2, que comparten load_seg; el `sel` desambigua el fichero). El tono
   0xeaca→file 0x8ea de un overlay de nivel-4 (base 0xE1E0; COMSUBS/ZSTATS/…).
4. **Tile 0x15c**: no es push literal; probablemente banco alto como el durmiente (0x68ae
   guarda 0x1e → 0x11e). Derivación exacta diferida con el trigger.

### RESUELTO por el ORÁCULO + estático (la canción SÍ está en el binario)

El oráculo DOSBox (headless propio, run-dir propio) REPRODUJO la canción con Iolo de vigía y un
BP en las primitivas de speaker del kernel capturó el tono. Cadena completa citada:

- **Primitiva**: kernel **`0x2192` (pcspeaker_tone_sweep)** — NO CAST2/0x7f02 (pista falsa: sus
  callers son combate/tienda/aparición, ninguno la canción overworld). Caller observado `0x42fb`.
- **Reproductor**: kernel **`0x42d2`** (modo 4 del motor de sonido `0x416c–0x433c`): lee la nota
  `al = [bx+0x6a48]` con el contador `[0x6a08]` (cicla 0..0x34 = 53 notas); si `al!=0` →
  `freq = [al*2 + 0x6a34]` → `sweep(freq, 1, 0x7d0, 0x4e20, 0xfff6)`; si `al==0` → SILENCIO
  (`0x42df cmp 0; je` salta el sweep).
- **MELODÍA (53 índices)** = DS:0x6a48 = **DATA.OVL fo 0x6a58** (DS+0x10):
  `1 4 4 0 0 1 5 5 0 0 4 9 6 9 7 4 6 5 1 4 0 0 0 1 5 0 0 0 4 9 6 5 6 4 0 0 0 5 8 8 9 5 6 8 9 5 4 6 5 4 3 2 1`.
- **TABLA DE FREQ** = DS:0x6a34 = **DATA.OVL fo 0x6a44**:
  `0 0x0da9 0x0f56 0x1136 0x123c 0x1478 0x16fa 0x1857 0x19ca 0x1b53` (escala; índice 0 = rest).
- El oráculo capturó `freq=0x123c` (= índice 4) durante el camp de Iolo → cuadra con la tabla.
- **Gate (modo 4)**: el selector de modo del motor (0x416c) recorre actores y elige el modo por
  TILE en vista: fountain (`& 0xfc == 0xd8`, 0x41ef) → modo 3; **`& 0xfc == 0x5c` (0x420b) → modo 4
  = melodía**. Es decir la canción se dispara por DETECCIÓN DE TILE, no por un `cmp` de clase
  inline — plausiblemente el sprite BardPlaying en la arena. El eslabón CLASE 'B' → poner ese
  sprite queda **PENDIENTE** (timebox; los 3 `cmp 0x42` del binario son ajenos; el trigger y el
  CONTENIDO de la canción están citados). No bloquea el cierre: el port lo modela por el hook
  `bard` (clase 'B' → tile 0x15c → fase songPhase) que YA es fiel al comportamiento observado.

**Diagnóstico del arnés** (para futuros oráculos): el drive del picker era flaky por usar
`wait_kbd_poll` síncrono (la tecla se come en un poll transitorio); el **prebuffer type-ahead**
(`oi.set_typeahead`+`prebuffer_keys`, como camp_probe.py) entra fiable (loc 0→FF). Nota de método:
la resolución thunk→fichero exacta la da `dispatch_table.stubs()` + `re/notes/overlay-load-layout.md`
(mi "Δ0x16 en COMBAT" fue un error mío — ov#0x0a resuelve a DNGLOOK, no COMBAT; era la rama de dungeon).

**Port**: `campScene.ts` fase `songPhase`; `main.ts runCampSleep` mete la fase canción ~7.5 s con
reloj congelado ANTES del bucle de horas (PRESENTACIÓN PURA). Audio: `emitSfx("bard-song")` por el
CANAL SFX/SPEAKER, música ambiente INTACTA (sin crossfade). `speaker.ts` `BARD_MELODY`+`BARD_FREQ_TABLE`
= los BYTES reales del binario. Cada nota = `bardNote(idx)` = tono de pitch CONSTANTE `incToHz(freq)`
(el motor 0x2192 es PWM: el fundamental = inc/65536·SR es fijo; el sweep de bx es DUTY, no pitch — ver
`speaker-audit.md`), ~77 ms; los rests y el hueco inter-nota son `pauseMs` (slot ~142 ms, witness-derived).
`CAMP_SONG_MS` = `ceil(cueDurationMs("bard-song"))` ⇒ la fase visual cubre exactamente el audio.

### 7. Confirmación ESTÁTICA independiente del trigger + cruce TileData (carril bard-audio, 2026-07-16)

Revisión del §6 SIN fiarse del oráculo (lectura pura de `ULTIMA.EXE.asm`), como byproduct del fix de
audio del bardo. Confirma toda la cadena y cierra el eslabón del tile con game-data:

- **Motor de sonido `0x416c`**: recorre las celdas visibles (buffers 0xab02 stride 0x20 / 0xac64 stride
  0x10) y elige MODO por el tile en vista. Gates citados: mode1 `&0xfe==0xfa` (reloj, 0x41d0), mode2
  `&0xfc==0xd4` (cascada, 0x41df), mode3 `&0xfc==0xd8` (fuente, 0x41ef), **mode4 `&0xfc==0x5c` (0x4207
  `and al,0xfc; cmp al,0x5c; jne` → di=4) = canción del bardo**. Precondición: byte paralelo 0xab02==0 (0x41fb).
- **Player mode4 `0x42d2`** (confirma §6): `bl=[0x6a08]` (contador 0..0x34), `al=[bx+0x6a48]`=melodía;
  `al==0` → rest (`0x42df cmp; je` salta el sweep); `al!=0` → `push [bx*2+0x6a34]`=freq → `call 0x2192`.
- **Cruce `TileData.json`** (cierra el tile SIN literal fabricado): el gate `&0xfc==0x5c` mapea EXACTO a
  la familia **0x15c–0x15f = BardPlaying1–4** (low byte 0x5c–0x5f). El port ya usa `CAMP_BARD_PLAYING_TILE
  = 0x15c` → ahora BINARIO-justificado, no sólo por el nombre TileData. (Único alias: 0x05c–0x05f =
  Bookcase/CodexAngel, desambiguados por la precondición 0xab02==0 y la capa de actores animados.)

**Veredicto de los 4 puntos del brief nivel-2** (el trigger "tiene que salir en el binario, sí o sí"):
1. Thunks PLINK86 del flujo camp (0x3c9a→…→OUTSUBS): **MOOT** — el trigger NO está en overlay vía thunk,
   está en el KERNEL (0x416c/0x42d2/0x2192). Ninguna call de driver de música interviene (coherente con
   `audio-profile-1988.md`: no hay subsistema de música, todo PC-speaker).
2. Tile calculado/tabla por clase: **RESUELTO** — el sonido es TILE-DRIVEN puro (gate 0x5c), NO hay tabla
   por clase. La clase 'B' sólo decide con qué SPRITE se dibuja el actor (0x15c); dibujado el sprite, el
   gate por tile dispara mode4. (⇒ un bardo de taberna EN VISTA también sonaría en el original.)
3. Barrido overlays+.DRV de callers de driver de música con id variable: **MOOT** — no hay driver de música.
4. Oráculo: ya corrió (§6, capturó freq=0x123c); mi estático lo corrobora por vía independiente.

**Residuo no-bloqueante** (timeboxeado, orden del orquestador de no perseguir): el código NPC/animación que
asigna el sprite 0x15c a un actor de clase 'B' — ortogonal al AUDIO (tile-driven, no class-driven). El port
lo modela por el hook `bard` (clase 'B' → 0x15c → songPhase), fiel al comportamiento observado.
**CERRADO 2026-08-05** — el eslabón es `CMDS.OVL 0x0113` (`cmp byte [bx],0x42`, clase 'B') +
`0x017c` (`mov al,0x5f`), y el sprite correcto es 0x15**F**: ver `camp-bard-anim.md`.

## Resumen de veredictos
- Formación = arena playerStarts["south"], por índice de miembro. **ASM + vídeo 3/3.**
- Bardo dos-fases: witness-derived (visual) + **canción CONFIRMADA en el binario** (oráculo):
  melodía DATA.OVL 0x6a58 + freq 0x6a44 por sweep 0x2192 (motor kernel 0x42d2 modo 4). Cerrado con cita.
- Guardia: oscila puesto↔vecino horario; medido (6,4)↔(6,5).
- Durmiente 0x11e, aparición estática (5,5): **ASM-confirmados.**
- No existe `0x6980`; los durmientes no derivan.
