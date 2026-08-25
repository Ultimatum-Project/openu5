# Auditoría del catálogo de PC-speaker (`speaker.ts`) — barrido cue×veredicto×causa

Motivada por el fix del bardo (la melodía sonaba a sirenas + rests 24× + fuga a la
caminata). El usuario preguntó: "¿y eso no hay que revisarlo en TODOS los sonidos?". Sí.
Los bugs viven en PRIMITIVAS COMPARTIDAS, así que todo el catálogo era sospechoso. Método
= el mismo que el bardo: **cita ASM del primitivo real + validación ESPECTRAL contra
testigo** (nada de calibración a oído). Cross-ref: `sfx-catalog.md`, `camp-scene-kernel.md`
§5/§6, `audio-diff-calibration.md`, `ambient-audio-audit.md`, `walk-sound-verdict.md`.

## 0. VEREDICTO GLOBAL

**Un solo bug sistémico: el modelo de PITCH de `toneSweep` (0x2192).** El resto de
primitivas (`set_tone` 0x22e2, `beep` 0x22c0, `glide` 0x43ae, `noise_burst` 0x223c,
`delay_via_timer` 0x20c8) están SANAS y ya validadas. El bug del `toneSweep` afectaba a
TODOS los cues 0x2192 (la clase del bardo): se rendían como rampa de pitch f0→f1 cuando el
primitivo real es de pitch CONSTANTE. Corregido globalmente en `toneSweep`; cascada a 13
cues. Validado contra 3 testigos independientes (moongate, clavicémbalo, bardo).

## 1. Los primitivos, verificados instrucción-a-instrucción (ULTIMA.EXE.asm)

| primitivo | offset | mecanismo | pitch de salida | ¿sano en el port? |
|---|---|---|---|---|
| tone_sweep | **0x2192** | PWM soft: `dx+=inc` (env. mod 65536), gate ON si `dx>bx` (0x21f8) | **inc/65536·SR CONSTANTE**; bx sólo = DUTY | **NO → corregido** |
| set_tone | 0x22e2 | `div 0x1234DE/arg → out 0x42` | = arg (Hz exactos) | sí |
| beep | 0x22c0 | `set_tone(freq)` + `delay(dur)` + off | = freq (Hz) | sí |
| glide | 0x43ae | rampa lineal de `si` (Hz) → `set_tone(si)` en bucle | glissando real start→end (Hz) | sí |
| noise_burst | 0x223c | PRNG local [0x545c] → freqs random en banda | ruido | sí (calibrado #72) |
| delay_via_timer | 0x20c8 | bucle de decrementos, gate cerrado | silencio | sí (calibrado walk/quake) |

### El bug del 0x2192 (cita)
`0x2192` programa un divisor PIT **fijo** `0x3c` (0x21ac) y genera el tono por un
acumulador de fase en software: `mov ax,[bp+0xc]; add dx,ax` (0x21c4/0x21f1), gate por
`cmp dx,bx; ja` (0x21f8). El FUNDAMENTAL = tasa a la que `dx` envuelve mod 65536 =
`inc/65536·SR`, **independiente de `bx`**. El umbral `bx` (arranca en `start`, +`step`/iter)
sólo cambia el DUTY CYCLE (timbre). El modelo viejo (`speaker.ts` §1.1: "step<0 sube el
pitch, step>0 lo baja", rampa `f1=f0·start/bxEnd`) era una interpretación ERRÓNEA.

**Refutado por el espectro de 2 testigos:**
- **moongate** (`video-K-moongate.mov`, evento 11.06–12.4 s): fundamental **~2000 Hz
  CONSTANTE** mientras bx barre 2000→62000. El viejo modelo lo hundía a 75 Hz (whoosh
  descendente — el "suena mal" que el usuario señaló espontáneamente).
- **clavicémbalo** (`HARPSI_SANDALWOOD_QUAKE.mov`): cada nota es pitch ESTABLE (3562/3962/
  4202/2361 Hz sostenidos), no el chirp ascendente ×5 (`f1=f0·5`) del viejo `instrument-note`.
- Los saltos a 2º armónico en arranque/cola de cada tono del testigo son exactamente el
  cambio de DUTY — consistente con pitch fijo, no con un sweep.

El sweep de duty (timbre) queda **→AV, no modelado** (el `OscillatorNode "square"` es duty
fijo 50%). `start`/`step` se conservan en la firma (args ASM) pero no entran en el pitch.

## 2. Tabla cue → veredicto → causa (29 cues)

Leyenda: ✅ sano · 🔧 corregido en esta auditoría · ⚠ →AV/sin testigo (flag).

| cue | primitivo | antes | ahora | testigo | veredicto |
|---|---|---|---|---|---|
| bard-song | 0x2192 | sirena 20Hz + rests 1860ms + 27s | tono fijo, slot 142ms, 7.5s | CAMP_IOLO_MUSICA ✔ + usuario "¡perfecta!" | 🔧 (fix previo) |
| moongate | 0x2192 | sweep 2323→75Hz | **2323Hz fijo** | video-K ✔ ~2000Hz cte | 🔧 validado |
| instrument-note | 0x2192 | chirp ×5 ascendente | **pitch fijo/dígito** | HARPSI ✔ notas estables | 🔧 validado |
| cast-spell | 0x2192 | 4 sweeps | 4 tonos fijos (1811×3,2402Hz) | — | 🔧 ⚠ sin testigo |
| spell-zap | 0x2192 | sweep | 3859Hz fijo | — | 🔧 ⚠ sin testigo |
| sceptre | 0x2192 | sweep | 1595Hz fijo | — | 🔧 ⚠ sin testigo |
| shadowlord-announce | 0x2192 | sweep | 2599Hz fijo | — | 🔧 ⚠ sin testigo |
| ambient-clock-chime | 0x2192 | sweep | 1227Hz fijo | — | 🔧 ⚠ (ambient) |
| shop-transaction | 0x2192 | asc/desc (éxito/fallo) | ambos 906Hz fijo — **distinción éxito/fallo era DUTY** | — | 🔧 ⚠ éxito/fallo IDÉNTICOS ahora (duty→AV) |
| apparition-materialize | 0x2192 | sweep | 1032Hz fijo | CAMP_APARICION (audio mudo) | 🔧 ⚠ testigo inservible |
| apparition-arpeggio | 0x2192 | 3 sweeps | 3 tonos (notas placeholder →AV) | — | 🔧 ⚠ notas →AV |
| apparition-heal-chime | 0x2192 | sweep | 2166Hz fijo | — | 🔧 ⚠ |
| apparition-chord | 0x2192 | sweep | 2166Hz fijo | — | 🔧 ⚠ |
| cannon-fire | 0x43ae glide | 1000→200Hz | (sin cambio) | — | ✅ glissando real correcto |
| combat-escape | 0x43ae glide | 1200→2000Hz | (sin cambio) | — | ✅ |
| ring-vanishes | 0x43ae glide | 1200→2000Hz | (sin cambio) | — | ✅ |
| ambient-clock-tick | 0x22c0 beep | 3000Hz | (sin cambio) | — | ✅ arg=Hz (set_tone) |
| ambient-clock-tock | 0x22c0 beep | 2000Hz | (sin cambio) | — | ✅ |
| move-blocked | 0x22c0 beep | 165Hz | (sin cambio) | — | ✅ beep(0xa5)=165Hz vía set_tone |
| combat-hit/-heavy/-damage/-defeat | 0x223c noise | ruido | (sin cambio) | — | ✅ noiseBurst |
| search-fail / dungeon-trap | 0x223c noise | ruido | (sin cambio) | — | ✅ |
| ambient-fountain | 0x223c noise | ruido | (sin cambio) | ultima_001 (cascada) ✔ familia | ✅ calibrado #72 |
| ambient-waterfall | 0x223c noise | ruido | (sin cambio) | ultima_001 ✔ | ✅ ancla de DELAY_UNIT_MS |
| move-step | 0x223c+0x20c8 | 2 clics + hueco 18.6ms | (sin cambio) | ultima_000 (paso) ✔ 16.8–18.7ms | ✅ walk-sound-verdict |
| quake | 0x223c+0x20c8 | 8 ráfagas + huecos 74ms | (sin cambio) | HARPSI_QUAKE ✔ | ✅ calibrado #29 |

## 3. El OTRO bug (silence ×24) — acotado al bardo, ya cerrado

`silence(count)` aplica el factor ×24 de `delay_via_timer` (inner=C vs sweep inner=C/24).
Es CORRECTO en su contexto (move-step `silence(0x14)`=18.6ms ✔ testigo; quake `silence(80)`
=74ms ✔ testigo). El bardo lo mal-reutilizaba para un REST (que no es un delay_via_timer):
`silence(0x7d0)`=1860ms → cue de 27s. Corregido con `pauseMs()` (slot witness-derived). NO
hay otros usos indebidos del factor ×24 en el catálogo.

## 4. Pendiente (flags para el usuario)

Cues 0x2192 corregidos SIN testigo con audio — suenan ahora a tono fijo (fiel al ASM) pero
sin confirmación espectral del pitch/duración absolutos. Candidatos a pedir captura:
**cast-spell, spell-zap, sceptre, shadowlord-announce, shop-transaction, apparition-***
(el .mov de aparición se grabó con audio mudo). Prioridad: **shop-transaction** — la
distinción éxito/fallo del original es puramente de DUTY (timbre), que no modelamos, así que
ahora ambos suenan idénticos; recuperarla requiere o un modelo de duty (PWM real) o un
testigo para calibrar un proxy (envolvente de amplitud swell/fade). Decisión pendiente del
orquestador: modelar duty (más fiel, más código) vs aceptar el →AV.
