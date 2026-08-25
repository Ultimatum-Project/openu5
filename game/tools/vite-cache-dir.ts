/**
 * DÓNDE PONE VITE SU CACHÉ, decidido por el sistema y no por la memoria de cada carril.
 *
 * ── EL DAÑO QUE EVITA ───────────────────────────────────────────────────────────────
 * Vite resuelve `cacheDir` por defecto a `node_modules/.vite` **relativo a su root**. En
 * este repo el trabajo va en WORKTREES (CLAUDE.md REGLA 2) y allí `node_modules` es un
 * SYMLINK al checkout principal — los dos, el de la raíz y el de `game/`. Así que ese
 * default escribe en la caché COMPARTIDA con el dev-server del usuario (:5199), y
 * reoptimizarla puede tumbarlo.
 *
 * ── POR QUÉ NO BASTA CON `U5_VITE_CACHE_DIR` ────────────────────────────────────────
 * 🔴 Esa variable ya existía y el aviso ya estaba escrito doce líneas más abajo en el
 * config. No funcionó: el 08-08 la olvidé y reescribí la caché compartida (medido:
 * `mtime` de `/ultima/node_modules/.vite` = el minuto exacto de mi corrida). Y no fui
 * el primero — `.gitignore` lleva **NUEVE** cachés de carril distintas
 * (`game/.vite-mobile-e2e/`, `game/.vite-portrait/`, `.vite-espejo/`, …), o sea nueve
 * carriles que tropezaron con lo mismo y lo parchearon cada uno por su cuenta. Nueve
 * instancias no son nueve descuidos: son un DEFECTO DE DISEÑO.
 * ★★ Una regla que hay que recordar en cada uso se convierte, con suficientes usos, en
 *    una regla que se incumple. Lo que aguanta es que el sistema no permita el error.
 *
 * La variable SIGUE mandando cuando está puesta (los carriles que ya la exportan no se
 * enteran de este cambio); lo que cambia es qué pasa cuando NO está.
 */
import { realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Devuelve el `cacheDir` que debe usar vite.
 *
 * @param arbol raíz del árbol de trabajo (el directorio que contiene `game/`).
 *              Se inyecta para poder MEDIR esto con un worktree simulado; en producción
 *              lo calcula `cacheDirDeEsteArbol()`.
 * @param env   entorno, inyectable por la misma razón.
 */
export function cacheDirAislado(arbol: string, env: NodeJS.ProcessEnv = process.env): string {
  if (env.U5_VITE_CACHE_DIR) return env.U5_VITE_CACHE_DIR;

  // Los DOS `node_modules` que vite podría resolver según con qué root se le lance
  // (raíz del árbol, o `game/` cuando se lanza `vite game`). Basta con que UNO escape.
  for (const nm of [resolve(arbol, "node_modules"), resolve(arbol, "game", "node_modules")]) {
    let real: string;
    try {
      real = realpathSync(nm);
    } catch {
      continue; // no existe ⇒ por aquí no se puede escapar
    }
    // `startsWith(arbol + sep)` y no `startsWith(arbol)`: la ruta del checkout principal
    // es PREFIJO de la del worktree (`…/ultima` vs `…/ultima/.claude/worktrees/x`), así
    // que sin el separador un prefijo casual pasaría por «está dentro».
    if (!(real + sep).startsWith(realpathSync(arbol) + sep)) {
      return resolve(arbol, ".vite-cache");
    }
  }
  return "node_modules/.vite"; // checkout normal: el default de siempre
}

/** El del árbol donde vive este fichero. `game/tools/…` ⇒ dos niveles arriba. */
export function cacheDirDeEsteArbol(env: NodeJS.ProcessEnv = process.env): string {
  return cacheDirAislado(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), env);
}
