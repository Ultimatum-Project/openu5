# ACTA — #124 AUD-A3: contigüidad FÍSICA del roster

> Rama `fix/party-124`, worktree `.claude/worktrees/party-124`, retenida (aterriza el lead).
> GATES sin pipe: `npx vitest run` desde `game/` **EXIT 0** (288 ficheros, 3717 pasados,
> 1 skipped) · `npx tsc --noEmit` **EXIT 0**.

## §1 — El encuadre (el del verificador, confirmado)

`slice(0, partySize)` **ES fiel**: el binario itera slots 0..N-1 (catarata OUTSUBS
0x04b6, aparición 0x07fb). Lo roto era el **invariante** que esos bucles asumen. El
binario lo mantiene MOVIENDO RECORDS; el clon sólo cambiaba `partyStatus`, así que el
prefijo seguía conteniendo a quien se había quedado en la posada.

El roster son **16 records de 32 B** (`saveNative`: `CHAR_RECORD_COUNT=16`,
`CHAR_RECORD_SIZE=32`, base DS 0x55a8) — el clon ya modelaba esa forma, así que la
traducción es 1:1.

## §2 — Los tres cuerpos, leídos ENTEROS

Cada movimiento del binario es un `repne movsw` con **`cx=0x10` = 16 words = los 32 B
del record COMPLETO**. Respuesta a las dos preguntas del encargo:

- **¿Qué campos viajan?** TODOS los del record.
- **¿El equipo incluido?** SÍ: helmet/armor/weapon/shield/ring/amulet están en
  +0x19..+0x1E, DENTRO del record. En el clon el record es el objeto `CharacterState`,
  así que mover la referencia en el array lo lleva todo (test propio lo sella).

### 2.1 (J)oin — TALK.OVL 0x08c8-0x0912 — **SWAP**, no desplazamiento
```
08cf  mov byte [si+0x55c7],0      record[idx].partyStatus = 0   (ANTES del swap)
08d6  TEMP = record[idx]          (a la pila, ss:[bp-0x26])
08f7  record[idx] = record[party_size]
0908  record[party_size] = TEMP
0912  inc [g_party_size]
```
★ Con el roster ya contiguo `idx == party_size` y el swap es un no-op sobre sí mismo —
por eso el defecto podía pasar desapercibido. Tiene test propio.

### 2.2 (L)eave en posada — SHOPPES3 0x03dd-0x0472 — COMPACTA EL ROSTER ENTERO
```
03dd-0400  RE-INDEXA g_active_char: idx==activo → 0xFF ; idx<activo (y activo!=0xFF) → dec
040f       record[idx].partyStatus = g_location
0413       record[idx].monthsAtInn = 0        (+0x17)
0418       TEMP = record[idx]
0431-0463  bucle (15 - idx) veces: record[i] = record[i+1]
0465       record[15] = TEMP    (0x5788 = 0x55a8 + 15·32)
0472       dec [g_party_size]
```
★ **No es «sacar del party»: desplaza los 16 slots y manda al hospedado al ÚLTIMO**.
★ La re-indexación del activo es MECÁNICA, no adorno: su índice apunta a un slot que se
mueve.

### 2.3 (P)ickup — SHOPPES3 0x07be-0x083a — la INVERSA
```
07c5       TEMP = record[idx]
07e6-081d  bucle (idx - party_size) veces: record[i] = record[i-1]   (desplaza ARRIBA)
0829       record[party_size] = TEMP
083a       inc [g_party_size]
084c       record[party_size_viejo].partyStatus = 0   (DESPUÉS de moverlo)
```
★ **ASIMETRÍA FIEL declarada**: el pickup **NO** re-indexa `g_active_char` — no existe
equivalente del BLOQUE de re-indexado, SHOPPES3 0x03dd-0x0400, aunque su desplazamiento también
mueve slots. Se calca bug-for-bug y tiene test que lo fija.

## §3 — Radio: qué más guarda un índice de roster

Censo de campos persistentes que son índice de roster: **sólo `activeCharacter`** — el
único que el binario re-indexa explícitamente. `shadowlordSummoned` es índice de
Shadowlord (0-2), no de roster; `guardIdx`/`buyerIdx`/`casterIdx`/`memberIdx` son
parámetros transitorios de un solo comando, no sobreviven a un innLeave. **No apareció
ninguna bifurcación de diseño**, por eso no hubo que parar.

## §4 — Consumidores: NO se tocan (⚠ del verificador, respetada)

No se ha cambiado ni un consumidor al filtro por `partyStatus`. Habría divergido el
ORDEN de miembros, y con él los rands y los bytes del .GAM. El arreglo es del
INVARIANTE, no de quien lo lee.

## §5 — Careo del save (obligatorio)

El layout del party **ES** el save: 16 records × 32 B desde 0x02. Mover records cambia
bytes del .GAM — **efecto pretendido**. El test nuevo sella: (a) tras el leave el .GAM
tiene a Iolo en el slot 1 y al hospedado en el 15 con `partyStatus = location`; (b) el
par exportar → importar → exportar devuelve la ventana del party **byte-idéntica**.

## §6 — Impacto de stream DECLARADO

El fix **no añade ni quita tiradas**: no toca ningún `rand`. Lo que cambia es **A QUIÉN**
le tocan las que ya se tiraban, y con ello el estado resultante:
- catarata (OUTSUBS 0x04b6), aparición de acampada (OUTSUBS 0x07fb), hazards ×4, `turn.ts`,
  `camp.ts`, `survival.ts` y `equip.ts` recorren el prefijo: antes podían golpear al
  hospedado y saltarse a quien viaja.
- El **orden** del prefijo cambia tras un leave/pickup, así que las tiradas POR MIEMBRO
  (daño de hazard, barrido del anillo, comidas) se reparten distinto. El stream avanza
  igual; el reparto no.

## §7 — Impacto e2e DECLARADO (nada corrido)

- Cualquier cadena que deje o recoja compañeros en posada: cambia el orden del roster y,
  con él, los **bytes del .GAM** y cualquier digest que lo cubra.
- Specs que fijen un índice de roster A MANO después de un leave se romperán **con
  razón** — es el caso de `shops.test.ts`, que ya se actualizó aquí para localizar al
  compañero por IDENTIDAD y sellar de paso los slots derivados (15 tras el leave, 2 tras
  el pickup).
- Specs de Ztats/party-panel que asuman posiciones fijas tras un leave.
- **NO** debería moverse nada que no pase por join/innLeave/innPickup.

## §8 — Failing-first (evidencia)

`party-roster-contiguity.test.ts` corrido contra el código PRE-FIX (revirtiendo sólo
`game/src` con un parche y volviendo a aplicarlo): **6 rojos de 7**. El primero es el
REPRO de la tarjeta, y su mensaje es el defecto en una línea:

```
expected [ 'Avatar', 'Shamino' ] to deeply equal [ 'Avatar', 'Iolo' ]
```

es decir, el prefijo que la catarata golpea contenía a **Shamino (en la POSADA)** y no a
**Iolo (que viaja)**. El 7º test es control: la asimetría del pickup pasa antes y después
(ningún modelo re-indexa el activo ahí).
