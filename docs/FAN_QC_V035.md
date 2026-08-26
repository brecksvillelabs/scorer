# Scorer v0.3.5 — Fan / spectator QC review

This review simulates an informed fan of each supported sport looking at Scorer and asking four questions:

1. Can I tell who is ahead?
2. Can I tell where we are in the game?
3. Can I see the sport-specific context that changes what happens next?
4. Does the screen show anything misleading or unnecessarily operator-focused in Display mode?

These are independent sport-specific review passes synthesized into one QC document; they are not persistent external agents.

## Volleyball — PASS
A fan can see the rally score, sets won, current set, serving side and remaining timeouts. The set-centric hierarchy matches what a spectator needs. Advanced rotation/substitution detail remains intentionally outside Quick Score.

## Basketball — PASS
A fan can see score, quarter, game clock, team fouls, possession and timeouts. These are the principal live context items. Individual player fouls and shot attribution remain future Advanced-mode data.

## Soccer — PASS
A fan can immediately read goals, current half/running clock and cards. Stoppage-time and substitution detail are future depth, but the current screen does not claim to be an official match sheet.

## Football — PASS
Score, quarter/clock, possession, down and distance, and timeouts are all present. The fan review found the decision state easy to interpret without opening settings.

## Cricket — PASS
The batting team, runs/wickets, overs, run rate, target/chase information, active batters and current bowler are visible. This is richer than a generic two-number scoreboard and reads correctly to a cricket fan. Full dismissal and spell detail remains Advanced-mode work.

## Tennis — PASS
Sets, games, point score and server are visible in one broadcast-style table. Tie-break state remains in the same hierarchy, so the fan does not have to reinterpret the screen when scoring changes mode.

## Badminton — PASS
Games, rally points, serving side and service-court indicator are visible. The fan review considers this enough to follow a singles/basic doubles match without exposing scorer-only controls in Display mode.

## Lacrosse — PASS after fixes
A fan can see goals, quarter, game clock, possession, timeouts and the shot clock when the selected competition uses one. Field and Sixes are not presented as though their timing rules are identical.

The Game Journal was also corrected to preserve Q1/Q2/etc., possession and optional shot-clock context rather than falling back to a generic `Period` label.

## Kabaddi — PASS after fixes
A fan can see score, half/game clock, current raiding side, raid clock and timeouts. The team-specific All Out +2 control was integrated directly into the scoreboard implementation rather than applied later through a DOM patch. Touch/bonus points can accumulate in one raid, while tackle/empty/end-raid actions have explicit raid-ending semantics.

The Game Journal now records current half, raiding team and raid clock in captured context.

## Baseball — PASS after fixes
A baseball fan can see:
- Top/Bottom inning,
- batting side,
- B-S-O,
- R-H-E line score,
- current base occupancy.

The first fan pass found three issues and they were corrected before release:
1. the line score had been hard-coded Side B then Side A; it now follows visitor/first-batting side then home side,
2. an unplayed half-inning could appear as `0`; it now remains `·` until that side actually bats,
3. diamond base labels were rotated with their diamond buttons; labels are now kept upright.

Runner movement after hits/errors remains manual by design so the display never invents a baseball play that did not occur.

## Cross-sport finding: Display mode — FIXED
The largest fan-QC issue was not sport-specific. Fullscreen **Display** mode hid the top toolbar and sport tools, but scoring pads embedded inside several game boards could still remain visible.

v0.3.5 now hides the in-board operator pads for:
- generic team sports,
- tennis/badminton,
- cricket,
- lacrosse,
- kabaddi,
- baseball.

Baseball's occupied-base diamond remains visible in Display mode, but its base buttons become non-interactive. The result is a genuinely spectator-facing fullscreen scoreboard instead of an enlarged scorer console.

## Automated fan smoke gate
`tests/fan-qc.test.js` instantiates and mutates a representative live state for every supported sport:
- Volleyball
- Basketball
- Soccer
- Football
- Cricket
- Tennis
- Badminton
- Lacrosse
- Kabaddi
- Baseball

It verifies that each sport can still produce meaningful spectator/journal context after a representative scoring action and checks the cross-sport Display-mode control suppression.

## Remaining non-blocking depth
The fan review does not recommend delaying v0.3.5 for advanced official-stat features. Player attribution, full scorecards, lineups, substitutions, penalties and detailed event timelines belong in the later Advanced path, provided the current Quick Score remains reliable and easy to read.
