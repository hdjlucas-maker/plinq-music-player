// Teste de fumaça do Plinq via Chrome DevTools Protocol.
// Sobe um servidor estático local, abre o player no Chrome headless e verifica:
// ausência do gate global, navegação de abas, modal de auth (abrir/foco/Escape),
// carregamento de faixas, durações, crossfade e atributos de acessibilidade.
//
// Uso: npm run smoke   (não precisa de servidor pré-existente)
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const HTTP_PORT = Number(process.env.PORT || 8099);
const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const EXTERNAL_URL = process.env.TARGET_URL || null;
const URL = EXTERNAL_URL || `http://127.0.0.1:${HTTP_PORT}/`;
const PROFILE = '/tmp/plinq-chrome-profile';
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Servidor estático mínimo — evita depender de um `python3 -m http.server`
// rodando à mão antes do teste.
function startStaticServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new globalThis.URL(req.url || '/', URL);
    const urlPath = decodeURIComponent(requestUrl.pathname);
    if (urlPath === '/api/youtube-search') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({
        items: [{
          id: 'abc123DEF_0',
          title: 'Resultado de teste do YouTube',
          channel: 'Canal de teste',
          thumbnail: 'https://i.ytimg.com/vi/abc123DEF_0/mqdefault.jpg',
        }],
      }));
      return;
    }
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server));
  });
}

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      execSync(`command -v ${bin}`, { stdio: 'ignore', shell: '/bin/bash' });
      return bin;
    } catch {}
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let audioDir = null;

function createWavFixture(filePath, frequency) {
  const sampleRate = 8000;
  const seconds = 6;
  const channels = 1;
  const bitsPerSample = 16;
  const samples = sampleRate * seconds;
  const dataSize = samples * channels * bitsPerSample / 8;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  wav.writeUInt16LE(channels * bitsPerSample / 8, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.15;
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, wav);
}

function createAudioFixtures() {
  audioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plinq-audio-'));
  createWavFixture(path.join(audioDir, 'track-a.wav'), 440);
  createWavFixture(path.join(audioDir, 'track-b.wav'), 660);
}

function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function getJson(pathname) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}${pathname}`);
  return res.json();
}

async function waitForPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJson('/json/list');
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error('Chrome page target não apareceu');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        return new Promise((res, rej) => {
          const msgId = ++id;
          pending.set(msgId, { res, rej });
          ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
          setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); rej(new Error(`timeout: ${method}`)); } }, 20000);
        });
      },
      close() { try { ws.close(); } catch {} },
    });
    ws.onerror = (e) => reject(e);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(`${msg.error.message}`));
        else res(msg.result);
      }
    };
  });
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  createAudioFixtures();

  const chromeBin = findChrome();
  if (!chromeBin) {
    throw new Error('Nenhum Chrome/Chromium encontrado. Defina CHROME_BIN com o caminho do executável.');
  }

  let server = null;
  if (!EXTERNAL_URL) {
    try {
      server = await startStaticServer();
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        throw new Error(`Porta ${HTTP_PORT} já em uso. Rode com PORT=<outra porta> ou feque o processo que a ocupa.`);
      }
      throw err;
    }
    console.log(`Servidor local em ${URL}\n`);
  }

  const chrome = spawn(chromeBin, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    URL,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d.toString(); });

  try {
    const page = await waitForPage();
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    const ev = async (expr) => {
      const r = await cdp.send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.value || ''));
      return r.result.value;
    };

    // espera a página carregar
    for (let i = 0; i < 40; i++) {
      const ready = await ev('document.readyState');
      const hasPlayer = await ev('!!document.getElementById("play-btn")');
      if (ready === 'complete' && hasPlayer) break;
      await sleep(250);
    }

    // --- T1: gate global ausente ---
    await sleep(600);
    const manifestPresent = await ev('!!document.querySelector(\'link[rel="manifest"]\')');
    ok('T0 manifesto PWA declarado', manifestPresent);
    const installButtonVisible = await ev('(() => { const b = document.getElementById("pwa-install-btn"); return !!b && getComputedStyle(b).display !== "none"; })()');
    ok('T0d botão de instalação PWA disponível', installButtonVisible);
    const pwaIcons = JSON.parse(await ev(`(async () => {
      const manifest = await (await fetch('manifest.webmanifest')).json();
      const urls = manifest.icons.map(icon => icon.src);
      return JSON.stringify({
        androidIcons: urls.includes('pwa-icon-192.png') && urls.includes('pwa-icon-512.png'),
        appleIcon: !!document.querySelector('link[rel="apple-touch-icon"][href="apple-touch-icon.png"]'),
        appleIconAvailable: (await fetch('apple-touch-icon.png')).ok,
      });
    })()`));
    ok('T0a manifesto oferece ícones PWA 192 e 512', pwaIcons.androidIcons);
    ok('T0b ícone Apple Touch disponível', pwaIcons.appleIcon && pwaIcons.appleIconAvailable);
    const pwaCacheState = JSON.parse(await ev(`(async () => {
      let registration = null;
      for (let i = 0; i < 20; i++) {
        registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const cache = await caches.open('plinq-pwa-shell-v2');
      const paths = (await cache.keys()).map(request => new URL(request.url).pathname);
      const worker = registration && (registration.active || registration.installing || registration.waiting);
      return JSON.stringify({
        registered: !!(registration && registration.active
          && new URL(registration.active.scriptURL).pathname.endsWith('/service-worker.js')),
        state: worker ? worker.state : 'not registered',
        shellCached: paths.some(path => path.endsWith('/index.html'))
          && paths.some(path => path.endsWith('/script.js'))
          && paths.some(path => path.endsWith('/discover.js'))
          && paths.some(path => path.endsWith('/privacy.html'))
          && paths.some(path => path.endsWith('/pwa-icon-192.png'))
          && paths.some(path => path.endsWith('/pwa-icon-512.png')),
        apiOrAudioCached: paths.some(path => path.includes('/api/') || /\\.(mp3|wav|flac|m4a|ogg)$/i.test(path)),
      });
    })()`));
    ok('T0b PWA registra service worker e shell offline',
      pwaCacheState.registered && pwaCacheState.shellCached,
      JSON.stringify(pwaCacheState));
    ok('T0c PWA não guarda API ou faixas no cache', !pwaCacheState.apiOrAudioCached);

    const gateCount = await ev('document.querySelectorAll("#account-gate-overlay").length');
    ok('T1 gate global removido', gateCount === 0, `overlays=${gateCount}`);

    const gateScript = await ev('!!document.querySelector(\'script[src="account-gate.js"]\')');
    ok('T1b account-gate.js não carregado', gateScript === false);

    // --- T2: aba Player ativa e utilizável ---
    const playerVisible = await ev('getComputedStyle(document.getElementById("tab-player")).display !== "none"');
    ok('T2 aba Player visível sem login', playerVisible);

    const bodyOverflow = await ev('getComputedStyle(document.body).overflow');
    ok('T2b body não travado', bodyOverflow !== 'hidden', `overflow=${bodyOverflow}`);

    // --- T3: adicionar faixas sem conta ---
    const doc = await cdp.send('DOM.getDocument');
    const fileNode = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '#file-input',
    });
    await cdp.send('DOM.setFileInputFiles', {
      nodeId: fileNode.nodeId,
      files: [path.join(audioDir, 'track-a.wav'), path.join(audioDir, 'track-b.wav')],
    });
    await ev('document.getElementById("file-input").dispatchEvent(new Event("change", {bubbles:true}))');
    await sleep(1500);

    const trackCount = await ev('document.querySelectorAll("#playlist li").length');
    ok('T3 player carrega faixas sem conta', trackCount === 2, `tracks=${trackCount}`);

    const durations = await ev('Array.from(document.querySelectorAll("#playlist li .t-dur")).map(e=>e.textContent)');
    ok('T3b durações renderizadas', Array.isArray(durations) && durations.every(d => d !== '--:--'), `dur=${JSON.stringify(durations)}`);

    const trackName = await ev('document.getElementById("track-name").textContent');
    ok('T3c nome da faixa ativa', trackName && trackName !== 'Nenhuma música carregada', `name=${trackName}`);

    // --- T4: crossfade / transição de faixa ---
    // Instala um log de rejeição de play() e um rastreio de eventos dos dois
    // elementos <audio>, para diagnosticar falhas de transição.
    await ev(`(() => {
      const orig = HTMLMediaElement.prototype.play;
      window.__playErr = [];
      HTMLMediaElement.prototype.play = function () {
        const p = orig.call(this);
        p.catch((e) => window.__playErr.push(this.id + ':' + e.name + ':' + (e.message || '')));
        return p;
      };
      window.__ev = [];
      window.__t0 = performance.now();
      ['audio-el', 'audio-el-2'].forEach((id) => {
        const el = document.getElementById(id);
        ['play', 'pause', 'ended', 'loadedmetadata', 'emptied', 'abort', 'error', 'waiting', 'stalled'].forEach((type) => {
          el.addEventListener(type, () => window.__ev.push({
            el: id, type,
            at: +((performance.now() - window.__t0) / 1000).toFixed(2),
            ct: +el.currentTime.toFixed(2),
            ti: el.dataset.trackIndex,
          }));
        });
      });
      return true;
    })()`);

    await ev('document.getElementById("crossfade-btn").click()');
    await sleep(200);
    await ev('document.querySelector(\'#crossfade-menu button[data-value="3"]\').click()');
    await sleep(200);

    await ev('window.__t0 = performance.now(); document.getElementById("play-btn").click()');
    await sleep(700);

    const playingEarly = await ev('document.getElementById("play-btn").getAttribute("title")');
    ok('T4 play inicia reprodução', playingEarly === 'Pausar', `title=${playingEarly}`);

    // Amostra o estado ao longo do tempo para capturar onde a transição falha.
    const timeline = [];
    for (let i = 0; i < 12; i++) {
      await sleep(1000);
      const s = await ev(`(() => {
        const a = document.getElementById('audio-el');
        const b = document.getElementById('audio-el-2');
        const li = Array.from(document.querySelectorAll('#playlist li'));
        return JSON.stringify({
          at: +((performance.now() - window.__t0) / 1000).toFixed(2),
          t: li.findIndex(e => e.classList.contains('active')),
          btn: document.getElementById('play-btn').getAttribute('title'),
          A: a.paused ? 'p' : (+a.currentTime.toFixed(1)),
          B: b.paused ? 'p' : (+b.currentTime.toFixed(1)),
          err: window.__playErr.length,
        });
      })()`);
      timeline.push(JSON.parse(s));
    }

    const titleAfter = await ev('document.getElementById("play-btn").getAttribute("title")');
    const activeIndex = await ev('Array.from(document.querySelectorAll("#playlist li")).findIndex(e=>e.classList.contains("active"))');
    const durationsAfter = await ev('Array.from(document.querySelectorAll("#playlist li .t-dur")).map(e=>e.textContent)');
    const playErrors = await ev('window.__playErr');

    // Primeiro instante em que a segunda faixa vira a ativa.
    const switchSample = timeline.find((s) => s.t === 1);
    const playingWhileOnTrack1 = timeline.filter((s) => s.t === 1 && s.btn === 'Pausar');
    ok('T4b crossfade troca para a faixa seguinte', !!switchSample, `amostros=${JSON.stringify(timeline)}`);
    ok('T4b1 player segue em reprodução na faixa seguinte',
      playingWhileOnTrack1.length > 0,
      switchSample ? `amostras tocando na faixa 1=${playingWhileOnTrack1.length}` : 'não trocou');
    ok('T4c durações seguem válidas após transição', durationsAfter.every(d => d !== '--:--'), `dur=${JSON.stringify(durationsAfter)}`);
    ok('T4d faixa ativa avançou durante o teste', timeline.some((s) => s.t === 1), `active final=${activeIndex}`);
    ok('T4e nenhuma chamada play() rejeitada', !playErrors || playErrors.length === 0,
      playErrors && playErrors.length ? JSON.stringify(playErrors) : '');
    console.log('      crossfade-label: ' + await ev('document.getElementById("crossfade-label").textContent'));
    console.log('      timeline: ' + JSON.stringify(timeline));
    const evlog = await ev('window.__ev');
    console.log('      eventos: ' + JSON.stringify(evlog));

    // --- T5: abas ---
    await ev('document.getElementById("tab-btn-discover").click()');
    await sleep(1200);
    const discoverVisible = await ev('getComputedStyle(document.getElementById("tab-discover")).display !== "none"');
    const searchVisible = await ev('getComputedStyle(document.getElementById("youtube-search-form")).display !== "none"');
    ok('T5 busca online está disponível sem conta ou pagamento', discoverVisible && searchVisible);

    await ev('document.getElementById("youtube-search-query").value = "rock brasileiro"; document.getElementById("youtube-search-form").requestSubmit()');
    await sleep(300);
    const resultTitle = await ev('document.querySelector("#youtube-results h3")?.textContent || ""');
    ok('T6 busca online renderiza resultados', resultTitle === 'Resultado de teste do YouTube', resultTitle);
    await ev('document.querySelector("#youtube-results button").click()');
    const youtubeFrame = await ev('document.getElementById("youtube-player").getAttribute("src")');
    ok('T6b seleção usa o player oficial com controles', youtubeFrame.includes('www.youtube.com/embed/abc123DEF_0')
      && youtubeFrame.includes('controls=1'));
    await ev('document.getElementById("tab-btn-player").click()');
    const stoppedFrame = await ev('document.getElementById("youtube-player").hasAttribute("src")');
    ok('T6c player YouTube para ao sair da aba', stoppedFrame === false);

    // --- T7: scroll/foco por teclado no progresso ---
    const progressAttrs = await ev(`(() => { const p = document.getElementById('progress-wrap'); return {
      role: p.getAttribute('role'), tab: p.getAttribute('tabindex'),
      now: p.getAttribute('aria-valuenow'), text: p.getAttribute('aria-valuetext') } })()`);
    ok('T7 progresso acessível (role/tabindex/aria)',
      progressAttrs.role === 'slider' && progressAttrs.tab === '0' && progressAttrs.text,
      JSON.stringify(progressAttrs));

    // --- T8: headers de segurança do repositório ---
    ok('T8 _headers presente no repositório', fs.existsSync(path.join(ROOT, '_headers')));
    ok('T8b .assetsignore presente', fs.existsSync(path.join(ROOT, '.assetsignore')));

  } finally {
    try { chrome.kill('SIGKILL'); } catch {}
    if (server) await new Promise((r) => server.close(r));
    if (audioDir) fs.rmSync(audioDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
  if (failed.length) {
    console.log('Falhas:\n' + failed.map((f) => `  - ${f.name}: ${f.detail}`).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('ERRO NO TESTE:', e.message);
  process.exitCode = 1;
});
