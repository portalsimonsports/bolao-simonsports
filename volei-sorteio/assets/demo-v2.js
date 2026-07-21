(() => {
  'use strict';

  const App = window.VoleiApp;
  if (!App) return;

  const originalRequest = App.request.bind(App);
  const isDemo = () => App.CFG.DEMO_MODE || !App.CFG.API_BASE;

  function normalizeState() {
    const state = App.getDemoState();
    state.rounds = App.normalizeRounds(state);
    return state;
  }

  function allMatches(rounds) {
    return (rounds || []).flatMap(round => round.matches || []);
  }

  function findTeam(match, winnerId) {
    if (match.team1?.id === winnerId) return match.team1;
    if (match.team2?.id === winnerId) return match.team2;
    return null;
  }

  function registerDemoResult(params) {
    const game = Number(params.jogo);
    const winnerId = String(params.vencedorId || '').trim();
    const state = normalizeState();
    const rounds = state.rounds || [];

    let roundIndex = -1;
    let matchIndex = -1;
    let match = null;

    rounds.some((round, rIndex) => {
      const index = (round.matches || []).findIndex(item => Number(item.game) === game);
      if (index < 0) return false;
      roundIndex = rIndex;
      matchIndex = index;
      match = round.matches[index];
      return true;
    });

    if (!match) throw new Error('Jogo não encontrado.');
    const winner = findTeam(match, winnerId);
    if (!winner) throw new Error('A equipe escolhida não pertence a este jogo.');

    match.winnerId = winnerId;
    match.status = 'FINALIZADO';
    match.dataHora = new Date().toISOString();

    if (roundIndex < rounds.length - 1) {
      const nextMatch = rounds[roundIndex + 1].matches[Math.floor(matchIndex / 2)];
      if (matchIndex % 2 === 0) {
        nextMatch.team1 = winner;
        nextMatch.team1Placeholder = '';
      } else {
        nextMatch.team2 = winner;
        nextMatch.team2Placeholder = '';
      }

      if (nextMatch.team1 && nextMatch.team2 && nextMatch.status !== 'FINALIZADO') {
        nextMatch.status = 'AGUARDANDO';
      }
    }

    state.rounds = rounds;
    state.mensagem = 'Resultado registrado. O vencedor avançou no chaveamento.';
    App.saveDemoState(state);

    return {
      mensagem: 'Resultado registrado em modo demonstração.',
      estado: state
    };
  }

  App.request = async function requestV2(action, params = {}) {
    if (!isDemo()) return originalRequest(action, params);

    if (action === 'sortearAgora') {
      const state = App.completeDemoDraw(App.getDemoState());
      return {
        mensagem: 'Sorteio realizado em modo demonstração.',
        estado: state,
        equipes: state.equipes,
        rounds: state.rounds
      };
    }

    if (action === 'registrarResultado') {
      return registerDemoResult(params);
    }

    return originalRequest(action, params);
  };
})();
