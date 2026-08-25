# fn32: ground-truth de 0x3e y 0xb0-b3 + residuales CERRADOS (oráculo)

Medido en vivo (oráculo autorizado por el lead; instancia propia aislada, no toca el DOSBox del
usuario). loc=0x11 (pueblo), atlas_seg=0x8CA2. Complementa `fn32-fire-noise-mechanism.md`
(algoritmo) y `anim-composition-adjudication.md` (adjudicación) con TESTIGO de runtime.

## 1. Gallardete de LB 0x3e — SWAP de filas 0↔2 (measured, para el implementer)

40 pasadas → **exactamente 2 estados distintos** = swap binario, gate bit3 del seed local
(cs:0x1f94). Los bytes que difieren caen en las **filas 0 y 2** → confirma swap fila0↔fila2,
IDÉNTICO a 0x12/0x15. Ground-truth (128 B, formato row-interleaved 16 filas×8B, como las banderas):

```
0x3e estado A: 02020206c00000c0… (128 B, sha1 a06bc442 — recortado)
0x3e estado B: 0302020700000000… (128 B, sha1 a59261e2 — recortado)
```
Verificado: estado B = estado A con **fila0 (bytes 0-7) ↔ fila2 (bytes 16-23)** permutadas
(fila1 y el resto intactos). ⇒ el implementer lo enchufa a flagswap.ts con el mismo helper que
0x15, bit3. (Estado A = reposo = atlas estático; 0x3e no pasa por el XOR de fuego.)

## 2. Fuego 0xb0-b3 — SCRAMBLE multi-estado, NO swap binario (measured)

40 pasadas → **40 estados distintos por tile** (0xb0/b1/b2/b3, todos 40/40). ⇒ NO es un toggle
de 2 frames: es **ruido procedural** (el XOR `fireTile ^= rngNoise & flameMask` de
`fn32-fire-noise-mechanism.md`), un bitmap nuevo casi cada pasada. Muestra de 0xb0 (primeros
24 B en 6 pasadas — nótese el ruido en los bytes de la llama, el candelabro `00fcfd00…` fijo):
```
00fcfd000000fe06000003000000f242000107030040fa98
00fcfd000000fe06000003010000f282000107070040fa48
00fcfd000000fe06000003000000f2e2000107060040fab0
00fcfd000000fe06000003000000f282000107010040fa30
00fcfd000000fe06000003010000f2c2000107050040faf8
00fcfd000000fe06000003010000f2c2000107000040faa8
```
⇒ Para el implementer: fuego NO tiene "frame B" precomputable. Genera ruido PRNG-local por frame,
ANDeado con la máscara de llama (0xc0-c3), XOR sobre el tile base. Se valida por estadística/
parecido con el vídeo, no byte-a-byte.

## 3. RESIDUAL (a) — ¿el fuego es actor bytecode? → NO, tile ESTÁTICO (testigo limpio) ✅

Este pueblo (loc 0x11) TIENE antorchas de pared en el mapa (DS:0x6608, 32×32):
- tile **0xB0 ×8**, **0xB1 ×9**, **0xB2 ×2** (19 antorchas en posiciones de pared).
La tabla de actores `0x5c5a` NO contiene ninguna en esas posiciones (los 5 actores están en
(15,26)/(13,11)/(9,23)/(9,9)/(16,19), bases 0x1c/0x48/0x50/0x54/0x1e — mobiliario, no fuego).

⇒ **Las antorchas son TILES DE MAPA ESTÁTICOS, no actores bytecode.** Su titileo es 100% fn32
(scramble del bitmap compartido del atlas), NO ciclo de tile-id. Confirma la adjudicación con
TESTIGO REAL (no sembrado). Cierra el residual (a) sin navegar a un castillo — este pueblo ya
tenía antorchas. **No meter 0xb0-b3 en ENABLED_PROGRAM_BASES.**

## 4. RESIDUAL (b) — ¿la fuente es actor bytecode o reloj maestro? → RELOJ MAESTRO

Este pueblo no tiene fuente (0xd8-db ausente del mapa), así que sin testigo directo aquí. Pero
la fuente **está en el reloj maestro `0x44b8`** (cicla remap[0xd8]→0xdb, como el agua 0xd4-d7):
un tile de mapa estático 0xd8 se dibuja como remap[0xd8], que cicla — NO necesita ser actor.
Por la MISMA arquitectura que las antorchas (tile de mapa estático, no actor), la fuente es un
tile de reloj maestro. ⇒ **el port hace bien dejándola en el reloj maestro; NO migra al
intérprete.** (Testigo limpio en Britain = confirmación opcional; el mecanismo ya está fijado por
la pertenencia al reloj 0x44b8, no por sembrado.)

## Resumen accionable
| tile(s) | mecanismo | port |
|---|---|---|
| 0x3e (gallardete LB) | swap fila0↔fila2, bit3 (fn32) | flagswap.ts (ground-truth §1) |
| 0xb0-b3 (antorcha/sconce) | scramble XOR ruido&máscara, incondicional (fn32) | fn32-scramble, NO ciclo |
| fuente 0xd8-db | reloj maestro (remap), tile estático | dejar en reloj maestro |
