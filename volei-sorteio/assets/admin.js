(() => {
  'use strict';
  if (document.body?.dataset.page !== 'admin' || !window.VoleiApp) return;

  const App = window.VoleiApp;
  const SESSION_KEY = 'pss_volei_admin_key';
  const ui = {};
  let state = null;
  let lastActivationCode = '';

  function cache() {
    [
      'adminMode','adminStatus','adminKey','saveAdminKey','activationCode','generateCode',
      'sendTelegram','sendWhatsApp','cancelDraw','activationInput','activateDraw','drawNow',
      'resetDraw','refreshAdmin','playerForm','playerId','playerName','playerPot','playerWeight',
      'playerActive','playersTableBody','adminTeamsPreview','matchesAdmin','sheetLink','apiLabel',
      'toastStack'
    ].forEach(id => ui[id] = document.getElementById(id));
  }

  function key() { return ui.adminKey.value.trim(); }

  function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    ui.toastStack.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  function setBusy(button, busy, text = 'Processando...') {
    if (!button) return;
    if (busy) {
      button.dataset.original = button.textContent;
      button.textContent = text;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.original || button.textContent;
      button.disabled = false;
    }
  }

  function authParams(extra = {}) { return { chave: key(), ...extra }; }

  function validateAdminKey() {
    if (App.CFG.DEMO_MODE || !App.CFG.API_BASE) return true;
    if (!key()) {
      toast('Informe a chave administrativa.', 'warn');
      ui.adminKey.focus();
      return false;
    }
    return true;
  }

  function renderPlayers(players) {
    ui.playersTableBody.innerHTML = players.length
      ? players.map(p => `<tr>
          <td>${App.esc(p.id)}</td>
          <td>${App.esc(p.nome)}</td>
          <td>${App.esc(p.pote)}</td>
          <td>${App.formatWeight(p.peso)}</td>
          <td>${App.esc(p.ativo || 'SIM')}</td>
          <td>
            <button class="table-action edit" data-action="edit" data-id="${App.esc(p.id)}">Editar</button>
            <button class="table-action delete" data-action="delete" data-id="${App.esc(p.id)}">Excluir</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="6">Nenhum jogador cadastrado.</td></tr>';
  }

  function renderPreview(players) {
    try {
      const teams = App.balanceTeams(players);
      ui.adminTeamsPreview.innerHTML = teams.map((team, index) => `<article class="team-card">
        <header><span>EQUIPE ${String(index + 1).padStart(2, '0')}</span><strong>Total ${App.formatWeight(team.pesoTotal)}</strong></header>
        <div class="team-players">
          <div class="team-player"><span>${App.esc(team.jogadorA)}</span><span>${App.formatWeight(team.pesoA)}</span></div>
          <div class="team-player"><span>${App.esc(team.jogadorB)}</span><span>${App.formatWeight(team.pesoB)}</span></div>
        </div>
      </article>`).join('');
    } catch (error) {
      ui.adminTeamsPreview.innerHTML = `<article class="team-card placeholder"><strong>Prévia indisponível</strong><p>${App.esc(error.message)}</p></article>`;
    }
  }

  function findTeam(match, winnerId) {
    if (match.team1?.id === winnerId) return match.team1;
    if (match.team2?.id === winnerId) return match.team2;
    return null;
  }

  function renderMatches(nextState) {
    const rounds = App.normalizeRounds(nextState || {});
    if (!rounds.length) {
      ui.matchesAdmin.innerHTML = '<div class="empty-results">O controle dos resultados aparecerá depois que o sorteio formar o chaveamento.</div>';
      return;
    }

    const finalMatch = rounds.flatMap(r => r.matches || []).find(m => String(m.phase || '').toUpperCase() === 'FINAL');
    const champion = finalMatch?.winnerId ? findTeam(finalMatch, finalMatch.winnerId) : null;
    const championHtml = champion
      ? `<div class="champion-box"><span>🏆 CAMPEÃ DO TORNEIO</span><strong>${App.esc(App.teamName(champion))}</strong></div>`
      : '';

    ui.matchesAdmin.innerHTML = championHtml + rounds.map(round => `<section class="admin-round">
      <h3>${App.esc(round.name || `Rodada ${Number(round.index || 0) + 1}`)}</h3>
      ${(round.matches || []).map(match => {
        const status = String(match.status || 'AGUARDANDO').toUpperCase();
        const locked = ['FINALIZADO','BYE','VAZIO'].includes(status);
        const t1Name = App.teamName(match.team1) || match.team1Placeholder || 'A definir';
        const t2Name = App.teamName(match.team2) || match.team2Placeholder || 'A definir';
        const canChoose = !locked && match.team1?.id && match.team2?.id;

        const teamButton = (team, label) => {
          if (!team?.id || !canChoose) {
            return `<div class="winner-choice ${match.winnerId === team?.id ? 'selected' : ''}">${App.esc(label)}</div>`;
          }
          return `<button type="button" class="winner-choice ${match.winnerId === team.id ? 'selected' : ''}"
            data-result-game="${App.esc(match.game)}" data-winner-id="${App.esc(team.id)}">${App.esc(label)}</button>`;
        };

        return `<article class="admin-match">
          <div class="admin-match-meta">Jogo ${App.esc(match.game)}<br>${App.esc(match.phase || round.name || '')}</div>
          <div class="admin-match-teams">
            ${teamButton(match.team1, t1Name)}
            ${teamButton(match.team2, t2Name)}
          </div>
          <span class="match-result-status">${App.esc(status)}</span>
        </article>`;
      }).join('')}
    </section>`).join('');
  }

  function render(next) {
    state = next || {};
    const players = Array.isArray(state.jogadores) ? state.jogadores : [];
    ui.adminMode.textContent = App.CFG.DEMO_MODE || !App.CFG.API_BASE
      ? 'Modo demonstração local'
      : 'Sincronizado com Google Sheets';
    ui.adminStatus.textContent = String(state.status || 'RASCUNHO').toUpperCase();
    ui.activationCode.textContent = lastActivationCode || state.codigoAtivacao || state.activationCode || '— — — — — —';
    renderPlayers(players);
    renderPreview(players);
    renderMatches(state);
  }

  async function refresh() {
    setBusy(ui.refreshAdmin, true, 'Atualizando...');
    try {
      render(await App.request('admin', authParams()));
    } catch (error) {
      toast(error.message, 'error');
      if (!state) render(App.getDemoState());
    } finally {
      setBusy(ui.refreshAdmin, false);
    }
  }

  async function runAction(button, action, params, successText) {
    setBusy(button, true);
    try {
      const result = await App.request(action, params);
      if (result.codigo) {
        lastActivationCode = String(result.codigo);
        ui.activationCode.textContent = lastActivationCode;
        ui.activationInput.value = lastActivationCode;
      }
      toast(result.mensagem || successText || 'Operação concluída.');
      await refresh();
      return result;
    } catch (error) {
      toast(error.message, 'error');
      throw error;
    } finally {
      setBusy(button, false);
    }
  }

  async function savePlayer(event) {
    event.preventDefault();
    if (!validateAdminKey()) return;

    const player = {
      id: ui.playerId.value.trim(),
      nome: ui.playerName.value.trim(),
      pote: ui.playerPot.value,
      peso: ui.playerWeight.value,
      ativo: ui.playerActive.value
    };

    if (!player.nome || player.peso === '') {
      toast('Informe o nome e o peso técnico.', 'warn');
      return;
    }

    const button = ui.playerForm.querySelector('button[type="submit"]');
    setBusy(button, true, 'Salvando...');
    try {
      await App.request('salvarJogador', authParams(player));
      toast('Jogador salvo.');
      ui.playerForm.reset();
      ui.playerId.value = '';
      ui.playerActive.value = 'SIM';
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function editPlayer(id) {
    const p = state?.jogadores?.find(item => item.id === id);
    if (!p) return;
    ui.playerId.value = p.id;
    ui.playerName.value = p.nome;
    ui.playerPot.value = p.pote;
    ui.playerWeight.value = p.peso;
    ui.playerActive.value = p.ativo || 'SIM';
    ui.playerName.focus();
    window.scrollTo({
      top: ui.playerForm.getBoundingClientRect().top + window.scrollY - 110,
      behavior: 'smooth'
    });
  }

  async function deletePlayer(id) {
    if (!validateAdminKey()) return;
    const player = state?.jogadores?.find(item => item.id === id);
    if (!player || !confirm(`Excluir ${player.nome}?`)) return;

    try {
      await App.request('excluirJogador', authParams({ id }));
      toast('Jogador excluído.');
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function registerWinner(game, winnerId) {
    if (!validateAdminKey()) return;
    const button = ui.matchesAdmin.querySelector(`[data-result-game="${CSS.escape(String(game))}"][data-winner-id="${CSS.escape(String(winnerId))}"]`);
    setBusy(button, true, 'Registrando...');
    try {
      const result = await App.request('registrarResultado', authParams({ jogo: game, vencedorId: winnerId }));
      toast(result.mensagem || 'Resultado registrado.');
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function bind() {
    ui.adminKey.value = sessionStorage.getItem(SESSION_KEY) || '';

    ui.saveAdminKey.addEventListener('click', () => {
      sessionStorage.setItem(SESSION_KEY, key());
      toast('Chave mantida somente nesta sessão.');
      refresh();
    });

    ui.playerForm.addEventListener('submit', savePlayer);

    ui.playersTableBody.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      button.dataset.action === 'edit' ? editPlayer(button.dataset.id) : deletePlayer(button.dataset.id);
    });

    ui.matchesAdmin.addEventListener('click', event => {
      const button = event.target.closest('button[data-result-game][data-winner-id]');
      if (!button) return;
      registerWinner(button.dataset.resultGame, button.dataset.winnerId);
    });

    ui.refreshAdmin.addEventListener('click', refresh);
    ui.generateCode.addEventListener('click', () => {
      if (validateAdminKey()) runAction(ui.generateCode, 'gerarCodigo', authParams(), 'Código gerado.');
    });
    ui.sendTelegram.addEventListener('click', () => {
      if (validateAdminKey()) runAction(ui.sendTelegram, 'enviarTelegram', authParams(), 'Mensagem enviada ao Telegram.');
    });
    ui.sendWhatsApp.addEventListener('click', () => {
      if (validateAdminKey()) runAction(ui.sendWhatsApp, 'enviarWhatsApp', authParams(), 'Mensagem enviada ao WhatsApp.');
    });
    ui.cancelDraw.addEventListener('click', () => {
      if (validateAdminKey() && confirm('Cancelar o sorteio atual?')) {
        runAction(ui.cancelDraw, 'cancelar', authParams(), 'Sorteio cancelado.');
      }
    });
    ui.drawNow.addEventListener('click', () => {
      if (validateAdminKey() && confirm('Realizar o sorteio imediatamente, sem aguardar os 10 minutos?')) {
        runAction(ui.drawNow, 'sortearAgora', authParams(), 'Sorteio realizado.');
      }
    });
    ui.resetDraw.addEventListener('click', () => {
      if (validateAdminKey() && confirm('Reiniciar o sorteio e limpar equipes e chaveamento?')) {
        lastActivationCode = '';
        runAction(ui.resetDraw, 'resetar', authParams(), 'Sorteio reiniciado.');
      }
    });
    ui.activateDraw.addEventListener('click', async () => {
      const codigo = ui.activationInput.value.replace(/\D/g, '');
      if (codigo.length !== 6) {
        toast('Informe o código de seis dígitos.', 'warn');
        return;
      }
      await runAction(
        ui.activateDraw,
        'ativar',
        { codigo, origem: 'PAINEL_WEB' },
        'Sorteio ativado. A contagem de 10 minutos começou.'
      );
    });
  }

  function init() {
    cache();
    bind();

    ui.sheetLink.href = App.CFG.SHEET_URL ||
      `https://docs.google.com/spreadsheets/d/${App.CFG.SHEET_ID}/edit`;
    ui.apiLabel.textContent = App.CFG.API_BASE || 'Não configurada — modo demonstração';

    const codeFromUrl = new URLSearchParams(location.search).get('codigo');
    if (codeFromUrl) {
      ui.activationInput.value = codeFromUrl.replace(/\D/g, '').slice(0, 6);
      toast('Código recebido pelo link. Confirme a ativação.', 'warn');
    }

    refresh();

    window.addEventListener('storage', event => {
      if (event.key === App.STORAGE_KEY) refresh();
    });

    setInterval(() => {
      if (App.CFG.DEMO_MODE || !App.CFG.API_BASE || key()) refresh();
    }, 10000);
  }

  init();
})();
