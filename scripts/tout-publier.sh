#!/usr/bin/env bash
# Publie Ordely V11 sur GitHub PUIS vérifie le site publié — une seule commande.
#
#   bash scripts/tout-publier.sh
#   bash scripts/tout-publier.sh https://github.com/mon-compte/ordely.git
#   bash scripts/tout-publier.sh git@github.com:mon-compte/ordely.git main
#
# Ce que fait le script :
#   1. vérifie qu'un identifiant GitHub est disponible (jeton en variable ou fichier git-credentials) ;
#   2. envoie les commits sur la branche demandée (avance rapide : aucun écrasement, aucun --force) ;
#   3. déduit l'adresse GitHub Pages, attend qu'elle réponde (la publication prend ~1 à 2 minutes) ;
#   4. lance la vérification complète du site publié avec scripts/verifier-deploiement.mjs.
#
# Si aucun identifiant n'est disponible, le script explique les deux chemins possibles
# (envoi par le navigateur, ou création d'un jeton limité à ce dépôt) et s'arrête proprement.
set -uo pipefail
depot="${1:-https://github.com/mahdibenayed14-star/ordely.git}"
branche="${2:-main}"
racine="$(cd "$(dirname "$0")/.." && pwd)"
cd "$racine"

titre() { printf '\n\033[1m%s\033[0m\n' "$1"; }
aide_identifiants() {
  cat <<'FIN'
Aucun identifiant GitHub n'est disponible dans cet environnement. Deux solutions :

  A. Publier sans exposer d'identifiant (2 minutes, recommandé)
     → Téléchargez ordely-pour-github-pages.zip, puis sur github.com :
       Add file → Upload files → glissez index.html, assets/, demo-data.json,
       sw.js, manifest.webmanifest, .nojekyll → Commit changes.
       Puis Settings → Pages → Deploy from a branch → main → /(root).

  B. Laisser ce script publier à votre place (meilleure solution pour tout mettre à jour)
     1. Créez un jeton finement limité : GitHub → Settings → Developer settings →
        Personal access tokens → Fine-grained tokens → Generate new token
        • Repository access : Only select repositories → ordely
        • Permissions : Contents = Read and write   (rien d'autre)
        • Expiration : 7 jours
     2. Rendez-le disponible pour ce script, au choix :
        • fichier ~/.git-credentials contenant exactement une ligne :
            https://VOTRE-IDENTIFIANT:VOTRE_JETON@github.com
          puis : chmod 600 ~/.git-credentials
        • ou variable d'environnement : export GITHUB_TOKEN=VOTRE_JETON
     3. Relancez :  bash scripts/tout-publier.sh
     4. Après le succès : révoquez le jeton sur GitHub et supprimez le fichier
        (rm ~/.git-credentials).

  Ce script n'affiche jamais la valeur du jeton, et il n'a besoin d'aucun autre droit.
FIN
}

titre "1/4 · Vérification des identifiants GitHub"
besoin_identifiants="oui"
case "$depot" in /*|./*|file://*) besoin_identifiants="non";; esac
identifiants="non"
if [ -n "${GITHUB_TOKEN:-}" ] || [ -n "${GH_TOKEN:-}" ]; then identifiants="variable d'environnement"; fi
if [ -f "$HOME/.git-credentials" ]; then identifiants="fichier ~/.git-credentials"; fi
if [ "$besoin_identifiants" = "oui" ] && [ "$identifiants" = "non" ]; then
  echo "❌ Aucun identifiant détecté."
  aide_identifiants
  exit 1
fi
if [ "$besoin_identifiants" = "non" ]; then
  echo "ℹ️  Dépôt local ou file:// : aucun identifiant nécessaire (mode test)."
else
  echo "✅ Identifiant détecté ($identifiants) — la valeur n'est jamais affichée."
fi

titre "2/4 · Envoi des commits"
if [ -n "$(git status --porcelain)" ]; then
  echo "Modifications non validées : elles sont incluses dans un commit automatique."
  git add -A
  git -c user.email="ordely@local" -c user.name="Ordely" commit -q -m "Ordely V11 : scripts et documents de publication"
fi
if git remote get-url origine >/dev/null 2>&1; then git remote set-url origine "$depot"; else git remote add origine "$depot"; fi
git --no-pager log --oneline -1
commande_git=(git)
if [ -n "${GITHUB_TOKEN:-}${GH_TOKEN:-}" ]; then
  # Le jeton n'est jamais écrit dans la configuration : il est fourni à la volée via un helper.
  commande_git+=( -c credential.helper='!f() { echo username=x-access-token; echo "password=${GITHUB_TOKEN:-${GH_TOKEN:-}}"; }; f' )
elif [ -f "$HOME/.git-credentials" ]; then
  commande_git+=( -c credential.helper=store )
fi
if [[ "$depot" == git@* ]] && ! compgen -G "$HOME/.ssh/id_*" >/dev/null; then
  echo "⚠️  Adresse SSH détectée mais aucune clé SSH présente. Utilisez plutôt l'adresse HTTPS du dépôt :"
  echo "   bash scripts/tout-publier.sh https://github.com/mahdibenayed14-star/ordely.git"
  exit 1
fi
if ! GIT_TERMINAL_PROMPT=0 "${commande_git[@]}" push origine "HEAD:refs/heads/$branche" 2>/tmp/ordely-push.err; then
  echo "❌ L'envoi a échoué."
  grep -qiE 'authentication|permission|403|denied' /tmp/ordely-push.err && echo "   Cause : identifiant refusé ou droits insuffisants sur ce dépôt."
  grep -qi 'non-fast-forward' /tmp/ordely-push.err && echo "   Cause : le dépôt distant a des commits en plus. Lancez : git pull --rebase origine $branche"
  sed 's/^/   /' /tmp/ordely-push.err | tail -4
  exit 1
fi
echo "✅ Commits envoyés sur $depot (branche $branche)."

titre "3/4 · Adresse du site"
adresse=""
if [[ "$depot" =~ github\.com[:/]([^/]+)/([^/]+?)(\.git)?$ ]]; then
  proprietaire="${BASH_REMATCH[1]}"; nomdepot="${BASH_REMATCH[2]}"
  if [ "$nomdepot" = "$proprietaire.github.io" ]; then adresse="https://$proprietaire.github.io/"
  else adresse="https://$proprietaire.github.io/$nomdepot/"; fi
fi
if [ -z "$adresse" ]; then
  echo "ℹ️  Dépôt non hébergé sur github.com : sautez la vérification automatique."
  exit 0
fi
echo "Adresse attendue : $adresse"
echo "Publication en cours (Workflow « GitHub Actions » ou Pages « Deploy from a branch »)…"
pret="non"
for tentative in $(seq 1 20); do
  code="$(curl -s -o /tmp/ordely-page.html -w '%{http_code}' --max-time 12 "$adresse" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ] && grep -q 'Ordely' /tmp/ordely-page.html; then
    if grep -qE 'Ordely V9|Conversation tunisienne' /tmp/ordely-page.html; then
      echo "⚠️  Le site répond mais affiche encore l'ancienne version. Vérifiez que la publication pointe sur les bons fichiers, puis relancez."
    else
      echo "✅ Site en ligne."; pret="oui"; break
    fi
  fi
  printf '   … tentative %s/20 (%s)\n' "$tentative" "$code"
  sleep 15
done
[ "$pret" = "non" ] && echo "ℹ️  Le site n'a pas répondu pour l'instant. Causes fréquentes : Pages pas encore activé (Settings → Pages), ou première publication en cours. Relancez ensuite : node scripts/verifier-deploiement.mjs $adresse"

titre "4/4 · Vérification complète du site publié"
if command -v node >/dev/null; then node scripts/verifier-deploiement.mjs "$adresse" || true
else echo "Node.js n'est pas installé : vérification ignorée. Contrôlez la page manuellement."; fi

titre "Étapes suivantes"
cat <<FIN
1. Sur le téléphone (Chrome Android ou Safari iPhone) : ouvrez $adresse
2. 🎙 Tester le micro → ♪ Tester le son → ▶ Démarrer
3. Parlez sans bouton, puis interrompez l'agent en pleine phrase pour vérifier le comportement.
4. Serveur + voix streaming (facultatif) : https://render.com/deploy?repo=$depot
5. Sécurité : si vous avez créé un jeton pour cet envoi, révoquez-le maintenant, et supprimez ~/.git-credentials.
FIN
