# Grand Tour — plantilla de capítulo

El Grand Tour recorre el walkthrough completo de Ultima V como una cadena de capítulos.
Cada capítulo `chNN`:

1. **arranca** del checkpoint nativo del capítulo anterior (`saves/ch<NN-1>.{gam,sidecar.json}`),
2. **juega** su tramo de forma **determinista** (respuestas fijas, `seed 0`),
3. **assert**a el estado resultante contra el binario de 1988 (offsets del `.GAM`),
4. **exporta** su propio checkpoint (`saves/chNN.{gam,sidecar.json}`) por el camino REAL del
   jugador (botón "Export .GAM"), que es a la vez la entrada del siguiente capítulo Y la
   entrada del espejo por estado,
5. **declara** qué ítems del manifiesto (`manifest.json`, 742) cubre → `covered.chNN.json`.

`ch01` es el patrón de referencia (creación por la gitana). Tras F3-T3 la infraestructura
está endurecida para que **ch02+ se escriba SOLO con datos** (el walkthrough del corpus), sin
tocar `main.ts`, `package.json`, ni los offsets.

## Piezas de infraestructura (compartidas, NO se tocan por capítulo)

| Fichero | Rol |
|---|---|
| `fixture.ts` | `importCheckpoint(page, chapter)` (entrada) / `exportCheckpoint(page, chapter)` (salida). El export usa el botón real "Export .GAM"; la importación pasa el **sidecar** al hook nativo. |
| `nav.ts` | **Motor de navegación reutilizable** de small-maps: `enterLocation`, `walkTo` (BFS adaptativo sobre el mapa vivo, abre puertas regulares, re-rutea ante NPC deambulantes), `faceCommand` ((L)ook/(S)earch/(T)alk direccional), `talkToNpc`, `readSign`, `climbLadder`. Todo por teclas/comandos REALES. |
| `npcIds.ts` | `npcManifestId(cat, npcIndex)` → id del manifiesto para un NPC (ver §"NPC → id"). |
| `offsets.ts` | **Fuente única** del layout del `SAVED.GAM` (`charFieldOff`, `PARTY`, `SAVED_GAM_SIZE`), alineada con `game/src/core/saveNative.ts`. Los asserts de offsets de TODOS los capítulos salen de aquí. |
| `coverage.ts` | `new Coverage(chapter).mark(id)…write()`. `mark` **lanza** si el id no existe en `manifest.json` (guarda anti-fabricación). |
| `mirror.py` | Espejo por estado del capítulo. Orquesta `re/tools/mirror_runner.py` (F3-T2); no duplica lógica del oráculo. |
| `manifest.json` / `corpus.json` | Contenido enumerable (F3-T1) y hechos verificados. Generados de datos con guarda CI (`npm run tour:manifest`, `npm run verify:corpus`). |
| `playwright.grandtour.config.ts` | Config dedicada, puerto propio **5219** (`--strictPort`), `testMatch: /chNN-*/`. Corre en paralelo sin chocar con `:5199`. |

## Escribir un capítulo nuevo (ch02+)

Copiar `ch01-creation.spec.ts` como `chNN-<slug>.spec.ts` y rellenar SÓLO datos:

```ts
import { test, expect } from "@playwright/test";
import { importCheckpoint, exportCheckpoint } from "./fixture";
import { enterLocation, faceCommand, talkToNpc, climbLadder } from "./nav";
import { npcManifestId } from "./npcIds";
import { charFieldOff, PARTY } from "./offsets";
import { Coverage } from "./coverage";

test.describe.serial("GT chNN — <tramo>", () => {
  test("<juega el tramo y asserta el checkpoint>", async ({ page }) => {
    // Arranca la piel FIEL (el default de `bootPlan`; la piel dev está jubilada).
    // 1) ENTRADA: arranca del checkpoint anterior (hidrata .GAM + sidecar).
    await importCheckpoint(page, "ch<NN-1>");
    const cov = new Coverage("chNN");

    // 2) POSICIONAMIENTO de arnés + (E)nter REAL, luego JUEGO real y determinista (seed 0)
    //    con el motor de nav: walkTo/faceCommand/talkToNpc/climbLadder. Ej. (ver ch02):
    await enterLocation(page, <locId>);
    await talkToNpc(page, <dialogNumber>);
    cov.mark(npcManifestId("castle", <dialogNumber>));
    await faceCommand(page, "s", <x>, <y>);   // (S)earch un objeto → cov.mark("search-…")

    // 3) ASSERTS contra el binario: estado vivo + BYTES del .GAM (offsets compartidos).
    //    expect(gam[charFieldOff(0, "strength")]).toBe(…);
    //    expect(gam[PARTY.karma]).toBe(…);

    // 4) SALIDA: exporta el checkpoint de este capítulo (entrada de ch<NN+1>).
    cov.write();
    const { gam } = await exportCheckpoint(page, "chNN");
    // … asserts byte-exactos sobre `gam` …
  });

  test("declara la cobertura del manifiesto", () => {
    const cov = new Coverage("chNN");
    cov.markAll(["location-…", "npc-…", "spell-…"]); // ids REALES del manifiesto (o lanza)
    cov.note("qué cubre / qué queda fuera y por qué");
    cov.write();
  });
});
```

### Estado que viaja en el checkpoint

- El **`.GAM`** captura la ventana `SAVED.GAM` de 1988 (roster, karma, posición, bitmaps de
  santuario…). Los offsets están en `offsets.ts`.
- El **sidecar** captura el estado de juego SIN hueco en el `.GAM` (transporte, `questFlags`,
  estado naval, Shadowlords, hechizos temporales; ver `SaveSidecar` en `saveNative.ts`).
  `importCheckpoint` lo **pasa** al hook `loadNativeSave`, así que ch02+ hidrata ese estado
  al encadenar — **no** hay que tocar `main.ts` para un capítulo con estado runtime.

## Modelo de alcanzabilidad (posicionamiento de arnés)

Cada capítulo llega a su localización con la **costura cero-rand SANCIONADA** del menú
debug (`__u5debug.teleportOverworld(x,y)` — escritura DIRECTA de posición, cero stream, la
misma receta del deep-link de dev). `enterLocation(page, id)` la usa para dejar la party en
el tile-overworld de la localización y luego ENTRA por el `game.enter()` REAL.

**Este posicionamiento inter-capítulo es una operación de ARNÉS declarada, NO gameplay.** Lo
que lo hace legítimo para el espejo es que el ESTADO ENCADENADO (roster/karma/trama, byte-real
del checkpoint del capítulo anterior) SÍ viaja; el fast-travel sólo mueve el cursor de
posición. **TODO lo demás del capítulo pasa por mecanismos REALES del binario**: `enter()`
auténtico, movimiento con flechas, (O)pen/(L)ook/(S)earch/(T)alk, (K)limb, diálogos y compras
reales. (Modelo (C), aprobado; (B) deep-link-por-capítulo queda descartado porque rompería la
cadena de save.)

### Capítulos de TRAVESÍA (cobertura del viaje)

El posicionamiento de arnés se salta DELIBERADAMENTE el viaje físico. Esa cobertura NO se
pierde: es materia de **capítulos de travesía DEDICADOS** cuyo contenido ES el viaje, jugado
de forma real y guionizada bajo seed-0 (con sus combates a puntos fijos):

- **Travesía terrestre** (overworld-walking): pisar el mapa 256×256, `map-overworld`,
  spawns/encuentros errantes deterministas, "Slow progress!"/terreno, **camping** en ruta.
- **Moongates** como transporte (fases lunares) — `moongate-phase-*`.
- **Travesía naval**: skiff/fragata, viento, atraque, `map-underworld` bajo Destard.

Así la fragilidad de guionizar combates queda CONTENIDA en unos pocos capítulos en vez de
contaminar los 18, y el manifiesto no pierde esos ítems (overworld/underworld, moongates,
enemigos errantes) — se marcan al jugar esas travesías.

## NPC → id del manifiesto

El manifiesto ata cada NPC conversable como `npc-<cat>-<npcIndex>-<slug(nombre)>` (categoría
del `.TLK`: towne/castle/dwelling/keep). El NPC VIVO lleva su `dialogNumber` = índice de su
registro TLK; en las localizaciones de tipo **castillo** ese índice COINCIDE con el `npcIndex`
del manifiesto (verificado). `npcManifestId(cat, npcIndex)` (en `npcIds.ts`) hace el puente
leyendo `assets/talk/<cat>.json`; `talkToNpc(page, dialogNumber)` localiza al NPC vivo (que
DEAMBULA), se le acerca, habla y cierra con "bye". Un capítulo marca cobertura de NPC así:

```ts
await talkToNpc(page, dn);          // dn = dialogNumber del NPC vivo
cov.mark(npcManifestId("castle", dn));
```

## Desarrollo PARALELO de capítulos (protocolo de RE-ENCADENADO)

Varios carriles escriben capítulos a la vez. La cadena de checkpoints es SECUENCIAL
(chNN importa `ch<NN-1>.gam`), pero el DESARROLLO puede paralelizarse:

1. **Base provisional declarada.** Un carril que aún no tiene el checkpoint real de su
   predecesor desarrolla contra el ÚLTIMO checkpoint APROBADO (hoy `ch02.gam`) como BASE
   PROVISIONAL — se declara en el encabezado de la spec (`importCheckpoint(page, "chXX")`
   con un comentario "// base provisional hasta que chYY aterrice").
2. **Re-encadenado antes del merge.** Cuando el predecesor aterriza, el carril cambia el
   `importCheckpoint` al checkpoint REAL, RE-CORRE su spec (regenera su `.gam`/sidecar/
   cobertura) y confirma determinismo ×3. Como todo es determinista, re-encadenar es
   BARATO: cambiar un id + re-correr.
3. **Orden de aterrizaje.** Lo secuencia el lead: ch03 → ch04 → ch05 …, cada uno
   re-encadenado sobre el checkpoint real de su predecesor ANTES de su merge.
4. **Sin solapamiento de contenido.** Cada carril cubre una localización/cluster distinto
   (el pattern-owner reparte con `manifest.json` + `corpus.json`). Evita localizaciones que
   exijan estado que la cadena aún no produjo (p.ej. puertas con llave) hasta el capítulo
   que gana esa llave.
5. **Infra compartida (`nav.ts`/`npcIds.ts`/`offsets.ts`).** Vive en la rama del
   pattern-owner. Un carril que forkea de `main` tiene la versión ya aterrizada; al
   rebasar tras un merge del owner hereda las mejoras (BFS, tienda, floor-aware, etc.).
   Preguntas de patrón (nav/npcIds/mark) → al pattern-owner; de alcance → al lead.

## Política de COBERTURA (pattern-owner)

1. **Honesto > cantidad.** NO hay assert duro de `≥15`. Cada capítulo marca TODO lo que
   cubre DE VERDAD y documenta el conteo con `cov.note(...)`. Un pueblo pequeño (Trinsic)
   rinde ~10-13 ítems y está bien. El invariante es que el conteo sea **DETERMINISTA**
   (byte-idéntico ×3), no un número fijo. Marca SÓLO lo que ejercitas: si una casilla queda
   tras puerta con llave o un lado de señal es inalcanzable, envuélvelo en try/catch y márcalo
   sólo si se alcanza (subconjunto determinista bajo seed-0).
2. **Comandos A-Z ejecutados = cobertura.** El manifiesto tiene `command-a..z` (26). Un
   capítulo que pulsa REALMENTE (E)nter/(T)alk/(S)earch/(L)ook/(K)limb/(O)pen marca
   `command-e/t/s/l/k/o` — es contenido EJERCITADO jugando, no fabricado. El cierre de ch19
   los une; marcarlos por capítulo es legítimo porque cada uno los ejecuta de veras.
   ```ts
   cov.markAll(["command-e", "command-t", "command-s", "command-l", "command-k"]);
   ```
3. **Words of Power por diálogo REAL.** Marca `word-<slug>` (p.ej. `word-avidus`) SÓLO
   cuando el NPC teacher lo DIGA en la conversación (verifica el corpus). Helper compartido
   `talkToNpcAsking(page, dn, keyword)` en `nav.ts`.

## FRANJA HORARIA del mercader = PRECONDICIÓN de todo capítulo con COMPRA/VENTA

Los NPC tienen **horario** (schedule por franja: planta+posición+aiType por tramo, en
`npcs.json`). Un mercader (dialog 0x81-0x88) sólo es enganchable **en su franja de tienda**:
fuera de ella se muda a otra planta/posición (p.ej. el herrero de Britain, dn 129, sube a z1
a las 17:00; times `[17,6,11,13]`) y `buyFromShop`/`sellFromShop` no lo alcanzan. Regla:

1. Antes de escribir una compra, **lee el schedule del mercader** en `npcs.json[loc]` y
   determina su FRANJA de tienda (planta baja, estacionario/atendible).
2. Comprueba la HORA DE ENTRADA del capítulo (la hereda del checkpoint del anterior — y
   **cambia cuando ese capítulo se re-sella**, porque su reloj de SALIDA se corre). No la des
   por fija entre olas de re-sello.
3. Si la entrada NO cae en la franja, AJUSTA el reloj por mecanismos reales: **compra
   PRIMERO** (antes de los diálogos, que queman turnos), o avanza turnos deliberados
   (pass/search) hasta la franja. Documéntalo en la economía del capítulo (turnos quemados =
   reloj de salida distinto → los capítulos siguientes re-encadenan; para eso es la ola).
4. `buyFromShop`/`sellFromShop` PERSIGUEN al mercader deambulante (`pursueAndTalk` acotado)
   — robustez para "disponible pero móvil"; NO sustituye a acertar la franja (fuera de horario
   el mercader no está en la tienda, y la persecución agota su presupuesto).

> Precedente: el fallo del estreno era esta misma clase (NPC dormido a las 4:45 AM tras
> puerta cerrada). Franja horaria + estado de puerta son precondiciones, no detalles.

## HORA DE ENTRADA CANÓNICA POR CAPÍTULO (el reloj YA NO es presupuesto de cadena)

**Cura sistémica (task #8).** ANTES, la hora de SALIDA de un capítulo era la de ENTRADA del
siguiente, así que cada turno quemado (nav, persecución, jimmy con reintentos, treks) CORRÍA el
reloj y el corrimiento se PROPAGABA: un detour caro empujaba a los capítulos de aguas abajo a
**horario nocturno** (NPC dormidos en salas particionadas, mercaderes fuera del mostrador),
rompiendo sellos diurnos. Fue la TERCERA rotura por reloj de la ola (ch03 flake, ch04 Sindar,
ch04 señal) — el patrón, no un accidente.

**Ahora `importCheckpoint` fija una hora de ENTRADA CANÓNICA por capítulo** (`fixture.ts`,
`ImportOpts.entryClock`, default **10:00** diurno). Tras hidratar el checkpoint del predecesor,
el arnés **escribe `state.time` directamente** a la hora declarada. Consecuencias:

1. **La hora de salida ya no hipoteca al siguiente.** Cada capítulo entra a SU hora canónica sea
   cual sea la deriva del predecesor → los sellos dejan de invalidarse por cambios aguas arriba
   (un re-sello de ch02 ya no puede romper ch04). Resuelve task #8 de raíz.
2. **Solo importan las ventanas INTERNAS del propio capítulo.** Elige la hora canónica que hace
   válida la lógica del capítulo (mercader en mostrador, NPC alcanzable). Default 10:00 restaura
   las asunciones DIURNAS de los sellos existentes; un capítulo que NECESITE otra franja declara
   la suya (`importCheckpoint(page, "chNN", { entryClock: { hour, minute } })`). Ej.: ch03 declara
   16:24 (su compra-primero y sus ventanas de Annon/Gwenno están afinadas a esa tarde).
3. **NO es violación de fidelidad: arnés ≠ juego.** El reset de reloj es una normalización de
   ARNÉS, de la MISMA clase sancionada que `teleportOverworld` (posicionamiento inter-capítulo):
   escritura directa de estado test-only, cero efecto fuera del tour, el CORE del juego intacto.
   El `.gam` exportado sigue siendo nativo; la hora canónica usada se DOCUMENTA en el sello.
4. **Documenta la hora canónica de ENTRADA** de cada capítulo (en el commit / `cov.note`, junto a
   oro/karma/llaves). Sigue siendo buena práctica no malgastar reloj DENTRO del capítulo si una
   ventana interna aprieta, pero ya no es un recurso de cadena — es local.

> Precedente que forzó la cura: recuperar `search-31` en ch03 (una Box tras `LockedDoor`) costaba
> ~6.7h de reloj + 1 llave y empujaba ch04 a la madrugada; y aun difiriéndolo, la salida vespertina
> (22:59) seguía metiendo a ch04 en la noche (todos los mercaderes de Trinsic subidos a z1). La
> hora canónica lo desactiva de raíz sin recortar cobertura.

## TODA OPERACIÓN FLOOR-FIJA DECLARA Y NORMALIZA SU PLANTA ANTES

Una operación cuya casilla vive en una planta CONCRETA (leer una señal, (S)earch de un objeto
oculto, visitar una tienda) **declara y normaliza su planta ANTES de ejecutarse** — NUNCA asume
la planta en que la dejó el paso anterior. Un (T)alk previo puede haber ARRASTRADO a la party a
otra planta (un NPC que de noche está en su dormitorio de z1, el motor sigue al NPC arriba para
hablarle), y la siguiente operación floor-fija quedaría huérfana (la señal de z0 no se alcanza
desde z1 → falso negativo). Reglas:

1. Antes de un `readSign`/`faceCommand("s",...)` de una casilla de planta N, **normaliza a N**
   (`goToFloor(page, N)`, o `enterFloor1Room(lx,ly)` para z1 particionada) — explícito, no por
   suerte de que el paso anterior dejara la planta correcta.
2. La NAV de NPCs/tiendas debe ser **component-aware** (`goToCell`/`recoverPartition`): a la hora
   de entrada re-encadenada los NPC pueden estar en CUALQUIER planta/componente (de noche, en sus
   dormitorios de z1). El `goToFloor`+`walkTo` plano sólo alcanza la escalera más cercana → falla
   en plantas particionadas. Alinéate con ch05/06 (que ya lo hacen).

> Precedente (ola de re-sello ch04): con la entrada re-encadenada a las 22:59, TODOS los
> mercaderes de Trinsic se habían subido a z1; el talk de Sindar (z1 de noche) dejaba la party
> arriba y `readSign(15,28)` (z0) devolvía false. Fix: approachAndTalk/visitShop por `goToCell`
> component-aware + `goToFloor(0)` antes de la señal. Es la 2ª lección estructural de la ola.

## CRITERIO DE VALIDEZ DE UN RE-SELLO (no la byte-identidad histórica)

Un re-sello (regenerar el `.gam`/sidecar/cobertura de un capítulo) es VÁLIDO si:

1. **×2 byte-determinista**: dos corridas seguidas producen ficheros byte-idénticos entre sí.
2. **Cobertura idéntica o superior**, con los ids citados.
3. **Economía intacta** (oro/karma/llaves) — o el cambio EXPLICADO.
4. **Stats de roster idénticos** — o el cambio EXPLICADO.
5. **TODO diff de bytes contra el sello ANTERIOR queda EXPLICADO CAUSALMENTE** en el mensaje de
   commit (offset + campo + causa). Ej. precedente ch04 (7 bytes): día (baseline stale de la
   cadena vieja) + minuto/food/currentHp-regen/posición (Δturnos de la nav component-aware).

La **byte-identidad histórica** (hash idéntico al committed) SOLO se espera cuando el baseline NO
cambió (p.ej. ch02, cuyo predecesor ch01 es fijo). Cuando el baseline es OBSOLETO (sellado sobre
un predecesor que ya no existe — otra hora, otro día acumulado), perseguir su hash es fidelidad a
un fósil, no al contrato: se acepta el sello FRESCO con su diff explicado. La fuente de verdad del
contrato es la `entryClock` DECLARADA en el spec + las explicaciones del commit.

> Nota de trazabilidad: el `entryClock` NO se inyecta en el JSON del sidecar (lo consume el espejo
> y se hashea; no lo contaminamos). Vive en la DECLARACIÓN del spec (código commiteado) y se traza
> en `cov.note` + el mensaje de commit.

## Correr un capítulo

```bash
# genérico (recomendado):
npm run tour:spec   -- chNN     # solo la spec (puerto 5219; U5_TOUR_PORT lo cambia)
npm run tour:mirror -- chNN     # solo el espejo por estado
npm run tour        -- chNN     # spec + espejo

# alias de conveniencia (equivalen a lo anterior; existen para ch01 y ch02):
npm run tour:ch02
```

## MODO ES (`U5_TOUR_LANG=es`) — la capa de idioma es SÓLO presentación

El tour corre anclado a `lang=en` (el SUELO del calco: todos los sellos byte-idénticos salen
del binario 1988 EN INGLÉS, y contra ellos están ancladas todas las guardas). `U5_TOUR_LANG=es`
conmuta el run a español para PROBAR la TESIS de la capa i18n (analisis.md §6):

> **Jugar los capítulos en español debe producir LOS MISMOS SAVES BYTE-IDÉNTICOS que los
> sellos ingleses commiteados.** El idioma sólo transforma la SALIDA de consola (choke
> `coreview.pushConsole` → `t()`); NO muta estado de juego, NO se persiste (override efímero
> de URL `?lang=es`), y NO toca la mecánica de entrada.

```bash
U5_TOUR_LANG=es U5_TOUR_PORT=52xx npm run tour:spec -- chNN   # un capítulo en español
```

**Qué prueba EXACTAMENTE (la INVARIANTE ESTRELLA).** El modo es **NUNCA re-sella**: `fixture.ts`
fuerza VERIFY sea cual sea `U5_TOUR_WORKERS`. `exportCheckpoint` asevera que el `.GAM` jugado en
español es **byte-idéntico al sello INGLÉS** (`saves/chNN.gam`) y jamás toca disco. Un byte-diff
en modo es NO es un re-sello: significa que la capa de idioma FILTRÓ a estado de juego (debía ser
sólo presentación) → **es un bug de la tesis i18n**, y el error lo dice.

**KEYWORDS: se teclean EN INGLÉS en AMBOS modos (son mecánica, no presentación).** El matcher de
conversación es FIEL al binario DOS: casa la entrada tecleada como subcadena de las keywords del
`.TLK`, que son INGLESAS. El alias bilingüe (`keywords_es` por `qa`, analisis.md §3.1) que
permitiría teclear la palabra ESPAÑOLA está DISEÑADO pero **NO IMPLEMENTADO** (ni en los datos
`talk/*.json` ni en `conversation.ts`). Por eso el tour teclea las keywords IGUAL en `es` que en
`en` — teclear español hoy no casaría y perdería efectos de diálogo (karma/oro/join), rompiendo la
byte-identidad. Las palabras de poder y mantras (AHM, MALUM, BEH…) se teclean tal cual SIEMPRE.
Cuando el alias §3.1 aterrice, la variante se elegirá en `tourLang.ts::kw({en,es})` (hoy identidad)
sin tocar los specs. Ejemplo VIVO de la captura ES de Britain (Greyson):

```
Hablar-                         ← "Talk-" (traducido)
You see a noble fighting bard.  ← SIN traducir (no está en es.json → fallback inglés)
Your interest?                  ← SIN traducir
:name   :job   :bye             ← keyword TECLEADA en inglés (mecánica, no se traduce)
¡Soy un aventurero!             ← respuesta 'job' TRADUCIDA
Hasta el alba.                  ← respuesta 'bye' TRADUCIDA
```

**ASSERTS DE TEXTO: por ESTADO por defecto; spot-checks de texto PARAMETRIZADOS.** El grueso de
los asserts de cada capítulo son de ESTADO (bytes del `.GAM`, oro, posición, karma) — idénticos en
ambos idiomas por construcción, no necesitan tocarse. Los pocos asserts de CONTENIDO de diálogo
(`toContain`/`toMatch` sobre la consola) se parametrizan con `tourLang.ts::tr({en,es})`, que elige
el substring esperado según el run. Reglas (`tourLang.ts` es la fuente):

- Da la variante `es` SÓLO si el string ESTÁ traducido en `es.json` (comprueba la key EXACTA,
  incluidos `\n`). Ejemplos aterrizados: ch08 `heresy`→`herejía`, `Seventh Law of Virtue`→`Séptima
  Ley de la Virtud`, `500 gold crowns`→`500 coronas de oro`, `Court of Inquisition`→`Corte de la
  Inquisición` (spot-checks que PRUEBAN que la traducción ocurre de verdad).
- Nombres propios / Words of Power / mantras (`MALUM`, `Froed`, `BEH`) y strings **no traducidos**
  (ch08 `Mantra of Justice`; ch14 `in the pit.`, `Healed!` sin `\n` — sus keys de es.json llevan
  `\n` y no casan) se dejan en INGLÉS literal: `t()` cae a inglés en ambos modos, el assert inglés
  sigue válido en es. NO se fabrica una variante es que no existe (rompería el run).

**CADENCIA recomendada.** El modo es es una CONSOLIDACIÓN, no un gate por-commit: córrelo tras una
tanda de trabajo i18n (nuevas traducciones aterrizadas) para confirmar que la capa sigue siendo
sólo-presentación y ninguna traducción filtró a estado. La cadena ENTERA en es (como la inglesa)
está bajo el **mutex de flota** (una sola cadena completa a la vez) — desarrolla y valida con
capítulos SUELTOS; la corrida de cadena completa la agenda el lead con ventana.

**Validado (2026-07-18):** ch03 (Britain: diálogo + tienda), ch08 (Yew: keywords + diálogo denso +
4 spot-checks ES), ch14/ch14b (mazmorra: In Lor + fuente + combate de sala) — verdes en `es` con
sello byte-idéntico al inglés, y `en` intacto (VERIFY byte-idéntico). Gate: tsc + typecheck:e2e +
2042 unit + los 3 capítulos en ambos modos.

`ch02` (Lord British's Castle) es el capítulo de REFERENCIA para el patrón data-only con
navegación: importa el checkpoint de ch01, recorre el castillo por mecanismos reales
(NPCs, dressers, señal, 3 plantas vía (K)limb) y marca 15 ítems del manifiesto.

### Barrido PARALELO (`U5_TOUR_WORKERS`)

El barrido completo puede correr en PARALELO porque cada capítulo importa el sello
COMMITEADO (inmutable) de su predecesor desde disco — no necesita que el predecesor
CORRA antes; la serialización era config, no dependencia real.

```bash
# Verificación en paralelo (N workers, a nivel de FICHERO):
U5_TOUR_WORKERS=8 npm run tour:spec
# Re-sellado en cascada (regenerar saves/ tras un cambio del port) — SERIAL obligatorio:
U5_TOUR_WORKERS=1 npm run tour:spec        # (=default)
```

- **`U5_TOUR_WORKERS=1` (default)** → RE-SELLADO EN CASCADA: `exportCheckpoint` reescribe
  `saves/<ch>` en orden; cada capítulo lee el sello FRESCO del anterior. Idéntico al
  comportamiento histórico. Es el ÚNICO modo válido para regenerar sellos.
- **`U5_TOUR_WORKERS>1`** → VERIFY: capítulos en paralelo, cada uno lee el sello
  commiteado; `exportCheckpoint` NO reescribe (evita la carrera lectura-durante-escritura
  con el sucesor) y en su lugar ASERTA byte-identidad contra el sello (reporta el OFFSET del
  primer byte distinto si falla). Un save del port que diverja del sello **falla** con
  "re-sella serial: U5_TOUR_WORKERS=1" — conserva la detección de regresión que da
  `git diff saves/`, sin la carrera. Igual para `covered.chNN.json`: en paralelo se ASERTA
  contra lo commiteado (no se reescribe) → un capítulo que falle no puede mutilar la
  cobertura. `fullyParallel:false` mantiene el orden intra-fichero (todos los capítulos son
  `test.describe.serial`).

**Bendecido como default de consolidaciones** (2026-07-18). Números medidos, máquina
calmada, sobre la cadena completa (37 tests):

| Modo | Tiempo | Resultado |
|------|--------|-----------|
| Serial (`U5_TOUR_WORKERS=1`) | 5.4 min | 37/37 |
| Paralelo (`U5_TOUR_WORKERS=6`) | ~2.8–3.1 min (×2 corridas) | 37/37 |

`workers=6` es el **punto dulce**: el camino crítico es el capítulo más largo EN SOLITARIO
(ch05 Minoc ~2.1 m, ch08 Yew ~1.7 m), así que subir workers por encima de ~6 no baja mucho
de ~2.8 m — la vía para acortar más sería TROCEAR los capítulos largos, no añadir workers.

**Warm-up del optimizador (imprescindible para el paralelo).** El dev-server es un proceso
FRESCO: su optimizador de deps de Vite hace un scan/optimize en la primera carga, y hasta
que asienta el `browserHash`, N cargas simultáneas (la estampida de los workers) reciben
hashes distintos → Vite fuerza un `full-reload` a mitad de capítulo → "Execution context was
destroyed … navigation" y se pierde `window.__u5test`. `e2e/global-setup.ts` hace UNA carga
completa (chromium, `networkidle`) ANTES de soltar los workers para asentar el optimizador;
como el bundle no tiene imports dinámicos, esa única carga descubre TODO. La caché en disco
(`node_modules/.vite`) NO basta: la carrera es POR-PROCESO. (Un server de *preview*/producción
NO sirve: `__u5test` está gated en `import.meta.env.DEV`.)

> **Recordatorio:** el RE-SELLADO en cascada (regenerar `saves/`) es SIEMPRE serial
> (`U5_TOUR_WORKERS=1`, el default). El paralelo es sólo para VERIFICAR. Y la regla del mutex
> de flota sigue vigente: UNA sola cadena completa a la vez, sea serial o paralela.

## Criterios de PASS de un capítulo

1. **Spec verde** (`tour:spec chNN`): asserts de estado y de bytes del `.GAM` pasan.
2. **Determinismo**: re-correr la spec regenera `saves/chNN.{gam,sidecar.json}` y
   `covered.chNN.json` **byte-idénticos** a lo commiteado (`git status` limpio). Sin
   timestamps ni ruido por-corrida.
3. **Espejo — capa 1 (offset-coverage, siempre)**: `tour:mirror chNN` decodifica todos los
   offsets mapeados del `.GAM` sin FAIL (detecta `.GAM` truncado o deriva de offsets).
4. **Espejo — capa 2 (estado real, gated)**: si el oráculo está disponible (dosbox-x headless
   + datos del juego), `mirror_runner` bootea `ULTIMA.EXE`, inyecta el `.GAM`, hace "Journey
   Onward" y compara DS↔fichero con tolerancia 0. Si NO está disponible o hay otro dosbox-x
   ajeno vivo, se **declara SALTADO y sale 0** (barrido real gated a la ventana del usuario).
   Un FAIL de un campo mapeado en la capa 2 **sí** es un hallazgo (exit 1).
5. **Cobertura declarada**: `covered.chNN.json` lista ids reales del manifiesto (o documenta
   por qué cubre 0). El cierre de ch19 asserta `∪ covered == manifest` o enumera el hueco.
6. **Gate de tipos**: `npm run typecheck:e2e` (`tsc -p tsconfig.e2e.json`) limpio — las specs
   del tour codifican asserts de offsets load-bearing y deben type-checkear.

## Gate agregado (barrido, antes de escalar)

```bash
npx tsc --noEmit -p tsconfig.json        # src
npm run typecheck:e2e                    # e2e (specs del tour incluidas)
npx vitest run                           # unit
npm run tour -- chNN                     # spec + espejo del capítulo
```
