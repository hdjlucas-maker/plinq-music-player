// O web app usa sessão same-origin. O APK usa token bearer para falar com
// as Pages Functions sem depender de cookies de terceiros no WebView Android.
(function () {
  const nativeApp = window.PlinqNativeApp === true;
  const apiOrigin = 'https://plinq-music-player.pages.dev';
  const tokenKey = 'plinq_session_token';

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (nativeApp) {
      const token = localStorage.getItem(tokenKey);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch((nativeApp ? apiOrigin : '') + path, {
      ...options,
      headers,
      credentials: nativeApp ? 'omit' : (options.credentials || 'same-origin'),
    });

    if (nativeApp && response.status === 401) {
      localStorage.removeItem(tokenKey);
    }
    return response;
  }

  window.PlinqApi = {
    nativeApp,
    request,
    saveSessionToken(token) {
      if (nativeApp && token) localStorage.setItem(tokenKey, token);
    },
  };
})();
