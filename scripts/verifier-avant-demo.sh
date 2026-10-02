#!/usr/bin/env bash
# Contrôle « avant démonstration » : vérifie tout le projet et prépare les archives.
# À lancer le jour de la démonstration, ou après chaque modification.
#
#   bash scripts/verifier-avant-demo.sh
set -uo pipefail
racine="$(cd "$(dirname "$0")/.." && pwd)"
cd "$racine"
titre() { printf '\n\033[1m%s\033[0m\n' "$1"; }
succes=0; problemes=0
etape() { if [ "$1" = "0" ]; then echo "✅ $2"; succes=$((succes+1)); else echo "❌ $2"; problemes=$((problemes+1)); fi; }

titre "1/6 · Outils"
command -v node >/dev/null && echo "✅ Node.js $(node --version)" || { echo "❌ Node.js manquant : installez-le depuis https://nodejs.org"; exit 1; }
if [ -d node_modules ]; then echo "✅ Dépendances installées"; else
  echo "ℹ️  Installation des dépendances (première fois)…"; npm install --no-audit --no-fund >/tmp/ordely-npm.log 2>&1
  [ $? -eq 0 ] && echo "✅ Dépendances installées" || { echo "❌ Échec de npm install (voir /tmp/ordely-npm.log)"; exit 1; }
fi

titre "2/6 · Tests du moteur et du serveur"
npm test >/tmp/ordely-test.log 2>&1; etape $? "Tests unitaires : $(grep -c '^ok' /tmp/ordely-test.log) réussis, $(grep -c '^not ok' /tmp/ordely-test.log) échecs"

titre "3/6 · Tests navigateur (facultatif si Playwright n'est pas installé)"
if [ -d "$HOME/.cache/ms-playwright" ] || ls node_modules/.bin/playwright >/dev/null 2>&1; then
  npm run test:e2e >/tmp/ordely-e2e.log 2>&1 && echo "✅ Tests navigateur réussis" || {
    if grep -q "Executable doesn't exist" /tmp/ordely-e2e.log; then
      echo "ℹ️  Navigateurs de test absents : lancez « npx playwright install chromium webkit » pour les activer."
    else echo "❌ Tests navigateur en échec (voir /tmp/ordely-e2e.log)"; problemes=$((problemes+1)); fi
  }
else echo "ℹ️  Playwright non installé : test navigateur ignoré."; fi

titre "4/6 · Génération de la page téléphone et des archives"
npm run phone >/tmp/ordely-phone.log 2>&1; etape $? "Page autonome reconstruite (index.html et telephone/index.html)"
bash scripts/creer-dossier-zip.sh >/tmp/ordely-zip.log 2>&1; etape $? "Archive du projet créée"

titre "5/6 · Vérification du service en local"
serveur_lance="non"
if curl -s -o /dev/null --max-time 3 http://localhost:10000/health; then
  echo "ℹ️  Un serveur répond déjà sur le port 10000."
else
  (setsid nohup node server.js >/tmp/ordely-server.log 2>&1 &) ; sleep 3
  if curl -s -o /dev/null --max-time 3 http://localhost:10000/health; then serveur_lance="oui"; echo "ℹ️  Serveur démarré temporairement pour le contrôle."; fi
fi
if node scripts/verifier-deploiement.mjs http://localhost:10000 >/tmp/ordely-verif.log 2>&1; then
  echo "✅ Contrôle local complet : $(grep -o '[0-9]*/[0-9]* contrôles réussis' /tmp/ordely-verif.log | head -1)"
else
  echo "⚠️  Contrôle local incomplet :"; tail -5 /tmp/ordely-verif.log | sed 's/^/   /'; problemes=$((problemes+1))
fi
[ "$serveur_lance" = "oui" ] && { pkill -f "node server.js" >/dev/null 2>&1; echo "ℹ️  Serveur temporaire arrêté."; }

titre "6/6 · Dossier de démonstration"
for fichier in ETAPES-ESSAI.md JURY_DEMO.md CHECKLIST.md SUIVI-TRAVAIL.md index.html; do
  [ -f "$fichier" ] && echo "✅ $fichier" || { echo "❌ $fichier manquant"; problemes=$((problemes+1)); }
done
printf '\nArchives disponibles (dossier parent) :\n'
for archive in ../ordely-pour-github-pages.zip ../ordely-pret-a-pousser-git.zip ../ordely-corrige-V11.zip; do
  [ -f "$archive" ] && printf '  • %-34s %s Ko\n' "$(basename "$archive")" "$(( $(stat -c %s "$archive") / 1024 ))"
done

titre "Résultat"
if [ "$problemes" -eq 0 ]; then
  echo "✅ TOUT EST PRÊT ($succes contrôles réussis). Vous pouvez faire la démonstration."
  cat <<'FIN'

Pour l'essai sur téléphone :
  1. Publiez la page (voir ETAPES-ESSAI.md, partie A) ou utilisez la démo déjà en ligne.
  2. Ouvrez le lien HTTPS dans Chrome Android ou Safari iPhone.
  3. 🎙 Tester le micro → ♪ Tester le son → ▶ Démarrer.
  4. Parlez sans bouton, puis interrompez l'agent au milieu d'une phrase.
FIN
else
  echo "⚠️  $problemes point(s) à corriger avant la démonstration. Détails ci-dessus et dans /tmp/ordely-*.log."
fi
exit $([ "$problemes" -eq 0 ] && echo 0 || echo 1)
