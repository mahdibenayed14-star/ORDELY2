# Étape par étape : activer la publication de ORDELYY

État vérifié le 2 octobre à 09:50 : vos fichiers V11 sont bien sur GitHub (dépôt **ORDELYY**,
branche `main`, 49 fichiers dont `index.html`, `public/`, `server.js`). Il ne reste **qu'une
action à faire**, dans votre navigateur, car GitHub exige que ce soit vous qui activiez la
publication.

---

## L'action à faire (2 minutes) — clic par clic

1. Ouvrez cette page :
   **https://github.com/mahdibenayed14-star/ORDELYY/settings/pages**
2. Sous **Build and deployment**, ligne **Source**, choisissez **Deploy from a branch**.
3. Deux listes apparaissent :
   - **Branch** : `main`
   - **Folder** : `/(root)`
4. Cliquez sur **Save**.
5. Attendez 1 à 2 minutes. Rechargez la page : en haut, un encadré affiche
   **« Your site is live at https://mahdibenayed14-star.github.io/ORDELYY/ »**.

C'est tout. Votre adresse publique sera :

```
https://mahdibenayed14-star.github.io/ORDELYY/
```

### Variante (si vous préférez servir le dossier `public/`)

1. Même page, **Source** = **GitHub Actions** (le dépôt contient déjà `.github/workflows/pages.yml`).
2. Ouvrez ensuite **https://github.com/mahdibenayed14-star/ORDELYY/actions**
3. À gauche : **Publier la démo gratuite sur GitHub Pages** → bouton **Run workflow** →
   branche `main` → **Run workflow**.
   *(Cette action manuelle n'est nécessaire qu'une fois : ensuite, chaque envoi sur `main`
   republie automatiquement.)*
4. Attendez le voyant vert (~1 minute).

> Choisissez **une seule** méthode. Si vous gardez *Deploy from a branch*, vous pouvez désactiver
> le workflow pour éviter un voyant rouge à chaque envoi : onglet **Actions** → « Publier la démo
> gratuite… » → menu **⋯** → **Disable workflow**.

---

## Attention à ne pas confondre les deux adresses

| Dépôt | Adresse | Contenu |
|---|---|---|
| **ordely** (ancien, 20 sept.) | `https://mahdibenayed14-star.github.io/ordely/` | ancienne démo **V9** : micro cassé, pas de transcription, conversation qui ne démarre pas |
| **ORDELYY** (nouveau, 2 oct.) | `https://mahdibenayed14-star.github.io/ORDELYY/` | **V11 corrigée** : c'est celle-ci qu'il faut utiliser et montrer |

La publication de l'ancienne adresse fonctionne toujours : si vous ouvrez `…/ordely/` par habitude,
vous retomberez sur la version défectueuse. Mieux vaut ne garder que le lien **ORDELYY**.

*(Pour supprimer proprement l'ancien dépôt plus tard : dépôt `ordely` → **Settings** → tout en bas →
**Delete this repository**. Facultatif, et sans effet sur ORDELYY.)*

---

## Vérification automatique (facultative)

Depuis votre dossier, dans CMD ou Git Bash :

```bat
node scripts\verifier-deploiement.mjs https://mahdibenayed14-star.github.io/ORDELYY/
```

Attendu : **10/10 contrôles réussis** — page, `assets/`, `demo-data.json`, contexte HTTPS.
Si vous lisez « c'est encore l'ancienne version », rechargez dans une minute : la première
publication de GitHub Pages peut prendre un peu plus de temps.

---

## Juste après : l'essai sur téléphone (5 minutes)

1. Sur le téléphone, ouvrez **https://mahdibenayed14-star.github.io/ORDELYY/** dans
   **Chrome (Android)** ou **Safari (iPhone)**.
   Évitez une fenêtre ouverte depuis une autre application (Instagram, Facebook, Gmail) : le micro y
   est bloqué.
2. Descendez jusqu'à **« Tout est bien branché ? »** :
   - **🎙 Tester le micro** → parlez : la barre doit bouger ;
   - **♪ Tester le son** → vous devez entendre un bip.
     Vérifiez le volume des médias ; désactivez le mode silencieux sur iPhone.
3. Appuyez **une seule fois** sur **▶ Démarrer**, puis **Autorisez** le micro.
   Ordely commence la conversation tout seul : « عسلامة … ». Aucun autre bouton à toucher.
4. Parlez naturellement, **sans appuyer sur Parler** : votre phrase apparaît d'abord en provisoire,
   puis en texte final ; la réponse d'Ordely s'affiche au même moment qu'elle est lue.
5. Testez l'**interruption** : pendant qu'Ordely parle, coupez-le —
   « **La la, estanna, l'adresse تبدلت** ».
   Sa voix doit s'arrêter immédiatement, la bulle doit indiquer « Interrompu », et il doit enchaîner
   sur la nouvelle demande.
6. Pour rejouer la démonstration : **■ Arrêter** → **Réinitialiser les commandes de démo** →
   **▶ Démarrer**.

Points de repère à l'écran pendant l'essai : **Micro : ON**, **Reconnaissance : ÉCOUTE**,
**Agent : PARLE** (puis **SILENCIEUX**).

---

## Ensuite, si vous voulez aller plus loin

| Suite | Ce que cela apporte | Comment |
|---|---|---|
| Voix et reconnaissance **tunisiennes** (Dido + Fennec) | La démo parle et comprend vraiment la derja, au lieu de dépendre des voix du navigateur | Déploiement sur Render puis **une clé Baarcha gratuite** (<https://baarcha.tn/platform>, sans carte bancaire) dans `BAARCHA_API_KEY` — guide : `docs/SOLUTION-GRATUITE-DERJA.md` |
| Démonstration devant un jury | Scénario minuté de 3 minutes | `JURY_DEMO.md` |
| Liste de contrôle le jour J | Rien n'est oublié | `CHECKLIST.md` |
