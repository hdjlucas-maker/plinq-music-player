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

  // ---- UI: banner "Continuar de onde parei" ----
  // Os estilos vivem em style.css (classe .plinq-banner): injetar <style> aqui
  // forçaria manter 'unsafe-inline' no style-src da CSP. O conteúdo é montado
  // com DOM API + textContent, nunca com innerHTML.

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

    const text = document.createElement('span');
    text.textContent = message;

    const goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.dataset.action = 'go';
    goBtn.textContent = actionLabel;

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.dataset.action = 'dismiss';
    dismissBtn.className = 'secondary';
    dismissBtn.textContent = 'Ignorar';

    banner.append(text, goBtn, dismissBtn);
    document.body.appendChild(banner);

    goBtn.addEventListener('click', () => {
      banner.remove();
      onAction();
    });
    dismissBtn.addEventListener('click', () => {
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
