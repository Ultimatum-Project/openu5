# WALKTHROUGH-ESPEJO — suite de conformidad continua (Part01→24 de aulddragon)

Rejuega la ruta ENTERA del LP canónico (aulddragon, 24 partes) en el port como suite de
regresión permanente, comparando el log de consola del port contra los OCR-logs del vídeo
(`original/av-referencia/yt/clips/full-part-logs/`, gitignored). No es careo-para-tickets
(fases 1-2, `re/notes/espejo-part08.md` + `espejo-fase2.md`): es **prueba de conformidad
continua** — y desde el ajuste del encargo, **caza activa** del bug de ESTADO ACUMULADO
(deriva numérica de oro/comida/reloj entre partes) que el careo por escenas no ve.

### Los TRES corpus de OCR (todos gitignored, rutas absolutas)

La línea de arriba cita sólo el primero, que es el del LP1. Hay tres, y confundirlos es la
causa más barata de un cero que parece «corpus ausente»:

| corpus | ruta | contenido | nº |
|---|---|---|---|
| LP1 (aulddragon) | `original/av-referencia/yt/clips/full-part-logs/` | `partNN.ocrlog.txt` | **24** |
| LP2 (Alex Diener, AD) | `original/av-referencia/yt/clips/full-part-logs-ad/` | `ad_epNN.ocrlog.txt` (ad_ep01..25) | **25** |
| re-calibrado (LP1) | `original/av-referencia/yt/clips/full-part-logs-recal/` | `partNN.ocrlog.txt` | **11** |

- **recal cubre `part07` + `part09`..`part18` y NADA MÁS**: no hay re-calibrado para
  `part19`..`part24`. Pedirlos devuelve vacío, y ese vacío es del corpus, no del port.
- ⚠ **EL MAPEO DE AD NO ES DIRECTO.** La RUTA se llama `adNN` (`routes-ad/ad13.route.json`)
  y el OCR-log se llama **`ad_epNN`** (`ad_ep13.ocrlog.txt`). Asumir que la parte `ad13`
  busca un `ad13.ocrlog.txt` da **cero comparables**, y ese cero se lee como «no hay
  corpus» cuando el fichero está ahí con otro nombre. Es el pie del que más se tropieza.
  (Los `.log` sueltos del directorio AD —`sweep-ad.log`, `rerun-failed.log`— NO son
  corpus: son bitácoras de corrida, y por eso el conteo de arriba es de `*.ocrlog.txt`.)

## Arquitectura: replay-por-inputs con resincronización por costura

El spam de movimiento del OCR (`>North`, `>Ride East`, `>Fly North`, `>Head West`) es el
**input-log completo del humano** y es la fuente PRIMARIA de navegación: el runner
reproduce esas teclas tal cual (misma ruta → mismos triggers de terreno, carteles,
hazards; un `Blocked!` donde el LP pasó limpio = ticket de pasabilidad instantáneo).
El pather (`e2e/grandtour/nav.ts`) actúa SOLO como **fallback de resincronización**.

El guion se corta en **SEGMENTOS TIPADOS** con **costura explícita** — cada costura es un
punto de resincronización natural y frontera de re-corrida:

| Costura | Semántica |
|---|---|
| `enter` (pueblo/castillo/keep/shrine) | la posición se resetea a la entrada estándar del mapa; se verifica `loc`, y si el replay se desvió, `enterLocation` resincroniza (arnés sancionado) |
| `exit` | reaparición en el tile del overworld |
| `combat` | paréntesis con política propia (`auto` = resolvedor real de teclas; `escape` = huir como el LP); resincronización post-combate |
| `camp-end` / `inn-morning` | hitos de descanso |
| diálogos/tiendas/prompts | paréntesis NO-movimiento: teclas de escena en el `script` (`{key}`, `{typed}` — las keywords que el LP tecleó, capturadas del OCR) |

Los encuentros RNG **difieren por diseño** (el port tiene su RNG): la política de combate
los resuelve y el hito siguiente resincroniza. Los huecos de OCR (~2-4% de ecos ilegibles)
van como `{gap:N}` — se anotan, JAMÁS se inventan pasos.

## Pipeline de generación (reproducible para Part07-24)

```
ocrlog.txt ──segment.mjs──▶ borrador route.json ──curate.mjs + overlays/partNN.json──▶ route.json
```

1. `tools/segment.mjs <ocrlog> <partNN> [--from N]` — segmenta el OCR: costuras, nav RLE,
   keywords tecleadas, bloques `expect` (des-wrap + dedupe difuso de redibujados).
2. `routes/overlays/partNN.json` — curación **manual**: `entry` (checkpoint de cadena),
   notas/calib por segmento, `insertOps` (teclas invisibles para el OCR: letras de menú
   de tienda, respuestas de gate), clases de expect (`pending`…), ledger esperado.
3. `tools/curate.mjs partNN` — aplica overlay + convierte ecos inequívocos en ops
   (`>Open-North` → `o`+`ArrowUp`, `? Yes` → `y`…). Idempotente.

Los `route.json` COMMITEADOS son el artefacto (la suite corre sin el corpus gitignored);
el pipeline solo hace falta para regenerar o extender.

## Formato del route.json (resumen)

```jsonc
{
  "part": "part05",
  "entry": { "checkpoint": "part04", "entryClock": {"hour":10,"minute":0} }, // o {"boot":"fresh"}
  "segments": [{
    "id": "part05-g21", "ctx": "smallmap", "seam": "enter",
    "enter": { "loc": 24, "banner": "BUCCANEER'S DEN" },   // costura verificable
    "ocr": { "from": 1869, "to": 2485 },                    // procedencia en el ocrlog
    "script": [ {"nav":[{"m":"north","v":"walk","n":3}]},   // input-replay RLE
                {"key":"t"}, {"key":"ArrowUp"},             // ops de escena
                {"typed":"NAME"},                            // keyword del LP (getstring)
                {"use":"Carpet"},                            // picker de (U)se
                {"gap":4},                                   // hueco OCR anotado
                {"todo":"…"} ],                              // pendiente de calibrar (no-op)
    "expect": [ {"text":"The trolls demand a 24 gp toll!", "ocrLn":1843, "class":"auto"} ],
    "policy": "auto", "calib": true, "note": "…"
  }],
  "ledger": { "assert": {"partySize": 6}, "note": "anclas numéricas del LP" }
}
```

### Clases de expect y veredictos del diff

- `auto` → el runner clasifica en runtime: RNG (tiradas de combate, auras, pools de
  saludo, loot de cofres) queda **no-comparable**; el resto es comparable.
- `numeric` — implícito: todo bloque con dígitos matchea con wildcard numérico y sus
  números van al **LEDGER** (`numericDeltas` del reporte): una deriva pequeña y creciente
  de oro/comida/fecha entre partes es EL ticket gordo típico. No se descartan números.
- `known-gap` (runtime, tabla `KNOWN_GAPS` en runner.ts con nº de ticket) — huecos ya
  ticketados del port (F2-T2/T3/T4/T6/T10, C5, C13…): no penalizan; si un día MATCHEAN
  se reportan como `gap-cerrado` (el fix aterrizó).
- `pending` — flujos sin calibrar del port (p.ej. Quit-save). No penalizan.
- Veredictos: `match` / `fuzzy` (dice ≥0.84) / `divergent` (con snippet más parecido) /
  `rng` / `known-gap` / `gap-cerrado` / `overlay-channel` / `pending`.
- Conformidad = matcheados/comparables por segmento y por parte.

## Cadena, checkpoints y bisección

`espejo-tour.spec.ts` corre las partes EN ORDEN: part01 bootea partida fresca (plantilla
INIT = choza de Iolo, como el LP; nombre normalizado a "Min" por arnés) y cada parte
exporta su checkpoint propio (`saves/partNN.{gam,sidecar.json}`, botón real Export .GAM)
que es la entrada de la siguiente. **No** usa los checkpoints del grandtour (la party del
LP evoluciona distinto).

```bash
# cadena entera (puerto propio 5246; NUNCA el 5199 del usuario)
npx playwright test -c playwright.espejo.config.ts

# calibración (reporta sin asertar umbral)
U5_ESPEJO_SOFT=1 npx playwright test -c playwright.espejo.config.ts

# bisección de una deriva: re-corre desde una parte concreta
U5_ESPEJO_FROM=part04 npx playwright test -c playwright.espejo.config.ts

# subconjunto
U5_ESPEJO_PARTS=part02 npx playwright test -c playwright.espejo.config.ts
```

Reportes por parte en `test-results/espejo-tour/partNN.report.json` (`ESPEJO_OUT` lo
mueve): conformidad por segmento, divergentes con snippet, resyncs, ledger de estado
final (oro/comida/party/reloj) y `numericDeltas`.

## Protocolo de ticket (divergencia real)

1. **Diff textual**: bloque OCR + snippet del port (del reporte).
2. **Frame del vídeo**: `tools/evidence.sh partNN <ocrLine>` — interpola el timestamp
   (los ocrlog no llevan timestamps por línea; ocr_video.py los descarta) y extrae 2-4
   frames con ffmpeg a scratch (JAMÁS tracked). Refinar con re-OCR de la ventana si hace
   falta el timestamp exacto.
3. **Captura del port** en el mismo punto (screenshot del run).

La divergencia se REPORTA con el punto de la cadena donde nace (parte + segmento + acción)
— no se arregla desde este carril.

## Estado Fase A / pendiente Fase B

- Fase A (sin playwright): pipeline completo, rutas Part01-06 generadas y curadas
  (751 ecos→ops automáticos; ~1.3k `todo` residuales, la mayoría texto de NPC que no
  requiere tecla), runner+spec+config tipando limpio. **NADA ejecutado aún.**
- Fase B (con ventana del lead): correr Part01→06, calibrar (todos residuales que sí
  requieren conducción, counts de compras de Virden, umbral de conformidad → ratchet),
  estabilizar ×2, números de conformidad + tickets con evidencia triple.
- Umbral inicial deliberadamente conservador (`U5_ESPEJO_THRESHOLD`, default 0.5).

## Fase C — RESYNC DE POSICIÓN POR-INTERACCIÓN (la palanca)

Diagnóstico de cierre de Fase B: el replay-por-inputs se desincroniza desde el segmento 1
(el RNG de combates/encuentros del port ≠ el del LP), así que los comandos DIRECCIONALES
(Look/Search/Get/peajes/compras) pisan CELDAS distintas → la conformidad se hunde POR DERIVA
(no por bugs del port) y el ledger numérico se congela (las transacciones no disparan bajo
deriva). Fase C ataca la RAÍZ: resincronizar la POSICIÓN a la celda del LP en cada beat de
interacción con ancla derivable, para que la interacción REAL caiga donde debe.

**Ancla de cara (`face`).** Un beat `(L)ook-DIR` cuyo resultado nombra una FEATURE de tile
(«Look-East ...ves a hot stove») es INVERTIBLE: la party estaba en la celda cuyo vecino-DIR es
el tile de la feature. La dirección y la feature van en el propio `expect` del OCR; la feature
se invierte a ids de tile por **LOOK2** (`assets/look2.json`, la MISMA fuente que
`game.data.look2`). Los ids se PRECALCULAN offline y viajan en `op.anchor`.

**Pipeline (paso extra, tras curate):**
```
routes/partNN.route.json ──derive-anchors.mjs (+ assets/look2.json)──▶ op.anchor:{kind,dir,sees,tileIds}
```
`tools/derive-anchors.mjs part01 | --all [--dry]` — idempotente; deriva SÓLO lo invertible con
certeza (Look con dirección legible + feature en LOOK2). Es CONSERVADOR: deseos del pozo,
resultados de Search/Get, carteles y OCR-basura NO reciben ancla (mejor sin ancla que falsa).
Corpus actual: **21 anclas de cara** (part01 tiene 5: estufa/barril/antorcha/cosecha/frutal);
sube según curate convierta más `todo` en ecos con feature.

**Runtime (runner.ts → `resyncToAnchor`).** Antes de ejecutar un op con ancla: resuelve la
celda contra el grid VIVO (`anchors.ts` → `resolveFaceAnchor`) y, si la posición difiere,
teletransporta la party ahí por la costura sancionada cero-rand `__u5debug.teleportSmallMap`
(misma clase que `goToLocation`/`teleportOverworld`). Desambigua por CERCANÍA (la deriva es
incremental); declina si hay demasiadas candidatas (`ambiguous`). **Cero candidatas = `ANCHOR-MISS`**:
la feature del LP no está en el mapa vivo → **candidato a divergencia REAL del port** (se aflora
explícito en el log; protocolo de ticket con evidencia triple, no se arregla desde aquí).

**Métrica nueva** (por parte, en el `report.json` + `summarize`): `anchorsResolved/Jumped/
Missed/Ambiguous` + **histograma de deriva** (`driftHistogram`, cubos 0/1/2/3-5/6-10/11+). La
expectativa del diagnóstico: los divergentes por deriva colapsan; lo que quede divergente TRAS
el resync es el candidato real a bug. Los MISS y la cola larga del histograma son las señales.

**Resolución en cascada (Fase C-b).** Un ancla de cara se resuelve en 3 niveles: (1) grid
COMPUESTO de la planta actual (con reconciliación horaria); (2) grids ESTÁTICOS de TODAS las
plantas de la location (`world.smallMaps`, `resolveFaceAnchorAcrossFloors`) — bookshelf del
castillo LB vive en f2, sótanos z=-1; el resync teleporta DE PLANTA; (3) capa de OBJETOS vivos
(`state.worldObjects`, `objectFaceCandidates`) — features que no son tile del grid: la ALFOMBRA
plot «an odd rug» = Carpet2 283. Miss final = ausente en todo el edificio Y en objetos.

**Anclas NPC de transacción (blindaje).** Antes del (T)alk: Escape ×2 (bajo deriva, los `typed`
de conversaciones no-conectadas dejan modos vivos —getstring de Yell, picker de Ready— que se
tragan la 't'); tras el Talk se VERIFICA `__u5test.shopOpen()` (2 intentos) y si la tienda no
engancha el ancla devuelve miss y el runner NO fabrica las teclas de la transacción sobre el
mapa (`skipTxnKeys`). El ledger mide igualmente y reporta la causa.

**Ops de arnés de transacción.** `seedGold` (solvencia) + `seedInt` (negociador: la INT del
avatar del LP — el careo del guild adjudicó la fórmula del port como calco EXACTO de
SHOPPES:0x02D8-0x0318 y fijó el INT del LP en 25 por triangulación gems-318/inn-22/helm-12) +
`seedEquip` (inventario para ventas: los 3 Leather Helm de Iolo's Bows son loot de la ruta RNG
del LP). Deltas anclados VERDES en cadena: guild New Magincia −954 (part05) y venta Gwenneth
+36 (part04, Blacksmith de Britain d129=0x81).

**Ops de COSTURA INTERNA** (carril `costura-interna`). El `ctx`/costura de un segmento describe
dónde **EMPIEZA**, no dónde ocurre cada beat; cuando el LP entra a una location a MITAD de segmento
el segmentador no lo parte y el runner se quedaba fuera. Dos ops lo arreglan, reusando la
maquinaria de costura que ya existía:

- **`enterLoc: <1..32>`** — «a partir de aquí la party está DENTRO de esa location»
  (`resyncEnterLocation` → `goToLocation`, cero-rand). Idempotente y declarada. Las mazmorras
  (33..40) **abortan**: su costura es `setDungeonPos`. A diferencia de la costura de segmento **no**
  intenta la (E) natural antes — a mitad de guion una (E) fallida deja un prompt que se traga las
  teclas siguientes.
- **`exitOverworld: "britannia" | "underworld"`** — la gemela de salida
  (`resyncExitToOverworld`). La capa es un **string obligatorio**, no un booleano: es el campo que
  este arnés ya se comió una vez (E-2 depositaba SIEMPRE en Britannia por un default `false`).

Van las PRIMERAS del bucle de conducción, antes de las anclas y del armado del ledger — el ancla de
NPC de detrás tiene que leer la location ya cambiada, o se abstiene (`if (pos.location === 0) →
skip`) y el delta sale 0. Cableado hoy: `ad09-g04` (`enterLoc: 26`, Bordermarch) — el **primer
delta verde del proyecto en territorio `overworld`** (−274, el herrero). `exitOverworld` está
implementada y **sin consumidores**: el censo de los dos corpus da 16 entradas a mitad de segmento
contra 5 salidas, y las otras 177 caen en la COLA del segmento, donde la costura del segmento
siguiente ya las resuelve.

## ESPEJO-2 — corpus AD (Alex Diener, ad01..ad25)

`U5_ESPEJO_CORPUS=ad` conmuta la spec al corpus `routes-ad/` con la MISMA disciplina
(cadena por checkpoints propios `saves/adNN.*`, prefijo disjunto de `partNN`):

```bash
U5_ESPEJO_CORPUS=ad U5_PARTS="ad01 ad02 …" bash tools/run-per-part.sh
```

**ESTRENO 2026-07-25 (SOFT): cadena 25/25 COMPLETA** — checkpoints ad01→ad25 exportados,
party del LP2 evoluciona (recruits Gwenno/Jaana/Julia por arnés; los SWAPS Julia→Mariah/
Jaana→Geoffrey **ya NO están pendientes: el op `dismiss` EXISTE** — ver el aviso de abajo).
Conformidad bruta global 4.7% (14924
comparables): línea-base dominada por deriva de instrumento (firma «Look-/Cancelled.» =
typed/looks de conversaciones no-conectadas; el spam de combate de AD no casa los patrones
RNG calibrados con el OCR de aulddragon) — calibración de patrones = siguiente ventana.
Anclas: 17 resueltas, 7 MISS TODOS adjudicados INSTRUMENTO (2 actores ad01 → exclusión
ACTOR_TILE; portcullis ad06 → hourBand re-derivado; mountains ad08 = look de overworld bajo
deriva; mirror/brick/hourglass ad12 = features de BLACKTHORN bajo deriva de LOCATION), 0
candidatos a sapo real. Palanca siguiente: resync de LOCATION por costura (los enter-seams
de AD no siempre recuperan la location del LP2) + ledger de deltas anclados para AD.
Roturas de cadena arregladas en el estreno: pacer de shrine/prompts vivos/drawer QA/combate
vivo bloqueaban el F5 del export (ver checkpoint.ts).

> ### ⚠ EL OP `dismiss` SÍ EXISTE (corrección 2026-07-30, E-5)
>
> La frase «los SWAPS requieren op de dismiss (**inexistente**)» que circula por este README
> y por las notas de ruta es **RANCIA**. El op está implementado y cableado:
> `runner.ts:2217` `dismissCompanion(page, name)`, invocado desde `runner.ts:2086` cuando un
> beat trae `op.dismiss`. Consume el hook `__u5test.innLeave` (`main.ts:365-369`), que llama
> al CORE `core/shops.innLeave` (`shops.ts:487`) — **calco de SHOPPES3 0x02AE-0x047D**.
> Cableado HOY en tres rutas: `ad05` (Julia→Mariah), `ad13` (Jaana→Geoffrey) y `ad21`
> (sale Iolo).
>
> **PERO SIGUE SIENDO INTERINO, y esto no se puede perder al corregir la frase.** Lo que
> existe es un **arnés de ESTADO**: fuerza la baja llamando al core, no la juega por el
> flujo real de posada («Pick up or Leave», con su prompt y su coste). La propia nota de
> `ad13` lo declara: el beat EXACTO del drop **no es derivable del OCR de AD** (no hay ni un
> «Pick up or Leave» en ad13; el censo de beats de posada del corpus da sólo ad03-g06,
> ad05-g07, ad21-g26 y ad21-g28), así que el `dismiss` se coloca en el beat que LIBERA EL
> HUECO. Sin él, el ledger de party del port divergiría del LP2 de ad13 en adelante.
> ⇒ **Ticket `T-INN-LEAVE-REAL`**: jugar la baja por el flujo de posada real en vez de por
> el hook de estado. Hasta que aterrice, todo resultado de party de AD lleva esta costura.
>
> **Residuo de esta corrección, declarado y NO arreglado aquí:** la frase vieja sigue viva
> en **50 ficheros generados** (`routes-ad/adNN.route.json` ×25 y `routes-ad/overlays/adNN.json`
> ×25). No se editan a mano porque **son generados**: el literal lo emite
> `tools/mkoverlay-ad.mjs:169` (y su docblock `:53`), que SÍ queda corregido en este commit.
> Los 50 se curan en la próxima regeneración de overlays; hasta entonces contienen prosa
> caduca. Ojo a la autocontradicción mientras dure: `ad05`/`ad13`/`ad21` traen a la vez el
> `"dismiss": "<nombre>"` REAL y la nota que lo llama inexistente.

### RELEVO-3b 2026-07-25 — re-corrida de la cadena AD: conformidad ×2.13 y ANCHOR-MISS a CERO

Cadena completa re-corrida parte-por-parte (24/25 verdes; rotura en ad21, ver abajo):

| métrica | estreno | relevo-3b | |
|---|---|---|---|
| conformidad global | **4.66%** (695/14 924) | **9.91%** (1286/12 971) | ×2.13 |
| matcheados | 695 | **1286** | ×1.85 |
| comparables | 14 924 | 12 971 | −1953 (instrumento declasificado) |
| **ANCHOR-MISS** | 7 | **0** | ← los 7 eran deriva de LOCATION |
| anclas resueltas | 17 | 17 (+6 ambiguas) | |

**Descomposición honesta del ×2.13** (los dos efectos son separables):
- **Replay** (guarda de sumidero por clase + purga de modos + resync de LOCATION): los
  matcheados suben 695→1286 **con el denominador del estreno eso ya es 8.62%** (×1.85). Es
  el efecto real, no aritmética de denominador.
- **Calibración por corpus** (perfil de OCR): 8.62% → 9.91%, retirando 1953 bloques de
  instrumento del denominador (1272 `ocr-ghost` + 224 `ocr-garbage` + 380 `pending`), todos
  contados APARTE en el reporte para que el efecto sea auditable.

**ANCHOR-MISS 7 → 0.** Los 7 MISS del estreno (adjudicados entonces «instrumento» sin poder
demostrarlo) quedan explicados y cerrados por el resync de LOCATION: **8 banners de PALACE OF
BLACKTHORN** que la ruta traía con `loc:null` (banner demasiado corrupto para el segmentador) se
resuelven en runtime contra la tabla viva + `KEEP_BANNERS`, y 2 se DECLINAN (no se adivina).
Cero candidatos a sapo de port en toda la cadena. Además 80 `RESYNC exit` (0 fallos): las
costuras `overworld` ahora COMPRUEBAN que la party salió.

**Lo que la re-corrida deja al descubierto** (y es el cuello de botella siguiente):
- **2680 `typed` descartados** y **244 purgas de picker-de-un-carácter**: las conversaciones del
  LP2 no CONECTAN bajo deriva. Mientras eso siga así no hay tienda que abrir → no hay deltas de
  ledger que medir (ver `re/notes/espejo-ledger-ad.md` §4).
- **El comparador ya NO es el cuello de botella**: de los divergentes que quedan, el **87%
  tiene cobertura <0.10** contra el transcript (el port simplemente no lo dijo), sin racimo
  bajo el umbral. Medido con `tools/calib-offline.ts` + `ESPEJO_CALIB_HIST=1`.
- **Densidad de curación NO explica la conformidad** (Pearson 0.25 sobre las 23 partes con
  número): ad07 tiene 69% de ops conducidas y daba 2.7%. La causa es deriva, no falta de ruta.

**ROTURA DE CADENA en ad21** (ticket abierto): su conformidad se midió (12%) pero el export del
checkpoint falló — `save-panel no abrió tras F5`, diag `drawerAny:true` con la party en loc 17
f1. Un cajón de la piel bloquea el F5. Consecuencia: **ad22-ad25 corrieron sobre el checkpoint
ad21 del ESTRENO**, así que sus números son válidos como medición aislada pero la cadena no es
contigua ahí. Fix candidato: purgar cajones (no sólo modales/prompts) antes del F5 en
`checkpoint.ts` — misma familia que las 4 roturas ya arregladas en el estreno.

**NO-REGRESIÓN DEL CORPUS LP1 — verificada, no supuesta.** El perfil de OCR es la IDENTIDAD para
LP1 (blindado por unit test), pero los cambios del RUNNER (guarda de `typed`, purga de modos,
resync de salida) son agnósticos de corpus y SÍ afectan a `part01..06`, así que se re-corrieron
las dos partes que llevan los deltas anclados verdes:

| | estreno | relevo-3b | delta anclado |
|---|---|---|---|
| part04 (venta helm Gwenneth) | 24.7% (94/380), MISS 0 | **25.6%** (97/379), MISS 0 | **+36 = +36 ✓ EXACTO** |
| part05 (guild New Magincia) | 7.4% (24/324), MISS 0 | **12.0%** (38/316), MISS 0 | **−954 = −954 ✓ EXACTO** |

Los dos deltas siguen disparando EXACTOS, MISS sigue en 0 y la conformidad de LP1 **sube** (el
efecto del replay es neutral-a-positivo también aquí). Quedan sin re-correr part01/02/03/06 (las
largas, >30 min cada una); nada indica riesgo, pero el gate completo de LP1 es del lead.

Módulos: `anchors.ts` (resolución pura, unit-testeada), `tools/derive-anchors.mjs` (+ `.d.mts`,
derivación pura, unit-testeada). Guardas offline: `tests/espejo-anchors.test.ts` (17 tests:
normalización/parseo OCR, derivación, inversión de grid, cercanía/miss/ambiguo, histograma, y
que las rutas COMMITEADAS llevan las anclas que el pipeline deriva). Sin playwright: la ejecución
de cadena (números de conformidad con-resync + cosecha de ANCHOR-MISS) va en la ventana del lead.

## FASE 3 — INTERIORES DE MAZMORRA (relevo-4: higiene + 3a + 3b)

Diseño y ruling completos en `design-interiores.md`. Resumen operativo:

### Higiene cerrada: la rotura de cadena de ad21 era el PACER DE REFUGIO, no un cajón

El relevo-3b dejó ad21 con el export del checkpoint roto (`drawerAny:true`) y ad22-25 corriendo
sobre el checkpoint del estreno. El testigo (`ad21.export-fail.png`) muestra la party DENTRO de
la escena PACEADA de party-wipe+resurrección («Strange words are intoned. / Vertigo...»):
`handleGameKey` hace `preventDefault()+return` mientras `refuging` es true, así que **el F5 no
llega nunca** y ninguna ráfaga de teclas lo despeja — el pacer corre a RELOJ DE PARED y hay que
esperarlo. `drawerAny` era un falso culpable (ese elemento existe SIEMPRE en dev).

- hook read-only sólo-DEV `__u5test.inputSinks()` = la escalera COMPLETA de sumideros que se
  tragan el teclado (pacers de reloj de pared, modales de cualquier tecla, prompts —incluidos los
  direccionales de mazmorra—, paneles DOM, drawers **y el FOCO dentro de un drawer**, combate,
  mazmorra). El bloqueador se MIDE, no se adivina.
- `checkpoint.ts`: `waitOutPacers` (espera con presupuesto y log) + `purgeDrawers` (cierra los dos
  drawers Y saca el foco de su root: `DebugPanel` hace `stopPropagation` de todo keydown nacido
  dentro, así que el foco en un drawer CERRADO también se come el F5 — ése era el mecanismo real
  del «cajón») + diag con `sinks`.
- Verificado en vivo: `[ad21] export: esperados los pacers refuging (12697 ms) antes del F5` →
  export OK. Y ad21 reproduce el reporte del relevo-3b **byte a byte** (12.3%, 36/293), así que
  el cambio es NEUTRO para lo ya medido.

### Cómo se conduce un interior (3a)

```
routes*/partNN.route.json ──derive-dungeon-ops.mjs──▶ ops {dng:...} + apertura del segmento
```
`tools/derive-dungeon-ops.mjs <partNN|--all> [--dry] [--census] [--routes routes-ad]`

Vocabulario CERRADO del pasillo 3D (eco del port ⇄ tecla), casado por distancia de edición sobre
alfabeto plegado y con MARGEN sobre el segundo candidato: `Advance`↑ · `Back up`↓ · `Turn left`← ·
`Turn right`→ · `Turn around.`Enter · `Klimb-Up!/Down!`k(+u/d) · `Search...`s(+Dir) ·
`Look...`l(+Dir) · `Ignite torch!`i · `Pass`Space. Conservador: sin dirección legible del prompt
«Dir-» no se conduce; la GEMA no se conduce (ruling: 3e); todo lo que queda cerrado lleva RAZÓN.

Runtime (`runner.ts`): teclas reales, sub-prompts resueltos MIRANDO `inputSinks` (no contando
teclas), costura de mazmorra por `setDungeonPos` (cero-rand; `goToLocation` no sirve para 33..40),
**ancla de PLANTA** por conteo de los Klimb del LP con resync sólo en el Klimb (que conserva la
celda), y **errante CONGELADO** por instrumento de arnés (`type=0xFF`, cero-rand, re-aplicado tras
cada op porque el core lo re-arma) — DECLARADO y CONTADO en cada segmento.

### Tres roturas de INSTRUMENTO que hubo que cerrar antes de creerse un número

Las tres se detectaron mirando el TRANSCRIPT DEL PORT (no el porcentaje): si el port dice
«Slow progress!» dentro de un supuesto pasillo, la medición no vale nada.

1. **La costura no disparaba** en los segmentos con `enter.loc:null` (banner corrupto) → el runner
   pulsaba las teclas del pasillo **sobre el overworld** (ad23: «North / Blocked! / East / Slow
   progress! / Search-East»). Fix: `resolveSegmentDungeon` (banner precedente → única-mazmorra-de-
   la-ruta → NO ABRIR) + guarda de runtime que no ejecuta un op `dng` fuera del 3D.
2. **Las `nav`/`key` viejas del material de SALA seguían conduciéndose** dentro del 3D, donde una
   flecha no es un paso al este sino `Advance`/`Turn`: sacaron a la party de la mazmorra (ad15:
   «Klimb-U/D- / Up! / Exit to Britannia!»). Fix: en un interior abierto SÓLO se conducen las ops
   `{dng}`; el resto se cuenta como `salaOpsSkipped`.
3. **La clasificación pasillo/sala no era idempotente** (tras convertir, los `todo` desaparecían y
   navHits se hundía) → tres pasillos ya abiertos se re-cerraban solos. Fix: clasificar leyendo
   también `op.from`.

**Limitación DECLARADA de 3b (`floorUnknown`)**: la costura entra por la CIMA (la única celda de
entrada conocida), pero un segmento del MEDIO de una visita empieza en una planta interior. Un
`Klimb-Up!` del LP en la cima SALE a Britannia — el propio eco del LP falsifica la planta supuesta,
y la planta real no es derivable hoy (el conteo de Klimb desde la entrada cruzaría los
`post-combat` que 3d aún no abre). No se inventa profundidad: se deja de conducir y se cuenta.

### Dos métricas, nunca fusionadas (ruling)

`conformidad-smallmap` (sin interiores) y `conformidad-interiores` salen como DOS líneas en
`summarize` y como `report.interior` en el JSON. Dentro de un interior abierto, los bloques con
firma de COMBATE DE SALA se retiran del denominador como `sala-diferida` (no-comparable
DECLARADO): su RNG se calibra en 3c y mezclarlo hundiría el número por instrumento.

`U5_ESPEJO_NO_EXPORT=1` = run de MEDICIÓN AISLADA que no reescribe el checkpoint (medir una parte
del medio de la cadena rompería la contigüidad de los reportes de las siguientes).

### RESULTADO 3b (2026-07-25, `.espejo-3b/`, SOFT, 7/7 partes verdes)

9 interiores de PASILLO abiertos (ad10/ad12/ad15/ad16/ad17/ad18×2/ad23×2), medidos en runs
AISLADOS desde el checkpoint de su parte anterior:

| parte | conformidad-smallmap | conformidad-INTERIORES |
|---|---|---|
| ad10 | 9.0% (70/774) | **57.1%** (4/7) |
| ad12 | 14.7% (158/1073) | **66.7%** (2/3) |
| ad15 | 0.0% (0/2) | **35.7%** (20/56) |
| ad16 | 22.1% (46/208) | 23.7% (9/38) |
| ad17 | 13.7% (14/102) | 15.5% (36/232) |
| ad18 | 4.8% (10/207) | 10.1% (42/414) |
| ad23 | 2.2% (8/370) | **34.0%** (66/194) |
| **TOTAL** | **11.2%** (306/2736) | **19.0%** (179/944) |

**PUNTO DE CORTE SUPERADO: 19.0% > 11.2% (×1.70), y el interior gana en 7/7 partes.** El modelo
(pasillo relativo al facing + planta como ancla + errante congelado) SIRVE.

Instrumento declarado del lote: 308 ops de pasillo conducidas · errante congelado 7× · 519 ops 2D
de sala NO conducidas · 390 bloques `sala-diferida` retirados del denominador · planta 8✓/10↷/1?

Los 765 divergentes que quedan **son navegación real del port**, no silencio: en su punto el port
dice `Klimb-` ×112, `Blocked!` ×55, `Turn right` ×52, `Klimb-what?` ×17, `Advance` ×16,
`Search...` ×18, `You find:` ×19, `Falling...`+`...splat!` ×19. La firma dominante es DERIVA DE
CELDA (`Blocked!` donde el LP pasó, `Klimb-what?` donde el LP subió = la party no está sobre la
escalera) — exactamente lo que el diseño predijo que la planta NO puede corregir. Y 20 son
`None owned!` del Ignite: la party de la cadena no lleva antorchas (deriva de estado, instrumento).

## FASE 3c — RNG DE COMBATE RECALIBRADO PARA AD (relevo-5)

El comparador traía los patrones de combate escritos con la ortografía del OCR de aulddragon.
El OCR de Diener escribe **lo mismo distinto**, así que miles de bloques que el port SÍ emite
caían como divergentes por caligrafía. `AD_COMBAT_RNG` (en `ocr-profile.ts`, sobre `probeFold`)
es la RE-ESCRITURA de los patrones que `RNG_AUTO` ya tiene para LP1 — banner de roster, aim,
tiradas, desenlace, jugador activo, huida. **No se declara no-comparable ninguna clase nueva.**

- `probeFold` pliega además **a↔u** (la confusión dominante de AD): las 4 variantes
  `Attack-Alm!`/`Attuck-`/`Attuok-`/`Attaok-` caen en UNA forma canónica. Es seguro porque sólo
  declasifica; en el CASADO ese plegado inventaría matches, y por eso no entra en `glyphClasses`.
- **Cola de armas huérfana** (`isRosterTail`): el OCR parte «Iolo, armed with Halberd:» en dos y
  la segunda mitad no lleva nombre ni `armed` («with Halberd:» ×347). Vocabulario CERRADO del
  port (`InventoryDetails.json` → `Armament`, el mismo origen que imprime el banner) y BLOQUE
  ENTERO: un «Search-East Sword:» sigue divergente (arrastra material comparable).
- El ancla del roster es la **COMA**, no la palabra `armed` desnuda: así quedan fuera los dos
  únicos usos no-combate del corpus (discurso del santuario `game.ts:3963` y el acertijo del
  Shadowlord). Y se cae el `battie` DESNUDO de LP1, que en AD barría «that battle-worn shield»
  de un regateo de tienda.

**El reconocedor va en la ÚLTIMA posición del diff, a propósito.** Puesto arriba (1ª versión) se
comía 138 bloques que SÍ casaban: retiraba conformidad REAL. En la última posición sólo puede
convertir DIVERGENTE → no-comparable, así que es **monótono sobre `matched`** y no puede
fabricar ni ocultar conformidad. Es más conservador que la doctrina histórica de LP1 (que
declasifica ANTES de casar), deliberadamente. Blindado por unit test.

### Las DOS métricas (siguen SEPARADAS — el ruling sigue vigente)

`conformidad-smallmap`, 25 partes, transcript CONGELADO de relevo-3b (`tools/calib-offline.ts
--dir .espejo-r3b --driven-only`), perfil `ad-pre3c` vs `ad` — **contabilidad cerrada**:

| | ANTES (ad-3b) | DESPUÉS (ad-3c) | |
|---|---|---|---|
| conformidad | 7.3% | **10.0%** | |
| matcheados | 1862 | **1862** | ← IDÉNTICO: el numerador no se toca |
| divergentes | 23 784 | 16 718 | −7066 = exactamente `combate` |
| comparables | 25 646 | 18 580 | |
| ghost/garbage/pending/rng/overlay/known-gap/covered/sala | — | TODOS idénticos | |

`conformidad-INTERIORES`, medida en vivo (4 partes SOFT aisladas, `.espejo-3c/`), con la
**descomposición** que exige el carril (`tools/calib-interior.ts`):

| | conf | matcheados/comparables | |
|---|---|---|---|
| 3b: pasillos, perfil 3b | 15.5% | 36/232 | línea base |
| + **(b) patrones retirados** | 21.4% | 36/**168** | comparables −64, matcheados **36→36** |
| **(a) material NUEVO (3c)** | 19.2% | 24/125 | 3 segmentos mixtos que 3b no medía |
| **TOTAL interior 3c** | **20.5%** | **60/293** | |

Lo que hace el número honesto: **el denominador CRECE** (232→293, +26%) mientras la conformidad
sube. No es conformidad comprada encogiendo el denominador — hay 61 comparables y 24 matcheados
MÁS que antes no se medían en absoluto.

### El material MIXTO se ABRE (9 → 17 interiores)

Con el combate calibrado, la razón por la que 3b cerraba un segmento con firma de sala dominante
desaparece. `classifyDungeonSegment` gana la clase `mixed` (nav≥3 Y sala≥3), que sí se abre;
`room-combat` queda para la sala PURA (nav<3), donde no hay pasillo que conducir. La FASE que
abrió cada interior viaja en la ruta (`openedBy: "3b"|"3c"`), y eso es lo que hace **automática**
la descomposición de arriba. Los 6 que siguen cerrados llevan su razón EXACTA.

### Un INTERIOR FALSO cazado por el propio instrumento

`ad20-g17` se abrió con `enter.loc: 23` = **COVE, un pueblo**. El guard de runtime de 3b lo cazó
y lo DECLARÓ («INTERIOR-SIN-MAZMORRA … la costura no dejó a la party dentro del 3D»), así que no
condujo teclas de pasillo por el overworld — pero el segmento entraba en la métrica con 28
comparables NO conducibles, todos divergentes. `isDungeonLoc` (33..40 = 0x21..0x28, el rango del
despachador del original SJOG.OVL 0x137a) cierra ése y `ad11-g06`.

### NO-REGRESIÓN DE LP1 — verificada EN VIVO, no supuesta

`LP1_PROFILE` es la identidad por construcción (`combatRng: []`, `detectRosterTail: false`,
`combatOverridesCuratedClass: false`, `detectAdPending: false`) y hay unit tests que lo blindan.
Pero los cambios viven en `diffSegment`, que LP1 también atraviesa, así que se re-corrieron las
dos partes que llevan los deltas anclados verdes (`.espejo-3c-lp1/`, SOFT, aisladas):

| | relevo-3b | 3c ahora | delta anclado |
|---|---|---|---|
| part04 (venta helm Gwenneth) | 97/379, MISS 0 | **97/379**, MISS 0 | **+36 = +36 ✓ EXACTO** |
| part05 (guild New Magincia) | 38/316, MISS 0 | **38/316**, MISS 0 | **−954 = −954 ✓ EXACTO** |

Matcheados, comparables y MISS **byte-idénticos**, y los dos deltas siguen disparando exactos.

### DEUDA DECLARADA (para el lead, no tapada)

`sala-diferida` sigue clasificando **antes** de intentar casar, así que —a diferencia de los
patrones de 3c— sí puede retirar matches (208 bloques en el lote medido). Unificarla con el
reconocedor calibrado es la limpieza que queda. Y LP1 arrastra la misma contradicción `exact`
que 3c resolvió en AD (105 bloques `VICTORY!`/`BATTLE IS LOST!` marcados `exact` por
`segment.mjs` como línea de corte, no por ruling): se deja INTACTA a propósito.

## FASE 3d — LOS 209 `post-combat` SE ABREN (relevo-6)

`post-combat` no es «después del combate»: es **el interior de la mazmorra tras un combate de
sala**, y son el 85% del material atrapado del censo. 3c los dejó listos para abrirse con **dos
deberes previos declarados**. Los dos están cerrados, y ninguno era cosmético.

### Deber 1 — `sala-diferida` ya NO puede retirar matches

Hasta 3c, `sala-diferida` clasificaba en la **primera** posición del diff: retiraba del
denominador de interiores todo bloque con firma de combate de sala **antes de comprobar si el
port lo había dicho**. A diferencia de los patrones de 3c —que van en la última posición justo
para ser monótonos sobre `matched`— podía borrar conformidad REAL. Abrir los post-combat, que son
sala + pasillo MEZCLADOS, habría multiplicado esa asimetría y dejado el número global ilegible.

Movida a la **última** posición, detrás de match/covered/fuzzy y detrás de `combat-rng`, sólo
puede convertir DIVERGENTE → no-comparable. Va después de `combat-rng` a propósito: el
reconocedor calibrado por corpus (derivado del vocabulario del propio port) tiene prioridad de
atribución y `sala-diferida` queda como la red agnóstica de corpus.

**Medido** (`tools/calib-sala.ts`: dos pasadas de `diffSegment` sobre el MISMO transcript
congelado, con perfiles que difieren en UNA palanca — `ad-pre3d` reproduce la línea base):

| lote | matcheados | sala retirada | conformidad |
|---|---|---|---|
| `.espejo-3c` (4 partes) | 60 → **61** (+1) | 208 → **0** | 20.5% → 20.7% |
| `.espejo-r3b` (25 partes) | 76 → **76** (+0) | 741 → **7** | 9.7% → 9.7% |

El número apenas se mueve, y el DESTINO de los 949 bloques dice por qué: **680 los reconocía ya
el `RNG_AUTO` histórico y 257 el `combat-rng` de 3c** — `sala-diferida` era casi enteramente
REDUNDANTE con lo ya calibrado. Lo que no era redundante es lo que hacía de más: **1 match REAL**
(«VICT0RY!», ad24-g05 ocr:1000), un bloque que el port SÍ emitió y que la posición vieja tiraba
sin mirar el transcript. La red se conserva porque **no es del todo redundante**: 7 bloques de
741 siguen necesitándola (firmas de daño sueltas, «Dragon llghtly», «Entering room..» a media
línea). Blindado por 6 unit tests, incluida la monotonía sobre 4 transcripts distintos.

### Deber 2 — `post-combat` tiene su propia resolución de mazmorra, y su costura NO teletransporta

Un `post-combat` llega **sin `enter`**: el segmentador cortó por el `VICTORY!`, no por un banner.
Y a diferencia de un `ctx:"dungeon"`, **no afirma que la party esté dentro** — los hay tras un
encuentro del OVERWORLD. El retroceso ingenuo de `resolveSegmentDungeon` les pondría igualmente
el id de la mazmorra que la party visitó 20 segmentos antes: abrirlos así repetiría la rotura nº1
de 3b (teclas de pasillo sobre el mapa grande) ×209.

`resolveDungeonForPostCombat` = **retroceso ESTRICTO**: para en cuanto un segmento declara que la
party salió (`leavesDungeon`: costura al overworld, santuario, o banner de otra location, legible
o corrupto), y **no tiene el atajo «única mazmorra de la ruta»**. Descarta exactamente 1 de los 73
candidatos con material suficiente (ad18-g04, que el ingenuo abría por ese atajo). Controles:
ad17-g15 (tras salida) → NULL · ad17-g17 → DECEIT por la **re-entrada** g16, no por la visita g13
· ad12-g22 (overworld) → NULL.

**La costura es `carryover`, no teletransporte.** La costura de 3b sabe fijar UNA celda: la de
entrada de la mazmorra. A mitad de visita el LP no está ahí, así que usarla sería FABRICAR
posición (la celda real no es derivable hoy — §9 del diseño). El runner sólo **comprueba** que la
party siga dentro de ESA mazmorra: si sí, lee la planta viva y congela el errante; si no, DECLARA
y no conduce una sola tecla.

**Idempotencia** (la familia que ya mordió en 3a): la costura sintética es un valor DERIVADO, así
que los dos resolutores la atraviesan como transparente en vez de aceptarla como evidencia. Sin
eso, la 2ª corrida resolvía cada post-combat contra el `enter` que la 1ª puso al anterior y abría
3 segmentos de LP1 que la 1ª dejó cerrados — apertura circular. Verificado: 2ª corrida = diff vacío.

### Material ABIERTO

| corpus | segmentos | bloques `expect` | ops de pasillo |
|---|---|---|---|
| AD (17 → **89** interiores) | **72** post-combat | **7 465** | 809 |
| LP1 | 20 (17 post-combat + 3 `ctx:dungeon` pendientes de 3c) | — | — |

Los 20 de LP1 viven TODOS en part16-22 = **inalcanzables esta encarnación** (la cadena sólo tiene
checkpoints hasta part06): 0 efecto medible hoy, se dejan abiertos para quien herede la cadena.
Frente a los 293 comparables que medía 3c, los 7 465 bloques de AD son el salto de escala que
justificaba la fase.

### La trampa del transcript congelado (cazada al medir)

`calib-interior.ts` descompone ahora por FASE (`openedBy`) automáticamente — pero el transcript
congelado **trae líneas también de los segmentos que aquel run SALTÓ**: la rama `skip` del runner
pulsa las `nav` del guion y captura la consola igual, así que un post-combat saltado deja 31
líneas de «Turn left / Advance / Blocked!». Son ecos REALES del port, pero producidos por flechas
2D reinterpretadas dentro del 3D (la rotura nº2 de 3b), **no** por las ops `{dng}`. Puntuar el
material de 3d contra ese transcript da 16.1% con pinta de ser la medida de 3d. **No lo es.**

El banco lo separa leyendo el `report.json` del MISMO run (`interior:true` = conducido de verdad)
y etiqueta el resto como **LÍNEA BASE «sin conducir»**, que es justo el control que hace falta:

| lote | fase | sin conducir | ya conducido |
|---|---|---|---|
| `.espejo-r3b` | **3d** | **8.4%** (205/2433) | — (pendiente de ventana) |
| `.espejo-3c` | **3d** | **16.1%** (178/1106) | — (pendiente de ventana) |

**⚠ El listón está PRE-REGISTRADO en `PREDICCION-3d.md`, escrito antes de tener la ventana**, y
ahí se corrige un número de esta misma nota: dije «conducir vale ~×2» comparando 9.2%→21.4%, pero
**esa comparación no era de los mismos segmentos** (8 segmentos contra 1). El factor PAREADO —
mismos segmentos, sin conducir vs conducidos— es **×1.74** (35/293 → 61/294), con n=4 y con **uno
de los cuatro EMPEORANDO** al conducirlo (ad17-g13: 15.6% → 6.7%).

Y hay un aviso mayor: los MISMOS 8 segmentos de 3d de ad17 sin conducir dan **6.1%** en
`.espejo-r3b` y **12.3%** en `.espejo-3c` — mismo denominador (538), numerador ×2, sólo cambia el
estado de la cadena. **La línea base tiene más varianza run-a-run que el efecto que se busca**, así
que el porcentaje por sí solo no puede sostener la conclusión: los discriminadores que sí valen
(denominador plano, tasa de costura declinada, ausencia de vocabulario 2D en el transcript) están
en el §3 del pre-registro.

### NO-REGRESIÓN DE LP1 — verificada offline, no supuesta

Los tres bancos (`calib-offline` / `calib-interior` / `calib-sala`) eligen ahora el corpus por el
PREFIJO de la parte (`adNN` → `routes-ad`, `partNN` → `routes`); antes sólo sabían leer AD y la
no-regresión de LP1 no se podía comprobar con el mismo instrumento. Con el perfil `lp1` sobre los
transcripts congelados de `.espejo-3c-lp1/`:

| | relevo-3b / 3c | 3d ahora |
|---|---|---|
| part04 (venta helm Gwenneth) | 97/379 | **97/379** |
| part05 (guild New Magincia) | 38/316 | **38/316** |

Byte-idénticos. Y `sala=0` en las dos: **ningún segmento de part01-06 es un interior abierto**, así
que la palanca del deber 1 es inerte ahí POR CONSTRUCCIÓN, no por suerte. Los 4 `openedBy` de LP1
(part16/17/20/22) más los 20 que abre 3d viven todos en part16-22, fuera del alcance de la cadena.

### Qué material queda dentro (censo del lote de 3d)

809 ops de pasillo derivadas, dominadas por navegación pura — que es exactamente el vocabulario
que 3b validó: `advance` 301 · `turnRight` 172 · `turnLeft` 159 · `klimb` 68 (36 down / 32 up) ·
`back` 26 · `pass` 23 · `search` 33 · `turnAround` 10 · `ignite` 9 · `look` 8.

### El contador de PLANTAS sigue SIN ser derivable — ahora medido, no supuesto

3b dejó el contador de plantas del LP (§6 del diseño) bloqueado «porque el conteo de Klimb desde
la entrada cruzaría los `post-combat` que 3d aún no abre». Con 3d abriéndolos, la pregunta se
puede MEDIR (`derive-dungeon-ops.mjs --all --visits`): el conteo sólo vale si NINGÚN segmento de
la visita queda cerrado, porque un hueco se traga los Klimb que contiene.

**De las 22 visitas a mazmorra de AD, sólo 4 tienen la cadena COMPLETA** (ad17-g13, ad18-g10,
ad18-g12, ad23-g02 — y las cuatro son visitas de UN solo segmento). Las 18 restantes siguen
teniendo huecos: ad24-g05 es 16 abiertos / 10 cerrados, ad25-g02 es 8/16, ad15-g02 es 7/5. Así
que **la profundidad absoluta sigue sin derivarse y no se inventa**: la costura `carryover` toma
la planta VIVA del port como esperada y a partir de ahí sí comprueba la secuencia RELATIVA de
Klimb del LP — la misma lógica relativa-al-facing que hace funcionar el vocabulario del pasillo.
Lo que 3d NO afirma es la planta absoluta, y queda declarado.

### Lo que 3d deja para 3e — y una corrección al plan del diseño

Censo del material de 3e sobre el corpus AD, ahora que 3d abrió los post-combat:

| material de 3e | en interiores ABIERTOS | en cerrados | total |
|---|---|---|---|
| beats de GEMA (`View a gem!`) | **116** | 184 | 300 |
| `Attacked from the <dir>!` (oráculo de FACING) | **5** | 5 | **10** |

**La gema pasa a ser conducible en masa**: 116 beats caen ya dentro de segmentos que el runner
conduce (antes de 3d eran ~34). Sigue `pending` por ruling, y es el ancla más fuerte y más barata
que hay dentro (una tecla, y devuelve planta + celda + revelados de golpe).

**⚠ Corrección al plan de 3e del diseño (§4/§5).** El diseño apoya la opción B —errante VIVO con
re-anclaje del facing después de cada emboscada— en que «Attacked from the west!» es un oráculo
de facing. Lo es, pero ahora está CONTADO: **10 beats en las 25 partes**, 5 de ellos en material
abierto. A esa densidad no hay red de seguridad: el facing se desincroniza por una vía que el
replay no controla (el errante es RNG, así que las emboscadas del port ni siquiera coinciden con
las del LP) y el corpus no ofrece con qué re-anclarlo. Recomendación del carril: **3e empieza por
la GEMA, no por soltar el errante**. La gema da el ancla absoluta que hoy falta; con ella dentro,
soltar el errante pasa a ser medible. Al revés, se repite el error del estreno — dos fuentes de
deriva a la vez y ningún modo de atribuir la culpa.

> ⚠ **La recomendación «3e = gema primero» de esta sección queda RETIRADA por el propio carril.**
> Al derivar 3e en firme (`DISENO-3e.md`) resultó que la gema **no lleva posición en el canal de
> texto**: el port sólo emite el eco (`View a gem!`, DS 0xa258) más un descriptor GRÁFICO, y la
> cadena que el diseño esperaba —«You are on level N»— **no existe en el corpus** (los 36 `level N`
> son texto de santuario: «Thou art now level 5, and wiser!»). Conté ecos de comando, no
> información de posición. El ancla que sí sirve es el **filtro de localización sobre `Blocked!`**
> (116 beats en abiertos, espacio de 256 estados por planta): medido, colapsa 256 → mediana 5 con
> 20 avances y **nunca pierde la celda verdadera**. Detalle, presupuesto por visita y pre-registro
> en `DISENO-3e.md`.

### ¿Se pueden FUSIONAR ya las dos métricas? — veredicto del carril: TODAVÍA NO, por otra razón

El ruling de 3b las separó «hasta que 3c cierre», y la razón era el RNG de combate sin calibrar.
**Esa razón ya no existe**: 3c calibró los patrones y el deber 1 de 3d quitó la última asimetría
que quedaba en el lado de la MEDICIÓN. Hoy un bloque de interior y uno de smallmap atraviesan
exactamente el mismo diff, con los mismos reconocedores y todos ellos monótonos sobre `matched`.
Por el argumento de simetría que el encargo pide, **el comparador ya es simétrico**.

Lo que NO es simétrico es el lado de la **CONDUCCIÓN**, y ahí está la razón que queda:

| | smallmap | interior |
|---|---|---|
| ops del guion que se conducen | TODAS | **sólo las `{dng}`**; las `nav`/`key` de sala se cuentan como `salaOpsSkipped` |
| ancla de posición | celda ABSOLUTA (ancla de cara, `resolveFaceAnchor`) | ninguna: la celda no es derivable |
| ancla de planta | n/a | **relativa**: la costura `carryover` toma la planta VIVA del port |
| errante | vivo | **CONGELADO** (instrumento declarado, ruling A) |

Fusionarlas hoy metería en un mismo número un denominador conducido ENTERO y otro conducido a
medias con el errante apagado. La conformidad global subiría o bajaría sin que se pudiera decir
cuál de las dos cosas la movió — que es exactamente el fallo que hizo ilegible el estreno de AD.

**Condición concreta para fusionar — CORREGIDA en `DISENO-3e.md` §3: NO basta con 3e.** La
asimetría nº1 (dentro de un interior sólo se conducen las ops `{dng}`; el material de SALA no se
conduce) **no la toca ninguna palanca de 3e** — ni la gema, ni el filtro, ni soltar el errante.
Fusionar exige además conducir el combate de SALA dentro del interior, que es una fase aparte
(3f). Lo que sigue describe lo que 3e sí cierra (asimetrías 2, 3 y 4):

**Condición original (insuficiente): cuando 3e cierre.** 3e (errante vivo + gema como ancla) es
justo lo que borra las cuatro filas de la tabla: suelta el errante, y la gema da planta + celda
+ revelados de una vez, o sea el ancla ABSOLUTA que hoy falta dentro. En ese momento el interior
pasa a ser un replay conducido entero y anclado como el smallmap, y la simetría es de las dos
mitades, no sólo del comparador. Antes de eso, fusionar sería comprar un número.

## Tickets Fase B abiertos

- **T-JOIN-REAL** — «join por Talk real con resync-a-NPC». El op `{recruit:name}` es
  ARNÉS INTERINO (ratificado por el lead): llama a core `joinByName` vía `__u5test.join`
  (no replica; contrato blindado por unit test) para mantener el ledger de party fiel
  (3→5) que gatea part03+. PERO el join es un flujo de CORE del LP y no puede quedar sin
  ejercitar para siempre: los beats de conversación del OCR (typed `:YES`, diálogo del NPC)
  SIGUEN en la ruta y se cuentan (no barridos). En una ventana futura: resync de posición
  al NPC (localizar su celda) antes del Talk direccional, y sólo si no se le encuentra,
  fallback a `{recruit}`. Beats: part02-g09 (Jaana, Yew) + part02-g17 (Julia, Empath Abbey).
- **T-PRESENTACION-SPOTCHECK** — validar la categoría `[presentacion]` contra el port real:
  10 bloques (Z-stats/`Player:`/eco-input-parcial) → screenshot del port en su beat; port lo
  pinta → no-comparable legítimo; port NO lo pinta → ticket de presentación. Reportar ratio.
- **T-CHANNEL-REMEASURE** — re-run SOFT 01-06 con el diff consciente de canal para medir la
  conformidad real (estimado offline: −17% divergentes firme + hasta −29% por strip de eco).
