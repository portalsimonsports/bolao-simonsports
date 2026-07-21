(() => {
  'use strict';
  if (!window.VoleiApp) return;
  const A = window.VoleiApp;
  const C = A.CFG;
  const originalRequest = A.request.bind(A);
  const rules = Object.freeze({
    bestOf: Number(C.BEST_OF_SETS || 3),
    setsToWin: Number(C.SETS_TO_WIN || 2),
    normalTarget: Number(C.NORMAL_SET_POINTS || 21),
    tieBreakTarget: Number(C.TIEBREAK_SET_POINTS || 15),
    minimumLead: Number(C.MINIMUM_LEAD || 2),
    matchIntervalMinutes: Number(C.MATCH_INTERVAL_MINUTES || 10)
  });

  function optionalPoint(value) {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error('A pontuação deve usar números inteiros não negativos.');
    return n;
  }
  function validateSet(a, b, target, setNumber) {
    a = optionalPoint(a); b = optionalPoint(b);
    if (a === null || b === null) throw new Error(`Preencha a pontuação do ${setNumber}º set.`);
    if (a === b) throw new Error(`O ${setNumber}º set não pode terminar empatado.`);
    if (Math.max(a, b) < target || Math.abs(a - b) < rules.minimumLead) {
      throw new Error(`Placar inválido no ${setNumber}º set. O vencedor precisa atingir ${target} pontos e abrir vantagem mínima de ${rules.minimumLead}.`);
    }
    return a > b ? 1 : 2;
  }
  function validateMatchScore(values) {
    const s1a = optionalPoint(values.s1a), s1b = optionalPoint(values.s1b);
    const s2a = optionalPoint(values.s2a), s2b = optionalPoint(values.s2b);
    const s3a = optionalPoint(values.s3a), s3b = optionalPoint(values.s3b);
    const w1 = validateSet(s1a, s1b, rules.normalTarget, 1);
    const w2 = validateSet(s2a, s2b, rules.normalTarget, 2);
    let sets1 = (w1 === 1 ? 1 : 0) + (w2 === 1 ? 1 : 0);
    let sets2 = (w1 === 2 ? 1 : 0) + (w2 === 2 ? 1 : 0);
    if (sets1 === 1 && sets2 === 1) {
      const w3 = validateSet(s3a, s3b, rules.tieBreakTarget, 3);
      if (w3 === 1) sets1++; else sets2++;
    } else if ((s3a !== null && s3a !== 0) || (s3b !== null && s3b !== 0)) {
      throw new Error('O 3º set só deve ser preenchido quando a partida estiver empatada em 1 set a 1.');
    }
    return {
      scores: [[s1a, s1b], [s2a, s2b], [s3a, s3b]],
      sets1, sets2, winnerSide: sets1 === rules.setsToWin ? 1 : 2
    };
  }
  function normalizeMatch(match) {
    match.scores = Array.isArray(match.scores) ? match.scores : [[null, null], [null, null], [null, null]];
    while (match.scores.length < 3) match.scores.push([null, null]);
    match.sets1 = Number(match.sets1 || 0);
    match.sets2 = Number(match.sets2 || 0);
    match.finishedAt = match.finishedAt || '';
    match.availableAt = match.availableAt || '';
    return match;
  }
  function normalizeState(state) {
    if (!state || !Array.isArray(state.rounds)) return state;
    const matches = state.rounds.flatMap(round => round.matches || []).map(normalizeMatch);
    const hasAvailability = matches.some(match => match.availableAt);
    if (!hasAvailability) {
      const first = matches.find(match => match.team1 && match.team2 && match.status === 'AGUARDANDO');
      if (first) first.availableAt = new Date().toISOString();
    }
    state.regras = { melhorDe: 3, setsParaVencer: 2, pontosSetNormal: 21, pontosDesempate: 15, vantagemMinima: 2, intervaloPartidasMinutos: rules.matchIntervalMinutes };
    return state;
  }
  function nextPlayable(state, currentGame) {
    return state.rounds.flatMap(round => round.matches || [])
      .map(normalizeMatch)
      .filter(match => Number(match.game) !== Number(currentGame))
      .sort((a, b) => Number(a.game) - Number(b.game))
      .find(match => match.team1 && match.team2 && match.status === 'AGUARDANDO' && !match.availableAt);
  }
  function demoSaveScore(params) {
    const state = normalizeState(A.ler());
    const match = state.rounds.flatMap(round => round.matches || []).find(item => Number(item.game) === Number(params.jogo));
    if (!match) throw new Error('Jogo não encontrado.');
    if (!match.team1 || !match.team2) throw new Error('As duas equipes ainda não estão definidas para esta partida.');
    if (match.status === 'FINALIZADO') throw new Error('Esta partida já foi finalizada.');
    const available = match.availableAt ? A.data(match.availableAt) : null;
    if (available && available.getTime() > Date.now()) {
      throw new Error(`Respeite o intervalo de ${rules.matchIntervalMinutes} minutos. Esta partida ainda não está liberada.`);
    }
    const result = validateMatchScore(params);
    match.scores = result.scores;
    match.sets1 = result.sets1;
    match.sets2 = result.sets2;
    match.winnerId = result.winnerSide === 1 ? match.team1.id : match.team2.id;
    match.status = 'FINALIZADO';
    match.finishedAt = new Date().toISOString();
    A.avancar(state.rounds, match);
    const next = nextPlayable(state, match.game);
    if (next) next.availableAt = new Date(Date.now() + rules.matchIntervalMinutes * 60000).toISOString();
    A.gravar(state);
    return { mensagem: `Placar registrado. Próxima partida liberada em ${rules.matchIntervalMinutes} minutos.`, estado: state };
  }
  function decodePayload(payload) {
    const parts = String(payload || '').split('|');
    if (parts[0] !== 'PLACAR') throw new Error('Preencha a pontuação dos sets antes de salvar.');
    return { s1a: parts[1], s1b: parts[2], s2a: parts[3], s2b: parts[4], s3a: parts[5], s3b: parts[6] };
  }

  A.rules = rules;
  A.validateMatchScore = validateMatchScore;
  A.normalizeMatch = normalizeMatch;
  A.request = async function (action, params = {}) {
    const demo = C.DEMO_MODE || !C.API_BASE;
    if (demo && action === 'registrarResultado') return demoSaveScore({ jogo: params.jogo, ...decodePayload(params.vencedorId) });
    const result = await originalRequest(action, params);
    if (!demo) return result;
    if (result?.estado) {
      normalizeState(result.estado);
      A.gravar(result.estado);
    } else if (action === 'estado' || action === 'admin') {
      normalizeState(result);
      A.gravar(result);
    }
    return result;
  };
})();