# Badminton Gold multi-preset QC

Badminton is the fourth sport-specific reference harness after Volleyball, Soccer, and Basketball.

## Presets exercised

- **BAI / BWF 3×21** — best of 3, game to 21, win by 2, cap 30.
- **India short 3×15** — best of 3, game to 15, win by 2, cap 21.
- **Quick 1×21** — one game to 21, win by 2, cap 30.
- **Club quick 1×15** — one game to 15, win by 2, cap 21.
- **Custom** remains available in setup.

The preset names distinguish the current BAI/BWF 3×21 competition baseline from the shorter 3×15 format used as an alternate/short-format option.

## Product contract

Simple mode is the default. The phone hero must keep both competitors visible together with:

- both logos/names
- games won
- current game points
- current game number/final state
- serving side
- active preset and rule summary

Detailed service view additionally shows service-court side and manual server correction. Singles and doubles are selectable.

## QC fixtures

Persona: **Badminton QC Operator**

Teams:

1. Lake Erie Racquets
2. Cuyahoga Shuttlers
3. Brecksville Smash

Each team has a deterministic logo and four-player roster so the same fixture can exercise singles and doubles.

Six ordered matchups are run:

1. A → B — BAI/BWF 3×21
2. B → A — India short 3×15
3. B → C — Quick 1×21
4. C → B — Club quick 1×15, detailed doubles
5. C → A — Quick 1×21
6. A → C — India short 3×15

The first four are the visual preset tour.

## Expected screenshots

1. 01-badminton-bai-3x21-setup.png
2. 02-badminton-bai-3x21-live.png
3. 03-badminton-bai-3x21-final.png
4. 04-badminton-india-3x15-live.png
5. 05-badminton-india-3x15-final.png
6. 06-badminton-quick-1x21-final.png
7. 07-badminton-club-1x15-doubles-live.png
8. 08-badminton-club-1x15-doubles-final.png
9. 09-badminton-c-vs-a-final.png
10. 10-badminton-a-vs-c-final.png

Report: `badminton-qc-report.csv`

## Local emulator run

From the project root after native assets are synced:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-badminton-qc.ps1 -SkipSync
```

If web assets changed since the last sync, omit `-SkipSync`.
