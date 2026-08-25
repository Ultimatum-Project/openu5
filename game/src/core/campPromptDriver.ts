/**
 * DRIVER del diálogo de (H)ole up & camp — el pegamento que conduce la máquina pura
 * `campPrompt` (hours→watch→guard→dormir) contra los sinks del entorno (consola,
 * cursor del picker, prompt de teclas, arranque del sueño). Extraído de `main.ts`
 * para hacer TESTEABLE el flujo end-to-end (Y→"Who will stand guard?"→picker→elegir
 * →dormir) sin DOM — antes vivía como closure inline y sólo se cubría por E2E.
 *
 * PURO respecto al entorno: no importa DOM ni el core; sólo la máquina de prompts y
 * los sinks inyectados. `main.ts` cablea los sinks a `hud.message` / `view.setSelectCursor`
 * / `pendingPrompt` / `runCampSleep`; los tests los cablean a espías.
 *
 * Reglas byte-fieles reflejadas (kernel 0x3C9A, ver `campPrompt.ts`):
 *  - hours: dígito 1-9 → watch/dormir; '0'/Space/ESC → cancelar (prompt `digit` cancelKeys).
 *  - watch: Y → picker de guardia (imprime "Who will stand guard?" + arma `party-select`
 *    + coloca el cursor en el 1er miembro); N → dormir sin guardia.
 *  - guard: `party-select` reenvía la tecla CRUDA al picker (flechas mueven el cursor,
 *    1-N/Enter/Space/0 eligen, ESC cancela); cada movimiento re-arma el prompt y reubica
 *    el cursor de la flecha →; elegir/cancelar cierra y arranca el sueño.
 */
import {
  campHours,
  campWatch,
  campGuardKey,
  type CampPromptStep,
  type CampPromptCtx,
} from "./campPrompt.js";

/**
 * Prompt que el driver arma para el bucle de teclas — subconjunto del `pendingPrompt`
 * de `main.ts` (los únicos tipos que usa el camp). `null` = ningún prompt (sleep/cancel).
 */
export type CampArmedPrompt =
  | { type: "digit"; cancelKeys: true; resolve: (n: number, key: string) => void }
  | { type: "yesno"; resolve: (yes: boolean) => void }
  | { type: "party-select"; onKey: (key: string) => void }
  | null;

/** Sinks del entorno que el driver acciona (main.ts los cablea a hud/view/pendingPrompt/sleep). */
export interface CampPromptDriverDeps {
  /** Imprime una línea de consola (main: `hud.message`). */
  print(text: string): void;
  /**
   * CONTINÚA la fila viva de consola (main: `hud.messageAppend`) — para el ECO del
   * carácter tecleado, que en el original sale pegado al prompt (que acaba en espacio sin
   * `\n`). NO vale `print` para esto: `pushConsole` arranca en columna 0 a propósito
   * (coreview.ts:542), así que el eco saldría en su propia línea.
   */
  printInline(text: string): void;
  /** Publica el cursor del picker de guardia, o `null` al cerrarlo (main: `view.setSelectCursor`). */
  setSelectCursor(idx: number | null): void;
  /** Arma (o limpia con `null`) el prompt de teclas activo (main: asigna `pendingPrompt`). */
  setPrompt(prompt: CampArmedPrompt): void;
  /** Contexto vivo del party para la máquina (nº despiertos, validez/nombre de guardia). */
  ctx(): CampPromptCtx;
  /** Arranca la secuencia de sueño de N horas con el guardia elegido (main: `runCampSleep`). */
  startSleep(hours: number, guardIdx: number): void;
}

/**
 * Ejecuta un PASO de la máquina: imprime sus mensajes, reubica el cursor del picker y
 * arma el prompt de teclas de la fase resultante (o arranca el sueño / no hace nada si se
 * canceló). Los `resolve`/`onKey` re-entran aquí con el mismo `deps` — un único punto de
 * verdad, AUTORITATIVO sobre el prompt y el cursor (los re-arma en cada paso).
 */
export function driveCampPrompt(
  step: CampPromptStep,
  deps: CampPromptDriverDeps,
): void {
  // El eco del carácter va ANTES de los mensajes del paso: en el binario el `putchar` del
  // carácter (0x3dc6) precede tanto a la cancelación como al prompt del watch (0x3e32).
  if (step.echo) deps.printInline(step.echo);
  for (const t of step.prints) deps.print(t);
  const p = step.phase;
  // Cursor del picker de guardia (flecha → en el roster); null en cualquier otra fase.
  deps.setSelectCursor(p.kind === "guard" ? p.cursor : null);
  if (p.kind === "hours") {
    deps.setPrompt({
      type: "digit",
      cancelKeys: true,
      // El carácter crudo viaja junto al número: Espacio, '0' y ESC colapsan todos a n=0
      // y ecoan DISTINTO (" ", "0" y nada) — sin el crudo no se pueden distinguir.
      resolve: (n, key) => driveCampPrompt(campHours(n, deps.ctx(), key), deps),
    });
  } else if (p.kind === "watch") {
    deps.setPrompt({
      type: "yesno",
      resolve: (yes) => driveCampPrompt(campWatch(yes, p.hours), deps),
    });
  } else if (p.kind === "guard") {
    // Picker `select_party_member` (0x2d7a): reenvía la tecla CRUDA; campGuardKey decide.
    deps.setPrompt({
      type: "party-select",
      onKey: (key) =>
        driveCampPrompt(
          campGuardKey({ hours: p.hours, cursor: p.cursor }, key, deps.ctx()),
          deps,
        ),
    });
  } else if (p.kind === "sleep") {
    deps.setPrompt(null); // sin prompt: arranca el sueño
    deps.startSleep(p.hours, p.guardIdx);
  } else {
    // p.kind === "cancelled": '0'/Space/ESC en horas → SIN turno (jmp 0x3eea).
    deps.setPrompt(null);
  }
}
