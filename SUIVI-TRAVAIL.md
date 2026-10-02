# Suivi du travail — Ordely V11

**Projet** : Ordely – AI Voice Agent for Order Confirmation in Tunisia
**Dépôt analysé** : `mahdibenayed14-star/ordely`, branche `main`, dernier commit `7a79f13` (21/09/2026)
**Livrable** : `ordely-corrige` V11 — dossier exécutable + page publiée + archives
**Date de ce suivi** : 1er octobre 2026
**État global** : ✅ terminé pour le périmètre demandé — 67 tests unitaires et 54 tests navigateur réussis, 0 échec

---

## 1. Les cinq demandes initiales : état final

| # | Votre remarque | État | Preuve vérifiable |
|---|---|---|---|
| 1 | La conversation ne commence pas | ✅ Corrigé | Le client attend `session_ready` ; sans backend il démarre en autonome ; bascule automatique si le serveur vocal est injoignable. Test e2e « démarrage auto du salut », test serveur « attendre ready puis salut » |
| 2 | Le micro ne marche pas | ✅ Corrigé | Conditions HTTPS/permission vérifiées avant ouverture, messages précis par type d’erreur, bouton **Tester le micro**, capture AudioWorklet sans retour haut-parleur, repli automatique si le téléphone refuse le partage. Test e2e « permission refusée », « AudioWorklet réel » |
| 3 | Faut-il toucher un bouton « Parler » ? | ✅ Non | Un seul clic sur **Démarrer** ; écoute `continuous` relancée après chaque fin de session du moteur vocal. Test e2e « la reconnaissance se relance après onend » |
| 4 | Peut-on interrompre l’agent, est-il compris et répond-il ? | ✅ Oui | L’interruption coupe la lecture **sans arrêter la reconnaissance** ; la phrase finale part au moteur et reçoit une réponse au bon état. Tests e2e « interrompre coupe le TTS mais pas la reconnaissance », serveur « interruption streaming annule la production et conserve le contexte » |
| 5 | Transcription en direct invisible | ✅ Corrigé | Provisoire (`interimResults`) affiché en pointillés puis remplacé par le texte final, sans doublon ; réponse de l’agent affichée dès sa production. Tests e2e « provisoire puis final, sans doublon » et fournisseurs |

Complément : 11 bugs métier découverts pendant l’analyse et corrigés (« noir » pris pour un « non »,
« Oppo Reno **5** » pris pour une quantité de 5, « rappelle-moi mon adresse » transformé en rappel
téléphonique, commande pouvant être vidée, etc.). Détail : `docs/CORRECTIONS-V11.md`.

---

## 2. Journal du travail, dans l’ordre

1. **Repérage du dépôt** — identification du dépôt public correspondant au titre du projet et
   clonage local ; inventaire des fichiers, dont deux interfaces concurrentes (`index.html` racine
   et `public/index.html`) et un `server.js` réécrit en V9.
2. **Diagnostic** — lecture du serveur, des deux pages, du service worker et des données ; mise en
   évidence des causes techniques des cinq symptômes (voir tableau ci-dessus) et des 11 bugs métier.
3. **Choix du mode de test** — décision, avec vous, d’un mode **gratuit utilisable sur téléphone**
   (GitHub Pages) + d’un mode serveur Node avec **streaming facultatif**.
4. **Refonte du cœur métier** — un seul moteur (`public/assets/order-engine.js`) partagé navigateur
   et serveur : catalogue, quantités, couleurs, tailles, adresse, téléphone, prix, rappel,
   annulation, confirmation obligatoire avant écriture.
5. **Refonte vocale** — `voice.js` (reconnaissance continue, provisoire, interruption, lecture
   navigateur ou PCM 24 kHz), `audio-utils.js` + `mic-worklet.js` (rééchantillonnage 16 kHz sans
   dérive, VAD, sortie muette), `transport.js` (local ou WebSocket avec bascule automatique).
6. **Refonte serveur** — `src/server.js` (API, sessions, garde-fous, heartbeat, limites) et
   `src/providers.js` (voix derja Baarcha Dido, Azure ar-TN ; reconnaissance Fennec, Deepgram — options), base JSON écrite
   atomiquement, origines et quotas contrôlés.
7. **Refonte de l’interface** — page responsive (téléphone d’abord), commande fictive, réglages de
   voix, seuil d’interruption, bandeau d’état (micro / reconnaissance / agent), transcription avec
   horodatage, export `.txt`, panneau diagnostic, test micro et test son.
8. **Mode « fichier unique »** — génération de `index.html` et `telephone/index.html` (tout inclus,
   worklet en Blob) pour un dépôt minimal sur GitHub Pages.
9. **Tests** — 67 tests unitaires (moteur, audio, fournisseurs, serveur WebSocket, worklet) et
   54 tests navigateur (Chromium ordinateur, Chromium téléphone, WebKit iPhone), dont les scénarios
   d’échec : permission refusée, reconnaissance absente, moteur vocal bloqué, serveur injoignable.
10. **Sécurité et robustesse** — secrets absents du client, fichiers sensibles non servis (404
    vérifiés), origines contrôlées, limites de taille et de débit, `npm audit` sans vulnérabilité.
11. **Livraison** — démo en ligne, deux archives (`ordely-pour-github-pages.zip`, `ordely-corrige-V11.zip`),
    guides `ETAPES-ESSAI.md`, `JURY_DEMO.md`, `CHECKLIST.md`, `docs/*`, et script de publication
    `scripts/publier-sur-github.sh`.
12. **Suivi (ce document) et outillage** — ajout du **script de vérification de déploiement**
    `scripts/verifier-deploiement.mjs` (détection automatique serveur / site statique / page
    mono-fichier) et du **guide Render** `docs/DEPLOIEMENT-RENDER.md`.
13. **Publication encadrée** — préparation du dépôt `ordely-a-pousser` (historique d’origine
    conservé, avance rapide garantie), du script `scripts/tout-publier.sh` (envoi + attente de la
    publication + vérification), du contrôle `scripts/verifier-avant-demo.sh`, et du **lien de
    déploiement Render en un clic**. Vérifié : aucune identité GitHub n’est disponible dans
    l’environnement d’exécution, donc l’envoi final dépend d’une action de votre côté (3 options
    décrites dans `docs/METTRE-A-JOUR-GITHUB.md`, dont une sans aucun mot de passe).

---

## 3. Preuves produites

| Vérification | Résultat | Comment la refaire |
|---|---|---|
| Tests unitaires | **67 / 67** | `npm test` |
| Tests navigateur (3 profils) | **54 / 54** | `npm run test:e2e` |
| Contrôle de déploiement — serveur Node | **6 / 6** | `node scripts/verifier-deploiement.mjs http://localhost:10000` |
| Contrôle de déploiement — site statique (GitHub Pages) | **10 / 10** | `node scripts/verifier-deploiement.mjs https://compte.github.io/ordely/` |
| Contrôle de déploiement — page mono-fichier | **4 / 4** | `node scripts/verifier-deploiement.mjs https://…/index.html` servi en HTTP |
| Chaîne WebSocket réelle | `connected → session_ready → assistant → interrupted → user_final → assistant` | script de vérification |
| Dépôt prêt à pousser | historique d’origine conservé, avance rapide confirmée, 0 fichier sensible suivi | `git merge-base --is-ancestor origin/main HEAD` |
| Script de publication `tout-publier.sh` | testé sur un dépôt local (envoi réussi, 50 fichiers, modifications non validées incluses) et avec un jeton invalide (refus diagnostiqué, code de sortie 1, dépôt local intact) | `bash scripts/tout-publier.sh /tmp/origine.git` |
| Liaison réseau vers GitHub | vérifiée : GitHub répond et rejette une authentification invalide (`Invalid username or token`) — seul un jeton valide manque | `GITHUB_TOKEN=invalide bash scripts/tout-publier.sh` |
| Contrôle avant démonstration | **tout est prêt** (tests, page autonome, archives, service local 6/6) | `bash scripts/verifier-avant-demo.sh` |
| Sécurité | `/.env`, `/server.js`, `/data/database.json` → **404** | `curl -o /dev/null -w '%{http_code}'` |
| Dépendances | **0 vulnérabilité** (`npm audit`) | `npm audit --omit=dev` |
| Interface | captures `ordely-desktop.png`, `ordely-phone.png`, `ordely-conversation.png` | scripts Playwright du dossier `e2e/` |

---

## 3 bis. Mise à jour V11.1 — voix et reconnaissance tunisiennes (2 octobre 2026)

| Élément | État | Preuve |
|---|---|---|
| Bug bloquant corrigé : la page ignorait la configuration du serveur (`version.startsWith('10.')` alors que le serveur annonce 11.x) | ✅ | `public/assets/app.js` ; la page se connecte au serveur et propose les modes serveur |
| Une **seule clé Baarcha gratuite** suffit (Dido voix + Fennec reconnaissance) : plus besoin de Deepgram | ✅ | `resolveProviders()` + tests serveur ; `docs/SOLUTION-GRATUITE-DERJA.md` |
| Nouveau mode **« Voix tunisienne (serveur) · micro du navigateur »** | ✅ | test serveur « mode voix tunisienne » |
| Secours **Azure ar-TN** (offre F0 gratuite renouvelée, 500 000 caractères/mois) | ✅ | `streamSpeechAzure` + tests |
| **Cache disque** de la voix : phrases rejouées sans crédit | ✅ | test serveur « cache vocal » + journal `[voix] cache disque` |
| Chaîne complète vérifiée de bout en bout (faux Baarcha local) | ✅ | micro → Fennec → moteur → Dido → PCM 24 kHz (203 Ko mesurés) |
| Tests unitaires | **82 / 82** | `npm test` |
| Vérificateur de déploiement enrichi (moteurs tunisiens + audio réellement reçu) | ✅ | `node scripts/verifier-deploiement.mjs` → 8/8 en local |

---

## 4. Ce qui reste à faire

### 4.1 De votre côté (obligatoire pour l’essai téléphone)

Tout est préparé de mon côté ; ces trois actions ne peuvent pas être exécutées sans vos
identifiants GitHub, et je ne vous demanderai jamais de les saisir ici.

L’accès GitHub que vous avez annoncé **n’est pas arrivé jusqu’à l’environnement d’exécution** : contrôle
complet effectué le 1er octobre — aucune variable `GITHUB_TOKEN`/`GH_TOKEN`, aucun fichier
`~/.git-credentials` ou `~/.netrc`, aucune clé SSH, `gh` absent, aucun motif de jeton dans les fichiers.
La liaison réseau vers GitHub, elle, fonctionne (un envoi de test a été rejeté pour authentification
invalide, ce qui est le comportement attendu). Il ne manque donc **que** l’identifiant.

| Tâche | Où | Durée | Guide |
|---|---|---|---|
| Envoyer la V11 sur GitHub | **option A** : `ordely-pour-github-pages.zip` → *Add file → Upload files* (aucun identifiant à gérer) | ~5 min | `docs/METTRE-A-JOUR-GITHUB.md` chemin 1 |
| | **option B** : `ordely-pret-a-pousser-git.zip` + `bash scripts/tout-publier.sh` avec un jeton limité au dépôt (7 jours, *Contents : Read and write*), révoqué ensuite | ~5 min | `docs/METTRE-A-JOUR-GITHUB.md` chemins 2 et 3 |
| | **option C** : GitHub Desktop → *Add local repository* → *Push origin* (aucun jeton) | ~5 min | même guide, variante sans terminal |
| Activer la publication | Settings → Pages → *GitHub Actions* (ou *Deploy from a branch*, main, /(root)) | 1 min | `ETAPES-ESSAI.md` partie A2 |
| Tester puis démontrer | page publiée : micro, son, interruption | 4 min | `ETAPES-ESSAI.md` parties A4-A7 et `JURY_DEMO.md` |

Vérification après publication, sans rien installer d’autre :
`node scripts/verifier-deploiement.mjs https://mahdibenayed14-star.github.io/ordely/` → attendu **10/10**.

Contrôle avant de faire la démonstration : `bash scripts/verifier-avant-demo.sh` (tests, page
autonome, archives, service local, documents) → « ✅ TOUT EST PRÊT ».

### 4.2 De mon côté, si vous le souhaitez (facultatif)

| Suite possible | Intérêt | Prérequis |
|---|---|---|
| Voix tunisienne derja active en démonstration | La démo parle et comprend la derja (Dido + Fennec), indépendamment du téléphone | **une clé Baarcha gratuite** (sans carte) : `docs/SOLUTION-GRATUITE-DERJA.md` |
| Interface en arabe (RTL) en plus du français | Cohérence avec le public tunisien | — |
| Scénarios supplémentaires (autre client, produit en rupture, incident de livraison) | Jury plus convaincu | — |
| Adaptateur téléphonie (Twilio/SIP) | Appel téléphonique réel, hors périmètre actuel | compte opérateur |

---

## 5. Comment suivre le travail vous-même

- **État du service** : ouvrez `<url>/health` → doit répondre `{"ok":true,"version":"11.0.0",…}`.
- **Contrôle complet** : `node scripts/verifier-deploiement.mjs <url>` → 6 lignes, plus la liste des
  pistes si un contrôle échoue.
- **Pendant la démonstration** : le panneau **Diagnostic et limites du mode gratuit** de la page
  affiche en direct micro, reconnaissance, connexion, persistance et journal technique.
- **Traçabilité** : bouton **↓ Texte** → transcription horodatée (`ordely-transcription-AAAA-MM-JJ.txt`).
- **Reproductibilité** : `npm test` (moteur) et `npm run test:e2e` (interface) doivent rester verts ;
  toute régression sur vos cinq remarques est ainsi détectée automatiquement.

---

## 6. Points de vigilance suivis

| Sujet | Risque | Traitement en place |
|---|---|---|
| Service vocal du navigateur | Indisponible selon appareil/réseau (réseaux d’entreprise, iPhone anciens) | Messages d’erreur précis, bouton **Relancer l’écoute**, repli texte, mode streaming facultatif |
| Écho sans casque | L’agent s’interrompt tout seul | Seuil d’interruption réglable, seuil relevé pendant la lecture, repli « micro natif », recommandation du casque |
| Veille d’un hébergement gratuit | Premier appel lent (~1 min) | Bascule automatique en mode autonome, message clair, script de vérification avec nouvelles tentatives |
| Données | Fuite de clés ou de base | Aucune clé côté client, fichiers sensibles en 404, `data/` non versionnée |
| Démonstration | Répétition du scénario | Bouton **Réinitialiser les commandes de démo** + `CHECKLIST.md` |

---

**Signature du travail** : les cinq remarques de départ sont traitées, testées et documentées ; le
dossier est exécutable, la page est en ligne, et deux archives sont fournies pour publication ou
sauvegarde. Les seules tâches restantes dépendent de votre compte GitHub, ou de votre accord pour
la suite facultative (Render, interface arabe, scénarios supplémentaires).
