export function baseballSetupMarkup() {
  return `
    <label>Game length<select id="settingBaseballInnings"><option value="9" selected>9 innings · regulation</option><option value="7">7 innings · school</option><option value="6">6 innings · youth</option></select></label>
    <label>Bats first<select id="settingBaseballFirstBat"><option value="B" selected>Side B · away/visitor</option><option value="A">Side A</option></select></label>`;
}

function inningCell(value) { return value == null ? '·' : String(value); }

export function baseballBoardMarkup(state, helpers) {
  const { esc, safeColor, logoMarkup } = helpers;
  const b = state.baseball;
  const bat = b.battingTeam;
  const field = bat === 'A' ? 'B' : 'A';
  const batting = state[bat === 'A' ? 'teamA' : 'teamB'];
  const fielding = state[field === 'A' ? 'teamA' : 'teamB'];
  const columns = Math.max(b.regulationInnings, b.inning);
  const innings = Array.from({ length: columns }, (_, i) => i + 1);
  const baseClass = key => b.bases[key] ? 'occupied' : '';
  const half = b.half === 'bottom' ? 'BOTTOM' : 'TOP';
  const lineOrder = [b.firstBat, b.homeSide];

  return `<section class="v035-baseball-board">
    <div class="v035-baseball-hero">
      <div><div class="eyebrow">BASEBALL · ${half} ${b.inning}</div><strong>${esc(batting.name)} batting</strong><div class="team-sub">vs ${esc(fielding.name)}</div></div>
      <div class="v035-bso" aria-label="Ball strike out count"><span><small>B</small><b>${b.balls}</b></span><span><small>S</small><b>${b.strikes}</b></span><span><small>O</small><b>${b.outs}</b></span></div>
    </div>

    <div class="v035-line-score-wrap"><table class="v035-line-score"><thead><tr><th>Team</th>${innings.map(n=>`<th>${n}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>
      ${lineOrder.map(side=>{const t=state[side==='A'?'teamA':'teamB']; const row=b.runsByInning[side]||[]; return `<tr class="${b.battingTeam===side?'batting-row':''}"><td><span class="v035-line-dot" style="--team-color:${safeColor(t.color)}"></span>${esc(t.name)}</td>${innings.map((_,i)=>`<td>${inningCell(row[i])}</td>`).join('')}<td class="total">${t.score}</td><td>${b.hits[side]}</td><td>${b.errors[side]}</td></tr>`;}).join('')}
    </tbody></table></div>

    <div class="v035-baseball-main">
      <article class="v035-baseball-team" style="--team-color:${safeColor(batting.color)}"><div class="team-head"><div class="team-logo">${logoMarkup(bat)}</div><div><div class="team-name">${esc(batting.name)}</div><div class="team-sub">AT BAT · ${b.outs} out${b.outs===1?'':'s'}</div></div></div><div class="v035-baseball-score">${batting.score}</div></article>
      <div class="v035-diamond" aria-label="Base runners"><button class="base second ${baseClass('second')}" data-action="baseball-base" data-value="second" aria-label="Toggle runner on second base" aria-pressed="${b.bases.second}"><span>2</span></button><button class="base third ${baseClass('third')}" data-action="baseball-base" data-value="third" aria-label="Toggle runner on third base" aria-pressed="${b.bases.third}"><span>3</span></button><div class="plate"><span>◆</span></div><button class="base first ${baseClass('first')}" data-action="baseball-base" data-value="first" aria-label="Toggle runner on first base" aria-pressed="${b.bases.first}"><span>1</span></button></div>
    </div>

    <div class="v035-baseball-actions">
      <button class="score-btn" data-action="baseball-pitch" data-value="ball">Ball</button>
      <button class="score-btn" data-action="baseball-pitch" data-value="strike">Strike</button>
      <button class="score-btn" data-action="baseball-pitch" data-value="foul">Foul</button>
      <button class="score-btn danger" data-action="baseball-pa" data-value="out">Out +1</button>
      <button class="score-btn primary" data-action="baseball-run" data-delta="1">Run +1</button>
      <button class="score-btn primary" data-action="baseball-hit" data-delta="1">Hit +1</button>
      <button class="score-btn" data-action="baseball-error" data-delta="1">${esc(fielding.name)} error +1</button>
      <button class="score-btn" data-action="baseball-pa" data-value="walk">Walk</button>
      <button class="score-btn" data-action="baseball-pa" data-value="hbp">HBP</button>
    </div>
  </section>`;
}

export function baseballToolsMarkup(state, esc) {
  const b = state.baseball;
  const bat = b.battingTeam;
  const field = bat === 'A' ? 'B' : 'A';
  const batting = state[bat === 'A' ? 'teamA' : 'teamB'];
  const fielding = state[field === 'A' ? 'teamA' : 'teamB'];
  return `<div class="tool-panel"><div class="tool-row">
    <button class="tool-btn" data-action="baseball-end-half">End half-inning</button>
    <button class="tool-btn" data-action="baseball-clear-bases">Clear bases</button>
    <button class="tool-btn" data-action="baseball-run" data-delta="-1">Run −1 · ${esc(batting.name)}</button>
    <button class="tool-btn" data-action="baseball-hit" data-delta="-1">Hit −1 · ${esc(batting.name)}</button>
    <button class="tool-btn" data-action="baseball-error" data-delta="-1">Error −1 · ${esc(fielding.name)}</button>
  </div></div>`;
}
