/**
 * Tests del reductor de teclas de la ventana «Arms» de venta del herrero
 * (`core/shops/shopArmsPicker.ts`, T-004b): navegación ↑/↓ con scroll de página de 4
 * (`list_wares` SHOPPES.OVL 0x0c80: contenido rel 1..4 — cursor arranca en rel 1
 * @0x0d43 y el bucle corta al llegar la fila a 5 @0x0d9d; corrección carril
 * buy-herrero), Enter = pick del ítem
 * bajo la barra, Space/ESC = cancel (vuelta al menú Buy/Sell). Modelo PURO.
 */
import { describe, it, expect } from "vitest";
import {
  SHOP_ARMS_VISIBLE_ROWS,
  initShopArmsPicker,
  shopArmsKey,
  type ShopArmsModel,
} from "../src/core/shops/shopArmsPicker.js";

const m = (cursor: number, scroll: number): ShopArmsModel => ({ cursor, scroll });

describe("shopArmsKey — navegación ↑/↓ con página de 4", () => {
  it("página de 4 filas (contenido rel 1..4; cmp ax,5 @0x0d9d corta el bucle)", () => {
    expect(SHOP_ARMS_VISIBLE_ROWS).toBe(4);
  });

  it("estado inicial: barra en el primer ítem, sin scroll", () => {
    expect(initShopArmsPicker()).toEqual({ cursor: 0, scroll: 0 });
  });

  it("↓ mueve una fila; en el último ítem no hace nada (clamp sin wrap)", () => {
    const act = shopArmsKey(m(0, 0), "ArrowDown", 4);
    expect(act).toEqual({ kind: "move", model: { cursor: 1, scroll: 0 } });
    expect(shopArmsKey(m(3, 0), "ArrowDown", 4)).toEqual({ kind: "none" });
  });

  it("↑ mueve una fila; en el primero no hace nada", () => {
    expect(shopArmsKey(m(2, 0), "ArrowUp", 4)).toEqual({
      kind: "move",
      model: { cursor: 1, scroll: 0 },
    });
    expect(shopArmsKey(m(0, 0), "ArrowUp", 4)).toEqual({ kind: "none" });
  });

  it("↓ más allá de la 4ª fila visible desliza la ventana (scroll mínimo)", () => {
    // 7 ítems: cursor 3 (última visible con scroll 0) + ↓ → cursor 4, scroll 1.
    expect(shopArmsKey(m(3, 0), "ArrowDown", 7)).toEqual({
      kind: "move",
      model: { cursor: 4, scroll: 1 },
    });
    // Y hasta el fondo: cursor 6, scroll 3 (ventana 3..6).
    expect(shopArmsKey(m(5, 2), "ArrowDown", 7)).toEqual({
      kind: "move",
      model: { cursor: 6, scroll: 3 },
    });
  });

  it("↑ por encima del primer visible desliza la ventana hacia arriba", () => {
    expect(shopArmsKey(m(2, 2), "ArrowUp", 7)).toEqual({
      kind: "move",
      model: { cursor: 1, scroll: 1 },
    });
  });
});

describe("shopArmsKey — pick / cancel / resto", () => {
  it("Enter elige el ítem bajo la barra (venta)", () => {
    expect(shopArmsKey(m(2, 0), "Enter", 4)).toEqual({ kind: "pick", index: 2 });
  });

  it("Space y ESC cancelan (vuelta al menú Buy/Sell)", () => {
    expect(shopArmsKey(m(1, 0), " ", 4)).toEqual({ kind: "close" });
    expect(shopArmsKey(m(1, 0), "Spacebar", 4)).toEqual({ kind: "close" });
    expect(shopArmsKey(m(1, 0), "Escape", 4)).toEqual({ kind: "close" });
  });

  it("otras teclas: none (el modal las traga)", () => {
    expect(shopArmsKey(m(0, 0), "a", 4)).toEqual({ kind: "none" });
    expect(shopArmsKey(m(0, 0), "PageDown", 4)).toEqual({ kind: "none" });
  });

  it("sin filas (defensivo): mover/elegir no hacen nada; cancelar sí funciona", () => {
    expect(shopArmsKey(m(0, 0), "ArrowDown", 0)).toEqual({ kind: "none" });
    expect(shopArmsKey(m(0, 0), "Enter", 0)).toEqual({ kind: "none" });
    expect(shopArmsKey(m(0, 0), "Escape", 0)).toEqual({ kind: "close" });
  });
});
