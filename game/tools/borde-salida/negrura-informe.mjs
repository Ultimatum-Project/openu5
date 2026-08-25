/** Informe legible del perfil de negrura: por fotograma, mapa 11×11 en décimas, y el
 *  SALTO máximo por celda entre fotogramas consecutivos (la cifra que nombra el «pop»). */
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const g = d.grid;
const W = 11;
const ch = (v) => (v <= 0.02 ? "." : v >= 0.98 ? "#" : String(Math.round(v * 9)));
console.log(`# ${d.params} tecla=${d.key} ${JSON.stringify(d.posBefore)}→${JSON.stringify(d.posAfter)}`);
for (const [i, f] of g.entries()) {
  console.log(`\nf${i} +${d.ts[i]}ms`);
  for (const row of f) console.log("  " + row.map(ch).join(""));
}
console.log("\n# asentado (t=1, +500ms)");
for (const row of d.settled) console.log("  " + row.map(ch).join(""));
console.log("\n# SALTO máximo de negrura por celda entre fotogramas consecutivos");
let worst = { v: 0 };
for (let i = 1; i < g.length; i++) {
  let mx = 0;
  let at = null;
  for (let r = 0; r < W; r++)
    for (let c = 0; c < W; c++) {
      const dv = g[i][r][c] - g[i - 1][r][c];
      if (Math.abs(dv) > Math.abs(mx)) {
        mx = dv;
        at = [r, c];
      }
    }
  console.log(`  f${i - 1}→f${i} (+${d.ts[i]}ms)  Δ=${mx.toFixed(3)} en celda (fila ${at?.[0]}, col ${at?.[1]})`);
  if (Math.abs(mx) > Math.abs(worst.v)) worst = { v: mx, i, at };
}
console.log(`# PEOR: Δ=${worst.v?.toFixed?.(3)} en f${worst.i} celda ${JSON.stringify(worst.at)}`);
