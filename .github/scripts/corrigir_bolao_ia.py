from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V060_RODADA_ATUAL_PROXIMOS_JOGOS_ALINHAMENTO_2026-07-17 -->",
    "<!-- V061_RESTAURA_LAYOUT_PROXIMOS_INSTANTANEOS_2026-07-17 -->",
    1,
)

# Remove integralmente o bloco visual acrescentado na V060, que causou largura
# excedente e deslocamento horizontal no celular.
css_v060 = r"""
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
text = text.replace(css_v060, "", 1)

# Restaura os componentes de time da V059. Mantém os escudos, sem alterar a
# largura ou o alinhamento estrutural das tabelas e do painel.
ini_times = text.find("  function teamHtml(nome,g=null,lado=''){")
fim_times = text.find("\n  function aplicarLogoCarregado", ini_times)
if ini_times < 0 or fim_times < 0:
    raise SystemExit("Bloco visual dos times não localizado.")

bloco_times = r"""  function teamHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-logo');
    return `<div class="team">${logo}<span class="team-title">${esc(nomePt)}</span></div>`;
  }

  function teamMiniHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-mini-logo');
    return `<span class="team-mini">${logo}<span>${esc(nomePt)}</span></span>`;
  }
"""
text = text[:ini_times] + bloco_times + text[fim_times:]

text = text.replace(
    "<td>${confrontoTabelaHtml(home,away,g,null)}</td>",
    "<td>${teamMiniHtml(home,g,'home')} <span class=\"team-versus\">x</span> ${teamMiniHtml(away,g,'away')}</td>",
)
text = text.replace(
    "<td>${confrontoTabelaHtml(home,away,g,of)}</td>",
    "<td>${teamMiniHtml(home,g,'home')} ${of?of.gm:'--'} x ${of?of.gv:'--'} ${teamMiniHtml(away,g,'away')}</td>",
)

# Cache compartilhado para evitar chamadas repetidas da mesma rodada.
busca_antiga = "  async function buscarJogos(camp,rodada){const j=await apiGet(withAction('jogos',`camp=${encodeURIComponent(camp)}&rodada=${encodeURIComponent(rodada)}`)); return unwrapArray(j)}"
busca_nova = r"""  const jogosRodadaCache=new Map();
  async function buscarJogos(camp,rodada,forcar=false){
    const chave=`${String(camp).toUpperCase()}|${String(rodada)}`;
    const agora=Date.now(),salvo=jogosRodadaCache.get(chave);
    if(!forcar&&salvo?.rows&&agora-salvo.ts<180000)return salvo.rows;
    if(!forcar&&salvo?.promise)return salvo.promise;
    const promise=apiGet(withAction('jogos',`camp=${encodeURIComponent(camp)}&rodada=${encodeURIComponent(rodada)}`))
      .then(j=>unwrapArray(j))
      .then(rows=>{jogosRodadaCache.set(chave,{rows,ts:Date.now()});return rows})
      .catch(e=>{jogosRodadaCache.delete(chave);throw e});
    jogosRodadaCache.set(chave,{promise,ts:agora});
    return promise;
  }"""
if busca_antiga in text:
    text = text.replace(busca_antiga, busca_nova, 1)
elif "const jogosRodadaCache=new Map()" not in text:
    raise SystemExit("Função buscarJogos não localizada.")

# A rodada é estimada imediatamente pelo progresso. Não faz dezenas de chamadas
# antes de abrir o painel.
selecao_lenta = r"""    }else{
      alvo=await escolherRodadaAutomatica(camp,nums);
      state.rodadaEscolhidaAutomaticamente=true;
      state.autoRodadaCamp=camp;
    }"""
selecao_rapida = r"""    }else{
      const estimada=estimarRodadaPorProgresso(nums);
      alvo=String(estimada||nums[0]||1);
      state.rodadaEscolhidaAutomaticamente=true;
      state.autoRodadaCamp=camp;
    }"""
text = text.replace(selecao_lenta, selecao_rapida, 1)

# Exibe imediatamente os jogos futuros da rodada já carregada e complementa
# somente com poucas rodadas seguintes, em paralelo.
ini_prox = text.find("  async function carregarProximosJogosBolao(camp){")
fim_prox = text.find("\n\n\n  async function carregarPalpitesUsuario", ini_prox)
if ini_prox < 0 or fim_prox < 0:
    raise SystemExit("Função de próximos jogos não localizada.")

prox_rapido = r"""  async function carregarProximosJogosBolao(camp){
    if(!state.bolao)return;
    const agora=Date.now(),vistos=new Set(),encontrados=[];
    const adicionar=(rows,rodada)=>{
      (rows||[]).forEach((item,i)=>{
        const g={...item,id:String(item.id||item.id_jogo||item.jogo_id||`${camp}_${rodada}_${i}`),__rodada:String(rodada),__camp:camp};
        if(vistos.has(g.id)||!jogoDentroDoRecorteBolao(g)||!jogoPendenteParaExibicao(g,agora))return;
        vistos.add(g.id);encontrados.push(g);
      });
    };

    // Resultado imediato: reaproveita a rodada que já está na tela.
    if(String(state.currentCamp||'').toUpperCase()===String(camp).toUpperCase()&&state.jogos.length){
      adicionar(state.jogos,state.currentRodada||$('#selRod')?.value||1);
      state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
      renderProximosResumo();
    }

    if(encontrados.length>=6)return;
    const rodadas=rodadasParaProximosJogos(camp)
      .filter(r=>String(r)!==String(state.currentRodada||$('#selRod')?.value||''))
      .slice(0,4);
    const resultados=await Promise.all(rodadas.map(async r=>{
      try{return {r,rows:await buscarJogos(camp,r)}}catch(e){return {r,rows:[]}}
    }));
    resultados.forEach(x=>adicionar(x.rows,x.r));
    state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
    renderProximosResumo();
  }"""
text = text[:ini_prox] + prox_rapido + text[fim_prox:]

# Assim que a rodada principal chega, o resumo deixa de mostrar "Carregando".
alvo_estado = "    state.jogos=ordenarJogosRodada(rows.map((g,i)=>({...g,id:String(g.id||g.id_jogo||g.jogo_id||`${camp}_${rodada}_${i}`),__rodada:rodada,__camp:camp})));\n    renderCatalogo(); renderBoloes();"
novo_estado = "    state.jogos=ordenarJogosRodada(rows.map((g,i)=>({...g,id:String(g.id||g.id_jogo||g.jogo_id||`${camp}_${rodada}_${i}`),__rodada:rodada,__camp:camp})));\n    state.proximosJogos=state.jogos.filter(g=>jogoDentroDoRecorteBolao(g)&&jogoPendenteParaExibicao(g)).slice(0,6);\n    renderProximosResumo();\n    renderCatalogo(); renderBoloes();"
text = text.replace(alvo_estado, novo_estado, 1)

if text == original:
    print("Nenhuma alteração necessária.")
else:
    path.write_text(text, encoding="utf-8")
    print("Layout restaurado e próximos jogos acelerados.")
