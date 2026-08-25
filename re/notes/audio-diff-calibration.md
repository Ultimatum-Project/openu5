# Calibración del PC-speaker por audio-diff (task #56)

Depuración OBJETIVA (no de oído) de por qué los SFX del port NO suenan como el
original. Semántica de hardware DERIVADA del disasm + ancla numérica del ORÁCULO
(dosbox-x headless, sin capturar audio: BPs de código + contador de ticks BIOS).
Refuta la nota `sfx-catalog.md §0` ("los Hz NO se derivan del binario"): sólo el
sweep/noise dependen de la calibración, y AÚN ASÍ son derivables una vez anclado
`t_dec`; beep/glide/set_tone dan Hz EXACTOS.

## 1. Semántica de hardware de las 4 primitivas (ULTIMA.EXE.asm)

Todas comparten UN bucle de retardo `dec word ptr [mem]; jne` (t_dec s/iteración).
La duración = `paramCount · innerCount · t_dec`, con `innerCount` fijado por el
reloj calibrado en runtime `C = [0x5356]` (0x1158 lo calibra a la CPU):

🔴 **CONVENCIÓN DE ESTAS TUPLAS: ORDEN DE PUSH DEL LLAMADOR** (el primer `push` aterriza en el
offset de marco MÁS ALTO, así que la lista por offset ascendente es la INVERSA de la de aquí).
Añadida el 2026-08-09 por la ficha #139, y **no es cosmética**: la misma firma escrita en la
otra convención parece contradecir a ésta sin que ninguna esté mal, y eso ya costó una ficha
entera (#83, que nació creyendo que había dos lecturas incompatibles del cuerpo de glide).
Derivación de las cuatro filas, verificada slot a slot contra `ULTIMA.EXE.asm` — para glide,
`[bp+4]`=total (cota del bucle), `[bp+6]`=step, `[bp+8]`=end, `[bp+0xa]`=start.

| Primitiva | Entrada (orden de PUSH) | inner (nº decrementos/unidad) | Cita asm |
|-----------|---------|-------------------------------|----------|
| `tone_sweep` 0x2192 | `(inc,delay,count,start,step)` | `floor(C/24)` | `0x21a6 div 0x18` |
| `noise_burst` 0x223c | `(step,dur,band)` | `C >> 4` (=C/16) | `0x228c shr 4` |
| `beep` 0x22c0 | `(freq,dur)` = set_tone+`delay(1,dur)`+stop | `C >> shiftTbl[1]` = `C>>0` = **C** | `0x20d4`+`0x20da`; shiftTbl[1]=0 (oráculo) |
| `glide` 0x43ae | `(start,end,step,total)` = set_tone·(total/step)+`delay(1,step)` | **C** (idem beep) | cuerpo 0x43ae; el retardo, en 0x43e3 |

🔴 **CORRECCIÓN DE LA MISMA FECHA, declarada para que sea auditable: las dos llamadas al
retardo de esta tabla estaban en la convención CONTRARIA a la de sus propias filas** — decían
`delay(dur,1)` y `delay(step,1)`, que es el orden por offset de marco, dentro de filas cuyas
listas de argumentos van en orden de push. Cada celda era correcta por separado y la fila,
mixta. Ahora las dos van en push, como el resto de la tabla.
El árbitro es el cuerpo del propio retardo (`ULTIMA.EXE` 0x20c8): `[bp+6]` **indexa** la tabla
de desplazamiento —es el `1` de `shiftTbl[1]=0` que esta misma fila cita— y `[bp+4]` es la
cuenta del bucle externo; los dos sitios de llamada empujan el `1` PRIMERO y la duración
DESPUÉS (glide en 0x43dc-0x43e3), así que en orden de push el `1` va delante.
⚠ Los valores no cambian: sólo se reordena la notación para que la tabla hable un solo idioma.

- `count`/`dur`/`total` = **duración**; `step` de glide se cancela (total/step
  iteraciones · step·C = total·C).
- **PIT**: `set_tone` (0x22e2) hace `divisor = 0x1234DE / arg` y programa el PIT →
  la **frecuencia de salida = arg (Hz) EXACTA**. Por eso beep/glide/set_tone tienen
  Hz derivados (bump=165 Hz, cañonazo 1000→200 Hz, etc.). El sweep/noise NO usan el
  PIT como tono: programan divisor fijo 0x3c (portadora 19886 Hz) y conmutan el gate
  por software (PWM) → el pitch audible del sweep = `(inc/65536)·SR_sweep`, con
  `SR_sweep = 1/(delay·floor(C/24)·t_dec)`. El noise = secuencia de tonos PIT
  aleatorios en `[100, band]` Hz (PRNG local `[0x545c]`, no toca `g_rng`).

## 2. Ancla del oráculo → la constante U

`C·t_dec` es MÁQUINA-INDEPENDIENTE por diseño (0x1158 ajusta C inversamente a la
CPU). Definimos **U = C·t_dec** [ms] = duración de 1 unidad de `delay` con inner=C.

Medida (dosbox-x `cycles=fixed 3000`, run headless propio; el bump al chocar contra
la pared oeste llama `delay_via_timer(outer=0xC8=200, shiftidx=1)`):

```
C = [0x5356] = 1308              (leído de RAM viva)
DELAY(outer=200, shift=1) = 4 ticks BIOS = 219.7 ms emulados
U = 219.7 / 200 = 1.10 ms/unidad          (t_dec ≈ 0.84 µs, ~2.5 ciclos/iter @3000)
SR_sweep = 24000/U = 21818 Hz
```

Precisión: ±1 tick BIOS (54.9 ms) sobre 4 ticks → ±~13 %. Las RATIOS entre cues
son EXACTAS (derivadas); sólo la escala absoluta U tiene esa incertidumbre. Refinable
con un sonido largo (moongate/cast, cientos de ticks) o una grabación real del usuario.

## 3. Diagnóstico: por qué el port sonaba mal (medido, no de oído)

El port (`speaker.ts` pre-#56) metía TODO por una `SR=20000` nominal y factores
inventados `beep×256`, `glide×64`. Contra el ground-truth derivado (U=1.10 ms):

| cue (primitiva) | port ms (antes) | truth ms | error | causa |
|-----------------|-----------------|----------|-------|-------|
| **move-blocked** (beep) | **2560** | **220** | **11.6× LARGO** | `BEEP_SAMPLES_PER_TICK=256` (real: 24) |
| cannon-fire / escape / ring (glide) | 960 / 128 | 330 / 44 | **2.9× largo** | `GLIDE_SAMPLES_PER_UNIT=64` (real: 24) |
| move-step (noise×2) | 2.5 (sin hueco) | 3.4 + **hueco 22 ms** | corto + **sin el gap** | `SR` + falta `delay(0x14)` |
| combat/crackle/dungeon (noise) | ~×0.73 | — | 27% corto | `SR=20000` vs 21818 + factor 1.5 |
| cast/moongate/etc (sweep) | ×1.10 | — | 10% largo | `SR=20000` vs 21818 |

- **BUMP "demasiado largo"** = el beep 11.6× de más (2560→220 ms). Timbre ya OK
  (165 Hz exacto, onda cuadrada).
- **PASO "no suena igual"** = eran DOS clics `tk‥tk` separados por `delay(0x14,1)`
  = 22 ms (0x4355); el port los encadenaba sin hueco → un solo blip. Además 27% corto.

## 4. Calibración aplicada (`game/src/skin/fiel/speaker.ts`)

Reemplaza las 4 constantes nominales por la ley derivada, todo colgando de U:

```
DELAY_UNIT_MS = 1.10                      // U = C·t_dec (ancla oráculo)
SPEAKER_SAMPLE_RATE_HZ = 24000/U = 21818  // SR_sweep (era 20000)
// factores relativos al inner del sweep (base de samplesToMs, inner=floor(C/24)):
BEEP_FACTOR  = 24    (inner C)            // era 256  → beep_ms = dur·U
GLIDE_FACTOR = 24    (inner C)            // era 64   → glide_ms = total·U
NOISE_FACTOR = 24/16 = 1.5 (inner C>>4)   // era 1    → noise_ms = dur·U/16
// PASO: nuevo SilenceSeg = delay(0x14,1) = 22 ms entre los 2 bursts.
```

Pitch sin cambios (ya correcto): beep/glide/set_tone = Hz exactos; sweep =
`(inc/65536)·SR_sweep`.

## 5. Arnés (game/tools/audiodiff/)

- `oracle_speaker_probe.py` — mide del ORIGINAL en vivo (C, tabla de shift, ticks de
  cada primitiva). Run-dir propio; JAMÁS el dosbox del usuario. Frágil bajo confound
  (otro dosbox degrada el pty): reintentos + skip.
- `truth_model.py` — ground-truth derivado por cue (ms + Hz) dado `C` y `t_dec`.
- `offline-speaker.ts` / `render-cues.ts` — render OFFLINE de cada cue del port a WAV
  + `port-metrics.json` (sin navegador; espeja `SpeakerSynth`).
- `tests/audiodiff.test.ts` (`npm run re:audiodiff`) — GUARDA CI: computa el truth de
  forma independiente y exige que la síntesis del port lo cumpla (tolerancia 1%).

## 6. Pendiente (refinamiento, no bloqueante)

- ~~Anclar U con un sonido LARGO o una grabación real~~ → HECHO en §7 (task #72).
- Tabla de notas real `[0x2746]` (instrumentos) y `[0x3a26]` (arpegio aparición): el
  pitch de esas TS ya es exacto por-nota una vez leídas las tablas (siguen →AV sólo
  las tablas de datos, no la ley).

## 7. Calibración FINA con CAPTURAS REALES del original (task #72)

El usuario capturó dos WAV del original en DOSBox-X (Ctrl+F6, digital exacto, sin
micro), gitignored en `original/av-referencia/audio/`:
`ultima_000.wav` = un PASO a pie (48 kHz), `ultima_001.wav` = la CATARATA de ambiente
(6.4 s junto a la cascada). Medidos con numpy (FFT/ZCR/autocorrelación propias;
scripts efímeros). Tres hallazgos, todos aplicados:

### 7.1 U = 0.93 ms (antes 1.10 del oráculo, ±13 %) — adiós a la incertidumbre

Dos anclas REALES independientes convergen (kill del ±13 %):
- **Cascada**: el burst `NB(20,60,10000)` mide **3.46 ms** de mediana sobre 115 bursts
  limpios ⇒ `dur·(C>>4)·t_dec = 60·81·t_dec = 3.46 ms` ⇒ `t_dec = 0.711 µs`,
  **U = C·t_dec = 1308·0.711 µs = 0.93 ms**. (115 muestras = el mejor SNR.)
- **Paso**: el HUECO entre los dos clics (`delay(0x14,1) = 20·C·t_dec`) mide 16.8 ms
  (borde-a-borde) / 18.7 ms (centro-a-centro) ⇒ U ≈ 0.84–0.93 (bracket consistente).
Se ancla en la cascada. Consecuencia DERIVADA (misma `t_dec`, sin grado de libertad):
`SR_sweep = 24000/U` sube 21818 → **25806 Hz** ⇒ los sweeps suben ~18 % de pitch.
Eso NO tiene ancla real todavía (no hay sweep capturado) — verificable cuando el
usuario grabe una moongate/cast. Aplicado en `speaker.ts` `DELAY_UNIT_MS`, el test
`audiodiff.test.ts` y `truth_model.py` (t_dec por defecto 0.711 µs).

### 7.2 Cadencia del ambiente = 54.94 ms (1 tick BIOS), no 110 ms — ya NO →AV

La envolvente de la cascada autocorrelaciona con picos LIMPIOS en 54.9/109.9/164.8/
219.7… ms (= múltiplos del tick BIOS de 18.2 Hz), y hay **116 bursts en 6.39 s** (1 por
tick). Duty ≈ 7 % (burst ~3.5 ms + ~51 ms de silencio) ⇒ el ambiente re-dispara el
`noise_burst` una vez por CADA tick base de 55 ms, no cada 2. Fijado
`AMBIENT_EVERY_N_TICKS = 2 → 1` en `skin.ts`. La cascada/fuente burbujean ahora al
doble de frecuencia (rumor continuo), y el contador de fase `[0x6a34]` (tic/tac del
reloj en fase 0/4) avanza a la par.

### 7.3 Textura del ruido: era siseo brillante, el real es retumbo GRAVE

El PASO cuadra con el modelo `[100,band]` (clics a 590/716 Hz para band 1000/1500).
Pero la CATARATA (band=10000) sale MUCHO más grave de lo que el modelo predice:
tonos con mediana ~333 Hz y **nada por encima de ~3 kHz** (energía 3–5 kHz 3.4 %,
5–8 kHz 1.7 %, >8 kHz 0.4 %), pese a que el `noise_burst` barre `[100,10000]` (asm
`0x2273 div`; freq = `100 + PRNG%(band-99)`, comprobado). Causa DERIVADA: el burst
sólo tiene `dur/step = 3` tonos de ~1.3 ms; el altavoz físico / la emulación de
DOSBox-X no alcanza esas frecuencias altas en tan poco tiempo y las emborrona en un
"chuff" grave (la onda cruda es casi toda positiva, cf. dump). El port sonaba a siseo
brillante (centroide del tren de cascada **5066 Hz** vs real **708 Hz**). DOS fixes:
- **PRNG persistente** (`noiseState`, espejo de `[0x545c]`): antes el port re-sembraba
  `0x1234` por burst ⇒ con la cadencia ya a 55 ms la cascada repetía SIEMPRE los mismos
  3 tonos 18×/s (zumbido tonal). Persistiendo el estado, cada burst saca tonos nuevos
  (áspero/variado como el hardware). LOCAL: no toca `g_rng` (cero paridad).
- **Paso-bajo de 2 polos a 1.5 kHz** sólo en los segmentos de RUIDO (`NOISE_LOWPASS_HZ`
  en `speaker.ts` + espejo en `offline-speaker.ts`); los tonos SOSTENIDOS (beep/glide/
  sweep) van directos (el altavoz SÍ los reproduce). Resultado: el tren de cascada del
  port pasa de centroide 5066 → **923 Hz** (real 708 Hz) — de siseo a retumbo.

### 7.4 Tabla real-vs-port (tras los fixes)

| medida | REAL (WAV) | PORT (antes) | PORT (ahora) |
|--------|-----------|--------------|--------------|
| paso: nº clics | 2 | 2 | 2 |
| paso: hueco entre clics | 16.8 ms | 22 ms | 18.3 ms |
| paso: span total | 20.7 ms | 25.4 ms | 21.5 ms |
| cascada: burst | 3.46 ms | 4.13 ms | 3.49 ms |
| cascada: cadencia re-disparo | 54.9 ms | 110 ms | 54.9 ms |
| cascada: centroide del tren | 708 Hz | 5066 Hz | 923 Hz |
| bump (beep 0xa5,0xc8) | — (no capturado) | 220 ms | 186 ms |

WAV A/B para el oído del usuario (scratchpad de la sesión): `port_waterfall_train.wav`,
`port_fountain_train.wav`, `port_step.wav` vs `ultima_001.wav`/`ultima_000.wav`.

## 8. Re-verificación #72-re: el RUIDO era BIPOLAR y debía ser UNIPOLAR

El usuario escuchó el resultado de §7 EN EL JUEGO y dictaminó "no se parecen aún los
sonidos". La re-auditoría (medidas propias de los 2 WAV + captura de la salida REAL del
navegador vía `OfflineAudioContext`) halló que §7 calibró bien la DURACIÓN/cadencia pero
el TIMBRE del ruido seguía roto por un error de MODELO de la forma de onda, no de
parámetros. Dos hallazgos, uno de método y uno de física.

### 8.1 El navegador y el render offline DIVERGEN (por qué §7 sonó bien en A/B y mal en juego)

El A/B de §7 se generó con el render OFFLINE (`offline-speaker.ts`), que usa un cuadrado
CRUDO. Pero el juego usa `OscillatorNode` "square" de Web Audio, que es BANDA-LIMITADO
(repica en las transiciones) → suena más brillante. Capturando la salida real del
navegador (mismo `SpeakerSynth`, `OfflineAudioContext`) se ve que offline y navegador NO
coinciden. **LECCIÓN: el juez es la captura del navegador, no el render offline.** Toda
la calibración de #72-re se ancló contra la salida real del navegador.

### 8.2 El altavoz PC es MONOPOLO: el ruido es UNIPOLAR (0/+V), no bipolar (±V)

La onda cruda de la cascada real (`ultima_001.wav`) es TODO POSITIVO. Evidencia
REPRODUCIBLE (medida con numpy sobre el WAV; base declarada):
- **asimetría de energía E+/E− = 22.4×** (`sum(x[x>0]²)/sum(x[x<0]²)`) y **min −353 vs
  max +9700 = 27:1** a fondo de escala,
- dentro de un burst **93 % de muestras positivas**.
NO es una cuadrada bipolar de media cero. Es física: el gate del PIT sólo EMPUJA el cono
(0→+V), nunca tira. **El DC medio full-file es +0.0002 ≈ 0** (el capturador acopla AC y hay
~94 % de silencio entre bursts) — la unipolaridad NO se ve en el DC medio sino en la
asimetría de energía. (El review adversarial refutó explícitamente la hipótesis alternativa
"es DC del capturador": mean ≈ 0, la señal ES unipolar por asimetría.) El crest full-file es
**6.43** (pico 0.296 / RMS 0.046; alto por el ~6 % de duty), no un ataque suave.

Consecuencia acústica (era el gran desajuste): un burst unipolar es un PEDESTAL de DC
recortado por la ventana de ~3.5 ms; su espectro es un sinc centrado en continua (lóbulo
~270 Hz) → **82 % de la energía por debajo de 300 Hz en base burst-train** (el "chuff"/
retumbo grave). El modelo BIPOLAR de §1–§7 tenía DC cero, así que TODA su energía caía en la
portadora [100,band] → centroide del tren de cascada (base burst-train) **1000 Hz vs 458 Hz
real**, y el paso **1094 Hz vs 554 Hz real** (medido en el navegador). Ese era el siseo tonal
brillante del "no se parece".

**BASES DE MEDIDA (declaradas, para reproducir).** El centroide = media de frecuencia
ponderada por energía (`|FFT|²`, ventana Hann). Dos bases dan números distintos y NO se
deben mezclar:
- **full-file**: sobre todo el registro (incluye la modulación de amplitud del tren de
  bursts a 18 Hz y el silencio). La cascada real da **708 Hz** en esta base (= §7.4, = lo que
  mide el review).
- **burst-train**: concatenando sólo las regiones de burst (umbral 0.25·env-max, ventana de
  env 0.5 ms), quitando silencios. La cascada real da **458 Hz** en esta base.
La comparación port↔real de §8.3 se hace en base **burst-train en ambos lados** (apples-to-
apples). Donde §8 antes decía "460" sin cualificar, era esta base (458, redondeado); el
"708" del review es full-file. Ambos correctos.

Fix (`speaker.ts` capa audio; espejo en `offline-speaker.ts`), sólo en segmentos de RUIDO:
- **WaveShaper unipolar** curva `[0,0,1]` (mapea el cuadrado ±1 → 0/+1; negativo y
  silencio→0, positivo→1 = puerta abierta). Es el ingrediente que faltaba: el pedestal DC
  recortado por la ventana = el grave.
- **Puerta casi instantánea** `NOISE_EDGE_S=0.2 ms` (antes el `EDGE_S=4 ms` triangulaba el
  burst de 3.5 ms a ~1 ms → duty 0.9 % y sólo la mitad de bursts audibles vs 6.4 %/todos
  reales). El transiente seco del gate ES el sonido (crest full-file real 6.43).
- **Paso-alto ~20 Hz** (BiquadFilter): acopla AC, sangra la continua estática (inaudible,
  desperdicia headroom), deja el pedestal transitorio.
- **Paso-bajo `NOISE_LOWPASS_HZ` 1500→2100** (BiquadFilter): rolloff del cono. CALIBRADO
  CONTRA EL NAVEGADOR (no el offline): con el burst ya unipolar el grave lo da el pedestal,
  el LP sólo quita el repique de banda-limitada. Los TONOS (beep/glide/sweep) NO se tocan
  (su DC es constante e inaudible; su contenido audible es idéntico uni o bipolar).

### 8.3 Tabla real-vs-navegador (medida en la salida REAL del navegador)

Todo medido en la salida del NAVEGADOR (OfflineAudioContext + el propio `SpeakerSynth`),
que es lo que oye el usuario. Cascada en base **burst-train**; paso en base **full-file de la
región activa** (indicado):

| medida | REAL (WAV) | PORT #72 (bipolar) | PORT #72-re (unipolar) |
|--------|-----------|--------------------|------------------------|
| cascada: centroide (burst-train) | 458 Hz | 1000 Hz | **407 Hz** |
| cascada: <300 Hz (burst-train) | 82 % | 20 % | **69 %** |
| cascada: bursts/s · duty | 18.6 · 6.4 % | 9 · 0.9 % | **18.5 · 5.7 %** |
| paso: centroide (full-file activo) | 554 Hz | 1094 Hz | **535 Hz** |
| paso: <300 Hz (full-file activo) | 46 % | 12 % | **43 %** |

**El PASO no es un número estable** — es un solo disparo de ~50 ms con 2 bursts cuyas
frecuencias las saca el PRNG local por render, así que su centroide VARÍA: offline sobre 15
draws da media **569 Hz, sd 45 Hz, rango 504–682**. Por eso una sola medida del paso puede
dar 535 (mi captura) u 681 (otra captura del review): ambos son puntos de la MISMA
distribución, y el real (554–602 según recorte) cae dentro. **El ancla estable es la
cascada** (tren de 116 bursts que promedia el PRNG). El paso pasa de bipolar ~1094 Hz a
unipolar ~535–682 Hz — el cambio de carácter (brillante→grave) es inequívoco aunque el
número exacto baile.

La cascada pasa de siseo tonal (1000 Hz) a retumbo grave (~407). El techo de <300 (69 % vs
82 %) es el límite del cuadrado banda-limitado del navegador (repica en las transiciones) —
sin re-escribir el oscilador como buffer no se alcanza el 82 %, y la arquitectura es
procedural por diseño (sin samples). Mejora enorme y anclada, con un cabo honesto (§8.4).

### 8.4 Cabos sueltos / capturas que faltan (medibles, NO derivar a ciegas)

- **+18 % de pitch de los sweeps** (cabo de §7.1): sigue SIN ancla real (deriva de U).
  Pide captura de **moongate** o **cast de hechizo** (Ctrl+F6 junto a un moongate / al
  lanzar un hechizo).
- **Timbre del BUMP** (beep 165 Hz, `move-blocked`) y de los **glides** (cañonazo, huida):
  son TONOS sostenidos; su timbre en hardware real (resonancias del cono) no se puede
  calibrar sin captura. Pide **bump contra pared** y **cañonazo de fragata**.
- **OVERSHOOT hacia grave (cabo honesto)**: a LP 2100 el port pierde el "sizzle" >3 kHz que
  el real SÍ tiene (real banda 3–5 kHz **3.4 %** vs port **~1.4 %**; por eso el real full-file
  sube a **708 Hz** pero el port full-file se queda en **467 Hz**). El burst unipolar da el
  retumbo correcto, pero el port queda algo MÁS oscuro que el real. VÍA (no aplicar sin nueva
  captura): subir el LP y añadir un shelf de agudos que devuelva el >3 kHz sin perder el
  dominio grave. NO se retoca a ciegas.
- El techo de <300 de la cascada (§8.3) sólo subiría re-escribiendo el oscilador de ruido
  como onda unipolar a medida (PeriodicWave no lleva DC) — no se hizo por el diseño
  procedural. Queda anotado por si el oído del usuario aún lo pide.

### 8.5 Test que ancla el fix (el hallazgo más importante)

El fix vive en la CADENA DE SÍNTESIS, no en los valores del catálogo, así que los tests de
duración/frecuencia (audiodiff) NO lo protegían: revertir el WaveShaper+paso-alto+borde seco
dejaba los 39 verdes. Se añadieron a `fiel-speaker.test.ts` 3 asserts que discriminan
(inspección del grafo con el ctx falso, sin navegador):
1. **RUIDO** cablea el camino `osc→shaper(curva [0,0,1])→gain→highpass(20)→lowpass(2100)→
   dest` — verificado por lista de aristas, no sólo por existencia de nodos.
2. **TONO** va directo `osc→gain→dest` (ni WaveShaper ni filtros de ruido).
3. **PASO**: la puerta del ruido usa borde seco (ataque ≤ 0.5 ms), no el EDGE_S de 4 ms.
Comprobado que revertir la rama unipolar hace fallar (1) — el test discrimina de verdad.

WAV A/B para el oído del usuario (capturados del NAVEGADOR real): `PORT_waterfall_after.wav`
/`PORT_waterfall_BEFORE.wav`, `PORT_step_after.wav`/`PORT_step_BEFORE.wav`,
`PORT_fountain_after.wav`, `PORT_bump_after.wav`, `PORT_combatHit_after.wav` vs
`REAL_waterfall.wav`/`REAL_step.wav`.
