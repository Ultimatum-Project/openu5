#!/usr/bin/env bash
# CORRIDA AISLADA de UNA parte del espejo en UN brazo (worktree propio, puerto propio).
# Sonda del carril `fichas-f1f2` (acta: re/notes/fichas-f1f2-acta.md). Es el comando exacto
# con el que se adjudicaron F-1 y F-2, commiteado para que las cifras sean reproducibles
# ([[cifra-sin-sonda-commiteada]]).
#
#   bash re/tools/run_brazo_espejo.sh <rutaDelWorktree> <puerto> <parte> <etiqueta>
#
# Ejemplo (brazo B de F-1):
#   bash re/tools/run_brazo_espejo.sh .claude/worktrees/f1f2-armB 5264 ad20 B1
#
# ⚠ UN PUERTO POR BRAZO, y no es cosmético: playwright.espejo.config.ts pone
#   `reuseExistingServer: EXPLICIT_PORT !== undefined`, así que dos brazos con el MISMO
#   U5_E2E_PORT comparten el vite del primero y el segundo mide el código equivocado.
# ⚠ Puertos 5199 (usuario) y 5197 (e2e) INTOCABLES. Usa la banda 52xx.
#
# Deja report + transcript en <worktree>/.espejo-f1f2/<etiqueta>/ (gitignored: `.espejo-*/`).
# NO_EXPORT=1 siempre: los checkpoints de saves/ son TRACKED y una corrida de medición
# jamás los reescribe.
set -uo pipefail

if [ "$#" -ne 4 ]; then
  echo "uso: $0 <rutaDelWorktree> <puerto> <parte> <etiqueta>" >&2
  exit 2
fi
WT=$(cd "$1" && pwd) || exit 2
PORT=$2; PART=$3; TAG=$4
OUT="$WT/.espejo-f1f2/$TAG"
mkdir -p "$OUT"
cd "$WT/game" || exit 2

export U5_VITE_CACHE_DIR="$WT/.vite-espejo"   # caché de vite PROPIA (no pisar la del usuario)
export U5_E2E_PORT="$PORT"
export U5_ESPEJO_CORPUS=ad
export U5_ESPEJO_SOFT=1                        # el espejo sin SOFT falla siempre, por instrumento
export U5_ESPEJO_NO_EXPORT=1                   # no reescribir los checkpoints TRACKED
export ESPEJO_DUMP=1                           # transcript por segmento: sin él la ficha no se adjudica
export U5_ESPEJO_PARTS="$PART"
export ESPEJO_OUT="$OUT"

echo "=== $(basename "$WT") :$PORT $PART tag=$TAG HEAD=$(git -C "$WT" rev-parse --short HEAD)"
npx playwright test -c playwright.espejo.config.ts > "$OUT/$PART.stdout.log" 2>&1
rc=$?
grep -E "conformidad-smallmap|checkpoint NO exportado" "$OUT/$PART.stdout.log" | head -3
echo "rc=$rc → $OUT"

# GUARDA: ningún save tracked puede haberse movido.
dirty=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
if [ "$dirty" != "0" ]; then
  echo "🔴 PARO: la corrida ha tocado $dirty checkpoint(s) TRACKED de saves/ — corrida INVALIDADA" >&2
  exit 3
fi
exit $rc
