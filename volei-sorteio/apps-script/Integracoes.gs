/** Rotas opcionais de Telegram e WhatsApp.
 * As credenciais e webhooks devem ser configurados diretamente no projeto Apps Script.
 */
function enviarAtivacaoTelegram_(){throw Error('A integração com Telegram ainda não foi configurada neste projeto Apps Script.');}
function enviarAtivacaoWhatsApp_(){throw Error('A integração com WhatsApp ainda não foi configurada neste projeto Apps Script.');}
function processarWebhookTelegram_(){return{ok:false,erro:'Webhook do Telegram não configurado.'};}
function processarWebhookWhatsApp_(){return{ok:false,erro:'Webhook do WhatsApp não configurado.'};}
function verificarWebhookWhatsApp_(){return ContentService.createTextOutput('Webhook do WhatsApp não configurado.');}
function CONFIGURAR_WEBHOOKS(urlWebApp){if(!urlWebApp)throw Error('Informe a URL /exec do Web App.');return{ok:true,mensagem:'URL recebida. Configure os webhooks nos respectivos serviços.',urlWebApp:urlWebApp};}