function teamKey(side) { return side === 'B' ? 'teamB' : 'teamA'; }
function otherSide(side) { return side === 'A' ? 'B' : 'A'; }

export function fieldingSide(state) {
  if (!state?.cricket) return null;
  return otherSide(state.cricket.battingTeam || 'A');
}

function generatedBowlerNumber(name) {
  const match = /^Bowler\s+(\d+)$/i.exec(String(name || '').trim());
  return match ? Number(match[1]) : 0;
}

export function nextGeneratedBowlerName(state) {
  if (!state?.cricket) return 'Bowler 1';
  const side = fieldingSide(state);
  const fieldTeam = state[teamKey(side)] || {};
  const stats = state.cricket.bowlingStats?.[side] || {};
  const names = [state.cricket.bowler, ...(fieldTeam.roster || []), ...Object.keys(stats)].filter(Boolean);
  const max = names.reduce((value, name) => Math.max(value, generatedBowlerNumber(name)), 0);
  return `Bowler ${Math.max(1, max + 1)}`;
}

export function eligibleNextBowlers(state) {
  if (state?.sport !== 'cricket' || !state.cricket?.needsBowler) return [];
  const side = fieldingSide(state);
  const fieldTeam = state[teamKey(side)] || {};
  const stats = state.cricket.bowlingStats?.[side] || {};
  const current = String(state.cricket.bowler || '').trim();
  const seen = new Set();
  const names = [];

  for (const raw of [...(fieldTeam.roster || []), ...Object.keys(stats)]) {
    const name = String(raw || '').trim();
    if (!name || name === current || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  // A no-roster quick-score match must always have a one-tap way forward.
  if (!(fieldTeam.roster || []).length) {
    const generated = nextGeneratedBowlerName(state);
    if (generated !== current && !seen.has(generated)) names.push(generated);
  }

  return names.map(name => ({ name, ...bowlerFigures(state, name) }));
}

export function bowlerFigures(state, name) {
  if (!state?.cricket) return { balls: 0, runs: 0, wickets: 0, overs: '0.0', economy: '0.00' };
  const side = fieldingSide(state);
  const stat = state.cricket.bowlingStats?.[side]?.[name] || {};
  const balls = Math.max(0, Number(stat.balls || 0));
  const runs = Math.max(0, Number(stat.runs || 0));
  const wickets = Math.max(0, Number(stat.wickets || 0));
  const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
  const economy = balls ? (runs / (balls / 6)).toFixed(2) : '0.00';
  return { balls, runs, wickets, overs, economy };
}

export function canChooseBowler(state, name) {
  const candidate = String(name || '').trim();
  if (state?.sport !== 'cricket' || !state.cricket?.needsBowler || !candidate) return false;
  return candidate !== String(state.cricket.bowler || '').trim();
}
