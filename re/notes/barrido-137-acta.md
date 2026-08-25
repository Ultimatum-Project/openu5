# Ficha #137 — el barrido del speaker se calca ENTERO: escalera, corte temprano y la frecuencia que el PIT retiene

Carril fix-137, 2026-08-18. Ejecuta la decisión de la ficha #137: «el barrido del PC
speaker nunca llega a su frecuencia nominal (30/30 sitios) y el port hace rampa limpia:
calcar el barrido REAL + fila de registro». La medición 30/30 es de
`firma-43ae-todos-los-callsites.md` §3 (#83, 09-08); esta acta la re-verifica contra los
`.asm`, deriva dos testigos en detalle, calca la conducta en el port y estampa la fila
§2.10 en `docs/bugs-del-original.md` (y su espejo EN).

## 1. Vigencia del material previo — re-verificada, no citada de oídas

El cuerpo de `pcspeaker_glide`, releído instrucción a instrucción en
`re/disasm/ULTIMA.EXE.asm:7424-7459` (span 0x43ae-0x43ff):

```
43b6  mov ax,[bp+6]        ; paso → [bp-8]
43bc  mov ax,[bp+8]        ; fin
43bf  sub ax,[bp+0xa]      ; fin − inicio
43c2  imul word [bp-8]     ; (fin−inicio)·paso → dx:ax…
43c5  mov [bp-2],ax        ; …pero SÓLO ax se guarda (la parte alta se descarta)
43c8  mov cx,[bp+4]        ; total
43cb  cwd                  ; el signo se re-deriva del low word
43cc  idiv cx              ; incremento = trunc(((fin−inicio)·paso)/total) — hacia CERO
43d1  mov si,[bp+0xa]      ; si = inicio
43d4  sub di,di            ; di = 0
43d8  push si · call 0x22e2   ; set_tone(si) — el tono suena ANTES del incremento
43dc  push 1 · push [bp+6] · call 0x20c8   ; delay(1, paso) — constante por vuelta
43e6  add si,[bp-2]        ; si += incremento
43e9  add di,[bp+6]        ; di += paso
43ec  cmp di,[bp+4] · jl 0x43d8   ; corte FIRMADO contra total — fin NO aparece
43f7  call 0x230e          ; gate OFF (e4 61 / 24 fc / e6 61: and al,0xfc; out 0x61)
```

Las tres propiedades que la ficha nombra, cada una con su instrucción:

1. **Condición de corte**: `di < total` firmado (`0x43ec/0x43ef jl`). `fin` ([bp+8]) no se
   compara NUNCA — sólo entra en la pendiente. Con `total ≤ 0` no hay ni una vuelta
   (el sitio dinámico `DUNGEON.OVL:0x1483` empuja `20 − 8n`: barrido MUDO con n ≥ 3).
2. **Paso/truncado**: el `imul` guarda sólo `ax` (0x43c5) y `cwd` (0x43cb) re-deriva el
   signo del low word; el `idiv` trunca hacia cero. El error se acumula vuelta a vuelta.
3. **La fila de registro**: `set_tone` (0x22e2) hace `div 0x1234DE/freq → out 0x42` ×2 —
   escribe el divisor del PIT canal 2, y ese registro RETIENE lo último escrito hasta el
   gate OFF (0x43f7 → 0x230e). Como el tono de cada vuelta suena ANTES del incremento, el
   **valor final efectivo del divisor** corresponde a `inicio + inc·(vueltas−1)`, jamás a
   la nominal: la última escritura del PIT es la que el jugador oye morir.

Nota del listado: en `0x230d` el desensamblador pierde el sincronismo (`00e4 add ah,ah`);
el stream real en 0x230e es `e4 61 · 24 fc · e6 61 · c3` = leer puerto 0x61, apagar los
bits 0-1, escribir, ret — el gate OFF que cierra todo barrido.

## 2. Los dos testigos, derivados en crudo

**Testigo 1 — `OUTSUBS.OVL.asm:462-470` (@0x0482-0x0492, la catarata):**
push `0x9c4`(2500) · `0x320`(800) · `1` · `0x12c`(300) = glide(2500→800, paso 1, total 300).
`inc = trunc((800−2500)·1/300) = trunc(−5,67) = −5` · vueltas = 300 · último tono
`2500 − 5·299 =` **1005 Hz**. La nominal 800 nunca se escribe: desvío **+205 Hz**, el peor
del corpus.

**Testigo 2 — `MAINOUT.OVL.asm:1745-1753` (@0x112b-0x113b):**
push `0x294`(660) · `0x96`(150) · `0x28`(40) · `0x1e78`(7800) = glide(660→150, 40, 7800).
`inc = trunc((150−660)·40/7800) = trunc(−2,62) = −2` · vueltas = 7800/40 = 195 · último
tono `660 − 2·194 =` **272 Hz**. Nominal 150: desvío **+122 Hz**, más de una octava por
encima de lo pedido — y en escalera GRUESA (195 escalones de paso 40, no rampa).

**El patrón de clase** (mismo cálculo sobre los 7 combos estáticos del censo de #83):
1200→2000 (1,40) acaba en 1980 · 800→2000 (1,50) en 1976 · 1300→300 (5,100) en 350 ·
1000→200 (5,300) en 233 · 750→400 (5,150) en 431 · 400→750 (5,150) en 719 ·
2500→800 (1,300) en 1005 · 660→150 (40,7800) en 272. **0 de 30 sitios alcanzan su
nominal** — coincide con el §3 de la nota previa: vigente.

## 3. El calco en el port

Antes: `game/src/skin/fiel/speaker.ts` `glide()` devolvía `f0→f1` y la síntesis rampaba
(`linearRampToValueAtTime(fin)`) — llegaba a la nominal en los 30 sitios, y en continuo.

Ahora (`speaker.ts:214`, `glide`): la aritmética del cuerpo — producto recortado a 16 bits
con signo del low word, `Math.trunc` como `idiv`, bucle `di < total` con el tono
pre-incremento — produce la escalera entera en `ToneSeg.steps` (`speaker.ts:92`), con
`f1` = frecuencia final EFECTIVA. La síntesis (`speaker.ts:1148-1154`) conmuta un
`setValueAtTime` por vuelta sobre UN oscilador (el gate no se cierra entre vueltas),
equiespaciados (`delay(1, paso)` constante), sin rampa. `total ≤ 0` ⇒ segmento mudo de
0 ms que `scheduleSeg` (`speaker.ts:1106`) no agenda.

**Duración: sin cambio.** vueltas·paso = total en los 30 sitios estáticos (división
exacta en los 7 combos), así que la ley `samplesToMs(total·GLIDE_FACTOR, 1)` da los
mismos ms que antes — las constantes calibradas (`DELAY_UNIT_MS = 0.93`, anclada en
testigos WAV de #72) no se tocan: aquí no había constante nueva que calibrar, la unidad
de la escalera es la MISMA `delay(1, paso)` de la ley vigente, y el aserto de duración
del arnés (`~279 ms` el cañonazo/catarata) pasó en verde ANTES y DESPUÉS del fix.

**Guarda** (`game/tests/glide-escalera-137.test.ts`): esperados EN CRUDO (1005 · 272 ·
233 · 1980 · 1976, derivados a mano en §2, nunca calculados desde el port). Estrenada EN
ROJO contra la rampa (5/6 rojos; el recibido mostraba `linearRamp → 800`, la nominal que
el binario jamás escribe); 6/6 verde tras el calco. Tests viejos que codificaban la rampa
(4 asertos en `fiel-speaker` · `audiodiff` · `waterfall-underworld`) actualizados a los
finales reales con la derivación al lado.

## 4. Fila de registro

`docs/bugs-del-original.md` **§2.10** (+ espejo `docs/publicacion/re-en/…`): bug del
original CALCADO — promesa sin efecto (el `fin` que todos los llamadores empujan y la
rutina jamás compara), grado MEDIDO, con las citas de §1-§2 y el estado del port
verificado en uso. Frase de grados re-derivada: 20 MEDIDO · 31 filas
(`re/tools/test_grados_registro.py` 9/9 verde).

## 5. Lo que esta acta NO hace

- No modela el timbre del escalón (el «clic» de cada reescritura del divisor en el
  hardware real): la conmutación por `setValueAtTime` ya lo aproxima y no hay testigo
  espectral de un glide para calibrar más fino (los candidatos de captura siguen en
  `speaker-audit.md` §4).
- No adjudica si 1988 «quería» el barrido corto: la fila §2.10 lo registra como descuido
  medido y la decisión de calcar viene de la ficha, no de una lectura de intención.
- No toca el sitio dinámico de DUNGEON más allá de calcar su forma (mudo con total ≤ 0):
  el rango real de `n` en ese llamador sigue sin censar, como dejó dicho #83.
