# intro-sonidos-220.md — los DOS sonidos de la pantalla de título: el emisor es el DRIVER DE VÍDEO

Carril `intro-sonidos-220` (ficha #220, 2026-08-14). Cierra el cabo que `intro-av-211-derivacion.md
§6` dejó abierto: «identificar el emisor de los dos sonidos de la intro leyendo el preámbulo de
arranque del kernel (candidatos: kernel vs música AdLib)».

**Veredicto: no es ninguno de los dos candidatos.** El emisor es `EGA.DRV` — el driver de vídeo.

Grados: **MEDIDO** = leído en el disasm o en la imagen del binario · **derivado** = inferido de
código leído · **hipótesis** = marcado como tal, sin acreditar.

---

## 1. Por qué el censo de #211 dio CERO y aun así había sonido

`intro-av-211-derivacion.md §4` censó `set_tone`/`beep`/`glide`/`noise_burst` con
`dispatch_table.near_calls_to_kernel` sobre ULTIMA.EXE y los 24 overlays, con 12 sitios de control
positivo disparando, y concluyó: «Con 12 sitios de control disparando, el cero de INTRO/FLAMES es
ausencia real. El emisor vive en el KERNEL (preámbulo de arranque) o en la música AdLib». Añadió
además el control por puerto crudo: «`out 0x42/0x43/0x61` = 13 en ULTIMA.EXE, **0** en
INTRO/FLAMES/FONT».

El censo era **correcto** y su conclusión **falsa**, por POBLACIÓN. Lo que no estaba dentro son los
cuatro **`*.DRV`** (~36 KB), que `intro-ovl-map.md §1.2` lista desde julio como «código real del
juego, **sin RE**». MEDIDO hoy sobre `re/disasm/*.DRV.asm` — los cuatro escriben al altavoz:

| fichero | `in/out 0x61` | `out 0x42` |
|---|---|---|
| `EGA.DRV` | 0x2633 · 0x27b6 · 0x29c8 | 0x27f0 · 0x27f4 |
| `CGA.DRV` | 0x19a7 · 0x1ad7 · 0x1c88 | 0x1b0d · 0x1b11 |
| `HER.DRV` | 0x1d01 · 0x1e6d · 0x2022 | 0x1ea7 · 0x1eab |
| `T1K.DRV` | 0x1245 · 0x13fa · 0x1a7b | 0x127f · 0x1283 |

★★ **La regla que esto deja escrita**: un censo de emisores de sonido cuyo denominador sea «el
kernel y los overlays» no puede refutar la existencia de un emisor — le falta un cuarto del código
ejecutable del juego. El censo de #211 no midió mal: midió una población más pequeña que la
pregunta. La ausencia sólo se comprueba contra la fuente COMPLETA.

🔴 Y el cepo que hace esto invisible: **el kernel no llama al driver por dirección, lo llama por
SELECTOR**. `mov word [0x5350], <sel>` + `lcall [0x5350]`, donde `[0x5352]` es el segmento del
`.DRV` que cargó `0x0e94` (`0x0f03 mov dx,[bx+0x5328]` = tabla de nombres de fichero por modo de
display; `0x0f0c` guarda el segmento). Ningún grep de direcciones de primitiva encuentra eso.

🔴 **Corrección de nombres de dos globales del ledger.** `g_snd_driver_fn` (`0x5350`) y
`g_snd_driver_seg` (`0x5352`) NO son del driver de SONIDO: son el puntero far al driver de VÍDEO.
Quien los cargó fue `0x0e94`, que abre `CGA/EGA/HER/T1K.DRV` según `g_unk_52c8`. La prueba interna
está en el propio corpus: `intro-blit-formats.md` ya llamaba «SEL 0x4b / 0x66 / 0x4e» a los
blitters, y esos selectores viajan por este MISMO par de words. Los nombres se quedan (renombrarlos
mueve el ledger), pero la nota queda: **el sujeto es vídeo, no sonido**.

---

## 2. El emisor: `EGA.DRV:0x27af` — un `noise_burst` PROPIO del driver

Cuerpo leído entero (`0x27af`–`0x282a`), MEDIDO:

```
27af: mov word cs:[0x27ad], 0        ; acumulador = 0
27b6: in al,0x61 ; or al,3 ; out 0x61,al        ; gate ON  (SIN comprobar bandera)
27bc: ax = cs:[0x27a5]                           ; PRNG local del driver
      ax = ((ax + 0x9248) ror 3) ^ 0x9248 + 0x11 ; 0x27c0-0x27cd
      cs:[0x27a5] = ax
27d1: bx = 0x64                                  ; piso del rango
27d4: cx = cs:[0x27a7]                           ; BANDA
27d9: shr cx, 1                                  ; 🔴 LA BANDA SE PARTE POR DOS
27db: cx = cx - bx + 1 ; dx = ax % cx ; dx += bx ; ⇒ valor ∈ [0x64, banda/2]
27e8: dx:ax = 0x001234de ; div cx                ; divisor del PIT
27f0: out 0x42, al ; out 0x42, ah
27f6: ax = cs:[0x1c1e] >> 4                      ; calibración de velocidad
27fe: cx = cs:[0x27ab]                           ; STEP
2803: cs:[0x27ad] += cx                          ; acumulador += step
2808-281d: doble bucle de retardo (cx × ax)
281f: si cs:[0x27ad] < cs:[0x27a9] (DUR) → repite en 0x27bc
282a: ret                                        ; el gate lo cierra el LLAMADOR
```

⇒ es `noise_burst(step = cs:[0x27ab], dur = cs:[0x27a9], band = cs:[0x27a7])`, con los tres
parámetros en variables `cs:` en vez de en la pila. Valores de la IMAGEN del fichero (MEDIDO):
`[0x27a5]=0x7664` (semilla) · `[0x27a7]=0x00f0` · `[0x27a9]=1` · `[0x27ab]=1` · `[0x27ad]=0`.

**Es la misma familia que `ULTIMA.EXE:0x223c`** (mismo esqueleto, mismo PRNG `(x+0x9248) ror 3 ^
0x9248 + 0x11`, mismo `0x1234de/valor` — que es el CONTADOR del PIT, no la frecuencia: ver §6 —,
mismo piso `0x64`) con **dos diferencias MEDIDAS**:

1. 🔴 **`0x27d9 shr cx,1`.** El driver mapea a `[0x64, banda/2]`; el kernel a `[0x64, banda]`
   (`0x226b mov cx,[bp+4]` · `0x226e sub cx,bx`, sin desplazar). Quien copie una banda del driver
   al `noise_burst` del kernel —o al `noiseBurst()` del port, que implementa el convenio del
   kernel— **ensancha el sorteo al doble**. Es el discriminante que la guarda vigila en los DOS
   lados.
2. El PRNG del driver lleva **su propio estado** (`cs:[0x27a5]`, y `cs:[0x28c2]` para el sorteo del
   crepitar). No toca `[0x545c]` ni `g_rng`: **cero impacto en el stream** (derivado — son
   variables `cs:` del `.DRV`, inalcanzables desde el juego).
3. El gate se abre **incondicionalmente** (0x27b6, sin `cmp` previo): el driver no consulta
   `g_unk_a9ce`. La bandera de silencio que sí existe es del propio driver y vive en el LLAMADOR
   (§3).

---

## 3. Sonido 1 — el FIZZLE del dissolve de pantalla (selector 0x66)

**Camino completo, MEDIDO:**

- `INTRO.OVL:show_logo_screen 0x05b0` carga `[0x261e]` = **ULTIMA.16** (el logo gótico) y lo blitea
  (`0x05f7`), y en **`0x060c`** llama `kernel 0x0f46` con `(0, 0, 0x13f, 0x64)`.
- `ULTIMA.EXE:0x0f46` = `gfx_blit_sel66`: `0x0f5b **clc**` · `0x0f5c mov [0x5350],0x66` ·
  `0x0f62 lcall` ⇒ entra al driver con **CF = 0**.
- `EGA.DRV` fn34 (sel 0x66) entra en `0x256b` con `jae 0x2570`: **CF=0 toma la rama del
  DISSOLVE** (CF=1 iría a `0x26b6`, el blit liso). El rectángulo sale de los args:
  `0x2570 sub cx,ax` · `sub dx,bx` · `inc cx` · `inc dx` ⇒ **320 × 101** desde (0,0).
- El revelado es un **LFSR** (`cs:[0x2541]`, taps elegidos por tamaño en `cs:[0x254d]`), un píxel
  por iteración (`0x25c3 call 0x263a`).
- Dentro del plot `0x263a`, la cola:

```
2689: cmp word cs:[0x253d], 0     ; bandera de sonido del driver
268f: je 0x26b0                    ; 0 ⇒ MUDO
2691: xor word cs:[0x253f], 1      ; alterna 0↔1
269d: je 0x26b0                    ; ⇒ suena 1 de cada 2 píxeles
269f: call 0x27af                  ; RÁFAGA (step=1, dur=1 ⇒ UN pulso)
26a2: inc word cs:[0x27a7]         ; y la BANDA sube 1
26a7: mov ah,1 ; int 0x16          ; tecla ⇒ aborta
```

⇒ **una ráfaga de un pulso por cada 2 píxeles revelados, con la banda creciendo de 1 en 1 desde
0xf0**. Es un ruido que arranca casi tonal (sorteo en 20 valores) y se va abriendo: el «fizzle» del
dissolve. `step` vale 1 porque **nadie escribe `cs:[0x27ab]` en todo el driver** (censo con control
positivo: el mismo patrón SÍ encuentra los dos escritores de `cs:[0x27a7]`).

🔴 **La bandera `cs:[0x253d]` arranca en 1 en la imagen del fichero (MEDIDO) y el ÚNICO escritor
del driver la pone a 0**: `0x19d2`, la primera instrucción de fn31 (sel 0x5d, un blit de sprite).
Nada la vuelve a poner a 1. ⇒ **el fizzle es un sonido de ARRANQUE**: existe mientras no se haya
blitteado ningún sprite por sel 0x5d, y después el mismo dissolve queda mudo para siempre. El
ORDEN exacto de la primera llamada a sel 0x5d respecto de `show_logo_screen` **NO está pinneado**
(hipótesis: cae después del título, porque el testigo de audio de #211 sí registra sonido fuerte en
la ventana del logo). Lo que sí es MEDIDO es el mecanismo y su irreversibilidad.

---

## 4. Sonido 2 — el CREPITAR del subtítulo «Warriors of Destiny» (selector 0x69)

**Camino completo, MEDIDO:**

- `INTRO.OVL:show_logo_screen 0x0646` carga `[0x3105]` = **WD.BIT** (la máscara 1bpp del subtítulo)
  y en **`0x0657`** la pasa a `intro_music_cmd 0x20ae`, que hace `ax=[bp+4]` · `0x20b7 **stc**` ·
  `0x20b8 mov [0x5350],0x69` · `lcall` ⇒ driver con **CF = 1**.
- 🔴 **`INTRO.OVL:0x2090`/`0x20ae` NO son «música».** `intro.md §8` los llama `intro_music_start` /
  `intro_music_cmd` y dice «arranca el tema … el mapeo carry→acción vive en el driver». El mapeo se
  ha leído: es el **selector 0x69 del driver de VÍDEO**. `0x2090` (CF=0) es el **avance de UN
  FOTOGRAMA DE FUEGO** del subtítulo y `0x20ae` (CF=1) es **el dissolve del subtítulo entero**. La
  atribución «música» era un nombre puesto sobre `[0x5350]` cuando se creía de sonido (§1).
- `EGA.DRV` fn35 (sel 0x69) entra en `0x282d` con `jae 0x2832`:
  - **CF=0 → `0x2832`**: copia 49 filas × 40 B desde `cs:[si*2+0x72]` con `si = 0x32 ·
    cs:[0x282b]` a VRAM `0xA000:0x0a28`, por los 4 planos EGA, y hace `inc cs:[0x282b]` con wrap a
    4 (`0x28ab cmp …,4`). ⇒ **el ciclo de 4 fotogramas de fuego de 320×49**, que es exactamente lo
    que el port ya tenía extraído como `ultima:1-4` (288×49-50).
  - **CF=1 → `0x28c6`**: guarda el puntero a WD.BIT en `cs:[0x28be]`, reserva 0x7d0 párrafos, copia
    la pantalla y la borra, y llama **DOS VECES** al bucle de dissolve `0x296a`:
    `0x2902 mov cs:[0x28c0],1` · `0x2909 mov cs:[0x28c4],0x190` · `0x2910 call 0x296a`; luego
    `0x2915 mov cs:[0x28c4],0x190` · `0x291c dec cs:[0x28c0]` (→ 0) · `0x2921 call 0x296a`.

★★ **Esas DOS llamadas SON las dos etapas que #211 midió en vídeo** y que el port ya calca
(`titleStage` 1 y 2). El discriminante entre ellas está en el plot `0x2a32`: con
`cs:[0x28c0] ≠ 0` lee la máscara de WD.BIT y hace `not al ; and al,bl` (0x2a64-0x2a69) — es decir,
**etapa 1 pinta el fuego RECORTANDO las letras**; con `cs:[0x28c0] = 0` no recorta nada — **etapa 2
rellena las letras**. #211 lo midió fotograma a fotograma («fuego con las palabras recortadas en
negro» → «letras a blanco») desde el vídeo; aquí sale del código, por otra vía y coincidiendo.

**El emisor**, dentro del bucle `0x296a` (MEDIDO):

```
296e: cs:[0x2541] = 1                      ; LFSR del revelado
2975: cs:[0x2966] = cs:[0x2968]            ; cuenta atrás hasta el próximo tick
297d: ax = LFSR ; div 0x120 (288)          ; ax = fila, dx = columna
2988: cmp ax,0x31 (49) ; jge → sin pintar  ; el rectángulo es 288 × 49
298d: call 0x2a32                          ; pinta el píxel
2990: dec cs:[0x2966] ; jne → sin tick
299f: push cs ; 29a0: call 0x2832          ; ⇒ AVANZA UN FOTOGRAMA DE FUEGO
29a3: sub word cs:[0x28c4], 3              ; el umbral BAJA de 3 en 3
29a9: ax = cs:[0x28c2] ; 29ad: and ax,0x1ff
29b0: cmp ax, cs:[0x28c4] ; jge 0x29d3     ; ⇒ NO suena este tick
29b7: mov word cs:[0x27a7], 0xbb8          ; band = 3000
29be: mov word cs:[0x27a9], 0x19           ; dur  = 25
29c5: call 0x27af                          ; RÁFAGA
29c8: in al,0x61 ; and al,0xfc ; out 0x61,al  ; gate OFF
29f1: mov ah,1 ; int 0x16                  ; tecla ⇒ aborta (stc)
2a03-2a16: PRNG del driver avanza (cs:[0x28c2])
```

⇒ cada `cs:[0x2968]` píxeles revelados hay un TICK que (a) avanza el fuego y (b) emite
**`noise_burst(step = 1, dur = 0x19, band = 0xbb8)`** si el sorteo `(prng & 0x1ff) < umbral`.

- `cs:[0x2968]` = **0x80** en la imagen (MEDIDO), y `0x28d3` lo sube a **0x100** cuando
  `cs:[0x1c1e] < 0xfa` (máquina lenta) — `0x28ca cmp cs:[0x1c1e],0xfa` / `0x28d1 jge`.
- El umbral arranca en **0x190 (400)** de 512 y baja **3 por tick**, y se **reinicia en cada
  etapa**. ⇒ el crepitar es **denso al principio de cada etapa y se ralea**: a 78 % de los ticks al
  abrir, a ~14 % al cerrar (288×49 / 0x80 ≈ 110 ticks por etapa; derivado).

★ Esto explica sin fabricar nada el reparto de energía que #211 midió: el crepitar «corre por las
DOS etapas (dentro de ~2 dB)» porque el umbral se reinicia en las dos, y cada etapa lleva su propia
decrescendo.

---

## 5. Adjudicación del testigo de audio de #211

#211 midió sobre `intro-detalles-audio-2026-08-13.mov` (material EA, gitignored): ventana LOGO
(2,85–5,60 s) **+45,1 dB** en 3-8 kHz, y las dos ventanas de subtítulo **+14,6 / +16,6 dB**.

- Las **dos ventanas de subtítulo** casan con el crepitar de §4: sostenido, presente en las dos
  etapas, moderado. **Atribución firme.**
- La ventana **LOGO** es **AMBIGUA y así se declara**: su intervalo (2,85–5,60) fue elegido por el
  analista y cruza la frontera entre el dissolve del logo (1,217→4,167) y el arranque de la etapa 1
  del subtítulo (4,217→). Los dos candidatos son emisores REALES y los dos son fuertes justo ahí:
  el fizzle de §3 (una ráfaga cada 2 píxeles = miles) y el primer tramo del crepitar, que es su
  momento más denso. **No se adjudica de oído**: haría falta re-medir con ventanas alineadas a los
  fotogramas del dissolve, o un testigo con el sonido del driver desactivado. Marcado hipótesis.

---

## 6. Qué se cabló en el port, y con qué grados

| cue | parámetros | grado |
|---|---|---|
| `title-fizzle` | `noise_burst(1, 1, banda)` con `banda = 0xf0 + nº de ráfagas`, 1 ráfaga / 2 px | MEDIDO |
| `title-crackle` | `noise_burst(1, 0x19, 0xbb8)`, 1 tick / 0x80 px, umbral 0x190 − 3·k sobre 512 | MEDIDO |

Constantes en `game/src/skin/fiel/introAnim.ts` (módulo puro), cues en
`game/src/skin/fiel/speaker.ts`, emisión colgada del MISMO contador del dissolve en
`game/src/ui/faithful-intro.ts` (`tickTitleSound`) — que es como el original los engancha: el
emisor vive DENTRO del bucle de revelado, no en un reloj aparte.

**Aproximaciones DECLARADAS (no derivadas, y por qué):**

1. **Agrupación del fizzle.** El original programa el PIT una vez por ráfaga (~8.000 en el logo).
   El port emite un `noiseBurst` de `TITLE_FIZZLE_BURSTS_PER_CUE = 64` pulsos por grupo: el NÚMERO
   TOTAL de pulsos y su cadencia quedan exactos (la guarda lo asierta), y lo que se cuantiza es la
   banda, que dentro de un grupo sube 64 sobre un recorrido de miles.
2. **Muestreo del PRNG del crepitar.** El original avanza `cs:[0x28c2]` una vez por iteración del
   LFSR; el port lo avanza una vez por tick. Conserva la LEY DE DENSIDAD (el umbral decreciente,
   que es lo audible) y no la secuencia exacta.
3. **Población del dissolve.** El port revela los píxeles OPACOS del asset; el original revela el
   rectángulo completo (320×101 el logo, 288×49 el subtítulo). Afecta al total de ráfagas, no a su
   ley.
4. **La bandera `cs:[0x253d]`** (§3) NO se modela: el port emite el fizzle siempre en el título.
   Modelarla exige pinnear el orden de la primera llamada a sel 0x5d, que no está hecho.

~~🔴 **CABO NUEVO, medido aquí y NO tocado** — `noiseBurst()` del port usa el valor sorteado **como
Hz directamente**; el binario lo programa como **DIVISOR del PIT** (`0x1234de / valor`). Las dos
leyes son monótonas pero **INVERSAS**, así que la relación banda→timbre está invertida respecto al
binario en los ~20 cues de ruido que ya existían (y la prosa de `sfx-catalog.md §3.4` — «band 25000
= crepitación muy aguda» — describe el modelo del port, no el del binario: con el divisor, banda
25000 da frecuencias de 48 Hz hacia arriba, o sea GRAVE).~~

✅ **RETIRADO — la ficha #254 lo midió y es FALSO.** El valor sorteado sí es el *divisor* de la
`div` de `0x2281` (y de `0x27ee` en el driver), pero el **dividendo `0x1234DE` = 1.193.182 = el
reloj de entrada del 8253**, así que el cociente es el **contador** que se escribe en el canal 2
(`0x2283 out 0x42,al` · `0x2285 mov al,ah` · `0x2287 out 0x42,al`) y la frecuencia emitida es
`reloj / contador` = **el valor sorteado**. Las dos leyes COINCIDEN; «`0x1234de/valor`» es el
contador, no la frecuencia. La prosa de `sfx-catalog.md §3.4` («band 25000 = crepitación muy
aguda») era **correcta** y queda respaldada por la derivación.

**Lo que sí había** (y #254 arregla en el mismo commit): un **off-by-one en el módulo**. El binario
hace `sub cx,bx` seguido de `inc cx` (`0x226e`/`0x2270`) ⇒ el sorteo cubre `[0x64, band]` cerrado
por arriba; `noiseBurst()` usaba `band-0x64` y nunca emitía el valor más alto de la banda.

**Y la CUANTIZACIÓN del contador, calcada por decisión del lead (#254-bis).** El contador que sale
del `div` es ENTERO, así que el 8253 no emite `v` exacto sino `reloj / floor(reloj / v)`. Es la ley
EXACTA del original y cuesta una línea (`pitHz` en `speaker.ts`), así que se calca en vez de
declararse como aproximación. Cota MEDIDA: 0,165 % hasta 2 kHz · 0,832 % a 10 kHz · 1,692 % a
20 kHz · **2,127 % a 25 kHz** (peor caso `v=24858` → contador 47), por debajo de un cuarto de
semitono. ⚠ **El techo de una banda pasa a ser `pitHz(band)`, no `band`**: la cuantización puede
empujar la emitida un pelo por encima del sorteo (+0,10 % en banda 2000), y los seis asertos de
rango de los tests se anclan en `pitHz(band)` en vez de en una tolerancia a ojo.
Dato de escucha, medido con el generador A/B: en **2 de 10** cues del muestrario (`move-step` y
`field-afflict`) el WAV sale **byte-idéntico** pese a moverse TODAS sus frecuencias — duran 1,45 y
2,91 ms y el desplazamiento sub-Hz no mueve ni una muestra de 16 bits. «Suena igual» y «no se
aplicó» son cosas distintas: el control que las confundió abortó acusando al fix, y se corrigió
para preguntar por la LEY (las frecuencias) y reportar el silencio del render aparte.

**La lección de esta entrada, que es por lo que se conserva tachada en vez de borrarse:** «el valor
es el divisor» era VERDAD, y la conclusión que se sacó de ella, falsa — porque el sujeto de la
división no es el que la frase sugiere. Un literal se descodifica (¿qué ES `0x1234DE`?) antes de
teorizar sobre el papel que juega. Guarda con control negativo —la ley invertida tiene que FALLAR—
en `game/tests/intro-sonidos-220.test.ts` §#254; y ojo, el predicado ingenuo del viaje de ida y
vuelta por el PIT es un **punto fijo** de la ley invertida, o sea que habría pasado VERDE.

**Guarda**: `game/tests/intro-sonidos-220.test.ts` — 10 asertos, todos RE-EXTRAYENDO de
`re/disasm/EGA.DRV.asm` y `re/disasm/ULTIMA.EXE.asm` (ninguna cifra copiada a mano). Mutantes
corridos de verdad, los cuatro ROJOS y el control VERDE:

| mutante | resultado |
|---|---|
| quitar el `>> 1` del crepitar | 1 fallo |
| `THRESHOLD_STEP` 3 → 0 (umbral que no decae) | 2 fallos |
| `SUBTITLE_CRACKLE_BAND` 0xbb8 → 0xbb9 | 1 fallo |
| `PIXELS_PER_BURST` 2 → 1 | 1 fallo |
| control restaurado | 10/10 verde |

---

## 7. Correcciones a notas previas (registrar en el ledger)

1. **`intro-splash-anim-audit.md §3`** («SONIDO del arranque — NO hay cue de speaker derivable»,
   con el veredicto «NO se cabla ningún cue: sería fabricar»): la CAUTELA era correcta con lo que
   se sabía, pero la premisa «no existe emisor derivable» es **falsa** — el emisor existe y está
   derivado aquí. Su punto 2 («FLAMES.OVL = 831 B, CERO speaker») y su punto 3 («INTRO.OVL = CERO
   llamadas de speaker») **siguen siendo ciertos**: el sonido no sale de ahí. Lo que falla es el
   salto de «no está en estos tres ficheros» a «no es derivable».
2. **`intro-av-211-derivacion.md §4/§6`**: «El emisor vive en el KERNEL (preámbulo de arranque) o
   en la música AdLib — sin identificar, ficha #220» ⇒ **ninguna de las dos**: vive en `EGA.DRV`.
   El cepo que la propia nota dejó avisado («los overlays no llaman a las primitivas por su
   dirección de kernel — van por thunk local; un censo por dirección dará CERO SIEMPRE») es de la
   MISMA familia que el de aquí, un escalón más arriba: el kernel tampoco llama al driver por
   dirección, va por selector.
3. **`intro.md §8`** («Música / sonido — dos entradas al driver de sonido, función 0x69»):
   `0x2090` y `0x20ae` son **selector 0x69 del driver de VÍDEO** — avance de fotograma de fuego y
   dissolve del subtítulo. La nota se cubría con «no derivo el opcode del driver (es otro binario)»;
   el opcode está derivado ahora. Su §3 (rama WD.BIT) acertaba de pleno al llamar a `0x20ae` «el
   motor del subtítulo/música del cartón — el mismo que anima el "Warriors of Destiny" en llamas»:
   es exactamente eso, sin la mitad de «música».
4. **Globales `g_snd_driver_fn` / `g_snd_driver_seg`** (`0x5350`/`0x5352`): el sujeto es el driver
   de **vídeo** (§1). No se renombran en este carril (mueve el ledger); queda la nota.
5. **`sfx-catalog.md §0`** («el timbre exacto NO es derivable del estático → AV») sigue en pie para
   las primitivas del kernel; para estas dos el argumento es el mismo (`cs:[0x1c1e]` es calibración
   de runtime), y lo que sí queda fijado son los PARÁMETROS.

---

## 8. Cabos declarados

- La ventana LOGO del testigo de #211 no está adjudicada entre los dos emisores (§5).
- El orden de la primera llamada a sel 0x5d respecto del título — decide si el fizzle suena en el
  logo o ya está apagado (§3).
- `CGA/HER/T1K.DRV` tienen la misma familia de emisores en otras direcciones (§1) y **no** se han
  leído: si alguna vez se modela el modo de vídeo, sus parámetros pueden diferir.
- ~~El mapeo valor→frecuencia del `noiseBurst()` del port, invertido respecto al binario (§6).~~
  **CERRADO por #254: no estaba invertido** — el cociente de `0x1234DE/valor` es el contador del
  PIT y la frecuencia emitida es el valor. Lo que sí se arregló fue el off-by-one del módulo (§6).

## Apéndice — reproducción

```
# los cuatro drivers escriben al altavoz (el censo que a #211 le faltó):
for f in EGA CGA HER T1K; do echo -n "$f "; grep -cE "out 0x(42|61)" re/disasm/$f.DRV.asm; done
# el emisor y sus dos llamadores:
grep -nE "^(27af|27d9|269f|26a2|29b7|29be|29c5):" re/disasm/EGA.DRV.asm
# el discriminante contra el kernel (el kernel NO parte la banda):
grep -nE "^(226b|226e|2270):" re/disasm/ULTIMA.EXE.asm
# la guarda:
( cd game && npx vitest run tests/intro-sonidos-220.test.ts )
```
