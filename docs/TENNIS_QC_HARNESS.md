# Tennis Gold reference QC

Tennis is the fifth sport-specific Gold/reference harness after Volleyball, Soccer, Basketball, and Badminton.

## Rules basis

The 2026 ITF Rules of Tennis use tie-break sets and permit best-of-3 or best-of-5 matches. Approved alternative methods include No-Ad scoring and 7- or 10-point match tie-breaks. World Tennis Tour doubles uses No-Ad scoring and a 10-point match tie-break in place of the deciding set.

## Presets exercised

- **Standard · best of 3** — Advantage scoring, tie-break at 6-6, tie-break to 7 by 2.
- **No-Ad · best of 3** — deciding point at 40-40.
- **Doubles · match tie-break 10** — No-Ad first two sets; at one set all, a 10-point match tie-break replaces the deciding set.
- **Standard · best of 5** — Advantage scoring; first to three sets.
- **Custom** remains available in setup.

## Product contract

Simple mode is the default. The phone hero must keep both sides visible together with:

- both logos/names
- sets won
- current-set games
- current point score
- serving side
- active preset and rule summary

Detailed service view additionally exposes manual server correction and explains tie-break service rotation. Singles and Doubles are selectable.

## QC fixtures

Persona: **Tennis QC Operator**

Teams:

1. Lake Erie Aces
2. Cuyahoga Baseliners
3. Brecksville Ralliers

Each team has a deterministic logo and four-player roster.

Six ordered matchups:

1. A → B — Standard best-of-3, including deuce/advantage and deciding-set tie-break
2. B → A — No-Ad best-of-3 with explicit 40-40 deciding point
3. B → C — Doubles No-Ad + deciding 10-point match tie-break
4. C → B — Standard best-of-5
5. C → A — Standard best-of-3
6. A → C — No-Ad doubles display

## Expected screenshots

1. 01-tennis-standard-3-setup.png
2. 02-tennis-standard-deuce-live.png
3. 03-tennis-standard-tiebreak-final.png
4. 04-tennis-no-ad-deciding-point.png
5. 05-tennis-no-ad-final.png
6. 06-tennis-doubles-match-tiebreak-live.png
7. 07-tennis-doubles-match-tiebreak-final.png
8. 08-tennis-standard-5-final.png
9. 09-tennis-c-vs-a-final.png
10. 10-tennis-a-vs-c-final.png

Report: `tennis-qc-report.csv`

## Local emulator run

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-tennis-qc.ps1
```

The runner locates Java 21 automatically, regenerates missing Capacitor Android files when necessary, clears stale Tennis QC artifacts, runs the dedicated instrumentation test, and pulls the screenshots/report.

After a successful native sync, `-SkipSync` may be used:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-tennis-qc.ps1 -SkipSync
```
