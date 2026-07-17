from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V059_ESCUDOS_TODOS_TIMES_TODOS_BOLOES_2026-07-16 -->",
    "<!-- V060_RODADA_ATUAL_PROXIMOS_JOGOS_ALINHAMENTO_2026-07-17 -->",
    1,
)

# Alinhamento central das tabelas e padrão visual mandante [nome + escudo] x [escudo + visitante].
if ".jogo-confronto{" not in text:
    css = r"""
  .info-table th,.info-table td{text-align:center;vertical-align:middle}
  .info-table th:first-child,.info-table td:first-child{text-align:center}
  .team.team-home{justify-content:flex-end;text-align:right}.team.team-away{justify-content:flex-start;text-align:left}
  .jogo-confronto{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(120px,1fr);align-items:center;justify-content:center;gap:10px;min-width:360px;margin:0 auto}
  .jogo-time{display:flex;align-items:center;gap:7px;min-width:0;font-weight:900}
  .jogo-time.home{justify-content:flex-end;text-align:right}.jogo-time.away{justify-content:flex-start;text-align:left}
  .jogo-time-nome{min-width:0;line-height:1.15;white-space:normal}
  .jogo-placar{display:flex;align-items:center;justify-content:center;gap:7px;min-width:64px;font-weight:1000;white-space:nowrap}
  .jogo-placar span{color:var(--muted);font-size:12px}
  @media(max-width:720px){.jogo-confronto{grid-template-columns:minmax(96px,1fr) auto minmax(96px,1fr);min-width:300px;gap:6px}.jogo-time{gap:5px;font-size:12px}.jogo-placar{min-width:48px}}
"""
    text = text.replace("\n</style>", css + "\n</style>", 1)

# Mantém a rodada automática ao abrir um campeonato completo ou intervalo.
antigo_select = "    state.currentRodada=String(b.rodadaInicial||b.rodada||b.proximaRodada||1);"
novo_select = """    const formatoSelecionado=ctrl(b.formatoBolao||b.modoBolao||b.recorteTipo||'CAMPEONATO');
    const rodadaFixa=formatoSelecionado.includes('RODADA')&&!formatoSelecionado.includes('INTERVALO')?Number(b.rodadaInicial||b.rodada||b.rodadaFinal||0):0;
    state.currentRodada=rodadaFixa?String(rodadaFixa):'';
    state.rodadaEscolhidaAutomaticamente=!rodadaFixa;
    state.autoRodadaCamp='';"""
if antigo_select in text:
    text = text.replace(antigo_select, novo_select, 1)

# Substitui o carregamento simples de rodadas pela seleção da rodada pendente mais próxima do momento atual.
rod_inicio = text.find("  async function loadRodadas(camp){")
rod_fim = text.find("\n  function valorPlacar", rod_inicio)
if rod_inicio < 0 or rod_fim < 0:
    raise SystemExit("Bloco de carregamento de rodadas não localizado.")

novo_rodadas = r"""  function rodadaFixaDoBolao(){
    const b=state.bolao||{};
    const formato=ctrl(b.formatoBolao||b.modoBolao||b.recorteTipo||'CAMPEONATO');
    if(formato.includes('RODADA')&&!formato.includes('INTERVALO')){
      const n=Number(b.rodadaInicial||b.rodada||b.rodadaFinal||0);
      return Number.isFinite(n)&&n>0?String(Math.floor(n)):'';
    }
    return '';
  }

  function filtrarRodadasDoRecorte(nums){
    const lista=Array.from(new Set((nums||[]).map(Number).filter(n=>Number.isFinite(n)&&n>0))).sort((a,b)=>a-b);
    const b=state.bolao||{};
    const formato=ctrl(b.formatoBolao||b.modoBolao||b.recorteTipo||'CAMPEONATO');
    const ri=Number(b.rodadaInicial||b.rodada_inicio||b.rodada||0);
    const rf=Number(b.rodadaFinal||b.rodada_fim||0);
    if(formato.includes('RODADA')&&!formato.includes('INTERVALO')&&ri)return lista.filter(n=>n===ri);
    if(ri&&rf)return lista.filter(n=>n>=ri&&n<=rf);
    return lista;
  }

  function jogoPendenteParaExibicao(g,agora=Date.now()){
    if(!g||placarOficial(g))return false;
    const st=ctrl(pick(g,['status','situacao','estado','fase','gameStatus','state'],''));
    if(['FINALIZADO','ENCERRADO','FECHADO','FIM','FULL TIME','FT'].some(x=>st.includes(x)))return false;
    const d=dataDoJogo(g);
    if(!d)return true;
    return d.getTime()>=agora-(3*60*60*1000);
  }

  function estimarRodadaPorProgresso(nums){
    const permitidas=filtrarRodadasDoRecorte(nums);
    if(!permitidas.length)return 1;
    const p=progressoBolao(state.bolao||{});
    const total=Number(p?.total||0),finalizados=Number(p?.finalizados||0);
    const media=total>0?total/permitidas.length:0;
    if(media>0&&Number.isFinite(finalizados)){
      const estimada=Math.floor(finalizados/media)+1;
      return Math.max(permitidas[0],Math.min(permitidas[permitidas.length-1],estimada));
    }
    return permitidas[0];
  }

  async function escolherRodadaAutomatica(camp,nums){
    const permitidas=filtrarRodadasDoRecorte(nums);
    if(!permitidas.length)return '1';
    const estimada=estimarRodadaPorProgresso(permitidas);
    const ordenadas=permitidas.slice().sort((a,b)=>{
      const da=a-estimada,db=b-estimada;
      const ka=da>=0?da:1000+Math.abs(da);
      const kb=db>=0?db:1000+Math.abs(db);
      return ka-kb||a-b;
    });
    let primeiraComJogos='';
    const agora=Date.now();
    for(const rodada of ordenadas){
      let rows=[];
      try{rows=await buscarJogos(camp,rodada)}catch(e){rows=[]}
      if(rows.length&&!primeiraComJogos)primeiraComJogos=String(rodada);
      if(rows.some(g=>jogoPendenteParaExibicao(g,agora)))return String(rodada);
    }
    return primeiraComJogos||String(permitidas[permitidas.length-1]||1);
  }

  async function loadRodadas(camp){
    const sel=$('#selRod');
    let nums=[];
    try{
      const j=await apiGet(withAction('rodadas',`camp=${encodeURIComponent(camp)}`));
      nums=unwrapArray(j).map(x=>typeof x==='number'?x:(x.n||x.rodada||x)).filter(Boolean);
    }catch(e){nums=[]}
    if(!nums.length){const total={CUP:7,BRA:38,ENG:38,ESP:38,FRA:38,ITA:38,SUP:10}[camp]||38; nums=Array.from({length:total},(_,i)=>i+1)}
    nums=Array.from(new Set(nums.map(Number).filter(n=>Number.isFinite(n)&&n>0))).sort((a,b)=>a-b);
    if(!sel)return;
    sel.innerHTML='';
    nums.forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=`${n}ª Rodada`;sel.appendChild(o)});

    const fixa=rodadaFixaDoBolao();
    const atual=String(state.currentRodada||'');
    const existeAtual=Array.from(sel.options).some(o=>String(o.value)===atual);
    let alvo='';
    if(fixa&&Array.from(sel.options).some(o=>String(o.value)===fixa)){
      alvo=fixa;
      state.rodadaEscolhidaAutomaticamente=false;
    }else if(state.rodadaEscolhidaAutomaticamente===false&&existeAtual){
      alvo=atual;
    }else if(state.autoRodadaCamp===camp&&existeAtual){
      alvo=atual;
    }else{
      alvo=await escolherRodadaAutomatica(camp,nums);
      state.rodadaEscolhidaAutomaticamente=true;
      state.autoRodadaCamp=camp;
    }
    sel.value=Array.from(sel.options).some(o=>String(o.value)===String(alvo))?String(alvo):(sel.options[0]?.value||'1');
    state.currentRodada=String(sel.value||1);
  }

  $('#selCamp')?.addEventListener('change',async e=>{
    state.currentCamp=String(e.target.value||'CUP').toUpperCase();
    state.currentRodada='';
    state.rodadaEscolhidaAutomaticamente=true;
    state.autoRodadaCamp='';
    await loadRodadas(state.currentCamp);
    carregarJogos().catch(err=>toast('Erro: '+err.message));
  });
  $('#selRod')?.addEventListener('change',e=>{
    state.currentRodada=String(e.target.value||1);
    state.rodadaEscolhidaAutomaticamente=false;
    carregarJogos().catch(err=>toast('Erro: '+err.message));
  });"""
text = text[:rod_inicio] + novo_rodadas + text[rod_fim:]

# O carregamento automático passa a respeitar a rodada escolhida pelo algoritmo.
antigo_base = """    const rodadaBase = state.currentRodada || $('#selRod')?.value || state.bolao.rodadaInicial || state.bolao.rodada || state.bolao.proximaRodada || 1;
    if($('#selRod')){
      const alvo = String(rodadaBase);
      const existe = Array.from($('#selRod').options).some(o=>String(o.value)===alvo);
      $('#selRod').value = existe ? alvo : ($('#selRod').options[0]?.value || alvo);
    }"""
novo_base = """    if($('#selRod')){
      const selecionada=String($('#selRod').value||state.currentRodada||1);
      $('#selRod').value=selecionada;
      state.currentRodada=selecionada;
    }"""
if antigo_base in text:
    text = text.replace(antigo_base, novo_base, 1)

# Prioriza a rodada selecionada e as posteriores ao procurar os próximos jogos.
rpj_inicio = text.find("  function rodadasParaProximosJogos(camp){")
rpj_fim = text.find("\n\n  function jogoDentroDoRecorteBolao", rpj_inicio)
if rpj_inicio < 0 or rpj_fim < 0:
    raise SystemExit("Função rodadasParaProximosJogos não localizada.")
novo_rpj = r"""  function rodadasParaProximosJogos(camp){
    const opts=Array.from($('#selRod')?.options||[]).map(o=>Number(o.value)).filter(n=>Number.isFinite(n)&&n>0);
    const base=opts.length?opts:Array.from({length:({CUP:7,BRA:38,ENG:38,ESP:38,FRA:38,ITA:38,SUP:10}[camp]||38)},(_,i)=>i+1);
    const permitidas=filtrarRodadasDoRecorte(base);
    const atual=Number(state.currentRodada||$('#selRod')?.value||permitidas[0]||1);
    return permitidas.slice().sort((a,b)=>{
      const da=a-atual,db=b-atual;
      const ka=da>=0?da:1000+Math.abs(da);
      const kb=db>=0?db:1000+Math.abs(db);
      return ka-kb||a-b;
    }).map(String);
  }"""
text = text[:rpj_inicio] + novo_rpj + text[rpj_fim:]

# Busca jogos pendentes nas rodadas atuais/próximas, sem começar sempre pela primeira rodada.
pj_inicio = text.find("  async function carregarProximosJogosBolao(camp){")
pj_fim = text.find("\n\n\n  async function carregarPalpitesUsuario", pj_inicio)
if pj_inicio < 0 or pj_fim < 0:
    raise SystemExit("Função carregarProximosJogosBolao não localizada.")
novo_pj = r"""  async function carregarProximosJogosBolao(camp){
    state.proximosJogos=[];
    if(!state.bolao)return;
    const rodadas=rodadasParaProximosJogos(camp);
    const encontrados=[];
    const vistos=new Set();
    const agora=Date.now();

    for(const r of rodadas){
      let rows=[];
      try{rows=await buscarJogos(camp,r)}catch(e){rows=[]}
      for(let i=0;i<rows.length;i++){
        const g={...rows[i],id:String(rows[i].id||rows[i].id_jogo||rows[i].jogo_id||`${camp}_${r}_${i}`),__rodada:String(r),__camp:camp};
        if(vistos.has(g.id))continue;
        vistos.add(g.id);
        if(!jogoDentroDoRecorteBolao(g)||!jogoPendenteParaExibicao(g,agora))continue;
        encontrados.push(g);
      }
      if(encontrados.length>=8)break;
    }

    state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
    renderProximosResumo();
  }"""
text = text[:pj_inicio] + novo_pj + text[pj_fim:]

# Orientação dos escudos: mandante após o nome; visitante antes do nome.
times_inicio = text.find("  function teamHtml(nome,g=null,lado=''){")
times_fim = text.find("\n  function aplicarLogoCarregado", times_inicio)
if times_inicio < 0 or times_fim < 0:
    raise SystemExit("Bloco teamHtml/teamMiniHtml não localizado.")
novo_times = r"""  function teamHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-logo');
    if(lado==='home'||lado==='mandante'||lado==='casa')return `<div class="team team-home"><span class="team-title">${esc(nomePt)}</span>${logo}</div>`;
    return `<div class="team team-away">${logo}<span class="team-title">${esc(nomePt)}</span></div>`;
  }

  function teamMiniHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-mini-logo');
    if(lado==='home'||lado==='mandante'||lado==='casa')return `<span class="team-mini team-home"><span>${esc(nomePt)}</span>${logo}</span>`;
    return `<span class="team-mini team-away">${logo}<span>${esc(nomePt)}</span></span>`;
  }

  function confrontoTabelaHtml(home,away,g,of=null){
    const homeNome=translateTeam(home),awayNome=translateTeam(away);
    const homeLogo=logoSpanHtml(home,logoUrlByTeam(home,g,'home'),'team-mini-logo');
    const awayLogo=logoSpanHtml(away,logoUrlByTeam(away,g,'away'),'team-mini-logo');
    const placar=of?`${esc(of.gm)}<span>x</span>${esc(of.gv)}`:'<span>x</span>';
    return `<div class="jogo-confronto"><span class="jogo-time home"><span class="jogo-time-nome">${esc(homeNome)}</span>${homeLogo}</span><span class="jogo-placar">${placar}</span><span class="jogo-time away">${awayLogo}<span class="jogo-time-nome">${esc(awayNome)}</span></span></div>`;
  }"""
text = text[:times_inicio] + novo_times + text[times_fim:]

text = text.replace(
    "${teamMiniHtml(home,g,'home')} <span class=\"team-versus\">x</span> ${teamMiniHtml(away,g,'away')}",
    "${confrontoTabelaHtml(home,away,g,null)}",
)
text = text.replace(
    "${teamMiniHtml(home,g,'home')} ${of?of.gm:'--'} x ${of?of.gv:'--'} ${teamMiniHtml(away,g,'away')}",
    "${confrontoTabelaHtml(home,away,g,of)}",
)

# Mostra a rodada no resumo de próximos jogos e mantém o confronto centralizado.
rpr_inicio = text.find("  function renderProximosResumo(){")
rpr_fim = text.find("\n  async function carregarParticipantes", rpr_inicio)
if rpr_inicio < 0 or rpr_fim < 0:
    raise SystemExit("Função renderProximosResumo não localizada.")
novo_render = r"""  function renderProximosResumo(){
    const box=$('#proxJogosResumo');if(!box)return;
    const rows=ordenarJogosRodada(state.proximosJogos||[]).slice(0,6);
    if(!rows.length){box.innerHTML='<div class="empty compact">Nenhum jogo futuro publicado para este bolão no momento.</div>';return}
    box.innerHTML=`<div class="resumo-jogos">${rows.map(g=>{
      const home=pick(g,['mandante','home','time_mandante','casa'],'Mandante');
      const away=pick(g,['visitante','away','time_visitante','fora'],'Visitante');
      const d=dataDoJogo(g),st=statusJogo(g),rod=String(g.__rodada||g.rodada||state.currentRodada||'');
      const statusTxt=st==='AO VIVO'?'Ao vivo':'Aberto';
      const statusCls=st==='AO VIVO'?'live':'open';
      const dataTxt=d?dataHoraLabel(d):'Data a confirmar';
      return `<article class="resumo-jogo"><div class="resumo-jogo-top"><div class="resumo-data">${esc(rod?`${rod}ª Rodada • ${dataTxt}`:dataTxt)}</div><span class="resumo-status ${statusCls}">${esc(statusTxt)}</span></div><div class="resumo-jogo-main">${resumoTeamHtml(home,'',g)}<div class="resumo-placar"><span>x</span></div>${resumoTeamHtml(away,'right',g)}</div></article>`;
    }).join('')}</div>`;
  }"""
text = text[:rpr_inicio] + novo_render + text[rpr_fim:]

if text == original:
    print("bolao.html já contém a rodada automática e o novo alinhamento.")
else:
    path.write_text(text, encoding="utf-8")
    print("Rodada automática, próximos jogos e alinhamento aplicados ao bolao.html.")