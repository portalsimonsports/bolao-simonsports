from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    "<!-- V059_ESCUDOS_TODOS_TIMES_TODOS_BOLOES_2026-07-16 -->",
    "<!-- V060_LOGOS_INTERNOS_TABELAS_2026-07-17 -->",
    1,
)

bloco_antigo = r"""  function teamMiniHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-mini-logo');
    return `<span class="team-mini">${logo}<span>${esc(nomePt)}</span></span>`;
  }"""

bloco_novo = r"""  function teamMiniHtml(nome,g=null,lado=''){
    const nomePt=translateTeam(nome);
    const logo=logoSpanHtml(nome,logoUrlByTeam(nome,g,lado),'team-mini-logo');
    const mandante=lado==='home'||lado==='mandante'||lado==='casa';
    return mandante
      ?`<span class="team-mini"><span>${esc(nomePt)}</span>${logo}</span>`
      :`<span class="team-mini">${logo}<span>${esc(nomePt)}</span></span>`;
  }"""

if bloco_antigo not in text:
    if bloco_novo in text:
        print("Logos internos já aplicados.")
    else:
        raise SystemExit("Função teamMiniHtml não localizada no formato esperado.")
else:
    text = text.replace(bloco_antigo, bloco_novo, 1)

if text == original:
    print("Nenhuma alteração necessária.")
else:
    path.write_text(text, encoding="utf-8")
    print("Logos internos aplicados somente às tabelas de confrontos.")
