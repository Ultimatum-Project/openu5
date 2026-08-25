# The Summoning — layout de las 21 escenas (brief para el ítem G de fidelidad de intro)

Derivado read-only por intro-reviewer (2026-07-15) de `intro-scenes.json` + tablas de
DATA.OVL (marginL 0x2f98 / marginR 0x2fc2 / bandas 0x3040-56 / penY 0x3082), cruzado
con frames del original (`orig_E_*`). Preservado en main por el orquestador.

## Modelo de maquetación REAL (hallazgo A)

El texto NO es un rectángulo: se justifica en `X[marginL,marginR] × Y[yTop,textBot]`
**fluyendo ALREDEDOR del rectángulo del cartón**. Prueba en vídeo: escena 4 (moongate)
el texto envuelve la lámina central (full-width arriba, columnas a los lados,
full-width abajo); escena 0 con marginL=180 lo empuja a columna derecha. El port
actual (`renderStoryScene`/`renderSceneText`) mete el texto en un rectángulo sin
evitar el cartón → implementar justificación con EXCLUSIÓN del/los rect(s) de cartón.

## BUG DURO escenas 8–12 (hallazgo B)

Cartón full-width 320×118 en (0,82) = mitad inferior entera; su banda sale DEGENERADA
en la tabla y el fallback del port la tira a Y[136,182] = **ENCIMA del cartón**. El
vídeo (escena 10, shadowlords) prueba que el texto va full-width por ARRIBA: región
real ≈ X[8,312] Y[8,78]. El port pinta el texto sobre la ilustración en esas 5 escenas.

## Tabla por escena

Pantalla EGA 320×200. `carton`=storyN:subimg WxH @(x,y). type: 1=marco TEXT.16 previo ·
0=cartón simple · 2=revelado extra · 3=puerta azul (texto fijo DATA.OVL) · 4/5/6=2º cel
apilado +55px (subimg=2·type−5). `yTop=penY>0?penY:textTop`.

| Sc | ty | carton (STORYn:sub WxH @x,y) | cubre (x0,y0)..(x1,y1) | TEXTO (px) | extra |
|--:|--:|---|---|---|---|
| 0 | 1 | story1:0 176x192 @(0,0) | (0,0)..(176,192) | X[180,320] Y[128,200] | marco TEXT.16 "The Summoning" gótico arriba-dcha |
| 1 | 2 | story1:1 168x126 @(0,74) | (0,74)..(168,200) | X[172,320] Y[70,200] | revelado story1:2 @(40,86) |
| 2 | 0 | story2:0 184x131 @(136,0) | (136,0)..(320,131) | X[0,132] Y[40,200] | cartón dcha→texto izq |
| 3 | 0 | story2:1 200x121 @(0,38) | (0,38)..(200,159) | X[210,320] Y[32,160] | |
| 4 | 0 | story2:2 168x124 @(152,76) | (152,76)..(320,200) | X[0,320] Y[9,200] | WRAP alrededor del cartón (moongate) |
| 5 | 0 | story2:2 168x124 @(0,0) | (0,0)..(168,124) | X[176,320] Y[133,200] | |
| 6 | 3 | story2:2 168x124 @(72,38) | (72,38)..(240,162) | X[0,320] Y[9,200] | TEXTO FIJO: "«Instantly, a shimmering blue …» (93 B, sha1 e63a134b — recortado; verifica contra tu copia)" |
| 7 | 1 | story3:0 183x167 @(0,0) | (0,0)..(183,167) | X[188,320] Y[136,200] | marco TEXT.16 |
| 8 | 0 | story3:1 320x118 @(0,82) | (0,82)..(320,200) | REAL≈X[8,312] Y[8,78] (raw degenerado; port pinta MAL en y136) | |
| 9 | 0 | story4:0 320x118 @(0,82) | (0,82)..(320,200) | REAL≈X[8,312] Y[8,78] | |
| 10 | 0 | story4:1 320x118 @(0,82) | (0,82)..(320,200) | REAL≈X[8,312] Y[8,78] (shadowlords) | |
| 11 | 0 | story5:0 320x118 @(0,82) | (0,82)..(320,200) | REAL≈X[8,312] Y[8,78] | |
| 12 | 0 | story5:1 320x118 @(0,82) | (0,82)..(320,200) | REAL≈X[8,312] Y[8,78] | |
| 13 | 0 | story6:0 144x112 @(176,0) | (176,0)..(320,112) | X[0,170] Y[114,200] | cartón dcha-arriba→texto izq/abajo |
| 14 | 1 | story6:1 176x113 @(0,0) | (0,0)..(176,113) | X[184,320] Y[32,200] | marco TEXT.16 |
| 15 | 4 | story6:2 141x55 @(176,0) | (176,0)..(317,55) | X[0,170] Y[96,200] | 2º cel story6:3 141x39 @(176,55) |
| 16 | 5 | story6:6 141x55 @(0,46) | (0,46)..(141,101) | X[148,320] Y[33,137] | 2º cel story6:5 141x39 @(0,101) — Iolo escribe izq, texto dcha |
| 17 | 6 | story6:4 141x55 @(176,78) | (176,78)..(317,133) | X[0,320] Y[70,200] | 2º cel story6:7 141x38 @(176,133) |
| 18 | 5 | story6:2 141x55 @(0,0) | (0,0)..(141,55) | X[148,320] Y[96,200] | 2º cel story6:5 141x39 @(0,55) |
| 19 | 6 | story6:6 141x55 @(176,55) | (176,55)..(317,110) | X[0,320] Y[9,146] | 2º cel story6:7 141x38 @(176,110) |
| 20 | 4 | story6:4 141x55 @(0,87) | (0,87)..(141,142) | X[156,320] Y[79,200] | 2º cel story6:3 141x39 @(0,142) |

Escenas 15-20 = charla de Iolo (retrato 2 celdas). TYPE 1 (0/7/14) blitean marcos
TEXT.16 (posiciones en `faithful-intro.ts:TITLE_FRAMES`).

## Residual Clase-C (píxel-diff #26)

1. Margen exacto fila-a-fila de la transición full-width↔columna (word margin lo/hi =
   2 regímenes; `intro-scenes.ts:saneMargin` colapsa al no-nulo).
2. Posiciones TEXT.16.
3. Revelado 0x8d86 de la escena 1.

El modelo "justifica en banda evitando el cartón" + esta tabla ≈ 95%; el resto es
diff en vivo.
