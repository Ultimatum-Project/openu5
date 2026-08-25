/**
 * Tipo de datos de comercio COMPARTIDO: lo consumen el motor de tienda
 * (`core/shops/shops.ts`) y la tienda por consola de la piel fiel
 * (`ui/shop-console.ts`), además de `main.ts`.
 *
 * El panel DOM `ShopPanel` (piel dev, QoL con botones/inputs) se JUBILÓ en la fase 2
 * de la retirada de la piel dev (veredicto usuario #8): la tienda fiel/shader es una
 * conversación por consola en el marco EGA (`ShopConsole`). Este fichero queda como la
 * declaración del tipo compartido.
 */
export interface ShopData {
  equipmentBasePrices: number[];
  weaponsSoldByMerchants: number[][];
  reagentBasePrices: number[];
  reagentQuantities: number[];
  healPrices: number[];
  curePrices: number[];
  resurrectPrices: number[];
}
