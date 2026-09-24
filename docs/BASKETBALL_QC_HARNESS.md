# Basketball reference QC harness

Basketball is the third locked-style sport harness after Volleyball and Soccer.

## Product contract

Basketball keeps the same Simple vs Detailed principle used by Soccer.

### Simple scorer — default

The live phone screen stays focused on:

- both team logos and names
- both scores in one dual-team hero
- quarter / overtime label
- game clock
- one-tap +1 free throw, +2 and +3 scoring
- score correction and Undo

No roster/player selection is required.

### Detailed scorer — optional

Detailed mode adds, without replacing the simple score controls:

- optional roster player attribution for scores and fouls
- per-player points and personal fouls
- team fouls
- timeouts
- possession
- configurable shot clock (24 / 30 / off)
- 24-second and 14-second reset controls
- full player box score
- play-by-play

A scorer may leave the player dropdown blank at any time and record only the team event.

## Match-center layout

The live hero must always keep both teams visible simultaneously on a phone:

- quarter / OT
- game clock
- optional shot clock
- team A logo/name
- team A score
- team B score
- team B logo/name

Individual team action cards are controls, not the visual scoreboard.

The full scoreboard contains:

- live/final score
- Q1-Q4 / OT line score
- team fouls
- timeouts left
- possession
- shot clock
- optional player PTS/PF tables
- play-by-play

## QC fixtures

Persona: **Basketball QC Operator**

Saved teams:

1. Lake Erie Legends
2. Cuyahoga Storm
3. Brecksville Bears

Each team has:

- deterministic Basketball logo
- 12 named players
- persisted favorite-team record
- reload verification before play

Ordered round robin:

1. A -> B
2. B -> A
3. B -> C
4. C -> B
5. C -> A
6. A -> C

## Reference game journey

QC deliberately runs **Detailed mode** so the richer path is exercised while unit coverage separately verifies Simple mode works without player attribution.

Each game runs four quarters and finishes 11-8 for Side A.

The first game additionally validates:

- 10:00 quarter clock
- 24-second shot clock
- game and shot clocks decrement together
- named +1 / +2 / +3 scoring
- named personal fouls
- team foul reset on quarter transition
- timeout usage
- possession control
- Q1 through Q4 transitions
- player points equal team totals
- full box score and play-by-play
- both teams and both scores remain visible together in the live hero
- Home / setup / navigation overlays do not cover scoring

## Expected artifacts

Device path:

`/sdcard/Download/scorer-qc/basketball-reference`

Local runner output:

`android/qc-output/<timestamp>-basketball`

Expected screenshots:

1. `01-basketball-team-setup.png`
2. `02-basketball-live-start.png`
3. `03-basketball-q1-5-2.png`
4. `04-basketball-q3-9-7.png`
5. `05-basketball-final-scoreboard.png`
6. five final live-screen screenshots for the remaining ordered matchups

Expected screenshot count: **10**.

Report:

`basketball-qc-report.csv`

## Local run

With the emulator running:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-basketball-qc.ps1
```

After assets are already synchronized:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-basketball-qc.ps1 -SkipSync
```
