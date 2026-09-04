# Scorer v0.5.2 sport scorecards

Scorer v0.5.2 gives each sport a familiar live hierarchy, a fuller game summary and a share message that can stand alone in WhatsApp or SMS. The summaries show only information that Scorer actually tracks; they are game scorecards, not substitutes for an official scorer's book.

## Experience by sport

| Sport | Familiar live view | Full scorecard or summary | Shared context |
| --- | --- | --- | --- |
| Volleyball | Sets, current-set points, server and phase | Set-by-set matrix | Set, points, completed sets and server while live |
| Basketball | Score, quarter, clock, possession, fouls and timeouts | Quarter/OT line score | Period, clock and live possession context |
| Soccer | Score, half, clock and cards | Half scoring and card totals | Half/clock, score and cards |
| American football | Score, quarter, clock, down-and-distance, possession and timeouts | Quarter/OT line score | Situation and possession while live; clean final result |
| Cricket | Runs/wickets, overs, batters, bowler and chase equation | Both innings; all tracked batters, dismissals, extras, fall of wickets and bowling figures | Innings, score, overs, batters, run rate or chase equation, and result |
| Tennis | Sets, games, point and server | Set matrix with current game/point | Sets, completed-set scores, game/point and server while live |
| Badminton | Games, rally points, server and game phase | Game matrix | Games, current points and server while live |
| Lacrosse | Score, quarter, game/shot clocks, confirmed possession or restart, and named timeouts | Quarter/OT line score | Phase, clocks, possession/restart and named timeout balances |
| Kabaddi | Score, half/game/raid clocks, raiding side, pending raid points and do-or-die status | Half scoring, completed raids and recorded All Outs | Live/last-raid/halftime/final state with raiding and team summaries |
| Baseball | Visitor/home score, TOP/BOT/MID/END, count, outs and diamond | Honest visitor/home inning line with R/H/E | Phase, R/H/E, count/outs while live and who bats next at breaks |

## Correctness work included

- Set, game, inning and period breaks no longer leak stale live-only fields into final cards or messages.
- Tied basketball, football and lacrosse games can reach overtime instead of being trapped at regulation.
- Football timeouts replenish at halftime.
- A field-lacrosse goal now waits for a confirmed faceoff/draw restart; Sixes assigns the restart to the conceding team.
- Kabaddi touch points remain pending until the raider returns safely. Tackles cancel pending touches, bonuses remain independently awardable, raid expiry is adjudicated, Super Tackles are supported, and the third consecutive empty raid becomes do-or-die.
- Baseball uses visitor/home ordering, MID/END inning phases, safe zero-value corrections and an atomic home-run action that records all runs before checking for a walk-off.
- Period splits that cannot be reconciled from saved events display an em dash instead of inventing a total.

## Honest limits and later extensions

- Cricket bowling maidens are displayed as unknown when they cannot be derived. Byes, leg byes, dismissal types and partnerships can be expanded when the scoring engine captures them explicitly.
- Baseball is labelled and presented as a line score. A true player box score needs batter, pitcher, runner and play attribution that the current quick scorer does not record.
- Lacrosse player goals/assists, penalty clocks, saves, draws/faceoffs and league-specific 60/80/90-second clock resets need additional event fields and explicit rules profiles.
- Kabaddi player-on-mat/revival tracking, raider names and knockout tiebreaks need richer match state. All Out and bonus remain deliberate referee/scorer awards when eligibility is not tracked.
- Competition formats vary, so setup remains configurable and the official on-site scorer/referee remains authoritative.

## Primary rules references

- Cricket: [ICC playing conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)
- Volleyball: [FIVB Official Volleyball Rules 2025–2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf)
- Basketball: [FIBA Official Basketball Rules 2024](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf)
- Soccer: [IFAB Law 7 — The Duration of the Match](https://www.theifab.com/laws/latest/the-duration-of-the-match/)
- American football: [2026 NFL Rulebook](https://operations.nfl.com/rules-officiating/2026-nfl-rulebook)
- Tennis: [ITF Rules and Regulations](https://www.itftennis.com/en/about-us/governance/rules-and-regulations/)
- Badminton: [BWF Statutes and Laws](https://corporate.bwfbadminton.com/statutes/)
- Lacrosse: [World men's field rules 2025–2027](https://worldlacrosse.sport/wp-content/uploads/2026/01/WL_Mens-Rules_25-27_FINAL_1.1.pdf), [World women's field rules 2025–2026](https://worldlacrosse.sport/wp-content/uploads/2025/03/2025_2026-WF-Rulebook_FINALv1.1-1.pdf), and [World Sixes rules 2026–2028](https://worldlacrosse.sport/wp-content/uploads/2026/05/26-28-Sixes-Rule-Book_v2_0526.pdf)
- Kabaddi: [AKFI Rules of Kabaddi](https://www.indiankabaddi.org/rules-of-kabaddi.html) and [Pro Kabaddi rules explainer](https://www.prokabaddi.com/features/understanding-the-game-of-kabaddi)
- Baseball: [2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf)
