/** Código, contagem regressiva e realização do sorteio */
function gerarCodigoAtivacao_() {
  validarPotes_();
  const codigo=String(Math.floor(100000+Math.random()*900000)),id=gerarId_('SOR');
  aba_(VOLEI.SHEETS.SORTEIOS).appendRow([id,'AGENDADO',hashCodigo_(codigo),codigo.slice(-2),new Date(),'','','','','','ADMIN','Código gerado. Aguardando ativação.']);
  log_('CODIGO_GERADO',id,'PAINEL_WEB','ADMIN','Final **'+codigo.slice(-2));
  return {mensagem:'Código de ativação gerado.',codigo:codigo,sorteioId:id,expiraMinutos:Number(obterConfig_().ATIVACAO_EXPIRA_MINUTOS||30)};
}
function ativarSorteio_(codigo,origem) {
  codigo=String(codigo||'').replace(/\D/g,'');
  if(codigo.length!==6)throw Error('O código deve conter seis dígitos.');
  const bloqueio=lock_();bloqueio.waitLock(15000);
  try {
    const atual=ultimoSorteio_();
    if(!atual)throw Error('Nenhum sorteio foi preparado.');
    if(atual.status==='EM_CONTAGEM')return {mensagem:'O sorteio já está em contagem regressiva.',estado:obterEstadoPublicoSemVerificacao_()};
    if(atual.status!=='AGENDADO')throw Error('O sorteio atual não está aguardando ativação.');
    const cfg=obterConfig_(),criado=atual.criadoEm instanceof Date?atual.criadoEm:new Date(atual.criadoEm),expira=Number(cfg.ATIVACAO_EXPIRA_MINUTOS||30);
    if(Date.now()>criado.getTime()+expira*60000)throw Error('O código de ativação expirou.');
    if(!comparacaoSegura_(hashCodigo_(codigo),atual.codigoHash))throw Error('Código de ativação inválido.');
    const agora=new Date(),inicio=new Date(agora.getTime()+Number(cfg.DURACAO_CONTAGEM_SEGUNDOS||600)*1000);
    aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row,2,1,11).setValues([['EM_CONTAGEM',atual.codigoHash,atual.codigoFinal,atual.criadoEm,agora,inicio,'','','',origem||'SITE','Sorteio ativado. Acompanhe a contagem regressiva.']]);
    log_('SORTEIO_ATIVADO',atual.id,origem||'SITE','CODIGO','Início previsto: '+formatarData_(inicio));
    return {mensagem:'Sorteio ativado.',inicioPrevisto:inicio,estado:obterEstadoPublicoSemVerificacao_()};
  } finally { bloqueio.releaseLock(); }
}
function verificarSorteioVencido_() {
  const atual=ultimoSorteio_();
  if(!atual||atual.status!=='EM_CONTAGEM'||!atual.inicioPrevisto)return;
  const inicio=atual.inicioPrevisto instanceof Date?atual.inicioPrevisto:new Date(atual.inicioPrevisto);
  if(Date.now()<inicio.getTime())return;
  const bloqueio=lock_();if(!bloqueio.tryLock(1000))return;
  try { const novamente=ultimoSorteio_();if(novamente&&novamente.status==='EM_CONTAGEM')realizarSorteio_(novamente,'AUTOMATICO'); }
  finally { bloqueio.releaseLock(); }
}
function realizarSorteioAgora_(origem) {
  const bloqueio=lock_();bloqueio.waitLock(15000);
  try {
    let atual=ultimoSorteio_();
    if(!atual||['SORTEADO','CANCELADO'].indexOf(atual.status)>=0){
      const id=gerarId_('SOR'),agora=new Date();
      aba_(VOLEI.SHEETS.SORTEIOS).appendRow([id,'EM_CONTAGEM','','',agora,agora,agora,'','','',origem||'ADMIN','Sorteio imediato.']);
      atual=ultimoSorteio_();
    }
    return realizarSorteio_(atual,origem||'ADMIN');
  } finally { bloqueio.releaseLock(); }
}
function realizarSorteio_(sorteio,origem) {
  const equipes=formarEquipesBalanceadas_(),seed=sorteio.seed||Utilities.getUuid();
  const embaralhadas=embaralharDeterministico_(equipes,seed).map((e,i)=>Object.assign({},e,{ordemChaveamento:i+1}));
  const rounds=montarChaveamento_(embaralhadas);
  gravarEquipes_(embaralhadas);gravarChaveamento_(sorteio.id,rounds);
  const hashAuditoria=hash_(JSON.stringify({sorteioId:sorteio.id,seed:seed,equipes:embaralhadas,rounds:rounds})),agora=new Date();
  aba_(VOLEI.SHEETS.SORTEIOS).getRange(sorteio.row,2,1,11).setValues([['SORTEADO',sorteio.codigoHash,sorteio.codigoFinal,sorteio.criadoEm||agora,sorteio.ativadoEm||agora,sorteio.inicioPrevisto||agora,agora,seed,hashAuditoria,sorteio.ativadoPor||origem,'Sorteio concluído. Equipes e chaveamento revelados.']]);
  log_('SORTEIO_REALIZADO',sorteio.id,origem,'SISTEMA','Equipes: '+equipes.length+' | Hash: '+hashAuditoria);
  return {mensagem:'Sorteio realizado.',equipes:embaralhadas,rounds:rounds,hashAuditoria:hashAuditoria,seed:seed,estado:obterEstadoPublicoSemVerificacao_()};
}