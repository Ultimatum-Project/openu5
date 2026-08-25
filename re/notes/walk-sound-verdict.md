# ¿Andar suena en el DOS original? — RE-AUDITORÍA (task #51, contestada por el usuario)

> Derivación CONTESTADA. Conclusión previa del proyecto: "andar es MUDO en el DOS
> original" (doble prong: barrido de call-sites + análisis espectral de vídeo que
> atribuyó los clicks al teclado). El usuario, jugando al ORIGINAL en su DOSBox,
> AFIRMA que "andar SÍ produce sonido". Doctrina para contradicciones: 3ª LECTURA
> CIEGA + TESTIGO DE RUNTIME; el testigo manda.
>
> Esta nota: (1) lectura ciega completa de TODAS las rutas al altavoz físico;
> (2) protocolo + log del testigo dosbox-x headless; (3) veredicto; (4) contraste
> con las notas previas.

## 1. LECTURA CIEGA — todas las rutas al altavoz físico (puertos 0x61/0x42/0x43)

Barrido de TODO `out` a 0x61 (gate del speaker) / 0x42-0x43 (PIT canal 2) en kernel,
overlays y drivers `.DRV`. Resultado: **el altavoz sólo se pilota desde dos sitios
de código** — el motor PC-speaker del KERNEL y una única rutina de ruido del
EGA.DRV. Los overlays NO tocan puertos: piden sonido llamando a rutinas kernel.

### 1a. Motor PC-speaker del KERNEL (ULTIMA.EXE) — el carril de gameplay

Todas las primitivas comparten el flag de sonido `g_unk_a9ce` (DS:0xa9ce): el `out
0x61` audible sólo se ejecuta si `a9ce != 0` (si es 0, el mismo código corre pero
SIN togglear el gate → temporiza mudo, misma duración). `a9ce` es "sonido ON".

| Entry | Nombre | Forma | `out` |
|-------|--------|-------|-------|
| `0x2192` | `tone_sweep` | tono barrido (params bp+4..bp+0xc); gate en bucle | 0x42 (0x21af/b3), 0x61 (0x2200/08/32) |
| `0x223c` | `noise_burst` | ruido en banda con PRNG local `xor 0x9248` (§1.2 catálogo); args (step,dur,band) | 0x42 (0x2283/87), 0x61 (0x2253/2b6) |
| `0x22c2` | `beep` wrapper | si a9ce: `tone_on` + delay(0x20c8) + off(0x230e) | vía tone_on |
| `0x22e2` | `tone_on` | enciende tono a freq=1193182/cx | 0x42 (0x22fa/fe), 0x61 (0x2304) |
| `0x230e` | `speaker_off` | `in 0x61; and 0xfc; out 0x61` | 0x61 |

Callers internos del kernel (near): `tone_sweep` desde 0x428b/0x42fb/0x438b/0x43a5/
0x48e5/0x6221 (banco de SFX keyed en `[0x6a34]`, dispatcher en 0x4267+); `glide`
desde 0x2a68/0x2fe3/0x355a; `tone_on` desde 0x30b8/0x30ec/0x311d/0x3150 (melodía) y
el wrapper beep. Los overlays llegan a estos por far-call (no hay `out` en overlays).

### 1b. Rutas de driver

- **EGA.DRV** (el modo que juega el usuario / config del oráculo `machine=ega`):
  ÚNICO gate-ON de altavoz = `0x27ba` (`or al,3; out 0x61`), dentro de un bucle de
  animación+ruido AUTOCONTENIDO (0x2968) con PRNG `xor 0x9248` y sondeo `int 16h`
  — es el ruido del **attract/animación**, NO un "beep" de gameplay. Los otros dos
  `out 0x61` del EGA.DRV (0x2637 en la rutina de cursor/teclado, 0x29cc) son
  **gate-OFF** (`and 0xfc`). ⇒ **el EGA.DRV NO tiene función de nota/beep general**:
  todo SFX de juego en modo EGA pasa por el kernel (§1a).
- **CGA/HER/T1K.DRV**: cada uno replica su propio par tone/off (mismos puertos),
  irrelevantes en modo EGA.
- **Vector de driver `lcall [0x5350]`** (g_snd_driver_fn/_seg, DS:0x5350/0x5352):
  es la compuerta genérica de llamada al driver cargado (vídeo+input+sonido), 39
  sitios en el kernel; despacha selectores de blit/paleta/teclado y, en su caso,
  ruido. En EGA no aporta un beep de paso (el único ruido del EGA.DRV es el attract).

**Consecuencia para el testigo:** en modo EGA basta con vigilar las 3 primitivas de
entrada del kernel (`0x2192`, `0x223c`, `0x22e2`) para capturar CUALQUIER intento de
sonido de gameplay (incl. el "bump"). Se añade `EGA.DRV:0x27ba` por si acaso.

## 2. PROTOCOLO DEL TESTIGO (dosbox-x headless, oráculo propio)

- Oráculo `re/tools/oracle.py` (run-dir propio; jamás el DOSBox del usuario).
  `machine=ega`. BP de CÓDIGO por dirección física (`BP seg:off`).
- Base de carga del kernel = párrafo 0x0824 ⇒ BP `0824:<imgoff>`. Se fuerza el flag
  de sonido `a9ce=1` (los BP están en las ENTRADAS, así que capturan el intento aun
  con a9ce=0; forzarlo confirma además audibilidad).
- Fases, con clasificación de cada pausa por CS:IP:
  0. **Idle** (sin tecla): N pulsos → línea base (esperado 0 hits).
  1. **Andar**: 3× cada dirección (12 pasos); cada paso auto-clasificado MOVED vs
     BLOCKED por cambio de g_party_x/y (0x5896/97); se registran los hits de
     primitiva entre la inyección de la tecla y su consumo.
  2. **Teclas de comando** (control extra): pasar turno / ztats.
  3. **META-CONTROL**: BP en `kernel_cmd_dispatch` (0x3178) al pulsar 'z' →
     valida base física y mecanismo de BP con independencia del sonido.

Control positivo esperado: un paso BLOCKED (bump) debería disparar una primitiva;
el meta-control DEBE golpear 0x3178.

## 3. LOG DEL TESTIGO

Run headless (oráculo run-dir propio, ventana LIMPIA — sin dosbox ajeno).
Contexto: `game_ds=0x1788`, `load_seg=0x0824`, `g_location=0x11` (un pueblo),
party=(15,26), **`a9ce (flag de sonido) = 1 YA por defecto** en el save** (el
sonido del juego estaba ON sin forzarlo), `drv_seg=0x9D26`. Físicos de BP:
tone_sweep=0A3D2, glide=0A47C, tone_on=0A522.

```
PHASE 0  IDLE baseline (15 pulsos, sin tecla):  prim hits = NONE
PHASE 1  ANDAR (3× cada dirección, 12 pasos):
  RIGHT MOVED  glide@4,glide@5      LEFT MOVED glide@4,glide@5
  UP    MOVED  glide@4,glide@5      DOWN MOVED glide@4,glide@5
  ... (12/12 MOVED, cada uno dispara glide; 1 paso leyó 1 glide en vez de 2
       por una pausa perdida del pty — glide igualmente disparó)
  SUMMARY: moved_silent=0  moved_sound=12  blocked_silent=0  blocked_sound=0
PHASE 2  teclas de comando:
  ' ' (pasar turno) -> NONE      'z' (ztats) -> NONE      ' ' -> NONE
PHASE 3  meta-control BP 0x3178 al pulsar 'z': NO golpeó (ver nota).
```

(Nota: la etiqueta `glide` del log es el nombre que el script del testigo dio a la
BP en `0x223c`; esa primitiva es en realidad `noise_burst` — ver §5.3.)

**Cero falsos positivos** (idle mudo, pasar-turno mudo) y **12/12 pasos con
sonido**: el disparo es SELECTIVO al movimiento. Las primitivas `tone_sweep`
(0x2192) y `tone_on` (0x22e2) **nunca** saltaron al andar → el sonido de paso es
específicamente **`noise_burst` (0x223c)**, ~2 llamadas por paso.

Sobre el meta-control (PHASE 3): la BP en `kernel_cmd_dispatch` (0x3178) al pulsar
'z' no golpeó — casi seguro por el enrutado de 'z'/ztats en pueblo o por el estado
dejado tras la PHASE 2, **no** por la base/mecanismo de BP. La validación de base y
mecanismo REAL es el propio disparo selectivo de la BP de `noise_burst` en el físico exacto
`0824:223C` (12 aciertos en movimiento, 0 en reposo/pasar-turno): una BP mal
direccionada no dispararía nunca (justo lo que le pasó a la de 0x3178) ni lo haría
de forma selectiva. El testigo del andar es sólido.

## 4. VEREDICTO

**ANDAR SÍ PRODUCE SONIDO en el DOS original. El usuario tiene razón; la
conclusión previa "andar es MUDO" queda REFUTADA por el testigo de runtime.**

- Cada PASO efectivo (que mueve al party) dispara `noise_burst` (kernel
  0x223c) — un burst de ruido corto del PC-speaker, ~2 por paso. Pasito/tic audible.
- NO es un tic por turno: pasar turno (barra) y ztats son MUDOS; sólo el
  desplazamiento efectivo suena.
- El flag de sonido del juego (`a9ce`) estaba ON por defecto en el save; no hizo
  falta forzarlo. (Se forzó igualmente, sin cambio.)
- Params exactos + rutina de origen (ret de la llamada): ver §6 (2ª pasada).

Por qué el barrido previo falló (hipótesis (a) confirmada): el sonido de paso NO
sale del handler de movimiento con un `out` propio ni de una primitiva "obvia"
(tone_sweep/beep); sale del wrapper kernel `sfx_footstep 0x433e`, que llama a
`noise_burst` (0x223c) ×2. El movimiento reutiliza el emisor genérico de ruido con
sus propios params, así que un barrido que buscara un emisor DEDICADO al paso, o un
`out` en el handler de commit del movimiento, no lo encontró. El prong espectral
falló porque el burst de paso es corto y se confundió/enmascaró con el clic de tecla.

## 6. Params y rutina de origen del paso (2ª pasada — captura de pila)

BP en `0824:223C` (noise_burst), moviendo; lectura de SS:SP en cada hit (retaddr +
3 args). Captura LIMPIA (paso 0, 3 lecturas coincidentes) + confirmada por el
estático:

```
ret=0x434D  args=(band=0x3E8=1000, dur=0x19=25, step=1)   ; primer burst
ret=0x4367  args=(band=0x5DC=1500, dur=0x19=25, step=1)   ; segundo burst
```

(Pasos 1-3 dieron lecturas RANCIAS del pty — sus args contienen `0x9D26` = drv_seg,
telltale de SS:SP desalineado, el artefacto que avisa oracle.md; se descartan. El
estático es la verdad de fondo y coincide con el paso 0.)

**Rutina origen = kernel `sfx_footstep @ 0x433e`** (cuerpo íntegro):
```
433e: noise_burst(step=1, dur=25, band=1000)   ; call 0x223c  -> ret 0x434D
434d: delay(0x14)                               ; call 0x20c8
4358: noise_burst(step=1, dur=25, band=1500)   ; call 0x223c  -> ret 0x4367
4367: ret
```
Dos bursts de ruido cortos (banda 1000 y luego 1500) con un delay(20) intermedio:
un "tk-tk" grave de pisada. Se dispara en CADA paso efectivo a pie (12/12 en el
testigo). Emisor gateado por `g_unk_a9ce` (sonido ON) como todo el motor.

## 5. Contraste con las notas previas del catálogo SFX

El catálogo previo (`sfx-catalog.md`) NO estaba del todo ciego, pero SÍ erró la
conclusión de gameplay:

1. **§10 "MOVIMIENTO A PIE — ¿suena el paso? NO"**: afirma que "el original NO
   emite ningún sonido en un paso EXITOSO" tras barrer `move_party` (MAINOUT
   0x0354) y el bloque de paso TOWN 0x0810 y no hallar `out` de speaker en la rama
   de éxito. **REFUTADO por el testigo.** El barrido miró los handlers de
   COMMIT del movimiento; la llamada a `sfx_footstep 0x433e` está en OTRO punto del
   flujo de paso (no en 0x0354/0x0810), así que el barrido estático no la enganchó.
   Es exactamente la hipótesis (a) del encargo: el sonido no sale del handler de
   movimiento con `out` propio.
2. **§3.6 "Ambiente cercano — 0x433e (noise_burst ×2)"**: el catálogo YA HABÍA
   derivado la rutina `0x433e` con sus params EXACTOS `(1,25,1000)+delay(0x14)+
   (1,25,1500)` — pero la etiquetó "retumbo/pisada ambiental cercana llamado por
   SJOG", sin conectarla con el paso del jugador. El testigo demuestra que ESA es
   la pisada. (El "llamado por SJOG" no se pudo re-confirmar por ghost-call; el
   caller exacto queda como detalle abierto, pero es irrelevante: el testigo prueba
   que se dispara en cada paso.)
3. **Naming**: `0x223c = pcspeaker_noise_burst` del catálogo es correcto (el PRNG
   `xor 0x9248`); mi tabla de lectura ciega (§1a) lo llamó "glide" de forma
   provisional — se corrige aquí: 0x223c es NOISE_BURST; el glide tonal es 0x43ae.

**En una frase:** el catálogo tenía la pieza (0x433e con sus params) pero la
archivó como "ambiente" y concluyó por separado que andar es mudo; el testigo une
ambos cabos: 0x433e ES la pisada y suena en cada paso.

## 7. PORT (game/src)

Cue nuevo `move-step` en el bus de SFX, emitido en el paso a pie EXITOSO, mapeado
en la piel fiel a los dos noise_burst del asm. Cero consumo de `g_rng` (noise_burst
usa su PRNG local). Commits en `fiel/walk-sound`.

- `game/src/core/sfx.ts`: nuevo `SfxId "move-step"` (+cita 0x433e). Corregido el
  comentario de `move-blocked` que afirmaba "el paso EXITOSO es mudo".
- `game/src/core/game.ts` `move()`: `events.push(sfxEvent("move-step"))` tras
  `{kind:"moved"}` (sólo a pie; naval `navalMove` NO lo emite — sin evidencia).
- `game/src/skin/fiel/speaker.ts`: `"move-step" -> [noiseBurst(1,25,1000),
  noiseBurst(1,25,1500)]` (delay(0x14) intermedio encadenado; hueco exacto →AV).
- Tests: INVERTIDO `sfx-bus.test.ts` "paso EXITOSO … mudo" → ahora exige
  `move-step`; nuevo caso en `fiel-speaker.test.ts`. Gate: `tsc` limpio + `npm test
  -w game` 1284/1284.

**Alcance / cabos abiertos (honestos):**
- Testigo tomado en un PUEBLO (g_location=0x11); overworld usa la MISMA rutina
  kernel 0x433e (mismo motor), pero no se re-verificó paso a paso en campo abierto
  ni en mazmorra. El port emite `move-step` en overworld+pueblo a pie (misma costura
  `move()`); mazmorra/naval quedan sin cue (sin evidencia directa).
- El delay(0x14) intermedio y la calibración Hz/duración exacta son →AV (task #4).
- El caller exacto de 0x433e (¿SJOG?) no se pinneó estáticamente; el testigo hace
  innecesario ese detalle para el veredicto.

