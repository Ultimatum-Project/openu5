# Los nombres de los anillos: CIERRE — el port ya es fiel (tarea #53)

**Titular: el original SÍ imprime los nombres de anillo, y el port TAMBIÉN — por la misma
vía, con la cita ya puesta en el código desde antes. El «no se emiten por NINGUNA vía» de
#47 era un FALSO POSITIVO del detector catalogado-nunca-emitido, exactamente el modo de
fallo que yo mismo medí y declaré no concluyente al cerrar #40.**

Base: `main` @ `74ce77c5`.

---

## 1. Dónde están los nombres (tres familias, no una)

`Ring of …` aparece en DATA.OVL en **tres tablas paralelas**, cada una para un uso:

| familia | DS | ejemplo | uso |
|---|---|---|---|
| LARGA | 0x0169 / 0x017e / 0x0191 | `Ring of Invisibility` | nombre pleno |
| ABREVIADA | 0x0646 / 0x0650 / 0x065b | `Inv. Ring` | columna estrecha (listas) |
| «X Ring» | 0x7cee / 0x7d00 / 0x7d10 | `Invisibility Ring` | oferta de venta |

Ninguna se referencia directamente desde el código: se llega por **tabla de punteros**.

## 2. La tabla que manda: DS 0x17f6, 48 entradas

Decodificada entera. Los anillos son los índices **42 · 43 · 44**:

```
[39] Glass Sword   [42] Ring of Invisibility   [45] Amulet/Turning
[40] Jeweled Sword [43] Ring of Protection     [46] Spiked Collar
[41] Mystic Sword  [44] Ring of Regeneration   [47] Ankh
```

Coincide con los ids que el port ya usa (`equip.ts:68 RING_INVIS = 0x2a` = 42).

**Consumidores** (censo de las 8 apariciones de `0x17f6`; 2 son direcciones de código —
`jmp`/`je`— y no la tabla). Los 6 reales: `SJOG.OVL:0x16a8` · `COMSUBS.OVL:0x0d6a` ·
`SHOPPES.OVL:0x0be0/0x0bf0/0x0ee5` · `COMBAT.OVL:0x0600`.

### 2.1 El sitio decisivo — SJOG `get_item_switch`, el (G)et

```
16a3: mov bx, [bp+6]        ; code del objeto (0..47)
16a6: shl bx, 1             ; ×2 = índice de word
16a8: push [bx + 0x17f6]    ; ← puntero al NOMBRE
16ac: call 0x58d0           ; imprime
16af: mov ax, 0x8d06        ; "!\n"
```

(justo antes, `inc byte [bx+0x57c0]` con tope 0x63/0x64 = la cantidad de equipo.)

⇒ **coger un anillo imprime «Ring of Invisibility!»**. El original NO es mudo.

### 2.2 Cross-check gratis con #56

`COMSUBS:0x0d5e-0x0d6e` hace `push 0xa; call 0x34da` y luego `call 0x3670` sobre el
nombre. Esos dos crudos son **dos de las once citas que corregí ayer en #56**: `0x34da`
(+0xE1E0) = `putchar` y `0x3670` (+0xE1E0) = `print_string`. Encajan con lo que hacen
aquí — un `\n` y luego el nombre. Las correcciones de #56 se confirman solas en un sitio
que no las citaba.

## 3. El port: FIEL, y con la cita ya puesta

`game/src/core/world/commands.ts:509-516`:

```ts
// Equipo: NOMBRE pelado + "!\n" (0x16a8 push [0x17F6[code]] + 0x8D06 "!\n")
case 5: case 6: case 9: case 10: case 11: case 12: {
  const name = EQUIP_NAMES[qty];
  return name !== undefined ? t(name) + "!" : "An item!"; // SJOG 0x16a3-0x16b2
}
```

- `EQUIP_NAMES` = `longEquipNames.json`, **48 entradas, mismo orden, anillos en 42/43/44**.
- La cita ya nombraba `0x16a8`, `0x17F6[code]` y el rango `SJOG 0x16a3-0x16b2` — es decir,
  el carril que lo cableó ya había hecho esta derivación.
- Las otras dos familias también están portadas: `shortEquipNames.json` (`Inv. Ring`) y
  `sellOfferNames.json` [42..44] = `Invisibility Ring / Protection Ring / Regeneration Ring`.

**No hay vía que cablear. NO se toca código.**

## 4. Por qué #47 dijo lo contrario (y por qué era predecible)

El detector «catalogado pero nunca emitido» busca el string **literal** en `game/src`.
Aquí el nombre se emite **compuesto**: `t(name) + "!"`, donde `name` sale de un JSON de
datos. No hay ningún literal `"Ring of Invisibility"` en una llamada de emisión — y no
tiene que haberlo.

Es **el mismo modo de fallo que medí y declaré al cerrar #40 §5**: los dos candidatos más
afilados de aquel censo (`'Nothing to get!\n'` y `'North\n'`) también resultaron falsos
positivos, uno por normalización del `\n` y otro **por composición** (`"Fly " + "North\n"`).
Dejé escrito entonces que la técnica exigía normalizar y excluir las familias que salen de
datos; los nombres de equipo son justo una de esas familias.

⇒ La tarjeta **#47** (refinar el detector) sigue siendo la buena, y este caso le añade un
requisito explícito: **cazar también la emisión COMPUESTA** (`t(x) + …` con `x` de un JSON
de datos), no sólo el literal.

## 5. Veredicto

**CIERRE SIN CAMBIO DE CÓDIGO.** El original imprime los nombres de anillo por la tabla
DS 0x17f6 en el (G)et (SJOG 0x16a3-0x16b2) y en al menos otros 5 sitios; el port hace lo
mismo con la misma tabla y los mismos índices, y su comentario ya lo citaba. El hallazgo
de #47 queda **retirado como artefacto del detector** — no era un hueco del port.

## 6. Gates

| gate | exit |
|---|---|
| `pytest test_frontier + test_dispatch + test_ledger` | **0** |
| `verify_cites.py scan` / `scan-code` | **0** / **0** |

Sin tocar `.ts` (tsc no aplica: cero cambios de código, declarado).
