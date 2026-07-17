from pathlib import Path
import re

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V056_REGRESSIVA_MOVEL_TIPO_ACERTO_PONTUACAO_2026-07-01 -->",
    "<!-- V057_DESAFIANTE_IA_TODOS_JOGOS_PA_NO_FECHAMENTO_2026-07-16 -->",
    1,
)

# O Desafiante IA também precisa preencher jogos encerrados que ficaram sem palpite.
text = text.replace(
    "      if(statusJogo(g)==='ENCERRADO')return;\n      if(existentes.has(String(g.id)))return;",
    "      if(existentes.has(String(g.id)))return;",
    1,
)

# Mantém apenas um participante virtual oficial e remove registros antigos/duplicados.
marcador = "    if(qtd) await batch.commit().catch(e=>console.warn('palpites Desafiante IA:',e.message||e));\n  }"
substituto = """    if(qtd) await batch.commit().catch(e=>console.warn('palpites Desafiante IA:',e.message||e));

    const participantesAntigos=await bolaoRef.collection('participantes').limit(500).get().catch(()=>null);
    if(participantesAntigos&&!participantesAntigos.empty){
      const remover=[];
      participantesAntigos.docs.forEach(d=>{
        const dados=d.data()||{};
        const uid=String(dados.uid||d.id||'').toUpperCase();
        const nome=String(dados.nome||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();
        const antigo=d.id!=='DESAFIANTE_IA'&&(uid.includes('SIMON_IA')||uid.includes('PALPITE_SIMON')||nome.includes('DESAFIANTE SIMON IA'));
        if(antigo)remover.push(d);
      });
      for(let i=0;i<remover.length;i+=400){
        const limpeza=db.batch();
        remover.slice(i,i+400).forEach(d=>limpeza.delete(d.ref));
        await limpeza.commit().catch(e=>console.warn('limpeza participante IA antiga:',e.message||e));
      }
    }

    for(const uidAntigo of ['DESAFIANTE_SIMON_IA','SIMON_IA','PALPITE_SIMON_IA']){
      const antigos=await bolaoRef.collection('palpites').where('uid','==',uidAntigo).limit(500).get().catch(()=>null);
      if(antigos&&!antigos.empty){
        for(let i=0;i<antigos.docs.length;i+=400){
          const limpeza=db.batch();
          antigos.docs.slice(i,i+400).forEach(d=>limpeza.delete(d.ref));
          await limpeza.commit().catch(e=>console.warn('limpeza palpite IA antiga:',e.message||e));
        }
      }
    }
  }"""
if marcador not in text:
    raise SystemExit("Bloco do Desafiante IA não localizado.")
text = text.replace(marcador, substituto, 1)

inicio = text.find("  function applyPAIfNeeded(camp,rodada){")
fim = text.find("  function loadPA(){", inicio)
if inicio < 0 or fim < 0:
    raise SystemExit("Bloco inicial do palpite automático não localizado.")

eventos_inicio = text.find("  $('#btnPA').onclick", fim)
if eventos_inicio < 0:
    raise SystemExit("Eventos do palpite automático não localizados.")

proxima_funcao = text.find("\n  function ", eventos_inicio + 1)
if proxima_funcao < 0:
    raise SystemExit("Fim dos eventos do palpite automático não localizado.")

novo_pa = r"""  const paFechamentoTimers=new Map();

  function palpitePreenchido(p){
    return Number.isFinite(Number(p?.gm))&&Number.isFinite(Number(p?.gv));
  }

  function jogoElegivelParaPA(g){
    if(!state.pa?.perfil||!state.pa?.ts)return false;
    const inicio=dataDoJogo(g);
    if(!inicio)return false;
    return inicio.getTime()>Number(state.pa.ts);
  }

  async function gravarPANoFechamento(g,camp,rodada){
    if(!state.bolao||state.uid==='GUEST'||!jogoElegivelParaPA(g))return;
    const id=String(g.id);
    const inicio=dataDoJogo(g);
    if(!inicio||Date.now()<inicio.getTime())return;

    const doc=safeId(`${state.uid}_${camp}_${rodada}_${id}`);
    const ref=db.collection('boloes').doc(state.bolao.id).collection('palpites').doc(doc);
    const atual=await ref.get().catch(()=>null);
    if(atual?.exists&&palpitePreenchido(atual.data()))return;

    const home=pick(g,['mandante','home','time_mandante','casa'],'Mandante');
    const away=pick(g,['visitante','away','time_visitante','fora'],'Visitante');
    const gerado=gerarPalpite(home,away,state.pa.perfil,`${state.uid}_${camp}_${rodada}_${id}_${state.pa.ts}`);
    const payload={
      uid:state.uid,nome:state.nome,email:state.email,idJogo:id,camp,
      rodada:String(rodada),gm:gerado.gm,gv:gerado.gv,
      origem:`PA_${state.pa.perfil}`,automatico:true,
      paAtivadoEm:Number(state.pa.ts),
      criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(payload,{merge:false});
    state.palpites[id]=payload;
    atualizarPainelTempoReal(true).catch(console.warn);
  }

  function applyPAIfNeeded(camp,rodada){
    paFechamentoTimers.forEach(timer=>clearTimeout(timer));
    paFechamentoTimers.clear();
    if(!state.pa?.perfil||!state.pa?.ts)return;

    state.jogos.forEach(g=>{
      const id=String(g.id);
      if(!jogoElegivelParaPA(g)||palpitePreenchido(state.palpites[id]))return;
      const inicio=dataDoJogo(g);
      if(!inicio)return;
      const restante=inicio.getTime()-Date.now();

      if(restante<=0){
        gravarPANoFechamento(g,camp,rodada).catch(e=>console.warn('P.A. no fechamento:',e.message||e));
        return;
      }

      if(restante<=2147480000){
        const timer=setTimeout(()=>{
          paFechamentoTimers.delete(id);
          gravarPANoFechamento(g,camp,rodada).catch(e=>console.warn('P.A. no fechamento:',e.message||e));
        },restante+750);
        paFechamentoTimers.set(id,timer);
      }
    });
  }

  function loadPA(){
    try{
      const salvo=JSON.parse(localStorage.getItem('PSS_PA_BOLAO')||'null');
      state.pa=salvo?.perfil&&salvo?.ts?salvo:null;
    }catch(e){state.pa=null}
  }

  $('#btnPA').onclick=()=>$('#paModal').classList.add('open');
  $('#paFechar').onclick=()=>$('#paModal').classList.remove('open');
  $('#paRemover').onclick=()=>{
    state.pa=null;
    paFechamentoTimers.forEach(timer=>clearTimeout(timer));
    paFechamentoTimers.clear();
    localStorage.removeItem('PSS_PA_BOLAO');
    $('#paModal').classList.remove('open');
    toast('Palpite automático removido.');
  };
  $('#paSalvar').onclick=()=>{
    const perfil=document.querySelector('input[name="paPerfil"]:checked')?.value||'EQUILIBRADO';
    state.pa={perfil,ts:Date.now()};
    localStorage.setItem('PSS_PA_BOLAO',JSON.stringify(state.pa));
    $('#paModal').classList.remove('open');
    toast('Palpite automático ativado somente para jogos futuros: '+perfil);
    if(state.jogos.length)applyPAIfNeeded($('#selCamp').value,$('#selRod').value);
  };
"""

text = text[:inicio] + novo_pa + text[proxima_funcao:]

if text == original:
    raise SystemExit("Nenhuma alteração aplicada.")

path.write_text(text, encoding="utf-8")
print("bolao.html corrigido com sucesso")
