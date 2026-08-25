# Censo de rutinas del binario — task #33 (SIN IDENTIFICAR = frontera)
> **Generado por** `re/tools/routine_census.py` (reproducible, sin azar). Regenera con `python3 re/tools/routine_census.py`.

## Resumen ejecutivo

- **Rutinas de código delimitadas:** 885 (kernel + 23 overlays + 4 drivers; DATA.OVL excluido por ser datos).
- **IDENTIFICADA:** 779 (88.0%) — evidencia FUERTE: referencia un string de prosa de DATA.OVL, o tiene nombre-semilla, o es handler de comando, o está citada en ≥2 notas (o 1 nota + global raro).
- **INFERIBLE:** 66 (7.5%) — evidencia MEDIA/contextual: 1 cita suelta, o toca un global específico, o es entrada pública de overlay, o cuelga de un vecino ya identificado.
- **SIN IDENTIFICAR:** 40 (4.5%) — la frontera. De ellas, **0 son código de JUEGO** (kernel+overlays, las candidatas reales a feature no portada) y 40 son rutinas de driver `.DRV` (hardware, fuera de alcance).

### Cobertura por fichero

| fichero | rutinas | IDENT | INFER | SIN-ID | % identif. |
|---|---:|---:|---:|---:|---:|
| ULTIMA.EXE | 229 | 229 | 0 | 0 | 100.0% |
| BLCKTHRN.OVL | 11 | 11 | 0 | 0 | 100.0% |
| CAST.OVL | 35 | 35 | 0 | 0 | 100.0% |
| CAST2.OVL | 20 | 20 | 0 | 0 | 100.0% |
| CMDS.OVL | 26 | 26 | 0 | 0 | 100.0% |
| COMBAT.OVL | 23 | 23 | 0 | 0 | 100.0% |
| COMSUBS.OVL | 23 | 23 | 0 | 0 | 100.0% |
| DNGLOOK.OVL | 17 | 17 | 0 | 0 | 100.0% |
| DUNGEON.OVL | 34 | 34 | 0 | 0 | 100.0% |
| ENDGAME.OVL | 9 | 9 | 0 | 0 | 100.0% |
| FLAMES.OVL | 2 | 2 | 0 | 0 | 100.0% |
| FONT.OVL | 10 | 10 | 0 | 0 | 100.0% |
| INTRO.OVL | 22 | 22 | 0 | 0 | 100.0% |
| LOOKOBJ.OVL | 25 | 25 | 0 | 0 | 100.0% |
| MAINOUT.OVL | 35 | 35 | 0 | 0 | 100.0% |
| NPC.OVL | 17 | 17 | 0 | 0 | 100.0% |
| OUTSUBS.OVL | 12 | 12 | 0 | 0 | 100.0% |
| SHOPPES.OVL | 25 | 25 | 0 | 0 | 100.0% |
| SHOPPES2.OVL | 14 | 14 | 0 | 0 | 100.0% |
| SHOPPES3.OVL | 8 | 8 | 0 | 0 | 100.0% |
| SJOG.OVL | 36 | 36 | 0 | 0 | 100.0% |
| TALK.OVL | 39 | 39 | 0 | 0 | 100.0% |
| TOWN.OVL | 32 | 32 | 0 | 0 | 100.0% |
| ZSTATS.OVL | 18 | 18 | 0 | 0 | 100.0% |
| EGA.DRV | 44 | 25 | 18 | 1 | 56.8% |
| CGA.DRV | 40 | 9 | 17 | 14 | 22.5% |
| HER.DRV | 40 | 13 | 14 | 13 | 32.5% |
| T1K.DRV | 39 | 10 | 17 | 12 | 25.6% |

## Huérfanos: destinos de `call` resueltos SIN fila

24 destinos de `call` resueltos no son fila de este censo y quedan **absorbidos** dentro de la rutina anterior, que pasa a cubrir código que no es suyo. De ellos, **22** tienen al menos un call-site fuera de la banda de datos PLINK del kernel; el resto son artefactos de leer esa tabla como código. Un `clean_calls` > 0 NO prueba que el destino sea una entrada real (el call-site puede caer en datos de un overlay): la adjudicación final es por lectura. Adjudicación de la tanda actual y su reparto: `re/notes/prologos-ocultos-80.md` §A.3.

| destino | llamadas | limpias | prólogo | frontera | absorbido por | llamadores |
|---|---:|---:|---|---|---|---|
| EGA.DRV 0x2d5d | 22 | 22 | no | no | 0x2c2d | EGA.DRV |
| T1K.DRV 0x1e0c | 22 | 22 | no | no | 0x1d3c | T1K.DRV |
| ULTIMA.EXE 0x230e | 5 | 5 | no | no | 0x22e2 | CAST.OVL, TOWN.OVL, ULTIMA.EXE |
| CGA.DRV 0x1acc | 2 | 2 | no | no | 0x1a0b | CGA.DRV |
| CGA.DRV 0x1c2a | 2 | 2 | no | no | 0x1b4c | CGA.DRV |
| CGA.DRV 0x1e7e | 2 | 2 | no | no | 0x1e34 | CGA.DRV |
| EGA.DRV 0x27af | 2 | 2 | no | no | 0x2751 | EGA.DRV |
| EGA.DRV 0x296a | 2 | 2 | no | no | 0x2832 | EGA.DRV |
| EGA.DRV 0x2bb2 | 2 | 2 | no | no | 0x2b68 | EGA.DRV |
| HER.DRV 0x1e66 | 2 | 2 | no | no | 0x1d89 | HER.DRV |
| HER.DRV 0x1fc4 | 2 | 2 | no | no | 0x1ee6 | HER.DRV |
| HER.DRV 0x2236 | 2 | 2 | no | no | 0x21ed | HER.DRV |
| T1K.DRV 0x123e | 2 | 2 | no | no | 0x1107 | T1K.DRV |
| T1K.DRV 0x139c | 2 | 2 | no | no | 0x12be | T1K.DRV |
| T1K.DRV 0x1cb4 | 2 | 2 | no | no | 0x1c6b | T1K.DRV |
| NPC.OVL 0x0d6f | 1 | 1 | no | no | 0x0d00 | SJOG.OVL |
| SJOG.OVL 0x1478 | 1 | 1 | no | no | 0x1458 | FONT.OVL |
| TOWN.OVL 0x11dc | 1 | 1 | no | sí | 0x11b8 | DNGLOOK.OVL |
| ULTIMA.EXE 0x082a | 1 | 1 | no | no | 0x07a2 | ULTIMA.EXE |
| ULTIMA.EXE 0x0836 | 1 | 1 | no | no | 0x07a2 | ULTIMA.EXE |
| ULTIMA.EXE 0x74a1 | 1 | 1 | no | no | 0x7403 | ULTIMA.EXE |
| ULTIMA.EXE 0x7690 | 1 | 1 | no | no | 0x7526 | ULTIMA.EXE |
| TOWN.OVL 0x0210 | 1 | 0 | no | sí | 0x0170 | ULTIMA.EXE |
| TOWN.OVL 0x030d | 1 | 0 | no | no | 0x02ae | ULTIMA.EXE |

## Método y límites (honestidad)

- **Delimitación**: fronteras = targets de near-call intra-fichero resueltos + entradas de stub + prólogos `push bp;mov bp,sp` + offset 0. Una función leaf sin prólogo y sin caller near queda fundida con su vecina anterior (sub-conteo posible). La zona de datos del gestor PLINK del kernel (`[0x7780,0x81D0)`: registros de overlay + 164 stubs) se marca como datos, no rutina.
- **Resolución de llamadas**: regla canónica near_call_base (overlay-load-layout.md). Sobre el código de juego estable toda near-call cierra a intra/kernel/stub; sólo quedan 3 llamadas directas 'cross-band' (bandas que coexisten en RAM: el offset es fiable, el overlay destino es el 1º de la banda cuando ésta la comparten varios) y la cola de arranque del kernel (≥0x7780) se excluye por ser gestor/crt0 no-estable. Las llamadas INDIRECTAS (`call word ptr[...]`, vector de driver de sonido/vídeo) NO producen aristas → algunas rutinas legítimas quedan sin callers detectados y pueden caer en SIN IDENTIFICAR pese a usarse (los drivers .DRV son el caso extremo: su CS es independiente y sólo se resuelven llamadas intra-fichero).
- **Citas de notas**: atribución (fichero,offset) por contexto de línea/sección; puede sobre-atribuir en líneas multi-fichero. Una cita de un offset INTERIOR marca identificada la función que lo contiene.
- **Strings**: sólo se resuelven inmediatos que caen en un chunk `string-pool` de DATA.OVL (dataovl_catalog); no capta strings construidos ni de otros overlays.

## TOP-20 sospechosos de feature no portada (código de JUEGO)

Sólo kernel + overlays (los drivers `.DRV` van aparte: son primitivas de hardware EGA/CGA/Hercules/Tandy que el port NO reimplementa — usa un renderer moderno). Ordenados por tamaño × (1+nº callers). Cada uno con una hipótesis de una línea. **Revisar contra el port**: si el comportamiento no existe en el clon, es un hueco.

## Lista completa SIN IDENTIFICAR — código de juego (por peso)

0 rutinas de kernel+overlays. Formato: fichero offset | tamaño | callers | pistas.

| # | fichero | offset | B | insn | callers | pistas |
|---:|---|---|---:|---:|---:|---|

## Drivers `.DRV` SIN IDENTIFICAR (fuera de alcance de features)

40 rutinas en EGA/CGA/HER/T1K.DRV. Son rutinas de trazado/E-S de hardware (su CS es independiente; sólo se resuelven sus llamadas intra-fichero, así que muchas quedan sin evidencia por construcción). El port no las reimplementa: **NO son candidatas a feature de juego no portada**. Se listan por completitud.

| # | fichero | offset | B | insn | callers |
|---:|---|---|---:|---:|---:|
| 1 | CGA.DRV | 0x03b4 | 160 | 66 | 3 |
| 2 | T1K.DRV | 0x02cc | 154 | 56 | 3 |
| 3 | CGA.DRV | 0x0454 | 160 | 60 | 1 |
| 4 | T1K.DRV | 0x0366 | 148 | 55 | 1 |
| 5 | CGA.DRV | 0x04f4 | 120 | 43 | 1 |
| 6 | T1K.DRV | 0x03fa | 120 | 43 | 1 |
| 7 | CGA.DRV | 0x036c | 72 | 43 | 1 |
| 8 | T1K.DRV | 0x0284 | 72 | 43 | 1 |
| 9 | HER.DRV | 0x1511 | 65 | 19 | 1 |
| 10 | HER.DRV | 0x13e6 | 60 | 23 | 1 |
| 11 | HER.DRV | 0x1552 | 60 | 16 | 1 |
| 12 | CGA.DRV | 0x1092 | 54 | 20 | 1 |
| 13 | T1K.DRV | 0x0ed7 | 53 | 19 | 1 |
| 14 | CGA.DRV | 0x1103 | 52 | 18 | 1 |
| 15 | HER.DRV | 0x145d | 52 | 18 | 1 |
| 16 | CGA.DRV | 0x1df2 | 49 | 13 | 1 |
| 17 | HER.DRV | 0x21ab | 49 | 13 | 1 |
| 18 | CGA.DRV | 0x103a | 44 | 12 | 1 |
| 19 | HER.DRV | 0x15de | 88 | 24 | 0 |
| 20 | T1K.DRV | 0x0e7f | 44 | 12 | 1 |
| 21 | CGA.DRV | 0x125a | 35 | 10 | 1 |
| 22 | HER.DRV | 0x15b4 | 35 | 10 | 1 |
| 23 | T1K.DRV | 0x1085 | 35 | 10 | 1 |
| 24 | HER.DRV | 0x158e | 16 | 5 | 3 |
| 25 | CGA.DRV | 0x10c8 | 31 | 9 | 1 |
| 26 | HER.DRV | 0x1422 | 31 | 9 | 1 |
| 27 | CGA.DRV | 0x10e7 | 28 | 8 | 1 |
| 28 | HER.DRV | 0x1441 | 28 | 8 | 1 |
| 29 | T1K.DRV | 0x0f12 | 28 | 8 | 1 |
| 30 | CGA.DRV | 0x1079 | 25 | 9 | 1 |
| 31 | HER.DRV | 0x13cd | 25 | 9 | 1 |
| 32 | T1K.DRV | 0x0ebe | 25 | 9 | 1 |
| 33 | CGA.DRV | 0x1066 | 19 | 5 | 1 |
| 34 | HER.DRV | 0x13ba | 19 | 5 | 1 |
| 35 | T1K.DRV | 0x0eab | 19 | 5 | 1 |
| 36 | EGA.DRV | 0x1b7d | 15 | 7 | 1 |
| 37 | CGA.DRV | 0x101c | 15 | 7 | 1 |
| 38 | T1K.DRV | 0x0e61 | 15 | 7 | 1 |
| 39 | HER.DRV | 0x15d7 | 7 | 3 | 1 |
| 40 | T1K.DRV | 0x0f0c | 6 | 3 | 1 |
