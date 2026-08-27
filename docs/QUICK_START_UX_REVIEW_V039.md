# Scorer v0.3.9 — Quick Start UX review

## Goal

Reduce the cognitive and scrolling burden of starting a game without removing Scorer's advanced setup power.

The release uses progressive disclosure:

1. **Sport**
2. **Teams / Players**
3. **Format**
4. **Scoreboard**

The underlying setup fields and scoring state remain the same; v0.3.9 changes presentation and navigation rather than replacing sport logic.

## Review lenses

### Novice operator

Primary question: can a parent, fan, or volunteer who has never used Scorer start a game without understanding every configuration option?

Pass criteria:
- Only one setup decision dominates the screen at a time.
- Selecting a sport immediately advances to teams/players.
- Team names and saved-team selection are visible without opening advanced settings.
- Logo, color, roster, save/remove favorite management are optional and collapsed.
- Format choices use large tap targets rather than requiring a small select field.
- Back navigation preserves entered values.
- The scoreboard starts from the same trusted setup controls used before v0.3.9.

Finding fixed during review:
- Team-name auto-focus was removed because opening the keyboard immediately on mobile could obscure the saved-team picker.
- Favorite Save/Remove management was moved under **Customize team** so the team-name task remains visually dominant.

### Sport terminology

Quick Start does not impose one generic format chooser on every sport.

- Volleyball: Best of 3 / Best of 5.
- Basketball: quick quarter-duration choices; custom timing remains available.
- Soccer: quick half-duration choices; custom timing remains available.
- Football: quick quarter-duration choices; custom timing remains available.
- Cricket: T20 / ODI / Custom plus batting-first choice.
- Tennis: Best of 3 / Best of 5 sets.
- Badminton: Best of 3 games; advanced scoring target remains available.
- Lacrosse: Field / Sixes.
- Kabaddi: standard match preset plus first-raid choice; advanced timing remains available.
- Baseball: 6 / 7 / 9 innings plus batting-first choice.

Timing labels are intentionally league-neutral where competitions vary. Advanced options remain the source of truth for local rules.

### Mobile UX

Pass criteria:
- Sport grid uses two columns on narrow phones.
- Teams stack vertically on narrow phones.
- Advanced team and format controls remain collapsed by default.
- Quick format cards become one column on very narrow screens.
- Back / Continue / Start controls remain large touch targets.
- The setup modal behaves as a mobile bottom sheet.
- No automatic keyboard popup occurs on the Teams step.

### Existing-user / edit flow

When the gear icon is used during an existing match:
- Scorer opens on **Teams**, not the sport grid.
- Existing team and format values remain hydrated by the original app code.
- Back can still reach Sport if the operator intentionally wants to change it.
- **Apply changes** remains distinct from **Start game**.

## Regression scenarios

1. New Volleyball → choose Volleyball → enter two names → Best of 3 → Start game.
2. New Baseball → choose Baseball → enter teams → choose 6/7/9 innings → choose batting-first side → Start game.
3. New Cricket → choose Cricket → enter teams → choose T20/ODI → choose batting-first side → Start game.
4. New Lacrosse → choose Field or Sixes → verify existing dependent timing fields remain synchronized.
5. New Kabaddi → standard format → choose first raid → Start game.
6. Tennis / Badminton → confirm player/team terminology is used.
7. Saved team → select favorite without opening Customize team.
8. Advanced setup → open Customize team or Advanced match options and verify original inputs remain present.
9. Back navigation → Teams → Sport → Teams retains entered data unless the sport itself changes.
10. Existing match gear → opens at Teams and preserves current values.

## Release gate

v0.3.9 is not considered releasable until:
- syntax checks pass,
- the full pre-existing regression suite passes,
- Quick Start tests pass,
- PR-head CI passes,
- fresh main CI passes after merge,
- GitHub Pages deployment succeeds.
