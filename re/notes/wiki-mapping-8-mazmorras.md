# Wiki Schiraldi ↔ datos del port: LAS 8 MAZMORRAS (27-07, carril yt-covetous)

Extensión del súper-análisis de Covetous (`covetous-wiki-mapping.md`) a las 8 mazmorras
desde `Dungeon_solutions_for_Ultima_V`. Pregunta encargada: ¿alguna celda cuya mini-sala
muestre el GEMELO ESPEJO contrario al que predice la regla del port?

> **[CORREGIDO AL ALZA, 27-07 tarde — CIERRE AL 100%]**: **198/198 celdas-sala verificadas
> en las 8 mazmorras; cero conflictos; cero sin leer.** Las discrepancias de la primera
> pasada eran ARTEFACTO DEL INSTRUMENTO: barrido monocolor sobre un corpus que pinta el
> suelo de VARIOS colores (Wrong usa 0x44 rojo Y 0x45 gris en la misma planta; en Wrong el
> color elegido era además EL MURO). Solucionador multicolor + adjudicación visual de 3
> paneles en los 5 casos límite; los peores «no casan» de la v1 dan ahora la predicha con
> los márgenes MÁS ALTOS del barrido (Destard (0,6): 106). Las 6 celdas del guard de Wrong
> confirmadas por el mapa canónico (4×cm49 + 2×cm52 — el dato que faltaba al racimo #65).
> Lección de instrumento: en este material «no encuentro la sala» casi nunca significa «no
> está» — significa «la busco del color equivocado» (variante visual del cero silencioso).
> La tabla y límites de abajo quedan como HISTORIA de la v1.

## VEREDICTO: CERO conflictos de gemelo espejo en las 8

Se calculó explícitamente el espejo-H y espejo-V de cada sub implicado contra su bloque
del .CBT: **la lista de conflictos sale vacía en todas las mazmorras**. La regla
`combatmap = 16 + order·16 + roomNo` (dungeon.ts:1498, order salta Despise) queda
**CONFIRMADA en todo el juego** — ninguna sala sellada se mueve por esta vía.

| mazmorra | loc | cm base | medidas | casan | no casan | huecos |
|---|---|---|---|---|---|---|
| Deceit | 33 | 16 | 15/16 | 12 | 3 ilegibles | L5 (1 sala) |
| Despise | 34 | — | 0/0 | — | — | 0 salas en json Y 0 mapas en el wiki Y sin bloque .CBT = CONSISTENTE ×3 |
| Destard | 35 | 32 | 16/16 | 14 | 2 artefactos | — |
| Wrong | 36 | 48 | 23/36 | 20 | 3 (firma de artefacto: las 3 leen cm55) | **L1 sin medir (13 salas)** |
| Covetous | 37 | 64 | 82/82 | 82 | 0 | — (NIVEL DE SELLO, validado ×2) |
| Shame | 38 | 80 | 16/16 | 15 | 1 (único con score alto: L6 (2,5)) | — |
| Hythloth | 39 | 96 | 16/16 | 16 | 0 | — |
| Doom | 40 | 112 | 16/16 | 16 | 0 | — |

**TOTAL 175/184 celdas medidas casan.** Las 9 que no: 3 ilegibles (sin mini detectada),
5 con firma de artefacto (encuadre desalineado / plantilla genérica cm55 ganando ×3 /
score negativo), 1 pendiente de ojo (Shame L6 (2,5), score 95 margen 13).

**LÍMITE DECLARADO**: solo Covetous está a nivel de sello (validado con dos
identificadores independientes, márgenes 18-61). Las otras 7 salen del pipeline general
SIN calibración por mazmorra (texturas de suelo distintas; márgenes 6-23) — sus números
NO son veredicto sellado. En las 8, wiki Level N = floor idx N−1 con traslación toroidal
(dx,dy) propia por nivel. Celdas no-sala sin verificar.

## ★ SUBPRODUCTO (dato puro .CBT+json, alta confianza): 13 celdas con guard anti-(0,0) disparable

Cruce celda a celda de las 198: lados ENTRABLES × bancos playerStarts POBLADOS del
combatmap. Donde un lado entrable no tiene banco, la premisa del header de roomEntry.ts
(«toda dirección enterable tiene grupo real») NO se cumple:

- **Wrong 6/36** (todas en f0 = L1, la planta SIN MEDIR del wiki):
  (3,2) cm49 falta east · (4,2) cm49 falta west · (6,2) cm49 falta east · (7,2) cm49
  falta west (las 4 con solo `south` poblado) · (2,5) cm52 falta south · (2,6) cm52
  falta north (ambas con solo `west`).
  ⚠ Las 4 de cm49 tocan el racimo abierto #65/#64/#74/Wrong-r1.
- **Covetous 7/82**: f5 (4,3) cm67 · f5 (4,4) cm77 · f5 (5,4) cm65 (=brazo C de la
  tarjeta 0xEC) · f5 (4,5) cm66 · f7 (0,3) cm67 · f7 (1,3) cm69 · f7 (7,3) cm69.
- Deceit/Destard/Shame/Hythloth/Doom: 0.

Pregunta abierta (tarjeta): ¿qué hace el ORIGINAL al entrar por un lado sin banco
(colocación de respaldo — lo que el testigo en vivo creyó ver — o algo más)? ¿y el PORT
(guard anti-(0,0) de roomEntryDirectionFor)? Las 13 celdas son el mapa completo de dónde
adjudicarlo.

## Continuación encargada

1. Wrong L1 a mano (13 salas + las 6 celdas del guard — el hueco con más carga).
2. Shame L6 (2,5) a ojo (el único desacuerdo alto sin explicación).
(La calibración por mazmorra para subir las 7 a nivel de sello queda declarada como
opcional, no encargada.)
