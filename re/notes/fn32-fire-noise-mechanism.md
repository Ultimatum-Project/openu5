# Fuego del original = XOR de ruido RNG enmascarado (fn32 del EGA.DRV) — spec

Derivado del disasm de `EGA.DRV fn32` (@0x1f98) durante la adjudicación de composición
(ver `anim-composition-adjudication.md`) y a petición del implementer de #46/#47. Cierra el
detalle exacto del titileo de fuego, que hasta ahora quedaba como "fn32 scramble" sin algoritmo.

## Mecanismo (bloque fn32 @0x23ba)

El fuego NO se anima por ciclo de tile-id ni por swap de filas (eso son las banderas). Se anima
mutando el bitmap del tile en el atlas, **cada pasada, INCONDICIONAL** (sin gate de bit de seed
— por eso titila 24/24, no ~50% como las banderas):

```
por cada byte j (0..127) del tile de fuego:
    fireTile[j] ^= ( rngNoise[j]  &  flameMask[j] )
```

- **`rngNoise`** = buffer `0xf400-0xf5ff` (en el segmento del atlas), refrescado CADA pasada por
  el **RNG LOCAL del driver** (`cs:0x1f94`, mismo LCG que el kernel `0x2092` pero semilla
  separada). Lo llena el bloque `0x1f9d` antes del XOR.
- **`flameMask`** = un TILE estático de "forma de llama" que acota DÓNDE puede parpadear (solo los
  píxeles de la llama, no el candelabro/estructura). Es `[di]` en el bucle: `al=[bx]; al&=[di];
  [si]^=al`.

Disasm del núcleo (`0x23c7-0x23d6`, ×4 tiles × 128 B):
```
23cd: mov al,[bx]      ; bx = rngNoise (0xf500…)
23cf: and al,[di]      ; di = flameMask (tile 0xc0…)
23d1: xor [si],al      ; si = fireTile (tile 0xb0…)
23d3: inc si; inc bx; inc di ; loop
```

## Familias de fuego y sus máscaras (medido; cuadra con el set 24/24 del mapa del atlas)

| tiles de fuego | máscara de llama | bloque |
|---|---|---|
| 0xb0,0xb1,0xb2,0xb3 | 0xc0,0xc1,0xc2,0xc3 | 0x23ba |
| 0xbc,0xbd,0xbe,0xbf | 0xcc,0xcd,0xce,0xcf | 0x23e9 |
| 0xde | 0xc2 | 0x2415 |

(0xc0-c2, que `TileData` etiqueta "ScaryBlackThing", son en realidad **máscaras de forma de
llama**, no un objeto animado por sí mismas — dato para #46/#44.)

## Implicaciones para el port (#46)

- **NO ciclar ids 0xb0→0xb3** (morfea entre objetos: antorcha/brasero/hoguera). El fuego es UN
  tile cuyo bitmap se scramblea.
- Implementación fiel: mantener el tile base de fuego y, cada frame, `XOR` de ruido PRNG-LOCAL de
  vista `AND` la máscara de llama (0xc0-c3). Es estocástico ⇒ **no hay "frame B" fijo que validar
  byte-a-byte**; se valida por parecido visual/estadístico con el vídeo. El "~2 estados que
  alternan" percibido en L7 (antorcha) sale de este XOR sobre una llama pequeña.
- RNG: LOCAL del render (no `g_rng_seed` 0x5420) ⇒ render-seguro, PRNG local declarado en el port
  (coherente con #17).
- Cadencia: cada pasada del animador (~110 ms), incondicional.

## Aparte: hoguera 0xdc
0xdc se dibuja con un **blitter especial** (`0x1112`, caso de `viewport_compose` gateado por
`[0x5887]∈1..0xf`), y su llama 0xde entra además en el XOR de arriba. Es un hilo separado del
scramble genérico; requiere derivar `0x1112` (fn32 sel 0x60 con `stc`) si se quiere fiel exacto.

## Gallardete de LB 0x3e (para cerrar el hilo con banderas)
0x3e NO es fuego: está en el bloque de SWAP de banderas (`0x2470: si=0x1f00; call 0x24d0`) =
**swap filas 0↔2**, gate **bit3** del seed local. Mismo mecanismo que 0x12/0x15 (flagswap.ts).
Su reposo = atlas estático (0x3e no pasa por el XOR de fuego).
