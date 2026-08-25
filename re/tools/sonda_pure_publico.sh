#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════════════════
# SONDA DEL ÁRBOL PÚBLICO — corre los CUATRO jobs del CI del repo público sobre el árbol que
# el génesis publicaría DE VERDAD, y enrojece nombrando fichero y ruta.
#
# 🔴 EL DEFECTO QUE LA ORIGINA (medido el 2026-08-25, carril `censo-puro-drift`): la lista de
# exclusiones de `game/vitest.pure.config.ts` se re-censaba A MANO. Entre el 02-08 y el 25-08
# entraron a `main` 49 ficheros de test que leen dato del juego sin pasar por ella, y el CI
# del repo público habría salido rojo con **56 ficheros / 93 tests** (sobre 440/5245) más un
# `tsc --noEmit` rc=2 por un `import … from "../assets/maps/smallmaps.json"` estático. Nadie
# lo vio porque el único instrumento que lo ve —correr `test:pure` en un árbol SIN el
# material— era un gesto manual del runbook (FASE-D §1.4) que se dejó de hacer.
#
# ★★ NO REIMPLEMENTA EL PREDICADO: llama a `docs/publicacion/genesis-publico.sh`, que ES la
#    autoridad sobre qué viaja. Un segundo censo (una lista de rutas «que no viajan» copiada
#    aquí) sería el que un día dice «bien» mientras el génesis dice «mal» — la misma razón
#    por la que `test_genesis_manifiesto.py` comparte código con el génesis en vez de
#    parecerse a él. Coste del génesis completo: 6,6 s medidos. No hay nada que optimizar.
#
# 🔴 LOS DOS PASOS QUE PARECEN DECORADOS Y NO LO SON:
#   (a) `git init` + commit en el destino. El árbol del génesis NO es un repositorio hasta
#       que se le hace; el repo público SÍ lo es desde el primer clon (y `actions/checkout`
#       deja `.git`). Sin este paso, `sellos-puerta` da un rojo 57.º que NO existe en el
#       público —afirma que `procedencia()` devuelve un sha de 40 hex— y quien lea la sonda
#       excluiría un fichero sano. El propio génesis lo dice en su última línea.
#   (b) el `node_modules` por ENTRADAS y no por enlace del directorio. Enlazar
#       `node_modules` entero haría que `node_modules/game -> ../game` resolviese al
#       `game/` del árbol PRIVADO —con `assets/` dentro— y la sonda mediría el árbol
#       equivocado dando VERDE. Se enlaza entrada a entrada y los dos enlaces de workspace
#       se rehacen RELATIVOS dentro del destino.
#
# USO:  bash re/tools/sonda_pure_publico.sh [destino]
#       U5_SONDA_JOBS="tsc,e2e,pure,build"   (subconjunto; por defecto los cuatro)
#       U5_SONDA_CONSERVAR=1                  (no borrar el destino al terminar)
# SALIDA: 0 verde · 1 algún job rojo · 64 no se pudo medir (sin toolchain/rsync/génesis roto)
# ══════════════════════════════════════════════════════════════════════════════════════════
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAIZ="$(cd "$RAIZ/.." && pwd)"
JOBS="${U5_SONDA_JOBS:-tsc,e2e,pure,build}"

quiere() { case ",$JOBS," in *,"$1",*) return 0;; *) return 1;; esac; }

# ── Guardas de entorno: «no se pudo medir» (64) nunca se confunde con «rojo» (1) ──────────
command -v rsync >/dev/null 2>&1 || { echo "SONDA: falta rsync — no se puede montar el árbol. EXIT 64" >&2; exit 64; }
command -v python3 >/dev/null 2>&1 || { echo "SONDA: falta python3 (lo usa el génesis). EXIT 64" >&2; exit 64; }
command -v npx >/dev/null 2>&1 || { echo "SONDA: falta npx. EXIT 64" >&2; exit 64; }
[ -e "$RAIZ/node_modules" ] || { echo "SONDA: falta node_modules de la RAIZ (REGLA 2). EXIT 64" >&2; exit 64; }
[ -f "$RAIZ/docs/publicacion/genesis-publico.sh" ] || { echo "SONDA: no encuentro el génesis. EXIT 64" >&2; exit 64; }

DEST="${1:-}"
if [ -z "$DEST" ]; then
  DEST="$(mktemp -d "${TMPDIR:-/tmp}/u5-sonda-publico.XXXXXX")"
  BORRAR=1
else
  BORRAR=0
fi
[ "${U5_SONDA_CONSERVAR:-0}" = "1" ] && BORRAR=0
limpia() { [ "$BORRAR" = "1" ] && rm -rf "$DEST"; }
trap limpia EXIT

# ── 1. El árbol que el génesis publicaría (autoridad única sobre qué viaja) ───────────────
GEN_LOG="$DEST.genesis.log"
if ! bash "$RAIZ/docs/publicacion/genesis-publico.sh" "$DEST" > "$GEN_LOG" 2>&1; then
  echo "SONDA: el GÉNESIS falló — no hay árbol público que medir (esto NO es un rojo de tests)." >&2
  tail -25 "$GEN_LOG" >&2
  rm -f "$GEN_LOG"
  exit 64
fi
rm -f "$GEN_LOG"

# ── 2. `git init`: ver (a) de la cabecera. Sin esto la sonda inventa un rojo. ─────────────
(
  cd "$DEST" &&
  git init -q -b main &&
  git add -A &&
  git -c user.email=sonda@openu5 -c user.name=sonda commit -qm "sonda: árbol del génesis"
) >/dev/null 2>&1 || { echo "SONDA: no pude inicializar git en el destino. EXIT 64" >&2; exit 64; }

# ── 3. `node_modules` por ENTRADAS: ver (b) de la cabecera. ───────────────────────────────
mkdir -p "$DEST/node_modules"
for e in "$RAIZ"/node_modules/* "$RAIZ"/node_modules/.[!.]*; do
  [ -e "$e" ] || continue
  b="$(basename "$e")"
  case "$b" in game|extractor) continue;; esac
  ln -sfn "$e" "$DEST/node_modules/$b"
done
ln -sfn ../game "$DEST/node_modules/game"
ln -sfn ../extractor "$DEST/node_modules/extractor"
# CONTROL POSITIVO del montaje: si `game/assets` existiera en el destino, la sonda estaría
# midiendo el árbol privado y saldría verde SIN HABER MIRADO NADA — el peor desenlace.
if [ -e "$DEST/game/assets" ]; then
  echo "SONDA: el destino TIENE game/assets — el montaje se coló en el árbol privado. EXIT 64" >&2
  exit 64
fi
if [ ! -d "$DEST/game/src" ] || [ ! -d "$DEST/game/tests" ]; then
  echo "SONDA: el destino no tiene game/{src,tests} — el génesis no copió nada. EXIT 64" >&2
  exit 64
fi

FALLOS=()
corre() { # corre <etiqueta> <cmd...>
  local etq="$1"; shift
  local log; log="$(mktemp)"
  echo "SONDA: [$etq]..."
  if ( cd "$DEST/game" && "$@" ) > "$log" 2>&1; then
    echo "SONDA: [$etq] VERDE"
  else
    FALLOS+=("$etq")
    echo "SONDA: [$etq] ❌ ROJO — el repositorio PÚBLICO no pasaría este job:" >&2
    tail -40 "$log" >&2
  fi
  rm -f "$log"
}

# ── 4. Los CUATRO jobs de `docs/publicacion/ci-nivel1.yml`, en el mismo orden ─────────────
quiere tsc   && corre "tsc (game)"        npx tsc --noEmit
quiere e2e   && corre "tsc (e2e)"         npx tsc --noEmit -p tsconfig.e2e.json
quiere pure  && corre "test:pure"         npx vitest run -c vitest.pure.config.ts
quiere build && corre "build"             npx vite build

if [ "${#FALLOS[@]}" -ne 0 ]; then
  echo "" >&2
  echo "SONDA: ${#FALLOS[@]} job(s) ROJOS en el árbol público: ${FALLOS[*]}" >&2
  echo "  Si es \`test:pure\`, la causa habitual es un test NUEVO que lee dato del juego." >&2
  echo "  Las dos salidas, en este orden (game/vitest.pure.config.ts, MANTENIMIENTO):" >&2
  echo "    1) si el fichero es MAYORITARIAMENTE puro → acota el \`describe\` que lee dato" >&2
  echo "       con \`describeSiViaja\` (game/tests/assets-opcionales.ts) y NO lo excluyas;" >&2
  echo "    2) si su SUJETO es el dato → añádelo a los \`exclude\` de vitest.pure.config.ts" >&2
  echo "       CON SU CAUSA (la ruta exacta que no encuentra), no a bulto." >&2
  exit 1
fi
echo "SONDA: árbol público VERDE en los jobs [$JOBS]."
exit 0
