# Scoreboard Studio

A mobile-first, installable multi-sport scoreboard for coaches, players, parents, school teams, pickup games and small tournaments.

## Supported sports

- **Volleyball** — rally scoring, sets won, serving indicator, best-of-3 / best-of-5, regular and deciding-set targets, win-by margin.
- **Basketball** — +1 / +2 / +3 scoring, four quarters, countdown clock, team fouls.
- **Soccer** — goals, two halves, count-up clock, yellow/red card counters.
- **American football** — touchdown, field goal, PAT, two-point conversion and safety scoring; four quarters; possession and down/distance.
- **Cricket** — runs, wickets, legal balls, overs, wides, no-balls, first/second innings and chase target; T20, ODI and custom overs.

## Live-game UX

- Large one-tap scoring controls
- Team names, colors and uploaded logos
- Undo last action
- Swap team sides
- Full-screen spectator/display mode
- Screen Wake Lock when supported
- Automatic local save and recovery after refresh/restart
- Offline PWA support
- Keyboard shortcuts: `Space` clock start/pause, `F` display mode, `Ctrl/Cmd+Z` undo

## Run locally

This is a static app with no runtime dependencies. For service-worker/PWA behavior, serve the folder over HTTP rather than opening `index.html` directly.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Test

Requires Node.js 20+.

```bash
npm test
npm run check
```

## GitHub Pages

The included Pages workflow deploys the static project from `main`. In the repository settings, set **Pages → Source** to **GitHub Actions** once, then pushes to `main` deploy automatically.

## Design principle

The app intentionally separates **sport scoring rules** from **competition-format settings**. League, school, club and youth formats can differ, so the scoreboard uses sensible defaults while keeping period lengths, set format and cricket overs configurable.

## Roadmap ideas

- Game history with export/share summary
- Remote-controller mode (phone controls a tablet/TV scoreboard)
- Optional sound/buzzer and end-of-period horn
- Tournament mode with saved team profiles/logos
- Volleyball rotation/timeout/substitution tracking
- Basketball possession arrow and timeout counters
- Soccer stoppage-time and penalty shootout mode
- Football timeout counters and configurable down/distance presets
- Cricket extras breakdown, striker/bowler names and scorecard export
- OBS/browser-source display URL for streaming
