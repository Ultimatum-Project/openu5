#!/usr/bin/env bash
# BATERÍA DE ATERRIZAJE — fuente única, por NOMBRES de fichero.
#
# POR QUÉ EXISTE: el 2026-08-05 dos carriles descubrieron que «la batería de 141»
# era AMBIGUA — hay al menos DOS conjuntos de 7 ficheros de re/tools que suman
# exactamente 141 tests y vigilan cosas distintas. Un total no es un denominador:
# es un hash con colisiones. Desde entonces la batería se cita por este script,
# nunca por su cardinal. (El cardinal además caduca con cada test añadido.)
#
# GUARDA DE CARDINAL (2026-08-05, hallazgo de asm-kernel): pytest puede PERDER
# POBLACIÓN EN SILENCIO — corridas que reportan 153 o 196 tests donde la colección
# da 197, sin un solo `skipped` (ficha #5 del lead). Un «EXIT 0» sobre población
# incompleta es el mismo sello aparente sobre otra suite. Por eso el script colecta
# primero, ejecuta después, y FALLA (exit 64) si el total ejecutado no cuadra con el
# colectado. La guarda solo aplica en la corrida completa (sin argumentos): con
# filtros (-k, fichero suelto) el cardinal esperado no está definido.
#
# USO:  bash re/tools/bateria_aterrizaje.sh        # desde la RAÍZ del repo
# Exit: el de pytest o el de la guarda que se ponga roja; 64 para las que abortan de entrada
#       (entorno, careo de la foto de navegador, pérdida de población de pytest o de vitest).
#
# ⚠ test_companion_ea es sensible a CARGA: lanza CHROMIUM por playwright bajo `timeout`
#   (120 s / 180 s / 60 s). Con la flota en paralelo la máquina llega tarde y el fichero se
#   pone rojo sin que nada esté mal. Un rojo SOLO ahí se RE-CORRE AISLADO antes de
#   adjudicarlo a nadie.
#
#   🔴 NO BUSQUES `EADDRINUSE`: NO APARECE NUNCA, y quien lo use de discriminante concluirá
#   lo contrario de lo que pasó. El servidor de `verify-byo-runtime.mjs` abre `listen(0)` =
#   PUERTO EFÍMERO — el puerto fijo 52xx que decía la ficha #5 YA SE QUITÓ, y ese arreglo es
#   justamente el que eliminó la colisión. La firma de la contención es
#   `subprocess.TimeoutExpired` o un fallo de chromium.
#   (Refutado por re/parcialidad el 07-08 midiendo el fichero: cero bind/listen/52xx.
#    Mi primera redacción de este aviso, y la del cerrojo de abajo, nombraban el mecanismo
#    equivocado. La conclusión no cambia —se serializa—; el PORQUÉ sí.)
#
# Los carriles publican su resultado nombrando este script + SHA del árbol medido
# + el CARDINAL que reportó (la guarda lo hace redundante, pero un acta que lo cita
# se defiende sola).
set -u
cd "$(dirname "$0")/../.."   # raíz del repo, corra de donde corra

# 🔴 SANEO DE COLOR (16-08, adjudicado por fix-367b con control positivo): el Bash tool
# del harness exporta FORCE_COLOR=3, vitest coloriza su resumen AUNQUE escriba a fichero,
# el sed de vitest_puerta deja de casar la línea «Tests N (N)» y la rama de error dispara
# además el bug multibyte de bash 3.2 bajo set -u (« pegado a $var). El control: el mismo
# sed contra la misma corrida da total vacío CON FORCE_COLOR y el total correcto SIN él.
unset FORCE_COLOR COLORTERM CLICOLOR_FORCE 2>/dev/null || true
export NO_COLOR=1

# 🔴 Y NODE@22 SE ARMA AQUÍ, no en la shell de quien lanza (17-08: TRES carriles en una
# noche compraron el mismo falso rojo — analitica-embudo 23/23 SIN ASERTO — por correr
# con el node 26 del PATH del host, que retiró el localStorage global; el re-run «real»
# de la puerta #308 heredaba el MISMO intérprete y firmaba árbol. Careo bidireccional en
# los tres: rojo en main puro con 26, verde 23/23 con 22 en el mismo árbol). Si el brew
# node@22 existe, va delante del PATH; si no, se avisa y se sigue (otras máquinas).
if [ -d /opt/homebrew/opt/node@22/bin ]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
else
  echo "BATERIA AVISO: sin /opt/homebrew/opt/node@22 — corriendo con node $(node --version 2>/dev/null || echo '?')" >&2
fi

# ════ EL SELLO EN DISCO — porque una TUBERÍA NO PUEDE FALSIFICARLO ══════════════════════
# Séptima forma de la trampa del pipe en esta flota: `| head -1` cerró el pipe y la
# notificación dijo «exit code 0» con el gate todavía vivo. Las seis anteriores están en la
# memoria `gate-exit-code-pipe-mask`, cuya propia conclusión es que **la memoria existía y no
# disparó ni una vez**. Doctrina que no dispara no es doctrina: es decoración.
#
# El sello lo escribe ESTE script, no la shell que lo invoca. Quien entube la salida pierde el
# EXIT del terminal; el sello sigue en disco y dice la verdad.
#
# ★ SE SELLA CON `trap`, NO EN CADA `exit`. El encargo que lo pidió hablaba de TRES puntos de
#   salida y ya eran cinco al escribirlo — que es justo el motivo: quien añada el siguiente
#   mañana no se va a acordar. Con el trap, sella el que exista, hoy y siempre.
#   🔴 Y AQUÍ YA NO SE DICE CUÁNTOS SON, a propósito. Esta línea llevaba «CINCO» escrito y
#   para el 14-08 la cuenta real pasaba de diez (guarda de assets, tsc, careo de la foto,
#   cardinal, ocho líneas vitest, pool 174, cifras…): un recuento a mano dentro del fichero
#   que cuenta es una cifra que caduca sola y que nadie carea — la misma avería que el «x6»
#   sobre siete ficheros de la línea de render, y la razón entera de la ficha #258. La
#   propiedad que importa no es el número: es que el trap los cubre TODOS sin enumerarlos.
#
# ★ Y SE BORRA AL EMPEZAR. Un sello viejo de una corrida anterior es una FOTO CADUCADA que se
#   lee como fresca; si esta corrida muere de un `kill -9` (el trap no salva de eso), es mejor
#   NO tener sello que tener el de ayer. Por lo mismo, la rama con argumentos (filtros) hace
#   `exec` y NO deja sello: no es una batería de aterrizaje y no debe poder citarse como tal.
# ════ CERROJO DE EXCLUSIÓN ENTRE WORKTREES — porque los PUERTOS son de LA MÁQUINA ═══════
# 🔴 EL INCIDENTE (2026-08-07): el lead lanzó cuatro carriles a la vez y les mandó a todos
#   correr esta batería. TRES corrieron a la vez, las tres dentro de test_companion_ea, que
#   lanza CHROMIUM bajo `timeout` y no tolera carga. Resultado: rojos que no son de nadie, y
#   tres carriles a punto de adjudicárselos como regresión propia.
#   🔴 Esta cabecera decía «liga puertos FIJOS 52xx» y era FALSO (ver arriba). El cerrojo
#   está MÁS justificado de lo que su propio borrador argumentaba: un EADDRINUSE habría dado
#   firma reconocible; un timeout no da ninguna.
#
# El aviso ya estaba escrito ARRIBA (cabecera, «se re-corre aislado antes de adjudicarlo»)
# desde días antes, y no evitó nada: nadie tenía forma de saber que había otra corriendo. Es
# la misma moraleja que el bloque del sello se aplica a sí mismo — DOCTRINA QUE NO DISPARA ES
# DECORACIÓN. Así que aquí deja de ser prosa y pasa a ser un cerrojo.
#
# ★ EL CERROJO ES DE LA MÁQUINA, NO DEL WORKTREE. El sello sí es por árbol (cada worktree
#   tiene el suyo), pero lo que se disputa —los puertos— es del host. Por eso la ruta es fija
#   y ABSOLUTA, fuera de cualquier repo: dos worktrees deben ver EL MISMO cerrojo.
#
# ★ `mkdir` COMO PRIMITIVA, no `[ -e ] && touch`. mkdir es atómico en POSIX: crea-o-falla en
#   una sola llamada, sin ventana entre comprobar y crear. El par test-then-create deja pasar
#   a dos corridas que miren a la vez, que es exactamente el fallo que se quiere evitar.
#
# ★ ROBO DE CERROJO RANCIO. Dentro va el PID del dueño. Si ese PID ya no vive, el cerrojo se
#   roba: un `kill -9`, un reinicio, o la rama con `exec` de más abajo (que REEMPLAZA esta
#   shell y por tanto se lleva por delante el trap que lo liberaría) dejan el directorio
#   huérfano. Sin robo, el primer accidente bloquearía la flota para siempre.
#
# ★ Y NO SE ESPERA ETERNAMENTE. Al agotar el plazo se CORRE IGUAL: una batería que no corre
#   bloquea un aterrizaje, que es peor que un rojo re-corrible. Pero entonces el SELLO LO DICE
#   (CERROJO=CONCURRENTE) — la corrida declara el régimen en el que se midió, para que quien
#   lea el resultado sepa si un rojo de companion_ea es adjudicable o hay que re-correrlo.
#
# ⚠ EL PLAZO NO ES EXACTO: se comprueba UNA VEZ POR RONDA, así que la espera real es el
#   múltiplo de CERROJO_TIC inmediatamente superior (medido: con ESPERA=1 y TIC=15 tardó 15 s,
#   no 1). Con el defecto de 1800 s da lo mismo; queda dicho para que nadie lea el plazo como
#   una promesa al segundo. TIC es ajustable para que el TESTIGO de esto corra en segundos en
#   vez de en minutos — un testigo lento es un testigo que alguien acabará quitando.
CERROJO="${U5_BATERIA_CERROJO:-/tmp/u5-bateria.lock}"
CERROJO_ESPERA="${U5_BATERIA_CERROJO_ESPERA:-1800}"   # segundos
CERROJO_TIC="${U5_BATERIA_CERROJO_TIC:-15}"           # segundos por ronda
CERROJO_ESTADO="DESACTIVADO"
liberar_cerrojo() {
  # Sólo el dueño libera: si el cerrojo fue robado por otro, su PID ya no es el nuestro y
  # borrarlo desalojaría a un inocente.
  [ -d "$CERROJO" ] && [ "$(cat "$CERROJO/pid" 2>/dev/null)" = "$$" ] && rm -rf "$CERROJO"
  return 0
}
if [ -z "${U5_BATERIA_SIN_CERROJO:-}" ]; then
  _t0=$(date +%s)
  while :; do
    if mkdir "$CERROJO" 2>/dev/null; then
      echo "$$" > "$CERROJO/pid"; echo "$PWD" > "$CERROJO/donde"
      CERROJO_ESTADO="EXCLUSIVO"; break
    fi
    _dueno=$(cat "$CERROJO/pid" 2>/dev/null || echo "")
    if [ -z "$_dueno" ] || ! kill -0 "$_dueno" 2>/dev/null; then
      echo "batería: cerrojo rancio (PID ${_dueno:-?} muerto) — lo robo" >&2
      rm -rf "$CERROJO"; continue
    fi
    if [ $(( $(date +%s) - _t0 )) -ge "$CERROJO_ESPERA" ]; then
      echo "batería: ⚠ ${CERROJO_ESPERA}s esperando a PID $_dueno ($(cat "$CERROJO/donde" 2>/dev/null)) — CORRO IGUAL." >&2
      echo "batería: ⚠ bajo CERROJO=CONCURRENTE un rojo de test_companion_ea SE RE-CORRE" >&2
      echo "batería:   AISLADO antes de adjudicarlo. Decide el re-run, no esta etiqueta." >&2
      CERROJO_ESTADO="CONCURRENTE"; break
    fi
    echo "batería: esperando a la de PID $_dueno en $(cat "$CERROJO/donde" 2>/dev/null) — test_companion_ea lanza chromium bajo timeout y no tolera carga…" >&2
    sleep "$CERROJO_TIC"
  done
fi

# 🔴 UN «EXIT=0» SÓLO SE ESCRIBE SI LA CORRIDA LLEGÓ AL FINAL (hallazgo de re/font-luz,
#   07-08, VISTO EN VIVO). El sello decía `EXIT=0 · DIRTY=false · CARDINAL=?/380` sobre una
#   corrida cuyo log terminaba en «15 failed». Mecanismo, en tres líneas: el trap sella el
#   `$?` VIVO, y justo detrás del pytest hay un `set +o pipefail` que DEVUELVE 0 SIEMPRE
#   (control: `false; set +o pipefail` ⇒ $? = 0). Una muerte en esa ventana sella verde.
#   Es la misma familia que la trampa de la tubería que el sello vino a cerrar: el terminal
#   ya no puede mentir, pero EL DISCO SÍ si la corrida se interrumpe.
#
#   El tell existía y NO ESTABA DECLARADO: el `?` de CARDINAL es `${EJECUTADO:-?}` = «la
#   variable nunca se asignó» = «esto no llegó al final». Nadie decía que un `?` invalide el
#   EXIT, y las tres primeras líneas se leen como sello bueno. Así que ahora el script
#   DECLARA POR DÓNDE VA y `sella` se niega a escribir un verde que no le consta.
FASE="inicio"
SELLO="${BATERIA_SELLO:-.claude/bateria-sello.txt}"
mkdir -p "$(dirname "$SELLO")" && rm -f "$SELLO"
sella() {
  local code=$1
  # Un cero que llega sin haber pasado por «fin» es un cero que nadie ha ganado.
  if [ "$code" = "0" ] && [ "$FASE" != "fin" ]; then code=65; fi
  local sha dirty
  sha=$(git rev-parse --short HEAD 2>/dev/null || echo "sin-git")
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then dirty=true; else dirty=false; fi
  {
    echo "EXIT=$code"
    echo "SHA=$sha"
    echo "DIRTY=$dirty"
    echo "CARDINAL=${EJECUTADO:-?}/${ESPERADO:-?}"
    # #258 · el cardinal de arriba es SÓLO pytest, y hasta el 14-08 el sello no decía una
    # palabra de las ~425 pruebas vitest que la puerta también corre. `?` significa aquí lo
    # mismo que en CARDINAL: la corrida no llegó a las líneas vitest. Es ejecutado/SUELO, no
    # ejecutado/esperado: el de vitest es un mínimo declarado, no una igualdad (ver la guarda).
    echo "CARDINAL_VITEST=${VITEST_EJECUTADO:-?}/${VITEST_SUELO:-?}"
    # #308 · EL RE-RUN AISLADO SE DECLARA EN EL SELLO, siempre, con sus cuatro campos.
    # `?` = la corrida no llegó a la puerta vitest completa (mismo significado que en
    # CARDINAL). `no` = llegó y NO hizo falta reintento. `ambiental` = hubo rojos ⚠ SIN
    # ASERTO y TODOS pasaron aislados ⇒ era la cola, no el árbol, y la puerta no bloqueó.
    # `real` = al menos uno siguió rojo aislado ⇒ rojo de verdad, la puerta bloqueó.
    # 🔴 LA CARGA Y EL CENSO DE BATERÍAS VAN CON EL RÓTULO O EL RÓTULO NO ES AUDITABLE:
    # «verde al re-correrlo solo» sin saber si había cola detrás no es una adjudicación,
    # es una conjetura con forma de dato. RERUN_BATERIAS INCLUYE la propia (1 = estaba
    # sola, y entonces un «ambiental» merece que alguien lo mire dos veces).
    echo "RERUN_AISLADO=${RERUN_AISLADO:-?}"
    echo "RERUN_FICHEROS=${RERUN_FICHEROS:-?}"
    echo "RERUN_CARGA=${RERUN_CARGA:-?}"
    echo "RERUN_BATERIAS=${RERUN_BATERIAS:-?}"
    echo "WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "CERROJO=${CERROJO_ESTADO:-?}"
    # FOTO: vigente = el careo pasó · CADUCA = corrió bajo U5_CAREO_AVISO=1 con foto que no
    # cubre este árbol (el lead re-sella la foto antes de la composición) · ? = careo no corrió.
    echo "FOTO=${FOTO_ESTADO:-?}"
    echo "FASE=$FASE"
  } > "$SELLO"
}
trap 'sella $?; liberar_cerrojo' EXIT

FICHEROS=(
  re/tools/test_companion_ea.py
  re/tools/test_genesis_manifiesto.py
  # Careo de la guarda de fusión del lead (0,06 s, sin red, lee dos ficheros): la copia
  # autoritativa vive en ~/bin/aterriza y la del repo queda para revisión — dos copias del
  # mismo texto divergen EN SILENCIO y el defecto que vigilan (merge desde worktree = no-op
  # que se lee como éxito) ya costó cuatro aterrizajes perdidos el 12/13-08. Ausencia = rojo,
  # no skip: «no instalada» es exactamente «la guarda no existe en esta máquina».
  re/tools/test_aterriza_careo.py
  # Guarda de ARBOL de la ficha #228 (0,1 s, sin red, sin material de EA en el propio
  # test): ningun .gam TRACKEADO lleva el roster de EA (nombres + registros de INIT.GAM
  # verbatim) y los saves del espejo-tour siguen UNTRACKED (alimentan al original via
  # mirror_runner: no se pueden anonimizar). Pareja de arbol de guarda_roster_ea.py, que
  # solo vigila el sitio ensamblado: esta enrojece en el commit que re-introduce material
  # EA en un save, no el dia que alguien lo publique.
  re/tools/test_gam_sin_roster_ea.py
  # Guarda de ARBOL de la ficha #376 (0,4 s, sin red; las agujas TLK que lleva escritas
  # son 3 frases cortas EN EL PROPIO TEST — no reintroduce el corpus): los route/overlay
  # JSON del espejo (17.030 palabras de prosa TLK de EA verbatim medidas con el predicado
  # de companion_ngram_overlap) siguen FUERA del indice, y ningun fichero trackeado de
  # espejo-tour lleva bloques TLK. Hermana de la de arriba: mismo regimen (#228), otra
  # clase de material (texto en claro en vez de roster binario).
  re/tools/test_rutas_espejo_sin_prosa_tlk_ea.py
  # Guarda de ARBOL sobre game/src/** — lo que SIRVE EL NAVEGADOR (0,4 s, sin red, sin
  # material de EA en el fichero: las dos frases de control son cortas y van como CONTROL
  # POSITIVO, no como corpus). Tercera hermana de las dos de arriba, y la que cierra el
  # hueco que ninguna veia: el 25-08 se hallaron 8.324 palabras del Libro del Saber (150
  # campos ItemDescription, racha maxima 193) PUBLICADAS en el repo publico dentro de
  # game/src/core/data/InventoryDetails.json, entradas en 757af9a7 como «datos MIT de
  # Ultima5Redux» aunque cada una declaraba su origen EA en su propio campo hermano.
  # 🔴 EL FALLO NO ERA EL CORPUS SINO LA POBLACION, y por eso hacia falta un fichero mas:
  # book-of-lore.md lleva siempre en original/docs-fisicos, asi que el predicado de la casa
  # SI veia esa prosa (173 rachas, 6.536 palabras) — pero companion_ngram_overlap barre
  # docs/manual/companion, la de #376 barre espejo-tour/routes* y la del genesis barre el
  # destino ensamblado: game/src/ no era el trozo de NADIE. Preguntar «¿tenemos detector de
  # prosa EA?» daba SI y «¿mira este fichero?» daba NO. Ademas estrena la TERCERA VIA del
  # corpus (claves [D] del manifiesto de fidelidad, companion_ngram_overlap.indice_ea_datos):
  # +385 n-gramas del SEGMENTO DE DATOS que no estan ni en los docs ni en game/assets, y con
  # ellos aparecen 4 ficheros mas de game/src con dialogo EA, hoy declarados CON PRESUPUESTO
  # (el aserto compara con `==`: enrojece si crecen y tambien si encogen).
  re/tools/test_prosa_ea_en_fuente.py
  # Testigo del gate `fresh` de town_load_map (tren #161, carril npcs-save-sintetico): 12 casos,
  # 0,3 s. Lo registra el LEAD al aterrizar porque `test_puerta` enrojeció nombrándolo — la
  # guarda de #55 haciendo exactamente su trabajo: un test que no está ni aquí ni declarado
  # fuera no lo ejecuta nadie, y su color no lo mira nadie.
  re/tools/test_npc_fresh_gate.py
  # Guarda del GENESIS PUBLICO (0,2 s, sin red, sin material EA: reusa las 3 agujas de
  # agujas_tlk.py). Vigila los tres defectos MEDIDOS el 25-08 sobre el destino real:
  # (1) la whitelist no se actualizo tras #376 y copiaba 98 route JSON (15,5 MB de prosa
  # TLK verbatim) al arbol publico — solo los paraba el .gitignore que viaja, que es una
  # guarda de OTRA capa; (2) game/.env y demo-byo/.env (clave de PostHog) viajaban igual;
  # (3) el scrub nombraba la maquina VIEJA (<user>/<workdir>/<scratch-id>) y salvaba
  # solo por comodin. Los tres tienen la misma forma: una guarda escrita contra el estado
  # de ayer que sigue verde mientras el sujeto se mueve debajo. Hermana de
  # test_genesis_manifiesto.py (REGLA 4-bis), que vigila la otra puerta del mismo script.
  re/tools/test_genesis_guardas.py
  # TRINQUETE de las semillas del espejo (0,04 s, lectura de disco, sin red ni navegador;
  # no lleva material de EA — solo cuenta bytes de estado). Ningun checkpoint NUEVO puede
  # nacer con la party 100% muerta. La linea base son los 16 malos de HOY, congelados y
  # citados por nombre dentro del propio fichero: un 17 enrojece y el numero solo puede
  # BAJAR (ruling del lead 22-08 — estrenarlo en rojo sobre el 33% del material seria una
  # puerta que nadie puede poner verde). Por que importa: sobre una semilla muerta el tour
  # sigue midiendo conformidad y dando verde, y en el binario una party entera muerta NO
  # PUEDE seguir jugando (ULTIMA.EXE 0x39fc -> MAINOUT 0x0ac2 -> BLCKTHRN 0x0910).
  # Adjudicacion: re/notes/espejo-cadena-party-muerta.md
  re/tools/test_semilla_party_viva.py
  # El corpus del espejo SI trae la escena del REFUGIO (0,3 s, lee JSON de routes/; sin prosa
  # de EA en el fichero — la aguja se DERIVA del literal del port). Entra en la puerta porque
  # fija una TRAMPA que ya produjo una premisa falsa: el binario escribe «engulfs» y el OCR del
  # video lee «engulf», asi que buscar la ortografia del BINARIO sobre texto OCR da un cero que
  # se leyo como «el jugador real nunca perdio la party». Lo perdio SEIS veces (4 segmentos en
  # LP1, 2 en AD) y el refugio lo rescato las seis. Se salta si routes/ no esta (fuera del
  # indice desde #376, se COPIA por worktree). Adjudicacion: re/notes/espejo-ad-salud.md §4.
  re/tools/test_corpus_refugio.py
  # MANIFIESTO DE PROCEDENCIA de las semillas (0,04 s, solo sha256; cero bytes de juego en
  # el fichero trackeado, regimen #228). Tapa un agujero MUDO: saves/ esta fuera del indice
  # y el tour ESCRIBE ahi, asi que re-escribir una semilla no aparecia en NINGUN diff. Paso
  # de verdad el 20-08 (part01-06 sobrescritos) y partio la cadena en dos sin que nadie lo
  # viera en dos dias. Con esto, una costura futura enrojece sola nombrando el fichero.
  re/tools/test_saves_procedencia.py
  # Guarda del CAREADOR de semillas (0,09 s). Prueba el PREDICADO de saves_verificar.py
  # (`censar`) sobre directorios sinteticos en tmp_path — NO sobre la copia canonica, que
  # vive fuera del repo y en la ruta de UNA maquina: exigirla aqui seria rojo en cualquier
  # otro sitio y se aprenderia a ignorarlo. Incluye el aserto de que saves_verificar
  # COMPARTE el lector del manifiesto con la guarda de procedencia en vez de escribirse uno
  # propio (dos lectores del mismo fichero que divergen es averia ya pagada en esta casa).
  re/tools/test_saves_verificar.py
  # Censo de emisores del embudo BYO (0,4 s, sin material de EA, sin red ni navegador:
  # lee los `.ts` del sitio). Entra en la puerta porque los defectos que vigila son
  # MUDOS en produccion — un escalon sin emisor no da error en ninguna parte, da una
  # conversion del 0 % que se lee como problema de producto. Cubre ademas el unico hook
  # (`byo_momento_anadido`) que la sonda de navegador NO puede alcanzar sin una copia
  # real de EA, y la RECIPROCA de la llegada: que las dos superficies la declaren.
  re/tools/test_byo_analitica.py
  # Guarda de la ficha #124: el panel de consentimiento no deja NADA inpulsable en /byo, y
  # SIGUE siendo una decision visible (par de asertos: sin el segundo, un panel escondido
  # pasaria el primero con holgura). Construye demo-byo CON clave de mentira porque sin
  # clave el panel NO SE ABRE y la sonda mediria una pagina sin panel — verde vacuo que
  # cazo el propio aserto de no-vacuidad en su primera corrida. ~25 s (chromium, 6
  # viewports, puerto efimero); sin material de EA.
  re/tools/test_panel_no_tapa.py
  # #169 — guarda de FORMA sobre los predicados de `build-demo-publica.sh` (0,06 s, sin
  # material de EA, sin red: lee el .sh). Entra en la puerta porque el defecto que vigila
  # es INVISIBLE y CARO: un predicado escrito como tubería bajo `pipefail` contesta «no lo
  # encontré» cuando SÍ lo encontró (el productor se lleva el SIGPIPE del `grep -q` que
  # sale antes), y la probabilidad SUBE con la carga de la máquina — o sea que aparece
  # justo en las tandas llenas y desaparece cuando vas a reproducirlo a solas. Medido:
  # 2/2.000 en reposo, 12/1.000 con 8 quemadores.
  re/tools/test_ensamblador_predicados.py
  # #168a — el rótulo del dropzone de /byo no puede prometer menos de lo que `input.accept`
  # acepta (0,07 s, lee dos .ts). Entra en la puerta porque el defecto es MUDO: no rompe
  # nada, sólo hace que quien trae un `SAVED.GAM` de 1988 crea que no vale y se vaya. La
  # lista de extensiones se DERIVA de `accept`, así que ampliar el cargador sin ampliar el
  # rótulo se pone rojo nombrando la extensión que falta.
  re/tools/test_dropzone_rotulo.py
  # #168b — la cadena de TRES extremos de la captura del cargador (0,07 s, sin navegador):
  # PNG trackeado + las DOS páginas de /jugar que lo referencian + el paso de copia del
  # ensamblador. Entra en la puerta por el tercer extremo, que es el que NADIE ve fallar:
  # §RUTAS vigila `<a href>`, no `<img src>`, así que una imagen referenciada y no copiada
  # da un hueco silencioso en producción con el repo en verde (la clase de #96).
  re/tools/test_captura_cargador.py
  # #166 — los arneses de EVIDENCIA anclan sus rutas a su árbol y no al `cwd` (0,1 s, sin
  # navegador). Entra en la puerta porque el defecto es de los que NO dan síntoma en el
  # resultado: tres capturas del «después» se escribieron en la raíz del checkout principal
  # del usuario, y el mismo descuido en el argumento de ENTRADA haría que un censo midiera
  # la rama de otro y saliera precioso. Un instrumento que no dice contra qué midió no
  # puede desmentir a quien lo entrega.
  re/tools/test_arneses_anclados.py
  # #293 — PUERTA DE VERSIÓN de la extracción, en Chromium REAL (11 tests, 3,7 s: el arnés
  # empaqueta el módulo con esbuild y siembra una Cache Storage de verdad; sin material de
  # EA — las entradas son respuestas de una línea). Entra en la puerta porque el defecto
  # que vigila NO DA SÍNTOMA: un asset nuevo del extractor deja coja en silencio a toda
  # extracción /byo anterior, y lo único que lo delata es que el aviso salte. El escenario
  # `servida` es el que no se puede perder: mide que el flujo de assets del SERVIDOR no
  # recibe el aviso, que es lo que separa «tu extracción es vieja» de «aquí no hay
  # extracción». Cuatro mutantes sobre el módulo de producción, uno por causa.
  re/tools/test_extraccion_vieja.py
  # Guardas del arnés v2 del oráculo (14-08, carril dosbox-arnes-perf). +17 tests, 6,5 s,
  # SIN dosbox-x: lo que vigila es lógica de HOST (granularidad de sondeo del pty, timeout
  # duro, idempotencia). 🔴 CRECIMIENTO DE FICHERO DECLARADO — se pide al lead que lo
  # ratifique o lo saque. Entra porque las dos guardas que importan están SEMBRADAS contra
  # el régimen anterior (con la granularidad vieja se ponen ROJAS, verificado) y porque una
  # de ellas vigila la REGLA 3: que el vigía mate su PID y no un proceso ajeno con el mismo
  # argv — el defecto que esa guarda impide es de los que se llevan por delante el DOSBox
  # del usuario y las baterías de otros carriles.
  re/tools/test_oracle_runner.py
  # Contrato del troceado ≤64K de read_mem (#343: el MEMDUMPBIN de dosbox-x 2026.08.02
  # envuelve en la frontera del segmento). 4 asertos en 0,03 s, sin dosbox: corre contra
  # un _read_mem_raw grabador — sin él, quitar el re-basado volvería a cegar _find_roster
  # sin que nada de la puerta lo viera.
  re/tools/test_oracle_chunking.py
  re/tools/test_strcites.py
  re/tools/test_frontier.py
  # Testigo del predicado de destinos de `call` (2 s, sin material de EA). Entra en la
  # puerta porque vigila DOS defectos vivos del buscador de llamadores, en sentidos
  # opuestos: la CEGUERA al destino 0 —que el desensamblador imprime `call 0`, en decimal
  # y sin `0x`— y la INFLACION por `call` casando dentro de `lcall`, donde lo que casaba
  # era el SEGMENTO de una llamada far. Su mitad negativa es la que lo hace util: exige
  # que el predicado ingenuo, el `\b` pelado y EL ANTERIOR AL ARREGLO fallen.
  re/tools/test_call_cero.py
  # (El carril `prosa-publicada-630` registro este mismo testigo por su cuenta, avisando de que
  #  si su autor lo registraba tambien habria que quitar una de las dos lineas porque «duplicarla
  #  no da conflicto y falsea el cardinal». Asi fue: el lead lo habia registrado arriba en el tren
  #  #161. Se retira ESTA, se conserva aquella, y queda escrito que el aviso acerto.)
  # #30 — testigo propio de verify_show, el anotador que consumen seis sitios. Entra en la
  # puerta (0,2 s) y NO en FUERA-DE-PUERTA: degrada solo si falta el material de EA.
  re/tools/test_verify_show.py
  # #86 — guarda DE LAS GUARDAS de material de EA (0,07 s). Entra porque vigila la
  # dirección que esta misma batería NO puede ver: su cardinal suma los `skipped`, así que
  # un `skipif` siempre-verdadero deja siete ficheros sin correr sin mover ni una cifra.
  re/tools/test_guarda_ea.py
  re/tools/test_segmentos_adjudicados.py
  re/tools/test_veredicto_vigente.py
  re/tools/test_entradas_absorbidas.py
  re/tools/test_banda_criterios.py
  re/tools/test_ledger.py
  # #189 (17-08) — gate de etiquetas RANCIAS del ledger de huerfanos (27 tests, 3,4 s
  # medidos x3, sin red ni navegador ni subprocess: lee game/src y dos JSON — no sensible
  # a carga). Entra porque el defecto que vigila es MUDO y EXTERNO al fichero: otro carril
  # cierra un hueco-del-port sin tocar el ledger y la etiqueta queda mintiendo (medido:
  # 19 rancias en 4 dias, 13-08→17-08). Su rojo dice «etiqueta caducada» o «testigo
  # implementado», NOMBRA la entrada, y la reparacion esta recetada en el propio fichero.
  re/tools/test_detect_orphan_strings.py
  re/tools/test_routine_census.py
  re/tools/test_triage_heredados.py
  re/tools/test_check_manual_merge.py
  re/tools/test_cita_segmento.py
  # ENTRA por #55: vigila el detector de nombres-marcador, que es gate COMPARTIDO.
  # Estaba fuera y en ROJO por dos asertos `==` que caducaban con cada adjudicacion
  # (el renombre blink->disk_error_resolve_drive los tumbo); convertidos a trinquete.
  re/tools/test_genero.py
  # La guarda default-deny de la propia puerta (#55): si un test_*.py no esta ni
  # aqui ni en FUERA-DE-PUERTA.txt, se pone rojo nombrandolo.
  re/tools/test_puerta.py
  # El testigo de la PUERTA PYTEST COMPLETA (rojos-invisibles, 25-08) — la MITAD QUE
  # FALTABA de la de arriba. La de #55 vigila la EXISTENCIA («¿alguien decidió sobre este
  # fichero?»); ésta vigila el COLOR («¿y pasa?»), que es lo que dejó OCHO rojos invisibles
  # hasta diecinueve dias. Entra en la puerta por el mismo motivo que test_puerta_vitest.py: los
  # cuatro caminos del predicado fallan EN SILENCIO —si no hiciera nada, la corrida saldría
  # verde igual— y una puerta sin testigo es decoración. 13 tests, ~4 s (dos de ellos
  # invocan pytest en subproceso). Lleva el MUTANTE del encargo sembrado dentro: crea un
  # test_*.py sin registrar en re/tools y exige que test_puerta.py se ponga rojo
  # NOMBRÁNDOLO, con su control positivo (retirado el intruso, vuelve a verde).
  re/tools/test_puerta_pytest.py
  # Predicado de `censo_filas_represadas.py`, la guarda del REPARTO (0,06 s, sin git
  # ni disco: casos sinteticos). ENTRA AQUI y no el censo EN VIVO, a proposito: el
  # represamiento es el estado NORMAL de una flota sana —mientras un compañero tenga
  # trabajo en vuelo el censo devuelve 1— y una puerta que se enciende por el
  # funcionamiento normal se silencia, y con ella las que si discriminan. Lo que se
  # vigila es que el PREDICADO funcione: el dia que se escribio, en vivo daba 0
  # represadas, y un predicado roto tambien da 0. Por eso el test lleva CONTROL
  # POSITIVO (un caso que DEBE saltar) ademas de los cinco negativos.
  re/tools/test_censo_filas_represadas.py
  # El testigo del SELLO de esta misma bateria: corre el caso motivador (fallo a traves
  # de una tuberia ⇒ el terminal miente con 0 y el sello dice el rojo) y la guarda
  # estatica del `trap`. Una guarda que no corre es decoracion, asi que entra aqui.
  re/tools/test_bateria_sello.py
  # El testigo del CERROJO de exclusion entre worktrees (07-08). Entra porque su ausencia
  # ya costo una tanda de rojos que no eran de nadie: tres carriles corriendo a la vez sobre
  # los puertos fijos 52xx de companion_ea. Los cuatro caminos del cerrojo fallan EN SILENCIO
  # (si no hiciera nada, las dos corridas seguirian diciendo EXCLUSIVO), asi que lleva
  # CONTROL NEGATIVO: el caso sin cerrojo TIENE que solaparse o el positivo no prueba nada.
  re/tools/test_bateria_cerrojo.py
  # Los testigos de la PUERTA VITEST COMPLETA y de su re-run aislado (#221 + #308). Entran
  # porque esa puerta gobierna con default-deny los 449 ficheros de vitest y hasta hoy NO
  # TENIA NINGUNO: sus unicas menciones en el repo eran ella misma y la linea que la invoca.
  # Ademas #308 le ESTRENA predicado, que es cuando sembrar deja de ser opcional. Lleva la
  # PROPIEDAD DE SEGURIDAD (un aserto que falla NO se re-corre, con ejecutor que revienta si
  # lo llaman) y un control que corre vitest DE VERDAD contra un testigo que agota su plazo
  # — el unico que puede acreditar que el TEXTO que el predicado espera es el que vitest
  # escribe. MEDIDO: 19 tests en 1,8 s (el control real de vitest incluido).
  re/tools/test_puerta_vitest.py
  # #240 — GUARDA ANTI-RECURRENCIA: nadie vuelve a importar DESDE un `.test.*`. El commit
  # 15a34989 mato los 80 tests fantasma extrayendo `canonicalInit` a `tests/helpers/`, pero
  # eso arreglo las INSTANCIAS, no la CLASE: reaprovechar un fixture con
  # `import … from "./otro.test.js"` es el gesto natural y su castigo es invisible (no rompe
  # nada, solo duplica tests en el cardinal y triplicaria un rojo con tres nombres). Aqui
  # pasa a VIGILADA con default-deny, cero exenciones. 14 tests en 0,9 s sobre 1067 ficheros
  # de codigo; el predicado lee el fichero ENTERO porque la forma MULTILINEA (el `from` en
  # otra linea que el `import`) es justo la que un censo de una linea se come.
  re/tools/test_import_desde_test.py
  # Guarda default-deny de las afirmaciones RETIRADAS del corpus de publicacion (#75):
  # una premisa corregida que nadie propaga es una premisa viva. Corre en 0,2 s.
  re/tools/test_afirmaciones_retiradas.py
  # Guarda de VIGENCIA de la tabla de /differences contra el registro canonico (#66):
  # la entrega llevaba una nota en prosa avisando de su propia caducidad y el registro
  # crecio dos filas ESE MISMO DIA sin que nadie lo viera. Corre en 0,1 s.
  re/tools/test_tabla_differences.py
  # Los DOS testigos del generador de /differences (carril web/fase2, 20 tests en 0,3 s).
  # ENTRAN, y la puerta default-deny (#55) es quien los encontro: llegaron a `re/tools/`
  # sin linea aqui ni en FUERA-DE-PUERTA, y esta bateria se puso ROJA nombrandolos en el
  # aterrizaje. Es exactamente el caso para el que se escribio esa guarda — un test nuevo
  # que nadie habria echado de menos porque nadie sabia que existia.
  # Verifican fila a fila que la tabla publicada sale del registro canonico (#66/#66-bis),
  # no por recuentos: la clase de defecto que invirtio dos filas en produccion.
  re/tools/test_differences_filas.py
  re/tools/test_differences_pagina.py
  # #155 bloque 4 · el CENSO DE GRADOS de la cabecera del registro. Entra por la misma
  # puerta que las dos de arriba y con el mismo caso consumado detras: la cabecera publicaba
  # «Casi todo lo de aqui es DERIVADO ... Se dice en cada fila» y era falso por los dos lados
  # —siete filas sin grado, y el dominante es MEDIDO por mas del doble—, en los DOS espejos,
  # desde el estreno del documento. La cifra que la sustituye se recomputa: esta guarda corre
  # el generador y carea SU censo contra la frase publicada, en ES y EN.
  re/tools/test_grados_registro.py
  # #358 remedio b · EL ESCRITOR de las cifras del registro (registro_cifras.py --write).
  # Entra porque cierra la clase que el 16-08 casi publica una cobertura falsa: dos carriles
  # fusionan limpio la MISMA cifra recalculada a mano y la fusionada queda rancia sin
  # conflicto. Vigila punto fijo sobre el arbol, cura de siembras absurdas byte-identica, y
  # aborto ante anclas perdidas/duplicadas. 4 tests, 0,10 s, sin browser.
  re/tools/test_registro_cifras.py
  # #155 bloque 4 (cierre) · PARIDAD DE CONTENIDO entre los dos espejos, entrada a entrada.
  # `comprobarParidad()` del generador compara CUÁNTAS entradas tiene cada sección; dentro de
  # una entrada no mira nada. Por ese hueco se perdió la tabla de conteo de §2.2 en el espejo
  # INGLÉS —el que se publica— justo la que deriva el 4/61, y el texto seguía remitiendo a
  # ella. Esta guarda cuenta tablas markdown por entrada y nombra la que discrepa.
  re/tools/test_paridad_espejos_registro.py
  # #155 · la TABLA de la portadilla de /mejoras. Misma clase que las dos de arriba —
  # veredicto de artefacto, corre el generador y mira el HTML— y entra por el mismo motivo
  # que ellas con un caso ya consumado detras: la seccion publicaba «un buen tercio» de
  # entradas 🎯 escrito a mano, no llegan a la cuarta parte, y NINGUN artefacto del
  # repositorio relacionaba esa frase con el corpus del que hablaba. Aqui se recuenta
  # `docs/mejoras/*.md` en PYTHON (segundo calculo, no el del generador) y se carea contra
  # lo que la pagina dice. 13 asertos en las dos lenguas, 4 mutantes muertos, 0,2 s.
  re/tools/test_mejoras_tabla.py
  # EL RESUMEN VISUAL de esa misma portadilla (#172, pedido del usuario el 11-08). Es la
  # capa de arriba del modelo dos-capas y entra por una razon propia, no por parecido con
  # su hermano: un GRAFICO es donde una cifra falsa vive mejor, porque nadie recuenta una
  # barra. Recuenta `docs/mejoras/*.md` en PYTHON otra vez y carea las cuatro cifras por
  # etiqueta, las tres por documento y las capturas.
  # 🔴 La de capturas es una UNION y no una suma, y esta guarda nace de haberlo hecho mal:
  # la primera version del generador sumaba las capturas de cada entrada y publicaba 46
  # cuando las distintas son 44 (dos ficheros salen en dos entradas). Las tres magnitudes
  # del corpus —47 apariciones / 46 suma / 44 union— se parecen tanto que la mala pasa por
  # buena. 6 mutantes muertos (suma-en-vez-de-union, cero de ⚖️ perdido, documento que
  # cuenta de mas, resumen debajo de la tabla, marcador ausente en INGLES, captura perdida
  # en la traduccion) con control positivo verde. ~0,2 s.
  re/tools/test_mejoras_resumen.py
  # LA COBERTURA DE i18n TIENE PRODUCTOR (#167) — y esta guarda vigila al productor, no
  # a la cifra. El valor (84,6 % bruto / 91,1 % neto) va a SUBIR segun se traduzca, asi que
  # congelarlo daria un rojo por el trabajo bien hecho; lo que se fija es que el productor
  # siga midiendo lo que dice: la UNION y no la suma (las 26 superficies comparten 192
  # cadenas), el descuento de exentos aplicado y no vaciado, y los dos artefactos —lista de
  # conservados y tabla castellana— sin contradecirse.
  # 🔴 Y TRES MUTANTES DE FUENTE-AUSENTE, que es lo que de verdad hace falta aqui: un
  # productor «robusto» publicaria un porcentaje sobre poblacion vacia, que se sirve igual
  # de bien que uno bueno. Uno de los tres reproduce el 0,0 % que me dio a MI midiendo esto
  # a mano (las claves de es.json cuelgan de `strings`, no de la raiz). ~2 s.
  re/tools/test_i18n_cobertura.py
  # #63 · el soft-404 no puede volver. Entra porque el defecto que cierra es de los que se
  # leen AL REVES: el sitio devolvia 200 con la home para toda ruta muerta, y una
  # verificacion de despliegue que pedia un asset no propagado recibia 200 con un hash
  # «distinto» = un ROJO FABRICADO. Discriminado con tres variantes bajo `wrangler pages
  # dev`: lo que apaga el soft-404 es que EXISTA `404.html`; la regla comodin
  # `/*  /404.html  404` que el repo se atribuia era INERTE (404 no es codigo valido en
  # `_redirects`, Pages la descarta). Esta guarda vigila las dos condiciones reales y que
  # los tres ficheros no vuelvan a atribuirselo a la regla. 5 mutantes; alcance declarado
  # en su cabecera (es de FICHEROS FUENTE: no levanta servidor). Corre en 0,1 s.
  re/tools/test_redirects_404.py
  # #130 · ningun sitio ensamblado DENTRO del repo. Entra porque el defecto que cierra
  # FABRICA ROJOS AJENOS: mientras `demo-byo/dist-sitio` existia, test_genesis_manifiesto
  # daba 66 ficheros de medios en rojo —correctamente, escanea el sistema de ficheros a
  # proposito— y toda bateria corrida entre ensamblar y limpiar parecia una regresion de
  # quien la corriese. El runbook ya ensambla en `mktemp -d` fuera del arbol y despliega el
  # directorio POR RUTA (el posicional de `wrangler pages deploy` gana a la configuracion,
  # medido en su propio cli.js); esto es el trinquete de las tres condiciones. NO se arregla
  # excluyendo `dist-sitio` en el genesis: excluir POR NOMBRE debilita el default-deny.
  # 4 mutantes; corre en 0,1 s.
  re/tools/test_sin_dist_sitio.py
  # #129 · la plantilla de entorno no puede quedarse atras de sus consumidores, y el build
  # DECLARA de que poblacion sale. Entra porque el defecto que cierra es SILENCIOSO: los
  # .env no se trackean, el principal hornea y un worktree no, las dos poblaciones compilan
  # y dan verde, y el artefacto difiere. MEDIDO el 09-08 en openu5.org: /play servia la
  # clave de analitica y /byo NO — misma web, dos builds, y nadie lo habia notado. La
  # guarda NACIO ROJA: `VITE_RECORDS_API` llevaba tiempo leida por el codigo y sin declarar
  # en la plantilla. Vigila el censo en las dos direcciones, que cada variable diga QUE PASA
  # SI FALTA, y que el ensamblador mida la poblacion EN EL BUNDLE y no en el entorno.
  # 5 mutantes (uno de ellos, la plantilla original). Corre en 0,2 s.
  re/tools/test_env_poblaciones.py
  # #141 · la Y de las bocas de mazmorra es DATA.OVL 0x1ee2, no 0x1eea (que es MOON_PHASES).
  # NACIO ROJA sobre los CINCO sitios que la citaban mal (la ficha decia tres: faltaban el
  # test del sello y el e2e de Doom, y una de las cinco tenia la cita PARTIDA en dos lineas,
  # que es lo que perdia el censo por linea — misma forma que #140). Persigue LA PAREJA, no
  # el numero: 0x1eea tiene otros TRES referentes CORRECTOS (MOON_PHASES, la curva
  # 0x1eea-0x1ef4 del hechizo de area, y dos_select_drive en ULTIMA.EXE), asi que una guarda
  # sobre el numero enrojeceria por los buenos. Lleva control POSITIVO (caza la forma
  # partida) y NEGATIVO (no caza los tres usos legitimos ni la nota que documenta la errata),
  # y un control contra el binario que ADJUDICA: 8/8 con 0x1ee2 frente a 0/8 con 0x1eea.
  # Corre en 1 s.
  re/tools/test_bocas_tabla_y.py
  # #134 · el censo de /verificacion SALE del artefacto. VEREDICTO-DE-ARTEFACTO: corre el
  # inyector sobre una copia y carea lo producido contra frontier.json releido con una
  # implementacion INDEPENDIENTE. Entra porque la unica guarda que vigilaba esa tabla
  # (guarda_cifras.py) NO corria en la bateria —solo la invocaba el ensamblador—, asi que la
  # [RANCIO CORREGIDO 10-08 por #140: hoy SI corre, cableada en la linea ~594 de este mismo
  #  fichero. Se deja el hecho historico en PASADO porque es lo que motivo a este test; el
  #  presente decia lo contrario que el propio script 300 lineas mas abajo.]
  # pagina publico cinco dias «422 leidas, quedan 298» con el artefacto diciendo 722 y 1.
  # Su aserto central es que los CUATRO conjuntos de cardinal 722 son distintos: la pagina
  # tiene prohibido decir «722 de las 722 filas de juego» (la interseccion es 721).
  # 4 mutantes; corre en 0,1 s.
  re/tools/test_censo_inyectado.py
  # LA CABECERA UNICA (07-08, carril web-cabecera). Renderiza las 15 formas de llamada a
  # `cabecera.mjs` y exige que no diverjan, MAS un censo del arbol que caza una cabecera
  # escrita a mano fuera del modulo. Entra porque el defecto que cierra es de los que se
  # reproducen solos: habia NUEVE barras a mano y DOS las escribio el mismo carril en una
  # mañana, copiando el patron de las que ya estaban. Sin algo que se ponga rojo, la decima
  # nace igual. 8 mutantes; parcialidad declarada en su cabecera (es ESTRUCTURAL: no ve el
  # navegador). Corre en 2,4 s.
  # 🔴 Y esta linea la exigio la guarda de al lado: `test_puerta.py` se puso ROJA nombrando
  # `test_cabecera_unica.py` en mi primera corrida — un test nuevo que nadie habria echado
  # de menos porque nadie sabia que existia. Funciono exactamente como se diseño.
  re/tools/test_cabecera_unica.py
  # LOS PARES DE IDIOMA QUE NO SON CONTENIDO (11-08, carril paridad-en, lote 5 de #157).
  # `aria-label` y `alt` no los alcanza el `innerHTML` del aplicador bilingüe, así que
  # viajan en pares `data-es-aria`/`data-en-aria` y `data-es-alt`/`data-en-alt`. Los tres
  # modos de fallo que vigila son MUDOS: par a medias, par sepultado bajo un ancestro
  # `[data-es][data-en]` (el innerHTML del padre le borra el subarbol al conmutar) y par
  # en elemento vacio. Entra en la puerta porque el defecto que cierra lo cometi YO en
  # este mismo lote: el censo de FASE 1 leyo el HTML SERVIDO —que esta en castellano— y
  # declaro «solo en castellano» tres alt que ya eran bilingues por su nodo padre; el
  # arreglo obvio metia un segundo origen del mismo texto, y muerto. Interroga tambien al
  # PRODUCTOR (cabecera-cli.mjs, el mismo que usa este script en §CABECERA), porque la
  # portada y el 404 dan CERO pares en su fuente: los suyos se inyectan al construir.
  # 7 mutantes muertos, incluido el gate invertido y el cardinal exacto de 4 rotulos
  # (con `>= 3` sobrevivia el que retira uno). Corre en 0,2 s.
  re/tools/test_paridad_atributos_idioma.py
  # LA TARJETA DE PARTIDA DE /byo (07-08, carril byo-brainstorm). Entra porque los tres
  # defectos que cierra estaban EN PRODUCCION y ninguno daba error: la tarjeta leia un campo
  # ADYACENTE al dato que queria enseñar y lo publicaba como el dato — el roster de 16 por el
  # grupo, «mapa grande» por CUAL mapa, y una tabla que el port declara no sincronizada por el
  # estado de la trama. Se midieron deserializando dos saves REALES; sin algo que se ponga
  # rojo, la siguiente lectura de un campo vecino nace igual.
  # Llama a las funciones REALES bajo node (no hace grep sobre el .ts: un predicado de FORMA
  # habria pasado verde con los tres defectos dentro, que es como llegaron a produccion).
  # 23 asertos (10 de ellos RECIPROCAS: sin ellas pasan fixes a medias — «devolver siempre el
  # mapa del Underworld», «quitar la cache entera», «leer el byte antes que el flag»). Se
  # salta solo si no hay node/tsx (worktree sin symlink). Corre en ~0,3 s.
  re/tools/test_byo_tarjeta.py
  # LA FICHA RICA de la tarjeta de /byo (08-08, carril tarjeta-rica). Es el bloque NUEVO que
  # lee lo que la portada no leia: las dos lunas, la bolsa, la trama y el roster. Entra por
  # una familia de defectos que la de arriba no cubre y que sale SOLO al leer campos
  # OPCIONALES: RELLENAR LA AUSENCIA CON UN CERO. /byo lee el JSON crudo y no aplica
  # SAVE_OPTIONAL_DEFAULTS, asi que la ausencia es el caso NORMAL (18 de 63 campos ausentes en
  # las DOS partidas medidas, 11 mas solo en la que paso por una carga); un «0 de 8 santuarios
  # destruidos» sobre un campo que no esta se lee igual que uno medido.
  # Y el caso que le da nombre: las fases de luna son un byte CRUDO (fase = valor - 0x30) cuyo
  # rango es 0x30..0x37. Comprobar solo «esta el campo?» y no «esta EN RANGO?» pinta LA FASE
  # -48 sobre el estado inicial del port, que trae los dos bytes a cero.
  # 27 asertos · 16 mutantes por causa, todos muertos. Dos de ellos valen doble: M4 revivio un
  # defecto REAL que tuve puesto (radio del terminador lineal ⇒ rx hasta 2,5, un terminador
  # mas ancho que el disco, con las cuatro primeras fases saliendo bien); y M12 hace divergir
  # los DOS lectores del grupo (`tamanoGrupo` en partidas.ts y `grupo()` en tarjeta-rica.ts,
  # dos calcos del mismo predicado de party.ts:171) — sin ese careo se separan sin avisar.
  # 🔴 TRAE ADEMAS EL CRUCE DE ICONOS A LA BATERIA. El control OBJETO→SPRITE que nacio del
  # defecto de la caja de sandalo vivia solo en `verifica-estados.mjs`, que por su propia
  # cabecera NO va en la bateria (depende de material de EA). El cruce no necesita nada de EA
  # —son tres ficheros tracked— asi que se replica aqui, con su RECIPROCA (todo icono de
  # TILE_DE entra en el cruce: sin ella, un icono nuevo entra sin cotejar y el aserto sigue
  # diciendo «cero discrepancias»). Los asertos de PIXEL siguen en la sonda del navegador.
  # Se salta solo si no hay node/tsx. Corre en ~0,3 s.
  re/tools/test_byo_tarjeta_rica.py
  # EL MAPA equip-ID → NOMBRE (09-08, tarea #122). Re-deriva de DATA.OVL las 48 entradas de
  # las DOS tablas de nombres (DS 0x1962 corta y DS 0x17f6 larga) y las carea con los JSON
  # volcados del port, en vez de creerse el `_provenance` que llevan escrito. La segunda
  # fuente del careo es la tabla de TIPOS (DS 0x1a7e = `TYPE_TABLE` de `equip.ts`): otro
  # offset y otra estructura sobre el MISMO índice, que tiene que decir lo mismo de cada id.
  # Entra en la batería porque esas 48 cadenas ya se PINTAN en la ficha rica de /byo (6
  # ranuras × 6 personajes), y un índice desplazado daría 36 rótulos plausibles y falsos.
  # Se salta solo si no hay material de EA (worktree sin symlink de original/). Corre en 0,1 s.
  re/tools/test_equip_nombres.py
  # LOS MOMENTOS LEGENDARIOS de /byo (08-08, carril byo-momentos). Entra por DOS razones
  # distintas, y la segunda es la que no se puede dejar fuera:
  #   · CONDUCTA — asevera sobre los 4192 B HORNEADOS (no sobre el def), y el momento 1
  #     ocurre justo donde arranca el juego, o sea que sus asertos coinciden casi campo por
  #     campo con una partida nueva: sin los CUATRO mutantes (planta/grupo/shard/hora, que
  #     corren el MISMO predicado y tienen que morir) el fichero pasaria verde con el def
  #     borrado.
  #   · LICENCIA — dos asertos vigilan que el catalogo publicado no lleve estado y que
  #     ningun `.gam` de momento este trackeado. El estado de un momento se compone en el
  #     navegador contra el INIT.GAM DEL VISITANTE justamente porque un GameState completo
  #     lleva el roster de 16 registros de EA (REGLA 4). Ese limite no se sostiene solo.
  # Se salta si faltan node/tsx o game/assets. Corre en ~1,4 s.
  re/tools/test_byo_momentos.py
  # LLEVARSE UNA PARTIDA A OTRO DISPOSITIVO + el regimen limpio del popover (08-08, carril
  # export-replay). Entra por la misma razon que test_byo_tarjeta: el modo OBVIO de exportar
  # —mandar solo los 4192 B del SAVED.GAM— no da un fichero peor, da UNA PARTIDA DISTINTA con
  # pinta de buena, y las dos formas del defecto ya estaban medidas en este repo (los
  # Shadowlords muertos viven en questFlags, que el formato de 1988 no guarda; y worldObjects
  # tampoco, que es la ficha #106 de la fragata que desaparece). El testigo lleva esos campos
  # POBLADOS: con un estado sin ellos, el mismo test pasaria verde con el sobre borrado.
  # La otra mitad es el RECHAZO: parseSaveWindow lee bytes y no lanza jamas, asi que
  # cualquier fichero de 4192 B produce un GameState de tipos impecables — assertValidState no
  # puede cazarlo. 9 invariantes rotos de uno en uno + 2 controles negativos.
  # Corre las funciones REALES bajo node+jsdom (no hace grep sobre el .ts). ~7 s: cinco de
  # ellos son la ESPERA REAL al temporizador de apagado de la barrita, que es la propiedad
  # entera y no se puede acelerar sin dejar de medirla. Se salta sin node/tsx/jsdom.
  re/tools/test_byo_transferencia.py
  # EL NOMBRE DEL SITIO en las superficies que ensenan una partida (09-08, carril
  # nombres-lugar). Reporte del usuario: la lista de guardados decia «Palace_of_Blackthorn»
  # — el IDENTIFICADOR DE MAQUINA del extractor, que catorce de las 32 locations llevan con
  # guion bajo. Entra por DOS clases distintas:
  #   · CONDUCTA — pinta de verdad, bajo jsdom, las DOS superficies (la lista del juego y la
  #     tarjeta de /byo) y lee el TEXTO DEL DOM. Un aserto sobre el retorno de un helper
  #     habria pasado verde con la tarjeta sin engancharlo: el defecto ERA un texto en
  #     pantalla. Y una de las dos partidas del testigo esta guardada ANTES del fix, con el
  #     identificador literalmente dentro del indice — el caso de COMPATIBILIDAD, que es el
  #     que decide el diseno (se remapea al pintar, no se migra el indice de nadie).
  #   · NO-DERIVA — `core/location-display.ts` congela los 32 nombres porque /byo los
  #     necesita sin extraccion cargada, y una tabla a mano es una foto que caduca. El arnes
  #     la RE-DERIVA de sus tres fuentes (el pool `locationNames` de DATA.OVL, los nombres
  #     que momentos.json ya publica, y los identificadores del extractor) y esto la carea
  #     fila a fila: cambiar un nombre exige cambiar la fuente.
  # El verde «no aparece el guion bajo» es VACUO por construccion (pasa con el DOM vacio),
  # asi que cada superficie trae su CONTROL —una partida en «Britannia», que no se remapea—
  # con su propio test. 13 asertos · 10 mutantes por causa, todos muertos (entre ellos el
  # title-case con `\b`, que da «Iolo'S Hut», y el `id-1` llano en el pool EMPAQUETADO, que
  # devuelve el nombre de OTRO sitio en silencio).
  # Se salta solo si no hay node/tsx. Corre en ~1,2 s.
  re/tools/test_nombres_lugar.py
  # LA GUARDA ANTI-CEGUERA DEL ARNES PIXEL-DIFF (#133, commit deliberado del lead 09-08).
  # Los dos pytest de game/tools/pixeldiff eran HUERFANOS DE VERDAD — se declaraban asi en
  # su propia cabecera («no se engancha a ninguna suite del repo») y test_puerta no los veia
  # por vivir fuera de re/tools. Uno de ellos (test_idx6_is_brown) es, por su docstring, la
  # guarda que impide que la comparacion original-vs-port se quede oliva-contra-oliva y deje
  # de ver regresiones de paleta. 10 tests en 0,3 s medidos, sin EA ni red.
  game/tools/pixeldiff/test_pdlib.py
  game/tools/pixeldiff/test_compare.py
  # EL BARRIDO DE «Borrar datos locales» de /byo (08-08, carril byo-shots-clean). Entra por
  # la razon por la que existe: la lista de lo que se borra es POR PREFIJOS, y un prefijo que
  # se queda corto NO DA ERROR — el boton sigue diciendo «borrado» y deja restos, que es la
  # peor forma de fallar para algo destructivo. Este fichero CENSA `game/src`, `demo-byo/src`
  # y `extractor/src` (302 fuentes), resuelve todo literal que llegue a un `.setItem(`
  # —incluidos los que viajan por constante importada y RENOMBRADA, que son la mayoria— y se
  # pone rojo NOMBRANDO la clave que los prefijos no cubran y su fichero:linea. Default-deny
  # en los dos ejes: tambien enrojece un identificador que no sepa resolver, porque un censo
  # que se encoge en silencio da verde por no haber mirado.
  # Lleva sus dos controles dentro (no-vacuidad del censo · clave plantada que TIENE que
  # señalarse) y no toca red ni navegador. Corre en 0,8 s.
  re/tools/test_byo_limpieza.py
  # COMPARTIR UN MOMENTO POR URL + INSIGNIAS DE PROGRESO (09-08, carril byo-extras). Entra
  # por la puerta que exige `test_puerta.py`: todo test_*.py esta aqui o en FUERA-DE-PUERTA
  # con su razon, y este es el gate del carril, no un extra. Cubre el parser del enlace
  # (`?momento=`), los tres avisos de un enlace que no puede abrir la galeria, y el sello de
  # aperturas. Lleva el mutante M1, que RESUCITA el criterio de «jugado» que el propio carril
  # refuto — el que se pedia en el encargo no puede ocurrir nunca, y sin M1 nada impediria
  # volver a cablearlo. Sin red ni navegador; 3,7 s.
  re/tools/test_byo_comparte.py
  # QUINTA guarda sobre el registro de bugs (07-08, carril cola-cast). Las cuatro de arriba
  # atan la TABLA al registro; ésta ata al registro con SIGO MISMO: recalcula la cifra de
  # cobertura del propio fichero y exige que la frase publicada la diga, en los dos espejos.
  # Entra porque la cifra que sustituye —«12 de 12 filas»— estuvo PUBLICADA y viajando al
  # repo público sin coincidir con ningún denominador en ningún commit de la historia, y
  # porque su segunda mitad convierte en EJECUTABLE la regla de marcar «(sin verificar)» que
  # el documento enunciaba en prosa y llevaba desde su estreno incumpliendo en una fila.
  # Corre en 0,06 s.
  re/tools/test_cobertura_port.py
  # CENSO DE CUERPO LEIDO de las filas pendientes (encargo del lead 07-08). Entra porque
  # su cifra decide un titular del goal («la deuda es de SELLAR, no de leer») y porque su
  # primera version se media a SI MISMA sin dar ninguna senal. Vigila: predicado
  # compartido con frontier, exclusion de circularidad, y el TRINQUETE del panel de 8
  # (FP==0 duro; aciertos solo pueden subir). Corre en ~20 s.
  re/tools/test_censo_cuerpo.py
  # Los DOS generadores de la fase 3 (`/estado` + `/en/status`, `/jugar` + `/en/play`),
  # corridos de verdad contra un destino temporal: 52 casos en 0,6 s. ENTRAN porque
  # `/estado` es la pagina mas facil de falsificar del sitio —sus cifras son creibles por
  # construccion, y el prototipo del que sale el encargo publicaba una taxonomia entera
  # que no existe en ningun artefacto— y porque tres de sus casos fijan defectos que ya
  # ocurrieron y que NINGUNA comprobacion estructural veia:
  #   · el `15` pelado sin su par (1 estructural + 14 de trabajo real);
  #   · el espejo ingles publicando los rotulos CASTELLANOS del registro de bugs;
  #   · un numero de situaciones desmentido por su propia tabla (7 anunciadas, 6 filas).
  # Y uno que cazo el NAVEGADOR y no un test: marcas `**` de markdown sin convertir en el
  # texto visible, por una cursiva anidada en una negrita que este parser no cierra.
  re/tools/test_estado_jugar_pagina.py
  # EL PANEL de `/estado` (#155, modelo dos-capas). Entra por lo mismo que su hermano de
  # arriba y por tres defectos que ocurrieron AL ESCRIBIRLO, ninguno visible en el fichero:
  #   · el CSS del panel perdia por ESPECIFICIDAD contra la hoja de prosa (`.u5-doc h3` es
  #     (0,1,1) y `.p-rot` (0,1,0)), y al prefijarlo se quedaron muertas las media queries
  #     por la razon inversa — panel a cuatro columnas en un telefono, sin un solo aviso;
  #   · un mutante que VACIABA la tarjeta de salas salia VERDE porque el comentario del CSS
  #     que explica esa cifra la citaba: la prosa que documenta la guarda la satisfacia;
  #   · un par de acentos graves en un comentario del CSS cerro la plantilla de JavaScript
  #     (cuarta vez en este repositorio, con la regla escrita en tres sitios).
  # Trae CINCO mutantes que acreditan las guardas del generador — sin ellos, «el panel esta
  # vigilado» seria indistinguible de «el panel no tiene guardas». ~18 s.
  re/tools/test_estado_panel.py
  # EL RESUMEN de `/verificacion` (#155, lote 3) contra SU PROPIO CUERPO. Entra porque el
  # modelo dos-capas crea, por construccion, SEGUNDAS COPIAS EN LA MISMA PAGINA: el resumen
  # de arriba repite tres cifras que viven mas abajo con su fuente. El dia que alguien
  # actualice la tabla y no el resumen, la pagina se contradice a si misma a dos pantallas
  # de distancia — el defecto mas dificil de ver que hay, porque las dos mitades estan bien
  # escritas y nadie las lee seguidas (es la clase del «422 leidas» frente al 722, cinco
  # dias invertida). Las cinco clases se DERIVAN contando las filas de su tabla.
  # Y lleva el default-deny de una frase que estuvo PUBLICADA: la celda de la Clase E decia
  # «completable con lo que hay», suprimiendo el condicionante que su propia fuente pone y
  # que la celda VECINA de esa misma fila declara pendiente. Acreditada con control real:
  # dispara sobre la version anterior del fichero. Corre en 0,06 s.
  re/tools/test_verificacion_niveles.py
  # EL RECT DE LA CONSOLA contra su descriptor en el binario (08-08, ficha #113). Entra
  # porque la cifra que vigila llevaba MESES equivocada con su cita al lado: el port ponía
  # `botRow: 22` (doce filas) donde INTRO.OVL:0x0d2e pone 0x17 (TRECE), y eso subía toda la
  # consola un renglón — el careo del vídeo split-screen daba 0,03 de similitud en esa
  # región y nadie lo había atribuido. El comentario con la cita YA ESTABA; lo que faltaba
  # era algo que la COMPROBARA. Es de dos lados: re-extrae los cinco argumentos del disasm
  # en cada corrida (no los copia del comentario) y los carea con el literal de skin.ts, con
  # las ventanas HERMANAS del mismo bloque —pantalla completa y panel 1..9— de ancla del
  # orden de argumentos. Aborta si faltan los .asm en vez de dar verde vacío. Corre en 0,1 s.
  re/tools/test_consola_rect.py
  # LA ARITMÉTICA DE LA SEMILLA DE RELOJ (10-08, ficha #165). El registro de bugs publicaba
  # tres cifras (8.640.000 lecturas · 2688/4096 producibles · el 20 no está) con el cabo
  # declarado «no tiene fuente fuera de este registro; nadie la ha replicado». Este test ES
  # la fuente: re-extrae las constantes del cuerpo de ULTIMA.EXE:0x2056 en cada corrida (no
  # las copia), re-deriva el conjunto entero y CAREA las cifras contra los DOS espejos del
  # registro — mutantes muertos por los dos lados (2689 en ES y 2687 en EN, nombrados).
  # Aborta si falta el .asm. Corre en 0,2 s.
  re/tools/test_semilla_reloj.py
  # EL GATE DE `absorb` — LA REGLA DE ARRANQUE DEL DESENLACE (11-08, ficha #175). Mismo molde
  # que los dos de arriba, y por la misma razón: el corpus leía TRES de los cuatro términos
  # del filtro de SJOG.OVL 0x1ea4 al revés (la FILA por un «estado de IA», la COLUMNA por un
  # índice de sprite, CAÍDO por bando) y de esa lectura salía una frase FALSA publicada en
  # /verificacion. Re-extrae los cuatro términos del disasm en cada corrida, más las dos
  # anclas del layout del registro de combatiente (los literales North/South de
  # move_combat_actor y el [si+7]<<5+[si+6] de COMBAT.OVL 0x0c26), censa que el centinela
  # 0x4d siga con UN SOLO escritor, carea el grupo de tiles contra look2 con tres controles,
  # y veta que la tarjeta reafirme la frase retirada sin su retractación al lado. Siete
  # mutantes corridos uno a uno. Aborta si faltan los .asm o game/assets. Corre en 0,2 s.
  re/tools/test_absorb_gate.py
  # FICHEROS DE PATRONES SIN COMENTARIO APENDIZADO (10-08). Marcar 9 entradas de .gitignore
  # con «# SUPERADA» al final de línea las rompió las nueve (gitignore no admite comentario
  # en línea) y el sello salió EXIT=0 + DIRTY=true — la puerta pasa y el árbol se ensucia en
  # la fase que menos se mira. Censo sobre TODOS los .gitignore trackeados (denominador
  # ancho), con guarda de población no-vacía. Corre en 0,1 s.
  re/tools/test_ficheros_patrones.py
  # MINIATURAS DE /byo POR CLASE (#174, carril byo-thumbs 11-08; PROMOVIDO desde
  # FUERA-DE-PUERTA por el lead — commit deliberado, doctrina #123). La tarjeta de replay
  # recortaba las miniaturas LEGADAS al 43,1% por cover sobre caja fija; el fix es contain, y
  # esta guarda censa la CLASE entera de reglas de miniatura en byo.html (no una ruta
  # cableada — la trampa de #178) con control positivo. El testigo LEGADO existe porque a
  # 320×200 cover y contain COINCIDEN y el aserto pasaría con el fix borrado. Sin navegador,
  # 0,06 s.
  re/tools/test_byo_miniaturas_fit.py
  # GEOMETRIA DE LA TARJETA DE PARTIDA EN LOS DOS MOTORES (#241, reporte del usuario 13-08).
  # Hermana de la de arriba y NO la misma pregunta: aquella es un predicado sobre la HOJA DE
  # ESTILO (0,06 s, sin navegador) y esta mide RECTANGULOS PINTADOS, que es donde vivia el
  # defecto — la columna del texto se estrechaba a dos palabras por linea y los chips se
  # metian debajo de Continuar/Descargar. Entra en la puerta porque la causa es INVISIBLE en
  # Chromium: con el arreglo quitado, Chromium da las tres magnitudes IDENTICAS y solo WebKit
  # se mueve (0 -> 338,77 de columna muerta, 338,77 -> 0 de columna de texto). Una puerta de
  # un solo motor habria estado verde encima de la foto del usuario.
  # Coste: ~52 s (build de demo-byo + 2 motores x 4 casos, dos corridas del arnes porque el
  # mutante es una de ellas). Puerto EFIMERO (listen(0), la receta de #5): no disputa numero
  # con ningun carril. Fichero NUEVO en la puerta — declarado, doctrina #123/#221.
  re/tools/test_byo_tarjeta_geometria.py
  # ARNÉS VISUAL DEL DESENLACE (#176, hueco 2 de /verificacion). La COMPARACIÓN de imagen
  # es manual (pide ffmpeg, el .mov del testigo —material de EA, gitignored— y chromium);
  # meterla aquí la ataría a artefactos que no viajan y en cualquier máquina sin ellos
  # pasaría por AUSENCIA. Lo que entra en la puerta es la guarda de que ese paso manual no
  # se pudra en silencio: las fases y las páginas del manifiesto se re-extraen del pacer,
  # los modos de compare.py, el acotamiento del disparador es un predicado, y el sha1 de
  # los manifiestos ata los veredictos sellados a la definición con la que se midieron —
  # tocar casos o regiones sin re-medir es ROJO. 8 asertos, 6 mutantes muertos. 0,1 s.
  re/tools/test_endgame_visual.py
  # PARTIDAS PREDEFINIDAS SIN MATERIAL DE EA (#158, carril ver-partida 11-08; PROMOVIDO
  # desde FUERA-DE-PUERTA por el lead — commit deliberado, doctrina #123). Los ficheros
  # game/partidas/*.json son TRACKEADOS y no pueden llevar estado del juego (el ancla trae
  # el roster de INIT.GAM; el diario, prosa de EA verbatim). Mecanismo: lista BLANCA a toda
  # profundidad — lo prueba el mutante M5, que mete un campo INVENTADO y cae igual (una
  # lista negra jamás lo habría previsto). Corpus por CLASE (glob, #178), aserto de
  # no-vacuidad, 12 tests, 5 mutantes. Sin EA, sin red, sin navegador. 0,07 s.
  re/tools/test_partidas_sin_ea.py
  # test_citas_del_port_publicadas (#204, promocion del lead): toda cita al port del corpus
  # publicado tiene que RESOLVER (fichero existe, linea cabe) — 0,2s, y en su primera corrida
  # cazo una cita rota viva en los dos espejos. Declara que NO carea prosa con codigo, y por que.
  re/tools/test_citas_del_port_publicadas.py
  # RESULTADO DE NAVEGADOR PUBLICADO EN /verificacion (#177, 11-08). Los huecos 4 y 5 de la
  # página pasan de «no lo hemos hecho» a «lo hicimos el día tal», y eso mete dos mentiras
  # posibles que el inyector NO ve: (a) el resultado publicado sin su FECHA y su commit —una
  # foto leída como afirmación sobre el presente—, y (b) la cobertura WebKit afirmada
  # después de que alguien retire el proyecto `iphone-webkit` del config móvil, con la
  # página sosteniendo un arnés que ya no existe. Carea además el artefacto (corrida
  # completa, árbol limpio, la suma de configs = el total) y que el espejo siga EXCLUIDO
  # CON SU RAZÓN, que es lo que impide que sus 6 pruebas-de-conformidad se cuelen en un
  # total de regresión. NO exige que el resultado sea verde: un rojo con fecha es
  # publicable. Corre en 0,1 s.
  re/tools/test_suite_navegador.py
)

# 🔴 GUARDA DE game/assets (07-08). Su ausencia NO se manifiesta como «falta un fichero»:
# da QUINCE ROJOS DETERMINISTAS, todos en test_companion_ea, con pinta de regresión propia
# —y con la flota en paralelo, con pinta de contención—. Le pasó a DOS carriles el mismo día
# siguiendo al pie de la letra la receta de symlinks de la REGLA 2, que nombraba tres enlaces
# y omitía éste (medido: 5 de 43 worktrees sin él). Misma forma que la trampa de `re/disasm`:
# el enlace que falta no aborta, DEGRADA. Aquí aborta.
if [ ! -e game/assets ]; then
  echo "BATERIA: falta game/assets (gitignored) — symlinkealo desde el checkout principal." >&2
  echo "         Sin el, test_companion_ea da 15 rojos que PARECEN regresion y no lo son." >&2
  echo "         Son CUATRO symlinks (REGLA 2), no tres: node_modules de la RAIZ," >&2
  echo "         game/node_modules, game/assets y original/. EXIT 64." >&2
  exit 64
fi

# 🔴 TSC TEMPRANO (13-08, cabo de winds-fixes-2 adoptado por el lead). Hasta hoy `tsc` sólo
# llegaba a la batería DE REBOTE, dentro del fixture de test_byo_momentos (`npm run build
# -w game`): un error de tipos de DOS líneas se presentaba como DIEZ ERRORs de fixture a
# media corrida, y adjudicarlo costó una tanda entera (TS7016 de un test nuevo — tsconfig
# lleva include:["src","tests"], así que CUALQUIER fichero de test entra al programa).
# Aquí cuesta segundos y nombra la causa en la PRIMERA línea. Se salta solo si no hay
# toolchain (worktree sin symlink de node_modules), igual que las demás guardas de entorno.
if command -v npx >/dev/null 2>&1 && [ -e game/node_modules ]; then
  if ! TSC_SALIDA=$( (cd game && npx tsc --noEmit) 2>&1 ); then
    echo "BATERIA: tsc --noEmit ROJO — el arbol no compila; esto NO es un rojo de tests." >&2
    echo "$TSC_SALIDA" | head -10 >&2
    echo "         (guarda temprana del 13-08: antes este error aparecia como 10 ERRORs" >&2
    echo "          de fixture en test_byo_momentos, a media corrida). EXIT 64." >&2
    exit 64
  fi
  # 🔴 Y EL TSC DE E2E (#369, 16-08): game/tsconfig.json incluye src+tests y deja game/e2e
  # fuera — por ahi entro a main un spec con 3 errores TS (cannon-projectile, ce473acc) que
  # esta puerta selló verde. El gate EXISTIA (tsconfig.e2e.json + npm run typecheck:e2e,
  # deuda #4 del Grand Tour, citado en ~20 actas) pero la puerta de aterrizaje nunca lo
  # invocaba: la misma clase que #267 (game/tools), confirmada con caso real. NO se fusionan
  # los tsconfig: e2e necesita types node+playwright y src lleva vite/client — ampliar el
  # include debilitaria el gate de src. Coste medido: ~1,7 s.
  if ! TSC_E2E_SALIDA=$( (cd game && npx tsc --noEmit -p tsconfig.e2e.json) 2>&1 ); then
    echo "BATERIA: tsc e2e ROJO — las specs no typechequean; esto NO es un rojo de tests." >&2
    echo "$TSC_E2E_SALIDA" | head -10 >&2
    echo "         (guarda de #369: un spec que no compila puede estar midiendo menos de" >&2
    echo "          lo que dice; antes entraba a main en silencio). EXIT 64." >&2
    exit 64
  fi
  # 🔴 Y EL TSC DE TOOLS (#267, 17-08): misma clase que e2e — el gate por fin invocado
  # desde la puerta. Los 24 errores historicos vivian en los .mts (un censo por *.ts no
  # los veia) y el caso real de #267 eran referencias muertas que solo salian al ejecutar.
  # Coste medido: ~1,4 s.
  if ! TSC_TOOLS_SALIDA=$( (cd game && npx tsc --noEmit -p tsconfig.tools.json) 2>&1 ); then
    echo "BATERIA: tsc tools ROJO — game/tools no typechequea; esto NO es un rojo de tests." >&2
    echo "$TSC_TOOLS_SALIDA" | head -10 >&2
    echo "         (guarda de #267, patron #369). EXIT 64." >&2
    exit 64
  fi
fi

# 🔴 CAREO PRE-VUELO DE LA FOTO DE NAVEGADOR (#257, 14-08). Cualquier carril que añada un
# `.spec` e2e mueve el censo de `playwright --list` y deja `re/ledger/suite-navegador.json`
# hablando de otra población. Eso YA estaba vigilado —`resultadoNavegador()` lo carea y
# lanza— pero DONDE nadie lo busca: dentro del generador de /estado, o sea en
# `test_estado_panel`/`test_estado_jugar_pagina`, a unos 8 minutos de corrida. Lo que el
# carril veía entonces eran 73 síntomas (6 mutantes «por otra causa» + 67 ERRORs de fixture)
# que NO nombran la causa, y media hora de bisección. Medido por viewgem-247 al comprarlo.
#
# ★ NO ES UNA CONDICIÓN NUEVA EN LA PUERTA — es la MISMA, cuatro segundos después de
#   arrancar y diciendo qué pasa. El script llama a `resultadoNavegador()`, no reimplementa
#   su predicado: el conjunto de árboles que rechaza aquí es, por construcción, el mismo que
#   hoy revienta en el minuto 8. Por eso no cuenta como crecer la puerta (#123): no puede
#   enrojecer ningún árbol que fuera a salir verde.
# ★ Y NO PUEDE DIVERGIR. Un segundo predicado que contara lo mismo sería el que un día dice
#   «bien» mientras el otro dice «mal» — y manda el que nadie mira (misma razón por la que
#   `test_genesis_manifiesto` comparte predicado con el génesis).
# COSTE MEDIDO: 4,3 s (son cuatro `playwright --list`, ~2 s cada uno con la máquina
# despejada). Presupuesto del encargo: 30 s. Se gatea con el mismo par que la guarda de tsc
# —npx y game/node_modules— para no inventar una clase de aborto nueva en un worktree sin
# toolchain; el `node_modules` de la raíz lo exige igual la guarda de notas, más abajo.
# ★ VA DESPUÉS DE LA RAMA CON FILTROS, a propósito: esa rama hace `exec`, no deja sello y
#   por su propia cabecera «no es una batería de aterrizaje». Cobrarle 4 s de careo a quien
#   corre un fichero suelto para depurar es cobrarle una puerta que no está pidiendo.
if [ "$#" -gt 0 ]; then
  # Con argumentos (filtros) no hay cardinal esperado: comportamiento clásico.
  exec python3 -m pytest "${FICHEROS[@]}" -q "$@"
fi

if command -v npx >/dev/null 2>&1 && [ -e game/node_modules ] && [ -e node_modules ]; then
  CAREO_SALIDA=$(node re/tools/careo_suite_navegador.mjs 2>&1)
  CAREO_RC=$?
  if [ "$CAREO_RC" -ne 0 ]; then
    # 🔴 VÁLVULA DEL LEAD (14-08, primera mordida: menu-system-263). Sin ella, una rama que
    # AÑADE specs no puede conseguir adjudicación NINGUNA: el careo aborta aquí, antes de
    # pytest y de vitest, y su sello EXIT=64 no acredita nada del diff — que es peor que el
    # rojo de minuto 8 que este careo vino a arreglar. Con U5_CAREO_AVISO=1 el careo DEGRADA
    # a aviso, la corrida entera se ejecuta, y el sello lleva FOTO=CADUCA: quien aterrice esa
    # rama (el lead) sabe que la foto se re-sella desde main CON la rama dentro, ANTES de la
    # batería de composición. Usar la válvula sin haber añadido specs es un olor: el careo
    # está diciendo que tu árbol y la foto hablan de poblaciones distintas por OTRA razón.
    if [ "${U5_CAREO_AVISO:-0}" = "1" ]; then
      echo "BATERIA AVISO (U5_CAREO_AVISO=1): la foto NO cubre este arbol — la corrida sigue y el sello llevara FOTO=CADUCA. Re-sellado de la foto: del LEAD, sobre main con la rama dentro." >&2
      echo "$CAREO_SALIDA" >&2
      FOTO_ESTADO="CADUCA"
    else
      echo "$CAREO_SALIDA" >&2
      exit 64
    fi
  else
    echo "BATERIA: $CAREO_SALIDA"
    FOTO_ESTADO="vigente"
  fi
fi

# 🔴 SONDA DEL ÁRBOL PÚBLICO (25-08, carril `censo-puro-drift`). El repo PÚBLICO corre un CI
# de nivel 1 sobre un árbol SIN `game/assets/`, SIN `original/`, SIN los `.asm` y sin nuestros
# docs de proceso (`docs/publicacion/ci-nivel1.yml`). NADA de esta batería lo mide: sus tsc y
# sus vitest corren sobre el árbol PRIVADO, donde todo el material está. Resultado medido el
# 25-08: entre el 02-08 y esa fecha entraron a main **49 ficheros** de test que leen dato del
# juego sin pasar por los `exclude` de `game/vitest.pure.config.ts`, y el CI público estaba
# rojo con 56 ficheros / 93 tests + un `tsc` rc=2. Veinte días de deriva EN SILENCIO porque el
# único instrumento que la ve era un gesto manual del runbook que se dejó de hacer.
# ★ NO ES UNA PUERTA NUEVA SOBRE EL PORT: no puede enrojecer ningún árbol que fuera a salir
#   verde en el repo público — es exactamente el CI de allí, adelantado. Lo que rechaza aquí
#   es lo que rompería el clic del usuario en el génesis.
# ★★ Y NO REIMPLEMENTA NADA: el árbol lo monta `docs/publicacion/genesis-publico.sh`, que es
#   la autoridad sobre qué viaja (misma doctrina que `test_genesis_manifiesto`).
# COSTE MEDIDO: 52 s los cuatro jobs (6,6 s de génesis + tsc×2 + 440 ficheros de vitest +
# vite build). Determinista: su predicado es la PRESENCIA DE FICHEROS, no un plazo — no puede
# enrojecer por contención (no lanza chromium ni liga puertos). Se gatea con el mismo par que
# la guarda de tsc para no inventar una clase de aborto nueva en un worktree sin toolchain, y
# distingue «rojo» (1) de «no se pudo medir» (64), que aquí DEGRADA a aviso: un `rsync`
# ausente no es un veredicto sobre el diff.
if command -v npx >/dev/null 2>&1 && [ -e game/node_modules ] && [ -e node_modules ]; then
  SONDA_SALIDA=$(bash re/tools/sonda_pure_publico.sh 2>&1)
  SONDA_RC=$?
  if [ "$SONDA_RC" -eq 1 ]; then
    echo "$SONDA_SALIDA" >&2
    echo "BATERIA: la SONDA DEL ARBOL PUBLICO salio ROJA — el repo publico no compilaria o" >&2
    echo "         no pasaria sus tests con este arbol. EXIT 64." >&2
    exit 64
  elif [ "$SONDA_RC" -ne 0 ]; then
    echo "BATERIA AVISO: la sonda del arbol publico NO PUDO MEDIR (rc=$SONDA_RC) — no es un veredicto." >&2
    echo "$SONDA_SALIDA" | tail -5 >&2
  else
    echo "BATERIA: sonda del arbol publico VERDE (4 jobs del CI de nivel 1)."
  fi
fi

ESPERADO=$(python3 -m pytest "${FICHEROS[@]}" --collect-only -q 2>/dev/null | grep -cE '::')
if [ -z "$ESPERADO" ] || [ "$ESPERADO" -eq 0 ]; then
  echo "BATERIA: la coleccion dio 0 tests — entradas ausentes (¿symlinks del worktree?). ABORTO." >&2
  exit 64
fi

SALIDA=$(mktemp)
set -o pipefail
python3 -m pytest "${FICHEROS[@]}" -q 2>&1 | tee "$SALIDA"
EXIT_PYTEST=$?
set +o pipefail
FASE="pytest-hecho"

# Suma de la línea-resumen: «N passed», «N failed», «N skipped», «N error(s)», «N xfailed»…
EJECUTADO=$(grep -oE '[0-9]+ (passed|failed|skipped|error|errors|xfailed|xpassed)' "$SALIDA" \
  | awk '{s+=$1} END {print s+0}')
# ── #292: EL RÓTULO SE DESGLOSA (el PREDICADO de abajo no se toca) ───────────────────────
# 🔴 Este bloque imprimía «cardinal OK (1095/1095)» sobre una corrida CON UN ROJO DENTRO, y
# se leyó como «pytest pasó». No mentía por error de cuenta: `EJECUTADO` es la suma de TODOS
# los desenlaces (passed+failed+skipped+error+xfail…) porque mide POBLACIÓN — que es justo
# lo que la ficha #5 quiere vigilar. El defecto es del RÓTULO: la palabra «OK» al lado de un
# cardinal de población invita a leerlo como cardinal de ÉXITO, y el rojo real de pytest no
# aflora hasta el `exit "$EXIT_PYTEST"` del final del fichero (línea ~1163), minutos después.
# ⇒ se separan las tres magnitudes y, con rojos, la línea LOS NOMBRA y no dice «OK».
VERDES=$(grep -oE '[0-9]+ passed' "$SALIDA" | awk '{s+=$1} END {print s+0}')
ROJOS=$(grep -oE '[0-9]+ (failed|error|errors)' "$SALIDA" | awk '{s+=$1} END {print s+0}')
rm -f "$SALIDA"

if [ "$EJECUTADO" -ne "$ESPERADO" ]; then
  echo "BATERIA: PERDIDA DE POBLACION — colectados $ESPERADO, ejecutados $EJECUTADO (sin skips que lo expliquen). EXIT 64." >&2
  echo "         Un verde sobre poblacion incompleta NO es un sello (ficha #5)." >&2
  exit 64
fi
FASE="cardinal-ok"
if [ "$ROJOS" -gt 0 ]; then
  echo "BATERIA: cardinal de POBLACION completo ($EJECUTADO/$ESPERADO) — pero $VERDES verdes y $ROJOS ROJO(S)." >&2
  echo "         Esta linea NO dice que pytest pasara: solo que no se perdio poblacion." >&2
  echo "         El veredicto de pytest sale al final (EXIT del fichero); la bateria sigue." >&2
else
  echo "BATERIA: cardinal OK ($EJECUTADO/$ESPERADO ejecutados, $VERDES verdes, 0 rojos)."
fi

# ════ PUERTA DE LA POBLACIÓN PYTEST EXCLUIDA (rojos-invisibles, 25-08) ═══════════════════
# 🔴 EL AGUJERO, MEDIDO ANTES DE TAPARLO. Todo lo de arriba corre `FICHEROS`, que es una
# LISTA A MANO: 82 ficheros de los 118 que hay en `re/tools`. Los otros 36 están declarados
# en `FUERA-DE-PUERTA.txt` —el default-deny de #55 funciona: cero huérfanos— pero DECLARADOS
# NO ES MEDIDOS: el manifiesto dice por qué no entran, no si pasan. Censados uno a uno el
# 25-08, OCHO tests estaban en ROJO por TRES causas —de hace 19, 15 y 6 dias—, y la ultima era
# una regresión de producto de seis días antes (#352 cambió el centinela de la moongate y
# dejó atrás los escenarios de paridad; su autor midió la suite entera y no pudo verlo).
#
# ★ ES EL MISMO AGUJERO QUE #221 TAPÓ EN VITEST y con la misma forma, para que los dos
#   criterios no puedan divergir: población + default-deny sobre rojos + TRINQUETE (una
#   exención que se pone verde BLOQUEA hasta que se retire ⇒ la lista sólo puede encoger).
#
# COSTE: 99 s medidos para 32 ficheros / 546 tests en UNA invocación. La razón de #55 para
# excluirlos («la suite completa tarda ~17 min») es CIERTA del conjunto y engañosa del
# reparto: los 36 suman 789 s y CUATRO se llevan 680 (test_oracle 277 —levanta DOSBox—,
# test_mirror_headless 188, test_parity 113, test_rng_parity 102). Esos cuatro siguen fuera,
# en `NO_CORREN`, cada uno con su cifra. Los 32 restantes entran. Los tres ficheros que
# estaban rojos costaban 22 s entre los tres.
# ⚠ Y una cifra de #55 estaba rancia por 3x: test_seed_gate se excluyó por «33,32 s» y hoy
#   mide 12,2 — entra.
echo "BATERIA: puerta de la poblacion pytest EXCLUIDA (32 ficheros, ~99 s)..."
PYTEST_FUERA_XML=$(mktemp)
PYTEST_FUERA_LISTA=$(python3 -c 'import sys; sys.path.insert(0, "re/tools")
import puerta_pytest_completa as P
print(" ".join("re/tools/" + f for f in P.poblacion()))')
# Sin comillas A PROPÓSITO (aquí SÍ se quiere partir en palabras) y en bash, que es el
# intérprete de este script — la trampa de zsh que documenta CLAUDE.md es de la shell del
# HOST, no de aquí. El `|| true` no enmascara nada: el rc de pytest da 1 con cualquier rojo
# y esta puerta TOLERA los declarados; quien decide es el predicado del .py, que además
# distingue «rojo sin declarar» (1) de «exención caducada» (65) y «población perdida» (64).
python3 -m pytest $PYTEST_FUERA_LISTA -q --no-header -p no:cacheprovider \
  --junit-xml="$PYTEST_FUERA_XML" > /dev/null 2>&1 || true
python3 re/tools/puerta_pytest_completa.py "$PYTEST_FUERA_XML"
EXIT_PYTEST_FUERA=$?
rm -f "$PYTEST_FUERA_XML"
if [ "$EXIT_PYTEST_FUERA" -ne 0 ]; then
  echo "BATERIA: PUERTA PYTEST EXCLUIDA en ROJO (exit $EXIT_PYTEST_FUERA)." >&2
  exit "$EXIT_PYTEST_FUERA"
fi
FASE="pytest-fuera-ok"

# ════ GUARDA DE POBLACIÓN DE LAS LÍNEAS VITEST (#258, 14-08) ════════════════════════════
# 🔴 EL AGUJERO, MEDIDO ANTES DE TAPARLO: el CARDINAL de arriba es SÓLO de pytest. De las
# líneas vitest esta batería leía UNA cosa —el código de salida— y `vitest run` sale 0 con
# la población que sea. Siembra del 14-08: quitar `tests/mirror-reflection.test.ts` de la
# línea de render la baja de 103 a 90 tests EJECUTADOS y el rc SIGUE SIENDO 0. Trece tests
# menos, cero señales. Es la misma avería que la ficha #5 destapó en pytest («un EXIT 0
# sobre población incompleta es el mismo sello aparente sobre otra suite»), en la mitad del
# fichero que nunca la tuvo.
#
# ★ SUELO, NO IGUALDAD — y la razón es de MANTENIMIENTO, no de rigor. Un `==` exacto pone
#   roja la puerta cada vez que alguien AÑADE un test, que es el movimiento sano de esta
#   flota; y una guarda que se enciende por el funcionamiento normal se acaba silenciando (el
#   mismo argumento por el que `test_censo_filas_represadas` mete el PREDICADO en la puerta y
#   no el censo en vivo). Peor todavía: entrena a subir la cifra por reflejo, que es cómo se
#   pudre un trinquete. Con suelo, sólo dispara la PÉRDIDA — que es el defecto — y BAJAR un
#   suelo es un acto deliberado y visible en el diff, con su razón al lado.
#
# ★ EL SUELO VA **EN LA LÍNEA**, no en una tabla aparte. Una tabla de cifras a un lado y una
#   lista de ficheros al otro es exactamente la pareja que diverge en silencio: quien añade
#   un fichero a la línea no tiene por qué pasar por la tabla. Aquí el fichero y su suelo se
#   editan en la misma línea o no se editan.
#
# ★ Y EL VACÍO ES ROJO, NO VERDE: si no hay línea de resumen no hay población que comparar, y
#   un «no pude medir» que pasa por verde es el cero más engañoso que hay (misma regla que la
#   guarda de colección de pytest y que el `if (!total)` de suite-navegador.mjs).
#   🔴 DECLARADO CON HONESTIDAD: esa rama es un DEFAULT-DENY DE RESERVA, y NO es la que
#   dispara en el caso obvio. Medido el 14-08 con un fichero renombrado: `vitest run` sobre
#   un patrón que no casa nada sale con 1 por su cuenta, así que lo caza el `rc` de arriba
#   («No test files found»). No he construido un caso que salga 0 SIN línea de resumen, así
#   que esa rama va sin sembrar y se dice aquí en vez de dar a entender que está probada.
#
# 🔴 EL AVISO QUE HABÍA AQUÍ SOBRE LA FICHA #240 ERA CORRECTO EN LA FORMA Y FALSO EN EL HECHO,
# y se corrige con la medición en la mano (14-08, carril puerta-poblacion). Decía que arreglar
# #240 haría BAJAR estos suelos. NO los movió NI UNO: los 80 tests fantasma vivían en
# `party-roster-contiguity.test.ts` y `save-native-enemies.test.ts` (40 cada uno), y NINGUNO
# de los dos está en esta puerta. Medido a los dos lados del arreglo: la línea del codec sigue
# dando 66 y la puerta entera 507; quien bajó fue la suite COMPLETA de vitest, 6172 → 6092
# (−80 exactos, que es el control que acredita el arreglo). ★ La lección es de alcance: un
# cardinal contaminado no contamina TODA cifra derivada de él — hay que mirar QUÉ ficheros
# tenían los fantasmas antes de anunciar qué suelos se moverán.
#
# Suelos medidos el 14-08 en este árbol, fichero a fichero y línea a línea (censo completo en
# la entrega del carril, para la ficha #221). 🔴 Las dos cifras de FORMA que esta línea llevaba
# a mano («22 ficheros en 8 líneas, 425 tests») estaban RANCIAS y no coincidían ni con el `echo`
# del final del bloque («9 lineas / 23 ficheros»): la puerta son hoy 14 líneas, 28 ficheros y
# 507 tests. Ya no se escriben aquí — las cuenta `vitest_puerta` y las imprime ese `echo`.
# Los acumuladores NO se inicializan a 0 aquí a propósito: mientras estén SIN ASIGNAR, el
# sello escribe `CARDINAL_VITEST=?/?` = «la corrida no llegó a las líneas vitest», que es lo
# que dice el `?` del CARDINAL de pytest. Un `0/0` se leería como «medí cero», que es otra
# cosa. Se crean en la primera línea que pasa (con `${…:-0}` dentro de la función).
vitest_puerta() {
  local etiqueta="$1" suelo="$2" queja="$3"
  shift 3
  echo "BATERIA: $etiqueta (vitest, suelo $suelo)..."
  local log rc total
  log=$(mktemp)
  # (pipefail DENTRO del subshell y salida A FICHERO, no a una tubería: el `| tail -5` que
  #  había aquí devolvía el rc de `tail`. Se conserva el tail para la vista, pero el rc y la
  #  población salen del fichero.)
  ( cd game && set -o pipefail && npx vitest run "$@" --reporter=basic ) > "$log" 2>&1
  rc=$?
  tail -5 "$log"
  if [ "$rc" -ne 0 ]; then
    echo "BATERIA: $queja" >&2
    rm -f "$log"
    return "$rc"
  fi
  # La línea de resumen de vitest es «      Tests  103 passed (103)»; con rojos o saltados
  # cambia el desglose pero el PARÉNTESIS sigue siendo el total. Se lee el paréntesis.
  total=$(sed -nE 's/^[[:space:]]*Tests[[:space:]]+.*\(([0-9]+)\)[[:space:]]*$/\1/p' "$log" | tail -1)
  rm -f "$log"
  if [ -z "$total" ]; then
    echo "BATERIA: «${etiqueta}» — vitest salio 0 pero NO imprimio su linea «Tests N (N)»." >&2
    echo "         Sin poblacion medida no hay verde: puede que ningun fichero de la linea" >&2
    echo "         exista ya (¿renombrado?). EXIT 64." >&2
    return 64
  fi
  if [ "$total" -lt "$suelo" ]; then
    echo "BATERIA: POBLACION VITEST PERDIDA en «${etiqueta}» — ejecutados $total, suelo $suelo (faltan $((suelo - total)))." >&2
    echo "         Un EXIT 0 sobre poblacion incompleta NO es un sello (ficha #5, aqui #258)." >&2
    echo "         CAUSAS: un fichero desaparecio de la linea de esta guarda, un .test.ts" >&2
    echo "         renombrado, o un bloque de tests retirado. Si la retirada es DELIBERADA," >&2
    echo "         baja el suelo EN LA MISMA LINEA y en el mismo commit, citando por que." >&2
    return 64
  fi
  VITEST_EJECUTADO=$(( ${VITEST_EJECUTADO:-0} + total ))
  VITEST_SUELO=$(( ${VITEST_SUELO:-0} + suelo ))
  # #292-bis: las CIFRAS DE FORMA de la puerta (cuántas líneas, cuántos ficheros) se cuentan
  # AQUÍ, donde se ejecutan, y no a mano en el `echo` del final. Las dos que había estaban
  # rancias el 14-08 y de dos maneras distintas a la vez: la cabecera decía «22 ficheros en
  # 8 líneas» y el echo final «9 lineas / 23 ficheros» cuando eran 14 líneas y 28 ficheros —
  # dos recuentos a mano del MISMO objeto, ninguno correcto, divergentes entre sí. Es el
  # defecto de #292 (rótulo a mano al lado de lo que cuenta) en el otro extremo del fichero.
  VITEST_LINEAS=$(( ${VITEST_LINEAS:-0} + 1 ))
  VITEST_FICHEROS=$(( ${VITEST_FICHEROS:-0} + $# ))
  echo "BATERIA: $etiqueta OK ($total tests, suelo $suelo)."
  return 0
}

# GUARDA DE NOTAS (2026-08-05 noche): hay guardas de VITEST que leen re/notes/ y docs/
# — el acumulador (game/tests/acumulador-ventana.test.ts) exige entrada en docs/qa Y
# marca con su vocabulario DENTRO de la nota. Dos rojos viajaron a main en un dia
# porque esta bateria era solo pytest y la regla vivia en la memoria de la flota, no
# aqui. La puerta de una nota nueva es UNA orden: esta. Si el worktree no tiene el
# node_modules de la RAIZ symlinkeado (REGLA 2), esto NO se salta en silencio: aborta.
if [ ! -d node_modules ]; then
  echo "BATERIA: guarda de notas IMPOSIBLE — falta node_modules en la raiz (symlinkea el de la raiz del checkout principal, REGLA 2). EXIT 64." >&2
  exit 64
fi
vitest_puerta "guarda de notas (acumulador-ventana)" 7 \
  "guarda de notas ROJA (acumulador-ventana). Una nota nueva tiene puerta en vitest." \
  tests/acumulador-ventana.test.ts || exit $?

# ── GUARDA DEL CODEC NATIVO (#115) ────────────────────────────────────────────────────────
# El signo de la planta en el viaje de ida y vuelta: los CUATRO sotanos (Yew 4, LB 17,
# Blackthorn 18, Serpent's Hold 32) vuelven como -1 y NO como 255, con los tres controles que
# guardan la otra mitad del byte sobrecargado -- el Underworld (location 0) tiene que SEGUIR
# siendo 0xFF -- y el mutante de la extension de signo INGENUA, que es el arreglo obvio y
# rompe justo el Underworld. Sin material de EA (fixture sintetico) y en 0,4 s.
# Entra en la puerta porque el defecto que cierra dejaba INCARGABLE cualquier .GAM guardado
# en un sotano, y eso no lo veia ningun otro fichero de esta bateria.
# #143a AÑADE el segundo fichero a ESTA MISMA guarda, no una nueva: mismo sujeto (el codec
# de `saveNative.ts`), misma puerta. La localizacion de la piedra lunar en 0x29a — el byte que
# el port leia con `=== 0` cuando el binario codifica `0xFF` = en la mochila.
# 🔴 Entra porque MEDI que save-native.test.ts NO lo cubre: revertir el lector a `=== 0` deja
# save-native VERDE (su fixture solo usa 0 y 0xFF, que es justo donde los dos predicados
# coinciden), asi que sin esta linea el arreglo viajaba sin vigilancia. Es la clase
# «tiene test != esta vigilado». 6 mutantes, ~0,4 s, fixture sintetico sin material de EA.
# #149 suma moongates.test.ts a la MISMA guarda: el gate de dibujo por localizacion
# (ULTIMA.EXE:0x4713) y —lo que de verdad muerde— el campo `location` en el ASSET
# game/assets/initial-state.json. Ese asset es un DERIVADO commiteado del extractor y venia
# SIN el campo: con el gate puesto, una partida nueva se quedaba SIN NINGUNA puerta lunar.
# tsc no lo ve porque el JSON entra por un `as T`. El mutante M4 (quitar el campo del asset)
# pone esta guarda en rojo, que es la unica red que hay para esa clase.
vitest_puerta "guarda del codec nativo (#115/#143a/#149)" 66 \
  "guarda del codec ROJA (save-native / moonstone-loc). El signo de la planta, su mutante, o la localizacion de la piedra lunar." \
  tests/save-native.test.ts tests/moonstone-buried-codec.test.ts tests/moongates.test.ts || exit $?

# ── GUARDA DE SHADER Y VISTA (#123, commit deliberado del lead 09-08) ────────────────────
# Tres guardas vitest que vigilaban subsistemas YA aterrizados y no estaban en la puerta:
# shader-motion (111 tests: la mascara de luz del smooth move, los DOS filos — el defecto
# vivio meses en verde porque la metrica solo miraba el filo que funcionaba),
# shader-fog-cortina (4: el censo de la cortina por REGIMEN de luz, #34) y
# viewgem-eco-mazmorra (7: la gema gastada en mazmorra tiene eco y el auto-repeat no come
# gemas, d0f0291c/7d4c88ba). Cierran defectos que la bateria pytest no veia; sin ellas un
# aterrizaje podia revertirlos en silencio. El spec MOVIL de #126b
# (game/e2e/mobile/combate-botonera.spec.ts) NO entra A PROPOSITO: es playwright con
# chromium bajo timeout — la clase sensible-a-CARGA de companion_ea — y en la cola de
# maquina fabricaria rojos falsos; vive en la suite e2e movil y se corre por carril.
# Guarda de la INTRO (#211). El dissolve del subtitulo son DOS etapas —fuego con las letras
# recortadas en negro, y despues las letras a blanco— y las constantes de tiempo del arranque
# son ELECCION del port (el nominal de pause(1) = 1 tic del INT 1Ch), NO cifras calcadas: el
# ~2x que se mide en la grabacion de DOSBox-X a 3000 cycles es coste de pintado del emulador.
# 🔴 Entra en la puerta porque #211 midio que NO estaba: la linea vitest nombra ficheros UNO A
# UNO (no corre la suite), asi que un test que nadie anade es un verde que nadie mira — la
# clase de #148/#133, hoy ficha #221 para el resto de la poblacion.
# #220 suma intro-sonidos-220.test.ts a la MISMA puerta: los dos sonidos del titulo (fizzle del
# dissolve y crepitar del subtitulo) los emite EGA.DRV, no el kernel, y sus parametros se
# RE-EXTRAEN del disasm en cada corrida — si el disasm se regenera y una fila se mueve, esta
# linea se pone roja NOMBRANDO la fila en vez de callar.
# #254 sube el suelo 48 -> 53: el MISMO fichero de #220 gana el bloque que fija la ley
# banda->frecuencia del `noise_burst` contra el binario (5 tests, ~0,3 s). NO crece la puerta —
# no entra ningun fichero nuevo, es la linea que ya vigilaba a ese emisor.
vitest_puerta "guarda de la intro (#211 + #220 + #254)" 53 \
  "guarda de la intro ROJA (#211: etapas del subtitulo o constantes del arranque)." \
  tests/fiel-introanim.test.ts tests/intro-sonidos-220.test.ts || exit $?

vitest_puerta "guarda de shader y vista (x3, #123)" 122 \
  "guarda de shader/vista ROJA (smooth-move, cortina o eco de gema)." \
  tests/shader-motion.test.ts tests/shader-fog-cortina.test.ts tests/viewgem-eco-mazmorra.test.ts || exit $?

# ── GUARDA DE VISIBILIDAD / CAMPO DE LUZ (#252 + #256) ──────────────────────────────────
# 🔴 Entra en la puerta porque estaba FUERA: `visibility.test.ts` existe desde E1-S2 y la
# batería NUNCA lo corrió — sus asertos del radio, del flood Moore y de los emisores eran
# verdes sin vigilar, incluidas las TRES guardas que #252 añadió el 14-08 (una de ellas es
# justo la que caza que alguien devuelva el barrido de emisores al encuadre). Es la clase
# «tiene test ≠ está vigilado» (#133/#221) sobre el subsistema que el usuario reportó.
# El segundo fichero lleva el MODELO DE REFERENCIA del pase de la party del binario y sus
# controles; sin puerta, el instrumento con el que se mide la fidelidad del campo de luz se
# pudre en silencio. Los dos juntos corren en ~0,3 s: no compran fragilidad (#190).
vitest_puerta "guarda de visibilidad y campo de luz (x2, #252/#256)" 26 \
  "guarda de visibilidad ROJA (radio/LOS/emisores, o el modelo de referencia del original)." \
  tests/visibility.test.ts tests/visibility-original-referencia.test.ts || exit $?

# ── GUARDA DEL TECLADO PERSISTENTE (#302) ────────────────────────────────────────────────
# El rito del santuario encadena CUATRO getstring (virtud + mantra x3) y el teclado del
# sistema se cerraba tras cada uno (reporte del usuario 14-08, iPhone). La causa son DOS
# piezas que por separado parecen correctas -- el envio blurea SIEMPRE, y `syncAz` solo
# actua en el FLANCO -- asi que ningun test de una sola de ellas la habria visto.
# Entra en la puerta porque el arreglo es una CONDICION dentro de un handler de eventos:
# tres lineas que cualquier limpieza posterior puede «simplificar» a un blur incondicional
# devolviendo el defecto, y sin esta linea nadie se enteraria. El predicado es el FOCO tras
# el envio, que es lo unico observable de esto -- playwright NO expone si iOS desplego el
# teclado. jsdom, 4 tests, ~50 ms: no compra fragilidad de puerta (#190).
# ── GUARDA DE LA PRIMITIVA DEL RECT INTERIOR (#295 + #296) ───────────────────────────────
# La inversion del viewport NO es un efecto del santuario: es una PRIMITIVA con disparadores
# como casos (censo del espejo: WELL DONE x6 / CAST de hechizo x7 / Codex x1, ver
# re/notes/espejo-barrido-2.md), y COMPARTE GEOMETRIA con el apagon del sueno (#296, carril
# efectos-mundo) -- dos carriles escribiendo el mismo rect es justo donde nace la constante
# duplicada que luego diverge.
# Entra en la puerta por el punto donde esa geometria se copia MAL, que no es hipotesis sino
# la FORMA del dato: el binario da ESQUINAS INCLUSIVAS (0xb7=183) y fillRect quiere
# ORIGEN+TAMANO (176). Los dos errores simetricos son invisibles para un test que mire una
# sola de las dos lecturas, asi que la guarda mira LAS DOS y exige que se DERIVEN de VIEWPORT.
# 8 tests, ~10 ms: no compra fragilidad de puerta (#190).
vitest_puerta "guarda del rect interior del viewport (#295/#296)" 8 \
  "guarda del rect interior ROJA (#295: la geometria compartida de la inversion y el apagon)." \
  tests/viewport-interior-295.test.ts || exit $?

vitest_puerta "guarda del teclado persistente (#302)" 5 \
  "guarda del teclado ROJA (#302: el teclado se cierra entre los prompts encadenados del rito)." \
  tests/teclado-persistente-302.test.ts || exit $?

# ── GUARDA DE RENDER DE #196/#197/#199 (commit deliberado del lead, 12-08) ───────────────
# Guardas vitest de winds-fixes que RE-DERIVAN sus conjuntos por corrida — sin puerta,
# la re-derivación no vigila nada (clase #133/#148): masonry-passage (4 tests, 3 ms — el
# conjunto {0x87,0x3e} por familia-de-nombre ∩ caminable, con el mutante del matching
# exacto que ANTES sobrevivía) y contour-transp (24 tests, ~0,4 s — los 23 muebles de
# interior con suelo DECLARADO, el careo entre los dos campos de sustitución de TileData
# con su contador DENTRO, y las 16 fases de animatedFrame). Coste medido: <1 s juntos.
# 13-08: entra mirror-reflection (13 tests, ~2 s — el REFLEJO del espejo de #199). Entra en
# la puerta porque el defecto que cierra es MUDO: antes del fix no habia NI UN consumidor de
# `MirrorAvatar` en game/src, asi que ninguna instrumentacion podia ponerse roja — lo vio el
# usuario jugando. Y su ultimo bloque vigila el CABLEADO en el snapshot, no solo el
# predicado: borrar las llamadas de coreview deja el predicado verde y el espejo muerto.
# AMPLIADA el 13-08 tambien con render-avance-fx + render-fx-junta (#207, 24 tests): el
# GRABADOR avanzaba un presupuesto FIJO de 6 subfotogramas por paso y DECAPITABA toda
# animacion mas larga que 500 ms — asi se publico la coreografia del Shard, sin error y sin
# sintoma. Vigila los DOS frenos POR SEPARADO (presupuesto y cola de rAF), el tope, el
# defecto latente de worldFx, y LA JUNTA (el hook pregunta a la piel ACTIVA — el primer fix
# sello verde con el cableado muerto porque leia una piel no montada). 5+ mutantes medidos.
# 🔴 Uno SOBREVIVIO a la primera redaccion: el bucle tiene DOS mitades con el mismo nombre
# y el test cubria una; hay un caso por mitad desde entonces.
# (el rótulo decía «x6» con SIETE ficheros en la línea desde que entró victory-fanfare-212:
#  un recuento a mano al lado de la lista que cuenta es justo lo que el suelo viene a sustituir)
vitest_puerta "guarda de render #196/#197/#199/#207 (x7: muralla + mobiliario + ritual + espejo + grabador + junta + fanfarria)" 103 \
  "guarda de render #196/#197/#199/#207 ROJA (muralla, mobiliario, ritual, espejo, grabador o junta)." \
  tests/masonry-passage.test.ts tests/contour-transp.test.ts tests/shard-ritual-av.test.ts tests/mirror-reflection.test.ts tests/render-avance-fx.test.ts tests/render-fx-junta.test.ts tests/victory-fanfare-212.test.ts || exit $?

# ── GUARDA DEL BANCO DE SPRITE DE LA PARTY (#264, sancion #123 concedida por el lead 14-08) ─
# El usuario grabo la fragata importada pintandose como TILE DE BASURA al embarcar: la piel
# mezclaba LOS DOS ESPACIOS DE TILE (#137) en el `return` de coreview::avatarTile() — el
# predicado `onFoot` compara BYTES y la rama montada devolvia el byte EN CRUDO a un consumidor
# que lo indexa como tile completo, asi que 0x24 salia como el TERRENO 0x24. Alcanzaba a TODA
# travesia de TODO vehiculo desde el contrato de pieles, y NADIE lo caza con lo que ya habia:
# los specs navales asertan ESTADO y declaran «nunca pixeles» — un bug visible en cada viaje
# con la suite legitimamente verde. Esta guarda pregunta por lo que SE PINTA: recorre la
# poblacion entera de g_transport_tile (caballo, alfombra, fragata izada/arriada, esquife x4
# facings, a pie visible/invisible/nuevo, y las poses de silla y cama) y exige banco alto en la
# celda central de la ventana Y en el actor de motion del shader. MUTANTE M1 medido sobre la
# linea base ya commiteada (`return tt` pelado en avatarTile): mata 17 de 25 — los 16 montados
# MAS el control de arnes — y deja VERDES los 3 a-pie y las 5 poses, que salen por otra rama.
# Discrimina: no es un fichero que se ponga rojo entero ante cualquier tocamiento.
vitest_puerta "guarda del banco de sprite de la party (#264)" 25 \
  "guarda del banco de sprite de la party ROJA (party-sprite-bank.test.ts). Algun tile de party sale en banco BAJO: se pintara como terreno." \
  tests/party-sprite-bank.test.ts || exit $?

# ── GUARDA DE LA FRAGATA AMARRADA (#270/#272, fix derivado de CMDS.OVL:0x0EB4) ────────────
# La otra mitad del reporte del usuario de #264: al hacer X-it en mar abierto el barco
# DESAPARECIA. No era render — `exitTransport` solo fijaba `parkedShipTile` en la rama de
# tierra, y el binario amarra en las TRES (las tres guardan el mismo `[bp-2]` y caen en la
# cola 0x0FF4 que emite el objeto; derivacion en re/notes/xit-esquife-270.md).
# Lo que esta guarda fija y una revision no ve: la CONTABILIDAD por rama (§4 de la nota) —
# tierra y alfombra dejan TODOS los esquifes en la nave, el esquife deja N-1— NO esta
# ramificada en game.ts: sale del ORDEN entre los dos ficheros (exitTransport muta
# state.shipSkiffs y exitVehicle lo lee despues). Un acoplamiento asi se rompe en silencio,
# asi que hay un caso por rama con su cifra, un CONTROL NEGATIVO (sin tierra/esquifes/
# alfombras NO se amarra nada: sin el, un fix que amarrase siempre pasaria igual y dejaria
# nave duplicada) y un caso que fija el propio acoplamiento (misma N, dos cifras).
# TRES MUTANTES medidos sobre linea base commiteada, por IDENTIDAD y no solo por cardinal:
#   M1 quitar parkedShipTile del ESQUIFE  → mata 2/5: «ESQUIFE…» + «solo la rama del ESQUIFE resta»
#   M2 quitar parkedShipTile de la ALFOMBRA → mata 1/5: «ALFOMBRA…»
#   M3 perder el decremento de shipSkiffs  → mata 2/5: LAS MISMAS DOS que M1
# Discrimina entre RAMAS (tierra/esquife/alfombra caen por separado) y ninguno toca el
# control negativo. 🔴 Pero M1 y M3 son INDISTINGUIBLES entre si para esta guarda: «la rama
# dejo de amarrar» y «el decremento se movio» dan el mismo par de rojos. Quien la vea roja
# por ese par tiene DOS causas candidatas, no una — el mensaje de abajo las nombra a las dos
# a proposito. Cerrar esa ambiguedad pedira un aserto sobre el ESTADO del jugador (no solo
# sobre el objeto), y no se hace aqui: se declara.
vitest_puerta "guarda de la fragata amarrada (#270/#272)" 5 \
  "guarda de la fragata amarrada ROJA (xit-fragata-amarrada-270.test.ts). O una rama de X-it dejo de amarrar la nave, o la contabilidad de esquifes del objeto cambio." \
  tests/xit-fragata-amarrada-270.test.ts || exit $?

# ── GUARDA DE LOS REMATES DE CINTA DEL SHELL (#279, re-apuntada de una guarda RANCIA) ─────
# El fichero llevaba 2/3 asertos ROJOS en main limpio (verificado en detached ANTES de tocar)
# desde que #263 movio el bitmap a skin/fiel/bandBracket.ts — FUERA de esta puerta, la clase
# #221 en su forma mas peligrosa: uno de esos asertos, puesto en verde tal cual, REINTRODUCIA
# el chevron flotante que #263 arreglo (la guarda rancia como VECTOR DE REGRESION — la
# pregunta ante una guarda rancia es «¿que quedaria en el producto si la hago pasar?», no
# «¿por que falla?»). Re-apuntada al sujeto vivo con los 3 asertos de #279 (cinta = UNA fila
# de glifo + la regla del marco QUE YA ESTABA; el panel del shell lleva las DOS porque tiene
# contenido a ambos lados — ley derivada del bufer nativo con Winds y HISTORY como casos
# espejo). CINCO mutantes sembrados y muertos uno a uno por el carril (cinta centrada ·
# BAND_H=22 · anillo blanco del host · borde superior del filo · regla que no cruza), base
# commiteada ANTES de sembrar; re-corrida en vivo por el lead 4/4 antes de aterrizar #279.
vitest_puerta "guarda de los remates de cinta del shell (#279)" 4 \
  "guarda de remates de cinta ROJA (shell-cinta-remates.test.ts). O la cinta del panel perdio una de sus DOS reglas, o el filo del host recupero el borde/radio que fabricaba la doble linea." \
  tests/shell-cinta-remates.test.ts || exit $?

# ── GUARDA DE PRIVACIDAD Y EA-LIMPIO (#128/#thumbs, commit deliberado del lead 09-08) ────
# Dos vitest puros que llevaban la clase #109/#125 encima — verdes solo cuando alguien los
# corria, y uno estuvo ROJO EN MAIN desde su aterrizaje sin que ningun sello lo viera:
# web-disponibilidad (8: el guarda de que nadie LEE el permiso `partida` para gobernar una
# subida — predicado ESTRECHADO en #128 con su hueco declarado en el propio fichero; 0,9s
# medidos por el carril) y replay-thumb-ea-limpio (8: la miniatura de replay vive en almacen
# aparte, records la rechaza por default-deny, y el borrado la barre — el carril que la
# escribio AFIRMO que estaba en la bateria y no lo estaba: esta linea es la correccion).
# La puerta es lo unico que convierte «alguien lo mirara» en «alguien lo mira».
# ── GUARDA DE LA MINIATURA NATIVA (#153) ─────────────────────────────────────────────────
# La piel DECLARA su bufer 320x200 (`data-u5-native`) y la captura lo prefiere. Entra en la
# puerta porque el defecto que cierra es MUDO: en los layouts tactiles la miniatura salia con
# el TELEFONO ENTERO (1170x1696 / 1746x1170, ~200 KB frente a 13 KB) y no daba error en
# ninguna parte — la tarjeta de /byo enseñaba una foto, solo que la equivocada y 15x mas
# pesada. Y el defecto es REVERSIBLE POR DESCUIDO: basta con que alguien borre una linea de
# `skin/fiel/skin.ts` para que vuelva entero, sin que ningun otro fichero de esta bateria se
# entere.
# El aserto que lo sostiene MONTA LA PIEL DE VERDAD (§A): un test que se fabrique sus propios
# canvas marcados pasa VERDE con la declaracion borrada — medido, es el mutante M1.
# 8 mutantes por causa, todos muertos, y uno de ellos (M4, el registro anti-bucle de la
# re-captura) SOBREVIVIO a la primera redaccion del test: el caso que lo mataba habia que
# escribirlo con la ESCRITURA FRACASANDO, porque con la escritura buena quien corta el bucle
# es el predicado y no el registro. Sin material de EA, sin red, sin navegador (jsdom).
#
# SON DOS FICHEROS Y NO UNO POR EL ENTORNO, no por el tema: `miniatura-nativa` monta pieles y
# canvas y necesita jsdom; `miniatura-slot-carga` lee un asset del disco y bajo jsdom
# `import.meta.url` no es una URL `file:` (medido: «The URL must be of scheme file» en los
# cuatro casos). El segundo vigila el marcador de `persistence.ts` que dice DE QUE RANURA
# salio el estado — y en concreto su BORRADO al importar, sin el cual la re-captura escribe
# la foto de lo importado encima de la miniatura de OTRA partida. 32 asertos, ~1,5 s.
# ── GUARDA DEL PAQUETE WALKTHROUGH (#262, commit deliberado del lead 14-08) ──────────────
# Las 21 paradas del paquete del usuario: monotonía de reservas, isla de Compasión con su
# salida ejecutada, sin-desenlace, y el careo de campos de las dos vías de importación. El
# horneador aborta si algo falla, pero el horneador solo corre al REGENERAR — esta línea
# vigila el recorrido en cada batería.
vitest_puerta "guarda del paquete walkthrough (#262)" 12 \
  "guarda del walkthrough ROJA (walkthrough-saves.test.ts). El recorrido, la monotonia de reservas, o una parada carcel." \
  tests/walkthrough-saves.test.ts || exit $?

# ── GUARDA DE PERSISTENCIA Y SOBRE .u5gam (#229/#262, commit deliberado del lead 14-08) ──
# El sobre .u5gam es la vía por la que viaja el paquete de saves del usuario (#262): el
# defecto que #229 arregló (el panel del juego no podía importar .u5gam — accept + regex +
# tamaño, los tres fallaban) vivió meses sin síntoma porque persistence.test.ts corría en
# local y JAMÁS en la puerta (clase #221). El mutante «ignora el sobre» mata exactamente el
# test del .u5gam y deja verdes el control y el sobre-roto — discrimina, no solo falla.
vitest_puerta "guarda de persistencia y sobre u5gam (#229)" 17 \
  "guarda de persistencia ROJA (persistence.test.ts). El sobre .u5gam, su caso roto, o la importacion nativa." \
  tests/persistence.test.ts || exit $?

vitest_puerta "guarda de la miniatura nativa (x2, #153)" 37 \
  "guarda de la miniatura ROJA (#153). O la piel dejo de declarar su bufer, o la captura dejo de preferirlo, o la re-captura al cargar cambio de criterio." \
  tests/miniatura-nativa.test.ts tests/miniatura-slot-carga.test.ts || exit $?

vitest_puerta "guarda de privacidad y EA-limpio (x2, #128)" 16 \
  "guarda de privacidad/EA-limpio ROJA (permiso partida o miniatura de replay)." \
  tests/web-disponibilidad.test.ts tests/replay-thumb-ea-limpio.test.ts || exit $?

# ── GUARDA DE LA ESCENA DEL SANTUARIO (#277) ──────────────────────────────────────────────
# El (E)nter en un santuario tiene que PINTAR el mapa de MISCMAPS y dejar al Avatar
# ARRODILLADO ante el altar, no sólo escribir el texto en la consola (que es lo que hacía el
# port y lo que reportó el usuario con cinco capturas). Cubre las tres mitades: los DATOS
# (shrine-scene.json del extractor: brasero 0xb2 en (5,5), atril 0x41 en (5,2)), el GUION
# derivado (4 cues vacíos, 4 pasos al norte —7 en el Codex—, tile de rodilla 0x16c) y el
# END-TO-END Game.enter() → evento → CoreViewImpl.snapshot().window. Mutantes que la matan:
# retirar la emisión de escena del (E)nter (1 rojo) y dejar al Avatar de pie (3 rojos).
# ── GUARDA DE LA PUERTA DE VERSIÓN DE LA EXTRACCIÓN (#293) ────────────────────────────────
# Las tres mitades del mecanismo, sin navegador (0,1 s): que el PRODUCTOR no pueda emitir un
# asset sin catalogarlo (`verificaCatalogo`, con los dos mutantes: emitido-sin-catalogar y
# catalogado-sin-emitir), que el CONSUMIDOR eche de menos lo que falta y lo NOMBRE en el
# aviso, y que el flujo de assets SERVIDOS no lo dispare. Lleva además el censo del literal
# de la caché sobre `demo-byo/public/sw.js` y `demo-byo/src/`: si el service worker mirase
# otra caché que el juego, la puerta entera quedaría MUDA sin que nada fallase.
vitest_puerta "guarda de la puerta de version de la extraccion (#293)" 19 \
  "guarda de la puerta de version ROJA (#293). O el catalogo de assets diverge del pipeline, o el aviso de extraccion vieja dejo de nombrar lo que falta, o el nombre de la cache ya no es uno solo en el arbol." \
  tests/extraccion-vigente.test.ts || exit $?

# 11 → 14 el 14-08 (#275, carril av-rito-efectos): tres asertos que separan la ENTRADA VACIA
# (CAST2 0x09cc/0x0a1e: el binario mira el buffer ANTES de compararlo y sale a 0x0d1d sin
# imprimir nada) del MANTRA EQUIVOCADO (0x0a62, «unfocused») — dos de silencio y un CONTROL
# positivo que sigue exigiendo la frase, para que romper la rama de fallo entera no se lea
# como si el discriminante de vacio funcionara.
vitest_puerta "guarda de la escena del santuario (#277 + #275)" 14 \
  "guarda de la escena del santuario ROJA (#277/#275). O el (E)nter dejo de montar la escena, o el mapa de MISCMAPS cambio, o el Avatar ya no acaba arrodillado ante el altar, o la entrada VACIA volvio a hablar donde el original calla." \
  tests/shrine-scene.test.ts || exit $?

# El agregado va al sello como CARDINAL_VITEST (ver `sella`): las actas citan la poblacion
# de pytest desde la ficha #5, y hasta hoy no habia nada equivalente que citar de vitest.
echo "BATERIA: poblacion vitest $VITEST_EJECUTADO (suelo $VITEST_SUELO) en $VITEST_LINEAS lineas / $VITEST_FICHEROS ficheros."

# ════ PUERTA DE LA SUITE VITEST COMPLETA (#221, opción (b) — decisión del lead 14-08) ════
# Las 14 líneas de arriba nombran 28 ficheros de 444. Lo que sigue corre LOS 444: default-deny
# sobre rojos, lista de EXENTOS con razón y ficha, trinquete que exige retirar la exención en
# cuanto el fichero se pone verde, y suelo de población. El predicado entero y el porqué de
# cada exención viven en `re/tools/puerta_vitest_completa.py` (lista+razón en el mismo sitio).
# ★ LAS 14 LÍNEAS NOMBRADAS SE CONSERVAN y no son redundancia: cuestan 5 s y dan diagnóstico
#   POR SUBSISTEMA con su queja escrita («guarda de la intro ROJA: etapas del subtítulo…»),
#   que un run global no da — ahí sólo sale «este fichero tiene un rojo».
# COSTE MEDIDO el 14-08: 40 s la suite entera (444 ficheros · 6092 tests) + los 5 s de las
# líneas = ~45 s. 🔴 El lead aceptó «5 s → 40 s»; la cifra HONESTA es ~45 s porque las dos
# capas se quedan. Para calibrar: `test_byo_momentos.py` SOLA corre a 87 s (#190).
# #308 · Y LOS ROJOS «⚠ SIN ASERTO» SE RE-CORREN AISLADOS AQUÍ MISMO. La adjudicación que
# hasta el 14-08 era manual («si no trae mensaje de aserto, re-córrelo solo y mira la carga»)
# la hace ahora la puerta: UN reintento por fichero, sólo para esa clase, y el desenlace va
# ROTULADO AL SELLO (RERUN_*). Detalle del predicado y de sus límites: el .py.
echo "BATERIA: puerta de la suite vitest COMPLETA (#221 + re-run aislado #308)..."
VITEST_JSON=$(mktemp)
VITEST_RERUN=$(mktemp)
( cd game && npx vitest run --reporter=basic --reporter=json --outputFile="$VITEST_JSON" ) > /dev/null 2>&1
# 🔴 El `rc` de vitest NO se mira aquí a propósito: sale 1 con CUALQUIER rojo, y esta puerta
# tolera los rojos DECLARADOS. Quien decide es el predicado del .py, que además distingue
# «rojo sin declarar» (1) de «exención caducada» (65) y de «población perdida» (64).
python3 re/tools/puerta_vitest_completa.py "$VITEST_JSON" \
  --rerun-en="$PWD/game" --sello="$VITEST_RERUN"
EXIT_VITEST_TODO=$?
# Los campos del reintento se leen ANTES de borrar el temporal y ANTES del `exit` de abajo:
# el trap sella con lo que haya en estas variables, así que un rojo adjudicado también tiene
# que llegar al sello. `sed` sobre el fichero (no una tubería) para no heredar el rc de otro.
if [ -s "$VITEST_RERUN" ]; then
  RERUN_AISLADO=$(sed -n 's/^RERUN_AISLADO=//p' "$VITEST_RERUN")
  RERUN_FICHEROS=$(sed -n 's/^RERUN_FICHEROS=//p' "$VITEST_RERUN")
  RERUN_CARGA=$(sed -n 's/^RERUN_CARGA=//p' "$VITEST_RERUN")
  RERUN_BATERIAS=$(sed -n 's/^RERUN_BATERIAS=//p' "$VITEST_RERUN")
fi
rm -f "$VITEST_JSON" "$VITEST_RERUN"
if [ "$EXIT_VITEST_TODO" -ne 0 ]; then
  echo "BATERIA: puerta de la suite vitest completa ROJA (#221). Lee las lineas de arriba: dicen" >&2
  echo "         QUE fichero y si el remedio es arreglarlo, declararlo, o RETIRAR una exencion." >&2
  exit "$EXIT_VITEST_TODO"
fi

# ════ PUERTA DEL EXTRACTOR (#148, decisión del lead 14-08) ═══════════════════════════════
# La batería no corría NI UN test del extractor: 203 verdes fuera de la puerta. El extractor
# es un PROYECTO VITEST APARTE (config y runner propios en `extractor/`), así que no cabía en
# `vitest_puerta`, que corre desde `game/` — por eso se quedó fuera, y por eso nadie lo notó.
# Medido el 14-08: 25 ficheros · 203 tests · 6 s · CERO rojos. Sin exenciones que negociar.
# Lo que vigila: el extractor es quien produce los assets del juego DESDE EL BINARIO. Una
# regresión suya no rompe un test del port — cambia los DATOS con los que el port se construye.
echo "BATERIA: puerta del extractor (#148, suelo 203)..."
EXTRACTOR_LOG=$(mktemp)
( cd extractor && set -o pipefail && npx vitest run --reporter=basic ) > "$EXTRACTOR_LOG" 2>&1
EXIT_EXTRACTOR=$?
tail -3 "$EXTRACTOR_LOG"
EXTRACTOR_TOTAL=$(sed -nE 's/^[[:space:]]*Tests[[:space:]]+.*\(([0-9]+)\)[[:space:]]*$/\1/p' "$EXTRACTOR_LOG" | tail -1)
rm -f "$EXTRACTOR_LOG"
if [ "$EXIT_EXTRACTOR" -ne 0 ]; then
  echo "BATERIA: puerta del EXTRACTOR ROJA (#148). El productor de los assets del juego tiene" >&2
  echo "         un rojo: corre 'cd extractor && npx vitest run' para verlo." >&2
  exit "$EXIT_EXTRACTOR"
fi
if [ -z "$EXTRACTOR_TOTAL" ]; then
  echo "BATERIA: extractor salio 0 pero NO imprimio su linea «Tests N (N)» — sin poblacion" >&2
  echo "         medida no hay verde (misma regla que las lineas vitest). EXIT 64." >&2
  exit 64
fi
if [ "$EXTRACTOR_TOTAL" -lt 203 ]; then
  echo "BATERIA: POBLACION DEL EXTRACTOR PERDIDA — ejecutados $EXTRACTOR_TOTAL, suelo 203" >&2
  echo "         (faltan $((203 - EXTRACTOR_TOTAL))). Si la retirada es DELIBERADA, baja el suelo" >&2
  echo "         en el mismo commit citando por que. EXIT 64." >&2
  exit 64
fi
echo "BATERIA: puerta del extractor OK ($EXTRACTOR_TOTAL tests, suelo 203)."

# ── GUARDA DEL TRINQUETE DEL POOL 174 (#133, commit deliberado del lead 09-08) ───────────
# verify_pool174_claims.py era la huerfana mas peligrosa del censo de llamadores: un
# TRINQUETE (vigila que afirmaciones ya selladas sobre el pool de cadenas no REGRESEN)
# cuyas unicas apariciones fuera de su propio fichero eran 7 actas con «EXIT=0» copiado A
# MANO — exactamente la forma de guarda_cifras en #75: la prosa que dice «vigila» como
# aval de si misma. Un trinquete sin llamador es peor que un test sin llamador: su rojo
# significa que algo YA SELLADO se ha vuelto falso. 0,25 s medidos por el carril.
echo "BATERIA: guarda del trinquete pool 174 (#133)..."
python3 re/tools/verify_pool174_claims.py > /dev/null 2>&1
EXIT_POOL=$?
if [ "$EXIT_POOL" -ne 0 ]; then
  echo "BATERIA: trinquete pool 174 ROJO — una afirmacion sellada sobre el pool ha regresado (corre re/tools/verify_pool174_claims.py a mano para ver cual)." >&2
  exit "$EXIT_POOL"
fi
echo "BATERIA: trinquete pool 174 OK."

# ── GUARDA DE CIFRAS DE PUBLICACION (#134/#129-adyacente, commit deliberado del lead 09-08) ─
# guarda_cifras.py corria SOLO en build-demo-publica.sh (|| FAIL=1): el rojo de una cifra
# rancia aparecia en el TREN DE DESPLIEGUE del lead, no en el aterrizaje del carril que
# movio el ledger. Medido la noche del 09-08: la regeneracion de E4 (forma F) dejo la prosa
# del hueco 3 diciendo 56/106 donde el ledger decia 50/59 — la composicion salio VERDE y el
# ensamblado habria salido ROJO. Con la guarda EN LA PUERTA, quien regenere el ledger ve el
# rojo en SU sello y la prosa se corrige en el mismo aterrizaje. (La frontera
# derivado/narrado de #134 no cambia: la tabla se deriva; la prosa se CAREA.) ~0,3 s.
echo "BATERIA: guarda de cifras de publicacion (#134)..."
python3 docs/publicacion/web/cifras/guarda_cifras.py > /dev/null 2>&1
EXIT_CIFRAS=$?
if [ "$EXIT_CIFRAS" -ne 0 ]; then
  echo "BATERIA: guarda de cifras ROJA — una cifra publicada discrepa del ledger o del canon (corre docs/publicacion/web/cifras/guarda_cifras.py a mano)." >&2
  exit "$EXIT_CIFRAS"
fi
echo "BATERIA: guarda de cifras OK."
FASE="fin"
exit "$EXIT_PYTEST"
