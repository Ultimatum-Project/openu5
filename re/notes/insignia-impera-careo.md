# El reto de la INTERCEPCIÓN del Palacio, derivado ENTERO — la insignia es el ÚNICO estado del mecanismo, y trono e intercepción NO comparten nada («password conocido» no existe en el save)

Carril `insignia-impera` · 2026-08-24 · sobre main `b5b1660f` (worktree propio, REGLA 2
completa). Encargo: la ficha F2 de cabos-ad (tren #134, `espejo-ad-cabos-ad.md` §1.b) —
derivar del ASM el flujo completo del reto de guardia del palacio y carear el port.
**Veredicto en una línea: el port a `b5b1660f` YA ES FIEL pieza a pieza (T-A/T-B
aterrizados en `08d36139` + #277 + ruling 30-07 + #301); la «captura silenciosa donde
1988 retaba» de la ficha es propiedad de la RUTA del espejo (la insignia del LP viaja
como `todo` sin teclas — ad12 adjudicado ARTEFACTO, propiedad del corpus, F2a-c de su
dueño), no del port. Lo que este careo añade: la respuesta derivada a «¿comparten
estado trono e intercepción?» (NO — dos literales independientes, cero flags), tres
testigos T-A de la vía de intercepción que faltaban, y una cabecera rancia
tachada-documentada.**

## §1 — guard_demand TALK.OVL 0x01e2, rama Palacio, instrucción a instrucción

Leído en crudo (`re/disasm/TALK.OVL.asm:265-315` = offsets 0x01e2-0x031c):

```
01e9: cmp [g_location],0x12 ; jne 0x1f3 ; jmp 0x2a4     — loc 0x12 va a la rama palacio
02a4: cmp [g_time_spell],0x1d ; je 0x2ae                — GATE: ¿insignia puesta?
02ab: jmp 0x216            — NO → mov ax,1 / jmp 0x318 = ret 1 SILENCIOSO (cero prints)
02ae-02c7: print '"' + DS 0x90fc + '"' + DS 0x9128     — SÍ → el reto
02ca-02d2: getstring(&buf=[bp-0x10], maxlen 0xe)        — kernel 0x7b9c, hasta 14 chars
02dc: mov byte [bp-0xc],0                               — buf[4]=0: TRUNCA a 4 chars
02e0-02e8: strcmp_ci(buf, DS 0x4a9a "IMPE\0")           — call 0 (reloc); ax!=0 = MATCH
02ed: jne 0x2f2 ; jmp 0x216                             — no match → ret 1 (misma salida)
02f2-0315: print '\n' + '"' + DS 0x913a + '"' + '\n'    — match → «Pass, friend!»
0315: jmp 0x22b = sub ax,ax → ret 0                     — guardia satisfecho
```

Strings verificados BYTE a BYTE contra DATA.OVL (fileoff = DS+0x10):
- `0x90fc` = `Give now the\npassword, bearer\nof the Badge!`
- `0x9128` = `\n\nYour response?\n`
- `0x913a` = `Pass, friend!`

**Escrituras de estado global en la rama palacio: CERO.** (Las únicas del handler
entero son `g_gold` 0x0225/0x029d, ramas Minoc/tributo — el censo de T-B,
`tc-result-producer.md` §3, re-confirmado aquí sobre el listado.)

## §2 — Las cuatro preguntas del encargo, adjudicadas

1. **¿Qué comprueba la intercepción?** SOLO la insignia (`g_time_spell==0x1d`,
   0x02a4). No existe «password conocido»: el password se pregunta INTERACTIVO
   (getstring 0x02d2) en cada intercepción y se compara contra el literal
   DS:0x4a9a. Sin insignia, ret 1 silencioso → npc_engine 0x13d6 → TOWN 0x12ae =
   captura muda (la vía que el clon calcaba desde el principio).
2. **¿Qué pasa al acertar IMPERA?** «Pass, friend!» + ret 0 = pase de ESA
   interacción y de ninguna más — el match no escribe nada (§1), así que el
   turno siguiente con el guardia aún adyacente RE-RETA (T-B). El crudo del LP
   lo confirma en vivo: pasa el reto, sale, re-entra y le retan OTRA VEZ
   (ad_ep12:6728-6740). El truncado 0x02dc hace el match sobre los 4 primeros
   chars: «IMPERA» pasa por «IMPE» (bug-for-bug).
3. **¿Y al fallar?** ret 1 — la MISMA salida que sin insignia: escalada a TOWN
   0x12ae (re-gate `loc==0x12 ∧ party_conscious_state>=0`) = CAPTURA con
   interrogatorio del trono. No hay combate en esta vía (el combate del palacio
   es el tail 0x13dc de los hostiles no-guardia). Con insignia, fallar cuesta LO
   MISMO que no llevarla; lo único que la insignia compra es el derecho al reto.
4. **¿La insignia evita la intercepción?** NO. La adyacencia arma `[0x65bf]` igual
   (NPC.OVL 0x06e4, sin mirar `g_time_spell`) y guard_demand corre igual: la
   insignia solo CONVIERTE la captura muda en reto. «Pasear el palacio» con la
   insignia es libre únicamente porque los guardias solo retan cuando estás
   pegado a ellos (manhattan==1).

## §3 — Trono e intercepción NO comparten estado (la pregunta nueva de este careo)

- **Vía del trono** (tren #133): conversación TLK GUIONIZADA — `castle.json`
  NPC 10 (Blackthorn), label 3 «Then, surely, thou dost know our password....
  What is it?», keyword **`impe`** (4 chars: la convención de keywords TLK). La
  respuesta de acierto, enumerada op a op: texto «Fine! …» + «Please, feel free
  to roam my castle and grounds!» + EndConversation — **cero ops de estado** (ni
  flag, ni karma, ni item). El «free to roam» es PROSA, no un bit.
- **Vía de la intercepción**: literal `"IMPE"` HARDCODEADO en DS:0x4a9a,
  strcmp en TALK.OVL 0x02e0 (§1). Cero escrituras.
- ⇒ Los dos «IMPERA» son dos literales independientes en dos capas (datos .TLK
  vs código del handler) que casualmente valen lo mismo. **No hay flag
  «password conocido/aceptado» en el save por NINGUNA de las dos vías.** El
  único estado save-resident de todo el mecanismo es `g_time_spell` (DS 0x587a)
  == 0x1d = insignia PUESTA — único escritor (U)se Badge, CAST.OVL 0x1b47 tras
  «Badge worn!» (#277) — que el port lleva en `state.timeSpell` (persistido
  desde `ea51efc8`, que unificó wornBadge/wornAmulet/timeSpell en el byte real).

## §4 — Careo del port (main `b5b1660f`), pieza a pieza

| binario | port | veredicto |
|---|---|---|
| gate 0x02a4 en la INTERCEPCIÓN | `blackthorn-capture.ts:281` (`checkBlackthornCapture`: badge → `challengePassword`) | FIEL |
| gate 0x02a4 en (T)alk (sin insignia ni pregunta) | `guard-encounters.ts:164` (`tryTalkGuard` → `[]`) | FIEL |
| reto 0x90fc/0x9128 + getstring | `guard-encounters.ts:106` + prompt `blackthorn-guard-password-prompt` (UI `main.ts:2386`) | FIEL (divergencia SOLO-BLANCOS: el `\n` final de 0x9128 va fundido) |
| truncado buf[4]=0 + strcmp IMPE case-fold | `blackthorn.ts:680-682` (`guardDemand`) | FIEL (bug-for-bug) |
| match → «Pass, friend!» ret 0, SIN escritura | `submitGuardPassword` → mensaje; sin flag (T-B: `blackthornPassGranted` retirado) | FIEL |
| fallo → ret 1 → 0x13d6 → 0x12ae re-gateado | `submitGuardPassword` → `runCapture` (gate `blackthornCaptureTriggers` = loc∧consciente) | FIEL |
| sin insignia → ret 1 mudo → captura | `checkBlackthornCapture` cae a `runCaptureScene` | FIEL |

La premisa de la ficha F2 («el port captura EN SILENCIO donde 1988 retaba») queda
**SUPERADA en el sujeto port**: era verdad del árbol pre-`08d36139` y sigue siendo
verdad del RUNNER del espejo (la ruta ad12 lleva «Badge worn!» como `todo` sin
teclas ⇒ el runner pasea SIN insignia y la deriva le compra capturas mudas), que es
exactamente lo que `espejo-ad-cabos-ad.md` §1.b.1 adjudicó como ARTEFACTO con
remedio F2a-c fichado para el dueño de la curación. Este carril NO toca `routes-ad/`.

## §5 — Lo que deja este carril en el árbol

- `game/tests/password-live.test.ts`: cabecera RANCIA tachada-documentada (decía
  «el gate `g_time_spell==0x1d` queda ⚠️ oráculo: NO se modela» — falso desde
  #277; los tests de abajo lo ejercían mientras la prosa lo negaba) + **tres
  testigos T-A de la INTERCEPCIÓN** que faltaban (la suite solo ejercía el reto
  vía (T)alk): primera adyacencia con insignia → reto en crudo 0x90fc sin
  captura; IMPERA → «Pass, friend!» sin depósito; fallo → venda 0x6fbc +
  interrogatorio. Mutante-control ejercido: retirar el gate de
  `blackthorn-capture.ts:281` pone en rojo los 3 nuevos + 2 T-B (5 rojos), y
  restaurado.
- Verificación VISUAL (Playwright, server propio 5230 con `<title>` careado):
  intercepción con insignia MIRADA en fotograma — reto «Give now the password,
  bearer of the Badge!» → `IMPERA` → «Pass, friend!», posición y llaves
  intactas. El e2e `blackthorn.spec.ts` (2/2) cubre la misma clase con teclado.
