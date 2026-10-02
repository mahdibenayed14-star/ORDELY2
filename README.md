# Ordely — démo vocale de confirmation de commandes (Tunisie)

Version corrigée **V11** du dossier `ordely`. Objectif : lancer une conversation vocale en derja
tunisienne qui **démarre toute seule**, **écoute sans bouton** et **affiche la transcription en
direct**, avec possibilité d’**interrompre l’agent**.

## Lancer la démo maintenant

1. **Lien immédiat** : ouvrez le panneau **Live Preview** de cette conversation
   (« Ordely — démo vocale gratuite »). Le micro est bloqué dans le cadre d’aperçu : cliquez sur le
   bandeau **« Ouvrir l’application ↗ »** pour basculer dans un onglet normal, puis **🎙 Tester le
   micro** et **▶ Démarrer**. Ce lien vit tant que l’espace de travail est ouvert.
2. **Lien permanent sur votre compte** (recommandé pour la démonstration au jury) : publiez le
   dossier sur GitHub Pages — voir **[ETAPES-ESSAI.md](ETAPES-ESSAI.md)**, partie A.
   Une seule commande suffit si un identifiant GitHub est disponible :
   ```bash
   bash scripts/tout-publier.sh          # envoie les commits, attend la publication, puis vérifie le site
   ```
   Sans identifiant, utilisez `ordely-pour-github-pages.zip` (Upload files dans le navigateur).
3. **Serveur + voix streaming (facultatif, vos clés)** : déploiement en un clic sur Render —
   <https://render.com/deploy?repo=https://github.com/mahdibenayed14-star/ordely>
   (détails : [docs/DEPLOIEMENT-RENDER.md](docs/DEPLOIEMENT-RENDER.md)).

## Archives à télécharger

| Fichier | Contenu | Usage |
|---|---|---|
| `ordely-pour-github-pages.zip` | la page publiée + `assets/` + la notice d’hébergement | à décompresser **à la racine** du dépôt GitHub (Add file → Upload files), puis Pages → *Deploy from a branch* |
| `ordely-pret-a-pousser-git.zip` | dépôt git **prêt à pousser**, avec l’historique d’origine conservé | `bash scripts/pousser-vers-github.sh` → mise à jour complète en une commande, sans risque d’écrasement |
| `ordely-corrige-V11.zip` | le projet complet (code, tests, docs, serveur) | essai local avec `npm start`, hébergement Node/Render, publication via `.github/workflows/pages.yml` |

Mise à jour du dépôt GitHub : **[docs/METTRE-A-JOUR-GITHUB.md](docs/METTRE-A-JOUR-GITHUB.md)**
(chemin sans Git en 5 minutes, ou chemin Git en une commande avec jeton d’accès personnel).

Le dossier contient deux façons d’utiliser la même application :

| | Mode gratuit (recommandé pour le téléphone) | Mode serveur Node.js |
|---|---|---|
| Fichier à publier | `public/` sur GitHub Pages, ou un seul fichier `index.html` | tout le dépôt, avec `npm start` |
| Reconnaissance | API vocale du navigateur | API vocale du navigateur (gratuit), **Fennec** (tunisien), ou Deepgram (facultatif) |
| Voix de l’agent | Voix système du navigateur | Voix système, ou **voix tunisienne Dido** (clé Baarcha gratuite) |
| Commandes de démo | Enregistrées **sur votre téléphone** | Enregistrées sur le serveur, en JSON |
| Clés API | Aucune | Aucune pour le gratuit ; **une clé Baarcha gratuite** suffit pour la voix derja |

Le moteur de commande n’appelle **aucun modèle de langage** : chaque opération est validée par
règles, donc la démo ne peut pas inventer une modification. Seules la reconnaissance vocale et la
voix dépendent d'un fournisseur : le navigateur (Google pour Chrome/Android, Apple pour Safari/iOS)
en mode gratuit, ou les modèles tunisiens Dido/Fennec en mode serveur.

## Démarrer en 1 commande (ordinateur)

```bash
npm install
npm start
```
Puis ouvrez `http://localhost:10000`. Laissez **Mode = Gratuit** et cliquez sur **Démarrer**.

## Démarrage sur téléphone (gratuit, HTTPS)

Voir le pas à pas détaillé : **[ETAPES-ESSAI.md](ETAPES-ESSAI.md)**.
Résumé : publiez le dossier `public/` sur GitHub Pages (ou copiez `index.html` sur n’importe quel
hébergement HTTPS), ouvrez le lien dans **Chrome Android** ou **Safari iPhone**, autorisez le micro,
puis cliquez une seule fois sur **Démarrer**.

## Ce qui a été corrigé

Détail cause → correction → test : **[docs/CORRECTIONS-V11.md](docs/CORRECTIONS-V11.md)**.
Les cinq points signalés :

1. **La conversation ne démarrait pas** — l’ancienne page écoutait un serveur absent (ou qui ne
   répondait pas) ; il fallait en plus envoyer `select` puis `start`. Désormais le démarrage est
   **écouté par accusé de réception** (`session_ready`), et sans backend l’application fonctionne
   en autonome : le premier message de l’agent arrive automatiquement.
2. **Le micro ne marchait pas** — conditions HTTPS/permission réelles, messages de diagnostic
   précis, test micro séparé, et repli automatique si un téléphone refuse la capture.
3. **Faut-il toucher un bouton « Parler » ?** — Non : un seul clic sur **Démarrer** suffit, puis
   l’écoute est continue et relancée automatiquement.
4. **Peut-on interrompre l’agent ?** — Oui : dès que votre voix est détectée, la lecture est coupée
   immédiatement, l’interruption est affichée, et **la reconnaissance n’est plus arrêtée** comme
   avant. La phrase interrompue continue d’être comprise et reçoit une réponse.
5. **Transcription en direct absente** — les résultats provisoires du moteur vocal s’affichent
   dans la conversation avec la mention « Transcription en cours… », puis le texte final remplace le
   provisoire, sans doublon.

## Limites honnêtes du mode gratuit

- La reconnaissance et la voix **appartiennent au navigateur** : la qualité en derja tunisienne
  dépend de l’appareil. Aucune voix « ar-TN » garantie.
- Sur certains téléphones **sans casque**, le micro entend le haut-parleur : le niveau RMS/VAD est
  alors désactivé automatiquement pour laisser le service natif gérer le micro, et l’interruption
  passe par la détection de parole du service vocal.
- L’application s’arrête volontairement quand elle passe en arrière-plan (confidentialité) : sur
  iPhone, gardez l’écran allumé. Un bouton **Relancer l’écoute** est disponible.
- **Aucun enregistrement audio n’est conservé** par Ordely. En mode GitHub Pages, les commandes de
  démo restent dans le navigateur. La transcription peut être téléchargée en `.txt`.
- Pas d’appel téléphonique réel : la demande de rappel est enregistrée, jamais planifiée.

## Structure du dossier

```
ordely-corrige/
├── index.html               # page téléphone autonome (tout inclus, à copier seul si besoin)
├── public/                  # application complète (source + version GitHub Pages)
│   ├── index.html           # interface
│   ├── sw.js                # cache hors ligne (interface uniquement)
│   ├── demo-data.json       # base de démonstration
│   └── assets/              # app.js, voice.js, order-engine.js, audio-utils.js, mic-worklet.js, transport.js, styles.css
├── server.js                # serveur Express + WebSocket
├── src/server.js            # endpoints, sessions, orchestration
├── src/providers.js         # voix derja (Baarcha Dido, Azure ar-TN) + reconnaissance (Fennec, Deepgram)
├── tests/                   # 82 tests unitaires (moteur, audio, fournisseurs, serveur, worklet)
├── e2e/                     # 51 tests navigateur (Chromium téléphone/ordinateur, WebKit iPhone)
├── scripts/build-phone.mjs  # génère index.html et telephone/index.html
├── scripts/verifier-deploiement.mjs  # contrôle un déploiement en 6 points
├── scripts/publier-sur-github.sh     # publie sur GitHub sans écraser main
├── scripts/creer-dossier-zip.sh
├── SUIVI-TRAVAIL.md         # état d’avancement et preuves
├── ETAPES-ESSAI.md          # pas à pas d’essai
├── JURY_DEMO.md             # scénario de démonstration de 3 minutes
├── CHECKLIST.md             # liste à cocher avant la démonstration
├── .env.example             # variables, aucune clé obligatoire
├── render.yaml / .github/workflows/pages.yml
└── docs/                    # architecture, corrections, API
```

## Commandes utiles

```bash
npm start            # serveur local + interface
npm test             # 82 tests unitaires
npm run test:e2e     # 54 tests navigateur (nécessite `npx playwright install chromium webkit`)
npm run phone        # reconstruit index.html et telephone/index.html
npm run dev          # serveur avec rechargement automatique
bash scripts/verifier-avant-demo.sh          # contrôle complet du dossier avant la démonstration
node scripts/verifier-deploiement.mjs <url>  # contrôle un déploiement (local, Pages, Render)
bash scripts/tout-publier.sh                 # publie sur GitHub puis vérifie le site publié
```

Suivi du travail et état d’avancement : **[SUIVI-TRAVAIL.md](SUIVI-TRAVAIL.md)**.
Déploiement serveur et streaming facultatif : **[docs/DEPLOIEMENT-RENDER.md](docs/DEPLOIEMENT-RENDER.md)**.

## Voix et reconnaissance tunisiennes (derja) — gratuit, en 5 minutes

La démo peut parler **vraiment derja** grâce à [Baarcha](https://baarcha.tn), plateforme tunisienne :

| Capacité | Modèle | Clé |
|---|---|---|
| Voix | **Dido** (613 M, derja + code-switching français) | `BAARCHA_API_KEY` |
| Reconnaissance | **Fennec** (581 M, parole tunisienne) | la **même** clé |

1. Créez une clé gratuite sur <https://baarcha.tn/platform> (connexion Google, **sans carte
   bancaire**) : elle ressemble à `pk_live_…` et couvre **les deux** usages.
2. Sur Render (ou dans un fichier `.env` local) : `BAARCHA_API_KEY=pk_live_…` puis redéployez.
3. Dans les réglages de la page, choisissez **« Voix tunisienne (serveur) · micro du navigateur »**
   ou **« Streaming complet »**. Rien à installer sur le téléphone.

Sans aucune clé, la démo reste utilisable : **« Gratuit · voix du navigateur »**. Une voix `ar-TN`
n'est alors pas garantie (c'est une limite du navigateur, pas d'Ordely).

- Les phrases déjà rendues sont mises en **cache disque** : la démonstration est rejouable à
  l'identique **sans consommer de crédit**.
- Secours gratuit et **renouvelé chaque mois** : la voix Azure `ar-TN-HediNeural` / `ar-TN-ReemNeural`
  (offre F0 : 500 000 caractères/mois) via `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`.
- Deepgram (`DEEPGRAM_API_KEY`, `nova-3` en `ar-TN`) et ElevenLabs restent possibles en option, mais
  **ne sont plus nécessaires**.

### Correction V11.1 — le serveur est enfin utilisé par la page

L'ancien code n'adoptait la configuration du serveur que si la version commençait par `10.` ; la
version étant `11.0.0`, la page ne se connectait **jamais** au serveur : ni voix tunisienne, ni
streaming, même sur un Render correctement configuré. C'est corrigé, et les modes s'affichent
désormais selon ce que le serveur sait réellement faire.

Détails, coûts, alternatives open source et dépannage :
**[docs/SOLUTION-GRATUITE-DERJA.md](docs/SOLUTION-GRATUITE-DERJA.md)** · contrat d'API :
**[docs/BAARCHA-V11.md](docs/BAARCHA-V11.md)**.
