import { economy, formatClock, formatOvers, formatTennisPoint, strikeRate } from './sports.js';

const SPORT_META = Object.freeze({
  volleyball: { icon:'🏐', name:'Volleyball' },
  basketball: { icon:'🏀', name:'Basketball' },
  soccer: { icon:'⚽', name:'Soccer' },
  football: { icon:'🏈', name:'Football' },
  cricket: { icon:'🏏', name:'Cricket' },
  tennis: { icon:'🎾', name:'Tennis' },
  badminton: { icon:'🏸', name:'Badminton' },
  lacrosse: { icon:'🥍', name:'Lacrosse' },
  kabaddi: { icon:'🤼', name:'Kabaddi' },
  baseball: { icon:'⚾', name:'Baseball' }
});

const teamKey = side => side === 'B' ? 'teamB' : 'teamA';
const otherSide = side => side === 'A' ? 'B' : 'A';
const num = value => Number(value || 0);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

function team(state, side) { return state?.[teamKey(side)] || {}; }
function teamName(state, side) { return team(state, side).name || `Side ${side}`; }
function liveWord(state) {
  if (state?.finished) return 'FINAL';
  if (state?.sport === 'kabaddi' && state?.kabaddi?.raidRunning) return 'LIVE';
  if (periodHasEnded(state) || state?.cricket?.inningsComplete || state?.volleyball?.phase === 'set_break' || state?.tennis?.phase === 'set_break' || state?.badminton?.phase === 'game_break' || ['mid_inning','end_inning'].includes(state?.baseball?.phase)) return 'BREAK';
  return 'LIVE';
}
function clockText(state) { return formatClock(state?.clock?.seconds || 0); }
function joinNonEmpty(parts, separator = ' · ') { return parts.filter(Boolean).join(separator); }
function periodHasEnded(state) {
  const clock = state?.clock || {};
  if (clock.running) return false;
  if (clock.mode === 'down') return num(clock.seconds) === 0;
  if (clock.mode === 'up') return num(clock.targetSeconds) > 0 && num(clock.seconds) >= num(clock.targetSeconds);
  return false;
}

export function scoreboardHeading(state) {
  const meta = SPORT_META[state?.sport] || { icon:'🏆', name:'Game' };
  return `${meta.icon} ${meta.name} scorecard`;
}

export function scoreShareTitle(state) {
  if (state?.sport === 'baseball') return `Scorer update: ${teamName(state,state.baseball.firstBat)} vs ${teamName(state,state.baseball.homeSide)}`;
  return `Scorer update: ${teamName(state, 'A')} vs ${teamName(state, 'B')}`;
}

function finalResult(state) {
  if (!state?.finished) return '';
  if (state.winner === 'tie') return state.sport === 'cricket' ? 'Match tied' : 'Tied';
  if (!['A','B'].includes(state.winner)) return 'Final';
  if (state.sport === 'kabaddi') return `${teamName(state,state.winner)} won by ${Math.abs(num(state.teamA.score)-num(state.teamB.score))}`;
  return `${teamName(state, state.winner)} won`;
}

function eventCount(state,type,side) {
  return (state.events || []).filter(event => event.type === type && (!side || event.side === side)).length;
}

function currentStatus(state) {
  if (state.finished) return finalResult(state);
  if (state.sport === 'volleyball') return state.volleyball.phase === 'set_break' ? `Set break • Set ${state.period} next` : `Set ${state.period}`;
  if (state.sport === 'basketball' || state.sport === 'football' || state.sport === 'lacrosse') {
    if (periodHasEnded(state)) return state.period === 2 ? 'Halftime' : `End Q${state.period}`;
    return `Q${state.period} ${clockText(state)}`;
  }
  if (state.sport === 'soccer') return state.period === 1 && periodHasEnded(state) ? 'Halftime' : `${state.period === 1 ? '1st' : '2nd'} half ${clockText(state)}`;
  if (state.sport === 'cricket') {
    if (state.cricket.inningsComplete) return state.cricket.innings === 1 ? 'Innings break' : 'Innings complete';
    return `${state.cricket.innings === 1 ? '1st' : '2nd'} innings`;
  }
  if (state.sport === 'tennis') return state.tennis.phase === 'set_break' ? `Set break • Set ${state.period} next` : `Set ${state.period}`;
  if (state.sport === 'badminton') return state.badminton.phase === 'game_break' ? `Game break • Game ${state.period} next` : `Game ${state.period}`;
  if (state.sport === 'kabaddi') {
    if (periodHasEnded(state) && (state.kabaddi.raidRunning || state.kabaddi.raidPoints > 0)) return `Last raid • ${state.period === 1 ? '1st' : '2nd'} half`;
    return state.period === 1 && periodHasEnded(state) ? 'Halftime' : `${state.period === 1 ? '1st' : '2nd'} half ${clockText(state)}`;
  }
  if (state.sport === 'baseball') {
    if (state.baseball.phase === 'mid_inning') return `Mid ${state.baseball.inning}`;
    if (state.baseball.phase === 'end_inning') return `End ${Math.max(1,state.baseball.inning - 1)}`;
    return `${state.baseball.half === 'bottom' ? 'Bot' : 'Top'} ${state.baseball.inning}`;
  }
  return 'In progress';
}

function shareHeader(state) {
  const meta = SPORT_META[state.sport] || { icon:'🏆' };
  if (state.sport === 'baseball') return `${meta.icon} ${liveWord(state)} • ${teamName(state,state.baseball.firstBat)} vs ${teamName(state,state.baseball.homeSide)}`;
  return `${meta.icon} ${liveWord(state)} • ${teamName(state, 'A')} vs ${teamName(state, 'B')}`;
}

function setList(history = []) {
  return history.map(item => `${num(item.scoreA)}–${num(item.scoreB)}`).join(', ');
}

function cricketResult(state) {
  if (!state.finished || !['A','B'].includes(state.winner)) return finalResult(state);
  const c = state.cricket;
  const winner = teamName(state, state.winner);
  if (c.innings === 2 && state.winner === c.battingTeam && c.target) {
    return `${winner} won by ${Math.max(0, 10 - team(state, c.battingTeam).wickets)} wickets`;
  }
  if (c.innings === 2 && c.target) {
    const chasing = team(state, c.battingTeam);
    return `${winner} won by ${Math.max(0, c.target - 1 - chasing.runs)} runs`;
  }
  return `${winner} won`;
}

function cricketShare(state) {
  const c = state.cricket;
  const batSide = c.battingTeam;
  const bat = team(state, batSide);
  const limit = c.oversLimit ? `/${c.oversLimit}` : '';
  const lines = [shareHeader(state)];
  if (state.finished) {
    const firstSide = c.firstBattingTeam || otherSide(c.battingTeam);
    const secondSide = otherSide(firstSide);
    const first = team(state, firstSide), second = team(state, secondSide);
    lines.push(`${first.name} ${num(first.runs)}/${num(first.wickets)} (${formatOvers(first.balls)} ov)`);
    if (c.innings >= 2) lines.push(`${second.name} ${num(second.runs)}/${num(second.wickets)} (${formatOvers(second.balls)} ov)`);
    lines.push(cricketResult(state));
  } else {
    lines.push(`${bat.name} ${num(bat.runs)}/${num(bat.wickets)} (${formatOvers(bat.balls)}${limit} ov) • ${currentStatus(state)}`);
  }
  if (!state.finished && c.inningsComplete) {
    if (c.innings === 1) lines.push(`${teamName(state,otherSide(batSide))} will chase ${num(bat.runs) + 1}`);
    else lines.push('Awaiting final result confirmation');
  }
  else if (!state.finished) {
    const first = c.battingStats?.[batSide]?.[c.striker] || {};
    const second = c.battingStats?.[batSide]?.[c.nonStriker] || {};
    lines.push(`${c.striker} ${num(first.runs)}* (${num(first.balls)}) • ${c.nonStriker} ${num(second.runs)}* (${num(second.balls)})`);
    if (c.target) {
      const ballsLeft = Math.max(0, num(c.oversLimit) * 6 - num(bat.balls));
      const needed = Math.max(0, num(c.target) - num(bat.runs));
      lines.push(`Target ${c.target} • Need ${needed} from ${ballsLeft}`);
    } else lines.push(`Run rate ${bat.balls ? (bat.runs / (bat.balls / 6)).toFixed(2) : '0.00'} • ${c.bowler} bowling`);
  }
  return lines;
}

export function formatShareMessage(state) {
  if (!state?.sport) return 'Scorer game update';
  if (state.sport === 'cricket') return [...cricketShare(state), 'Shared from Scorer'].join('\n');

  const a = teamName(state, 'A');
  const b = teamName(state, 'B');
  const lines = [shareHeader(state)];
  if (state.sport === 'volleyball') {
    lines.push(`${a} ${state.teamA.sets}–${state.teamB.sets} ${b} • ${currentStatus(state)} ${state.teamA.score}–${state.teamB.score}`);
    const sets = setList(state.volleyball.setHistory);
    if (sets) lines.push(`Completed sets: ${sets}`);
    if (!state.finished && state.volleyball.phase !== 'set_break') lines.push(`${teamName(state, state.volleyball.servingTeam)} serving`);
  } else if (state.sport === 'basketball') {
    lines.push(`${a} ${state.teamA.score}–${state.teamB.score} ${b} • ${currentStatus(state)}`);
    if (!state.finished && !periodHasEnded(state)) lines.push(`${teamName(state, state.basketball.possession)} possession • Fouls ${state.teamA.fouls}–${state.teamB.fouls} • TO ${state.basketball.timeouts.A}–${state.basketball.timeouts.B}`);
  } else if (state.sport === 'soccer') {
    lines.push(`${a} ${state.teamA.score}–${state.teamB.score} ${b} • ${currentStatus(state)}`);
    lines.push(`Cards: ${a} ${state.teamA.yellows}Y/${state.teamA.reds}R • ${b} ${state.teamB.yellows}Y/${state.teamB.reds}R`);
  } else if (state.sport === 'football') {
    lines.push(`${a} ${state.teamA.score}–${state.teamB.score} ${b} • ${currentStatus(state)}`);
    if (!state.finished && !periodHasEnded(state)) lines.push(`${state.football.down}${state.football.down === 1 ? 'st' : state.football.down === 2 ? 'nd' : state.football.down === 3 ? 'rd' : 'th'} & ${state.football.distance} • ${teamName(state, state.football.possession)} ball • TO ${state.football.timeouts.A}–${state.football.timeouts.B}`);
  } else if (state.sport === 'tennis') {
    lines.push(`${a} ${state.tennis.sets.A}–${state.tennis.sets.B} ${b} (sets) • ${currentStatus(state)}`);
    const sets = setList(state.tennis.setHistory);
    lines.push(joinNonEmpty([sets ? `Sets ${sets}` : '', `Games ${state.tennis.games.A}–${state.tennis.games.B}`, `Point ${formatTennisPoint(state,'A')}–${formatTennisPoint(state,'B')}`]));
    if (!state.finished && state.tennis.phase !== 'set_break') lines.push(`${teamName(state, state.tennis.servingTeam)} serving`);
  } else if (state.sport === 'badminton') {
    lines.push(`${a} ${state.badminton.games.A}–${state.badminton.games.B} ${b} (games) • ${currentStatus(state)} ${state.badminton.points.A}–${state.badminton.points.B}`);
    const games = setList(state.badminton.gameHistory);
    if (games) lines.push(`Completed games: ${games}`);
    if (!state.finished && state.badminton.phase !== 'game_break') lines.push(`${teamName(state, state.badminton.servingTeam)} serving`);
  } else if (state.sport === 'lacrosse') {
    lines.push(`${a} ${state.teamA.score}–${state.teamB.score} ${b} • ${currentStatus(state)}`);
    if (!state.finished && !periodHasEnded(state)) {
      const possession = ['A','B'].includes(state.lacrosse.possession)
        ? `Possession: ${teamName(state,state.lacrosse.possession)}`
        : `Restart pending${state.lacrosse.restartType ? ` (${state.lacrosse.restartType})` : ''}`;
      lines.push(`${possession}${state.lacrosse.shotClockSeconds > 0 ? ` • Shot ${state.lacrosse.shotClock}` : ''} • TO left: ${a} ${state.lacrosse.timeouts.A}, ${b} ${state.lacrosse.timeouts.B}`);
    }
  } else if (state.sport === 'kabaddi') {
    lines.push(`${a} ${state.teamA.score}–${state.teamB.score} ${b} • ${currentStatus(state)}`);
    if (!state.finished && (!periodHasEnded(state) || state.kabaddi.raidRunning || state.kabaddi.raidPoints > 0)) lines.push(`${teamName(state, state.kabaddi.raidingTeam)} raiding • ${state.kabaddi.raidClock}s raid clock${state.kabaddi.raidPoints ? ` • Pending +${state.kabaddi.raidPoints}` : ''}`);
    lines.push(`Completed raids: ${a} ${state.kabaddi.raidsCompleted.A}, ${b} ${state.kabaddi.raidsCompleted.B} • All Outs ${eventCount(state,'kabaddi.all_out_bonus','A')}–${eventCount(state,'kabaddi.all_out_bonus','B')}`);
  } else if (state.sport === 'baseball') {
    const bb = state.baseball;
    const visitor = bb.firstBat, home = bb.homeSide;
    const v = teamName(state,visitor), h = teamName(state,home);
    lines.push(`${v} ${team(state,visitor).score}–${team(state,home).score} ${h} • ${currentStatus(state)}`);
    const liveCount = !state.finished && bb.phase === 'live' ? ` • Count ${bb.balls}–${bb.strikes} · ${bb.outs} out${bb.outs === 1 ? '' : 's'}` : '';
    lines.push(`R/H/E: ${v} ${team(state,visitor).score}/${bb.hits[visitor]}/${bb.errors[visitor]} · ${h} ${team(state,home).score}/${bb.hits[home]}/${bb.errors[home]}${liveCount}`);
    if (bb.phase === 'mid_inning') lines.push(`${h} bats next`);
    if (bb.phase === 'end_inning') lines.push(`${v} bats next`);
  }
  if (state.finished && !lines.some(line => line === finalResult(state))) lines.push(finalResult(state));
  lines.push('Shared from Scorer');
  return lines.filter(Boolean).join('\n');
}

function scoreHero(state, eyebrow = currentStatus(state), detail = '') {
  return `<section class="full-score-hero"><div><span>${esc(eyebrow)}</span><strong>${esc(teamName(state,'A'))} <b>${num(state.teamA.score)}</b></strong><strong>${esc(teamName(state,'B'))} <b>${num(state.teamB.score)}</b></strong></div>${detail ? `<p>${esc(detail)}</p>` : ''}</section>`;
}

function racketHero(state, sport) {
  const data = state[sport];
  const unit = sport === 'tennis' ? 'sets' : 'games';
  const valueA = sport === 'tennis' ? data.sets.A : data.games.A;
  const valueB = sport === 'tennis' ? data.sets.B : data.games.B;
  return `<section class="full-score-hero"><div><span>${esc(currentStatus(state))}</span><strong>${esc(teamName(state,'A'))} <b>${num(valueA)}</b></strong><strong>${esc(teamName(state,'B'))} <b>${num(valueB)}</b></strong></div><p>${esc(liveWord(state))} • ${esc(unit)} • best of ${num(data.bestOf)}</p></section>`;
}

function scoreSnapshots(state, count) {
  const result = { A:Array(count).fill(0), B:Array(count).fill(0) };
  const last = { A:0, B:0 };
  for (const event of state.events || []) {
    const index = Math.min(count - 1, Math.max(0, num(event.period || 1) - 1));
    if (Number.isFinite(Number(event.scoreA)) && Number.isFinite(Number(event.scoreB))) {
      const nextA = num(event.scoreA), nextB = num(event.scoreB);
      result.A[index] += nextA - last.A;
      result.B[index] += nextB - last.B;
      last.A = nextA; last.B = nextB;
    } else if (event.type === 'score.adjusted' && ['A','B'].includes(event.side)) {
      result[event.side][index] += num(event.delta);
      last[event.side] += num(event.delta);
    }
  }
  result.reliable = { A:true, B:true };
  const verify = side => {
    const expected = num(team(state, side).score);
    const found = result[side].reduce((sum, value) => sum + value, 0);
    if (found !== expected || result[side].some(value => value < 0)) result.reliable[side] = false;
  };
  verify('A'); verify('B');
  return result;
}

function lineScore(state, labels, options = {}) {
  const totals = scoreSnapshots(state, labels.length);
  const extra = options.extra || (() => '');
  const columns = labels.map(label => `<th>${esc(label)}</th>`).join('');
  const row = side => `<tr><td>${esc(teamName(state,side))}</td>${totals[side].map((value,index) => {
    const unplayed = index + 1 > num(state.period) && !state.finished;
    return `<td>${totals.reliable[side] && !unplayed ? value : '—'}</td>`;
  }).join('')}<td class="full-total">${num(team(state,side).score)}</td>${extra(side)}</tr>`;
  return `<div class="full-table-scroll"><table class="full-score-table"><thead><tr><th>Team</th>${columns}<th>T</th>${options.extraHead || ''}</tr></thead><tbody>${row('A')}${row('B')}</tbody></table></div>`;
}

function teamSportMarkup(state) {
  let labels = ['1','2'];
  let extras = '';
  if (['basketball','football','lacrosse'].includes(state.sport)) labels = Array.from({length:Math.max(4, num(state.period))}, (_, i) => i < 4 ? `Q${i+1}` : `OT${i-3}`);
  if (state.sport === 'soccer') labels = ['1H','2H'];
  if (state.sport === 'kabaddi') labels = ['1H','2H'];
  if (state.sport === 'basketball' && !state.finished && !periodHasEnded(state)) extras = `<div class="full-stat-grid"><span><b>${state.teamA.fouls}–${state.teamB.fouls}</b>Team fouls</span><span><b>${state.basketball.timeouts.A}–${state.basketball.timeouts.B}</b>Timeouts left</span><span><b>${esc(teamName(state,state.basketball.possession))}</b>Possession</span></div>`;
  if (state.sport === 'soccer') extras = `<div class="full-stat-grid"><span><b>${state.teamA.yellows}–${state.teamB.yellows}</b>Yellow cards</span><span><b>${state.teamA.reds}–${state.teamB.reds}</b>Red cards</span><span><b>${clockText(state)}</b>Match clock</span></div>`;
  if (state.sport === 'football' && !state.finished && !periodHasEnded(state)) extras = `<div class="full-stat-grid"><span><b>${state.football.down}${state.football.down===1?'st':state.football.down===2?'nd':state.football.down===3?'rd':'th'} &amp; ${state.football.distance}</b>Situation</span><span><b>${esc(teamName(state,state.football.possession))}</b>Possession</span><span><b>${state.football.timeouts.A}–${state.football.timeouts.B}</b>Timeouts left</span></div>`;
  if (state.sport === 'lacrosse' && !state.finished && !periodHasEnded(state)) {
    const possession = ['A','B'].includes(state.lacrosse.possession) ? teamName(state,state.lacrosse.possession) : 'Restart pending';
    extras = `<div class="full-stat-grid"><span><b>${esc(state.lacrosse.discipline === 'sixes' ? 'Sixes' : 'Field')}</b>Format</span><span><b>${esc(possession)}</b>Possession</span><span><b>${state.lacrosse.shotClockSeconds > 0 ? state.lacrosse.shotClock : 'Off'}</b>Shot clock</span><span><b>${state.lacrosse.timeouts.A}–${state.lacrosse.timeouts.B}</b>Timeouts left</span></div>`;
  }
  if (state.sport === 'kabaddi') {
    const liveRaid = !state.finished && (!periodHasEnded(state) || state.kabaddi.raidRunning || state.kabaddi.raidPoints > 0)
      ? `<span><b>${esc(teamName(state,state.kabaddi.raidingTeam))}</b>Current raid</span><span><b>${state.kabaddi.raidClock}s${state.kabaddi.raidPoints ? ` · +${state.kabaddi.raidPoints} pending` : ''}</b>Raid clock</span>`
      : '';
    extras = `<div class="full-stat-grid">${liveRaid}<span><b>${state.kabaddi.raidsCompleted.A}–${state.kabaddi.raidsCompleted.B}</b>Completed raids</span><span><b>${eventCount(state,'kabaddi.all_out_bonus','A')}–${eventCount(state,'kabaddi.all_out_bonus','B')}</b>All Outs</span></div>`;
  }
  return `${scoreHero(state)}<section class="full-score-section"><h3>${state.sport === 'soccer' || state.sport === 'kabaddi' ? 'Half-by-half' : 'Period scoring'}</h3>${lineScore(state,labels)}</section>${extras}`;
}

function volleyballMarkup(state) {
  const history = [...state.volleyball.setHistory];
  if (!state.finished) history.push({ scoreA:state.teamA.score, scoreB:state.teamB.score, current:true });
  const headers = history.map((_, index) => `<th>S${index+1}</th>`).join('');
  const row = side => `<tr><td>${esc(teamName(state,side))}${state.volleyball.servingTeam === side && !state.finished ? '<i class="full-serve-dot" title="Serving"></i>' : ''}</td>${history.map(item => `<td${item.current?' class="full-current-cell"':''}>${num(item[`score${side}`])}</td>`).join('')}<td class="full-total">${team(state,side).sets}</td></tr>`;
  const liveDetails = state.finished ? '' : `<div class="full-stat-grid"><span><b>${state.volleyball.phase === 'set_break' ? 'Between sets' : esc(teamName(state,state.volleyball.servingTeam))}</b>${state.volleyball.phase === 'set_break' ? 'Status' : 'Serving'}</span><span><b>${state.volleyball.timeouts.A}–${state.volleyball.timeouts.B}</b>Timeouts left</span><span><b>${state.period}</b>${state.volleyball.phase === 'set_break' ? 'Next set' : 'Current set'}</span></div>`;
  return `${scoreHero(state,`${liveWord(state)} • Best of ${state.volleyball.bestOf}`)}<section class="full-score-section"><h3>Set score</h3><div class="full-table-scroll"><table class="full-score-table"><thead><tr><th>Team</th>${headers}<th>Sets</th></tr></thead><tbody>${row('A')}${row('B')}</tbody></table></div></section>${liveDetails}`;
}

function racketMarkup(state, sport) {
  const data = state[sport];
  const history = sport === 'tennis' ? data.setHistory : data.gameHistory;
  const current = sport === 'tennis' ? { scoreA:data.games.A, scoreB:data.games.B } : { scoreA:data.points.A, scoreB:data.points.B };
  const sets = [...history];
  if (!state.finished) sets.push({ ...current, current:true });
  const headers = sets.map((_, index) => `<th>${sport === 'tennis' ? 'S' : 'G'}${index+1}</th>`).join('');
  const won = side => sport === 'tennis' ? data.sets[side] : data.games[side];
  const tiebreakSuffix = (item, side) => {
    if (sport !== 'tennis' || !item.tiebreak) return '';
    const [a,b] = String(item.tiebreak).split('-');
    const losingSide = num(item.scoreA) < num(item.scoreB) ? 'A' : 'B';
    return side === losingSide ? `<small> (${esc(side === 'A' ? a : b)})</small>` : '';
  };
  const row = side => `<tr><td>${esc(teamName(state,side))}${data.servingTeam === side && !state.finished && data.phase !== 'set_break' && data.phase !== 'game_break' ? '<i class="full-serve-dot" title="Serving"></i>' : ''}</td>${sets.map(item => `<td${item.current?' class="full-current-cell"':''}>${num(item[`score${side}`])}${tiebreakSuffix(item,side)}</td>`).join('')}<td class="full-total">${won(side)}</td></tr>`;
  const point = sport === 'tennis' ? `${formatTennisPoint(state,'A')}–${formatTennisPoint(state,'B')}` : `${data.points.A}–${data.points.B}`;
  const between = data.phase === 'set_break' || data.phase === 'game_break';
  const liveDetails = state.finished ? '' : `<div class="full-stat-grid"><span><b>${between ? 'Break' : point}</b>${between ? 'Status' : `Current ${sport === 'tennis' ? 'point' : 'game'}`}</span><span><b>${between ? '—' : esc(teamName(state,data.servingTeam))}</b>${between ? 'Serve selected next' : 'Serving'}</span><span><b>${state.period}</b>${between ? 'Next' : 'Current'} ${sport === 'tennis' ? 'set' : 'game'}</span></div>`;
  return `${racketHero(state,sport)}<section class="full-score-section"><h3>${sport === 'tennis' ? 'Set matrix' : 'Game matrix'}</h3><div class="full-table-scroll"><table class="full-score-table"><thead><tr><th>Player / team</th>${headers}<th>${sport === 'tennis' ? 'Sets' : 'Games'}</th></tr></thead><tbody>${row('A')}${row('B')}</tbody></table></div></section>${liveDetails}`;
}

function dismissalText(state, side, name, active, row) {
  const item = (state.cricket.dismissals?.[side] || []).find(entry => entry.batter === name);
  if (item?.type === 'run out') return 'run out';
  if (item?.bowler) return `b ${item.bowler}`;
  if (item) return item.type || 'out';
  if (active) return 'not out';
  const appeared = num(row?.runs) > 0 || num(row?.balls) > 0 || (state.events || []).some(event =>
    event.type === 'cricket.delivery' && event.battingTeam === side &&
    [event.striker,event.nonStriker,event.dismissedName].includes(name));
  if (appeared) return 'not out';
  return 'did not bat';
}

function cricketBatters(state, side) {
  const c = state.cricket;
  const stats = c.battingStats?.[side] || {};
  const names = [...new Set([...(team(state,side).roster || []), ...Object.keys(stats)])];
  return names.map(name => {
    const row = stats[name] || { name, runs:0, balls:0, fours:0, sixes:0, out:false };
    const active = side === c.battingTeam && (name === c.striker || name === c.nonStriker) && !row.out;
    return `<tr><td><strong>${esc(name)}${active?'*':''}</strong><small>${esc(dismissalText(state,side,name,active,row))}</small></td><td>${num(row.runs)}</td><td>${num(row.balls)}</td><td>${num(row.fours)}</td><td>${num(row.sixes)}</td><td>${strikeRate(row.runs,row.balls)}</td></tr>`;
  }).join('') || '<tr><td colspan="6">No batting roster entered</td></tr>';
}

function cricketBowlers(state, battingSide) {
  const fieldSide = otherSide(battingSide);
  const stats = state.cricket.bowlingStats?.[fieldSide] || {};
  const names = [...new Set([...(team(state,fieldSide).roster || []), ...Object.keys(stats)])]
    .filter(name => num(stats[name]?.balls) || num(stats[name]?.runs) || num(stats[name]?.wickets) || (fieldSide === otherSide(state.cricket.battingTeam) && name === state.cricket.bowler));
  return names.map(name => {
    const row = stats[name] || { balls:0, runs:0, wickets:0 };
    return `<tr><td><strong>${esc(name)}</strong></td><td>${formatOvers(row.balls)}</td><td>—</td><td>${num(row.runs)}</td><td>${num(row.wickets)}</td><td>${economy(row.runs,row.balls)}</td></tr>`;
  }).join('') || '<tr><td colspan="6">No bowling figures yet</td></tr>';
}

function cricketInnings(state, side, number) {
  const t = team(state,side);
  const c = state.cricket;
  const extras = c.extras?.[side] || { wides:0, noBalls:0 };
  const totalExtras = num(extras.wides) + num(extras.noBalls);
  const fow = (c.dismissals?.[side] || []).map(item => `${item.score}/${item.wicket} (${item.batter})`).join(' · ');
  return `<article class="cricket-full-innings"><header><div><span>${number === 1 ? '1st' : '2nd'} innings</span><h3>${esc(t.name)}</h3></div><strong>${num(t.runs)}/${num(t.wickets)} <small>(${formatOvers(t.balls)} ov)</small></strong></header><h4>Batting</h4><div class="full-table-scroll"><table class="full-score-table cricket-full-table"><thead><tr><th>Batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${cricketBatters(state,side)}<tr class="cricket-total-row"><td><strong>Extras</strong><small>${num(extras.wides)} wd · ${num(extras.noBalls)} nb</small></td><td>${totalExtras}</td><td colspan="4"></td></tr><tr class="cricket-total-row"><td><strong>Total</strong><small>${num(t.wickets) >= 10 ? 'all out' : `${num(t.wickets)} wickets`} · ${formatOvers(t.balls)} overs</small></td><td>${num(t.runs)}</td><td colspan="4"></td></tr></tbody></table></div>${fow ? `<p class="cricket-fow"><b>Fall of wickets</b>${esc(fow)}</p>` : ''}<h4>Bowling</h4><div class="full-table-scroll"><table class="full-score-table cricket-full-table"><thead><tr><th>Bowling</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>${cricketBowlers(state,side)}</tbody></table></div></article>`;
}

function cricketMarkup(state) {
  const c = state.cricket;
  const firstSide = c.firstBattingTeam || (c.innings === 1 ? c.battingTeam : otherSide(c.battingTeam));
  const innings = [cricketInnings(state,firstSide,1)];
  if (c.innings >= 2) innings.push(cricketInnings(state,otherSide(firstSide),2));
  const current = team(state,c.battingTeam);
  const ballsLeft = Math.max(0,num(c.oversLimit)*6-num(current.balls));
  const need = c.target ? Math.max(0,num(c.target)-num(current.runs)) : null;
  const lastWicket = (c.dismissals?.[c.battingTeam] || []).at(-1);
  const partnership = `${Math.max(0,num(current.runs)-num(lastWicket?.score))} runs · ${Math.max(0,num(current.balls)-num(lastWicket?.ball))} balls`;
  const context = c.target ? `Target ${c.target} · Need ${need} from ${ballsLeft}` : `Run rate ${current.balls ? (current.runs/(current.balls/6)).toFixed(2) : '0.00'}`;
  return `<section class="cricket-full-head"><span>${esc(currentStatus(state))}</span><h2>${esc(current.name)} ${num(current.runs)}/${num(current.wickets)}</h2><p>${esc(context)}${state.finished || c.inningsComplete ? '' : ` · Partnership ${esc(partnership)}`}</p></section><div class="cricket-full-list">${innings.join('')}</div>`;
}

function baseballMarkup(state) {
  const bb = state.baseball;
  const count = Math.max(bb.regulationInnings,bb.inning);
  const labels = Array.from({length:count},(_,index)=>String(index+1));
  const cell = (side,value,index) => {
    if (value != null) return num(value);
    if (state.finished && side === bb.homeSide && index === bb.inning - 1 && bb.finishReason === 'home-leading-after-top') return 'X';
    return '·';
  };
  const row = side => `<tr><td>${esc(teamName(state,side))}</td>${labels.map((_,index)=>`<td>${cell(side,bb.runsByInning[side]?.[index],index)}</td>`).join('')}<td class="full-total">${num(team(state,side).score)}</td><td>${num(bb.hits[side])}</td><td>${num(bb.errors[side])}</td></tr>`;
  const bases = ['first','second','third'].filter(base=>bb.bases[base]).map(base=>base[0].toUpperCase()+base.slice(1)).join(', ') || 'Empty';
  const liveDetails = state.finished || bb.phase !== 'live' ? '' : `<div class="full-stat-grid"><span><b>${bb.balls}–${bb.strikes} · ${bb.outs} out${bb.outs===1?'':'s'}</b>Count</span><span><b>${esc(bases)}</b>Runners</span><span><b>${esc(teamName(state,bb.battingTeam))}</b>Batting</span></div>`;
  const hero = `<section class="full-score-hero"><div><span>${esc(currentStatus(state))}</span><strong>${esc(teamName(state,bb.firstBat))} <b>${num(team(state,bb.firstBat).score)}</b></strong><strong>${esc(teamName(state,bb.homeSide))} <b>${num(team(state,bb.homeSide).score)}</b></strong></div><p>Visitor • Home</p></section>`;
  return `${hero}<section class="full-score-section"><h3>Line score</h3><div class="full-table-scroll"><table class="full-score-table"><thead><tr><th>Team</th>${labels.map(label=>`<th>${label}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${row(bb.firstBat)}${row(bb.homeSide)}</tbody></table></div></section>${liveDetails}`;
}

export function fullScoreboardMarkup(state) {
  if (!state?.sport) return '<p class="full-score-empty">Start a game to view its scorecard.</p>';
  if (state.sport === 'cricket') return cricketMarkup(state);
  if (state.sport === 'volleyball') return volleyballMarkup(state);
  if (state.sport === 'tennis' || state.sport === 'badminton') return racketMarkup(state,state.sport);
  if (state.sport === 'baseball') return baseballMarkup(state);
  return teamSportMarkup(state);
}
