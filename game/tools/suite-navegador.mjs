#!/usr/bin/env node
/**
 * #177 · CORRE LAS SUITES DE NAVEGADOR Y SELLA EL RESULTADO EN UN ARTEFACTO FECHADO.
 *
 * Uso:  node tools/suite-navegador.mjs [--configs a,b] [--salida <ruta>]   (desde game/)
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────
 * El hueco 5 de /verificacion dice, con razón, que las pruebas de navegador están
 * **DECLARADAS, no ejecutadas**: `estado-datos.mjs:pruebasNavegador` las enumera con
 * `--list` en cada construcción —lo que da un recuento vivo y honesto— pero `--list` no
 * ejecuta nada. La página publica un CENSO y lo dice.
 *
 * Este script produce lo que faltaba: el RESULTADO, con su fecha, su commit y su
 * instrumento. Y lo escribe como artefacto para que la tarjeta lo INYECTE en vez de
 * llevarlo a mano — la clase que #134 y #156 llevan dos fichas retirando de esta página.
 *
 * ── LO QUE ESTE ARTEFACTO **NO** PUEDE SER, Y POR QUÉ SE DICE AQUÍ ───────────────
 * 🔴 Un resultado de test **no se puede derivar en construcción** como se derivan el
 * censo o el recuento: correr 595 pruebas de navegador cuesta una ventana de máquina,
 * y meterlo en el ensamblador del sitio haría que publicar una errata de texto costase
 * media hora de CPU. ⇒ esto es, inevitablemente, una FOTO.
 *
 * Una foto no es deshonesta; una foto SIN FECHA lo es. Por eso el artefacto guarda
 * `fecha`, `sha` y `dirty`, y por eso el inyector publica los tres junto a la cifra: el
 * lector sabe QUÉ se ejecutó, CUÁNDO y SOBRE QUÉ ÁRBOL, y puede repetirlo con el comando
 * que la propia tarjeta imprime. Lo que caduca con una foto fechada es la foto, no la
 * honestidad de la página.
 *
 * ── EL ESPEJO NO ENTRA EN EL AGREGADO, Y ESO ES EL PUNTO ────────────────────────
 * 🔴 `playwright.espejo.config.ts` enumera 6 pruebas que NO son verdes-o-rojos: su propia
 * config declara que es un arnés de CONFORMIDAD contra los let's-play, con umbral 0.5
 * frente a una conformidad medida del corpus de 4,7 %–25,6 %, y que **sin
 * `U5_ESPEJO_SOFT=1` falla SIEMPRE, por instrumento**. Sumar sus 6 al total daría o
 * 6 rojos que no significan nada, o —con la palanca puesta— 6 verdes que tampoco.
 * Se registra en `excluidas` CON SU RAZÓN y queda fuera del numerador y del
 * denominador. Un total que mezcla dos clases de prueba es un total peor que ninguno.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(AQUI, "..");
const RAIZ = resolve(GAME, "..");

/**
 * Las que SÍ producen un veredicto. `prepara` corre antes (el smoke de producción
 * necesita `dist/`, que cada árbol construye el suyo — nunca se symlinkea).
 */
const CONFIGS = [
  { id: "escritorio", cfg: "playwright.config.ts", es: "Escritorio", en: "Desktop" },
  { id: "movil", cfg: "playwright.mobile.config.ts", es: "Móvil", en: "Mobile" },
  {
    id: "prod",
    cfg: "playwright.prod.config.ts",
    es: "Sitio en producción",
    en: "Production site",
    prepara: ["npm", ["run", "build"]],
  },
];

const EXCLUIDAS = [
  {
    id: "espejo",
    cfg: "playwright.espejo.config.ts",
    razon_es:
      "Arnés de CONFORMIDAD contra los let's-play, no de regresión: su umbral por " +
      "defecto (0,5) está por encima de la conformidad medida del corpus (4,7 %–25,6 %), " +
      "así que sin la palanca U5_ESPEJO_SOFT falla siempre por instrumento. Su resultado " +
      "no es comparable con el de las otras tres y no entra en el total.",
    razon_en:
      "A CONFORMANCE harness against the let's-plays, not a regression suite: its default " +
      "threshold (0.5) sits above the corpus's measured conformance (4.7%–25.6%), so " +
      "without the U5_ESPEJO_SOFT lever it always fails by instrument. Its result is not " +
      "comparable with the other three and does not enter the total.",
  },
];

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const soloIds = opt("--configs")?.split(",").map((s) => s.trim());
const SALIDA = resolve(opt("--salida") ?? join(RAIZ, "re/ledger/suite-navegador.json"));
/**
 * Argumentos extra para playwright, separados por espacios. Existe para PROBAR ESTE
 * SCRIPT sin pagar la ventana entera (`--extra "--grep <algo>"`): depurar el parser
 * dentro de la ventana exclusiva es gastar media hora de máquina en un typo.
 * 🔴 Su uso queda REGISTRADO en el artefacto (`extra`) y fuerza `completa:false`: una
 * corrida filtrada tiene la misma forma que la completa y sin esto publicaría un total
 * pequeño como si fuera el total.
 */
const EXTRA = opt("--extra")?.split(/\s+/).filter(Boolean) ?? [];

const git = (...a) => execFileSync("git", a, { cwd: RAIZ, encoding: "utf8" }).trim();

/**
 * 🔴 EL PARSER SE ANCLA AL REPORTERO JSON, NO A LA SALIDA HUMANA. Contar líneas de
 * `--reporter=line` contaría cabeceras y reintentos; y el «Total: N tests» de `--list`
 * es el CENSO, no el resultado. El reportero json trae `stats` con las cuatro cuentas
 * separadas, que es justo la distinción que la tarjeta necesita publicar.
 */
function corre(c) {
  const t0 = Date.now();
  let crudo = "",
    lanzo = null;
  try {
    crudo = execFileSync(
      "npx",
      ["--no-install", "playwright", "test", "-c", c.cfg, "--reporter=json", ...EXTRA],
      // maxBuffer generoso: el reportero json de 400 tests pasa del default de 1 MB, y
      // un ENOBUFS aquí se leería como «la suite petó» en vez de «no cupo la salida».
      { cwd: GAME, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    // Playwright sale con 1 cuando hay rojos: eso NO es un fallo del script, es el
    // resultado. El json sigue en stdout y hay que leerlo.
    crudo = e.stdout ?? "";
    lanzo = crudo ? null : (e.message || "").split("\n")[0];
  }
  const ms = Date.now() - t0;
  if (lanzo) throw new Error(`${c.cfg}: no produjo informe json — ${lanzo}`);
  let j;
  try {
    j = JSON.parse(crudo.slice(crudo.indexOf("{")));
  } catch {
    throw new Error(`${c.cfg}: el informe json no se pudo parsear (${crudo.length} B)`);
  }
  const s = j.stats ?? {};
  const total = (s.expected ?? 0) + (s.unexpected ?? 0) + (s.flaky ?? 0) + (s.skipped ?? 0);
  if (!total) throw new Error(`${c.cfg}: cero pruebas en el informe — el parser dio verde sobre nada`);
  // Los rojos, uno a uno y con su proyecto: un agregado sin los nombres obliga a
  // re-correr la suite para saber QUÉ falló, que es la mitad del coste otra vez.
  const fallos = [];
  const anda = (suite) => {
    for (const sp of suite.specs ?? []) {
      for (const t of sp.tests ?? []) {
        if (t.status !== "expected" && t.status !== "skipped")
          fallos.push({ proyecto: t.projectName, titulo: sp.title, fichero: sp.file, estado: t.status });
      }
    }
    for (const hijo of suite.suites ?? []) anda(hijo);
  };
  for (const su of j.suites ?? []) anda(su);
  return {
    ...c,
    prepara: undefined,
    total,
    ok: s.expected ?? 0,
    rojos: s.unexpected ?? 0,
    inestables: s.flaky ?? 0,
    saltados: s.skipped ?? 0,
    ms,
    fallos,
  };
}

const aCorrer = CONFIGS.filter((c) => !soloIds || soloIds.includes(c.id));
if (!aCorrer.length) {
  console.error(`--configs no casó ninguna. Disponibles: ${CONFIGS.map((c) => c.id).join(", ")}`);
  process.exit(2);
}

/**
 * 🔴 TODAS LAS PREPARACIONES VAN ANTES DE LA PRIMERA PRUEBA — FALLAR PRONTO O NO FALLAR.
 *
 * `prepara` estaba dentro de `corre()`, así que el `npm run build` del smoke de producción
 * se ejecutaba AL FINAL, después de escritorio y móvil. Si ese build falla —y en un
 * worktree puede: `game/dist` no se symlinkea nunca, cada árbol construye el suyo—, la
 * excepción mata el script ANTES de escribir el artefacto, y con él se van los ~40 minutos
 * de las otras dos configuraciones. Lo caro no era el fallo: era su POSICIÓN.
 *
 * Ahora todo lo que puede reventar por entorno revienta en los primeros segundos, con el
 * cerrojo recién tomado y sin nada que perder. La ventana es un recurso y el orden de las
 * operaciones dentro de ella es parte de su coste.
 */
for (const c of CONFIGS.filter((c) => c.prepara && (!soloIds || soloIds.includes(c.id)))) {
  process.stderr.write(`· preparando ${c.id} (${c.prepara[1].join(" ")})…\n`);
  execFileSync(c.prepara[0], c.prepara[1], { cwd: GAME, stdio: "inherit" });
}

const resultados = [];
for (const c of aCorrer) {
  process.stderr.write(`▶ ${c.id} (${c.cfg})…\n`);
  const r = corre(c);
  process.stderr.write(
    `   ${r.ok}/${r.total} ok · ${r.rojos} rojos · ${r.saltados} saltados · ${(r.ms / 1000).toFixed(0)} s\n`,
  );
  resultados.push(r);
}

const suma = (k) => resultados.reduce((a, r) => a + r[k], 0);
const artefacto = {
  // 🔴 PARCIAL cuando no se corrieron las tres: sin este campo, una corrida de una sola
  // config produciría un artefacto con la misma forma que la completa y la tarjeta
  // publicaría un total pequeño como si fuera el total.
  completa: aCorrer.length === CONFIGS.length && !EXTRA.length,
  extra: EXTRA.length ? EXTRA.join(" ") : undefined,
  fecha: new Date().toISOString().slice(0, 10),
  sha: git("rev-parse", "--short", "HEAD"),
  dirty: git("status", "--porcelain").length > 0,
  instrumento: {
    playwright: execFileSync("npx", ["--no-install", "playwright", "--version"], {
      cwd: GAME,
      encoding: "utf8",
    }).trim(),
    node: process.version,
    plataforma: `${process.platform}-${process.arch}`,
  },
  total: suma("total"),
  ok: suma("ok"),
  rojos: suma("rojos"),
  inestables: suma("inestables"),
  saltados: suma("saltados"),
  ms: suma("ms"),
  configs: resultados,
  excluidas: EXCLUIDAS,
};

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify(artefacto, null, 2) + "\n", "utf8");
process.stderr.write(
  `\n✓ ${artefacto.ok}/${artefacto.total} en ${(artefacto.ms / 60000).toFixed(1)} min · ` +
    `${artefacto.sha}${artefacto.dirty ? " (SUCIO)" : ""} · ${SALIDA}\n`,
);
process.exit(artefacto.rojos ? 1 : 0);
