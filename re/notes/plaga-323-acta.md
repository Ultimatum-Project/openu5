# #323 — `search_remains_outcome` (SJOG 0x01F2): derivación completa y ALCANZABILIDAD

Alta del carril `plaga-323`, nacida del censo de paridad por escenas (#278). La ficha pedía
cablear la rama de RESTOS del `(S)earch` — «Plague!» y el envenenamiento del buscador —
declarada en el corpus como no cableada.

**VEREDICTO: la rama está DERIVADA ENTERA, y NO SE CABLEA — su disparador es INALCANZABLE
desde el único llamador que existe.** El cadáver sobre el que opera nace en COMBATE y el
pool que lo contiene se RESTAURA EN MASA al salir del combate. No es un hueco del port: es
una rama cuyo sujeto no sobrevive hasta el sitio donde se la interroga.

Complementa (y corrige en un punto) a `search-remains-careo.md`, que derivó el flujo pero no
midió la alcanzabilidad.

---

## 1. Firma, argumentos y resolución de llamadas

`SJOG.OVL 0x01F2-0x02E9`, `ret 4` (2 argumentos). Cuerpo entero leído.

Los cinco `call` se resuelven con `re/tools/dispatch_table.py`, **nunca leyendo la dirección
cruda**: base del overlay = `overlay_near_call_base(SJOG.OVL)` = `0xBF80`.

> **Control positivo de la base**: `0x6112 + 0xBF80 = 0x2092` = `rand_range`, destino
> acreditado de forma independiente. Sin este control la base no está validada y todos los
> demás destinos son plausibles-pero-sin-acreditar.

| local | kernel | rutina |
|---|---|---|
| `0x6112` | `0x2092` | `rand_range` ← control positivo |
| `0x58d0` | `0x1850` | `print_string` |
| `0x62bc` | `0x223c` | `noise_burst` |
| `0x7af4` | `0x3a74` | `set_actor_record` |
| `0x9990` | `0x5910` | `viewport_redraw` |

Argumentos: `[bp+6]` = índice de ACTOR · `[bp+4]` = índice del PERSONAJE que rebusca.

## 2. El convenio de `rand_range`, derivado del cuerpo

El corpus hace circular las dos notaciones —`(min,max)` y `(max,min)`— y leerlas al revés
invierte el resultado. Aquí se deriva del cuerpo, no de la notación:

```
20b0: mov bx, [bp+6]        ; bx = A (el PRIMER push del llamador)
20b3: mov cx, [bp+4]        ; cx = B (el ÚLTIMO push)
20b6: sub cx, bx            ; cx = B − A
20b8: inc cx                ; cx = B − A + 1
20bb: div cx                ; dx = rnd mod cx
20bd: add dx, bx            ; += A
```

⇒ **el PRIMER push es el MIN**; el resultado es inclusivo en ambos extremos.

## 3. El flujo

```
01f6-01fd: rand(0,7)
0200:      or ax,ax / jne   ; !=0 (7/8) -> MACABRA ;  ==0 (1/8) -> 0x028e «SALE ALGO»
```

### 3.1 Rama MACABRA (7/8)

```
0207-0212: seis ceros + [bp+6] -> set_actor_record   ; BORRA el cadáver
0215-021c: rand(0,0x1f)
021f:      cmp ax,0x13 / jne 0x24e                   ; == 19 exacto (1/32) -> PLAGA
```

El borrado está acreditado leyendo `set_actor_record` (`0x3a74`): escribe `[bp+0x10]`→campo
+0, `[bp+0x0e]`→+1, `[bp+0x0c]`→+2, `[bp+0x0a]`→+3, `[bp+8]`→+4, `[bp+6]`→+5. Los seis
pushes del call-site son ceros ⇒ el registro entero del actor queda a cero.

**Plaga (1/32)**:
```
0224: print(DS 0x8606 "Plague!\n")
022b-0237: noise_burst(0x1f4, 0xbb8, 0x28)
023a-0241: [ [bp+4]<<5 + 0x55B3 ] = 0x50 ('P')       ; estado del personaje que rebusca
0246: g_unk_a9fa = 1                                  ; panel de estado sucio
```

**Sin plaga (31/32) — dos tiradas ANIDADAS**:
```
0250: push 0   ; queda VIVO en la pila tras el ret 4 de la primera llamada
0251: push 0   ; MIN de la 1ª
0255: push 3   ; MAX de la 1ª
0256: call rand_range   ; r1 = rand(0,3);  ret 4 consume (0,3) y deja el 0 de 0x0250
0259: push ax  ; r1
025a: call rand_range   ; r2 = rand(0, r1)  ← reusa el 0 sobrante como MIN
```
`r2` → `0` "nothing!" (0x8610) · `1` "worms!" (0x861A) · `2` "guts!" (0x8622) ·
`3` "a bloody pulp!" (0x862A).

Sesgo derivado: `P(r2=k) = ¼·Σ_{r1≥k} 1/(r1+1)` ⇒ **25/48 · 13/48 · 7/48 · 3/48**
(≈ 52,1 % · 27,1 % · 14,6 % · 6,3 %), suma 48/48.

### 3.2 Rama «SALE ALGO» (1/8)

```
028e: rand(0,3)
0298: ==0 -> DS 0x863A "food!\n", kind := 0x0F   (¼)
      !=0 -> DS 0x8642 "gold!\n", kind := 0x02   (¾)
02be: [si + 0x5C5B] = kind      ; si = [bp+6] << 3
02c2: [si + 0x5C5A] = kind      ; el kind va a los campos +0 y +1
02c6-02ce: rand(1,3)
02d8: [bx + 0x5C5F] = cantidad  ; campo +5
02dc: g_unk_24e6 |= 2
02e1: viewport_redraw
```

No crea objeto nuevo: **CONVIERTE el cadáver** reescribiendo su propio registro de actor.

### 3.3 Consumo de RNG

| camino | probabilidad | tiradas |
|---|---|---|
| macabra + plaga | 7/8 · 1/32 | 2 |
| macabra sin plaga | 7/8 · 31/32 | 4 |
| sale algo | 1/8 | 2 |

## 4. Quién se envenena — NO es «el personaje activo»

`[bp+4]` viene del call-site `0x0a60: push [bp-0xc]`, y `[bp-0xc]` lo produce
`0x09a0: call → kernel 0x4988`, fila que en el censo está **sin nombre**. Su cuerpo la
identifica como el selector del miembro que EJECUTA la acción:

- `g_location > 0x80` ⇒ toma el actor de combate (`g_cmb_actor`, tabla `[bx-0x45e9]`).
- `g_active_char != 0xFF` ⇒ ese personaje (modo de un solo personaje).
- si no ⇒ barre el roster (`0x55B3 + i·32`) contando los de estado `'G'` (0x47) o `'P'`
  (0x50). Con UNO auto-selecciona; con VARIOS **pregunta** (`DS 0xa3c4 "Player: "`),
  rechaza los no aptos (`0xa3ce "Disabled!\n\n"`) y devuelve −1 con `0xa3da "None!\n"`.

⇒ el envenenado es **el miembro que ejecuta el rebusque, elegido por el jugador cuando hay
más de uno apto**, no el activo por defecto.

> 📛 **PROPUESTA DE NOMBRE, SIN ADJUDICAR — no la copie ningún generador.** Para esa fila
> del kernel se propone el identificador `pick_able_party_member`. **Todavía no es su
> nombre**: la adjudicación de nombres es del lead (lote de renombres), y hasta que la
> firme, el ledger manda. Se deja marcada así a propósito porque `build_name_seeds` siembra
> nombres leyendo la PROSA de `re/notes` por contexto de línea (ficha #186), y un nombre
> suelto junto a su dirección puede PISAR al real sin que nadie lo note.

`[bp+6]` es el índice de ACTOR, acreditado con control independiente: `find_actor_at`
(`0x3702`) escribe el índice encontrado en `g_cmb_scratch_x` (0x5876) antes de retornar
(`0x374c` en el camino de acierto, `0x3767` en el de fallo), y el call-site empuja
justamente `[g_cmb_scratch_x]`.

## 5. El despacho del `(S)earch`: cofre > cadáver > mueble

`SJOG 0x095c` (entry del comando). Tras el gate de mazmorra y el selector de ejecutante,
barre los slots de objeto (`si` de `0x5C62` a `0x5D5A`, paso 8, `cx` = índice desde 1):

- objeto de tipo 1 (cofre) en la casilla ⇒ `0x0a20 call 0x2ea` (chequeo de trampa).
- **barrido AGOTADO** (`si >= 0x5D5A` ⇒ `cx` llega a `0x20`, y `0x0a0e cmp cx,0x20 / jge`)
  ⇒ `0x0a3e`: `find_actor_at(x,y,g_floor)`; si devuelve **`0x1F`** ⇒ imprime
  `DS 0x893e "\nThou dost find\n"` y llama a `0x01f2`.
- si no ⇒ `0x0a6a`, el switch de mueble.

`find_actor_at` devuelve el **byte +0 del slot** (`0x3748: mov al,[si]` con `si` recorriendo
`0x5C5A`+8k). El gate `cmp ax,0x1f` es, por tanto, sobre el tile/tipo del objeto — no sobre
el índice de ranura (que va a `g_cmb_scratch_x`).

## 6. ★ ALCANZABILIDAD — el punto que decide la ficha

### 6.1 Quién ESCRIBE un 0x1F en el pool

Censo de toda escritura de `0x1E`/`0x1F` al campo +0/+1 de `0x5C5A`, sobre los **28** `.asm`,
por dos patrones (inmediato, y registro cargado con el literal en las 12 líneas previas), con
**control positivo** (el patrón ve la escritura conocida de `SJOG 0x02be`). **9 sitios**:

| fichero | dirección | valor | contexto |
|---|---|---|---|
| COMBAT.OVL | `0x15f2-0x15f8` | `0x1E` | tras `[si+0x55B3] = 0x44` ('D') = **PJ muerto** |
| COMBAT.OVL | `0x16d2-0x16d8` | `0x1F` | gate `cmp [bx+3],0x1c` |
| COMBAT.OVL | `0x1774-0x177a` | `0x1F` | |
| ULTIMA.EXE | `0x68ee` | `0x1E` | tras `[si] = 0x53` ('S'), sólo campo +1 |

⇒ **el `0x1F` lo escribe SÓLO `COMBAT.OVL`**, en el tablero de combate.

### 6.2 Los datos estáticos no lo contienen

Censo de los `.NPC` extraídos (`game/assets/npcs.json`), 327 slots no vacíos:
**tipo 31 = CERO ocurrencias**; tipo 30 = UNA (loc 17, slot 28). El «moldy corpse» no está
sembrado en ningún mapa de interior.

Reproducible (el criterio de «vacío» es el mismo que usa `objectPlacements` del port —
slot 0 fuera, y `type==0` con todas las X e Y a cero — para que el denominador sea el suyo):

```bash
python3 - <<'PY'
import json, collections
d = json.load(open('game/assets/npcs.json'))
c, tot = collections.Counter(), 0
for loc, slots in d.items():
    for s in slots:
        if s['slot'] == 0:
            continue
        if s['type'] == 0 and all(v == 0 for v in s['x']) and all(v == 0 for v in s['y']):
            continue
        tot += 1
        c[s['type']] += 1
print('slots no vacios:', tot, '| tipo 30:', c[30], '| tipo 31:', c[31])
PY
```

Salida medida: `slots no vacios: 327 | tipo 30: 1 | tipo 31: 0`.

### 6.3 🔴 Y el pool se RESTAURA EN MASA al salir del combate

`SJOG.OVL 0x203e end_combat_cleanup`:

```
2050: [bp-4] = 0x20
2055: di = 0x5c5a          ; DESTINO = pool de objetos del mundo
2058: si = 0xa9fc          ; ORIGEN  = búfer de respaldo
205b-2062: push si/di, ds->es, 4x movsw    ; copia 8 B = un registro entero
2065: di += 8 ; si += 8
206b: cmp si, 0xaafc / jb 0x205b
```

`0xAAFC − 0xA9FC = 0x100` = 256 B = **32 registros × 8 B = la tabla ENTERA**. Todo lo que
COMBAT escribió en `0x5C5A` —los cadáveres incluidos— se sobrescribe con el respaldo.

Después, sobre el ÚNICO slot del enemigo batido (`[bp+4]`): si hubo victoria y
`(byte & 0xFC) == 0x2C` lo convierte (`−8` en +0/+1 ⇒ `0x24` = fragata; `+5 = 0x63`,
`+7 = 2`: el barco pirata capturable); en caso contrario **cero en +0..+4** (retira al
enemigo). En ninguna rama queda un `0x1E`/`0x1F`.

### 6.4 Y el `(S)earch` no corre dentro del combate

- El handler de la tecla `'S'` del dispatcher (`kernel 0x33a8`, cadenas «Search-» /
  «Search...») llama al stub de `SJOG.OVL` cuyo entry es `0x095c`, y `kernel_cmd_dispatch`
  se invoca NEAR sólo desde TOWN / MAINOUT / DUNGEON.
- `COMBAT.OVL` hace **0 llamadas** al stub de `SJOG:0x095c` (stub kernel `0x7e2a`, local
  `0xdb9a` con base COMBAT `0xa290`). Su propia `cmp ax,0x53` (`0x0b10`) salta a `0x09ac`,
  un handler interno de la arena.

### 6.5 Conclusión

Los cadáveres `0x1F` existen **sólo mientras el tablero de combate está montado**, y el
`(S)earch` que los interrogaría **sólo corre fuera de él**, sobre un pool que
`end_combat_cleanup` ya restauró. ⇒ `search_remains_outcome` **no es alcanzable** por esa
vía en el binario de 1988.

> **Alcance de la negativa.** Lo medido son los ESCRITORES del literal y la restauración en
> masa. Queda una puerta sin cerrar: que un `0x1F` entrara al pool desde un **fichero**
> (`.OOL`/`.GAM` cargado) en vez de por escritura de código. Es consistente con lo anterior
> —esos ficheros se vuelcan desde el mismo pool del mundo, que nunca contiene `0x1F`— pero no
> lo he verificado leyendo el cargador. Cualquiera que quiera reabrir #323 debe empezar ahí.

## 7. Careo con el port

| pieza | port |
|---|---|
| rama de restos (`0x1f2`) | **no cableada** — el `(S)earch` (`game.ts`, `worldObjectAt`) sólo tiene el brazo de cofre |
| selector de ejecutante (`0x4988`) | **SÍ existe**: `searcherIdx`, con cita a `SJOG 0x09a0 → kernel 0x4988` |
| rama hermana de trampa (`0x2ea`) | **SÍ cableada**, con prefijo `"\nThou dost find\n"` y `trapCheck` |
| cadáver de PJ en combate (`0x1E`) | **SÍ modelado**: `TILE_CORPSE = 0x1e` en la capa de botín de la arena |
| las 5 cadenas (`Plague!` …) | catalogadas y traducidas en `es.json`, **sin emisor** — coherente con §6 |

**La declaración del port ya es correcta**: el bloque de `game.ts` que documenta el
trap-check re-atribuye explícitamente `0x1f2` a `search_remains_outcome` y su tono a
«Plague!» + estado `'P'`. La corrección que `search-remains-careo.md` §5 reclamaba **ya está
aplicada en el árbol**; esa sección quedó rancia y se marca abajo.

## 8. Qué se hace con la ficha

- **No se cablea.** Un emisor cuyo disparador no existe es exactamente lo que #278 se creó
  para eliminar; añadirlo sería código muerto con apariencia de paridad.
- **No hay ventana de sellos**, porque no se toca el stream. (Si algún día se cableara,
  serían 2-4 tiradas por rebusque: ver §3.3.)
- Las cinco cadenas huérfanas del corpus i18n **se quedan**: son fieles al binario, y su
  ausencia de emisor está ahora explicada, no pendiente.
- Vecinas: **#103** (el port parte en tres el pool que el binario comparte) es la que tocaría
  el mismo `end_combat_cleanup`; **#121** (la arena acepta teclas que el port no) es de la
  familia pero NO es la vía de esta rama — su `'S'` va a otro handler (§6.4).

## 9. Corrección a `search-remains-careo.md`

Su §5 dice que el port declara `0x1f2` como `spawn_trap_effect` con la cadena «A trap!».
**Esa crítica ya fue atendida**: el árbol de hoy lleva la atribución correcta. La sección
sigue siendo válida como historia de por qué se corrigió, pero no como descripción del port.
La §3 («el port NO IMPLEMENTA esta rutina») es correcta y ahora tiene su *por qué*: §6.

## 10. Procedencia

Cuerpos leídos: `SJOG.OVL` `0x01F2-0x02E9`, `0x095C-0x0A70`, `0x203E-0x20D8`;
`ULTIMA.EXE` `0x2092-0x20C5`, `0x3702-0x3772`, `0x3A74-0x3AAB`, `0x4988-0x4A83`;
`COMBAT.OVL` `0x15D8-0x1600`, `0x16B8-0x16E0`, `0x175A-0x1782`.
Cadenas resueltas en `DATA.OVL` (`fileoff = DS + 0x10`), verbatim.
Llamadas cross-overlay por `dispatch_table.py` con control positivo (§1).
Censos sobre el port y sobre los `.asm` con parseo en Python — **no `grep -r`**: los `.asm`
del worktree son symlinks y `-r` los salta en silencio.
