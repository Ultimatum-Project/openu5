/**
 * Fórmulas EXACTAS del combate de Ultima V, re-derivadas del binario
 * (COMBAT.OVL + COMSUBS.OVL + kernel; evidencia instrucción a instrucción
 * en re/notes/combat.md — cada función cita su offset).
 *
 * Todas consumen aleatoriedad del RNG exacto del kernel (OriginalRng,
 * re/notes/rng.md) en el MISMO orden que el binario: el arnés de paridad
 * (re/tools/parity.py) compara el stream de rands y las trayectorias de HP.
 */
import { OriginalRng } from "../rng-original.js";

/** IDs de equipo con semántica especial (enum Equipment del save). */
export const WEAPON_BARE_HANDS = 0xff;
/** Item id del Amulet of Lord British equipado (slot roster+0x1E). El binario compara
 *  ese slot con 0x2D para el negate mágico del amuleto — COMBAT:0x02B1. */
export const AMULET_OF_LORD_BRITISH = 0x2d;
export const WEAPON_MORNING_STAR = 0x19;
export const WEAPON_HALBERD = 0x22;
export const WEAPON_CHAOS_SWORD = 0x23;
/** Arma FIJA con la que ataca un actor CHARMED — COMBAT:0x0286
 *  `mov byte ptr [g_cmb_weapon], 0x21` (= 2H Sword, `longEquipNames[0x21]`). No es el
 *  arma equipada: la rama de charmed la impone. #182 D8. */
export const WEAPON_CHARMED_MELEE = 0x21;
// Magic Axe = id 0x26 (documental — auditoría D5: sin consumidores; vuela y regresa,
// rango 15, sujeta a LOS — ver nota de POLEARM_WEAPONS).
const WEAPON_GLASS_SWORD = 0x27;
const WEAPON_JEWELED_SWORD = 0x28;
/** Armas físicas con acierto automático — COMBAT:0x14D6 1512-1522. */
export const AUTO_HIT_WEAPONS = new Set([0x23, 0x27, 0x28]);
/**
 * Astas «(p) polearm» — pegan POR ENCIMA de obstáculos: el vuelo del proyectil
 * (COMSUBS:0x0822) las desvía en 0x087e (cmp weapon 0x19 / 0x22) a un golpe
 * DIRECTO que salta el raycast de línea-de-tiro (0x12de). No hay flag de tabla:
 * el binario las identifica por ID literal. Magic Axe (0x26) NO entra — vuela y
 * regresa (rango 15), sí sujeta a LOS. Ver re/notes/polearm-attack.md.
 */
const POLEARM_WEAPONS = new Set([WEAPON_MORNING_STAR, WEAPON_HALBERD]);
export function isPolearm(weaponId: number): boolean {
  return POLEARM_WEAPONS.has(weaponId);
}
/** Id "genérico" para armas sintéticas (tests/encuentros sin id real). */
export const WEAPON_GENERIC = -1;

/**
 * RNG del combate: wrappers exactos de los helpers del kernel.
 * randRange = rng_rand_range 0x2092; rand0 = kernel 0x3AAE;
 * rand30 = kernel 0x3ABE (1..30, el 1 con probabilidad 4/61).
 */
export class CombatRng {
  constructor(readonly rng: OriginalRng) {}

  /** rand(lo, hi) ambos inclusive (kernel 0x2092). */
  randRange(lo: number, hi: number): number {
    return this.rng.next(lo, hi);
  }

  /** kernel 0x3AAE: rand(0, n) ambos inclusive. */
  rand0(n: number): number {
    return this.rng.next(0, n);
  }

  /** kernel 0x3ABE: `max(1, rand0(0x3C) >> 1)` → 1..30. */
  rand30(): number {
    const v = this.rand0(0x3c) >> 1;
    return v === 0 ? 1 : v;
  }
}

/** División entera redondeada hacia 0 (idiom `cdq; sub ax,dx; sar ax,1`). */
export function sar1RoundToZero(x: number): number {
  return x < 0 ? -(-x >> 1) : x >> 1;
}

/**
 * Recarga del contador de iniciativa: `0x24 − velocidad` en aritmética de
 * BYTE (COMBAT:0x0B94 0c4b-0c50 y kernel 0x6506 65a8/65f1). El combatiente
 * actúa cuando su countdown llega a 0 al decrementarse una vez por pasada
 * del bucle de slots.
 */
export function initiativeReset(speed: number): number {
  return (0x24 - speed) & 0xff;
}

/**
 * Velocidad de un ENEMIGO al entrar en combate (kernel 0x6506 65d2-65f1):
 * `dex + rand0(7) − 4`; si el resultado (byte) supera 30 (incluye el
 * underflow negativo), se usa la dex de la tabla sin modificar.
 * CONSUME 1 rand.
 */
export function enemySpawnSpeed(dexStat: number, rng: CombatRng): number {
  const v = (dexStat + rng.rand0(7) - 4) & 0xff;
  return v > 0x1e ? dexStat : v;
}

/**
 * ¿El arma acierta con STR en vez de DEX? — COMBAT:0x13E2 141e-1426:
 * `spellAttackRange[arma − 1] == 8` (tabla DS 0x169C accedida 1-based).
 * Armas contundentes: spiked helm 0x03, spiked shield 0x06, club 0x12,
 * mace 0x18, 2H hammer 0x1F.
 */
export function weaponUsesStrength(weaponId: number, spellAttackRange: number[]): boolean {
  if (weaponId <= 0) return false;
  return (spellAttackRange[weaponId - 1] ?? 0) === 8;
}

/**
 * Umbral de acierto — COMBAT:0x14D6 154d-155b:
 * `(statDefensor − statAtacante + 30) / 2` redondeado hacia 0.
 */
export function hitThreshold(defStat: number, atkStat: number): number {
  return sar1RoundToZero(defStat - atkStat + 30);
}

/**
 * Tirada de acierto — COMBAT:0x14D6 155e-1566: acierta si
 * `rand30() >= umbral`. CONSUME 1 rand. Con stats iguales ≈ 53 %.
 */
export function rollHit(defStat: number, atkStat: number, rng: CombatRng): boolean {
  return rng.rand30() >= hitThreshold(defStat, atkStat);
}

export interface WeaponDamageRoll {
  base: number;
  /** Glass sword: se destruye al usarse ("Thy sword hath shattered!"). */
  shattered: boolean;
}

/**
 * Daño base del arma del JUGADOR — COMBAT:0x12B0 12d8-133d:
 * glass sword (0x27) → 99 fijo + shatter; jeweled sword (0x28) → 0;
 * manos desnudas (0xFF) → 1; resto: `ATTACK_VALUES[w]`, y si es > 1 y
 * != 99 → `rand(1, valor)` (consume 1 rand).
 */
export function weaponBaseDamage(
  weaponId: number,
  attackValue: number,
  rng: CombatRng,
): WeaponDamageRoll {
  if (weaponId === WEAPON_GLASS_SWORD) return { base: 0x63, shattered: true };
  if (weaponId === WEAPON_JEWELED_SWORD) return { base: 0, shattered: false };
  if (weaponId === WEAPON_BARE_HANDS) return { base: 1, shattered: false };
  let base = attackValue;
  if (base > 1 && base !== 0x63) base = rng.randRange(1, base);
  return { base, shattered: false };
}

/**
 * Resta de defensa — COMBAT:0x12B0 1323-138f: 99 ignora la armadura;
 * si defensa > 0, `daño −= rand(1, defensa)` (consume 1 rand).
 * El resultado puede ser NEGATIVO (→ "grazed").
 */
export function applyDefense(base: number, defense: number, rng: CombatRng): number {
  if (base === 0x63) return 0x63;
  if (defense > 0) return base - rng.randRange(1, defense);
  return base;
}

/**
 * ¿El golpe en curso activa g_5890 (ataque "mágico")? — COMSUBS:0x0C52
 * 0c59-0c5f: `cmp word [bp+4], 0x23; jl skip; mov g_cmb_is_magic, 1`,
 * es decir, id de arma >= 0x23 (chaos sword y superiores). QUIRK del
 * binario: la comparación es de WORD con signo y las manos desnudas
 * (0xFF) pasan por 0x0C52 (COMSUBS:0x0D96 0dc0-0dc4 hace
 * `push 0xff; call 0xc52`), así que 0x00FF >= 0x23 también marca mágico.
 * WEAPON_GENERIC (−1) queda fuera. Los HECHIZOS también activan g_5890
 * (COMBAT:0x8f0) — esa parte llega con Task 3.3 (Cast).
 */
export function weaponIsMagic(weaponId: number): boolean {
  return weaponId >= WEAPON_CHAOS_SWORD;
}

/**
 * Ajustes del defensor ENEMIGO al aplicar daño — COMBAT:0x1574 161a-1645:
 * mitad (división truncada) si es resistente (bit LE 0x20, "undead") y el
 * ataque NO es mágico (g_5890 == 0, ver weaponIsMagic); 0 si es inmune
 * (bit LE 0x08, "immortal").
 */
export function adjustEnemyDamage(
  dmg: number,
  opts: { undead: boolean; immortal: boolean; magicAttack: boolean },
): number {
  let d = dmg;
  if (opts.undead && !opts.magicAttack) d = Math.trunc(d / 2);
  if (opts.immortal) d = 0;
  return d;
}

/** XP por matar — COMBAT:0x1574 167a-1683: `maxHP/4 + 1` (cap 9999 al sumar). */
export function xpForKill(enemyMaxHp: number): number {
  return (enemyMaxHp >> 2) + 1;
}

export interface WoundState {
  /** 1 critical / 2 heavily / 3 lightly / 4 barely wounded. */
  level: number;
  fleeing: boolean;
}

/**
 * Clasificación de herida del enemigo tras un golpe — COMBAT:0x1A5C:
 * base = maxHP>>2; hp<base → nivel 1 + huida; hp<2·base → nivel 2 SIEMPRE
 * ("heavily wounded!"), y si rand0(0x100) > 0xFB (~2 %, consume 1 rand)
 * ADEMÁS huye — el salto de 1ad0 aterriza en 1aa9, DESPUÉS del
 * `mov [bp-4],1` de 1aa4: solo activa el local de huida, el nivel devuelto
 * sigue siendo 2; hp<3·base → 3; si no → 4. El flag de huida del registro
 * se escribe según ese LOCAL (1aff-1b15): se activa si la clasificación lo
 * puso y se LIMPIA en caso contrario.
 */
export function woundClassify(hp: number, maxHp: number, rng: CombatRng): WoundState {
  const base = maxHp >> 2;
  if (hp < base) return { level: 1, fleeing: true };
  if (hp < base * 2) {
    if (rng.rand0(0x100) > 0xfb) return { level: 2, fleeing: true };
    return { level: 2, fleeing: false };
  }
  if (hp < base * 3) return { level: 3, fleeing: false };
  return { level: 4, fleeing: false };
}

export interface ChestRoll {
  chest: boolean;
  trapped: boolean;
}

/**
 * Botín al morir un enemigo — COMBAT:0x1574 172c-1763: cofre si
 * `rand30() <= treasure` (consume 1 rand); si hay cofre, trampa si otro
 * `rand30() < treasure` (consume otro). Sin cofre → mancha de sangre.
 */
export function chestRoll(treasure: number, rng: CombatRng): ChestRoll {
  if (rng.rand30() <= treasure) {
    return { chest: true, trapped: rng.rand30() < treasure };
  }
  return { chest: false, trapped: false };
}

/**
 * Distancia entera del combate — COMSUBS:0x0458/0x048A/0x04D4:
 * `floor(sqrt(dx² + dy²))` (isqrt por resta de impares). Diagonales
 * adyacentes = 1.
 */
export function combatDistance(dx: number, dy: number): number {
  const d2 = dx * dx + dy * dy;
  let si = 1;
  let n = 0;
  let rest = d2;
  while (rest >= si) {
    rest -= si;
    si += 2;
    n++;
  }
  return n;
}

/**
 * Celda aleatoria en el vecindario ±1 — COMSUBS:0x07D4: repite
 * `x' = x + rand(1,3) − 2; y' = y + rand(1,3) − 2` hasta caer en el
 * tablero 0..10 (consume 2 rands POR INTENTO).
 */
export function randomAdjacentCell(
  x: number,
  y: number,
  rng: CombatRng,
): { x: number; y: number } {
  // ── GUARDA DE BOMBA LATENTE (auditoría de la regresión candidata de ad17) ──────────
  // El `for(;;)` de abajo es FIEL (COMSUBS:0x07D4 reintenta hasta caer en el tablero) y
  // termina siempre… MIENTRAS el centro pueda producir alguna celda válida. Como los
  // desplazamientos son ±1, el vecindario 3×3 de (x,y) intersecta `[0,10]²` sólo si
  // `x,y ∈ [−1, 11]`. Con un centro más lejos, NINGÚN intento sería válido y esto
  // **colgaría el renderer** (bucle infinito, no excepción) — la clase de muerte que
  // playwright reporta como «Execution context was destroyed».
  //
  // Hoy el dato NO lo dispara: medido, 0 unidades del `.CBT` con `sprite != 0` caen fuera
  // del 11×11. Pero un objetivo fuera de tablero es alcanzable por otras vías (un futuro
  // teleport/empuje/`summon` con aritmética mala), y un cuelgue duro es el peor modo de
  // fallo posible: sin traza, sin test rojo, sólo una pestaña muerta.
  //
  // La guarda va ANTES del bucle y **no consume RNG**, así que para todo centro válido el
  // comportamiento y el consumo de `rand` son BYTE-IDÉNTICOS: cero riesgo de mover sellos.
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < -1 || x > 11 || y < -1 || y > 11) {
    throw new Error(
      `randomAdjacentCell: centro (${x},${y}) fuera de rango — su vecindario ±1 no ` +
        `intersecta el tablero 0..10, el reintento no terminaría nunca. ` +
        `Llamador con posición inválida (ver re/notes/auditoria-regresion-ad17-lote.md §2).`,
    );
  }
  for (;;) {
    const nx = x + rng.randRange(1, 3) - 2;
    const ny = y + rng.randRange(1, 3) - 2;
    if (nx >= 0 && nx <= 10 && ny >= 0 && ny <= 10) return { x: nx, y: ny };
  }
}

/**
 * Celda aleatoria del tablero (UN intento) — COMBAT:0x120E:
 * `x = rand0(15); y = rand0(15)`; válida solo si ambas ≤ 10.
 * Consume SIEMPRE 2 rands.
 */
export function randomBoardCell(rng: CombatRng): { x: number; y: number } | null {
  const x = rng.rand0(0xf);
  const y = rng.rand0(0xf);
  if (x > 10 || y > 10) return null;
  return { x, y };
}

/**
 * Colocación del monstruo INVOCADO en combate — CAST2.OVL:0x4c2 (bucle 0x4ec–0x521,
 * bail 0x542). HASTA `maxAttempts` intentos; cada intento invoca el picker de tablero
 * `0x120e` (=`randomBoardCell`: `rand0(15)²`, aceptada sólo si ambas ≤10). El picker es
 * GLOBAL al tablero 11×11 — NO local al caster (el "radio" 8/5 del cast/pergamino va a un
 * init intra-overlay `0x4de call 0`, no acota el sorteo). Una tirada FUERA de la reja (>10)
 * devuelve `null` y **cuenta como intento gastado** (`0x4ef or ax,ax; je 0x518` → `inc j`);
 * NO reintenta gratis — por eso el picker se llama tal cual y su fallo se consume con
 * `continue`, preservando el consumo de 2 rands/intento. Si la celda cae en reja, se valida
 * con `isFree` (pasable `0x9b96` + desocupada `0x6222`≠0xff); la primera válida spawnea.
 * Agotados los intentos ⇒ `null` (bail: el maná/hechizo YA se gastó, no aparece criatura).
 *
 * Oráculo relevo-5 (`re/notes/summon-gate-resolved.md`) resolvió el caveat del label
 * file-relativo de overlay: el `call 0x9cb6` de CAST2 EJECUTA `0x7e96`→COMBAT.OVL:0x120e,
 * i.e. el picker de tablero — NO un picker local. Esto CORRIGE witness #5
 * (`witness-summon-position.md`), que tomó el label file-relativo por una rutina distinta
 * "local-al-caster con radio". El ⚠ Clase-C del nº exacto de rands DENTRO del kernel del
 * picker sigue abierto (`randomBoardCell` modela 2 rands/intento, la mecánica observable).
 */
export function pickSummonCell(
  rng: CombatRng,
  maxAttempts: number,
  isFree: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const cell = randomBoardCell(rng); // 0x120e: 2 rands SIEMPRE; null si fuera de reja
    if (!cell) continue; // tirada fuera de reja = intento gastado (0x4ef je 0x518)
    if (isFree(cell.x, cell.y)) return cell; // pasable + desocupada → spawn
  }
  return null; // 8 intentos agotados → bail (CAST2:0x542), sin criatura
}
