export const SPORT_DEFS = {
  volleyball: { id: 'volleyball', name: 'Volleyball', icon: '🏐', periodLabel: 'Set', hasClock: false },
  basketball: { id: 'basketball', name: 'Basketball', icon: '🏀', periodLabel: 'Quarter', hasClock: true, clockMode: 'down', defaultMinutes: 10 },
  soccer: { id: 'soccer', name: 'Soccer', icon: '⚽', periodLabel: 'Half', hasClock: true, clockMode: 'up', defaultMinutes: 45 },
  football: { id: 'football', name: 'Football', icon: '🏈', periodLabel: 'Quarter', hasClock: true, clockMode: 'down', defaultMinutes: 15 },
  cricket: { id: 'cricket', name: 'Cricket', icon: '🏏', periodLabel: 'Innings', hasClock: false },
  tennis: { id: 'tennis', name: 'Tennis', icon: '🎾', periodLabel: 'Set', hasClock: false },
  badminton: { id: 'badminton', name: 'Badminton', icon: '🏸', periodLabel: 'Game', hasClock: false }
};

export const SPORT_RULE_PROFILES = {
  volleyball: {
    baseline: 'FIVB-style rally scoring',
    simple: ['points', 'sets', 'server'],
    advanced: ['timeouts', 'rotations', 'substitutions', 'lineup/libero'],
    defaults: { bestOf: 5, setTo: 25, decidingSetTo: 15, winBy: 2 }
  },
  basketball: {
    baseline: 'Four-quarter configurable basketball',
    simple: ['score', 'quarter', 'clock'],
    advanced: ['team fouls', 'timeouts', 'possession', 'player fouls'],
    defaults: { periods: 4, periodMinutes: 10 }
  },
  soccer: {
    baseline: 'IFAB-style two-half football/soccer',
    simple: ['goals', 'half', 'running clock'],
    advanced: ['cards', 'stoppage time', 'substitutions', 'shootout'],
    defaults: { periods: 2, periodMinutes: 45 }
  },
  football: {
    baseline: 'Four-quarter gridiron football',
    simple: ['score', 'quarter', 'clock'],
    advanced: ['possession', 'down', 'distance', 'timeouts', 'overtime'],
    defaults: { periods: 4, periodMinutes: 15 }
  },
  cricket: {
    baseline: 'Limited-overs innings scoring',
    simple: ['runs', 'wickets', 'overs', 'striker', 'non-striker', 'bowler'],
    advanced: ['extras', 'dismissals', 'batting card', 'bowling figures', 'partnerships'],
    defaults: { format: 'T20', oversLimit: 20, wickets: 10 }
  },
  tennis: {
    baseline: 'Traditional advantage-set scoring with 6-6 tie-break',
    simple: ['points', 'games', 'sets', 'server'],
    advanced: ['tie-break detail', 'doubles serving order', 'match tie-break'],
    defaults: { bestOf: 3, tiebreakAt: 6, tiebreakTo: 7, winBy: 2 }
  },
  badminton: {
    baseline: 'BWF-style rally scoring',
    simple: ['points', 'games', 'server'],
    advanced: ['service court', 'doubles serving order'],
    defaults: { bestOf: 3, gameTo: 21, winBy: 2, cap: 30 }
  }
};

export const DEFAULT_TEAMS = {
  A: { name: 'Home', color: '#2563eb', logo: '', score: 0, sets: 0, gamesWon: 0, fouls: 0, yellows: 0, reds: 0, runs: 0, wickets: 0, balls: 0, roster: [] },
  B: { name: 'Away', color: '#e11d48', logo: '', score: 0, sets: 0, gamesWon: 0, fouls: 0, yellows: 0, reds: 0, runs: 0, wickets: 0, balls: 0, roster: [] }
};

export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function teamKey(side) { return side === 'B' ? 'teamB' : 'teamA'; }
export function otherSide(side) { return side === 'A' ? 'B' : 'A'; }

function cleanRoster(roster) {
  return Array.isArray(roster) ? [...new Set(roster.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 40) : [];
}

function makeMatchId() { return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }

function appendCoreEvent(next, type, details = {}) {
  if (!Array.isArray(next.events)) next.events = [];
  next.eventSeq = Number(next.eventSeq || 0) + 1;
  next.events.push({
    id: `${next.matchId || 'match'}-e${next.eventSeq}`,
    seq: next.eventSeq,
    type,
    sport: next.sport,
    period: next.period,
    at: Date.now(),
    ...details
  });
  if (next.events.length > 5000) next.events = next.events.slice(-5000);
}

export function createInitialState(options = {}) {
  const sport = options.sport || 'volleyball';
  const def = SPORT_DEFS[sport];
  const minutes = Number(options.periodMinutes ?? def.defaultMinutes ?? 0);
  const teamA = { ...clone(DEFAULT_TEAMS.A), ...(options.teamA || {}) };
  const teamB = { ...clone(DEFAULT_TEAMS.B), ...(options.teamB || {}) };
  teamA.roster = cleanRoster(teamA.roster);
  teamB.roster = cleanRoster(teamB.roster);

  const battingFirst = options.battingTeam || 'A';
  const fieldingFirst = otherSide(battingFirst);
  const battingRoster = (battingFirst === 'A' ? teamA : teamB).roster;
  const fieldingRoster = (fieldingFirst === 'A' ? teamA : teamB).roster;

  return {
    version: 2,
    rulesProfileVersion: 1,
    trackingMode: options.trackingMode === 'advanced' ? 'advanced' : 'simple',
    eventSeq: 0,
    events: [],
    matchId: options.matchId || makeMatchId(),
    startedAt: Number(options.startedAt || Date.now()),
    sport,
    teamA,
    teamB,
    period: 1,
    maxPeriods: sport === 'soccer' ? 2 : ['football', 'basketball'].includes(sport) ? 4 : undefined,
    clock: {
      running: false,
      mode: def.clockMode || 'none',
      periodSeconds: minutes * 60,
      seconds: def.clockMode === 'down' ? minutes * 60 : 0,
      targetSeconds: minutes * 60
    },
    volleyball: {
      bestOf: Number(options.bestOf || 5), setTo: Number(options.setTo || 25), decidingSetTo: Number(options.decidingSetTo || 15),
      winBy: Number(options.winBy || 2), servingTeam: options.servingTeam === 'B' ? 'B' : 'A',
      firstServer: options.servingTeam === 'B' ? 'B' : 'A', phase: 'live', setHistory: [], timeouts: { A: 2, B: 2 }, matchWinner: null
    },
    basketball: { possession: 'A', timeouts: { A: 5, B: 5 } },
    soccer: { stoppage: 0 },
    football: { down: 1, distance: 10, possession: 'A', timeouts: { A: 3, B: 3 } },
    tennis: {
      bestOf: Number(options.tennisBestOf || 3), points: { A: 0, B: 0 }, games: { A: 0, B: 0 }, sets: { A: 0, B: 0 },
      servingTeam: options.servingTeam || 'A', tiebreak: false, tiebreakPoints: { A: 0, B: 0 }, tiebreakStartServer: null,
      setHistory: [], phase: 'live', matchWinner: null
    },
    badminton: {
      bestOf: Number(options.badmintonBestOf || 3), gameTo: Number(options.badmintonGameTo || 21), points: { A: 0, B: 0 }, games: { A: 0, B: 0 },
      servingTeam: options.servingTeam || 'A', gameHistory: [], phase: 'live', matchWinner: null
    },
    cricket: {
      format: options.cricketFormat || 'T20', oversLimit: Number(options.oversLimit || 20), battingTeam: battingFirst, innings: 1,
      firstBattingTeam: battingFirst,
      inningsComplete: false, matchWinner: null, target: null, needsBowler: false,
      extras: { A: { wides: 0, noBalls: 0 }, B: { wides: 0, noBalls: 0 } },
      striker: battingRoster[0] || 'Batter 1',
      nonStriker: battingRoster[1] || 'Batter 2',
      nextBatterIndex: Math.min(2, battingRoster.length),
      nextFallbackBatterNumber: 3,
      bowler: fieldingRoster[0] || 'Bowler 1',
      battingStats: { A: initBattingStats(teamA.roster), B: initBattingStats(teamB.roster) },
      bowlingStats: { A: initBowlingStats(teamA.roster), B: initBowlingStats(teamB.roster) },
      dismissals: { A: [], B: [] }
    },
    notes: '', finished: false, winner: null, updatedAt: Date.now()
  };
}

function initBattingStats(roster) {
  return Object.fromEntries(roster.map(name => [name, { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false }]));
}
function initBowlingStats(roster) {
  return Object.fromEntries(roster.map(name => [name, { name, balls: 0, runs: 0, wickets: 0 }]));
}
function ensureBattingStat(state, side, name) {
  if (!state.cricket.battingStats[side][name]) state.cricket.battingStats[side][name] = { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
  return state.cricket.battingStats[side][name];
}
function ensureBowlingStat(state, side, name) {
  if (!state.cricket.bowlingStats[side][name]) state.cricket.bowlingStats[side][name] = { name, balls: 0, runs: 0, wickets: 0 };
  return state.cricket.bowlingStats[side][name];
}

function inferFallbackNumber(c, stats) {
  let n = Math.max(3, Number(c.nextFallbackBatterNumber || 3));
  const used = new Set([c.striker, c.nonStriker, ...Object.keys(stats || {})]);
  for (const name of used) {
    const m = /^Batter\s+(\d+)$/i.exec(String(name || ''));
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return n;
}

function nextBatterName(next, side) {
  const c = next.cricket;
  const team = next[teamKey(side)];
  const roster = team.roster || [];
  if (c.nextBatterIndex < roster.length) {
    const name = roster[c.nextBatterIndex];
    c.nextBatterIndex += 1;
    return name;
  }
  let n = inferFallbackNumber(c, c.battingStats[side]);
  let name = `Batter ${n}`;
  while (c.battingStats[side][name] || name === c.striker || name === c.nonStriker) {
    n += 1;
    name = `Batter ${n}`;
  }
  c.nextFallbackBatterNumber = n + 1;
  return name;
}

export function normalizeSportFoundationState(state) {
  if (!state) return state;
  const next = clone(state);
  next.rulesProfileVersion = 1;
  next.trackingMode = next.trackingMode === 'advanced' ? 'advanced' : 'simple';
  next.eventSeq = Number(next.eventSeq || 0);
  if (!Array.isArray(next.events)) next.events = [];

  if (next.cricket) {
    const c = next.cricket;
    c.firstBattingTeam ||= c.innings === 1 ? c.battingTeam : otherSide(c.battingTeam);
    c.dismissals ||= { A: [], B: [] };
    c.dismissals.A ||= [];
    c.dismissals.B ||= [];
    c.nextFallbackBatterNumber = inferFallbackNumber(c, c.battingStats?.[c.battingTeam] || {});
    const batSide = c.battingTeam || 'A';
    const team = next[teamKey(batSide)];
    team.roster = cleanRoster(team.roster);

    if (!c.striker) c.striker = team.roster[0] || 'Batter 1';
    if (!c.nonStriker) c.nonStriker = team.roster.find(name => name !== c.striker) || (c.striker === 'Batter 1' ? 'Batter 2' : nextBatterName(next, batSide));
    if (c.nonStriker === c.striker) {
      // v0.3.2 and earlier could replace a dismissed striker with "Batter 1",
      // duplicating the active non-striker. The old engine only replaced the
      // striker, so preserve the non-striker and put the next unique batter on strike.
      c.striker = nextBatterName(next, batSide);
    }
    ensureBattingStat(next, batSide, c.striker);
    ensureBattingStat(next, batSide, c.nonStriker);
  }
  if (next.volleyball) {
    next.volleyball.firstServer ||= next.volleyball.servingTeam || 'A';
    next.volleyball.phase ||= next.finished ? 'final' : 'live';
  }
  if (next.tennis) next.tennis.phase ||= next.finished ? 'final' : 'live';
  if (next.badminton) next.badminton.phase ||= next.finished ? 'final' : 'live';
  return next;
}

export function applySimpleScore(state, side, delta) {
  const next = clone(state); const key = teamKey(side);
  next[key].score = Math.max(0, Number(next[key].score || 0) + Number(delta || 0));
  appendCoreEvent(next, 'score.adjusted', {
    side, delta: Number(delta || 0), score: next[key].score,
    scoreA: next.teamA.score, scoreB: next.teamB.score,
    clockSeconds: next.clock?.seconds
  });
  next.updatedAt = Date.now(); return next;
}

export function volleyballPoint(state, side, delta = 1) {
  const next = clone(state); if (next.finished) return next;
  const key = teamKey(side); const other = teamKey(otherSide(side));
  if (next.volleyball.phase === 'set_break') next.volleyball.phase = 'live';
  next[key].score = Math.max(0, next[key].score + delta);
  if (delta > 0) next.volleyball.servingTeam = side;
  appendCoreEvent(next, 'volleyball.point', { side, delta, scoreA: next.teamA.score, scoreB: next.teamB.score });
  const deciding = next.period === next.volleyball.bestOf;
  const target = deciding ? next.volleyball.decidingSetTo : next.volleyball.setTo;
  if (delta > 0 && next[key].score >= target && next[key].score - next[other].score >= next.volleyball.winBy && !next.finished) {
    next[key].sets += 1;
    next.volleyball.setHistory.push({ set: next.period, scoreA: next.teamA.score, scoreB: next.teamB.score, winner: side });
    appendCoreEvent(next, 'volleyball.set_won', { side, set: next.period, scoreA: next.teamA.score, scoreB: next.teamB.score });
    const needed = Math.ceil(next.volleyball.bestOf / 2);
    if (next[key].sets >= needed) {
      next.volleyball.phase = 'final';
      finish(next, side, 'volleyball');
    } else {
      next.period += 1; next.teamA.score = 0; next.teamB.score = 0;
      next.volleyball.phase = 'set_break';
      next.volleyball.timeouts = { A: 2, B: 2 };
      // Alternate the first serve for familiar local scoring. The scorer may
      // still override the server before the next rally, including a decider.
      next.volleyball.servingTeam = next.period % 2 === 1
        ? next.volleyball.firstServer
        : otherSide(next.volleyball.firstServer);
    }
  }
  next.updatedAt = Date.now(); return next;
}

export function tennisPoint(state, side) {
  const next = clone(state); if (next.finished) return next;
  const t = next.tennis; const other = otherSide(side);
  if (t.phase === 'set_break') t.phase = 'live';
  if (t.tiebreak) {
    t.tiebreakPoints[side] += 1;
    appendCoreEvent(next, 'tennis.point', { side, tiebreak: true, pointA: t.tiebreakPoints.A, pointB: t.tiebreakPoints.B });
    const a = t.tiebreakPoints.A, b = t.tiebreakPoints.B;
    if (t.tiebreakPoints[side] >= 7 && Math.abs(a - b) >= 2) {
      t.games[side] = 7;
      winTennisSet(next, side, { scoreA: t.games.A, scoreB: t.games.B, tiebreak: `${a}-${b}` });
    } else {
      const totalPlayed = a + b;
      t.servingTeam = tiebreakServerForNextPoint(t.tiebreakStartServer, totalPlayed);
    }
    next.updatedAt = Date.now(); return next;
  }

  t.points[side] += 1;
  appendCoreEvent(next, 'tennis.point', { side, tiebreak: false, pointA: t.points.A, pointB: t.points.B });
  const p = t.points[side], op = t.points[other];
  if (p >= 4 && p - op >= 2) {
    t.games[side] += 1; t.points = { A: 0, B: 0 }; t.servingTeam = otherSide(t.servingTeam);
    const ga = t.games.A, gb = t.games.B;
    if (ga === 6 && gb === 6) {
      t.tiebreak = true; t.tiebreakPoints = { A: 0, B: 0 }; t.tiebreakStartServer = t.servingTeam;
    } else if (t.games[side] >= 6 && Math.abs(ga - gb) >= 2) {
      winTennisSet(next, side, { scoreA: ga, scoreB: gb });
    }
  }
  next.updatedAt = Date.now(); return next;
}

function winTennisSet(next, side, result) {
  const t = next.tennis;
  t.sets[side] += 1; t.setHistory.push({ set: t.setHistory.length + 1, winner: side, ...result });
  appendCoreEvent(next, 'tennis.set_won', { side, ...result });
  const needed = Math.ceil(t.bestOf / 2);
  if (t.sets[side] >= needed) { t.phase = 'final'; t.matchWinner = side; finish(next, side, 'tennis'); return; }
  if (t.tiebreak && t.tiebreakStartServer) t.servingTeam = otherSide(t.tiebreakStartServer);
  t.points = { A: 0, B: 0 }; t.games = { A: 0, B: 0 }; t.tiebreak = false; t.tiebreakPoints = { A: 0, B: 0 }; t.tiebreakStartServer = null;
  next.period += 1;
  t.phase = 'set_break';
}

function tiebreakServerForNextPoint(start, totalPlayed) {
  if (totalPlayed === 0) return start;
  const block = Math.floor((totalPlayed - 1) / 2);
  return block % 2 === 0 ? otherSide(start) : start;
}

export function formatTennisPoint(state, side) {
  const t = state.tennis;
  if (t.tiebreak) return String(t.tiebreakPoints[side]);
  const p = t.points[side], op = t.points[otherSide(side)];
  if (p >= 3 && op >= 3) {
    if (p === op) return '40';
    if (p === op + 1) return 'AD';
    if (p < op) return '40';
  }
  return ['0', '15', '30', '40'][Math.min(p, 3)];
}

export function badmintonPoint(state, side) {
  const next = clone(state); if (next.finished) return next;
  const b = next.badminton; const other = otherSide(side);
  if (b.phase === 'game_break') b.phase = 'live';
  b.points[side] += 1; b.servingTeam = side;
  appendCoreEvent(next, 'badminton.rally', { side, pointA: b.points.A, pointB: b.points.B });
  const p = b.points[side], op = b.points[other];
  const won = (p >= b.gameTo && p - op >= 2) || p >= 30;
  if (won) {
    b.games[side] += 1; b.gameHistory.push({ game: b.gameHistory.length + 1, winner: side, scoreA: b.points.A, scoreB: b.points.B });
    appendCoreEvent(next, 'badminton.game_won', { side, game: b.gameHistory.length, scoreA: b.points.A, scoreB: b.points.B });
    const needed = Math.ceil(b.bestOf / 2);
    if (b.games[side] >= needed) { b.phase = 'final'; b.matchWinner = side; finish(next, side, 'badminton'); }
    else { b.points = { A: 0, B: 0 }; b.phase = 'game_break'; next.period += 1; }
  }
  next.updatedAt = Date.now(); return next;
}

export function cricketAction(state, actionId) {
  const next = normalizeSportFoundationState(state); const c = next.cricket;
  if (c.inningsComplete || c.matchWinner || next.finished || c.needsBowler) return next;
  const [baseAction, targetRoleRaw] = String(actionId || '').split(':');
  const dismissedRole = targetRoleRaw === 'nonStriker' ? 'nonStriker' : 'striker';
  const batSide = c.battingTeam, fieldSide = otherSide(batSide);
  const battingTeam = next[teamKey(batSide)];
  const striker = ensureBattingStat(next, batSide, c.striker);
  const bowler = ensureBowlingStat(next, fieldSide, c.bowler);

  let teamRuns = 0, batterRuns = 0, legalBall = true, wicket = false, wide = false, noBall = false;
  if (/^[0-6]$/.test(baseAction)) { teamRuns = Number(baseAction); batterRuns = teamRuns; }
  else if (baseAction === 'wicket' || baseAction === 'runOut') wicket = true;
  else if (baseAction === 'wide') { teamRuns = 1; legalBall = false; wide = true; }
  else if (baseAction === 'noBall') { teamRuns = 1; legalBall = false; noBall = true; }
  else return next;

  battingTeam.runs += teamRuns; battingTeam.score = battingTeam.runs;
  striker.runs += batterRuns;
  if (batterRuns === 4) striker.fours += 1;
  if (batterRuns === 6) striker.sixes += 1;
  if (legalBall) { battingTeam.balls += 1; striker.balls += 1; bowler.balls += 1; }
  bowler.runs += teamRuns;
  if (wide) c.extras[batSide].wides += teamRuns;
  if (noBall) c.extras[batSide].noBalls += teamRuns;

  let dismissedName = null;
  if (wicket) {
    dismissedName = c[dismissedRole];
    const dismissed = ensureBattingStat(next, batSide, dismissedName);
    battingTeam.wickets = Math.min(10, battingTeam.wickets + 1);
    dismissed.out = true;
    if (baseAction !== 'runOut') bowler.wickets += 1;
    c.dismissals[batSide].push({
      batter: dismissedName,
      type: baseAction === 'runOut' ? 'run out' : 'bowler wicket',
      bowler: baseAction === 'runOut' ? null : c.bowler,
      score: battingTeam.runs,
      wicket: battingTeam.wickets,
      ball: battingTeam.balls
    });
    if (battingTeam.wickets < 10) {
      const incoming = nextBatterName(next, batSide);
      ensureBattingStat(next, batSide, incoming);
      c[dismissedRole] = incoming;
    }
  } else if (legalBall && batterRuns % 2 === 1) {
    [c.striker, c.nonStriker] = [c.nonStriker, c.striker];
  }

  if (legalBall && battingTeam.balls % 6 === 0 && battingTeam.balls > 0) {
    [c.striker, c.nonStriker] = [c.nonStriker, c.striker]; c.needsBowler = true;
  }

  appendCoreEvent(next, 'cricket.delivery', {
    action: baseAction,
    dismissedRole: wicket ? dismissedRole : undefined,
    dismissedName,
    battingTeam: batSide,
    striker: c.striker,
    nonStriker: c.nonStriker,
    bowler: c.bowler,
    runs: teamRuns,
    score: `${battingTeam.runs}/${battingTeam.wickets}`,
    balls: battingTeam.balls
  });

  const oversDone = c.oversLimit > 0 && battingTeam.balls >= c.oversLimit * 6;
  const allOut = battingTeam.wickets >= 10;
  if (c.innings === 2 && c.target && battingTeam.runs >= c.target) { c.matchWinner = batSide; finish(next, batSide, 'cricket'); }
  else if (oversDone || allOut) c.inningsComplete = true;

  next.updatedAt = Date.now(); return next;
}

export function setCricketRole(state, role, name) {
  const next = normalizeSportFoundationState(state); const c = next.cricket; if (!name) return next;
  if (role === 'striker' || role === 'nonStriker') {
    ensureBattingStat(next, c.battingTeam, name);
    if (role === 'striker' && name === c.nonStriker) [c.striker, c.nonStriker] = [c.nonStriker, c.striker];
    else if (role === 'nonStriker' && name === c.striker) [c.striker, c.nonStriker] = [c.nonStriker, c.striker];
    else c[role] = name;
  }
  if (role === 'bowler') { ensureBowlingStat(next, otherSide(c.battingTeam), name); c.bowler = name; c.needsBowler = false; }
  appendCoreEvent(next, 'cricket.role_changed', { role, name });
  next.updatedAt = Date.now(); return next;
}

export function switchCricketInnings(state) {
  const next = normalizeSportFoundationState(state); const c = next.cricket;
  if (c.innings >= 2) {
    const a = next.teamA.runs, b = next.teamB.runs; c.matchWinner = a === b ? 'tie' : a > b ? 'A' : 'B'; finish(next, c.matchWinner, 'cricket'); return next;
  }
  const oldBat = c.battingTeam; const newBat = otherSide(oldBat); const fieldSide = oldBat;
  c.innings = 2; next.period = 2; c.battingTeam = newBat; c.inningsComplete = false; c.target = next[teamKey(oldBat)].runs + 1;
  const roster = next[teamKey(newBat)].roster; const fieldRoster = next[teamKey(fieldSide)].roster;
  c.striker = roster[0] || 'Batter 1';
  c.nonStriker = roster[1] || 'Batter 2';
  c.nextBatterIndex = Math.min(2, roster.length);
  c.nextFallbackBatterNumber = 3;
  ensureBattingStat(next, newBat, c.striker);
  ensureBattingStat(next, newBat, c.nonStriker);
  c.bowler = fieldRoster[0] || 'Bowler 1'; c.needsBowler = false;
  appendCoreEvent(next, 'cricket.innings_started', { innings: 2, battingTeam: newBat, target: c.target });
  next.updatedAt = Date.now(); return next;
}

export function advancePeriod(state, delta = 1) {
  const next = clone(state);
  if (['volleyball', 'tennis', 'badminton'].includes(next.sport)) return next;
  if (next.sport === 'cricket') return delta > 0 ? switchCricketInnings(next) : next;
  const max = next.maxPeriods || 99, before = next.period;
  const overtimeSport = ['basketball','football','lacrosse'].includes(next.sport);
  const tiedForOvertime = numScore(next.teamA.score) === numScore(next.teamB.score);
  const overtimeCeiling = overtimeSport && delta > 0 && before >= max && tiedForOvertime ? before + 1 : Math.max(max,before);
  next.period = Math.min(overtimeCeiling, Math.max(1, next.period + delta));
  if (next.sport === 'basketball' && delta > 0 && next.period !== before) { next.teamA.fouls = 0; next.teamB.fouls = 0; }
  if (next.sport === 'football' && before === 2 && next.period === 3) next.football.timeouts = { A: 3, B: 3 };
  if (next.clock.mode === 'down') next.clock.seconds = next.clock.periodSeconds;
  if (next.clock.mode === 'up') next.clock.seconds = 0;
  next.clock.running = false;
  if (next.period !== before) appendCoreEvent(next, 'period.changed', { from: before, to: next.period });
  next.updatedAt = Date.now(); return next;
}

function numScore(value) { return Number(value || 0); }

export function tickClock(state) {
  const next = clone(state); if (!next.clock.running) return next;
  if (next.clock.mode === 'down') { next.clock.seconds = Math.max(0, next.clock.seconds - 1); if (!next.clock.seconds) next.clock.running = false; }
  else if (next.clock.mode === 'up') next.clock.seconds += 1;
  next.updatedAt = Date.now(); return next;
}

export function swapSides(state) {
  const next = clone(state); [next.teamA, next.teamB] = [next.teamB, next.teamA];
  const flip = (v) => v === 'A' ? 'B' : v === 'B' ? 'A' : v;
  next.winner = flip(next.winner);
  if (next.volleyball) { next.volleyball.servingTeam = flip(next.volleyball.servingTeam); next.volleyball.matchWinner = flip(next.volleyball.matchWinner); next.volleyball.timeouts = { A: next.volleyball.timeouts.B, B: next.volleyball.timeouts.A }; }
  if (next.basketball) { next.basketball.possession = flip(next.basketball.possession); next.basketball.timeouts = { A: next.basketball.timeouts.B, B: next.basketball.timeouts.A }; }
  if (next.football) { next.football.possession = flip(next.football.possession); next.football.timeouts = { A: next.football.timeouts.B, B: next.football.timeouts.A }; }
  if (next.tennis) { next.tennis.servingTeam = flip(next.tennis.servingTeam); next.tennis.matchWinner = flip(next.tennis.matchWinner); [next.tennis.points.A,next.tennis.points.B]=[next.tennis.points.B,next.tennis.points.A]; [next.tennis.games.A,next.tennis.games.B]=[next.tennis.games.B,next.tennis.games.A]; [next.tennis.sets.A,next.tennis.sets.B]=[next.tennis.sets.B,next.tennis.sets.A]; }
  if (next.badminton) { next.badminton.servingTeam = flip(next.badminton.servingTeam); next.badminton.matchWinner = flip(next.badminton.matchWinner); [next.badminton.points.A,next.badminton.points.B]=[next.badminton.points.B,next.badminton.points.A]; [next.badminton.games.A,next.badminton.games.B]=[next.badminton.games.B,next.badminton.games.A]; }
  if (next.cricket) {
    next.cricket.battingTeam = flip(next.cricket.battingTeam); next.cricket.matchWinner = flip(next.cricket.matchWinner);
    next.cricket.firstBattingTeam = flip(next.cricket.firstBattingTeam);
    [next.cricket.extras.A,next.cricket.extras.B]=[next.cricket.extras.B,next.cricket.extras.A];
    [next.cricket.battingStats.A,next.cricket.battingStats.B]=[next.cricket.battingStats.B,next.cricket.battingStats.A];
    [next.cricket.bowlingStats.A,next.cricket.bowlingStats.B]=[next.cricket.bowlingStats.B,next.cricket.bowlingStats.A];
    if (next.cricket.dismissals) [next.cricket.dismissals.A,next.cricket.dismissals.B]=[next.cricket.dismissals.B,next.cricket.dismissals.A];
  }
  appendCoreEvent(next, 'match.sides_swapped');
  next.updatedAt = Date.now(); return next;
}

function finish(next, side, sportKey) {
  next.finished = true; next.winner = side;
  if (sportKey && next[sportKey] && 'matchWinner' in next[sportKey]) next[sportKey].matchWinner = side;
  appendCoreEvent(next, 'match.finished', { winner: side, sportKey });
}

export function formatClock(seconds) { const s = Math.max(0, Number(seconds || 0)); return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`; }
export function formatOvers(balls = 0) { const b = Math.max(0, Number(balls || 0)); return `${Math.floor(b / 6)}.${b % 6}`; }
export function strikeRate(runs, balls) { return balls ? ((runs / balls) * 100).toFixed(1) : '0.0'; }
export function economy(runs, balls) { return balls ? (runs / (balls / 6)).toFixed(2) : '0.00'; }
export function getPeriodText(state) {
  if (state.sport === 'volleyball') return `Set ${state.period}`;
  if (state.sport === 'tennis') return `Set ${state.period}`;
  if (state.sport === 'badminton') return `Game ${state.period}`;
  if (['basketball','football'].includes(state.sport)) return `Q${state.period}`;
  if (state.sport === 'soccer') return state.period === 1 ? '1st Half' : '2nd Half';
  if (state.sport === 'cricket') return `${state.cricket.innings === 1 ? '1st' : '2nd'} Innings`;
  return `Period ${state.period}`;
}
