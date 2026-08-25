/**
 * FASE 3h — LA GUARDA DE COLISIONES, COMO TEST (ratificada así por el lead: test sobre las
 * entradas del manifest, no prosa).
 *
 * QUÉ PROTEGE. `LP1_TARDIO_PROFILE` pliega clases de glifo para poder leer la caligrafía del
 * corpus tardío, y eso **sube el numerador a propósito** (a diferencia de 3f, que era monótona).
 * El riesgo desnudo de esa palanca es que un plegado haga colapsar DOS mensajes distintos del
 * port a la misma forma: a partir de ahí el comparador podría casar un bloque del LP contra una
 * línea que el port dijo en otro momento y por otra razón, y la conformidad dejaría de significar
 * nada. Este test es lo que impide que eso entre por descuido.
 *
 * CORPUS: `game/tests/fixtures/approved-strings.json` — los strings user-facing del core, con
 * cita, que el gate `string-manifest` mantiene cerrados. Es lo que el port PUEDE emitir, que es
 * exactamente contra lo que se casa.
 *
 * ⚠ SE MIDE EN PARES `{a,b}`, NO EN FORMAS. Un plegado RE-TECLEA las formas colapsadas, así que
 * comparar claves haría pasar por «nueva» una colisión preexistente que sólo cambió de nombre
 * («Anything else?» ≡ «Anything else,» ya colisionaban antes de tocar nada). El par de origen es
 * invariante al re-tecleo. Este defecto se cazó al construir la guarda: con la métrica por forma,
 * las 5 clases candidatas salían rechazadas por colisiones que ya existían.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collapseWith, LP1_PROFILE, LP1_TARDIO_PROFILE, type GlyphClass, type OcrProfile } from "../e2e/espejo-tour/ocr-profile";

const APPROVED = join(__dirname, "fixtures", "approved-strings.json");
const strings = Object.keys(JSON.parse(readFileSync(APPROVED, "utf8")) as Record<string, string>);

/** Pares `{a,b}` de strings distintos que colapsan a la misma forma bajo `profile`. */
function pairs(profile: OcrProfile): Set<string> {
  const byForm = new Map<string, string[]>();
  for (const s of strings) {
    const f = collapseWith(s, profile);
    if (f.length === 0) continue; // sin contenido alfanumérico: no casa por sí solo
    const arr = byForm.get(f) ?? [];
    if (!arr.includes(s)) arr.push(s);
    byForm.set(f, arr);
  }
  const out = new Set<string>();
  for (const arr of byForm.values())
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) out.add([arr[i]!, arr[j]!].sort().join(" "));
  return out;
}

const withClasses = (cls: GlyphClass[]): OcrProfile => ({ ...LP1_PROFILE, id: `probe-${cls.map((c) => c.chars).join("")}`, glyphClasses: cls });
const introduced = (p: OcrProfile): string[] => {
  const base = pairs(LP1_PROFILE);
  return [...pairs(p)].filter((k) => !base.has(k));
};

describe("3h · guarda de colisiones sobre el vocabulario del port", () => {
  it("el corpus y su línea base están donde se cree (si no, el test pasaría en vacío)", () => {
    expect(strings.length).toBeGreaterThan(800);
    // 95 pares ya colisionan con el perfil identidad: son preexistentes y NO se le cargan a
    // ninguna clase. Se asierta el orden de magnitud para que un cambio del manifest no vuelva
    // esta guarda silenciosamente laxa.
    expect(pairs(LP1_PROFILE).size).toBeGreaterThan(50);
  });

  it("★ el perfil TARDÍO no introduce NI UNA colisión nueva", () => {
    const nuevas = introduced(LP1_TARDIO_PROFILE);
    expect(nuevas, `pares nuevos: ${nuevas.map((k) => k.split(" ").join(" ≡ ")).join(" | ")}`).toEqual([]);
  });

  it("cada clase aceptada es inocua POR SEPARADO", () => {
    for (const cls of LP1_TARDIO_PROFILE.glyphClasses)
      expect(introduced(withClasses([cls])), `clase ${cls.chars}→${cls.to}`).toEqual([]);
  });

  it("g→s sigue RECHAZADA, y el test dice POR QUÉ (Sold! ≡ gold!)", () => {
    // Es la clase que más conformidad daría (11,6% frente a 2,1% medido) y justamente por eso
    // está fuera: en una tienda, un «Sold!» del LP casaría un «5 gold!» del port. Si alguien la
    // añade al perfil, este test cae con el par delante.
    const nuevas = introduced(withClasses([{ chars: "g", to: "s" }]));
    expect(nuevas.length).toBeGreaterThan(0);
    expect(nuevas.some((k) => k.includes("Sold!") && k.includes("gold!"))).toBe(true);
  });

  it("e→o es inocua SOLA pero LETAL con 6c→o (Cast… ≡ East) — por eso se prueba el CONJUNTO", () => {
    // El caso que justifica probar combinaciones y no sólo clases sueltas: c→o y e→o desembocan
    // las dos en `o`, así que juntas hacen colisionar dos mensajes reales del port.
    const eo: GlyphClass = { chars: "e", to: "o" };
    expect(introduced(withClasses([eo]))).toEqual([]);
    const junto = introduced(withClasses([eo, { chars: "6c", to: "o" }]));
    expect(junto.length).toBeGreaterThan(0);
    expect(junto.some((k) => k.includes("Cast") && k.includes("East"))).toBe(true);
  });
});
