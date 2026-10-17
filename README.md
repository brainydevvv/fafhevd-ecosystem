# Site FAFHEVD (PWA)

## Démarrer
1. Node.js 18+ : https://nodejs.org
2. `npm install`
3. Copier `.env.example` en `.env`, changer mot de passe et secret
4. `npm start` puis http://localhost:3000 (admin : /admin.html)

## Pages
index, a-propos, domaines, actualites, contact (publiques), admin (protégée)

## PWA
manifest.webmanifest + sw.js : installable, fonctionne hors ligne (pages et dernières actualités en cache).
L'installation exige HTTPS en production (localhost fonctionne pour tester).
Après modification des fichiers, changer `V` dans public/sw.js pour forcer la mise à jour.

## À compléter
- RCCM complet (coupé sur la brochure) dans layout.js, a-propos.html
- Ajouter de vraies photos dans public/ (puis les ajouter au cache dans sw.js)
