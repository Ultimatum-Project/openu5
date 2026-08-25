/**
 * PAQUETE DEL WALKTHROUGH — que las 21 paradas SE PUEDAN JUGAR, disparando los comandos.
 *
 * ── POR QUÉ ESTE FICHERO SI EL HORNEADOR YA CAREA ───────────────────────────────────────
 * `game/tools/walkthrough-hornea.mjs` compara CAMPOS: hornea cada parada, la relee con
 * `importNativeSave` y comprueba que el oro, la posición y los flags de trama sobrevivieron al
 * códec. Eso demuestra que los bytes viajan, y es la mitad.
 *
 * La otra mitad —la que este fichero hace— es EJECUTAR. Que la casilla del santuario de la
 * Compasión sea una isla de una celda y que el save lleve tres alfombras no demuestra que el
 * jugador pueda salir de ahí: demuestra que yo creo que puede. Es exactamente la decisión que
 * ya tomó `momentos-escapables.test.ts` cuando el usuario reportó la cámara sellada de
 * Blackthorn — el pytest comprobaba el TILE de la puerta y el defecto seguía vivo. Si mañana el
 * port pide algo más para embarcar en una alfombra, el careo de campos sigue verde y esto se
 * pone rojo.
 *
 * ⚠ SALTA SIN ASSETS, igual que sus hermanos: `game/assets/` es la extracción de la copia de EA
 * del usuario y no viaja al repositorio público. Aquí hacen falta `initial-state.json` (para
 * componer), `data.json` (santuarios, bocas de mazmorra y palabras — el recorrido las recibe, no
 * las escribe) y los tres mapas.
 */
import { expect, it } from "vitest";
import { describeConAssets, leeAsset } from "./assets-opcionales.js";
import { construyeRecorrido, componeParada, type Parada } from "../src/walkthrough/recorrido.js";
import { momentoPorId } from "../src/momentos/defs.js";
import { componeMomento } from "../src/momentos/compone.js";
import type { ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager } from "../src/core/world/doors.js";
import { buildUseRows } from "../src/core/usePicker.js";
import { yellWordOfPower, wordSpokenFlag } from "../src/core/quest/words.js";
import { shrineMode } from "../src/core/world/shrines.js";
import { isPassable } from "../src/core/world/movement.js";

const ASSETS = [
  "initial-state.json",
  "data.json",
  "maps/overworld.json",
  "maps/underworld.json",
  "maps/smallmaps.json",
] as const;

const CODEX_TILE = 0x11;

describeConAssets(ASSETS, "paquete del walkthrough: las 21 paradas se pueden jugar", () => {
  const init = leeAsset<ExtractedInitialState>("initial-state.json");
  const data = leeAsset<{
    shrineX: number[]; shrineY: number[]; virtues: string[]; mantras: string[];
    locationsX: number[]; locationsY: number[]; wordsOfPower: string[];
  }>("data.json");
  const overworld = leeAsset<number[][]>("maps/overworld.json");
  const underworld = leeAsset<number[][]>("maps/underworld.json");
  const smallMapsRaw = leeAsset<SmallMapLocation[]>("maps/smallmaps.json");

  const world: WorldData = {
    overworld,
    underworld,
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  const gameData: GameData = {
    locationsX: data.locationsX,
    locationsY: data.locationsY,
    locationNames: [],
  };
  const combatResources: CombatResources = {
    combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
  };

  /**
   * La celda del Codex se BARRE, igual que en el horneador. Y se exige única: si el barrido
   * diera dos, el recorrido estaría eligiendo una sin decirlo.
   */
  function localizaCodex(): { x: number; y: number } {
    const hits: { x: number; y: number }[] = [];
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) if (overworld[y]![x] === CODEX_TILE) hits.push({ x, y });
    }
    expect(hits, "el sobremundo no tiene EXACTAMENTE un Codex").toHaveLength(1);
    return hits[0]!;
  }

  const recorrido = construyeRecorrido({ ...data, codex: localizaCodex() });

  /** El estado de una parada, por el mismo camino que usa el horneador. */
  function estadoDe(p: Parada): GameState {
    if (p.momento) {
      const def = momentoPorId(p.momento);
      expect(def?.estado, `el momento ${p.momento} no tiene estado`).toBeDefined();
      return componeMomento(def!, init);
    }
    return componeParada(p.estado!, init);
  }

  function juegoDe(p: Parada): Game {
    const doors = new DoorManager();
    return new Game(init, world, gameData, estadoDe(p), { combatResources, doors });
  }

  const parada = (n: number): Parada => {
    const p = recorrido.find((x) => x.n === n);
    expect(p, `no existe la parada ${n}`).toBeDefined();
    return p!;
  };
  const mensajes = (evs: { kind: string; text?: string }[]): string[] =>
    evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

  // ── 1 · EL CARDINAL Y LA NUMERACIÓN ───────────────────────────────────────────────────
  //
  // Un paquete al que le falta una parada por un `if` mal puesto se entrega igual y nadie lo
  // ve: los ficheros que hay siguen cargando. El cardinal y la contigüidad son lo que separa
  // «21 saves» de «los saves que salieron».
  it("son 21 paradas, numeradas 1..21 sin huecos ni repeticiones", () => {
    expect(recorrido).toHaveLength(21);
    expect(recorrido.map((p) => p.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(new Set(recorrido.map((p) => p.slug)).size, "hay slugs repetidos").toBe(21);
  });

  it("las diez paradas-momento REFERENCIAN su momento y no llevan copia del parche", () => {
    const conMomento = recorrido.filter((p) => p.momento);
    expect(conMomento).toHaveLength(10);
    for (const p of conMomento) {
      expect(p.estado, `la parada ${p.n} duplica el parche de ${p.momento}`).toBeUndefined();
      expect(momentoPorId(p.momento!), `${p.momento} no existe`).toBeDefined();
    }
  });

  // ── 2 · LA CURVA DE EQUIPO ────────────────────────────────────────────────────────────
  //
  // ★ ES LA PROPIEDAD QUE EL ENCARGO PIDE («equipo consistente con el punto del juego») HECHA
  // FALSABLE. Las cifras concretas son Clase C; la monotonía no lo es, y ya cazó un defecto
  // real: la mochila de la parada 12 se escribió interpolando hacia el acto III cuando su
  // vecina es acto II, y daba una caída de 800→600 de oro en el paquete entregado.
  //
  // ⚠ SEIS CAMPOS Y NO OCHO, y la exclusión está razonada: el TAMAÑO DEL GRUPO y las ALFOMBRAS
  // no son monótonos a propósito (los momentos 3-7 viajan con cinco porque así se publicaron en
  // la galería; las alfombras son la herramienta del peregrinaje y de ningún otro tramo). Meter
  // los ocho en el mismo aserto habría obligado a relajar el predicado entero.
  it("las seis reservas nunca bajan al avanzar de parada", () => {
    const CAMPOS = ["gold", "food", "keys", "gems", "torches", "skullKeys"] as const;
    const estados = recorrido.map((p) => ({ p, s: estadoDe(p) }));
    for (let i = 1; i < estados.length; i++) {
      const ant = estados[i - 1]!;
      const act = estados[i]!;
      for (const c of CAMPOS) {
        expect(
          act.s[c],
          `${c} baja de la parada ${ant.p.n} (${ant.s[c]}) a la ${act.p.n} (${act.s[c]})`,
        ).toBeGreaterThanOrEqual(ant.s[c]);
      }
    }
  });

  it("el grupo y las alfombras NO son monótonos, y es donde se declara", () => {
    /**
     * ★ LA RECÍPROCA DEL ASERTO DE ARRIBA, y no es ceremonia: sin ella, «seis campos» se lee
     * como un descuido en vez de como una exclusión razonada. Aquí se fija DÓNDE rompen. Si
     * alguien alinea los momentos a seis miembros, esto se pone rojo y le obliga a venir a
     * cambiar la explicación del README en el mismo commit.
     */
    const grupos = recorrido.map((p) => estadoDe(p).partySize);
    // Las cinco paradas-momento del tramo medio (13..17) viajan con CINCO.
    expect(grupos.slice(12, 17), "el tramo 13-17 ya no viaja con cinco").toEqual([5, 5, 5, 5, 5]);
    // Y las que las rodean, con seis.
    expect(grupos[11], "la parada 12 ya no viaja con seis").toBe(6);
    expect(grupos[17], "la parada 18 ya no viaja con seis").toBe(6);

    const alfombras = recorrido.map((p) => estadoDe(p).magicCarpets);
    // Sólo el peregrinaje (paradas 4..11) las lleva.
    expect(alfombras.slice(3, 11).every((n) => n > 0), "el peregrinaje se quedó sin alfombras").toBe(true);
    expect(alfombras.filter((n) => n > 0)).toHaveLength(8);
  });

  // ── 3 · TODA PARADA ATERRIZA EN CASILLA PISABLE ───────────────────────────────────────
  it("las 21 paradas dejan al grupo en una casilla que se puede pisar a pie", () => {
    for (const p of recorrido) {
      const st = estadoDe(p);
      const { location, floor, x, y } = st.position;
      let tile: number;
      if (location === 0) {
        // Planta con el bit alto = Underworld (el discriminante del códec, #115).
        tile = (floor & 0xff) > 0x7f ? underworld[y]![x]! : overworld[y]![x]!;
      } else {
        const mapa = smallMapsRaw.find((m) => m.id === location);
        expect(mapa, `parada ${p.n}: no hay mapa para loc ${location}`).toBeDefined();
        const planta = mapa!.floors.find((f) => f.z === floor);
        expect(planta, `parada ${p.n}: loc ${location} sin planta ${floor}`).toBeDefined();
        tile = planta!.tiles[y]![x]!;
      }
      expect(
        isPassable(tile, "foot"),
        `parada ${p.n} (${p.slug}) cae en tile 0x${tile.toString(16)}, impasable a pie`,
      ).toBe(true);
    }
  });

  // ── 4 · LOS OCHO SANTUARIOS: LA QUEST ES ACTIVABLE Y LA ISLA TIENE SALIDA ──────────────
  it("las ocho paradas del peregrinaje llegan en modo «show-mantra» — la quest se activa", () => {
    /**
     * ★ SE PREGUNTA AL PORT, NO A LA TABLA. `shrineMode` es la función que el juego consulta
     * para decidir qué hace el (E)nter, y ramifica primero por el bit del Codex. Comprobar
     * `shrineVisitedBitmap === 0` a mano sería reimplementar su lógica aquí; llamarla es lo que
     * hace que un cambio de reglas en el port aparezca como rojo en el paquete.
     */
    for (let n = 4; n <= 11; n++) {
      const p = parada(n);
      const st = estadoDe(p);
      const virtud = ["honestidad", "compasion", "valor", "justicia", "sacrificio", "honor", "humildad"]
        .findIndex((v) => p.slug.endsWith(v));
      const v = p.slug.startsWith("codex") ? 6 : [0, 1, 2, 3, 4, 5, 7][virtud]!;
      expect(shrineMode(st, v), `parada ${n} no está en modo show-mantra`).toBe("show-mantra");
    }
  });

  it("las quests de santuario se ACUMULAN parada a parada del peregrinaje", () => {
    // La 4 llega sin ninguna y la 11 con siete: es lo que hace que las ocho sean estados
    // distintos y no la misma foto repetida.
    const bits = (n: number): number => estadoDe(parada(n)).shrineQuestBitmap ?? 0;
    const cuenta = (m: number): number => m.toString(2).split("").filter((c) => c === "1").length;
    expect(cuenta(bits(4)), "la primera parada del peregrinaje ya trae quests").toBe(0);
    for (let n = 5; n <= 11; n++) {
      expect(cuenta(bits(n)), `la parada ${n} no acumula`).toBe(cuenta(bits(n - 1)) + 1);
    }
    expect(cuenta(bits(11))).toBe(7);
  });

  it("de la isla de UNA celda del santuario de la Compasión se sale — embarcando la alfombra", () => {
    /**
     * 🔴 EL ASERTO QUE JUSTIFICA LAS TRES ALFOMBRAS, y el que habría cazado el defecto si nadie
     * hubiera medido: la casilla del santuario de la Compasión tiene una componente conexa a pie
     * de UNA CELDA. A pie no hay un solo movimiento legal desde ahí — es la avería del momento 7
     * (dos celdas, cero puertas) trasladada al sobremundo.
     *
     * Se comprueba EJECUTANDO las dos mitades: que el picker de (U)se OFREZCA la alfombra (el
     * gate real: `usePicker` sólo la muestra con `magicCarpets > 0`) y que el (U)se EMBARQUE de
     * verdad. Un aserto sobre `state.magicCarpets` no mide ninguna de las dos.
     */
    const p = parada(5);
    expect(p.slug, "la parada 5 ya no es el santuario de la Compasión").toBe("santuario-compasion");

    // Primero, la premisa: la isla es de una celda. Se mide aquí para que el aserto de abajo no
    // se quede sin sujeto si algún día el mapa cambia.
    const st0 = estadoDe(p);
    const { x, y } = st0.position;
    const vecinasPisables = [[0, -1], [1, 0], [0, 1], [-1, 0]]
      .filter(([dx, dy]) => isPassable(overworld[(y + dy!) & 0xff]![(x + dx!) & 0xff]!, "foot"));
    expect(vecinasPisables, "la isla dejó de serlo: hay salida a pie").toHaveLength(0);

    const g = juegoDe(p);
    const ofrecidas = buildUseRows(g.state).map((r) => r.action);
    expect(
      ofrecidas.some((a) => a.kind === "tool" && a.tool === "carpet"),
      "el (U)se no ofrece la alfombra mágica",
    ).toBe(true);

    const antes = g.state.magicCarpets;
    const msgs = mensajes(g.useMagicCarpet());
    expect(msgs.join(" "), "el (U)se de la alfombra no embarcó").toContain("Boarded!");
    expect(msgs.join(" "), "salió el rechazo de mazmorra o de transporte").not.toContain("Not here!");
    expect(g.state.transport, "el transporte no pasó a alfombra").toBe("carpet");
    expect(g.state.magicCarpets, "embarcar no gastó alfombra").toBe(antes - 1);
  });

  // ── 5 · LA PALABRA DE PODER ───────────────────────────────────────────────────────────
  it("parada 12: la boca de Despise está al norte y su palabra SIGUE sin decir", () => {
    const p = parada(12);
    const st = estadoDe(p);
    const DESPISE = 34;
    const bx = data.locationsX[DESPISE - 1]!;
    const by = data.locationsY[DESPISE - 1]!;
    // La party está en la única vecina pisable de la boca, y la boca queda al NORTE.
    expect([st.position.x, st.position.y]).toEqual([bx, by + 1]);
    expect(isPassable(overworld[by]![bx]!, "foot"), "la boca dejó de ser pisable").toBe(true);

    // El sello de Despise NO está abierto (es lo que la parada existe para probar) y los otros
    // dos de continente SÍ.
    expect(st.questFlags?.[wordSpokenFlag(DESPISE)], "Despise ya venía abierta").toBeFalsy();
    expect(st.questFlags?.[wordSpokenFlag(35)], "Destard debería venir abierta").toBe(true);
    expect(st.questFlags?.[wordSpokenFlag(36)], "Wrong debería venir abierta").toBe(true);
  });

  it("parada 12: gritar VILIS abre el sello, y la palabra de OTRA mazmorra no", () => {
    /**
     * ★ SE EJECUTA EL HANDLER DEL PORT (`yellWordOfPower`), no se comprueba una cadena. Y va con
     * su CONTROL NEGATIVO: la misma llamada con la palabra de otra mazmorra tiene que salir
     * `opened: false` con «No effect!». Sin el control, el aserto positivo pasaría igual con un
     * handler que abriera SIEMPRE.
     */
    const DESPISE = 34;
    const palabra = data.wordsOfPower[DESPISE - 33]!;
    const adyacentes = [DESPISE];

    const bien = yellWordOfPower(data.wordsOfPower, palabra, adyacentes);
    expect(bien.uttered).toBe(true);
    expect(bien.opened, `«${palabra}» no abrió el sello de Despise`).toBe(true);
    expect(bien.openedLocation).toBe(DESPISE);

    const otra = data.wordsOfPower[0]!; // la de Deceit (loc 33), que no está al lado
    const mal = yellWordOfPower(data.wordsOfPower, otra, adyacentes);
    expect(mal.uttered, "una palabra válida siempre se «pronuncia»").toBe(true);
    expect(mal.opened, `«${otra}» abrió un sello que no le toca`).toBe(false);
    expect(mal.messages.join(" ")).toContain("No effect!");
  });

  // ── 6 · EL AMULETO ────────────────────────────────────────────────────────────────────
  it("parada 19: el grupo está pegado al Amuleto y el Amuleto todavía no es suyo", () => {
    /**
     * El gate del sembrador del Underworld sólo pone el Amuleto en el mapa si NO ha sido tomado
     * (`quest/underworld-seed.ts`), así que un save que ya lo tuviera dejaría la parada sin nada
     * que recoger — y la tarjeta prometiendo un (G)et que no encuentra objeto.
     */
    const p = parada(19);
    const st = estadoDe(p);
    expect(st.lbArtifacts.amulet, "el Amuleto ya venía en la bolsa: no habría nada que coger").toBe(false);
    expect(st.lbArtifacts.crown, "la Corona debería venir ya tomada").toBe(true);
    expect(st.lbArtifacts.sceptre, "el Cetro debería venir ya tomado").toBe(true);
    // Justo al sur de (105,225), que es donde el sembrador lo pone.
    expect([st.position.x, st.position.y]).toEqual([105, 226]);
    expect(isPassable(underworld[225]![105]!, "foot"), "la celda del Amuleto no es pisable").toBe(true);
  });

  // ── 7 · SIN DESENLACE ─────────────────────────────────────────────────────────────────
  it("ninguna parada está DENTRO de la mazmorra del Doom", () => {
    /**
     * 🔴 LA ORDEN DEL USUARIO HECHA PREDICADO («todos SALVO el final», #222). Y el predicado no
     * es «la última parada se llama boca-doom»: es que NINGUNA de las 21 tenga una localización
     * de mazmorra (33..40), que es la forma en que un descenso se podría colar.
     */
    for (const p of recorrido) {
      const loc = estadoDe(p).position.location;
      expect(loc, `la parada ${p.n} (${p.slug}) está dentro de una mazmorra`).toBeLessThan(33);
    }
  });
});
