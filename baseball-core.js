export const BASEBALL_SPORT_DEF = { id: 'baseball', name: 'Baseball', icon: '⚾', periodLabel: 'Inning', hasClock: false, clockMode: 'none', defaultMinutes: 0 };

export const BASEBALL_RULE_PROFILE = {
  baseline: 'Configurable baseball quick scoring for 6, 7 or 9 inning games',
  simple: ['inning half', 'runs', 'hits', 'errors', 'balls', 'strikes', 'outs', 'bases'],
  advanced: ['lineups', 'pitch count', 'play-by-play', 'RBI', 'pitcher/batter stats', 'official scorer rulings'],
  defaults: { innings: 9, ballsForWalk: 4, strikesForOut: 3, outsPerHalf: 3 }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function teamKey(side) { return side === 'B' ? 'teamB' : 'teamA'; }
function otherSide(side) { return side === 'A' ? 'B' : 'A'; }

function appendEvent(next, type, details = {}) {
  if (!Array.isArray(next.events)) next.events = [];
  next.eventSeq = Number(next.eventSeq || 0) + 1;
  next.events.push({
    id: `${next.matchId || 'match'}-e${next.eventSeq}`,
    seq: next.eventSeq,
    type,
    sport: 'baseball',
    period: next.baseball?.inning || next.period || 1,
    at: Date.now(),
    ...details
  });
  if (next.events.length > 5000) next.events = next.events.slice(-5000);
}

function inningSlot(next, side) {
  const b = next.baseball;
  const list = b.runsByInning[side];
  while (list.length < b.inning) list.push(null);
  if (list[b.inning - 1] == null) list[b.inning - 1] = 0;
  return list;
}

function resetCount(next) {
  next.baseball.balls = 0;
  next.baseball.strikes = 0;
}

function resetHalf(next) {
  resetCount(next);
  next.baseball.outs = 0;
  next.baseball.bases = { first: false, second: false, third: false };
}

function finish(next, side, reason) {
  next.finished = true;
  next.winner = side;
  next.baseball.matchWinner = side;
  appendEvent(next, 'baseball.game_finished', { winner: side, reason, scoreA: next.teamA.score, scoreB: next.teamB.score });
}

export function createBaseballState(options = {}, baseCreateInitialState) {
  const innings = Math.max(1, Number(options.baseballInnings || 9));
  const firstBat = options.baseballFirstBat === 'A' ? 'A' : 'B';
  const next = baseCreateInitialState({ ...options, sport: 'cricket' });
  next.sport = 'baseball';
  next.period = 1;
  next.maxPeriods = undefined;
  next.clock = { running: false, mode: 'none', periodSeconds: 0, seconds: 0, targetSeconds: 0 };
  next.teamA.score = 0;
  next.teamB.score = 0;
  next.baseball = {
    inning: 1,
    half: 'top',
    regulationInnings: innings,
    firstBat,
    homeSide: otherSide(firstBat),
    battingTeam: firstBat,
    balls: 0,
    strikes: 0,
    outs: 0,
    hits: { A: 0, B: 0 },
    errors: { A: 0, B: 0 },
    runsByInning: { A: [], B: [] },
    bases: { first: false, second: false, third: false },
    matchWinner: null
  };
  // Only the half-inning currently in progress receives a 0. Future/unplayed
  // halves remain null so the line score can show a neutral dot instead of a
  // misleading zero.
  inningSlot(next, firstBat);
  next.updatedAt = Date.now();
  return next;
}

export function getBaseballPeriodText(state) {
  const b = state?.baseball;
  if (!b) return 'Inning';
  return `${b.half === 'bottom' ? 'Bot' : 'Top'} ${b.inning}`;
}

export function baseballRun(state, delta = 1) {
  const next = clone(state);
  const b = next.baseball;
  if (next.sport !== 'baseball' || !b || next.finished) return next;
  const side = b.battingTeam;
  const list = inningSlot(next, side);
  const current = Number(list[b.inning - 1] || 0);
  const requested = Number(delta || 0);
  const actual = requested < 0 ? -Math.min(current, next[teamKey(side)].score, Math.abs(requested)) : requested;
  if (!actual) return next;
  list[b.inning - 1] = current + actual;
  next[teamKey(side)].score = Math.max(0, Number(next[teamKey(side)].score || 0) + actual);
  appendEvent(next, actual > 0 ? 'baseball.run' : 'baseball.run_corrected', { side, delta: actual, inning: b.inning, half: b.half, scoreA: next.teamA.score, scoreB: next.teamB.score });

  if (actual > 0 && b.half === 'bottom' && b.inning >= b.regulationInnings) {
    const home = b.homeSide;
    const away = otherSide(home);
    if (next[teamKey(home)].score > next[teamKey(away)].score) finish(next, home, 'walkoff');
  }
  next.updatedAt = Date.now();
  return next;
}

export function baseballHit(state, delta = 1) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball || next.finished) return next;
  const side = next.baseball.battingTeam;
  next.baseball.hits[side] = Math.max(0, Number(next.baseball.hits[side] || 0) + Number(delta || 0));
  if (delta > 0) resetCount(next);
  appendEvent(next, delta >= 0 ? 'baseball.hit' : 'baseball.hit_corrected', { side, delta: Number(delta || 0), hits: next.baseball.hits[side] });
  next.updatedAt = Date.now();
  return next;
}

export function baseballError(state, delta = 1) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball || next.finished) return next;
  const side = otherSide(next.baseball.battingTeam);
  next.baseball.errors[side] = Math.max(0, Number(next.baseball.errors[side] || 0) + Number(delta || 0));
  if (delta > 0) resetCount(next);
  appendEvent(next, delta >= 0 ? 'baseball.error' : 'baseball.error_corrected', { side, delta: Number(delta || 0), errors: next.baseball.errors[side] });
  next.updatedAt = Date.now();
  return next;
}

function addOut(next, reason = 'out') {
  const b = next.baseball;
  b.outs = Math.min(3, Number(b.outs || 0) + 1);
  resetCount(next);
  appendEvent(next, 'baseball.out', { side: b.battingTeam, reason, outs: b.outs, inning: b.inning, half: b.half });
  if (b.outs >= 3) return advanceBaseballHalf(next, 'three-outs');
  return next;
}

function awardFirstBase(next, reason) {
  const b = next.baseball;
  const bases = b.bases;
  if (bases.first) {
    if (bases.second) {
      if (bases.third) {
        const scoringSide = b.battingTeam;
        const list = inningSlot(next, scoringSide);
        list[b.inning - 1] = Number(list[b.inning - 1] || 0) + 1;
        next[teamKey(scoringSide)].score += 1;
        appendEvent(next, 'baseball.run', { side: scoringSide, delta: 1, reason: `${reason}-forced`, inning: b.inning, half: b.half, scoreA: next.teamA.score, scoreB: next.teamB.score });
      }
      bases.third = true;
    }
    bases.second = true;
  }
  bases.first = true;
  resetCount(next);
  appendEvent(next, `baseball.${reason}`, { side: b.battingTeam, bases: { ...bases } });

  if (b.half === 'bottom' && b.inning >= b.regulationInnings) {
    const home = b.homeSide;
    const away = otherSide(home);
    if (next[teamKey(home)].score > next[teamKey(away)].score) finish(next, home, 'walkoff');
  }
  return next;
}

export function baseballPitch(state, action) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball || next.finished) return next;
  const b = next.baseball;
  if (action === 'ball') {
    b.balls += 1;
    appendEvent(next, 'baseball.ball', { side: b.battingTeam, balls: b.balls, strikes: b.strikes });
    if (b.balls >= 4) awardFirstBase(next, 'walk');
  } else if (action === 'strike') {
    b.strikes += 1;
    appendEvent(next, 'baseball.strike', { side: b.battingTeam, balls: b.balls, strikes: b.strikes });
    if (b.strikes >= 3) return addOut(next, 'strikeout');
  } else if (action === 'foul') {
    if (b.strikes < 2) b.strikes += 1;
    appendEvent(next, 'baseball.foul', { side: b.battingTeam, balls: b.balls, strikes: b.strikes });
  }
  next.updatedAt = Date.now();
  return next;
}

export function baseballPlateAppearance(state, action) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball || next.finished) return next;
  if (action === 'out') return addOut(next, 'manual');
  if (action === 'walk') return awardFirstBase(next, 'walk');
  if (action === 'hbp') return awardFirstBase(next, 'hbp');
  return next;
}

export function toggleBase(state, base) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball || !['first','second','third'].includes(base)) return next;
  next.baseball.bases[base] = !next.baseball.bases[base];
  appendEvent(next, 'baseball.base_state', { base, occupied: next.baseball.bases[base], bases: { ...next.baseball.bases } });
  next.updatedAt = Date.now();
  return next;
}

export function clearBaseballBases(state) {
  const next = clone(state);
  if (next.sport !== 'baseball' || !next.baseball) return next;
  next.baseball.bases = { first: false, second: false, third: false };
  appendEvent(next, 'baseball.bases_cleared');
  next.updatedAt = Date.now();
  return next;
}

export function advanceBaseballHalf(state, reason = 'manual') {
  const next = clone(state);
  const b = next.baseball;
  if (next.sport !== 'baseball' || !b || next.finished) return next;
  const home = b.homeSide;
  const away = otherSide(home);
  appendEvent(next, 'baseball.half_ended', { inning: b.inning, half: b.half, reason, scoreA: next.teamA.score, scoreB: next.teamB.score });

  if (b.half === 'top') {
    if (b.inning >= b.regulationInnings && next[teamKey(home)].score > next[teamKey(away)].score) {
      finish(next, home, 'home-leading-after-top');
      next.updatedAt = Date.now();
      return next;
    }
    b.half = 'bottom';
    b.battingTeam = home;
    inningSlot(next, home);
  } else {
    if (b.inning >= b.regulationInnings && next.teamA.score !== next.teamB.score) {
      const winner = next.teamA.score > next.teamB.score ? 'A' : 'B';
      finish(next, winner, 'completed-inning');
      next.updatedAt = Date.now();
      return next;
    }
    b.inning += 1;
    next.period = b.inning;
    b.half = 'top';
    b.battingTeam = b.firstBat;
    inningSlot(next, b.firstBat);
  }
  resetHalf(next);
  appendEvent(next, 'baseball.half_started', { inning: b.inning, half: b.half, battingTeam: b.battingTeam });
  next.updatedAt = Date.now();
  return next;
}

export function swapBaseballSides(state, baseSwapSides) {
  const next = baseSwapSides(state);
  if (next.sport !== 'baseball' || !next.baseball) return next;
  const flip = value => value === 'A' ? 'B' : value === 'B' ? 'A' : value;
  const b = next.baseball;
  b.firstBat = flip(b.firstBat);
  b.homeSide = flip(b.homeSide);
  b.battingTeam = flip(b.battingTeam);
  b.matchWinner = flip(b.matchWinner);
  b.hits = { A: b.hits.B, B: b.hits.A };
  b.errors = { A: b.errors.B, B: b.errors.A };
  b.runsByInning = { A: b.runsByInning.B, B: b.runsByInning.A };
  next.updatedAt = Date.now();
  return next;
}
