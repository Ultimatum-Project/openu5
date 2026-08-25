/**
 * TESTIGO SEMBRADO DE #308 — reproduce, BAJO BANDERA, la caída de worker que el re-run
 * aislado automático de la puerta vitest existe para adjudicar.
 *
 * QUÉ VIGILA, y por qué no se puede sustituir por un informe sintético. Todo #308 cuelga
 * de un discriminante que lee TEXTO: «un fallo sin mensaje de aserto es una caída de
 * worker, y una caída de worker suele ser contención de máquina». Los testigos de
 * `re/tools/test_puerta_vitest.py` prueban que la puerta razona bien sobre el texto que
 * ESPERA; sólo este fichero puede probar que el texto que espera es el que vitest
 * ESCRIBE. Si vitest cambia cómo reporta un plazo agotado, la guarda lo dice aquí — y lo
 * dice como lo que es (el discriminante dejó de casar), no como un flake sin explicación.
 *
 * POR QUÉ UN PLAZO AGOTADO Y NO OTRA MUERTE. Medido el 14-08 con vitest 3.2.7 sobre las
 * cuatro maneras de morir, en un proyecto de sonda aparte:
 *   · plazo agotado    → `Error: STACK_TRACE_ERROR`  ← LA FIRMA HISTÓRICA, la del 14-08
 *   · process.exit(1)  → `Error: process.exit unexpectedly called with "1"`
 *   · SIGKILL          → vitest NO ESCRIBE INFORME (la puerta sale 64, no se degrada)
 *   · aserto que falla → `AssertionError: expected 3 to be 4` (control positivo)
 * El primero es exactamente lo que se vio en `espejo-desfase-derivador.test.ts` con la
 * máquina a load average 48,93, así que es el que se siembra.
 *
 * INERTE POR DEFECTO. Sin `U5_TESTIGO_CRASH_WORKER=1` el cuerpo no espera nada y el test
 * pasa al instante: en la suite normal esto es UN test verde más, no una bomba. El plazo
 * también cambia con la bandera — 30 s desarmado para que ni con la máquina ahogada pueda
 * dar un rojo que nadie pidió; 300 ms armado para que la caída cueste centésimas.
 */
import { describe, expect, it } from "vitest";

const ARMED = process.env.U5_TESTIGO_CRASH_WORKER === "1";
const DEADLINE_MS = ARMED ? 300 : 30_000;

describe("testigo de caida de worker (#308)", () => {
  it(
    "agota su plazo SOLO con U5_TESTIGO_CRASH_WORKER=1",
    async () => {
      if (!ARMED) return;
      await new Promise((resolve) => setTimeout(resolve, 30_000));
    },
    DEADLINE_MS,
  );
});
