#!/usr/bin/env node
/**
 * LOS DOS MECANISMOS DE F4-f, DEMOSTRADOS EN 6 LINEAS (ventana `comparador-bandas`, §3 del
 * pre-registro). Se commitea porque son las DOS cifras sobre las que se decidio ROBUSTECER en
 * vez de EXCLUIR, y una cifra sin sonda no es reproducible.
 *
 *   node re/tools/mech_ventana_comparador.mjs
 *
 * (A) `coverageRatio` con teselado GREEDY NO ES MONOTONO en el transcript: anadir texto puede
 *     BAJAR la cobertura, con hay2 superconjunto estricto de hay1.
 * (B) el barrido fuzzy es una REJILLA anclada en el indice 0: su valor depende de la FASE, o sea
 *     de cuantos caracteres haya ANTES del bloque. El barrido exacto es invariante.
 *
 * Las funciones se REPLICAN aqui a proposito (no se importan): la sonda tiene que poder
 * demostrar el defecto del comparador VIEJO aunque el vigente ya no lo tenga.
 */
// ¿Es coverageRatio (tiling GREEDY) monotono en `hay`? ¿Es el fuzzy sensible a la FASE?
function coverageRatio(needle, hay, minTile) {
  if (needle.length === 0) return 1;
  let covered = 0, i = 0;
  while (i < needle.length) {
    let len = 0;
    while (i + len < needle.length && hay.includes(needle.slice(i, i + len + 1))) len++;
    if (len >= minTile) { covered += len; i += len; } else i += 1;
  }
  return covered / needle.length;
}
const bigrams = (s) => { const o=[]; for (let i=0;i+1<s.length;i++) o.push(s.slice(i,i+2)); return o; };
function dice(a,b){ const A=bigrams(a),B=bigrams(b); if(!A.length||!B.length) return 0;
  const m=new Map(); for(const g of B) m.set(g,(m.get(g)||0)+1);
  let inter=0; for(const g of A){const c=m.get(g)||0; if(c>0){inter++;m.set(g,c-1);}}
  return (2*inter)/(A.length+B.length); }
function fuzzyBest(cb, T){ let best=0; const w=Math.max(cb.length,8); const step=Math.max(2,Math.floor(w/6));
  for(let i=0;i+Math.floor(w*0.7)<=T.length;i+=step){const s=dice(cb,T.slice(i,i+w)); if(s>best)best=s;} return best; }
function fuzzyExact(cb, T){ let best=0; const w=Math.max(cb.length,8);
  for(let i=0;i+Math.floor(w*0.7)<=T.length;i+=1){const s=dice(cb,T.slice(i,i+w)); if(s>best)best=s;} return best; }

console.log("=== A) coverageRatio: ¿monotono en hay? ===");
const needle = "ABCDEF";
console.log("needle=ABCDEF minTile=3");
console.log("  hay1='xxABCxxDEFxx'      cov=", coverageRatio(needle,"xxABCxxDEFxx",3));
console.log("  hay2=hay1+'ABCD'         cov=", coverageRatio(needle,"xxABCxxDEFxxABCD",3), " <-- superconjunto de hay1");

console.log("\n=== B) fuzzy: ¿sensible a la FASE de la rejilla? ===");
const cb = "thepocketwatcreads328amandtheskyisclear";   // 38 chars ~ mediana 28 de F4-f
const core = "zzz" + "thepocketwatchreads328amandtheskyisclear" + "zzz";
for (const pad of [0,1,2,3,4,5,6,7]) {
  const T = "q".repeat(pad) + core;
  const g = fuzzyBest(cb,T), e = fuzzyExact(cb,T);
  console.log(`  prefijo ${String(pad).padStart(2)} chars: rejilla=${g.toFixed(4)} (>=0.84? ${g>=0.84}) | exacto=${e.toFixed(4)}`);
}
