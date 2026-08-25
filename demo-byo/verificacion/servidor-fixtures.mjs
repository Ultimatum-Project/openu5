/**
 * SERVIDOR DE FIXTURES para verificar los cinco estados de carga de /byo.
 *
 * Sirve `demo-byo/dist` en `/` y tres carpetas sintéticas en `/fx/<caso>`, que la
 * pantalla consume por su modo de test `?fetchsrc=` (el mismo que usa el smoke E2E).
 *
 *   /fx/completo  → la carpeta entera            ⇒ estados 02 y 05
 *   /fx/faltan    → sin BRIT.DAT/DUNGEON.DAT/CASTLE.TLK ⇒ estado 03
 *   /fx/tamano    → todos, con DUNGEON.CBT 256 B más corto (39.424 → 39.168) ⇒ estado 04
 *
 * Uso (desde la raíz del worktree):
 *   npx vite build demo-byo
 *   PORT=5247 node demo-byo/verificacion/servidor-fixtures.mjs &
 *   PORT=5247 node demo-byo/verificacion/verifica-estados.mjs
 *
 * 🔴 DEPENDE DE MATERIAL DE EA (`original/u5/ultima5`, gitignored): no corre en CI ni en
 * una máquina sin la copia del usuario, y por eso NO está en la batería de aterrizaje.
 * Es una sonda que se corre a mano cuando se toca la pantalla de carga.
 *
 * 🔴 PUERTO PROPIO Y OBLIGATORIO POR VARIABLE (REGLA 3 del CLAUDE.md): jamás el 5199, que
 * es del usuario. El default 5231 puede estar ocupado por otro carril — si lo está, el
 * proceso ABORTA con EADDRINUSE en vez de robarlo, y se elige otro con `PORT=`. Para
 * pararlo, por su PID (`lsof -ti :<puerto>`), nunca por patrón de nombre.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Relativo a ESTE fichero: el script viaja con el repo y funciona en cualquier worktree.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(RAIZ, "demo-byo/dist");
const U5 = join(RAIZ, "original/u5/ultima5");
const PORT = Number(process.env.PORT || 5231);

if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Corre antes:  npx vite build demo-byo`);
  process.exit(1);
}
if (!existsSync(U5)) {
  console.error(
    `No existe ${U5} (material de EA, gitignored).\n` +
      "Esta sonda necesita una copia real de Ultima V; sin ella no se puede verificar nada.",
  );
  process.exit(1);
}

// Mapa real de nombre -> ruta en disco (case-insensitive).
const enDisco = new Map();
for (const f of readdirSync(U5)) enDisco.set(f.toUpperCase(), join(U5, f));

// Tres fixtures. Cada uno: lista de nombres + transformacion opcional de bytes.
//
// 🔴 AQUI HABIA UNA COPIA A MANO DE `REQUIRED_FILES` (28 nombres) Y SE RETIRO EL 07-08.
// Estaba muerta —el fixture usa la carpeta entera— pero era una BOMBA DE RELOJERIA: en
// cuanto la tabla real creció a 31, esa lista quedó rancia dentro del propio instrumento
// que verifica la tabla. Una copia de la fuente de verdad dentro de la sonda no es
// redundancia: es un segundo sitio donde la cifra puede mentir, y encima con pinta de
// respaldo. Si algun dia hace falta el subconjunto exigido, se PARSEA de `pipeline.ts`
// como hace `verifica-estados.mjs`.
//
// La CARPETA ENTERA es lo que suelta un usuario real — y usarla entera es justamente lo
// que descubrió el agujero: un fixture con los 28 exactos moria en `falta QUESTION.DAT`.
const TODOS = [...enDisco.keys()].filter((n) => {
  const st = statSync(enDisco.get(n));
  return st.isFile() && st.size <= 8 * 1024 * 1024;   // `upgrade/` es un DIRECTORIO
});

const FIXTURES = {
  // ESTADO 05: la carpeta completa.
  completo: { names: TODOS, tweak: () => null },
  // ESTADO 03: faltan tres exigidos (BRIT.DAT, DUNGEON.DAT, CASTLE.TLK).
  faltan: {
    names: TODOS.filter((n) => !["BRIT.DAT", "DUNGEON.DAT", "CASTLE.TLK"].includes(n)),
    tweak: () => null,
  },
  // ESTADO 04: estan todos, pero DUNGEON.CBT mide 256 B menos (39.424 -> 39.168).
  tamano: {
    names: TODOS,
    tweak: (name, buf) => (name === "DUNGEON.CBT" ? buf.subarray(0, buf.length - 256) : null),
  },
};

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".map": "application/json" };

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);

  const fx = p.match(/^\/fx\/([a-z]+)(?:\/(.*))?$/);
  if (fx) {
    const conf = FIXTURES[fx[1]];
    if (!conf) { res.writeHead(404).end("fixture?"); return; }
    const resto = fx[2] || "";
    if (resto === "index.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(conf.names));
      return;
    }
    const src = enDisco.get(resto.toUpperCase());
    if (!src || !statSync(src).isFile()) { res.writeHead(404).end("no file"); return; }
    let buf = readFileSync(src);
    const t = conf.tweak(resto.toUpperCase(), buf);
    if (t) buf = t;
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(buf);
    return;
  }

  let file = join(DIST, p === "/" ? "byo.html" : p.replace(/^\//, ""));
  if (p === "/byo") file = join(DIST, "byo.html");
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end("404"); return; }
  res.writeHead(200, { "Content-Type": TIPOS[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`byo-verify en http://localhost:${PORT}/byo`));
