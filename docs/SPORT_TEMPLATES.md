# Scorer v0.2 — Sport Expert + UX Review

This document is the product-manager synthesis of seven sport-specific reviews plus a mobile UX review. The rule layer and display layer are intentionally separate: rules determine what is tracked; UX determines what is visually dominant.

## Cross-sport product principles

1. **The live decision gets the largest pixels.** Score, clock or innings state must be readable instantly.
2. **Never make the operator translate another sport's mental model.** Cricket is not a two-team basketball scoreboard; tennis is not a running integer score.
3. **One-tap correction is mandatory.** Undo remains globally available.
4. **Roster once, reuse during the game.** Names can be typed, pasted or imported from TXT/CSV.
5. **Mobile scoring and spectator display are different jobs.** Control density is optimized for a phone; Display mode strips controls for a larger screen.
6. **Competition formats vary.** Keep official core scoring logic, but make common league/age-group format settings configurable.

## Volleyball expert template

**Primary visual:** rally points for both teams.

**Secondary:** sets won, current set, serving team.

**Operator controls:** +1 / −1, serving state, two timeouts per set, undo.

**Rules basis:** standard rally scoring; regular sets to 25, deciding set to 15, minimum two-point margin; best-of-five is the international default. Scorer also allows best-of-three for school/club use.

**UX choice:** preserve a balanced two-team layout because both sides' live point totals matter equally.

## Basketball expert template

**Primary visual:** team scores + game clock.

**Secondary:** quarter, possession, team fouls, timeouts.

**Operator controls:** +1 FT, +2, +3, score correction, possession, fouls, timeout, quarter advance.

**Rules basis:** scoring values are universal; period length is configurable because NBA, FIBA and school levels differ.

**UX choice:** score remains dominant; administrative counters sit in chips so they are visible without competing with score.

## Soccer expert template

**Primary visual:** goals + running match clock.

**Secondary:** half, yellow/red cards.

**Operator controls:** goal correction, cards, half advance.

**Rules basis:** standard match is two 45-minute halves, but period length is configurable for youth competitions.

**UX choice:** minimal controls because soccer scoring events are infrequent; avoid visual clutter.

## American football expert template

**Primary visual:** score + quarter clock.

**Secondary:** possession and down & distance.

**Operator controls:** TD +6, FG +3, PAT +1, 2PT +2, safety +2, score correction, down/distance, possession, timeouts.

**Rules basis:** standard scoring values and four-quarter structure; clock length remains configurable for level of play.

**UX choice:** down & distance gets a center status treatment because it is the next most important live-game fact after score/time.

## Cricket expert template

**Primary visual:** **batting side only** — runs/wickets and overs. The fielding team's empty score must never consume half the screen during the first innings.

**Secondary:** run rate, target/required runs in a chase, extras and innings context.

**Batting panel:** striker and non-striker with R, B, 4s, 6s and strike rate.

**Bowling panel:** current bowler with O, R, W and economy.

**Operator controls:** dot, 1/2/3/4/6, wicket, run out, wide, no-ball, active batter/bowler selectors and innings change.

**Roster workflow:** team lists are entered once; Scorer starts the first two batters and first bowler automatically. A wicket advances to the next listed batter. At an over boundary Scorer swaps strike and prompts for the next bowler.

**Rules basis:** six legal balls per over; wides/no-balls do not consume a legal ball; limited-overs innings respect the configured over cap; second innings target is first-innings score + 1.

**UX choice:** the batting score is a single large hero, with the opponent reduced to innings context. This directly fixes the v0.1 mobile overflow and the incorrect equal-card hierarchy.

## Tennis expert template

**Primary visual:** current point score, with familiar 0 / 15 / 30 / 40 / AD notation.

**Secondary:** games, sets and server.

**Operator controls:** one point button per side, server correction, undo.

**Rules basis:** game requires four points and two-point margin; deuce/advantage supported; set normally won at six games by two; 6-6 enters a seven-point tie-break requiring a two-point margin; best-of-three or best-of-five configurable.

**UX choice:** use a broadcast-style row scoreboard rather than two giant numeric cards because three score layers (sets/games/points) must be visible simultaneously.

## Badminton expert template

**Primary visual:** current rally points.

**Secondary:** games won, server and server's right/left service court.

**Operator controls:** one rally button per side, server correction, undo.

**Rules basis:** best of three games to 21; win by two from 20-all; at 29-all, 30th point wins.

**UX choice:** share the racket-sport broadcast structure with tennis, but use plain rally points and service-court state instead of tennis point notation.

## UX review — rich, simple, sleek

- Dark navy canvas with restrained team-color accents, not full saturated team-color backgrounds.
- Large score typography uses responsive `clamp()` sizing so values cannot blow through mobile cards.
- Important information is grouped into semantic surfaces: hero, scorecard, controls, context.
- The app avoids permanent navigation bars during scoring; the scoring surface receives the viewport.
- Touch targets are at least approximately 44–54 px high.
- Mobile cricket collapses vertically: hero → batting → bowler → scoring pad → active-player controls.
- Desktop/tablet cricket uses a two-column batting/bowling detail grid while retaining a single dominant batting hero.

## Next-level extensions after v0.2 validation

- Saved team library and reusable roster profiles
- Individual basketball scorers/fouls
- Volleyball rotations/substitutions
- Soccer scorer/event timeline and penalty shootout mode
- Football drive/event log
- Full cricket scorecard, fall-of-wickets, partnerships, byes/leg-byes and bowler spell limits
- Tennis doubles serve order and no-ad / match-tiebreak competition presets
- Badminton doubles service-order assistance
- Remote-controller / second-screen mode
