/**
 * La caché de vite NO puede caer dentro de un `node_modules` que sea SYMLINK.
 *
 * 🔴 POR QUÉ ESTE TEST EXISTE. El aviso llevaba meses escrito en `vite.config.ts` y la
 * variable `U5_VITE_CACHE_DIR` llevaba meses existiendo. No bastó: el 08-08 un carril
 * (yo) lanzó vite sin exportarla y reoptimizó la caché COMPARTIDA con el dev-server del
 * usuario — medido por el `mtime` de `/ultima/node_modules/.vite`, que coincidía al
 * minuto con la corrida. Y `.gitignore` llevaba ya NUEVE cachés de carril distintas: no
 * era un descuido, era el noveno.
 * ★★ Un aviso protege a quien lo lee; un test protege a quien no.
 *
 * Se monta un WORKTREE SIMULADO en un temporal —con `node_modules` apuntando fuera, que
 * es exactamente la topología que crea `git worktree` con la receta del CLAUDE.md— y se
 * mide DÓNDE cae la caché. No se inspecciona el código: se llama a la función.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, symlinkSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { cacheDirAislado } from "../tools/vite-cache-dir.js";

/** Monta `<tmp>/principal/node_modules` real y `<tmp>/arbol` con enlaces al primero. */
function arbolSimulado(enlaza: { raiz: boolean; game: boolean }) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "u5-cache-")));
  const principal = join(base, "principal");
  const arbol = join(base, "arbol");
  mkdirSync(join(principal, "node_modules"), { recursive: true });
  mkdirSync(join(principal, "game", "node_modules"), { recursive: true });
  mkdirSync(join(arbol, "game"), { recursive: true });
  if (enlaza.raiz) symlinkSync(join(principal, "node_modules"), join(arbol, "node_modules"));
  else mkdirSync(join(arbol, "node_modules"), { recursive: true });
  if (enlaza.game) symlinkSync(join(principal, "game", "node_modules"), join(arbol, "game", "node_modules"));
  else mkdirSync(join(arbol, "game", "node_modules"), { recursive: true });
  return { base, arbol, principal };
}

describe("cacheDirAislado", () => {
  it("en un WORKTREE (node_modules symlink) NO cae dentro del enlace", () => {
    const { base, arbol, principal } = arbolSimulado({ raiz: true, game: true });
    try {
      const dir = cacheDirAislado(arbol, {});
      // Lo que de verdad importa: que NO escriba en el árbol principal.
      expect(dir.startsWith(principal + sep)).toBe(false);
      expect(dir).toBe(resolve(arbol, ".vite-cache"));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  // 🔴 Los dos `node_modules` se comprueban por separado porque vite resuelve el suyo
  // contra su ROOT, y este repo se lanza de las dos maneras (`vite` desde la raíz y
  // `vite game`). Con sólo el de la raíz enlazado, el otro camino seguiría escapando.
  it("basta con que escape UNO de los dos node_modules (sólo el de game/)", () => {
    const { base, arbol, principal } = arbolSimulado({ raiz: false, game: true });
    try {
      const dir = cacheDirAislado(arbol, {});
      expect(dir.startsWith(principal + sep)).toBe(false);
      expect(dir).toBe(resolve(arbol, ".vite-cache"));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  // ★★ EL CONTROL: sin este caso, un `cacheDirAislado` que devolviera SIEMPRE
  // `.vite-cache` pasaría los dos asertos de arriba. Aquí se exige que en un checkout
  // normal NO cambie nada — la propiedad es «aísla cuando hace falta», no «aísla».
  it("en un checkout NORMAL conserva el default de vite", () => {
    const { base, arbol } = arbolSimulado({ raiz: false, game: false });
    try {
      expect(cacheDirAislado(arbol, {})).toBe("node_modules/.vite");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("y la variable, cuando está, sigue mandando sobre todo lo demás", () => {
    const { base, arbol } = arbolSimulado({ raiz: true, game: true });
    try {
      expect(cacheDirAislado(arbol, { U5_VITE_CACHE_DIR: "/tmp/propia" })).toBe("/tmp/propia");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
