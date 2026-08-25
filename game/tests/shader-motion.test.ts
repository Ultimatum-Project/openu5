/**
 * Piel «shader» — lógica PURA del movimiento suave (eje 3), regresión del contrato
 * que hoy vive en `skin/shader/motion.ts` (extraído de `skin.ts`, que llama a estas
 * funciones). Sin DOM/WebGL: el cross-slide de canvas se ve en QA de navegador, aquí
 * se fija la DECISIÓN (tween/snap/hold) y la ARITMÉTICA (offsets, interpolación).
 */
import { describe, expect, it } from "vitest";
import {
  actorSlideFrom,
  anchoredFogSlideShowsBlack,
  anchoredLitMask,
  emitterGlowMask,
  bakeFogVeilMask,
  classifyStep,
  clamp01,
  crossSlideOffsets,
  discReaches,
  exitingActors,
  fogCompositeRevealsCell,
  fogSlideRevealsCell,
  litCells,
  outgoingGatedMaskV0,
  occlusionLitMask,
  carriedGlowMask,
  freshLitMask,
  persistentLitMask,
  premulBlacksCarriedArea,
  premulHiddenArea,
  premulHiddenVisibleArea,
  resolveActorFrom,
  slideActor,
  slideReachableDisc,
  snapCrossSlide,
  survivingGlowMask,
  tweenProgress,
} from "../src/skin/shader/motion.js";
import { computeRadiusMask } from "../src/core/world/visibility.js";

const base = { sameLoc: true, motionEnabled: true, hasPrev: true };

describe("classifyStep — decisión tween/snap/hold", () => {
  it("un paso de 1 tile (Manhattan==1) en mundo, misma loc, con capa previa → TWEEN", () => {
    expect(classifyStep({ ...base, dx: 1, dy: 0 })).toBe("tween");
    expect(classifyStep({ ...base, dx: -1, dy: 0 })).toBe("tween");
    expect(classifyStep({ ...base, dx: 0, dy: 1 })).toBe("tween");
    expect(classifyStep({ ...base, dx: 0, dy: -1 })).toBe("tween");
  });

  it("sin cambio de centro (Manhattan==0), misma loc → HOLD (el tween en curso sigue)", () => {
    expect(classifyStep({ ...base, dx: 0, dy: 0 })).toBe("hold");
  });

  it("salto multi-tile (teleport/moongate/klimb) → SNAP", () => {
    expect(classifyStep({ ...base, dx: 2, dy: 0 })).toBe("snap");
    expect(classifyStep({ ...base, dx: 1, dy: 1 })).toBe("snap"); // Manhattan 2, diagonal
    expect(classifyStep({ ...base, dx: 20, dy: -20 })).toBe("snap");
  });

  it("cambio de location → SNAP aunque el centro no cambie (entrar/salir)", () => {
    expect(classifyStep({ ...base, dx: 0, dy: 0, sameLoc: false })).toBe("snap");
    expect(classifyStep({ ...base, dx: 1, dy: 0, sameLoc: false })).toBe("snap");
  });

  it("motion OFF: un paso de 1 tile ya NO tween → SNAP (salto seco de siempre)", () => {
    expect(classifyStep({ ...base, dx: 1, dy: 0, motionEnabled: false })).toBe("snap");
    // pero sin cambio de centro sigue siendo HOLD (no hay nada que animar)
    expect(classifyStep({ ...base, dx: 0, dy: 0, motionEnabled: false })).toBe("hold");
  });

  it("sin capa mundo previa: un paso de 1 tile cae a SNAP (no hay V0 que deslizar)", () => {
    expect(classifyStep({ ...base, dx: 1, dy: 0, hasPrev: false })).toBe("snap");
    expect(classifyStep({ ...base, dx: 0, dy: 0, hasPrev: false })).toBe("hold");
  });
});

describe("tweenProgress — reloj de pared 0→1", () => {
  it("t sube linealmente y NO está done a mitad", () => {
    expect(tweenProgress(1075, 1000, 150)).toEqual({ t: 0.5, done: false });
    expect(tweenProgress(1000, 1000, 150)).toEqual({ t: 0, done: false });
  });

  it("al llegar o pasar de durMs: t=1 y done", () => {
    expect(tweenProgress(1150, 1000, 150)).toEqual({ t: 1, done: true });
    expect(tweenProgress(9999, 1000, 150)).toEqual({ t: 1, done: true });
  });
});

describe("crossSlideOffsets — V0 sale (−t), V1 entra (+(1−t))", () => {
  it("a mitad de un paso al este (dx=1), cell=96: V0 y V1 se cruzan por la mitad", () => {
    const off = crossSlideOffsets(48, 48, 0.5, 1, 0, 96);
    expect(off.v0).toEqual({ x: 48 - 48, y: 48 }); // −0.5·1·96 = −48
    expect(off.v1).toEqual({ x: 48 + 48, y: 48 }); // +0.5·1·96 = +48
  });

  it("en t=0 V0 está en el origen y V1 a un tile entero; en t=1 al revés", () => {
    const a = crossSlideOffsets(48, 48, 0, 0, 1, 96); // paso al sur
    expect(a.v0).toEqual({ x: 48, y: 48 });
    expect(a.v1).toEqual({ x: 48, y: 48 + 96 });
    const b = crossSlideOffsets(48, 48, 1, 0, 1, 96);
    expect(b.v0).toEqual({ x: 48, y: 48 - 96 });
    expect(b.v1).toEqual({ x: 48, y: 48 });
  });
});

describe("snapCrossSlide — cuantiza el blit del mundo a píxel entero de dispositivo", () => {
  it("redondea cada componente de v0 y v1 al entero más cercano", () => {
    const snapped = snapCrossSlide({ v0: { x: 12.4, y: -7.6 }, v1: { x: 108.5, y: 3.2 } });
    expect(snapped.v0).toEqual({ x: 12, y: -8 });
    expect(snapped.v1).toEqual({ x: 109, y: 3 }); // 108.5 → 109 (redondeo al par de JS: round(.5)=up)
  });

  it("en el settle (offsets ya enteros) es un NO-OP → byte-idéntico", () => {
    // t=1 sobre cell entero: crossSlideOffsets devuelve enteros; el snap no debe alterarlos.
    const off = crossSlideOffsets(48, 48, 1, 0, 1, 96);
    expect(snapCrossSlide(off)).toEqual(off);
  });

  it("con cell fraccionario a media-transición los offsets caen en la rejilla entera", () => {
    // size=1152/11 = 104.7272… → cell fraccionario, offsets sub-píxel sin snap.
    const cell = 1152 / 11;
    const off = crossSlideOffsets(96, 96, 0.5, 1, 0, cell);
    const snapped = snapCrossSlide(off);
    expect(Number.isInteger(snapped.v0.x)).toBe(true);
    expect(Number.isInteger(snapped.v1.x)).toBe(true);
    expect(snapped.v0.y).toBe(96);
    expect(snapped.v1.y).toBe(96);
  });
});

describe("slideActor — interpola sólo pasos ≤ maxStep", () => {
  const MAX = 2;
  it("un paso contiguo se desliza linealmente entre celdas", () => {
    expect(slideActor({ col: 3, row: 5 }, { col: 4, row: 5 }, 0.5, MAX)).toEqual({ col: 3.5, row: 5 });
    expect(slideActor({ col: 3, row: 5 }, { col: 4, row: 6 }, 0.25, MAX)).toEqual({ col: 3.25, row: 5.25 });
  });

  it("en t=0 devuelve `from`, en t=1 devuelve `to`", () => {
    expect(slideActor({ col: 3, row: 5 }, { col: 4, row: 5 }, 0, MAX)).toEqual({ col: 3, row: 5 });
    expect(slideActor({ col: 3, row: 5 }, { col: 4, row: 5 }, 1, MAX)).toEqual({ col: 4, row: 5 });
  });

  it("salto grande (>maxStep en un eje) NO desliza: se pinta seco en `to`", () => {
    expect(slideActor({ col: 0, row: 0 }, { col: 5, row: 0 }, 0.5, MAX)).toEqual({ col: 5, row: 0 });
    expect(slideActor({ col: 0, row: 0 }, { col: 0, row: 9 }, 0.5, MAX)).toEqual({ col: 0, row: 9 });
  });

  it("el borde exacto (maxStep) todavía desliza; uno más ya no", () => {
    expect(slideActor({ col: 0, row: 0 }, { col: 2, row: 0 }, 0.5, MAX)).toEqual({ col: 1, row: 0 });
    expect(slideActor({ col: 0, row: 0 }, { col: 3, row: 0 }, 0.5, MAX)).toEqual({ col: 3, row: 0 });
  });
});

describe("resolveActorFrom — rendered ?? prevTo ?? to", () => {
  const to = { col: 9, row: 9 };
  it("prefiere la posición realmente compuesta el último frame (rendered)", () => {
    expect(resolveActorFrom({ col: 1, row: 1 }, { col: 2, row: 2 }, to)).toEqual({ col: 1, row: 1 });
  });
  it("si no hay rendered, usa el `to` del snapshot anterior", () => {
    expect(resolveActorFrom(undefined, { col: 2, row: 2 }, to)).toEqual({ col: 2, row: 2 });
  });
  it("si no hay ninguno (actor nuevo), usa el `to` actual (sin salto fantasma)", () => {
    expect(resolveActorFrom(undefined, undefined, to)).toEqual(to);
  });
});

describe("actorSlideFrom — entrada por scroll desliza con el terreno (borde-entrante)", () => {
  const to = { col: 10, row: 4 };
  it("actor visto antes: se comporta como resolveActorFrom (rendered / prevTo), ignora el scroll", () => {
    const scroll = { dx: 1, dy: 0 };
    expect(actorSlideFrom({ col: 1, row: 1 }, { col: 2, row: 2 }, to, scroll)).toEqual({ col: 1, row: 1 });
    expect(actorSlideFrom(undefined, { col: 2, row: 2 }, to, scroll)).toEqual({ col: 2, row: 2 });
  });

  it("actor NUEVO con scroll al este (dx=1): `from` = `to`+delta → una celda MÁS ALLÁ del borde entrante", () => {
    // to en col 10 (borde derecho); from en col 11 (fuera, se recorta) → desliza hacia dentro.
    expect(actorSlideFrom(undefined, undefined, to, { dx: 1, dy: 0 })).toEqual({ col: 11, row: 4 });
  });

  it("actor NUEVO con scroll al norte (dy=-1): `from` = una fila por ENCIMA del borde superior", () => {
    const top = { col: 5, row: 0 };
    expect(actorSlideFrom(undefined, undefined, top, { dx: 0, dy: -1 })).toEqual({ col: 5, row: -1 });
  });

  it("el salto sintetizado es de 1 tile → slideActor lo interpola (no salto seco)", () => {
    const from = actorSlideFrom(undefined, undefined, to, { dx: 1, dy: 0 }); // {11,4}
    expect(slideActor(from, to, 0.5, 2)).toEqual({ col: 10.5, row: 4 }); // a mitad, entrando
    expect(slideActor(from, to, 1, 2)).toEqual(to); // en t=1: idéntico al render actual
  });

  it("actor NUEVO SIN scroll (spawn/teleport, scroll=null): `to` seco, como resolveActorFrom", () => {
    expect(actorSlideFrom(undefined, undefined, to, null)).toEqual(to);
  });
});

describe("exitingActors — salida por scroll desliza hacia fuera (borde-saliente, espejo)", () => {
  const W = 11; // VIEW_WINDOW
  const npc = { id: "n1", tile: 300, col: 0, row: 4 }; // pegado al borde izquierdo

  it("scroll al este (dx=1): un actor en col 0 que ya no está sale por el borde IZQUIERDO", () => {
    // El centro va +1 en x → todo se mueve −1 en ventana; col 0 → −1 (fuera).
    const ex = exitingActors([npc], new Set<string>(), { dx: 1, dy: 0 }, W);
    expect(ex).toEqual([{ id: "n1", tile: 300, from: { col: 0, row: 4 }, to: { col: -1, row: 4 } }]);
  });

  it("el saliente desliza 1 tile → slideActor interpola; en t=1 queda FUERA de la ventana (invisible)", () => {
    const ex = exitingActors([npc], new Set<string>(), { dx: 1, dy: 0 }, W)[0];
    expect(ex).toBeDefined();
    if (!ex) return;
    expect(slideActor(ex.from, ex.to, 0.5, 2)).toEqual({ col: -0.5, row: 4 }); // medio fuera
    expect(slideActor(ex.from, ex.to, 1, 2)).toEqual({ col: -1, row: 4 }); // fuera del clip = nada pintado
  });

  it("scroll al sur (dy=1): un actor en row 0 sale por el borde SUPERIOR; el eje-x no cruza", () => {
    const top = { id: "n2", tile: 5, col: 6, row: 0 };
    const ex = exitingActors([top], new Set<string>(), { dx: 0, dy: 1 }, W);
    expect(ex).toEqual([{ id: "n2", tile: 5, from: { col: 6, row: 0 }, to: { col: 6, row: -1 } }]);
  });

  it("actor que SIGUE visible (está en el set actual) NO es saliente", () => {
    expect(exitingActors([npc], new Set(["n1"]), { dx: 1, dy: 0 }, W)).toEqual([]);
  });

  it("MUERTE/teleport (desaparece SIN scroll): scroll=null → lista vacía, no desliza", () => {
    expect(exitingActors([npc], new Set<string>(), null, W)).toEqual([]);
  });

  it("desaparición EN MEDIO de la ventana con scroll (muerte, no salida por borde): NO desliza", () => {
    // Actor en col 5: con dx=1 su celda nueva sería col 4, DENTRO de la ventana → no cruzó
    // el borde → desapareció por muerte/teleport, no por scroll.
    const mid = { id: "n3", tile: 7, col: 5, row: 5 };
    expect(exitingActors([mid], new Set<string>(), { dx: 1, dy: 0 }, W)).toEqual([]);
  });

  it("actor que YA estaba fuera de la ventana el turno anterior no cuenta como saliente", () => {
    const off = { id: "n4", tile: 9, col: -1, row: 3 };
    expect(exitingActors([off], new Set<string>(), { dx: 1, dy: 0 }, W)).toEqual([]);
  });

  it("scroll al oeste (dx=-1): el actor que sale es el del borde DERECHO (col W-1=10)", () => {
    const right = { id: "n5", tile: 11, col: 10, row: 2 };
    const ex = exitingActors([right], new Set<string>(), { dx: -1, dy: 0 }, W);
    expect(ex).toEqual([{ id: "n5", tile: 11, from: { col: 10, row: 2 }, to: { col: 11, row: 2 } }]);
    // Un actor del borde IZQUIERDO (col 0) con dx=-1 se mueve a col 1 (dentro) → no sale.
    expect(exitingActors([npc], new Set<string>(), { dx: -1, dy: 0 }, W)).toEqual([]);
  });
});

describe("anchoredLitMask / occlusionLitMask — descomposición de la niebla (radio vs oclusión)", () => {
  // Cada índice: [visMask, visRadius] → clasificación de la celda.
  // A = dentro del radio y visible (lit real).       radius=1 vis=1
  // B = dentro del radio pero OCLUIDA por muro.       radius=1 vis=0  (agujero → DESLIZA)
  // C = fuera del radio y oscura (caída del radio).   radius=0 vis=0  (→ ANCLADA)
  // D = fuera del radio pero iluminada por emisor.    radius=0 vis=1  (lit por halo)
  const visMask = Uint8Array.from([1, 0, 0, 1]); // A,B,C,D
  const visRadius = Uint8Array.from([1, 1, 0, 0]);

  it("anchoredLit = visMask OR visRadius → paintFog ennegrece SÓLO C (fuera del disco y oscuro)", () => {
    // paintFog pinta negro donde mask===0. anchoredLit===0 debe ser exactamente C.
    expect([...anchoredLitMask(visMask, visRadius)]).toEqual([1, 1, 0, 1]);
  });

  it("occlusionLit = visMask OR NOT visRadius → paintFogSlide ennegrece SÓLO B (agujero de muro)", () => {
    // occlusionLit===0 (lo que la capa que DESLIZA ennegrece) debe ser exactamente B.
    expect([...occlusionLitMask(visMask, visRadius)]).toEqual([1, 0, 1, 1]);
  });

  it("INVARIANTE unión: (¬anchoredLit) ∪ (¬occlusionLit) = ¬visMask (misma negrura total que hoy)", () => {
    const a = anchoredLitMask(visMask, visRadius);
    const o = occlusionLitMask(visMask, visRadius);
    for (let i = 0; i < visMask.length; i++) {
      const darkTotal = a[i] === 0 || o[i] === 0 ? 1 : 0; // negro por cualquiera de las dos capas
      expect(darkTotal).toBe(visMask[i] === 0 ? 1 : 0); // == ¬visMask (settle byte-idéntico)
    }
  });

  it("DISJUNCIÓN: ninguna celda la ennegrecen LAS DOS capas (C sólo anclada, B sólo desliza)", () => {
    const a = anchoredLitMask(visMask, visRadius);
    const o = occlusionLitMask(visMask, visRadius);
    for (let i = 0; i < visMask.length; i++) expect(a[i] === 0 && o[i] === 0).toBe(false);
  });

  it("NO-REGRESIÓN día/ciudad: radio que cubre TODA la ventana (visRadius all-1) reduce EXACTO a hoy", () => {
    // De día (radio 50) visRadius es todo 1 → anchoredLit todo 1 (paintFog no ennegrece) y
    // occlusionLit === visMask → paintFogSlide(visMask) = comportamiento de HOY. Así las
    // sombras de edificios de ciudad de día son byte-idénticas (testigo 7044b7b7 intacto).
    const vis = Uint8Array.from([1, 0, 1, 0, 1, 0]); // muros/oclusión arbitraria
    const allLit = Uint8Array.from([1, 1, 1, 1, 1, 1]);
    expect([...anchoredLitMask(vis, allLit)]).toEqual([1, 1, 1, 1, 1, 1]); // paintFog no-op
    expect([...occlusionLitMask(vis, allLit)]).toEqual([...vis]); // === visMask (vía de hoy)
  });

  it("overworld noche abierto (visRadius==visMask, sin muros): la capa que DESLIZA no ennegrece nada", () => {
    // Sin oclusión, visMask === visRadius (disco puro). occlusionLit = todo 1 → paintFogSlide
    // no pinta negro → el disco lo ancla SÓLO paintFog → sin bulge (el fix del usuario).
    const disc = Uint8Array.from([1, 1, 0, 0, 0]);
    expect([...occlusionLitMask(disc, disc)]).toEqual([1, 1, 1, 1, 1]);
    expect([...anchoredLitMask(disc, disc)]).toEqual([1, 1, 0, 0, 0]); // ennegrece fuera del disco
  });
});

describe("bakeFogVeilMask — niebla PRE-MULTIPLICADA (horneada en el bitmap antes del slide)", () => {
  // Fixture 5×5 con las cuatro clases (el 1-D de antes ya no vale: el horneado necesita la
  // GEOMETRÍA de la ventana para dilatar el disco — ver `discReaches`).
  //   disco (visRadius) = el 3×3 central; visMask = todo visible dentro del disco salvo un
  //   MURO en (2,2) [clase B], oscuro fuera [clase C] y un halo de EMISOR en (4,4) [clase D].
  const W = 5;
  const idx = (c: number, r: number): number => r * W + c;
  const visRadius = new Uint8Array(W * W);
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) visRadius[idx(c, r)] = 1;
  const visMask = new Uint8Array(W * W);
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) visMask[idx(c, r)] = 1;
  visMask[idx(2, 2)] = 0; // B: muro DENTRO del disco
  visMask[idx(4, 4)] = 1; // D: halo de emisor FUERA del disco (esquina, fuera del dilatado)

  it("hornea B (ocluido DENTRO del disco): la sombra de muro viaja con el terreno", () => {
    expect(bakeFogVeilMask(visMask, visRadius, W)[idx(2, 2)]).toBe(1);
  });

  it("🔴 fog-rim: hornea TAMBIÉN el ANILLO oculto pegado al disco (lo que se veía al deslizar)", () => {
    // El paso es de 1 tile cardinal, así que estas casillas —oscuras y FUERA del disco— acaban
    // bajo una celda de PANTALLA que sí está dentro, donde la capa anclada no pinta. Antes NO
    // se horneaban (delegaban en la anclada) y su terreno asomaba. Ahora nacen veladas.
    const veil = bakeFogVeilMask(visMask, visRadius, W);
    for (const [c, r] of [[0, 2], [4, 2], [2, 0], [2, 4], [0, 1], [1, 0]] as [number, number][]) {
      expect(visRadius[idx(c, r)]).toBe(0); // en efecto FUERA del disco crudo
      expect(veil[idx(c, r)]).toBe(1);
    }
  });

  it("la dilatación es de 1 CELDA: las esquinas (a 2 pasos del disco) NO se hornean", () => {
    const veil = bakeFogVeilMask(visMask, visRadius, W);
    expect(veil[idx(0, 0)]).toBe(0);
    expect(veil[idx(4, 0)]).toBe(0);
    expect(veil[idx(0, 4)]).toBe(0);
  });

  it("CONSERVADOR: la veladura NUNCA cubre una celda visible (veil ⊆ ¬visMask) — ni el halo D", () => {
    const veil = bakeFogVeilMask(visMask, visRadius, W);
    for (let i = 0; i < visMask.length; i++) if (veil[i] === 1) expect(visMask[i]).toBe(0);
    expect(veil[idx(4, 4)]).toBe(0); // el emisor de fuera del disco sigue viéndose
  });

  it("INVARIANTE unión (settle): veil ∪ (¬anchoredLit) = ¬visMask — misma negrura total que hoy", () => {
    const veil = bakeFogVeilMask(visMask, visRadius, W);
    const anchored = anchoredLitMask(visMask, visRadius);
    for (let i = 0; i < visMask.length; i++) {
      const darkTotal = veil[i] === 1 || anchored[i] === 0 ? 1 : 0;
      expect(darkTotal).toBe(visMask[i] === 0 ? 1 : 0);
    }
  });

  it("la DISJUNCIÓN se ROMPE a propósito, y el solape es EXACTAMENTE el anillo dilatado", () => {
    // Antes se aseraba que ninguna celda la ennegrecieran las DOS capas. El fix la rompe: el
    // anillo lo pintan las dos (horneado + anclada). Es INOCUO —las dos pintan el MISMO negro
    // opaco tile-alineado, así que la salida no cambia— y es justo lo que cierra la fuga. Se
    // sustituye la disjunción por la identidad del solape, para que un solape DISTINTO cante.
    const veil = bakeFogVeilMask(visMask, visRadius, W);
    const anchored = anchoredLitMask(visMask, visRadius);
    const both: number[] = [];
    for (let i = 0; i < visMask.length; i++) if (veil[i] === 1 && anchored[i] === 0) both.push(i);
    const ring: number[] = [];
    for (let i = 0; i < visMask.length; i++) {
      const c = i % W;
      const r = (i - c) / W;
      if (visMask[i] === 0 && visRadius[i] === 0 && discReaches(visRadius, W, c, r)) ring.push(i);
    }
    expect(both).toEqual(ring);
    expect(both.length).toBeGreaterThan(0); // control: si el anillo fuera vacío no probaría nada
  });

  it("sin disco (de día, visRadius=null): hornea ¬visMask entero (la niebla entera puede deslizar)", () => {
    const vis = Uint8Array.from([1, 0, 1, 0, 1, 0, 0, 1, 1]);
    expect([...bakeFogVeilMask(vis, null, 3)]).toEqual([0, 1, 0, 1, 0, 1, 1, 0, 0]);
  });

  it("radio pleno (visRadius all-1): hornea ¬visMask entero (reduce al caso de día — no-regresión)", () => {
    const vis = Uint8Array.from([1, 0, 1, 0, 1, 0, 0, 1, 1]);
    const allLit = new Uint8Array(9).fill(1);
    expect([...bakeFogVeilMask(vis, allLit, 3)]).toEqual([...bakeFogVeilMask(vis, null, 3)]);
  });
});

describe("🔴 PREMISA DE LA DILATACIÓN — el tween nunca desplaza más de 1 celda CARDINAL", () => {
  // El fix `fog-rim` dilata el disco en su 4-VECINDAD, y eso basta SÓLO porque el
  // desplazamiento máximo de un tween es de 1 tile cardinal. Esa premisa no vive en
  // `discReaches`: vive en `classifyStep` (motion.ts, `man === 1`). Si alguien admite paso
  // DIAGONAL, salto de más de un tile, o un tween de dos pasos, la dilatación se queda corta y
  // la fuga vuelve EN SILENCIO — los tests del composite seguirían dando 0 porque sólo barren
  // los casos que hoy existen. Estos dos tests son los que se ponen rojos en ese momento.

  it("classifyStep sólo emite `tween` con |dx|+|dy| === 1 — barrido exhaustivo de −3..3", () => {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const kind = classifyStep({ dx, dy, sameLoc: true, motionEnabled: true, hasPrev: true });
        if (kind !== "tween") continue;
        expect(Math.abs(dx) + Math.abs(dy)).toBe(1); // cardinal y de UNA celda
      }
    }
  });

  it("los 4 desplazamientos que SÍ producen tween están cubiertos por la 4-vecindad de discReaches", () => {
    // Disco de UNA celda en el centro de un 3×3: la casilla que el paso `d` puede arrastrar
    // bajo el disco es la que está a −d de él, y `discReaches` tiene que declararla alcanzable.
    const W3 = 3;
    const one = new Uint8Array(9);
    one[4] = 1; // centro (1,1)
    const tweens: [number, number][] = [];
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++)
        if (classifyStep({ dx, dy, sameLoc: true, motionEnabled: true, hasPrev: true }) === "tween")
          tweens.push([dx, dy]);
    expect(tweens).toHaveLength(4); // si esto cambia, la dilatación hay que revisarla
    for (const [dx, dy] of tweens) {
      expect(discReaches(one, W3, 1 - dx, 1 - dy)).toBe(true);
    }
  });
});

describe("discReaches / slideReachableDisc — disco ALCANZABLE por el deslizamiento (fog-rim)", () => {
  const W = 5;
  const vr = new Uint8Array(W * W);
  vr[2 * W + 2] = 1; // disco de UNA celda, en el centro

  it("el propio disco y sus 4 vecinos cardinales son alcanzables; las diagonales NO", () => {
    expect(discReaches(vr, W, 2, 2)).toBe(true);
    expect(discReaches(vr, W, 1, 2)).toBe(true);
    expect(discReaches(vr, W, 3, 2)).toBe(true);
    expect(discReaches(vr, W, 2, 1)).toBe(true);
    expect(discReaches(vr, W, 2, 3)).toBe(true);
    // El paso es Manhattan==1 (classifyStep): no hay slide diagonal que traiga una esquina.
    expect(discReaches(vr, W, 1, 1)).toBe(false);
    expect(discReaches(vr, W, 3, 3)).toBe(false);
    expect(discReaches(vr, W, 0, 2)).toBe(false); // a dos pasos
  });

  it("fuera de la ventana cuenta como fuera (sin desbordar el índice)", () => {
    const edge = new Uint8Array(W * W);
    edge[0] = 1; // esquina (0,0)
    expect(discReaches(edge, W, 0, 0)).toBe(true);
    expect(discReaches(edge, W, 1, 0)).toBe(true);
    expect(discReaches(edge, W, 4, 4)).toBe(false);
  });

  it("slideReachableDisc materializa el mismo predicado celda a celda", () => {
    const m = slideReachableDisc(vr, W);
    for (let r = 0; r < W; r++)
      for (let c = 0; c < W; c++)
        expect(m[r * W + c]).toBe(discReaches(vr, W, c, r) ? 1 : 0);
  });

  it("disco PLENO (de día) → dilatado == el mismo disco (no-regresión: nada que añadir)", () => {
    const full = new Uint8Array(W * W).fill(1);
    expect([...slideReachableDisc(full, W)]).toEqual([...full]);
  });

  it("respeta el buffer `out` del caller (PERF-4: sin alloc por frame)", () => {
    const out = new Uint8Array(W * W);
    expect(slideReachableDisc(vr, W, out)).toBe(out);
  });
});

describe("premulShowsHiddenAt / premulHiddenArea — el COMPOSITE del tween no destapa nada (fog-rim)", () => {
  // Escenario del reporte: overworld nocturno ABIERTO con ANTORCHA. Sin emisores ni muros, así
  // que el conjunto visible ES el disco de radio — cualquier terreno mostrado fuera de él es
  // una casilla que NO debe verse. `light=10` es el radio con antorcha (survival.ts::lightLevel).
  const W = 11;
  const vr = computeRadiusMask(10);
  const vm = new Uint8Array(vr); // visMask == disco (sin muros ni emisores)
  const DIRS: [number, number, string][] = [
    [1, 0, "este"],
    [-1, 0, "oeste"],
    [0, 1, "sur"],
    [0, -1, "norte"],
  ];
  const args = (dx: number, dy: number, t: number) => ({
    visMask0: vm,
    visRadius0: vr,
    visMask1: vm,
    visRadius1: vr,
    window: W,
    dx,
    dy,
    t,
  });

  it("el disco con antorcha es el que dice el core (37 celdas de 121) — control del fixture", () => {
    expect(vr.reduce((a, b) => a + b, 0)).toBe(37);
  });

  for (const [dx, dy, name] of DIRS) {
    it(`paso al ${name}: CERO área de pantalla muestra casilla oculta, en todo el tween`, () => {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(premulHiddenArea(args(dx, dy, t))).toBe(0);
      }
    });
  }

  it("CONTROL POSITIVO: con el disco SIN dilatar la fuga reaparece y vale (1−t)·7 celdas", () => {
    // Réplica del horneado VIEJO (veil = ¬visMask ∩ visRadius crudo) sobre el mismo composite:
    // si el barrido no supiera medir, este control saldría 0 y la batería no probaría nada.
    const naiveVeil = (mask: Uint8Array, disc: Uint8Array | null): Uint8Array => {
      const o = new Uint8Array(mask.length);
      for (let i = 0; i < o.length; i++) o[i] = mask[i] === 0 && (disc ? disc[i] === 1 : true) ? 1 : 0;
      return o;
    };
    const naiveArea = (dx: number, dy: number, t: number, sub = 8): number => {
      let hits = 0;
      for (let sy = 0; sy < W * sub; sy++) {
        for (let sx = 0; sx < W * sub; sx++) {
          const px = (sx + 0.5) / sub;
          const py = (sy + 0.5) / sub;
          const sc = Math.floor(px);
          const sr = Math.floor(py);
          if (vr[sr * W + sc] !== 1) continue; // capa anclada
          const c = Math.floor(px - (1 - t) * dx);
          const r = Math.floor(py - (1 - t) * dy);
          if (c < 0 || c >= W || r < 0 || r >= W) continue;
          const i = r * W + c;
          if (vm[i] !== 0) continue;
          if (naiveVeil(vm, vr)[i] !== 1) hits++;
        }
      }
      return hits / (sub * sub);
    };
    // 7 = filas que abarca el disco de radio 10 (una celda de filo trasero por fila).
    expect(naiveArea(1, 0, 0)).toBeCloseTo(7, 5);
    expect(naiveArea(1, 0, 0.5)).toBeCloseTo(3.5, 5);
    expect(naiveArea(1, 0, 1)).toBe(0); // al asentar no hay desplazamiento → nunca hubo fuga
  });

  it("DE DÍA (disco pleno) nunca hubo fuga: cero con el horneado nuevo Y con el viejo", () => {
    const day = computeRadiusMask(0x32);
    expect(day.reduce((a, b) => a + b, 0)).toBe(121); // el disco cubre la ventana entera
    const dayVm = new Uint8Array(day);
    for (const t of [0, 0.5, 1])
      expect(
        premulHiddenArea({
          visMask0: dayVm,
          visRadius0: day,
          visMask1: dayVm,
          visRadius1: day,
          window: W,
          dx: 1,
          dy: 0,
          t,
        }),
      ).toBe(0);
  });

  it("🔴 CONTROL OPUESTO: el fix NO vela de más — sobrevelado idéntico antes y después", () => {
    // El predicado de la fuga es de UN SOLO FILO: una veladura que lo tapase todo daría 0,00 y
    // estaría rotísima. Aquí se mide el simétrico —área NEGRA que tapa terreno VISIBLE— contra
    // la réplica del horneado VIEJO. No es cero (artefacto PREEXISTENTE del filo delantero: el
    // campo salta instantáneo y el terreno interpola), y lo que se exige es que NO CREZCA.
    const naiveOver = (dx: number, dy: number, t: number, sub = 8): number => {
      const naive = (m: Uint8Array, disc: Uint8Array): Uint8Array => {
        const o = new Uint8Array(m.length);
        for (let i = 0; i < o.length; i++) o[i] = m[i] === 0 && disc[i] === 1 ? 1 : 0;
        return o;
      };
      let hits = 0;
      for (let sy = 0; sy < W * sub; sy++) {
        for (let sx = 0; sx < W * sub; sx++) {
          const px = (sx + 0.5) / sub;
          const py = (sy + 0.5) / sub;
          const S = Math.floor(py) * W + Math.floor(px);
          const c = Math.floor(px - (1 - t) * dx);
          const r = Math.floor(py - (1 - t) * dy);
          if (c < 0 || c >= W || r < 0 || r >= W) continue;
          const i = r * W + c;
          if (vm[i] !== 1) continue; // no es visible: taparla es correcto
          const anchored = vr[S] === 0 && !(vr[i] === 0); // sin agujero de halo de emisor
          if (anchored || naive(vm, vr)[i] === 1) hits++;
        }
      }
      return hits / (sub * sub);
    };
    let peor = 0;
    for (const [dx, dy] of DIRS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        peor = Math.max(peor, premulHiddenVisibleArea(args(dx, dy, t)) - naiveOver(dx, dy, t));
      }
    }
    expect(peor).toBeLessThanOrEqual(0); // el fix no tapa NI UN PÍXEL de más
    // Control de que la cifra tiene dientes: el sobrevelado preexistente NO es cero.
    expect(naiveOver(1, 0, 0)).toBeCloseTo(7, 5);
    expect(premulHiddenVisibleArea(args(1, 0, 0))).toBeCloseTo(7, 5);
  });

  it("CONTROL: un halo de emisor (VISIBLE fuera del disco) nunca se hornea", () => {
    const glowVm = new Uint8Array(vm);
    let far = -1;
    for (let i = 0; i < vr.length; i++) if (vr[i] === 0) { far = i; break; }
    glowVm[far] = 1; // emisor lejano encendido
    expect(bakeFogVeilMask(glowVm, vr, W)[far]).toBe(0);
  });

  it("un MURO dentro del disco sigue proyectando su sombra (el fix no borra la oclusión)", () => {
    // Control de que la dilatación no ha convertido el horneado en «velar de más»: una celda
    // ocluida DENTRO del disco se sigue horneando, que es la sombra que viaja con el edificio.
    const wallVm = new Uint8Array(vm);
    const wall = 5 * W + 6; // dentro del disco, junto al centro
    wallVm[wall] = 0;
    expect(bakeFogVeilMask(wallVm, vr, W)[wall]).toBe(1);
  });
});

describe("🔴 FILO TRASERO: la columna que abandona el halo no se apaga de golpe (reporte 08-08)", () => {
  // Reporte del usuario, con vídeo: «el smooth move sigue sin funcionar — en la dirección
  // OPUESTA al movimiento los tiles se muestran a saltos». Reproducido en el navegador
  // (overworld, hora 1, paso al Este, piel shader): en el PRIMER fotograma del tween la
  // columna OESTE del recuadro iluminado desaparece entera y se va rellenando según el
  // terreno resbala. Escenario aquí: el MISMO fixture que usa el bloque de fog-rim —
  // overworld nocturno abierto con ANTORCHA, sin muros ni emisores, así que el conjunto
  // visible ES el disco (37 celdas de 121) y el único cambio del paso es que el disco,
  // anclado a la pantalla, deja atrás su anillo trasero.
  const W = 11;
  const vr = computeRadiusMask(10);
  const vm = new Uint8Array(vr);
  const DIRS: [number, number, string][] = [
    [1, 0, "este"],
    [-1, 0, "oeste"],
    [0, 1, "sur"],
    [0, -1, "norte"],
  ];
  const args = (dx: number, dy: number, t: number) => ({
    visMask0: vm,
    visRadius0: vr,
    visMask1: vm,
    visRadius1: vr,
    window: W,
    dx,
    dy,
    t,
  });
  const carryOf = (dx: number, dy: number) => ({ visMask0: vm, visRadius0: vr, dx, dy });

  it("MUTANTE (horneado SIN el carry): el filo trasero pierde (1−t)·7 celdas de luz que ya tenía", () => {
    // Causa de muerte del test: si el arreglo se revierte, ESTA cifra es la que reaparece.
    // 7 = las filas que abarca el disco de radio 10 (una celda de anillo trasero por fila),
    // el mismo cardinal que la fuga simétrica del filo delantero — misma geometría, otro filo.
    expect(premulBlacksCarriedArea({ ...args(1, 0, 0), carry: null })).toBeCloseTo(7, 5);
    expect(premulBlacksCarriedArea({ ...args(1, 0, 0.5), carry: null })).toBeCloseTo(3.5, 5);
    expect(premulBlacksCarriedArea({ ...args(1, 0, 1), carry: null })).toBe(0);
    for (const [dx, dy] of DIRS) {
      expect(premulBlacksCarriedArea({ ...args(dx, dy, 0), carry: null })).toBeGreaterThan(0);
    }
  });

  for (const [dx, dy, name] of DIRS) {
    it(`paso al ${name}: CERO luz perdida dentro del disco, en todo el tween`, () => {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(premulBlacksCarriedArea({ ...args(dx, dy, t), carry: carryOf(dx, dy) })).toBe(0);
      }
    });
  }

  it("CONTROL: la fuga del filo delantero (fog-rim) sigue en CERO con el arreglo puesto", () => {
    // El arreglo desvela celdas; hay que probar que NINGUNA de las desveladas es terreno que
    // no se hubiera visto nunca. Con `carry`, `premulHiddenArea` mide exactamente eso.
    for (const [dx, dy] of DIRS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(premulHiddenArea({ ...args(dx, dy, t), carry: carryOf(dx, dy) })).toBe(0);
      }
    }
  });

  it("CONTROL: sin paso (reposo / fotograma de cierre) el horneado es BIT A BIT el de antes", () => {
    // El asentamiento no se mueve: el `carry` sólo existe mientras hay tween.
    const wall = new Uint8Array(vm);
    wall[5 * W + 6] = 0;
    for (const [dx, dy] of DIRS) {
      expect([...bakeFogVeilMask(wall, vr, W, undefined, null)]).toEqual([
        ...bakeFogVeilMask(wall, vr, W),
      ]);
      // …y con carry sólo cambian celdas del ANILLO (fuera del disco crudo), nunca las de dentro.
      const conCarry = bakeFogVeilMask(wall, vr, W, undefined, carryOf(dx, dy));
      const sinCarry = bakeFogVeilMask(wall, vr, W);
      for (let i = 0; i < conCarry.length; i++) {
        if (conCarry[i] !== sinCarry[i]) expect(vr[i]).toBe(0);
      }
    }
  });

  it("CONTROL: un MURO que acaba de ocultar la casilla DENTRO del disco se sigue horneando", () => {
    // El discriminante no es «se veía antes» a secas: la celda que un muro tapa al dar el paso
    // nace VELADA (LOS instantáneo, testigo rooms-flash-post-b15). Aquí visMask0 la veía y
    // visMask1 no, pero sigue DENTRO del disco → el carry no la exime.
    const wallVm = new Uint8Array(vm);
    const wall = 5 * W + 6; // dentro del disco, junto al centro
    wallVm[wall] = 0;
    expect(vr[wall]).toBe(1);
    expect(bakeFogVeilMask(wallVm, vr, W, undefined, carryOf(1, 0))[wall]).toBe(1);
  });

  it("CONTROL: una casilla oculta que NUNCA se vio sigue horneada aunque esté en el anillo", () => {
    // La otra mitad del discriminante: el anillo se exime SÓLO si el campo viejo la iluminaba.
    // Con `visMask0` a cero (noche cerrada previa) el horneado no cambia ni una celda.
    const nada = new Uint8Array(W * W);
    const carry = { visMask0: nada, visRadius0: vr, dx: 1, dy: 0 };
    expect([...bakeFogVeilMask(vm, vr, W, undefined, carry)]).toEqual([...bakeFogVeilMask(vm, vr, W)]);
  });

  it("DE DÍA (disco pleno) no hay anillo que dejar atrás: el arreglo es un no-op", () => {
    const day = computeRadiusMask(0x32);
    const dayVm = new Uint8Array(day);
    expect(day.reduce((a, b) => a + b, 0)).toBe(121);
    expect([
      ...bakeFogVeilMask(dayVm, day, W, undefined, { visMask0: dayVm, visRadius0: day, dx: 1, dy: 0 }),
    ]).toEqual([...bakeFogVeilMask(dayVm, day, W)]);
  });
});

describe("🔴 FILO DELANTERO: la luz que el paso revela aparece donde se queda (reporte 08-08)", () => {
  // ESCENA DEL VÍDEO del usuario, reconstruida celda a celda desde los fotogramas (670×620,
  // 96 px/tile): disco de radio 1 alrededor del Avatar (3×3), y el paso al ESTE revela una
  // columna iluminada por un EMISOR justo fuera del disco. Los fotogramas f046-f050 medían una
  // BANDA NEGRA vertical en `[558, 654−96·t)` con una FRANJA de tiles DESCOLGADA más allá — la
  // luz nueva punzada un tile por delante de donde va a quedarse.
  const W = 11;
  const idxOf = (c: number, r: number) => r * W + c;
  const mk = (cols: number[], rows: number[]) => {
    const m = new Uint8Array(W * W);
    for (const r of rows) for (const c of cols) m[idxOf(c, r)] = 1;
    return m;
  };
  const filas = [4, 5, 6];
  const vr = mk([4, 5, 6], filas); // disco de radio 1, anclado a pantalla
  const vm0 = mk([4, 5, 6], filas);
  const vm1 = mk([4, 5, 6, 7], filas); // el paso revela la columna 7 (emisor, fuera del disco)

  const negrasSobreIluminada = (t: number, viejo: boolean): string[] => {
    const out: string[] = [];
    for (const r of filas)
      for (let c = 0; c < W; c++) {
        if (vm1[idxOf(c, r)] !== 1) continue;
        const glowV1 = viejo
          ? emitterGlowMask(vm1, vr)
          : carriedGlowMask(emitterGlowMask(vm1, vr), vm0, 1, 0, W);
        const fresh = viejo ? new Uint8Array(W * W) : freshLitMask(vm0, vm1, 1, 0, W);
        if (vr[idxOf(c, r)] === 1) continue;
        if (fresh[idxOf(c, r)] === 1) continue;
        const lit = fogSlideRevealsCell({
          ownerV0: emitterGlowMask(vm0, vr),
          ownerV1: glowV1,
          window: W,
          dx: 1,
          dy: 0,
          t,
          col: c,
          row: r,
        });
        if (!lit && !(vm0[idxOf(c, r)] === 1 && vm1[idxOf(c, r)] === 1)) out.push(`${c},${r}`);
      }
    return out;
  };

  it("MUTANTE (punzado deslizado sin gate): banda negra en la columna 7 y franja en la 8", () => {
    // Las cifras del vídeo, reproducidas: 3 celdas negras (una por fila del disco) sobre terreno
    // que el campo nuevo ilumina, en t=0 y t=0,25; cero desde t=0,5.
    expect(negrasSobreIluminada(0, true)).toEqual(["7,4", "7,5", "7,6"]);
    expect(negrasSobreIluminada(0.25, true)).toEqual(["7,4", "7,5", "7,6"]);
    expect(negrasSobreIluminada(0.5, true)).toEqual([]);
    // Y la FRANJA DESCOLGADA: la columna 8 —negra antes del paso y negra al asentar— se
    // enciende en t=0 porque el halo de la 7 se punza deslizado un tile por delante.
    const glowViejo = emitterGlowMask(vm1, vr);
    expect(
      fogSlideRevealsCell({
        ownerV0: emitterGlowMask(vm0, vr),
        ownerV1: glowViejo,
        window: W,
        dx: 1,
        dy: 0,
        t: 0,
        col: 8,
        row: 5,
      }),
    ).toBe(true);
  });

  it("con el gate: ni banda negra ni franja descolgada, en todo el tween", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(negrasSobreIluminada(t, false)).toEqual([]);
    for (const t of [0, 0.25, 0.5, 0.75]) {
      expect(
        anchoredFogSlideShowsBlack({
          visMask0: vm0,
          visRadius0: vr,
          visMask1: vm1,
          visRadius1: vr,
          window: W,
          dx: 1,
          dy: 0,
          t,
          col: 8,
          row: 5,
        }),
        `la columna 8 sigue NEGRA en t=${t} (no hay franja descolgada)`,
      ).toBe(true);
    }
  });

  it("CONTROL moongate-luz: un emisor que YA se veía sigue deslizando con su terreno", () => {
    // El gate no puede matar el arreglo del que nació el punzado deslizado: si la casilla estaba
    // iluminada en el campo VIEJO, su halo sigue viajando (índice viejo = índice nuevo + paso).
    const conEmisor0 = mk([4, 5, 6, 8], filas); // el emisor ya se veía, un tile más al Este
    const conEmisor1 = mk([4, 5, 6, 7], filas); // tras el paso al Este cae en la columna 7
    const carried = carriedGlowMask(
      emitterGlowMask(conEmisor1, vr),
      conEmisor0,
      1,
      0,
      W,
    );
    expect(carried[idxOf(7, 5)]).toBe(1); // conservado: SÍ desliza
    expect(freshLitMask(conEmisor0, conEmisor1, 1, 0, W)[idxOf(7, 5)]).toBe(0); // no es luz nueva
  });

  it("CONTROL: `carried ∪ fresh` cubre visMask1 entero ⇒ el asentamiento no se mueve", () => {
    const PASOS: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of PASOS) {
      const carried = carriedGlowMask(emitterGlowMask(vm1, vr), vm0, dx, dy, W);
      const fresh = freshLitMask(vm0, vm1, dx, dy, W);
      const persist = persistentLitMask(vm0, vm1);
      for (let i = 0; i < vm1.length; i++) {
        if (vm1[i] !== 1 || vr[i] === 1) continue; // el disco lo cubre la base anclada
        expect(carried[i] === 1 || fresh[i] === 1 || persist[i] === 1).toBe(true);
      }
    }
  });
});

describe("clamp01", () => {
  it("recorta al rango [0,1]", () => {
    expect(clamp01(-0.3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe("litCells — celdas iluminadas del visMask (niebla de ciudad, cross-slide)", () => {
  const W = 3;
  const mk = (vals: number[]): Uint8Array => Uint8Array.from(vals);

  it("enumera (col,row) de las celdas con valor 1, en orden fila-mayor", () => {
    // fila 0: [1,0,1]; fila 1: [0,1,0]; fila 2: [0,0,0]
    const m = mk([1, 0, 1, 0, 1, 0, 0, 0, 0]);
    expect(litCells(m, W)).toEqual([
      { col: 0, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 1 },
    ]);
  });

  it("máscara todo-visible → todas las celdas; todo-oscuro → ninguna", () => {
    expect(litCells(mk([1, 1, 1, 1, 1, 1, 1, 1, 1]), W)).toHaveLength(9);
    expect(litCells(mk([0, 0, 0, 0, 0, 0, 0, 0, 0]), W)).toHaveLength(0);
  });

  it("sólo cuenta el valor EXACTO 1 (no cualquier no-cero) — casa con visMask del core", () => {
    // el core escribe 1=visible / 0=oculta; blindaje contra un futuro '2'
    expect(litCells(mk([1, 2, 0, 0, 0, 0, 0, 0, 0]), W)).toEqual([{ col: 0, row: 0 }]);
  });

  it(
    "INVARIANTE forma-cambiante: la unión de luz de dos campos (V0 grande → V1 pequeño tras " +
      "meterse tras un muro) NO oscurece nada que V0 iluminaba — el disco no salta a oscuras",
    () => {
      // V0: disco amplio (centro + cardinales). V1: sólo el centro (LOS colapsó tras el muro).
      const v0 = mk([0, 1, 0, 1, 1, 1, 0, 1, 0]);
      const v1 = mk([0, 0, 0, 0, 1, 0, 0, 0, 0]);
      const key = (c: { col: number; row: number }): string => `${c.col},${c.row}`;
      const union = new Set([...litCells(v0, W), ...litCells(v1, W)].map(key));
      // Durante el tween se REVELAN ambos campos (cada uno en su offset): la unión ⊇ V0,
      // así que ninguna celda que estaba iluminada en V0 cae a negro a mitad del paso.
      for (const c of litCells(v0, W)) expect(union.has(key(c))).toBe(true);
      expect(union.size).toBe(5); // los 5 de V0 (V1 ⊆ V0 aquí)
    },
  );
});

describe("fogSlideRevealsCell — z-order de la niebla: nada oculto en el frame visto parpadea", () => {
  const W = 5;
  const mk = (fill = 0): Uint8Array => new Uint8Array(W * W).fill(fill);
  const set = (m: Uint8Array, col: number, row: number, v: number): void => {
    m[row * W + col] = v;
  };

  // Modelo del BUG viejo (unión OR de los huecos de oclusión de ambos campos), para
  // demostrar que el fixture SÍ parpadeaba antes del fix.
  const oldUnionReveals = (
    occV0: Uint8Array,
    occV1: Uint8Array,
    dx: number,
    dy: number,
    t: number,
    col: number,
    row: number,
  ): boolean => {
    const cx = col + 0.5;
    const cy = row + 0.5;
    const litAt = (m: Uint8Array, ox: number, oy: number): boolean => {
      const mc = Math.floor(cx - ox);
      const mr = Math.floor(cy - oy);
      if (mc < 0 || mc >= W || mr < 0 || mr >= W) return false;
      return m[mr * W + mc] === 1;
    };
    return (
      litAt(occV1, (1 - t) * dx, (1 - t) * dy) || litAt(occV0, -t * dx, -t * dy)
    );
  };

  it(
    "FIXTURE DEL BUG: una habitación OCULTA en ambos frames (occluida) que en el frame " +
      "viejo caía fuera del disco NO se revela a mitad de paso (antes: parpadeaba)",
    () => {
      // Paso al sur (dx=0, dy=1), t=0.5. Celda de pantalla (2,2), en zona cubierta por V1.
      // Frame NUEVO: la celda es una habitación OCLUTA dentro del disco → occlusionLit_V1=0
      //   y visMask_V1=0 (nunca vista).
      // Frame VIEJO: el MISMO mundo caía FUERA del disco → occlusionLit_V0=1 (marcador
      //   fuera-de-disco) pero visMask_V0=0 (jamás vista de verdad).
      const dx = 0;
      const dy = 1;
      const t = 0.5;
      const occV0 = mk(0);
      const occV1 = mk(0);
      const visV0 = mk(0);
      const visV1 = mk(0);
      // El marcador fuera-de-disco de V0 cae, tras su offset (−t·dy=−0.5), sobre (2,2):
      // mc=floor(2.5)=2, mr=floor(2.5+0.5)=3 → occV0[(3,2)] = 1 (occlusionLit, NO visMask).
      set(occV0, 2, 3, 1);
      // V1 tiene (2,2) occluida: occV1[(2, floor(2.5-0.5)=2)] = 0. visV1 idem 0. (ya en 0)

      // El bug viejo la revelaría (unión OR):
      expect(oldUnionReveals(occV0, occV1, dx, dy, t, 2, 2)).toBe(true);

      // El dueño autoritativo NO la revela: dueño = V1 (cubre), occlusionLit_V1=0 → negra.
      // (El aporte genuino del contrario se eliminó; ya no puede destaparla.)
      expect(
        fogSlideRevealsCell({
          ownerV0: occV0,
          ownerV1: occV1,
          window: W,
          dx,
          dy,
          t,
          col: 2,
          row: 2,
        }),
      ).toBe(false);
      // Referencias: `visV0`/`visV1` modelan el visMask genuino que el bug viejo (y el
      // suavizado posterior) usaban; el dueño autoritativo ya no los consulta.
      void visV0;
      void visV1;
    },
  );

  it("DUEÑO AUTORITATIVO (occlusion-flash): celda OCLUTA en el frame nuevo NO se revela aunque el viejo la VIERA", () => {
    // (2,2) ocluida en el frame nuevo (dueño V1: occV1=0) pero GENUINAMENTE vista en el viejo.
    // El terreno visible en zona de V1 es el de V1 → revelarla destaparía terreno que V1 oculta
    // (habitación tras un muro) = el parpadeo occlusion-flash del castillo LB. Debe quedar NEGRA.
    const dx = 0;
    const dy = 1;
    const t = 0.5;
    const occV0 = mk(0);
    const occV1 = mk(0);
    // El viejo la vio de verdad (irrelevante ya: el dueño manda). Sin params genuine.
    expect(
      fogSlideRevealsCell({
        ownerV0: occV0,
        ownerV1: occV1,
        window: W,
        dx,
        dy,
        t,
        col: 2,
        row: 2,
      }),
    ).toBe(false); // dueño V1 la oculta → negra; contenido ocluido jamás pintado
  });

  it("las sombras SIGUEN deslizando: hueco de oclusión de V1 se revela en su posición desplazada", () => {
    // V1 ilumina (2,1); a t=0.5, dy=1 su offset es +0.5 → aparece centrado en pantalla (2, ~1.5).
    const dx = 0;
    const dy = 1;
    const t = 0.5;
    const occV1 = mk(0);
    set(occV1, 2, 1, 1);
    const reveals = (row: number): boolean =>
      fogSlideRevealsCell({
        ownerV0: mk(0),
        ownerV1: occV1,
        window: W,
        dx,
        dy,
        t,
        col: 2,
        row,
      });
    // el hueco de V1 en fila-mundo 1 se ve, a media transición, desplazado hacia abajo:
    expect(reveals(1)).toBe(true); // centro (2.5,1.5): floor(1.5-0.5)=1 → occV1[(1,2)]=1
  });

  it("t=1 (settle): dueño V1 en TODO el viewport, revelado == occlusionLit_V1 (byte-idéntico)", () => {
    const dx = 0;
    const dy = 1;
    const occV1 = mk(0);
    set(occV1, 1, 1, 1);
    set(occV1, 3, 4, 1);
    for (let row = 0; row < W; row++) {
      for (let col = 0; col < W; col++) {
        const r = fogSlideRevealsCell({
          ownerV0: mk(1), // V0 todo-lit: no debe influir en t=1 (V1 cubre todo)
          ownerV1: occV1,
          window: W,
          dx,
          dy,
          t: 1,
          col,
          row,
        });
        expect(r).toBe(occV1[row * W + col] === 1);
      }
    }
  });
});

describe("franja saliente dueño-V0: la celda que pasa a OCLUIDA nace velada (outgoing-edge)", () => {
  const W = 5;
  const mk = (fill = 0): Uint8Array => new Uint8Array(W * W).fill(fill);
  const set = (m: Uint8Array, col: number, row: number, v: number): void => {
    m[row * W + col] = v;
  };

  // 🔴 Este bloque tenía TRES asertos y los tres medían la MISMA rama —la de «sin contraparte
  // en la ventana»— mientras sus títulos prometían la de OCLUSIÓN. El caso que el gate existe
  // para cubrir (rooms-flash-post-b15: V0 la veía, V1 la OCLUYE, contraparte DENTRO de la
  // ventana) no lo ejercitaba NINGUNO. Se separan: la oclusión real se sella aquí abajo con su
  // propio caso, y la rama sin-contraparte pasa a afirmar lo contrario (sigue iluminada).
  it("GEOMETRÍA: la rama dueño-V0 SÓLO se alcanza donde la contraparte del campo nuevo cae FUERA", () => {
    // 🔴 Propiedad comprobada A MÁQUINA, no razonada en un comentario: en `fogSlideRevealsCell`
    // la franja que V1 no cubre es siempre la fila/columna del borde TRASERO, y su casilla de
    // mundo en el frame nuevo se sale de la ventana. Es decir: la rama del gate que compara
    // contra `ownerV1` con contraparte DENTRO de la ventana es INALCANZABLE. Por eso «velar lo
    // que no tiene contraparte» no era una cautela de oclusión: era el ÚNICO efecto del gate.
    // Si algún día cambia la geometría del cross-slide (paso diagonal, más de un tile, otra
    // curva de offsets), este test se pone rojo y hay que re-derivar el gate entero.
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let k = 0; k <= 100; k++) {
        const t = k / 100;
        const v1ox = (1 - t) * dx;
        const v1oy = (1 - t) * dy;
        for (let row = 0; row < W; row++)
          for (let col = 0; col < W; col++) {
            const cx = col + 0.5;
            const cy = row + 0.5;
            const v1Covers = cx >= v1ox && cx < v1ox + W && cy >= v1oy && cy < v1oy + W;
            if (v1Covers) continue; // manda V1: no es la rama del gate
            const mc0 = Math.floor(cx + t * dx);
            const mr0 = Math.floor(cy + t * dy);
            if (mc0 < 0 || mc0 >= W || mr0 < 0 || mr0 >= W) continue; // nada dibujado
            const mc1 = mc0 - dx;
            const mr1 = mr0 - dy;
            const fuera = mc1 < 0 || mc1 >= W || mr1 < 0 || mr1 >= W;
            expect(
              fuera,
              `dueño-V0 con contraparte DENTRO en (${col},${row}) t=${t} paso (${dx},${dy})`,
            ).toBe(true);
          }
      }
    }
  });

  it("fogSlideRevealsCell: la celda SIN CONTRAPARTE en la ventana nueva sigue ILUMINADA mientras sale", () => {
    // 🔴 EL DEFECTO DEL BORDE DE SALIDA. Paso al ESTE (dx=1): la franja saliente es el borde
    // IZQUIERDO, y su casilla de mundo en el frame nuevo sería la columna −1 = FUERA de la
    // ventana 11×11. El campo nuevo NO OPINA sobre ella. El gate la trataba como OCLUIDA y
    // apagaba la columna entera en el primer fotograma del tween; debe mandar su propio campo.
    const dx = 1, dy = 0, t = 0.1;
    const ownerV0 = mk(0);
    set(ownerV0, 0, 2, 1); // V0 la ve
    const ownerV1 = mk(0); // el campo nuevo no la ve en NINGÚN índice (no tiene contraparte)
    expect(fogSlideRevealsCell({ ownerV0, ownerV1, window: W, dx, dy, t, col: 0, row: 2 })).toBe(
      true,
    );
    // Y sigue iluminada mientras la franja la contiene; en cuanto V1 la cubre manda V1.
    expect(fogSlideRevealsCell({ ownerV0, ownerV1, window: W, dx, dy, t: 0.25, col: 0, row: 2 })).toBe(
      true,
    );
  });

  it("fogSlideRevealsCell: celda VISIBLE en V0 y AÚN visible en V1 SÍ desliza (no sobre-vela)", () => {
    const dx = 1, dy = 0, t = 0.1;
    const ownerV0 = mk(0);
    set(ownerV0, 0, 2, 1);
    set(ownerV0, 1, 2, 1);
    const ownerV1 = mk(1); // V1 ve todo
    // Celda de pantalla (1,2): cx=1.5. v1ox=0.9 → cubierta por V1 → rama V1 (visible) → revela.
    expect(fogSlideRevealsCell({ ownerV0, ownerV1, window: W, dx, dy, t, col: 1, row: 2 })).toBe(true);
  });

  it("outgoingGatedMaskV0: conserva sólo las celdas que V0 ve Y V1 (índice −paso) sigue viendo", () => {
    const dx = 1, dy = 0;
    const maskV0 = mk(0);
    set(maskV0, 3, 2, 1); // V0 ve (3,2)
    set(maskV0, 2, 2, 1); // V0 ve (2,2)
    const maskV1 = mk(0);
    set(maskV1, 2, 2, 1); // V1 ve la casilla de mundo que en V0 estaba en (3,2) [3-1=2]
    // (1,2) para la de V0 en (2,2) [2-1=1] → V1 NO la ve.
    const g = outgoingGatedMaskV0(maskV0, maskV1, dx, dy, W);
    expect(g[2 * W + 3]).toBe(1); // (3,2): V0 sí, V1(2,2) sí → conservada
    expect(g[2 * W + 2]).toBe(0); // (2,2): V0 sí, V1(1,2) no → velada (OCLUSIÓN real, intacta)
    // 🔴 Y la celda del borde cuya contraparte SALE de la ventana se CONSERVA: el campo nuevo
    // no opina sobre ella, y es justo la que ocupa la franja saliente. Antes caía a 0 y
    // apagaba entera la columna/fila que se va (ver `fogSlideRevealsCell`).
    const maskV0b = mk(0);
    set(maskV0b, 0, 2, 1);
    expect(outgoingGatedMaskV0(maskV0b, mk(0), dx, dy, W)[2 * W + 0]).toBe(1); // 0-1=-1 → sin opinión
  });

  it("outgoingGatedMaskV0: sin paso neto (dx=dy=0) = maskV0 ∩ maskV1 (idempotente en identidad)", () => {
    const a = mk(0);
    set(a, 1, 1, 1);
    set(a, 3, 3, 1);
    const b = mk(0);
    set(b, 1, 1, 1);
    const g = outgoingGatedMaskV0(a, b, 0, 0, W);
    expect(g[1 * W + 1]).toBe(1);
    expect(g[3 * W + 3]).toBe(0);
  });
});

describe("fogCompositeRevealsCell — fuga del borde entrante: sala tapiada FUERA del disco", () => {
  const W = 11;
  const mk = (fill = 0): Uint8Array => new Uint8Array(W * W).fill(fill);
  const set = (m: Uint8Array, col: number, row: number, v: number): void => {
    m[row * W + col] = v;
  };
  // occlusionLit = visMask OR NOT visRadius (réplica de occlusionLitMask, para armar owners).
  const occ = (visMask: Uint8Array, visRadius: Uint8Array): Uint8Array => {
    const out = mk(0);
    for (let i = 0; i < out.length; i++)
      out[i] = visMask[i] === 1 || visRadius[i] === 0 ? 1 : 0;
    return out;
  };

  it(
    "sala tapiada (visMask=0) FUERA del disco (visRadius=0) queda NEGRA durante el tween, " +
      "NO asoma en la franja deslizada (la capa deslizante recorta al disco)",
    () => {
      // Paso al ESTE (dx=1, dy=0). El disco de radio de la party es pequeño (centrado); la
      // sala del ESTE (col 8) está iluminada de refilón por emisores en el frame nuevo pero
      // TAPIADA (visMask=0) y fuera del disco (visRadius=0). En el frame viejo el mismo mundo
      // era visible (visMask=1). Sin el recorte, occlusionLit=1 (por ¬visRadius) la revelaría
      // en la franja deslizada.
      const dx = 1;
      const dy = 0;
      const t = 0.5;
      const visRadius1 = mk(0);
      // Disco pequeño: sólo el centro y sus vecinos (col 4..6) dentro del radio.
      for (let row = 3; row <= 7; row++)
        for (let col = 4; col <= 6; col++) set(visRadius1, col, row, 1);
      const visMask1 = mk(0);
      // Vecindad del centro visible; la sala del este (col 8, row 5) TAPIADA (=0, ya en 0).
      for (let row = 3; row <= 7; row++)
        for (let col = 2; col <= 6; col++) set(visMask1, col, row, 1);
      // Frame viejo (V0): la sala del este ERA visible (LOS abierto antes del muro).
      const visMask0 = mk(0);
      for (let row = 3; row <= 7; row++)
        for (let col = 2; col <= 9; col++) set(visMask0, col, row, 1);
      const visRadius0 = visRadius1; // disco idéntico (centrado, party siempre al centro)

      const ownerV0 = occ(visMask0, visRadius0);
      const ownerV1 = occ(visMask1, visRadius1);
      const args = {
        ownerV0,
        ownerV1,
        visMask1,
        visRadius1,
        window: W,
        dx,
        dy,
        t,
        col: 8,
        row: 5,
      };

      // El modelo SÓLO-deslizante (bug) SÍ la revela: occlusionLit_V1(8,5)=1 (¬visRadius) y a
      // media transición el dueño la punza → terreno ocluido a la vista.
      expect(fogSlideRevealsCell(args)).toBe(true);
      // El composite (fix) NO la revela: (8,5) cae fuera del disco → manda la capa anclada,
      // revelada ⟺ visMask1(8,5)=0 → NEGRA. Sin fuga.
      expect(fogCompositeRevealsCell(args)).toBe(false);
    },
  );

  it("emisor lejano FUERA del disco (visMask=1) SÍ se ve (anclado), no lo apaga el recorte", () => {
    const visRadius1 = mk(0);
    set(visRadius1, 5, 5, 1); // disco mínimo (sólo el centro)
    const visMask1 = mk(0);
    set(visMask1, 8, 5, 1); // celda iluminada por emisor, fuera del disco
    const args = {
      ownerV0: mk(1),
      ownerV1: mk(1),
      visMask1,
      visRadius1,
      window: W,
      dx: 1,
      dy: 0,
      t: 0.5,
      col: 8,
      row: 5,
    };
    expect(fogCompositeRevealsCell(args)).toBe(true);
  });

  it("DENTRO del disco: composite == fogSlideRevealsCell (la oclusión de muros desliza)", () => {
    const visRadius1 = mk(1); // disco pleno
    const visMask1 = mk(1);
    set(visMask1, 5, 5, 0); // un muro dentro del disco
    const ownerV0 = mk(1);
    const ownerV1 = mk(1);
    set(ownerV1, 5, 5, 0);
    for (let row = 0; row < W; row++) {
      for (let col = 0; col < W; col++) {
        const a = {
          ownerV0,
          ownerV1,
          visMask1,
          visRadius1,
          window: W,
          dx: 1,
          dy: 0,
          t: 0.5,
          col,
          row,
        };
        expect(fogCompositeRevealsCell(a)).toBe(fogSlideRevealsCell(a));
      }
    }
  });

  it("t=1 (settle): composite reduce a occlusionLit_V1 dentro del disco (byte-idéntico)", () => {
    const visRadius1 = mk(1);
    const visMask1 = mk(1);
    set(visMask1, 3, 4, 0);
    const ownerV1 = mk(1);
    set(ownerV1, 3, 4, 0);
    for (let row = 0; row < W; row++) {
      for (let col = 0; col < W; col++) {
        const a = {
          ownerV0: mk(1),
          ownerV1,
          visMask1,
          visRadius1,
          window: W,
          dx: 0,
          dy: 1,
          t: 1,
          col,
          row,
        };
        expect(fogCompositeRevealsCell(a)).toBe(ownerV1[row * W + col] === 1);
      }
    }
  });
});

describe("anchoredFogSlideShowsBlack — halos de emisor DESLIZAN en la capa anclada (moongate-luz)", () => {
  const W = 5;
  const mk = (fill = 0): Uint8Array => new Uint8Array(W * W).fill(fill);
  const set = (m: Uint8Array, col: number, row: number, v: number): void => {
    m[row * W + col] = v;
  };
  const args = (over: Record<string, unknown>) => ({
    visMask0: mk(0),
    visRadius0: mk(0),
    visMask1: mk(0),
    visRadius1: mk(0),
    window: W,
    dx: 1,
    dy: 0,
    t: 0.5,
    col: 0,
    row: 0,
    ...over,
  });

  it("dentro del disco de radio NUNCA pinta negro (la base anclada es ¬vr1 pura)", () => {
    const visRadius1 = mk(0);
    set(visRadius1, 2, 2, 1);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(
        anchoredFogSlideShowsBlack(args({ visRadius1, t, col: 2, row: 2 })),
      ).toBe(false);
    }
  });

  it("halo de moongate fuera del disco: el agujero DESLIZA de la posición vieja a la nueva", () => {
    // Paso dx=1 (centro +1 este): la celda de mundo del halo estaba en col 2 (V0) y
    // queda en col 1 (V1). Disco de la party lejos (esquina) → todo ¬vr1.
    const visRadius1 = mk(0);
    set(visRadius1, 0, 0, 1);
    const visMask0 = mk(0);
    set(visMask0, 2, 2, 1); // halo pre-paso (coords de ventana V0)
    const visMask1 = mk(0);
    set(visMask1, 1, 2, 1); // halo post-paso (coords de ventana V1)
    const at = (t: number, col: number): boolean =>
      anchoredFogSlideShowsBlack(args({ visRadius1, visMask0, visMask1, t, col, row: 2 }));
    // t≈0: el agujero está en la posición de pantalla VIEJA (col 2), no en la nueva (col 1).
    expect(at(0.01, 2)).toBe(false); // luz (posición vieja)
    expect(at(0.01, 1)).toBe(true); // aún negro (la luz no ha llegado)
    // t=1 (settle): el agujero ha llegado a la posición NUEVA (col 1); la vieja vuelve a negro.
    expect(at(1, 1)).toBe(false);
    expect(at(1, 2)).toBe(true);
    // El viaje es monótono: en t=0.75 la celda destino ya recibe la luz deslizada.
    expect(at(0.75, 1)).toBe(false);
  });

  it("settle t=1: negro ⟺ ¬anchoredLitMask(visMask1, vr1) (byte-idéntico a la vía anclada)", () => {
    const visRadius1 = mk(0);
    set(visRadius1, 2, 2, 1);
    set(visRadius1, 3, 2, 1);
    const visMask1 = mk(0);
    set(visMask1, 1, 2, 1);
    set(visMask1, 2, 2, 1);
    set(visMask1, 4, 4, 1);
    const anchored = anchoredLitMask(visMask1, visRadius1);
    for (let row = 0; row < W; row++) {
      for (let col = 0; col < W; col++) {
        expect(
          anchoredFogSlideShowsBlack(
            args({ visMask0: mk(0), visMask1, visRadius1, t: 1, col, row }),
          ),
        ).toBe(anchored[row * W + col] === 0);
      }
    }
  });

  it("región cubierta por V1: una celda OCLUIDA en V1 queda negra aunque V0 la viera (dueño manda)", () => {
    const visRadius1 = mk(0); // todo fuera del disco
    const visMask0 = mk(1); // V0 lo veía todo
    const visMask1 = mk(0); // V1 lo oculta todo
    for (const t of [0.01, 0.25, 0.5, 0.75, 1]) {
      // col 3 (centro 3.5): cubierta por V1 ∀t (v1ox=(1−t)·1 ≤ 1) → manda visMask1 → negro.
      expect(
        anchoredFogSlideShowsBlack(args({ visMask0, visMask1, visRadius1, t, col: 3, row: 2 })),
      ).toBe(true);
    }
  });

  it("🔴 BORDE DE SALIDA: la celda cuyo mundo SALE de la ventana sigue ILUMINADA mientras se va", () => {
    // REPORTE DEL USUARIO (07-08): «detrás, las tiles que se van ocultando no lo hacen suave».
    // dx=1 → franja saliente = borde izquierdo. La celda V0 (0,2) estaba ILUMINADA por un
    // emisor y su casilla de mundo no tiene contraparte en V1 (col −1). El gate la velaba →
    // la columna trasera se apagaba ENTERA en el primer fotograma del tween mientras el
    // terreno seguía deslizando debajo. Medido en el navegador (Paws loc22 (15,6) noche, paso
    // al SUR): la fila trasera pasaba de iluminada a 100 % negra en el PRIMER fotograma,
    // incremento de negrura 0,661 en la peor celda, y el resto del viewport cambiaba
    // gradualmente (peor 0,625, y en el ÚLTIMO fotograma). Ahora manda su propio campo.
    const visRadius1 = mk(0);
    const visMask0 = mk(0);
    set(visMask0, 0, 2, 1);
    const visMask1 = mk(0);
    // t=0.25: v1ox=0.75 → la col 0 (centro 0.5) es franja V0 (0.5 < 0.75) → dueño V0.
    expect(
      anchoredFogSlideShowsBlack(args({ visMask0, visMask1, visRadius1, t: 0.25, col: 0, row: 2 })),
    ).toBe(false);
    // Y en t=0 (arranque del tween) tampoco: el fotograma inicial debe ser el reposo previo.
    expect(
      anchoredFogSlideShowsBlack(args({ visMask0, visMask1, visRadius1, t: 0, col: 0, row: 2 })),
    ).toBe(false);
    // En cuanto V1 cubre la celda (t≥0.5, centro 0.5 ≥ v1ox=0.5) manda V1 → negra: el relevo
    // ocurre cuando llega el terreno nuevo, no antes. ASENTAMIENTO intacto.
    expect(
      anchoredFogSlideShowsBlack(args({ visMask0, visMask1, visRadius1, t: 0.5, col: 0, row: 2 })),
    ).toBe(true);
    expect(
      anchoredFogSlideShowsBlack(args({ visMask0, visMask1, visRadius1, t: 1, col: 0, row: 2 })),
    ).toBe(true);
  });

  it("🔴 BORDE DE SALIDA · las CUATRO direcciones: cero celdas se apagan de golpe en t=0", () => {
    // Invariante de CONTINUIDAD: en t=0 la pantalla muestra V0 exacto (el terreno no se ha
    // movido), así que la capa anclada tiene que coincidir con el REPOSO PREVIO, celda a
    // celda. Se comprueba en las cuatro direcciones con un halo de emisor cuyo filo abandona
    // la ventana por detrás — la familia que el gate apagaba.
    const disc = (rad: number): Uint8Array => {
      const m = mk(0);
      for (let r = 0; r < W; r++)
        for (let c = 0; c < W; c++) {
          const ddx = c - (W >> 1);
          const ddy = r - (W >> 1);
          if (ddx * ddx + ddy * ddy <= rad * rad) m[r * W + c] = 1;
        }
      return m;
    };
    const halo = (hc: number, hr: number, rad: number): Uint8Array => {
      const m = mk(0);
      for (let r = 0; r < W; r++)
        for (let c = 0; c < W; c++) {
          const ddx = c - hc;
          const ddy = r - hr;
          if (ddx * ddx + ddy * ddy <= rad * rad) m[r * W + c] = 1;
        }
      return m;
    };
    const or = (a: Uint8Array, b: Uint8Array): Uint8Array => {
      const o = mk(0);
      for (let i = 0; i < o.length; i++) o[i] = a[i] === 1 || b[i] === 1 ? 1 : 0;
      return o;
    };
    const vr = disc(1);
    const mid = W >> 1;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      // Emisor DETRÁS, a 2 casillas del borde trasero; tras el paso su halo ya no alcanza.
      const at: [number, number] = dx !== 0 ? [dx > 0 ? -2 : W + 1, mid] : [mid, dy > 0 ? -2 : W + 1];
      const vm0 = or(vr, halo(at[0], at[1], 2));
      const vm1 = or(vr, halo(at[0] - dx, at[1] - dy, 2));
      const lit0 = anchoredLitMask(vm0, vr);
      const apagadas: string[] = [];
      for (let row = 0; row < W; row++)
        for (let col = 0; col < W; col++) {
          if (lit0[row * W + col] !== 1) continue; // ya era negra en el reposo
          if (
            anchoredFogSlideShowsBlack({
              visMask0: vm0,
              visRadius0: vr,
              visMask1: vm1,
              visRadius1: vr,
              window: W,
              dx,
              dy,
              t: 0,
              col,
              row,
            })
          )
            apagadas.push(`${col},${row}`);
        }
      expect(apagadas, `paso (${dx},${dy}): celdas apagadas de golpe en t=0`).toEqual([]);
    }
  });

  it("REGRESIÓN control: la luz del DISCO party (visMask ∩ vr) NO punza deslizada — el halo no deriva", () => {
    // Noche sin emisores: visMask = disco lit (≡ vr). Si la luz del disco punzara
    // deslizada, en t≈0 la celda de pantalla junto al disco (fuera de vr1) quedaría
    // revelada por el punzado de V1 a offset +1 → el halo viajaría con el terreno
    // (discDrift=1 tile medido en el control). Debe quedar NEGRA en todo el tween.
    const disc = mk(0);
    set(disc, 2, 2, 1); // disco 1-celda en el centro
    const visMask0 = disc;
    const visRadius0 = disc;
    const visMask1 = disc;
    const visRadius1 = disc;
    for (const t of [0.01, 0.25, 0.5, 0.75, 1]) {
      // celda (3,2), fuera del disco anclado: el punzado deslizado de V1 (offset +(1−t))
      // pasaría por encima si la luz del disco deslizara — no debe.
      expect(
        anchoredFogSlideShowsBlack(
          args({ visMask0, visRadius0, visMask1, visRadius1, t, col: 3, row: 2 }),
        ),
      ).toBe(true);
    }
  });

  it("emitterGlowMask: visMask ∩ ¬visRadius (sólo la luz de emisor, no la del disco)", () => {
    const visMask = Uint8Array.from([1, 1, 0, 1]);
    const visRadius = Uint8Array.from([1, 0, 0, 1]);
    expect([...emitterGlowMask(visMask, visRadius)]).toEqual([0, 1, 0, 0]);
  });
});

/**
 * CORTINA NEGRA DEL TWEEN (ficha #34, testigo del usuario por SEGUNDA vez): al andar con la
 * piel smooth en una sala ILUMINADA, celdas que están iluminadas ANTES y DESPUÉS del paso se
 * pintan NEGRAS durante la transición. El defecto MUERE al asentar el tween — por eso ninguna
 * captura del estado final lo cazaba: se mide en el FRAME INTERMEDIO (t=0 y t=0.25).
 *
 * El arreglo anterior de esta familia (moongate-luz) declaraba el residuo como «SUB-TILE» en su
 * docstring; MEDIDO aquí, son CELDAS ENTERAS (una columna/fila completa + un arco en el filo del
 * disco). Esa cota optimista es la razón de que nadie volviera a mirar.
 */
describe("cortina negra del tween en sala iluminada (ficha #34)", () => {
  const W = 11;
  const DIRS: [string, number, number][] = [
    ["Este", 1, 0],
    ["Oeste", -1, 0],
    ["Sur", 0, 1],
    ["Norte", 0, -1],
  ];
  const TS = [0, 0.25, 0.5, 0.75, 1];
  /**
   * LOS REGÍMENES DE LUZ, y por qué el censo se hace sobre TODOS y no sobre uno.
   *
   * `computeRadiusMask` compara contra `radialDistance`, que es una métrica **CUADRADA**
   * (fila central: 25 16 9 4 1 0 1 4 9 16 25), así que el disco NO crece de forma intuitiva
   * con `lightLevel` y hay que fijar el tamaño esperado de cada uno o la tabla miente sin
   * avisar. `lightLevel` sale de `survival.ts::lightLevel`: 2 de noche / en sótano
   * (`floorByte > 0x7f`) / en `DARK_LOCATION`, 0x32 de día, y el suelo de ANTORCHA
   * (`torchTurns > 0`) es 0x0a.
   *
   * 🔴 POR QUÉ ESTÁ PARAMETRIZADO. La primera versión de este bloque censaba SÓLO
   * `computeRadiusMask(2)` y publicó «14 celdas» como si fuera LA cifra del defecto. No lo
   * era: la columna entrante son 11 siempre, pero el ARCO ESCALA CON EL DISCO. Pre-fix,
   * medido, sala 11×11 entera iluminada:
   *     lightLevel 2 → 14 (11+3) · 5 → 16 (11+5) · 10 → 18 (11+7) · 18 → 20 (11+9) · 0x32 → 0
   * Y el testigo del usuario decía «con luz de antorchas», o sea que la cifra que importaba
   * era **18**, no la 14 que se publicó. Una cifra sin su régimen se lee como universal.
   * Con un solo disco en la batería, una regresión que sólo se notara con disco grande
   * saldría VERDE.
   */
  const REGIMENES: [nombre: string, lightLevel: number, celdasDelDisco: number][] = [
    ["noche/sótano (lightLevel=2)", 2, 9],
    ["lightLevel=5", 5, 21],
    ["ANTORCHA (lightLevel=0x0a) — el régimen del testigo", 0x0a, 37],
    ["Light spell (lightLevel=18)", 18, 61],
    ["día (lightLevel=0x32)", 0x32, 121],
  ];
  const disc = computeRadiusMask(2); // disco de la party de noche (lightLevel=2): 9 celdas

  /** Celdas de PANTALLA que la capa anclada pinta negras, con nombre (col,row). */
  const negras = (
    visMask0: Uint8Array,
    visMask1: Uint8Array,
    visRadius: Uint8Array,
    dx: number,
    dy: number,
    t: number,
  ): string[] => {
    const out: string[] = [];
    for (let row = 0; row < W; row++) {
      for (let col = 0; col < W; col++) {
        if (
          anchoredFogSlideShowsBlack({
            visMask0,
            visRadius0: visRadius,
            visMask1,
            visRadius1: visRadius,
            window: W,
            dx,
            dy,
            t,
            col,
            row,
          })
        )
          out.push(`${col},${row}`);
      }
    }
    return out;
  };

  it("los CINCO regímenes de luz dan el disco esperado (la métrica de radialDistance es CUADRADA)", () => {
    // Guarda de la tabla: si `radialDistance` o `computeRadiusMask` cambian, los censos de
    // abajo dejarían de significar lo que dicen sus nombres y este aserto lo dice primero.
    for (const [nombre, lightLevel, celdas] of REGIMENES) {
      const m = computeRadiusMask(lightLevel);
      expect(
        m.reduce((a: number, b: number) => a + b, 0),
        nombre,
      ).toBe(celdas);
    }
  });

  it("sala ENTERA iluminada: NINGUNA celda se pinta negra en NINGÚN t, en las CUATRO direcciones, en los CINCO regímenes de luz", () => {
    // 🔴 SE ACUMULA, NO SE ASERTA DENTRO DEL BUCLE. Con `expect` por iteración, el primer
    // régimen que falla mata a los de detrás — y los de detrás son justamente los que este
    // test añade (con el disco nocturno el arco son 3 celdas; con el de antorcha, 7). Medido:
    // el mutante que suprime el suelo de persistencia sólo reportaba `lightLevel=2` y dejaba
    // los otros cuatro SIN EVALUAR, que es indistinguible de que pasaran.
    const lit = new Uint8Array(W * W).fill(1); // las 121 celdas con visMask=1
    const fallos: string[] = [];
    for (const [regimen, lightLevel] of REGIMENES) {
      const vr = computeRadiusMask(lightLevel);
      for (const [nombre, dx, dy] of DIRS) {
        for (const t of TS) {
          const n = negras(lit, lit, vr, dx, dy, t);
          if (n.length > 0) fallos.push(`${regimen} · ${nombre} · t=${t} → ${n.length} negras`);
        }
      }
    }
    expect(fallos).toEqual([]);
  });

  it("CONTROL NEGATIVO por RÉGIMEN (noche cerrada): fuera del disco sigue todo NEGRO ∀t ∀dirección — el halo NO deriva con NINGÚN tamaño de disco", () => {
    // El control de «no revela de más» corrido en cada régimen: `visMask ≡ disco`, así que la
    // única luz es la de la party y su anclaje a pantalla es el correcto. Cuanto mayor el
    // disco, más largo su filo y más ocasión de que un punzado deslizado se derrame.
    // Se ACUMULA por el mismo motivo que el test de arriba: un aserto dentro del bucle
    // dejaría los regímenes posteriores sin evaluar.
    const fallos: string[] = [];
    for (const [regimen, lightLevel, celdas] of REGIMENES) {
      const vr = computeRadiusMask(lightLevel);
      const fuera: string[] = [];
      for (let row = 0; row < W; row++)
        for (let col = 0; col < W; col++) if (vr[row * W + col] === 0) fuera.push(`${col},${row}`);
      // Población asertada por régimen: el control NO puede quedarse vacío sin que se vea.
      expect(fuera.length, `población de ${regimen}`).toBe(121 - celdas);
      if (fuera.length === 0) continue; // día: el disco cubre las 121 → sin población que controlar
      for (const [nombre, dx, dy] of DIRS)
        for (const t of TS) {
          const n = new Set(negras(vr, vr, vr, dx, dy, t));
          const destapadas = fuera.filter((c) => !n.has(c));
          if (destapadas.length > 0)
            fallos.push(`${regimen} · ${nombre} · t=${t} → ${destapadas.length} destapadas`);
        }
    }
    expect(fallos).toEqual([]);
  });

  it("de DÍA el defecto es IMPOSIBLE por construcción: el disco cubre las 121 celdas y la capa anclada no tiene base negra", () => {
    // No es «no se ve»: es que `anchoredFogSlideShowsBlack` sale por su primera línea
    // (`visRadius1[idx] === 1 → false`) en TODAS las celdas. Lo dejamos asertado porque de
    // aquí depende que un barrido de material DIURNO no pueda decir nada sobre este defecto.
    const vrDia = computeRadiusMask(0x32);
    expect([...vrDia].every((v) => v === 1)).toBe(true);
    const mitad = new Uint8Array(W * W);
    for (let row = 0; row < W; row++) for (let col = 0; col <= 4; col++) mitad[row * W + col] = 1;
    // Ni siquiera con media sala a oscuras: de día esta capa no pinta un solo negro.
    for (const [nombre, dx, dy] of DIRS)
      for (const t of TS)
        expect(negras(mitad, mitad, vrDia, dx, dy, t), `${nombre} t=${t}`).toEqual([]);
  });

  it("CONTROL NEGATIVO (noche cerrada): sin emisores, todo lo que está fuera del disco sigue NEGRO ∀t ∀dirección — el halo de la party NO deriva con el terreno", () => {
    // visMask ≡ disco: la única luz es la antorcha de la party, anclada a pantalla. Si el
    // arreglo revelara de más (o si la luz del disco punzara deslizada) el halo se ensancharía
    // por el filo de ataque = discDrift. Población asertada: las 121−9 celdas de fuera.
    const fuera: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++) if (disc[row * W + col] === 0) fuera.push(`${col},${row}`);
    expect(fuera.length).toBe(112); // control con dientes: la población NO está vacía
    for (const [nombre, dx, dy] of DIRS) {
      for (const t of TS) {
        expect(negras(disc, disc, disc, dx, dy, t), `${nombre} t=${t}`).toEqual(fuera);
      }
    }
  });

  it("CONTROL NEGATIVO (sala a medias): la zona oscura PROFUNDA sigue negra ∀t ∀dirección — el arreglo no destapa lo que debe estar oculto", () => {
    // Mitad oeste iluminada (cols 0..4), mitad este a oscuras (cols 5..10). Las celdas
    // PROFUNDAS de la zona oscura (col ≥ 6: todo su entorno de 1 tile es oscuro, así que el
    // deslizamiento legítimo del halo no puede alcanzarlas) deben quedar negras en todo el tween.
    const mask = new Uint8Array(W * W);
    for (let row = 0; row < W; row++) for (let col = 0; col <= 4; col++) mask[row * W + col] = 1;
    const profundas: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 6; col < W; col++)
        if (disc[row * W + col] === 0) profundas.push(`${col},${row}`);
    expect(profundas.length).toBe(52); // control con dientes
    for (const [nombre, dx, dy] of DIRS) {
      for (const t of TS) {
        const n = new Set(negras(mask, mask, disc, dx, dy, t));
        const destapadas = profundas.filter((c) => !n.has(c));
        expect(destapadas, `${nombre} t=${t}`).toEqual([]);
      }
    }
  });

  it("CONTROL DE ASENTAMIENTO: en t=1 el veredicto sigue siendo byte-idéntico a ¬anchoredLitMask(visMask1, vr1) aunque V0 viera MÁS que V1", () => {
    // Escena con dientes contra un arreglo demasiado ancho: V0 veía la sala entera y V1 la ha
    // perdido (puerta que se cierra). En el settle manda V1 y sólo V1.
    const vm0 = new Uint8Array(W * W).fill(1);
    const vm1 = new Uint8Array(W * W);
    for (let row = 0; row < W; row++) for (let col = 0; col <= 4; col++) vm1[row * W + col] = 1;
    const anchored = anchoredLitMask(vm1, disc);
    const esperado: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++)
        if (anchored[row * W + col] === 0) esperado.push(`${col},${row}`);
    expect(esperado.length).toBe(60); // control con dientes
    for (const [nombre, dx, dy] of DIRS) {
      expect(negras(vm0, vm1, disc, dx, dy, 1), nombre).toEqual(esperado);
    }
  });
});

/**
 * 🔴 LA PARED EN NEGRO DURANTE UNOS MILISEGUNDOS (vídeo del usuario, 22-08).
 *
 * EL SÍNTOMA, MEDIDO EN EL VÍDEO (60 fps, piel partida, sala de castillo de noche con cuatro
 * antorchas de pared): en el fotograma 97 los DOS tiles de muro que hay bajo las antorchas del
 * sur —simétricos— caen de 0,54 a 0,05 de relleno, y el desplazamiento MEDIDO de la antorcha en
 * ese fotograma es de 0,0 px. Es decir: se apagan con el cross-slide todavía en el origen. Luego
 * se rellenan solos (0,21 → 0,31 → 0,38 → 0,48 → 0,54) conforme el terreno desliza. Pérdida
 * ABRUPTA, recuperación GRADUAL. Sólo en los pasos al SUR; los dos pasos al NORTE del mismo vídeo
 * no pierden un píxel.
 *
 * LA INVARIANTE QUE SE VIOLABA. En `t=0` el cross-slide no ha movido NADA (V0 va a offset 0), así
 * que el primer fotograma del tween tiene que enseñar lo MISMO que el último en reposo: el
 * conjunto de celdas negras de la capa anclada en t=0 debe ser exactamente el de la vía de
 * reposo, `¬anchoredLitMask(visMask0, visRadius)`. No lo era.
 *
 * LA CAUSA. La capa anclada descompone la oscuridad en base `¬visRadius` (pegada a PANTALLA) +
 * agujeros de `emitterGlowMask`, y `emitterGlowMask = visMask ∩ ¬visRadius` EXCLUYE POR
 * CONSTRUCCIÓN lo que cae dentro del disco. El disco está anclado a pantalla y la casilla se
 * mueve un tile en índice de ventana con el paso ⇒ el ANILLO del disco en la dirección de la
 * marcha estaba FUERA antes (`glow0=1`) y queda DENTRO después (`visRadius[índice nuevo]=1` ⇒
 * `glow1=0` ⇒ `carriedGlowMask=0`): ningún agujero lo punzaba. Cerrado con `survivingGlowMask`.
 *
 * ★★ Y POR QUÉ EL SUELO PERSISTENTE NO LO TAPABA, que es la lección repetida de este fichero:
 * `persistentLitMask` es `visMask0 ∩ visMask1` AL MISMO ÍNDICE DE PANTALLA, y con un paso el
 * mismo índice de pantalla contiene CASILLAS DE MUNDO DISTINTAS en los dos campos. Por eso la
 * sala 11×11 ENTERAMENTE iluminada (la escena de la ficha #34) NO instancia este defecto: ahí la
 * intersección es todo. Hace falta una sala CON BORDE — y el borde es justo donde vive el fallo.
 */
describe("🔴 t=0 no puede apagar nada: el primer fotograma del tween == el último en reposo (vídeo 22-08)", () => {
  const W = 11;
  const DIRS: [string, number, number][] = [
    ["Sur", 0, 1],
    ["Norte", 0, -1],
    ["Este", 1, 0],
    ["Oeste", -1, 0],
  ];
  /** Los mismos regímenes de luz del bloque de la ficha #34 (el disco escala y el anillo con él). */
  const REGIMENES: [string, number][] = [
    ["noche/sótano (lightLevel=2)", 2],
    ["ANTORCHA (lightLevel=0x0a) — el régimen del vídeo", 0x0a],
    ["Light spell (lightLevel=18)", 18],
  ];

  /**
   * SALA CON BORDE: iluminada en las filas 1..8 (todas las columnas), a oscuras en 0, 9 y 10.
   * Es la sala del vídeo reducida a lo esencial — lo que importa es que el conjunto iluminado
   * TENGA borde, porque el suelo persistente ya cubre una sala uniformemente iluminada.
   */
  const salaConBorde = (): Uint8Array => {
    const a = new Uint8Array(W * W);
    for (let row = 1; row <= 8; row++) for (let col = 0; col < W; col++) a[row * W + col] = 1;
    return a;
  };
  /** El MISMO mundo visto desde una casilla más allá: los índices de ventana se desplazan un tile. */
  const trasElPaso = (vm0: Uint8Array, dx: number, dy: number): Uint8Array => {
    const a = new Uint8Array(W * W);
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++) {
        const sr = row + dy;
        const sc = col + dx;
        a[row * W + col] = sr >= 0 && sr < W && sc >= 0 && sc < W ? vm0[sr * W + sc]! : 0;
      }
    return a;
  };
  const negrasEnT = (
    vm0: Uint8Array,
    vm1: Uint8Array,
    vr: Uint8Array,
    dx: number,
    dy: number,
    t: number,
  ): string[] => {
    const out: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++)
        if (
          anchoredFogSlideShowsBlack({
            visMask0: vm0,
            visRadius0: vr,
            visMask1: vm1,
            visRadius1: vr,
            window: W,
            dx,
            dy,
            t,
            col,
            row,
          })
        )
          out.push(`${col},${row}`);
    return out;
  };

  /**
   * EL ESPERADO, EN CRUDO Y POR RÉGIMEN. Con la sala iluminada en las filas 1..8, la vía de
   * REPOSO ennegrece las filas 0, 9 y 10 — 33 celdas — MENOS lo que el disco de la party ya
   * ilumina por sí solo. 🔴 La primera versión de este literal era UNO SOLO para los tres
   * regímenes y salió rojo: con `lightLevel=18` el disco alcanza la fila 9 en las columnas 4, 5
   * y 6 (radial 16 y 17, ambos ≤ 18) y esas tres celdas NO son negras. Una cifra sin su régimen
   * se lee como universal — la misma lección que ya dejó escrita el bloque de la ficha #34 unas
   * líneas más arriba. Escritos a mano, no derivados del sujeto.
   */
  const FILA = (row: number): string[] =>
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((c) => `${c},${row}`);
  const REPOSO: Record<number, string[]> = {
    // disco de 9 celdas (3×3 centrado): no toca ninguna de las filas 0, 9, 10.
    2: [...FILA(0), ...FILA(9), ...FILA(10)],
    // disco de 37 celdas: su alcance vertical (radial 16 en la fila 9) sigue sin llegar.
    0x0a: [...FILA(0), ...FILA(9), ...FILA(10)],
    // disco de 61 celdas: alcanza (4,9), (5,9) y (6,9) — 30 negras, no 33.
    18: [
      ...FILA(0),
      "0,9", "1,9", "2,9", "3,9", "7,9", "8,9", "9,9", "10,9",
      ...FILA(10),
    ],
  };

  it("la vía de REPOSO ennegrece exactamente las 33 celdas de las filas 0, 9 y 10 (control del esperado)", () => {
    for (const [nombre, lvl] of REGIMENES) {
      const vr = computeRadiusMask(lvl);
      const anc = anchoredLitMask(salaConBorde(), vr);
      const negras: string[] = [];
      for (let row = 0; row < W; row++)
        for (let col = 0; col < W; col++) if (anc[row * W + col] === 0) negras.push(`${col},${row}`);
      expect(negras, nombre).toEqual(REPOSO[lvl]);
    }
  });

  it("en t=0 la capa anclada del tween pinta EXACTAMENTE lo mismo que el reposo, en las 4 direcciones y los 3 regímenes", () => {
    for (const [reg, lvl] of REGIMENES) {
      const vr = computeRadiusMask(lvl);
      const vm0 = salaConBorde();
      for (const [dir, dx, dy] of DIRS) {
        expect(negrasEnT(vm0, trasElPaso(vm0, dx, dy), vr, dx, dy, 0), `${reg} · ${dir}`).toEqual(
          REPOSO[lvl],
        );
      }
    }
  });

  /**
   * CONTROL CON DIENTES — lo que este test cazó, con las celdas EXACTAS. Sin `survivingGlowMask`
   * el aserto de arriba salía rojo SÓLO en el régimen de ANTORCHA (`lightLevel=0x0a`, el del
   * vídeo del usuario) y SÓLO en los dos pasos verticales, con estas celdas de más:
   *     Sur   → 35 negras (33 + «3,8» y «7,8»)      ← SIMÉTRICAS, en la fila del fondo de la sala
   *     Norte → 36 negras (33 + «4,1», «5,1», «6,1»)
   *     Este / Oeste → 33 (sin cambio en esta escena)
   * Con `lightLevel=2` el disco (9 celdas) es demasiado pequeño para que su anillo alcance el
   * borde de esta sala y el defecto no se instancia — por eso el aserto barre los TRES regímenes
   * y no sólo el de noche cerrada. Las dos celdas del paso al SUR son la reducción exacta de los
   * dos tiles de muro del vídeo. Este `it` deja escrito el conjunto para que, si alguien retira
   * el arreglo, el rojo diga QUÉ se rompe y no sólo que algo se rompió.
   */
  it("las celdas del defecto son las del ANILLO del disco en la dirección de la marcha (documenta el rojo)", () => {
    const vr = computeRadiusMask(0x0a);
    const vm0 = salaConBorde();
    // El anillo = celda FUERA del disco cuyo índice en la ventana NUEVA cae DENTRO.
    const anillo = (dx: number, dy: number): string[] => {
      const out: string[] = [];
      for (let row = 0; row < W; row++)
        for (let col = 0; col < W; col++) {
          if (vr[row * W + col] !== 0) continue;
          const jc = col - dx;
          const jr = row - dy;
          if (jc < 0 || jc >= W || jr < 0 || jr >= W) continue;
          if (vr[jr * W + jc] === 1 && vm0[row * W + col] === 1) out.push(`${col},${row}`);
        }
      return out;
    };
    // Las celdas que el defecto ennegrecía son un SUBCONJUNTO del anillo, y el anillo no es vacío
    // en ninguna dirección: si algún día lo fuera, la escena habría dejado de instanciar el bug.
    for (const [dir, dx, dy] of DIRS) expect(anillo(dx, dy).length, dir).toBeGreaterThan(0);
    expect(anillo(0, 1)).toContain("3,8");
    expect(anillo(0, 1)).toContain("7,8");
    expect(anillo(0, -1)).toContain("4,1");
    expect(anillo(0, -1)).toContain("5,1");
    expect(anillo(0, -1)).toContain("6,1");
  });

  it("el ASENTAMIENTO no se mueve: en t=1 sigue siendo byte-idéntico a ¬anchoredLitMask(visMask1, vr)", () => {
    for (const [reg, lvl] of REGIMENES) {
      const vr = computeRadiusMask(lvl);
      const vm0 = salaConBorde();
      for (const [dir, dx, dy] of DIRS) {
        const vm1 = trasElPaso(vm0, dx, dy);
        const anc = anchoredLitMask(vm1, vr);
        const esperado: string[] = [];
        for (let row = 0; row < W; row++)
          for (let col = 0; col < W; col++)
            if (anc[row * W + col] === 0) esperado.push(`${col},${row}`);
        expect(negrasEnT(vm0, vm1, vr, dx, dy, 1), `${reg} · ${dir}`).toEqual(esperado);
      }
    }
  });

  /**
   * `survivingGlowMask` por sí sola, con el esperado a mano. Escena mínima: halo viejo en TODA la
   * fila 8; tras un paso al SUR la ventana nueva ve esa misma fila en su índice 7. Se conserva
   * donde `visMask1[fila 7]` la da visible, y se descarta donde no — SIN mirar si esa luz es de
   * emisor o del disco, que es la corrección respecto de `outgoingGatedMaskV0`.
   */
  it("survivingGlowMask conserva el halo viejo sólo donde la MISMA casilla sigue visible tras el paso", () => {
    const glow0 = new Uint8Array(W * W);
    for (let col = 0; col < W; col++) glow0[8 * W + col] = 1;
    const vm1 = new Uint8Array(W * W);
    // La ventana nueva ve las columnas 0..5 de esa fila (índice 7) y ha perdido las 6..10.
    for (let col = 0; col <= 5; col++) vm1[7 * W + col] = 1;
    const s = survivingGlowMask(glow0, vm1, 0, 1, W);
    const vivas: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++) if (s[row * W + col] === 1) vivas.push(`${col},${row}`);
    expect(vivas).toEqual(["0,8", "1,8", "2,8", "3,8", "4,8", "5,8"]);
  });

  it("survivingGlowMask: sin contraparte en la ventana nueva manda su PROPIO campo (el nuevo no opina)", () => {
    const glow0 = new Uint8Array(W * W);
    glow0[0 * W + 4] = 1; // fila 0: con un paso al SUR su contraparte (fila −1) cae FUERA
    const vm1 = new Uint8Array(W * W); // campo nuevo VACÍO: si opinara, la apagaría
    expect(survivingGlowMask(glow0, vm1, 0, 1, W)[0 * W + 4]).toBe(1);
    // y con contraparte DENTRO (paso al NORTE → fila 1), el campo nuevo sí manda: se apaga.
    expect(survivingGlowMask(glow0, vm1, 0, -1, W)[0 * W + 4]).toBe(0);
  });
});
