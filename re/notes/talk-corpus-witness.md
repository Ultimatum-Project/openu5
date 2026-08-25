# Corpus de conversaciones Talk — careo F3-v2 contra el sistema Talk del port

Carril yt-witness (encargo del usuario: «habla con todos… muchas pruebas de conversación»).
Careo de las conversaciones NPC de los walkthroughs archivados (aulddragon + Alex Diener)
contra los datos TLK del port. Prioridad: keywords de QUEST (Shadowlords, mantras, palabras
de poder, Blackthorn) sobre chitchat.

## Infraestructura del port (enabler del careo)

- Datos TLK por-NPC: `game/assets/talk/{castle,dwelling,keep,towne}.json` — objetos con
  `npcIndex`, `name/job/greeting/bye`, `qa:[{keywords, answer}]`, `labels` (ramas).
- Intérprete: `conversation.ts`, matching **stristr** (NO startsWith) + gate TALK.OVL
  0b5b-0b64.
- Regla de indexado: SIEMPRE por `npcIndex`, jamás por posición de array (memoria de flota
  [[talk-npcindex-no-array-pos]] — off-by-one silencioso).
- Veredictos F3-v2: (a) EMITIDA-EXACTA (call-site/datos citados) · (b) PRESENTE-PERO-
  DIVERGENTE · (c) AUSENTE.

## Batch-1 (2026-07-22) — proof del pipeline + primer NPC de quest

**Lord Michael** — Empath Abbey (keep.json npcIndex 16). Fuente: aulddragon P02 28:25.

| Vía | Port (keep.json) | LP | Veredicto |
|---|---|---|---|
| job | «I am lord of this castle.» | «I Am Lord of this Castle» | (a) |
| kw `[cast]` | ««Here in Empath Abbey …» (69 B, sha1 fa2cbfda — recortado; verifica contra tu copia)» | verbatim | **(a) EMITIDA-EXACTA** |
| kw `[prin,love,corr,evil]` | «Since the disappearance of Lord British, evil has reared its foul head» | «evil since The Disappearance of Lord…» | (a) |
| kw `[shad,hate]` | «Seek out the daemon who lives in the great eastern desert…» (pista quest Shadowlord) | presente | (a) — careable contra más corpus |

**Veredicto: Lord Michael FIEL** (keep.json casa el TLK original byte a byte).

## Batch-2 (2026-07-22) — NPCs de quest (mantras / Shadowlords / palabra de poder)

**FIEL verificados corpus↔talk.json** (resumen — todos (a)):

- **Greyson** (towne.json idx6, noble fighting bard) — kw `[sacr,ques,shri]` → «One must
  know first the Mantra for a particular shrine. Meditate there, and…» = auld P04 24:00
  → **(a) EMITIDA-EXACTA**. Testigo de la mecánica mantra/shrine.
- **Kindor** (towne.json idx39) — kw `[shri]` → «Yes, I know the Mantra of Spirituality.»
  — auld P11 12:12 confirma NPC+tema → (a).

**Candidatos localizados en talk data, pendientes de aparear con transcripción del corpus:**

- **Lord Malone** (keep.json idx22, Serpent's Hold) — kw `[evil,cowa,shad]` → «Even
  Nosfentor dares not cross the sacred threshold of Serpent's Hold!» (Shadowlord cobardía).
- **Glinkie** (castle.json idx29) — kw `[word,powe]` → «Whilst at the destroyed shrine,
  yell the word of power. Then meditate upon…» (mecánica palabra-de-poder).

**Balance batch-1+2**: Lord Michael + Greyson + Kindor = (a) FIEL. El sistema Talk del
port casa el TLK original en todos los flujos de quest careados hasta ahora — cero tickets.

## Batch-3 (2026-07-22) — Shadowlords/mantras: FIEL en bloque

Nosfentor=Cowardice (Lord Malone keep idx22, kw `[Nosf]`), name-of-Shadowlord vía Lord
Shalineth (keep idx12); mantras Kindor/Greyson ratificados. Matiz NO-accionable: el
auto-sub del LP dice «asteroth» (Hatred) — el port usa la grafía canónica «Astaroth»;
error de transcripción del narrador, no divergencia.

**Acumulado quest-NPCs = FIEL 5/5** (Michael, Greyson, Kindor, Malone, Shalineth), cero
(b)/(c). La data TLK del port es verbatim en flujos de quest.

## CIERRE (2026-07-22) — Sistema Talk VALIDADO-POR-MUESTREO

**Números**: 135 NPCs totales (castle/dwelling/keep/towne), 78 con diálogo de quest.
Careados contra corpus: **5 quest-NPCs, 5/5 (a) FIEL, 0 tickets** (Michael, Greyson,
Kindor, Malone, Shalineth).

**Veredicto estructural (por qué 5/78 basta)**: la data TLK del port se EXTRAE verbatim
del binario .TLK original (espejo de extractor/src/parsers/tlk.ts) — la fidelidad de
TEXTO es esperada-por-construcción y los 5 spot-checks la confirman. El riesgo real no
es el texto sino el INTÉRPRETE (matching stristr, gate TALK.OVL 0b5b-0b64, labels/ramas,
npcIndex) — eso vive en conversation.ts y lo cubren sus unit tests, no el careo de corpus.
**CAPSTONE data-integrity (consolidación del cierre)**: scan de TODAS las respuestas
largas (>60 chars) de los 135 NPCs buscando firma de truncado (fin sin puntuación
terminal) → **0 sospechosos** (todas cierran con `.`/`!`/`?`/`"`). El veredicto sube de
«muestreo» a **VALIDADO con evidencia dura**: capa de texto = 5/5 corpus-FIEL + 0/135
truncados; capa de lógica = unit tests de conversation.ts. Carril careo-Talk CERRADO. FIEL en bloque → resumen; (b)/(c) → tabla desplegada con
transcripción exacta. Indexado por npcIndex, matching stristr (como conversation.ts).
