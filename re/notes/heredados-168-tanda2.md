# heredados-168 · TANDA 2 — 8 acreditadas + 3 REFUTADAS

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **151 → 143**.

> Formato: offset y nombre en **celdas separadas** a propósito (ver tanda 1 §2.3). Esta
> nota está verificada a `SEMBRADAS 0 / CAMBIADAS 0` contra `build_name_seeds`.

---

## 1. Las 8 ACREDITADAS

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `TALK.OVL:0x574` | `talk_emit_char` | ACREDITADA — es el ACUMULADOR DE PALABRA, no un putchar |
| 2 | `COMBAT.OVL:0x139a` | `effective_defender_dex` | ACREDITADA — «effective» = 3 atajos que fuerzan el mínimo |
| 3 | `CMDS.OVL:0x14ba` | `is_pushable_tile (Push helper)` | ACREDITADA — 16 tiles, rango a rango |
| 4 | `COMSUBS.OVL:0x48a` | `isqrt` | ACREDITADA el bucle; ⚠ el CONTRATO es distancia de 2 puntos |
| 5 | `DUNGEON.OVL:0x1c0c` | `dng_landing_ok` | ACREDITADA — ★ 4 comparaciones REDUNDANTES |
| 6 | `TOWN.OVL:0x10f2` | `shadowlord_possess_slot` | ACREDITADA; ⚠ es un PREDICADO y el «_slot» se rompe |
| 7 | `SJOG.OVL:0x20d8` | `combat_cell_blocked` | ACREDITADA — ★ excepción de HUIDA por el bit 2 |
| 8 | `SJOG.OVL:0x2148` | `combat_actor_surrounded` | ACREDITADA — vecindario de 4, conjunción estricta |

### 1.1. Lo que el cuerpo dio y el ledger no tenía

- **El layout del registro de combate queda completo.** Entre tanda 1 y tanda 2:
  `+1` = DEX (de `effective_defender_dex`), `+2` = banderas (bit `0x80` «es del roster»,
  bit `0x40` congelable por el hechizo de tiempo, bit `8` blanco fácil, bit `2` **puede
  salir del tablero**, bit `0x20` retirado), `+3` = tipo/índice, `+4` = **índice al array
  de animación** `g_char_anim_states`, `+6`/`+7` = las dos coordenadas.
  El campo `+4` es el eslabón que une los dos arrays de actores, que estaban descritos por
  separado.
- **Afordance de huida sin documentar:** en `combat_cell_blocked`, salir del tablero cuenta
  como bloqueado *salvo* para los actores con el bit 2 puesto.
- **`dng_landing_ok` tiene 4 comparaciones muertas** contra los nibbles altos
  `0xB0/0xC0/0xD0/0xE0`: el salto anterior ya desvía todo nibble no-cero al mismo destino.
  No cambian la conducta, pero leerlas sueltas sugiere una lista blanca de cuatro casos
  especiales **que no existe**. El predicado real es «nibble alto == 0».
- **El bug del slot en `TOWN.OVL:0x10f2`**, re-encontrado por lectura independiente: tras el
  bucle, `bx` toma el contador AGOTADO (vale 4), así que la comprobación de tipo mira
  siempre el slot 4, no el que se le pasa.

---

## 2. ★★ Las 3 REFUTADAS — y por qué el contador NO puede reflejarlas

Estas tres tienen la **cita completa en el ledger** pero **NO** llevan `verified`, porque el
cuerpo contradice su nombre.

| rutina | nombre en el ledger | lo que el cuerpo dice | renombre propuesto |
|---|---|---|---|
| `SJOG.OVL:0x1b6c` | `sum_flee_edges` | **contador de bandos** (y = party viva, x = enemigos vivos); ni bordes ni huida | `count_live_sides` |
| `ULTIMA.EXE:0x3f6e` | `los_opacity_test` | devuelve 1 con el bit PUESTO = **TRANSPARENTE**: polaridad INVERTIDA | `los_transparent_test` |
| `ULTIMA.EXE:0x2bd4` | `tile_flag_bit` | devuelve el **complemento** del bit (= PASABLE) + 3 reglas sobre un 2º tile | `tile_passable_for` |

### 2.1. La limitación del esquema, declarada

`frontier.apply_manual` **sólo sabe PONER `verified`, nunca quitarlo**:

```python
if man.get("verified"):
    rec["verified"] = True
    rec["depth"] = "E"
```

y el marcador de heredado sólo sale si `row.get("cite")` (imposible: es el artefacto del
#39) o `man.get("verified")`. Por tanto **una fila cuyo cuerpo REFUTA su nombre se queda
dentro del contador aunque esté adjudicada**. Prefiero el hueco medible a un `verified`
fingido, así que las tres siguen contando.

**Consecuencia para quien lea el trinquete:** `verified_inherited_without_cite` ya NO
significa «filas sin adjudicar». Significa «filas sin `verified` manual», y desde esta tanda
incluye 3 adjudicadas. Si se quiere que el número vuelva a decir lo que promete, hace falta
o bien un campo nuevo (`verified_refuted`) que descuente y ponga `verified=false`, o bien
aterrizar los renombres y verificar el nombre corregido. **Decisión del lead** — no toco
semántica de instrumento compartido ni renombro tres rutinas por mi cuenta.

### 2.2. Por qué las dos polaridades merecen el rigor

No es tiquismiquis de nomenclatura: en `0x6A14` la polaridad **ya estuvo mal escrita una vez**
y costó una corrección firmada (`cast-line-area-spell-derivation.md:33-39`, 2026-07-19,
«solo el SENTIDO estaba invertido»), y el proyecto arrastra un veredicto retirado por una
tabla de LOS mal atribuida (#44). Sellar `verified` sobre un nombre cuya polaridad el cuerpo
contradice es exactamente el mecanismo por el que ese error se propaga.

---

## 3. Género «la lectura existía y nadie la cruzó»: van OCHO

Apariciones acumuladas (5 en la tanda 1, 3 nuevas aquí):

| rutina | dónde estaba ya derivada |
|---|---|
| `CMDS.OVL:0x14ba` | `cmds.md:52-54` — mismos rangos, misma advertencia sobre los huecos |
| `TOWN.OVL:0x10f2` | `shadowlord-urban.md:141-150` — mismo bug marcado, y ya proponía el renombre |
| `SJOG.OVL:0x1b6c` | `esc-sala-derivacion.md:116` lo llama literal «contador de bandos»; `combat.md:63` registra los dos contadores |

En los tres casos el anexo del #39 no referenciaba nada. El patrón es estable: **el corpus
sabe más que el ledger, y nadie los cruza.** El canal `game/src` medido en la tanda 1 (52%)
es la otra mitad del mismo problema.

---

## 4. Cola nueva

1. **CS `0x5646`** — predicado de bando del contador; nombre-marcador `kernel`.
2. **`COMBAT.OVL:0x0000`** — nombre-marcador `helper`; es el test de terreno que
   `combat_cell_blocked` delega.
3. **DS `0x4AF1`** (contador del acumulador de palabra) y **DS `0xBCE4`** (su búfer de 16 B):
   sin entrada en `globals.json`. `0xBCE4` cae a 6 bytes del puntero de instrucción del
   script que dejé apuntado en la tanda 1 — mismo subsistema, ambos invisibles al ledger.
4. **`COMSUBS.OVL:0x48a`** — renombre a `point_distance`: el nombre `isqrt` describe su
   última línea, no su firma de cuatro argumentos.
