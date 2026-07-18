from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

versao_base = "<!-- V064_PROGRESSO_REAL_COPA_2026-07-18 -->"
versao_nova = "<!-- V065_RANKING_DESTAQUE_LEGIVEL_2026-07-18 -->"

if versao_nova not in text:
    if versao_base not in text:
        raise SystemExit("Marcador da versão-base do bolao.html não localizado.")
    text = text.replace(versao_base, versao_base + "\n" + versao_nova, 1)

css = """  /* V065 - ranking em destaque mais legível */
  .ranking-resumo-list{display:grid;gap:8px;width:100%}
  .ranking-resumo-item{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#fff}
  .ranking-resumo-pos{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;background:#e0f2fe;color:#075985;font-size:12px;font-weight:1000}
  .ranking-resumo-nome{min-width:0;font-size:13px;font-weight:950;color:var(--ink);line-height:1.25;white-space:normal;overflow-wrap:anywhere}
  .ranking-resumo-pontos{font-size:12px;color:#334155;white-space:nowrap}
  @media(max-width:660px){.ranking-resumo-item{grid-template-columns:28px minmax(0,1fr);gap:8px}.ranking-resumo-pontos{grid-column:2;justify-self:start;margin-top:-4px}}
"""

if ".ranking-resumo-list{" not in text:
    if "</style>" not in text:
        raise SystemExit("Fechamento do bloco CSS não localizado.")
    text = text.replace("</style>", css + "\n</style>", 1)

linha_antiga = "    const res=$('#rankingResumo'); if(res)res.innerHTML=rows.slice(0,5).map((r,i)=>`<div class=\"muted\"><strong>${i+1}. ${esc(r.nome)}</strong> — ${r.pontos} pts</div>`).join('')||'O ranking será calculado quando houver jogos com resultado.';"
linha_nova = "    const res=$('#rankingResumo'); if(res)res.innerHTML=rows.length?`<div class=\"ranking-resumo-list\">${rows.slice(0,5).map((r,i)=>`<div class=\"ranking-resumo-item\"><span class=\"ranking-resumo-pos\">${i+1}</span><span class=\"ranking-resumo-nome\">${esc(r.nome)}</span><strong class=\"ranking-resumo-pontos\">${r.pontos} pts</strong></div>`).join('')}</div>`:'O ranking será calculado quando houver jogos com resultado.';"

if linha_antiga in text:
    text = text.replace(linha_antiga, linha_nova, 1)
elif linha_nova not in text:
    raise SystemExit("Renderização do ranking em destaque não localizada.")

if text.count("function progressoBolao") != 1:
    raise SystemExit("A função progressoBolao está duplicada ou ausente.")
if versao_base not in text or versao_nova not in text:
    raise SystemExit("Os marcadores V064/V065 não foram preservados.")
if text.count("ranking-resumo-list") < 2:
    raise SystemExit("O ranking em destaque não foi atualizado corretamente.")
if ".info-table th,.info-table td{text-align:center}" not in text:
    raise SystemExit("A centralização das tabelas foi perdida.")

if text == original:
    print("O ranking em destaque já está ajustado.")
else:
    path.write_text(text, encoding="utf-8")
    print("Nomes e pontuação do ranking em destaque ajustados.")
