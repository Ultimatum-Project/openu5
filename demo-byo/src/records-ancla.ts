/**
 * EL ANCLA DE UN RÉCORD: identificarla al subir, y RECONSTRUIRLA al verificar.
 *
 * 🔴 CHUNK APARTE Y POR `import()`, como `minimapa.ts`, `iconos.ts` y `momentos-instala.ts`:
 * arrastra el modelo del juego entero (`state.ts` + `saveNative.ts` + `compone.ts`). Quien
 * sólo mira la tabla de récords no paga un byte de esto.
 *
 * ── LAS DOS OPERACIONES, Y POR QUÉ SON LA MISMA ─────────────────────────────────────────
 *   SUBIR    — ¿de qué partida arranca esta repetición mía? Se compone cada momento desde
 *              MI copia y se compara la huella con la del ancla grabada. Si ninguna casa, la
 *              repetición NO se puede subir: su estado inicial sólo existe en mi máquina, y
 *              enviarlo sería enviar datos derivados de mis ficheros de EA.
 *   VERIFICAR — me bajo un récord ajeno, compongo SU momento desde MI copia, y con eso
 *              reconstruyo una repetición local completa. Reproducirla es la prueba.
 *
 * Las dos son «componer el momento desde la copia del visitante y hashear». Por eso viven
 * juntas: si la composición de subir y la de verificar divergieran, la tabla acusaría de
 * falso a un récord honesto.
 *
 * ── LA HUELLA ES DE UNA FORMA CANÓNICA, NO DE `JSON.stringify` ──────────────────────────
 * 🔴 `JSON.stringify` conserva el ORDEN DE INSERCIÓN de las claves. Dos objetos con los
 * mismos datos construidos por caminos distintos dan cadenas distintas y, por tanto, hashes
 * distintos: la huella diría «arrancas de otro sitio» sobre dos estados idénticos. Se hashea
 * `canonizaJSON`, que ordena las claves recursivamente.
 */
import type { ExtractedInitialState } from "../../game/src/core/state.js";
import { horneaMomento, importaMomento } from "../../game/src/momentos/compone.js";
import { momentosDisponibles, momentoPorId } from "../../game/src/momentos/defs.js";
import { SAVED_GAM_SIZE } from "../../game/src/core/saveNative.js";
import { saveLog } from "../../game/src/replay/store.js";
import type { ReplayLog } from "../../game/src/replay/types.js";
import { sha256Hex, type RecordSubida } from "./records-formato.js";

/** La copia del visitante: lo mínimo para componer cualquier momento. */
interface BaseVisitante {
  init: ExtractedInitialState;
  plantilla: Uint8Array;
}

/**
 * Se lee UNA vez por sesión (son ~22 KB que no cambian mientras la extracción sea la misma).
 *
 * ⚠ Esto repite las seis líneas de `leeBase()` de `momentos-instala.ts` a propósito: allí es
 * privada, y exportarla sería editar un fichero de otro carril para ganar seis líneas. Las
 * DOS rutas piden los mismos dos ficheros al mismo service worker; si algún día una cambia,
 * el test de esta (`records-ancla.test.ts`) mide la composición, no la descarga.
 */
let base: Promise<BaseVisitante> | null = null;

/** «Este navegador no tiene la copia extraída»: sin ella no hay ancla que componer. */
export class SinCopia extends Error {
  constructor() {
    super("sin extracción en este navegador");
    this.name = "SinCopia";
  }
}

async function leeBase(): Promise<BaseVisitante> {
  const [rInit, rGam] = await Promise.all([
    fetch("/assets/initial-state.json"),
    fetch("/assets/init.gam"),
  ]);
  if (!rInit.ok || !rGam.ok) throw new SinCopia();
  const init = (await rInit.json()) as ExtractedInitialState;
  const plantilla = new Uint8Array(await rGam.arrayBuffer());
  if (plantilla.length < SAVED_GAM_SIZE) {
    throw new Error(`init.gam de ${plantilla.length} B (esperados ${SAVED_GAM_SIZE})`);
  }
  return { init, plantilla };
}

async function baseVisitante(): Promise<BaseVisitante> {
  base ??= leeBase();
  try {
    return await base;
  } catch (e) {
    base = null; // un fallo no se cachea: soltar la carpeta y reintentar tiene que funcionar
    throw e;
  }
}

/**
 * JSON con las claves ORDENADAS recursivamente. Es la forma que se hashea.
 *
 * Los arrays NO se ordenan —su orden es dato, no presentación— y `undefined` desaparece,
 * igual que en `JSON.stringify`, para que canonizar un objeto y volver a leerlo sea estable.
 */
export function canonizaJSON(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canonizaJSON).join(",")}]`;
  const o = v as Record<string, unknown>;
  const partes: string[] = [];
  for (const k of Object.keys(o).sort()) {
    if (o[k] === undefined) continue;
    partes.push(`${JSON.stringify(k)}:${canonizaJSON(o[k])}`);
  }
  return `{${partes.join(",")}}`;
}

/** Huella de un estado serializado (`ReplayAnchor.state`, que es un JSON de GameState). */
export async function huellaDeEstado(estadoJson: string): Promise<string> {
  return sha256Hex(canonizaJSON(JSON.parse(estadoJson)));
}

/**
 * El ESTADO de un momento compuesto desde la copia de ESTE visitante, ya serializado.
 *
 * Es el mismo camino que usa la galería para sembrarlo (`siembraMomento`): parche + copia →
 * bytes nativos → de vuelta. Se calca el camino entero y no un atajo porque el ancla tiene
 * que ser el estado que el juego REALMENTE carga, no uno equivalente.
 */
export async function estadoDeMomento(momentoId: string): Promise<string> {
  const def = momentoPorId(momentoId);
  if (!def) throw new Error(`momento desconocido: ${momentoId}`);
  const b = await baseVisitante();
  return JSON.stringify(importaMomento(horneaMomento(def, b.init, b.plantilla)));
}

/**
 * ¿De qué momento arranca esta repetición? `null` = de ninguno que este navegador pueda
 * componer.
 *
 * 🔴 «NULL» NO ES UN FALLO, ES LA RESPUESTA CORRECTA para una repetición grabada a media
 * partida — que es la mayoría. Quien llame a esto pinta el porqué, no un error: subirla
 * exigiría enviar su estado inicial, y ahí dentro van los 16 registros del roster de
 * `INIT.GAM` (ver `records-formato.ts`). La repetición sigue siendo suya y sigue
 * reproduciéndose en local; lo que no puede es ir a una tabla pública.
 */
export async function identificaBase(log: ReplayLog): Promise<{ id: string; huella: string } | null> {
  const huella = await huellaDeEstado(log.anchor.state);
  for (const def of momentosDisponibles()) {
    let candidato: string;
    try {
      candidato = await estadoDeMomento(def.id);
    } catch (e) {
      if (e instanceof SinCopia) throw e; // sin copia no se puede decidir NADA: no es «no»
      continue; // un momento que no compone no descalifica a los demás
    }
    if ((await huellaDeEstado(candidato)) === huella) return { id: def.id, huella };
  }
  return null;
}

/** Lo que sale de reconstruir un récord ajeno para poder reproducirlo aquí. */
export interface Reconstruido {
  /** Id del `ReplayLog` que se acaba de guardar en ESTE navegador. */
  idLocal: string;
  /**
   * ¿La huella del ancla que yo he compuesto coincide con la que publicó quien subió?
   *
   * `true` = arrancamos exactamente del mismo estado, así que una divergencia al reproducir
   * sería del MOTOR, no del punto de partida. `false` = mi copia compone otra cosa (otra
   * versión del port, otra extracción); la repetición se puede ver igual, pero lo que se vea
   * ya no prueba el récord y la pantalla lo dice.
   */
  huellaCoincide: boolean;
}

/**
 * Convierte un récord descargado en una repetición LOCAL, componiendo su ancla desde la
 * copia de este visitante, y la guarda en IndexedDB.
 *
 * 🔴 SE GUARDA COMO UNA REPETICIÓN NORMAL, y eso es lo que hace que «ver repetición» de un
 * récord ajeno pase por EL MISMO CAMINO que una tuya: `abreReplay(id)` → el popover →
 * `/play.html?replay=<id>` → `getLog` de IndexedDB. No hay una segunda vía de reproducción
 * que pudiera comportarse distinto — que es justo lo que arruinaría la verificación entre
 * pares: un récord que «se ve bien» por un camino que no es el del juego no prueba nada.
 *
 * El id lleva prefijo `remoto-` para que se distinga de las grabaciones propias en la lista.
 */
export async function reconstruyeRecord(rec: RecordSubida, id: string): Promise<Reconstruido> {
  const estado = await estadoDeMomento(rec.base.id);
  const huellaCoincide = (await huellaDeEstado(estado)) === rec.anclaHash;
  const idLocal = `remoto-${id}`;
  const log: ReplayLog = {
    v: 1,
    id: idLocal,
    label: `${rec.alias} · ${rec.lastTurn}`,
    createdAt: Date.now(), // reloj LOCAL: es cuándo lo trajiste, no cuándo se grabó
    anchor: { state: estado, seed: rec.semilla },
    keys: rec.keys,
    turns: rec.turns,
    mods: rec.mods,
    count: rec.count,
    lastTurn: rec.lastTurn,
  };
  await saveLog(log);
  return { idLocal, huellaCoincide };
}
