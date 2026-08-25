# Acta del carril `guardas-170-171`

Las dos tarjetas que sembró el carril `calcados-lote`, ejecutadas. Rama
`mech/guardas-170-171`, retenida.

---

## #170 — «GET THAT HORSE OUT OF HERE!» (TALK.OVL CS:0x00ed)

### 1. La guarda, literal

```
00e6: 55            push bp
00e7: 8bec          mov bp, sp
00e9: 83ec04        sub sp, 4
00ec: 56            push si
00ed: a07c58        mov al, byte ptr [g_transport_tile]   ; DS:0x587C
00f0: 24fe          and al, 0xfe
00f2: 3c12          cmp al, 0x12                 ; ← MONTADO (0x12/0x13)
00f4: 7512          jne 0x108                    ; no montado → conversación normal
00f6: 817e048300    cmp word ptr [bp + 4], 0x83  ; ← EXCEPCIÓN por dialogNumber
00fb: 740b          je 0x108                     ; es el 0x83 → conversación normal
00fd: b87290        mov ax, 0x9072
0100: 50            push ax
0101: e8cc57        call 0x58d0                  ; print_string
0104: e9d300        jmp 0x1da                    ; ABORTA
```

Cadena verificada con `xxd`: DS `0x9072` → file `0x9082` →
`b'A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n'`.

### 2. ★ Lo que decidió DÓNDE va la guarda (y evitó una divergencia inventada)

La tarjeta decía «cablear a la cabecera del flujo de (T)alk del port». **Eso habría sido
un error**, y lo dice el propio despachador del binario:

```
0396: 817efe8000    cmp word ptr [bp - 2], 0x80    ; [bp-2] = dialogNumber
039b: 7d09          jge 0x3a6                       ; >= 0x80 → familia especial
039d: ff76fe        push word ptr [bp - 2]
03a0: e8db0e        call 0x127e                     ; ← NPC NORMAL: intérprete TLK
03a3: ebe9          jmp 0x38e
03a6: 817efefd00    cmp word ptr [bp-2], 0xfd       ; 0xFD/0xFE poseídos, 0xFF guardias…
…
0401: e8e2fc        call 0xe6                       ; ← y AQUÍ el mercader
```

Con `dialogNumber < 0x80` el flujo se va al intérprete de scripts TLK y **no pasa por
`0x00e6` jamás**. `talk_to_npc` es la rutina de MERCADERES — que es exactamente por qué
el mensaje dice «A merchant says». Puesta a la cabeza del (T)alk, la guarda habría echado
al jugador de cualquier conversación con cualquier aldeano del juego.

⇒ va dentro de la rama de tienda de `startTalk`, antes de `startShopConsole`.

### 3. ★ El dominio del transporte: MONTADO, no «caballo»

`and 0xfe / cmp 0x12` = **0x12-0x13 y nada más**. La cabecera de `transport.ts` ya lo
documentaba desde antes: `0x10/0x11` es el caballo **del mundo, sin jinete** (un objeto
sobre el mapa) y `0x12/0x13` el party a lomos; montar hace `+2` sobre el tile del mundo.

El helper existente `isHorse()` es `tile & 0xfc === 0x10` ⇒ 0x10-0x13, **demasiado
ancho**: es la misma clase de sobre-captura que arrastraba la seña de #129. Por eso se
añade `isMounted()` (`transport.ts`) con el mask exacto del binario, y se documenta que
el mismo idioma aparece en `TOWN.OVL CS:0x0b97` (Klimb montado → "-On foot!").

### 4. Qué es el 0x83: el TRATANTE DE CABALLOS

`main.ts SHOP_TYPES` mapea la familia: 0x81 Blacksmith · 0x82 Barkeeper · **0x83
HorseSeller** · 0x84 Shipwright · 0x85 MagicSeller · 0x86 GuildMaster · 0x87 Healer ·
0x88 InnKeeper. La excepción tiene sentido de juego: al tratante de caballos se llega
a caballo, que es lo que vas a venderle. En los datos hay tres (Trinsic slot 1, North
Britanny slot 6, Paws slot 4).

### 5. Turno

El `jmp 0x1da` cae en el epílogo (`pop si / mov sp,bp / pop bp / ret 2`). ⚠ El disasm se
**desincroniza** en `0x01d9` (`rcr word ptr [bp-0x75],0xe5`, basura), pero los bytes de
esa misma línea —`c1 5e 8b e5`— dejan ver que, en el offset `TALK.OVL CS:0x01da`, los bytes
son `5e 8be5` = `pop si / mov sp,bp`. Y el call-site `CS:0x0401` **no mira el retorno** (no hay `or ax,ax` tras él):
la rutina es a efectos prácticos VOID. La guarda imprime y corta, nada más.

### 6. Test y CUATRO controles

`game/tests/talk-mounted-merchant.test.ts` — 22 casos. Los controles failing-first se
hicieron **por condición separada**, no en bloque, para probar que cada término del gate
discrimina:

| variante del código | EXIT | fallidos |
|---|---|---|
| guarda desactivada | 1 | **14** (los 14 positivos) |
| `isHorse` (0x10-0x13) en vez de `isMounted` | 1 | **1** — y es el del caballo del mundo |
| sin la excepción 0x83 | 1 | **1** — y es el del HorseSeller |
| sin la cota de familia (guarda a todos) | 1 | **2** — el del aldeano y el de poseído/guardia |

i18n: la clave `'A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n'` **ya estaba en
`es.json`**, traducida y revisada («Un mercader dice: «¡SACAD ESE CABALLO DE AQUÍ!»\n») —
era huérfana por falta de emisor, y ahora tiene uno. Se añade su entrada `[D]` a
`approved-strings.json`.

### 7. Lo que #170 NO cierra

* Sin verificar en vivo (cero e2e en este carril).
* El mensaje se emite con sus `\n` (forma exacta del binario) porque la clave del corpus
  los lleva; **no** se ha comprobado cómo lo pinta el impresor de consola frente al
  original — eso es del residuo de #108, no de esta tarjeta.

---

## #171 — Los seis `floor >= 0x80` literales

### 1. El defecto, recordado en una línea

El binario compara `g_floor` como **byte sin signo** (`cmp byte ptr [g_floor],0x80 /
jae`), donde el sótano vale 0xFF. En el port `position.floor` es un número **con signo**:
el Underworld sí es 0xFF, pero **los sótanos son z = −1** (`smallmaps.json`). `-1 >= 0x80`
es `false` ⇒ el literal deja pasar justo el caso que venía a cerrar.

Se extrae `isBelowGround(floor)` a `core/world/survival.ts` — junto a `lightLevel`, que
ya hacía la cuenta a mano — para que no haya que redescubrirla en cada consumidor.

### 2. La auditoría, sitio a sitio

| # | sitio | veredicto |
|---|---|---|
| 1 | `endgame/use-tools.ts` `useSpyglass` | ★ **DEFECTO** — arreglado |
| 2 | `skin/coreview.ts:1568` banda de VIENTOS | ★ **DEFECTO** — arreglado |
| 3 | `skin/coreview.ts:1593` banda de LUNAS | ★ **DEFECTO** — arreglado |
| 4 | `endgame/use-tools.ts` `useSextant` | limpio por SUBSUNCIÓN |
| 5 | `world/loops/spawn.ts` `spawnThreshold` | limpio por INALCANZABILIDAD |
| 6 | `combat/encounters.ts` `tileToMonsterId` | limpio por INALCANZABILIDAD |

**Los tres defectos** comparten forma: el otro término del `||` es de *localización*
(`location >= 0x21`, o sea mazmorra), que en un sótano de pueblo/castillo es FALSO porque
`location` sigue siendo la del pueblo (1-0x20). Así que el único término que podía cerrar
el caso era el de piso, y era el roto. Efecto medido: **el catalejo funcionaba bajo
tierra** (donde el original dice «Not here!») y **las bandas de viento y lunas se veían
en el sótano de un castillo**.

**Los tres limpios, con su razón explícita** (no «parece que no»):

* **`useSextant`** — su gate es `floor > 0x7f || location !== 0`, y el término de
  localización **ya excluye todo pueblo/castillo**, que es donde viven los sótanos. Con
  `location === 0` los únicos pisos posibles son 0 (Britannia) y 0xFF (Underworld), y
  `0xFF > 0x7f` evalúa bien sin enmascarar. El término de piso es redundante, no roto.
* **`spawnThreshold`** — inalcanzable con −1. Cadena completa: `Game.runContextTurn`
  (que envuelve el bloque en `if (loc === 0)`), `Game.runNavalTurn` y
  `Game.resolveTrollToll` → `outdoorWorldTurn` → `rollSpawnGate` → aquí.
* **`tileToMonsterId`** — mismo argumento: su único caller de producción
  (`encounters.ts:252`) cuelga del picker de `outdoorWorldTurn`.

Los tres llevan el veredicto **escrito en el código**, con la cadena de llamadas, para que
el siguiente barrido no tenga que rehacer el trabajo ni se los lleve por delante «por
uniformidad».

### 3. Test y control

`game/tests/below-ground-gate.test.ts` — 9 casos: el predicado (sótano −1, Underworld
0xFF, plantas 0..3, frontera 0x7f/0x80) y el gate del catalejo (sótano de castillo,
Underworld, mazmorra por el otro término, y **dos controles negativos** — exterior y
planta alta de pueblo — sin los cuales un gate que dijera «Not here!» siempre también
pasaría).

**Failing-first medido**: revirtiendo `isBelowGround(floor)` al literal `floor >= 0x80`,
EXIT=1 con **1 fallido / 8 verdes**, y el que cae es exactamente el del sótano.

### 4. Lo que #171 NO cierra

* Las dos bandas de `coreview.ts` son piel: el fix es el mismo predicado ya probado, pero
  **no hay test de la banda en sí** (vive en el render, cuya verificación es pixeldiff/e2e
  y este carril no tiene ventana). Se declara.
* No he barrido si existen MÁS literales del mismo género fuera de la lista de seis que
  heredé — la lista venía del censo de #150 y la he tomado como dada.

---

## Gates

| gate | EXIT |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run typecheck:e2e` | **0** |
| `npx vitest run` (completa) | **0** — 296 ficheros, 3815 pasados, 1 skipped |
| `python3 re/tools/seed_gate.py` | ver hito |
| `python3 -m pytest re/tools/test_frontier.py -q` | ver hito |
| `python3 re/tools/genero.py` | ver hito |
