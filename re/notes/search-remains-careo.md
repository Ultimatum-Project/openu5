# #74 — `search_remains_outcome` (SJOG 0x01F2): flujo derivado y careo con el port

Alta nueva tras el cue de plaga. Parte del careo SJOG-Search (#58), que ya cerró
trampa-XOR / repetibles / remains / moonstones. Aquí va el **flujo completo con cita** y el
**careo contra el port**.

> **AMPLIADA el 15-08 por `plaga-323-acta.md`**: el «no implementa» de abajo es correcto, y
> ahora tiene su *por qué*. La rama **no es alcanzable** en el binario desde el único
> llamador que existe — su cadáver (`0x1F`) lo escribe sólo `COMBAT.OVL`, y
> `end_combat_cleanup` (SJOG 0x203e) restaura los 32 registros del pool en masa al salir del
> combate. No es un hueco del port: es una rama sin disparador. Ahí está también el
> **quién** se envenena (lo elige el jugador vía `kernel 0x4988`, no es «el activo»).

**VEREDICTO DEL CAREO: el port NO IMPLEMENTA esta rutina.** No hay hueco de fidelidad que
adjudicar porque no hay calco — hay una **mecánica ausente**. Y de paso: sus cinco cadenas
están catalogadas en el corpus i18n y **no las emite nadie**.

---

## 1. Firma y argumentos

`SJOG.OVL 0x01F2`, `ret 4` (2 argumentos). Cuerpo entero leído `0x01F2-0x02E9`.

- `[bp+4]` = **jugador activo** (índice de personaje). Sólo se usa para el byte de estado.
- `[bp+6]` = **índice del ACTOR**, no una coordenada — es lo que `find_actor_at`
  (kernel 0x3702) dejó en la palabra `0x5876`; por eso el call-site 0x0A5C empuja
  `[g_cmb_scratch_x]`.

Es lo que ocurre al hacer `(S)earch` sobre un cadáver (kind `0x1F`, «a moldy corpse!»).

## 2. El flujo

```
01f6: rand(0,7)                      ; push 0 (MIN), push 7 (MAX)
0200: or ax,ax / jne                 ; != 0 (7/8) -> RAMA MACABRA
                                     ; == 0 (1/8) -> 0x028e RAMA «SALE ALGO»
```

### 2.1 Rama MACABRA (7/8)

```
0207-0212: seis ceros + [bp+6] -> call 0x7AF4        ; stub (retirada/marcado del actor)
0215-021c: rand(0,0x1f)                              ; 1/32
021f: cmp ax,0x13 / jne 0x24e                        ; == 19 exacto -> PLAGA
```

**Plaga (1/32)**:
```
0224: imprime DS:0x8606 "Plague!\n"
022b-0237: tono(0x1f4, 0xbb8, 0x28)
023a-0241: [ [bp+4]<<5 + 0x55B3 ] = 0x50 ('P')       ; byte de ESTADO del personaje activo
0246: g_unk_a9fa = 1
```
`0x55B3` = base del roster `0x55A8` + 11 ⇒ es el campo *status* del registro de 32 B.
`'P'` = envenenado.

**Si no hay plaga (31/32) — ★ dos tiradas ANIDADAS que el disasm esconde**:
```
0250: push 0        ; queda en la pila
0251: push 0        ; MIN de la 1ª
0255: push 3        ; MAX de la 1ª
0256: call rand     ; ret 4 -> consume (0,3)  => r1 = rand(0,3)
0259: push ax       ; r1
025a: call rand     ; consume (el 0 de 0x0250, r1) => r2 = rand(0, r1)
```
El `ret 4` de `rand_range` deja el `0` de 0x0250 vivo y la segunda llamada lo **reutiliza como
MIN**. Resultado `r2` → `0` `"nothing!\n"` (0x8610) · `1` `"worms!\n"` (0x861A) ·
`2` `"guts!\n"` (0x8622) · `3` `"a bloody pulp!\n"` (0x862A).

**Sesgo derivado**: `P(r2=0) = ¼·(1 + ½ + ⅓ + ¼) = 25/48 ≈ 52,1 %`. Las otras tres reparten
el resto (≈ 27,1 % / 14,6 % / 6,3 %).

### 2.2 Rama «SALE ALGO» (1/8)

```
028e: rand(0,3)
0298: == 0 -> DS:0x863A "food!\n" , kind := 0x0F      (¼)
      != 0 -> DS:0x8642 "gold!\n" , kind := 0x02      (¾)
02be: [si + 0x5C5B] = kind          ; si = [bp+6] << 3  (registro de actor de 8 B)
02c2: [si + 0x5C5A] = kind          ; ★ escribe el kind en los campos +0 y +1
02c6-02ce: rand(1,3)
02d8: [bx + 0x5C5F] = cantidad      ; campo +5 = qty
02dc: g_unk_24e6 |= 2
02e1: call viewport_redraw (kernel 0x5910)
```

★ **No crea un objeto nuevo: CONVIERTE el cadáver** en un recogible reescribiendo su propio
registro de actor. Los kinds `0x0F` y `0x02` son exactamente los que `get_item_switch 0x1458`
trata como comida y oro.

## 3. Careo con el port — **ausente**

| pieza del original | port |
|---|---|
| `searchRemains` / equivalente | **no existe** (búsqueda por nombre en todo `game/src`: 0 resultados) |
| Search sobre cadáver (kinds 30/31) | `game/src/core/world/search.ts` (255 líneas) **no menciona** kind, corpse, body ni remains |
| Rama macabra, tirada anidada y su sesgo | no modelada |
| Plaga 1/32 → status `'P'` | no modelada |
| Conversión cadáver→recogible (campos +0/+1/+5) | no modelada |

Lo único que el port sí tiene es el **nombre** del objeto al mirarlo: `LOOT_OPEN_NAMES`
(`commands.ts`) incluye `30: "a rotting body!"` y `31: "a moldy corpse!"` — la tabla del
dispatcher 0x12A, que es otra cosa (el texto del `(O)pen`), no el rebusque.

### 3.1 ★ Cinco cadenas catalogadas y JAMÁS emitidas

`"Plague!\n"`, `"nothing!\n"`, `"worms!\n"`, `"guts!\n"`, `"a bloody pulp!\n"` existen en
`game/src/i18n/es.json` (líneas 5599-5619) y **en ningún `.ts`**. Único falso positivo
descartado: `nothing!` aparece en `shoppe-greetings.ts` dentro de `«Thanks for nothing!»`,
que es un saludo de tienda y no tiene nada que ver.

Es un caso vivo del género que ya tiene detector (**#47**, «string catalogado pero nunca
emitido») y que **no lo ha marcado**. Dos explicaciones posibles, ninguna comprobada aquí:
las exclusiones por «familia de datos» del detector se las tragan, o no se ha vuelto a correr
desde que se catalogaron. Merece una pasada de quien lleve #47.

## 4. Divergencias declaradas (sin veredicto de fidelidad)

- **D1 — mecánica ausente**: el flujo entero de rebusque en restos no está portado. No es un
  fallo de calco: es un hueco. No propongo implementación aquí.
- **D2 — corpus i18n con cinco entradas huérfanas** (§3.1), que además traduce cadenas que el
  juego nunca puede mostrar.
- **D3 — vía de estado `'P'` por plaga**: el original puede envenenar al personaje activo
  desde un `(S)earch`. El port no tiene esa entrada al estado envenenado.

**Lo que NO afirmo**: que D1 sea prioritario, ni cómo debería portarse. El original está
derivado y citado; la decisión de portarlo (y con qué RNG, dado el idiom anidado) es del
orquestador.

## 5. ★ La declaración del port es INEXACTA (censo de los 3 sitios)

> ⚠ **RANCIA desde el 15-08 — la crítica de esta sección YA FUE ATENDIDA.** El árbol de hoy
> lleva la re-atribución correcta (`0x1f2` = `search_remains_outcome`, su tono acompaña a
> «Plague!» + estado `'P'`) en el bloque de `game.ts` que documenta el trap-check hermano.
> La sección se conserva como historia de por qué se corrigió; **no describe el port actual**.
> Medido por `plaga-323`; ver `plaga-323-acta.md` §7.

El port **sí declara** el flujo como no portado, pero **con el nombre y la causa cambiados**.
Censo (parseo en Python de todo `game/src`; 4 falsos positivos descartados —
`shop-console.ts:1716` y `shoppe-greetings.ts:342/353` hablan del chunk `SHOPPE.DAT` fileoff
`0x1f2b`, y `lordbritish.ts:212` es la palabra inglesa «remains»):

| sitio | lo que declara |
|---|---|
| `core/sfx.ts:126` | `"search-fail" // SOLO spring de trampa del search (SJOG 0x1f2 @0x237) — NB (40,3000,500); SIN emisor hoy (flujo no portado…)` |
| `core/sfx.ts:130` | `// suena en el spring del search (SJOG spawn_trap_effect 0x1f2: «A trap!» …)` |
| `core/game.ts:2255` | `// search SJOG spawn_trap_effect 0x1f2 @0x237, flujo no portado)` |
| `core/game.ts:2292` | `// (spawn_trap_effect 0x1f2, «A trap!», flujo no portado), no a este camino` |

**Adjudicación: «no portado» es CORRECTO — no hay fragmentos. Pero todo lo demás es falso.**

1. **El nombre**: `SJOG 0x1f2` no es `spawn_trap_effect`, es `search_remains_outcome`.
2. **La cadena**: `«A trap!»` **no existe verbatim en `DATA.OVL`** (0 apariciones; sí existe
   en minúscula `a trap!` en DS `0x8676`).
3. **El tono de `@0x237` NO es un spring de trampa: es el CUE DE PLAGA.** Está encajado
   entre `0x0224 print(DS:0x8606 "Plague!")` y `0x0241 status = 'P'`. Los tres números que
   el port anota —NB(40,3000,500)— son exactamente los pushes `0x28, 0xbb8, 0x1f4` de esa
   llamada, así que el port leyó la instrucción correcta y le puso la semántica equivocada.
4. **De dónde salió la trampa**: la familia de cadenas de trampa —`0x864a "no trap!"`,
   `0x8654 "a simple trap!"`, `0x8664 "a complex trap!"`, `0x8676 "a trap!"`— se referencia
   **sólo** desde `SJOG 0x0369-0x039A`, es decir la rutina que empieza en `0x02EA`: **la
   siguiente**, no ésta. Atribución cruzada entre rutinas vecinas.

⇒ El identificador de audio `search-fail` está **mal nombrado**: lo que ese tono acompaña es
la plaga. (La decisión sobre el emisor de audio es del carril que lleva la pieza 6; aquí sólo
se deja el hecho del binario.)

## 6. `g_unk_a9fa` — CONFIRMADO (ya se sabía) y COMPLETADO por el lado consumidor

Censo por **los tres canales** (hex `0xa9fa`, **símbolo** `g_unk_a9fa`, y complemento a dos):
**31 accesos** en 9 ficheros. Reparto:

- **~24 productores** que sólo escriben `1`, repartidos por CAST, CAST2, CMDS, COMBAT,
  DUNGEON, MAINOUT, SJOG y ULTIMA.EXE — todos sitios que cambian el estado del party
  (hechizos, comandos, golpes, y aquí la plaga en `SJOG 0x0246`).
- **exactamente 4 consumidores**, uno por MODO de juego, y los cuatro **byte a byte
  idénticos**:

```
COMBAT  0x06e2 | DUNGEON 0x03de | MAINOUT 0x05a3 | TOWN 0x0dd3
    cmp byte ptr [g_unk_a9fa], 0
    je  <salta>
    call ... ---------------------------> kernel 0x2900   (draw_status_panel)
    mov byte ptr [g_unk_a9fa], 0
```

`DUNGEON 0x03de` es la cabeza de `dng_getkey` (el poller de entrada de mazmorra), y sus tres
hermanos ocupan el mismo lugar en el poller de su modo.

⇒ **`g_unk_a9fa` = «el panel de estado del party está sucio, repíntalo»**: muchos productores
lo levantan, y el bucle de entrada de cada modo lo prueba, repinta y lo limpia.

⚠ **Esto NO es hallazgo nuevo**: `globals.json` ya lo tenía como «flag de redraw del
panel/roster (New Order, Board, etc. lo ponen a 1; Task 3.9)». Mi lectura lo **confirma**.
Lo que aporta este pase es el **lado consumidor**, que la entrada no tenía: los cuatro
test-and-clear y su destino común. La entrada queda **ampliada, no creada**.

> ⚠ Instrumento, tercera vez en dos días: mi primer censo de `g_unk_a9fa` devolvió **CERO**
> teniendo yo la instrucción `0246: mov byte ptr [g_unk_a9fa], 1` delante — busqué el hex y el
> complemento a dos, **pero no el símbolo**. El disasm imprime el nombre, no la dirección. La
> regla «hex **y** símbolo **y** complemento a dos» hay que aplicarla ENTERA cada vez.

## 7. Procedencia

Cuerpo entero de `re/disasm/SJOG.OVL.asm` `0x01F2-0x02E9`. Cadenas resueltas en `DATA.OVL`
(`DS = fileoff − 0x10`), verbatim. Búsquedas sobre el port con parseo en Python (no
`grep -r`: los `.asm` del worktree son symlinks y `-r` los salta en silencio — ver
`globals-desplazamiento-negativo.md`). Convenio `rand_range(min, max)` = el primer push es el
MIN, según la regla del proyecto.
