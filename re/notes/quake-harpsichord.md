# Terremoto — clavicémbalo (caja de sándalo) + palabra de poder (task #29)

Sacudida de pantalla que acompaña a la apertura del muro secreto del clavicémbalo en el
Castillo de Lord British, y —por testimonio del usuario— a la rotura del sello de una
mazmorra con su Palabra de Poder. Derivación: **testigo (autoridad de dinámica visual) +
asm del disparador**.

Testigo: `original/av-referencia/video-harpsichord/HARPSI_SANDALWOOD_QUAKE.mov`
(43.26 s, 120 fps, 1274×766, con audio). Mediciones por phase-correlation a resolución
completa (scratchpad, no versionado).

---

## 1. Qué pasa en el vídeo (reconstrucción por consola + viewport)

1. La party está SENTADA al clavicémbalo (LB castle, planta 2) tocando dígitos → notas.
2. En **t≈26.48 s** completa la melodía secreta `6 7 8 9 8 7 8 7 6 7 6 5 3`:
   - el **muro** de la fila superior se abre a un **pasadizo** vertical de ladrillo,
   - y **simultáneamente** arranca la **sacudida** de la ventana de juego.
3. La party sube por el pasadizo (North×n → "Blocked!"), hace **Get-East → "A sandalwood
   box!"** (t≈31.5 s): la caja se OBTIENE con (G)et, no la "revela" el terremoto — el
   terremoto sólo abre el MURO; la caja ya estaba tras él.

Nota: en ESTE testigo la sacudida ocurre en el clavicémbalo. El testigo de dungeon-word
(INFAMA → Shame) llegó aparte y CONFIRMA la misma sacudida — ver §4 (task #36).

---

## 2. Dinámica MEDIDA de la sacudida (autoridad)

Ventana activa **26.483 s → ~27.35 s** (phase-correlation del área de juego vs frame de
reposo; sub-píxel por parábola):

| Propiedad | Medida | Notas |
|---|---|---|
| Eje | **VERTICAL puro** | dx ≡ 0 en todos los frames |
| Alcance | **sólo la ventana 11×11** | HUD y marco/borde con dy≡0, dx≡0 → NO es shift de start-address de CRTC (que movería TODO); es un **re-blit del viewport** con offset |
| Amplitud | **+8 px de captura** = 8·(200/766) ≈ **2 px EGA** | hacia abajo desde el reposo |
| Forma | **onda cuadrada** | offset a tope ~0.042 s, reposo ~0.075 s |
| Periodo | **~0.117 s (~8.5 Hz)** | 14 frames @120 fps entre flancos |
| Nº pulsos | **8** | flancos 0→+8 contados |
| Duración total | **~0.85–0.94 s** | |
| Muro↔sacudida | **coinciden** | el flip del tile y el onset de la sacudida arrancan en el mismo frame (t≈26.48) |

Sonido (misma ventana): **rumble grave**, pico ≈**106 Hz**, energía concentrada en
0–500 Hz (−9 a −11 dB), cayendo >2 kHz; envolvente **pulsada** (~sincronizada con los
pulsos visuales). PC-speaker; nunca música de fondo.

---

## 3. ASM del DISPARADOR (clavicémbalo) — TOWN.OVL 0x0E34

Handler del clavicémbalo (`re/disasm/TOWN.OVL.asm`). Rama de melodía COMPLETA:

```
0e85: cmp byte [0x2767], 0xd     ; ¿13 aciertos?  (0x2767 = progreso del matcher)
0e8a: jne 0xef9
0e8c: mov byte [0x2767], 0       ; reset del matcher
0e90: cmp byte [g_location], 0x11 ; Castillo de Lord British
0e95: jne 0xef9
0e97: cmp byte [g_floor], 2       ; planta 2
0e9c: jne 0xef9
0e9e: xor byte [0x67b9], 0xb      ; MURO→PASADIZO: tile (17,13) 0x4F StoneBrickWall → 0x44 BrickFloor
0ea3: call 0xffffaea2            ; <-- TERREMOTO (rutina kernel COMPARTIDA @0xaea2)
0ea6: mov byte [g_unk_24e6], 1    ; flag de turno
0eab: jmp 0xef9
```

La nota (cualquier dígito) suena en `0e59-0e6d: call 0xffff9fc2` con la tabla `DS:0x2746`
(cue `instrument-note`).

**`call 0xffffaea2` = rutina kernel COMPARTIDA @0xaea2**: el MISMO destino lo llama
`MAINOUT.OVL:0x0a7d` — que resulta ser el **TERREMOTO ALEATORIO AMBIENTAL** (ver §4b). Es,
pues, una primitiva reutilizada (redraw+sacudida) con ≥2 usos confirmados. **RESUELTO**
(task #30, `overlay-load-layout.md`): TOWN/MAINOUT son nivel-1 (near_call_base 0x81d0), así
que `0xaea2 → CS (0x81d0+0xaea2)&0xffff = 0x3072` en el RESIDENTE = `ULTIMA.EXE.asm` label
`3072:` (byte crudo file 0x3872). Su contenido lo CONFIRMA: bucle `si=8..0xB3 step 3` que
re-blitea tiras (`call 0x71ca`, la sacudida) + emite tonos de frecuencia aleatoria
(`call 0x2092` rand → `call 0x22e2` beep, el rumble) — exactamente el testigo de §2.

---

## 4. ASM del segundo disparador (palabra de poder) — CMDS.OVL 0x12C8 · ✅ CONFIRMADO (testigo + asm, task #36)

Testigo (task #36): `original/av-referencia/video-quake/DUNGEON_WORD_QUAKE_INFAMA.mov`
(24.15 s, 120 fps, 1274×766, con audio). La party mira al norte la "collapsed entrance to
the dungeon Shame", grita **INFAMA**, y la pantalla **TIEMBLA en el overworld** mientras
imprime "A word of power is uttered" (luego entra a la mina). Medido por phase-correlation
del viewport (scratchpad, no versionado):

| Propiedad | Medida (dungeon-word) | vs clavicémbalo (§2) |
|---|---|---|
| Eje | **VERTICAL puro** (dx≡0.01 px) | idéntico |
| Amplitud | **+7.98 px captura = 2.08 px EGA** hacia abajo | idéntico (2 px) |
| Forma | **onda cuadrada** (0 ↔ +8) | idéntico |
| Nº pulsos | **8** (flancos 488,502,516,531,545,559,572,587 @120 fps) | idéntico (8) |
| Periodo | **14 frames = 0.117 s (~8.5 Hz)** | idéntico |
| Duración | **~0.88 s** (onset f488 t=4.067 s → reposo f594 t=4.95 s) | idéntico (~0.85–0.94) |
| Alcance | **sólo la ventana 11×11** (HUD/marco quietos) | idéntico (re-blit) |
| Rumble | peak **108 Hz**, 0–500 Hz = 0.41 de energía, pulsado, onset audio t≈4.044 s (simultáneo al visual) | idéntico (106 Hz) |

**Es la MISMA primitiva @0xaea2/kernel 0x3072, sin diferencias medibles.** Timing: la
sacudida arranca ~0.1 s (un periodo de pulso) después de que aparezca el texto "A word of
power is uttered" (f476 t=3.967 s), **en el overworld al proferir la palabra — NO al entrar
a la celda** (la entrada a la mina ocurre ~6 s después). No hay flip de tile visible en el
overworld (el sello se togglea en el tile de entrada al que la party luego pisa; el diff
antes/después sólo muestra la animación del agua y el sprite del avatar).

### El disparador en el ASM (RESUELTO — el §4 anterior miraba la ventana equivocada)

El handler completo es `cmd_yell_overworld` = **CMDS.OVL 0x12c8** (no sólo 0x13bd-0x13e2):

```
12df: (bucle si=0..7) call 0xffffaf9e  ; casa lo gritado vs tabla de 8 palabras DS 0x4502
12ea: cmp ax, 0xffff / jg 0x12f2       ; ax>=0 = palabra de poder RECONOCIDA
12f2: mov ax, 0x44d7 / push / call 0x58d0 ; print "\nA word of power is uttered\n" (DS 0x44d7)
12f9: call 0x70f2                       ; <-- TERREMOTO (misma sacudida+rumble)
  ... 12fc-13bb: determina dirección + adyacencia de la mazmorra casada (si) ...
13bd: xor byte [si+0x58d0], 0x80        ; (sólo si adyacente) togglea el bit de sello
13d5: call 0x8482                       ; get-tile-ptr de la entrada
13e0: xor byte [bx], al                 ; transforma el tile de entrada (cosmético)
13e2: or byte [g_unk_24e6], 2           ; (sólo si adyacente) cobra turno
1408: mov ax, 0x44f4 / call 0x58d0      ; (si bp-6==0) print "\nNo effect!\n" (DS 0x44f4)
```

**`12f9: call 0x70f2` ES la sacudida.** El §4 anterior falló por dos motivos: (a) sólo
inspeccionó la ventana estrecha 0x13bd-0x13e2 (el toggle del sello), no la cabecera del
handler; (b) buscó el operando `0xaea2` (el de TOWN/MAINOUT), pero **CMDS.OVL es nivel-3
con near_call_base 0xbf80** (no 0x81d0), así que el operando al MISMO kernel de terremoto es
otro: `(0xbf80 + 0x70f2) & 0xffff = 0x3072`. Comprobación cruzada con una call conocida del
mismo handler: `13d5: call 0x8482 → (0xbf80+0x8482)&0xffff = 0x4402` = get-tile-ptr, y
`12f6/140c: call 0x58d0 → 0x1850` = print (dos usos con string distinto). La base 0xbf80
queda validada → 0x70f2→0x3072 es de fiar. **QUINTO caller confirmado de @0x3072**
(clavicémbalo TOWN 0x0ea3, underworld aleatorio MAINOUT 0x0a7d, y ahora yell CMDS 0x12f9).

**Semántica confirmada:** el terremoto se dispara al **reconocer CUALQUIER Palabra de Poder
válida** (0x12ea `jg`), justo tras el mensaje "uttered" (0x12f2) y **ANTES** de la lógica de
adyacencia del sello → **NO depende de que se abra una mazmorra**. Gritar una palabra válida
sin entrada adyacente igual sacude (y luego imprime "No effect!"). El recuerdo del usuario
era exacto; la §4b (terremoto aleatorio del underworld) es un fenómeno DISTINTO y adicional,
no la explicación de éste.

### Puerto (task #36) — presentación pura, sin gate de paridad

`game.ts::yellWord` emite el `quake`+`sfx("quake")` cuando `res.uttered` (palabra válida),
en el ORDEN fiel: mensaje "uttered" → quake → posible "No effect!" (0x12f2 → 0x12f9 → 0x1408).
Antes sólo disparaba en `res.opened` (under-fire: no sacudía si no había mazmorra adyacente).
`quest/words.ts::YellWordResult` gana el campo `uttered`. El quake es presentación pura (el
kernel 0x3072 no toca el `g_rng` de gameplay — ver §4b, paridad byte-idéntica sin gate) →
**sin gate de paridad**. Tests: `yell-dungeon-seal.test.ts` (quake en abrir Y en válida-sin-
adyacencia; orden fiel uttered→quake→No effect; inválida no sacude). El ⚠ del cableado se
retira: ahora está **calibrado por testigo + citado en asm**.

---

## 4b. TERCER uso (CONFIRMADO por asm): terremoto ALEATORIO del UNDERWORLD — MAINOUT.OVL 0x0A60

Función leaf `MAINOUT.OVL 0x0a60-0x0a83` (llamada desde 0x0cd0, dentro del handler de turno
0x0a84; vecina de mensajes por-turno como "Zzzzzz..."/"What?"). MAINOUT es el motor OUTDOOR
(superficie de Britannia = floor 0, **Underworld = floor 0xFF**); los pueblos/mazmorras usan
TOWN/DUNGEON. Así que `g_floor≠0` aquí = **el Underworld**, no las mazmorras:

```
0a60: cmp byte [g_floor], 0    ; SÓLO Underworld (floor 0xFF); en superficie NUNCA
0a65: je   0xa83
0a6e: call 0xffff9ec2          ; rand_range(0,255)  (kernel rand, consume g_rng)
0a71: cmp  ax, 0x69            ; == 0x69 → 1/256 por turno
0a74: jne  0xa83
0a7a: call 0xffff9680          ; print "EARTHQUAKE!\n"  (DS 0x2b1d = data.json pool7[227])
0a7d: call 0xffffaea2          ; MISMA sacudida+rumble @0xaea2
0a80: call 0xffffa8d8          ; party_random_damage (rand(1,8)/miembro) = kernel 0x2AA8
0a83: ret
```

**terremoto aleatorio 1/256 por turno en el Underworld**: imprime "EARTHQUAKE!", sacude la
pantalla (misma primitiva @0xaea2) y **daña a la party** (rand(1,8)/miembro).

### AUDITORÍA del port (task #31) — SIN divergencia de RNG; el hueco era presentación

El port YA modelaba este camino: `game/src/core/world/loops/hazards.ts::underworldHazard`
(MAINOUT 0x0A60) consume SIEMPRE `rand(0,255)` en floor≠0 (línea `const roll = rand(0,255)`)
y en 0x69 aplica `partyRandomDamage` (kernel 0x2AA8, el `call 0xffffa8d8` de 0x0a80). Es
decir: **el `rand(0,255)` YA se consume cada turno de underworld** → cero divergencia de RNG.

**¿Por qué la paridad está verde? Legítimamente**, con cobertura real de floor≠0:
- `re/parity/loops/outdoor-underworld-night.json` y `spawn-pick-underworld.json` ejercen
  turnos de underworld (incluida la tirada del hazard) contra el oráculo.
- `game/tests/loops.test.ts` unit-testea `underworldHazard` (0x69 → dispara + daño;
  0x68 → no; floor 0 → no consume RNG).
NO era un hueco de cobertura: el stream se compara y es byte-idéntico.

**El hueco REAL era de PRESENTACIÓN**: `underworldHazard` devolvía `boolean` y `game.ts`
guardaba `res.hazard` pero **nunca lo surfaceaba** → el terremoto disparaba SILENCIOSO (se
cobraba el daño sin "EARTHQUAKE!" ni sacudida). Bug de fidelidad, no de RNG.

### Implementación (task #31) — presentación PURA

`game.ts` (rama `loc===0`, tras `outdoorTurn`): si `res.hazard`, emite
`{message:"EARTHQUAKE!\n"}` (`EARTHQUAKE_MESSAGE`, byte-exacto de pool7[227]) +
`{kind:"quake"}` + `sfxEvent("quake")`, ANTES del housekeeping (orden fiel: 0x0a7a antes de
0x0cd3). NO toca RNG (la tirada y el daño ya ocurrieron en `underworldHazard`) → **paridad
byte-idéntica, sin gate**. La piel ya reacciona al evento `quake` (§5, de #29). Test:
`game/tests/underworld-earthquake.test.ts` (semilla viva 4280 dispara → mensaje+quake+sfx en
orden; floor 0 con las mismas semillas jamás dispara — gate `g_floor≠0`).

Uso adicional de la primitiva 0x3072 (clavicémbalo + terremoto de underworld). Nota: el
terremoto de underworld es un fenómeno DISTINTO del de dungeon-word (§4, ya confirmado por
testigo) — coexisten, no se explican mutuamente.

---

## 5. Puerto (skin + core)

- **Core** (`game.ts`, presentación pura — sin RNG/estado):
  - `playHarpsichordNote` (complete, LB f2): empuja `{kind:"quake"}` + `sfxEvent("quake")`
    junto al `map-changed` existente. Espejo de TOWN 0x0e9e-0x0ea6.
  - `yellWord` (rama `res.uttered`, CUALQUIER palabra válida): empuja `{kind:"quake"}` +
    `sfxEvent("quake")` en orden fiel (uttered→quake→No effect). CONFIRMADO testigo+asm (§4).
  - `GameEvent.kind` gana `"quake"`; `SfxId` gana `"quake"` (`core/sfx.ts`).
- **Skin fiel** (`skin/fiel/quake.ts` + `skin.ts`): `QuakeShake` (calco de `ApparitionFlash`).
  `onTurn` con un `quake` → `trigger(now)`; el rAF mantiene el repintado mientras
  `quake.active`. `paintQuakeShift` re-blitea la ventana 11×11 (VIEWPORT 8,8 · 176×176) a
  `+QUAKE_AMPLITUDE_PX` px, recortada a su rect, con el borde superior a negro. Sólo mueve
  la ventana (marco/HUD quietos, §2). Constantes derivadas del testigo:
  amp=2 px, 8 pulsos, down≈42 ms / up≈75 ms (periodo ≈117 ms).
- **Sonido** (`skin/fiel/speaker.ts`): `quake` = 8× `[noiseBurst(1,720,520), silence(80)]`
  (rumble 100–520 Hz pulsado ~116 ms/pulso). Params acústicos ⚠ Clase C, calibrados al
  espectro del testigo (§2); el kernel @0xaea2 no está resuelto.

Verificación: 1638 unit verdes (incl. `quake.test.ts` dinámica + disparo en
`harpsichord-game.test.ts`/`yell-dungeon-seal.test.ts`), tsc limpio, build limpio, boot del
navegador limpio, y la secuencia de canvas de `paintQuakeShift` ejercida sobre el lienzo
real 320×200 (re-blit OK, borde superior a negro, sin excepción).

---

## 6. POST-MORTEM (task #36) — por qué el primer barrido de ASM NO vio este terremoto

El usuario pidió entender POR QUÉ la primera pasada declaró "el handler del yell no sacude"
(§4 original, ⚠) cuando el vídeo prueba que sí. Respuesta corta: **el trigger es IMPERATIVO
(una `call` directa que nos perdimos), NO reactivo.** La hipótesis de "motor observador"
—atractiva por analogía con el motor de sonido— queda **REFUTADA para este caso**. La causa
real es un punto ciego METODOLÓGICO en cómo se leían los near-calls entre overlays.

### 6.1 Clasificación del trigger: IMPERATIVO

`CMDS 0x12f9 call 0x70f2` es una llamada síncrona en el propio handler del yell, alcanzada
incondicionalmente al casar la palabra (0x12ea `jg`). El kernel 0x3072 ejecuta la sacudida
AHÍ MISMO (blit-shift + beeps, §3); no setea un flag para que otro subsistema lo lea después.
No hay observador. Es tan imperativo como el clavicémbalo (TOWN 0x0ea3).

### 6.2 La causa raíz: ceguera de OPERANDO entre overlays (near_call_base por-banda)

El primer barrido buscó el terremoto por su **operando** `0xaea2` (el que usan TOWN/MAINOUT).
Pero un near-call al MISMO kernel residente `0x3072` lleva un operando DISTINTO en cada
overlay, porque `operando = (0x3072 − near_call_base(O)) & 0xFFFF` y la base cambia por banda
(overlay-load-layout.md §3):

| banda | near_call_base | operando→0x3072 | overlays |
|---|---|---|---|
| 1 | 0x81d0 | **0xaea2** | TOWN, MAINOUT, DUNGEON |
| 1 (reloc) | 0x81c0 | 0xaeb2 | INTRO |
| 2 | 0xa290 | 0x8de2 | NPC, COMBAT, BLCKTHRN, … |
| 3 | 0xbf80 | **0x70f2** | CMDS, CAST, SJOG, TALK |
| 4 | 0xe1e0 | 0x4e92 | CAST2, ZSTATS, … |

`grep aea2 CMDS.OVL.asm` → **0 resultados**. El terremoto del yell estaba ahí (`0x70f2`),
pero era invisible a una búsqueda por el operando de otra banda. Error secundario que agravó:
se auditó sólo la ventana estrecha `0x13bd-0x13e2` (el toggle del sello), **196 bytes DESPUÉS**
de la call real en `0x12f9`, en la cabecera del handler.

### 6.3 El barrido CORRECTO: resolver por CS-TARGET, no por operando

Enumerando callers del kernel 0x3072 en TODOS los overlays (operando propio de cada base),
la primitiva del terremoto tiene **~14 call-sites en 5 overlays**, no los 2 conocidos:

| overlay | sitio(s) | qué es |
|---|---|---|
| TOWN 0x81d0 | 0x0ea3 | clavicémbalo (§3, conocido) |
| MAINOUT 0x81d0 | 0x0a7d | terremoto aleatorio underworld (§4b, conocido) |
| **CMDS 0xbf80** | **0x12f9** | **yell dungeon-word (ESTE, #36)** |
| CMDS 0xbf80 | 0x129f | otra apertura: limpia flag `[bx+0x58d8]&0x7f`, string 0x4482, pone tile 0x19 |
| CAST 0xbf80 | 0x092d; 0x169d×3 | efecto(s) de hechizo (triple-sacudida tras string 0x4822) |
| CAST2 0xe1e0 | 0x0c88; 0x0dc0/0dd7/0dee | efecto(s) de hechizo |
| BLCKTHRN 0xa290 | 0x0acc×2 | evento guionizado del palacio (string 0x719e + anim de personajes) |

(Verificados por lectura: TOWN, MAINOUT, CMDS×2, CAST 0x169d, BLCKTHRN. Los de CAST/CAST2
restantes son arit­méticamente el mismo kernel; su semántica exacta —¿hechizo "Earthquake"/
Armageddon?— es tarea aparte, alimenta #34.) Sólo 2 de ~8 sitios lógicos se conocían.

### 6.4 REGLA DE MÉTODO (para citar en derivaciones futuras)

**REGLA A — nunca grepear un near-call por su operando entre overlays.** Para enumerar TODOS
los callers de una rutina residente `T`: por cada overlay O computar `(T − near_call_base(O))
& 0xFFFF` y grepear ESE operando; o post-procesar el disasm anotando cada near-call con su CS
resuelto y grepear por `→0xT`. Un solo operando sólo encuentra los callers de SU banda. (Este
mismo error explicaría otros "huérfanos" del censo #33/#34: rutinas residentes muy usadas cuyos
callers en overlays de otra banda parecen inexistentes.)

**REGLA B — para cada efecto observable del testigo, auditar además de la cadena del comando
los MOTORES que sondean estado (observadores).** Aquí resultó imperativo, pero el patrón
reactivo es REAL en el binario y hay que descartarlo explícitamente. Observadores conocidos
(checklist):
- **Motor de sonido `0x416c`** (selector de modo; reproductor `0x42d2`): recorre celdas
  visibles (buffers 0xab02 stride 0x20 / 0xac64 stride …) y dispara audio por tile visto —
  p.ej. la canción del laúd del bardo. Nadie lo "llama" desde el comando. (camp-scene-kernel.md).
- **Bucle per-turno del overworld MAINOUT `0x0a84`**: alberga el terremoto aleatorio del
  underworld (§4b), "Zzzz…"/"What?", etc. Sondea estado cada turno.
- **Bucle de espera de tecla `0x1070/0x10d0`**: cada 8 ticks refresca animación/ambiente
  (ambient-audio-audit.md). Motor de animación de fondo.
Cuando un efecto no aparece en la cadena del comando, revisar estos ANTES de concluir "no
existe".

### 6.5 Veredicto

Ni motor reactivo ni cita fabricada: era una `call` imperativa real, oculta por leer el near-
call con la base equivocada. El "sí o sí" del usuario (el vídeo salió de estos binarios → el
código existe) se cumplió. La lección reutilizable es la REGLA A; la REGLA B queda como red de
seguridad para los efectos que SÍ sean reactivos.
