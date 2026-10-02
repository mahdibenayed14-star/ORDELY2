import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepgramSTT, streamSpeech } from '../src/providers.js';
test('STT : provisoire, segments finaux, une seule phrase métier', () => {
  const stt=new DeepgramSTT({key:'mock'}), interim=[], final=[];
  stt.on('interim',m=>interim.push(m)); stt.on('final',m=>final.push(m));
  const result=(text,is_final=false,speech_final=false,start=0)=>stt.accept({type:'Results',is_final,speech_final,start,duration:.5,channel:{alternatives:[{transcript:text}]}});
  result('change'); result('change mon adresse',true); result('à Tunis',false,false,1); result('à Tunis',true,true,1);
  stt.accept({type:'UtteranceEnd'});
  assert.equal(final.length,1); assert.equal(final[0].text,'change mon adresse à Tunis'); assert.ok(interim.length>=3);
});
test('STT : résultats finaux dupliqués non exécutés deux fois', () => {
  const stt=new DeepgramSTT({key:'mock'}), final=[]; stt.on('final',m=>final.push(m));
  const event={type:'Results',is_final:true,start:0,duration:1,channel:{alternatives:[{transcript:'oui'}]}};
  stt.accept(event); stt.accept(event); stt.accept({type:'UtteranceEnd'}); assert.equal(final[0].text,'oui');
});
test('STT : SpeechStarted déclenche l’interruption', () => { const stt=new DeepgramSTT({key:'mock'}); let count=0; stt.on('speech_start',()=>count++); stt.accept({type:'SpeechStarted'}); assert.equal(count,1); });
test('TTS : chunks impairs réassemblés, PCM complet et paramètres corrects', async () => {
  const out=[], requests=[];
  const fetchImpl=async(url,options)=>{requests.push({url,options}); return new Response(new ReadableStream({start(controller){controller.enqueue(Uint8Array.from([1,2,3]));controller.enqueue(Uint8Array.from([4,5,6,7,8]));controller.close();}}));};
  await streamSpeech({key:'not-a-real-key',voiceId:'demo',text:'Bonjour',language:'fr-FR',onChunk:chunk=>out.push(chunk),fetchImpl});
  assert.deepEqual([...Buffer.concat(out)],[1,2,3,4,5,6,7,8]); assert.ok(out.every(c=>c.length%2===0));
  assert.match(requests[0].url,/output_format=pcm_24000/); assert.equal(JSON.parse(requests[0].options.body).language_code,'fr');
});
test('TTS : refus fournisseur explicite, pas de faux succès', async () => { await assert.rejects(()=>streamSpeech({key:'mock',voiceId:'demo',text:'x',onChunk:()=>{},fetchImpl:async()=>new Response('unauthorized',{status:401})}),/401/); });
test('TTS : flux vide refusé', async () => { await assert.rejects(()=>streamSpeech({key:'mock',voiceId:'demo',text:'x',onChunk:()=>{},fetchImpl:async()=>new Response(new Uint8Array())}),/aucun audio/); });

/* ------------------------------------------------------------------ */
/* Baarcha (Tunisie) : Dido pour la voix, Fennec pour la reconnaissance */
/* ------------------------------------------------------------------ */
import { BaarchaSTT, streamSpeechBaarcha, streamSpeechAzure, splitForSpeech, wavFromPCM16, AZURE_VOICES } from '../src/providers.js';

const pcmFrame = (samples, value) => { const buffer = Buffer.alloc(samples * 2); for (let index = 0; index < samples; index += 1) buffer.writeInt16LE(value, index * 2); return buffer; };
const voiceFrame = pcmFrame(800, 4000), silenceFrame = pcmFrame(800, 0);

test('Baarcha : découpage du texte aux frontières de phrase', () => {
  assert.deepEqual(splitForSpeech('  عسلامة.   شنوا الحال ؟ '), ['عسلامة. شنوا الحال ؟']);
  const long = splitForSpeech('أ'.repeat(6000), 1000);
  assert.equal(long.length, 6); assert.ok(long.every(part => part.length <= 1000));
});

test('Baarcha Dido : WAV 24 kHz converti en PCM, usage lu dans les en-têtes', async () => {
  const wav = wavFromPCM16(Buffer.from([1, 0, 2, 0]), 24000);
  const requests = [], chunks = [], usages = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(wav, { status: 200, headers: { 'content-type': 'audio/wav', 'x-usage-characters': '21', 'x-usage-audio-seconds': '4' } });
  };
  await streamSpeechBaarcha({ key: 'pk_live_test', text: 'عسلامة', language: 'ar-TN', voiceId: 'female',
    onChunk: chunk => chunks.push(chunk), onUsage: usage => usages.push(usage), fetchImpl });
  assert.deepEqual([...Buffer.concat(chunks)], [1, 0, 2, 0]);
  assert.equal(requests[0].url, 'https://baarcha.tn/api/v1/audio/speech');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'dido'); assert.equal(body.voice, 'female'); assert.equal(body.response_format, 'wav');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer pk_live_test');
  assert.equal(usages[0].characters, 21); assert.equal(usages[0].audioSeconds, 4);
});

test('Baarcha Dido : clé refusée → message actionnable, pas de faux succès', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'nope', code: 'invalid_api_key' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => streamSpeechBaarcha({ key: 'pk_live_ko', text: 'x', onChunk: () => {}, fetchImpl }), /baarcha\.tn\/platform/);
});

test('Baarcha Dido : modèle froid (503) réessayé puis servi', async () => {
  const wav = wavFromPCM16(Buffer.from([3, 0]), 24000);
  let attempts = 0;
  const fetchImpl = async () => (++attempts === 1
    ? new Response(JSON.stringify({ error: { code: 'model_not_available' } }), { status: 503, headers: { 'content-type': 'application/json' } })
    : new Response(wav, { status: 200, headers: { 'content-type': 'audio/wav' } }));
  const chunks = [];
  await streamSpeechBaarcha({ key: 'pk_live_test', text: 'مرحبا', onChunk: chunk => chunks.push(chunk), fetchImpl });
  assert.equal(attempts, 2); assert.equal(Buffer.concat(chunks).length, 2);
});

test('Baarcha Dido : mode démonstration expliqué (422 fixture_no_render)', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'no render', code: 'fixture_no_render', type: 'invalid_request_error' } }), { status: 422, headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => streamSpeechBaarcha({ key: 'pk_live_test', text: 'phrase inconnue', onChunk: () => {}, fetchImpl }), /mode démonstration/);
});

test('Baarcha Fennec : segmentation locale, provisoire puis final', async () => {
  const final = [], interim = []; let speechStarts = 0, recognized = 0;
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/models')) return new Response(JSON.stringify({ object: 'list', data: [{ id: 'fennec', status: 'available' }, { id: 'dido', status: 'available' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    recognized += 1;
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('model'), 'fennec');
    assert.equal(options.body.get('file').type, 'audio/wav');
    assert.ok(options.body.get('file').size > 44, 'un WAV complet est envoyé');
    return new Response(JSON.stringify({ text: recognized === 1 ? 'شنوا' : 'الحكاية' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const stt = new BaarchaSTT({ key: 'pk_live_test', fetchImpl, segmentMs: 300, silenceMs: 300, attackMs: 100, now: () => Date.now() });
  stt.on('speech_start', () => speechStarts++);
  stt.on('interim', message => interim.push(message));
  stt.on('final', message => final.push(message));
  await stt.start();
  for (let index = 0; index < 8; index += 1) stt.sendAudio(voiceFrame);   // 400 ms de parole → un segment provisoire
  for (let index = 0; index < 8; index += 1) stt.sendAudio(silenceFrame); // silence → fin de phrase
  await new Promise(resolve => setTimeout(resolve, 120));
  stt.close();
  assert.equal(speechStarts, 1);
  assert.ok(interim.length >= 1, 'un texte provisoire est publié pendant la phrase');
  assert.equal(final.length, 1);
  assert.equal(final[0].text, 'شنوا الحكاية');
  assert.match(final[0].id, /^stt-\d+$/);
});

test('Baarcha Fennec : clé absente refusée au démarrage, sans tuer la session', async () => {
  await assert.rejects(() => new BaarchaSTT({ key: '' }).start(), /baarcha\.tn\/platform/);
  const fetchImpl = async url => (String(url).endsWith('/models')
    ? new Response(JSON.stringify({ error: { code: 'invalid_api_key' } }), { status: 401, headers: { 'content-type': 'application/json' } })
    : new Response('{}', { status: 500 }));
  await assert.rejects(() => new BaarchaSTT({ key: 'pk_live_ko', fetchImpl }).start(), /401/);
});

test('Baarcha Fennec : panne passagère signalée, jamais fatale', async () => {
  const notices = [], faults = [];
  const fetchImpl = async url => (String(url).endsWith('/models')
    ? new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 500, headers: { 'content-type': 'application/json' } }));
  const stt = new BaarchaSTT({ key: 'pk_live_test', fetchImpl, silenceMs: 200, attackMs: 100, now: () => Date.now() });
  stt.on('notice', fault => notices.push(fault)); stt.on('fault', fault => faults.push(fault));
  await stt.start();
  for (let index = 0; index < 6; index += 1) stt.sendAudio(voiceFrame);
  for (let index = 0; index < 6; index += 1) stt.sendAudio(silenceFrame);
  await new Promise(resolve => setTimeout(resolve, 120));
  stt.close();
  assert.equal(faults.length, 0, 'une panne 500 ne doit pas fermer la session');
  assert.ok(notices.length >= 1);
});

test('Azure : voix ar-TN native, SSML et PCM 24 kHz assemblé par octets pairs', async () => {
  const requests = [], chunks = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.from([1, 2, 3])); controller.enqueue(Uint8Array.from([4, 5, 6, 7, 8])); controller.close(); } }));
  };
  await streamSpeechAzure({ key: 'azure-key', region: 'westeurope', text: 'شنوا الحال؟', language: 'ar-TN', onChunk: chunk => chunks.push(chunk), fetchImpl });
  assert.equal(requests[0].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(requests[0].options.headers['X-Microsoft-OutputFormat'], 'raw-24khz-16bit-mono-pcm');
  assert.match(requests[0].options.body, /ar-TN-HediNeural/);
  assert.equal(AZURE_VOICES['ar-TN'].female, 'ar-TN-ReemNeural');
  assert.deepEqual([...Buffer.concat(chunks)], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(chunks.every(chunk => chunk.length % 2 === 0));
});
