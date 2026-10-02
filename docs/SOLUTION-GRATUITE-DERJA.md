# Voix et reconnaissance arabes tunisiennes (derja) — solution gratuite et corrections V11.1

Ce document répond à trois questions :

1. **Pourquoi la démo déployée sur Render ne parlait pas derja** alors que le code « V11 » était
   censé le faire.
2. **Quelle solution gratuite existe réellement** pour la voix et la reconnaissance tunisiennes.
3. **Ce qui a été corrigé dans le code**, et comment vérifier soi-même que ça marche.

---

## 1. Diagnostic — les trois causes réelles

### 1.1 Le bug principal : le client ignorait la configuration du serveur

Dans `public/assets/app.js`, l'application n'adoptait la configuration du serveur que si la version
renvoyée commençait par `10.` :

```js
if (detected.backend && detected.version?.startsWith('10.')) config = detected;   // ❌ ancien code
```

Or le serveur annonce `11.0.0` : la condition était **toujours fausse**. Conséquences en chaîne, y
compris sur un Render parfaitement configuré :

- la page ne se connectait **jamais** au serveur : elle basculait en mode autonome (commandes dans
  le navigateur, aucun WebSocket `/voice`) ;
- l'option **Streaming** restait grisée « indisponible » dans les réglages, quelle que soit la
  configuration Render ;
- la synthèse retombait donc sur les **voix du navigateur**, qui n'ont aucune voix `ar-TN` sur la
  plupart des téléphones → message « aucune voix arabe », autrement dit **pas de voix tunisienne**.

C'est exactement ce que vous décriviez : la V11 *aurait dû* parler derja, mais rien de tout cela
n'existait en pratique.

### 1.2 Deux clés payantes étaient exigées là où une seule clé gratuite suffit

L'ancien serveur activait le streaming *uniquement* si **Deepgram** (reconnaissance) **et**
**Baarcha** (voix) étaient configurés tous les deux :

```js
const streamingAvailable = !!(env.DEEPGRAM_API_KEY && env.BAARCHA_API_KEY);   // ❌ ancien code
```

Résultat : sans compte Deepgram (payant au-delà des crédits d'essai), le mode le plus intéressant
restait éteint — d'où l'impression que « ça n'existe pas ». Or **Baarcha couvre les deux sens** :

| Besoin | Modèle tunisien | Endpoint |
|---|---|---|
| Voix (synthèse) | **Dido** (613 M) | `POST /api/v1/audio/speech` → WAV **24 kHz mono PCM 16 bits** |
| Reconnaissance | **Fennec** (581 M) | `POST /api/v1/audio/transcriptions` → `{ "text": … }` (`language: aeb`) |

### 1.3 La reconnaissance Fennec est en « fichier », pas en flux continu

Fennec n'expose pas de WebSocket de transcription continue : le code devait donc découper
lui-même la parole en segments. L'ancienne V11 utilisait Deepgram pour ce rôle, ce qui rendait la
voix tunisienne dépendante d'un service tiers payant.

---

## 2. La solution gratuite (vérifiée le 2 octobre 2026)

### Option A — Baarcha (recommandée) : vraie voix tunisienne, aucune carte bancaire

[Baarcha](https://baarcha.tn) est une plateforme tunisienne dont les modèles sont **nés pour la
derja** (`aeb`, ISO 639-3), pas un accent arabe standard plaqué sur du dialecte :

- compte **gratuit**, connexion Google, **aucune carte bancaire** (plan Free) ;
- **crédit d'essai unique offert** à l'ouverture du compte pour l'API, le playground et les clés ;
- tarifs API : **Dido 10 TND / 1 000 000 de caractères** (≈ 1 million de caractères ≈ 20 h de voix),
  **Fennec 5 TND / heure d'audio** ;
- l'API répond en mode `live` (`GET https://baarcha.tn/api/health` → `{"mode":"live"}`), les trois
  modèles sont disponibles : `hannibal` (chat), `fennec` (transcription), `dido` (voix).

Avec le crédit d'essai, la démonstration complète (des dizaines de phrases) **tient entièrement dans
l'enveloppe gratuite**. Et comme Ordely met désormais les phrases en **cache disque**, chaque phrase
déjà rendue est rejouée sans consommer un seul caractère de crédit.

**Mise en route (5 minutes)**

1. Ouvrez <https://baarcha.tn/platform> → connexion Google → **Create key**.
   La clé ressemble à `pk_live_` suivi de 24 caractères ; elle n'est affichée **qu'une fois**.
2. Sur Render : **Environment** → *Add environment variable*
   - `BAARCHA_API_KEY` = votre clé `pk_live_…`
   - (facultatif) `BAARCHA_VOICE_ID` = `female` ou l'identifiant `vc_…` d'une voix clonée
3. **Save** → Render redéploie automatiquement (~1 minute).
4. Ouvrez la page, réglages → le mode **« Voix tunisienne (serveur) · micro du navigateur »** ou
   **« Streaming complet »** est désormais disponible.

> En local : `BAARCHA_API_KEY=pk_live_… npm start`, puis <http://localhost:10000>.

### Option B — Azure Speech (offre F0) : gratuit et **renouvelable chaque mois**

Les voix **natives tunisiennes** de Microsoft sont disponibles **sans frais** sur l'offre F0 :

| Ressource | Offre gratuite F0 | Voix / locales |
|---|---|---|
| Synthèse vocale | **500 000 caractères / mois**, jamais expirés | `ar-TN-HediNeural` (homme), `ar-TN-ReemNeural` (femme) |
| Reconnaissance | **5 heures d'audio / mois** | `ar-TN` pris en charge |

À utiliser comme **secours durable** : `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (+ `AZURE_VOICE`
facultatif) suffisent à activer la voix tunisienne, et `TTS_PROVIDER=azure` force ce moteur.

### Option C — 100 % gratuit, sans compte : les voix du navigateur

Le mode **Gratuit · voix du navigateur** ne demande aucune clé. Il reste dépendant des voix
installées sur l'appareil : **aucune voix `ar-TN` n'est garantie** (Android/Chrome propose souvent
`ar-XA` ou `ar-SA`). Depuis la V11.1, quand aucune voix arabe n'existe, le message vous oriente
explicitement vers le mode serveur au lieu de laisser la démo muette.

### Pour aller plus loin (open source, hors démo gratuite)

Ces pistes demandent un GPU ou un hébergement à vous ; elles sont utiles si vous voulez sortir de
tout fournisseur :

- **LinTO ASR arabe tunisien** — `linagora/linto-asr-ar-tn-0.1` (Kaldi/vosk, WER ~16–23 % sur
  corpus tunisiens, gestion du code-switching français).
- **Modèles XTTS v2 fine-tunés sur corpus tunisien** — qualité de clonage, à héberger vous-même.
- **Habibi** (2026) — suite TTS arabe multidialectale ouverte (F5-TTS), incluant les dialectes
  maghrébins.
- **Labess-7B** (Linagora) — LLM derja, utile si un jour Ordely ajoute un modèle de langage
  (rappel : le moteur d'Ordely n'en utilise **aucun**, tout est à base de règles).

### Ce qui a été écarté, et pourquoi

- **Deepgram** : Nova-3 supporte bien `ar-TN` (depuis le 27 janvier 2026), mais c'est un service
  payant au-delà des crédits d'essai → conservé comme option (`DEEPGRAM_API_KEY`), plus exigé.
- **ElevenLabs** : aucune voix tunisienne native, facturation à l'usage → option héritée seulement.
- **Voix « arabe standard » du navigateur** : comprise par un Tunisien, mais ce n'est pas du derja.

---

## 3. Ce qui a été corrigé dans le code (V11.1)

| Fichier | Correction |
|---|---|
| `public/assets/app.js` | **Bug du test de version** (`startsWith('10.')`) → toute version ≥ 10 est acceptée : la page se connecte enfin au serveur, même en 11.x. |
| `public/assets/app.js` | Les modes sont construits **selon ce que le serveur sait faire** : `Gratuit · voix du navigateur`, `Voix tunisienne (serveur) · micro du navigateur`, `Streaming complet`. |
| `public/assets/app.js` | Bascule automatique en mode gratuit si un mode serveur échoue (plus de démo bloquée), messages de diagnostic détaillés (moteurs réellement actifs, cache vocal). |
| `src/server.js` | Sélection automatique des moteurs : **une clé Baarcha suffit** (Dido **et** Fennec) ; Azure accepté en secours ; plus besoin de Deepgram. |
| `src/server.js` | Nouveau **mode `voice`** : voix tunisienne du serveur + reconnaissance du navigateur, sans aucune clé de reconnaissance. |
| `src/server.js` | **Cache disque de la voix** (`data/tts-cache`) : phrases déjà rendues rejouées à l'identique, sans réseau ni crédit. |
| `src/server.js` | `/api/config` et `/health` annoncent les modes et les moteurs (sans jamais exposer une clé) ; erreurs explicites avec le lien de création de clé. |
| `src/providers.js` | **Dido** robuste : découpage aux frontières de phrase (limite 5 000 caractères), réessai sur 429/502/503, lecture des en-têtes `X-Usage-*`, messages d'erreur actionnables (401, 413, 422 `fixture_no_render`…). |
| `src/providers.js` | **Fennec en flux** : VAD local, segments de 6 s maximum, multilpart WAV 16 kHz, texte provisoire pendant la phrase puis texte final — équivalent fonctionnel d'un WebSocket. |
| `src/providers.js` | **Azure Neural TTS** (`ar-TN-HediNeural` / `ar-TN-ReemNeural`) en PCM 24 kHz, interchangeable avec Dido. |
| `.env.example`, `render.yaml` | Variables documentées, clé Baarcha en `sync: false` (jamais dans le dépôt). |
| `scripts/verifier-deploiement.mjs` | Vérifie la version ≥ 10, les moteurs tunisiens, et **écoute réellement** le PCM derja diffusé par le serveur. |

### Les trois modes de la démo

| Mode | Reconnaissance | Voix | Clés nécessaires |
|---|---|---|---|
| `Gratuit · voix du navigateur` | navigateur | navigateur | aucune |
| `Voix tunisienne (serveur) · micro du navigateur` | navigateur | **Dido / Azure** | `BAARCHA_API_KEY` (gratuite) |
| `Streaming complet` | **Fennec** | **Dido / Azure** | `BAARCHA_API_KEY` (gratuite) |

---

## 4. Vérifier soi-même

```bash
npm test                                   # 82 tests unitaires (dont Baarcha Dido/Fennec, Azure, cache)
npm start                                  # puis http://localhost:10000
node scripts/verifier-deploiement.mjs https://VOTRE-SERVICE.onrender.com
```

Attendu sur un déploiement configuré :

```
✅ Voix tunisienne côté serveur — synthèse : baarcha · reconnaissance : baarcha · streaming complet
✅ API de configuration — modes : browser, voix, streaming · cache vocal actif
✅ Voix derja réellement diffusée — XX Ko de PCM 24 kHz reçus du serveur
```

Un essai de bout en bout a également été fait avec un faux service Baarcha local : la phrase
« وين العنوان بالضبط » a bien suivi le trajet micro → PCM 16 kHz → Fennec → moteur de commandes →
réponse derja → Dido → PCM 24 kHz → haut-parleur, et la deuxième session a rejoué le cache.

---

## 5. Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| « Streaming indisponible » / option grisée | Aucune clé de voix côté serveur | Ajoutez `BAARCHA_API_KEY` (gratuite) puis redéployez |
| « Clé Baarcha absente ou refusée (401) » | Clé absente, révoquée ou mal copiée | Recréez une clé sur <https://baarcha.tn/platform> ; elle n'est affichée qu'une fois |
| « Le modèle tunisien Dido se charge… (503) » | Modèle froid (les GPU Baarcha servent aussi l'entraînement) | Relancez la phrase : le serveur réessaie déjà automatiquement |
| « Baarcha répond en mode démonstration… » | Le déploiement Baarcha interrogé n'a pas de GPU (mode *fixtures*) | Utilisez l'API publique `https://baarcha.tn/api/v1` (mode `live`) |
| « Aucune voix arabe installée sur ce téléphone » | Mode 100 % navigateur sur un appareil sans voix arabe | Passez en **Voix tunisienne (serveur)** |
| La voix met 1–2 s à démarrer la première fois | Rendu Dido initial | Normal ; ensuite le cache disque répond instantanément |
| La conversation reste en texte | Micro refusé ou reconnaissance absente | Autorisez le micro (HTTPS obligatoire) ; le champ texte reste utilisable |

---

## 6. Rappel des limites honnêtes

- Le crédit d'essai Baarcha est **unique** : pour une utilisation quotidienne au-delà, prévoyez
  Azure F0 (renouvelé chaque mois) ou un plan payant.
- La qualité vocale dépend du modèle : Dido est entraîné sur de la derja réelle, avec le
  code-switching français ; les nombres et noms propres restent les points fragiles de tout TTS.
- Aucun enregistrement audio n'est conservé par Ordely : le serveur ne transmet que du PCM à lire,
  et les segments Fennec sont envoyés en mémoire, jamais écrits sur disque.
- `data/tts-cache` est **éphémère** sur Render (disque réinitialisé à chaque redéploiement) : c'est
  voulu pour une démonstration.
