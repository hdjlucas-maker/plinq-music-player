// As APIs do Plinq são acessadas na mesma origem para manter a sessão em cookie.
(function () {
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: options.credentials || 'same-origin',
    });

    return response;
  }

  window.PlinqApi = {
    request,
  };
})();
