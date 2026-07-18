from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

bloco = r"""  function totalRodadasCamp(camp){return {CUP:7,BRA:38,ENG:38,ESP:38,FRA:34,ITA:38,SUP:38}[camp]||38}
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
  }
"""

inicio = text.find("  function totalRodadasCamp(camp)")
fim = text.find("  $('#selCamp')", inicio)

if inicio < 0 or fim < 0:
    raise SystemExit("Bloco de rodadas não localizado para limpeza.")

text = text[:inicio] + bloco + text[fim:]

if text.count("function totalRodadasCamp") != 1:
    raise SystemExit("A função totalRodadasCamp permaneceu duplicada.")
if text.count("function rodadaEstimadaPeloProgresso") != 1:
    raise SystemExit("A função rodadaEstimadaPeloProgresso permaneceu duplicada.")
if "V062_RODADA_ATUAL_PROXIMOS_INSTANTANEOS" not in text:
    raise SystemExit("A versão V062 não foi localizada.")

if text == original:
    print("Estrutura de rodadas já está limpa.")
else:
    path.write_text(text, encoding="utf-8")
    print("Duplicações removidas e V062 preservada.")
