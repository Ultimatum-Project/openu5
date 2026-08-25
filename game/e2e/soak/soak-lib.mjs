/**
 * Helpers PUROS del soak español (soak-es.mjs) — extraídos para poder testear
 * por unidad las dos guardas de la auditoría de calidad sin arrancar Playwright:
 *
 *  G4 — el EXIT CODE cuenta el pilar español: antes `exit = anomalies>0 ? 2 : 0`
 *       ignoraba stats.enTexts — 50 fugas HARD de inglés bajo lang=es → exit 0 y
 *       cualquier pipeline daba verde con el pilar roto.
 *  G5 — HEARTBEAT del detector: `scanSpanish` degradaba a no-op silencioso si
 *       solo consoleLines se rompía (`?.() ?? []` + catch→return) — enTexts=0
 *       «verde en falso» indistinguible de un run sano (la clase dungeons=0
 *       histórica). Ahora el driver cuenta scannedLines/scanErrors y un run con
 *       acciones suficientes y CERO líneas escaneadas es anomalía (scan-dead).
 */

/**
 * G4 — exit code final del soak. Rojo (2) si hubo anomalías O fugas HARD de
 * inglés bajo ES. Las SOFT (2 funtores en una línea) siguen siendo señal de
 * triage, no fallo duro: quedan en el JSONL/console como siempre.
 */
export function finalExitCode(stats) {
  const hard = stats.enTextsHard ?? 0;
  return stats.anomalies > 0 || hard > 0 ? 2 : 0;
}

/**
 * G5 — sanity de que el detector español está VIVO. Con `minActions` acciones
 * ya ejecutadas, cero líneas de consola escaneadas = el hook consoleLines está
 * roto (o el scan murió): devuelve la descripción del problema, o null si sano.
 */
export function scanHeartbeatProblem(stats, { minActions = 300 } = {}) {
  const actions = stats.actions ?? 0;
  const scanned = stats.scannedLines ?? 0;
  if (actions >= minActions && scanned === 0) {
    return (
      `scan-dead: ${actions} acciones sin UNA sola línea de consola escaneada ` +
      `(scanErrors=${stats.scanErrors ?? 0}) — el detector del pilar español está muerto`
    );
  }
  return null;
}
