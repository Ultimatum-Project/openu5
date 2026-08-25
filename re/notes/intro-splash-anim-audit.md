# intro-splash-anim-audit.md — auditoría del ARRANQUE ANIMADO (splash/intro) port-vs-original (Task #73)

Fecha 2026-07-15. FASE A de la task #73: audita **pantalla por pantalla** la secuencia de
arranque del original (publisher logo → author logo → título → attract) contra lo que hoy
hace la piel fiel del port, y deriva la ANIMACIÓN (movimiento + cadencia) de cada una.

**Ground truth:** `original/av-referencia/video-P-intro-splash-anims.mov` (48.9 s, grabación
del arranque completo del original en DOSBox) + sus 98 frames a 2 fps en `video-P-frames/`
(`f001`–`f098`, **500 ms/frame**). Complementa `intro-scene-tables.md` (The Summoning),
`intro-blit-formats.md` (decoders .16/.BIT), `intro-ovl-map.md` (reparto INTRO/FONT/FLAMES)
y `sfx-catalog.md §2/§4.10` (sonido de la intro).

> **Nota de método (cadencia).** Las notas previas marcaban las cadencias del arranque como
> `🎥 catálogo AV` (pendientes de un witness de vídeo). **`video-P` ES ese witness.** Los
> timings de abajo salen de contar frames de `video-P` (±500 ms de granularidad), no se
> inventan. La GEOMETRÍA fina de un par de efectos (la voltereta 3D del logo ORIGIN) sigue
> siendo Clase C: se aproxima, declarado.

---

## 0. TL;DR — mapa frame→evento de `video-P` (2 fps)

| frames | t (s) | pantalla | qué ANIMA el original |
|---|---|---|---|
| f001–f003 | 0–1.5 | (terminal tmux, pre-captura) | — |
| **f004–f007** | 1.5–3 | **ORIGIN SYSTEMS INC.** | logo **entra volando desde el fondo con voltereta 3D** (punto→paralelogramo escorzado→línea de canto→frontal) |
| f007–f010 | 3–5 | ORIGIN + "Presents" | estático (hold ~2 s) |
| f011–f012 | 5–6 | negro | transición |
| **f013–f023** | 6–11.5 | **"Lord British"** (firma cursiva) | la firma **se ESCRIBE sola** de izq. a der., letra a letra, con el trazo de rúbrica ya extendido; "Production" (gótica) aparece al completarse |
| f023–f026 | 11.5–13 | "Lord British Production" | estático (hold) |
| **f027–f031** | 13–15.5 | **"Ultima V"** (logo gótico) | **DISSOLVE** de píxeles aleatorios (fizzlefade): el logo azul/verde se revela por píxeles dispersos hasta sólido |
| **f032–f037** | 16–18.5 | **"Warriors of Destiny"** (subtítulo) | **DISSOLVE** de píxeles: el subtítulo rojo/fuego se revela igual, DESPUÉS del logo |
| f037–f060 | 18.5–30 | título completo | subtítulo **parpadea (fuego)** = ciclo de 4 fotogramas `ultima:1-4` (FLAMES) |
| f061–f063 | 30–31.5 | **caja de opciones** (borde azul) | aparece la caja bajo el título; empieza el demo |
| f063–f093 | 31.5–46.5 | **"The Summoning"** (demo) | mapa top-down (castillo, muros de ladrillo) con una figura que camina; rótulo "The Summoning" abajo |
| f094–f098 | 47–49 | **menú** | en la misma caja: `>Select:<` + 6 opciones + "Copyright 1988 Lord British" |

**El original nunca es estático en el arranque:** cada pantalla ENTRA con una animación
propia (voltereta / escritura / dissolve / dissolve) y el título vivo parpadea en fuego
mientras el demo corre en la caja de abajo.

---

## 1. Reparto de código (de `intro-ovl-map.md §4` + este audit)

| Pantalla | Driver | Assets (extraídos, `intro-pics.json`) |
|---|---|---|
| ORIGIN SYSTEMS | preámbulo de arranque (no INTRO.OVL) | `origin` 280×61 (= `TITLE.BIT` subimg mayor) |
| "Lord British" firma | ídem author-logo | `lordbritish` 272×62 (= `BRITISH.BIT`, 1 subimg) |
| "Ultima V" + fuego | `FLAMES.OVL` (thunk 17 B) + animador FONT/kernel | `ultima:0` 319×61 (logo) + `ultima:1-4` 288×49-50 (**4 fotogramas de fuego** del subtítulo) |
| "The Summoning" demo | `FONT.OVL` scene engine (`load_scene 0x0418`/`scene_tick 0x02fc`) | mapa top-down = Clase C (no extraído como escena de attract) |
| Menú de portada | `INTRO.OVL:intro_main_controller 0x0986` | strings DGROUP `0x3182+` |

Los 4 assets de logo/título YA están extraídos (`intro-pics.png`): **no falta arte, falta
MOVIMIENTO.**

---

## 2. Auditoría pantalla por pantalla (original vs port `ui/faithful-intro.ts`)

### 2.1 ORIGIN SYSTEMS — "llega volando" (complaint #1)
- **Original (f004–007):** el logo de rejilla azul entra desde el fondo con una **voltereta
  3D** (rotación sobre el eje horizontal + zoom): f004 un punto/raya central, f005 un
  paralelogramo escorzado (se lee "ORIGIN" torcido), f006 una línea de canto, f007 frontal a
  tamaño completo. Luego "Presents" (gótica) debajo. ~1.5 s de entrada.
- **Port:** `render()` fase `logo` hace `blitPic("origin", centrado)` **estático**, hold
  `LOGO_MS=2600`. Sin entrada.
- **Derivación de la animación (CORREGIDA — el "scaleX luego scaleY" era ERRÓNEO):** el
  witness muestra un TUMBO 3D real, no un rectángulo que crece. Secuencia dura: f004 raya de
  CANTO (azul, corta/lejana) → f005 **CARA TRASERA** con texto EN ESPEJO ("ͶIGIЯO") en
  paralelogramo escorzado → f006 raya de canto otra vez (ancha/cercana) → f007 frontal a
  tamaño completo. Es un plano texturizado que VOLTEA sobre el eje horizontal mientras se
  acerca (~0.75 de vuelta: canto→trasera→canto→frontal). La geometría/nº de tumbos exactos =
  **Clase C** (no hay asm del preámbulo; el vídeo P es la autoridad). Aproximación fiel
  declarada: `originFlip` — `scaleY=|cos θ|` (da las rayas de canto), `zoom` de acercamiento,
  y espejado (`mirrored`) de la cara trasera (`facing=cos θ < 0`); el controlador lo pinta con
  `ctx.scale(-1,1)` en la trasera. "Presents" se revela al asentar. Ver `introAnim.ts`
  `originFlip` + `faithful-intro.ts` `drawOriginFlip`.

### 2.2 "Lord British" — "se escribe" (complaint #2)
- **Original (f013–023):** la **firma cursiva** "Lord British" se dibuja de izq. a der.,
  progresiva (f014 "L", f017 "Lorc", f019 "Lord B", f021 "Lord Brit…", f023 completa), con el
  trazo de rúbrica (subrayado) ya extendido pronto. "Production" (gótica) aparece al terminar.
  ~5 s.
- **Port:** `blitPic("lordbritish", centrado)` **estático**.
- **Derivación (CORREGIDA — el clip lineal único era ERRÓNEO):** el write-on son **DOS
  PISTAS**, no un solo barrido de todo el bitmap (re-mirado f014/f017/f019/f021/f022):
  1. **rúbrica/subrayado** (banda INFERIOR del bitmap): se traza RÁPIDO y llega a **ancho
     completo en ~1 s** — en f017 el subrayado ya cruza toda la pantalla con su rulo terminal
     a la derecha mientras las letras van sólo por "Lorc".
  2. **letras cursivas** (banda SUPERIOR): se escriben izq→der **por encima** del subrayado ya
     completo, durante los ~4 s (f013→f022).
  Implementación fiel sin datos vectoriales: partir `lordbritish` en dos bandas horizontales y
  revelar cada una a su ritmo — pista 1 a ancho completo en la primera `SIGNATURE_UNDERLINE_FRAC`
  (~0.25) del write, pista 2 por clip lineal en todo el write. El asset ya es la firma exacta;
  la partición fina (alto de la banda) = Clase C declarada. Ver `introAnim.ts`
  `signatureUnderlineWidth`/`signatureRevealWidth`/`signatureUnderlineBand` +
  `faithful-intro.ts` `drawSignature`. "Production" es parte del asset o un 2º blit al 100 %.

### 2.3 "Ultima V" + "Warriors of Destiny" — DISSOLVE (complaint #3)
- **Original (f027–037):** revelado por **dissolve de píxeles aleatorios** (fizzlefade). 1º el
  logo `ultima:0` (azul/verde) se llena de píxeles dispersos hasta sólido (f027–031); 2º el
  subtítulo se revela igual (f032–037), en rojo/fuego. Tras asentar, el subtítulo **parpadea**
  = ciclo `ultima:1-4` (fuego de FLAMES).
- **Port:** el logo `ultima:0` aparece **instantáneo** en el menú; el subtítulo es **texto**
  (`renderTitleMenu`/`renderTitleCard` centerText "Warriors of Destiny"), NO el bitmap de
  fuego, y **no** parpadea.
- **Derivación:**
  - Dissolve = permutación pseudoaleatoria de píxeles del bitmap final (el mismo patrón que el
    "moongate dissolve" y la cortina de Acknowledgements ya en la piel). Revelar `ultima:0`,
    luego el subtítulo. Cadencia ~2.5 s c/u (video-P).
  - Subtítulo = **bitmap** `ultima:1` (no texto), animado ciclando `ultima:1-4` (fuego). Los 4
    fotogramas 288×49-50 SON el fuego del subtítulo (verificado extrayéndolos: los 3 vistos
    difieren sólo en el patrón de llama).

### 2.4 Attract — demo en el ÁREA DE OPCIONES (complaint #4)
- **Original (f061–098):** el título (logo + subtítulo de fuego) **persiste arriba**; debajo
  hay una **caja de borde azul** que reproduce el demo **"The Summoning"** (mapa top-down con
  figura andante + rótulo "The Summoning"), y luego se convierte en el **menú** (`>Select:<` +
  6 opciones + copyright) en la misma caja.
- **Port:** fase `attract` pinta `renderTitleCard` (título de TEXTO) + un **Avatar** (tile 284)
  caminando rutas `BRITISH.PTH` sobre cartón en blanco; el menú es una pantalla aparte
  (`renderTitleMenu`) sin caja de borde ni subtítulo de fuego.
- **Derivación / límites:** la ruta de la figura (`BRITISH.PTH`) ya está derivada (S13b). Lo
  FIEL que falta y es barato: (a) título persistente = logo `ultima:0` + subtítulo de fuego
  `ultima:1-4` arriba también en attract; (b) rótulo "The Summoning" bajo la caja; (c) caja de
  borde azul. El **fondo de mapa top-down** del demo es **Clase C** (es un render de mapa de
  Britannia/castillo con cámara propia; no hay una "escena de attract" extraída) — se deja
  declarado; la figura andante sobre la caja es la aproximación ya existente.
- **ESTADO (item E, hecho):** (a) el título+fuego YA persisten arriba en attract/menú/créditos
  (`render()` gate menú|attract|créditos, con el reloj de fuego dedicado de C). (c) **caja de
  borde azul implementada** (`INTRO_PANEL` = x 4..313, y 121..199, MEDIDO de f062; borde EGA
  azul `#0000aa`), dibujada en attract+menú; la figura del demo se RECORTA al interior del
  panel (`ctx.clip`). Geometría fina y estilo de línea (simple vs doble) = Clase C declarada
  (calibración visual = fase 2). (b-rótulo "The Summoning") ya lo pinta el cartón; el mapa
  top-down de fondo sigue Clase C.

---

## 3. SONIDO del arranque — NO hay cue de speaker derivable (contra "CON sonido")

El reporte del usuario dice que el título+subtítulo entran **CON sonido**. Buscado el emisor;
**no existe ninguno derivable ni con witness** para el ORIGIN / la firma LB / el dissolve:

1. **`video-P` es MUDO.** La pista de audio del `.mov` tiene RMS=0 en los 48.9 s (la grabación
   no capturó el altavoz). No sirve de witness sonoro.
2. **`FLAMES.OVL` = 831 B, CERO speaker** (sin `call` a primitiva, sin `out 0x61/0x42`). El
   título de fuego no suena por sí mismo.
3. **`INTRO.OVL` = CERO llamadas de speaker** (`sfx-catalog.md §2`).
4. **Las 2 noise de `FONT.OVL` NO son del título:** `0x3ca` = `noise_burst(20,60,10000)`
   **gateado a `cmp byte[0xbd29],2`** (modo-de-escena 2 = la crepitación/trueno de "The
   Summoning", `sfx-catalog §4.10`), no el logo/título/dissolve; `0x88d` idem dentro del scene
   engine. Ninguno se dispara en el ORIGIN, la firma ni el dissolve.

**Veredicto (mandato cero-fabricación):** NO se cablea ningún cue de speaker al arranque —
sería fabricar. La "sensación de sonido" del usuario probablemente es la **MÚSICA** del intro
(AdLib/Tandy, sistema aparte = `ui/music.ts`/F7), no un SFX de altavoz. Atribuir un sonido de
speaker al título exige un **witness de audio de DOSBox** (task #4, catálogo AV) o RE del
preámbulo de arranque; hasta entonces, las animaciones van **mudas** (fiel a lo derivable).

---

## 4. Plan FASE B (por tandas; sólo lo derivable, sin fabricar)

- **Tanda 1 — logos:** ORIGIN fly-in (zoom+desvolteo, §2.1, Clase-C-declarado) + firma LB por
  barrido de clip (§2.2, fiel). En `ui/faithful-intro.ts` fase `logo`.
- **Tanda 2 — título:** nueva fase `title` con dissolve de `ultima:0` y luego del subtítulo
  bitmap, + subtítulo de fuego `ultima:1-4` (ciclo) reutilizado en menú/attract (§2.3).
  Reutiliza el patrón de dissolve del moongate/Acknowledgements.
- **Tanda 3 — attract:** título persistente (logo+fuego) + rótulo "The Summoning" + caja de
  borde en la fase `attract` (§2.4). Fondo de mapa = Clase C, no se toca.
- **Sonido:** ninguno (§3). Se documenta como pendiente de witness AV (#4).

Verificación: `tsc` · `npm test -w game` · e2e `title`/`faithful` · navegador VISIBLE lado a
lado con `video-P`.

---

## Apéndice — reproducción
```
# frames del witness (2 fps, 500 ms/frame):
ls original/av-referencia/video-P-frames/f0*.png            # f001..f098
# audio mudo:
ffmpeg -i original/av-referencia/video-P-intro-splash-anims.mov -vn -ac 1 -ar 22050 /tmp/p.wav  # RMS=0
# FLAMES sin speaker:
grep -cE "out 0x(61|42)|call .*(a192|a23c|a2c0)" re/disasm/FLAMES.OVL.asm   # 0
# FONT noise gateada a modo-escena 2 (no título):
sed -n '/03b7:/,/03cd:/p' re/disasm/FONT.OVL.asm            # cmp [0xbd29],2 ; call 0x405c(20,60,10000)
# assets ya extraídos:
python3 -c "import json;[print(e['name'],e['width'],e['height']) for e in json.load(open('game/assets/intro-pics.json'))['entries'] if e['name'] in ('origin','lordbritish','ultima:0','ultima:1')]"
```
