/**
 * FIXTURE de los mensajes DS 0xB21E para las suites que ejercitan las escenas que los
 * imprimen (refuge, captura de Blackthorn, aparición de acampada, Códice).
 *
 * En el juego los instala el arranque (`main.ts`) tras `fetchJson`; en vitest no hay
 * arranque, así que cada suite que abra una de esas escenas los instala aquí. Va con
 * `describeConAssets(["ds-strings.json"], …)`, que es lo que hace que en el árbol
 * PÚBLICO el bloque se salte con motivo visible en vez de romper (`assets-opcionales.ts`).
 *
 * 🔴 NO se cachea entre ficheros a propósito: `instalaDsStrings` escribe en un módulo
 * compartido y vitest aísla por fichero, así que cada suite tiene que instalarlo en su
 * propio `beforeAll`. Un helper "instala una vez" pasaría en la corrida completa y
 * fallaría al correr el fichero SOLO — que es justo como se corre un test al depurarlo.
 */
import { beforeAll } from "vitest";
import { instalaDsStrings, olvidaDsStrings, type DsStrings } from "../src/core/data/ds-strings.js";
import { leeAsset } from "./assets-opcionales.js";

/** El asset que estas suites necesitan (para el `describeConAssets` del llamador). */
export const DS_STRINGS = "ds-strings.json";

let memo: DsStrings | null = null;

/**
 * Lee el asset extraído de la copia del juego de quien corre los tests.
 *
 * 🔴 PEREZOSA Y MEMOIZADA, y las dos cosas por un motivo medido: `describe.skip` EJECUTA
 * su cuerpo al recolectar (`assets-opcionales.ts`), así que una lectura en carga de
 * módulo —o en el cuerpo de un `describeConAssets`— seguiría lanzando ENOENT en el árbol
 * público y tumbaría el FICHERO ENTERO en colección, incluidos los `it` puros. Llámala
 * desde dentro de un `it` (o de un `beforeAll`), nunca al nivel del módulo.
 */
export function dsStringsDeAsset(): DsStrings {
  if (memo === null) memo = leeAsset<DsStrings>(DS_STRINGS);
  return memo;
}

/** Un record concreto, para escribir esperados sin repetir el índice de fichero. */
export function dsRecordDeAsset(file: keyof DsStrings, idx: number): string {
  const r = dsStringsDeAsset()[file][idx];
  if (typeof r !== "string") throw new Error(`${String(file)} rec${idx} no está en el asset`);
  return r;
}

/**
 * Instala los mensajes antes de la suite y los desinstala al acabar. El `olvida` no es
 * higiene decorativa: sin él, un fichero que instala dejaría el registro puesto para
 * cualquier otro del mismo worker, y un test que DEBE fallar por asset ausente
 * (`ds-strings-fidelidad`) pasaría en la corrida completa y fallaría a solas.
 */
export function conDsStrings(): void {
  beforeAll(() => {
    instalaDsStrings(dsStringsDeAsset());
    return () => olvidaDsStrings();
  });
}
