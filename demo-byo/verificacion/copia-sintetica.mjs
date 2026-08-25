/**
 * UNA COPIA SINTÉTICA del juego: lo justo para que la galería de momentos pueda componer un
 * save, y ni una cadena de EA.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────
 * La sonda de navegador de los momentos tiene que ejercitar el circuito ENTERO —descargar la
 * base, componer, hornear, importar, sembrar y pintar—, y ese circuito empieza pidiendo
 * `/assets/init.gam` y `/assets/initial-state.json`, que son la extracción de LA COPIA DEL
 * VISITANTE. Con la copia de verdad, la sonda dependería de `game/assets` (gitignored) y
 * quedaría FUERA de la batería, como `verifica-estados.mjs` declara de sí misma.
 *
 * Con esto entra: el roster de aquí son 16 registros con nombres de UNA LETRA y cifras
 * redondas, y la plantilla son 4192 bytes a cero. Es la misma decisión —y por la misma
 * razón— que los estados sintéticos de `verifica-tarjeta.mjs`.
 *
 * 🔴 Y EL REPARTO DE ALCANCE, que es lo que hay que leer antes de fiarse de esto: lo
 * sintético sirve para medir el CIRCUITO (que el botón siembre, que la insignia salga, que
 * «Añadido ✓» sobreviva a la recarga). NO sirve para medir los DATOS del momento: que la
 * casa de Iolo sea la loc 13 y el reloj marque las 8:35 sale de la copia de verdad, y eso lo
 * mide `re/tools/test_byo_momentos.py` sobre `game/assets`. Dos instrumentos, dos preguntas;
 * confundirlos daría un verde que no afirma lo que parece.
 */

/** 4192 B — el tamaño de SAVED.GAM/INIT.GAM (`saveNative.ts:38 SAVED_GAM_SIZE`). */
export const TAM_GAM = 0x1060;

/**
 * Un registro de roster. Todos los campos que `serializeCharacter` escribe
 * (`saveNative.ts:211`): si faltara uno saldría `NaN` en un byte y el fallo aparecería
 * lejos, al releer.
 */
function pj(nombre, dentro) {
  return {
    name: nombre,
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 100,
    maxHp: 100,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0,
    armor: 0,
    weapon: 0,
    shield: 0,
    ring: 0,
    amulet: 0,
    partyStatus: dentro ? 0x00 : 0xff,
  };
}

const ceros = (n) => Array.from({ length: n }, () => 0);
const rejilla = () => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false));

/**
 * `ExtractedInitialState` sintético. Los valores NO son los de Ultima V y no pretenden
 * serlo: el parche del momento escribe encima todo lo que afirma, y lo que no afirma se
 * hereda — que es exactamente lo que esta sonda no mide (ver la cabecera).
 */
export function initSintetico() {
  const letras = "ABCDEFGHIJKLMNOP".split("");
  return {
    characters: letras.map((l, i) => pj(l, i === 0)),
    food: 10,
    gold: 100,
    keys: 0,
    gems: 0,
    torches: 0,
    grapple: false,
    magicCarpets: 0,
    skullKeys: 0,
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    specialItems: {
      spyglass: false, hmsCape: false, sextant: false,
      pocketWatch: false, blackBadge: false, woodenBox: false,
    },
    equipmentQuantities: ceros(48),
    spellQuantities: ceros(48),
    scrollQuantities: ceros(8),
    potionQuantities: ceros(8),
    reagentQuantities: ceros(8),
    moonstones: ceros(8).map(() => ({ x: 0, y: 0, buried: true, z: 0 })),
    partySize: 1,
    year: 100,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    karma: 50,
    turnsSinceStart: 0,
    activeCharacter: 0xff,
    location: 1,
    floor: 0,
    x: 1,
    y: 1,
    torchTurns: 0,
    npcDead: rejilla(),
    npcMet: rejilla(),
  };
}

/** La plantilla de 4192 B. A CERO: sin bytes oscuros que preservar, no hay nada de EA. */
export function plantillaSintetica() {
  return new Uint8Array(TAM_GAM);
}
