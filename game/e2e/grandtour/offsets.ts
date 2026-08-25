/**
 * Grand Tour — LAYOUT del SAVED.GAM nativo (fuente única de los offsets de checkpoint
 * para TODOS los capítulos del tour).
 *
 * Antes cada spec de capítulo inlineaba su propia tabla `OFF` (deuda #3 de la review de
 * ch01): a ×19 la misma tabla se duplicaría 19 veces y podría DIVERGIR entre capítulos o
 * quedar desincronizada del codec. Este módulo la centraliza: un cambio de layout del
 * .GAM se toca AQUÍ, no en 19 ficheros.
 *
 * ALINEADO con `game/src/core/saveNative.ts` (`parseCharacter`/`serializeCharacter` +
 * `parseSaveWindow`/`exportNativeSave`). Se mantiene como CONSTANTES PURAS sin imports a
 * propósito: importar `saveNative.ts` aquí arrastraría `state.ts` (runtime del juego) al
 * contexto Node de Playwright — el mismo motivo por el que `fixture.ts` no lo importaba.
 * La guarda anti-deriva de que estos números siguen casando con el codec es el ROUND-TRIP
 * byte-exacto de la spec (`importNativeSave → exportNativeSave = 0 diffs`): si un offset
 * aquí divergiera del codec, ese test se pondría rojo.
 */

/** Tamaño íntegro del SAVED.GAM nativo (`saveNative.SAVED_GAM_SIZE = 0x1060` = 4192 B). */
export const SAVED_GAM_SIZE = 0x1060;

/** Base del registro `roster[0]` y tamaño de registro (saveNative: base 0x02, size 0x20). */
export const ROSTER_BASE = 0x02;
export const ROSTER_RECORD_SIZE = 0x20;

/**
 * Offsets de campo DENTRO de un registro de personaje (saveNative.parseCharacter).
 * Relativos a la base del registro; combínalos con `charFieldOff(n, field)`.
 */
export const CHAR = {
  name: 0x00, // fixedString de 9 bytes
  gender: 0x09,
  class: 0x0a,
  status: 0x0b,
  strength: 0x0c,
  dexterity: 0x0d,
  intelligence: 0x0e,
  mp: 0x0f, // currentMp (u8)
  hp: 0x10, // currentHp (u16le)
  maxHp: 0x12, // u16le
  exp: 0x14, // u16le
  level: 0x16,
} as const;

/** Base absoluta del registro `roster[n]` dentro del .GAM. */
export const rosterBase = (n: number): number => ROSTER_BASE + n * ROSTER_RECORD_SIZE;

/** Offset absoluto de un campo de `roster[n]` (p.ej. `charFieldOff(0, "strength") === 0x0e`). */
export const charFieldOff = (n: number, field: keyof typeof CHAR): number =>
  rosterBase(n) + CHAR[field];

/**
 * Globals de partida en el .GAM (saveNative: `exportNativeSave`/`parseSaveWindow`).
 * karma resuelto a 0x2e2 (autoridad `saveNative.ts`; el "0x2E3?" del memo era el
 * interrogante, no el valor — confirmado por la review de ch01).
 */
export const PARTY = {
  karma: 0x2e2,
  location: 0x2ed,
  floor: 0x2ef,
  x: 0x2f0,
  y: 0x2f1,
} as const;

/** Número de registros del roster en la ventana del .GAM (slots 0..15). */
export const ROSTER_SLOT_COUNT = 16;

/**
 * ROSTER SINTÉTICO (#228) — nombres INVENTADOS para los slots 1..15 de los SELLOS
 * commiteados. El roster de `INIT.GAM` (nombre+clase+stats+equipo de los 15 companions)
 * es material de EA y la REGLA 4 del CLAUDE.md prohíbe que viaje en ficheros tracked;
 * los sellos del tour son snapshots del juego, así que sus nombres se sobrescriben con
 * éstos ANTES de comparar/escribir (ver `anonymizeRosterNames` y su único llamador,
 * `fixture.ts:exportCheckpoint`). El slot 0 es el JUGADOR («Avatar», tecleado en la
 * creación de ch01): no es material de EA y NO se toca.
 *
 * Restricción dura: ≤8 caracteres ASCII (el campo es un fixedString de 9 bytes con
 * terminador; `anonymizeRosterNames` sobrescribe los 9 bytes ENTEROS para que el
 * transform sea determinista e idempotente venga la cola del campo como venga).
 */
export const SYNTHETIC_ROSTER_NAMES: readonly string[] = [
  "Aldric", "Berin", "Cedra", "Dorn", "Elwin", // slots 1..5
  "Fara", "Galen", "Hesta", "Ivo", "Kessa", // slots 6..10
  "Lorne", "Merek", "Nima", "Orrin", "Pell", // slots 11..15
] as const;

/**
 * Sobrescribe IN PLACE los 9 bytes del campo `name` de los slots 1..15 con el roster
 * sintético (nombre ASCII + relleno NUL). PURO e IDEMPOTENTE: aplicado a un export cuyo
 * estado ya venía de un sello anonimizado produce exactamente los mismos bytes, así que
 * la cadena VERIFY (export byte-idéntico al sello commiteado) no se entera. La conducta
 * del juego no depende de estos bytes (los nombres son presentación; el tour jamás
 * ejecuta JoinParty — «roster INTACTO» — y ningún spec aserta nombres de slots ≥1).
 * La guarda de árbol que exige que NINGÚN `.gam` tracked lleve el roster de EA es
 * `re/tools/test_gam_sin_roster_ea.py`.
 */
export function anonymizeRosterNames(gam: Uint8Array): Uint8Array {
  const FIELD_LEN = 9;
  for (let slot = 1; slot < ROSTER_SLOT_COUNT; slot++) {
    const name = SYNTHETIC_ROSTER_NAMES[slot - 1]!;
    const off = charFieldOff(slot, "name");
    for (let i = 0; i < FIELD_LEN; i++) {
      gam[off + i] = i < name.length ? name.charCodeAt(i) & 0x7f : 0;
    }
  }
  return gam;
}
