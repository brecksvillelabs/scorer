import {
  SPORT_DEFS, createInitialState, clone, applySimpleScore, volleyballPoint, tennisPoint, formatTennisPoint,
  badmintonPoint, cricketAction, setCricketRole, switchCricketInnings, advancePeriod, tickClock, swapSides,
  formatClock, formatOvers, strikeRate, economy, getPeriodText, teamKey, otherSide
} from './sports.js';
import {
  EXTRA_SPORT_DEFS, createScorerState, lacrosseGoal, setLacrossePossession, lacrosseTimeout,
  lacrosseShotClockAction, kabaddiAction, setKabaddiRaid, kabaddiRaidClockAction,
  tickScorerClock, advanceScorerPeriod, swapScorerSides, getScorerPeriodText
} from './v035-core.js';
import {
  BASEBALL_SPORT_DEF, createBaseballState, getBaseballPeriodText, baseballRun, baseballHit,
  baseballError, baseballPitch, baseballPlateAppearance, toggleBase, clearBaseballBases,
  advanceBaseballHalf, swapBaseballSides
} from './baseball-core.js';
import { baseballSetupMarkup, baseballBoardMarkup, baseballToolsMarkup } from './baseball-ui.js';
import { changeTimeout, timeoutStatus } from './v037-core.js';

const SPORTS = { ...SPORT_DEFS, ...EXTRA_SPORT_DEFS, baseball: BASEBALL_SPORT_DEF };
const STORAGE_KEY = 'scorer-state-v2';
const $ = id => document.getElementById(id);
let state = null;
let history = [];
let selectedSport = 'volleyball';
let pendingLogos = { A: '', B: '' };
let editingExisting = false;
let wakeLock = null;
let toastTimer = null;

const el = {
  appShell: $('appShell'), sportPill: $('sportPill'), periodText: $('periodText'), clockBtn: $('clockBtn'), saveStatus: $('saveStatus'),
  gameSurface: $('gameSurface'), sportTools: $('sportTools'), undoBtn: $('undoBtn'), swapBtn: $('swapBtn'), editBtn: $('editBtn'), displayBtn: $('displayBtn'), exitDisplayBtn: $('exitDisplayBtn'),
  setupModal: $('setupModal'), closeSetupBtn: $('closeSetupBtn'), sportGrid: $('sportGrid'), sportSettings: $('sportSettings'),
  inputNameA: $('inputNameA'), inputNameB: $('inputNameB'), inputColorA: $('inputColorA'), inputColorB: $('inputColorB'),
  inputLogoA: $('inputLogoA'), inputLogoB: $('inputLogoB'), logoPreviewA: $('logoPreviewA'), logoPreviewB: $('logoPreviewB'),
  inputRosterA: $('inputRosterA'), inputRosterB: $('inputRosterB'), inputRosterFileA: $('inputRosterFileA'), inputRosterFileB: $('inputRosterFileB'),
  resetSavedBtn: $('resetSavedBtn'), startGameBtn: $('startGameBtn'), toast: $('toast')
};

function createStateFor(options) {
  return options?.sport === 'baseball' ? createBaseballState(options, createInitialState) : createScorerState(options, createInitialState);
}
function periodTextFor(value) { return value?.sport === 'baseball' ? getBaseballPeriodText(value) : getScorerPeriodText(value, getPeriodText); }
function swapAllSides(value) { return value?.sport === 'baseball' ? swapBaseballSides(value, swapSides) : swapScorerSides(value, swapSides); }

function boot() {
  buildSportChoices(); bindEvents();
  const saved = loadState();
  if (saved && saved.version === 2 && SPORTS[saved.sport]) {
    state = saved; selectedSport = state.sport; pendingLogos = { A: state.teamA.logo || '', B: state.teamB.logo || '' }; closeSetup();
  } else {
    state = createStateFor({ sport: selectedSport }); renderSportSettings(); openSetup(false);
  }
  render(); setInterval(clockTick, 1000);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

function bindEvents() {
  el.undoBtn.addEventListener('click', undo);
  el.swapBtn.addEventListener('click', () => pushCommit(swapAllSides(state), 'Sides swapped'));
  el.editBtn.addEventListener('click', () => { hydrateSetup(); openSetup(true); });
  el.displayBtn.addEventListener('click', toggleDisplay); el.exitDisplayBtn.addEventListener('click', toggleDisplay);
  el.clockBtn.addEventListener('click', toggleClock); el.closeSetupBtn.addEventListener('click', closeSetup);
  el.startGameBtn.addEventListener('click', startFromSetup); el.resetSavedBtn.addEventListener('click', newMatch);
  el.inputLogoA.addEventListener('change', e => loadLogo(e, 'A')); el.inputLogoB.addEventListener('change', e => loadLogo(e, 'B'));
  el.inputNameA.addEventListener('input', () => renderLogoPreview('A')); el.inputNameB.addEventListener('input', () => renderLogoPreview('B'));
  el.inputRosterFileA.addEventListener('change', e => importRoster(e, 'A')); el.inputRosterFileB.addEventListener('change', e => importRoster(e, 'B'));
  el.gameSurface.addEventListener('click', handleActionClick); el.sportTools.addEventListener('click', handleActionClick);
  el.sportTools.addEventListener('change', handleRoleChange);
  document.addEventListener('keydown', e => {
    if (e.target?.matches('input,select,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.code === 'Space' && SPORTS[state?.sport]?.hasClock) { e.preventDefault(); toggleClock(); }
    if (e.key.toLowerCase() === 'f') toggleDisplay();
  });
}

function buildSportChoices() {
  el.sportGrid.innerHTML = '';
  Object.values(SPORTS).forEach(sport => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sport-choice'; b.dataset.sport = sport.id;
    b.innerHTML = `<span class="sport-icon">${sport.icon}</span><strong>${sport.name}</strong>`;
    b.addEventListener('click', () => { selectedSport = sport.id; updateSportChoice(); renderSportSettings(); });
    el.sportGrid.appendChild(b);
  });
  updateSportChoice();
}
function updateSportChoice() { document.querySelectorAll('.sport-choice').forEach(x => x.classList.toggle('active', x.dataset.sport === selectedSport)); }

function renderSportSettings() {
  updateSportChoice(); const s = selectedSport;
  let body = `<label class="section-label">${SPORTS[s].name} format</label><div class="sport-settings-grid">`;
  if (s === 'volleyball') body += `
    <label>Match format<select id="settingBestOf"><option value="3">Best of 3</option><option value="5" selected>Best of 5</option></select></label>
    <label>Regular set to<input id="settingSetTo" type="number" min="1" value="25"></label>
    <label>Deciding set to<input id="settingDecidingSetTo" type="number" min="1" value="15"></label>
    <label>Win by<input id="settingWinBy" type="number" min="1" value="2"></label>`;
  if (['basketball','soccer','football'].includes(s)) {
    const mins = s === 'basketball' ? 10 : s === 'soccer' ? 45 : 15;
    body += `<label>Period length (minutes)<input id="settingMinutes" type="number" min="1" max="90" value="${mins}"></label>`;
  }
  if (s === 'lacrosse') body += `
    <label>Discipline<select id="settingLacrosseDiscipline"><option value="field" selected>Field lacrosse</option><option value="sixes">Sixes</option></select></label>
    <label>Quarter length (minutes)<input id="settingMinutes" type="number" min="1" max="30" value="15"></label>
    <label>Shot clock<select id="settingLacrosseShotClock"><option value="0" selected>Off / league-managed</option><option value="80">80 seconds</option><option value="30">30 seconds</option></select></label>`;
  if (s === 'kabaddi') body += `
    <label>Half length (minutes)<input id="settingMinutes" type="number" min="1" max="40" value="20"></label>
    <label>Raid clock (seconds)<input id="settingKabaddiRaidSeconds" type="number" min="10" max="60" value="30"></label>
    <label>First raid<select id="settingKabaddiFirstRaid"><option value="A">Side A</option><option value="B">Side B</option></select></label>`;
  if (s === 'baseball') body += baseballSetupMarkup();
  if (s === 'cricket') body += `
    <label>Format<select id="settingCricketFormat"><option value="T20">T20</option><option value="ODI">ODI</option><option value="Custom">Custom</option></select></label>
    <label>Overs per innings<input id="settingOvers" type="number" min="1" max="500" value="20"></label>
    <label>Batting first<select id="settingBatting"><option value="A">Side A</option><option value="B">Side B</option></select></label>`;
  if (s === 'tennis') body += `<label>Match format<select id="settingTennisBestOf"><option value="3" selected>Best of 3 sets</option><option value="5">Best of 5 sets</option></select></label>`;
  if (s === 'badminton') body += `<label>Match format<select id="settingBadmintonBestOf"><option value="3" selected>Best of 3 games</option></select></label><label>Game to<input id="settingBadmintonGameTo" type="number" value="21" min="1" max="30"></label>`;
  const note = s === 'lacrosse' ? 'Field and Sixes use different timing. Shot-clock use is configurable so youth/domestic rules can match the competition.' :
    s === 'kabaddi' ? 'Quick Score keeps raid ownership and the raid clock prominent. Touch/bonus points can accumulate before the raid is ended.' :
    s === 'baseball' ? 'Quick Score tracks inning, R-H-E, count, outs and base occupancy. Runner advancement stays manual except for forced movement on a walk/HBP.' :
    'Roster fields accept one name per line or pasted CSV names. Cricket uses those rosters for active batters and bowlers; racket sports can use player or doubles-pair names.';
  body += `<div class="setting-note">${note}</div></div>`;
  el.sportSettings.innerHTML = body;
  $('settingCricketFormat')?.addEventListener('change', e => { if (e.target.value === 'T20') $('settingOvers').value = 20; if (e.target.value === 'ODI') $('settingOvers').value = 50; });
  $('settingLacrosseDiscipline')?.addEventListener('change', e => {
    const sixes = e.target.value === 'sixes';
    $('settingMinutes').value = sixes ? 8 : 15;
    $('settingLacrosseShotClock').value = sixes ? 30 : 0;
  });
}

function openSetup(editing = false) { editingExisting = editing; el.startGameBtn.textContent = editing ? 'Apply changes' : 'Start scoreboard'; el.setupModal.classList.remove('hidden'); el.setupModal.setAttribute('aria-hidden','false'); }
function closeSetup() { el.setupModal.classList.add('hidden'); el.setupModal.setAttribute('aria-hidden','true'); }

function hydrateSetup() {
  selectedSport = state.sport; updateSportChoice();
  for (const side of ['A','B']) {
    const t = state[teamKey(side)];
    $(`inputName${side}`).value = t.name; $(`inputColor${side}`).value = t.color; $(`inputRoster${side}`).value = (t.roster || []).join('\n'); pendingLogos[side] = t.logo || ''; renderLogoPreview(side);
  }
  renderSportSettings();
  setTimeout(() => {
    if ($('settingBestOf')) $('settingBestOf').value = state.volleyball.bestOf;
    if ($('settingSetTo')) $('settingSetTo').value = state.volleyball.setTo;
    if ($('settingDecidingSetTo')) $('settingDecidingSetTo').value = state.volleyball.decidingSetTo;
    if ($('settingWinBy')) $('settingWinBy').value = state.volleyball.winBy;
    if ($('settingMinutes')) $('settingMinutes').value = Math.round(state.clock.periodSeconds / 60);
    if ($('settingCricketFormat')) $('settingCricketFormat').value = state.cricket.format;
    if ($('settingOvers')) $('settingOvers').value = state.cricket.oversLimit;
    if ($('settingBatting')) $('settingBatting').value = state.cricket.battingTeam;
    if ($('settingTennisBestOf')) $('settingTennisBestOf').value = state.tennis.bestOf;
    if ($('settingBadmintonBestOf')) $('settingBadmintonBestOf').value = state.badminton.bestOf;
    if ($('settingBadmintonGameTo')) $('settingBadmintonGameTo').value = state.badminton.gameTo;
    if ($('settingLacrosseDiscipline')) $('settingLacrosseDiscipline').value = state.lacrosse?.discipline || 'field';
    if ($('settingLacrosseShotClock')) $('settingLacrosseShotClock').value = String(state.lacrosse?.shotClockSeconds || 0);
    if ($('settingKabaddiRaidSeconds')) $('settingKabaddiRaidSeconds').value = state.kabaddi?.raidSeconds || 30;
    if ($('settingKabaddiFirstRaid')) $('settingKabaddiFirstRaid').value = state.kabaddi?.firstHalfStartingRaid || 'A';
    if ($('settingBaseballInnings')) $('settingBaseballInnings').value = String(state.baseball?.regulationInnings || 9);
    if ($('settingBaseballFirstBat')) $('settingBaseballFirstBat').value = state.baseball?.firstBat || 'B';
  },0);
}

function startFromSetup() {
  const opts = {
    sport:selectedSport,
    teamA:{ name:el.inputNameA.value.trim() || 'Home', color:el.inputColorA.value, logo:pendingLogos.A, roster:parseRosterText(el.inputRosterA.value) },
    teamB:{ name:el.inputNameB.value.trim() || 'Away', color:el.inputColorB.value, logo:pendingLogos.B, roster:parseRosterText(el.inputRosterB.value) },
    bestOf:Number($('settingBestOf')?.value || 5), setTo:Number($('settingSetTo')?.value || 25), decidingSetTo:Number($('settingDecidingSetTo')?.value || 15), winBy:Number($('settingWinBy')?.value || 2),
    periodMinutes:Number($('settingMinutes')?.value || 10), cricketFormat:$('settingCricketFormat')?.value || 'T20', oversLimit:Number($('settingOvers')?.value || 20), battingTeam:$('settingBatting')?.value || 'A',
    tennisBestOf:Number($('settingTennisBestOf')?.value || 3), badmintonBestOf:Number($('settingBadmintonBestOf')?.value || 3), badmintonGameTo:Number($('settingBadmintonGameTo')?.value || 21),
    lacrosseDiscipline:$('settingLacrosseDiscipline')?.value || 'field', lacrosseShotClock:Number($('settingLacrosseShotClock')?.value || 0),
    kabaddiRaidSeconds:Number($('settingKabaddiRaidSeconds')?.value || 30), kabaddiFirstRaid:$('settingKabaddiFirstRaid')?.value || 'A',
    baseballInnings:Number($('settingBaseballInnings')?.value || 9), baseballFirstBat:$('settingBaseballFirstBat')?.value || 'B'
  };
  if (editingExisting && selectedSport === state.sport) {
    const n = clone(state); Object.assign(n.teamA, opts.teamA); Object.assign(n.teamB, opts.teamB);
    if (selectedSport === 'volleyball') Object.assign(n.volleyball,{bestOf:opts.bestOf,setTo:opts.setTo,decidingSetTo:opts.decidingSetTo,winBy:opts.winBy});
    if (['basketball','soccer','football','lacrosse','kabaddi'].includes(selectedSport)) { n.clock.periodSeconds = opts.periodMinutes * 60; n.clock.targetSeconds = opts.periodMinutes * 60; }
    if (selectedSport === 'lacrosse') {
      n.lacrosse.discipline = opts.lacrosseDiscipline;
      n.lacrosse.shotClockSeconds = opts.lacrosseShotClock;
      n.lacrosse.shotClock = opts.lacrosseShotClock;
      n.lacrosse.shotClockRunning = false;
    }
    if (selectedSport === 'kabaddi') {
      n.kabaddi.raidSeconds = opts.kabaddiRaidSeconds;
      n.kabaddi.raidClock = Math.min(n.kabaddi.raidClock, opts.kabaddiRaidSeconds);
      n.kabaddi.firstHalfStartingRaid = opts.kabaddiFirstRaid;
    }
    if (selectedSport === 'baseball') n.baseball.regulationInnings = opts.baseballInnings;
    if (selectedSport === 'cricket') { n.cricket.format=opts.cricketFormat; n.cricket.oversLimit=opts.oversLimit; }
    if (selectedSport === 'tennis') n.tennis.bestOf=opts.tennisBestOf;
    if (selectedSport === 'badminton') { n.badminton.bestOf=opts.badmintonBestOf; n.badminton.gameTo=opts.badmintonGameTo; }
    pushCommit(n,'Match settings updated');
  } else { history=[]; state=createStateFor(opts); save(); render(); toast(`${SPORTS[selectedSport].name} ready`); }
  editingExisting=false; closeSetup();
}

function render() {
  if (!state) return; const def=SPORTS[state.sport];
  el.sportPill.textContent=`${def.icon} ${def.name}`; el.periodText.textContent=periodTextFor(state); el.clockBtn.classList.toggle('hidden',!def.hasClock); el.clockBtn.textContent=formatClock(state.clock.seconds);
  if (state.sport==='cricket') renderCricket(); else if (state.sport==='tennis') renderTennis(); else if (state.sport==='badminton') renderBadminton(); else if (state.sport==='lacrosse') renderLacrosse(); else if (state.sport==='kabaddi') renderKabaddi(); else if (state.sport==='baseball') renderBaseball(); else renderTeamSport();
  renderTools(); el.undoBtn.disabled=history.length===0; el.saveStatus.textContent='Saved';
}

function renderTeamSport() {
  el.gameSurface.innerHTML=`<div class="board dual-board">
    ${teamCard('A', teamMeta('A'), actionButtons('A'))}
    ${teamCard('B', teamMeta('B'), actionButtons('B'))}
    <div class="center-banner">${centerStatus()}</div>
  </div>`;
}
function teamCard(side,meta,buttons) {
  const t=state[teamKey(side)]; const logo=t.logo?`<img src="${t.logo}" alt="">`:esc((t.name||'?')[0].toUpperCase());
  return `<section class="team-card" style="--team-color:${safeColor(t.color)}"><div class="team-head"><div class="team-logo">${logo}</div><div style="min-width:0"><div class="team-name">${esc(t.name)}</div><div class="team-sub">${meta}</div></div></div><div class="score-big">${t.score}</div><div class="score-actions">${buttons}</div><div class="small-stats">${teamChips(side)}</div></section>`;
}
function actionButtons(side) {
  const sport=state.sport;
  const defs = sport==='volleyball' ? [['+1','volleyball-point',1,true],['−1','volleyball-point',-1,false]] :
    sport==='basketball' ? [['+1 FT','simple',1,false],['+2','simple',2,true],['+3','simple',3,true],['−1','simple',-1,false]] :
    sport==='soccer' ? [['+ Goal','simple',1,true],['− Goal','simple',-1,false]] :
    [['TD +6','simple',6,true],['FG +3','simple',3,true],['2PT +2','simple',2,false],['PAT +1','simple',1,false],['Safety +2','simple',2,false],['−1','simple',-1,false]];
  return defs.map(([label,action,delta,primary])=>`<button class="score-btn ${primary?'primary':''}" style="--team-color:${safeColor(state[teamKey(side)].color)}" data-action="${action}" data-side="${side}" data-delta="${delta}">${label}</button>`).join('');
}
function teamMeta(side) {
  const t=state[teamKey(side)];
  if(state.sport==='volleyball')return `${t.sets} sets won`;
  if(state.sport==='basketball')return `${t.fouls} team fouls`;
  if(state.sport==='soccer')return `${t.yellows} yellow · ${t.reds} red`;
  if(state.sport==='football')return state.football.possession===side?'Possession':'Defense'; return '';
}
function teamChips(side) {
  if(state.sport==='volleyball')return `${state.volleyball.servingTeam===side?'<span class="stat-chip serve-chip">Serving</span>':''}<span class="stat-chip">${state.volleyball.timeouts[side]} TO left</span>`;
  if(state.sport==='basketball')return `${state.basketball.possession===side?'<span class="stat-chip serve-chip">Possession</span>':''}<span class="stat-chip">${state.basketball.timeouts[side]} TO</span>`;
  if(state.sport==='football')return `${state.football.possession===side?'<span class="stat-chip serve-chip">Ball</span>':''}<span class="stat-chip">${state.football.timeouts[side]} TO</span>`; return '';
}
function centerStatus(){
  if(state.finished)return `<strong>${winnerText()}</strong>`;
  if(state.sport==='volleyball')return `<strong>${state.teamA.sets}–${state.teamB.sets} sets</strong><span>${periodTextFor(state)}</span>`;
  if(state.sport==='football')return `<strong>${ordinal(state.football.down)} & ${state.football.distance}</strong><span>${esc(state[state.football.possession==='A'?'teamA':'teamB'].name)} ball</span>`;
  return `<strong>${state.clock.running?'Clock running':'Ready'}</strong><span>${periodTextFor(state)}</span>`;
}

function logoMarkup(side){const t=state[teamKey(side)];return t.logo?`<img src="${t.logo}" alt="">`:esc((t.name||'?')[0].toUpperCase());}

function renderLacrosse(){
  const l=state.lacrosse; const shotOn=l.shotClockSeconds>0;
  el.gameSurface.innerHTML=`<section class="v035-lax-board">
    <div class="v035-sport-hero"><div><div class="eyebrow">${l.discipline==='sixes'?'LACROSSE SIXES':'FIELD LACROSSE'}</div><strong>${periodTextFor(state)}</strong></div><div class="v035-clock-stack"><span>Game ${formatClock(state.clock.seconds)}</span>${shotOn?`<b class="${l.shotClock<=10?'urgent':''}">Shot ${l.shotClock}</b>`:''}</div></div>
    <div class="v035-lax-teams">${['A','B'].map(side=>{const t=state[teamKey(side)];return `<article class="v035-lax-team" style="--team-color:${safeColor(t.color)}"><div class="team-head"><div class="team-logo">${logoMarkup(side)}</div><div><div class="team-name">${esc(t.name)}</div><div class="team-sub">${l.possession===side?'● Possession':'Defense'} · ${l.timeouts[side]} TO</div></div></div><div class="v035-lax-score">${t.score}</div><div class="v035-score-row"><button class="score-btn primary" data-action="lacrosse-goal" data-side="${side}" data-delta="1">Goal +1</button><button class="score-btn" data-action="lacrosse-goal" data-side="${side}" data-delta="-1">−1</button></div></article>`;}).join('')}</div>
  </section>`;
}

function renderKabaddi(){
  const k=state.kabaddi, raid=k.raidingTeam, defense=otherSide(raid), raidTeam=state[teamKey(raid)], defenseTeam=state[teamKey(defense)];
  el.gameSurface.innerHTML=`<section class="v035-kabaddi-board">
    <div class="v035-kabaddi-head"><div><div class="eyebrow">KABADDI · ${periodTextFor(state).toUpperCase()}</div><strong>${formatClock(state.clock.seconds)}</strong></div><div class="v035-raid-clock ${k.raidClock<=10?'urgent':''}"><span>RAID</span><b>${k.raidClock}</b></div></div>
    <div class="v035-kabaddi-teams">${['A','B'].map(side=>{const t=state[teamKey(side)];return `<article class="v035-kabaddi-team ${raid===side?'raiding':''}" style="--team-color:${safeColor(t.color)}"><div class="team-head"><div class="team-logo">${logoMarkup(side)}</div><div><div class="team-name">${esc(t.name)}</div><div class="team-sub">${raid===side?'RAIDING':'DEFENDING'} · ${k.timeouts[side]} TO</div></div></div><div class="v035-kabaddi-score">${t.score}</div><div class="v035-score-row"><button class="mini-btn" data-action="kabaddi-technical" data-side="${side}-allOut">All Out +2</button><button class="mini-btn" data-action="kabaddi-correct" data-side="${side}">Score −1</button></div></article>`;}).join('')}</div>
    <div class="v035-raid-panel"><div class="v035-raid-title"><span>${esc(raidTeam.name)} raid</span><strong>Current raid +${k.raidPoints}</strong></div><div class="v035-raid-actions"><button class="score-btn primary" data-action="kabaddi" data-value="touch">Touch +1</button><button class="score-btn" data-action="kabaddi" data-value="bonus">Bonus +1</button><button class="score-btn danger" data-action="kabaddi" data-value="tackle">${esc(defenseTeam.name)} tackle +1 & end</button><button class="score-btn" data-action="kabaddi" data-value="empty">Empty raid</button><button class="score-btn primary" data-action="kabaddi" data-value="end">End raid →</button></div></div>
  </section>`;
}

function renderBaseball(){
  el.gameSurface.innerHTML=baseballBoardMarkup(state,{esc,safeColor,logoMarkup});
}

function renderTennis(){
  const t=state.tennis;
  el.gameSurface.innerHTML=`<section class="racket-board"><div class="racket-head"><div><div class="racket-title">Match scoreboard</div><div class="racket-note">${t.tiebreak?'Tie-break in progress':`Best of ${t.bestOf} sets`}</div></div><div class="history-row">${t.setHistory.map(h=>`<span class="history-pill">${h.scoreA}-${h.scoreB}</span>`).join('')}</div></div>
    <div class="racket-grid-head"><span>Player / team</span><span>Sets</span><span>Games</span><span>Point</span></div>
    ${racketRow('A',t.sets.A,t.games.A,formatTennisPoint(state,'A'),t.servingTeam==='A')}${racketRow('B',t.sets.B,t.games.B,formatTennisPoint(state,'B'),t.servingTeam==='B')}
    <div class="racket-controls"><button class="racket-score-btn a" data-action="tennis-point" data-side="A">Point · ${esc(state.teamA.name)}</button><button class="racket-score-btn b" data-action="tennis-point" data-side="B">Point · ${esc(state.teamB.name)}</button></div></section>`;
}
function renderBadminton(){
  const b=state.badminton;
  el.gameSurface.innerHTML=`<section class="racket-board"><div class="racket-head"><div><div class="racket-title">Rally scoreboard</div><div class="racket-note">Best of ${b.bestOf} · game to ${b.gameTo} · win by 2, cap 30</div></div><div class="history-row">${b.gameHistory.map(h=>`<span class="history-pill">${h.scoreA}-${h.scoreB}</span>`).join('')}</div></div>
    <div class="racket-grid-head"><span>Player / team</span><span>Games</span><span>Court</span><span>Points</span></div>
    ${racketRow('A',b.games.A,b.servingTeam==='A'?(b.points.A%2===0?'R':'L'):'—',b.points.A,b.servingTeam==='A')}${racketRow('B',b.games.B,b.servingTeam==='B'?(b.points.B%2===0?'R':'L'):'—',b.points.B,b.servingTeam==='B')}
    <div class="racket-controls"><button class="racket-score-btn a" data-action="badminton-point" data-side="A">Rally · ${esc(state.teamA.name)}</button><button class="racket-score-btn b" data-action="badminton-point" data-side="B">Rally · ${esc(state.teamB.name)}</button></div></section>`;
}
function racketRow(side,col1,col2,point,serving){
  const t=state[teamKey(side)]; const roster=(t.roster||[]).slice(0,2).join(' / ');
  return `<div class="racket-row"><div class="racket-player">${serving?'<span class="serve-dot"></span>':'<span style="width:10px"></span>'}<div style="min-width:0"><div class="racket-name">${esc(t.name)}</div><div class="team-sub">${esc(roster)}</div></div></div><div class="racket-cell">${col1}</div><div class="racket-cell">${col2}</div><div class="racket-cell racket-point">${point}</div></div>`;
}

function renderCricket(){
  const c=state.cricket, batSide=c.battingTeam, fieldSide=otherSide(batSide), bat=state[teamKey(batSide)], field=state[teamKey(fieldSide)];
  const striker=c.battingStats[batSide][c.striker]||{name:c.striker,runs:0,balls:0,fours:0,sixes:0}; const non=c.battingStats[batSide][c.nonStriker]||{name:c.nonStriker,runs:0,balls:0,fours:0,sixes:0}; const bowl=c.bowlingStats[fieldSide][c.bowler]||{name:c.bowler,balls:0,runs:0,wickets:0};
  const rr=bat.balls?(bat.runs/(bat.balls/6)).toFixed(2):'0.00'; const ballsLeft=Math.max(0,c.oversLimit*6-bat.balls); const need=c.target?Math.max(0,c.target-bat.runs):null; const req=c.target&&ballsLeft?((need)/(ballsLeft/6)).toFixed(2):null;
  const battingLogo=bat.logo?`<img src="${bat.logo}" alt="">`:esc((bat.name||'?')[0]);
  el.gameSurface.innerHTML=`<div class="cricket-board">
    <section class="cricket-hero" style="--bat-color:${safeColor(bat.color)}"><div class="cricket-topline"><div class="cricket-team"><div class="team-logo">${battingLogo}</div><div><div class="team-name">${esc(bat.name)}</div><div class="cricket-badge">BATTING · ${periodTextFor(state).toUpperCase()}</div></div></div><div class="team-sub">vs ${esc(field.name)}</div></div>
      <div class="cricket-scoreline"><div class="cricket-score">${bat.runs}/${bat.wickets}</div><div class="cricket-overs">${formatOvers(bat.balls)} overs</div></div>
      <div class="cricket-context"><span class="stat-chip">Run rate ${rr}</span>${c.target?`<span class="stat-chip">Target ${c.target}</span><span class="stat-chip">Need ${need} from ${ballsLeft}</span>${req?`<span class="stat-chip">Req ${req}</span>`:''}`:''}<span class="stat-chip">Extras ${c.extras[batSide].wides+c.extras[batSide].noBalls}</span></div>
    </section>
    <div class="cricket-detail-grid"><section class="scorecard"><div class="scorecard-title">Batting partnership</div><table class="score-table"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4</th><th>6</th><th>SR</th></tr></thead><tbody>${batterRow(striker,true)}${batterRow(non,false)}</tbody></table></section>
      <section class="scorecard"><div class="scorecard-title">Current bowler</div><table class="score-table"><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Eco</th></tr></thead><tbody><tr><td class="active-name">${esc(bowl.name)}</td><td>${formatOvers(bowl.balls)}</td><td>${bowl.runs}</td><td>${bowl.wickets}</td><td>${economy(bowl.runs,bowl.balls)}</td></tr></tbody></table></section></div>
    <section class="scorecard"><div class="scorecard-title">Score this delivery</div><div class="cricket-pad">${['0','1','2','3','4','6'].map(x=>`<button class="score-btn ${['4','6'].includes(x)?'boundary':''}" data-action="cricket" data-value="${x}">${x}</button>`).join('')}<button class="score-btn danger" data-action="cricket" data-value="wicket">Wicket</button><button class="score-btn danger" data-action="cricket" data-value="runOut">Run out</button><button class="score-btn" data-action="cricket" data-value="wide">Wide</button><button class="score-btn" data-action="cricket" data-value="noBall">No-ball</button></div></section>
    <div class="innings-summary"><span>${c.innings===1?'First innings':'Chase'} · ${c.format}</span><span>${field.runs||field.balls?`${esc(field.name)} ${field.runs}/${field.wickets} (${formatOvers(field.balls)})`: `${esc(field.name)} fielding`}</span></div>
  </div>`;
}
function batterRow(p,striker){return `<tr><td class="active-name">${esc(p.name)}${striker?'<span class="striker-star">★</span>':''}</td><td>${p.runs}</td><td>${p.balls}</td><td>${p.fours}</td><td>${p.sixes}</td><td>${strikeRate(p.runs,p.balls)}</td></tr>`;}

function renderTools(){
  const s=state.sport;
  if(s==='cricket'){ const c=state.cricket,batSide=c.battingTeam,fieldSide=otherSide(batSide),bat=state[teamKey(batSide)],field=state[teamKey(fieldSide)];
    el.sportTools.innerHTML=`<div class="tool-panel">${c.needsBowler?'<div class="bowler-alert">Over complete — select the next bowler before continuing.</div>':''}<div class="role-selects"><label>Striker<select data-role="striker">${options(bat.roster,c.striker)}</select></label><label>Non-striker<select data-role="nonStriker">${options(bat.roster,c.nonStriker)}</select></label><label>Bowler<select data-role="bowler">${options(field.roster,c.bowler)}</select></label></div><div class="tool-row"><button class="tool-btn" data-action="switch-innings">${c.innings===1?'Start 2nd innings':'Finish match'}</button></div></div>`; return; }
  if(s==='tennis'||s==='badminton'){ const serving=s==='tennis'?state.tennis.servingTeam:state.badminton.servingTeam; el.sportTools.innerHTML=`<div class="tool-panel"><div class="tool-row"><button class="tool-btn ${serving==='A'?'active':''}" data-action="set-server" data-side="A">${esc(state.teamA.name)} serves</button><button class="tool-btn ${serving==='B'?'active':''}" data-action="set-server" data-side="B">${esc(state.teamB.name)} serves</button></div></div>`; return; }
  if(s==='lacrosse'){
    const shot=state.lacrosse.shotClockSeconds>0?`<button class="tool-btn" data-action="lacrosse-shot" data-value="toggle">${state.lacrosse.shotClockRunning?'Pause':'Start'} shot clock</button><button class="tool-btn" data-action="lacrosse-shot" data-value="reset">Reset shot ${state.lacrosse.shotClockSeconds}</button>`:'';
    el.sportTools.innerHTML=`<div class="tool-panel"><div class="tool-row"><button class="tool-btn" data-action="period" data-delta="-1">Previous Quarter</button><button class="tool-btn" data-action="period" data-delta="1">Next Quarter</button><button class="tool-btn ${state.lacrosse.possession==='A'?'active':''}" data-action="lacrosse-possession" data-side="A">${esc(state.teamA.name)} possession</button><button class="tool-btn ${state.lacrosse.possession==='B'?'active':''}" data-action="lacrosse-possession" data-side="B">${esc(state.teamB.name)} possession</button>${shot}${timeoutTools()}</div></div>`; return;
  }
  if(s==='kabaddi'){
    el.sportTools.innerHTML=`<div class="tool-panel"><div class="tool-row"><button class="tool-btn" data-action="period" data-delta="-1">Previous Half</button><button class="tool-btn" data-action="period" data-delta="1">Next Half</button><button class="tool-btn ${state.kabaddi.raidingTeam==='A'?'active':''}" data-action="kabaddi-set-raid" data-side="A">A raids</button><button class="tool-btn ${state.kabaddi.raidingTeam==='B'?'active':''}" data-action="kabaddi-set-raid" data-side="B">B raids</button><button class="tool-btn" data-action="kabaddi-raid-clock" data-value="toggle">${state.kabaddi.raidRunning?'Pause':'Start'} raid timer</button><button class="tool-btn" data-action="kabaddi-raid-clock" data-value="reset">Reset ${state.kabaddi.raidSeconds}s</button><button class="tool-btn" data-action="kabaddi-technical" data-side="A">Technical +1 · A</button><button class="tool-btn" data-action="kabaddi-technical" data-side="B">Technical +1 · B</button>${timeoutTools()}</div></div>`; return;
  }
  if(s==='baseball'){ el.sportTools.innerHTML=baseballToolsMarkup(state,esc); return; }
  const periodBtns = SPORTS[s].hasClock ? `<button class="tool-btn" data-action="period" data-delta="-1">Previous ${SPORTS[s].periodLabel}</button><button class="tool-btn" data-action="period" data-delta="1">Next ${SPORTS[s].periodLabel}</button>` : '';
  let extras='';
  if(s==='volleyball') extras=timeoutTools();
  if(s==='basketball') extras=sideTools('Foul +','foul','basketball')+timeoutTools()+possessionTools('basketball');
  if(s==='soccer') extras=sideTools('Yellow','yellow','soccer')+sideTools('Red','red','soccer');
  if(s==='football') extras=`<button class="tool-btn" data-action="down" data-delta="-1">Down −</button><button class="tool-btn" data-action="down" data-delta="1">Down +</button><button class="tool-btn" data-action="distance" data-delta="-5">Distance −5</button><button class="tool-btn" data-action="distance" data-delta="5">Distance +5</button>${possessionTools('football')}${timeoutTools()}`;
  el.sportTools.innerHTML=`<div class="tool-panel"><div class="tool-row">${periodBtns}${extras}</div></div>`;
}
function sideTools(label,action){return `<button class="tool-btn" data-action="${action}" data-side="A">${label} · A</button><button class="tool-btn" data-action="${action}" data-side="B">${label} · B</button>`;}
function timeoutTools(){
  const status=timeoutStatus(state);
  if(!status.limit)return'';
  return ['A','B'].map(side=>{
    const remaining=status[side];
    const take=`<button class="tool-btn" data-action="timeout" data-side="${side}" ${remaining<=0?'disabled':''}>Timeout · ${side} (${remaining})</button>`;
    const restore=remaining<status.limit?`<button class="tool-btn timeout-recovery" data-action="restore-timeout" data-side="${side}">↶ Restore timeout · ${side}</button>`:'';
    return take+restore;
  }).join('');
}
function possessionTools(){return `<button class="tool-btn" data-action="possession" data-side="A">A possession</button><button class="tool-btn" data-action="possession" data-side="B">B possession</button>`;}
function options(list,current){return [...new Set([current,...(list||[])].filter(Boolean))].map(x=>`<option value="${attr(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('');}

function handleActionClick(e){
  const b=e.target.closest('[data-action]'); if(!b||!state)return; const action=b.dataset.action,side=b.dataset.side,delta=Number(b.dataset.delta||0); let n;
  if(action==='simple') n=applySimpleScore(state,side,delta);
  else if(action==='volleyball-point') n=volleyballPoint(state,side,delta);
  else if(action==='tennis-point') n=tennisPoint(state,side);
  else if(action==='badminton-point') n=badmintonPoint(state,side);
  else if(action==='lacrosse-goal') n=lacrosseGoal(state,side,delta);
  else if(action==='lacrosse-possession') n=setLacrossePossession(state,side);
  else if(action==='lacrosse-timeout'||action==='timeout') n=changeTimeout(state,side,-1);
  else if(action==='restore-timeout') n=changeTimeout(state,side,1);
  else if(action==='lacrosse-shot') n=lacrosseShotClockAction(state,b.dataset.value);
  else if(action==='kabaddi') n=kabaddiAction(state,b.dataset.value);
  else if(action==='kabaddi-correct') n=kabaddiAction(state,'correct',side);
  else if(action==='kabaddi-technical') n=kabaddiAction(state,'technical',side);
  else if(action==='kabaddi-set-raid') n=setKabaddiRaid(state,side);
  else if(action==='kabaddi-raid-clock') n=kabaddiRaidClockAction(state,b.dataset.value);
  else if(action==='baseball-run') n=baseballRun(state,delta);
  else if(action==='baseball-hit') n=baseballHit(state,delta);
  else if(action==='baseball-error') n=baseballError(state,delta);
  else if(action==='baseball-pitch') n=baseballPitch(state,b.dataset.value);
  else if(action==='baseball-pa') n=baseballPlateAppearance(state,b.dataset.value);
  else if(action==='baseball-base') n=toggleBase(state,b.dataset.value);
  else if(action==='baseball-clear-bases') n=clearBaseballBases(state);
  else if(action==='baseball-end-half') n=advanceBaseballHalf(state,'manual');
  else if(action==='cricket') n=cricketAction(state,b.dataset.value);
  else if(action==='switch-innings') n=switchCricketInnings(state);
  else if(action==='period') n=advanceScorerPeriod(state,delta,advancePeriod);
  else { n=clone(state); mutateUtility(n,action,side,delta); }
  pushCommit(n,actionLabel(action,side));
}
function mutateUtility(n,action,side,delta){
  const key=teamKey(side);
  if(action==='foul') n[key].fouls=Math.max(0,n[key].fouls+1);
  if(action==='yellow') n[key].yellows=Math.max(0,n[key].yellows+1);
  if(action==='red') n[key].reds=Math.max(0,n[key].reds+1);
  if(action==='possession'){ if(n.sport==='football')n.football.possession=side;if(n.sport==='basketball')n.basketball.possession=side; }
  if(action==='down') n.football.down=Math.min(4,Math.max(1,n.football.down+delta));
  if(action==='distance') n.football.distance=Math.max(1,n.football.distance+delta);
  if(action==='set-server'){ if(n.sport==='tennis')n.tennis.servingTeam=side;if(n.sport==='badminton')n.badminton.servingTeam=side; }
  n.updatedAt=Date.now();
}
function handleRoleChange(e){ const role=e.target.dataset.role;if(!role)return;pushCommit(setCricketRole(state,role,e.target.value),`${role} changed`); }

function toggleClock(){ if(!SPORTS[state.sport].hasClock)return;const n=clone(state);n.clock.running=!n.clock.running;pushCommit(n,n.clock.running?'Clock started':'Clock paused',false);if(n.clock.running)requestWake(); }
function clockTick(){
  const extraRunning=(state?.sport==='lacrosse'&&state.lacrosse?.shotClockRunning)||(state?.sport==='kabaddi'&&state.kabaddi?.raidRunning);
  if(!state?.clock?.running&&!extraRunning)return;
  state=tickScorerClock(state,tickClock);save(false);render();
}
function undo(){ if(!history.length)return;state=history.pop();save();render();toast('Undone'); }
function pushCommit(next,msg,record=true){ if(!next)return;if(record)history.push(clone(state));state=next;save();render();toast(msg); }
function save(show=true){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if(show)el.saveStatus.textContent='Saved';}catch{toast('Could not save locally');} }
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{return null;}}
function newMatch(){ localStorage.removeItem(STORAGE_KEY);history=[];editingExisting=false;selectedSport='volleyball';pendingLogos={A:'',B:''};state=createStateFor({sport:selectedSport});el.inputNameA.value='Home';el.inputNameB.value='Away';el.inputColorA.value='#2563eb';el.inputColorB.value='#e11d48';el.inputRosterA.value='';el.inputRosterB.value='';renderSportSettings();render();toast('New match ready'); }

async function toggleDisplay(){ const entering=!el.appShell.classList.contains('display-mode');el.appShell.classList.toggle('display-mode',entering);el.exitDisplayBtn.classList.toggle('hidden',!entering);if(entering){requestWake();try{await document.documentElement.requestFullscreen?.();}catch{}}else{try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}} }
async function requestWake(){try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}

function loadLogo(e,side){const file=e.target.files?.[0];if(!file)return;if(file.size>1.8*1024*1024){toast('Use a logo under 1.8 MB');e.target.value='';return;}const r=new FileReader();r.onload=()=>{pendingLogos[side]=String(r.result);renderLogoPreview(side);};r.readAsDataURL(file);}
function renderLogoPreview(side){const host=side==='A'?el.logoPreviewA:el.logoPreviewB;const name=(side==='A'?el.inputNameA:el.inputNameB).value||`Side ${side}`;host.innerHTML=pendingLogos[side]?`<img src="${pendingLogos[side]}" alt=""><span>${esc(name)} logo</span>`:`<span>No logo — ${esc(name[0]||side)} will be shown</span>`;}
function importRoster(e,side){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{const list=parseRosterText(String(r.result||''));$(side==='A'?'inputRosterA':'inputRosterB').value=list.join('\n');toast(`${list.length} names imported`);};r.readAsText(file);}
function parseRosterText(text){return [...new Set(String(text||'').split(/[\r\n,;]+/).map(x=>x.trim().replace(/^"|"$/g,'')).filter(Boolean))].slice(0,40);}

function winnerText(){if(state.winner==='tie')return'Match tied';return `${esc(state[teamKey(state.winner)].name)} wins`;}
function actionLabel(action,side){const name=side?state[teamKey(side)]?.name:'';return side?`${name}: ${action.replaceAll('-',' ')}`:action.replaceAll('-',' ');}
function ordinal(n){return n===1?'1st':n===2?'2nd':n===3?'3rd':`${n}th`;}
function safeColor(v){return /^#[0-9a-f]{6}$/i.test(v||'')?v:'#2563eb';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function attr(v){return esc(v).replace(/`/g,'&#96;');}
function toast(msg){clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.add('show');toastTimer=setTimeout(()=>el.toast.classList.remove('show'),1600);}

boot();