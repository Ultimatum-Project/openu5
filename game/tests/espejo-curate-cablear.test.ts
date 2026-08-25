/**
 * EL CINTURÓN DENTRO DE `curate.mjs` — «curate no puede des-skipear por efecto lateral».
 *
 * ## La deuda que cierra
 *
 * El carril `curate-verify` dejó atado el cinturón de `apply-ledger-overlay.mjs` y fichó lo que
 * NO había hecho (su acta §5.3): **`curate.mjs` seguía pudiendo borrar los 63 skips post-combat
 * de AD** si alguien lo corría en modo escritura sin `--check`. Esto lo cierra.
 *
 * ## Rojo-primero MEDIDO (no argumentado)
 *
 * Sobre una COPIA de `routes-ad` en scratchpad, con el `curate.mjs` anterior:
 *
 *   174 `skip: "pendiente-runner"` → 111   ·   −63 en 19 rutas   ·   Σ 2142 B = 63 × 34 B
 *   y **exit 0**: el borrado salía sin nombrar ni uno.
 *
 * El reparto por parte y el delta de bytes reproducen EXACTAMENTE la tabla de
 * `re/notes/curate-verify-acta.md` §1.1, medida por otra vía (aquí se ejecuta la pasada; allí se
 * predecía con `camposEnRiesgo`). Detalle en `re/notes/curate-cablear-acta.md`.
 *
 * ## Lo que estos tests fijan
 *
 * · el cinturón ABORTA la escritura (exit 3) y deja la ruta INTACTA en disco;
 * · `--check` sigue INFORMANDO sin romper (ruling #94: con divergencias preexistentes, un gate en
 *   rojo sólo enseña a pasar la flag que lo apaga) — pero ya no calla las pérdidas;
 * · `--allow-desskip` escribe A SABIENDAS y ENUMERA lo que se pierde, para que el commit lo diga;
 * · una flag desconocida ya no se traga en silencio con la pasada de escritura hecha.
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  camposPerdidos,
  clavesVigiladas,
  PATCHABLE,
  type Ruta,
  type Overlay,
} from "../e2e/espejo-tour/tools/overlay-merge.mjs";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
const CLI = join(TOUR, "tools", "curate.mjs");

/**
 * `execFile` ASÍNCRONO, nunca `spawnSync`: un `spawnSync` dentro de un test bloquea el worker de
 * vitest y su RPC expira — la suite sale «todo verde» con exit 1, que es justo el modo de fallo
 * que un gate no ve.
 */
function correr(args: string[]): Promise<{ code: number; salida: string }> {
  return new Promise((ok) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { encoding: "utf8", timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
        ok({ code, salida: `${stdout ?? ""}${stderr ?? ""}` });
      },
    );
  });
}

/** Corpus de juguete EN DISCO: curate escribe, así que el fixture no puede ser en memoria. */
function fixture(ruta: Ruta, overlay: Overlay): string {
  const dir = mkdtempSync(join(tmpdir(), "curate-cablear-"));
  mkdirSync(join(dir, "overlays"));
  writeFileSync(join(dir, "px.route.json"), JSON.stringify(ruta, null, 2) + "\n");
  writeFileSync(join(dir, "overlays", "px.json"), JSON.stringify(overlay, null, 2) + "\n");
  return dir;
}
const leer = (dir: string) => readFileSync(join(dir, "px.route.json"), "utf8");

/** La forma canónica del defecto: la ruta lleva el skip, el overlay lo TOMBSTONEA (`skip:false`). */
const RUTA_CON_SKIP: Ruta = {
  segments: [
    {
      id: "px-g01",
      ctx: "post-combat",
      skip: "pendiente-runner",
      skipReason: "el runner aún no reproduce este post-combat",
      script: [{ key: "a", ocrLn: 10 }],
      expect: [],
    },
    { id: "px-g02", ctx: "overworld", script: [{ key: "b", ocrLn: 20 }], expect: [] },
  ],
};
const OVERLAY_TOMBSTONE: Overlay = { segments: { "px-g01": { skip: false } } };
/** Mismo overlay SIN el tombstone: el control que le da dientes a todo lo de arriba. */
const OVERLAY_INOCUO: Overlay = { segments: { "px-g01": { note: "no opino del skip" } } };

const partesDe = (dir: string) =>
  readdirSync(join(TOUR, dir))
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""));

/** Lee una ruta y su overlay de un directorio de corpus (el overlay puede no existir). */
function cargar(dirAbs: string, part: string): { route: Ruta; overlay: Overlay } {
  const route = JSON.parse(readFileSync(join(dirAbs, `${part}.route.json`), "utf8")) as Ruta;
  let overlay: Overlay = {};
  try {
    overlay = JSON.parse(readFileSync(join(dirAbs, "overlays", `${part}.json`), "utf8")) as Overlay;
  } catch {
    /* una ruta puede no tener overlay */
  }
  return { route, overlay };
}

/**
 * La pasada de curate SIMULADA con SU MISMA regla de polaridad (ausente = «no opino»,
 * `false` = tombstone, cualquier otro valor = asignar). Vive suelta porque la usan dos bloques
 * —el censo del corpus real y el del sintético— y una copia por bloque es una copia que diverge.
 */
function pasadaSimulada(route: Ruta, overlay: Overlay): Ruta {
  return {
    segments: route.segments.map((s) => {
      const copia: Record<string, unknown> = { ...s };
      const p = (overlay.segments?.[s.id] ?? {}) as Record<string, unknown>;
      for (const k of PATCHABLE) {
        if (p[k] === undefined) continue;
        if (p[k] === false) delete copia[k];
        else copia[k] = p[k];
      }
      return copia as Ruta["segments"][number];
    }),
  };
}

describe("clavesVigiladas — el cinturón NO se limita a PATCHABLE", () => {
  it("★★ vigila claves que PATCHABLE no conoce, y excluye lo que curate reconstruye", () => {
    const vig = clavesVigiladas({
      segments: [{ id: "g1", skip: "x", skipReason: "y", openedBy: "z", script: [], expect: [] }],
    });
    expect(vig).toContain("skipReason");
    expect(vig).toContain("openedBy");
    expect(PATCHABLE).not.toContain("skipReason"); // población del control: si estuviera, no probaría nada
    expect(PATCHABLE).not.toContain("openedBy");
    // `script`/`expect` los RECONSTRUYE el productor (todos→ops, expectClass) e `id` es la clave
    // de emparejamiento: vigilarlos daría rojo en cada pasada.
    expect(vig).not.toContain("script");
    expect(vig).not.toContain("expect");
    expect(vig).not.toContain("id");
  });

  it("★★ el ensanche tiene DIENTES: ve una pérdida que un cinturón PATCHABLE-only NO ve", () => {
    const antes: Ruta = { segments: [{ id: "g1", skipReason: "motivo curado a mano" }] };
    const despues: Ruta = { segments: [{ id: "g1" }] };
    expect(camposPerdidos(antes, despues, PATCHABLE), "el cinturón estrecho es CIEGO a esta").toEqual([]);
    expect(camposPerdidos(antes, despues, clavesVigiladas(antes))).toEqual([
      { segId: "g1", clave: "skipReason", enRuta: "motivo curado a mano", motivo: "BORRADO" },
    ]);
  });

  /**
   * ★ Por qué derivar del corpus es COMPLETO y no una heurística: una clave que no está en
   * `antes` no puede perderse. El único riesgo de derivar sería dejar fuera una clave PRESENTE,
   * y por construcción no puede pasar.
   */
  it("★ completa por construcción: una clave ausente en `antes` no puede perderse", () => {
    const antes: Ruta = { segments: [{ id: "g1", ctx: "a" }] };
    const despues: Ruta = { segments: [{ id: "g1", ctx: "a", resync: "nueva" }] };
    expect(clavesVigiladas(antes)).not.toContain("resync");
    expect(camposPerdidos(antes, despues, clavesVigiladas(antes))).toEqual([]);
  });

  /**
   * ★★ COSTE DEL ENSANCHE, la mitad que NO es un cardinal del corpus real.
   *
   * Un gate que cría falsos positivos acaba corriéndose con la flag que lo apaga, así que la
   * pregunta que este bloque contesta es cuánto RUIDO añade vigilar más claves: cero. Eso es una
   * propiedad de `clavesVigiladas`, y se instancia en cualquier corpus limpio — aquí, el
   * sintético. El cardinal 63 (el otro aserto del bloque original) es un hecho del corpus real y
   * vive abajo, en `describeCorpusReal`.
   *
   * 🔴 Las DOS guardas de población son lo que separa esto de un verde vacío: `0 === 0` sería
   * cierto también si el bucle no mirara ni un segmento, o si el cinturón ancho no fuera de
   * verdad más ancho que `PATCHABLE` en este corpus (y entonces «no añade falsos positivos» no
   * diría nada, porque no habría nada extra sobre lo que equivocarse).
   */
  it("★ sobre el corpus SINTÉTICO el ensanche cuesta 0 falsos positivos", () => {
    let ancho = 0;
    let estrecho = 0;
    let segmentos = 0;
    const extras = new Set<string>();
    for (const part of PARTES_SINT) {
      const { route, overlay } = cargar(ROUTES_SINT_DIR, part);
      const despues = pasadaSimulada(route, overlay);
      segmentos += route.segments.length;
      for (const k of clavesVigiladas(route)) if (!PATCHABLE.includes(k)) extras.add(k);
      ancho += camposPerdidos(route, despues, clavesVigiladas(route)).length;
      estrecho += camposPerdidos(route, despues, PATCHABLE).length;
    }
    expect(segmentos, "segmentos examinados: si fuera 0 el `0 === 0` no probaría nada").toBeGreaterThan(0);
    expect(
      extras.size,
      `claves que el cinturón ancho vigila y PATCHABLE no: si fueran 0, «no añade falsos ` +
        `positivos» sería vacuo (vistas: ${[...extras].join(", ") || "ninguna"})`,
    ).toBeGreaterThan(0);
    expect(ancho, "el ensanche NO debe añadir falsos positivos").toBe(estrecho);
    expect(estrecho, "el corpus sintético es el LIMPIO: no tiene tombstones").toBe(0);
  });
});

/**
 * ★★ COSTE MEDIDO del ensanche sobre el corpus REAL — la mitad CENSAL.
 *
 * El 63 es la cifra calibrada del acta (`re/notes/curate-verify-acta.md` §1.1), medida aquí por
 * una vía y en `espejo-curate-verify` por otra. Sobre un corpus que escribimos nosotros no
 * significaría nada, así que no se mueve: se acota.
 */
describeCorpusReal("★★ clavesVigiladas sobre las 49 rutas REALES: ancho == estrecho == 63", () => {
  it("★★ sobre las 49 rutas, ancho == estrecho == 63: el ensanche cuesta 0 falsos positivos", () => {
    let ancho = 0;
    let estrecho = 0;
    for (const dir of ["routes", "routes-ad"]) {
      for (const part of partesDe(dir)) {
        const { route, overlay } = cargar(join(TOUR, dir), part);
        const despues = pasadaSimulada(route, overlay);
        ancho += camposPerdidos(route, despues, clavesVigiladas(route)).length;
        estrecho += camposPerdidos(route, despues, PATCHABLE).length;
      }
    }
    expect(estrecho, "si se mueve: la deuda cambió de tamaño — re-mide el acta").toBe(63);
    expect(ancho, "el ensanche NO debe añadir falsos positivos").toBe(estrecho);
  });
});

describe("★★ curate en ESCRITURA no puede borrar un campo de la ruta", () => {
  it("★★ tombstone → ABORTA (exit 3), NOMBRA la pérdida y deja la ruta INTACTA en disco", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const antes = leer(dir);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(3);
    expect(salida).toContain("px-g01");
    expect(salida).toContain("skip");
    expect(salida).toContain("pendiente-runner");
    // ★ lo que de verdad importa: el disco. Un abort que ya ha escrito no es un cinturón.
    expect(leer(dir), "ABORTADO tiene que significar SIN ESCRIBIR").toBe(antes);
  });

  /**
   * ★★ CONTROL CON DIENTES. Sin él, un cinturón que abortara SIEMPRE pasaría el test de arriba y
   * habría roto el productor de 49 artefactos versionados sin que nadie lo notara.
   */
  it("★★ control: sin tombstone la pasada escribe con normalidad (exit 0) y hace su trabajo", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_INOCUO);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    const out = JSON.parse(leer(dir)) as Ruta;
    expect(out.segments[0]!.skip).toBe("pendiente-runner");
    expect(out.segments[0]!.note, "el overlay SÍ se aplicó: no es un cinturón que congele el fichero").toBe(
      "no opino del skip",
    );
  });

  it("★ el cinturón mira el SEGMENTO ENTERO, no sólo `skip` (una baja de `ctx` también aborta)", async () => {
    const dir = fixture(RUTA_CON_SKIP, { segments: { "px-g02": { ctx: false } } });
    const antes = leer(dir);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(3);
    expect(salida).toContain("px-g02");
    expect(salida).toContain("ctx");
    expect(leer(dir)).toBe(antes);
  });

  it("★★ `--allow-desskip`: escribe A SABIENDAS y ENUMERA lo que se pierde (para el commit)", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const { code, salida } = await correr(["--allow-desskip", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(JSON.parse(leer(dir)).segments[0].skip, "la pérdida se aceptó: el skip se fue").toBeUndefined();
    // ★ y NO en silencio: si aceptar la pérdida no la enumerara, la flag sería un `2>/dev/null`
    expect(salida).toContain("CAMPO PERDIDO");
    expect(salida).toContain("px-g01");
  });
});

describe("--check INFORMA y NO rompe (ruling #94), pero ya no calla las pérdidas", () => {
  it("★★ nombra la pérdida, NO escribe, y conserva exit 0", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_TOMBSTONE);
    const antes = leer(dir);
    const { code, salida } = await correr(["--check", "--routes", dir, "px"]);
    expect(code, "poner --check en rojo con 19 derivas preexistentes sólo enseña a apagarlo").toBe(0);
    expect(salida).toContain("CAMPO PERDIDO");
    expect(salida).toContain("px-g01");
    expect(leer(dir)).toBe(antes);
  });

  it("★ control: sobre un corpus sin tombstone, --check no inventa pérdidas", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_INOCUO);
    const { code, salida } = await correr(["--check", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("CAMPO PERDIDO");
  });
});

describe("★ flags desconocidas: ya no se tragan CON la escritura hecha", () => {
  /**
   * La vía natural para perder los 63 hoy es teclear en curate el `--verify` que estrenó su
   * hermana `apply-ledger-overlay.mjs`: antes de esto, `argv.filter((a) => !a.startsWith("--"))`
   * se lo tragaba en silencio y hacía la pasada de ESCRITURA completa diciendo que todo bien.
   */
  it("★★ `--verify` (que curate NO tiene) sale ≠0 sin tocar el disco", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_INOCUO);
    const antes = leer(dir);
    const { code, salida } = await correr(["--verify", "--routes", dir, "px"]);
    expect(code, salida).not.toBe(0);
    expect(salida).toContain("flag no reconocida");
    expect(leer(dir), "una flag mal escrita no puede dejar la ruta reescrita").toBe(antes);
  });

  it("★ control: las flags que SÍ existen no se rechazan", async () => {
    const dir = fixture(RUTA_CON_SKIP, OVERLAY_INOCUO);
    const { code, salida } = await correr(["--check", "--allow-stale", "--allow-desskip", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("flag no reconocida");
  });
});

/**
 * ★★ EL CORPUS SINTÉTICO POR LA PUERTA DE CURATE — la polaridad LIMPIA, con corpus de verdad.
 *
 * Es el gemelo instanciable del control de polaridad de LP1: una pasada `--check` sobre un corpus
 * entero SIN tombstones no puede reportar ni un `CAMPO PERDIDO`, y no puede tocar el disco.
 *
 * Y hace un trabajo que el de LP1 no puede hacer en el árbol público: `routes-sint/` es PUNTO
 * FIJO de curate (su README §«Régimen»), así que este bloque también es el vigilante de que nadie
 * edite el corpus sintético a mano y lo saque del punto fijo — `--check` sale ≠0 si aparecen
 * claves RANCIAS o huérfanas, y el aserto de DERIVA lo nombra.
 */
describe("★ el corpus SINTÉTICO: `--check` limpio, sin escribir y en punto fijo", () => {
  it("★★ las 6 partes sintéticas: exit 0, ni un CAMPO PERDIDO, ni un byte movido", async () => {
    const antes = PARTES_SINT.map((p) => readFileSync(join(ROUTES_SINT_DIR, `${p}.route.json`), "utf8"));
    const { code, salida } = await correr(["--check", "--routes", ROUTES_SINT_DIR, ...PARTES_SINT]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("CAMPO PERDIDO");
    // punto fijo: si alguien edita el corpus a mano, curate lo delata aquí
    expect(salida, "el corpus sintético dejó de ser la salida de curate").not.toContain("DERIVA");
    expect(salida, "overlay desalineado en el sintético").not.toContain("OVERLAY DESALINEADO");
    // ★ cinturón del propio test: --check no puede haber tocado el corpus versionado
    PARTES_SINT.forEach((p, i) =>
      expect(readFileSync(join(ROUTES_SINT_DIR, `${p}.route.json`), "utf8"), p).toBe(antes[i]),
    );
    // 🔴 guardas de POBLACIÓN. Sin la primera, un curate que no procesara ni una parte saldría 0
    // y no diría «CAMPO PERDIDO» tampoco. Sin la segunda, un corpus sin `skip` en ninguna ruta
    // haría vacuo el sujeto entero (el cinturón vigila BAJAS de campos: hace falta que haya
    // campos que perder).
    // 🔴 La línea de censo se exige en su forma POSITIVA («0 RANCIAS, 0 huérfanas» dicho por la
    // herramienta) y no como un `not.toContain("RANCIAS")`: el negativo casaría con la ausencia
    // de la línea ENTERA — o sea, con que curate no hubiera censado nada.
    const lineas = salida.split("\n").filter((l) => /^sint\d\d:.*0 RANCIAS, 0 huérfanas/.test(l));
    expect(lineas, "una línea de censo limpia por parte sintética").toHaveLength(PARTES_SINT.length);
    const conSkip = PARTES_SINT.flatMap(
      (p) => cargar(ROUTES_SINT_DIR, p).route.segments.filter((s) => s.skip !== undefined),
    );
    expect(conSkip.length, "segmentos `skip` en el sintético: sin ellos no hay baja que vigilar").toBeGreaterThan(0);
  }, 120_000);
});

describeCorpusReal("★★ el corpus REAL: los 63 de AD, por la puerta de curate", () => {
  /**
   * Sólo lectura (`--check` no escribe). Es la MISMA cifra que el acta de `curate-verify`
   * predijo con `camposEnRiesgo`, ahora medida EJECUTANDO la pasada: dos vías independientes
   * dando 63. Si alguien adjudica los 63, este número se mueve y obliga a re-medir.
   */
  it("★★ `--check` sobre las 25 rutas de AD nombra 63 campos perdidos, todos `skip`", async () => {
    const partes = partesDe("routes-ad");
    expect(partes.length).toBe(25);
    const antes = partes.map((p) => readFileSync(join(TOUR, "routes-ad", `${p}.route.json`), "utf8"));
    const { code, salida } = await correr(["--check", "--routes", "routes-ad", ...partes]);
    expect(code, salida).toBe(0);
    const lineas = salida.split("\n").filter((l) => l.includes("CAMPO PERDIDO"));
    expect(lineas).toHaveLength(63);
    expect(lineas.every((l) => l.includes("· skip ="))).toBe(true);
    expect(lineas.some((l) => l.includes("ad01-g06"))).toBe(true);
    // cinturón del propio test: --check no puede haber tocado el corpus versionado
    partes.forEach((p, i) =>
      expect(readFileSync(join(TOUR, "routes-ad", `${p}.route.json`), "utf8"), p).toBe(antes[i]),
    );
  }, 120_000);

  it("★ control de POLARIDAD: sobre LP1 la misma pasada no reporta ninguna pérdida", async () => {
    const { code, salida } = await correr(["--check", "--routes", "routes", ...partesDe("routes")]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("CAMPO PERDIDO");
  }, 120_000);
});
