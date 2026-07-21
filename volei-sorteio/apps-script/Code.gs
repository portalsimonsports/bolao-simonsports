/** SORTEIO DE DUPLAS DE VÔLEI — V003_ADULTOS_CRIANCAS_INSCRICAO_2026-07-21 */
const VOLEI=Object.freeze({
 VERSION:'V003_ADULTOS_CRIANCAS_INSCRICAO_2026-07-21',SPREADSHEET_ID:'1lg0HKljL93wD5riajKbCYcShzKYW0qAVYkPTwjerVAo',TIMEZONE:'America/Sao_Paulo',
 SHEETS:Object.freeze({CONFIG:'CONFIG',JOGADORES:'JOGADORES',EQUIPES:'EQUIPES',CHAVEAMENTO:'CHAVEAMENTO',SORTEIOS:'SORTEIOS',LOG:'LOG'}),
 HEADERS:Object.freeze({
  JOGADORES:['ID','NOME','DATA_NASCIMENTO','IDADE','POTE','CATEGORIA','NOTA_DESEMPENHO','NOTA_AJUSTADA','ATIVO','DATA_CADASTRO','OBSERVAÇÃO'],
  EQUIPES:['EQUIPE_ID','ADULTO_ID','ADULTO','NOTA_ADULTO','INDICE_ADULTO','CRIANCA_ID','CRIANCA','NOTA_CRIANCA','INDICE_CRIANCA','INDICE_TOTAL','ORDEM_BALANCEAMENTO','ORDEM_CHAVEAMENTO'],
  CHAVEAMENTO:['SORTEIO_ID','JOGO','FASE','EQUIPE_1_ID','EQUIPE_1','EQUIPE_2_ID','EQUIPE_2','VENCEDOR_ID','STATUS','DATA_HORA','RODADA_INDEX','PROXIMO_JOGO','PROXIMO_SLOT'],
  SORTEIOS:['SORTEIO_ID','STATUS','CODIGO_HASH','CODIGO_FINAL','CRIADO_EM','ATIVADO_EM','INICIO_PREVISTO','REALIZADO_EM','SEED','HASH_AUDITORIA','ATIVADO_POR','MENSAGEM'],
  LOG:['DATA_HORA','EVENTO','SORTEIO_ID','ORIGEM','USUARIO','DETALHES']
 })
});
function doGet(e){const p=e&&e.parameter||{};if(p['hub.mode'])return verificarWebhookWhatsApp_(p);return executarApi_(p)}
function doPost(e){let b={};try{b=e&&e.postData&&e.postData.contents?JSON.parse(e.postData.contents):{}}catch(ignore){}try{if(b&&(b.update_id||b.callback_query||b.message))return responderWebhook_(processarWebhookTelegram_(b));if(b&&b.object==='whatsapp_business_account')return responderWebhook_(processarWebhookWhatsApp_(b));return executarApi_(Object.assign({},e&&e.parameter||{},b||{}))}catch(err){return responder_({ok:false,erro:mensagemErro_(err),versao:VOLEI.VERSION},e&&e.parameter&&e.parameter.callback)}}
function executarApi_(p){try{const a=texto_(p.acao||'estado');let d;switch(a){case'estado':d=obterEstadoPublico_();break;case'admin':exigirAdmin_(p.chave);d=obterEstadoAdmin_();break;case'inscrever':d=inscreverParticipante_(p);break;case'salvarJogador':exigirAdmin_(p.chave);d=salvarParticipante_(p,true);break;case'excluirJogador':exigirAdmin_(p.chave);d=excluirParticipante_(p.id);break;case'gerarCodigo':exigirAdmin_(p.chave);d=gerarCodigoAtivacao_();break;case'ativar':d=ativarSorteio_(p.codigo,p.origem||'SITE');break;case'cancelar':exigirAdmin_(p.chave);d=cancelarSorteio_(p.origem||'PAINEL_WEB');break;case'resetar':exigirAdmin_(p.chave);d=resetarSorteio_();break;case'enviarTelegram':exigirAdmin_(p.chave);d=enviarAtivacaoTelegram_();break;case'enviarWhatsApp':exigirAdmin_(p.chave);d=enviarAtivacaoWhatsApp_();break;case'registrarResultado':exigirAdmin_(p.chave);d=registrarResultado_(p.jogo,p.vencedorId);break;case'sortearAgora':exigirAdmin_(p.chave);d=realizarSorteioAgora_('ADMIN');break;default:throw Error('Ação inválida: '+a)}return responder_({ok:true,dados:d,versao:VOLEI.VERSION,dataHora:formatarData_(new Date())},p.callback)}catch(err){return responder_({ok:false,erro:mensagemErro_(err),versao:VOLEI.VERSION,dataHora:formatarData_(new Date())},p.callback)}}
function responder_(p,cb){const j=JSON.stringify(p);if(cb&&/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(String(cb)))return ContentService.createTextOutput(String(cb)+'('+j+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(j).setMimeType(ContentService.MimeType.JSON)}
function responderWebhook_(p){return ContentService.createTextOutput(JSON.stringify(p||{ok:true})).setMimeType(ContentService.MimeType.JSON)}
function mensagemErro_(e){return e&&e.message?e.message:String(e||'Erro desconhecido.')}
function ss_(){return SpreadsheetApp.openById(VOLEI.SPREADSHEET_ID)}
function aba_(n){const s=ss_().getSheetByName(n);if(!s)throw Error('Aba obrigatória não encontrada: '+n);return s}
function props_(){return PropertiesService.getScriptProperties()}
function lock_(){return LockService.getScriptLock()}
function texto_(v){return String(v==null?'':v).trim()}
function numero_(v){const n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0}
function formatarData_(d){return Utilities.formatDate(d||new Date(),VOLEI.TIMEZONE,'dd/MM/yyyy HH:mm:ss')}
function formatarDataNascimento_(d){return Utilities.formatDate(d,VOLEI.TIMEZONE,'yyyy-MM-dd')}
function gerarId_(p){return p+'-'+Utilities.formatDate(new Date(),VOLEI.TIMEZONE,'yyyyMMddHHmmss')+'-'+Math.floor(100+Math.random()*900)}
function obterConfig_(){const s=aba_(VOLEI.SHEETS.CONFIG),l=s.getLastRow(),c={};if(l>=5)s.getRange(5,1,l-4,2).getValues().forEach(r=>{if(r[0])c[texto_(r[0])]=r[1]});return c}
function exigirAdmin_(c){const e=props_().getProperty('ADMIN_KEY');if(!e)throw Error('ADMIN_KEY ainda não foi configurada.');if(!c||!comparacaoSegura_(String(c),e))throw Error('Chave administrativa inválida.')}
function comparacaoSegura_(a,b){const x=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,a,Utilities.Charset.UTF_8),y=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b,Utilities.Charset.UTF_8);if(x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
function hash_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('').toUpperCase()}
function hashCodigo_(c){return hash_((props_().getProperty('ACTIVATION_SALT')||'ALTERE-O-SALT')+'|'+String(c))}
function log_(e,s,o,u,d){aba_(VOLEI.SHEETS.LOG).appendRow([new Date(),e||'',s||'',o||'',u||'',d||''])}
function limparDadosAbaixoCabecalho_(n,c){const s=aba_(n),l=s.getLastRow();if(l>1)s.getRange(2,1,l-1,Math.min(c,s.getMaxColumns())).clearContent()}
function garantirEstrutura_(){Object.keys(VOLEI.HEADERS).forEach(k=>{const n=VOLEI.SHEETS[k]||k,h=VOLEI.HEADERS[k],s=aba_(n);if(s.getMaxColumns()<h.length)s.insertColumnsAfter(s.getMaxColumns(),h.length-s.getMaxColumns());s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1)});return true}
function CONFIGURAR_SISTEMA_INICIAL(){garantirEstrutura_();const p=props_();if(!p.getProperty('ADMIN_KEY'))p.setProperty('ADMIN_KEY',Utilities.getUuid().replace(/-/g,'').slice(0,20));if(!p.getProperty('ACTIVATION_SALT'))p.setProperty('ACTIVATION_SALT',Utilities.getUuid()+Utilities.getUuid());Logger.log('ADMIN_KEY: '+p.getProperty('ADMIN_KEY'));return{adminKey:p.getProperty('ADMIN_KEY'),spreadsheetId:VOLEI.SPREADSHEET_ID}}
function CONFIGURAR_WEBHOOKS(url){if(!url)throw Error('Informe a URL /exec do Web App.');const t=props_().getProperty('TELEGRAM_BOT_TOKEN');if(t)telegramApi_('setWebhook',{url:url});Logger.log('Use a mesma URL no webhook do WhatsApp Cloud API.')}
function GERAR_E_ENVIAR_TELEGRAM(){return enviarAtivacaoTelegram_()}
function GERAR_E_ENVIAR_WHATSAPP(){return enviarAtivacaoWhatsApp_()}
function REALIZAR_SORTEIO_TESTE_AGORA(){return realizarSorteioAgora_('TESTE_EDITOR')}