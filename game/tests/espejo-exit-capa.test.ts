/**
 * ★★ EL GATE DE LA COSTURA DE SALIDA ERA CIEGO A LA CAPA — y la guarda que lo cazaría vivía
 * DENTRO de la rama que no la necesitaba.
 *
 * E-2 (§1.5 de `espejo-e2-ledger-capacidad.md`) arregló dos defectos que se tapaban el uno al
 * otro: `teleportOverworld` sin tercer argumento depositaba siempre en Britannia, y la guarda de
 * éxito miraba `location !== 0` cuando **Britannia y el Underworld son los dos `location` 0**. El
 * fix creó `exitResyncVerdict`, que discrimina por `floor === 0xFF`.
 *
 * Pero el fix se metió DENTRO de `resyncExitToOverworld`, y el predicado que decide si esa
 * función corre siguió siendo el viejo. Consecuencia: cuando el replay salió de la mazmorra por
 * su cuenta —`location` ya es 0, el resync no tiene nada que hacer— **nadie comprobaba a qué
 * capa**. Y esa rama es alcanzable con la capa equivocada: `exitDungeonTo`
 * (`dungeon-cmds.ts:439-462`) pone `location: 0` en sus DOS ramas y elige por el signo de la
 * planta VIVA del replay (`game.ts:6573-6574`), que es justo lo que el carril E-3 documenta como
 * derivado.
 *
 * Este fichero fija la decisión del call-site como función PURA. Los tres primeros bloques son
 * TRANSCRIPCIÓN FIEL de lo que el `if` ya hacía (si alguno cambia, el desacople movió
 * comportamiento y eso es una regresión, no una mejora); el cuarto es el agujero.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exitSeamAction, exitResyncVerdict, UNDERWORLD_FLOOR } from "../e2e/espejo-tour/runner";

const BRITANNIA = { location: 0, floor: 0 };
const UNDERWORLD = { location: 0, floor: UNDERWORLD_FLOOR };
const DENTRO_DE_MAZMORRA = { location: 39, floor: 3 };

describe("exitSeamAction — transcripción FIEL de lo que el call-site ya hacía", () => {
  it("sin `enter.overworld` no es costura de salida: no hace nada", () => {
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, undefined).kind).toBe("none");
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, { underworld: true }).kind).toBe("none");
  });

  it("con `carryover` no hace nada, aunque sea costura de salida", () => {
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, { overworld: true, carryover: true }).kind).toBe("none");
  });

  it("el replay NO salió (location != 0) ⇒ RESYNC, y le pasa la capa que pide la costura", () => {
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, { overworld: true, underworld: true })).toEqual({
      kind: "resync",
      fromLoc: 39,
      underworld: true,
      porqueMazmorra: false,
    });
    // Costura de Britannia: `underworld` ausente ⇒ false. Es el caso de las 19 salidas que midió
    // la ventana E-3, y tiene que seguir comportándose exactamente igual.
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, { overworld: true })).toEqual({
      kind: "resync",
      fromLoc: 39,
      underworld: false,
      porqueMazmorra: false,
    });
  });
});

/**
 * ★★ EL PRIMER DEFECTO, y el que mata al segundo: `state.position` NO ATESTIGUA la mazmorra.
 *
 * `setDungeonPos` deja `state.position = {location: 0, floor: 0, …}` a propósito (el tile de
 * superficie de la entrada, para que un `Exit to Britannia!` posterior aterrice donde debe). Así
 * que preguntarle a `position` si la party está dentro da SIEMPRE «ya está fuera».
 *
 * Consecuencia medida en vivo (ad17, 3 costuras de clase A): el resync de salida NUNCA disparaba
 * y las tres se leían como «el replay salió por su cuenta a Britannia». Refuta el criterio de
 * clase A de E-23 —«si el replay no salió, la party sigue en `location != 0`»—, que es la premisa
 * sobre la que se retiró el skip de 8 segmentos.
 */
describe("★★ la mazmorra VIVA manda sobre `position` (premisa de E-23 refutada)", () => {
  const PARKED = { location: 0, floor: 0 }; // exactamente lo que deja setDungeonPos
  const costura = { overworld: true, underworld: true };

  it("con `dungeonState` vivo se RESINCRONIZA aunque `position` diga location 0", () => {
    expect(exitSeamAction(PARKED, costura, { dungeon: 33 })).toEqual({
      kind: "resync",
      fromLoc: 33,
      underworld: true,
      porqueMazmorra: true,
    });
  });

  it("y el `fromLoc` es la MAZMORRA, no el 0 aparcado (es el índice de locationsX/Y)", () => {
    const a = exitSeamAction(PARKED, costura, { dungeon: 40 });
    expect(a.kind === "resync" && a.fromLoc).toBe(40);
  });

  // ★ El mismo estado exacto, con y sin mazmorra viva, tiene que decidir DISTINTO. Si no, el
  // gate volvió a resolverse con `position` y el arreglo es inerte.
  it("MISMO `position`, con mazmorra viva y sin ella ⇒ decisiones distintas", () => {
    expect(exitSeamAction(PARKED, costura, { dungeon: 33 }).kind).toBe("resync");
    expect(exitSeamAction(PARKED, costura, null).kind).toBe("layer-mismatch");
  });

  // Control NEGATIVO: sin mazmorra viva la rama nueva no puede robarle el veredicto a nadie.
  it("sin mazmorra viva el comportamiento es EXACTAMENTE el de antes de esta rama", () => {
    expect(exitSeamAction(DENTRO_DE_MAZMORRA, costura, null)).toEqual(
      exitSeamAction(DENTRO_DE_MAZMORRA, costura),
    );
    expect(exitSeamAction(UNDERWORLD, costura, null)).toEqual(exitSeamAction(UNDERWORLD, costura));
  });
});

/**
 * CONTROL DE LA CITA: el aparcado que hace falso al gate viejo está en el CORE, y si alguien lo
 * cambia, la premisa de arriba deja de ser cierta sin que este fichero se entere. Se lee del
 * fuente en vez de copiar el literal.
 */
describe("la cita que sostiene la premisa sigue en pie", () => {
  it("`setDungeonPos` aparca `state.position` en location 0", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "core", "dungeon", "dungeon-cmds.ts"),
      "utf8",
    );
    const cuerpo = src.slice(src.indexOf("export function setDungeonPos"));
    expect(cuerpo.slice(0, cuerpo.indexOf("\n}"))).toMatch(/ctx\.state\.position\s*=\s*\{\s*\n?\s*location:\s*0/);
  });
});

describe("★ EL AGUJERO: el replay salió por su cuenta y nadie miraba la capa", () => {
  // ÉSTE es el que estaba rojo antes del arreglo: la rama devolvía `none` sin mirar `floor`.
  it("costura del UNDERWORLD y la party emergió a BRITANNIA ⇒ se AFLORA", () => {
    expect(exitSeamAction(BRITANNIA, { overworld: true, underworld: true })).toEqual({
      kind: "layer-mismatch",
      want: true,
      got: 0,
    });
  });

  // La simétrica. Sin ella, «marca mismatch siempre que la costura pida underworld» pasaría.
  it("costura de BRITANNIA y la party emergió al UNDERWORLD ⇒ también se AFLORA", () => {
    expect(exitSeamAction(UNDERWORLD, { overworld: true })).toEqual({
      kind: "layer-mismatch",
      want: false,
      got: UNDERWORLD_FLOOR,
    });
  });
});

describe("CONTROL NEGATIVO — la capa que COINCIDE no puede aflorar nada", () => {
  // Sin estos dos, un `layer-mismatch` incondicional pasaría los dos tests de arriba. Validado
  // contra esa variante: con ella los dos de aquí se ponen ROJOS.
  it("costura del Underworld y la party YA está en el Underworld ⇒ none", () => {
    expect(exitSeamAction(UNDERWORLD, { overworld: true, underworld: true }).kind).toBe("none");
  });

  it("costura de Britannia y la party YA está en Britannia ⇒ none", () => {
    expect(exitSeamAction(BRITANNIA, { overworld: true }).kind).toBe("none");
  });
});

describe("★★ la propiedad que `location` NO puede expresar", () => {
  /**
   * El corazón del defecto en un solo aserto: los dos estados tienen la MISMA `location` (0) —
   * el predicado viejo los declaraba indistinguibles— y la costura es la MISMA. Si el veredicto
   * no difiere, el gate volvió a decidir por `location`.
   */
  it("dos estados con location 0 y la misma costura dan veredictos DISTINTOS", () => {
    const costura = { overworld: true, underworld: true };
    expect(BRITANNIA.location).toBe(UNDERWORLD.location);
    expect(exitSeamAction(BRITANNIA, costura).kind).not.toBe(exitSeamAction(UNDERWORLD, costura).kind);
  });

  // Y la mitad que E-2 ya tenía sigue en pie: la guarda del resync mide lo mismo por su lado.
  it("`exitResyncVerdict` sigue discriminando por capa (la mitad de E-2, intacta)", () => {
    expect(exitResyncVerdict(UNDERWORLD, true).ok).toBe(true);
    expect(exitResyncVerdict(BRITANNIA, true).ok).toBe(false);
    expect(exitResyncVerdict(BRITANNIA, true).reason).toMatch(/capa EQUIVOCADA/);
  });
});

/**
 * GUARDA CONTRA QUE EL ARREGLO QUEDE INERTE. Misma clase que la de §5.5 del hito 3 de E-3: sin
 * esto, una reversión del call-site dejaría la función pura verde y el runner ciego otra vez, y
 * la corrida siguiente lo leería como «no hay capas equivocadas» en vez de «nadie mira».
 */
describe("el runner CONSUME la decisión (si no, esto es una función que nadie llama)", () => {
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "runner.ts"),
    "utf8",
  );

  it("el call-site llama a `exitSeamAction`", () => {
    // el 4º argumento lo añadió la tarjeta `ad18-g11` (atribución); los tres primeros son los que
    // sostienen el arreglo de E-2/E-3 y siguen pinados en su orden exacto.
    expect(runner).toMatch(/exitSeamAction\(await getPos\(page\), seg\.enter, await dungeonPos\(page\)[,)]/);
  });

  it("y ya NO decide con el predicado viejo `pos.location !== 0` en esa costura", () => {
    expect(runner).not.toMatch(/if \(pos\.location !== 0\) await resyncExitToOverworld/);
  });

  it("el `layer-mismatch` sale por el canal de resyncs, con su etiqueta propia", () => {
    expect(runner).toMatch(/CAPA-EXIT/);
  });
});

/**
 * ★★ TARJETA `ad18-g11` — el ÚNICO `layer-mismatch` real que el brazo ha cazado, ADJUDICADO:
 * la causa NO estaba donde la línea decía.
 *
 * `espejo-final-f1-acta` §3.5 lo dejó «sin adjudicar» con dos hipótesis: **divergencia del port**
 * o **que el replay nunca entrara a esa mazmorra**. Medido en vivo (corrida propia de `ad18`,
 * puerto 5261, `U5_ESPEJO_NO_EXPORT=1`), el report dice las dos cosas seguidas:
 *
 * ```
 * ad18-g10  R: costura dungeon DECEIT: setDungeonPos(33, f0, 1,1, south) …
 *           R: PLANTA-DESCONOCIDA klimb-down: la party SALIÓ del 3D (la costura supuso la CIMA
 *              y el eco del LP la falsifica) — ops de pasillo restantes NO conducidas
 *              · 1 op de pasillo conducida de 116 · floorUnknown = 1
 * ad18-g11  R: CAPA-EXIT …: el replay salió por su cuenta a Britannia …
 * ```
 *
 * ⇒ Ni divergencia del port ni «nunca entró»: **entró y fue EXPULSADO** en el primer `klimb` por
 * la limitación declarada de 3b (la costura sólo sabe entrar por la CIMA). El `underworld:true`
 * de la costura es correcto (el LP emerge de Deceit: `Underworld!` ln2822) y el aviso de capa
 * también — **lo que estaba mal era la CAUSA que la línea afirma**, y afirmarla costó una ventana
 * entera con «divergencia del port» como hipótesis viva.
 *
 * EL DEFECTO, en una frase: *el call-site no puede observar «el replay salió por su cuenta»* —
 * `location 0 / floor 0` sin mazmorra viva es exactamente lo que deja **también** una expulsión.
 * Un instrumento que nombra una causa que no mide es [[cita-equivocada-peor-que-ninguna]].
 */
describe("★★ ad18-g11 — el `layer-mismatch` no puede AFIRMAR una causa que no observa", () => {
  const costura = { overworld: true, underworld: true };
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "runner.ts"),
    "utf8",
  );

  it("con el interior ABANDONADO antes, el veredicto ATRIBUYE la causa y nombra el segmento", () => {
    const a = exitSeamAction(BRITANNIA, costura, null, { abandonedIn: "ad18-g10" });
    expect(a).toEqual({ kind: "layer-mismatch", want: true, got: 0, abandonedIn: "ad18-g10" });
  });

  // CONTROL NEGATIVO: sin ese dato el veredicto es el de siempre — la atribución no se inventa.
  it("sin el dato, el veredicto queda EXACTAMENTE como estaba (no se fabrica atribución)", () => {
    expect(exitSeamAction(BRITANNIA, costura, null, undefined)).toEqual(
      exitSeamAction(BRITANNIA, costura, null),
    );
    expect(exitSeamAction(BRITANNIA, costura, null)).toEqual({ kind: "layer-mismatch", want: true, got: 0 });
  });

  // …y no puede colarse por la puerta de al lado: con mazmorra VIVA manda el resync, atribución o no.
  it("el dato NO le roba el veredicto al resync (la mazmorra viva sigue mandando)", () => {
    expect(exitSeamAction(BRITANNIA, costura, { dungeon: 33 }, { abandonedIn: "ad18-g10" }).kind).toBe("resync");
  });

  it("el runner IMPRIME la atribución cuando la tiene, y NO afirma causa cuando no la tiene", () => {
    // la frase que costó la ventana no puede seguir siendo la que se emite a ciegas
    expect(runner, "el call-site ya no afirma «salió por su cuenta» en la rama de mismatch").not.toMatch(
      /CAPA-EXIT[^`]*el replay salió por su cuenta/,
    );
    expect(runner).toMatch(/EXPULSADA del 3D/);
    expect(runner, "y el call-site le pasa el dato de atribución").toMatch(/exitSeamAction\(await getPos\(page\), seg\.enter, await dungeonPos\(page\), opts\.interiorAbandonedBefore\)/);
  });

  /**
   * ★ GUARDA DEL CABLEADO, y existe porque el MUTANTE la pidió: con la lógica intacta y la spec
   * dejando de pasar el dato (`interiorAbandonedBefore = undefined`), los 21 tests de este fichero
   * seguían VERDES. Lógica sellada, cableado sin sellar — y el síntoma sería el peor posible: la
   * línea diría «CAUSA NO OBSERVADA» para siempre y se leería como que nunca hay atribución.
   */
  it("★ la SPEC rellena el dato desde el report anterior (si no, la atribución no llega nunca)", () => {
    const spec = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "espejo-tour.spec.ts"),
      "utf8",
    );
    expect(spec, "el dato tiene que salir del `floorUnknown` del segmento ANTERIOR").toMatch(
      /prev\.floorUnknown > 0 \? \{ abandonedIn: prev\.id \}/,
    );
    expect(spec, "y llegar a runSegment").toMatch(/runSegment\(page, seg, \{[^}]*interiorAbandonedBefore[^}]*\}\)/);
  });
});
