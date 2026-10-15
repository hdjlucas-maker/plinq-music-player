// ==========================================================
// Plinq - persistência local-first
// File System Access API + IndexedDB + "Continuar de onde parei"
// Este arquivo NÃO modifica script.js — só usa os hooks expostos
// em window.PlinqPlayer (addFiles, getState, restoreState).
// Media Session é configurada dentro do script.js.
// ==========================================================

(function () {
  const DB_NAME = 'plinq-local';
  const DB_VERSION = 1;
  const STORE = 'kv';

  const supportsFSA = 'showDirectoryPicker' in window;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  const AUDIO_EXT_RE = /\.(mp3|flac|wav|m4a|aac|ogg|opus|wma|aiff|alac)$/i;

  async function collectFilesFromDirHandle(dirHandle, pathPrefix = '') {
    const files = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && AUDIO_EXT_RE.test(name)) {
        const file = await handle.getFile();
        Object.defineProperty(file, 'webkitRelativePath', {
          value: pathPrefix + name,
          configurable: true,
        });
        files.push(file);
      } else if (handle.kind === 'directory') {
        const nested = await collectFilesFromDirHandle(handle, pathPrefix + name + '/');
        files.push(...nested);
      }
    }
    return files;
  }

  // Só verifica o estado atual — NUNCA pede permissão aqui.
  // queryPermission não precisa de gesto do usuário, requestPermission precisa.
  async function hasPermissionAlready(handle) {
    try {
      return (await handle.queryPermission({ mode: 'read' })) === 'granted';
    } catch (e) {
      return false;
    }
  }

  // Só chame isso dentro de um clique real do usuário.
  async function askPermission(handle) {
    try {
      return (await handle.requestPermission({ mode: 'read' })) === 'granted';
    } catch (e) {
      return false;
    }
  }

  // ---- UI: estilos ----

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .plinq-banner {
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: #101418; border: 1px solid #00f5d4; color: #eaffff;
        padding: 10px 16px; border-radius: 10px; font-size: 14px;
        display: flex; gap: 12px; align-items: center; z-index: 9999;
        box-shadow: 0 4px 18px rgba(0,0,0,.4);
      }
      .plinq-banner button {
        background: #00f5d4; color: #04201c; border: none; border-radius: 6px;
        padding: 6px 10px; font-weight: 600; cursor: pointer;
      }
      .plinq-banner button.secondary {
        background: transparent; color: #9fb0b3; border: 1px solid #2a3338;
      }
    `;
    document.head.appendChild(style);
  }

  // Assume o próprio botão "Adicionar pasta" já existente (id=add-folder-btn)
  // quando o navegador suporta FSA — sem criar um segundo botão. Sem FSA
  // (Firefox/Safari), o botão continua com o comportamento original.
  function upgradeFolderButton() {
    if (!supportsFSA) return;
    const folderBtn = document.getElementById('add-folder-btn');
    if (!folderBtn) return;

    folderBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const dirHandle = await window.showDirectoryPicker();
        await idbSet('rootHandle', dirHandle);
        const files = await collectFilesFromDirHandle(dirHandle);
        if (files.length && window.PlinqPlayer && window.PlinqPlayer.addFiles) {
          window.PlinqPlayer.addFiles(files);
        }
      } catch (e) {
        // usuário cancelou o seletor de pasta — sem problema
      }
    });
  }

  function showBanner(message, actionLabel, onAction, onDismiss) {
    const banner = document.createElement('div');
    banner.className = 'plinq-banner';
    banner.innerHTML = `
      <span>${message}</span>
      <button data-action="go">${actionLabel}</button>
      <button data-action="dismiss" class="secondary">Ignorar</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector('[data-action="go"]').addEventListener('click', () => {
      banner.remove();
      onAction();
    });
    banner.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
      banner.remove();
      if (onDismiss) onDismiss();
    });
  }

  async function finishRestore(files, rootHandle) {
    const savedState = await idbGet('playbackState').catch(() => null);
    if (savedState && typeof savedState.position === 'number') {
      showBanner(
        'Continuar de onde parou?',
        'Continuar',
        () => {
          window.PlinqPlayer.addFiles(files);
          window.PlinqPlayer.restoreState(savedState);
        },
        () => {
          window.PlinqPlayer.addFiles(files);
        }
      );
    } else {
      window.PlinqPlayer.addFiles(files);
    }
  }

  // ---- Restauração ao abrir o site ----

  async function tryRestore() {
    if (!window.PlinqPlayer || !window.PlinqPlayer.addFiles) return;
    if (!supportsFSA) return; // sem FSA, não há handle salvo pra restaurar

    const rootHandle = await idbGet('rootHandle').catch(() => null);
    if (!rootHandle) return; // primeira visita, nada salvo ainda

    const alreadyGranted = await hasPermissionAlready(rootHandle);

    if (alreadyGranted) {
      // Permissão ainda válida (mesma aba/sessão do navegador) — restaura direto.
      const files = await collectFilesFromDirHandle(rootHandle).catch(() => []);
      if (files.length) await finishRestore(files, rootHandle);
      return;
    }

    // Depois de fechar e reabrir o navegador, a permissão quase sempre
    // volta pro estado "prompt" — só um clique real do usuário pode
    // reconceder. Por isso mostramos um banner, em vez de tentar sozinho.
    showBanner(
      'Sua biblioteca de músicas está salva. Restaurar?',
      'Restaurar',
      async () => {
        const granted = await askPermission(rootHandle);
        if (!granted) return;
        const files = await collectFilesFromDirHandle(rootHandle).catch(() => []);
        if (files.length) await finishRestore(files, rootHandle);
      }
    );
  }

  // ---- Salvamento periódico do estado de reprodução ----

  function startAutoSave() {
    setInterval(() => {
      if (window.PlinqPlayer && window.PlinqPlayer.getState) {
        const state = window.PlinqPlayer.getState();
        if (state) idbSet('playbackState', state).catch(() => {});
      }
    }, 5000);

    window.addEventListener('beforeunload', () => {
      if (window.PlinqPlayer && window.PlinqPlayer.getState) {
        const state = window.PlinqPlayer.getState();
        if (state) idbSet('playbackState', state).catch(() => {});
      }
    });
  }

  function init() {
    injectStyles();
    upgradeFolderButton();
    startAutoSave();
    setTimeout(tryRestore, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
