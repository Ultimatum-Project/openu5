#!/usr/bin/env node
// VEREDICTO del censo de anclas de tienda — carril `ad06-teclas`, ficha #12.
//
//   node re/tools/censo_anclas.mjs <dirCenso> [--json]
//
// Lee los reports que produjo `corre_censo_anclas.sh` y reparte TODAS las verificaciones de
// ancla de tienda en tres cubos, leyendo las líneas `CENSO-ANCLA` de `segment.resyncs`:
//
//   OK          la tienda viva es la que el ancla pidió
//   VERDE-FALSO hay una tienda abierta, pero es OTRA  ← el defecto de la ficha #12
//   MISS        no hay ninguna tienda abierta         ← el arnés ya lo declaraba
//
// 🔴 Se cuenta por ANCLA (su ÚLTIMO intento), no por línea: la verificación reintenta una vez,
// y contar los dos intentos inflaría el denominador con reintentos que el arnés ya resolvió.
// El desglose por intento se publica aparte para que la decisión de agregar sea auditable.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const asJson = process.argv.includes("--json");
if (!dir) {
  console.error("uso: node re/tools/censo_anclas.mjs <dirCenso> [--json]");
  process.exit(2);
}

const RE = /^CENSO-ANCLA match=(\S+) cmd=(\S+) intento=(\d+) pedido=(\S+) vivo=(\S+) veredicto=(\S+)$/;

function reports(root) {
  const out = [];
  for (const e of readdirSync(root)) {
    const p = join(root, e);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) if (f.endsWith(".report.json")) out.push(join(p, f));
  }
  return out.sort();
}

const anclas = [];
const ficheros = reports(dir);
for (const f of ficheros) {
  const r = JSON.parse(readFileSync(f, "utf8"));
  for (const seg of r.segments ?? []) {
    // Las líneas de UN ancla son consecutivas dentro del segmento; una nueva `NPC-RESYNC`
    // abre la siguiente. Agrupamos por rachas para no mezclar dos anclas del mismo tipo.
    let actual = null;
    for (const l of seg.resyncs ?? []) {
      if (l.startsWith("NPC-RESYNC") || l.startsWith("NPC-ANCHOR-MISS")) {
        if (actual) anclas.push(actual);
        actual = null;
        continue;
      }
      const m = RE.exec(l);
      if (!m) continue;
      const [, match, cmd, intento, pedido, vivo, veredicto] = m;
      actual = { parte: r.part, seg: seg.id, match, cmd, intento: Number(intento), pedido, vivo, veredicto };
    }
    if (actual) anclas.push(actual);
  }
}

const cubos = { OK: 0, "VERDE-FALSO": 0, MISS: 0 };
for (const a of anclas) cubos[a.veredicto] = (cubos[a.veredicto] ?? 0) + 1;
const falsos = anclas.filter((a) => a.veredicto === "VERDE-FALSO");

if (asJson) {
  console.log(JSON.stringify({ partes: ficheros.length, anclas: anclas.length, cubos, falsos }, null, 1));
  process.exit(0);
}

console.log(`partes con report: ${ficheros.length}`);
console.log(`verificaciones de ancla de tienda censadas (última por ancla): ${anclas.length}`);
console.log(`  OK          ${cubos.OK ?? 0}`);
console.log(`  VERDE-FALSO ${cubos["VERDE-FALSO"] ?? 0}   ← el defecto de la ficha #12`);
console.log(`  MISS        ${cubos.MISS ?? 0}`);
if (falsos.length) {
  console.log(`\nLAS ${falsos.length} EN VERDE FALSO, NOMBRADAS:`);
  for (const a of falsos) {
    console.log(`  ${a.parte.padEnd(7)} ${a.seg.padEnd(11)} pidió ${a.pedido.padEnd(12)} y estaba viva ${a.vivo.padEnd(12)} (cmd=${a.cmd})`);
  }
}
