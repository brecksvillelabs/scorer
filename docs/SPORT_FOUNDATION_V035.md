# Scorer v0.3.5 — Lacrosse + Kabaddi sport review

This release adds two sport-specific scoring models before the v0.4 mobile foundation.

## Review method

Scorer uses separate sport-rule review passes followed by one PM/UX consolidation. The goal is not to pretend every league uses identical rules; Quick Score should surface the decisions a scorer needs most often while competition-specific details remain configurable.

## Lacrosse review

### Baseline
- Default: **Field lacrosse**.
- Field baseline follows the World Lacrosse four-quarter model; the international men's field rulebook uses four 15-minute periods.
- Optional **Sixes** discipline uses four 8-minute running-time quarters and a 30-second shot clock.
- Field shot-clock use varies by discipline/competition. World Lacrosse men's international field adopts an 80-second shot clock from 2026; women's field implementation begins in 2027. Scorer therefore keeps the field shot clock configurable rather than assuming it is universal for youth/domestic games.

### Quick Score hierarchy
1. Game clock / quarter
2. Goals
3. Possession indicator
4. Optional shot clock
5. Timeouts

### Controls
- Goal +1 / correction -1
- Possession A/B
- Timeout A/B
- Shot-clock start/pause and reset when enabled
- Previous/next quarter

### Future Advanced mode
- Penalty box / releasable vs non-releasable penalties
- Faceoff/draw controls
- Player goal/assist attribution
- Shots, saves and goalkeeper statistics
- Clearing/turnover events

## Kabaddi review

### Baseline
- IKF-style rectangular-court kabaddi.
- Seven players on court.
- Standard senior men's match: two 20-minute halves with a 5-minute interval; shorter competition profiles can be configured.
- A normal opponent-out / successful tackle is one point.
- **All Out** adds two extra points in addition to points from the raid.
- Raid ownership and the raid clock are first-class scoreboard information.

### Quick Score hierarchy
1. Team score
2. Which team is raiding
3. Raid clock (default 30 seconds)
4. Half/game clock
5. Common scoring actions

### One-tap scoring
For the current raiding team:
- Touch +1
- Bonus +1
- All Out +2
- Technical +1

For the defending team:
- Tackle +1

Completing a scoring action ends the current raid and hands the next raid to the other team. An explicit **Empty raid** action changes raid possession without changing the score.

### Future Advanced mode
- Players in/out and revival order
- Super tackle
- Do-or-die raid tracking
- Raider/player attribution
- Cards and substitutions
- Detailed raid history and team/player statistics

## Connected Scorer compatibility
Both sports append ordered local events to the existing match event trail so ScorerHub can later synchronize actions rather than only transmitting a final number.

## Privacy
v0.3.5 remains local-first. Adding these sports does not upload scores, rosters, media or event data.