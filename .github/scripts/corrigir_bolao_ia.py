from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

versao_antiga = "<!-- V062_RODADA_ATUAL_PROXIMOS_INSTANTANEOS_2026-07-18 -->"
versao_nova = "<!-- V063_TABELAS_CENTRALIZADAS_2026-07-18 -->"

if versao_antiga in text:
    text = text.replace(versao_antiga, versao_nova, 1)
elif versao_nova not in text:
    raise SystemExit("Marcador da versão do bolao.html não localizado.")

css = """  /* V063 - dados sempre centralizados abaixo dos cabeçalhos */
  .info-table th,.info-table td{text-align:center}
"""

if css.strip() not in text:
    if "</style>" not in text:
        raise SystemExit("Fechamento do bloco CSS não localizado.")
    text = text.replace("</style>", css + "\n</style>", 1)

if text.count("function totalRodadasCamp") != 1:
    raise SystemExit("A função totalRodadasCamp está duplicada ou ausente.")
if text.count("function rodadaEstimadaPeloProgresso") != 1:
    raise SystemExit("A função rodadaEstimadaPeloProgresso está duplicada ou ausente.")
if text.count(".info-table th,.info-table td{text-align:center}") != 1:
    raise SystemExit("A regra de centralização não foi aplicada corretamente.")

if text == original:
    print("As tabelas já estão centralizadas.")
else:
    path.write_text(text, encoding="utf-8")
    print("Cabeçalhos e dados das tabelas centralizados.")
