# Entrada del nombre de hechizo — TECLEADA por iniciales rúnicas (Cast/Mix)

Reporte del usuario (testigo del original): al hacer **(C)ast** el port "siempre
muestra IN LOR y no me deja poner el que yo quiera (iniciales con palabras en
idioma rúnico)". Causa: el commit 9c6842f (tanda 2 de #21) implementó Cast/Mix con
un **scroller de flechas** común. El original **no scrollea**: el jugador **teclea
la inicial de cada sílaba** y el motor **ecoa la palabra rúnica completa en
MAYÚSCULAS**. Esta nota deriva la rutina real y documenta el fix (#26).

## 1. Resolución del thunk — `call 0xffffc10e`

`CAST.OVL:0x0de9 = e8 22 b3` = `call rel16` (rel16 `0xb322`). IP siguiente `0x0dec`
⇒ **raw target `(0x0dec + 0xb322) & 0xffff = 0xc10e`** (lo que el desensamblador
etiqueta `0xffffc10e`). Base de carga de **CAST.OVL = 0xBF80** (`load_seg 0x0BF8`,
`magic.md:4`; CMDS comparte esa ranura, `transport.md:5`). Imagen en el CS único de
64 K compartido kernel+overlays (`intro-demo-scene.md §0`):

```
CS_target = (raw + base) & 0xffff = (0xc10e + 0xBF80) & 0xffff = 0x808E
```

`0x808E` cae EXACTO sobre el `9a` de un stub de la **tabla de thunks de overlay
PLINK86** (imagen ULTIMA.EXE). Bytes del stub `0x808E`:

```
808e: 9a ec 02 2e 07   lcall 0x072e:0x02ec      ; DISPATCHER de overlays
8093: 12 00            (selector word = 0x0012)  ; overlay #18
8095: ea be e2 00 00   ljmp 0:0xe2be             ; rutina ya paginada
```

`ljmp 0:0xe2be` con **base de carga CAST2.OVL = 0xE1E0** (`load_seg 0x0E1E`,
`magic.md:5`) ⇒ fileoff **`0xe2be − 0xe1e0 = 0x00DE`**. La rutina es
**`CAST2.OVL:0x00DE`** (getstring rúnico).

Método verificado en el mismo barrido: el stub anterior `0x8076` lleva
`ljmp 0:0xbf80` = CAST.OVL fileoff 0 (base 0xBF80), consistente.

## 2. Modelo de entrada — `CAST2.OVL:0x00DE`

Bucle de lectura (`re/disasm/CAST2.OVL.asm` 0x00de–0x0304). `di` = nº de sílabas
tecleadas; `[bp-2]` = resultado (init `0xffff` = -1); `[bp-0xa]` = flag "done".

- **0x00f0**: `call 0x448c` (cursor/blink) → ax; `push ax; call 0x3e52` (getkey) → al.
- **0x00fa / 0x0101**: si al == `'J'`(0x4a) o `'O'`(0x4f) → **IGNORA** (loop). Son las
  únicas letras SIN runa (puntero NULL en la tabla, §3).
- **0x0108–0x0113**: si `'A' ≤ al ≤ 'Z'` **y** `di < 4`:
  - `[bp+di-0xe] = al` (buffer de iniciales, orden tecleado).
  - `push [al*2 + 0x1b7a]` (puntero a la palabra rúnica) → `call 0x3f8c` (strlen);
    si cursor+len > 13 imprime `\n` (wrap a 13 columnas).
  - `[bp+di-6] = ` columna de inicio (para borrar en backspace).
  - `call 0x3670` **imprime la palabra rúnica** (eco), luego `call 0x34da` con `0x20`
    (espacio). `inc di`.
- **Teclas de control** (0x0158): `0x08` Backspace (0x0174: si di>0, dec di + borra la
  última sílaba visualmente), `0x0d` Enter / `0x20` Space (0x01da: done=1),
  `0x1b` ESC (0x01d8: **di:=0** + done=1). Resto: ignoradas.
- **Fin** (0x01e2): **ordena** las iniciales ascendente (0x01e5–0x022d) y las compara
  contra la tabla de hechizos **DS:0x1c30** (48 punteros a strings de iniciales
  PRE-ORDENADAS). ⇒ **emparejamiento INDEPENDIENTE DEL ORDEN** ("IL" y "LI" → In Lor).
  - `[bp-8] == 0` (nada tecleado / ESC) → `[bp-2] = -1`, **return -1**.
  - hay match → `[bp-2] = índice` (0..47), **return índice**.
  - tecleado pero sin match → `[bp-2] = -2` (0xfffe), **return -2**.

## 3. Tabla de runas por inicial — DS:0x1b7a

Extraída de `DATA.OVL` (`fileoff = DS + 0x10`), indexada por ASCII·2. En MAYÚSCULAS:

```
A AN  B BET  C CORP  D DES  E EX  F FLAM  G GRAV  H HUR  I IN  (J —)
K KAL  L LOR  M MANI  N NOX  (O —)  P POR  Q QUAS  R REL  S SANCT
T TYM  U UUS  V VAS  W WIS  X XEN  Y YLEM  Z ZU
```

**J y O tienen puntero NULL** → de ahí los rechazos explícitos en 0x00fa/0x0101.

## 4. Tabla de hechizos — DS:0x1c30 (48 entradas, iniciales ordenadas)

`idx0 IL · 1 GP · 2 AZ · 3 AN · 4 M · 5 AY · 6 AS · 7 ACX · 8 HR · 9 IW · 10 KX ·
11 IMX · 12 LV · 13 FV · 14 FGI · 15 GIN · 16 GIZ · 17 IP · 18 AG · 19 IS · 20 GIS ·
21 PU · 22 DP · 23 QW · 24 BIX · 25 AEP · 26 EIP · 27 MV · 28 IZ · 29 RT · 30 IPVY ·
31 AQW · 32 AI · 33 AWY · 34 AEX · 35 BRX · 36 LS · 37 CX · 38 IQX · 39 IQW · 40 HIN ·
41 CIQ · 42 CIM · 43 CKX · 44 CGIV · 45 FHI · 46 PRV · 47 AT`

Coincide 1:1 con `SPELL_WORDS_ORDER` del port (`spells.ts:63`): idx0 In_Lor→IL,
idx7 An_Xen_Corp→ACX, idx30 In_Vas_Por_Ylem→IPVY, etc. **Nox (índice 48) NO está
en la tabla** ⇒ incastable (retorno -2). Coste de círculo del dispatcher =
`idx/6 + 1` (`CAST.OVL:0x0e0a`, `magic.md §0`).

## 5. Retornos y strings (DATA.OVL, `fileoff = DS + 0x10`)

| ret | quién | Cast (0x0de9→) | Mix (0x1b0d→) |
|-----|-------|----------------|----------------|
| **-1** | nada tecleado / ESC | `0x4611` = **"None!\n"** | `0x8fbe` = **"\nNone!\n"** |
| **-2** | tecleado sin match | `0x4618` = **"No effect!\n"** | (⚠ ver abajo) |
| 0..47 | hechizo | sigue: gate ubicación → `None mixed!` (`0x463a`) → maná | mixSpell |

Prompt Cast = `0x4603` **"Spell name:\n:"**. Prompt Mix = `0x8fac`
**"For what spell?\n:"**.

⚠ **Mix sólo comprueba `-1`** (0x1b13 `cmp ax,0xffff`); un `-2` cae en el selector de
CANTIDAD con índice negativo (lectura fuera de rango — bug latente del binario nunca
ejercitado con cuidado). El port lo evita: nombre no válido en Mix → "No effect!".

## 6. El string "arrows/RETURN" NO es el selector de hechizo

El scroller mal-aplicado nació de `0x8fc6` = **" to move,\nRETURN selects.\nType M
to mix:"**. Ese string pertenece al **selector de CANTIDAD de Mix** (arranca en
`CMDS.OVL:0x1b1e`, tras validar el nombre TECLEADO, imprimiendo primero las glifos de
flecha `0xa/0x1b/0x2c/0x1a/0x18/0x19`). No tiene nada que ver con elegir el hechizo.
En el port la cantidad de Mix sigue fija en 1 (simplificación previa, sin RNG); el
selector de flechas de cantidad queda como mejora futura.

## 7. Mix usa la MISMA rutina que Cast

`CMDS.OVL:0x1b0d = e8 fe a5` = `call rel16 0xa5fe`; IP sig. `0x1b10` ⇒ raw
`(0x1b10 + 0xa5fe) & 0xffff = 0xc10e`. Base CMDS = 0xBF80 (= CAST) ⇒ CS `0x808E`,
**el mismo thunk** → CAST2 0x00de. ⇒ Cast **y** Mix son entrada tecleada; el scroller
estaba mal en ambos. **Ready** (`ZSTATS:0x1296`) usa otra rutina (`0x5a4`,
find-next-owned-item sobre la tabla de equipo 0x57c0) — NO rúnica; su scroller se
mantiene.

## 8. Fix en el port

- `game/src/core/magic/spells.ts`: `RUNE_SYLLABLE_BY_INITIAL` (tabla §3),
  `runeSyllableForInitial()`, `matchSpellByInitials()` (matcher order-independent §2/§4).
- `game/src/main.ts`: nuevo `pendingPrompt` tipo `"rune"` + handler (Enter/Space envía,
  Backspace borra sílaba, ESC vacía+envía, letras A-Z con runa hasta 4). Helper
  `pickSpellTyped`. `doCast`/`doMix` teclean (sin pre-filtro por mezclados; el gate
  "None mixed!" lo aplica `castSpell`). RNG intacto: `castSpell`/`mixSpell` se llaman
  en el mismo punto (al enviar).
- Tests: `game/tests/magic.test.ts` (unit: tabla, matcher, order-independence, vacío,
  no-válido, Nox, round-trip 0..47) + `game/e2e/magic-ready.spec.ts` (typed Mix/Cast +
  discriminante ESC/no-válido/backspace/no-mezclado). Gate: `tsc --noEmit` + `vitest`
  (1585) + e2e magic-ready (4) verdes.

## 9. Prompt del caster-select — ~~"Cast & who?"~~ **"Player: "** (task #72; CORREGIDO 22-08)

Antes del prompt del nombre (§5), el (C)ast fuera de combate elige QUIÉN lanza vía
`CAST:0x0dd5 call 0x8a08` (resultado en `[bp-4]`; si <0 aborta a 0x11d9). El destino
NO es `select_party_member` a pelo: sumando la base de carga de CAST.OVL, `0x8a08 +
0xBF80 = ` **kernel `resolve_command_char` 0x4988** — el MISMO destino que el (S)earch
(`SJOG 0x09a0`). Elige por REALCE de fila del roster (vídeo inverso), SIN banda
">Select:<", y el prompt que imprime es **"Player: "**.

### Lo que decía esta sección y era FALSO

> ~~El original imprime **"Cast & who?"**. El glifo entre "Cast" y "who?" es el
> AMPERSAND (ASCII 0x26). Verificado pixel-a-pixel contra
> `av-referencia/command-prompts/ORIG_cast_yell_log.png`. La cadena NO existe como
> literal contiguo en DATA.OVL/OVLs (grep de `who?` = 0 hits) ⇒ el prompt lo emite el
> select-routine carácter a carácter, por eso no aparece en el volcado de strings.~~

La última frase era una **racionalización del dato que refutaba la tesis**: el 0 de hits
de `who?` no se explicaba, se salvaba. Leída la rutina entera, la única vía que pregunta
(`ULTIMA.EXE.asm` 0x4a00-0x4a57) **no emite nada carácter a carácter**; tiene tres
`call 0x1850` (print_string) y ninguno compone texto:

```
4a00: 2bff              sub di, di
4a02: b8c4a3            mov ax, 0xa3c4      ; DS 0xa3c4 = "Player: "   ← EL prompt
4a05: 50                push ax
4a06: e847ce            call 0x1850
4a09: e882e4            call 0x2e8e         ; → select_party_member 0x2d7a (arg 0)
...
4a36: 05a855            add ax, 0x55a8      ; roster[si].name → MISMA fila: «Player: Min»
4a39: 50                push ax
4a3a: e813ce            call 0x1850
4a4e: b8cea3            mov ax, 0xa3ce      ; DS 0xa3ce = "Disabled!\n\n" → re-pregunta
4a5f: 837ef8ff          cmp word ptr [bp - 8], -1
4a65: b8daa3            mov ax, 0xa3da      ; DS 0xa3da = "None!\n"    ← cancelar/0 elegibles
```

Volcado de `original/u5/play/DATA.OVL` con `fileoff = DS + 0x10`: `0xa3c4` →
`b'Player: \x00'` · `0xa3ce` → `b'Disabled!\n\n\x00'` · `0xa3da` → `b'None!\n\x00'`.

**Medida independiente que lo adjudica** (corpus OCR de 49 rutas de LPs del original,
`game/e2e/espejo-tour/routes/` + `routes-ad/`): **70** líneas de la forma
«Cast... Player: \<nombre\> Spell name:» —repartidas en 12 partes y varios jugadores—,
más dos «Cast... Player: None!» (part09-g11 ocrLn 1210, part13-g03 ocrLn 298) que sólo
puede emitir la vía de cancelación de 0x4a65. Frente a **0** líneas con «Cast & who?».
Control positivo del censo: 622 líneas del corpus contienen "who", y todas son
«On who: », «Who will stand guard?» o prosa TLK. El testigo pixel citado arriba
**ya no existe en disco** (censo: `av-referencia/` tiene 6 directorios y ninguno es
`command-prompts`), así que la verificación pixel no es re-comprobable; el corpus sí.

### Port

`ui/pickers.ts`: `pickCaster` **delega** en `pickCommandChar` (un solo cuerpo, como en
el binario hay una sola rutina). Prompt "Player: " + NOMBRE apendado en la misma fila;
cancelar (ESC) imprime "None!" (antes cerraba en silencio, que también era infiel).
El prompt del nombre sigue en "Spell name:" (§5). Los target-selects de curación
(Heal/Cure/Awaken) conservan su título propio "On who: " (CAST2 0x9e), que es otra
rutina y no cambia.

~~Residuos abiertos de 0x4988, comunes a los dos callers y NO cerrados aquí: falta la vía
de combate/mazmorra (`4995 cmp [g_location],0x80`, el lanzador es `g_cmb_actor` y no se
pregunta nunca — ficha de `resolve-command-char-178c-acta.md`); 0 elegibles debería
imprimir "None!" por el mismo epílogo 0x4a5f; y falta el bucle de re-pregunta con
"Disabled!" (0x4a4e).~~

**CERRADOS los tres el 22-08 (carril `cast-completo`), dos con fix y uno con refutación.**

| residuo | veredicto | dónde |
|---|---|---|
| 0 elegibles → `None!` | **CIERTO**, arreglado | `ui/pickers.ts` `pickCommandChar`, rama `eligible.length === 0` |
| bucle `Disabled!` | **CIERTO**, arreglado | `ui/pickers.ts` `pickCommandChar`, `ask()` recursivo |
| vía de `g_cmb_actor` | **REFUTADO** en sus dos mitades | `resolve-command-char-178c-acta.md §6` |

- **0 elegibles.** No es una rama aparte del binario: `[bp-8]` conserva el `0xFFFF` de
  `@0x4990` (el bucle `0x49dc-0x49f2` sólo lo escribe al ver `'G'`/`'P'`), el
  `cmp [bp-6],1` / `jle 0x4a5f` de `@0x49fa-0x49fe` salta la vía que pregunta y el
  **epílogo común** imprime: `@0x4a5f cmp [bp-8],-1` → `@0x4a65 mov ax,0xa3da` →
  `call 0x1850`. DS `0xa3da` = `b'None!\n\x00'`. Es EL MISMO print que la cancelación
  (que llega ahí con `si < 0`), de ahí que compartan cadena; el port cerraba en silencio.
- **`Disabled!`.** El picker del roster (kernel `0x2d7a`) deja elegir a CUALQUIER
  miembro; el filtro está DESPUÉS, en el llamador, y **no aborta**: `@0x4a1e`/`@0x4a29`
  comparan `[si·0x20 + 0x55b3]` contra `'G'` (0x47) y `'P'` (0x50), y el `jne 0x4a4e` de
  `@0x4a2e` imprime DS `0xa3ce` = `b'Disabled!\n\n\x00'` y cae en `@0x4a55 or di,di` /
  `@0x4a57 je 0x4a02` — con `di` todavía a 0 (sólo las SALIDAS lo ponen a 1, `@0x4a12`),
  o sea **reimprime el prompt**. El nombre NO se ecoa en esa vía: el `jne` salta por
  delante del print de `@0x4a30-0x4a3a`.
- **`g_cmb_actor`.** La rama de `@0x4995` existe y es alcanzable, pero **sólo en
  COMBATE** (`COMBAT.OVL:0x08f0` 'C' → `0x095e` → `CAST.OVL:0x0dba` → `0x0dd5` → `0x4988`
  con `g_location`=0xFF), y ahí el port ya no pregunta: toma el actor del turno. En
  MAZMORRA `g_location` es `0x21..0x28`, no 0xFF, así que el `jbe` de `@0x499a` toma la
  vía que PREGUNTA — lo que el port ya hacía. Derivación completa y controles en el §6
  del acta.
