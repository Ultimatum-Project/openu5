# Adjudicación — encuadre de la ARENA de combate y dominio del lookup radial (R2 de port-t37-review, SCOUT)

**VEREDICTO: (B) arena FIJA (celda-de-arena = celda-de-ventana, copia 1:1) — Y, hallazgo
mayor, SIN censura por luz en combate en absoluto.** La rama LOS/flood del compositor
(`0x5910`, `0x5A28`) **NUNCA se alcanza en combate**: el combate corre con
`g_location = 0xFF` (≥ 0x80), y las tres rutinas de render (`0x4402`, `0x5910`, `0x5394`)
bifurcan en `loc ≥ 0x80` hacia el camino "arena": lectura directa de `0xAD14`, **copia
`rep movsw` byte-a-byte de la arena entera a pantalla, sprites de combatientes pintados en
su celda de arena CRUDA (sin recentrado), sin máscara radial**. No hay flood, no hay radio
de luz, no hay rombo negro nocturno. Esto **refuta la premisa central de `#33`
(`combat-light-adjudication.md`)** — que el combate corría la rama `loc < 0x80` con flood
centrado en el activo — y por tanto **la task `#37` está mal fundada de raíz**: la
corrección no es "recentrar", es **retirar toda la censura de combate** (la arena se ve
entera SIEMPRE, de día y de noche).

> **Convención de offsets.** `kernel 0xNNNN` = offset de imagen de `ULTIMA.EXE.asm`.
> Nombres reconciliados contra `re/ledger/globals.json` (`g_location` 0x5893, `g_party_x/y`
> 0x5896/0x5897, `g_chunk_origin_x/y` 0x589B/0x589C, `g_light_level` 0x58A5, `g_cmb_actor`
> 0x589E) y las notas `combat.md`, `kernel-flood-0x5a28.md`, `combat-light-adjudication.md`.

---

## 1. El dominio del lookup radial es SIEMPRE (5,5): el viewport está party-centrado (mundo)

En el flood `0x5A28` (leído en `kernel-flood-0x5a28.md §2`) la semilla es el **CENTRO fijo
(5,5)** de la ventana (`5a6e`: encola `5`,`5`), y la distancia radial se mide con la tabla
`0x6ff0(col,row)` sobre coords de ventana 0..10 (que internamente devuelven la distancia
respecto de (5,5)). El "centro" del combatiente/party entra sólo como **origen global de la
ventana** para el lookup de tile `0x4402`, NO como desplazamiento del lookup radial.

La prueba de que el viewport del MUNDO recentra sobre la party está en la rama de relleno
manual de `0x5910` (`59b4`-`59d1`), que mapea celda de ventana → global sin usar
`g_chunk_origin`:

```
59b8: cl = g_party_x
59be: ax = col + g_party_x
59c0: ax = col + g_party_x - 5      ; global_X = g_party_x - 5 + col
59c7: cl = g_party_y
59cb..59cd: ax = row + g_party_y - 5 ; global_Y = g_party_y - 5 + row
59d1: call 0x4402                    ; lookup de tile
```

En `col=5,row=5` ⇒ global = `(g_party_x, g_party_y)` = la party queda en (5,5). El
`(g_party - g_chunk_origin)` que la rama flood empuja (`596b`-`5982`) es una reexpresión del
mismo centro: `0x4402` vuelve a sumar `g_chunk_origin` internamente (rama `loc==0`,
`4427`-`4444`), así que **`g_chunk_origin` se cancela** y el mapeo neto es siempre
`col → g_party - 5 + col`. Por eso en el MUNDO los offsets radiales nunca superan 5 y de día
(radio 50 ≥ dist²(5,5)=50) toda la ventana 11×11 se enciende. **Esto responde el punto (3)
de R2: el lookup radial jamás recibe offsets > 5 y jamás se sale de la tabla — en el
MUNDO.** Pero nada de esto se aplica al combate (§2-§3).

## 2. `0x4402` SÓLO lee la arena `0xAD14` en `loc ≥ 0x80` (evidencia decisiva)

El lookup de tile bifurca por `g_location` (`4408`-`441c`):

```
4408: cmp [g_location], 0x7f
440d: jbe 0x4420               ; loc <= 0x7f  → mundo/pueblo (lee 0x6608, con wrap/chunk)
440f: ax = [bp+4] << 5         ; loc >= 0x80  → ARENA:
4416: ax += [bp+6]             ;   addr = Y*32 + X
4419: ax += 0xad14             ;   + base de la arena  ⇒  [0xAD14 + Y*32 + X]
```

El buffer de combate vive en `0xAD14` (`combat.md §1`: "Mapa del combate — DS:0xAD14, 11
filas × stride 32; tile en [0xAD14 + y*32 + x]"). **La arena es direccionable por el
renderer ÚNICAMENTE en la rama `loc ≥ 0x80`.** Si el combate corriera `loc < 0x80`, `0x4402`
leería el mapa de pueblo/mundo (`0x6608`) — dibujaría el overworld, no la arena: absurdo.
⇒ **durante todo repintado de arena, `loc ≥ 0x80`.**

## 3. `0x5910` en `loc ≥ 0x80` = copia directa 1:1 (sin flood, sin máscara)

`0x5910` bifurca en `5954`: `cmp [g_location],0x80; jb 0x595e` (rama LOS/flood) `/ jmp 0x59f8`
(rama directa). La rama directa (`59f8`-`5a0b`):

```
59f8: cx = 0x160               ; 352 bytes = 11 filas × 32 stride
59fb: di = 0xab02              ; buffer de pantalla (mismo destino que usaría el flood)
59fe: si = 0xad14              ; ARENA
5a07: rep movsw                ; COPIA CRUDA 0xAD14 → 0xAB02, sin máscara
```

⇒ en combate (`loc ≥ 0x80`) la arena 11×11 se vuelca **entera y 1:1** (celda de arena =
celda de ventana). **La rama flood `0x5A28` no se ejecuta.** Confirmación cruzada: el
flash de impacto `0x3564` restaura llamando a `0x5910` (`35E1`, `combat-ui-spec §3`) — misma
copia directa cada golpe. La afirmación de `#33 §1-§2` ("el combate compone por `0x5910` →
flood") es correcta en el CALL pero errónea en la RAMA: es la rama directa, no la flood.

## 4. Los SPRITES de combatientes se pintan en celda CRUDA, sin recentrar, sin radio

Tras la copia, `0x5910` llama a `0x5394` (`5a0d`), el compositor de sprites, que **también
bifurca por `loc`**:

```
539c: cmp [g_location],0x80; 53a1: jb 0x53a6   ; loc<0x80 → camino MUNDO (lee g_party, aplica máscara radial)
53a3: jmp 0x542a                                ; loc>=0x80 → camino ARENA
```

- Camino MUNDO (`53a6`-`53f4`): lee `g_party`, y para cada celda marcada `0xDD` llama a la
  **tabla radial `0x6ff0`** y si `> 5` pinta `0x1C` (tile negro). **ESTE es exactamente el
  mecanismo que el port replica en `radialOffset` (retorno 51 para offset > 5).** Es del
  MUNDO, y en combate se SALTA.
- Camino ARENA (`5483`-`5497`): al colocar cada sprite, la resta del offset de viewport
  `sprite - (g_party - 5)` está **explícitamente gateada a `loc < 0x80`**:
  ```
  5483: cmp [g_location],0x80
  5488: jae 0x54b9            ; loc>=0x80 (COMBATE) → SALTA el recentrado
  548a-548f: [bp-6] -= (g_party_x - 5)    ; SÓLO mundo
  5492-5497: [bp-8] -= (g_party_y - 5)    ; SÓLO mundo
  ```
  En combate el sprite se pinta en su celda de arena **cruda** (`547b`/`5470` cargan x,y del
  registro de objeto 0x5C5A directamente), acotada 0..10 (`54a7`/`54b0`), y sólo se descarta
  si la celda de pantalla vale `0xFF` (fuera de arena/void, `54d4`) o `0x87` (`54e7`). **Cero
  gating por radio de luz.**

⇒ La arena Y los combatientes se dibujan **fijos, cell-for-cell, sin censura**. Modelo (B),
con la salvedad de que en (B) tampoco corre flood alguno.

## 5. Por qué `g_party = activo` NO implica recentrado (reconciliación con `#33 §3`)

`#33 §3` argumentó: "el combate copia el activo a `g_party` (`COMBAT 0x0655`/`065c`);
si usara la rama sin censura sería código muerto ⇒ corre la rama flood." **El argumento no
se sostiene:**
- En `COMBAT.OVL`/`COMSUBS.OVL`, `g_party` se **ESCRIBE y nunca se lee** (censo: único uso =
  `0655`/`065c`).
- Las tres rutinas de render en su rama `loc ≥ 0x80` **NO leen `g_party`**: la copia directa
  `59f8` no lo toca; `0x5394` salta el bloque que lo lee (`53a1 jb` no se cumple); el
  compositor de sprites salta la resta `g_party-5` (`5488 jae`).

Por tanto, para el RENDER de combate, `g_party` es inerte (posible resto vestigial de código
compartido con el mundo, o consumido por otra rutina no-render como la línea de estado). Su
escritura por turno **no recentra el viewport**. La inferencia de `#33` (write ⇒ rama flood)
es un non-sequitur.

## 6. Dónde se fija `loc = 0xFF` (corrobora; no es carga de la prueba)

`kernel 0x5F86` (dispatcher de "modo especial de pantalla") guarda `g_location` en
`g_unk_5894` (`5fa8`-`5fab`), **fija `loc = 0xFF`** (`5fb4`), respalda la tabla de objetos de
combate `0x5C5A → 0xA9FC` (`5fbe`-`5fd8`), despacha por modo (`bp+8`) y **restaura `loc` en
`6094`, DESPUÉS de que el handler retorna**. El wrapper `0x6360` invoca `0x5F86` con
`mode = 4` (`636c: mov ax,4`; `6373`), y `mode & 4` (`602e`-`603d`) llama a `0x8076`
= `lcall 0x72e:0x2ec` = **trampolín far de carga de overlay (COMBAT.OVL)**. Como la
restauración de `loc` ocurre tras el retorno del handler, **todo el bucle de combate corre a
`loc = 0xFF`**. `#33 §4` vio este `0x5F86` y lo descartó como "render de mapa puntual, NO el
bucle de combate": ahí está el error — respalda `0x5C5A` (la tabla de sprites de combate) y
enmarca el despacho far a COMBAT.

> Nota: el argumento de §2-§4 es autosuficiente sin §6. La arena (`0xAD14`) y su tabla de
> sprites (`0x5C5A`) sólo las consumen las ramas `loc ≥ 0x80`; el combate dibuja la arena;
> ergo el combate es `loc ≥ 0x80`. §6 sólo localiza el store.

## 7. Reconciliación puntual con `combat-light-adjudication.md` (#33)

| # | Afirmación de #33 | Estado |
|---|---|---|
| §1 | Flood `0x5A28` sólo se alcanza por la rama LOS de `0x5910` | **Cierto**, pero esa rama es `loc < 0x80` = mundo/pueblo. Nunca combate. |
| §2 | El combate compone la arena por `0x5910` | **Cierto el call; falsa la rama**: es la copia directa `59f8` (`loc ≥ 0x80`), no la flood. |
| §3 | El centro del flood = combatiente activo (`g_party` fijado) | **`g_party` se fija pero no se lee en render de combate** (§5). No prueba recentrado ni flood. |
| §4 | `g_location < 0x80` en combate ⇒ rama flood/censura | **FALSO — es el error de raíz.** `loc = 0xFF` (§2, §6). |
| §5-§6 | "Día se ve entera; noche = rombo negro; portar floodFOV centrado en activo" | **Refutado.** No hay flood en combate: se ve entera SIEMPRE. |

`#33` derivó bien la maquinaria del flood del MUNDO y su reuso; su único (pero decisivo)
fallo fue asumir que el combate entra por esa rama, sin verificar el gate `loc ≥ 0x80` de
`0x4402`/`0x5910`/`0x5394` ni que la arena `0xAD14` es inalcanzable con `loc < 0x80`.

## 8. Qué debe implementar el port

1. **REVERTIR `#37`**: el combate **no tiene campo de visibilidad**. La arena y todos los
   combatientes se ven **siempre** (día, noche, mazmorra). Retirar `combatVisField` /
   la censura por luz en la vista de combate; el snapshot de combate debe dejar la
   visibilidad **toda a visible** (como pre-#37). Esto elimina de golpe R1 (sobre-censura
   diurna), R2 (el modelo de encuadre queda cerrado: fijo, sin flood) y R3 (el fallback de
   centro deja de existir).
2. **No portar `floodFOV` a combate** bajo ningún radio. El `radialOffset`/tabla 6×6 es
   maquinaria del MUNDO (party en (5,5)); en combate no interviene.
3. **Encuadre**: arena FIJA 11×11, celda de arena = celda de ventana (el port ya lo hacía).
   Los sprites de combatientes en su celda cruda; sólo se omiten celdas fuera de arena
   (`0xFF`) y `0x87` (§4) — comportamiento que el motor ya modela.
4. Actualizar/anexar `combat-light-adjudication.md` (o marcarlo SUPERSEDED por esta nota) y
   `combat-ui-spec §8` para eliminar la reserva de `combatView.visibility`.

## 9b. Respuesta directa a las dos preguntas citadas del reviewer de #37

**(a) ¿El combate actualiza `g_chunk_origin` por turno (recentra) o lo fija una vez al
entrar (arena fija)? — NINGUNA de las dos. Falsa dicotomía.**

Censo COMPLETO de `g_chunk_origin_x/y` (DS 0x589B/0x589C) en TODO el corpus:
- **STORES (8 en total):** `MAINOUT.OVL` (`001e`,`0031`,`0039`,`004c`,`03bd`,`03cb` — scroll
  del overworld) y `TOWN.OVL` (`0424`,`0427` — scroll de pueblo). **`COMBAT.OVL`,
  `COMSUBS.OVL`, `SJOG.OVL`, `DUNGEON.OVL`: CERO stores** (`grep -c 9b58|9c58` = 0 en los
  cuatro). El combate **no escribe `g_chunk_origin` ni por turno ni en el setup**; hereda el
  valor rancio del último scroll de mapa (overworld/pueblo) previo a entrar.
- **LOADS del kernel:** todos en la ruta `loc < 0x80` (mundo/flood): `0x4402@442a/443b`
  (rama mundo), `0x5910@596e/597c` (rama flood), y `0x5A28@5a88/5a97/5bac/5bbc`,
  `0x5D0A/emisor@5dc0/5dc9/5e78/5e83`. **Ningún load en la rama `loc ≥ 0x80` (arena).**

⇒ El "silencio" que el reviewer señaló en `#33 §3` (documenta el store a `g_party`, no a
`g_chunk_origin`) se resuelve así: **no hay store a `g_chunk_origin` en combate porque el
render de arena no usa `g_chunk_origin` en absoluto.** La rama arena de `0x4402` (`440f`-
`4419`) direcciona `[0xAD14 + Y*32 + X]` **cruda, sin restar origen**. La "arena fija" NO se
logra fijando `g_chunk_origin`; se logra porque las ramas `loc ≥ 0x80` **puentean toda la
matemática de viewport/origen**. Y el store por turno a `g_party` (`0655`) tampoco recentra
(nadie lo lee en el render de combate, §5).

**(b) Dominio del lookup radial `0x6ff0` para offset > 5: ¿clamp o `dx²+dy²` real?**

`0x6ff0` (leído `6ff0`-`703d`) es una **tabla precomputada** `DS:0x6aa8` (= `RADIAL_DISTANCE`
del port), indexada por coords de VENTANA plegadas:

```
6ff6: bx=[bp+6] (a) ; dx=[bp+4] (b)          ; a,b = coords de ventana 0..10
6ffc: cmp a,0xb / 7001: cmp b,0xb → jge 703b ; a|b >= 11 → return 0 (fuera de ventana)
7006-700e: a<=5 && b<=5 → índice directo
7010-7024: PLIEGUE — a>5 ⇒ a' = 10-a ; b>5 ⇒ b' = 10-b   (espeja alrededor de 5)
7026-702c: índice = a' + 6*b'
702e: al = [bx + 0x6aa8]  ; valor = dist² precomputada   ; 703b: return 0
```

Es `dx²+dy²` REAL (tabla), **no un clamp**. Clave: `0x6ff0` recibe coords de VENTANA 0..10,
así que `|coord-5| ≤ 5` SIEMPRE dentro de la ventana; **el caso "offset > 5" NUNCA ocurre en
el original** porque el viewport del mundo está siempre party-centrado (centro = (5,5)). El
retorno "51 / fuera de alcance" es un artefacto **del PORT**, que aparece SÓLo si se centra
el flood descentrado — exactamente lo que `#37` hizo en combate. En el original ese régimen
no existe: de mundo la party está en (5,5) (offsets ≤5, arena/ventana entera de día); de
combate **no corre flood** (§3-§4). Por tanto la premisa del reviewer ("desde centro
descentrado la arena diurna no se cubre con radio 50") es correcta como aritmética pero
**describe un estado inalcanzable en el binario** — ni el mundo descentra, ni el combate
floodea. Eso es lo que cierra (a): el original no recentra por turno NI mantiene un flood
descentrado; simplemente **no censura la arena**.

## 9. ¿Hace falta witness DOSBox? No para decidir; sí como confirmación barata

La derivación estática es concluyente (gate triple `loc ≥ 0x80`). Un witness lo cerraría a
ojo: **combate diurno Y nocturno con un PJ en una esquina** ⇒ la predicción de esta nota es
**arena entera visible en ambos, sin recorte ni rombo negro, sin desplazamiento de la arena
al cambiar de turno**. La predicción opuesta de `#33` (noche = rombo negro alrededor del
activo) **debe NO observarse**. El usuario tiene ventana DOSBox pendiente; el vídeo D en
`original/av-referencia/` (combate diurno) ya debería mostrar arena entera con activo fuera
de centro, consistente con (B)/esta nota.
