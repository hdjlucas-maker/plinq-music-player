// Exige uma sessão e trial/assinatura ativos para qualquer área do Plinq.
// O servidor dá acesso permanente ao proprietário configurado em segredo.
(function () {
  let overlayEl = null;
  let checking = false;

  function removeGate() {
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
  }

  function showGate(kind, message) {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'modal-overlay';
      overlayEl.id = 'account-gate-overlay';
      overlayEl.style.zIndex = '90';
      document.body.appendChild(overlayEl);
    }

    const needsLogin = kind === 'login';
    const unavailable = kind === 'unavailable';
    overlayEl.innerHTML = `
      <div class="modal">
        <p style="margin:0 0 16px;line-height:1.5;">
          ${message || (needsLogin
            ? 'Crie uma conta e use o Plinq por 30 dias grátis. Depois, pague R$ 9,90 por mais 30 dias de acesso.'
            : unavailable
              ? 'Não consegui confirmar seu acesso. Verifique a internet e tente novamente.'
              : 'Seu período de 30 dias terminou. Pague R$ 9,90 para liberar mais 30 dias de acesso ao Plinq.')}
        </p>
        <button class="add-files-btn" id="account-gate-action" type="button">${needsLogin ? 'Criar conta / Entrar' : unavailable ? 'Tentar novamente' : 'Pagar 30 dias — R$ 9,90'}</button>
      </div>`;

    overlayEl.querySelector('#account-gate-action').addEventListener('click', () => {
      if (needsLogin && window.PlinqAuth) window.PlinqAuth.openAuthModal('register');
      else if (unavailable) evaluate();
      else if (window.PlinqAuth) window.PlinqAuth.startCheckout();
    });
  }

  async function evaluate() {
    if (checking) return;
    checking = true;
    try {
      const authRes = await fetch('/api/auth-me', { credentials: 'same-origin' });
      if (!authRes.ok) throw new Error('Falha ao consultar a conta');
      const authData = await authRes.json();
      if (!authData.user) {
        showGate('login');
        return;
      }

      const accessRes = await fetch('/api/subscription-status', { credentials: 'same-origin' });
      if (!accessRes.ok) throw new Error('Falha ao consultar o período de acesso');
      const access = await accessRes.json();
      if (access.isOwner || access.status === 'trial' || access.status === 'active') {
        removeGate();
      } else {
        showGate('expired');
      }
    } catch (error) {
      showGate('unavailable');
    } finally {
      checking = false;
    }
  }

  window.addEventListener('plinq:auth-changed', evaluate);
  window.addEventListener('plinq:access-changed', evaluate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') evaluate();
  });
  window.setInterval(evaluate, 60_000);
  evaluate();
})();
