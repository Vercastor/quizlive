# 🎯 QuizLive — Déploiement sur Render (guide complet)

Suivez ces étapes dans l'ordre. Durée totale : environ 10 minutes.

---

## Étape 1 — Créer un compte GitHub (gratuit)

GitHub est l'endroit où vous allez déposer le code pour que Render puisse le lire.

1. Allez sur https://github.com
2. Cliquez "Sign up" (en haut à droite)
3. Créez un compte avec votre email
4. Confirmez votre email

---

## Étape 2 — Déposer le code sur GitHub

1. Une fois connecté sur GitHub, cliquez sur le + en haut à droite → "New repository"
2. Donnez-lui un nom : quizlive
3. Laissez tout par défaut et cliquez "Create repository"
4. Sur la page qui s'affiche, cliquez sur le lien "uploading an existing file"
5. Glissez-déposez tous les fichiers du dossier dézippé :
   - server.js, package.json, README.md, .gitignore
   - Le dossier client entier (SANS son sous-dossier node_modules si présent)
6. Cliquez "Commit changes"

---

## Étape 3 — Créer un compte Render (gratuit)

1. Allez sur https://render.com
2. Cliquez "Get Started for Free"
3. Choisissez "Continue with GitHub" pour lier les deux comptes

---

## Étape 4 — Déployer l'application sur Render

1. Cliquez "New +" → "Web Service"
2. Cliquez "Connect" à côté de votre repository quizlive
3. Remplissez exactement comme ceci :

   Name            : quizlive
   Region          : Frankfurt (EU Central)
   Branch          : main
   Runtime         : Node
   Build Command   : npm run render-build
   Start Command   : npm start
   Instance Type   : Free

4. Cliquez "Create Web Service"

---

## Étape 5 — Attendre le déploiement (2 à 5 minutes)

Vous voyez les logs défiler. Attendez le message :
  ==> Your service is live

---

## Étape 6 — Votre lien définitif

En haut de la page Render, une URL du type :
  https://quizlive-xxxx.onrender.com

Partagez ce lien à vos joueurs. Ça marche sur tous les téléphones, partout dans le monde.

---

ATTENTION — Plan gratuit Render
L'application se met en veille après 15 min d'inactivité.
Le premier accès prend ~30 secondes. Ouvrez le lien 1 minute avant la partie.

---

## Comment jouer

ANIMATEUR (vous) :
1. Ouvrir le lien → "Je suis l'animateur"
2. Onglet Questions : saisir vos questions, 4 options, bonne réponse
3. Régler le temps par question
4. Cliquer "Enregistrer le quiz"
5. Onglet Contrôle → "Lancer le quiz"
6. Cliquer "Question suivante" après chaque résultat

JOUEURS :
1. Ouvrir le même lien → "Je suis joueur"
2. Entrer un pseudo
3. Attendre le lancement, puis appuyer sur la bonne réponse avant le minuteur
4. Répondre vite = plus de points !
