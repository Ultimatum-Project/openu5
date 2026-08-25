/**
 * INTRO-ANIM (Task #73) — helpers puros de las animaciones del arranque
 * (ORIGIN fly-in, firma "Lord British" que se escribe, dissolve del título).
 * Deriva/cadencias: `re/notes/intro-splash-anim-audit.md` (witness video-P).
 */
import { describe, expect, it } from "vitest";
import {
  BOOT_TIMINGS,
  DEMO_MS_PER_FRAME,
  dissolveIndices,
  fireClockStep,
  fireFrameIndex,
  firePhaseAnimates,
  isBackdropPixel,
  isLetterPixel,
  makeRng,
  ORIGIN_FLIP_TURNS,
  originFlip,
  shuffleInPlace,
  SIGNATURE_UNDERLINE_FRAC,
  signatureRevealWidth,
  signatureStrokeOrder,
  signatureUnderlineBand,
  signatureUnderlineWidth,
  zhangSuenThin,
} from "../src/skin/fiel/introAnim.js";

describe("originFlip (TUMBO 3D del logo ORIGIN, witness f004–f007)", () => {
  it("f004: arranca de CANTO (raya fina) — scaleY≈0, pequeño y lejano", () => {
    const start = originFlip(0);
    expect(start.scaleY).toBeLessThan(0.05); // canto: una raya horizontal
    expect(start.scaleX).toBeCloseTo(0.3, 5); // aún lejos (zoom pequeño)
    expect(start.mirrored).toBe(false); // facing=cos(90°)=0, no <0
  });
  it("muestra la CARA TRASERA (espejada) a buen tamaño en la 1ª pasada (~theta 180°)", () => {
    // 1ª pasada trasera en theta=180° ⇒ t=(180-90)/(360·TURNS)=90/630≈0.143. facing≈-1 ⇒
    // trasera plena y espejada. Discrimina el bug: el modelo viejo (scaleX/scaleY creciente)
    // NUNCA daba mirrored=true.
    const back = originFlip(90 / (360 * ORIGIN_FLIP_TURNS));
    expect(back.mirrored).toBe(true);
    expect(back.scaleY).toBeGreaterThan(0.3); // cara casi de frente (trasera)
  });
  it("vuelve a CANTO (raya) en cada cruce de 90°, ya más ancho al acercarse", () => {
    const edge2 = originFlip((270 - 90) / (360 * ORIGIN_FLIP_TURNS)); // theta=270°
    expect(edge2.scaleY).toBeLessThan(0.05); // canto de nuevo
    expect(edge2.scaleX).toBeGreaterThan(originFlip(0).scaleX); // más ancha que f004
  });
  it("acaba FRONTAL a tamaño completo, sin espejo (theta_fin ≡ 0°)", () => {
    const end = originFlip(1);
    expect(end.scaleX).toBeCloseTo(1, 5);
    expect(end.scaleY).toBeCloseTo(1, 5);
    expect(end.mirrored).toBe(false);
  });
  it("el tumbo pasa por la cara trasera DOS veces (1.75 vueltas, remate frontal)", () => {
    expect(ORIGIN_FLIP_TURNS).toBe(1.75);
    let backSpans = 0;
    let prev = false;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const m = originFlip(t).mirrored;
      if (m && !prev) backSpans++;
      prev = m;
    }
    expect(backSpans).toBe(2); // dos pasadas por la trasera (theta 180° y 540°)
  });
  it("alpha entra rápido; clampa fuera de [0,1]", () => {
    expect(originFlip(0).alpha).toBeGreaterThan(0); // ya visible al arrancar
    expect(originFlip(0.25).alpha).toBe(1);
    expect(originFlip(-1)).toEqual(originFlip(0));
    expect(originFlip(2)).toEqual(originFlip(1));
  });
});

describe("signatureRevealWidth (la firma se escribe izq→der)", () => {
  it("revela 0 al inicio, ancho completo al final, mitad al 50%", () => {
    expect(signatureRevealWidth(0, 272)).toBe(0);
    expect(signatureRevealWidth(1, 272)).toBe(272);
    expect(signatureRevealWidth(0.5, 272)).toBe(136);
  });
  it("es monótona creciente", () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const w = signatureRevealWidth(t, 272);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });
});

describe("firma 'Lord British' de DOS PISTAS (bug #73 T1, witness f014–f022)", () => {
  const W = 272;

  it("la rúbrica (pista 1) llega a ancho completo mucho antes que las letras", () => {
    // Witness f017 (~1 s): subrayado full-width, letras sólo "Lorc" (~1/3). El
    // discriminador del bug: a t medio la rúbrica está FULL y las letras PARCIALES.
    const t = 0.5;
    expect(signatureUnderlineWidth(t, W)).toBe(W); // rúbrica completa
    expect(signatureRevealWidth(t, W)).toBe(W / 2); // letras a la mitad
    expect(signatureUnderlineWidth(t, W)).toBeGreaterThan(signatureRevealWidth(t, W));
  });

  it("la rúbrica satura en SIGNATURE_UNDERLINE_FRAC y va por delante en todo t<1", () => {
    expect(signatureUnderlineWidth(SIGNATURE_UNDERLINE_FRAC, W)).toBe(W);
    for (let t = 0.05; t < 1; t += 0.05) {
      expect(signatureUnderlineWidth(t, W)).toBeGreaterThanOrEqual(signatureRevealWidth(t, W));
    }
  });

  it("ambas pistas arrancan en 0 y acaban a ancho completo", () => {
    expect(signatureUnderlineWidth(0, W)).toBe(0);
    expect(signatureRevealWidth(0, W)).toBe(0);
    expect(signatureUnderlineWidth(1, W)).toBe(W);
    expect(signatureRevealWidth(1, W)).toBe(W);
  });

  it("la banda de rúbrica es una franja inferior fina (no todo el bitmap)", () => {
    const h = 62;
    const band = signatureUnderlineBand(h);
    expect(band).toBeGreaterThanOrEqual(2);
    expect(band).toBeLessThan(h / 2); // franja fina, deja sitio a las letras arriba
  });
});

describe("zhangSuenThin (esqueleto del trazo de la firma)", () => {
  it("adelgaza una barra horizontal gruesa a una línea de ~1 px de alto", () => {
    const w = 20;
    const h = 7;
    const m = new Uint8Array(w * h);
    // barra 16×5 en (2,1)
    for (let y = 1; y <= 5; y++) for (let x = 2; x < 18; x++) m[y * w + x] = 1;
    const sk = zhangSuenThin(m, w, h);
    // por columna interior queda a lo sumo 1 píxel de esqueleto (línea media).
    for (let x = 4; x < 16; x++) {
      let col = 0;
      for (let y = 0; y < h; y++) col += sk[y * w + x]!;
      expect(col).toBeLessThanOrEqual(1);
    }
    const before = m.reduce((a, b) => a + b, 0);
    const after = sk.reduce((a, b) => a + b, 0);
    expect(after).toBeLessThan(before); // adelgaza de verdad
    expect(after).toBeGreaterThan(0); // pero no borra el trazo
  });

  it("no toca lo que ya es de 1 px (idempotente sobre una línea fina)", () => {
    const w = 12;
    const h = 5;
    const m = new Uint8Array(w * h);
    for (let x = 1; x < 11; x++) m[2 * w + x] = 1; // línea de 1 px
    const sk = zhangSuenThin(m, w, h);
    expect(Array.from(sk)).toEqual(Array.from(m));
  });
});

describe("signatureStrokeOrder (revelado caligráfico por trazo, task #19)", () => {
  // Trazo diagonal grueso de arriba-izq a abajo-der (un "stroke" cursivo mínimo).
  const w = 24;
  const h = 24;
  const diag = new Uint8Array(w * h);
  for (let t = 2; t < 22; t++) {
    for (let d = -1; d <= 1; d++) diag[(t + d) * w + t] = 1; // ancho 3
  }
  const inkIdx = (m: Uint8Array): number[] => {
    const o: number[] = [];
    for (let i = 0; i < m.length; i++) if (m[i]) o.push(i);
    return o;
  };

  it("es una permutación EXACTA de los píxeles de tinta", () => {
    const ord = signatureStrokeOrder(diag, w, h);
    const ink = inkIdx(diag);
    expect(ord.length).toBe(ink.length);
    expect(new Set(ord).size).toBe(ink.length);
    for (const i of ord) expect(diag[i]).toBe(1);
  });

  it("es determinista (misma entrada → mismo orden)", () => {
    const a = signatureStrokeOrder(diag, w, h);
    const b = signatureStrokeOrder(diag, w, h);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("revela globalmente de IZQUIERDA a DERECHA (frente que avanza en x)", () => {
    const ord = signatureStrokeOrder(diag, w, h);
    const meanX = (from: number, to: number): number => {
      let s = 0;
      for (let k = from; k < to; k++) s += ord[k]! % w;
      return s / (to - from);
    };
    const q = Math.floor(ord.length / 4);
    expect(meanX(0, q)).toBeLessThan(meanX(ord.length - q, ord.length));
    // el primer píxel revelado cae en la mitad izquierda.
    expect(ord[0]! % w).toBeLessThan(w / 2);
  });

  it("máscara vacía → orden vacío; sin esqueleto degenerado no explota", () => {
    expect(signatureStrokeOrder(new Uint8Array(w * h), w, h).length).toBe(0);
    // un único píxel: es su propio 'trazo'.
    const one = new Uint8Array(w * h);
    one[5 * w + 5] = 1;
    const ord = signatureStrokeOrder(one, w, h);
    expect(Array.from(ord)).toEqual([5 * w + 5]);
  });
});

describe("shuffleInPlace (orden de dissolve/fizzlefade)", () => {
  it("es una permutación (conserva el multiconjunto)", () => {
    const n = 500;
    const a = Uint32Array.from({ length: n }, (_, i) => i);
    shuffleInPlace(a, 0xabc);
    const seen = new Set(a);
    expect(seen.size).toBe(n);
    for (let i = 0; i < n; i++) expect(seen.has(i)).toBe(true);
  });
  it("es determinista para la misma semilla y difiere entre semillas", () => {
    const mk = (): Uint32Array => Uint32Array.from({ length: 64 }, (_, i) => i);
    const a = shuffleInPlace(mk(), 1);
    const b = shuffleInPlace(mk(), 1);
    const c = shuffleInPlace(mk(), 2);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
  it("no es la identidad (baraja de verdad)", () => {
    const a = shuffleInPlace(Uint32Array.from({ length: 64 }, (_, i) => i), 7);
    expect(Array.from(a)).not.toEqual(Array.from({ length: 64 }, (_, i) => i));
  });
});

describe("makeRng", () => {
  it("es determinista por semilla", () => {
    const r1 = makeRng(42);
    const r2 = makeRng(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});

describe("fireFrameIndex (parpadeo de fuego del subtítulo)", () => {
  it("cicla 0..frames-1 con el periodo fireFrameMs", () => {
    const p = BOOT_TIMINGS.fireFrameMs;
    expect(fireFrameIndex(0)).toBe(0);
    expect(fireFrameIndex(p)).toBe(1);
    expect(fireFrameIndex(p * 3)).toBe(3);
    expect(fireFrameIndex(p * 4)).toBe(0); // wrap con 4 frames
  });
});

describe("firePhaseAnimates (fases que arden de forma continua)", () => {
  it("el subtítulo de fuego arde en menú, attract, créditos y NOMBRE/SEXO (renderCreatePanel pinta el mismo chrome del título)", () => {
    expect(firePhaseAnimates("menu")).toBe(true);
    expect(firePhaseAnimates("attract")).toBe(true);
    expect(firePhaseAnimates("credits")).toBe(true);
    // Carril intro-touch: la creación (nombre/sexo) muestra logo + subtítulo de
    // fuego (witness ORIG_02/03) y el fn32 del original es incondicional — antes
    // el fuego (y el cursor) se congelaban al pedir el nombre (bug reportado).
    expect(firePhaseAnimates("name")).toBe(true);
    expect(firePhaseAnimates("sex")).toBe(true);
  });
  it("no anima en fases sin subtítulo de fuego en pantalla", () => {
    for (const p of ["logo", "title", "story", "quiz", "cast", "epilogue"]) {
      expect(firePhaseAnimates(p)).toBe(false);
    }
  });
});

describe("fireClockStep (reloj de fuego del subtítulo, incl. MENÚ)", () => {
  const p = BOOT_TIMINGS.fireFrameMs;

  it("en el MENÚ dos ticks separados en el tiempo dan fotogramas DISTINTOS", () => {
    // El bug: el menú congelaba las llamas. Ahora el reloj las avanza como el
    // original (video-P f094–f098). Dos instantes a distinto lado de un límite de
    // fotograma deben producir índices de fuego diferentes ⇒ blit distinto.
    const t0 = fireClockStep("menu", 0, 0);
    expect(t0).toEqual({ frame: 0, changed: false });
    const t1 = fireClockStep("menu", p, t0.frame);
    expect(t1.changed).toBe(true);
    expect(t1.frame).toBe(1);
    const t2 = fireClockStep("menu", p * 2, t1.frame);
    expect(t2.changed).toBe(true);
    expect(t2.frame).toBe(2);
    // Discriminador duro: los fotogramas de dos ticks del menú NO coinciden.
    expect(t1.frame).not.toBe(t2.frame);
  });

  it("dentro del mismo fotograma no repinta (changed=false, frame estable)", () => {
    const step = fireClockStep("menu", p + 10, 1);
    expect(step).toEqual({ frame: 1, changed: false });
  });

  it("attract y créditos también avanzan el fuego", () => {
    expect(fireClockStep("attract", p, 0)).toEqual({ frame: 1, changed: true });
    expect(fireClockStep("credits", p * 3, 0)).toEqual({ frame: 3, changed: true });
  });

  it("una fase SIN fuego mantiene el fotograma previo (nunca cambia)", () => {
    // ("name" ya NO vale de ejemplo: la creación arde — carril intro-touch.)
    expect(fireClockStep("logo", p, 2)).toEqual({ frame: 2, changed: false });
    expect(fireClockStep("story", p * 5, 1)).toEqual({ frame: 1, changed: false });
  });
});

/**
 * #211 — El subtítulo «Warriors of Destiny» se revela con DOS dissolves de puntos
 * SECUENCIALES, no con uno. Medido en la grabación del original
 * `original/av-referencia/reportes/intro-detalles-2026-08-13.mov`: el FUEGO se llena
 * primero con las palabras recortadas en NEGRO (t 4,217→10,233 s) y sólo DESPUÉS se
 * rellenan las letras de BLANCO (t 10,292→16,242 s). El port hacía UN solo fizzlefade
 * sobre el bitmap `ultima:1` entero, así que las letras blancas salían salpicadas
 * junto a la llama desde el primer instante.
 *
 * El asset es EGA opaco entero (censado sobre `game/assets/intro-pics.png`:
 * ultima:1 = 32,4 % negro puro · 14,3 % blanco puro · resto rojos/amarillos), así que
 * la clase de píxel se decide por COLOR, no por alpha.
 */
describe("#211 — dissolve del subtítulo en DOS etapas", () => {
  /** Testigo con las CUATRO clases instanciadas (la diferencia existe donde se mide). */
  function bitmapTestigo(): { data: number[]; total: number } {
    const px: Array<[number, number, number, number]> = [
      [255, 255, 255, 255], // 0 LETRA (blanco puro)
      [255, 85, 85, 255], //  1 fuego (rojo claro)
      [0, 0, 0, 255], //      2 FONDO (negro opaco)
      [255, 255, 85, 255], // 3 fuego (amarillo)
      [255, 255, 255, 255], // 4 LETRA
      [170, 0, 0, 255], //    5 fuego (rojo oscuro)
      [255, 255, 255, 0], //  6 TRANSPARENTE (fuera de toda clase)
      [85, 85, 85, 255], //   7 fuego (gris oscuro: NO es fondo, lum=255>40)
    ];
    const data: number[] = [];
    for (const p of px) data.push(...p);
    return { data, total: px.length };
  }

  const LETRAS = [0, 4];
  const FUEGO = [1, 3, 5, 7];
  const FONDO = [2];

  it("clasifica el blanco puro como LETRA y el negro opaco como FONDO", () => {
    const { data } = bitmapTestigo();
    for (const i of LETRAS) expect(isLetterPixel(data, i)).toBe(true);
    for (const i of [...FUEGO, ...FONDO]) expect(isLetterPixel(data, i)).toBe(false);
    for (const i of FONDO) expect(isBackdropPixel(data, i)).toBe(true);
    for (const i of [...LETRAS, ...FUEGO]) expect(isBackdropPixel(data, i)).toBe(false);
  });

  it("las dos etapas son una PARTICIÓN: disjuntas y sin perder píxel visible", () => {
    const { data, total } = bitmapTestigo();
    const fuego = dissolveIndices(data, total, "fire");
    const letras = dissolveIndices(data, total, "letters");
    expect(fuego).toEqual(FUEGO);
    expect(letras).toEqual(LETRAS);
    // Disjuntas.
    expect(fuego.filter((i) => letras.includes(i))).toEqual([]);
    // Su unión = todos los opacos MENOS el fondo (que es indistinguible del #000000
    // que la intro pinta detrás, así que no gasta presupuesto de dissolve).
    const opacos = dissolveIndices(data, total, "all");
    expect([...fuego, ...letras].sort((a, b) => a - b)).toEqual(
      opacos.filter((i) => !isBackdropPixel(data, i)),
    );
    // El transparente no entra en ninguna.
    expect(opacos).not.toContain(6);
  });

  it("🔴 ETAPA 1: ni un solo píxel de LETRA participa en el dissolve del fuego", () => {
    const { data, total } = bitmapTestigo();
    const fuego = dissolveIndices(data, total, "fire");
    expect(fuego.filter((i) => isLetterPixel(data, i))).toHaveLength(0);
    expect(fuego.length).toBeGreaterThan(0); // el aserto no pasa por conjunto vacío
  });

  it("MUTANTE: colapsar las dos etapas en una (ignorar la clase) MUERE", () => {
    const { data, total } = bitmapTestigo();
    // El mutante = el port ANTES de #211: una sola pasada sobre todos los opacos.
    const mutante = dissolveIndices(data, total, "all");
    // …y con él, la etapa 1 SÍ revelaría letras → la propiedad fiel se rompe.
    expect(mutante.filter((i) => isLetterPixel(data, i)).length).toBeGreaterThan(0);
    expect(mutante).not.toEqual(dissolveIndices(data, total, "fire"));
  });

  it("el reparto de las dos etapas es mitad y mitad (medido 50,3 % / 49,7 %)", () => {
    expect(BOOT_TIMINGS.subtitleFireFrac).toBeGreaterThan(0);
    expect(BOOT_TIMINGS.subtitleFireFrac).toBeLessThan(1);
    const fuegoMs = BOOT_TIMINGS.subtitleDissolveMs * BOOT_TIMINGS.subtitleFireFrac;
    const letrasMs = BOOT_TIMINGS.subtitleDissolveMs * (1 - BOOT_TIMINGS.subtitleFireFrac);
    expect(fuegoMs + letrasMs).toBeCloseTo(BOOT_TIMINGS.subtitleDissolveMs, 6);
    expect(fuegoMs).toBeCloseTo(letrasMs, 6);
  });
});

/**
 * #211 — Las constantes de tiempo del arranque, PINNADAS COMO ELECCIÓN DEL PORT.
 *
 * 🔴 Estos valores NO son constantes calcadas del binario: son la ELECCIÓN del port de
 * quedarse en el NOMINAL derivado, y por eso la guarda los fija con su régimen al lado.
 *
 * Lo derivado (#211): cada fotograma de la demo llama a `pause(1)` = UNA espera de un tic
 * del INT 1Ch (`FONT.OVL` scene_tick 0x03b0-0x03b4 → kernel `pause` 0x20fa, que instala su
 * propio manejador del tic en 0x2159 —`inc word ptr [si]`— y gira hasta llegar a n).
 * ⚠ Con `n==1` esa espera SE SALTA ENTERA en máquina rápida: `0x2108 cmp
 * [g_snd_delay_calib],0xf0` / `jle 0x2152`, y 0x2152 es sólo el epílogo (`ret 2`).
 * ⇒ El original NO tiene cadencia fija para la demo: depende de la velocidad de la máquina.
 * La grabación en DOSBox-X a 3000 cycles/ms rinde ~2× más lenta que el nominal porque el
 * COSTE DE PINTADO se suma; eso es del emulador, no del binario, y por eso NO se calca.
 *
 * La guarda existe para que un cambio de estas cifras sea DELIBERADO y llegue con su razón,
 * no para afirmar que el binario las dicta.
 */
describe("#211 — constantes del arranque: elección del port, con su régimen", () => {
  it("el fotograma de la demo se queda en el NOMINAL de pause(1) = 1 tic del INT 1Ch", () => {
    // 1000/18,2065 Hz = 54,925 ms = el tic del temporizador. NO el ~110 ms de la grabación.
    expect(DEMO_MS_PER_FRAME).toBeCloseTo(1000 / 18.2065, 6);
    expect(DEMO_MS_PER_FRAME).toBeGreaterThan(54);
    expect(DEMO_MS_PER_FRAME).toBeLessThan(56);
  });

  it("el subtítulo reparte su total en DOS etapas y ninguna se queda a cero", () => {
    expect(BOOT_TIMINGS.subtitleFireFrac).toBeGreaterThan(0);
    expect(BOOT_TIMINGS.subtitleFireFrac).toBeLessThan(1);
    const fuego = BOOT_TIMINGS.subtitleDissolveMs * BOOT_TIMINGS.subtitleFireFrac;
    const letras = BOOT_TIMINGS.subtitleDissolveMs * (1 - BOOT_TIMINGS.subtitleFireFrac);
    expect(fuego).toBeGreaterThan(0);
    expect(letras).toBeGreaterThan(0);
    expect(fuego + letras).toBeCloseTo(BOOT_TIMINGS.subtitleDissolveMs, 6);
  });

  it("las duraciones del título siguen en su valor declarado (cambio = deliberado)", () => {
    expect(BOOT_TIMINGS.titleDissolveMs).toBe(2200);
    expect(BOOT_TIMINGS.subtitleDissolveMs).toBe(2200);
    expect(BOOT_TIMINGS.titleHoldMs).toBe(1400);
    expect(BOOT_TIMINGS.fireFrameMs).toBe(120);
  });

  it("el subtítulo son DOS etapas de dissolve, no una ni tres", () => {
    // El nº de CLASES de píxel que participan fija el nº de etapas: fuego y letras.
    const clases = ["fire", "letters"] as const;
    expect(clases).toHaveLength(2);
    const { data, total } = (() => {
      const px = [
        [255, 255, 255, 255], [255, 85, 85, 255], [0, 0, 0, 255], [255, 255, 85, 255],
      ];
      const d: number[] = [];
      for (const p of px) d.push(...p);
      return { data: d, total: px.length };
    })();
    const cubierto = new Set<number>();
    for (const c of clases) for (const i of dissolveIndices(data, total, c)) cubierto.add(i);
    // Las dos etapas juntas cubren TODO lo visible (opaco no-fondo) y nada más.
    const visible = dissolveIndices(data, total, "all").filter((i) => !isBackdropPixel(data, i));
    expect([...cubierto].sort((a, b) => a - b)).toEqual(visible);
  });
});
