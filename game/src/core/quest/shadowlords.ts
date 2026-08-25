/**
 * Los tres Shadowlords — Faulinei de la Mentira (Falsehood), Astaroth del Odio
 * (Hatred) y Nosfentor de la Cobardía (Cowardice) — dominan Britannia mientras
 * Lord British está preso. Cada uno se destruye convocándolo por su nombre en la
 * Llama de su Virtud opuesta (Truth/Love/Courage) y arrojando allí su Shard.
 *
 * EMPAREJAMIENTO DERIVADO (F1.10-T5, CAST.OVL switch 0x1728 del mensaje de doom):
 * Falsehood→Faulinei, Hatred→Astaroth, Cowardice→Nosfentor. La versión previa
 * tenía Astaroth/Nosfentor INTERCAMBIADOS (Redux-ismo); corregido contra el asm.
 *
 * Este módulo es la LÓGICA DE ESTADO del ritual: exige tener el Shard y marca
 * al Shadowlord como destruido. La aparición en pueblos y la escena de la llama
 * se cablean en la fase de integración; aquí vive la regla pura (sin DOM).
 */
import type { GameState } from "../state.js";
import { tf } from "../../i18n/index.js";
import { SHADOWLORDS, shadowlordDeadFlag, type ShadowlordKey } from "./shadowlord-keys.js";

/**
 * Las claves y su orden canónico viven en `shadowlord-keys.ts` —dato sin dependencias— y se
 * RE-EXPORTAN aquí para que nada cambie a quien las importa de este fichero de siempre.
 *
 * 🔴 No las traigas de AQUÍ si lo único que necesitas son las claves: este módulo importa
 * `tf`, y con él entra el catálogo de traducción entero (477 KB de más en el bundle de
 * `/byo`, medido). Importa de `./shadowlord-keys.js`. El porqué, en su cabecera.
 */
export { SHADOWLORDS, shadowlordDeadFlag, type ShadowlordKey };

/**
 * Nombre propio del Shadowlord.
 *
 * 🔴 EXPORTADO, y la razón es un error ya publicado: el catálogo de los momentos legendarios
 * salió a producción con Astaroth y Nosfentor INTERCAMBIADOS — exactamente el «Redux-ismo»
 * que la cabecera de este fichero declara corregido. Se escribió de memoria en vez de leerse
 * de aquí. Ahora `re/tools/test_byo_momentos.py` empareja el nombre que el catálogo pone en
 * el título contra ESTA tabla, en los dos idiomas. Exportarla es lo que impide que la guarda
 * tenga una COPIA: una segunda tabla sería un segundo sitio donde equivocarse, y esta ficha
 * demuestra que ese sitio se usa.
 */
export const SHADOWLORD_INFO: Record<ShadowlordKey, { name: string }> = {
  falsehood: { name: "Faulinei" },
  hatred: { name: "Astaroth" },
  cowardice: { name: "Nosfentor" },
};
/**
 * DOMINIO del Shadowlord (el nombre del Shard, para el mensaje del ritual): DATA.OVL
 * DS 0x8D18/0x8D24/0x8D2E. Const plana (no `capitalize` en runtime) para que la guarda
 * anti-fab la VEA (extract-user-strings `DISPLAY_CONSTS`) y `es.json` la traduzca
 * (Falsedad/Odio/Cobardía). `i18n` lo pasa por `t()` en el `tf()` del mensaje.
 */
const SHADOWLORD_DOMAIN: Record<ShadowlordKey, string> = {
  falsehood: "Falsehood",
  hatred: "Hatred",
  cowardice: "Cowardice",
};
/**
 * LLAMA de la Virtud opuesta donde se arroja el Shard: FLAME_NAME DS 0x4831±. Igual
 * que arriba, const plana + allowlist para traducir (la Llama de la Verdad/del Amor/
 * del Coraje) por su string inglés.
 */
const FLAME_NAME: Record<ShadowlordKey, string> = {
  falsehood: "the Flame of Truth",
  hatred: "the Flame of Love",
  cowardice: "the Flame of Courage",
};

/** ¿Está muerto este Shadowlord? */
export function shadowlordDead(state: GameState, which: ShadowlordKey): boolean {
  return state.questFlags[shadowlordDeadFlag(which)] === true;
}

/** Shadowlords que aún caminan por Britannia. */
export function shadowlordsAlive(state: GameState): ShadowlordKey[] {
  return SHADOWLORDS.filter((k) => !shadowlordDead(state, k));
}

export interface DestroyResult {
  ok: boolean;
  message: string;
}

/**
 * Destruye a un Shadowlord en su Llama de la Verdad. Requiere poseer su Shard
 * (`state.shards[which] === true`). Sin el Shard, el ritual no puede obrarse.
 * Idempotente: si ya estaba muerto, ok con aviso.
 */
export function destroyShadowlord(state: GameState, which: ShadowlordKey): DestroyResult {
  const info = SHADOWLORD_INFO[which];
  if (shadowlordDead(state, which)) {
    return { ok: true, message: tf("{} is already no more.", info.name) };
  }
  if (state.shards[which] !== true) {
    return {
      ok: false,
      message: tf("Without the Shard of {}, {} cannot be undone.", SHADOWLORD_DOMAIN[which], info.name),
    };
  }
  state.questFlags[shadowlordDeadFlag(which)] = true;
  return {
    ok: true,
    message: tf(
      "Thou dost cast the Shard of {} into {}! {} shrieks and is consumed utterly — one Shadowlord falls.",
      SHADOWLORD_DOMAIN[which],
      FLAME_NAME[which],
      info.name,
    ),
  };
}

/** Doom (y el rescate de Lord British) sólo es alcanzable con los 3 muertos. */
export function canReachDoom(state: GameState): boolean {
  return shadowlordsAlive(state).length === 0;
}
