// ==========================================================
// Plinq - account-gate
// Nenhuma parte do app (player local nem Descobrir) funciona sem conta.
// Cadastro é grátis; o trial de 30 dias é só pro Premium (Descobrir),
// controlado no backend (D1 + KV) — não tem relação com este gate.
//
// Por que isso fecha o buraco que o trial-gate por tempo não fechava:
// não existe estado "anônimo" pra resetar limpando o navegador ou abrindo
// aba anônima. Sem sessão válida (emitida pelo backend, ligada a uma
// conta real no D1) o app inteiro fica bloqueado. E criar conta nova toda
// hora pra burlar já esbarra no anti-fraude que já existe: o CPF é
// hasheado e usado pra impedir múltiplos cadastros de teste grátis pela
// mesma pessoa (ver SETUP-LICENCA.md).
// ==========================================================

(function () {
  const GATE_Z_INDEX = 90; // abaixo do .modal-overlay (100) do login, pra não cobrir o form

  let overlayEl = null;
  let unlocked = false;

  async function isLoggedIn() {
    try {
      const res = await fetch('/api/auth-me', { credentials: 'same-origin' });
      const data = await res.json();
      return !!(data && data.user);
    } catch (e) {
      return false; // falha de rede: trata como não logado (mais seguro pro negócio)
    }
  }

  function showGate() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.className = 'modal-overlay'; // reaproveita o estilo já usado no auth-modal
    overlayEl.id = 'account-gate-overlay';
    overlayEl.style.zIndex = String(GATE_Z_INDEX);
    overlayEl.innerHTML = `
      <div class="modal">
        <p style="margin:0 0 16px;line-height:1.5;">
          Crie uma conta grátis pra usar o Plinq.<br>
          O cadastro é grátis e o player local (suas músicas, sem anúncio)
          continua grátis pra sempre. Só a biblioteca "Ouvir Online" tem
          30 dias de teste grátis e depois assinatura opcional.
        </p>
        <button class="add-files-btn" id="account-gate-btn" type="button">Criar conta grátis</button>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('#account-gate-btn').addEventListener('click', () => {
      if (window.PlinqAuth && window.PlinqAuth.openAuthModal) {
        window.PlinqAuth.openAuthModal('register');
      }
    });
  }

  function hideGate() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    unlocked = true;
  }

  async function evaluate() {
    if (unlocked) return; // já desbloqueou nesta sessão, não precisa checar de novo
    const loggedIn = await isLoggedIn();
    if (loggedIn) hideGate();
    else showGate();
  }

  // premium.js dispara esse evento depois de login/cadastro bem-sucedidos
  window.addEventListener('plinq:auth-changed', evaluate);

  function init() {
    evaluate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
