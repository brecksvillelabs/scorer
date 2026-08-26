# Scorer v0.3.6 — Game Diary

Game Diary turns the existing Match Album into a chronological, score-stamped story of the game without adding friction to live scoring.

## During the game

The scorer can open the diary and use one lightweight composer:

- **Add photo** — saves the camera/image with the current score and sport-specific game context.
- **Save note** — saves a text-only moment with the same automatic score/context stamp.
- **⭐ Highlight this moment** — marks either the next photo or note for easier recap/story use later.

The scorer never types the score into the diary.

## Automatic context

Diary moments reuse `matchContext(state)`, so the stamp is specific to the sport. Examples:

- Volleyball: set + live score.
- Basketball / football / soccer: period and clock.
- Cricket: runs/wickets and overs.
- Tennis / badminton: games/sets/points.
- Lacrosse: quarter, game clock, possession and shot clock when enabled.
- Kabaddi: half, game clock, raiding side and raid clock.
- Baseball: Top/Bottom inning, B-S-O, hits and errors.

## After the game

The same Game Diary remains available from Match History / Games Log and renders:

1. Game started.
2. Photos and notes in chronological order.
3. Score/context stamp on every saved moment.
4. Highlighted moments with a visible star treatment.
5. FINAL result once the match is complete.

Existing v0.3.x photos remain compatible and appear in the diary automatically.

## Storage and privacy

- Photos remain local in the existing IndexedDB photo store.
- Text notes and highlight metadata are local-only in `scorer-game-diary-v1`.
- No diary content is uploaded in v0.3.6.
- Diary metadata is cleaned against the active match and saved Match History so deleted games do not leave text/highlight metadata behind after reload.

## Future Connected Scorer use

The diary data model is intentionally compatible with the future ScorerHub direction. A later release can add explicit sharing/export and deterministic or AI-assisted Game Recaps without changing how a scorer captures moments during a game.
