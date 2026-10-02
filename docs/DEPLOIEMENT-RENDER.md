# Déployer Ordely sur Render (serveur Node, voix tunisienne gratuite)

Objectif : obtenir une URL HTTPS **permanente** qui exécute `server.js`, afin d'utiliser la
**voix tunisienne derja** (Dido) et, si vous le souhaitez, la **reconnaissance tunisienne** (Fennec).

> **Rappel important** : le mode gratuit n'a **pas** besoin de Render. Il fonctionne sur GitHub Pages
> sans serveur. Render n'est nécessaire que pour (a) une base de démonstration côté serveur,
> ou (b) la **voix tunisienne** et le **streaming**. Les clés restent toujours en variables
> d'environnement, jamais dans le dépôt ni dans `public/`.

---

## 1. Prérequis

- Un compte Render (plan **Free** suffisant, WebSockets inclus).
- Le dépôt GitHub contenant **le projet complet** (pas seulement la page statique) : `server.js`,
  `src/`, `public/`, `package.json`, `package-lock.json`, `render.yaml`.
- **Une clé Baarcha gratuite** (recommandé) : <https://baarcha.tn/platform> — connexion Google,
  **aucune carte bancaire**, crédit d'essai offert. La clé ressemble à `pk_live_…` et n'est affichée
  qu'une fois. Elle couvre la voix (Dido) **et** la reconnaissance (Fennec).
- Facultatif : une clé **Azure Speech** (offre F0 : 500 000 caractères/mois de voix `ar-TN` +
  5 heures/mois de reconnaissance, gratuit et renouvelé) comme secours durable.

---

## 2. Déploiement en 6 étapes

1. Sur Render : **New → Web Service** (ou **New → Blueprint** pour utiliser le `render.yaml` fourni,
   qui préremplit les réglages et déclare `BAARCHA_API_KEY` en `sync: false`).
2. **Connect a repository** : autorisez GitHub si nécessaire, puis choisissez le dépôt Ordely.
3. Réglez la branche (ex. `main`) et les commandes :
   - **Build Command** : `npm ci --omit=dev`
   - **Start Command** : `npm start`
   - **Health Check Path** : `/health`
4. **Instance Type** : `Free`.
5. Onglet **Environment** : ajoutez au minimum `NODE_ENV=production`, puis `BAARCHA_API_KEY`
   (c'est **la seule clé nécessaire** pour la voix tunisienne).
6. **Create Web Service**. Le déploiement prend 1 à 3 minutes ; l'état doit passer au vert, et le
   journal doit afficher `Ordely V11 : http://localhost:…`.

---

## 3. Variables d'environnement

| Nom | Requis | Exemple | Rôle |
|---|---|---|---|
| `NODE_ENV` | recommandé | `production` | Réglages de production |
| `BAARCHA_API_KEY` | **voix derja** | `pk_live_…` | Dido (voix) **et** Fennec (reconnaissance) — une seule clé |
| `BAARCHA_VOICE_ID` | facultatif | `female` | Voix Dido précise, ou identifiant d'une voix clonée `vc_…` |
| `AZURE_SPEECH_KEY` | secours | `…` | Voix `ar-TN` Azure (offre F0 gratuite), si Baarcha indisponible |
| `AZURE_SPEECH_REGION` | avec la précédente | `westeurope` | Région de la ressource Azure Speech |
| `AZURE_VOICE` | facultatif | `ar-TN-HediNeural` | Voix Azure : `ar-TN-HediNeural` (H) ou `ar-TN-ReemNeural` (F) |
| `TTS_CACHE` | facultatif | `true` | Rejoue les phrases déjà rendues **sans consommer de crédit** |
| `TTS_PROVIDER` / `STT_PROVIDER` | facultatif | `baarcha` | Force un moteur (`azure`, `deepgram`… sinon choix automatique) |
| `DEEPGRAM_API_KEY` | facultatif | `…` | Reconnaissance Deepgram nova-3 (`ar-TN`, depuis janvier 2026) |
| `ENABLE_DEMO_RESET` | facultatif | `true` | Autorise le bouton **Réinitialiser les commandes de démo** |
| `DATA_FILE` | facultatif | `./data/database.json` | Chemin de la base JSON de démonstration |
| `STREAM_MAX_MINUTES` | facultatif | `10` | Plafond de durée d'une session streaming (1 à 30) |

**Aucune clé n'est obligatoire** : sans variable, la démo reste utilisable (voix et reconnaissance du
navigateur). Les modes proposés à l'écran s'adaptent automatiquement :

| Mode affiché | Reconnaissance | Voix | Clés |
|---|---|---|---|
| Gratuit · voix du navigateur | navigateur | navigateur | aucune |
| Voix tunisienne (serveur) · micro du navigateur | navigateur | **Dido / Azure** | clé de voix |
| Streaming complet · reconnaissance + voix du serveur | **Fennec** | **Dido / Azure** | clé de voix (+ STT) |

---

## 4. Vérifier le déploiement

1. **Contrôle automatique** :
   ```bash
   node scripts/verifier-deploiement.mjs https://VOTRE-SERVICE.onrender.com
   ```
   Attendu : `8/8 contrôles réussis`, dont **« Voix tunisienne côté serveur »** et
   **« Voix derja réellement diffusée »** (le script écoute réellement le PCM 24 kHz renvoyé) ;
   il confirme aussi les démarrages vocaux en français et en derja.
2. **Navigateur** : ouvrez l'URL, **🎙 Tester le micro**, **♪ Tester le son**, puis **▶ Démarrer**
   avec le mode `Voix tunisienne (serveur)` ou `Streaming complet`.
3. **Téléphone** : ouvrez la même URL HTTPS dans Chrome/Safari, comme décrit dans `ETAPES-ESSAI.md`.

---

## 5. Comportements à connaître

- **Mise en veille du plan gratuit** : le service s'endort après une période d'inactivité ; le
  premier appel peut prendre jusqu'à une minute. La page Ordely le gère : si le serveur vocal ne
  répond pas, elle **bascule automatiquement** en mode gratuit avec un message explicite.
- **Cache vocal** : `data/tts-cache` garde les phrases déjà rendues, ce qui **économise le crédit
  gratuit** et rend la démonstration rejouable à l'identique. Sur Render, ce dossier est
  **éphémère** : il repart à zéro à chaque redéploiement (voulu pour une démo).
- **Crédits** : le crédit d'essai Baarcha est unique (il couvre largement une démonstration) ;
  l'offre Azure F0, elle, se **renouvelle chaque mois** (500 000 caractères + 5 h d'audio).
- **Interruption** : dès que vous parlez, la synthèse est annulée côté serveur (contexte conservé).
- **Sécurité** : ne mettez jamais ces clés dans le dépôt ni dans `public/`. Les origines WebSocket
  sont contrôlées ; l'API n'expose que des commandes de démonstration.

---

## 6. Revenir en arrière

- **Désactiver la voix serveur** : supprimez `BAARCHA_API_KEY` (et `AZURE_SPEECH_KEY`), puis
  redéployez. L'application repasse en mode gratuit, sans autre changement.
- **Supprimer le service** : Render → **Settings → Delete Web Service**. La page GitHub Pages
  continue de fonctionner indépendamment.

---

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le déploiement échoue au build | `package-lock.json` absent (nécessaire à `npm ci`) | Poussez le fichier, ou remplacez la commande par `npm install` |
| `/health` ne répond pas tout de suite | Service en veille (plan gratuit) | Attendez ~1 min, puis relancez le contrôle |
| « Streaming indisponible » dans les réglages | Aucune clé de voix côté serveur | Ajoutez `BAARCHA_API_KEY`, redéployez |
| « Clé Baarcha absente ou refusée (401) » | Clé absente, révoquée ou mal copiée | Recréez une clé sur <https://baarcha.tn/platform> |
| « Le modèle tunisien Dido se charge… (503) » | Modèle froid | Relancez la phrase : le serveur réessaie déjà tout seul |
| « Baarcha répond en mode démonstration » | Déploiement Baarcha sans GPU (mode *fixtures*) | Interrogez l'API publique `https://baarcha.tn/api/v1` |
| « Deepgram a refusé la connexion (401/402) » | Clé invalide ou crédits épuisés (usage optionnel) | Vérifiez la clé ; `ar-TN` exige `nova-3` |
| La session se ferme avec « Limite de durée atteinte » | Plafond `STREAM_MAX_MINUTES` atteint | Redémarrez la session, ou augmentez la valeur (max 30) |
| La page affiche « Serveur vocal injoignable : bascule autonome » | WebSocket impossible (réseau, veille, proxy) | Réessayez après ~1 min ; le mode gratuit a pris le relais |

Approfondissement : [SOLUTION-GRATUITE-DERJA.md](SOLUTION-GRATUITE-DERJA.md) (coûts, alternatives,
open source) et [BAARCHA-V11.md](BAARCHA-V11.md) (contrat d'API).
