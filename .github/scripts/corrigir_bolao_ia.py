from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

versao_antiga = "<!-- V063_TABELAS_CENTRALIZADAS_2026-07-18 -->"
versao_nova = "<!-- V064_PROGRESSO_REAL_COPA_2026-07-18 -->"

if versao_antiga in text:
    text = text.replace(versao_antiga, versao_nova, 1)
elif versao_nova not in text:
    raise SystemExit("Marcador da versão do bolao.html não localizado.")

funcao_antiga = "  function progressoBolao(b){return progressoCamp({...campInfo(b?.campeonato||b?.camp||'CUP'),...b})}"
funcao_nova = """  function progressoBolao(b){
    const camp=String(b?.campeonato||b?.camp||'CUP').toUpperCase();
    const catalogo=progressoCamp(campInfo(camp));
    const proprio=progressoCamp(b||{});
    const modo=ctrl(b?.modoBolao||b?.formatoBolao||b?.recorteTipo||'CAMPEONATO');
    const campeonatoCompleto=modo.includes('CAMPEONATO')||modo.includes('COMPLETO')||(!modo.includes('RODADA')&&!modo.includes('INTERVALO')&&!modo.includes('PERIODO')&&!modo.includes('DATA')&&!modo.includes('PERSONALIZADO'));
    if(!campeonatoCompleto)return progressoCamp({...campInfo(camp),...b});
    const total=Math.max(catalogo.total,proprio.total);
    const finalizados=Math.max(catalogo.finalizados,proprio.finalizados);
    const limitados=Math.max(0,Math.min(total||finalizados,finalizados));
    const pct=total>0?Math.round(limitados/total*100):0;
    return {total:total||limitados,finalizados:limitados,pct};
  }"""

if funcao_antiga in text:
    text = text.replace(funcao_antiga, funcao_nova, 1)
elif funcao_nova not in text:
    raise SystemExit("Função progressoBolao não localizada no formato esperado.")

if text.count("function progressoBolao") != 1:
    raise SystemExit("A função progressoBolao está duplicada ou ausente.")
if "V064_PROGRESSO_REAL_COPA" not in text:
    raise SystemExit("A versão V064 não foi aplicada.")
if ".info-table th,.info-table td{text-align:center}" not in text:
    raise SystemExit("A centralização das tabelas foi perdida.")

if text == original:
    print("O progresso real da Copa já está corrigido.")
else:
    path.write_text(text, encoding="utf-8")
    print("Progresso real do catálogo priorizado nos bolões de campeonato completo.")
