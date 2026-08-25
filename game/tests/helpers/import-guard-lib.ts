/**
 * Helpers del guard de separación core↔piel (tests/skin-import-guard.test.ts),
 * extraídos a módulo propio para poder DEMOSTRAR los cierres G7/ARQ-7 sobre un
 * árbol SINTÉTICO (tests/skin-import-guard-synthetic.test.ts) sin re-registrar
 * los describe del guard real. Parametrizados por raíz (`srcRoot`).
 */
import { dirname, join, relative, resolve as resolvePath, sep } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

/**
 * Ficheros de skin/ que SÍ pueden leer el core en runtime: son el puente.
 * Por RUTA RELATIVA COMPLETA a src/ (G7 vía 2 / ARQ-7: la exención por basename
 * dejaba exento cualquier futuro `skin/<sub>/coreview.ts`).
 */
export const CORE_ADAPTERS = new Set(["skin/coreview.ts"]);

/**
 * METADATOS LÓGICOS del core que la Regla C ya sanciona para render/ (tiles/time:
 * constantes de tile y reloj, sin estado de juego). Una cadena TRANSITIVA de piel
 * que termina aquí (p.ej. piel → render/tileanim → core/tiles) es el acople que
 * el guard de render/ permite explícitamente — no una evasión de la Regla B.
 * Los imports DIRECTOS de piel al core siguen siendo estrictos (sólo type).
 */
export const CORE_METADATA_OK = new Set(["core/tiles.ts", "core/time.ts"]);

export interface ImportRef {
  spec: string;
  typeOnly: boolean;
}

/** Lista recursiva de .ts bajo `dir` (ignora .test.ts y __parity__ de snapshots). */
export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__parity__" || name === "node_modules") continue;
      out.push(...walk(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extrae los imports/exports-from de un fichero. `typeOnly` = `import type …`
 * (no genera código, es sólo un tipo). Cubre imports estáticos, re-exports y
 * `import()` dinámicos — con string, template SIN sustituciones (G7 vía 3), y
 * detecta como OPACO el dinámico con `${…}`/argumento no-literal.
 */
export function importsOf(file: string): { refs: ImportRef[]; opaqueDynamic: string[] } {
  const src = readFileSync(file, "utf8");
  const refs: ImportRef[] = [];
  const opaqueDynamic: string[] = [];
  // import … from "spec"   /   export … from "spec"
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\bfrom\s*["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const keywordType = Boolean(m[2]); // `import type { … } from`
    const clause = m[3] ?? "";
    // Import de runtime salvo que sea `import type` o TODOS los binders lleven `type `.
    const bareBinders = clause
      .replace(/[{}]/g, " ")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allInlineType =
      bareBinders.length > 0 && bareBinders.every((b) => /^type\s/.test(b));
    refs.push({ spec: m[4]!, typeOnly: keywordType || allInlineType });
  }
  // import("spec") dinámico → siempre runtime. Comillas o backtick SIN `${`.
  const dyn = /\bimport\s*\(\s*(["'`])([^"'`]*)\1\s*\)/g;
  while ((m = dyn.exec(src)) !== null) {
    const spec = m[2]!;
    if (spec.includes("${")) opaqueDynamic.push(spec);
    else refs.push({ spec, typeOnly: false });
  }
  // import(<no-literal>) dinámico: template con sustituciones, variable, concat…
  // No podemos saber adónde apunta → se reporta como OPACO (G7 vía 3).
  const dynAny = /\bimport\s*\(\s*([^)]*)\)/g;
  while ((m = dynAny.exec(src)) !== null) {
    const arg = (m[1] ?? "").trim();
    const isLiteral = /^(["'`])[^"'`]*\1$/.test(arg) && !arg.includes("${");
    if (!isLiteral && arg.length > 0) opaqueDynamic.push(arg);
  }
  return { refs, opaqueDynamic };
}

/** ¿El specifier resuelto apunta dentro del segmento `seg/` del árbol de src? */
export function pointsTo(spec: string, seg: string): boolean {
  // Sólo imports relativos internos (los de paquete no tocan nuestro árbol).
  if (!spec.startsWith(".")) return false;
  const parts = spec.split("/");
  return parts.includes(seg);
}

/** Resuelve un spec RELATIVO (`./x.js`, `../core/y.js`) al .ts real, o null. */
export function resolveSpec(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null; // paquete externo: fuera del árbol
  const base = resolvePath(dirname(fromFile), spec);
  const candidates = [
    base.replace(/\.js$/, ".ts"),
    base + ".ts",
    join(base, "index.ts"),
    base, // ya es .ts explícito
  ];
  for (const c of candidates) {
    if (c.endsWith(".ts") && existsSync(c)) return c;
  }
  return null;
}

export function relTo(srcRoot: string, file: string): string {
  return relative(srcRoot, file).split(sep).join("/");
}

export interface SkinViolation {
  file: string;
  detail: string;
}

/**
 * Regla B ENDURECIDA (G7 vía 1): para cada fichero de skin/ (salvo el adaptador),
 * sigue el CIERRE TRANSITIVO de sus imports de RUNTIME (los type-only no generan
 * código y no se siguen). Si la cadena alcanza un fichero bajo core/ → violación,
 * reportando la CADENA completa. El adaptador corta la traversal (es el puente
 * sancionado). Un import dinámico OPACO en la cadena → violación (conservador).
 */
export function skinRuleBViolations(srcRoot: string): SkinViolation[] {
  const skinDir = join(srcRoot, "skin");
  const coreDir = join(srcRoot, "core");
  const violations: SkinViolation[] = [];
  const skinFiles = walk(skinDir);
  for (const start of skinFiles) {
    if (CORE_ADAPTERS.has(relTo(srcRoot, start))) continue; // el adaptador ES el puente
    // BFS sobre imports de runtime, guardando la cadena de llegada.
    const chainOf = new Map<string, string[]>([[start, [relTo(srcRoot, start)]]]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift()!;
      const chain = chainOf.get(file)!;
      const { refs, opaqueDynamic } = importsOf(file);
      for (const spec of opaqueDynamic) {
        violations.push({
          file: relTo(srcRoot, start),
          detail: `${chain.join(" → ")} → import(dinámico OPACO: ${spec}) — no analizable, prohibido en piel`,
        });
      }
      for (const { spec, typeOnly } of refs) {
        if (typeOnly) continue;
        const target = resolveSpec(file, spec);
        if (!target) continue; // paquete externo o no resoluble estáticamente
        const relTarget = relTo(srcRoot, target);
        if (CORE_ADAPTERS.has(relTarget)) continue; // puente sancionado: corta aquí
        const inCore = !relative(coreDir, target).startsWith("..");
        if (inCore) {
          // Import DIRECTO desde la piel (chain de 1): estricto, como siempre.
          // Alcance TRANSITIVO: los metadatos tiles/time sancionados por la
          // Regla C (vía render/) no son violación; el resto del core sí.
          const direct = chain.length === 1;
          if (direct || !CORE_METADATA_OK.has(relTarget)) {
            violations.push({
              file: relTo(srcRoot, start),
              detail: `${chain.join(" → ")} → "${spec}" (runtime alcanza ${relTarget})`,
            });
          }
          continue;
        }
        if (!chainOf.has(target)) {
          chainOf.set(target, [...chain, relTarget]);
          queue.push(target);
        }
      }
    }
  }
  return violations;
}

