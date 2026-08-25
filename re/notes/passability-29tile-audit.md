# Pasabilidad — auditoría por-tile de las 29 divergencias `walkable` vs binario 0x54d4

> **✅ CIERRE FINAL (2026-07-19, adjudicación del lead — pasabilidad-29 DESCONGELADA y
> CERRADA tras el paquete CAST):** los 2 residuales se adjudican así: **`0xf9`
> SignShipwright → casa el binario (PISA)**, override `0xf9: true` en tiles.ts (bit CLEAR
> verificado en DATA.OVL 0x54e4 byte31, anclas 0x05/0x01/0x07 + 182 exactos re-comprobados
> contra el fichero); **`0xff` BlackSquare → divergencia BENDECIDA** (el «pasa» del binario
> es don't-care de tile de niebla/borde; el port bloquea por defensa). Divergencia residual
> final = 0x1a (deliberada walk-to-restore) + 0xff (bendecida). Tests en
> los-passability-audit.test.ts actualizados (port bloquea 182).

Paso C del carril fiel/los-audit. Los 29 tiles donde `tiles.ts::walkable` (TileData.json,
Clase-D) diverge del bitmap de pasabilidad del binario `DS:0x54d4` (kernel 0x2bd4). Regla
del lead: derivación POR TILE, NADA de blind-swap, gate de cadena completa; si un sello
respira → parar y reportar el tile. El port usa `isPassable` (movement.ts:76) = flag directo
por transporte, SIN override — pero HAY handlers especiales (moongate, stairs/klimb) que
cambian el veredicto. Veredicto por tile:

> ## ⚠️ CORRECCIÓN DE FUENTE (2026-07-18) — la tabla de abajo se derivó de un VOLCADO CORRUPTO
> La «diff de 29» se calculó contra el volcado EN VIVO del lote D, tomado en OVERWORLD y
> **CORRUPTO en la zona `0xa8-0xe7` (bytes 21-28)**. La fuente canónica es la tabla ESTÁTICA
> `DATA.OVL` fileoff **`0x54e4`** (la que el kernel carga en `DS:0x54d4`), y la convención la fija
> el consumidor kernel **`0x2bd4`**: máscara `0x80>>(tile&7)` **MSB**, bit PUESTO = BLOQUEA
> (anclas: hierba 0x05 pasa, agua 0x01 bloquea, desierto 0x07 pasa; bin bloquea **182 exactos**).
> Re-derivada contra el canónico, la divergencia real cae de 29 a **3**:
> - **binario BLOQUEA / port PISA (1):** `0x1a` BrokenShrine — DELIBERADA (walk-to-restore,
>   `checkShrineEntry`; patrón-moongate CMDS.OVL 0x130c→0x1202). No override. Ver `passability-18flags.md`.
> - **port BLOQUEA / binario PISA (2):** `0xf9` sign · `0xff` black-square — sobre-bloqueo, ⏳ por-tile.
>
> **WIRE FINAL aplicado** (`WALKABLE_OVERRIDE`): `0x6c-0x6f` + `0x1c` Oasis + `0xc3` campo-muerto → F.
> **Falsos positivos del volcado corrupto (NO se overridean, el canónico los deja PISABLES):**
> `0xbc` Fireplace (byte23 0xff→0xf7; en el U5 real se pisa el hogar — el Grand Tour lo calcaba, y su
> sello RESPIRÓ en ch04/ch08 cuando lo bloqueé por error), `0xaa 0xab 0xac 0xc4-c7 0xca-cd 0xdc 0xdd`
> y demás de la zona 0xa8-0xe7: **ya coinciden con el port**, no eran divergencias.
> **La tabla per-tile de abajo queda SUPERADA para la zona de mobiliario** (0xa8-0xe7); vale como
> registro del proceso. Companion del relevo-2: `passability-18flags.md`.

## Grupo 1 — binario BLOQUEA / port PISA (17): `walkable=T` donde el binario bloquea

| tile | nombre | flags | veredicto |
|---|---|---|---|
| 0x6c-6f | WaterStream11-14 | skiff, wEnemy | **SWAP → walkable=F** (es AGUA: skiff/water-enemy; a pie no se anda sobre agua; el binario lo bloquea con razón). Alta confianza. |
| 0xbc | Fireplace | upright | **SWAP → walkable=F** (feature de muro sólida, además ∈ opacidad-LOS 0x6a86; andar dentro de la chimenea es bug). Alta confianza. |
| 0xdc | Moongate | upright | **DELIBERADA — mantener walkable=T.** Se PISA para teleportar (moongates.ts, kernel_moongate_enter 0x4902); swap a F rompería el viaje. Confirmado. |
| 0xc4-c7 | Stairs N/E/S/W | klimb | **DELIBERADA/cubierta — mantener walkable=T** (a verificar handler). Escaleras direccionales de interiores: `klimb=true`; el port las PISA para cambiar de piso. El binario bloquea el walk normal (se usan por Klimb/enter). ⏳ verificar el handler de cambio de piso del port. |
| 0xaa | Carpet | lEnemy, upright | ⏳ FLAG — ¿alfombra VOLADORA (se PISA para EMBARCAR, como moongate) o alfombra de suelo? Si transporte, deliberada; si suelo, walkable-ok. Verificar handler de carpet. |
| 0xab-ac | LeftBed/RightBed | upright | ⏳ FLAG bajo impacto — ¿se anda sobre la cama (para dormir/rest) o bloquea? Probable swap→F (mueble), pero verificar el rest/sleep. |
| 0x1a | BrokenShrine | upright | ⏳ FLAG — estructura de santuario (upright, wall-like). Probable swap→F, pero confirmar que no se PISA para algo. |
| 0x1c | Oasis | lEnemy | ⏳ FLAG — ¿la parte de agua del oasis bloquea a pie? Semántica incierta. |
| 0xc3 | ScaryBlackThingDead | upright | ⏳ FLAG — campo de fuerza MUERTO. El vivo (0xc0) el port lo bloquea; el muerto walkable=T (¿disipado=pisable?). Binario bloquea ambos → posible swap→F, o divergencia de mecánica (campo). |
| 0xdd | Desert3 | — | ⏳ FLAG raro — desierto normalmente transitable; el binario bloquea 0xdd. ¿variante impasable (duna/arena movediza)? o ¿mismatch de id? Confirmar semántica antes de tocar. |

## Grupo 2 — port BLOQUEA / binario PISA (12): `walkable=F` donde el binario permite

Aquí el port SOBRE-bloquea. Menos peligroso (no deja andar donde no se debe; a lo sumo
impide un paso legítimo). Mayoría probablemente Clase-D del dataset o mecánica separada:

| tile | nombre | flags | veredicto |
|---|---|---|---|
| 0xca-cb | FenceHoriz/Vert | klimb, upright | ⏳ FLAG — vallas KLIMBABLES; el binario permite walk (¿se saltan/pisan?), el port bloquea. Mecánica de valla/klimb — verificar. |
| 0xc0 | ScaryBlackThing1 | upright | ⏳ FLAG — campo de fuerza VIVO; el binario permite walk (¿se ENTRA y hace daño?), el port bloquea (seguro). Mecánica de campo. |
| 0xae-af | CoffeeTable/Box | upright | ⏳ FLAG bajo — mueble; el binario permite walk (¿empujable?), el port bloquea (intuitivo). |
| 0xb0 | RightSconce | upright | ⏳ FLAG — candelabro de pared; ¿sprite decorativo sobre suelo pisable? |
| 0xe0-e1,0xf9 | Signs (Large/Shipwright) | upright | ⏳ FLAG — carteles; ¿decorativos sobre suelo pisable (binario) o sólidos (port)? |
| 0xcc-cd | Wtf1/Wtf2 | — | ⏳ FLAG — tiles desconocidos; semántica sin identificar. |
| 0xff | BlackSquare | — | ⏳ FLAG — tile negro/void; el binario permite walk (¿void rellenable?), el port bloquea (conservador, no caer al vacío). Probablemente el port hace bien; divergencia deliberada segura. |

## Plan de cierre

- **SWAPS de alta confianza (2 grupos, 5 tiles):** WaterStream 0x6c-6f + Fireplace 0xbc →
  `walkable=false`. Cambio bounded, alto valor (hoy el jugador anda sobre agua y dentro de
  chimeneas). Gate de cadena completa OBLIGATORIO (workers=6); si un sello respira → parar +
  reportar el tile.
- **DELIBERADAS (mantener):** Moongate 0xdc (confirmada), Stairs 0xc4-c7 (verificar handler).
- **⏳ FLAG (18 tiles):** requieren semántica fina / handler / witness antes de decidir. NO
  tocar por analogía (regla del lead). Algunos (carpet, campos de fuerza, klimb de vallas)
  son mecánicas separadas, no bugs de tabla. Candidatos a sondeo del oráculo o RE del handler.

Dónde vive el fix: `game/src/core/data/TileData.json` (el dataset Clase-D) — pero como es
material de terceros vendorizado, el swap se documenta como override citado al binario 0x54d4
(fuente Clase-A) por tile, no una edición silenciosa del dataset. A confirmar el mecanismo de
override con el lead (¿editar TileData con nota, o una capa de corrección `walkableOverride`?).
