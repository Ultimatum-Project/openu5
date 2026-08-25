/**
 * ESCENA del santuario / cámara del Codex (ficha #277) — guion PURO derivado de
 * `enter_shrine_scene_dispatch` (CAST2.OVL 0x0e76), el WRAPPER que el port no había
 * portado. El texto de la ceremonia (world/shrine-ceremonies.ts) ya era fiel; lo que
 * faltaba era la ESCENA: mapa propio, caminata por el sendero y arrodillarse ante el
 * altar EN PANTALLA.
 *
 * 🔴 La escena NO vive en `shrine_visit` (0x0966) — ésa es sólo el interrogatorio. Todo
 * lo visual lo monta 0x0e76 ANTES de llamarla (`0x106c call 0x966`), y lo desmonta al
 * volver (0x1075-0x10a4). El único gesto visual DENTRO de shrine_visit es el tile de
 * arrodillado (0x09a1).
 *
 * SECUENCIA MEDIDA (cuerpo leído, CAST2.OVL):
 *   0x0ea4  g_location = 0xFF        → régimen de buffer 0xAD14 (el de las arenas)
 *   0x0ed2  carga el mapa 11×11 de MISCMAPS.DAT (176 santuario / 352 Codex) — ver
 *           `extractor/src/parsers/shrine-scene.ts`
 *   0x0f41  primer repintado: la explanada SIN nadie
 *   0x0f80  `mov si,4` + bucle 0x0f83 `call 0xe64` → CUATRO cues con la escena VACÍA
 *   0x0f89  `mov al,0x1c`  → tile del actor 0 = Avatar DE PIE
 *   0x0f91  `[+2] = 5`     → x = 5
 *   0x0f96  `[+3] = 0xa`   → y = 10  (borde sur, al pie del sendero)
 *   0x0fa1  un cue más: el Avatar APARECE abajo
 *   0x1042  `mov ax,4` (santuario) / 0x1048 `mov ax,7` (Codex) = nº de pasos
 *   0x105c  `dec byte [g_char_anim_states+3]` + 0x1060 `call 0xe64`, en bucle → sube al
 *           NORTE un paso por cue: (5,10)→(5,6) en el santuario, →(5,3) en el Codex
 *   0x09a1  `mov al,0x6c` → tile del actor 0 = ARRODILLADO, y entonces imprime
 *           «...and thou dost kneel before the Altar.» (buffer 0xb58b)
 *   0x1075  `mov al,0x1c` → se LEVANTA al volver de la ceremonia
 *   0x1084  lee y, y si < 10 desanda al SUR (`inc [+3]`) un paso por cue hasta y=10
 *   0x10a6  borra el actor y 0x10b1 da CUATRO cues más con la escena ya vacía
 *   0x10e7  restaura g_location  ·  0x10ed advance_clock(0x10) = +16 min
 *
 * `spectacle_cue` (0x0e64) = `beep_ticks(1)` + `sfx_footstep` + `beep_ticks(4)`, y
 * `beep_ticks` (kernel 0x3ae6) NO es un beep: es RUN-N-FRAMES (repintado + espera de un
 * tick INT 1Ch por iteración), la MISMA primitiva que pacea el cruce de trolls. ⇒ un cue
 * = 5 fotogramas + el sonido de UN paso. La unidad de tiempo es la del troll (≈54,9 ms);
 * el pacer la inyecta (`ui/shrine-scene.ts`), como en `TrollSneak`.
 *
 * ⚠ Los tiles del actor van en el espacio de ACTORES (tileset − 0x100): 0x1c → 0x11c
 * `BasicAvatar` y 0x6c → 0x16c `Begger1`, el sprite encorvado que el original reusa como
 * postura de arrodillado. Es el MISMO `+0x100` que ya aplican NPCs, botín y el Shadowlord
 * convocado. Aquí se emiten YA sumados: el consumidor pinta el tile tal cual.
 *
 * Módulo PURO: no toca estado, ni RNG, ni reloj. El avance de 16 min lo aplica el core
 * al cerrar la escena, no este guion.
 */

/** Cuál de los dos mapas de MISCMAPS monta la escena (discriminante: tile bajo la party). */
export type ShrineSceneKind = "shrine" | "codex";

/** Rejilla 11×11 de una escena (shrine-scene.json del extractor). */
export type ShrineSceneTiles = readonly (readonly number[])[];

/** Un fotograma del guion: dónde está el Avatar (o `null` = escena vacía) y su tile. */
export interface ShrineSceneBeat {
  /** Celda del Avatar en coords de la rejilla 11×11, o `null` si aún/ya no está. */
  avatar: { x: number; y: number; tile: number } | null;
  /** ¿Este beat suena a paso? (`sfx_footstep` dentro de `spectacle_cue` 0x0e64). */
  footstep: boolean;
  /** Fotogramas de espera del beat = los del `spectacle_cue` (5 = beep_ticks 1+4). */
  frames: number;
}

/** Guion completo de una mitad de la escena (entrada o salida). */
export interface ShrineSceneScript {
  kind: ShrineSceneKind;
  tiles: ShrineSceneTiles;
  beats: ShrineSceneBeat[];
}

/** Tile del actor 0 con el Avatar DE PIE (CAST2 0x0f89/0x1075 `mov al,0x1c`), banco alto. */
export const SHRINE_AVATAR_TILE = 0x1c + 0x100; // 284 BasicAvatar
/** Tile del actor 0 ARRODILLADO (CAST2 0x09a1 `mov al,0x6c`), banco alto. */
export const SHRINE_KNEEL_TILE = 0x6c + 0x100; // 364 Begger1
/** Celda de entrada de la party (CAST2 0x0f91/0x0f96): pie del sendero, borde sur. */
export const SHRINE_ENTRY = { x: 5, y: 10 } as const;
/** Fotogramas de un `spectacle_cue` (0x0e64: beep_ticks(1) + paso + beep_ticks(4)). */
export const CUE_FRAMES = 5;
/** Cues con la escena VACÍA antes de colocar al Avatar (0x0f80 `mov si,4`) y al salir
 *  (0x10b1, el mismo cuatro). */
export const EMPTY_CUES = 4;

/**
 * Pasos al norte por escena (CAST2 0x1042 `mov ax,4` / 0x1048 `mov ax,7`). El destino sale
 * de restarlos a la entrada: santuario (5,10)→(5,6), justo al SUR del brasero de (5,5);
 * Codex (5,10)→(5,3), justo al sur del atril de (5,2).
 */
export const SHRINE_STEPS: Readonly<Record<ShrineSceneKind, number>> = {
  shrine: 4,
  codex: 7,
};

/** Celda en la que el Avatar termina la caminata (y se arrodilla), por escena. */
export function shrineAltarStand(kind: ShrineSceneKind): { x: number; y: number } {
  return { x: SHRINE_ENTRY.x, y: SHRINE_ENTRY.y - SHRINE_STEPS[kind] };
}

/**
 * Guion de ENTRADA (0x0f7b-0x1064): cuatro cues vacíos → aparece de pie en (5,10) → un cue
 * → sube un paso por cue hasta la celda del altar → se arrodilla (el tile 0x6c de 0x09a1,
 * que el original escribe ya dentro de shrine_visit, justo antes de imprimir el kneel).
 */
export function buildShrineEnterScript(
  kind: ShrineSceneKind,
  tiles: ShrineSceneTiles,
): ShrineSceneScript {
  const beats: ShrineSceneBeat[] = [];
  // 0x0f80-0x0f87: la explanada sola, cuatro cues (= la captura del usuario en la que sólo
  // se ve el altar). Suenan: el paso va DENTRO del cue, no cuelga de que haya actor.
  for (let i = 0; i < EMPTY_CUES; i++) {
    beats.push({ avatar: null, footstep: true, frames: CUE_FRAMES });
  }
  // 0x0f89-0x0fa1: colocación + un cue → el Avatar aparece de pie al pie del sendero.
  let y = SHRINE_ENTRY.y;
  beats.push({
    avatar: { x: SHRINE_ENTRY.x, y, tile: SHRINE_AVATAR_TILE },
    footstep: true,
    frames: CUE_FRAMES,
  });
  // 0x105c-0x1064: un `dec y` + un cue por paso.
  for (let i = 0; i < SHRINE_STEPS[kind]; i++) {
    y -= 1;
    beats.push({
      avatar: { x: SHRINE_ENTRY.x, y, tile: SHRINE_AVATAR_TILE },
      footstep: true,
      frames: CUE_FRAMES,
    });
  }
  // 0x09a1: el tile de arrodillado + repintado (`call 0x7730` = viewport_redraw). NO es un
  // cue: no hay `call 0xe64` — de ahí `footstep:false` y un solo fotograma.
  beats.push({
    avatar: { x: SHRINE_ENTRY.x, y, tile: SHRINE_KNEEL_TILE },
    footstep: false,
    frames: 1,
  });
  return { kind, tiles, beats };
}

/**
 * Guion de SALIDA (0x1075-0x10bd): se levanta (tile 0x1c) → desanda al sur un paso por cue
 * hasta (5,10) → desaparece → cuatro cues con la explanada vacía. Tras esto el core
 * restaura la localización (0x10e7) y avanza el reloj 16 min (0x10ed).
 */
export function buildShrineExitScript(
  kind: ShrineSceneKind,
  tiles: ShrineSceneTiles,
): ShrineSceneScript {
  const beats: ShrineSceneBeat[] = [];
  let y = shrineAltarStand(kind).y;
  // 0x1075: `mov al,0x1c` + repintado — se pone DE PIE sin cue (mismo patrón que el kneel).
  beats.push({
    avatar: { x: SHRINE_ENTRY.x, y, tile: SHRINE_AVATAR_TILE },
    footstep: false,
    frames: 1,
  });
  // 0x109c-0x10a4: `inc y` + cue por paso, hasta y=10 (el bucle cuenta 10−y, 0x1091-0x1097).
  while (y < SHRINE_ENTRY.y) {
    y += 1;
    beats.push({
      avatar: { x: SHRINE_ENTRY.x, y, tile: SHRINE_AVATAR_TILE },
      footstep: true,
      frames: CUE_FRAMES,
    });
  }
  // 0x10a6-0x10bd: borra el actor (`[+0]=0`) y cuatro cues con la escena ya vacía.
  for (let i = 0; i < EMPTY_CUES; i++) {
    beats.push({ avatar: null, footstep: true, frames: CUE_FRAMES });
  }
  return { kind, tiles, beats };
}

/** Minutos que consume la escena entera (CAST2 0x10ed `push 0x10; call advance_clock`). */
export const SHRINE_SCENE_MINUTES = 0x10; // 16
