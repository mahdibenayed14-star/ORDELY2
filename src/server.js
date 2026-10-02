import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { OrderEngine, clone } from '../public/assets/order-engine.js';
import { BaarchaSTT, DeepgramSTT, streamSpeech, streamSpeechBaarcha, streamSpeechAzure, BAARCHA_SIGNUP_URL } from './providers.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Fournisseurs réellement utilisables avec les variables d'environnement fournies. */
export function resolveProviders(env = {}) {
  const has = name => !!(env[name] && String(env[name]).trim());
  const wanted = {
    tts: String(env.TTS_PROVIDER || '').trim().toLowerCase(),
    stt: String(env.STT_PROVIDER || '').trim().toLowerCase()
  };
  const candidates = {
    tts: [
      ['baarcha', has('BAARCHA_API_KEY')],
      ['azure', has('AZURE_SPEECH_KEY')],
      ['elevenlabs', has('ELEVENLABS_API_KEY') && has('ELEVENLABS_VOICE_ID')]
    ],
    stt: [
      ['baarcha', has('BAARCHA_API_KEY')],
      ['deepgram', has('DEEPGRAM_API_KEY')]
    ]
  };
  const pick = kind => {
    const available = candidates[kind].filter(([, ok]) => ok).map(([name]) => name);
    if (wanted[kind]) return available.includes(wanted[kind]) ? wanted[kind] : null;
    return available[0] || null;
  };
  const tts = pick('tts'), stt = pick('stt');
  return {
    tts, stt,
    voice: !!tts,                     // voix tunisienne du serveur, reconnaissance du navigateur
    streaming: !!tts && !!stt,        // chaîne complète côté serveur
    requestedButMissing: {
      tts: wanted.tts && !tts ? wanted.tts : null,
      stt: wanted.stt && !stt ? wanted.stt : null
    }
  };
}

export function createOrdelyServer({ env = process.env, dataFile, seed, sttFactory, tts: ttsOverride } = {}) {
  const databasePath = dataFile || path.resolve(ROOT, env.DATA_FILE || 'data/database.json');
  const demoSeed = seed || JSON.parse(fs.readFileSync(path.join(ROOT, 'public/demo-data.json'), 'utf8'));
  const database = fs.existsSync(databasePath) ? JSON.parse(fs.readFileSync(databasePath, 'utf8')) : clone(demoSeed);
  const engine = new OrderEngine(database);
  const persist = () => {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(`${databasePath}.tmp`, JSON.stringify(engine.db, null, 2));
    fs.renameSync(`${databasePath}.tmp`, databasePath);
  };
  const providers = resolveProviders(env);
  const demoReset = env.ENABLE_DEMO_RESET !== 'false';

  /* Cache disque de la voix : une phrase déjà rendue est rejouée sans consommer
     de crédit et sans dépendre du réseau. Le dossier suit la base de démonstration. */
  const cacheDir = path.resolve(ROOT, env.TTS_CACHE_DIR || path.join(path.dirname(databasePath), 'tts-cache'));
  const cacheEnabled = env.TTS_CACHE !== 'false' && providers.voice;
  const cacheKey = (text, language) => createHash('sha256')
    .update(`${providers.tts}|${env.BAARCHA_VOICE_ID || env.AZURE_VOICE || env.ELEVENLABS_VOICE_ID || 'default'}|${language}|${text}`)
    .digest('hex');
  const readCache = hash => {
    if (!cacheEnabled) return null;
    try { const file = path.join(cacheDir, `${hash}.pcm`); return fs.existsSync(file) ? fs.readFileSync(file) : null; } catch { return null; }
  };
  const writeCache = (hash, pcm) => {
    if (!cacheEnabled || !pcm?.length) return;
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, `${hash}.tmp`), pcm);
      fs.renameSync(path.join(cacheDir, `${hash}.tmp`), path.join(cacheDir, `${hash}.pcm`));
    } catch { /* cache best-effort : jamais bloquant */ }
  };

  const engines = {
    baarcha: options => streamSpeechBaarcha({
      ...options, key: env.BAARCHA_API_KEY, voiceId: env.BAARCHA_VOICE_ID || undefined,
      baseURL: env.BAARCHA_BASE_URL || undefined
    }),
    azure: options => streamSpeechAzure({
      ...options, key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION || 'westeurope',
      voiceId: env.AZURE_VOICE || undefined
    }),
    elevenlabs: options => streamSpeech({ ...options, key: env.ELEVENLABS_API_KEY, voiceId: env.ELEVENLABS_VOICE_ID })
  };
  const tts = ttsOverride || (providers.tts ? engines[providers.tts] : null);

  const app = express(), server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
    res.setHeader('Cache-Control', 'no-cache'); next();
  });
  app.use(express.json({ limit: '4kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, version: '11.1.0', mode: modeLabel(providers), engines: { stt: providers.stt, tts: providers.tts } }));
  app.get('/api/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ version: '11.1.0', backend: true, voicePath: 'voice', demo: true, demoReset,
      engines: { stt: providers.stt, tts: providers.tts },
      modes: { browser: true, voice: providers.voice, streaming: providers.streaming },
      ttsCache: cacheEnabled && fs.existsSync(cacheDir),
      signup: providers.tts === 'baarcha' || providers.stt === 'baarcha' ? BAARCHA_SIGNUP_URL : null,
      streamMaxMinutes: Math.max(1, Math.min(30, Number(env.STREAM_MAX_MINUTES) || 10)) });
  });
  app.get('/api/orders', (_req, res) => res.json(engine.list()));
  app.get('/api/orders/:id', (req, res) => { try { res.json(engine.view(req.params.id)); } catch { res.status(404).json({ error: 'Commande inconnue.' }); } });
  function allowedOrigin(req) {
    if (!req.headers.origin) return true; // clients CLI / tests ; ce n'est pas une authentification
    try {
      const origin = new URL(req.headers.origin);
      const host = String(req.headers['x-forwarded-host'] || req.headers.host).split(',')[0].trim();
      if (origin.host === host && ['http:', 'https:'].includes(origin.protocol)) return true;
      // Derrière un hébergeur ou un aperçu proxyfié (Render, bac à sable), l'origine publique
      // peut être réécrite : on s'appuie alors sur l'accès protégé du proxy.
      return !!(req.headers['x-forwarded-host'] || req.headers['x-forwarded-proto'] || req.headers.forwarded);
    } catch { return false; }
  }
  app.post('/api/demo/reset', (req, res) => {
    if (!demoReset) return res.status(403).json({ error: 'Réinitialisation désactivée.' });
    if (!allowedOrigin(req)) return res.status(403).json({ error: 'Origine refusée.' });
    try {
      engine.db = clone(demoSeed); persist();
      for (const ws of wss.clients) ws.close(4008, 'Demo reset');
      res.json({ ok: true, orders: engine.list() });
    } catch { res.status(500).json({ error: 'Impossible de réinitialiser la démo.' }); }
  });
  app.use('/telephone', express.static(path.join(ROOT, 'telephone'), { etag: true, dotfiles: 'deny' }));
  app.use(express.static(path.join(ROOT, 'public'), { etag: true, dotfiles: 'deny' }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API inconnue.' }));
  app.use((error, _req, res, _next) => res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'Requête invalide.' }));
  const connections = new Map();
  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://local').pathname; } catch { socket.destroy(); return; }
    const ip = req.socket.remoteAddress || 'unknown';
    if (pathname !== '/voice' || !allowedOrigin(req)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    if ((connections.get(ip) || 0) >= 4 || wss.clients.size >= 64) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => { ws.clientIP = ip; connections.set(ip, (connections.get(ip) || 0) + 1); wss.emit('connection', ws, req); });
  });
  wss.on('connection', ws => {
    let session = null, stt = null, starting = false, audioController = null, responseId = null, audioCounter = 0, streamTimer;
    let wantsAudio = true, closed = false, textCount = 0, countStart = Date.now();
    const seen = new Set(); ws.isAlive = true;
    const send = message => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
    const error = (code, message) => send({ type: 'error', code, message });
    function abortAudio(notify = false) {
      audioController?.abort(); audioController = null;
      if (notify && responseId) send({ type: 'interrupted', id: responseId });
    }
    function cleanup() {
      closed = true; abortAudio(); clearTimeout(streamTimer); stt?.close(); stt = null;
    }
    /** Récupère l'audio d'une phrase : cache disque d'abord, sinon la voix du fournisseur. */
    async function renderSpeech({ text, language, controller, audioId }) {
      const hash = cacheKey(text, language), cached = readCache(hash);
      if (cached) {
        console.log(`[voix] cache disque · ${cached.length / 2 / 24000 < 1 ? '<1' : Math.round(cached.length / 2 / 24000)} s`);
        for (let offset = 0; offset < cached.length; offset += 32768) {
          if (controller.signal.aborted || closed) return;
          await sendAudioChunk(cached.subarray(offset, offset + 32768), audioId);
        }
        return;
      }
      const frames = [];
      await tts({ text, language,
        signal: controller.signal,
        onChunk: async chunk => { frames.push(chunk); await sendAudioChunk(chunk, audioId); },
        onUsage: usage => console.log(`[voix] ${providers.tts} · ${usage.characters} caractères · ${usage.audioSeconds} s d’audio`) });
      writeCache(hash, Buffer.concat(frames));
    }
    async function sendAudioChunk(chunk, audioId) {
      if (closed || ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) throw new Error('Réseau trop lent pour le flux audio. Réessayez sur une connexion stable.');
      const header = Buffer.alloc(4); header.writeUInt32LE(audioId, 0);
      ws.send(Buffer.concat([header, chunk]), { binary: true });
      // Laisse respirer la boucle d'événements : l'interruption reste instantanée.
      if (ws.bufferedAmount > 128 * 1024) await new Promise(resolve => setTimeout(resolve, 10));
    }
    async function assistant(result) {
      if (closed) return;
      abortAudio();
      const id = responseId = `a-${randomUUID()}`;
      send({ type: 'assistant', id, text: result.text, state: result.state, order: result.order });
      const serverVoice = !!tts && ['voice', 'streaming'].includes(session.mode);
      if (!serverVoice || !wantsAudio) return;
      const controller = audioController = new AbortController(), audioId = ++audioCounter;
      send({ type: 'audio_begin', id, audioId, sampleRate: 24000 });
      try {
        await renderSpeech({ text: result.text, language: session.language, controller, audioId });
        if (!controller.signal.aborted && !closed) send({ type: 'audio_done', audioId });
      } catch (fault) {
        if (!controller.signal.aborted && !closed) {
          error('tts_failed', fault.message || 'La voix streaming est indisponible.');
          send({ type: 'audio_done', audioId });
        }
      } finally { if (audioController === controller) audioController = null; }
    }
    function user(text, id) {
      if (!session) return error('not_ready', 'Démarrez la conversation avant d’envoyer une phrase.');
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) return error('invalid_text', 'Phrase vide ou trop longue.');
      if (id && seen.has(id)) return;
      abortAudio(true);
      const before = clone(engine.db), beforeSession = clone(session);
      try {
        const result = engine.turn(session, text);
        if (result.changed) persist();
        if (id) { seen.add(id); if (seen.size > 200) seen.delete(seen.values().next().value); }
        send({ type: 'user_final', id: id || `u-${randomUUID()}`, text: text.trim() });
        void assistant(result);
      } catch (fault) {
        engine.db = before; session = beforeSession;
        error('turn_failed', fault.message || 'Impossible de traiter la phrase. Aucune modification sauvegardée.');
      }
    }
    send({ type: 'connected', protocol: 1 });
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', async (raw, binary) => {
      if (closed) return;
      if (binary) {
        if (session?.mode === 'streaming' && stt && raw.length % 2 === 0) stt.sendAudio(raw);
        return;
      }
      if (Date.now() - countStart > 60000) { textCount = 0; countStart = Date.now(); }
      if (++textCount > 100) { error('rate_limit', 'Trop de messages. Attendez une minute.'); return; }
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { error('invalid_json', 'Message JSON invalide.'); return; }
      if (!message || typeof message !== 'object') { error('invalid_message', 'Message invalide.'); return; }
      if (message.type === 'start') {
        if (session || starting) { error('already_started', 'Une conversation est déjà ouverte.'); return; }
        starting = true;
        try {
          const requested = ['browser', 'voice', 'streaming'].includes(message.mode) ? message.mode : 'browser';
          if (requested === 'streaming' && !providers.streaming) {
            throw new Error(providers.tts && !providers.stt
              ? 'Streaming non configuré : la reconnaissance serveur manque. Choisissez le mode « voix tunisienne » (micro du navigateur) ou renseignez une clé Baarcha gratuite.'
              : 'Streaming non configuré. Utilisez le mode gratuit ou renseignez les clés côté serveur.');
          }
          if (requested === 'voice' && !providers.voice) throw new Error(`Voix serveur non configurée. Créez une clé gratuite sur ${BAARCHA_SIGNUP_URL} (voix Dido) ou utilisez la voix du navigateur.`);
          const nextSession = engine.session(String(message.orderId || ''), message.language);
          nextSession.mode = requested; wantsAudio = message.voiceEnabled !== false;
          if (requested === 'streaming') {
            const instance = stt = sttFactory ? sttFactory({ language: nextSession.language })
              : providers.stt === 'baarcha'
                ? new BaarchaSTT({ key: env.BAARCHA_API_KEY, model: env.BAARCHA_STT_MODEL || 'fennec',
                    ...(env.BAARCHA_BASE_URL ? { baseURL: env.BAARCHA_BASE_URL } : {}),
                    ...(Number(env.BAARCHA_STT_SEGMENT_MS) ? { segmentMs: Number(env.BAARCHA_STT_SEGMENT_MS) } : {}) })
                : new DeepgramSTT({ key: env.DEEPGRAM_API_KEY, model: env.DEEPGRAM_MODEL || 'nova-3',
                    language: nextSession.language.startsWith('fr') ? 'fr' : (env.DEEPGRAM_LANGUAGE || 'ar-TN') });
            instance.on('speech_start', () => { abortAudio(true); send({ type: 'user_speaking' }); });
            instance.on('interim', partial => send({ type: 'user_interim', ...partial }));
            instance.on('final', final => user(final.text, final.id));
            instance.on('notice', fault => { send({ type: 'notice', message: `Transcription : ${fault.message}` }); });
            instance.on('fault', fault => { error('stt_failed', fault.message); cleanup(); ws.close(1011, 'STT unavailable'); });
            await instance.start();
            if (closed) { instance.close(); return; }
            const minutes = Math.max(1, Math.min(30, Number(env.STREAM_MAX_MINUTES) || 10));
            streamTimer = setTimeout(() => { error('session_limit', 'Limite de durée atteinte. Redémarrez pour une nouvelle session.'); cleanup(); ws.close(4003, 'Session time limit'); }, minutes * 60000);
            streamTimer.unref();
          }
          if (closed) return;
          session = nextSession;
          send({ type: 'session_ready', mode: requested, state: clone(session), order: engine.view(session.orderId),
            engines: { stt: requested === 'streaming' ? providers.stt : 'browser', tts: tts ? providers.tts : 'browser' } });
          void assistant(engine.greeting(session));
        } catch (fault) { stt?.close(); stt = null; error('start_failed', fault.message || 'Conversation impossible à démarrer.'); }
        finally { starting = false; }
        return;
      }
      if (message.type === 'user') { user(message.text, typeof message.id === 'string' ? message.id.slice(0, 100) : undefined); return; }
      if (message.type === 'interrupt') { abortAudio(true); return; }
      if (message.type === 'set_audio') { wantsAudio = !!message.enabled; if (!wantsAudio) abortAudio(true); return; }
      if (message.type === 'stop') { cleanup(); ws.close(1000, 'Stopped'); return; }
      error('unknown_message', 'Type de message inconnu.');
    });
    ws.on('error', cleanup);
    ws.on('close', () => { cleanup(); const ip = ws.clientIP; connections.set(ip, Math.max(0, (connections.get(ip) || 1) - 1)); if (!connections.get(ip)) connections.delete(ip); });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
  }, 20000);
  heartbeat.unref();
  server.on('close', () => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); });
  return { app, server, wss, engine, providers };
}

function modeLabel(providers) {
  if (providers.streaming) return `streaming(${providers.stt + '+' + providers.tts})`;
  if (providers.voice) return `voix-serveur(${providers.tts})+micro-navigateur`;
  return 'navigateur';
}
