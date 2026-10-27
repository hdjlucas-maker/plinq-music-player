(function () {
  const banner = document.getElementById('pwa-update-banner');
  const updateButton = document.getElementById('pwa-update-btn');
  const installButton = document.getElementById('pwa-install-btn');
  const installHelp = document.getElementById('pwa-install-help');
  let registration = null;
  let deferredInstallPrompt = null;
  let reloadAfterUpdate = false;

  function isInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || navigator.standalone === true;
  }

  function showInstallHelp(message) {
    if (!installHelp) return;
    installHelp.textContent = message;
    installHelp.classList.remove('hidden');
  }

  function hideInstallButton() {
    if (installButton) installButton.classList.add('hidden');
    if (installHelp) installHelp.classList.add('hidden');
  }

  function showUpdateBanner() {
    if (registration && registration.waiting && banner) banner.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallButton();
  });

  if (isInstalled()) hideInstallButton();

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (isInstalled()) {
        hideInstallButton();
        return;
      }

      if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        try {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === 'accepted') hideInstallButton();
        } catch (error) {
          console.error('Não foi possível abrir a instalação do Plinq:', error);
          showInstallHelp('A instalação não abriu. Use o menu do navegador para instalar o app.');
        }
        return;
      }

      const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      showInstallHelp(isAppleMobile
        ? 'No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.'
        : 'No Chrome, abra o menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.');
    });
  }

  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

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
