// ==========================================================
// Plinq - player de música  (sem anúncios,)
// ==========================================================

(function () {
  const audioA = document.getElementById('audio-el');
  const audioB = document.getElementById('audio-el-2');
  // Necessário pra faixas remotas (Jamendo/Descobrir) tocarem com som:
  // sem isso, uma vez que o elemento é conectado ao Web Audio API (pro
  // visualizador/crossfade), fontes de outra origem sem CORS ficam mudas.
  audioA.crossOrigin = 'anonymous';
  audioB.crossOrigin = 'anonymous';
  const els = [audioA, audioB];
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

  const crossfadeBtn = document.getElementById('crossfade-btn');
  const crossfadeMenu = document.getElementById('crossfade-menu');
  const crossfadeLabelEl = document.getElementById('crossfade-label');
  const sleepBtn = document.getElementById('sleep-btn');
  const sleepMenu = document.getElementById('sleep-menu');
  const sleepLabelEl = document.getElementById('sleep-label');

  const ICON_PLAY = '<polygon points="6,4 20,12 6,20"/>';
  const ICON_PAUSE = '<rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/>';

  let tracks = []; // { file, url, name, duration }
  let currentIndex = -1;
  let isPlaying = false;
  let shuffleOn = false;
  let repeatOn = false;
  let shuffleHistory = [];

  // Dual-element playback engine (gapless preload + crossfade)
  let activeIdx = 0;
  let gains = null; // [gainA, gainB], set up once Web Audio graph exists
  let masterGain = null;
  let transitioning = false;   // true while a crossfade fade is in progress
  let gaplessPreloaded = false; // true once the inactive element has the next track buffered (crossfade off)
  let pendingNextIndex = null;  // index chosen ahead of time for the upcoming auto-transition

  let crossfadeDuration = parseInt(localStorage.getItem('plinq_crossfade') || '0', 10);
  if (![0, 3, 6, 10].includes(crossfadeDuration)) crossfadeDuration = 0;

  // Sleep timer state
  let sleepTimeoutId = null;
  let sleepLabelInterval = null;
  let sleepEndAt = null;
  let sleepAtTrackEnd = false;

  function getActive() { return els[activeIdx]; }
  function getInactive() { return els[1 - activeIdx]; }
  function getActiveGain() { return gains ? gains[activeIdx] : null; }
  function getInactiveGain() { return gains ? gains[1 - activeIdx] : null; }

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

      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);

      // Each <audio> element gets its own source -> gain node, both summed
      // into masterGain. This is what makes crossfade (independent volume
      // ramps per element) and gapless preload (silent buffering on the
      // inactive element) possible.
      gains = els.map(el => {
        const src = audioCtx.createMediaElementSource(el);
        src.channelCount = 2;
        src.channelCountMode = 'explicit';
        src.channelInterpretation = 'discrete';
        const gain = audioCtx.createGain();
        gain.gain.value = 1;
        src.connect(gain);
        gain.connect(masterGain);
        return gain;
      });

      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      // Visualizer/Web Audio unsupported, fail silently — playback still
      // works through the plain <audio> element, just without crossfade.
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
    resetInactive(); // any preloaded/crossfading "next" index is now stale

    if (tracks.length === 0) {
      currentIndex = -1;
      getActive().pause();
      getActive().removeAttribute('src');
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

  // Stops/clears the inactive element and cancels any pending gapless
  // preload or crossfade bookkeeping. Called whenever the "next track"
  // that was silently prepared no longer applies (manual skip, playlist
  // edit, new track loaded directly, etc).
  function resetInactive() {
    const inactive = getInactive();
    inactive.pause();
    inactive.removeAttribute('src');
    try { inactive.load(); } catch (e) {}
    const ig = getInactiveGain();
    if (ig && audioCtx) {
      ig.gain.cancelScheduledValues(audioCtx.currentTime);
      ig.gain.value = 1;
    }
    pendingNextIndex = null;
    gaplessPreloaded = false;
    transitioning = false;
  }

  function loadTrack(index, autoPlay) {
    if (index < 0 || index >= tracks.length) return;
    resetInactive();
    currentIndex = index;
    const track = tracks[index];
    const el = getActive();

    const ag = getActiveGain();
    if (ag && audioCtx) {
      ag.gain.cancelScheduledValues(audioCtx.currentTime);
      ag.gain.value = 1;
    }

    el.src = track.url;
    el.currentTime = 0;
    trackNameEl.textContent = track.name;
    trackNameEl.classList.remove('empty');
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '00:00';

    renderPlaylist();
    scrollActiveIntoView();
    updateMediaSessionMetadata(track);

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
    getActive().play().then(() => setPlayingState(true)).catch(() => {});
  }

  function pauseAudio() {
    getActive().pause();
    if (transitioning) getInactive().pause();
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

  // Manual skips are always instant (no crossfade) — crossfade only
  // applies to the automatic transition when a track naturally finishes.
  nextBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    if (shuffleOn) shuffleHistory.push(currentIndex);
    const next = getNextIndex();
    if (next !== -1) loadTrack(next, true);
  });

  prevBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    if (getActive().currentTime > 3) {
      getActive().currentTime = 0;
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

  // ---- Sleep timer ---------------------------------------------------

  function fadeOutAndPause(duration) {
    const ag = getActiveGain();
    if (audioCtx && ag) {
      const now = audioCtx.currentTime;
      ag.gain.cancelScheduledValues(now);
      ag.gain.setValueAtTime(ag.gain.value, now);
      ag.gain.linearRampToValueAtTime(0, now + duration);
      setTimeout(() => {
        pauseAudio();
        if (audioCtx) {
          ag.gain.cancelScheduledValues(audioCtx.currentTime);
          ag.gain.value = 1;
        }
      }, duration * 1000 + 50);
    } else {
      pauseAudio();
    }
  }

  function clearSleepTimer() {
    if (sleepTimeoutId) clearTimeout(sleepTimeoutId);
    if (sleepLabelInterval) clearInterval(sleepLabelInterval);
    sleepTimeoutId = null;
    sleepLabelInterval = null;
    sleepEndAt = null;
    sleepAtTrackEnd = false;
  }

  function clearSleepUI() {
    clearSleepTimer();
    sleepLabelEl.textContent = 'Sleep Timer';
    sleepBtn.classList.remove('on');
  }

  function updateSleepLabel() {
    if (!sleepEndAt) return;
    const remaining = Math.max(0, sleepEndAt - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    sleepLabelEl.textContent = m + ':' + String(s).padStart(2, '0');
  }

  function setSleepMinutes(mins) {
    clearSleepTimer();
    sleepEndAt = Date.now() + mins * 60000;
    sleepBtn.classList.add('on');
    updateSleepLabel();
    sleepLabelInterval = setInterval(updateSleepLabel, 1000);
    sleepTimeoutId = setTimeout(() => {
      fadeOutAndPause(5);
      clearSleepUI();
    }, mins * 60000);
  }

  function setSleepAtTrackEnd() {
    clearSleepTimer();
    sleepAtTrackEnd = true;
    sleepBtn.classList.add('on');
    sleepLabelEl.textContent = 'Para no fim da música';
  }

  // Checked right before an automatic track transition would happen.
  // Returns true (and stops playback) if the user asked to stop here.
  function checkSleepAtEnd() {
    if (!sleepAtTrackEnd) return false;
    clearSleepUI();
    fadeOutAndPause(3);
    return true;
  }

  function closeAllPopovers() {
    document.querySelectorAll('.extra-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.extra-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  function togglePopover(btn, menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      closeAllPopovers();
      if (willOpen) {
        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  togglePopover(crossfadeBtn, crossfadeMenu);
  togglePopover(sleepBtn, sleepMenu);
  document.addEventListener('click', closeAllPopovers);
  menuStopPropagation(crossfadeMenu);
  menuStopPropagation(sleepMenu);
  function menuStopPropagation(menu) {
    menu.addEventListener('click', (e) => e.stopPropagation());
  }

  crossfadeMenu.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      crossfadeDuration = parseInt(b.dataset.value, 10);
      localStorage.setItem('plinq_crossfade', String(crossfadeDuration));
      crossfadeLabelEl.textContent = 'Crossfade: ' + (crossfadeDuration === 0 ? 'Desligado' : crossfadeDuration + 's');
      crossfadeBtn.classList.toggle('on', crossfadeDuration > 0);
      resetInactive();
      closeAllPopovers();
    });
  });

  sleepMenu.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.dataset.min;
      if (v === 'off') clearSleepUI();
      else if (v === 'end') setSleepAtTrackEnd();
      else setSleepMinutes(parseInt(v, 10));
      closeAllPopovers();
    });
  });

  // Initialize crossfade label/button to match the persisted setting
  crossfadeLabelEl.textContent = 'Crossfade: ' + (crossfadeDuration === 0 ? 'Desligado' : crossfadeDuration + 's');
  crossfadeBtn.classList.toggle('on', crossfadeDuration > 0);

  // ---- Automatic transition engine (gapless preload / crossfade) ----

  // Instantly swaps which element is "active" — used both by the gapless
  // path (inactive element was already fully buffered ahead of time) and
  // at the end of a crossfade fade.
  function switchActiveTo(newIdx, trackIndex) {
    activeIdx = newIdx;
    currentIndex = trackIndex;
    trackNameEl.textContent = tracks[trackIndex].name;
    trackNameEl.classList.remove('empty');
    gaplessPreloaded = false;
    pendingNextIndex = null;
    renderPlaylist();
    scrollActiveIntoView();
    updateMediaSessionMetadata(tracks[trackIndex]);
  }

  function preloadGapless() {
    if (gaplessPreloaded || repeatOn) return;
    const next = getNextIndex();
    if (next === -1) return;
    pendingNextIndex = next;
    const el = getInactive();
    el.src = tracks[next].url;
    el.preload = 'auto';
    try { el.load(); } catch (e) {}
    gaplessPreloaded = true;
  }

  function startCrossfade() {
    if (transitioning || !audioCtx || !gains) return;
    if (checkSleepAtEnd()) return;
    if (repeatOn) return; // let the plain 'ended' handler loop the same track

    const nextIdx = pendingNextIndex !== null ? pendingNextIndex : getNextIndex();
    if (nextIdx === -1) return;

    transitioning = true;
    if (shuffleOn) shuffleHistory.push(currentIndex);

    const fromGain = getActiveGain();
    const toIdx = 1 - activeIdx;
    const toEl = els[toIdx];
    const toGain = gains[toIdx];
    const track = tracks[nextIdx];

    toEl.src = track.url;
    toEl.currentTime = 0;
    toGain.gain.cancelScheduledValues(audioCtx.currentTime);
    toGain.gain.setValueAtTime(0, audioCtx.currentTime);

    toEl.play().then(() => {
      const now = audioCtx.currentTime;
      const dur = crossfadeDuration;
      fromGain.gain.cancelScheduledValues(now);
      fromGain.gain.setValueAtTime(fromGain.gain.value, now);
      fromGain.gain.linearRampToValueAtTime(0, now + dur);
      toGain.gain.cancelScheduledValues(now);
      toGain.gain.setValueAtTime(0, now);
      toGain.gain.linearRampToValueAtTime(1, now + dur);

      setTimeout(() => {
        const oldEl = els[activeIdx];
        oldEl.pause();
        oldEl.currentTime = 0;
        switchActiveTo(toIdx, nextIdx);
        transitioning = false;
      }, dur * 1000 + 50);
    }).catch(() => {
      transitioning = false;
    });
  }

  function maybePrepareNext(el) {
    if (transitioning || !el.duration || !isFinite(el.duration)) return;
    const remaining = el.duration - el.currentTime;
    if (crossfadeDuration > 0) {
      if (remaining <= crossfadeDuration) startCrossfade();
    } else {
      if (remaining <= 1.2) preloadGapless();
    }
  }

  function onEnded(e) {
    const el = e.currentTarget;
    if (el !== getActive() || transitioning) return;

    if (repeatOn) {
      el.currentTime = 0;
      el.play();
      return;
    }

    if (checkSleepAtEnd()) return;

    if (crossfadeDuration === 0 && gaplessPreloaded && pendingNextIndex !== null) {
      // Next track is already buffered on the inactive element — swap
      // with essentially no gap instead of loading it from scratch.
      const nextIdx = pendingNextIndex;
      const toIdx = 1 - activeIdx;
      const toEl = els[toIdx];
      switchActiveTo(toIdx, nextIdx);
      toEl.currentTime = 0;
      toEl.play().then(() => setPlayingState(true)).catch(() => {});
      return;
    }

    if (shuffleOn) shuffleHistory.push(currentIndex);
    const next = getNextIndex();
    if (next !== -1) {
      loadTrack(next, true);
    } else {
      setPlayingState(false);
    }
  }

  function onLoadedMetadata(e) {
    const el = e.currentTarget;
    if (el !== getActive()) return;
    durationTimeEl.textContent = formatTime(el.duration);
    if (currentIndex !== -1 && tracks[currentIndex]) {
      tracks[currentIndex].duration = el.duration;
      renderPlaylist();
    }
  }

  function onTimeUpdate(e) {
    const el = e.currentTarget;
    if (el !== getActive()) return;
    currentTimeEl.textContent = formatTime(el.currentTime);
    if (el.duration) {
      progressFill.style.width = (el.currentTime / el.duration * 100) + '%';
    }
    updateMediaSessionPosition(el);
    maybePrepareNext(el);
  }

  function onPlay(e) { if (e.currentTarget === getActive()) setPlayingState(true); }
  function onPause(e) { if (e.currentTarget === getActive()) setPlayingState(false); }

  els.forEach(el => {
    el.addEventListener('ended', onEnded);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
  });

  progressWrap.addEventListener('click', (e) => {
    const el = getActive();
    if (!el.duration) return;
    const rect = progressWrap.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    el.currentTime = pct * el.duration;
  });

  volumeSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    els.forEach(el => { el.volume = v; });
  });
  els.forEach(el => { el.volume = parseFloat(volumeSlider.value); });

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

  // ---- Media Session API (controles no SO / lock screen / notificação) ----

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => playBtn.click());
    navigator.mediaSession.setActionHandler('pause', () => playBtn.click());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevBtn.click());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextBtn.click());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) getActive().currentTime = details.seekTime;
    });
  }

  function updateMediaSessionMetadata(track) {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: 'Plinq',
    });
  }

  function updateMediaSessionPosition(el) {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!el.duration || !isFinite(el.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: el.duration,
        playbackRate: el.playbackRate,
        position: el.currentTime,
      });
    } catch (e) {}
  }

  setupMediaSession();
  renderPlaylist();

  // Public bridge used by premium.js (Descobrir tab) to queue remote
  // (Jamendo) tracks into this same player, switching tabs back to Player.
  window.PlinqPlayer = {
    playRemoteTracks(remoteTracks, startIndex) {
      if (!Array.isArray(remoteTracks) || remoteTracks.length === 0) return;
      const base = tracks.length;
      remoteTracks.forEach(rt => {
        tracks.push({ file: null, url: rt.url, name: rt.name, duration: rt.duration || 0 });
      });
      renderPlaylist();
      loadTrack(base + (startIndex || 0), true);
    },

    // Usado pelo persistence.js para adicionar arquivos vindos de
    // File System Access API (mesma validação/ordenação de sempre).
    addFiles(fileList) {
      addFilesToPlaylist(fileList);
    },

    // Usado pelo persistence.js para salvar o estado a cada poucos
    // segundos e ao fechar a aba.
    getState() {
      if (currentIndex === -1 || !tracks[currentIndex]) return null;
      return {
        trackName: tracks[currentIndex].name,
        position: getActive().currentTime || 0,
        volume: parseFloat(volumeSlider.value),
        shuffle: shuffleOn,
        repeat: repeatOn,
      };
    },

    // Usado pelo persistence.js para retomar a sessão anterior.
    restoreState(state) {
      if (!state) return;
      if (typeof state.volume === 'number') {
        volumeSlider.value = String(state.volume);
        els.forEach(el => { el.volume = state.volume; });
      }
      if (state.shuffle) {
        shuffleOn = true;
        shuffleBtn.classList.add('on');
      }
      if (state.repeat) {
        repeatOn = true;
        repeatBtn.classList.add('on');
      }
      if (state.trackName) {
        const idx = tracks.findIndex(t => t.name === state.trackName);
        if (idx !== -1) {
          loadTrack(idx, false);
          const el = getActive();
          const seek = () => {
            el.currentTime = state.position || 0;
            el.removeEventListener('loadedmetadata', seek);
          };
          el.addEventListener('loadedmetadata', seek);
        }
      }
    },
  };
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