(() => {
  'use strict';
  if (!window.VoleiAdmin) return;
  const V=window.VoleiAdmin,A=V.A,u=V.ui,SESSION='sorteio_volei_admin_key';
  const key=()=>u.adminKey.value.trim();
  const auth=(extra={})=>({chave:key(),...extra});
  function validKey(){if(A.CFG.DEMO_MODE||!A.CFG.API_BASE)return true;if(!key()){V.toast('Informe a chave administrativa.','warn');u.adminKey.focus();return false}return true}
  async function refresh(){V.busy(u.refreshAdmin,true,'Atualizando...');try{V.render(await A.request('admin',auth()))}catch(error){V.toast(error.message,'error');V.render(A.ler())}finally{V.busy(u.refreshAdmin,false)}}
  async function run(button,action,params,success){V.busy(button,true);try{const result=await A.request(action,params);if(result.codigo){u.activationCode.textContent=result.codigo;u.activationInput.value=result.codigo}V.toast(result.mensagem||success||'Operação concluída.');await refresh();return result}catch(error){V.toast(error.message,'error')}finally{V.busy(button,false)}}
  async function savePlayer(event){event.preventDefault();if(!validKey())return;const params={id:u.playerId.value,nome:u.playerName.value,dataNascimento:u.playerBirth.value,nota:u.playerScore.value,ativo:u.playerActive.value};try{A.validar(params)}catch(error){V.toast(error.message,'warn');return}const button=u.playerForm.querySelector('button[type="submit"]');V.busy(button,true,'Salvando...');try{await A.request('salvarJogador',auth(params));V.toast('Participante salvo.');u.playerForm.reset();u.playerId.value='';u.playerActive.value='SIM';V.categoryPreview();await refresh()}catch(error){V.toast(error.message,'error')}finally{V.busy(button,false)}}
  function editPlayer(id){const player=V.getState().jogadores?.find(item=>item.id===id);if(!player)return;u.playerId.value=player.id;u.playerName.value=player.nome;u.playerBirth.value=A.dataInput(player.dataNascimento);u.playerScore.value=player.nota;u.playerActive.value=player.ativo||'SIM';V.categoryPreview();u.playerName.focus()}
  async function deletePlayer(id){if(!validKey())return;const player=V.getState().jogadores?.find(item=>item.id===id);if(player&&confirm(`Excluir ${player.nome}?`))await run(null,'excluirJogador',auth({id}),'Participante excluído.')}
  function scoreValue(card,set,side){return card.querySelector(`[data-score-set="${set}"][data-score-side="${side}"]`)?.value??''}
  async function saveScore(button){if(!validKey())return;const card=button.closest('[data-game]'),jogo=card.dataset.game,values={s1a:scoreValue(card,0,0),s1b:scoreValue(card,0,1),s2a:scoreValue(card,1,0),s2b:scoreValue(card,1,1),s3a:scoreValue(card,2,0),s3b:scoreValue(card,2,1)};try{A.validateMatchScore(values)}catch(error){V.toast(error.message,'warn');return}if(!confirm('Confirmar o placar final desta partida?'))return;const payload=['PLACAR',values.s1a,values.s1b,values.s2a,values.s2b,values.s3a,values.s3b].join('|');await run(button,'registrarResultado',auth({jogo,vencedorId:payload}),'Placar registrado.')}
  u.adminKey.value=sessionStorage.getItem(SESSION)||'';
  u.saveAdminKey.onclick=()=>{sessionStorage.setItem(SESSION,key());V.toast('Chave mantida nesta sessão.');refresh()};
  u.playerForm.onsubmit=savePlayer;
  u.playerBirth.oninput=V.categoryPreview;
  u.playerScore.oninput=V.categoryPreview;
  u.playersTableBody.onclick=event=>{const button=event.target.closest('button[data-a]');if(button)(button.dataset.a==='edit'?editPlayer(button.dataset.id):deletePlayer(button.dataset.id))};
  u.matchesAdmin.onclick=event=>{const button=event.target.closest('.save-score');if(button&&!button.disabled)saveScore(button)};
  u.refreshAdmin.onclick=refresh;
  u.generateCode.onclick=()=>validKey()&&run(u.generateCode,'gerarCodigo',auth());
  u.sendTelegram.onclick=()=>validKey()&&run(u.sendTelegram,'enviarTelegram',auth());
  u.sendWhatsApp.onclick=()=>validKey()&&run(u.sendWhatsApp,'enviarWhatsApp',auth());
  u.cancelDraw.onclick=()=>validKey()&&confirm('Cancelar o sorteio atual?')&&run(u.cancelDraw,'cancelar',auth());
  u.drawNow.onclick=()=>validKey()&&confirm('Realizar o sorteio agora?')&&run(u.drawNow,'sortearAgora',auth());
  u.resetDraw.onclick=()=>validKey()&&confirm('Reiniciar o sorteio mantendo os inscritos?')&&run(u.resetDraw,'resetar',auth());
  u.activateDraw.onclick=()=>{const code=u.activationInput.value.replace(/\D/g,'');code.length===6?run(u.activateDraw,'ativar',{codigo:code,origem:'PAINEL_WEB'}):V.toast('Informe o código de seis dígitos.','warn')};
  u.sheetLink.href=A.CFG.SHEET_URL;u.apiLabel.textContent=A.CFG.API_BASE||'Não configurada — modo demonstração';V.categoryPreview();refresh();window.addEventListener('storage',event=>{if(event.key===A.STORAGE_KEY)refresh()});setInterval(refresh,10000);
})();