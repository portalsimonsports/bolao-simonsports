(() => {
  'use strict';
  if (document.body?.dataset.page !== 'admin' || !window.VoleiApp) return;

  const App = window.VoleiApp;
  const SESSION_KEY = 'pss_volei_admin_key';
  const ui = {};
  let state = null;

  function cache() {
    ['adminMode','adminStatus','adminKey','saveAdminKey','activationCode','generateCode','sendTelegram','sendWhatsApp','cancelDraw','activationInput','activateDraw','refreshAdmin','playerForm','playerId','playerName','playerPot','playerWeight','playerActive','playersTableBody','adminTeamsPreview','sheetLink','apiLabel','toastStack'].forEach(id => ui[id] = document.getElementById(id));
  }
  function key() { return ui.adminKey.value.trim(); }
  function toast(message, type = 'ok') {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; ui.toastStack.appendChild(el); setTimeout(() => el.remove(), 4500);
  }
  function setBusy(button, busy, text = 'Processando...') {
    if (!button) return; if (busy) { button.dataset.original = button.textContent; button.textContent = text; button.disabled = true; } else { button.textContent = button.dataset.original || button.textContent; button.disabled = false; }
  }
  function authParams(extra = {}) { return { chave: key(), ...extra }; }
  function validateAdminKey() {
    if ((App.CFG.DEMO_MODE || !App.CFG.API_BASE)) return true;
    if (!key()) { toast('Informe a chave administrativa.', 'warn'); ui.adminKey.focus(); return false; }
    return true;
  }

  function renderPlayers(players) {
    ui.playersTableBody.innerHTML = players.length ? players.map(p => `<tr><td>${App.esc(p.id)}</td><td>${App.esc(p.nome)}</td><td>${App.esc(p.pote)}</td><td>${App.formatWeight(p.peso)}</td><td>${App.esc(p.ativo || 'SIM')}</td><td><button class="table-action edit" data-action="edit" data-id="${App.esc(p.id)}">Editar</button><button class="table-action delete" data-action="delete" data-id="${App.esc(p.id)}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="6">Nenhum jogador cadastrado.</td></tr>';
  }
  function renderPreview(players) {
    try {
      const teams = App.balanceTeams(players);
      ui.adminTeamsPreview.innerHTML = teams.map((team, index) => `<article class="team-card"><header><span>EQUIPE ${String(index + 1).padStart(2, '0')}</span><strong>Total ${App.formatWeight(team.pesoTotal)}</strong></header><div class="team-players"><div class="team-player"><span>${App.esc(team.jogadorA)}</span><span>${App.formatWeight(team.pesoA)}</span></div><div class="team-player"><span>${App.esc(team.jogadorB)}</span><span>${App.formatWeight(team.pesoB)}</span></div></div></article>`).join('');
    } catch (error) {
      ui.adminTeamsPreview.innerHTML = `<article class="team-card placeholder"><strong>Prévia indisponível</strong><p>${App.esc(error.message)}</p></article>`;
    }
  }
  function render(next) {
    state = next || {}; const players = Array.isArray(state.jogadores) ? state.jogadores : [];
    ui.adminMode.textContent = App.CFG.DEMO_MODE || !App.CFG.API_BASE ? 'Modo demonstração local' : 'Sincronizado com Google Sheets';
    ui.adminStatus.textContent = String(state.status || 'RASCUNHO').toUpperCase();
    ui.activationCode.textContent = state.codigoAtivacao || state.activationCode || '— — — — — —';
    renderPlayers(players); renderPreview(players);
  }
  async function refresh() {
    setBusy(ui.refreshAdmin, true, 'Atualizando...');
    try { render(await App.request('admin', authParams())); }
    catch (error) { toast(error.message, 'error'); if (!state) render(App.getDemoState()); }
    finally { setBusy(ui.refreshAdmin, false); }
  }
  async function runAction(button, action, params, successText) {
    setBusy(button, true);
    try {
      const result = await App.request(action, params);
      if (result.codigo) { ui.activationCode.textContent = result.codigo; ui.activationInput.value = result.codigo; }
      toast(result.mensagem || successText || 'Operação concluída.');
      await refresh(); return result;
    } catch (error) { toast(error.message, 'error'); throw error; }
    finally { setBusy(button, false); }
  }

  async function savePlayer(event) {
    event.preventDefault(); if (!validateAdminKey()) return;
    const player = { id: ui.playerId.value.trim(), nome: ui.playerName.value.trim(), pote: ui.playerPot.value, peso: ui.playerWeight.value, ativo: ui.playerActive.value };
    if (!player.nome || player.peso === '') return toast('Informe o nome e o peso técnico.', 'warn');
    const button = ui.playerForm.querySelector('button[type="submit"]');
    setBusy(button, true, 'Salvando...');
    try {
      await App.request('salvarJogador', authParams(player)); toast('Jogador salvo.'); ui.playerForm.reset(); ui.playerId.value = ''; ui.playerActive.value = 'SIM'; await refresh();
    } catch (error) { toast(error.message, 'error'); }
    finally { setBusy(button, false); }
  }
  function editPlayer(id) {
    const p = state?.jogadores?.find(item => item.id === id); if (!p) return;
    ui.playerId.value = p.id; ui.playerName.value = p.nome; ui.playerPot.value = p.pote; ui.playerWeight.value = p.peso; ui.playerActive.value = p.ativo || 'SIM'; ui.playerName.focus(); window.scrollTo({ top: ui.playerForm.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
  }
  async function deletePlayer(id) {
    if (!validateAdminKey()) return;
    const player = state?.jogadores?.find(item => item.id === id); if (!player || !confirm(`Excluir ${player.nome}?`)) return;
    try { await App.request('excluirJogador', authParams({ id })); toast('Jogador excluído.'); await refresh(); }
    catch (error) { toast(error.message, 'error'); }
  }

  function bind() {
    ui.adminKey.value = sessionStorage.getItem(SESSION_KEY) || '';
    ui.saveAdminKey.addEventListener('click', () => { sessionStorage.setItem(SESSION_KEY, key()); toast('Chave mantida somente nesta sessão.'); refresh(); });
    ui.playerForm.addEventListener('submit', savePlayer);
    ui.playersTableBody.addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (!button) return; button.dataset.action === 'edit' ? editPlayer(button.dataset.id) : deletePlayer(button.dataset.id); });
    ui.refreshAdmin.addEventListener('click', refresh);
    ui.generateCode.addEventListener('click', () => { if (validateAdminKey()) runAction(ui.generateCode, 'gerarCodigo', authParams(), 'Código gerado.'); });
    ui.sendTelegram.addEventListener('click', () => { if (validateAdminKey()) runAction(ui.sendTelegram, 'enviarTelegram', authParams(), 'Mensagem enviada ao Telegram.'); });
    ui.sendWhatsApp.addEventListener('click', () => { if (validateAdminKey()) runAction(ui.sendWhatsApp, 'enviarWhatsApp', authParams(), 'Mensagem enviada ao WhatsApp.'); });
    ui.cancelDraw.addEventListener('click', () => { if (validateAdminKey() && confirm('Cancelar o sorteio atual?')) runAction(ui.cancelDraw, 'cancelar', authParams(), 'Sorteio cancelado.'); });
    ui.activateDraw.addEventListener('click', async () => {
      const codigo = ui.activationInput.value.replace(/\D/g, ''); if (codigo.length !== 6) return toast('Informe o código de seis dígitos.', 'warn');
      await runAction(ui.activateDraw, 'ativar', { codigo, origem: 'PAINEL_WEB' }, 'Sorteio ativado. A contagem de 10 minutos começou.');
    });
  }

  function init() {
    cache(); bind(); ui.sheetLink.href = App.CFG.SHEET_URL || `https://docs.google.com/spreadsheets/d/${App.CFG.SHEET_ID}/edit`; ui.apiLabel.textContent = App.CFG.API_BASE || 'Não configurada — modo demonstração';
    const codeFromUrl = new URLSearchParams(location.search).get('codigo'); if (codeFromUrl) { ui.activationInput.value = codeFromUrl.replace(/\D/g, '').slice(0, 6); toast('Código recebido pelo link. Confirme a ativação.', 'warn'); }
    refresh(); window.addEventListener('storage', event => { if (event.key === App.STORAGE_KEY) refresh(); });
  }
  init();
})();
