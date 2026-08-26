# Scorer v0.3.3 — Sport Foundation

This release formalizes the seven supported sports before Connected Scorer / ScorerHub synchronization is introduced.

## Product rule

Scorer stays easy to operate in **Quick Score** mode, but the underlying state must be rich enough to support history, Undo, future cloud synchronization, spectator timelines and advanced tracking. Competition-specific variations stay configurable rather than being silently hard-coded.

## Sport review

### Volleyball
- Baseline: rally scoring, server follows rally winner, win set by 2.
- FIVB reference profile: best of 5; first four sets to 25; deciding fifth to 15.
- Scorer may default a new personal/school match to Best of 3 because many scholastic/club competitions use that format; the format remains explicit and configurable.
- Current advanced-ready fields: server, timeouts, set history.
- Later advanced work: rotations, substitutions, libero/lineup.
- Reference: https://www.fivb.com/volleyball/the-game/basic-rules/

### Basketball
- Baseline: four quarters with configurable period length because FIBA, NBA and scholastic competitions differ.
- Current advanced-ready fields: possession, team fouls, timeouts.
- Team fouls reset when moving to a new quarter in the current generic model.
- Later ruleset presets should distinguish FIBA/NBA/NFHS rather than mixing timeout/foul conventions.
- Reference profile: https://www.fiba.basketball/documents/official-basketball-rules/current.pdf

### Soccer
- Baseline: two equal halves with a configurable running/count-up clock.
- Senior IFAB reference is 45-minute halves, while youth/grassroots duration can differ by competition.
- Current advanced-ready fields: yellow/red cards and stoppage metadata.
- Later advanced work: substitutions, extra time and penalty shootout.
- Reference: https://www.theifab.com/laws/latest/the-duration-of-the-match/

### Football
- Baseline: four quarters, configurable clock, standard scoring buttons, possession and down/distance.
- Current default is a 15-minute quarter profile; youth/scholastic competition presets should be added rather than assumed.
- Later advanced work: overtime, drive/series events and configurable timeout rules.
- Reference: https://operations.nfl.com/the-rules/nfl-rulebook/

### Cricket
- Baseline: limited-overs innings with runs/wickets/overs, active striker/non-striker and current bowler.
- No-roster batting identities are now sequential and unique: Batter 1 + Batter 2, then Batter 3, Batter 4, etc.
- A run-out may dismiss either striker or non-striker. A run-out is not credited to the bowler.
- At an over boundary, scoring is locked until the next bowler is confirmed; the batting ends swap normally.
- Wides and no-balls remain illegal deliveries for ball-count purposes.
- Dismissal records are now retained in state for a richer scorecard later.
- Later advanced work: byes/leg-byes, no-ball + bat runs, wicket dismissal taxonomy, partnerships and complete scorecards.
- Reference: https://www.lords.org/mcc/the-laws-of-cricket

### Tennis
- Baseline: 0/15/30/40, deuce/advantage, games and sets.
- At 6–6 the current profile enters a 7-point tie-break requiring a two-point margin.
- Server order is tracked through normal games and tie-break blocks.
- Later advanced work: doubles server identity and configurable match tie-break / no-ad formats.
- Reference: https://www.itftennis.com/en/about-us/governance/rules-and-regulations/rules-of-tennis/

### Badminton
- Baseline: rally scoring, best of 3, games to 21, win by 2 with a 30-point cap.
- Server and simple service-court parity are tracked.
- Later advanced work: doubles service order and receiver identity.
- Reference: https://corporate.bwfbadminton.com/statutes/

## Event foundation

Core scoring actions now append ordered lightweight events to match state. Examples:

- `volleyball.point`
- `tennis.point`
- `badminton.rally`
- `cricket.delivery`
- `score.adjusted`
- `period.changed`
- `match.finished`

This is intentionally local-only in v0.3.3. The later ScorerHub phase can synchronize these deterministic events while the personal scorer continues to work offline.

## Privacy / cloud boundary

No v0.3.3 scoring event is uploaded anywhere. Scorer remains local-first. Google sign-in, live sharing, cloud matches and ScorerHub are later phases and must remain optional.
