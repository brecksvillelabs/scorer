import { formatOvers, strikeRate, economy, teamKey, otherSide } from './sports.js';

const num = value => Number(value || 0);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

export function cleanRosterEntries(roster) {
  const source = Array.isArray(roster) ? roster : String(roster || '').split(/[\n,;]+/);
  const seen = new Set();
  const clean = [];
  for (const item of source) {
    const name = String(item || '').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(name);
    if (clean.length >= 40) break;
  }
  return clean;
}

export function addRosterPlayer(roster, name) {
  return cleanRosterEntries([...(Array.isArray(roster) ? roster : []), name]);
}

export function removeRosterPlayer(roster, nameOrIndex) {
  const clean = cleanRosterEntries(roster);
  if (Number.isInteger(nameOrIndex)) return clean.filter((_, index) => index !== nameOrIndex);
  const target = String(nameOrIndex || '').trim().toLocaleLowerCase();
  return clean.filter(name => name.toLocaleLowerCase() !== target);
}

export function updateSavedTeamRoster(profile, roster, updatedAt = Date.now()) {
  if (!profile || typeof profile !== 'object') return profile;
  return { ...profile, roster: cleanRosterEntries(roster), updatedAt };
}

function team(state, side) { return state?.[teamKey(side)] || {}; }
function teamName(state, side) { return team(state, side).name || `Side ${side}`; }
function cricket(state) { return state?.cricket || {}; }

function inningsDeliveryEvents(state, battingSide) {
  return (state?.events || []).filter(event => event?.type === 'cricket.delivery' && event.battingTeam === battingSide);
}

function appearedBatterNames(state, side) {
  const c = cricket(state);
  const stats = c.battingStats?.[side] || {};
  const appeared = new Set();
  for (const event of inningsDeliveryEvents(state, side)) {
    if (event.striker) appeared.add(event.striker);
    if (event.nonStriker) appeared.add(event.nonStriker);
    if (event.dismissedName) appeared.add(event.dismissedName);
  }
  for (const [name, row] of Object.entries(stats)) {
    if (num(row?.runs) || num(row?.balls) || row?.out) appeared.add(name);
  }
  if (side === c.battingTeam && !state?.finished && !c.inningsComplete) {
    if (c.striker) appeared.add(c.striker);
    if (c.nonStriker) appeared.add(c.nonStriker);
  }
  return appeared;
}

function battingOrder(state, side) {
  const roster = cleanRosterEntries(team(state, side).roster || []);
  const stats = cricket(state).battingStats?.[side] || {};
  const appeared = appearedBatterNames(state, side);
  const all = [...new Set([...roster, ...Object.keys(stats), ...appeared])];
  return all.filter(name => appeared.has(name));
}

export function cricketYetToBat(state, side) {
  const appeared = appearedBatterNames(state, side);
  return cleanRosterEntries(team(state, side).roster || []).filter(name => !appeared.has(name));
}

function dismissalText(state, side, name) {
  const c = cricket(state);
  const row = c.battingStats?.[side]?.[name] || {};
  const item = (c.dismissals?.[side] || []).find(entry => entry?.batter === name);
  const active = side === c.battingTeam && !state?.finished && !c.inningsComplete &&
    (name === c.striker || name === c.nonStriker) && !row.out;
  if (active || (!row.out && appearedBatterNames(state, side).has(name))) return 'not out';
  if (!item) return row.out ? 'out' : 'not out';
  if (item.type === 'run out') return item.fielder ? `run out (${item.fielder})` : 'run out';
  if (item.type === 'caught') {
    const fielder = item.fielder ? `c ${item.fielder} ` : 'c ';
    return item.bowler ? `${fielder}b ${item.bowler}` : `${fielder.trim()}`;
  }
  if (item.type === 'stumped') return `${item.fielder ? `st ${item.fielder} ` : 'st '}b ${item.bowler || ''}`.trim();
  if (item.bowler) return `b ${item.bowler}`;
  return item.type || 'out';
}

function extrasFor(state, side) {
  const raw = cricket(state).extras?.[side] || {};
  return {
    byes:num(raw.byes),
    legByes:num(raw.legByes),
    wides:num(raw.wides),
    noBalls:num(raw.noBalls),
    penalty:num(raw.penalty)
  };
}

function extrasTotal(extras) {
  return Object.values(extras).reduce((sum, value) => sum + num(value), 0);
}

function extrasSummary(extras) {
  const parts = [];
  if (extras.byes) parts.push(`b ${extras.byes}`);
  if (extras.legByes) parts.push(`lb ${extras.legByes}`);
  if (extras.wides) parts.push(`wd ${extras.wides}`);
  if (extras.noBalls) parts.push(`nb ${extras.noBalls}`);
  if (extras.penalty) parts.push(`p ${extras.penalty}`);
  return parts.length ? parts.join(', ') : '0';
}

function bowlerDerivedMap(state, battingSide) {
  const derived = new Map();
  const events = inningsDeliveryEvents(state, battingSide);
  let legalBalls = 0;
  let currentOver = null;

  const rowFor = name => {
    const key = String(name || 'Unknown bowler');
    if (!derived.has(key)) derived.set(key, { dots:0, wides:0, noBalls:0, maidens:0 });
    return derived.get(key);
  };

  const finishOver = () => {
    if (!currentOver || currentOver.finished || currentOver.legal !== 6) return;
    currentOver.finished = true;
    if (currentOver.bowlers.size === 1 && currentOver.runs === 0) {
      const [name] = [...currentOver.bowlers];
      rowFor(name).maidens += 1;
    }
  };

  for (const event of events) {
    const action = String(event.action || '');
    const legal = action !== 'wide' && action !== 'noBall';
    const overIndex = Math.floor(legalBalls / 6);
    if (!currentOver || currentOver.index !== overIndex) {
      finishOver();
      currentOver = { index:overIndex, legal:0, runs:0, bowlers:new Set(), finished:false };
    }
    const bowler = String(event.bowler || 'Unknown bowler');
    const row = rowFor(bowler);
    currentOver.bowlers.add(bowler);
    currentOver.runs += num(event.runs);
    if (action === 'wide') row.wides += Math.max(1, num(event.runs));
    if (action === 'noBall') row.noBalls += Math.max(1, num(event.runs));
    if (legal) {
      currentOver.legal += 1;
      if (num(event.runs) === 0) row.dots += 1;
      legalBalls += 1;
      if (currentOver.legal === 6) finishOver();
    }
  }
  finishOver();
  return derived;
}

function bowlingNames(state, battingSide) {
  const fieldSide = otherSide(battingSide);
  const stats = cricket(state).bowlingStats?.[fieldSide] || {};
  const events = inningsDeliveryEvents(state, battingSide);
  const used = new Set(events.map(event => event.bowler).filter(Boolean));
  for (const [name, row] of Object.entries(stats)) {
    if (num(row?.balls) || num(row?.runs) || num(row?.wickets)) used.add(name);
  }
  if (fieldSide === otherSide(cricket(state).battingTeam) && cricket(state).bowler) used.add(cricket(state).bowler);
  return [...used];
}

function battingRowsMarkup(state, side) {
  const c = cricket(state);
  const stats = c.battingStats?.[side] || {};
  const names = battingOrder(state, side);
  if (!names.length) return '<tr><td colspan="6">No batting activity yet</td></tr>';
  return names.map(name => {
    const row = stats[name] || { runs:0, balls:0, fours:0, sixes:0, out:false };
    const active = side === c.battingTeam && !state.finished && !c.inningsComplete &&
      (name === c.striker || name === c.nonStriker) && !row.out;
    return `<tr${active ? ' class="cricket-gold-active"' : ''}><td><strong>${esc(name)}${active ? '*' : ''}</strong><small>${esc(dismissalText(state,side,name))}</small></td><td>${num(row.runs)}</td><td>${num(row.balls)}</td><td>${num(row.fours)}</td><td>${num(row.sixes)}</td><td>${strikeRate(row.runs,row.balls)}</td></tr>`;
  }).join('');
}

function bowlingRowsMarkup(state, battingSide) {
  const fieldSide = otherSide(battingSide);
  const stats = cricket(state).bowlingStats?.[fieldSide] || {};
  const derived = bowlerDerivedMap(state, battingSide);
  const names = bowlingNames(state, battingSide);
  if (!names.length) return '<tr><td colspan="9">No bowling figures yet</td></tr>';
  return names.map(name => {
    const row = stats[name] || { balls:0, runs:0, wickets:0 };
    const extra = derived.get(name) || { dots:0, wides:0, noBalls:0, maidens:0 };
    return `<tr><td><strong>${esc(name)}</strong></td><td>${formatOvers(row.balls)}</td><td>${extra.maidens}</td><td>${num(row.runs)}</td><td>${num(row.wickets)}</td><td>${economy(row.runs,row.balls)}</td><td>${extra.dots}</td><td>${extra.wides}</td><td>${extra.noBalls}</td></tr>`;
  }).join('');
}

function fallOfWicketsMarkup(state, side) {
  const list = cricket(state).dismissals?.[side] || [];
  if (!list.length) return '';
  const text = list.map(item => `${num(item.score)}/${num(item.wicket)} (${item.batter || 'wicket'}, ${formatOvers(item.ball || 0)} ov)`).join(', ');
  return `<section class="cricket-gold-inline"><h4>Fall of wickets</h4><p>${esc(text)}</p></section>`;
}

function partnershipText(state, side) {
  const t = team(state, side);
  const last = (cricket(state).dismissals?.[side] || []).at(-1);
  const runs = Math.max(0, num(t.runs) - num(last?.score));
  const balls = Math.max(0, num(t.balls) - num(last?.ball));
  return `${runs} runs · ${balls} balls`;
}

function inningsMarkup(state, side, number) {
  const t = team(state, side);
  const extras = extrasFor(state, side);
  const yet = cricketYetToBat(state, side);
  const rr = t.balls ? (num(t.runs) / (num(t.balls) / 6)).toFixed(2) : '0.00';
  const wicketsLabel = num(t.wickets) >= 10 ? 'all out' : `${num(t.wickets)} wicket${num(t.wickets) === 1 ? '' : 's'}`;
  return `<article class="cricket-full-innings cricket-gold-innings" data-cricket-innings="${number}">
    <header><div><span>${number === 1 ? '1st' : '2nd'} innings</span><h3>${esc(t.name || `Side ${side}`)}</h3></div><strong>${num(t.runs)}/${num(t.wickets)} <small>(${formatOvers(t.balls)} ov)</small></strong></header>
    <h4>Batting</h4>
    <div class="full-table-scroll"><table class="full-score-table cricket-full-table"><thead><tr><th>Batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
      ${battingRowsMarkup(state,side)}
      <tr class="cricket-total-row"><td><strong>Extras</strong><small>${esc(extrasSummary(extras))}</small></td><td>${extrasTotal(extras)}</td><td colspan="4"></td></tr>
      <tr class="cricket-total-row"><td><strong>Total</strong><small>${formatOvers(t.balls)} Ov (RR: ${rr}) · ${wicketsLabel}</small></td><td>${num(t.runs)}</td><td colspan="4"></td></tr>
    </tbody></table></div>
    ${yet.length ? `<section class="cricket-gold-inline"><h4>Yet to bat</h4><p>${yet.map(esc).join(', ')}</p></section>` : ''}
    ${fallOfWicketsMarkup(state,side)}
    <section class="cricket-gold-inline"><h4>Partnership</h4><p>${esc(partnershipText(state,side))}</p></section>
    <h4>Bowling</h4>
    <div class="full-table-scroll"><table class="full-score-table cricket-full-table cricket-gold-bowling"><thead><tr><th>Bowling</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>0s</th><th>WD</th><th>NB</th></tr></thead><tbody>${bowlingRowsMarkup(state,side)}</tbody></table></div>
  </article>`;
}

function chaseContext(state) {
  const c = cricket(state);
  const current = team(state, c.battingTeam);
  if (!c.target) {
    const rr = current.balls ? (num(current.runs) / (num(current.balls) / 6)).toFixed(2) : '0.00';
    return `Run rate ${rr}`;
  }
  const ballsLeft = Math.max(0, num(c.oversLimit) * 6 - num(current.balls));
  const need = Math.max(0, num(c.target) - num(current.runs));
  const rrr = ballsLeft > 0 ? (need / (ballsLeft / 6)).toFixed(2) : (need === 0 ? '0.00' : '—');
  return `Target ${num(c.target)} · Need ${need} from ${ballsLeft} · RRR ${rrr}`;
}

export function cricketGoldScorecardMarkup(state) {
  if (!state || state.sport !== 'cricket') return '<p class="full-score-empty">Start a cricket game to view its scorecard.</p>';
  const c = cricket(state);
  const firstSide = c.firstBattingTeam || (c.innings === 1 ? c.battingTeam : otherSide(c.battingTeam));
  const current = team(state, c.battingTeam);
  const status = state.finished ? 'FINAL' : c.inningsComplete ? (c.innings === 1 ? 'INNINGS BREAK' : 'INNINGS COMPLETE') : 'LIVE';
  const innings = [inningsMarkup(state, firstSide, 1)];
  if (c.innings >= 2) innings.push(inningsMarkup(state, otherSide(firstSide), 2));
  return `<div data-cricket-gold-scorecard="true">
    <section class="cricket-full-head cricket-gold-head"><span>${status} · ${esc(teamName(state,'A'))} vs ${esc(teamName(state,'B'))}</span><h2>${esc(current.name)} ${num(current.runs)}/${num(current.wickets)} <small>(${formatOvers(current.balls)} ov)</small></h2><p>${esc(chaseContext(state))}${state.finished || c.inningsComplete ? '' : ` · Partnership ${esc(partnershipText(state,c.battingTeam))}`}</p></section>
    <div class="cricket-full-list">${innings.join('')}</div>
  </div>`;
}

function activeBatterLine(state) {
  const c = cricket(state);
  const side = c.battingTeam;
  const stats = c.battingStats?.[side] || {};
  const one = stats[c.striker] || {};
  const two = stats[c.nonStriker] || {};
  return `${c.striker || 'Striker'} ${num(one.runs)}* (${num(one.balls)}) • ${c.nonStriker || 'Non-striker'} ${num(two.runs)}* (${num(two.balls)})`;
}

function finalResultText(state) {
  if (!state?.finished) return '';
  const c = cricket(state);
  if (state.winner === 'tie' || c.matchWinner === 'tie') return 'Match tied';
  const winnerSide = ['A','B'].includes(state.winner) ? state.winner : c.matchWinner;
  if (!['A','B'].includes(winnerSide)) return 'Final';
  const winner = teamName(state, winnerSide);
  if (c.innings === 2 && c.target && winnerSide === c.battingTeam) {
    return `${winner} won by ${Math.max(0, 10 - num(team(state,c.battingTeam).wickets))} wickets`;
  }
  if (c.innings === 2 && c.target) {
    const chasing = team(state, c.battingTeam);
    return `${winner} won by ${Math.max(0, num(c.target) - 1 - num(chasing.runs))} runs`;
  }
  return `${winner} won`;
}

function inningsScoreLine(state, side) {
  const t = team(state, side);
  return `${t.name || `Side ${side}`} ${num(t.runs)}/${num(t.wickets)} (${formatOvers(t.balls)} ov)`;
}

export function cricketGoldShareMessage(state) {
  if (!state || state.sport !== 'cricket') return 'Scorer cricket update';
  const c = cricket(state);
  const a = teamName(state,'A');
  const b = teamName(state,'B');
  const batSide = c.battingTeam || 'A';
  const bat = team(state,batSide);
  const phase = state.finished ? 'FINAL' : c.inningsComplete ? (c.innings === 1 ? 'INNINGS BREAK' : 'INNINGS COMPLETE') : 'LIVE';
  const lines = [`🏏 ${phase} • ${a} vs ${b}`];

  if (state.finished) {
    const firstSide = c.firstBattingTeam || otherSide(batSide);
    lines.push(inningsScoreLine(state,firstSide));
    if (c.innings >= 2) lines.push(inningsScoreLine(state,otherSide(firstSide)));
    lines.push(finalResultText(state));
  } else if (c.inningsComplete) {
    lines.push(inningsScoreLine(state,batSide));
    if (c.innings === 1) lines.push(`${teamName(state,otherSide(batSide))} need ${num(bat.runs) + 1} to win`);
  } else if (c.target) {
    lines.push(`${bat.name} ${num(bat.runs)}/${num(bat.wickets)} (${formatOvers(bat.balls)} ov) • chasing ${num(c.target)}`);
    lines.push(activeBatterLine(state));
    const ballsLeft = Math.max(0,num(c.oversLimit) * 6 - num(bat.balls));
    const need = Math.max(0,num(c.target) - num(bat.runs));
    const rrr = ballsLeft > 0 ? (need / (ballsLeft / 6)).toFixed(2) : (need === 0 ? '0.00' : '—');
    lines.push(`Need ${need} from ${ballsLeft} • RRR ${rrr}`);
  } else {
    lines.push(`${bat.name} batting • ${num(bat.runs)}/${num(bat.wickets)} (${formatOvers(bat.balls)} ov)`);
    lines.push(activeBatterLine(state));
    const rr = bat.balls ? (num(bat.runs)/(num(bat.balls)/6)).toFixed(2) : '0.00';
    lines.push(`RR ${rr}${c.bowler ? ` • ${c.bowler} bowling` : ''}`);
  }
  lines.push('Shared from Scorer');
  return lines.filter(Boolean).join('\n');
}
