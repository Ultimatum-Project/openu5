# La capa de TRAMA en DS — y por qué de los cuatro objetivos sólo UNO era un hueco de dirección

Carril `trama-flags-227` · rama `re/trama-flags-227` · **2026-08-13**.
**SHA de main al abrir el worktree: `5dd8de25`.**

Ficha #227. El `SAVED.GAM` es un volcado verbatim de 4192 B de DGROUP desde `DS 0x55A6`
(`save-window-writer.md` §1-§3) ⇒ `file_offset = DS − 0x55A6`.

---

## 0. 🔴 LA PREMISA DEL ENCARGO ES FALSA PARA TRES DE LOS CUATRO OBJETIVOS

El encargo dice: «los flags YA viajan en el fichero; **lo único que falta es su DIRECCIÓN**».
Fui a derivarlas y me encontré con que **el port ya las tiene, con la dirección correcta y con
la cita del cuerpo**:

| objetivo del encargo | ¿faltaba la dirección? | dónde está YA |
|---|---|---|
| Shadowlord destruido ×3 | **NO** | `state.ts:679` — «init.gam **+0x322** son 3 bytes a 0x00»; y `survival.ts:210` implementa el `cur >= 0x80` con la cita `0x4ffd/0x5002` |
| Cuál está convocado | **NO** | `state.ts:733` — «+0x325 (`g_shadowlord_here` **DS:0x58CB**, el byte contiguo a `shadowlordLocs`) vale 0xFF = ninguno» |
| Bitmap del ritual | **NO** | `state.ts:687` — `shadowlordDoomBits`, «Acumulador OR puro: `(?? 0) \| DOOM_BIT[idx]` (**CAST 0x171d**)» |
| **Palabra dicha ×8** | **SÍ** | **no existe en el árbol** — §2 de este acta |

★★ **Lo que falta NO es la dirección: es el CABLEADO.** `saveNative.ts:871` manda
`shadowlordLocs`/`shadowlordSummoned`/`shadowlordDoomBits` al **sidecar** aunque su offset en la
ventana esté escrito a dos ficheros de distancia y su vecino `SHRINE_DESTROYED_OFFSET = 0x332`
sí sea nativo. Enunciar el encargo como «derivar direcciones» manda a buscar algo que ya estaba
y **deja fuera el trabajo real**, que es de tres líneas de `writeBoolPreserve`.

⇒ **Corrección para quien re-encargue**: el consumidor de #226 no necesita una derivación para
los Shadowlords. Necesita que el exportador escriba `0x322..0x325` en vez de mandarlos al
sidecar. Lo único que necesitaba derivación es la palabra dicha.

## 1. La dirección que SÍ faltaba — la palabra dicha

| campo | DS | offset `.GAM` | tamaño | grado |
|---|---|---|---|---|
| **Palabra de poder pronunciada** (las ocho) | `0x58d0 + i` | `0x32A + i` | 8 B | dirección **MEDIDA**; *semántica del bit* **CORRELACIONAL** (§5.2) |

`i = location − 33` ∈ {0 = Deceit … 7 = Doom}. El port lo lleva hoy en
`questFlags["word-spoken:<loc>"]`, sidecar puro.

**Ausencia comprobada con control positivo**: `grep -rniE "0x32a"` sobre `game/ re/ docs/` da
CERO aciertos fuera de este acta (el único otro es `0x32A6`, una dirección de código ajena),
mientras que el mismo patrón con `0x332` — el vecino inmediato — devuelve tres consumidores
vivos. No es un censo-cero de patrón roto.

**Los dos únicos tocadores en los 28 ficheros del disasm:**

```
CMDS.OVL 0x13bd: 80b4d05880   xor byte ptr [si + 0x58d0], 0x80    ; si = 0..7 (bucle 0x13f8, cmp si,8)
OUTSUBS.OVL 0x0025: 80bcd05801 cmp byte ptr [si + 0x58d0], 1
            0x002a: 1bc0 sbb ax,ax / 0x002c: f7d8 neg ax          ; devuelve 1 SI EL BYTE ES 0
```

Es un **XOR**, no un `set` — la propiedad que #58 ya había medido («gritar la palabra dos veces
re-sella en el original»). Con dos tocadores y nada más, el byte no lleva más que ese bit.

★ La tabla encaja **exactamente** en el hueco entre dos campos ya nativos: `0x32A + 8 = 0x332`,
que es `SHRINE_DESTROYED_OFFSET` (8 B, bit `0x80` = destruido). Misma longitud, misma
convención de bit, contigua. La ventana no tiene un hueco raro aquí: tiene **dos bitmaps de
trama de 8 bytes seguidos**, y el port modelaba el segundo y no el primero.

## 2. El predicado que decide NO es `== 0xFF`, es `≥ 0x80`

Vale para los Shadowlords, y es la parte de §0 que sí conviene dejar escrita porque **el port
la implementa bien en un sitio y la duplica mal en otro** (§4).

- **ESCRITOR** — `CAST.OVL 0x1708-0x171d`, el ritual, escribe **tres** cosas:
  `[bx+0x58c8] = 0xFF` (destruido) · `[bx+0x57b6] = 0` (consume el shard) ·
  `or word[0x5bca], byte[bx+0x4892]` (el bitmap de `shadowlordDoomBits`).
- **LECTOR 1** — `ULTIMA.EXE 0x4ffd`: `cmp byte [bx+0x58c8], 0x80 / jae` ⇒ el re-sorteo de
  medianoche **salta** los `≥0x80` (ficha #105; ya portado en `survival.ts:210`).
- **LECTOR 2** — `MAINOUT.OVL 0x07de-0x07f4`, **el gate de los tres muertos**:

```
07de: a0c858    mov al, byte ptr [g_shadowlord_locs]
07e3: 8a0ec958  mov cl, byte ptr [g_shadowlord_locs+1]
07e9: 23c1      and ax, cx
07eb: 8a0eca58  mov cl, byte ptr [g_shadowlord_locs+2]
07ef: 23c1      and ax, cx
07f1: 3d8000    cmp ax, 0x80
07f4: 7341      jae 0x837            ; los tres con el bit 7 ⇒ PASA
07f6: …                              ; si no: mensaje 0x2a2f y PLANTA un 0xFC
```

El AND de los tres `≥ 0x80` ⟺ los tres destruidos. Es el equivalente binario de `canReachDoom`,
y el brazo del `else` **no es un rechazo pasivo: materializa un Shadowlord** (`[bx+0x5c5a]=0xFC`).
`0xFF` es sólo lo que escribe el ritual; **ningún lector compara contra `0xFF`**.

## 3. La trampa del censo simbolizado — que YA ESTABA ESCRITA, y la volví a pisar

Mi primer censo fue `grep 0x58c8` sobre `re/disasm/*.asm`: **9 sitios**. Faltaban cuatro, justo
los que el disasm imprime con nombre: `MAINOUT 0x07de/0x07e3/0x07eb` (`g_shadowlord_locs` —
**el gate de §2, el lector que decide**) y el vecino `g_shrine_quest_bitmap`.

🔴 **Esto no es un hallazgo mío: es una lección documentada que no consulté antes de medir.** La
memoria `censo-global-hex-y-simbolo` lo tiene desde el 27-07 **con esta misma dirección de
ejemplo** — «Con 0x58c8 igual: el grep hex se dejaba 3 accesos de MAINOUT que solo aparecen como
`g_shadowlord_locs`». Lo redescubrí gastando una pasada. Lo dejo escrito aquí porque el acta
sería deshonesta presentándolo como nuevo, y porque el sesgo merece repetirse: **se simboliza lo
que alguien ya estudió, así que un censo por dirección cruda pierde preferentemente los sitios
MÁS documentados** — que suelen ser los que deciden.

★ Lo único que sí aporto es un canal más barato que el de la memoria (que pide resolver
`globals.json` y sumar offsets en DECIMAL): grepear **el encoding little-endian en la columna
de bytes del listado**, que es independiente de la simbolización y no necesita catálogo:

```bash
grep -nE "^[0-9a-f]{4}: [0-9a-f]*c858([0-9a-f]{2})?([0-9a-f]{2})? " re/disasm/*.asm
```

9 → 13 sitios en una sola pasada. No sustituye a los canales de la memoria (no ve el
desplazamiento negativo ni el indexado por registro); los complementa.

Familia de [[grep-por-mi-direccion-no-por-el-concepto]] y de [[censo-global-hex-y-simbolo]].

## 4. Cabo NUEVO: `destroyShadowlord` es un duplicado SÓLO-DE-TESTS que escribe 1 de 4 campos

El camino VIVO del ritual (`endgame/use-tools.ts:123-127`) escribe los cuatro con sus citas
(`questFlags` · `shadowlordLocs[i]=0xff` `// 0x170b` · `shards[which]=false` `// 0x1710` ·
`shadowlordDoomBits |= doomBit` `// 0x171d`). **Correcto y fiel.**

Pero `quest/shadowlords.ts:98` `destroyShadowlord` escribe **sólo** `questFlags[...]`, y no
toca `shadowlordLocs`. Censo de llamadores: **ninguno en producción** — sus 6 usos están todos
en `game/tests/quest.test.ts`. ⇒ **hoy no hay divergencia viva**, y por eso no propongo tocarlo.

★ Pero es una trampa armada: es una función exportada con nombre de acción de dominio, y a
quien la cablee en producción le dejará `shadowlordLocs[i] < 0x80` con el Shadowlord «muerto»
⇒ `relocateShadowlordsAtMidnight` **seguirá re-sorteándolo cada medianoche y gastando su RNG**
(el `do…while` de `survival.ts:212`), que es consumo de stream compartido. La forma sana sería
que la única manera de matar a un Shadowlord fuese la que ya escribe los cuatro.

## 5. Testigos

### 5.1 ★★ La aritmética de la ventana, verificada EN VIVO en el original

Se arrancó `ULTIMA.EXE` bajo `dosbox-x` headless con **run-dir propio** (copia mía del juego +
un `SAVED.GAM` elegido; `original/u5/play` y los saves del usuario **intactos**, REGLA 3), y se
leyó la RAM viva con el debugger. Instrumento: `re/tools/oracle.py` **sin editar** (REGLA 4) —
se monkeypatchea `oracle.GAME_SRC` desde el script del testigo.

| campo | fichero `.GAM` (offset) | RAM VIVA (DS) | careo |
|---|---|---|---|
| shards `0x57b6` | `00 00 00` (+0x210) | `00 00 00` | IGUAL |
| slLocs `0x58c8` | `ff ff ff` (+0x322) | `ff ff ff` | IGUAL |
| slAquí `0x58cb` | `ff` (+0x325) | `ff` | IGUAL |
| shrineQ `0x58cc` | `00` (+0x326) | `00` | IGUAL |
| shrineV `0x58ce` | `00` (+0x328) | `00` | IGUAL |
| **seals `0x58d0`** | `00`×8 (+0x32A) | `00`×8 | **IGUAL** |

★★ Y el control que no puse yo: el oráculo deriva su base de segmento **buscando el roster en
RAM**, por un camino que no sabe nada de este acta, y reportó `roster_off=0x55A6` — la misma
base que `save-window-writer.md` derivó leyendo al ESCRITOR. Dos mecanismos sin parentesco
dando `0x55A6`.

⇒ la correspondencia `offset .GAM ↔ dirección DS` de la tabla de sellos está **medida**. Lo que
este testigo **no** establece es la semántica de sus bits.

### 5.2 La semántica del bit del sello es CORRELACIONAL

Barrí los 38 `.GAM` de `original/u5/saves-lib`. `seals[7]` (Doom, `location` 40) vale `0x80` en
**todos** los saves que están DENTRO de Doom y `0x00` en los dos staged FUERA
(«puertas-doom-*», sembrados precisamente *para* dar el grito). Encaja con «`0x80` = palabra
dicha». Pero `seals[0..6]` vale `0x00` en **todos**, incluidos los que están DENTRO de Covetous
y de Wrong — coherente sólo si entrar a las siete mazmorras normales **no** exige la palabra, y
eso no lo he derivado. Correlación fuerte, mecanismo no cerrado.

### 5.3 🔴 El testigo PROVOCADO: intentado DOS veces, NO obtenido

Sembré `puertas-doom-con-caja` (`seals[7]=0x00`) en un run-dir propio e inyecté `Y` +
`VERAMOCOR` + Enter. **`seals` no cambió.** Ese resultado **no se firma como refutación**,
porque tiene al menos tres causas indistinguibles con lo que medí:

1. las teclas no llegaron al juego;
2. llegaron y la palabra se «pronunció», pero **no hubo casación posicional** — que es el
   comportamiento CORRECTO según `CMDS 0x139a-0x13e7`: el sello sólo togglea si la celda
   adyacente casa contra las tablas `DS 0x1eaa/0x1ed2`;
3. la party está en el Underworld (`g_location=0`, `(128,128)`) y la entrada de Doom puede no
   estar en esas tablas de coordenada de sobremundo.

Lancé una **segunda corrida con control positivo** (andar antes de gritar, para demostrar que la
inyección de teclas mueve algo observable). **No terminó dentro de su `timeout`**, así que
tampoco aporta. ⇒ el testigo provocado queda **NO OBTENIDO**, no «negativo».

★★ **Un no-cambio sin control positivo no distingue «no ocurrió» de «no lo provoqué».**

## 6. Qué debería hacer el port

1. **`0x32A + i`, bit `0x80`**: pasar `questFlags["word-spoken:<loc>"]` a byte nativo, y
   **togglear** (XOR), no asignar — §1 y ficha #58.
2. **`0x322..0x325`**: retirar `shadowlordLocs`/`shadowlordSummoned`/`shadowlordDoomBits` del
   sidecar y escribirlos a byte, como ya hace su vecino `0x332`. **No hace falta derivar nada
   más**: los offsets llevan meses escritos en `state.ts` (§0).
3. Si alguien toca el gate de endgame: el original lo resuelve con **el AND de los tres bytes
   ≥ 0x80** (§2), no con tres booleanos.
4. `destroyShadowlord` (§4): o se le da los cuatro campos, o se marca como test-only.

## 7. Ventana de RNG

**Ninguna por parte de este acta**: no toca código del port. Aviso para quien implemente: el
re-sorteo de medianoche (§2, fichas #101/#105) **consume RNG con reintento sin tope**, así que
cualquier cambio en qué Shadowlords cuentan como vivos **mueve el stream**.

## 8. Limitaciones declaradas

- **No he tocado el port.** Las citas de `state.ts`/`survival.ts`/`use-tools.ts`/`saveNative.ts`
  son lecturas, y son las que REFUTAN la premisa del encargo (§0).
- **No he re-verificado** `save-window-writer.md`: su base `0x55A6` la uso RELAYADA, aunque §5.1
  la re-encuentra por un camino propio.
- **La semántica del bit del sello queda CORRELACIONAL** (§5.2) y el testigo provocado quedó
  **sin obtener** (§5.3). La DIRECCIÓN sí está medida.
- **Sin adjudicar**: `[si+0x57b6] = 0xFF` en `SJOG.OVL 0x16bd` (el otro escritor de la tabla de
  shards, que presumiblemente los otorga — no leí su cuerpo); y `0x58cd`/`0x58cf`, con **cero**
  tocadores en los 28 ficheros (alineación o campos muertos: no afirmo cuál).
- El corpus de saves **no discrimina los tres Shadowlords** (36 de 38 con `ff ff ff`, 2 con
  `00 00 00`, nunca uno muerto y dos vivos), y varias METAs declaran que el estado se fabricó
  **en el port** y se exportó ⇒ no lo presento como testigo del original.
