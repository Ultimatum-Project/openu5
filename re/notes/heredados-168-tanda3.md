# heredados-168 · TANDA 3 — 5 acreditadas · y ACTA de la cola

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **143 → 138**.

> Offset y nombre en celdas separadas a propósito (tanda 1 §2.3).
> Nota verificada a `SEMBRADAS 0 / CAMBIADAS 0` contra `build_name_seeds`.

---

## 1. Las 5

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `COMBAT.OVL:0x5b6` | `armed_with_weapon_msg` | ACREDITADA — dos `strcat` en línea; 4 globales nuevas |
| 2 | `MAINOUT.OVL:0x354` | `move_party` | ACREDITADA — ★ es `(dy, dx)`; re-centrado del chunk en saltos de 16 |
| 3 | `DNGLOOK.OVL:0x844` | `mark_visited_cell (bitmap DS:0x58E0)` | ACREDITADA — ★ bit **LSB-first** |
| 4 | `TALK.OVL:0x4e2` | `talk_flush_line` | ACREDITADA — ★ el bit 7 del búfer es un ATRIBUTO de fuente |
| 5 | `COMBAT.OVL:0x14d6` | `hit_roll` | ACREDITADA — fórmula entera + coste en RNG |

### 1.1. Los tres hallazgos que importan fuera de este carril

**(a) Conviven DOS convenciones de orden de bit.** `mark_visited_cell` marca con
`1 << (n & 7)` (**LSB-first**), mientras `0x54D4` (pasabilidad) y `0x6A14` (LOS) leen con
`0x80 >> (tile & 7)` (**MSB-first**). Ninguna nota lo decía. Portar el tercero por analogía
con los dos primeros da el bit equivocado.

**(b) `move_party` toma `(dy, dx)`, en ese orden** — el primer argumento va a la Y. Y el
mapa del sobremundo **no se re-ancla cada paso**: hay una banda muerta de 22 casillas
(ventana local `[5, 0x1a]` en ambos ejes) y, al salirse, el origen del chunk salta 16 con
`origen = ((delta << 4) + origen) & 0xf0`.

**(c) `hit_roll` y el saving-throw son la MISMA contienda.** Ambos calculan
`(statA − statB + 30) / 2` con división con signo y la comparan contra la misma tirada
(`CS 0x3ABE`). Lo que cambia es el sentido: el saving resiste con `umbral > tirada`, el
golpe acierta con `tirada >= umbral`. **Y la tirada es la no uniforme** (1..30 con
`P(1)=3/61`, `P(30)=1/61`) que derivé en la tanda 1: cualquier tabla de probabilidad de
acierto calculada sobre un uniforme sale mal en los extremos.
**Coste en RNG:** los aciertos automáticos (hechizos `0x2A-0x31` y `0x33`; armas `0x23`,
`0x27`, `0x28`) **no consumen tirada**; el camino normal consume exactamente una.

---

## 2. Globales que estos cuerpos identifican y `globals.json` no tiene

Van **nueve** en las tres tandas, y siete son de subsistemas ya portados:

| DS | qué es | de dónde sale |
|---|---|---|
| `0xBCDE` | puntero de instrucción del script de diálogo | tanda 1, `talk_run_until_stop` |
| `0x4AF1` | contador del acumulador de palabra | tanda 2, `talk_emit_char` |
| `0xBCE4` | búfer de 16 B del acumulador | tanda 2, `talk_emit_char` |
| `0x4AF3` | columna del último comienzo de línea | tanda 3, `talk_flush_line` |
| `0xB21E` | búfer de composición del mensaje de combate | tanda 3, `armed_with_weapon_msg` |
| `0x6DA0` | cadena de prefijo fija de ese mensaje | ídem |
| `0x17F6` | tabla de punteros a nombre de arma (paso 2) | ídem |
| `0x15FC` | tabla-puerta por arma | ídem |
| `0x58E0` | bitmap de celdas visitadas | tanda 3, `mark_visited_cell` |

Los cuatro primeros son **el mismo subsistema de diálogo** y ninguno está en el ledger de
globales: `0xBCDE` y `0xBCE4` están a 6 bytes uno de otro.

---

## 3. ACTA — dónde queda la cola

**Hecho:** 30 filas adjudicadas en 3 tandas. Contador **168 → 138**.
27 acreditadas (bajan el contador) + 3 **refutadas** (cita en el ledger, `verified` NO
concedido — ver tanda 2 §2) + 1 nombre recortado + 1 regresión de merge arreglada.

**Queda: 138 filas.** Del bucket original de 56 CANDIDATO FUERTE se han consumido 34; los
**22 fuertes restantes**, por tamaño creciente:

```
DNGLOOK:0x109e 146  ·  MAINOUT:0xfc4  152  ·  NPC:0xd00     180
COMBAT:0x1a5c  194  ·  DNGLOOK:0x97e  202  ·  LOOKOBJ:0x10fc 212
MAINOUT:0x198c 212  ·  MAINOUT:0x1a60 222  ·  COMBAT:0x111a  244
COMBAT:0x13e2  244  ·  DUNGEON:0x1682 260  ·  DUNGEON:0x134a 274
OUTSUBS:0x98   284  ·  DUNGEON:0x1952 318  ·  COMBAT:0x1b1e  328
TOWN:0xc78     332  ·  DUNGEON:0x1a90 336  ·  MAINOUT:0x598  340
DUNGEON:0x150a 376  ·  MAINOUT:0x1578 388  ·  DNGLOOK:0x6a8  412
DNGLOOK:0x117e 562  ·  DNGLOOK:0xd3e  668
```

Luego los **86 de MENCIÓN DÉBIL** y las **26 SIN RASTRO** (lectura fresca obligada:
ULTIMA.EXE 11 · LOOKOBJ 5 · SHOPPES3/TALK/TOWN 2 · CAST/CAST2/MAINOUT/NPC 1).

**Dos atajos ya pagados, para quien releve:**
1. `COMBAT.OVL:0x13e2 attack_defense_stat_selector` está en la cola y ya tiene **dos
   restricciones de llamador derivadas**: `COMSUBS:0x0` lo invoca como `(actor, -1)` para
   sacar INT, y `hit_roll` como `(id_o_-2, slot)` para las dos mitades del contraste. Leer
   su cuerpo con eso delante es la mitad del trabajo.
2. El canal `game/src` (tanda 1 §2.2) cubre **87 de las 168** y es donde están 43 de las
   «débiles» y 4 de las «sin rastro». Sirve para saber **qué leer y qué esperar**, nunca
   como evidencia.

**Herramienta dejada en el scratchpad** (no commiteada, son 20 líneas): el comprobador de
«¿siembra esta nota nombres en el censo?» que compara `build_name_seeds()` con y sin el
fichero y exige `0 / 0`. Cazó 4 siembras accidentales en la tanda 1, una de ellas encima
del nombre curado de `0x4dea`. **Cualquier tanda futura debería pasarlo antes de commitear.**

> 🔴 **CORRECCIÓN 2026-08-06 (carril bugs-original, #66).** La cifra `P(1)=3/61` de esta acta es **FALSA**: son **4/61**. `rand_range` es inclusivo por los dos extremos, así que `rand0(0x3c)` da `r ∈ 0..60` (61 valores) y al **1** le caen CUATRO (`r∈{0,1}` elevados por el `inc` de `0x3adc`, más `r∈{2,3}`). Se delata con una suma: `3 + 28·2 + 1 = 60`, que no es el denominador. `asm-kernel-l4-tanda1` ya lo tenía bien (§ del `rand30`) y el comentario del propio `rng-original.ts` también. Se anota aquí, sin reescribir el cuerpo, porque de esta acta salió la propagación hasta el registro público.
