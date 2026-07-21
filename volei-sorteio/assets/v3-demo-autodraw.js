(() => {
  'use strict';
  if (!window.VoleiApp) return;
  const App = window.VoleiApp;
  const originalRequest = App.request;
  let finalizando = false;
  App.request = async function (acao, parametros = {}) {
    const resultado = await originalRequest(acao, parametros);
    if (
      !finalizando &&
      (App.CFG.DEMO_MODE || !App.CFG.API_BASE) &&
      (acao === 'estado' || acao === 'admin') &&
      String(resultado?.status || '').toUpperCase() === 'EM_CONTAGEM' &&
      resultado.inicioPrevisto
    ) {
      const termino = App.data(resultado.inicioPrevisto);
      if (termino && termino.getTime() <= Date.now()) {
        finalizando = true;
        try {
          const concluido = await originalRequest('sortearAgora', {});
          return concluido.estado || concluido;
        } finally {
          finalizando = false;
        }
      }
    }
    return resultado;
  };
})();