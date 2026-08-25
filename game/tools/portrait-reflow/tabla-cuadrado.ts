/**
 * TABLA DE NÚMEROS de la variante cuadrado — REGENERABLE, no escrita a mano.
 *
 * Lee el `metricas.json` que deja `capturar-cuadrado.ts` y escupe markdown. Existe por una
 * razón de proceso, no de comodidad: la geometría de este carril ha cambiado tres veces en
 * dos días (marco azul, altos originales, reparto invertido) y cada vez los números de los
 * informes anteriores quedaron mintiendo. Con el banco y la tabla encadenados al mismo
 * JSON, «regenerar la tabla» es un comando y no hay forma de que el informe y la captura
 * cuenten cosas distintas.
 *
 *   OUT=<dir del banco> npx tsx tools/portrait-reflow/tabla-cuadrado.ts [--estado mundo]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.OUT ?? "/tmp/portrait-cuadrado";
const argEstado = process.argv.indexOf("--estado");
const ESTADO = argEstado >= 0 ? process.argv[argEstado + 1] : "mundo";

interface Metric {
  device: string;
  deviceId: string;
  orient: "portrait" | "landscape";
  w: number;
  h: number;
  state: string;
  variant: string;
  playArea: number;
  playPct: number;
  squareRatio: number;
  deckPx: number;
  sheetsVis: number;
  sheetsFull: number;
  cmdsVis: number;
  cmdsTotal: number;
}

const M: Metric[] = JSON.parse(readFileSync(join(OUT, "metricas.json"), "utf8"));
const get = (d: string, v: string, s = ESTADO): Metric | undefined =>
  M.find((m) => m.deviceId === d && m.variant === v && m.state === s);
const N = (x: number): string => Math.round(x).toLocaleString("es");

/** Dispositivos en el orden en que se capturaron, por orientación. */
function devices(orient: "portrait" | "landscape"): Metric[] {
  const seen = new Set<string>();
  return M.filter((m) => {
    if (m.orient !== orient || seen.has(m.deviceId)) return false;
    seen.add(m.deviceId);
    return true;
  });
}

const lines: string[] = [];
lines.push(`## Variante CUADRADO — estado \`${ESTADO}\`  ·  ${M.length} capturas`);
lines.push("");
lines.push("### Vertical");
lines.push("");
lines.push(
  "| dispositivo | CSS | canónico visor | CUADRADO visor | × | cuadratura | botonera | " +
    "cmds ★bloques | cmds nativo | cmds columnas |",
);
lines.push("|---|---|---|---|---|---|---|---|---|---|");
for (const d of devices("portrait")) {
  const c = get(d.deviceId, "canonico");
  // El área del mapa es la MISMA en las tres sub-variantes (el reparto invertido la fija
  // por el ancho), así que da igual cuál se lea; se toma la del defecto.
  const q = get(d.deviceId, "cuadrado-bloques") ?? get(d.deviceId, "cuadrado-nativo");
  const col = get(d.deviceId, "cuadrado-bloques");
  const cruz = get(d.deviceId, "cuadrado-columnas");
  const fila = get(d.deviceId, "cuadrado-nativo");
  const cmds = (m?: Metric): string => (m ? `${m.cmdsVis}/${m.cmdsTotal}` : "—");
  if (!c || !q) continue;
  lines.push(
    `| ${d.device} | ${d.w}×${d.h} | ${N(c.playArea)} (${c.playPct.toFixed(1)} %) ` +
      `| ${N(q.playArea)} (${q.playPct.toFixed(1)} %) | ${(q.playArea / c.playArea).toFixed(2)}× ` +
      `| ${q.squareRatio.toFixed(4)} | ${N(q.deckPx)} px ` +
      `| ${cmds(col)} | ${cmds(fila)} | ${cmds(cruz)} |`,
  );
}
lines.push("");
lines.push("### Apaisado");
lines.push("");
lines.push("| dispositivo | CSS | canónico | «banda» (25-07) | CUADRADO | × vs canónico | cuadratura |");
lines.push("|---|---|---|---|---|---|---|");
for (const d of devices("landscape")) {
  const c = get(d.deviceId, "canonico");
  const b = get(d.deviceId, "reflow");
  const q = get(d.deviceId, "cuadrado-bloques") ?? get(d.deviceId, "cuadrado-columnas");
  if (!c || !q) continue;
  lines.push(
    `| ${d.device} | ${d.w}×${d.h} | ${N(c.playArea)} (${c.playPct.toFixed(1)} %) ` +
      `| ${b ? `${N(b.playArea)} (${(b.playArea / c.playArea).toFixed(2)}×)` : "—"} ` +
      `| ${N(q.playArea)} (${q.playPct.toFixed(1)} %) | ${(q.playArea / c.playArea).toFixed(2)}× ` +
      `| ${q.squareRatio.toFixed(4)} |`,
  );
}

// GUARDA DEL INVARIANTE. La tabla no sólo informa: falla si alguna captura dejó de ser
// cuadrada. Un informe que no puede desmentirse a sí mismo no vale de nada.
const noCuadradas = M.filter(
  (m) => m.variant.startsWith("cuadrado") && Math.abs(m.squareRatio - 1) > 0.005,
);
lines.push("");
lines.push(
  noCuadradas.length === 0 ?
    `**Invariante del cuadrado: VERDE** — las ${M.filter((m) => m.variant.startsWith("cuadrado")).length} capturas de la variante dan cuadratura 1,000 ±0,005.`
  : `**Invariante del cuadrado: ROJO** — ${noCuadradas.length} capturas fuera de tolerancia: ` +
      noCuadradas.map((m) => `${m.deviceId}/${m.state}/${m.variant} = ${m.squareRatio.toFixed(3)}`).join(", "),
);

console.log(lines.join("\n"));
if (noCuadradas.length > 0) process.exitCode = 1;
