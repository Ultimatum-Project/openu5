/**
 * MEDICIÓN OFFLINE del fix del VERBO DE TRANSPORTE contra el material congelado del espejo.
 *
 * ⚠ QUÉ MIDE ESTO EXACTAMENTE, Y POR QUÉ NO ES UN RE-RUN. Los transcripts de `.espejo-lp1/`
 * son la salida del port SELLADA el 26-07 — de un port que todavía no imprimía el verbo. El
 * fix cambia LA SALIDA DEL PORT, no el comparador, así que medirlo de verdad exigiría volver a
 * correr el replay (playwright), y este carril lo tiene PROHIBIDO. Regenerar los transcripts
 * tampoco: son derivados sellados.
 *
 * Así que se mide un **TECHO**, declarado como tal: para cada bloque del LP que es un eco de
 * movimiento CON VERBO, se INYECTA en el transcript de su segmento la línea que el port
 * arreglado emitiría («Fly North»), y se vuelve a diffear. Es la hipótesis MÁS GENEROSA
 * posible —el port en el vehículo correcto, con el rumbo correcto, tantas veces como el LP— así
 * que el número que sale es un LÍMITE SUPERIOR: lo que el fix podría recuperar si la deriva no
 * existiera. Lo que NO casa ni con la línea ideal inyectada está bloqueado por OTRA cosa (la
 * corrupción del OCR tardío), y eso es justo lo que interesa saber.
 *
 * Se reporta también la CONTAMINACIÓN: bloques que NO son ecos de verbo y que cambian de
 * veredicto por la inyección. Si fuese >0, el techo estaría inflado por casados espurios.
 *
 *   npx tsx game/e2e/espejo-tour/tools/medir-verbo-transporte.ts [--dir .espejo-lp1] [parts…]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR } from "../runner";
import { LP1_PROFILE, type OcrProfile } from "../ocr-profile";
import { moveShape } from "./censo-mecanismo-3f";

/**
 * BRAZO DIAGNÓSTICO — **NO se usa en la suite ni se propone aterrizar**. Es `LP1_PROFILE` con
 * las clases de glifo que el censo de 3f midió en el corpus TARDÍO (v/y→u, g→s, c→o, 6→o: la
 * misma familia que motivó `AD_PROFILE`). Existe sólo para contestar UNA pregunta del reporte:
 * cuando el eco del port ya trae el verbo, ¿lo que sigue bloqueando el casado es la caligrafía
 * del OCR? Plegar glifos SUBE el numerador ⇒ no es monótono ⇒ es una palanca con su propia
 * pre-registración pendiente, y por eso aquí va etiquetado como diagnóstico y aparte.
 */
const DIAG_LATE_PROFILE: OcrProfile = {
  ...LP1_PROFILE,
  id: "lp1-diag-tardio",
  glyphClasses: [
    { chars: "6c", to: "o" },
    { chars: "vy", to: "u" },
    { chars: "g", to: "s" },
  ],
};

/** Rumbo canónico del port (DATA.OVL DS 0x29DB…): la forma que el port EMITE. */
const DIR_WORD: Record<string, string> = { north: "North", south: "South", east: "East", west: "West" };
/** Verbo canónico por clase (transport_face 0x00DA). `head` es de la fragata y ya existía. */
const VERB_WORD: Record<string, string> = { ride: "Ride", fly: "Fly", row: "Row", head: "Head" };

interface Tally { verbo: number; recuperados: number; siguenDiv: number }
const zero = (): Tally => ({ verbo: 0, recuperados: 0, siguenDiv: 0 });

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();

  const total = zero();
  const diag = zero(); // brazo DIAGNÓSTICO (perfil con las clases del corpus tardío)
  const porVerbo = new Map<string, Tally>();
  const porCtx = new Map<string, Tally>(); // ★ reparto POR CONTEXTO (overworld vs pueblo):
  // las dos rutinas del verbo difieren en el barco, así que el delta hay que verlo separado.
  let contaminacion = 0;
  console.log("parte     ecos-con-verbo  recuperados(TECHO)  siguen divergentes");
  for (const part of list) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) continue;
    const route = loadRoute(part, ROUTES_DIR);
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    const p = zero();
    for (const seg of route.segments) {
      if (seg.skip != null) continue;
      const lines = tr[seg.id];
      if (!lines) continue;
      const base = diffSegment(seg, lines, LP1_PROFILE);

      // Líneas IDEALES que el port arreglado emitiría, una por eco-con-verbo del LP.
      const inject: string[] = [];
      const esVerbo = new Map<number, string>();
      for (const e of seg.expect) {
        const mv = moveShape(e.text);
        if (!mv || !mv.verb) continue;
        const v = VERB_WORD[mv.verb];
        const d = DIR_WORD[mv.dir];
        if (!v || !d) continue;
        esVerbo.set(e.ocrLn, mv.verb);
        inject.push(`${v} ${d}`);
      }
      if (inject.length === 0) continue;
      const late = diffSegment(seg, [...lines, ...inject], LP1_PROFILE);
      // brazo DIAGNÓSTICO: misma inyección, comparador que sí pliega la firma del OCR tardío
      const dBase = diffSegment(seg, lines, DIAG_LATE_PROFILE);
      const dLate = diffSegment(seg, [...lines, ...inject], DIAG_LATE_PROFILE);
      for (let i = 0; i < dBase.blocks.length; i++) {
        if (!esVerbo.has(dBase.blocks[i]!.ocrLn)) continue;
        if (dBase.blocks[i]!.verdict !== "divergent") continue;
        diag.verbo++;
        if (dLate.blocks[i]!.verdict !== "divergent") diag.recuperados++;
        else diag.siguenDiv++;
      }

      for (let i = 0; i < base.blocks.length; i++) {
        const b = base.blocks[i]!;
        const l = late.blocks[i]!;
        const verbo = esVerbo.get(b.ocrLn);
        if (verbo) {
          if (b.verdict !== "divergent") continue; // ya no era divergente: no es del fix
          p.verbo++;
          const t = porVerbo.get(verbo) ?? zero();
          t.verbo++;
          if (l.verdict !== "divergent") {
            p.recuperados++;
            t.recuperados++;
          } else {
            p.siguenDiv++;
            t.siguenDiv++;
          }
          porVerbo.set(verbo, t);
          const c = porCtx.get(seg.ctx) ?? zero();
          c.verbo++;
          if (l.verdict !== "divergent") c.recuperados++;
          else c.siguenDiv++;
          porCtx.set(seg.ctx, c);
        } else if (b.verdict === "divergent" && l.verdict !== "divergent") {
          contaminacion++; // bloque AJENO que casa por la inyección → techo inflado
        }
      }
    }
    total.verbo += p.verbo;
    total.recuperados += p.recuperados;
    total.siguenDiv += p.siguenDiv;
    if (p.verbo) console.log(`${part}   ${String(p.verbo).padStart(10)}   ${String(p.recuperados).padStart(14)}   ${String(p.siguenDiv).padStart(16)}`);
  }
  const pct = (n: number, d: number): string => (d ? ((n / d) * 100).toFixed(1) + "%" : "—");
  console.log(`\nTOTAL      ${String(total.verbo).padStart(10)}   ${String(total.recuperados).padStart(14)}   ${String(total.siguenDiv).padStart(16)}`);
  console.log(`TECHO del fix sobre los ecos con verbo: ${pct(total.recuperados, total.verbo)}`);
  console.log(`\npor VERBO:`);
  for (const [v, t] of [...porVerbo.entries()].sort((a, b) => b[1].verbo - a[1].verbo))
    console.log(`  ${v.padEnd(5)} ${String(t.verbo).padStart(5)} divergentes → ${String(t.recuperados).padStart(5)} recuperados (${pct(t.recuperados, t.verbo)})`);
  console.log(`\npor CONTEXTO del segmento (ctx de la ruta):`);
  for (const [c, t] of [...porCtx.entries()].sort((a, b) => b[1].verbo - a[1].verbo))
    console.log(`  ${c.padEnd(12)} ${String(t.verbo).padStart(5)} divergentes → ${String(t.recuperados).padStart(5)} recuperados (${pct(t.recuperados, t.verbo)})`);
  console.log(`\nCONTAMINACIÓN (bloques ajenos que casan por la inyección): ${contaminacion}`);
  console.log(
    `\n--- BRAZO DIAGNÓSTICO (perfil con las clases del corpus TARDÍO; NO se propone aterrizar) ---\n` +
      `  ecos con verbo divergentes: ${diag.verbo} → recuperados ${diag.recuperados} (${pct(diag.recuperados, diag.verbo)})\n` +
      `  Contesta: con el verbo YA impreso, ¿cuánto desbloquearía calibrar el OCR del corpus tardío?`,
  );
}

main();
