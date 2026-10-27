(function () {
  const tabBtnPlayer = document.getElementById('tab-btn-player');
  const tabBtnDiscover = document.getElementById('tab-btn-discover');
  const tabPlayer = document.getElementById('tab-player');
  const tabDiscover = document.getElementById('tab-discover');
  const form = document.getElementById('youtube-search-form');
  const queryInput = document.getElementById('youtube-search-query');
  const searchButton = document.getElementById('youtube-search-btn');
  const status = document.getElementById('youtube-search-status');
  const results = document.getElementById('youtube-results');
  const playerWrap = document.getElementById('youtube-player-wrap');
  const player = document.getElementById('youtube-player');
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const searchApiBase = isLocalDevelopment ? '' : 'https://plinq-music-player.pages.dev';
  let activeRequest = null;

  function showTab(name) {
    const isPlayer = name === 'player';
    tabPlayer.classList.toggle('active', isPlayer);
    tabDiscover.classList.toggle('active', !isPlayer);
    tabBtnPlayer.classList.toggle('active', isPlayer);
    tabBtnDiscover.classList.toggle('active', !isPlayer);
    if (isPlayer) stopYouTubePlayer();
  }

  function stopYouTubePlayer() {
    player.removeAttribute('src');
    playerWrap.classList.add('hidden');
  }

  function safeThumbnailUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'i.ytimg.com' ? url.href : '';
    } catch {
      return '';
    }
  }

  function renderResults(items) {
    results.replaceChildren();
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'youtube-result';

      const imageUrl = safeThumbnailUrl(item.thumbnail);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        card.appendChild(image);
      }

      const title = document.createElement('h3');
      title.textContent = item.title;
      const channel = document.createElement('p');
      channel.textContent = item.channel;
      const actions = document.createElement('div');
      actions.className = 'youtube-result-actions';

      const playButton = document.createElement('button');
      playButton.type = 'button';
      playButton.className = 'add-files-btn';
      playButton.textContent = 'Reproduzir';
      playButton.addEventListener('click', () => playVideo(item.id));

      const sourceLink = document.createElement('a');
      sourceLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.textContent = 'Abrir no YouTube';

      actions.append(playButton, sourceLink);
      card.append(title, channel, actions);
      results.appendChild(card);
    }
  }

  function playVideo(videoId) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;
    if (window.PlinqPlayer) window.PlinqPlayer.pause();
    const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
    embed.searchParams.set('autoplay', '1');
    embed.searchParams.set('controls', '1');
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');
    player.src = embed.href;
    playerWrap.classList.remove('hidden');
    playerWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function searchYouTube(query) {
    if (activeRequest) activeRequest.abort();
    const request = new AbortController();
    activeRequest = request;
    searchButton.disabled = true;
    status.textContent = 'Buscando no YouTube…';
    results.replaceChildren();

    try {
      const response = await fetch(`${searchApiBase}/api/youtube-search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' },
        signal: request.signal,
      });
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`A API retornou uma resposta inesperada (HTTP ${response.status}).`);
      }
      const data = await response.json();
      if (!response.ok) {
        status.textContent = data.error || 'Não foi possível fazer a busca.';
        return;
      }
      renderResults(data.items);
      status.textContent = data.items.length
        ? `${data.items.length} resultado(s). Toque em Reproduzir para abrir no player oficial do YouTube.`
        : 'Nenhum resultado incorporável encontrado. Tente outra busca.';
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Busca do YouTube falhou:', error);
        status.textContent = error.message && error.message.startsWith('A API retornou')
          ? error.message
          : 'Falha de conexão com a API de busca. Tente novamente em instantes.';
      }
    } finally {
      if (activeRequest === request) {
        searchButton.disabled = false;
        activeRequest = null;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (query.length < 2 || query.length > 100) {
      status.textContent = 'Digite uma busca entre 2 e 100 caracteres.';
      return;
    }
    searchYouTube(query);
  });

  tabBtnPlayer.addEventListener('click', () => showTab('player'));
  tabBtnDiscover.addEventListener('click', () => showTab('discover'));
})();
