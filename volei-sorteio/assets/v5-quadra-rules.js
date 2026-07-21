(() => {
  'use strict';
  if (!window.VoleiApp) return;
  const A = window.VoleiApp;
  const baseRequest = A.request.bind(A);
  const rules = Object.freeze({bestOf:3,setsToWin:2,normalTarget:25,tieBreakTarget:15,minimumLead:2,matchIntervalMinutes:Number(A.CFG.MATCH_INTERVAL_MINUTES||10)});
  const point = value => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error('A pontuação deve usar números inteiros não negativos.');
    return n;
  };
  function setWinner(a,b,target,setNumber){
    a=point(a);b=point(b);
    if(a===null||b===null)throw new Error(`Preencha a pontuação do ${setNumber}º set.`);
    if(a===b)throw new Error(`O ${setNumber}º set não pode terminar empatado.`);
    if(Math.max(a,b)<target||Math.abs(a-b)<2)throw new Error(`Placar inválido no ${setNumber}º set. O vencedor precisa atingir ${target} pontos e abrir vantagem mínima de 2.`);
    return a>b?1:2;
  }
  function validate(values){
    const s1a=point(values.s1a),s1b=point(values.s1b),s2a=point(values.s2a),s2b=point(values.s2b),s3a=point(values.s3a),s3b=point(values.s3b);
    const w1=setWinner(s1a,s1b,25,1),w2=setWinner(s2a,s2b,25,2);
    let sets1=(w1===1?1:0)+(w2===1?1:0),sets2=(w1===2?1:0)+(w2===2?1:0);
    if(sets1===1&&sets2===1){const w3=setWinner(s3a,s3b,15,3);if(w3===1)sets1++;else sets2++;}
    else if((s3a!==null&&s3a!==0)||(s3b!==null&&s3b!==0))throw new Error('O 3º set só deve ser preenchido quando a partida estiver empatada em 1 set a 1.');
    return{scores:[[s1a,s1b],[s2a,s2b],[s3a,s3b]],sets1,sets2,winnerSide:sets1===2?1:2};
  }
  function decode(payload){const p=String(payload||'').split('|');if(p[0]!=='PLACAR')throw new Error('Preencha a pontuação dos sets antes de salvar.');return{s1a:p[1],s1b:p[2],s2a:p[3],s2b:p[4],s3a:p[5],s3b:p[6]};}
  function saveDemo(params){
    const state=A.ler(),match=(state.rounds||[]).flatMap(r=>r.matches||[]).find(m=>Number(m.game)===Number(params.jogo));
    if(!match)throw new Error('Jogo não encontrado.');
    if(!match.team1||!match.team2)throw new Error('As duas equipes ainda não estão definidas para esta partida.');
    if(match.status==='FINALIZADO')throw new Error('Esta partida já foi finalizada.');
    const available=match.availableAt?A.data(match.availableAt):null;
    if(available&&available.getTime()>Date.now())throw new Error(`Respeite o intervalo de ${rules.matchIntervalMinutes} minutos entre partidas.`);
    const result=validate(params);
    match.scores=result.scores;match.sets1=result.sets1;match.sets2=result.sets2;match.winnerId=result.winnerSide===1?match.team1.id:match.team2.id;match.status='FINALIZADO';match.finishedAt=new Date().toISOString();
    A.avancar(state.rounds,match);
    const next=(state.rounds||[]).flatMap(r=>r.matches||[]).sort((a,b)=>Number(a.game)-Number(b.game)).find(m=>Number(m.game)!==Number(match.game)&&m.team1&&m.team2&&m.status==='AGUARDANDO'&&!m.availableAt);
    if(next)next.availableAt=new Date(Date.now()+rules.matchIntervalMinutes*60000).toISOString();
    state.regras={melhorDe:3,setsParaVencer:2,pontosSetNormal:25,pontosDesempate:15,vantagemMinima:2,intervaloPartidasMinutos:rules.matchIntervalMinutes};A.gravar(state);
    return{mensagem:`Placar registrado. Próxima partida liberada em ${rules.matchIntervalMinutes} minutos.`,estado:state};
  }
  A.rules=rules;A.validateMatchScore=validate;
  A.request=async(action,params={})=>{
    if((A.CFG.DEMO_MODE||!A.CFG.API_BASE)&&action==='registrarResultado')return saveDemo({jogo:params.jogo,...decode(params.vencedorId)});
    return baseRequest(action,params);
  };
})();