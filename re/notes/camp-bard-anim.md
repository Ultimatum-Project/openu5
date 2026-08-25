# El bardo de guardia TOCA Y SE ANIMA — el eslabón que faltaba, en CMDS.OVL 0x0000

**Pregunta del usuario (ficha #35):** «cuando se hace hole up y hace de guardia Iolo, que se
pone a tocar música, CREO RECORDAR que en el original el sprite de Iolo está animado mientras
toca; ahora el port sale estático». Su frase es una HIPÓTESIS. Este documento la adjudica
contra el binario.

**VEREDICTO: el binario SÍ lo anima.** El recuerdo del usuario es correcto, y además el
easter egg entero —clase 'B', sprite del laúd, canción, reloj congelado— deja de ser
witness-derived: está ESCRITO en el asm, en un sitio donde nadie había mirado.

---

## 0. Por qué se había dado por «no derivable»

`camp-scene-kernel.md §5` concluyó «camp cmd 0x3c9a sólo valida al vigía por ESTADO 'G'
(0x3ec6), NO por clase → no hay easter egg del bardo en el kernel», y §6/§7 dejaron como
**residuo no-bloqueante** «el código NPC/animación que asigna el sprite 0x15c a un actor de
clase 'B'». Las dos afirmaciones son correctas SOBRE `0x3c9a` — que es sólo el COMANDO
(precondiciones + prompt de horas + picker de vigía). El eslabón vive en la rutina de SUEÑO
que 0x3c9a llama después: **`CMDS.OVL` offset 0x0000**, y su prólogo (0x00be-0x01b0) nunca
se había leído entero. `campScene.ts` decía además «NO hay `push 0x15c` en ningún .asm» —
cierto y engañoso: el asm no empuja el TILE, escribe el BYTE `0x5f`, y el compositor le suma
el banco 0x100 al pintar.

## 1. El gate del bardo — CMDS.OVL 0x0113-0x012d (dentro del bucle de roster 0x00be-0x0149)

Por cada miembro `i` (`[bp-0x20]`), con `[bp+6]` = índice del vigía y `[bp+4]` = horas:

```
0105  cmp [bp-0x20], ax / je     ; si i != vigía → 0x0110 call 0xffffa900 (=0x6880)
0110  call 0xffffa900            ;   ★ DORMIR: 0x6880→0x68ae pone [objrec+1]=0x1e (tumbado)
0113  mov bx, [bp-0x34]          ; = 0x55b2 + i*0x20  → LETRA DE CLASE del miembro i
0116  cmp byte ptr [bx], 0x42    ; ★★ 'B' = BARD
0119  jne 0x130
011b  mov ax, [bp+6] / cmp [bp-0x20], ax
0121  jne 0x130                  ; ★★ …y ese i ES el vigía
0123  cmp byte ptr [g_unk_a9ce], 0
0128  je  0x130                  ; ★★ …y el SONIDO está ON (flag global ^S, sfx-catalog §1)
012a  mov ax, [bp-0x24] / mov [bp-4], ax   ; → guarda el SLOT de actor del bardo
```

⇒ Tres condiciones: **clase 'B' · es el vigía · sonido ON**. (`g_unk_a9ce` = flag global de
sonido, ya fichado: `sfx-catalog.md §1`, `dungeon-input-model.md:45` ^S, `kernel-sweep-2/3`.)

## 2. La secuencia de la canción — CMDS.OVL 0x014f-0x01ad

```
014c  call 0xffff9990            ; = 0x5910 redibujo (todos ya dormidos)
014f  cmp [bp-4], -1 / je 0x1b0  ; sin bardo-vigía → se salta TODO esto
0155  si = [bp-4] << 3
015c  al = [si + 0xba18]         ; campo +4 del actor = índice en la tabla 0x5C5A
0160  ax = al << 3 + 0x5c5a      ; objrec = registro de anim del bardo
016c  guarda [objrec+0] y [objrec+1]
017c  mov al, 0x5f               ; ★★★ EL BYTE
017e  mov byte ptr [di+1], al    ;   [objrec+1] = 0x5F   (frame MOSTRADO)
0181  mov byte ptr [bx],   al    ;   [objrec+0] = 0x5F   (base/semilla del programa)
0183  mov byte ptr [0x6a08], 1   ; ★ cursor de la MELODÍA = 1
0188  push 0x34 / 018c call 0x7b66   ; ★ kernel 0x3AE6(52)
018f  restaura los dos bytes
01ad  call 0xffff9990            ; = 0x5910 redibujo (sprite normal de vuelta)
01b0  print DS 0x41d4 "Zzzzzz..."
01ee  ← AQUÍ empieza el bucle de HORAS
```

**El reloj está congelado durante la canción — ASM-confirmado.** La secuencia entera va
ANTES de 0x01b0 («Zzzzzz…») y de 0x01ee (el bucle que llama a `advance_clock`). Lo que el
port modelaba desde el vídeo (`songPhase` con el reloj parado) es exactamente lo que hace el
binario.

Regla de wrap de CMDS (base 0xBF80, `oracle-camp-event.md §aritmética`), cross-validada con
cuatro anclas ya fichadas: `0x8ffc→0x4F7C` advance_clock ✓, `0x617a→0x20FA` delay ✓,
`0x808c→0x400C` ring_regen ✓, `0x6112→0x2092` rand ✓. Por ella `0x7b66 → 0x3AE6`.

## 3. `0x3AE6(n)` = RUN-N-FRAMES (ULTIMA.EXE 0x3ae6-0x3b18)

```
3aed  cmp [g_unk_58a4],0 / je fin      ; gráficos activos
3af9  cmp [bp+4],0 / jle fin
3b07  call 0x5910                      ; ★ REDIBUJO
3b0a  push 1 / call 0x20fa             ; ★ espera 1 tick INT 1Ch (~54,9 ms)
3b11  dec si / jnz 3b07
```
⇒ con `n = 0x34`: **52 × { redibujo + 1 tick }**. (`0x20FA(n)` = instala handler de INT 1Ch y
espera n ticks, 0x2108-0x213f; con n==1 y `[0x5356] ≤ 0xF0` —máquina lenta— se salta la
espera: la tasa por iteración es máquina-dependiente, Clase C.)

## 4. Qué corre DENTRO de cada uno de esos 52 redibujos

`0x5910` (viewport_redraw) llama, por redibujo:
- **`0x4552` (@0x5941)** — el intérprete de bytecode de anim POR ACTOR sobre la tabla 0x5C5A.
- **`0x4102` (@0x5a1a)** — el motor de ambiente/sonido, que en su modo 4 toca la melodía.

### 4a. La ANIMACIÓN (`0x4552`)
```
458c  base = [reg+0] & 0xfc            ; 0x5F & 0xfc = ★ 0x5C
4596  idx = (base-0x34)>>2 = 10 ; progid = [0x1bc8+idx] ; prog = 0x1b18 + progid*16
45d6-45f1  guardas por [reg+1]: 0 / 0x1d / 0x1e → NO anima  (★ por eso los DURMIENTES,
           que llevan 0x1e de 0x68ae, se quedan quietos — y el port coincide)
4611  cmp base, 0x5c / je 0x4630      ; ★★ UNGATED: 0x5C se salta el gate RNG del 50 %
4652  op1-4 → [reg+1] = base + op - 1  ; frames 0x5D, 0x5E, 0x5F
4666  op5  → rand: ≥0x40 (75 %) PC++ (→ byte 0 de fin de prog → op0 → PC=0 → reinicia)
             <0x40 (25 %) [reg+1] = [reg+0] CRUDO (0x467c `mov al,[si]`)
      467f  cmp base,0x5c / je 0x4660 ; ★★ base 0x5C: PC++ y SIN timer de descanso
      4685  resto: timer = 6 y el PC NO avanza
```
`progid` para 0x5C = 0 → programa `02 03 04 05`, leído EN VIVO del mapa 0x1bc8 de la RAM que
corre (`witness-idle-anim-sequences.md §4quater`: «BardPlaying 0x5c … progid 0», 110-199
transiciones en 200 ticks, con testigo AV `juglar-castillo-anim.mov`).

**Pintado:** `0x5394` @0x55f8 empuja `[reg+1]` → `0x51b8` lo guarda en el overlay de actores
0xAC64 → `0x56ac` @0x56e1 `add ah,1` ⇒ **tile = 0x100 + byte**.

⇒ Ciclo visible: **0x15D · 0x15E · 0x15F** (y el 25 % repite 0x15F, porque `[reg+0]` vale
0x5F). **0x15C NO SE MUESTRA NUNCA** en la acampada. Un frame por redibujo (ungated) ⇒
~1 frame por tick, 52 frames.

### 4b. La MELODÍA (`0x4102` → `0x42d2`), en LOCKSTEP con la animación
`0x4102` barre el viewport 11×11 y elige modo por tile (0x41d0 reloj / 0x41df cascada /
0x41ef fuente / **0x4207 `and al,0xfc; cmp al,0x5c` → modo 4**, con precondición 0xab02==0 =
«hay actor»). `0x42d2`: `al = [0x6a48 + [0x6a08]]`; si ≠0 → `sweep([0x6a34+al*2], …)` vía
0x2192; `inc [0x6a08]`, envuelve en 0x35 (=53).

⇒ con el cursor sembrado a 1 (0x0183) y 52 redibujos: se tocan los **índices 1..52** de la
melodía de 53, **una nota por redibujo = una nota por frame de sprite**. La estructura cierra
sola: 52 iteraciones = 52 notas = el cursor vuelve a 0. (Ya fichado: melodía DATA.OVL fo
0x6a58, freqs fo 0x6a44 — `camp-scene-kernel.md §6`.)

## 5. El defecto del PORT, con mecanismo nombrado

1. `coreview.ts::bakeCampArena` **hornea** el tile del bardo en la ventana de TERRENO y NO
   puebla `snapshot.actors` (eso sólo lo hace `bakeMapWindow`, al que la escena sustituye).
2. Sin entrada en `actors`, el bardo no llega al `ActorProgRunner` (el calco de 0x4552) y
   `paintViewportTiles` cae a `animatedFrame(tile, phase, groups, personTurn)`.
3. `tileanim.ts:117`: todo grupo con `base ≥ SPRITE_BANK (0x100)` es **`perTurn`** ⇒ su frame
   avanza con el contador de TURNOS del mundo.
4. Durante la canción el port congela el reloj (fiel al asm, §2) ⇒ **0 turnos ⇒ 0 frames**.

En el original el reloj de mundo parado NO congela el animador de sprites: éste va por
REDIBUJO (§3/§4), y el bucle 0x3AE6 hace 52.

Había además un **defecto latente** en el calco de `0x4552` (`tickProg`): la rama 25 % del
op5 no reproducía el `je 0x4660` de la base 0x5C (PC++), así que el intérprete se habría
clavado en el op5 para siempre. Sin caso vivo hasta ahora (0x5C era la única base afectada y
no se usaba), pero habría congelado al bardo igual.

## 6. Medición VIVA del port (sonda propia, servidor propio :5231, cacheDir propio)

Firma de píxeles de la celda del vigía (6,4) en el canvas de la piel fiel, 60 muestras
cada 60 ms durante la fase canción, con Iolo de guardia:

| celda | ANTES (fix desactivado) | DESPUÉS |
|---|---|---|
| **vigía (6,4)** | **1 firma distinta de 60** | **3 distintas de 60** |
| control+ hoguera (5,5) | 37 / 60 | 35 / 60 |
| control− durmiente (6,6) | 1 / 60 | 1 / 60 |

A/B sobre el MISMO build (sólo se anuló la línea `campBardActor`). El **3** es exactamente lo
predicho por §4a: tres frames visibles (0x15D/0x15E/0x15F), nunca el 0x15C.

🔴 **Trampa que mordió durante la medición:** la primera pasada dio 1/60 CON el fix puesto —
vite servía el módulo desde una caché heredada (`game/node_modules` está symlinkeado al
checkout principal y `cacheDir` cuelga de ahí). La sonda medía el artefacto ANTERIOR. Se
resolvió con `U5_VITE_CACHE_DIR` propio + `--force`; el control positivo (hoguera) NO lo
detectaba porque su animación existía en las dos versiones.

## 7. Qué queda SIN adjudicar (declarado, no rellenado)

> **ADENDA ficha #39 (carril `re/bardo-fino`) — los tres primeros residuos CERRADOS.**
> Ver §8. Lo que sigue es el texto ORIGINAL de #35, conservado porque una de sus tres
> declaraciones estaba MAL ACOTADA y esa es la lección (§8.0).

- **Tasa real por iteración (Clase C).** El asm fija la ESTRUCTURA (52 iteraciones, 1 frame
  y 1 nota cada una) pero no los ms: cada vuelta cuesta `max(coste del redibujo, 1 tick)` y
  el atajo de `0x20FA` (`[0x5356] ≤ 0xF0`) depende de la máquina. El testigo del usuario da
  ~142 ms/índice (53 índices en ~7,5 s, `speaker.ts BARD_SONG_TOTAL_MS`); el suelo del asm
  son 52×54,9 ms ≈ 2,9 s. El port anima al reloj de su animador (~110 ms/llamada,
  `tickAnimClock` fases pares) — no en lockstep exacto con las notas. **Divergencia Clase C
  declarada, no medida contra DOSBox.**
- **La melodía arranca en el índice 1, no en el 0** (`0x0183 mov [0x6a08],1`) y se tocan 52
  de los 53 índices. El cue `bard-song` del port toca los 53. Un índice de diferencia; NO se
  ha tocado el audio en este carril (fuera del encargo, que era el sprite).
- **El gate de SONIDO (`g_unk_a9ce`, 0x0123) no se modela.** En el original, con el sonido
  apagado (^S) el bardo NI toca NI cambia de sprite: se duerme como los demás. El port no
  tiene ese flag global cableado a la escena.
- **Un bardo de taberna EN VISTA también dispararía el modo 4** (el gate 0x4207 es por TILE,
  no por contexto de camp) — ya anotado en `camp-scene-kernel.md §7`, sigue sin portar.

---

# 8. ADENDA #39 — fidelidad FINA: los tres residuos, adjudicados

Encargo: cerrar los tres primeros residuos de §7 **tratándolos como HIPÓTESIS**. Los tres
resultan **DIVERGENTES** y los tres se arreglan aquí. Cada cifra va etiquetada
`[DERIVADO]` (del asm), `[MEDIDO]` (por test/herramienta) o `[CLASE C]` (no derivable).

## 8.0 Lo que la declaración de #35 tenía mal acotado

§7 archivó el lockstep bajo **«Tasa real por iteración (Clase C)»**. Esa etiqueta mezcla
dos cifras que no son la misma:

| cifra | clase | ¿la fija el asm? |
|---|---|---|
| ms por vuelta del bucle | **Clase C** | NO — `0x20fa` se salta la espera con n==1 y `[0x5356] ≤ 0xF0` |
| **frames por nota (el RATIO)** | **DERIVABLE** | **SÍ — 1:1, y no depende de la máquina** |

Al colgar el ratio del adjetivo «Clase C» quedó fuera de sospecha: es Clase C, no se
puede cerrar, siguiente. Es la trampa de `cota-declarada-de-menos-desactiva-la-sospecha`
otra vez, con otra forma: **no una cota numérica corta, sino una CLASE demasiado ancha**
que se traga una cifra que sí era derivable. Un residuo declarado no está acotado hasta
que se mide, y «clasificado» tampoco es «acotado».

## 8.1 Residuo 1 — LOCKSTEP: **DIVERGENTE**, arreglado

**[DERIVADO]** El censo es lo que cierra esto, y es un censo, no un «no encontré otro».
Sobre los **28** `.asm`:

```
$ grep -n "call 0x4552" *.asm     → ULTIMA.EXE.asm:9544   (0x5941)   ← UNA
$ grep -n "call 0x4102" *.asm     → ULTIMA.EXE.asm:9625   (0x5a1a)   ← UNA
```

Las dos, dentro de `0x5910` (viewport_redraw). ⇒ **ninguno de los dos motores tiene reloj
propio**: el intérprete de anim por-actor (el SPRITE) y el motor de ambiente modo 4 (la
NOTA) son hijos del MISMO redibujo. Y el mismo latch los gatea a la vez:

```
5933  cmp byte ptr [0x5891],0 / je 0x5954   ; salta 0x4552
5a13  cmp byte ptr [0x5891],0 / je 0x5a1d   ; salta 0x4102
5a1d  mov byte ptr [0x5891],1               ; y queda a 1 en CADA salida
```

Durante la canción el bucle es `0x3AE6(0x34)`:
```
3b07  call 0x5910          ; redibujo
3b0e  call 0x20fa(1)       ; espera 1 tick
3b11  dec si / jnz 0x3b07  ; ⇒ 52 vueltas
```
⇒ **52 pasos de sprite y 52 notas, intercalados 1:1 dentro del mismo redibujo. Ratio
1.000, ESTRUCTURAL.** (El primer redibujo de la secuencia, `CMDS.OVL 0x014c`, ya dejó
`[0x5891]=1`, así que las 52 vueltas corren las dos llamadas.)

**[CLASE C, sigue abierto]** Los **ms** por vuelta. `0x20fa`: `0x2103 cmp ax,1` +
`0x2108 cmp [0x5356],0xf0` + `0x210e jle 0x2152` ⇒ con n==1 la espera se SALTA en máquinas
con `[0x5356] ≤ 0xF0`. La tasa absoluta no se ha medido contra DOSBox y no la cierra este
carril.

**El defecto del port.** El bardo colgaba de `actorProg`, el runner compartido, a
110 ms (`ANIM_TICK_MS`×2) — que es el modelo del redibujo del **bucle principal**. La
canción no corre en el bucle principal. Contra los ~144 ms/índice de la melodía
(agendada aparte por Web Audio) eso da **[MEDIDO]** ~52 notas contra ~68 frames sobre la
misma fase: ratio ~1,3 y sin fase fija entre sprite y nota.

**El fix.** El bardo sale de `actorProg` y va a `campBardProg`, un `ActorProgRunner`
propio avanzado por `CAMP_BARD_STEP_MS`, que **es** el paso de índice de la melodía —
una sola constante para los dos, así que el lockstep es por construcción y no puede
volver a divergir en silencio. Fuera del bucle de `ANIM_TICK_MS` a propósito:
cuantizarlo a 55 ms metería un jitter que el original no tiene.

- `game/src/skin/fiel/skin.ts` — `campBardProg`, `campBardAccum`, drenaje en
  `tickAnimClock(dtMs)`, ruteo en `buildActorFrames`.
- `game/src/skin/fiel/speaker.ts` — `CAMP_BARD_STEP_MS`.
- `game/tests/camp-bard-lockstep.test.ts` — 7 tests.

**DECLARADO (lo que el fix mueve).** `campBardProg` lleva un `ViewPrng` **separado** del
de `actorProg` (misma semilla, stream propio) ⇒ los draws del gate del bardo dejan de
intercalarse con los de los demás actores. Es **render-RNG, NO `g_rng`**: excluido de la
paridad y del determinismo del Grand Tour por diseño (#17, cabecera de `ActorProgRunner`
en `tileprog.ts`). **El reloj compartido NO se mueve**: ni periodo, ni fase, ni el frame
de ningún otro actor — control negativo explícito en el test (misma `animPhase` con y sin
bardo, y `= floor(7500/55)`).

## 8.2 Residuo 2 — MELODÍA 52/53: **DIVERGENTE**, arreglado

**[DERIVADO]** Cadena completa:
```
CMDS.OVL   0x0183  mov byte ptr [0x6a08], 1   ; cursor SEMBRADO a 1
CMDS.OVL   0x0188  push 0x34 / call 0x7b66    ; = 0x3AE6(52) ⇒ 52 redibujos
ULTIMA.EXE 0x42d8  mov al, [bx + 0x6a48]      ; una lectura por redibujo
ULTIMA.EXE 0x42fe  inc byte ptr [0x6a08]      ; …y un avance
ULTIMA.EXE 0x4302  cmp [0x6a08],0x35 / jb     ; envuelve a 0 al llegar a 53
```
⇒ cursor 1,2,…,52; a la 52ª vuelta el `inc` lo deja en 0x35 → 0. **La acampada toca los
índices 1..52. El índice 0 NO suena NUNCA en la acampada.**

**[MEDIDO] sobre la tabla** (contado, no heredado — ver §8.4): la melodía tiene **53**
índices, **13** rests y **40** notas. El índice 0 vale **1**, o sea una NOTA. ⇒ los
índices 1..52 son **52 slots = 39 notas + los mismos 13 rests**. El port tocaba los 53
⇒ metía **una nota de más A LA CABEZA** (39→40 tonos).

**El fix.** El cue recorre `BARD_MELODY.slice(1)`. **El TOTAL no se toca**: los mismos
7500 ms (**[CLASE C]**, ancla del testigo `CAMP_IOLO_MUSICA.mov`, 6,5–14 s) repartidos
entre 52 slots ⇒ ~144,2 ms/índice en vez de ~141,5. El asm fija el RECUENTO, no los ms.

- `game/src/skin/fiel/speaker.ts` — `BARD_CAMP_MELODY`, `CAMP_BARD_INDEX_COUNT`.
- `game/tests/fiel-speaker.test.ts` — describe nuevo + los 2 asertos que fijaban los 53.

## 8.3 Residuo 3 — GATE ^S: **DIVERGENTE**, arreglado

**[DERIVADO]** La cadena sólo se entiende leyendo las cuatro líneas juntas:
```
CMDS.OVL 0x0010  mov word ptr [bp-4], 0xffff   ; la ranura del bardo NACE a -1
CMDS.OVL 0x0123  cmp byte ptr [g_unk_a9ce], 0
CMDS.OVL 0x0128  je  0x130                     ; SONIDO OFF → no guarda la ranura
CMDS.OVL 0x012a  mov [bp-4], [bp-0x24]         ;   (sólo si pasa las TRES condiciones)
CMDS.OVL 0x014f  cmp word ptr [bp-4], -1
CMDS.OVL 0x0153  je  0x1b0                     ; …y salta POR ENCIMA de TODO
```
El salto de `0x0153` se lleva por delante **tres** cosas, no sólo el audio:
`0x017c-0x0181` el sprite del laúd · `0x0183` la melodía · `0x0188` **la pausa de 52
redibujos**. ⇒ **con ^S apagado el bardo se duerme como los demás y «Zzzzzz…» sale en el
acto** — no hay easter egg, y tampoco hay espera.

**El defecto del port.** No tenía el flag cableado a la escena: sólo el cue se silenciaba
(`speaker.play` retorna si está apagado). Resultado: sprite del laúd, animándose, y el
reloj congelado **7,5 s EN SILENCIO**. Un fix a medias (silenciar el cue y dejar la
escena) es exactamente lo que ya había, y por eso el test lo comprueba por el bucle de
horas y no por el cue.

**El fix.** `CampSleepDeps.soundEnabled: () => boolean` (thunk: el usuario lo alterna en
caliente y `speaker` se declara después en `boot()`), consultado en
`bardEasterEggFires()` junto a las otras dos precondiciones, en el orden del asm.
**NO mueve el RNG**: la fase canción ya era presentación pura (no llama a `game.*`).

- `game/src/ui/camp-sleep.ts` · `game/src/main.ts` (cableado a `speaker.enabled`).
- `game/tests/camp-sleep-unit.test.ts` — 3 tests (con control positivo y negativo).

## 8.4 🔴 Trampa que mordió en ESTE carril

La primera versión del test de #39 afirmaba «38 notas» y «37 al quitar el índice 0».
Las dos cifras son FALSAS: son **40** y **39**. Venían de un informe de exploración que
las daba con tono de medidas, y las copié sin contarlas. **Las cazó el propio
failing-first** (`expected 39 to be 37`) porque el aserto se escribió contra la tabla
además de contra el cue — si sólo hubiera comparado `tones().length` con un recuento
derivado de la misma constante, habría sido circular y las dos cifras falsas habrían
entrado en el acta. Es `medido-e-inferido-en-el-mismo-parrafo` leído desde el otro lado:
una cifra ajena hereda la credibilidad del párrafo que la rodea.

## 8.5 Mutantes (los tests tienen dientes) — **[MEDIDO]**

Cinco mutantes sobre el árbol ya comiteado, revertidos con `git checkout` uno a uno.
Los cinco MUEREN.

| # | mutación | tests que lo matan |
|---|---|---|
| M1 | el cue vuelve a recorrer `BARD_MELODY` (revierte R2) | **7** |
| M2 | `slice(1)` → `slice(0,52)`: recorta la COLA, no la CABEZA | **1** ← el decisivo |
| M3 | fuera `&& soundEnabled()` (revierte R3) | **1** |
| M4b | el bardo vuelve a `animatable` + `actorProg.frameFor` (el arreglo EXACTO pre-#39) | **1** |
| M5 | `CAMP_BARD_STEP_MS = 110` (el paso del reloj compartido) | **4** |

**M2 es el que decide el diseño del test.** Recortar la cola da 52 slots y pasa **todos**
los asertos de recuento (52 slots, 39 tonos, 13 rests, total 7,5 s); lo mata **sólo** el
aserto de la PRIMERA nota (`incToHz(freq[4])` vs `incToHz(freq[1])`). Sin ese
discriminante, «52 slots» no distingue el fix correcto del que rompe la melodía por el
otro extremo — y el fix correcto es el que quita la CABEZA, porque el cursor se siembra
a 1.

🔴 **Y una lección sobre el propio mutante.** La primera versión de M4 mataba **2** tests,
y el segundo kill (`seen.size` = 1, el bardo no animaba) era **un artefacto del mutante,
no una señal**: mi edición dejaba `actorProg.sync(animatable)` corriendo después con
`animatable` vacío, así que borraba el estado del bardo en cada render y lo re-sembraba.
Un mutante que mata **por avería propia** no prueba sensibilidad
(`mutante-mata-por-excepcion-no-prueba-sensibilidad`). Rehecho como **M4b** —el arreglo
literal pre-#39— mata **1** test, y es el estructural: *«el bardo NO cuelga del runner
compartido»*.

**DISCLOSURE de cobertura, por lo mismo:** el test de las *52 pasos* envuelve
`campBardProg.tick()`, o sea mide **el runner**, no el frame renderizado; por eso M4b no
lo mata (bajo M4b ese runner sigue avanzando, simplemente ya nadie lee de él). Quien
guarda el ruteo es el test **estructural**, y es el único que lo guarda. Discriminar las
dos CADENCIAS (110 vs 144 ms) por el frame pintado no es robusto: el programa del bardo
es de 4 ops con una rama al 25 % del PRNG, y los recuentos de transición se solapan.

## 8.6 Qué sigue ABIERTO

- **[CLASE C] Los ms por vuelta del bucle** (§8.1). Sin medir contra DOSBox. Lo que este
  carril cierra es el RATIO, no la tasa.
- **Un bardo de taberna EN VISTA dispararía el modo 4** (gate `0x4207` por TILE, no por
  contexto de camp) — sigue sin portar, como en §7.
- ~~**Contradicción de atribución detectada, NO resuelta:**~~ **✅ ADJUDICADA el 2026-08-05**
  por el carril `re/sfx-bardo` — [`sfx-bardo-adjudicacion.md`](sfx-bardo-adjudicacion.md).
  Enunciado original: `core/sfx.ts:287-288` documentaba el modo 4 como «Codex/estantería
  0x5c–0x5f … NO se porta» con `[0x6a34]` de contador de fase, y este acta (§4b) los
  atribuía al BARDO con `[0x6a34]` de tabla de freqs.
  **Veredicto: NO había una nota mala, había DOS preguntas distintas y cada una se
  contestó bien en un sitio y mal o de refilón en el otro.**
  1. **Los tiles: esta acta acierta, `sfx.ts` se equivocaba.** El gate `0x4207` lee el
     byte de la capa de SPRITES (`0x4200`, puntero `[bp-0x1c]`, stride `0x10` → `[0xac64]`),
     no de la de terreno (`[bp-0x1a]`, stride `0x20` → `[0xab02]`, que exige `==0`).
     Banco alto ⇒ **0x15C–0x15F = BardPlaying1..4**. Los `0x5c–0x5f` de terreno
     (BookcaseLeft/CodexAngel) existen, pero **no son los que este gate ve**.
     `sfx.ts` queda corregido en el mismo commit.
  2. **`[0x6a34]`: las dos lecturas eran ciertas y NO se pisan.** El byte `0x6a34` es el
     contador de fase 0..7 (`0x4327 inc` / `0x432b cmp ,7`) **y** el slot 0 de la tabla de
     freqs contigua — que vale `0x0000` en DATA.OVL y **nunca se indexa**, porque la nota 0
     salta el sweep (`0x42df cmp al,bh` + `je 0x42fe`), así que `bx = nota*2 ≥ 2` y la tabla
     se lee siempre desde `0x6a36`. La frase de §4b (`sweep([0x6a34+al*2], …)`) es el modo de
     direccionamiento LITERAL y es exacta; lo único flojo era llamar «tabla de freqs» a la
     dirección base. Freqs utilizables: `DS:0x6a36–0x6a47` (9 notas).
