/**
 * EL REPARTO — ¿cuántos de los cinco sellos son BILLETES DE LOTERÍA?
 *
 *   node re/tools/loteria_reparto.mjs <baseDirDeBrazos> [--json]
 *
 * Lee los dirs de brazo que deja `corre_loteria.sh` (`<parte>-C0`, `<parte>-k<k>`), y por
 * cada SELLO da su `fragilidad = #{k : got_k ≠ got_C0} / #{k medidos}`, con el testigo del
 * mecanismo al lado. Exit 0 siempre: esto MIDE, no es una puerta (la puerta es
 * `veredicto_sellos.mjs` y no se toca).
 *
 * ── LAS TRES COSAS QUE ESTA HERRAMIENTA COMPRUEBA ANTES DE DAR NINGUNA CIFRA ─────────────
 * Un reparto es una tabla bonita que se cree sola; estas tres son las que impiden publicarla
 * cuando no significa nada:
 *
 *  1. LA ARITMÉTICA DE LA PERTURBACIÓN, CONTRA LOS VALORES QUE DE VERDAD CORRIERON. El hook
 *     replica el LCG dentro de la página (tiene que: `page.evaluate` se serializa y no puede
 *     cerrar sobre nada de node). Un test unitario que duplicara el algoritmo probaría la
 *     COPIA, no lo que corrió. Así que el hook imprime `seed antes → después` y aquí se
 *     re-deriva con el generador de `rng-original.ts` sobre ESOS números: si no cuadra, el
 *     brazo se marca `ARITMÉTICA-MALA` y no entra en ninguna cuenta.
 *  2. QUE EL CONTROL C0 EXISTE. Sin C0 no hay contra qué comparar, y `got_k ≠ got_C0` sería
 *     una comparación contra `undefined` que sale «distinto» siempre — un reparto de 8/8
 *     fabricado por la ausencia del control. [[el-vacio-se-lee-como-exito]] al revés.
 *  3. QUE EL SHA ES EL MISMO EN TODOS LOS BRAZOS DEL SELLO. Los reports llevan `sha`/`dirty`
 *     desde `procedencia()`. Dos brazos de árboles distintos no son un A/B: son dos fotos.
 *     Un `dirty:true` NO invalida —el árbol puede tener el instrumento sin commitear— pero se
 *     dice, porque entonces el sha no identifica lo que se midió.
 *
 * ── Y LO QUE NO HACE ────────────────────────────────────────────────────────────────────
 * No adjudica «robusto» en el sentido de invariante. `0/8` es «no se movió bajo los 8
 * desplazamientos probados». La distinción está en el pre-registro (§6.1) y se imprime.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { testigoDeVariante, aperturaDelFlujo } from "./testigo_variante.mjs";

/** Los cinco sellos, con su parte. Duplicado a propósito de `veredicto_sellos.mjs`: esa
 *  tabla lleva además `roturaConocida`, que aquí NO se quiere — el control de esta ventana
 *  es C0 MEDIDO, no el valor publicado. Mezclarlos haría que el reparto se midiera contra
 *  una constante en vez de contra una corrida. [[test-contra-constante-es-circular]] */
export const SELLOS = {
  "ad06-g34": { parte: "ad06", publicado: 220 },
  "ad09-g04": { parte: "ad09", publicado: -274 },
  "ad21-g26": { parte: "ad21", publicado: -1024 },
  "part04-g03": { parte: "part04", publicado: 36 },
  "part05-g05": { parte: "part05", publicado: -954 },
};

/** Un paso crudo del generador del kernel (calco de `OriginalRng.nextRaw16`). */
function paso(s) {
  let x = (s + 0x9248) & 0xffff;
  x = ((x >>> 3) | (x << 13)) & 0xffff;
  x ^= 0x9248;
  return (x + 0x11) & 0xffff;
}
export function avanza(s, k) {
  let x = s & 0xffff;
  for (let i = 0; i < k; i++) x = paso(x);
  return x;
}

/** Lee un dir de brazo. Devuelve null si no hay report (el brazo no llegó a escribir). */
export function leeBrazo(dir, parte) {
  const rp = join(dir, `${parte}.report.json`);
  if (!existsSync(rp)) return null;
  const rep = JSON.parse(readFileSync(rp, "utf8"));
  const log = existsSync(join(dir, `${parte}.stdout.log`))
    ? readFileSync(join(dir, `${parte}.stdout.log`), "utf8")
    : "";
  // `[ad06] PERTURBA-PARTE k=3 seed 0x1a2b → 0xcafe`
  const m = log.match(/PERTURBA-(PARTE|SEG \S+) k=(-?\d+) seed 0x([0-9a-f]+) → 0x([0-9a-f]+)/);
  const perturba = m
    ? { punto: m[1].startsWith("SEG") ? m[1].slice(4) : "PARTE", k: Number(m[2]),
        antes: parseInt(m[3], 16), despues: parseInt(m[4], 16) }
    : null;
  const tr = existsSync(join(dir, `${parte}.transcript.json`))
    ? JSON.parse(readFileSync(join(dir, `${parte}.transcript.json`), "utf8"))
    : null;
  return { rep, perturba, tr, dir };
}

/** El testigo del MECANISMO, en palabras del arnés y del transcript — no mías. */
export function testigo(brazo, seg) {
  const s = (brazo.rep.segments ?? []).find((x) => x.id === seg);
  const resyncs = s?.resyncs ?? [];
  const lineas = {
    arm: resyncs.find((l) => l.startsWith("LEDGER-ARM")) ?? null,
    delta: resyncs.find((l) => l.startsWith("LEDGER-DELTA")) ?? null,
    shopOpen: resyncs.filter((l) => l.includes("shopOpen✓")).length,
    miss: resyncs.filter((l) => l.startsWith("ANCHOR-MISS") || l.includes("NO enganchó")).length,
  };
  const portLines = brazo.tr?.[seg] ?? null;
  const apertura = portLines ? aperturaDelFlujo(portLines) : null;
  const variante = portLines ? testigoDeVariante(portLines) : null;
  return { ...lineas, apertura: apertura?.estado ?? null, variante: variante?.indice ?? null,
    conformidad: s ? `${s.matched}/${s.comparable}` : null,
    // Huella del transcript del SEGMENTO: dos brazos con la misma huella vivieron el MISMO
    // mundo (ver `trayectorias`).
    huella: portLines ? createHash("sha256").update(JSON.stringify(portLines)).digest("hex").slice(0, 8) : null };
}

/**
 * ★★ EL DENOMINADOR HONESTO — y no es el número de brazos.
 *
 * «0/8» sugiere ocho pruebas independientes. NO LO SON: el estado del generador es una
 * PERMUTACIÓN de 16 bits, así que dos brazos con distinto `k` pueden reabsorberse y acabar
 * viviendo EL MISMO mundo. Medido en esta ventana: con k=1 el stream se re-sincroniza dentro
 * del primer segmento y el transcript sale BYTE-IDÉNTICO al del control.
 *
 * Así que además de contar brazos se cuentan **TRAYECTORIAS REALIZADAS DISTINTAS** = huellas
 * distintas del transcript del segmento sellado. Ése es el número que dice cuántos mundos
 * distintos ha visto de verdad este sello — y es el que hay que publicar al lado del reparto.
 * Si sale 1, el sello NO se ha probado: la perturbación no llegó. [[control-verde-sin-dientes]]
 */
export function trayectorias(brazos) {
  const h = brazos.map((b) => b.testigo?.huella).filter(Boolean);
  return { distintas: new Set(h).size, conHuella: h.length };
}

export function reparto(base) {
  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const filas = [];
  for (const [seg, s] of Object.entries(SELLOS)) {
    const brazos = [];
    for (const d of dirs) {
      const mm = new RegExp(`^${s.parte}-(C0|k(-?\\d+))$`).exec(d);
      if (!mm) continue;
      const b = leeBrazo(join(base, d), s.parte);
      if (!b) { brazos.push({ etiqueta: d, estado: "SIN-REPORT" }); continue; }
      const k = mm[1] === "C0" ? null : Number(mm[2]);
      // (1) aritmética de la perturbación, sobre los números que corrieron
      let estado = "OK";
      if (k === null && b.perturba) estado = "C0-CONTAMINADO"; // C0 no debe traer perturbación
      else if (k !== null && !b.perturba) estado = "SIN-TESTIGO-DE-SEED";
      else if (k !== null && b.perturba.k !== k) estado = "K-DISCREPA";
      else if (k !== null && avanza(b.perturba.antes, k) !== b.perturba.despues) estado = "ARITMETICA-MALA";
      const d0 = (b.rep.ledger?.ledgerDeltas ?? []).find((x) => x.seg === seg);
      brazos.push({ etiqueta: d, k, estado, got: d0 ? d0.got : null, expected: d0 ? d0.expected : null,
        presente: Boolean(d0), sha: b.rep.sha, dirty: b.rep.dirty, when: b.rep.when,
        seed: b.perturba ? { antes: b.perturba.antes, despues: b.perturba.despues, punto: b.perturba.punto } : null,
        testigo: testigo(b, seg) });
    }
    const c0 = brazos.find((x) => x.k === null && x.estado === "OK");
    const ks = brazos.filter((x) => x.k !== null && x.estado === "OK");
    const validos = ks.filter((x) => x.k !== 0);
    const c1 = ks.find((x) => x.k === 0);
    // (2) sin C0 no hay reparto: se dice, no se calcula contra undefined
    let veredicto, fragilidad = null, mueven = [];
    if (!c0) veredicto = "SIN-CONTROL-C0 — no se puede repartir";
    else if (!c1) veredicto = "SIN-CONTROL-C1 (k=0) — el hook no está validado como neutro";
    else if (c1.got !== c0.got) veredicto = `🔴 C1≠C0 (${c0.got} vs ${c1.got}) — EL HOOK PERTURBA: tanda NULA`;
    else if (!validos.length) veredicto = "sin brazos k≥1";
    else {
      mueven = validos.filter((x) => x.got !== c0.got);
      fragilidad = `${mueven.length}/${validos.length}`;
      veredicto = mueven.length ? "BILLETE DE LOTERÍA" : "no se movió (bajo los k probados)";
    }
    // (3) un sello cuyos brazos no son del mismo árbol no es un A/B
    const shas = [...new Set(brazos.filter((b) => b.sha).map((b) => b.sha))];
    const tray = trayectorias(brazos);
    // ★ Un sello con UNA sola trayectoria realizada NO se ha probado, diga lo que diga el
    // reparto: la perturbación se reabsorbió antes de cambiar nada observable.
    if (fragilidad !== null && tray.distintas <= 1) {
      veredicto = `SIN PROBAR — ${tray.distintas} trayectoria(s) realizada(s): la perturbación no cambió NADA en el segmento`;
      fragilidad = null;
    }
    filas.push({ seg, parte: s.parte, publicado: s.publicado, c0: c0 ?? null, c1: c1 ?? null,
      brazos, validos, mueven, fragilidad, veredicto, shas, tray,
      dirty: brazos.some((b) => b.dirty) });
  }
  return filas;
}

function main() {
  const args = process.argv.slice(2);
  const base = args.find((a) => !a.startsWith("--"));
  if (!base) { console.error("uso: node re/tools/loteria_reparto.mjs <baseDirDeBrazos> [--json]"); process.exit(2); }
  const filas = reparto(base);
  if (args.includes("--json")) { console.log(JSON.stringify(filas, null, 2)); return; }

  console.log("\nSELLO         PARTE   PUBLICADO   C0    C1   FRAGILIDAD  TRAYECT  VEREDICTO");
  console.log("──────────────────────────────────────────────────────────────────────────────────────");
  for (const f of filas) {
    const n = (v) => (v === null || v === undefined ? "—" : String(v));
    console.log(
      `${f.seg.padEnd(13)} ${f.parte.padEnd(7)} ${String(f.publicado).padStart(9)} ` +
      `${n(f.c0?.got).padStart(6)} ${n(f.c1?.got).padStart(5)}   ${n(f.fragilidad).padStart(6)}   ` +
      `${String(f.tray.distintas)}/${f.tray.conHuella}`.padStart(6) + `   ${f.veredicto}`,
    );
    if (f.shas.length > 1) console.log(`              🔴 ${f.shas.length} SHAs distintos entre brazos: ${f.shas.map((s) => s.slice(0, 8)).join(" ")} — NO es un A/B`);
    if (f.dirty) console.log(`              ⚠ algún brazo con dirty:true — el sha no identifica lo que se midió`);
    for (const b of f.brazos.sort((a, z) => (a.k ?? -1) - (z.k ?? -1))) {
      const mark = b.k === null ? "C0" : `k=${b.k}`;
      const cambia = f.c0 && b.k !== null && b.estado === "OK" && b.got !== f.c0.got ? " ★MUEVE" : "";
      const t = b.testigo ?? {};
      console.log(
        `                ${mark.padEnd(5)} got=${String(b.got).padStart(6)} ${b.estado === "OK" ? "" : `[${b.estado}] `}` +
        `apertura=${t.apertura ?? "—"} variante=${t.variante ?? "—"} shopOpen=${t.shopOpen ?? "—"} conf=${t.conformidad ?? "—"}${cambia}`,
      );
    }
    console.log("");
  }
  const loterias = filas.filter((f) => f.veredicto === "BILLETE DE LOTERÍA");
  const sinProbar = filas.filter((f) => f.veredicto.startsWith("SIN PROBAR"));
  console.log("──────────────────────────────────────────────────────────────────────────────────────");
  console.log(`REPARTO: ${loterias.length}/5 billetes de lotería${loterias.length ? ` → ${loterias.map((f) => f.seg).join(" ")}` : ""}`);
  if (sinProbar.length) console.log(`🔴 ${sinProbar.length} SIN PROBAR (1 sola trayectoria): ${sinProbar.map((f) => f.seg).join(" ")}`);
  console.log("⚠ «no se movió» NO es «invariante»: es «no se movió bajo los k probados» (pre-registro §6.1).");
  console.log("⚠ TRAYECT = trayectorias realizadas DISTINTAS / brazos con transcript. Es el denominador");
  console.log("  honesto: los brazos NO son independientes — el stream se reabsorbe y varios k viven el");
  console.log("  MISMO mundo. Un sello con 1 trayectoria no está probado, tenga los brazos que tenga.");
}

if (process.argv[1] && process.argv[1].endsWith("loteria_reparto.mjs")) main();
