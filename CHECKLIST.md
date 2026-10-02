# Liste à cocher avant l’essai / la démonstration

## Publication (une seule fois)

- [ ] Le dépôt GitHub contient bien `public/` avec `public/assets/` et le fichier `index.html`.
- [ ] Le workflow `.github/workflows/pages.yml` est présent dans le dépôt.
- [ ] **Settings → Pages → Source = GitHub Actions**.
- [ ] L’onglet **Actions** montre un dernier déploiement en vert.
- [ ] L’URL `https://…github.io/ordely/` s’ouvre sur ordinateur.
- [ ] Aucune clé API n’a été écrite dans `public/` ni dans le dépôt (uniquement des variables
      d’environnement côté serveur, et encore : elles sont **facultatives**).

## Voix tunisienne derja (facultatif mais recommandé)

- [ ] Une clé **Baarcha** gratuite a été créée sur <https://baarcha.tn/platform> (connexion Google,
      sans carte bancaire) et saisie dans `BAARCHA_API_KEY` **côté serveur** (Render → Environment).
- [ ] `node scripts/verifier-deploiement.mjs <url>` affiche **« Voix tunisienne côté serveur »** et
      **« Voix derja réellement diffusée »**.
- [ ] Dans les réglages, le mode choisi est **« Voix tunisienne (serveur) »** ou
      **« Streaming complet »** — plus « Gratuit · voix du navigateur ».
- [ ] La première phrase est un peu plus lente (rendu Dido) : les suivantes sortent du **cache**.
- [ ] Si besoin de secours : `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (voix `ar-TN`, offre F0).
- [ ] Aucune clé n’apparaît dans le dépôt, dans `public/` ou dans le diagnostic de la page.

## Sur l’appareil d’essai

- [ ] Le lien est ouvert dans **Chrome Android** ou **Safari iPhone** (pas une fenêtre intégrée).
- [ ] La barre d’adresse affiche `https://`.
- [ ] **🎙 Tester le micro** : la barre bouge quand je parle.
- [ ] **♪ Tester le son** : j’entends le bip, volume médias monté, mode silencieux désactivé.
- [ ] Un casque est disponible.
- [ ] Batterie suffisante / téléphone branché, veille désactivée si possible.

## Pendant l’essai

- [ ] Un clic sur **▶ Démarrer** → ordinateur et téléphone demandent le micro → j’autorise.
- [ ] Ordely **parle en premier** sans que j’appuie sur autre chose.
- [ ] Le statut passe à **« À vous — Ordely écoute »** après sa phrase.
- [ ] Je peux parler **sans bouton** ; ma phrase s’affiche en provisoire puis en final.
- [ ] Je peux **interrompre** : la voix s’arrête, la bulle affiche « Interrompu », et il répond.
- [ ] Le compteur **Reconnaissance** reste sur **ÉCOUTE** pendant sa réponse (et non « OFF »).
- [ ] En mode **Streaming complet**, la phrase tunisienne entendue est transcrite en arabe (Fennec),
      et non approximée par le navigateur.
- [ ] Une modification de commande (produit, quantité, adresse, prix) se reflète dans le panneau.
- [ ] Une annulation demande **« oui »** avant d’agir.
- [ ] **■ Arrêter** libère le micro (le statut capture passe à OFF) et pas question de redémarrage
      silencieux : l’arrêt est explicite.

## Avant chaque nouvelle démonstration

- [ ] **■ Arrêter**
- [ ] **Réinitialiser les commandes de démo** → confirmation
- [ ] Recharger la page si nécessaire (**Recharger la dernière version**)
- [ ] Vérifier une dernière fois micro + son

## Après l’essai

- [ ] **↓ Texte** pour archiver la transcription (utile pour un compte rendu au jury).
- [ ] Noter les messages d’erreur éventuels avec la ligne **Diagnostic** correspondante.
