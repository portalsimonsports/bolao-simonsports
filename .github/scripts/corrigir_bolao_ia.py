from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V057_DESAFIANTE_IA_TODOS_JOGOS_PA_NO_FECHAMENTO_2026-07-16 -->",
    "<!-- V058_PONTUACAO_COM_PESO_POR_RODADA_2026-07-16 -->",
    1,
)

marcador = "  function detalhePontuacao(p,g){"
if marcador not in text and "function detalhePontuacaoBase(p,g)" not in text:
    raise SystemExit("Função detalhePontuacao não localizada.")

if "function bolaoComPeso()" not in text:
    inicio = text.find(marcador)
    fim = text.find("\n  function pontuar", inicio)
    if inicio < 0 or fim < 0:
        raise SystemExit("Bloco de pontuação não localizado.")

    novo_bloco = """  function bolaoComPeso(){
    const b=state.bolao||{};
    const modo=ctrl(b.pontuacaoModo||b.modoPontuacao||b.tipoPontuacao||b.pontuacao||'');
    return b.usaPesoRodada===true||b.comPeso===true||b.pesoPorRodada===true||modo.includes('COM PESO')||modo.includes('COM_PESO')||modo==='PESO';
  }
  function rodadaPontuacao(p,g){
    const n=Number(p?.rodada||g?.__rodada||g?.rodada||g?.numeroRodada||state.currentRodada||1);
    return Number.isFinite(n)&&n>0?Math.floor(n):1;
  }
  function pesoDaRodada(p,g){
    if(!bolaoComPeso())return 1;
    const b=state.bolao||{};
    const explicito=Number(p?.pesoRodada||g?.pesoRodada||g?.peso||g?.multiplicadorPontuacao||0);
    if(Number.isFinite(explicito)&&explicito>0)return explicito;
    const inicial=Number(b.pesoInicial??b.pesoBase??b.pesoRodadaInicial??10);
    const incremento=Number(b.incrementoPeso??b.pesoIncremento??1);
    const base=Number.isFinite(inicial)?inicial:10;
    const inc=Number.isFinite(incremento)?incremento:1;
    return Math.max(1,Math.round(base+(rodadaPontuacao(p,g)-1)*inc));
  }
  function aplicarPesoPontuacao(det,p,g){
    const peso=pesoDaRodada(p,g);
    const ptsBase=Number(det?.pts||0);
    return {...det,ptsBase,peso,comPeso:bolaoComPeso(),pts:ptsBase*peso};
  }
  function detalhePontuacaoBase(p,g){const of=placarOficial(g),gm=Number(p?.gm),gv=Number(p?.gv); if(!of||!Number.isFinite(gm)||!Number.isFinite(gv))return {pts:0,tipo:'—',label:!of?'Aguardando resultado oficial':'Informe o palpite'}; if(gm===of.gm&&gv===of.gv)return {pts:25,tipo:'PE',label:tipoAcertoLabel('PE')}; const rp=resultado(gm,gv),ro=resultado(of.gm,of.gv); if(rp==='E'&&ro!=='E')return {pts:4,tipo:'E',label:tipoAcertoLabel('E')}; if(rp!==ro)return {pts:0,tipo:'—',label:'Sem acerto'}; if(ro==='E')return {pts:15,tipo:'SG',label:tipoAcertoLabel('SG')}; const mand=ro==='M',gvp=mand?gm:gv,gvo=mand?of.gm:of.gv,gpp=mand?gv:gm,gpo=mand?of.gv:of.gm,sp=Math.abs(gm-gv),so=Math.abs(of.gm-of.gv); if(gvp===gvo)return {pts:18,tipo:'GV',label:tipoAcertoLabel('GV')}; if(sp===so)return {pts:15,tipo:'SG',label:tipoAcertoLabel('SG')}; if(gpp===gpo)return {pts:12,tipo:'GP',label:tipoAcertoLabel('GP')}; return {pts:10,tipo:'V',label:tipoAcertoLabel('V')}}
  function detalhePontuacao(p,g){return aplicarPesoPontuacao(detalhePontuacaoBase(p,g),p,g)}"""

    text = text[:inicio] + novo_bloco + text[fim:]

antigo_resumo = "    return `<span class=\"score-kind ${cls}\">${esc(det.tipo||'—')}</span>${esc(det.label||tipoAcertoLabel(det.tipo))} • ${Number(det.pts||0)} pts`;"
novo_resumo = "    return `<span class=\"score-kind ${cls}\">${esc(det.tipo||'—')}</span>${esc(det.label||tipoAcertoLabel(det.tipo))} • ${Number(det.pts||0)} pts${det.comPeso?` • ${Number(det.ptsBase||0)} base × peso ${Number(det.peso||1)}`:''}`;"
if antigo_resumo in text:
    text = text.replace(antigo_resumo, novo_resumo, 1)

text = text.replace(
    '<span class="info-pill">${det.pts} PTS</span>',
    '<span class="info-pill">${det.pts} PTS${det.comPeso?` • ${det.ptsBase}×${det.peso}`:\'\'}</span>',
)

if text == original:
    print("bolao.html já contém a pontuação ponderada.")
else:
    path.write_text(text, encoding="utf-8")
    print("Pontuação com peso aplicada ao bolao.html.")
