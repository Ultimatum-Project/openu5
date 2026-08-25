/**
 * EL CINTURÓN DE ESCRITURA DE `derive-anchors.mjs` — y por qué el de `curate.mjs`, cableado tal
 * cual, habría sido un AVAL en vez de un cinturón.
 *
 * ## La tarjeta, y en qué se equivocaba
 *
 * `curate-cablear-acta.md` §5.3 declaró la tarjeta barata: «`derive-anchors.mjs` escribe rutas y
 * no lleva cinturón. Hoy sólo toca `op.anchor`, así que el aserto le saldría gratis».
 *
 * El ALCANCE es correcto y está medido: una pasada sobre las 49 rutas commiteadas mueve
 * **19 `op.anchor`** y **0 campos de segmento** (deep-diff op a op, 71 762 ops).
 *
 * El «gratis» NO lo es. `clavesVigiladas` EXCLUYE `script` por contrato, y el guion es lo ÚNICO
 * que este fichero toca: `camposPerdidos` + `clavesVigiladas` sobre esta pasada da 0 **por
 * construcción**, y sigue dando 0 mientras la pasada destruye un ancla. MEDIDO sobre el corpus
 * real: con `src:"overlay-timing"` en `part04-g03` (la etiqueta que `curate.mjs` §172 documenta
 * como realmente existente), la pasada purgó el ancla `expectDelta:+36` —una de las TRES del
 * proyecto—, salió con **exit 0**, y el cinturón de curate reportó **0 pérdidas**.
 *
 * ## Lo que estos tests fijan
 *
 * · `anclasPerdidas` ve la pérdida que `camposPerdidos` no puede ver (y al revés: siguen siendo
 *   DOS canales, para que un rojo diga cuál de las dos capas se rompió);
 * · la escritura ABORTA (exit 3) nombrando la pérdida y deja la ruta INTACTA en disco;
 * · el productor NO se congela: sin pérdidas escribe y deriva con normalidad;
 * · `--allow-purga` escribe a sabiendas y ENUMERA; `--dry` informa sin romper (ruling #94);
 * · una flag desconocida ya no se traga — y aquí la que se tragaba era `--dry-run`, o sea la que
 *   APAGA la escritura: el simulacro se convertía en una pasada real sobre 49 rutas versionadas.
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  camposPerdidos,
  clavesVigiladas,
  anclasPerdidas,
  type Ruta,
} from "../e2e/espejo-tour/tools/overlay-merge.mjs";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
const CLI = join(TOUR, "tools", "derive-anchors.mjs");

/**
 * `execFile` ASÍNCRONO, nunca `spawnSync`: un `spawnSync` dentro de un test bloquea el worker de
 * vitest y su RPC expira — la suite sale «todo verde» con exit 1.
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

/** Corpus de juguete EN DISCO: derive-anchors escribe, así que el fixture no puede ser en memoria. */
function fixture(ruta: Ruta): string {
  const dir = mkdtempSync(join(tmpdir(), "anchors-cinturon-"));
  writeFileSync(join(dir, "px.route.json"), JSON.stringify(ruta, null, 2) + "\n");
  return dir;
}
const leer = (dir: string) => readFileSync(join(dir, "px.route.json"), "utf8");

/**
 * Un ancla PUESTA A MANO en un op que la derivación NO reproduce: el beat no es un (L)ook ni un
 * (T)alk invertible, así que la pasada cae en la rama de purga. Es la forma canónica del defecto.
 */
const RUTA_ANCLA_A_MANO: Ruta = {
  segments: [
    {
      id: "px-g01",
      enter: { loc: 2 },
      script: [{ key: "x", ocrLn: 10, anchor: { kind: "npc", cmd: "buy", match: "shop:Tavern", expectDelta: -99 } }],
      expect: [{ ocrLn: 10, text: "algo que no es ni look ni talk" }],
    },
  ],
};

/**
 * Fixture que SÍ deriva: «a hot stove» es tile 191 en el LOOK2 real del port, y el op `l` del
 * mismo `ocrLn` es el anclable. Sin este control, un cinturón que abortara SIEMPRE pasaría todos
 * los tests de arriba habiendo roto el productor de 49 artefactos versionados.
 */
const RUTA_DERIVABLE: Ruta = {
  segments: [
    {
      id: "px-g01",
      enter: { loc: 2 },
      script: [{ key: "l", ocrLn: 20 }, { key: "ArrowRight" }],
      expect: [{ ocrLn: 20, text: ">Look-East Thou dost see a hot stove" }],
    },
  ],
};

/**
 * El caso `CAMPO`: el op SÍ deriva (saludo de Gwenneth en Britain → `shop:Blacksmith`), pero la
 * ruta ya llevaba ahí un ancla A MANO con `expectDelta`. El ancla derivada la pisa y el
 * `expectDelta` se va DENTRO de un ancla que sigue existiendo — una pérdida que un cinturón que
 * sólo mirase «¿sigue habiendo ancla?» no vería. Es la forma real de `part04-g03` sin su `src`.
 */
const RUTA_EXPECTDELTA: Ruta = {
  segments: [
    {
      id: "px-g01",
      enter: { loc: 2 },
      script: [{ key: "t", ocrLn: 30, anchor: { kind: "npc", cmd: "sell", match: "shop:Blacksmith", expectDelta: 36 } }],
      expect: [{ ocrLn: 30, text: ">Talk-East welcome to Iolo's Bows!" }],
    },
  ],
};

const partesDe = (dir: string) =>
  readdirSync(join(TOUR, dir))
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""));

describe("★★ anclasPerdidas — el canal que `camposPerdidos` no puede cubrir", () => {
  /**
   * ★★ EL HALLAZGO DE ESTE CARRIL, como unit. No es que el cinturón de curate mida poco: es que
   * mide OTRA CAPA. Los dos asertos juntos son la prueba — el primero solo se leería como «no hay
   * pérdida», que es exactamente el modo de fallo (un verde sin dientes).
   */
  it("★★ el cinturón de curate da 0 sobre una pérdida REAL del guion; anclasPerdidas la ve", () => {
    const antes: Ruta = {
      segments: [{ id: "g1", ctx: "town", script: [{ key: "t", anchor: { kind: "npc", expectDelta: 36 } }] }],
    };
    const despues: Ruta = { segments: [{ id: "g1", ctx: "town", script: [{ key: "t" }] }] };

    expect(camposPerdidos(antes, despues, clavesVigiladas(antes)), "el testigo EQUIVOCADO").toEqual([]);
    expect(clavesVigiladas(antes), "y se ve por qué: `script` está excluido por contrato").not.toContain("script");
    expect(anclasPerdidas(antes, despues)).toEqual([
      { segId: "g1", opIndex: 0, motivo: "BORRADA", enRuta: { kind: "npc", expectDelta: 36 } },
    ]);
  });

  it("★ CAMPO: el ancla sobrevive pero pierde `expectDelta` (el ledger entero cuelga de ahí)", () => {
    const antes: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "npc", match: "shop:X", expectDelta: 36 } }] }] };
    const despues: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "npc", match: "shop:X" } }] }] };
    const p = anclasPerdidas(antes, despues);
    expect(p).toHaveLength(1);
    expect(p[0]!.motivo).toBe("CAMPO");
    expect(p[0]!.clave).toBe("expectDelta");
    expect(p[0]!.enRuta).toBe(36);
  });

  /**
   * ★ CONTROL DE POLARIDAD de la función. Sin él, `anclasPerdidas` podría estar reportando
   * cualquier diferencia —incluida la re-derivación, que es el CONTRATO del productor— y daría
   * rojo en cada pasada hasta que alguien la corriera con la flag que la apaga.
   */
  it("★ un cambio de VALOR en una clave que sigue estando NO se reporta (es el productor)", () => {
    const antes: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "face", dir: "north" } }] }] };
    const despues: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "face", dir: "east" } }] }] };
    expect(anclasPerdidas(antes, despues)).toEqual([]);
  });

  it("★ un ancla NUEVA no es una pérdida (el caso de las 19 que la pasada añade)", () => {
    const antes: Ruta = { segments: [{ id: "g1", script: [{ key: "l" }] }] };
    const despues: Ruta = { segments: [{ id: "g1", script: [{ key: "l", anchor: { kind: "face" } }] }] };
    expect(anclasPerdidas(antes, despues)).toEqual([]);
  });

  /**
   * Emparejar por índice sólo vale mientras la SECUENCIA de ops no se mueva. Si se mueve, un diff
   * op a op daría un torrente de BORRADA falsas: se reporta el desemparejamiento como tal.
   */
  it("★ guion redimensionado: se reporta el desemparejamiento, no un torrente de BORRADA falsas", () => {
    const antes: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "face" } }, { key: "b" }] }] };
    const despues: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "face" } }] }] };
    const p = anclasPerdidas(antes, despues);
    expect(p).toHaveLength(1);
    expect(p[0]!.motivo).toBe("GUION REDIMENSIONADO");
  });

  it("★ un segmento que desaparece entero reporta sus anclas", () => {
    const antes: Ruta = { segments: [{ id: "g1", script: [{ anchor: { kind: "face" } }] }] };
    expect(anclasPerdidas(antes, { segments: [] })[0]!.motivo).toBe("SEGMENTO PERDIDO");
  });
});

describe("★★ derive-anchors en ESCRITURA no puede llevarse un ancla de la ruta", () => {
  it("★★ ancla a mano no re-derivada → ABORTA (exit 3), la NOMBRA y deja la ruta INTACTA", async () => {
    const dir = fixture(RUTA_ANCLA_A_MANO);
    const antes = leer(dir);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(3);
    expect(salida).toContain("px-g01");
    expect(salida).toContain("BORRADA");
    expect(salida).toContain("expectDelta");
    // ★ lo que de verdad importa: el disco. Un abort que ya ha escrito no es un cinturón.
    expect(leer(dir), "ABORTADO tiene que significar SIN ESCRIBIR").toBe(antes);
  });

  /**
   * ★★ CONTROL CON DIENTES. Sin él, un cinturón que abortara siempre pasaría el test de arriba
   * habiendo roto el productor de las 49 rutas.
   */
  it("★★ control: sin pérdidas escribe (exit 0) y DERIVA — el cinturón no congela el productor", async () => {
    const dir = fixture(RUTA_DERIVABLE);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    const out = JSON.parse(leer(dir)) as Ruta;
    const anchor = out.segments[0]!.script![0]!.anchor as Record<string, unknown>;
    expect(anchor, "la pasada tiene que seguir haciendo su trabajo").toMatchObject({
      kind: "face",
      dir: "east",
      tileIds: [191],
    });
    expect(salida).not.toContain("ANCLA PERDIDA");
  });

  it("★★ CAMPO: un ancla derivada que pisa `expectDelta` también aborta", async () => {
    const dir = fixture(RUTA_EXPECTDELTA);
    const antes = leer(dir);
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(3);
    expect(salida).toContain("CAMPO");
    expect(salida).toContain("expectDelta");
    expect(leer(dir)).toBe(antes);
  });

  it("★★ `--allow-purga`: escribe A SABIENDAS y ENUMERA lo que se pierde (para el commit)", async () => {
    const dir = fixture(RUTA_ANCLA_A_MANO);
    const { code, salida } = await correr(["--allow-purga", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(JSON.parse(leer(dir)).segments[0].script[0].anchor, "la pérdida se aceptó").toBeUndefined();
    // ★ y NO en silencio: sin la enumeración la flag sería un `2>/dev/null`
    expect(salida).toContain("ANCLA PERDIDA");
    expect(salida).toContain("px-g01");
  });

  it("★ `--dry` INFORMA y no rompe (no escribe → no hay daño donde poner la fatalidad)", async () => {
    const dir = fixture(RUTA_ANCLA_A_MANO);
    const antes = leer(dir);
    const { code, salida } = await correr(["--dry", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(salida).toContain("ANCLA PERDIDA");
    expect(leer(dir)).toBe(antes);
  });
});

describe("★ la FAMILIA `overlay*` protege lo puesto a mano (alineado con curate.mjs §172)", () => {
  const conSrc = (src: string): Ruta => ({
    segments: [
      {
        id: "px-g01",
        enter: { loc: 2 },
        script: [{ key: "x", ocrLn: 10, src, anchor: { kind: "npc", cmd: "buy", expectDelta: -99 } }],
        expect: [{ ocrLn: 10, text: "ni look ni talk" }],
      },
    ],
  });

  it("★ `overlay-timing` (la etiqueta que curate documenta) SOBREVIVE la pasada", async () => {
    const dir = fixture(conSrc("overlay-timing"));
    const { code, salida } = await correr(["--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(JSON.parse(leer(dir)).segments[0].script[0].anchor.expectDelta).toBe(-99);
  });

  /**
   * ★ El control que le da dientes al de arriba: sin el `src`, el MISMO fixture se purga. Si no
   * estuviera, «sobrevive» podría significar «esta pasada no purga nunca».
   */
  it("★ control: el mismo op SIN `src` sí cae en la purga (y el cinturón lo para)", async () => {
    const dir = fixture(conSrc(""));
    const { code } = await correr(["--routes", dir, "px"]);
    expect(code).toBe(3);
  });
});

describe("★★ flags desconocidas: la que se tragaba era la que APAGA la escritura", () => {
  /**
   * `args.includes("--dry")` es EXACTO, y el filtro de part-ids `!a.startsWith("--")` se comía el
   * resto. Así que `--dry-run` —el nombre natural del simulacro— hacía la pasada de ESCRITURA
   * completa sobre las rutas versionadas y salía 0. Es la puerta 4 de `curate-cablear-acta.md`
   * §1, peor aquí: en curate la flag tragada no cambiaba de modo, aquí sí.
   */
  it.each(["--dry-run", "--dryrun", "--check", "--verify"])("★★ `%s` sale ≠0 sin tocar el disco", async (flag) => {
    const dir = fixture(RUTA_DERIVABLE);
    const antes = leer(dir);
    const { code, salida } = await correr([flag, "--routes", dir, "px"]);
    expect(code, salida).not.toBe(0);
    expect(salida).toContain("flag no reconocida");
    expect(leer(dir), "una flag mal escrita no puede dejar la ruta reescrita").toBe(antes);
  });

  it("★ control: las flags que SÍ existen no se rechazan", async () => {
    const dir = fixture(RUTA_DERIVABLE);
    const { code, salida } = await correr(["--dry", "--allow-purga", "--routes", dir, "px"]);
    expect(code, salida).toBe(0);
    expect(salida).not.toContain("flag no reconocida");
  });

  it("★ `--routes` sin valor sale por la puerta de USO, no por un TypeError a media pasada", async () => {
    const { code, salida } = await correr(["--routes"]);
    expect(code).toBe(2);
    expect(salida).not.toContain("TypeError");
  });
});

describe("★★ el corpus REAL: alcance medido y 0 falsos positivos", () => {
  /**
   * ★★ La cifra que CORRIGE el «sólo toca op.anchor» de la tarjeta convirtiéndolo en un dato: la
   * pasada mueve 19 `op.anchor` y NADA más. Si se mueve, el alcance del cinturón hay que re-medirlo.
   */
  it("★★ `--dry` sobre las 49 rutas: 0 pérdidas, y el corpus versionado no se toca", async () => {
    const partes = { routes: partesDe("routes"), "routes-ad": partesDe("routes-ad") };
    expect(partes.routes.length + partes["routes-ad"].length).toBe(49);
    for (const [dir, ps] of Object.entries(partes)) {
      const antes = ps.map((p) => readFileSync(join(TOUR, dir, `${p}.route.json`), "utf8"));
      const { code, salida } = await correr(["--dry", "--routes", dir, ...ps]);
      expect(code, salida).toBe(0);
      expect(salida, `${dir}: un gate que cría falsos positivos acaba corriéndose apagado`).not.toContain(
        "ANCLA PERDIDA",
      );
      // cinturón del propio test: `--dry` no puede haber tocado el corpus versionado
      ps.forEach((p, i) => expect(readFileSync(join(TOUR, dir, `${p}.route.json`), "utf8"), p).toBe(antes[i]));
    }
  }, 120_000);

  /**
   * El otro lado del alcance: `camposPerdidos` es 0 aquí POR CONSTRUCCIÓN (este fichero no
   * escribe fuera del guion), no porque el corpus esté sano. Fijarlo evita que alguien lea ese 0
   * como «el cinturón de curate ya cubría esto».
   */
  it("★★ `camposPerdidos` es 0 por CONSTRUCCIÓN: las claves vigiladas no incluyen el guion", () => {
    const ruta = JSON.parse(readFileSync(join(TOUR, "routes", "part04.route.json"), "utf8")) as Ruta;
    const vig = clavesVigiladas(ruta);
    expect(vig).not.toContain("script");
    expect(vig.length, "hay claves de segmento de sobra: el 0 no es por falta de vigilancia").toBeGreaterThan(3);
    // la única capa que este escritor toca es justamente la que ese cinturón no mira
    const conAncla = ruta.segments.flatMap((s) => (s.script ?? []).filter((o) => o.anchor));
    expect(conAncla.length, "part04 lleva anclas: la población del control no está vacía").toBeGreaterThan(0);
  });
});
