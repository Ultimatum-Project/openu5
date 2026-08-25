/**
 * #261 — LINT: `expect.poll(...).not` no puede probar una AUSENCIA.
 *
 * EL DEFECTO. `expect.poll` reintenta hasta que la aserción PASA. Si la aserción ya es
 * cierta en la primera evaluación, el poll retorna en el acto y no espera nada. Y una
 * aserción de ausencia (`.not.toContain(x)`) es cierta ANTES de que x llegue — así que
 * `await expect.poll(() => texto()).not.toContain("Open it first!")` pasa en la primera
 * vuelta, SIEMPRE, y no mide absolutamente nada sobre si el mensaje aparece después. Es
 * el género «la ausencia NO se prueba con head»: un aserto que no falla porque ha dejado
 * de medir, no porque la conducta sea correcta.
 *
 * ★ POR QUÉ EL LINT NO PUEDE SER «marca todo `.not` tras un poll». Porque acusaría en
 * falso, y hay un caso real en el repo que lo demuestra: `e2e/endgame.spec.ts:89` hace
 * `expect.poll(() => endgamePhase(page)).not.toBeNull()`. Ése es legítimo — la fase
 * arranca en null y el poll ESPERA A QUE LLEGUE. Es una espera de PRESENCIA escrita en
 * negativo, y funciona exactamente como debe.
 *
 * EL DISCRIMINADOR es el matcher, no el `.not`:
 *   · `.not.toBeNull()` / `.not.toBeUndefined()` — ciertas cuando algo APARECE ⇒ el poll
 *     espera de verdad ⇒ LEGÍTIMAS.
 *   · `.not.toContain(x)`, `.not.toBe(x)`, `.not.toEqual(x)`, `.not.toMatch(x)`… —
 *     ciertas MIENTRAS x no está ⇒ el poll sale a la primera ⇒ NO MIDEN.
 *
 * LA FORMA CORRECTA de aserir una ausencia: esperar primero a un ANCLA POSITIVA (que el
 * comando haya resuelto de verdad) y sólo entonces comprobar la ausencia SIN poll, sobre
 * un estado ya asentado. Es lo que hace hoy `objects.spec.ts` tras el arreglo de #261.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Matchers que bajo `.not` son ESPERAS DE PRESENCIA (el poll sí aguarda). */
const ESPERAS_DE_PRESENCIA = ["toBeNull", "toBeUndefined"];

/**
 * Borra comentarios conservando la NUMERACIÓN de líneas (los sustituye por espacios).
 *
 * Hace falta, y lo descubrió el propio lint acusándose a sí mismo: el comentario que
 * explica el arreglo en `objects.spec.ts` CITA el patrón malo, y un barrido sobre texto
 * crudo lo cuenta como infracción. Un lint que no puede describir el defecto que caza
 * obliga a escribir la explicación fuera del sitio donde sirve.
 */
function sinComentarios(src: string): string {
  let out = "";
  let i = 0;
  let modo: "codigo" | "linea" | "bloque" | "'" | '"' | "`" = "codigo";
  while (i < src.length) {
    const c = src[i]!;
    const par = src.slice(i, i + 2);
    if (modo === "codigo") {
      if (par === "//") { modo = "linea"; out += "  "; i += 2; continue; }
      if (par === "/*") { modo = "bloque"; out += "  "; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") modo = c;
      out += c; i++; continue;
    }
    if (modo === "linea") {
      if (c === "\n") { modo = "codigo"; out += c; } else out += " ";
      i++; continue;
    }
    if (modo === "bloque") {
      if (par === "*/") { modo = "codigo"; out += "  "; i += 2; continue; }
      out += c === "\n" ? c : " "; i++; continue;
    }
    // dentro de una cadena: respeta escapes y cierra con su misma comilla
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    if (c === modo) modo = "codigo";
    out += c; i++;
  }
  return out;
}

/**
 * Encuentra `expect.poll(...)` seguido —quizá tras opciones y saltos de línea— de `.not`,
 * y devuelve el matcher que va detrás del `.not`.
 */
function pollsNegados(fuente: string): { linea: number; matcher: string; texto: string }[] {
  const src = sinComentarios(fuente);
  const out: { linea: number; matcher: string; texto: string }[] = [];
  const re = /expect\s*\.\s*poll\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // Recorre desde el `(` equilibrando paréntesis para hallar el final de la llamada.
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
    const cola = src.slice(i, i + 200);
    const neg = /^\s*\.\s*not\s*\.\s*([A-Za-z]+)/.exec(cola);
    if (!neg) continue;
    out.push({
      linea: src.slice(0, m.index).split("\n").length,
      matcher: neg[1]!,
      texto: src.slice(m.index, i + 60).replace(/\s+/g, " ").slice(0, 120),
    });
  }
  return out;
}

/** `.not` que NO son espera de presencia ⇒ pasan a la primera ⇒ no miden. */
const infractores = (src: string) =>
  pollsNegados(src).filter((p) => !ESPERAS_DE_PRESENCIA.includes(p.matcher));

function specsE2E(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) specsE2E(p, acc);
    else if (e.endsWith(".spec.ts")) acc.push(p);
  }
  return acc;
}

describe("#261 — lint: expect.poll(...).not no prueba ausencias", () => {
  // ── CALIBRACIÓN. Sin esto el lint podría estar midiendo cualquier cosa: hay que verlo
  //    ACUSAR el caso malo y ABSOLVER el bueno, y los dos son casos REALES del repo.
  it("CONTROL POSITIVO: acusa el `.not.toContain` de una ausencia", () => {
    const malo = `await expect.poll(() => consoleText(page)).not.toContain("Open it first!");`;
    expect(infractores(malo).map((p) => p.matcher)).toEqual(["toContain"]);
  });

  it("CONTROL NEGATIVO: ABSUELVE el `.not.toBeNull` (espera de presencia)", () => {
    const bueno = `await expect.poll(() => endgamePhase(page), { timeout: 10_000 }).not.toBeNull();`;
    expect(pollsNegados(bueno).map((p) => p.matcher)).toEqual(["toBeNull"]); // lo VE…
    expect(infractores(bueno)).toEqual([]); //                                 …y no lo acusa
  });

  it("CONTROL: un poll POSITIVO normal no entra en la población", () => {
    const normal = `await expect.poll(() => cmdScroll(page)).toBeGreaterThan(8);`;
    expect(pollsNegados(normal)).toEqual([]);
  });

  it("CONTROL: un comentario que CITA el patrón malo no es una infracción", () => {
    // Lo descubrió el lint acusándose a sí mismo: sin esto, explicar el defecto donde se
    // arregló lo vuelve a marcar, y la explicación tiene que emigrar lejos del código.
    const citado = `// esto era expect.poll(() => t(page)).not.toContain("x") y no medía nada
      await expect.poll(() => t(page)).toBe(false);`;
    expect(infractores(citado)).toEqual([]);
    const enBloque = `/* expect.poll(() => t(p)).not.toContain("x") */ await foo();`;
    expect(infractores(enBloque)).toEqual([]);
  });

  it("CONTROL: el lint no se despista con opciones ni saltos de línea", () => {
    const partido = `await expect
      .poll(() => consoleText(page), { message: "x", timeout: 15_000 })
      .not.toEqual("");`;
    expect(infractores(partido).map((p) => p.matcher)).toEqual(["toEqual"]);
  });

  // ── EL BARRIDO sobre el corpus vivo.
  it("ningún spec e2e afirma una ausencia con un poll negado", () => {
    const specs = specsE2E(new URL("../e2e", import.meta.url).pathname);
    // Control de POBLACIÓN: si el barrido no encuentra specs, el verde sería del
    // instrumento vacío, no del corpus (familia «vaciar la entrada»).
    expect(specs.length, "el barrido tiene que ver specs").toBeGreaterThan(50);

    const hallazgos = specs.flatMap((f) =>
      infractores(readFileSync(f, "utf8")).map((p) => `${f.split("/e2e/")[1]}:${p.linea} → .not.${p.matcher}() — ${p.texto}`),
    );
    expect(hallazgos, "usa un ANCLA POSITIVA y luego comprueba la ausencia SIN poll").toEqual([]);
  });
});
