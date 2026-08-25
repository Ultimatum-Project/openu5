/**
 * AGREGADOR de una ventana del espejo — ventana `agregado-23`.
 *
 *   node re/tools/agrega_espejo_ventana.mjs <dirBrazo> [--subset=adNN,adNN,...] [--etiq=X]
 *   node re/tools/agrega_espejo_ventana.mjs <dirA> <dirH> --pareado [--subset=...]
 *
 * `compara_espejo_brazos.mjs` ya compara `matched`/`comparable` por parte y por segmento, y
 * está calibrado (control degenerado + mutante). Esta sonda NO lo duplica: añade los campos
 * de SALUD que el encargo pide y que aquel no mira —anclas por canal, deltas de ledger,
 * combates atascados, esperas de `waitOutSeamPacers`— y sabe agregar sobre un SUBCONJUNTO
 * NOMBRADO de partes, que es lo que exige la partición AD-INMÓVIL / AD-MOVIDO.
 *
 * ★ POR QUÉ EL SUBCONJUNTO ES UN ARGUMENTO Y NO UN DEFAULT: el agregado hereda el alcance de
 * su medición ([[poblacion-hereda-el-alcance-de-su-medicion]]). Un total sobre «las partes que
 * había en el dir» cambia de significado según qué corridas terminaron, y eso convierte un
 * recorte de presupuesto en un delta. Con `--subset` el alcance queda ESCRITO en la orden, y
 * la sonda ABORTA si falta una parte pedida en vez de agregar sobre menos.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const pct = (m, c) => (c ? `${((m / c) * 100).toFixed(1)}%` : "—");
const sgn = (n) => (n > 0 ? `+${n}` : String(n));

/**
 * 🔴 GUARDA DE PROCEDENCIA — OBLIGATORIA, y no es paranoia: se cobró un intento en esta misma
 * ventana. Los dirs de salida viven en un scratchpad COMPARTIDO entre sesiones de la flota, y
 * el dir `A` YA EXISTÍA con **12 `*.report.json` de otro carril del día anterior**. Un agregado
 * sobre «los reports que hay en el dir» los habría sumado en silencio: las partes pedidas
 * ESTABAN TODAS, así que ni el `--subset` ni un conteo de ficheros lo habrían cazado —
 * **presencia no es procedencia** ([[cardinal-cuadra-no-discrimina-la-fuente]]).
 *
 * El campo `when` de cada report es la única marca de cuándo se produjo. `--desde` es
 * OBLIGATORIO y la sonda ABORTA nombrando los rancios en vez de promediarlos.
 */
function cargar(dir, desde) {
  if (!existsSync(dir)) throw new Error(`no existe: ${dir}`);
  const out = new Map();
  const rancios = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort()) {
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const parte = basename(f).replace(".report.json", "");
    if (!rep.when) { rancios.push(`${parte}(sin 'when')`); continue; }
    if (new Date(rep.when) < desde) { rancios.push(`${parte}@${rep.when}`); continue; }
    out.set(parte, rep);
  }
  if (rancios.length) {
    console.log(`⚠ ${dir}: ${rancios.length} report(s) FUERA DE VENTANA, EXCLUIDOS: ${rancios.join(" ")}`);
  }
  return out;
}

/**
 * ★★ LOS TRES CANALES DE MISS — y por qué esto está enumerado desde el FUENTE.
 *
 * `anchorsMissed` NO lo alimenta un solo mensaje. En `runner.ts` hay exactamente TRES sitios que
 * devuelven `status:"miss"`, y cada uno emite una línea DISTINTA:
 *
 *   :2347  `ANCHOR-MISS '<sees>' dir=… @loc…`        feature ausente en el mapa vivo
 *   :2617  `NPC-ANCHOR-MISS '<match>' @loc…`         NPC ausente en el mapa vivo
 *   :2706  `NPC-TALK '<match>' t+<dir> NO enganchó`  el Talk no abrió la tienda
 *
 * La primera versión de esta sonda filtraba `startsWith("ANCHOR-MISS")` y por tanto sólo veía
 * el canal 1. Sobre `ad01` eso daba **0 misses por canal** mientras el report declaraba
 * **`anchorsMissed = 1`**: el miss real era del canal 3. Un reparto que no ve dos de los tres
 * canales no es un reparto — es [[medir-en-la-capa-equivocada]], y habría publicado el P6
 * («ANCHOR-MISS por canal») sistemáticamente bajo.
 *
 * Por eso el reparto se AUDITA contra el contador que descompone: si la suma por canal no cuadra
 * con `anchorsMissed`, la sonda lo DICE ([[censo-particion-no-suma-su-total]]).
 */
const CANALES_MISS = [
  { id: "feature-ausente", test: (r) => r.startsWith("ANCHOR-MISS") },
  { id: "npc-ausente", test: (r) => r.startsWith("NPC-ANCHOR-MISS") },
  { id: "talk-no-engancha", test: (r) => r.startsWith("NPC-TALK") && r.includes("NO enganchó") },
];

/** Las líneas de `resyncs` son el canal por el que el runner declara lo que NO es un bloque:
 *  el atasco del resolvedor, la espera de pacers de costura y los tres tipos de miss. */
function salud(rep) {
  let atascados = 0, esperasPacer = 0, combatRounds = 0, missVistos = 0;
  const missPorCanal = new Map();
  for (const s of rep.segments ?? []) {
    combatRounds += s.combatRounds ?? 0;
    for (const r of s.resyncs ?? []) {
      if (r.includes("resolvedor atascado")) atascados++;
      if (r.includes("esperados los pacers")) esperasPacer++;
      const canal = CANALES_MISS.find((c) => c.test(r));
      if (canal) {
        // etiqueta = lo que va entre comillas simples ('shop:Blacksmith', 'a wooden door')
        const etiq = r.match(/'([^']+)'/)?.[1] ?? "(sin etiqueta)";
        const clave = `${canal.id}:${etiq}`;
        missPorCanal.set(clave, (missPorCanal.get(clave) ?? 0) + 1);
        missVistos++;
      }
    }
  }
  const ld = rep.ledger?.ledgerDeltas ?? [];
  return {
    atascados, esperasPacer, combatRounds, missPorCanal,
    missVistos,
    missDeclarados: rep.anchorsMissed ?? 0,
    cuadraMiss: missVistos === (rep.anchorsMissed ?? 0),
    ledgerDeltas: ld,
    ldVerdes: ld.filter((d) => d.match).length,
    ldRojos: ld.filter((d) => !d.match).length,
  };
}

function resolverSubset(mapa, subset, etiq) {
  if (!subset) return [...mapa.keys()].sort();
  const faltan = subset.filter((p) => !mapa.has(p));
  if (faltan.length) {
    console.error(`✗ ABORTA: faltan en ${etiq} las partes pedidas: ${faltan.join(" ")}`);
    console.error(`  Un agregado sobre menos partes de las declaradas NO es el agregado declarado.`);
    process.exit(2);
  }
  return subset;
}

function agregado(mapa, partes) {
  const t = { matched: 0, comparable: 0, aR: 0, aM: 0, aA: 0, atascados: 0, esperasPacer: 0, combatRounds: 0, ldV: 0, ldR: 0, missVistos: 0 };
  const canales = new Map();
  const descuadres = [];
  for (const p of partes) {
    const r = mapa.get(p), s = salud(r);
    t.matched += r.matched; t.comparable += r.comparable;
    t.aR += r.anchorsResolved ?? 0; t.aM += r.anchorsMissed ?? 0; t.aA += r.anchorsAmbiguous ?? 0;
    t.atascados += s.atascados; t.esperasPacer += s.esperasPacer; t.combatRounds += s.combatRounds;
    t.ldV += s.ldVerdes; t.ldR += s.ldRojos; t.missVistos += s.missVistos;
    if (!s.cuadraMiss) descuadres.push(`${p}(canales=${s.missVistos}≠declarados=${s.missDeclarados})`);
    for (const [c, n] of s.missPorCanal) canales.set(c, (canales.get(c) ?? 0) + n);
  }
  return { ...t, canales, descuadres };
}

function tablaUnBrazo(mapa, partes, etiq) {
  console.log(`\n═══ BRAZO ${etiq} — ${partes.length} partes ═══`);
  console.log(`parte     matched/comparable   conf    anclas ✓/✗/?   atasc  pacer  rounds  ledgerΔ`);
  for (const p of partes) {
    const r = mapa.get(p), s = salud(r);
    const ld = s.ledgerDeltas.length ? `${s.ldVerdes}✓/${s.ldRojos}✗` : "—";
    console.log(
      `${p.padEnd(9)} ${String(r.matched).padStart(5)}/${String(r.comparable).padEnd(6)} ` +
      `${pct(r.matched, r.comparable).padStart(6)}   ` +
      `${String(r.anchorsResolved ?? 0).padStart(3)}/${String(r.anchorsMissed ?? 0).padStart(2)}/${String(r.anchorsAmbiguous ?? 0).padStart(2)}   ` +
      `${String(s.atascados).padStart(4)}  ${String(s.esperasPacer).padStart(4)}  ${String(s.combatRounds).padStart(5)}   ${ld}`);
  }
  const t = agregado(mapa, partes);
  console.log(`${"TOTAL".padEnd(9)} ${String(t.matched).padStart(5)}/${String(t.comparable).padEnd(6)} ${pct(t.matched, t.comparable).padStart(6)}   ` +
    `${String(t.aR).padStart(3)}/${String(t.aM).padStart(2)}/${String(t.aA).padStart(2)}   ` +
    `${String(t.atascados).padStart(4)}  ${String(t.esperasPacer).padStart(4)}  ${String(t.combatRounds).padStart(5)}   ${t.ldV}✓/${t.ldR}✗`);
  if (t.canales.size) {
    console.log(`  MISS por canal (suma=${t.missVistos}, declarados=${t.aM}):`);
    for (const [c, n] of [...t.canales].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)} × ${c}`);
  }
  if (t.descuadres.length) {
    console.log(`  🔴 EL REPARTO POR CANAL NO CUADRA con anchorsMissed en: ${t.descuadres.join(" ")}`);
    console.log(`     (hay un canal de miss que esta sonda no reconoce — el reparto está INCOMPLETO)`);
  } else if (t.aM > 0) {
    console.log(`  ✓ el reparto por canal CUADRA con anchorsMissed (${t.missVistos}=${t.aM}) en las ${partes.length} partes`);
  }
  auditaVerdes(mapa, partes, etiq);
  return t;
}

/**
 * ★ LOS DELTAS VERDES SE COMPRUEBAN CONTRA SU CONSTANTE PUBLICADA, no sólo contra `match`.
 *
 * `match` es `got === expected` — pero `expected` lo pone el CORPUS. Si una ruta cambiara el
 * esperado de un delta verde, `match:true` seguiría saliendo y el verde no significaría nada:
 * habría movido su propia portería ([[test-contra-constante-es-circular]]). Aquí el valor va
 * ESCRITO, tomado de las actas que los cerraron, y se compara con el del report.
 */
const VERDES = {
  "ad06-g34": 220,      // costura-interna / poblar-deltas
  "ad21-g26": -1024,    // teclas-ad09
  "ad09-g04": -274,     // costura-interna (5º verde, 1º en overworld)
  "part04-g03": 36,     // espejo-final f3b
  "part05-g05": -954,   // espejo-final f3b
};

function auditaVerdes(mapa, partes, etiq) {
  const vistos = [];
  for (const p of partes) {
    for (const d of mapa.get(p).ledger?.ledgerDeltas ?? []) {
      if (d.seg in VERDES) vistos.push([d.seg, d]);
    }
  }
  if (!vistos.length) return;
  console.log(`\n  DELTAS VERDES del proyecto presentes en ${etiq}:`);
  for (const [seg, d] of vistos) {
    const esperadoOk = d.expected === VERDES[seg];
    const estado = !esperadoOk
      ? `🔴 EL ESPERADO CAMBIÓ (acta=${VERDES[seg]}, report=${d.expected}) — el verde no es comparable`
      : d.match ? "✓ VERDE" : `🔴 ROJO (got=${d.got}${d.unreadable ? ", ILEGIBLE" : ""})`;
    console.log(`    ${seg.padEnd(12)} esperado=${String(d.expected).padStart(6)} got=${String(d.got).padStart(6)}  ${estado}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dirs = args.filter((a) => !a.startsWith("--"));
  const subsetArg = args.find((a) => a.startsWith("--subset="))?.split("=")[1];
  const subset = subsetArg ? subsetArg.split(",").filter(Boolean) : null;
  const pareado = args.includes("--pareado");
  const desdeArg = args.find((a) => a.startsWith("--desde="))?.split("=")[1];
  if (!desdeArg) {
    console.error("✗ falta --desde=<ISO>: sin ventana temporal no se puede distinguir un report");
    console.error("  de esta corrida de uno rancio de otro carril en el scratchpad COMPARTIDO.");
    process.exit(2);
  }
  const desde = new Date(desdeArg);
  if (Number.isNaN(+desde)) { console.error(`✗ --desde no es una fecha: ${desdeArg}`); process.exit(2); }

  if (!pareado || dirs.length < 2) {
    const mapa = cargar(dirs[0], desde);
    const partes = resolverSubset(mapa, subset, dirs[0]);
    tablaUnBrazo(mapa, partes, args.find((a) => a.startsWith("--etiq="))?.split("=")[1] ?? basename(dirs[0]));
    return;
  }

  const A = cargar(dirs[0], desde), H = cargar(dirs[1], desde);
  // PAREADO ESTRICTO: sólo las partes en LOS DOS brazos (y, si hay subset, exactamente ese).
  const partes = subset
    ? (resolverSubset(A, subset, "A"), resolverSubset(H, subset, "H"))
    : [...A.keys()].filter((p) => H.has(p)).sort();

  const tA = tablaUnBrazo(A, partes, "A (baseline)");
  const tH = tablaUnBrazo(H, partes, "H (hoy)");

  console.log(`\n═══ DELTA H − A sobre las ${partes.length} partes pareadas ═══`);
  console.log(`parte     A matched/comp      H matched/comp      Δm      Δc`);
  let movidas = 0, bajan = 0;
  for (const p of partes) {
    const a = A.get(p), h = H.get(p);
    const dm = h.matched - a.matched, dc = h.comparable - a.comparable;
    if (dm !== 0 || dc !== 0) movidas++;
    if (dm < 0) bajan++;
    const marca = dm === 0 && dc === 0 ? "  idéntica" : dm < 0 ? "  🔴 BAJA" : "  ▲";
    console.log(`${p.padEnd(9)} ${String(a.matched).padStart(5)}/${String(a.comparable).padEnd(6)}      ` +
      `${String(h.matched).padStart(5)}/${String(h.comparable).padEnd(6)}   ${sgn(dm).padStart(5)}  ${sgn(dc).padStart(5)}${marca}`);
  }
  console.log(`\nTOTAL     ${tA.matched}/${tA.comparable} (${pct(tA.matched, tA.comparable)})  →  ` +
    `${tH.matched}/${tH.comparable} (${pct(tH.matched, tH.comparable)})   Δm=${sgn(tH.matched - tA.matched)}  Δc=${sgn(tH.comparable - tA.comparable)}`);
  console.log(`partes que se MUEVEN: ${movidas}/${partes.length} · partes que BAJAN en matched: ${bajan}`);
  console.log(`anclas   ✓ ${tA.aR}→${tH.aR}  ✗ ${tA.aM}→${tH.aM}  ? ${tA.aA}→${tH.aA}`);
  console.log(`combates atascados  ${tA.atascados}→${tH.atascados} · rondas ${tA.combatRounds}→${tH.combatRounds} · esperas de pacer ${tA.esperasPacer}→${tH.esperasPacer}`);
  console.log(`deltas de ledger    ${tA.ldV}✓/${tA.ldR}✗  →  ${tH.ldV}✓/${tH.ldR}✗`);
}

main();
