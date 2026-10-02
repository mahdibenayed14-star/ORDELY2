# Publier sur GitHub depuis Windows (CMD ou Git Bash) — Ordely V11

## À propos de `code .`

```
C:\Users\lenovo\...\ordely-corrige>code .
'code' n'est pas reconnu en tant que commande interne ou externe…
```

Cette erreur signifie simplement que **VS Code n'est pas installé**, ou que son dossier `bin` n'est
pas dans le PATH. Vous **n'avez pas besoin de VS Code** pour publier : tout se fait en ligne de
commande. Trois options :

| Je veux… | Commande |
|---|---|
| Publier le projet (recommandé) | double-cliquez sur **`pousser-vers-github.cmd`** dans le dossier, ou tapez `pousser-vers-github.cmd` |
| Ouvrir le dossier dans l'Explorateur | `explorer .` |
| Ouvrir un fichier pour le lire | `notepad index.html` (ou installez VS Code : https://code.visualstudio.com — cochez « Add to PATH » pendant l'installation) |

---

## Méthode la plus simple : le fichier `.cmd` fourni

Dans votre dossier `ordely-corrige`, **double-cliquez sur `pousser-vers-github.cmd`**.
Il enchaîne tout : vérification de Git, création du dépôt local si besoin, **création du commit**
(c'est ce qui manquait), correction automatique de l'adresse du dépôt, envoi, puis affichage des
étapes suivantes. En cas d'échec, il explique la cause et la solution exacte.

Vous pouvez aussi le lancer avec une autre adresse :

```bat
pousser-vers-github.cmd https://github.com/mon-compte/mon-depot.git
```

> Si vous avez collé l'adresse avec sa mise en forme `[https://…](https://…)`, le script le détecte
> et vous le dit : relancez-le alors **sans argument**, il utilisera l'adresse propre d'ORDELYY.

---

## Méthode manuelle dans CMD (équivalent, si vous préférez taper)

```bat
cd /d "C:\Users\lenovo\Desktop\IT junior consultant\PoC\ordely-corrige-V11\ordely-corrige"

git remote set-url origin https://github.com/mahdibenayed14-star/ORDELYY.git
git remote -v
git config user.name "Votre Nom"
git config user.email "votre.email@exemple.com"
git add -A
git commit -m "Ordely V11 - demo vocale corrigee"
git branch -M main
git push -u origin main
```

Contrôle avant l'envoi : `git log --oneline -1` doit afficher votre commit,
`git ls-files | wc -l` doit afficher environ 53.

---

## Diagnostic : `src refspec main does not match any`

```
$ git push -u origin main
error: src refspec main does not match any
```

**Cause** : le dépôt local ne contient **aucun commit**. `git init` crée un dépôt *vide* ; renommer
la branche avec `git branch -M main` ne crée rien à envoyer. **Solution** : `git add -A` puis
`git commit -m "…"` avant de pousser — exactement ce que fait `pousser-vers-github.cmd`.

**Cause secondaire fréquente** : l'adresse du dépôt a été collée avec sa mise en forme Markdown :

```
git remote add origin [https://github.com/mahdibenayed14-star/ORDELYY.git](https://github.com/…)
                     ↑ les crochets et parenthèses sont enregistrés dans l'adresse
```

Vérifiez avec `git remote -v` : l'adresse doit apparaître **sans crochets**. Sinon :
`git remote set-url origin https://github.com/mahdibenayed14-star/ORDELYY.git`

---

## Authentification sous Windows

Au moment du `git push`, **Git Credential Manager ouvre une fenêtre dans votre navigateur** :
connectez-vous à GitHub, autorisez, et l'envoi se poursuit. **Aucun jeton à créer dans ce cas.**

Si le terminal demande un nom d'utilisateur et un mot de passe : GitHub n'accepte plus les mots de
passe. Créez un jeton *fine-grained* limité au dépôt `ORDELYY` (permission `Contents : Read and write`,
expiration 7 jours), collez-le comme mot de passe, puis **révoquez-le** sur GitHub.

---

## Cas où le dépôt ORDELYY contient déjà des fichiers

Si `git push` répond :

```
! [rejected]  main -> main (fetch first)
error: failed to push some refs
```

**A. Remplacer la version en ligne par la V10** (le but recherché) :

```bat
git fetch origin
git push -u origin main --force-with-lease
```

`--force-with-lease` refuse d'écraser si quelqu'un d'autre a modifié le dépôt entre-temps : plus sûr
qu'un `--force` brut. L'ancienne version reste récupérable sur GitHub pendant 90 jours.

**B. Ne rien écraser : passer par une branche puis fusionner** :

```bat
git push -u origin main:v10-corrige
```

GitHub affiche alors **Compare & pull request** : fusionnez, et `main` reçoit la V10 en conservant
l'historique.

---

## Étape suivante : activer la publication

1. Sur GitHub : **Settings → Pages**.
2. **Source** : choisissez
   - **GitHub Actions** — recommandé : le dépôt contient `.github/workflows/pages.yml`, qui publie le
     dossier `public/`. Onglet **Actions** → attendez le voyant vert (1-2 min) ;
   - ou **Deploy from a branch** → **main** → **/(root)** : sert le `index.html` autonome à la racine.
3. L'adresse s'affiche sur la page **Settings → Pages**. Comme le dépôt s'appelle **ORDELYY** :

   ```
   https://mahdibenayed14-star.github.io/ORDELYY/
   ```

## Vérifier que le site publié est correct

Depuis le dossier du projet (Node.js requis) :

```bat
node scripts\verifier-deploiement.mjs https://mahdibenayed14-star.github.io/ORDELYY/
```

Attendu : **10/10** (page, `assets/`, `demo-data.json`, HTTPS). Si la réponse est « c'est encore
l'ancienne version V9 », relancez après une minute ou vérifiez la source choisie dans Pages.

## Essai sur téléphone

1. Ouvrez `https://mahdibenayed14-star.github.io/ORDELYY/` dans **Chrome (Android)** ou
   **Safari (iPhone)** — pas dans une fenêtre intégrée à une autre application.
2. **🎙 Tester le micro** : la barre doit bouger.
3. **♪ Tester le son** : vous devez entendre un bip.
4. **▶ Démarrer**, autorisez le micro, laissez Ordely parler en premier, puis parlez **sans aucun
   bouton** — et interrompez-le au milieu d'une phrase pour vérifier le comportement.

---

## Alternative en Git Bash (MINGW64)

Vous y étiez au début : les mêmes opérations y fonctionnent avec les scripts du projet.

```bash
cd "$HOME/Desktop/IT junior consultant/PoC/ordely-corrige-V11/ordely-corrige"
bash scripts/pousser-vers-github.sh https://github.com/mahdibenayed14-star/ORDELYY.git
# ou, pour envoyer ET vérifier le site publié :
bash scripts/tout-publier.sh https://github.com/mahdibenayed14-star/ORDELYY.git
```
