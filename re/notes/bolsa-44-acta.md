# ACTA — BOLSA #44: la convención de jimmy UNIFICADA y el hueco de proceso CERRADO

> Carril `bolsas-tickets`, rama **`re/bolsas-tickets`**, base main **`cc4a3b8a`**.
> Origen: `quotes-family-41-37-acta.md`.

---

## 0. VEREDICTO

| tarjeta | veredicto |
|---|---|
| **Convención mixta del `message` de `jimmyLock`** | **UNIFICADA a VERBATIM.** Ni un mensaje fabricado: los 11 retornos citan cadenas que EXISTEN en `DATA.OVL` y casan carácter a carácter **salvo el terminador**. La asimetría era mayor de lo declarado (10, no 4) y tenía **daño VIVO** adyacente: dos cadenas hermanas se fugaban en INGLÉS |
| **Hueco de proceso (careos invisibles al gate)** | **CERRADO con guarda barata.** Y el hueco era peor de lo enunciado: los careos no sólo no corrían — **se SALTAN en silencio con EXIT=0** |

---

## 1. La convención: lo que dice el binario, medido byte a byte

Impresor único `call 0x58d0` (`print_string`, no `putchar`). Delta DS→fileoff `+0x10`.
Los literales leídos directamente de `original/u5/ultima5/DATA.OVL`:

| DS | bytes en DATA.OVL |
|---|---|
| 0x8ae6 | `b'Unlocked!\n'` |
| 0x8b48 | `b'Unlocked\n'` |
| 0x8afe | `b'No one is there!\n'` |
| 0x8b1c | `b"Couldn't find this npc\n\n"` |
| 0x8b52 | `b'No lock!\n'` |

⇒ **el binario emite el `\n` en TODAS.** La convención mixta del port era: **10 etiquetas
podadas + 1 verbatim** (`'\n"I thank thee!"\n'`, DS 0x8b46, la que #41 ya adjudicó).

★ `"Unlocked!"` (puerta) vs `"Unlocked"` (cepo de mazmorra) **NO era incoherencia del
port**: son DOS literales distintos del binario, `0x8ae6` con `!` y `0x8b48` sin. El port
acertaba; mentían los COMENTARIOS (`game.ts:3742`, `jimmy-prisoner.test.ts:40`, los dos
escriben «`Unlocked!\n`» citando DS 0x8B48).

⚠ **Honestidad sobre el argumento.** El `\n` final es **inocuo para el render** desde #108:
`"Key broke!"` y `"Key broke!\n"` dan UNA fila las dos. La convención **no** era un defecto
de fidelidad visible. Muerde por otro sitio, y ése sí es real: **la clave del corpus i18n**.

## 2. 🔴 El daño VIVO: dos cadenas se fugaban en inglés

`t()` es lookup EXACTO sin normalización (`i18n/index.ts:182`), y el choke es `pushConsole`.
Medido sobre `es.json`:

| literal del port | ¿está en el corpus? |
|---|---|
| `game.ts:3728` `"No one is there!"` | **NO** — sólo existe `"No one is there!\n"` |
| `game.ts:3754` `"Couldn't find this npc"` | **NO** — sólo existe `"Couldn't find this npc\n\n"` |

⇒ **jugando en castellano, esas dos salían en INGLÉS.** No es cosmético, y es exactamente
la familia de `clave-viva-compuesta-no-la-constante`: el corpus tiene la forma del binario y
el port emitía otra.

★ **Por eso la unificación se hace hacia VERBATIM y no hacia podado**: hacia verbatim las
claves YA existen y la fuga se cierra **por construcción**; hacia podado habría que
inventar 8 claves nuevas y la fuga se cerraría por parche.

## 3. Lo aplicado, y el modelo MOVIDO EN EL MISMO COMMIT

- `core/world/commands.ts` — 10 literales a verbatim (`:179 :181 :185 :198 :211 :213 :224
  :231 :251 :266`). `:261` ya lo era.
- `core/game.ts` — `:3627` `"No lock!\n"` · `:3728` `"No one is there!\n"` · `:3754`
  `"Couldn't find this npc\n\n"`. **Los tres verificados contra los bytes de DATA.OVL antes
  de tocarlos** (DS 0x8B52 no estaba leída por nadie; lo está ahora).
- `re/tools/cmds_parity.py` — **9 mensajes del MODELO**, en el mismo commit. Sin esto el
  careo se pone rojo, y el careo es un modelo INDEPENDIENTE: moverlo después habría sido
  ajustarlo al port, que es justo lo que lo invalidaría.
- 19 asertos de test movidos en 5 ficheros.

⚠ **Los asertos NEGATIVOS también se movieron.** `expect(...).not.toContain("No one is
there!")` con la forma PODADA pasaría a ser un aserto **vacío** (pasa siempre, porque esa
cadena ya no se emite nunca). Dejarlos habría convertido dos controles negativos en
decoración: `trinquete-aserto-invertido`.

⚠ **Y un detalle que hizo fallar la predicción**: se esperaban 2 tests rojos y salieron
**14**. La razón es que `expect(msgs(...)).toContain("X")` opera sobre un **ARRAY** de
mensajes, así que `toContain` es pertenencia EXACTA, no subcadena. Los 14 eran la misma
clase — asertos que fijaban la convención — y ninguno reveló que el cambio fuera erróneo.

## 3.1 ★★ La familia queda INCOMPLETA, y quien lo cazó fue el manifiesto de strings

`tests/string-manifest.test.ts` es un mirror EXACTO código↔manifiesto, así que al mover los
literales exigió mover `approved-strings.json`. Al hacerlo apareció un miembro que yo no
tenía censado: **`main.ts:2107` produce también `"Success!"`** — y NO es el mismo string.

| productor | DS | cadena en DATA.OVL |
|---|---|---|
| `commands.ts` (J)immy, cofre-objeto | **0x8a64** (`SJOG 0x0c05,`) | `b'Success!\n'` |
| `main.ts:2107` tail genérico del Cast | **0x4656** (`CAST.OVL 0x11ac,`) | `b'Success!\n'` |

**Mismo texto, DOS productores, DOS cadenas.** Las dos llevan `\n` en el binario ⇒
`main.ts` tiene el MISMO defecto de convención… y **está bajo embargo**. ⇒ la unificación
queda incompleta por ese miembro (y por su hermano `"Failed!"`, DS 0x4660, `b'Failed!\n'`),
**a propósito y declarado**, no por descuido. El manifiesto conserva la clave podada
`"Success!"` con la cita de CAST y la razón escrita dentro.

★ Sin el manifiesto yo habría cerrado esto diciendo «convención unificada» a secas. Es
`familia-incompleta-invisible-a-cifras` cazada por un mirror exacto: **el instrumento que
compara CÓDIGO con CATÁLOGO ve los miembros que tu censo mental no tenía.**

Aprovechando el paso, **4 citas del manifiesto suben de calidad**: `"Unlocked!"`,
`"Unlocked"`, `"Success!"` y `"No lock!"` sólo decían «[D] `re/notes/cmds.md` — mensaje de
comando/puerta derivado»; sus claves verbatim llevan ya DS + fileoff + el `mov ax, <DS>` de
su emisor, leídos de `DATA.OVL` y de `SJOG.OVL` para este acta. ⚠ Y eso mismo es
corroboración independiente de la derivación: en el manifiesto **las formas VERBATIM ya
traían cita precisa y las PODADAS sólo citaban prosa**.

## 4. El hueco de proceso — y por qué era PEOR de lo enunciado

### 4.1 El acoplamiento, censado

13 modelos `*_parity.py`. Dependen de `core/world/loops/turn.ts` **DOS**, por import
directo del runner: `loops-run.ts:27` y `master-run.ts:31` (`outdoorTurn`/`townTurn`).

### 4.2 ¿Corrían en algún gate? **NO. Medido.**

`game/package.json` → `test` es `vitest run` a secas. La raíz sólo los invoca desde
`re:parity:all` / `verify:all`. **No hay CI** (`.github/workflows` no existe). Ningún test
de vitest los llamaba: las 5 menciones que aparecen en `game/tests` son **prosa**.

⇒ Confirmado: `4eccef89` cerró con `npm test -w game` y el careo de `turn.ts` **no podía
haber corrido**.

### 4.3 ★★ Lo que no estaba en el enunciado: los careos se SALTAN en silencio

Los dos módulos traen un `skipif` con predicado `TSX_BIN.exists() and RUN_TS.exists()`,
donde `TSX_BIN = <RAÍZ>/node_modules/.bin/tsx`. Sin ese binario **no fallan: se saltan**, y
pytest sale con **EXIT=0**. Medido en este mismo carril, que había symlinkeado
`game/node_modules` pero **no el de la raíz**:

```
10 passed, 37 skipped in  1.93s     <- EXIT=0, y no se careó NADA
46 passed,  1 skipped in 28.29s     <- con el symlink de la RAÍZ puesto, careo REAL
```

Es `genero-como-script-verde-vacio` otra vez, y me lo comí yo en directo. **Un guarda que
sólo mirase el exit code sería verde-vacío: el mismo defecto que pretende guardar.**

### 4.4 La guarda: `game/tests/parity-coupled.test.ts`

Corre por `spawnSync` los dos careos acoplados y asevera **DOS cosas**: exit 0 **y que la
POBLACIÓN que corrió es >= 40**. Más un chequeo previo de `node_modules/.bin/tsx` que da
el mensaje útil en vez de un conteo bajo y misterioso.

**Coste MEDIDO: 21,5 s** (no estimado). Escape sólo explícito y ruidoso:
`U5_SKIP_PARITY=1`. Jamás auto-skip silencioso.

**Sensibilidad, medida con el mutante que importa** — retirado el symlink de la raíz:

```
MUTANTE (sin node_modules de la raíz)   Tests 1 failed
   → "falta …/node_modules/.bin/tsx: los careos se SALTARÍAN en silencio
      (en un worktree, symlinkea también el node_modules de la RAÍZ, no sólo el de game/)"
RESTAURADO                              Tests 1 passed
```

⇒ la guarda se pone roja **por el defecto exacto que existe para cazar**, y el mensaje
nombra el arreglo.

### 4.5 Opciones DESCARTADAS, con su razón

1. **Guarda de FRESCURA de un artefacto — IMPOSIBLE, y está medido.** Los escenarios de
   `re/parity/**` sólo llevan la ENTRADA, no la salida esperada (`jimmy-prisoner-town.json`
   = `{"name":…, "spec":{…}}`). La expectativa vive DENTRO del modelo Python ⇒ **no hay
   artefacto que pueda quedar rancio**. Descartada por evidencia, no por gusto — y era la
   primera opción que el encargo sugería.
2. **Portar el modelo a TS para que lo corra vitest**: destruye la propiedad que justifica
   el careo (dos modelos INDEPENDIENTES). Sería circular.
3. **Meter `re:parity:all` entero**: ~2 min. El subconjunto acoplado es el corte correcto.
4. **Tripwire de hashes** (rojo si tocas `turn.ts` sin actualizar un pin): ~0 ms y sin
   dependencia de python, pero **no prueba paridad, prueba que a alguien se le avisó**, y se
   silencia actualizando el hash. Queda como plan B si se rechaza python en `npm test`
   (⚠ el repo ya exige python3 para sus 5 gates, así que la dependencia no es nueva).

## 5. Verificación

```
npx tsc --noEmit                                                       EXIT=0
vitest (commands, jimmy-chest-object, jimmy-prisoner, doors,
        dungeon-dispatch, audit-byte-wrap)                             117 passed
pytest test_cmds_parity + test_loops_parity                            46 passed, 1 skipped
vitest tests/parity-coupled.test.ts                                    1 passed (21,5 s)
   mutante: sin node_modules de la raíz                                1 FAILED  ✔ sensible
```

## 6. Lo que este acta NO hace

- ⚠ **RECTIFICACIÓN**: este apartado decía «no retira las claves podadas huérfanas de
  `es.json`, su presencia no rompe nada». **Era falso, y lo demostró el gate**:
  `tests/i18n-manifest.test.ts` («toda key traducida existe en el canon inglés») se puso
  ROJO con 5 claves —`Chest unlocked`, `Key broke!`, `No lock!`, `Unlocked`, `Unlocked!`—
  que, al no tener ya productor inglés, **el guarda clasifica como FABRICACIÓN**. Retiradas.
  La edición es QUIRÚRGICA por líneas, no un round-trip: `json.dump` habría reordenado y
  reformateado las 20.000 líneas del fichero por un delta de 5
  (`roundtrip-prueba-formato-no-orden`). Diff real: **25 borrados, 0 añadidos**.
  ★ `Success!` NO se retira: `main.ts` la sigue emitiendo (§3.1), y el guarda lo sabe —
  su lista de 5 la excluye sola. Los dos instrumentos concuerdan sin que nadie los cruce.
- **No censa** si otros ficheros fuera de `commands.ts`/`game.ts`/`dungeon.ts` repiten las
  cadenas podadas. Queda declarado como residuo.
- **No unifica** la SEGUNDA transcripción de `SJOG 0x0c3e`: el port la tiene DOS veces, en
  `commands.ts` (`dungeonChest`, sin llamador vivo) y en `dungeon.ts:510` (`jimmyHere`, la
  viva, que ya era verbatim). Ahora las dos coinciden en convención, pero la duplicación
  sigue ahí y es una tarjeta.
- **No extiende** la guarda a los 11 careos restantes: cubre los DOS acoplados a `turn.ts`
  más `cmds`, que es donde el hueco tenía consecuencia medida.
