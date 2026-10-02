# Ordely V11.1 — voix tunisienne Baarcha (Dido) + reconnaissance (Fennec)

Baarcha est une plateforme tunisienne : ses modèles sont entraînés sur de la derja réelle
(`aeb`), pas sur de l'arabe standard. Ordely s'y connecte via une API compatible OpenAI.

## Une seule clé gratuite pour les deux sens

| Capacité | Modèle | Endpoint | Coût |
|---|---|---|---|
| Voix (synthèse) | **Dido** | `POST https://baarcha.tn/api/v1/audio/speech` | 10 TND / 1 M caractères |
| Reconnaissance | **Fennec** | `POST https://baarcha.tn/api/v1/audio/transcriptions` | 5 TND / heure d'audio |

Clé : <https://baarcha.tn/platform> (connexion Google, **sans carte bancaire**). Nouveau compte :
crédit d'essai offert. La clé (`pk_live_…`) reste **côté serveur** dans `BAARCHA_API_KEY`.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `BAARCHA_API_KEY` | **La seule obligatoire** pour la voix derja : Dido + Fennec |
| `BAARCHA_VOICE_ID` | Facultatif : `female` ou l'identifiant d'une voix clonée `vc_…` (liste : `GET /api/v1/voices`) |
| `BAARCHA_STT_SEGMENT_MS` | Facultatif : durée d'un segment de reconnaissance (défaut 6000 ms) |
| `TTS_CACHE` | `true` par défaut : les phrases déjà rendues sont rejouées sans consommer de crédit |
| `TTS_PROVIDER` | `baarcha` \| `azure` \| `elevenlabs` — force le moteur de voix |
| `STT_PROVIDER` | `baarcha` \| `deepgram` — force le moteur de reconnaissance |

## Détails d'intégration utiles

- **Dido** renvoie un **WAV 24 kHz mono 16 bits** (`response_format: "wav"`), exactement le format
  attendu par le lecteur PCM du navigateur. Le texte est limité à **5 000 caractères** par requête :
  Ordely découpe aux frontières de phrase et enchaîne les morceaux.
- Les en-têtes `X-Usage-Characters` et `X-Usage-Audio-Seconds` sont journalisés à chaque rendu : vous
  savez précisément ce que consomme la démo.
- Les erreurs suivent l'enveloppe OpenAI (`error.type`, `error.code`). Ordely les traduit en messages
  actionnables : `401` (clé), `429` (débit), `503 model_not_available` (modèle froid, réessayé
  automatiquement), `422 fixture_no_render` (déploiement en mode démonstration).
- **Fennec** n'a pas de WebSocket : Ordely fait la découpe lui-même (VAD local, segments ≤ 6 s,
  WAV 16 kHz en `multipart/form-data`), publie un texte provisoire pendant la phrase, puis le texte
  final. L'audio n'est jamais écrit sur disque.
- Mode d'un déploiement Baarcha : `GET https://baarcha.tn/api/health` → `{"mode":"live"}`. En mode
  `fixtures` (sans GPU), seules quelques phrases d'exemple disposent d'un audio : Ordely l'explique
  au lieu de renvoyer du faux.

## Mode de secours

- **Azure Speech F0** (gratuit renouvelé) : `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` →
  voix `ar-TN-HediNeural` / `ar-TN-ReemNeural`, 500 000 caractères/mois.
- **Sans aucune clé** : mode gratuit, reconnaissance et voix du navigateur (aucune voix `ar-TN`
  garantie).

Guide complet, coûts et dépannage : [SOLUTION-GRATUITE-DERJA.md](SOLUTION-GRATUITE-DERJA.md).
