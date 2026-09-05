# Cricket Gold Gate — Product and QC Specification

Status: working specification for `feature/cricket-gold-qc`

This document defines the first sport-by-sport hardening gate for Scorer. Cricket is the reference sport. The same discipline will later be applied to each supported sport.

## 1. Core product rule

A saved team is a persistent team identity, not a one-match setup form.

Once a team is saved, Scorer must preserve its stable team id, name, logo, color and sport association across app restarts and future matches. The user must not need to save the team again simply to reuse it.

Roster membership is mutable child data of that saved team. The user must be able to add and remove players without recreating or re-saving the whole team. Roster edits must preserve the existing team id, name, logo and color. Historical matches must keep their own match snapshot and must not be rewritten when the current team roster changes.

For Cricket, roster order is meaningful because it seeds batting/bowling choices. The UI should preserve list order and may offer simple reorder controls once add/remove is stable.

## 2. Saved-team / roster acceptance

Required behavior:

- Save a cricket team once with a name and logo.
- Close/relaunch Scorer and find the same team in Saved teams.
- Select it and recover the same name, logo, color and roster.
- Add a player from a dedicated roster-management interaction.
- Remove a player from the roster.
- Persist the roster edit automatically to the selected saved team without asking the user to press Save team again.
- Keep the same team id and logo after roster edits.
- Prevent blank player names and collapse exact duplicate names.
- A deleted player may disappear from future lineups but must remain in historical scorecards for matches in which that player participated.
- Team deletion remains an explicit separate action.

## 3. Cricket scoring data needed for a trustworthy full scorecard

The engine is authoritative; the scorecard must never fabricate untracked fields.

Minimum batting data per batter:

- batter name
- runs
- balls
- fours
- sixes
- strike rate
- out / not-out status
- dismissal type
- bowler for bowler-credited dismissals
- fielder when captured for caught/run-out/stumped style dismissals

Minimum innings data:

- total runs
- wickets
- legal balls / overs
- run rate
- overs limit when applicable
- extras broken down by wides, no-balls, byes and leg-byes when those actions are supported
- fall of wickets
- current partnership
- target / runs needed / balls remaining during a chase
- yet-to-bat players derived from the saved match roster

Minimum bowling data per bowler:

- overs
- maidens when derivable
- runs conceded
- wickets credited to bowler
- economy
- dot balls
- wides
- no-balls

If a value is not tracked or cannot be derived reliably, display `—` or omit the field rather than inventing it.

## 4. Full Cricket scorecard presentation

The Full scoreboard action remains available from the live game.

Recommended hierarchy:

1. Match / innings header: teams, innings state, current score, overs, run rate or chase equation.
2. Batting card: Batter | Dismissal | R | B | 4s | 6s | SR.
3. Extras and Total rows.
4. Yet to bat.
5. Fall of wickets.
6. Bowling card: Bowler | O | M | R | W | Econ | 0s | WD | NB.
7. For innings two, keep the first innings available above/below in the same scorecard so the receiver/scorer can understand the match state.

Current batters should be visually distinguishable and marked not out. The UI should remain usable on a phone without shrinking text into an unreadable desktop table; horizontal table scrolling is acceptable where necessary.

## 5. Cricket share-message standard

The share message must be understandable when pasted into WhatsApp, Messages/SMS or any native share target without requiring the recipient to open Scorer.

### Live first innings

Example:

🏏 LIVE • India vs Pakistan
India batting • 65/3 (12.0 ov)
Kohli 28* (24) • Rahul 12* (10)
RR 5.42 • Shaheen bowling
Shared from Scorer

### Live chase

Example:

🏏 LIVE • Pakistan vs India
Pakistan 121/4 (15.2 ov) • chasing 168
Babar 52* (39) • Rizwan 21* (15)
Need 47 from 28 • RRR 10.07
Shared from Scorer

### Innings break

Example:

🏏 INNINGS BREAK • India vs Pakistan
India 167/6 (20.0 ov)
Pakistan need 168 to win
Shared from Scorer

### Final

Example:

🏏 FINAL • India vs Pakistan
India 167/6 (20.0 ov)
Pakistan 154/8 (20.0 ov)
India won by 13 runs
Shared from Scorer

Share rules:

- Always include both teams.
- Always state LIVE / INNINGS BREAK / FINAL or equivalent phase.
- While live, state who is batting or make it unmistakable from the score line.
- Include score and overs.
- Include both current batters when an innings is live.
- During a chase, prefer target/need/balls and required run rate over generic run-rate text.
- A live first innings may include current run rate and current bowler.
- Do not include stale current-batter/current-bowler data at innings break or final.
- Keep the default message compact enough to scan in a messaging notification preview; the full scorecard remains the detailed surface.

## 6. Cricket automated QC harness

### A. Team-library persistence tests

Deterministic test fixture: India, saved cricket team, stable id, logo data URL, ordered 11-player roster.

Assert:

- create/save returns stable identity;
- reload/read returns same name/logo/color/roster;
- adding one player changes roster only;
- removing one player changes roster only;
- team id/name/logo stay unchanged;
- duplicates and blank names are rejected/normalized;
- sport-scoped saved teams do not leak into another sport.

### B. Cricket engine tests

Use a deterministic T20 innings with named batters and bowlers. Include singles, boundaries, a wide, a no-ball, wickets, run-out, over completion and bowler change.

Assert:

- score, wickets and legal-ball count after every action;
- wides/no-balls do not increment legal-ball count;
- strike changes correctly on odd runs and over end;
- wicket brings the correct next batter;
- run-out does not credit bowler wicket;
- consecutive-over bowler restriction remains intact;
- per-batter card is correct;
- per-bowler figures are correct;
- innings transition target is first-innings total + 1;
- chase completion and final result are correct.

### C. Full-scorecard contract tests

Given a deterministic state, assert semantic output contains:

- both team names;
- innings label and score/overs;
- every batter who batted;
- dismissal text captured by the engine;
- R/B/4s/6s/SR headings;
- Extras and Total;
- Yet to bat;
- Fall of wickets;
- bowling O/M/R/W/Econ and, once tracked, 0s/WD/NB;
- both innings after the chase starts;
- target/chase context;
- no fabricated values for unsupported statistics.

### D. Share-message snapshot tests

Lock deterministic exact/near-exact messages for:

- live first innings;
- live chase;
- innings break;
- final by runs;
- final by wickets;
- tie if supported.

Assert each message contains both teams, phase, score/overs and the appropriate live/chase/final context. Assert break/final messages omit stale batter/bowler state.

### E. Packaged Android WebView acceptance

Add a Cricket-specific Android instrumentation smoke test using the same packaged-WebView approach already used by notification QC.

The instrumentation test should:

- launch the packaged Capacitor app;
- select Cricket;
- load/create deterministic teams and rosters;
- start a match;
- execute representative scoring actions;
- open Full scoreboard;
- verify the expected scorecard sections are present in the packaged UI;
- verify the score-share control is present and enabled.

Do not automate sending a real WhatsApp message in CI. The exact share text belongs in deterministic JavaScript tests; native-share-sheet presence is a packaged/manual acceptance item.

## 7. Release gate

Cricket is not considered Gold Gate complete until:

- all existing regression tests still pass;
- all new Cricket unit/contract tests pass;
- packaged Android Cricket instrumentation passes on the supported QC emulator matrix;
- manual phone acceptance confirms saved-team reuse, roster add/remove, full scorecard readability and WhatsApp/native sharing;
- no permanent app identity, signing or Play publication boundary is changed.

Only after Cricket passes this gate should the same sport-specific review pattern move to the next sport.
