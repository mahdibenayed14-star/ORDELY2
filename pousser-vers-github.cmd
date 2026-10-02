@echo off
setlocal
chcp 65001 >nul 2>nul
title Ordely V11 - Publication sur GitHub

rem ---------------------------------------------------------------------------
rem  Publie ce dossier (Ordely V11) sur votre depot GitHub.
rem  Utilisation : double-cliquez sur ce fichier, ou tapez :
rem        pousser-vers-github.cmd
rem        pousser-vers-github.cmd https://github.com/mon-compte/mon-depot.git
rem  Aucun accent dans ce fichier : CMD n'affiche pas correctement l'UTF-8.
rem ---------------------------------------------------------------------------

set "DEPOT=%~1"
if "%DEPOT%"=="" set "DEPOT=https://github.com/mahdibenayed14-star/ORDELYY.git"

echo ============================================================
echo  Ordely V11 - mise a jour du depot GitHub
echo  Depot cible : %DEPOT%
echo  Dossier     : %CD%
echo ============================================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :no_git

echo %DEPOT% | findstr /C:"[" >nul
if not errorlevel 1 goto :bad_url
echo %DEPOT% | findstr /C:"]" >nul
if not errorlevel 1 goto :bad_url

echo [1/6] Preparation du depot local...
if not exist ".git" (
  git init -q
  echo       Depot git cree dans ce dossier.
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%DEPOT%"
  echo       Depot distant ajoute.
) else (
  git remote set-url origin "%DEPOT%"
  echo       Depot distant mis a jour.
)

echo [2/6] Identite de l'auteur (renseignee si absente)...
git config user.name >nul 2>nul
if errorlevel 1 git config user.name "Ordely Demo"
git config user.email >nul 2>nul
if errorlevel 1 git config user.email "ordely@demo.local"

echo [3/6] Ajout des fichiers...
git add -A

echo [4/6] Creation du commit...
git diff --cached --quiet >nul 2>nul
if errorlevel 1 (
  git commit -q -m "Ordely V11 - demo vocale corrigee : demarrage, ecoute continue, interruption, transcription"
  echo       Commit cree.
) else (
  echo       Rien de nouveau a valider : le commit existe deja.
)
git rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 goto :no_commit

echo [5/6] Nom de la branche : main
git branch -M main

echo [6/6] Envoi vers GitHub (une fenetre d'authentification peut s'ouvrir)...
echo.
git push -u origin main
if errorlevel 1 goto :push_failed

echo.
echo ============================================================
echo  ENVOI REUSSI
echo ============================================================
echo  1. Sur GitHub : Settings -^> Pages
echo     - soit Source = "GitHub Actions" (le workflow du depot publie le dossier public/),
echo     - soit Source = "Deploy from a branch", branche main, dossier /(root).
echo  2. Patientez 1 a 2 minutes, puis ouvrez dans votre navigateur :
echo     https://mahdibenayed14-star.github.io/ORDELYY/
echo  3. Sur le telephone (Chrome Android ou Safari iPhone) :
echo     ouvrir cette adresse -^> Tester le micro -^> Tester le son -^> Demarrer
echo     puis parler sans bouton et interrompre l'agent au milieu d'une phrase.
echo.
echo  Verification automatique du site publie (Node.js requis) :
echo     node scripts\verifier-deploiement.mjs https://mahdibenayed14-star.github.io/ORDELYY/
goto :fin

:no_git
echo [ERREUR] Git n'est pas installe, ou absent du PATH.
echo.
echo   Solution : installez Git pour Windows
echo     https://git-scm.com/download/win
echo   Laissez l'option "Git from the command line" active, puis FERMEZ cette
echo   fenetre et relancez ce fichier par un double-clic.
goto :fin

:bad_url
echo [ERREUR] L'adresse du depot contient des crochets [ ] : elle a ete collee
echo          avec sa mise en forme (lien Markdown).
echo.
echo   Relancez simplement ce fichier SANS argument : l'adresse du depot ORDELYY
echo   sera utilisee automatiquement. Ou tapez l'adresse propre :
echo     pousser-vers-github.cmd https://github.com/mahdibenayed14-star/ORDELYY.git
goto :fin

:no_commit
echo [ERREUR] Aucun commit n'a pu etre cree.
echo          Verifiez que ce dossier contient bien les fichiers du projet
echo          (index.html, public, server.js, package.json...).
goto :fin

:push_failed
echo.
echo [ECHEC] L'envoi a ete refuse. Deux causes possibles, avec la solution :
echo.
echo  A) "Authentication failed" ou "could not read Username"
echo     - Une fenetre GitHub doit s'ouvrir dans votre navigateur : connectez-vous et autorisez.
echo     - Si le terminal demande un mot de passe, GitHub n'accepte plus les mots de passe :
echo       creez un jeton "fine-grained" (Settings -^> Developer settings -^> Personal access
echo       tokens -^> Fine-grained tokens) limite au depot ORDELYY, permission
echo       "Contents : Read and write", duree 7 jours, et collez-le comme mot de passe.
echo       Revoquez-le ensuite sur GitHub.
echo.
echo  B) "rejected ... fetch first" ou "non-fast-forward"
echo     Le depot distant contient deja des fichiers. Tapez alors ces deux commandes :
echo         git fetch origin
echo         git push -u origin main --force-with-lease
echo     Cela remplace proprement la version en ligne par la V10 (l'historique
echo     reste recuperable sur GitHub pendant 90 jours).
echo     Variante sans rien remplacer :  git push -u origin main:v10-corrige
echo     puis cliquez sur "Compare ^& pull request" sur GitHub et fusionnez.
goto :fin

:fin
echo.
pause
endlocal
