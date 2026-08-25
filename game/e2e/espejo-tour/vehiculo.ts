/**
 * CONDUCIR EL VEHÍCULO QUE LA RUTA YA DECLARA — carril `espejo-vuelo`.
 *
 * ## Qué es `v` y de dónde sale (DERIVADO, no supuesto)
 *
 * Cada `NavRun` de las rutas del espejo trae `v` = el vehículo con el que el LP dio ese
 * paso. `tools/segment.mjs:108-137` lo pliega del VERBO que el OCR leyó delante del rumbo
 * (`VEH_SPELLINGS`), y ese verbo lo imprime el binario en `transport_face` **MAINOUT
 * 0x00DA**, que lee `g_transport_tile`, hace `and ax,0xFC` y despacha por clase. El port ya
 * tiene la función INVERSA —`core/world/transport.ts:203 faceVerb`, con la tabla del disasm
 * en su propia cabecera (:177-201)—, así que el mapeo `v` → clase de transporte no hay que
 * inventarlo: se lee de los dos lados y casa uno a uno.
 *
 * | `v` del corpus | verbo (DATA.OVL) | tile base | `TransportMode` del port |
 * |---|---|---|---|
 * | `ride` | `"Ride "` DS 0x2946 | `0x10` | `horse`  |
 * | `fly`  | `"Fly "`  DS 0x294C | `0x14` | `carpet` |
 * | `row`  | `"Row "`  DS 0x2951 | `0x28` | `skiff`  |
 * | `head` | `"Head "` DS 0x2956 | `0x20` | `ship`   |
 * | `walk` | — (no imprime)      | `0x1c` | `foot`   |
 *
 * Censo sobre las 24 rutas de LP1 (9 542 pasos, `v` presente en el 100 %): walk 4 941
 * (51,8 %) · **fly 3 454 (36,2 %)** · ride 602 (6,3 %) · head 446 (4,7 %) · row 99 (1,0 %).
 * No hay ningún sexto valor y no hay ni un paso sin `v`.
 *
 * ## 🔴 POR QUÉ `walk` NO SE CONDUCE — y no es prudencia, es que NO ES UNA OBSERVACIÓN
 *
 * Las otras cuatro etiquetas son POSITIVAS: el OCR leyó un verbo. `walk` es el **default
 * cuando no casó ningún verbo** (`segment.mjs:135`, `m[1] ? … : "walk"`), así que un `walk`
 * del corpus no afirma «iba a pie»: afirma «no vi verbo». Y hay una fuente MEDIDA de
 * `walk` que NO es ir a pie — la **asimetría de la fragata**, derivada en
 * `transport.ts:195-199` del disasm: caballo, alfombra y esquife imprimen el verbo en TODO
 * pulsado, pero la fragata imprime `"Head "` **sólo si el facing CAMBIÓ** (`0x0181 cmp` →
 * si es igual salta a 0x01DC). ⇒ una fragata navegando en línea recta imprime el rumbo
 * PELADO y el plegador la etiqueta `walk`. Los 446 `head` de LP1 son los VIRAJES, no las
 * singladuras.
 *
 * Por eso `walk` se trata como SIN DATO y jamás dispara un desembarco: conducir
 * `walk → desmontar` tiraría a la party de la fragata en cada tramo recto. Es la misma
 * clase de error que el aserto que sólo niega lo incorrecto — la etiqueta que parece
 * informativa es la única que no lo es.
 *
 * ## Qué hace este módulo
 *
 * Decisión PURA (`decideVehiculo`) + aplicador (`aplicaVehiculo`). El aplicador es un
 * ARNÉS DE RESINCRONIZACIÓN declarado, hermano de `recruit`/`teleport`/`entryClock`: pone
 * el transporte VIVO del port en la clase que el LP tenía en ese paso. No se conduce por
 * teclas porque el embarque del LP no está en la ruta como tecla sino como `todo` (§4 de
 * `re/notes/espejo-resiembra.md`: `{"todo": "Use item Item: Carpet Boarded!"}`), y porque
 * el port no tiene el vehículo en el inventario en ese punto de la cadena (medido abajo).
 *
 * 🔴 **Y por eso mismo LLEVA EL REPARO DE NO-COMPARABILIDAD** (§(b) de la adjudicación,
 * `espejo-cadena-party-muerta.md:403-408`): montar un vehículo que el port no tiene es
 * FABRICAR estado, exactamente como sembrar oro. Una parte con `vehiculo.aplicado` NO es
 * comparable con una medida en cadena, y el reporte lo dice con esas palabras.
 *
 * ## El material sobre el que se aplica (medido al byte en las 24 semillas de LP1)
 *
 * Offsets del códec del port (`core/saveNative.ts:68` `TRANSPORT_TILE_OFFSET = 0x2d6`,
 * `:365` `magicCarpets = gam[0x20a]`, `:119-125` obj0 `+5` casco / `+7` esquifes):
 *
 * ```
 * part05-06  0x1c a pie   carpets=1              ← la alfombra existe
 * part07     0x1c a pie   carpets=0              ← se pierde en la costura part06|part07
 * part08     0x23 FRAGATA carpets=0 skiffs=0 hull=96   6/6 vivos
 * part09-11  0x00 *AHOGO* carpets=0 skiffs=0     0/6
 * part19-24  0x00 *AHOGO* carpets=0 skiffs=0     0/6
 * ```
 *
 * `0x00` es `TILE_DROWN` (`transport.ts:570`, «a pie EN el agua»), y lo escribe UNA sola
 * ruta: `damage_ship` **MAINOUT 0x1120**, la rama de `sinkPlayerShip` que se toma cuando la
 * fragata se hunde **sin esquife y sin alfombra** (`transport.ts:603-631`, prioridad
 * skiff > alfombra > ahogo). Ver §«ahogo» del reporte del carril: las NUEVE semillas de
 * LP1 con `0x00` son EXACTAMENTE las nueve que la adjudicación lista con la party a 0/6.
 */

/** Las cinco etiquetas del corpus. Cerrado: el censo de las 49 rutas no produce ninguna más. */
export type Vehiculo = "walk" | "fly" | "ride" | "row" | "head";
/** Clase gruesa de passability del port (`core/state.ts:213`, `transport.ts:168`). */
export type ModoTransporte = "foot" | "carpet" | "horse" | "skiff" | "ship";

/** `v` → clase de transporte. Inversa de `faceVerb` (`transport.ts:203`, MAINOUT 0x00DA). */
export const VEH_A_MODO: Record<Vehiculo, ModoTransporte> = {
  walk: "foot",
  fly: "carpet",
  ride: "horse",
  row: "skiff",
  head: "ship",
};

/**
 * `v` → tile BASE (`transport.ts:33-52`).
 *
 * 🔴 **`ride` es 0x12 y NO 0x10.** `0x10`/`0x11` es el caballo **del mundo, SIN JINETE**;
 * montar hace `+2` (`transport.ts:678`, rama caballo de `board`). Escribir 0x10 dejaría al
 * port «siendo un caballo suelto» en vez de ir montado. Los dos pasan el mismo
 * `transportBase` (0x10) y por tanto el mismo `transportMode`, así que **el modo NO
 * distingue el error**: hay que mirar el tile.
 */
export const VEH_A_TILE: Record<Vehiculo, number> = {
  walk: 0x1c, // TILE_FOOT
  fly: 0x14, // TILE_CARPET, cara ESTE
  ride: 0x12, // caballo MONTADO cara ESTE (0x10 + 2)
  row: 0x28, // TILE_SKIFF
  head: 0x20, // TILE_FRIGATE_SAILS_UP
};

/** turn_arg por dirección — MAINOUT 0x04D3 (`transport.ts:211-217`): N→0, E→1, S→2, O→3. */
export const TURN_ARG: Record<string, number> = { north: 0, east: 1, south: 2, west: 3 };

/**
 * Tile CON FACING para un vehículo y una dirección.
 *
 * 🔴 Las dos familias NO comparten fórmula, y confundirlas fabrica tiles que no existen:
 *  - **barcos** (esquife 0x28-0x2B, fragata 0x20-0x27) tienen CUATRO sprites y giran con
 *    `(tile & 0xFC) + facing` — `transport.ts:228` `faceTile`, derivado de las ramas
 *    NAVALES de `transport_face` (esquife 0x0152, fragata 0x016a), que CALCULAN.
 *  - **caballo y alfombra** tienen sólo **DOS** (Este y Oeste) y las ramas del binario
 *    escriben LITERALES (`0x0111`/`0x011e`): Norte y Sur **dejan el tile intacto**
 *    (`transport.ts:275-282` `mountFaceTile`, `MOUNT_FACING_TILES` :242-245).
 *    Aplicarles `+facing` daría 0x16/0x17 (alfombra) y 0x14/0x15 (caballo) — tiles de OTRA
 *    clase o inexistentes.
 */
export function tileParaVehiculo(v: Vehiculo, dir: string): number {
  const base = VEH_A_TILE[v];
  const facing = TURN_ARG[dir] ?? 0;
  if (v === "fly") return facing === 3 ? 0x15 : 0x14; // alfombra: O→0x15, resto→0x14
  if (v === "ride") return facing === 3 ? 0x13 : 0x12; // caballo montado: O→0x13, resto→0x12
  if (v === "row" || v === "head") return base + facing; // barcos: cuatro sprites
  return base; // a pie
}

/**
 * Casco con el que se repone una fragata resincronizada: `HULL_MAX` (`transport.ts:56`), que
 * es EL MISMO valor con el que el port abordera una fragata por el camino real
 * (`game.ts:4552` `hull: HULL_MAX`, CMDS 0x0D7B `mov byte [bx+5],0x63`). No es un número
 * elegido: es el que el binario escribe al subir a bordo.
 *
 * ★★ 🔴 ESTA CONSTANTE ESTUVO DECLARADA Y SIN USAR, y eso hundió la cadena (carril
 * `espejo-cadena-limpia`, 22-08). `aplicaVehiculo` escribía por la vía `tile` **sólo**
 * `transportTile`/`transport`, así que la fragata FABRICADA nacía con `shipHull = 0` —
 * el valor de la semilla, donde no hay nave. Un casco a 0 se hunde con el PRIMER daño
 * (`game.ts:1893` resta y `transport.ts` sinkea cuando el daño ≥ casco), y sin esquife ni
 * alfombra el desenlace es el ahogo. Medido en UNA sola parte encadenada (part07, brazo con
 * el defecto): **10 `COLLISION!` → 10 `Ship sunk!` → 8 `DROWNING!!!`**, contra los `Ship
 * sunk!`×2 / `DROWNING!!!`×0 que el corpus del LP entero declara. O sea: el arnés que se
 * escribió para EVITAR el ahogo lo FABRICABA cinco veces por parte.
 * El mismo agujero en `shipSkiffs` (un esquife fabricado tampoco existía como inventario),
 * que es justo la primera rama de la prioridad `skiff > alfombra > ahogo` de `sinkPlayerShip`.
 */
export const HULL_MAX = 0x63;

export function esVehiculo(v: string): v is Vehiculo {
  return v === "walk" || v === "fly" || v === "ride" || v === "row" || v === "head";
}

/** Estado VIVO de transporte leído del port (sonda read-only). */
export interface TransporteVivo {
  transport: ModoTransporte;
  transportTile: number;
  magicCarpets: number;
  shipSkiffs: number;
  shipHull: number;
}

export interface PlanVehiculo {
  /** `v` del paso, tal cual viene de la ruta. */
  declarado: string;
  /** Clase que el LP tenía, o `null` si `declarado` no es del vocabulario cerrado. */
  modoDeseado: ModoTransporte | null;
  /** Clase que el port tiene AHORA. */
  modoVivo: ModoTransporte;
  /** ¿Hay que mover el transporte del port? */
  aplica: boolean;
  /** Tile a escribir (base + facing), sólo si `aplica`. */
  tile: number | null;
  /** Por qué se aplicó o por qué no. Va literal al reporte. */
  motivo: string;
  /**
   * 🔴 El vehículo NO ESTÁ en el inventario del port y hay que FABRICARLO para montarlo.
   * Es el trozo que rompe la comparabilidad; se marca aparte del resto para que no se
   * confunda «reconciliar un vehículo que tengo» con «inventarme uno que no tengo».
   */
  fabricado: string | null;
  /**
   * Cómo se monta: `use-carpet` = camino ORGÁNICO del port (`Game.useMagicCarpet`, la
   * misma op que el LP dio y que hoy la ruta trae como `todo`); `tile` = escritura del
   * byte de transporte (no hay camino orgánico sin un objeto del mundo bajo la party).
   */
  via: "use-carpet" | "tile" | null;
}

/**
 * DECISIÓN PURA — qué hacer con el `v` de un paso.
 *
 * Orden de las guardas, y cada una tiene su porqué:
 *  1. `walk` → NUNCA (ver cabecera: no es una observación, y la fragata recta lo produce).
 *  2. vocabulario desconocido → NUNCA (no invento una clase para una etiqueta que no derivé).
 *  3. ya conforme → NUNCA (no tocar lo que ya casa: un resync inútil consumiría estado).
 *  4. resto → resincronizar, marcando `fabricado` si el port no tiene el vehículo.
 */
export function decideVehiculo(
  declarado: string,
  vivo: TransporteVivo,
  dir: string,
  habilitado: boolean,
): PlanVehiculo {
  const base: Omit<PlanVehiculo, "aplica" | "tile" | "motivo" | "fabricado" | "via"> = {
    declarado,
    modoDeseado: esVehiculo(declarado) ? VEH_A_MODO[declarado] : null,
    modoVivo: vivo.transport,
  };
  const no = (motivo: string): PlanVehiculo => ({
    ...base,
    aplica: false,
    tile: null,
    motivo,
    fabricado: null,
    via: null,
  });

  if (!habilitado) return no("modo-off");
  if (!esVehiculo(declarado)) return no(`vocabulario-desconocido:${declarado}`);
  if (declarado === "walk") {
    // Ver cabecera §🔴. NO es «por si acaso»: la fragata en línea recta se etiqueta `walk`.
    return no("walk-no-es-observacion (default de segment.mjs:135 + fragata recta MAINOUT 0x0181)");
  }
  const deseado = VEH_A_MODO[declarado];
  if (vivo.transport === deseado) return no(`ya-conforme:${deseado}`);

  // Qué le falta al port para poder estar en ese vehículo. El binario NO permite montar
  // una alfombra que no tienes (`g_carpets`), así que si no la hay, montarla es FABRICAR.
  let fabricado: string | null = null;
  if (deseado === "carpet" && vivo.magicCarpets < 1) fabricado = "alfombra (g_carpets=0 en la semilla)";
  if (deseado === "ship" && vivo.shipHull < 1) fabricado = "fragata (casco=0: no hay nave en el estado)";
  if (deseado === "skiff" && vivo.shipSkiffs < 1) fabricado = "esquife (g_skiffs=0 en la semilla)";
  if (deseado === "horse") fabricado = "caballo (el port no lleva contador de monturas en el estado)";

  return {
    ...base,
    aplica: true,
    tile: tileParaVehiculo(declarado, dir),
    motivo: `resync ${vivo.transport} → ${deseado}`,
    fabricado,
    // La alfombra tiene camino ORGÁNICO en el port (`Game.useMagicCarpet`, CAST.OVL 0x1862):
    // imprime «Carpet»/«Boarded!», tira 1 del RNG para el facing y decrementa g_carpets.
    // Es la MISMA operación que el corpus trae como `todo` («Use item Item: Carpet
    // Boarded!»), así que ahí no fabricamos un tile: conducimos la op del LP.
    via: deseado === "carpet" ? "use-carpet" : "tile",
  };
}

/** Contadores por parte, para el bloque del reporte. */
export interface VehiculoReport {
  habilitado: boolean;
  /**
   * ¿Se repuso el inventario del vehículo fabricado (casco/esquife)? Va AL REPORTE porque es
   * lo que distingue los dos brazos: un reporte que no lo dijera sería indistinguible del de
   * la cadena que se hundía diez veces por parte.
   */
  reponInventario: boolean;
  /** Resyncs efectivamente aplicados. */
  aplicados: number;
  /** Fragatas y esquifes fabricados a los que se les REPUSO el inventario (0 → 99 / 0 → 1). */
  inventarioRepuesto: number;
  /** Pasos vistos por etiqueta declarada (censo de lo que la ruta pedía). */
  pasosPorVehiculo: Record<string, number>;
  /** Resyncs por transición, p. ej. `"foot→carpet": 3`. */
  transiciones: Record<string, number>;
  /** Vehículos que hubo que FABRICAR (rompe comparabilidad), con su cuenta. */
  fabricados: Record<string, number>;
  /** El aviso del §(b), literal, cuando se aplicó algo. */
  aviso: string | null;
}

export function reporteVehiculoVacio(habilitado: boolean, reponInventario = true): VehiculoReport {
  return {
    habilitado,
    reponInventario,
    aplicados: 0,
    inventarioRepuesto: 0,
    pasosPorVehiculo: {},
    transiciones: {},
    fabricados: {},
    aviso: null,
  };
}

export const AVISO_NO_COMPARABLE =
  "PARTE CON TRANSPORTE RESINCRONIZADO: su conformidad NO es comparable con una medida en cadena " +
  "(el arnés puso el vehículo que el LP declaraba y, donde el port no lo tenía, lo FABRICÓ). " +
  "Ver §(b) de re/notes/espejo-cadena-party-muerta.md.";

/** Acumula un plan en el reporte de la parte. Mutador explícito (el runner lo llama por paso). */
export function acumulaVehiculo(rep: VehiculoReport, plan: PlanVehiculo): void {
  rep.pasosPorVehiculo[plan.declarado] = (rep.pasosPorVehiculo[plan.declarado] ?? 0) + 1;
  if (!plan.aplica) return;
  rep.aplicados += 1;
  const k = `${plan.modoVivo}→${plan.modoDeseado}`;
  rep.transiciones[k] = (rep.transiciones[k] ?? 0) + 1;
  if (plan.fabricado) rep.fabricados[plan.fabricado] = (rep.fabricados[plan.fabricado] ?? 0) + 1;
  rep.aviso = AVISO_NO_COMPARABLE;
}

/**
 * Cuenta una reposición de inventario que DE VERDAD ocurrió (casco 0→99, esquife 0→1).
 *
 * Va aparte de `acumulaVehiculo` porque se cuenta lo APLICADO y no lo planeado: el plan sabe
 * que el vehículo falta, pero sólo el aplicador sabe si el campo se movió. Contar el plan
 * daría la cifra correcta también con el escritor borrado — el contador que no puede bajar
 * cuando el código se rompe no es un contador.
 */
export function acumulaInventario(rep: VehiculoReport, ap: AplicadoVehiculo): void {
  if (ap.hullDespues > ap.hullAntes || ap.skiffsDespues > ap.skiffsAntes) rep.inventarioRepuesto += 1;
}

/** SONDA read-only del transporte vivo. No consume turno ni RNG. */
export async function sondaVehiculo(page: import("@playwright/test").Page): Promise<TransporteVivo> {
  const r = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __u5test: {
          game: {
            state: {
              transport: string;
              transportTile?: number;
              magicCarpets: number;
              shipSkiffs?: number;
              shipHull?: number;
            };
          };
        };
      }
    ).__u5test.game.state;
    return {
      transport: s.transport,
      transportTile: s.transportTile ?? 0x1c,
      magicCarpets: s.magicCarpets ?? 0,
      shipSkiffs: s.shipSkiffs ?? 0,
      shipHull: s.shipHull ?? 0,
    };
  });
  return r as TransporteVivo;
}

/** Lo que efectivamente pasó al aplicar un plan (para el reporte y para los asertos). */
export interface AplicadoVehiculo {
  tileAntes: number;
  tileDespues: number;
  carpetsAntes: number;
  carpetsDespues: number;
  /** Casco ANTES/DESPUÉS. `0 → 99` es la reposición de una fragata fabricada; `n → n` dice
   *  que la nave ya existía y no se tocó, que es lo que hace legible el resync. */
  hullAntes: number;
  hullDespues: number;
  skiffsAntes: number;
  skiffsDespues: number;
  /** Líneas que el port emitió por el camino orgánico (vacío en la vía `tile`). */
  echo: string[];
}

/**
 * APLICADOR.
 *
 * Vía `use-carpet` (la buena): repone `g_carpets` a 1 si está a 0 —eso es lo FABRICADO y va
 * al reporte— y llama a `Game.useMagicCarpet()`, que es público (`game.ts:6017`) y hace el
 * camino real del binario (CAST.OVL 0x1862 → 0x18a1): echo «Carpet»/«Boarded!», `rand(0,1)`
 * para el facing y `dec g_carpets`. Los eventos se empujan por `__u5test.applyEvents` para
 * que el eco entre en el transcript como cualquier otra op conducida.
 *
 * Vía `tile`: escribe **los DOS campos**, réplica de `Game.syncTransportFromTile`
 * (`game.ts:4521-4524`, privado y por eso replicado y no llamado).
 * 🔴 Escribir sólo `state.transport` es la trampa de `DebugApi.setTransport`
 * (`debug/debugApi.ts:412-415`): deja `transportTile` rancio, el renderer sigue pintando el
 * vehículo viejo y `board()`/`exitVehicle()` —que leen el BYTE— siguen viendo el anterior.
 */
export async function aplicaVehiculo(
  page: import("@playwright/test").Page,
  plan: PlanVehiculo,
  /**
   * ¿Reponer el INVENTARIO del vehículo fabricado (casco de la fragata, esquife a bordo)?
   *
   * `true` (default) = conducta correcta: fabricar una fragata es fabricar `hull = HULL_MAX`,
   * el mismo valor que escribe `board()` (ver la cabecera de `HULL_MAX`). `false` reproduce
   * la conducta HISTÓRICA —tile sin inventario— y existe SÓLO para poder correr el brazo
   * pareado que la mide (`U5_ESPEJO_VEHICULO_CASCO=0`); es el brazo, no una opción de uso.
   */
  reponInventario = true,
): Promise<AplicadoVehiculo> {
  return (await page.evaluate(
    ({ tile, via, repon, hullMax }) => {
      const t = (
        window as unknown as {
          __u5test: {
            game: {
              state: {
                transport: string;
                transportTile?: number;
                magicCarpets: number;
                shipHull?: number;
                shipSkiffs?: number;
              };
              useMagicCarpet?: () => Array<{ text?: string; message?: string }>;
            };
            applyEvents?: (ev: unknown[]) => void;
          };
        }
      ).__u5test;
      const s = t.game.state;
      const tileAntes = s.transportTile ?? 0x1c;
      const carpetsAntes = s.magicCarpets ?? 0;
      const hullAntes = s.shipHull ?? 0;
      const skiffsAntes = s.shipSkiffs ?? 0;
      const echo: string[] = [];
      if (via === "use-carpet" && typeof t.game.useMagicCarpet === "function") {
        if ((s.magicCarpets ?? 0) < 1) s.magicCarpets = 1; // ← lo FABRICADO
        const ev = t.game.useMagicCarpet();
        for (const e of ev) {
          const line = e?.text ?? e?.message;
          if (typeof line === "string") echo.push(line);
        }
        t.applyEvents?.(ev as unknown[]);
      } else {
        // réplica de syncTransportFromTile: LOS DOS campos, nunca sólo `transport`
        s.transportTile = tile as number;
        const b = (tile as number) & 0xfc;
        s.transport =
          b === 0x10 ? "horse" : b === 0x14 ? "carpet" : b === 0x28 ? "skiff"
          : ((tile as number) & 0xf8) === 0x20 ? "ship" : "foot";
        // ★★ EL INVENTARIO DEL VEHÍCULO FABRICADO, no sólo su tile (ver cabecera de
        // HULL_MAX). Un tile de fragata sobre `shipHull = 0` es una nave que se hunde con
        // el primer daño; un tile de esquife sobre `shipSkiffs = 0` no es un esquife a
        // bordo, y es justo la primera rama de `sinkPlayerShip`. Sólo se REPONE: si la
        // nave ya tiene casco (la party venía navegando de verdad) no se toca.
        if (repon) {
          if (s.transport === "ship" && (s.shipHull ?? 0) < 1) s.shipHull = hullMax as number;
          if (s.transport === "skiff" && (s.shipSkiffs ?? 0) < 1) s.shipSkiffs = 1;
        }
      }
      return {
        tileAntes,
        tileDespues: s.transportTile ?? 0x1c,
        carpetsAntes,
        carpetsDespues: s.magicCarpets ?? 0,
        hullAntes,
        hullDespues: s.shipHull ?? 0,
        skiffsAntes,
        skiffsDespues: s.shipSkiffs ?? 0,
        echo,
      };
    },
    { tile: plan.tile, via: plan.via, repon: reponInventario, hullMax: HULL_MAX },
  )) as AplicadoVehiculo;
}

export function resumenVehiculo(rep: VehiculoReport): string {
  if (!rep.habilitado) return "vehiculo: modo-off (el `v` de la ruta NO se conduce — camino histórico)";
  const pasos = Object.entries(rep.pasosPorVehiculo)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  const trans = Object.entries(rep.transiciones)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}×${v}`)
    .join(" ");
  const fab = Object.entries(rep.fabricados)
    .map(([k, v]) => `${k}×${v}`)
    .join(" · ");
  return (
    `vehiculo: ON · pasos[${pasos}] · resyncs=${rep.aplicados}` +
    (trans ? ` [${trans}]` : "") +
    (fab ? ` · 🔴 FABRICADO: ${fab}` : "") +
    ` · inventario ${rep.reponInventario ? `REPUESTO×${rep.inventarioRepuesto}` : "NO repuesto (brazo histórico: la fragata fabricada nace con casco 0 y se hunde al primer daño)"}` +
    (rep.aviso ? `\n  ⚠ ${rep.aviso}` : "")
  );
}
