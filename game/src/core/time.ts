/**
 * Tiempo del juego: reloj, calendario y fases del día.
 *
 * Fidelidad al original (Task 3.1, re/notes/kernel-survival.md):
 * - El reloj avanza N MINUTOS por acción según contexto: 1 en pueblo,
 *   2 en exterior (+2/+4 por terreno lento). Ver world/survival.ts
 *   (minutesPerAction / advanceClock) — port de kernel_advance_clock.
 * - Calendario de Britannia: 13 meses de 28 días (rollovers exactos del
 *   kernel 0x4FC8-0x509A; fases lunares en DATA.OVL MOON_PHASES).
 * - Amanecer/anochecer condicionan visibilidad y horarios NPC.
 */

export interface GameTime {
  year: number;
  month: number; // 1-13
  day: number; // 1-28
  hour: number; // 0-23
  minute: number; // 0-59
}

export function advanceMinutes(t: GameTime, minutes: number): GameTime {
  let { year, month, day, hour, minute } = t;
  minute += minutes;
  while (minute >= 60) {
    minute -= 60;
    hour++;
  }
  while (hour >= 24) {
    hour -= 24;
    day++;
  }
  while (day > 28) {
    day -= 28;
    month++;
  }
  while (month > 13) {
    month -= 13;
    year++;
  }
  return { year, month, day, hour, minute };
}

export type DayPhase = "night" | "dawn" | "day" | "dusk";

/** Fase del día (el original considera noche ~[21:00,5:00), transiciones al alba/ocaso). */
export function dayPhase(t: GameTime): DayPhase {
  if (t.hour >= 5 && t.hour < 6) return "dawn";
  if (t.hour >= 6 && t.hour < 20) return "day";
  if (t.hour >= 20 && t.hour < 21) return "dusk";
  return "night";
}

/**
 * Índice de posición (0/1/2) del schedule NPC para una hora dada.
 *
 * Port EXACTO de `schedule_index` (NPC.OVL:0x12E0, re/notes/npc.md §0.3): elige
 * el `times[k]` que minimiza la resta de BYTE SIN SIGNO `(hour - times[k]) & 0xFF`
 * — es decir, el periodo empezado más recientemente en aritmética circular de
 * byte. Hay 4 tiempos pero solo 3 posiciones: el periodo del 4º tiempo reutiliza
 * la posición índice 1 (quirk 3→1, 0x131e `mov dx,1` en vez de 3). Los empates
 * los gana el índice MENOR (`jbe` = salta/mantiene cuando `al <= candidato`).
 *
 * El asm compara con `cmp al,cand; jbe skip` (mantiene el actual si es <=), así
 * que sólo sustituye cuando encuentra estrictamente MENOR. Reproduce byte a byte
 * el listado 0x1308-0x1321.
 */
export function scheduleIndex(times: readonly number[], hour: number): number {
  const diff = (k: number): number => (hour - times[k]!) & 0xff;
  let best = diff(0); // al = hour - times[0]
  let dx = 0;
  const d1 = diff(1); // ah
  if (best > d1) {
    best = d1;
    dx = 1;
  }
  const d2 = diff(2); // bl
  if (best > d2) {
    best = d2;
    dx = 2;
  }
  const d3 = diff(3); // bh
  if (best > d3) {
    dx = 1; // el índice 3 remapea a la posición 1 (quirk)
  }
  return dx;
}
