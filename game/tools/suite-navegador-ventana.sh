#!/usr/bin/env bash
# #177 · LA SUITE DE NAVEGADOR, BAJO EL CERROJO DE LA MÁQUINA.
#
# Uso:  bash tools/suite-navegador-ventana.sh [args de suite-navegador.mjs]   (desde game/)
#
# ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
# `suite-navegador.mjs` corre ~700 pruebas de navegador: es LA MISMA clase de carga que la
# batería, y lo que se disputa no es un puerto ni un worktree — es EL HOST. La batería ya se
# serializa sola con `/tmp/u5-bateria.lock`; esta suite no estaba bajo ese cerrojo, así que
# podía solaparse con una batería y contaminar los timings de las dos.
#
# ⇒ Se adquiere el MISMO cerrojo, con el MISMO protocolo que `re/tools/bateria_aterrizaje.sh`.
# No es un cerrojo nuevo ni paralelo: dos cerrojos para un solo recurso no son exclusión, son
# dos colas que no se ven.
#
# ── EL PROTOCOLO, COPIADO DE LA BATERÍA (no reinventado) ───────────────────────
#   · el cerrojo es un DIRECTORIO — `mkdir` es la operación atómica que decide la carrera;
#     un fichero con `-e` + `touch` tiene ventana entre la comprobación y la escritura.
#   · dentro van `pid` y `donde`, para que el siguiente sepa a quién espera y desde dónde.
#   · SÓLO EL DUEÑO LIBERA: si el cerrojo fue robado, su pid ya no es el nuestro y borrarlo
#     desalojaría a un inocente.
#   · cerrojo RANCIO (pid muerto) se roba — si no, un carril que muere deja la máquina
#     bloqueada para todos hasta que alguien lo mire a mano.
#
# 🔴 LA ADQUISICIÓN ES UNA CARRERA DE `mkdir`, NO UNA FIFO. Quien lleva más esperando no
# tiene preferencia: gana el que llame a `mkdir` en el instante en que el dueño lo suelta.
# Con varias baterías en cola la espera puede ser larga y NO es proporcional al turno. Por eso
# el bucle no tiene tope: aquí no hay «corro igual» como en la batería (ella lo tiene porque
# un aterrizaje bloqueado es peor que uno contaminado; una MEDICIÓN contaminada, en cambio,
# no vale para nada y es justo lo que esta ventana viene a producir).
#
# 🔴 Y EL BUCLE VIVE EN UN SCRIPT, NO EN LA LÍNEA DE ÓRDENES (ficha #45): un `while` con el
# nombre del script en su propio `argv` casa con los censos `pgrep -f` de los demás carriles
# y se cuenta a sí mismo como corrida viva.
set -uo pipefail

CERROJO="${U5_BATERIA_CERROJO:-/tmp/u5-bateria.lock}"
CERROJO_TIC="${U5_BATERIA_CERROJO_TIC:-15}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

liberar() {
  [ -d "$CERROJO" ] && [ "$(cat "$CERROJO/pid" 2>/dev/null)" = "$$" ] && rm -rf "$CERROJO"
  return 0
}
trap liberar EXIT INT TERM

_t0=$(date +%s)
while :; do
  if mkdir "$CERROJO" 2>/dev/null; then
    echo "$$" > "$CERROJO/pid"
    echo "$PWD (suite-navegador #177)" > "$CERROJO/donde"
    echo "ventana: cerrojo ADQUIRIDO tras $(( $(date +%s) - _t0 ))s — pid $$" >&2
    break
  fi
  _dueno=$(cat "$CERROJO/pid" 2>/dev/null || echo "")
  if [ -z "$_dueno" ] || ! kill -0 "$_dueno" 2>/dev/null; then
    echo "ventana: cerrojo rancio (PID ${_dueno:-?} muerto) — lo robo" >&2
    rm -rf "$CERROJO"; continue
  fi
  echo "ventana: esperando a PID $_dueno en $(cat "$CERROJO/donde" 2>/dev/null) — $(( $(date +%s) - _t0 ))s" >&2
  sleep "$CERROJO_TIC"
done

echo "ventana: ARRANCA la suite $(date '+%H:%M:%S')" >&2
node "$AQUI/suite-navegador.mjs" "$@"
rc=$?
echo "ventana: FIN de la suite $(date '+%H:%M:%S') — rc=$rc" >&2
exit $rc
