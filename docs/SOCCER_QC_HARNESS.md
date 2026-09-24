# Soccer reference QC harness

Soccer is the second sport-specific reference harness, built on the locked Volleyball QC architecture.

## Product shape

The live operator surface is intentionally compact:

- large team names, logos and score
- cumulative match clock
- first-half / second-half status
- one-tap Goal +1 with Goal -1 correction
- compact yellow-card and red-card counters on each team card
- global Undo for mistaken card taps
- explicit Start 2nd Half and Finish Match controls

The full scorecard carries the richer match-centre experience:

- final/live score and cumulative match minute
- half-by-half scoring
- yellow and red card totals
- chronological event timeline for goals and cards
- Share Score remains available

This keeps the sideline scoring interaction simple while preserving a familiar pro-style match report.

## QC persona and fixtures

Persona: **Soccer QC Operator**

Three saved teams, each with a deterministic logo and 18-player roster:

1. Lake Erie FC
2. Cleveland City SC
3. Brecksville United

The harness saves all three teams, reloads them from persisted favorites, verifies logos and rosters, and then runs the ordered round robin:

1. A -> B
2. B -> A
3. B -> C
4. C -> B
5. C -> A
6. A -> C

## Match journey

Each game validates a two-half, 45-minute reference format.

For every matchup:

- start with the saved teams
- verify setup is fully dismissed before scoring
- score Side A, add a yellow card to Side B
- advance to the second half
- score Side B, add a yellow to Side A
- score Side A again, add a red to Side B
- finish the match at 2-1
- verify final state and event counts
- open and validate the full Soccer scorecard
- verify Match events, Yellow card, Red card and Half-by-half content
- verify Share Score stays enabled

The first matchup also briefly runs the clock in each half and asserts the second-half display is cumulative from 45:00.

## Expected artifacts

Directory on device:

`/sdcard/Download/scorer-qc/soccer-reference`

Local runner output:

`android/qc-output/<timestamp>-soccer`

Expected files:

- `01-soccer-team-setup.png`
- `02-soccer-live-start.png`
- `03-soccer-first-half-1-0-yellow.png`
- `04-soccer-second-half-2-1-cards.png`
- `05-soccer-final-scoreboard.png`
- five final screenshots for the remaining ordered matchups
- `soccer-qc-report.csv`

Expected screenshot count: **10**.

## Local run

With an Android emulator already booted:

```powershell
.\tools\run-soccer-qc.ps1
```

After web assets have already been synchronized:

```powershell
.\tools\run-soccer-qc.ps1 -SkipSync
```

The runner auto-detects `adb` from PATH or the standard Windows Android SDK location.
