(function () {
  // TODO: se algum dia migrar pra OAuth de usuário da Jamendo, o client_secret
  // entra só no backend — NUNCA aqui. A busca pública de faixas só precisa do client_id.
  const JAMENDO_CLIENT_ID = 'a20d899c';

  const GENRES = [
    { label: 'Pop', tag: 'pop', a: '#ff6fa3', b: '#7b2ff7' },
    { label: 'Rock', tag: 'rock', a: '#ff5e5e', b: '#7a1f1f' },
    { label: 'Eletrônica', tag: 'electronic', a: '#3FE7FF', b: '#1a5c66' },
    { label: 'Hip Hop', tag: 'hiphop', a: '#ffb347', b: '#7a3d00' },
    { label: 'Jazz', tag: 'jazz', a: '#f7d774', b: '#7a5c00' },
    { label: 'Clássica', tag: 'classical', a: '#c9c9ff', b: '#3d3d7a' },
    { label: 'Lo-fi', tag: 'lounge', a: '#b48cff', b: '#3d1f7a' },
    { label: 'Ambiente', tag: 'ambient', a: '#8cffe0', b: '#1f7a63' },
    { label: 'Reggae', tag: 'reggae', a: '#8cff8c', b: '#1f7a1f' },
    { label: 'Metal', tag: 'metal', a: '#adadad', b: '#2b2b2b' },
    { label: 'Funk', tag: 'funk', a: '#ff9ff3', b: '#7a1f6e' },
    { label: 'Acústico', tag: 'acousticguitar', a: '#e0c097', b: '#5c3d1f' },
  ];

  const $ = (id) => document.getElementById(id);

  const tabBtnPlayer = $('tab-btn-player');
  const tabBtnDiscover = $('tab-btn-discover');
  const tabPlayer = $('tab-player');
  const tabDiscover = $('tab-discover');

  const premiumBanner = $('premium-banner');
  const discoverLocked = $('discover-locked');
  const discoverLockedText = $('discover-locked-text');
  const discoverUnlockBtn = $('discover-unlock-btn');
  const discoverContent = $('discover-content');
  const genreGrid = $('genre-grid');
  const genreResults = $('genre-results');
  const genreResultsTitle = $('genre-results-title');
  const genreTrackList = $('genre-track-list');
  const genreBackBtn = $('genre-back-btn');

  const authModal = $('auth-modal');
  const authModalClose = $('auth-modal-close');
  const authTabLogin = $('auth-tab-login');
  const authTabRegister = $('auth-tab-register');
  const loginForm = $('login-form');
  const registerForm = $('register-form');
  const loginError = $('login-error');
  const registerError = $('register-error');

  let currentUser = null;
  let subscription = null; // { status: 'trial'|'active'|'expired', daysLeft }

  // ---- Tabs ----
  function showTab(name) {
    const isPlayer = name === 'player';
    tabPlayer.classList.toggle('active', isPlayer);
    tabDiscover.classList.toggle('active', !isPlayer);
    tabBtnPlayer.classList.toggle('active', isPlayer);
    tabBtnDiscover.classList.toggle('active', !isPlayer);
    if (!isPlayer) refreshDiscoverTab();
  }
  tabBtnPlayer.addEventListener('click', () => showTab('player'));
  tabBtnDiscover.addEventListener('click', () => showTab('discover'));

  // ---- Auth modal ----
  function openAuthModal(tab) {
    authModal.classList.remove('hidden');
    setAuthTab(tab || 'login');
  }
  function closeAuthModal() {
    authModal.classList.add('hidden');
    loginError.textContent = '';
    registerError.textContent = '';
  }
  function setAuthTab(tab) {
    const isLogin = tab === 'login';
    authTabLogin.classList.toggle('active', isLogin);
    authTabRegister.classList.toggle('active', !isLogin);
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
  }
  authTabLogin.addEventListener('click', () => setAuthTab('login'));
  authTabRegister.addEventListener('click', () => setAuthTab('register'));
  authModalClose.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
  discoverUnlockBtn.addEventListener('click', () => {
    if (!currentUser) openAuthModal('register');
    else startCheckout();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: $('login-email').value,
          password: $('login-password').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) { loginError.textContent = data.error || 'Erro ao entrar.'; return; }
      currentUser = data;
      window.dispatchEvent(new CustomEvent('plinq:auth-changed'));
      closeAuthModal();
      await refreshDiscoverTab();
    } catch (err) {
      loginError.textContent = 'Falha de conexão. Tente novamente.';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';
    try {
      const res = await fetch('/api/auth-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: $('register-name').value,
          email: $('register-email').value,
          password: $('register-password').value,
          cpf: $('register-cpf').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) { registerError.textContent = data.error || 'Erro ao criar conta.'; return; }
      currentUser = data;
      window.dispatchEvent(new CustomEvent('plinq:auth-changed'));
      closeAuthModal();
      await refreshDiscoverTab();
    } catch (err) {
      registerError.textContent = 'Falha de conexão. Tente novamente.';
    }
  });

  // ---- Session / subscription ----
  async function loadSession() {
    try {
      const res = await fetch('/api/auth-me', { credentials: 'same-origin' });
      const data = await res.json();
      currentUser = data.user || null;
    } catch (err) {
      currentUser = null;
    }
  }

  async function loadSubscription() {
    if (!currentUser) { subscription = null; return; }
    try {
      const res = await fetch('/api/subscription-status', { credentials: 'same-origin' });
      if (!res.ok) { subscription = null; return; }
      subscription = await res.json();
    } catch (err) {
      subscription = null;
    }
  }

  function renderBanner() {
    if (!currentUser || !subscription) {
      premiumBanner.classList.add('hidden');
      return;
    }
    premiumBanner.classList.remove('hidden');
    premiumBanner.className = 'premium-banner ' + subscription.status;

    if (subscription.status === 'trial') {
      premiumBanner.innerHTML = `<span>Teste grátis: ${subscription.daysLeft} dia(s) restante(s) — depois R$ 9,90/mês</span>`;
    } else if (subscription.status === 'active') {
      premiumBanner.innerHTML = `<span>Plinq Premium ativo — obrigado! ✨</span>`;
    } else {
      premiumBanner.innerHTML = `<span>Seu teste/assinatura expirou.</span><button id="banner-subscribe-btn" type="button">Assinar R$9,90/mês</button>`;
      const btn = document.getElementById('banner-subscribe-btn');
      if (btn) btn.addEventListener('click', startCheckout);
    }
  }

  async function refreshDiscoverTab() {
    if (!currentUser) {
      await loadSession();
    }

    if (!currentUser) {
      discoverLocked.classList.remove('hidden');
      discoverContent.classList.add('hidden');
      premiumBanner.classList.add('hidden');
      discoverLockedText.textContent = 'Seu player local continua grátis pra sempre. Crie uma conta grátis pra também ouvir a biblioteca online — 30 dias de teste, depois R$ 9,90/mês.';
      discoverUnlockBtn.textContent = 'Criar conta / Entrar';
      return;
    }

    await loadSubscription();
    renderBanner();

    if (!subscription || subscription.status === 'expired') {
      discoverLocked.classList.remove('hidden');
      discoverContent.classList.add('hidden');
      discoverLockedText.textContent = 'Seu teste da biblioteca online acabou — seu player local continua liberado normalmente. Assine por R$ 9,90/mês pra voltar a ouvir a biblioteca online.';
      discoverUnlockBtn.textContent = 'Assinar agora';
      return;
    }

    discoverLocked.classList.add('hidden');
    discoverContent.classList.remove('hidden');
    renderGenreGrid();
  }

  async function startCheckout() {
    if (!currentUser) { openAuthModal('register'); return; }
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId: currentUser.id, plan: 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        alert(data.error || 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.');
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      alert('Falha de conexão ao iniciar o pagamento.');
    }
  }

  // ---- Discover: genre grid + Jamendo ----
  function renderGenreGrid() {
    if (genreGrid.childElementCount > 0) return; // já montado
    genreGrid.innerHTML = '';
    GENRES.forEach((g) => {
      const card = document.createElement('div');
      card.className = 'genre-card';
      card.style.setProperty('--genre-a', g.a);
      card.style.setProperty('--genre-b', g.b);
      card.textContent = g.label;
      card.addEventListener('click', () => openGenre(g));
      genreGrid.appendChild(card);
    });
  }

  async function openGenre(genre) {
    genreResultsTitle.textContent = genre.label;
    genreTrackList.innerHTML = '<li style="padding:14px;color:var(--text-mute);">Carregando…</li>';
    genreGrid.classList.add('hidden');
    genreResults.classList.remove('hidden');

    try {
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=30&tags=${encodeURIComponent(genre.tag)}&audioformat=mp31&include=musicinfo`;
      const res = await fetch(url);
      const data = await res.json();
      const results = (data.results || []).filter(t => t.audio);

      if (results.length === 0) {
        genreTrackList.innerHTML = '<li style="padding:14px;color:var(--text-mute);">Nenhuma faixa encontrada nesse gênero agora.</li>';
        return;
      }

      genreTrackList.innerHTML = '';
      results.forEach((t, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="track-info"><div class="t-name">${escapeHtml(t.name)} — ${escapeHtml(t.artist_name)}</div></div>`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          const remoteTracks = results.map(rt => ({
            name: `${rt.name} — ${rt.artist_name}`,
            url: rt.audio,
            duration: rt.duration || 0,
          }));
          if (window.PlinqPlayer) window.PlinqPlayer.playRemoteTracks(remoteTracks, i);
          showTab('player');
        });
        genreTrackList.appendChild(li);
      });
    } catch (err) {
      genreTrackList.innerHTML = '<li style="padding:14px;color:var(--text-mute);">Erro ao buscar faixas. Tente novamente.</li>';
    }
  }

  genreBackBtn.addEventListener('click', () => {
    genreResults.classList.add('hidden');
    genreGrid.classList.remove('hidden');
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Exposto pro account-gate.js conseguir checar login e abrir o mesmo
  // modal de conta, sem duplicar lógica de auth.
  window.PlinqAuth = {
    openAuthModal,
    isLoggedIn: () => !!currentUser,
  };

  // Handle redirect back from InfinitePay checkout (?paid=1)
  if (new URLSearchParams(window.location.search).get('paid') === '1') {
    window.history.replaceState({}, '', window.location.pathname);
    showTab('discover');
  }

  loadSession();
})();