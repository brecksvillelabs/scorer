export const EXTRA_SPORT_DEFS = {
  lacrosse: { id: 'lacrosse', name: 'Lacrosse', icon: '🥍', periodLabel: 'Quarter', hasClock: true, clockMode: 'down', defaultMinutes: 15 },
  kabaddi: { id: 'kabaddi', name: 'Kabaddi', icon: '🤼', periodLabel: 'Half', hasClock: true, clockMode: 'down', defaultMinutes: 20 }
};

export const EXTRA_RULE_PROFILES = {
  lacrosse: {
    baseline: 'World Lacrosse field / Sixes configurable scoring',
    simple: ['goals', 'quarter', 'game clock', 'possession', 'timeouts', 'optional shot clock'],
    advanced: ['penalties', 'faceoffs/draws', 'player scoring', 'shots/saves', 'turnovers'],
    defaults: { discipline: 'field', fieldMinutes: 15, sixesMinutes: 8, sixesShotClock: 30, fieldShotClock: 0 }
  },
  kabaddi: {
    baseline: 'IKF-style rectangular-court kabaddi',
    simple: ['score', 'half', 'game clock', 'raiding team', 'raid clock', 'touch/bonus/tackle/all-out'],
    advanced: ['revivals', 'super tackles', 'do-or-die raids', 'player attribution', 'cards/substitutions'],
    defaults: { periodMinutes: 20, raidSeconds: 30, playersOnCourt: 7, allOutBonus: 2 }
  }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function teamKey(side) { return side === 'B' ? 'teamB' : 'teamA'; }
function otherSide(side) { return side === 'A' ? 'B' : 'A'; }

function appendEvent(next, type, details = {}) {
  if (!Array.isArray(next.events)) next.events = [];
  next.eventSeq = Number(next.eventSeq || 0) + 1;
  next.events.push({ id: `${next.matchId || 'match'}-e${next.eventSeq}`, seq: next.eventSeq, type, sport: next.sport, period: next.period, at: Date.now(), ...details });
  if (next.events.length > 5000) next.events = next.events.slice(-5000);
}

export function createScorerState(options, baseCreateInitialState) {
  const sport = options?.sport || 'volleyball';
  if (sport !== 'lacrosse' && sport !== 'kabaddi') return baseCreateInitialState(options);

  if (sport === 'lacrosse') {
    const discipline = options.lacrosseDiscipline === 'sixes' ? 'sixes' : 'field';
    const minutes = Number(options.periodMinutes || (discipline === 'sixes' ? 8 : 15));
    const shotClockSeconds = Number(options.lacrosseShotClock ?? (discipline === 'sixes' ? 30 : 0));
    const timeoutsPerHalf = discipline === 'sixes' ? 1 : 2;
    const next = baseCreateInitialState({ ...options, sport: 'football', periodMinutes: minutes });
    next.sport = 'lacrosse';
    next.maxPeriods = 4;
    next.clock.mode = 'down';
    next.clock.periodSeconds = minutes * 60;
    next.clock.seconds = minutes * 60;
    next.clock.targetSeconds = minutes * 60;
    next.lacrosse = {
      discipline,
      possession: options.lacrossePossession === 'B' ? 'B' : 'A',
      timeoutsPerHalf,
      timeouts: { A: timeoutsPerHalf, B: timeoutsPerHalf },
      shotClockSeconds,
      shotClock: shotClockSeconds,
      shotClockRunning: false,
      restartType: null,
      matchWinner: null
    };
    return next;
  }

  const minutes = Number(options.periodMinutes || 20);
  const raidSeconds = Math.max(5, Number(options.kabaddiRaidSeconds || 30));
  const firstRaid = options.kabaddiFirstRaid === 'B' ? 'B' : 'A';
  const next = baseCreateInitialState({ ...options, sport: 'basketball', periodMinutes: minutes });
  next.sport = 'kabaddi';
  next.maxPeriods = 2;
  next.clock.mode = 'down';
  next.clock.periodSeconds = minutes * 60;
  next.clock.seconds = minutes * 60;
  next.clock.targetSeconds = minutes * 60;
  next.kabaddi = {
    raidingTeam: firstRaid,
    firstHalfStartingRaid: firstRaid,
    raidSeconds,
    raidClock: raidSeconds,
    raidRunning: false,
    raidPoints: 0,
    pendingTouchPoints: 0,
    pendingBonusPoints: 0,
    emptyRaidStreak: { A: 0, B: 0 },
    raidsCompleted: { A: 0, B: 0 },
    timeoutsPerHalf: 2,
    timeouts: { A: 2, B: 2 },
    matchWinner: null
  };
  return next;
}

export function lacrosseGoal(state, side, delta = 1) {
  const next = clone(state);
  if (next.sport !== 'lacrosse' || !next.lacrosse) return next;
  const key = teamKey(side);
  next[key].score = Math.max(0, Number(next[key].score || 0) + Number(delta || 0));
  appendEvent(next, delta >= 0 ? 'lacrosse.goal' : 'lacrosse.score_corrected', { side, delta: Number(delta || 0), scoreA: next.teamA.score, scoreB: next.teamB.score });
  if (delta > 0 && next.lacrosse.shotClockSeconds > 0) {
    next.lacrosse.shotClock = next.lacrosse.shotClockSeconds;
    next.lacrosse.shotClockRunning = false;
  }
  if (delta > 0 && next.lacrosse.discipline === 'sixes') next.lacrosse.possession = otherSide(side);
  else if (delta > 0) {
    next.lacrosse.possession = null;
    next.lacrosse.restartType = 'faceoff/draw';
  }
  next.updatedAt = Date.now();
  return next;
}

export function setLacrossePossession(state, side) {
  const next = clone(state);
  if (next.sport !== 'lacrosse' || !next.lacrosse || !['A','B'].includes(side)) return next;
  next.lacrosse.possession = side;
  next.lacrosse.restartType = null;
  if (next.lacrosse.shotClockSeconds > 0) {
    next.lacrosse.shotClock = next.lacrosse.shotClockSeconds;
    next.lacrosse.shotClockRunning = false;
  }
  appendEvent(next, 'lacrosse.possession', { side });
  next.updatedAt = Date.now();
  return next;
}

export function lacrosseTimeout(state, side) {
  const next = clone(state);
  if (next.sport !== 'lacrosse' || !next.lacrosse || !['A','B'].includes(side)) return next;
  next.lacrosse.timeouts[side] = Math.max(0, Number(next.lacrosse.timeouts[side] || 0) - 1);
  appendEvent(next, 'lacrosse.timeout', { side, remaining: next.lacrosse.timeouts[side] });
  next.updatedAt = Date.now();
  return next;
}

export function lacrosseShotClockAction(state, action) {
  const next = clone(state);
  if (next.sport !== 'lacrosse' || !next.lacrosse || next.lacrosse.shotClockSeconds <= 0) return next;
  if (action === 'reset') {
    next.lacrosse.shotClock = next.lacrosse.shotClockSeconds;
    next.lacrosse.shotClockRunning = false;
  } else if (action === 'toggle') next.lacrosse.shotClockRunning = !next.lacrosse.shotClockRunning;
  appendEvent(next, 'lacrosse.shot_clock', { action, seconds: next.lacrosse.shotClock });
  next.updatedAt = Date.now();
  return next;
}

export function setKabaddiRaid(state, side) {
  const next = clone(state);
  if (next.sport !== 'kabaddi' || !next.kabaddi || !['A','B'].includes(side)) return next;
  ensureKabaddiState(next.kabaddi);
  next.kabaddi.raidingTeam = side;
  if (next.period === 1 && Number(next.kabaddi.raidsCompleted.A || 0) + Number(next.kabaddi.raidsCompleted.B || 0) === 0) next.kabaddi.firstHalfStartingRaid = side;
  next.kabaddi.raidClock = next.kabaddi.raidSeconds;
  next.kabaddi.raidRunning = false;
  next.kabaddi.raidPoints = 0;
  next.kabaddi.pendingTouchPoints = 0;
  next.kabaddi.pendingBonusPoints = 0;
  appendEvent(next, 'kabaddi.raid_started', { side });
  next.updatedAt = Date.now();
  return next;
}

export function kabaddiRaidClockAction(state, action) {
  const next = clone(state);
  if (next.sport !== 'kabaddi' || !next.kabaddi) return next;
  ensureKabaddiState(next.kabaddi);
  if (action === 'reset') {
    next.kabaddi.raidClock = next.kabaddi.raidSeconds;
    next.kabaddi.raidRunning = false;
  } else if (action === 'toggle') next.kabaddi.raidRunning = !next.kabaddi.raidRunning;
  appendEvent(next, 'kabaddi.raid_clock', { action, seconds: next.kabaddi.raidClock, raidingTeam: next.kabaddi.raidingTeam });
  next.updatedAt = Date.now();
  return next;
}

function ensureKabaddiState(k) {
  k.pendingTouchPoints = Number(k.pendingTouchPoints || 0);
  k.pendingBonusPoints = Number(k.pendingBonusPoints || 0);
  k.raidPoints = k.pendingTouchPoints + k.pendingBonusPoints;
  k.emptyRaidStreak ||= { A:0, B:0 };
  k.emptyRaidStreak.A = Number(k.emptyRaidStreak.A || 0);
  k.emptyRaidStreak.B = Number(k.emptyRaidStreak.B || 0);
}

function addKabaddiScore(next, side, points, type, details = {}) {
  if (!points) return;
  next[teamKey(side)].score += points;
  appendEvent(next,type,{ side, points, ...details, scoreA:next.teamA.score, scoreB:next.teamB.score });
}

function finishRaid(next, reason, defensePoints = 0) {
  const k = next.kabaddi;
  ensureKabaddiState(k);
  const current = k.raidingTeam;
  const defense = otherSide(current);
  const awardTouch = reason === 'completed' ? k.pendingTouchPoints : 0;
  const awardBonus = reason === 'completed' || reason === 'tackle' || reason === 'super-tackle' || reason === 'expired' ? k.pendingBonusPoints : 0;
  const raidAward = awardTouch + awardBonus;
  addKabaddiScore(next,current,raidAward,'kabaddi.raid_points_committed',{ touchPoints:awardTouch, bonusPoints:awardBonus, reason });

  let resolvedReason = reason;
  if (reason === 'completed' && raidAward === 0) resolvedReason = 'empty';
  if (resolvedReason === 'empty') {
    const isDoOrDie = k.emptyRaidStreak[current] >= 2;
    if (isDoOrDie) {
      addKabaddiScore(next,defense,1,'kabaddi.do_or_die_out',{ raidingTeam:current });
      resolvedReason = 'do-or-die-out';
      k.emptyRaidStreak[current] = 0;
    } else k.emptyRaidStreak[current] += 1;
  } else k.emptyRaidStreak[current] = 0;

  addKabaddiScore(next,defense,defensePoints,defensePoints === 2 ? 'kabaddi.super_tackle_point' : 'kabaddi.tackle_point',{ raidingTeam:current, reason:resolvedReason });
  k.raidsCompleted[current] = Number(k.raidsCompleted[current] || 0) + 1;
  appendEvent(next, 'kabaddi.raid_ended', {
    side: current, reason: resolvedReason, touchPoints:awardTouch, bonusPoints:awardBonus,
    defensePoints, scoreA:next.teamA.score, scoreB:next.teamB.score
  });
  k.raidingTeam = otherSide(current);
  k.raidClock = k.raidSeconds;
  k.raidRunning = false;
  k.raidPoints = 0;
  k.pendingTouchPoints = 0;
  k.pendingBonusPoints = 0;
}

function parseAwardSide(side, suffix) {
  const value = String(side || '');
  const match = new RegExp(`^([AB])-${suffix}$`).exec(value);
  return match ? match[1] : null;
}

export function kabaddiAction(state, action, side = null) {
  const next = clone(state);
  if (next.sport !== 'kabaddi' || !next.kabaddi || next.finished) return next;
  ensureKabaddiState(next.kabaddi);
  const raidSide = next.kabaddi.raidingTeam;
  const defenseSide = otherSide(raidSide);

  if (action === 'touch' || action === 'bonus') {
    if (action === 'touch') next.kabaddi.pendingTouchPoints += 1;
    else next.kabaddi.pendingBonusPoints += 1;
    next.kabaddi.raidPoints = next.kabaddi.pendingTouchPoints + next.kabaddi.pendingBonusPoints;
    appendEvent(next, action === 'touch' ? 'kabaddi.touch_pending' : 'kabaddi.bonus_pending', { side: raidSide, pending:next.kabaddi.raidPoints });
  } else if (action === 'allOut') {
    const awardSide = ['A','B'].includes(side) ? side : raidSide;
    next[teamKey(awardSide)].score += 2;
    appendEvent(next, 'kabaddi.all_out_bonus', { side: awardSide, points: 2, raidingTeam: raidSide, scoreA: next.teamA.score, scoreB: next.teamB.score });
  } else if (action === 'tackle') {
    finishRaid(next, 'tackle', 1);
  } else if (action === 'superTackle') {
    finishRaid(next, 'super-tackle', 2);
  } else if (action === 'empty') finishRaid(next, 'empty');
  else if (action === 'end') finishRaid(next, 'completed');
  else if (action === 'technical') {
    const allOutSide = parseAwardSide(side, 'allOut');
    if (allOutSide) {
      next[teamKey(allOutSide)].score += 2;
      appendEvent(next, 'kabaddi.all_out_bonus', { side: allOutSide, points: 2, raidingTeam: raidSide, scoreA: next.teamA.score, scoreB: next.teamB.score });
    } else if (['A','B'].includes(side)) {
      next[teamKey(side)].score += 1;
      appendEvent(next, 'kabaddi.technical_point', { side, scoreA: next.teamA.score, scoreB: next.teamB.score });
    }
  } else if (action === 'correct' && ['A','B'].includes(side)) {
    next[teamKey(side)].score = Math.max(0, next[teamKey(side)].score - 1);
    appendEvent(next, 'kabaddi.score_corrected', { side, scoreA: next.teamA.score, scoreB: next.teamB.score });
  }

  next.updatedAt = Date.now();
  return next;
}

export function tickScorerClock(state, baseTickClock) {
  let next = baseTickClock(state);
  if (next.sport === 'lacrosse' && next.lacrosse?.shotClockRunning && next.lacrosse.shotClock > 0) {
    next.lacrosse.shotClock = Math.max(0, next.lacrosse.shotClock - 1);
    if (next.lacrosse.shotClock === 0) {
      next.lacrosse.shotClockRunning = false;
      appendEvent(next, 'lacrosse.shot_clock_expired', { possession: next.lacrosse.possession });
    }
  }
  if (next.sport === 'kabaddi' && next.kabaddi?.raidRunning && next.kabaddi.raidClock > 0) {
    ensureKabaddiState(next.kabaddi);
    next.kabaddi.raidClock = Math.max(0, next.kabaddi.raidClock - 1);
    if (next.kabaddi.raidClock === 0) {
      next.kabaddi.raidRunning = false;
      appendEvent(next, 'kabaddi.raid_clock_expired', { raidingTeam: next.kabaddi.raidingTeam });
      finishRaid(next,'expired',1);
    }
  }
  next.updatedAt = Date.now();
  return next;
}

export function advanceScorerPeriod(state, delta, baseAdvancePeriod) {
  if (state?.sport === 'kabaddi' && delta > 0 && (state.kabaddi?.raidRunning || Number(state.kabaddi?.raidPoints || 0) > 0)) return clone(state);
  const before = Number(state.period || 1);
  const next = baseAdvancePeriod(state, delta);
  if (next.period === before) return next;

  if (next.sport === 'lacrosse' && next.lacrosse) {
    next.lacrosse.shotClock = next.lacrosse.shotClockSeconds;
    next.lacrosse.shotClockRunning = false;
    next.lacrosse.possession = null;
    next.lacrosse.restartType = 'period restart';
    if (before === 2 && next.period === 3) {
      const count = next.lacrosse.discipline === 'sixes' ? 1 : 2;
      next.lacrosse.timeoutsPerHalf = count;
      next.lacrosse.timeouts = { A: count, B: count };
    }
  }
  if (next.sport === 'kabaddi' && next.kabaddi) {
    if (next.period === 2) {
      next.kabaddi.raidingTeam = otherSide(next.kabaddi.firstHalfStartingRaid);
      next.kabaddi.timeouts = { A: 2, B: 2 };
    }
    next.kabaddi.raidClock = next.kabaddi.raidSeconds;
    next.kabaddi.raidRunning = false;
    next.kabaddi.raidPoints = 0;
    next.kabaddi.pendingTouchPoints = 0;
    next.kabaddi.pendingBonusPoints = 0;
  }
  return next;
}

export function swapScorerSides(state, baseSwapSides) {
  const next = baseSwapSides(state);
  const flip = value => value === 'A' ? 'B' : value === 'B' ? 'A' : value;
  if (next.sport === 'lacrosse' && next.lacrosse) {
    next.lacrosse.possession = flip(next.lacrosse.possession);
    next.lacrosse.timeouts = { A: next.lacrosse.timeouts.B, B: next.lacrosse.timeouts.A };
  }
  if (next.sport === 'kabaddi' && next.kabaddi) {
    next.kabaddi.raidingTeam = flip(next.kabaddi.raidingTeam);
    next.kabaddi.firstHalfStartingRaid = flip(next.kabaddi.firstHalfStartingRaid);
    next.kabaddi.timeouts = { A: next.kabaddi.timeouts.B, B: next.kabaddi.timeouts.A };
    next.kabaddi.raidsCompleted = { A: next.kabaddi.raidsCompleted.B, B: next.kabaddi.raidsCompleted.A };
  }
  return next;
}

export function getScorerPeriodText(state, baseGetPeriodText) {
  if (state?.sport === 'lacrosse') return `Q${state.period}`;
  if (state?.sport === 'kabaddi') return state.period === 1 ? '1st Half' : '2nd Half';
  return baseGetPeriodText(state);
}
