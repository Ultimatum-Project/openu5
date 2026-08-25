# La etiqueta del estado t=0x1C — censo de escritores, kernel y testigo vivo (carril etiqueta-0x1C, 20-08)

Cabo declarado por [careo-fragata-343.md](careo-fragata-343.md) §3: las dos mediciones
de #343 sobre t=0x1C (el gate 0x1260 del remolino solo-daño; «cruza agua») eran hechos
del ESTADO, pero la ETIQUETA quedaba sin adjudicar — el testigo lo llamó «ALFOMBRA»
([testigo-remolino-343.md](testigo-remolino-343.md) §2) y el board de la alfombra
escribe 0x14, no 0x1C. Este carril adjudica con TRES instrumentos: censo estático
completo de escritores, derivación del kernel de pasabilidad, y re-medición en vivo.

**Veredicto: t=0x1C = A PIE (visible), exactamente como lo llama el port (`TILE_FOOT`,
transport.ts:33). No existe ningún estado «alfombra volando»=0x1C: la alfombra montada
es 0x14/0x15 SIEMPRE (aparcada en el suelo es el OBJETO 0x1B, no un valor de
g_transport_tile), y su privilegio de cruzar agua es de CLASE en el kernel, no de un
tile distinto. La frase del testigo §2 era una inferencia falsa de su corrida 2
(re-adjudicada en §3). Cero código: el port ya etiqueta y modela bien.**

## 1. Censo COMPLETO de escritores de g_transport_tile (DS:0x587C)

36 sitios de escritura en los 28 `.asm` (grep del label `g_transport_tile`; 0
referencias crudas a `0x587c` sin label — el censo es la población entera).

### Los CUATRO escritores de 0x1C — todos «a pie»

| sitio | contexto (verificado instrucción a instrucción) |
|---|---|
| CMDS 0x0F43 | `cmd_xit`, convergencia de TRES ramas de desmontar: alfombra (0x0EF5 clase 0x14 → 0x0F20, dropTile 0x1B en 0x0F3F), caballo (0x0EF0 clase 0x10 → 0x0F60 → `sub al,2` 0x0F6A → cae en 0x0F43) y esquife (0x0F0C clase 0x28 → 0x0F72 → 0x0F90 → 0x0F6C → 0x0F43) |
| CMDS 0x0FB0 | `cmd_xit`, fragata fondeada (clase 0x24, 0x0F9C) con tierra ortogonal (`call 0x73E` 0x0FA3): salir A PIE dejando el barco (sin tierra: a esquife `add 4` 0x0FC7, o a alfombra 0x14 consumiendo una del inventario 0x0FE7) |
| BLCKTHRN 0x064A | secuencia de captura de Blackthorn: party forzada a pie |
| BLCKTHRN 0x0C13 | expulsión: location=0x11, floor=1, xy=(10,10), karma clamp 0x4B — y a pie |

(Y BLCKTHRN 0x0933 escribe **0x1E** — otra variante de la MISMA clase 7 a-pie,
como el 0x1D invisible del port.)

### Los que NO pueden producir 0x1C (el complemento, adjudicado uno a uno)

- **board** (CMDS `cmd_board`): caballo `al=tile+2` → 0x12/0x13 (0x0873-0x0875);
  **alfombra objeto 0x1B → t=0x14** (0x087C-0x0890, la cita de transport.ts:682);
  esquife `al=tile` sin +2 (0x08B2→0x0875); fragata → clase 0x20/0x24.
- **use-carpet** (CAST 0x1884-0x18A1): gate `cmp [t],0x1c` — SOLO a pie puede
  desplegarla — y escribe `0x14 + rand(0,1)` (0x189C-0x189E) decrementando
  `g_carpets`. Segunda confirmación independiente de que la alfombra MONTADA es 0x14/0x15.
- **transport_face** (MAINOUT 0x0117/0x0124 caballo, 0x013D/0x014A alfombra
  0x14/0x15, 0x0165/0x017E genéricos; TOWN 0x05AF-0x05F9): toggles de facing DENTRO
  de la clase — la alfombra al virar sigue en 0x14/0x15.
- **izar/arriar y naufragio**: `add/sub 4` de clase barco (MAINOUT 0x02EC, CMDS
  0x0FC7/0x1443/0x1451); hundimiento (MAINOUT 0x10E9-0x1120): a esquife
  `0x28+(t&3)`, a alfombra `0x14+rand`, o t=0 (náufrago) — nunca 0x1C.
- **transitorios guarda/restaura** (el valor escrito NO es un estado): remolino
  MAINOUT 0x128E escribe 0xEC para pintar la succión y 0x12AC restaura; moongate
  ULTIMA.EXE 0x48F0 (0x16)/0x4901 (0) y 0x497D restaura; TOWN 0x0F86 (0)→0x0F93;
  OUTSUBS 0x049D (0)→0x04FD.

⇒ **0x1C solo nace de DESMONTAR (X-it) o de las escenas forzadas de Blackthorn.**
No hay ningún escritor que lleve la alfombra (ni ningún transporte) a 0x1C.

## 2. El kernel de pasabilidad: por qué la alfombra vuela CON 0x14 y 0x1C no vuela

La decisión de paso del sobremundo (try_move MAINOUT 0x01FE, sin objeto delante) es
`call 0xAA7C(g_transport_tile, terreno_compuesto)` (0x02A1-0x02A8) — que resuelve al
**kernel ULTIMA.EXE 0x2C4C** (`verify_cites.resolve`: base near-call MAINOUT 0x81D0 +
0xAA7C ≡ 0x2C4C), la MISMA primitiva que el `0x6CCC` de CMDS (base 0xBF80;
[xit-pila-273.md](xit-pila-273.md) la resolvió primero).

`0x2C4C`: `clase = [DS:0x54F4 + t>>2]` (tabla DATA.OVL fileoff 0x5504, dumpeada aquí
en crudo: `00 00 00 00 03 02 00 00 06 06 05 06 …`) y despacha por la jump table
CS:0x2D60:

- **idx 7 (t=0x1C-0x1F) → clase 0** → handler 0x2C6A = bitmap puro `0x2BD4`
  (DS:0x54D4, DATA.OVL 0x54E4): agua profunda tile 1 → byte0=`0x70`, bit `0x40`
  SET = **bloquea**. A pie el agua NO se pisa (igual que 2 y 3; la playa 0x30-0x37,
  byte 6=0x00, sí).
- **idx 5 (t=0x14-0x17) → clase 2** → handler 0x2C80: pasa si
  `terreno < 4 || (terreno&0xF0)==0x60` (predicado es-agua `0x2C2E`) **o** el bitmap
  lo permite. **El privilegio de volar sobre el agua es de la CLASE de 0x14/0x15** —
  exactamente lo que el port ya modela en `isPassable("carpet")` (movement.ts:110-126,
  derivado en [carpet-b2.md](carpet-b2.md)).

## 3. La frase del testigo §2, refutada — y su corrida 2 re-adjudicada

«t=0x1C es la ALFOMBRA y sobre el agua VUELA» ([testigo-remolino-343.md](testigo-remolino-343.md)
§2, y el comentario de `TILE_FOOT` en `whirlpool_witness_probe.py`) nace de UNA
observación de la corrida 2 (`whirl343-run2.json`, fase B: t←0x1C escrito por el
probe, slot1 borrado, RIGHT — y el estado salió x=9). Contra ella:

1. **El propio testigo la contradice**: sus corridas 1 y 3 midieron la fase B a pie
   BLOQUEADA por terreno (roca del Underworld, x inmóvil, BP 0x0322 disparado), y su
   §1 declara «el agua bloquea y a pie se cae por `jb 0x322` al Blocked!».
2. **El kernel la refuta** (§2 de esta acta): clase 7 → bitmap → agua bloqueada.
3. **La réplica en vivo la refuta** (sonda de este carril, `etiqueta_0x1c_probe.py`,
   corrida 20-08 15:02-15:36 sobre el mismo oráculo dosbox-x 2026.07.02, mismo
   escenario que la corrida 2: party en (8,8) agua profunda, t=0x1C fabricado,
   0 actores, RIGHT ×3 — JSON `etiqueta-0x1c-live.json`, log en el carril):
   - **F1**: los TRES beats con `printpath` (BP 0x0322, el camino Blocked!+beep
     — el MISMO BP del testigo) disparado y party INMÓVIL en (8,8), t=0x1C
     intacto. A pie el agua profunda bloquea, medido con el instrumento de #343.
   - **F2**: tablas VIVAS en overworld = canónico DATA.OVL byte a byte:
     class-table `[7]=0` (t=0x1C → clase 0, bitmap puro), `[5]=2` (alfombra),
     bitmap byte0=`0x70` (agua 1/2/3 bloqueada). El dump completo viaja en el JSON.
   - **F3 (control positivo)**: t=0x14 en el MISMO tile: cruza (8,8)→(9,8)→(10,8)
     sobre agua profunda SIN `printpath`, y `g_transport_tile` permanece **0x14 en
     los dos beats** — la alfombra vuela sin cambiar de tile; no aparece ningún
     0x1C «en vuelo».
   Veredicto de la sonda: `f1_pie_cruza_agua=False · f2_class7_es_0=True ·
   f2_bitmap_agua_bloquea=True · f3_alfombra_cruza=True ·
   f3_transport_en_vuelo=[0x14]`.
4. La corrida 2 además corrió con la versión PRE-commit del probe (la primera
   versión committeada, 9e84c8f1, ya lleva el comentario «medido corrida 2» y el
   re-sembrado del remolino que la corrida 2 no tenía): el estado x=9 de su fase B
   no es reproducible ni auditable. Hipótesis (marcada como tal): escritura del
   propio probe de esa corrida, no un paso del binario.

## 4. Qué cambia (y qué NO) en el port y en las actas

- **Port: NADA.** `TILE_FOOT=0x1C` (transport.ts) es la etiqueta correcta; el gate
  del remolino ya está comentado como «party a pie» (game.ts, careo-fragata) y su
  compare exacto `=== 0x1C` calca el binario — con la consecuencia, también calcada,
  de que 0x1D/0x1E (a pie invisible/Blackthorn) toman la vía COMPLETA de succión en
  ambos lados. `isPassable("foot")=info.walkable` bloquea el agua = kernel clase 0.
- **La semántica del gate 0x1260 queda re-leída**: no es «volando no te traga», es
  «A PIE no te traga» — la guardia del binario para la party en la orilla junto a un
  remolino encallado (la misma situación que el fix de careo-fragata §2 le quitó al
  port). La conducta portada era correcta bajo cualquier lectura; la LECTURA queda
  ahora fijada.
- **Tachado-documentado** (precedente #215): la frase del §2 del testigo y el
  comentario `TILE_FOOT` del probe, corregidos en este mismo commit con puntero aquí.

## 5. Guardas

Sin guarda nueva: la conducta ya está clavada por `remolino-gate-1260.test.ts`
(t==0x1C exacto, mutante `&0xFE` muerto) y `los-passability-audit.test.ts` (bitmap
a pie). Esta acta es adjudicación de ETIQUETA; la sonda viaja en
`re/tools/etiqueta_0x1c_probe.py` (auditable y re-corrible — la lección del §3.4:
una medición cuyo instrumento no se committeó no se puede re-adjudicar).
