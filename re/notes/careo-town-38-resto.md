# Careo TOWN #38 — los 6 restantes (continuación de `careo-town-38.md`)

Orden del lead: (c) → (b) → (e) → (h), y (f)/(g) **sólo censo+radio, sin cablear**.
(d) no se toca (decisión de diseño #52). Corpus: **28/28 `.asm` legibles**, verificado antes
de empezar.

**Adjudicados: (c) FIEL · (b) FIEL · (h) PARCIAL.** (e) NO ADJUDICABLE con lo aportado.
(f) y (g) con censo hecho y radio escrito, como se pidió.

---

## (c) `town_klimb` montado — **FIEL**, y el punto era una trampa doble

### Los DOS punteros del mapa eran FALSOS AMIGOS
- `main.ts:3989` es un **comentario sobre (A)ttack**, no sobre klimb.
- `use-tools.ts:93` **no es ese fichero**: el real es `core/endgame/use-tools.ts:93`, y ahí
  pone «**Only** on foot!» (DS 0x48e4) = el rechazo de desplegar la **ALFOMBRA**.

### El sitio real, y está bien
`game.ts:2676-2681` contra `town_klimb` **TOWN 0x0B82**:

| binario | port |
|---|---|
| `0b8d` imprime «Klimb-» (DS 0x2723) | prefijo del mensaje |
| `0b94-0b99` `al=[g_transport_tile] & 0xFE; cmp 0x12` | `state.transport === "horse"` |
| `0b9d` imprime «-On foot!» (DS 0x272A) | sufijo del mensaje |
| `0ba4` `jmp 0xc43` = sale, **sin turno** | `return events` |

La equivalencia del gate no es aproximada: `transport.md:55` documenta que el caballo sólo
ocupa **2 tiles reales** (E→`0x12`, O→`0x13`), justo los que `&0xFE == 0x12` captura. Y el
mensaje `"Klimb--On foot!"` es la concatenación correcta — **el doble guion es del original**
(0x2723 acaba en `-`, 0x272A empieza por `-`), no un typo.

⇒ **FIEL, nada que cablear.** El JSDoc del port ya citaba 0x0B82/0x2723/0x272A bien.

### ★ Por qué falló el mapa: «On foot» es un homógrafo de CUATRO vías
| string | dónde | qué rechaza |
|---|---|---|
| `0x272A` «-On foot!» | TOWN `town_klimb` | **klimb montado** ← el de este punto |
| `0x26e8` / MAINOUT `0x2a06` «On foot!\n» | (A)ttack | atacar sobre agua |
| `0xa322` / `0x3d97` | camp | acampar en vehículo |
| `0x48e4` «Only on foot!\n» | CAST (alfombra) | desplegar alfombra montado |

Un puntero obtenido por grep del string en este punto tiene **3 de 4** de ser falso amigo.
Regla para el siguiente: en familias de mensajes repetidos, el puntero se fija por **offset
DS**, no por el texto.

---

## (b) loc 0x1d + Cetro borra slot 9 + los TRES Shadowlords — **FIEL** (las dos mitades)

### El binario, `TOWN.OVL` (dos piezas distintas, ambas bajo `g_location == 0x1d`)

**Pieza 1 — el Cetro borra el slot 9 (`0x1253-0x1267`):**
```
1253: cmp [g_location], 0x1d     ; Stonegate
125a: cmp [g_sceptre], 0
125f: je  0x1268                 ; no lo tienes → no se toca
1261: ax = 9 ; push ; call 0xb0  ; ← borra el slot 9
```
**Pieza 2 — anuncio de los TRES (`0x1275-0x1290`):**
```
127c: si = 2
127f: cmp byte [si + 0x58c8], 0x80  ; g_shadowlord_locs[si] vivo (<0x80)?
1286: push si ; call 0x11b8          ; ← anuncia SL si
128a: dec si ; jns 0x127f            ; 2 → 1 → 0
```
Fuera de Stonegate (`0x1294`) anuncia **sólo** el presente (`g_unk_5958`).
`0x11b8` imprime «\nAn air of\n» (DS 0x27b8) + nombre de la tabla `0x27dc[idx]`
(**falsehood / hatred / cowardice**, extraídos de DATA.OVL) + « doth surround thee...\n»
(DS 0x27c4), y cierra con un tono.

### El port lo modela, y bien
`core/world/shadowlord-urban.ts` + `game.ts:4561 applyUrbanShadowlord`:
- `STONEGATE_LOCATION = 29` = `0x1d`, **con la cita `TOWN 0x1275` en el propio comentario**.
- En Stonegate anuncia **los tres vivos, orden 2→1→0**, con el gate `< 0x80`.
- **Sin sprite físico** en Stonegate (`idx === -1`) — igual que el binario, cuyo escaneo de
  `town_place_shadowlord` no encuentra ninguno «localizado» allí.
- Cetro/slot 9: el port **no borra un slot**, sino que **no siembra** el objeto plot si
  `lbArtifacts.sceptre` — y su propio comentario lo declara «espejo observable de la retirada
  del binario». **Equivalencia observable correcta**: el objeto no está, que es lo único que
  el jugador puede ver.

⇒ **FIEL.**

### Defecto documental encontrado y ARREGLADO (radio cero)
`game.ts:4425` decía «Stonegate (**loc 25**)». Es falso y lo contradicen tres sitios del
propio repo: `game/assets/maps/smallmaps.json` (`{id: 29, name: "Stonegate"}`),
`shadowlord-urban.ts:36` (`STONEGATE_LOCATION = 29`, con cita al binario) y `state.ts:65/97`
(«Stonegate loc 29», dos veces). Corregido a «loc 29 = 0x1d». **Sólo comentario.**

---

## (h) veneno de pantano — **FIEL en la pata del veneno**, las otras dos SIN VERIFICAR

El port **ya distingue las dos variantes**, que es justo donde estaba el riesgo:

| | fórmula | sitio |
|---|---|---|
| exterior | `rand(1,30) > DEX` | `loops/hazards.ts:149 swampPoison` |
| **pueblo** | **`rand(0,29) > DEX`** | `loops/hazards.ts:169 townSwampPoison`, cita **TOWN post_turn 0x108D** (`0x108D rand(0,0x1d)`; `0x1096 cmp DEX,roll; jae`) |

Y el comentario del port avisa explícitamente de no reutilizar uno por otro («span 30
empezando en 0, no en 1»). Coincide con el enunciado del hallazgo (`DEX < rand(29,0)`).

**NO verificadas** (y por eso no llevan veredicto): el **despertar 1/16** y la **tabla DS
0x13A5**. Aviso para quien siga: `game.ts:4586` usa `DS:0x13a5` para la **Y de spawn del
Shadowlord por location**, así que o el hallazgo apunta a otra tabla o hay un solapamiento
que hay que resolver antes de afirmar nada.

---

## (e) pezuña 1×/2× montado — **NO ADJUDICABLE con lo aportado**

- **Censo del port: NEGATIVO.** Cero ocurrencias de `pezuñ|hoof|clop` en todo `game/src`.
- **Y no puedo cerrar el lado del binario**: el mapa enuncia el hallazgo *sin cita*, y las
  únicas 2 llamadas al generador de tonos en `TOWN.OVL` son `0x0e6d` y `0x11e9` (esta última
  es el heraldo del Shadowlord de (b)) — **ninguna cuelga del movimiento montado**.

⇒ Sin la cita del lote original (7 / 24-1) no se puede decir si es HUECO o si el sonido vive
en otro overlay. **Un veredicto aquí sería flojo**, y la regla del carril anterior aplica:
cuesta más que ninguno. **Devuelto al lead pidiendo la cita de origen.**

---

## (f) y (g) — CENSO + RADIO, sin cablear (como se pidió)

| pto | censo del port | veredicto provisional | radio si se cablea |
|---|---|---|---|
| **(f)** cadencia NPC montado (turnos alternos · T congela · Q mitad) | **NEGATIVO**: cero implementación; los hits de `montado`/`congela` son de UI (montaje de canvas, rótulos) | **HUECO probable** | **ALTO**: cambia el número de turnos de NPC por turno de jugador ⇒ mueve el RNG de todo pueblo y con él los digests de los specs de pueblo |
| **(g)** trampilla Stonegate TPK (Lava + roster HP=0) | **NEGATIVO**: cero implementación; los hits de `trampilla`/`lava` son de render de mazmorra y del flash de inversión | **HUECO probable** | **MUY ALTO**: mata a la party ⇒ toca cualquier spec que pase por Stonegate, y el party-wipe arrastra la escena de refugio |

Ambos con «probable» a propósito: el censo del port es firme (negativo), pero **no he
derivado el lado del binario** para ninguno de los dos, porque el encargo era censo+radio.

---

## Gates
`tsc --noEmit` **EXIT 0** · `tsc -p tsconfig.e2e.json --noEmit` **EXIT 0** (por separado, sin
pipe). Único cambio ejecutable: **ninguno** — un comentario (`game.ts:4425`). Cero playwright.
