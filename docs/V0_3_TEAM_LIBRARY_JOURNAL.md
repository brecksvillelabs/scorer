# Scorer v0.3 — Team Library + Game Journal

## Product goal
Make repeat matches fast to set up and preserve the story of a game without turning the live scoring screen into a social-media app.

## Favorite teams
A favorite profile stores sport, team/player name, team color, logo and roster. Favorites are sport-aware so the same school can have separate volleyball, basketball and soccer rosters. Selecting a favorite in match setup loads it immediately; saving while a favorite is selected updates it.

## Fresh sport state
Changing sports clears roster fields and active favorite selection so players from the previous sport cannot leak into the next game. New matches start with empty rosters instead of generated placeholder player names. Cricket can still display temporary Batter/Bowler labels when scoring without a roster, but those are not saved to a team profile.

## Game journal
Each new match gets a stable local match ID. Photos are compressed to JPEG and stored in IndexedDB against that match ID. The photo freezes score context at capture time—for example Set 2 · 18–16 or Bees 84/2 · 10.3 overs. Optional notes can be added.

## Match history
Match summaries are kept locally. A match can be saved manually, is saved automatically when completed, and is archived when a new match begins after scoring activity. Photo albums remain attached to the archived match.

## Storage
- Active match: localStorage
- Favorite teams: localStorage
- Match history: localStorage
- Photos: IndexedDB

No photo is uploaded to a server in v0.3.
