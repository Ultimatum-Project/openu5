#!/usr/bin/env bash
# GUARDA DEL GESTO DE FUSIONAR DEL LEAD (13-08).
#
# Cuatro veces en una semana el merge de un aterrizaje se ejecutó DESDE EL WORKTREE del
# carril en vez del checkout principal: el resultado es un «Already up to date» que no
# deja rastro en el diff (la rama se fusiona consigo misma) y main se queda sin el
# aterrizaje mientras el lead cree haberlo hecho. Propuesto por carteles-198:
# «un fallo que se repite con la misma forma está pidiendo mecanismo, no cuidado —
# y un eco se puede leer por encima; un exit 1 no».
#
# Uso (SOLO el lead):
#     aterriza <sha> -m "…"          ← la copia de ~/bin, POR PATH (doctrina desde 13-08)
# La copia AUTORITATIVA vive en ~/bin/aterriza (propuesta de carteles-198, opción (a)):
# existe en TODA invocación con independencia del árbol y de la máquina —cierra el hueco
# de la ruta relativa Y el de la ruta absoluta que caducaba con la migración #159—; esta
# copia del repo queda para revisión/historia y test_aterriza_careo.py se pone ROJO si
# las dos divergen O si ~/bin/aterriza no está instalada (instalar:
# `cp re/tools/aterriza.sh ~/bin/aterriza && chmod +x ~/bin/aterriza`).
# 🔴 Por ruta RELATIVA la guarda tiene un hueco (medido por webkit-192, 13-08): vive EN
# el árbol, así que desde el worktree de una rama ANTERIOR a ella el fichero no existe y
# la parada que se obtiene («No such file») es ACCIDENTAL, no de la guarda. La copia de
# ~/bin existe siempre, y su chequeo evalúa el repo del CWD — que es exactamente el que
# debe abortar.
# Hace exactamente `git merge --no-ff "$@"` tras negarse si:
#   (1) el árbol actual es un WORKTREE ENLAZADO (no el checkout principal), o
#   (2) la rama actual no es main (en detached HEAD también se niega — intencionado).
#
# 🔴 La condición (1) se DERIVA de git, no de una ruta cableada (corrección de
# carteles-198, 13-08): la primera versión comparaba contra la ruta absoluta del
# principal, que es la clase de #178 (corpus = ruta única) y habría hecho que la guarda
# se negara SIEMPRE tras la migración al Mac mini (#159) — fallo cerrado, pero leído
# como misterio el día del cutover. El discriminante derivado: el git-dir del checkout
# PRINCIPAL es el git-dir COMÚN; el de un worktree enlazado es .git/worktrees/<nombre>.
# Medido en los dos árboles antes de adoptarlo.
set -euo pipefail

: "${1:?uso: aterriza.sh <sha-o-rama> [-m \"narrativa\"] — falta el sha/rama a fusionar}"

if [ "$(git rev-parse --absolute-git-dir)" != "$(git rev-parse --path-format=absolute --git-common-dir)" ]; then
  echo "ATERRIZA: esto es un WORKTREE ENLAZADO ($(git rev-parse --show-toplevel))." >&2
  echo "          El merge aqui fusiona la rama consigo misma («Already up to date»)." >&2
  echo "          Ve al checkout principal y repite. ABORTO (exit 1)." >&2
  exit 1
fi

rama=$(git branch --show-current)
if [ "$rama" != "main" ]; then
  echo "ATERRIZA: la rama actual es '${rama:-((detached HEAD))}', no main. ABORTO (exit 1)." >&2
  exit 1
fi

echo "ATERRIZA ✓ $(git rev-parse --show-toplevel) @ main — git merge --no-ff $1"
exec git merge --no-ff "$@"
