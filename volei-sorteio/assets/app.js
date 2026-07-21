(() => {
  'use strict';

  const CFG = window.VOLEI_CONFIG || {};
  const STORAGE_KEY = 'pss_volei_sorteio_v1';
  const encoder = new TextEncoder();

  const samplePlayers = [
    { id: 'A-001', nome: 'Jogador A', pote: 'A', peso: 10, ativo: 'SIM' },
    { id: 'A-002', nome: 'Jogador A2', pote: 'A', peso: 7, ativo: 'SIM' },
    { id: 'B-001', nome: 'Jogador B', pote: 'B', peso: 5, ativo: 'SIM' },
    { id: 'B-002', nome: 'Jogador B2', pote: 'B', peso: 8, ativo: 'SIM' }
  ];

  function nowIso() { return new Date().toISOString(); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function num(value) { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function formatWeight(value) { return num(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const text = String(value).trim();
    const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (br) return new Date(+br[3], +br[2] - 1, +br[1], +(br[4] || 0), +(br[5] || 0), +(br[6] || 0));
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function uid(prefix = 'ID') { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  function hash32(text) {
    let h = 2166136261;
    for (const byte of encoder.encode(String(text))) { h ^= byte; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function seededShuffle(items, seed) {
    const list = [...items]; const random = mulberry32(hash32(seed));
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }
  function nextPowerOfTwo(value) { let n = 1; while (n < Math.max(2, value)) n *= 2; return n; }
  function phaseName(size, roundIndex, totalRounds) {
    const remaining = size / Math.pow(2, roundIndex + 1);
    if (roundIndex === totalRounds - 1) return 'FINAL';
    if (remaining === 2) return 'SEMIFINAL';
    if (remaining === 4) return 'QUARTAS DE FINAL';
    if (remaining === 8) return 'OITAVAS DE FINAL';
    return `RODADA ${roundIndex + 1}`;
  }

  function balanceTeams(players) {
    const active = players.filter(p => String(p.ativo || 'SIM').toUpperCase() === 'SIM');
    const potA = active.filter(p => String(p.pote).toUpperCase() === 'A').sort((a, b) => num(b.peso) - num(a.peso) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const potB = active.filter(p => String(p.pote).toUpperCase() === 'B').sort((a, b) => num(a.peso) - num(b.peso) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    if (potA.length !== potB.length) throw new Error(`Os potes precisam ter a mesma quantidade. Pote A: ${potA.length}; Pote B: ${potB.length}.`);
    if (potA.length < 2) throw new Error('Cadastre pelo menos dois jogadores ativos em cada pote.');
    return potA.map((a, index) => {
      const b = potB[index];
      return {
        id: `E-${String(index + 1).padStart(3, '0')}`,
        jogadorAId: a.id, jogadorA: a.nome, pesoA: num(a.peso),
        jogadorBId: b.id, jogadorB: b.nome, pesoB: num(b.peso),
        pesoTotal: num(a.peso) + num(b.peso), ordemBalanceamento: index + 1
      };
    });
  }

  function buildBracket(teams, seed) {
    const shuffled = seededShuffle(teams, seed);
    const size = nextPowerOfTwo(shuffled.length);
    const slots = [...shuffled]; while (slots.length < size) slots.push(null);
    const totalRounds = Math.log2(size); const rounds = []; let gameNumber = 1;
    const firstMatches = [];
    for (let i = 0; i < size; i += 2) {
      const t1 = slots[i], t2 = slots[i + 1];
      firstMatches.push({
        game: gameNumber++, roundIndex: 0, phase: phaseName(size, 0, totalRounds),
        team1: t1, team2: t2, winnerId: t1 && !t2 ? t1.id : (!t1 && t2 ? t2.id : ''),
        status: t1 && t2 ? 'AGUARDANDO' : 'BYE'
      });
    }
    rounds.push({ index: 0, name: phaseName(size, 0, totalRounds), matches: firstMatches });
    let previous = firstMatches;
    for (let r = 1; r < totalRounds; r++) {
      const matches = [];
      for (let i = 0; i < previous.length; i += 2) {
        const left = previous[i], right = previous[i + 1];
        matches.push({
          game: gameNumber++, roundIndex: r, phase: phaseName(size, r, totalRounds),
          team1: null, team2: null, team1Placeholder: `Vencedor Jogo ${left.game}`,
          team2Placeholder: `Vencedor Jogo ${right.game}`, winnerId: '', status: 'AGUARDANDO'
        });
      }
      rounds.push({ index: r, name: phaseName(size, r, totalRounds), matches }); previous = matches;
    }
    return rounds;
  }

  function defaultDemoState() {
    return {
      versao: CFG.VERSION || 'V001', modo: 'DEMO', titulo: CFG.APP_NAME || 'Sorteio de Duplas de Vôlei',
      status: 'RASCUNHO', mensagem: 'Aguardando a ativação oficial do sorteio.',
      serverTime: nowIso(), countdownSeconds: CFG.COUNTDOWN_SECONDS || 600,
      jogadores: samplePlayers, equipes: [], rounds: [], inicioPrevisto: '', realizadoEm: '', seed: '', hashAuditoria: ''
    };
  }
  function getDemoState() {
    try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return data && Array.isArray(data.jogadores) ? data : defaultDemoState(); }
    catch { return defaultDemoState(); }
  }
  function saveDemoState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, serverTime: nowIso() })); return state; }
  function completeDemoDraw(state = getDemoState()) {
    const seed = state.seed || `${Date.now()}-${Math.random()}`;
    const teams = balanceTeams(state.jogadores); const rounds = buildBracket(teams, seed);
    const totals = teams.map(t => t.pesoTotal); const spread = Math.max(...totals) - Math.min(...totals);
    return saveDemoState({ ...state, status: 'SORTEADO', mensagem: 'Sorteio concluído. Equipes e chaveamento revelados.', equipes: teams, rounds, realizadoEm: nowIso(), seed, hashAuditoria: hash32(JSON.stringify({ teams, rounds, seed })).toString(16).padStart(8, '0').toUpperCase(), balanceSpread: spread });
  }
  function startDemoCountdown(code, source = 'SITE') {
    const state = getDemoState(); const seconds = Number(state.countdownSeconds || CFG.COUNTDOWN_SECONDS || 600);
    return saveDemoState({ ...state, status: 'EM_CONTAGEM', mensagem: 'Sorteio ativado. A cerimônia começa ao fim da contagem regressiva.', ativadoPor: source, ativadoEm: nowIso(), inicioPrevisto: new Date(Date.now() + seconds * 1000).toISOString(), activationCode: code || state.activationCode || '' });
  }

  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!CFG.API_BASE) return reject(new Error('API não configurada.'));
      const callback = `__voleiCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = new URL(CFG.API_BASE); url.searchParams.set('acao', action); url.searchParams.set('callback', callback); url.searchParams.set('_', Date.now());
      Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)); });
      const script = document.createElement('script'); const timer = setTimeout(() => finish(new Error('Tempo excedido ao consultar a API.')), 20000);
      function finish(error, data) { clearTimeout(timer); delete window[callback]; script.remove(); error ? reject(error) : resolve(data); }
      window[callback] = data => { if (data && data.ok === false) finish(new Error(data.erro || data.mensagem || 'Falha na API.')); else finish(null, data?.dados ?? data?.result ?? data); };
      script.onerror = () => finish(new Error('Não foi possível carregar a API.')); script.src = url.toString(); document.head.appendChild(script);
    });
  }

  async function request(action, params = {}) {
    if (CFG.DEMO_MODE || !CFG.API_BASE) return demoRequest(action, params);
    return jsonp(action, params);
  }

  function demoRequest(action, params = {}) {
    let state = getDemoState();
    if (action === 'estado' || action === 'admin') return Promise.resolve({ ...state, serverTime: nowIso() });
    if (action === 'salvarJogador') {
      const player = params.jogador || params;
      const normalized = { id: player.id || uid(String(player.pote || 'P').toUpperCase()), nome: String(player.nome || '').trim(), pote: String(player.pote || '').toUpperCase(), peso: num(player.peso), ativo: String(player.ativo || 'SIM').toUpperCase() };
      if (!normalized.nome || !['A', 'B'].includes(normalized.pote)) return Promise.reject(new Error('Informe nome e pote válidos.'));
      const index = state.jogadores.findIndex(p => p.id === normalized.id); index >= 0 ? state.jogadores.splice(index, 1, normalized) : state.jogadores.push(normalized);
      state.equipes = []; state.rounds = []; state.status = 'RASCUNHO'; saveDemoState(state); return Promise.resolve({ jogador: normalized, estado: state });
    }
    if (action === 'excluirJogador') { state.jogadores = state.jogadores.filter(p => p.id !== params.id); state.equipes = []; state.rounds = []; state.status = 'RASCUNHO'; saveDemoState(state); return Promise.resolve({ estado: state }); }
    if (action === 'gerarCodigo') { const code = String(Math.floor(100000 + Math.random() * 900000)); state = saveDemoState({ ...state, status: 'AGENDADO', activationCode: code, mensagem: 'Código de ativação gerado.' }); return Promise.resolve({ codigo: code, estado: state }); }
    if (action === 'ativar') {
      if (state.activationCode && String(params.codigo) !== String(state.activationCode)) return Promise.reject(new Error('Código de ativação inválido.'));
      return Promise.resolve({ estado: startDemoCountdown(params.codigo, params.origem || 'SITE') });
    }
    if (action === 'cancelar') { state = saveDemoState({ ...state, status: 'CANCELADO', mensagem: 'Sorteio cancelado.', inicioPrevisto: '' }); return Promise.resolve({ estado: state }); }
    if (action === 'resetar') { state = saveDemoState(defaultDemoState()); return Promise.resolve({ estado: state }); }
    if (action === 'enviarTelegram' || action === 'enviarWhatsApp') return Promise.resolve({ mensagem: `Simulação: ativação preparada para ${action === 'enviarTelegram' ? 'Telegram' : 'WhatsApp'}.`, codigo: state.activationCode || '' });
    return Promise.reject(new Error(`Ação de demonstração não implementada: ${action}`));
  }

  function normalizeRounds(state) {
    if (Array.isArray(state.rounds) && state.rounds.length) return state.rounds;
    const rows = Array.isArray(state.chaveamento) ? state.chaveamento : [];
    if (!rows.length) return [];
    const groups = new Map();
    rows.forEach(row => { const index = Number(row.roundIndex ?? row.rodada ?? 0); if (!groups.has(index)) groups.set(index, { index, name: row.fase || `Rodada ${index + 1}`, matches: [] }); groups.get(index).matches.push({ game: row.jogo, phase: row.fase, team1: row.equipe1 || (row.equipe1Id ? { id: row.equipe1Id, jogadorA: row.equipe1 } : null), team2: row.equipe2 || (row.equipe2Id ? { id: row.equipe2Id, jogadorA: row.equipe2 } : null), team1Placeholder: row.equipe1Placeholder, team2Placeholder: row.equipe2Placeholder, winnerId: row.vencedorId, status: row.status }); });
    return [...groups.values()].sort((a, b) => a.index - b.index);
  }
  function teamName(team) { if (!team) return ''; if (typeof team === 'string') return team; return team.nome || [team.jogadorA, team.jogadorB].filter(Boolean).join(' + ') || team.id || ''; }

  const publicUi = {};
  function cachePublicUi() {
    ['connectionDot','connectionText','eventTitle','eventMessage','countdownWrap','countdown','countdownProgress','auditLine','countA','countB','countTeams','potAList','potBList','teamsGrid','balanceSummary','bracket','btnCeremony','openingOverlay','closeOpening','openingStatus','year'].forEach(id => publicUi[id] = document.getElementById(id));
  }
  function setConnection(mode, text) { if (!publicUi.connectionDot) return; publicUi.connectionDot.className = `status-dot ${mode}`; publicUi.connectionText.textContent = text; }
  function renderPlayers(target, players) {
    if (!target) return;
    target.innerHTML = players.length ? players.map(p => `<div class="player-row"><strong>${esc(p.nome)}</strong><span>Peso ${formatWeight(p.peso)}</span></div>`).join('') : '<div class="empty-row">Nenhum jogador ativo.</div>';
  }
  function renderTeams(target, teams, visible = true) {
    if (!target) return;
    if (!visible || !teams.length) { target.innerHTML = '<article class="team-card placeholder"><strong>Equipes ainda não reveladas</strong><p>A composição aparece após a conclusão do sorteio.</p></article>'; return; }
    target.innerHTML = teams.map((team, index) => `<article class="team-card"><header><span>EQUIPE ${String(index + 1).padStart(2, '0')}</span><strong>Total ${formatWeight(team.pesoTotal)}</strong></header><div class="team-players"><div class="team-player"><span>${esc(team.jogadorA)}</span><span>${formatWeight(team.pesoA)}</span></div><div class="team-player"><span>${esc(team.jogadorB)}</span><span>${formatWeight(team.pesoB)}</span></div></div></article>`).join('');
  }
  function renderBracket(rounds) {
    if (!publicUi.bracket) return;
    if (!rounds.length) { publicUi.bracket.innerHTML = '<article class="team-card placeholder"><strong>Chaveamento aguardando o sorteio</strong><p>As posições serão definidas aleatoriamente.</p></article>'; return; }
    publicUi.bracket.innerHTML = rounds.map(round => `<section class="round"><h3>${esc(round.name)}</h3><div class="round-matches">${round.matches.map(match => {
      const first = teamName(match.team1) || match.team1Placeholder || 'A definir'; const second = teamName(match.team2) || match.team2Placeholder || 'A definir';
      return `<article class="match"><div class="match-head"><span>Jogo ${esc(match.game)}</span><span>${esc(match.phase || round.name)}</span></div><div class="match-team ${match.winnerId && match.team1?.id === match.winnerId ? 'winner' : (!match.team1 ? 'empty' : '')}"><span>${esc(first)}</span></div><div class="match-team ${match.winnerId && match.team2?.id === match.winnerId ? 'winner' : (!match.team2 ? 'empty' : '')}"><span>${esc(second)}</span></div><span class="match-status">${esc(match.status || 'AGUARDANDO')}</span></article>`;
    }).join('')}</div></section>`).join('');
  }

  let currentState = null; let clockTimer = null; let pollTimer = null;
  function renderPublic(state) {
    currentState = state; const players = (state.jogadores || []).filter(p => String(p.ativo || 'SIM').toUpperCase() === 'SIM');
    const a = players.filter(p => String(p.pote).toUpperCase() === 'A').sort((x, y) => num(y.peso) - num(x.peso));
    const b = players.filter(p => String(p.pote).toUpperCase() === 'B').sort((x, y) => num(x.peso) - num(y.peso));
    const teams = state.equipes || []; const rounds = normalizeRounds(state); const status = String(state.status || 'RASCUNHO').toUpperCase();
    publicUi.eventTitle.textContent = state.titulo || CFG.APP_NAME || 'Sorteio de Duplas de Vôlei';
    publicUi.eventMessage.textContent = state.mensagem || ({ RASCUNHO:'Aguardando a ativação oficial do sorteio.', AGENDADO:'Código gerado. Aguardando comando de ativação.', EM_CONTAGEM:'Sorteio ativado. Acompanhe a contagem regressiva.', SORTEADO:'Sorteio concluído. Equipes e chaveamento revelados.', CANCELADO:'O sorteio foi cancelado.' }[status] || status);
    publicUi.countA.textContent = a.length; publicUi.countB.textContent = b.length; publicUi.countTeams.textContent = Math.min(a.length, b.length);
    renderPlayers(publicUi.potAList, a); renderPlayers(publicUi.potBList, b); renderTeams(publicUi.teamsGrid, teams, status === 'SORTEADO'); renderBracket(status === 'SORTEADO' ? rounds : []);
    const totals = teams.map(t => num(t.pesoTotal)); const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : null;
    publicUi.balanceSummary.textContent = status === 'SORTEADO' ? `Equipes formadas. Diferença entre o maior e o menor peso total: ${formatWeight(spread)}.` : 'As equipes serão reveladas quando o sorteio for concluído.';
    publicUi.auditLine.textContent = [state.versao || CFG.VERSION, state.hashAuditoria ? `Hash ${state.hashAuditoria}` : '', state.modo === 'DEMO' || CFG.DEMO_MODE ? 'Modo demonstração' : 'Sincronizado com Google Sheets'].filter(Boolean).join(' • ');
    publicUi.countdownWrap.hidden = status !== 'EM_CONTAGEM';
    if (status === 'EM_CONTAGEM') startClock(state); else stopClock();
    setConnection(CFG.DEMO_MODE || !CFG.API_BASE ? 'warn' : 'ok', CFG.DEMO_MODE || !CFG.API_BASE ? 'Demonstração local' : 'Sincronizado');
  }
  function stopClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }
  function startClock(state) {
    stopClock(); const end = parseDate(state.inicioPrevisto); const total = Number(state.countdownSeconds || CFG.COUNTDOWN_SECONDS || 600);
    const server = parseDate(state.serverTime) || new Date(); const offset = Date.now() - server.getTime();
    const update = () => {
      const remaining = end ? Math.max(0, Math.ceil((end.getTime() - (Date.now() - offset)) / 1000)) : total;
      const min = Math.floor(remaining / 60); const sec = remaining % 60; publicUi.countdown.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; publicUi.countdownProgress.style.width = `${Math.max(0, Math.min(100, remaining / total * 100))}%`;
      if (remaining <= 0) { stopClock(); if (CFG.DEMO_MODE || !CFG.API_BASE) renderPublic(completeDemoDraw(getDemoState())); else refreshPublic(); }
    };
    update(); clockTimer = setInterval(update, 500);
  }
  async function refreshPublic() {
    try { const state = await request('estado'); renderPublic(state); }
    catch (error) { setConnection('warn', error.message); if (!currentState) renderPublic(getDemoState()); }
  }
  function showOpening() {
    if (!publicUi.openingOverlay) return; publicUi.openingOverlay.hidden = false;
    const messages = currentState?.status === 'SORTEADO' ? ['Abrindo a cerimônia...', 'Revelando as duplas...', 'Montando o chaveamento...', 'Sorteio concluído!'] : ['Preparando os potes...', 'Conferindo os pesos...', 'Validando a equivalência...', 'Aguardando a ativação...'];
    let index = 0; publicUi.openingStatus.textContent = messages[0]; const timer = setInterval(() => { index++; if (index >= messages.length || publicUi.openingOverlay.hidden) return clearInterval(timer); publicUi.openingStatus.textContent = messages[index]; }, 1150);
  }
  function initPublic() {
    cachePublicUi(); publicUi.year.textContent = new Date().getFullYear(); publicUi.btnCeremony?.addEventListener('click', showOpening); publicUi.closeOpening?.addEventListener('click', () => publicUi.openingOverlay.hidden = true);
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) refreshPublic(); }); refreshPublic(); pollTimer = setInterval(refreshPublic, Number(CFG.POLL_INTERVAL_MS || 5000));
  }

  window.VoleiApp = { CFG, STORAGE_KEY, esc, num, formatWeight, parseDate, uid, balanceTeams, buildBracket, getDemoState, saveDemoState, completeDemoDraw, startDemoCountdown, request, jsonp, normalizeRounds, teamName };
  if (document.body?.dataset.page === 'public') initPublic();
})();
