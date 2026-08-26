# Scorer

Scorer is a mobile-first, installable multi-sport scoreboard from Brecksville Labs. Version 0.2 replaces the original generic two-column approach with sport-specific scoreboards designed around what a coach, scorer, player or spectator actually needs to see.

## Sports

- Volleyball
- Basketball
- Soccer
- American football
- Cricket
- Tennis
- Badminton

## v0.2 highlights

- Dedicated cricket scorecard with the batting team as the visual hero
- Current striker/non-striker, runs, balls, boundaries and strike rate
- Current bowler, overs, runs, wickets and economy
- Roster entry by hand or import from `.txt` / `.csv`
- Tennis point/game/set scoring with deuce, advantage and 6-6 tie-break behavior
- Badminton rally scoring, games, server and service-court indicator
- Sport-specific control panels instead of forcing every sport into the same template
- Responsive score typography to prevent mobile overflow
- Full-screen display mode, undo, side swap, local recovery and offline PWA support

## Rules references used for the templates

- World Tennis / ITF Rules of Tennis: https://www.itftennis.com/en/about-us/governance/rules-and-regulations/
- BWF Laws of Badminton: https://corporate.bwfbadminton.com/statutes/
- ICC Playing Conditions: https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions
- FIVB Official Volleyball Rules: https://www.fivb.com/volleyball/the-game/official-volleyball-rules/
- NBA Rule No. 5, Scoring and Timing: https://official.nba.com/rule-no-5-scoring-and-timing/
- IFAB Laws of the Game: https://www.theifab.com/laws/latest/
- NFL Football Operations rulebook: https://operations.nfl.com/the-rules/nfl-rulebook/

Competition formats vary by league and age group, so Scorer keeps core scoring behavior correct while leaving common period/set/overs settings configurable.

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Test

Requires Node.js 20+.

```bash
npm run check
```

The v0.2 regression suite covers volleyball set logic, tennis deuce/advantage and tie-break entry, badminton deuce/cap behavior, cricket batter/bowler records and innings handling, basketball quarter foul reset and side swapping.

## Deployment

GitHub Actions runs CI and deploys `main` to GitHub Pages.
