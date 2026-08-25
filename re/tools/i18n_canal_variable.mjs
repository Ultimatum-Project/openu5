#!/usr/bin/env node
/**
 * #287 — el canal «lo que llega a `t()` por VARIABLE», barrido por AST.
 *
 * POR QUÉ POR AST Y NO POR REGEX. La ficha previa (`re/notes/i18n-barrido-287.md` §2) dejó
 * DESCARTADO POR ESCRITO el método de regex sobre el texto fuente, con sus tres defectos
 * medidos y la cifra que produjeron: 27 → 10 → 5 «ausentes» sin que el repositorio cambiara,
 * y los 22 que se cayeron eran del instrumento —comentarios tragados, raíz sin filtrar y
 * (el peor) casar sólo la comilla DOBLE, que partía por la mitad las cadenas escritas con
 * comilla simple—. Un barrido nuevo con la misma técnica repetiría los mismos tres.
 *
 * El parser de TypeScript no tiene ninguno de los tres: los comentarios son trivia, la raíz
 * es un símbolo y una cadena es un nodo con su valor ya des-escapado, sea cual sea la comilla.
 *
 * QUÉ MIDE. Las llamadas `t(x)` / `tf(x, …)` cuyo primer argumento **no es un literal de
 * cadena** — el canal que §3 de aquella ficha declaró que NO veía. Para cada una resuelve el
 * identificador dentro de su fichero y clasifica:
 *
 *   RESUELTA   — el identificador es un `const` con valor literal, o con un conjunto CERRADO
 *                de literales (unión de asignaciones / miembros de un objeto o array). Cada
 *                valor se cruza contra `es.json`.
 *   PARAMETRO  — viene de fuera de la función: el conjunto de valores NO es local y este
 *                barrido no lo puede cerrar. Se declara, no se cuenta como fuga.
 *   COMPUESTA  — plantilla con interpolación o concatenación: no hay clave fija.
 *
 * LO QUE **NO** HACE, declarado: no sigue imports (un `const` importado de otro módulo sale
 * PARAMETRO), no evalúa llamadas a funciones, y no dice que una clave ausente sea una fuga —
 * la regla de §4 de la ficha previa es que una cadena que un barrido declara ausente **se va
 * a buscar a su fichero antes de tocarla**, y eso lo hace una persona, no esto.
 *
 * CONTROLES (se corren siempre, antes del informe):
 *   · POSITIVO   — un fichero sintético con `const K = "cadena-que-no-existe"; t(K)` tiene que
 *                  salir RESUELTA y AUSENTE. Sin esto, un informe de cero ausencias no vale.
 *   · NEGATIVO   — el mismo con una clave que SÍ está en `es.json` no sale como ausente.
 *   · CORPUS     — `es.json` se lee y tiene entradas; un corpus vacío haría «todo ausente».
 *   · COMILLAS   — control del defecto (c) ya medido: una cadena con comilla SIMPLE que
 *                  contiene comillas DOBLES se lee ENTERA.
 */
import fs from "node:fs";
import { huella } from "../../game/tools/i18n-huella.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "game", "src");
const ES = path.join(SRC, "i18n", "es.json");

const SINKS = new Set(["t", "tf"]);

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "__parity__") walkFiles(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Literales de cadena alcanzables desde `node`, o null si no es un conjunto cerrado. */
function literalsOf(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return null; // COMPUESTA
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return null;
  if (ts.isConditionalExpression(node)) {
    const a = literalsOf(node.whenTrue), b = literalsOf(node.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return literalsOf(node.expression);
  if (ts.isObjectLiteralExpression(node)) {
    const vals = [];
    for (const pr of node.properties) {
      if (!ts.isPropertyAssignment(pr)) return null;
      const v = literalsOf(pr.initializer);
      if (!v) return null;
      vals.push(...v);
    }
    return vals;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const vals = [];
    for (const el of node.elements) {
      const v = literalsOf(el);
      if (!v) return null;
      vals.push(...v);
    }
    return vals;
  }
  return null;
}

/** Declaraciones `const NAME = …` del fichero, por nombre. */
function constMap(sf) {
  const m = new Map();
  const visit = (n) => {
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) m.set(d.name.text, d.initializer);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return m;
}

function analyse(files) {
  const rows = [];
  for (const f of files) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
    const consts = constMap(sf);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && SINKS.has(n.expression.text)) {
        const arg = n.arguments[0];
        if (arg && !ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          const row = { file: path.relative(ROOT, f), line: line + 1, sink: n.expression.text };
          let vals = literalsOf(arg);
          if (!vals && ts.isIdentifier(arg)) vals = literalsOf(consts.get(arg.text));
          if (!vals && ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
            const obj = consts.get(arg.expression.text);
            if (obj && ts.isObjectLiteralExpression(obj)) {
              for (const pr of obj.properties) {
                if (ts.isPropertyAssignment(pr) && pr.name.getText(sf).replace(/['"]/g, "") === arg.name.text) {
                  vals = literalsOf(pr.initializer);
                }
              }
            }
          }
          row.expr = arg.getText(sf).slice(0, 60);
          if (vals) { row.clase = "RESUELTA"; row.valores = vals; }
          else if (ts.isTemplateExpression(arg) || ts.isBinaryExpression(arg)) row.clase = "COMPUESTA";
          else row.clase = "PARAMETRO";
          rows.push(row);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return rows;
}

function controles(corpus) {
  const tmp = fs.mkdtempSync(path.join(ROOT, ".i18n-ctrl-"));
  // 🔴 #380: `Object.keys(corpus)[0]` ya NO sirve como testigo «presente». Las claves
  // son HUELLAS, así que devolvería una cadena opaca que se escribiría en el fichero de
  // control como si fuese texto del juego: el barrido la resolvería, la buscaría en el
  // corpus por su propio hash y el control NEGATIVO pasaría midiendo otra cosa. El
  // testigo tiene que ser INGLÉS de verdad; se reusa el mismo fijo que el control de
  // corpus de abajo, por el mismo motivo que aquél dejó de usar `keys[0]`.
  const presente = "Arms";
  const comillaSimple = 'dice "hola" y sigue';
  fs.writeFileSync(path.join(tmp, "c.ts"),
    `const AUSENTE = "cadena-que-no-existe-en-el-corpus-287";\n` +
    `const PRESENTE = ${JSON.stringify(presente)};\n` +
    `const COMILLAS = '${comillaSimple}';\n` +
    `t(AUSENTE); t(PRESENTE); t(COMILLAS);\n`);
  const rows = analyse([path.join(tmp, "c.ts")]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const val = (n) => (rows.find((r) => r.expr === n) || {}).valores || [];
  return {
    positivo: val("AUSENTE")[0] === "cadena-que-no-existe-en-el-corpus-287"
              && !(huella(val("AUSENTE")[0]) in corpus),
    negativo: val("PRESENTE")[0] === presente && huella(presente) in corpus,
    comillas: val("COMILLAS")[0] === comillaSimple,
    // Testigo FIJO, no `Object.keys(corpus)[0]`: con la raíz equivocada aquél devolvía
    // "meta", que también «está en el corpus», y el control pasaba en verde.
    corpus: Object.keys(corpus).length > 100 && huella("Arms") in corpus,
  };
}

// ★ El corpus es `es.json.strings`, NO la raíz. La raíz tiene DOS claves (`meta` y
// `strings`) y compararse contra ella declara AUSENTE absolutamente todo. Pasó en la
// primera corrida de este barrido: 35 «ausentes» que eran el 100% de lo resuelto.
// Por eso el control de corpus de abajo no pregunta «¿tiene entradas?» —la raíz tenía
// dos y pasaba— sino «¿está dentro una clave que SABEMOS que existe?».
const esJson = JSON.parse(fs.readFileSync(ES, "utf8"));
const corpus = esJson.strings ?? esJson;
const c = controles(corpus);
console.log("=".repeat(78));
console.log("CONTROLES");
console.log("=".repeat(78));
console.log(`  CORPUS    es.json.strings con el testigo fijo "Arms" dentro: ${c.corpus ? "OK" : "FALLA"}  (${Object.keys(corpus).length} claves)`);
console.log(`  POSITIVO  const con cadena inexistente sale RESUELTA y AUSENTE: ${c.positivo ? "OK" : "FALLA"}`);
console.log(`  NEGATIVO  const con clave presente NO sale como ausente: ${c.negativo ? "OK" : "FALLA"}`);
console.log(`  COMILLAS  cadena en comilla SIMPLE con comillas DOBLES dentro, leída ENTERA: ${c.comillas ? "OK" : "FALLA"}`);
const verdes = c.corpus && c.positivo && c.negativo && c.comillas;
if (!verdes) { console.error("\nControles en rojo: el informe NO vale."); process.exit(1); }

const rows = analyse(walkFiles(SRC));
const por = (k) => rows.filter((r) => r.clase === k);
console.log("\n" + "=".repeat(78));
console.log(`CANAL VARIABLE — ${rows.length} llamadas a t()/tf() con primer argumento NO literal`);
console.log("=".repeat(78));
for (const k of ["RESUELTA", "PARAMETRO", "COMPUESTA"]) console.log(`  ${k.padEnd(10)} ${por(k).length}`);

const ausentes = [];
for (const r of por("RESUELTA")) for (const v of r.valores) if (!(v in corpus)) ausentes.push({ ...r, valor: v });
console.log(`\n  valores distintos resueltos: ${new Set(por("RESUELTA").flatMap((r) => r.valores)).size}`);
console.log(`  SIN ENTRADA en es.json: ${ausentes.length}`);
for (const a of ausentes) console.log(`    ${a.file}:${a.line}  ${a.sink}(${a.expr})  →  ${JSON.stringify(a.valor)}`);

console.log("\n  PARAMETRO (conjunto no cerrable en el fichero — cota declarada, NO fugas):");
for (const r of por("PARAMETRO")) console.log(`    ${r.file}:${r.line}  ${r.sink}(${r.expr})`);
console.log("\n  COMPUESTA (plantilla/concatenación — no hay clave fija):");
for (const r of por("COMPUESTA")) console.log(`    ${r.file}:${r.line}  ${r.sink}(${r.expr})`);
console.log("\nUna clave ausente NO es una fuga hasta que alguien la busca en su fichero (§4 de i18n-barrido-287.md).");
