# #364 — El ALAKAZAM de la donación: fuente rúnica, inversión sostenida y dos barridos espejo (CAST2 rama 0x0b1d)

Derivación de la rama de DONACIÓN de `shrine_visit` (CAST2.OVL 0x0966), la que corre al
re-meditar con el Códice completado y SIN quest activa, y cableado de su paridad AV en el
port. Cuerpo leído en `re/disasm/CAST2.OVL.asm` (0x0b08-0x0c17); citas re-verificadas
sobre este árbol.

## 1. La rama y su gate

```
0b08  ax = 1 << [bp-8]                  ; máscara de la virtud
0b10  cl = [g_shrine_quest_bitmap]      ; 0x58cc
0b16  test cx, ax
0b18  je 0xb1d                          ; SIN quest activa ⇒ DONACIÓN
0b1a  jmp 0xc18                         ; con quest ⇒ WELL DONE (#295)
```

Bucle del dígito (getkey crudo 0x448c envuelto en `cmp ax,0x30/0x39` @0x0b6f-0x0b77 — el
filtro de dígitos lo pone el LLAMADOR, no la rutina):

- `'0'` (0x0b2a `sub si,0x30` = 0) → imprime DS 0x959c (" gp\n" tras el eco del dígito) y
  sale por 0x0b3c → 0xd1d. **Sin efecto y SIN sonido.**
- dígito ≥1 → eco DS 0x95a2 ("00 gp\n\n") SIEMPRE (0x0b40), y gate de oro
  `100·n > [g_gold]` (0x0b47-0x0b50) → sin oro: 0xb6b9 ("Thou hast not that much gold!")
  y re-prompt (0x0b59 → 0xb5f). **Sin efecto y SIN sonido.**

## 2. El éxito (0x0b7c-0x0c14), en orden

```
0b82  ax = 100·n ; sub [g_gold], ax       ; cobra
0b8b  call 0x4720                          ; repinta stats
0b8e  [g_karma] += n ; clamp 0x63          ; 0x0b95-0x0b9c
0ba1  push 1 ; call 0x3abe                 ; ★ set_font(1) — FUENTE RÚNICA
0ba8  print(DS 0x95aa)                     ; "ALAKAZAM"
0baf  push 0 ; call 0x3abe                 ; ★ set_font(0) — vuelta a IBM
0bb5  print(DS 0x95b4)                     ; "!\n"
0bbc  push [g_unk_13b0] ; call 0x2890      ; set_color
0bc3  push 8,8,0xb7,0xb7 ; call 0x29a6     ; rect XOR ⇒ INVIERTE el viewport (SUELTO)
0bd0  si=0x7d0 … add si,0x32 … cmp 0x61a8  ; barrido ASCENDENTE  (460 tonos)
0bf2  si=0x61a8 … sub si,0x32 … cmp 0x7d0  ; barrido DESCENDENTE (460 tonos)
0c14  jmp 0xd16                            ; push 0xa / call 0x5906 = kernel_flash(10) ⇒ RESTAURA
```

Los cinco argumentos del tono, constantes en las 920 llamadas salvo `si`
(@0x0bd3-0x0be2 / 0x0bf5-0x0c04, notación de PUSH): `tone(0xa8c, 1, 0xc8, si, 0)` —
`step`=0 (`sub ax,ax` @0x0be0/0x0c02: el ±0x32 es el paso del BUCLE sobre `start`, no el
5º argumento). `call 0x3fb2` resuelve cross-overlay al kernel de tono 0x2192 — careado con
control positivo por el carril de medición: el cuerpo hace `out 0x42, al` (PIT canal 2).

Es el TERCER miembro de la familia de dos bucles espejo (shard CAST 0x15dd-0x162a, WELL
DONE CAST2 0x0c44-0x0c85): mismas cotas 0x7d0/0x61a8/0x32; `inc`=0xa8c propio;
`count`=0xc8 = el del SHARD (el WELL DONE usa 0x96). **SIN sacudida**: esta rama no llama
a 0x4e92 (el WELL DONE sí, @0x0c88) — salta directa al flash.

Régimen de la inversión: el rect XOR de 0x0bcd queda SUELTO (nadie lo des-invierte); lo
restaura el `kernel_flash(10)` de 0xd16, y entre medias sólo corren los dos barridos ⇒ la
ventana ES su duración. Mismo régimen que #295, con OTRA duración (count 0xc8 ≠ 0x96).

## 3. Port (este commit)

- `game/src/core/sfx.ts` — cue `shrine-donation` (ID lógico, params en la piel).
- `game/src/skin/fiel/speaker.ts` — `donationSweepHalf()` = `toneSweep(0xa8c,1,0xc8,·,0)`
  × 460 iteraciones (cotas COMPARTIDAS con el shard: son las mismas constantes del
  binario); catálogo `shrine-donation` = dos mitades; `donationInvertWindowMs()` = 2×.
  Bajo el modelo de la casa las dos mitades son INDISTINGUIBLES (el barrido de `bx` es
  DUTY = timbre, no pitch — `toneSweep` lo descarta; vecina #137): pitch constante
  ≈1063,2 Hz (inc 0xa8c) y 7.130 ms en total. NO entra en `CHAINED_CUES`: en su rama no
  hay segundo cue con el que serializarse.
- `game/src/core/world/shrine-ceremonies.ts` (`submitDonation`) — éxito: `ritual-invert`
  con `ritual:"donation"` + `sfxEvent("shrine-donation")` entre el ALAKAZAM y el
  `party-changed`, calcando el patrón WELL DONE. Negativos (n=0, sin oro) intactos: ni
  cue ni invert, espejo del asm.
- `game/src/core/game.ts` — campo `ritual?: "donation"` en el evento (el core sigue sin
  conocer ms; la piel elige de qué par de barridos derivar la ventana).
- `game/src/main.ts` — `ritualInvertCtl.run(donation ? donationInvertWindowMs() :
  wellDoneInvertWindowMs())`. La serialización inversión→salida de escena (#330(B)) se
  hereda sin tocar nada: el evento `shrine-scene` ya se aparca detrás de la restauración.
- Tests: `game/tests/prompts-donation.test.ts` §#364 (orden del binario, id y ventana EN
  CRUDO, negativos; mutantes M1/M2 corridos sobre fixture verde y matados).

## 4. Cabo #364-b — la MELODÍA del ORDAINED (0x0adb-0x0b02), IMPLEMENTADA (carril fix-364b)

Tras el «Return again when thy Quest is done!» (0x0ac3, buffer 0xb669), la rama ORDAINED
toca una melodía de **7 notas**: bucle 0x0adb-0x0b02, una llamada a `tone` (0x3fb2) por
iteración con los CINCO argumentos leídos de CUATRO tablas paralelas de 7 words en DS
(punteros avanzando de 2 en 2, tope `cmp si,0x4c1e` @0x0afe):

| arg (orden de push) | tabla DS |
|---|---|
| `inc`   | 0x4be6 (`di` @0x0acb) |
| `delay` | constante 1 (@0x0add) |
| `count` | 0x4bf4 (`[bp-0xe]` @0x0ace) |
| `start` | 0x4c02 (`[bp-0x10]` @0x0ad3) |
| `step`  | 0x4c10 (`si` @0x0ad8) |

### 4.1 Los valores, LEÍDOS de DATA.OVL (este carril)

Mapeo DS→fileoff = **DS + 0x10**, calcado de `siembra-objetos-cbt-353.md` §3 y
re-verificado aquí con su MISMO control positivo (fileoff 0x386e → `14 15 16 22 21 18
1f 18` = la EC_GROUP_TABLE). Las cuatro tablas, VERBATIM (words little-endian):

```
inc   DS 0x4be6 → fo 0x4bf6: 0x0ce4 0x0f55 0x0f55 0x0f55 0x0f55 0x0e74 0x0f55
count DS 0x4bf4 → fo 0x4c04: 0x1b58 0x1770 0x0bb8 0x0bb8 0x0bb8 0x0bb8 0x1f40
start DS 0x4c02 → fo 0x4c12: 0x03e8 0x03e8 0x03e8 0x03e8 0x03e8 0x03e8 0x01f4
step  DS 0x4c10 → fo 0x4c20: 0x0009 0x000a 0x0015 0x0015 0x0015 0x0015 0x0008
```

Interpretación bajo el modelo derivado del kernel 0x2192 (cabecera de `toneSweep` en
`skin/fiel/speaker.ts`): `inc` fija el PITCH (acumulador PWM, f = inc/65536·SR), `count`
la DURACIÓN, y `start`/`step` barren el umbral del duty (= timbre, →AV, no modelado).
⇒ 7 tonos: ~1299 Hz (271 ms) · ~1546 Hz (232 ms) · ~1546 Hz ×3 (116 ms) · ~1457 Hz
(116 ms) · ~1546 Hz (310 ms) ≈ 1.279 ms en total. A diferencia de la familia de barridos
espejo, aquí `step` NO es cero: cada nota barre su duty desde `start` (9/10/21/21/21/21/8).
NO se usa `pitHz` (#254): esa cuantización es del camino `set_tone`/`beep` (0x22e2, PIT
directo); el pitch de 0x2192 es el del acumulador, como en todo el catálogo de sweeps.

La rama NO invierte NI sacude — sin 0x2890/0x29a6/0x4e92; sale por `jmp 0xd16` (@0x0b04)
al `kernel_flash(10)` común del rito — así que el cue va sin `ritual-invert`, sin
`{kind:"quake"}` y sin ventana; tampoco entra en `CHAINED_CUES` (no hay segundo cue).

### 4.2 Port (carril fix-364b)

- `game/src/core/sfx.ts` — cue `shrine-ordained` (ID lógico).
- `game/src/skin/fiel/speaker.ts` — tablas `ORDAINED_{INC,COUNT,START,STEP}` verbatim +
  `ordainedMelody()` = 7 × `toneSweep(inc[i], 1, count[i], start[i], step[i])`.
- `game/src/core/world/shrine-ceremonies.ts` (rama `show-mantra` de `submitShrineVisit`)
  — `sfxEvent("shrine-ordained")` PEGADO detrás del print del «Return again», como el
  bucle está pegado al print en el binario. Las demás ramas quedan como estaban (mudas
  o con su cue propio).
- Tests: `game/tests/shrine-ordained-364b.test.ts` (adyacencia, negativos con control
  positivo, las 7×4 words y los Hz/ms EN CRUDO; mutante M1 corrido y matado) +
  el esperado en crudo de `shrine-key-wait.test.ts` gana el token del cue.

## 5. Cabo #364-c — la fuente RÚNICA del ALAKAZAM, NO hecha (y por qué)

El binario cambia de fuente A MITAD DE FILA: set_font(1) → "ALAKAZAM" → set_font(0) →
"!\n" (0x0ba1-0x0bb9; kernel del setter = 0x1c9e). El modelo de consola del port es
por-FILA, no por-tramo:

- `ConsoleLine.rune` marca la LÍNEA entera (`coreview.ts` `appendText`; `win.runeMode`
  por línea en `skin/fiel/console.ts`). `rune:true` para "ALAKAZAM!\n" completo pintaría
  el "!" con el glifo 0x21 de RUNES.CH — un glifo que el original evita a propósito
  (para eso conmuta la fuente antes del "!").
- Partir en dos eventos (`"ALAKAZAM"` rúnico + `"!\n"` latino) manda el "!" a OTRA fila:
  `pushConsole` arranca cada mensaje en columna 0 (`rowOpen=false`, residuo declarado de
  #108) — divergencia de layout en vez de divergencia de fuente.
- La única vía per-celda existente (`signCells`) es del cartel (L)ook: celdas
  pre-compuestas que se blitean VERBATIM sin word-wrap (`console.ts` `putRowCells`) — no
  es un canal de mensajes y saltarse el printer sería otro régimen.

⇒ cualquier arreglo fiel exige fuente POR TRAMO dentro de una fila (evento, ConsoleLine,
printer/wrap, blit de las dos pieles, atlas HD del shader): arrastra el sistema de texto,
así que NO se hace aquí. El port imprime "ALAKAZAM!\n" en latín, como antes de esta ficha,
con el cabo declarado en el código (`submitDonation`).

## 6. #371 — el cue emitido NO sonaba: el hueco estaba en el despacho, no en el catálogo

Reporte del usuario en producción (deploy #37): al donar, la inversión XOR sale, el
ALAKAZAM sale, y el sonido no. Adjudicado con repro instrumentada (censo de osciladores
WebAudio en modo humano, discriminante tono/ruido por el grafo del speaker, control
positivo de pisadas en la misma corrida): el cue no llegaba a `speaker.play` — TONO=0 en
las DOS pieles con el catálogo intacto y el contexto `running`. Y no era solo la
donación: `shrine-well-done` (que se daba por sonando desde #295/#345 — su verificación
fue de encadenado y WAV, nunca del camino vivo) y la melodía del ORDAINED (§4) daban
TONO=0 igual. El reporte histórico del usuario en #345 («sigo sin oír nada») era este
mismo hueco, no el orden de mezcla que #345 arregló encima.

MECANISMO (port, `game/src/main.ts`): el único enrutador de `{kind:"sfx"}` de un turno
era el `view.notifyTurn(events)` del FINAL de `applyEvents`, y toda rama terminal del
rito corta el bucle con `return` antes de llegar: desde #277 la salida de escena viaja en
TODAS las ramas terminales, y las esperas de #294 trocean el Códice. El texto y el XOR
salen porque los maneja su rama DENTRO del bucle; el sfx moría porque su enrutado vivía
después del corte. Los tests de EMISIÓN (core) y de CATÁLOGO (speaker) no podían verlo:
el hueco está exactamente entre las dos poblaciones — faltaba el test del CAMINO.

FIX: `flushSfxPrefix` (main.ts:1852) publica los sfx del prefijo consumido antes de cada
corte; los tramos diferidos se enrutan solos al re-aplicarse (o completan y pasan por
notifyTurn, o vuelven a cortar y flushean) — sin dobles, pineado con igualdades exactas.
LOS CINCO CORTES, con su línea (post-fix, para #373): `refuge` main.ts:1864 ·
`troll-sneak` main.ts:1880 · `shrine-scene` main.ts:1896 (el flush va ANTES del
aparcamiento #330(B): los barridos suenan DENTRO de la inversión, como en el binario) ·
`shrine-key-wait` main.ts:1922 · `endgame` main.ts:1946.

VERIFICADO ESCUCHANDO el destino real (tap ScriptProcessor sobre `ctx.destination`,
WAV de 7,08 s): tono sostenido ≈1065 Hz a −20,0 dBFS durante toda la ventana — la firma
de los barridos de la donación (familia `inc`=0xa8c, count 0xc8 ⇒ ~7,1 s, más largos que
los 5,35 s / 1220,7 Hz del WELL DONE, count 0x96). Tras el fix, el censo da: donación
TONO=2 (ambas pieles) · WELL DONE TONO=2 + RUIDO=24 (el trueno encadenado: 8 pulsos × 3
sub-ráfagas) · ORDAINED TONO=7 (las 7 notas). Tests del camino:
`game/e2e/shrine-sfx-camino-371.spec.ts` (4 asertos de igualdad exacta, `?scenebeat=1`
para que las esperas aparquen de verdad bajo automatización; mutantes M1/M2 —flush de
escena y de espera— corridos y muertos cada uno por su test).

CABO DECLARADO (#373, del lead): los `{kind:"quake"}` VISUALES troceados por las esperas
del Códice mueren en los mismos cortes (la QuakeShake se deriva de los events de
`onTurn`, que el corte también salta); esto solo repara el canal de AUDIO.

## 7. #373 — el cabo VISUAL de #371, cerrado: flushEventPrefix

El cabo de arriba, medido y reparado (carril fix-373). Repro sobre la ceremonia REAL de
las 8 virtudes (Codex en (233,233), quest=0x80 + visited=0x7f, `?scenebeat=1`): el rito
llega a «A STRANGE WIND…» con el rumble sonando (post-#371) y `fxActive()` — el getter
`transientFxActive` de la piel, que incluye `quake.active` — queda `false` para siempre;
el control positivo de la MISMA corrida (un `{kind:"quake"}` en batch completo, vía
`__u5test.applyEvents` → notifyTurn) sí enciende y se autoextingue. La sacudida moría
exactamente donde el sfx: detrás del `return` de `shrine-key-wait`.

CENSO de kinds del batch que las ramas terminales dejaban morir (derivado productor ×
consumidor-solo-en-onTurn): `sfx` (#371) · `quake` (medido aquí) · `cell-explosion` y
`cell-projectile` (misma clase, sin repro barato hoy — ningún batch actual los pone
delante de un corte; un cañonazo cuyo housekeeping acabe en refuge los produciría).
`moved`/`party-changed`/`map-changed` NO mueren: sin consumidor por-evento en onTurn, su
efecto es de lote y lo cubren los pacers y el turno que completa.

FIX (main.ts): `flushSfxPrefix` → `flushEventPrefix` en los CINCO cortes — además de los
sfx, publica el prefijo consumido ENTERO por `CoreViewImpl.emitTurnFx` → `onTurnFx` de la
piel → `applyTurnFx` (la MISMA `planVisualPhase` del turno completo, factorizada de
`onTurn`: las 3 ráfagas del Códice sacuden SOSTENIDO 3×8 pulsos, y los cues bloqueantes
del prefijo siguen decidiendo el CUÁNDO). Sin bookkeeping de turno: `personTurnCount`
(«un TURNO = un avance de frame») se mueve SOLO en `onTurn`. El argumento sin-dobles es
el de #371 (el prefijo cortado jamás llega a notifyTurn) y cubre ambos canales.

Tests del camino: `game/e2e/shrine-quake-camino-373.spec.ts` (ceremonia real + control ·
corta-y-reaplica sin re-sacudida · prefijo EXACTO con el quake del resto llegando UNA vez
por notifyTurn). Mutantes: M1 (sin emitTurnFx) muerto por ceremonia+corta-y-reaplica;
M2 (array entero en vez del prefijo) muerto por prefijo-exacto. ⚠ Trampa de arnés medida:
`worldReady` se cumple con la piel AÚN SIN SUSCRIBIR — un evento empujado en esa ventana
se pierde sin listener; los tres tests esperan `skinCycleReady` antes de empujar nada.
