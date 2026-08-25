/**
 * GUARDA DEL HUECO DE PROCESO (bolsa #44) — los careos ACOPLADOS entran en `npm test`.
 *
 * EL HUECO, MEDIDO. Los careos de `re/tools/*_parity.py` cruzan el port contra un modelo
 * independiente del binario, y DOS de ellos dependen de `core/world/loops/turn.ts` por
 * import directo del runner:
 *   · `loops_parity.py`  ← `core/__parity__/loops-run.ts` importa `outdoorTurn`/`townTurn`
 *   · `master_parity.py` ← `core/__parity__/master-run.ts`, ídem
 * Pero NINGÚN gate los corría: `game/package.json` `test` es `vitest run` a secas, la raíz
 * sólo los invoca desde `re:parity:all`/`verify:all`, y no hay CI (`.github/workflows` no
 * existe). ⇒ un commit sobre `turn.ts` podía cerrar en verde con el careo roto, y eso ya
 * pasó (`4eccef89` cerró con `npm test -w game`; el careo no PODÍA haber corrido).
 *
 * ★ POR QUÉ SE ASERTA EL NÚMERO DE `passed` Y NO SÓLO EL EXIT CODE. Los dos módulos traen
 * un `skipif` cuyo predicado es `TSX_BIN.exists() and RUN_TS.exists()` con
 * `TSX_BIN = <raíz>/node_modules/.bin/tsx`. Sin ese binario **los careos no fallan: se
 * SALTAN**, y pytest sale con EXIT=0. Medido en este mismo repo, en un worktree al que le
 * faltaba el symlink de la raíz:
 *
 *     10 passed, 37 skipped in 1.93s     ← EXIT=0, y no se careó NADA
 *     46 passed,  1 skipped in 28.29s    ← con el symlink puesto, careo REAL
 *
 * Un guarda que sólo mirase el exit code sería verde-vacío, que es el mismo defecto que
 * está guardando. Por eso el aserto es sobre la POBLACIÓN que corrió.
 *
 * EL ÚNICO `skipped` legítimo es el careo en vivo (marcado aparte); de ahí el margen.
 *
 * COSTE, MEDIDO (no estimado): el `pytest` de cada careo por separado es ~10 s (`loops`),
 * ~17 s (`cmds`) y ~56 s (`blackthorn`, que es caro porque cada escenario levanta el
 * runner una vez y son 14).
 *
 * ★ Y el coste para la SUITE bajó al pasar a `execFile`: 153 s con `spawnSync` y DOS
 * careos → **69 s con `execFile` y TRES**. No es magia: mientras el careo corre fuera, el
 * worker deja de estar bloqueado y vitest sigue repartiendo el resto de ficheros. O sea
 * que meter `blackthorn` salió, en total, más BARATO que no meterlo con la forma vieja.
 * Es el precio —negativo— de que `turn.ts` y la capa del slot no puedan volver a moverse
 * sin que alguien se entere. Escape SÓLO explícito y ruidoso:
 * `U5_SKIP_PARITY=1 npm test`. Nunca auto-skip silencioso — ésa es la trampa que este
 * fichero existe para cerrar.
 *
 * LO QUE ESTE GUARDA **NO** ES: no mete DOSBox ni el oráculo en la suite (los careos son
 * modelo-contra-modelo, sin emulador). Y no cubre los 10 careos restantes: sólo los
 * acoplados a `turn.ts`, más `cmds` y `blackthorn`, que es donde el acoplamiento a código
 * vivo está MEDIDO. La lista crece cuando un careo empieza a importar código vivo, no por
 * completitud.
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Los careos acoplados a `turn.ts` (+ `cmds`, el de la familia jimmy de la misma bolsa,
 * + `blackthorn` desde #64).
 *
 * ★ POR QUÉ ENTRA `blackthorn` (31-07, #64). Antes NO cumplía el criterio de esta guarda:
 * su runner sólo importaba de `world/blackthorn.ts` (motor puro) y su careo era ciego a la
 * capa del slot. Al añadirle el `kind` `guardArms`, el runner pasó a importar
 * `checkBlackthornCapture` de `world/blackthorn-capture.ts` — código VIVO que otros
 * carriles tocan — y a cruzar la mecánica HORARIA recién calcada. Es decir: el
 * acoplamiento es NUEVO y lo creó #64, no estaba y se pasó por alto.
 */
const CAREOS = [
  "re/tools/test_loops_parity.py",
  "re/tools/test_cmds_parity.py",
  "re/tools/test_blackthorn_parity.py",
];

/**
 * Suelo de población POR CAREO: por debajo de esto el `skipif` se lo ha comido.
 * MEDIDOS uno a uno (`loops` 22, `cmds` 24 +1 skipped legítimo en vivo,
 * `blackthorn` 62), con un margen corto para que retirar UN escenario no obligue a
 * tocar este número y retirar muchos sí salte.
 *
 * ⚠ No se reparten «a ojo» a partir del total: el primer intento puso 28 para `loops`
 * partiendo de un 46 conjunto, y `loops` son 22 — el suelo habría tumbado la guarda
 * sin que nada estuviese roto.
 */
const MIN_PASSED: Record<string, number> = {
  "re/tools/test_loops_parity.py": 20,
  "re/tools/test_cmds_parity.py": 22,
  "re/tools/test_blackthorn_parity.py": 56,
};

describe("careos ACOPLADOS a turn.ts — corren dentro de `npm test` (hueco de proceso #44)", () => {
  // ★★ `execFile` ASÍNCRONO, NO `spawnSync` — y esto es un arreglo, no un estilo.
  // `spawnSync` BLOQUEA el hilo del worker de vitest, que entonces no contesta a su propio
  // RPC: la corrida termina con `[vitest-worker]: Timeout calling "onTaskUpdate"`,
  // **todos los tests en VERDE y exit 1**. Medido al meter `blackthorn` en la lista
  // (31-07, #64): con `spawnSync` fallaba con los 3 careos en UN test (~150 s) y seguía
  // fallando partido en tres (~119 s el fichero) — partir NO era la cura, porque la causa
  // es el bloqueo, no el reparto. Con `execFile` + `await` el bucle de eventos sigue vivo
  // y la suite vuelve a exit 0.
  // Un `it` POR CAREO se conserva igualmente: así un rojo dice CUÁL careo cayó.
  for (const careo of CAREOS) {
    const suelo = MIN_PASSED[careo] ?? 1;
    it.skipIf(process.env.U5_SKIP_PARITY === "1")(
      `${careo}: exit 0 y >= ${suelo} tests REALMENTE corridos`,
      async () => {
        // El predicado del `skipif` de los módulos, replicado aquí para dar un mensaje
        // útil en vez de un conteo bajo y misterioso.
        const tsx = resolve(REPO_ROOT, "node_modules", ".bin", "tsx");
        expect(
          existsSync(tsx),
          `falta ${tsx}: los careos se SALTARÍAN en silencio (en un worktree, symlinkea ` +
            "también el node_modules de la RAÍZ, no sólo el de game/)",
        ).toBe(true);

        const r = await new Promise<{ status: number; salida: string }>((ok) => {
          execFile(
            "python3",
            ["-m", "pytest", careo, "-q", "-p", "no:cacheprovider"],
            { cwd: REPO_ROOT, encoding: "utf8", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
              const code = err && typeof (err as { code?: unknown }).code === "number"
                ? ((err as { code: number }).code)
                : err ? 1 : 0;
              ok({ status: code, salida: `${stdout ?? ""}${stderr ?? ""}` });
            },
          );
        });

        const salida = r.salida;
        expect(r.status, `${careo} no pasó:\n${salida.slice(-4000)}`).toBe(0);

        const passed = Number(/(\d+) passed/.exec(salida)?.[1] ?? 0);
        expect(
          passed,
          `sólo ${passed} tests corrieron de verdad (esperados >= ${suelo}). El exit ` +
            `es 0 pero el careo se saltó: eso es VERDE VACÍO.\n${salida.slice(-2000)}`,
        ).toBeGreaterThanOrEqual(suelo);
      },
      300_000,
    );
  }
});
