(function () {
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
  let lastFocusedElement = null;

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
  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null);
  }

  function focusFirstAuthField(tab) {
    const form = tab === 'register' ? registerForm : loginForm;
    const field = form.querySelector('input');
    if (field) field.focus();
  }

  function openAuthModal(tab) {
    lastFocusedElement = document.activeElement;
    authModal.classList.remove('hidden');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setAuthTab(tab || 'login');
    requestAnimationFrame(() => focusFirstAuthField(tab || 'login'));
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    loginError.textContent = '';
    registerError.textContent = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function setAuthTab(tab) {
    const isLogin = tab === 'login';
    authTabLogin.classList.toggle('active', isLogin);
    authTabRegister.classList.toggle('active', !isLogin);
    authTabLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    authTabRegister.setAttribute('aria-selected', isLogin ? 'false' : 'true');
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
  }

  authTabLogin.addEventListener('click', () => setAuthTab('login'));
  authTabRegister.addEventListener('click', () => setAuthTab('register'));
  authModalClose.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
  authModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAuthModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = getFocusableElements(authModal);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  discoverUnlockBtn.addEventListener('click', () => {
    if (!currentUser) openAuthModal('register');
    else startCheckout();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = $('login-email').value;
    const password = $('login-password').value;
    try {
      const res = await window.PlinqApi.request('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) { loginError.textContent = data.error || 'Erro ao entrar.'; return; }
      window.PlinqApi.saveSessionToken(data.sessionToken);
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
    const name = $('register-name').value;
    const email = $('register-email').value;
    const password = $('register-password').value;
    try {
      const res = await window.PlinqApi.request('/api/auth-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          cpf: $('register-cpf').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) { registerError.textContent = data.error || 'Erro ao criar conta.'; return; }
      window.PlinqApi.saveSessionToken(data.sessionToken);
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
      const res = await window.PlinqApi.request('/api/auth-me');
      if (!res.ok) {
        currentUser = null;
        return;
      }
      const data = await res.json();
      currentUser = data.user || null;
    } catch (err) {
      currentUser = null;
    }
  }

  async function loadSubscription() {
    if (!currentUser) { subscription = null; return; }
    try {
      const res = await window.PlinqApi.request('/api/subscription-status');
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

    if (subscription.isOwner || currentUser.isOwner) {
      premiumBanner.innerHTML = '<span>Acesso do proprietário — permanente</span>';
    } else if (subscription.status === 'trial') {
      premiumBanner.innerHTML = `<span>Teste grátis: ${subscription.daysLeft} dia(s) restante(s) — depois R$ 9,90 por 30 dias</span>`;
    } else if (subscription.status === 'active') {
      premiumBanner.innerHTML = `<span>Plinq Premium ativo — obrigado! ✨</span>`;
    } else {
      premiumBanner.innerHTML = `<span>Seu acesso expirou.</span><button id="banner-subscribe-btn" type="button">Pagar 30 dias — R$ 9,90</button>`;
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
      discoverLockedText.textContent = 'Crie uma conta para usar o Plinq por 30 dias grátis. Depois, pague R$ 9,90 por mais 30 dias de acesso.';
      discoverUnlockBtn.textContent = 'Criar conta / Entrar';
      return;
    }

    await loadSubscription();
    renderBanner();

    if (!subscription || subscription.status === 'expired') {
      discoverLocked.classList.remove('hidden');
      discoverContent.classList.add('hidden');
      discoverLockedText.textContent = 'Seu período de 30 dias terminou. Pague R$ 9,90 para liberar mais 30 dias de acesso ao Plinq.';
      discoverUnlockBtn.textContent = 'Pagar 30 dias — R$ 9,90';
      return;
    }

    discoverLocked.classList.add('hidden');
    discoverContent.classList.remove('hidden');
  }

  async function startCheckout() {
    if (!currentUser) { openAuthModal('register'); return; }
    try {
      const res = await window.PlinqApi.request('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // A busca online ainda não tem fonte definida (ver README, "Pendências").
  // A aba "Ouvir Online" mostra apenas o estado de conta/assinatura até uma
  // nova fonte de catálogo ser escolhida e implementada.
  const discoverBrowseBtn = $('discover-browse-btn');
  discoverBrowseBtn.addEventListener('click', () => {
    showTab('player');
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.click();
  });

  // Handle redirect back from InfinitePay checkout (?paid=1)
  if (new URLSearchParams(window.location.search).get('paid') === '1') {
    window.history.replaceState({}, '', window.location.pathname);
    showTab('discover');
  }

  loadSession();
})();
