from pathlib import Path

API_BASE = "https://script.google.com/macros/s/AKfycbxeMQZBffga-Oezl9AW1mfuFS-HlLNOoyG6YKdHCqMuiwFSUpbI8LwEVKQOerE2lOJ-/exec"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Trecho não localizado: {label}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# admin-oficiais.html: não voltar a gravar temporadas antigas no Firestore.
# -----------------------------------------------------------------------------
admin_path = Path("admin-oficiais.html")
admin = admin_path.read_text(encoding="utf-8")
admin_original = admin
admin = admin.replace(
    "<!-- V005_ADMIN_OFICIAIS_CUP_104_JOGOS -->",
    "<!-- V006_ADMIN_OFICIAIS_TEMPORADAS_OPERACIONAIS_2026_2027 -->",
    1,
)

substituicoes_admin = [
    ("inicio:'2026-06-11',\n      fim:'2026-06-27',\n      qtdJogos:104,\n      statusCampeonato:'A iniciar'",
     "inicio:'2026-06-11',\n      fim:'2026-07-19',\n      qtdJogos:104,\n      statusCampeonato:'Em andamento'", "CUP"),
    ("inicio:'2026-02-01',\n      fim:'2026-12-01'",
     "inicio:'2026-01-28',\n      fim:'2026-12-01'", "BRA"),
    ("temporada:'2025/2026',\n      fonte:'Jogos_ENG',\n      url:'premier-league.html',\n      inicio:'2025-08-15',\n      fim:'2026-05-24',\n      qtdJogos:380,\n      statusCampeonato:'Finalizado'",
     "temporada:'2026/2027',\n      fonte:'Jogos_ENG',\n      url:'premier-league.html',\n      inicio:'2026-08-21',\n      fim:'2027-05-30',\n      qtdJogos:380,\n      statusCampeonato:'A iniciar'", "ENG"),
    ("temporada:'2025/2026',\n      fonte:'Jogos_ESP',\n      url:'campeonato-espanhol.html',\n      inicio:'2025-08-15',\n      fim:'2026-05-24',\n      qtdJogos:380,\n      statusCampeonato:'Finalizado'",
     "temporada:'2026/2027',\n      fonte:'Jogos_ESP',\n      url:'campeonato-espanhol.html',\n      inicio:'2026-08-15',\n      fim:'2027-05-29',\n      qtdJogos:380,\n      statusCampeonato:'A iniciar'", "ESP"),
    ("temporada:'2026',\n      fonte:'Jogos_ITA'",
     "temporada:'2026/2027',\n      fonte:'Jogos_ITA'", "ITA"),
    ("temporada:'2025/2026',\n      fonte:'Jogos_FRA',\n      url:'campeonato-frances.html',\n      inicio:'2025-08-15',\n      fim:'2026-05-17',\n      qtdJogos:306,\n      statusCampeonato:'Finalizado'",
     "temporada:'2026/2027',\n      fonte:'Jogos_FRA',\n      url:'campeonato-frances.html',\n      inicio:'2026-08-21',\n      fim:'2027-05-28',\n      qtdJogos:306,\n      statusCampeonato:'A iniciar'", "FRA"),
    ("temporada:'2025/2026',\n      fonte:'Jogos_SUP',\n      url:'super-bolao.html',\n      inicio:'2025-08-15',\n      fim:'2027-05-29'",
     "temporada:'2026/2027',\n      fonte:'Jogos_SUP',\n      url:'super-bolao.html',\n      inicio:'2026-01-28',\n      fim:'2027-05-30'", "SUP"),
]
for old, new, label in substituicoes_admin:
    if old in admin:
        admin = admin.replace(old, new, 1)
    elif new not in admin:
        raise SystemExit(f"Configuração {label} não localizada")

if admin != admin_original:
    admin_path.write_text(admin, encoding="utf-8")


# -----------------------------------------------------------------------------
# bolao.html: fallback não pode ressuscitar a temporada 2025/2026 se a API falhar.
# -----------------------------------------------------------------------------
bolao_path = Path("bolao.html")
bolao = bolao_path.read_text(encoding="utf-8")
bolao_original = bolao
bolao = bolao.replace(
    "<!-- V060_LOGOS_INTERNOS_TABELAS_2026-07-17 -->",
    "<!-- V061_CATALOGO_TEMPORADAS_2026_2027_2026-07-17 -->",
    1,
)
repls_bolao = {
    "{sigla:'BRA',nome:'Brasileirão',ordem:20,ativo:true,publicado:true,inicio:'2026-02-01',fim:'2026-12-01',qtd_jogos:380,logo:''}":
    "{sigla:'BRA',nome:'Brasileirão',ordem:20,ativo:true,publicado:true,inicio:'2026-01-28',fim:'2026-12-01',qtd_jogos:380,logo:''}",
    "{sigla:'ENG',nome:'Premier League',ordem:30,ativo:true,publicado:true,inicio:'2025-08-15',fim:'2026-05-24',qtd_jogos:380,logo:''}":
    "{sigla:'ENG',nome:'Premier League',ordem:30,ativo:true,publicado:true,inicio:'2026-08-21',fim:'2027-05-30',qtd_jogos:380,jogos_realizados:0,status:'A iniciar',logo:''}",
    "{sigla:'ESP',nome:'Campeonato Espanhol',ordem:40,ativo:true,publicado:true,inicio:'2025-08-15',fim:'2026-05-24',qtd_jogos:380,logo:''}":
    "{sigla:'ESP',nome:'Campeonato Espanhol',ordem:40,ativo:true,publicado:true,inicio:'2026-08-15',fim:'2027-05-29',qtd_jogos:380,jogos_realizados:0,status:'A iniciar',logo:''}",
    "{sigla:'FRA',nome:'Campeonato Francês',ordem:50,ativo:true,publicado:true,inicio:'2025-08-15',fim:'2026-05-17',qtd_jogos:306,logo:''}":
    "{sigla:'FRA',nome:'Campeonato Francês',ordem:50,ativo:true,publicado:true,inicio:'2026-08-21',fim:'2027-05-28',qtd_jogos:306,jogos_realizados:0,status:'A iniciar',logo:''}",
    "{sigla:'SUP',nome:'Super Bolão',ordem:70,ativo:true,publicado:true,inicio:'2025-08-15',fim:'2027-05-29',qtd_jogos:1826,logo:''}":
    "{sigla:'SUP',nome:'Super Bolão',ordem:70,ativo:true,publicado:true,inicio:'2026-01-28',fim:'2027-05-30',qtd_jogos:1826,logo:''}",
}
for old, new in repls_bolao.items():
    if old in bolao:
        bolao = bolao.replace(old, new, 1)
    elif new not in bolao:
        raise SystemExit("Fallback de campeonato não localizado em bolao.html")
if bolao != bolao_original:
    bolao_path.write_text(bolao, encoding="utf-8")


# -----------------------------------------------------------------------------
# publicos.html: catálogo operacional prevalece sobre snapshots antigos do
# Firestore. Isso corrige período, temporada, status e progresso sem depender de
# recriar manualmente os bolões oficiais.
# -----------------------------------------------------------------------------
publicos_path = Path("publicos.html")
publicos = publicos_path.read_text(encoding="utf-8")
publicos_original = publicos
publicos = publicos.replace(
    "<!-- V030_PUBLICOS_SEM_MENSAGEM_FONTE_LE_JOGOS_REALIZADOS_ABA_2026-06-29 -->",
    "<!-- V031_PUBLICOS_CATALOGO_OPERACIONAL_PRIORITARIO_2026-07-17 -->",
    1,
)

if "const API_BASE =" not in publicos:
    publicos = publicos.replace(
        "<script>\n  const firebaseConfig = {",
        f"<script>\n  const API_BASE = '{API_BASE}';\n  const firebaseConfig = {{",
        1,
    )

publicos = publicos.replace(
    "const state = { uid:'GUEST', nome:'Visitante', email:'', foto:'', publicos:[], filtrados:[], meusIds:new Set(), detalhe:null, pendingEnter:null, autoRefresh:null };",
    "const state = { uid:'GUEST', nome:'Visitante', email:'', foto:'', publicos:[], filtrados:[], meusIds:new Set(), detalhe:null, pendingEnter:null, autoRefresh:null, catalogoOperacional:{} };",
    1,
)

util_anchor = "  function fmt(n){ return Math.max(0,Math.round(Number(n||0))).toLocaleString('pt-BR'); }"
util_block = f"""  function withAction(action,qs=''){{return `?a=${{encodeURIComponent(action)}}&action=${{encodeURIComponent(action)}}${{qs?'&'+qs:''}}`;}}
  async function apiGet(qs){{const sep=qs.includes('?')?'&':'?';const res=await fetch(`${{API_BASE}}${{qs}}${{sep}}_=${{Date.now()}}`,{{method:'GET',credentials:'omit',redirect:'follow'}});if(!res.ok)throw new Error(`${{res.status}} ${{res.statusText}}`);return await res.json();}}
  function unwrapArray(j){{if(Array.isArray(j))return j;for(const k of ['data','dados','result','items','rows','catalogo','campeonatos']){{if(Array.isArray(j?.[k]))return j[k];}}return [];}}
  function normalizarCatalogoOperacional(raw){{
    if(!raw||typeof raw!=='object')return null;
    const code=campCode(raw.sigla||raw.camp||raw.campeonato||raw.id||raw.codigo||'');
    if(!code)return null;
    return {{...raw,sigla:code,
      inicio:raw.inicio||raw.dataInicio||raw.data_inicio||'',
      fim:raw.fim||raw.dataFim||raw.data_fim||'',
      qtd_jogos:Number(raw.qtd_jogos||raw.qtdJogos||raw.totalJogos||0)||0,
      jogos_realizados:Number(raw.jogos_realizados||raw.jogosRealizados||raw.jogosFinalizados||raw.finalizados||0)||0,
      status:raw.status||raw.statusCampeonato||raw.statusCompeticao||'',
      temporada:raw.temporada||raw.season||''}};
  }}
  async function carregarCatalogoOperacional(){{
    const dados={{}};let melhor=[];
    for(const action of ['catalog','catalogo','campeonatos']){{
      try{{const arr=unwrapArray(await apiGet(withAction(action))).map(normalizarCatalogoOperacional).filter(Boolean);if(arr.length>melhor.length)melhor=arr;if(arr.length>=7)break;}}catch(e){{console.warn('Catálogo operacional '+action+':',e.message||e);}}
    }}
    melhor.forEach(c=>dados[c.sigla]=c);
    state.catalogoOperacional=dados;
    return dados;
  }}"""
if "function carregarCatalogoOperacional()" not in publicos:
    if util_anchor not in publicos:
        raise SystemExit("Âncora das utilidades não localizada em publicos.html")
    publicos = publicos.replace(util_anchor, util_anchor + "\n" + util_block, 1)

ini = publicos.find("  function aplicarDadosCampeonatoNoBolao(b, dadosCamp){")
fim = publicos.find("\n\n  async function carregarDadosCampeonatos(){", ini)
if ini < 0 or fim < 0:
    raise SystemExit("Função aplicarDadosCampeonatoNoBolao não localizada")
novo_aplicar = r"""  function aplicarDadosCampeonatoNoBolao(b, dadosCamp){
    const code=campRaw(b);
    const c=(state.catalogoOperacional&&state.catalogoOperacional[code])||(dadosCamp&&dadosCamp[code])||null;
    if(!c)return b;
    const out={...b};
    const inicio=c.inicio||c.dataInicio||c.data_inicio;
    const fim=c.fim||c.dataFim||c.data_fim;
    const total=numBolao(c,['qtd_jogos','qtdJogos','totalJogos','jogosTotal']);
    const realizados=numBolao(c,['jogos_realizados','jogosRealizados','jogosFinalizados','finalizados']);
    const status=c.status||c.statusCampeonato||c.statusCompeticao||'';
    if(inicio){out.inicio=inicio;out.dataInicio=inicio;out.temporadaInicio=inicio;}
    if(fim){out.fim=fim;out.dataFim=fim;out.temporadaFim=fim;}
    if(total){out.qtd_jogos=total;out.qtdJogos=total;out.totalJogos=total;}
    out.jogos_realizados=realizados;out.jogosRealizados=realizados;out.jogosFinalizados=realizados;
    if(status){out.statusCampeonato=status;out.statusCompeticao=status;}
    if(c.temporada)out.temporada=c.temporada;
    return out;
  }"""
publicos = publicos[:ini] + novo_aplicar + publicos[fim:]

old_catalog_call = "      const dadosCampeonatos = await carregarDadosCampeonatos();"
new_catalog_call = "      await carregarCatalogoOperacional();\n      const dadosCampeonatos = await carregarDadosCampeonatos();"
if old_catalog_call in publicos:
    publicos = publicos.replace(old_catalog_call, new_catalog_call, 1)
elif new_catalog_call not in publicos:
    raise SystemExit("Carregamento do catálogo não localizado em publicos.html")

if publicos != publicos_original:
    publicos_path.write_text(publicos, encoding="utf-8")

print("Temporadas, fallback e catálogo operacional corrigidos.")
