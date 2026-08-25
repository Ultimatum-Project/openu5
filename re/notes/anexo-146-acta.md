# ACTA #146 — Fusión del anexo #139 al ledger + barrido de las entradas con `limite`

Carril `anexo-146`, rama `re/anexo-146`, sobre `main` @97233990.
Alcance: `re/ledger/orphan-strings.json` + `re/notes`. CERO `game/src`, CERO e2e.

---

## 1. Fusión: 134 → 152 adjudicados

Las 18 altas del anexo entran tal cual. `re/ledger/orphan-strings-139-anexo.json` se retira:
su contenido está dentro. Verificado con `object_pairs_hook` en lectura y en relectura
post-escritura: sin claves duplicadas, todas con cita, vocabulario de veredicto cerrado.
`detect_orphan_strings.py --check` → **exit 0**, 136 huérfanos, 136 adjudicados, 0 sin adjudicar.

## 2. ★ El choque único resultó ser una CONVERGENCIA, no un conflicto

`' AM.\n'` era la única clave que el anexo y el ledger compartían. Y las dos partes decían
lo mismo, habiendo llegado **por caminos distintos**:

- **#120 (sapos-120b)**, leyendo el flujo: «NI sapo NI hueco … el port emite 'AM'/'PM'
  pelados dentro de una plantilla y nunca el corte del binario».
- **#139 (este carril)**, llegando por el detector arreglado: `use-tools.ts:181-182` emite
  `` `The pocket watch reads ${h12}:${mm} ${ampm}.` ``, calcado de CAST.OVL 0x1b1a.

Dos derivaciones independientes que coinciden valen más que una. La entrada queda como
`ruido` con las dos citas.

### El segundo emisor, que hubo que comprobar aparte

sapos-120b avisó de que el censo de hermanos **cuelga cada cadena de UNA sola rutina**, y
que `' AM.\n'` tiene dos emisores. Lo verifiqué antes de dar la retractación por buena:

```
LOOKOBJ.OVL 05de: cmp byte ptr [g_hour], 0xb
            05e3: jbe 0x5f0
            05e5: mov ax, 0x730a   ; OTRA copia de ' PM.\n'
            05f0: mov ax, 0x7310   ; OTRA copia de ' AM.\n'
```

Es el reloj de pie, no el de bolsillo — copia distinta de las cadenas en DATA.OVL, rutina
distinta. **También está portado**: `core/game.ts:470-476` devuelve
`` suffix: `${h}:${mm} ${ampm}.` `` para el tile 0xFA/0xFB. Los dos flujos emitidos ⇒ la
retractación se sostiene por las dos vías, no por una.

## 3. ★ El ledger se contradecía a sí mismo en TRES entradas

Las tandas de #120 **añaden** campos (`leido_120`, `criterio`, `veredicto_120`) y por diseño
no tocan `veredicto` — sapos-120b lo declaró explícitamente. Consecuencia estructural: cuando
su lectura **refuta** la etiqueta vieja, la etiqueta vieja se queda en pie y la entrada dice
dos cosas opuestas.

Tres entradas con `veredicto: hueco-del-port` y un `veredicto_120` que lo niega — una lo dice
con todas las letras («la etiqueta 'hueco-del-port' de esta entrada esta MAL»):

| clave | qué decía su propio `veredicto_120` |
|---|---|
| `' AM.\n'` | NI sapo NI hueco: ruido de segmentación |
| `'Watch\n\nThe pocket watch reads '` | «la etiqueta 'hueco-del-port' de esta entrada esta MAL» |
| `'Yes\nSaving...\n'` | NI sapo NI hueco: ruido de segmentación |

Reconciliadas. Las dos últimas son **reconciliación mecánica, sin juicio nuevo mío**: sólo
hago que la etiqueta diga lo que la entrada ya decía dentro. La derivación y la cita siguen
siendo de #120 y quedan intactas. Tras el pase: **cero auto-contradictorias**.

## 4. Barrido de las 44 con `limite` de punto-ciego-E — rinde UNA

Población real (medida sobre el ledger de hoy, no sobre mi estimación de ayer): **72**
entradas `hueco-del-port` con ese límite, **28 ya leídas** por #120, **44 sin leer**, de ellas
sólo **4** con `rutina_portada: true`. Mi cifra de ayer (78 / 38 portadas) era del ledger
viejo; las tandas de #120 ya se habían comido la mayor parte de las portadas.

Criba mecánica: partir la clave por los huecos del binario (`%`, `$`, saltos) y buscar el
trozo literal más largo (≥8) en el código **sin comentarios**. Resultado: **3 candidatas**
con texto vivo, 41 sin nada que mirar. Leídas las 3 a mano:

- **`'\n\nYour response?\n:'` → REFUTADA a `ruido`.** `guard-encounters.ts:65` construye el
  reto del guardia terminado en «\n\nYour response?» y `main.ts:1626` lo pasa a
  `selector.prompt(...)`. Falta la cola `\n:`, que la pone el getstring: familia #135.
- **`'"\n\n"CAN\'T PAY?\nBeat it!"\nyells '` → revisada y NO refutada, a propósito.** El port
  emite el TEXTO (`shops.ts:667`) pero APLANADO: pierde comillas, saltos y sobre todo el
  «\nyells \<nombre\>» que ATRIBUYE el grito al tendero. **Emitir el texto no es emitir la
  cadena.** Anotada como género de #142, que es donde debe cerrarse.
- **`' sprigs of\n'` → no era refutable: ya no es huérfana** (ver §5).

## 5. ★ Clase nueva que destapó el control: seis entradas RESUELTAS y sin marcar

Antes de reclasificar las 3 candidatas comprobé si seguían siendo huérfanas hoy. Una no lo
era, y al medir la clase entera aparecieron **6 entradas `hueco-del-port` cuya cadena ya no
sale en el censo**: el port las emite desde que aterrizó el trabajo que las arregló.

| clave | la arregló |
|---|---|
| `' sprigs of\n'` | a23ffefa (#91) |
| `'"Nay!"\n'` | 21c92b7b (#130) |
| `' odd key'`, `'Boarded!\n'`, `'Nothing hidden\nin the pit.\n'`, `'Nothing hidden on the skeleton.\n'` | de4996aa (#133) |

Commits localizados con `git log -S` sobre `game/src`, **no supuestos**. No borro el
`veredicto` histórico —es el estado cuando se adjudicó y vale para trazabilidad—: añado
`estado: RESUELTO` + `resuelto_por`. Sin eso, el ledger aparentaba **85 huecos vivos cuando 6
ya estaban cerrados**. Queda: **84 entradas hueco-del-port, 78 VIVAS hoy.**

Es una tercera forma de que una etiqueta envejezca, distinta de las dos de §3 y §4: no es que
la adjudicación fuera errónea, es que el port avanzó y nadie volvió a la ficha.

## 6. Gates

`detect_orphan_strings.py --check` **exit 0** (136/136/0) · pytest de los 4 ficheros
**exit 0, 88 passed**, sin pipe · `object_pairs_hook` en lectura y relectura, cero duplicadas
· todas las entradas con cita · vocabulario de veredicto cerrado a los tres válidos ·
cero `game/src`, cero e2e.

⚠ Heredada de sapos-120b y aplicada: `seed_diff.py` hace `os.rename` de cada nota a un
temporal y la repone en un `finally` que un SIGKILL no ejecuta. Se le pasa **sólo esta nota**,
jamás `re/notes/*.md` entero, y se mira el porcelain después.

## 7. Predicciones falsables

1. Si alguien vuelve a correr el barrido de §4 sobre las 41 «sin nada que mirar» con un
   criterio más fino (plantillas cuyo hueco sea un ternario de literales inline, que es lo que
   `instancias_de_plantilla` no cubre), deberían aparecer **pocas**: la criba por trozo
   literal ≥8 ya cubre el caso en que el port conserva algo del texto. Si aparecen muchas, la
   criba era demasiado gruesa y hay que rehacerla, no ampliarla.
2. La clase de §5 volverá a crecer sola: cada lote de fixes calcados cierra huecos sin volver
   al ledger. Merece un gate —«ninguna entrada `hueco-del-port` sin `estado` puede estar fuera
   del censo de huérfanos»— que hoy no existe y que sería barato.
3. El género de §4 («el port emite el texto y pierde la atribución») no lo ve **ningún**
   instrumento actual: el detector se calla en cuanto el texto aparece. #142 es el sitio.
