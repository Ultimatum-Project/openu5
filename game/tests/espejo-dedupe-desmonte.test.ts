/**
 * F4 — EL DEDUPE DIFUSO SE COMÍA DESMONTES REALES (guarda del fix; acta
 * `re/notes/espejo-ad-cabos-ad.md` §2/§2.b, carril segmentador-dedupe).
 *
 * ## El defecto que fija
 *
 * `dedupeEvents` existe para REDIBUJOS del panel (el OCR re-lee líneas que siguen
 * pintadas) con una ventana de 6 TEXTOS que los eventos `move` no purgan — a propósito:
 * un redibujo llega con moves intercalados (ad_ep16:3278→3281 tiene DOS moves entre
 * medias y ES redibujo). Pero esa ventana no distinguía la RE-ORDEN REAL: el LP
 * desmonta, re-embarca (`>Board`/`>Get`) y vuelve a desmontar, y el segundo `>X-it`
 * idéntico moría como redibujo — así se comió el «>X-it skiff!» de ad_ep03:2212,
 * LEGIBLE en el crudo (la party REMA EN TIERRA el resto de la parte: ~83-126 ops de
 * conducción muerta). Y en el par de redibujo, ganaba la PRIMERA lectura aunque fuera
 * la mangled: «>X-lt shlp!» (ad_ep19:2324) envenenaba la op — `curate.mjs:98` sólo
 * emite `x` ante la cabeza canónica `X-it␣`.
 *
 * ## Qué asertos lleva
 *
 * A. SINTÉTICOS con esperado EN CRUDO: sólo ecos de COMANDO del motor (cero prosa TLK
 *    de EA — la guarda de `test_rutas_espejo_sin_prosa_tlk_ea` manda también aquí).
 * B. REALES contra los ocrlogs AD EN DISCO (`original/` es symlink obligatorio de la
 *    receta de worktree): los esperados son el CENSO adjudicado uno a uno del acta
 *    §2.b — 5 caídas reales que deben sobrevivir con testigo legible, y los 2
 *    redibujos legítimos (ad10@2277, ad16@3281) que deben SEGUIR dedupeados
 *    (control positivo de que el dedupe conserva su función).
 */
import { describe, it, expect } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvents, dedupeEvents } from "../e2e/espejo-tour/tools/segment.mjs";

type Ev = { ln: number; t: string; s?: string; echo?: boolean };

const dd = (lines: string[]) => dedupeEvents(buildEvents(lines, 1)) as Ev[];
/** proyección compacta: sólo los TEXTOS (ln + lectura), que es donde vive el dedupe */
const texts = (lines: string[]) => dd(lines).filter((e) => e.t === "text").map((e) => ({ ln: e.ln, s: e.s }));

describe("dedupe de desmontes — sintéticos (esperado en crudo)", () => {
  it("★ re-orden REAL: un >Board entre dos >X-it idénticos conserva los DOS (clase ad03@2212)", () => {
    expect(texts([">X-it skiff!", ">North", ">Board skiff", ">Row North", ">X-it skiff!"])).toEqual([
      { ln: 1, s: "X-it skiff!" },
      { ln: 3, s: "Board skiff" },
      { ln: 5, s: "X-it skiff!" },
    ]);
  });

  it("★ >Get también re-arma (la alfombra se recoge con Get — clase ad19@3166/ad23@246)", () => {
    expect(texts([">X-it carpet!", ">South", ">Get-East", ">X-it carpet!"])).toEqual([
      { ln: 1, s: "X-it carpet!" },
      { ln: 3, s: "Get-East" },
      { ln: 4, s: "X-it carpet!" },
    ]);
  });

  it("★ CONTROL: sin >Board/>Get entre medias el X-it repetido SIGUE dedupeado aunque haya moves (clase ad16@3281)", () => {
    expect(texts([">X-it carpet!", ">South", ">Fly South", ">X-it carpet!"])).toEqual([
      { ln: 1, s: "X-it carpet!" },
    ]);
  });

  it("★ upgrade del testigo: el redibujo CANÓNICO sube su lectura al evento conservado mangled (clase ad19@2325)", () => {
    // El redibujo sigue cayendo (UN solo evento, en la ln original) — sólo cambia QUÉ lectura sobrevive.
    expect(texts([">X-lt carpet!", ">West", ">X-it carpet!"])).toEqual([{ ln: 1, s: "X-it carpet!" }]);
  });

  it("y no hay DOWNGRADE: el redibujo mangled no pisa la lectura canónica conservada", () => {
    expect(texts([">X-it carpet!", ">West", ">X-lt carpet!"])).toEqual([{ ln: 1, s: "X-it carpet!" }]);
  });

  it("alcance ACOTADO a la clase medida: un eco repetido que no es X-it se dedupea igual con Board entre medias", () => {
    expect(texts([">Ignite torch!", ">Board skiff", ">Ignite torch!"])).toEqual([
      { ln: 1, s: "Ignite torch!" },
      { ln: 2, s: "Board skiff" },
    ]);
  });

  it("un texto NO-eco que empieza por «get» no re-arma (sólo ecos `>` de comando)", () => {
    expect(texts([">X-it skiff!", "getting there", ">X-it skiff!"])).toEqual([
      { ln: 1, s: "X-it skiff!" },
      { ln: 2, s: "getting there" },
    ]);
  });

  it("CONTROL: el dedupe general de redibujos sigue vivo (texto repetido no-X-it cae)", () => {
    expect(texts(["Blocked!", ">North", "Blocked!"])).toEqual([{ ln: 1, s: "Blocked!" }]);
  });
});

// El censo REAL lee los ocrlogs de `original/av-referencia/` — material A/V de EA que es
// gitignored aquí y NO viaja al público. Los 9 tests SINTÉTICOS de arriba sí viajan.
describeSiViaja(
  ["original/av-referencia/yt/clips/full-part-logs-ad"],
  "dedupe de desmontes — censo REAL del acta §2.b (ocrlogs AD en disco)",
  () => {
  const DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "original",
    "av-referencia",
    "yt",
    "clips",
    "full-part-logs-ad",
  );
  // original/ es uno de los CUATRO symlinks OBLIGATORIOS de la receta de worktree
  // (CLAUDE.md REGLA 2): si falta, este test debe ponerse ROJO nombrándolo, no saltarse.
  it("los ocrlogs fuente existen (receta de symlinks completa)", () => {
    expect(existsSync(DIR), `falta ${DIR} — symlink original/ de la receta REGLA 2`).toBe(true);
  });

  const logTexts = (ep: string): Ev[] => {
    const p = join(DIR, `${ep}.ocrlog.txt`);
    if (!existsSync(p)) return [];
    return dd(readFileSync(p, "utf8").split("\n")).filter((e) => e.t === "text");
  };
  const at = (evs: Ev[], ln: number) => evs.find((e) => e.ln === ln);

  it("★★ ad03: el «>X-it skiff!» de 2212 SOBREVIVE junto al de 2202 (Board@2207 media)", () => {
    const t = logTexts("ad_ep03");
    expect(at(t, 2202)?.s).toBe("X-it skiff!");
    expect(at(t, 2212)?.s).toBe("X-it skiff!"); // antes del fix: DROPPED — remaba en tierra
  });

  it("★ ad05: el X-it de 514 sobrevive (Board@506 media) junto al de 497", () => {
    const t = logTexts("ad_ep05");
    expect(at(t, 497)?.s).toBe("X-it skiff!");
    expect(at(t, 514)?.s).toBe("X-it skiff!");
  });

  it("★ ad19@2325: el par mangled/canónico conserva UN evento con la lectura CANÓNICA (op-portadora)", () => {
    const t = logTexts("ad_ep19");
    expect(at(t, 2324)?.s).toBe("X-it ship!"); // antes: «X-lt shlp!» — curate no paría op
    expect(at(t, 2325)).toBeUndefined(); // el redibujo sigue cayendo: sin op duplicada
  });

  it("★ ad19@3166: ídem con la alfombra (par 3164/3166)", () => {
    const t = logTexts("ad_ep19");
    expect(at(t, 3164)?.s).toBe("X-it carpet!");
    expect(at(t, 3166)).toBeUndefined();
  });

  it("★ ad23@246: ídem (redibujos 243/244/249 alrededor; sólo 244 queda op-portador)", () => {
    const t = logTexts("ad_ep23");
    expect(at(t, 244)?.s).toBe("X-it carpet!");
    expect(at(t, 246)).toBeUndefined();
    // los mangled vecinos con fuzz PROPIO quedan como todos sin op (curate no los reconoce)
    expect(at(t, 243)?.s).toBe("X-lt curpet!");
    expect(at(t, 249)?.s).toBe("X-lt ourpet!");
  });

  it("★★ CONTROL POSITIVO: los 2 redibujos legítimos del censo SIGUEN dedupeados", () => {
    // ad10@2277: Fly intercalado = eco desordenado, sin Board/Get entre medias
    const t10 = logTexts("ad_ep10");
    expect(at(t10, 2271)?.s).toBe("X-it carpet!");
    expect(at(t10, 2277)).toBeUndefined();
    // ad16@3281: dos moves entre medias y es redibujo — purgar-por-move lo resucitaría
    const t16 = logTexts("ad_ep16");
    expect(at(t16, 3278)?.s).toBe("X-it carpet!");
    expect(at(t16, 3281)).toBeUndefined();
  });

  it("las 2 inocuas del censo no cambian de estado (sin Board/Get media: siguen dedupeadas)", () => {
    expect(at(logTexts("ad_ep01"), 467)).toBeUndefined(); // «X-it what?»
    expect(at(logTexts("ad_ep13"), 3100)).toBeUndefined(); // «No land nearby!» repetido en combate
  });
  },
);
