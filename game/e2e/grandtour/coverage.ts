/**
 * Grand Tour — acumulador de COBERTURA por capítulo (spec §1.3 + §2 punto 4).
 *
 * Cada capítulo del tour declara qué ítems del `manifest.json` (F3-T1, 742 ítems
 * de contenido enumerable en 25 categorías tras la fusión post-adjudicación daf75d1)
 * cubre AL JUGARLOS, y emite `covered.<chapter>.json`. El capítulo 19 importa esos
 * ficheros + el manifiesto y asserta `covered === manifest` o enumera el hueco (spec
 * §1.3). Este helper es el mecanismo compartido para ese marcado — ch01 es el PATRÓN
 * de los 18 capítulos siguientes.
 *
 * ANTI-FABRICACIÓN. `mark(id)` EXIGE que el id exista en `manifest.json`; un id
 * inventado (typo, o cobertura reclamada sin respaldo del manifiesto generado de
 * datos) LANZA. Así la cobertura no puede divergir del manifiesto por descuido, en
 * la misma línea que la guarda anti-deriva del propio manifiesto (F3-T1).
 *
 * DETERMINISMO. La salida NO lleva timestamp: `covered.<chapter>.json` va COMMITEADO
 * y debe ser estable entre corridas (igual que `manifest.json`), para que un cambio
 * en cobertura sea un diff legible y no ruido por-corrida.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, "manifest.json");

// MODO DE SELLADO — mismo signo que fixture.ts (derivado de U5_TOUR_WORKERS):
//  · serial (workers<=1) → RE-SELLADO: write() reescribe covered.<ch>.json como siempre.
//  · paralelo (workers>1) → VERIFY: write() NO reescribe; aserta que la cobertura calculada
//    == la commiteada. Así un capítulo que FALLE en paralelo (p.ej. contexto destruido) NO
//    puede MUTILAR el covered.<ch>.json commiteado con una cobertura parcial — o coincide, o
//    lanza señalando re-sello serial. Consistente con el gate de saves/ en exportCheckpoint.
const RESEAL = Number(process.env.U5_TOUR_WORKERS ?? "1") <= 1;

interface ManifestItem {
  id: string;
  category: string;
  name: string;
  source: string;
  reachableBy: string | null;
}

let manifestIds: Set<string> | null = null;
function loadManifestIds(): Set<string> {
  if (manifestIds === null) {
    // El manifiesto fusionado (daf75d1) es un ARRAY de ítems en el nivel raíz. Se
    // tolera también la forma `{ items: [...] }` por si un esquema previo reaparece.
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as
      | ManifestItem[]
      | { items: ManifestItem[] };
    const items = Array.isArray(raw) ? raw : raw.items;
    manifestIds = new Set(items.map((i) => i.id));
  }
  return manifestIds;
}

export interface CoverageFile {
  chapter: string;
  coveredIds: string[];
  notes: string[];
}

/**
 * Acumula ids del manifiesto cubiertos por un capítulo y los persiste a
 * `covered.<chapter>.json` (junto al manifiesto). Los ids se validan contra el
 * manifiesto al marcarlos y se escriben ORDENADOS (salida determinista).
 */
export class Coverage {
  private readonly ids = new Set<string>();
  private readonly notes: string[] = [];

  constructor(public readonly chapter: string) {}

  /** Marca un id del manifiesto como cubierto. Lanza si el id no existe en él. */
  mark(id: string): this {
    if (!loadManifestIds().has(id)) {
      throw new Error(
        `Coverage.mark("${id}"): ese id NO existe en manifest.json. ` +
          `La cobertura sólo puede referir ítems del manifiesto generado de datos ` +
          `(¿typo, o categoría/índice cambiado por regeneración del manifiesto?).`,
      );
    }
    this.ids.add(id);
    return this;
  }

  markAll(ids: readonly string[]): this {
    for (const id of ids) this.mark(id);
    return this;
  }

  /** Anota una nota humana (p.ej. por qué un capítulo cubre 0 ítems). */
  note(text: string): this {
    this.notes.push(text);
    return this;
  }

  /** Serializa el fichero de cobertura (sin escribir), ORDENADO y determinista. */
  toJSON(): CoverageFile {
    return {
      chapter: this.chapter,
      coveredIds: [...this.ids].sort(),
      notes: this.notes,
    };
  }

  /**
   * Persiste `covered.<chapter>.json` (serial/reseal) o VERIFICA contra lo commiteado
   * (paralelo) — ver constante RESEAL. Devuelve la ruta en ambos casos (el llamador la
   * relee para asertar el conteo; en VERIFY relee el fichero commiteado, intacto).
   */
  write(): string {
    const path = join(HERE, `covered.${this.chapter}.json`);
    const out = JSON.stringify(this.toJSON(), null, 2) + "\n";
    if (RESEAL) {
      writeFileSync(path, out);
      return path;
    }
    // VERIFY (paralelo): no reescribe; aserta byte-identidad contra el sello commiteado.
    if (!existsSync(path)) {
      throw new Error(
        `Coverage.write("${this.chapter}"): falta covered.${this.chapter}.json en modo ` +
          `paralelo (VERIFY). Un capítulo NUEVO se sella serial: U5_TOUR_WORKERS=1.`,
      );
    }
    const committed = readFileSync(path, "utf8");
    if (committed !== out) {
      throw new Error(
        `Coverage.write("${this.chapter}"): la cobertura calculada difiere de covered.` +
          `${this.chapter}.json commiteado en modo paralelo (VERIFY). Re-sella serial: ` +
          `U5_TOUR_WORKERS=1.`,
      );
    }
    return path;
  }
}
