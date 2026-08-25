/**
 * Máquina de prompts de (H)ole up & camp — la SECUENCIA de sub-prompts crudos del
 * original tras pasar el gate de contexto (kernel 0x3C9A): "For how many hours?"
 * (0x3dbc) → "Wilt thou set a watch?" (0x3e2c, sólo con ≥2 despiertos) → picker de
 * guardia (0x3eac `select_party_member` 0x2d7a) → dormir. PURA (sin DOM ni RNG): la
 * cablea `main.ts::startCamp` a `pendingPrompt`/`hud`/`runCampSleep`. El gate de
 * contexto (pueblo/agua/barco, `Game.campContext` / kernel 0x3288) es ANTERIOR y NO
 * entra aquí.
 *
 * Aísla la LÓGICA DE TRANSICIÓN (gating del watch por nº de despiertos, validez del
 * guardia, cortes de cancelación) del filtrado de teclas (que vive en `pendingPrompt`,
 * fiel: hours=dígito/Space, watch=Y/N — derivado en re/notes/cmds.md §5). Blindaje de
 * regresión del softlock/encadenado de prompts (los reducers son testables 1:1).
 *
 * Reglas byte-fieles reflejadas:
 *  - hours: '0'/Space/ESC → cancelar SIN turno (0x3ddc/0x3de5 jmp 0x3eea); 1-9 = horas.
 *  - watch: sólo si `watchCount ≥ 2` (0x3e2c `cmp [bp-4],1; jle`). Y→guardia, N→dormir.
 *  - guard: picker NAVEGABLE `select_party_member` (0x2d7a, componente reusable
 *    `selectPartyMember.ts`): flechas mueven el cursor, 1-N elige directo, Enter/Space/0
 *    confirma, ESC cancela. El miembro elegido, si es 'G' (0x3ec6 `cmp 0x47`) → dormir con
 *    guardia; si no-'G' o cancelar → "None posted!" (0xa386) y dormir sin guardia (0x3ecd).
 *    El marcador es la FLECHA `→` sobre el cursor (NO inverso, combat-exclusive —
 *    `skin/fiel/roster.ts`); la piel lo pinta leyendo `phase.cursor` (fase 2).
 */
import { selectPartyMemberKey } from "./selectPartyMember.js";

/** Fase del diálogo de camp. `sleep`/`cancelled` son terminales. */
export type CampPromptPhase =
  | { kind: "hours" }
  | { kind: "watch"; hours: number }
  | { kind: "guard"; hours: number; cursor: number } // cursor = miembro bajo la flecha →
  | { kind: "sleep"; hours: number; guardIdx: number }
  | { kind: "cancelled" };

/** Contexto derivado del estado de juego (nº de despiertos + validez/nombre de guardia). */
export interface CampPromptCtx {
  /** `Game.campWatchCount()`: miembros con status 'G'/'P' (0x3e06-0x3e24). */
  watchCount: number;
  /** Nº de miembros en el party (acota el cursor/selección del picker de guardia). */
  partySize: number;
  /** ¿El miembro `idx` (0-based) es guardia válido? idx en party y status 'G' (0x3ec6). */
  isValidGuard: (idx: number) => boolean;
  // (Aquí vivía `guardName`, que sólo alimentaba un eco del nombre del guardia que el
  // original NO imprime. Retirado con él: dejar el campo invitaría a re-introducirlo.)
}

/** Resultado de un paso: la fase resultante + los mensajes a imprimir en orden. */
export interface CampPromptStep {
  phase: CampPromptPhase;
  prints: string[];
  /**
   * ECO INLINE del carácter tecleado, a emitir ANTES de `prints` y por el sink que
   * CONTINÚA la fila viva (`hud.messageAppend`), no por el que abre fila (`hud.message`):
   * en el original el eco sale pegado al prompt, que acaba en espacio sin `\n`. Ausente =
   * no se ecoa nada. El `\n` del `putchar` que sigue al carácter NO viaja aquí: en el port
   * cada `hud.message` cierra su propia fila (residuo declarado de #108, coreview.ts:542),
   * así que se poda igual que en el peaje de trolls (main.ts:1587).
   */
  echo?: string;
}

/** Arranque: abre el prompt de horas. La cabecera "Hole up & camp!" la pone startCamp. */
export function campPromptStart(): CampPromptStep {
  return { phase: { kind: "hours" }, prints: ["For how many hours? (1-9) "] }; // 0xa32c
}

/**
 * Tras teclear las horas (n): 0 = cancelar; con ≥2 despiertos → watch, si no → dormir.
 *
 * `key` es el CARÁCTER CRUDO tecleado, y decide el eco. En el binario el bucle de getkey
 * (0x3dbc) sólo rompe con un dígito o con ESPACIO, y al romper el cuerpo ecoa
 * INCONDICIONALMENTE —`putchar(carácter)` 0x3dc6 + `putchar('\n')` 0x3dcf— **antes** de
 * mirar si toca cancelar (0x3dd6 espacio → 0x3eea; 0x3ddf '0' → 0x3eea). Por eso el eco
 * se adjunta aquí a TODOS los caminos, cancelación incluida: Espacio ecoa " " y '0' ecoa
 * "0" aunque no se duerma. Cadena vacía = no ecoar (ESC, que el getkey del original ni
 * decodifica: cancelar con ESC es QoL declarada del port).
 *
 * ⚠ NO es el mismo eco que el de la CAMA de pueblo (`bedHours`): allí los dos tests de
 * cancelación van ANTES del eco. Son dos rutinas distintas en dos binarios distintos y la
 * asimetría está medida en ambas; no las unifiques.
 */
export function campHours(n: number, ctx: CampPromptCtx, key = ""): CampPromptStep {
  const withEcho = (step: CampPromptStep): CampPromptStep =>
    key === "" ? step : { ...step, echo: key };
  if (n <= 0) return withEcho({ phase: { kind: "cancelled" }, prints: [] }); // '0'/Space → 0x3eea, sin turno
  if (ctx.watchCount >= 2) {
    // Literal BYTE-FIEL con el `\n` inicial del pool (DATA.OVL 0xa348 = `\nWilt thou…`):
    // así el choke t() de la consola casa la key exacta de es.json (carril i18n-restos).
    return withEcho({ phase: { kind: "watch", hours: n }, prints: ["\nWilt thou set a watch? "] }); // 0xa348
  }
  return withEcho({ phase: { kind: "sleep", hours: n, guardIdx: -1 }, prints: [] });
}

/**
 * Dormir en CAMA de pueblo — `CMDS.OVL:0x0552`, la rutina HERMANA del camp del kernel.
 * Mismo diálogo aparente ("For how many hours? " 0x4209, sin "(1-9)") y MISMO eco
 * `putchar(carácter)` + `putchar('\n')` (0x058c-0x059d) … pero colocado al OTRO LADO de la
 * cancelación: aquí los tests salen primero (0x057a espacio → `jmp 0x6e8`; 0x0583 '0' →
 * `jmp 0x6e8`) y el eco sólo se ejecuta si se va a dormir. Es la ÚNICA diferencia medida
 * entre las dos, y es la razón de que esto sea una función aparte y no una llamada a
 * `campHours`: unificarlas mete un eco que el original no emite.
 *
 * `hours` 0 = cancelar sin turno. `key` es el carácter crudo; "" (ESC) nunca ecoa.
 */
export function bedHours(n: number, key = ""): { hours: number; echo?: string } {
  if (n <= 0) return { hours: 0 }; // espacio/'0' → 0x6e8 SIN pasar por el eco
  return key === "" ? { hours: n } : { hours: n, echo: key };
}

/**
 * Respuesta al watch: Sí → picker de guardia (cursor en el 1er miembro); No → dormir.
 *
 * El «Yes»/«No» es un ECO INLINE, no una línea: la pregunta del pool (0xa348
 * `\nWilt thou set a watch? `) acaba en ESPACIO sin `\n`, y el binario imprime la
 * respuesta (0xa368 `Yes\n\n` / 0xa362 `No\n\n`) a continuación EN LA MISMA FILA. Emitirlo
 * por `prints` le abría fila propia (`pushConsole` arranca en columna 0 a propósito) ⇒ era
 * el MISMO defecto que el eco del dígito de horas, en el mismo fichero. Va por `echo`.
 * El `\n\n` del pool no viaja: en el port la fila la cierra `pushConsole` sola (#108).
 */
export function campWatch(yes: boolean, hours: number): CampPromptStep {
  if (yes) {
    return {
      phase: { kind: "guard", hours, cursor: 0 }, // flecha → en el 1er miembro
      echo: "Yes", // 0xa368, INLINE tras la pregunta
      prints: ["Who will stand guard? "], // 0xa36e
    };
  }
  return { phase: { kind: "sleep", hours, guardIdx: -1 }, echo: "No", prints: [] }; // 0xa362
}

/**
 * Una tecla cruda (`event.key`) en el picker de guardia (kernel 0x2d7a). Flechas mueven
 * el cursor (sigue en `guard`); una selección (número directo o Enter/Space/0 sobre el
 * cursor) confirma → dormir con el guardia si es 'G' (0x3ec6) o "None posted!" si no; ESC
 * → cancelar = "None posted!" y dormir sin guardia (0x3ecd). Teclas no reconocidas se
 * ignoran (getkey re-lee). `hours` y `cursor` vienen de la fase actual.
 */
export function campGuardKey(
  phase: { hours: number; cursor: number },
  key: string,
  ctx: CampPromptCtx,
): CampPromptStep {
  const res = selectPartyMemberKey({ cursor: phase.cursor }, key, ctx.partySize);
  switch (res.kind) {
    case "move":
      return { phase: { kind: "guard", hours: phase.hours, cursor: res.cursor }, prints: [] };
    case "select":
      // SIN eco de nombre: el picker del kernel (0x2eac→0x2e8e) resalta la fila, lee teclas,
      // apaga el resaltado y DEVUELVE EL ÍNDICE — no imprime a nadie. El llamador sólo hace
      // `putchar('\n')` (0x3eb2), que aquí es el cierre de fila que `pushConsole` ya da sola
      // al imprimir "Who will stand guard? " (#108) ⇒ no queda nada que emitir. El
      // `${guardName}\n\n` que había aquí estaba INVENTADO: era el único print del flujo sin
      // cita de offset del pool, mientras "None posted!" (0xa386), "Yes" (0xa368) y "No"
      // (0xa362) sí la llevan.
      return ctx.isValidGuard(res.index)
        ? { phase: { kind: "sleep", hours: phase.hours, guardIdx: res.index }, prints: [] }
        : { phase: { kind: "sleep", hours: phase.hours, guardIdx: -1 }, prints: ["None posted!\n\n"] }; // 0xa386
    case "close":
      return { phase: { kind: "sleep", hours: phase.hours, guardIdx: -1 }, prints: ["None posted!\n\n"] }; // 0x3ecd
    case "ignore":
      return { phase: { kind: "guard", hours: phase.hours, cursor: phase.cursor }, prints: [] };
  }
}
