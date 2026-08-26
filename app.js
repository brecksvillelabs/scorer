import {
  SPORT_DEFS, createInitialState, clone, applySimpleScore, volleyballPoint,
  cricketAction, switchCricketInnings, advancePeriod, tickClock, swapSides,
  formatClock, formatOvers, getDisplayScore, getPeriodText
} from './sports.js';

const STORAGE_KEY = 'scorer-state-v1';
const $ = (id) => document.getElementById(id);
let state = null;
let history = [];
let selectedSport = 'volleyball';
let pendingLogos = { A: '', B: '' };
let editingExisting = false;
let toastTimer = null;
let wakeLock = null;

const el = {
  appShell: $('appShell'), sportPill: $('sportPill'), periodText: $('periodText'),
  clockBlock: $('clockBlock'), clockBtn: $('clockBtn'), saveStatus: $('saveStatus'),
  teamCardA: $('teamCardA'), teamCardB: $('teamCardB'), accentA: $('accentA'), accentB: $('accentB'),
  logoWrapA: $('logoWrapA'), logoWrapB: $('logoWrapB'), teamNameA: $('teamNameA'), teamNameB: $('teamNameB'),
  teamMetaA: $('teamMetaA'), teamMetaB: $('teamMetaB'), scoreA: $('scoreA'), scoreB: $('scoreB'),
  serveA: $('serveA'), serveB: $('serveB'), controlsA: $('controlsA'), controlsB: $('controlsB'),
  centerPanel: $('centerPanel'), flowButtons: $('flowButtons'), sportTools: $('sportTools'), sportToolsTitle: $('sportToolsTitle'),
  undoBtn: $('undoBtn'), swapBtn: $('swapBtn'), editBtn: $('editBtn'), displayBtn: $('displayBtn'), exitDisplayBtn: $('exitDisplayBtn'),
  setupModal: $('setupModal'), closeSetupBtn: $('closeSetupBtn'), sportGrid: $('sportGrid'), sportSettings: $('sportSettings'),
  inputNameA: $('inputNameA'), inputNameB: $('inputNameB'), inputColorA: $('inputColorA'), inputColorB: $('inputColorB'),
  inputLogoA: $('inputLogoA'), inputLogoB: $('inputLogoB'), logoPreviewA: $('logoPreviewA'), logoPreviewB: $('logoPreviewB'),
  resetSavedBtn: $('resetSavedBtn'), startGameBtn: $('startGameBtn'), toast: $('toast')
};

function boot() {
  buildSportChoices();
  bindEvents();
  const saved = loadState();
  if (saved && SPORT_DEFS[saved.sport]) {
    state = saved;
    selectedSport = state.sport;
    pendingLogos = { A: state.teamA.logo || '', B: state.teamB.logo || '' };
    closeSetup();
  } else {
    state = createInitialState({ sport: selectedSport });
    renderSportSettings();
    openSetup(false);
  }
  render();
  setInterval(clockTick, 1000);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

function bindEvents() {
  el.undoBtn.addEventListener('click', undo);
  el.swapBtn.addEventListener('click', () => pushCommit(swapSides(state), 'Teams swapped'));
  el.editBtn.addEventListener('click', () => { hydrateSetup(); openSetup(true); });
  el.displayBtn.addEventListener('click', toggleDisplay);
  el.exitDisplayBtn.addEventListener('click', toggleDisplay);
  el.clockBtn.addEventListener('click', toggleClock);
  el.closeSetupBtn.addEventListener('click', closeSetup);
  el.startGameBtn.addEventListener('click', startFromSetup);
  el.resetSavedBtn.addEventListener('click', clearSaved);
  el.inputLogoA.addEventListener('change', (e) => loadLogo(e, 'A'));
  el.inputLogoB.addEventListener('change', (e) => loadLogo(e, 'B'));
  el.inputNameA.addEventListener('input', () => renderLogoPreview('A'));
  el.inputNameB.addEventListener('input', () => renderLogoPreview('B'));
  document.addEventListener('keydown', (e) => {
    if (e.target?.matches('input,select,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.code === 'Space') { e.preventDefault(); toggleClock(); }
    if (e.key.toLowerCase() === 'f') toggleDisplay();
  });
}

function buildSportChoices() {
  el.sportGrid.innerHTML = '';
  Object.values(SPORT_DEFS).forEach((sport) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sport-choice'; b.dataset.sport = sport.id;
    b.innerHTML = `<span class="sport-icon">${sport.icon}</span><strong>${sport.name}</strong>`;
    b.addEventListener('click', () => {
      selectedSport = sport.id;
      document.querySelectorAll('.sport-choice').forEach(x => x.classList.toggle('active', x.dataset.sport === selectedSport));
      renderSportSettings();
    });
    el.sportGrid.appendChild(b);
  });
}

function renderSportSettings() {
  document.querySelectorAll('.sport-choice').forEach(x => x.classList.toggle('active', x.dataset.sport === selectedSport));
  let body = `<label class="section-label">${SPORT_DEFS[selectedSport].name} settings</label><div class="sport-settings-grid">`;
  if (selectedSport === 'volleyball') body += `
    <label>Match format<select id="settingBestOf"><option value="3">Best of 3</option><option value="5" selected>Best of 5</option></select></label>
    <label>Regular set to<input id="settingSetTo" type="number" min="1" value="25"></label>
    <label>Deciding set to<input id="settingDecidingSetTo" type="number" min="1" value="15"></label>
    <label>Win by<input id="settingWinBy" type="number" min="1" value="2"></label>`;
  if (['basketball','soccer','football'].includes(selectedSport)) {
    const mins = selectedSport === 'basketball' ? 10 : selectedSport === 'soccer' ? 45 : 15;
    body += `<label>Period length (minutes)<input id="settingMinutes" type="number" min="1" max="90" value="${mins}"></label>`;
  }
  if (selectedSport === 'cricket') body += `
    <label>Format<select id="settingCricketFormat"><option value="T20">T20</option><option value="ODI">ODI</option><option value="Custom">Custom</option></select></label>
    <label>Overs per innings<input id="settingOvers" type="number" min="1" max="500" value="20"></label>
    <label>Batting first<select id="settingBatting"><option value="A">Home</option><option value="B">Away</option></select></label>`;
  body += `<div class="setting-note">Sport-specific scoring stays simple enough to operate from the sideline. Undo is always available for accidental taps.</div></div>`;
  el.sportSettings.innerHTML = body;
  $('settingCricketFormat')?.addEventListener('change', (e) => {
    if (e.target.value === 'T20') $('settingOvers').value = 20;
    if (e.target.value === 'ODI') $('settingOvers').value = 50;
  });
}

function openSetup(editing = false) {
  editingExisting = editing;
  el.startGameBtn.textContent = editing ? 'Apply changes' : 'Start scoreboard';
  el.setupModal.classList.remove('hidden');
  el.setupModal.setAttribute('aria-hidden', 'false');
}
function closeSetup() { el.setupModal.classList.add('hidden'); el.setupModal.setAttribute('aria-hidden', 'true'); }

function hydrateSetup() {
  selectedSport = state.sport;
  el.inputNameA.value = state.teamA.name; el.inputNameB.value = state.teamB.name;
  el.inputColorA.value = state.teamA.color; el.inputColorB.value = state.teamB.color;
  pendingLogos = { A: state.teamA.logo || '', B: state.teamB.logo || '' };
  renderSportSettings(); renderLogoPreview('A'); renderLogoPreview('B');
  setTimeout(() => {
    if ($('settingBestOf')) $('settingBestOf').value = state.volleyball.bestOf;
    if ($('settingSetTo')) $('settingSetTo').value = state.volleyball.setTo;
    if ($('settingDecidingSetTo')) $('settingDecidingSetTo').value = state.volleyball.decidingSetTo;
    if ($('settingWinBy')) $('settingWinBy').value = state.volleyball.winBy;
    if ($('settingMinutes')) $('settingMinutes').value = Math.round(state.clock.periodSeconds / 60);
    if ($('settingOvers')) $('settingOvers').value = state.cricket.oversLimit;
    if ($('settingCricketFormat')) $('settingCricketFormat').value = state.cricket.format;
    if ($('settingBatting')) $('settingBatting').value = state.cricket.battingTeam;
  }, 0);
}

function startFromSetup() {
  const opts = {
    sport: selectedSport,
    teamA: { name: el.inputNameA.value.trim() || 'Home', color: el.inputColorA.value, logo: pendingLogos.A },
    teamB: { name: el.inputNameB.value.trim() || 'Away', color: el.inputColorB.value, logo: pendingLogos.B },
    bestOf: Number($('settingBestOf')?.value || 5), setTo: Number($('settingSetTo')?.value || 25),
    decidingSetTo: Number($('settingDecidingSetTo')?.value || 15), winBy: Number($('settingWinBy')?.value || 2),
    periodMinutes: Number($('settingMinutes')?.value || 10), cricketFormat: $('settingCricketFormat')?.value || 'T20',
    oversLimit: Number($('settingOvers')?.value || 20), battingTeam: $('settingBatting')?.value || 'A'
  };
  if (editingExisting && selectedSport === state.sport) {
    const n = clone(state);
    Object.assign(n.teamA, opts.teamA); Object.assign(n.teamB, opts.teamB);
    if (selectedSport === 'volleyball') Object.assign(n.volleyball, { bestOf: opts.bestOf, setTo: opts.setTo, decidingSetTo: opts.decidingSetTo, winBy: opts.winBy });
    if (['basketball','soccer','football'].includes(selectedSport)) { n.clock.periodSeconds = opts.periodMinutes * 60; n.clock.targetSeconds = opts.periodMinutes * 60; }
    if (selectedSport === 'cricket') { n.cricket.format = opts.cricketFormat; n.cricket.oversLimit = opts.oversLimit; }
    pushCommit(n, 'Match settings updated');
  } else {
    history = []; state = createInitialState(opts); save(); render(); toast(`${SPORT_DEFS[selectedSport].name} scoreboard ready`);
  }
  editingExisting = false; closeSetup();
}

function render() {
  if (!state) return;
  const def = SPORT_DEFS[state.sport];
  el.sportPill.textContent = `${def.icon} ${def.name}`;
  el.periodText.textContent = getPeriodText(state);
  el.clockBlock.classList.toggle('hidden', !def.hasClock);
  el.clockBtn.textContent = formatClock(state.clock.seconds);
  el.teamNameA.textContent = state.teamA.name; el.teamNameB.textContent = state.teamB.name;
  el.scoreA.textContent = getDisplayScore(state, 'A'); el.scoreB.textContent = getDisplayScore(state, 'B');
  paintTeam('A'); paintTeam('B'); renderMeta(); renderQuick('A'); renderQuick('B'); renderCenter(); renderFlow(); renderTools();
  el.undoBtn.disabled = history.length === 0;
}

function paintTeam(side) {
  const t = side === 'A' ? state.teamA : state.teamB;
  const card = side === 'A' ? el.teamCardA : el.teamCardB;
  const accent = side === 'A' ? el.accentA : el.accentB;
  const logo = side === 'A' ? el.logoWrapA : el.logoWrapB;
  card.style.setProperty('--team-color', t.color); accent.style.background = t.color;
  logo.innerHTML = t.logo ? `<img alt="${esc(t.name)} logo" src="${t.logo}">` : `<span class="logo-fallback">${esc((t.name || '?')[0].toUpperCase())}</span>`;
}

function renderMeta() {
  if (state.sport === 'volleyball') {
    el.teamMetaA.textContent = `${state.teamA.sets} set${state.teamA.sets === 1 ? '' : 's'}`;
    el.teamMetaB.textContent = `${state.teamB.sets} set${state.teamB.sets === 1 ? '' : 's'}`;
    el.serveA.classList.toggle('hidden', state.volleyball.servingTeam !== 'A'); el.serveB.classList.toggle('hidden', state.volleyball.servingTeam !== 'B');
  } else if (state.sport === 'cricket') {
    el.teamMetaA.textContent = `${formatOvers(state.teamA.balls)} overs`; el.teamMetaB.textContent = `${formatOvers(state.teamB.balls)} overs`;
    el.serveA.classList.add('hidden'); el.serveB.classList.add('hidden');
  } else {
    el.teamMetaA.textContent = state.sport === 'basketball' ? `${state.teamA.fouls} team fouls` : state.sport === 'soccer' ? `${state.teamA.yellows} YC • ${state.teamA.reds} RC` : '';
    el.teamMetaB.textContent = state.sport === 'basketball' ? `${state.teamB.fouls} team fouls` : state.sport === 'soccer' ? `${state.teamB.yellows} YC • ${state.teamB.reds} RC` : '';
    el.serveA.classList.add('hidden'); el.serveB.classList.add('hidden');
  }
}

function renderQuick(side) {
  const host = side === 'A' ? el.controlsA : el.controlsB; host.innerHTML = '';
  if (state.sport === 'cricket') {
    if (state.cricket.battingTeam !== side || state.cricket.inningsComplete || state.finished) return;
    ['0','1','2','3','4','6','wicket','wide','noBall'].forEach(id => addScoreBtn(host, id === 'wicket' ? 'Wicket' : id === 'wide' ? 'Wide' : id === 'noBall' ? 'No-ball' : id, () => pushCommit(cricketAction(state,id), cricketMsg(id)), ['4','6'].includes(id)));
    return;
  }
  SPORT_DEFS[state.sport].controls.forEach(c => addScoreBtn(host, c.label, () => {
    const next = state.sport === 'volleyball' ? volleyballPoint(state, side, c.delta) : applySimpleScore(state, side, c.delta);
    pushCommit(next, `${side === 'A' ? state.teamA.name : state.teamB.name}: ${c.label}`);
  }, c.delta > 0));
}

function addScoreBtn(host, label, fn, primary = false) {
  const b = document.createElement('button'); b.type = 'button'; b.className = `score-btn${primary ? ' primary-score' : ''}`; b.textContent = label; b.addEventListener('click', fn); host.appendChild(b);
}

function renderCenter() {
  if (state.finished) { el.centerPanel.innerHTML = `<strong>${state.winner === 'tie' ? 'Game tied' : `${esc(state.winner === 'A' ? state.teamA.name : state.teamB.name)} wins`}</strong>`; return; }
  if (state.sport === 'volleyball') el.centerPanel.innerHTML = `<strong>${state.teamA.sets} – ${state.teamB.sets}</strong><span>Sets</span>`;
  else if (state.sport === 'cricket') el.centerPanel.innerHTML = `<strong>${state.cricket.innings === 1 ? '1st' : '2nd'} innings</strong><span>${state.cricket.target ? `Target ${state.cricket.target}` : 'Live score'}</span>`;
  else if (state.sport === 'football') el.centerPanel.innerHTML = `<strong>${state.football.down}${suffix(state.football.down)} & ${state.football.distance}</strong><span>${state.football.possession === 'A' ? esc(state.teamA.name) : esc(state.teamB.name)} ball</span>`;
  else el.centerPanel.innerHTML = `<strong>${state.clock.running ? 'Clock running' : 'Ready'}</strong><span>${getPeriodText(state)}</span>`;
}

function renderFlow() {
  el.flowButtons.innerHTML = '';
  if (state.sport === 'volleyball') {
    addTool(el.flowButtons, `Serve: ${state.teamA.name}`, () => setServe('A')); addTool(el.flowButtons, `Serve: ${state.teamB.name}`, () => setServe('B'));
  } else if (state.sport === 'cricket') {
    addTool(el.flowButtons, state.cricket.innings === 1 ? 'End innings' : 'Finish innings', () => pushCommit(switchCricketInnings(state), 'Innings advanced'));
  } else {
    addTool(el.flowButtons, 'Previous period', () => pushCommit(advancePeriod(state,-1), 'Period changed'));
    addTool(el.flowButtons, state.clock.running ? 'Pause clock' : 'Start clock', toggleClock);
    addTool(el.flowButtons, 'Next period', () => pushCommit(advancePeriod(state,1), 'Period changed'));
  }
}

function renderTools() {
  el.sportTools.innerHTML = '';
  if (state.sport === 'basketball') {
    el.sportToolsTitle.textContent = 'Team fouls'; ['A','B'].forEach(s => { addTool(el.sportTools, `${team(s).name} foul +`, () => counter(s,'fouls',1)); addTool(el.sportTools, `${team(s).name} foul −`, () => counter(s,'fouls',-1)); });
  } else if (state.sport === 'soccer') {
    el.sportToolsTitle.textContent = 'Cards'; ['A','B'].forEach(s => { addTool(el.sportTools, `${team(s).name} YC +`, () => counter(s,'yellows',1)); addTool(el.sportTools, `${team(s).name} RC +`, () => counter(s,'reds',1)); });
  } else if (state.sport === 'football') {
    el.sportToolsTitle.textContent = 'Down & possession';
    addTool(el.sportTools,'Next down',() => footballChange('down')); addTool(el.sportTools,'1st & 10',() => footballChange('reset')); addTool(el.sportTools,'Distance −1',() => footballChange('minus')); addTool(el.sportTools,'Distance +1',() => footballChange('plus')); addTool(el.sportTools,'Change possession',() => footballChange('possession'));
  } else if (state.sport === 'volleyball') {
    el.sportToolsTitle.textContent = 'Set status'; el.sportTools.innerHTML = `<div class="stat-strip"><div class="stat-tile"><span>Home sets</span><strong>${state.teamA.sets}</strong></div><div class="stat-tile"><span>Away sets</span><strong>${state.teamB.sets}</strong></div></div>`;
  } else {
    el.sportToolsTitle.textContent = 'Innings status'; const bat = state.cricket.battingTeam === 'A' ? state.teamA : state.teamB;
    el.sportTools.innerHTML = `<div class="stat-strip"><div class="stat-tile"><span>Batting</span><strong>${esc(bat.name)}</strong></div><div class="stat-tile"><span>Overs</span><strong>${formatOvers(bat.balls)} / ${state.cricket.oversLimit}</strong></div>${state.cricket.target ? `<div class="stat-tile"><span>Target</span><strong>${state.cricket.target}</strong></div>` : ''}</div>`;
  }
}

function addTool(host,label,fn){ const b=document.createElement('button'); b.type='button'; b.className='tool-btn'; b.textContent=label; b.addEventListener('click',fn); host.appendChild(b); }
function team(side){ return side==='A'?state.teamA:state.teamB; }
function setServe(side){ const n=clone(state); n.volleyball.servingTeam=side; pushCommit(n,'Serve changed'); }
function counter(side,field,delta){ const n=clone(state),t=side==='A'?n.teamA:n.teamB; t[field]=Math.max(0,Number(t[field]||0)+delta); pushCommit(n,'Team stat updated'); }
function footballChange(kind){ const n=clone(state); if(kind==='down')n.football.down=n.football.down>=4?1:n.football.down+1; if(kind==='reset'){n.football.down=1;n.football.distance=10;} if(kind==='minus')n.football.distance=Math.max(1,n.football.distance-1); if(kind==='plus')n.football.distance+=1; if(kind==='possession'){n.football.possession=n.football.possession==='A'?'B':'A';n.football.down=1;n.football.distance=10;} pushCommit(n,'Football status updated'); }

function pushCommit(next,msg){ history.push(clone(state)); if(history.length>60)history.shift(); commit(next,msg); }
function commit(next,msg){ state=next; save(); render(); if(msg)toast(msg); }
function undo(){ if(!history.length)return toast('Nothing to undo'); state=history.pop(); state.clock.running=false; save(); render(); toast('Last action undone'); }
function toggleClock(){ if(!SPORT_DEFS[state.sport].hasClock)return; const n=clone(state); n.clock.running=!n.clock.running; commit(n,n.clock.running?'Clock started':'Clock paused'); }
function clockTick(){ if(!state?.clock?.running)return; state=tickClock(state); save(false); el.clockBtn.textContent=formatClock(state.clock.seconds); if(!state.clock.running)toast('Period clock expired'); }

async function toggleDisplay(){ const entering=!el.appShell.classList.contains('display-mode'); el.appShell.classList.toggle('display-mode',entering); el.exitDisplayBtn.classList.toggle('hidden',!entering); el.displayBtn.textContent=entering?'Exit display':'Display mode'; if(entering){ try{ if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen'); }catch{} try{ await document.documentElement.requestFullscreen?.(); }catch{} } else { try{await wakeLock?.release();}catch{} wakeLock=null; try{if(document.fullscreenElement)await document.exitFullscreen();}catch{} } }

function loadLogo(event,side){ const file=event.target.files?.[0]; if(!file)return; if(!/^image\/(png|jpeg|webp)$/.test(file.type))return toast('Use PNG, JPEG or WebP'); if(file.size>1.8*1024*1024)return toast('Logo must be under 1.8 MB'); const r=new FileReader(); r.onload=()=>{pendingLogos[side]=String(r.result);renderLogoPreview(side);}; r.readAsDataURL(file); }
function renderLogoPreview(side){ const host=side==='A'?el.logoPreviewA:el.logoPreviewB,name=(side==='A'?el.inputNameA.value:el.inputNameB.value)||side; host.innerHTML=pendingLogos[side]?`<img alt="logo preview" src="${pendingLogos[side]}">`:`<span>${esc(name[0].toUpperCase())}</span>`; }

function save(show=true){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if(show)el.saveStatus.textContent='Saved on this device';}catch{toast('Local save failed');} }
function loadState(){ try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return s?.sport?s:null;}catch{return null;} }
function clearSaved(){ localStorage.removeItem(STORAGE_KEY); history=[]; editingExisting=false; pendingLogos={A:'',B:''}; el.inputNameA.value='Home';el.inputNameB.value='Away';el.inputColorA.value='#2563eb';el.inputColorB.value='#e11d48';selectedSport='volleyball';renderSportSettings();renderLogoPreview('A');renderLogoPreview('B');toast('Saved game cleared'); }
function toast(msg){ clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.add('show');toastTimer=setTimeout(()=>el.toast.classList.remove('show'),1900); }
function cricketMsg(id){ return id==='0'?'Dot ball':id==='wicket'?'Wicket':id==='wide'?'Wide +1':id==='noBall'?'No-ball +1':`${id} run${id==='1'?'':'s'}`; }
function suffix(n){return n===1?'st':n===2?'nd':n===3?'rd':'th';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

boot();
