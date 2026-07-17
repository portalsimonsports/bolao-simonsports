from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V058_PONTUACAO_COM_PESO_POR_RODADA_2026-07-16 -->",
    "<!-- V059_ESCUDOS_TODOS_TIMES_TODOS_BOLOES_2026-07-16 -->",
    1,
)

# Preserva a correção anterior da pontuação ponderada caso o arquivo-base ainda não a possua.
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

# Estilos dos escudos nas diferentes áreas do painel.
if ".team-mini-logo" not in text:
    css_logos = """
  .team-logo img,.resumo-logo img,.team-mini-logo img{width:100%;height:100%;object-fit:contain;display:block}
  .team-mini{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;font-weight:850;white-space:nowrap}
  .team-mini-logo{width:24px;height:24px;min-width:24px;border-radius:50%;display:inline-grid;place-items:center;overflow:hidden;background:#f8fafc;border:1px solid rgba(148,163,184,.35);font-size:8px;font-weight:950;color:#334155}
  .team-versus{display:inline-block;margin:0 4px;color:var(--muted);font-weight:950}
"""
    text = text.replace("\n</style>", css_logos + "\n</style>", 1)

# Substitui o resolvedor antigo, que conhecia somente bandeiras de seleções.
logo_inicio = text.find("  function flagUrlByTeam(nome){")
logo_fim = text.find("\n  function formatRegressiva", logo_inicio)
if logo_inicio < 0 or logo_fim < 0:
    raise SystemExit("Bloco de logos dos times não localizado.")

novo_logo = r"""  function flagUrlByTeam(nome){
    const key = norm(nome);
    const code = TEAM_FLAG_CODES[key];
    return code ? `https://flagcdn.com/w80/${code}.png` : '';
  }

  const TEAM_LOGO_STORAGE_KEY='PSS_TEAM_LOGOS_V2';
  const TEAM_LOGO_SEARCH_ALIASES={
    'athletico pr':'Athletico Paranaense','athletico-pr':'Athletico Paranaense','atletico pr':'Athletico Paranaense',
    'atletico mineiro':'Atletico Mineiro','atletico mg':'Atletico Mineiro','gremio':'Gremio',
    'sao paulo':'Sao Paulo','vasco da gama':'Vasco da Gama','red bull bragantino':'Red Bull Bragantino',
    'bragantino':'Red Bull Bragantino','internacional':'Internacional','corinthians':'Corinthians',
    'paris sg':'Paris Saint-Germain','psg':'Paris Saint-Germain','inter de milao':'Inter Milan',
    'internazionale':'Inter Milan','manchester city':'Manchester City','manchester united':'Manchester United'
  };
  let teamLogoCache={};
  try{teamLogoCache=JSON.parse(localStorage.getItem(TEAM_LOGO_STORAGE_KEY)||'{}')||{}}catch(e){teamLogoCache={}}
  const teamLogoQueue=[];
  const teamLogoPending=new Map();
  let teamLogoQueueRunning=false;

  function normalizarLogoUrl(valor){
    if(!valor)return '';
    if(typeof valor==='object'){
      for(const k of ['url','src','logo','escudo','badge','crest','imagem','image','foto','photo','strBadge']){
        const u=normalizarLogoUrl(valor[k]); if(u)return u;
      }
      return '';
    }
    let url=String(valor).trim();
    if(!url)return '';
    if(url.startsWith('//'))url='https:'+url;
    if(/^https?:\/\//i.test(url)||/^data:image\//i.test(url))return url;
    return '';
  }

  function logoEmObjeto(obj,chaves){
    if(!obj||typeof obj!=='object')return '';
    for(const chave of chaves){
      const url=normalizarLogoUrl(obj[chave]);
      if(url)return url;
    }
    return '';
  }

  function logoNoJogo(g,lado,nome){
    if(!g||typeof g!=='object')return '';
    const casa=lado==='home'||lado==='mandante'||lado==='casa';
    const chaves=casa?[
      'logoMandante','escudoMandante','imagemMandante','fotoMandante','mandanteLogo','mandanteEscudo','mandanteImagem',
      'logo_mandante','escudo_mandante','imagem_mandante','foto_mandante','time_mandante_logo','timeMandanteLogo',
      'homeLogo','homeBadge','homeCrest','homeImage','home_logo','home_badge','home_crest','home_image',
      'logoCasa','escudoCasa','logo_casa','escudo_casa','logo1','escudo1','strHomeTeamBadge'
    ]:[
      'logoVisitante','escudoVisitante','imagemVisitante','fotoVisitante','visitanteLogo','visitanteEscudo','visitanteImagem',
      'logo_visitante','escudo_visitante','imagem_visitante','foto_visitante','time_visitante_logo','timeVisitanteLogo',
      'awayLogo','awayBadge','awayCrest','awayImage','away_logo','away_badge','away_crest','away_image',
      'logoFora','escudoFora','logo_fora','escudo_fora','logo2','escudo2','strAwayTeamBadge'
    ];
    const direto=logoEmObjeto(g,chaves);
    if(direto)return direto;

    const objetos=casa?[
      g.mandanteObj,g.mandanteDados,g.timeMandante,g.time_mandante_obj,g.homeTeam,g.home_team,g.casaObj,g.casa
    ]:[
      g.visitanteObj,g.visitanteDados,g.timeVisitante,g.time_visitante_obj,g.awayTeam,g.away_team,g.foraObj,g.fora
    ];
    for(const obj of objetos){
      const url=logoEmObjeto(obj,['logo','escudo','badge','crest','imagem','image','foto','photo','strBadge','teamBadge']);
      if(url)return url;
    }

    const nomeOriginal=String(nome||'').trim();
    const nomeNorm=norm(nomeOriginal);
    for(const mapa of [g.logos,g.escudos,g.badges,g.crests,g.teamLogos,g.imagensTimes,g.timesLogos]){
      if(!mapa||typeof mapa!=='object')continue;
      const url=normalizarLogoUrl(mapa[nomeOriginal]||mapa[nomeNorm]||mapa[casa?'mandante':'visitante']||mapa[casa?'home':'away']);
      if(url)return url;
    }
    return '';
  }

  function salvarTeamLogoCache(chave,url){
    teamLogoCache[chave]=url||'';
    try{localStorage.setItem(TEAM_LOGO_STORAGE_KEY,JSON.stringify(teamLogoCache))}catch(e){}
  }

  function logoCacheDoTime(nome){
    const chave=norm(nome);
    return Object.prototype.hasOwnProperty.call(teamLogoCache,chave)?teamLogoCache[chave]:null;
  }

  async function buscarLogoTimeExterno(nome){
    const chave=norm(nome);
    const consulta=TEAM_LOGO_SEARCH_ALIASES[chave]||String(nome||'').trim();
    if(!consulta)return '';
    try{
      const resp=await fetch(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(consulta)}`,{cache:'force-cache'});
      if(!resp.ok)throw new Error('HTTP '+resp.status);
      const dados=await resp.json();
      const times=Array.isArray(dados?.teams)?dados.teams:[];
      const futebol=times.filter(t=>/soccer|football/i.test(String(t?.strSport||'')));
      const candidatos=futebol.length?futebol:times;
      const alvo=norm(consulta),original=norm(nome);
      const escolhido=candidatos.find(t=>norm(t?.strTeam)===alvo||norm(t?.strTeam)===original)||candidatos[0];
      return normalizarLogoUrl(escolhido?.strBadge||escolhido?.strTeamBadge||escolhido?.strLogo||'');
    }catch(e){
      console.warn('Logo externo de '+nome+':',e.message||e);
      return '';
    }
  }

  function processarFilaTeamLogo(){
    if(teamLogoQueueRunning)return;
    teamLogoQueueRunning=true;
    (async()=>{
      while(teamLogoQueue.length){
        const item=teamLogoQueue.shift();
        const chave=norm(item.nome);
        let url='';
        try{url=await buscarLogoTimeExterno(item.nome)}catch(e){}
        salvarTeamLogoCache(chave,url);
        item.resolve(url);
        teamLogoPending.delete(chave);
        if(teamLogoQueue.length)await new Promise(r=>setTimeout(r,2100));
      }
      teamLogoQueueRunning=false;
    })();
  }

  function solicitarLogoTime(nome){
    const chave=norm(nome);
    const salvo=logoCacheDoTime(nome);
    if(salvo!==null)return Promise.resolve(salvo);
    if(teamLogoPending.has(chave))return teamLogoPending.get(chave);
    const promessa=new Promise(resolve=>teamLogoQueue.push({nome,resolve}));
    teamLogoPending.set(chave,promessa);
    processarFilaTeamLogo();
    return promessa;
  }

  function logoUrlByTeam(nome,g=null,lado=''){
    return logoNoJogo(g,lado,nome)||logoCacheDoTime(nome)||flagUrlByTeam(nome)||'';
  }

  function iniciaisTime(nome){
    const nomePt=translateTeam(nome);
    return nomePt.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'⚽';
  }

  function logoSpanHtml(nome,url,classe){
    const nomePt=translateTeam(nome),iniciais=iniciaisTime(nome);
    if(url)return `<span class="${classe}"><img src="${esc(url)}" alt="Escudo do ${esc(nomePt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.textContent='${esc(iniciais)}'"></span>`;
    return `<span class="${classe}" data-team-logo="${esc(nome)}" data-initials="${esc(iniciais)}">${esc(iniciais)}</span>`;
  }

  function teamHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-logo');
    return `<div class="team">${logo}<span class="team-title">${esc(nomePt)}</span></div>`;
  }

  function teamMiniHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-mini-logo');
    return `<span class="team-mini">${logo}<span>${esc(nomePt)}</span></span>`;
  }

  function aplicarLogoCarregado(el,url){
    if(!el)return;
    const iniciais=el.dataset.initials||'⚽';
    el.dataset.logoState='done';
    if(!url){el.textContent=iniciais;return}
    const img=document.createElement('img');
    img.src=url;
    img.alt='Escudo do '+(el.dataset.teamLogo||'time');
    img.loading='lazy';
    img.referrerPolicy='no-referrer';
    img.onerror=()=>{img.remove();el.textContent=iniciais};
    el.textContent='';
    el.appendChild(img);
  }

  function hidratarLogosTimes(root=document){
    const elementos=Array.from(root.querySelectorAll?.('[data-team-logo]:not([data-logo-state])')||[]);
    const grupos=new Map();
    elementos.forEach(el=>{
      const nome=el.dataset.teamLogo||'';
      const chave=norm(nome);
      if(!chave)return;
      el.dataset.logoState='loading';
      if(!grupos.has(chave))grupos.set(chave,{nome,els:[]});
      grupos.get(chave).els.push(el);
    });
    grupos.forEach(grupo=>{
      const salvo=logoCacheDoTime(grupo.nome);
      if(salvo!==null){grupo.els.forEach(el=>aplicarLogoCarregado(el,salvo));return}
      solicitarLogoTime(grupo.nome).then(url=>grupo.els.forEach(el=>aplicarLogoCarregado(el,url)));
    });
  }

  function iniciarObservadorLogos(){
    if(window.__PSS_LOGO_OBSERVER__)return;
    const observer=new MutationObserver(()=>hidratarLogosTimes(document));
    observer.observe(document.body,{childList:true,subtree:true});
    window.__PSS_LOGO_OBSERVER__=observer;
    hidratarLogosTimes(document);
  }
  setTimeout(iniciarObservadorLogos,0);
"""

text = text[:logo_inicio] + novo_logo + text[logo_fim:]

# Atualiza o resumo dos próximos jogos para também receber o objeto completo do jogo.
resumo_inicio = text.find("  function resumoTeamHtml(")
resumo_fim = text.find("\n\n  function rodadasParaProximosJogos", resumo_inicio)
if resumo_inicio < 0 or resumo_fim < 0:
    raise SystemExit("Função resumoTeamHtml não localizada.")

novo_resumo_time = r"""  function resumoTeamHtml(nome,lado='',g=null){
    const nomePt=translateTeam(nome);
    const ladoLogo=lado==='right'?'away':'home';
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,ladoLogo),'resumo-logo');
    return lado==='right'
      ?`<div class="resumo-time right">${logo}<span class="resumo-nome">${esc(nomePt)}</span></div>`
      :`<div class="resumo-time home"><span class="resumo-nome">${esc(nomePt)}</span>${logo}</div>`;
  }"""
text = text[:resumo_inicio] + novo_resumo_time + text[resumo_fim:]

# Passa o jogo e o lado do time aos componentes de escudo.
text = text.replace("${teamHtml(home)}", "${teamHtml(home,g,'home')}")
text = text.replace("${teamHtml(away)}", "${teamHtml(away,g,'away')}")
text = text.replace("${resumoTeamHtml(home)}", "${resumoTeamHtml(home,'',g)}")
text = text.replace("${resumoTeamHtml(away,'right')}", "${resumoTeamHtml(away,'right',g)}")

# Exibe escudos também nas tabelas de palpites liberados.
text = text.replace(
    "${esc(translateTeam(home))} x ${esc(translateTeam(away))}",
    "${teamMiniHtml(home,g,'home')} <span class=\"team-versus\">x</span> ${teamMiniHtml(away,g,'away')}",
)
text = text.replace(
    "${esc(translateTeam(home))} ${of?of.gm:'--'} x ${of?of.gv:'--'} ${esc(translateTeam(away))}",
    "${teamMiniHtml(home,g,'home')} ${of?of.gm:'--'} x ${of?of.gv:'--'} ${teamMiniHtml(away,g,'away')}",
)

if text == original:
    print("bolao.html já contém os escudos dos times.")
else:
    path.write_text(text, encoding="utf-8")
    print("Escudos dos times aplicados ao bolao.html.")
