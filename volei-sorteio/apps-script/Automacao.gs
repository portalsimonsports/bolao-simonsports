/**
 * SORTEIO DE DUPLAS DE VÔLEI — PORTAL SIMONSPORTS
 * Automação, acionadores e configuração assistida
 * Versão: V002_SORTEIO_VOLEI_AUTOMACAO_2026-07-21
 *
 * Este arquivo deve ser criado no MESMO projeto do Apps Script que contém Code.gs.
 */

const VOLEI_AUTOMACAO = Object.freeze({
  VERSION: 'V002_SORTEIO_VOLEI_AUTOMACAO_2026-07-21',
  TRIGGER_FUNCTION: 'VERIFICAR_SORTEIO_AUTOMATICO',
  INTERVAL_MINUTES: 1
});

/**
 * Menu exibido quando o Apps Script estiver vinculado à Planilha Google.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏐 Sorteio de Vôlei')
      .addItem('Instalar sistema completo', 'INSTALAR_SISTEMA_COMPLETO')
      .addItem('Instalar acionador automático', 'INSTALAR_ACIONADOR_SORTEIO')
      .addItem('Executar diagnóstico', 'DIAGNOSTICO_COMPLETO')
      .addSeparator()
      .addItem('Gerar e enviar pelo Telegram', 'GERAR_E_ENVIAR_TELEGRAM')
      .addItem('Gerar e enviar pelo WhatsApp', 'GERAR_E_ENVIAR_WHATSAPP')
      .addSeparator()
      .addItem('Realizar sorteio de teste agora', 'REALIZAR_SORTEIO_TESTE_AGORA')
      .addItem('Remover acionadores', 'REMOVER_ACIONADORES_SORTEIO')
      .addToUi();
  } catch (err) {
    console.log('Menu não disponível neste contexto: ' + mensagemErro_(err));
  }
}

/**
 * Execute esta função uma única vez depois de colar Code.gs e Automacao.gs.
 * Ela gera as chaves internas, valida a planilha e instala o acionador por minuto.
 */
function INSTALAR_SISTEMA_COMPLETO() {
  const configInicial = CONFIGURAR_SISTEMA_INICIAL();
  const estrutura = validarEstruturaSistema_();
  const trigger = instalarAcionadorSorteio_();

  atualizarConfigSistema_('VERSAO', VOLEI_AUTOMACAO.VERSION, 'Versão da automação instalada');
  atualizarConfigSistema_('ACIONADOR_AUTOMATICO', 'ATIVO', 'Verificação automática a cada minuto');
  atualizarConfigSistema_('ULTIMA_VERIFICACAO', formatarData_(new Date()), 'Última instalação ou verificação');

  log_(
    'SISTEMA_INSTALADO',
    '',
    'EDITOR_APPS_SCRIPT',
    Session.getEffectiveUser().getEmail() || 'ADMIN',
    JSON.stringify({ estrutura: estrutura, trigger: trigger })
  );

  const resultado = {
    ok: true,
    mensagem: 'Sistema configurado e acionador automático instalado.',
    versao: VOLEI_AUTOMACAO.VERSION,
    adminKey: configInicial.adminKey,
    spreadsheetId: configInicial.spreadsheetId,
    acionador: trigger,
    estrutura: estrutura
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/**
 * Instala ou recria o acionador que verifica o fim da contagem regressiva.
 */
function INSTALAR_ACIONADOR_SORTEIO() {
  const resultado = instalarAcionadorSorteio_();
  atualizarConfigSistema_('ACIONADOR_AUTOMATICO', 'ATIVO', 'Verificação automática a cada minuto');
  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function instalarAcionadorSorteio_() {
  removerAcionadoresPorFuncao_(VOLEI_AUTOMACAO.TRIGGER_FUNCTION);

  const trigger = ScriptApp.newTrigger(VOLEI_AUTOMACAO.TRIGGER_FUNCTION)
    .timeBased()
    .everyMinutes(VOLEI_AUTOMACAO.INTERVAL_MINUTES)
    .create();

  return {
    funcao: VOLEI_AUTOMACAO.TRIGGER_FUNCTION,
    intervaloMinutos: VOLEI_AUTOMACAO.INTERVAL_MINUTES,
    triggerId: trigger.getUniqueId()
  };
}

/**
 * Remove somente os acionadores pertencentes a este sistema.
 */
function REMOVER_ACIONADORES_SORTEIO() {
  const removidos = removerAcionadoresPorFuncao_(VOLEI_AUTOMACAO.TRIGGER_FUNCTION);
  atualizarConfigSistema_('ACIONADOR_AUTOMATICO', 'INATIVO', 'Acionador automático removido');
  return { ok: true, removidos: removidos };
}

function removerAcionadoresPorFuncao_(funcao) {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === funcao) {
      ScriptApp.deleteTrigger(trigger);
      removidos++;
    }
  });
  return removidos;
}

/**
 * Função executada pelo acionador a cada minuto.
 * O bloqueio interno do Code.gs impede sorteios duplicados.
 */
function VERIFICAR_SORTEIO_AUTOMATICO() {
  try {
    verificarSorteioVencido_();
    atualizarConfigSistema_('ULTIMA_VERIFICACAO', formatarData_(new Date()), 'Última execução do acionador');
    return { ok: true, status: (ultimoSorteio_() || {}).status || 'SEM_SORTEIO' };
  } catch (err) {
    try {
      log_('ERRO_ACIONADOR', '', 'ACIONADOR_MINUTO', 'SISTEMA', mensagemErro_(err));
    } catch (ignore) {}
    console.error(err);
    return { ok: false, erro: mensagemErro_(err) };
  }
}

/**
 * Grava as credenciais do Telegram nas Propriedades do Script.
 * Use no editor: CONFIGURAR_TELEGRAM('TOKEN_DO_BOT', '@canal_ou_chat_id')
 */
function CONFIGURAR_TELEGRAM(botToken, chatId) {
  botToken = texto_(botToken);
  chatId = texto_(chatId);
  if (!botToken || !chatId) {
    throw new Error('Informe botToken e chatId.');
  }

  props_().setProperties({
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_CHAT_ID: chatId
  }, false);

  atualizarConfigSistema_('CANAL_TELEGRAM', chatId, 'Chat ID ou @canal usado nas mensagens');
  return { ok: true, mensagem: 'Telegram configurado.', chatId: chatId };
}

/**
 * Grava as credenciais do WhatsApp Cloud API nas Propriedades do Script.
 */
function CONFIGURAR_WHATSAPP(token, phoneNumberId, destinatario, verifyToken, graphVersion) {
  token = texto_(token);
  phoneNumberId = texto_(phoneNumberId);
  destinatario = texto_(destinatario).replace(/\D/g, '');
  verifyToken = texto_(verifyToken);
  graphVersion = texto_(graphVersion || 'v23.0');

  if (!token || !phoneNumberId || !destinatario || !verifyToken) {
    throw new Error('Informe token, phoneNumberId, destinatario e verifyToken.');
  }

  props_().setProperties({
    WHATSAPP_TOKEN: token,
    WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
    WHATSAPP_TO: destinatario,
    WHATSAPP_VERIFY_TOKEN: verifyToken,
    WHATSAPP_GRAPH_VERSION: graphVersion
  }, false);

  atualizarConfigSistema_('WHATSAPP_DESTINO', destinatario, 'Número em formato internacional');
  return { ok: true, mensagem: 'WhatsApp configurado.', destinatario: destinatario, graphVersion: graphVersion };
}

/**
 * Execute após implantar o aplicativo da Web.
 * Também instala o webhook do Telegram quando o token estiver configurado.
 */
function CONFIGURAR_URL_WEB_APP(urlWebApp) {
  urlWebApp = texto_(urlWebApp);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(urlWebApp)) {
    throw new Error('Informe uma URL válida do Web App terminada em /exec.');
  }

  props_().setProperty('WEB_APP_URL', urlWebApp);
  atualizarConfigSistema_('API_WEB_APP', urlWebApp, 'URL pública /exec do Apps Script');
  CONFIGURAR_WEBHOOKS(urlWebApp);

  return {
    ok: true,
    mensagem: 'URL do Web App e webhooks configurados.',
    urlWebApp: urlWebApp
  };
}

/**
 * Diagnóstico sem alterar jogadores, equipes ou chaveamento.
 */
function DIAGNOSTICO_COMPLETO() {
  const propriedades = props_();
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === VOLEI_AUTOMACAO.TRIGGER_FUNCTION)
    .map(t => ({ id: t.getUniqueId(), funcao: t.getHandlerFunction(), origem: String(t.getTriggerSource()) }));

  const estrutura = validarEstruturaSistema_();
  const potes = (() => {
    try {
      const validos = validarPotes_();
      return { ok: true, poteA: validos.a.length, poteB: validos.b.length };
    } catch (err) {
      return { ok: false, erro: mensagemErro_(err) };
    }
  })();

  const resultado = {
    ok: estrutura.ok && !!propriedades.getProperty('ADMIN_KEY') && triggers.length > 0,
    versaoBackend: VOLEI.VERSION,
    versaoAutomacao: VOLEI_AUTOMACAO.VERSION,
    planilha: ss_().getUrl(),
    estrutura: estrutura,
    potes: potes,
    propriedades: {
      adminKey: !!propriedades.getProperty('ADMIN_KEY'),
      activationSalt: !!propriedades.getProperty('ACTIVATION_SALT'),
      webAppUrl: propriedades.getProperty('WEB_APP_URL') || '',
      telegram: !!propriedades.getProperty('TELEGRAM_BOT_TOKEN') && !!propriedades.getProperty('TELEGRAM_CHAT_ID'),
      whatsapp: !!propriedades.getProperty('WHATSAPP_TOKEN') &&
        !!propriedades.getProperty('WHATSAPP_PHONE_NUMBER_ID') &&
        !!propriedades.getProperty('WHATSAPP_TO') &&
        !!propriedades.getProperty('WHATSAPP_VERIFY_TOKEN')
    },
    acionadores: triggers,
    ultimoSorteio: ultimoSorteio_()
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  atualizarConfigSistema_('ULTIMA_VERIFICACAO', formatarData_(new Date()), 'Último diagnóstico');
  return resultado;
}

function validarEstruturaSistema_() {
  const obrigatorias = Object.keys(VOLEI.SHEETS).map(k => VOLEI.SHEETS[k]);
  const existentes = ss_().getSheets().map(sh => sh.getName());
  const faltantes = obrigatorias.filter(nome => existentes.indexOf(nome) < 0);

  const headers = {};
  Object.keys(VOLEI.HEADERS).forEach(chave => {
    const nomeAba = VOLEI.SHEETS[chave];
    const esperado = VOLEI.HEADERS[chave];
    const atual = aba_(nomeAba).getRange(1, 1, 1, esperado.length).getDisplayValues()[0];
    headers[nomeAba] = {
      ok: esperado.every((valor, i) => atual[i] === valor),
      esperado: esperado,
      atual: atual
    };
  });

  return {
    ok: faltantes.length === 0 && Object.keys(headers).every(nome => headers[nome].ok),
    abasExistentes: existentes,
    abasFaltantes: faltantes,
    cabecalhos: headers
  };
}

function atualizarConfigSistema_(chave, valor, descricao) {
  const sh = aba_(VOLEI.SHEETS.CONFIG);
  const last = Math.max(sh.getLastRow(), 4);
  const quantidade = Math.max(0, last - 4);
  let linha = 0;

  if (quantidade > 0) {
    const chaves = sh.getRange(5, 1, quantidade, 1).getDisplayValues().flat();
    const indice = chaves.indexOf(chave);
    if (indice >= 0) linha = indice + 5;
  }

  if (!linha) linha = sh.getLastRow() + 1;
  sh.getRange(linha, 1, 1, 3).setValues([[chave, valor, descricao || '']]);
}

/**
 * Atalhos para testes controlados pelo editor.
 */
function TESTAR_FORMACAO_DAS_EQUIPES() {
  const equipes = formarEquipesBalanceadas_();
  Logger.log(JSON.stringify(equipes, null, 2));
  return equipes;
}

function TESTAR_ESTADO_PUBLICO() {
  const estado = obterEstadoPublico_();
  Logger.log(JSON.stringify(estado, null, 2));
  return estado;
}
