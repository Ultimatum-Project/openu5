/**
 * BANCO DE MEDICIÓN del re-flow vertical — imprime la tabla de área DESDE EL CÓDIGO.
 *
 * Los números del estudio (`docs/portrait-reflow-estudio.md` §5) eran el modelo de un
 * documento. Esto los convierte en SALIDA DEL REPO: usa las MISMAS funciones puras que
 * la piel (`skin/portrait/layout.ts`), así que si la geometría cambia, la tabla cambia.
 *
 *   npx tsx tools/portrait-reflow/tabla-area.ts            # tabla markdown
 *   npx tsx tools/portrait-reflow/tabla-area.ts --json     # JSON para el arnés
 *
 * ÁREA JUGABLE = el visor 11×11 REAL (176×176 px lógicos escalados), no el canvas: es lo
 * que el usuario ve como «área de juego». Con barras del navegador se usa el `innerH`
 * real medido por dispositivo (columna `innerH`), no el alto físico de la pantalla.
 */
import { portraitLayout, reflowBandScale } from "../../src/skin/portrait/layout.js";

interface Device {
  name: string;
  w: number;
  h: number;
  /** `innerHeight` real en el navegador por defecto (barras puestas). */
  innerH: number;
}

/**
 * Parque de dispositivos. `h` = alto de la pantalla CSS (standalone / pantalla completa,
 * que es lo que el manifest ya declara con `display:"fullscreen"`); `innerH` = el alto de
 * viewport que deja el navegador con sus barras (iOS Safari pierde 113-193 px; Chrome
 * Android 112-132). Los `innerH` son los del censo del estudio §5.2.
 */
const DEVICES: Device[] = [
  { name: "iPhone SE", w: 375, h: 667, innerH: 553 },
  { name: "Galaxy S8", w: 360, h: 740, innerH: 608 },
  { name: "iPhone 15", w: 393, h: 852, innerH: 659 },
  { name: "Pixel 7", w: 412, h: 915, innerH: 783 },
  { name: "iPhone 15 Pro Max", w: 430, h: 932, innerH: 739 },
  { name: "iPad mini", w: 744, h: 1133, innerH: 1019 },
  { name: 'iPad Pro 12,9"', w: 1024, h: 1366, innerH: 1210 },
];

/** Alto de la botonera: 326 px = el deck estándar medido; 266 = hoja «Mover» comprimida. */
const DECKS = [326, 266];

interface Row {
  device: string;
  w: number;
  screenH: number;
  chrome: "standalone" | "barras";
  deck: number;
  aspectY: number;
  availH: number;
  kind: string;
  classicArea: number;
  reflowArea: number;
  factor: number;
  bandPitch: number;
  classicPitch: number;
}

function rows(): Row[] {
  const out: Row[] = [];
  for (const d of DEVICES) {
    for (const [chrome, h] of [
      ["standalone", d.h],
      ["barras", d.innerH],
    ] as const) {
      for (const deck of DECKS) {
        for (const a of [1.0, 1.2]) {
          const availH = h - deck;
          const decided = portraitLayout(d.w, availH, a);
          const forced = portraitLayout(d.w, availH, a, { force: "reflow" });
          out.push({
            device: d.name,
            w: d.w,
            screenH: h,
            chrome,
            deck,
            aspectY: a,
            availH,
            kind: decided.kind,
            classicArea: decided.classicPlayableArea,
            reflowArea: forced.playableArea,
            factor:
              decided.classicPlayableArea > 0
                ? forced.playableArea / decided.classicPlayableArea
                : 0,
            bandPitch: reflowBandScale(d.w, availH, a) * 8,
            classicPitch: decided.classicScale * 8,
          });
        }
      }
    }
  }
  return out;
}

function md(all: Row[]): string {
  const lines: string[] = [];
  lines.push("# Área jugable — re-flow vertical vs clásico (salida del código)\n");
  lines.push(
    "Área = visor 11×11 real en px² de pantalla. `×` = re-flow FORZADO / clásico.",
    "`kind` = lo que la piel ELIGE de verdad (si no supera, delega en el clásico).\n",
  );
  for (const chrome of ["standalone", "barras"] as const) {
    for (const a of [1.0, 1.2]) {
      lines.push(
        `\n## ${chrome === "standalone" ? "Instalado / pantalla completa" : "Navegador CON barras"}` +
          ` · aspecto ${a === 1 ? "píxel cuadrado (1,0)" : "4:3 época (1,2)"}\n`,
      );
      lines.push("| dispositivo | deck | clásico px² | re-flow px² | × | elige | pitch log |");
      lines.push("|---|---:|---:|---:|---:|---|---:|");
      for (const r of all.filter((x) => x.chrome === chrome && x.aspectY === a)) {
        lines.push(
          `| ${r.device} ${r.w}×${r.screenH} | ${r.deck} | ${Math.round(r.classicArea).toLocaleString("es")} | ` +
            `${Math.round(r.reflowArea).toLocaleString("es")} | ${r.factor.toFixed(2)}× | ${r.kind} | ` +
            `${r.bandPitch.toFixed(1)} px (hoy ${r.classicPitch.toFixed(1)}) |`,
        );
      }
    }
  }
  const phones = all.filter((r) => !r.device.startsWith("iPad"));
  const winsSA = phones.filter((r) => r.chrome === "standalone" && r.kind === "reflow").length;
  const winsBar = phones.filter((r) => r.chrome === "barras" && r.kind === "reflow").length;
  lines.push(
    `\n## Resumen\n`,
    `- Teléfonos, instalado: el re-flow gana en **${winsSA}/${phones.filter((r) => r.chrome === "standalone").length}** combinaciones.`,
    `- Teléfonos, con barras: gana en **${winsBar}/${phones.filter((r) => r.chrome === "barras").length}**.`,
    `- El resto delega en el clásico: «nunca peor» por construcción.`,
  );
  return lines.join("\n");
}

const all = rows();
console.log(process.argv.includes("--json") ? JSON.stringify(all, null, 2) : md(all));
