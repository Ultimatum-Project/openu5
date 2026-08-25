/**
 * CURSOR de la ventana REGISTER de la posada (#283) — calco del bucle modal de
 * `SHOPPES3.OVL:0x063a-0x06f2`, la mitad de conducta de la ventana enmarcada que
 * `skin/fiel/innRegister.ts` dibuja.
 *
 * El binario NO usa letras: pinta una barra XOR sobre el huésped resaltado y la mueve
 * con los códigos de dirección que devuelve `getkey_with_redraw` (kernel 0x266c). El
 * despacho, leído entero en `0x0668-0x06ee`:
 *
 * | código | destino | qué hace |
 * |---|---|---|
 * | 1, 3 | `0x067c` → `0x0494` | huésped ANTERIOR (índice de roster a la baja) |
 * | 2, 4 | `0x06a4` → `0x04b6` | huésped SIGUIENTE |
 * | 0x0d | `0x06d4` | CONFIRMA el resaltado |
 * | 0x20 | `0x06d4` | CONFIRMA — el espacio es el hermano de Enter, no un cancelar |
 * | 0x1b | `0x06c8` | cancela: imprime `No one\n\n` (DS 0x4fd8) y deja selección 0 |
 * | otro | `0x06f0` | `sub si,si` → vuelve a `0x0660` a leer tecla, SIN mover |
 *
 * ★ El ESPACIO CONFIRMA, al revés que en el picker «Arms» del herrero
 * (`shopArmsPicker.ts`, donde `" "` cae en el mismo brazo que `Escape`). Los dos son
 * ventanas enmarcadas del panel derecho y por eso invita a copiar el reductor de al
 * lado; pero `0x06eb cmp ax,0x20 / je 0x6d4` salta al MISMO destino que `0x0d`, no al
 * de `0x1b`. Copiar el vocabulario del vecino habría hecho que el espacio se llevara
 * un `No one` que el original no imprime.
 *
 * SIN ENVOLVIMIENTO en los extremos: `0x0494`/`0x04b6` devuelven 0 («no encontrado»)
 * al pasarse, y `0x069e or si,si / je` cae en `0x06a2 jmp 0x660` — vuelve a leer tecla
 * con la barra QUIETA. No salta al otro extremo de la lista.
 */

/** Estado del cursor: índice DENTRO de la lista de huéspedes pintada (0-based). */
export interface InnRegisterModel {
  cursor: number;
}

export type InnRegisterAction =
  | { kind: "none" }
  | { kind: "move"; model: InnRegisterModel }
  /** Enter/Espacio (`0x06d4`): se cobra el huésped resaltado. */
  | { kind: "pick"; index: number }
  /** ESC (`0x06c8`): `No one\n\n` y salida sin cobrar. */
  | { kind: "cancel" };

export function initInnRegister(): InnRegisterModel {
  return { cursor: 0 };
}

/**
 * Reductor de una tecla. `guestCount` es la población PINTADA (la del bucle de nombres
 * `0x05fb-0x062e`), que es la misma que recorren los dos buscadores — ver el §ranura-0
 * de `innRegister.ts`.
 */
export function innRegisterKey(
  model: InnRegisterModel,
  key: string,
  guestCount: number,
): InnRegisterAction {
  const moveTo = (raw: number): InnRegisterAction => {
    if (guestCount <= 0) return { kind: "none" };
    // Clamp, NO módulo: los buscadores del binario devuelven el centinela 0 al pasarse
    // y el bucle re-lee tecla sin mover la barra (0x069e→0x06a2).
    const cursor = Math.max(0, Math.min(guestCount - 1, raw));
    if (cursor === model.cursor) return { kind: "none" };
    return { kind: "move", model: { cursor } };
  };
  switch (key) {
    case "ArrowUp":
    case "Up":
    case "ArrowLeft":
    case "Left":
      return moveTo(model.cursor - 1); // códigos 1 y 3 → 0x0494 (anterior)
    case "ArrowDown":
    case "Down":
    case "ArrowRight":
    case "Right":
      return moveTo(model.cursor + 1); // códigos 2 y 4 → 0x04b6 (siguiente)
    case "Enter":
    case " ":
    case "Spacebar":
      // 0x0d y 0x20 comparten destino 0x06d4: los DOS confirman.
      return guestCount > 0 ? { kind: "pick", index: model.cursor } : { kind: "none" };
    case "Escape":
      return { kind: "cancel" };
    default:
      return { kind: "none" };
  }
}
