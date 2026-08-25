/**
 * ¿ESTE DIFF PUEDE MOVER LOS CINCO SELLOS? — la mitad «¿hace falta la puerta?».
 *
 *   node re/tools/alcance_sellos.mjs --rango <A>..<B>       # rango de commits
 *   node re/tools/alcance_sellos.mjs --ficheros a.ts b.json # lista explícita
 *   git diff --name-only | node re/tools/alcance_sellos.mjs --stdin
 *   … [--solo-arnes] [--raiz <repo>] [--listar-alcance]
 *
 * Exit 0 = fuera de alcance · 10 = EN alcance (⇒ exige `veredicto_sellos`) · 2 = error de uso.
 *
 * ════ ★★ UN PREDICADO IMPECABLE SOBRE UNA ENTRADA MAL CONSTRUIDA NO VALE NADA ════════════
 * Todo lo que viene debajo es el PREDICADO —qué se clasifica como «en alcance»— y se derivó
 * con cuidado. Pero el agujero real de esta herramienta no estuvo nunca ahí: estuvo en **cómo
 * se construye la LISTA que el predicado clasifica**. `--rango main..HEAD`, con dos puntos,
 * pasaba a `git diff` una pregunta distinta de la que esta herramienta contesta, y por esa
 * puerta de atrás entraba justo el FALSO NEGATIVO que este carril tenía encargo de matar
 * (detalle en `normalizaRango`). Se cazó aplicando la herramienta A SU PROPIA RAMA.
 *
 * ⇒ Al auditar este fichero, audita las DOS mitades. Un cierre de imports perfecto no protege
 * de nada si la lista de ficheros que se le da ya venía incompleta.
 *
 * ════ EL PREDICADO NO ES UNA LISTA DE RUTAS: ES UN CIERRE ════════════════════════════════
 * La forma fácil —y equivocada— es escribir `game/e2e/espejo-tour/**` y creer que ya está.
 * Ese predicado deja pasar el commit que HOY tiene nombre y apellidos: **F-6 (`11ac53bf`)
 * tocó `game/e2e/grandtour/nav.ts`**, y es el que el carril `reloj-27` midió desplazando el
 * reloj de la cadena 78 minutos (03:52 → 05:10) y costando −17 bloques. No está bajo
 * `espejo-tour/`, pero `espejo-tour/runner.ts:27` lo IMPORTA
 * (`import { getPos, inDungeonCombat, dungeonResolveRoomCombat } from "../grandtour/nav"`).
 *
 * Así que el alcance del CÓDIGO se DERIVA: es el cierre transitivo de imports desde los
 * puntos de entrada del arnés. Nadie lo mantiene a mano y nadie tiene que acordarse de
 * `nav.ts` — sale solo, igual que sale `src/core/time.ts`, que es literalmente el reloj.
 *
 * ════ TRES TRAMOS, PORQUE SON TRES RIESGOS DISTINTOS ═════════════════════════════════════
 *  · T1 ARNÉS-CÓDIGO  cierre de imports desde las entradas del arnés (~39 ficheros hoy, de
 *    los cuales 23 en `src/`, sobre 233: el predicado DISCRIMINA, no traga el repo entero).
 *    Aquí caen 9 de los 11 commits que otros carriles han nombrado como movedores.
 *  · T2 ARNÉS-DATOS   rutas, overlays y checkpoints. NO son alcanzables por imports (el
 *    arnés los lee por ruta), así que ningún cierre los encuentra: van declarados, y su
 *    justificación es la línea de código que los lee. `04e033c2` movió el ledger tocando
 *    SÓLO `routes-ad/ad09.route.json` + su overlay.
 *  · T3 PORT          `game/src/**`. El arnés CONDUCE al port en un navegador: el cierre del
 *    navegador (raíz `src/main.ts`) son 222 de los 244 ficheros de `src/`, o sea
 *    prácticamente todo. Un cambio ahí no mueve pulsaciones, pero cambia lo que el port
 *    EMITE y puede romper un sello igual.
 *
 * ⚠ T3 es ANCHO y eso es un hecho medido, no una opinión: no hay forma útil de partir `src/`
 * en «lo que el port carga» y «lo que no», porque carga casi todo. Va DENTRO del alcance por
 * defecto —una puerta que da verde en falso es peor que no tener puerta— y `--solo-arnes` lo
 * excluye para quien quiera la pregunta estricta del lead («¿toca el arnés?»). La elección
 * queda ESCRITA en la orden, no escondida en un default.
 *
 * ════ LO QUE QUEDA FUERA, Y POR QUÉ ══════════════════════════════════════════════════════
 *  · `re/**`, `docs/**`, `*.md`, actas y manifiestos: no los carga ni los lee ninguna corrida.
 *  · `game/tests/**`: son tests unitarios; no participan de la corrida playwright del espejo.
 *  · `game/e2e/**` que NO esté en el cierre (p. ej. specs de otros tours): no los importa el
 *    arnés del espejo.
 *  · `game/assets/**`: material de EA, gitignored — no puede aparecer en un diff.
 *
 * ════ LÍMITES CONOCIDOS (dichos, no disimulados) ═════════════════════════════════════════
 *  1. El cierre se calcula por ANÁLISIS ESTÁTICO de `from`/`import()`/`require()` con
 *     especificador LITERAL. Un `import(variable)` no se ve. Hoy no hay ninguno en el cierre
 *     (el escáner reporta 0 especificadores relativos sin resolver), y si aparece uno el
 *     modo `--listar-alcance` lo saca por pantalla.
 *  2. El cierre se calcula sobre el ÁRBOL DE TRABAJO, no sobre cada extremo del rango. Si un
 *     commit AÑADE un import a un fichero nuevo, ese fichero ya está en el cierre de después
 *     (que es el árbol vigente) — que es el lado que importa. Si un commit RETIRA el último
 *     import de un fichero, ese fichero deja el cierre y su cambio saldría fuera de alcance:
 *     es el único hueco real y se cierra corriendo el detector ANTES de retirar el import.
 *  3. Esto dice si HAY QUE MIRAR, no si el sello se rompe. Quien contesta eso es
 *     `veredicto_sellos.mjs`, corriendo las partes.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/** Entradas del arnés: lo que playwright carga para correr una parte del espejo. */
export const ENTRADAS = [
  "game/e2e/espejo-tour/espejo-tour.spec.ts",
  "game/e2e/espejo-tour/runner.ts",
  "game/e2e/espejo-tour/checkpoint.ts",
  "game/playwright.espejo.config.ts",
];

/**
 * T2 — DATOS que el arnés lee POR RUTA (ningún cierre de imports los ve). Cada uno con la
 * línea que lo justifica, para que se pueda auditar que no me los he inventado.
 */
export const DATOS = [
  { glob: "game/e2e/espejo-tour/routes/", porque: "runner.ts:100 `ROUTES_DIR = join(HERE, \"routes\")` — el guion de las partes LP1" },
  { glob: "game/e2e/espejo-tour/routes-ad/", porque: "runner.ts:104 `ROUTES_AD_DIR = join(HERE, \"routes-ad\")` — el guion del corpus AD (incluye overlays/)" },
  { glob: "game/e2e/espejo-tour/saves/", porque: "checkpoint.ts:23 `SAVES_DIR = join(HERE, \"saves\")` — los checkpoints ENCADENADOS: la entrada de cada parte" },
];

/** Ficheros que gobiernan CÓMO se construye/sirve/configura la corrida. */
export const CONFIG = [
  "game/vite.config.ts",
  "game/package.json",
  "game/playwright.espejo.config.ts",
];

const EXT = [".ts", ".mts", ".js", ".mjs", ".tsx", ".json", "/index.ts", "/index.js"];

function resolver(desde, spec) {
  if (!spec.startsWith(".")) return null; // bare specifier ⇒ node_modules ⇒ fuera
  const base = path.resolve(path.dirname(desde), spec);
  const cands = [base, ...EXT.map((e) => base + e)];
  if (base.endsWith(".js")) cands.push(base.slice(0, -3) + ".ts");
  if (base.endsWith(".mjs")) cands.push(base.slice(0, -4) + ".mts");
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

/**
 * Cierre transitivo de imports desde `entradas` (rutas relativas a `raiz`).
 * Devuelve { ficheros: Set<rutaRelativa>, sinResolver: string[] }.
 */
export function cierreDeImports(raiz, entradas) {
  const vistos = new Set();
  const sinResolver = [];
  const cola = entradas.map((e) => path.join(raiz, e)).filter((f) => existsSync(f));
  while (cola.length) {
    const f = cola.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    if (!/\.(ts|mts|js|mjs|tsx)$/.test(f)) continue;
    const src = readFileSync(f, "utf8");
    const specs = [
      ...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
      ...src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    for (const s of specs) {
      const r = resolver(f, s);
      if (r) cola.push(r);
      else if (s.startsWith(".")) sinResolver.push(`${path.relative(raiz, f)} → ${s}`);
    }
  }
  return { ficheros: new Set([...vistos].map((f) => path.relative(raiz, f))), sinResolver: [...new Set(sinResolver)] };
}

/** Clasifica UN fichero cambiado. Devuelve el tramo o null si está fuera. */
export function clasifica(fichero, { cierre, soloArnes }) {
  if (cierre.has(fichero)) return { tramo: "T1 ARNÉS-CÓDIGO", porque: "está en el cierre de imports del arnés" };
  for (const d of DATOS) if (fichero.startsWith(d.glob)) return { tramo: "T2 ARNÉS-DATOS", porque: d.porque };
  if (CONFIG.includes(fichero)) return { tramo: "T2 ARNÉS-DATOS", porque: "gobierna cómo se construye/sirve/configura la corrida" };
  if (!soloArnes && fichero.startsWith("game/src/")) {
    return { tramo: "T3 PORT", porque: "el arnés conduce al port: un cambio aquí cambia lo que el port EMITE (cierre del navegador = 222/244 de src/)" };
  }
  return null;
}

export function analiza(raiz, ficheros, { soloArnes = false } = {}) {
  const { ficheros: cierre, sinResolver } = cierreDeImports(raiz, ENTRADAS);
  const dentro = [];
  const fuera = [];
  for (const f of ficheros) {
    const c = clasifica(f, { cierre, soloArnes });
    if (c) dentro.push({ fichero: f, ...c });
    else fuera.push(f);
  }
  return { dentro, fuera, cierre, sinResolver };
}

/**
 * 🔴 DOS PUNTOS vs TRES PUNTOS — y aquí NO son un gusto de estilo, son dos preguntas distintas.
 *
 * `git diff --name-only main..HEAD` (DOS puntos) compara los dos ÁRBOLES: mezcla «lo que cambió
 * MI rama» con «lo que cambió MAIN desde que salí». Los dos modos de fallo son reales y el
 * segundo es el que esta herramienta existe para no tener:
 *
 *   · FALSO POSITIVO — te acusa de ficheros de OTRO CARRIL. Medido: sobre esta misma rama,
 *     `main..HEAD` devolvía 26 ficheros e imputaba cinco `game/src/skin/portrait/**` del carril
 *     de UI. Además la respuesta CAMBIA sola según cuánto se haya movido main.
 *   · 🔴 FALSO NEGATIVO — si mi rama tocó un fichero y main lo dejó IGUAL (mismo fix aterrizado
 *     por otra vía, o un revert), el diff de dos puntos no lo enseña y el detector LO DEJA
 *     PASAR. Ése es exactamente el mutante contra el que se pidió blindar este predicado.
 *
 * La pregunta que contesta esta herramienta es siempre «¿qué toca ESTE trabajo?», que es
 * semántica de MERGE-BASE, o sea TRES puntos. Así que un rango de dos puntos se NORMALIZA a
 * tres y se dice en voz alta, en vez de contestar en silencio a otra pregunta.
 */
export function normalizaRango(rango) {
  if (!rango.includes("..") || rango.includes("...")) return { rango, aviso: null };
  const tres = rango.replace("..", "...");
  return { rango: tres, aviso:
    `⚠ rango '${rango}' NORMALIZADO a '${tres}': con dos puntos se compararían los dos ÁRBOLES y ` +
    `se colarían los ficheros que cambió MAIN (falso positivo) — y peor, un fichero que tu rama ` +
    `tocó y main dejó igual NO aparecería (falso negativo). La pregunta es «¿qué toca este ` +
    `trabajo?» = merge-base.` };
}

function ficherosDelRango(raiz, rango) {
  const out = execFileSync("git", ["-C", raiz, "diff", "--name-only", rango], { encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

/**
 * 🔴 LA MISMA TRAMPA, POR LA OTRA PUERTA — y ésta no tenía guarda.
 *
 * `normalizaRango` protege el camino `--rango`. **`--stdin` y `--ficheros` no pasaban por
 * ninguna comprobación**, y es justo por ahí por donde se cuela lo mismo: quien escribe
 * `git diff --name-only main | node alcance_sellos.mjs --stdin` compara los dos ÁRBOLES y le
 * imputa a su rama los ficheros que cambió MAIN. Medido el 2026-08-06: en una entrega real
 * dio **28 ficheros con 3 en alcance** cuando los del trabajo eran **4 con 3**; los otros 24
 * eran de otros carriles. Y el mismo día, otra persona comparó dos corridas separadas por 18
 * ficheros creyendo que medía un fix. **Dos sujetos distintos, el mismo error, la misma
 * jornada** — cuando eso pasa la explicación económica ya no es el descuido: es que la
 * referencia por defecto de la herramienta es la equivocada.
 *
 * La guarda no puede saber CÓMO se construyó la lista, pero sí puede preguntarle al repo:
 * **¿estos ficheros están en `merge-base(HEAD, <ref>)..HEAD`?** Los que no, vienen de otro
 * sitio. Se avisa **con la cifra al lado** —un aviso sin número se ignora— y se dice cuál
 * sería el alcance real.
 *
 * NO es desactivable por conveniencia: si de verdad se quiere clasificar una lista ajena al
 * trabajo (auditar el diff de otro, por ejemplo), hay que **declararlo** con
 * `--lista-ajena`, que lo deja escrito en la orden en vez de esconderlo en un default.
 */
export function auditaProcedencia(raiz, ficheros, ref = "main") {
  let base;
  try {
    base = execFileSync("git", ["-C", raiz, "merge-base", "HEAD", ref], { encoding: "utf8" }).trim();
  } catch {
    return { comprobable: false, ajenos: [], base: null }; // sin `ref` (repo raro, CI) → no se inventa
  }
  const mios = new Set(ficherosDelRango(raiz, `${base}..HEAD`));
  const dirty = execFileSync("git", ["-C", raiz, "status", "--porcelain"], { encoding: "utf8" })
    .split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  for (const d of dirty) mios.add(d); // lo no commiteado también es «de este trabajo»
  return { comprobable: true, base, ajenos: ficheros.filter((f) => !mios.has(f)) };
}

async function leerStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").split("\n").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const soloArnes = args.includes("--solo-arnes");
  const listar = args.includes("--listar-alcance");
  // `indexOf` da -1 cuando la bandera NO está, y `args[-1 + 1]` es `args[0]` — o sea que sin
  // `--raiz` la raíz salía siendo el PRIMER argumento («--rango»). Se lee sólo si está.
  const valorDe = (bandera) => {
    const i = args.indexOf(bandera);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const raiz = path.resolve(valorDe("--raiz") ?? process.cwd());
  const rango = valorDe("--rango") ?? null;
  const iFich = args.indexOf("--ficheros");

  let ficheros;
  if (rango) {
    // 🔴 AQUÍ ES DONDE ALGUIEN VA A VOLVER A ESCRIBIR DOS PUNTOS. `A..B` es lo que sale solo de
    // los dedos y es OTRA PREGUNTA: compara los dos árboles en vez de «qué toca esta rama».
    // Da falsos positivos (te imputa ficheros de otros carriles) y, peor, FALSOS NEGATIVOS —
    // un fichero que tu rama tocó y main dejó igual NO aparece. Por eso se normaliza y se avisa
    // en voz alta, en vez de contestar en silencio. NO quites esto para «simplificar».
    const n = normalizaRango(rango);
    if (n.aviso) console.log(n.aviso + "\n");
    ficheros = ficherosDelRango(raiz, n.rango);
  }
  else if (args.includes("--stdin")) ficheros = await leerStdin();
  else if (iFich >= 0) ficheros = args.slice(iFich + 1).filter((a) => !a.startsWith("--"));
  else {
    console.error("uso: node re/tools/alcance_sellos.mjs (--rango A...B | --stdin | --ficheros f1 f2 …) [--solo-arnes] [--raiz <repo>] [--listar-alcance]");
    process.exit(2);
  }

  // GUARDA DE PROCEDENCIA — sólo para las listas que llegan sin rango (ver `auditaProcedencia`).
  // El camino `--rango` ya está protegido por `normalizaRango`; éstos no lo estaban.
  if (!rango && !args.includes("--lista-ajena")) {
    const p = auditaProcedencia(raiz, ficheros, valorDe("--contra") ?? "main");
    if (p.comprobable && p.ajenos.length) {
      const real = ficheros.length - p.ajenos.length;
      console.log(
        `⚠ PROCEDENCIA: tu lista lleva ${p.ajenos.length} fichero(s) que NO están en ` +
        `'${p.base.slice(0, 8)}..HEAD' — el alcance de ESTE trabajo son ${real}, no ` +
        `${ficheros.length}.\n` +
        `   Casi siempre es un 'git diff --name-only main' (compara los dos ÁRBOLES) donde ` +
        `iba 'git diff --name-only $(git merge-base HEAD main)..HEAD'.\n` +
        `   Ajenos: ${p.ajenos.slice(0, 6).join(" ")}${p.ajenos.length > 6 ? " …" : ""}\n` +
        `   Si la lista ES de otro trabajo a propósito, decláralo con --lista-ajena.\n`,
      );
    }
  }

  const { dentro, fuera, cierre, sinResolver } = analiza(raiz, ficheros, { soloArnes });

  if (listar) {
    console.log(`── ALCANCE VIGENTE (cierre de imports desde ${ENTRADAS.length} entradas) ── ${cierre.size} ficheros`);
    for (const f of [...cierre].sort()) console.log(`   ${f}`);
    for (const d of DATOS) console.log(`   ${d.glob}**   (T2: ${d.porque})`);
    if (sinResolver.length) {
      console.log(`\n⚠ ${sinResolver.length} especificador(es) relativo(s) SIN RESOLVER — agujeros del escáner:`);
      for (const s of sinResolver) console.log(`   ${s}`);
    }
    console.log("");
  }

  console.log(`ficheros cambiados: ${ficheros.length}${soloArnes ? "   [--solo-arnes: T3 PORT excluido a petición]" : ""}`);
  if (dentro.length) {
    console.log(`\n🔴 EN ALCANCE (${dentro.length}) — este diff PUEDE mover los cinco sellos:`);
    for (const d of dentro.sort((a, b) => a.tramo.localeCompare(b.tramo) || a.fichero.localeCompare(b.fichero))) {
      console.log(`   [${d.tramo}] ${d.fichero}`);
      console.log(`        ${d.porque}`);
    }
  }
  if (fuera.length) console.log(`\n· fuera de alcance (${fuera.length}): ${fuera.slice(0, 12).join(" ")}${fuera.length > 12 ? " …" : ""}`);

  console.log("");
  if (dentro.length) {
    console.log("VEREDICTO: EN ALCANCE ⇒ el aterrizaje EXIGE `veredicto_sellos` sobre los cinco.");
    process.exit(10);
  }
  console.log("VEREDICTO: fuera de alcance ⇒ los sellos no pueden moverse por este diff.");
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith("alcance_sellos.mjs")) await main();
