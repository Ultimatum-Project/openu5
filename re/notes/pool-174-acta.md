# ACTA #174 — El pool CLASE-4 adjudicado (citas a destino de salto, rama hermana MUDA)

**Resultado:** las **97 clase-4** del pool estricto están adjudicadas, 97/97, sin cola.
Salen **10 DEFECTOS DEL PORT** con señas exactas, **2 correcciones de cita** y **18 pares que
no son del género**. Ninguno arreglado aquí: la tarjeta pedía adjudicar, no parchear.

La banda PEGAJOSA (~325) **NO se ha tocado**. Es el corte declarado, con su motivo en §6.

---

## 1. El conteo, ANCLADO (y la predicción del relevo, cumplida)

La tarjeta hablaba de «96 clase-4». Medido con el instrumento commiteado:

| árbol | pool estricto | clase-2 | **clase-4** |
|---|---|---|---|
| `7c4aa56c` (este) | 156 | 59 | **97** |

El 96 del encargo **no era un error, era una foto**: el pool incluye las citas ASM de
`game/src`, que crecen cada vez que un carril aterriza comentarios de derivación. Es el
BLANCO MÓVIL que #172 documentó en su rectificación, y esta corrida es su confirmación
independiente: la población subió sola entre el encargo y su ejecución, sin que nadie tocara
el instrumento. Regla vigente: **una cifra de censo sin SHA no es un dato**. El pool se fija
con `python3 re/tools/cita_clase4_efecto.py --json`, que emite el SHA dentro.

## 2. El instrumento: `re/tools/cita_clase4_efecto.py`

**Por qué no vale el partidor de #172.** `cita_hermana_emitida.py` parte el pool clase-2
preguntando «¿la cadena de la rama hermana aparece en `game/src`?». En clase-4 esa pregunta
**no existe**: la hermana no carga puntero ni llama al impresor, así que no hay literal que
grepear. La pregunta pasa de TEXTO a EFECTO, y el efecto no es greppable. El módulo nuevo no
lo finge: no clasifica por presencia/ausencia sino **por forma de flujo**, y deja el careo
semántico a lectura con las dos ramas ya volcadas. Reutiliza
`cita_rama_hermana.load_asm/collect_cites/sweep4` — misma población, misma política estricta.

| forma | n | qué es |
|---|---|---|
| `PREFIJO-efecto` | 21 | la hermana CONVERGE en el offset citado y por el camino hace `call`/escribe. **Perfil exacto de #133** |
| `DIVERGE` | 64 | la hermana termina en `ret`/`jmp` antes de llegar: ramas alternativas de verdad |
| `BACKEDGE` | 11 | el offset citado queda ANTES del salto: cabeza de bucle |
| `PREFIJO-bifurca` | 1 | converge, sin call ni escritura, pero con SALIDA condicional del tramo |
| `PREFIJO-inerte` | **0** | — |

### 2.1 ★ El único bucket auto-adjudicable del instrumento salió VACÍO, y el control estaba VERDE

`PREFIJO-inerte` es el único bucket que se adjudica solo («no hay efecto que modelar»). La
primera versión lo definía como *sin `call` y sin escritura a memoria*, y con esa definición
tenía **un miembro**: `CAST.OVL:0x18dd`, cuya rama hermana es

```
18d6: cmp byte ptr [g_location], 0x7f
18db: jbe 0x1902          ← y en 0x1902: mov ax, 0x4909  (puntero a cadena)
```

Dos instrucciones, cero calls, cero escrituras… y una **salida** a un camino entero. O sea:
el bucket que dice «aquí no hay nada que mirar» contenía una rama alternativa completa.

**Lo aprovechable no es el fallo, es cómo NO se cazó.** El control «PREFIJO-inerte vacío de
call/write» estaba en VERDE, y seguía en verde con el defecto dentro, porque medía justo las
dos cosas que ese caso no tenía. Es el molde del **control degenerado**: verde por mirar la
variable equivocada. Lo cazó la lectura del volcado, no el control. El arreglo (`salidas()`,
saltos condicionales con destino fuera del tramo) entra también AL CONTROL, y el efecto
colateral es el resultado honesto de arriba: **con la definición correcta, el bucket
auto-adjudicable del instrumento tiene CERO miembros — las 97 hubo que leerlas.**

### 2.2 Controles que SÍ corren, y el que no existe

`cita_clase4_efecto.py` corre tres controles de coherencia con el extractor compartido
(partición clase-2+clase-4 == sweep4 · ninguna rama de clase-4 marcada como emisora por
sweep4 · `PREFIJO-inerte` vacío de call/write/salida). Los tres, verdes.

**No hay control POSITIVO de defecto para clase-4, y se dice en vez de pasar por control uno
que no lo es.** Los casos del género ya arreglados en main —#133 `odd key`, #140 HMS Cape—
son todos CLASE-2 (su hermana emite cadena), así que no caen en esta población y no pueden
validar este criterio por el lado del acierto. El relevo proponía como control el
`SJOG 0x158e` de #133, que también es clase-2 y además vive sólo en la banda pegajosa. Queda
declarado como límite.

## 3. El trinquete: `re/tools/verify_pool174_claims.py`

Las 97 se repartieron entre varios lectores. **Un informe de lectura es testimonio, no
evidencia**: si el acta publica «el binario hace X en OVERLAY:0xNNNN» y nadie vuelve al
`.asm`, el acta hereda el error de quien leyó. Este gate re-comprueba mecánicamente las **56
citas ASM** de las que cuelgan los veredictos de §4: que la instrucción citada esté
LITERALMENTE en el offset citado del overlay citado.

```
56/56 verdes · control negativo (cita falsa deliberada) → rojo, OK
```

Lo que verifica: que la cita no está inventada. Lo que **no** verifica, dicho para que nadie
lo lea de más: la SEMÁNTICA («esto es el tope de alfombras») y la AUSENCIA en el port. Verde
aquí no es «el veredicto es correcto». Las ausencias van con su propio barrido, en §4.

## 4. LA ADJUDICACIÓN — las 97

| veredicto | n |
|---|---|
| (a) CITA-CORRECTA — el efecto está modelado, o la hermana no tiene efecto observable | **67** |
| (b) CITA-A-MEDIA-RAMA — se corrige el COMENTARIO, con la cita derivada | **2** |
| (c) **DEFECTO DEL PORT** | **10** |
| (d) NO-APLICA — la cita ancla un VALOR/tabla, o un rango que abarca las dos ramas | **18** |

### 4.1 Los 10 defectos (tarjeta cada uno; NINGUNO arreglado aquí)

Cada uno lleva binario (offset + instrucción literal, todas en el trinquete de §3) y port
(fichero:línea, con el barrido de ausencia que lo sostiene).

**D2 · `CAST.OVL:0x05f3` — In Por (blink) NO existe en el exterior.**
`05e9: cmp byte ptr [g_location], 0x7f` / `05ee: ja 0x5f3` ⇒ >0x7f = combate (la citada). La
hermana `05f0: jmp 0x680` es el In Por de EXTERIOR, alcanzable (`TIME_PERMITTED_BITS[17]=0x09`
= combate|exterior): getdir, animación, rayo `0704: call 0x8482` con `0709: cmp byte ptr [bx], 5`,
y teleporta — `0715: mov byte ptr [g_party_x], al` / `071a: … [g_party_y], al`.
Port: `cast.ts:152` devuelve `{kind:"blink"}` y el ÚNICO consumidor es `combat.ts:2257`
(`git grep '"blink"'` → 3 hits: unión de tipo, return y case de combate). Observable: castear
In Por fuera de combate gasta hechizo y maná, no pide dirección y la party no se mueve.

**D3 · `MAINOUT.OVL:0x0c8a` — la LAVA no quema en el exterior.**
`0c7e: cmp word ptr [bp - 0x10], 0x8f` / `0c83: jne 0xc8a`; la hermana `0c85: call 0xfffff98a`
→ `OUTSUBS.OVL:0x05ee: call 0xffffb680` + `05f1: mov ax, 0x3a11`
(DS 0x3a11 = «Burning!») + `05f8: call 0xffff8818` (daño rand(1,8)/miembro vivo).
> ⚠ **CORREGIDO por #179** (`defectos-d3d6d7-acta.md` §2.2): esta seña llamaba a
> `0xffffb680` «tick de viento». Resuelto con el instrumento
> (`overlay_near_call_base('OUTSUBS.OVL') = 0xA290`) da **CS 0x5910 = `viewport_redraw`**
> (`frontier.json`, IDENT, 280 B). Acertaba el EFECTO y erraba el NOMBRE, y el matiz NO es
> cosmético: el viento es su callee `0x2f62` y va **GATEADO** —`5933: cmp [0x5891],0 /
> 5938: je 0x5954`, con `591d` poniendo `[0x5891]=0` bajo Time-stop— mientras que el
> mensaje y el daño quedan FUERA de ese gate. También queda mecánicamente resuelto que
> `0x0c85` no llama a una rutina sino a un **stub**: `dispatch_table.stubs()[0x7b5a] =
> OUTSUBS.OVL entry_file_off 0x5EE`.
Port: `outdoorTurn` (`turn.ts:145-212`) salta del paso 5 (pantano, 0xC64) al 6 (hazard, 0xCD0);
el tramo 0x0C7E no existe. `damageTile` tiene **un solo** productor —`game.ts:1910`— dentro de
`if (!inDungeon)`, que es la rama de PUEBLO. Medido: **101 tiles 0x8F en
`underworld.json` + 16 en `overworld.json`** = 117 casillas pisables donde el original imprime
«Burning!» y daña, y el port no hace nada ⇒ además del daño y el mensaje, **el stream RNG diverge**.

**D4 · `SHOPPES2.OVL:0x01c8` — la ronda de comida de la taberna, en tres capas.**
(i) `01a4: cmp byte ptr [bx], 0x95` / `01b9: mov byte ptr [bx], 0x9a` = la hermana **escribe
terreno** (el plato aparece en la mesa); el port no toca el mapa (`shops.ts:775`).
(ii) El contador de rondas está **gateado al revés en el port**: `014a: cmp word ptr [0xbd1a], 0`
⇒ `01c4: inc word ptr [0xbd20]` sólo corre con `[0xbd1a]==0`, y la ronda de comida entra
dejando ahí el nº de vivos ⇒ en el original **nunca** incrementa; el port sí
(`shop-console.ts:2235`). Observable: 3 rondas arman en falso el aviso de vino
(`020a: cmp word ptr [0xbd20], 3`).

**D5 · `SJOG.OVL:0x0e22` — el (J)immy sobre cofres de la capa de OBJETO está muerto.**
`0dbf: cmp ax, 0x85` / la hermana `0dc4: jmp 0xf2c`, que recorre los 32 slots de objeto y, con cofre,
`0f7e: call 0xbaa` = jimmy de cofre-objeto. «No lock!» (DS 0x8b52) sólo se imprime en `0f16`,
cuando NO hay cofre. Port: `game.ts:3294` imprime «No lock!» para cualquier tile fuera de la
lista, sin mirar la capa de objetos; la lógica existe (`commands.ts:187 case "chestObject"`)
pero **no tiene productor** (`git grep chestObject` → sólo la unión de tipo y el case).

**D6 · `TALK.OVL:0x1166` — el saludo se emite SIEMPRE; el original lo gatea.**
`113e: call 0xd7a` (bitmap npcMet) / `1141: or ax, ax`: con NPC no conocido tira rand(0,1) y
`1158: je 0x117d` = **sin saludo en absoluto**; si no, `115a: mov ax, 0x94ce` («"I am called »)
+ el nombre. Port: `conversation.ts:508-511` hace `beginSpeech/greeting/endSpeech` incondicional;
`npcKnowsAvatar` se usa en :610/:634/:697/:764 pero **no** gatea el saludo. Observable:
presentación por nombre ausente y una tirada rand(0,1) que el port nunca gasta ⇒ deriva.
> ⚠ **CORREGIDO por #180** (`defectos-d3d6d7-acta.md` §3): «el saludo se emite SIEMPRE y el
> original lo gatea» describe mal el defecto. No es un gate sí/no sobre UNA línea: es un
> **SELECTOR de TRES ramas que emiten SECCIONES DISTINTAS del `.TLK`** — conocido → `"` +
> sección **2** (greeting); desconocido+r≠0 → `"I am called ` + sección **0** (name);
> desconocido+r=0 → **ni una línea**. El port emitía la sección 2 también a desconocidos y
> no emitía NUNCA la sección 0 ni la rama muda. Las tres ramas están en el testigo del
> espejo (186 aperturas: 63/51/72). Y falta lo más grave: `1145`+`1149` son
> `srand(rng_seed_from_dos_clock())` — CS 0x2056 es `int 21h AH=2Ch` y CS 0x207e
> SOBRESCRIBE `g_rng_seed` ⇒ no es «una tirada que el port no gasta», es que **el original
> REEMPLAZA la semilla global con el reloj de pared** y la paridad de stream a partir de
> ahí es imposible POR CONSTRUCCIÓN.

**D7 · `TOWN.OVL:0x15c8` — con la party inconsciente el port sigue cerrando el turno.**
`15bf: call 0xffffb82c` (party_conscious_state) / `15c3: jne 0x15c8`; con retorno −1 la hermana
`15c5: jmp 0x1686` **se salta el cierre entero** (advance_clock, reja/puente, peligros,
guard_wander, npc_tick). Port: `game.ts:1907-1930` corre `townTurn` + `afterHousekeeping`
incondicionalmente y sólo DESPUÉS mira el refuge (:1953). Observable en el TPK urbano: un
minuto de más, un refresco horario de más y tiradas de guardia/NPC que el original no hace.
> ⚠ **CORREGIDO por #181** (`defectos-d3d6d7-acta.md` §5): **«−1» NO es «party
> inconsciente»**. Leído entero CS 0x39fc: devuelve **0** en cuanto ve un `'G'`/`'P'`
> (y deja el índice en `g_cmb_scratch_x`), **1** si no hay ninguno pero SÍ hay algún
> `'S'` dormido, y **−1** sólo si no hay ni lo uno ni lo otro. Con la party **ENTERA
> DORMIDA el cierre SÍ CORRE**; −1 es exactamente la condición del refuge. Además el
> alcance del salto son **nueve** elementos, no cinco: faltaban el contador
> `[0x594f]`/`[0x5952]` con su `set_map_tile` CS 0x39cc (0x15f6), la copia de posición a
> `g_char_anim_states+2/3/4` (0x160d) y los toggles de cadencia de montura (0x161f) y
> Quickness (0x1649). Y hay una SEGUNDA guarda sobre la misma rutina en la CABECERA del
> bucle (0x1436-0x1464) que la seña no mencionaba: su rama `ax==1` imprime
> `DS 0x288d = b'Zzzzzz...\n'` y consume el turno **sin leer tecla** — mecánica AUSENTE en
> el port, con tarjeta propia.

**D8 · `COMBAT.OVL:0x029c` — el atacante CHARMED no tiene rama en el port.**
`0271: test byte ptr [bx - 0x45ea], 1` (bit 0 = charmed, lo pone la espada del caos en
`06b2: or byte ptr [bx - 0x45ea], 1`): la hermana fuerza `0281: cmp ax, 1` (**sólo** distancia 1)
y `0286: mov byte ptr [g_cmb_weapon], 0x21`. Port: `enemyAttack` (`combat.ts:3173`) no tiene
rama charmed; para un PJ poseído coincide por accidente, pero un **enemigo** encantado
(`castCharm` :2494, aliados invocados :2567/:2588) conserva su `attackRange` y entra en la vía
a distancia con su gate del 50 %. Observable: dispara a distancia donde el original no ataca,
y consume rands que el binario no tira.

**D9 · `MAINOUT.OVL:0x0816` — el banner de Doom no se suprime.**
`07d8: cmp word ptr [bp - 2], 0x27` (idx Doom); la hermana hace el AND de `g_shadowlord_locs` y
`07f1: cmp ax, 0x80` / `07f4: jae 0x837` **salta el banner entero**. La otra mitad de la hermana
(emboscada) sí está portada. Port: `dungeon-cmds.ts:84` llama `locationNameBanner`
incondicionalmente. Observable: entrar en Doom con los 3 Shadowlords destruidos imprime «DOOM»
en el clon y nada en el original.

**D10 · `TALK.OVL:0x0652` — la limosna al mendigo no da karma.**
`05f7: jg 0x652` (sin oro, la citada). La hermana cobra (`05fc: sub word ptr [g_gold], ax`) y
además: `0619: cmp al, 0x6c` (sprite mendigo) + `0624: mov byte ptr [g_turn_count], 0` +
`0635: call 0x7f70` = karma +1 cap 99, y con el oro a cero `064b: call 0x7f70` = +2 más.
Port: `effects.ts case "gold"` sólo hace `state.gold -= amount`; el único productor de karma en
diálogo son los opcodes 0x89/0x8A (`conversation.ts:678/682`).

**D11 · `MAINOUT.OVL:0x0b0a` — moongate en el filo de medianoche.**
`0b00: call 0xffffc6d8` (kernel_moongate_enter) / `0b05: je 0xb0a`; la hermana
`0b07: call 0xfffff89a` encadena a CAST2 0x0E76, que suspende el mundo
(`0ea4: mov byte ptr [g_location], 0xff`). Port: `game.ts:2443-2448` (`checkMoongate`) hace el
hook + sfx y vuelve.
⚠ **Residuo declarado, NO resuelto:** qué muestra la escena cuando la party no está sobre
casilla de santuario. Se reporta como candidato, no como cerrado.

### 4.2 Las 2 correcciones de cita

**B1 · `EGA.DRV:0x25c8` → la semilla del fizzle está en `0x25af`.**
`endgameDissolve.ts:20` dice *«Semilla del fizzle (fn34 arranca el LFSR en 1 — EGA.DRV
0x25c8)»*. En 0x25c8 hay `xor ah, ah` + programación de puertos EGA (0x3ce/0x3c4). La semilla
es **`25af: mov word ptr cs:[0x2541], 1`**. 0x25c8 es el punto de reunión de la guarda de
rango del píxel (`25bf: cmp dx, si` / `25c1: jge 0x25c8`), y su rama hermana `25c3: call 0x263a`
es el **plot del píxel**. La MECÁNICA del port es correcta (el skip fuera de rango está en
`endgameDissolveOrder`, línea 35, y el paso del LFSR en `25ec` ↔ `fizzleStep`): lo que falla es
sólo el ancla. La otra cita del mismo fichero (`fn34 @0x25f8` = fin de ciclo) **sí** es
correcta: `25f8: cmp word ptr cs:[0x2541], 1`.

**B2 · `TOWN.OVL:0x1671` — FALTA nombrar la hermana, y es la que cierra la derivación.**
`1662: cmp word ptr [bp - 0xa], 2` / la hermana `166e: call 0xfffff8e2` = **NPC.OVL:0x0DB4
`npc_tick_all(hour)`**, que pone a cero el propio flag que la rama citada prueba
(`NPC.OVL 0dc6: mov byte ptr [0x65bf], 0` ↔ `TOWN 1671: cmp byte ptr [0x65bf], 0`). Importa
porque el criterio derivable es «un NPC quedó adyacente EN EL TICK DE ESTE TURNO», no el proxy
del port («hay NPCs en la planta», `game.ts:2043-2047`, ya declarado aproximación en
`loops.md:156`). El efecto del prefijo sí está modelado; falta la cita que cierra el flag.

### 4.3 Un negativo que merece constar

`MAINOUT.OVL:0x1a9f` parecía defecto y **no lo es**. Su hermana es un toggle de cadencia
(`1a98: xor byte ptr [0x2c57], 1` / `1a9d: jne 0x1a74`), y hay otro para Quickness en `1a81`:
montado y Quickness hacen correr el world_turn en fase ALTERNA, lo que contradice el «Consume
SIEMPRE» de `spawn.ts:66` leído fuera de contexto. El port **sí** los modela, en el CALLER
(`game.ts:2110-2122`, `quicknessPhase`/montura), exactamente como declara `turn.ts:110`. La
cita está bien porque su alcance es el bloque 0x1A9F-0x1AB5, no el gate de arriba.
Sirve de recordatorio del listón: el defecto se firma tras buscar el modelo **donde vive**,
no donde está la cita.

## 5. Gates

Corridos desde la RAÍZ del worktree, sin pipes, exit leído por separado — y **re-corridos
después del `git add`** (un gate con `git ls-files` es ciego a lo untracked).

```
python3 re/tools/cita_clase4_efecto.py        EXIT=0   (3 controles de coherencia verdes)
python3 re/tools/verify_pool174_claims.py     EXIT=0   (56/56 + control negativo rojo)
python3 re/tools/cita_hermana_emitida.py      EXIT=0   (#172 intacto)
python3 re/tools/cita_rama_hermana.py --calibrar EXIT=0
python3 re/tools/seed_gate.py                 EXIT=0
python3 -m pytest re/tools/test_frontier.py -q EXIT=0
python3 re/tools/genero.py                    EXIT=0
```

`game/src` **no se ha tocado** en esta rama ⇒ no aplican tsc ni vitest. Los 10 defectos van
como tarjeta, no como parche: era el encargo.

## 6. Lo que queda FUERA, declarado

1. **La banda PEGAJOSA (~325 sólo-pegajosa @ `7c4aa56c`) — CORTE DE ESTA SESIÓN.** No se ha
   tocado ni una. El relevo avisaba de lo que hace falta antes de creerle nada: la política
   pegajosa hereda overlay con ventana de 40 líneas y los docblocks largos re-atribuyen en
   silencio, así que **la atribución hay que revisarla caso a caso ANTES de adjudicar**. Lo
   que sí queda medido para quien la coja: ahí vive `SJOG.OVL:0x158e` (odd key, #133),
   positivo VERDADERO, o sea que la banda **no es ruido**; y la calibración
   (`cita_rama_hermana.py --calibrar`) da hoy `sólo estricta = 0`, es decir, la pegajosa
   **contiene** a la estricta y todo lo suyo es cobertura nueva sin verificar.
2. **Los 10 defectos SIN ARREGLAR**, por encargo. Cada uno con señas suficientes para su
   propia tarjeta; D11 además con residuo declarado (§4.1).
3. **La CONDICIÓN de los 67 (a)**. Igual que en #172 §3.2: «el efecto está modelado» no es
   «está modelado bajo la condición correcta». El contraejemplo vive en #144 (el defecto en la
   envoltura). Verificar condición por condición es criterio distinto y más caro; no se ha hecho.
4. **Criterio (3)** (docblock de early-returns) sigue sin mecanizar, como en #172.
