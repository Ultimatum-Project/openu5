/**
 * CANAL DE FX DEL MUNDO (#201) — pintado efímero SOBRE UNA CELDA fuera de combate.
 *
 * 🔴 POR QUÉ EXISTE UN CANAL NUEVO, habiendo una regla de casa que dice «reusa lo que
 * haya». Porque el censo REFUTÓ la premisa de esa regla, y el lead la levantó con la razón
 * escrita (ruling del 12-08, ficha #201). Lo medido:
 *   · La primitiva de pintar-sobre-celda del port es `CombatFx kind:"hitFlash"`, y NO sirve
 *     aquí: `skin/fiel/skin.ts:3101-3102` la pinta sólo bajo `snap.combatView` y, en la
 *     rama contraria, LIMPIA la capa (`else if (this.combatFx.active) this.combatFx.clear()`).
 *     No es que no se vea: es que se borra activamente al no estar en arena.
 *   · La sacudida SÍ tenía camino de mundo y este canal NO la duplica: `{kind:"quake"}` es un
 *     `GameEvent` del core (`core/game.ts:347`) que `shrine-ceremonies.ts:299` ya emite ×3
 *     citando el mismo `kernel 0x3072`. El ritual la emite igual — por ahí, no por aquí.
 * ⇒ lo ÚNICO que no tenía vía era el blit de tile sobre una celda del mundo, y eso es lo
 * único que este fichero añade: UN kind y su pintor. `CombatFx` queda intacto (sus veredictos
 * están firmados); esto es un hermano, no una ampliación.
 * 🔴 Y el TRANSPORTE tampoco es nuevo, a propósito: el evento viaja en el batch de
 * `notifyTurn` como `quake`, porque ahí la premisa de «reusa lo que haya» NO está refutada —
 * los eventos del turno SÍ llegan a las pieles fuera de combate. Añadir un bus paralelo
 * habría sido duplicar el que ya funciona.
 *
 * 🔴 PIEL SHADER: YA NO ESTÁ PENDIENTE (#243). Esta cabecera decía «Hoy sólo pinta
 * `skin/fiel` … quien juegue el ritual con la piel shader NO verá la explosión», y eso era
 * exactamente lo que el usuario reportó el 16-08 («no hay ningún efecto explosión») desde
 * openu5.org, donde la piel de FÁBRICA es la shader (`main.ts:596`). MEDIDO sobre su vídeo
 * `Shadowlords.MP4` (13,87 s con pista de audio, diffs de fotograma a 10 fps): la sacudida da
 * siete picos de magnitud ~13,2 entre 1,80 y 4,10 s y a partir de 4,20 s el fotograma NO
 * CAMBIA hasta el final — en la ventana donde tocaba la ráfaga el ruido de fondo es 0,03-0,16,
 * un discriminante de ×100 contra los picos de la sacudida. No era el ORDEN: era que nadie
 * la pintaba.
 * ⇒ hoy la pintan las dos: la fiel desde `fiel/skin.ts` y la shader llamando a
 * `FaithfulSkin.paintWorldFxInto` desde su paso (2e-bis), calcado de lo que ya hacía con
 * `paintCombatFxInto`. Es una instancia más de la CLASE #253 (la shader RECOMPONE el viewport
 * por su cuenta y tapa lo que la fiel hornea), la misma que su propio paso (2f) documenta para
 * el terremoto — y el remedio es el de (2f), no el de View Gem: aquí no hay que declinar nada,
 * hay que volver a pintar.
 *
 * DERIVACIÓN del efecto (`CAST.OVL:0x16f4` → `explosion_fx_at_cell`, `ULTIMA.EXE:0x3522`):
 * siete veces sobre la celda `(party_x, party_y − 1)` — blit del tile 0 (que en TileData se
 * llama `Explosion`) + `noise_burst(2000,3000,10)` + `viewport_redraw`. El nº de repeticiones
 * (7) y la celda son DERIVADOS; la cadencia entre blits es Clase C (no está en el binario como
 * constante legible: la marca el propio `viewport_redraw` a ritmo de fotograma).
 */

// El banco alto de sprites vive en `render/`, y ESTA capa es `skin/`, que sí puede importarlo
// (mismo patrón que `skin/campScene.ts:31`). El core NO puede — Regla A de
// `tests/skin-import-guard.test.ts`—, y por eso el banqueo del `underTile` se hace aquí.
import { SPRITE_BANK } from "../render/tileanim.js";

/** Tile que blitea `explosion_fx_at_cell` (TileData lo nombra `Explosion`). */
export const EXPLOSION_TILE = 0;

/**
 * Unidad de las PAUSAS de `0x3ae6` — la MISMA calibración que el port ya usa para
 * `pauseUnits` en el guión del peaje (`core/game.ts:1354`, `n × 55 ms`). Se reusa el número
 * en vez de inventar otro: si esa calibración se corrige, las dos se corrigen juntas.
 */
export const PAUSE_UNIT_MS = 55;

/** Duración de cada blit de la ráfaga (Clase C declarada: ritmo de `viewport_redraw`). */
export const EXPLOSION_BURST_MS = 60;

/**
 * CADENCIA DEL VUELO DEL CAÑONAZO — 🔴 **CLASE C TOMADA EN PRÉSTAMO, NO DERIVADA** (#313).
 *
 * El vuelo del proyectil del cañón vive tras `call 0xffffbc6a` = `lcall 0x72E:0x2EC` (base
 * COMSUBS 0xBF80 sobre 0xffffbc6a → 0x7BEA), un far-call cuyo SEGMENTO se reubica en carga:
 * **opaco a la lectura estática** (ficha #311; ya Clase-C en `serpent-ranged-derivation.md` §4).
 * Del disasm salen la ESTRUCTURA (un vuelo por disparo, origen y destino, alcance) pero **no
 * los FOTOGRAMAS**: ni cuántos, ni su retardo, ni si hay estela o humo.
 *
 * Lo de abajo son los 55 ms/celda del proyectil de COMBATE (`skin/fiel/combat.ts`
 * `PROJECTILE_MS_PER_CELL`), prestados por ser el efecto hermano ya calcado. Se copia el
 * NÚMERO, no la acreditación: aquel está calibrado contra su propio testigo y éste **no tiene
 * ninguno**. Va suelto a propósito —no importado— porque el día que aparezca un testigo del
 * cañón se recalibra AQUÍ sin tocar el de combate: son dos sujetos, no una constante
 * compartida (misma clase que los 55 ms del paso de cama en `ui/bed-sleep.ts`).
 */
export const PROJECTILE_MS_PER_CELL_BORROWED = 55;

/** Lado del glifo del proyectil, en píxeles lógicos 320×200. Presentación pura. */
export const PROJECTILE_DOT_PX = 4;

/** Color del glifo — el mismo blanco del misil de combate. Presentación pura. */
export const PROJECTILE_DOT_COLOR = "#ffffff";

/** Kind del canal para la EXPLOSIÓN sobre celda (#201). */
export interface WorldFxExplosion {
  kind: "cellExplosion";
  /**
   * Celda como DESPLAZAMIENTO respecto al grupo (el snapshot no lleva la posición absoluta,
   * y el binario la expresa igual: `(party_x, party_y − 1)` en `CAST 0x16ad`). En el ritual
   * es (0, −1). La piel lo suma al centro de su ventana 11×11, que es donde va el grupo.
   */
  dx: number;
  dy: number;
  /** Nº de blits: 7 en el ritual (`CAST 0x16f4`). */
  bursts: number;
  /** Pausa DERIVADA que precede a la ráfaga, en unidades de `0x3ae6` (3 en el ritual). */
  preDelayUnits: number;
  /**
   * ESPERA, en ms, ANTES de la pausa de `preDelayUnits` (#243). Es todo lo que en el binario
   * ocurre entre el instante en que el jugador pulsa y el primer `explosion_fx_at_cell`, y que
   * el port no puede expresar en unidades de `0x3ae6` porque son cosas de otro reloj: la cola
   * del AUDIO BLOQUEANTE (el barrido de `CAST 0x15dd-0x162a` es lo PRIMERO del ritual y gira
   * hasta acabar), la `pause(7)` de `CAST 0x1674` y la SACUDIDA ×3 de `0x169d/0x16a0/0x16a3`.
   * Quien lo calcula es la piel, que es la única que conoce las duraciones de su catálogo de
   * audio y de su `QuakeShake`; el core sólo dice QUÉ va antes (el orden de su array).
   * Durante toda la espera el fx ya está VIVO: es lo que mantiene `underTile` en la celda.
   */
  leadMs?: number;
  /**
   * Tile que sigue viéndose en la celda MIENTRAS dura el fx (#243). En el ritual es el
   * Shadowlord (`0x1FC`, banco alto): en el binario los escritos de estado van DESPUÉS de las
   * siete explosiones (`CAST 0x1708` tras `0x16e1-0x16fa`), así que el sprite está ahí toda la
   * coreografía; en el port `removeShadowlordAt` muta `worldObjects` de forma SÍNCRONA y la
   * piel pinta del snapshot ya commiteado, así que sin esto la celda enseña la Llama desde el
   * primer fotograma. `undefined` = comportamiento previo (sólo la ráfaga).
   *
   * 🔴 POR QUÉ ESTA VÍA Y NO LA MUTACIÓN DIFERIDA (las dos que el acta §5.1 dejó abiertas).
   * Diferir la escritura de estado hasta el final de la coreografía haría el orden fiel «por
   * construcción», pero mueve el ciclo de vida del ritual al core: durante 10 s el Shadowlord
   * no estaría muerto, un guardado o un cierre de pestaña en medio perdería la gesta, y todo
   * llamador que no pase por el pacer de presentación (tests, grabador, e2e) dejaría de
   * commitear. Lo que el JUGADOR observa del orden es exactamente el sprite bajo la ráfaga, y
   * eso es lo que esta vía da, sin tocar estado, RNG ni guardado. La otra queda declarada, no
   * descartada: si algún día el core gana un mecanismo de mutación diferida, esto sobra.
   *
   * ⚠ CABO ABIERTO Y DECLARADO (acta `shadowlord-av-243.md` §2.3): que el sprite siga visible
   * DEBAJO de las siete explosiones es lo que SUGIERE el orden del código, pero NO está
   * establecido — los dos thunks `0xbb9e`/`0xbb92` de `CAST 0x16d6-0x16de` no están resueltos
   * (clase #81) y uno de ellos podría retirar el objeto antes del bucle. Lo que sí está
   * establecido, y es la mitad que ningún testigo puede refutar: durante la `pause(7)`, las
   * TRES sacudidas y la `pause(3)` el objeto está en la tabla POR FUERZA, porque el gate de
   * `0x16ad-0x16c1` lee el tile de esa celda y exige `0xFC` DESPUÉS de las sacudidas.
   *
   * 🔴 EL VALOR VIAJA CRUDO, SIN BANCO: es el byte de ranura (0xFC en el ritual), no el índice
   * de sprite. Esta capa le suma `SPRITE_BANK` al blitear, porque el banco alto es espacio de
   * RENDER y `core/` no puede importarlo (Regla A de `tests/skin-import-guard.test.ts` — la
   * versión anterior mandaba el índice ya banqueado y la guarda la tumbó, con razón).
   */
  underTile?: number;
}

/**
 * VUELO DEL CAÑONAZO (#313) — UN fx por disparo, en las DOS superficies del binario.
 *
 * DERIVADO (CMDS.OVL): el binario pide el vuelo **una sola vez por disparo, no por celda** —
 * `push origX / origY / dstX / dstY / 1` → `call 0xffffbc6a`, en los TRES call-sites del
 * comando: andanada con impacto (0x0A45, destino = celda del objeto), andanada sin impacto
 * (0x0AD2, destino = final del rayo) y cañón a pie (0x0CFE). Coordenadas de VENTANA 11×11;
 * aquí viajan como DESPLAZAMIENTO respecto al grupo (que va en el centro), igual que el
 * `cellExplosion` de arriba y por la misma razón: el snapshot no lleva la posición absoluta.
 *
 * 🔴 El ORIGEN **no es el mismo en las dos superficies**, y no es un detalle de adorno:
 *   · ANDANADA: `push 5 / push 5` (0x0A48-0x0A49) = el centro de la ventana ⇒ la bala sale
 *     del BARCO, desplazamiento (0, 0).
 *   · A PIE: `[bp-6]`/`[bp-0xa]`, fijados en 0x0BAD/0x0BB9 a `dir±1 + 5` y **jamás
 *     re-escritos en el bucle** ⇒ la bala sale de la celda del CAÑÓN, no del grupo.
 * La cadencia, en cambio, es prestada — ver `PROJECTILE_MS_PER_CELL_BORROWED`.
 */
export interface WorldFxProjectile {
  kind: "cellProjectile";
  /** Origen, como desplazamiento respecto al grupo: (0,0) andanada · celda del cañón a pie. */
  fromDx: number;
  fromDy: number;
  /** Destino: celda de impacto, o última celda del rayo si no impactó. */
  toDx: number;
  toDy: number;
}

export type WorldFx = WorldFxExplosion | WorldFxProjectile;

interface Live {
  fx: WorldFx;
  t0: number;
}

/**
 * Capa con estado: guarda los fx vivos con su instante de arranque y los va apagando solos.
 * No conoce el atlas — la piel le pasa un `blit`, así que este fichero no se acopla a ninguna.
 */
export class WorldFxLayer {
  private live: Live[] = [];

  push(fx: WorldFx, now: number): void {
    this.live.push({ fx, t0: now });
  }

  get active(): boolean {
    return this.live.length > 0;
  }

  clear(): void {
    this.live = [];
  }

  /** Celdas que recorre un vuelo (Chebyshev, mínimo 1 para no dividir por cero). */
  static projectileCells(fx: WorldFxProjectile): number {
    return Math.max(1, Math.abs(fx.toDx - fx.fromDx), Math.abs(fx.toDy - fx.fromDy));
  }

  /** ms totales que ocupa un fx desde su arranque (espera y pausa previas incluidas). */
  static durationMs(fx: WorldFx): number {
    if (fx.kind === "cellProjectile") {
      return WorldFxLayer.projectileCells(fx) * PROJECTILE_MS_PER_CELL_BORROWED;
    }
    return (
      (fx.leadMs ?? 0) + fx.preDelayUnits * PAUSE_UNIT_MS + fx.bursts * EXPLOSION_BURST_MS
    );
  }

  /**
   * Posición INTERPOLADA del proyectil vivo, o null si no hay ninguno. **Función PURA: no
   * purga ni avanza nada** — existe para que la piel SHADER pueda pintarlo sobre su viewport
   * ya compuesto sin robarle el ciclo de vida a la fiel, que es quien lo posee (mismo trato
   * que `timeSpellInvertsAt`). Si la consumiera, la fiel se quedaría sin su propio fotograma.
   */
  projectileAt(now: number): { dx: number; dy: number } | null {
    for (const item of this.live) {
      const fx = item.fx;
      if (fx.kind !== "cellProjectile") continue;
      const dur = WorldFxLayer.durationMs(fx);
      const dt = now - item.t0;
      if (dt < 0 || dt >= dur) continue;
      const f = dt / dur;
      return {
        dx: fx.fromDx + (fx.toDx - fx.fromDx) * f,
        dy: fx.fromDy + (fx.toDy - fx.fromDy) * f,
      };
    }
    return null;
  }

  /**
   * Pinta los fx vivos y purga los caducados. Los dos pintores reciben DESPLAZAMIENTOS
   * respecto al grupo; traducirlos a píxeles es cosa de la piel, que es quien sabe dónde cae.
   * `blit` blitea un tile en una celda entera; `dot` marca un punto en coordenadas
   * FRACCIONARIAS (el proyectil vive entre celdas, y por eso no le vale `blit`).
   *
   * Orden de capas por fotograma, calcado del binario: primero el `underTile` (lo que la celda
   * SIGUE teniendo — `viewport_redraw` lo repinta entre blit y blit), y ENCIMA la explosión
   * cuando toca. Con `underTile` sin dar, el comportamiento es el previo a #243.
   */
  paint(
    now: number,
    painter: {
      blit: (tile: number, dx: number, dy: number) => void;
      dot: (dx: number, dy: number) => void;
    },
  ): void {
    const survivors: Live[] = [];
    for (const item of this.live) {
      const fx = item.fx;
      const dt = now - item.t0;
      if (dt >= WorldFxLayer.durationMs(fx)) continue; // caducado
      survivors.push(item);
      if (fx.kind === "cellProjectile") {
        const at = this.projectileAt(now);
        if (at) painter.dot(at.dx, at.dy);
        continue;
      }
      if (dt < 0) continue; // agendado a futuro: aún no ha empezado
      // El tile que el original tiene en la celda durante TODA la coreografía (el Shadowlord
      // en el ritual). Va primero para que la ráfaga caiga ENCIMA, no al lado.
      // `+ SPRITE_BANK` AQUÍ y no en el core: el descriptor trae el byte de ranura CRUDO y el
      // banco alto es espacio de RENDER (`core/` no puede importarlo — Regla A de
      // `tests/skin-import-guard.test.ts`). Es el mismo reparto que hace el binario, donde el
      // slot guarda 0xFC y quien pinta del banco de móviles es el blit de celda
      // (`FONT.OVL 0x02a2`/`0x02e3` ⇒ 0x1FC `ShadowLord1`; sin la suma, `Bellows1` de #195).
      if (fx.underTile !== undefined) painter.blit(fx.underTile + SPRITE_BANK, fx.dx, fx.dy);
      const afterLead = dt - (fx.leadMs ?? 0);
      if (afterLead < 0) continue; // esperando al audio bloqueante / a la sacudida
      const afterPause = afterLead - fx.preDelayUnits * PAUSE_UNIT_MS;
      if (afterPause < 0) continue; // aún en la pausa: se oye el silencio, no se pinta
      // Los blits alternan presencia/ausencia: el original re-pinta el viewport entre uno y
      // otro, así que la celda parpadea. Pintar los 7 seguidos daría un tile FIJO 420 ms.
      const idx = Math.floor(afterPause / EXPLOSION_BURST_MS);
      if (idx % 2 === 0) painter.blit(EXPLOSION_TILE, fx.dx, fx.dy);
    }
    this.live = survivors;
  }
}
