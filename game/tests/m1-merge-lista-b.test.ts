/**
 * ★ M1 (lista B) — el LOAD MID-SESIÓN es un MERGE, y para los campos cuya AUSENCIA
 * SIGNIFICA algo el merge arrastraba la partida VIVA.
 *
 * Ficha M1 (`re/notes/auditoria-workflow-2026-07-28.md`, refinada en
 * `auditoria-port-a4-m1-m2-acta.md` §5): cargar partida a mitad de sesión hace
 * `Object.assign(game.state, loaded)` (main.ts:392 y :2446). Un save temprano no trae los
 * opcionales, y `Object.assign` sólo copia las propiedades OWN del origen ⇒ todo campo que
 * el save omite conserva el valor de la partida anterior.
 *
 * La lista A (`SAVE_OPTIONAL_DEFAULTS`) ya se cerró: `deserialize` le pone su valor en
 * reposo, que es una propiedad own y por tanto viaja en el merge. La lista B
 * (`SAVE_OPTIONALS_ABSENCE_MEANS`) NO puede recibir un valor —`undefined` ES el estado que
 * sus consumidores leen— y por eso se quedaba fuera del merge: cargar un save temprano a
 * mitad de partida heredaba «Shadowlord convocado», la fase lunar latcheada de la sesión
 * anterior o un hechizo de tiempo activo que el save no contiene.
 *
 * ★ EL MECANISMO que lo arregla sin tocar `main.ts` (bajo embargo): `Object.assign` NO
 * salta las propiedades own con valor `undefined` —`Object.assign({a:1}, {a:undefined})`
 * deja `a: undefined`—, así que basta con que `deserialize` ESTAMPE la propiedad. El
 * call-site embargado queda corregido sin editarlo. El primer test de este fichero mide ese
 * mecanismo antes de apoyarse en él ([[control-positivo-no-cubre-la-forma]]: si un día
 * cambiara, todo lo demás pasaría a ser un placebo silencioso).
 *
 * QUÉ SE SIMULA: el `Object.assign` del call-site, replicado aquí. NO se importa `main.ts`
 * (arrastra canvas, fuentes y el `boot()` entero); lo que se sella es la propiedad del
 * OBJETO que `deserialize` devuelve, que es lo único de lo que el call-site depende.
 *
 * NO lee assets: el save mínimo se construye a mano ⇒ tier PURO.
 */
import { describe, expect, it } from "vitest";
import {
  deserialize,
  serialize,
  SAVE_OPTIONAL_DEFAULTS,
  SAVE_OPTIONALS_ABSENCE_MEANS,
  type GameState,
} from "../src/core/state.js";

/** Save v1 MÍNIMO: pasa `assertValidState` y no trae UN SOLO opcional. */
function saveSinOpcionales(): Record<string, unknown> {
  const personaje = {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 100, maxHp: 100, exp: 0, level: 3, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
  return {
    version: 1,
    characters: [personaje],
    partySize: 1,
    activeCharacter: 0,
    food: 200, gold: 100, keys: 0, gems: 0, torches: 0, skullKeys: 0,
    grapple: false, magicCarpets: 0,
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    specialItems: {
      spyglass: false, hmsCape: false, sextant: false,
      pocketWatch: true, blackBadge: false, woodenBox: false,
    },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    moonstones: [],
    karma: 75,
    time: { year: 139, month: 3, day: 5, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 13, floor: 0, x: 15, y: 15 },
    transport: "foot",
    torchTurns: 0,
    npcDead: [], npcMet: [],
    questFlags: {},
    journal: [],
  };
}

/**
 * Valor CONTAMINANTE por campo de lista B: lo que la partida VIVA tendría y que un save
 * temprano no debe heredar. Se elige por campo (no un `1` genérico) para que el valor sea
 * el que su consumidor lee como «estado activo»: fase lunar latcheada válida, hechizo de
 * tiempo puesto, Shadowlord convocado.
 */
const VIVO_CONTAMINANTE: Readonly<Record<string, unknown>> = {
  feluccaPhase: 0x33,          // '3': byte de fase LATCHEADA (isLatchedPhaseByte)
  trammelPhase: 0x35,          // '5': ídem
  timeSpell: "T",              // hechizo de tiempo ACTIVO (para el binario, el peor caso)
  timeSpellTurns: 0xff,        // permanente: el decay no lo baja nunca
  shadowlordSummoned: 0,       // 0 = Falsehood convocado (¡no es «ninguno»!)
  shadowlordHere: 0,           // 0 = Falsehood presente aquí
  chunkOrigin: { x: 48, y: 48 },
  explored: { "0:0:1:1": "x" },
  treasuryLoot: { "17:-1": 3 },
};

/**
 * Valor PRESENTE por campo de lista B, deliberadamente en la frontera falsy (0 / "" /
 * objeto vacío): un save que SÍ trae el campo debe conservarlo aunque su valor sea falsy.
 * Es el filo que muerde si el estampado se hace incondicional.
 */
const PRESENTE_FALSY: Readonly<Record<string, unknown>> = {
  feluccaPhase: 0,
  trammelPhase: 0,
  timeSpell: "",
  timeSpellTurns: 0,
  shadowlordSummoned: 0,
  shadowlordHere: 0,
  chunkOrigin: { x: 0, y: 0 },
  explored: {},
  treasuryLoot: {},
};

/** El merge del call-site embargado (main.ts:392/:2446), replicado. */
function mergeDelCallSite(vivo: Record<string, unknown>, cargado: GameState): Record<string, unknown> {
  Object.assign(vivo, cargado);
  return vivo;
}

/** Un estado VIVO con TODOS los campos de lista B contaminados. */
function estadoVivoContaminado(): Record<string, unknown> {
  const vivo = saveSinOpcionales();
  for (const k of SAVE_OPTIONALS_ABSENCE_MEANS) vivo[k] = VIVO_CONTAMINANTE[k];
  return vivo;
}

describe("M1 lista B — el merge del load mid-sesión ya no arrastra la partida viva", () => {
  it("MECANISMO: Object.assign copia las propiedades own con valor undefined", () => {
    // Todo lo de abajo se apoya en esto. Medirlo aquí es lo que impide que este fichero
    // entero se vuelva un placebo si la semántica cambiara.
    const destino: Record<string, unknown> = { a: 1 };
    Object.assign(destino, { a: undefined });
    expect(destino.a, "Object.assign NO salta el undefined explícito").toBeUndefined();
    expect(Object.hasOwn(destino, "a"), "y la propiedad sigue siendo own").toBe(true);

    // Y el contraste que motiva el arreglo: si el origen NO tiene la propiedad, el destino
    // conserva la suya. Ése es exactamente el bug de M1.
    const otro: Record<string, unknown> = { a: 1 };
    Object.assign(otro, {});
    expect(otro.a, "sin la propiedad en el origen, el destino conserva el valor VIVO").toBe(1);
  });

  it("(a) campo B AUSENTE en el save: tras el merge queda undefined, no el valor VIVO", () => {
    const cargado = deserialize(JSON.stringify(saveSinOpcionales()));
    const fundido = mergeDelCallSite(estadoVivoContaminado(), cargado);

    const heredados = SAVE_OPTIONALS_ABSENCE_MEANS.filter((k) => fundido[k] !== undefined);
    expect(
      heredados,
      "campos de lista B que tras cargar un save TEMPRANO conservan el valor de la partida "
        + "anterior: `deserialize` no estampó la propiedad y `Object.assign` no la copió "
        + "(ficha M1). Un save de la primera hora hereda así «Shadowlord convocado» o la "
        + "fase lunar latcheada de la sesión previa.",
    ).toEqual([]);
  });

  it("(a-bis) el estampado es una propiedad OWN, no sólo un `=== undefined`", () => {
    // La distinción que el test anterior NO puede ver por sí solo: un objeto sin la clave
    // también da `!== undefined` falso. Lo que el merge necesita es la propiedad OWN.
    const cargado = deserialize(JSON.stringify(saveSinOpcionales())) as unknown as object;
    const sinEstampar = SAVE_OPTIONALS_ABSENCE_MEANS.filter((k) => !Object.hasOwn(cargado, k));
    expect(
      sinEstampar,
      "campos de lista B que `deserialize` deja SIN la propiedad own: Object.assign no los "
        + "copia y el merge arrastra la partida viva",
    ).toEqual([]);
  });

  it("(b) campo B PRESENTE (incluido 0 / \"\" / {}): se respeta y pisa el valor VIVO", () => {
    const save = saveSinOpcionales();
    for (const k of SAVE_OPTIONALS_ABSENCE_MEANS) save[k] = PRESENTE_FALSY[k];
    const cargado = deserialize(JSON.stringify(save));
    const fundido = mergeDelCallSite(estadoVivoContaminado(), cargado);

    // `treasuryLoot` NO entra: su migración (task #3) lo borra aunque el save lo traiga —
    // «presente ⇒ se respeta» no rige para un campo RETIRADO. Su comportamiento, que es el
    // contrario, se sella aparte en (e); dejarlo aquí mediría la migración, no el estampado.
    for (const k of SAVE_OPTIONALS_ABSENCE_MEANS.filter((x) => x !== "treasuryLoot")) {
      expect(
        fundido[k],
        `${k}: el save TRAE el campo con valor falsy y el estampado lo ha borrado — el `
          + "estampado tiene que ser CONDICIONAL a la ausencia",
      ).toEqual(PRESENTE_FALSY[k]);
    }
  });

  it("(c) campo A AUSENTE: tras el merge sale el default de fábrica, no el valor VIVO", () => {
    // La clase A no cambia con este carril, pero el merge es donde se cobra: se comprueba
    // aquí, sobre el mismo arnés, para que las dos clases queden medidas por el MISMO filo.
    const acumuladores = Object.keys(SAVE_OPTIONAL_DEFAULTS);
    const vivo = saveSinOpcionales();
    for (const k of acumuladores) vivo[k] = "CONTAMINACIÓN-DE-LA-PARTIDA-VIVA";

    const cargado = deserialize(JSON.stringify(saveSinOpcionales()));
    const fundido = mergeDelCallSite(vivo, cargado);

    const heredados = acumuladores.filter((k) => fundido[k] === "CONTAMINACIÓN-DE-LA-PARTIDA-VIVA");
    expect(heredados, "acumuladores que el merge NO pisó con su default").toEqual([]);

    // Y la clase se distingue: los A salen con VALOR, los B con undefined. Si alguien
    // estampara `undefined` sobre la lista A, esto muerde.
    const aUndefined = acumuladores.filter((k) => fundido[k] === undefined);
    expect(
      aUndefined,
      "acumuladores que han salido undefined: la lista A recibe su valor en REPOSO, no un "
        + "estampado — son dos clases distintas",
    ).toEqual([]);
  });

  it("(d) round-trip serialize→deserialize: el estampado no resucita ninguna clave", () => {
    const cargado = deserialize(JSON.stringify(saveSinOpcionales()));
    const texto = serialize(cargado);

    // JSON.stringify se come las propiedades own con valor undefined: el save re-serializado
    // NO puede llevar las claves de lista B (si las llevara, con `null`, el siguiente load
    // las vería PRESENTES y el estampado ya no se aplicaría).
    const crudo = JSON.parse(texto) as Record<string, unknown>;
    const filtradas = SAVE_OPTIONALS_ABSENCE_MEANS.filter((k) => Object.hasOwn(crudo, k));
    expect(filtradas, "claves de lista B emitidas por serialize tras el estampado").toEqual([]);

    // Y el round-trip completo es idempotente: recargar da el mismo estampado, no otro.
    const recargado = deserialize(texto) as unknown as object;
    for (const k of SAVE_OPTIONALS_ABSENCE_MEANS) {
      expect(Object.hasOwn(recargado, k), `${k}: estampado tras el round-trip`).toBe(true);
      expect((recargado as Record<string, unknown>)[k], `${k}: sigue undefined`).toBeUndefined();
    }
    expect(serialize(recargado as GameState), "el texto es estable en el segundo giro").toBe(texto);
  });

  it("(e) treasuryLoot: la migración lo BORRA y el estampado lo deja retirado en el merge", () => {
    // Caso de orden: `deserialize` hace `delete state.treasuryLoot` (migración task #3). Si
    // el estampado corriera ANTES de la migración, el delete lo desharía y el merge
    // arrastraría el `treasuryLoot` de la partida viva — justo el campo que el ticket retira.
    const save = saveSinOpcionales();
    save.treasuryLoot = { "17:-1": 9 }; // save VIEJO que sí lo trae
    const cargado = deserialize(JSON.stringify(save)) as unknown as Record<string, unknown>;

    expect(cargado.treasuryLoot, "la migración lo borra").toBeUndefined();
    expect(Object.hasOwn(cargado, "treasuryLoot"), "y el estampado lo repone como own").toBe(true);

    const fundido = mergeDelCallSite(estadoVivoContaminado(), cargado as unknown as GameState);
    expect(fundido.treasuryLoot, "el merge retira el campo de la partida viva").toBeUndefined();
  });
});
