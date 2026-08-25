/**
 * HORNEADO de los momentos legendarios (decisión #3 del spec: en build, no en el navegador).
 *
 * Uso:
 *   node --import tsx demo-byo/momentos/hornea.mjs             # catálogo → public/momentos/
 *   node --import tsx demo-byo/momentos/hornea.mjs --comprueba # no escribe; exit 1 si difiere
 *   node --import tsx demo-byo/momentos/hornea.mjs --gam <dir> # + los bytes, a <dir>
 *
 * ── DOS SALIDAS, Y LA SEGUNDA NO SE PUBLICA ─────────────────────────────────────────────
 *
 * 1. **EL CATÁLOGO** (`demo-byo/public/momentos/momentos.json`) — id, acto, títulos y líneas
 *    de ambientación en los dos idiomas, lugar, miniatura y si ya está disponible. Es dato
 *    NUESTRO al cien por cien: ni un byte de EA. Va al sitio.
 *
 *    🔴 Y se COMMITEA generado, no se escribe a mano. `--comprueba` es el predicado de PUNTO
 *    FIJO que corre `re/tools/test_byo_momentos.py`: si alguien edita el JSON del sitio en
 *    vez de `defs.ts`, se pone rojo. Sin eso, «el catálogo sale de los defs» sería una
 *    afirmación sobre la primera vez que se generó — y el árbol tiene el precedente medido
 *    de un generador que su propia salida commiteada revertía.
 *
 * 2. **LOS BYTES** (`momento-NN.gam`, 4192 B, + `momento-NN.sidecar.json`) — SÓLO con `--gam
 *    <dir>`, y ese directorio es temporal: es lo que el arnés de verificación deserializa
 *    para aseverar sobre el save HORNEADO y no sobre el def (spec §Verificación).
 *
 *    🔴 NO VAN AL SITIO NI A UN FICHERO TRACKED, y no es una omisión: para hornearlos hace
 *    falta `game/assets/{init.gam,initial-state.json}`, que son la extracción de `INIT.GAM`
 *    de EA (por eso `game/assets/` está gitignored entero). Los 4192 B que salen llevan
 *    dentro el roster de 16 registros —nombres, stats, equipo— y los inventarios de
 *    arranque: material de EA, que CLAUDE.md REGLA 4 prohíbe en ficheros tracked. En el
 *    navegador esos mismos bytes se componen contra la copia DEL VISITANTE
 *    (`momentos/compone.ts`), que es de donde tienen que salir.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MOMENTOS } from "../../game/src/momentos/defs.js";
import { horneaMomento } from "../../game/src/momentos/compone.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOGO = join(RAIZ, "demo-byo", "public", "momentos", "momentos.json");

/**
 * El catálogo: el def MENOS el parche de estado.
 *
 * `disponible` es DERIVADO de que exista el parche, no un campo suelto que alguien pueda
 * dejar a `true` sobre un momento sin estado — eso pintaría un botón que no siembra nada.
 */
function catalogo() {
  return MOMENTOS.map((m) => ({
    id: m.id,
    acto: m.acto,
    titulo: m.titulo,
    ambiente: m.ambiente,
    lugar: m.lugar,
    miniatura: m.miniatura,
    disponible: m.estado !== undefined,
  }));
}

/** Texto exacto que se commitea: dos espacios y salto final, para que el diff sea legible. */
function textoCatalogo() {
  return JSON.stringify(catalogo(), null, 2) + "\n";
}

const args = process.argv.slice(2);
const comprueba = args.includes("--comprueba");
const iGam = args.indexOf("--gam");
const dirGam = iGam >= 0 ? args[iGam + 1] : null;

// ── 1 · catálogo ────────────────────────────────────────────────────────────────────────
const esperado = textoCatalogo();
if (comprueba) {
  let actual = null;
  try {
    actual = readFileSync(CATALOGO, "utf8");
  } catch {
    console.error(`FALTA el catálogo horneado: ${CATALOGO}`);
    process.exit(1);
  }
  if (actual !== esperado) {
    console.error(
      "El catálogo commiteado NO es el punto fijo de `defs.ts`.\n" +
        "Regenéralo:  node --import tsx demo-byo/momentos/hornea.mjs",
    );
    process.exit(1);
  }
  console.log(`catálogo OK (punto fijo, ${MOMENTOS.length} momentos)`);
} else {
  mkdirSync(dirname(CATALOGO), { recursive: true });
  writeFileSync(CATALOGO, esperado);
  console.log(`catálogo → ${CATALOGO} (${MOMENTOS.length} momentos)`);
}

// ── 2 · los bytes (sólo con --gam, y a un directorio temporal) ──────────────────────────
if (dirGam) {
  // 🔴 GUARDA: el destino tiene que estar FUERA del repo, y no es celo — al escribir este
  // script apunté `--gam .claude/momentos-horneados` «porque es temporal», y `.claude/` NO
  // está gitignored: los 4192 B con el roster de EA aparecieron en `git status` listos para
  // colarse en el siguiente `git add -A`. El aviso vivía en la cabecera de este mismo
  // fichero y no me paró. Ahora para el script.
  if (resolve(dirGam).startsWith(RAIZ + "/")) {
    console.error(
      `--gam apunta DENTRO del repo (${resolve(dirGam)}).\n` +
        "Esos 4192 B llevan el roster extraído de INIT.GAM de EA: material que CLAUDE.md\n" +
        "REGLA 4 prohíbe en ficheros tracked. Usa un directorio temporal del sistema.",
    );
    process.exit(1);
  }
  const assets = join(RAIZ, "game", "assets");
  const init = JSON.parse(readFileSync(join(assets, "initial-state.json"), "utf8"));
  const plantilla = new Uint8Array(readFileSync(join(assets, "init.gam")));
  mkdirSync(dirGam, { recursive: true });
  let n = 0;
  for (const def of MOMENTOS) {
    if (!def.estado) continue; // «próximamente»: no hay qué hornear
    const { gam, sidecar } = horneaMomento(def, init, plantilla);
    writeFileSync(join(dirGam, `${def.id}.gam`), gam);
    writeFileSync(join(dirGam, `${def.id}.sidecar.json`), JSON.stringify(sidecar));
    n++;
    console.log(`${def.id}: ${gam.length} B → ${dirGam}`);
  }
  console.log(`${n} momento(s) horneado(s).`);
}
