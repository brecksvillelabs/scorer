import { formatOvers, formatTennisPoint } from './sports.js';
import { cricketGoldShareMessage } from './cricket-gold-core.js';

const SPORT_META = Object.freeze({
  volleyball:{icon:'🏐',name:'Volleyball'}, basketball:{icon:'🏀',name:'Basketball'}, soccer:{icon:'⚽',name:'Soccer'},
  football:{icon:'🏈',name:'Football'}, cricket:{icon:'🏏',name:'Cricket'}, tennis:{icon:'🎾',name:'Tennis'},
  badminton:{icon:'🏸',name:'Badminton'}, lacrosse:{icon:'🥍',name:'Lacrosse'}, kabaddi:{icon:'🤼',name:'Kabaddi'},
  baseball:{icon:'⚾',name:'Baseball'}
});

const num = value => Number(value || 0);
const otherSide = side => side === 'A' ? 'B' : 'A';
const teamKey = side => side === 'B' ? 'teamB' : 'teamA';
const team = (state,side) => state?.[teamKey(side)] || {};
const teamName = (state,side) => team(state,side).name || `Side ${side}`;
const score = (state,side) => num(team(state,side).score);
const join = (parts, sep=' • ') => parts.filter(Boolean).join(sep);

function periodEnded(state) {
  const clock = state?.clock || {};
  if (clock.running) return false;
  if (clock.mode === 'down') return num(clock.seconds) === 0;
  if (clock.mode === 'up') return num(clock.targetSeconds) > 0 && num(clock.seconds) >= num(clock.targetSeconds);
  return false;
}

function clockText(state) {
  const seconds = Math.max(0,num(state?.clock?.seconds));
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2,'0')}`;
}

function soccerMinute(state) {
  const seconds = Math.max(0,num(state?.clock?.seconds));
  return `${Math.max(0,Math.ceil(seconds / 60))}'`;
}

function ordinal(value) {
  const n = num(value);
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

function historyText(history=[]) {
  return history.map(item => `${num(item.scoreA)}–${num(item.scoreB)}`).join(', ');
}

function winnerName(state) {
  const side = ['A','B'].includes(state?.winner) ? state.winner : null;
  return side ? teamName(state,side) : '';
}

function header(state, phase='LIVE') {
  const meta = SPORT_META[state?.sport] || {icon:'🏆'};
  if (state?.sport === 'baseball') {
    const visitor = state.baseball?.firstBat || 'B';
    const home = state.baseball?.homeSide || otherSide(visitor);
    return `${meta.icon} ${phase} • ${teamName(state,visitor)} vs ${teamName(state,home)}`;
  }
  return `${meta.icon} ${phase} • ${teamName(state,'A')} vs ${teamName(state,'B')}`;
}

function volleyballShare(state) {
  const v = state.volleyball || {};
  const a = teamName(state,'A'), b = teamName(state,'B');
  const setsA = num(state.teamA?.sets), setsB = num(state.teamB?.sets);
  const sets = historyText(v.setHistory);
  if (state.finished) {
    const winner = winnerName(state);
    return [header(state,'FINAL'), `${winner || a} won ${setsA}–${setsB} sets`, sets ? `Sets: ${sets}` : ''];
  }
  if (v.phase === 'set_break') {
    return [header(state,'SET BREAK'), `${a} ${setsA}–${setsB} ${b} • Set ${state.period} next`, sets ? `Completed sets: ${sets}` : ''];
  }
  const lead = setsA === setsB ? `Sets tied ${setsA}–${setsB}` : `${setsA > setsB ? a : b} leads ${Math.max(setsA,setsB)}–${Math.min(setsA,setsB)} sets`;
  return [header(state), `${lead} • Set ${state.period}: ${score(state,'A')}–${score(state,'B')}`, `${teamName(state,v.servingTeam)} serving${sets ? ` • Sets ${sets}` : ''}`];
}

function basketballShare(state) {
  const a = teamName(state,'A'), b = teamName(state,'B');
  if (state.finished) return [header(state,'FINAL'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, winnerName(state) ? `${winnerName(state)} won` : 'Final'];
  if (periodEnded(state)) {
    const phase = state.period === 2 ? 'HALFTIME' : `END Q${state.period}`;
    return [header(state,phase), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`];
  }
  const bb = state.basketball || {};
  return [header(state), `${a} ${score(state,'A')}–${score(state,'B')} ${b} • Q${state.period} ${clockText(state)}`, `${teamName(state,bb.possession)} ball • Fouls ${num(state.teamA?.fouls)}–${num(state.teamB?.fouls)} • TO ${num(bb.timeouts?.A)}–${num(bb.timeouts?.B)}`];
}

function soccerShare(state) {
  const a = teamName(state,'A'), b = teamName(state,'B');
  const cards = `Cards: ${a} ${num(state.teamA?.yellows)}Y/${num(state.teamA?.reds)}R • ${b} ${num(state.teamB?.yellows)}Y/${num(state.teamB?.reds)}R`;
  if (state.finished) return [header(state,'FINAL'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, winnerName(state) ? `${winnerName(state)} won` : 'Final', cards];
  if (periodEnded(state) && state.period === 1) return [header(state,'HALFTIME'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, cards];
  return [header(state), `${a} ${score(state,'A')}–${score(state,'B')} ${b} • ${soccerMinute(state)}`, cards];
}

function footballShare(state) {
  const a = teamName(state,'A'), b = teamName(state,'B');
  if (state.finished) return [header(state,'FINAL'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, winnerName(state) ? `${winnerName(state)} won` : 'Final'];
  if (periodEnded(state)) {
    const phase = state.period === 2 ? 'HALFTIME' : `END Q${state.period}`;
    return [header(state,phase), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`];
  }
  const f = state.football || {};
  return [header(state), `${a} ${score(state,'A')}–${score(state,'B')} ${b} • Q${state.period} ${clockText(state)}`, `${ordinal(f.down)} & ${num(f.distance)} • ${teamName(state,f.possession)} ball • TO ${a} ${num(f.timeouts?.A)}, ${b} ${num(f.timeouts?.B)}`];
}

function tennisShare(state) {
  const t = state.tennis || {};
  const a = teamName(state,'A'), b = teamName(state,'B');
  const setsA = num(t.sets?.A), setsB = num(t.sets?.B);
  const history = historyText(t.setHistory);
  if (state.finished) {
    return [header(state,'FINAL'), `${winnerName(state) || a} won ${setsA}–${setsB} sets`, history ? `Sets: ${history}` : ''];
  }
  if (t.phase === 'set_break') {
    return [header(state,'SET BREAK'), `${a} ${setsA}–${setsB} ${b} • Set ${state.period} next`, history ? `Completed sets: ${history}` : ''];
  }
  const lead = setsA === setsB ? `Sets tied ${setsA}–${setsB}` : `${setsA > setsB ? a : b} leads ${Math.max(setsA,setsB)}–${Math.min(setsA,setsB)} sets`;
  return [header(state), `${lead} • Set ${state.period}: ${num(t.games?.A)}–${num(t.games?.B)}`, `Current game ${formatTennisPoint(state,'A')}–${formatTennisPoint(state,'B')} • ${teamName(state,t.servingTeam)} serving${history ? ` • Sets ${history}` : ''}`];
}

function badmintonShare(state) {
  const d = state.badminton || {};
  const a = teamName(state,'A'), b = teamName(state,'B');
  const gamesA = num(d.games?.A), gamesB = num(d.games?.B);
  const history = historyText(d.gameHistory);
  if (state.finished) return [header(state,'FINAL'), `${winnerName(state) || a} won ${gamesA}–${gamesB} games`, history ? `Games: ${history}` : ''];
  if (d.phase === 'game_break') return [header(state,'GAME BREAK'), `${a} ${gamesA}–${gamesB} ${b} • Game ${state.period} next`, history ? `Completed games: ${history}` : ''];
  const lead = gamesA === gamesB ? `Games tied ${gamesA}–${gamesB}` : `${gamesA > gamesB ? a : b} leads ${Math.max(gamesA,gamesB)}–${Math.min(gamesA,gamesB)} games`;
  return [header(state), `${lead} • Game ${state.period}: ${num(d.points?.A)}–${num(d.points?.B)}`, `${teamName(state,d.servingTeam)} serving${history ? ` • Games ${history}` : ''}`];
}

function lacrosseShare(state) {
  const l = state.lacrosse || {};
  const a = teamName(state,'A'), b = teamName(state,'B');
  if (state.finished) return [header(state,'FINAL'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, winnerName(state) ? `${winnerName(state)} won` : 'Final'];
  if (periodEnded(state)) {
    const phase = state.period === 2 ? 'HALFTIME' : `END Q${state.period}`;
    return [header(state,phase), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`];
  }
  const possession = ['A','B'].includes(l.possession) ? `Possession: ${teamName(state,l.possession)}` : `Restart pending${l.restartType ? ` (${l.restartType})` : ''}`;
  const shot = num(l.shotClockSeconds) > 0 ? `Shot ${num(l.shotClock)}` : '';
  return [header(state), `${a} ${score(state,'A')}–${score(state,'B')} ${b} • Q${state.period} ${clockText(state)}`, join([possession,shot,`TO ${a} ${num(l.timeouts?.A)}, ${b} ${num(l.timeouts?.B)}`])];
}

function eventCount(state,type,side) {
  return (state.events || []).filter(event => event.type === type && (!side || event.side === side)).length;
}

function kabaddiShare(state) {
  const k = state.kabaddi || {};
  const a = teamName(state,'A'), b = teamName(state,'B');
  const allA = eventCount(state,'kabaddi.all_out_bonus','A');
  const allB = eventCount(state,'kabaddi.all_out_bonus','B');
  if (state.finished) return [header(state,'FINAL'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, winnerName(state) ? `${winnerName(state)} won by ${Math.abs(score(state,'A')-score(state,'B'))}` : 'Final', (allA || allB) ? `All Outs: ${a} ${allA}–${allB} ${b}` : ''];
  const lastRaid = periodEnded(state) && (k.raidRunning || num(k.raidPoints) > 0);
  if (periodEnded(state) && !lastRaid) return [header(state,state.period === 1 ? 'HALFTIME' : 'BREAK'), `${a} ${score(state,'A')}–${score(state,'B')} ${b}`, (allA || allB) ? `All Outs: ${a} ${allA}–${allB} ${b}` : ''];
  const doOrDie = num(k.emptyRaidStreak?.[k.raidingTeam]) >= 2 ? 'Do-or-die raid' : '';
  return [header(state,lastRaid ? 'LAST RAID' : 'LIVE'), `${a} ${score(state,'A')}–${score(state,'B')} ${b} • ${state.period === 1 ? '1st' : '2nd'} half ${clockText(state)}`, join([`${teamName(state,k.raidingTeam)} raiding`, `Raid ${num(k.raidClock)}s`, num(k.raidPoints) ? `Pending +${num(k.raidPoints)}` : '', doOrDie]), (allA || allB) ? `All Outs: ${a} ${allA}–${allB} ${b}` : ''];
}

function runnersText(bases={}) {
  const names = [];
  if (bases.first) names.push('1st');
  if (bases.second) names.push('2nd');
  if (bases.third) names.push('3rd');
  return names.length ? `Runners ${names.join(' & ')}` : 'Bases empty';
}

function baseballShare(state) {
  const b = state.baseball || {};
  const visitor = b.firstBat || 'B';
  const home = b.homeSide || otherSide(visitor);
  const v = teamName(state,visitor), h = teamName(state,home);
  const scoreLine = `${v} ${score(state,visitor)}–${score(state,home)} ${h}`;
  const rhe = `R/H/E: ${v} ${score(state,visitor)}/${num(b.hits?.[visitor])}/${num(b.errors?.[visitor])} • ${h} ${score(state,home)}/${num(b.hits?.[home])}/${num(b.errors?.[home])}`;
  if (state.finished || b.phase === 'final') return [header(state,'FINAL'), scoreLine, winnerName(state) ? `${winnerName(state)} won` : 'Final', rhe];
  if (b.phase === 'mid_inning') return [header(state,'MID INNING'), `${scoreLine} • Mid ${num(b.inning)}`, `${h} bats next`, rhe];
  if (b.phase === 'end_inning') return [header(state,'END INNING'), `${scoreLine} • End ${Math.max(1,num(b.inning)-1)}`, `${v} bats next`, rhe];
  const phase = `${b.half === 'bottom' ? 'Bot' : 'Top'} ${num(b.inning)}`;
  return [header(state), `${scoreLine} • ${phase}`, `${num(b.outs)} out${num(b.outs) === 1 ? '' : 's'} • Count ${num(b.balls)}–${num(b.strikes)} • ${runnersText(b.bases)}`, rhe];
}

export function scoreShareGoldTitle(state) {
  if (!state?.sport) return 'Scorer update';
  if (state.sport === 'baseball') {
    const visitor = state.baseball?.firstBat || 'B';
    const home = state.baseball?.homeSide || otherSide(visitor);
    return `Scorer update: ${teamName(state,visitor)} vs ${teamName(state,home)}`;
  }
  return `Scorer update: ${teamName(state,'A')} vs ${teamName(state,'B')}`;
}

export function formatShareGoldMessage(state) {
  if (!state?.sport) return 'Scorer game update';
  if (state.sport === 'cricket') return cricketGoldShareMessage(state);
  const builders = {
    volleyball:volleyballShare, basketball:basketballShare, soccer:soccerShare, football:footballShare,
    tennis:tennisShare, badminton:badmintonShare, lacrosse:lacrosseShare, kabaddi:kabaddiShare, baseball:baseballShare
  };
  const lines = (builders[state.sport]?.(state) || [header(state),'Game update']).filter(Boolean);
  lines.push('Shared from Scorer');
  return lines.join('\n');
}
