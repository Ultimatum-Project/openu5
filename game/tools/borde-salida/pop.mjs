/**
 * CIFRA DEL «POP» DEL BORDE DE SALIDA, medida sobre PÍXELES del navegador.
 *
 * Predicado: durante el tween, ninguna celda de PANTALLA puede ENNEGRECERSE de golpe
 * respecto del REPOSO PREVIO (`pre`) más de lo que justifica el deslizamiento. El terreno
 * avanza ≤1 celda en 150 ms, así que entre el reposo y CUALQUIER fotograma del tween la
 * negrura de una celda no puede crecer más de ~1,0 (una celda entera) ni de golpe: lo que
 * delata el defecto es un incremento GRANDE (≥0,5) en una celda del borde TRASERO en el
 * PRIMER fotograma del tween — la columna/fila que debería salir deslizándose iluminada.
 *
 * Emite: por fotograma, el mayor incremento de negrura vs `pre`, con su celda; y el
 * veredicto (peor incremento en el BORDE TRASERO vs el resto).
 */
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const W = 11;
const pre = d.pre;
// Borde TRASERO según la tecla: hacia donde NO se avanza.
const trailing = { ArrowRight: ["col", 0], ArrowLeft: ["col", 10], ArrowDown: ["row", 0], ArrowUp: ["row", 10] }[d.key];
const enBorde = (r, c) => (trailing[0] === "col" ? c === trailing[1] : r === trailing[1]);

console.log(`# ${d.params} tecla=${d.key} ${JSON.stringify(d.posBefore)}→${JSON.stringify(d.posAfter)}`);
if (JSON.stringify(d.posBefore) === JSON.stringify(d.posAfter)) console.log("# ⚠ EL PASO NO OCURRIÓ (bloqueado)");
let peorBorde = { v: 0 };
let peorResto = { v: 0 };
for (const [i, f] of d.grid.entries()) {
  let mx = 0;
  let at = null;
  for (let r = 0; r < W; r++)
    for (let c = 0; c < W; c++) {
      const dv = f[r][c] - pre[r][c];
      if (dv > mx) {
        mx = dv;
        at = [r, c];
      }
      const dest = enBorde(r, c) ? "b" : "o";
      if (dest === "b" && dv > peorBorde.v) peorBorde = { v: dv, i, at: [r, c] };
      if (dest === "o" && dv > peorResto.v) peorResto = { v: dv, i, at: [r, c] };
    }
  console.log(`  f${String(i).padStart(2)} +${String(d.ts[i]).padStart(3)}ms  máx incremento de negrura vs reposo = ${mx.toFixed(3)} en (fila ${at?.[0]}, col ${at?.[1]})`);
}
console.log(`# BORDE TRASERO (${trailing[0]} ${trailing[1]}): peor incremento ${peorBorde.v.toFixed(3)} en f${peorBorde.i} celda ${JSON.stringify(peorBorde.at)}`);
console.log(`# RESTO DEL VIEWPORT      : peor incremento ${peorResto.v.toFixed(3)} en f${peorResto.i} celda ${JSON.stringify(peorResto.at)}`);
