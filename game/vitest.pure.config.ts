// Subconjunto PURO de la suite: tests que corren SOBRE EL ÁRBOL PÚBLICO, es decir
// sin nada que la whitelist del génesis deje fuera. Es lo que ejecuta el CI del repo
// público (tier 1) vía `test:pure`.
// ⚠ El criterio NO es «sin game/assets/», aunque así naciera y así estuvo escrito
// aquí hasta el 30-07: es «sin NINGÚN fichero que no viaje». Lo destapó
// `acumulador-ventana.test.ts`, que no toca assets y aun así reventaba el CI público
// por leer `docs/qa/acumulador-ventana.md` — un registro de NUESTRO proceso que por
// ruling no viaja. Al añadir un test, la pregunta es «¿lee algo fuera de la
// whitelist?», no «¿lee assets?».
// La lista de EXCLUIDOS es el censo empírico 2026-07-25 (69 ficheros que leen
// assets extraídos, saves .gam o capturas de re/notes en carga de módulo),
// RE-CENSADO el 2026-07-27 al correr test:pure dentro del árbol del génesis: 6
// ficheros nuevos habían entrado a la suite desde entonces sin pasar por aquí y
// reventaban el CI público (5 por ENOENT de assets/ en carga de módulo; el 6º,
// sidecar-qol-normalizado, porque AFIRMA que hay checkpoints .gam que auditar y en
// el público los dos directorios de saves viajan vacíos por ruling).
// RE-CENSADO el 2026-07-30 (PRE-GO de fase D, main 9a92024f): otros 15 ficheros
// habían entrado desde el 27-07, los 15 por ENOENT de assets/ — 13 por lectura
// directa y 2 (comilla-literal, inn-wake-npc-snap) a través de un helper importado,
// que es la variante que no se ve leyendo el propio test.
// RE-CENSADO el 2026-08-01 (auditoría final, main dcb7dbeb): CUATRO ficheros más.
// La auditoría nombró tres; el barrido sobre los 245 ficheros que este config SÍ
// recogía destapó el cuarto — otra vez el patrón de `salidas-11-errata-grate.md`:
// *un censo enumera lo que se le ocurrió al autor*. Los cuatro, con su causa:
//   · combat-klimb-grate      — ENOENT: assets/{data,initial-state}.json y
//                               assets/maps/combatmaps.json en carga de módulo.
//   · salas-censo-tres-puertas — ENOENT: assets/maps/combatmaps.json, ídem.
//   · composed-quotes-162     — ENOENT: assets/talk/{towne,castle}.json. Éste es el
//                               que la auditoría no vio, y por eso: NO lee en carga de
//                               módulo sino DENTRO de los `it` (un helper `talk()` y un
//                               `readFileSync` inline), así que no aparece en el barrido
//                               por top-level que encontró a los otros tres.
//   · parity-coupled          — NO es ENOENT de assets: lanza `pytest re/tools/*.py` y
//                               el génesis copia `re/tools --exclude '*.py'`. Es
//                               exactamente el caso que esta cabecera ya avisaba con
//                               `acumulador-ventana`: el criterio NO es «lee assets».
// RE-CENSADO el 2026-08-01 tarde (clic 1, génesis sobre c7b9659d): CINCO más, todos
// con la MISMA causa raíz y nueva para esta lista — importan (directa o transitivamente)
// e2e/grandtour/nav-graph.ts o espejo-tour/runner.ts, que hacen readFileSync de
// assets/maps/*.json EN CARGA DE MÓDULO. El test no «lee assets»: su IMPORT los lee.
//   · espejo-ancla-npc        — importa runner (anclas-f4)
//   · espejo-exit-capa        — importa runner (ad18)
//   · espejo-ledger           — importa runner (F3b, ledger vivo)
//   · espejo-rune-echo        — importa PromptManager vía runner (des-por-7)
//   · resolvedor-f6-arena     — importa nav.ts → nav-graph (resolvedor-f6)
// ═══ 2026-08-02, carril `import-perezoso`: ESA FAMILIA ENTERA QUEDA DEROGADA ═══
// Todo lo que estas dos últimas tandas archivan como «importa runner/nav» ya NO es
// causa de exclusión. `nav-graph.ts` lee `assets/maps/smallmaps.json` de forma
// PEREZOSA (memoizada en `smallmaps()`, primer `buildLocationGraph`): importar el
// runner ya no toca `assets/`. `TileData.json` se quedó eager a propósito — vive en
// `src/core/data/`, que SÍ viaja.
// MEDIDO, no razonado (sonda del árbol desnudo: worktree detached SIN `game/assets` +
// `test:pure`). De los 16 ficheros que esta lista mantenía fuera por la cadena:
//   · 13 PASAN y vuelven al CI público (12 aportando tests de verdad; el 13º,
//     `espejo-comparador-bandas-ab`, se auto-SALTA por `skipIf(!tieneMaterial)` —
//     su banco vive en `.espejo/`, gitignored — así que aporta 0 tests EJECUTADOS
//     y se des-excluye sólo porque su motivo archivado ya no es cierto).
//   · 3 SIGUEN FUERA, por causa PROPIA y ajena a la cadena — ver sus 3 líneas abajo.
// Cifra del árbol desnudo: 260 → 271 ficheros, 3249 → 3560 tests (+11 / +311).
// La GUARDA MECÁNICA de compra-fantasma (`tests/pure-exclusiones-runner.test.ts`) NO
// se borra: se REFORMULA a lo que sigue siendo cierto — «ningún módulo del cierre de
// imports del runner lee assets/ en carga de módulo». Protege exactamente estos 13.
// MANTENIMIENTO (25-08): ya NO depende de que te acuerdes ni de que alguien repita el censo
// a mano. `bash re/tools/sonda_pure_publico.sh` monta el árbol del génesis y corre en él los
// CUATRO jobs del CI público (tsc game · tsc e2e · test:pure · build); está en
// `bateria_aterrizaje.sh`, así que un test nuevo que lea dato del juego enrojece TU
// aterrizaje nombrando el fichero y la ruta que le falta. Las ocho tandas de arriba son lo
// que costó no tenerlo.
// Y ANTES DE AÑADIR UNA LÍNEA AQUÍ, mira si el fichero es mayoritariamente puro: acotar el
// `describe` que lee dato con `describeSiViaja` (tests/assets-opcionales.ts) deja el resto
// del fichero corriendo en el repo público. Excluir es lo barato, no lo bueno.
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vite.config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "**/node_modules/**",
        "e2e/**",
        "tests/acumulador-ventana.test.ts",
        "tests/aim-side-aware.test.ts",
        "tests/amulet-negate.test.ts",
        "tests/assets-invariants.test.ts",
        "tests/attack.test.ts",
        "tests/audit-byte-wrap.test.ts",
        "tests/bed-sleep-thrown.test.ts",
        "tests/board-nay.test.ts",
        "tests/camp-ambush.test.ts",
        "tests/cbt-unit-classification.test.ts",
        "tests/charmed-attacker.test.ts",
        "tests/colas-224-colas-bloqueo.test.ts",
        "tests/combat-active-player.test.ts",
        "tests/combat-escape-ship-guard.test.ts",
        "tests/combat-exit-gating.test.ts",
        "tests/combat-hotfix.test.ts",
        "tests/combat-klimb-grate.test.ts",
        "tests/combat-pacer-chunking.test.ts",
        "tests/combat-party-placement.test.ts",
        "tests/combat-rats-cycle.test.ts",
        "tests/combat-ready.test.ts",
        "tests/combat-seed.test.ts",
        "tests/combat-spells.test.ts",
        "tests/combat-victory-linger.test.ts",
        "tests/combat.test.ts",
        "tests/comilla-literal.test.ts",
        "tests/commands.test.ts",
        "tests/composed-quotes-162.test.ts",
        "tests/confusion-combat.test.ts",
        "tests/conquer-room-plates.test.ts",
        "tests/corpser-dragged-under.test.ts",
        "tests/data-strings-manifest.test.ts",
        "tests/dialogue-effects.test.ts",
        "tests/dialogue.test.ts",
        "tests/doom-ambush.test.ts",
        "tests/dungeon-dispatch.test.ts",
        "tests/dungeon-light-spells.test.ts",
        "tests/dungeon-room-cleared.test.ts",
        "tests/dungeon-wanderer.test.ts",
        "tests/dungeon.test.ts",
        "tests/endgame.test.ts",
        "tests/enemy-move-class.test.ts",
        "tests/equip.test.ts",
        "tests/espejo-dungeon-filter.test.ts",
        // int-resto: triangula el INT despejando la fórmula del PORT contra los precios del LP,
        // y para eso lee `assets/data.json` (equipmentBasePrices) en CARGA DE MÓDULO → ENOENT en
        // el árbol público. Medido: escondiendo `game/assets` y corriendo este config, el fichero
        // cae entero. 🔴 En esa misma medición cayeron CUATRO ficheros MÁS que ya están en main y
        // que este config no excluye (`espejo-int-loc2`, `espejo-comparador-bandas{,-ab}` y
        // `espejo-anchors-cinturon`): están reportados al lead, no se tocan desde aquí porque dos
        // de ellos son de carriles VIVOS. Ver `re/notes/int-resto-acta.md` §7.
        "tests/espejo-int-resto.test.ts",
        // SEXTA tanda (02-08 madrugada, lead, con la sonda de 17 s tras cada aterrizaje): TRES
        // más, todos de carriles de esta noche y todos por la misma familia de causas —
        // `censo-sombra-mercader` importa `assets/npcs.json`; `espejo-cierre-dialogo` y
        // `espejo-costura-pacer` leen `assets/maps/smallmaps.json` vía el arnés. La lección de
        // la 5ª tanda se aplica ya: la sonda deja de ser un re-censo a mano cada pocos días y
        // pasa a correrse EN CADA ATERRIZAJE que añada tests (es lo que cazó estos tres).
        "tests/censo-sombra-mercader.test.ts",
        // SÉPTIMA tanda (02-08, carril `ancla-herrero`): misma causa que su hermano
        // `censo-sombra-mercader` — conduce el `NpcManager` REAL contra `assets/npcs.json`, que
        // es justo lo que le da valor (mide el port, no una copia) y justo lo que no viaja.
        "tests/ancla-herrero-ventana.test.ts",
        // 🔴 ROJO LATENTE **ya en main**, medido no razonado (carril `poblar-deltas`): escondiendo
        // `game/assets` y corriendo este config, este fichero cae ENTERO por ENOENT en
        // `tests/espejo-ledger-poblado.test.ts:187` — el `readJson(assets/data.json)` del bloque
        // de `ad09-g04`, que entró en `04e033c2` (carril `teclas-ad09`) DESPUÉS de que
        // `int-resto-acta.md` §7 censara los cuatro anteriores, y por eso no está en aquella
        // lista. Es la QUINTA vez que el patrón muerde (25-07, 27-07, 30-07, 01-08, 02-08): la
        // lista se re-censa a mano y vuelve a quedarse corta.
        // [[control-negativo-enumera-lo-que-se-le-ocurrio-al-autor]]
        // El carril `poblar-deltas` añade además la lectura del checkpoint `.gam` para simular
        // el flujo de venta; la exclusión cubre las dos. Ver `re/notes/poblar-deltas-acta.md`.
        "tests/espejo-ledger-poblado.test.ts",
        // ═══ OCTAVA (25-08) — DEROGADA EL MISMO DÍA POR EL CARRIL `corpus-sintetico-espejo` ═══
        // Aquí vivían DIECISIETE exclusiones: `espejo-routes` y sus dieciséis hermanos, todos
        // por la misma causa —el génesis dejó de copiar `e2e/espejo-tour/routes{,-ad}/`, que
        // llevan la prosa TLK de EA verbatim (#376), y `listParts()`/`readdirSync` daban ENOENT
        // en el árbol público—. Aquella tanda dejó escrita, junto a las 17 líneas, la ficha que
        // este bloque cierra: «para varios de estos el sujeto real es el CURADOR, no la prosa —
        // el arreglo natural es un corpus sintético».
        //
        // ★★ LO QUE SE MIDIÓ AL ABRIRLOS UNO A UNO, y que la exclusión a bulto tapaba: de los
        // **458 tests** de los 17 ficheros, **297 no tocaban el corpus en absoluto**. Estaban
        // fuera del CI público como REHENES de una lectura ajena en el mismo fichero — y en
        // cinco casos ni siquiera de un `it`, sino de un `readFileSync` en carga de módulo o en
        // el CUERPO de un `describe`, que tumba el fichero entero al RECOLECTAR.
        //
        // 🔴 Y LA TRAMPA QUE ESO DESTAPA, porque parece resuelta y no lo está: **`describe.skip`
        // EJECUTA su cuerpo**. Envolver el bloque en `describeSiViaja` decide si los `it` corren,
        // NO difiere la lectura: un `readFileSync` del material que falta puesto en el cuerpo de
        // un `describeSiViaja` sigue dando ENOENT en el público. La regla que sí vale —y con la
        // que se reescribieron los 17— es «la lectura del material que no viaja va SIEMPRE dentro
        // del callback de un `it`». Está anotada en `tests/assets-opcionales.ts`.
        //
        // LA SALIDA, en dos piezas y con la frontera escrita en `tests/espejo-corpus.ts`:
        //   1. `e2e/espejo-tour/routes-sint/` — CORPUS SINTÉTICO tracked, con la misma FORMA que
        //      los reales y prosa 100 % nuestra (medido con el predicado caro de la casa,
        //      `companion_ngram_overlap.rachas`: 0 rachas a n=8 y a n=5 contra el corpus EA; la
        //      guarda de contenido del génesis lo barre y da cero). Es punto fijo de `curate`,
        //      de `derive-dungeon-ops` y de `apply-ledger-overlay --verify`, y hay tests que lo
        //      asientan para que no se pudra en silencio. Ahí corren las propiedades del CURADOR
        //      —los `skip` planifican nav-only, los `recruit` viajan como op sancionada, la
        //      costura de salida al Underworld cierra el interior, el derivador no mueve un
        //      byte, `insertOps` aterriza donde el artefacto lo tiene—, que es lo que la ficha
        //      pedía recuperar.
        //   2. Lo que NO se movió, y no por pereza: los censos por identidad y los cardinales
        //      calibrados del corpus REAL (los 63 campos, las 2637 claves, las 310 ops, los 16
        //      del Underworld, las 7 anclas de transacción, los 6 companions del LP2). Sobre un
        //      corpus que escribimos nosotros el esperado saldría del sujeto y el aserto pasaría
        //      con la herramienta rota — mover un censo al sintético no recupera cobertura, la
        //      FALSIFICA. Esos van en `describeCorpusReal`, que los SALTA con motivo visible en
        //      el público y los corre aquí.
        //      [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
        //
        // ⚠ Y por eso los 17 salen de esta lista en vez de quedarse con un motivo mejor
        // redactado: la cabecera de este fichero ya lo dice —«excluir es lo barato, no lo
        // bueno»—, y aquí lo barato costaba 297 tests que no tenían nada que ver con la prosa.
        //
        // Causa DISTINTA (25-08, tren #144): corre `townTurn` y `NpcManager` reales sobre
        // el mapa real — `assets/maps/smallmaps.json` en carga de módulo (línea 55) y
        // `assets/npcs.json` en el cuerpo (152). Assets del juego del usuario, que por
        // diseño no viajan. Es la familia de los 20 de `assets/data.json`, no la del espejo.
        "tests/gargolas-alfombra.test.ts",
        // MISMA causa (26-08, tren F8, cazado por la SONDA DEL ÁRBOL PÚBLICO antes de
        // aterrizar — que es exactamente para lo que existe). El fichero muere **AL
        // COLECTAR**, no en un `it`: lee los tres assets en CARGA DE MÓDULO (líneas 72-74,
        // `assets/npcs.json` · `assets/maps/smallmaps.json` · `assets/maps/overworld.json`).
        // El ENOENT medido en el árbol público: `…/game/assets/npcs.json`.
        // Va a `exclude` y NO a `describeSiViaja` porque **su SUJETO ES EL DATO**: los cuatro
        // bloques (§1 censo del .NPC, §2 geometría de apliques, §3 los dos casos del haz)
        // parten de esos mapas reales. Acotar describes dejaría el fichero sin nada que correr
        // y con la falsa apariencia de estar cubierto en el CI público.
        "tests/f8-objeto-vs-vision-y-luz.test.ts",
        // SÉPTIMA (02-08, carril `compra-fantasma`, cazado por la sonda de 17 s del propio
        // carril). ★★ Y con un CENSO que convierte esta familia en un PREDICADO en vez de una
        // enumeración: **`e2e/espejo-tour/runner.ts:27` importa `../grandtour/nav`, que arrastra
        // `nav-graph.ts`, que lee `assets/maps/smallmaps.json` EN CARGA DE MÓDULO**. Así que
        // *todo* test que importe el runner del espejo cae en el árbol desnudo, importe lo que
        // importe de él. Medido sobre los 14 ficheros que hoy lo importan: **13 ya estaban
        // excluidos y el 14º era el mío** — el predicado acierta el 100 %.
        // Por eso este carril deja además un GUARDA MECÁNICO (`tests/pure-exclusiones-runner.
        // test.ts`) que se pone rojo NOMBRANDO el fichero nuevo, para que la lista deje de
        // re-censarse a mano. [[control-negativo-enumera-lo-que-se-le-ocurrio-al-autor]]
        // La vía de fondo (hacer perezoso ese import y des-excluir los 14) queda como TICKET:
        // toca un fichero que ahora mismo se están repartiendo varios carriles.
        //
        // 🔴 EL PÁRRAFO DE ARRIBA ES HISTORIA, Y SU MECANISMO YA NO EXISTE (anotado el 25-08 por
        // `corpus-sintetico-espejo`, a petición del lead; la derogación estaba SÓLO en la
        // cabecera de este fichero, a 180 líneas de aquí, y aquí seguía leyéndose como causa
        // vigente). El TICKET que estas líneas dejaban abierto ESTÁ HECHO: `nav-graph.ts` lee
        // `assets/maps/smallmaps.json` de forma PEREZOSA y memoizada (`smallmaps()`, primer
        // `buildLocationGraph`), así que **importar `e2e/espejo-tour/runner.ts` ya no toca
        // `assets/`** — los únicos `readFileSync` eager de su cierre apuntan a
        // `src/core/data/TileData.json`, que SÍ viaja. Y el guarda mecánico de al lado ya no
        // dice lo de arriba: fue REFORMULADO a «ningún módulo del cierre de imports del runner
        // lee `assets/` en carga de módulo», que es el defecto y no el síntoma.
        // ⇒ **«importa el runner» NO es motivo para excluir a nadie.** Los ficheros de esta
        // tanda siguen fuera por causa PROPIA (cada uno lee su asset), no por la cadena; lo que
        // este carril NO hizo es re-medirlos uno a uno, así que la lista se queda tal cual y
        // sólo se corrige la causa escrita. Quien quiera recuperarlos: la sonda los adjudica en
        // un minuto (`re/tools/sonda_pure_publico.sh`), y ya no hace falta creerle a este texto.
        "tests/fiel-demo-audio.test.ts",
        "tests/fiel-demo-scene.test.ts",
        "tests/fiel-endgame-scene.test.ts",
        "tests/grandtour-manifest.test.ts",
        "tests/gypsy.test.ts",
        "tests/harpsichord-game.test.ts",
        "tests/i18n-corpus-inventory.test.ts",
        "tests/i18n-manifest.test.ts",
        "tests/inn-wake-npc-snap.test.ts",
        "tests/interior-objects.test.ts",
        "tests/keyword-alias-es.test.ts",
        "tests/line-spray-fx.test.ts",
        "tests/look-concat.test.ts",
        "tests/look-npc-tile.test.ts",
        "tests/lote-133.test.ts",
        "tests/magic.test.ts",
        "tests/moon-phase-latch.test.ts",
        "tests/moongates.test.ts",
        "tests/moonstone-search.test.ts",
        // ── Los 3 SUPERVIVIENTES de la des-exclusión del 02-08 (`import-perezoso`). Ninguno
        // cae ya por importar el runner: cada uno tiene causa PROPIA, medida en el árbol
        // desnudo. Si algún día se quieren recuperar, el trabajo es de cada fichero, no de
        // la cadena de imports.
        //   · nav-graph          — es el test DEL grafo: llama `buildLocationGraph`, que es
        //                          justo donde vive ahora la lectura perezosa de
        //                          `assets/maps/smallmaps.json`. Sin el mapa no hay grafo que
        //                          construir: 9/9 rojos por ENOENT en `nav-graph.ts:40`.
        //                          IRRECUPERABLE por diseño (su sujeto es material de EA).
        //   · espejo-anchors     — `loadAsset("../assets/data.json")` SUYO, en carga de módulo
        //                          (`espejo-anchors.test.ts:181`), para el censo invertible de
        //                          mercaderes.
        //   · espejo-rune-echo   — `readJson("../assets/data.json")` SUYO, en carga de módulo
        //                          (`espejo-rune-echo.test.ts:43`), para `buildSpellDefs`.
        "tests/nav-graph.test.ts",
        "tests/espejo-anchors.test.ts",
        "tests/espejo-rune-echo.test.ts",
        "tests/npc.test.ts",
        "tests/overworld-ai-replay.test.ts",
        "tests/parity-coupled.test.ts",
        // RE-CENSADO 02-08 (hallazgo §7 de int-resto-acta, cerrado por el lead): los CUATRO
        // rojos LATENTES que su medición sin assets destapó — mismos modos de fallo que la
        // familia de arriba (lectura de rutas/assets o import del runner). La sonda que los
        // caza cuesta 17 s (esconder game/assets + test:pure) y AHORA está en la pasada
        // pre-clic del génesis (FASE-D-RUNBOOK §1.4 ya corre PURE dentro del árbol público).
        "tests/espejo-int-loc2.test.ts",
        "tests/espejo-anchors-cinturon.test.ts",
        // OCTAVA (02-08, carril `costura-interna`, cazado por la sonda del árbol desnudo ANTES de
        // aterrizar, no después). Lee `assets/data.json` (`locationNames`) para DERIVAR el
        // `enterLoc: 26` de `ad09-g04` del banner del propio corpus en vez de teclearlo.
        // ★ Y por eso está SOLO en este fichero: el carril nace con 18 tests, y los otros 17 —los
        // unitarios de las dos ops, los que matan los 6 mutantes, la guarda ESTÁTICA del orden del
        // bucle y el censo del vocabulario— no leen nada de `assets/` y **se quedan en el CI
        // público**. Partir el fichero cuesta uno nuevo; no partirlo habría exiliado la única
        // guarda que caza el mutante que deja el ticket inerte.
        "tests/espejo-costura-interna-banner.test.ts",
        "tests/party.test.ts",
        "tests/persistence.test.ts",
        "tests/polearm-over-obstacle.test.ts",
        "tests/prompts-troll.test.ts",
        "tests/quest.test.ts",
        "tests/quickness-combat.test.ts",
        "tests/ranged-room-drive-r15.test.ts",
        "tests/reagent-patches.test.ts",
        "tests/ring-expiry.test.ts",
        "tests/room-triggers.test.ts",
        "tests/sala-sin-enemigos.test.ts",
        "tests/salas-censo-tres-puertas.test.ts",
        "tests/save-native-enemies.test.ts",
        "tests/search.test.ts",
        "tests/shops.test.ts",
        "tests/shrines.test.ts",
        "tests/sidecar-qol-normalizado.test.ts",
        "tests/summon-placement.test.ts",
        "tests/sword-of-chaos.test.ts",
        // Carril talk-celda-paginacion (24-08): conduce la charla del compañero de celda
        // con el GUION REAL — lee assets/talk/castle.json dentro de los `it` (misma
        // familia que composed-quotes-162: no aparece en un barrido por top-level).
        "tests/talk-celda-gorn.test.ts",
        "tests/time-stop-combat.test.ts",
        "tests/view.test.ts",
        "tests/world.test.ts",

        // ══════ NOVENA TANDA — 2026-08-25, carril `censo-puro-drift` (main ccf4327a) ══════
        // 49 ficheros. Es el re-censo más grande de la lista, y no porque nadie mirase: es
        // que la sonda a mano se dejó de correr. Última tanda: 24-08 (`talk-celda-gorn`);
        // antes, 02-08. En medio, VEINTE DÍAS de tests nuevos que leen dato del juego y que
        // dejaban el CI del repo PÚBLICO en rojo — 56 ficheros / 93 tests sobre 440/5245.
        //
        // ★★ LA MEDICIÓN ES EL GÉNESIS DE VERDAD, no una simulación de él. Se corrió
        //    `docs/publicacion/genesis-publico.sh` a un destino temporal (6,6 s) y `test:pure`
        //    DENTRO. Lo que aquí se archiva es esa corrida, fichero a fichero, con la ruta
        //    exacta que cada uno no encuentra.
        // 🔴 Y EL FALSO POSITIVO QUE ESA MEDICIÓN TRAE DE SERIE, por si alguien la repite:
        //    el destino del génesis NO ES UN REPOSITORIO GIT hasta que se le hace `git init`,
        //    y `sellos-puerta` afirma que `procedencia()` devuelve un sha de 40 hex. Sin el
        //    `git init` sale un ROJO 57.º que NO existe en el repo público (allí hay `.git`
        //    desde el primer clon). El paso está escrito en el propio génesis («Siguiente:
        //    … y 'git init'») y es parte de la sonda: sin él se excluiría un fichero sano.
        //
        // ★ LOS 49 SE EXCLUYEN Y 7 MÁS **NO**: cuando el fichero fallaba ENTERO (o dejaba un
        //   solo test verde) excluirlo no cuesta cobertura y es lo barato. Cuando el fichero
        //   era MAYORITARIAMENTE puro y sólo un `describe` leía dato, se acotó ese bloque con
        //   `describeSiViaja` (tests/assets-opcionales.ts) y el fichero SE QUEDA en el CI
        //   público. Así se salvaron 109 tests que la exclusión a bulto habría exiliado:
        //     · shard-ritual-av 36 · capture-live 29 · runas-por-tramo-364c 16
        //     · espejo-tecleos-parciales 10 · dungeon-botonera 9 · espejo-dedupe-desmonte 9
        //     · mirror-reflection 12 (y de paso el TS2307 que rompía `tsc` en el público)
        //   El criterio para el siguiente: se excluye el fichero cuyo SUJETO es el dato; se
        //   acota el bloque cuando el dato es un testigo más dentro de un fichero que mide
        //   otra cosa.
        //
        // 🔴 Y LA DERIVA TIENE UNA SEGUNDA POLARIDAD que nadie había mirado: esta lista es
        //   default-ALLOW (lo que no está, corre), así que también se rompe por PERDER
        //   entradas. Medido: `tests/exploration.test.ts` y `tests/journal.test.ts` llevaban
        //   aquí desde el censo original y sus ficheros NO EXISTEN — se borraron el 26-07 al
        //   retirar el minimapa y el diario QoL (754714b3, a423215c). Ahí la causa era un
        //   BORRADO y las dos líneas sobraban; si hubiera sido un RENOMBRADO, el fichero
        //   seguiría leyendo dato y estaría corriendo en el CI público sin que nadie lo
        //   decidiera. Las dos líneas se han quitado y esa clase tiene guarda propia de
        //   0,1 s: `tests/pure-exclusiones-runner.test.ts`, segundo `describe`.
        //
        // ⚠️ PRONÓSTICO MEDIDO, NO EXCLUSIONES — para quien aterrice `genesis-endurecer`.
        //   Ese carril (rama viva el 25-08, c3b71545) añade al génesis
        //   `--exclude e2e/espejo-tour/routes{,-ad,-lf}/`: hoy esos 98 JSON VIAJAN al árbol
        //   público (medido: están en el destino) y por eso los tests del espejo que los leen
        //   PASAN allí. El día que esa rama entre, dejan de viajar y caen **17 ficheros más**.
        //   Medidos aquí simulando su exclusión sobre el árbol del génesis (25-08):
        //     espejo-anclas-lp1 · espejo-clasif-discrepan · espejo-compra-fantasma
        //     espejo-costura-interna · espejo-curate-anchor · espejo-curate-cablear
        //     espejo-curate-verify · espejo-denominador · espejo-desfase-derivador
        //     espejo-diener-int · espejo-dungeon-ops · espejo-etiqueta-txn
        //     espejo-latentes-e2 · espejo-ledger · espejo-overlay-merge · espejo-routes
        //     espejo-underworld-exit
        // ✅ DESENLACE MEDIDO (25-08, el lead componiendo las dos ramas): de los 17
        //   pronosticados cayó **UNO SOLO**, `espejo-routes` (excluido arriba con su causa).
        //   Los otros 16 siguen verdes en el árbol público: el pronóstico se hizo simulando
        //   la exclusión, y simular no es componer — la sonda sobre el árbol real es la que
        //   adjudica. Se deja escrito el número pronosticado y el medido para que nadie
        //   herede el 17 como si fuera un censo.
        // 🔴 NO SE EXCLUYEN AQUÍ Y ES DELIBERADO: hoy los 17 PASAN en el árbol público, así
        //   que excluirlos sería retirar cobertura real con un motivo que todavía no es
        //   cierto — y dejaría escrita en este fichero una causa («routes no viaja») que el
        //   génesis de `main` contradice. La decisión es de quien aterrice aquella rama, y
        //   puede no ser «excluir»: para varios de estos el arreglo natural es un corpus
        //   sintético, porque su sujeto es el CURADOR, no la prosa. La sonda los nombrará
        //   uno a uno en esa batería; esta lista sólo ahorra el censo.
        // ✅ CERRADO EL MISMO DÍA (25-08 tarde, carril `corpus-sintetico-espejo`): la rama
        //   aterrizó, los 17 cayeron de verdad y se excluyeron en bloque… y ese bloque está
        //   ya DEROGADO más arriba. Los 17 vuelven al CI público con el corpus sintético
        //   `e2e/espejo-tour/routes-sint/` y `describeCorpusReal` para lo censal. Y la
        //   corazonada de estas líneas —«puede no ser excluir»— era la buena: **297 de sus
        //   458 tests no tocaban el corpus** y estaban fuera como rehenes.
        //
        // ★★ Y ESTA TANDA NO DEBERÍA REPETIRSE: `re/tools/sonda_pure_publico.sh` corre los
        //   CUATRO jobs del CI público sobre el árbol del génesis en ~1 min y está en la
        //   batería de aterrizaje. Un test nuevo que lea dato del juego enrojece AHÍ,
        //   nombrando el fichero y la ruta que le falta, en vez de acumularse veinte días.
        // ENOENT `assets/data.json` — conducen el port REAL contra los datos extraídos (20):
        "tests/absorcion-cue-sfx.test.ts",
        "tests/absorcion-desenlace.test.ts",
        "tests/antym-ranged-interference.test.ts",
        "tests/camp-guard-walk.test.ts",
        "tests/campos-energia-arena.test.ts",
        "tests/chest-arena-centinela-41.test.ts",
        "tests/combat-jspy-121.test.ts",
        "tests/espejo-es-momentos.test.ts",
        "tests/get-torch-arena-375.test.ts",
        "tests/illusion-quas-xen-340.test.ts",
        "tests/invisibilidad-pase-turno.test.ts",
        "tests/invisibility-targeting-exemptions.test.ts",
        "tests/invisible-render-tile.test.ts",
        "tests/mirror-break.test.ts",
        "tests/muertos-combate-356.test.ts",
        "tests/npc-hostil-ataca.test.ts",
        "tests/possessed-passes-out-349.test.ts",
        "tests/salas-selladas-mazmorra.test.ts",
        "tests/siembra-objetos-cbt-353.test.ts",
        "tests/victory-fanfare-212.test.ts",
        // ENOENT `assets/initial-state.json` — parten del estado inicial EXTRAÍDO (18):
        "tests/an-grav-dispel-319.test.ts",
        "tests/an-sanct-dungeon-286.test.ts",
        "tests/bed-sleep-blackout.test.ts",
        "tests/board-chain-378.test.ts",
        "tests/cast-absorbed-gate.test.ts",
        "tests/cast-onwho-consumidores.test.ts",
        "tests/field-wall-dungeon.test.ts",
        "tests/hook-inn-leave.test.ts",
        "tests/in-wis-peer-319.test.ts",
        "tests/miniatura-slot-carga.test.ts",
        "tests/momentos-escapables.test.ts",
        "tests/party-sprite-bank.test.ts",
        "tests/savepanel-foco.test.ts",
        "tests/skullkey-camara-232.test.ts",
        "tests/walkthrough-saves.test.ts",
        "tests/wis-an-ylem-reveal-319.test.ts",
        "tests/xit-esquife-alfombra-273.test.ts",
        "tests/xit-fragata-amarrada-270.test.ts",
        // ENOENT `assets/maps/smallmaps.json` — miden sobre el MAPA real (3):
        "tests/look-night-sky.test.ts",
        "tests/npc-escaleras-c4.test.ts",
        "tests/visibility-resplandor-350.test.ts",
        // ENOENT `assets/npcs.json` — conducen el NpcManager real (2):
        "tests/tienda-gate-horario-315.test.ts",
        "tests/tienda-proximidad-304.test.ts",
        // ENOENT `assets/shrine-scene.json` — la escena del santuario extraída (2):
        "tests/shrine-key-wait.test.ts",
        "tests/shrine-scene.test.ts",
        // ENOENT `game/assets/initial-state.json` + `game/assets/talk/castle.json` + `game/e2e/espejo-tour/saves/ad01.gam` (1):
        "tests/blackthorn-trono-nombre.test.ts",
        // ENOENT `assets/signs.json` — los carteles extraídos (1):
        "tests/fiel-sign-box.test.ts",
        // ENOENT `original/u5/play/DATA.OVL` — leen EL BINARIO DE EA (jamás viaja) (1):
        "tests/lighthouse-beam.test.ts",
        // ENOENT `re/disasm/EGA.DRV.asm` — el EA-material check del génesis prohíbe los .asm por nombre (1):
        "tests/intro-sonidos-220.test.ts",
      ],
    },
  }),
);
