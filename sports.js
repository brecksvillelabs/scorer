export const SPORT_DEFS = {
  volleyball: {
    id: 'volleyball',
    name: 'Volleyball',
    icon: '🏐',
    periodLabel: 'Set',
    hasClock: false,
    controls: [
      { id: 'point', label: '+1 Point', delta: 1 },
      { id: 'minusPoint', label: '−1', delta: -1 }
    ]
  },
  basketball: {
    id: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    periodLabel: 'Quarter',
    hasClock: true,
    clockMode: 'down',
    defaultMinutes: 10,
    controls: [
      { id: 'ft', label: '+1 FT', delta: 1 },
      { id: 'fg2', label: '+2', delta: 2 },
      { id: 'fg3', label: '+3', delta: 3 },
      { id: 'minus', label: '−1', delta: -1 }
    ]
  },
  soccer: {
    id: 'soccer',
    name: 'Soccer',
    icon: '⚽',
    periodLabel: 'Half',
    hasClock: true,
    clockMode: 'up',
    defaultMinutes: 45,
    controls: [
      { id: 'goal', label: '+1 Goal', delta: 1 },
      { id: 'minusGoal', label: '−1', delta: -1 }
    ]
  },
  football: {
    id: 'football',
    name: 'Football',
    icon: '🏈',
    periodLabel: 'Quarter',
    hasClock: true,
    clockMode: 'down',
    defaultMinutes: 15,
    controls: [
      { id: 'td', label: 'TD +6', delta: 6 },
      { id: 'fg', label: 'FG +3', delta: 3 },
      { id: 'two', label: '2PT +2', delta: 2 },
      { id: 'pat', label: 'PAT +1', delta: 1 },
      { id: 'safety', label: 'Safety +2', delta: 2 },
      { id: 'minus', label: '−1', delta: -1 }
    ]
  },
  cricket: {
    id: 'cricket',
    name: 'Cricket',
    icon: '🏏',
    periodLabel: 'Innings',
    hasClock: false,
    controls: []
  }
};

export const DEFAULT_TEAMS = {
  A: { name: 'Home', color: '#2563eb', logo: '', score: 0, sets: 0, fouls: 0, yellows: 0, reds: 0, runs: 0, wickets: 0, balls: 0 },
  B: { name: 'Away', color: '#e11d48', logo: '', score: 0, sets: 0, fouls: 0, yellows: 0, reds: 0, runs: 0, wickets: 0, balls: 0 }
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createInitialState(options = {}) {
  const sport = options.sport || 'volleyball';
  const def = SPORT_DEFS[sport];
  const minutes = Number(options.periodMinutes ?? def.defaultMinutes ?? 0);
  const teamA = { ...clone(DEFAULT_TEAMS.A), ...(options.teamA || {}) };
  const teamB = { ...clone(DEFAULT_TEAMS.B), ...(options.teamB || {}) };

  return {
    version: 1,
    sport,
    teamA,
    teamB,
    period: 1,
    maxPeriods: sport === 'soccer' ? 2 : sport === 'football' || sport === 'basketball' ? 4 : undefined,
    clock: {
      running: false,
      mode: def.clockMode || 'none',
      periodSeconds: minutes * 60,
      seconds: def.clockMode === 'down' ? minutes * 60 : 0,
      targetSeconds: minutes * 60
    },
    volleyball: {
      bestOf: Number(options.bestOf || 5),
      setTo: Number(options.setTo || 25),
      decidingSetTo: Number(options.decidingSetTo || 15),
      winBy: Number(options.winBy || 2),
      servingTeam: 'A',
      setHistory: [],
      matchWinner: null
    },
    cricket: {
      format: options.cricketFormat || 'T20',
      oversLimit: Number(options.oversLimit || 20),
      battingTeam: options.battingTeam || 'A',
      innings: 1,
      inningsComplete: false,
      matchWinner: null,
      target: null
    },
    football: {
      down: 1,
      distance: 10,
      possession: 'A'
    },
    notes: '',
    finished: false,
    winner: null,
    updatedAt: Date.now()
  };
}

export function teamKey(side) {
  return side === 'B' ? 'teamB' : 'teamA';
}

export function applySimpleScore(state, side, delta) {
  const next = clone(state);
  const key = teamKey(side);
  next[key].score = Math.max(0, Number(next[key].score || 0) + Number(delta || 0));
  next.updatedAt = Date.now();
  return next;
}

export function volleyballPoint(state, side, delta = 1) {
  const next = clone(state);
  const key = teamKey(side);
  const otherKey = side === 'A' ? 'teamB' : 'teamA';

  next[key].score = Math.max(0, next[key].score + delta);
  if (delta > 0) next.volleyball.servingTeam = side;

  const setNumber = next.period;
  const isDeciding = setNumber === next.volleyball.bestOf;
  const target = isDeciding ? next.volleyball.decidingSetTo : next.volleyball.setTo;
  const lead = next[key].score - next[otherKey].score;

  if (
    delta > 0 &&
    next[key].score >= target &&
    lead >= next.volleyball.winBy &&
    !next.volleyball.matchWinner
  ) {
    next[key].sets += 1;
    next.volleyball.setHistory.push({
      set: setNumber,
      winner: side,
      scoreA: next.teamA.score,
      scoreB: next.teamB.score
    });

    const setsToWin = Math.ceil(next.volleyball.bestOf / 2);
    if (next[key].sets >= setsToWin) {
      next.volleyball.matchWinner = side;
      next.finished = true;
      next.winner = side;
    } else {
      next.period += 1;
      next.teamA.score = 0;
      next.teamB.score = 0;
    }
  }

  next.updatedAt = Date.now();
  return next;
}

function cricketTeam(state, side) {
  return state[teamKey(side)];
}

export function cricketAction(state, action) {
  const next = clone(state);
  if (next.cricket.inningsComplete || next.cricket.matchWinner) return next;

  const side = next.cricket.battingTeam;
  const batting = cricketTeam(next, side);
  const actionId = typeof action === 'string' ? action : action.id;

  let runs = 0;
  let validBall = true;
  let wicket = false;

  if (/^[0-6]$/.test(actionId)) runs = Number(actionId);
  if (actionId === 'wicket') wicket = true;
  if (actionId === 'wide') {
    runs = 1;
    validBall = false;
  }
  if (actionId === 'noBall') {
    runs = 1;
    validBall = false;
  }

  batting.runs += runs;
  if (wicket) batting.wickets = Math.min(10, batting.wickets + 1);
  if (validBall) batting.balls += 1;
  batting.score = batting.runs;

  const overLimitReached = next.cricket.oversLimit > 0 && batting.balls >= next.cricket.oversLimit * 6;
  const allOut = batting.wickets >= 10;

  if (next.cricket.innings === 2) {
    const other = cricketTeam(next, side === 'A' ? 'B' : 'A');
    if (batting.runs > other.runs) {
      next.cricket.matchWinner = side;
      next.finished = true;
      next.winner = side;
    }
  }

  if (!next.cricket.matchWinner && (overLimitReached || allOut)) {
    next.cricket.inningsComplete = true;
  }

  next.updatedAt = Date.now();
  return next;
}

export function switchCricketInnings(state) {
  const next = clone(state);
  if (next.cricket.innings >= 2) {
    const a = next.teamA.runs;
    const b = next.teamB.runs;
    if (a === b) {
      next.winner = 'tie';
    } else {
      next.winner = a > b ? 'A' : 'B';
    }
    next.cricket.matchWinner = next.winner;
    next.finished = true;
    return next;
  }

  const current = next.cricket.battingTeam;
  const other = current === 'A' ? 'B' : 'A';
  next.cricket.innings = 2;
  next.period = 2;
  next.cricket.battingTeam = other;
  next.cricket.inningsComplete = false;
  next.cricket.target = cricketTeam(next, current).runs + 1;
  next.updatedAt = Date.now();
  return next;
}

export function advancePeriod(state, delta = 1) {
  const next = clone(state);
  if (next.sport === 'volleyball') return next;
  if (next.sport === 'cricket') return delta > 0 ? switchCricketInnings(next) : next;

  const max = next.maxPeriods || 99;
  const priorPeriod = next.period;
  next.period = Math.min(max, Math.max(1, next.period + delta));
  if (next.sport === 'basketball' && delta > 0 && next.period !== priorPeriod) {
    next.teamA.fouls = 0;
    next.teamB.fouls = 0;
  }
  if (next.clock.mode === 'down') next.clock.seconds = next.clock.periodSeconds;
  if (next.clock.mode === 'up') next.clock.seconds = 0;
  next.clock.running = false;
  next.updatedAt = Date.now();
  return next;
}

export function setClockMinutes(state, minutes) {
  const next = clone(state);
  const value = Math.max(0, Number(minutes || 0));
  next.clock.periodSeconds = value * 60;
  next.clock.targetSeconds = value * 60;
  next.clock.seconds = next.clock.mode === 'down' ? value * 60 : 0;
  next.clock.running = false;
  return next;
}

export function tickClock(state) {
  const next = clone(state);
  if (!next.clock.running) return next;
  if (next.clock.mode === 'down') {
    next.clock.seconds = Math.max(0, next.clock.seconds - 1);
    if (next.clock.seconds === 0) next.clock.running = false;
  } else if (next.clock.mode === 'up') {
    next.clock.seconds += 1;
  }
  next.updatedAt = Date.now();
  return next;
}

export function swapSides(state) {
  const next = clone(state);
  [next.teamA, next.teamB] = [next.teamB, next.teamA];

  if (next.volleyball?.servingTeam) {
    next.volleyball.servingTeam = next.volleyball.servingTeam === 'A' ? 'B' : 'A';
    next.volleyball.setHistory = next.volleyball.setHistory.map((item) => ({
      ...item,
      winner: item.winner === 'A' ? 'B' : 'A',
      scoreA: item.scoreB,
      scoreB: item.scoreA
    }));
    if (next.volleyball.matchWinner && next.volleyball.matchWinner !== 'tie') {
      next.volleyball.matchWinner = next.volleyball.matchWinner === 'A' ? 'B' : 'A';
    }
  }
  if (next.cricket?.battingTeam) next.cricket.battingTeam = next.cricket.battingTeam === 'A' ? 'B' : 'A';
  if (next.cricket?.matchWinner && next.cricket.matchWinner !== 'tie') next.cricket.matchWinner = next.cricket.matchWinner === 'A' ? 'B' : 'A';
  if (next.football?.possession) next.football.possession = next.football.possession === 'A' ? 'B' : 'A';
  if (next.winner && next.winner !== 'tie') next.winner = next.winner === 'A' ? 'B' : 'A';
  return next;
}

export function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatOvers(balls = 0) {
  const safe = Math.max(0, Number(balls || 0));
  return `${Math.floor(safe / 6)}.${safe % 6}`;
}

export function getDisplayScore(state, side) {
  const team = cricketTeam(state, side);
  if (state.sport === 'cricket') return `${team.runs}/${team.wickets}`;
  return String(team.score);
}

export function getPeriodText(state) {
  if (state.sport === 'volleyball') return `Set ${state.period}`;
  if (state.sport === 'basketball' || state.sport === 'football') return `Q${state.period}`;
  if (state.sport === 'soccer') return state.period === 1 ? '1st Half' : '2nd Half';
  if (state.sport === 'cricket') return `${ordinal(state.cricket.innings)} Innings`;
  return `Period ${state.period}`;
}

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}
