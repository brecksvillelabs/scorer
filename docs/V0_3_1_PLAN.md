# Scorer v0.3.1 — match completion and home flow

## Goals

- A volleyball best-of-3 match must finish immediately at 2–0 or 2–1; no extra set may start.
- Add a persistent Home action from the live scoreboard without destroying an active match.
- Home shows a Resume card when an unfinished match exists.
- Add a guarded manual End Game action for forfeits, time limits, abandonment and other real-world endings.
- Undoing the match-ending action must reopen the match.
- Completed matches should present Final state and summary actions rather than live scoring controls.

## Regression gates

- Best-of-3 volleyball 2–0 final.
- Best-of-3 volleyball 2–1 final.
- Best-of-5 volleyball does not finish at 2–0.
- Undo after automatic match completion restores an active match.
- Manual end marks the match final without corrupting the score/history.
