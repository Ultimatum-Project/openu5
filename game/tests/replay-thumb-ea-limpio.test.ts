/**
 * MINIATURAS DE REPETICIÓN — las DOS invariantes que no se ven mirando la pantalla.
 *
 * Una miniatura son PÍXELES RENDERIZADOS del juego, o sea material derivado de EA. La
 * entrega la mete en el navegador del visitante (almacén `thumbs` de la base
 * `u5-replay`), y este fichero guarda las dos cosas que una captura de pantalla NO
 * puede enseñar:
 *
 *   §A  QUE NO SE PUEDA SUBIR. El validador de récords es default-deny, así que hoy
 *       rechaza el campo por no estar en la lista. Eso es cierto POR ACCIDENTE de un
 *       diseño ajeno: si mañana alguien añade `thumb` a `CLAVES` creyendo que es un
 *       adorno inocente, estará abriendo la puerta a que salgan fotogramas de EA del
 *       navegador de alguien. Este test se pone rojo ese día.
 *
 *   §B  QUE NO ENTRE EN EL `ReplayLog`. La miniatura vive en almacén APARTE, y no es
 *       una preferencia de estilo: `ReplayMeta.bytes` se calcula como los bytes UTF-8
 *       del registro serializado y la lista del juego lo ENSEÑA como lo que cuesta
 *       guardar tu partida. Con la foto dentro (13,4 KB medidos, frente a los ~11 KB de
 *       una repetición corta) esa cifra se dobla y SIGUE SIENDO LITERALMENTE CIERTA —
 *       la peor clase de cifra falsa. Quien mueva la miniatura al registro «para
 *       simplificar» rompe una cifra que se publica, sin que nada más se queje.
 *
 * Lo que este fichero NO cubre, y por qué: el comportamiento REAL del almacén (que la
 * foto se guarde al parar, que el borrado la barra, que la lista degrade con su hueco)
 * necesita IndexedDB y un canvas con el juego dentro. Eso vive en
 * `game/tools/verify-replay-thumbs.mjs`, FUERA de la batería porque necesita chromium y
 * `game/assets` (material de EA, gitignored) — mismo criterio que
 * `verify-boot-save-replay.mjs`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORMATO_RECORD, validaRecord, type RecordSubida } from "../../demo-byo/src/records-formato.js";
import { encodeEvents } from "../src/replay/codec.js";
import type { ReplayEvent } from "../src/replay/types.js";

const SRC = join(__dirname, "..", "src");

/**
 * Un dataURL PNG con la FORMA de una miniatura real. No es un fotograma del juego —en un
 * fichero tracked no puede haberlo— y no le hace falta serlo: lo que se prueba es que el
 * validador rechaza EL CAMPO, y para eso el contenido da igual mientras la cabecera
 * `data:image/png;base64,` esté, que es lo único que un revisor humano miraría.
 */
const MINIATURA_FALSA = "data:image/png;base64," + "Q".repeat(2048);

function recordValido(): RecordSubida {
  const evs: ReplayEvent[] = [];
  let turno = 0;
  for (let i = 0; i < 40; i++) {
    if (i % 3 !== 0) turno += 1;
    evs.push({ key: ["ArrowUp", "ArrowRight", "k", "z"][i % 4]!, turn: turno });
  }
  const s = encodeEvents(evs);
  return {
    v: FORMATO_RECORD,
    alias: "Kokoima",
    base: { tipo: "momento", id: "01-fuga" },
    anclaHash: "a".repeat(64),
    semilla: 12345,
    keys: s.keys,
    turns: s.turns,
    mods: s.mods,
    count: evs.length,
    lastTurn: evs[evs.length - 1]!.turn,
    motor: "20bd4ebb",
    desenlaceReclamado: false,
  };
}

describe("§A · una miniatura NO puede viajar en un récord", () => {
  it("CONTROL: el mismo récord SIN miniatura pasa", () => {
    // Sin esto, los rechazos de abajo no probarían nada: un validador que rechazara
    // TODO los pasaría igual. El control es lo que ata el rechazo AL CAMPO AÑADIDO.
    expect(validaRecord(JSON.parse(JSON.stringify(recordValido()))).ok).toBe(true);
  });

  it("rechaza el récord con una miniatura colgada, y NOMBRA el campo", () => {
    const con = { ...recordValido(), thumb: MINIATURA_FALSA };
    const v = validaRecord(JSON.parse(JSON.stringify(con)));
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.motivo).toContain("thumb");
  });

  it("lo rechaza se llame como se llame — no hay nombre de campo bendecido", () => {
    // El default-deny tiene que aguantar a quien lo intente con otro nombre: la lista
    // blanca no crece por sinónimos.
    for (const nombre of ["png", "shot", "miniatura", "captura", "imagen", "preview"]) {
      const v = validaRecord(JSON.parse(JSON.stringify({ ...recordValido(), [nombre]: MINIATURA_FALSA })));
      expect(v.ok, `el campo ${nombre} NO fue rechazado`).toBe(false);
      expect(v.ok === false && v.motivo).toContain(nombre);
    }
  });

  it("tampoco anidada dentro de `base`, que es el otro objeto que llega del cliente", () => {
    const con = { ...recordValido(), base: { tipo: "momento", id: "01-fuga", shot: MINIATURA_FALSA } };
    const v = validaRecord(JSON.parse(JSON.stringify(con)));
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.motivo).toContain("shot");
  });
});

describe("§B · la miniatura vive FUERA del ReplayLog (o `bytes` mentiría)", () => {
  const types = readFileSync(join(SRC, "replay", "types.ts"), "utf8");
  const store = readFileSync(join(SRC, "replay", "store.ts"), "utf8");

  /** El cuerpo de `interface ReplayLog { … }`, que es lo que se serializa y se mide. */
  function cuerpoReplayLog(): string {
    const i = types.indexOf("export interface ReplayLog");
    expect(i, "no se encontró la interfaz ReplayLog en types.ts").toBeGreaterThan(-1);
    const abre = types.indexOf("{", i);
    const cierra = types.indexOf("\n}", abre);
    return types.slice(abre, cierra);
  }

  it("CONTROL: el extractor coge el bloque BUENO (ve campos que sí están)", () => {
    // Si el recorte fallara y devolviera cadena vacía, la comprobación de abajo pasaría
    // por vacuidad — verde con la propiedad rota, que es justo lo que hay que evitar.
    const cuerpo = cuerpoReplayLog();
    for (const campo of ["keys", "turns", "mods", "anchor", "count", "lastTurn"]) {
      expect(cuerpo, `el recorte no ve el campo ${campo}`).toContain(campo);
    }
  });

  it("ReplayLog no tiene ningún campo de imagen", () => {
    const cuerpo = cuerpoReplayLog();
    // Se miran los NOMBRES DE CAMPO declarados, no la prosa: los comentarios de esa
    // interfaz hablan de miniaturas a propósito y un `includes` sobre el bloque entero
    // se pondría rojo por la explicación en vez de por el código.
    const campos = [...cuerpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(campos.length, "no se extrajo ningún campo: el patrón caducó").toBeGreaterThan(5);
    const sospechosos = campos.filter((c) => /thumb|png|shot|imagen|captur|preview|miniatur/i.test(c));
    expect(sospechosos, "la miniatura se ha metido en el ReplayLog: `ReplayMeta.bytes` ya no mide lo que dice").toEqual([]);
  });

  it("`listLogs` no toca el almacén de miniaturas — por eso `bytes` sigue siendo del registro", () => {
    const i = store.indexOf("export async function listLogs");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = store.slice(i, store.indexOf("\n}", i));
    expect(cuerpo).toContain("utf8Bytes(JSON.stringify(l))");
    expect(cuerpo, "listLogs lee las miniaturas: el tamaño que enseña la lista dejaría de ser el del registro").not.toContain("THUMBS");
  });

  /**
   * 🔴 EL PREDICADO SE ANCLA A LA LLAMADA QUE TRABAJA, NO A QUE «THUMBS» APAREZCA.
   * La primera versión pedía `cuerpo.toContain("THUMBS")` y un mutante SOBREVIVIÓ: al
   * quitar el `objectStore(THUMBS).delete(id)` el nombre SEGUÍA en el cuerpo, porque
   * también está en el ámbito de la transacción (`db.transaction([STORE, THUMBS], …)`).
   * O sea que el borrado se rompía y el test no se enteraba — verde con la promesa «no
   * queda nada» incumplida. Se exige la operación, con su verbo.
   */
  it("el borrado de una repetición y el borrado TOTAL barren la miniatura", () => {
    // «No queda nada de tu paso por aquí» es una promesa literal de /byo. Si el barrido
    // se olvidara de las fotos, quedarían FOTOGRAMAS de la partida de alguien tras
    // pulsar «borrar». (La comprobación de CONDUCTA, con IndexedDB de verdad, está en
    // `game/tools/verify-replay-thumbs.mjs`; esto es su gemelo de forma, más barato.)
    const casos: [string, RegExp][] = [
      ["export async function deleteLog", /objectStore\(THUMBS\)\s*\.\s*delete\(/],
      ["export async function clearAllLogs", /objectStore\(THUMBS\)\s*\.\s*clear\(/],
    ];
    for (const [fn, opera] of casos) {
      const i = store.indexOf(fn);
      expect(i, `no se encontró ${fn}`).toBeGreaterThan(-1);
      const cuerpo = store.slice(i, store.indexOf("\n}", i));
      expect(opera.test(cuerpo), `${fn} no BORRA del almacén de miniaturas`).toBe(true);
    }
  });
});
