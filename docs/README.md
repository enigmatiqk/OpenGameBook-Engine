# Documentation - OpenGameBook Engine

Bienvenue dans la documentation complète de OpenGameBook Engine. Voici un guide pour naviguer dans les différents documents.

---

## 📖 Guides principaux

### [01 - Installation](01-installation.md)
Comment installer et configurer le projet en local.

### [02 - Guide utilisateur](02-guide-utilisateur.md)
Guide pour les joueurs : comment jouer à une aventure.

### [03 - Créer une aventure](03-creer-une-aventure.md)
Guide complet pour créer une nouvelle aventure (structure, sections, choix, etc.).

### [04 - Scanner PDF](04-scanner-pdf.md)
Comment utiliser l'outil de scan PDF pour convertir un livre papier en aventure numérique.

### [05 - Génération d'images IA](05-generation-images-ia.md)
Comment générer des images avec l'IA pour illustrer votre aventure.

### [06 - Mode debug (développement)](06-debug-mode-dev.md)
Paramètres URL pour tester et déboguer en mode développement.

### [07 - Items et gains](07-items-gain.md)
Comment gérer les items, les gains et les conditions d'inventaire.

### [08 - Effets de section](08-effets-section.md)
Comment ajouter des effets aux sections (augmentations de stat, items, etc.).

### [09 - Tests E2E](09-tests-e2e.md)
Guide complet pour écrire et exécuter les tests end-to-end avec Playwright.

---

## 🚀 Démarrage rapide

### Pour les joueurs
1. Lisez [02 - Guide utilisateur](02-guide-utilisateur.md)
2. Lancez l'application : `npm run dev`
3. Choisissez une aventure et jouez !

### Pour les créateurs d'aventure
1. Lisez [03 - Créer une aventure](03-creer-une-aventure.md)
2. Consultez [07 - Items et gains](07-items-gain.md) pour les mécaniques avancées
3. Consultez [08 - Effets de section](08-effets-section.md) pour les effets
4. Utilisez [06 - Mode debug](06-debug-mode-dev.md) pour tester

### Pour les développeurs
1. Lisez [01 - Installation](01-installation.md)
2. Consultez [06 - Mode debug](06-debug-mode-dev.md) pour les paramètres de test
3. Lisez [09 - Tests E2E](09-tests-e2e.md) pour écrire des tests
4. Consultez [08 - Effets de section](08-effets-section.md) pour comprendre les mécaniques

---

## 🔧 Outils

### Scanner PDF
Convertissez un livre papier en aventure numérique.
- Voir : [04 - Scanner PDF](04-scanner-pdf.md)

### Génération d'images IA
Générez des illustrations pour votre aventure.
- Voir : [05 - Génération d'images IA](05-generation-images-ia.md)

### Tests E2E
Testez votre aventure automatiquement.
- Voir : [09 - Tests E2E](09-tests-e2e.md)

---

## 📝 Fichiers d'exemple

### Items et gains
Voir : [EXAMPLES-items-gain.json](EXAMPLES-items-gain.json)

Exemples de configuration pour les items et les gains.

---

## 🎮 Fonctionnalités principales

### Aventures interactives
- Sections avec texte et images
- Choix multiples avec conditions
- Combats au tour par tour
- Gestion d'inventaire

### Système de stats
- Habileté, Endurance, Chance
- Augmentations/diminutions via effets
- Limites de stat configurables
- Historique des modifications

### Effets de section
- Augmentations de stat
- Ajout d'items
- Conditions d'application
- Dépassement de limites en mode debug

### Tests automatisés
- Tests E2E avec Playwright
- Paramètres de debug pour tests déterministes
- Screenshots automatiques en cas d'échec
- Rapports HTML détaillés

---

## 🐛 Dépannage

### L'application ne démarre pas
- Vérifiez que Node.js est installé : `node --version`
- Installez les dépendances : `npm install`
- Lancez le serveur : `npm run dev`

### Les tests ne passent pas
- Installez Playwright : `npx playwright install`
- Vérifiez les paramètres de debug dans l'URL
- Consultez [09 - Tests E2E](09-tests-e2e.md)

### Les images ne s'affichent pas
- Vérifiez que les fichiers image existent dans le dossier `images/`
- Vérifiez les chemins dans les définitions de section
- Consultez [05 - Génération d'images IA](05-generation-images-ia.md)

---

## 📚 Ressources supplémentaires

- [Playwright Documentation](https://playwright.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

---

## 📄 Licence

Voir le fichier [LICENSE](../LICENSE) à la racine du projet.

---

## 💬 Questions ?

Consultez la documentation pertinente ou ouvrez une issue sur le dépôt.
