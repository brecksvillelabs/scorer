# Scorer v0.3.5 — Baseball rules + coach review

This is an independent rules review followed by a coach/operator review of the Baseball Quick Score experience. These are review passes synthesized into the product; they are not persistent external agents.

## 1. Baseball rules review

### Baseline model
Scorer uses a conventional baseball scoreboard model rather than trying to become a full official scorebook in Quick Score.

The rules review centered the scoreboard on:
- inning and top/bottom half,
- runs,
- hits,
- errors,
- balls,
- strikes,
- outs,
- base occupancy.

The core count model is four balls for a walk, three strikes for a strikeout and three outs to end a half-inning. A foul ball with two strikes does not create strike three in this simplified pitch-count flow.

### Game length
The default preset is nine innings, with configurable seven-inning and six-inning options so Scorer can fit school and youth contexts without pretending every competition uses MLB timing.

The scorer explicitly selects which side bats first. Scorer treats that side as the visitor/away side for line-score ordering and the other side as home for regulation-ending logic.

### Regulation ending
Quick Score supports the fan-visible regulation behavior that matters to a scoreboard:
- if the home side is already ahead after the top of the final regulation inning, the bottom half is unnecessary;
- a go-ahead home run total in the bottom of the final or later inning ends the game as a walk-off;
- a tie after the configured regulation innings continues into extra innings.

### R-H-E
Runs, hits and errors are separate values. A run is not automatically counted as a hit, and an error belongs to the fielding side.

### Runner movement
Scorer intentionally does not infer runner movement from a hit or fielding error. Those outcomes can advance runners in many valid ways, so silently guessing would create false game state.

A walk or hit-by-pitch does apply deterministic force movement from first base. With the bases loaded, the forced runner from third scores one run.

## 2. Baseball coach/operator observation

The coach review asked a different question from the rules review: can a parent, coach, manager or volunteer scorer operate this reliably while also watching the field?

### What must be visible without thinking
The main baseball screen therefore exposes:
1. top/bottom and inning,
2. batting team,
3. B-S-O count,
4. R-H-E line score,
5. occupied bases,
6. the most common one-tap scoring actions.

### Main controls
The primary pad provides:
- Ball
- Strike
- Foul
- Out +1
- Run +1
- Hit +1
- Error +1 for the fielding side
- Walk
- HBP

The base diamond is directly tappable. This gives the scorer a fast manual correction/update path without asking the app to invent a play sequence.

### Corrections
Scorer keeps global Undo and also exposes compact baseball corrections for Run -1, Hit -1 and Error -1. The line score only allows a run correction against the current batting team's current inning total, avoiding a negative or internally inconsistent inning line.

### Youth / local-game reality
An explicit **End half-inning** action is included because youth and local competitions can use run limits, time limits or organizer-specific ending conditions. Scorer should not hard-code one league's local rule into every baseball game.

### Deliberately deferred to Advanced mode
The coach review recommends keeping these out of Quick Score for now:
- batting lineup management,
- per-player batting statistics,
- pitcher and pitch-count management,
- RBI attribution,
- detailed play-by-play and fielding notation,
- scorer judgment for hit-vs-error,
- substitutions and defensive positions.

Those are valuable future features, but putting them into the primary scoring surface would materially increase operator error and touch count.

## Sources reviewed
The review used current MLB rules/glossary material for the conventional inning/count/regulation model, current NFHS baseball rules material for school-rule awareness, and Little League rules/scorekeeping guidance for youth scoring and suspended-game state expectations.

## Connected Scorer compatibility
Every Baseball Quick Score mutation appends an ordered local event. Baseball therefore enters the same future ScorerHub synchronization path as the existing sports rather than requiring a later data-model rewrite.

## Privacy
Baseball remains local-first in v0.3.5. Scores, rosters, line-score state and Game Journal media are not uploaded by this feature.
