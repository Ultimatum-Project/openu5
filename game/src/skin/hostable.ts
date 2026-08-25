/**
 * ALOJAMIENTO DE PIELES — el contrato que una piel ENVOLTORIO (hoy `PortraitSkin`)
 * necesita de la piel que aloja dentro. LOTE C del diagnóstico smooth×portrait
 * (`re/notes/diagnostico-smooth-portrait.md` §2.2 y §4).
 *
 * POR QUÉ EXISTE. Hasta el 27-07 `PortraitSkin` alojaba una instancia FIJA de la fiel
 * (`private readonly faithful = new FaithfulSkin()`), así que «smooth + layout partido»
 * era imposible POR CONSTRUCCIÓN — no por una decisión de producto. El diagnóstico midió
 * los dos bloqueos: (a) `ShaderSkin` no publicaba los CINCO miembros que el composer
 * consume, y (b) alojada en un host 0×0 la shader colapsaba su backbuffer a ×1 y el pase
 * xBR dejaba de suavizar. Esta interfaz es la respuesta al bloqueo (a); `setHostedScale`
 * + `hostedSource` lo son al (b).
 *
 * QUÉ NO ES. No es una interfaz «de pieles»: `Skin` (api.ts) sigue siendo el contrato con
 * el `SkinManager`. Ésta es la superficie EXTRA que hace falta para que una piel pueda ser
 * la FUENTE DE PÍXELES de otra. Se declara aquí, y no en `api.ts`, para que quede claro
 * que ninguna piel está obligada a poder ser alojada.
 *
 * NOTA DE ALCANCE (por qué `skin/fiel/` no se toca): `FaithfulSkin` ya satisface esta
 * interfaz TAL CUAL — los cinco miembros son públicos suyos desde antes (`fiel/skin.ts`
 * `consoleScrollLines` :1967, `consoleScrollActive` :1981, `panelListOpen` :1990,
 * `panelScrollLines` :2002, `sourceFrameGen` :2656). Los dos métodos de alojamiento son
 * OPCIONALES justamente para eso: sin ellos el envoltorio se comporta EXACTAMENTE como
 * antes (canvas único bajo el host, escala 1). Cero líneas editadas en `skin/fiel/`.
 */
import type { Skin } from "./api.js";

/** De dónde salen los píxeles del alojado, y a qué escala respecto de los 320×200. */
export interface HostedSource {
  /** Canvas cuyo BACKBUFFER lee el envoltorio (no su caja CSS: el host está oculto). */
  canvas: HTMLCanvasElement;
  /**
   * Píxeles de backbuffer por píxel lógico de los 320×200. Entero ≥ 1. La fiel vale 1
   * (su canvas ES 320×200); la shader vale su escala entera S (`shaderCanvasSize`), que es
   * el MISMO layout 320×200 multiplicado — por eso los rects fuente del composer sólo
   * necesitan multiplicarse por este número.
   */
  scale: number;
}

/**
 * Piel que puede ser alojada dentro de otra como fuente de píxeles.
 *
 * Los cinco primeros miembros son los que `PortraitSkin` consume del alojado; los dos
 * últimos son OPCIONALES y sólo los necesita una piel cuyo canvas no sea el 320×200 crudo.
 */
export interface HostableSkin extends Skin {
  /** ¿Cruce de moongate en curso? (el gate modal de `main.ts` pregunta a cada piel). */
  readonly transiting: boolean;
  /** Generación del canvas fuente: el GATE DE SUCIEDAD del envoltorio se apoya en esto. */
  readonly sourceFrameGen: number;
  /** ¿El scrollback de consola está activo? (enruta la costura de la fila 10). */
  readonly consoleScrollActive: boolean;
  /** ¿Hay una lista de Ztats abierta? (hit-test del panel). */
  readonly panelListOpen: boolean;
  /**
   * ¿Las dos sub-cajas del panel (roster · comida/oro/fecha) están FUNDIDAS en una sola
   * porque un overlay limpió el panel entero? Enruta el filo inferior de los KPIs cuando
   * el historial le quita al portrait la fila fuente 80 — ver `filo-kpis-acta.md`.
   */
  readonly panelBoxesFused: boolean;
  consoleScrollLines(delta: number): void;
  panelScrollLines(delta: number): void;
  /**
   * Canvas fuente + su escala. Sin implementar ⇒ el envoltorio busca el ÚNICO canvas bajo
   * su host y asume escala 1 (comportamiento histórico con la fiel). Con la shader alojada
   * el sondeo por DOM NO valdría: bajo el host hay DOS canvas (el 320×200 de la fiel que
   * la shader envuelve, y el suyo a ×S), y `querySelector` devolvería el equivocado.
   */
  hostedSource?(): HostedSource | null;
  /**
   * Fija la escala de la fuente, o `null` para que la piel vuelva a decidirla midiendo su
   * contenedor. EXISTE PORQUE EL HOST ESTÁ OCULTO: una piel que deriva su escala de
   * `container.clientWidth` mide 0 ahí y cae a ×1 — medido en el diagnóstico (§3, probe3).
   * El anfitrión, que sí sabe a qué tamaño va a pintar cada región, es quien puede decidir.
   */
  setHostedScale?(scale: number | null): void;
}
