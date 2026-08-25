/**
 * INTRO-ANIM (Task #73) — helpers PUROS de las animaciones del arranque
 * (splash/intro) de la piel fiel. La derivación (qué anima cada pantalla y su
 * cadencia) está en `re/notes/intro-splash-anim-audit.md`, contra el witness
 * `video-P` (98 frames @2 fps). Aquí sólo la matemática testeable; el dibujo en
 * canvas vive en `ui/faithful-intro.ts`.
 *
 * 🔴 CORREGIDO (#220). Este encabezado decía «Sin sonido: el audit demuestra que el
 * arranque NO emite speaker derivable … las animaciones van mudas (audit §3)». La
 * PREMISA era falsa por un hueco de CENSO, no por el razonamiento: `intro-splash-anim-
 * audit.md §3` y `intro-av-211-derivacion.md §4` barrieron ULTIMA.EXE y los 24 overlays
 * — y los CUATRO `*.DRV` se quedaron fuera. El emisor de los dos sonidos del título vive
 * ahí: `EGA.DRV:0x27af` es un `noise_burst` propio del driver de vídeo, con sus tres
 * parámetros en variables `cs:` y su PRNG local. Derivación completa (y el porqué de que
 * el censo diera cero) en `re/notes/intro-sonidos-220.md`.
 */

/** Cadencias medidas de `video-P` (2 fps → ±500 ms). */
export const BOOT_TIMINGS = {
  /** ORIGIN: entrada volando (f004→f007 ≈ 1.5 s) + hold (f007→f010 ≈ 2 s). */
  originFlyMs: 1300,
  originHoldMs: 1500,
  /** "Lord British": la firma se escribe (f013→f023 ≈ 5 s) + hold. */
  lbWriteMs: 4200,
  lbHoldMs: 1200,
  /** Dissolve del logo `ultima:0` (f027→f031 ≈ 2.5 s) y del subtítulo (f032→f037 ≈ 2.5 s). */
  titleDissolveMs: 2200,
  /**
   * Total del subtítulo, repartido entre sus DOS etapas (ver `subtitleFireFrac`).
   * ⚠ El valor ABSOLUTO sigue siendo el de `video-P` (±500 ms) y está pendiente de
   * revisión: la grabación de #211 mide 12,0 s de subtítulo. Esa corrección NO se
   * aplica aquí porque depende de una premisa sin acreditar (si la espera del
   * original es por tick del INT 1Ch o un busy-wait, en cuyo caso el tiempo medido
   * sería un artefacto de los 3000 cycles/ms de DOSBox). #211 sólo arregla el
   * MECANISMO (una etapa → dos), no la duración.
   */
  subtitleDissolveMs: 2200,
  /**
   * Reparto del subtítulo entre etapa 1 (FUEGO, letras en negro) y etapa 2 (LETRAS
   * a blanco). El original hace DOS dissolves de puntos SECUENCIALES, no uno:
   * medido en `intro-detalles-2026-08-13.mov` → fuego 4,217→10,233 s (6,016 s) y
   * letras 10,292→16,242 s (5,950 s) = 50,3 % / 49,7 % ⇒ mitad y mitad.
   */
  subtitleFireFrac: 0.5,
  /** Hold del título ya asentado antes de pasar al attract/menú. */
  titleHoldMs: 1400,
  /** Ciclo de fuego del subtítulo `ultima:1-4` (parpadeo, f037+). */
  fireFrameMs: 120,
} as const;

/**
 * Clase de píxel del subtítulo `ultima:1-4` para el dissolve de DOS etapas (#211).
 * El asset es EGA de 16 colores y OPACO entero (censado: 32,4 % negro puro, 14,3 %
 * blanco puro, el resto rojos/amarillos de llama), así que la clase se decide por
 * color, no por alpha.
 */
export type DissolveClass = "all" | "fire" | "letters";

/** Blanco puro EGA = las LETRAS góticas del subtítulo (2ª etapa del dissolve). */
export function isLetterPixel(d: Uint8ClampedArray | number[], i: number): boolean {
  return (d[i * 4] ?? 0) > 200 && (d[i * 4 + 1] ?? 0) > 200 && (d[i * 4 + 2] ?? 0) > 200;
}

/**
 * Negro del asset = FONDO. La intro pinta `#000000` detrás, así que revelarlo es
 * indistinguible de no revelarlo: se excluye del presupuesto de la 1ª etapa para
 * que el fuego termine de llenarse justo al acabar la etapa.
 */
export function isBackdropPixel(d: Uint8ClampedArray | number[], i: number): boolean {
  return (d[i * 4] ?? 0) + (d[i * 4 + 1] ?? 0) + (d[i * 4 + 2] ?? 0) <= 40;
}

/**
 * Índices de los píxeles que participan en un dissolve, acotados a una CLASE.
 * `all` = todos los opacos (comportamiento histórico). `fire` = opacos que no son
 * letra NI fondo. `letters` = sólo las letras blancas. La PARTICIÓN es la que hace
 * las dos etapas del subtítulo (#211): fire ∪ letters = opacos no-fondo, y son
 * disjuntas.
 */
export function dissolveIndices(
  data: Uint8ClampedArray | number[],
  total: number,
  cls: DissolveClass,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    if ((data[i * 4 + 3] ?? 0) <= 16) continue;
    if (cls !== "all") {
      if (isLetterPixel(data, i) !== (cls === "letters")) continue;
      if (cls === "fire" && isBackdropPixel(data, i)) continue;
    }
    out.push(i);
  }
  return out;
}


/**
 * Cadencia por fotograma del cine-guion de la demo de portada. Vive AQUÍ (módulo puro) y no
 * en `faithful-intro.ts` para que la guarda pueda leer EL VALOR REAL sin arrastrar el DOM
 * (#211: el aserto que redefine la constante que va a comprobar es un verde vacuo).
 *
 * = 1 tic del INT 1Ch (PIT 18,2065 Hz ≈ 54,9 ms) = el NOMINAL de `pause(1)` que llama
 * `scene_tick` (FONT.OVL 0x03b0-0x03b4 → kernel `pause` 0x20fa). Ver la guarda de #211 en
 * `game/tests/fiel-introanim.test.ts` para el régimen completo (por qué NO se calca el ~2×
 * de la grabación en DOSBox-X).
 */
export const DEMO_MS_PER_FRAME = 1000 / 18.2065;

/** xorshift32 determinista (para permutaciones de dissolve reproducibles en test). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 0x1234;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
}

/**
 * Baraja Fisher-Yates in-place con PRNG sembrado (determinista). Es el ORDEN de
 * revelado del dissolve/fizzlefade: los píxeles del bitmap final aparecen en esta
 * permutación pseudoaleatoria hasta completarse.
 */
export function shuffleInPlace(arr: Uint32Array, seed = 0x5eed): Uint32Array {
  const rng = makeRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng() % (i + 1);
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

/**
 * Nº de vueltas del tumbo 3D del logo ORIGIN. RE-DERIVADO del witness `video-P` a 60 fps
 * (antes 0.75, de un muestreo a 2 fps que sólo veía 4 fotogramas del tumbo): el logo tumba
 * ~2 veces mientras se acerca — se ven DOS pasadas por la cara trasera espejada antes de
 * asentar frontal (reporte del usuario "da más vueltas"). Debe ser de la forma k−0.25 para
 * que la cara final quede FRONTAL (theta_fin = 90°+TURNS·360° ≡ 0° ⇒ facing=+1): 1.75 = 2
 * pasadas traseras y remate frontal. Nº exacto de tumbos/easing = Clase C (declarado).
 */
export const ORIGIN_FLIP_TURNS = 1.75;

/**
 * Transformada del TUMBO 3D del logo ORIGIN a progreso `t ∈ [0,1]` (audit §2.1,
 * mecanismo CORREGIDO — bug #73 T1). El logo NO "crece" (scaleX luego scaleY): es
 * un plano texturizado que VOLTEA sobre el eje horizontal mientras se acerca. El
 * witness `video-P` lo prueba: f004 = raya azul de CANTO; f005 = CARA TRASERA con
 * el texto EN ESPEJO ("ͶIGIЯO") en paralelogramo escorzado; f006 = raya de canto
 * otra vez (ya cercana/ancha); f007 = frontal a tamaño completo. La malla 3D
 * exacta es Clase C; esto la evoca con escorzo vertical (`scaleY=|cosθ|`, da rayas
 * horizontales de canto), zoom de acercamiento y espejado de la cara trasera.
 *
 * `theta` va de 90° (canto, f004) a 90°+360°·TURNS (frontal, f007), pasando por
 * 180° (trasera plena, f005) y 270° (canto de nuevo, f006). `facing=cos(theta)`:
 * <0 = vemos la cara trasera (espejada). `zoom` crece (se acerca).
 */
export function originFlip(
  t: number,
): { scaleX: number; scaleY: number; mirrored: boolean; alpha: number } {
  const c = Math.max(0, Math.min(1, t));
  const theta = Math.PI / 2 + c * (2 * Math.PI * ORIGIN_FLIP_TURNS);
  const facing = Math.cos(theta);
  const zoom = 0.3 + 0.7 * c; // pequeño/lejos → grande/cerca
  return {
    scaleX: zoom,
    scaleY: zoom * Math.abs(facing), // canto (facing≈0) ⇒ raya fina
    mirrored: facing < 0, // cara trasera ⇒ espejada (witness f005)
    alpha: Math.min(1, c * 6 + 0.15),
  };
}

/**
 * Ancho revelado (px) de las LETRAS cursivas de "Lord British" que se escriben de
 * izq→der a progreso `t` (barrido de clip lineal sobre la banda SUPERIOR del
 * bitmap `lordbritish`). Puro; el controlador recorta el blit a `[0, width)`.
 *
 * NOTA (bug #73 T1): el write-on NO es una única pasada lineal de TODO el bitmap.
 * El witness `video-P` f014/f017/f019/f022 muestra DOS PISTAS: (1) la rúbrica/
 * subrayado (banda inferior) se traza rápido y llega a ANCHO COMPLETO en ~1 s
 * (f017: el subrayado cruza toda la pantalla con su rulo terminal mientras las
 * letras van sólo por "Lorc"); (2) las letras se escriben DESPUÉS, izq→der, POR
 * ENCIMA del subrayado ya completo, hasta f022. Esta función es la PISTA 2
 * (letras); la pista 1 es `signatureUnderlineWidth`.
 */
export function signatureRevealWidth(t: number, width: number): number {
  return Math.round(Math.max(0, Math.min(1, t)) * width);
}

/**
 * Fracción de la animación de escritura en que la rúbrica/subrayado (pista 1)
 * alcanza el ANCHO COMPLETO. Derivado de video-P: la rúbrica está full en f017
 * (~1 s tras el inicio en f013) frente a los ~4 s del write completo (f022) ⇒
 * la pista 1 corre ~4× más rápida que la 2. Cadencia fina = Clase C (declarada).
 */
export const SIGNATURE_UNDERLINE_FRAC = 0.25;

/**
 * Ancho revelado (px) de la RÚBRICA/subrayado (pista 1) de "Lord British": banda
 * INFERIOR del bitmap `lordbritish`, que se traza rápido y llega a ancho completo
 * en la primera `SIGNATURE_UNDERLINE_FRAC` de la animación (witness f017). Puro.
 */
export function signatureUnderlineWidth(t: number, width: number): number {
  const c = Math.max(0, Math.min(1, t)) / SIGNATURE_UNDERLINE_FRAC;
  return Math.round(Math.min(1, c) * width);
}

/**
 * Alto (px) de la banda INFERIOR del bitmap `lordbritish` que es la rúbrica/
 * subrayado (pista 1); el resto (banda superior) son las letras (pista 2).
 * Calibrado en fase 2 midiendo el bitmap renderizado (320×200): el trazo continuo
 * del subrayado vive en las filas ~50-51 de las 62 del bitmap (el bitmap tiene
 * margen VACÍO abajo), así que la banda debe llegar hasta ahí ⇒ ~22% del alto
 * (≈14 px), no el 10% inicial que caía en el margen vacío y dejaba el subrayado en
 * la pista de las letras. Geometría fina = Clase C; el mecanismo de 2 pistas es el
 * witness (f017: subrayado full-width mientras las letras van por "Lorc").
 */
export function signatureUnderlineBand(height: number): number {
  return Math.max(2, Math.round(height * 0.22));
}

/**
 * Adelgazamiento morfológico Zhang-Suen: reduce una máscara binaria (1=tinta) a un
 * ESQUELETO de 1 px que preserva la topología del trazo — la línea media por la que
 * "viaja la pluma". Es el paso previo al orden de escritura caligráfica de la firma
 * (`signatureStrokeOrder`). Máscara en row-major (idx = y*w+x); devuelve una COPIA
 * adelgazada. Determinista; O(iteraciones·área) (para la firma 272×62 son ~pocos ms).
 */
export function zhangSuenThin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = Uint8Array.from(mask);
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]!;
  const toDel: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toDel.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (img[y * w + x] !== 1) continue;
          const p2 = at(x, y - 1),
            p3 = at(x + 1, y - 1),
            p4 = at(x + 1, y),
            p5 = at(x + 1, y + 1),
            p6 = at(x, y + 1),
            p7 = at(x - 1, y + 1),
            p8 = at(x - 1, y),
            p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          // A = nº de transiciones 0→1 en la secuencia circular de vecinos.
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++;
          if (a !== 1) continue;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toDel.push(y * w + x);
        }
      }
      if (toDel.length) {
        changed = true;
        for (const i of toDel) img[i] = 0;
      }
    }
  }
  return img;
}

/**
 * Orden de REVELADO CALIGRÁFICO de una firma bitmap (task #19, "firma por trazo"):
 * ordena los píxeles de TINTA a lo largo del recorrido de la pluma, para que la firma
 * "se escriba sola" siguiendo su curva cursiva en vez de un barrido vertical duro.
 *
 * Mecanismo: (1) esqueletiza la máscara de tinta (`zhangSuenThin`) → línea media;
 * (2) encadena el esqueleto por VECINO-MÁS-CERCANO, sembrado en el punto más a la
 * IZQUIERDA y reanudando en el izquierdo no visitado tras un salto (>3 px) — la
 * restricción L→R del witness `video-P` f014–f022 (la rúbrica barre rápido de izq. a
 * der., las letras se escriben L→R encima); (3) a cada píxel de tinta le asigna el
 * RANGO del punto de esqueleto más cercano, con desempate por x. Devuelve los índices
 * (y*w+x) de los píxeles de tinta en orden de escritura. Puro y determinista.
 *
 * El witness NO fija el trazo al píxel (2 fps) ⇒ el recorrido exacto de la pluma es
 * Clase C; esto lo APROXIMA con la línea media real del asset + la marcha L→R. Sin
 * esqueleto (máscara vacía/degenerada) cae a un orden por x puro (L→R).
 */
export function signatureStrokeOrder(mask: Uint8Array, w: number, h: number): Uint32Array {
  // Píxeles de tinta (a revelar).
  const ink: number[] = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) ink.push(i);
  if (ink.length === 0) return new Uint32Array(0);

  // Esqueleto de la tinta.
  const skel = zhangSuenThin(mask, w, h);
  const sx: number[] = [];
  const sy: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (skel[y * w + x]) {
        sx.push(x);
        sy.push(y);
      }
    }
  }
  const n = sx.length;
  const byX = (a: number, b: number): number => a % w - (b % w) || ((a / w) | 0) - ((b / w) | 0);
  if (n === 0) {
    // Sin esqueleto: L→R puro sobre la tinta.
    return Uint32Array.from(ink.sort(byX));
  }

  // Cadena por vecino-más-cercano, sembrada en el punto más a la izquierda; ante un
  // salto (gap > 3 px) reanuda en el punto izquierdo no visitado (marcha L→R global).
  const visited = new Uint8Array(n);
  const rank = new Int32Array(n).fill(0);
  const leftmostUnvisited = (): number => {
    let bi = -1;
    let bx = Infinity;
    let by = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      if (sx[i]! < bx || (sx[i]! === bx && sy[i]! < by)) {
        bx = sx[i]!;
        by = sy[i]!;
        bi = i;
      }
    }
    return bi;
  };
  let cur = leftmostUnvisited();
  let r = 0;
  while (cur >= 0) {
    visited[cur] = 1;
    rank[cur] = r++;
    const cx = sx[cur]!;
    const cy = sy[cur]!;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const dx = sx[i]! - cx;
      const dy = sy[i]! - cy;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) break;
    cur = bd > 9 ? leftmostUnvisited() : best;
  }

  // Cada píxel de tinta hereda el rango del punto de esqueleto más cercano; clave de
  // orden = rango·W + x (desempate L→R). Fuerza bruta (ink·skel una sola vez).
  const key = new Float64Array(ink.length);
  for (let k = 0; k < ink.length; k++) {
    const px = ink[k]! % w;
    const py = (ink[k]! / w) | 0;
    let br = 0;
    let bd = Infinity;
    for (let j = 0; j < n; j++) {
      const dx = sx[j]! - px;
      const dy = sy[j]! - py;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        br = rank[j]!;
      }
    }
    key[k] = br * (w + 1) + px;
  }
  const idx = Array.from(ink.keys()).sort((i, j) => key[i]! - key[j]!);
  return Uint32Array.from(idx, (i) => ink[i]!);
}

/** Índice de fotograma de fuego del subtítulo (`ultima:1-4`) para el ciclo de parpadeo. */
export function fireFrameIndex(elapsedMs: number, frames = 4): number {
  return Math.floor(elapsedMs / BOOT_TIMINGS.fireFrameMs) % frames;
}

/**
 * Fases de la portada donde el subtítulo de FUEGO ("Warriors of Destiny",
 * `ultima:1-4`) está EN PANTALLA y por tanto DEBE seguir ardiendo de forma
 * continua. En el original las llamas nunca se congelan: el animador de fuego
 * (fn32 del EGA.DRV, `re/notes/fn32-fire-noise-mechanism.md`) corre en CADA tick
 * del kernel, INCONDICIONAL, mientras el logo/subtítulo estén visibles —
 * incluidos el menú de portada y el pergamino de Acknowledgements. Witness:
 * `video-P` f094–f098 (menú en pantalla) muestra las llamas cambiando de forma
 * frame a frame. Coincide con la condición de blit del subtítulo en
 * `render()` (menú/attract/créditos) MÁS las pantallas de NOMBRE/SEXO de la
 * creación (carril intro-touch): `renderCreatePanel` pinta el MISMO chrome del
 * título (logo + subtítulo de fuego, witness ORIG_02/03) y el fn32 del original
 * es incondicional — sin estas fases el fuego (y el cursor, ver
 * `wavePhaseAnimates`) se congelaban al pedir el nombre (bug reportado).
 */
export function firePhaseAnimates(phase: string): boolean {
  return (
    phase === "menu" ||
    phase === "attract" ||
    phase === "credits" ||
    phase === "name" ||
    phase === "sex"
  );
}

/**
 * Cadencia del cursor de OLA FLAMEANTE (~110 ms/fase): la MISMA del getstring de
 * consola del juego (glifos IBM.CH 0x05-0x08 ciclados al tick base F-A; ver
 * `CONSOLE_CURSOR_WAVE` en fiel/skin.ts y la banda "Select:" del menú —
 * INTRO.OVL 0x0d62, `read_key_timed` comparte el cursor con el input del juego).
 */
export const WAVE_TICK_MS = 110;
/** Nº de glifos del ciclo de la ola (0x05..0x08). */
export const WAVE_FRAMES = 4;

/** Índice de fase de la ola en el instante `tsMs` (ciclo continuo de 4 glifos). */
export function waveFrameIndex(tsMs: number): number {
  return Math.floor(tsMs / WAVE_TICK_MS) % WAVE_FRAMES;
}

/**
 * Fases de la intro con un cursor de OLA en pantalla que debe animar de continuo:
 * el prompt "Select: " del menú (INTRO.OVL 0x0d62) y el eco del NOMBRE de la
 * creación (`:<tecleado>` + ola, reuso #21). El reloj de la intro repinta cuando
 * la fase de ola cambia en estas pantallas — antes el cursor del nombre quedaba
 * CONGELADO (sólo se repintaba al teclear; bug reportado del carril intro-touch)
 * y el del menú iba a remolque de la cadencia del fuego.
 */
export function wavePhaseAnimates(phase: string): boolean {
  return phase === "menu" || phase === "name";
}

/**
 * Paso PURO del reloj de OLA: fase viva y si cambió respecto a la previa. Gemelo
 * de `fireClockStep` para el cursor; fuera de las fases con ola no avanza (el
 * controlador no repinta por ella).
 */
export function waveClockStep(
  phase: string,
  tsMs: number,
  prevFrame: number,
): { frame: number; changed: boolean } {
  if (!wavePhaseAnimates(phase)) return { frame: prevFrame, changed: false };
  const frame = waveFrameIndex(tsMs);
  return { frame, changed: frame !== prevFrame };
}

/**
 * Paso PURO del reloj de fuego del subtítulo: dado la fase actual, el timestamp
 * del rAF y el fotograma previo, devuelve el fotograma vivo y si cambió. En una
 * fase con subtítulo de fuego el fotograma AVANZA con el tiempo (nunca se
 * congela — corregido para el menú, que antes no tenía reloj); fuera de ellas se
 * mantiene el previo. El controlador lo usa para repintar sólo cuando cambia.
 */
export function fireClockStep(
  phase: string,
  tsMs: number,
  prevFrame: number,
): { frame: number; changed: boolean } {
  if (!firePhaseAnimates(phase)) return { frame: prevFrame, changed: false };
  const frame = fireFrameIndex(tsMs);
  return { frame, changed: frame !== prevFrame };
}

/* ────────────────────────────────────────────────────────────────────────────
 * SONIDO DEL TÍTULO (#220) — el emisor es el DRIVER DE VÍDEO, no el kernel
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Los dos sonidos que el usuario oye en la portada (el del logo y el crepitar de
 * «Warriors of Destiny») los emite `EGA.DRV`, al que el kernel entra por
 * `lcall [0x5350]` con un SELECTOR. Las dos rutas, con su cita:
 *
 *   sel 0x66 (fn34 @0x256b), CF=0 — DISSOLVE de pantalla completa. Llega desde
 *     `ULTIMA.EXE:0x0f46` (`0x0f5b clc` · `0x0f5c mov [0x5350],0x66`), que
 *     `INTRO.OVL:show_logo_screen 0x05b0` llama en `0x060c` con el rectángulo
 *     (0,0)-(319,100). El revelado es un LFSR (`cs:[0x2541]`, taps en `bx`) y cada
 *     DOS píxeles revelados (`0x2691 xor cs:[0x253f],1` + `0x269d je`) dispara
 *     `0x269f call 0x27af` y `0x26a2 inc cs:[0x27a7]` — es decir, una ráfaga de
 *     ruido por cada 2 píxeles con la BANDA subiendo de 1 en 1: un barrido que
 *     empieza finísimo y agudo y se va ensanchando. Banda inicial en la imagen
 *     del fichero = 0x00f0.
 *
 *   sel 0x69 (fn35 @0x282d), CF=1 — SUBTÍTULO. Llega desde
 *     `INTRO.OVL:intro_music_cmd 0x20ae` (`0x20b7 stc` · `0x20b8 mov [0x5350],0x69`),
 *     al que `show_logo_screen` pasa el búfer de WD.BIT en `0x0657`. El cuerpo
 *     (`0x28c6`) llama DOS VECES al mismo bucle de dissolve `0x296a`, con
 *     `cs:[0x28c0]` = 1 y luego 0 — que son las DOS ETAPAS que #211 midió en
 *     vídeo (fuego con las letras recortadas / letras a blanco). Cada
 *     `cs:[0x2968]` píxeles (0x80, o 0x100 en máquina lenta: `0x28ca cmp
 *     cs:[0x1c1e],0xfa`) el bucle avanza UN FOTOGRAMA DE FUEGO (`0x29a0 call
 *     0x2832`) y, si `(prng & 0x1ff) < cs:[0x28c4]`, emite
 *     `noise_burst(step=1, dur=0x19, band=0xbb8)` (`0x29b7`/`0x29be`/`0x29c5`).
 *     El umbral arranca en 0x190 y BAJA de 3 en 3 (`0x29a3`) ⇒ el crepitar es
 *     denso al principio y se va ralaeando. Se reinicia en cada etapa (0x2909/0x2915).
 *
 * 🔴 El `noise_burst` del DRIVER **no es** el del kernel aunque comparta forma y
 * PRNG: `0x27d9 shr cx,1` divide la banda ANTES de restarle el piso 0x64, así que
 * su rango es `[0x64, band/2]` y el del kernel (`ULTIMA.EXE:0x223c`, `0x226b mov
 * cx,[bp+4]` sin desplazar) es `[0x64, band]`. Copiar la banda cruda al
 * `noiseBurst()` del port —que implementa el convenio del KERNEL— ENSANCHARÍA el
 * sorteo al doble. Por eso los cues del catálogo pasan `band >> 1`.
 *
 * ✅ CABO CERRADO por #254 (aquí vivía la afirmación falsa, y se deja escrito el porqué
 * para que no vuelva): este bloque decía que el port toma el valor sorteado como Hz
 * mientras el binario lo programa como DIVISOR del PIT (`0x27e8-0x27f4`), y que por tanto
 * las dos leyes eran «monótonas pero INVERSAS». **No lo son: son la misma.** El valor sí
 * es el divisor de esa `div`, pero el dividendo `0x1234DE` es el RELOJ del PIT (1.193.182
 * Hz), así que el cociente es el CONTADOR que se escribe al puerto 0x42 — y la frecuencia
 * que suena es `reloj/contador` = el valor sorteado. Lo que la nota llamaba «frecuencia
 * efectiva» era el contador. Derivación y guarda con control negativo en
 * `tests/intro-sonidos-220.test.ts` (#254); `speaker.ts` lleva la cita fila a fila.
 */

/** Banda inicial del ruido del dissolve de pantalla (`EGA.DRV` word en 0x27a7). */
export const TITLE_FIZZLE_BAND0 = 0xf0;
/** Píxeles revelados por ráfaga: la alternancia de `cs:[0x253f]` (0x2691) = 1 de cada 2. */
export const TITLE_FIZZLE_PIXELS_PER_BURST = 2;
/**
 * Ráfagas que el port agrupa en UN cue. El original programa el PIT una vez por
 * ráfaga (~8.000 en el logo); Web Audio no puede con un oscilador por ráfaga, así
 * que se emite un `noiseBurst` de `TITLE_FIZZLE_BURSTS_PER_CUE` pulsos — el NÚMERO
 * TOTAL de pulsos y su cadencia quedan exactos, y lo que se cuantiza es sólo la
 * banda (que dentro de un grupo sube 64 sobre un recorrido de miles). Declarado.
 */
export const TITLE_FIZZLE_BURSTS_PER_CUE = 64;

/** `band` del crepitar del subtítulo (`EGA.DRV:0x29b7 mov cs:[0x27a7],0xbb8`). */
export const SUBTITLE_CRACKLE_BAND = 0xbb8;
/** `dur` del crepitar (`0x29be mov cs:[0x27a9],0x19`); `step` = 1 (nadie escribe 0x27ab). */
export const SUBTITLE_CRACKLE_DUR = 0x19;
/** Píxeles entre ticks de sonido/fuego: `cs:[0x2968]` = 0x80 (máquina rápida). */
export const SUBTITLE_CRACKLE_PIXELS_PER_TICK = 0x80;
/** Umbral inicial por etapa (`0x2909`/`0x2915 mov cs:[0x28c4],0x190`). */
export const SUBTITLE_CRACKLE_THRESHOLD0 = 0x190;
/** Decremento del umbral por tick (`0x29a3 sub cs:[0x28c4],3`). */
export const SUBTITLE_CRACKLE_THRESHOLD_STEP = 3;
/** Máscara del sorteo (`0x29ad and ax,0x1ff`). */
export const SUBTITLE_CRACKLE_MASK = 0x1ff;
/** Semilla del PRNG del driver: el word que la imagen de EGA.DRV trae en 0x28c2. */
export const DRIVER_NOISE_SEED = 0x7664;

/** Estado del emisor de sonido del título. Mutable y sin DOM: testeable en puro. */
export interface TitleSoundState {
  /** Píxeles revelados aún no convertidos en ráfagas (etapa del logo). */
  fizzlePixels: number;
  /** Ráfagas ya emitidas = cuánto ha subido la banda desde `TITLE_FIZZLE_BAND0`. */
  fizzleBursts: number;
  /** Píxeles revelados aún no convertidos en ticks (etapas del subtítulo). */
  cracklePixels: number;
  /** Umbral vivo del sorteo del crepitar. */
  crackleThreshold: number;
  /** PRNG local del driver (`cs:[0x28c2]`). */
  cracklePrng: number;
}

export function newTitleSoundState(): TitleSoundState {
  return {
    fizzlePixels: 0,
    fizzleBursts: 0,
    cracklePixels: 0,
    crackleThreshold: SUBTITLE_CRACKLE_THRESHOLD0,
    cracklePrng: DRIVER_NOISE_SEED,
  };
}

/** Reinicia el umbral del crepitar al empezar una etapa (0x2909 / 0x2915). */
export function restartCrackleStage(st: TitleSoundState): void {
  st.crackleThreshold = SUBTITLE_CRACKLE_THRESHOLD0;
  st.cracklePixels = 0;
}

/**
 * Consume `revealed` píxeles nuevos del dissolve del LOGO y devuelve la BANDA de
 * cada cue a emitir (una por grupo de `TITLE_FIZZLE_BURSTS_PER_CUE` ráfagas). La
 * banda es la del original en ese punto del recorrido: `0xf0 + nº de ráfagas`.
 */
export function titleFizzleCues(revealed: number, st: TitleSoundState): number[] {
  st.fizzlePixels += Math.max(0, revealed);
  const perCue = TITLE_FIZZLE_PIXELS_PER_BURST * TITLE_FIZZLE_BURSTS_PER_CUE;
  const out: number[] = [];
  while (st.fizzlePixels >= perCue) {
    st.fizzlePixels -= perCue;
    st.fizzleBursts += TITLE_FIZZLE_BURSTS_PER_CUE;
    out.push(TITLE_FIZZLE_BAND0 + st.fizzleBursts);
  }
  return out;
}

/**
 * Consume `revealed` píxeles nuevos de una etapa del SUBTÍTULO y devuelve cuántas
 * ráfagas de crepitar suenan. Cada `SUBTITLE_CRACKLE_PIXELS_PER_TICK` píxeles hay
 * un tick; el tick suena si `(prng & 0x1ff) < umbral`, y el umbral baja 3 SIEMPRE
 * (suene o no — `0x29a3` va antes del sorteo). El PRNG avanza por tick: en el
 * original avanza por iteración del LFSR (0x2a03) y aquí se muestrea una vez por
 * tick, lo que conserva la LEY DE DENSIDAD (que es lo audible) y no la secuencia
 * exacta. Declarado.
 */
export function subtitleCrackleTicks(revealed: number, st: TitleSoundState): number {
  st.cracklePixels += Math.max(0, revealed);
  let sounded = 0;
  while (st.cracklePixels >= SUBTITLE_CRACKLE_PIXELS_PER_TICK) {
    st.cracklePixels -= SUBTITLE_CRACKLE_PIXELS_PER_TICK;
    st.crackleThreshold -= SUBTITLE_CRACKLE_THRESHOLD_STEP;
    if ((st.cracklePrng & SUBTITLE_CRACKLE_MASK) < st.crackleThreshold) sounded += 1;
    st.cracklePrng = driverNoisePrng(st.cracklePrng);
  }
  return sounded;
}

/**
 * PRNG del driver: `(([s]+0x9248) ror 3) ^ 0x9248) + 0x11` en 16 bits —
 * `EGA.DRV:0x2a03-0x2a16` (y el mismo en `0x27bc-0x27cd` para el ruido). Es
 * BYTE A BYTE el algoritmo del PRNG local del speaker del kernel (`[0x545c]`,
 * `ULTIMA.EXE:0x2258-0x2265`), con OTRO estado: el driver lleva el suyo, así que
 * tampoco toca `g_rng`. Se reimplementa aquí (y no se importa de `speaker.ts`)
 * para que este módulo siga siendo puro; la guarda de #220 carea las dos.
 */
export function driverNoisePrng(s: number): number {
  const a = (s + 0x9248) & 0xffff;
  const rotated = ((a >>> 3) | (a << 13)) & 0xffff; // ror 3 en 16 bits
  return (((rotated ^ 0x9248) & 0xffff) + 0x11) & 0xffff;
}
