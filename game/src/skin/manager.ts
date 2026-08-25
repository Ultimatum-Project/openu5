/**
 * SkinManager — monta/desmonta pieles en caliente sobre el core vivo (E1-S1).
 *
 * El swap es atómico desde el punto de vista del juego: el core no se entera
 * (ningún estado de juego vive en la piel). `swapping` evita re-entrada si el
 * mount es asíncrono (la piel dev carga el atlas PixiJS).
 *
 * Pieles USER-FACING vs DEBUG: cada piel se registra con un flag `userFacing`
 * (default true) y una etiqueta legible. El ciclo (F9 / botón "Cambiar piel" /
 * switcher directo) recorre SÓLO las user-facing. La piel `dev` se registra como
 * NO user-facing (task #79): sigue montable por `?skin=dev` (arnés de pureza de
 * render + paneles DOM dev-only), pero desaparece del ciclo y del switcher.
 */
import type { CoreView, IntentSink, Skin } from "./api.js";

/** Piel expuesta al usuario: id + etiqueta legible para el switcher / Vídeo. */
export interface SkinChoice {
  id: string;
  label: string;
}

export class SkinManager {
  private skins = new Map<string, Skin>();
  /** Orden de registro de TODAS las pieles (incluida dev). */
  private order: string[] = [];
  /** Orden SÓLO de las pieles user-facing — el que recorre el ciclo/switcher. */
  private userOrder: string[] = [];
  private labels = new Map<string, string>();
  private current: Skin | null = null;
  private swapping = false;

  constructor(
    private root: HTMLElement,
    private view: CoreView,
    private intents: IntentSink,
  ) {}

  register(skin: Skin, opts?: { userFacing?: boolean; label?: string }): void {
    this.skins.set(skin.id, skin);
    this.order.push(skin.id);
    this.labels.set(skin.id, opts?.label ?? skin.id);
    if (opts?.userFacing !== false) this.userOrder.push(skin.id);
  }

  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  /** Etiqueta legible de la piel activa (o del id si no hay etiqueta). */
  get currentLabel(): string | null {
    if (!this.current) return null;
    return this.labels.get(this.current.id) ?? this.current.id;
  }

  /**
   * ¿Tiene la piel ACTIVA un efecto AV transitorio vivo? (#207). `null` = no hay piel
   * montada, o la que hay no declara la propiedad.
   *
   * 🔴 EL SUJETO ES **LA ACTIVA**, y no es un matiz: la propiedad que el grabador de
   * partidas necesita es «la piel QUE ESTÁ PINTANDO tiene un fx vivo». Un OR sobre las
   * pieles registradas —la alternativa que se descartó— daría `true` por un efecto en una
   * piel que no pinta: mentira útil hoy y defecto mañana. Además sería una ENUMERACIÓN, y
   * el registro crece (hoy fiel + shader + un prototipo tras bandera).
   *
   * 🔴 Y ES UN PREDICADO, NO EL OBJETO: se expone lo que hace falta saber, no la piel
   * entera, para que nadie acabe leyendo estado interno de la activa desde fuera.
   *
   * Nace de un defecto MEDIDO: `ShaderSkin` instancia SU PROPIA `FaithfulSkin` interna
   * (`skin/shader/skin.ts`), así que preguntar a una instancia FIJA de piel fiel devolvía
   * `false` para siempre cuando la shader era la activa —que es el régimen del vídeo—, y el
   * grabador seguía decapitando los efectos con el arreglo puesto y los tests en verde.
   */
  get transientFxActive(): boolean | null {
    return this.current?.transientFxActive ?? null;
  }

  /** Pieles ofrecidas al usuario (el switcher las lista; dev queda fuera). */
  get userFacingSkins(): SkinChoice[] {
    return this.userOrder.map((id) => ({ id, label: this.labels.get(id) ?? id }));
  }

  /**
   * Devuelve `true` si REALMENTE cambió de piel, `false` si no hizo nada. El booleano
   * existe porque el call-site no podía distinguir «cambié» de «no hice nada»: con el
   * antiguo `Promise<void>`, `swap().then(afterSkinChange)` corría el `then` IGUAL en la
   * salida temprana y persistía como preferencia la piel que ya estaba montada — o sea,
   * una piel que el jugador NO eligió. (Medido 2026-07-25 en el diagnóstico del F9:
   * `skinPref` quedaba en "faithful" tras pulsar F9, que es la huella de que
   * `afterSkinChange` había corrido sin que hubiera swap.)
   */
  async swap(id: string): Promise<boolean> {
    const next = this.skins.get(id);
    // Ya estamos en esa piel: no-op BENIGNO y esperado (un segundo click en la activa).
    // No se avisa — sería ruido.
    if (next === this.current) return false;
    if (!next) {
      console.warn(`[skins] swap("${id}") ignorado: no hay ninguna piel registrada con ese id`);
      return false;
    }
    if (this.swapping) {
      console.warn(`[skins] swap("${id}") ignorado: hay otro swap en curso (re-entrada)`);
      return false;
    }
    this.swapping = true;
    const prev = this.current;
    try {
      prev?.unmount();
      this.current = next;
      await next.mount(this.root, this.view, this.intents);
    } catch (err) {
      // ROLLBACK (auditoría R4): si el mount de la piel nueva falla en un swap en
      // caliente, sin esto quedaba el canvas negro (la anterior ya desmontada) y la
      // promesa rechazada sin manejar. Se re-monta la piel anterior (best-effort;
      // sus assets ya estaban cargados) y se re-lanza para que el caller decida.
      //
      // LIMPIEZA DEL MOUNT PARCIAL (banco present()/mount()): un mount que lanza a
      // medias deja DOM/listeners ya creados bajo `root` (p.ej. la shader monta su
      // host oculto CON la fiel dentro antes de poder fallar). El contrato exige
      // unmount() tolerante a mount parcial (api.ts §Skin), así que se desmonta la
      // fallida ANTES de re-montar la anterior — sin esto el rollback apilaba dos
      // pieles bajo `root` (listeners y relojes duplicados de la huérfana).
      try {
        next.unmount();
      } catch (cleanupErr) {
        console.warn("[skins] unmount de la piel con mount fallido lanzó:", cleanupErr);
      }
      if (prev) {
        this.current = prev;
        try {
          await prev.mount(this.root, this.view, this.intents);
        } catch (rollbackErr) {
          console.warn("[skins] rollback tras mount fallido también falló:", rollbackErr);
        }
      }
      throw err;
    } finally {
      this.swapping = false;
    }
    return true;
  }

  /**
   * Cicla a la siguiente piel USER-FACING (tecla de swap / botón). No-op con <2
   * pieles user-facing. Si la actual no es user-facing (p.ej. dev vía ?skin=dev),
   * `indexOf` da -1 y `(-1+1)%N === 0` entra por la primera del ciclo.
   */
  async toggle(): Promise<boolean> {
    // SALIDA SILENCIOSA (era): durante el arranque hay una ventana en la que sólo está
    // registrada la primera piel — `register()` de la shader corre DESPUÉS de que la fiel
    // ya tenga canvas visible. Un F9 en esa ventana caía aquí y NO HACÍA NADA: sin efecto
    // visible, sin aviso, y con el `then(afterSkinChange)` del call-site persistiendo la
    // piel actual como si el jugador la hubiera elegido. Ahora lo dice y devuelve `false`.
    if (this.userOrder.length < 2 || !this.current) {
      console.warn(
        `[skins] toggle() NO-OP: el ciclo aún no está listo ` +
          `(pieles user-facing: ${this.userOrder.length}, actual: ${this.current?.id ?? "ninguna"}). ` +
          `La tecla de cambio de piel llegó antes de que terminara el registro del arranque.`,
      );
      return false;
    }
    const idx = this.userOrder.indexOf(this.current.id);
    return this.swap(this.userOrder[(idx + 1) % this.userOrder.length]!);
  }
}
