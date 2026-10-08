# Football Gold architecture and reference QC

Football Gold is the sixth sport-specific reference cycle after Volleyball, Soccer, Basketball, Badminton and Tennis.

## Product principle

Football must remain useful for a parent, coach or volunteer who only wants a fast scoreboard, while also supporting a richer connected experience later.

### Basic scorer — no account required

The default Simple mode intentionally stays small:

- both teams and scores
- quarter / overtime
- game clock
- TD +6
- FG +3
- PAT +1
- 2PT +2
- Safety +2
- correction / Undo
- period progression and finalization

No roster, yardage or field-position work is required to keep a game.

### Detailed field mode — optional, connected-ready

Detailed mode adds possession, down and distance, editable ball position, exact play yardage, negative yardage, first-down advancement, turnover on downs, attack direction, timeouts, optional player attribution, drive-event history, a visual field, and a stable webpage snapshot object.

This mode works locally/offline today. A future account/login layer can gate cloud persistence and live publishing without changing the match-state model. Do not fake authentication inside the local scorer.

## Field coordinate contract

The canonical field state uses one absolute coordinate:

- 0 = Team A goal line
- 50 = midfield
- 100 = Team B goal line

Examples: absolute 25 displays as Team A 25; absolute 50 displays as 50; absolute 78 displays as Team B 22.

`offenseDirection` is explicit: +1 means the offense drives toward Team B's end zone; -1 means it drives toward Team A's end zone. Possession changes flip the default direction, but the operator can override it.

## Webpage contract

`footballFieldSnapshot(state)` returns a serializable projection for a future live webpage: schema version, match ID, live/final state, winner, period, clock, both scores, team names/colors, possession, down, distance, situation, absolute ball spot, yard-line label, offense direction, yards to goal, goal-to-go, line-to-gain coordinate, timeouts and last play.

The future realtime backend should publish this compact snapshot rather than scraping DOM text. The website can render a field directly from `ballSpot` and `lineToGainSpot`.

## Yardage logic

- Positive yards move toward the attacking goal.
- Negative yards move backward.
- Gaining the required distance resets to first down.
- Failure before fourth down increments down and adjusts distance.
- Failed fourth down changes possession at the same physical ball spot and flips attack direction.
- Reaching the goal line does not auto-award a touchdown; the operator confirms the score.

## Player / roster design

- Roster import remains optional.
- Team setup accepts newline, comma or semicolon-delimited names.
- Roster capacity is 80 names so football-sized teams fit.
- Detailed mode exposes an optional player selector.
- Team-only scoring remains the default.
- Player attribution is stored on football score/play events.
- A future signed-in team profile can persist roster imports across games.

## Reference QC contract

Persona: Football QC Operator

Teams: Lake Erie Thunder, Cuyahoga Wolves, Brecksville Mustangs. Each uses a deterministic logo and 24-player QC roster.

Six ordered matches:

1. A → B — Detailed: start field, +4 run, +7 pass/first down, editable red-zone spot, 3rd & Goal, named TD/PAT, opponent FG, halftime timeout reset, final scorecard.
2. B → A — Basic: score/quarter/clock only; no field or player controls.
3. B → C — Detailed: 4th-and-5, +2 yard play, turnover on downs at the same spot.
4. C → B — Detailed: opposite attack direction, editable B 2-yard field position, safety.
5. C → A — Basic: regulation tie → OT1 → overtime field goal → final.
6. A → C — Detailed: midfield placement, named 15-yard pass and final field state.

Expected screenshots:

1. 01-football-detailed-setup.png
2. 02-football-live-start-field.png
3. 03-football-drive-yardage.png
4. 04-football-red-zone-goal.png
5. 05-football-final-scoreboard.png
6. 06-football-basic-final.png
7. 07-football-turnover-on-downs.png
8. 08-football-opposite-direction-safety.png
9. 09-football-overtime-final.png
10. 10-football-midfield-named-final.png

Plus football-qc-report.csv.

## Visual gate

Do not lock Football based on automation alone. Verify both teams/scores together, Basic mode without clutter, Detailed field within phone width, ball marker matches yard-line text, first-down line is distinct, possession/direction are understandable, down-and-distance is prominent, final state hides scoring/play controls, full scorecard is readable, and no navigation overlay blocks the scorer.

## Local run

From the project root:

    powershell -ExecutionPolicy Bypass -File .\tools\run-football-qc.ps1

After a successful native sync, -SkipSync may be used when only native-test code changed.

The runner inherits the hardened Windows preflight from Tennis: Java 21 detection, Android SDK detection, ANDROID_HOME / ANDROID_SDK_ROOT, automatic android/local.properties, Capacitor generated-file recovery, stale artifact cleanup, and artifact pull after failure.