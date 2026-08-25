/**
 * COMPARADOR PAREADO de brazos de la ventana `espejo-conf`.
 *
 *   node re/tools/compara_espejo_brazos.mjs <dirBrazoA> <dirBrazoB> [etiqA] [etiqB]
 *
 * Cada dir es un `ESPEJO_OUT` con `<parte>.report.json` (uno por parte corrida).
 * Compara SÓLO las partes presentes en LOS DOS (pareado estricto: una parte que falta en
 * un brazo no entra en ningún agregado — un agregado sobre poblaciones distintas no es un
 * delta, es [[poblacion-hereda-el-alcance-de-su-medicion]]).
 *
 * Emite tres vistas:
 *   (1) por PARTE: matched/comparable en los dos brazos + delta. El % es derivado y se
 *       muestra, pero el veredicto lo dan numerador y denominador POR SEPARADO.
 *   (2) por CLASE de segmento: las costuras nombradas en `--clase <id,id,...>` se agregan
 *       aparte del resto. Es lo que exige la predicción P3 (la clase «salida de mazmorra a
 *       Britannia» se mide separada de todo lo demás).
 *   (3) SEGMENTOS QUE SE MUEVEN: la lista con nombre de cada segmento cuyo matched o
 *       comparable difiere entre brazos — el material fichable, no una nube.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const pct = (m, c) => (c ? `${((m / c) * 100).toFixed(1)}%` : "—");
const sgn = (n) => (n > 0 ? `+${n}` : String(n));

/**
 * 🔴 GUARDA DE PROCEDENCIA (añadida por la ventana `agregado-23`, con autorización del lead).
 *
 * Los `ESPEJO_OUT` viven en un scratchpad COMPARTIDO entre sesiones de la flota, así que un dir
 * de brazo puede contener reports **de otra ventana y de otro sha**. Le pasó a `agregado-23`: su
 * dir de brazo baseline ya existía con **12 `*.report.json` del día anterior**.
 *
 * Y este comparador NO podía verlo, porque parea por NOMBRE DE PARTE y el nombre casa perfecto.
 * De hecho se cobró un intento en vivo: al pedir el pareado de 10 partes, `ad12` parecía estar
 * en los dos brazos — pero el `ad12` del brazo baseline era el fichero RANCIO, mientras el de
 * verdad aún se estaba corriendo. Sin guarda, ese `ad12` ajeno habría entrado en el agregado.
 *
 * `--desde=<ISO>` es OPCIONAL para no romper a los llamadores existentes, pero cuando se pasa
 * DESCARTA por el campo `when` y NOMBRA lo descartado. Sin la opción, el comportamiento es
 * EXACTAMENTE el histórico ⇒ no cambia ninguna medida ya publicada.
 */
function cargar(dir, desde) {
  if (!existsSync(dir)) throw new Error(`no existe: ${dir}`);
  const out = new Map();
  const descartados = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort()) {
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const parte = basename(f).replace(".report.json", "");
    if (desde) {
      if (!rep.when) { descartados.push(`${parte}(sin campo 'when')`); continue; }
      if (new Date(rep.when) < desde) { descartados.push(`${parte}@${rep.when}`); continue; }
    }
    out.set(parte, rep);
  }
  if (descartados.length) {
    console.log(`⚠ ${dir}: ${descartados.length} report(s) DESCARTADO(S) por ser anteriores a --desde=${desde.toISOString()}:`);
    console.log(`   ${descartados.join(" ")}`);
  }
  return out;
}

function main() {
  const [dirA, dirB, etiqA = "A", etiqB = "B"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const clase = new Set((process.argv.find((a) => a.startsWith("--clase="))?.split("=")[1] ?? "").split(",").filter(Boolean));
  const desdeArg = process.argv.find((a) => a.startsWith("--desde="))?.split("=")[1];
  const desde = desdeArg ? new Date(desdeArg) : null;
  if (desdeArg && Number.isNaN(+desde)) { console.error(`✗ --desde no es una fecha: ${desdeArg}`); process.exit(2); }
  const A = cargar(dirA, desde);
  const B = cargar(dirB, desde);

  const pareadas = [...A.keys()].filter((p) => B.has(p)).sort();
  const soloA = [...A.keys()].filter((p) => !B.has(p));
  const soloB = [...B.keys()].filter((p) => !A.has(p));
  if (soloA.length || soloB.length) {
    console.log(`⚠ FUERA DEL PAREADO — sólo en ${etiqA}: ${soloA.join(" ") || "(ninguna)"} · sólo en ${etiqB}: ${soloB.join(" ") || "(ninguna)"}`);
  }

  // ── (1) por parte
  console.log(`\n### POR PARTE (smallmap) — ${pareadas.length} partes pareadas`);
  console.log(`parte      ${etiqA.padEnd(16)} ${etiqB.padEnd(16)}  Δmatched Δcomparable`);
  let mA = 0, cA = 0, mB = 0, cB = 0;
  const quietas = [];
  for (const p of pareadas) {
    const a = A.get(p), b = B.get(p);
    mA += a.matched; cA += a.comparable; mB += b.matched; cB += b.comparable;
    const dm = b.matched - a.matched, dc = b.comparable - a.comparable;
    if (dm === 0 && dc === 0) quietas.push(p);
    const marca = dm === 0 && dc === 0 ? "" : dm < 0 ? "  ◀ BAJA" : "  ◀";
    console.log(
      `${p.padEnd(9)}  ${`${a.matched}/${a.comparable}`.padEnd(11)}${pct(a.matched, a.comparable).padStart(6)}` +
      `  ${`${b.matched}/${b.comparable}`.padEnd(11)}${pct(b.matched, b.comparable).padStart(6)}` +
      `  ${sgn(dm).padStart(7)} ${sgn(dc).padStart(9)}${marca}`,
    );
  }
  console.log(`${"TOTAL".padEnd(9)}  ${`${mA}/${cA}`.padEnd(11)}${pct(mA, cA).padStart(6)}  ${`${mB}/${cB}`.padEnd(11)}${pct(mB, cB).padStart(6)}  ${sgn(mB - mA).padStart(7)} ${sgn(cB - cA).padStart(9)}`);
  console.log(`partes IDÉNTICAS (matched y comparable): ${quietas.length}/${pareadas.length} — ${quietas.join(" ") || "(ninguna)"}`);

  // ── (2) interiores
  let imA = 0, icA = 0, imB = 0, icB = 0;
  for (const p of pareadas) {
    imA += A.get(p).interior?.matched ?? 0; icA += A.get(p).interior?.comparable ?? 0;
    imB += B.get(p).interior?.matched ?? 0; icB += B.get(p).interior?.comparable ?? 0;
  }
  console.log(`\n### INTERIORES (métrica separada)  ${etiqA}: ${imA}/${icA} ${pct(imA, icA)}  ·  ${etiqB}: ${imB}/${icB} ${pct(imB, icB)}  ·  Δmatched ${sgn(imB - imA)} Δcomparable ${sgn(icB - icA)}`);

  // ── (3) segmentos que se mueven + agregado por clase
  const movidos = [];
  let kmA = 0, kcA = 0, kmB = 0, kcB = 0, rmA = 0, rcA = 0, rmB = 0, rcB = 0;
  for (const p of pareadas) {
    const sa = new Map((A.get(p).segments ?? []).map((s) => [s.id, s]));
    const sb = new Map((B.get(p).segments ?? []).map((s) => [s.id, s]));
    for (const [id, a] of sa) {
      const b = sb.get(id);
      if (!b) { movidos.push({ id, nota: `AUSENTE en ${etiqB}` }); continue; }
      const enClase = clase.has(id);
      if (enClase) { kmA += a.matched; kcA += a.comparable; kmB += b.matched; kcB += b.comparable; }
      else { rmA += a.matched; rcA += a.comparable; rmB += b.matched; rcB += b.comparable; }
      if (a.matched !== b.matched || a.comparable !== b.comparable) {
        movidos.push({ id, clase: enClase, a: `${a.matched}/${a.comparable}`, b: `${b.matched}/${b.comparable}`, dm: b.matched - a.matched, dc: b.comparable - a.comparable });
      }
    }
  }
  if (clase.size) {
    console.log(`\n### POR CLASE — los ${clase.size} segmentos nombrados en --clase`);
    console.log(`  CLASE  ${etiqA}: ${kmA}/${kcA} ${pct(kmA, kcA)}  ·  ${etiqB}: ${kmB}/${kcB} ${pct(kmB, kcB)}  ·  Δmatched ${sgn(kmB - kmA)} Δcomparable ${sgn(kcB - kcA)}`);
    console.log(`  RESTO  ${etiqA}: ${rmA}/${rcA} ${pct(rmA, rcA)}  ·  ${etiqB}: ${rmB}/${rcB} ${pct(rmB, rcB)}  ·  Δmatched ${sgn(rmB - rmA)} Δcomparable ${sgn(rcB - rcA)}`);
    const vistos = [...clase].filter((id) => pareadas.some((p) => (A.get(p).segments ?? []).some((s) => s.id === id)));
    const ausentes = [...clase].filter((id) => !vistos.includes(id));
    if (ausentes.length) console.log(`  ⚠ de la clase, NO aparecen en los reports pareados: ${ausentes.join(" ")}`);
  }

  console.log(`\n### SEGMENTOS QUE SE MUEVEN: ${movidos.length}`);
  for (const m of movidos) {
    if (m.nota) { console.log(`  ${m.id.padEnd(12)} ${m.nota}`); continue; }
    console.log(`  ${m.id.padEnd(12)}${m.clase ? " [CLASE]" : "        "} ${etiqA} ${m.a.padEnd(10)} → ${etiqB} ${m.b.padEnd(10)}  Δm ${sgn(m.dm).padStart(6)}  Δc ${sgn(m.dc).padStart(6)}`);
  }

  // ── salud
  console.log(`\n### SALUD`);
  for (const [etiq, M] of [[etiqA, A], [etiqB, B]]) {
    let miss = 0, res = 0;
    for (const p of pareadas) { miss += M.get(p).anchorsMissed ?? 0; res += M.get(p).anchorsResolved ?? 0; }
    console.log(`  ${etiq}: anclas resueltas ${res} · ANCHOR-MISS ${miss}`);
  }
}

main();
