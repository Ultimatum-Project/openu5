/**
 * DIFF BLOQUE A BLOQUE entre dos brazos del espejo — ventana `agregado-23`.
 *
 *   node re/tools/diff_bloques_espejo.mjs <dirA> <dirH> --desde=<ISO> --partes=ad05,ad10
 *
 * RESPONDE LA PREGUNTA QUE SEPARA LAS TRES HIPÓTESIS del −110 (encargo del lead):
 *   (a) TRAYECTORIA — el port hace otra cosa después del fix ⇒ `match → divergent`
 *   (b) MATERIAL     — el arnés ya no se atasca, ejecuta más guion y EMITE más ⇒ crece el
 *                      material y el ratio puede bajar aunque suba lo casado
 *   (c) DENOMINADOR  — las exclusiones movieron qué cuenta como `comparable` ⇒ los bloques
 *                      cambian de/ a las clases NO comparables (rng, known-gap, ocr-*…)
 *
 * ★ POR QUÉ SE PUEDE HACER ESTE JOIN: cada bloque va indexado por `ocrLn`, la línea del
 * TRANSCRIPT DEL LP — o sea, del CORPUS. Sobre las partes de corpus byte-idéntico el conjunto
 * de `ocrLn` es el MISMO en los dos brazos por construcción, así que un `ocrLn` que aparece o
 * desaparece NO es ruido de emparejamiento: es una diferencia real de lo que el arnés recorrió.
 * (Sobre una parte con el corpus movido este join NO es válido y la herramienta lo AVISA.)
 *
 * CONTABILIDAD, verificada contra los totales del propio report:
 *   matched    = match + fuzzy + covered
 *   comparable = matched + divergent
 *   el resto (rng, combat-rng, known-gap, ocr-ghost, ocr-garbage, ocr-partial, presentacion,
 *   pending) NO es comparable — y es justo donde vive la hipótesis (c).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const MATCHED = new Set(["match", "fuzzy", "covered"]);
const COMPARABLE = new Set([...MATCHED, "divergent"]);
const AUSENTE = "(no existe)";

function cargar(dir, desde) {
  if (!existsSync(dir)) throw new Error(`no existe: ${dir}`);
  const out = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".report.json"))) {
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!rep.when || new Date(rep.when) < desde) continue; // misma guarda de procedencia
    out.set(basename(f).replace(".report.json", ""), rep);
  }
  return out;
}

/** mapa "segId#ocrLn" -> verdict */
function bloques(rep) {
  const m = new Map();
  for (const s of rep.segments ?? []) for (const b of s.blocks ?? []) m.set(`${s.id}#${b.ocrLn}`, b.verdict);
  return m;
}

function clasifica(v) {
  if (v === AUSENTE) return "AUSENTE";
  if (MATCHED.has(v)) return "matched";
  if (v === "divergent") return "divergent";
  return "no-comparable";
}

function main() {
  const args = process.argv.slice(2);
  const [dirA, dirH] = args.filter((a) => !a.startsWith("--"));
  const desde = new Date(args.find((a) => a.startsWith("--desde="))?.split("=")[1] ?? "");
  if (Number.isNaN(+desde)) { console.error("✗ falta --desde=<ISO>"); process.exit(2); }
  const partes = (args.find((a) => a.startsWith("--partes="))?.split("=")[1] ?? "").split(",").filter(Boolean);
  if (!partes.length) { console.error("✗ falta --partes=adNN,adNN"); process.exit(2); }

  const A = cargar(dirA, desde), H = cargar(dirH, desde);
  for (const p of partes) {
    if (!A.has(p) || !H.has(p)) { console.log(`\n⚠ ${p}: falta en un brazo — se salta`); continue; }
    const ba = bloques(A.get(p)), bh = bloques(H.get(p));
    const claves = new Set([...ba.keys(), ...bh.keys()]);

    // (i) ¿el conjunto de ocrLn se mantiene? Si no, o el corpus se movió o el arnés recorrió otro guion.
    const soloA = [...claves].filter((k) => !bh.has(k));
    const soloH = [...claves].filter((k) => !ba.has(k));

    const matriz = new Map();
    for (const k of claves) {
      const va = ba.get(k) ?? AUSENTE, vh = bh.get(k) ?? AUSENTE;
      if (va === vh) continue;
      const key = `${clasifica(va)} → ${clasifica(vh)}`;
      if (!matriz.has(key)) matriz.set(key, []);
      matriz.get(key).push([k, va, vh]);
    }

    const rA = A.get(p), rH = H.get(p);
    console.log(`\n═══════ ${p} · A ${rA.matched}/${rA.comparable} → H ${rH.matched}/${rH.comparable} ` +
      `(Δm=${rH.matched - rA.matched}, Δc=${rH.comparable - rA.comparable}) ═══════`);
    console.log(`bloques totales: A=${ba.size} H=${bh.size}` +
      (soloA.length || soloH.length
        ? `  ⚠ el CONJUNTO de ocrLn cambia: sólo en A=${soloA.length}, sólo en H=${soloH.length}`
        : `  ✓ MISMO conjunto de ocrLn en los dos brazos`));

    console.log(`\n  TRANSICIONES (sólo las que cambian):`);
    const filas = [...matriz].sort((a, b) => b[1].length - a[1].length);
    for (const [k, v] of filas) console.log(`    ${String(v.length).padStart(4)}  ${k}`);
    if (!filas.length) console.log(`    (ninguna — las dos corridas son idénticas bloque a bloque)`);

    // Lectura para las tres hipótesis
    const n = (k) => matriz.get(k)?.length ?? 0;
    const mToD = n("matched → divergent");
    const dToM = n("divergent → matched");
    const mToNC = n("matched → no-comparable") + n("matched → AUSENTE");
    const ncToM = n("no-comparable → matched") + n("AUSENTE → matched");
    console.log(`\n  LECTURA:`);
    console.log(`    (a) TRAYECTORIA  matched→divergent = ${mToD}   (al revés: ${dToM})  neto ${dToM - mToD}`);
    console.log(`    (c) DENOMINADOR  matched→no-comparable/ausente = ${mToNC}   (al revés: ${ncToM})  neto ${ncToM - mToNC}`);
    console.log(`    (b) MATERIAL     bloques nuevos en H = ${soloH.length} · desaparecidos = ${soloA.length}`);
    console.log(`    suma de netos = ${(dToM - mToD) + (ncToM - mToNC)}  ·  Δmatched real = ${rH.matched - rA.matched}` +
      ((dToM - mToD) + (ncToM - mToNC) === rH.matched - rA.matched ? "  ✓ CUADRA" : "  🔴 NO CUADRA"));

    // Los ejemplares con nombre, para que la ficha cite y no describa
    for (const [k, v] of filas.slice(0, 3)) {
      console.log(`\n    ejemplares de «${k}» (5 de ${v.length}):`);
      for (const [clave, va, vh] of v.slice(0, 5)) console.log(`      ${clave}  ${va} → ${vh}`);
    }
  }
}

main();
