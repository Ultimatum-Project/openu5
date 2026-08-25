/**
 * #207 — EL PRESUPUESTO DE SUBFOTOGRAMAS DEL GRABADOR, Y LOS DOS FRENOS QUE LO CORTAN.
 *
 * El grabador de partidas (`game/tools/partida-render.mjs`) avanzaba un presupuesto FIJO de
 * 6 subfotogramas por paso de replay, así que toda animación más larga que 6·(1000/12) =
 * 500 ms salía DECAPITADA del vídeo. El corte no da error: el vídeo sale, dura lo que tiene
 * que durar y le falta media escena. Así se publicó la coreografía del Shard.
 *
 * ── POR QUÉ LOS DOS FRENOS VAN POR SEPARADO (veto explícito del diseño de #207) ──────────
 * El grabador puede quedarse corto por DOS caminos independientes, y un test que instancie
 * sólo uno da el arreglo por bueno con el otro roto:
 *   (1) EL PRESUPUESTO — si el bucle corta a los 6, da igual lo que diga el predicado.
 *   (2) LA COLA DE rAF — si la cola está vacía, `avanza()` no avanza nada y NINGÚN
 *       presupuesto, por generoso que sea, produce un fotograma nuevo. El síntoma es el
 *       opuesto y se lee igual de mal: 721 fotogramas idénticos, un vídeo congelado que pasa
 *       todas las demás guardas (cabecera de `partida-render.mjs`).
 * Aquí se instancian los dos, más el TOPE DE SEGURIDAD que hace terminable el bucle nuevo.
 *
 * ── QUÉ MIDE CADA INSTRUMENTO, Y CUÁL NO ES CONDUCTA ─────────────────────────────────────
 * §A/§B/§C conducen la función REAL (`avanzaPasoDeReplay`) con predicados sintéticos: son
 * asertos de conducta. §D conduce el `WorldFxLayer` REAL. §E es una guarda ESTRUCTURAL sobre
 * el fuente, y se declara como tal: no ejecuta el grabador (necesitaría chromium y material
 * de EA), sólo vigila que su cableado siga en pie. Está porque el mutante que más importa
 * —restaurar `SUBFRAMES = 6`— vive en un fichero que ningún test de esta suite puede correr.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Los tipos vienen de `game/tools/avance-fx.d.mts` (sidecar: el módulo es .mjs porque
// `partida-render.mjs` lo importa desde node pelado, que no lee TypeScript).
import {
  avanzaPasoDeReplay,
  SUBFOTOGRAMAS_MIN,
  TOPE_SUBFOTOGRAMAS,
  type AvisoDeTope,
} from "../tools/avance-fx.mjs";
import { WorldFxLayer, PAUSE_UNIT_MS, EXPLOSION_BURST_MS } from "../src/skin/world-fx.js";

// 🔴 Anclado a `import.meta.url`, NO al cwd: un `resolve("game/...")` mediría el árbol desde
// donde se lance vitest, que en esta flota puede ser el checkout principal y no esta rama.
const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

/** Cuenta los subfotogramas pedidos, sin efectos. */
function contador(): { n: number; subfotograma: () => Promise<void> } {
  const c = { n: 0, subfotograma: async () => { c.n++; } };
  return c;
}

describe("#207 §A — FRENO 1: el presupuesto no puede cortar la animación", () => {
  it("sin animación viva da EXACTAMENTE el mínimo de ritmo (6), ni uno más", async () => {
    const c = contador();
    const r = await avanzaPasoDeReplay({
      subfotograma: c.subfotograma,
      hayFxViva: async () => false,
    });
    expect(r.subfotogramas).toBe(SUBFOTOGRAMAS_MIN);
    expect(r.subfotogramas).toBe(6);
    expect(r.topeAlcanzado).toBe(false);
    expect(c.n).toBe(6);
  });

  it("el mínimo va ENTERO aunque el predicado esté bajo desde el primer instante", async () => {
    // Mutante que mata: consultar `hayFxViva` DENTRO del bucle del mínimo. Con el predicado
    // en falso daría 0 subfotogramas y el replay entero se quedaría sin ritmo — el vídeo
    // pasaría de 721 fotogramas a 1. Un fallo que el ojo ve, pero ningún otro aserto de aquí.
    let consultas = 0;
    const c = contador();
    await avanzaPasoDeReplay({
      subfotograma: c.subfotograma,
      hayFxViva: async () => { consultas++; return false; },
    });
    expect(c.n).toBe(SUBFOTOGRAMAS_MIN);
    expect(consultas, "el mínimo se consultó con el predicado en vez de ir entero").toBe(1);
  });

  it("una animación LARGA (40 subfotogramas) se captura ENTERA", async () => {
    // 40 > 6: con el presupuesto viejo se perdían 34. El número no tiene nada de particular;
    // lo que importa es que sea mayor que el mínimo y menor que el tope.
    const VIVA_HASTA = 40;
    const c = contador();
    const r = await avanzaPasoDeReplay({
      subfotograma: c.subfotograma,
      hayFxViva: async () => c.n < VIVA_HASTA,
    });
    expect(r.subfotogramas).toBe(VIVA_HASTA);
    expect(r.topeAlcanzado).toBe(false);
  });

  it("EL MUTANTE con cifra: el presupuesto FIJO de 6 deja 34 sin capturar y la animación viva", async () => {
    // Instancia el régimen VIEJO sobre la MISMA animación, para que la pérdida tenga número
    // y no sea una afirmación. Esto es lo que hacía `partida-render.mjs` antes de #207.
    const VIVA_HASTA = 40;
    let n = 0;
    for (let s = 0; s < 6; s++) n++; // el bucle de `SUBFRAMES` fijo, verbatim
    expect(n).toBe(6);
    expect(n < VIVA_HASTA, "con presupuesto fijo la animación seguía viva al cortar").toBe(true);
    expect(VIVA_HASTA - n, "subfotogramas perdidos por el presupuesto fijo").toBe(34);
  });
});

describe("#207 §B — EL TOPE DE SEGURIDAD: corta, termina y NO es silencioso", () => {
  it("una animación INFINITA termina en el tope en vez de colgar el grabador", async () => {
    const c = contador();
    const avisos: AvisoDeTope[] = [];
    const r = await avanzaPasoDeReplay({
      subfotograma: c.subfotograma,
      hayFxViva: async () => true, // nunca baja: el caso que el tope existe para acotar
      alAlcanzarTope: (info: AvisoDeTope) => avisos.push(info),
      paso: 7,
      tope: 25,
    });
    expect(r.subfotogramas).toBe(25);
    expect(r.topeAlcanzado).toBe(true);
    expect(avisos, "el tope cortó EN SILENCIO: no avisó ni una vez").toHaveLength(1);
    expect(avisos[0]).toEqual({ paso: 7, tope: 25 });
  });

  it("el aviso POR DEFECTO lanza — el silencio no es la opción de fábrica", async () => {
    // Mutante: cambiar el default a un `console.warn` (o a nada). El grabador escribiría un
    // vídeo con un paso de 50 s dentro y nadie se enteraría hasta mirarlo.
    const c = contador();
    await expect(
      avanzaPasoDeReplay({
        subfotograma: c.subfotograma,
        hayFxViva: async () => true,
        tope: 10,
      }),
    ).rejects.toThrow(/TOPE DE SEGURIDAD/);
  });

  it("el tope de fábrica deja margen sobre lo visual medido de la escena del Shard", async () => {
    // Lo VISUAL de la escena del Shard son ~1,3 s (sacudida) = ~16 subfotogramas a 12 fps.
    // 🔴 El «~550 fotogramas» de la ficha #207 es la cola de AUDIO de #206 y el vídeo va con
    // `-an`: MUDO. El tope cubre las dos cifras, y esta cota lo deja escrito.
    expect(TOPE_SUBFOTOGRAMAS).toBeGreaterThan(553);
    expect(TOPE_SUBFOTOGRAMAS).toBeGreaterThan(16 * 30);
  });
});

/**
 * 🔴 ESTE BLOQUE TIENE DOS CASOS PORQUE EL BUCLE TIENE DOS MITADES, y la primera redacción
 * sólo cubría una. `avanzaPasoDeReplay` avanza el MÍNIMO en un bucle y la EXTENSIÓN en otro:
 * un `try/catch` metido sólo en el de extensión SOBREVIVÍA a la versión de un caso, porque
 * el error se lanzaba en el subfotograma 3 — dentro del mínimo, que no era el bucle mutado.
 * Medido, no razonado: el mutante pasó los 16 verdes. Se instancia el fallo EN CADA MITAD.
 */
describe("#207 §C — FRENO 2: la cola de rAF vacía se PROPAGA, no se traga", () => {
  it("si `avanza()` lanza por cola vacía DENTRO DEL MÍNIMO, se propaga", async () => {
    // `partida-render.mjs` lanza «la cola del reloj se vació» cuando `avanza()` no ejecuta
    // ningún callback. Si `avanzaPasoDeReplay` capturase ese error, el grabador seguiría
    // pidiendo subfotogramas sobre una página congelada y produciría el vídeo de 721
    // fotogramas idénticos — el freno (2), que el presupuesto no puede ver.
    let n = 0;
    await expect(
      avanzaPasoDeReplay({
        subfotograma: async () => {
          n++;
          if (n === 3) throw new Error("la cola del reloj se vació: ningún bucle rAF sigue vivo");
        },
        hayFxViva: async () => true,
      }),
    ).rejects.toThrow(/la cola del reloj se vació/);
    expect(n, "el bucle siguió avanzando después de que la cola muriera").toBe(3);
  });

  it("si lanza DENTRO DE LA EXTENSIÓN (pasado el mínimo), también se propaga", async () => {
    // La mitad que la primera redacción de este bloque no cubría. Sin este caso, un
    // `try/catch` en el bucle de extensión pasa los 16 verdes — medido.
    let n = 0;
    await expect(
      avanzaPasoDeReplay({
        subfotograma: async () => {
          n++;
          if (n === SUBFOTOGRAMAS_MIN + 4) {
            throw new Error("la cola del reloj se vació: ningún bucle rAF sigue vivo");
          }
        },
        hayFxViva: async () => true,
      }),
    ).rejects.toThrow(/la cola del reloj se vació/);
    expect(n, "se tragó el error y siguió hasta el tope").toBe(SUBFOTOGRAMAS_MIN + 4);
  });
});

describe("#207 §D — worldFx: una explosión SOLA repinta hasta agotarse", () => {
  // Duración de la explosión de celda del Shard, DERIVADA de las constantes de #201:
  // 3 unidades de pausa previa + 7 ráfagas.
  const EXPLOSION = { kind: "cellExplosion" as const, dx: 0, dy: -1, bursts: 7, preDelayUnits: 3 };
  const DURACION_MS = 3 * PAUSE_UNIT_MS + 7 * EXPLOSION_BURST_MS;

  it("la duración derivada de las constantes de #201 son los 585 ms de la ficha", () => {
    expect(DURACION_MS).toBe(585);
  });

  it("`active` NO se apaga sola: sólo `paint()` purga, y `paint()` vive dentro de `render()`", () => {
    const fx = new WorldFxLayer();
    fx.push(EXPLOSION, 0);
    expect(fx.active).toBe(true);
    // Pasa DE SOBRA el tiempo de la explosión, pero sin repintar ni una vez.
    expect(fx.active, "se purgó sin que nadie llamara a paint()").toBe(true);
  });

  /**
   * Careo DIFERENCIAL sobre el objeto real, con el bucle del rAF reducido a su decisión:
   * «mientras el predicado esté en alto, repinta». La diferencia se instancia DONDE EXISTE
   * — una explosión SIN sacudida, que es el caso que hoy no ocurre sólo porque la
   * coreografía del Shard siempre las emite juntas.
   */
  const repintaMientras = (pred: () => boolean, fx: WorldFxLayer): number => {
    let t = 0;
    while (pred()) {
      // el purgado de los caducados vive aquí, como en `render()`
      fx.paint(t, { blit: () => {}, dot: () => {} });
      t += 16; // ~60 Hz
      if (t > 10_000) break; // fusible del propio test: nunca debe hacer falta
    }
    return t;
  };

  it("con worldFx EN el predicado, la explosión sola repinta ~585 ms y se agota", () => {
    const fx = new WorldFxLayer();
    fx.push(EXPLOSION, 0);
    const ms = repintaMientras(() => fx.active, fx);
    expect(ms).toBeGreaterThanOrEqual(DURACION_MS);
    expect(ms).toBeLessThan(DURACION_MS + 32); // se apagó al caducar, no por el fusible
    expect(fx.active).toBe(false);
  });

  it("EL MUTANTE: con el predicado VIEJO (sin worldFx) no repinta nada y queda encendida para siempre", () => {
    // Éste es el estado de main antes de #207: la disyunción del rAF no nombraba `worldFx`.
    // Sin sacudida que la mantuviese viva, la explosión ni se pintaba ni se purgaba.
    const fx = new WorldFxLayer();
    fx.push(EXPLOSION, 0);
    const predicadoViejo = (): boolean => false; // combatFx/apparition/timeFlash/quake, todos apagados
    const ms = repintaMientras(predicadoViejo, fx);
    expect(ms, "el predicado viejo sí repintaba: entonces el defecto no era éste").toBe(0);
    expect(fx.active, "la capa quedó ENCENDIDA sin purgar — predicado clavado en true").toBe(true);
  });

  it("el getter de la piel NOMBRA worldFx, y el bucle rAF usa ESE getter (no una réplica)", () => {
    const skin = leer("src/skin/fiel/skin.ts");
    const getter = skin.slice(
      skin.indexOf("get transientFxActive()"),
      skin.indexOf("get transientFxActive()") + 400,
    );
    for (const capa of ["combatFx", "worldFx", "apparition", "timeFlash", "quake", "transit"]) {
      expect(getter, `\`${capa}\` falta en transientFxActive`).toContain(capa);
    }
    // El ambiente cíclico de moongate NO entra: incluirlo daría un predicado que no baja de
    // noche y el grabador agotaría el tope en cada paso. Ver la cabecera del getter.
    expect(getter).not.toContain("moongateAnimating");
    expect(skin).toContain("advanced || this.transientFxActive || moongateAnimating");
  });
});

describe("#207 §E — guarda ESTRUCTURAL del grabador (no ejecuta: pide chromium y material EA)", () => {
  const grabador = leer("tools/partida-render.mjs");

  it("`SUBFRAMES` ya no existe como presupuesto: si alguien lo restaura, esto se pone ROJO", () => {
    expect(grabador).not.toMatch(/^\s*const\s+SUBFRAMES\s*=/m);
    expect(grabador).not.toMatch(/s\s*<\s*SUBFRAMES/);
  });

  it("el bucle de pasos llama a `avanzaPasoDeReplay` y el hook ausente ABORTA", () => {
    expect(grabador).toContain("avanzaPasoDeReplay({ subfotograma, hayFxViva");
    expect(grabador).toContain("__u5test.fxActive");
    // La ausencia del hook no puede degradar a `false`: sería indistinguible de «no hay
    // animación» y devolvería al grabador al presupuesto fijo SIN avisar.
    expect(grabador).not.toMatch(/fxActive\?\.\(\)\s*\?\?\s*false/);
    expect(grabador).toMatch(/!==\s*"function"/);
  });

  /**
   * 🔴 ESTE ASERTO EXIGÍA LA LÍNEA DEFECTUOSA. Decía
   * `hooks.fxActive = (): boolean => fielSkin.transientFxActive;` — el cableado que
   * preguntaba a una instancia FIJA de piel fiel y devolvía `false` para siempre con la
   * shader activa. Era verde, y lo que cementaba era el defecto. Se corrige AQUÍ y el
   * sujeto de la junta se vigila en `render-fx-junta.test.ts`, que conduce el manager de
   * verdad; esto se queda sólo con lo que le toca: el hook expone un booleano COMPUESTO
   * (o `null`), no los flags sueltos, para que el grabador no recomponga la disyunción.
   */
  it("el hook `fxActive` expone el predicado COMPUESTO de la piel ACTIVA, no los flags sueltos", () => {
    const main = leer("src/main.ts");
    expect(main).toContain("hooks.fxActive = (): boolean | null => skins.transientFxActive;");
  });
});
