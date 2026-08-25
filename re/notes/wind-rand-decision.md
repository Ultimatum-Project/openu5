# Banco «wind-rand-por-beep» — DECISIÓN (carril wind-rand, 2026-07-23)

> **Veredicto: (B) divergencia REAL pero JUSTIFICADA y YA DECLARADA.** La hipótesis
> literal («el original liga el retiming del viento al beep del PC-speaker») queda
> **REFUTADA**; la hipótesis en espíritu («el original consume el rand del viento por
> un tick de tiempo real, no por turno») queda **CONFIRMADA** con la topología completa
> de callers derivada del disasm. La divergencia ya tiene fila declarada en
> `re/deliberate-divergences.md` (addendum task #17 + corrección Task #20, «Viento por
> reloj de pared en idle»); esta nota la RATIFICA con el careo ASM exacto y **cierra el
> banco**. Cero cambios de core.

## 1. Contexto del banco

`PLAN-VIVO.md` §BANCOS: «wind-rand-por-beep (divergencia declarada propuesta)». La
propuesta existente vive en `re/deliberate-divergences.md`:

- Addendum «RESOLUCIÓN task #17» (oráculo 2026-07-14): `0x2f62` clasificado Clase 3
  (divergencia deliberada INDETERMINISTA) junto a los demás consumidores de RNG de la
  ruta render/tick. Medido en vivo: **~38 disparos de `0x2f62` en 150 resumes idle SIN
  tecla** (~1.4 rands/tick BIOS), detalle `re/notes/oracle-flash-rng.md §3`.
- Corrección Task #20: el label «sprite_frame_randomizer» era erróneo; `0x2f62` =
  `maybe_change_wind` → `0x2e96 set_wind` escribe `g_wind` (re-derivación
  `re/notes/transport.md §4.1`). La fila «Divergencia OBSERVABLE» declara: original =
  viento cambia por reloj de pared en idle; clon = solo por turno consumido.

Lo que FALTABA (y esta nota aporta): la derivación de **por qué exactamente** el rand
del viento late en tiempo real — quién llama a `0x5910`, con qué gates, y a qué cadencia
— y el fallo formal sobre la hipótesis «beep».

## 2. Derivación ASM — cuándo tira rand el viento en el original

Todos los offsets son de `re/disasm/ULTIMA.EXE.asm` (kernel, CS-relativo) salvo
indicación. Los calls de overlay a kernel llevan bias `(mostrado + 0x81D0) & 0xFFFF`
(nota mainout-ffff-call-bias): un `call 0xffffd740` en MAINOUT/TOWN = kernel `0x5910`.

### 2.1 El consumidor: `maybe_change_wind 0x2f62` (ya derivado, transport.md §4)

`0x2f70`: rand(0,63) SIEMPRE; ≠0 → return (63/64). Hit 1/64: bucle `0x2f89-0x2f9d`
rand(0,4) con rejection de Calm (rand(0,255)≥0xC0) → `call 0x2e96` (set_wind, escribe
`g_wind 0x5892` + resetea drift ctr `0x5883`).

### 2.2 Único caller: `viewport_redraw 0x5910` — 1 rand de viento POR PASADA

`grep "call 0x2f62"` sobre la imagen entera: **un solo sitio**, `0x5944` dentro de
`0x5910`. Estructura de `0x5910` (líneas 9528-9631 del .asm):

```
5918: [0x545e]=0xff
591d: cmp [g_time_spell],0x54 ; Time-stop 'T' →
5924:   [0x5891]=0            ;   fuerza latch a 0 (viento+anim+ambiente saltados)
5929: cmp [0x58a4],0 → je 5a1d ; gate "vista de mapa activa" (ver §2.5)
5933: cmp [0x5891],0 → je 5954 ; latch a 0 → salta viento+anim
593a: cmp [0x5891],0xff → je 5944 ; 0xff = primer repintado: salta 0x4552…
5941: call 0x4552              ; anim_script_tick (bytecode anim, RNG propio)
5944: call 0x2f62              ; ← maybe_change_wind: 1×rand(0,63)
5947: si loc<0x80: call 0x475a + 0x70a6
…                              ; composición del viewport
5a13: cmp [0x5891],0 → je 5a1d
5a1a: call 0x4102              ; ambient_sfx_tick (beeps fuente/reloj — PRNG LOCAL 0x545c)
5a1d: [0x5891]=1               ; ← RE-ARMA el latch al final de CADA pasada
```

Escritores de `[0x5891]` en TODA la imagen: `0x267a` (=0xff, entrada de getkey si
`[0x52c8]==2`), `0x5924` (=0, time-stop), `0x5a1d` (=1, fin de cada pasada). **No hay
ningún «consumo por turno» del latch**: tras la primera pasada queda en 1 para siempre
(salvo time-stop) ⇒ **cada ejecución de `0x5910` = exactamente 1×rand(0,63) de viento**.

### 2.3 ¿Y cuándo corre `0x5910`? — cuatro vías, tres de ellas de TIEMPO REAL

1. **Idle del getkey** — `getkey_with_redraw 0x266c` (kernel-sweep-2; el «getkey crudo
   0xa49c» visto desde overlays = `(0xa49c+0x81d0)&0xffff = 0x266c`):
   ```
   267f: call 0x1b38   ; poll_key_blink_cursor
   2683: call 0x2032   ; to_upper
   268a: jne 269d      ; hay tecla → sal del repintado
   268c: cmp loc,0x21 → jb 269a   ; loc<0x21 (overworld+pueblos) → repinta
   2693: cmp loc,0x7f → jbe 269d  ; 0x21..0x7f (mazmorra) → NO repinta
   269a: call 0x5910   ; ← REPINTADO IDLE (viento dentro)
   269f: je 267f       ; sin tecla → loop
   ```
   `0x1b38` sin tecla llama `0x20fa(1)` = 1 tick de INT 1Ch (~1/18.2 s; saltado en
   máquinas lentas por la calibración `[0x5356]`, kernel-sweep-4 §0x20fa). ⇒ **mientras
   el jugador NO pulsa, el viento rueda 1 rand ≈ por tick de BIOS** (el oráculo midió
   ~1.4 rands/tick). Nota: la condición también repinta con loc≥0x80 (combate).
2. **Una vez por world-turn** desde los overlays (`call 0xffffd740`): MAINOUT `0x05a0`
   (tras la deriva del barco), `0x0a43`, `0x1128`, `0x11d9`, `0x122d`, `0x1293`,
   `0x12d7`, `0x13d6`, `0x1c0b`; TOWN `0x053a`, `0x0c2c`, **`0x0dd0`**
   (town_read_command: repinta ANTES del dispatch de la tecla — el «viento por tecla
   leída» que el port ya calca en el prólogo de borrachera), `0x0f8a`, `0x10ba`,
   `0x1272`, `0x1376`.
3. **31× por revelado de tile, y SÓLO fuera del endgame**: `fx_tile_fizzle_in 0x1068`
   (kernel-sweep-4 §174) llama `viewport_redraw 0x5910` en `0x10d0` cada 8 de sus 256
   pasos de blit. ★ **CORREGIDO EN SITIO (frontera-29, tarea #71)**: esta entrada decía
   «**32×** por wipe de pantalla … cada transición de mapa consume ~32 rands de golpe», y
   tenía **tres** errores encadenados, más una atribución equivocada:
   - **Nombre**: `0x1068` no barre la pantalla — revela **UN tile** (rama `stc` del
     selector 0x66). Ya lo corrigió renombres-59; aquí se había quedado el nombre viejo.
   - **Condición ausente**: en `0x10bb` hay `cmp [g_location], 0x42` / `jne 0x10d0`. El
     `call 0x5910` **sólo ocurre si `g_location != 0x42`**, y `0x42` es el **endgame**
     (`intro-demo-scene.md:62,68`; `demo-scene-data.md:186`). Dentro del endgame llama en
     su lugar a `0x81ba(1)` —poll interrumpible— y si devuelve ≠0 **aborta el bucle**
     (`0x10ce jne 0x10d8`), así que ni completa los 256 pasos ni rueda viento **ninguna
     vez**. `kernel-sweep-3.md:337`, `kernel-sweep-4.md:176` y la entrada de
     `coverage.json` SIEMPRE tuvieron la condición bien: se perdió sólo aquí.
   - **Cuenta**: son **31**, no 32. `di` avanza de 2 en 2 (dos llamadas al driver por
     vuelta, `inc di` entre ellas en `0x108f` y otro en `0x10ad`), y la salida
     `cmp di,0x100 / je` se evalúa **antes** del `test di,7`, así que el gate dispara
     para `di ∈ {8,16,…,248}` = 31 veces exactas. El «~32» era un redondeo que nadie
     rehízo.
   - **Atribución**: el consumo pertenece a este revelado por-tile, **no** al barrido de
     región. Su hermano `fx_rect_dissolve 0x0f46` (rama `clc`) **no llama a `0x5910` en
     absoluto**: es un thunk de 40 B sin bucle porque el LFSR entero lo corre el driver.
     Cualquier cuenta de «rands por transición de mapa» tiene que salir de cuántas veces
     se invoca `0x1068`, no de que haya habido una transición.
     > **Corrección en sitio (2026-07-28, tarea #80)**: el cuerpo de código de `0x0f46` son
     > **39 B**, `0x0f46`–`0x0f6c` (`ret 8` en `0x0f6a`–`0x0f6c`), no 40. El byte 40º
     > (`0x0f6d`) es el **relleno `00`** que oculta el prólogo del vecino `0x0f6e` — el
     > mismo mecanismo que documenta `prologos-ocultos-80.md`. El diagnóstico de #71 queda
     > INTACTO: el límite se re-derivó por cierre de alcanzabilidad desde el prólogo real y
     > cada instrucción citada por #71 cae dentro de esos 39 B. Sólo cambia la cifra.
4. **n× por delay animado**: helper `0x3ae6` (redraw×n, gate `[0x58a4]≠0`): bucle
   `0x3b07 call 0x5910` + `0x20fa(1)` n veces — todo «espera n ticks repintando»
   consume n rands de viento.

### 2.4 La hipótesis «beep»: REFUTADA en su forma literal

El rand del viento NO está gateado por el PC-speaker. La conexión real es de
**co-pasajero**: la MISMA pasada de `0x5910` que rueda el viento (`0x5944`) dispara el
ambiente sonoro (`0x5a1a → ambient_sfx_tick 0x4102` — los beeps de fuente/reloj,
`ambient-audio-audit.md`), así que beep-ambiente y rand-viento comparten cadencia, pero
el beep no es la causa: el motor es el **tick de repintado idle** (getkey + wipes +
delays). El 0x4102 además usa un PRNG LOCAL (`[0x545c]`), no `g_rng` — el beep en sí es
neutro para el stream. (De paso: el label «bucle de espera de tecla 0x1070» de
`ambient-audio-audit.md §2` es impreciso — `0x1068` es `fx_tile_fizzle_in`, kernel-sweep-4
§174; la espera de tecla real con repintado es `0x266c`.)

## 3. Careo con el port

Port (`game/src/core/world/wind.ts` `maybeChangeWind`): fórmula interna CALCADA
(rand(0,63) siempre; 1/64 → rand(0,4) con rejection de Calm) — fiel a `0x2f62`.
Frecuencia: **exactamente 1×/world-turn** — `world/loops/turn.ts:128,150,289,330,359`
(+ prólogo de borrachera `game.ts:1037,1060`, que preserva el orden del stream de la vía
TOWN `0x0dd0`), gate `timeSpell!=='T'` = el `0x591d-0x5924`. El port NO tiene bucle
idle que consuma `g_rng`, no consume los 31 rands por revelado de tile ni n por delay.

| | ORIGINAL | PORT |
|---|---|---|
| Fórmula del cambio | rand(0,63); 1/64 → rand(0,4)/rejection Calm (`0x2f62`) | idéntica (`maybeChangeWind`) |
| Consumo por world-turn activo | ≥1 (una pasada de `0x5910` por turno; más si el turno repinta varias veces) | exactamente 1 |
| Jugador quieto | ~1 rand/tick BIOS (idle getkey `0x269a`); el viento PUEDE cambiar sin acción | 0 rands; el viento no cambia parado |
| Revelado de tile (`fx_tile_fizzle_in`) | **31** rands (`0x1068`), y **0** en el endgame (`g_location==0x42`) | 0 |
| Delays animados | n rands (`0x3ae6`) | 0 |
| Time-stop | latch=0 salta viento (`0x5924`) | `timeSpell!=='T'` |

## 4. Veredicto (B) y por qué NO (C)

**Divergencia real** (el original es tiempo-real; el port es por-turno) pero
**incorregible limpiamente y ya declarada**:

1. La cadencia del original depende del **reloj de pared** (INT 1Ch + velocidad de
   máquina + cuándo pulsa el humano). No existe equivalente determinista: emularla
   exigiría un reloj de animación consumiendo `g_rng` en el core → reintroduce
   indeterminismo en saves/replays/sellos (exactamente lo que la fila declarada de
   `re/deliberate-divergences.md` ya descarta).
2. Cualquier aproximación (p. ej. k rands por turno, rands por transición de mapa)
   **re-alinearía TODO el stream de rands del overworld** ⇒ invalidaría los sellos
   deterministas de e2e y las paridades model↔clon nivel 2. Por la salvaguarda del
   encargo, un fix así NO se implementa.
3. El port ya es fiel en el SUBCONJUNTO determinista (fórmula + 1 tick por turno +
   gate time-stop), y del lado seguro: nunca inventa un cambio de viento que el
   original no pudiera hacer en ese turno; solo omite los que el original haría
   mientras el jugador está quieto o en transiciones.
4. La paridad viva ya verificada es inmune por construcción (pertenencia-forward a la
   órbita / re-siembra en la entrada del consumidor; ver el propio addendum #17).

**Cierre del banco:** «wind-rand-por-beep» queda resuelto como divergencia declarada
RATIFICADA (la fila de `re/deliberate-divergences.md` Task #20 es la vigente; esta nota
es su careo ASM completo). Renombrar mentalmente el banco a «wind-rand-por-tick-idle»:
el beep era el síntoma audible del tick, no el mecanismo. Sin acción de código; el lead
puede tachar la línea de PLAN-VIVO §BANCOS citando esta nota.
