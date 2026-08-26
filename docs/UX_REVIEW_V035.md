# Scorer v0.3.5 — Whole-app UX review

This is a full-app UX review after the Lacrosse, Kabaddi and Baseball additions and the ten-sport fan QC. The review focuses on the scorer's real job: make correct changes quickly on a phone while still being able to show a clean spectator scoreboard.

## Review criteria

The audit covered:
- information hierarchy,
- thumb/touch operation,
- setup complexity,
- correction and recovery,
- sport-specific terminology,
- mobile responsiveness,
- Display mode,
- favorites/reusable teams,
- Match History and Game Journal,
- accessibility/noise,
- offline/PWA behavior.

## 1. Information hierarchy — PASS

The app continues to put the live decision state ahead of secondary data. The largest typography is reserved for the live score or the sport's equivalent state. Sport-specific screens do not force one generic two-card model onto cricket, racket sports, lacrosse, kabaddi or baseball.

Baseball follows the same principle by putting Top/Bottom inning, B-S-O and R-H-E ahead of detailed scorebook data.

## 2. Mobile setup with ten sports — PASS

The setup modal already has a bounded viewport height and internal scrolling. The sport picker changes from four columns to three and then two columns on narrow screens, while team setup collapses to one column. The sticky mobile footer keeps New Match / Start Scoreboard reachable after the sport catalog grew to ten entries.

No separate nested sport menu is recommended yet; ten visible choices remain faster to scan than an extra category drill-down.

## 3. Touch targets — FIXED

The primary score controls already use large targets. The UX pass found some compact mobile icon/favorite buttons could fall below the preferred touch-target floor. v0.3.5 adds a 44px mobile minimum for those controls through the release stylesheet.

## 4. Correction / recovery — PASS

Global Undo remains visible at the top level and each sport uses direct correction controls where an accidental tap is common. Baseball adds Run -1, Hit -1 and Error -1 in its secondary tools while keeping the primary pad focused on live actions.

The review recommends retaining Undo as a permanent product principle as Advanced scoring grows.

## 5. Baseball operator flow — PASS after fixes

The baseball coach/UX review deliberately avoids automatic runner guesses after hits/errors. The scorer can touch the diamond directly, while Walk/HBP applies only deterministic force movement.

The first fan/UX pass also corrected:
- visitor/home line-score order,
- unplayed half-innings appearing as zeros,
- rotated base labels,
- baseball-specific Game Journal context.

An explicit End half-inning control supports youth/local run-limit scenarios without putting league-specific rules into every game.

## 6. Display mode — FIXED, cross-sport

The most important UX finding was that fullscreen Display mode hid the top operator chrome but could leave in-board scoring controls visible for several sports.

v0.3.5 now suppresses operator scoring pads in Display mode across generic team sports, racket sports, cricket, lacrosse, kabaddi and baseball. Baseball's diamond remains visible as useful spectator state but becomes non-interactive.

This restores a clear product distinction:
- normal mode = scorer/operator,
- Display mode = spectator/read-only presentation.

## 7. Favorite teams — FIXED regression

The audit traced the reusable-team logo path and found the enhancement layer no longer held references to `inputLogoA` / `inputLogoB`. That meant a saved favorite could show its logo in the setup preview while the synthetic file-input event used to synchronize the live match logo silently fell into its fallback path.

The input references are restored. Name, color, roster and logo now share the intended reusable-team path again, subject to the existing browser fallback for platforms that block programmatic `DataTransfer` assignment.

## 8. Match History / Game Journal — FIXED consistency issues

History still knew the original seven sport display names but newer sports could appear as raw lowercase IDs. v0.3.5 adds proper Lacrosse, Kabaddi and Baseball display labels.

Journal snapshots now keep sport-specific context:
- Lacrosse: quarter, clock, possession and shot clock when enabled,
- Kabaddi: half, clock, raiding team and raid timer,
- Baseball: Top/Bottom inning, B-S-O, H and E.

That is especially important because photos are intended to preserve what was happening at the moment of capture rather than only a final score.

## 9. Accessibility / announcement noise — FIXED

The entire dynamically rebuilt game surface had `aria-live="polite"`. Because the whole board re-renders after scoring actions, this could cause excessive screen-reader announcements.

v0.3.5 removes the live-region behavior from the full board and keeps the dedicated `role="status"` toast as the concise feedback channel.

The review recommends a later dedicated accessibility pass for keyboard focus order and color-contrast measurement, but no release-blocking accessibility regression was identified in this scope.

## 10. Offline / local-first behavior — PASS by design

Baseball modules are included in the service-worker cache together with the existing scoring engine. Lacrosse, Kabaddi and Baseball continue to use local match state and ordered local events; this release does not create a dependency on the future ScorerHub backend.

## 11. Architecture / maintainability — IMPROVED

Kabaddi's team-specific All Out UI had temporarily been applied through a post-render MutationObserver patch. During this audit that UI was integrated into the actual renderer and the obsolete patch script was removed from the page, service worker and QC path.

This reduces hidden UI mutation and makes fan/operator behavior easier to reason about before v0.4.

## UX release recommendation

Proceed with v0.3.5 once the complete automated suite and branch CI execute successfully. The remaining product ideas—advanced baseball scorebook, player attribution, richer penalties/substitutions, and cloud spectator sync—should not be mixed into this pre-v0.4 release unless QC finds a regression.

## CI retrigger note

GitHub-hosted runners resumed after the review was completed. This documentation-only touch intentionally retriggers the branch CI so the final reviewed v0.3.5 head is validated by the complete automated suite before merge.
