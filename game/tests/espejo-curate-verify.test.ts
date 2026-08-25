/**
 * LA DEUDA `--verify` DEL CURATE DEL ESPEJO — reconciliación overlay↔ruta.
 *
 * ## Qué deuda es ésta
 *
 * `apply-ledger-overlay.mjs` documentaba un modo `--verify` que NUNCA EXISTIÓ (auditoría final,
 * 01-08). Al retirarse la promesa quedó la deuda REAL, que no es de documentación: **el `skip`
 * vive en DOS capas** —el overlay y la ruta— y **el runner sólo lee la ruta**. Regenerar una
 * ruta desde su overlay puede, por tanto, DES-SKIPEAR segmentos en silencio, y eso mueve el
 * denominador de la conformidad sin que nadie lo mida.
 *
 * ## ★★ Lo que la medición cambió del enunciado
 *
 * El caso se conocía como «el skip de `ad01-g06`». Medido sobre los 49 overlays y las 49 rutas
 * commiteadas (49 rutas · 1052 segmentos): **son 63, no 1**, y `ad01-g06` es sólo el primero por
 * orden alfabético. Los 63 son una CLASE homogénea: `ctx: "post-combat"`, sin `openedBy`, sin
 * `enter`, todos con `skip: "pendiente-runner"` en la ruta y `skip: false` en el overlay.
 *
 * Y el mecanismo tampoco es «la clave ausente se pierde»: es el **TOMBSTONE**. `applyPatchKeys`
 * conserva lo que el overlay no menciona (#43 ruling 2), así que las 2637 claves que sólo viven
 * en la ruta están a salvo. Lo que borra es el `skip: false` que `mkoverlay-ad.mjs` emite en su
 * rama `else` para todo segmento que su clasificador no ve como interior — y un `post-combat`
 * no lo es. Es el mismo agujero que #23/#43 ya taparon para las costuras `enter.underworld`
 * (8 segmentos de clase B), en la clase de al lado.
 *
 * ⇒ La doctrina «curate NUNCA borra; regenerar = INERTE» **ya no describe el pipeline**: desde
 * que #43 le dio el tombstone, curate SÍ borra, y sobre el corpus de hoy borraría 63 skips.
 *
 * ## Failing-first
 *
 * Los bloques de CLI de abajo se comprobaron ROJOS contra el `apply-ledger-overlay.mjs`
 * anterior, que rechaza `--verify` como flag desconocida (exit 1, «flag no reconocida»).
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  camposPerdidos,
  camposEnRiesgo,
  opsDeOverlayHuerfanas,
  clasificarPerdidas,
  type Ruta,
  type Overlay,
  type CampoPerdido,
} from "../e2e/espejo-tour/tools/overlay-merge.mjs";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
const CLI = join(TOUR, "tools", "apply-ledger-overlay.mjs");

const leerRuta = (dir: string, part: string) =>
  JSON.parse(readFileSync(join(TOUR, dir, `${part}.route.json`), "utf8")) as Ruta;
const leerOverlay = (dir: string, part: string) =>
  JSON.parse(readFileSync(join(TOUR, dir, "overlays", `${part}.json`), "utf8")) as Overlay;

const PARTES = [
  ...Array.from({ length: 24 }, (_, i) => ["routes", `part${String(i + 1).padStart(2, "0")}`] as const),
  ...Array.from({ length: 25 }, (_, i) => ["routes-ad", `ad${String(i + 1).padStart(2, "0")}`] as const),
];

/**
 * `execFile` ASÍNCRONO, nunca `spawnSync`: un `spawnSync` dentro de un test bloquea el worker de
 * vitest y su RPC expira — la suite sale «todo verde» con exit 1 («Timeout calling onTaskUpdate»),
 * que es justo el modo de fallo que un gate no ve.
 */
function correr(args: string[]): Promise<{ code: number; salida: string }> {
  return new Promise((ok) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
        ok({ code, salida: `${stdout ?? ""}${stderr ?? ""}` });
      },
    );
  });
}

/** Corpus de juguete en disco: una ruta y su overlay, con la forma mínima que el CLI exige. */
function fixture(ruta: Ruta, overlay: Overlay): string {
  const dir = mkdtempSync(join(tmpdir(), "espejo-verify-"));
  mkdirSync(join(dir, "overlays"));
  writeFileSync(join(dir, "px.route.json"), JSON.stringify(ruta, null, 2) + "\n");
  writeFileSync(join(dir, "overlays", "px.json"), JSON.stringify(overlay, null, 2) + "\n");
  return dir;
}

/** La forma canónica del defecto: la ruta lleva el skip, el overlay lo tombstonea. */
const RUTA_CON_SKIP: Ruta = {
  segments: [
    { id: "px-g01", ctx: "post-combat", skip: "pendiente-runner", script: [{ key: "a", ocrLn: 10 }], expect: [] },
    { id: "px-g02", ctx: "overworld", script: [{ key: "b", ocrLn: 20 }], expect: [] },
  ],
};
const OVERLAY_TOMBSTONE: Overlay = {
  segments: {
    "px-g01": { skip: false, note: "el clasificador dice que no es interior" },
    "px-g02": { insertOps: [{ afterOcrLn: 20, ops: [{ key: "z" }] }] },
  },
};

/**
 * Censo sobre el corpus REAL, no un fixture: si alguien adjudica los 63 (regenerando el overlay
 * o quitando el skip de la ruta), este número tiene que MOVERSE y obligar a re-medir, no quedarse
 * verde sobre una foto vieja. La cifra y su SHA están en `re/notes/curate-verify-acta.md`.
 *
 * 🔴 PEREZOSO A PROPÓSITO, y esto no es estilo. Esto vivía como `const` en el CUERPO del
 * `describe`, y el cuerpo de un `describe` se EJECUTA al recolectar — también el de un
 * `describe.skip`, que es en lo que `describeCorpusReal` se convierte en el árbol público. Con el
 * censo ahí arriba, el fichero entero moría de ENOENT en el árbol sin corpus **antes** de que
 * nadie decidiera saltar nada, y se llevaba por delante los bloques que no tocan el corpus real.
 * La memoización mantiene la propiedad que el `const` compraba: se lee UNA vez para los cinco.
 */
let _censo: (CampoPerdido & { dir: string; part: string })[] | null = null;
function censoReal(): (CampoPerdido & { dir: string; part: string })[] {
  if (_censo) return _censo;
  _censo = PARTES.flatMap(([dir, part]) => {
    const overlay = existsSync(join(TOUR, dir, "overlays", `${part}.json`)) ? leerOverlay(dir, part) : {};
    return camposEnRiesgo(leerRuta(dir, part), overlay).map((p) => ({ ...p, dir, part }));
  });
  return _censo;
}

describeCorpusReal("★★ el corpus REAL: la deuda son 63 skips, no el de ad01-g06", () => {
  it("★★ 63 campos que una regeneración BORRARÍA, todos `skip`, todos en AD", () => {
    const censo = censoReal();
    expect(
      censo.length,
      "si esto se mueve: la deuda cambió de tamaño — re-mide y actualiza re/notes/curate-verify-acta.md",
    ).toBe(63);
    expect(new Set(censo.map((p) => p.clave))).toEqual(new Set(["skip"]));
    expect(new Set(censo.map((p) => p.dir))).toEqual(new Set(["routes-ad"]));
    expect(new Set(censo.map((p) => p.motivo))).toEqual(new Set(["BORRADO"]));
  });

  it("`ad01-g06` —el caso que daba nombre a la deuda— es UNO de los 63", () => {
    const censo = censoReal();
    expect(censo.map((p) => p.segId)).toContain("ad01-g06");
    expect(censo.filter((p) => p.part === "ad01")).toHaveLength(1);
  });

  it("★ los 63 son una CLASE: post-combat, sin openedBy, sin enter", () => {
    for (const { dir, part, segId } of censoReal()) {
      const seg = leerRuta(dir, part).segments.find((s) => s.id === segId)!;
      expect(seg.ctx, segId).toBe("post-combat");
      expect(seg.openedBy, segId).toBeUndefined();
      expect(seg.enter, segId).toBeUndefined();
      expect(seg.skip, segId).toBe("pendiente-runner");
    }
  });

  /**
   * ★★ CONTROL CON DIENTES. Sin él, un `camposEnRiesgo` que devolviera «todo lo que la ruta
   * tiene» pasaría los tres bloques de arriba. Las 2637 claves que sólo viven en la ruta
   * (seam 1051 · ctx 1042 · enter 544) NO son pérdidas: `applyPatchKeys` las conserva.
   *
   * ★ 2621 → 2624 por la ventana `clasif-discrepan`: los 3 `resume` mid-visita que el derivador
   * abre (`ad15-g10`, `ad24-g19`, `ad25-g22`) reciben costura SINTÉTICA `enter.carryover`, que
   * por construcción sólo vive en la RUTA — el overlay no la menciona ni tiene por qué. Es la
   * misma forma que las 528 `enter` anteriores, +3. Ver `re/notes/clasif-discrepan-acta.md`.
   *
   * ★ 2624 → 2637 por la ventana `banner-ad19`, y el delta CUADRA EXACTO en dos sumandos de signo
   * contrario, que es lo que lo hace auditable:
   *   · **+14** costuras sintéticas `enter.carryover` nuevas — los 14 segmentos de la visita a
   *     Wrong que abren detrás de la costura curada (12 `post-combat` + 2 `resume`);
   *   · **−1** porque `ad19-g17` DEJA de contar aquí: su `enter` pasa a estar declarado también
   *     en el overlay (es la curación), o sea deja de vivir sólo en la ruta. Que este control lo
   *     note es justamente la propiedad que se quiere — la curación vive en las DOS capas y por
   *     eso una regeneración futura la reproduce.
   */
  it("★★ las 2637 claves que sólo viven en la RUTA no se reportan (ausencia = «no opino»)", () => {
    let soloEnRuta = 0;
    for (const [dir, part] of PARTES) {
      const ruta = leerRuta(dir, part);
      const overlay = existsSync(join(TOUR, dir, "overlays", `${part}.json`)) ? leerOverlay(dir, part) : {};
      for (const seg of ruta.segments) {
        const patch = overlay.segments?.[seg.id];
        for (const k of ["ctx", "enter", "seam", "calib", "note", "policy", "resync", "skip"]) {
          if (k in seg && (!patch || !(k in patch))) soloEnRuta++;
        }
      }
    }
    expect(soloEnRuta, "población del control: si fuera 0 el control no probaría nada").toBe(2637);
    expect(censoReal().length).toBeLessThan(soloEnRuta); // y no las reporta: 63 ≪ 2637
  });

  /**
   * El OTRO canal de pérdida: ops estampadas `src:"overlay*"` en la ruta que el overlay ya no
   * re-emite. `curate` retira toda la familia y la repone desde el overlay, así que una op sin
   * ancla en el overlay se va. Hoy está LIMPIO — pero con población: 147 ops, 0 huérfanas.
   *
   * ★ RE-CALIBRADO CON MOTIVO (carril `teclas-ad09`): 117 → 147. Las 30 son el bloque de
   * `ad09-g04` (seedGold + seedInt + ancla + 14 teclas + 13 waits + Escape), y las 0 huérfanas
   * se conservan porque la curación vive en las DOS capas (overlay y ruta), que es la propiedad
   * que este canal vigila.
   */
  it("★ canal de OPS: 304 ops de overlay en las rutas, 0 huérfanas", () => {
    let ops = 0;
    let huerfanas = 0;
    for (const [dir, part] of PARTES) {
      const ruta = leerRuta(dir, part);
      const overlay = existsSync(join(TOUR, dir, "overlays", `${part}.json`)) ? leerOverlay(dir, part) : {};
      const h = opsDeOverlayHuerfanas(ruta, overlay);
      huerfanas += h.length;
      for (const seg of ruta.segments)
        ops += (seg.script ?? []).filter((o) => String(o.src ?? "").startsWith("overlay")).length;
    }
    // ★ RE-CALIBRADO CON MOTIVO (carril `poblar-deltas`): 147 → 304 (+157). Son los tres
    // bloques de VENTA: `ad03-g11` 18 ops, `ad04-g08` 37 y `ad06-g34` 102 (seeds + ancla +
    // teclas del picker «Arms» + waits). Cada uno abre con una tecla de SACRIFICIO que el
    // `getkey` de pacing del herrero descarta (SHOPPES 0x12c3) — sin ella el flujo SELL ni
    // se abre; ver `re/notes/poblar-deltas-acta.md` §3.
    // ★ RE-CALIBRADO CON MOTIVO (carril `costura-interna`): 304 → 305 (+1). Es UNA sola op,
    // la costura interna `{enterLoc: 26}` de `ad09-g04` (afterOcrLn 164, el beat del
    // «Enter keep B0RDERMARCH» del LP): mete a la party DENTRO del torreón a mitad de segmento
    // para que el ancla del herrero deje de abstenerse. Ver `re/notes/costura-interna-acta.md`.
    // ★ RE-CALIBRADO CON MOTIVO (carril `routes-ad-minoc`): 305 → 310 (+5). Son las CINCO
    // ops del arnés contenido de la venta de Minoc en `ad06-g34`: tres siembras pre-ancla
    // (`seedEquip` 16:4, 18:1, 19:3 — las filas del picker que las flechas committeadas
    // cuentan, medidas del checkpoint calibrado `1fc1a101`) y DOS retiradas de atrezo
    // post-Escape (16:0, 18:0) para que el checkpoint exportado quede byte-idéntico al
    // instalado (la 1ª regeneración sin retirada probó que el atrezo suelto no es inerte).
    // Ver `re/notes/espejo-ad-instalacion.md` §9. Huérfanas siguen en 0: la curación vive
    // en las DOS capas (overlay y ruta), que es la propiedad que este canal vigila.
    expect(ops, "población: sin ops de overlay este check sería cero VACÍO").toBe(310);
    expect(huerfanas).toBe(0);
  });

});

/**
 * ★ EL CONTROL CON DIENTES DEL CANAL DE OPS — y por qué vive FUERA del bloque al que sirve.
 *
 * El «0 huérfanas» de ahí arriba es un CERO MEDIDO, no un cero por incapacidad: sobre un corpus
 * con la huérfana puesta a mano el mismo detector la ve. Sin este control, un
 * `opsDeOverlayHuerfanas` que devolviera siempre `[]` daría exactamente el mismo verde.
 *
 * 🔴 Y no lee NADA: sus tres corpus son literales de tres líneas. Estaba dentro del describe del
 * corpus real por vecindad temática, y eso lo hacía saltarse en el árbol público —donde el
 * detector existe igual y puede romperse igual— por un motivo que no le aplicaba. Un control con
 * dientes que no corre no tiene dientes.
 */
describe("opsDeOverlayHuerfanas — el detector, sobre corpus de juguete", () => {
  it("★★ control con dientes: el detector de huérfanas SÍ ve una op sin ancla", () => {
    const ruta: Ruta = {
      segments: [{ id: "g1", script: [{ key: "z", src: "overlay", ocrLn: 99 }] }],
    };
    expect(opsDeOverlayHuerfanas(ruta, { segments: { g1: { insertOps: [{ afterOcrLn: 99, ops: [] }] } } })).toEqual([]);
    const huerfanas = opsDeOverlayHuerfanas(ruta, { segments: { g1: { insertOps: [{ afterOcrLn: 12, ops: [] }] } } });
    expect(huerfanas).toHaveLength(1);
    expect(huerfanas[0]).toMatchObject({ segId: "g1", ocrLn: 99 });
    // y la familia entera cuenta, no sólo `src === "overlay"` exacto (part05-g05 llevaba
    // `overlay-timing`, una etiqueta sin productor que ninguna herramienta emite)
    expect(
      opsDeOverlayHuerfanas({ segments: [{ id: "g1", script: [{ src: "overlay-timing", ocrLn: 7 }] }] }, {}),
    ).toHaveLength(1);
  });
});

describe("camposPerdidos — el diff que arma el cinturón de escritura", () => {
  it("una clave que desaparece se reporta BORRADO", () => {
    const antes: Ruta = { segments: [{ id: "g1", skip: "pendiente-runner" }] };
    const despues: Ruta = { segments: [{ id: "g1" }] };
    expect(camposPerdidos(antes, despues)).toEqual([
      { segId: "g1", clave: "skip", enRuta: "pendiente-runner", motivo: "BORRADO" },
    ]);
  });

  it("una clave cuyo VALOR cambia se reporta PISADO (no sólo la baja)", () => {
    const antes: Ruta = { segments: [{ id: "g1", policy: "manual" }] };
    const despues: Ruta = { segments: [{ id: "g1", policy: "auto" }] };
    expect(camposPerdidos(antes, despues)).toEqual([
      { segId: "g1", clave: "policy", enRuta: "manual", enOverlay: "auto", motivo: "PISADO" },
    ]);
  });

  it("★ control: dos rutas iguales no reportan nada (si reportara siempre, los de arriba no probarían)", () => {
    expect(camposPerdidos(RUTA_CON_SKIP, structuredClone(RUTA_CON_SKIP))).toEqual([]);
  });

  it("★ `seam: null` es un VALOR: perderlo se reporta, y conservarlo no", () => {
    expect(camposPerdidos({ segments: [{ id: "g1", seam: null }] }, { segments: [{ id: "g1" }] })).toHaveLength(1);
    expect(camposPerdidos({ segments: [{ id: "g1", seam: null }] }, { segments: [{ id: "g1", seam: null }] })).toEqual(
      [],
    );
  });

  it("no mira claves fuera de PATCHABLE (el guion se compara en otro sitio)", () => {
    expect(camposPerdidos({ segments: [{ id: "g1", script: [{ key: "a" }] }] }, { segments: [{ id: "g1" }] })).toEqual(
      [],
    );
  });
});

describe("camposEnRiesgo — usa la MISMA applyPatchKeys que curate, sobre una copia", () => {
  it("tombstone en el overlay → BORRADO", () => {
    const r = camposEnRiesgo(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    expect(r).toEqual([{ segId: "px-g01", clave: "skip", enRuta: "pendiente-runner", motivo: "BORRADO" }]);
  });

  it("★ control con dientes: sin tombstone no hay pérdida", () => {
    const sinTombstone: Overlay = { segments: { "px-g01": { note: "sólo cambio la nota" } } };
    expect(camposEnRiesgo(RUTA_CON_SKIP, sinTombstone)).toEqual([]);
  });

  it("★ control: un overlay VACÍO tampoco pierde nada (ausencia ≠ baja)", () => {
    expect(camposEnRiesgo(RUTA_CON_SKIP, {})).toEqual([]);
  });

  it("★ NO muta la ruta que inspecciona (es una reconciliación de sólo lectura)", () => {
    const ruta = structuredClone(RUTA_CON_SKIP);
    camposEnRiesgo(ruta, OVERLAY_TOMBSTONE);
    expect(ruta.segments[0]!.skip).toBe("pendiente-runner");
  });

  it("★ un patch RANCIO no se aplica, así que tampoco es una pérdida (curate lo salta)", () => {
    const r = camposEnRiesgo(RUTA_CON_SKIP, OVERLAY_TOMBSTONE, { rancios: new Set(["px-g01"]) });
    expect(r).toEqual([]);
  });
});

describe("★★ el modo --verify del CLI (la deuda: ANTES era una flag rechazada)", () => {
  it("★★ --verify sale con exit≠0 y NOMBRA el campo que la regeneración perdería", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const antes = readFileSync(join(dir, "px.route.json"), "utf8");
    const { code, salida } = await correr(["--verify", "--routes", dir, "px"]);
    expect(code).not.toBe(0);
    expect(salida).toContain("px-g01");
    expect(salida).toContain("skip");
    expect(salida).toContain("pendiente-runner");
    // y es de SÓLO LECTURA: un modo de verificación que escribe es el defecto que lo motivó
    expect(readFileSync(join(dir, "px.route.json"), "utf8")).toBe(antes);
  });

  it("★★ control con dientes: sobre un corpus SIN tombstone, --verify sale 0", async () => {
    const dir = fixture(RUTA_CON_SKIP, { segments: { "px-g01": { note: "no opino del skip" } } });
    const { code, salida } = await correr(["--verify", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
  });

  /**
   * ★★ LA POLARIDAD LIMPIA, SOBRE UN CORPUS DE VERDAD (no un fixture de dos segmentos).
   *
   * Es la mitad instanciable del bloque que careaba AD contra LP1: «un corpus entero sin
   * tombstones sale 0 y lo DICE». La otra mitad —que el corpus real de AD acusa por
   * `ad01-g06`— es un hecho del corpus real y se queda abajo, en `describeCorpusReal`.
   *
   * Sobre el sintético no se puede fingir el resultado: `routes-sint/` es punto fijo de las
   * tres herramientas (su README §«Régimen»), así que si `camposEnRiesgo` empieza a inventar
   * pérdidas —o si alguien edita el corpus y lo saca del punto fijo— esto se pone rojo.
   */
  it("★★ --verify sobre las 6 partes SINTÉTICAS: reconciliación LIMPIA (exit 0)", async () => {
    const { code, salida } = await correr(["--verify", "--routes", ROUTES_SINT_DIR, ...PARTES_SINT]);
    expect(code, salida).toBe(0);
    expect(salida).toContain("reconciliación LIMPIA");
    // guarda de POBLACIÓN: sin ella, un `--verify` que no mirara ni un segmento saldría 0 igual.
    // La herramienta imprime «(sobre N segmentos)» por parte; se exigen las 6 líneas y que la
    // suma de segmentos examinados sea real.
    const porParte = [...salida.matchAll(/sobre (\d+) segmentos/g)].map((m) => Number(m[1]));
    expect(porParte, "líneas de reconciliación (una por parte sintética)").toHaveLength(
      PARTES_SINT.length,
    );
    const segmentos = porParte.reduce((a, b) => a + b, 0);
    expect(segmentos, "segmentos examinados: si fuera 0 el exit 0 no probaría nada").toBeGreaterThan(0);
  });
});

describeCorpusReal("★★ --verify contra el corpus REAL: AD acusa, LP1 no", () => {
  it("--verify sobre el corpus REAL de AD acusa (exit≠0) y sobre LP1 no", async () => {
    const ad = await correr(["--verify", "--routes", "routes-ad", "ad01"]);
    expect(ad.code).not.toBe(0);
    expect(ad.salida).toContain("ad01-g06");
    const lp1 = await correr(["--verify", "--routes", "routes", "part01"]);
    expect(lp1.code, lp1.salida).toBe(0);
  });
});

describe("★★ el modo de ESCRITURA no puede borrar un skip de la ruta", () => {
  it("★★ aplica el overlay Y conserva el skip que sólo vive en la ruta", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const { code, salida } = await correr(["--routes", dir, "px", "px-g02"]);
    expect(code, salida).toBe(0);
    const out = JSON.parse(readFileSync(join(dir, "px.route.json"), "utf8")) as Ruta;
    expect(out.segments[0]!.skip, "el tombstone del overlay NO llega por esta puerta").toBe("pendiente-runner");
    expect(out.segments[1]!.script!.some((o) => o.key === "z")).toBe(true); // sí hizo su trabajo
  });

  it("★ y AVISA de la divergencia pendiente aunque escriba (no la deja muda)", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const { salida } = await correr(["--routes", dir, "px", "px-g02"]);
    expect(salida).toContain("px-g01");
  });
});

/**
 * ★★ `--claves` — LA CAPACIDAD DE CURAR, con el cinturón HABLANDO en vez de callando.
 *
 * Nace en la ventana `banner-ad19`, y nace aquí y no en `curate.mjs` por una razón medida: una
 * CURACIÓN de dato (`ad19-g17.enter.loc = 36`) metida por `curate` arrastra 2 de los 63 des-skips
 * de arriba al mismo delta del corpus. El aplicador quirúrgico es el único que puede tocar UN
 * campo de UN segmento y dejar el resto quieto.
 *
 * El contrato está PRE-REGISTRADO (`re/notes/banner-ad19-preregistro.md` §2) y es asimétrico a
 * propósito — nombrar un segmento autoriza a FIJARLE claves, nunca a QUITÁRSELAS:
 *
 *  · `BORRADO` → aborta SIEMPRE (exit 3). El tombstone `false` es una BAJA y este script no
 *    adjudica bajas: son justo los 63 pendientes. Default-DENY.
 *  · `PISADO` en segmento NOMBRADO → se aplica y se ENUMERA (`antes → después`).
 *  · sin la flag → conducta histórica intacta: las claves NI SE MIRAN.
 */
describe("★★ `--claves`: curar un campo sin arrastrar la deriva de curate", () => {
  /** La ruta con un `enter` sin resolver y un overlay que lo CURA — la forma de `ad19-g17`. */
  const RUTA_SIN_LOC: Ruta = {
    segments: [
      { id: "px-g01", ctx: "dungeon", seam: "dungeon-enter", enter: { loc: null, banner: "WRUNG", dungeon: true }, script: [], expect: [] },
      { id: "px-g02", ctx: "post-combat", skip: "pendiente-runner", script: [], expect: [] },
    ],
  };
  const OVERLAY_CURA: Overlay = {
    segments: {
      "px-g01": { enter: { loc: 36, banner: "WRUNG", dungeon: true } },
      // el MISMO overlay tombstonea al de al lado: si el aplicador tocara segmentos no nombrados,
      // este `skip` se iría — y es exactamente el defecto que la flag no puede reintroducir
      "px-g02": { skip: false },
    },
  };

  it("★★ aplica la clave al segmento NOMBRADO y la ENUMERA (la curación no se esconde en el diff)", async () => {
    const dir = fixture(RUTA_SIN_LOC, OVERLAY_CURA);
    const { code, salida } = await correr(["--routes", dir, "--claves", "px", "px-g01"]);
    expect(code, salida).toBe(0);
    const out = JSON.parse(readFileSync(join(dir, "px.route.json"), "utf8")) as Ruta;
    expect((out.segments[0]!.enter as { loc?: number }).loc).toBe(36);
    expect(salida).toContain("CURACIÓN");
    expect(salida).toContain("px-g01");
    // el vecino NO nombrado conserva su skip aunque su overlay lo tombstonee
    expect(out.segments[1]!.skip, "tocó un segmento que no se le nombró").toBe("pendiente-runner");
  });

  it("★★ SIN la flag, las claves ni se miran: la conducta histórica queda intacta", async () => {
    const dir = fixture(RUTA_SIN_LOC, OVERLAY_CURA);
    const { code, salida } = await correr(["--routes", dir, "px", "px-g01"]);
    expect(code, salida).toBe(0);
    const out = JSON.parse(readFileSync(join(dir, "px.route.json"), "utf8")) as Ruta;
    expect((out.segments[0]!.enter as { loc?: number | null }).loc, "aplicó claves sin que se le pidiera").toBeNull();
    expect(salida).not.toContain("CURACIÓN");
  });

  it("★★ un BORRADO aborta con exit 3 AUNQUE el segmento esté nombrado (nombrar ≠ autorizar bajas)", async () => {
    const dir = fixture(RUTA_SIN_LOC, OVERLAY_CURA);
    const { code, salida } = await correr(["--routes", dir, "--claves", "px", "px-g01", "px-g02"]);
    expect(code, salida).toBe(3);
    expect(salida).toContain("ABORTADO SIN ESCRIBIR");
    expect(salida).toContain("px-g02");
    // ★ y NO ha escrito: la ruta en disco sigue con el `loc` sin curar, o sea el aborto es ANTES
    // del writeFileSync y no a medias
    const out = JSON.parse(readFileSync(join(dir, "px.route.json"), "utf8")) as Ruta;
    expect((out.segments[0]!.enter as { loc?: number | null }).loc, "escribió a pesar de abortar").toBeNull();
    expect(out.segments[1]!.skip).toBe("pendiente-runner");
  });

  /**
   * ★★ EL SEGUNDO CERROJO, probado DESENROSCADO — la lección que costó un mutante superviviente.
   *
   * La regla del cinturón empezó siendo un arrow inline dentro del CLI, y el mutante «acepta
   * `PISADO` de segmentos NO nombrados» **sobrevivía a la batería entera**. No faltaba un aserto:
   * la rama era INALCANZABLE desde el CLI, porque el bucle ya filtra por la lista blanca. Un
   * cinturón que ningún mutante puede matar no está probado — está escrito. Por eso la regla vive
   * ahora en `clasificarPerdidas` (`overlay-merge.mjs`) y se prueba aquí DIRECTAMENTE, sin tener
   * que romper antes el primer cerrojo. [[cinturon-dentro-de-la-rama-es-codigo-muerto]] en su
   * versión de test: la protección de segundo nivel necesita su propio banco.
   */
  const PISADO = { segId: "px-g01", clave: "policy", enRuta: "manual", enOverlay: "auto", motivo: "PISADO" } as const;
  const BORRADO = { segId: "px-g01", clave: "skip", enRuta: "pendiente-runner", motivo: "BORRADO" } as const;

  it("★★ `clasificarPerdidas`: un PISADO del segmento NOMBRADO se DECLARA", () => {
    const r = clasificarPerdidas([PISADO], { segIds: ["px-g01"], claves: true });
    expect(r.declarados).toEqual([PISADO]);
    expect(r.fatales).toEqual([]);
  });

  it("★★ …pero el MISMO PISADO de un segmento NO nombrado es FATAL (el segundo cerrojo)", () => {
    const r = clasificarPerdidas([PISADO], { segIds: ["px-g99"], claves: true });
    expect(r.fatales, "el cinturón aceptaría pérdidas de segmentos que nadie nombró").toEqual([PISADO]);
    expect(r.declarados).toEqual([]);
  });

  it("★★ un BORRADO es FATAL aunque el segmento esté nombrado: nombrar no autoriza bajas", () => {
    const r = clasificarPerdidas([BORRADO], { segIds: ["px-g01"], claves: true });
    expect(r.fatales).toEqual([BORRADO]);
    expect(r.declarados).toEqual([]);
  });

  it("★ y sin `claves` NADA se declara: la flag es el opt-in, no un matiz", () => {
    expect(clasificarPerdidas([PISADO], { segIds: ["px-g01"] }).fatales).toEqual([PISADO]);
    // control: sin pérdidas no hay ni fatales ni declarados (si devolviera algo, los de arriba
    // pasarían por casualidad)
    expect(clasificarPerdidas([], { segIds: ["px-g01"], claves: true })).toEqual({ fatales: [], declarados: [] });
  });

  it("★ control: sin nada que curar, `--claves` no inventa una CURACIÓN", async () => {
    // población del control: si el enumerado se emitiera siempre, los dos tests de arriba pasarían
    // igual y no probarían que discrimina
    const dir = fixture(RUTA_SIN_LOC, { segments: { "px-g01": { note: undefined } } } as Overlay);
    const { code, salida } = await correr(["--routes", dir, "--claves", "px", "px-g01"]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("CURACIÓN");
  });
});
