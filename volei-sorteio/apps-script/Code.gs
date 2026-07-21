/**
 * SORTEIO DE DUPLAS DE VÔLEI — PORTAL SIMONSPORTS
 * Backend Google Apps Script / Google Sheets
 * Versão: V001_SORTEIO_VOLEI_2026-07-21
 */

const VOLEI = Object.freeze({
  VERSION: 'V001_SORTEIO_VOLEI_2026-07-21',
  SPREADSHEET_ID: '1lg0HKljL93wD5riajKbCYcShzKYW0qAVYkPTwjerVAo',
  TIMEZONE: 'America/Sao_Paulo',
  SHEETS: Object.freeze({
    CONFIG: 'CONFIG', JOGADORES: 'JOGADORES', EQUIPES: 'EQUIPES',
    CHAVEAMENTO: 'CHAVEAMENTO', SORTEIOS: 'SORTEIOS', LOG: 'LOG'
  }),
  HEADERS: Object.freeze({
    JOGADORES: ['ID','NOME','POTE','PESO','ATIVO','DATA_CADASTRO','OBSERVAÇÃO'],
    EQUIPES: ['EQUIPE_ID','JOGADOR_A_ID','JOGADOR_A','PESO_A','JOGADOR_B_ID','JOGADOR_B','PESO_B','PESO_TOTAL','ORDEM_BALANCEAMENTO','ORDEM_CHAVEAMENTO'],
    CHAVEAMENTO: ['SORTEIO_ID','JOGO','FASE','EQUIPE_1_ID','EQUIPE_1','EQUIPE_2_ID','EQUIPE_2','VENCEDOR_ID','STATUS','DATA_HORA','RODADA_INDEX','PROXIMO_JOGO','PROXIMO_SLOT'],
    SORTEIOS: ['SORTEIO_ID','STATUS','CODIGO_HASH','CODIGO_FINAL','CRIADO_EM','ATIVADO_EM','INICIO_PREVISTO','REALIZADO_EM','SEED','HASH_AUDITORIA','ATIVADO_POR','MENSAGEM'],
    LOG: ['DATA_HORA','EVENTO','SORTEIO_ID','ORIGEM','USUARIO','DETALHES']
  })
});

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p['hub.mode']) return verificarWebhookWhatsApp_(p);
  return executarApi_(p);
}

function doPost(e) {
  let body = {};
  try { body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; } catch (err) { body = {}; }
  try {
    if (body && (body.update_id || body.callback_query || body.message)) return responderWebhook_(processarWebhookTelegram_(body));
    if (body && body.object === 'whatsapp_business_account') return responderWebhook_(processarWebhookWhatsApp_(body));
    return executarApi_(Object.assign({}, (e && e.parameter) || {}, body || {}));
  } catch (err) {
    return responder_({ ok: false, erro: mensagemErro_(err), versao: VOLEI.VERSION }, ((e && e.parameter) || {}).callback);
  }
}

function executarApi_(p) {
  try {
    const acao = String(p.acao || 'estado').trim();
    let dados;
    switch (acao) {
      case 'estado': dados = obterEstadoPublico_(); break;
      case 'admin': exigirAdmin_(p.chave); dados = obterEstadoAdmin_(); break;
      case 'salvarJogador': exigirAdmin_(p.chave); dados = salvarJogador_(p); break;
      case 'excluirJogador': exigirAdmin_(p.chave); dados = excluirJogador_(p.id); break;
      case 'gerarCodigo': exigirAdmin_(p.chave); dados = gerarCodigoAtivacao_(); break;
      case 'ativar': dados = ativarSorteio_(p.codigo, p.origem || 'SITE'); break;
      case 'cancelar': exigirAdmin_(p.chave); dados = cancelarSorteio_(p.origem || 'PAINEL_WEB'); break;
      case 'resetar': exigirAdmin_(p.chave); dados = resetarSorteio_(); break;
      case 'enviarTelegram': exigirAdmin_(p.chave); dados = enviarAtivacaoTelegram_(); break;
      case 'enviarWhatsApp': exigirAdmin_(p.chave); dados = enviarAtivacaoWhatsApp_(); break;
      case 'registrarResultado': exigirAdmin_(p.chave); dados = registrarResultado_(p.jogo, p.vencedorId); break;
      case 'sortearAgora': exigirAdmin_(p.chave); dados = realizarSorteioAgora_('ADMIN'); break;
      default: throw new Error('Ação inválida: ' + acao);
    }
    return responder_({ ok: true, dados: dados, versao: VOLEI.VERSION, dataHora: formatarData_(new Date()) }, p.callback);
  } catch (err) {
    return responder_({ ok: false, erro: mensagemErro_(err), versao: VOLEI.VERSION, dataHora: formatarData_(new Date()) }, p.callback);
  }
}

function responder_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(String(callback))) {
    return ContentService.createTextOutput(String(callback) + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function responderWebhook_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload || { ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function mensagemErro_(err) { return err && err.message ? err.message : String(err || 'Erro desconhecido.'); }
function ss_() { return SpreadsheetApp.openById(VOLEI.SPREADSHEET_ID); }
function aba_(nome) { const sh = ss_().getSheetByName(nome); if (!sh) throw new Error('Aba obrigatória não encontrada: ' + nome); return sh; }
function props_() { return PropertiesService.getScriptProperties(); }
function lock_() { return LockService.getScriptLock(); }
function formatarData_(date) { return Utilities.formatDate(date || new Date(), VOLEI.TIMEZONE, 'dd/MM/yyyy HH:mm:ss'); }
function gerarId_(prefixo) { return prefixo + '-' + Utilities.formatDate(new Date(), VOLEI.TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(100 + Math.random() * 900); }
function numero_(v) { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
function texto_(v) { return String(v == null ? '' : v).trim(); }

function obterConfig_() {
  const sh = aba_(VOLEI.SHEETS.CONFIG); const last = sh.getLastRow(); const cfg = {};
  if (last >= 5) sh.getRange(5, 1, last - 4, 2).getValues().forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = r[1]; });
  return cfg;
}

function exigirAdmin_(chave) {
  const esperada = props_().getProperty('ADMIN_KEY');
  if (!esperada) throw new Error('ADMIN_KEY ainda não foi configurada nas Propriedades do Script.');
  if (!chave || !comparacaoSegura_(String(chave), esperada)) throw new Error('Chave administrativa inválida.');
}

function comparacaoSegura_(a, b) {
  const aa = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a, Utilities.Charset.UTF_8);
  const bb = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b, Utilities.Charset.UTF_8);
  if (aa.length !== bb.length) return false;
  let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]; return diff === 0;
}

function hash_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('').toUpperCase();
}

function hashCodigo_(codigo) {
  const salt = props_().getProperty('ACTIVATION_SALT') || 'PSS-VOLEI-ALTERE-O-SALT';
  return hash_(salt + '|' + String(codigo));
}

function log_(evento, sorteioId, origem, usuario, detalhes) {
  aba_(VOLEI.SHEETS.LOG).appendRow([new Date(), evento || '', sorteioId || '', origem || '', usuario || '', detalhes || '']);
}

function lerJogadores_() {
  const sh = aba_(VOLEI.SHEETS.JOGADORES); const last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, VOLEI.HEADERS.JOGADORES.length).getValues().filter(r => r[0] || r[1]).map(r => ({
    id: texto_(r[0]), nome: texto_(r[1]), pote: texto_(r[2]).toUpperCase(), peso: numero_(r[3]), ativo: texto_(r[4] || 'SIM').toUpperCase(), dataCadastro: r[5], observacao: texto_(r[6])
  }));
}

function salvarJogador_(p) {
  const nome = texto_(p.nome); const pote = texto_(p.pote).toUpperCase(); const peso = numero_(p.peso); const ativo = texto_(p.ativo || 'SIM').toUpperCase();
  if (!nome) throw new Error('Informe o nome do jogador.');
  if (['A','B'].indexOf(pote) < 0) throw new Error('O pote deve ser A ou B.');
  if (peso < 0) throw new Error('O peso técnico não pode ser negativo.');
  if (['SIM','NAO'].indexOf(ativo) < 0) throw new Error('O campo ATIVO deve ser SIM ou NAO.');
  const sh = aba_(VOLEI.SHEETS.JOGADORES); const id = texto_(p.id) || proximoIdJogador_(pote); const last = sh.getLastRow(); let row = 0;
  if (last >= 2) {
    const ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues().flat(); const idx = ids.indexOf(id); if (idx >= 0) row = idx + 2;
  }
  const atual = row ? sh.getRange(row, 1, 1, 7).getValues()[0] : [];
  const values = [id, nome, pote, peso, ativo, atual[5] || new Date(), texto_(p.observacao || atual[6])];
  row ? sh.getRange(row, 1, 1, 7).setValues([values]) : sh.appendRow(values);
  invalidarSorteioPorCadastro_('Jogador salvo: ' + nome);
  log_('JOGADOR_SALVO', '', 'PAINEL_WEB', 'ADMIN', id + ' | ' + nome + ' | Pote ' + pote + ' | Peso ' + peso);
  return { mensagem: 'Jogador salvo com sucesso.', jogador: { id:id, nome:nome, pote:pote, peso:peso, ativo:ativo }, estado: obterEstadoAdmin_() };
}

function excluirJogador_(id) {
  id = texto_(id); if (!id) throw new Error('ID do jogador não informado.');
  const sh = aba_(VOLEI.SHEETS.JOGADORES); const last = sh.getLastRow(); if (last < 2) throw new Error('Jogador não encontrado.');
  const ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues().flat(); const idx = ids.indexOf(id); if (idx < 0) throw new Error('Jogador não encontrado: ' + id);
  const nome = sh.getRange(idx + 2, 2).getDisplayValue(); sh.deleteRow(idx + 2); invalidarSorteioPorCadastro_('Jogador excluído: ' + nome);
  log_('JOGADOR_EXCLUIDO', '', 'PAINEL_WEB', 'ADMIN', id + ' | ' + nome);
  return { mensagem: 'Jogador excluído.', estado: obterEstadoAdmin_() };
}

function proximoIdJogador_(pote) {
  const usados = lerJogadores_().filter(p => p.pote === pote).map(p => Number((p.id.match(/(\d+)$/) || [0,0])[1]));
  return pote + '-' + ('000' + ((usados.length ? Math.max.apply(null, usados) : 0) + 1)).slice(-3);
}

function invalidarSorteioPorCadastro_(motivo) {
  limparDadosAbaixoCabecalho_(VOLEI.SHEETS.EQUIPES, VOLEI.HEADERS.EQUIPES.length);
  limparDadosAbaixoCabecalho_(VOLEI.SHEETS.CHAVEAMENTO, VOLEI.HEADERS.CHAVEAMENTO.length);
  aba_(VOLEI.SHEETS.SORTEIOS).appendRow([gerarId_('SOR'), 'RASCUNHO', '', '', new Date(), '', '', '', '', '', 'SISTEMA', motivo]);
}

function limparDadosAbaixoCabecalho_(nomeAba, colunas) {
  const sh = aba_(nomeAba); const last = sh.getLastRow(); if (last > 1) sh.getRange(2, 1, last - 1, Math.min(colunas, sh.getMaxColumns())).clearContent();
}

function validarPotes_() {
  const ativos = lerJogadores_().filter(p => p.ativo === 'SIM');
  const a = ativos.filter(p => p.pote === 'A'); const b = ativos.filter(p => p.pote === 'B');
  if (a.length !== b.length) throw new Error('Os potes precisam ter a mesma quantidade. Pote A: ' + a.length + '; Pote B: ' + b.length + '.');
  if (a.length < 2) throw new Error('Cadastre pelo menos dois jogadores ativos em cada pote.');
  return { a:a, b:b };
}

function formarEquipesBalanceadas_() {
  const potes = validarPotes_();
  const a = potes.a.sort((x,y) => y.peso - x.peso || x.nome.localeCompare(y.nome));
  const b = potes.b.sort((x,y) => x.peso - y.peso || x.nome.localeCompare(y.nome));
  return a.map((jogadorA, i) => ({
    id: 'E-' + ('000' + (i + 1)).slice(-3), jogadorAId: jogadorA.id, jogadorA: jogadorA.nome, pesoA: jogadorA.peso,
    jogadorBId: b[i].id, jogadorB: b[i].nome, pesoB: b[i].peso, pesoTotal: jogadorA.peso + b[i].peso,
    ordemBalanceamento: i + 1, ordemChaveamento: ''
  }));
}

function ultimoSorteio_() {
  const sh = aba_(VOLEI.SHEETS.SORTEIOS); const last = sh.getLastRow();
  if (last < 2) return null;
  return mapSorteio_(sh.getRange(last, 1, 1, VOLEI.HEADERS.SORTEIOS.length).getValues()[0], last);
}

function mapSorteio_(r, row) {
  return { row:row, id:texto_(r[0]), status:texto_(r[1] || 'RASCUNHO').toUpperCase(), codigoHash:texto_(r[2]), codigoFinal:texto_(r[3]), criadoEm:r[4], ativadoEm:r[5], inicioPrevisto:r[6], realizadoEm:r[7], seed:texto_(r[8]), hashAuditoria:texto_(r[9]), ativadoPor:texto_(r[10]), mensagem:texto_(r[11]) };
}

function gerarCodigoAtivacao_() {
  validarPotes_();
  const codigo = String(Math.floor(100000 + Math.random() * 900000)); const id = gerarId_('SOR');
  aba_(VOLEI.SHEETS.SORTEIOS).appendRow([id, 'AGENDADO', hashCodigo_(codigo), codigo.slice(-2), new Date(), '', '', '', '', '', 'ADMIN', 'Código de ativação gerado.']);
  log_('CODIGO_GERADO', id, 'PAINEL_WEB', 'ADMIN', 'Código final **' + codigo.slice(-2));
  return { mensagem:'Código de ativação gerado.', codigo:codigo, sorteioId:id, expiraMinutos:Number(obterConfig_().ATIVACAO_EXPIRA_MINUTOS || 30) };
}

function obterOuGerarCodigo_() {
  const atual = ultimoSorteio_();
  if (atual && atual.status === 'AGENDADO') {
    throw new Error('Já existe um código ativo terminado em ' + atual.codigoFinal + '. Gere um novo código no painel para obter os seis dígitos.');
  }
  return gerarCodigoAtivacao_();
}

function ativarSorteio_(codigo, origem) {
  codigo = String(codigo || '').replace(/\D/g, ''); if (codigo.length !== 6) throw new Error('O código deve conter seis dígitos.');
  const lock = lock_(); lock.waitLock(15000);
  try {
    const atual = ultimoSorteio_(); if (!atual) throw new Error('Nenhum sorteio foi preparado.');
    if (atual.status === 'EM_CONTAGEM') return { mensagem:'O sorteio já está em contagem regressiva.', estado:obterEstadoPublico_() };
    if (atual.status !== 'AGENDADO') throw new Error('O sorteio atual não está aguardando ativação. Status: ' + atual.status);
    const cfg = obterConfig_(); const expira = Number(cfg.ATIVACAO_EXPIRA_MINUTOS || 30); const criado = atual.criadoEm instanceof Date ? atual.criadoEm : new Date(atual.criadoEm);
    if (new Date().getTime() > criado.getTime() + expira * 60000) throw new Error('O código de ativação expirou. Gere um novo código.');
    if (!comparacaoSegura_(hashCodigo_(codigo), atual.codigoHash)) throw new Error('Código de ativação inválido.');
    const duracao = Number(cfg.DURACAO_CONTAGEM_SEGUNDOS || 600); const agora = new Date(); const inicio = new Date(agora.getTime() + duracao * 1000);
    const sh = aba_(VOLEI.SHEETS.SORTEIOS); sh.getRange(atual.row, 2, 1, 11).setValues([['EM_CONTAGEM', atual.codigoHash, atual.codigoFinal, atual.criadoEm, agora, inicio, '', '', '', origem || 'SITE', 'Sorteio ativado. Contagem regressiva iniciada.']]);
    log_('SORTEIO_ATIVADO', atual.id, origem || 'SITE', 'CODIGO', 'Início previsto: ' + formatarData_(inicio));
    return { mensagem:'Sorteio ativado. A contagem regressiva começou.', inicioPrevisto:inicio, estado:obterEstadoPublico_() };
  } finally { lock.releaseLock(); }
}

function verificarSorteioVencido_() {
  const atual = ultimoSorteio_();
  if (!atual || atual.status !== 'EM_CONTAGEM' || !atual.inicioPrevisto) return;
  const inicio = atual.inicioPrevisto instanceof Date ? atual.inicioPrevisto : new Date(atual.inicioPrevisto);
  if (new Date().getTime() < inicio.getTime()) return;
  const lock = lock_(); if (!lock.tryLock(1000)) return;
  try { const novamente = ultimoSorteio_(); if (novamente && novamente.status === 'EM_CONTAGEM') realizarSorteio_(novamente, 'AUTOMATICO'); }
  finally { lock.releaseLock(); }
}

function realizarSorteioAgora_(origem) {
  const lock = lock_(); lock.waitLock(15000);
  try {
    let atual = ultimoSorteio_();
    if (!atual || ['SORTEADO','CANCELADO'].indexOf(atual.status) >= 0) {
      gerarCodigoAtivacao_(); atual = ultimoSorteio_();
      aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row, 2).setValue('EM_CONTAGEM');
    }
    return realizarSorteio_(ultimoSorteio_(), origem || 'ADMIN');
  } finally { lock.releaseLock(); }
}

function realizarSorteio_(sorteio, origem) {
  const equipes = formarEquipesBalanceadas_(); const seed = sorteio.seed || Utilities.getUuid();
  const embaralhadas = embaralharDeterministico_(equipes, seed).map((e,i) => Object.assign({}, e, { ordemChaveamento:i + 1 }));
  const rounds = montarChaveamento_(embaralhadas);
  gravarEquipes_(embaralhadas); gravarChaveamento_(sorteio.id, rounds);
  const hashAuditoria = hash_(JSON.stringify({ sorteioId:sorteio.id, seed:seed, equipes:embaralhadas, rounds:rounds })); const agora = new Date();
  aba_(VOLEI.SHEETS.SORTEIOS).getRange(sorteio.row, 2, 1, 11).setValues([['SORTEADO', sorteio.codigoHash, sorteio.codigoFinal, sorteio.criadoEm, sorteio.ativadoEm || agora, sorteio.inicioPrevisto || agora, agora, seed, hashAuditoria, sorteio.ativadoPor || origem, 'Sorteio concluído. Equipes e chaveamento revelados.']]);
  log_('SORTEIO_REALIZADO', sorteio.id, origem, 'SISTEMA', 'Equipes: ' + equipes.length + ' | Hash: ' + hashAuditoria);
  return { mensagem:'Sorteio realizado com sucesso.', equipes:embaralhadas, rounds:rounds, hashAuditoria:hashAuditoria, seed:seed, estado:obterEstadoPublicoSemVerificacao_() };
}

function embaralharDeterministico_(lista, seed) {
  const arr = lista.slice(); let estado = parseInt(hash_(seed).slice(0, 8), 16) >>> 0;
  function rnd() { estado += 0x6D2B79F5; let t = estado; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const temp = arr[i]; arr[i] = arr[j]; arr[j] = temp; }
  return arr;
}

function proximaPotenciaDois_(n) { let p = 1; while (p < Math.max(2, n)) p *= 2; return p; }
function nomeFase_(size, round, totalRounds) { const restantes = size / Math.pow(2, round + 1); if (round === totalRounds - 1) return 'FINAL'; if (restantes === 2) return 'SEMIFINAL'; if (restantes === 4) return 'QUARTAS DE FINAL'; if (restantes === 8) return 'OITAVAS DE FINAL'; return 'RODADA ' + (round + 1); }

function montarChaveamento_(equipes) {
  const size = proximaPotenciaDois_(equipes.length); const totalRounds = Math.log(size) / Math.log(2); const slots = equipes.slice(); while (slots.length < size) slots.push(null);
  const rounds = []; let jogo = 1;
  for (let r = 0; r < totalRounds; r++) {
    const count = size / Math.pow(2, r + 1); const matches = [];
    for (let i = 0; i < count; i++) matches.push({ game:jogo++, roundIndex:r, phase:nomeFase_(size,r,totalRounds), team1:null, team2:null, team1Placeholder:'', team2Placeholder:'', winnerId:'', status:'AGUARDANDO', nextGame:0, nextSlot:0 });
    rounds.push({ index:r, name:nomeFase_(size,r,totalRounds), matches:matches });
  }
  for (let i = 0; i < rounds[0].matches.length; i++) {
    const m = rounds[0].matches[i]; m.team1 = slots[i * 2]; m.team2 = slots[i * 2 + 1];
    if (m.team1 && !m.team2) { m.winnerId = m.team1.id; m.status = 'BYE'; }
    else if (!m.team1 && m.team2) { m.winnerId = m.team2.id; m.status = 'BYE'; }
    else if (!m.team1 && !m.team2) m.status = 'VAZIO';
  }
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].matches.forEach((m, i) => { const next = rounds[r + 1].matches[Math.floor(i / 2)]; m.nextGame = next.game; m.nextSlot = i % 2 === 0 ? 1 : 2; if (m.winnerId) atribuirVencedorMemoria_(rounds, m); });
  }
  for (let r = 1; r < rounds.length; r++) rounds[r].matches.forEach((m, i) => {
    const prev1 = rounds[r - 1].matches[i * 2]; const prev2 = rounds[r - 1].matches[i * 2 + 1];
    if (!m.team1) m.team1Placeholder = 'Vencedor Jogo ' + prev1.game;
    if (!m.team2) m.team2Placeholder = 'Vencedor Jogo ' + prev2.game;
  });
  return rounds;
}

function atribuirVencedorMemoria_(rounds, match) {
  if (!match.nextGame || !match.winnerId) return;
  let next = null; for (let r = 0; r < rounds.length; r++) { next = rounds[r].matches.filter(m => m.game === match.nextGame)[0]; if (next) break; }
  if (!next) return; const team = match.team1 && match.team1.id === match.winnerId ? match.team1 : match.team2;
  if (match.nextSlot === 1) next.team1 = team; else next.team2 = team;
  if (next.team1 && !next.team2 && next.status === 'VAZIO') { next.winnerId = next.team1.id; next.status = 'BYE'; atribuirVencedorMemoria_(rounds, next); }
}

function gravarEquipes_(equipes) {
  const sh = aba_(VOLEI.SHEETS.EQUIPES); limparDadosAbaixoCabecalho_(VOLEI.SHEETS.EQUIPES, VOLEI.HEADERS.EQUIPES.length);
  if (!equipes.length) return;
  sh.getRange(2, 1, equipes.length, 10).setValues(equipes.map(e => [e.id,e.jogadorAId,e.jogadorA,e.pesoA,e.jogadorBId,e.jogadorB,e.pesoB,e.pesoTotal,e.ordemBalanceamento,e.ordemChaveamento]));
}

function gravarChaveamento_(sorteioId, rounds) {
  const sh = aba_(VOLEI.SHEETS.CHAVEAMENTO); if (sh.getMaxColumns() < 13) sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
  sh.getRange(1, 1, 1, 13).setValues([VOLEI.HEADERS.CHAVEAMENTO]); limparDadosAbaixoCabecalho_(VOLEI.SHEETS.CHAVEAMENTO, 13);
  const rows = [];
  rounds.forEach(round => round.matches.forEach(m => rows.push([
    sorteioId,m.game,m.phase,m.team1 ? m.team1.id : '',m.team1 ? nomeEquipe_(m.team1) : m.team1Placeholder,
    m.team2 ? m.team2.id : '',m.team2 ? nomeEquipe_(m.team2) : m.team2Placeholder,m.winnerId || '',m.status || 'AGUARDANDO','',
    m.roundIndex,m.nextGame || '',m.nextSlot || ''
  ])));
  if (rows.length) sh.getRange(2, 1, rows.length, 13).setValues(rows);
}

function nomeEquipe_(equipe) { return equipe ? equipe.jogadorA + ' + ' + equipe.jogadorB : ''; }

function lerEquipes_() {
  const sh = aba_(VOLEI.SHEETS.EQUIPES); const last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2,1,last-1,10).getValues().filter(r => r[0]).map(r => ({ id:texto_(r[0]), jogadorAId:texto_(r[1]), jogadorA:texto_(r[2]), pesoA:numero_(r[3]), jogadorBId:texto_(r[4]), jogadorB:texto_(r[5]), pesoB:numero_(r[6]), pesoTotal:numero_(r[7]), ordemBalanceamento:numero_(r[8]), ordemChaveamento:numero_(r[9]) }));
}

function lerRounds_() {
  const sh = aba_(VOLEI.SHEETS.CHAVEAMENTO); const last = sh.getLastRow(); if (last < 2) return [];
  const cols = Math.min(13, sh.getLastColumn()); const rows = sh.getRange(2,1,last-1,cols).getValues().filter(r => r[0]); const equipes = {}; lerEquipes_().forEach(e => equipes[e.id] = e); const groups = {};
  rows.forEach(r => {
    const roundIndex = numero_(r[10]); if (!groups[roundIndex]) groups[roundIndex] = { index:roundIndex, name:texto_(r[2]) || ('RODADA ' + (roundIndex+1)), matches:[] };
    groups[roundIndex].matches.push({ game:numero_(r[1]), roundIndex:roundIndex, phase:texto_(r[2]), team1:r[3] ? equipes[texto_(r[3])] || {id:texto_(r[3]), nome:texto_(r[4])} : null, team2:r[5] ? equipes[texto_(r[5])] || {id:texto_(r[5]), nome:texto_(r[6])} : null, team1Placeholder:!r[3] ? texto_(r[4]) : '', team2Placeholder:!r[5] ? texto_(r[6]) : '', winnerId:texto_(r[7]), status:texto_(r[8]), dataHora:r[9], nextGame:numero_(r[11]), nextSlot:numero_(r[12]) });
  });
  return Object.keys(groups).map(Number).sort((a,b)=>a-b).map(k => groups[k]);
}

function registrarResultado_(jogo, vencedorId) {
  jogo = numero_(jogo); vencedorId = texto_(vencedorId); if (!jogo || !vencedorId) throw new Error('Informe o jogo e o vencedor.');
  const sh = aba_(VOLEI.SHEETS.CHAVEAMENTO); const last = sh.getLastRow(); if (last < 2) throw new Error('Chaveamento ainda não foi criado.');
  const data = sh.getRange(2,1,last-1,13).getValues(); const idx = data.findIndex(r => numero_(r[1]) === jogo); if (idx < 0) throw new Error('Jogo não encontrado.');
  const row = data[idx]; if ([texto_(row[3]),texto_(row[5])].indexOf(vencedorId) < 0) throw new Error('O vencedor informado não pertence a este jogo.');
  sh.getRange(idx+2,8,1,3).setValues([[vencedorId,'FINALIZADO',new Date()]]);
  const nextGame = numero_(row[11]), nextSlot = numero_(row[12]);
  if (nextGame) {
    const nextIdx = data.findIndex(r => numero_(r[1]) === nextGame); const team = lerEquipes_().filter(e => e.id === vencedorId)[0];
    if (nextIdx >= 0 && team) { const col = nextSlot === 1 ? 4 : 6; sh.getRange(nextIdx+2,col,1,2).setValues([[team.id,nomeEquipe_(team)]]); }
  }
  log_('RESULTADO_REGISTRADO', texto_(row[0]), 'PAINEL_WEB', 'ADMIN', 'Jogo ' + jogo + ' | Vencedor ' + vencedorId);
  return { mensagem:'Resultado registrado.', estado:obterEstadoAdmin_() };
}

function cancelarSorteio_(origem) {
  const atual = ultimoSorteio_(); if (!atual) throw new Error('Nenhum sorteio registrado.');
  aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row,2).setValue('CANCELADO'); aba_(VOLEI.SHEETS.SORTEIOS).getRange(atual.row,12).setValue('Sorteio cancelado.');
  log_('SORTEIO_CANCELADO', atual.id, origem, 'ADMIN', 'Cancelamento manual.'); return { mensagem:'Sorteio cancelado.', estado:obterEstadoAdmin_() };
}

function resetarSorteio_() {
  limparDadosAbaixoCabecalho_(VOLEI.SHEETS.EQUIPES, 10); limparDadosAbaixoCabecalho_(VOLEI.SHEETS.CHAVEAMENTO, 13);
  const id = gerarId_('SOR'); aba_(VOLEI.SHEETS.SORTEIOS).appendRow([id,'RASCUNHO','','',new Date(),'','','','','','ADMIN','Sorteio reiniciado.']);
  log_('SORTEIO_RESETADO', id, 'PAINEL_WEB', 'ADMIN', 'Equipes e chaveamento limpos.'); return { mensagem:'Sorteio reiniciado.', estado:obterEstadoAdmin_() };
}

function obterEstadoPublico_() { verificarSorteioVencido_(); return obterEstadoPublicoSemVerificacao_(); }
function obterEstadoPublicoSemVerificacao_() {
  const cfg = obterConfig_(); const atual = ultimoSorteio_() || { status:'RASCUNHO', mensagem:'Aguardando a ativação oficial do sorteio.' };
  const equipes = atual.status === 'SORTEADO' ? lerEquipes_() : []; const rounds = atual.status === 'SORTEADO' ? lerRounds_() : [];
  return {
    versao:VOLEI.VERSION, modo:'PRODUCAO', titulo:texto_(cfg.TITULO_EVENTO || 'Sorteio de Duplas de Vôlei'), status:atual.status,
    mensagem:atual.mensagem || mensagemStatus_(atual.status), serverTime:new Date(), countdownSeconds:Number(cfg.DURACAO_CONTAGEM_SEGUNDOS || 600),
    jogadores:lerJogadores_().map(p => ({id:p.id,nome:p.nome,pote:p.pote,peso:cfg.PUBLICAR_PESOS === 'NAO' ? '' : p.peso,ativo:p.ativo})),
    equipes:equipes, rounds:rounds, inicioPrevisto:atual.inicioPrevisto || '', realizadoEm:atual.realizadoEm || '', seed:atual.seed || '', hashAuditoria:atual.hashAuditoria || '', sorteioId:atual.id || ''
  };
}
function obterEstadoAdmin_() { const estado = obterEstadoPublico_(); const atual = ultimoSorteio_(); estado.codigoAtivacao = atual && atual.codigoFinal ? '••••' + atual.codigoFinal : ''; return estado; }
function mensagemStatus_(status) { return ({ RASCUNHO:'Aguardando a ativação oficial do sorteio.', AGENDADO:'Código gerado. Aguardando o comando de ativação.', EM_CONTAGEM:'Sorteio ativado. Acompanhe a contagem regressiva.', SORTEADO:'Sorteio concluído. Equipes e chaveamento revelados.', CANCELADO:'O sorteio foi cancelado.' })[status] || status; }

function enviarAtivacaoTelegram_() {
  let gerado; try { gerado = obterOuGerarCodigo_(); } catch (err) { gerado = gerarCodigoAtivacao_(); }
  const token = props_().getProperty('TELEGRAM_BOT_TOKEN'); const cfg = obterConfig_(); const chatId = props_().getProperty('TELEGRAM_CHAT_ID') || cfg.CANAL_TELEGRAM;
  if (!token || !chatId) throw new Error('Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID nas Propriedades do Script.');
  const codigo = gerado.codigo; const texto = '🏐 <b>Sorteio de Duplas de Vôlei</b>\n\nCódigo de ativação: <code>' + codigo + '</code>\nAo ativar, começa a contagem regressiva de 10 minutos.';
  telegramApi_('sendMessage', { chat_id:chatId, text:texto, parse_mode:'HTML', reply_markup:{ inline_keyboard:[[{ text:'✅ Ativar sorteio', callback_data:'ATIVAR_' + codigo }],[{ text:'🌐 Abrir página pública', url:String(cfg.URL_SITE || 'https://bolao.portalsimonsports.com/volei-sorteio/') }]] } });
  log_('ATIVACAO_ENVIADA', gerado.sorteioId, 'TELEGRAM', 'ADMIN', 'Mensagem enviada para ' + chatId);
  return { mensagem:'Código e botão enviados ao Telegram.', codigo:codigo, sorteioId:gerado.sorteioId };
}

function telegramApi_(method, payload) {
  const token = props_().getProperty('TELEGRAM_BOT_TOKEN'); if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado.');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, { method:'post', contentType:'application/json', payload:JSON.stringify(payload), muteHttpExceptions:true });
  const json = JSON.parse(response.getContentText() || '{}'); if (!json.ok) throw new Error('Telegram: ' + (json.description || response.getContentText())); return json.result;
}

function processarWebhookTelegram_(update) {
  let codigo = ''; let origem = 'TELEGRAM'; let callbackId = '';
  if (update.callback_query) { callbackId = update.callback_query.id; const data = texto_(update.callback_query.data); if (data.indexOf('ATIVAR_') === 0) codigo = data.substring(7); }
  if (!codigo && update.message && update.message.text) { const m = String(update.message.text).match(/(?:\/ativar\s+)?(\d{6})/i); if (m) codigo = m[1]; }
  if (!codigo) return { ok:true, ignorado:true };
  try { const result = ativarSorteio_(codigo, origem); if (callbackId) telegramApi_('answerCallbackQuery',{ callback_query_id:callbackId, text:'Sorteio ativado. Contagem regressiva iniciada.', show_alert:true }); return { ok:true, result:result }; }
  catch (err) { if (callbackId) telegramApi_('answerCallbackQuery',{ callback_query_id:callbackId, text:mensagemErro_(err), show_alert:true }); return { ok:false, erro:mensagemErro_(err) }; }
}

function enviarAtivacaoWhatsApp_() {
  let gerado; try { gerado = obterOuGerarCodigo_(); } catch (err) { gerado = gerarCodigoAtivacao_(); }
  const p = props_(); const token = p.getProperty('WHATSAPP_TOKEN'); const phoneId = p.getProperty('WHATSAPP_PHONE_NUMBER_ID'); const cfg = obterConfig_(); const to = p.getProperty('WHATSAPP_TO') || cfg.WHATSAPP_DESTINO;
  if (!token || !phoneId || !to) throw new Error('Configure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_TO nas Propriedades do Script.');
  const payload = { messaging_product:'whatsapp', recipient_type:'individual', to:String(to).replace(/\D/g,''), type:'interactive', interactive:{ type:'button', body:{ text:'🏐 Sorteio de Duplas de Vôlei\nCódigo: ' + gerado.codigo + '\nAo ativar, começa a contagem regressiva de 10 minutos.' }, action:{ buttons:[{ type:'reply', reply:{ id:'ATIVAR_' + gerado.codigo, title:'Ativar sorteio' } }] } } };
  whatsappApi_(payload); log_('ATIVACAO_ENVIADA', gerado.sorteioId, 'WHATSAPP', 'ADMIN', 'Mensagem enviada para ' + to);
  return { mensagem:'Código e botão enviados ao WhatsApp.', codigo:gerado.codigo, sorteioId:gerado.sorteioId };
}

function whatsappApi_(payload) {
  const p = props_(); const token = p.getProperty('WHATSAPP_TOKEN'); const phoneId = p.getProperty('WHATSAPP_PHONE_NUMBER_ID'); const version = p.getProperty('WHATSAPP_GRAPH_VERSION') || 'v23.0';
  const response = UrlFetchApp.fetch('https://graph.facebook.com/' + version + '/' + phoneId + '/messages', { method:'post', contentType:'application/json', headers:{ Authorization:'Bearer ' + token }, payload:JSON.stringify(payload), muteHttpExceptions:true });
  const code = response.getResponseCode(); const text = response.getContentText(); if (code < 200 || code >= 300) throw new Error('WhatsApp: HTTP ' + code + ' | ' + text); return JSON.parse(text || '{}');
}

function verificarWebhookWhatsApp_(p) {
  const verify = props_().getProperty('WHATSAPP_VERIFY_TOKEN');
  if (p['hub.mode'] === 'subscribe' && p['hub.verify_token'] === verify) return ContentService.createTextOutput(p['hub.challenge'] || '');
  return ContentService.createTextOutput('Token de verificação inválido.');
}

function processarWebhookWhatsApp_(body) {
  try {
    const message = body.entry[0].changes[0].value.messages[0]; const from = texto_(message.from); const permitido = texto_(props_().getProperty('WHATSAPP_TO')).replace(/\D/g,'');
    if (permitido && from.replace(/\D/g,'') !== permitido) return { ok:false, erro:'Remetente não autorizado.' };
    let data = '';
    if (message.interactive && message.interactive.button_reply) data = texto_(message.interactive.button_reply.id);
    if (!data && message.text) data = texto_(message.text.body);
    const m = data.match(/(?:ATIVAR_|\/ativar\s*)?(\d{6})/i); if (!m) return { ok:true, ignorado:true };
    const result = ativarSorteio_(m[1], 'WHATSAPP');
    try { whatsappApi_({ messaging_product:'whatsapp', to:from, type:'text', text:{ body:'✅ Sorteio ativado. A contagem regressiva de 10 minutos começou.' } }); } catch (ignore) {}
    return { ok:true, result:result };
  } catch (err) { return { ok:false, erro:mensagemErro_(err) }; }
}

/** Execute uma vez pelo editor. Gera ADMIN_KEY e ACTIVATION_SALT, se ainda não existirem. */
function CONFIGURAR_SISTEMA_INICIAL() {
  const p = props_();
  if (!p.getProperty('ADMIN_KEY')) p.setProperty('ADMIN_KEY', Utilities.getUuid().replace(/-/g,'').slice(0,20));
  if (!p.getProperty('ACTIVATION_SALT')) p.setProperty('ACTIVATION_SALT', Utilities.getUuid() + Utilities.getUuid());
  Logger.log('ADMIN_KEY: ' + p.getProperty('ADMIN_KEY'));
  Logger.log('Planilha: https://docs.google.com/spreadsheets/d/' + VOLEI.SPREADSHEET_ID + '/edit');
  return { adminKey:p.getProperty('ADMIN_KEY'), spreadsheetId:VOLEI.SPREADSHEET_ID };
}

/** Execute depois de implantar o Web App e informe a URL /exec. */
function CONFIGURAR_WEBHOOKS(urlWebApp) {
  if (!urlWebApp) throw new Error('Informe a URL /exec do Web App.');
  const token = props_().getProperty('TELEGRAM_BOT_TOKEN');
  if (token) telegramApi_('setWebhook', { url:urlWebApp });
  Logger.log('Use a mesma URL no webhook do WhatsApp Cloud API.');
}

function GERAR_E_ENVIAR_TELEGRAM() { return enviarAtivacaoTelegram_(); }
function GERAR_E_ENVIAR_WHATSAPP() { return enviarAtivacaoWhatsApp_(); }
function REALIZAR_SORTEIO_TESTE_AGORA() { return realizarSorteioAgora_('TESTE_EDITOR'); }
