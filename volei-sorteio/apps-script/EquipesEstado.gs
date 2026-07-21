/** Formação das equipes e estados públicos */
function formarEquipesBalanceadas_() {
  const potes = validarPotes_();
  const adultos = potes.a.sort((x,y)=>y.notaAjustada-x.notaAjustada||x.nome.localeCompare(y.nome));
  const criancas = potes.b.sort((x,y)=>x.notaAjustada-y.notaAjustada||x.nome.localeCompare(y.nome));
  return adultos.map((adulto,i)=>({
    id:'E-'+('000'+(i+1)).slice(-3),adultoId:adulto.id,adulto:adulto.nome,notaAdulto:adulto.nota,indiceAdulto:adulto.notaAjustada,
    criancaId:criancas[i].id,crianca:criancas[i].nome,notaCrianca:criancas[i].nota,indiceCrianca:criancas[i].notaAjustada,
    indiceTotal:adulto.notaAjustada+criancas[i].notaAjustada,ordemBalanceamento:i+1,ordemChaveamento:''
  }));
}
function ultimoSorteio_() {
  const s=aba_(VOLEI.SHEETS.SORTEIOS),l=s.getLastRow();
  if(l<2)return null;
  return mapSorteio_(s.getRange(l,1,1,VOLEI.HEADERS.SORTEIOS.length).getValues()[0],l);
}
function mapSorteio_(r,row) {
  return {row:row,id:texto_(r[0]),status:texto_(r[1]||'RASCUNHO').toUpperCase(),codigoHash:texto_(r[2]),codigoFinal:texto_(r[3]),criadoEm:r[4],ativadoEm:r[5],inicioPrevisto:r[6],realizadoEm:r[7],seed:texto_(r[8]),hashAuditoria:texto_(r[9]),ativadoPor:texto_(r[10]),mensagem:texto_(r[11])};
}
function cancelarSorteio_(origem) {
  const atual=ultimoSorteio_();
  if(!atual)throw Error('Nenhum sorteio registrado.');
  aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row,2).setValue('CANCELADO');
  aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row,12).setValue('Sorteio cancelado.');
  log_('SORTEIO_CANCELADO',atual.id,origem,'ADMIN','Cancelamento manual.');
  return {mensagem:'Sorteio cancelado.',estado:obterEstadoAdmin_()};
}
function resetarSorteio_() {
  limparDadosAbaixoCabecalho_(VOLEI.SHEETS.EQUIPES,12);
  limparDadosAbaixoCabecalho_(VOLEI.SHEETS.CHAVEAMENTO,13);
  const id=gerarId_('SOR');
  aba_(VOLEI.SHEETS.SORTEIOS).appendRow([id,'RASCUNHO','','',new Date(),'','','','','','ADMIN','Inscrições abertas.']);
  log_('SORTEIO_RESETADO',id,'PAINEL_WEB','ADMIN','Equipes e chaveamento limpos.');
  return {mensagem:'Sorteio reiniciado.',estado:obterEstadoAdmin_()};
}
function obterEstadoPublico_() {
  verificarSorteioVencido_();
  return obterEstadoPublicoSemVerificacao_();
}
function obterEstadoPublicoSemVerificacao_() {
  const c=obterConfig_(),atual=ultimoSorteio_()||{status:'RASCUNHO',mensagem:'Inscrições abertas.'};
  const equipes=atual.status==='SORTEADO'?lerEquipes_():[];
  const rounds=atual.status==='SORTEADO'?lerRounds_():[];
  return {
    versao:VOLEI.VERSION,modo:'PRODUCAO',titulo:texto_(c.TITULO_EVENTO||'Sorteio de Duplas de Vôlei'),status:atual.status,
    mensagem:atual.mensagem||mensagemStatus_(atual.status),serverTime:new Date(),countdownSeconds:Number(c.DURACAO_CONTAGEM_SEGUNDOS||600),
    jogadores:lerJogadores_().map(p=>({id:p.id,nome:p.nome,dataNascimento:p.dataNascimento,idade:p.idade,pote:p.pote,categoria:p.categoria,nota:p.nota,notaAjustada:p.notaAjustada,ativo:p.ativo})),
    equipes:equipes,rounds:rounds,inicioPrevisto:atual.inicioPrevisto||'',realizadoEm:atual.realizadoEm||'',seed:atual.seed||'',hashAuditoria:atual.hashAuditoria||'',sorteioId:atual.id||''
  };
}
function obterEstadoAdminSemVerificacao_() {
  const estado=obterEstadoPublicoSemVerificacao_(),atual=ultimoSorteio_();
  estado.codigoAtivacao=atual&&atual.codigoFinal?'••••'+atual.codigoFinal:'';
  return estado;
}
function obterEstadoAdmin_() {
  verificarSorteioVencido_();
  return obterEstadoAdminSemVerificacao_();
}
function mensagemStatus_(status) {
  return ({RASCUNHO:'Inscrições abertas.',AGENDADO:'Código gerado. Aguardando ativação.',EM_CONTAGEM:'Sorteio ativado. Acompanhe a contagem regressiva.',SORTEADO:'Sorteio concluído. Equipes e chaveamento revelados.',CANCELADO:'O sorteio foi cancelado.'})[status]||status;
}