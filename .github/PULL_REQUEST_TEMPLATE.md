## What

<!-- One paragraph: what this PR changes and why. -->

## Provenance (required for gameplay changes)

- [ ] This PR does **not** change gameplay behaviour (UI/docs/tooling only), OR
- [ ] Assembly citation (overlay + offset) in a code comment next to the rule, OR
- [ ] Parity scenario under `re/parity/` proving the behaviour against the original

<!-- "It feels wrong" or "other remakes do X" is not evidence — see CONTRIBUTING.md -->

## Tests

Which tiers ran (see CONTRIBUTING.md):

- [ ] Tier 1 — typecheck / pure tests (no game data)
- [ ] Tier 2 — `npm test` / `npm run e2e` / `npm run re:parity:all` (own game data)
- [ ] Tier 3 — live oracle against DOSBox-X

## Checklist

- [ ] No game data, art, music, maps or text from any Ultima game, in any encoding
- [ ] UI PRs: `core/` untouched, E2E suite green without modifying a single assert
- [ ] If this contradicts a rule in `re/notes/`, the note is updated with the new derivation
