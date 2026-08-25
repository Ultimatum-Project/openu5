# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 5: seis de la capa `core`

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `f07730f3`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t4-acta.md` §4 (el reparto por capa, con `core` primero).

---

## 0. VEREDICTO

**6 pares · 6 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — con **6 lecturas** (ritmo 1,00, el segundo
cumplimiento consecutivo del estimador).

| par | fichero del port | veredicto |
|---|---|---|
| `MAINOUT.OVL:0x0468` | `world/movement.ts:56` | **(a)** — el «1 o 2» es una CUENTA de llamadas |
| `DNGLOOK.OVL:0x0013` | `dungeon/dungeon.ts:577` | **(a)** — los tres pasos numerados, con sus tres offsets |
| `SHOPPES.OVL:0x1596` | `world/cmd-strings.ts:386` | **(a)** — la cadena, el offset y la tecla `'C'` |
| `SHOPPES2.OVL:0x0194` | `shops/shops.ts:825` | **(a)** — norte y sur se distinguen por UN opcode |
| `TOWN.OVL:0x0204` | `world/townHourTiles.ts:19` | **(a)** — el rango de la FASE 2, sus dos extremos |
| `ZSTATS.OVL:0x1230` | `itemPageController.ts:8` | **(a)** — el fork por MODO en la tecla ENTER |

## 1. RE-ANCLA: quinta medida, quinta vez idéntica

```
main = f07730f3
git diff 258f6fcb..main -- game/src            → VACÍO
cita_pegajosa_atribucion.py → 345 pares @ 17316d2a, 3 controles verdes
```

Cola al empezar: **16 vivos**. La celda no se ha movido en las cinco sub-tandas del carril.

## 2. Las seis lecturas

### 2.1 `MAINOUT.OVL:0x0468` — «1 o 2 turnos extra» es una CUENTA, no un dato copiado

| call-site | instrucción | destino | rama |
|---|---|---|---|
| `MAINOUT.OVL:0x0427`, | `cmp ax, 2` / `je 0x468` | `0x0468` | clase 2 |
| `MAINOUT.OVL:0x0448`, | `call 0x1a60` / `add word ptr [bp - 2], ax` / `call 0x7a` | — | clase 1: **una** vez |
| `MAINOUT.OVL:0x0468`, | `call 0x1a60` / `add word ptr [bp - 2], ax` / `call 0x7a` | — | clase 2: primera vuelta |
| `MAINOUT.OVL:0x0471`, | `call 0x1a60` / `add word ptr [bp - 2], ax` / `call 0x7a` | — | clase 2: **segunda** vuelta |
| `MAINOUT.OVL:0x0487`, | `mov ax, 4` / `jmp 0x461` | `0x0461` | y de ahí al reloj |
| `MAINOUT.OVL:0x0461`, | `push ax` / `call 0xffffcdac` | — | `advance_clock`, DESPUÉS |

★ El *«1 (clase 1) o 2 (clase 2)»* de la cita **se obtiene contando las `call 0x1a60` de cada
brazo**: una en el de `0x0448`, dos en el de `0x0468`-`0x0477`. Y el *«ANTES del advance_clock
extra»* es topológico: los dos brazos entran al reloj por `0x0461`, después de sus vueltas. Y el
rango que la cita declara —`0x0468-0x0477`— termina en el segundo `call 0x7a` ⇒ **los dos extremos,
exactos**. **(a) exacta.**

⚠ Anotado sin adjudicar: el argumento del reloj también difiere (2 en clase 1, 4 en clase 2, por el
`mov ax, 4` de `0x0487`), y los mensajes son cadenas distintas (`0x29bf` frente a `0x29cf`). La cita
habla de los turnos de mundo, no del reloj; queda escrito porque es el mismo fork.

### 2.2 `DNGLOOK.OVL:0x0013` — los tres pasos numerados, uno por offset

| call-site | instrucción | destino | paso de la cita |
|---|---|---|---|
| `DNGLOOK.OVL:0x0007`, | `call 0xffffa6f8` | — | 1. selector de miembro ✓ |
| `DNGLOOK.OVL:0x000d`, | `inc ax` / `jne 0x13` | `0x0010` si falla | 1. el `ret -1` ⇒ aborta ✓ |
| `DNGLOOK.OVL:0x0013`, | `cmp byte ptr [g_torch_mins], 0` / `jne 0x28` | `0x0028` | 2. gate de luz ✓ |
| `DNGLOOK.OVL:0x001a`, | `cmp byte ptr [g_light_spell_mins], 0` / `jne 0x28` | `0x0028` | 2. la SEGUNDA fuente ✓ |
| `DNGLOOK.OVL:0x0021`, | `mov ax, 0x752e` / `jmp 0xdf` | `0x00df` | 2. imprime la oscuridad ✓ |
| `DNGLOOK.OVL:0x0028`, | `mov al, byte ptr [g_dng_facing]` / `push ax` / `call 0xffffdcae` | — | 3. el prompt de dirección ✓ |

★ Tres detalles que la cita afirma y que salen del código, no de la confianza:
- *«ret -1 → ABORTA»* está escrito como `inc ax` / `jne`, que es el modismo del compilador para
  «¿valía −1?» — la cita traduce el modismo bien.
- *«a oscuras … NO pregunta dirección»* es **topológico**: la rama de `0x0021`, con su `jmp`, va a `0x00df` y
  **nunca alcanza** el `0x0028` del prompt.
- *«ANTES del Dir-»* también: `0x0013 < 0x0028`, y las dos guardas de luz saltan hacia delante.

⚠ La cita dice «a oscuras» y el binario mira **dos** fuentes (antorcha y hechizo de luz). Es una
compresión correcta, no una omisión: las dos guardas tienen el mismo destino. **(a) exacta.**

### 2.3 `SHOPPES.OVL:0x1596` — cadena, offset y TECLA, los tres literales

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES.OVL:0x157f`, | `cmp ax, 0x43` / `je 0x1596` | `0x1596` | la tecla `0x43` = **'C'** ✓ |
| `SHOPPES.OVL:0x1584`, | `cmp ax, 0x48` | `0x1622` | la hermana `'H'`, de la línea de al lado |
| `SHOPPES.OVL:0x1596`, | `mov ax, 0x8106` / `push ax` / `call 0x75c0` | — | DS `0x8106` ✓ |
| `SHOPPES.OVL:0x159d`, | `call 0x137c` | — | el picker que la cabecera vecina nombra ✓ |

★ La cita es una línea de tabla de cadenas —`healerCuring: "Curing"`, con DS y offset— y **las tres
cosas que afirma se comprueban por separado**: la cadena por el inmediato de `0x1596`, el offset por
sí mismo, y la tecla `'C'` por el `cmp ax, 0x43` que salta ahí. Esa tercera es la que suele quedar
sin verificar en las citas de cadena, y aquí sale exacta.

★ **Corroboración de regalo**: la cabecera del mismo bloque de `cmd-strings.ts` dice
*«SHOPPES 0x14f8 entrada + 0x137c picker + 0x146a pago»*, y el `0x159d` llama literalmente a
`0x137c` ✓ — una segunda afirmación del mismo docblock verificada sin coste. **(a) exacta.**

### 2.4 `SHOPPES2.OVL:0x0194` — norte y sur se distinguen por UN opcode

| call-site | instrucción | mesa |
|---|---|---|
| `SHOPPES2.OVL:0x0166`, | `mov al, byte ptr [g_party_y]` / `dec ax` / `push ax` | NORTE: `y − 1` |
| `SHOPPES2.OVL:0x016b`, | `call 0x6222` | — |
| `SHOPPES2.OVL:0x019a`, | `mov al, byte ptr [g_party_y]` / `inc ax` / `push ax` | SUR: `y + 1` |
| `SHOPPES2.OVL:0x019f`, | `call 0x6222` | — |

★ **Los dos tramos son la MISMA secuencia con un opcode cambiado** (`dec` frente a `inc`), llamando
a la misma rutina de puntero. Y el ORDEN que la cita afirma —*«primero el NORTE y sólo si ahí no
hay mesa el SUR»*— es el del propio FLUJO — `0x0173 jne 0x194`, que lleva al sur cuando el norte no casa.
La `x` no se toca en ninguno de los dos (`g_party_x` va tal cual), que es lo que hace que sean
norte/sur y no este/oeste. **(a) exacta.**

⚠ No leídos: los tiles `0x9b`/`0x9a` que la cita distingue viven en los cuerpos (`0x0173` y
`0x01a7`), fuera de las dos cabeceras cotejadas aquí. Se declara.

### 2.5 `TOWN.OVL:0x0204` — el rango de la FASE 2, con sus dos extremos

| call-site | instrucción | qué es |
|---|---|---|
| `TOWN.OVL:0x01be`, | `sub si, si` / `jmp 0x1d7` | siembra del recorrido = inicio de la fase |
| `TOWN.OVL:0x01c2`, | `mov al, byte ptr [si + 0x58ee]` / `push ax` | primer operando del cuerpo |
| `TOWN.OVL:0x01e1`, | `jae 0x204` — su guarda, el `cmp ax, cx`, está en `0x01df` | salida del recorrido |
| `TOWN.OVL:0x0204`, | `mov word ptr [bp - 2], si` | fin de la fase |
| `TOWN.OVL:0x0207`, | `or byte ptr [g_unk_24e6], 2` / `pop si` / `pop di` | y de ahí al epílogo |

La cita declara *«FASE 2 — PUENTE LEVADIZO (0x01be-0x0204)»* y los dos extremos son exactamente la
siembra del bucle y su punto de salida ⇒ **el rango, exacto**. **(a) exacta.**

⚠ No verificados aquí: el `and 0xfe == 0x48` del casado de tablones y el estampado de `0x03`, que
viven en el cuerpo `0x01c2-0x01dd`. Se adjudica el rango y la estructura del recorrido, no cada
constante del cuerpo.

### 2.6 `ZSTATS.OVL:0x1230` — el fork por MODO, en la tecla ENTER

| call-site | instrucción | destino | rama |
|---|---|---|---|
| `ZSTATS.OVL:0x121c`, | `cmp word ptr [bp + 4], 0x52` / `jne 0x1230` | `0x1230` | modo ≠ `'R'` |
| `ZSTATS.OVL:0x1228`, | `call 0xc5c` / `mov word ptr [bp - 6], ax` | — | `'R'`: equipa **in situ** |
| `ZSTATS.OVL:0x1230`, | `mov word ptr [bp - 6], 1` / `jmp 0x1282` | `0x1282` | el otro modo: cierra |

★ La cita afirma que *«lo único que difiere entre modos [es] la semántica de ENTER … Ready equipa
in situ, Use devuelve el id y cierra — @0x1230»*, y el binario lo dice con un solo `cmp` sobre el
argumento de modo: **el brazo `'R'` LLAMA** (`call 0xc5c`, el equipado) y el otro **sólo escribe un
resultado** y se va. Los dos destinos existen, hacen cosas distintas y se reúnen en `0x1282`. Es
justo la pregunta de esta celda, respondida que SÍ. **(a) exacta.**

## 3. Estado de la cola

| | pares |
|---|---|
| población @ `17316d2a` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| sub-tandas 1-4 de este carril | 30 |
| adjudicados aquí | **6** |
| **VIVOS** | **10** |

Balance del carril: **36 pares por 30 lecturas (0,83)** — 35 (a) · 1 (b) · 1 (c) · 0 (d).

**Los 10 que quedan**, con su capa: `CMDS.OVL:0x1ac6`, cuyo destino es `main.ts:2716`, · `DUNGEON.OVL:0x14aa` ·
`ENDGAME.OVL:0x00d6` · `FONT.OVL:0x03aa` · `INTRO.OVL:0x0dec` · `ULTIMA.EXE:0x31f4` · `0x535e` ·
`0x56e6` · `0x6b7e` · `ZSTATS.OVL:0x0a81`. **Nueve de los diez son `skin`/`ui`** — presentación, no
mecánica. Con el estimador ya calibrado dos veces: **≈10 lecturas**, una sub-tanda larga o dos
cortas.

## 4. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 6 estaban bien.
- **No ha leído** los 10 restantes, ni el par de `main.ts` que quedaba en la capa `core`
  (`CMDS.OVL:0x1ac6`), cortado por frontera de par.
- Quedan declarados sin verificar: los tiles `0x9b`/`0x9a` de §2.4, el casado de tablones y el
  estampado de §2.5, y el argumento del reloj de §2.1.
- Ninguna de las 6 citas lleva el token `kernel`.

## 5. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 6. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `DNGLOOK.OVL`, `DUNGEON.OVL`,
`ENDGAME.OVL`, `FONT.OVL`, `INTRO.OVL`, `MAINOUT.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `TOWN.OVL`,
`ULTIMA.EXE`, `ZSTATS.OVL`.
