import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

/* =====================================================================
 * Ordely — fournisseurs vocaux
 *
 * Derja tunisienne (ar-TN / aeb) :
 *   1) BAARCHA (baarcha.tn) — modèles tunisiens : Dido (TTS) + Fennec (STT).
 *      Compte gratuit, sans carte ; une seule clé `pk_live_…` couvre les deux.
 *   2) AZURE SPEECH (offre F0) — voix natives ar-TN-HediNeural / ar-TN-ReemNeural,
 *      500 000 caractères/mois gratuits qui se renouvellent (secours durable).
 *   3) DEEPGRAM (nova-3, ar-TN) et ELEVENLABS — facultatifs, si vous avez déjà une clé.
 *
 * Aucun fournisseur n'est requis : sans clé, l'application reste en mode gratuit
 * (voix et reconnaissance du navigateur).
 * ===================================================================== */

/* --------------------------------------------------------------------- */
/* Utilitaires                                                           */
/* --------------------------------------------------------------------- */

/** Enveloppe PCM 16 bits mono dans un conteneur WAV (utilisé pour Fennec). */
export function wavFromPCM16(pcm, sampleRate = 16000, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Lit un WAV PCM 16 bits mono et renvoie { pcm, sampleRate, channels, bits }. */
export function readWav(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Le service vocal a renvoyé un fichier audio illisible (ce n’est pas un WAV).');
  }
  let offset = 12, dataStart = -1, dataSize = 0, sampleRate = 0, channels = 0, bits = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ' && size >= 16 && offset + 8 + size <= buffer.length) {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bits = buffer.readUInt16LE(offset + 22);
    }
    if (id === 'data') { dataStart = offset + 8; dataSize = Math.min(size, buffer.length - dataStart); break; }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || !sampleRate) throw new Error('Le fichier audio reçu ne contient aucune donnée exploitable.');
  return { pcm: buffer.subarray(dataStart, dataStart + dataSize), sampleRate, channels, bits };
}

/** Découpe un texte long aux frontières de phrase (limite Dido : 5 000 caractères). */
export function splitForSpeech(text, max = 4500) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const parts = [];
  let current = '';
  for (const sentence of clean.split(/(?<=[.!?؟…])\s+/)) {
    if (!current) current = sentence;
    else if ((current + ' ' + sentence).length <= max) current += ' ' + sentence;
    else { parts.push(current); current = sentence; }
  }
  if (current) parts.push(current);
  return parts.flatMap(part => part.length <= max ? [part] : part.match(new RegExp(`.{1,${max}}`, 'gs')) || []);
}

/** Message lisible d'une erreur JSON « enveloppe OpenAI » (Baarcha, ElevenLabs…). */
export async function readProviderError(response) {
  const raw = await response.text().catch(() => '');
  let code = null, message = '';
  try {
    const parsed = JSON.parse(raw);
    code = parsed?.error?.code || parsed?.detail?.code || null;
    message = parsed?.error?.message || parsed?.detail?.message || parsed?.message || '';
  } catch { message = raw.slice(0, 200); }
  return { status: response.status, code, message, body: raw.slice(0, 200) };
}

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new Error('Opération annulée.');
}

/** Fusionne un signal d'annulation utilisateur et un délai maximal. */
function combineSignal(signal, ms) {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Réessaie une opération réseau (503 « modèle froid », 502, 429) avec attente progressive. */
async function retry(operation, { attempts = 3, signal, baseDelay = 400 } = {}) {
  let lastFault;
  for (let index = 0; index < attempts; index += 1) {
    try { return await operation(index); }
    catch (fault) {
      lastFault = fault;
      if (fault?.noRetry || signal?.aborted) break;
      if (index === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, baseDelay * (index + 1)));
    }
  }
  throw lastFault;
}

/* --------------------------------------------------------------------- */
/* 1. BAARCHA — Dido (synthèse vocale tunisienne, 24 kHz mono PCM)        */
/* --------------------------------------------------------------------- */

export const BAARCHA_BASE_URL = 'https://baarcha.tn/api/v1';
export const BAARCHA_SIGNUP_URL = 'https://baarcha.tn/platform';

/** Message d'erreur Baarcha → phrase actionnable pour l'utilisateur de la démo. */
export function explainBaarchaError(status, code, detail = '') {
  const suffix = detail ? ` Détail du service : ${detail}` : '';
  if (status === 401) {
    return `Clé Baarcha absente ou refusée (401). Créez une clé gratuite sur ${BAARCHA_SIGNUP_URL} puis renseignez-la dans BAARCHA_API_KEY côté serveur.${suffix}`;
  }
  if (status === 429) return `Le service Baarcha limite le rythme des requêtes (429). Attendez une minute avant de relancer la démonstration.${suffix}`;
  if (status === 503 || code === 'model_not_available') {
    return `Le modèle tunisien Dido se charge ou est momentanément indisponible (503). Relancez la phrase dans quelques secondes.${suffix}`;
  }
  if (code === 'fixture_no_render') {
    return 'Baarcha répond en mode démonstration : seules quelques phrases d’exemple disposent d’un audio pré-rendu. Utilisez un déploiement « live » de Baarcha pour une synthèse libre.';
  }
  if (status === 413) return `Phrase trop longue pour la voix tunisienne (limite 5 000 caractères).${suffix}`;
  return `La voix tunisienne Baarcha a refusé la requête (${status}${code ? ` · ${code}` : ''}).${suffix}`;
}

/**
 * Dido : texte derja → PCM 16 bits 24 kHz mono.
 * `onChunk` reçoit des morceaux de PCM ; `onUsage` reçoit { characters, audioSeconds }.
 */
export async function streamSpeechBaarcha({ key, voiceId, text, signal, onChunk, onUsage,
  fetchImpl = fetch, baseURL = BAARCHA_BASE_URL, model = 'dido', attempts = 3 }) {
  if (!key) throw new Error(`BAARCHA_API_KEY est absente côté serveur. Créez une clé gratuite sur ${BAARCHA_SIGNUP_URL}.`);
  const segments = splitForSpeech(text);
  if (!segments.length) throw new Error('Aucun texte à lire.');
  for (const segment of segments) {
    const response = await retry(async () => {
      const result = await fetchImpl(`${baseURL}/audio/speech`, {
        method: 'POST',
        signal: combineSignal(signal, 60000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'audio/wav' },
        body: JSON.stringify({ model, input: segment, ...(voiceId ? { voice: voiceId } : {}), response_format: 'wav' })
      });
      if (result.status === 429 || result.status === 502 || result.status === 503) {
        await result.body?.cancel?.().catch?.(() => {});
        const fault = new Error(explainBaarchaError(result.status));
        throw fault;
      }
      return result;
    }, { attempts, signal });
    if (!response.ok) {
      const info = await readProviderError(response);
      throw new Error(explainBaarchaError(info.status, info.code, info.message));
    }
    const contentType = String(response.headers?.get?.('content-type') || '');
    if (contentType && !/wav|octet-stream|l16|pcm/i.test(contentType)) {
      await response.body?.cancel?.().catch?.(() => {});
      throw new Error(`Baarcha a renvoyé « ${contentType} » au lieu d’un WAV PCM. Vérifiez le paramètre response_format.`);
    }
    const usage = {
      characters: Number(response.headers?.get?.('x-usage-characters')) || segment.length,
      audioSeconds: Number(response.headers?.get?.('x-usage-audio-seconds')) || 0,
      cached: false
    };
    const bytes = Buffer.from(await response.arrayBuffer());
    const { pcm, sampleRate, channels, bits } = readWav(bytes);
    if (channels !== 1 || bits !== 16) throw new Error(`Format audio Baarcha inattendu (${channels} canal(aux), ${bits} bits) : la démo attend du PCM mono 16 bits.`);
    if (sampleRate !== 24000) throw new Error(`Baarcha a renvoyé ${sampleRate} Hz au lieu de 24 000 Hz.`);
    if (!pcm.length) throw new Error('Baarcha a renvoyé un audio vide.');
    signal?.throwIfAborted?.();
    onUsage?.(usage);
    await onChunk(pcm);
  }
}

/* --------------------------------------------------------------------- */
/* 2. BAARCHA — Fennec (reconnaissance de la parole tunisienne)           */
/* --------------------------------------------------------------------- */

/**
 * Fennec ne propose pas de WebSocket : on découpe la parole en segments WAV courts
 * (quelques secondes) envoyés à /audio/transcriptions dès la fin d'une phrase ou
 * pendant une phrase longue. Le texte arrive donc « au fil de l'eau ».
 */
export class BaarchaSTT extends EventEmitter {
  constructor({ key, model = 'fennec', fetchImpl = fetch, baseURL = BAARCHA_BASE_URL,
    sampleRate = 16000, silenceMs = 700, attackMs = 150, minSpeechMs = 180,
    segmentMs = 6000, prerollMs = 240, threshold = 0.012, maxBytes = 6 * 1024 * 1024,
    now = () => Date.now() } = {}) {
    super();
    this.options = { key, model, fetchImpl, baseURL, sampleRate, silenceMs, attackMs, minSpeechMs, segmentMs, prerollMs, threshold, maxBytes };
    this.now = now;
    this.frames = [];          // PCM de la phrase en cours
    this.pre = [];             // pré-roulement (ne pas couper le premier mot)
    this.preBytes = 0;
    this.collected = '';       // texte provisoire déjà reconnu pour cette phrase
    this.segmentsSent = 0;     // segments déjà envoyés pour la phrase en cours
    this.utterance = 1;
    this.speaking = false;
    this.attack = 0; this.silence = 0; this.speechMs = 0;
    this.queue = [];
    this.draining = false;
    this.closed = false;
    this.lastFrameAt = 0;
  }

  get currentId() { return `stt-${this.utterance}`; }

  /** Vérifie la clé et la disponibilité de Fennec avant d'ouvrir la session. */
  async start() {
    const { key, baseURL, fetchImpl } = this.options;
    if (!key) throw new Error(`BAARCHA_API_KEY est absente côté serveur. Créez une clé gratuite sur ${BAARCHA_SIGNUP_URL}.`);
    let response;
    try {
      response = await fetchImpl(`${baseURL}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(12000) });
    } catch {
      throw new Error('Le service tunisien Baarcha est injoignable depuis le serveur (réseau ou pare-feu). Le mode gratuit du navigateur reste disponible.');
    }
    if (response.status === 401) throw new Error(explainBaarchaError(401));
    if (response.ok) {
      const catalogue = await response.json().catch(() => null);
      const model = catalogue?.data?.find(entry => entry.id === this.options.model);
      if (model && model.status && model.status !== 'available' && model.status !== 'in_training') {
        this.emit('notice', new Error(`Le modèle de reconnaissance ${this.options.model} annonce l'état « ${model.status} » : la transcription peut échouer.`));
      }
    }
    // Surveille une coupure de flux audio (micro coupé sans silence transmis).
    this.watchdog = setInterval(() => {
      if (this.closed || !this.speaking) return;
      if (this.now() - this.lastFrameAt > this.options.silenceMs + 500) this.finishUtterance('watchdog');
    }, 1000);
    this.watchdog.unref?.();
  }

  sendAudio(buffer) {
    if (this.closed || !buffer?.length) return;
    const { sampleRate, threshold, attackMs, silenceMs, prerollMs, segmentMs, maxBytes } = this.options;
    this.lastFrameAt = this.now();
    const frameMs = (buffer.length / 2) / sampleRate * 1000;
    let sum = 0;
    for (let index = 0; index + 1 < buffer.length; index += 2) { const value = buffer.readInt16LE(index) / 32768; sum += value * value; }
    const rms = Math.sqrt(sum / Math.max(1, buffer.length / 2));

    if (rms > threshold) {
      this.silence = 0; this.attack += frameMs;
      if (!this.speaking) {
        // Le pré-roulement garde aussi l'attaque : le premier mot n'est jamais coupé.
        this.keep(buffer, prerollMs);
        if (this.attack >= attackMs) {
          this.speaking = true; this.speechMs = 0;
          this.frames = this.pre.slice(); this.pre = []; this.preBytes = 0;
          this.emit('speech_start');
        }
      }
      if (this.speaking) { this.frames.push(buffer); this.speechMs += frameMs; }
    } else {
      this.attack = 0;
      if (this.speaking) {
        this.silence += frameMs;
        if (this.silence >= silenceMs) { this.finishUtterance(); return; }
      } else {
        // Pré-roulement : conserve les derniers instants avant la prise de parole.
        this.keep(buffer, prerollMs);
      }
    }

    if (!this.speaking) return;
    const buffered = this.frames.reduce((total, frame) => total + frame.length, 0);
    if (buffered >= maxBytes || this.speechMs >= segmentMs) this.segment();
  }

  /** Maintient le pré-roulement à la durée demandée (avant la prise de parole). */
  keep(buffer, prerollMs) {
    const { sampleRate } = this.options;
    this.pre.push(buffer); this.preBytes += buffer.length;
    while (this.preBytes > (prerollMs / 1000) * sampleRate * 2 && this.pre.length > 1) this.preBytes -= this.pre.shift().length;
  }

  /** Envoie la portion en cours : texte provisoire, on continue la phrase. */
  segment() {
    if (!this.frames.length) return;
    const pcm = Buffer.concat(this.frames); this.frames = []; this.speechMs = 0;
    this.segmentsSent += 1;
    this.enqueue(pcm, false);
  }

  /** Fin de phrase : dernière portion envoyée, puis texte final publié. */
  finishUtterance() {
    const pcm = this.frames.length ? Buffer.concat(this.frames) : null;
    this.frames = []; this.speaking = false; this.silence = 0; this.attack = 0;
    this.speechMs = 0; this.pre = []; this.preBytes = 0;
    // Un court reste de parole est envoyé dès qu'un segment a déjà été traité pour cette
    // phrase ; un bruit isolé très bref, lui, ne déclenche aucune requête.
    const floor = (this.options.minSpeechMs / 1000) * this.options.sampleRate * 2;
    const worthSending = pcm && pcm.length >= floor;
    const alreadySegmented = this.segmentsSent > 0;
    this.segmentsSent = 0;
    if (pcm && (alreadySegmented || worthSending)) this.enqueue(pcm, true);
    else this.enqueue(null, true);
  }

  enqueue(pcm, final) {
    this.queue.push({ pcm, final, id: this.currentId });
    void this.pump();
  }

  async pump() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length && !this.closed) {
        const job = this.queue.shift();
        let text = '';
        try { if (job.pcm) text = await this.recognize(job.pcm); }
        catch (fault) {
          if (this.closed) return;
          if (fault.fatal) { this.emit('fault', fault); return; }
          this.emit('notice', fault);
        }
        if (this.closed) return;
        if (text) this.collected = [this.collected, text].filter(Boolean).join(' ').trim();
        if (!job.final) {
          if (this.collected) this.emit('interim', { id: job.id, text: this.collected.slice(0, 2000) });
          continue;
        }
        // Fin de phrase : on publie ce qui a été reconnu (provisoire inclus) et on repart à zéro.
        const spoken = this.collected.trim();
        this.collected = ''; this.utterance += 1;
        if (spoken) this.emit('final', { id: job.id, text: spoken.slice(0, 2000) });
      }
    } finally { this.draining = false; }
  }

  async recognize(pcm) {
    const { key, model, baseURL, fetchImpl } = this.options;
    const response = await retry(async () => {
      const form = new FormData();
      form.set('model', model);
      form.set('response_format', 'json');
      form.set('file', new Blob([wavFromPCM16(pcm, this.options.sampleRate)], { type: 'audio/wav' }), 'phrase.wav');
      const result = await fetchImpl(`${baseURL}/audio/transcriptions`, {
        method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key}` }, body: form
      });
      if (result.status === 429 || result.status === 502 || result.status === 503) {
        await result.body?.cancel?.().catch?.(() => {});
        throw new Error(explainBaarchaError(result.status));
      }
      return result;
    }, { attempts: 3, baseDelay: 500 });
    if (!response.ok) {
      const info = await readProviderError(response);
      const fault = new Error(`Transcription tunisienne indisponible (${info.status}). ${explainBaarchaError(info.status, info.code, info.message)}`);
      // Une clé invalide ou un service indisponible ne doit pas boucler : signalé, jamais fatal.
      return Promise.reject(Object.assign(fault, { fatal: false }));
    }
    const payload = await response.json().catch(() => null);
    return String(payload?.text || '').trim();
  }

  close() {
    this.closed = true;
    clearInterval(this.watchdog);
    this.queue = []; this.frames = []; this.pre = []; this.collected = '';
  }
}

/* --------------------------------------------------------------------- */
/* 3. AZURE SPEECH — voix tunisiennes ar-TN (offre gratuite F0)           */
/* --------------------------------------------------------------------- */

export const AZURE_VOICES = {
  'ar-TN': { male: 'ar-TN-HediNeural', female: 'ar-TN-ReemNeural' },
  'fr-FR': { male: 'fr-FR-HenriNeural', female: 'fr-FR-DeniseNeural' }
};

export function azureVoice(language = 'ar-TN', preferred = '') {
  if (preferred) return preferred;
  const entry = AZURE_VOICES[String(language).startsWith('fr') ? 'fr-FR' : 'ar-TN'];
  return entry.male;
}

/**
 * Azure Neural TTS en PCM 24 kHz brut — mêmes morceaux que Dido, donc
 * interchangeable dans le pipeline audio d'Ordely.
 */
export async function streamSpeechAzure({ key, region, voiceId, text, language = 'ar-TN', signal, onChunk,
  fetchImpl = fetch, baseURL, outputFormat = 'raw-24khz-16bit-mono-pcm', attempts = 3 }) {
  if (!key) throw new Error('AZURE_SPEECH_KEY est absente côté serveur.');
  const area = (region || 'westeurope').trim();
  const endpoint = baseURL || `https://${area}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const voice = azureVoice(language, voiceId);
  const segments = splitForSpeech(text, 4000);
  if (!segments.length) throw new Error('Aucun texte à lire.');
  for (const segment of segments) {
    const ssml = `<speak version='1.0' xml:lang='${language.startsWith('fr') ? 'fr-FR' : 'ar-TN'}'>`
      + `<voice name='${voice}'><prosody rate='+0%'>${escapeXML(segment)}</prosody></voice></speak>`;
    const response = await retry(async () => {
      const result = await fetchImpl(endpoint, {
        method: 'POST', signal: combineSignal(signal, 45000),
        headers: {
          'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': outputFormat, 'User-Agent': 'ordely-demo'
        },
        body: ssml
      });
      if (result.status === 429 || result.status === 502 || result.status === 503) {
        await result.body?.cancel?.().catch?.(() => {});
        throw new Error(`La voix Azure est momentanément indisponible (${result.status}).`);
      }
      return result;
    }, { attempts, signal });
    if (!response.ok) {
      const info = await readProviderError(response);
      if (info.status === 401 || info.status === 403) throw new Error(`Clé Azure refusée (${info.status}) : vérifiez AZURE_SPEECH_KEY et AZURE_SPEECH_REGION (voix ${voice}). ${info.message}`.trim());
      throw new Error(`Azure a refusé la synthèse (${info.status}) avec la voix ${voice}. ${info.message}`.trim());
    }
    if (!response.body) throw new Error('Azure a renvoyé un flux audio vide.');
    let carry = Buffer.alloc(0), total = 0;
    for await (const bytes of response.body) {
      signal?.throwIfAborted?.();
      const chunk = carry.length ? Buffer.concat([carry, Buffer.from(bytes)]) : Buffer.from(bytes);
      const end = chunk.length - (chunk.length % 2);
      carry = chunk.subarray(end);
      total += end;
      if (total > 24000 * 2 * 180) throw new Error('Flux audio trop long : arrêt de sécurité.');
      if (end) await onChunk(chunk.subarray(0, end));
    }
    if (!total) throw new Error('Azure n’a produit aucun audio (vérifiez la voix et la région du service).');
  }
}

function escapeXML(text) {
  return String(text).replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

/* --------------------------------------------------------------------- */
/* 4. DEEPGRAM — reconnaissance ar-TN (facultatif, crédits d'essai)       */
/* --------------------------------------------------------------------- */

export class DeepgramSTT extends EventEmitter {
  constructor({ key, model = 'nova-3', language = 'ar-TN', WebSocketClass = WebSocket, url = 'wss://api.deepgram.com/v1/listen' }) {
    super(); this.options = { key, model, language, WebSocketClass, url };
    this.parts = []; this.segments = new Set(); this.utterance = 1; this.closed = false;
  }
  get currentId() { return `stt-${this.utterance}`; }
  async start() {
    const { key, model, language, WebSocketClass, url } = this.options;
    const endpoint = new URL(url);
    for (const [k, v] of Object.entries({ model, language, encoding: 'linear16', sample_rate: 16000, channels: 1,
      interim_results: true, vad_events: true, endpointing: 650, utterance_end_ms: 1200, punctuate: true, smart_format: true })) endpoint.searchParams.set(k, String(v));
    const ws = this.ws = new WebSocketClass(endpoint, { headers: { Authorization: `Token ${key}` }, handshakeTimeout: 12000 });
    await new Promise((resolve, reject) => {
      let ready = false;
      this.connectTimer = setTimeout(() => { reject(new Error('Le service de transcription ne répond pas.')); ws.terminate(); }, 13000);
      ws.on('open', () => {
        clearTimeout(this.connectTimer); ready = true;
        if (this.closed) { ws.close(); reject(new Error('Session arrêtée.')); return; }
        this.keepAlive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' })); }, 8000);
        this.keepAlive.unref?.(); resolve();
      });
      ws.on('unexpected-response', (_request, response) => {
        response.resume(); clearTimeout(this.connectTimer);
        const error = new Error(`Deepgram a refusé la connexion (${response.statusCode}). Vérifiez la clé, les crédits et le modèle/langue.`);
        reject(error); ws.terminate();
      });
      ws.on('error', () => {
        clearTimeout(this.connectTimer);
        const error = new Error('Connexion Deepgram impossible. Vérifiez la configuration et le réseau du serveur.');
        if (!ready) reject(error); else if (!this.closed) this.emit('fault', error);
      });
      ws.on('close', () => {
        clearInterval(this.keepAlive); clearTimeout(this.connectTimer);
        if (!ready) reject(new Error('Connexion Deepgram fermée avant le démarrage.'));
        else if (!this.closed) this.emit('fault', new Error('Le service de transcription a fermé la connexion.'));
      });
      ws.on('message', raw => {
        if (this.closed) return;
        try { this.accept(JSON.parse(raw.toString())); } catch { /* message inconnu, pas de crash */ }
      });
    });
  }
  accept(message) {
    if (message.type === 'Error') { this.emit('fault', new Error('Erreur du service Deepgram. Vérifiez le modèle, la langue et les crédits.')); return; }
    if (message.type === 'SpeechStarted') { this.emit('speech_start'); return; }
    if (message.type === 'UtteranceEnd') { this.flush(); return; }
    if (message.type !== 'Results') return;
    const text = message.channel?.alternatives?.[0]?.transcript?.trim() || '';
    if (message.is_final && text) {
      const key = `${message.start}:${message.duration}:${text}`;
      if (!this.segments.has(key)) { this.parts.push(text); this.segments.add(key); }
    }
    const partial = [...this.parts, !message.is_final ? text : ''].filter(Boolean).join(' ');
    if (partial) this.emit('interim', { id: this.currentId, text: partial.slice(0, 2000) });
    if (message.speech_final) this.flush();
  }
  flush() {
    if (!this.parts.length) return;
    const final = { id: this.currentId, text: this.parts.join(' ').slice(0, 2000) };
    this.parts = []; this.segments.clear(); this.utterance += 1;
    this.emit('final', final);
  }
  sendAudio(buffer) { if (!this.closed && this.ws?.readyState === WebSocket.OPEN) this.ws.send(buffer, { binary: true }); }
  close() {
    this.closed = true; clearInterval(this.keepAlive); clearTimeout(this.connectTimer);
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify({ type: 'CloseStream' })); this.ws.close(); }
    else if (this.ws?.readyState === WebSocket.CONNECTING) this.ws.terminate();
  }
}

/* --------------------------------------------------------------------- */
/* 5. ELEVENLABS — option héritée (voix arabe générique, payant)          */
/* --------------------------------------------------------------------- */

export async function streamSpeech({ key, voiceId, model = 'eleven_turbo_v2_5', text, language = 'ar-TN', signal, onChunk,
  fetchImpl = fetch, baseURL = 'https://api.elevenlabs.io/v1' }) {
  const timeout = AbortSignal.timeout(45000), combinedSignal = AbortSignal.any([signal, timeout].filter(Boolean));
  const url = `${baseURL}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`;
  const response = await fetchImpl(url, { method: 'POST', signal: combinedSignal,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/pcm' },
    body: JSON.stringify({ text, model_id: model, language_code: language.startsWith('fr') ? 'fr' : 'ar' }) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`ElevenLabs a refusé la voix (${response.status}). Vérifiez la clé, les crédits, l’identifiant de voix et l’accès au PCM 24 kHz.`);
  }
  if (!response.body) throw new Error('Le service vocal a renvoyé un flux audio vide.');
  let carry = Buffer.alloc(0), total = 0;
  for await (const bytes of response.body) {
    combinedSignal.throwIfAborted();
    const chunk = carry.length ? Buffer.concat([carry, Buffer.from(bytes)]) : Buffer.from(bytes);
    const end = chunk.length - chunk.length % 2;
    carry = chunk.subarray(end);
    total += end;
    if (total > 24000 * 2 * 120) throw new Error('Flux audio trop long : arrêt de sécurité.');
    if (end) await onChunk(chunk.subarray(0, end));
  }
  if (!total) throw new Error('Le service vocal n’a produit aucun audio.');
}
