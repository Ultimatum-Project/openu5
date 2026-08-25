# #116 — Los 129 huérfanos sin adjudicar: adjudicados por CALL-SITE, no por lectura

Encargo: adjudicar los 129 que el detector recalibrado de #86 dejó sin veredicto, con el
encuadre explícito de que **129 no son 129 defectos**. Prioridad declarada: buscar SAPO.

**VEREDICTO CORTO.** 129 adjudicados: **78 hueco-del-port**, **43 familia-de-datos**,
**8 ruido**. **CERO sapos confirmados**, y la razón está medida, no supuesta. Por el camino
salieron **tres correcciones a actas cerradas** (#47 §3 dos veces, #53 una) y un **quinto
punto ciego del detector** que sólo apareció porque el barrido se auditó a sí mismo.

---

## 1. El método: preguntar QUIÉN LA EMITE, no leer 129 flujos

`detect_orphan_strings` dice qué está catalogado y el port no emite. Eso no basta para
adjudicar: falta la otra mitad, **quién la emite en el ORIGINAL**. El instrumento nuevo es
`re/tools/orphan_emitters.py`:

1. localiza la cadena en `DATA.OVL` por bytes exactos **exigiendo frontera** (precedida de
   NUL) → `DS = fileoff − 0x10`;
2. busca ese offset como **inmediato-puntero** en los 25 binarios, reutilizando
   `routine_census.pointer_immediates` (sólo `push imm16` / `mov reg16, imm16`) — la regla
   de `verify_show`: el offset debe **consumirse** como puntero, no sólo existir;
3. atribuye el call-site a su rutina (`function_starts`).

**Control positivo dentro del propio barrido:** las 5 de plaga de #86, cuyos emisores yo
había derivado A MANO leyendo el cuerpo. El censo mecánico las reproduce **5/5 exactas**
—fichero, offset y DS— sin que yo le diera la respuesta. Un barrido que no reproduce lo que
ya se sabe no vale para lo que no se sabe.

Eso parte la población en tres, y cada parte tiene una adjudicación distinta:

| bucket | n | qué significa |
|---|---|---|
| **con call-site** | 81 | el original la imprime desde código ⇒ si el port no la emite, es hueco |
| **sin call-site** (está en DATA.OVL, nadie la empuja) | 43 | se consume INDEXANDO una tabla ⇒ familia-de-datos |
| **sin offset** (no está en ningún binario) | 5 | o el catálogo la fabricó, o el port la COMPONE |

## 2. Bucket «sin call-site» (43) — familia-de-datos, con la tabla localizada

No me quedé en «nadie la empuja, luego será una tabla»: **la tabla existe y está medida**.
36 de los 43 son los numerales en letra, contiguos en `DS 0x820a-0x8316`, y buscando el
patrón de punteros LE consecutivos aparece una **tabla de 38 punteros en `DATA.OVL`
fileoff 0x3e1e (DS 0x3e0e)**. Se indexan; no se empujan.

Los otros 7: `Adept of Woznir`, las cuatro pistas de lore (`a hidden mountain keep`,
`a lighthouse south of Britain`, `the desert`, `the mother of Rew`) y
`mandrake root!`/`nightshade!` (#91), todas con el mismo perfil.

★ **Corrección 1 a #47 §3.** El acta de #47 declaró RUIDO a `Two`/`Six`/`Ten` «porque los 9
sí están en `game/assets`, comprobado uno a uno». Estaban en el **blob** como subcadena.
Son **entrada de tabla**, y su tabla no está portada — coherente con que
`'Watch\n\nThe pocket watch reads '` también salga huérfana: el reloj deletreado no existe
en el port. Eran una familia y la guarda de 3 caracteres la partía en dos.

## 3. Bucket «sin offset» (5) — ★ el port SÍ las emite, y #47/#53 decían lo contrario

`Ring Invisibility`, `Ring Protection`, `Ring Regeneration`, `Amulet Of Turning`,
`Swordof Chaos` **no aparecen en ninguno de los 25 binarios** (barrido completo). Estuve a
punto de archivarlas como «artefacto del corpus» — y habría sido falso. Buscando el
PRODUCTOR apareció el mecanismo real:

```
InventoryDetails.Armament[].ItemName.replace(/([a-z])([A-Z])/g, "$1 $2")
    main.ts:2606   ·   ui/shop-console.ts:136
```

`RingInvisibility` → `Ring Invisibility`; `SwordofChaos` → `Swordof Chaos` (el `of`
minúsculo no separa). **Reproducido 5/5.** Y hay ruling previo del lead que ya lo explicaba:
`game/tests/fixtures/derived-presentation.json` (carril inventory-names, 2026-07-19).

★ **Corrección 2.** #47 §3 las clasificó «RAMA SIN CABLEAR … sus NOMBRES no se emiten por
ninguna vía», y #53 cerró en el mismo sentido. **El port sí los emite.** No hay nada que
cablear. Veredicto: `ruido` del detector — cadena emitida que nunca aparece como literal.

Cruce limpio: de las 12 claves del ruling, **exactamente las 5 de equipo** salen huérfanas;
las otras 7 no. El punto ciego tiene la forma exacta que el ruling describe.

## 4. Bucket «con call-site» (81) — y el punto ciego E

Sobre estas 81 corrí el **test del hermano**: si la MISMA rutina empuja cadenas que el port
sí emite, el flujo está portado y falta la rama; si no emite ninguna, la rutina está sin
portar.

⚠ El primer disparo dio **62 «candidatas a sapo»** y era **ruido del instrumento**: contaba
como hermana emitida cosas como `issed!\n` (la cola de «Missed!\n», un puntero al MEDIO de
otra cadena) y genéricos como `Yes\n\n` o `.\n\n`. Con dos filtros —hermana **alineada** en
frontera de cadena y de **≥8 caracteres**— quedan 41 en rutina portada y 40 en rutina sin
portar.

★ **Corrección 3, y punto ciego NUEVO (defecto E).** Comprobando a mano los candidatos más
concretos apareció que `Strength +1\n`, `Dexterity +1\n` e `Intelligence +1\n` **sí los
emite el port**:

```ts
const SHRINE_ATTR_LABELS = { strength: "Strength", dexterity: "Dexterity", intelligence: "Intelligence" };
for (const a of attrs) events.push({ kind: "message", text: `${SHRINE_ATTR_LABELS[a]} +1\n` }); // CAST2 0x0c9c-0x0cde
```
`core/world/shrine-ceremonies.ts:365-367`

El corpus guarda la **INSTANCIA** («Strength +1») y el código tiene la **PLANTILLA**
(`${…} +1`): el colapso `${}→{}` del detector no las hace coincidir. Es el **defecto E**,
hermano del B/C/D de #86 y no cubierto por ninguno.

Cruce que da confianza en el instrumento: mis call-sites mecánicos (`CAST2 0xcb6/0xcd7/0xcf8`)
caen **dentro** del rango que el propio comentario del port cita (`CAST2 0x0c9c-0x0cde`), y
yo no leí ese comentario hasta después. Acuerdo independiente.

⇒ los 3 pasan a `ruido`, y quedan **78 hueco-del-port**.

### 4.1 Los 78, con lo que la evidencia sostiene y lo que no

Familias con emisor derivado y citado (call-site por cadena en el ledger): búsqueda de
mazmorra (`Treasure!`, `Nothing hidden in the pit.`, `…on the skeleton.`,
`This tile is impossible.` — SJOG 0x646, cuya rutina el port SÍ emite en otras ramas),
`get_item_switch` (`The plans for the HMS Cape!`, ` odd key` — SJOG 0x1458), taberna y
carta de vinos (SHOPPES2 0x1f4/0xdc), gitana/lore (SHOPPES2 0x508), posada
(SHOPPES3 0x4e6), TALK (sin sitio en el grupo, `"Zzzzzz..."`, guardia sin respuesta),
`Pushed!`/`Pulled!` (CMDS), `Boarded!`, `Disarmed!`/`Chest opened!`, `Not dead!`,
`Field destroyed!`, `\nA shadowlord appears\n` (#52), ` dragged under!` (COMSUBS 0x312,
junto a los tramos de herida que el port sí emite), `' sprigs of\n'` (#91), `ARGH!`,
`* BOOOM! *`, `Wanted:   `/`Dead or Alive`, `To phase: `, `Direction-`.

**Confianza declarada `media`, no alta**, y por un motivo medido: el defecto E convirtió 3
de 81 «huecos» en emisiones reales. No hay criterio mecánico para descartarlo en los demás,
así que cada entrada del ledger lleva su `limite` diciéndolo.

**Sesgo del test del hermano que hay que conocer:** en rutinas de ≤2 cadenas, «ninguna
hermana emitida» **no informa** (no hay hermanas). Afecta a **16 de los 40** del grupo
«rutina sin portar»; los otros 24 sí tienen evidencia real.

## 5. La pregunta cara: ¿algún SAPO?

**Ninguno confirmado.** Y conviene ser exacto sobre qué significa: un sapo es que el port
imprima **otra cosa** en el mismo punto. Mi barrido establece que el port **no imprime esta
cadena**; para probar que imprime otra en su lugar hay que leer el flujo portado, y eso lo
hice sólo en los candidatos más concretos (donde apareció el defecto E, que es lo contrario
de un sapo: emisión correcta invisible al instrumento).

Sigue en pie la señal cara de #47/#86: **0 huérfanos con clase+cita** en
`approved-strings.json`. Los 41 en rutina portada son la población donde un sapo viviría;
quien quiera cerrarla tiene que leer esos 41 flujos, y ahora tiene el call-site de cada uno.

## 6. Lo que NO afirmo

- Que los 78 sean 78 defectos del port. Son 78 cadenas con emisor derivado que el port no
  emite **como literal ni como plantilla sustancial**; el defecto E acota esa afirmación.
- Que los 43 de datos sean inalcanzables: significa que el binario los emite **indexando**.
  Que su función esté o no portada es otra pregunta (para los numerales, no lo está).
- Que el test del hermano mida «rutina portada» en rutinas de 1-2 cadenas.
- Nada sobre prioridad de portar ninguna de estas ramas.

## 7. Predicciones falsables

1. Si alguien porta la búsqueda de mazmorra completa (SJOG 0x646), las 4 de ese grupo salen
   del censo juntas. Si sale una sola, la rama portada no es la que creemos.
2. Si se arregla el defecto E (resolver plantillas contra sus tablas de etiquetas), el
   recuento de huérfanos baja y **todo lo que baje debe salir del bucket hueco-del-port**,
   nunca de `familia-de-datos`.
3. Ninguna adjudicación `familia-de-datos` debería adquirir jamás un call-site: si un futuro
   censo le encuentra uno, es que `pointer_immediates` cambió de criterio.

## 8. Cola que dejo

- **Leer los 41 flujos «rutina portada»** para cerrar la pregunta del sapo por lectura.
- **Defecto E del detector**: resolver plantillas contra tablas de etiquetas enumerables.
  Tiene un control positivo listo (el trío del santuario) y sería el 5º arreglo de #47.
- Los `' sprigs of\n'` / mandrake / nightshade son de **#91**; `\nA shadowlord appears\n` es
  de **#52**; ` to move,\nRETURN selects.\nType M to mix:` toca **#106**. No los invado.

## 9. Gates y procedencia

- `pytest re/tools/test_orphan_emitters.py re/tools/test_detect_orphan_strings.py` →
  **EXIT 0**, 25 passed.
- `python3 re/tools/detect_orphan_strings.py --check` → **EXIT 0**: 134/134 adjudicados
  (antes 129 sin adjudicar).
- `npx tsc --noEmit` en `game/` → **EXIT 0** (no se tocó TypeScript).
- Exits leídos SIN pipe. Ledger validado con `object_pairs_hook`: sin claves duplicadas.
- Binarios: `original/u5/ultima5/*` (25). Disasm vía `routine_census`, importado en modo
  lectura (`frontier.py` y `routine_census.py` siguen EMBARGADOS: no se editan).
