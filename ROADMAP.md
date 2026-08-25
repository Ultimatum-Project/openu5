# Roadmap

This is an honest map of where the project is. Items are not vague wishes: each
open line traces to an internal work queue with a defined method, and each
"done" line is locked by an automated suite.

## Done (suite-locked)

- **Rule migration at 100%** — the coverage ledger justifies **202,800 / 202,800
  bytes** of `ULTIMA.EXE` + its 24 overlays (code / data / inert, each with a
  note), and every gameplay rule in the engine cites its assembly.
- **Full game playable start to finish** — intro, character creation (gypsy),
  Britannia, towns/castles/keeps, NPC schedules and dialogue, shops, combat,
  the eight dungeons + Underworld in first-person 3D, dungeon rooms, Blackthorn's
  palace, shrines, moongates, naval, camping, death & resurrection, and the
  endgame sequence at Dungeon Doom.
- **Parity harness** — hundreds of scenarios run the same situation through an
  independent Python model (derived from the assembly) and the TypeScript engine;
  both must produce identical RNG streams and state. Plus runtime verification
  against the real binary in headless DOSBox-X for the seedable subsystems.
- **Byte-exact original RNG** — the add/rotate/xor generator at `ULTIMA.EXE
  0x2092`, live on a single unified stream through the whole game.
- **1988 presentation layer** — EGA-faithful skin (chrome, runic glyphs, CP437
  text windows), plus an optional shader skin. Gameplay code is untouched by
  skins: the E2E suite is the lock.
- **Spanish localization** — full UI + game text i18n layer (English remains
  byte-exact to the original).

## In progress — the "Grand Tour" gate

The final milestone is **grand-tour-green**: an automated purist playthrough of
ALL content with a 100% coverage manifest, every dungeon room sealed with a
verdict, run twice byte-identically. Nothing ships as "the announcement" before
that gate is green.

Current room census `<check at génesis>`: the vast majority of the 112 dungeon
room seals are VICTORY or faithful-dead-end; a queue of ~24 rooms across Wrong,
Doom, Deceit, Covetous and Destard is being closed **by mechanism** (each room
either becomes winnable through a derived mechanic, or is sealed as a faithful
dead end with an assembly citation — never fabricated).

## Honest open items (deliberate, catalogued)

These are not bugs; each is documented in
[`deliberate-divergences.md`](re/deliberate-divergences.md) with its class and
its path to closure:

- **Class A** — rules verified by model↔engine stream parity but not yet
  re-verified live against DOSBox (the oracle can't seed every structure
  headlessly yet).
- **Class B** — verified pure functions awaiting interactive wiring, mostly
  presentation endgame pieces (pixel-dissolve painter timing, final fanfare
  audio) pending cold analysis of their routines.
- **Class C** — conservative additions declared by the port where the binary's
  mechanism is opaque (each one flagged in code and docs).
- Field-object encoding in combat maps (`0xE8–0xEB` gravity fields) is modelled
  as inert pending derivation.
- Minor audio seams (shop transaction cue, dungeon trap cue, town-entry beep)
  derived but not yet wired.

## After 1.0

- **Browser "bring your own files" demo** — drag your GOG installer / `ultima5/`
  folder, extraction runs client-side, play instantly. (Pipeline already proven
  internally; polishing for public hosting.)
- English migration of the remaining RE notes (the deep-dive corpus started in
  Spanish; `rng`, `combat` and `deliberate-divergences` go first).
- HD/remaster skin exploration (strictly on top of the faithful layer).
- Mobile touch deck.
- Contributions of format corrections back to the Ultima Codex wiki.

## What will never be on this roadmap

- Shipping game data, art, music, text or maps — the engine stays clean forever.
- Gameplay "improvements" that diverge from the binary in the default layer.
- Monetization of any kind.
