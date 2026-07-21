(() => {
  'use strict';
  if (!window.VoleiAdmin) return;
  const V=window.VoleiAdmin,A=V.A,u=V.ui,SESSION='sorteio_volei_admin_key';
  const key=()=>u.adminKey.value.trim();
  const auth=(extra={})=>({chave:key(),...extra});
  function validKey(){if(A.CFG.DEMO_MODE||!A.CFG.API_BASE)return true;if(!key()){V.toast('Informe a chave administrativa.','warn');u.adminKey.focus();return false}return true}
  async function refresh(){V.busy(u.refreshAdmin,true,'Atualizando...');try{V.render(await A.request('admin',auth()))}catch(e){V.toast(e.message,'error');V.render(A.ler())}finally{V.busy(u.refreshAdmin,false)}}
  async function run(button,action,params,success){V.busy(button,true);try{const result=await A.request(action,params);if(result.codigo){u.activationCode.textContent=result.codigo;u.activationInput.value=result.codigo}V.toast(result.mensagem||success||'Operação concluída.');await refresh();return result}catch(e){V.toast(e.message,'error')}finally{V.busy(button,false)}}
  async function savePlayer(event){event.preventDefault();if(!validKey())return;const p={id:u.playerId.value,nome:u.playerName.value,dataNascimento:u.playerBirth.value,nota:u.playerScore.value,ativo:u.playerActive.value};try{A.validar(p)}catch(e){V.toast(e.message,'warn');return}const b=u.playerForm.querySelector('button[type="submit"]');V.busy(b,true,'Salvando...');try{await A.request('salvarJogador',auth(p));V.toast('Participante salvo.');u.playerForm.reset();u.playerId.value='';u.playerActive.value='SIM';V.categoryPreview();await refresh()}catch(e){V.toast(e.message,'error')}finally{V.busy(b,false)}}
  function editPlayer(id){const p=V.getState().jogadores?.find(x=>x.id===id);if(!p)return;u.playerId.value=p.id;u.playerName.value=p.nome;u.playerBirth.value=A.dataInput(p.dataNascimento);u.playerScore.value=p.nota;u.playerActive.value=p.ativo||'SIM';V.categoryPreview();u.playerName.focus()}
  async function deletePlayer(id){if(!validKey())return;const p=V.getState().jogadores?.find(x=>x.id===id);if(p&&confirm(`Excluir ${p.nome}?`))await run(null,'excluirJogador',auth({id}),'Participante excluído.')}
  u.adminKey.value=sessionStorage.getItem(SESSION)||'';
  u.saveAdminKey.onclick=()=>{sessionStorage.setItem(SESSION,key());V.toast('Chave mantida nesta sessão.');refresh()};
  u.playerForm.onsubmit=savePlayer;
  u.playerBirth.oninput=V.categoryPreview;
  u.playerScore.oninput=V.categoryPreview;
  u.playersTableBody.onclick=e=>{const b=e.target.closest('button[data-a]');if(b)(b.dataset.a==='edit'?editPlayer(b.dataset.id):deletePlayer(b.dataset.id))};
  u.matchesAdmin.onclick=e=>{const b=e.target.closest('button[data-win]');if(b&&!b.disabled&&validKey()&&confirm(`Confirmar ${b.textContent.trim()} como vencedor?`))run(b,'registrarResultado',auth({jogo:b.dataset.game,vencedorId:b.dataset.win}),'Resultado registrado.')};
  u.refreshAdmin.onclick=refresh;
  u.generateCode.onclick=()=>validKey()&&run(u.generateCode,'gerarCodigo',auth());
  u.sendTelegram.onclick=()=>validKey()&&run(u.sendTelegram,'enviarTelegram',auth());
  u.sendWhatsApp.onclick=()=>validKey()&&run(u.sendWhatsApp,'enviarWhatsApp',auth());
  u.cancelDraw.onclick=()=>validKey()&&confirm('Cancelar o sorteio atual?')&&run(u.cancelDraw,'cancelar',auth());
  u.drawNow.onclick=()=>validKey()&&confirm('Realizar o sorteio agora?')&&run(u.drawNow,'sortearAgora',auth());
  u.resetDraw.onclick=()=>validKey()&&confirm('Reiniciar o sorteio mantendo os inscritos?')&&run(u.resetDraw,'resetar',auth());
  u.activateDraw.onclick=()=>{const c=u.activationInput.value.replace(/\D/g,'');c.length===6?run(u.activateDraw,'ativar',{codigo:c,origem:'PAINEL_WEB'}):V.toast('Informe o código de seis dígitos.','warn')};
  u.sheetLink.href=A.CFG.SHEET_URL;u.apiLabel.textContent=A.CFG.API_BASE||'Não configurada — modo demonstração';V.categoryPreview();refresh();window.addEventListener('storage',e=>{if(e.key===A.STORAGE_KEY)refresh()});
})();