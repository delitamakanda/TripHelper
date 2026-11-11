# 🇹🇼 TripHelper — PWA de planification de voyage
TripHelper est une application mobile-friendly, offline-first, qui permet de planifier, suivre son budget et gérer son matériel pour un voyage à Taïwan (ou ailleurs).
Créée avec React, Tailwindcss et Dexie.js pour la base de données locale.

### Fonctionnalités
- Itinéraire journalier avec activités, objets à emporter et dépenses prévues
- Suivi des dépenses réelles jour par jour 
- Convertisseur de devises (NTD ⇄ EUR, USD, JPY, KRW, etc.) via exchangerate-api (taux chargé automatiquement, dernier taux connu conservé hors ligne)
- Base de données locale avec Dexie.js (IndexedDB)
- Export & import des données au format JSON 
- Réinitialisation des données avec confirmation 
- Mode PWA : installable et utilisable offline 
- Sauvegarde de la devise préférée
- 🌙 Mode nuit
- Notifications locales
- Planificateur de trajets

### Stack technique
| Technologie  |              Usage               |
|:------------:|:--------------------------------:|
|   React 19   |             Frontend             |
|   Dexie.js   | Base de données locale (offline) |
| exchangerate-api | API Taux de change (cache local) |
| FileSaver.js |         Export des datas         |
|     Vite     |           Build front            |

### 🚀 Installation locale
```bash
git clone https://github.com/delitamakanda/TripHelper.git
cd TripHelper
npm install
npm run dev
```

### Structure
```bash
src/
├── App.tsx               # Composant principal
├── db.ts                 # Dexie DB locale
├── components/           # Composants réutilisables
└── assets/               # visuels
```

### Fonctionnalité PWA
L'app peut être installée sur smartphone ou tablette :
- Sur Chrome : bouton “Installer” dans la barre d'adresse 
- Fonctionne hors ligne une fois chargée

### Export des données
- Format JSON structuré (checklist + dépenses)
- Peut être importé sur une autre session/navigateur

### Auteur
Développé avec ❤️ par Délita pour un usage personnel et éducatif, à l'occasion d'un voyage à Taïwan 🇹🇼