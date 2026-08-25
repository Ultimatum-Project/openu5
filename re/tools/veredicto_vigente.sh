#!/usr/bin/env bash
# ¿SIGUE VALIENDO MI VEREDICTO DE PUERTA? — la mitad que le faltaba al testigo de alcance.
#
#   bash re/tools/veredicto_vigente.sh <sha_medido> [<ref_entregada>] [--raiz <repo>]
#
# Exit 0 = VIGENTE · 10 = CADUCADO (y nombra el fichero que lo caducó) · 2 = error de uso o
# de premisa (el sha no existe, o la raíz no lleva el arnés). La NO-ancestría **no** es un
# error: es un aviso — tras un rebase el sha medido queda huérfano y el veredicto sigue
# valiendo, porque lo que se compara son ÁRBOLES (ver abajo).
#
# ── EL PROBLEMA, Y POR QUÉ «MAIN ES ANCESTRO» NO LO RESUELVE ─────────────────────────────
# `corre_sellos.sh` tarda ~25 min. En una flota donde `main` se mueve cada pocos minutos, el
# árbol que MIDIÓ la puerta y el árbol que ENTREGAS divergen con facilidad, y nada en el flujo
# lo detecta: el veredicto se sigue citando como si fuera de la rama cuando es de un SHA.
# Medido en la ventana `loteria-sellos` (2026-08-03): `main` avanzó CUATRO veces durante un
# cierre; tres deltas quedaron fuera de alcance y UNO dentro, y ése obligó a re-correr la
# puerta entera. Sin este comando, la comprobación depende de que alguien se ACUERDE.
#
# ── LA REGLA DE ARRASTRE, QUE ES LO QUE EVITA EL «RE-CORRE POR SI ACASO» ─────────────────
# Un veredicto se ancla al SHA QUE MIDIÓ, y **sigue vigente sobre `sha_medido + deltas FUERA
# de alcance`** — porque «fuera de alcance» significa, POR CONSTRUCCIÓN, que ese diff no puede
# mover lo que la puerta mide. Así que la pregunta no es «¿ha cambiado algo?» (siempre sí)
# sino «¿ha cambiado algo EN ALCANCE?», y eso ya lo deriva `alcance_sellos.mjs`. Este script
# no reimplementa el predicado: lo INVOCA. Si el predicado mejora, esto mejora con él.
#
# ── 🔴 LA ANCESTRÍA FUE UNA GUARDA Y AHORA ES UN AVISO. POR QUÉ, Y CÓMO SE VALIDÓ ────────
# La primera versión EXIGÍA que `<sha_medido>` fuese ancestro, y se salía con 2 si no. El
# razonamiento era: «`alcance_sellos --rango A...B` usa merge-base, y con `A` no-ancestro
# contestaría en silencio a otra pregunta». **Ese razonamiento describía un camino que este
# script NO TOMA** — lo adjudicó `e2e-42` leyendo la implementación, no argumentando:
#
#     este script hace   `git diff --name-only "$MEDIDO" "$ENTREGADA"`   ← DOS puntos
#     y lo pasa por      `alcance_sellos --stdin`                        ← sólo LEE la lista
#     ⇒ `--rango` nunca se usa ⇒ el merge-base NUNCA entra ⇒ la ancestría no compraba nada.
#
# Y el dos-puntos compara **ÁRBOLES**, que es justo la pregunta operativa («¿difieren estos
# dos árboles en algo EN ALCANCE?») y es **más conservador** que el tres-puntos: lista también
# lo revertido. La premisa era **más estricta que lo que su propia implementación necesita**.
#
# 🔴 Y el precio de esa estrictez lo pagaba el que hace las cosas BIEN: el flujo canónico es
# «mide → main se mueve → REBASA → entrega», y el rebase deja el sha medido **huérfano**; un
# huérfano no es ancestro de nada, así que el comando contestaba ERROR sobre un veredicto que
# seguía vigente. Un falso CADUCADO no es inocuo: **es el rojo que se aprende a saltar**, y
# entonces el comando muere igual que si diera verde en falso.
#
# ★★ SE DEBILITA UNA PREMISA, ASÍ QUE SE VALIDA RE-INTRODUCIENDO LA REGRESIÓN (control
# exigido por `e2e-42` y hecho condición por el lead) — filo `CONTROL` del `--autotest`:
# un par **NO-ancestro** cuyo delta SÍ está en alcance (`espejo-tour.spec.ts`, T1) tiene que
# seguir diciendo **CADUCADO nombrando el fichero**. Si ese control no pasara, esto se
# revierte y se vive con el exit 2. [[veto-de-fichero-proxy-de-sujeto-estrecho]]
#
# Lo que SÍ sigue siendo error de premisa (exit 2), porque ahí no se puede contestar nada:
# un sha que no existe, y una raíz sin la entrada canónica del arnés.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 🔴 `re/tools/` ⇒ la raíz son DOS niveles arriba, no uno. Escribí `$AQUI/..` y el propio filo
# degenerado lo destapó: con la raíz en `re/`, `cierreDeImports` no encuentra las entradas del
# arnés, el cierre T1 sale VACÍO y `espejo-tour.spec.ts` —el fichero T1 de mi propia entrega—
# se clasificaba FUERA de alcance ⇒ **VIGENTE en falso**. Un guarda que da verde por comparar
# mal es peor que no tenerlo, que es literalmente lo que este script existe para evitar.
RAIZ="$(cd "$AQUI/../.." && pwd)"

MEDIDO=""; ENTREGADA="HEAD"; POS=0; AUTOTEST=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --raiz) RAIZ=$(cd "$2" && pwd) || exit 2; shift 2 ;;
    --autotest) AUTOTEST=1; shift ;;
    -h|--help) sed -n '1,8p' "${BASH_SOURCE[0]}"; exit 2 ;;
    *) if [ "$POS" -eq 0 ]; then MEDIDO=$1; else ENTREGADA=$1; fi; POS=$((POS+1)); shift ;;
  esac
done

# ══════════════════════════════════════════════════════════════════════════════════════════
# --autotest — LOS FILOS, EJECUTABLES. Porque una validación en un mensaje de commit es
# ══════════════════════════════════════════════════════════════════════════════════════════
# exactamente «doctrina escrita»: no se ejecuta, no se pone roja y envejece sin avisar. Los
# cinco casos van contra SHAs REALES de la historia de `main`, así que el día que alguien
# toque este script —o que `alcance_sellos` cambie de predicado— esto lo dice.
#
# ★ El filo 4 es una REGRESIÓN VIVIDA, no un caso inventado: con la raíz mal calculada este
# script daba VIGENTE sobre un fichero T1. Si vuelve a pasar, el autotest lo caza.
# ★ El filo 6 es la OTRA regresión vivida: tras un rebase el sha medido queda huérfano y el
# comando contestaba ERROR sobre un veredicto vigente. Lo encontró `e2e-42` en su primer uso.
# ★★ Y el filo CONTROL es el que autoriza haber DEBILITADO la premisa de ancestría: si un
# par no-ancestro con delta EN alcance dejara de salir CADUCADO, el cambio se revierte.
# ★ Y el filo 5 es el que más veces va a ocurrir (medí y aterrizo sin que se mueva nada): si
# ése diera CADUCADO, la herramienta sería insufrible desde el primer uso y se desactivaría.
autotest() {
  local fallos=0 saltados=0
  # caso · sha_medido · ref_entregada · exit esperado · qué filo es
  local CASOS=(
    "1|bdf68ffa|d9585f92|0|delta FUERA de alcance (re/notes) ⇒ VIGENTE"
    "2|383e18fd|72515d6d|10|delta EN alcance (skin/portrait, T3) ⇒ CADUCADO"
    "3|72515d6d|383e18fd|10|NO-ancestro con delta EN alcance ⇒ CADUCADO (ya no ERROR)"
    "4|8ab3aac0|d228992c|10|REGRESIÓN: fichero T1 del arnés ⇒ CADUCADO"
    "5|d9585f92|d9585f92|0|sha_medido == entregado ⇒ VIGENTE trivial"
    # ★ 6 — EL CASO MAYORITARIO REAL: tras un REBASE el sha medido queda huérfano y no es
    #   ancestro de nada. Antes salía ERROR (exit 2) sobre un veredicto que seguía vigente.
    "6|d9585f92|bdf68ffa|0|NO-ancestro (forma del rebase) + delta FUERA ⇒ VIGENTE"
    # ★★ CONTROL de la premisa DEBILITADA, exigido por e2e-42 y hecho condición por el lead:
    #   se re-introduce la regresión histórica —un par NO-ancestro cuyo delta SÍ está en
    #   alcance (espejo-tour.spec.ts, T1)— y tiene que seguir diciendo CADUCADO. Si este
    #   filo cayera, la ancestría vuelve a ser guarda y se vive con el exit 2.
    "CONTROL|d228992c|8ab3aac0|10|NO-ancestro + T1 en alcance ⇒ SIGUE CADUCADO"
  )
  echo "── AUTOTEST de veredicto_vigente.sh (raíz: $RAIZ)"
  for c in "${CASOS[@]}"; do
    IFS='|' read -r n a b esperado desc <<< "$c"
    if ! git -C "$RAIZ" rev-parse --verify --quiet "$a^{commit}" >/dev/null \
       || ! git -C "$RAIZ" rev-parse --verify --quiet "$b^{commit}" >/dev/null; then
      echo "   ⊘ filo $n SALTADO — $a o $b no está en este clon"; saltados=$((saltados+1)); continue
    fi
    bash "${BASH_SOURCE[0]}" "$a" "$b" --raiz "$RAIZ" >/dev/null 2>&1
    local got=$?
    if [ "$got" -eq "$esperado" ]; then
      echo "   ✓ filo $n  exit $got  — $desc"
    else
      echo "   ✗ filo $n  esperaba $esperado, dio $got  — $desc"; fallos=$((fallos+1))
    fi
  done
  # Degenerados que no necesitan SHAs: sin argumentos y raíz inválida.
  bash "${BASH_SOURCE[0]}" >/dev/null 2>&1; [ $? -eq 2 ] \
    && echo "   ✓ extra    exit 2   — sin argumentos ⇒ uso" || { echo "   ✗ extra    sin argumentos no dio 2"; fallos=$((fallos+1)); }
  bash "${BASH_SOURCE[0]}" HEAD HEAD --raiz /tmp >/dev/null 2>&1; [ $? -eq 2 ] \
    && echo "   ✓ extra    exit 2   — raíz sin las entradas del arnés ⇒ PARA (no VIGENTE)" || { echo "   ✗ extra    raíz inválida no dio 2"; fallos=$((fallos+1)); }
  echo "──"
  if [ "$fallos" -eq 0 ]; then
    [ "$saltados" -gt 0 ] && echo "AUTOTEST OK ($saltados filo(s) SALTADO(S) — este clon no los tiene)" || echo "AUTOTEST OK — los 6 filos + el CONTROL + 2 degenerados"
    return 0
  fi
  echo "🔴 AUTOTEST: $fallos filo(s) ROTO(S)"; return 1
}
if [ "$AUTOTEST" -eq 1 ]; then autotest; exit $?; fi

if [ -z "$MEDIDO" ]; then
  echo "uso: $0 <sha_medido> [<ref_entregada>] [--raiz <repo>]" >&2
  echo "  <sha_medido> = el SHA sobre el que corrió la puerta (lo imprime corre_sellos.sh)." >&2
  exit 2
fi

g() { git -C "$RAIZ" "$@"; }

# ── 🔴 CERROJO CONTRA EL BUG QUE ACABO DE TENER: un cierre VACÍO es indistinguible de
# «no hay nada en alcance». Si la raíz apunta a un sitio donde no están las entradas del
# arnés, `cierreDeImports` devuelve el conjunto vacío, T1 deja de detectarse **en silencio**
# y este script contesta VIGENTE a todo. Así que la raíz se VALIDA por su contenido, no por
# la aritmética de rutas: si la entrada canónica del arnés no está, se para.
# Es [[guarda-de-existencia-bendice-el-vacio]] aplicado a mi propio predicado.
ENTRADA_CANONICA="game/e2e/espejo-tour/espejo-tour.spec.ts"
if [ ! -f "$RAIZ/$ENTRADA_CANONICA" ]; then
  echo "🔴 ERROR: '$RAIZ' no parece la raíz del repo — falta '$ENTRADA_CANONICA'." >&2
  echo "   Sin las entradas del arnés el cierre T1 saldría VACÍO y esto diría VIGENTE a todo." >&2
  echo "   Usa --raiz <repo> o invoca el script desde su sitio en re/tools/." >&2
  exit 2
fi

# ── Premisa 1: los dos extremos tienen que existir ───────────────────────────────────────
for ref in "$MEDIDO" "$ENTREGADA"; do
  if ! g rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    echo "🔴 ERROR: '$ref' no es un commit de este repo ($RAIZ)." >&2
    exit 2
  fi
done
SHA_M=$(g rev-parse --short "$MEDIDO")
SHA_E=$(g rev-parse --short "$ENTREGADA")

# ── Ancestría: AVISO, no error. Se compara CONTENIDO, que es la pregunta correcta ────────
# El caso normal de que falle es un REBASE (el flujo que la flota exige), que deja el sha
# medido huérfano. No invalida nada: los dos árboles siguen siendo comparables.
AVISO_ANCESTRIA=""
if ! g merge-base --is-ancestor "$MEDIDO" "$ENTREGADA" 2>/dev/null; then
  AVISO_ANCESTRIA="⚠ $SHA_M no es ancestro de $SHA_E — se comparan los ÁRBOLES, que es la
     pregunta correcta. Si esperabas ancestría, alguien rebasó o picó la historia."
fi

# ── La pregunta de verdad: ¿el delta acumulado toca algo EN ALCANCE? ─────────────────────
# Se delega en `alcance_sellos.mjs` a propósito (exit 10 = en alcance, 0 = fuera). No se
# reimplementa el predicado: el día que el cierre de imports cambie, esto hereda el cambio.
FICHEROS=$(g diff --name-only "$MEDIDO" "$ENTREGADA")
if [ -z "$FICHEROS" ]; then
  echo "✓ VIGENTE — $SHA_M == $SHA_E (sin delta): el veredicto es del árbol que entregas."
  [ -n "$AVISO_ANCESTRIA" ] && echo "   $AVISO_ANCESTRIA"
  exit 0
fi

SALIDA=$(printf '%s\n' "$FICHEROS" | node "$AQUI/alcance_sellos.mjs" --stdin --raiz "$RAIZ" 2>&1)
RC=$?

if [ "$RC" -eq 10 ]; then
  echo "🔴 CADUCADO — el veredicto medido en $SHA_M NO cubre $SHA_E."
  echo "   Lo caducan estos ficheros EN ALCANCE:"
  # El culpable NOMBRADO: un «caducado» sin culpable se lee como ruido, y el ruido se aprende
  # a saltar. Se citan las líneas `[TRAMO] fichero` que imprime el detector, sin re-clasificar.
  printf '%s\n' "$SALIDA" | sed -n 's/^   \[\(.*\)\] \(.*\)$/     · \2   [\1]/p'
  [ -n "$AVISO_ANCESTRIA" ] && echo "   $AVISO_ANCESTRIA"
  echo "   ⇒ re-corre la puerta sobre $SHA_E antes de entregar."
  exit 10
fi

if [ "$RC" -ne 0 ]; then
  echo "🔴 ERROR: alcance_sellos.mjs salió con $RC — no se puede adjudicar vigencia." >&2
  printf '%s\n' "$SALIDA" >&2
  exit 2
fi

N=$(printf '%s\n' "$FICHEROS" | grep -c '^' | tr -d ' ')
echo "✓ VIGENTE — el veredicto medido en $SHA_M cubre $SHA_E."
echo "   $N fichero(s) de delta, TODOS fuera de alcance ⇒ por construcción no pueden mover un sello."
[ -n "$AVISO_ANCESTRIA" ] && echo "   $AVISO_ANCESTRIA"
exit 0
