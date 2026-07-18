from pathlib import Path
import re

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old in text:
        text = text.replace(old, new, 1)
        return
    if new in text:
        return
    raise SystemExit(f"Bloco não localizado: {label}")


def regex_once(pattern: str, replacement: str, label: str) -> None:
    global text
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count == 1:
        text = updated
        return
    if replacement.strip() in text:
        return
    raise SystemExit(f"Bloco não localizado por regex: {label}")


text = text.replace(
    "<!-- V061_CATALOGO_TEMPORADAS_2026_2027_2026-07-17 -->",
    "<!-- V062_RODADA_ATUAL_PROXIMOS_INSTANTANEOS_2026-07-18 -->",
    1,
)

old_set_view = "  function setView(name){$$('.view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name)); $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name)); if(name==='jogos'&&!state.jogos.length)carregarJogos().catch(e=>toast('Erro nos jogos: '+e.message)); if(name==='ranking')carregarRanking().catch(e=>toast('Erro no ranking: '+e.message)); if(name==='palpites')carregarPalpitesTodos().catch(e=>toast('Erro nos palpites: '+e.message)); if(name==='ultimos')carregarUltimosPalpites().catch(e=>toast('Erro nos últimos palpites: '+e.message)); if(name==='participantes')carregarParticipantes().catch(e=>toast('Erro nos participantes: '+e.message));}"
new_set_view = """  async function abrirJogosRodadaAtual(){
    if(!state.bolao)return;
    const camp=String(state.bolao.campeonato||state.bolao.camp||'CUP').toUpperCase();
    setSelectValue('#selCamp',camp,campInfo(camp).nome||camp);
    await loadRodadas(camp);
    await carregarJogos();
  }
  function setView(name){$$('.view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name)); $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name)); if(name==='jogos'&&!state.jogos.length)abrirJogosRodadaAtual().catch(e=>toast('Erro nos jogos: '+e.message)); if(name==='ranking')carregarRanking().catch(e=>toast('Erro no ranking: '+e.message)); if(name==='palpites')carregarPalpitesTodos().catch(e=>toast('Erro nos palpites: '+e.message)); if(name==='ultimos')carregarUltimosPalpites().catch(e=>toast('Erro nos últimos palpites: '+e.message)); if(name==='participantes')carregarParticipantes().catch(e=>toast('Erro nos participantes: '+e.message));}"""
replace_once(old_set_view, new_set_view, "setView")

replace_once(
    "$('#btnOpenGames').onclick=()=>{setView('jogos'); carregarJogos().catch(e=>toast('Erro ao carregar jogos: '+e.message));};",
    "$('#btnOpenGames').onclick=()=>setView('jogos');",
    "botão Carregar jogos",
)

replace_once(
    "    state.currentRodada=String(b.rodadaInicial||b.rodada||b.proximaRodada||1);",
    "    state.currentRodada=String(rodadaExplicitaDoBolao()||'');",
    "rodada inicial ao selecionar bolão",
)

new_load_rodadas = r"""  function totalRodadasCamp(camp){return {CUP:7,BRA:38,ENG:38,ESP:38,FRA:34,ITA:38,SUP:38}[camp]||38}
  function rodadaExplicitaDoBolao(){
    const b=state.bolao||{};
    const formato=ctrl(b.formatoBolao||b.modoBolao||b.recorteTipo||'');
    const ri=Number(b.rodadaInicial||b.rodada_inicio||b.rodada||0);
    if(formato.includes('CAMPEONATO')||formato.includes('COMPLETO'))return 0;
    if((formato.includes('RODADA')||formato.includes('INTERVALO'))&&ri>0)return ri;
    return 0;
  }
  function rodadaEstimadaPeloProgresso(camp,nums){
    const explicita=rodadaExplicitaDoBolao();
    if(explicita)return explicita;
    const totalRodadas=Math.max(1,nums.length||totalRodadasCamp(camp));
    let total=0,feitos=0;
    if(camp==='SUP'){
      const bra=campInfo('BRA')||{};
      total=Number(bra.qtd_jogos||bra.total_jogos||bra.totalJogos||380)||380;
      feitos=Number(bra.jogos_realizados||bra.jogos_finalizados||bra.realizados||bra.finalizados||0)||0;
    }else{
      const base=campInfo(camp)||{};
      const prog=progressoBolao(state.bolao||{});
      total=Number(prog.total||base.qtd_jogos||base.total_jogos||base.totalJogos||0)||0;
      feitos=Number(prog.finalizados||base.jogos_realizados||base.jogos_finalizados||base.realizados||base.finalizados||0)||0;
    }
    if(total>0){
      const media=Math.max(1,total/totalRodadas);
      let alvo=feitos>=total?totalRodadas:Math.floor(feitos/media)+1;
      alvo=Math.max(1,Math.min(totalRodadas,alvo));
      return alvo;
    }
    return 1;
  }
  async function loadRodadas(camp){
    const sel=$('#selRod');
    try{
      const j=await apiGet(withAction('rodadas',`camp=${encodeURIComponent(camp)}`));
      let nums=unwrapArray(j).map(x=>{
        const v=typeof x==='number'?x:pick(x,['n','rodada','rodada_bolao','numero','numeroRodada','rodadaNumero'],x);
        const m=String(v??'').match(/\d+/);
        return m?Number(m[0]):0;
      }).filter(n=>Number.isFinite(n)&&n>0);
      nums=Array.from(new Set(nums)).sort((a,b)=>a-b);
      if(!nums.length)nums=Array.from({length:totalRodadasCamp(camp)},(_,i)=>i+1);
      if(!sel)return;
      sel.innerHTML='';
      nums.forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=`${n}ª Rodada`;sel.appendChild(o)});
      const alvo=String(rodadaEstimadaPeloProgresso(camp,nums));
      const existe=Array.from(sel.options).some(o=>String(o.value)===alvo);
      sel.value=existe?alvo:(sel.options[0]?.value||'1');
      state.currentRodada=String(sel.value||alvo||1);
    }catch(e){
      if(sel){
        const alvo=String(rodadaEstimadaPeloProgresso(camp,Array.from({length:totalRodadasCamp(camp)},(_,i)=>i+1)));
        sel.innerHTML=`<option value="${alvo}">${alvo}ª Rodada</option>`;
        sel.value=alvo;
        state.currentRodada=alvo;
      }
    }
  }"""
regex_once(
    r"  async function loadRodadas\(camp\)\{.*?\n  \}\n  \$\('#selCamp'\)",
    new_load_rodadas + "\n  $('#selCamp')",
    "loadRodadas",
)

new_rodadas_proximos = r"""  function rodadasParaProximosJogos(camp){
    const opts=Array.from($('#selRod')?.options||[]).map(o=>String(o.value)).filter(Boolean);
    let base=opts.length?opts:Array.from({length:totalRodadasCamp(camp)},(_,i)=>String(i+1));
    const b=state.bolao||{};
    const formato=ctrl(b.formatoBolao||b.modoBolao||b.recorteTipo||'');
    const ri=Number(b.rodadaInicial||b.rodada_inicio||b.rodada||'');
    const rf=Number(b.rodadaFinal||b.rodada_fim||'');
    if(formato.includes('RODADA')&&!formato.includes('INTERVALO')&&ri)return [String(ri)];
    if(ri&&rf)base=base.filter(r=>Number(r)>=ri&&Number(r)<=rf);
    const atual=Number(state.currentRodada||$('#selRod')?.value||0);
    if(atual>0)base=base.filter(r=>Number(r)>=atual);
    return base;
  }"""
regex_once(
    r"  function rodadasParaProximosJogos\(camp\)\{.*?\n  \}",
    new_rodadas_proximos,
    "rodadasParaProximosJogos",
)

new_carregar_proximos = r"""  async function carregarProximosJogosBolao(camp){
    if(!state.bolao)return;
    const rodadas=rodadasParaProximosJogos(camp);
    const encontrados=[];
    const vistos=new Set();
    const agora=Date.now();
    const adicionar=(rows,r)=>{
      (rows||[]).forEach((row,i)=>{
        const g={...row,id:String(row.id||row.id_jogo||row.jogo_id||`${camp}_${r}_${i}`),__rodada:String(r),__camp:camp};
        if(vistos.has(g.id))return;
        vistos.add(g.id);
        if(!jogoDentroDoRecorteBolao(g))return;
        const st=statusJogo(g),d=dataDoJogo(g);
        if(st==='AO VIVO'||st==='ABERTO'||(d&&d.getTime()>=agora))encontrados.push(g);
      });
    };

    if(String(state.currentCamp||'').toUpperCase()===String(camp).toUpperCase()&&state.jogos.length){
      adicionar(state.jogos,state.currentRodada||$('#selRod')?.value||1);
      state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
      renderProximosResumo();
      if(encontrados.length>=6)return;
    }

    for(const r of rodadas){
      if(String(r)===String(state.currentRodada)&&state.jogos.length)continue;
      let rows=[];
      try{rows=await buscarJogos(camp,r)}catch(e){rows=[]}
      adicionar(rows,r);
      state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
      renderProximosResumo();
      if(encontrados.length>=8)break;
    }

    state.proximosJogos=ordenarJogosRodada(encontrados).slice(0,6);
    renderProximosResumo();
  }"""
regex_once(
    r"  async function carregarProximosJogosBolao\(camp\)\{.*?\n  \}\n\n\n  async function carregarPalpitesUsuario",
    new_carregar_proximos + "\n\n\n  async function carregarPalpitesUsuario",
    "carregarProximosJogosBolao",
)

replace_once(
    "    state.jogos=ordenarJogosRodada(rows.map((g,i)=>({...g,id:String(g.id||g.id_jogo||g.jogo_id||`${camp}_${rodada}_${i}`),__rodada:rodada,__camp:camp})));\n    renderCatalogo(); renderBoloes();",
    "    state.jogos=ordenarJogosRodada(rows.map((g,i)=>({...g,id:String(g.id||g.id_jogo||g.jogo_id||`${camp}_${rodada}_${i}`),__rodada:rodada,__camp:camp})));\n    const futurosDaRodada=state.jogos.filter(g=>{const st=statusJogo(g),d=dataDoJogo(g);return st==='AO VIVO'||st==='ABERTO'||(d&&d.getTime()>=Date.now())});\n    if(futurosDaRodada.length){state.proximosJogos=ordenarJogosRodada(futurosDaRodada).slice(0,6);renderProximosResumo();}\n    renderCatalogo(); renderBoloes();",
    "próximos jogos imediatos após carregar rodada",
)

if text == original:
    print("Nenhuma alteração necessária.")
else:
    path.write_text(text, encoding="utf-8")
    print("Rodada atual/próxima e próximos jogos instantâneos aplicados.")
