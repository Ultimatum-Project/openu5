/**
 * LATENTES DE LA VENTANA E-2 — SONDA COMMITEADA de los censos del acta
 * `re/notes/latentes-e2-acta.md`.
 *
 * La entrega 2 de `#71b` (`0a3ffd5e`) cerró los dos agujeros de `isBareEcho` y dejó DECLARADOS
 * tres latentes sin arreglar. Este fichero es la sonda que los MIDE, para que las cifras del acta
 * no sean una foto de scratchpad sino algo que se vuelve a correr y se pone rojo si cambia.
 *
 * Los cuatro censos:
 *  · **A** — detecciones de `isGhostReread` que el ESCRITOR nunca escribe (el latente `ad19-g26`).
 *  · **B** — segmentos que `mkoverlay-ad` clasifica INTERIOR y que `derive-dungeon-ops` no procesa
 *    por su `ctx` (el dominio real del escritor; es lo que convierte A en «no materializable»).
 *  · **C** — coste de RELAJAR la condición 1 (`hasGhostSignature` sobre la línea actual), que es
 *    el arreglo que pedía el latente `ln7368/9`.
 *  · **D** — población candidata de los ecos MULTI-PALABRA (el latente de la CABEZA).
 *
 * ⚠ TODO se mide sobre el ARTEFACTO COMMITEADO (`routes-ad/*.route.json`), que es la SALIDA del
 * derivador: las ops que el predicado vigente ya retiró NO están. Por eso los censos C y D miden
 * «cuánto MÁS se retiraría encima del punto fijo», que es exactamente la pregunta del coste, y no
 * «cuántos fantasmas hay». Los OCR-logs de origen (`full-part-logs-ad/`) NO están en el repo.
 *
 * ★ La réplica del bucle de `deriveDungeonOps` que usan C y D está CALIBRADA contra el original
 * (primer test): sin esa calibración un mutante mide MI bucle, no el del derivador.
 *
 * ═══ POR QUÉ ESTE FICHERO **NO** SE PORTA AL CORPUS SINTÉTICO ═══════════════════════════
 * (ventana `corpus-sintetico-espejo`, y es un veredicto, no una omisión.)
 *
 * Los otros ficheros del espejo tenían dentro propiedades de la HERRAMIENTA que se podían
 * instanciar sobre `routes-sint/` y recuperar así para el CI público. Aquí **no las hay**: el
 * sujeto de los seis censos (A, B, C, D, E, F) no es «¿qué hace el predicado?» sino «¿cuánto
 * costaría mover la palanca X **en este corpus**?» — 62 ops más, 51 de ellas en segmentos que
 * el escritor sí escribe, 50 de las 62 `advance`. Esas cifras son la ADJUDICACIÓN de si el
 * latente merece arreglo, y sobre un corpus que escribimos nosotros serían tautológicas: el
 * esperado saldría del mismo sujeto. [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 *
 * ⇒ Los 14 bloques censales van a `describeCorpusReal` (corren en nuestro árbol, se saltan con
 * motivo visible en el público). Los DOS que sobreviven al árbol público son justamente los
 * dos que sus autores ya habían desanclado del artefacto a propósito:
 *   · el predicado sobre el literal ARCHIVADO del caso fichado (censo A), escrito así porque
 *     «un test que sólo mira artefacto muere con el artefacto»;
 *   · el censo del vocabulario multi-palabra, que sale de `DUNGEON_VOCAB` y no del corpus.
 */
import { describe, it, expect, vi } from "vitest";

// Los censos C/F re-derivan los 646 segmentos varias veces: 5-8 s bajo carga. El testTimeout
// de 5 s del config PURE los mataba por DURACIÓN, no por corrección (visto en el aterrizaje
// de curate-cablear, con otra suite corriendo en paralelo — y un runner de CI público es más
// lento que esta máquina). Techo holgado para todo el fichero: es una sonda de medición.
vi.setConfig({ testTimeout: 120_000 });
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  deriveDungeonOps,
  matchDungeonEcho,
  dirFromEcho,
  rosterTailOf,
  hasGhostSignature,
  isBareEcho,
  isGhostReread,
  ROSTER_TAIL_DEFERRED,
  DUNGEON_VOCAB,
} from "../e2e/espejo-tour/tools/derive-dungeon-ops.mjs";
import { describeCorpusReal, ROUTES_AD_DIR } from "./espejo-corpus";

const ROUTES_AD = ROUTES_AD_DIR;

type Op = Record<string, unknown>;
interface Seg {
  id: string;
  ctx?: string;
  note?: string;
  openedBy?: string;
  script?: Op[];
}

function loadAd(): { part: string; seg: Seg }[] {
  const out: { part: string; seg: Seg }[] = [];
  for (const f of readdirSync(ROUTES_AD).filter((n) => n.endsWith(".route.json")).sort()) {
    const route = JSON.parse(readFileSync(join(ROUTES_AD, f), "utf8"));
    for (const seg of route.segments ?? []) out.push({ part: f.replace(".route.json", ""), seg });
  }
  return out;
}

/**
 * El dominio del ESCRITOR **tal y como era cuando se midieron estos censos** (`enrichPart`
 * procesaba sólo estos dos `ctx`).
 *
 * ⚠ HOY YA NO ES EL DOMINIO REAL: la ventana `clasif-discrepan` metió las otras dos RANURAS
 * NEUTRAS del `ctx` (`resume`, `start`) tras adjudicar que la costura que las corta —una
 * acampada, el arranque de un episodio— no declara lugar. La constante viva es `CTX_NEUTRO`
 * en `derive-dungeon-ops.mjs`. Este predicado se conserva **a propósito y con el nombre
 * cambiado**: los censos de abajo son la FOTO de la discrepancia que este acta midió, y
 * re-anclarlos al dominio de hoy borraría justamente lo que documentan.
 * Ver `re/notes/clasif-discrepan-acta.md` y `game/tests/espejo-clasif-discrepan.test.ts`.
 */
const eraProcesadoAntesDeClasifDiscrepan = (seg: Seg) => seg.ctx === "dungeon" || seg.ctx === "post-combat";
const esProcesado = eraProcesadoAntesDeClasifDiscrepan;

const isDeferred = (segId: string, ocrLn: unknown) =>
  ROSTER_TAIL_DEFERRED.some((d) => d.seg === segId && d.ocrLn === ocrLn);

/** Lo que devuelve `matchDungeonEcho`, que es lo que `isGhostReread` espera recibir. */
type MatchLike = NonNullable<ReturnType<typeof matchDungeonEcho>>;

/**
 * Réplica del bucle de `deriveDungeonOps` con UN gancho: `veredicto` decide si la op se retira.
 * Con el gancho por defecto tiene que reproducir al original EXACTAMENTE (test de calibración).
 */
function recorrer(
  seg: Seg,
  veredicto: (ctx: {
    m: MatchLike;
    raw: string;
    ocrLn: number | undefined;
    prev: { dng: string; from: string; ocrLn: number | undefined; echo: string } | null;
  }) => boolean,
): { retiradas: { ocrLn: number | undefined; raw: string; dng: string; prevFrom: string; prevLn: unknown }[] } {
  const retiradas: { ocrLn: number | undefined; raw: string; dng: string; prevFrom: string; prevLn: unknown }[] = [];
  let prev: { dng: string; from: string; ocrLn: number | undefined; echo: string } | null = null;
  for (const op of seg.script ?? []) {
    const raw = (op.dng ? op.from : (op.todo ?? op.todoKeep)) as string | undefined | null;
    if (raw === undefined || raw === null) continue;
    const ocrLn = op.ocrLn as number | undefined;
    const deferred = isDeferred(seg.id, ocrLn) && rosterTailOf(raw) != null;
    const m = matchDungeonEcho(raw, { allowRosterTail: deferred });
    if (!m) continue;
    if ((m.op.dng === "search" || m.op.dng === "look") && !dirFromEcho(raw)) continue;
    if (veredicto({ m, raw, ocrLn, prev })) {
      retiradas.push({ ocrLn, raw, dng: m.op.dng, prevFrom: prev!.from, prevLn: prev!.ocrLn });
      continue;
    }
    prev = { dng: m.op.dng, from: raw, ocrLn, echo: m.echo };
  }
  return { retiradas };
}

/** El veredicto VIGENTE, vía la función real. */
const vigente: Parameters<typeof recorrer>[1] = ({ m, raw, ocrLn, prev }) => isGhostReread(m, raw, ocrLn, prev);

describeCorpusReal("latentes E-2 — CALIBRACIÓN de la réplica (sin esto, los mutantes miden el bucle equivocado)", () => {
  it("la réplica con el veredicto VIGENTE reproduce el contador `ghostReread` del derivador, segmento a segmento", () => {
    const discrepancias: string[] = [];
    let total = 0;
    for (const { seg } of loadAd()) {
      const real = deriveDungeonOps(seg).stats.ghostReread;
      const mio = recorrer(seg, vigente).retiradas.length;
      total += real;
      if (real !== mio) discrepancias.push(`${seg.id}: derivador ${real} vs réplica ${mio}`);
    }
    expect(discrepancias).toEqual([]);
    // ★ 5 → 1 (ventana `banner-ad19`). Lo que CALIBRA este test —que la réplica reproduce al
    // derivador segmento a segmento— no se ha movido ni un caso; lo que se movió es el CORPUS:
    // `ad19-g26` y `ad19-g33` entraron en el dominio del escritor al curarse el banner de
    // `ad19-g17`, y sus 4 detecciones se materializaron en retiradas (ver el censo A).
    expect(total).toBe(1); // el censo A de abajo, por la vía del derivador
  });
});

/**
 * ★★ EL LATENTE 1, **MATERIALIZADO** — y por eso este censo cambia de sujeto.
 *
 * `latentes-e2-acta.md` §1.2 razonó: «si ese segmento entrara en el dominio del escritor, el
 * guarda lo retiraría en la misma pasada». Era una EXTRAPOLACIÓN. `clasif-discrepan` §6/P9 la
 * midió sobre una copia de scratchpad; la ventana `banner-ad19` la ha hecho ocurrir en el
 * ARTEFACTO COMMITEADO al curar el banner de `ad19-g17` (`WRUNG` era `WRONG`, id 36): `ad19-g26`
 * y `ad19-g33` abrieron, el escritor pasó por ellos y retiró **exactamente** `ln7315`, `ln7364`
 * y `ln7443` de `g26` y `ln10532` de `g33` — las cuatro que aquella acta había nombrado, ni una
 * más ni una menos.
 *
 * ⇒ De las 5 detecciones vivas queda **1** (`ad18-g19`, un `smallmap` que ningún ensanche del
 * `ctx` va a alcanzar). El censo se conserva porque su PREGUNTA sigue viva —«¿queda detección que
 * el escritor no pueda materializar?»— y ahora tiene una respuesta más fuerte.
 */
/**
 * El literal del caso fichado, ARCHIVADO aquí: ya no está en el corpus porque se retiró.
 * ★ Vive a NIVEL DE MÓDULO porque lo comparten los dos lados de la frontera: el bloque censal
 * (que comprueba su AUSENCIA en el artefacto real) y el bloque del predicado (que comprueba
 * que `isGhostReread` lo sigue reconociendo, y que corre también en el árbol público).
 */
const CASO_FICHADO = { ocrLn: 7364, prevLn: 7363, prevFrom: "Back up", raw: 'Buck up ~TnZH"FT6hE""""', dng: "back" };

describeCorpusReal("latente 1 (`ad19-g26`) — CENSO A: detecciones que el escritor NUNCA escribe", () => {
  it("ya sólo queda 1 detección viva, y es la que NINGÚN ensanche del `ctx` alcanza", () => {
    const dentro: string[] = [];
    const fuera: string[] = [];
    for (const { seg } of loadAd()) {
      const n = deriveDungeonOps(seg).stats.ghostReread;
      for (let i = 0; i < n; i++) (esProcesado(seg) ? dentro : fuera).push(`${seg.id}[${seg.ctx}]`);
    }
    // 0 dentro = el artefacto está en el PUNTO FIJO del guarda: lo que el escritor podía retirar,
    // ya lo retiró. No es «no hay fantasmas»: es «no quedan de los que este guarda ve».
    expect(dentro).toEqual([]);
    // las 4 de `ad19-g26`/`ad19-g33` ya NO están: se materializaron en retiradas
    expect(fuera).toEqual(["ad18-g19[smallmap]"]);
  });

  it("★★ el caso FICHADO (ln7364) está RETIRADO del artefacto — la extrapolación de E-2, cumplida", () => {
    const g26 = loadAd().find(({ seg }) => seg.id === "ad19-g26")!.seg;
    // ya no queda NINGUNA op en esa línea: el escritor la retiró al entrar en su dominio
    expect((g26.script ?? []).find((o) => o.ocrLn === CASO_FICHADO.ocrLn)).toBeUndefined();
    // y las tres de `g26` que el acta nombró se fueron JUNTAS, ni una de más
    for (const ln of [7315, 7364, 7443]) expect((g26.script ?? []).some((o) => o.ocrLn === ln), `ln${ln}`).toBe(false);
    const g33 = loadAd().find(({ seg }) => seg.id === "ad19-g33")!.seg;
    expect((g33.script ?? []).some((o) => o.ocrLn === 10532)).toBe(false);
    // el segmento SÍ está abierto y derivado (es lo que hizo que el escritor pasara por aquí)
    expect(g26.openedBy).toBe("3d-neutro");
  });
});

/**
 * ★ EL ÚNICO BLOQUE DEL CENSO A QUE SOBREVIVE AL ÁRBOL PÚBLICO, y no por casualidad: su autor
 * ya lo había desanclado del artefacto («un test que sólo mira artefacto muere con el
 * artefacto»). Al retirarse la op del corpus, el corpus dejó de ser testigo del caso; el
 * literal archivado es hoy la ÚNICA prueba de que `isGhostReread` lo reconoce, y por eso puede
 * —y debe— correr donde el corpus no está.
 */
describe("latente 1 — el PREDICADO, atado al literal ARCHIVADO (sin corpus)", () => {
  it("y el PREDICADO sigue detectándolo sobre el literal archivado (el corpus ya no lo tiene)", () => {
    // ★ El corpus dejó de ser testigo de este caso al retirarlo, así que la sensibilidad del
    // predicado se ata sobre el literal ARCHIVADO arriba. Sin esto, la ventana que materializó el
    // latente se llevaría por delante la única prueba de que `isGhostReread` lo reconoce
    // ([[rancio-exige-polaridad]]: un test que sólo mira artefacto muere con el artefacto).
    const m = matchDungeonEcho(CASO_FICHADO.raw, { allowRosterTail: false })!;
    expect(m, "el eco archivado ya no casa: el vocabulario se movió").toBeTruthy();
    expect(m.op.dng).toBe(CASO_FICHADO.dng);
    const prev = { dng: "back", from: CASO_FICHADO.prevFrom, ocrLn: CASO_FICHADO.prevLn, echo: m.echo };
    expect(isGhostReread(m, CASO_FICHADO.raw, CASO_FICHADO.ocrLn, prev)).toBe(true);
  });
});

describeCorpusReal("latente 1 — CENSO B: el clasificador de INTERIOR y el dominio del escritor DISCREPAN", () => {
  it("7 segmentos que `mkoverlay-ad` marca interior quedan fuera del `ctx` que `derive-dungeon-ops` procesa", () => {
    const interior = loadAd().filter(({ seg }) => /interior-dng|entrada-dng/.test(seg.note ?? ""));
    const fuera = interior.filter(({ seg }) => !esProcesado(seg));
    expect(interior.length).toBe(87);
    expect(fuera.map(({ seg }) => `${seg.id}[${seg.ctx}]:${(seg.script ?? []).length}`)).toEqual([
      "ad10-g01[start]:35",
      "ad19-g24[resume]:3",
      "ad19-g25[resume]:3",
      "ad19-g26[resume]:176",
      "ad19-g32[resume]:4",
      "ad19-g33[resume]:88",
      "ad20-g01[start]:415",
    ]);
    // el volumen que el anclaje NO ve por esta discrepancia
    // 728 cuando E-2 lo midió; 724 hoy: las 4 ops que faltan son las retiradas del guarda #54
    // en `ad19-g26`/`g33` que esta misma acta predijo (ventana `banner-ad19`). Los 7 SEGMENTOS,
    // que es la población del censo, no se han movido.
    expect(fuera.reduce((a, { seg }) => a + (seg.script ?? []).length, 0)).toBe(724);
  });
});

describeCorpusReal("latente 2 (`ln7368/9`) — CENSO C: lo que cuesta relajar `hasGhostSignature`", () => {
  /** El veredicto SIN la condición 1 (la línea actual ya no necesita firma de comillas). */
  const relajado: Parameters<typeof recorrer>[1] = ({ m, raw, ocrLn, prev }) => {
    if (!prev || prev.dng !== m.op.dng) return false;
    if (hasGhostSignature(prev.from)) return false;
    const d = (ocrLn ?? 0) - (prev.ocrLn ?? 0);
    if (!(d >= 0 && d <= 2)) return false;
    return isBareEcho(raw, m.op.dng === "back" ? "Back up" : raw.split(/\s+/)[0]);
  };

  it("retira 62 ops MÁS, 51 de ellas en segmentos que el escritor SÍ escribe", () => {
    let extra = 0;
    let extraProc = 0;
    const porComando = new Map<string, number>();
    for (const { seg } of loadAd()) {
      const yaRetiradas = new Set(recorrer(seg, vigente).retiradas.map((r) => r.ocrLn));
      for (const r of recorrer(seg, relajado).retiradas) {
        if (yaRetiradas.has(r.ocrLn)) continue;
        extra++;
        if (esProcesado(seg)) extraProc++;
        porComando.set(r.dng, (porComando.get(r.dng) ?? 0) + 1);
      }
    }
    expect(extra).toBe(62);
    expect(extraProc).toBe(51);
    // ★ 50 de 62 son `advance`: el comando cuya REPETICIÓN LEGÍTIMA es la más frecuente del
    // pasillo. Retirar por aquí borra pasos REALES, que es la dirección peligrosa.
    expect([...porComando].sort((a, b) => b[1] - a[1])).toEqual([
      ["advance", 50],
      ["back", 7],
      ["pass", 3],
      ["turnLeft", 1],
      ["klimb", 1],
    ]);
  });

  it("el caso FICHADO (`ln7368/9`) es 1 de esos 62 — y vive en segmento que el escritor no procesa", () => {
    const g26 = loadAd().find(({ seg }) => seg.id === "ad19-g26")!.seg;
    const caso = recorrer(g26, relajado).retiradas.find((r) => r.ocrLn === 7369)!;
    expect(caso).toBeDefined();
    expect(caso.prevLn).toBe(7368);
    expect(caso.prevFrom).toBe("Baok up"); // sin una sola comilla: por eso la condición 1 no la ve
    expect(caso.raw).toBe("Buok up");
    expect(hasGhostSignature(caso.prevFrom)).toBe(false);
    expect(hasGhostSignature(caso.raw)).toBe(false);
    expect(esProcesado(g26)).toBe(false); // arreglarlo NO movería el artefacto
  });
});

/**
 * Las CINCO condiciones de `isGhostReread`, desglosadas. Existe porque el intel de la ventana de
 * `ad18` llamó «tres instancias del mismo latente» a tres casos que fallan condiciones DISTINTAS:
 * saber CUÁL falla cada uno es lo que decide qué palanca habría que mover, y si sirve de algo.
 */
function condiciones(part: string, segId: string, ln: number) {
  const seg = loadAd().find(({ seg: s }) => s.id === segId)!.seg;
  let prev: { dng: string; from: string; ocrLn: number | undefined; echo: string } | null = null;
  for (const op of seg.script ?? []) {
    const raw = (op.dng ? op.from : (op.todo ?? op.todoKeep)) as string | undefined | null;
    if (raw === undefined || raw === null) continue;
    const ocrLn = op.ocrLn as number | undefined;
    const deferred = isDeferred(seg.id, ocrLn) && rosterTailOf(raw) != null;
    const m = matchDungeonEcho(raw, { allowRosterTail: deferred });
    if (!m) continue;
    if ((m.op.dng === "search" || m.op.dng === "look") && !dirFromEcho(raw)) continue;
    if (ocrLn === ln) {
      const d = (ocrLn ?? 0) - (prev?.ocrLn ?? 0);
      const fallan: string[] = [];
      if (!hasGhostSignature(raw)) fallan.push("C1");
      if (!(prev && prev.dng === m.op.dng)) fallan.push("C2");
      if (prev && hasGhostSignature(prev.from)) fallan.push("C3");
      if (!(d >= 0 && d <= 2)) fallan.push("C4");
      if (!isBareEcho(raw, m.op.dng === "back" ? "Back up" : raw.split(/\s+/)[0])) fallan.push("C5");
      return { fallan, hueco: d, prevLn: prev?.ocrLn, ctx: seg.ctx, part };
    }
    if (isGhostReread(m, raw, ocrLn, prev)) continue;
    prev = { dng: m.op.dng, from: raw, ocrLn, echo: m.echo };
  }
  throw new Error(`${segId} ln${ln} no llega al discriminador`);
}

describeCorpusReal("latente 2 — CENSO E: las TRES instancias fallan condiciones DISTINTAS", () => {
  it("`ln7368/9` falla SÓLO la condición 1 — es la instancia pura del latente", () => {
    const r = condiciones("ad19", "ad19-g26", 7369);
    expect(r.fallan).toEqual(["C1"]);
    expect(r.hueco).toBe(1);
  });

  it("★ `ad18-g14` ln5983 falla C1 y **C2**, y su hueco medido contra la prev EMITIDA es 2 (DENTRO de la ventana)", () => {
    const r = condiciones("ad18", "ad18-g14", 5983);
    expect(r.fallan).toEqual(["C1", "C2"]);
    // El acta de ad18 lo da como «hueco 3, fuera de la ventana 0..2»: eso es el delta de líneas de
    // OCR contra el OTRO klimb (5983−5980). El discriminador NO mide contra ese: mide contra la
    // última op `dng` EMITIDA, que aquí es un `back` («Buok up», ln5981) que se cuela EN MEDIO.
    // Por eso el hueco efectivo es 2 y quien falla es C2, no C4. Ensanchar la ventana no lo caza.
    expect(r.prevLn).toBe(5981);
    expect(r.hueco).toBe(2);
  });

  it("★ `ad18-g14` ln6209 falla C1, C4 y **C5** — su cola es ROSTER, territorio del ruling #55", () => {
    const r = condiciones("ad18", "ad18-g14", 6209);
    expect(r.fallan).toEqual(["C1", "C4", "C5"]);
    expect(r.hueco).toBe(5);
  });
});

describeCorpusReal("latente 2 — CENSO F: el PEAJE DE PARTICIÓN de las dos palancas (lo que el acta de ad18 exige)", () => {
  /** L1 = sin la condición 1. L1+L4 = sin la 1 y con la ventana a 0..5 (para cubrir el hueco 5). */
  const palanca = (ventana: number): Parameters<typeof recorrer>[1] =>
    ({ m, raw, ocrLn, prev }) => {
      if (!prev || prev.dng !== m.op.dng) return false;
      if (hasGhostSignature(prev.from)) return false;
      const d = (ocrLn ?? 0) - (prev.ocrLn ?? 0);
      if (!(d >= 0 && d <= ventana)) return false;
      return isBareEcho(raw, m.op.dng === "back" ? "Back up" : raw.split(/\s+/)[0]);
    };

  const peaje = (ventana: number) => {
    let segs = 0;
    let segsProc = 0;
    let ops = 0;
    let opsProc = 0;
    const porComando = new Map<string, number>();
    for (const { seg } of loadAd()) {
      const ya = new Set(recorrer(seg, vigente).retiradas.map((r) => r.ocrLn));
      const extra = recorrer(seg, palanca(ventana)).retiradas.filter((r) => !ya.has(r.ocrLn));
      if (!extra.length) continue;
      segs++;
      if (esProcesado(seg)) segsProc++;
      ops += extra.length;
      if (esProcesado(seg)) opsProc += extra.length;
      for (const r of extra) porComando.set(r.dng, (porComando.get(r.dng) ?? 0) + 1);
    }
    return { segs, segsProc, ops, opsProc, porComando: [...porComando].sort((a, b) => b[1] - a[1]) };
  };

  it("L1 (relajar C1) mueve el script derivado de 27 de los 646 segmentos", () => {
    const p = peaje(2);
    expect([p.segs, p.segsProc, p.ops, p.opsProc]).toEqual([27, 23, 62, 51]);
  });

  it("L1+L4 (relajar C1 y ensanchar la ventana a 5) mueve 35 de 646 y retira 101 ops", () => {
    const p = peaje(5);
    expect([p.segs, p.segsProc, p.ops, p.opsProc]).toEqual([35, 30, 101, 78]);
    // 80 de 101 siguen siendo `advance`: ensanchar la ventana no mejora la mezcla, la empeora.
    expect(p.porComando).toEqual([
      ["advance", 80],
      ["back", 8],
      ["pass", 7],
      ["klimb", 5],
      ["turnLeft", 1],
    ]);
  });

  it("★★ y NINGUNA de las dos palancas caza NINGUNA de las dos instancias de `ad18-g14`", () => {
    const g14 = loadAd().find(({ seg }) => seg.id === "ad18-g14")!.seg;
    for (const ventana of [2, 5]) {
      const retiradas = new Set(recorrer(g14, palanca(ventana)).retiradas.map((r) => r.ocrLn));
      expect(retiradas.has(5983)).toBe(false); // la para C2
      expect(retiradas.has(6209)).toBe(false); // la para C5
    }
  });
});

/**
 * ★ La otra mitad del censo D que sobrevive al árbol público: sale de `DUNGEON_VOCAB`, que es
 * una constante de PRODUCCIÓN, no del artefacto. Es la que dice CUÁNTOS ecos podrían sufrir el
 * latente de la cabeza; el «cuántos lo sufren HOY» (que es 0) es lo que necesita el corpus.
 */
describe("latente 3 (la CABEZA multi-palabra) — CENSO D: el VOCABULARIO (sin corpus)", () => {
  it("los ecos de 2 palabras son 5 de 12, y sólo `back` tiene caso especial en `isGhostReread`", () => {
    expect(DUNGEON_VOCAB.filter((v) => v.words > 1).map((v) => v.op.dng)).toEqual([
      "back",
      "turnLeft",
      "turnRight",
      "turnAround",
      "ignite",
    ]);
  });
});

describeCorpusReal("latente 3 (la CABEZA multi-palabra) — CENSO D: población VACÍA en el corpus", () => {
  /*
   * ★ 1 → 0 (ventana `banner-ad19`), y el rótulo del `describe` —«población VACÍA en el corpus»—
   * pasa de ser una hipérbole a ser literal. El único candidato multi-palabra que quedaba era
   * `ad19-g26:ln7364:back`, y esa op ya NO está en el artefacto: el escritor la retiró al abrirse
   * el segmento con la curación del banner. O sea el latente 3 no se ha arreglado — se ha quedado
   * SIN POBLACIÓN, que para decidir si merece la pena arreglarlo es la misma respuesta y más
   * fuerte. El literal sigue vigilado en el censo A («el PREDICADO sigue detectándolo sobre el
   * literal archivado»), así que el conocimiento no se va con la op.
   */
  it("la población candidata multi-palabra es 0 en TODO el corpus: el único caso quedó RETIRADO", () => {
    const multi = new Set(DUNGEON_VOCAB.filter((v) => v.words > 1).map((v) => v.op.dng));
    const pob: string[] = [];
    for (const { seg } of loadAd()) {
      // condiciones 1-4 de isGhostReread SIN la 5: la 5 es la única que depende de la cabeza
      recorrer(seg, ({ m, raw, ocrLn, prev }) => {
        if (
          prev &&
          prev.dng === m.op.dng &&
          multi.has(m.op.dng) &&
          hasGhostSignature(raw) &&
          !hasGhostSignature(prev.from)
        ) {
          const d = (ocrLn ?? 0) - (prev.ocrLn ?? 0);
          if (d >= 0 && d <= 2) pob.push(`${seg.id}:ln${ocrLn}:${m.op.dng}`);
        }
        return isGhostReread(m, raw, ocrLn, prev);
      });
    }
    expect(pob).toEqual([]);
  });

  it("y arreglar la cabeza (pasar el ECO CASADO entero) retira CERO ops de más: es INERTE aquí", () => {
    const cabezaEntera: Parameters<typeof recorrer>[1] = ({ m, raw, ocrLn, prev }) => {
      if (!prev || prev.dng !== m.op.dng) return false;
      if (!hasGhostSignature(raw) || hasGhostSignature(prev.from)) return false;
      const d = (ocrLn ?? 0) - (prev.ocrLn ?? 0);
      if (!(d >= 0 && d <= 2)) return false;
      return isBareEcho(raw, m.echo);
    };
    let extra = 0;
    for (const { seg } of loadAd()) {
      const ya = new Set(recorrer(seg, vigente).retiradas.map((r) => r.ocrLn));
      for (const r of recorrer(seg, cabezaEntera).retiradas) if (!ya.has(r.ocrLn)) extra++;
    }
    expect(extra).toBe(0);
  });
});
