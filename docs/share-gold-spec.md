# Scorer Share Gold — sport-by-sport contract

## Goal
Every shared score must stand on its own in WhatsApp, Messages, email, or any native share target. A recipient who does not have Scorer should understand the matchup, game state, score, and the most useful next-action context without opening the app.

## UX contract
- One primary `Share score` control from the live scoring screen.
- Reuse the same share action from the full scoreboard.
- Native Android uses the system share sheet so WhatsApp, Messages, and other installed apps are available without account setup.
- PWA/web uses Web Share when available and copy fallback otherwise.
- The message adapts to LIVE, BREAK/HALFTIME/INNINGS BREAK, and FINAL states.
- Do not include stale live-only information after a period, set, inning, raid, or match is over.
- Do not invent statistics the scorer does not capture.
- Keep the payload compact: normally 3–4 useful lines plus `Shared from Scorer`.

## Message hierarchy
1. Sport icon + LIVE/BREAK/FINAL + matchup.
2. Primary score + familiar phase notation.
3. Sport-specific context that tells a fan what is happening now.
4. Optional compact secondary context only when it materially improves understanding.
5. `Shared from Scorer`.

---

## 1. Cricket expert pass
Fan priority: batting side, runs/wickets, overs, current batters, chase equation or run rate/current bowler.

Live first innings:
```
🏏 LIVE • India vs Pakistan
India batting • 65/3 (12.0 ov)
Kohli 28* (24) • Rahul 12* (10)
RR 5.42 • Shaheen bowling
Shared from Scorer
```

Live chase:
```
🏏 LIVE • Pakistan vs India
Pakistan 121/4 (15.2 ov) • chasing 168
Babar 52* (39) • Rizwan 21* (15)
Need 47 from 28 • RRR 10.07
Shared from Scorer
```

Break/final: remove live batters/bowler and show target/result instead.

## 2. Volleyball expert pass
Fan priority: match sets, current set score, server, completed-set context.

```
🏐 LIVE • Eagles vs Tigers
Eagles lead 2–1 sets • Set 4: 18–16
Eagles serving • Sets 25–20, 22–25, 25–19
Shared from Scorer
```

At set break: show `Set 4 next`; do not show a stale server. Final: `Eagles won 3–1` plus set scores.

## 3. Basketball expert pass
Fan priority: score, quarter/OT, game clock, possession. Team fouls/timeouts are secondary.

```
🏀 LIVE • Eagles vs Tigers
Eagles 62–58 Tigers • Q3 4:21
Tigers ball • Fouls 3–4 • TO 2–1
Shared from Scorer
```

At halftime/end quarter: remove possession and live clock context. Final: score + winner.

## 4. Soccer expert pass
Fan priority: score and match minute/half. Cards are useful secondary context when tracked.

```
⚽ LIVE • United vs City
United 2–1 City • 67'
Cards: United 1Y/0R • City 2Y/0R
Shared from Scorer
```

Use `HALFTIME` and `FINAL` instead of stale clock context at breaks. Do not invent scorers or stoppage time when not captured.

## 5. American football expert pass
Fan priority: score, quarter, clock, down-and-distance, possession. Timeouts are secondary.

```
🏈 LIVE • Browns vs Steelers
Browns 21–17 Steelers • Q4 2:14
3rd & 7 • Steelers ball • TO Browns 2, Steelers 1
Shared from Scorer
```

At quarter end/halftime/final: remove down-and-distance and possession.

## 6. Tennis expert pass
Fan priority: sets, current-set games, current game points, server.

```
🎾 LIVE • Smith vs Jones
Smith leads 1–0 sets • Set 2: 3–4
Current game 30–15 • Jones serving
Completed sets: 6–4
Shared from Scorer
```

At set break: remove server/current point. Final: winner + final set matrix.

## 7. Badminton expert pass
Fan priority: games won, current-game rally score, server.

```
🏸 LIVE • Lee vs Patel
Lee leads 1–0 games • Game 2: 17–19
Patel serving • Completed games: 21–18
Shared from Scorer
```

At game break: remove stale server. Final: winner + game scores.

## 8. Lacrosse expert pass
Fan priority: score, quarter, clock, possession/restart, optional shot clock.

```
🥍 LIVE • Bears vs Hawks
Bears 8–7 Hawks • Q4 3:12
Possession: Bears • Shot 42 • TO Bears 1, Hawks 2
Shared from Scorer
```

For field lacrosse after a goal, `Restart pending (faceoff/draw)` is more honest than naming possession before the restart is confirmed. Sixes may show the conceding side as possession when the rules engine has already assigned it.

## 9. Kabaddi expert pass
Fan priority: score, half/game clock, current raiding team and raid clock. Pending raid points are useful only while unresolved; All Outs are strong secondary context.

```
🤼 LIVE • Panthers vs Warriors
Panthers 28–24 Warriors • 2nd half 8:31
Warriors raiding • Raid 18s • Pending +1
All Outs: Panthers 1–0 Warriors
Shared from Scorer
```

During the last raid after clock expiry, say `LAST RAID`. At halftime/final remove live raid details.

## 10. Baseball expert pass
Fan priority: visitor/home score, inning half, outs, count, baserunners. R/H/E is strong secondary context.

```
⚾ LIVE • Guardians vs Tigers
Guardians 4–3 Tigers • Bot 7
2 outs • Count 2–1 • Runners 1st & 3rd
R/H/E: Guardians 4/8/0 • Tigers 3/6/1
Shared from Scorer
```

At MID/END inning: remove count/baserunners and name who bats next. Final: score + winner; retain R/H/E.

---

## Share Gold QC
Each sport receives deterministic tests for:
- live message contains matchup + score + familiar phase notation;
- the sport-specific live context is present when valid;
- break/halftime/set-break/inning-break variants omit stale context;
- final message contains result and omits live-only fields;
- names and numeric state are rendered from actual scorer data only;
- output remains compact and standalone;
- every message ends with `Shared from Scorer`.

Android packaged QC should additionally prove that the current score is packaged into the native share flow and remains available without a network connection.