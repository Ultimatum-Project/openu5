#!/usr/bin/env bash
# UN BRAZO de la tanda `loteria-sellos` — una parte, una perturbación, un dir de salida.
#
#   bash re/tools/corre_loteria.sh <worktree> <parte> <corpus> <puerto> <dirSalida> [<k>]
#
# `k` ausente  = brazo de CONTROL C0: la variable NO se pone, así que el hook del spec ni
#                siquiera se evalúa y el camino es IDÉNTICO al de main.
# `k` presente = avanza el stream vivo k pasos a la entrada de la parte (k=0 ⇒ control C1:
#                el hook SÍ corre y no avanza nada; es lo que prueba que el hook es neutro).
# `U5_LOTERIA_EN=<segId>` cambia el punto de inyección a la entrada de ESE segmento.
#
# Exit 0 = la parte corrió · 2 = error de uso · 3 = INVALIDADA (movió checkpoints tracked)
#        · 4 = puerto ocupado.  El VEREDICTO no se da aquí: lo da `loteria_reparto.mjs`
#        sobre el conjunto de dirs, porque la pregunta de esta ventana es un REPARTO entre
#        brazos, no «¿los cinco intactos?».
#
# ── POR QUÉ NO SE USA `corre_sellos.sh` TAL CUAL, QUE ES LO QUE HABRÍA HECHO ────────────
# 🔴 Porque cablea `U5_VITE_CACHE_DIR="$WT/.espejo-sellos-vite"`, **una sola ruta para todas
# las corridas del worktree**. Esta ventana son ~50 brazos y sólo cabe en el presupuesto
# corriendo varias partes A LA VEZ; con la caché compartida, dos brazos concurrentes se pisan
# la misma caché de vite. Ése es exactamente el filo que el propio `corre_sellos.sh` documenta
# en su cabecera («la caché compartida que contaminó cuatro partes el 02-08»), y el modo de
# fallo no es un error: son cifras plausibles del árbol equivocado. Aquí la caché se DERIVA
# del dir de salida, así que dos brazos no pueden colisionar ni por descuido.
# Todo lo demás —guarda de puerto, guarda de saves tracked, NO_EXPORT, SOFT, DUMP— se conserva
# porque cada una de esas guardas está pagada con una corrida perdida de otro carril.
set -uo pipefail

if [ "$#" -lt 5 ]; then
  echo "uso: $0 <worktree> <parte> <corpus:ad|lp1> <puerto> <dirSalida> [<k>]" >&2
  exit 2
fi
WT=$(cd "$1" && pwd) || exit 2
PARTE=$2
CORPUS=$3
PORT=$4
OUT=$5
K=${6:-}
mkdir -p "$OUT"

# Guarda de puerto: con `reuseExistingServer` (que el config activa cuando el puerto es
# explícito) un vite ajeno vivo haría que este brazo midiera OTRO árbol y no diera error.
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "🔴 PARO: puerto $PORT ocupado (PID $(lsof -ti :"$PORT" | tr '\n' ' '))" >&2
  exit 4
fi

SAVES_ANTES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
cd "$WT/game" || exit 2

export U5_VITE_CACHE_DIR="$OUT/.vite"      # ← PROPIA de este brazo (ver cabecera)
export U5_E2E_PORT="$PORT"
export U5_ESPEJO_SOFT=1
export U5_ESPEJO_NO_EXPORT=1               # jamás reescribir los checkpoints TRACKED
export ESPEJO_DUMP=1                       # transcript = el testigo del MECANISMO
export ESPEJO_OUT="$OUT"
if [ "$CORPUS" = "ad" ]; then export U5_ESPEJO_CORPUS=ad; else unset U5_ESPEJO_CORPUS; fi
if [ -n "$K" ]; then
  export U5_SELLOS_PERTURBA="$K"
  [ -n "${U5_LOTERIA_EN:-}" ] && export U5_SELLOS_PERTURBA_EN="$U5_LOTERIA_EN"
else
  unset U5_SELLOS_PERTURBA U5_SELLOS_PERTURBA_EN
fi

echo "=== $PARTE corpus=$CORPUS :$PORT k=${K:-<C0 sin variable>} HEAD=$(git -C "$WT" rev-parse --short HEAD)"
# 🔴 `--output` PROPIO por brazo, y no es cosmética: Playwright **LIMPIA su outputDir al
# arrancar**, y sin esto los ~50 brazos de la tanda comparten el `test-results/` por defecto ⇒
# un brazo que arranca borra los artefactos del que está corriendo. Los reports de medida ya
# van a `ESPEJO_OUT`, así que el daño no sería en la cifra sino en el diagnóstico (traces),
# pero la carrera de ficheros es real y gratis de evitar. Misma familia que
# [[playwright-borra-test-results]].
U5_ESPEJO_PARTS="$PARTE" npx playwright test -c playwright.espejo.config.ts \
  --output="$OUT/.pw" > "$OUT/$PARTE.stdout.log" 2>&1
RC=$?
echo "   rc=$RC"

SAVES_DESPUES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
if [ "$SAVES_DESPUES" != "$SAVES_ANTES" ]; then
  echo "🔴 PARO: la corrida movió checkpoints TRACKED ($SAVES_ANTES → $SAVES_DESPUES) — INVALIDADA" >&2
  exit 3
fi
exit 0
