# Fanfarria del ENDGAME — análisis espectral en frío del testigo 2:34 (carril audio-cadencias)

**Fuente:** `original/av-referencia/endgame/endgame-victoria-box-20260721.mov` (153.9 s,
1284×786 @120 fps VFR, AAC 48 kHz estéreo). **La captura es DIGITAL**: correlación L/R
= 1.0 exacta y `max|L−R| = 0.0` — el audio es la salida del PC-speaker emulado de
DOSBox-X duplicada a estéreo, SIN micrófono, sin voz, sin ruido de sala. (Los dos
intentos espectrales previos — aulddragon `fanfare-pilot/music_1633` y alexdiener
ep25 `F4-ep25-verdict.md` — fracasaron por comentario de voz encima; este testigo no
lo tiene.)

**Método:** STFT (nperseg 1024-4096, hop 128-512) + pista de pico dominante con
refinado parabólico; autocorrelación paso-bajo (LP 280 Hz) para el registro grave;
verificación de estructura armónica por nota (F/2F/3F/5F); careo de mecanismo contra
eventos CONOCIDOS de la misma captura (beeps de página GAP 8, evento del Orb).
Scripts y espectrogramas en scratchpad de sesión (no material EA en el repo).

---

## 1. Línea temporal (careo con el censo GAP 8 de `endgame-derivation.md`)

| evento | censo GAP 8 | medido en el audio |
|---|---|---|
| combate de sombras | 5-24 s | ✓ actividad 4-24 s |
| ping re-tinte VERDE (dur 2,3) | ~27 s | ✓ 26.1-28.9 s (2.8 s activo, duty 32%) |
| beeps de PÁGINA (dur 0x28) | ~110/114/128 s | ✓ 109.5-111.9 / 113.0-115.3 / 128.0-129.9 s |
| **fanfarria del pergamino** | 142-149 s | **139.3-153.6 s** (el pergamino ya está COMPLETO en el frame de 139 s; la música empieza tras el dibujado y dura ~14.3 s, no 7) |

Corrección al censo: la fanfarria dura **~14.3 s** (139.3→153.6), el doble de la
ventana 142-149 anotada del testigo.

## 2. Hallazgo de MECANISMO (clave para leer la transcripción)

En ESTA captura DOSBox-X, las dos familias de primitivas del speaker rinden
espectralmente distinto:

- **Tonos PIT** (`beep`/`set_tone` 0x22e2: el PIT fija el divisor → Hz exactos,
  máquina-independientes) → **líneas estrechas limpias** (sd ≈ 1 Hz).
- **Sweeps bit-bang** (`tone_sweep` 0x2192: PWM por software, pitch dependiente de
  la tasa de bucle) → **crackle broadband SIN pitch legible**. Prueba interna: el
  barrido del Orb (ENDGAME 0x987, `TS(0x1450,1,50000,10000,1)`, ~1.5-2 s de tono
  sostenido esperado) NO aparece como tono en ninguna parte de la captura — el
  evento 52.6-55.7 s y todo 126-140 s son solo ráfagas/zumbido. (En el testigo
  video-K-moongate de otra sesión un sweep SÍ salía como tono constante ~2000 Hz;
  el render del bit-bang depende de la config/cycles de la sesión DOSBox.)
- **Beep 0x3ae6** (el de duración variable del censo GAP 8) → **ZUMBIDO GRAVE**
  (fundamental efectivo ~45-90 Hz, tren de impulsos de flanco). Los beeps de página
  (dur 0x28) suenan como ~2-2.4 s de buzz grave pulsado, NO como un pitido de 1 kHz.

**Consecuencia:** de la fanfarria solo es recuperable con Hz exactos el
**esqueleto de notas PIT**; la textura de fondo (burbujeo rápido) es bit-bang y su
pitch NO es recuperable de este testigo.

## 3. Estructura de la fanfarria (139.3 → 153.6 s)

Tres capas superpuestas:

1. **Burbujeo continuo** de mini-notas (20-60 ms cada una, ~380-900 Hz aparentes,
   casi sin huecos) durante los 14 s — textura de arpegio rápido. Pitch aparente NO
   fiable (capa bit-bang, ver §2).
2. **Golpes graves** ("tambor"): zumbidos de 30-80 ms con fundamental efectivo
   45-90 Hz, esparcidos; densidad máxima en 148.5-150.5 s (clímax).
3. **Esqueleto de notas limpias PIT** — la parte transcribible, tabla en §4.

## 4. Esqueleto nota a nota (capa PIT, Hz medidos)

Columna `conf`: A = línea limpia fuerte (sd≤2 Hz, ≥15 dB sobre fondo), B = clara
pero corta o con vecindad ruidosa, C = débil/ambigua. `Hz` es el PICO dominante
medido; donde la verificación armónica (F vs 3F) fue ambigua se anota.

| t (s) | Hz | ms | conf | nota |
|---|---|---|---|---|
| 141.42 | 1092 | ~25 | B | preludio |
| 141.45 | 1210 | ~112 | A | fundamental limpio (F domina, armónicos ausentes) |
| 141.56 | 1027 | ~60 | A | |
| 141.65 | 1245 | ~21 | B | |
| 141.69 | 906 | ~24 | B | |
| 146.82 | 4429 | ~50 | A | fortísimo (−1 dB del pico de archivo); F=1476 apenas sobre fondo — ambiguo 4429 vs 1476×3 |
| 147.22 | 3565-3682 | ~40 | B | inestable 3490-3682 |
| 147.48 | 1577 | ~50 | A | F domina |
| 147.55 | 1813 | ~15 | C | |
| 147.71 | 1745 | ~25 | B | |
| 147.93 | 1913 | ~50 | A | F domina |
| 148.50 | 1929 | ~10 | C | |
| 148.53 | 633→537-555 | ~60 | C | par descendente |
| 149.05 | 3801 | ~12 | C | |
| 149.55 | 1852 | ~55 | A | F domina; el más musical del clímax |
| 149.76 | 854 | ~45 | B | |
| 150.04 | 3901 | ~45 | A | 3F domina, F ausente → el tono ES 3901 |
| 150.07 | 1495-1507 | ~30 | B | encadenado al anterior |
| 150.22 | 593 | ~50 | B | |
| 151.40 | 2338 | ~40 | A | |
| 152.39 | 7010 | ~55 | A | agudísimo, fuerte (−6.7 dB) |
| 152.56 | 3996→4137→4899 | ~50 | B | terceto ascendente rápido |
| 152.71 | 673 | ~60 | A | grave final fuerte |
| 152.95 | 1558 | ~40 | C | cola |

(JSON completo con los ~250 eventos del umbral 20 dB en el scratchpad de sesión;
la tabla es la curación con confianza.)

## 5. Careo contra `speaker.ts` (tablas conocidas del port)

- **Ninguna tabla del catálogo reproduce la secuencia.** Ni TIME_SPELL_*, ni
  ARPEGGIO, ni INSTRUMENT_NOTES/BARD_FREQ_TABLE dan la serie medida bajo
  `incToHz` con la SR calibrada (25806 Hz).
- Coincidencia SUGERENTE (no concluyente): ajustando una sola escala libre
  SR′=26005 (fit por la nota 1852 ≡ inc 0x123c), tres de las notas fuertes caen
  sobre la tabla de frecuencias del MOTOR MUSICAL del kernel (0x42d2, la del laúd
  de Iolo): 1745≈0x1136 (+0.2%), 1852≡0x123c (fit), 2338≈0x16fa (+0.2%). Pero esas
  notas del motor son sweeps bit-bang (que aquí NO rinden tono limpio, §2) — la
  coincidencia apunta más bien a que la fanfarria usa **la MISMA tabla de
  frecuencias vía PIT** (¿set_tone?) o una tabla propia emparentada. Solo el
  disasm lo decide.
- El `endgame-beep` actual del port (`beep(1000, n·8)`) NO se parece al 0x3ae6
  real: el testigo muestra zumbido GRAVE pulsado de ~2-2.4 s para dur 0x28 (vs
  ~0.3 s a 1000 Hz del port). Discrepancia de carácter documentada para el carril
  endgame-visual (no tocada aquí).

## 6. ¿Es implementable? — recomendación

**Parcialmente, y NO se implementa desde aquí (mandato del encargo).**

- El **esqueleto** (§4, ~24 notas con Hz exactos, las A con confianza alta) es
  implementable como cue witness-derived Clase-C (PIT directo, `beep`-like).
- La **pieza completa NO es recuperable de este testigo**: el burbujeo (la mayor
  parte de la música) es bit-bang con pitch destruido por el render de esta sesión
  DOSBox, y la rutina de la fanfarria sigue SIN identificar en el disasm (GAP 8:
  ningún `0xffff9856` la produce; se espera tabla de notas + player).
- **Recomendación al lead:** esperar el disasm de la rutina (la coincidencia §5 con
  la tabla del motor 0x42d2 es una pista concreta por dónde buscar: clientes de
  set_tone/PIT con la tabla [0x6a44] o pariente en ENDGAME.OVL/DATA.OVL). Si se
  quiere sonido YA, el esqueleto §4 es el máximo honesto — etiquetado Clase-C y
  reemplazable por la derivación.
- Vía alternativa de verificación futura: RE-CAPTURAR el endgame con DOSBox-X
  configurado como la sesión de video-K (donde los sweeps sí rendían tono) — eso
  destaparía el pitch del burbujeo sin disasm.

## 7. Careo cruzado con los LPs (negativo confirmado, con matiz)

- alexdiener ep25 (pergamino en ~4478-4483 s del vídeo): el patrón de rayas-click +
  buzz de la fanfarria ES visible en su espectro, pero la voz del LP pisa 0-3 kHz
  continuamente; ninguna de las notas A de §4 es verificable allí con confianza.
- El veredicto F4 previo («solo-disasm») queda MATIZADO: la vía espectral SÍ dio
  fruto con captura digital limpia — lo irrecuperable no era el método sino las
  fuentes con voz, más el render bit-bang de esta sesión para la capa burbujeo.

---

## ADENDA (carril fanfarria-re, 2026-07-22) — DERIVACIÓN COMPLETA: **REFUTACIÓN**. La «fanfarria» NO existe en el binario DOS; el audio 139-153 del testigo es POST-FREEZE (no-juego)

**Método:** disasm puro (`re/disasm/ENDGAME.OVL.asm` + `ULTIMA.EXE.asm`, near_call_base(ENDGAME)=0xa290)
+ re-análisis A/V propio del testigo 2:34 (ffmpeg/scipy, careo frame-bursts↔audio; sin oráculo, sin navegadores).

### 1. El estado terminal es un BUCLE MUDO — byte-verificado

`endgame_datestamp` (ENDGAME.OVL 0x0326) imprime el pergamino (prints 0x75c0/helpers 0x23a-0x31e,
TODOS mudos: kernel_print 0x1850 → putchar 0x16ba = blit de glifo puro, leídos enteros) y cae en:

```
04f9: ff46fe   inc word ptr [bp-2]
04fc: ebfb     jmp 0x4f9
```

verificado contra los bytes crudos de `original/u5/play/ENDGAME.OVL` @0x4f9 (`ff 46 fe eb fb`).
Entre el último print (`0x845c` = "to Lord British at Origin Systems!", DATA.OVL fo 0x846c) y el
freeze NO hay ninguna llamada. No existe tabla de notas, ni player, ni sonido alguno en todo el grafo
de llamadas de la rama buena posterior al pergamino. **No hay rutina de fanfarria que derivar.**

### 2. Hipótesis 0x42d2 — REFUTADA con las tres patas

1. **El player 0x42d2 sólo es alcanzable como modo-4 del motor AMBIENTAL** `0x4102` (entrada real de
   la función; 0x416c es su interior), que corre UNA vez por tick de frame y elige modo por TILE en
   vista (prioridad por distancia²): modo1 reloj `&0xfe==0xfa` (0x41d0), modo2 cascada `&0xfc==0xd4`
   (0x41df) → `noise(0x2710,0x3c,0x14)`, modo3 fuente `&0xfc==0xd8` (0x41ef) → `noise(0x61a8,0x1e,0xa)`,
   modo4 bardo `[0xab02+cell]==0 && [0xac64+cell]&0xfc==0x5c` (0x41f8-0x420b) → 1 nota de la melodía
   por tick. (Semántica de buffers derivada de 0x56ac: **0xab02 = capa de MAPA** (0=hueco),
   **0xac64 = capa de ACTORES** (tile bajo, se dibuja +0x100; 0x16=vacío).)
2. **La sala del endgame no tiene NINGÚN tile gatillo.** MISCMAPS.DAT@0x210 (11×16, dump completo):
   tiles únicos = {44,4d,5c,5d,90,92,94,96,9b,9d,ab,ac,af,b0,b1,bf,ff}. Sin reloj/cascada/fuente. Los
   estantes 0x5c/0x5d están en la capa de MAPA (≠0) → el gate de bardo (exige mapa==0 y ACTOR 0x15c-f)
   no puede disparar. Los actores de la party usan tiles 0x140/0x144/0x148/0x14c (tabla clase→tile
   DS 0x1ade = DATA.OVL fo 0x1aee: `4c 40 44 48 4c…`), LB=0x17c — ninguno en 0x15c-0x15f.
3. **Durante el pergamino no corre NI UN TICK** (el freeze es un spin puro; no hay `0xffff9856` ni
   keywait tras el último print). El motor musical no puede sonar ahí ni aunque hubiera gatillo.

El fit §5 (3 de ~24 notas sobre la tabla 0x6a44 con UNA escala libre) queda explicado como azar sobre
tonos aleatorios de clase noise_burst (ver §4-abajo).

### 3. Correcciones al censo GAP 8 (la clave que desbloqueó todo)

- **`0xffff9856` → ULTIMA.EXE 0x3ae6 NO es un beep: es RUN-N-FRAMES.** Bucle `dur` × (`call 0x5910` +
  `delay 0x20fa(1)`). 0x5910 = TICK de frame: refresco de vista (dungeon: copia 0xad14→0xab02,
  0x59f8-0x5a0b), render (0x4552/0x56ac), viento (0x2f62, mudo), **ambiente 0x4102** — la ÚNICA vía de
  sonido del tick. En la sala del endgame el ambiente es MUDO (§2.2) ⇒ **todos los «beeps» del censo
  son PAUSAS**: page-pumps dur 0x28 = 2.3 s de pausa; «ping verde» ~27 s = el pump de LLEGADA (0x06f2);
  «15 tonos asc/desc del moongate» = **15 FRAMES de animación del reveal del gate** ([0x5887] 1..15
  consumido por 0x56ac→0x1112), sonido = NINGUNO; pings por miembro tick(1) = pacing mudo.
- Los «beeps 0x0502/0x050c (dur 2,3)» del censo son la rutina **0x04fe = sonido DE PASO** (tick(2) +
  `call 0xffffa0ae` + tick(3)), llamada por CADA paso de `move_sprite_toward` (0x510@0x595). No son del
  re-tinte ni del compositor.
- **`0xffffa0ae` → ULTIMA.EXE 0x433e = click-clack del paso**: `noise(0x3e8,0x19,1)` + `delay 0x20c8(0x14,1)`
  + `noise(0x5dc,0x19,1)`. (0x223c = noise_burst, abajo.)

### 4. `noise_burst` 0x223c DERIVADO byte-a-byte (la única «música» real de la fase final)

`0x223c(band,total,slice)` (args C: [bp+4]=band, [bp+6]=total, [bp+8]=slice), 0x223f-0x22bc:
- PRNG: `state = ((ror16(state+0x9248,3)) ^ 0x9248) + 0x11` sobre [0x545c] — **la MISMA fórmula del
  LFSR visual de la disolución** (EGA.DRV fn32 / `visualLfsr.ts`) y del rand global 0x2092 ([0x5420]).
- freq aleatoria uniforme en **[100, band] Hz** (piso bx=0x64, 0x2268-0x2277) → **PIT real**
  (`0x1234DE/freq → out 0x42`, 0x227b-0x2287) → sostiene `slice` unidades; repite hasta `total`.
- ⇒ cada burst = ráfaga de mini-tonos PIT ALEATORIOS con Hz exactos (líneas limpias en espectro).
  **Un paso de caminata** (0x433e) = ~25 tonos en 100-1000 Hz + ~25 en 100-1500 Hz ≈ el «burbujeo»
  del §3 (mini-notas 20-60 ms, ~380-900 Hz aparentes). Bandas grandes existen sólo en fuente (25 kHz)
  y cascada (10 kHz) — ausentes en el endgame.

### 5. Re-careo A/V del testigo (hecho aquí, ffprobe/scipy): sincronía PERFECTA hasta el freeze

Ráfagas de frames VFR (=cambios reales de pantalla) ↔ eventos de audio (silencedetect −45 dB):

| vídeo (frames nuevos) | evento | audio |
|---|---|---|
| 95.0-97.2 | últimos miembros al gate | caminatas hasta 96.2 ✓ |
| 98.2-101.7 (198 f) | DISOLUCIÓN | **silencio** ✓ (la disolución es muda) |
| 102.5/103.5 | historia-1 aparece | blip 105.1 |
| 108.87 / 113.75 / 119.17 / 122.28 / 124.94 | **5 pasadas de página** (2 frames c/u — la página se dibuja en <50 ms, NO typewriter) | rumbles 108.8-112.0 / 113.6-115.8 / 119.1 / 122.25 / 124.9 ✓ EXACTO |
| 128.72-128.83 + 129.83 | blit ENDSC + texto del pergamino (instantáneo) | rumble 126.7-129.6 |
| **129.8 → fin: CERO frames** salvo cursor del ratón (145.3-148.2, 153.1-153.3) | **FREEZE** | blip 133.0; **«fanfarria» 139.5-153.9** |

Los «beeps de página ~110/114/128» del censo son las pasadas de página del compositor (6 páginas), y
su sonido medido es un **rumble grave 45-80 Hz de tren de impulsos** (medido aquí nota a nota), la
firma que este DOSBox da a los bucles de espera/render (§2 del espectral ya documentó el render
pitch-less del bit-bang en esta captura) — NO son notas.

### 6. La «fanfarria» 139.5-153.6 es AUDIO POST-FREEZE, no del juego

- Empieza **~9.7 s DESPUÉS** de que el juego quede congelado (pantalla estática byte-idéntica salvo
  el puntero del ratón del HOST; el bucle 0x4f9 es mudo y no lee teclado).
- No es un duplicado desplazado de audio anterior (cross-correlación contra páginas/caminatas/diálogo
  ≤0.23 = suelo de ruido).
- Su firma medida aquí (84 eventos: ~75 rumble <200 Hz + ~9 tonos cortos débiles aleatorios 203-4416 Hz)
  es la MISMA clase que los rumbles de los bucles de espera del juego, no una pieza musical: el
  «esqueleto de 24 notas» del §4 es la cola de una distribución aleatoria (consistente con clase
  noise_burst/artefacto, no con una tabla).
- El clímax (148.5-150.5) SOLAPA con la actividad de ratón del host (145.3-148.2) y el final (153.6)
  con la parada de la grabación (153.3) ⇒ origen más plausible: artefacto de emulación/host sobre el
  spin del freeze (auto-cycles de DOSBox-X / eventos de teclado-ratón del usuario sobre el juego
  congelado). **Falsable con oráculo**: re-correr el endgame headless SIN tocar teclado/ratón tras el
  freeze → la cola debe desaparecer (o quedar como rumble puro del spin).
- Los avistamientos en LPs (aulddragon/alexdiener, §7) se reinterpretan como la misma clase de
  artefacto + los rumbles de keywait/página; ninguno tenía espectro utilizable (voz encima).

### 7. Para el port (banda sonora FIEL de la fase final — sin fanfarria)

| evento | sonido fiel | cita |
|---|---|---|
| llegada a la escena verde | pausa 40 ticks, MUDA | 0x06f2 pump |
| paso de sprite (walk-in/exit) | `noise(1000,25,1)+delay+noise(1500,25,1)` (click-clack aleatorio) | 0x04fe→0x433e→0x223c |
| «<nombre> lives!» por miembro | sweep 0x7f02(0x2260,1,0x9c40,0x1388,1) | 0x078f |
| orb al suelo | sweep 0x7f02(0x1450,1,0xc350,0x2710,1) | 0x0987 |
| moongate abre/cierra | **MUDO** — 15 frames de animación del reveal | 0x099c/0x0a2c + 0x56ac/0x1112 |
| entrada de cada miembro | **MUDO** — tick(1) de pacing | 0x0a0d |
| pumps de página de diálogo | pausa 2.3 s MUDA | 0x0830/0x0922 |
| páginas de historia / pergamino | dibujo instantáneo, MUDO | frames 108.87+ (2 f/página) |
| tras el pergamino | **SILENCIO + freeze** | 0x04f9 |

El cue witness-derived Clase-C del §6 (esqueleto de notas) queda **RETIRADO de la cola de
implementación**: transcribía un artefacto. El `endgame-beep` del port debe modelar los pumps como
PAUSAS (no beeps de 1 kHz). La discrepancia §5 con el port queda así resuelta de raíz.

**VEREDICTO: REFUTACIÓN con derivación completa.** No hay Clase-B sonora pendiente en el endgame:
todo evento audible de la fase final está citado (0x433e/0x223c/0x7f02) y lo demás es pausa/animación
muda. La única deuda es la verificación-oráculo del artefacto (§6), opcional y de higiene.
