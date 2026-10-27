#!/usr/bin/env node
// Testes dos primitivos de segurança do Plinq: CPF, senha, sessão, CORS,
// limite de tentativas e identificação de dono.
//
// Os arquivos de functions/ são ESM mas o package.json da raiz é "commonjs",
// então o Node os recusaria ao importar direto. A solução é copiar só o que
// interessa para uma pasta temporária com {"type":"module"} e importar de lá —
// sem mexer no repositório e sem arriscar o empacotamento do Pages Functions.
//
// Uso: node scripts/test-security.js   (também roda dentro de `npm test`)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const functionsDir = path.join(root, 'functions');

let passed = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FALHA  ${label}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plinq-sec-'));

  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.mkdirSync(path.join(tmp, '_lib'));
    fs.mkdirSync(path.join(tmp, 'api'));
    for (const file of fs.readdirSync(path.join(functionsDir, '_lib'))) {
      if (!file.endsWith('.js')) continue;
      fs.copyFileSync(path.join(functionsDir, '_lib', file), path.join(tmp, '_lib', file));
    }
    fs.copyFileSync(path.join(functionsDir, '_middleware.js'), path.join(tmp, '_middleware.js'));
    fs.copyFileSync(
      path.join(functionsDir, 'api', 'youtube-search.js'),
      path.join(tmp, 'api', 'youtube-search.js')
    );

    const load = (rel) => import(pathToFileURL(path.join(tmp, rel)).href);

    const cpf = await load('_lib/cpf.js');
    const auth = await load('_lib/auth.js');
    const access = await load('_lib/access.js');
    const getSession = await load('_lib/getSession.js');
    const rateLimit = await load('_lib/rateLimit.js');
    const middleware = await load('_middleware.js');
    const youtubeSearch = await load('api/youtube-search.js');

    section('YouTube Data API — validação e player incorporado');
    let response = await youtubeSearch.onRequestGet({
      request: new Request('https://example.test/api/youtube-search?q=x'),
      env: {},
    });
    ok(response.status === 400, 'busca curta é recusada');

    response = await youtubeSearch.onRequestGet({
      request: new Request(`https://example.test/api/youtube-search?q=${'a'.repeat(101)}`),
      env: {},
    });
    ok(response.status === 400, 'busca acima de 100 caracteres é recusada');

    response = await youtubeSearch.onRequestGet({
      request: new Request('https://example.test/api/youtube-search?q=rock'),
      env: {},
    });
    ok(response.status === 503, 'busca sem chave do YouTube informa que falta configurar');

    const originalFetch = global.fetch;
    let requestedUrl;
    global.fetch = async (input) => {
      requestedUrl = new URL(input);
      return new Response(JSON.stringify({
        items: [
          {
            id: { videoId: 'abc123DEF_0' },
            snippet: {
              title: '<title>',
              channelTitle: 'Canal',
              thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc123DEF_0/mqdefault.jpg' } },
            },
          },
          {
            id: { videoId: 'bad' },
            snippet: { title: 'Ignorar', channelTitle: 'Canal' },
          },
        ],
      }), { status: 200 });
    };
    try {
      response = await youtubeSearch.onRequestGet({
        request: new Request('https://example.test/api/youtube-search?q=rock%20brasileiro'),
        env: { YOUTUBE_API_KEY: 'test-key', SUBSCRIPTIONS: {} },
      });
      const body = await response.json();
      ok(response.status === 200 && body.items.length === 1, 'resultados são filtrados e normalizados');
      ok(body.items[0].id === 'abc123DEF_0' && body.items[0].title === '<title>',
        'ID e título são retornados como dados para renderização segura');
      ok(body.items[0].thumbnail.startsWith('https://i.ytimg.com/'),
        'somente thumbnail HTTPS do YouTube é aceita');
      ok(requestedUrl.searchParams.get('videoEmbeddable') === 'true'
        && requestedUrl.searchParams.get('videoSyndicated') === 'true',
      'API retorna apenas vídeos incorporáveis');
      ok(requestedUrl.searchParams.get('key') === 'test-key'
        && requestedUrl.searchParams.get('q') === 'rock brasileiro',
      'chave e consulta são enviados somente ao YouTube');
      ok(!JSON.stringify(body).includes('test-key'), 'chave da API não aparece na resposta ao navegador');
      ok(response.headers.get('Cache-Control') === 'no-store', 'resultado de busca não é cacheado');
    } finally {
      global.fetch = originalFetch;
    }

    // ---------------------------------------------------------- CPF ----------
    section('CPF — validação e hash (base do trial)');

    ok(cpf.isValidCPF('529.982.247-25') === true, 'CPF formatado válido é aceito');
    ok(cpf.isValidCPF('52998224725') === true, 'CPF sem pontuação é aceito');
    ok(cpf.isValidCPF('111.111.111-11') === false, 'sequência repetida é recusada');
    ok(cpf.isValidCPF('529.982.247-24') === false, 'dígito verificador errado é recusado');
    ok(cpf.isValidCPF('1234567890') === false, 'tamanho errado é recusado');
    ok(cpf.isValidCPF('') === false, 'vazio é recusado');
    ok(cpf.isValidCPF(null) === false, 'nulo não lança exceção');
    ok(cpf.isValidCPF(undefined) === false, 'undefined não lança exceção');

    const legacyCpf = await cpf.legacyHashCPF('529.982.247-25');
    ok(
      legacyCpf === 'f5ef2b7f458026cc6643d78cb8d6f9cc59646b84bafd9b629c7546714a81de16',
      'hash legado fixo — quebrar aqui deixaria CPF antigo liberar um 2º trial'
    );
    ok((await cpf.hashCPF('52998224725')) === legacyCpf, 'hashCPF sem cai no formato legado');

    const peppered1 = await cpf.hashCPF('52998224725', 'pimenta-1');
    const peppered2 = await cpf.hashCPF('52998224725', 'pimenta-2');
    ok(peppered1.startsWith('hmac:'), 'hash com pimenta usa prefixo hmac:');
    ok(peppered1 !== peppered2, 'pimentas diferentes geram hashes diferentes');
    ok(peppered1 !== legacyCpf, 'hash com pimenta difere do legado');
    ok((await cpf.hashCPF('529.982.247-25', 'pimenta-1')) === peppered1, 'formatação não muda o hash');
    ok((await cpf.hashCPF('52998224725', '')) === legacyCpf, 'pimenta vazia cai no legado');

    // --------------------------------------------------------- Senha ---------
    section('Senha — PBKDF2 legado e v2');

    const legacyHash = await auth.hashPassword('senha-teste-123');
    ok(/^[0-9a-f]+:[0-9a-f]+$/.test(legacyHash), 'formato legado salt:hash');
    ok(await auth.verifyPassword('senha-teste-123', legacyHash) === true, 'legado: senha certa é aceita');
    ok(await auth.verifyPassword('senha-errada', legacyHash) === false, 'legado: senha errada é recusada');

    const v2 = await auth.hashPasswordV2('senha-teste-123');
    ok(v2.startsWith(`p2$${auth.PBKDF2_ITERATIONS}$`), `novo formato registra ${auth.PBKDF2_ITERATIONS} iterações`);
    ok(await auth.verifyPassword('senha-teste-123', v2) === true, 'v2: senha certa é aceita');
    ok(await auth.verifyPassword('senha-errada', v2) === false, 'v2: senha errada é recusada');
    ok(v2 !== (await auth.hashPasswordV2('senha-teste-123')), 'sal aleatório: mesma senha, hashes diferentes');
    ok(auth.PBKDF2_ITERATIONS > auth.LEGACY_ITERATIONS, 'v2 é mais custoso que o legado');

    ok(await auth.verifyPassword('x', 'sem-separador') === false, 'hash malformado é recusado sem exceção');
    ok(await auth.verifyPassword('x', 'abc:def') === false, 'hash legado corrompido é recusado');
    ok(await auth.verifyPassword('x', 'p2$nao-numero$salt$hash') === false, 'iterações não-numéricas recusadas');
    ok(await auth.verifyPassword('x', 'p2$99999999$a$b') === false, 'iterações acima do limite recusadas');
    ok(await auth.verifyPassword('x', 'p2$999$a$b') === false, 'iterações abaixo do limite recusadas');
    ok(await auth.verifyPassword('x', 'p2$1000000$a$b$c') === false, 'partes a mais recusadas');
    ok(await auth.verifyPassword('x', null) === false, 'hash nulo recusado');
    ok(await auth.verifyPassword('x', undefined) === false, 'hash undefined recusado');
    ok(await auth.verifyPassword(null, v2) === false, 'senha nula recusada');
    ok(await auth.verifyPassword('', v2) === false, 'senha vazia recusada');

    // -------------------------------------------------- timingSafeEqual ------
    section('timingSafeEqual — comparação sem vazamento por tempo');

    ok(auth.timingSafeEqual('abc', 'abc') === true, 'iguais retorna true');
    ok(auth.timingSafeEqual('abc', 'abd') === false, 'diferentes retorna false');
    ok(auth.timingSafeEqual('abc', 'abcd') === false, 'tamanhos diferentes retorna false');
    ok(auth.timingSafeEqual('a'.repeat(5000), 'a'.repeat(5000)) === true, 'string longa compara certo');
    ok(auth.timingSafeEqual('', '') === true, 'duas vazias são iguais');
    ok(auth.timingSafeEqual('abc', '') === false, 'vazia vs não-vazia é false');
    ok(auth.timingSafeEqual(null, null) === false, 'nulo não lança exceção');
    ok(auth.timingSafeEqual('a', undefined) === false, 'undefined não lança exceção');
    ok(auth.timingSafeEqual(1234, 1234) === false, 'não-string é recusado');

    // ---------------------------------------------------------- Sessão -------
    section('Sessão — JWT com HMAC');

    let threw = false;
    try {
      await auth.createSessionToken({ sub: 'u1' }, undefined);
    } catch {
      threw = true;
    }
    ok(threw, 'criar sessão sem AUTH_SECRET lança erro (configuração ausente não vira sessão aberta)');

    threw = false;
    try {
      await auth.createSessionToken({ sub: 'u1' }, '');
    } catch {
      threw = true;
    }
    ok(threw, 'criar sessão com segredo vazio lança erro');

    const secret = 'segredo-de-teste';
    const token = await auth.createSessionToken({ sub: 'u1', email: 'a@b.c' }, secret);
    const payload = await auth.verifySessionToken(token, secret);
    ok(payload && payload.sub === 'u1', 'sessão válida é aceita');
    ok(payload && payload.email === 'a@b.c', 'payload é decodificado por inteiro');
    ok(payload && typeof payload.exp === 'number', 'token carrega expiração');

    ok(await auth.verifySessionToken(token, 'segredo-diferente') === null, 'segredo errado rejeita o token');

    const [h, b, s] = token.split('.');
    const tamperedPayload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    tamperedPayload.sub = 'plinq-owner';
    const forged = `${h}.${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${s}`;
    ok(await auth.verifySessionToken(forged, secret) === null, 'payload adulterado é rejeitado');

    const forgedSig = `${h}.${b}.${'A'.repeat(43)}`;
    ok(await auth.verifySessionToken(forgedSig, secret) === null, 'assinatura forjada é rejeitada');

    ok(await auth.verifySessionToken(token, '') === null, 'sem segredo nenhuma sessão vale');
    ok(await auth.verifySessionToken(token, undefined) === null, 'segredo undefined não lança exceção');

    const expired = await auth.createSessionToken({ sub: 'u1' }, secret, -60);
    ok(await auth.verifySessionToken(expired, secret) === null, 'sessão expirada é rejeitada');

    const noSub = await auth.createSessionToken({ email: 'a@b.c' }, secret);
    ok(await auth.verifySessionToken(noSub, secret) === null, 'token sem sub é rejeitado');

    ok(await auth.verifySessionToken('', secret) === null, 'token vazio é rejeitado');
    ok(await auth.verifySessionToken('sem.pontos', secret) === null, 'token com formato errado é rejeitado');
    ok(await auth.verifySessionToken(null, secret) === null, 'token nulo não lança exceção');

    // Corpo assinado corretamente mas que não é JSON: tem que voltar null,
    // nunca estourar exceção (que viraria 500 na rota inteira).
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const bodyB64 = Buffer.from('isto nao e um json').toString('base64url');
    const signedGarbage = `${headerB64}.${bodyB64}`;
    const garbageSig = crypto.createHmac('sha256', secret).update(signedGarbage).digest('base64url');
    threw = false;
    let garbageResult = 'nao-rodou';
    try {
      garbageResult = await auth.verifySessionToken(`${signedGarbage}.${garbageSig}`, secret);
    } catch {
      threw = true;
    }
    ok(threw === false, 'corpo assinado porém não-JSON não lança exceção');
    ok(garbageResult === null, 'corpo assinado porém não-JSON é rejeitado');

    // -------------------------------------------------------- Cookie session -
    section('Sessão web — cookie HttpOnly');

    const webToken = await auth.createSessionToken({ sub: 'web-user', email: 'web@example.test' }, secret);
    const cookieSession = await getSession.getUserFromRequest(
      new Request('https://example.test/api/me', { headers: { Cookie: `plinq_session=${webToken}` } }),
      { AUTH_SECRET: secret }
    );
    ok(cookieSession && cookieSession.id === 'web-user', 'sessão PWA é lida do cookie HttpOnly');

    const bearerSession = await getSession.getUserFromRequest(
      new Request('https://example.test/api/me', { headers: { Authorization: `Bearer ${webToken}` } }),
      { AUTH_SECRET: secret }
    );
    ok(bearerSession === null, 'token Bearer de app nativo não é mais aceito');

    // ----------------------------------------------------------- Dono --------
    section('Dono');

    ok(access.normalizeEmail('  MAURO@Exemplo.COM ') === 'mauRO@exemplo.com'.toLowerCase(), 'normalizeEmail normaliza');
    ok(access.isOwner({ email: 'dono@x.com' }, { PLINQ_OWNER_EMAIL: 'DONO@X.COM' }) === true, 'dono é reconhecido');
    ok(access.isOwner({ email: 'outro@x.com' }, { PLINQ_OWNER_EMAIL: 'dono@x.com' }) === false, 'não-dono é recusado');
    ok(access.isOwner({}, { PLINQ_OWNER_EMAIL: 'dono@x.com' }) === false, 'sessão sem email é recusada');
    ok(access.isOwner({ email: 'a@b.c' }, {}) === false, 'sem dono configurado é recusado');
    ok(access.isOwner(null, null) === false, 'entradas nulas não lançam exceção');

    // --------------------------------------------------- Limite de tentativas -
    section('Limite de tentativas (login/cadastro)');

    const makeKV = () => {
      const store = new Map();
      return {
        store,
        async get(key, opts) {
          const value = store.get(key);
          if (value === undefined) return null;
          return opts && opts.type === 'json' ? JSON.parse(value) : value;
        },
        async put(key, value) {
          store.set(key, value);
        },
      };
    };

    const reqIp = (ip) => new Request('https://example.test/api/auth-login', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
    });

    const rlOpts = { name: 'login', limit: 3, windowSec: 300 };

    const env1 = { SUBSCRIPTIONS: makeKV() };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await rateLimit.checkRateLimit(reqIp('10.0.0.1'), env1, rlOpts));
    ok(results[0].ok && results[1].ok && results[2].ok, 'primeiras tentativas passam');
    ok(results[3].ok === false, '4ª tentativa no mesmo IP é bloqueada');
    ok(results[4].ok === false, 'bloqueio continua na 5ª tentativa');
    ok(results[3].retryAfter > 0, 'resposta traz tempo de espera');

    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.2'), env1, rlOpts)).ok === true, 'outro IP não é afetado');
    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.1'), env1, { name: 'register', limit: 3, windowSec: 3600 })).ok === true,
      'outra rota tem contagem separada');

    const envNoKV = {};
    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.1'), envNoKV, rlOpts)).ok === true,
      'sem KV o limite falha aberto (login não pode cair por indisponibilidade)');

    const envBrokenKV = { SUBSCRIPTIONS: { async get() { throw new Error('kv fora'); }, async put() { throw new Error('kv fora'); } } };
    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.1'), envBrokenKV, rlOpts)).ok === true,
      'KV quebrado não derruba a rota');

    ok((await rateLimit.checkRateLimit(reqIp(''), env1, rlOpts)).ok === true, 'sem IP identificável não bloqueia');

    // Janela expirada zera a contagem.
    const envExp = { SUBSCRIPTIONS: makeKV() };
    const key = 'rl:login:10.0.0.9';
    envExp.SUBSCRIPTIONS.store.set(key, JSON.stringify({ count: 99, resetAt: Date.now() - 1000 }));
    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.9'), envExp, rlOpts)).ok === true,
      'contagem de janela vencida é reiniciada');

    // Registro corrupto no KV não pode travar o login.
    const envCorrupt = { SUBSCRIPTIONS: makeKV() };
    envCorrupt.SUBSCRIPTIONS.store.set('rl:login:10.0.0.8', 'nao-e-json');
    ok((await rateLimit.checkRateLimit(reqIp('10.0.0.8'), envCorrupt, rlOpts)).ok === true,
      'registro corrompido no KV é ignorado');

    ok(rateLimit.clientIp(new Request('https://x/y', { headers: { 'CF-Connecting-IP': ' 1.2.3.4 ' } })) === '1.2.3.4',
      'IP vem do CF-Connecting-IP');
    ok(rateLimit.clientIp(new Request('https://x/y', { headers: { 'X-Forwarded-For': '9.9.9.9, 10.10.10.10' } })) === '9.9.9.9',
      'fallback usa o primeiro X-Forwarded-For');

    // ------------------------------------------------------- Middleware -------
    section('Middleware — CORS, cache e rejeição de origem');

    const next = async () => new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    const run = (request) => middleware.onRequest({ request, next });

    let res = await run(new Request('https://example.test/api/a', {
      headers: { Origin: 'https://plinq-music-player.pages.dev' },
    }));
    ok(res.status === 200, 'origem do Pages é permitida');
    ok(res.headers.get('Access-Control-Allow-Origin') === 'https://plinq-music-player.pages.dev',
      'ACAO devolve a origem exata');
    ok(res.headers.get('Vary') === 'Origin', 'Vary: Origin para não misturar cache');
    ok(res.headers.get('Cache-Control') === 'no-store', 'toda resposta de API é no-store');
    ok(res.headers.get('X-Content-Type-Options') === 'nosniff', 'toda resposta traz nosniff');

    res = await run(new Request('https://example.test/api/a', {
      headers: { Origin: 'https://plinq.orderly.tec.br' },
    }));
    ok(res.status === 200, 'domínio principal é permitido (sem ele o login dele seria barrado)');
    ok(res.headers.get('Access-Control-Allow-Origin') === 'https://plinq.orderly.tec.br',
      'ACAO do domínio principal');

    res = await run(new Request('https://example.test/api/a', { headers: { Origin: 'https://evil.example' } }));
    ok(res.status === 403, 'origem desconhecida recebe 403');
    ok(res.headers.get('Access-Control-Allow-Origin') === null, 'origem desconhecida não ganha CORS');

    res = await run(new Request('https://example.test/api/a'));
    ok(res.status === 200, 'requisição same-origin sem Origin segue normal');
    ok(res.headers.get('Cache-Control') === 'no-store', 'resposta sem Origin também é no-store');

    res = await run(new Request('https://example.test/api/a', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://plinq-music-player.pages.dev',
        'Access-Control-Request-Method': 'POST',
      },
    }));
    ok(res.status === 204, 'preflight responde 204');
    ok(res.headers.get('Access-Control-Allow-Methods') === 'GET, POST, OPTIONS', 'preflight declara os métodos');
    ok(res.headers.get('Cache-Control') === 'no-store', 'preflight também é no-store');

    res = await run(new Request('https://example.test/api/a', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }));
    ok(res.status === 403, 'preflight de origem ruim também recebe 403');

    // O corpo do next() tem que passar adiante.
    res = await run(new Request('https://example.test/api/a'));
    ok(await res.text() === 'ok', 'corpo da resposta original é preservado');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('');
  if (failures.length) {
    console.error(`Testes de segurança: ${failures.length} falha(s), ${passed} ok.`);
    process.exit(1);
  }
  console.log(`Testes de segurança: ${passed} asserções, 0 falhas.`);
}

main().catch((err) => {
  console.error('Erro inesperado nos testes de segurança:\n', err);
  process.exit(1);
});
