/**
 * Demo BYO-files (Fase B de publicación): mini-app standalone que corre el
 * extractor EN el navegador y deja los assets en Cache Storage para que el
 * service worker (public/sw.js) se los sirva al juego. NO toca game/.
 *
 * Build:  npx vite build demo-byo   → demo-byo/dist (byo.html + js + sw.js)
 * Deploy: game/dist (SIN dist/assets) + demo-byo/dist fusionados en la raíz.
 */
import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * SHA corto del árbol que se construye, para que un récord subido diga CON QUÉ VERSIÓN se
 * grabó (`records.ts:versionMotor`). Es uno de los campos que hacen verificable una fila:
 * quien reproduce con otro motor puede diverger con razón, y sin la etiqueta esa divergencia
 * parecería un récord falso.
 *
 * Sin git (un tarball, un contenedor pelado) vale `"dev"`. No se inventa una versión: «dev»
 * dice la verdad y la fila queda marcada como no atribuible a un commit.
 */
function shaDelArbol(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: HERE }).toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  root: HERE,
  cacheDir: path.join(HERE, ".vite"),
  define: { __U5_BUILD__: JSON.stringify(shaDelArbol()) },
  build: {
    outDir: path.join(HERE, "dist"),
    emptyOutDir: true,
    // NO "assets/": ese namespace es del juego y lo intercepta el SW.
    assetsDir: "byo-static",
    rollupOptions: {
      input: {
        byo: path.join(HERE, "byo.html"),
        // Consentimiento de la PORTADA. `home.html` es HTML estático que el
        // ensamblado copia tal cual: no puede seguir un nombre con hash, así que
        // esta entrada se emite con nombre FIJO en la raíz del sitio (ver más
        // abajo). El resto de chunks sigue hasheado en byo-static/.
        consentimiento: path.join(HERE, "src/portada.ts"),
        // Consentimiento de las PÁGINAS DE DOCUMENTACIÓN (/mejoras, /diferencias,
        // /privacidad). MISMO panel, y SIN el `analitica.evento()` de la portada: ver
        // el porqué medido en la cabecera de `src/documentacion.ts`. Nombre fijo por la
        // misma razón que el de arriba — esas páginas las genera un script.
        "consentimiento-doc": path.join(HERE, "src/documentacion.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "consentimiento" || chunk.name === "consentimiento-doc"
            ? `${chunk.name}.js`
            : "byo-static/[name]-[hash].js",
      },
    },
  },
});
