// ==========================================================
// Plinq - player de música local (sem anúncios, sem login)
// ==========================================================

(function () {
  const audio = document.getElementById('audio-el');
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn = document.getElementById('repeat-btn');
  const volumeSlider = document.getElementById('volume-slider');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-input');
  const playlistEl = document.getElementById('playlist');
  const emptyState = document.getElementById('empty-state');
  const trackNameEl = document.getElementById('track-name');
  const currentTimeEl = document.getElementById('current-time');
  const durationTimeEl = document.getElementById('duration-time');
  const trackCounterEl = document.getElementById('track-counter');
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const visualizer = document.getElementById('visualizer');

  const ICON_PLAY = '<polygon points="6,4 20,12 6,20"/>';
  const ICON_PAUSE = '<rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/>';

  let tracks = []; // { file, url, name, duration }
  let currentIndex = -1;
  let isPlaying = false;
  let shuffleOn = false;
  let repeatOn = false;
  let shuffleHistory = [];

  // Build visualizer bars
  const BAR_COUNT = 28;
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    visualizer.appendChild(bar);
  }
  const bars = visualizer.querySelectorAll('.bar');

  let audioCtx, analyser, sourceNode, dataArray, rafId;

  function setupAudioContext() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      // Keep full stereo through the analyser so the visualizer
      // doesn't downmix playback to mono on some devices/browsers
      analyser.channelCount = 2;
      analyser.channelCountMode = 'explicit';
      analyser.channelInterpretation = 'discrete';

      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.channelCount = 2;
      sourceNode.channelCountMode = 'explicit';
      sourceNode.channelInterpretation = 'discrete';

      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      // Visualizer unsupported, fail silently
    }
  }

  function animateVisualizer() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    const step = Math.floor(dataArray.length / BAR_COUNT);
    bars.forEach((bar, i) => {
      const value = dataArray[i * step] || 0;
      const pct = Math.max(8, (value / 255) * 100);
      bar.style.height = pct + '%';
      bar.classList.toggle('active', isPlaying && pct > 18);
    });
    rafId = requestAnimationFrame(animateVisualizer);
  }

  function stopVisualizer() {
    if (rafId) cancelAnimationFrame(rafId);
    bars.forEach(bar => {
      bar.style.height = '10%';
      bar.classList.remove('active');
    });
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function cleanName(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }

  const AUDIO_EXT_RE = /\.(mp3|flac|wav|m4a|aac|ogg|opus|wma|aiff|alac)$/i;

  function addFilesToPlaylist(fileList) {
    const files = Array.from(fileList).filter(file => {
      // Some browsers report directory items without a proper MIME type,
      // so fall back to checking the file extension.
      return file.type.startsWith('audio/') || AUDIO_EXT_RE.test(file.name);
    });

    if (!files.length) return;

    // Sort so folder selections come in a sensible order (alphabetical,
    // respecting any subfolder path included in webkitRelativePath)
    files.sort((a, b) => {
      const pathA = a.webkitRelativePath || a.name;
      const pathB = b.webkitRelativePath || b.name;
      return pathA.localeCompare(pathB, 'pt-BR', { numeric: true });
    });

    files.forEach(file => {
      const url = URL.createObjectURL(file);
      tracks.push({ file, url, name: cleanName(file.name), duration: null });
    });

    renderPlaylist();

    if (currentIndex === -1 && tracks.length > 0) {
      loadTrack(0);
    }
  }

  fileInput.addEventListener('change', (e) => {
    addFilesToPlaylist(e.target.files);
    fileInput.value = '';
  });

  folderInput.addEventListener('change', (e) => {
    addFilesToPlaylist(e.target.files);
    folderInput.value = '';
  });

  function renderPlaylist() {
    playlistEl.innerHTML = '';

    if (tracks.length === 0) {
      emptyState.style.display = 'block';
      playlistEl.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      playlistEl.style.display = 'block';
    }

    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = i === currentIndex ? 'active' : '';

      const indexEl = document.createElement('span');
      indexEl.className = 'track-index';
      indexEl.textContent = String(i + 1).padStart(2, '0');

      const infoEl = document.createElement('div');
      infoEl.className = 'track-info';
      const nameEl = document.createElement('div');
      nameEl.className = 't-name';
      nameEl.textContent = track.name;
      infoEl.appendChild(nameEl);

      const durEl = document.createElement('span');
      durEl.className = 't-dur';
      durEl.textContent = track.duration ? formatTime(track.duration) : '--:--';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.setAttribute('aria-label', 'Remover da playlist');
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeTrack(i);
      });

      li.appendChild(indexEl);
      li.appendChild(infoEl);
      li.appendChild(durEl);
      li.appendChild(removeBtn);

      li.addEventListener('click', () => loadTrack(i, true));

      playlistEl.appendChild(li);
    });

    trackCounterEl.textContent = tracks.length === 0
      ? '0 / 0'
      : `${currentIndex + 1} / ${tracks.length}`;
  }

  function removeTrack(index) {
    const wasCurrent = index === currentIndex;
    URL.revokeObjectURL(tracks[index].url);
    tracks.splice(index, 1);

    if (tracks.length === 0) {
      currentIndex = -1;
      audio.pause();
      audio.removeAttribute('src');
      trackNameEl.textContent = 'Nenhuma música carregada';
      trackNameEl.classList.add('empty');
      setPlayingState(false);
      progressFill.style.width = '0%';
      currentTimeEl.textContent = '00:00';
      durationTimeEl.textContent = '00:00';
    } else if (wasCurrent) {
      const newIndex = Math.min(index, tracks.length - 1);
      loadTrack(newIndex, isPlaying);
    } else if (index < currentIndex) {
      currentIndex--;
    }

    renderPlaylist();
  }

  function loadTrack(index, autoPlay) {
    if (index < 0 || index >= tracks.length) return;
    currentIndex = index;
    const track = tracks[index];

    audio.src = track.url;
    trackNameEl.textContent = track.name;
    trackNameEl.classList.remove('empty');
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '00:00';

    renderPlaylist();
    scrollActiveIntoView();

    if (autoPlay) {
      playAudio();
    }
  }

  function scrollActiveIntoView() {
    const active = playlistEl.querySelector('li.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
    if (playing) {
      setupAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (!rafId) animateVisualizer();
    } else {
      stopVisualizer();
    }
  }

  function playAudio() {
    if (currentIndex === -1) {
      if (tracks.length === 0) return;
      loadTrack(0, true);
      return;
    }
    audio.play().then(() => setPlayingState(true)).catch(() => {});
  }

  function pauseAudio() {
    audio.pause();
    setPlayingState(false);
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) pauseAudio();
    else playAudio();
  });

  function getNextIndex() {
    if (tracks.length === 0) return -1;
    if (shuffleOn) {
      if (tracks.length === 1) return 0;
      let next;
      do {
        next = Math.floor(Math.random() * tracks.length);
      } while (next === currentIndex);
      return next;
    }
    return (currentIndex + 1) % tracks.length;
  }

  function getPrevIndex() {
    if (tracks.length === 0) return -1;
    if (shuffleOn && shuffleHistory.length > 0) {
      return shuffleHistory.pop();
    }
    return (currentIndex - 1 + tracks.length) % tracks.length;
  }

  nextBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    if (shuffleOn) shuffleHistory.push(currentIndex);
    const next = getNextIndex();
    if (next !== -1) loadTrack(next, true);
  });

  prevBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prev = getPrevIndex();
    if (prev !== -1) loadTrack(prev, true);
  });

  shuffleBtn.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    shuffleBtn.classList.toggle('on', shuffleOn);
    shuffleHistory = [];
  });

  repeatBtn.addEventListener('click', () => {
    repeatOn = !repeatOn;
    repeatBtn.classList.toggle('on', repeatOn);
  });

  audio.addEventListener('ended', () => {
    if (repeatOn) {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    if (shuffleOn) shuffleHistory.push(currentIndex);
    const next = getNextIndex();
    if (next !== -1) {
      loadTrack(next, true);
    } else {
      setPlayingState(false);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    durationTimeEl.textContent = formatTime(audio.duration);
    if (currentIndex !== -1) {
      tracks[currentIndex].duration = audio.duration;
      renderPlaylist();
    }
  });

  audio.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(audio.currentTime);
    if (audio.duration) {
      progressFill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    }
  });

  audio.addEventListener('play', () => setPlayingState(true));
  audio.addEventListener('pause', () => setPlayingState(false));

  progressWrap.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressWrap.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  volumeSlider.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
  });
  audio.volume = parseFloat(volumeSlider.value);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      playBtn.click();
    } else if (e.code === 'ArrowRight') {
      nextBtn.click();
    } else if (e.code === 'ArrowLeft') {
      prevBtn.click();
    }
  });

  renderPlaylist();
})();


// ==========================================================
// Contador de curtidas (sem login, sem cadastro)
//
// Usa a API gratuita CountAPI (https://countapi.xyz) para manter
// um contador global de curtidas. Cada visitante só pode curtir
// uma vez (controlado via localStorage no próprio navegador).
//
// Se a API estiver indisponível (ex: sem internet, ou bloqueada),
// o botão funciona em modo local: o contador fica salvo só
// no navegador da pessoa, sem quebrar a experiência.
// ==========================================================

(function () {
  const likeBtn = document.getElementById('like-btn');
  const likeCountEl = document.getElementById('like-count');
  if (!likeBtn || !likeCountEl) return;

  // Troque "plinq-app" por um identificador único do seu projeto
  // se quiser separar as estatísticas de outros projetos que usem CountAPI.
  const NAMESPACE = 'plinq-app';
  const KEY = 'curtidas';
  const STORAGE_KEY = 'plinq_liked';

  const hasLiked = () => localStorage.getItem(STORAGE_KEY) === '1';

  function setLikedUI(liked) {
    likeBtn.classList.toggle('liked', liked);
    likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  }

  function setCount(n) {
    likeCountEl.textContent = String(n);
  }

  // Carrega o contador atual (somente leitura, não incrementa)
  fetch(`https://api.countapi.xyz/get/${NAMESPACE}/${KEY}`)
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(data => setCount(data.value ?? 0))
    .catch(() => {
      // Sem internet ou API fora do ar: usa contador local como fallback
      const local = parseInt(localStorage.getItem('plinq_like_count') || '0', 10);
      setCount(local);
    });

  setLikedUI(hasLiked());

  likeBtn.addEventListener('click', () => {
    if (hasLiked()) {
      // Já curtiu: clicar novamente remove a curtida
      fetch(`https://api.countapi.xyz/hit/${NAMESPACE}/${KEY}?amount=-1`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => setCount(Math.max(0, data.value ?? 0)))
        .catch(() => {
          const local = Math.max(0, parseInt(localStorage.getItem('plinq_like_count') || '0', 10) - 1);
          localStorage.setItem('plinq_like_count', String(local));
          setCount(local);
        });

      localStorage.removeItem(STORAGE_KEY);
      setLikedUI(false);
    } else {
      fetch(`https://api.countapi.xyz/hit/${NAMESPACE}/${KEY}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => setCount(data.value ?? 0))
        .catch(() => {
          const local = parseInt(localStorage.getItem('plinq_like_count') || '0', 10) + 1;
          localStorage.setItem('plinq_like_count', String(local));
          setCount(local);
        });

      localStorage.setItem(STORAGE_KEY, '1');
      setLikedUI(true);
    }
  });
})();
