(function () {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;

  const banner = document.getElementById('pwa-update-banner');
  const updateButton = document.getElementById('pwa-update-btn');
  let registration = null;
  let reloadAfterUpdate = false;

  function showUpdateBanner() {
    if (registration && registration.waiting && banner) banner.classList.remove('hidden');
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadAfterUpdate) window.location.reload();
  });

  if (updateButton) {
    updateButton.addEventListener('click', () => {
      if (!registration) return;
      if (registration.waiting) {
        reloadAfterUpdate = true;
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }

  async function checkForUpdate() {
    if (!registration || document.visibilityState !== 'visible') return;
    try {
      await registration.update();
    } catch (error) {
      console.error('Não foi possível verificar atualizações do Plinq:', error);
    }
  }

  async function registerServiceWorker() {
    try {
      registration = await navigator.serviceWorker.register('./service-worker.js', {
        scope: './',
        updateViaCache: 'none',
      });

      if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      await checkForUpdate();
    } catch (error) {
      console.error('Não foi possível ativar o modo PWA do Plinq:', error);
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', showUpdateBanner);
  document.addEventListener('visibilitychange', checkForUpdate);
  registerServiceWorker();
})();
