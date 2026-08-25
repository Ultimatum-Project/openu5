#!/usr/bin/env node
// A/B DE DOS CENSOS DE ANCLAS — carril `ad06-teclas`, ficha #12.
//
//   node re/tools/compara_censos_anclas.mjs <dirANTES> <dirDESPUES>
//
// Pone los dos cubos lado a lado Y nombra los CAMBIOS DE VEREDICTO ancla por ancla, que es lo
// que un total no puede dar: dos cubos idénticos pueden esconder una que mejoró y otra que
// empeoró. Además compara los CINCO SELLOS por su `ledgerDelta`, porque el arreglo podría pagar
// el sello roto y romper otro — y ese es justo el riesgo que un censo de anclas no ve.
//
// 🔴 Los dos dirs tienen que venir del MISMO árbol salvo por lo que se estudia. Si el `antes` se
// midió sobre otro `main`, el delta lleva dentro todo lo que main movió en medio.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const RE = /^CENSO-ANCLA match=(\S+) cmd=(\S+) intento=(\d+) pedido=(\S+) vivo=(\S+) veredicto=(\S+)$/;
const SELLOS = {
  "ad06-g34": ["ad06", 220],
  "ad09-g04": ["ad09", -274],
  "ad21-g26": ["ad21", -1024],
  "part04-g03": ["part04", 36],
  "part05-g05": ["part05", -954],
};

/**
 * Última verificación de CADA ancla, indexada por `parte/segmento/#orden/match`.
 *
 * 🔴 EL ORDINAL NO ES DECORACIÓN. La primera versión de esto indexaba por
 * `parte/segmento/match` y un `Map` se comía las repeticiones: un segmento puede resincronizar
 * DOS VECES contra el mismo `shop:X`, y sólo sobrevivía la última. Daba 60 anclas y 2 verdes
 * falsos donde `censo_anclas.mjs` da 72 y 5 — el MISMO modo de fallo del denominador que la
 * ficha acaba de documentar, y el control de identidad (dir contra sí mismo) salía impecable
 * porque un instrumento sesgado es consistente consigo mismo. Lo que lo cazó fue cuadrar contra
 * la cifra ya publicada. [[cardinal-cuadra-no-discrimina-la-fuente]]
 */
function censa(root) {
  const porAncla = new Map();
  const cubos = { OK: 0, "VERDE-FALSO": 0, MISS: 0, "SIN-TIPO": 0 };
  let partes = 0;
  for (const e of readdirSync(root)) {
    const p = join(root, e);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) {
      if (!f.endsWith(".report.json")) continue;
      partes++;
      const r = JSON.parse(readFileSync(join(p, f), "utf8"));
      for (const seg of r.segments ?? []) {
        let actual = null;
        let orden = 0;
        const cierra = () => {
          if (!actual) return;
          porAncla.set(`${r.part}/${seg.id}/#${orden++}/${actual.match}`, actual);
          actual = null;
        };
        for (const l of seg.resyncs ?? []) {
          if (l.startsWith("NPC-RESYNC") || l.startsWith("NPC-ANCHOR-MISS")) {
            cierra();
            continue;
          }
          const m = RE.exec(l);
          if (!m) continue;
          actual = { parte: r.part, seg: seg.id, match: m[1], cmd: m[2], pedido: m[4], vivo: m[5], veredicto: m[6] };
        }
        cierra();
      }
    }
  }
  for (const a of porAncla.values()) cubos[a.veredicto] = (cubos[a.veredicto] ?? 0) + 1;
  return { porAncla, cubos, partes };
}

function sellos(root) {
  const out = {};
  for (const [seg, [parte, esp]] of Object.entries(SELLOS)) {
    const f = join(root, parte, `${parte}.report.json`);
    if (!existsSync(f)) { out[seg] = { esp, got: null, match: null, falta: true }; continue; }
    const s = (JSON.parse(readFileSync(f, "utf8")).segments ?? []).find((x) => x.id === seg);
    out[seg] = s?.ledgerDelta
      ? { esp, got: s.ledgerDelta.got, match: s.ledgerDelta.match, matched: s.matched }
      : { esp, got: null, match: null, ausente: true };
  }
  return out;
}

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error("uso: node re/tools/compara_censos_anclas.mjs <dirANTES> <dirDESPUES>");
  process.exit(2);
}
const A = censa(dirA);
const B = censa(dirB);

const fila = (n, a, b) => `  ${n.padEnd(12)} ${String(a).padStart(4)} → ${String(b).padStart(4)}   ${b - a >= 0 ? "+" : ""}${b - a}`;
console.log(`partes con report:   ${A.partes} → ${B.partes}`);
console.log(`anclas censadas:     ${A.porAncla.size} → ${B.porAncla.size}`);
for (const k of ["OK", "VERDE-FALSO", "MISS", "SIN-TIPO"]) console.log(fila(k, A.cubos[k] ?? 0, B.cubos[k] ?? 0));

// ★★ Los CAMBIOS, nombrados. Un total quieto no prueba una población quieta.
const claves = new Set([...A.porAncla.keys(), ...B.porAncla.keys()]);
const cambios = [];
for (const k of claves) {
  const a = A.porAncla.get(k);
  const b = B.porAncla.get(k);
  const va = a?.veredicto ?? "AUSENTE";
  const vb = b?.veredicto ?? "AUSENTE";
  if (va !== vb) cambios.push({ k, va, vb, pedido: (a ?? b).pedido, vivoA: a?.vivo ?? "-", vivoB: b?.vivo ?? "-" });
}
console.log(`\nANCLAS QUE CAMBIARON DE VEREDICTO: ${cambios.length}`);
for (const c of cambios.sort((x, y) => x.k.localeCompare(y.k))) {
  console.log(`  ${c.k.padEnd(34)} ${c.va.padEnd(11)} → ${c.vb.padEnd(11)} (pidió ${c.pedido}; vivo ${c.vivoA} → ${c.vivoB})`);
}

const SA = sellos(dirA);
const SB = sellos(dirB);
console.log(`\nLOS CINCO SELLOS (ledgerDelta del propio censo):`);
for (const seg of Object.keys(SELLOS)) {
  const a = SA[seg];
  const b = SB[seg];
  const marca = a.match === b.match ? (b.match ? "=  paga" : "=  sigue sin pagar") : b.match ? "★ PASA A PAGAR" : "🔴 DEJA DE PAGAR";
  console.log(`  ${seg.padEnd(11)} esperado ${String(a.esp).padStart(6)}   got ${String(a.got).padStart(6)} → ${String(b.got).padStart(6)}   ${marca}`);
}
