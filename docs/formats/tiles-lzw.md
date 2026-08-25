# Formato: LZW de Ultima V + gráficos .16 + paleta EGA

> Algoritmo verificado EMPÍRICAMENTE contra los ficheros reales (2026-07-08): el descompresor
> correcto es el de `reference/Ultima5Redux/U6Decode/u6decode.cc` (el que el autor de Redux usó
> realmente). El `PbvCompressorLZW.cs` de Raw16ToBMP (14 bits fijos MSB-first) NO corresponde
> al formato on-disk de Ultima V — su llamada estaba comentada y operaba sobre `.uncomp`.

## 1. Algoritmo LZW de descompresión (u6decode.cc — VERIFICADO)

LZW clásico de **ancho variable 9→12 bits, orden LSB-first**.

### Formato de fichero
```
0x00: uint32 LE = longitud descomprimida
0x04: stream LZW
```
Verificado: TILES.16→65536 (=512 tiles × 128 B), TILES.4→32768, ULTIMA.16→38170,
STARTSC.16→21946, CREATE.16→37502, MON1.16→2614.

### Códigos
- `0x000–0x0FF`: literales.
- `0x100`: reinicio de diccionario. Es SIEMPRE el primer código del fichero; tras él, el siguiente código es un literal que se emite directo.
- `0x101`: fin de stream.
- Códigos nuevos desde `0x102`. Tras añadir una entrada, si `nextFree >= dictionarySize` y `codewordSize < 12`: `codewordSize++`, `dictionarySize *= 2` (0x200→0x400→0x800→0x1000).

### Orden de bits: LSB-first
```
b0 = data[bitsRead/8]; b1 = data[bitsRead/8+1]; b2 = data[bitsRead/8+2]
code = (((b2<<16)|(b1<<8)|b0) >> (bitsRead%8)) & ((1<<width)-1)
bitsRead += width
```

### Bucle principal (fiel a u6decode.cc lzw_decompress, L145-242)
```
pW = -1
loop:
  cW = readCode(codewordSize)
  if cW == 0x101: fin
  if cW == 0x100:
      codewordSize=9; nextFree=0x102; dictionarySize=0x200; dict.clear()
      cW = readCode(codewordSize); output(cW); pW = cW; continue
  if cW < nextFree:                      // en diccionario
      s = string(cW); C = s[0]; output(s)
      dict[nextFree] = (prefix=pW, root=C)
  else:                                  // caso KwKwK (cW == nextFree obligatorio)
      s = string(pW); C = s[0]; output(s); output(C)
      dict[nextFree] = (prefix=pW, root=C)
  nextFree++
  if nextFree >= dictionarySize && codewordSize < 12:
      codewordSize++; dictionarySize *= 2
  pW = cW
```
`string(code)`: recorrer prefijos hasta literal, invertir. Implementación TS: `extractor/src/parsers/lzw.ts`.

## 2. Píxeles: 4bpp chunky packed (NO planar)

- 2 píxeles por byte, row-major (fila a fila, izquierda→derecha).
- **Nibble alto = píxel izquierdo, nibble bajo = píxel derecho.**
- Un tile 16×16 = 128 bytes. TILES.16 descomprimido = 512 tiles consecutivos = 65536 bytes (verificar).
- Imágenes de pantalla (.16 de screens) tienen offsets de header propios: `ultima.16` +0x1A (320×61), `startsc.16` +0 (168×30), `create.16` +0x32 (168×200), `mon1.16` +0x1F (12×50).

## 3. Paleta EGA (la del conversor de referencia)

```ts
const EGA_PALETTE = [
  "#000000","#0000FF","#008000","#00FFFF",
  "#B51000","#FF00FF","#AF5800","#D3D3D3",
  "#555555","#5555FF","#55FF55","#55FFFF",
  "#FF5555","#FFFF55","#FFFF55","#FFFFFF",
];
```
Rarezas heredadas del conversor C#: índice 2 = #008000, índice 7 = #D3D3D3, índices 13 y 14 ambos amarillo (13 debería ser magenta brillante #FF55FF en EGA canónica — el conversor tiene ese bug). **Decisión del proyecto: usar la tabla EGA canónica con brown-fix** (ver abajo), corrigiendo 13 → `#FF55FF`, 2 → `#00AA00`, 4 → `#AA0000`, 6 → `#AA5500`, 7 → `#AAAAAA`.

**FUENTE ÚNICA:** la tabla índice→RGB vive en `extractor/src/parsers/tiles.ts` (`EGA_PALETTE`); genera los assets de tiles y el runtime consume el PNG. La lista de abajo es documentación derivada, no una segunda definición.

Paleta EGA de U5 confirmada por witness runtime (`re/notes/palette-idx6-verdict.md`): el original en DOSBox-X pinta con la **EGA canónica CON brown-fix** ⇒ índice 6 = `#AA5500` (marrón), no `#AAAA00` (oliva). La hipótesis "oliva sin brown-fix" (task #25, tabla estática `DATA.OVL @0x52ee`) quedó REFUTADA: la tabla se leyó bien pero su escritura al ATC nunca se witnessó. Los otros 15 índices son el IRGB estándar:
```ts
const EGA_U5 = [
  "#000000","#0000AA","#00AA00","#00AAAA",
  "#AA0000","#AA00AA","#AA5500","#AAAAAA",
  "#555555","#5555FF","#55FF55","#55FFFF",
  "#FF5555","#FF55FF","#FFFF55","#FFFFFF",
];
```

## 4. TILES.4 / CGA

No implementado en la referencia y NO lo necesitamos (usamos EGA).

## 5. Notas

- Redux (el juego) usa spritesheets PNG propios; el único código que toca .16 es Raw16ToBMP. La estructura interna de TILES.16 (512 tiles de 16×16) hay que verificarla empíricamente en el primer task del extractor (descomprimir, comprobar longitud 65536, renderizar atlas y comparar visualmente con el juego).
- Animaciones de tiles (agua, banderas, fuego): el original anima ciertos rangos de tiles; identificar en fase de render.
